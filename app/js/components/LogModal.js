const { useState, useEffect } = wp.element;

import { NekoModal, NekoButton, NekoSpinner, NekoStatus } from '@neko-ui';

import { fetchLog, resendLog } from '@app/requests';
import { PROVIDER_LABELS } from '@app/providers';
import { statusOf } from './LogsScreen';
import { __ } from '@app/i18n';

const Row = ({ label, value }) => (
  <div style={{ display: 'flex', padding: '4px 0', borderBottom: '1px solid var(--neko-gray-90)' }}>
    <div style={{ flex: '0 0 120px', fontWeight: 600, color: 'var(--neko-gray-50)' }}>{label}</div>
    <div style={{ flex: 1, wordBreak: 'break-word' }}>{value}</div>
  </div>
);

const LogModal = ({ id, onClose, onResent }) => {
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!id) {
      setLog(null);
      return;
    }
    setBusy(true);
    fetchLog(id).then(setLog).finally(() => setBusy(false));
  }, [id]);

  const doResend = async () => {
    setResending(true);
    try {
      await resendLog(id);
    } catch (err) {
      // The resend attempt is recorded as a new log entry either way; the reload
      // below surfaces its outcome (sent / failed).
    } finally {
      setResending(false);
      onResent && onResent();
      onClose();
    }
  };

  const st = log ? statusOf(log.status) : null;
  // Delivered, but with an error recorded: only the fallback path writes that pair.
  const rescued = !!(log && log.status === 'sent' && log.error);
  const isHtml = log && /<[a-z][\s\S]*>/i.test(log.body || '');
  // A resend needs the body; the files come along only when they were kept.
  const canResend = !!(log && log.body);

  const content = busy || !log ? <div style={{ padding: 40, textAlign: 'center' }}><NekoSpinner /></div> : (
    <div>
      <Row label={__('Date', 'meow-mailer')} value={log.created} />
      <Row label={__('Status', 'meow-mailer')} value={<NekoStatus status={st.type}>{st.label}</NekoStatus>} />
      <Row label={__('Provider', 'meow-mailer')} value={PROVIDER_LABELS[log.provider] || log.provider || '-'} />
      <Row label={__('From', 'meow-mailer')} value={log.email_from || '-'} />
      <Row label={__('To', 'meow-mailer')} value={log.email_to} />
      {log.cc ? <Row label={__('Cc', 'meow-mailer')} value={log.cc} /> : null}
      {log.bcc ? <Row label={__('Bcc', 'meow-mailer')} value={log.bcc} /> : null}
      {log.reply_to ? <Row label={__('Reply-To', 'meow-mailer')} value={log.reply_to} /> : null}
      <Row label={__('Subject', 'meow-mailer')} value={log.subject} />
      {log.attachments ? <Row label={__('Attachments', 'meow-mailer')} value={<>{log.attachments}
        <em style={{ color: 'var(--neko-gray-50)' }}> ({log.has_files
          ? __('kept, so a resend includes them', 'meow-mailer')
          : __('not included in a resend', 'meow-mailer')})</em></>} /> : null}
      {/* An error on a delivered email is not a failure: it is what the main provider
          said before the fallback stepped in. Shown as such, or it reads as a bug. */}
      {log.error ? (rescued
        ? <Row label={__('Fallback', 'meow-mailer')} value={<span style={{ color: 'var(--neko-orange)' }}>
            {__('Sent by the fallback because the main provider failed:', 'meow-mailer')} {log.error}
          </span>} />
        : <Row label={__('Error', 'meow-mailer')} value={<span style={{ color: 'var(--neko-red)' }}>{log.error}</span>} />) : null}

      <div style={{ marginTop: 15 }}>
        <div style={{ fontWeight: 600, color: 'var(--neko-gray-50)', marginBottom: 6 }}>{__('Content', 'meow-mailer')}</div>
        {log.body
          ? <iframe title="email-preview" sandbox="" srcDoc={isHtml ? log.body : `<pre style="white-space:pre-wrap;font-family:sans-serif;margin:0">${log.body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`}
              style={{ width: '100%', height: 340, border: '1px solid var(--neko-gray-90)', borderRadius: 6, background: 'white' }} />
          : <em>{__('Body was not stored for this email.', 'meow-mailer')}</em>}
      </div>
    </div>
  );

  return (
    <NekoModal isOpen={!!id} title={__('Email Details', 'meow-mailer')} onRequestClose={onClose} content={content} size="large"
      // Secondary, so Resend is the one primary action and Close reads as the way out.
      okButton={{ label: __('Close', 'meow-mailer'), onClick: onClose, className: 'secondary' }}
      customButtons={canResend ? <NekoButton className="primary" icon="refresh" busy={resending} onClick={doResend}>{__('Resend', 'meow-mailer')}</NekoButton> : null}
      customButtonsPosition="left" />
  );
};

export default LogModal;
