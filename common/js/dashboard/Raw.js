// The raw material, folded at the bottom of the Site tab for the rare person who wants it: the full
// PHP error log and phpinfo(). Everyone else reads the plain-language summary above them.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NekoIcon, NekoInput } from '@neko-ui';
import { StyledErrorLogs, StyledPhpInfo, logTone } from './Dashboard.styled';
import { groupRepeats } from './facts';

// Most severe first, which is also the order of the filter chips.
const LOG_SEVERITIES = ['fatal', 'parse', 'exception', 'warning', 'notice'];
const NO_ENTRIES = [];

const ErrorLogs = ( { entries, failed } ) => {
  const [severity, setSeverity] = useState( 'all' );
  const raw = entries || NO_ENTRIES;
  const rows = useMemo( () => groupRepeats( raw ), [raw] );

  const severities = useMemo( () => {
    const counts = {};
    for ( const row of rows ) counts[row.type] = ( counts[row.type] || 0 ) + 1;
    const known = LOG_SEVERITIES.filter( type => counts[type] );
    const rest = Object.keys( counts ).filter( type => !LOG_SEVERITIES.includes( type ) ).sort();
    return [...known, ...rest].map( type => ( { type, count: counts[type] } ) );
  }, [rows] );

  useEffect( () => {
    if ( severity !== 'all' && !severities.some( s => s.type === severity ) ) {
      setSeverity( 'all' );
    }
  }, [severities, severity] );

  const shown = severity === 'all' ? rows : rows.filter( row => row.type === severity );

  return (
    <StyledErrorLogs>
      {rows.length > 0 && (
        <div className="logs-bar">
          <div className="logs-filters" role="group" aria-label="Filter by severity">
            <button type="button" aria-pressed={severity === 'all'} className={severity === 'all' ? 'is-on' : ''}
              onClick={() => setSeverity( 'all' )}>All <b>{rows.length}</b></button>
            {severities.map( ( { type, count } ) => (
              <button key={type} type="button" aria-pressed={severity === type}
                className={severity === type ? 'is-on' : ''} style={{ '--tone': logTone( type ) }}
                onClick={() => setSeverity( type )}>{type} <b>{count}</b></button>
            ) )}
          </div>
          <span className="logs-meta">
            {raw.length > rows.length && `${raw.length} entries in ${rows.length} lines · `}Newest first
          </span>
        </div>
      )}
      <div className="logs-console">
        {shown.map( row => (
          <div className="log-row" key={row.key} style={{ '--tone': logTone( row.type ) }}>
            <span className="log-head">
              <span className="log-type">{row.type}</span>
              <span className="log-date">{row.latest}</span>
              {row.owner && <span className="log-owner">{row.owner}</span>}
              {row.count > 1 && (
                <span className="log-count" title={`Logged ${row.count} times, between ${row.oldest} and ${row.latest}`}>
                  ×{row.count}
                </span>
              )}
            </span>
            <span className="log-content">{row.content}</span>
          </div>
        ) )}
        {shown.length === 0 && (
          <div className={`logs-blank${failed ? ' is-failed' : ''}`}>
            <NekoIcon icon={failed ? 'alert-triangle' : 'check-circle'} width={34} height={34} />
            <strong>{failed ? 'Could not read the error log' : 'The error log is empty'}</strong>
            <span>
              {failed
                ? 'The request did not come back, usually a security plugin or a server rule blocking the REST API. Your hosting control panel shows the same log.'
                : 'Nothing was written to the PHP error log, or your host does not let WordPress read it.'}
            </span>
          </div>
        )}
      </div>
    </StyledErrorLogs>
  );
};

// phpinfo() filtered as you type. Rows are hidden in the DOM: the markup arrives as one HTML string.
const PhpInfo = ( { html } ) => {
  const [query, setQuery] = useState( '' );
  const hostRef = useRef( null );
  const [counts, setCounts] = useState( { shown: 0, total: 0, sections: 0 } );

  useEffect( () => {
    const root = hostRef.current;
    if ( !root ) return;
    const needle = query.trim().toLowerCase();
    let total = 0;
    let shown = 0;
    root.querySelectorAll( 'table' ).forEach( table => {
      let visible = 0;
      table.querySelectorAll( 'tr' ).forEach( row => {
        if ( row.querySelector( 'th' ) ) return;
        total += 1;
        const hit = !needle || row.textContent.toLowerCase().includes( needle );
        row.style.display = hit ? '' : 'none';
        if ( hit ) visible += 1;
      } );
      shown += visible;
      table.style.display = ( needle !== '' && visible === 0 ) ? 'none' : '';
    } );
    // A heading owns every table up to the next heading.
    const headings = [...root.querySelectorAll( 'h2' )];
    headings.forEach( heading => {
      let node = heading.nextElementSibling;
      let alive = false;
      while ( node && node.tagName !== 'H2' ) {
        if ( node.tagName === 'TABLE' && node.style.display !== 'none' ) alive = true;
        node = node.nextElementSibling;
      }
      heading.style.display = ( needle !== '' && !alive ) ? 'none' : '';
    } );
    setCounts( { shown, total, sections: headings.filter( h => h.style.display !== 'none' ).length } );
  }, [query, html] );

  if ( typeof html !== 'string' || html.trim() === '' ) {
    return (
      <StyledPhpInfo>
        <div className="php-body">
          <div className="php-blank is-empty">
            <NekoIcon icon="alert-triangle" width={34} height={34} />
            <strong>PHP info isn&apos;t available here</strong>
            <span>Your host has disabled PHP&apos;s <code>phpinfo()</code>. Your hosting control panel shows the same details.</span>
          </div>
        </div>
      </StyledPhpInfo>
    );
  }

  return (
    <StyledPhpInfo>
      <div className="php-rest">
        <div className="php-bar">
          <NekoInput className="php-search" value={query} onChange={setQuery}
            placeholder="Search directives, extensions, values…" />
          <span className="php-count">
            {query.trim()
              ? `${counts.shown} matching ${counts.shown === 1 ? 'row' : 'rows'}`
              : `${counts.total} rows across ${counts.sections} sections`}
          </span>
        </div>
        <div className="php-body" ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />
        {query.trim() !== '' && counts.shown === 0 && <div className="php-blank">Nothing matches “{query.trim()}”.</div>}
      </div>
    </StyledPhpInfo>
  );
};

export { ErrorLogs, PhpInfo };
