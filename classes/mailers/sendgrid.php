<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Sendgrid extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $api_key = $this->opt( 'api_key' );
    if ( empty( $api_key ) ) {
      return new WP_Error( 'mwmail_sendgrid_config', __( 'SendGrid API key is required.', 'meow-mailer' ) );
    }

    $personalization = [ 'to' => $this->recipients( $email['to'] ) ];
    if ( $email['cc'] ) {
      $personalization['cc'] = $this->recipients( $email['cc'] );
    }
    if ( $email['bcc'] ) {
      $personalization['bcc'] = $this->recipients( $email['bcc'] );
    }

    $payload = [
      'personalizations' => [ $personalization ],
      'from'             => array_filter( [ 'email' => $email['from_email'], 'name' => $email['from_name'] ] ),
      'subject'          => $email['subject'],
      'content'          => [ [
        'type'  => $this->is_html( $email ) ? 'text/html' : 'text/plain',
        'value' => $email['message'],
      ] ],
    ];
    if ( $email['reply_to'] ) {
      $rt = $this->recipients( $email['reply_to'] );
      $payload['reply_to'] = $rt[0];
    }
    $files = $this->attachments_base64( $email );
    if ( $files ) {
      $payload['attachments'] = array_map( function ( $f ) {
        return [ 'content' => $f['content'], 'filename' => $f['filename'], 'type' => $f['type'] ];
      }, $files );
    }

    $result = $this->http_post( 'https://api.sendgrid.com/v3/mail/send', [
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
