/* eslint-disable react/no-unescaped-entities */
// React & Vendor Libs
const { useState, useEffect, useMemo, useCallback, useRef } = wp.element;
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// NekoUI
import { NekoPage, NekoHeader, NekoWrapper, NekoTab, NekoTabs, NekoBlock, NekoButton,
  NekoColumn, NekoSettings, NekoCheckboxGroup, NekoCheckbox, NekoInput,
  NekoMessage } from '@neko-ui';
import { nekoFetch } from '@neko-ui';

import { apiUrl, restUrl, pluginUrl, restNonce } from '@app/settings';
import { NekoIcon } from '@neko-ui';
import { SpeedTester } from './SpeedTester';
import { Board } from './Board';
import { BoardHeader } from './BoardHeader';
import { StyledViewArea } from './Board.styled';
import { FAMILIES, FAMILY_OF, PLUGINS, buildNodes, getAccent, getInstallState, getFeatureIcon,
  getPartners, statusHint, freeUrl, proUrl } from './plugins';
import { StyledSettingAction, StyledIntro, StyledHealth, StyledPluginGrid, StyledPluginGroups, StyledPluginCard, StyledErrorLogs, logTone,
  StyledArticleGrid, StyledArticleCard, StyledFurtherReading, StyledSpeedTests,
  StyledPhpInfo } from './Dashboard.styled';

if (!apiUrl || !restUrl || !pluginUrl) {
  console.error("[@common/dashboard] apiUrl, restUrl and pluginUrl are mandatory.");
}

const CommonApiUrl = `${restUrl}/meow-common/v1`;

const Intro = () => {
  const [folded, setFolded] = useState( readIntroFolded );
  const toggle = () => {
    const next = !folded;
    setFolded( next );
    writeIntroFolded( next );
  };

  if ( folded ) {
    return (
      <StyledIntro className="is-folded">
        {/* Folded, not dismissed. A note from the person who wrote the plugins
            shouldn't be something you can lose by mistake — but folded away it
            should cost a line, not a sentence. The label lives in the title and
            the aria-label, so a bare "?" on screen still announces itself. */}
        <button type="button" className="intro-peek" onClick={toggle}
          title="A word from Jordy and the Meow Apps team"
          aria-label="A word from Jordy and the Meow Apps team">?</button>
      </StyledIntro>
    );
  }

  // A plain paragraph rather than NekoIntro: that renders a white card, which is
  // right above the tab bar and wrong on the blue workspace, where it landed as a
  // slab across the page. The ↗ NekoIntro adds to external links is kept in CSS.
  return (
    <StyledIntro>
      <p>
        Hi! ☀️ Meow Apps isn't your typical plugin suite. It's a passion project led by me, <a target="_blank" rel="noreferrer" href="https://jordymeow.com">Jordy Meow</a>, and a stellar team. 💕 Based in <a target="_blank" rel="noreferrer" href="https://offbeatjapan.org">Japan</a>, we focus on making your WordPress experience smoother, faster, and more enjoyable. Ready to level up your site? Check out <a href="https://meowapps.com" rel="noreferrer" target="_blank">Meow Apps</a> and let's make magic happen! 🌴🙀
      </p>
      <button type="button" className="intro-fold" onClick={toggle}
        title="Fold this away" aria-label="Fold this away">×</button>
    </StyledIntro>
  );
};

const PLUGIN_LIST = Object.keys( PLUGINS ).map( slug => ( {
  slug, family: FAMILY_OF[slug], ...PLUGINS[slug],
} ) );

// Pointing at a card fills the header strip above the grid, the same way
// pointing at a node fills it on the board. Focus counts as pointing, so the
// readout is reachable by keyboard too — the card is a link, so tabbing through
// the grid narrates it for free.
const PluginCard = ({ plugin, installState, onPoint }) => (
  <StyledPluginCard className={installState ? `is-${installState}` : 'is-dormant'}
    style={{ '--accent': getAccent( plugin.slug, plugin.family ) }}
    onMouseEnter={() => onPoint( plugin.slug )}
    onMouseLeave={() => onPoint( null )}>
    <a className="card-main" href={freeUrl(plugin.slug)} target="_blank" rel="noreferrer"
      title={plugin.desc}
      onFocus={() => onPoint( plugin.slug )} onBlur={() => onPoint( null )}>
      <span className="card-head">
        <img src={plugin.icon} alt="" />
        <span className="card-body">
          <span className="card-title">
            {plugin.name}
            {/* The dot is colour only, and a card that isn't installed has no
                dot at all — so the state is spelled out for screen readers.
                Same three words the board's cards use. */}
            <span className="sr-only">{statusHint( installState )}</span>
            {installState === 'active' && <i aria-hidden="true" className="dot on" />}
            {installState === 'inactive' && <i aria-hidden="true" className="dot off" />}
          </span>
          {/* The short role, not the full description. Clamping the marketing
              sentence to two lines cut most of them off mid-word; this always
              fits, always finishes, and reads as "Meow Gallery — shows off your
              photos". The full text is on the card as a tooltip. */}
          <span className="card-role">{plugin.role}</span>
        </span>
      </span>
      {/* Full card width, not indented past the icon. That indent cost 90px and
          was what made the four chips wrap into two, three or four rows — which
          in turn gave every card a different height. */}
      <span className="card-features">
        {plugin.features.map( f => (
          <span key={f} title={f}>
            <NekoIcon icon={getFeatureIcon( f ) || 'circle'} width={12} height={12} />
            <em>{f}</em>
          </span>
        ) )}
      </span>
    </a>
    {/* Two of these have no paid tier at all, and offering an upgrade that
        cannot be bought is worse than offering nothing. */}
    <div className="card-foot">
      <span className="card-family">{FAMILIES[plugin.family].label}</span>
      <a href={freeUrl(plugin.slug)} target="_blank" rel="noreferrer">Free</a>
      {!plugin.freeOnly && (
        <a className="pro" href={proUrl(plugin.slug)} target="_blank" rel="noreferrer">Pro</a>
      )}
    </div>
  </StyledPluginCard>
);

// The five classes the PHP log parser recognises, most severe first — that's
// the order the filter chips sit in, so what you most want to see is nearest
// the left. Any type the parser gains later still gets a chip, on the end.
const LOG_SEVERITIES = ['fatal', 'parse', 'exception', 'warning', 'notice'];

// The log viewer used to be an unlabelled dark box: no counts, no filter, and a
// permanent "your host might not allow this" paragraph underneath whether or not
// that was the problem. The caveat now appears only in the case it explains —
// loaded successfully, nothing came back.
// The PHP side only skips a repeat when it is the very next line, so one broken
// call that fires on every page load arrives as dozens of separate entries with
// different timestamps. On the site this was built against, 115 entries were 28
// actual problems, two of them repeating 22 times each — the list was mostly one
// bug wearing different clocks.
//
// Entries arrive newest first, so the first time a message is seen is its most
// recent occurrence, and every later one pushes `oldest` further back.
// Every line carries an absolute path, and the only part anyone reads is which
// plugin it came from. Pulling that out turns a wall of identical-looking paths
// into "who is generating this" — on the site this was built against one plugin
// accounted for 12 of the 28 distinct problems, which is invisible otherwise.
// It matched all 28 lines there, and returns null rather than guessing.
const logOwner = ( content ) => {
  let m = content.match( /\/(?:mu-plugins|plugins)\/([^/\s]+)/ );
  if ( m ) return m[1];
  m = content.match( /\/themes\/([^/\s]+)/ );
  if ( m ) return m[1];
  if ( /\/wp-(?:includes|admin)\//.test( content ) ) return 'WordPress';
  return null;
};

const groupRepeats = ( rows ) => {
  const byKey = new Map();
  const grouped = [];
  for ( const row of rows ) {
    const key = `${row.type}\u0000${row.content}`;
    const seen = byKey.get( key );
    if ( seen ) {
      seen.count += 1;
      seen.oldest = row.date;
      continue;
    }
    const entry = { key, type: row.type, content: row.content,
      owner: logOwner( row.content ),
      latest: row.date, oldest: row.date, count: 1 };
    byKey.set( key, entry );
    grouped.push( entry );
  }
  return grouped;
};

const AREA_ORDER = ['Speed', 'Environment', 'Errors'];

// One icon per subject, worn by the section's heading and again by the card that
// rates it. The overview at the top and the sections below it are the same three
// subjects twice; matching icons say so without a word of explanation.
const AREA_ICONS = { Speed: 'zap', Environment: 'server', Errors: 'alert-triangle' };

// Shown in place of a rating that hasn't been made yet. One line each, saying
// what that rating will be about — three copies of "run the analysis" said
// nothing three times.
const AREA_BLANKS = {
  Speed: 'How quickly your server answers.',
  Environment: 'Whether PHP gives your site enough room.',
  Errors: 'What your error log is reporting.',
};

// The handful of values a support conversation actually turns on. All of them
// are already in the dump — but the dump is 21,000px tall, so finding six things
// meant six searches. The unit lives in the label because phpinfo reports these
// raw, and a bare "1200" says nothing.
const PHP_FACTS = [
  ['memory_limit', 'Memory limit'],
  ['max_execution_time', 'Max execution (s)'],
  ['upload_max_filesize', 'Max upload'],
  ['post_max_size', 'Max post size'],
  ['max_input_vars', 'Max input vars'],
];

// The steps are all local — they read what the page already has, and running
// them costs nothing. Only the last stage spends a token, and it spends one.
const ANALYSIS_STEPS = [
  { key: 'environment', label: 'Reading your PHP configuration' },
  { key: 'speed', label: 'Timing your server' },
  { key: 'errors', label: 'Reading the error log' },
  { key: 'plugins', label: 'Checking which plugins are installed' },
  { key: 'thinking', label: 'Asking AI Engine what it makes of it', slow: true },
];

// A rating and a line for each area, whether or not there is one to show. Empty
// they still say what the analysis will tell you, which is a better invitation
// than three cards that only exist after you have already pressed the button.
const AreaCards = ( { verdict } ) => (
  <div className="analysis-areas">
    {AREA_ORDER.map( name => {
      const area = verdict ? ( verdict.areas || [] ).find( a => a.area === name ) : null;
      const rating = area ? Math.max( 1, Math.min( 5, Number( area.rating ) || 1 ) ) : 0;
      const tone = !area ? 'blank'
        : ( rating >= 4 ? 'good' : ( rating >= 3 ? 'fair' : 'poor' ) );
      return (
        <div key={name} className={`analysis-area is-${tone}`}>
          <span className="area-name">
            <NekoIcon icon={AREA_ICONS[name]} width={13} height={13} />
            {name}
          </span>
          <span className="area-dots" aria-hidden="true">
            {[1, 2, 3, 4, 5].map( n => <i key={n} className={n <= rating ? 'on' : ''} /> )}
          </span>
          <span className="area-label">{area ? area.label : 'Not rated yet'}</span>
          <span className="area-summary">{area ? area.summary : AREA_BLANKS[name]}</span>
        </div>
      );
    } )}
  </div>
);

// Six placeholders with the right labels, for hosts that disable phpinfo(). The
// shape of the answer is worth showing even when the answer isn't available.
const PHP_BLANKS = [{ label: 'PHP' }, ...PHP_FACTS.map( ( [, label] ) => ( { label } ) )];

const FactCards = ( { facts } ) => {
  const known = facts && facts.length > 0;
  return (
    <div className="php-facts">
      {( known ? facts : PHP_BLANKS ).map( fact => (
        <div key={fact.label} className={`php-fact${known ? '' : ' is-blank'}`}>
          <span className="fact-value">{known ? fact.value : '—'}</span>
          <span className="fact-label">{fact.label}</span>
        </div>
      ) )}
    </div>
  );
};

// The ratings and the PHP values are what the tab is for; everything below them
// is the working out. One surface at the top holds both, and the sections under
// it became plain accordions rather than four things each summarising itself.
const HealthOverview = ( { verdict, facts } ) => (
  <div className="health-top">
    <AreaCards verdict={verdict} />
    <FactCards facts={facts} />
  </div>
);

// A heading that is also the fold control, and carries the section's one action
// beside the caret — Start Analysis, Start Speed Test, Load Error Logs. On a row
// each of those cost a line whether or not the section was open.
//
// The heading's button carries the accessible name and state; the caret is
// decoration, and a stretched ::after on that button makes the whole row the
// target without putting a heading inside a <button>, which isn't valid markup.
const SectionHead = ( { title, icon, note, action, open, onToggle } ) => (
  <header className={`section-head${onToggle ? ' is-toggle' : ''}${open ? ' is-open' : ''}`}>
    <h3>
      {/* Decoration, not part of the heading's name — the title already says
          Speed, and a screen reader repeating it as an image helps nobody. */}
      {icon && <NekoIcon icon={icon} width={14} height={14} />}
      {onToggle
        ? <button type="button" aria-expanded={open} onClick={onToggle}>{title}</button>
        : title}
    </h3>
    <span className="head-note">{note}</span>
    {( action || onToggle ) && (
      // Above the stretched hit area, or the row would swallow the action's own
      // clicks and fold the section instead of running it.
      <span className="head-right">
        {action}
        {/* Kept in the layout even when the section can't be folded, so the
            buttons down the tab share one right edge instead of one of them
            sliding over into the missing caret's place. */}
        <i className={`head-caret${onToggle ? '' : ' is-placeholder'}`} aria-hidden="true" />
      </span>
    )}
  </header>
);

const Analysis = ( { status, busy, error, verdict, step, open = true } ) => {
  // Findings arrive folded. Four of them, each with a paragraph of explanation
  // and a paragraph of instruction, made the result a wall you had to read
  // rather than a list you could scan. The headline is the recommendation; the
  // reasoning is there when you want it.
  const [openFindings, setOpenFindings] = useState( () => new Set() );
  const toggleFinding = i => setOpenFindings( prev => {
    const next = new Set( prev );
    if ( next.has( i ) ) next.delete( i ); else next.add( i );
    return next;
  } );

  // Not installed, installed-without-a-key, and ready are three different
  // situations and only the last one has a button worth pressing.
  if ( status && !status.installed ) {
    return (
      <div className="analysis-offer">
        <NekoIcon icon="wand" width={30} height={30} />
        <div>
          <strong>Have this site looked over</strong>
          <span>
            AI Engine can read everything on this page (your PHP settings, how fast the server
            answers, what the error log says) and tell you in plain words what is worth fixing.
            {' '}It's free, and runs on your own AI provider key.
          </span>
        </div>
        <a className="analysis-cta" href={freeUrl( 'ai-engine' )} target="_blank" rel="noreferrer">
          Get AI Engine
        </a>
      </div>
    );
  }

  if ( status && !status.ready ) {
    return (
      <div className="analysis-offer">
        <NekoIcon icon="alert-triangle" width={30} height={30} />
        <div>
          <strong>AI Engine needs an API key first</strong>
          <span>
            It's installed, but no AI environment is set up yet, so there is nothing to ask.
            Add a key and this will be ready.
          </span>
        </div>
        {/* This used to say "add a key in AI Engine's settings" and then leave
            you to find them. Naming a screen without a way to reach it is a dead
            end, and this is the one state where the reader has a job to do. */}
        {/* Relative on purpose: this page is already inside /wp-admin/, so it
            resolves without needing the admin URL passed in from PHP. */}
        <a className="analysis-cta" href="admin.php?page=mwai_settings">Open AI Engine</a>
      </div>
    );
  }

  return (
    <div className="analysis-body">
      {/* Start Analysis lives in the heading, and so does what the last run found.
          What is left is the disclosure — one line, not a four-bullet list. It
          still names everything that leaves the site: settings, timings, error
          text, plugin names. But as a sentence somebody will actually read
          rather than a consent form standing between them and a button. */}
      {!busy && !verdict && !status?.consented && (
        <p className="analysis-note">
          Sends your PHP settings, test timings, recent error messages and the names of
          your Meow plugins to your AI provider. File paths are shortened first.
        </p>
      )}

      {busy && (
        <ol className="analysis-steps">
          {ANALYSIS_STEPS.map( ( s, i ) => {
            const done = i < step;
            const now = i === step;
            return (
              <li key={s.key} className={done ? 'is-done' : ( now ? 'is-now' : '' )}>
                <i />{s.label}
                {/* The first four are local and finish in a blink; the last one
                    is a round trip to a model and can sit there a while. Saying
                    so is the difference between waiting and wondering. */}
                {now && s.slow && <span className="step-note">this one takes a moment</span>}
              </li>
            );
          } )}
        </ol>
      )}

      {/* Shown even when a previous verdict is on screen: "here is your last
          result, and the run you just asked for failed" is the honest reading.
          The message comes from AI Engine, which knows what went wrong but not
          where the reader would fix it.

          Named precisely, because this is not the Default model. simpleJsonQuery
          reads its own row — ai_json_default_model — and when that row has no
          model it falls through to whatever the chosen environment is set to,
          which is how a long-retired model ends up being asked for. */}
      {error && !busy && (
        <div className="analysis-error">
          {error}
          <span>
            This uses the <b>JSON</b> row under “Default Environments for AI” in AI Engine's
            settings, not the Default one. If that row has no model set, it falls back to
            whatever the environment itself is pointing at.
          </span>
        </div>
      )}

      {/* The ratings themselves live in the overview at the top of the tab. What
          is left here is the reasoning: the conclusion, then the findings. */}
      {open && verdict && !busy && (
        <div className="analysis-verdict">
          {verdict.conclusion && (
            <p className="analysis-conclusion"><span>{verdict.conclusion}</span></p>
          )}

          {( verdict.findings || [] ).length > 0 && (
            <ul className="analysis-findings">
              {verdict.findings.map( ( f, i ) => {
                const expanded = openFindings.has( i );
                return (
                  <li key={i} className={`is-${f.severity || 'low'}${expanded ? ' is-open' : ''}`}>
                    <button type="button" className="finding-head" aria-expanded={expanded}
                      onClick={() => toggleFinding( i )}>
                      <b>{f.title}</b>
                      <em>{f.area}</em>
                      <i className="finding-chevron" aria-hidden="true" />
                    </button>
                    {expanded && (
                      <div className="finding-more">
                        <span className="finding-detail">{f.detail}</span>
                        {f.action && <span className="finding-action">{f.action}</span>}
                        {f.plugin && PLUGINS[f.plugin] && (
                          <a className="finding-plugin" href={freeUrl( f.plugin )}
                            target="_blank" rel="noreferrer">
                            <img src={PLUGINS[f.plugin].icon} alt="" />
                            {PLUGINS[f.plugin].name}
                            <i>by Meow Apps</i>
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                );
              } )}
            </ul>
          )}

          {( verdict.findings || [] ).length === 0 && (
            <p className="analysis-clean">Nothing stood out as worth fixing.</p>
          )}
        </div>
      )}
    </div>
  );
};

// One shared empty array. `entries || []` minted a fresh one on every render,
// so the memo below it saw a new dependency each time and regrouped all 115
// entries whenever anything on the tab changed — including every keystroke of
// the severity filter.
const NO_ENTRIES = [];

// The one-line answer to "is anything wrong?", for the section's heading. A
// folded section shows nothing at all now, so whatever it has to say has to fit
// on the line you can already see. The worst offender is named because that is
// the thing worth knowing before deciding to look.
const summariseLog = ( raw, loaded, failed ) => {
  if ( failed ) return 'The log could not be read.';
  if ( !loaded ) return 'What PHP is complaining about.';
  const rows = groupRepeats( raw );
  if ( !rows.length ) return 'Nothing in the log.';
  const byOwner = {};
  for ( const row of rows ) {
    if ( row.owner ) byOwner[row.owner] = ( byOwner[row.owner] || 0 ) + 1;
  }
  const worst = Object.entries( byOwner ).sort( ( a, b ) => b[1] - a[1] )[0];
  const problems = `${rows.length} distinct ${rows.length === 1 ? 'problem' : 'problems'}`;
  return `${problems} in ${raw.length} entries${worst ? ` · mostly ${worst[0]}` : ''}`;
};

const ErrorLogs = ({ entries, loaded, failed, compact = false }) => {
  const [severity, setSeverity] = useState('all');
  const raw = entries || NO_ENTRIES;
  const rows = useMemo(() => groupRepeats(raw), [raw]);

  // Counts are of distinct problems, matching the lines actually on screen. The
  // raw entry total stays visible in the meta line so nothing is quietly lost.
  const severities = useMemo(() => {
    const counts = {};
    for (const row of rows) counts[row.type] = (counts[row.type] || 0) + 1;
    const known = LOG_SEVERITIES.filter(type => counts[type]);
    const rest = Object.keys(counts).filter(type => !LOG_SEVERITIES.includes(type)).sort();
    return [...known, ...rest].map(type => ({ type, count: counts[type] }));
  }, [rows]);

  // A reload can retire the class you were filtering on. Without this you'd be
  // left staring at an empty console with a lit chip claiming otherwise.
  useEffect(() => {
    if (severity !== 'all' && !severities.some(s => s.type === severity)) {
      setSeverity('all');
    }
  }, [severities, severity]);

  const shown = severity === 'all' ? rows : rows.filter(row => row.type === severity);

  // Folded, the section is nothing at all — its heading carries the summary, so
  // the four headings stack together instead of being held apart by four lines
  // of text belonging to sections you closed.
  if (compact) return null;

  return (
    <StyledErrorLogs>
      <div className="logs-bar">
        {rows.length > 0 && (
          <div className="logs-filters" role="group" aria-label="Filter by severity">
            <button type="button" aria-pressed={severity === 'all'}
              className={severity === 'all' ? 'is-on' : ''}
              onClick={() => setSeverity('all')}>All <b>{rows.length}</b></button>
            {severities.map(({ type, count }) => (
              <button key={type} type="button" aria-pressed={severity === type}
                className={severity === type ? 'is-on' : ''}
                style={{ '--tone': logTone(type) }}
                onClick={() => setSeverity(type)}>{type} <b>{count}</b></button>
            ))}
          </div>
        )}
        {rows.length > 0 && (
          <span className="logs-meta">
            {raw.length > rows.length && `${raw.length} entries in ${rows.length} lines · `}
            Newest first
          </span>
        )}
      </div>

      <div className="logs-console">
        {shown.map(row => (
          <div className="log-row" key={row.key} style={{ '--tone': logTone(row.type) }}>
            <span className="log-head">
              <span className="log-type">{row.type}</span>
              <span className="log-date">{row.latest}</span>
              {row.owner && <span className="log-owner">{row.owner}</span>}
              {row.count > 1 && (
                <span className="log-count"
                  title={`Logged ${row.count} times, between ${row.oldest} and ${row.latest}`}>
                  ×{row.count}
                </span>
              )}
            </span>
            <span className="log-content">{row.content}</span>
          </div>
        ))}

        {/* A failed request used to land back on "not loaded yet", which is the
            same thing the tab says before you have clicked anything — so a
            broken endpoint was indistinguishable from a button you hadn't
            pressed. */}
        {shown.length === 0 && (
          <div className={`logs-blank${failed ? ' is-failed' : ''}`}>
            <NekoIcon icon={failed ? 'alert-triangle' : ( loaded ? 'check-circle' : 'terminal' )}
              width={34} height={34} />
            <strong>
              {failed ? 'Could not read the error logs'
                : ( loaded ? 'No errors found' : 'Error logs not loaded yet' )}
            </strong>
            <span>
              {failed
                ? `The request to your site did not come back. That is usually a security plugin or
                   a server rule blocking the REST API. Try again, and if it keeps failing, read the
                   log from your hosting control panel instead.`
                : ( loaded
                  ? `Nothing was written to your PHP error log, or your host doesn't allow reading
                     it remotely. If you expected entries here, check your hosting control panel.`
                  : 'Read the tail of your PHP error log to see recent warnings and fatal errors.' )}
            </span>
          </div>
        )}
      </div>
    </StyledErrorLogs>
  );
};

// What you're running, what you've got switched off, and what you haven't got.
// A group with no members is skipped entirely, so a bare site sees one heading
// and a fully-equipped one never gets told what it's missing.
const PLUGIN_GROUPS = [
  { state: 'active', key: 'active', label: 'Running',
    note: 'Installed and active on this site.' },
  { state: 'inactive', key: 'inactive', label: 'Installed, not active',
    note: 'Switch these on from your Plugins screen to put them to work.' },
  { state: null, key: 'none', label: 'Not installed',
    note: 'Every one of these has a free version on WordPress.org.' },
];

// phpinfo() prints 665 rows across 59 extension sections. Finding one directive
// in that meant browser-find; the tab now filters as you type and says what is
// left. Rows are hidden in the DOM rather than re-rendered: the markup arrives
// as a raw HTML string and React never reconciles it after mount.
// Everything the analysis looks at is gathered here, in the browser, from what
// the page already knows. The only thing PHP does is make the AI call, because
// $mwai is a PHP global.
//
// Paths are cut back to the plugin-relative part before they leave the site:
// the analysis needs to know an error came from meow-gallery-pro/core.php, and
// has no use at all for /home/somebody/public_html in front of it.
const shortenPaths = ( text ) => text
  .replace( /\/[^\s'"]*?\/(?:mu-plugins|plugins|themes)\/([^\s'"]+)/g, '$1' )
  .replace( /\/[^\s'"]*?\/(wp-includes|wp-admin)\/([^\s'"]+)/g, '$1/$2' );

const collectFacts = ( { phpFacts, speed, logRows, logRaw, states } ) => {
  const installed = Object.entries( states || {} )
    .filter( ( [, state] ) => state )
    .map( ( [slug, state] ) => `${slug} (${state})` );

  return {
    php: phpFacts.reduce( ( out, fact ) => {
      out[fact.label] = fact.value;
      return out;
    }, {} ),
    speed: Object.values( speed || {} )
      .filter( result => result && result.samples )
      .map( result => ( {
        test: result.title, averageMs: result.avg, samples: result.samples, verdict: result.verdict,
      } ) ),
    errors: {
      distinctProblems: logRows.length,
      totalEntries: logRaw.length,
      // Twelve is enough for the model to see the shape of the log without
      // posting the whole thing, and they are ordered worst-first already.
      top: logRows.slice( 0, 12 ).map( row => ( {
        type: row.type, from: row.owner, times: row.count,
        message: shortenPaths( row.content ).slice( 0, 220 ),
      } ) ),
    },
    meowPluginsInstalled: installed,
  };
};

const PhpInfo = ({ html, compact = false, onSummary }) => {
  const [query, setQuery] = useState('');
  const hostRef = useRef(null);
  const [counts, setCounts] = useState({ shown: 0, total: 0, sections: 0 });
  const [facts, setFacts] = useState([]);
  const [size, setSize] = useState({ rows: 0, sections: 0 });

  // Read once per document, not per keystroke: hidden rows keep their text, so
  // the summary stays whole no matter what the filter is doing below it.
  useEffect(() => {
    const root = hostRef.current;
    if (!root) { setFacts([]); return; }
    const rows = [...root.querySelectorAll('tr')];
    const valueOf = key => {
      const row = rows.find(r => {
        const name = r.querySelector('td.e');
        return name && name.textContent.trim().toLowerCase() === key;
      });
      // Three-column rows are Directive / Local / Master; the local value is the
      // one actually in force, and it comes first.
      return row ? ( row.querySelector('td.v')?.textContent.trim() || null ) : null;
    };
    const version = ( root.querySelector('h1')?.textContent || '' )
      .replace(/^\s*PHP Version\s*/i, '').trim();
    const found = version ? [{ label: 'PHP', value: version }] : [];
    for (const [key, label] of PHP_FACTS) {
      const value = valueOf(key);
      if (value) found.push({ label, value });
    }
    setFacts(found);

    // Counted here rather than taken from the filter effect below, whose totals
    // move as you type. The heading wants the size of the dump, not the size of
    // your last search.
    const bodyRows = rows.filter(r => !r.querySelector('th')).length;
    setSize({ rows: bodyRows, sections: root.querySelectorAll('h2').length });
  }, [html]);

  // The six values are shown in the overview at the top of the tab now, and the
  // size in the section's heading — but both can only be read from a mounted
  // phpinfo table, so this stays the place that finds them and hands them up.
  useEffect(() => {
    if (onSummary) onSummary({ facts, ...size });
  }, [onSummary, facts, size]);

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    const needle = query.trim().toLowerCase();
    let total = 0;
    let shown = 0;

    root.querySelectorAll('table').forEach(table => {
      let visible = 0;
      table.querySelectorAll('tr').forEach(row => {
        // The "Directive / Local / Master" header belongs to its table, not to
        // the results — counting it would inflate every total by 33.
        if (row.querySelector('th')) return;
        total += 1;
        const hit = !needle || row.textContent.toLowerCase().includes(needle);
        row.style.display = hit ? '' : 'none';
        if (hit) visible += 1;
      });
      shown += visible;
      table.style.display = ( needle !== '' && visible === 0 ) ? 'none' : '';
    });

    // A heading owns every table up to the next heading — several sections have
    // two, a summary followed by the directives. Pairing each heading with only
    // the table right after it dropped the title whenever the match was in the
    // second one, leaving a bare "Directive / Local / Master" row over nothing.
    const headings = [...root.querySelectorAll('h2')];
    headings.forEach(heading => {
      let node = heading.nextElementSibling;
      let alive = false;
      while (node && node.tagName !== 'H2') {
        if (node.tagName === 'TABLE' && node.style.display !== 'none') alive = true;
        node = node.nextElementSibling;
      }
      heading.style.display = ( needle !== '' && !alive ) ? 'none' : '';
    });

    // Sections are the 59 <h2> extension headings, not the 95 tables.
    const sections = headings.filter(heading => heading.style.display !== 'none').length;

    setCounts({ shown, total, sections });
  }, [query, html]);

  // Plenty of managed hosts list phpinfo in disable_functions, and the PHP side
  // returns nothing at all when it does. That left a search box sitting over an
  // empty black box reading "0 rows across 0 sections" — which looks like the
  // plugin is broken rather than like the host said no.
  const hasInfo = typeof html === 'string' && html.trim() !== '';

  if ( !hasInfo ) {
    return (
      <StyledPhpInfo>
        <div className="php-body">
          <div className="php-blank is-empty">
            <NekoIcon icon="alert-triangle" width={34} height={34} />
            <strong>PHP info isn&apos;t available here</strong>
            <span>
              Your host has most likely disabled PHP&apos;s <code>phpinfo()</code> function.
              Your hosting control panel will show the same details.
            </span>
          </div>
        </div>
      </StyledPhpInfo>
    );
  }

  return (
    <StyledPhpInfo>
      {/* Collapsed, the whole dump is hidden — but it stays mounted, because the
          filter effect needs its host element and the six values in the overview
          are read out of these very rows. */}
      <div className={compact ? 'php-rest is-hidden' : 'php-rest'}>
        <div className="php-bar">
          <NekoInput className="php-search" value={query} onChange={setQuery}
            placeholder="Search directives, extensions, values…" />
          {/* While searching this counts rows only. Naming sections too read as
            "1 of 632 rows in 0 sections" whenever the hit was in the main
            configuration table, which sits under the h1 and belongs to none. */}
          <span className="php-count">
            {query.trim()
              ? `${counts.shown} matching ${counts.shown === 1 ? 'row' : 'rows'}`
              : `${counts.total} rows across ${counts.sections} sections`}
          </span>
        </div>
        <div className="php-body" ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />
        {query.trim() !== '' && counts.shown === 0 && (
          <div className="php-blank">Nothing matches “{query.trim()}”.</div>
        )}
      </div>
    </StyledPhpInfo>
  );
};

// The board is the star of the page, but a plain grid stays one click away for
// anyone who just wants a list. The choice is remembered locally.
const VIEW_KEY = 'meow_dashboard_view';

// The welcome sits above every tab, and it is 140px of a page whose first
// plugin card already starts 493px down an 866px screen. Read once it is a
// friendly hello; read on every visit, every tab, forever, it is furniture in
// front of the thing you came for. Folding it leaves the greeting for people
// who have not met it and gives the regulars their screen back.
//
// localStorage rather than an option, matching the view toggle above: this is a
// per-person preference, not something the site should decide for everybody.
const INTRO_KEY = 'meow_dashboard_intro';

const readIntroFolded = () => {
  try {
    return window.localStorage.getItem( INTRO_KEY ) === 'folded';
  }
  catch ( e ) {
    return false;
  }
};

const writeIntroFolded = ( folded ) => {
  try {
    window.localStorage.setItem( INTRO_KEY, folded ? 'folded' : 'open' );
  }
  catch ( e ) { /* private browsing, or storage full — it just won't persist */ }
};

const readView = () => {
  try {
    return window.localStorage.getItem( VIEW_KEY ) === 'grid' ? 'grid' : 'board';
  }
  catch ( e ) {
    return 'board';
  }
};

const writeView = ( view ) => {
  try {
    window.localStorage.setItem( VIEW_KEY, view );
  }
  catch ( e ) { /* private mode, never mind */ }
};

// What each test does now sits on its own card rather than in one paragraph
// describing all three, which you had to re-read to work out which gauge it was
// talking about.
const SPEED_TESTS = [
  { request: 'empty_request', title: 'Empty Request Time', short: 'Request', max: 2500, good: 500, ok: 2000,
    hint: 'How long your server takes to answer a request that does nothing. The baseline everything else sits on top of.' },
  { request: 'file_operation', title: 'File Operation Time', short: 'Disk', max: 2600, good: 600, ok: 2000,
    hint: 'Writes and removes a temporary 10 MB file, so it reflects how quick your disk is.' },
  { request: 'sql_request', title: 'SQL Request Time', short: 'Database', max: 2800, good: 500, ok: 2000,
    hint: 'Counts every post in your database. Should land close to the empty request time.' },
];

const ARTICLES = [
  { emoji: '🔍', title: 'SEO Checklist & Optimization',
    blurb: 'Make your content findable on Google and AI assistants.',
    href: 'https://meowapps.com/tutorial-improve-seo-wordpress/' },
  { emoji: '⚡️', title: 'Optimize Your WordPress Speed',
    blurb: 'Practical tips to make WordPress fast.',
    href: 'https://meowapps.com/tutorial-faster-wordpress-optimize/' },
  { emoji: '🖼️', title: 'Optimize Images (CDN & More)',
    blurb: 'Lighter images, faster pages, happier visitors.',
    href: 'https://meowapps.com/tutorial-optimize-images-wordpress/' },
  { emoji: '🏠', title: 'The Best Hosting Services',
    blurb: 'Pick a host that won\'t hold your site back.',
    href: 'https://meowapps.com/tutorial-hosting-service-wordpress/' },
];

// Was a three-sentence paragraph of general advice — keep a lean setup, pick a
// good host, don't self-host — sitting between the gauges and four links it
// never referred to. A heading and one line tying it to the numbers above does
// the same job in a quarter of the space.
const jsxTextRecommendations =
  <StyledFurtherReading>
    <StyledArticleGrid>
      {ARTICLES.map(article => (
        <StyledArticleCard key={article.href} href={article.href} target="_blank" rel="noreferrer">
          <span className="article-emoji">{article.emoji}</span>
          <span className="article-body">
            <span className="article-title">{article.title}</span>
            <span className="article-blurb">{article.blurb}</span>
          </span>
          <span className="article-arrow">→</span>
        </StyledArticleCard>
      ))}
    </StyledArticleGrid>
  </StyledFurtherReading>;

const fetchSettings = async () => {
  const response = await nekoFetch(`${CommonApiUrl}/all_settings/`, {
    method: 'POST',
    nonce: restNonce,
  });
  return response.data;
};

const updateOption = async ({ value, id }) => {
  const response = await nekoFetch(`${CommonApiUrl}/update_option`, {
    method: 'POST',
    nonce: restNonce,
    json: { name: id, value },
  });
  return response;
};

const fetchInstalledPlugins = async () => {
  const response = await nekoFetch(`${CommonApiUrl}/installed_plugins/`, {
    method: 'POST',
    nonce: restNonce,
  });
  return response.data || {};
};

const fetchErrorLogs = async () => {
  const response = await nekoFetch(`${CommonApiUrl}/error_logs`, {
    method: 'POST',
    nonce: restNonce,
  });
  return response.data.reverse();
};

const Dashboard = () => {
  const queryClient = useQueryClient();
  const [fatalError, setFatalError] = useState(false);
  const [phpInfo, setPhpInfo] = useState("");
  const [view, setView] = useState(readView);
  const [pointed, setPointed] = useState(null);
  // Bumped by "Start Speed Test"; the three cards start when it changes.
  const [runAll, setRunAll] = useState(0);

  const { data: settings, error: queryError } = useQuery({
    queryKey: ['all_settings'],
    queryFn: fetchSettings
  });

  const { data: installedPlugins } = useQuery({
    queryKey: ['installed_plugins'],
    queryFn: fetchInstalledPlugins,
    staleTime: 60 * 1000,
  });

  const updateOptionMutation = useMutation({
    mutationFn: updateOption,
    onSuccess: () => {
      queryClient.invalidateQueries(['all_settings']);
    }
  });

  const errorLogsMutation = useMutation({
    mutationFn: fetchErrorLogs
  });

  const hide_meowapps = settings?.meowapps_hide_meowapps;
  const force_sslverify = settings?.force_sslverify;

  useEffect(() => {
    if (queryError && !fatalError) {
      setFatalError(true);
      console.error('Error from useQuery', queryError.message);
    }
  }, [queryError]);

  useEffect(() => {
    const info = document.getElementById('meow-common-phpinfo');
    if (info) {
      setPhpInfo(info.innerHTML);
    }
  }, []);


  const handleView = (next) => {
    setView(next);
    writeView(next);
    // Otherwise the strip keeps showing whichever card the pointer happened to
    // be over when the toggle was clicked, on a view that no longer has it.
    setPointed(null);
  };

  // The grid's readout. Nodes are the board's own descriptions, so a plugin
  // reads identically whichever view you found it in; only plugins exist in the
  // grid, so there are no core modules or world actors to look up here.
  const nodes = useMemo(buildNodes, []);

  const states = useMemo(() => {
    const map = {};
    for (const slug of Object.keys(PLUGINS)) {
      map[slug] = getInstallState(slug, installedPlugins);
    }
    return map;
  }, [installedPlugins]);

  const readout = useMemo(() => {
    const node = pointed ? nodes[pointed] : null;
    if (!node) return { node: null, partners: [] };
    return { node, partners: getPartners(node.id).map(id => nodes[id]).filter(Boolean) };
  }, [pointed, nodes]);

  const handlePoint = useCallback(slug => setPointed(slug), []);

  // Health opens folded. Speed's results are held here rather than inside each
  // card so the folded summary can show them, and so the analysis can use the
  // same numbers instead of running the tests a second time.
  const [open, setOpen] = useState({
    analysis: false, speed: false, environment: false, errors: false, reading: false,
  });
  const toggleSection = key => setOpen(o => ({ ...o, [key]: !o[key] }));
  const [speedResults, setSpeedResults] = useState({});
  // Read out of the phpinfo table by PhpInfo, shown in the overview above it,
  // and sent with the analysis. One source, three readers.
  const [phpSummary, setPhpSummary] = useState({ facts: [], rows: 0, sections: 0 });
  const phpFacts = phpSummary.facts;
  // The analysis waits for the tests inside an async loop, and a closure over
  // state would keep reading the value it captured when the run began.
  const speedResultsRef = useRef({});
  useEffect(() => { speedResultsRef.current = speedResults; }, [speedResults]);

  const { data: analysisStatus, refetch: refetchAnalysis } = useQuery({
    queryKey: ['analysis_status'],
    queryFn: () => nekoFetch(`${CommonApiUrl}/analysis_status/`, { method: 'POST', nonce: restNonce })
      .then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisError, setAnalysisError] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  // The remembered run, until this session produces a fresher one.
  const shownVerdict = verdict || analysisStatus?.last || null;
  const handleSpeedResult = useCallback((request, result) => {
    setSpeedResults(prev => {
      const before = prev[request];
      // The card reports on every sample; only re-render when something changed.
      if (before && before.avg === result.avg && before.samples === result.samples
        && before.verdict === result.verdict && before.failed === result.failed
        && before.running === result.running) return prev;
      return { ...prev, [request]: result };
    });
  }, []);

  // Until the install list lands, nothing on this page is entitled to say what
  // you have. getInstallState reads a missing list as "not installed", so the
  // grid opened on "Not installed 13" and the header on "0 of 13" before
  // flipping to the truth a moment later.
  const pluginsKnown = !!installedPlugins;

  const pluginGroups = useMemo(() => {
    if (!pluginsKnown) {
      return [{
        key: 'unknown', label: 'Your Meow plugins', note: 'Checking which ones are installed…',
        items: [...PLUGIN_LIST]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(plugin => ({ plugin, state: 'unknown' })),
      }];
    }
    const withState = PLUGIN_LIST.map(plugin => ({
      plugin, state: getInstallState(plugin.slug, installedPlugins) || null,
    }));
    return PLUGIN_GROUPS
      .map(group => ({
        ...group,
        items: withState
          .filter(entry => entry.state === group.state)
          .sort((a, b) => a.plugin.name.localeCompare(b.plugin.name)),
      }))
      .filter(group => group.items.length > 0);
  }, [installedPlugins, pluginsKnown]);

  // Steps 1-4 are local and quick; the wait is entirely step 5. They are still
  // shown one at a time because "it is doing four things then asking" is a truer
  // account of the wait than a single spinner.
  const runAnalysis = useCallback(async () => {
    setAnalysing(true);
    setAnalysisError(null);
    setAnalysisStep(0);
    const pause = ms => new Promise(r => setTimeout(r, ms));

    try {
      // Environment. Read from state rather than scraped back out of the cards
      // it is rendered into — the cards moved to the overview once, and a
      // querySelector for .fact-label would have quietly followed them.
      setAnalysisStep(1);
      await pause(280);

      // Speed: run the tests if they have not been run, then wait for them.
      if (!Object.values(speedResults).some(r => r?.samples)) {
        setRunAll(n => n + 1);
        for (let i = 0; i < 40; i++) {
          await pause(500);
          const all = Object.values(speedResultsRef.current);
          if (all.length === SPEED_TESTS.length && all.every(r => !r.running)) break;
        }
      }
      setAnalysisStep(2);
      await pause(280);

      // Errors: load them if they are not loaded yet.
      let entries = errorLogsMutation.data;
      if (!entries) {
        try { entries = await errorLogsMutation.mutateAsync(); }
        catch (e) { entries = []; }
      }
      const logRows = groupRepeats(entries || []);
      setAnalysisStep(3);
      await pause(280);

      setAnalysisStep(4);
      await pause(200);

      const facts = collectFacts({
        phpFacts, speed: speedResultsRef.current, logRows, logRaw: entries || [], states,
      });

      const reply = await nekoFetch(`${CommonApiUrl}/analysis_run/`, {
        method: 'POST', nonce: restNonce, json: { facts },
      });

      if (!reply.success) {
        setAnalysisError(reply.message || 'The analysis could not be completed.');
      }
      else {
        setVerdict(reply.data);
        // A run you just asked for opens itself. Folded is the resting state for
        // a result you have already read, not for one that just arrived.
        setOpen(o => ({ ...o, analysis: true }));
        refetchAnalysis();
      }
    }
    catch (e) {
      setAnalysisError(e?.message || 'The analysis could not be completed.');
    }
    finally {
      setAnalysing(false);
    }
  }, [speedResults, phpFacts, errorLogsMutation, states, refetchAnalysis]);

  // Each section's heading says what the section holds, because folded that is
  // all there is. Before there is anything to report, the static description
  // stands in — "Your server, timed." until it has been.
  const speedNote = useMemo(() => {
    const measured = SPEED_TESTS.some(test => {
      const r = speedResults[test.request];
      return r && ( r.samples || r.running || r.failed );
    });
    if (!measured) return 'Your server, timed.';
    return (
      <span className="speed-summary">
        {SPEED_TESTS.map(test => {
          const r = speedResults[test.request];
          return (
            <em key={test.request} className={r?.verdict ? `is-${r.verdict}` : ''}>
              {test.short}
              <b>{r?.failed ? 'failed' : ( r?.running ? '…'
                : ( r?.samples ? `${r.avg} ms` : '—' ) )}</b>
            </em>
          );
        })}
      </span>
    );
  }, [speedResults]);

  const environmentNote = phpSummary.rows
    ? `${phpSummary.rows} values across ${phpSummary.sections} sections.`
    : 'Every value PHP reports.';

  const errorsNote = useMemo(
    () => summariseLog(errorLogsMutation.data || NO_ENTRIES,
      errorLogsMutation.isSuccess, errorLogsMutation.isError),
    [errorLogsMutation.data, errorLogsMutation.isSuccess, errorLogsMutation.isError]);

  const analysisNote = useMemo(() => {
    if (!shownVerdict) return 'Read together, and explained.';
    const found = ( shownVerdict.findings || [] ).length;
    const what = found === 0 ? 'Nothing worth fixing'
      : `${found} ${found === 1 ? 'thing' : 'things'} worth looking at`;
    return shownVerdict.ranAt ? `${what} · Last run ${shownVerdict.ranAt}` : what;
  }, [shownVerdict]);

  const [forgetting, setForgetting] = useState(false);
  const forgetAnalysis = useCallback(async () => {
    setForgetting(true);
    try {
      await nekoFetch(`${CommonApiUrl}/analysis_forget/`, { method: 'POST', nonce: restNonce });
      // Clear what this session is holding too, or the verdict stays on screen
      // after the copy it came from has been deleted.
      setVerdict(null);
      setAnalysisError(null);
      await refetchAnalysis();
    }
    finally {
      setForgetting(false);
    }
  }, [refetchAnalysis]);

  const handleUpdateOption = (value, id) => {
    updateOptionMutation.mutate({ value, id });
  };

  const handleLoadErrorLogs = () => {
    errorLogsMutation.mutate();
  };

  // Both options are discouraged, so both tick in the danger colour. They used
  // to render green and bold — NekoCheckbox's default for a checked box — which
  // read as approval on a setting whose own label says "Not Recommended".
  //
  // NekoCheckbox declares `description` as a string. It was being handed a
  // <NekoTypo> element, which a development build of React flags — and which
  // nested a <p> inside the description container either way.
  const jsxHideMeowApps =
    <NekoSettings title="Main Menu">
      <NekoCheckboxGroup max="1">
        <NekoCheckbox name="meowapps_hide_meowapps" variant="danger"
          label="Hide the Meow Apps menu (not recommended)"
          description={'Removes the Meow Apps menu on the left, and every plugin screen inside it. '
            + 'To bring it back, tick "Show Meow Apps Menu" in Settings → General.'}
          value="1" disabled={updateOptionMutation.isPending}
          checked={hide_meowapps} onChange={handleUpdateOption} />
      </NekoCheckboxGroup>
    </NekoSettings>;

  const jsxForceSSLVerify =
    <NekoSettings title="SSL Verify">
      <NekoCheckboxGroup max="1">
        <NekoCheckbox name="force_sslverify" variant="danger"
          label="Force SSL verification (not recommended)"
          description={'Requires a valid SSL certificate when checking a licence or fetching an update. '
            + 'Hosts with an out-of-date certificate bundle will fail both, which is why it is off by default.'}
          value="1" disabled={updateOptionMutation.isPending}
          checked={force_sslverify} onChange={handleUpdateOption} />
      </NekoCheckboxGroup>
    </NekoSettings>;

  return (
    <NekoPage showRestError={fatalError}>
      <NekoHeader title='The Dashboard' />
      <NekoWrapper>
        <NekoColumn full>
          <NekoTabs keepTabOnReload={true}>
            <NekoTab title='Meow Apps'>
              <StyledViewArea className={view === 'grid' ? 'is-grid' : ''}>
                {view === 'grid' && (
                  <BoardHeader installedPlugins={installedPlugins} ready={pluginsKnown}
                    node={readout.node} partners={readout.partners} states={states}
                    view={view} onView={handleView} />
                )}
                {view === 'board' && (
                  <Board installedPlugins={installedPlugins} view={view} onView={handleView} />
                )}
                {view === 'grid' && (
                  <StyledPluginGroups>
                    {pluginGroups.map(group => (
                      <section key={group.key} className={`plugin-group is-${group.key}`}>
                        <header className="group-head">
                          <h3>{group.label}<b>{group.items.length}</b></h3>
                          <span className="head-note">{group.note}</span>
                        </header>
                        <StyledPluginGrid>
                          {group.items.map(({ plugin, state }) => (
                            <PluginCard key={plugin.slug} plugin={plugin} installState={state}
                              onPoint={handlePoint} />
                          ))}
                        </StyledPluginGrid>
                      </section>
                    ))}
                  </StyledPluginGroups>
                )}
              </StyledViewArea>
              {/* Signed at the foot of the board rather than standing in front of
                  it. Above the tab bar it followed you onto Health and Settings
                  and cost 108px everywhere; at the top of this tab it was a white
                  slab across the workspace. Here it reads as a colophon — the
                  people behind the thing you have just been looking at. */}
              <Intro />
            </NekoTab>
            {/* Performance, PHP Info and PHP Error Logs were three sibling tabs
                asking one question between them — how is this server doing? —
                while the top level gave each the same weight as the plugin
                board. One tab, three sections: what you have, how your site is,
                what you've set. Each section keeps its own scroll box, so the
                21,000px phpinfo dump stays contained rather than making the
                page enormous. */}
            {/* The answers sit at the top — three ratings and six PHP values, in
                one surface, whether or not there is anything in them yet. Under
                them the working out, folded: three gauges, 632 rows of phpinfo
                and 28 log lines is a lot of answers to questions nobody asked.
                Every section carries a caret, so what is foldable looks foldable
                without four buttons spelling it out. Further reading sits at the
                very end, where "want to dig deeper" belongs. */}
            <NekoTab title="Health">
              <StyledHealth>
                <HealthOverview verdict={shownVerdict} facts={phpFacts} />

                <section className={`health-section is-analysis${open.analysis ? ' is-open' : ''}`}>
                  {/* Nothing to fold until there is a result: before that the
                      section is a sentence and a button. And no button at all
                      until AI Engine can answer — the offer takes its place. */}
                  <SectionHead title="Analysis" icon="wand" note={analysisNote}
                    open={open.analysis}
                    onToggle={shownVerdict && !analysing
                      ? () => toggleSection('analysis') : null}
                    action={!analysing && ( !analysisStatus || analysisStatus.ready ) && (
                      <NekoButton className="primary" onClick={runAnalysis}>Start Analysis</NekoButton>
                    )} />
                  <Analysis status={analysisStatus} busy={analysing} error={analysisError}
                    verdict={shownVerdict} step={analysisStep} open={open.analysis} />
                </section>

                <section className={`health-section${open.speed ? ' is-open' : ''}`}>
                  <SectionHead title="Speed" icon={AREA_ICONS.Speed} note={speedNote}
                    open={open.speed} onToggle={() => toggleSection('speed')}
                    action={(
                      <NekoButton className="primary" onClick={() => setRunAll(n => n + 1)}>
                        Start Speed Test
                      </NekoButton>
                    )} />

                  {/* Mounted whether or not the section is open. Unmounting them
                      meant "Start Speed Test" had nothing to run while folded, and
                      folding a finished run threw the numbers away. Hidden, they
                      keep answering — which is what fills the heading. */}
                  <StyledSpeedTests className={open.speed ? '' : 'is-hidden'}>
                    {SPEED_TESTS.map(test => (
                      <SpeedTester key={test.request} {...test} startSignal={runAll}
                        onResult={handleSpeedResult} />
                    ))}
                  </StyledSpeedTests>
                </section>

                <section className={`health-section${open.environment ? ' is-open' : ''}`}>
                  <SectionHead title="Environment" icon={AREA_ICONS.Environment} note={environmentNote}
                    open={open.environment} onToggle={() => toggleSection('environment')} />
                  <PhpInfo html={phpInfo} compact={!open.environment} onSummary={setPhpSummary} />
                </section>

                {/* One label, not three. Loaded / failed / never-pressed is what
                    the heading's note is for; the button only ever does the one
                    thing, so it only ever says the one thing. */}
                <section className={`health-section${open.errors ? ' is-open' : ''}`}>
                  <SectionHead title="Errors" icon={AREA_ICONS.Errors} note={errorsNote}
                    open={open.errors} onToggle={() => toggleSection('errors')}
                    action={(
                      <NekoButton className="primary" onClick={handleLoadErrorLogs}
                        disabled={errorLogsMutation.isPending} isBusy={errorLogsMutation.isPending}>
                        Load Error Logs
                      </NekoButton>
                    )} />
                  <ErrorLogs entries={errorLogsMutation.data}
                    loaded={errorLogsMutation.isSuccess} failed={errorLogsMutation.isError}
                    compact={!open.errors} />
                </section>

                <section className={`health-section${open.reading ? ' is-open' : ''}`}>
                  <SectionHead title="Further reading" icon="book"
                    note="Usually it comes down to your host, or how much you ask of it."
                    open={open.reading} onToggle={() => toggleSection('reading')} />
                  {open.reading && jsxTextRecommendations}
                </section>
              </StyledHealth>
            </NekoTab>
            <NekoTab title="Settings">
              {/* The block used to be called "Settings" inside a tab called
                  Settings, on a page reached from a Settings menu. Naming what
                  they actually are also makes room to say the thing that was
                  missing: they are not this plugin's settings. */}
              <NekoBlock title="Shared Preferences" className="primary"
                subtitle="Settings every Meow Apps plugin on this site shares, and the data the dashboard keeps about it.">
                {/* Says the part the description below doesn't: what being
                    hidden actually costs you right now. Repeating the recovery
                    steps here as well just said the same sentence twice. */}
                {hide_meowapps && (
                  <NekoMessage variant="warning">
                    The Meow Apps menu is hidden right now, so every plugin screen behind it
                    is only reachable by direct link.
                  </NekoMessage>
                )}
                {/* The analysis keeps its verdict so it survives a reload. That
                    also means a description of this site's weaknesses, written
                    by a third-party model, sits in the options table until
                    somebody removes it — so somebody has to be able to. */}
                {( analysisStatus?.last || analysisStatus?.consented ) && (
                  <NekoSettings title="Site analysis">
                    <StyledSettingAction>
                      <NekoButton className="danger" onClick={forgetAnalysis}
                        disabled={forgetting} isBusy={forgetting}>
                        Forget the stored analysis
                      </NekoButton>
                      <span className="action-note">
                        Removes the saved result and this site's agreement to send data for it.
                        {analysisStatus?.last?.ranAt && ` Last run ${analysisStatus.last.ranAt}.`}
                      </span>
                    </StyledSettingAction>
                  </NekoSettings>
                )}
                {jsxHideMeowApps}
                {jsxForceSSLVerify}
              </NekoBlock>
            </NekoTab>
          </NekoTabs>
        </NekoColumn>
      </NekoWrapper>
    </NekoPage>
  );
};

export { Dashboard };
