<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Resend extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $api_key = $this->opt( 'api_key' );
    if ( empty( $api_key ) ) {
      return new WP_Error( 'mwmail_resend_config', __( 'Resend API key is required.', 'meow-mailer' ) );
    }

    $payload = [
      'from'    => $email['from_name'] ? sprintf( '%s <%s>', $email['from_name'], $email['from_email'] ) : $email['from_email'],
      'to'      => array_values( $email['to'] ),
      'subject' => $email['subject'],
    ];
    if ( $email['cc'] ) {
      $payload['cc'] = array_values( $email['cc'] );
    }
    if ( $email['bcc'] ) {
      $payload['bcc'] = array_values( $email['bcc'] );
    }
    if ( $email['reply_to'] ) {
      $payload['reply_to'] = array_values( $email['reply_to'] );
    }
    if ( $this->is_html( $email ) ) {
      $payload['html'] = $email['message'];
    } else {
      $payload['text'] = $email['message'];
    }
    $files = $this->attachments_base64( $email );
    if ( $files ) {
      $payload['attachments'] = array_map( function ( $f ) {
        return [ 'filename' => $f['filename'], 'content' => $f['content'] ];
      }, $files );
    }

    $result = $this->http_post( 'https://api.resend.com/emails', [
      'timeout' => 30,
      'headers' => [
        'Authorization' => 'Bearer ' . $api_key,
        'Content-Type'  => 'application/json',
      ],
      'body'    => wp_json_encode( $payload ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }
}
