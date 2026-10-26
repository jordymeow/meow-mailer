// The dashboard's shared look: white cards on the blue workspace, a thin coloured bar for the state.
import Styled from 'styled-components';

const GREEN = '#1f9d5c';
const ORANGE = '#d4881a';
const RED = '#d64545';
const GREY = '#b8c0cc';
const MUTED = 'var(--neko-gray-60, #7a8496)';
const LINE = '#eef1f6';
const TONE_COLORS = { good: GREEN, warning: ORANGE, bad: RED };

const card = `
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 14px rgba(15, 23, 42, 0.06);
`;

// A white card with a list of rows, the building block of the Home and Site tabs.
const StyledPanel = Styled.div`
  ${card}
  overflow: hidden;

  .panel-title {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px 10px;
    font-size: 12px;
    font-weight: 600;
    color: ${MUTED};
    text-transform: uppercase;
    letter-spacing: 0.06em;

    .panel-side { margin-left: auto; text-transform: none; letter-spacing: 0; font-weight: 400; }
    /* A card's one action sits at its top right, not alone at the bottom (Jordy). */
    .panel-action { margin-left: auto; text-transform: none; letter-spacing: 0; }
    .panel-side + .panel-action { margin-left: 4px; }
  }

  .row.is-pending { opacity: 0.45; }

  /* A calm list: no rule between rows, regular weight. */
  &.calm .row { border-top: none; padding: 6px 18px; }
  &.calm .row:last-child { padding-bottom: 14px; }
  &.calm .row-label, &.calm .row-value { font-weight: 400; }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 18px;
    border-top: 1px solid ${LINE};
    font-size: 14px;
    color: var(--neko-font-color);

    > img { width: 22px; height: 22px; border-radius: 6px; flex: none; }
    /* Every row keeps a 22px icon slot, logo or glyph, so the text always starts at the same place. */
    > svg { width: 22px; flex: none; }
    .row-text { flex: 1; min-width: 0; }
    .row-label { font-weight: 600; }
    .row-note { color: ${MUTED}; font-size: 13px; }
    .row-value { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  }

  .tone-icon { flex: none; }
  .tone-icon.good { color: ${GREEN}; }
  .tone-icon.warning { color: ${ORANGE}; }
  .tone-icon.bad { color: ${RED}; }
  .tone-icon.neutral { color: ${GREY}; }

  a.action, button.action {
    font: inherit;
    font-weight: 600;
    color: var(--neko-main-color);
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
    &:hover, &:focus-visible { text-decoration: underline; }
  }
`;

export { GREEN, ORANGE, RED, GREY, MUTED, LINE, TONE_COLORS, card, StyledPanel };
