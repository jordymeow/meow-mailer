const { useState, useEffect } = wp.element;

import { NekoStatus, NekoIcon } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { PROVIDER_LABELS, isProviderConfigured } from '@app/providers';
import { fetchLogs } from '@app/requests';
import { num } from '@app/format';
import { t } from '@app/i18n';

const Name = ({ children }) => (
  <strong style={{ fontWeight: 700, color: 'var(--neko-gray-40)' }}>{children}</strong>
);

/**
 * Put a node where a translated string has its %s. The sentence stays one unit for
 * translators, rather than being glued together from fragments that only line up in
 * English, and the provider still gets to stand out inside it.
 */
const fill = (template, node) => {
  const [before, after = ''] = String(template).split('%s');
  return <>{before}{node}{after}</>;
};

/**
 * The one-line answer to "is my email working?", shown above every screen.
 *
 * Everything it has to say is said in one sentence: which provider carries the mail,
 * what happens if that provider refuses, and whether any of it is being recorded.
 * Those used to be three separate things on the bar, which read as three things to
 * work out instead of one state to take in.
 */
export const deliveryState = (options) => {
  const provider = options.provider;
  const providerName = PROVIDER_LABELS[provider] || provider;

  if (provider === 'none') {
    return { status: 'paused', label: t('Inactive'),
      sentence: [t('WordPress is sending email on its own. Pick a provider to route and log it.')] };
  }
  if (provider === 'offline') {
    return { status: 'paused', label: t('Offline mode'),
      sentence: [t('Every email is written to the log and none of them are delivered.')] };
  }
  if (!isProviderConfigured(provider, options.providers[provider])) {
    return { status: 'warning', label: t('Not configured'),
      sentence: [fill(t('Finish setting %s up before sending.'), <Name>{providerName}</Name>)] };
  }

  const fallback = options.fallback_provider;
  const sentence = [fill(t('All WordPress email goes through %s.'), <Name>{providerName}</Name>)];

  if (fallback && fallback !== 'none' && fallback !== provider) {
    sentence.push(fill(t('If it refuses one, %s takes over.'), <Name>{PROVIDER_LABELS[fallback] || fallback}</Name>));
  } else {
    sentence.push(t('There is no fallback if it fails.'));
  }
  sentence.push(options.logs_enabled ? t('Everything is logged.') : t('Nothing is being logged.'));

  return { status: 'ok', label: t('Sending'), sentence };
};

const STATUS_ACCENTS = {
  ok:      'var(--neko-green)',
  warning: 'var(--neko-orange)',
  paused:  'var(--neko-gray-60)',
};

const CAPTION = {
  fontSize: 10, fontWeight: 700, letterSpacing: 0,
  textTransform: 'uppercase', color: 'var(--neko-gray-50)',
};

// Each carries its own explanation: "Sent" and "Failed" speak for themselves, but
// nobody guesses what "Offline" counts without being told once.
const Stat = ({ label, value, color, hint }) => (
  <div style={{ textAlign: 'right', minWidth: 58 }} title={hint}>
    <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color }}>{num(value)}</div>
    <div style={CAPTION}>{label}</div>
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

  const { status, label, sentence } = deliveryState(options);

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
        <span style={{ color: 'var(--neko-gray-50)', fontSize: 13 }}>
          {sentence.map((part, i) => <span key={i}>{part}{i < sentence.length - 1 ? ' ' : ''}</span>)}
        </span>
      </div>
      {/* Labelled because the dashboard below shows the same words for whatever the
          filters currently select. Two different "Failed" numbers on one screen reads
          as a bug unless it says which is which. */}
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }} title={t('Counted over the whole log, whatever the dashboard is filtered to.')}>
          <NekoIcon icon="database" width={19} height={19} color="var(--neko-gray-60)" />
          <div style={{ ...CAPTION, color: 'var(--neko-gray-60)', whiteSpace: 'nowrap' }}>{t('All time')}</div>
        </div>
        <Stat label={t('Sent')} value={stats.sent} color="var(--neko-green)"
          hint={t('Handed to the provider without an error.')} />
        <Stat label={t('Failed')} value={stats.failed} color="var(--neko-red)"
          hint={t('The provider refused them, or could not be reached.')} />
        {/* Only once it means something. Most sites never turn Offline mode on, and a
            permanent "0 OFFLINE" is a word to puzzle over for no reason. */}
        {stats.offline > 0 && (
          <Stat label={t('Offline')} value={stats.offline} color="var(--neko-gray-50)"
            hint={t('Captured by Offline mode and deliberately never delivered.')} />
        )}
      </div>
    </div>
  );
};

export default StatusBar;
