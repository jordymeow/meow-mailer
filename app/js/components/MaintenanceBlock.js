const { useRef, useState } = wp.element;

import { NekoBlock, NekoButton, NekoMessage, NekoSpacer, NekoTypo } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { exportSettings, importSettings, clearLogs } from '@app/requests';
import { download } from '@app/download';
import { t } from '@app/i18n';

const Row = ({ title, description, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--neko-gray-90)' }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--neko-gray-50)', lineHeight: 1.4 }}>{description}</div>
    </div>
    <div style={{ flex: '0 0 auto' }}>{children}</div>
  </div>
);

/**
 * The things you do to the plugin rather than with it: move a configuration between
 * sites, put it back the way it was, empty the log.
 *
 * Emptying the log lives here rather than under the log itself. On the dashboard it
 * sat a few pixels from the filters, so the button that throws away every record you
 * have was one slip away from the one that changes which records you are looking at.
 */
const MaintenanceBlock = ({ onLogsCleared = () => {} }) => {
  const { actions } = useCoreContext();
  const { setOptions, resetOptions, setError } = actions;

  const fileInput = useRef(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const run = async (key, task) => {
    setBusy(key);
    setNotice(null);
    try {
      await task();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const doExport = () => run('export', async () => {
    const data = await exportSettings();
    // Dated, because the first thing you want to know about a config file you find
    // six months later is which one of them it is.
    const day = (data.exported || '').split(' ')[0] || 'export';
    download(`meow-mailer-settings-${day}.json`, JSON.stringify(data, null, 2), 'application/json');
  });

  const doImport = (file) => run('import', async () => {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(t('That file is not valid JSON.'));
    }
    setOptions(await importSettings(parsed));
    setNotice({ variant: 'success', text: t('Settings imported.') });
  });

  const doReset = () => {
    if (!window.confirm(t('Put every setting back to its default? Your provider and its credentials are included. This cannot be undone.'))) {
      return;
    }
    run('reset', async () => {
      await resetOptions();
      setNotice({ variant: 'success', text: t('Settings reset to their defaults.') });
    });
  };

  const doClearLogs = () => {
    if (!window.confirm(t('Delete every entry in the email log? This cannot be undone.'))) {
      return;
    }
    run('logs', async () => {
      await clearLogs();
      onLogsCleared();
      setNotice({ variant: 'success', text: t('The email log is empty.') });
    });
  };

  return (
    <NekoBlock title={t('Maintenance')}
      subtitle={t('Move this configuration to another site, put it back the way it was, or clear out the log.')}>

      {notice && <><NekoMessage variant={notice.variant}>{notice.text}</NekoMessage><NekoSpacer /></>}

      <Row title={t('Export Settings')}
        description={t('Download everything as a JSON file, ready to import on another site.')}>
        <NekoButton className="secondary" icon="download" busy={busy === 'export'} onClick={doExport}>
          {t('Export')}
        </NekoButton>
      </Row>

      <Row title={t('Import Settings')}
        description={t('Read a file exported from Meow Mailer. Whatever it contains replaces what is set here.')}>
        <NekoButton className="secondary" icon="upload" busy={busy === 'import'}
          onClick={() => fileInput.current && fileInput.current.click()}>
          {t('Import')}
        </NekoButton>
        {/* The browser's own file button cannot be styled to match, so it stays out of
            sight and the NekoButton above stands in for it. */}
        <input ref={fileInput} type="file" accept="application/json,.json" style={{ display: 'none' }}
          onChange={(ev) => {
            const file = ev.target.files && ev.target.files[0];
            // Cleared straight away, so choosing the same file twice fires again.
            ev.target.value = '';
            if (file) {
              doImport(file);
            }
          }} />
      </Row>

      <Row title={t('Reset Settings')}
        description={t('Back to a fresh install: no provider, no credentials, every option at its default. The log is left alone.')}>
        <NekoButton className="danger" busy={busy === 'reset'} onClick={doReset}>{t('Reset')}</NekoButton>
      </Row>

      <Row title={t('Delete All Logs')}
        description={t('Empty the email log completely. Your settings are left alone.')}>
        <NekoButton className="danger" busy={busy === 'logs'} onClick={doClearLogs}>{t('Delete All')}</NekoButton>
      </Row>

      <NekoSpacer />
      <NekoTypo p style={{ fontSize: 12, color: 'var(--neko-gray-50)', margin: 0 }}>
        {t('An export holds your provider credentials in plain text, so keep the file somewhere you would keep a password.')}
      </NekoTypo>
    </NekoBlock>
  );
};

export default MaintenanceBlock;
