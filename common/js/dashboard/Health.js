// The Health tab: three ratings, then the server and WordPress in plain words (always visible),
// a speed test and AI Engine's opinion that open inline, the support report, and every PHP setting
// folded at the very bottom. White cards only.

import React, { useState, useMemo, useCallback } from 'react';
import Styled from 'styled-components';
import { NekoIcon, NekoButton, nekoFetch } from '@neko-ui';
import { restUrl, restNonce } from '@app/settings';
import { readStatus } from './PluginStatus';
import { freeUrl } from './plugins';
import { StyledPanel, card, MUTED, GREY, ORANGE, RED, TONE_COLORS } from './ui';
import { siteChecks, healthRatings, shortenPaths, buildReport, PROBLEM_WORDS } from './facts';
import { PhpInfo } from './Raw';

const CommonApiUrl = `${restUrl}/meow-common/v1`;
const TONE_ICONS = { good: 'check-circle', warning: 'warning', bad: 'alert-circle', neutral: 'info-outline' };
const AREA_ICONS = { Speed: 'zap', Environment: 'server', Errors: 'alert-triangle' };
const SEVERITY_TONE = { high: 'bad', medium: 'warning', low: 'neutral' };
// One icon per fact, coloured by its state; the explanation lives in the tooltip. Only a problem
// keeps a few words on screen (PROBLEM_WORDS; Jordy: less text, more icons).
const FACT_ICONS = {
  php: 'terminal', memory: 'brain', time: 'timer-outline', upload: 'upload', vars: 'list-checks',
  database: 'database', webserver: 'server', wordpress: 'dashboard', theme: 'image', plugins: 'plug',
  https: 'lock', cron: 'sync', debug: 'debug', cache: 'zap',
};
const ratingTone = r => !r ? 'none' : ( r >= 4 ? 'good' : ( r >= 3 ? 'warning' : 'bad' ) );

const SPEED_TESTS = [
  { request: 'empty_request', label: 'Server', icon: 'server', note: 'How fast WordPress answers an empty request.' },
  { request: 'file_operation', label: 'Disk', icon: 'save', note: 'Writes and deletes a 10 MB file.' },
  { request: 'sql_request', label: 'Database', icon: 'database', note: 'Counts every post in the database.' },
];
const SAMPLES = 5;

const StyledHealthTab = Styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;

  .ratings, .pair {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;

    @media (max-width: 900px) { grid-template-columns: 1fr; }
  }
  .pair { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }

  .rating {
    ${card}
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 18px 18px 16px;

    &::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--tone, ${GREY}); }
    .area { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; }
    .area svg { color: var(--tone, ${GREY}); }
    .dots { display: flex; gap: 4px; }
    .dots i { width: 8px; height: 8px; border-radius: 50%; background: #e3e7ee; }
    .dots i.on { background: var(--tone); }
    .label { font-size: 16px; font-weight: 700; color: var(--neko-font-color); }
  }

  .row .row-value { max-width: 45%; overflow: hidden; text-overflow: ellipsis; }
  .row-problem { font-size: 13px; font-weight: 600; }
  .row-problem.warning { color: ${ORANGE}; }
  .row-problem.bad { color: ${RED}; }
  .rating .label { font-size: 17px; }

  .inline {
    padding: 0 18px 10px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--neko-font-color);

    p { margin: 0 0 12px; }
    .muted { color: ${MUTED}; font-size: 13px; }
    .actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  }

  .finding {
    display: flex;
    gap: 10px;
    padding: 6px 0;
    font-size: 13px;
    b { display: block; font-size: 14px; font-weight: 400; }
    span { color: ${MUTED}; }
  }

  .fold {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 14px 18px;
    border: 0;
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--neko-font-color);
    cursor: pointer;
    &:hover { color: var(--neko-main-color); }
  }
  .fold-body { padding: 0 18px 18px; }
`;

const Ratings = ( { ratings } ) => (
  <div className="ratings">
    {ratings.map( r => {
      const tone = ratingTone( r.rating );
      return (
        <div key={r.area} className="rating" title={r.summary} style={tone !== 'none' ? { '--tone': TONE_COLORS[tone] } : {}}>
          <span className="area"><NekoIcon raw icon={AREA_ICONS[r.area]} width={13} height={13} />{r.area}</span>
          <span className="dots">{[1, 2, 3, 4, 5].map( n => <i key={n} className={n <= r.rating ? 'on' : ''} /> )}</span>
          <span className="label">{r.label}</span>
        </div>
      );
    } )}
  </div>
);

const FactList = ( { title, checks } ) => (
  <StyledPanel className="calm">
    <div className="panel-title">{title}</div>
    {checks.length === 0 && (
      <div className="row"><span className="row-note">Update your Meow plugins to see this here.</span></div>
    )}
    {checks.map( check => {
      const problem = check.tone === 'warning' || check.tone === 'bad';
      return (
        <div className="row" key={check.key} title={check.note || undefined}>
          <NekoIcon raw icon={FACT_ICONS[check.key] || 'info-outline'} width={18} height={18} className={`tone-icon ${check.tone}`} />
          <span className="row-text">
            <span className="row-label">{check.label}</span>
            {problem && PROBLEM_WORDS[check.key] && <span className={`row-problem ${check.tone}`}> {PROBLEM_WORDS[check.key]}</span>}
          </span>
          <span className="row-value">{check.value}</span>
        </div>
      );
    } )}
  </StyledPanel>
);

// A few quick samples per test, one test after the other: enough for a fair average without
// putting load on a live site. The slowest test decides the Speed rating.
const SpeedTest = ( { results, onResults } ) => {
  const [running, setRunning] = useState( false );
  const [failed, setFailed] = useState( false );

  const run = useCallback( async () => {
    setRunning( true );
    setFailed( false );
    const done = [];
    try {
      for ( const test of SPEED_TESTS ) {
        const times = [];
        for ( let i = 0; i < SAMPLES; i++ ) {
          const started = performance.now();
          await nekoFetch( `${CommonApiUrl}/${test.request}`, { method: 'POST', nonce: restNonce } );
          times.push( performance.now() - started );
          await new Promise( r => setTimeout( r, 250 ) );
        }
        done.push( { ...test, ms: Math.round( times.reduce( ( a, b ) => a + b, 0 ) / times.length ) } );
        onResults( [...done] );
      }
    }
    catch ( e ) {
      setFailed( true );
    }
    finally {
      setRunning( false );
    }
  }, [onResults] );

  // The three tests are always listed, greyed out until they have run, so the card shows what it
  // will measure instead of a paragraph about it.
  const byRequest = Object.fromEntries( results.map( r => [r.request, r] ) );
  return (
    <StyledPanel className="calm">
      <div className="panel-title">
        Speed test
        <span className="panel-action">
          <NekoButton className="primary" small onClick={run} isBusy={running} disabled={running}>
            {running ? 'Testing' : ( results.length ? 'Run again' : 'Run' )}
          </NekoButton>
        </span>
      </div>
      {SPEED_TESTS.map( test => {
        const r = byRequest[test.request];
        const tone = !r ? 'neutral' : ( r.ms <= 300 ? 'good' : ( r.ms <= 2000 ? 'warning' : 'bad' ) );
        return (
          <div className={`row${r ? '' : ' is-pending'}`} key={test.request} title={test.note}>
            <NekoIcon raw icon={test.icon} width={18} height={18} className={`tone-icon ${tone}`} />
            <span className="row-text"><span className="row-label">{test.label}</span></span>
            <span className="row-value">{r ? `${r.ms} ms` : ( running ? '…' : '·' )}</span>
          </div>
        );
      } )}
      {failed && (
        <div className="row">
          <NekoIcon raw icon="warning" width={18} height={18} className="tone-icon warning" />
          <span className="row-text row-note" title="A security plugin blocking the REST API is the usual cause.">The test could not reach your site.</span>
        </div>
      )}
    </StyledPanel>
  );
};

// What AI Engine is asked: the facts on this page, with file paths shortened before they leave.
const analysisFacts = ( checks, problems, rows, speed ) => ( {
  php: Object.fromEntries( checks.map( c => [c.label, c.value] ) ),
  speed: speed.map( s => ( { test: s.label, averageMs: s.ms, samples: SAMPLES } ) ),
  errors: {
    distinctProblems: problems.length,
    totalEntries: problems.reduce( ( n, p ) => n + p.count, 0 ),
    top: problems.slice( 0, 12 ).map( p => ( { type: p.type, from: p.owner, times: p.count, message: shortenPaths( p.content ).slice( 0, 220 ) } ) ),
  },
  meowPluginsInstalled: rows.map( r => `${r.slug} (active)` ),
} );

const AiReview = ( { status, facts, onDone } ) => {
  const [busy, setBusy] = useState( false );
  const [error, setError] = useState( null );
  const [verdict, setVerdict] = useState( null );
  const shown = verdict || status?.last || null;

  const run = async () => {
    setBusy( true );
    setError( null );
    try {
      const reply = await nekoFetch( `${CommonApiUrl}/analysis_run/`, { method: 'POST', nonce: restNonce, json: { facts: facts() } } );
      if ( reply.success ) {
        setVerdict( reply.data );
        onDone && onDone();
      }
      else {
        setError( reply.message || 'AI Engine could not answer.' );
      }
    }
    catch ( e ) {
      setError( e?.message || 'AI Engine could not answer.' );
    }
    finally {
      setBusy( false );
    }
  };

  if ( !status ) return null;
  return (
    <StyledPanel>
      <div className="panel-title" title={shown?.conclusion || undefined}>
        Ask AI Engine
        {shown?.ranAt && <span className="panel-side">{shown.ranAt.slice( 0, 10 )}</span>}
        {status.ready && (
          <span className="panel-action">
            <NekoButton className="primary" small onClick={run} isBusy={busy} disabled={busy}>
              {shown ? 'Ask again' : 'Review my site'}
            </NekoButton>
          </span>
        )}
      </div>
      <div className="inline">
        {!status.installed && <>
          <p className="muted">AI Engine can read this page and tell you, in plain words, what is worth fixing.</p>
          <a className="action" href={freeUrl( 'ai-engine' )} target="_blank" rel="noreferrer">Get AI Engine ↗</a>
        </>}
        {status.installed && !status.ready && (
          <p className="muted">AI Engine needs an API key first. <a className="action" href="admin.php?page=mwai_settings">Open AI Engine</a></p>
        )}
        {status.ready && !shown && <p className="muted">Reads this page and says what is worth fixing.</p>}
        {( shown?.findings || [] ).map( ( f, i ) => {
          const tone = SEVERITY_TONE[f.severity] || 'neutral';
          return (
            <div className="finding" key={i}>
              <NekoIcon raw icon={TONE_ICONS[tone]} width={16} height={16} className={`tone-icon ${tone}`} />
              <b title={f.action || f.detail}>{f.title}</b>
            </div>
          );
        } )}
        {error && <p className="muted">{error}</p>}
      </div>
    </StyledPanel>
  );
};

const Health = ( { site, problems, phpInfo, analysisStatus, onAnalysisDone } ) => {
  const rows = useMemo( readStatus, [] );
  const checks = useMemo( () => siteChecks( site ), [site] );
  const [speed, setSpeed] = useState( [] );
  const [copied, setCopied] = useState( false );
  const [phpOpen, setPhpOpen] = useState( false );
  const ratings = useMemo( () => healthRatings( checks, problems, speed ), [checks, problems, speed] );

  const copyReport = async () => {
    const text = buildReport( site, rows, problems || [] );
    try {
      await navigator.clipboard.writeText( text );
    }
    catch ( e ) {
      // Non-secure origins have no clipboard API: fall back to a hidden textarea.
      const area = document.createElement( 'textarea' );
      area.value = text;
      document.body.appendChild( area );
      area.select();
      document.execCommand( 'copy' );
      area.remove();
    }
    setCopied( true );
    setTimeout( () => setCopied( false ), 2500 );
  };

  return (
    <StyledHealthTab>
      <Ratings ratings={ratings} />

      <div className="pair">
        <FactList title="Server" checks={checks.filter( c => c.group === 'server' )} />
        <FactList title="WordPress" checks={checks.filter( c => c.group === 'wordpress' )} />
      </div>

      <div className="pair">
        <SpeedTest results={speed} onResults={setSpeed} />
        <StyledPanel className="calm">
          <div className="panel-title">
            Need help?
            <span className="panel-action">
              <NekoButton className="primary" small icon={copied ? 'check' : 'copy'} onClick={copyReport}>
                {copied ? 'Copied' : 'Copy site report'}
              </NekoButton>
            </span>
          </div>
          <div className="row" title="Versions, limits and recent errors: paste it into your message and we can help right away.">
            <NekoIcon raw icon="mail" width={18} height={18} className="tone-icon neutral" />
            <span className="row-text">Copy the report, then write to us.</span>
            <a className="action" href="https://meowapps.com/contact/" target="_blank" rel="noreferrer">Contact us ↗</a>
          </div>
        </StyledPanel>
      </div>

      <AiReview status={analysisStatus} onDone={onAnalysisDone}
        facts={() => analysisFacts( checks, problems || [], rows, speed )} />

      <StyledPanel>
        <button type="button" className="fold" aria-expanded={phpOpen} onClick={() => setPhpOpen( o => !o )}>
          All PHP settings
          <NekoIcon raw icon={phpOpen ? 'chevron-up' : 'chevron-down'} width={16} height={16} />
        </button>
        {phpOpen && <div className="fold-body"><PhpInfo html={phpInfo} /></div>}
      </StyledPanel>
    </StyledHealthTab>
  );
};

export { Health };
