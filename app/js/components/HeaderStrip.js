import { NekoIcon } from '@neko-ui';

/**
 * A full-width status band that hangs directly under NekoHeader with no gap,
 * in a lighter shade of the header's brand blue, so it reads as the header's
 * second line rather than a card on the workspace.
 *
 * Candidate for NekoUI (as NekoHeaderStrip). Nothing in this file may depend
 * on the plugin (only @neko-ui imports), so the future move is a plain copy.
 *
 *   <HeaderStrip status="ok" label="Sending" right={<HeaderStrip.Stat ... />}>
 *     the one-line explanation
 *   </HeaderStrip>
 */

// NekoStatus semantics, re-tuned for a blue background where the regular
// palette's grays and blues would vanish.
const ACCENTS = {
  ok:      'var(--neko-green)',
  active:  'var(--neko-green)',
  success: 'var(--neko-green)',
  error:   'var(--neko-red)',
  danger:  'var(--neko-red)',
  warning: 'var(--neko-orange)',
  pending: 'var(--neko-orange)',
  paused:  'rgba(255, 255, 255, 0.65)',
  idle:    'rgba(255, 255, 255, 0.65)',
  info:    'white',
};

// Stats name a meaning, not a color: the palette's greens and reds are tuned
// for white cards and go muddy on blue, so the tones pre-mix them toward white.
const TONES = {
  success: 'color-mix(in srgb, var(--neko-green) 55%, white)',
  danger:  'color-mix(in srgb, var(--neko-red) 45%, white)',
  neutral: 'rgba(255, 255, 255, 0.8)',
};

const CAPTION = {
  fontSize: 10, fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase',
  color: 'rgba(255, 255, 255, 0.65)', whiteSpace: 'nowrap',
};

// Same glass recipe as the header's section badge. Matching it is what makes
// the strip read as part of the header rather than a card that touches it.
const Pill = ({ accent, children }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
    background: 'rgba(255, 255, 255, 0.14)', border: '1px solid rgba(255, 255, 255, 0.22)',
    borderRadius: 999, padding: '5px 12px 5px 10px', whiteSpace: 'nowrap',
    color: 'white', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.09em', lineHeight: 1,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: accent,
      boxShadow: `0 0 8px color-mix(in oklab, ${accent} 80%, transparent)`,
    }} />
    {children}
  </span>
);

// One block of the right-side cluster: a big number (or an icon) over a
// caption. Every block shares the same fixed-height top slot; that shared
// geometry is what keeps icon blocks and number blocks on one baseline.
const Stat = ({ value, icon, label, tone = 'neutral', hint }) => (
  <div style={{ textAlign: icon ? 'center' : 'right', minWidth: icon ? 0 : 58 }} title={hint}>
    <div style={{
      height: 22, display: 'flex', alignItems: 'center',
      justifyContent: icon ? 'center' : 'flex-end',
      fontSize: 20, fontWeight: 700, color: TONES[tone] || TONES.neutral,
    }}>
      {icon ? <NekoIcon icon={icon} width={19} height={19} color="rgba(255, 255, 255, 0.75)" /> : value}
    </div>
    <div style={CAPTION}>{label}</div>
  </div>
);

const HeaderStrip = ({ status = 'info', label, right, children, style }) => {
  const accent = ACCENTS[status] || ACCENTS.info;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
      // The 32px inset matches NekoHeader's own padding so both lines start
      // on the same column.
      padding: '10px 32px',
      background: 'color-mix(in srgb, var(--neko-main-color) 85%, white)',
      fontFamily: 'var(--neko-font-family)',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {!!label && <Pill accent={accent}>{label}</Pill>}
        {children != null && (
          <span style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 13 }}>{children}</span>
        )}
      </div>
      {!!right && <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>{right}</div>}
    </div>
  );
};

HeaderStrip.Stat = Stat;

export default HeaderStrip;
