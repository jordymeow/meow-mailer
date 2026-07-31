const { useState } = wp.element;

import { t } from '@app/i18n';

/**
 * Daily email volume as stacked bars.
 *
 * No charting library on purpose: one would cost more than this whole plugin's
 * bundle, and what is needed here is bars, a scale and a tooltip.
 *
 * Built from plain elements rather than SVG. A responsive bar chart in a fixed
 * viewBox has to stretch the x axis, which distorts rounded corners and forces
 * hand-placed labels; with flexbox the widths are the browser's problem and the
 * corners stay round at any size.
 *
 * The three series are statuses, not arbitrary categories, so they wear the same
 * status colours as the rest of the UI. Green and red are far enough apart for
 * red-green colour blindness (measured, not assumed), and they are never the only
 * signal regardless: the legend, the totals and the hover readout all name them.
 */

// Order is bottom-to-top. Failures sit against the baseline, where they are
// easiest to compare between days.
export const SERIES = [
  { key: 'failed', label: 'Failed', color: 'var(--neko-red)' },
  { key: 'sent', label: 'Sent', color: 'var(--neko-green)' },
  { key: 'offline', label: 'Offline', color: 'var(--neko-gray-60)' },
];

const HEIGHT = 180;
const GAP = 2; // surface gap, between stacked segments and between bars alike

const niceMax = (value) => {
  if (value <= 5) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
};

const dayLabel = (day) => {
  const [, m, d] = day.split('-');
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
};

const Legend = () => (
  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
    {SERIES.map((s) => (
      <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--neko-gray-50)' }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: '0 0 auto' }} />
        {t(s.label)}
      </span>
    ))}
  </div>
);

const gridLine = (bottom) => ({
  position: 'absolute', left: 0, right: 0, bottom, height: 1,
  background: 'var(--neko-gray-90)', pointerEvents: 'none',
});

const VolumeChart = ({ series }) => {
  const [hover, setHover] = useState(null);

  const days = series || [];
  if (!days.length) {
    return null;
  }

  const totals = days.map((d) => SERIES.reduce((sum, s) => sum + (d[s.key] || 0), 0));
  const max = niceMax(Math.max(...totals, 1));

  const active = hover !== null ? days[hover] : null;
  const activeTotal = hover !== null ? totals[hover] : 0;

  // The readout replaces per-bar labels: with one bar per day a number on each
  // would be unreadable, and dated ticks would collide long before they helped.
  const readout = active
    ? `${dayLabel(active.day)} · ${SERIES.filter((s) => active[s.key] > 0)
        .map((s) => `${active[s.key]} ${t(s.label).toLowerCase()}`).join(', ') || t('nothing')}`
    : '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Legend />
        <span style={{ fontSize: 12, color: 'var(--neko-gray-50)', textAlign: 'right', minHeight: 16 }}>
          {readout}
        </span>
      </div>

      <div style={{ position: 'relative', height: HEIGHT }}>
        <div style={gridLine(0)} />
        <div style={gridLine(Math.round(HEIGHT / 2))} />
        <div style={gridLine(HEIGHT - 1)} />

        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: GAP }}
          onMouseLeave={() => setHover(null)}>
          {days.map((day, i) => {
            // Bottom-to-top in the data, so top-to-bottom in the DOM.
            const stack = SERIES.filter((s) => (day[s.key] || 0) > 0).reverse();
            return (
              <div key={day.day} title={`${dayLabel(day.day)}: ${totals[i]}`}
                onMouseEnter={() => setHover(i)}
                style={{
                  flex: '1 1 0', minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column',
                  justifyContent: 'flex-end', gap: GAP,
                  // The column is the hit area, so a quiet day with a 1px bar is
                  // still hoverable.
                  cursor: totals[i] > 0 ? 'default' : 'default',
                  opacity: hover === null || hover === i ? 1 : 0.45,
                  transition: 'opacity 120ms ease',
                }}>
                {stack.map((s, index) => (
                  <div key={s.key} style={{
                    height: `${((day[s.key] / max) * 100).toFixed(2)}%`,
                    minHeight: 2,
                    background: s.color,
                    borderRadius: index === 0 ? '3px 3px 0 0' : 0,
                  }} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--neko-gray-60)', marginTop: 6 }}>
        <span>{dayLabel(days[0].day)}</span>
        <span>{t('peak')} {max}</span>
        <span>{dayLabel(days[days.length - 1].day)}</span>
      </div>
    </div>
  );
};

export default VolumeChart;
