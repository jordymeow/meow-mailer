// Everything the board knows about.
//
// Three kinds of node live on it: the outside WORLD your site talks to, the
// WordPress CORE modules that hold your data, and the Meow PLUGINS. LAYERS
// stacks them; LINKS wires them; JOURNEYS animates real things travelling
// through the whole arrangement.
//
// FAMILIES are only about colour and about how the grid view groups things.

const FAMILIES = {
  intelligence: { label: 'Intelligence', color: '#8ea2ff' },
  visuals: { label: 'Media & Visuals', color: '#ffb15c' },
  upkeep: { label: 'Upkeep', color: '#4fdcaa' },
  reach: { label: 'Reach', color: '#ff86b4' },
  core: { label: 'WordPress', color: '#6ea4ff' },
  world: { label: 'The World', color: '#9db3d0' },
};

// Every plugin gets its own accent. Four family colours across thirteen cards
// left the board reading as one blue mass, when the whole point is that these
// are different tools doing different jobs. Hues are spread so that no two
// neighbours in a row sit next to each other on the wheel, and all of them are
// light and saturated enough to carry against the brand blue.
//
// WordPress's own modules and the outside world stay deliberately muted: the
// colour belongs to the plugins, so what you have installed is what lights the
// board up.
// Two rules make this work. Nothing sits in the 200-240° band, because the
// board itself is that blue and an azure card simply vanished into it. And each
// row alternates warm, cool, warm, cool, so no two neighbours are ever close on
// the wheel however the rows are read.
const ACCENTS = {
  // Front row: teal, gold, violet, vermilion, green, rose.
  'meow-gallery': '#3fd6c0',
  'meow-lightbox': '#ffc857',
  'contact-form-block': '#c084fc',
  'seo-engine': '#ff8459',
  'meow-mailer': '#4ade80',
  'social-engine': '#fb7185',

  // The one plugin in the core layer, in the warmest colour on the board.
  'ai-engine': '#ff9f45',

  // Backstage row: indigo, coral, green, amber, cyan, pink.
  'code-engine': '#8b7ff5',
  'media-file-renamer': '#ff8a65',
  'wp-retina-2x': '#6ee7a0',
  'wplr-sync': '#fbbf24',
  'media-cleaner': '#22d3ee',
  'database-cleaner': '#f472b6',

  // WordPress: a quiet spread, enough to tell them apart and no more.
  posts: '#9fb8e8',
  media: '#8ecfe0',
  users: '#b3aee0',
  plugins: '#d8c39a',
  database: '#9dc6ad',

  // The outside world: quietest of all.
  visitors: '#a6bcd8',
  bots: '#b9b0d4',
  inboxes: '#a4cbcb',
  social: '#d2b0c6',
};

// Top to bottom. `items` is the left-to-right order inside the layer, chosen so
// that the wires between layers stay short and mostly untangled.
// A layer's accent is structural, not decorative: it washes the whole panel, so
// these stay softer than the plugin accents above and far enough apart that the
// four bands never read as one. Warm for the outside world, cool through the
// middle, violet backstage.
const RAW_LAYERS = [
  { id: 'world', kind: 'world', title: 'Outside', icon: 'external-link', accent: '#b6c2d4',
    blurb: 'Everyone your site talks to.',
    items: ['visitors', 'bots', 'inboxes', 'social'] },
  { id: 'surface', kind: 'plugin', title: 'Front', icon: 'eye', accent: '#5ec8d4',
    blurb: 'What visitors and machines see.',
    items: ['meow-gallery', 'meow-lightbox', 'contact-form-block', 'seo-engine', 'meow-mailer', 'social-engine'] },
  { id: 'core', kind: 'core', title: 'Core', icon: 'dashboard', accent: '#a9b8ff',
    blurb: 'WordPress and AI Engine. Everything else plugs in here.',
    sections: [
      { id: 'wordpress', label: 'WordPress', items: ['posts', 'media', 'users', 'plugins', 'database'] },
      { id: 'ai', label: 'AI', items: ['ai-engine'] },
    ] },
  { id: 'workshop', kind: 'plugin', title: 'Backstage', icon: 'tools', accent: '#c79ae0',
    blurb: 'Working on it behind the scenes.',
    items: ['code-engine', 'media-file-renamer', 'wp-retina-2x', 'wplr-sync', 'media-cleaner', 'database-cleaner'] },
];

// A layer is one or more named sections. Most rows are a single unnamed section,
// which is simply "the row". Core has two, so AI Engine reads as its own
// compartment of the heart of the site rather than as the last card in a list of
// WordPress modules. `items` stays the flat left-to-right order everything else
// relies on.
const LAYERS = RAW_LAYERS.map( layer => {
  const sections = layer.sections || [{ id: layer.id, label: null, items: layer.items }];
  return { ...layer, sections, items: sections.flatMap( section => section.items ) };
} );

const WORLD = {
  visitors: { name: 'Visitors', iconName: 'user', family: 'world',
    desc: 'People reading your posts, looking at your photos and filling in your forms.' },
  bots: { name: 'Search & AI', iconName: 'search', family: 'world',
    desc: 'Google, Bing, and the AI assistants that read your site to answer questions about it.' },
  inboxes: { name: 'Inboxes', iconName: 'mail', family: 'world',
    desc: 'Every email your site sends: resets, receipts, notifications, alerts.' },
  social: { name: 'Social Networks', iconName: 'share', family: 'world',
    desc: 'X, Facebook, Instagram, LinkedIn, Pinterest and Mastodon.' },
};

const CORE = {
  posts: { name: 'Posts', iconName: 'book', family: 'core',
    desc: 'Everything you write. The reason all the rest exists.' },
  media: { name: 'Media', iconName: 'image', family: 'core',
    desc: 'Every image, video and file you have ever uploaded.' },
  // A module only earns a card if something actually reaches it. Comments used
  // to sit here with no wire and no journey, so it was just furniture.
  users: { name: 'Users', iconName: 'user', family: 'core',
    desc: 'Accounts and roles, and every email WordPress sends them.' },
  plugins: { name: 'Plugins', iconName: 'plug', family: 'core',
    desc: 'Everything bolted onto WordPress. Including all of these.' },
  database: { name: 'Database', iconName: 'database', family: 'core',
    desc: 'Where every last bit of it is actually stored.' },
};

const icon = slug => `https://ps.w.org/${slug}/assets/icon-256x256.png`;

const PLUGINS = {
  'ai-engine': {
    name: 'AI Engine',
    icon: icon('ai-engine'),
    role: 'gives your site a brain',
    desc: "Your all-in-one AI suite for WordPress: chatbots, content generation, APIs and full REST support.",
    features: ['Chatbots & Assistants', 'Content Generation', 'AI Forms & Images', 'MCP + REST API'],
  },
  'seo-engine': {
    name: 'SEO Engine',
    icon: icon('seo-engine'),
    role: 'makes you findable',
    desc: "Tune your content for classic SEO and AI assistants, while staying fast and simple. ✌️",
    features: ['Live Content Score', 'AI Suggestions', 'Sitemaps & Schema', 'AI Bot Analytics'],
  },
  'code-engine': {
    name: 'Code Engine',
    icon: icon('code-engine'),
    role: 'lets you bend the rules',
    desc: "Manage and run snippets, custom functions and integrations directly from WordPress.",
    features: ['PHP & JS Snippets', 'Functions as AI Tools', 'Scheduled Runs', 'REST Endpoints'],
  },
  'meow-gallery': {
    name: 'Meow Gallery',
    icon: icon('meow-gallery'),
    role: 'shows off your photos',
    desc: "Beautiful, fast galleries with plenty of layouts. A lightweight alternative to bloated plugins. 💕",
    features: ['Tiles, Masonry, Justified', 'Gallery Block', 'Retina & Lazy Load', 'No Bloat'],
  },
  'meow-lightbox': {
    name: 'Meow Lightbox',
    icon: `https://ps.w.org/meow-lightbox/assets/icon-256x256.gif`,
    role: 'opens them beautifully',
    desc: "A sleek, performant lightbox with full EXIF support.",
    features: ['EXIF & GPS Maps', 'Two Engines', 'Fully Responsive', 'Photographer Ready'],
  },
  'wp-retina-2x': {
    name: 'Perfect Images',
    icon: icon('wp-retina-2x'),
    role: 'keeps every image sharp',
    desc: "Retina-ready imagery: manage, optimize and replace every image on your site.",
    features: ['Image Size Control', 'Bulk Regenerate', 'Retina Support', 'WebP & AVIF'],
  },
  'wplr-sync': {
    name: 'Photo Engine',
    icon: icon('wplr-sync'),
    role: 'organizes your library',
    desc: "Organize photos in folders and collections. Sync with Lightroom and speed up your workflow.",
    features: ['Folders & Collections', 'Lightroom Sync', 'Galleries from Collections', 'Total Synchronization'],
  },
  'media-cleaner': {
    name: 'Media Cleaner',
    icon: icon('media-cleaner'),
    role: 'takes out the trash',
    desc: "Detect and remove orphan files, unused entries and broken references from your library.",
    features: ['Orphan Detection', 'Safe Internal Trash', 'Builder-Aware Scan', 'MCP Support'],
  },
  'database-cleaner': {
    name: 'Database Cleaner',
    icon: icon('database-cleaner'),
    role: 'slims down your database',
    desc: "A friendly UI for trimming your database, even when it's grown huge.",
    features: ['Easy & Expert Modes', 'One-Click Cleaning', 'Handles Huge Databases', 'Size History'],
  },
  'media-file-renamer': {
    name: 'Media File Renamer',
    icon: icon('media-file-renamer'),
    role: 'names your files properly',
    desc: "Rename and move files manually, automatically or with AI, one by one or in bulk.",
    features: ['AI Vision Naming', 'Bulk Renaming', 'Metadata Sync', 'Automatic Redirects'],
  },
  'contact-form-block': {
    name: 'Contact Form Block',
    icon: icon('contact-form-block'),
    role: 'lets people write to you',
    desc: "A simple, fast and efficient contact form. Exactly what you need, nothing more.",
    features: ['Gutenberg Block', 'No JS, No CSS', 'ReCAPTCHA Ready', 'Shortcode Too'],
    // Free only: its product page offers a download and no upgrade.
    freeOnly: true,
  },
  'meow-mailer': {
    name: 'Meow Mailer',
    icon: icon('meow-mailer'),
    role: 'gets your email delivered',
    desc: "Your essential, simple and honest SMTP plugin. Pick a provider once, and see every email.",
    features: ['SMTP & Provider APIs', 'Full Email Log, Free', 'Automatic Fallback', 'Failure Alerts'],
    // No paid tier exists — meowapps.com/meow-mailer/ says so in as many words.
    freeOnly: true,
  },
  'social-engine': {
    name: 'Social Engine',
    icon: icon('social-engine'),
    role: 'posts everywhere for you',
    desc: "Schedule and automate posts across every network you care about. Free and unlimited.",
    features: ['Visual Calendar', 'Six Networks', 'Self-Hosted', 'No Subscription'],
  },
};

// Real integrations between the plugins — the reason the suite is a suite and
// not a pile. Focusing a plugin on the map draws these, so people can see what
// they'd unlock by pairing two of them.
const SYNERGIES = [
  ['ai-engine', 'code-engine'],
  ['ai-engine', 'seo-engine'],
  ['ai-engine', 'media-file-renamer'],
  ['ai-engine', 'media-cleaner'],
  ['ai-engine', 'social-engine'],
  ['meow-gallery', 'meow-lightbox'],
  ['meow-gallery', 'wplr-sync'],
  ['meow-gallery', 'wp-retina-2x'],
  ['meow-lightbox', 'wplr-sync'],
  ['media-file-renamer', 'seo-engine'],
  ['contact-form-block', 'meow-mailer'],

  // Database Cleaner recognises the tables, options and crons of these plugins
  // and leaves them alone while they are active, instead of offering them up as
  // orphans — see database-cleaner/classes/support/meowapps.php. Media Cleaner
  // was the only one of the four listed here; the rest are just as real.
  ['media-cleaner', 'database-cleaner'],
  ['ai-engine', 'database-cleaner'],
  ['meow-gallery', 'database-cleaner'],
  ['code-engine', 'database-cleaner'],
];

// A small icon per capability chip. Matched on meaning, first hit wins.
//
// Names must exist in NekoUI's preset map (neko-ui/src/common/PresetIcons.js) —
// they are NOT Dashicons, whatever this comment used to claim. A name that
// isn't there renders a generic question mark with no error, so check the map
// before adding one.
const FEATURE_ICONS = [
  [/chatbot|assistant/i, 'message'],
  [/exif|gps|maps/i, 'image'],
  [/vision|suggestion/i, 'sparkles'],
  [/mcp|rest|api/i, 'plug'],
  [/snippet|code|function|shortcode/i, 'terminal'],
  [/schedul|runs/i, 'timer-outline'],
  [/score|analytic|history|statistic/i, 'dashboard'],
  [/sitemap|schema/i, 'link'],
  [/generation|content/i, 'wand'],
  [/form|recaptcha/i, 'clipboard'],
  [/calendar/i, 'calendar-month'],
  [/network|social|self-hosted|subscription/i, 'share'],
  [/smtp|email|mail|inbox/i, 'mail'],
  [/alert|failure|fallback/i, 'warning'],
  [/gallery|tiles|masonry|justified|collection/i, 'image-multiple-outline'],
  [/block/i, 'view-grid'],
  [/lazy|bloat|performan|responsive|no js|no css/i, 'zap'],
  [/sync/i, 'sync'],
  [/naming|rename|metadata|tag/i, 'tag'],
  [/redirect/i, 'replay'],
  [/database|huge/i, 'database'],
  [/orphan|trash|clean/i, 'trash'],
  [/lightroom|photographer|camera/i, 'image'],
  [/retina|webp|avif|image|thumbnail|regenerate/i, 'retina'],
  [/scan|detect/i, 'search'],
  [/mode|control|size|engine/i, 'cog'],
]

const getFeatureIcon = ( text ) => {
  const hit = FEATURE_ICONS.find( ( [re] ) => re.test( text ) );
  return hit ? hit[1] : null;
};

const getPartners = ( slug ) => SYNERGIES
  .filter( pair => pair.includes( slug ) )
  .map( pair => ( pair[0] === slug ? pair[1] : pair[0] ) );

const FAMILY_OF = {
  'ai-engine': 'intelligence', 'seo-engine': 'intelligence', 'code-engine': 'intelligence',
  'meow-gallery': 'visuals', 'meow-lightbox': 'visuals', 'wp-retina-2x': 'visuals', 'wplr-sync': 'visuals',
  'media-cleaner': 'upkeep', 'database-cleaner': 'upkeep', 'media-file-renamer': 'upkeep',
  'contact-form-block': 'reach', 'meow-mailer': 'reach', 'social-engine': 'reach',
};

// Structural wiring: who is connected to whom. Mostly between adjacent layers,
// which is what keeps the routing readable, but a few reach straight from the
// world into the core where that is the truth — the router handles the skip by
// dropping through a corridor. Plugin-to-plugin integrations live in SYNERGIES.
//
// Every hop of every JOURNEY must appear here or in SYNERGIES, or a packet
// flies a route that no wire backs up: hovering the same two cards would then
// show nothing between them.
const LINKS = [
  ['visitors', 'meow-gallery'],
  ['visitors', 'meow-lightbox'],
  ['visitors', 'contact-form-block'],
  ['bots', 'seo-engine'],
  // AI Engine is the MCP server and serves the chatbot, so the outside world
  // reaches it directly — that is the whole point of it being in the core.
  ['bots', 'ai-engine'],
  ['visitors', 'ai-engine'],
  ['inboxes', 'meow-mailer'],
  ['social', 'social-engine'],
  // Visitors become accounts. The welcome-mail journey travels this every time
  // it runs; it just had no wire under it until now.
  ['visitors', 'users'],

  ['meow-gallery', 'media'],
  ['meow-lightbox', 'media'],
  ['contact-form-block', 'posts'],
  ['seo-engine', 'posts'],
  ['meow-mailer', 'users'],
  ['social-engine', 'posts'],

  ['ai-engine', 'posts'],
  ['ai-engine', 'media'],
  ['code-engine', 'plugins'],
  ['code-engine', 'database'],
  ['media-file-renamer', 'media'],
  ['wp-retina-2x', 'media'],
  ['wplr-sync', 'media'],
  ['media-cleaner', 'media'],
  ['media-cleaner', 'database'],
  ['database-cleaner', 'database'],
];

// Things that really happen on a WordPress site, animated as packets hopping
// from node to node. A journey whose plugins aren't running still plays, greyed
// out and labelled with what it would take — that is the whole pitch, drawn.
const JOURNEYS = [
  // Mail
  { id: 'reset', glyph: '✉️', label: 'Password reset', needs: ['meow-mailer'],
    stops: ['users', 'meow-mailer', 'inboxes'] },
  { id: 'welcome', glyph: '👋', label: 'New account, welcome mail', needs: ['meow-mailer'],
    stops: ['visitors', 'users', 'meow-mailer', 'inboxes'] },
  { id: 'digest', glyph: '📊', label: 'Weekly summary of what was sent', needs: ['meow-mailer'],
    stops: ['meow-mailer', 'inboxes'] },
  { id: 'contact', glyph: '📨', label: '"Hello, a question…"', needs: ['contact-form-block', 'meow-mailer'],
    stops: ['visitors', 'contact-form-block', 'meow-mailer', 'inboxes'] },

  // Intelligence
  { id: 'chat', glyph: '💬', label: '"Do you ship to Japan?"', needs: ['ai-engine'],
    stops: ['visitors', 'ai-engine', 'posts'] },
  { id: 'mcp', glyph: '🤖', label: 'An AI assistant reads your site', needs: ['ai-engine'],
    stops: ['bots', 'ai-engine', 'posts'] },
  { id: 'write', glyph: '✍️', label: 'A draft written for you', needs: ['ai-engine'],
    stops: ['ai-engine', 'posts'] },
  { id: 'tool', glyph: '🧩', label: 'Your own function, called by the chatbot', needs: ['ai-engine', 'code-engine'],
    stops: ['ai-engine', 'code-engine', 'database'] },
  // Ends at the database, not at Posts: Code Engine is wired to Plugins and the
  // Database, and a snippet reaching Posts was a route with no wire beneath it.
  { id: 'snippet', glyph: '⚙️', label: 'A snippet runs on schedule', needs: ['code-engine'],
    stops: ['code-engine', 'database'] },
  { id: 'extend', glyph: '🔌', label: 'A snippet instead of a whole plugin', needs: ['code-engine'],
    stops: ['code-engine', 'plugins'] },

  // Findability
  { id: 'crawl', glyph: '🔍', label: 'Googlebot drops by', needs: ['seo-engine'],
    stops: ['bots', 'seo-engine', 'posts'] },
  { id: 'score', glyph: '🎯', label: 'A post scored and improved', needs: ['seo-engine'],
    stops: ['posts', 'seo-engine'] },
  { id: 'publish', glyph: '📣', label: 'New post, everywhere', needs: ['social-engine'],
    stops: ['posts', 'social-engine', 'social'] },
  // Social Engine hands the post to AI Engine and asks it for a caption —
  // social-engine/classes/rest.php calls $mwai->simpleTextQuery() for exactly
  // this. Social Networks had only one story to its name before.
  { id: 'caption', glyph: '📝', label: 'The caption, written for you',
    needs: ['social-engine', 'ai-engine'],
    stops: ['ai-engine', 'social-engine', 'social'] },

  // Pictures
  { id: 'photo', glyph: '🖼️', label: 'Someone opens a photo', needs: ['meow-gallery'],
    stops: ['visitors', 'meow-gallery', 'media'] },
  { id: 'exif', glyph: '📸', label: 'A photo, with its EXIF and its map', needs: ['meow-lightbox'],
    stops: ['visitors', 'meow-lightbox', 'media'] },
  { id: 'retina', glyph: '✨', label: 'Thumbnails regenerated', needs: ['wp-retina-2x'],
    stops: ['media', 'wp-retina-2x', 'meow-gallery'] },
  { id: 'lightroom', glyph: '📷', label: 'Lightroom sends over a photo', needs: ['wplr-sync'],
    stops: ['wplr-sync', 'media'] },
  { id: 'collection', glyph: '🗂️', label: 'A collection becomes a gallery', needs: ['wplr-sync', 'meow-gallery'],
    stops: ['wplr-sync', 'meow-gallery', 'visitors'] },

  // Upkeep
  { id: 'sweep', glyph: '🧹', label: 'Nightly clean-up', needs: ['media-cleaner'],
    stops: ['media', 'media-cleaner', 'database'] },
  { id: 'trim', glyph: '🗄️', label: 'The database gets trimmed', needs: ['database-cleaner'],
    stops: ['database-cleaner', 'database'] },
  { id: 'rename', glyph: '🏷️', label: 'Upload named by AI', needs: ['media-file-renamer', 'ai-engine'],
    stops: ['media', 'media-file-renamer', 'ai-engine'] },
  { id: 'redirect', glyph: '🔁', label: 'Renamed, and the old link still works', needs: ['media-file-renamer'],
    stops: ['media-file-renamer', 'media'] },
];


// One flat registry so the board can treat plugins, core modules and world
// actors the same way when it lays them out, wires them and reads them out.
const buildNodes = () => {
  const nodes = {};
  for ( const layer of LAYERS ) {
    for ( const id of layer.items ) {
      // Resolved per item, not per layer: the Core layer holds WordPress's own
      // modules and AI Engine side by side.
      const kind = PLUGINS[id] ? 'plugin' : ( CORE[id] ? 'core' : 'world' );
      const source = PLUGINS[id] || CORE[id] || WORLD[id];
      if ( !source ) continue;
      const family = kind === 'plugin' ? FAMILY_OF[id] : kind;
      nodes[id] = {
        id, kind, layer: layer.id, family,
        color: getAccent( id, family ),
        standout: kind === 'plugin' && layer.kind === 'core',
        ...source,
      };
    }
  }
  return nodes;
};

// Everything wired to a node, structural links and integrations alike.
const getNeighbours = ( id ) => {
  const out = [];
  for ( const [a, b] of LINKS ) {
    if ( a === id ) out.push( b );
    else if ( b === id ) out.push( a );
  }
  for ( const partner of getPartners( id ) ) {
    if ( !out.includes( partner ) ) out.push( partner );
  }
  return out;
};

// Match either the free slug (e.g. "ai-engine") or the pro variant
// (e.g. "ai-engine-pro"). Returns 'active' | 'inactive' | null.
const getInstallState = ( slug, installed ) => {
  if ( !installed ) return null;
  const candidates = [slug, `${slug}-pro`];
  let bestState = null;
  for ( const cand of candidates ) {
    const state = installed[cand];
    if ( state === 'active' ) return 'active';
    if ( state === 'inactive' ) bestState = 'inactive';
  }
  return bestState;
};

const freeUrl = slug => `https://wordpress.org/plugins/${slug}/`;
const proUrl = slug => `https://meowapps.com/${slug}/`;

// Core modules and world actors have no feature list of their own. What they do
// have is everything that passes through them, which is a better answer to
// "what is this for?" than a list of the plugins that happen to touch it.
const getJourneysThrough = id => JOURNEYS.filter( j => j.stops.includes( id ) );

// The one place either view asks what colour something is, so a plugin looks
// like itself on the board and in the grid. Falls back to its family for
// anything that hasn't been given an accent of its own.
const getAccent = ( id, family ) => ACCENTS[id]
  || ( FAMILIES[family || FAMILY_OF[id]] || {} ).color
  || '#8fd0ff';

// A journey flies in the colour of the plugin that makes it possible, so each
// story crossing the board is visibly a different plugin's doing rather than
// one more blue line.
const getJourneyColor = journey => getAccent( journey.needs[0] );

// One vocabulary for install state, shared by the readout badge and the cards'
// accessible names. A badge should be a word; a spoken label should be a
// sentence, so there are two forms of the same three states.
// 'unknown' is the state before the install list has arrived. It used to be
// indistinguishable from "not installed", so for the moment between mount and
// the REST reply the page told every user they owned nothing and then flipped.
const statusLabel = ( state ) => {
  if ( state === 'active' ) return 'Running';
  if ( state === 'inactive' ) return 'Inactive';
  if ( state === 'unknown' ) return 'Checking…';
  return 'Not installed';
};

const statusHint = ( state ) => {
  if ( state === 'active' ) return 'Installed and active';
  if ( state === 'inactive' ) return 'Installed, but not activated';
  if ( state === 'unknown' ) return 'Checking whether this is installed';
  return 'Not installed on this site';
};

export {
  // WORLD and CORE stay private: buildNodes is the only thing that needs them,
  // and it already folds them into the flat node registry everything else uses.
  FAMILIES, FAMILY_OF, LAYERS, PLUGINS, LINKS, SYNERGIES, JOURNEYS,
  buildNodes, getNeighbours, getPartners, getFeatureIcon, getJourneysThrough,
  getAccent, getJourneyColor, statusLabel, statusHint,
  getInstallState, freeUrl, proUrl,
};
