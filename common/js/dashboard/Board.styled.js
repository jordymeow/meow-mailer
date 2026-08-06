// React & Vendor Libs
import Styled, { keyframes } from 'styled-components';

import { focusRing } from './Dashboard.styled';

// The board is drawn on a fixed canvas and scaled to fit its container, so the
// composition never reflows: every node keeps its place, only the zoom changes.
// Must stay in sync with the layout maths in Board.js.
const STAGE_W = 1300;
const STAGE_H = 646;

const drift = keyframes`
  to { stroke-dashoffset: -33; }
`;

// Slow enough to read as an invitation rather than an alarm.
const beckon = keyframes`
  0%, 100% { box-shadow: 0 3px 12px rgba(3, 22, 62, 0.22), 0 0 0 0 rgba(255, 255, 255, 0); }
  50% { box-shadow: 0 3px 12px rgba(3, 22, 62, 0.22), 0 0 18px 2px var(--glow); }
`;

const StyledBoardHeader = Styled.div`
  position: relative;
  z-index: 30;
  margin: 14px 16px 6px;
  height: 88px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.035));
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  overflow: hidden;


  .header-idle,
  .header-live {
    display: flex;
    align-items: center;
    gap: 18px;
    height: 100%;
    /* Right padding clears the view toggle (72px wide, inset 17px). */
    padding: 0 110px 0 18px;
  }

  .header-mark {
    flex: 0 0 auto;
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.09);
    border: 1px solid rgba(255, 255, 255, 0.16);
  }

  /* Deliberately larger than the frame that clips it: the plugin artwork is
     drawn to the edges, so letting it bleed and cropping looks better than
     fitting it with a margin of dead space. */
  .header-mark img {
    width: 76px;
    height: 76px;
    display: block;
    background: color-mix(in srgb, var(--accent, #8fb3d9) 20%, rgba(255, 255, 255, 0.07));
  }
  .header-mark.is-plugin { background: none; border: 0; }

  .header-id {
    display: flex;
    flex-direction: column;
    gap: 5px;
    /* The identity never shrinks: when the strip runs out of room the chips and
       partners give way instead. Relaxed only under .is-tight, far below. */
    flex: 0 0 auto;
    min-width: 0;
  }

  .header-name {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: white;
    line-height: 1.25;
    white-space: nowrap;
  }

  .header-sub, .header-desc {
    margin-top: 4px;
    line-height: 1.4;
    /* Caps how wide the non-shrinking identity column can get. */
    max-width: 300px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .header-sub { font-size: 11.5px; color: rgba(255, 255, 255, 0.5); }
  .header-sub b { color: rgba(255, 255, 255, 0.8); font-weight: 650; }

  .header-desc {
    margin: 8px 0 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.72);
    max-height: 37px;
    overflow: hidden;
  }

  /* Sized for exactly two chips per row, so the block always reads as a tidy
     2x2 rather than a ragged stack. Fixed basis for the same reason as
     .header-related: no reflow as you sweep across the board. */
  .header-features {
    /* Doesn't shrink: squeezed, the chips truncate to "One…" and "Han…", which
       is worse than not showing them. The partner icons yield instead — they
       degrade by showing fewer, which costs nothing legible. */
    flex: 0 0 306px;
    display: flex;
    flex-wrap: wrap;
    /* flex-start, not center. A chip row is 23px and the gap 6px, so 52px is
       exactly two rows. Centring was fine while everything fitted, but the
       moment a node produced three rows it centred them in a two-row window and
       sliced the first and last in half lengthwise. Starting at the top means
       the overflow is always a whole row that simply isn't drawn. */
    align-content: flex-start;
    gap: 6px;
    max-height: 52px;
    overflow: hidden;
  }

  .feature-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    /* No width cap: every label fits inside the 306px block on its own, so
       letting them size naturally means short ones pair up two to a row and
       long ones take a row to themselves. A tidy 2x2 isn't worth reading
       "A photo, with its EXIF a…". */
    box-sizing: border-box;
    max-width: 100%;
    padding: 4px 9px;
    border-radius: 7px;
    font-size: 11px;
    line-height: 1.2;
    color: rgba(255, 255, 255, 0.82);
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .chip-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .feature-chip svg { flex: 0 0 auto; opacity: 0.75; }
  .feature-chip .chip-glyph { font-style: normal; font-size: 12px; line-height: 1; }

  /* A journey your site can't run yet still earns a place, dashed and dimmed. */
  .feature-chip.is-ghost {
    color: rgba(255, 255, 255, 0.5);
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.03);
  }

  .header-spacer { flex: 1 1 auto; }

  .related-icons {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }

  .related-icons img {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    display: block;
  }

  .related-icons img.off { filter: grayscale(1); opacity: 0.45; }

  .related-more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    font-size: 10.5px;
    font-weight: 650;
    color: rgba(255, 255, 255, 0.72);
    background: rgba(255, 255, 255, 0.09);
    border: 1px solid rgba(255, 255, 255, 0.16);
  }

  .header-actions {
    flex: 0 0 auto;
    display: flex;
    gap: 8px;
  }

  .header-actions a {
    width: 72px;
    text-align: center;
    padding: 9px 0;
    border-radius: 9px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    transition: background 0.18s ease, color 0.18s ease;
    ${focusRing}
  }

  .header-actions a.free {
    color: white;
    background: linear-gradient(135deg, #3f7bec, #2f5fbd);
    border: 1px solid rgba(150, 190, 255, 0.5);
  }

  .header-actions a.pro {
    color: #ffcf7a;
    background: rgba(255, 186, 66, 0.1);
    border: 1px solid rgba(255, 186, 66, 0.55);
  }

  .header-actions a.free:hover { background: linear-gradient(135deg, #5590ff, #3a6cd0); }
  .header-actions a.pro:hover { background: rgba(255, 186, 66, 0.24); }

  /* The last resort. By this width the chips and partners are already gone and
     the icon, identity and buttons still don't fit, so the identity yields —
     the description reflows first, and only in the extreme does the name
     ellipsis. The buttons keep clear of the view toggle either way. */
  &.is-tight .header-id { flex: 0 1 auto; }

  /* The name gives way before the pill does: a clipped name still reads, a
     clipped status badge looks broken. */
  .header-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-stats {
    display: flex;
    gap: 10px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 9px 14px;
    min-width: 106px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.09);
  }

  .stat-value {
    display: flex;
    align-items: baseline;
    gap: 5px;
    line-height: 1;
  }

  .stat-value b {
    font-size: 19px;
    font-weight: 650;
    color: #4ce7a8;
  }

  .stat-value i,
  .stat-value em {
    font-style: normal;
    font-size: 13px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.38);
  }

  /* The infinity glyph sits small and low next to the digits at 13px. */
  .stat-value em.is-endless {
    font-size: 17px;
    line-height: 0.8;
    color: rgba(255, 255, 255, 0.45);
  }



  .stat-label {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
  }

  .header-status {
    /* Never shrinks: the name ellipsises before the badge does. */
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .header-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .header-status.is-active { background: rgba(43, 212, 125, 0.18); color: #4ce7a8; border: 1px solid rgba(43, 212, 125, 0.4); }
  .header-status.is-inactive { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); border: 1px solid rgba(255, 255, 255, 0.2); }
  .header-status.is-none { background: rgba(0, 0, 0, 0.22); color: rgba(255, 255, 255, 0.6); border: 1px dashed rgba(255, 255, 255, 0.26); }
  /* Waiting on the install list — deliberately quieter than "not installed",
     which it must not be mistaken for. */
  .header-status.is-unknown { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.5); border: 1px solid rgba(255, 255, 255, 0.14); }

  .header-related {
    /* Five icons at 26px with 6px gaps is the widest this ever gets. Fixed at
       that, so the column doesn't jump about as you move between nodes — but
       allowed to give the width back on a narrow screen, where it simply shows
       fewer icons rather than forcing anything else to clip. */
    flex: 0 1 178px;
    overflow: hidden;
    min-width: 0;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 9px;
    padding-left: 24px;
    border-left: 1px solid rgba(255, 255, 255, 0.09);
  }

  .related-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }







`;
const StyledBoardShell = Styled.div`
  position: relative;
  /* The view area already cancels the tab's padding; this just fills it. */
  margin: 0;
  border-radius: 0;
  /* The tab behind this is the brand blue. The board shouldn't be a dark panel
     sitting on it — it's the same surface, very slightly recessed. */
  background:
    radial-gradient(1100px 380px at 50% 40%, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 70%),
    linear-gradient(180deg, rgba(3, 22, 62, 0.10) 0%, rgba(3, 22, 62, 0.22) 100%);
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);

  /* Below MIN_SCALE the board stops shrinking, so it has to be able to pan.
     Scrolling here rather than on an ancestor, because NekoUI's tab wrapper is
     overflow:hidden and would simply clip it. */
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.28) transparent;

  &::-webkit-scrollbar { height: 8px; }
  &::-webkit-scrollbar-track { background: transparent; }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.22);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.34); }

  .board-fit { position: relative; }

`;

const StyledStage = Styled.div`
  position: relative;
  width: ${STAGE_W}px;
  height: ${STAGE_H}px;
  transform-origin: top left;
  user-select: none;

  /* The board was one flat blue rectangle. This is a soft light sitting behind
     the Core row — where everything plugs in — falling off towards the edges,
     so the stack reads as having a middle rather than being evenly lit. It sits
     under everything and catches no pointer events. */
  &::before {
    content: '';
    position: absolute;
    /* Strictly inside the stage. Bleeding past it added real width to the
       scroll container and left a horizontal scrollbar on at every size. */
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(58% 42% at 50% 55%, rgba(150, 190, 255, 0.16), transparent 70%),
      radial-gradient(80% 60% at 50% 108%, rgba(10, 24, 60, 0.28), transparent 72%);
  }

  /* ---------------------------------------------------------------- layers */

  /* Two stacked washes: a white "lift" that sets how far forward the layer sits,
     over a tint in the layer's own colour. Keeping them separate means the depth
     ranking and the hue can be tuned without fighting each other — they used to
     be four near-identical hardcoded gradients, which is why every layer read as
     the same blue. */
  .layer-panel {
    position: absolute;
    z-index: 1;
    --lift: 0.07;
    --lift-soft: 0.04;
    border-radius: 18px;
    /* Declared twice on purpose. A browser without color-mix throws away the
       whole declaration it appears in — which for a shorthand like this meant
       losing the white lift too, leaving every layer panel with no background
       at all and the four bands invisible. The plain pair below lands first and
       survives; the tinted pair overrides it wherever color-mix is understood. */
    background: linear-gradient(180deg,
      rgba(255, 255, 255, var(--lift)), rgba(255, 255, 255, var(--lift-soft)));
    border: 1px solid rgba(255, 255, 255, 0.11);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, var(--lift)), rgba(255, 255, 255, var(--lift-soft))),
      linear-gradient(180deg,
        color-mix(in srgb, var(--layer) 13%, transparent),
        color-mix(in srgb, var(--layer) 4%, transparent));
    border: 1px solid color-mix(in srgb, var(--layer) 24%, rgba(255, 255, 255, 0.07));
    transition: background 0.3s ease, border-color 0.3s ease, top 0.28s cubic-bezier(0.22, 1, 0.36, 1), height 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* A wash big enough to see would fight the cards, so the layer's colour is
     concentrated into a spine instead: unmistakable, and it takes up no room. */
  .layer-panel::before {
    content: '';
    position: absolute;
    left: 0;
    top: 16px;
    bottom: 16px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg,
      transparent,
      color-mix(in srgb, var(--layer) 85%, transparent) 22%,
      color-mix(in srgb, var(--layer) 85%, transparent) 78%,
      transparent);
    transition: opacity 0.25s ease;
    opacity: 0.75;
  }

  .layer-panel.is-lit::before { opacity: 1; }

  /* Name and description in a fixed left column; the cards get the rest. */
  .layer-label {
    position: absolute;
    left: 20px;
    /* Centred on the cards, not on the panel: headroom is added above the
       cards, so centring on the panel would leave the name sitting high. */
    top: calc(50% + var(--headroom, 0px) / 2);
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .layer-mark {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: color-mix(in srgb, var(--layer) 28%, transparent);
    border: 1px solid color-mix(in srgb, var(--layer) 62%, transparent);
    box-shadow: 0 0 14px color-mix(in srgb, var(--layer) 22%, transparent);
  }

  .layer-text { display: flex; flex-direction: column; gap: 5px; min-width: 0; }

  /* Each layer sits at its own depth. Lightness steps down as you go further
     from the surface, and WordPress — the floor everything stands on — is the
     brightest. Blue on blue would just disappear, so it's value, not hue. */
  /* How far forward each layer sits. Core is the brightest because everything
     else plugs into it; the outside world is the faintest because it isn't
     yours. */
  .layer-panel.is-world { --lift: 0.04; --lift-soft: 0.02; }
  .layer-panel.is-surface { --lift: 0.085; --lift-soft: 0.05; }
  .layer-panel.is-workshop { --lift: 0.06; --lift-soft: 0.035; }

  .layer-panel.is-core {
    --lift: 0.15;
    --lift-soft: 0.085;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }

  .layer-panel.is-lit {
    --lift: 0.13;
    --lift-soft: 0.09;
    border-color: color-mix(in srgb, var(--layer) 45%, rgba(255, 255, 255, 0.2));
  }

  .layer-panel.is-core.is-lit { --lift: 0.2; --lift-soft: 0.12; }

  .layer-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    white-space: nowrap;
    text-transform: uppercase;
    color: var(--layer, rgba(255, 255, 255, 0.72));
  }


  .layer-blurb {
    font-size: 11px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.45);
    transition: color 0.3s ease;
  }

  .layer-panel.is-lit .layer-blurb { color: rgba(255, 255, 255, 0.6); }

  /* ----------------------------------------------------------------- wires */

  .board-wires {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    overflow: visible;
  }

  .wire { opacity: 0.5; transition: opacity 0.3s ease; }

  .wire-line {
    fill: none;
    stroke-width: 1.5;
    transition: stroke-width 0.3s ease;
  }

  .wire-port { opacity: 0; transition: opacity 0.3s ease; }

  /* Particles drifting toward the arrow — only ever on the two or three wires
     you're actually looking at, so the cost stays trivial. */
  .wire-flow {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-dasharray: 0.5 16;
    opacity: 0.9;
    animation: ${drift} 1.9s linear infinite;
  }

  .wire-flow.is-back { animation-direction: reverse; }

  .wire.is-synergy { opacity: 0.16; }
  .wire.is-synergy .wire-line { stroke-dasharray: 4 5; }
  .wire.is-dormant .wire-line { stroke-dasharray: 3 6; }
  .wire.is-dormant { opacity: 0.22; }
  .wire.is-dim { opacity: 0.05; }

  .wire.is-lit {
    opacity: 1;
    filter: drop-shadow(0 0 4px currentColor);
  }

  .wire.is-lit .wire-line { stroke-width: 2; stroke-dasharray: none; }
  .wire.is-lit .wire-port { opacity: 1; }

  /* Surveying a layer: present but understated. Showing these at full strength
     is what turned the board into spaghetti the first time round. */
  .wire.is-survey { opacity: 0.5; }
  .wire.is-survey .wire-line { stroke-width: 1.4; stroke-dasharray: none; }
  .wire.is-survey.is-dormant { opacity: 0.24; }
  .wire.is-survey.is-dormant .wire-line { stroke-dasharray: 3 6; }

  /* Structure reads first; integrations stay a thinner, quieter dashed line. */
  .wire.is-synergy.is-lit { opacity: 0.66; }
  .wire.is-synergy.is-lit .wire-line { stroke-dasharray: 5 6; stroke-width: 1.3; }

  /* --------------------------------------------------------------- packets */

  /* The route is its own layer whose opacity fades — a compositor job. The chip
     rides an offset-path, which Chrome turns into a transform. Neither touches
     the wire SVG, which is what kept the tab alive. */
  /* No z-index here on purpose: it would create a stacking context and trap
     the two children together. The route needs to sit *under* the cards so a
     card occludes it — that is what makes a packet look like it enters a node
     and comes out the other side — while the chip rides above everything. */
  .packet {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .packet-route {
    position: absolute;
    inset: 0;
    z-index: 3;
    opacity: 0;
    will-change: opacity;
  }

  /* The line is drawn in step with the packet rather than appearing whole —
     that is what makes one route legible where thirty at once were not. */
  .packet-route path {
    fill: none;
    stroke: var(--flight, #8fd0ff);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    filter: drop-shadow(0 0 6px var(--flight-soft, rgba(143, 208, 255, 0.45)));
  }

  .route-port {
    fill: var(--flight, #cfe6ff);
    stroke: rgba(10, 30, 70, 0.9);
    stroke-width: 1.5;
    opacity: 0;
    filter: drop-shadow(0 0 5px var(--flight-soft, rgba(143, 208, 255, 0.9)));
  }

  .packet.is-ghost .route-port {
    fill: rgba(214, 228, 246, 0.85);
    filter: none;
  }

  /* Icon only. A label can't be read while it's moving, and the words are in
     the readout anyway — which also means a new journey costs one glyph. */
  .packet-chip {
    position: absolute;
    z-index: 6;
    left: 0;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(9, 20, 44, 0.94);
    border: 1.5px solid var(--flight, #8fd0ff);
    box-shadow: 0 4px 14px rgba(3, 22, 62, 0.5), 0 0 16px var(--flight-soft, rgba(143, 208, 255, 0.45));
    offset-rotate: 0deg;
    /* Dead centre on the path. Anchoring it above looked fine on horizontal
       runs and plainly wrong on vertical ones, where the offset shifts the
       icon along the wire instead of beside it. */
    offset-anchor: 50% 50%;
    offset-distance: 0%;
    opacity: 0;
    will-change: transform, opacity;
  }

  .chip-glyph { font-size: 17px; line-height: 1; }

  /* A ghost is greyed *towards* the colour of the plugin it would need, rather
     than to flat grey. It still reads as "not yours yet" — muted, dashed chip,
     no glow — but keeps enough identity to tell one missing plugin from
     another. On a site with nothing installed every journey is a ghost, and
     flat grey left the board that is meant to sell them with no colour at all. */
  .packet.is-ghost .packet-route path {
    stroke: color-mix(in srgb, var(--flight, #bacce8) 40%, #b9c8de);
    filter: none;
  }

  .packet.is-ghost .packet-chip {
    background: rgba(9, 20, 44, 0.82);
    border-color: color-mix(in srgb, var(--flight, #bacce8) 45%, rgba(186, 204, 232, 0.75));
    border-style: dashed;
    box-shadow: 0 4px 12px rgba(3, 22, 62, 0.45);
  }

  .packet.is-ghost .chip-glyph { opacity: 0.55; }

  /* Section labels live in the panel's top padding, so a divided row costs no
     extra height — the board is already tight vertically. */
  /* White, not the layer accent: the accents are close enough to the panel
     colour that a label drawn in one is barely there. */
  .section-label {
    position: absolute;
    /* Sits in the row's headroom, breathing on both sides rather than wedged
       between the panel edge and the cards. */
    top: calc(var(--headroom, 0px) - 3px);
    /* Pinned, because the inherited line box was twice the glyph height and
       pushed the label down onto the cards. */
    line-height: 1;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.5);
  }

  .section-rule {
    position: absolute;
    top: calc(var(--headroom, 0px) + 12px);
    bottom: 12px;
    width: 1px;
    background: linear-gradient(180deg,
      transparent,
      rgba(255, 255, 255, 0.2) 25%,
      rgba(255, 255, 255, 0.2) 75%,
      transparent);
  }


  /* ------------------------------------------------------------------ nodes */

  .node {
    position: absolute;
    z-index: 4;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 10px;
    margin: 0;
    text-align: left;
    overflow: hidden;
    border: 1px solid var(--edge, rgba(255, 255, 255, 0.14));
    border-radius: 13px;
    background:
      linear-gradient(158deg, var(--tint, rgba(255, 255, 255, 0.1)), rgba(255, 255, 255, 0.07));
    box-shadow: 0 3px 12px rgba(3, 22, 62, 0.22),
                inset 0 1px 0 rgba(255, 255, 255, 0.12);
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1),
                opacity 0.25s ease, border-color 0.25s ease,
                background 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
  }

  .node:focus { outline: none; }

  .node-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  /* Seven workshop cards are too narrow for a name beside an icon. */
  .node.is-stacked { padding: 0 6px; }

  .node.is-stacked .node-head {
    flex-direction: column;
    gap: 9px;
    text-align: center;
  }

  .node.is-stacked .node-name { text-align: center; }
  .node.is-stacked .node-mark,
  .node.is-stacked .node-mark img { width: 48px; height: 48px; }

  /* Zoomed in: the card grows down into the empty routing band and lists what
     the thing actually gives you. Nothing else on the board moves. */


  .node-mark {
    position: relative;
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* The accent radiating from behind the icon. The plugin artwork is mostly
     grey cats, so without this the colour only ever showed up as a hairline. */
  .node-mark::before {
    content: '';
    position: absolute;
    /* 6px, not more: the cards clip their overflow and the shortest row is only
       50px tall, so a wider halo gets a hard edge sliced off it. */
    inset: -6px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--glow, transparent) 0%, transparent 68%);
    opacity: 0.85;
    transition: opacity 0.25s ease;
  }

  .node-mark img,
  .node-mark svg { position: relative; }

  /* A tile behind the artwork, in the plugin's own colour. The icons come from
     ps.w.org, so a site with no outbound internet gets none of them — without
     this that left a blank 36px gap and a name, which reads as broken. The
     artwork is opaque and covers this whenever it does load. */
  .node-mark img {
    width: 36px;
    height: 36px;
    border-radius: 11px;
    display: block;
    background: color-mix(in srgb, var(--accent, #8fb3d9) 20%, rgba(255, 255, 255, 0.07));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: filter 0.3s ease, opacity 0.3s ease;
  }

  .node-name {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: 0;
    color: rgba(255, 255, 255, 0.94);
    transition: color 0.25s ease;
  }

  .node-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .node-dot.is-active {
    background: #2bd47d;
    box-shadow: 0 0 7px rgba(43, 212, 125, 0.9);
  }

  .node-dot.is-inactive { background: rgba(255, 255, 255, 0.42); }

  /* The world layer is context, not product — quieter by design. */
  /* The outside world keeps its own soft colour, like every other card. This
     used to flatten all four to the same grey, which made the accents defined
     for them dead data and left the top row the deadest thing on the board.
     They stay the quietest cards — their accents are barely saturated — but
     Visitors is no longer indistinguishable from Inboxes. */
  .node.is-world {
    background: linear-gradient(158deg, var(--tint), rgba(255, 255, 255, 0.04));
    border-color: var(--edge);
    border-radius: 24px;
  }

  /* Round, where everything inside your site is rectangular: these are people
     and places out there, not modules you own. */
  .node.is-world .node-mark {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.09);
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 38%, transparent);
  }

  /* The badge replaces the halo rather than sitting on top of it. */
  .node.is-world .node-mark::before { display: none; }

  .node.is-world .node-name { color: rgba(255, 255, 255, 0.8); font-weight: 600; }

  .node.is-core .node-mark { width: 32px; height: 32px; }

  /* A plugin sitting in the Core row is part of the platform, so it carries its
     own colour rather than the neutral core surface. */
  .node.is-standout {
    background: linear-gradient(158deg, var(--tint-strong), rgba(255, 255, 255, 0.09));
    border-color: var(--accent);
    box-shadow: 0 4px 16px rgba(3, 22, 62, 0.3),
                0 0 18px var(--glow),
                inset 0 1px 0 rgba(255, 255, 255, 0.16);
  }

  .node.is-standout .node-name { color: white; font-weight: 700; }
  .node.is-standout .node-mark,
  .node.is-standout .node-mark img { width: 42px; height: 42px; }

  .node.is-core {
    border-color: rgba(255, 255, 255, 0.24);
    background: linear-gradient(158deg, rgba(255, 255, 255, 0.17), rgba(255, 255, 255, 0.09));
  }

  .node.is-core .node-name { color: white; }

  /* Not installed: present on the board, visibly not wired in. */
  .node.is-dormant {
    background: rgba(255, 255, 255, 0.022);
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: none;
  }

  .node.is-dormant .node-mark img { filter: grayscale(1) brightness(0.75); opacity: 0.5; }
  .node.is-dormant .node-name { color: rgba(255, 255, 255, 0.5); font-weight: 500; }

  .node.is-inactive .node-mark img { filter: grayscale(0.45); opacity: 0.8; }

  /* The plugin a ghost journey is waiting on. It keeps its dashed, greyed
     treatment — it still isn't installed — but comes far enough forward to be
     read as the missing piece of the story currently crossing the board. */
  .node.is-wanted {
    border-color: var(--edge);
    animation: ${beckon} 1.5s ease-in-out infinite;
  }

  .node.is-wanted .node-mark img { filter: grayscale(0.3); opacity: 0.95; }
  .node.is-wanted .node-name { color: rgba(255, 255, 255, 0.92); font-weight: 650; }
  .node.is-wanted .node-mark::before { opacity: 1; }

  .node:hover,
  .node:focus-visible,
  .node.is-focus {
    transform: translateY(-2px);
    border-style: solid;
    border-color: var(--accent, rgba(255, 255, 255, 0.45));
    background: linear-gradient(158deg, var(--tint-strong), rgba(255, 255, 255, 0.13));
    box-shadow: 0 10px 24px rgba(3, 22, 62, 0.34),
                0 0 22px var(--glow),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  /* Held, not hovered. Clicking a card locks the readout and brings out the
     wires it pairs with, and the board deliberately stops following the mouse
     for as long as it holds — focus is pinned-or-hovered, and pinned wins.
     Sharing the hover treatment meant that stopped looking like a mode and
     started looking like a bug: you move the pointer, nothing responds, and the
     card you are no longer pointing at is still lit. A steady ring says which
     card is doing it. Click it again, or anywhere on the board, to let go.

     (No backticks in here: this is a comment inside a template literal, and one
     stray backtick ends the CSS and the file stops parsing.) */
  .node.is-pinned {
    outline: 2px solid var(--accent, rgba(255, 255, 255, 0.6));
    outline-offset: 3px;
  }

  .node:hover .node-mark img,
  .node.is-focus .node-mark img { filter: none; opacity: 1; }

  /* Keyboard focus needs its own mark. Sharing the hover treatment meant the
     only signal was a 2px lift, which is not something you can follow while
     tabbing. Ringed in the card's own colour so it reads on the blue. */
  .node:focus-visible,
  .layer-panel:focus-visible {
    outline: 2px solid var(--accent, var(--layer, #cfe0ff));
    outline-offset: 3px;
  }

  .layer-panel:focus-visible {
    --lift: 0.13;
    --lift-soft: 0.09;
  }

  .node:hover .node-name,
  .node.is-focus .node-name { color: white; }

  .node.is-dim {
    opacity: 0.26;
    filter: saturate(0.4);
  }

  /* The module a packet has just reached. */
  /* Coloured by the journey that just arrived, falling back to the old cyan if
     a pulse ever fires without one. */
  .node.is-pulse {
    border-color: var(--pulse, #8fd0ff);
    background: linear-gradient(160deg,
      var(--pulse-soft, rgba(143, 208, 255, 0.22)),
      rgba(255, 255, 255, 0.07));
    box-shadow: 0 0 0 1px var(--pulse-glow, rgba(143, 208, 255, 0.5)),
                0 0 22px var(--pulse-glow, rgba(143, 208, 255, 0.35));
  }

  .node.is-pulse .node-name { color: white; }
  .node.is-pulse .node-mark img { filter: none; opacity: 1; }

  /* Asked for less motion: the board goes still. Packets never spawn at all
     (canAnimatePackets checks the same query), but the wire flow starts on
     hover, which has nothing to do with packets — so it has to be stopped
     here or it loops for exactly the people who asked it not to. */
  @media (prefers-reduced-motion: reduce) {
    .packet { display: none; }
    .wire-flow { display: none; }
    .node.is-wanted { animation: none; }
    .node,
    .layer-panel,
    .node-mark::before { transition: none; }
  }
`;

// Cancels the tab's own 18px padding so the board runs to the edges.
const StyledViewArea = Styled.div`
  position: relative;
  margin: -18px;

  /* Sides and bottom only. The 56px that used to sit on top was clearance for
     the view toggle, back when it floated over the grid rather than living in
     the header strip. All it did once the toggle moved was shove the header 56px
     down the page and make it jump when you switched views. The grid still gets
     its side and bottom padding back, because cards are ordinary content and
     shouldn't run to the edges the way the board does. */
  &.is-grid {
    padding: 0 18px 18px;
  }

  /* The strip carries its own side margin for the board, where the shell runs
     edge to edge. In the grid that margin stacked on top of the padding above
     and left the header sitting 14px inside the cards it belongs to. */
  &.is-grid ${StyledBoardHeader} {
    margin-left: 2px;
    margin-right: 2px;
  }
`;

const StyledViewToggle = Styled.div`
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  z-index: 20;
  display: inline-flex;
  padding: 3px;
  border-radius: 10px;
  background: rgba(3, 22, 62, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);

  button {
    appearance: none;
    border: 0;
    background: none;
    cursor: pointer;
    width: 32px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    color: rgba(255, 255, 255, 0.55);
    transition: background 0.18s ease, color 0.18s ease;
  }

  button svg { display: block; }
  button:hover { color: white; }
  button { ${focusRing} }

  button.is-on {
    background: rgba(255, 255, 255, 0.16);
    color: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
`;

const STAGE = { w: STAGE_W, h: STAGE_H };

export { StyledBoardShell, StyledBoardHeader, StyledStage, StyledViewArea, StyledViewToggle, STAGE };
