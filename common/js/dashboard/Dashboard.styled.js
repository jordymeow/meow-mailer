// React & Vendor Libs
import Styled from 'styled-components';

const TabText = Styled.div`
  color: rgba(255, 255, 255, 0.92);
  padding: 18px 20px 8px;
  margin-bottom: -6px;

  a {
    color: #7dedff;
    text-decoration: none;
  }

  p {
    font-size: 13px;
    line-height: 1.55;
    margin: 0;
  }

  p + p {
    margin-top: 6px;
  }
`;

const StyledPluginGrid = Styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 22px;
  padding: 0 4px 6px;

  @media (max-width: 780px) {
    grid-template-columns: 1fr;
  }
`;

const StyledPluginTile = Styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.10) 0%,
    rgba(255, 255, 255, 0.04) 100%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
  transition: transform 0.22s var(--neko-ease-out, ease-out),
              box-shadow 0.22s var(--neko-ease-out, ease-out),
              background 0.22s var(--neko-ease-out, ease-out),
              border-color 0.22s var(--neko-ease-out, ease-out);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at top left, rgba(255, 255, 255, 0.10), transparent 60%);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-2px);
    background: linear-gradient(135deg,
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0.08) 100%);
    border-color: rgba(255, 255, 255, 0.32);
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22),
                0 0 0 1px rgba(255, 255, 255, 0.10) inset;
  }

  .tile-top {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 18px 20px 16px;
    flex: 1 1 auto;
  }

  .tile-icon {
    flex: 0 0 auto;
    display: block;
    width: 88px;
    height: 88px;
    transition: transform 0.25s var(--neko-ease-out, ease-out);

    img {
      width: 100%;
      height: 100%;
      border-radius: 16px;
      object-fit: cover;
      display: block;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
    }
  }

  &:hover .tile-icon {
    transform: scale(1.05) rotate(-2deg);
  }

  .tile-body {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    position: relative;
  }

  .tile-body h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .tile-body h3 a {
    color: white;
    text-decoration: none;
  }

  .tile-body h3 a:hover {
    color: rgba(255, 255, 255, 0.85);
  }

  .tile-status {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 8px 3px 7px;
    border-radius: 999px;
    line-height: 1;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  .tile-status .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08);
  }

  .tile-status.active {
    background: rgba(43, 182, 115, 0.18);
    color: #b6f5d4;
    border: 1px solid rgba(43, 182, 115, 0.42);
  }
  .tile-status.active .dot {
    background: #2bd47d;
    box-shadow: 0 0 0 2px rgba(43, 212, 125, 0.25),
                0 0 8px rgba(43, 212, 125, 0.6);
  }

  .tile-status.inactive {
    background: rgba(255, 255, 255, 0.10);
    color: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.22);
  }
  .tile-status.inactive .dot {
    background: rgba(255, 255, 255, 0.55);
  }

  &.is-active {
    border-color: rgba(43, 182, 115, 0.32);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14),
                0 0 0 1px rgba(43, 182, 115, 0.18) inset;
  }
  &.is-active:hover {
    border-color: rgba(43, 182, 115, 0.5);
  }

  .tile-desc {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.78);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .tile-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-top: 1px solid rgba(255, 255, 255, 0.14);
    position: relative;
    z-index: 1;
  }

  .tile-actions a {
    padding: 11px 12px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    transition: background 0.15s var(--neko-ease-out, ease-out),
                color 0.15s var(--neko-ease-out, ease-out);
  }

  .tile-actions a.free {
    color: #b6f5d4;
    border-right: 1px solid rgba(255, 255, 255, 0.14);
  }

  .tile-actions a.free:hover {
    background: rgba(43, 182, 115, 0.20);
    color: white;
  }

  .tile-actions a.pro {
    color: #ffd98a;
  }

  .tile-actions a.pro:hover {
    background: rgba(255, 184, 60, 0.20);
    color: white;
  }
`;

const StyledArticleGrid = Styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
  margin: 18px 4px 6px;
`;

const StyledArticleCard = Styled.a`
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.10) 0%,
    rgba(255, 255, 255, 0.04) 100%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  text-decoration: none;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s var(--neko-ease-out, ease-out),
              box-shadow 0.2s var(--neko-ease-out, ease-out),
              background 0.2s var(--neko-ease-out, ease-out),
              border-color 0.2s var(--neko-ease-out, ease-out);
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    background: linear-gradient(135deg,
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0.08) 100%);
    border-color: rgba(255, 255, 255, 0.32);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.20);
  }

  .article-emoji {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.10);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }

  .article-body {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .article-title {
    color: white;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .article-blurb {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    line-height: 1.4;
  }

  .article-arrow {
    flex: 0 0 auto;
    color: rgba(255, 255, 255, 0.55);
    font-size: 18px;
    transition: transform 0.22s var(--neko-ease-out, ease-out),
                color 0.22s var(--neko-ease-out, ease-out);
  }

  &:hover .article-arrow {
    transform: translateX(3px);
    color: white;
  }
`;

const StyledPhpInfo = Styled.div`

  margin: 15px;

  .center {
    background: white;
    color: black;
    border-radius: 10px;
    padding: 10px;
    max-width: 100%
    overflow: none;

    h2 {
      font-size: 26px;
    }

    table {
      width: 100%;

      tr td:first-child {
        width: 220px;
        font-weight: bold;
        color: #1e7cba;
      }

      * {
        overflow-wrap: anywhere;
      }
    }
  }

  hr {
    border-color: #1e7cba;
  }
`;

const StyledPhpErrorLogs = Styled.ul`
  margin-top: 10px;
  background: rgb(0, 72, 88);
  padding: 10px;
  color: rgb(58, 212, 58);
  max-height: 600px;
  min-height: 200px;
  display: block;
  font-family: monospace;
  font-size: 12px;
  white-space: pre;
  overflow-x: auto;
  width: calc(100vw - 276px);
  color: white;

  .log-date {
    color: var(--neko-yellow);
    margin-left: 8px;
  }

  .log-type {
    background: #0000004d;
    padding: 2px 5px;
    border-radius: 8px;
    text-transform: uppercase;
  }

  .log-content {
    display: block;
  }

  .log-warning .log-type {
    background: var(--neko-yellow);
    color: white;
  }

  .log-fatal .log-type {
    background: var(--neko-red);
    color: white;
  }
`;

export { TabText, StyledPluginGrid, StyledPluginTile,
  StyledArticleGrid, StyledArticleCard,
  StyledPhpInfo, StyledPhpErrorLogs };