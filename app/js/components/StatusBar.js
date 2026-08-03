const { useState, useEffect } = wp.element;

import { NekoStatus } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { PROVIDER_LABELS, isProviderConfigured } from '@app/providers';
import { fetchLogs } from '@app/requests';
import { t } from '@app/i18n';

/**
 * The one-line answer to "is my email working?", shown above every screen. It
 * replaces both the old Status block and the banner that used to say the same
 * thing in different words.
 */
export const deliveryState = (options) => {
  const provider = options.provider;
  if (provider === 'none') {
    return { status: 'paused', label: t('Inactive'), hint: t('WordPress sends email on its own. Pick a provider to route and log it.') };
  }
  if (provider === 'offline') {
    return { status: 'paused', label: t('Offline'), hint: t('Every email is captured in the log, but never delivered.') };
  }
  if (!isProviderConfigured(provider, options.providers[provider])) {
    return { status: 'warning', label: t('Not configured'), hint: t('Finish setting up the provider before sending.') };
  }
  return { status: 'ok', label: t('Sending'), hint: t('All WordPress email is routed and logged.') };
};

const STATUS_ACCENTS = {
  ok:      'var(--neko-green)',
  warning: 'var(--neko-orange)',
  paused:  'var(--neko-gray-60)',
};

const Stat = ({ label, value, color }) => (
  <div style={{ textAlign: 'right', minWidth: 58 }}>
    <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color }}>{value || 0}</div>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase', color: 'var(--neko-gray-50)' }}>{label}</div>
  </div>
);

const StatusBar = ({ pulse }) => {
  const { state } = useCoreContext();
  const { options } = state;
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchLogs({ page: 1, limit: 1, filters: {}, sort: { accessor: 'created', by: 'desc' } })
      .then((res) => setStats(res.stats || {}))
      .catch(() => {});
  }, [pulse, options.provider]);

  const { status, label, hint } = deliveryState(options);
  const namedProvider = options.provider !== 'none' && options.provider !== 'offline';

  // Same palette NekoStatus uses, so the accent and the chip always agree.
  const accent = STATUS_ACCENTS[status] || 'var(--neko-blue)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
      background: 'white', borderRadius: 'var(--neko-radius-md, 10px)', padding: '14px 20px',
      border: '1px solid var(--neko-gray-90)', borderLeft: `3px solid ${accent}`,
      boxShadow: 'var(--neko-shadow-sm, 0 1px 3px rgba(0,0,0,.08))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <NekoStatus status={status} iconSize={18}>{label}</NekoStatus>
        {/* 'none' and 'offline' aren't providers, and the chip already named them. */}
        {namedProvider && <span style={{ fontWeight: 700 }}>{PROVIDER_LABELS[options.provider]}</span>}
        <span style={{ color: 'var(--neko-gray-50)', fontSize: 13 }}>{hint}</span>
      </div>
      {/* Named because the dashboard below shows the same three words for whatever
          the filters currently select. Two different "Failed" numbers on one screen
          reads as a bug unless it says which is which. */}
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          color: 'var(--neko-gray-60)', whiteSpace: 'nowrap',
        }}>
          {t('All time')}
        </span>
        <Stat label={t('Sent')} value={stats.sent} color="var(--neko-green)" />
        <Stat label={t('Failed')} value={stats.failed} color="var(--neko-red)" />
        <Stat label={t('Offline')} value={stats.offline} color="var(--neko-gray-50)" />
      </div>
    </div>
  );
};

export default StatusBar;
