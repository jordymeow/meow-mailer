// The Errors tab: this week at a glance (which plugin, how bad), then the full PHP error log.

import React, { useMemo } from 'react';
import Styled from 'styled-components';
import { NekoIcon } from '@neko-ui';
import { PLUGINS } from './plugins';
import { StyledPanel } from './ui';
import { problemsByOwner } from './facts';
import { ErrorLogs } from './Raw';

const StyledErrorsTab = Styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;

  .log { padding: 4px 18px 18px; }
`;

const Errors = ( { problems, entries, failed } ) => {
  const sources = useMemo( () => problemsByOwner( problems || [] ), [problems] );
  const loading = problems === undefined;

  return (
    <StyledErrorsTab>
      <StyledPanel>
        <div className="panel-title">
          This week
          <span className="panel-side">{loading ? 'Reading the log…'
            : `${problems.length} distinct ${problems.length === 1 ? 'problem' : 'problems'}`}</span>
        </div>
        {!loading && sources.length === 0 && (
          <div className="row">
            <NekoIcon raw icon={failed ? 'warning' : 'check-circle'} width={18} height={18}
              className={`tone-icon ${failed ? 'warning' : 'good'}`} />
            <span className="row-text">{failed
              ? 'The error log could not be read from here. Your hosting control panel shows it.'
              : 'No PHP errors in the last 7 days.'}</span>
          </div>
        )}
        {sources.map( source => {
          const plugin = PLUGINS[( source.owner || '' ).replace( /-pro$/, '' )];
          const tone = source.fatal ? 'bad' : 'warning';
          return (
            <div className="row" key={source.name}>
              {plugin
                ? <img src={plugin.icon} alt="" />
                : <NekoIcon raw icon={source.owner === 'WordPress' ? 'home' : 'plug'} width={18} height={18} className="tone-icon neutral" />}
              <span className="row-text"><span className="row-label">{source.name}</span></span>
              <NekoIcon raw icon={tone === 'bad' ? 'alert-circle' : 'warning'} width={16} height={16} className={`tone-icon ${tone}`} />
              <span className="row-note">
                {[source.fatal && `${source.fatal} fatal`, source.other && `${source.other} ${source.other === 1 ? 'warning' : 'warnings'}`]
                  .filter( Boolean ).join( ' · ' )}
              </span>
            </div>
          );
        } )}
      </StyledPanel>

      <StyledPanel>
        <div className="panel-title">The full log</div>
        <div className="log">
          {entries === undefined && !failed
            ? <span className="row-note">Reading the log…</span>
            : <ErrorLogs entries={entries} failed={failed} />}
        </div>
      </StyledPanel>
    </StyledErrorsTab>
  );
};

export { Errors };
