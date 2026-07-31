import { NekoModal } from '@neko-ui';

import { t } from '@app/i18n';

/**
 * What a failure actually means, in words the person reading it can act on.
 *
 * Providers answer with their own wording, and most of it is written for whoever
 * built the API rather than for the site owner whose contact form stopped working.
 * "HTTP 500 - Internal Error" is a fact, not an explanation. Each entry below turns
 * one recognisable failure into a cause and something to do about it.
 *
 * The raw message is always shown underneath, because these are patterns and a
 * pattern can be wrong. Nothing here hides what the provider actually said.
 */
const EXPLANATIONS = [
  {
    match: /verify the replyto|reply.?to address/i,
    title: 'The Reply-To address was refused',
    body: 'Zoho Mail only accepts a Reply-To that belongs to your own account. Contact forms normally put the visitor address there, which Zoho rejects, and it refuses the whole email rather than ignoring the header.',
    fix: 'Recent versions leave that header out automatically when the address is not yours, so the email is delivered. If this is an old entry, no action is needed.',
  },
  {
    match: /5\.7\.\d|not permitted|relay access denied|sender address rejected|not allowed to send/i,
    title: 'The server refused your sender address',
    body: 'The mail server will not send from the From address configured here, usually because the address or its domain does not belong to the account you authenticated with.',
    fix: 'Set From Email to an address on the account you are sending through, and turn on Force From so another plugin cannot replace it.',
  },
  {
    match: /5\.1\.1|mailbox unavailable|recipient address rejected|user unknown|does not exist/i,
    title: 'The recipient address does not exist',
    body: 'The receiving server says there is no such mailbox. This is about the destination address, not your configuration.',
    fix: 'Check the address for a typo. If it came from a form, the person who filled it in probably mistyped their own address.',
  },
  {
    match: /535|authentication failed|invalid login|username and password not accepted|auth.*credential/i,
    title: 'The mail server rejected your credentials',
    body: 'The username or password was not accepted. With Gmail and Outlook this usually means a normal account password was used where an app password or OAuth is required.',
    fix: 'Re-enter the password in the Settings. If your host requires an app-specific password, generate one and use it here.',
  },
  {
    match: /\b401\b|\b403\b|unauthorized|forbidden|invalid api key|api key.*invalid/i,
    title: 'The provider rejected your API key',
    body: 'The key was refused. Keys are commonly revoked, restricted to certain domains, or copied with a missing character at the end.',
    fix: 'Generate a fresh key in the provider dashboard and paste it again, making sure nothing is cut off.',
  },
  {
    match: /\b429\b|rate limit|too many requests|quota/i,
    title: 'You have hit the provider limit',
    body: 'The provider is refusing further email for now, either because a sending quota is exhausted or because too many were sent too quickly.',
    fix: 'Wait for the limit to reset, then resend from the log. If it keeps happening, your plan may be too small for the volume this site sends.',
  },
  {
    match: /domain.*not verified|unverified|verify your domain|sender.*not verified/i,
    title: 'The sending domain is not verified',
    body: 'The provider will not send from this domain until you have proved you own it, which is done by adding DNS records.',
    fix: 'Complete the domain verification in the provider dashboard, then send a test email from the Settings.',
  },
  {
    match: /could not resolve|connection refused|connection timed out|timed out|failed to connect|network is unreachable/i,
    title: 'Your site could not reach the mail server',
    body: 'The connection never completed. Either the host or port is wrong, or your web host blocks outgoing connections on that port, which many shared hosts do.',
    fix: 'Check the host and port, and try port 465 with SSL instead of 587 with TLS. If nothing connects, ask your host whether outgoing SMTP is blocked. A provider that sends over its API instead of SMTP avoids the problem entirely.',
  },
  {
    match: /certificate|ssl|tls.*fail/i,
    title: 'The secure connection failed',
    body: 'The encrypted connection to the mail server could not be established, often a certificate mismatch or a server that expects a different encryption mode.',
    fix: 'Try the other encryption setting: SSL on port 465, or TLS on port 587.',
  },
  {
    match: /name is missing in to|missing.*name/i,
    title: 'The provider wanted a name with the address',
    body: 'Brevo rejects recipients sent without a display name.',
    fix: 'This was fixed in a recent version. Updating is enough.',
  },
];

export const explainError = (error) => {
  const message = String(error || '');
  if (!message) {
    return null;
  }
  return EXPLANATIONS.find((entry) => entry.match.test(message)) || null;
};

const ErrorModal = ({ log, onClose }) => {
  const explanation = log ? explainError(log.error) : null;

  const content = !log ? null : (
    <div>
      {explanation ? (
        <>
          <p style={{ marginTop: 0, fontWeight: 600, fontSize: 15 }}>{t(explanation.title)}</p>
          <p style={{ marginTop: 0 }}>{t(explanation.body)}</p>
          <p style={{ marginBottom: 18 }}><strong>{t('What to do:')}</strong> {t(explanation.fix)}</p>
        </>
      ) : (
        <p style={{ marginTop: 0, marginBottom: 18 }}>
          {t('This one is not a failure Meow Mailer recognises, so here it is exactly as the provider reported it. Searching for this text usually finds the answer.')}
        </p>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--neko-gray-50)', marginBottom: 5 }}>
        {t('Reported by the provider')}
      </div>
      <div style={{
        background: 'var(--neko-gray-95)', border: '1px solid var(--neko-gray-90)', borderRadius: 6,
        padding: '9px 11px', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-word',
      }}>
        {log.error || t('No message was recorded.')}
      </div>
    </div>
  );

  return (
    <NekoModal isOpen={!!log} title={t('Why this email failed')} onRequestClose={onClose}
      content={content} okButton={{ label: t('Close'), onClick: onClose }} />
  );
};

export default ErrorModal;
