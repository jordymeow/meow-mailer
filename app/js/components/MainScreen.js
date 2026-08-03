const { useState } = wp.element;

import { NekoPage, NekoHeader, NekoWrapper, NekoColumn, NekoButton, NekoMessage, NekoSpacer } from '@neko-ui';

import DashboardScreen from './DashboardScreen';
import LogsScreen from './LogsScreen';
import SettingsScreen from './SettingsScreen';
import LogModal from './LogModal';
import ErrorModal from './ErrorModal';
import StatusBar from './StatusBar';
import FilterBar, { DEFAULT_FILTERS } from './FilterBar';
import { wrapperTop, wrapperBody } from '@app/layout';
import { t } from '@app/i18n';

const PAGES = {
  dashboard: { label: t('Dashboard'), icon: 'dashboard' },
  settings:  { label: t('Settings'),  icon: 'cog' },
};

// The screen is chosen in the header, but the URL still carries it so links from
// our admin notices and the OAuth redirect keep working. Older links point at
// `nekoTab=logs`, which no longer exists as a screen of its own: they fall through
// to the dashboard, where the log now lives anyway.
const pageFromUrl = () => {
  const wanted = new URLSearchParams(window.location.search).get('nekoTab');
  return PAGES[wanted] ? wanted : 'dashboard';
};

const HeaderActions = ({ page, onNavigate }) => (
  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
    {Object.entries(PAGES).map(([key, { label, icon }]) => (
      // The active screen keeps the hover surface so it reads as selected.
      <NekoButton key={key} className="header" icon={icon} onClick={() => onNavigate(key)}
        style={key === page ? { background: 'rgba(255, 255, 255, 0.24)' } : null}>
        {label}
      </NekoButton>
    ))}
  </div>
);

const MainScreen = () => {
  const [page, setPage] = useState(pageFromUrl);

  // Modal state lives at the page root so it survives any re-render below.
  const [openLogId, setOpenLogId] = useState(null);
  const [errorLog, setErrorLog] = useState(null);
  const [reloadSignal, setReloadSignal] = useState(0);
  const bumpReload = () => setReloadSignal((s) => s + 1);

  // The dashboard's filters live here, above both columns, because they narrow both.
  // MainScreen never unmounts, so switching to Settings and back keeps them.
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // One-time, dismissable feedback invitation (persisted per browser).
  const [feedbackDismissed, setFeedbackDismissed] = useState(() => {
    try { return localStorage.getItem('mwmail_feedback_dismissed') === '1'; } catch (e) { return false; }
  });
  const dismissFeedback = () => {
    try { localStorage.setItem('mwmail_feedback_dismissed', '1'); } catch (e) {}
    setFeedbackDismissed(true);
  };

  const navigate = (next) => {
    setPage(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('nekoTab', next);
      window.history.replaceState({}, '', url);
    } catch (e) {}
  };

  return (
    <NekoPage>
      <NekoHeader title="Meow Mailer" section={PAGES[page].label} subtitle={t('By Meow Apps')}>
        <HeaderActions page={page} onNavigate={navigate} />
      </NekoHeader>

      <NekoWrapper style={wrapperTop}>
        <NekoColumn minimal fullWidth>
          {!feedbackDismissed && <>
            <NekoMessage variant="success">
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span>
                  {t('Meow Mailer is brand new, and your feedback shapes it. Tell us what is missing and what you wish it did on the')}{' '}
                  <a href="https://wordpress.org/support/plugin/meow-mailer/" target="_blank" rel="noopener noreferrer">{t('WordPress support forum')}</a>
                  {t('. We will make it perfect for you. 💕')}
                </span>
                <a href="#" onClick={(e) => { e.preventDefault(); dismissFeedback(); }} style={{ whiteSpace: 'nowrap' }}>{t('Dismiss')}</a>
              </span>
            </NekoMessage>
            <NekoSpacer />
          </>}

          <StatusBar pulse={reloadSignal} />
          {page === 'dashboard' && <>
            <NekoSpacer />
            <FilterBar filters={filters} onChange={setFilters} />
          </>}
          <NekoSpacer />
        </NekoColumn>
      </NekoWrapper>

      {/* The statistics summarize the log, so they share one screen — and one set of
          filters, applied above. The log takes the wider column because its table has
          six columns to fit; the numbers and the chart read fine in a narrower one. */}
      {page === 'dashboard' && (
        <NekoWrapper style={wrapperBody}>
          <NekoColumn minimal size="3/4">
            <LogsScreen filters={filters} onClearFilters={() => setFilters(DEFAULT_FILTERS)}
              onView={setOpenLogId} onExplainError={setErrorLog}
              reloadSignal={reloadSignal} onChanged={bumpReload} />
          </NekoColumn>
          <NekoColumn minimal size="1/4">
            <DashboardScreen filters={filters} reloadSignal={reloadSignal} />
          </NekoColumn>
        </NekoWrapper>
      )}
      {page === 'settings' && <SettingsScreen onChanged={bumpReload} />}

      <LogModal id={openLogId} onClose={() => setOpenLogId(null)} onResent={bumpReload} />
      <ErrorModal log={errorLog} onClose={() => setErrorLog(null)} />
    </NekoPage>
  );
};

export default MainScreen;
