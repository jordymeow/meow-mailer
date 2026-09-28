const { useState, useEffect, useRef } = wp.element;

import { NekoBlock, NekoButton, NekoMessage, NekoSpacer, NekoTypo } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { fetchSecurity, setEncryption } from '@app/requests';
import { security as initialSecurity } from '@app/settings';
import { getProvider } from '@app/providers';
import { t } from '@app/i18n';
import Row from './SettingRow';

// "Generic SMTP: Password, Mailgun: API Key", from the provider => fields map the
// server reports, so the warning names what the user knows rather than option keys.
const describeFields = (byProvider) => Object.entries(byProvider || {}).map(([key, fields]) => {
  const provider = getProvider(key) || { label: key, fields: [] };
  const names = Object.keys(fields).map((f) => {
    const field = (provider.fields || []).find((x) => x.name === f);
    return field ? t(field.label) : f;
  });
  return `${t(provider.label)}: ${names.join(', ')}`;
}).join('. ');

// The wp-config constants that would keep the current provider's secrets out of the
// database altogether, e.g. MWMAIL_SMTP_PASSWORD.
const constantsFor = (providerKey) => {
  const provider = getProvider(providerKey);
  if (!provider || !provider.fields) {
    return [];
  }
  return provider.fields.filter((f) => f.type === 'password' || f.type === 'pem')
    .map((f) => `MWMAIL_${providerKey}_${f.name}`.toUpperCase());
};

const small = { fontSize: 12, color: 'var(--neko-gray-50)', lineHeight: 1.5, margin: 0 };

/**
 * Where the stored credentials are protected, and how. Off by default and on by a
 * deliberate click, because encryption keyed on the wp-config security keys stops
 * mail the day those keys change, and that is a trade only the site owner can make.
 */
const SecurityBlock = () => {
  const { state, actions } = useCoreContext();
  const { options } = state;
  const { setOptions, setError } = actions;

  const [security, setSecurity] = useState(initialSecurity);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // A secret typed again over an unreadable one is readable from then on, so the
  // warning has to follow the saved options rather than the page load.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    fetchSecurity().then(setSecurity).catch(() => {});
  }, [options.providers]);

  const unreadable = security.unreadable || {};
  const hasUnreadable = Object.keys(unreadable).length > 0;
  const keyChanged = Object.values(unreadable).some((fields) => Object.values(fields).includes('key'));

  const toggle = async (enabled) => {
    if (!enabled && hasUnreadable
      && !window.confirm(t('Some stored credentials cannot be read anymore, so there is no plain text to put back. They will be cleared and you will need to enter them again. Continue?'))) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await setEncryption(enabled);
      setSecurity(res.security);
      setOptions(res.options);
      const cleared = describeFields(res.cleared);
      if (enabled) {
        setNotice({ variant: 'success', text: t('Your credentials are now stored encrypted.') });
      } else if (cleared) {
        setNotice({ variant: 'warning', text: `${t('Encryption is off. These credentials could not be read and were cleared, so enter them again:')} ${cleared}.` });
      } else {
        setNotice({ variant: 'success', text: t('Encryption is off. Your credentials are stored in plain text again.') });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const constants = constantsFor(options.provider);

  return (
    <NekoBlock title={t('Security')}
      subtitle={t('How the passwords and API keys you enter above are kept.')}>

      {notice && <><NekoMessage variant={notice.variant}>{notice.text}</NekoMessage><NekoSpacer /></>}

      {hasUnreadable && (
        <>
          <NekoMessage variant="danger">
            <b>{t('These credentials cannot be read anymore:')}</b> {describeFields(unreadable)}.{' '}
            {keyChanged
              ? t('They were encrypted with security keys this site no longer has, which happens after a migration, a restore onto another site, or a security plugin rotating the keys. Email through these providers fails until you enter them again in Email Provider above.')
              : t('The stored values are damaged and cannot be decrypted. Email through these providers fails until you enter them again in Email Provider above.')}
          </NekoMessage>
          <NekoSpacer />
        </>
      )}

      <Row title={t('Encrypt Credentials')}
        description={security.enabled
          ? t('On. Passwords and API keys are stored encrypted in the database.')
          : t('Off. Passwords and API keys are stored as plain text in the database, the way WordPress stores its own settings.')}>
        <NekoButton className={security.enabled ? 'secondary' : 'primary'} busy={busy}
          disabled={!security.enabled && !!security.blocker}
          onClick={() => toggle(!security.enabled)}>
          {security.enabled ? t('Disable Encryption') : t('Enable Encryption')}
        </NekoButton>
      </Row>

      {!security.enabled && !!security.blocker && (
        <>
          <NekoSpacer />
          <NekoMessage variant="warning">{t('Encryption cannot be enabled on this site.')} {security.blocker}</NekoMessage>
        </>
      )}

      <NekoSpacer />
      <NekoTypo p style={small}>
        {security.custom_key
          ? t('The key comes from MWMAIL_ENCRYPTION_KEY in your wp-config.php.')
          : t('The key comes from the security keys in your wp-config.php.')}{' '}
        {t('This protects against a copy of the database being read: a backup, a dump, a staging clone, a support export. It does not protect against someone who can read your files, since the keys are there too.')}{' '}
        <b>{t('If those keys change, after a migration, a restore onto another site, or a security plugin rotating them, the stored credentials cannot be read anymore and email stops until you enter them again.')}</b>{' '}
        {t('Export your settings before moving a site, or define MWMAIL_ENCRYPTION_KEY in wp-config.php to pin a key that survives rotation.')}
      </NekoTypo>

      <NekoSpacer />
      <Row title={t('Keep Them Out of the Database')}
        description={constants.length
          ? <>{t('Define them as constants in wp-config.php and they are never stored at all. For your current provider:')} <code>{constants.join(', ')}</code></>
          : t('Define them as constants in wp-config.php and they are never stored at all. Pick a provider above to see the names to use.')} />
    </NekoBlock>
  );
};

export default SecurityBlock;
