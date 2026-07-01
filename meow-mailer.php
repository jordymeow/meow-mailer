<?php
/*
Plugin Name: Meow Mailer
Description: Simple, reliable SMTP & email provider connector for WordPress, with a beautiful email log, offline mode, and one-click resend. Pick one provider, set it up once, and stop worrying about deliverability.
Version: 0.1.1
Author: Jordy Meow
Author URI: https://meowapps.com
Text Domain: meow-mailer
Domain Path: /languages
Requires at least: 6.5
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Dual licensed under the MIT and GPL licenses:
http://www.opensource.org/licenses/mit-license.php
http://www.gnu.org/licenses/gpl.html
*/

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'MWMAIL_VERSION', '0.1.1' );
define( 'MWMAIL_PREFIX', 'mwmail' );
define( 'MWMAIL_DOMAIN', 'meow-mailer' );
define( 'MWMAIL_ENTRY', __FILE__ );
define( 'MWMAIL_PATH', dirname( __FILE__ ) );
define( 'MWMAIL_URL', plugin_dir_url( __FILE__ ) );

/**
 * Database schema for the email logs.
 *
 * ⚠️ Bump MWMAIL_DB_LOGS_VERSION (in classes/modules/logs.php) when you change this.
 */
define( 'MWMAIL_LOG_COLUMNS', [
  'id'          => 'BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT',
  'created'     => 'DATETIME NOT NULL',
  'email_to'    => 'TEXT NOT NULL',
  'email_from'  => "VARCHAR(255) NOT NULL DEFAULT ''",
  'subject'     => 'TEXT NOT NULL',
  'headers'     => 'LONGTEXT NOT NULL',
  'body'        => 'LONGTEXT NOT NULL',
  'attachments' => 'TEXT NOT NULL',
  'provider'    => "VARCHAR(50) NOT NULL DEFAULT ''",
  'status'      => "VARCHAR(20) NOT NULL DEFAULT ''",
  'error'       => 'TEXT NOT NULL',
  'retries'     => 'SMALLINT(6) NOT NULL DEFAULT 0',
] );

require_once( MWMAIL_PATH . '/classes/init.php' );
require_once( MWMAIL_PATH . '/classes/load.php' );
