const { useState } = wp.element;

import { NekoSettings, NekoInput, NekoSelect, NekoOption, NekoSwitch, NekoButton, NekoStatus, NekoMessage, NekoSpacer } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { getProvider } from '@app/providers';
import { getOAuthUrl, disconnectOAuth } from '@app/requests';
import { secretMask as SECRET_MASK } from '@app/settings';
import { t } from '@app/i18n';

const Field = ({ field, value, onChange }) => {
  const control = () => {
    switch (field.type) {
      case 'select':
        return (
          <NekoSelect scrolldown name={field.name} value={value ?? ''} onChange={onChange}>
            {field.options.map((o) => <NekoOption key={o.value} value={o.value} label={t(o.label)} />)}
          </NekoSelect>
        );
      case 'switch':
        return <NekoSwitch name={field.name} checked={!!value} onChange={onChange} onValue={true} offValue={false} />;
      case 'number':
        return <NekoInput type="number" name={field.name} value={value ?? ''} placeholder={field.placeholder} onBlur={onChange} onEnter={onChange} />;
      case 'password': {
        // A stored secret is never sent to the browser: what sits in this field is
        // the mask, a literal row of bullets. NekoInput's reveal button would
        // faithfully uncover those bullets and look broken, so a saved secret shows
        // a padlock instead (any icon suppresses the toggle). Type a new value and
        // it behaves like a normal password field again.
        const saved = value === SECRET_MASK;
        return <NekoInput type="password" name={field.name} value={value ?? ''} placeholder={field.placeholder}
          onBlur={onChange} onEnter={onChange}
          iconFilled={saved ? 'lock' : undefined}
          description={saved ? t('Saved. It is never sent back to your browser, so it cannot be shown here. Type a new one to replace it.') : undefined} />;
      }
      default:
        return <NekoInput name={field.name} value={value ?? ''} placeholder={field.placeholder} onBlur={onChange} onEnter={onChange} />;
    }
  };
  return <NekoSettings title={t(field.label)}>{control()}</NekoSettings>;
};

const OAuthConnect = ({ provider }) => {
  const { state, actions } = useCoreContext();
  const { setOptions, setError } = actions;
  const [busy, setBusy] = useState(false);
  const creds = state.options.providers[provider.key] || {};
  const connected = !!creds.refresh_token;

  const connect = async () => {
    setBusy(true);
    try {
      const res = await getOAuthUrl(provider.oauth);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        setError(res.message || t('Could not start authorization.'));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setOptions(await disconnectOAuth(provider.oauth));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <NekoSpacer />
      <NekoMessage variant="info">
        {t(provider.oauthHelp)}
        {provider.oauthConsole && <>
          {' '}<a href={provider.oauthConsole(creds)} target="_blank" rel="noopener noreferrer">{t('Open the console')}</a>
        </>}
        <br /><code>{window.mwmail.oauth_redirect_uri}</code>
      </NekoMessage>
      <NekoSpacer />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {connected
          ? <><NekoStatus status="ok">{t('Connected')}</NekoStatus>
              <NekoButton className="danger" disabled={busy} onClick={disconnect}>{t('Disconnect')}</NekoButton></>
          : <NekoButton className="primary" icon="key" disabled={busy} onClick={connect}>{t(provider.oauthLabel)}</NekoButton>}
      </div>
    </>
  );
};

const ProviderFields = ({ providerKey }) => {
  const { state, actions } = useCoreContext();
  const provider = getProvider(providerKey);
  if (!provider) {
    return null;
  }
  const creds = state.options.providers[providerKey] || {};

  // 'none' and 'offline' have nothing to configure. The status bar at the top of
  // the page already says what each one does, so there is nothing to add here.
  if (provider.fields.length === 0 && !provider.oauth) {
    return null;
  }

  return (
    <>
      {provider.fields.map((field) => (
        <Field
          key={field.name}
          field={field}
          value={creds[field.name]}
          onChange={(value) => actions.updateProviderOption(value, field.name, providerKey)}
        />
      ))}
      {provider.oauth && <OAuthConnect provider={provider} />}
    </>
  );
};

export default ProviderFields;
