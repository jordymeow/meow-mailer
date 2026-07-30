<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Zoho Mail via OAuth 2.0 and the Zoho Mail API. Sends from the connected mailbox
 * rather than through SMTP, so no password is stored and access can be revoked for
 * one site without changing the mailbox password.
 *
 * Two things make this provider different from the others:
 *  - Every URL is built on the account's own data center. Zoho keeps regions apart
 *    and a US host will not answer for an EU account, so the domain is a setting.
 *  - Attachments cannot ride along in the send payload. Each file is uploaded
 *    first and the send then refers to what the upload returned.
 */
class Meow_MWMAIL_Mailers_Zoho extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $token = $this->get_access_token();
    if ( is_wp_error( $token ) ) {
      return $token;
    }
    $account_id = $this->get_account_id( $token );
    if ( is_wp_error( $account_id ) ) {
      return $account_id;
    }

    $payload = [
      'fromAddress' => $email['from_name']
        ? sprintf( '%s <%s>', $email['from_name'], $email['from_email'] )
        : $email['from_email'],
      'toAddress'   => implode( ',', $email['to'] ),
      'subject'     => (string) $email['subject'],
      'content'     => (string) $email['message'],
      'mailFormat'  => $this->is_html( $email ) ? 'html' : 'plaintext',
    ];
    if ( $email['cc'] ) {
      $payload['ccAddress'] = implode( ',', $email['cc'] );
    }
    if ( $email['bcc'] ) {
      $payload['bccAddress'] = implode( ',', $email['bcc'] );
    }
    if ( $email['reply_to'] ) {
      // The API takes a single address here, so extra Reply-To values are dropped.
      list( $reply_to ) = $this->split_address( $email['reply_to'][0] );
      // Zoho refuses a Reply-To that is not one of the account's own verified
      // addresses, and rejects the entire message rather than ignoring the header.
      // Contact forms routinely put the visitor's address there, so sending it
      // through unchecked means the enquiry never arrives at all. Delivering
      // without the header beats not delivering.
      if ( $this->is_verified_address( $reply_to, $token, $email['from_email'] ) ) {
        $payload['replyTo'] = $reply_to;
      }
      else {
        $this->core->log( sprintf( 'Zoho: Reply-To %s is not a verified address on the account, sent without it.', $reply_to ) );
      }
    }

    $attachments = $this->upload_attachments( $email, $token, $account_id );
    if ( is_wp_error( $attachments ) ) {
      return $attachments;
    }
    if ( $attachments ) {
      $payload['attachments'] = $attachments;
    }

    $result = $this->api_request( $this->api_url( $account_id . '/messages' ), [
      'timeout' => 30,
      'headers' => [
        'Authorization' => 'Zoho-oauthtoken ' . $token,
        'Content-Type'  => 'application/json',
      ],
      'body'    => wp_json_encode( $payload ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }

  #region Attachments

  /**
   * Upload every file and return what the send payload needs to reference them.
   * Inline images are uploaded with isInline so cid: references in the HTML resolve.
   *
   * @return array|WP_Error
   */
  private function upload_attachments( $email, $token, $account_id ) {
    $uploaded = [];
    foreach ( (array) $email['attachments'] as $name => $path ) {
      $file = $this->upload_one( $path, is_string( $name ) ? $name : basename( $path ), false, $token, $account_id );
      if ( is_wp_error( $file ) ) {
        return $file;
      }
      if ( $file ) {
        $uploaded[] = $file;
      }
    }
    foreach ( ( $email['embeds'] ?? [] ) as $cid => $path ) {
      $file = $this->upload_one( $path, basename( $path ), true, $token, $account_id );
      if ( is_wp_error( $file ) ) {
        return $file;
      }
      if ( $file ) {
        $uploaded[] = $file;
      }
    }
    return $uploaded;
  }

  /**
   * @return array|null|WP_Error  null when the file is simply not readable, which
   *                              matches how the other providers skip bad paths.
   */
  private function upload_one( $path, $filename, $inline, $token, $account_id ) {
    if ( ! file_exists( $path ) || ! is_readable( $path ) ) {
      $this->core->log( 'Attachment skipped, not readable: ' . $path );
      return null;
    }
    $data = file_get_contents( $path );
    if ( $data === false ) {
      return null;
    }

    $url = add_query_arg(
      array_filter( [ 'fileName' => rawurlencode( $filename ), 'isInline' => $inline ? 'true' : '' ] ),
      $this->api_url( $account_id . '/messages/attachments' )
    );

    $result = $this->api_request( $url, [
      'timeout' => 60,
      'headers' => [
        'Authorization' => 'Zoho-oauthtoken ' . $token,
        'Content-Type'  => 'application/octet-stream',
      ],
      'body'    => $data,
    ] );
    if ( is_wp_error( $result ) ) {
      return $result;
    }

    // All three values are required by the send call; without them the message
    // would go out silently missing its attachment.
    $file = $result['data'] ?? [];
    if ( empty( $file['storeName'] ) || empty( $file['attachmentPath'] ) || empty( $file['attachmentName'] ) ) {
      /* translators: %s: the file name that could not be uploaded. */
      return new WP_Error( 'mwmail_zoho_attachment', sprintf( __( 'Zoho did not accept the attachment "%s".', 'meow-mailer' ), $filename ) );
    }
    return [
      'storeName'      => $file['storeName'],
      'attachmentPath' => $file['attachmentPath'],
      'attachmentName' => $file['attachmentName'],
    ];
  }

  #endregion

  #region Auth

  /** @return string|WP_Error */
  private function get_access_token() {
    $refresh_token = $this->opt( 'refresh_token' );
    if ( empty( $refresh_token ) ) {
      return new WP_Error( 'mwmail_zoho_auth', __( 'Zoho Mail is not connected. Please authorize it in the settings.', 'meow-mailer' ) );
    }

    $access_token = $this->opt( 'access_token' );
    $expires      = intval( $this->opt( 'expires', 0 ) );
    if ( $access_token && $expires > ( time() + 60 ) ) {
      return $access_token;
    }

    $config = Meow_MWMAIL_Core::oauth_config( 'zoho', $this->datacenter() );
    $result = $this->api_request( $config['token'], [
      'timeout' => 30,
      // Zoho documents these as query parameters, but they are accepted in the body
      // too, and a refresh token has no business being written to an access log.
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
      // Zoho answers 200 with {"error": "..."} when a refresh fails, so the reason
      // has to be pulled out of the body rather than the status code.
      $reason = ! empty( $result['error'] ) && is_string( $result['error'] ) ? $result['error'] : __( 'no access token returned', 'meow-mailer' );
      /* translators: %s: the reason reported by Zoho. */
      return new WP_Error( 'mwmail_zoho_token', sprintf( __( 'Could not refresh the Zoho Mail access token (%s). Try disconnecting and connecting again.', 'meow-mailer' ), $reason ) );
    }

    $this->store( [
      'access_token' => $result['access_token'],
      'expires'      => time() + intval( $result['expires_in'] ?? 3600 ),
    ] );
    return $result['access_token'];
  }

  /**
   * The mailbox id every send URL is built on. Looked up once and kept, since it
   * never changes for a connection.
   *
   * @return string|WP_Error
   */
  private function get_account_id( $token ) {
    $account_id = $this->opt( 'account_id' );
    if ( ! empty( $account_id ) ) {
      return $account_id;
    }
    $account = $this->sync_account( $token );
    return is_wp_error( $account ) ? $account : $account['account_id'];
  }

  /**
   * Read the connected mailbox and remember what matters about it: the account id
   * the send URLs need, and the addresses Zoho is willing to send as. Called once
   * when connecting, so the settings can offer the right addresses straight away,
   * and lazily on send for connections made before this existed.
   *
   * @return array|WP_Error  account_id, addresses, primary_address
   */
  public function sync_account( $token = null ) {
    if ( $token === null ) {
      $token = $this->get_access_token();
    }
    if ( is_wp_error( $token ) ) {
      return $token;
    }

    $result = $this->read_response( wp_remote_get( $this->api_url( '' ), [
      'timeout' => 30,
      'headers' => [ 'Authorization' => 'Zoho-oauthtoken ' . $token ],
    ] ) );
    if ( is_wp_error( $result ) ) {
      return $result;
    }

    $account    = $result['data'][0] ?? [];
    $account_id = (string) ( $account['accountId'] ?? '' );
    if ( $account_id === '' ) {
      return new WP_Error( 'mwmail_zoho_account', __( 'Could not read the Zoho Mail account. Make sure the connected account has a mailbox.', 'meow-mailer' ) );
    }

    // sendMailDetails is one entry per address the account can send as, aliases
    // included. Only the validated ones are usable, and Zoho checks Reply-To
    // against this same set.
    $addresses = [];
    foreach ( (array) ( $account['sendMailDetails'] ?? [] ) as $detail ) {
      $address = strtolower( trim( (string) ( $detail['fromAddress'] ?? '' ) ) );
      if ( $address !== '' && ! empty( $detail['validated'] ) ) {
        $addresses[] = $address;
      }
    }
    $addresses = array_values( array_unique( $addresses ) );
    $primary   = strtolower( trim( (string) ( $account['primaryEmailAddress'] ?? '' ) ) );
    if ( $primary === '' && $addresses ) {
      $primary = $addresses[0];
    }

    $this->store( [
      'account_id'      => $account_id,
      'addresses'       => $addresses,
      'primary_address' => $primary,
    ] );

    return [ 'account_id' => $account_id, 'addresses' => $addresses, 'primary_address' => $primary ];
  }

  /**
   * Whether Zoho will accept this address in Reply-To. The cached list is filled
   * when connecting; if it is somehow missing we try once to fetch it, and if that
   * fails too we only allow the address the message is already being sent from,
   * which Zoho accepts by definition.
   */
  private function is_verified_address( $address, $token, $from_email ) {
    $address = strtolower( trim( $address ) );
    if ( $address === '' ) {
      return false;
    }

    $addresses = $this->opt( 'addresses', [] );
    if ( ! is_array( $addresses ) || empty( $addresses ) ) {
      $account   = $this->sync_account( $token );
      $addresses = is_wp_error( $account ) ? [] : $account['addresses'];
    }

    if ( empty( $addresses ) ) {
      return $address === strtolower( trim( (string) $from_email ) );
    }
    return in_array( $address, $addresses, true );
  }

  private function store( $values ) {
    $all = $this->core->get_all_options();
    foreach ( $values as $key => $value ) {
      $all['providers']['zoho'][ $key ] = $value;
    }
    $this->core->update_options( $all );
  }

  #endregion

  #region HTTP

  private function datacenter() {
    return Meow_MWMAIL_Core::zoho_datacenter( $this->opt( 'datacenter' ) );
  }

  private function api_url( $path ) {
    return 'https://mail.' . $this->datacenter() . '/api/accounts' . ( $path === '' ? '' : '/' . $path );
  }

  /** @return array|WP_Error */
  private function api_request( $url, $args ) {
    return $this->read_response( wp_remote_post( $url, $args ) );
  }

  /**
   * Zoho answers 200 with its own status block rather than using HTTP codes for
   * everything, and puts the useful part of a failure in data.moreInfo. Surfacing
   * that verbatim is what makes a failure diagnosable from the email log alone.
   *
   * @return array|WP_Error
   */
  private function read_response( $response ) {
    if ( is_wp_error( $response ) ) {
      return $response;
    }
    $code = wp_remote_retrieve_response_code( $response );
    $body = wp_remote_retrieve_body( $response );
    $json = json_decode( $body, true );

    if ( $code < 200 || $code >= 300 ) {
      return new WP_Error( 'mwmail_zoho_http_' . $code, $this->error_message( $code, $json, $body ) );
    }
    return is_array( $json ) ? $json : [];
  }

  private function error_message( $code, $json, $body ) {
    $parts = [];
    if ( ! empty( $json['data']['moreInfo'] ) && is_string( $json['data']['moreInfo'] ) ) {
      $parts[] = $json['data']['moreInfo'];
    }
    if ( ! empty( $json['status']['description'] ) && is_string( $json['status']['description'] ) ) {
      $parts[] = $json['status']['description'];
    }
    // OAuth failures answer with a bare {"error": "..."} instead.
    if ( ! empty( $json['error'] ) && is_string( $json['error'] ) ) {
      $parts[] = $json['error'];
    }
    if ( empty( $parts ) ) {
      $parts[] = substr( (string) $body, 0, 300 );
    }
    return sprintf( 'HTTP %d — %s', $code, implode( ' / ', $parts ) );
  }

  #endregion
}
