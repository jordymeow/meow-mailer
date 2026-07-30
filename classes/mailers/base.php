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
    return stripos( $email['content_type'], 'text/html' ) !== false;
  }

  /**
   * Build a configured WordPress PHPMailer from a normalized email. Used by the
   * SMTP and Gmail mailers (which both rely on PHPMailer to assemble the message).
   */
  protected function build_phpmailer( $email ) {
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
      $this->add_address( $mail, 'to', $addr );
    }
    foreach ( $email['cc'] as $addr ) {
      $this->add_address( $mail, 'cc', $addr );
    }
    foreach ( $email['bcc'] as $addr ) {
      $this->add_address( $mail, 'bcc', $addr );
    }
    foreach ( $email['reply_to'] as $addr ) {
      $this->add_address( $mail, 'reply_to', $addr );
    }

    $mail->Subject = $email['subject'];
    $mail->Body    = $email['message'];
    if ( $this->is_html( $email ) ) {
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
          $this->core->log( 'Attachment skipped: ' . $e->getMessage() );
        }
      }
    }
    // Embeds are keyed by Content-ID so the HTML can reference them as cid:key.
    foreach ( ( $email['embeds'] ?? [] ) as $cid => $path ) {
      if ( file_exists( $path ) ) {
        try {
          $mail->addEmbeddedImage( $path, (string) $cid, basename( $path ) );
        } catch ( \PHPMailer\PHPMailer\Exception $e ) {
          $this->core->log( 'Embedded image skipped: ' . $e->getMessage() );
        }
      }
    }

    return $mail;
  }

  private function add_address( $mail, $type, $address ) {
    list( $email, $name ) = $this->split_address( $address );
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
      $this->core->log( 'Invalid address skipped: ' . $address );
    }
  }

  protected function split_address( $address ) {
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
    return $out;
  }

  /** @return array|null  ['filename'=>, 'content'=>base64, 'type'=>mime] */
  private function read_base64( $path, $filename ) {
    if ( ! file_exists( $path ) || ! is_readable( $path ) ) {
      return null;
    }
    $data = file_get_contents( $path );
    if ( $data === false ) {
      return null;
    }
    $type = function_exists( 'mime_content_type' ) ? mime_content_type( $path ) : 'application/octet-stream';
    return [
      'filename' => $filename,
      'content'  => base64_encode( $data ),
      'type'     => $type ?: 'application/octet-stream',
    ];
  }

  /**
   * Build a multipart/form-data body. $fields is a flat list of [name, value]
   * pairs (repeated names allowed); $attachments and $embeds are normalized file
   * maps. Returns [ 'body' => string, 'content_type' => string ].
   */
  protected function build_multipart( $fields, $attachments = [], $embeds = [] ) {
    $boundary = wp_generate_password( 24, false );
    $eol      = "\r\n";
    $body     = '';

    foreach ( $fields as $pair ) {
      list( $name, $value ) = $pair;
      $body .= '--' . $boundary . $eol;
      $body .= 'Content-Disposition: form-data; name="' . $name . '"' . $eol . $eol;
      $body .= $value . $eol;
    }
    foreach ( (array) $attachments as $name => $path ) {
      $body .= $this->multipart_file( 'attachment', $path, is_string( $name ) ? $name : basename( $path ), $boundary, $eol );
    }
    // Inline files are matched by their name, so keeping the Content-ID as the
    // file name is what makes the cid: references in the HTML resolve.
    foreach ( (array) $embeds as $cid => $path ) {
      $body .= $this->multipart_file( 'inline', $path, (string) $cid, $boundary, $eol );
    }
    $body .= '--' . $boundary . '--' . $eol;

    return [ 'body' => $body, 'content_type' => 'multipart/form-data; boundary=' . $boundary ];
  }

  private function multipart_file( $field, $path, $filename, $boundary, $eol ) {
    if ( ! file_exists( $path ) || ! is_readable( $path ) ) {
      return '';
    }
    $data = file_get_contents( $path );
    if ( $data === false ) {
      return '';
    }
    $type  = function_exists( 'mime_content_type' ) ? ( mime_content_type( $path ) ?: 'application/octet-stream' ) : 'application/octet-stream';
    $part  = '--' . $boundary . $eol;
    $part .= 'Content-Disposition: form-data; name="' . $field . '"; filename="' . $filename . '"' . $eol;
    $part .= 'Content-Type: ' . $type . $eol . $eol;
    $part .= $data . $eol;
    return $part;
  }

  protected function extract_error( $body ) {
    $json = json_decode( $body, true );
    if ( is_array( $json ) ) {
      foreach ( [ 'message', 'Message', 'error', 'detail', 'errors' ] as $key ) {
        if ( ! empty( $json[ $key ] ) ) {
          return is_string( $json[ $key ] ) ? $json[ $key ] : wp_json_encode( $json[ $key ] );
        }
      }
    }
    return is_string( $body ) ? substr( $body, 0, 500 ) : '';
  }
}
