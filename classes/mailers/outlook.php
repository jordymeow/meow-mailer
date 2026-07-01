<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Microsoft 365 / Outlook via OAuth 2.0 and the Microsoft Graph API
 * (users/me/sendMail). Tokens are refreshed on demand. Email is sent as the
 * authenticated mailbox (Graph uses the signed-in account's identity).
 */
class Meow_MWMAIL_Mailers_Outlook extends Meow_MWMAIL_Mailers_Base {

  const SEND_URL = 'https://graph.microsoft.com/v1.0/me/sendMail';

  public function send( $email ) {
    $token = $this->get_access_token();
    if ( is_wp_error( $token ) ) {
      return $token;
    }

    $message = [
      'subject'      => $email['subject'],
      'body'         => [
        'contentType' => $this->is_html( $email ) ? 'HTML' : 'Text',
        'content'     => $email['message'],
      ],
      'toRecipients' => $this->graph_recipients( $email['to'] ),
    ];
    if ( $email['cc'] ) {
      $message['ccRecipients'] = $this->graph_recipients( $email['cc'] );
    }
    if ( $email['bcc'] ) {
      $message['bccRecipients'] = $this->graph_recipients( $email['bcc'] );
    }
    if ( $email['reply_to'] ) {
      $message['replyTo'] = $this->graph_recipients( $email['reply_to'] );
    }
    $files = $this->attachments_base64( $email );
    if ( $files ) {
      $message['attachments'] = array_map( function ( $f ) {
        return [
          '@odata.type'  => '#microsoft.graph.fileAttachment',
          'name'         => $f['filename'],
          'contentType'  => $f['type'],
          'contentBytes' => $f['content'],
        ];
      }, $files );
    }

    $result = $this->http_post( self::SEND_URL, [
      'timeout' => 30,
      'headers' => [
        'Authorization' => 'Bearer ' . $token,
        'Content-Type'  => 'application/json',
      ],
      'body'    => wp_json_encode( [ 'message' => $message, 'saveToSentItems' => true ] ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }

  private function graph_recipients( $list ) {
    return array_map( function ( $r ) {
      return [ 'emailAddress' => array_filter( [ 'address' => $r['email'], 'name' => $r['name'] ] ) ];
    }, $this->recipients( $list ) );
  }

  /**
   * @return string|WP_Error
   */
  private function get_access_token() {
    $refresh_token = $this->opt( 'refresh_token' );
    if ( empty( $refresh_token ) ) {
      return new WP_Error( 'mwmail_outlook_auth', __( 'Outlook is not connected. Please authorize it in the settings.', 'meow-mailer' ) );
    }

    $access_token = $this->opt( 'access_token' );
    $expires      = intval( $this->opt( 'expires', 0 ) );
    if ( $access_token && $expires > ( time() + 60 ) ) {
      return $access_token;
    }

    $config = Meow_MWMAIL_Core::oauth_config( 'outlook', $this->opt( 'tenant', 'common' ) );
    $result = $this->http_post( $config['token'], [
      'timeout' => 30,
      'body'    => [
        'client_id'     => $this->opt( 'client_id' ),
        'client_secret' => $this->opt( 'client_secret' ),
        'refresh_token' => $refresh_token,
        'grant_type'    => 'refresh_token',
        'scope'         => $config['scope'],
      ],
    ] );
    if ( is_wp_error( $result ) ) {
      return $result;
    }
    if ( empty( $result['access_token'] ) ) {
      return new WP_Error( 'mwmail_outlook_token', __( 'Could not refresh the Outlook access token.', 'meow-mailer' ) );
    }

    $this->store_tokens( $result['access_token'], intval( $result['expires_in'] ?? 3600 ), $result['refresh_token'] ?? null );
    return $result['access_token'];
  }

  private function store_tokens( $access_token, $expires_in, $refresh_token = null ) {
    $all = $this->core->get_all_options();
    $all['providers']['outlook']['access_token'] = $access_token;
    $all['providers']['outlook']['expires']      = time() + $expires_in;
    if ( $refresh_token ) {
      $all['providers']['outlook']['refresh_token'] = $refresh_token;
    }
    $this->core->update_options( $all );
  }
}
