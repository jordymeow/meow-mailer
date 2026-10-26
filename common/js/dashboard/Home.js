// The Meow Apps tab: one verdict, then everything that needs the owner in one list (updates, licenses,
// what the plugins report, this week's fatal errors, site problems), then the plugin cards.

import React, { useMemo } from 'react';
import Styled from 'styled-components';
import { NekoIcon } from '@neko-ui';
import { PluginStatus, readStatus } from './PluginStatus';
import { PLUGINS } from './plugins';
import { StyledPanel, MUTED, TONE_COLORS } from './ui';
import { siteChecks, problemsByOwner, PROBLEM_WORDS } from './facts';

const HEALTH_TAB = 'admin.php?page=meowapps-main-menu&nekoTab=health';
const ERRORS_TAB = 'admin.php?page=meowapps-main-menu&nekoTab=errors';
const TONE_RANK = { bad: 0, warning: 1 };

const iconOf = ( slug ) => slug ? PLUGINS[slug.replace( /-pro$/, '' )]?.icon : null;

const buildTodos = ( rows, site, problems ) => {
  const items = [];
  for ( const row of rows ) {
    const name = PLUGINS[row.slug]?.name || row.name;
    const icon = iconOf( row.slug );
    if ( row.behind && row.latest ) {
      items.push( { tone: 'warning', icon, text: `${name}: ${row.latest} is out`, action: row.action } );
    }
    if ( row.pro && row.license !== 'active' ) {
      items.push( { tone: 'warning', icon, text: `${name}: license not active`, action: row.license_action } );
    }
    for ( const todo of row.todos || [] ) {
      if ( todo.severity === 'error' || todo.severity === 'warning' ) {
        items.push( { tone: todo.severity === 'error' ? 'bad' : 'warning', icon, text: `${name}: ${todo.text}`, action: todo.action } );
      }
    }
  }
  for ( const source of problemsByOwner( problems || [] ) ) {
    if ( source.fatal ) {
      items.push( { tone: 'bad', icon: iconOf( source.owner ),
        text: `${source.name}: ${source.fatal} fatal ${source.fatal === 1 ? 'error' : 'errors'} this week`,
        action: { label: 'See', url: ERRORS_TAB } } );
    }
  }
  for ( const check of siteChecks( site ) ) {
    if ( check.tone === 'warning' || check.tone === 'bad' ) {
      items.push( { tone: check.tone, text: `${check.label}: ${PROBLEM_WORDS[check.key] || check.value}`, title: check.note, action: { label: 'Details', url: HEALTH_TAB } } );
    }
  }
  return items.sort( ( a, b ) => TONE_RANK[a.tone] - TONE_RANK[b.tone] );
};

const StyledHome = Styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;

  .verdict {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 18px 12px;

    .verdict-mark {
      flex: none;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      color: white;
      background: var(--tone);
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--tone) 15%, transparent);
    }
    h2 { margin: 0; font-size: 20px; font-weight: 700; color: var(--neko-font-color); }
    p { margin: 3px 0 0; font-size: 14px; color: ${MUTED}; }
  }

`;

const Home = ( { installedPlugins, site, problems } ) => {
  const rows = useMemo( readStatus, [] );
  const loading = problems === undefined;
  const todos = useMemo( () => buildTodos( rows, site, problems ), [rows, site, problems] );
  const urgent = todos.some( t => t.tone === 'bad' );
  const tone = todos.length === 0 ? 'good' : ( urgent ? 'bad' : 'warning' );

  return (
    <StyledHome>
      <StyledPanel className="calm">
        <div className="verdict" style={{ '--tone': TONE_COLORS[tone] }}>
          <span className="verdict-mark">
            <NekoIcon raw icon={tone === 'good' ? 'check' : 'alert'} width={22} height={22} />
          </span>
          <div>
            <h2>{todos.length === 0 ? 'All good'
              : `${todos.length} ${todos.length === 1 ? 'thing needs' : 'things need'} you`}</h2>
            {todos.length === 0 && <p>{loading ? 'Checking this site…' : 'Your site and your Meow Apps look healthy.'}</p>}
          </div>
        </div>
        {todos.map( ( todo, i ) => (
          <div className="row" key={i} title={todo.title}>
            {todo.icon
              ? <img src={todo.icon} alt="" />
              : <NekoIcon raw icon={todo.tone === 'bad' ? 'alert-circle' : 'warning'} width={18} height={18}
                className={`tone-icon ${todo.tone}`} />}
            <span className="row-text">{todo.text}</span>
            {todo.action?.url && <a className="action" href={todo.action.url}
              {...( todo.action.external && { target: '_blank', rel: 'noopener noreferrer' } )}>{todo.action.label}</a>}
          </div>
        ) )}
      </StyledPanel>

      <PluginStatus installedPlugins={installedPlugins} />
    </StyledHome>
  );
};

export { Home };
