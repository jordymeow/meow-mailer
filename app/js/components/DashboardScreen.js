const { useState, useEffect, useCallback } = wp.element;

import { NekoBlock, NekoSelect, NekoOption, NekoEmpty } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { fetchStats } from '@app/requests';
import { PROVIDER_LABELS } from '@app/providers';
import VolumeChart from './VolumeChart';
import { t } from '@app/i18n';

// Survives a tab switch, like the logs view does.
let viewDays = 30;

/**
 * The four headline numbers, as cards.
 *
 * The colour is never decoration: it is the same green and red the chart gives to
 * sent and failed, so the cards teach the chart below them. Red in particular only
 * appears when something has actually failed, because a red card showing zero reads
 * as an alarm when it is the best possible news.
 */
const TONES = {
  neutral: { bg: 'var(--neko-gray-95)', ink: 'var(--neko-gray-30)' },
  good:    { bg: 'var(--neko-lighten-green)', ink: 'var(--neko-green)' },
  bad:     { bg: 'var(--neko-lighten-red)', ink: 'var(--neko-red)' },
  warn:    { bg: 'hsl(28 92% 95%)', ink: 'var(--neko-orange)' },
  info:    { bg: 'var(--neko-main-color-95)', ink: 'var(--neko-main-color)' },
};

const Tile = ({ label, value, hint, tone = 'neutral', quiet = false }) => {
  const { bg, ink } = TONES[tone] || TONES.neutral;
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '11px 13px', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--neko-gray-50)' }}>
        {label}
      </div>
      <div style={{
        fontSize: 27, fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere',
        // The card keeps its colour so the panel stays legible at a glance, but a
        // zero does not get to shout in it: nothing failed is good news.
        color: quiet ? 'var(--neko-gray-40)' : ink,
      }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--neko-gray-50)', lineHeight: 1.3 }}>{hint}</div>}
    </div>
  );
};

/** A ranked reason with a bar for its share. The count is always written out. */
const ErrorRow = ({ error, total, share }) => (
  <div style={{ padding: '7px 0', borderBottom: '1px solid var(--neko-gray-90)' }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
      <span style={{ flex: 1, wordBreak: 'break-word', fontSize: 13 }}>{error}</span>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{total}</span>
    </div>
    <div style={{ height: 4, borderRadius: 2, background: 'var(--neko-gray-90)', marginTop: 5 }}>
      <div style={{ width: `${share}%`, height: '100%', borderRadius: 2, background: 'var(--neko-red)' }} />
    </div>
  </div>
);

const DashboardScreen = ({ reloadSignal }) => {
  const { state, actions } = useCoreContext();
  const { setError } = actions;

  const [days, setDays] = useState(viewDays);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { viewDays = days; }, [days]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setStats(await fetchStats(days));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [days, setError]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (reloadSignal) load(); }, [reloadSignal]);

  const totals = (stats && stats.totals) || { sent: 0, failed: 0, offline: 0, rate: null };
  const attempted = totals.sent + totals.failed;
  const volume = attempted + totals.offline;
  const perDay = volume > 0 ? Math.round((volume / days) * 10) / 10 : 0;
  const errors = (stats && stats.errors) || [];
  const worst = errors.length ? errors[0].total : 1;
  const providers = ((stats && stats.providers) || []).filter((p) => p.provider !== 'offline');

  // A rate needs something to divide. Until an email has actually been attempted,
  // a big "0%" would read as a problem rather than as an empty log.
  const rateValue = totals.rate === null ? '—' : `${totals.rate}%`;
  // With no rate yet the card still carries its colour, and the dash inside it says
  // there is nothing to judge. Claiming "good" before a single email is misleading.
  const rateTone = totals.rate === null ? 'good'
    : (totals.rate >= 99 ? 'good' : (totals.rate >= 90 ? 'warn' : 'bad'));

  const rangeSelect = (
    <NekoSelect scrolldown name="days" value={String(days)} onChange={(v) => setDays(parseInt(v, 10))} style={{ width: 150 }}>
      <NekoOption value="7" label={t('Last 7 days')} />
      <NekoOption value="30" label={t('Last 30 days')} />
      <NekoOption value="90" label={t('Last 90 days')} />
    </NekoSelect>
  );

  if (!state.options.logs_enabled) {
    return (
      <NekoBlock title={t('Overview')}>
        <NekoEmpty inline icon="eye-off" title={t('Logging is turned off')}
          subtitle={t('Statistics are built from the log, so there is nothing to show until logging is back on.')} />
      </NekoBlock>
    );
  }

  // No wrapper of its own: MainScreen lays this out beside the log.
  return (
    <>
        <NekoBlock title={t('Overview')} busy={busy} action={rangeSelect}>
          {/* Two by two rather than a flexible row: this sits in a side column, and
              a wrapping row of four leaves an orphan tile on its own line. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
            <Tile label={t('Delivered')} value={rateValue} tone={rateTone} quiet={totals.rate === null}
              hint={attempted > 0
                ? `${totals.sent} ${t('of')} ${attempted} ${t('attempted')}`
                : t('nothing sent yet')} />
            <Tile label={t('Sent')} value={totals.sent} tone="good" quiet={totals.sent === 0} />
            <Tile label={t('Failed')} value={totals.failed} tone="bad" quiet={totals.failed === 0} />
            <Tile label={t('Per Day')} value={perDay} tone="info" hint={t('on average')} />
          </div>

          <VolumeChart series={stats ? stats.series : []}
            emptyMessage={t('Once WordPress sends something, it will show up here.')} />
        </NekoBlock>

        {errors.length > 0 && (
          <NekoBlock title={t('Why emails failed')} busy={busy}
            subtitle={t('The most common errors in this period. Fixing the top one usually fixes most of them.')}>
            {errors.map((row, i) => (
              <ErrorRow key={i} error={row.error} total={row.total} share={Math.round((row.total / worst) * 100)} />
            ))}
          </NekoBlock>
        )}

        {providers.length > 1 && (
          <NekoBlock title={t('Providers')} busy={busy}
            subtitle={t('Which services carried your email in this period.')}>
            {providers.map((row) => (
              <div key={row.provider} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--neko-gray-90)' }}>
                <span>{PROVIDER_LABELS[row.provider] || row.provider}</span>
                <strong>{row.total}</strong>
              </div>
            ))}
          </NekoBlock>
        )}
    </>
  );
};

export default DashboardScreen;
