<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Core {

  public $admin = null;
  public $rest = null;
  public $logs = null;
  public $mailer = null;
  public $is_rest = false;

  private $option_name = 'mwmail_options';

  // The network-mode flag. It decides *where* the options are stored, so it can
  // never live inside the options themselves, always at network level.
  private $network_option = 'mwmail_network';

  // Sent to the browser in place of a stored secret; on save, this value means
  // "keep the existing secret" so credentials never round-trip through the client.
  const SECRET_MASK = '••••••••';

  // Id of the newest failed email the admin acknowledged by dismissing the notice.
  const NOTICE_SEEN_OPTION = 'mwmail_failures_seen';

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

  /**
   * Reading a shared group is enough to see it; changing it is not. A site admin
   * saving a shared group would silently reconfigure every other site of the
   * network, so only a network admin may write those. Groups that are not shared
   * still belong to the site, and its admin keeps full control of them.
   */
  public function can_edit_group( $group ) {
    if ( ! $this->can_access_settings() ) {
      return false;
    }
    if ( ! $this->is_group_shared( $group ) ) {
      return true; // the site owns this group outright
    }
    // A shared group belongs to the network, and the network is configured from
    // the main site. Even a super admin does not edit it from a subsite, where
    // it would look like a local change but affect everyone.
    return is_super_admin() && is_main_site();
  }


  #endregion

  #region Network (Multisite)

  /**
   * The option groups that can be shared network-wide. 'provider' is what shared
   * settings *means*, that is, set the provider up once for the whole network, so it is
   * always shared once the mode is on. The other two are opt-in: a network often
   * wants one mail account but a different sender per site.
   *
   * Logs are never in here: each site has its own table and always sees only its
   * own emails.
   */
  const NETWORK_GROUPS = [
    'provider' => [ 'provider', 'providers' ],
    'sender'   => [ 'from_email', 'from_name', 'force_from', 'reply_to' ],
    'delivery' => [ 'logs_enabled', 'log_body', 'log_retention_days', 'send_in_background' ],
  ];

  /** The groups that are shareable on top of 'provider'. */
  const NETWORK_OPTIONAL_GROUPS = [ 'sender', 'delivery' ];

  /**
   * Network mode: the provider (and optionally more) comes from one shared
   * configuration instead of this site's own. Off is the default, and makes
   * every site behave exactly like a standalone install.
   */
  public function is_network_mode() {
    return is_multisite() && is_array( get_site_option( $this->network_option, false ) );
  }

  /** Which groups are currently read from the network store. */
  public function network_groups() {
    if ( ! $this->is_network_mode() ) {
      return [];
    }
    $stored = get_site_option( $this->network_option, [] );
    $groups = [ 'provider' ];
    foreach ( self::NETWORK_OPTIONAL_GROUPS as $group ) {
      if ( ! empty( $stored[ $group ] ) ) {
        $groups[] = $group;
      }
    }
    return $groups;
  }

  public function is_group_shared( $group ) {
    return in_array( $group, $this->network_groups(), true );
  }

  /** Everything the admin app needs to render the multisite state. */
  public function network_state() {
    $shared = [];
    $can_edit = [];
    foreach ( array_keys( self::NETWORK_GROUPS ) as $group ) {
      $shared[ $group ]   = $this->is_group_shared( $group );
      $can_edit[ $group ] = $this->can_edit_group( $group );
    }
    return [
      'is_multisite'   => is_multisite(),
      'is_super_admin' => is_super_admin(),
      'is_main_site'   => is_main_site(),
      'site_count'     => is_multisite() ? (int) get_blog_count() : 1,
      'enabled'        => $this->is_network_mode(),
      'shared'         => $shared,
      'can_edit'       => $can_edit,
      // Where the shared configuration actually lives, for the "managed there" link.
      'config_url'     => is_multisite()
        ? get_admin_url( get_main_site_id(), 'admin.php?page=mwmail_settings' ) : '',
    ];
  }

  /** Every option name that currently lives in the network store. */
  private function shared_keys() {
    $keys = [];
    foreach ( $this->network_groups() as $group ) {
      $keys = array_merge( $keys, self::NETWORK_GROUPS[ $group ] );
    }
    return $keys;
  }

  /**
   * Turn sharing on/off, and pick which optional groups come along. Returns the
   * stored shape: false, or [ 'sender' => bool, 'delivery' => bool ].
   */
  public function set_network_mode( $enabled, $groups = [] ) {
    if ( ! is_multisite() ) {
      return false;
    }
    if ( ! $enabled ) {
      update_site_option( $this->network_option, false );
      return false;
    }

    $was     = $this->network_groups();
    $network = $this->read_options( true );
    $site    = $this->read_options( false );

    // Seed each group from this site as it starts being shared. Without this the
    // network store would hand every site an empty (or long-stale) config, and
    // mail would break network-wide the moment the switch is flipped.
    $becoming = [ 'provider' ];
    foreach ( self::NETWORK_OPTIONAL_GROUPS as $group ) {
      if ( ! empty( $groups[ $group ] ) ) {
        $becoming[] = $group;
      }
    }
    foreach ( array_diff( $becoming, $was ) as $group ) {
      foreach ( self::NETWORK_GROUPS[ $group ] as $key ) {
        if ( array_key_exists( $key, $site ) ) {
          $network[ $key ] = $site[ $key ];
        }
      }
    }
    update_site_option( $this->option_name, $network );

    $stored = [];
    foreach ( self::NETWORK_OPTIONAL_GROUPS as $group ) {
      $stored[ $group ] = ! empty( $groups[ $group ] );
    }
    update_site_option( $this->network_option, $stored );
    return $stored;
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
      'maileroo'   => [ 'api_key' => '' ],
      'gmail'      => [ 'client_id' => '', 'client_secret' => '', 'access_token' => '', 'refresh_token' => '', 'expires' => 0 ],
      'outlook'    => [ 'client_id' => '', 'client_secret' => '', 'tenant' => 'common', 'access_token' => '', 'refresh_token' => '', 'expires' => 0 ],
      'zoho'       => [ 'client_id' => '', 'client_secret' => '', 'datacenter' => 'zoho.com', 'access_token' => '', 'refresh_token' => '', 'expires' => 0, 'account_id' => '' ],
    ];
  }

  /** Providers whose endpoints are authorized through OAuth rather than a key. */
  const OAUTH_PROVIDERS = [ 'gmail', 'outlook', 'zoho' ];

  /**
   * The saved value that varies a provider's OAuth URLs: the Microsoft tenant, or
   * the Zoho data center. Kept here so the REST builder and the admin callback
   * cannot drift apart and produce a token request aimed at the wrong host.
   */
  public static function oauth_variant( $creds ) {
    return $creds['tenant'] ?? $creds['datacenter'] ?? '';
  }

  /**
   * OAuth endpoints/scope per provider. Both the REST auth-url builder and the
   * admin callback use this so the two stay in sync.
   */
  public static function oauth_config( $provider, $variant = '' ) {
    if ( $provider === 'gmail' ) {
      return [
        'auth'  => 'https://accounts.google.com/o/oauth2/v2/auth',
        'token' => 'https://oauth2.googleapis.com/token',
        'scope' => 'https://www.googleapis.com/auth/gmail.send',
        'extra' => [ 'access_type' => 'offline', 'prompt' => 'consent' ],
      ];
    }
    if ( $provider === 'outlook' ) {
      $tenant = $variant ?: 'common';
      return [
        'auth'  => "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/authorize",
        'token' => "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/token",
        'scope' => 'https://graph.microsoft.com/Mail.Send offline_access',
        'extra' => [ 'response_mode' => 'query', 'prompt' => 'consent' ],
      ];
    }
    if ( $provider === 'zoho' ) {
      // Zoho keeps each region's accounts on its own host and they do not share
      // data, so the whole flow has to happen on the user's own data center.
      $dc = self::zoho_datacenter( $variant );
      return [
        'auth'  => "https://accounts.{$dc}/oauth/v2/auth",
        'token' => "https://accounts.{$dc}/oauth/v2/token",
        'scope' => 'ZohoMail.messages.CREATE,ZohoMail.accounts.READ',
        'extra' => [ 'access_type' => 'offline', 'prompt' => 'consent' ],
      ];
    }
    return null;
  }

  /** The Zoho data centers, as their domain suffix. Anything else falls back to the US one. */
  public static function zoho_datacenters() {
    return [ 'zoho.com', 'zoho.eu', 'zoho.in', 'zoho.com.au', 'zoho.jp', 'zoho.com.cn', 'zohocloud.ca' ];
  }

  public static function zoho_datacenter( $value ) {
    return in_array( $value, self::zoho_datacenters(), true ) ? $value : 'zoho.com';
  }

  /** Raw stored options, from this site or from the network. */
  private function read_options( $network ) {
    $options = $network
      ? get_site_option( $this->option_name, [] )
      : get_option( $this->option_name, [] );
    return is_array( $options ) ? $options : [];
  }

  public function get_all_options() {
    $options = $this->read_options( false );

    // Shared groups override this site's own values, group by group. Anything not
    // shared stays exactly as the site stored it.
    $shared_keys = $this->shared_keys();
    if ( ! empty( $shared_keys ) ) {
      $shared = $this->read_options( true );
      foreach ( $shared_keys as $key ) {
        if ( array_key_exists( $key, $shared ) ) {
          $options[ $key ] = $shared[ $key ];
        }
      }
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
    $shared_keys = $this->shared_keys();
    if ( empty( $shared_keys ) ) {
      update_option( $this->option_name, $options, false );
      return $this->get_all_options();
    }

    // Route each option to the store that owns it, so a shared group is written
    // once for the network while the rest stays on this site.
    $network = $this->read_options( true );
    $site    = $this->read_options( false );
    foreach ( $options as $key => $value ) {
      if ( in_array( $key, $shared_keys, true ) ) {
        $network[ $key ] = $value;
      }
      else {
        $site[ $key ] = $value;
      }
    }
    update_site_option( $this->option_name, $network );
    update_option( $this->option_name, $site, false );
    return $this->get_all_options();
  }

  /**
   * Drop the options the current user may not write. A site admin can still save
   * the groups their site owns; the shared ones are silently left untouched.
   */
  public function strip_locked_options( $options ) {
    foreach ( self::NETWORK_GROUPS as $group => $keys ) {
      if ( $this->can_edit_group( $group ) ) {
        continue;
      }
      foreach ( $keys as $key ) {
        unset( $options[ $key ] );
      }
    }
    return $options;
  }

  public function update_option( $option, $value ) {
    $options            = $this->get_all_options();
    $options[ $option ] = $value;
    return $this->update_options( $options );
  }

  public function reset_options() {
    // A site admin resetting only clears the groups their site actually owns.
    return $this->update_options( $this->strip_locked_options( $this->list_options() ) );
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
      // Intentional, and only when WP_DEBUG is on. Helps diagnose delivery issues.
      // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log, WordPress.PHP.DevelopmentFunctions.error_log_print_r
      error_log( '[Meow Mailer] ' . ( is_string( $message ) ? $message : print_r( $message, true ) ) );
    }
  }
}
