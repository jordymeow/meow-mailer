const { useState, useEffect } = wp.element;

import { NekoModal, NekoButton, NekoSpinner, NekoStatus } from '@neko-ui';

import { fetchLog, resendLog } from '@app/requests';
import { PROVIDER_LABELS } from '@app/providers';
import { statusOf } from './LogsScreen';
import { t } from '@app/i18n';

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
  const isHtml = log && /<[a-z][\s\S]*>/i.test(log.body || '');

  const content = busy || !log ? <div style={{ padding: 40, textAlign: 'center' }}><NekoSpinner /></div> : (
    <div>
      <Row label={t('Date')} value={log.created} />
      <Row label={t('Status')} value={<NekoStatus status={st.type}>{st.label}</NekoStatus>} />
      <Row label={t('Provider')} value={PROVIDER_LABELS[log.provider] || log.provider || '—'} />
      <Row label={t('From')} value={log.email_from || '—'} />
      <Row label={t('To')} value={log.email_to} />
      <Row label={t('Subject')} value={log.subject} />
      {log.attachments ? <Row label={t('Attachments')} value={log.attachments} /> : null}
      {log.error ? <Row label={t('Error')} value={<span style={{ color: 'var(--neko-red)' }}>{log.error}</span>} /> : null}

      <div style={{ marginTop: 15 }}>
        <div style={{ fontWeight: 600, color: 'var(--neko-gray-50)', marginBottom: 6 }}>{t('Content')}</div>
        {log.body
          ? <iframe title="email-preview" sandbox="" srcDoc={isHtml ? log.body : `<pre style="white-space:pre-wrap;font-family:sans-serif;margin:0">${log.body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`}
              style={{ width: '100%', height: 340, border: '1px solid var(--neko-gray-90)', borderRadius: 6, background: 'white' }} />
          : <em>{t('Body was not stored for this email.')}</em>}
      </div>
    </div>
  );

  return (
    <NekoModal isOpen={!!id} title={t('Email Details')} onRequestClose={onClose} content={content} size="large"
      okButton={{ label: t('Close'), onClick: onClose }}
      customButtons={log ? <NekoButton className="primary" icon="refresh" busy={resending} onClick={doResend}>{t('Resend')}</NekoButton> : null}
      customButtonsPosition="left" />
  );
};

export default LogModal;
