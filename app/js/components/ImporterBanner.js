const { useState } = wp.element;

import { NekoMessage, NekoButton, NekoSpacer } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { importer, network } from '@app/settings';
import { importFromPlugin } from '@app/requests';
import { PROVIDER_LABELS } from '@app/providers';
import { t } from '@app/i18n';

// On a network where the provider is shared, this site cannot take one over.
const canImport = (network.can_edit || {}).provider !== false;

/**
 * Another mail plugin is already configured on this site, and Meow Mailer is
 * not: offer to copy its settings over instead of making the admin re-enter
 * their credentials. Detection happened server-side at page load; all we hold
 * here is the plugin's name and which provider it uses, never its secrets.
 */
const ImporterBanner = ({ onImported = () => {} }) => {
  const { state, actions } = useCoreContext();
  const { options } = state;

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { source, warnings } after a successful import
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('mwmail_importer_dismissed') === '1'; } catch (e) { return false; }
  });

  const dismiss = () => {
    try { localStorage.setItem('mwmail_importer_dismissed', '1'); } catch (e) {}
    setDismissed(true);
  };

  const runImport = async (source) => {
    setBusy(true);
    setError(null);
    try {
      const res = await importFromPlugin(source.source);
      actions.setOptions(res.options);
      setDone({ source, warnings: res.warnings || [] });
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // The success message survives the banner's own condition (the provider is no
  // longer 'none'), so the admin gets told what happened and what to do next.
  if (done) {
    return (<>
      <NekoMessage variant="success">
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>
            {t('The settings of %s were imported. Review them below, then send yourself a test email to confirm everything works.').replace('%s', done.source.name)}
            {done.warnings.map((w, i) => <span key={i}> {w}</span>)}
            {done.source.active && <> {t('Once the test arrives, you can deactivate %s: Meow Mailer is handling your email now.').replace('%s', done.source.name)}</>}
          </span>
          <a href="#" onClick={(e) => { e.preventDefault(); setDone(null); }} style={{ whiteSpace: 'nowrap' }}>{t('Dismiss')}</a>
        </span>
      </NekoMessage>
      <NekoSpacer />
    </>);
  }

  // Only a first run is worth interrupting: once a provider is chosen here, the
  // other plugin's settings are history, not a suggestion.
  const show = canImport && !dismissed && options.provider === 'none' && importer.length > 0;
  if (!show) {
    return null;
  }

  return (<>
    <NekoMessage variant="info">
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span>
          {importer.length === 1
            ? t('%1$s is already set up on this site, using %2$s. Meow Mailer can copy its settings so you do not have to enter them again.')
              .replace('%1$s', importer[0].name)
              .replace('%2$s', t(PROVIDER_LABELS[importer[0].provider] || importer[0].provider))
            : t('Another mail plugin is already set up on this site. Meow Mailer can copy its settings so you do not have to enter them again.')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          {importer.map((source) => (
            <NekoButton key={source.source} className="primary" icon="download" disabled={busy} onClick={() => runImport(source)}>
              {t('Import from %s').replace('%s', source.name)}
            </NekoButton>
          ))}
          <a href="#" onClick={(e) => { e.preventDefault(); dismiss(); }}>{t('Dismiss')}</a>
        </span>
      </span>
    </NekoMessage>
    {error && <><NekoSpacer /><NekoMessage variant="danger">{error}</NekoMessage></>}
    <NekoSpacer />
  </>);
};

export default ImporterBanner;
