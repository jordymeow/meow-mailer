const { useState, useEffect, useRef } = wp.element;

import { NekoBlock, NekoButton, NekoMessage, NekoSpacer, NekoTypo } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { fetchSecurity, setEncryption } from '@app/requests';
import { security as initialSecurity } from '@app/settings';
import { getProvider } from '@app/providers';
import { __ } from '@app/i18n';
import Row from './SettingRow';

// "Generic SMTP: Password, Mailgun: API Key", from the provider => fields map the
// server reports, so the warning names what the user knows rather than option keys.
const describeFields = (byProvider) => Object.entries(byProvider || {}).map(([key, fields]) => {
  const provider = getProvider(key) || { label: key, fields: [] };
  const names = Object.keys(fields).map((f) => {
    const field = (provider.fields || []).find((x) => x.name === f);
    return field ? field.label : f;
  });
  return `${provider.label}: ${names.join(', ')}`;
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
      && !window.confirm(__('Some stored credentials cannot be read anymore, so there is no plain text to put back. They will be cleared and you will need to enter them again. Continue?', 'meow-mailer'))) {
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
        setNotice({ variant: 'success', text: __('Your credentials are now stored encrypted.', 'meow-mailer') });
      } else if (cleared) {
        setNotice({ variant: 'warning', text: `${__('Encryption is off. These credentials could not be read and were cleared, so enter them again:', 'meow-mailer')} ${cleared}.` });
      } else {
        setNotice({ variant: 'success', text: __('Encryption is off. Your credentials are stored in plain text again.', 'meow-mailer') });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const constants = constantsFor(options.provider);

  return (
    <NekoBlock title={__('Security', 'meow-mailer')}
      subtitle={__('How the passwords and API keys you enter above are kept.', 'meow-mailer')}>

      {notice && <><NekoMessage variant={notice.variant}>{notice.text}</NekoMessage><NekoSpacer /></>}

      {hasUnreadable && (
        <>
          <NekoMessage variant="danger">
            <b>{__('These credentials cannot be read anymore:', 'meow-mailer')}</b> {describeFields(unreadable)}.{' '}
            {keyChanged
              ? __('They were encrypted with security keys this site no longer has, which happens after a migration, a restore onto another site, or a security plugin rotating the keys. Email through these providers fails until you enter them again in Email Provider above.', 'meow-mailer')
              : __('The stored values are damaged and cannot be decrypted. Email through these providers fails until you enter them again in Email Provider above.', 'meow-mailer')}
          </NekoMessage>
          <NekoSpacer />
        </>
      )}

      <Row title={__('Encrypt Credentials', 'meow-mailer')}
        description={security.enabled
          ? __('On. Passwords and API keys are stored encrypted in the database.', 'meow-mailer')
          : __('Off. Passwords and API keys are stored as plain text in the database, the way WordPress stores its own settings.', 'meow-mailer')}>
        <NekoButton className={security.enabled ? 'secondary' : 'primary'} busy={busy}
          disabled={!security.enabled && !!security.blocker}
          onClick={() => toggle(!security.enabled)}>
          {security.enabled ? __('Disable Encryption', 'meow-mailer') : __('Enable Encryption', 'meow-mailer')}
        </NekoButton>
      </Row>

      {!security.enabled && !!security.blocker && (
        <>
          <NekoSpacer />
          <NekoMessage variant="warning">{__('Encryption cannot be enabled on this site.', 'meow-mailer')} {security.blocker}</NekoMessage>
        </>
      )}

      <NekoSpacer />
      <NekoTypo p style={small}>
        {security.custom_key
          ? __('The key comes from MWMAIL_ENCRYPTION_KEY in your wp-config.php.', 'meow-mailer')
          : __('The key comes from the security keys in your wp-config.php.', 'meow-mailer')}{' '}
        {__('This protects against a copy of the database being read: a backup, a dump, a staging clone, a support export. It does not protect against someone who can read your files, since the keys are there too.', 'meow-mailer')}{' '}
        <b>{__('If those keys change, after a migration, a restore onto another site, or a security plugin rotating them, the stored credentials cannot be read anymore and email stops until you enter them again.', 'meow-mailer')}</b>{' '}
        {__('Export your settings before moving a site, or define MWMAIL_ENCRYPTION_KEY in wp-config.php to pin a key that survives rotation.', 'meow-mailer')}
      </NekoTypo>

      <NekoSpacer />
      <Row title={__('Keep Them Out of the Database', 'meow-mailer')}
        description={constants.length
          ? <>{__('Define them as constants in wp-config.php and they are never stored at all. For your current provider:', 'meow-mailer')} <code>{constants.join(', ')}</code></>
          : __('Define them as constants in wp-config.php and they are never stored at all. Pick a provider above to see the names to use.', 'meow-mailer')} />
    </NekoBlock>
  );
};

export default SecurityBlock;
