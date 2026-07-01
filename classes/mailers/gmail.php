<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Gmail / Google Workspace via OAuth 2.0 and the Gmail API. The MIME is built by
 * PHPMailer (so attachments, CC/BCC and Reply-To work) and submitted to
 * users.messages.send. Tokens are refreshed on demand.
 */
class Meow_MWMAIL_Mailers_Gmail extends Meow_MWMAIL_Mailers_Base {

  const TOKEN_URL = 'https://oauth2.googleapis.com/token';
  const SEND_URL  = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

  public function send( $email ) {
    $token = $this->get_access_token();
    if ( is_wp_error( $token ) ) {
      return $token;
    }

    try {
      $mail = $this->build_phpmailer( $email );
      $mail->preSend();
      $mime = $mail->getSentMIMEMessage();
    } catch ( \PHPMailer\PHPMailer\Exception $e ) {
      return new WP_Error( 'mwmail_gmail_mime', $e->getMessage() );
    }

    $raw = rtrim( strtr( base64_encode( $mime ), '+/', '-_' ), '=' );

    $result = $this->http_post( self::SEND_URL, [
      'timeout' => 30,
      'headers' => [
        'Authorization' => 'Bearer ' . $token,
        'Content-Type'  => 'application/json',
      ],
      'body'    => wp_json_encode( [ 'raw' => $raw ] ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }

  /**
   * Return a valid access token, refreshing it when expired.
   *
   * @return string|WP_Error
   */
  private function get_access_token() {
    $refresh_token = $this->opt( 'refresh_token' );
    if ( empty( $refresh_token ) ) {
      return new WP_Error( 'mwmail_gmail_auth', __( 'Gmail is not connected. Please authorize it in the settings.', 'meow-mailer' ) );
    }

    $access_token = $this->opt( 'access_token' );
    $expires      = intval( $this->opt( 'expires', 0 ) );
    if ( $access_token && $expires > ( time() + 60 ) ) {
      return $access_token;
    }

    $result = $this->http_post( self::TOKEN_URL, [
      'timeout' => 30,
      'body'    => [
        'client_id'     => $this->opt( 'client_id' ),
        'client_secret' => $this->opt( 'client_secret' ),
        'refresh_token' => $refresh_token,
        'grant_type'    => 'refresh_token',
      ],
    ] );
    if ( is_wp_error( $result ) ) {
      return $result;
    }
    if ( empty( $result['access_token'] ) ) {
      return new WP_Error( 'mwmail_gmail_token', __( 'Could not refresh the Gmail access token.', 'meow-mailer' ) );
    }

    $this->store_tokens( $result['access_token'], intval( $result['expires_in'] ?? 3600 ) );
    return $result['access_token'];
  }

  private function store_tokens( $access_token, $expires_in ) {
    $all = $this->core->get_all_options();
    $all['providers']['gmail']['access_token'] = $access_token;
    $all['providers']['gmail']['expires']      = time() + $expires_in;
    $this->core->update_options( $all );
  }
}
