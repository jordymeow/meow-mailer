<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Switches off the emails WordPress sends on its own. Every one of these uses a
 * documented core filter, so nothing here overrides a pluggable function or blocks
 * mail after the fact: WordPress simply never composes the message.
 *
 * Password resets are absent on purpose. Suppressing them locks people out of the
 * site, and no setting should be one careless click away from that.
 */
class Meow_MWMAIL_Modules_Notifications {

  /**
   * key => the core filter that decides whether the email is sent. Each filter
   * returns a boolean, so blocking one is a matter of returning false.
   */
  const FILTERS = [
    'new_user_admin'      => 'wp_send_new_user_notification_to_admin',
    'new_user'            => 'wp_send_new_user_notification_to_user',
    'password_changed'    => 'send_password_change_email',
    'email_changed'       => 'send_email_change_email',
    'admin_email_changed' => 'send_site_admin_email_change_email',
    'comment_moderation'  => 'notify_moderator',
    'comment_published'   => 'notify_post_author',
    'core_update'         => 'auto_core_update_send_email',
  ];

  public function __construct( $core ) {
    $blocked = $core->get_option( 'blocked_notifications', [] );
    if ( ! is_array( $blocked ) || empty( $blocked ) ) {
      return;
    }

    foreach ( self::FILTERS as $key => $filter ) {
      if ( in_array( $key, $blocked, true ) ) {
        // Late priority so a site that deliberately re-enables one of these with
        // its own filter still wins; this is a preference, not a policy.
        add_filter( $filter, '__return_false', 20 );
      }
    }
  }
}
