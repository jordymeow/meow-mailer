<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Detects other mail plugins already configured on this site and copies their
 * settings into Meow Mailer, so switching never means re-entering credentials.
 * Everything happens server-side: the other plugin's secrets go straight from
 * its options row into ours, without ever traveling through the browser.
 */
class Meow_MWMAIL_Modules_Importer {

  private $core;

  // WP Mail SMTP and Easy WP SMTP are made by the same company and store their
  // settings in the same shape, so one mapper covers both.
  const SOURCES = [
    'wp-mail-smtp' => [ 'name' => 'WP Mail SMTP', 'option' => 'wp_mail_smtp' ],
    'easy-wp-smtp' => [ 'name' => 'Easy WP SMTP', 'option' => 'easy_wp_smtp' ],
  ];

  public function __construct( $core ) {
    $this->core = $core;
  }

  /**
   * The sources worth offering: their settings exist, their mailer has a Meow
   * Mailer equivalent, and the credentials that matter are actually readable.
   * A setup living in wp-config constants or encrypted by a Pro version is
   * silently skipped rather than offered as an import that would come up empty.
   */
  public function detect() {
    $found = [];
    foreach ( array_keys( self::SOURCES ) as $key ) {
      $mapped = $this->map( $key );
      if ( ! $mapped ) {
        continue;
      }
      $found[] = [
        'source'   => $key,
        'name'     => self::SOURCES[ $key ]['name'],
        'provider' => $mapped['provider'],
        // Whether the plugin is still running, so the UI can suggest deactivating
        // it once its settings have moved over.
        'active'   => $this->is_active( $key ),
      ];
    }
    return $found;
  }

  /** Copy one source's settings into ours. Returns what happened, or a WP_Error. */
  public function import( $source_key ) {
    $mapped = $this->map( $source_key );
    if ( ! $mapped ) {
      return new WP_Error( 'mwmail_import', __( 'Nothing importable was found for this plugin.', 'meow-mailer' ) );
    }

    $incoming = [
      'provider'  => $mapped['provider'],
      'providers' => [ $mapped['provider'] => $mapped['creds'] ],
    ];

    // Their sender comes along too, but never over an address already chosen here:
    // what the admin typed themselves beats what another plugin remembered.
    if ( $mapped['from_email'] && ! $this->core->get_option( 'from_email' ) ) {
      $incoming['from_email'] = $mapped['from_email'];
      $incoming['force_from'] = $mapped['force_from'];
    }
    if ( $mapped['from_name'] && ! $this->core->get_option( 'from_name' ) ) {
      $incoming['from_name'] = $mapped['from_name'];
    }

    // Same path as a file import: whitelist the fields, respect network locks.
    $clean  = $this->core->filter_known_options( $incoming );
    $merged = $this->core->merge_options( $this->core->strip_locked_options( $clean ) );
    $this->core->update_options( $merged );

    return [ 'provider' => $mapped['provider'], 'warnings' => $mapped['warnings'] ];
  }

  private function is_active( $source_key ) {
    if ( $source_key === 'wp-mail-smtp' ) {
      return function_exists( 'wp_mail_smtp' );
    }
    if ( $source_key === 'easy-wp-smtp' ) {
      return function_exists( 'easy_wp_smtp' );
    }
    return false;
  }

  /**
   * Read a source's stored settings and translate them into ours. Null whenever
   * there is nothing there, the mailer has no equivalent, or the credentials
   * that matter are missing: in all three cases there is nothing to offer.
   */
  private function map( $source_key ) {
    $source = self::SOURCES[ $source_key ] ?? null;
    if ( ! $source ) {
      return null;
    }
    $data = get_option( $source['option'], null );
    if ( ! is_array( $data ) || empty( $data['mail']['mailer'] ) ) {
      return null;
    }
    return $this->map_wpms( $data );
  }

  /** Their 'yes'/'no' of older versions and the booleans of newer ones, as one bool. */
  private static function truthy( $value ) {
    return $value === true || $value === 1 || $value === '1' || $value === 'yes' || $value === 'on';
  }

  /** The WP Mail SMTP option shape (shared by Easy WP SMTP). */
  private function map_wpms( $data ) {
    // Mailers with no Meow Mailer equivalent (PHP mail, SMTP.com, SendLayer,
    // SparkPost…) are left out on purpose: an import must never half-work.
    $mailers = [
      'smtp'       => 'smtp',
      'mailgun'    => 'mailgun',
      'sendgrid'   => 'sendgrid',
      'sendinblue' => 'brevo',
      'postmark'   => 'postmark',
      'amazonses'  => 'ses',
      'gmail'      => 'gmail',
      'outlook'    => 'outlook',
      'zoho'       => 'zoho',
    ];
    $mailer   = (string) $data['mail']['mailer'];
    $provider = $mailers[ $mailer ] ?? null;
    if ( ! $provider ) {
      return null;
    }

    $src      = is_array( $data[ $mailer ] ?? null ) ? $data[ $mailer ] : [];
    $creds    = [];
    $warnings = [];

    switch ( $provider ) {
      case 'smtp':
        $creds = [
          'host'       => (string) ( $src['host'] ?? '' ),
          'port'       => intval( $src['port'] ?? 0 ) ?: 587,
          'encryption' => in_array( $src['encryption'] ?? '', [ 'tls', 'ssl', 'none' ], true ) ? $src['encryption'] : 'none',
          'autotls'    => self::truthy( $src['autotls'] ?? true ),
          'auth'       => self::truthy( $src['auth'] ?? true ),
          'username'   => (string) ( $src['user'] ?? '' ),
          'password'   => (string) ( $src['pass'] ?? '' ),
        ];
        break;
      case 'mailgun':
        $creds = [
          'api_key' => (string) ( $src['api_key'] ?? '' ),
          'domain'  => (string) ( $src['domain'] ?? '' ),
          'region'  => strtolower( (string) ( $src['region'] ?? '' ) ) === 'eu' ? 'eu' : 'us',
        ];
        break;
      case 'brevo':
      case 'sendgrid':
        $creds = [ 'api_key' => (string) ( $src['api_key'] ?? '' ) ];
        break;
      case 'postmark':
        $creds = [ 'server_token' => (string) ( $src['server_api_token'] ?? '' ) ];
        if ( ! empty( $src['message_stream'] ) ) {
          $creds['message_stream'] = (string) $src['message_stream'];
        }
        break;
      case 'ses':
        // Their naming, not a mix-up: WP Mail SMTP stores the IAM pair under
        // client_id / client_secret.
        $creds = [
          'access_key' => (string) ( $src['client_id'] ?? '' ),
          'secret_key' => (string) ( $src['client_secret'] ?? '' ),
          'region'     => (string) ( $src['region'] ?? 'us-east-1' ),
        ];
        break;
      case 'gmail':
      case 'outlook':
      case 'zoho':
        $creds = [
          'client_id'     => (string) ( $src['client_id'] ?? '' ),
          'client_secret' => (string) ( $src['client_secret'] ?? '' ),
        ];
        if ( $provider === 'zoho' ) {
          $creds['datacenter'] = Meow_MWMAIL_Core::zoho_datacenter( (string) ( $src['domain'] ?? '' ) );
        }
        // The tokens themselves are bound to the other plugin's redirect URI, so
        // they cannot come along: only the app credentials do.
        $warnings[] = __( 'The account connection itself cannot be copied. Add the Meow Mailer redirect URI to your OAuth app, then connect your account again.', 'meow-mailer' );
        break;
    }

    foreach ( $this->required_fields( $provider ) as $field ) {
      if ( empty( $creds[ $field ] ) ) {
        return null;
      }
    }

    $mail = $data['mail'];
    return [
      'provider'   => $provider,
      'creds'      => $creds,
      'from_email' => sanitize_email( $mail['from_email'] ?? '' ),
      'from_name'  => sanitize_text_field( $mail['from_name'] ?? '' ),
      'force_from' => self::truthy( $mail['from_email_force'] ?? false ),
      'warnings'   => $warnings,
    ];
  }

  /** Without these, the imported provider could not send: don't offer it at all. */
  private function required_fields( $provider ) {
    switch ( $provider ) {
      case 'smtp':     return [ 'host' ];
      case 'mailgun':  return [ 'api_key', 'domain' ];
      case 'ses':      return [ 'access_key', 'secret_key' ];
      case 'postmark': return [ 'server_token' ];
      case 'gmail':
      case 'outlook':
      case 'zoho':     return [ 'client_id', 'client_secret' ];
      default:         return [ 'api_key' ];
    }
  }
}
