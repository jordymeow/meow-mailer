const { useRef, useState } = wp.element;

import { NekoBlock, NekoButton, NekoMessage, NekoSpacer, NekoTypo } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { exportSettings, importSettings, clearLogs } from '@app/requests';
import { download } from '@app/download';
import { __ } from '@app/i18n';
import Row from './SettingRow';

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
      throw new Error(__('That file is not valid JSON.', 'meow-mailer'));
    }
    setOptions(await importSettings(parsed));
    setNotice({ variant: 'success', text: __('Settings imported.', 'meow-mailer') });
  });

  const doReset = () => {
    if (!window.confirm(__('Put every setting back to its default? Your provider and its credentials are included. This cannot be undone.', 'meow-mailer'))) {
      return;
    }
    run('reset', async () => {
      await resetOptions();
      setNotice({ variant: 'success', text: __('Settings reset to their defaults.', 'meow-mailer') });
    });
  };

  const doClearLogs = () => {
    if (!window.confirm(__('Delete every entry in the email log? This cannot be undone.', 'meow-mailer'))) {
      return;
    }
    run('logs', async () => {
      await clearLogs();
      onLogsCleared();
      setNotice({ variant: 'success', text: __('The email log is empty.', 'meow-mailer') });
    });
  };

  return (
    <NekoBlock title={__('Maintenance', 'meow-mailer')}
      subtitle={__('Move this configuration to another site, put it back the way it was, or clear out the log.', 'meow-mailer')}>

      {notice && <><NekoMessage variant={notice.variant}>{notice.text}</NekoMessage><NekoSpacer /></>}

      <Row title={__('Export Settings', 'meow-mailer')}
        description={__('Download everything as a JSON file, ready to import on another site.', 'meow-mailer')}>
        <NekoButton className="secondary" icon="download" busy={busy === 'export'} onClick={doExport}>
          {__('Export', 'meow-mailer')}
        </NekoButton>
      </Row>

      <Row title={__('Import Settings', 'meow-mailer')}
        description={__('Read a file exported from Meow Mailer. Whatever it contains replaces what is set here.', 'meow-mailer')}>
        <NekoButton className="secondary" icon="upload" busy={busy === 'import'}
          onClick={() => fileInput.current && fileInput.current.click()}>
          {__('Import', 'meow-mailer')}
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

      <Row title={__('Reset Settings', 'meow-mailer')}
        description={__('Back to a fresh install: no provider, no credentials, every option at its default. The log is left alone.', 'meow-mailer')}>
        <NekoButton className="danger" busy={busy === 'reset'} onClick={doReset}>{__('Reset', 'meow-mailer')}</NekoButton>
      </Row>

      <Row title={__('Delete All Logs', 'meow-mailer')}
        description={__('Empty the email log completely. Your settings are left alone.', 'meow-mailer')}>
        <NekoButton className="danger" busy={busy === 'logs'} onClick={doClearLogs}>{__('Delete All', 'meow-mailer')}</NekoButton>
      </Row>

      <NekoSpacer />
      <NekoTypo p style={{ fontSize: 12, color: 'var(--neko-gray-50)', margin: 0 }}>
        {__('An export holds your provider credentials in plain text, so keep the file somewhere you would keep a password.', 'meow-mailer')}
      </NekoTypo>
    </NekoBlock>
  );
};

export default MaintenanceBlock;
