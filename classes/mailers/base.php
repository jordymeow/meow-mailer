<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

abstract class Meow_MWMAIL_Mailers_Base {

  protected $core = null;
  protected $options = []; // provider credentials

  public function __construct( $core, $options = [] ) {
    $this->core    = $core;
    $this->options = is_array( $options ) ? $options : [];
  }

  /**
   * Send a normalized email.
   *
   * @return true|WP_Error
   */
  abstract public function send( $email );

  protected function opt( $key, $default = '' ) {
    return $this->options[ $key ] ?? $default;
  }

  protected function is_html( $email ) {
    return self::email_is_html( $email );
  }

  private static function email_is_html( $email ) {
    return stripos( (string) ( $email['content_type'] ?? '' ), 'text/html' ) !== false;
  }

  /**
   * Build a configured WordPress PHPMailer from a normalized email. Used by the
   * SMTP and Gmail mailers (which both rely on PHPMailer to assemble the message).
   */
  protected function build_phpmailer( $email ) {
    $mail = self::new_phpmailer( $this->core, $email );

    /**
     * The envelope sender: the address a mail server returns bounces to, which can
     * differ from the visible From. Filterable so a plugin can give each message its
     * own bounce address (VERP and the like) without touching what recipients see.
     *
     * Only Generic SMTP acts on it, since it becomes the SMTP MAIL FROM. Gmail and
     * Amazon SES take a finished message and put their own envelope around it, so it
     * is inert there rather than wrong. Left empty, the server falls back to the From
     * address by itself, which is the behaviour every install had before this existed.
     *
     * @param string $return_path
     * @param array  $email  the normalized email
     */
    $return_path = apply_filters( 'mwmail_return_path', $email['return_path'] ?? '', $email );
    if ( ! empty( $return_path ) && is_email( $return_path ) ) {
      $mail->Sender = $return_path;
    }

    return $mail;
  }

  /**
   * The message itself, with no transport and no envelope sender: addresses, body,
   * headers and files, and nothing that depends on which provider sends it.
   *
   * Shared on purpose. The mailers that send through PHPMailer build on it, and so
   * does the `phpmailer_init` compatibility layer, so the message other plugins get
   * to inspect is the very same one we are about to send.
   */
  public static function new_phpmailer( $core, $email ) {
    require_once ABSPATH . WPINC . '/PHPMailer/PHPMailer.php';
    require_once ABSPATH . WPINC . '/PHPMailer/SMTP.php';
    require_once ABSPATH . WPINC . '/PHPMailer/Exception.php';

    $mail = new \PHPMailer\PHPMailer\PHPMailer( true );
    $mail->CharSet = $email['charset'] ?: 'UTF-8';

    // Left alone, PHPMailer advertises itself and its version in X-Mailer. A site has
    // no reason to tell recipients which library sent its mail, so drop the header:
    // PHPMailer omits it entirely when XMailer is whitespace (empty means "default").
    $mail->XMailer = ' ';

    $mail->setFrom( $email['from_email'], $email['from_name'], false );

    foreach ( $email['to'] as $addr ) {
      self::add_address( $core, $mail, 'to', $addr );
    }
    foreach ( $email['cc'] as $addr ) {
      self::add_address( $core, $mail, 'cc', $addr );
    }
    foreach ( $email['bcc'] as $addr ) {
      self::add_address( $core, $mail, 'bcc', $addr );
    }
    foreach ( $email['reply_to'] as $addr ) {
      self::add_address( $core, $mail, 'reply_to', $addr );
    }

    $mail->Subject = $email['subject'];
    $mail->Body    = $email['message'];
    if ( self::email_is_html( $email ) ) {
      $mail->isHTML( true );
      $mail->AltBody = wp_strip_all_tags( $email['message'] );
    }

    foreach ( $email['custom_headers'] as $name => $value ) {
      $mail->addCustomHeader( $name, $value );
    }
    // A string key is the name wp_mail() wants the recipient to see.
    foreach ( $email['attachments'] as $name => $path ) {
      if ( file_exists( $path ) ) {
        try {
          $mail->addAttachment( $path, is_string( $name ) ? $name : '' );
        } catch ( \PHPMailer\PHPMailer\Exception $e ) {
          $core->log( 'Attachment skipped: ' . $e->getMessage() );
        }
      }
    }
    // Embeds are keyed by Content-ID so the HTML can reference them as cid:key.
    foreach ( ( $email['embeds'] ?? [] ) as $cid => $path ) {
      if ( file_exists( $path ) ) {
        try {
          $mail->addEmbeddedImage( $path, (string) $cid, basename( $path ) );
        } catch ( \PHPMailer\PHPMailer\Exception $e ) {
          $core->log( 'Embedded image skipped: ' . $e->getMessage() );
        }
      }
    }
    // Files another plugin added through `phpmailer_init`. Bytes are passed as bytes
    // and a path as a path, never the one for the other: a PDF built in memory
    // starts with %PDF, and handing that to a function expecting a file name is how
    // a generated invoice silently turns into a failed send.
    foreach ( self::extra_files( $email ) as $file ) {
      try {
        if ( $file['inline'] && $file['content'] !== null ) {
          $mail->addStringEmbeddedImage( $file['content'], $file['cid'], $file['name'], \PHPMailer\PHPMailer\PHPMailer::ENCODING_BASE64, $file['type'] );
        } else if ( $file['inline'] ) {
          $mail->addEmbeddedImage( $file['path'], $file['cid'], $file['name'] );
        } else if ( $file['content'] !== null ) {
          $mail->addStringAttachment( $file['content'], $file['name'], \PHPMailer\PHPMailer\PHPMailer::ENCODING_BASE64, $file['type'] );
        } else {
          $mail->addAttachment( $file['path'], $file['name'] );
        }
      } catch ( \PHPMailer\PHPMailer\Exception $e ) {
        $core->log( 'Attachment from phpmailer_init skipped: ' . $e->getMessage() );
      }
    }

    return $mail;
  }

  /**
   * The files another plugin contributed through `phpmailer_init`, normalized and
   * with the unusable ones dropped. Each entry has either 'content' (bytes) or
   * 'path', never both, and an inline one always carries a Content-ID.
   */
  public static function extra_files( $email ) {
    $out = [];
    foreach ( (array) ( $email['extra_attachments'] ?? [] ) as $file ) {
      if ( ! is_array( $file ) ) {
        continue;
      }
      $content = isset( $file['content'] ) && $file['content'] !== null ? (string) $file['content'] : null;
      $path    = $content === null ? (string) ( $file['path'] ?? '' ) : '';
      if ( $content === null && ( $path === '' || ! file_exists( $path ) || ! is_readable( $path ) ) ) {
        continue;
      }
      $name = (string) ( $file['name'] ?? '' );
      if ( $name === '' ) {
        $name = $path !== '' ? basename( $path ) : 'attachment';
      }
      $cid = (string) ( $file['cid'] ?? '' );
      $out[] = [
        'name'    => $name,
        'content' => $content,
        'path'    => $path,
        'type'    => (string) ( $file['type'] ?? '' ) ?: self::guess_type( $name, $path ),
        'inline'  => ! empty( $file['inline'] ) && $cid !== '',
        'cid'     => $cid,
      ];
    }
    return $out;
  }

  /**
   * The MIME type of a file. Sniffed from the file when there is one on disk, and
   * otherwise worked out from the name, which is all in-memory content has.
   */
  protected static function guess_type( $name, $path = '' ) {
    if ( $path !== '' && file_exists( $path ) && function_exists( 'mime_content_type' ) ) {
      $sniffed = @mime_content_type( $path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- unreadable files fall through to the name
      if ( ! empty( $sniffed ) ) {
        return $sniffed;
      }
    }
    $type = wp_check_filetype( $name );
    return ! empty( $type['type'] ) ? $type['type'] : 'application/octet-stream';
  }

  private static function add_address( $core, $mail, $type, $address ) {
    list( $email, $name ) = self::split_address( $address );
    if ( ! $email ) {
      return;
    }
    try {
      switch ( $type ) {
        case 'cc':       $mail->addCC( $email, $name ); break;
        case 'bcc':      $mail->addBCC( $email, $name ); break;
        case 'reply_to': $mail->addReplyTo( $email, $name ); break;
        default:         $mail->addAddress( $email, $name ); break;
      }
    } catch ( \PHPMailer\PHPMailer\Exception $e ) {
      $core->log( 'Invalid address skipped: ' . $address );
    }
  }

  protected static function split_address( $address ) {
    $name = '';
    if ( preg_match( '/(.*)<(.+)>/', $address, $m ) && count( $m ) === 3 ) {
      $name    = trim( $m[1], ' "' );
      $address = trim( $m[2] );
    }
    return [ trim( $address ), $name ];
  }

  /**
   * Recipients as [ ['email'=>, 'name'=>], ... ] for the JSON APIs. The name is
   * only there when the address actually carries one: Brevo (and others) reject
   * an empty "name" with "name is missing in to", and most wp_mail() recipients
   * are a bare email address.
   */
  protected function recipients( $list ) {
    $out = [];
    foreach ( (array) $list as $address ) {
      list( $email, $name ) = $this->split_address( $address );
      if ( $email ) {
        $out[] = $name === '' ? [ 'email' => $email ] : [ 'email' => $email, 'name' => $name ];
      }
    }
    return $out;
  }

  /**
   * Shared wrapper around wp_remote_post that turns transport and HTTP errors
   * into a WP_Error, and returns the decoded body on success.
   *
   * @return array|WP_Error
   */
  protected function http_post( $url, $args, $ok_codes = [ 200, 201, 202 ] ) {
    $response = wp_remote_post( $url, $args );
    if ( is_wp_error( $response ) ) {
      return $response;
    }
    $code = wp_remote_retrieve_response_code( $response );
    $body = wp_remote_retrieve_body( $response );
    if ( ! in_array( $code, $ok_codes, true ) ) {
      $message = $this->extract_error( $body );
      return new WP_Error( 'mwmail_http_' . $code, $message ?: ( 'HTTP ' . $code ) );
    }
    return json_decode( $body, true ) ?: [];
  }

  /**
   * Attachments encoded as base64 for the JSON APIs, embedded images included.
   * Returns [ ['filename'=>, 'content'=>base64, 'type'=>mime, 'inline'=>bool, 'cid'=>string], ... ].
   *
   * Providers that can send an image inline should use 'inline' and 'cid'. The
   * others still receive the embeds as regular attachments, which is imperfect
   * but a lot better than dropping them.
   */
  protected function attachments_base64( $email ) {
    $out = [];
    foreach ( (array) $email['attachments'] as $name => $path ) {
      $file = $this->read_base64( $path, is_string( $name ) ? $name : basename( $path ) );
      if ( $file ) {
        $out[] = $file + [ 'inline' => false, 'cid' => '' ];
      }
    }
    foreach ( ( $email['embeds'] ?? [] ) as $cid => $path ) {
      $file = $this->read_base64( $path, basename( $path ) );
      if ( $file ) {
        $out[] = $file + [ 'inline' => true, 'cid' => (string) $cid ];
      }
    }
    // Contributed through `phpmailer_init`: already in memory as often as not, and
    // the bytes are encoded as they are rather than looked up on disk.
    foreach ( self::extra_files( $email ) as $file ) {
      $data = $file['content'] !== null ? $file['content'] : $this->read_file( $file['path'] );
      if ( $data === null ) {
        continue;
      }
      $out[] = [
        'filename' => $file['name'],
        'content'  => base64_encode( $data ),
        'type'     => $file['type'],
        'inline'   => $file['inline'],
        'cid'      => $file['cid'],
      ];
    }
    return $out;
  }

  /** @return array|null  ['filename'=>, 'content'=>base64, 'type'=>mime] */
  private function read_base64( $path, $filename ) {
    $data = $this->read_file( $path );
    if ( $data === null ) {
      return null;
    }
    return [
      'filename' => $filename,
      'content'  => base64_encode( $data ),
      'type'     => self::guess_type( $filename, $path ),
    ];
  }

  /**
   * Build a multipart/form-data body. $fields is a flat list of [name, value]
   * pairs (repeated names allowed), and the files come from the normalized email:
   * its attachments, its inline images, and whatever `phpmailer_init` added.
   * Returns [ 'body' => string, 'content_type' => string ].
   */
  protected function build_multipart( $fields, $email ) {
    $boundary = wp_generate_password( 24, false );
    $eol      = "\r\n";
    $body     = '';

    foreach ( $fields as $pair ) {
      list( $name, $value ) = $pair;
      $body .= '--' . $boundary . $eol;
      $body .= 'Content-Disposition: form-data; name="' . $name . '"' . $eol . $eol;
      $body .= $value . $eol;
    }
    foreach ( (array) $email['attachments'] as $name => $path ) {
      $data = $this->read_file( $path );
      if ( $data !== null ) {
        $filename = is_string( $name ) ? $name : basename( $path );
        $body .= $this->multipart_file( 'attachment', $data, $filename, self::guess_type( $filename, $path ), $boundary, $eol );
      }
    }
    // Inline files are matched by their name, so keeping the Content-ID as the
    // file name is what makes the cid: references in the HTML resolve.
    foreach ( ( $email['embeds'] ?? [] ) as $cid => $path ) {
      $data = $this->read_file( $path );
      if ( $data !== null ) {
        $body .= $this->multipart_file( 'inline', $data, (string) $cid, self::guess_type( basename( $path ), $path ), $boundary, $eol );
      }
    }
    foreach ( self::extra_files( $email ) as $file ) {
      $data = $file['content'] !== null ? $file['content'] : $this->read_file( $file['path'] );
      if ( $data !== null ) {
        $body .= $this->multipart_file( $file['inline'] ? 'inline' : 'attachment', $data, $file['inline'] ? $file['cid'] : $file['name'], $file['type'], $boundary, $eol );
      }
    }
    $body .= '--' . $boundary . '--' . $eol;

    return [ 'body' => $body, 'content_type' => 'multipart/form-data; boundary=' . $boundary ];
  }

  /** The part takes the bytes, never a path: what is attached is already decided. */
  private function multipart_file( $field, $data, $filename, $type, $boundary, $eol ) {
    $part  = '--' . $boundary . $eol;
    $part .= 'Content-Disposition: form-data; name="' . $field . '"; filename="' . $filename . '"' . $eol;
    $part .= 'Content-Type: ' . ( $type ?: 'application/octet-stream' ) . $eol . $eol;
    $part .= $data . $eol;
    return $part;
  }

  /** @return string|null  null when the file is missing or unreadable. */
  public static function read_file( $path ) {
    if ( ! $path || ! file_exists( $path ) || ! is_readable( $path ) ) {
      return null;
    }
    $data = file_get_contents( $path );
    return $data === false ? null : $data;
  }

  protected function extract_error( $body ) {
    $json = json_decode( $body, true );
    if ( is_array( $json ) ) {
      $messages = self::error_messages( $json );
      if ( ! empty( $messages ) ) {
        return substr( implode( ' ', $messages ), 0, 500 );
      }
    }
    return is_string( $body ) ? substr( $body, 0, 500 ) : '';
  }

  /**
   * The readable sentences out of a provider's error response, wherever it put them.
   * They all disagree on the shape: a flat "message", a list of "errors" each with
   * one of its own (SendGrid), a message nested under "data" (SMTP2GO) or two levels
   * down inside "Messages" (Mailjet).
   *
   * Worth the recursion: the log used to show those shapes as raw JSON, which turned
   * the one sentence that says what to fix ("The from address does not match a
   * verified Sender Identity") into the hardest part of the line to read.
   *
   * @return string[]
   */
  /** Trimmed, and ending like a sentence so several of them read as one paragraph. */
  private static function as_sentence( $text ) {
    $text = trim( $text );
    return preg_match( '/[.!?]$/', $text ) ? $text : $text . '.';
  }

  private static function error_messages( $node, $depth = 0 ) {
    // Deep enough for every shape above, and it stops a hostile or broken response
    // from walking us into a stack overflow.
    if ( $depth > 4 || ! is_array( $node ) ) {
      return [];
    }
    $carries = [ 'message', 'Message', 'ErrorMessage', 'error', 'Error', 'detail', 'description' ];
    $found   = [];
    foreach ( $node as $key => $value ) {
      $key = (string) $key;
      if ( is_string( $value ) && trim( $value ) !== '' ) {
        // A named key we know carries a sentence, or a bare list item inside an
        // "errors" block, which is where field validation details live (MailerSend
        // puts "The from.email must be a verified domain" there, under the field
        // name). Other named keys are skipped: they hold codes and field names.
        if ( in_array( $key, $carries, true ) || ( $depth > 0 && is_numeric( $key ) ) ) {
          $found[] = self::as_sentence( $value );
        }
        continue;
      }
      if ( is_array( $value ) ) {
        $found = array_merge( $found, self::error_messages( $value, $depth + 1 ) );
      }
    }
    return array_values( array_unique( $found ) );
  }
}
