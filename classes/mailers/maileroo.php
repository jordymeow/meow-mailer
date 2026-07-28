<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Maileroo extends Meow_MWMAIL_Mailers_Base {

  const MAX_SUBJECT_LENGTH = 255;

  public function send( $email ) {
    $api_key = $this->opt( 'api_key' );
    if ( empty( $api_key ) ) {
      return new WP_Error( 'mwmail_maileroo_config', __( 'Maileroo sending key is required.', 'meow-mailer' ) );
    }

    // Maileroo rejects the whole email over 255 characters, so trim rather than fail.
    $subject = (string) $email['subject'];
    if ( mb_strlen( $subject ) > self::MAX_SUBJECT_LENGTH ) {
      $subject = mb_substr( $subject, 0, self::MAX_SUBJECT_LENGTH );
    }

    $payload = [
      'from'    => $this->address( $email['from_email'], $email['from_name'] ),
      'to'      => $this->addresses( $email['to'] ),
      'subject' => $subject,
    ];
    if ( $email['cc'] ) {
      $payload['cc'] = $this->addresses( $email['cc'] );
    }
    if ( $email['bcc'] ) {
      $payload['bcc'] = $this->addresses( $email['bcc'] );
    }
    if ( $email['reply_to'] ) {
      $payload['reply_to'] = $this->addresses( $email['reply_to'] );
    }
    if ( $this->is_html( $email ) ) {
      $payload['html'] = $email['message'];
    } else {
      $payload['plain'] = $email['message'];
    }
    $files = $this->attachments_base64( $email );
    if ( $files ) {
      $payload['attachments'] = array_map( function ( $f ) {
        return [
          'file_name'    => $f['filename'],
          'content_type' => $f['type'],
          'content'      => $f['content'],
          'inline'       => false,
        ];
      }, $files );
    }

    $result = $this->http_post( 'https://smtp.maileroo.com/api/v2/emails', [
      'timeout' => 30,
      'headers' => [
        'Authorization' => 'Bearer ' . $api_key,
        'Content-Type'  => 'application/json',
      ],
      'body'    => wp_json_encode( $payload ),
    ] );

    if ( is_wp_error( $result ) ) {
      return $result;
    }

    // Maileroo answers HTTP 200 even when it refuses the email (unverified sending
    // domain, invalid recipient…). Without this the log would say "Sent" for an
    // email that was never delivered.
    if ( isset( $result['success'] ) && ! $result['success'] ) {
      $message = ! empty( $result['message'] ) ? $result['message'] : __( 'Maileroo rejected the email.', 'meow-mailer' );
      return new WP_Error( 'mwmail_maileroo_rejected', $message );
    }

    return true;
  }

  /** Maileroo uses { address, display_name }, not the { email, name } of the other APIs. */
  private function address( $email, $name = '' ) {
    $out = [ 'address' => $email ];
    if ( ! empty( $name ) ) {
      $out['display_name'] = $name;
    }
    return $out;
  }

  private function addresses( $list ) {
    $out = [];
    foreach ( (array) $list as $entry ) {
      list( $address, $name ) = $this->split_address( $entry );
      if ( $address ) {
        $out[] = $this->address( $address, $name );
      }
    }
    return $out;
  }
}
