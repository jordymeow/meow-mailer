// The Meow plugins the dashboard knows about: name, icon and a few words on what each one is for.
// Installed plugins report their real state from PHP (see PluginStatus); this catalog fills in the
// ones that are not installed. `card` marks the plugins with something to say about the site: they
// get a card on the dashboard, the others a line in the list below.

const icon = slug => `https://ps.w.org/${slug}/assets/icon-256x256.png`;

const PLUGINS = {
  'ai-engine': {
    card: true,
    name: 'AI Engine',
    icon: icon('ai-engine'),
    role: 'gives your site a brain',
    desc: "Your all-in-one AI suite for WordPress: chatbots, content generation, APIs and full REST support.",
    features: ['Chatbots & Assistants', 'Content Generation', 'AI Forms & Images', 'MCP + REST API'],
  },
  'seo-engine': {
    card: true,
    name: 'SEO Engine',
    icon: icon('seo-engine'),
    role: 'makes you findable',
    desc: "Tune your content for classic SEO and AI assistants, while staying fast and simple.",
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
    desc: "Beautiful, fast galleries with plenty of layouts. A lightweight alternative to bloated plugins.",
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
    card: true,
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
    card: true,
    name: 'Media Cleaner',
    icon: icon('media-cleaner'),
    role: 'takes out the trash',
    desc: "Detect and remove orphan files, unused entries and broken references from your library.",
    features: ['Orphan Detection', 'Safe Internal Trash', 'Builder-Aware Scan', 'MCP Support'],
  },
  'database-cleaner': {
    card: true,
    name: 'Database Cleaner',
    icon: icon('database-cleaner'),
    role: 'slims down your database',
    desc: "A friendly UI for trimming your database, even when it's grown huge.",
    features: ['Easy & Expert Modes', 'One-Click Cleaning', 'Handles Huge Databases', 'Size History'],
  },
  'media-file-renamer': {
    card: true,
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
    // No paid tier exists: meowapps.com/meow-mailer/ says so in as many words.
    freeOnly: true,
  },
  'social-engine': {
    name: 'Social Engine',
    icon: icon('social-engine'),
    role: 'posts everywhere for you',
    desc: "Schedule and automate posts across every network you care about. Free and unlimited.",
    features: ['Visual Calendar', 'Six Networks', 'Self-Hosted', 'No Subscription'],
  },
  'gallery-custom-links': {
    name: 'Gallery Custom Links',
    icon: icon('gallery-custom-links'),
    role: 'links your gallery images',
    desc: "Link each gallery image anywhere: a page, a product, an external site.",
    features: ['Links per Image', 'Works with Any Gallery', 'Buttons on Images', 'No Bloat'],
  },
};

// A plugin counts as installed when either its free or its Pro folder is there.
const getInstallState = ( slug, installed ) => {
  if ( !installed ) return null;
  let bestState = null;
  for ( const cand of [slug, `${slug}-pro`] ) {
    const state = installed[cand];
    if ( state === 'active' ) return 'active';
    if ( state === 'inactive' ) bestState = 'inactive';
  }
  return bestState;
};

const freeUrl = slug => `https://wordpress.org/plugins/${slug}/`;
const proUrl = slug => `https://meowapps.com/${slug}/`;

export { PLUGINS, getInstallState, freeUrl, proUrl };
