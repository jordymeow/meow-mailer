<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * ZeptoMail, Zoho's transactional email service (now part of Zoho CPaaS). Not the
 * same product as Zoho Mail: it is built for sending rather than being a mailbox,
 * and it authenticates with a Send Mail token instead of OAuth.
 */
class Meow_MWMAIL_Mailers_Zeptomail extends Meow_MWMAIL_Mailers_Base {

  /** Each data center has its own host, and a token only works on its own. */
  const HOSTS = [
    'com'    => 'api.zeptomail.com',
    'eu'     => 'api.zeptomail.eu',
    'in'     => 'api.zeptomail.in',
    'com.au' => 'api.zeptomail.com.au',
    'jp'     => 'api.zeptomail.jp',
    'ca'     => 'api.zeptomail.ca',
    'com.cn' => 'api.zeptomail.com.cn',
  ];

  public function send( $email ) {
    // The dashboard shows the token with its scheme in front, and that is what most
    // people paste. Accept it either way rather than sending the scheme twice.
    $token = trim( preg_replace( '/^Zoho-enczapikey\s+/i', '', trim( (string) $this->opt( 'api_key' ) ) ) );
    if ( $token === '' ) {
      return new WP_Error( 'mwmail_zeptomail_config', __( 'ZeptoMail Send Mail token is required.', 'meow-mailer' ) );
    }
    $host = self::HOSTS[ $this->opt( 'region', 'com' ) ] ?? self::HOSTS['com'];

    $from = [ 'address' => $email['from_email'] ];
    if ( ! empty( $email['from_name'] ) ) {
      $from['name'] = $email['from_name'];
    }
    $payload = [
      'from'    => $from,
      'to'      => $this->zepto_recipients( $email['to'] ),
      'subject' => $email['subject'],
    ];
    if ( $email['cc'] ) {
      $payload['cc'] = $this->zepto_recipients( $email['cc'] );
    }
    if ( $email['bcc'] ) {
      $payload['bcc'] = $this->zepto_recipients( $email['bcc'] );
    }
    if ( $email['reply_to'] ) {
      $payload['reply_to'] = array_map( function ( $r ) {
        return $r['email_address'];
      }, $this->zepto_recipients( $email['reply_to'] ) );
    }
    if ( $this->is_html( $email ) ) {
      $payload['htmlbody'] = $email['message'];
    } else {
      $payload['textbody'] = $email['message'];
    }

    foreach ( $this->attachments_base64( $email ) as $f ) {
      $item = [ 'name' => $f['filename'], 'content' => $f['content'], 'mime_type' => $f['type'] ];
      if ( $f['inline'] ) {
        $item['cid'] = $f['cid'];
        $payload['inline_images'][] = $item;
      } else {
        $payload['attachments'][] = $item;
      }
    }

    $result = $this->http_post( 'https://' . $host . '/v1.1/email', [
      'timeout' => 30,
      'headers' => [
        'Authorization' => 'Zoho-enczapikey ' . $token,
        'Content-Type'  => 'application/json',
        'Accept'        => 'application/json',
      ],
      'body'    => wp_json_encode( $payload ),
    ] );

    return is_wp_error( $result ) ? $result : true;
  }

  /** [ { email_address: { address, name } } ], the shape ZeptoMail wants for every list. */
  private function zepto_recipients( $list ) {
    return array_map( function ( $r ) {
      $addr = [ 'address' => $r['email'] ];
      if ( isset( $r['name'] ) ) {
        $addr['name'] = $r['name'];
      }
      return [ 'email_address' => $addr ];
    }, $this->recipients( $list ) );
  }
}
