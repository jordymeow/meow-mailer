<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Core {

  public $admin = null;
  public $rest = null;
  public $logs = null;
  public $mailer = null;
  public $is_rest = false;

  private $option_name = 'mwmail_options';

  // Sent to the browser in place of a stored secret; on save, this value means
  // "keep the existing secret" so credentials never round-trip through the client.
  const SECRET_MASK = '••••••••';

  public function __construct() {
    $this->is_rest = MeowKit_MWMAIL_Helpers::is_rest();

    // The logs module and the mailer dispatcher must exist on every request so that
    // wp_mail() is intercepted wherever it is called.
    $this->logs   = new Meow_MWMAIL_Modules_Logs( $this );
    $this->mailer = new Meow_MWMAIL_Modules_Mailer( $this );

    // Daily prune of old logs (when a retention is configured).
    add_action( 'mwmail_prune_logs', [ $this, 'prune_logs' ] );
    if ( ! wp_next_scheduled( 'mwmail_prune_logs' ) ) {
      wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'mwmail_prune_logs' );
    }

    add_action( 'init', [ $this, 'init' ] );
  }

  public function init() {
    if ( is_admin() ) {
      $this->admin = new Meow_MWMAIL_Admin( $this );
    }
    if ( $this->is_rest ) {
      $this->rest = new Meow_MWMAIL_Rest( $this );
    }
  }

  #region Access & Security

  public function can_access_settings() {
    return apply_filters( 'mwmail_allow_setup', current_user_can( 'manage_options' ) );
  }

  #endregion

  #region Options

  public function list_options() {
    return [
      // 'none' = stay out of the way (don't touch wp_mail). 'offline' = log only,
      // never send. Anything else = route through that provider.
      'provider'           => 'none',
      'from_email'         => '',
      'from_name'          => '',
      'force_from'         => false,
      'reply_to'           => '',
      'logs_enabled'       => true,
      'log_body'           => true,
      'log_retention_days' => 0, // 0 = keep forever
      'send_in_background' => false,
      'providers'          => $this->default_providers(),
    ];
  }

  public function default_providers() {
    return [
      'smtp'       => [ 'host' => '', 'port' => 587, 'encryption' => 'tls', 'autotls' => true, 'auth' => true, 'username' => '', 'password' => '' ],
      'mailgun'    => [ 'api_key' => '', 'domain' => '', 'region' => 'us' ],
      'brevo'      => [ 'api_key' => '' ],
      'sendgrid'   => [ 'api_key' => '' ],
      'ses'        => [ 'access_key' => '', 'secret_key' => '', 'region' => 'us-east-1' ],
      'postmark'   => [ 'server_token' => '', 'message_stream' => 'outbound' ],
      'smtp2go'    => [ 'api_key' => '' ],
      'mailjet'    => [ 'api_key' => '', 'secret_key' => '' ],
      'resend'     => [ 'api_key' => '' ],
      'mailersend' => [ 'api_key' => '' ],
      'gmail'      => [ 'client_id' => '', 'client_secret' => '', 'access_token' => '', 'refresh_token' => '', 'expires' => 0 ],
      'outlook'    => [ 'client_id' => '', 'client_secret' => '', 'tenant' => 'common', 'access_token' => '', 'refresh_token' => '', 'expires' => 0 ],
    ];
  }

  /**
   * OAuth endpoints/scope per provider. Both the REST auth-url builder and the
   * admin callback use this so the two stay in sync.
   */
  public static function oauth_config( $provider, $tenant = 'common' ) {
    if ( $provider === 'gmail' ) {
      return [
        'auth'  => 'https://accounts.google.com/o/oauth2/v2/auth',
        'token' => 'https://oauth2.googleapis.com/token',
        'scope' => 'https://www.googleapis.com/auth/gmail.send',
        'extra' => [ 'access_type' => 'offline', 'prompt' => 'consent' ],
      ];
    }
    if ( $provider === 'outlook' ) {
      $tenant = $tenant ?: 'common';
      return [
        'auth'  => "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/authorize",
        'token' => "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/token",
        'scope' => 'https://graph.microsoft.com/Mail.Send offline_access',
        'extra' => [ 'response_mode' => 'query', 'prompt' => 'consent' ],
      ];
    }
    return null;
  }

  public function get_all_options() {
    $options = get_option( $this->option_name, [] );
    if ( ! is_array( $options ) ) {
      $options = [];
    }
    $defaults = $this->list_options();
    $options  = array_merge( $defaults, $options );

    // Deep-merge the providers so newly-added providers always have their defaults.
    $options['providers'] = is_array( $options['providers'] ) ? $options['providers'] : [];
    foreach ( $defaults['providers'] as $key => $fields ) {
      $options['providers'][ $key ] = array_merge( $fields, $options['providers'][ $key ] ?? [] );
    }
    return $options;
  }

  public function get_option( $option, $default = null ) {
    $options = $this->get_all_options();
    return $options[ $option ] ?? $default;
  }

  /** Credential fields that must never be exposed to the browser. */
  public function secret_fields() {
    return [ 'password', 'api_key', 'secret_key', 'server_token', 'client_secret', 'access_token', 'refresh_token' ];
  }

  /** Options safe to send to the client: stored secrets replaced by a mask. */
  public function get_masked_options() {
    $options = $this->get_all_options();
    $secrets = $this->secret_fields();
    foreach ( $options['providers'] as $provider => $fields ) {
      foreach ( $secrets as $field ) {
        if ( ! empty( $fields[ $field ] ) ) {
          $options['providers'][ $provider ][ $field ] = self::SECRET_MASK;
        }
      }
    }
    return $options;
  }

  /**
   * Merge an options payload coming from the client into the stored options.
   * Providers are deep-merged and masked secrets are preserved, so the UI can
   * re-save the whole object without ever wiping a credential or OAuth token.
   */
  public function merge_options( $incoming ) {
    $merged  = $this->get_all_options();
    $secrets = $this->secret_fields();

    foreach ( (array) $incoming as $key => $value ) {
      if ( $key === 'providers' && is_array( $value ) ) {
        foreach ( $value as $provider => $fields ) {
          if ( ! is_array( $fields ) ) {
            continue;
          }
          $merged['providers'][ $provider ] = $merged['providers'][ $provider ] ?? [];
          foreach ( $fields as $field => $field_value ) {
            if ( in_array( $field, $secrets, true ) && $field_value === self::SECRET_MASK ) {
              continue; // keep the existing secret
            }
            $merged['providers'][ $provider ][ $field ] = $field_value;
          }
        }
      } else {
        $merged[ $key ] = $value;
      }
    }
    return $merged;
  }

  /**
   * Credentials for a provider, allowing PHP constants to override what's in the
   * database (so secrets can live in wp-config.php instead of the options table).
   * Constant name pattern: MWMAIL_<PROVIDER>_<FIELD>, e.g. MWMAIL_SMTP_PASSWORD.
   */
  public function get_provider_options( $provider ) {
    $all    = $this->get_all_options();
    $fields = $all['providers'][ $provider ] ?? [];
    foreach ( $fields as $field => $value ) {
      $const = 'MWMAIL_' . strtoupper( $provider ) . '_' . strtoupper( $field );
      if ( defined( $const ) ) {
        $fields[ $field ] = constant( $const );
      }
    }
    return $fields;
  }

  public function update_options( $options ) {
    update_option( $this->option_name, $options, false );
    return $this->get_all_options();
  }

  public function update_option( $option, $value ) {
    $options            = $this->get_all_options();
    $options[ $option ] = $value;
    return $this->update_options( $options );
  }

  public function reset_options() {
    return $this->update_options( $this->list_options() );
  }

  #endregion

  public function prune_logs() {
    $days = intval( $this->get_option( 'log_retention_days', 0 ) );
    if ( $days > 0 && $this->logs ) {
      $this->logs->prune( $days );
    }
  }

  public function log( $message ) {
    if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
      // Intentional, and only when WP_DEBUG is on — helps diagnose delivery issues.
      // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log, WordPress.PHP.DevelopmentFunctions.error_log_print_r
      error_log( '[Meow Mailer] ' . ( is_string( $message ) ? $message : print_r( $message, true ) ) );
    }
  }
}
