<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Amazon SES v2 (SendEmail with raw MIME). The MIME is assembled by PHPMailer so
 * CC/BCC/Reply-To and attachments work; the request is signed with AWS SigV4.
 */
class Meow_MWMAIL_Mailers_Ses extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $access_key = $this->opt( 'access_key' );
    $secret_key = $this->opt( 'secret_key' );
    $region     = $this->opt( 'region', 'us-east-1' ) ?: 'us-east-1';
    if ( empty( $access_key ) || empty( $secret_key ) ) {
      return new WP_Error( 'mwmail_ses_config', __( 'Amazon SES access key and secret key are required.', 'meow-mailer' ) );
    }

    try {
      $mail = $this->build_phpmailer( $email );
      $mail->preSend();
      $mime = $mail->getSentMIMEMessage();
    } catch ( \PHPMailer\PHPMailer\Exception $e ) {
      return new WP_Error( 'mwmail_ses_mime', $e->getMessage() );
    }

    $host    = 'email.' . $region . '.amazonaws.com';
    $url     = 'https://' . $host . '/v2/email/outbound-emails';
    $payload = wp_json_encode( [ 'Content' => [ 'Raw' => [ 'Data' => base64_encode( $mime ) ] ] ] );

    $headers = $this->sign_request( 'POST', $host, '/v2/email/outbound-emails', $payload, $access_key, $secret_key, $region );
    $headers['Content-Type'] = 'application/json';

    $result = $this->http_post( $url, [
      'timeout' => 30,
      'headers' => $headers,
      'body'    => $payload,
    ] );

    return is_wp_error( $result ) ? $result : true;
  }

  /**
   * AWS Signature Version 4 for the SES "ses" service.
   */
  private function sign_request( $method, $host, $uri, $payload, $access_key, $secret_key, $region ) {
    $service   = 'ses';
    $amz_date  = gmdate( 'Ymd\THis\Z' );
    $date      = gmdate( 'Ymd' );
    $hash      = hash( 'sha256', $payload );

    $canonical_headers = "host:{$host}\nx-amz-content-sha256:{$hash}\nx-amz-date:{$amz_date}\n";
    $signed_headers    = 'host;x-amz-content-sha256;x-amz-date';

    $canonical_request = implode( "\n", [
      $method,
      $uri,
      '', // query string
      $canonical_headers,
      $signed_headers,
      $hash,
    ] );

    $scope         = "{$date}/{$region}/{$service}/aws4_request";
    $string_to_sign = implode( "\n", [
      'AWS4-HMAC-SHA256',
      $amz_date,
      $scope,
      hash( 'sha256', $canonical_request ),
    ] );

    $k_date    = hash_hmac( 'sha256', $date, 'AWS4' . $secret_key, true );
    $k_region  = hash_hmac( 'sha256', $region, $k_date, true );
    $k_service = hash_hmac( 'sha256', $service, $k_region, true );
    $k_signing = hash_hmac( 'sha256', 'aws4_request', $k_service, true );
    $signature = hash_hmac( 'sha256', $string_to_sign, $k_signing );

    $authorization = "AWS4-HMAC-SHA256 Credential={$access_key}/{$scope}, "
      . "SignedHeaders={$signed_headers}, Signature={$signature}";

    return [
      'Authorization'        => $authorization,
      'x-amz-date'           => $amz_date,
      'x-amz-content-sha256' => $hash,
    ];
  }
}
