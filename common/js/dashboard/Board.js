/* eslint-disable react/no-unescaped-entities */
// React & Vendor Libs
const { useState, useEffect, useMemo, useRef, useCallback, Fragment } = wp.element;

import { LAYERS, LINKS, SYNERGIES, JOURNEYS, buildNodes, getNeighbours, getPartners,
  getJourneyColor, getInstallState, statusHint } from './plugins';
import { NekoIcon } from '@neko-ui';

import { BoardHeader } from './BoardHeader';
import { StyledBoardShell, StyledStage, STAGE } from './Board.styled';

// ---------------------------------------------------------------------------
// The board
//
// Four stacked layers: the world outside, the plugins facing it, WordPress
// itself, and the plugins working behind it. Wires run between adjacent layers
// through routing channels, exactly like a circuit board — which is the only
// way thirty-odd connections stay readable at once. Integrations that skip a
// layer take the side gutters instead.
// ---------------------------------------------------------------------------

const GUTTER = { left: 8, right: STAGE.w - 8 };

// Every panel and the readout share one column. Inside each panel the layer's
// name and description sit in a fixed left column and the cards fill whatever
// is left — which is what stops a four-card row and a seven-card row looking
// like two unrelated layouts.
const PANEL_X = 18;
const PANEL_W = STAGE.w - PANEL_X * 2;
const PANEL_PAD_X = 22;
const PANEL_PAD_Y = 18;
const LABEL_W = 150;
const LABEL_GAP = 18;
const ROW_X = PANEL_X + PANEL_PAD_X + LABEL_W + LABEL_GAP;
const ROW_W = PANEL_X + PANEL_W - PANEL_PAD_X - ROW_X;
// Wide enough that a section boundary is obvious without a box around it.
const SECTION_GAP = 34;

// `vertical` rows stack the icon above the name — the workshop holds seven
// cards, too narrow to put a name beside an icon.
// Tightened so the board and its readout fit a normal screen. NekoUI's tab
// wrapper is overflow:hidden, so a sticky readout can't work — the only honest
// fix is for the whole thing to be shorter.
const LAYOUT = {
  world: { y: 16, itemH: 52, gap: 16, vertical: false },
  surface: { y: 160, itemH: 68, gap: 14, vertical: false },
  // AI Engine sits in the Core row and gets more of it: it is a platform here,
  // not one of seven equal modules.
  // `headroom` is extra height above the cards for a row that is divided into
  // named sections — the labels need somewhere to live that isn't on top of the
  // cards. Only Core is divided, so only Core pays for it.
  core: { y: 320, itemH: 68, gap: 14, vertical: false, headroom: 14, weights: { 'ai-engine': 1.9 } },
  workshop: { y: 494, itemH: 100, gap: 12, vertical: true },
};

for ( const box of Object.values( LAYOUT ) ) {
  box.headroom = box.headroom || 0;
  box.h = box.itemH + PANEL_PAD_Y * 2 + box.headroom;
}

// A routing band sits between two layers.
const bandBetween = ( upper, lower ) => {
  const top = LAYOUT[upper].y + LAYOUT[upper].h;
  const bottom = LAYOUT[lower].y;
  return { top, bottom, lanes: [12, 24, 36, 48].map( o => top + o ) };
};

const BANDS = {
  'world|surface': bandBetween( 'world', 'surface' ),
  'surface|core': bandBetween( 'surface', 'core' ),
  'core|workshop': bandBetween( 'core', 'workshop' ),
};

const buildLayout = ( nodes ) => {
  const panels = [];
  for ( const layer of LAYERS ) {
    const box = LAYOUT[layer.id];
    const sections = layer.sections
      .map( section => ( { ...section, items: section.items.filter( id => nodes[id] ) } ) )
      .filter( section => section.items.length );
    const cardCount = sections.reduce( ( sum, section ) => sum + section.items.length, 0 );

    const weightOf = id => ( box.weights && box.weights[id] ) || 1;
    const totalWeight = sections.reduce(
      ( sum, section ) => sum + section.items.reduce( ( t, id ) => t + weightOf( id ), 0 ), 0 );
    // Cards are separated by the row's gap; sections by a wider one, which is
    // what makes them read as separate compartments rather than one long row.
    const spacing = ( cardCount - sections.length ) * box.gap + ( sections.length - 1 ) * SECTION_GAP;
    const unit = ( ROW_W - spacing ) / totalWeight;

    let x = ROW_X;
    const placed = [];
    for ( const section of sections ) {
      const from = x;
      for ( const id of section.items ) {
        const node = nodes[id];
        const cardW = unit * weightOf( id );
        node.w = cardW;
        node.h = box.itemH;
        node.vertical = box.vertical;
        node.left = x;
        node.right = x + cardW;
        node.x = x + cardW / 2;
        node.top = box.y + PANEL_PAD_Y + box.headroom;
        node.bottom = node.top + box.itemH;
        node.y = node.top + box.itemH / 2;
        x += cardW + box.gap;
      }
      x -= box.gap;
      placed.push( { ...section, left: from, right: x } );
      x += SECTION_GAP;
    }
    panels.push( { ...layer, x: PANEL_X, y: box.y, w: PANEL_W, h: box.h,
      headroom: box.headroom, sections: placed } );
  }
  return panels;
};

// Turn waypoints into a path with rounded corners.
const ortho = ( points, radius = 10 ) => {
  let d = `M ${points[0][0].toFixed( 1 )} ${points[0][1].toFixed( 1 )}`;
  for ( let i = 1; i < points.length - 1; i++ ) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot( cx - px, cy - py ) || 1;
    const outLen = Math.hypot( nx - cx, ny - cy ) || 1;
    const r = Math.min( radius, inLen / 2, outLen / 2 );
    const ax = cx - ( ( cx - px ) / inLen ) * r;
    const ay = cy - ( ( cy - py ) / inLen ) * r;
    const bx = cx + ( ( nx - cx ) / outLen ) * r;
    const by = cy + ( ( ny - cy ) / outLen ) * r;
    d += ` L ${ax.toFixed( 1 )} ${ay.toFixed( 1 )} Q ${cx.toFixed( 1 )} ${cy.toFixed( 1 )} ${bx.toFixed( 1 )} ${by.toFixed( 1 )}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last[0].toFixed( 1 )} ${last[1].toFixed( 1 )}`;
};

const LAYER_ORDER = LAYERS.map( l => l.id );
const depthOf = id => LAYER_ORDER.indexOf( id );

// Greedy channel router: reuse a lane whenever the horizontal runs don't
// overlap, only step down to the next one when they would.
const makeLaneBook = () => {
  const book = {};
  return ( bandKey, x1, x2 ) => {
    const lanes = book[bandKey] || ( book[bandKey] = [] );
    const lo = Math.min( x1, x2 );
    const hi = Math.max( x1, x2 );
    let lane = 0;
    while ( lanes[lane] && lanes[lane].some( r => lo < r[1] && r[0] < hi ) ) lane++;
    if ( !lanes[lane] ) lanes[lane] = [];
    lanes[lane].push( [lo, hi] );
    return lane;
  };
};

// Which band a node can escape into, and which of its edges to leave from.
// Prefer the band below; the last layer has none, so it goes up instead.
const escapeBand = ( node ) => {
  const d = depthOf( node.layer );
  const below = LAYER_ORDER[d + 1];
  if ( below && BANDS[`${node.layer}|${below}`] ) {
    return { key: `${node.layer}|${below}`, edgeOf: n => n.bottom };
  }
  return { key: `${LAYER_ORDER[d - 1]}|${node.layer}`, edgeOf: n => n.top };
};

// The vertical corridors between the cards of a layer. A wire that has to get
// past a layer drops through the nearest one instead of detouring all the way
// out to the gutter and back — which drew a rectangle the width of the board.
const corridorsOf = ( layerId, nodes ) => {
  const layer = LAYERS.find( l => l.id === layerId );
  const items = layer.items.map( id => nodes[id] ).filter( Boolean ).sort( ( a, b ) => a.x - b.x );
  const cors = [];
  for ( let i = 1; i < items.length; i++ ) {
    cors.push( ( items[i - 1].right + items[i].left ) / 2 );
  }
  // The margin past the last card, which is always at least as wide as a gap.
  cors.push( ( items[items.length - 1].right + PANEL_X + PANEL_W ) / 2 );
  return cors;
};

// Getting from one layer to another two or more rows away means crossing the
// layers in between. Drop through the corridor those layers share, nearest to
// the straight line; only fall out to the gutter when they share none.
const crossingX = ( upperLayer, lowerLayer, midX, nodes ) => {
  const between = LAYER_ORDER.slice( depthOf( upperLayer ) + 1, depthOf( lowerLayer ) );
  const sets = between.map( id => corridorsOf( id, nodes ) );
  const shared = sets.length
    ? sets[0].filter( x => sets.every( set => set.some( c => Math.abs( c - x ) < 26 ) ) )
    : [];
  return shared.length
    ? shared.reduce( ( best, c ) => ( Math.abs( c - midX ) < Math.abs( best - midX ) ? c : best ) )
    : ( midX < STAGE.w / 2 ? GUTTER.left : GUTTER.right );
};

// Wires leaving the same edge of the same card get their own exit point spread
// along it. Stacking five of them on the centre braided the whole bundle into
// one thick smear the moment it left the card.
const fanOut = ( specs ) => {
  const groups = {};
  for ( const spec of specs ) {
    for ( const end of ['upper', 'lower'] ) {
      const key = `${spec[end].id}|${spec.edges[end]}`;
      ( groups[key] || ( groups[key] = [] ) ).push( { spec, end } );
    }
  }
  for ( const members of Object.values( groups ) ) {
    if ( members.length < 2 ) continue;
    const node = members[0].spec[members[0].end];
    // Ordered by where each wire is headed, so they fan out without crossing.
    members.sort( ( m, n ) => m.spec.aimX[m.end] - n.spec.aimX[n.end] );
    const room = Math.max( 0, node.w - 40 );
    const step = Math.min( 15, room / ( members.length - 1 ) );
    const first = node.x - ( step * ( members.length - 1 ) ) / 2;
    members.forEach( ( m, i ) => { m.spec.portX[m.end] = first + i * step; } );
  }
};

const buildWires = ( nodes ) => {
  const claimLane = makeLaneBook();
  const specs = [];
  const seen = new Set();

  // Pass one works out the shape of every wire without drawing it, so the
  // ports can be spread before any geometry is committed.
  const plan = ( aId, bId, kind ) => {
    const a = nodes[aId];
    const b = nodes[bId];
    if ( !a || !b ) return;
    const key = [aId, bId].sort().join( '|' );
    if ( seen.has( key ) ) return;
    seen.add( key );

    const da = depthOf( a.layer );
    const db = depthOf( b.layer );
    const [upper, lower] = da <= db ? [a, b] : [b, a];
    const gap = Math.abs( da - db );
    let edges;
    let corridor = null;

    if ( gap === 0 ) {
      // Same layer: both ends leave by the same edge, into the adjacent band.
      const esc = escapeBand( upper );
      const side = esc.edgeOf( upper ) === upper.bottom ? 'bottom' : 'top';
      edges = { upper: side, lower: side };
    }
    else {
      edges = { upper: 'bottom', lower: 'top' };
      if ( gap >= 2 ) {
        corridor = crossingX( upper.layer, lower.layer, ( upper.x + lower.x ) / 2, nodes );
      }
    }

    specs.push( {
      key, a: aId, b: bId, kind, upper, lower, gap, edges, corridor,
      aimX: {
        upper: corridor !== null ? corridor : lower.x,
        lower: corridor !== null ? corridor : upper.x,
      },
      portX: { upper: upper.x, lower: lower.x },
    } );
  };

  // Structural first so they get the shallow lanes.
  for ( const [a, b] of LINKS ) plan( a, b, 'link' );
  for ( const [a, b] of SYNERGIES ) plan( a, b, 'synergy' );

  fanOut( specs );

  return specs.map( spec => {
    const { upper, lower, gap, edges, corridor, portX } = spec;
    const ux = portX.upper;
    const lx = portX.lower;
    const uy = edges.upper === 'bottom' ? upper.bottom : upper.top;
    const ly = edges.lower === 'top' ? lower.top : lower.bottom;
    let pts;

    if ( gap === 1 ) {
      const bandKey = `${upper.layer}|${lower.layer}`;
      const band = BANDS[bandKey];
      const lane = claimLane( bandKey, ux, lx );
      pts = [[ux, uy], [ux, band.lanes[Math.min( lane, band.lanes.length - 1 )]],
        [lx, band.lanes[Math.min( lane, band.lanes.length - 1 )]], [lx, ly]];
    }
    else if ( gap === 0 ) {
      const esc = escapeBand( upper );
      const lane = claimLane( esc.key, ux, lx );
      const y = BANDS[esc.key].lanes[Math.min( lane, BANDS[esc.key].lanes.length - 1 )];
      pts = [[ux, uy], [ux, y], [lx, y], [lx, ly]];
    }
    else {
      const bandU = `${upper.layer}|${LAYER_ORDER[depthOf( upper.layer ) + 1]}`;
      const bandL = `${LAYER_ORDER[depthOf( lower.layer ) - 1]}|${lower.layer}`;
      const laneU = claimLane( bandU, ux, corridor );
      const laneL = claimLane( bandL, corridor, lx );
      const yU = BANDS[bandU].lanes[Math.min( laneU, BANDS[bandU].lanes.length - 1 )];
      const yL = BANDS[bandL].lanes[Math.min( laneL, BANDS[bandL].lanes.length - 1 )];
      pts = [[ux, uy], [ux, yU], [corridor, yU], [corridor, yL], [lx, yL], [lx, ly]];
    }

    const a = nodes[spec.a];
    const b = nodes[spec.b];
    // Tint a wire with the plugin end's family colour, so the board carries the
    // same colour language as the grid instead of one flat blue.
    const tint = a.kind === 'plugin' ? a.color : ( b.kind === 'plugin' ? b.color : a.color );
    return {
      key: spec.key, a: spec.a, b: spec.b, kind: spec.kind, tint,
      from: upper.id, to: lower.id,
      d: ortho( pts ), ports: [pts[0], pts[pts.length - 1]],
    };
  } );
};

// Rounded corners make a path shorter than the polyline through its waypoints
// — about 4px a turn. Estimating from the waypoints left the packet docking a
// few pixels short of each centre, so measure the real thing instead.
let rulerPath = null;
const measure = ( d ) => {
  try {
    if ( !rulerPath ) {
      const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
      svg.setAttribute( 'width', '0' );
      svg.setAttribute( 'height', '0' );
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      rulerPath = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
      svg.appendChild( rulerPath );
      document.body.appendChild( svg );
    }
    rulerPath.setAttribute( 'd', d );
    return rulerPath.getTotalLength();
  }
  catch ( e ) {
    return null;
  }
};

// Journeys travel centre to centre so consecutive hops join seamlessly.
const buildJourneyPaths = ( nodes ) => {
  const claimLane = makeLaneBook();
  const hop = ( a, b ) => {
    const da = depthOf( a.layer );
    const db = depthOf( b.layer );
    if ( da === db ) {
      const belowId = LAYER_ORDER[da + 1];
      const band = BANDS[`${a.layer}|${belowId}`] || BANDS['core|workshop'];
      const lane = claimLane( `j-${a.layer}`, a.x, b.x );
      const y = band.lanes[Math.min( lane, band.lanes.length - 1 )];
      return [[a.x, a.y], [a.x, y], [b.x, y], [b.x, b.y]];
    }
    const [upper, lower] = da < db ? [a, b] : [b, a];
    const forward = da < db;
    const bandKey = Math.abs( da - db ) === 1
      ? `${upper.layer}|${lower.layer}`
      : null;
    if ( bandKey && BANDS[bandKey] ) {
      const lane = claimLane( `j-${bandKey}`, a.x, b.x );
      const y = BANDS[bandKey].lanes[Math.min( lane, BANDS[bandKey].lanes.length - 1 )];
      const pts = [[upper.x, upper.y], [upper.x, y], [lower.x, y], [lower.x, lower.y]];
      return forward ? pts : pts.slice().reverse();
    }
    // Skipping a layer: band, corridor, band — the same rule as the wires, so a
    // packet never flies straight through the cards it isn't visiting, and never
    // detours to the gutter when there is a gap to drop through on the way.
    const bandU = `${upper.layer}|${LAYER_ORDER[depthOf( upper.layer ) + 1]}`;
    const bandL = `${LAYER_ORDER[depthOf( lower.layer ) - 1]}|${lower.layer}`;
    const gx = crossingX( upper.layer, lower.layer, ( a.x + b.x ) / 2, nodes );
    const yU = BANDS[bandU].lanes[0];
    const yL = BANDS[bandL].lanes[BANDS[bandL].lanes.length - 1];
    const pts = [[upper.x, upper.y], [upper.x, yU], [gx, yU], [gx, yL], [lower.x, yL], [lower.x, lower.y]];
    return forward ? pts : pts.slice().reverse();
  };

  const polyLen = pts => pts.slice( 1 ).reduce(
    ( sum, p, i ) => sum + Math.hypot( p[0] - pts[i][0], p[1] - pts[i][1] ), 0 );

  return JOURNEYS.map( journey => {
    const stops = journey.stops.map( id => nodes[id] ).filter( Boolean );
    if ( stops.length < 2 ) return null;
    // Revisiting a stop draws the same hop on top of itself, which reads as a
    // doubled line rather than a journey. Better to notice than to ship it.
    if ( new Set( journey.stops ).size !== journey.stops.length ) {
      console.warn( `[meow-board] journey "${journey.id}" revisits a stop`, journey.stops );
    }
    // `d` runs centre to centre and is invisible — it is only what the packet
    // rides, so it docks in the middle of a card. Each hop also gets its own
    // visible segment, trimmed back to the card edges so no stroke ever sits
    // inside a card (they are translucent, so hiding it behind them was never
    // going to be enough).
    //
    // One <path> per hop, not one path with moveto gaps: SVG restarts the dash
    // pattern at every subpath, so a single stroke-dashoffset drew every hop at
    // once — the line for the next hop appeared while the packet was still on
    // this one.
    let d = '';
    const segments = [];
    for ( let i = 0; i < stops.length - 1; i++ ) {
      const a = stops[i];
      const b = stops[i + 1];
      const pts = hop( a, b );
      const seg = ortho( pts );
      // Segments share an endpoint, so the follow-on "M" becomes an "L".
      d += i === 0 ? seg : seg.replace( /^M/, ' L' );

      // Both the leaving and arriving legs run vertically, so the crossing is
      // always on a top or bottom edge.
      const outY = pts[1][1] > a.y ? a.bottom : a.top;
      const inY = pts[pts.length - 2][1] < b.y ? b.top : b.bottom;
      const linePts = [[a.x, outY], ...pts.slice( 1, -1 ), [b.x, inY]];
      const lineSeg = ortho( linePts );
      segments.push( {
        d: lineSeg,
        hopLen: measure( seg ) ?? polyLen( pts ),
        len: measure( lineSeg ) ?? polyLen( linePts ),
        // How far the packet travels before it clears the card and the stroke
        // is allowed to start.
        lead: Math.abs( a.y - outY ),
        from: { x: a.x, y: outY },
        to: { x: b.x, y: inY },
      } );
    }
    // Where each stop falls along the whole route, so the packet knows when to
    // pull in and wait. Corner rounding shortens things by ~2px a turn, which
    // is far below anything the eye can catch in the timing.
    const total = segments.reduce( ( sum, s ) => sum + s.hopLen, 0 ) || 1;
    const fractions = [0];
    let acc = 0;
    for ( const s of segments ) { acc += s.hopLen; fractions.push( acc / total ); }

    return { ...journey, d, segments, fractions, accent: getJourneyColor( journey ), stopIds: journey.stops };
  } ).filter( Boolean );
};

// One story at a time, with a breath between them. Showing every wire at once
// turned the board into spaghetti; showing one route, drawn as the packet
// travels it, says the same thing and stays readable.
//
// A packet flies one hop, pulls in at the module it reached and waits a beat
// while that module pulses, then carries on — rather than gliding through
// everything at a constant speed as if the stops weren't there.
const HOP_MS = 980;
const DWELL_MS = 440;
const PULSE_MS = 620;
// Samples taken per hop when building the flight. The easing is worked out here
// rather than handed to the browser, because the packet and the line it draws
// have different lengths: eased separately they agree at each stop and drift
// apart in between, which is exactly where the eye is watching.
const HOP_SAMPLES = 16;
const packetDuration = journey => journey.segments.length * ( HOP_MS + DWELL_MS );

const clamp = ( v, min, max ) => Math.max( min, Math.min( max, v ) );

// How many ghost journeys ride along in each pass through the live ones. The
// board should mostly show what your site actually does, with the occasional
// glimpse of what it could — not the other way round.
const GHOSTS_PER_PASS = 3;

// Fisher–Yates. Both queues were built straight from JOURNEYS order, so the
// board opened with the same packet every single time — "Password reset" from
// Users to Meow Mailer — and then repeated the same sequence for as long as you
// watched. A board whose whole point is the variety of what your site does
// looked like it had one thing to say.
const shuffled = ( list ) => {
  const out = [...list];
  for ( let i = out.length - 1; i > 0; i-- ) {
    const j = Math.floor( Math.random() * ( i + 1 ) );
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Spread the ghosts through the live journeys rather than letting them clump.
// Sorting live-first played every real journey and then every greyed-out one
// back to back, so a site with three plugins installed spent two thirds of the
// loop looking like a list of things it hasn't got.
const weave = ( live, ghosts ) => {
  if ( !live.length ) return [...ghosts];
  if ( !ghosts.length ) return [...live];
  const out = [];
  const step = live.length / ( ghosts.length + 1 );
  let taken = 0;
  live.forEach( ( journey, i ) => {
    out.push( journey );
    if ( taken < ghosts.length && i + 1 >= Math.round( step * ( taken + 1 ) ) ) {
      out.push( ghosts[taken] );
      taken++;
    }
  } );
  while ( taken < ghosts.length ) out.push( ghosts[taken++] );
  return out;
};

// The board scales to its container, but scaling shrinks the type along with
// everything else. The floor used to be 0.45, which put card names at under 6px
// — technically fitted, actually unreadable. Below this the board stops
// shrinking and pans sideways instead, which is the honest trade for a dense
// diagram. Anyone who wants the whole picture on a narrow screen has the grid.
const MIN_SCALE = 0.8;

// Each card carries its family colour as a wash and an edge, so the four
// families read at a glance instead of only showing up on the wires.
const rgba = ( hex, a ) => {
  const n = parseInt( hex.slice( 1 ), 16 );
  return `rgba(${( n >> 16 ) & 255}, ${( n >> 8 ) & 255}, ${n & 255}, ${a})`;
};

// How strongly a card wears its accent. A plugin that is actually running gets
// the full colour; one that is merely installed, or not there at all, only
// hints at it — which is the same signal as the greying, said in colour.
const ACCENT_STRENGTH = { active: 1, inactive: 0.6, none: 0.34, fixture: 0.7 };

const accentVars = ( node, state ) => {
  const strength = node.kind === 'plugin'
    ? ACCENT_STRENGTH[state || 'none']
    : ACCENT_STRENGTH.fixture;
  return {
    '--tint': rgba( node.color, 0.30 * strength ),
    '--tint-strong': rgba( node.color, 0.46 * strength ),
    '--edge': rgba( node.color, 0.62 * strength ),
    '--glow': rgba( node.color, 0.55 * strength ),
  };
};

// cubic-bezier(x1, y1, x2, y2) solved for y at a given x, so the same curve the
// CSS would have used can be sampled here instead.
const cubicBezier = ( x1, y1, x2, y2 ) => {
  const axis = ( t, p1, p2 ) => ( 3 * ( 1 - t ) * ( 1 - t ) * t * p1 ) + ( 3 * ( 1 - t ) * t * t * p2 ) + ( t * t * t );
  return ( x ) => {
    if ( x <= 0 ) return 0;
    if ( x >= 1 ) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for ( let i = 0; i < 24; i++ ) {
      const at = axis( t, x1, x2 );
      if ( Math.abs( at - x ) < 1e-5 ) break;
      if ( at < x ) lo = t; else hi = t;
      t = ( lo + hi ) / 2;
    }
    return axis( t, y1, y2 );
  };
};

const EASE = cubicBezier( 0.5, 0, 0.2, 1 );

// The whole flight, sampled up front: where the chip is at each moment, how much
// of each hop's line is drawn, and when each port lights. Everything reads from
// these same samples, so a line can never run ahead of the packet drawing it.
const buildFlight = ( journey ) => {
  const hops = journey.segments.length;
  const total = hops * ( HOP_MS + DWELL_MS );
  const chip = [];
  const segments = journey.segments.map( () => [] );
  const ports = [];

  for ( let i = 0; i < hops; i++ ) {
    const seg = journey.segments[i];
    const startedAt = i * ( HOP_MS + DWELL_MS );
    const from = journey.fractions[i];
    const to = journey.fractions[i + 1];
    // Until its own hop comes round, a segment is simply undrawn.
    segments[i].push( { offset: 0, drawn: 0 }, { offset: startedAt / total, drawn: 0 } );

    let leavesAt = null;
    for ( let s = 0; s <= HOP_SAMPLES; s++ ) {
      const along = EASE( s / HOP_SAMPLES );
      const at = ( startedAt + ( s / HOP_SAMPLES ) * HOP_MS ) / total;
      chip.push( { offset: at, distance: from + ( to - from ) * along } );
      // The stroke tracks the packet exactly, over the stretch of the hop that
      // is actually visible: nothing until the packet has cleared the card it
      // left, complete the moment it docks at the next one.
      const drawn = clamp( ( along * seg.hopLen - seg.lead ) / seg.len, 0, 1 );
      segments[i].push( { offset: at, drawn } );
      if ( leavesAt === null && drawn > 0 ) leavesAt = at;
    }
    segments[i].push( { offset: 1, drawn: 1 } );

    // A port marks where the line meets a card: one lights as the stroke leaves,
    // the other as it arrives.
    ports.push( { ...seg.from, at: leavesAt ?? startedAt / total } );
    ports.push( { ...seg.to, at: ( startedAt + HOP_MS ) / total } );

    // Hold everything still through the dwell.
    chip.push( { offset: ( startedAt + HOP_MS + DWELL_MS ) / total, distance: to } );
  }
  return { total, chip, segments, ports };
};

// Packets are the one part of the board that can't be checked by reading the
// DOM — everything interesting happens between frames. This keeps a handle on
// whatever is in the air so a flight can be slowed, paused or stepped to an
// exact moment. See window.meowBoard.help().
const flightControl = ( () => {
  let live = [];
  let rate = 1;
  let held = false;
  const each = fn => live.forEach( flight => flight.anims.forEach( fn ) );
  return {
    onRequest: null,
    register( id, anims ) {
      live.push( { id, anims } );
      anims.forEach( a => { a.playbackRate = rate; if ( held ) a.pause(); } );
    },
    release( anims ) { live = live.filter( flight => flight.anims !== anims ); },
    api: {
      speed( x ) { rate = x; each( a => { a.playbackRate = x; } ); return `speed ${x}x`; },
      pause() { held = true; each( a => a.pause() ); return 'paused'; },
      play() { held = false; each( a => a.play() ); return 'playing'; },
      // Step whatever is in the air to a point between 0 and 1 of its flight.
      seek( t ) {
        held = true;
        each( a => { a.pause(); a.currentTime = clamp( t, 0, 1 ) * a.effect.getTiming().duration; } );
        return this.flying();
      },
      // Fly one named journey on a loop, so a single route can be studied.
      only( id ) {
        if ( !flightControl.onRequest ) return 'board not mounted';
        flightControl.onRequest( id );
        return id ? `only ${id}` : 'back to all journeys';
      },
      flying() { return live.map( flight => flight.id ); },
      help() {
        return 'meowBoard: .only(id|null) .speed(x) .pause() .play() .seek(0..1) .flying()';
      },
    },
  };
} )();

if ( typeof window !== 'undefined' ) window.meowBoard = flightControl.api;

const Packet = ( { packet, onArrive } ) => {
  const chipRef = useRef( null );
  const segRefs = useRef( [] );
  const routeLayerRef = useRef( null );
  const portRefs = useRef( [] );

  useEffect( () => {
    try {
      return start();
    }
    catch ( e ) {
      // Packets are decoration. If one can't animate, the board still works.
      console.warn( '[meow-board] packet animation skipped', e );
      return undefined;
    }
  }, [] );

  function start() {
    const flight = buildFlight( packet.journey );
    const opts = { duration: flight.total, fill: 'forwards' };
    const anims = [];

    // No per-keyframe easing anywhere below: the curve is already baked into
    // the samples, so everything here interpolates linearly between them and
    // stays in lockstep.
    if ( chipRef.current ) {
      anims.push( chipRef.current.animate(
        flight.chip.map( f => ( { offset: f.offset, offsetDistance: `${( f.distance * 100 ).toFixed( 3 )}%` } ) ),
        opts ) );
      anims.push( chipRef.current.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], opts ) );
    }

    flight.segments.forEach( ( frames, i ) => {
      const el = segRefs.current[i];
      if ( !el ) return;
      anims.push( el.animate(
        frames.map( f => ( { offset: f.offset, strokeDashoffset: 100 - f.drawn * 100 } ) ), opts ) );
    } );

    // The route has to fade too. Moving the motion to WAAPI dropped the CSS
    // fade that used to do this, so a finished route sat at full strength
    // until React removed it.
    if ( routeLayerRef.current ) {
      anims.push( routeLayerRef.current.animate(
        [{ opacity: 0 }, { opacity: 0.85, offset: 0.07 }, { opacity: 0.85, offset: 0.86 }, { opacity: 0 }], opts ) );
    }

    // Each port pops in as the stroke reaches that edge, so the route reads as
    // docking at a card and leaving from the other side rather than passing
    // behind it.
    flight.ports.forEach( ( port, i ) => {
      const el = portRefs.current[i];
      if ( !el ) return;
      // Keyframe offsets have to be monotonically non-decreasing — a late port
      // whose appear time lands past the fade-out would otherwise throw.
      const lit = clamp( port.at, 0, 1 );
      const dark = clamp( lit - 0.015, 0, lit );
      const hold = clamp( 0.92, lit, 1 );
      anims.push( el.animate(
        [{ opacity: 0, offset: 0 },
          { opacity: 0, offset: dark },
          { opacity: 1, offset: lit },
          { opacity: 1, offset: hold },
          { opacity: 0, offset: 1 }], opts ) );
    } );

    // Light up each module as the packet pulls in.
    const timers = [];
    for ( let i = 1; i <= packet.journey.segments.length; i++ ) {
      timers.push( setTimeout(
        () => onArrive( packet.journey.stopIds[i], packet.journey.accent ),
        i * ( HOP_MS + DWELL_MS ) - DWELL_MS ) );
    }

    flightControl.register( packet.journey.id, anims );
    return () => {
      flightControl.release( anims );
      anims.forEach( a => a.cancel() );
      timers.forEach( clearTimeout );
    };
  }

  return (
    /* Hidden from assistive tech: a packet is decoration, and one spawns every
       few seconds carrying an emoji. Left exposed it drip-feeds stray symbols
       into the accessibility tree while telling a screen reader nothing — what
       these journeys mean is in the readout and in each card's own label. */
    <div aria-hidden="true" className={`packet${packet.live ? '' : ' is-ghost'}`}
      style={{ '--flight': packet.journey.accent, '--flight-soft': rgba( packet.journey.accent, 0.45 ) }}>
      <svg className="packet-route" ref={routeLayerRef} viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} width={STAGE.w} height={STAGE.h}>
        {packet.journey.segments.map( ( seg, i ) => (
          <path key={i} ref={el => { segRefs.current[i] = el; }} d={seg.d} pathLength="100" />
        ) )}
        {/* Same order buildFlight lists them in: each hop's exit, then its arrival. */}
        {packet.journey.segments.flatMap( seg => [seg.from, seg.to] ).map( ( port, i ) => (
          <circle key={i} className="route-port" ref={el => { portRefs.current[i] = el; }}
            cx={port.x} cy={port.y} r={3.5} />
        ) )}
      </svg>
      <div className="packet-chip" ref={chipRef} style={{ offsetPath: `path("${packet.journey.d}")` }}>
        <span className="chip-glyph">{packet.journey.glyph}</span>
      </div>
    </div>
  );
};


// offset-path is what makes the packets cheap. Without it (or with reduced
// motion asked for) the board simply stays still — everything else still works.
let packetSupport = null;
const canAnimatePackets = () => {
  if ( packetSupport !== null ) return packetSupport;
  try {
    const reduced = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
    packetSupport = !reduced && window.CSS && CSS.supports( 'offset-path', 'path("M0 0 L1 1")' );
  }
  catch ( e ) {
    packetSupport = false;
  }
  return packetSupport;
};

// ---------------------------------------------------------------------------

const Board = ( { installedPlugins, view, onView } ) => {
  const { nodes, panels, wires, journeys } = useMemo( () => {
    const map = buildNodes();
    const p = buildLayout( map );
    return { nodes: map, panels: p, wires: buildWires( map ), journeys: buildJourneyPaths( map ) };
  }, [] );

  const shellRef = useRef( null );

  const [scale, setScale] = useState( 1 );
  const [hovered, setHovered] = useState( null );
  const [pinned, setPinned] = useState( null );
  const [hoveredLayer, setHoveredLayer] = useState( null );
  const [packets, setPackets] = useState( [] );
  const [pulse, setPulse] = useState( null );

  const focus = pinned || hovered;
  const focusNode = focus ? nodes[focus] : null;

  useEffect( () => {
    const shell = shellRef.current;
    if ( !shell ) return undefined;
    const measure = () => {
      const width = shell.clientWidth;
      // Allowed past 1 so a wide screen actually fills, rather than
      // leaving the board marooned in the middle at native size.
      if ( width > 0 ) setScale( clamp( width / STAGE.w, MIN_SCALE, 1.4 ) );
    };
    measure();
    if ( typeof ResizeObserver === 'undefined' ) {
      window.addEventListener( 'resize', measure );
      return () => window.removeEventListener( 'resize', measure );
    }
    const observer = new ResizeObserver( measure );
    observer.observe( shell );
    return () => observer.disconnect();
  }, [] );

  const states = useMemo( () => {
    const map = {};
    for ( const node of Object.values( nodes ) ) {
      map[node.id] = node.kind === 'plugin' ? getInstallState( node.id, installedPlugins ) : 'core';
    }
    return map;
  }, [nodes, installedPlugins] );

  // Journeys that pass through a given node, so clicking a card can show what
  // that card actually does rather than just lighting up its wires.
  const journeysThrough = useCallback(
    id => journeys.filter( j => j.stopIds.includes( id ) ), [journeys] );

  // Hovering is transient, so it only ever pauses. Pinning is a request: keep
  // playing, but only the journeys that run through the pinned card.
  const paused = !pinned && Boolean( hovered );

  // window.meowBoard.only( id ) pins the board to a single journey, which is how
  // one route gets studied frame by frame without waiting for it to come round.
  const [forced, setForced] = useState( null );
  useEffect( () => {
    flightControl.onRequest = setForced;
    return () => { flightControl.onRequest = null; };
  }, [] );

  // Which journeys are in rotation: one named journey when the board has been
  // asked for it, otherwise the pinned card's own, otherwise everything. A
  // pinned card with no journey of its own falls through to the full set, so
  // clicking a quiet corner never leaves the board sitting dead.
  const pool = useMemo( () => {
    if ( forced ) {
      const only = journeys.filter( j => j.id === forced );
      if ( only.length ) return only;
    }
    if ( pinned ) {
      const mine = journeysThrough( pinned );
      if ( mine.length ) return mine;
    }
    return journeys;
  }, [journeys, journeysThrough, forced, pinned] );

  // Send one packet on its way every few seconds: everything the site can
  // actually do each pass, plus a few of the things it can't yet.
  useEffect( () => {
    // Wait for the install list: a packet spawned before it lands would be
    // labelled a ghost even though the plugin is right there and running.
    // A forced journey keeps flying regardless: it was asked for explicitly.
    if ( ( paused && !forced ) || !installedPlugins || !canAnimatePackets() ) return undefined;
    const isLive = journey => journey.needs.every( n => states[n] === 'active' );
    const live = pool.filter( isLive );
    // Shuffled once, not per pass: the walk below still steps through this array
    // in order, so every ghost keeps its guaranteed turn — it's the order that
    // varies, not who gets shown.
    const ghosts = shuffled( pool.filter( j => !isLive( j ) ) );

    // Each pass replays every live journey but only the next few ghosts, so the
    // ghosts all get their turn across passes without the board spending most
    // of its time greyed out. A site with nothing installed is all ghosts —
    // which is the right answer there, since that is the whole pitch.
    let pass = 0;
    let queue = [];
    let lastPlayed = null;
    const nextJourney = () => {
      if ( !queue.length ) {
        const slice = ghosts.length
          ? Array.from( { length: Math.min( GHOSTS_PER_PASS, ghosts.length ) },
            ( _, i ) => ghosts[( pass * GHOSTS_PER_PASS + i ) % ghosts.length] )
          : [];
        // Re-shuffled every pass, so the second time round isn't the first time
        // round again.
        queue = weave( shuffled( live ), slice );
        // A fresh pass starting on the journey that just ended the previous one
        // reads as a stutter rather than as a new lap.
        if ( queue.length > 1 && lastPlayed && queue[0].id === lastPlayed ) {
          [queue[0], queue[1]] = [queue[1], queue[0]];
        }
        pass++;
      }
      const next = queue.shift();
      if ( next ) lastPlayed = next.id;
      return next;
    };

    let index = 0;
    const timers = [];
    const spawn = () => {
      // A hidden tab pauses animations, so packets would pile up frozen.
      if ( document.hidden ) { timers.push( setTimeout( spawn, 1200 ) ); return; }
      const journey = nextJourney();
      if ( !journey ) return;
      index++;
      // Name only what is actually missing — telling someone they "need" a
      // plugin they already have reads as a bug.
      const missing = journey.needs.filter( n => states[n] !== 'active' );
      const id = `${journey.id}-${index}`;
      const life = packetDuration( journey );
      setPackets( list => [...list, { key: id, journey, live: missing.length === 0, missing }] );
      // A forced journey is being studied, so it stays on the board to be
      // paused and stepped instead of being cleared on a wall-clock timer.
      if ( forced ) return;
      timers.push( setTimeout( () => setPackets( list => list.filter( p => p.key !== id ) ), life + 120 ) );
      // Journeys are different lengths now, so the gap is measured, not fixed.
      // A pinned card replays sooner: you asked to see it, so don't make you wait.
      timers.push( setTimeout( spawn, life + ( pinned ? 420 : 900 ) ) );
    };
    spawn();
    return () => {
      // Removals are tracked too: an untracked one would fire into the next
      // rotation and take a fresh packet down with it.
      timers.forEach( clearTimeout );
      setPackets( [] );
    };
  }, [pool, states, paused, pinned, forced, installedPlugins] );

  const related = useMemo( () => {
    if ( !focus ) return null;
    const set = new Set( [focus, ...getNeighbours( focus )] );
    // A packet arriving on a greyed-out card looks like a bug. Anything the
    // journey in flight touches counts as related for as long as it flies.
    for ( const packet of packets ) for ( const id of packet.journey.stopIds ) set.add( id );
    return set;
  }, [focus, packets] );

  const litLayer = hoveredLayer || ( focusNode ? focusNode.layer : null );

  // A ghost journey is the board saying "this could be happening". On its own
  // that's a dashed line going nowhere in particular, so while one is in the air
  // the plugin that would make it real is picked out — the answer to the
  // question the ghost is asking, without a word of moving text.
  const wanted = useMemo( () => {
    const set = new Set();
    for ( const packet of packets ) {
      if ( !packet.live ) packet.missing.forEach( id => set.add( id ) );
    }
    return set;
  }, [packets] );

  // Hovering a whole layer surveys it: every wire that layer takes part in,
  // drawn quietly. Pointing at one card answers "what does this touch?"; this
  // answers "what does this row have to do with anything?" — which was
  // otherwise only discoverable one card at a time.
  const surveyed = useMemo( () => {
    if ( !hoveredLayer ) return null;
    const layer = LAYERS.find( l => l.id === hoveredLayer );
    return layer ? new Set( layer.items ) : null;
  }, [hoveredLayer] );


  const readout = useMemo( () => {
    if ( !focusNode ) return null;
    if ( focusNode.kind === 'plugin' ) {
      const partners = getPartners( focusNode.id ).map( id => nodes[id] ).filter( Boolean );
      return { node: focusNode, partners };
    }
    const users = getNeighbours( focusNode.id ).map( id => nodes[id] ).filter( n => n && n.kind === 'plugin' );
    return { node: focusNode, partners: users };
  }, [focusNode, nodes] );


  // A module lights up in the colour of whatever just pulled in, so an arrival
  // reads as "that journey got here" rather than as a generic blink. It used to
  // flash the same cyan whichever packet had arrived, which was the last thing
  // on the board still ignoring the colour system.
  const handleArrive = useCallback( ( id, accent ) => {
    setPulse( { id, accent } );
    setTimeout( () => setPulse( cur => ( cur && cur.id === id ? null : cur ) ), PULSE_MS );
  }, [] );



  const isDim = ( id ) => Boolean( focus ) && !( related && related.has( id ) );

  return (
    <StyledBoardShell ref={shellRef} onClick={() => setPinned( null )}>
      {/* A scaled element keeps its original layout box, so the stage needs a
          wrapper sized to the *scaled* dimensions. */}
      <BoardHeader installedPlugins={installedPlugins} ready={!!installedPlugins}
        node={readout && readout.node}
        partners={readout ? readout.partners : []} states={states} view={view} onView={onView} />

      <div className="board-fit" style={{ width: STAGE.w * scale, height: STAGE.h * scale }}>
        {/* Named group: tabbing in lands on the first of twenty-six controls,
            and without this there was nothing to say you had entered a diagram
            or what it was of. */}
        <StyledStage role="group"
          aria-label="Site map: the outside world, the plugins facing it, WordPress, and the plugins working behind it"
          style={{ transform: `scale(${scale})` }} className={focus ? 'is-focused' : ''}>

          {panels.map( panel => (
            <div key={panel.id}
              className={`layer-panel is-${panel.kind} is-${panel.id}${litLayer === panel.id ? ' is-lit' : ''}`}
              style={{ left: panel.x, top: panel.y, width: panel.w, height: panel.h,
                '--layer': panel.accent, '--headroom': `${panel.headroom}px` }}
              /* Focusable so the layer survey isn't mouse-only: tabbing onto a
                 row shows every link it takes part in, exactly as hovering it
                 does. Without this a keyboard user could never see them. */
              tabIndex={0}
              aria-label={`${panel.title}. ${panel.blurb} Shows what this layer connects to.`}
              onMouseEnter={() => setHoveredLayer( panel.id )}
              onMouseLeave={() => setHoveredLayer( null )}
              onFocus={() => setHoveredLayer( panel.id )}
              onBlur={() => setHoveredLayer( null )}>
              <div className="layer-label" style={{ width: LABEL_W }}>
                <span className="layer-mark">
                  <NekoIcon icon={panel.icon} width={22} height={22} color={panel.accent} />
                </span>
                <span className="layer-text">
                  <span className="layer-title">{panel.title}</span>
                  <span className="layer-blurb">{panel.blurb}</span>
                </span>
              </div>

              {/* Only a layer that is actually divided says so. Positions are
                  stage coordinates, so they come back inside the panel. */}
              {panel.sections.length > 1 && panel.sections.map( ( section, i ) => (
                <Fragment key={section.id}>
                  {i > 0 && (
                    <span aria-hidden="true" className="section-rule"
                      style={{ left: section.left - panel.x - SECTION_GAP / 2 }} />
                  )}
                  <span className="section-label" style={{ left: section.left - panel.x }}>
                    {section.label}
                  </span>
                </Fragment>
              ) )}
            </div>
          ) )}

          <svg aria-hidden="true" className="board-wires" viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} width={STAGE.w} height={STAGE.h}>
            <defs>
              <marker id="mw-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="4.5" markerHeight="4.5" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
              <marker id="mw-arrow-back" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {wires.map( wire => {
              // Hovering shows how a thing is wired into the site; only once
              // you click does it also show what it pairs with. Two or three
              // lines at a time instead of seven.
              const touches = focus === wire.a || focus === wire.b;
              const lit = touches && ( wire.kind === 'link' || pinned === wire.a || pinned === wire.b );
              // Surveying a layer only applies when nothing more specific is
              // being pointed at, so the two never argue over the same wire.
              const survey = !focus && surveyed
                && ( surveyed.has( wire.a ) || surveyed.has( wire.b ) );
              // Otherwise: only what you are looking at. At rest the board is
              // just the stack, and the travelling packet draws the one route
              // it needs.
              if ( !lit && !survey ) return null;
              const dead = !states[wire.a] || !states[wire.b];
              const classes = ['wire', `is-${wire.kind}`];
              if ( lit ) classes.push( 'is-lit' );
              if ( survey ) classes.push( 'is-survey' );
              if ( dead ) classes.push( 'is-dormant' );
              const stroke = lit ? nodes[focus].color : wire.tint;
              // Arrow at the far end, dot at the end you're looking from, so a
              // lit wire reads as "this goes there" rather than just a line.
              // A survey wire gets neither: it is showing that a link exists,
              // not narrating a direction.
              const outbound = focus === wire.from;
              const [start, end] = wire.ports;
              return (
                <g key={wire.key} className={classes.join( ' ' )}>
                  <path className="wire-line" d={wire.d} stroke={stroke}
                    markerEnd={lit && outbound ? 'url(#mw-arrow)' : undefined}
                    markerStart={lit && !outbound ? 'url(#mw-arrow-back)' : undefined} />
                  {lit && (
                    <>
                      <path className={`wire-flow${outbound ? '' : ' is-back'}`} d={wire.d} stroke={stroke} />
                      <circle className="wire-port" r={3} fill={stroke}
                        cx={outbound ? start[0] : end[0]} cy={outbound ? start[1] : end[1]} />
                    </>
                  )}
                </g>
              );
            } )}

          </svg>

          {/* Packets live outside the wire SVG and move with offset-path, so the
              browser composites them instead of re-rasterising the whole board
              on every frame — SMIL inside a scaled SVG froze the tab outright. */}
          {packets.map( packet => (
            <Packet key={packet.key} packet={packet} onArrive={handleArrive} />
          ) )}

          {Object.values( nodes ).map( node => {
            const state = states[node.id];
            const classes = ['node', `is-${node.kind}`, node.vertical ? 'is-stacked' : 'is-inline'];
            if ( node.standout ) classes.push( 'is-standout' );
            if ( node.kind === 'plugin' ) classes.push( state ? `is-${state}` : 'is-dormant' );
            if ( focus === node.id ) classes.push( 'is-focus' );
            // Held, as opposed to merely pointed at. `focus` is `pinned || hovered`,
            // so while something is pinned the board stops answering the mouse
            // entirely — which reads as broken unless the held card says so.
            if ( pinned === node.id ) classes.push( 'is-pinned' );
            if ( isDim( node.id ) ) classes.push( 'is-dim' );
            const pulsing = pulse && pulse.id === node.id;
            if ( pulsing ) classes.push( 'is-pulse' );
            if ( wanted.has( node.id ) ) classes.push( 'is-wanted' );
            return (
              <button key={node.id} type="button" className={classes.join( ' ' )}
                style={{
                  left: node.left, width: node.w,
                  '--accent': node.color,
                  ...accentVars( node, state ),
                  ...( pulsing ? {
                    '--pulse': pulse.accent,
                    '--pulse-soft': rgba( pulse.accent, 0.22 ),
                    '--pulse-glow': rgba( pulse.accent, 0.35 ),
                  } : {} ),
                  top: node.top,
                  height: node.h,
                }}
                /* The install state is in the label, not just in the colour:
                   greying a card says nothing to a screen reader, and telling
                   "running" from "not installed" is the whole point of it. */
                aria-label={node.kind === 'plugin'
                  /* Until the install list lands every state reads null, which
                     announces "not installed on this site" for plugins that are
                     running. Only the spoken string is corrected here: the
                     accent maths keys off the same map and treats an unknown
                     state as absent, which is the right look while waiting. */
                  ? `${node.name}. ${statusHint( installedPlugins ? state : 'unknown' )}. ${node.desc}`
                  : `${node.name}. ${node.desc}`}
                onMouseEnter={() => { setHovered( node.id ); setHoveredLayer( null ); }}
                onMouseLeave={() => setHovered( null )}
                onFocus={() => setHovered( node.id )}
                onBlur={() => setHovered( null )}
                /* It is a toggle, and it was announcing nothing about being on. */
                aria-pressed={pinned === node.id}
                onClick={e => { e.stopPropagation(); setPinned( p => ( p === node.id ? null : node.id ) ); }}>
                <span className="node-head">
                  <span className="node-mark">
                    {node.kind === 'plugin'
                      ? <img src={node.icon} alt="" />
                      : <NekoIcon icon={node.iconName} width={node.kind === 'core' ? 21 : 19} height={node.kind === 'core' ? 21 : 19} color={node.color} />}
                  </span>
                  <span className="node-name">{node.name}</span>
                </span>
                {state === 'active' && <span className="node-dot is-active" />}
                {state === 'inactive' && <span className="node-dot is-inactive" />}
              </button>
            );
          } )}

        </StyledStage>
      </div>

    </StyledBoardShell>
  );
};

export { Board };
