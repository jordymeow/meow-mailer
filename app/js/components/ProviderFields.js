const { useState } = wp.element;

import { NekoSettings, NekoInput, NekoTextArea, NekoSelect, NekoOption, NekoSwitch, NekoButton, NekoStatus, NekoMessage, NekoSpacer } from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { getProvider, constantFields, constantName } from '@app/providers';
import { getOAuthUrl, disconnectOAuth, revealSecret } from '@app/requests';
import { secretMask as SECRET_MASK } from '@app/settings';
import { __ } from '@app/i18n';

const Field = ({ field, value, providerKey, onChange }) => {
  const { actions } = useCoreContext();

  // What the eye uncovered, or null while it is still hidden. A saved secret is not
  // in the settings payload, so revealing it means asking the server for that one
  // field rather than toggling an input that only holds a row of bullets.
  const [revealed, setRevealed] = useState(null);
  const [replacing, setReplacing] = useState(false);

  const reveal = async () => {
    try {
      setRevealed(await revealSecret(providerKey, field.name));
    } catch (err) {
      actions.setError(err.message);
    }
  };

  const control = () => {
    // Set in wp-config.php, which wins over anything typed here, so the field only
    // says where its value comes from.
    if (constantFields(providerKey).includes(field.name)) {
      return <NekoInput name={field.name} value="" readOnly placeholder={__('Set in wp-config.php', 'meow-mailer')}
        description={__('Set by %s in wp-config.php, which takes priority over this field.', 'meow-mailer').replace('%s', constantName(providerKey, field.name))} />;
    }
    switch (field.type) {
      case 'select':
        return (
          <NekoSelect scrolldown name={field.name} value={value ?? ''} onChange={onChange}>
            {field.options.map((o) => <NekoOption key={o.value} value={o.value} label={o.label} />)}
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
            description={__('Saved and hidden. Click the eye to see it, or type a new one to replace it.', 'meow-mailer')} />;
        }
        if (revealed !== null) {
          return <NekoInput type="text" name={field.name} value={revealed} placeholder={field.placeholder}
            onBlur={(v) => { setRevealed(v); onChange(v); }} onEnter={onChange}
            iconFilled="eye-off" onFilledIconClick={() => setRevealed(null)}
            description={__('Showing the saved value. Click the eye to hide it again.', 'meow-mailer')} />;
        }
        // Nothing saved yet: an ordinary password field, whose own toggle works
        // because whatever is in it is what the user just typed.
        return <NekoInput type="password" name={field.name} value={value ?? ''} placeholder={field.placeholder}
          onBlur={onChange} onEnter={onChange} />;
      }
      case 'pem': {
        // A saved certificate comes back as the mask. The private key inside it is never
        // shown again, so there is no eye: replacing it means pasting a new one.
        if (value === SECRET_MASK && !replacing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NekoStatus status="ok">{__('Saved', 'meow-mailer')}</NekoStatus>
              <NekoButton className="secondary" onClick={() => setReplacing(true)}>{__('Replace', 'meow-mailer')}</NekoButton>
            </div>
          );
        }
        // Leaving the box empty must not wipe the certificate that is already saved.
        return <NekoTextArea name={field.name} rows={6} value={value === SECRET_MASK ? '' : (value ?? '')}
          placeholder={field.placeholder} description={field.description && field.description}
          onBlur={(v) => { if (v.trim()) { setReplacing(false); onChange(v.trim()); } }} />;
      }
      default:
        return <NekoInput name={field.name} value={value ?? ''} placeholder={field.placeholder} onBlur={onChange} onEnter={onChange} />;
    }
  };
  return <NekoSettings title={field.label}>{control()}</NekoSettings>;
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
        setError(res.message || __('Could not start authorization.', 'meow-mailer'));
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
        {provider.oauthHelp}
        {provider.oauthConsole && <>
          {' '}<a href={provider.oauthConsole(creds)} target="_blank" rel="noopener noreferrer">{__('Open the console', 'meow-mailer')}</a>
        </>}
        <br /><code>{window.mwmail.oauth_redirect_uri}</code>
      </NekoMessage>
      <NekoSpacer />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {connected
          ? <><NekoStatus status="ok">{__('Connected', 'meow-mailer')}</NekoStatus>
              <NekoButton className="danger" disabled={busy} onClick={disconnect}>{__('Disconnect', 'meow-mailer')}</NekoButton></>
          : <NekoButton className="primary" icon="key" disabled={busy} onClick={connect}>{provider.oauthLabel}</NekoButton>}
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
      {provider.fields.filter((field) => !field.showIf || field.showIf(creds)).map((field) => (
        <Field
          key={`${providerKey}-${field.name}`}
          field={field}
          value={creds[field.name]}
          providerKey={providerKey}
          onChange={(value) => actions.updateProviderOption(value, field.name, providerKey)}
        />
      ))}
      {provider.help && <><NekoSpacer /><NekoMessage variant="info">{provider.help}</NekoMessage></>}
      {provider.oauth && <OAuthConnect provider={provider} />}
    </>
  );
};

export default ProviderFields;
