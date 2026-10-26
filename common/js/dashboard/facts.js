// What the Health tab says about the server, in plain words, and the report people paste into a
// support email. Everything comes from the page itself (#meow-common-site, the error log).
import { PLUGINS } from './plugins';

const readSite = () => {
  try {
    const el = document.getElementById( 'meow-common-site' );
    return el ? JSON.parse( el.textContent ) || {} : {};
  }
  catch ( e ) {
    return {};
  }
};

// "256M" → bytes; -1 or 0 means no limit (Infinity).
const toBytes = ( value ) => {
  const text = String( value ?? '' ).trim();
  if ( text === '' ) return null;
  if ( text === '-1' || text === '0' ) return Infinity;
  const m = text.match( /^(\d+(?:\.\d+)?)\s*([kmg]?)/i );
  if ( !m ) return null;
  const unit = { k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[m[2].toLowerCase()] || 1;
  return parseFloat( m[1] ) * unit;
};

const MB = 1024 ** 2;
const phpMinor = ( version ) => {
  const [major, minor] = String( version || '' ).split( '.' ).map( Number );
  return major ? major + ( minor || 0 ) / 10 : null;
};

// The few words a problem keeps on screen; the full explanation is the check's note (tooltip).
const PROBLEM_WORDS = {
  php: 'ask your host for 8.3', memory: 'low', time: 'short', upload: 'small', vars: 'low',
  https: 'not secure', cron: 'not running', debug: 'shown to visitors',
};

// One line per fact, in two groups (Server, WordPress): what it is, its value, a verdict and why.
// Thresholds are deliberately generous: this is for site owners, and a warning has to mean something.
const siteChecks = ( site ) => {
  const checks = [];
  // Every Meow plugin on the site still runs an older copy of this library: nothing to say yet.
  if ( !site || !site.php ) {
    return checks;
  }
  const add = ( group, key, label, value, tone, note = '' ) => checks.push( { group, key, label, value, tone, note } );

  const php = phpMinor( site.php );
  if ( php ) {
    if ( php >= 8.2 ) add( 'server', 'php', 'PHP', site.php, 'good', 'Up to date.' );
    else if ( php >= 8.0 ) add( 'server', 'php', 'PHP', site.php, 'warning', 'Getting old: ask your host for PHP 8.3.' );
    else add( 'server', 'php', 'PHP', site.php, 'bad', 'Outdated and slower: ask your host for PHP 8.3.' );
  }
  const memory = toBytes( site.memory_limit );
  if ( memory !== null ) {
    if ( memory >= 256 * MB ) add( 'server', 'memory', 'Memory', site.memory_limit, 'good', 'Plenty, even for heavy plugins.' );
    else if ( memory >= 128 * MB ) add( 'server', 'memory', 'Memory', site.memory_limit, 'good', 'Enough for most sites.' );
    else add( 'server', 'memory', 'Memory', site.memory_limit, 'warning', 'Low: big imports or image work may fail. 256M is comfortable.' );
  }
  if ( site.max_execution_time !== undefined && site.max_execution_time !== '' ) {
    const time = Number( site.max_execution_time );
    if ( time === 0 || time >= 60 ) add( 'server', 'time', 'Time limit', time === 0 ? 'none' : `${time} s`, 'good', 'Long tasks have room to finish.' );
    else if ( time >= 30 ) add( 'server', 'time', 'Time limit', `${time} s`, 'good', 'Fine: bulk tasks work in small batches.' );
    else add( 'server', 'time', 'Time limit', `${time} s`, 'warning', 'Short: long tasks may stop halfway.' );
  }
  const upload = toBytes( site.upload_max_filesize );
  if ( upload !== null ) {
    const post = toBytes( site.post_max_size );
    const limit = post !== null ? Math.min( upload, post ) : upload;
    const value = `up to ${site.upload_max_filesize}`;
    if ( limit >= 64 * MB ) add( 'server', 'upload', 'Uploads', value, 'good', 'Large photos and short videos are fine.' );
    else if ( limit >= 8 * MB ) add( 'server', 'upload', 'Uploads', value, 'good', 'Fine for images.' );
    else add( 'server', 'upload', 'Uploads', value, 'warning', 'Small: large images may fail to upload.' );
  }
  const vars = Number( site.max_input_vars );
  if ( vars ) {
    add( 'server', 'vars', 'Form fields', vars.toLocaleString(), vars >= 1000 ? 'good' : 'warning',
      vars >= 1000 ? 'Big menus and settings pages save fine.' : 'Low: very big menus may not save completely.' );
  }
  if ( site.database ) add( 'server', 'database', 'Database', site.database, 'neutral' );
  if ( site.server ) add( 'server', 'webserver', 'Web server', site.server, 'neutral' );

  if ( site.wordpress ) add( 'wordpress', 'wordpress', 'WordPress', site.wordpress, 'neutral', site.multisite ? 'Multisite network.' : '' );
  if ( site.theme ) add( 'wordpress', 'theme', 'Theme', site.theme, 'neutral' );
  if ( site.plugins ) add( 'wordpress', 'plugins', 'Plugins', `${site.plugins.length} active`, 'neutral' );
  if ( site.https ) add( 'wordpress', 'https', 'HTTPS', 'on', 'good', 'Visitors are on a secure connection.' );
  else add( 'wordpress', 'https', 'HTTPS', 'off', 'warning', 'Browsers flag the site as not secure.' );
  const late = Number( site.cron_overdue ) || 0;
  if ( late < 60 ) add( 'wordpress', 'cron', 'Scheduled tasks', 'on time', 'good', site.cron_disabled ? 'Run by a server cron.' : 'Backups, emails and cleanups run as planned.' );
  else add( 'wordpress', 'cron', 'Scheduled tasks', `late by ${late >= 1440 ? `${Math.round( late / 1440 )} d` : `${Math.round( late / 60 )} h`}`,
    'warning', 'Scheduled posts, emails and cleanups may not run. Ask your host about WP-Cron.' );
  if ( site.debug_display ) add( 'wordpress', 'debug', 'Debug mode', 'on', 'warning', 'PHP errors are shown to visitors. Fine while developing, not on a live site.' );
  else add( 'wordpress', 'debug', 'Debug mode', site.debug ? 'logging only' : 'off', 'good', site.debug ? 'Errors go to the log, not to visitors.' : '' );
  if ( site.object_cache ) add( 'wordpress', 'cache', 'Object cache', 'on', 'good', 'Database answers are kept in memory.' );
  else add( 'wordpress', 'cache', 'Object cache', 'off', 'neutral', 'Optional; your host may offer Redis.' );
  return checks;
};

// The three ratings at the top of the Health tab, out of 5. All local: the server's facts, this
// week's errors, and the speed test once it has run (until then Speed waits for it).
const healthRatings = ( checks, problems, speed ) => {
  const ratings = [];
  if ( speed && speed.length ) {
    const worst = Math.max( ...speed.map( t => t.ms ) );
    ratings.push( worst <= 300 ? { area: 'Speed', rating: 5, label: 'Fast', summary: `Every test answered in ${worst} ms or less.` }
      : worst <= 800 ? { area: 'Speed', rating: 4, label: 'Good', summary: `The slowest test took ${worst} ms.` }
      : worst <= 2000 ? { area: 'Speed', rating: 3, label: 'Could be faster', summary: `The slowest test took ${worst} ms. A better host or a cache helps.` }
      : { area: 'Speed', rating: 2, label: 'Slow', summary: `The slowest test took ${( worst / 1000 ).toFixed( 1 )} s. Your host is the usual suspect.` } );
  }
  else {
    ratings.push( { area: 'Speed', rating: 0, label: 'Not measured yet', summary: 'Run the speed test below: it takes a few seconds.' } );
  }
  const bad = checks.filter( c => c.tone === 'bad' ).length;
  const warn = checks.filter( c => c.tone === 'warning' ).length;
  ratings.push( bad ? { area: 'Environment', rating: 2, label: 'Needs work', summary: `${bad + warn} settings below are worth fixing.` }
    : warn ? { area: 'Environment', rating: warn > 1 ? 3 : 4, label: 'Good, mostly', summary: `${warn} ${warn === 1 ? 'setting' : 'settings'} below could be better.` }
    : { area: 'Environment', rating: 5, label: 'Well set up', summary: 'PHP and WordPress give your site enough room.' } );
  if ( problems === undefined ) {
    ratings.push( { area: 'Errors', rating: 0, label: 'Reading the log…', summary: 'Looking at the last 7 days.' } );
  }
  else {
    const fatal = problems.filter( p => ['fatal', 'parse', 'exception'].includes( p.type ) ).length;
    ratings.push( fatal ? { area: 'Errors', rating: fatal > 3 ? 1 : 2, label: `${fatal} fatal ${fatal === 1 ? 'error' : 'errors'}`, summary: 'Something broke this week. The Errors tab says where.' }
      : problems.length ? { area: 'Errors', rating: 4, label: 'Only warnings', summary: `${problems.length} minor ${problems.length === 1 ? 'problem' : 'problems'} this week, nothing broken.` }
      : { area: 'Errors', rating: 5, label: 'No errors', summary: 'Nothing in the PHP log this week.' } );
  }
  return ratings;
};

// The plugin (or theme) an error line comes from, by its path; null when it can't tell.
const logOwner = ( content ) => {
  let m = content.match( /\/(?:mu-plugins|plugins)\/([^/\s]+)/ );
  if ( m ) return m[1];
  m = content.match( /\/themes\/([^/\s]+)/ );
  if ( m ) return m[1];
  if ( /\/wp-(?:includes|admin)\//.test( content ) ) return 'WordPress';
  return null;
};

// One line per distinct problem: the same broken call logged on every page load is one problem.
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
    const entry = { key, type: row.type, content: row.content, owner: logOwner( row.content ),
      latest: row.date, oldest: row.date, count: 1 };
    byKey.set( key, entry );
    grouped.push( entry );
  }
  return grouped;
};

const ownerName = ( owner ) => {
  if ( !owner ) return 'Unknown source';
  const plugin = PLUGINS[owner.replace( /-pro$/, '' )];
  return plugin ? plugin.name : owner;
};

// The last seven days only: an error fixed last month should not keep the site orange.
const WEEK = 7 * 24 * 3600 * 1000;
const recentProblems = ( entries ) => {
  const since = Date.now() - WEEK;
  const recent = ( entries || [] ).filter( e => {
    const t = Date.parse( String( e.date ).replace( ' ', 'T' ) );
    return !isNaN( t ) && t >= since;
  } );
  return groupRepeats( recent );
};

// Fatal and warning counts per source, worst first.
const problemsByOwner = ( problems ) => {
  const map = {};
  for ( const p of problems ) {
    const key = p.owner || '?';
    map[key] = map[key] || { owner: p.owner, name: ownerName( p.owner ), fatal: 0, other: 0 };
    if ( p.type === 'fatal' || p.type === 'parse' || p.type === 'exception' ) map[key].fatal += 1;
    else map[key].other += 1;
  }
  return Object.values( map ).sort( ( a, b ) => ( b.fatal - a.fatal ) || ( b.other - a.other ) );
};

const shortenPaths = ( text ) => String( text )
  .replace( /\/[^\s'"]*?\/(?:mu-plugins|plugins|themes)\/([^\s'"]+)/g, '$1' )
  .replace( /\/[^\s'"]*?\/(wp-includes|wp-admin)\/([^\s'"]+)/g, '$1/$2' );

// Plain text, ready to paste into a support email: everything support asks for in the first reply.
const buildReport = ( site, rows, problems ) => {
  const lines = [];
  lines.push( 'Site report (Meow Apps dashboard)' );
  lines.push( `Site: ${site.url || '?'}` );
  lines.push( `WordPress ${site.wordpress || '?'}${site.multisite ? ' (multisite)' : ''} · PHP ${site.php || '?'} · Database ${site.database || '?'}` );
  lines.push( `Server: ${site.server || '?'}` );
  lines.push( `Memory ${site.memory_limit || '?'} (WP ${site.wp_memory_limit || '?'}) · Time limit ${site.max_execution_time || '?'} s · Upload ${site.upload_max_filesize || '?'} · Post ${site.post_max_size || '?'} · Input vars ${site.max_input_vars || '?'}` );
  lines.push( `HTTPS ${site.https ? 'yes' : 'no'} · Object cache ${site.object_cache ? 'yes' : 'no'} · WP-Cron ${site.cron_disabled ? 'disabled' : 'on'} · Debug ${site.debug ? 'on' : 'off'}` );
  lines.push( `Theme: ${site.theme || '?'} · Locale ${site.locale || '?'} · Timezone ${site.timezone || '?'}` );
  lines.push( '' );
  lines.push( 'Meow Apps plugins:' );
  for ( const row of rows ) {
    const license = row.pro ? ` · license ${row.license || '?'}` : '';
    const update = row.behind && row.latest ? ` · ${row.latest} available` : '';
    lines.push( `- ${row.name}${row.pro && !/pro/i.test( row.name ) ? ' (Pro)' : ''} ${row.version}${license}${update}` );
  }
  lines.push( '' );
  lines.push( `Active plugins (${( site.plugins || [] ).length}):` );
  for ( const plugin of site.plugins || [] ) lines.push( `- ${plugin}` );
  lines.push( '' );
  lines.push( problems.length ? `Errors in the last 7 days (${problems.length} distinct):` : 'Errors in the last 7 days: none.' );
  for ( const p of problems.slice( 0, 15 ) ) {
    lines.push( `- [${p.type}] ×${p.count} ${shortenPaths( p.content ).slice( 0, 300 )}` );
  }
  return lines.join( '\n' );
};

export { PROBLEM_WORDS, readSite, siteChecks, healthRatings, groupRepeats, recentProblems, problemsByOwner, ownerName, shortenPaths, buildReport };
