<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Brevo extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $api_key = $this->opt( 'api_key' );
    if ( empty( $api_key ) ) {
      return new WP_Error( 'mwmail_brevo_config', __( 'Brevo API key is required.', 'meow-mailer' ) );
    }

    $payload = [
      'sender'  => array_filter( [ 'email' => $email['from_email'], 'name' => $email['from_name'] ] ),
      'to'      => $this->recipients( $email['to'] ),
      'subject' => $email['subject'],
    ];
    if ( $email['cc'] ) {
      $payload['cc'] = $this->recipients( $email['cc'] );
    }
    if ( $email['bcc'] ) {
      $payload['bcc'] = $this->recipients( $email['bcc'] );
    }
    if ( $email['reply_to'] ) {
      $rt = $this->recipients( $email['reply_to'] );
      $payload['replyTo'] = $rt[0];
    }
    if ( $this->is_html( $email ) ) {
      $payload['htmlContent'] = $email['message'];
    } else {
      $payload['textContent'] = $email['message'];
    }
    $files = $this->attachments_base64( $email );
    if ( $files ) {
      $payload['attachment'] = array_map( function ( $f ) {
        return [ 'name' => $f['filename'], 'content' => $f['content'] ];
      }, $files );
    }

    $result = $this->http_post( 'https://api.brevo.com/v3/smtp/email', [
      'timeout' => 30,
      'headers' => [
        'api-key'      => $api_key,
        'Content-Type' => 'application/json',
        'Accept'       => 'application/json',
      ],
      'body'    => wp_json_encode( $payload ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }
}
