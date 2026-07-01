<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Mailersend extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $api_key = $this->opt( 'api_key' );
    if ( empty( $api_key ) ) {
      return new WP_Error( 'mwmail_mailersend_config', __( 'MailerSend API key is required.', 'meow-mailer' ) );
    }

    $payload = [
      'from'    => array_filter( [ 'email' => $email['from_email'], 'name' => $email['from_name'] ] ),
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
      $payload['reply_to'] = $rt[0];
    }
    if ( $this->is_html( $email ) ) {
      $payload['html'] = $email['message'];
    } else {
      $payload['text'] = $email['message'];
    }
    $files = $this->attachments_base64( $email );
    if ( $files ) {
      $payload['attachments'] = array_map( function ( $f ) {
        return [ 'content' => $f['content'], 'filename' => $f['filename'], 'disposition' => 'attachment' ];
      }, $files );
    }

    $result = $this->http_post( 'https://api.mailersend.com/v1/email', [
      'timeout' => 30,
      'headers' => [
        'Authorization' => 'Bearer ' . $api_key,
        'Content-Type'  => 'application/json',
        'Accept'        => 'application/json',
      ],
      'body'    => wp_json_encode( $payload ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }
}
