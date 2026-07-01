<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

spl_autoload_register( function ( $class ) {
  $file = null;
  if ( strpos( $class, 'Meow_MWMAIL_Modules_' ) !== false ) {
    $file = MWMAIL_PATH . '/classes/modules/' . str_replace( 'meow_mwmail_modules_', '', strtolower( $class ) ) . '.php';
  } else if ( strpos( $class, 'Meow_MWMAIL_Mailers_' ) !== false ) {
    $file = MWMAIL_PATH . '/classes/mailers/' . str_replace( 'meow_mwmail_mailers_', '', strtolower( $class ) ) . '.php';
  } else if ( strpos( $class, 'Meow_MWMAIL_' ) !== false ) {
    $file = MWMAIL_PATH . '/classes/' . str_replace( 'meow_mwmail_', '', strtolower( $class ) ) . '.php';
  }
  if ( $file && file_exists( $file ) ) {
    require( $file );
  }
} );
