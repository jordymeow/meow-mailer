<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Meow_MWMAIL_Mailers_Smtp extends Meow_MWMAIL_Mailers_Base {

  public function send( $email ) {
    $host = $this->opt( 'host' );
    if ( empty( $host ) ) {
      return new WP_Error( 'mwmail_smtp_config', __( 'SMTP host is not configured.', 'meow-mailer' ) );
    }

    try {
      $mail = $this->build_phpmailer( $email );
      $mail->isSMTP();
      $mail->Host       = $host;
      $mail->Port       = intval( $this->opt( 'port', 587 ) );
      $mail->SMTPAuth   = ! empty( $this->opt( 'auth', true ) );
      $mail->SMTPAutoTLS = ! empty( $this->opt( 'autotls', true ) );

      $encryption = $this->opt( 'encryption', 'tls' );
      if ( $encryption === 'tls' ) {
        $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
      } elseif ( $encryption === 'ssl' ) {
        $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
      } else {
        $mail->SMTPSecure = '';
        $mail->SMTPAutoTLS = false;
      }

      if ( $mail->SMTPAuth ) {
        $mail->Username = $this->opt( 'username' );
        $mail->Password = $this->opt( 'password' );
      }

      $mail->send();
      return true;
    } catch ( \PHPMailer\PHPMailer\Exception $e ) {
      return new WP_Error( 'mwmail_smtp_failed', $e->getMessage() );
    }
  }
}
