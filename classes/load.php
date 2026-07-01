<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

// Bootstrap the core as early as possible: the mailer needs to hook `pre_wp_mail`
// on every request (front-end forms, WooCommerce, cron…), not just in admin.
add_action( 'plugins_loaded', 'mwmail_loaded', 1 );

function mwmail_loaded() {
  global $mwmail_core;
  if ( ! isset( $mwmail_core ) ) {
    $mwmail_core = new Meow_MWMAIL_Core();
  }
}

// Create / upgrade the database table on activation.
register_activation_hook( MWMAIL_ENTRY, 'mwmail_activate' );

function mwmail_activate() {
  $logs = new Meow_MWMAIL_Modules_Logs();
  $logs->check_db();
}
