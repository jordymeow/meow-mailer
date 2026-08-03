const { useState, useEffect, useCallback } = wp.element;

import { NekoBlock, NekoEmpty } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { fetchStats } from '@app/requests';
import { PROVIDER_LABELS } from '@app/providers';
import VolumeChart from './VolumeChart';
import { num } from '@app/format';
import { t } from '@app/i18n';

/**
 * The four headline numbers, as cards.
 *
 * The colour is never decoration: it is the same green and red the chart gives to
 * sent and failed, so the cards teach the chart below them. Red in particular only
 * appears when something has actually failed, because a red card showing zero reads
 * as an alarm when it is the best possible news.
 */
/**
 * Solid cards, one hue each, white text on top.
 *
 * Every value here is the brightest step of its NekoUI hue that still carries
 * white text at 4.5:1, measured rather than guessed. Purple and red land on the
 * interface's own values untouched and blue is brighter than the base; only green
 * has to darken, because a green light enough to look like the base one cannot
 * hold white text at all (it measures 2.5:1).
 *
 * Sent and Failed wear the same green and red as the chart below, so the cards and
 * the bars agree. The two derived numbers take blue and purple, which are not
 * used by any series and so cannot be mistaken for one.
 */
const TONES = {
  grey:   'hsl(220 10% 48%)',
  green:  'hsl(155 80% 29%)',
  blue:   'hsl(217 80% 53%)',
  red:    'hsl(358 80% 52%)',
  purple: 'hsl(262 72% 62%)',
  orange: 'hsl(28 92% 38%)',
};

// The text is pure white throughout, hierarchy coming from size and weight. Fading
// the label to 85% would look nicer and would drop it under the contrast floor,
// since these backgrounds are already as bright as white text allows.
const Tile = ({ label, value, hint, tone }) => (
  <div style={{
    background: TONES[tone] || TONES.grey, borderRadius: 10,
    padding: '11px 13px', minWidth: 0, color: 'var(--neko-white)',
  }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', opacity: 0.95 }}>
      {label}
    </div>
    <div style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{value}</div>
    {hint && <div style={{ fontSize: 11, lineHeight: 1.3 }}>{hint}</div>}
  </div>
);

/** A ranked reason with a bar for its share. The count is always written out. */
const ErrorRow = ({ error, total, share }) => (
  <div style={{ padding: '7px 0', borderBottom: '1px solid var(--neko-gray-90)' }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
      <span style={{ flex: 1, wordBreak: 'break-word', fontSize: 13 }}>{error}</span>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{num(total)}</span>
    </div>
    <div style={{ height: 4, borderRadius: 2, background: 'var(--neko-gray-90)', marginTop: 5 }}>
      <div style={{ width: `${share}%`, height: '100%', borderRadius: 2, background: 'var(--neko-red)' }} />
    </div>
  </div>
);

const DashboardScreen = ({ filters, reloadSignal, onBusy = () => {} }) => {
  const { state, actions } = useCoreContext();
  const { setError } = actions;

  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);

  const days = filters.days;

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setStats(await fetchStats(filters));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [filters, setError]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (reloadSignal) load(); }, [reloadSignal]);

  // The shared Refresh button lives in the filter bar and spins for both panels.
  useEffect(() => { onBusy(busy); }, [busy]);

  const totals = (stats && stats.totals) || { sent: 0, failed: 0, offline: 0, rate: null };
  const attempted = totals.sent + totals.failed;
  const volume = attempted + totals.offline;
  const perDay = volume > 0 ? Math.round((volume / days) * 10) / 10 : 0;
  const errors = (stats && stats.errors) || [];
  const worst = errors.length ? errors[0].total : 1;
  const providers = ((stats && stats.providers) || []).filter((p) => p.provider !== 'offline');

  // Filtering to one status makes a success rate meaningless: it can only ever come
  // out as 100% or 0%, and 0% in red would read as an outage when all it means is
  // that you asked to see failures. So the tile steps aside and says why.
  const statusFiltered = !!filters.status;

  // A rate needs something to divide. Until an email has actually been attempted,
  // a big "0%" would read as a problem rather than as an empty log.
  const rateValue = statusFiltered || totals.rate === null ? '—' : `${totals.rate}%`;
  // Blue while things are fine, because a healthy rate is not news. It only takes a
  // warning colour once it is worth looking at, which is what makes that worth
  // noticing at all.
  const rateTone = statusFiltered || totals.rate === null || totals.rate >= 99 ? 'blue'
    : (totals.rate >= 90 ? 'orange' : 'red');

  let rateHint;
  if (statusFiltered) {
    rateHint = t('not meaningful for one status');
  } else if (attempted > 0) {
    rateHint = `${num(totals.sent)} ${t('of')} ${num(attempted)} ${t('attempted')}`;
  } else {
    rateHint = t('nothing sent yet');
  }

  if (!state.options.logs_enabled) {
    return (
      <NekoBlock>
        <NekoEmpty inline icon="eye-off" title={t('Logging is turned off')}
          subtitle={t('Statistics are built from the log, so there is nothing to show until logging is back on.')} />
      </NekoBlock>
    );
  }

  // No wrapper of its own: MainScreen lays this out beside the log.
  return (
    <>
        {/* No title: the tiles name themselves, and "Overview" over four labelled
            cards is a heading that only repeats what is already under it. */}
        <NekoBlock busy={busy}>
          {/* Two by two rather than a flexible row: this sits in a side column, and
              a wrapping row of four leaves an orphan tile on its own line. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
            {/* "Delivered" would be a claim we cannot make: all we know is that the
                provider accepted the email, never that it reached an inbox. This is
                the share of attempts that left without an error, so it is named for
                that, and the difference from the Sent count beside it is clear. */}
            {/* The two derived figures lead, because they are the ones you read to
                judge the period. The raw counts they are derived from sit under them. */}
            <Tile label={t('Success Rate')} value={rateValue} tone={rateTone} hint={rateHint} />
            <Tile label={t('Per Day')} value={num(perDay)} tone="purple" hint={t('on average')} />
            <Tile label={t('Sent')} value={num(totals.sent)} tone="green" hint={t('left without error')} />
            {/* The one card that steps back at zero. Elsewhere a colour with nothing
                behind it is merely quiet; a red one reads as an alarm. */}
            <Tile label={t('Failed')} value={num(totals.failed)} tone={totals.failed > 0 ? 'red' : 'grey'} />
          </div>

          <VolumeChart series={stats ? stats.series : []}
            emptyMessage={t('Once WordPress sends something, it will show up here.')} />
        </NekoBlock>

        {errors.length > 0 && (
          <NekoBlock title={t('Why emails failed')} busy={busy}
            subtitle={t('The most common errors among the emails shown. Fixing the top one usually fixes most of them.')}>
            {errors.map((row, i) => (
              <ErrorRow key={i} error={row.error} total={row.total} share={Math.round((row.total / worst) * 100)} />
            ))}
          </NekoBlock>
        )}

        {providers.length > 1 && (
          <NekoBlock title={t('Providers')} busy={busy}
            subtitle={t('Which services carried the emails shown.')}>
            {providers.map((row) => (
              <div key={row.provider} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--neko-gray-90)' }}>
                <span>{PROVIDER_LABELS[row.provider] || row.provider}</span>
                <strong>{num(row.total)}</strong>
              </div>
            ))}
          </NekoBlock>
        )}
    </>
  );
};

export default DashboardScreen;
