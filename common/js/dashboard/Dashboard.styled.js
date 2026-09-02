// React & Vendor Libs
import Styled, { keyframes } from 'styled-components';

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

// A tab's opening sentence. Replaces the old TabText wrapper, whose 20px of
// side padding sat on top of the panel's own 18px and pushed whatever it held
// 18px further in than everything below it — the intro hung out past the cards
// it introduced, and the log console was inset 38px a side while every other
// tab sat at 20px.
//
// Capped at a readable measure too: full width this ran to 1169px, about twice
// the line length anyone can comfortably track back to the next line.
// The note from Jordy, signed at the foot of the Meow Apps tab. It used to be a
// white NekoIntro card above the tab bar, which followed you onto Health and
// Settings and cost 108px on every screen. Down here on the blue workspace a
// white card reads as a slab dropped on the page, so it is set as a colophon
// instead: a rule, then quiet light-on-blue text the width of the board.
const StyledIntro = Styled.div`
  position: relative;
  /* No rule above it. The note is quiet enough to sit at the end on its own, and
     a line across the page announced it as another section — so the gap has to
     do that work instead, and has to be big enough to read as one.

     Note that StyledViewArea above carries margin: -18px, which bleeds the board
     out to the panel edges and takes 18px off whatever this asks for — so what
     lands on screen is 18px less than the number here. */
  margin: 35px 2px 0;
  padding: 0 34px 2px 0;

  p {
    margin: 0;
    /* Long enough to hold the note in three lines at full width, short enough
       that the eye still finds the next line on a wide screen. */
    max-width: 104ch;
    font-size: 12.5px;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.62);
  }

  a {
    color: #7dedff;
    text-decoration: none;
  }

  a:hover { text-decoration: underline; }

  /* NekoIntro appended this to external links; the plain paragraph that replaced
     it keeps the habit rather than dropping the cue. */
  a[target="_blank"]::after {
    content: ' ↗';
    font-size: 0.85em;
    opacity: 0.75;
  }

  .intro-fold {
    position: absolute;
    top: -4px;
    right: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
    line-height: 1;
    border-radius: 7px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.35);
    background: transparent;
    border: 1px solid transparent;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .intro-fold:hover {
    color: white;
    background: rgba(255, 255, 255, 0.12);
  }

  .intro-fold:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.92);
    outline-offset: 2px;
  }

  &.is-folded {
    padding-right: 0;
    padding-bottom: 0;
  }

  /* Folded, all that is left is the way back in — a full-width strip with a
     single "?" on it. A pill carrying the whole sentence was still a sentence,
     which is what folding it was meant to get rid of; a bar that spans the board
     reads as a lid on something rather than as another line to read. */
  .intro-peek {
    display: block;
    width: 100%;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    padding: 9px 0;
    border-radius: 10px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.42);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.11);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .intro-peek:hover { color: white; background: rgba(255, 255, 255, 0.12); }

  /* Same ring as focusRing below, written out because that const is declared
     after this one and a template literal is evaluated where it is written. */
  .intro-peek:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.92);
    outline-offset: 2px;
    box-shadow: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .intro-fold, .intro-peek { transition: none; }
  }
`;

// A settings row whose control is a button rather than a checkbox. Sits on
// NekoUI's white card, so it takes dark text rather than the light-on-blue used
// everywhere else on this page.
const StyledSettingAction = Styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  /* Named, not a bare "span". NekoButton puts its label in a span of its own, so
     a descendant selector reached inside the button and greyed the label — a red
     button with unreadable text on it. */
  .action-note {
    font-size: 12px;
    line-height: 1.5;
    color: var(--neko-gray-60, rgba(0, 0, 0, 0.55));
  }
`;

// Visible to screen readers, invisible on screen — for state the design shows
// with colour alone.
const srOnly = `
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
`;

// NekoUI's keyboard focus ring is a translucent brand blue, sized for the white
// cards it normally sits on. Every control on this page sits on a blue panel
// instead, where a 24%-alpha blue ring is invisible — tabbing onto a filter chip
// showed no change whatsoever. Anything focusable on a dark surface gets a light
// ring instead. :focus-visible, so it appears for keyboard users without putting
// a ring around everything anyone clicks.
const focusRing = `
  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.92);
    outline-offset: 2px;
    box-shadow: none;
  }
`;

// One heading spec, shared by the plugin groups in the grid and the further
// reading block on the Performance tab, so the two sections are the same idea
// rendered the same way rather than two near-misses.
const sectionHead = `
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  padding: 0 2px 7px;
  margin-bottom: 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);

  h3 {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.82);
  }

  .head-note {
    font-size: 11.5px;
    color: rgba(255, 255, 255, 0.55);
  }
`;

const StyledPluginGrid = Styled.div`
  display: grid;
  /* 340px is what a card needs for its capabilities to sit two-by-two without
     truncating. At 300px a wide screen squeezed in a fourth column and made
     every card narrower instead of wider — eleven chips ellipsised rather than
     three. The floor keeps the columns honest; 1fr still shares out the slack. */
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
  /* The 2px matches the group heading above, so cards, heading and the header
     strip at the top of the tab all share one left edge. */
  padding: 0 2px;
`;

// Thirteen cards used to arrive as one undifferentiated wall. What you have and
// what you don't is the whole point of this view — it's the marketing surface —
// and the two states differed only by a grayscale filter on the icon, with the
// boundary between them falling in the middle of a row.
const StyledPluginGroups = Styled.div`
  margin-top: 18px;

  .plugin-group + .plugin-group { margin-top: 22px; }

  .group-head { ${sectionHead} }

  .group-head b {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0;
    padding: 1px 7px;
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.12);
    font-variant-numeric: tabular-nums;
  }

  /* The running group is the one that's working; the offer at the bottom gets a
     warmer rule so it reads as an invitation rather than a leftovers bin. */
  .plugin-group.is-active .group-head { border-bottom-color: rgba(43, 212, 125, 0.4); }
  .plugin-group.is-active .group-head b {
    color: #2bd47d;
    background: rgba(43, 212, 125, 0.16);
  }

  .plugin-group.is-none .group-head { border-bottom-color: rgba(255, 200, 87, 0.34); }
  .plugin-group.is-none .group-head b {
    color: #ffc857;
    background: rgba(255, 200, 87, 0.16);
  }
`;

// Deliberately quiet: a thin card, one accent hairline, no gradients. The board
// is where the personality lives; this is the version you scan.
const StyledPluginCard = Styled.div`
  ${srOnly}
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: rgba(6, 18, 42, 0.30);
  border: 1px solid rgba(255, 255, 255, 0.14);
  overflow: hidden;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--accent, transparent);
    opacity: 0.75;
  }

  &:hover {
    background: rgba(6, 18, 42, 0.44);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  &.is-dormant {
    background: rgba(6, 18, 42, 0.14);
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.16);
  }

  /* The board already goes still when less motion is asked for; everything built
     since owes the same. Colour and border still respond to hover — it's the
     movement that's the problem, not the feedback. */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover { transform: none; }
    .card-main img { transition: none; }
  }

  &.is-dormant::before { opacity: 0.3; }
  &.is-dormant img { filter: grayscale(1); opacity: 0.5; }
  &.is-dormant:hover img { filter: none; opacity: 1; }

  &.is-inactive img { filter: grayscale(0.4); opacity: 0.82; }

  .card-main {
    display: flex;
    flex-direction: column;
    padding: 15px 16px 13px 17px;
    text-decoration: none;
    flex: 1 1 auto;
    ${focusRing}
  }

  .card-foot a { ${focusRing} }

  .card-head {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    min-width: 0;
  }

  /* Same tinted tile as the board: the icons are fetched from ps.w.org and a
     firewalled site would otherwise show a blank square beside each name. */
  .card-main img {
    flex: 0 0 auto;
    width: 42px;
    height: 42px;
    border-radius: 11px;
    display: block;
    background: color-mix(in srgb, var(--accent, #8fb3d9) 20%, rgba(255, 255, 255, 0.07));
    transition: filter 0.2s ease, opacity 0.2s ease;
  }

  .card-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13.5px;
    font-weight: 650;
    line-height: 1.2;
    color: white;
  }

  .card-title .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: 0 0 auto;
  }

  .card-title .dot.on { background: #2bd47d; box-shadow: 0 0 6px rgba(43, 212, 125, 0.9); }
  .card-title .dot.off { background: rgba(255, 255, 255, 0.4); }

  .card-role {
    font-size: 11.5px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.66);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Two fixed columns, so four capabilities are always a 2x2 and every card in
     the grid ends up exactly the same height. Wrapping freely gave two, three
     or four rows depending on how long the words happened to be. */
  .card-features {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    margin-top: 11px;
  }

  .card-features > span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    font-size: 10.5px;
    line-height: 1.2;
    padding: 4px 8px;
    border-radius: 6px;
    white-space: nowrap;
    /* the whole card is a link, so the chips have to opt out of link colour */
    color: rgba(255, 255, 255, 0.82);
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.09);
  }

  .card-features svg { flex: 0 0 auto; opacity: 0.7; }

  /* The three longest labels don't fit half a card; they ellipsis and the chip
     carries the full text as a tooltip. */
  .card-features em {
    font-style: normal;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &.is-dormant .card-features span {
    color: rgba(255, 255, 255, 0.55);
    background: rgba(255, 255, 255, 0.04);
  }

  .card-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px 13px 17px;
  }

  .card-family {
    flex: 1 1 auto;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.32);
  }

  .card-foot a {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    padding: 4px 11px;
    border-radius: 7px;
    color: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.16);
    transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
  }

  .card-foot a:hover {
    background: rgba(255, 255, 255, 0.14);
    color: white;
  }

  .card-foot a.pro {
    color: #ffd48a;
    border-color: rgba(255, 186, 66, 0.4);
  }

  .card-foot a.pro:hover {
    background: rgba(255, 186, 66, 0.22);
    color: white;
  }
`;

// The three tests used to be bare gauges floating in a space-around flex row,
// with the thresholds explained in a paragraph above them. Each is now a card
// carrying its own number, verdict and one-line explanation, so a test is
// readable without reading anything else.
const StyledSpeedTests = Styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  /* No bottom margin of its own — the section it sits in sets the space under
     its content, the same for all five. */
  margin: 0 2px;
`;

const StyledSpeedTest = Styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 16px 16px 15px;
  border-radius: 12px;
  background: rgba(6, 18, 42, 0.30);
  border: 1px solid rgba(255, 255, 255, 0.14);
  transition: border-color 0.2s ease, background 0.2s ease;

  &.is-running {
    border-color: rgba(255, 255, 255, 0.34);
    background: rgba(6, 18, 42, 0.44);
  }

  h3 {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0;
    color: white;
  }

  .gauge-value {
    display: flex;
    align-items: baseline;
    gap: 3px;
    font-size: 26px;
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: white;
  }

  .gauge-value i {
    font-style: normal;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }

  .gauge-sub {
    margin-top: 5px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .verdict {
    margin-top: 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 999px;
    /* Before a run this slot states the target instead of sitting empty, so the
       number you're about to get already has something to be measured against. */
    color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .verdict.is-fast {
    color: #2bd47d;
    background: rgba(43, 212, 125, 0.14);
    border-color: rgba(43, 212, 125, 0.4);
  }

  .verdict.is-fair {
    color: #ffc857;
    background: rgba(255, 200, 87, 0.14);
    border-color: rgba(255, 200, 87, 0.4);
  }

  .verdict.is-slow {
    color: #ff8080;
    background: rgba(255, 107, 107, 0.16);
    border-color: rgba(255, 107, 107, 0.45);
  }

  /* Distinct from is-slow: a slow answer is a result, no answer is a fault. */
  .verdict.is-failed {
    color: #ffd0a0;
    background: rgba(255, 143, 90, 0.16);
    border-color: rgba(255, 143, 90, 0.5);
  }

  .hint {
    margin: 10px 0 12px;
    font-size: 11.5px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.62);
  }

  /* Pushes the button to the bottom so all three line up even when one hint
     wraps to an extra line. */
  .hint + button { margin-top: auto; }

  button { width: 100%; }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    /* The gauge sweeps its arc on every one of the ten samples. NekoGauge sets
       that transition inline, so !important is the only thing that reaches it. */
    .neko-gauge path { transition: none !important; }
  }
`;

// The merged Health tab. Sections are separated by space and a heading rather
// than by boxes: each one already brings its own panel (gauges, the phpinfo
// scroller, the log console), and wrapping those in further containers would be
// a box inside a box inside a tab.
const StyledHealth = Styled.div`
  /* No side margin of its own. Everything it wraps — the speed bar, the gauges,
     the phpinfo panel, the log console — already carries margin: 0 2px, and the
     section headings get the same 2px from sectionHead's padding. Adding 2px
     here as well double-inset the lot to 4px, and the override that was meant to
     cancel it named .php-body and .logs-bar, which have no side margin to
     cancel. One inset, set in one place, by the pieces themselves. */
  /* Folded, the tab is a list of rows, so it is built like one. Every heading is
     the same height whether or not it carries a button, with the same space above
     and below its text, and the rule sits at the bottom of that box — which puts
     each line exactly halfway between the title above it and the title below.
     Before this the heading kept 7px under it and 26px over the next one, so the
     rules looked stuck to the wrong titles. */
  .section-head {
    ${sectionHead}
    align-items: center;
    min-height: 30px;
    padding: 11px 2px;
    margin-bottom: 0;
  }

  .health-section + .health-section {
    margin-top: 0;
    padding-top: 0;
  }

  /* Opened, the section needs its content off the rule above it, and off the
     next heading below — the same 11px the headings use, so the rhythm carries
     on rather than restarting. */
  .section-head.is-open { margin-bottom: 14px; }
  .health-section.is-open { padding-bottom: 11px; }

  /* The overview: three ratings over six PHP values, one surface, no heading of
     its own. It is the top of the tab and it is the answer — labelling it would
     be labelling the page.

     A plain translucent black rather than the tinted gradient it had: it sinks
     into whatever blue is behind it instead of carrying a navy of its own, and
     the cards keep the only colour on the panel. */
  .health-top {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #00000029;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top-color: rgba(255, 255, 255, 0.18);
    border-radius: 14px;
    padding: 14px;
    margin: 0 2px 12px;
  }

  /* The six values are supporting evidence for the three ratings above them, so
     they sit quieter — a hairline separates the two rather than a gap alone,
     which left the panel reading as two unrelated rows of boxes. */
  .health-top .php-facts {
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* The offer keeps a surface of its own — it is a pitch, not a section. The
     analysis body went flat once the overview took the top: two panels stacked,
     one inside the other's shadow, read as a box in a box. */
  .analysis-body { margin: 0 2px; }

  .analysis-offer {
    background: rgba(0, 24, 40, 0.42);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 16px 18px;
    margin: 0 2px;
  }

  .analysis-offer { display: flex; align-items: center; gap: 16px; }
  .analysis-offer svg { flex: 0 0 auto; color: #ffc857; }
  .analysis-offer > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .analysis-offer strong { font-size: 13.5px; font-weight: 650; color: white; }
  .analysis-offer span { font-size: 12px; line-height: 1.55; color: rgba(255, 255, 255, 0.66); }

  .analysis-cta {
    flex: 0 0 auto;
    margin-left: auto;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    padding: 8px 14px;
    border-radius: 9px;
    color: white;
    background: linear-gradient(135deg, #3f7bec, #2f5fbd);
    ${focusRing}
  }

  /* Button first, explanation beside it — the same shape as Speed's and Errors'
     bars, and always visible for the same reason. The disclosure used to sit
     above the button as a bulleted list, which made a two-second action look
     like a form to be agreed to. */
  /* What the section says about itself when it is folded: what was found, and
     when. The count is lit the way the error summary lights its own, so the two
     folded sections read as the same kind of line. */
  .analysis-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.62);
  }

  .analysis-note b { color: white; font-variant-numeric: tabular-nums; }

  .analysis-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .analysis-steps li {
    display: flex;
    align-items: center;
    gap: 11px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.36);
  }

  /* Each step carries its own state in the marker: waiting is a hollow ring,
     working spins, finished is a tick. Without it the list just sat there and
     the long last step looked like nothing was happening. */
  .analysis-steps i {
    position: relative;
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.18);
  }

  .analysis-steps .is-done { color: rgba(255, 255, 255, 0.72); }
  .analysis-steps .is-done i {
    border-color: #2bd47d;
    background: #2bd47d;
  }

  /* The tick, drawn rather than fonted so it lands the same everywhere.
     Centred off the middle rather than nudged in from the corner: the glyph is
     an L rotated 45°, so its own box has to be centred first and turned second,
     or it sits low and left the way hardcoded offsets left it. The -55% lifts it
     by the half-stroke the rotation adds below the join. */
  .analysis-steps .is-done i::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 4px;
    height: 8px;
    border: solid #ffffff;
    border-width: 0 2px 2px 0;
    transform: translate(-50%, -55%) rotate(45deg);
  }

  .analysis-steps .is-now { color: white; }
  .analysis-steps .is-now i {
    border-color: rgba(255, 200, 87, 0.25);
    border-top-color: #ffc857;
    animation: ${spin} 0.7s linear infinite;
  }

  /* Asked for less motion: the ring stops and simply shows which step is live. */
  @media (prefers-reduced-motion: reduce) {
    .analysis-steps .is-now i {
      animation: none;
      border-color: #ffc857;
      background: rgba(255, 200, 87, 0.35);
    }
  }

  .analysis-steps .step-note {
    margin-left: auto;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.42);
  }

  .analysis-error {
    font-size: 12.5px;
    line-height: 1.55;
    color: #ffd0a0;
  }

  .analysis-error span {
    display: block;
    margin-top: 3px;
    font-size: 11.5px;
    color: rgba(255, 255, 255, 0.5);
  }

  .analysis-areas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
  }

  /* The rating was five 7px dots and nothing else — the one thing the eye should
     catch from across the room, hidden in 35 pixels. The card now carries its own
     verdict: a tinted wash, a tinted edge, and the icon in the same colour. Read
     at a glance it is green, amber or red; read properly it still says why. */
  .analysis-area {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 11px 13px;
    border-radius: 10px;
    background:
      linear-gradient(155deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
      var(--tone-wash, transparent);
    border: 1px solid var(--tone-edge, rgba(255, 255, 255, 0.1));
  }

  .analysis-area.is-good {
    --tone-wash: linear-gradient(155deg, rgba(43, 212, 125, 0.16), rgba(43, 212, 125, 0.03));
    --tone-edge: rgba(43, 212, 125, 0.32);
  }

  .analysis-area.is-fair {
    --tone-wash: linear-gradient(155deg, rgba(255, 200, 87, 0.16), rgba(255, 200, 87, 0.03));
    --tone-edge: rgba(255, 200, 87, 0.32);
  }

  .analysis-area.is-poor {
    --tone-wash: linear-gradient(155deg, rgba(255, 128, 128, 0.18), rgba(255, 128, 128, 0.03));
    --tone-edge: rgba(255, 128, 128, 0.34);
  }

  .analysis-area.is-good .area-name svg { color: #2bd47d; }
  .analysis-area.is-fair .area-name svg { color: #ffc857; }
  .analysis-area.is-poor .area-name svg { color: #ff8080; }

  /* Unrated, the card still shows its shape — name, five empty dots, and what it
     is waiting for. Dimmed enough to read as "not yet" rather than "nothing". */
  .analysis-area.is-blank {
    background: rgba(255, 255, 255, 0.025);
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.12);
  }
  .analysis-area.is-blank .area-name { color: rgba(255, 255, 255, 0.34); }
  .analysis-area.is-blank .area-label { color: rgba(255, 255, 255, 0.44); font-weight: 600; }
  .analysis-area.is-blank .area-summary { color: rgba(255, 255, 255, 0.32); }
  .analysis-area.is-blank .area-dots i { background: rgba(255, 255, 255, 0.09); }

  /* The same icon the section below wears, so the card that rates Speed and the
     section that measures it are visibly the same subject. */
  .area-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
  }

  .area-name svg { flex: 0 0 auto; opacity: 0.85; }

  .area-dots { display: flex; gap: 3px; margin: 2px 0 1px; }
  .area-dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.16); }
  .analysis-area.is-good .area-dots i.on { background: #2bd47d; }
  .analysis-area.is-fair .area-dots i.on { background: #ffc857; }
  .analysis-area.is-poor .area-dots i.on { background: #ff8080; }

  /* The six values a support conversation turns on, lifted out of a 21,000px
     dump so they can be read rather than hunted for. They live in the overview
     rather than in the Environment section, next to the ratings that judge
     them — the numbers and the verdict on the numbers belong together. */
  .php-facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
    gap: 8px;
  }

  .php-fact {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 11px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  /* Hosts that disable phpinfo() get the labels and a dash: the shape of the
     answer is still worth showing when the answer isn't available. */
  .php-fact.is-blank { background: rgba(255, 255, 255, 0.02); }
  .php-fact.is-blank .fact-value { color: rgba(255, 255, 255, 0.3); }
  .php-fact.is-blank .fact-label { color: rgba(255, 255, 255, 0.34); }

  .fact-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.1;
    color: white;
    overflow-wrap: anywhere;
  }

  .fact-label {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
  }

  .area-label { font-size: 13px; font-weight: 650; color: white; }
  /* Dimmer than the verdict above it — the rating and its label are the answer,
     this is the footnote. */
  .area-summary { font-size: 11.5px; line-height: 1.5; color: rgba(255, 255, 255, 0.5); }

  /* Given a block of its own rather than left as a loose paragraph with two
     thirds of the panel empty beside it. The measure stays readable; the block
     fills the width, so it reads as the summary it is. */
  /* The headline sentence, so it is the brightest thing in the panel and it
     fills its box. It used to cap the text at 88ch inside a full-width block,
     which left a third of the block empty and read as a layout fault rather
     than as a measure. */
  .analysis-conclusion {
    margin: 0 0 14px;
    padding: 14px 17px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border-left: 3px solid rgba(255, 255, 255, 0.34);
    font-size: 14px;
    line-height: 1.55;
    color: #ffffff;
  }

  .analysis-conclusion span { display: block; }

  /* One column of folded rows. Two columns made sense when every finding was a
     block of prose; folded they are single lines, and a list of lines reads
     better stacked — and the reasoning, when opened, gets the full width. */
  .analysis-findings {
    list-style: none; margin: 0; padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .analysis-findings li {
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
    border-left: 3px solid rgba(255, 255, 255, 0.2);
    overflow: hidden;
  }

  .analysis-findings .is-high { border-left-color: #ff6b6b; }
  .analysis-findings .is-medium { border-left-color: #ffc857; }
  .analysis-findings .is-low { border-left-color: #74c0fc; }

  /* The whole row is the control, so the target is the line rather than a
     chevron somebody has to aim at. */
  .finding-head {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 13px;
    font-family: inherit;
    text-align: left;
    background: none;
    border: 0;
    cursor: pointer;
    transition: background 0.15s ease;
    ${focusRing}
  }

  .finding-head:hover { background: rgba(255, 255, 255, 0.05); }

  .finding-head b { flex: 1 1 auto; font-size: 13px; font-weight: 650; color: white; }
  .finding-head em {
    flex: 0 0 auto;
    font-style: normal; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgba(255, 255, 255, 0.42);
  }

  .finding-chevron {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border: solid rgba(255, 255, 255, 0.5);
    border-width: 0 1.5px 1.5px 0;
    transform: translateY(-2px) rotate(45deg);
    transition: transform 0.18s ease;
  }

  /* Anchored to the finding's own li. Left as a bare .is-open it also matched
     the section wrapper once Analysis became foldable, so opening the section
     turned every chevron upward while its finding was still shut. */
  .analysis-findings li.is-open .finding-chevron { transform: translateY(1px) rotate(-135deg); }

  .finding-more {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 13px 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .finding-head, .finding-chevron { transition: none; }
  }

  /* Three levels, not one. Everything used to be the same near-white, so the
     reasoning, the instruction and the title all carried equal weight and the
     eye had nowhere to land. The why recedes; the what-to-do steps forward
     behind an arrow in the finding's own severity colour. */
  .finding-detail {
    font-size: 12px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.52);
  }

  .finding-action {
    position: relative;
    padding-left: 22px;
    font-size: 12.5px;
    line-height: 1.55;
    font-weight: 500;
    color: #ffffff;
  }

  .finding-action::before {
    content: '→';
    position: absolute;
    left: 2px;
    top: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.45);
  }

  .is-high .finding-action::before { color: #ff6b6b; }
  .is-medium .finding-action::before { color: #ffc857; }
  .is-low .finding-action::before { color: #74c0fc; }

  /* Marked as ours, deliberately. A recommendation from the people who wrote the
     analysis should say so rather than read as neutral advice. */
  .finding-plugin {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    margin-top: 4px;
    padding: 5px 11px 5px 6px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    color: white;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
    ${focusRing}
  }

  .finding-plugin img { width: 20px; height: 20px; border-radius: 5px; }
  .finding-plugin i {
    font-style: normal; font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; color: rgba(255, 255, 255, 0.45);
  }

  .analysis-clean { margin: 0; font-size: 12.5px; color: rgba(255, 255, 255, 0.62); }

  /* Whichever of the disclosure, the steps, the error and the result are on
     screen, they space themselves the same way — and the first of them carries
     no top margin, so it can't collapse out through .analysis-body and push the
     whole section away from the rule above it.

     That is what made Analysis sit 16px under its rule while every other section
     sat at 14px: a margin on a first child, escaping its parent. */
  .analysis-body > * { margin-top: 0; }
  .analysis-body > * + * { margin-top: 14px; }

  /* Four headings each carrying a "Show tests" / "Show all values" / "Show log"
     pill was four different labels for one idea, and they read as actions rather
     than as state. A caret says foldable, says which way it is folded, and needs
     no words. */
  .section-head.is-toggle {
    position: relative;
    cursor: pointer;
  }

  /* The action and the caret travel together at the right end, and sit above the
     stretched hit area below — otherwise the row's own click handler would
     swallow the button and fold the section instead of running it. */
  .head-right {
    position: relative;
    z-index: 1;
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* NekoButton carries a 5px sibling margin for loose layouts; here the flex gap
     already spaces it, and the margin only pushes it off the right edge. */
  .head-right .neko-button { margin: 0; }

  .section-head.is-toggle h3 button {
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
    transition: color 0.15s ease;
    ${focusRing}
  }

  /* The whole heading row is the target, without putting an <h3> inside a
     <button> — which is what it would take to make the row itself the control,
     and isn't valid markup. One real button, stretched. */
  .section-head.is-toggle h3 button::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .section-head.is-toggle:hover h3 button { color: white; }
  .section-head.is-toggle:hover .head-caret { border-color: rgba(255, 255, 255, 0.8); }

  .head-caret {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    margin: -4px 4px 0 0;
    border: solid rgba(255, 255, 255, 0.45);
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg);
    transition: transform 0.2s ease, border-color 0.15s ease;
  }

  .head-caret.is-placeholder { visibility: hidden; }

  /* Dimmer than the word it introduces — an icon that matches the title's weight
     competes with it, and there are five of them down the tab. */
  .section-head h3 svg {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.42);
    transition: color 0.15s ease;
  }

  .section-head.is-toggle:hover h3 svg { color: rgba(255, 255, 255, 0.75); }

  @media (prefers-reduced-motion: reduce) {
    .section-head h3 svg { transition: none; }
  }

  /* Speed's note is its three timings rather than a sentence, once there are
     any. Same size and colour as the sentence it replaces, so the row of
     headings stays a row of headings — only the numbers are lit. */
  .head-note .speed-summary {
    display: inline-flex;
    align-items: baseline;
    gap: 14px;
    flex-wrap: wrap;
  }

  .head-note .speed-summary em {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    font-style: normal;
  }

  .head-note .speed-summary b {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    font-variant-numeric: tabular-nums;
  }

  .head-note .speed-summary .is-fast b { color: #2bd47d; }
  .head-note .speed-summary .is-fair b { color: #ffc857; }
  .head-note .speed-summary .is-slow b { color: #ff8080; }

  .section-head.is-open .head-caret { transform: translateY(3px) rotate(-135deg); }

  @media (prefers-reduced-motion: reduce) {
    .head-caret,
    .section-head.is-toggle h3 button { transition: none; }
  }

  /* Folded, phpinfo is the six facts and nothing else. Kept mounted rather than
     unmounted so the filter effect holds on to its host element. */
  .php-rest.is-hidden { display: none; }

  /* Same reason as .php-rest: hidden, not unmounted, so a folded section keeps
     working rather than losing what it knows. */
  .is-hidden { display: none; }

  /* .speed-summary and .logs-summary used to live down here as rows of their
     own. Both are heading notes now — see .head-note in StyledHealth. */
`;

const StyledFurtherReading = Styled.div`
  margin: 0 2px;
`;

const StyledArticleGrid = Styled.div`
  display: grid;
  /* Four articles, so the column count has to divide four. auto-fill with a
     320px floor gave three columns at this width, which left the fourth card
     alone on its own row at a third of the width — and shorter than the other
     three, because nothing shared its row to stretch it. */
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 2px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const StyledArticleCard = Styled.a`
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.10) 0%,
    rgba(255, 255, 255, 0.04) 100%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  text-decoration: none;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
  ${focusRing}
  transition: transform 0.2s var(--neko-ease-out, ease-out),
              box-shadow 0.2s var(--neko-ease-out, ease-out),
              background 0.2s var(--neko-ease-out, ease-out),
              border-color 0.2s var(--neko-ease-out, ease-out);
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    background: linear-gradient(135deg,
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0.08) 100%);
    border-color: rgba(255, 255, 255, 0.32);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.20);
  }

  .article-emoji {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.10);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }

  .article-body {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .article-title {
    color: white;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .article-blurb {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    line-height: 1.4;
  }

  .article-arrow {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.55);
    font-size: 18px;
    transition: transform 0.22s var(--neko-ease-out, ease-out),
                color 0.22s var(--neko-ease-out, ease-out);
  }

  &:hover .article-arrow {
    transform: translateX(3px);
    color: white;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover { transform: none; }
    .article-arrow { transition: none; }
    &:hover .article-arrow { transform: none; }
  }
`;

// phpinfo() arrived as a bright white box dropped onto the blue workspace — the
// one part of the page that looked like somebody else's product. Same dark
// console language as the error logs now, and the table is readable instead of
// merely present.
const StyledPhpInfo = Styled.div`
  margin: 0 2px;

  /* The six-value summary this used to render moved up to the tab's overview —
     see .php-facts in StyledHealth. What's left here is the dump itself. */
  .php-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .php-search { width: 300px; }

  .php-search input { ${focusRing} }

  .php-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-variant-numeric: tabular-nums;
  }

  .php-body {
    background: rgba(0, 24, 40, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    box-sizing: border-box;
    width: 100%;
    padding: 2px 14px 14px;
    max-height: 620px;
    overflow-y: auto;
    /* The old rule was "max-width: 100%" with the semicolon missing, which ate
       the declaration after it and left both doing nothing. */
    overflow-x: hidden;
  }

  .php-body .center { max-width: 100%; }

  .php-body h1 {
    margin: 16px 0 2px;
    font-size: 15px;
    font-weight: 650;
    color: white;
  }

  /* 59 extension sections; as headings they were 26px black-on-white and each
     one shouted as loudly as the PHP version. */
  .php-body h2 {
    margin: 20px 0 6px;
    padding-bottom: 5px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .php-body h2 a { color: inherit; text-decoration: none; }

  .php-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }

  .php-body td,
  .php-body th {
    padding: 5px 8px;
    font-size: 11.5px;
    line-height: 1.45;
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .php-body th {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .php-body td.e {
    width: 32%;
    font-weight: 600;
    color: #9fc7ff;
  }

  .php-body td.v {
    color: rgba(255, 255, 255, 0.86);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .php-body tr:hover td { background: rgba(255, 255, 255, 0.045); }

  .php-body hr {
    border: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    margin: 16px 0;
  }

  .php-body a { color: #7dedff; }

  .php-blank {
    padding: 26px 16px;
    text-align: center;
    font-size: 12.5px;
    color: rgba(255, 255, 255, 0.62);
  }

  /* The host-said-no state, laid out like the error log's empty states so the
     two read as the same product rather than two different apologies. */
  .php-blank.is-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 180px;
    padding: 32px 24px;
  }

  .php-blank.is-empty svg { color: #ff8f5a; }

  .php-blank.is-empty strong {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .php-blank.is-empty span {
    font-size: 12px;
    line-height: 1.55;
    max-width: 460px;
    color: rgba(255, 255, 255, 0.62);
  }

  .php-blank.is-empty code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.09);
  }
`;

// PHP's five error classes get five colours. Only fatal and warning used to be
// styled, so a notice, a parse error and an exception all arrived looking
// identical — and identical to nothing in particular.
const LOG_TONES = {
  fatal: '#ff6b6b',
  parse: '#ff8f5a',
  exception: '#ffa94d',
  warning: '#ffc857',
  notice: '#74c0fc',
};

const logTone = ( type ) => LOG_TONES[type] || '#adb5bd';

const StyledErrorLogs = Styled.div`
  /* Same 2px as the grid, the PHP Info panel and the speed cards, so every tab
     shares one left edge. */
  margin: 0 2px;
  color: rgba(255, 255, 255, 0.92);

  .logs-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;
  }

  .logs-filters {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .logs-filters button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.75);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .logs-filters button:hover {
    background: rgba(255, 255, 255, 0.16);
    color: white;
  }

  .logs-filters button { ${focusRing} }

  @media (prefers-reduced-motion: reduce) {
    .logs-filters button { transition: none; }
  }

  /* The lit chip carries its severity's colour, so the filter you're on and the
     rows it selects are visibly the same thing. */
  .logs-filters button.is-on {
    color: white;
    background: color-mix(in srgb, var(--tone, white) 26%, transparent);
    border-color: var(--tone, rgba(255, 255, 255, 0.5));
  }

  .logs-filters b {
    font-variant-numeric: tabular-nums;
    color: var(--tone, inherit);
  }

  .logs-filters button.is-on b { color: white; }

  .logs-meta {
    margin-left: auto;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.55);
  }

  .logs-console {
    background: rgba(0, 24, 40, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    /* Was calc(100vw - 276px): hardcoded to the width of an expanded admin menu,
       so the console hung 326px past the panel and clipped every long path.
       It's a block in a column; the column already knows how wide it is. */
    width: 100%;
    /* wp-admin doesn't set this globally, so width:100% plus the 1px border put
       the console 2px past its column. */
    box-sizing: border-box;
    max-height: 560px;
    min-height: 160px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .log-row {
    display: block;
    padding: 8px 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
  }

  .log-row + .log-row { border-top: 1px solid rgba(255, 255, 255, 0.07); }

  .log-row:hover { background: rgba(255, 255, 255, 0.04); }

  .log-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  .log-type {
    flex: 0 0 auto;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 5px;
    /* Dark text on the bright tone: white on amber failed contrast badly, and
       amber is the type you see most. */
    color: #071a2a;
    background: var(--tone);
  }

  .log-date {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    font-variant-numeric: tabular-nums;
  }

  /* Which plugin, theme or core file the path points at. Deliberately neutral —
     the severity pill owns the colour, this one only answers "whose is it". */
  .log-owner {
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 5px;
    color: rgba(255, 255, 255, 0.72);
    background: rgba(255, 255, 255, 0.09);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }

  /* How many times this exact message was logged. The date beside it is the most
     recent one; the tooltip carries the full span. */
  .log-count {
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 999px;
    font-variant-numeric: tabular-nums;
    color: var(--tone);
    /* Plain values first: an unparseable color-mix drops its whole declaration,
       which would leave the badge with no background and a 0px border. */
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: color-mix(in srgb, var(--tone) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--tone) 45%, transparent);
  }

  /* pre-wrap, not pre: stack traces and absolute paths are longer than any
     panel, and horizontal scrolling hid the end of every one of them. */
  .log-content {
    display: block;
    color: rgba(255, 255, 255, 0.9);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .logs-blank {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 160px;
    padding: 28px 24px;
    text-align: center;
  }

  .logs-blank svg { color: rgba(255, 255, 255, 0.4); }

  .logs-blank.is-failed svg { color: #ff8f5a; }

  .logs-blank strong {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .logs-blank span {
    font-size: 12px;
    line-height: 1.5;
    max-width: 460px;
    color: rgba(255, 255, 255, 0.62);
  }
`;

export { focusRing };
export { StyledSettingAction, StyledIntro, StyledHealth, StyledPluginGrid, StyledPluginGroups, StyledPluginCard,
  StyledArticleGrid, StyledArticleCard, StyledFurtherReading,
  StyledPhpInfo, StyledErrorLogs, logTone,
  StyledSpeedTests, StyledSpeedTest };