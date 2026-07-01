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
    foreach ( $email['attachments'] as $path ) {
      if ( file_exists( $path ) ) {
        try {
          $mail->addAttachment( $path );
        } catch ( \PHPMailer\PHPMailer\Exception $e ) {
          $this->core->log( 'Attachment skipped: ' . $e->getMessage() );
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
   * Recipients as [ ['email'=>, 'name'=>], ... ] for the JSON APIs.
   */
  protected function recipients( $list ) {
    $out = [];
    foreach ( (array) $list as $address ) {
      list( $email, $name ) = $this->split_address( $address );
      if ( $email ) {
        $out[] = [ 'email' => $email, 'name' => $name ];
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
   * Attachments encoded as base64 for the JSON APIs.
   * Returns [ ['filename'=>, 'content'=>base64, 'type'=>mime], ... ].
   */
  protected function attachments_base64( $email ) {
    $out = [];
    foreach ( (array) $email['attachments'] as $path ) {
      if ( ! file_exists( $path ) || ! is_readable( $path ) ) {
        continue;
      }
      $data = file_get_contents( $path );
      if ( $data === false ) {
        continue;
      }
      $type    = function_exists( 'mime_content_type' ) ? mime_content_type( $path ) : 'application/octet-stream';
      $out[] = [
        'filename' => basename( $path ),
        'content'  => base64_encode( $data ),
        'type'     => $type ?: 'application/octet-stream',
      ];
    }
    return $out;
  }

  /**
   * Build a multipart/form-data body. $fields is a flat list of [name, value]
   * pairs (repeated names allowed); $files is a list of normalized attachment paths.
   * Returns [ 'body' => string, 'content_type' => string ].
   */
  protected function build_multipart( $fields, $files = [] ) {
    $boundary = wp_generate_password( 24, false );
    $eol      = "\r\n";
    $body     = '';

    foreach ( $fields as $pair ) {
      list( $name, $value ) = $pair;
      $body .= '--' . $boundary . $eol;
      $body .= 'Content-Disposition: form-data; name="' . $name . '"' . $eol . $eol;
      $body .= $value . $eol;
    }
    foreach ( (array) $files as $path ) {
      if ( ! file_exists( $path ) || ! is_readable( $path ) ) {
        continue;
      }
      $data = file_get_contents( $path );
      if ( $data === false ) {
        continue;
      }
      $type  = function_exists( 'mime_content_type' ) ? ( mime_content_type( $path ) ?: 'application/octet-stream' ) : 'application/octet-stream';
      $body .= '--' . $boundary . $eol;
      $body .= 'Content-Disposition: form-data; name="attachment"; filename="' . basename( $path ) . '"' . $eol;
      $body .= 'Content-Type: ' . $type . $eol . $eol;
      $body .= $data . $eol;
    }
    $body .= '--' . $boundary . '--' . $eol;

    return [ 'body' => $body, 'content_type' => 'multipart/form-data; boundary=' . $boundary ];
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
