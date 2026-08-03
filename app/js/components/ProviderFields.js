const { useState } = wp.element;

import { NekoSettings, NekoInput, NekoSelect, NekoOption, NekoSwitch, NekoButton, NekoStatus, NekoMessage, NekoSpacer } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { getProvider } from '@app/providers';
import { getOAuthUrl, disconnectOAuth, revealSecret } from '@app/requests';
import { secretMask as SECRET_MASK } from '@app/settings';
import { t } from '@app/i18n';

const Field = ({ field, value, providerKey, onChange }) => {
  const { actions } = useCoreContext();

  // What the eye uncovered, or null while it is still hidden. A saved secret is not
  // in the settings payload, so revealing it means asking the server for that one
  // field rather than toggling an input that only holds a row of bullets.
  const [revealed, setRevealed] = useState(null);

  const reveal = async () => {
    try {
      setRevealed(await revealSecret(providerKey, field.name));
    } catch (err) {
      actions.setError(err.message);
    }
  };

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
        // What sits in this field for a saved secret is the mask, a literal row of
        // bullets, so NekoInput's own toggle would faithfully uncover those and look
        // broken. Supplying an icon suppresses that toggle and lets the eye do the
        // real thing: fetch the value, then show it as plain text.
        const saved = value === SECRET_MASK;
        if (saved && revealed === null) {
          return <NekoInput type="password" name={field.name} value={value ?? ''} placeholder={field.placeholder}
            onBlur={onChange} onEnter={onChange}
            iconFilled="eye" onFilledIconClick={reveal}
            description={t('Saved and hidden. Click the eye to see it, or type a new one to replace it.')} />;
        }
        if (revealed !== null) {
          return <NekoInput type="text" name={field.name} value={revealed} placeholder={field.placeholder}
            onBlur={(v) => { setRevealed(v); onChange(v); }} onEnter={onChange}
            iconFilled="eye-off" onFilledIconClick={() => setRevealed(null)}
            description={t('Showing the saved value. Click the eye to hide it again.')} />;
        }
        // Nothing saved yet: an ordinary password field, whose own toggle works
        // because whatever is in it is what the user just typed.
        return <NekoInput type="password" name={field.name} value={value ?? ''} placeholder={field.placeholder}
          onBlur={onChange} onEnter={onChange} />;
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
          key={`${providerKey}-${field.name}`}
          field={field}
          value={creds[field.name]}
          providerKey={providerKey}
          onChange={(value) => actions.updateProviderOption(value, field.name, providerKey)}
        />
      ))}
      {provider.oauth && <OAuthConnect provider={provider} />}
    </>
  );
};

export default ProviderFields;
