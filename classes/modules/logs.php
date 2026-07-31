<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Email log storage. All queries target the plugin's own custom table
 * ({$wpdb->prefix}mwmail_logs); table names come from $wpdb->prefix and every
 * value is passed through $wpdb->prepare(), esc_sql() or intval(). The
 * phpcs:ignore comments silence the static analyser's unavoidable false
 * positives for custom-table reads/writes that cannot be cached.
 */
class Meow_MWMAIL_Modules_Logs {

  private $core = null;
  private $wpdb = null;
  private $table = 'mwmail_logs';
  private $table_name = null;
  private $db_check = false;

  const MWMAIL_DB_LOGS_VERSION = '1.0';

  public function __construct( $core = null ) {
    global $wpdb;
    $this->wpdb       = $wpdb;
    $this->table_name = $wpdb->prefix . $this->table;
    $this->core       = $core;
  }

  #region Read

  /**
   * @param array $filters  status, provider, search, date_from, date_to
   */
  public function select( $offset = 0, $limit = 20, $filters = [], $sort = null ) {
    if ( ! $this->check_db() ) {
      throw new Exception( esc_html__( 'Could not access the database.', 'meow-mailer' ) );
    }

    $offset = max( 0, intval( $offset ) );
    $limit  = intval( $limit );
    $sort   = ! empty( $sort ) ? $sort : [ 'accessor' => 'created', 'by' => 'desc' ];

    $where = [ '1=1' ];
    if ( ! empty( $filters['status'] ) ) {
      $where[] = $this->wpdb->prepare( 'status = %s', $filters['status'] );
    }
    if ( ! empty( $filters['provider'] ) ) {
      $where[] = $this->wpdb->prepare( 'provider = %s', $filters['provider'] );
    }
    if ( ! empty( $filters['search'] ) ) {
      $like    = '%' . $this->wpdb->esc_like( $filters['search'] ) . '%';
      $where[] = $this->wpdb->prepare( '( subject LIKE %s OR email_to LIKE %s )', $like, $like );
    }
    if ( ! empty( $filters['date_from'] ) ) {
      $where[] = $this->wpdb->prepare( 'created >= %s', $filters['date_from'] );
    }
    if ( ! empty( $filters['date_to'] ) ) {
      $where[] = $this->wpdb->prepare( 'created <= %s', $filters['date_to'] );
    }
    $where_sql = implode( ' AND ', $where );

    // Whitelist the sort column/direction to avoid injection through the accessor.
    $allowed_sort = array_keys( MWMAIL_LOG_COLUMNS );
    $sort_col     = in_array( $sort['accessor'] ?? '', $allowed_sort, true ) ? $sort['accessor'] : 'created';
    $sort_dir     = strtolower( $sort['by'] ?? 'desc' ) === 'asc' ? 'ASC' : 'DESC';

    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $total = (int) $this->wpdb->get_var( "SELECT COUNT(*) FROM {$this->table_name} WHERE {$where_sql}" );

    // The list view never needs the heavy body column. Headers are read only to pull
    // the Cc / Bcc / Reply-To out of them, and dropped again before they are returned.
    $limit_sql = $limit > 0 ? $this->wpdb->prepare( ' LIMIT %d, %d', $offset, $limit ) : '';
    $query     = "SELECT id, created, email_to, email_from, subject, headers, provider, status, error, retries FROM {$this->table_name} WHERE {$where_sql} ORDER BY {$sort_col} {$sort_dir}{$limit_sql}";

    // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
    $rows = $this->wpdb->get_results( $query, ARRAY_A );
    foreach ( $rows as &$row ) {
      $row = self::with_recipients( $row );
      unset( $row['headers'] );
    }
    unset( $row );

    return [ 'total' => $total, 'data' => $rows ];
  }

  /**
   * Add the cc / bcc / reply_to of a row, read back from its stored headers. Only
   * the "To" gets a column of its own, so without this the extra recipients look
   * like they were never part of the email.
   */
  public static function with_recipients( $row ) {
    $extra = Meow_MWMAIL_Modules_Mailer::extra_recipients( json_decode( $row['headers'] ?? '', true ) );
    $row['cc']       = implode( ', ', $extra['cc'] );
    $row['bcc']      = implode( ', ', $extra['bcc'] );
    $row['reply_to'] = implode( ', ', $extra['reply_to'] );
    return $row;
  }

  public function select_one( $id ) {
    if ( ! $this->check_db() ) {
      throw new Exception( esc_html__( 'Could not access the database.', 'meow-mailer' ) );
    }
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    return $this->wpdb->get_row( $this->wpdb->prepare( "SELECT * FROM {$this->table_name} WHERE id = %d", intval( $id ) ), ARRAY_A );
  }

  public function count_by_status() {
    if ( ! $this->check_db() ) {
      return [];
    }
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $rows  = $this->wpdb->get_results( "SELECT status, COUNT(*) AS total FROM {$this->table_name} GROUP BY status", ARRAY_A );
    $stats = [];
    foreach ( $rows as $row ) {
      $stats[ $row['status'] ] = (int) $row['total'];
    }
    return $stats;
  }

  /**
   * @param int $after_id  only count failures newer than this log id (0 = all of them).
   */
  public function count_recent_failed( $hours = 24, $after_id = 0 ) {
    if ( ! $this->check_db() ) {
      return 0;
    }
    // Rows are stored in site-local time, so compute the cutoff in local time too.
    $cutoff = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - ( $hours * HOUR_IN_SECONDS ) );
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    return (int) $this->wpdb->get_var( $this->wpdb->prepare( "SELECT COUNT(*) FROM {$this->table_name} WHERE status = 'failed' AND created >= %s AND id > %d", $cutoff, max( 0, intval( $after_id ) ) ) );
  }

  /**
   * Counts per status over the last $days, for the weekly summary.
   *
   * @return array  status => count
   */
  public function count_by_status_since( $days ) {
    if ( ! $this->check_db() ) {
      return [];
    }
    $cutoff = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - ( intval( $days ) * DAY_IN_SECONDS ) );
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $rows  = $this->wpdb->get_results( $this->wpdb->prepare( "SELECT status, COUNT(*) AS total FROM {$this->table_name} WHERE created >= %s GROUP BY status", $cutoff ), ARRAY_A );
    $stats = [];
    foreach ( (array) $rows as $row ) {
      $stats[ $row['status'] ] = (int) $row['total'];
    }
    return $stats;
  }

  /**
   * The most frequent error messages over the last $days. A summary that says
   * "12 failed" without saying why is one more click before anything is learned.
   *
   * @return array  list of [ 'error' => string, 'total' => int ]
   */
  public function top_errors_since( $days, $limit = 3 ) {
    if ( ! $this->check_db() ) {
      return [];
    }
    $cutoff = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - ( intval( $days ) * DAY_IN_SECONDS ) );
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $rows = $this->wpdb->get_results( $this->wpdb->prepare(
      "SELECT error, COUNT(*) AS total FROM {$this->table_name} WHERE status = 'failed' AND created >= %s AND error <> '' GROUP BY error ORDER BY total DESC LIMIT %d",
      $cutoff,
      max( 1, intval( $limit ) )
    ), ARRAY_A );
    return array_map( function ( $row ) {
      return [ 'error' => (string) $row['error'], 'total' => (int) $row['total'] ];
    }, (array) $rows );
  }

  /**
   * One row per day for the last $days, each with its per-status counts. Days with
   * no email are filled in as zeroes: a chart that silently skips quiet days makes
   * a gap look like activity.
   *
   * @return array  list of [ 'day' => 'Y-m-d', 'sent' => int, 'failed' => int, 'offline' => int, 'pending' => int ]
   */
  public function daily_series( $days = 30 ) {
    $days  = max( 1, min( 365, intval( $days ) ) );
    $empty = [ 'sent' => 0, 'failed' => 0, 'offline' => 0, 'pending' => 0 ];

    // Build the calendar first, so the series is complete whatever the table holds.
    $series = [];
    $today  = current_time( 'timestamp' );
    for ( $i = $days - 1; $i >= 0; $i-- ) {
      $day = gmdate( 'Y-m-d', $today - ( $i * DAY_IN_SECONDS ) );
      $series[ $day ] = array_merge( [ 'day' => $day ], $empty );
    }

    if ( ! $this->check_db() ) {
      return array_values( $series );
    }

    $cutoff = gmdate( 'Y-m-d 00:00:00', $today - ( ( $days - 1 ) * DAY_IN_SECONDS ) );
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $rows = $this->wpdb->get_results( $this->wpdb->prepare(
      "SELECT DATE(created) AS day, status, COUNT(*) AS total FROM {$this->table_name} WHERE created >= %s GROUP BY day, status",
      $cutoff
    ), ARRAY_A );

    foreach ( (array) $rows as $row ) {
      $day    = (string) $row['day'];
      $status = (string) $row['status'];
      if ( isset( $series[ $day ], $empty[ $status ] ) ) {
        $series[ $day ][ $status ] = (int) $row['total'];
      }
    }
    return array_values( $series );
  }

  /** The providers that actually sent something recently, with their volume. */
  public function count_by_provider_since( $days ) {
    if ( ! $this->check_db() ) {
      return [];
    }
    $cutoff = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - ( intval( $days ) * DAY_IN_SECONDS ) );
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $rows = $this->wpdb->get_results( $this->wpdb->prepare(
      "SELECT provider, COUNT(*) AS total FROM {$this->table_name} WHERE created >= %s AND provider <> '' GROUP BY provider ORDER BY total DESC",
      $cutoff
    ), ARRAY_A );
    return array_map( function ( $row ) {
      return [ 'provider' => (string) $row['provider'], 'total' => (int) $row['total'] ];
    }, (array) $rows );
  }

  /** Highest failed log id, so the admin notice can remember what was already seen. */
  public function last_failed_id() {
    if ( ! $this->check_db() ) {
      return 0;
    }
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    return (int) $this->wpdb->get_var( "SELECT MAX(id) FROM {$this->table_name} WHERE status = 'failed'" );
  }

  #endregion

  #region Write

  public function insert( $data ) {
    if ( ! $this->check_db() ) {
      return false;
    }
    $row = [];
    foreach ( array_keys( MWMAIL_LOG_COLUMNS ) as $column ) {
      if ( $column === 'id' ) {
        continue;
      }
      if ( isset( $data[ $column ] ) ) {
        $row[ $column ] = $data[ $column ];
      }
    }
    if ( empty( $row['created'] ) ) {
      $row['created'] = current_time( 'mysql' );
    }
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $this->wpdb->insert( $this->table_name, $row );
    return $this->wpdb->insert_id;
  }

  public function update( $id, $data ) {
    if ( ! $this->check_db() ) {
      return false;
    }
    $row = [];
    foreach ( array_keys( MWMAIL_LOG_COLUMNS ) as $column ) {
      if ( $column !== 'id' && isset( $data[ $column ] ) ) {
        $row[ $column ] = $data[ $column ];
      }
    }
    if ( empty( $row ) ) {
      return false;
    }
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    return $this->wpdb->update( $this->table_name, $row, [ 'id' => intval( $id ) ] );
  }

  public function delete( $ids ) {
    if ( ! $this->check_db() ) {
      return false;
    }
    $ids = array_filter( array_map( 'intval', (array) $ids ) );
    if ( empty( $ids ) ) {
      return 0;
    }
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
    return $this->wpdb->query( $this->wpdb->prepare( "DELETE FROM {$this->table_name} WHERE id IN ({$placeholders})", $ids ) );
  }

  public function clear() {
    if ( ! $this->check_db() ) {
      return false;
    }
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
    return $this->wpdb->query( "TRUNCATE TABLE {$this->table_name}" );
  }

  public function prune( $days ) {
    if ( ! $this->check_db() ) {
      return false;
    }
    $days = intval( $days );
    if ( $days <= 0 ) {
      return 0;
    }
    $cutoff = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - ( $days * DAY_IN_SECONDS ) );
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    return $this->wpdb->query( $this->wpdb->prepare( "DELETE FROM {$this->table_name} WHERE created < %s", $cutoff ) );
  }

  #endregion

  #region Database

  public function check_db() {
    if ( $this->db_check ) {
      return true;
    }
    if ( $this->does_table_exist( $this->table_name ) ) {
      $this->check_columns();
      $this->db_check = true;
    } else {
      $this->create_db();
      $this->db_check = $this->does_table_exist( $this->table_name );
    }
    return $this->db_check;
  }

  private function create_db() {
    try {
      $charset_collate = $this->wpdb->get_charset_collate();
      $definitions     = array_map(
        function ( $name, $definition ) {
          return "$name $definition";
        },
        array_keys( MWMAIL_LOG_COLUMNS ),
        MWMAIL_LOG_COLUMNS
      );
      $definitions = implode( ",\n", $definitions )
        . ', PRIMARY KEY (id), KEY created (created), KEY status (status)';

      $sql = "CREATE TABLE {$this->table_name} ( {$definitions} ) {$charset_collate};";
      require_once ABSPATH . 'wp-admin/includes/upgrade.php';
      dbDelta( $sql );
      add_option( 'mwmail_db_logs_version', self::MWMAIL_DB_LOGS_VERSION );
    } catch ( Exception $e ) {
      if ( $this->core ) {
        $this->core->log( 'Error creating table: ' . $e->getMessage() );
      }
    }
  }

  private function check_columns() {
    $db_version = get_option( 'mwmail_db_logs_version' );
    if ( $db_version === self::MWMAIL_DB_LOGS_VERSION ) {
      return;
    }

    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $existing       = $this->wpdb->get_results( "DESCRIBE {$this->table_name}", ARRAY_A );
    $existing_names = array_column( $existing, 'Field' );

    $alter = [];
    foreach ( MWMAIL_LOG_COLUMNS as $name => $definition ) {
      if ( ! in_array( $name, $existing_names, true ) ) {
        $alter[] = "ADD COLUMN $name $definition";
      }
    }
    if ( ! empty( $alter ) ) {
      // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, PluginCheck.Security.DirectDB.UnescapedDBParameter
      $this->wpdb->query( "ALTER TABLE {$this->table_name} " . implode( ', ', $alter ) );
    }
    update_option( 'mwmail_db_logs_version', self::MWMAIL_DB_LOGS_VERSION );
  }

  private function does_table_exist( $table_name ) {
    $table_name = strtolower( $table_name );
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
    $result = $this->wpdb->get_var( $this->wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) );
    return strtolower( (string) $result ) === $table_name;
  }

  #endregion
}
