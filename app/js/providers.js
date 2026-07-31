// Declarative description of every supported provider and its credential fields.
// `one active at a time`: the user picks one in Settings.

export const PROVIDERS = [
  {
    key: 'none',
    label: 'None',
    description: 'Meow Mailer stays out of the way. WordPress sends email as usual and nothing is logged. Pick a provider below to take over.',
    fields: [],
  },
  {
    key: 'offline',
    label: 'Offline',
    description: 'Every email is captured in the log but never actually sent. Ideal for staging and development sites.',
    fields: [],
  },
  {
    key: 'smtp',
    label: 'Generic SMTP',
    // Named on purpose: people look for their own mail host in this list, and read
    // its absence as "not supported" even though Generic SMTP covers all of them.
    description: 'Any SMTP server — Zoho Mail, Fastmail, Infomaniak, OVH, or the one your host gave you. Works everywhere.',
    fields: [
      { name: 'host', label: 'Host', type: 'text', placeholder: 'smtp.example.com' },
      { name: 'port', label: 'Port', type: 'number', placeholder: '587' },
      { name: 'encryption', label: 'Encryption', type: 'select', options: [
        { value: 'tls', label: 'TLS (STARTTLS)' },
        { value: 'ssl', label: 'SSL' },
        { value: 'none', label: 'None' },
      ] },
      { name: 'auth', label: 'Authentication', type: 'switch' },
      { name: 'username', label: 'Username', type: 'text' },
      { name: 'password', label: 'Password', type: 'password' },
    ],
  },
  {
    key: 'mailgun',
    label: 'Mailgun',
    description: 'High-volume API mailer. Needs an API key and a sending domain.',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password' },
      { name: 'domain', label: 'Domain', type: 'text', placeholder: 'mg.example.com' },
      { name: 'region', label: 'Region', type: 'select', options: [
        { value: 'us', label: 'US' },
        { value: 'eu', label: 'EU' },
      ] },
    ],
  },
  {
    key: 'brevo',
    label: 'Brevo',
    description: 'Generous free tier (300 emails/day). Just an API key.',
    fields: [ { name: 'api_key', label: 'API Key', type: 'password' } ],
  },
  {
    key: 'sendgrid',
    label: 'SendGrid',
    description: 'Popular API mailer by Twilio.',
    fields: [ { name: 'api_key', label: 'API Key', type: 'password' } ],
  },
  {
    key: 'ses',
    label: 'Amazon SES',
    description: 'Cheapest at scale. Needs IAM access key, secret and region.',
    fields: [
      { name: 'access_key', label: 'Access Key ID', type: 'text' },
      { name: 'secret_key', label: 'Secret Access Key', type: 'password' },
      { name: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
    ],
  },
  {
    key: 'postmark',
    label: 'Postmark',
    description: 'Excellent deliverability for transactional email.',
    fields: [
      { name: 'server_token', label: 'Server Token', type: 'password' },
      { name: 'message_stream', label: 'Message Stream', type: 'text', placeholder: 'outbound' },
    ],
  },
  {
    key: 'smtp2go',
    label: 'SMTP2GO',
    description: 'Reliable API mailer with a free tier.',
    fields: [ { name: 'api_key', label: 'API Key', type: 'password' } ],
  },
  {
    key: 'mailjet',
    label: 'Mailjet',
    description: 'API key and secret key from your Mailjet account.',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'text' },
      { name: 'secret_key', label: 'Secret Key', type: 'password' },
    ],
  },
  {
    key: 'resend',
    label: 'Resend',
    description: 'Developer-friendly modern API mailer.',
    fields: [ { name: 'api_key', label: 'API Key', type: 'password' } ],
  },
  {
    key: 'mailersend',
    label: 'MailerSend',
    description: 'Modern API mailer with a free tier.',
    fields: [ { name: 'api_key', label: 'API Key', type: 'password' } ],
  },
  {
    key: 'maileroo',
    label: 'Maileroo',
    description: 'European (GDPR) API mailer with a free tier. Create a Sending Key for your domain in the Maileroo dashboard.',
    fields: [ { name: 'api_key', label: 'Sending Key', type: 'password' } ],
  },
  {
    key: 'gmail',
    label: 'Gmail / Google Workspace',
    description: 'Send via your Google account using OAuth 2.0 (no password stored).',
    oauth: 'gmail',
    oauthLabel: 'Connect with Google',
    oauthHelp: 'Create an OAuth Client (Web application) in Google Cloud Console, add the redirect URI below, then paste the Client ID and Secret above and Save before connecting:',
    fields: [
      { name: 'client_id', label: 'Client ID', type: 'text' },
      { name: 'client_secret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    key: 'outlook',
    label: 'Microsoft 365 / Outlook',
    description: 'Send via your Microsoft 365 or Outlook account using OAuth 2.0 (no password stored). Emails are sent from the connected mailbox.',
    oauth: 'outlook',
    oauthLabel: 'Connect with Microsoft',
    oauthHelp: 'Register an app in Azure Portal → App registrations, add the redirect URI below, grant the Microsoft Graph "Mail.Send" delegated permission, create a client secret, then paste the Client ID and Secret above and Save before connecting:',
    fields: [
      { name: 'client_id', label: 'Client ID', type: 'text' },
      { name: 'client_secret', label: 'Client Secret', type: 'password' },
      { name: 'tenant', label: 'Tenant', type: 'text', placeholder: 'common' },
    ],
  },
  {
    key: 'zoho',
    label: 'Zoho Mail',
    description: 'Send via your Zoho Mail account using OAuth 2.0 (no password stored). Emails are sent from the connected mailbox.',
    oauth: 'zoho',
    oauthLabel: 'Connect with Zoho',
    oauthHelp: 'Create a Server-based Application in the Zoho API Console, add the redirect URI below, then paste the Client ID and Secret above, pick your data center and Save before connecting:',
    // The console lives on the account's own data center, so the link has to follow
    // the choice made above or it lands EU and Indian accounts in the wrong place.
    oauthConsole: (creds) => `https://api-console.${(creds || {}).datacenter || 'zoho.com'}/`,
    fields: [
      { name: 'client_id', label: 'Client ID', type: 'text' },
      { name: 'client_secret', label: 'Client Secret', type: 'password' },
      // Zoho regions hold their data separately, so the wrong one fails to connect
      // rather than falling back. It has to match where the account was created.
      { name: 'datacenter', label: 'Data Center', type: 'select', options: [
        { value: 'zoho.com', label: 'zoho.com (US)' },
        { value: 'zoho.eu', label: 'zoho.eu (Europe)' },
        { value: 'zoho.in', label: 'zoho.in (India)' },
        { value: 'zoho.com.au', label: 'zoho.com.au (Australia)' },
        { value: 'zoho.jp', label: 'zoho.jp (Japan)' },
        { value: 'zoho.com.cn', label: 'zoho.com.cn (China)' },
        { value: 'zohocloud.ca', label: 'zohocloud.ca (Canada)' },
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

// Whether the active provider has the credentials it needs to send.
export const isProviderConfigured = (key, creds = {}) => {
  if (key === 'none' || key === 'offline') {
    return true; // no credentials needed
  }
  if (!creds) {
    return false;
  }
  switch (key) {
    case 'smtp':     return !!creds.host;
    // The OAuth providers hold no api_key, so they need to be named here or they
    // read as unconfigured however well they are connected.
    case 'gmail':
    case 'outlook':
    case 'zoho':     return !!creds.refresh_token;
    case 'mailgun':  return !!creds.api_key && !!creds.domain;
    case 'ses':      return !!creds.access_key && !!creds.secret_key;
    case 'postmark': return !!creds.server_token;
    case 'mailjet':  return !!creds.api_key && !!creds.secret_key;
    default:         return !!creds.api_key;
  }
};
