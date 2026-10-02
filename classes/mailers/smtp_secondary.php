<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * A second SMTP server, offered only as a fallback. Two Generic SMTP servers can be
 * two different companies (an Outlook relay and the host's own server, say), so
 * unlike two accounts at one API provider, the second one is a real rescue route.
 */
class Meow_MWMAIL_Mailers_Smtp_secondary extends Meow_MWMAIL_Mailers_Smtp {
}
