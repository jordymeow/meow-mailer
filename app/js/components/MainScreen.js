const { useState } = wp.element;

import { NekoPage, NekoHeader, NekoWrapper, NekoColumn, NekoTabs, NekoTab, NekoMessage, NekoSpacer } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import LogsScreen from './LogsScreen';
import SettingsScreen from './SettingsScreen';
import LogModal from './LogModal';
import { t } from '@app/i18n';

const MainScreen = () => {
  const { state } = useCoreContext();
  const provider = state.options.provider;

  // Modal state lives at the page root so it survives any re-render inside the tabs.
  const [openLogId, setOpenLogId] = useState(null);
  const [reloadSignal, setReloadSignal] = useState(0);

  // One-time, dismissable feedback invitation (persisted per browser).
  const [feedbackDismissed, setFeedbackDismissed] = useState(() => {
    try { return localStorage.getItem('mwmail_feedback_dismissed') === '1'; } catch (e) { return false; }
  });
  const dismissFeedback = () => {
    try { localStorage.setItem('mwmail_feedback_dismissed', '1'); } catch (e) {}
    setFeedbackDismissed(true);
  };

  // A welcome / status banner at the top, like our other plugins.
  let banner = null;
  if (provider === 'none') {
    banner = { variant: 'info', text: t('Meow Mailer is active but not handling your emails yet. Choose a provider in the Settings tab to route and log them — or pick Offline to log without sending.') };
  } else if (provider === 'offline') {
    banner = { variant: 'warning', text: t('Offline mode: WordPress emails are captured in the log below, but not delivered.') };
  }

  return (
    <NekoPage>
      <NekoHeader title="Meow Mailer" subtitle={t('By Meow Apps')} />
      <NekoWrapper>
        <NekoColumn fullWidth>
          {!feedbackDismissed && <>
            <NekoMessage variant="success">
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span>
                  {t('Meow Mailer is brand new, and your feedback shapes it. Tell us what you need on the')}{' '}
                  <a href="https://wordpress.org/support/plugin/meow-mailer/" target="_blank" rel="noopener noreferrer">{t('WordPress support forum')}</a>
                  {' '}{t('— what is missing, what you wish it did — and we will make it perfect for you. 💕')}
                </span>
                <a href="#" onClick={(e) => { e.preventDefault(); dismissFeedback(); }} style={{ whiteSpace: 'nowrap' }}>{t('Dismiss')}</a>
              </span>
            </NekoMessage>
            <NekoSpacer />
          </>}
          {banner && <><NekoMessage variant={banner.variant}>{banner.text}</NekoMessage><NekoSpacer /></>}
          <NekoTabs keepTabOnReload={true}>
            <NekoTab key="logs" title={t('Logs')}>
              <LogsScreen onView={setOpenLogId} reloadSignal={reloadSignal} />
            </NekoTab>
            <NekoTab key="settings" title={t('Settings')}>
              <SettingsScreen />
            </NekoTab>
          </NekoTabs>
        </NekoColumn>
      </NekoWrapper>

      <LogModal id={openLogId} onClose={() => setOpenLogId(null)}
        onResent={() => setReloadSignal((s) => s + 1)} />
    </NekoPage>
  );
};

export default MainScreen;
