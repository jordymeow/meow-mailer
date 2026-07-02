<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Admin extends MeowKit_MWMAIL_Admin {

  public $core;

  public function __construct( $core ) {
    $this->core = $core;
    parent::__construct( MWMAIL_PREFIX, MWMAIL_ENTRY, MWMAIL_DOMAIN, false, false, true );

    if ( is_admin() ) {
      add_action( 'admin_menu', [ $this, 'app_menu' ] );
      add_action( 'admin_init', [ $this, 'handle_oauth_callback' ] );
      add_action( 'admin_notices', [ $this, 'failure_notice' ] );
      if ( $this->core->can_access_settings() ) {
        add_action( 'admin_enqueue_scripts', [ $this, 'admin_enqueue_scripts' ] );
      }
    }
  }

  /**
   * Make silent failures visible — a dashboard warning when recent sends failed.
   */
  public function failure_notice() {
    if ( ! current_user_can( 'manage_options' ) ) {
      return;
    }
    if ( $this->core->get_option( 'provider', 'none' ) === 'none' ) {
      return;
    }
    // Don't nag on our own screen — the log is right there. Read-only display
    // check, no form is processed here.
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended
    if ( sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) ) === 'mwmail_settings' ) {
      return;
    }
    $count = $this->core->logs->count_recent_failed( 24 );
    if ( $count < 1 ) {
      return;
    }
    $url = admin_url( 'admin.php?page=mwmail_settings&nekoTab=logs' );
    printf(
      '<div class="notice notice-error"><p><strong>Meow Mailer:</strong> %s <a href="%s">%s</a></p></div>',
      /* translators: %d: number of emails that failed to send in the last 24 hours. */
      esc_html( sprintf( _n( '%d email failed to send in the last 24 hours.', '%d emails failed to send in the last 24 hours.', $count, 'meow-mailer' ), $count ) ),
      esc_url( $url ),
      esc_html__( 'View logs', 'meow-mailer' )
    );
  }

  public function app_menu() {
    add_submenu_page( 'meowapps-main-menu', 'Meow Mailer', 'Mailer', 'manage_options',
      'mwmail_settings', [ $this, 'admin_settings' ] );
  }

  public function admin_settings() {
    echo '<div id="mwmail-admin-settings"></div>';
  }

  public function admin_enqueue_scripts() {
    $physical_file = MWMAIL_PATH . '/app/index.js';
    $cache_buster  = file_exists( $physical_file ) ? filemtime( $physical_file ) : MWMAIL_VERSION;

    wp_register_script( 'mwmail-vendor', MWMAIL_URL . 'app/vendor.js',
      [ 'wp-element', 'wp-i18n' ], $cache_buster, true );
    wp_register_script( 'mwmail', MWMAIL_URL . 'app/index.js',
      [ 'mwmail-vendor', 'wp-i18n', 'wp-components' ], $cache_buster, true );
    wp_set_script_translations( 'mwmail', 'meow-mailer' );
    wp_enqueue_script( 'mwmail' );

    wp_localize_script( 'mwmail', 'mwmail', [
      'api_url'    => rest_url( 'meow-mailer/v1' ),
      'rest_url'   => rest_url(),
      'plugin_url' => MWMAIL_URL,
      'prefix'     => MWMAIL_PREFIX,
      'domain'     => MWMAIL_DOMAIN,
      'rest_nonce' => wp_create_nonce( 'wp_rest' ),
      'oauth_redirect_uri' => self::oauth_redirect_uri(),
      'options'    => $this->core->get_masked_options(),
    ] );
  }

  #region OAuth (Gmail & Outlook)

  public static function oauth_redirect_uri() {
    return admin_url( 'admin.php?page=mwmail_settings' );
  }

  public function handle_oauth_callback() {
    if ( sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) ) !== 'mwmail_settings' || ! isset( $_GET['code'] ) ) {
      return;
    }
    if ( ! current_user_can( 'manage_options' ) ) {
      return;
    }

    // state = "<nonce>|<provider>" so one redirect URI serves both providers.
    $state = sanitize_text_field( wp_unslash( $_GET['state'] ?? '' ) );
    list( $nonce, $provider ) = array_pad( explode( '|', $state, 2 ), 2, '' );
    $provider = in_array( $provider, [ 'gmail', 'outlook' ], true ) ? $provider : '';

    if ( ! $provider || ! wp_verify_nonce( $nonce, 'mwmail_oauth' ) ) {
      wp_safe_redirect( add_query_arg( [ 'mwmail_oauth' => 'error', 'nekoTab' => 'settings' ], self::oauth_redirect_uri() ) );
      exit;
    }

    $creds  = $this->core->get_provider_options( $provider );
    $config = Meow_MWMAIL_Core::oauth_config( $provider, $creds['tenant'] ?? 'common' );
    $code   = sanitize_text_field( wp_unslash( $_GET['code'] ) );

    $response = wp_remote_post( $config['token'], [
      'timeout' => 30,
      'body'    => [
        'code'          => $code,
        'client_id'     => $creds['client_id'],
        'client_secret' => $creds['client_secret'],
        'redirect_uri'  => self::oauth_redirect_uri(),
        'grant_type'    => 'authorization_code',
      ],
    ] );

    $ok = false;
    if ( ! is_wp_error( $response ) ) {
      $body = json_decode( wp_remote_retrieve_body( $response ), true );
      if ( ! empty( $body['refresh_token'] ) ) {
        $all = $this->core->get_all_options();
        $all['providers'][ $provider ]['refresh_token'] = $body['refresh_token'];
        $all['providers'][ $provider ]['access_token']  = $body['access_token'] ?? '';
        $all['providers'][ $provider ]['expires']       = time() + intval( $body['expires_in'] ?? 3600 );
        $this->core->update_options( $all );
        $ok = true;
      }
    }

    wp_safe_redirect( add_query_arg( [ 'mwmail_oauth' => $ok ? 'connected' : 'error', 'nekoTab' => 'settings' ], self::oauth_redirect_uri() ) );
    exit;
  }

  #endregion
}
