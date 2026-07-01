<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Postmark extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $token = $this->opt( 'server_token' );
    if ( empty( $token ) ) {
      return new WP_Error( 'mwmail_postmark_config', __( 'Postmark server token is required.', 'meow-mailer' ) );
    }

    $payload = [
      'From'          => $email['from_name'] ? sprintf( '%s <%s>', $email['from_name'], $email['from_email'] ) : $email['from_email'],
      'To'            => implode( ',', $email['to'] ),
      'Subject'       => $email['subject'],
      'MessageStream' => $this->opt( 'message_stream', 'outbound' ) ?: 'outbound',
    ];
    if ( $email['cc'] ) {
      $payload['Cc'] = implode( ',', $email['cc'] );
    }
    if ( $email['bcc'] ) {
      $payload['Bcc'] = implode( ',', $email['bcc'] );
    }
    if ( $email['reply_to'] ) {
      $payload['ReplyTo'] = implode( ',', $email['reply_to'] );
    }
    if ( $this->is_html( $email ) ) {
      $payload['HtmlBody'] = $email['message'];
    } else {
      $payload['TextBody'] = $email['message'];
    }
    $files = $this->attachments_base64( $email );
    if ( $files ) {
      $payload['Attachments'] = array_map( function ( $f ) {
        return [ 'Name' => $f['filename'], 'Content' => $f['content'], 'ContentType' => $f['type'] ];
      }, $files );
    }

    $result = $this->http_post( 'https://api.postmarkapp.com/email', [
      'timeout' => 30,
      'headers' => [
        'X-Postmark-Server-Token' => $token,
        'Content-Type'            => 'application/json',
        'Accept'                  => 'application/json',
      ],
      'body'    => wp_json_encode( $payload ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }
}
