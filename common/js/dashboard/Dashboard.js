/* eslint-disable react/no-unescaped-entities */
// React & Vendor Libs
const { useState, useEffect } = wp.element;
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// NekoUI
import { NekoTypo, NekoPage, NekoHeader, NekoWrapper, NekoTab, NekoTabs, NekoBlock, NekoButton,
  NekoColumn, NekoSettings, NekoCheckboxGroup, NekoCheckbox, NekoIntro } from '@neko-ui';
import { nekoFetch } from '@neko-ui';

import { apiUrl, restUrl, pluginUrl, restNonce } from '@app/settings';
import { SpeedTester } from './SpeedTester';
import { TabText, StyledPluginGrid, StyledPluginTile,
  StyledArticleGrid, StyledArticleCard,
  StyledPhpErrorLogs, StyledPhpInfo } from './Dashboard.styled';

if (!apiUrl || !restUrl || !pluginUrl) {
  console.error("[@common/dashboard] apiUrl, restUrl and pluginUrl are mandatory.");
}

const CommonApiUrl = `${restUrl}/meow-common/v1`;

const jsxIntro =
  <NekoIntro>
    Hi! ☀️ Meow Apps isn't your typical plugin suite. It's a passion project led by me, <a target="_blank" rel="noreferrer" href="https://jordymeow.com">Jordy Meow</a>, and a stellar team. 💕 Based in <a target="_blank" rel="noreferrer" href="https://offbeatjapan.org">Japan</a>, we focus on making your WordPress experience smoother, faster, and more enjoyable. Ready to level up your site? Check out <a href="http://meowapps.com" rel="noreferrer" target="_blank">Meow Apps</a> and let's make magic happen! 🌴🙀
  </NekoIntro>;

const PLUGINS = [
  { slug: 'ai-engine', name: 'AI Engine',
    icon: 'https://ps.w.org/ai-engine/assets/icon-256x256.png',
    desc: "Your all-in-one AI suite for WordPress: chatbots, content generation, APIs and full REST support." },
  { slug: 'media-cleaner', name: 'Media Cleaner',
    icon: 'https://ps.w.org/media-cleaner/assets/icon-256x256.png',
    desc: "Detect and remove orphan files, unused entries and broken references from your library." },
  { slug: 'database-cleaner', name: 'Database Cleaner',
    icon: 'https://ps.w.org/database-cleaner/assets/icon-256x256.png',
    desc: "A friendly UI for trimming your database, even when it's grown huge." },
  { slug: 'media-file-renamer', name: 'Media File Renamer',
    icon: 'https://ps.w.org/media-file-renamer/assets/icon-256x256.png',
    desc: "Rename and move files manually, automatically or with AI, one by one or in bulk." },
  { slug: 'social-engine', name: 'Social Engine',
    icon: 'https://ps.w.org/social-engine/assets/icon-256x256.png',
    desc: "Schedule and automate posts across every network you care about. Free and unlimited." },
  { slug: 'seo-engine', name: 'SEO Engine',
    icon: 'https://ps.w.org/seo-engine/assets/icon-256x256.png',
    desc: "Tune your content for classic SEO and AI assistants, while staying fast and simple. ✌️" },
  { slug: 'meow-gallery', name: 'Meow Gallery',
    icon: 'https://ps.w.org/meow-gallery/assets/icon-256x256.png',
    desc: "Beautiful, fast galleries with plenty of layouts. A lightweight alternative to bloated plugins. 💕" },
  { slug: 'meow-lightbox', name: 'Meow Lightbox',
    icon: 'https://ps.w.org/meow-lightbox/assets/icon-256x256.gif',
    desc: "A sleek, performant lightbox with full EXIF support." },
  { slug: 'code-engine', name: 'Code Engine',
    icon: 'https://ps.w.org/code-engine/assets/icon-256x256.png',
    desc: "Manage and run snippets, custom functions and integrations directly from WordPress." },
  { slug: 'wp-retina-2x', name: 'Perfect Images',
    icon: 'https://ps.w.org/wp-retina-2x/assets/icon-256x256.png',
    desc: "Retina-ready imagery: manage, optimize and replace every image on your site." },
  { slug: 'wplr-sync', name: 'Photo Engine',
    icon: 'https://ps.w.org/wplr-sync/assets/icon-256x256.png',
    desc: "Organize photos in folders and collections. Sync with Lightroom and speed up your workflow." },
  { slug: 'contact-form-block', name: 'Contact Form Block',
    icon: 'https://ps.w.org/contact-form-block/assets/icon-256x256.png',
    desc: "A simple, fast and efficient contact form. Exactly what you need, nothing more." },
];

// Match either the free slug (e.g. "ai-engine") or the pro variant
// (e.g. "ai-engine-pro"). Returns 'active' | 'inactive' | null.
const getInstallState = (slug, installed) => {
  if (!installed) return null;
  const candidates = [slug, `${slug}-pro`];
  let bestState = null;
  for (const cand of candidates) {
    const state = installed[cand];
    if (state === 'active') return 'active';
    if (state === 'inactive') bestState = 'inactive';
  }
  return bestState;
};

const PluginTile = ({ plugin, installState }) => (
  <StyledPluginTile className={installState ? `is-${installState}` : ''}>
    {installState === 'active' && <span className="tile-status active"><span className="dot" />Installed</span>}
    {installState === 'inactive' && <span className="tile-status inactive"><span className="dot" />Inactive</span>}
    <div className="tile-top">
      <a className="tile-icon" target="_blank" rel="noreferrer" href={`https://wordpress.org/plugins/${plugin.slug}/`}>
        <img src={plugin.icon} alt={plugin.name} />
      </a>
      <div className="tile-body">
        <h3>
          <a target="_blank" rel="noreferrer" href={`https://wordpress.org/plugins/${plugin.slug}/`}>{plugin.name}</a>
        </h3>
        <p className="tile-desc">{plugin.desc}</p>
      </div>
    </div>
    <div className="tile-actions">
      <a className="free" target="_blank" rel="noreferrer" href={`https://wordpress.org/plugins/${plugin.slug}/`}>Free</a>
      <a className="pro" target="_blank" rel="noreferrer" href={`https://meowapps.com/${plugin.slug}/`}>Pro</a>
    </div>
  </StyledPluginTile>
);

const jsxTextPerformance =
  <TabText>
    <NekoTypo p>
      The <b>Empty Request Time</b> measures your installation's basic performance by showing the average time needed to process an empty request on your server. To see how disabling plugins affects the results, turn some off and run the test again. Aim for a time under 2,000 ms, but ideally, keep it below 500 ms. The <b>File Operation Time</b> creates a temporary 10MB file each time it runs. <b>The SQL Request Time</b> calculates the total number of posts. This process should be quick and have a similar duration to the Empty Request Time.
    </NekoTypo>
  </TabText>;

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

const jsxTextRecommendations =
  <>
    <TabText>
      <NekoTypo p>
        Maintain a streamlined WordPress setup by using essential plugins and a dependable hosting provider. Avoid self-hosting unless you really know what you're doing. Want to dig deeper? Have a read:
      </NekoTypo>
    </TabText>
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
  </>;

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

  const handleUpdateOption = (value, id) => {
    updateOptionMutation.mutate({ value, id });
  };

  const handleLoadErrorLogs = () => {
    errorLogsMutation.mutate();
  };

  const jsxHideMeowApps =
    <NekoSettings title="Main Menu">
      <NekoCheckboxGroup max="1">
        <NekoCheckbox name="meowapps_hide_meowapps" label="Hide (Not Recommended)" description={<NekoTypo p>This will hide the Meow Apps Menu (on the left side) and everything it contains. You can re-enable it through though an option that will be added in Settings &rarr; General.</NekoTypo>} value="1" disabled={updateOptionMutation.isPending} checked={hide_meowapps} onChange={handleUpdateOption} />
      </NekoCheckboxGroup>
    </NekoSettings>;

  const jsxForceSSLVerify =
    <NekoSettings title="SSL Verify">
      <NekoCheckboxGroup max="1">
        <NekoCheckbox name="force_sslverify" label="Force (Not Recommended)" description={<NekoTypo p>This will enforce the usage of SSL when checking the license or updating the plugin.</NekoTypo>} value="1" disabled={updateOptionMutation.isPending} checked={force_sslverify} onChange={handleUpdateOption} />
      </NekoCheckboxGroup>
    </NekoSettings>;

  return (
    <NekoPage showRestError={fatalError}>
      <NekoHeader title='The Dashboard' />
      <NekoWrapper>
        <NekoColumn full>
          {jsxIntro}
          <NekoTabs keepTabOnReload={true}>
            <NekoTab title='Meow Apps'>
              <StyledPluginGrid>
                {[...PLUGINS]
                  .map(plugin => ({ plugin, state: getInstallState(plugin.slug, installedPlugins) }))
                  .sort((a, b) => {
                    const order = { active: 0, inactive: 1 };
                    const av = a.state in order ? order[a.state] : 2;
                    const bv = b.state in order ? order[b.state] : 2;
                    return av - bv;
                  })
                  .map(({ plugin, state }) => (
                    <PluginTile key={plugin.slug} plugin={plugin} installState={state} />
                  ))}
              </StyledPluginGrid>
            </NekoTab>
            <NekoTab title="Performance">
              {jsxTextPerformance}
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 25 }}>
                <SpeedTester title="Empty Request Time" request="empty_request" max={2500} />
                <SpeedTester title="File Operation Time" request="file_operation" max={2600} />
                <SpeedTester title="SQL Request Time" request="sql_request" max={2800} />
              </div>
              {jsxTextRecommendations}
            </NekoTab>
            <NekoTab title="PHP Info">
              <StyledPhpInfo dangerouslySetInnerHTML={{ __html: phpInfo }} />
            </NekoTab>
            <NekoTab title="PHP Error Logs">
              <TabText>
                <NekoButton style={{ marginBottom: 10 }} color={'#ccb027'} onClick={handleLoadErrorLogs} disabled={errorLogsMutation.isPending} isBusy={errorLogsMutation.isPending}>
                  Load PHP Error Logs
                </NekoButton>
                <StyledPhpErrorLogs>
                  {(errorLogsMutation.data || []).map(x => <li className={`log-${x.type}`} key={x.id}>
                    <span className='log-type'>{x.type}</span>
                    <span className='log-date'>{x.date}</span>
                    <span className='log-content'>{x.content}</span>
                  </li>)}
                </StyledPhpErrorLogs>
                <NekoTypo p>
                  If you don't see any errors, your host might not allow remote access to PHP error logs. Contact them for assistance, or look in your hosting control panel.
                </NekoTypo>
              </TabText>
            </NekoTab>
            <NekoTab title="Settings">
              <NekoBlock title="Settings" className="primary">
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
