<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Compatibility with plugins that build part of the email inside `phpmailer_init`.
 *
 * WordPress fires that action on the PHPMailer object it is about to send with, and
 * plugins use it to attach a file they just generated (an invoice PDF held in memory
 * is the common one), or to add a recipient or a header. We take over from `wp_mail`
 * before that object exists, so the hook never ran and everything it would have
 * added was dropped in silence: the email went out looking perfectly fine, without
 * the invoice, and nothing said so.
 *
 * So we build the message those plugins expect, fire the action on it, and take back
 * what they added. It happens once, before a provider is chosen, which is what makes
 * the same attachment go out whether the primary provider sends it or the fallback
 * steps in.
 *
 * Only what belongs to the message is imported. Transport settings (isSMTP, Host,
 * credentials) are ignored on purpose: the provider owns delivery, and a host's
 * mu-plugin pointing PHPMailer at its own relay must not quietly take over the
 * account the site configured here.
 *
 * It is also additive on purpose. What a hook adds is imported, what it removes is
 * not: a plugin clearing the recipients in there, to cancel a send or to reroute it
 * elsewhere, does not get its way, because the message has already been built with
 * the recipients wp_mail() was called with. Rerouting belongs in a setting people
 * can see, not in a side effect of someone else's hook.
 */
class Meow_MWMAIL_Modules_Phpmailer {

  private $core = null;

  // A plugin calling wp_mail() from inside its own phpmailer_init hook would come
  // straight back in here. One level is all anyone needs.
  private $collecting = false;

  public function __construct( $core ) {
    $this->core = $core;
  }

  /**
   * Run `phpmailer_init` on a stand-in message and merge whatever plugins added
   * into the normalized email. Always returns a usable email: a plugin misbehaving
   * in its own hook must not cost the site the message itself.
   */
  public function collect( $email ) {
    $email['phpmailer_init_done'] = true;

    /**
     * Whether to run `phpmailer_init` for this email. On by default: a plugin that
     * attaches an invoice this way has no other way in, and losing it silently is
     * never what anyone wanted. Return false to keep the hook out of the way.
     *
     * @param bool  $run
     * @param array $email  the normalized email
     */
    if ( ! apply_filters( 'mwmail_run_phpmailer_init', true, $email ) ) {
      return $email;
    }
    // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
    if ( $this->collecting || ! has_action( 'phpmailer_init' ) ) {
      // Nothing listening: no message to build, and no PDF generated for nothing.
      return $email;
    }

    $this->collecting = true;
    try {
      $mail   = Meow_MWMAIL_Mailers_Base::new_phpmailer( $this->core, $email );
      $before = $this->snapshot( $mail );

      // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WordPress hook
      do_action_ref_array( 'phpmailer_init', [ &$mail ] );

      $email = $this->import( $email, $mail, $before );
    } catch ( Throwable $e ) {
      $this->core->log( 'phpmailer_init compatibility skipped: ' . $e->getMessage() );
    } finally {
      $this->collecting = false;
    }

    return $email;
  }

  /** What the message looked like before the hook ran, so we can tell what is new. */
  private function snapshot( $mail ) {
    return [
      'attachments'  => $mail->getAttachments(),
      'cc'           => $mail->getCcAddresses(),
      'bcc'          => $mail->getBccAddresses(),
      'reply_to'     => $mail->getReplyToAddresses(),
      'headers'      => $mail->getCustomHeaders(),
      'subject'      => $mail->Subject,
      'body'         => $mail->Body,
      'content_type' => $mail->ContentType,
      'sender'       => $mail->Sender,
    ];
  }

  private function import( $email, $mail, $before ) {
    $email = $this->import_files( $email, $before['attachments'], $mail->getAttachments() );
    $email = $this->import_addresses( $email, 'cc', $before['cc'], $mail->getCcAddresses() );
    $email = $this->import_addresses( $email, 'bcc', $before['bcc'], $mail->getBccAddresses() );
    $email = $this->import_addresses( $email, 'reply_to', $before['reply_to'], $mail->getReplyToAddresses() );

    foreach ( $mail->getCustomHeaders() as $header ) {
      if ( ! in_array( $header, $before['headers'], true ) && ! empty( $header[0] ) ) {
        $email['custom_headers'][ $header[0] ] = $header[1] ?? '';
      }
    }

    // Only what the hook actually changed, so nothing is rewritten with a value the
    // providers normalize differently anyway.
    if ( $mail->Subject !== $before['subject'] ) {
      $email['subject'] = $mail->Subject;
    }
    if ( $mail->Body !== $before['body'] ) {
      $email['message'] = $mail->Body;
    }
    if ( $mail->ContentType !== $before['content_type'] && $mail->ContentType !== '' ) {
      $email['content_type'] = $mail->ContentType;
    }
    // The envelope sender, which is what anyone setting a bounce address through
    // PHPMailer was reaching for. The Return Path setting and the mwmail_return_path
    // filter still have the last word, since both run when the message is built.
    if ( $mail->Sender !== $before['sender'] && is_email( $mail->Sender ) ) {
      $email['return_path'] = $mail->Sender;
    }

    return $email;
  }

  /**
   * Files the hook added, as entries the mailers can send. A PHPMailer attachment is
   * either bytes or a path, and which one it is decides everything downstream: bytes
   * handed to something expecting a file name is how a generated PDF ends up lost.
   */
  private function import_files( $email, $before, $after ) {
    foreach ( $after as $entry ) {
      // Compared by value, not by position, so a hook that reorders or re-adds the
      // files wp_mail() already carried does not get them attached twice.
      if ( in_array( $entry, $before, true ) || ! is_array( $entry ) ) {
        continue;
      }

      $in_memory = ! empty( $entry[5] );
      $name      = (string) ( $entry[2] ?? '' );
      if ( $name === '' ) {
        $name = (string) ( $entry[1] ?? '' );
      }
      $cid    = (string) ( $entry[7] ?? '' );
      $inline = ( $entry[6] ?? 'attachment' ) === 'inline' && $cid !== '';

      $email['extra_attachments'][] = [
        'name'    => $name,
        'content' => $in_memory ? (string) $entry[0] : null,
        'path'    => $in_memory ? null : (string) $entry[0],
        'type'    => (string) ( $entry[4] ?? '' ),
        'inline'  => $inline,
        'cid'     => $inline ? $cid : '',
      ];
    }
    return $email;
  }

  /** Recipients the hook added, in the "Name <email>" shape every provider reads. */
  private function import_addresses( $email, $key, $before, $after ) {
    $known = [];
    foreach ( (array) $before as $pair ) {
      $known[ strtolower( (string) ( $pair[0] ?? '' ) ) ] = true;
    }
    foreach ( (array) $after as $pair ) {
      $address = (string) ( $pair[0] ?? '' );
      if ( $address === '' || isset( $known[ strtolower( $address ) ] ) ) {
        continue;
      }
      $name = (string) ( $pair[1] ?? '' );
      $email[ $key ][] = $name !== '' ? $name . ' <' . $address . '>' : $address;
    }
    return $email;
  }
}
