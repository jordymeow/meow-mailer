<?php
// Uninstall Meow Mailer: remove options and the logs table.

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
  exit;
}

global $wpdb;

delete_option( 'mwmail_options' );
delete_option( 'mwmail_db_logs_version' );
delete_option( 'mwmail_failures_seen' );
delete_option( 'mwmail_last_alert' );
delete_option( 'mwmail_last_rescue_alert' );

// Multisite: the shared configuration and its flag live at network level.
if ( is_multisite() ) {
  delete_site_option( 'mwmail_options' );
  delete_site_option( 'mwmail_network' );
}

$mwmail_table = $wpdb->prefix . 'mwmail_logs';
// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, PluginCheck.Security.DirectDB.UnescapedDBParameter
$wpdb->query( "DROP TABLE IF EXISTS {$mwmail_table}" );

wp_clear_scheduled_hook( 'mwmail_prune_logs' );
wp_clear_scheduled_hook( 'mwmail_weekly_summary' );
