const { useState, useEffect, useCallback } = wp.element;

import { NekoWrapper, NekoColumn, NekoBlock, NekoSelect, NekoOption, NekoSpacer, NekoEmpty } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { fetchStats } from '@app/requests';
import { PROVIDER_LABELS } from '@app/providers';
import { wrapperBody } from '@app/layout';
import VolumeChart from './VolumeChart';
import { t } from '@app/i18n';

// Survives a tab switch, like the logs view does.
let viewDays = 30;

const Tile = ({ label, value, hint, color }) => (
  <div style={{ flex: '1 1 0', minWidth: 120 }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--neko-gray-50)' }}>
      {label}
    </div>
    <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: color || 'var(--neko-gray-30)' }}>{value}</div>
    {hint && <div style={{ fontSize: 12, color: 'var(--neko-gray-50)' }}>{hint}</div>}
  </div>
);

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
  const rateColor = totals.rate === null ? 'var(--neko-gray-60)'
    : (totals.rate >= 99 ? 'var(--neko-green)' : (totals.rate >= 90 ? 'var(--neko-orange)' : 'var(--neko-red)'));

  const rangeSelect = (
    <NekoSelect scrolldown name="days" value={String(days)} onChange={(v) => setDays(parseInt(v, 10))} style={{ width: 150 }}>
      <NekoOption value="7" label={t('Last 7 days')} />
      <NekoOption value="30" label={t('Last 30 days')} />
      <NekoOption value="90" label={t('Last 90 days')} />
    </NekoSelect>
  );

  if (!state.options.logs_enabled) {
    return (
      <NekoWrapper style={wrapperBody}>
        <NekoColumn minimal fullWidth>
          <NekoBlock title={t('Overview')}>
            <NekoEmpty inline icon="eye-off" title={t('Logging is turned off')}
              subtitle={t('Statistics are built from the log, so there is nothing to show until logging is back on.')} />
          </NekoBlock>
        </NekoColumn>
      </NekoWrapper>
    );
  }

  return (
    <NekoWrapper style={wrapperBody}>
      <NekoColumn minimal fullWidth>

        <NekoBlock title={t('Overview')} busy={busy} action={rangeSelect}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
            <Tile label={t('Delivered')} value={rateValue} color={rateColor}
              hint={attempted > 0
                ? `${totals.sent} ${t('of')} ${attempted} ${t('attempted')}`
                : t('nothing sent yet')} />
            <Tile label={t('Sent')} value={totals.sent} />
            <Tile label={t('Failed')} value={totals.failed} color={totals.failed > 0 ? 'var(--neko-red)' : undefined} />
            <Tile label={t('Per Day')} value={perDay} hint={t('on average')} />
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

        <NekoSpacer />
      </NekoColumn>
    </NekoWrapper>
  );
};

export default DashboardScreen;
