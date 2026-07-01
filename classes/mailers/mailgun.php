<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Mailgun extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $api_key = $this->opt( 'api_key' );
    $domain  = $this->opt( 'domain' );
    if ( empty( $api_key ) || empty( $domain ) ) {
      return new WP_Error( 'mwmail_mailgun_config', __( 'Mailgun API key and domain are required.', 'meow-mailer' ) );
    }

    $base = $this->opt( 'region' ) === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
    $url  = $base . '/v3/' . rawurlencode( $domain ) . '/messages';

    $fields   = [];
    $fields[] = [ 'from', $this->from( $email ) ];
    foreach ( $email['to'] as $addr ) {
      $fields[] = [ 'to', $addr ];
    }
    foreach ( $email['cc'] as $addr ) {
      $fields[] = [ 'cc', $addr ];
    }
    foreach ( $email['bcc'] as $addr ) {
      $fields[] = [ 'bcc', $addr ];
    }
    foreach ( $email['reply_to'] as $addr ) {
      $fields[] = [ 'h:Reply-To', $addr ];
    }
    $fields[] = [ 'subject', $email['subject'] ];
    $fields[] = [ $this->is_html( $email ) ? 'html' : 'text', $email['message'] ];

    $multipart = $this->build_multipart( $fields, $email['attachments'] );

    $result = $this->http_post( $url, [
      'timeout' => 30,
      'headers' => [
        'Authorization' => 'Basic ' . base64_encode( 'api:' . $api_key ),
        'Content-Type'  => $multipart['content_type'],
      ],
      'body'    => $multipart['body'],
    ] );

    return is_wp_error( $result ) ? $result : true;
  }

  private function from( $email ) {
    return $email['from_name'] ? sprintf( '%s <%s>', $email['from_name'], $email['from_email'] ) : $email['from_email'];
  }
}
