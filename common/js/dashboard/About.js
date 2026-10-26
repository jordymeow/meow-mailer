// The About tab: who makes these plugins, every Meow plugin in one place, and a few guides worth
// reading. Not on Home: it is the same every visit, so it waits here for whoever is curious.

import React from 'react';
import Styled from 'styled-components';
import { PLUGINS, proUrl } from './plugins';
import { StyledPanel, MUTED, LINE } from './ui';

const ARTICLES = [
  { emoji: '🔍', title: 'SEO checklist', blurb: 'Make your content findable on Google and AI assistants.',
    href: 'https://meowapps.com/tutorial-improve-seo-wordpress/' },
  { emoji: '⚡️', title: 'A faster WordPress', blurb: 'Practical tips that actually make a difference.',
    href: 'https://meowapps.com/tutorial-faster-wordpress-optimize/' },
  { emoji: '🖼️', title: 'Lighter images', blurb: 'CDN, formats and sizes: faster pages, happier visitors.',
    href: 'https://meowapps.com/tutorial-optimize-images-wordpress/' },
  { emoji: '🏠', title: 'Choosing a host', blurb: 'Pick one that will not hold your site back.',
    href: 'https://meowapps.com/tutorial-hosting-service-wordpress/' },
];

const LINKS = [
  { label: 'meowapps.com', href: 'https://meowapps.com' },
  { label: 'YouTube', href: 'https://www.youtube.com/@MeowApps' },
  { label: 'X', href: 'https://x.com/meowappscom' },
  { label: 'Instagram', href: 'https://www.instagram.com/meowappscom' },
  { label: 'Contact', href: 'https://meowapps.com/contact/' },
];

const StyledAbout = Styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;

  .story {
    padding: 4px 18px 18px;
    font-size: 15px;
    line-height: 1.6;
    color: var(--neko-font-color);

    p { margin: 0 0 12px; max-width: 760px; }
    a { color: var(--neko-main-color); }
    .links { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 14px; font-weight: 600; }
  }

  .grid {
    display: grid;
    /* Two columns: 14 plugins and 4 guides both fill every row, no lonely item at the end. */
    grid-template-columns: repeat(2, minmax(0, 1fr));
    @media (max-width: 700px) { grid-template-columns: 1fr; }
    border-top: 1px solid ${LINE};
  }

  .item {
    display: flex;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid ${LINE};
    text-decoration: none;
    color: var(--neko-font-color);

    img { width: 36px; height: 36px; border-radius: 9px; flex: none; }
    b { display: block; font-size: 14px; }
    span { display: block; font-size: 13px; line-height: 1.4; color: ${MUTED}; }
    .emoji { font-size: 26px; line-height: 36px; width: 36px; text-align: center; flex: none; }
    &:hover b { color: var(--neko-main-color); }
  }
`;

const About = () => (
  <StyledAbout>
    <StyledPanel>
      <div className="panel-title">Hello from Meow Apps</div>
      <div className="story">
        <p>
          Hi! ☀️ Meow Apps isn't your typical plugin suite. It's a passion project led by me,
          {' '}<a href="https://jordymeow.com" target="_blank" rel="noreferrer">Jordy Meow</a>, and a stellar team. 💕
          {' '}Based in <a href="https://offbeatjapan.com" target="_blank" rel="noreferrer">Japan</a>, we focus on making
          your WordPress experience smoother, faster, and more enjoyable.
        </p>
        <div className="links">
          {LINKS.map( link => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a> )}
        </div>
      </div>
    </StyledPanel>

    <StyledPanel>
      <div className="panel-title">All our plugins</div>
      <div className="grid">
        {Object.entries( PLUGINS ).map( ( [slug, plugin] ) => (
          <a key={slug} className="item" href={proUrl( slug )} target="_blank" rel="noreferrer">
            <img src={plugin.icon} alt="" />
            <div><b>{plugin.name}</b><span>{plugin.desc}</span></div>
          </a>
        ) )}
      </div>
    </StyledPanel>

    <StyledPanel>
      <div className="panel-title">Worth a read</div>
      <div className="grid">
        {ARTICLES.map( article => (
          <a key={article.href} className="item" href={article.href} target="_blank" rel="noreferrer">
            <span className="emoji">{article.emoji}</span>
            <div><b>{article.title}</b><span>{article.blurb}</span></div>
          </a>
        ) )}
      </div>
    </StyledPanel>
  </StyledAbout>
);

export { About };
