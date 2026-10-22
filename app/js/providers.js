// Declarative description of every supported provider and its credential fields.
// `one active at a time`: the user picks one in Settings.

import { __ } from '@app/i18n';

const SMTP_FIELDS = [
  { name: 'host', label: __('Host', 'meow-mailer'), type: 'text', placeholder: 'smtp.example.com' },
  { name: 'port', label: __('Port', 'meow-mailer'), type: 'number', placeholder: '587' },
  { name: 'encryption', label: __('Encryption', 'meow-mailer'), type: 'select', options: [
    { value: 'tls', label: __('TLS (STARTTLS)', 'meow-mailer') },
    { value: 'ssl', label: __('SSL', 'meow-mailer') },
    { value: 'none', label: __('None', 'meow-mailer') },
  ] },
  { name: 'auth', label: __('Authentication', 'meow-mailer'), type: 'switch' },
  { name: 'username', label: __('Username', 'meow-mailer'), type: 'text' },
  { name: 'password', label: __('Password', 'meow-mailer'), type: 'password' },
];

export const PROVIDERS = [
  {
    key: 'none',
    label: __('None', 'meow-mailer'),
    description: __('Meow Mailer stays out of the way. WordPress sends email as usual, and each email is still logged. Pick a provider below to take over.', 'meow-mailer'),
    fields: [],
  },
  {
    key: 'offline',
    label: __('Offline', 'meow-mailer'),
    description: __('Every email is captured in the log but never actually sent. Ideal for staging and development sites.', 'meow-mailer'),
    fields: [],
  },
  {
    key: 'smtp',
    label: __('Generic SMTP', 'meow-mailer'),
    // Named on purpose: people look for their own mail host in this list, and read
    // its absence as "not supported" even though Generic SMTP covers all of them.
    description: __('Any SMTP server: Zoho Mail, Fastmail, Infomaniak, OVH, or the one your host gave you. Works everywhere.', 'meow-mailer'),
    fields: SMTP_FIELDS,
  },
  {
    key: 'smtp_secondary',
    label: __('Generic SMTP (Second Server)', 'meow-mailer'),
    // Only ever a fallback: it is never offered as the main provider, so the picker
    // stays as it was for everyone who has one SMTP server.
    fallbackOnly: true,
    description: __('A second SMTP server, used only as the fallback.', 'meow-mailer'),
    fields: SMTP_FIELDS,
  },
  {
    key: 'mailgun',
    label: __('Mailgun', 'meow-mailer'),
    description: __('High-volume API mailer. Needs an API key and a sending domain.', 'meow-mailer'),
    fields: [
      { name: 'api_key', label: __('API Key', 'meow-mailer'), type: 'password' },
      { name: 'domain', label: __('Domain', 'meow-mailer'), type: 'text', placeholder: 'mg.example.com' },
      { name: 'region', label: __('Region', 'meow-mailer'), type: 'select', options: [
        { value: 'us', label: __('US', 'meow-mailer') },
        { value: 'eu', label: __('EU', 'meow-mailer') },
      ] },
    ],
  },
  {
    key: 'brevo',
    label: __('Brevo', 'meow-mailer'),
    description: __('Generous free tier (300 emails/day). Just an API key.', 'meow-mailer'),
    fields: [ { name: 'api_key', label: __('API Key', 'meow-mailer'), type: 'password' } ],
  },
  {
    key: 'sendgrid',
    label: __('SendGrid', 'meow-mailer'),
    description: __('Popular API mailer by Twilio.', 'meow-mailer'),
    fields: [ { name: 'api_key', label: __('API Key', 'meow-mailer'), type: 'password' } ],
  },
  {
    key: 'ses',
    label: __('Amazon SES', 'meow-mailer'),
    description: __('Cheapest at scale. Needs IAM access key, secret and region.', 'meow-mailer'),
    fields: [
      { name: 'access_key', label: __('Access Key ID', 'meow-mailer'), type: 'text' },
      { name: 'secret_key', label: __('Secret Access Key', 'meow-mailer'), type: 'password' },
      { name: 'region', label: __('Region', 'meow-mailer'), type: 'text', placeholder: 'us-east-1' },
    ],
  },
  {
    key: 'postmark',
    label: __('Postmark', 'meow-mailer'),
    description: __('Excellent deliverability for transactional email.', 'meow-mailer'),
    fields: [
      { name: 'server_token', label: __('Server Token', 'meow-mailer'), type: 'password' },
      { name: 'message_stream', label: __('Message Stream', 'meow-mailer'), type: 'text', placeholder: 'outbound' },
    ],
  },
  {
    key: 'smtp2go',
    label: __('SMTP2GO', 'meow-mailer'),
    description: __('Reliable API mailer with a free tier.', 'meow-mailer'),
    fields: [ { name: 'api_key', label: __('API Key', 'meow-mailer'), type: 'password' } ],
  },
  {
    key: 'mailjet',
    label: __('Mailjet', 'meow-mailer'),
    description: __('API key and secret key from your Mailjet account.', 'meow-mailer'),
    fields: [
      { name: 'api_key', label: __('API Key', 'meow-mailer'), type: 'text' },
      { name: 'secret_key', label: __('Secret Key', 'meow-mailer'), type: 'password' },
    ],
  },
  {
    key: 'resend',
    label: __('Resend', 'meow-mailer'),
    description: __('Developer-friendly modern API mailer.', 'meow-mailer'),
    fields: [ { name: 'api_key', label: __('API Key', 'meow-mailer'), type: 'password' } ],
  },
  {
    key: 'mailersend',
    label: __('MailerSend', 'meow-mailer'),
    description: __('Modern API mailer with a free tier.', 'meow-mailer'),
    fields: [ { name: 'api_key', label: __('API Key', 'meow-mailer'), type: 'password' } ],
  },
  {
    key: 'maileroo',
    label: __('Maileroo', 'meow-mailer'),
    description: __('European (GDPR) API mailer with a free tier. Create a Sending Key for your domain in the Maileroo dashboard.', 'meow-mailer'),
    fields: [ { name: 'api_key', label: __('Sending Key', 'meow-mailer'), type: 'password' } ],
  },
  {
    key: 'gmail',
    label: __('Gmail / Google Workspace', 'meow-mailer'),
    description: __('Send via your Google account using OAuth 2.0 (no password stored).', 'meow-mailer'),
    oauth: 'gmail',
    oauthLabel: __('Connect with Google', 'meow-mailer'),
    oauthHelp: __('Create an OAuth Client (Web application) in Google Cloud Console, add the redirect URI below, then paste the Client ID and Secret above and Save before connecting:', 'meow-mailer'),
    fields: [
      { name: 'client_id', label: __('Client ID', 'meow-mailer'), type: 'text' },
      { name: 'client_secret', label: __('Client Secret', 'meow-mailer'), type: 'password' },
    ],
  },
  {
    key: 'outlook',
    label: __('Microsoft 365 / Outlook', 'meow-mailer'),
    description: __('Send via your Microsoft 365 or Outlook account using OAuth 2.0 (no password stored). Emails are sent from the connected mailbox.', 'meow-mailer'),
    oauth: 'outlook',
    oauthLabel: __('Connect with Microsoft', 'meow-mailer'),
    oauthHelp: __('Register an app in Azure Portal → App registrations, add the redirect URI below, grant the Microsoft Graph "Mail.Send" delegated permission, create a client secret, then paste the Client ID and Secret above and Save before connecting:', 'meow-mailer'),
    fields: [
      { name: 'client_id', label: __('Client ID', 'meow-mailer'), type: 'text' },
      { name: 'client_secret', label: __('Client Secret', 'meow-mailer'), type: 'password' },
      { name: 'tenant', label: __('Tenant', 'meow-mailer'), type: 'text', placeholder: 'common' },
    ],
  },
  {
    // The same Graph API as above, but the app authenticates as itself (client
    // credentials), so agencies can set it up without the client ever signing in.
    key: 'microsoft',
    label: __('Microsoft 365 (App-only)', 'meow-mailer'),
    description: __('Send through Microsoft 365 with an Entra app registration and application permissions. Nobody signs in: the app authenticates with a certificate or a client secret.', 'meow-mailer'),
    help: __('In Entra ID → App registrations, add the Microsoft Graph "Mail.Send" application permission and grant admin consent, then upload a certificate or create a client secret. The mailbox can be a shared mailbox, which needs no license. Mail.Send lets the app send as any mailbox in your tenant, so limit it to this one with an Application Access Policy.', 'meow-mailer'),
    fields: [
      { name: 'tenant', label: __('Tenant ID', 'meow-mailer'), type: 'text', placeholder: 'Directory ID or contoso.onmicrosoft.com' },
      { name: 'client_id', label: __('Client ID', 'meow-mailer'), type: 'text' },
      { name: 'auth', label: __('Authentication', 'meow-mailer'), type: 'select', options: [
        { value: 'certificate', label: __('Certificate', 'meow-mailer') },
        { value: 'secret', label: __('Client Secret', 'meow-mailer') },
      ] },
      { name: 'certificate', label: __('Certificate', 'meow-mailer'), type: 'pem', placeholder: '-----BEGIN CERTIFICATE-----',
        description: __('The certificate and its private key, both in PEM format, pasted together. From a .pfx file: openssl pkcs12 -in cert.pfx -out cert.pem -nodes', 'meow-mailer'),
        showIf: (creds) => creds.auth !== 'secret' },
      { name: 'client_secret', label: __('Client Secret', 'meow-mailer'), type: 'password', showIf: (creds) => creds.auth === 'secret' },
      { name: 'mailbox', label: __('Send From', 'meow-mailer'), type: 'text', placeholder: 'website@example.com' },
    ],
  },
  {
    key: 'zoho',
    label: __('Zoho Mail', 'meow-mailer'),
    description: __('Send via your Zoho Mail account using OAuth 2.0 (no password stored). Emails are sent from the connected mailbox.', 'meow-mailer'),
    oauth: 'zoho',
    oauthLabel: __('Connect with Zoho', 'meow-mailer'),
    oauthHelp: __('Create a Server-based Application in the Zoho API Console, add the redirect URI below, then paste the Client ID and Secret above, pick your data center and Save before connecting:', 'meow-mailer'),
    // The console lives on the account's own data center, so the link has to follow
    // the choice made above or it lands EU and Indian accounts in the wrong place.
    oauthConsole: (creds) => `https://api-console.${(creds || {}).datacenter || 'zoho.com'}/`,
    fields: [
      { name: 'client_id', label: __('Client ID', 'meow-mailer'), type: 'text' },
      { name: 'client_secret', label: __('Client Secret', 'meow-mailer'), type: 'password' },
      // Zoho regions hold their data separately, so the wrong one fails to connect
      // rather than falling back. It has to match where the account was created.
      { name: 'datacenter', label: __('Data Center', 'meow-mailer'), type: 'select', options: [
        { value: 'zoho.com', label: __('zoho.com (US)', 'meow-mailer') },
        { value: 'zoho.eu', label: __('zoho.eu (Europe)', 'meow-mailer') },
        { value: 'zoho.in', label: __('zoho.in (India)', 'meow-mailer') },
        { value: 'zoho.com.au', label: __('zoho.com.au (Australia)', 'meow-mailer') },
        { value: 'zoho.jp', label: __('zoho.jp (Japan)', 'meow-mailer') },
        { value: 'zoho.com.cn', label: __('zoho.com.cn (China)', 'meow-mailer') },
        { value: 'zohocloud.ca', label: __('zohocloud.ca (Canada)', 'meow-mailer') },
      ] },
    ],
  },
  {
    key: 'zeptomail',
    label: __('ZeptoMail (Zoho CPaaS)', 'meow-mailer'),
    // Not Zoho Mail: people with a Zoho account look for "Zoho" and pick the mailbox
    // one, then hit its Reply-To limits. Saying which is which saves that detour.
    description: __('Zoho\'s transactional email service, now part of Zoho CPaaS. Connects with a Send Mail token, no OAuth. For a regular Zoho mailbox, pick Zoho Mail instead.', 'meow-mailer'),
    fields: [
      { name: 'api_key', label: __('Send Mail Token', 'meow-mailer'), type: 'password' },
      { name: 'region', label: __('Data Center', 'meow-mailer'), type: 'select', options: [
        { value: 'com', label: __('zeptomail.com (US)', 'meow-mailer') },
        { value: 'eu', label: __('zeptomail.eu (Europe)', 'meow-mailer') },
        { value: 'in', label: __('zeptomail.in (India)', 'meow-mailer') },
        { value: 'com.au', label: __('zeptomail.com.au (Australia)', 'meow-mailer') },
        { value: 'jp', label: __('zeptomail.jp (Japan)', 'meow-mailer') },
        { value: 'com.cn', label: __('zeptomail.com.cn (China)', 'meow-mailer') },
        { value: 'ca', label: __('zeptomail.ca (Canada)', 'meow-mailer') },
      ] },
    ],
  },
];

export const PROVIDER_LABELS = PROVIDERS.reduce((acc, p) => {
  acc[p.key] = p.label;
  return acc;
}, {
  // Not a provider you can pick: it is what the log records when no provider is
  // set and WordPress sent the email on its own.
  wordpress: 'WordPress',
});

export const getProvider = (key) => PROVIDERS.find((p) => p.key === key);

// What can be picked as the main provider.
export const MAIN_PROVIDERS = PROVIDERS.filter((p) => !p.fallbackOnly);

// What can stand in when the main provider fails. 'offline' is excluded (it does not
// send), and so is whichever provider is already active: retrying the one that just
// refused only costs another round trip. 'wordpress' is the zero-setup choice.
export const fallbackChoices = (activeKey) => [
  { key: 'none', label: __('No fallback', 'meow-mailer') },
  { key: 'wordpress', label: __('WordPress (server mail)', 'meow-mailer') },
  ...PROVIDERS.filter((p) => !['none', 'offline', activeKey].includes(p.key))
    .map((p) => ({ key: p.key, label: p.label })),
];

// The fields of a provider that a wp-config.php constant is in charge of. Only their
// names reach the browser, so they read as empty here while they are in fact set.
export const constantFields = (key) => ((window.mwmail || {}).constants || {})[key] || [];

// The name of the constant that sets a field, as the user would write it in wp-config.php.
export const constantName = (key, field) => `MWMAIL_${key.toUpperCase()}_${field.toUpperCase()}`;

// Whether the active provider has the credentials it needs to send.
export const isProviderConfigured = (key, creds = {}) => {
  if (key === 'none' || key === 'offline') {
    return true; // no credentials needed
  }
  const fromConfig = constantFields(key);
  if (!creds && fromConfig.length === 0) {
    return false;
  }
  creds = { ...(creds || {}) };
  fromConfig.forEach((field) => { creds[field] = creds[field] || true; });
  switch (key) {
    case 'smtp':
    case 'smtp_secondary': return !!creds.host;
    // The OAuth providers hold no api_key, so they need to be named here or they
    // read as unconfigured however well they are connected.
    case 'gmail':
    case 'outlook':
    case 'zoho':     return !!creds.refresh_token;
    case 'microsoft':
      return !!creds.tenant && !!creds.client_id && !!creds.mailbox
        && !!(creds.auth === 'secret' ? creds.client_secret : creds.certificate);
    case 'mailgun':  return !!creds.api_key && !!creds.domain;
    case 'ses':      return !!creds.access_key && !!creds.secret_key;
    case 'postmark': return !!creds.server_token;
    case 'mailjet':  return !!creds.api_key && !!creds.secret_key;
    default:         return !!creds.api_key;
  }
};
