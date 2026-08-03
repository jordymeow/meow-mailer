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
    // The provider group is always shared once network mode is on, so anything
    // that rewrites credentials is a network-admin action there.
    $edit = function () { return $this->core->can_edit_group( 'provider' ); };

    register_rest_route( $this->namespace, '/settings/list',   [ 'methods' => 'GET',  'callback' => [ $this, 'settings_list' ],   'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/settings/update', [ 'methods' => 'POST', 'callback' => [ $this, 'settings_update' ], 'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/settings/reset',  [ 'methods' => 'POST', 'callback' => [ $this, 'settings_reset' ],  'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/settings/network', [ 'methods' => 'POST', 'callback' => [ $this, 'settings_network' ], 'permission_callback' => $perm ] );
    // Both carry credentials in the clear, so they take the stricter check: on a
    // network with a shared provider, only where that provider can be edited.
    register_rest_route( $this->namespace, '/settings/export', [ 'methods' => 'POST', 'callback' => [ $this, 'settings_export' ], 'permission_callback' => $edit ] );
    register_rest_route( $this->namespace, '/settings/import', [ 'methods' => 'POST', 'callback' => [ $this, 'settings_import' ], 'permission_callback' => $edit ] );

    register_rest_route( $this->namespace, '/logs/list',   [ 'methods' => 'POST', 'callback' => [ $this, 'logs_list' ],   'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/get',     [ 'methods' => 'POST', 'callback' => [ $this, 'logs_get' ],     'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/delete',  [ 'methods' => 'POST', 'callback' => [ $this, 'logs_delete' ],  'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/clear',   [ 'methods' => 'POST', 'callback' => [ $this, 'logs_clear' ],   'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/resend',  [ 'methods' => 'POST', 'callback' => [ $this, 'logs_resend' ],  'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/export',  [ 'methods' => 'POST', 'callback' => [ $this, 'logs_export' ],  'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/logs/stats',   [ 'methods' => 'POST', 'callback' => [ $this, 'logs_stats' ],   'permission_callback' => $perm ] );

    register_rest_route( $this->namespace, '/notice/dismiss', [ 'methods' => 'POST', 'callback' => [ $this, 'notice_dismiss' ], 'permission_callback' => $perm ] );

    register_rest_route( $this->namespace, '/mail/test',         [ 'methods' => 'POST', 'callback' => [ $this, 'mail_test' ],        'permission_callback' => $perm ] );
    register_rest_route( $this->namespace, '/secrets/reveal',    [ 'methods' => 'POST', 'callback' => [ $this, 'secrets_reveal' ],  'permission_callback' => $edit ] );
    register_rest_route( $this->namespace, '/oauth/auth-url',    [ 'methods' => 'POST', 'callback' => [ $this, 'oauth_auth_url' ],   'permission_callback' => $edit ] );
    register_rest_route( $this->namespace, '/oauth/disconnect',  [ 'methods' => 'POST', 'callback' => [ $this, 'oauth_disconnect' ], 'permission_callback' => $edit ] );
  }

  #region Settings

  public function settings_list() {
    return new WP_REST_Response( [ 'success' => true, 'options' => $this->core->get_masked_options() ], 200 );
  }

  public function settings_update( $request ) {
    $params = $request->get_json_params();
    // Silently ignore anything the caller is not allowed to write: a site admin
    // may still save the groups their own site owns.
    $incoming = $this->core->strip_locked_options( $params['options'] ?? [] );
    $merged   = $this->core->merge_options( $incoming );
    $this->core->update_options( $merged );
    return new WP_REST_Response( [ 'success' => true, 'options' => $this->core->get_masked_options() ], 200 );
  }

  /**
   * The whole configuration as it really is, credentials included, so the file can
   * stand a site back up on its own. That is the point of an export, and a backup
   * that quietly leaves the API keys out is one you find out about at the worst
   * moment — so the UI says plainly what the file holds instead.
   */
  public function settings_export() {
    return new WP_REST_Response( [
      'success' => true,
      'export'  => [
        'plugin'   => 'meow-mailer',
        'version'  => MWMAIL_VERSION,
        'exported' => current_time( 'mysql' ),
        'options'  => $this->core->get_all_options(),
      ],
    ], 200 );
  }

  public function settings_import( $request ) {
    $params = $request->get_json_params();
    $given  = $params['export'] ?? [];

    // Accept the wrapper an export produces, or a bare options object for anyone who
    // has hand-written one. Anything else is almost certainly the wrong file.
    $incoming = $given['options'] ?? $given;
    if ( ! is_array( $incoming ) || empty( $incoming ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'That file does not look like a Meow Mailer export.', 'meow-mailer' ) ], 200 );
    }

    $clean = $this->core->filter_known_options( $incoming );
    if ( empty( $clean ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'That file has no Meow Mailer settings in it.', 'meow-mailer' ) ], 200 );
    }

    // Same guard as a normal save: on a network, groups this site does not own are
    // dropped rather than quietly rewritten for everyone else.
    $merged = $this->core->merge_options( $this->core->strip_locked_options( $clean ) );
    $this->core->update_options( $merged );

    return new WP_REST_Response( [ 'success' => true, 'options' => $this->core->get_masked_options() ], 200 );
  }

  public function settings_reset() {
    $this->core->reset_options();
    return new WP_REST_Response( [ 'success' => true, 'options' => $this->core->get_masked_options() ], 200 );
  }

  /**
   * Toggle the shared network configuration. Restricted to super admins: this
   * affects every site of the network, not just the current one.
   */
  public function settings_network( $request ) {
    if ( ! is_multisite() || ! is_super_admin() || ! is_main_site() ) {
      return new WP_REST_Response( [ 'success' => false,
        'message' => __( 'The shared configuration is managed from the main site of the network.', 'meow-mailer' ) ], 403 );
    }
    $params = $request->get_json_params();
    $groups = is_array( $params['groups'] ?? null ) ? $params['groups'] : [];
    $this->core->set_network_mode( ! empty( $params['enabled'] ), $groups );
    return new WP_REST_Response( [ 'success' => true,
      'network'  => $this->core->network_state(),
      'options'  => $this->core->get_masked_options() ], 200 );
  }

  #endregion

  #region Logs

  public function logs_list( $request ) {
    try {
      $params  = $request->get_json_params();
      $page    = max( 1, intval( $params['page'] ?? 1 ) );
      $limit   = intval( $params['limit'] ?? 20 );
      $filters = $this->read_filters( $params['filters'] ?? [] );
      $sort    = $params['sort'] ?? null;
      $offset  = ( $page - 1 ) * $limit;

      $result = $this->core->logs->select( $offset, $limit, $filters, $sort );
      return new WP_REST_Response( [
        'success' => true,
        'total'   => $result['total'],
        'logs'    => $result['data'],
        // Unfiltered on purpose: this feeds the status bar, which answers "is my
        // email working?" on every screen and must not move when the view narrows.
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
    return new WP_REST_Response( [ 'success' => true, 'log' => Meow_MWMAIL_Modules_Logs::with_recipients( $row ) ], 200 );
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
    $filters = $this->read_filters( $params['filters'] ?? [] );

    // limit 0 = all matching rows; the list query already omits the heavy body column.
    $result  = $this->core->logs->select( 0, 0, $filters, $params['sort'] ?? null );

    $lines = [ $this->csv_row( [ 'Date', 'To', 'Cc', 'Bcc', 'From', 'Subject', 'Provider', 'Status', 'Error' ] ) ];
    foreach ( $result['data'] as $r ) {
      $lines[] = $this->csv_row( [ $r['created'], $r['email_to'], $r['cc'], $r['bcc'], $r['email_from'], $r['subject'], $r['provider'], $r['status'], $r['error'] ] );
    }

    return new WP_REST_Response( [ 'success' => true, 'csv' => implode( "\r\n", $lines ) ], 200 );
  }

  /**
   * Everything the dashboard draws, in one request: the daily series, the totals
   * for the period, why things failed, and which providers carried the volume.
   */
  public function logs_stats( $request ) {
    $params  = $request->get_json_params();
    $filters = $this->read_filters( $params['filters'] ?? [] );
    $days    = $filters['days'];

    $stats  = $this->core->logs->count_by_status( $filters );
    $sent   = (int) ( $stats['sent'] ?? 0 );
    $failed = (int) ( $stats['failed'] ?? 0 );

    return new WP_REST_Response( [
      'success'   => true,
      'days'      => $days,
      'series'    => $this->core->logs->daily_series( $days, $filters ),
      'totals'    => [
        'sent'    => $sent,
        'failed'  => $failed,
        'offline' => (int) ( $stats['offline'] ?? 0 ),
        'pending' => (int) ( $stats['pending'] ?? 0 ),
        // Offline and pending are not delivery outcomes, so they stay out of the
        // rate: it answers "of the emails we really tried to send, how many left".
        'rate'    => ( $sent + $failed ) > 0 ? round( ( $sent / ( $sent + $failed ) ) * 100, 1 ) : null,
      ],
      'errors'    => $this->core->logs->top_errors( $filters, 5 ),
      'providers' => $this->core->logs->count_by_provider( $filters ),
    ], 200 );
  }

  /**
   * The dashboard's filters, normalized. The log table, the totals, the chart and
   * the error ranking are all handed the very same array, so whatever the admin
   * picks narrows every panel at once instead of only the one it sits in.
   */
  private function read_filters( $filters ) {
    $filters = is_array( $filters ) ? $filters : [];
    $days    = intval( $filters['days'] ?? 30 );

    return [
      'status'   => (string) ( $filters['status'] ?? '' ),
      'provider' => (string) ( $filters['provider'] ?? '' ),
      'search'   => (string) ( $filters['search'] ?? '' ),
      // Whitelisted rather than clamped: these are the three the UI offers, and the
      // chart draws a bar per day, so an arbitrary number would be a way to ask for
      // a 365-bar chart (or a 365-day scan) from the browser.
      'days'     => in_array( $days, [ 7, 30, 90 ], true ) ? $days : 30,
    ];
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

    // Without the body there is nothing to resend, and sending an empty email
    // would look like a success. Attachments are never stored, so a resend can
    // only ever carry the message itself.
    if ( trim( (string) $row['body'] ) === '' ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'The content of this email was not stored, so it cannot be resent. Turn on "Store Body" in the settings to keep future emails resendable.', 'meow-mailer' ) ], 200 );
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

    // The attempt is logged as its own entry; count it on the original too, so the
    // log shows an email was retried rather than looking like a duplicate.
    $this->core->logs->update( $id, [ 'retries' => intval( $row['retries'] ) + 1 ] );

    if ( is_wp_error( $result ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => $result->get_error_message() ], 200 );
    }
    return new WP_REST_Response( [ 'success' => true ], 200 );
  }

  #endregion

  #region Tools

  /**
   * The admin dismissed the failure notice: remember the newest failure they saw,
   * so it only comes back when another email fails.
   */
  public function notice_dismiss() {
    update_option( Meow_MWMAIL_Core::NOTICE_SEEN_OPTION, $this->core->logs->last_failed_id(), false );
    return new WP_REST_Response( [ 'success' => true ], 200 );
  }

  public function mail_test( $request ) {
    $params = $request->get_json_params();
    $to     = sanitize_email( $params['to'] ?? '' );
    $format = ( ( $params['format'] ?? 'html' ) === 'plain' ) ? 'plain' : 'html';
    $target = ( ( $params['target'] ?? 'provider' ) === 'fallback' ) ? 'fallback' : 'provider';

    if ( ! is_email( $to ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Please provide a valid email address.', 'meow-mailer' ) ], 200 );
    }

    if ( $this->core->get_option( 'provider', 'none' ) === 'none' ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Provider is set to None. Choose a provider (or Offline) to send a test.', 'meow-mailer' ) ], 200 );
    }

    // A fallback nobody has ever exercised is the one whose API key was rotated or
    // whose OAuth token quietly expired, so it has to be testable on its own. This
    // routes the test straight at it, with no attempt on the main provider first.
    $route_to = null;
    if ( $target === 'fallback' ) {
      $route_to = $this->core->get_option( 'fallback_provider', 'none' );
      if ( ! $route_to || in_array( $route_to, [ 'none', 'offline' ], true ) ) {
        return new WP_REST_Response( [ 'success' => false, 'message' => __( 'No fallback provider is configured.', 'meow-mailer' ) ], 200 );
      }
    }

    if ( $format === 'plain' ) {
      $subject = __( 'Meow Mailer: Plain Text Test', 'meow-mailer' );
      $message = __( "This is a plain-text test email from Meow Mailer.\n\nIf you received it, your provider is configured correctly. 🐱", 'meow-mailer' );
      $headers = [ 'Content-Type: text/plain; charset=UTF-8' ];
    } else {
      $subject = __( 'Meow Mailer: HTML Test', 'meow-mailer' );
      $message = '<h2 style="margin:0 0 10px;font-family:sans-serif;">' . esc_html__( 'It works! 🐱', 'meow-mailer' ) . '</h2>'
        . '<p style="font-family:sans-serif;line-height:1.5;">' . esc_html__( 'This is an HTML test email from Meow Mailer. If you can read this with formatting, your provider is configured correctly.', 'meow-mailer' ) . '</p>';
      $headers = [ 'Content-Type: text/html; charset=UTF-8' ];
    }

    $email = $this->core->mailer->normalize( [
      'to'       => $to,
      'subject'  => $subject,
      'message'  => $message,
      'headers'  => $headers,
      'provider' => $route_to,
    ] );

    $result = $this->core->mailer->dispatch( $email );
    if ( is_wp_error( $result ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => $result->get_error_message() ], 200 );
    }
    return new WP_REST_Response( [
      'success' => true,
      'message' => $target === 'fallback'
        ? __( 'Test email sent through the fallback.', 'meow-mailer' )
        : __( 'Test email sent.', 'meow-mailer' ),
    ], 200 );
  }

  /**
   * Hand back one stored credential, so the eye beside it can show what is saved.
   *
   * Secrets are still kept out of the settings payload: they travel only when an
   * admin asks for this one field, rather than every key the site holds riding along
   * with every page load. Same permission as changing them, which on a network means
   * a shared provider can only be revealed where it can be edited.
   */
  public function secrets_reveal( $request ) {
    $params   = $request->get_json_params();
    $provider = (string) ( $params['provider'] ?? '' );
    $field    = (string) ( $params['field'] ?? '' );

    // Whitelisted, or the route would read back any option the plugin stores rather
    // than the one credential behind the eye. OAuth tokens are excluded on top: the
    // UI never offers to reveal them, so nothing should be able to ask.
    $allowed = array_diff( $this->core->secret_fields(), [ 'access_token', 'refresh_token' ] );
    if ( ! in_array( $field, $allowed, true ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'That field cannot be revealed.', 'meow-mailer' ) ], 200 );
    }

    $options = $this->core->get_all_options();
    $value   = $options['providers'][ $provider ][ $field ] ?? '';
    if ( ! is_string( $value ) || $value === '' ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Nothing is saved in that field.', 'meow-mailer' ) ], 200 );
    }

    return new WP_REST_Response( [ 'success' => true, 'value' => $value ], 200 );
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
    // Rebuild the config with the saved variant (Outlook tenant, Zoho data center).
    $config = Meow_MWMAIL_Core::oauth_config( $provider, Meow_MWMAIL_Core::oauth_variant( $creds ) );

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
    if ( ! in_array( $provider, Meow_MWMAIL_Core::OAUTH_PROVIDERS, true ) ) {
      return new WP_REST_Response( [ 'success' => false, 'message' => __( 'Unknown OAuth provider.', 'meow-mailer' ) ], 200 );
    }
    $all = $this->core->get_all_options();
    // account_id is Zoho's, and it belongs to the account that was just disconnected:
    // leaving it behind would aim the next connection's sends at the previous mailbox.
    foreach ( [ 'access_token', 'refresh_token', 'expires', 'account_id' ] as $field ) {
      if ( ! isset( $all['providers'][ $provider ][ $field ] ) ) {
        continue;
      }
      $all['providers'][ $provider ][ $field ] = $field === 'expires' ? 0 : '';
    }
    $this->core->update_options( $all );
    return new WP_REST_Response( [ 'success' => true, 'options' => $this->core->get_masked_options() ], 200 );
  }

  #endregion
}
