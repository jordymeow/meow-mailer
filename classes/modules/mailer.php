<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * The dispatcher. Intercepts every wp_mail() call via `pre_wp_mail`, normalizes
 * the message, logs it, honours offline mode, and routes it to the one active
 * provider. This is the single code path for sending, logging and resending.
 */
class Meow_MWMAIL_Modules_Mailer {

  private $core = null;
  private $queue = [];           // emails deferred for background sending
  private $shutdown_hooked = false;
  private $bypass = false;       // let WordPress send this one itself
  private $own_action = false;   // we are the ones firing wp_mail_succeeded/failed

  public function __construct( $core ) {
    $this->core = $core;
    add_filter( 'pre_wp_mail', [ $this, 'pre_wp_mail' ], 10, 2 );

    // With no provider chosen we stay out of the delivery path, but the log is
    // still worth keeping: watching what WordPress sends changes nothing about how
    // it is sent, and "why is my log empty" is otherwise the first thing anyone
    // installing an email logger asks. Core reports both outcomes for us.
    // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
    add_action( 'wp_mail_succeeded', [ $this, 'log_native_sent' ] );
    // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
    add_action( 'wp_mail_failed', [ $this, 'log_native_failed' ] );
  }

  #region Logging WordPress's own sends

  public function log_native_sent( $atts ) {
    $this->log_native( is_array( $atts ) ? $atts : [], 'sent', '' );
  }

  public function log_native_failed( $error ) {
    $atts = is_wp_error( $error ) ? $error->get_error_data() : [];
    $this->log_native( is_array( $atts ) ? $atts : [], 'failed', is_wp_error( $error ) ? $error->get_error_message() : '' );
  }

  private function log_native( $atts, $status, $error ) {
    // Only when WordPress did the sending. Once a provider is set we route the
    // email ourselves and have already logged it, and these same actions are what
    // we fire afterwards, so without this every email would be recorded twice.
    if ( $this->own_action || $this->core->get_option( 'provider', 'none' ) !== 'none' ) {
      return;
    }
    if ( ! $this->core->get_option( 'logs_enabled', true ) || empty( $atts ) ) {
      return;
    }

    $email = $this->normalize( $atts );
    $this->log_email( $email, $status, $error, 'wordpress', (bool) $this->core->get_option( 'log_body', true ) );
  }

  #endregion

  /**
   * @param null|bool $short_circuit
   * @param array     $atts  to, subject, message, headers, attachments
   * @return bool
   */
  public function pre_wp_mail( $short_circuit, $atts ) {
    // Respect anything a plugin returned earlier in the filter chain.
    if ( null !== $short_circuit ) {
      return $short_circuit;
    }

    // A failure alert must not travel through the provider it is reporting on, so
    // that path asks us to stand aside and let WordPress send it natively.
    if ( $this->bypass ) {
      return $short_circuit;
    }

    // Provider "none": stay completely out of the way and let WordPress send as
    // usual and don't log. This is the default so activating doesn't hijack mail.
    if ( ( $this->core->get_option( 'provider', 'none' ) ) === 'none' ) {
      return $short_circuit;
    }

    // Note: do NOT apply the `wp_mail` filter here. Core runs it just before
    // `pre_wp_mail`, so $atts already went through it. Applying it again would run
    // every hooked filter twice, duplicating whatever they append (signatures,
    // subject prefixes, extra Bcc headers…).
    $email           = $this->normalize( $atts );
    $active_provider  = $email['provider'] ?? $this->core->get_option( 'provider', 'none' );

    // Background sending: hand the page back to the visitor immediately and do
    // the actual network send on shutdown (after the response is flushed). Offline
    // just logs (no network), so there's nothing to defer. We never defer messages
    // with attachments: the caller may delete temp files once wp_mail() returns,
    // and they'd be gone by shutdown.
    if ( $this->core->get_option( 'send_in_background', false )
      && $active_provider !== 'offline'
      && empty( $email['attachments'] ) && empty( $email['embeds'] ) ) {
      $this->enqueue( $email );
      return true;
    }

    $result = $this->dispatch( $email );

    return ! is_wp_error( $result );
  }

  /**
   * Run $callback with our wp_mail() interception turned off, so WordPress sends
   * with its own PHPMailer. Used for the failure alert: routing that through the
   * provider that just failed would lose exactly the message you needed.
   */
  public function without_routing( $callback ) {
    $previous     = $this->bypass;
    $this->bypass = true;
    try {
      return $callback();
    } finally {
      $this->bypass = $previous;
    }
  }

  #region Background queue

  private function enqueue( $email ) {
    $options      = $this->core->get_all_options();
    $logs_enabled = ! empty( $options['logs_enabled'] );
    $store_body   = ! empty( $options['log_body'] );
    $provider_key = $email['provider'] ?? ( $options['provider'] ?? 'none' );

    // Record it as Pending now so it shows in the log right away.
    $log_id = $logs_enabled ? $this->log_email( $email, 'pending', '', $provider_key, $store_body ) : null;

    $this->queue[] = [ 'email' => $email, 'provider' => $provider_key, 'log_id' => $log_id ];

    if ( ! $this->shutdown_hooked ) {
      add_action( 'shutdown', [ $this, 'process_queue' ], 1 );
      $this->shutdown_hooked = true;
    }
  }

  public function process_queue() {
    if ( empty( $this->queue ) ) {
      return;
    }
    // Flush the response to the browser first, then keep working in the background.
    if ( function_exists( 'fastcgi_finish_request' ) ) {
      @fastcgi_finish_request();
    }

    foreach ( $this->queue as $item ) {
      $attempt = $this->send_with_fallback( $item['provider'], $item['email'] );
      $result  = $attempt['result'];
      $status  = is_wp_error( $result ) ? 'failed' : 'sent';
      $error   = is_wp_error( $result ) ? $result->get_error_message() : $attempt['primary_error'];
      if ( $item['log_id'] ) {
        // The row was written as Pending against the primary; if the fallback is the
        // one that got it out, the log has to say so or it names the wrong sender.
        $this->core->logs->update( $item['log_id'], [
          'status'   => $status,
          'error'    => $error,
          'provider' => $attempt['provider'],
        ] );
      }
      $this->fire_mail_action( $result, $item['email'] );
    }
    $this->queue = [];
  }

  #endregion

  /**
   * Send a normalized email through the active provider (or offline), and log it.
   * Reused by resend and test-email.
   *
   * @return true|WP_Error
   */
  public function dispatch( $email ) {
    $options       = $this->core->get_all_options();
    $logs_enabled  = ! empty( $options['logs_enabled'] );
    $store_body    = ! empty( $options['log_body'] );
    $provider_key  = $email['provider'] ?? ( $options['provider'] ?? 'none' );

    // Offline provider: never send, just keep a record.
    if ( $provider_key === 'offline' ) {
      if ( $logs_enabled ) {
        $this->log_email( $email, 'offline', '', 'offline', $store_body );
      }
      return true;
    }

    $attempt = $this->send_with_fallback( $provider_key, $email );
    $result  = $attempt['result'];

    if ( $logs_enabled ) {
      $status = is_wp_error( $result ) ? 'failed' : 'sent';
      // On a rescue the row reads Sent, but it keeps the primary's error so the log
      // still shows which provider let you down and why.
      $error  = is_wp_error( $result ) ? $result->get_error_message() : $attempt['primary_error'];
      $this->log_email( $email, $status, $error, $attempt['provider'], $store_body );
    }

    $this->fire_mail_action( $result, $email );

    return $result;
  }

  /** Keep WordPress's wp_mail_succeeded / wp_mail_failed contract intact for listeners. */
  private function fire_mail_action( $result, $email ) {
    // Flagged so our own listener above can tell these apart from the ones core
    // fires when it sends by itself.
    $this->own_action = true;
    try {
      if ( is_wp_error( $result ) ) {
        do_action( 'wp_mail_failed', $result ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
        return;
      }
      // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
      do_action( 'wp_mail_succeeded', [
        'to'          => $email['to'],
        'subject'     => $email['subject'],
        'message'     => $email['message'],
        'headers'     => $email['headers_raw'],
        'attachments' => $email['attachments'],
      ] );
    } finally {
      $this->own_action = false;
    }
  }

  #region Fallback

  /**
   * Send through $provider_key, and if that fails, through the configured fallback.
   * One extra attempt, immediately, and never more than that.
   *
   * Deliberately no transient/permanent distinction: a bad API key, a rate limit and
   * a provider outage all mean the same thing here, which is "ask the other one". A
   * permanent failure (an address that does not exist) simply fails twice, and the
   * log keeps both errors.
   *
   * @return array  result (true|WP_Error), provider (the one that ended up sending),
   *                primary_error (empty unless the fallback rescued the email).
   */
  private function send_with_fallback( $provider_key, $email ) {
    $result = $this->send_with_provider( $provider_key, $email );
    if ( ! is_wp_error( $result ) ) {
      return [ 'result' => $result, 'provider' => $provider_key, 'primary_error' => '' ];
    }

    $fallback = $this->fallback_for( $provider_key );
    if ( $fallback === null ) {
      return [ 'result' => $result, 'provider' => $provider_key, 'primary_error' => '' ];
    }

    $primary_error = $result->get_error_message();
    $result        = $this->send_with_provider( $fallback, $email );

    if ( is_wp_error( $result ) ) {
      // Both are down. Report it as one failure, naming both, rather than hiding the
      // primary behind whatever the backup happened to say.
      return [
        'result'   => new WP_Error( $result->get_error_code(), sprintf(
          /* translators: 1: error from the main provider, 2: error from the fallback provider. */
          __( '%1$s (the fallback failed too: %2$s)', 'meow-mailer' ),
          $primary_error,
          $result->get_error_message()
        ) ),
        'provider'      => $provider_key,
        'primary_error' => '',
      ];
    }

    if ( $this->core->alerts ) {
      $this->core->alerts->on_rescued( $primary_error );
    }

    return [ 'result' => true, 'provider' => $fallback, 'primary_error' => $primary_error ];
  }

  /**
   * The fallback to use when $provider_key fails, or null when there is none worth
   * trying. Falling back to the provider that just failed, or to a mode that does not
   * send at all, would only cost the visitor another round trip.
   */
  private function fallback_for( $provider_key ) {
    $fallback = $this->core->get_option( 'fallback_provider', 'none' );
    if ( ! is_string( $fallback ) || $fallback === '' ) {
      return null;
    }
    if ( in_array( $fallback, [ 'none', 'offline' ], true ) || $fallback === $provider_key ) {
      return null;
    }
    return $fallback;
  }

  #endregion

  private function send_with_provider( $provider_key, $email ) {
    $class = 'Meow_MWMAIL_Mailers_' . ucfirst( $provider_key );
    if ( ! class_exists( $class ) ) {
      /* translators: %s: the provider key/slug that was not recognised. */
      return new WP_Error( 'mwmail_no_provider', sprintf( __( 'Unknown email provider: %s', 'meow-mailer' ), $provider_key ) );
    }
    try {
      $credentials = $this->core->get_provider_options( $provider_key );
      $mailer      = new $class( $this->core, $credentials );
      return $mailer->send( $email );
    } catch ( Throwable $e ) {
      return new WP_Error( 'mwmail_send_failed', $e->getMessage() );
    }
  }

  private function log_email( $email, $status, $error, $provider, $store_body ) {
    try {
      return $this->core->logs->insert( [
        'created'     => current_time( 'mysql' ),
        'email_to'    => implode( ', ', (array) $email['to'] ),
        'email_from'  => $this->format_from( $email ),
        'subject'     => (string) $email['subject'],
        'headers'     => wp_json_encode( $email['headers_raw'] ),
        'body'        => $store_body ? (string) $email['message'] : '',
        'attachments' => implode( ', ', $this->file_names( $email['attachments'] ) ),
        'provider'    => $provider,
        'status'      => $status,
        'error'       => (string) $error,
      ] );
    } catch ( Throwable $e ) {
      $this->core->log( 'Failed to log email: ' . $e->getMessage() );
      return null;
    }
  }

  /** The names the recipient sees: the array key when there is one, the file name otherwise. */
  private function file_names( $files ) {
    $names = [];
    foreach ( (array) $files as $name => $path ) {
      $names[] = is_string( $name ) ? $name : basename( $path );
    }
    return $names;
  }

  private function format_from( $email ) {
    if ( ! empty( $email['from_name'] ) ) {
      return $email['from_name'] . ' <' . $email['from_email'] . '>';
    }
    return (string) $email['from_email'];
  }

  /**
   * Turn raw wp_mail() arguments into a normalized structure. Mirrors the parsing
   * WordPress core does in wp_mail() so behaviour stays identical.
   */
  public function normalize( $atts ) {
    $to          = $atts['to'] ?? [];
    $subject     = $atts['subject'] ?? '';
    $message     = $atts['message'] ?? '';
    $headers     = $atts['headers'] ?? '';
    $attachments = $this->normalize_files( $atts['attachments'] ?? [] );
    $embeds      = $this->normalize_files( $atts['embeds'] ?? [] ); // inline images, since WP 6.9

    if ( ! is_array( $to ) ) {
      $to = explode( ',', $to );
    }
    $to = array_filter( array_map( 'trim', $to ) );

    $from_email = $from_name = $return_path = '';
    $content_type = 'text/plain';
    $charset      = get_bloginfo( 'charset' );
    $custom_headers = [];

    $header_lines = self::header_lines( $headers );

    // Cc / Bcc / Reply-To come from one shared parser, so the logs can read the very
    // same addresses back out of the headers they stored.
    $extra    = self::extra_recipients( $header_lines );
    $cc       = $extra['cc'];
    $bcc      = $extra['bcc'];
    $reply_to = $extra['reply_to'];

    foreach ( self::header_pairs( $header_lines ) as $pair ) {
      list( $name, $content ) = $pair;

      switch ( strtolower( $name ) ) {
        case 'from':
          $from = $this->parse_from( $content );
          $from_email = $from['email'];
          $from_name  = $from['name'];
          break;
        case 'content-type':
          if ( strpos( $content, ';' ) !== false ) {
            list( $type, $charset_content ) = explode( ';', $content, 2 );
            $content_type = trim( $type );
            if ( stripos( $charset_content, 'charset=' ) !== false ) {
              $charset = trim( str_replace( [ 'charset=', '"' ], '', $charset_content ) );
            }
          } else {
            $content_type = trim( $content );
          }
          break;
        case 'return-path':
          // Taken as the envelope sender rather than passed along as a header: as a
          // header it is rewritten by the receiving server at delivery and does
          // nothing, which is the trap anyone setting one falls into.
          $return_path = trim( $content );
          break;
        case 'cc':
        case 'bcc':
        case 'reply-to':
          // Already collected above. Still listed here so they never fall through to
          // the default branch and get re-sent as custom headers (duplicate recipients).
          break;
        default:
          if ( $name !== '' ) {
            $custom_headers[ $name ] = $content;
          }
          break;
      }
    }

    // Apply the plugin's From / Reply-To overrides.
    $options = $this->core->get_all_options();
    $force   = ! empty( $options['force_from'] );
    if ( $force || $from_email === '' ) {
      if ( ! empty( $options['from_email'] ) ) {
        $from_email = $options['from_email'];
      }
    }
    if ( $force || $from_name === '' ) {
      if ( ! empty( $options['from_name'] ) ) {
        $from_name = $options['from_name'];
      }
    }
    // Fall back to WordPress defaults if still empty.
    if ( $from_email === '' ) {
      $from_email = $this->default_from_email();
    }
    if ( empty( $reply_to ) && ! empty( $options['reply_to'] ) ) {
      $reply_to[] = $options['reply_to'];
    }
    // A header on the message wins over the setting: it is per-email and deliberate,
    // where the setting is the site-wide default.
    if ( $return_path === '' && ! empty( $options['return_path'] ) ) {
      $return_path = $options['return_path'];
    }

    // Allow core's wp_mail_from / wp_mail_from_name filters to keep working.
    $from_email = apply_filters( 'wp_mail_from', $from_email ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
    $from_name  = apply_filters( 'wp_mail_from_name', $from_name ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook

    return [
      'to'           => array_values( $to ),
      'subject'      => $subject,
      'message'      => $message,
      'attachments'  => $attachments,
      'embeds'       => $embeds,
      'cc'           => array_values( array_filter( $cc ) ),
      'bcc'          => array_values( array_filter( $bcc ) ),
      'reply_to'     => array_values( array_filter( $reply_to ) ),
      'from_email'   => $from_email,
      'from_name'    => $from_name,
      'return_path'  => $return_path,
      'content_type' => apply_filters( 'wp_mail_content_type', $content_type ), // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
      'charset'      => apply_filters( 'wp_mail_charset', $charset ), // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
      'custom_headers' => $custom_headers,
      'headers_raw'  => $header_lines,
      'provider'     => $atts['provider'] ?? null,
    ];
  }

  /** Headers as an array of lines, either shape wp_mail() accepts. */
  private static function header_lines( $headers ) {
    if ( is_array( $headers ) ) {
      return $headers;
    }
    return explode( "\n", str_replace( "\r\n", "\n", (string) $headers ) );
  }

  /**
   * Header lines as [ name, content ] pairs. wp_mail() takes both "Key: Value"
   * strings and an associative array, so both have to be understood here.
   */
  private static function header_pairs( $header_lines ) {
    $pairs = [];
    foreach ( (array) $header_lines as $key => $line ) {
      if ( is_string( $key ) ) {
        $pairs[] = [ trim( $key ), trim( (string) $line ) ];
      } elseif ( is_string( $line ) && strpos( $line, ':' ) !== false ) {
        list( $name, $content ) = explode( ':', trim( $line ), 2 );
        $pairs[] = [ trim( $name ), trim( $content ) ];
      }
    }
    return $pairs;
  }

  /**
   * The Cc / Bcc / Reply-To addresses a set of headers carries. Used when sending,
   * and again by the logs: only the "To" is stored as its own column, so this is
   * what makes the other recipients visible in the admin instead of looking dropped.
   *
   * @return array  cc, bcc, reply_to — each a list of addresses.
   */
  public static function extra_recipients( $headers ) {
    $out = [ 'cc' => [], 'bcc' => [], 'reply_to' => [] ];
    $map = [ 'cc' => 'cc', 'bcc' => 'bcc', 'reply-to' => 'reply_to' ];

    foreach ( self::header_pairs( self::header_lines( $headers ) ) as $pair ) {
      list( $name, $content ) = $pair;
      $key = $map[ strtolower( $name ) ] ?? null;
      if ( $key !== null ) {
        $out[ $key ] = array_merge( $out[ $key ], array_map( 'trim', explode( ',', $content ) ) );
      }
    }
    foreach ( $out as $key => $list ) {
      $out[ $key ] = array_values( array_filter( $list ) );
    }
    return $out;
  }

  /**
   * File lists exactly as wp_mail() accepts them: an array or newline-separated
   * paths. The keys carry meaning (the filename the recipient should see for an
   * attachment, the Content-ID for an embed), so they must be preserved, never
   * run through array_values().
   */
  private function normalize_files( $files ) {
    if ( ! is_array( $files ) ) {
      $files = explode( "\n", str_replace( "\r\n", "\n", (string) $files ) );
    }
    $files = array_filter( $files, 'is_string' );
    return array_filter( array_map( 'trim', $files ) );
  }

  private function parse_from( $content ) {
    $name  = '';
    $email = $content;
    if ( preg_match( '/(.*)<(.+)>/', $content, $matches ) ) {
      if ( count( $matches ) === 3 ) {
        $name  = trim( $matches[1], ' "' );
        $email = trim( $matches[2] );
      }
    }
    return [ 'name' => $name, 'email' => $email ];
  }

  private function default_from_email() {
    $sitename = wp_parse_url( network_home_url(), PHP_URL_HOST );
    if ( $sitename === null ) {
      $sitename = 'localhost';
    }
    if ( strpos( $sitename, 'www.' ) === 0 ) {
      $sitename = substr( $sitename, 4 );
    }
    return 'wordpress@' . $sitename;
  }
}
