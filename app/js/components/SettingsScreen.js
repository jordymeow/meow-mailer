const { useState, useEffect } = wp.element;

import {
  NekoWrapper, NekoColumn, NekoBlock, NekoSettings, NekoInput, NekoSelect, NekoOption,
  NekoSwitch, NekoButton, NekoSpacer, NekoMessage, NekoStatus, NekoToolbar,
} from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { PROVIDERS, PROVIDER_LABELS, isProviderConfigured } from '@app/providers';
import ProviderFields from './ProviderFields';
import { sendTestEmail, fetchLogs, setNetworkMode } from '@app/requests';
import { network } from '@app/settings';
import { t, sprintf } from '@app/i18n';

// A group is read-only when it is shared network-wide and we are not a network
// admin. The REST routes enforce this too — this only keeps the UI honest.
const canEditGroup = network.can_edit || {};
const visibleGroup = network.visible || {};
const lockedProvider = canEditGroup.provider === false;
const lockedSender   = canEditGroup.sender === false;
const lockedDelivery = canEditGroup.delivery === false;
const anyLocked = lockedProvider || lockedSender || lockedDelivery;

// Shared groups belong to the network and are configured on the main site, so
// they are not rendered at all elsewhere.
const showProvider = visibleGroup.provider !== false;
const showSender   = visibleGroup.sender   !== false;
const showDelivery = visibleGroup.delivery !== false;
const hidingShared = !showProvider || !showSender || !showDelivery;

// The shared configuration is managed from the main site only.
const showNetworkBlock = !!network.is_multisite && !!network.is_super_admin && !!network.is_main_site;

const StatCard = ({ label, value, color }) => (
  <div style={{ flex: 1, textAlign: 'center', padding: '10px 6px', background: 'var(--neko-gray-98)', borderRadius: 8 }}>
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--neko-gray-50)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
  </div>
);

const SettingsScreen = () => {
  const { state, actions } = useCoreContext();
  const { options, busy } = state;
  const { updateOption } = actions;

  const [testTo, setTestTo] = useState('');
  const [testFormat, setTestFormat] = useState('html');
  const [testBusy, setTestBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [stats, setStats] = useState({});
  const [shared, setShared] = useState(!!network.enabled);
  const [sharedGroups, setSharedGroups] = useState({
    sender: !!(network.shared || {}).sender,
    delivery: !!(network.shared || {}).delivery,
  });
  const [sharedBusy, setSharedBusy] = useState(false);

  const loadStats = () => {
    fetchLogs({ page: 1, limit: 1, filters: {}, sort: { accessor: 'created', by: 'desc' } })
      .then((res) => setStats(res.stats || {}))
      .catch(() => {});
  };

  useEffect(() => {
    loadStats();
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
      setNotice({ variant: 'success', text: t('Test email sent. Check the Logs tab for the result.') });
      loadStats();
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

  // Named from live state so the notice updates the moment a group is toggled.
  const sharedNames = shared ? [
    t('Email Provider'),
    sharedGroups.sender && t('Sender'),
    sharedGroups.delivery && t('Delivery & Logs'),
  ].filter(Boolean) : [];

  const toggleShared = (value) => applyNetwork(value, sharedGroups);
  const toggleGroup = (group, value) => applyNetwork(shared, { ...sharedGroups, [group]: value });

  const provider = options.provider;
  const configured = isProviderConfigured(provider, options.providers[provider]);

  let modeStatus, modeLabel;
  if (provider === 'none') {
    modeStatus = 'paused'; modeLabel = t('Inactive');
  } else if (provider === 'offline') {
    modeStatus = 'paused'; modeLabel = t('Offline');
  } else if (configured) {
    modeStatus = 'ok'; modeLabel = t('Sending');
  } else {
    modeStatus = 'warning'; modeLabel = t('Not configured');
  }

  return (
    <NekoWrapper>

      {/* Left column — the configuration form */}
      <NekoColumn minimal size="3/5">

        {notice && <><NekoMessage variant={notice.variant}>{notice.text}</NekoMessage><NekoSpacer /></>}

        {hidingShared && <><NekoMessage variant="info">
          {t('Email delivery for this network is configured on the main site. This site keeps its own email logs.')}
          {!!network.is_super_admin && !!network.config_url && <> <a href={network.config_url}>{t('Open the network settings')}</a></>}
        </NekoMessage><NekoSpacer /></>}

        {!hidingShared && sharedNames.length > 0 && <><NekoMessage variant={anyLocked ? 'info' : 'warning'}>
          {anyLocked
            /* translators: %s: list of shared setting groups, e.g. "Email Provider, Sender". */
            ? sprintf( t('%s are shared by every site of the network and managed by the network administrator. Everything else, including your email logs, is your own.'), sharedNames.join(', ') )
            /* translators: %s: list of shared setting groups, e.g. "Email Provider, Sender". */
            : sprintf( t('%s are shared with every site of the network — editing them here changes them everywhere. Your email logs stay per-site.'), sharedNames.join(', ') )}
        </NekoMessage><NekoSpacer /></>}

        {showProvider && (
          <NekoBlock className="primary" title={t('Email Provider')} busy={busy}>
            <NekoSettings title={t('Provider')}>
              <NekoSelect scrolldown name="provider" value={provider} onChange={(v) => updateOption(v, 'provider')} disabled={lockedProvider}
                description={t('Pick one provider. Set it up once and Meow Mailer routes all WordPress email through it.')}>
                {PROVIDERS.map((p) => <NekoOption key={p.key} value={p.key} label={t(p.label)} />)}
              </NekoSelect>
            </NekoSettings>
            <ProviderFields providerKey={provider} />
          </NekoBlock>
        )}

        {showSender && (
          <NekoBlock className="primary" title={t('Sender')} busy={busy}>
            <NekoSettings title={t('From Email')}>
              <NekoInput name="from_email" value={options.from_email} placeholder="you@example.com" onBlur={updateOption} onEnter={updateOption} readOnly={lockedSender}
                description={t('The address your emails are sent from. Use one at your own domain for the best deliverability. Leave empty to keep what WordPress uses.')} />
            </NekoSettings>
            <NekoSettings title={t('From Name')}>
              <NekoInput name="from_name" value={options.from_name} placeholder="My Website" onBlur={updateOption} onEnter={updateOption} readOnly={lockedSender}
                description={t('The sender name recipients see in their inbox (usually your site name).')} />
            </NekoSettings>
            <NekoSettings title={t('Force From')}>
              <NekoSwitch name="force_from" checked={!!options.force_from} onChange={(v) => updateOption(v, 'force_from')} onValue={true} offValue={false} disabled={lockedSender}
                description={t('Apply the From above to every email, overriding any From set by other plugins. Recommended for consistent deliverability.')} />
            </NekoSettings>
            <NekoSettings title={t('Reply-To')}>
              <NekoInput name="reply_to" value={options.reply_to} placeholder={t('(optional)')} onBlur={updateOption} onEnter={updateOption} readOnly={lockedSender}
                description={t('Where replies should go, if different from the From address.')} />
            </NekoSettings>
          </NekoBlock>
        )}

      </NekoColumn>

      {/* Right column — status, delivery options, tools */}
      <NekoColumn minimal size="2/5">

        <NekoBlock className="primary" title={t('Status')} busy={busy}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <span style={{ color: 'var(--neko-gray-50)' }}>{t('Provider')}</span>
            <strong>{PROVIDER_LABELS[provider]}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <span style={{ color: 'var(--neko-gray-50)' }}>{t('Delivery')}</span>
            <NekoStatus status={modeStatus}>{modeLabel}</NekoStatus>
          </div>
          <NekoSpacer />
          <div style={{ display: 'flex', gap: 8 }}>
            <StatCard label={t('Sent')} value={stats.sent || 0} color="var(--neko-green)" />
            <StatCard label={t('Failed')} value={stats.failed || 0} color="var(--neko-red)" />
            <StatCard label={t('Offline')} value={stats.offline || 0} color="var(--neko-gray-50)" />
          </div>
        </NekoBlock>

        {showDelivery && (
          <NekoBlock className="primary" title={t('Delivery & Logs')} busy={busy}>
            <NekoSettings title={t('Background Send')}>
              <NekoSwitch name="send_in_background" checked={!!options.send_in_background} onChange={(v) => updateOption(v, 'send_in_background')} onValue={true} offValue={false} disabled={lockedDelivery}
                description={t('Send emails after the page has loaded, so visitors never wait on the mail server. Recommended.')} />
            </NekoSettings>
            <NekoSettings title={t('Enable Logging')}>
              <NekoSwitch name="logs_enabled" checked={!!options.logs_enabled} onChange={(v) => updateOption(v, 'logs_enabled')} onValue={true} offValue={false} disabled={lockedDelivery} />
            </NekoSettings>
            <NekoSettings title={t('Store Body')}>
              <NekoSwitch name="log_body" checked={!!options.log_body} onChange={(v) => updateOption(v, 'log_body')} onValue={true} offValue={false} disabled={lockedDelivery}
                description={t('Store the full content so you can preview and resend. Turn off to save space.')} />
            </NekoSettings>
            <NekoSettings title={t('Keep Logs For')}>
              <NekoSelect scrolldown name="log_retention_days" value={String(options.log_retention_days)} onChange={(v) => updateOption(parseInt(v, 10), 'log_retention_days')} disabled={lockedDelivery}>
                <NekoOption value="0" label={t('Forever')} />
                <NekoOption value="7" label={t('7 days')} />
                <NekoOption value="30" label={t('30 days')} />
                <NekoOption value="90" label={t('90 days')} />
              </NekoSelect>
            </NekoSettings>
          </NekoBlock>
        )}

        {showNetworkBlock && (
          <NekoBlock className="primary" title={t('Multisite')} busy={sharedBusy}>
            <NekoSettings title={t('Shared Settings')}>
              <NekoSwitch name="network_mode" checked={shared} onChange={toggleShared} onValue={true} offValue={false}
                description={t('Set the email provider up once and use it on every site of the network. Email logs always stay per-site.')} />
            </NekoSettings>
            {shared && <>
              <NekoSettings title={t('Also Share Sender')}>
                <NekoSwitch name="share_sender" checked={sharedGroups.sender} onChange={(v) => toggleGroup('sender', v)} onValue={true} offValue={false}
                  description={t('Share the From address, name and Reply-To too. Leave off to let each site have its own sender.')} />
              </NekoSettings>
              <NekoSettings title={t('Also Share Delivery')}>
                <NekoSwitch name="share_delivery" checked={sharedGroups.delivery} onChange={(v) => toggleGroup('delivery', v)} onValue={true} offValue={false}
                  description={t('Share the background send, logging and retention options too.')} />
              </NekoSettings>
            </>}
          </NekoBlock>
        )}

        <NekoBlock className="primary" title={t('Test Email')} busy={busy}>
          <NekoToolbar>
            <NekoInput name="test_to" value={testTo} placeholder={t('recipient@example.com')} onChange={setTestTo} onEnter={sendTest} style={{ flex: 1 }} />
            <NekoSelect scrolldown name="test_format" value={testFormat} onChange={setTestFormat} style={{ width: 100 }}>
              <NekoOption value="html" label={t('HTML')} />
              <NekoOption value="plain" label={t('Plain')} />
            </NekoSelect>
            <NekoButton className="secondary" icon="mail" disabled={testBusy || !testTo || provider === 'none'} onClick={sendTest}>{t('Send Test')}</NekoButton>
          </NekoToolbar>
        </NekoBlock>

      </NekoColumn>

    </NekoWrapper>
  );
};

export default SettingsScreen;
