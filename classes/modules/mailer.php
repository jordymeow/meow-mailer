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

  public function __construct( $core ) {
    $this->core = $core;
    add_filter( 'pre_wp_mail', [ $this, 'pre_wp_mail' ], 10, 2 );
  }

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

    // Provider "none": stay completely out of the way — let WordPress send as
    // usual and don't log. This is the default so activating doesn't hijack mail.
    if ( ( $this->core->get_option( 'provider', 'none' ) ) === 'none' ) {
      return $short_circuit;
    }

    // Preserve compatibility with code that hooks the `wp_mail` filter.
    if ( is_array( $atts ) ) {
      $atts = apply_filters( 'wp_mail', $atts ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
    }

    $email           = $this->normalize( $atts );
    $active_provider  = $email['provider'] ?? $this->core->get_option( 'provider', 'none' );

    // Background sending: hand the page back to the visitor immediately and do
    // the actual network send on shutdown (after the response is flushed). Offline
    // just logs (no network), so there's nothing to defer. We never defer messages
    // with attachments: the caller may delete temp files once wp_mail() returns,
    // and they'd be gone by shutdown.
    if ( $this->core->get_option( 'send_in_background', false )
      && $active_provider !== 'offline'
      && empty( $email['attachments'] ) ) {
      $this->enqueue( $email );
      return true;
    }

    $result = $this->dispatch( $email );

    return ! is_wp_error( $result );
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
      $result = $this->send_with_provider( $item['provider'], $item['email'] );
      $status = is_wp_error( $result ) ? 'failed' : 'sent';
      $error  = is_wp_error( $result ) ? $result->get_error_message() : '';
      if ( $item['log_id'] ) {
        $this->core->logs->update( $item['log_id'], [ 'status' => $status, 'error' => $error ] );
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

    $result = $this->send_with_provider( $provider_key, $email );

    if ( $logs_enabled ) {
      $status = is_wp_error( $result ) ? 'failed' : 'sent';
      $error  = is_wp_error( $result ) ? $result->get_error_message() : '';
      $this->log_email( $email, $status, $error, $provider_key, $store_body );
    }

    $this->fire_mail_action( $result, $email );

    return $result;
  }

  /** Keep WordPress's wp_mail_succeeded / wp_mail_failed contract intact for listeners. */
  private function fire_mail_action( $result, $email ) {
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
  }

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
        'attachments' => implode( ', ', array_map( 'basename', (array) $email['attachments'] ) ),
        'provider'    => $provider,
        'status'      => $status,
        'error'       => (string) $error,
      ] );
    } catch ( Throwable $e ) {
      $this->core->log( 'Failed to log email: ' . $e->getMessage() );
      return null;
    }
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
    $attachments = $atts['attachments'] ?? [];

    if ( ! is_array( $to ) ) {
      $to = explode( ',', $to );
    }
    $to = array_filter( array_map( 'trim', $to ) );

    if ( ! is_array( $attachments ) ) {
      $attachments = explode( "\n", str_replace( "\r\n", "\n", $attachments ) );
    }
    $attachments = array_filter( array_map( 'trim', (array) $attachments ) );

    $cc = $bcc = $reply_to = [];
    $from_email = $from_name = '';
    $content_type = 'text/plain';
    $charset      = get_bloginfo( 'charset' );
    $custom_headers = [];

    // Normalize the headers to an array of "Key: Value" lines.
    $header_lines = [];
    if ( ! is_array( $headers ) ) {
      $header_lines = explode( "\n", str_replace( "\r\n", "\n", $headers ) );
    } else {
      $header_lines = $headers;
    }

    foreach ( $header_lines as $key => $line ) {
      $name    = '';
      $content = '';
      if ( is_string( $key ) ) {
        $name    = $key;
        $content = $line;
      } elseif ( strpos( $line, ':' ) !== false ) {
        list( $name, $content ) = explode( ':', trim( $line ), 2 );
      } else {
        continue;
      }
      $name    = trim( $name );
      $content = trim( $content );

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
        case 'cc':
          $cc = array_merge( $cc, array_map( 'trim', explode( ',', $content ) ) );
          break;
        case 'bcc':
          $bcc = array_merge( $bcc, array_map( 'trim', explode( ',', $content ) ) );
          break;
        case 'reply-to':
          $reply_to = array_merge( $reply_to, array_map( 'trim', explode( ',', $content ) ) );
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

    // Allow core's wp_mail_from / wp_mail_from_name filters to keep working.
    $from_email = apply_filters( 'wp_mail_from', $from_email ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
    $from_name  = apply_filters( 'wp_mail_from_name', $from_name ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook

    return [
      'to'           => array_values( $to ),
      'subject'      => $subject,
      'message'      => $message,
      'attachments'  => array_values( $attachments ),
      'cc'           => array_values( array_filter( $cc ) ),
      'bcc'          => array_values( array_filter( $bcc ) ),
      'reply_to'     => array_values( array_filter( $reply_to ) ),
      'from_email'   => $from_email,
      'from_name'    => $from_name,
      'content_type' => apply_filters( 'wp_mail_content_type', $content_type ), // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
      'charset'      => apply_filters( 'wp_mail_charset', $charset ), // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
      'custom_headers' => $custom_headers,
      'headers_raw'  => $header_lines,
      'provider'     => $atts['provider'] ?? null,
    ];
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
