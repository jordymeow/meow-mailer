// The Meow Apps tab. Plugins that have something to say about the site (how much there is to clean,
// how many files are badly named...) get a small card with a green, orange or red state; the others
// are a short list below. Installed plugins report from PHP (MeowKit_Admin::status_row, embedded as
// #meow-common-status, fed by '<prefix>_meowapps_status'); the catalog in plugins.js fills in the
// ones that are not installed, in grey with a link to get them.

import React, { useMemo } from 'react';
import Styled from 'styled-components';
import { NekoIcon } from '@neko-ui';
import { PLUGINS, getInstallState, freeUrl } from './plugins';
import { GREEN, ORANGE, RED, GREY, MUTED, card } from './ui';

const readStatus = () => {
  try {
    // An older copy (plugins-common ac9cbeb) also prints this block inside the page; the newest one
    // comes last, from the footer.
    const all = document.querySelectorAll( '#meow-common-status' );
    const el = all.length ? all[all.length - 1] : null;
    const rows = el ? JSON.parse( el.textContent ) : [];
    return Array.isArray( rows ) ? rows : [];
  }
  catch ( e ) {
    return [];
  }
};

const SEVERITY_RANK = { error: 0, warning: 1, info: 2 };
const LINE_ICONS = { good: 'check-circle', warning: 'warning', bad: 'alert-circle', neutral: 'info-outline' };

// The plugin's own word wins; otherwise its to-dos, an update or an inactive license decide.
const cardState = ( row ) => {
  if ( ['good', 'warning', 'bad'].includes( row.state ) ) {
    return row.state;
  }
  const todos = row.todos || [];
  if ( todos.some( t => t.severity === 'error' ) ) {
    return 'bad';
  }
  if ( todos.some( t => t.severity === 'warning' ) || row.behind || ( row.pro && row.license !== 'active' ) ) {
    return 'warning';
  }
  return 'good';
};

// What the card says under its number: the most urgent to-do, else an inactive Pro license, else
// the plugin's note, else that all is well. An info to-do (space to free, things to review) keeps the
// card green but reads neutral: a green check next to "214 unused files" would say all is well.
const cardLine = ( row, state ) => {
  const todos = [...( row.todos || [] )].sort( ( a, b ) =>
    ( SEVERITY_RANK[a.severity] ?? 2 ) - ( SEVERITY_RANK[b.severity] ?? 2 ) );
  const more = Math.max( 0, todos.length - 1 );
  if ( todos[0] && todos[0].severity !== 'info' ) {
    return { text: todos[0].text, tone: todos[0].severity === 'error' ? 'bad' : 'warning', action: todos[0].action, more };
  }
  if ( row.pro && row.license !== 'active' ) {
    return { text: 'License not active', tone: 'warning', action: row.license_action, more: todos.length };
  }
  if ( row.note ) {
    return { text: row.note, tone: todos.length && state === 'good' ? 'neutral' : state, more: todos.length };
  }
  if ( todos[0] ) {
    return { text: todos[0].text, tone: 'neutral', action: todos[0].action, more };
  }
  return { text: 'All good', tone: 'good', more: 0 };
};

const StyledStatus = Styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;
  flex: 1 1 100%;
  box-sizing: border-box;

  /* Six cards: three per row keeps two full rows, never a lonely card on a row of its own. */
  .cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;

    @media (max-width: 1100px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    @media (max-width: 640px) { grid-template-columns: 1fr; }
  }

  .mcard {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 18px 14px;
    ${card}
    overflow: hidden;

    /* The state as a thin bar along the top: readable at a glance, quiet up close. */
    &::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 3px;
      background: ${GREY};
    }
    &.good::before { background: ${GREEN}; }
    &.warning::before { background: ${ORANGE}; }
    &.bad::before { background: ${RED}; }
    &.absent::before { display: none; }
  }

  .mcard-top {
    display: flex;
    align-items: center;
    gap: 10px;

    img { width: 34px; height: 34px; border-radius: 8px; flex: none; }
  }

  .mcard-name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    font-size: 14px;
    color: var(--neko-font-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
    background: ${GREY};
    box-shadow: 0 0 0 4px rgba(184, 192, 204, 0.25);
  }
  .good .dot { background: ${GREEN}; box-shadow: 0 0 0 4px rgba(31, 157, 92, 0.15); }
  .warning .dot { background: ${ORANGE}; box-shadow: 0 0 0 4px rgba(212, 136, 26, 0.15); }
  .bad .dot { background: ${RED}; box-shadow: 0 0 0 4px rgba(214, 69, 69, 0.15); }

  .metric {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-height: 30px;

    .value {
      font-size: 24px;
      font-weight: 700;
      line-height: 1;
      color: var(--neko-font-color);
      font-variant-numeric: tabular-nums;
    }
    .label { font-size: 13px; color: ${MUTED}; }
  }

  .role { font-size: 13px; color: ${MUTED}; min-height: 30px; line-height: 1.4; }

  .line {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    line-height: 1.4;
    color: var(--neko-font-color);

    svg { flex: none; margin-top: 1px; }
    .good { color: ${GREEN}; }
    .warning { color: ${ORANGE}; }
    .bad { color: ${RED}; }
    .neutral { color: ${GREY}; }
    .more { color: ${MUTED}; white-space: nowrap; }
  }

  .mcard-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid #eef1f6;
    font-size: 12px;
    color: ${MUTED};
    min-height: 18px;
  }

  /* Not installed: grey and quiet, with one way in. */
  .mcard.absent {
    background: #f6f7f9;
    box-shadow: none;

    img { filter: grayscale(1); opacity: 0.6; }
    .mcard-name { color: ${MUTED}; }
  }

  .pill {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: #eef1f6;
    color: ${MUTED};
    margin-left: 6px;
    vertical-align: 1px;

    &.pro { background: #fff3d6; color: #a86a00; }
  }

  .version {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-variant-numeric: tabular-nums;

    .ok { color: ${GREEN}; }
    .behind { color: ${ORANGE}; }
  }

  a.action {
    color: var(--neko-main-color);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    &:hover, &:focus-visible { text-decoration: underline; }
  }

  /* The plugins with nothing to report: one compact list. */
  .others {
    ${card}
    overflow: hidden;
  }

  .others-title {
    padding: 14px 18px 8px;
    font-size: 12px;
    font-weight: 600;
    color: ${MUTED};
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .other {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    border-top: 1px solid #eef1f6;
    font-size: 13px;
    color: var(--neko-font-color);

    img { width: 24px; height: 24px; border-radius: 6px; flex: none; }
    .other-name { flex: 1; min-width: 0; font-weight: 600; }
    .other-meta { color: ${MUTED}; white-space: nowrap; }
  }

  .also {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    padding: 12px 18px 14px;
    border-top: 1px solid #eef1f6;
    font-size: 12px;
    color: ${MUTED};

    &:first-child { border-top: none; }

    a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: ${MUTED};
      text-decoration: none;
      &:hover, &:focus-visible { color: var(--neko-main-color); }
    }
    img { width: 18px; height: 18px; border-radius: 5px; filter: grayscale(1); opacity: 0.7; }
  }
`;

const Version = ({ row }) => {
  if ( !row?.version ) {
    return null;
  }
  if ( row.behind && row.latest ) {
    return <span className="version"><NekoIcon raw icon="warning" width={13} height={13} className="behind" />
      {row.version} → {row.latest}</span>;
  }
  return <span className="version"><NekoIcon raw icon="check-circle" width={13} height={13} className="ok" />
    {row.version}</span>;
};

const Action = ({ action }) => {
  if ( !action?.url ) {
    return null;
  }
  return <a className="action" href={action.url}
    {...( action.external && { target: '_blank', rel: 'noopener noreferrer' } )}>{action.label}</a>;
};

const Pill = ({ row }) => row
  ? <span className={`pill ${row.pro ? 'pro' : ''}`}>{row.pro ? 'Pro' : 'Free'}</span>
  : null;

const capitalize = text => text.charAt( 0 ).toUpperCase() + text.slice( 1 );

const Card = ({ slug, plugin, row, state }) => {
  if ( !state ) {
    return (
      <div className="mcard absent">
        <div className="mcard-top">
          <img src={plugin.icon} alt="" />
          <span className="mcard-name">{plugin.name}</span>
        </div>
        <div className="role">{capitalize( plugin.role )}.</div>
        <div className="mcard-foot">
          <span>Not installed</span>
          <a className="action" href={freeUrl( slug )} target="_blank" rel="noopener noreferrer">Get it ↗</a>
        </div>
      </div>
    );
  }
  if ( !row ) {
    return (
      <div className="mcard">
        <div className="mcard-top">
          <img src={plugin.icon} alt="" />
          <span className="mcard-name">{plugin.name}</span>
          <span className="dot" />
        </div>
        <div className="role">{capitalize( plugin.role )}.</div>
        <div className="mcard-foot">
          <span>{state === 'inactive' ? 'Installed, not active' : 'Update it to see its status here'}</span>
        </div>
      </div>
    );
  }
  const tone = cardState( row );
  const line = cardLine( row, tone );
  const footAction = row.behind ? row.action : line.action;
  return (
    <div className={`mcard ${tone}`}>
      <div className="mcard-top">
        <img src={plugin.icon} alt="" />
        <span className="mcard-name">{plugin.name}<Pill row={row} /></span>
        <span className="dot" title={{ good: 'All good', warning: 'Needs a look', bad: 'Needs attention' }[tone]} />
      </div>
      <div className="metric">
        {row.metric
          ? <><span className="value">{row.metric.value}</span><span className="label">{row.metric.label}</span></>
          : <span className="label">{capitalize( plugin.role )}.</span>}
      </div>
      <div className="line">
        <NekoIcon raw icon={LINE_ICONS[line.tone]} width={14} height={14} className={line.tone} />
        <span>{line.text}{line.more > 0 && <span className="more"> · +{line.more} more</span>}</span>
      </div>
      <div className="mcard-foot">
        <Version row={row} />
        <Action action={footAction} />
      </div>
    </div>
  );
};

const PluginStatus = ({ installedPlugins }) => {
  const reported = useMemo( readStatus, [] );

  const { cards, others, absent } = useMemo( () => {
    const bySlug = Object.fromEntries( reported.map( r => [r.slug, r] ) );
    const cards = [];
    const others = [];
    const absent = [];
    Object.entries( PLUGINS ).forEach( ([slug, plugin]) => {
      const row = bySlug[slug];
      const state = row ? 'active' : getInstallState( slug, installedPlugins );
      const entry = { slug, plugin, row, state };
      if ( plugin.card ) {
        cards.push( entry );
      }
      else {
        ( state ? others : absent ).push( entry );
      }
    } );
    // Installed cards first, the grey ones after.
    cards.sort( ( a, b ) => ( a.state ? 0 : 1 ) - ( b.state ? 0 : 1 ) );
    return { cards, others, absent };
  }, [reported, installedPlugins] );

  return (
    <StyledStatus>
      <div className="cards">
        {cards.map( entry => <Card key={entry.slug} {...entry} /> )}
      </div>

      {( others.length > 0 || absent.length > 0 ) && (
        <div className="others">
          {others.length > 0 && <div className="others-title">Also on this site</div>}
          {others.map( ({ slug, plugin, row, state }) => (
            <div className="other" key={slug}>
              <img src={plugin.icon} alt="" />
              <span className="other-name">{plugin.name}<Pill row={row} /></span>
              {row?.metric && <span className="other-meta">{row.metric.value} {row.metric.label}</span>}
              {row ? <Version row={row} /> : <span className="other-meta">{state === 'inactive' ? 'Inactive' : ''}</span>}
              {row?.behind && <Action action={row.action} />}
            </div>
          ) )}
          {absent.length > 0 && (
            <div className="also">
              <span>More from Meow Apps:</span>
              {absent.map( ({ slug, plugin }) => (
                <a key={slug} href={freeUrl( slug )} target="_blank" rel="noopener noreferrer" title={plugin.desc}>
                  <img src={plugin.icon} alt="" />{plugin.name}
                </a>
              ) )}
            </div>
          )}
        </div>
      )}
    </StyledStatus>
  );
};

export { PluginStatus, readStatus };
