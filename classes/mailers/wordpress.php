<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Not a provider: this is WordPress sending the email the way it would if the plugin
 * were not installed. Only reachable as a fallback, and it is the one choice that
 * needs no account, no credentials and no DNS record. Deliverability is whatever the
 * server offers, which is rarely good, but it is always there — and for a password
 * reset, delivered imperfectly beats not delivered.
 *
 * It assembles the message itself rather than calling wp_mail() again. Core applies
 * the `wp_mail` filter immediately before `pre_wp_mail`, so the email we are handed
 * has already been through it; going back in would run every hooked filter a second
 * time and duplicate whatever they append (signatures, subject prefixes, extra Bcc).
 */
class Meow_MWMAIL_Mailers_Wordpress extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    try {
      $mail = $this->build_phpmailer( $email );

      // PHP's mail(), which is the transport core uses when nothing reconfigures it.
      $mail->isMail();

      // Unlike the real providers, this one honours phpmailer_init: hosts and
      // mu-plugins use it to point PHPMailer at their own relay, and that is exactly
      // what "let WordPress deal with it" is supposed to mean here.
      // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
      do_action_ref_array( 'phpmailer_init', [ &$mail ] );

      $mail->send();
      return true;
    } catch ( \PHPMailer\PHPMailer\Exception $e ) {
      return new WP_Error( 'mwmail_native_failed', $e->getMessage() );
    }
  }
}
