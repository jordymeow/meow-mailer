<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Mailjet extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $api_key    = $this->opt( 'api_key' );
    $secret_key = $this->opt( 'secret_key' );
    if ( empty( $api_key ) || empty( $secret_key ) ) {
      return new WP_Error( 'mwmail_mailjet_config', __( 'Mailjet API key and secret key are required.', 'meow-mailer' ) );
    }

    $message = [
      'From'    => array_filter( [ 'Email' => $email['from_email'], 'Name' => $email['from_name'] ] ),
      'To'      => $this->mj_recipients( $email['to'] ),
      'Subject' => $email['subject'],
    ];
    if ( $email['cc'] ) {
      $message['Cc'] = $this->mj_recipients( $email['cc'] );
    }
    if ( $email['bcc'] ) {
      $message['Bcc'] = $this->mj_recipients( $email['bcc'] );
    }
    if ( $email['reply_to'] ) {
      $rt = $this->mj_recipients( $email['reply_to'] );
      $message['ReplyTo'] = $rt[0];
    }
    if ( $this->is_html( $email ) ) {
      $message['HTMLPart'] = $email['message'];
    } else {
      $message['TextPart'] = $email['message'];
    }
    $files = $this->attachments_base64( $email );
    if ( $files ) {
      $message['Attachments'] = array_map( function ( $f ) {
        return [ 'ContentType' => $f['type'], 'Filename' => $f['filename'], 'Base64Content' => $f['content'] ];
      }, $files );
    }

    $result = $this->http_post( 'https://api.mailjet.com/v3.1/send', [
      'timeout' => 30,
      'headers' => [
        'Authorization' => 'Basic ' . base64_encode( $api_key . ':' . $secret_key ),
        'Content-Type'  => 'application/json',
      ],
      'body'    => wp_json_encode( [ 'Messages' => [ $message ] ] ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }

  private function mj_recipients( $list ) {
    $out = [];
    foreach ( $this->recipients( $list ) as $r ) {
      $out[] = array_filter( [ 'Email' => $r['email'], 'Name' => $r['name'] ] );
    }
    return $out;
  }
}
