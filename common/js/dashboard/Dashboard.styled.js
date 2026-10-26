// The few styled pieces the dashboard tabs share beyond ui.js: the settings action row, and the two
// raw views (error log, phpinfo), white like everything else (Jordy: no more blue panels).
import Styled from 'styled-components';
import { MUTED, LINE } from './ui';

const StyledSettingAction = Styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  /* Named, not a bare "span": NekoButton puts its label in a span of its own. */
  .action-note {
    font-size: 12px;
    line-height: 1.5;
    color: ${MUTED};
  }
`;

const LOG_TONES = {
  fatal: '#d64545',
  parse: '#d9622b',
  exception: '#d9622b',
  warning: '#d4881a',
  notice: '#3b82c4',
};

const logTone = ( type ) => LOG_TONES[type] || '#7a8496';

const StyledErrorLogs = Styled.div`
  .logs-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 0 0 12px;
  }

  .logs-filters { display: flex; gap: 6px; flex-wrap: wrap; }

  .logs-filters button {
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid ${LINE};
    background: white;
    color: var(--neko-font-color);
    cursor: pointer;

    b { margin-left: 4px; color: var(--tone, ${MUTED}); }
    &.is-on { border-color: var(--neko-main-color); background: #eef3fd; }
  }

  .logs-meta { margin-left: auto; font-size: 12px; color: ${MUTED}; }

  .logs-console {
    max-height: 520px;
    overflow: auto;
    border: 1px solid ${LINE};
    border-radius: 10px;
  }

  .log-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 14px;
    border-left: 3px solid var(--tone);

    & + .log-row { border-top: 1px solid ${LINE}; }
  }

  .log-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
    color: ${MUTED};
  }

  .log-type {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 4px;
    color: white;
    background: var(--tone);
  }

  .log-owner { font-weight: 600; color: var(--neko-font-color); }
  .log-count { font-weight: 600; }

  .log-content {
    font-size: 13px;
    line-height: 1.5;
    color: var(--neko-font-color);
    overflow-wrap: anywhere;
  }

  .logs-blank {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 32px 20px;
    text-align: center;
    color: ${MUTED};

    svg { color: #1f9d5c; }
    &.is-failed svg { color: #d4881a; }
    strong { font-size: 15px; color: var(--neko-font-color); }
    span { max-width: 520px; font-size: 13px; line-height: 1.5; }
  }
`;

const StyledPhpInfo = Styled.div`
  .php-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 0 12px;

    .php-search { flex: 0 1 320px; }
    .php-count { font-size: 12px; color: ${MUTED}; }
  }

  .php-body {
    max-height: 520px;
    overflow: auto;
    border: 1px solid ${LINE};
    border-radius: 10px;
    padding: 4px 14px 14px;
    font-size: 13px;
    color: var(--neko-font-color);

    h1 { font-size: 16px; margin: 12px 0 6px; }
    h2 { font-size: 13px; margin: 18px 0 6px; color: var(--neko-main-color); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { text-align: left; font-size: 11px; color: ${MUTED}; padding: 6px 8px; }
    td { padding: 6px 8px; border-top: 1px solid ${LINE}; vertical-align: top; overflow-wrap: anywhere; }
    td.e { width: 34%; font-weight: 600; }
    td.v { color: ${MUTED}; }
    hr { display: none; }
  }

  .php-blank {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 24px 20px;
    text-align: center;
    color: ${MUTED};
    font-size: 13px;

    &.is-empty svg { color: #d4881a; }
    strong { font-size: 15px; color: var(--neko-font-color); }
  }
`;

export { StyledSettingAction, StyledErrorLogs, StyledPhpInfo, logTone };
