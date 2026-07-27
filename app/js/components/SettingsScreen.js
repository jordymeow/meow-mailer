const { useState, useEffect } = wp.element;

import {
  NekoWrapper, NekoColumn, NekoBlock, NekoSettings, NekoInput, NekoSelect, NekoOption,
  NekoSwitch, NekoButton, NekoSpacer, NekoMessage, NekoToolbar, NekoEmpty,
} from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { PROVIDERS } from '@app/providers';
import ProviderFields from './ProviderFields';
import ProviderPicker from './ProviderPicker';
import SwitchSetting from './SwitchSetting';
import { sendTestEmail, setNetworkMode } from '@app/requests';
import { network } from '@app/settings';
import { wrapperBody } from '@app/layout';
import { t } from '@app/i18n';

// A group is read-only when it is shared network-wide and we are not a network
// admin. The REST routes enforce this too, so this only keeps the UI honest.
const canEditGroup = network.can_edit || {};
const lockedProvider = canEditGroup.provider === false;
const lockedSender   = canEditGroup.sender === false;
const lockedDelivery = canEditGroup.delivery === false;

// A section the network owns keeps its place on the page, but shows nothing of
// its contents: a half-visible form behind a veil reads as broken, and the values
// are not this site's business anyway. Just the title and where it is managed.
const LockedBlock = ({ title }) => (
  <NekoBlock title={title}>
    <NekoEmpty icon="lock" title={t('Network setting')}
      subtitle={network.is_main_site
        ? t('This is managed by the network administrator.')
        : t('This is managed on the main site of the network.')}
      action={!network.is_main_site && !!network.is_super_admin && !!network.config_url
        ? <NekoButton className="secondary" onClick={() => { window.location.href = network.config_url; }}>
            {t('Open the main site')}
          </NekoButton>
        : null} />
  </NekoBlock>
);

// The shared configuration is managed from the main site only.
const showNetworkBlock = !!network.is_multisite && !!network.is_super_admin && !!network.is_main_site;

const SettingsScreen = ({ onChanged = () => {} }) => {
  const { state, actions } = useCoreContext();
  const { options, busy } = state;
  const { updateOption } = actions;

  const [testTo, setTestTo] = useState('');
  const [testFormat, setTestFormat] = useState('html');
  const [testBusy, setTestBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [shared, setShared] = useState(!!network.enabled);
  const [sharedGroups, setSharedGroups] = useState({
    sender: !!(network.shared || {}).sender,
    delivery: !!(network.shared || {}).delivery,
  });
  const [sharedBusy, setSharedBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('mwmail_oauth');
    if (result === 'connected') {
      setNotice({ variant: 'success', text: t('Account connected successfully.') });
      actions.refreshOptions();
    } else if (result === 'error') {
      setNotice({ variant: 'danger', text: t('Connection failed. Check your Client ID, Secret and redirect URI.') });
    }
  }, []);

  const sendTest = async () => {
    setTestBusy(true);
    setNotice(null);
    try {
      await sendTestEmail(testTo, testFormat);
      setNotice({ variant: 'success', text: t('Test email sent. Open the Logs to see the result.') });
      onChanged();
    } catch (err) {
      setNotice({ variant: 'danger', text: err.message });
    } finally {
      setTestBusy(false);
    }
  };

  // Changing any of this reloads the whole configuration: it changes which store
  // each group is read from (this site's, or the network's).
  const applyNetwork = async (enabled, groups) => {
    setSharedBusy(true);
    setNotice(null);
    try {
      const res = await setNetworkMode(enabled, groups);
      setShared(!!res.network.enabled);
      setSharedGroups({ sender: !!res.network.shared.sender, delivery: !!res.network.shared.delivery });
      actions.setOptions(res.options);
    } catch (err) {
      setNotice({ variant: 'danger', text: err.message });
    } finally {
      setSharedBusy(false);
    }
  };

  const toggleShared = (value) => applyNetwork(value, sharedGroups);
  const toggleGroup = (group, value) => applyNetwork(shared, { ...sharedGroups, [group]: value });

  const provider = options.provider;

  // Nothing chosen yet: the dropdown is a poor first impression, so the block
  // shows a picker instead until there is something to configure.
  const firstRun = provider === 'none' && !lockedProvider;

  // The test bar normally rides along with the provider, but a locked provider
  // block is inert, so when it's locked the bar moves to the sidebar, where this
  // site's admin can still check that their own delivery works.
  const testInSidebar = lockedProvider;

  // The select and the button keep their width, so without a floor the address
  // field collapses to nothing in a narrow column. Let the row wrap instead.
  const testEmailBar = (
    <NekoToolbar style={{ flexWrap: 'wrap' }}>
      <NekoInput name="test_to" value={testTo} placeholder={t('Send a test email to…')} onChange={setTestTo} onEnter={sendTest} style={{ flex: 1, minWidth: 170 }} />
      <NekoSelect scrolldown name="test_format" value={testFormat} onChange={setTestFormat} style={{ width: 100 }}>
        <NekoOption value="html" label={t('HTML')} />
        <NekoOption value="plain" label={t('Plain')} />
      </NekoSelect>
      <NekoButton className="secondary" icon="mail" disabled={testBusy || !testTo || provider === 'none'} onClick={sendTest}>{t('Send Test')}</NekoButton>
    </NekoToolbar>
  );

  return (
    <NekoWrapper style={wrapperBody}>

      {/* Main column: set the provider up, then prove it works */}
      <NekoColumn minimal size="1/2">

        {notice && <><NekoMessage variant={notice.variant}>{notice.text}</NekoMessage><NekoSpacer /></>}

        {lockedProvider ? <LockedBlock title={t('Email Provider')} /> : (
          <NekoBlock title={t('Email Provider')} busy={busy}>
            {firstRun ? <ProviderPicker onPick={(v) => updateOption(v, 'provider')} /> : <>
              <NekoSettings title={t('Provider')}>
                <NekoSelect scrolldown name="provider" value={provider} onChange={(v) => updateOption(v, 'provider')}
                  description={t('Pick one provider. Set it up once and Meow Mailer routes all WordPress email through it.')}>
                  {PROVIDERS.map((p) => <NekoOption key={p.key} value={p.key} label={t(p.label)} />)}
                </NekoSelect>
              </NekoSettings>
              <ProviderFields providerKey={provider} />

              {/* Sending a test is the last step of setting a provider up, so it
                  lives here rather than in a block of its own. */}
              {!testInSidebar && <><NekoSpacer />{testEmailBar}</>}
            </>}
          </NekoBlock>
        )}

        {lockedSender ? <LockedBlock title={t('Sender')} /> : (
          <NekoBlock title={t('Sender')} busy={busy}>
            <NekoSettings title={t('From Email')}>
              <NekoInput name="from_email" value={options.from_email} placeholder="you@example.com" onBlur={updateOption} onEnter={updateOption}
                description={t('The address your emails are sent from. Use one at your own domain for the best deliverability. Leave empty to keep what WordPress uses.')} />
            </NekoSettings>
            <NekoSettings title={t('From Name')}>
              <NekoInput name="from_name" value={options.from_name} placeholder="My Website" onBlur={updateOption} onEnter={updateOption}
                description={t('The sender name recipients see in their inbox (usually your site name).')} />
            </NekoSettings>
            <SwitchSetting title={t('Force From')} name="force_from" checked={options.force_from}
              onChange={(v) => updateOption(v, 'force_from')}
              description={t('Use the address above for every email, even when another plugin sets its own. Recommended, because providers reject mail sent from addresses you do not own.')} />
            <NekoSettings title={t('Reply-To')}>
              <NekoInput name="reply_to" value={options.reply_to} placeholder={t('(optional)')} onBlur={updateOption} onEnter={updateOption}
                description={t('Where replies should go, if different from the From address.')} />
            </NekoSettings>
          </NekoBlock>
        )}

      </NekoColumn>

      {/* Sidebar: the options you set once and forget */}
      <NekoColumn minimal size="1/2">

        {testInSidebar && (
          <NekoBlock title={t('Test Email')} busy={busy}>
            {testEmailBar}
          </NekoBlock>
        )}

        {lockedDelivery ? <LockedBlock title={t('Delivery & Logs')} /> : (
          <NekoBlock title={t('Delivery & Logs')} busy={busy}
            subtitle={t('What happens once WordPress hands an email over to Meow Mailer.')}>
            <SwitchSetting title={t('Background Send')} name="send_in_background" checked={options.send_in_background}
              onChange={(v) => updateOption(v, 'send_in_background')}
              description={t('Deliver the email after the page has finished loading instead of during it. Whoever triggered it, such as a customer checking out or a user resetting a password, no longer waits for the mail server to answer. Recommended.')} />
            <SwitchSetting title={t('Enable Logging')} name="logs_enabled" checked={options.logs_enabled}
              onChange={(v) => updateOption(v, 'logs_enabled')}
              description={t('Keep a record of every email in the Logs, with whether it was delivered or failed. This is how you find out an email never arrived.')} />
            <SwitchSetting title={t('Store Body')} name="log_body" checked={options.log_body}
              onChange={(v) => updateOption(v, 'log_body')}
              description={t('Also keep the message itself, so you can read it back and resend it. Turn off if you would rather not keep email content in your database.')} />
            <NekoSettings title={t('Keep Logs For')}>
              <NekoSelect scrolldown name="log_retention_days" value={String(options.log_retention_days)} onChange={(v) => updateOption(parseInt(v, 10), 'log_retention_days')}
                description={t('Older entries are deleted automatically once a day.')}>
                <NekoOption value="0" label={t('Forever')} />
                <NekoOption value="7" label={t('7 days')} />
                <NekoOption value="30" label={t('30 days')} />
                <NekoOption value="90" label={t('90 days')} />
              </NekoSelect>
            </NekoSettings>
          </NekoBlock>
        )}

        {showNetworkBlock && (
          <NekoBlock title={t('Multisite')} busy={sharedBusy}
            subtitle={t('This network has %d sites. Choose what they configure themselves, and what they inherit from here.').replace('%d', String(network.site_count || 1))}>
            <SwitchSetting title={t('Shared Settings')} name="network_mode" checked={shared} onChange={toggleShared}
              description={t('Set the email provider up once, here on the main site, and every site of the network sends through it. Their own Email Provider section becomes read-only. Email logs are never shared, so each site only ever sees its own.')} />
            {shared && <>
              <SwitchSetting title={t('Also Share Sender')} name="share_sender" checked={sharedGroups.sender}
                onChange={(v) => toggleGroup('sender', v)}
                description={t('Share the From address, name and Reply-To as well. Usually best left off: each site has its own domain, and mail is more trusted when it comes from that domain.')} />
              <SwitchSetting title={t('Also Share Delivery')} name="share_delivery" checked={sharedGroups.delivery}
                onChange={(v) => toggleGroup('delivery', v)}
                description={t('Share the logging, body-storage and retention options as well, so every site keeps records the same way.')} />
            </>}
          </NekoBlock>
        )}

      </NekoColumn>

    </NekoWrapper>
  );
};

export default SettingsScreen;
