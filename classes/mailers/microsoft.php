<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Microsoft 365 through an Entra app registration with application permissions
 * (OAuth 2.0 client credentials). Nobody signs in: the app authenticates as itself,
 * with a certificate or a client secret, and sends as the mailbox set in the settings
 * through Microsoft Graph (users/{mailbox}/sendMail).
 *
 * The message itself is built exactly like the delegated Outlook mailer's, which is
 * why this extends it: only the token and the endpoint differ.
 */
class Meow_MWMAIL_Mailers_Microsoft extends Meow_MWMAIL_Mailers_Outlook {

  const SCOPE = 'https://graph.microsoft.com/.default';

  public function send( $email ) {
    $mailbox = trim( (string) $this->opt( 'mailbox' ) );
    if ( ! is_email( $mailbox ) ) {
      return new WP_Error( 'mwmail_microsoft_mailbox', __( 'Enter the mailbox Microsoft 365 should send from.', 'meow-mailer' ) );
    }

    $token = $this->app_token();
    if ( is_wp_error( $token ) ) {
      return $token;
    }

    $url    = 'https://graph.microsoft.com/v1.0/users/' . str_replace( '%40', '@', rawurlencode( $mailbox ) ) . '/sendMail';
    $result = $this->graph_send( $url, $token, $email );
    if ( ! is_wp_error( $result ) ) {
      return true;
    }

    // Graph's own wording ("Access is denied", "The requested user is invalid") says
    // what failed but not where to look, and the answer is always in Entra or Exchange.
    $code = $result->get_error_code();
    $hint = '';
    if ( in_array( $code, [ 'mwmail_http_401', 'mwmail_http_403' ], true ) ) {
      $hint = __( 'Check that the app has the Mail.Send application permission (not delegated), that admin consent was granted, and that no Application Access Policy excludes this mailbox.', 'meow-mailer' );
    }
    elseif ( $code === 'mwmail_http_404' ) {
      $hint = __( 'Check that this mailbox exists in the tenant. A shared mailbox works too.', 'meow-mailer' );
    }
    return $hint === '' ? $result : new WP_Error( $code, rtrim( $result->get_error_message(), '. ' ) . '. ' . $hint );
  }

  /**
   * @return string|WP_Error
   */
  private function app_token() {
    $tenant    = trim( (string) $this->opt( 'tenant' ) );
    $client_id = trim( (string) $this->opt( 'client_id' ) );
    if ( $tenant === '' || $client_id === '' ) {
      return new WP_Error( 'mwmail_microsoft_config', __( 'Enter the Tenant ID and Client ID of your app registration.', 'meow-mailer' ) );
    }
    // These aliases only mean something when a person signs in and Microsoft works out
    // their tenant. An app authenticating as itself has to name the tenant it lives in.
    if ( in_array( strtolower( $tenant ), [ 'common', 'organizations', 'consumers' ], true ) ) {
      return new WP_Error( 'mwmail_microsoft_config', __( 'The Tenant ID has to be your own tenant (its Directory ID or domain), not "common".', 'meow-mailer' ) );
    }

    $use_certificate = $this->opt( 'auth', 'certificate' ) !== 'secret';
    $credential      = trim( (string) $this->opt( $use_certificate ? 'certificate' : 'client_secret' ) );
    if ( $credential === '' ) {
      return new WP_Error( 'mwmail_microsoft_config', $use_certificate
        ? __( 'Paste the certificate and its private key.', 'meow-mailer' )
        : __( 'Enter the client secret.', 'meow-mailer' ) );
    }

    // A cached token is only reused by the credentials that fetched it. Otherwise a
    // secret corrected in the settings would go on "working" for up to an hour on the
    // old token, and so would a wrong one, which makes Send Test lie.
    $fingerprint = wp_hash( $tenant . '|' . $client_id . '|' . $credential );
    $cached      = $this->opt( 'access_token' );
    if ( $cached && $this->opt( 'token_for' ) === $fingerprint && intval( $this->opt( 'expires', 0 ) ) > time() + 60 ) {
      return $cached;
    }

    $token_url = 'https://login.microsoftonline.com/' . rawurlencode( $tenant ) . '/oauth2/v2.0/token';
    $body      = [
      'client_id'  => $client_id,
      'scope'      => self::SCOPE,
      'grant_type' => 'client_credentials',
    ];
    if ( $use_certificate ) {
      $assertion = $this->client_assertion( $credential, $client_id, $token_url );
      if ( is_wp_error( $assertion ) ) {
        return $assertion;
      }
      $body['client_assertion_type'] = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
      $body['client_assertion']      = $assertion;
    }
    else {
      $body['client_secret'] = $credential;
    }

    $result = $this->http_post( $token_url, [ 'timeout' => 30, 'body' => $body ] );
    if ( is_wp_error( $result ) ) {
      return $result;
    }
    if ( empty( $result['access_token'] ) ) {
      return new WP_Error( 'mwmail_microsoft_token', __( 'Microsoft did not return an access token.', 'meow-mailer' ) );
    }

    $all = $this->core->get_all_options();
    $all['providers']['microsoft']['access_token'] = $result['access_token'];
    $all['providers']['microsoft']['expires']      = time() + intval( $result['expires_in'] ?? 3600 );
    $all['providers']['microsoft']['token_for']    = $fingerprint;
    $this->core->update_options( $all );

    return $result['access_token'];
  }

  /**
   * The signed JWT that proves the app holds the certificate's private key, as Entra
   * expects it: RS256, the certificate's SHA-1 thumbprint in x5t, a short lifetime.
   *
   * @return string|WP_Error
   */
  private function client_assertion( $pem, $client_id, $audience ) {
    if ( ! function_exists( 'openssl_sign' ) ) {
      return new WP_Error( 'mwmail_microsoft_certificate', __( 'Signing in with a certificate needs the OpenSSL PHP extension. Use a client secret instead, or ask your host to enable it.', 'meow-mailer' ) );
    }
    // wp-config.php can point at a file outside the web root instead of holding the PEM.
    if ( strpos( $pem, '-----BEGIN' ) === false && is_file( $pem ) && is_readable( $pem ) ) {
      $pem = (string) file_get_contents( $pem );
    }

    if ( ! preg_match( '/-----BEGIN CERTIFICATE-----.+?-----END CERTIFICATE-----/s', $pem, $cert_block ) ) {
      return new WP_Error( 'mwmail_microsoft_certificate', __( 'The certificate is missing. Paste the certificate and its private key together, both in PEM format.', 'meow-mailer' ) );
    }
    if ( strpos( $pem, 'ENCRYPTED' ) !== false ) {
      return new WP_Error( 'mwmail_microsoft_certificate', __( 'The private key is protected by a password. Export it without one (for example with the -nodes option of openssl).', 'meow-mailer' ) );
    }
    if ( ! preg_match( '/-----BEGIN (?:RSA )?PRIVATE KEY-----.+?-----END (?:RSA )?PRIVATE KEY-----/s', $pem, $key_block ) ) {
      return new WP_Error( 'mwmail_microsoft_certificate', __( 'The private key is missing. Paste the certificate and its private key together, both in PEM format.', 'meow-mailer' ) );
    }

    $cert = openssl_x509_read( $cert_block[0] );
    $key  = openssl_pkey_get_private( $key_block[0] );
    if ( ! $cert || ! $key ) {
      return new WP_Error( 'mwmail_microsoft_certificate', __( 'The certificate or its private key could not be read.', 'meow-mailer' ) );
    }
    if ( ! openssl_x509_check_private_key( $cert, $key ) ) {
      return new WP_Error( 'mwmail_microsoft_certificate', __( 'The private key does not belong to this certificate.', 'meow-mailer' ) );
    }

    $der    = base64_decode( preg_replace( '/-----[^-]+-----|\s+/', '', $cert_block[0] ) );
    $now    = time();
    $header = [ 'alg' => 'RS256', 'typ' => 'JWT', 'x5t' => self::base64url( sha1( $der, true ) ) ];
    $claims = [
      'aud' => $audience,
      'iss' => $client_id,
      'sub' => $client_id,
      'jti' => wp_generate_uuid4(),
      // A minute of slack, so a server clock running slightly ahead of Microsoft's
      // does not produce a token that is "not valid yet".
      'nbf' => $now - 60,
      'iat' => $now - 60,
      'exp' => $now + 600,
    ];

    $input = self::base64url( wp_json_encode( $header ) ) . '.' . self::base64url( wp_json_encode( $claims ) );
    if ( ! openssl_sign( $input, $signature, $key, OPENSSL_ALGO_SHA256 ) ) {
      return new WP_Error( 'mwmail_microsoft_certificate', __( 'Signing with the private key failed.', 'meow-mailer' ) );
    }
    return $input . '.' . self::base64url( $signature );
  }

  private static function base64url( $data ) {
    return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
  }
}
