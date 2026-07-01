<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Smtp2go extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $api_key = $this->opt( 'api_key' );
    if ( empty( $api_key ) ) {
      return new WP_Error( 'mwmail_smtp2go_config', __( 'SMTP2GO API key is required.', 'meow-mailer' ) );
    }

    $payload = [
      'sender'  => $email['from_name'] ? sprintf( '%s <%s>', $email['from_name'], $email['from_email'] ) : $email['from_email'],
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
      $payload['custom_headers'] = [ [ 'header' => 'Reply-To', 'value' => implode( ',', $email['reply_to'] ) ] ];
    }
    if ( $this->is_html( $email ) ) {
      $payload['html_body'] = $email['message'];
    } else {
      $payload['text_body'] = $email['message'];
    }
    $files = $this->attachments_base64( $email );
    if ( $files ) {
      $payload['attachments'] = array_map( function ( $f ) {
        return [ 'filename' => $f['filename'], 'fileblob' => $f['content'], 'mimetype' => $f['type'] ];
      }, $files );
    }

    $result = $this->http_post( 'https://api.smtp2go.com/v3/email/send', [
      'timeout' => 30,
      'headers' => [
        'X-Smtp2go-Api-Key' => $api_key,
        'Content-Type'      => 'application/json',
        'Accept'            => 'application/json',
      ],
      'body'    => wp_json_encode( $payload ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }
}
