<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Rest {

  private $core = null;
  private $namespace = 'meow-mailer/v1';

  public function __construct( $core ) {
    $this->core = $core;
    add_action( 'rest_api_init', [ $this, 'rest_api_init' ] );
  }

  public function rest_api_init() {
    // Every route is admin-only. permission_callback is declared inline on each
    // route (rather than merged from a shared array) so static analysers can see it.
    $perm = [ $this->core, 'can_access_settings' ];

    register_rest_route( $this->namespace, '/settings/list',   [ 'methods' => 'GET',  'callback' => [ $this, 'settings_list' ],   'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/settings/update', [ 'methods' => 'POST', 'callback' => [ $this, 'settings_update' ], 'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/settings/reset',  [ 'methods' => 'POST', 'callback' => [ $this, 'settings_reset' ],  'permission_callback' => $perm ] );

    register_rest_route( $this->namespace, '/logs/list',   [ 'methods' => 'POST', 'callback' => [ $this, 'logs_list' ],   'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/get',     [ 'methods' => 'POST', 'callback' => [ $this, 'logs_get' ],     'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/delete',  [ 'methods' => 'POST', 'callback' => [ $this, 'logs_delete' ],  'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/clear',   [ 'methods' => 'POST', 'callback' => [ $this, 'logs_clear' ],   'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/resend',  [ 'methods' => 'POST', 'callback' => [ $this, 'logs_resend' ],  'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/export',  [ 'methods' => 'POST', 'callback' => [ $this, 'logs_export' ],  'permission_callback' => $perm ] );

    register_rest_route( $this->namespace, '/mail/test',         [ 'methods' => 'POST', 'callback' => [ $this, 'mail_test' ],        'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/oauth/auth-url',    [ 'methods' => 'POST', 'callback' => [ $this, 'oauth_auth_url' ],   'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/oauth/disconnect',  [ 'methods' => 'POST', 'callback' => [ $this, 'oauth_disconnect' ], 'permission_callback' => $perm ] );
  }

  #region Settings

  public function settings_list() {
    return new WP_REST_Response( [ 'success' => true, 'options' => $this->core->get_masked_options() ], 200 );
  }

  public function settings_update( $request ) {
    $params = $request->get_json_params();
    $merged = $this->core->merge_options( $params['options'] ?? [] );
    $this->core->update_options( $merged );
    return new WP_REST_Response( [ 'success' => true, 'options' => $this->core->get_masked_options() ], 200 );
  }

  public function settings_reset() {
    $this->core->reset_options();
    return new WP_REST_Response( [ 'success' => true, 'options' => $this->core->get_masked_options() ], 200 );
  }

  #endregion

  #region Logs

  public function logs_list( $request ) {
    try {
      $params  = $request->get_json_params();
      $page    = max( 1, intval( $params['page'] ?? 1 ) );
      $limit   = intval( $params['limit'] ?? 20 );
      $filters = is_array( $params['filters'] ?? null ) ? $params['filters'] : [];
      $sort    = $params['sort'] ?? null;
      $offset  = ( $page - 1 ) * $limit;

      $result = $this->core->logs->select( $offset, $limit, $filters, $sort );
      return new WP_REST_Response( [
        'success' => true,
        'total'   => $result['total'],
        'logs'    => $result['data'],
        'stats'   => $this->core->logs->count_by_status(),
      ], 200 );
    } catch ( Throwable $e ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => $e->getMessage() ], 200 );
    }
  }

  public function logs_get( $request ) {
    $id  = intval( $request->get_json_params()['id'] ?? 0 );
    $row = $this->core->logs->select_one( $id );
    if ( ! $row ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Log entry not found.', 'meow-mailer' ) ], 200 );
    }
    return new WP_REST_Response( [ 'success' => true, 'log' => $row ], 200 );
  }

  public function logs_delete( $request ) {
    $ids = $request->get_json_params()['ids'] ?? [];
    $this->core->logs->delete( $ids );
    return new WP_REST_Response( [ 'success' => true ], 200 );
  }

  public function logs_clear() {
    $this->core->logs->clear();
    return new WP_REST_Response( [ 'success' => true ], 200 );
  }

  public function logs_export( $request ) {
    $params  = $request->get_json_params();
    $filters = is_array( $params['filters'] ?? null ) ? $params['filters'] : [];

    // limit 0 = all matching rows; the list query already omits the heavy body column.
    $result  = $this->core->logs->select( 0, 0, $filters, $params['sort'] ?? null );

    $lines = [ $this->csv_row( [ 'Date', 'To', 'From', 'Subject', 'Provider', 'Status', 'Error' ] ) ];
    foreach ( $result['data'] as $r ) {
      $lines[] = $this->csv_row( [ $r['created'], $r['email_to'], $r['email_from'], $r['subject'], $r['provider'], $r['status'], $r['error'] ] );
    }

    return new WP_REST_Response( [ 'success' => true, 'csv' => implode( "\r\n", $lines ) ], 200 );
  }

  private function csv_row( $fields ) {
    return implode( ',', array_map( function ( $f ) {
      $f = (string) $f;
      // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR triggers).
      if ( $f !== '' && strpbrk( $f[0], "=+-@\t\r" ) !== false ) {
        $f = "'" . $f;
      }
      return '"' . str_replace( '"', '""', $f ) . '"';
    }, $fields ) );
  }

  public function logs_resend( $request ) {
    $id  = intval( $request->get_json_params()['id'] ?? 0 );
    $row = $this->core->logs->select_one( $id );
    if ( ! $row ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Log entry not found.', 'meow-mailer' ) ], 200 );
    }

    if ( $this->core->get_option( 'provider', 'none' ) === 'none' ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Provider is set to None. Choose a provider before resending.', 'meow-mailer' ) ], 200 );
    }

    $headers = json_decode( $row['headers'], true );
    $email   = $this->core->mailer->normalize( [
      'to'          => $row['email_to'],
      'subject'     => $row['subject'],
      'message'     => $row['body'],
      'headers'     => is_array( $headers ) ? $headers : '',
      'attachments' => [],
    ] );

    $result = $this->core->mailer->dispatch( $email );
    if ( is_wp_error( $result ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => $result->get_error_message() ], 200 );
    }
    return new WP_REST_Response( [ 'success' => true ], 200 );
  }

  #endregion

  #region Tools

  public function mail_test( $request ) {
    $params = $request->get_json_params();
    $to     = sanitize_email( $params['to'] ?? '' );
    $format = ( ( $params['format'] ?? 'html' ) === 'plain' ) ? 'plain' : 'html';

    if ( ! is_email( $to ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Please provide a valid email address.', 'meow-mailer' ) ], 200 );
    }

    if ( $this->core->get_option( 'provider', 'none' ) === 'none' ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Provider is set to None. Choose a provider (or Offline) to send a test.', 'meow-mailer' ) ], 200 );
    }

    if ( $format === 'plain' ) {
      $subject = __( 'Meow Mailer — Plain Text Test', 'meow-mailer' );
      $message = __( "This is a plain-text test email from Meow Mailer.\n\nIf you received it, your provider is configured correctly. 🐱", 'meow-mailer' );
      $headers = [ 'Content-Type: text/plain; charset=UTF-8' ];
    } else {
      $subject = __( 'Meow Mailer — HTML Test', 'meow-mailer' );
      $message = '<h2 style="margin:0 0 10px;font-family:sans-serif;">' . esc_html__( 'It works! 🐱', 'meow-mailer' ) . '</h2>'
        . '<p style="font-family:sans-serif;line-height:1.5;">' . esc_html__( 'This is an HTML test email from Meow Mailer. If you can read this with formatting, your provider is configured correctly.', 'meow-mailer' ) . '</p>';
      $headers = [ 'Content-Type: text/html; charset=UTF-8' ];
    }

    $email = $this->core->mailer->normalize( [
      'to'      => $to,
      'subject' => $subject,
      'message' => $message,
      'headers' => $headers,
    ] );

    $result = $this->core->mailer->dispatch( $email );
    if ( is_wp_error( $result ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => $result->get_error_message() ], 200 );
    }
    return new WP_REST_Response( [ 'success' => true, 'message' => __( 'Test email sent.', 'meow-mailer' ) ], 200 );
  }

  public function oauth_auth_url( $request ) {
    $provider = $request->get_json_params()['provider'] ?? '';
    $config   = Meow_MWMAIL_Core::oauth_config( $provider, '' );
    if ( ! $config ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Unknown OAuth provider.', 'meow-mailer' ) ], 200 );
    }

    $creds = $this->core->get_provider_options( $provider );
    if ( empty( $creds['client_id'] ) || empty( $creds['client_secret'] ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Enter your Client ID and Secret first, and Save.', 'meow-mailer' ) ], 200 );
    }
    // Rebuild the config with the saved tenant (Outlook).
    $config = Meow_MWMAIL_Core::oauth_config( $provider, $creds['tenant'] ?? 'common' );

    $args = array_merge( [
      'client_id'     => $creds['client_id'],
      'redirect_uri'  => Meow_MWMAIL_Admin::oauth_redirect_uri(),
      'response_type' => 'code',
      'scope'         => $config['scope'],
      'state'         => wp_create_nonce( 'mwmail_oauth' ) . '|' . $provider,
    ], $config['extra'] );

    return new WP_REST_Response( [ 'success' => true, 'url' => add_query_arg( array_map( 'rawurlencode', $args ), $config['auth'] ) ], 200 );
  }

  public function oauth_disconnect( $request ) {
    $provider = $request->get_json_params()['provider'] ?? '';
    if ( ! in_array( $provider, [ 'gmail', 'outlook' ], true ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Unknown OAuth provider.', 'meow-mailer' ) ], 200 );
    }
    $all = $this->core->get_all_options();
    foreach ( [ 'access_token', 'refresh_token', 'expires' ] as $field ) {
      $all['providers'][ $provider ][ $field ] = $field === 'expires' ? 0 : '';
    }
    $this->core->update_options( $all );
    return new WP_REST_Response( [ 'success' => true, 'options' => $this->core->get_masked_options() ], 200 );
  }

  #endregion
}
