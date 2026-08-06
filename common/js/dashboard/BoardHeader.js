/* eslint-disable react/no-unescaped-entities */
// React & Vendor Libs
const { useMemo, useState, useEffect, useRef } = wp.element;

import { NekoIcon } from '@neko-ui';

import { PLUGINS, SYNERGIES, JOURNEYS, buildNodes, getFeatureIcon, getJourneysThrough,
  getInstallState, statusLabel, statusHint, freeUrl, proUrl } from './plugins';
import { StyledBoardHeader, StyledViewToggle } from './Board.styled';

// What the strip needs to seat each block, in the order it gives them up.
// Squeezing instead of dropping produced "One…" and "Han…" for the chips, or
// the buttons sliding under the view toggle, so blocks are whole or absent.
//
// Partners go first: point at a plugin and the board already draws a wire to
// everything it works with, so those icons are a second telling. The
// capabilities exist nowhere else on the board, so they hold out longer.
//
// Measured against the strip itself rather than the viewport, because
// collapsing the admin menu or a narrower column changes the room available
// without touching the window size.
// Icon slots in the "works with" column. Five 26px icons and their gaps are
// exactly what .header-related is sized for; a sixth would push it wider than
// the strip can spare.
const RELATED_SLOTS = 5;

const NEEDS_PARTNERS_PX = 1250;
const NEEDS_CHIPS_PX = 1045;

// The tiers above only ever governed the live readout. The resting state had
// none, so its three stat tiles — 444px of them, against a strip that also owes
// 66px to the mark, 165px to the identity, 72px to the toggle and 128px to its
// own padding — simply ran off the right-hand end on a narrow column.
// Measured: all three need about 840px, one needs about 530px.
const NEEDS_ALL_STATS_PX = 880;
const NEEDS_ANY_STATS_PX = 620;
// Below this, even the icon, the identity and the two buttons don't fit at full
// size — the chips and partners are long gone by here. The identity is allowed
// to shrink from this point: a shortened description, and in the extreme an
// ellipsised name, because buttons sliding under the view toggle is a defect
// rather than a compromise.
const NEEDS_ROOM_PX = 1000;

// The site's own name, because the header is about your site. The admin bar
// always carries it in wp-admin; if it ever doesn't, we fall back.
const readSiteName = () => {
  try {
    const el = document.querySelector( '#wp-admin-bar-site-name > a' );
    const name = el ? el.textContent.trim() : '';
    if ( name && name.length <= 30 ) return name;
  }
  catch ( e ) { /* no admin bar, no problem */ }
  return 'Your WordPress Site';
};

// Shared by both views, so switching between them doesn't change the furniture.
// `node` is whatever the board is pointing at, or null for the resting state.
// `ready` is false until the install list arrives. Defaults to true so a caller
// that doesn't know about the race behaves as before.
const BoardHeader = ( { installedPlugins, node = null, partners = [], states = null,
  view, onView, ready = true } ) => {
  const siteName = useMemo( readSiteName, [] );

  const stripRef = useRef( null );
  const [room, setRoom] = useState( { chips: true, partners: true, tight: false, stats: 'all' } );
  useEffect( () => {
    const el = stripRef.current;
    if ( !el ) return undefined;
    const measure = () => setRoom( {
      chips: el.clientWidth >= NEEDS_CHIPS_PX,
      partners: el.clientWidth >= NEEDS_PARTNERS_PX,
      tight: el.clientWidth < NEEDS_ROOM_PX,
      // Whole tiles or none, the same rule the rest of the strip follows —
      // letting them shrink is what produced "One…" and "Han…" on the chips.
      // Running survives longest: it's the only one of the three the grid's
      // group headings don't already say.
      stats: el.clientWidth >= NEEDS_ALL_STATS_PX ? 'all'
        : ( el.clientWidth >= NEEDS_ANY_STATS_PX ? 'one' : 'none' ),
    } );
    measure();
    if ( typeof ResizeObserver === 'undefined' ) {
      window.addEventListener( 'resize', measure );
      return () => window.removeEventListener( 'resize', measure );
    }
    const observer = new ResizeObserver( measure );
    observer.observe( el );
    return () => observer.disconnect();
  }, [] );

  const summary = useMemo( () => {
    const map = states || {};
    const slugs = Object.keys( PLUGINS );
    const stateOf = slug => ( states ? map[slug] : getInstallState( slug, installedPlugins ) );
    const installed = slugs.filter( s => stateOf( s ) ).length;
    const running = slugs.filter( s => stateOf( s ) === 'active' ).length;
    const liveLinks = SYNERGIES.filter( ( [a, b] ) => stateOf( a ) === 'active' && stateOf( b ) === 'active' ).length;
    const liveJourneys = JOURNEYS.filter( j => j.needs.every( n => stateOf( n ) === 'active' ) ).length;
    return {
      installed,
      total: slugs.length,
      // Each tile says what it actually counts. "Integrations" read as though it
      // meant SMTP providers or social networks; it never did — it means pairs
      // of Meow plugins that make each other better. And the journey count is
      // how many stories this board draws, which is not a ceiling on what the
      // plugins do, so it belongs in the tooltip rather than the headline.
      stats: [
        { label: 'Running', value: running, of: slugs.length,
          hint: `${running} of your ${slugs.length} Meow plugins are installed and active.` },
        { label: 'Working together', value: liveLinks, of: SYNERGIES.length,
          hint: 'Pairs of Meow plugins that make each other better — '
            + `${liveLinks} of ${SYNERGIES.length} pairs have both halves running.` },
        { label: 'Things it can do', value: liveJourneys, of: '∞',
          hint: `${liveJourneys} of the ${JOURNEYS.length} journeys drawn on this board are live on `
            + 'your site. The plugins do plenty more that no board could fit.' },
      ],
    };
  }, [installedPlugins, states] );

  // Before the install list lands, `states` reads null for everything, which the
  // pill renders as "Not installed" — the same claim the grid and the counters
  // used to make and no longer do. The readout has to agree with them.
  const nodeState = ready ? ( node && states ? states[node.id] : null ) : 'unknown';

  // The middle of the strip used to be dead space. It now answers "what does
  // this actually do?" — features for a plugin, and for a core module or a
  // world actor, the journeys that run through it. Ghost journeys stay in the
  // list, dimmed: what your site could be doing is part of the point.
  const highlights = useMemo( () => {
    if ( !node ) return [];
    const isLive = j => j.needs.every( n => states && states[n] === 'active' );

    // A plugin you don't have is the one case where its feature list is the
    // wrong answer. The board has just flown a ghost through it and lit it up;
    // what sells it is the things that ghost stands for, in the same words the
    // board uses everywhere else — "A snippet runs on schedule" rather than
    // "Scheduled Runs". The status pill beside the name already says it isn't
    // installed, so dimmed chips read as what you're missing.
    // `ready`, or every plugin looks un-owned for the moment before the install
    // list arrives and the strip offers to sell you things you already run.
    if ( ready && node.kind === 'plugin' && states && !states[node.id] ) {
      const unlocks = [...getJourneysThrough( node.id )];
      if ( unlocks.length ) {
        return unlocks.slice( 0, 4 )
          .map( j => ( { key: j.id, label: j.label, glyph: j.glyph, live: false } ) );
      }
      // A plugin no journey passes through still has its features to show.
    }

    if ( node.kind === 'plugin' ) {
      return ( node.features || [] ).slice( 0, 4 ).map( f => ( { key: f, label: f, live: true } ) );
    }
    return [...getJourneysThrough( node.id )]
      .sort( ( a, b ) => Number( isLive( b ) ) - Number( isLive( a ) ) )
      .slice( 0, 4 )
      .map( j => ( { key: j.id, label: j.label, glyph: j.glyph, live: isLive( j ) } ) );
  }, [node, states, ready] );

  return (
    <StyledBoardHeader ref={stripRef} className={room.tight ? 'is-tight' : ''}
      onClick={e => e.stopPropagation()}>
      {!node && (
        <div className="header-idle">
          <span className="header-mark is-site">
            <NekoIcon icon="cat" width={26} height={26} color="#ffffff" />
          </span>
          <div className="header-id">
            <span className="header-name">{siteName}</span>
            <span className="header-sub">
              {ready
                ? <><b>{summary.installed}</b> of {summary.total} Meow plugins installed</>
                : 'Checking which Meow plugins are installed…'}
            </span>
          </div>
          <span className="header-spacer" />
          {/* Three zeroes is not a summary of your site, it's a summary of what
              we haven't loaded yet. */}
          {ready && room.stats !== 'none' && (
          <div className="header-stats">
            {( room.stats === 'all' ? summary.stats : summary.stats.slice( 0, 1 ) ).map( stat => (
              <div key={stat.label} className="stat" title={stat.hint}>
                <span className="stat-value">
                  <b>{stat.value}</b><i>/</i>
                  <em className={typeof stat.of === 'number' ? '' : 'is-endless'}>{stat.of}</em>
                </span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ) )}
          </div>
          )}
        </div>
      )}

      {node && (
        <div className="header-live">
          <span className={`header-mark is-${node.kind}`} style={{ '--accent': node.color }}>
            {node.kind === 'plugin'
              ? <img src={node.icon} alt="" />
              : <NekoIcon icon={node.iconName} width={24} height={24} color={node.color} />}
          </span>
          <div className="header-id">
            <span className="header-name">
              {/* Wrapped so the name can ellipsis if it has to. Left as a bare
                  text node, "Database Cleaner" plus "Not installed" — the widest
                  pair there is — pushed the pill 216px out of its column and
                  straight over the capability chips. */}
              <span className="header-title">{node.name}</span>
              {node.kind === 'plugin' && (
                <span className={`header-status is-${nodeState || 'none'}`} title={statusHint( nodeState )}>
                  <i />{statusLabel( nodeState )}
                </span>
              )}
            </span>
            <span className="header-desc">{node.desc}</span>
          </div>
          {room.chips && highlights.length > 0 && (
            <div className="header-features">
              {highlights.map( h => (
                <span key={h.key} className={`feature-chip${h.live ? '' : ' is-ghost'}`}
                  title={h.label}>
                  {h.glyph
                    ? <i className="chip-glyph">{h.glyph}</i>
                    : <NekoIcon icon={getFeatureIcon( h.label ) || 'circle'} width={13} height={13} />}
                  <span className="chip-label">{h.label}</span>
                </span>
              ) )}
            </div>
          )}
          <span className="header-spacer" />
          {room.partners && partners.length > 0 && (
            <div className="header-related">
              <span className="related-label">
                {node.kind === 'plugin' ? 'Works with' : 'Worked on by'}
              </span>
              {/* Five slots, and if there are more than five partners the last
                  one becomes a count rather than quietly dropping somebody —
                  AI Engine has six, and the sixth simply vanished before. */}
              <span className="related-icons">
                {partners.slice( 0, partners.length > RELATED_SLOTS ? RELATED_SLOTS - 1 : RELATED_SLOTS ).map( p => (
                  <img key={p.id} src={p.icon} alt={p.name} title={p.name}
                    className={states && states[p.id] ? 'on' : 'off'} />
                ) )}
                {partners.length > RELATED_SLOTS && (
                  <span className="related-more"
                    title={partners.slice( RELATED_SLOTS - 1 ).map( p => p.name ).join( ', ' )}>
                    +{partners.length - ( RELATED_SLOTS - 1 )}
                  </span>
                )}
              </span>
            </div>
          )}
          {node.kind === 'plugin' && (
            <div className="header-actions">
              <a className="free" href={freeUrl( node.id )} target="_blank" rel="noreferrer">Free</a>
              {/* Meow Mailer and Contact Form Block have no paid tier; the Pro
                  button pointed at a page with nothing to buy. */}
              {!node.freeOnly && (
                <a className="pro" href={proUrl( node.id )} target="_blank" rel="noreferrer">Pro</a>
              )}
            </div>
          )}
        </div>
      )}

      {/* aria-pressed, because which view you were in was shown by the lit
          button and nothing else — to a screen reader the two sounded
          identical. The pair gets a name so it reads as one control. */}
      <StyledViewToggle role="group" aria-label="View">
        <button type="button" className={view === 'board' ? 'is-on' : ''}
          aria-pressed={view === 'board'}
          onClick={() => onView( 'board' )} title="Board" aria-label="Board view">
          <NekoIcon icon="share" width={16} height={16} />
        </button>
        <button type="button" className={view === 'grid' ? 'is-on' : ''}
          aria-pressed={view === 'grid'}
          onClick={() => onView( 'grid' )} title="Grid" aria-label="Grid view">
          <NekoIcon icon="view-grid" width={16} height={16} />
        </button>
      </StyledViewToggle>
    </StyledBoardHeader>
  );
};

export { BoardHeader, buildNodes };
