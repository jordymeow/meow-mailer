const { useState } = wp.element;

import { NekoSettings, NekoInput, NekoSelect, NekoOption, NekoSwitch, NekoButton, NekoStatus, NekoMessage, NekoSpacer } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { getProvider } from '@app/providers';
import { getOAuthUrl, disconnectOAuth } from '@app/requests';
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
      case 'password':
        return <NekoInput type="password" name={field.name} value={value ?? ''} placeholder={field.placeholder} onBlur={onChange} onEnter={onChange} />;
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

  if (provider.fields.length === 0 && !provider.oauth) {
    return (
      <>
        <NekoSpacer />
        <NekoMessage variant="info">{t(provider.description)}</NekoMessage>
      </>
    );
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
