<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Tells the site owner what happened without them having to log in: an alert when
 * email starts failing, and an optional weekly summary.
 *
 * The alert deliberately does not go through the configured provider. When sending
 * breaks, the provider is usually the thing that broke, and an alert routed through
 * it would vanish exactly when it mattered. It is handed to WordPress instead, which
 * falls back to the server's own mail. Not glamorous, but independent.
 */
class Meow_MWMAIL_Modules_Alerts {

  const LAST_ALERT_OPTION = 'mwmail_last_alert';
  const SUMMARY_HOOK      = 'mwmail_weekly_summary';

  // The rescue alert keeps its own window rather than sharing the one above. They
  // throttle each other otherwise, and a rescue would be able to swallow the alert
  // for a real outage happening twenty minutes later.
  const LAST_RESCUE_OPTION = 'mwmail_last_rescue_alert';

  // One alert per hour at most. A provider outage fails every email the site tries
  // to send, and a mailbox with 400 identical alerts is worse than none.
  const ALERT_INTERVAL = HOUR_IN_SECONDS;

  private $core = null;
  private $sending = false;

  public function __construct( $core ) {
    $this->core = $core;

    // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
    add_action( 'wp_mail_failed', [ $this, 'on_failure' ] );

    add_action( self::SUMMARY_HOOK, [ $this, 'send_summary' ] );
    if ( ! wp_next_scheduled( self::SUMMARY_HOOK ) ) {
      wp_schedule_event( time() + DAY_IN_SECONDS, 'weekly', self::SUMMARY_HOOK );
    }
  }

  #region Failure alerts

  public function on_failure( $error ) {
    // Never let an alert about a failure become the cause of the next one.
    if ( $this->sending ) {
      return;
    }
    if ( ! $this->core->get_option( 'alerts_enabled', false ) ) {
      return;
    }
    // With no provider selected we are not the ones sending, so a failure is not
    // ours to report.
    if ( $this->core->get_option( 'provider', 'none' ) === 'none' ) {
      return;
    }

    $last = (int) get_option( self::LAST_ALERT_OPTION, 0 );
    if ( $last && ( time() - $last ) < self::ALERT_INTERVAL ) {
      return;
    }
    // Claim the window before sending, so two failures in the same request cannot
    // both decide they are the one to alert.
    update_option( self::LAST_ALERT_OPTION, time(), false );

    $count   = max( 1, $this->core->logs->count_recent_failed( 1 ) );
    $message = is_wp_error( $error ) ? $error->get_error_message() : '';

    $this->send_alert( $count, $message );
  }

  /**
   * The fallback just delivered an email the main provider refused. Nothing is lost,
   * so this is not a failure alert, but it still has to be said: otherwise the primary
   * can stay broken for weeks while every log row happily reads "sent".
   */
  public function on_rescued( $primary_error ) {
    if ( $this->sending || ! $this->core->get_option( 'alerts_enabled', false ) ) {
      return;
    }

    $last = (int) get_option( self::LAST_RESCUE_OPTION, 0 );
    if ( $last && ( time() - $last ) < self::ALERT_INTERVAL ) {
      return;
    }
    update_option( self::LAST_RESCUE_OPTION, time(), false );

    $site    = $this->site_name();
    /* translators: %s: the site name. */
    $subject = sprintf( __( '[%s] Your email provider is failing', 'meow-mailer' ), $site );

    $lines = [
      /* translators: %s: the site name. */
      sprintf( __( 'The email provider configured on %s is refusing to send, and the fallback is delivering in its place.', 'meow-mailer' ), $site ),
      '',
      __( 'Your email is still going out, so there is nothing urgent to do. It is worth a look all the same, because the fallback is only meant to cover a bad moment, not to carry the site.', 'meow-mailer' ),
    ];
    if ( $primary_error !== '' ) {
      /* translators: %s: the error reported by the main email provider. */
      $lines[] = sprintf( __( 'What the provider said: %s', 'meow-mailer' ), $primary_error );
    }
    $lines[] = '';
    $lines[] = __( 'The full log is here:', 'meow-mailer' );
    $lines[] = admin_url( 'admin.php?page=mwmail_settings&nekoTab=logs' );
    $lines[] = '';
    $lines[] = __( 'You are getting this because failure alerts are on in Meow Mailer. You can turn them off in its settings.', 'meow-mailer' );

    // Unrouted, like the failure alert: the provider that just failed is the last
    // thing that should be carrying the news of its own failure.
    $this->deliver( $subject, implode( "\n", $lines ), 'alerts_email', true );
  }

  private function send_alert( $count, $message ) {
    $site = $this->site_name();

    /* translators: %s: the site name. */
    $subject = sprintf( __( '[%s] Email is failing to send', 'meow-mailer' ), $site );

    $lines = [
      /* translators: %s: the site name. */
      sprintf( __( 'Emails from %s are not being delivered.', 'meow-mailer' ), $site ),
      '',
      /* translators: %d: number of emails that failed in the last hour. */
      sprintf( _n( '%d email failed in the last hour.', '%d emails failed in the last hour.', $count, 'meow-mailer' ), $count ),
    ];
    if ( $message !== '' ) {
      /* translators: %s: the error reported by the email provider. */
      $lines[] = sprintf( __( 'Last error: %s', 'meow-mailer' ), $message );
    }
    $lines[] = '';
    $lines[] = __( 'The full log is here:', 'meow-mailer' );
    $lines[] = admin_url( 'admin.php?page=mwmail_settings&nekoTab=logs' );
    $lines[] = '';
    $lines[] = __( 'You are getting this because failure alerts are on in Meow Mailer. You can turn them off in its settings.', 'meow-mailer' );

    $this->deliver( $subject, implode( "\n", $lines ), 'alerts_email', true );
  }

  #endregion

  #region Weekly summary

  public function send_summary() {
    if ( ! $this->core->get_option( 'summary_enabled', false ) ) {
      return;
    }

    $stats  = $this->core->logs->count_by_status_since( 7 );
    $sent   = (int) ( $stats['sent'] ?? 0 );
    $failed = (int) ( $stats['failed'] ?? 0 );
    $total  = array_sum( array_map( 'intval', $stats ) );

    // Nothing happened, so there is nothing worth an email. A weekly reminder that
    // the site sent no mail is how a summary becomes something people filter out.
    if ( $total === 0 ) {
      return;
    }

    $site = $this->site_name();
    /* translators: %s: the site name. */
    $subject = sprintf( __( '[%s] Email summary for the past week', 'meow-mailer' ), $site );

    $lines = [
      /* translators: %s: the site name. */
      sprintf( __( 'Here is what %s sent over the past seven days.', 'meow-mailer' ), $site ),
      '',
      /* translators: %d: number of emails delivered. */
      sprintf( _n( '%d email sent', '%d emails sent', $sent, 'meow-mailer' ), $sent ),
      /* translators: %d: number of emails that failed. */
      sprintf( _n( '%d failed', '%d failed', $failed, 'meow-mailer' ), $failed ),
    ];

    $offline = (int) ( $stats['offline'] ?? 0 );
    if ( $offline > 0 ) {
      /* translators: %d: number of emails captured in offline mode. */
      $lines[] = sprintf( _n( '%d captured in offline mode, not delivered', '%d captured in offline mode, not delivered', $offline, 'meow-mailer' ), $offline );
    }

    $errors = $failed > 0 ? $this->core->logs->top_errors_since( 7 ) : [];
    if ( $errors ) {
      $lines[] = '';
      $lines[] = __( 'Most common errors:', 'meow-mailer' );
      foreach ( $errors as $row ) {
        $lines[] = sprintf( '%d x %s', $row['total'], $row['error'] );
      }
    }

    $lines[] = '';
    $lines[] = __( 'The full log is here:', 'meow-mailer' );
    $lines[] = admin_url( 'admin.php?page=mwmail_settings&nekoTab=logs' );
    $lines[] = '';
    $lines[] = __( 'You are getting this because the weekly summary is on in Meow Mailer. You can turn it off in its settings.', 'meow-mailer' );

    // Unlike an alert, this one goes through the provider like any other email. It
    // is not urgent, and arriving normally is itself a sign that sending works.
    $this->deliver( $subject, implode( "\n", $lines ), 'summary_email', false );
  }

  #endregion

  private function deliver( $subject, $body, $option, $unrouted ) {
    $to = $this->core->get_option( $option, '' );
    if ( empty( $to ) ) {
      $to = get_option( 'admin_email' );
    }
    if ( empty( $to ) ) {
      return;
    }

    $send = function () use ( $to, $subject, $body ) {
      wp_mail( $to, $subject, $body );
    };

    $this->sending = true;
    try {
      if ( $unrouted ) {
        $this->core->mailer->without_routing( $send );
      } else {
        $send();
      }
    } finally {
      $this->sending = false;
    }
  }

  private function site_name() {
    return wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) ?: wp_parse_url( home_url(), PHP_URL_HOST );
  }
}
