const { useState, useEffect } = wp.element;

import {
  NekoWrapper, NekoColumn, NekoBlock, NekoSettings, NekoInput, NekoSelect, NekoOption,
  NekoSwitch, NekoButton, NekoSpacer, NekoMessage, NekoToolbar, NekoEmpty,
} from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { MAIN_PROVIDERS, fallbackChoices, getProvider, isProviderConfigured } from '@app/providers';
import ProviderFields from './ProviderFields';
import ProviderPicker from './ProviderPicker';
import SwitchSetting from './SwitchSetting';
import MaintenanceBlock from './MaintenanceBlock';
import SecurityBlock from './SecurityBlock';
import { sendTestEmail, setNetworkMode, testWebhook } from '@app/requests';
import { network, wpMailOwner, siteDomain } from '@app/settings';
import { wrapperBody } from '@app/layout';
import { __ } from '@app/i18n';

// A group is read-only when it is shared network-wide and we are not a network
// admin. The REST routes enforce this too, so this only keeps the UI honest.
const canEditGroup = network.can_edit || {};
const lockedProvider = canEditGroup.provider === false;
const lockedSender   = canEditGroup.sender === false;
const lockedDelivery = canEditGroup.delivery === false;

// Whether a From address belongs to the site's own domain. A subdomain either way
// still counts: a site on blog.example.com sending as hello@example.com is aligned,
// and so is the reverse. Only a genuinely different domain is worth a warning, since
// that is the one the receiving server has no reason to trust.
const bareHost = (host) => String(host || '').toLowerCase().replace(/^www\./, '');
const sameDomain = (email, site) => {
  const from = bareHost(String(email || '').split('@')[1]);
  const host = bareHost(site);
  if (!from || !host) {
    return true; // nothing to compare, so nothing to complain about
  }
  return from === host || from.endsWith(`.${host}`) || host.endsWith(`.${from}`);
};

// A section the network owns keeps its place on the page, but shows nothing of
// its contents: a half-visible form behind a veil reads as broken, and the values
// are not this site's business anyway. Just the title and where it is managed.
const LockedBlock = ({ title }) => (
  <NekoBlock title={title}>
    <NekoEmpty icon="lock" title={__('Network setting', 'meow-mailer')}
      subtitle={network.is_main_site
        ? __('This is managed by the network administrator.', 'meow-mailer')
        : __('This is managed on the main site of the network.', 'meow-mailer')}
      action={!network.is_main_site && !!network.is_super_admin && !!network.config_url
        ? <NekoButton className="secondary" onClick={() => { window.location.href = network.config_url; }}>
            {__('Open the main site', 'meow-mailer')}
          </NekoButton>
        : null} />
  </NekoBlock>
);

// The shared configuration is managed from the main site only.
const showNetworkBlock = !!network.is_multisite && !!network.is_super_admin && !!network.is_main_site;

// The core emails that can be switched off. The keys must match
// Meow_MWMAIL_Modules_Notifications::FILTERS, which maps each one to its core filter.
const WP_NOTIFICATIONS = [
  { key: 'new_user_admin', label: __('New User (to you)', 'meow-mailer'),
    description: __('WordPress tells the site admin whenever someone registers.', 'meow-mailer') },
  { key: 'new_user', label: __('New User (to them)', 'meow-mailer'),
    description: __('The welcome email a new user receives, with the link to set their password.', 'meow-mailer') },
  { key: 'password_changed', label: __('Password Changed', 'meow-mailer'),
    description: __('Confirmation sent to a user after they change their password. This is not the password reset email, which is never affected.', 'meow-mailer') },
  { key: 'email_changed', label: __('Email Changed', 'meow-mailer'),
    description: __('Confirmation sent to a user after they change their email address.', 'meow-mailer') },
  { key: 'admin_email_changed', label: __('Admin Email Changed', 'meow-mailer'),
    description: __('Notice sent when the site administration email address is changed.', 'meow-mailer') },
  { key: 'comment_moderation', label: __('Comment Awaiting Moderation', 'meow-mailer'),
    description: __('WordPress emails the moderator each time a comment needs approval.', 'meow-mailer') },
  { key: 'comment_published', label: __('New Comment', 'meow-mailer'),
    description: __('WordPress emails the post author each time a comment is published.', 'meow-mailer') },
  { key: 'core_update', label: __('Automatic Updates', 'meow-mailer'),
    description: __('The report WordPress sends after it updates itself in the background.', 'meow-mailer') },
];

const SettingsScreen = ({ onChanged = () => {} }) => {
  const { state, actions } = useCoreContext();
  const { options, busy } = state;
  const { updateOption } = actions;

  const [testTo, setTestTo] = useState('');
  const [testFormat, setTestFormat] = useState('html');
  const [testBusy, setTestBusy] = useState(false);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookNotice, setWebhookNotice] = useState(null);
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
      setNotice({ variant: 'success', text: __('Account connected successfully.', 'meow-mailer') });
      actions.refreshOptions();
    } else if (result === 'error') {
      setNotice({ variant: 'danger', text: __('Connection failed. Check your Client ID, Secret and redirect URI.', 'meow-mailer') });
    }
  }, []);

  // The switch reads as "send this email", so ticking it off is what adds the key
  // to the blocked list. Storing what is blocked keeps an empty setting meaning
  // "everything sends", which is what a fresh install should do.
  const toggleNotification = (key, send) => {
    const blocked = options.blocked_notifications || [];
    updateOption(send ? blocked.filter((k) => k !== key) : [...blocked, key], 'blocked_notifications');
  };

  // Zoho reports which of its addresses it will actually send as, aliases included.
  // Showing them beats letting someone discover the restriction from a failed send.
  const senderAddresses = ((options.providers || {})[options.provider] || {}).addresses || [];

  const sendTest = async (target = 'provider') => {
    setTestBusy(true);
    setNotice(null);
    try {
      // The credential just typed is still on its way to the server when the click
      // lands; testing before it arrives tests the previous one.
      await actions.settled();
      const res = await sendTestEmail(testTo, testFormat, target);
      setNotice({ variant: 'success', text: `${res.message} ${__('Open the Logs to see the result.', 'meow-mailer')}` });
      onChanged();
    } catch (err) {
      setNotice({ variant: 'danger', text: err.message });
    } finally {
      setTestBusy(false);
    }
  };

  // The real alert is posted without waiting for an answer, so a wrong URL never
  // reports itself. This is the only place it can.
  const sendWebhookTest = async () => {
    setWebhookBusy(true);
    setWebhookNotice(null);
    try {
      const res = await testWebhook(options.alerts_webhook || '');
      setWebhookNotice({ variant: res.success ? 'success' : 'danger', text: res.message });
    } catch (err) {
      setWebhookNotice({ variant: 'danger', text: err.message });
    } finally {
      setWebhookBusy(false);
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
  const fallback = options.fallback_provider || 'none';

  // Some providers are set up per domain (Mailgun asks for one). When the From address
  // matches the domain the provider is authorized for, sending from outside the site's
  // own domain is deliberate and correctly configured, so there is nothing to warn
  // about. Multi-domain installs (Polylang, multisite) land here legitimately.
  const providerDomain = ((options.providers || {})[provider] || {}).domain || '';
  const hasFallback = fallback !== 'none' && provider !== 'none';

  // A fallback pointing at a provider whose credentials were never filled in is worse
  // than none: it reads as covered, and it is not. 'wordpress' needs no credentials.
  const fallbackInline = hasFallback && !!(getProvider(fallback) || {}).fallbackOnly;
  const fallbackUnconfigured = hasFallback && fallback !== 'wordpress'
    && !isProviderConfigured(fallback, (options.providers || {})[fallback]);

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
      <NekoInput name="test_to" value={testTo} placeholder={__('Send a test email to…', 'meow-mailer')} onChange={setTestTo} onEnter={() => sendTest('provider')} style={{ flex: 1, minWidth: 170 }} />
      <NekoSelect scrolldown name="test_format" value={testFormat} onChange={setTestFormat} style={{ width: 100 }}>
        <NekoOption value="html" label={__('HTML', 'meow-mailer')} />
        <NekoOption value="plain" label={__('Plain', 'meow-mailer')} />
      </NekoSelect>
      <NekoButton className="secondary" icon="mail" disabled={testBusy || busy || !testTo || provider === 'none'} onClick={() => sendTest('provider')}>{__('Send Test', 'meow-mailer')}</NekoButton>
      {/* The fallback is only ever used when things are already going wrong, which is
          the worst moment to discover its credentials expired months ago. */}
      {hasFallback && (
        <NekoButton className="secondary" icon="mail" disabled={testBusy || busy || !testTo} onClick={() => sendTest('fallback')}>
          {__('Test Fallback', 'meow-mailer')}
        </NekoButton>
      )}
    </NekoToolbar>
  );

  return (
    <NekoWrapper style={wrapperBody}>

      {/* Main column: set the provider up, then prove it works */}
      <NekoColumn minimal size="1/2">

        {notice && <><NekoMessage variant={notice.variant}>{notice.text}</NekoMessage><NekoSpacer /></>}

        {/* wp_mail() is pluggable, so a plugin that loads before us can define its own
            and core's never loads. We are then never called at all, and nothing on this
            page has any effect. Worth saying loudly: it looks exactly like a provider
            that refuses to work. */}
        {wpMailOwner && (
          <>
            <NekoMessage variant="danger">
              <b>{__('Another plugin is sending your email.', 'meow-mailer')}</b>{' '}
              {__('%s has replaced WordPress\'s own wp_mail function, so Meow Mailer is never called: neither the provider below nor the fallback is used, and the Logs tab stays empty. Deactivate that plugin (or turn off its email feature) for these settings to take effect.', 'meow-mailer').replace('%s', wpMailOwner)}
            </NekoMessage>
            <NekoSpacer />
          </>
        )}

        {lockedProvider ? <LockedBlock title={__('Email Provider', 'meow-mailer')} /> : (
          <NekoBlock title={__('Email Provider', 'meow-mailer')} busy={busy}
            subtitle={__('The service that sends your emails, and the one that takes over if it refuses one.', 'meow-mailer')}>
            {firstRun ? <ProviderPicker onPick={(v) => updateOption(v, 'provider')} /> : <>
              <NekoSettings title={__('Provider', 'meow-mailer')}>
                <NekoSelect scrolldown name="provider" value={provider} onChange={(v) => updateOption(v, 'provider')}
                  description={__('Pick one provider. Set it up once and Meow Mailer routes all WordPress email through it.', 'meow-mailer')}>
                  {MAIN_PROVIDERS.map((p) => <NekoOption key={p.key} value={p.key} label={p.label} />)}
                </NekoSelect>
              </NekoSettings>
              <ProviderFields providerKey={provider} />

              <NekoSpacer />
              <NekoSettings title={__('Fallback', 'meow-mailer')}>
                <NekoSelect scrolldown name="fallback_provider" value={fallback} onChange={(v) => updateOption(v, 'fallback_provider')}
                  description={fallbackInline
                    ? __('Used only when the provider above refuses an email, so nothing is lost to a bad moment.', 'meow-mailer')
                    : __('Used only when the provider above refuses an email, so nothing is lost to a bad moment. Set it up like any other provider by selecting it above first. WordPress needs no setup at all: it hands the email to your server, which is imperfect but always there.', 'meow-mailer')}>
                  {fallbackChoices(provider).map((f) => <NekoOption key={f.key} value={f.key} label={f.label} />)}
                </NekoSelect>
              </NekoSettings>
              {/* Not in the Provider list above, so it cannot be set up the usual way:
                  its fields live right here instead. */}
              {fallbackInline && <ProviderFields providerKey={fallback} />}

              {fallbackUnconfigured && (
                <>
                  <NekoMessage variant="danger">
                    {fallbackInline
                      ? __('This fallback has no server yet, so it cannot rescue anything. Fill it in just above.', 'meow-mailer')
                      : __('This fallback has no credentials yet, so it cannot rescue anything. Select it in Provider above, fill it in, then switch back.', 'meow-mailer')}
                  </NekoMessage>
                  <NekoSpacer />
                </>
              )}

              {/* Deliverability, not paranoia: a provider that is not authorized for
                  your domain sends mail that passes SPF/DKIM for nobody, and it lands
                  in spam while the log cheerfully reads "sent". */}
              {hasFallback && fallback !== 'wordpress' && !fallbackUnconfigured && (
                <>
                  <NekoMessage variant="warning">
                    {__('Your fallback needs its own SPF and DKIM records for your domain, exactly like your main provider. Without them, rescued email is delivered but usually lands in spam.', 'meow-mailer')}
                  </NekoMessage>
                  <NekoSpacer />
                </>
              )}

              {/* Sending a test is the last step of setting a provider up, so it
                  lives here rather than in a block of its own. */}
              {!testInSidebar && <><NekoSpacer />{testEmailBar}</>}
            </>}
          </NekoBlock>
        )}

        {lockedSender ? <LockedBlock title={__('Sender', 'meow-mailer')} /> : (
          <NekoBlock title={__('Sender', 'meow-mailer')} busy={busy}
            subtitle={__('Who your emails come from, and where replies and bounces go.', 'meow-mailer')}>
            <NekoSettings title={__('From Email', 'meow-mailer')}>
              <NekoInput name="from_email" value={options.from_email} placeholder="you@example.com" onBlur={updateOption} onEnter={updateOption}
                description={senderAddresses.length
                  ? `${__('Your provider will only send from one of its own addresses:', 'meow-mailer')} ${senderAddresses.join(', ')}`
                  : __('The address your emails are sent from. Use one at your own domain for the best deliverability. Leave empty to keep what WordPress uses.', 'meow-mailer')} />
            </NekoSettings>
            <NekoSettings title={__('From Name', 'meow-mailer')}>
              <NekoInput name="from_name" value={options.from_name} placeholder="My Website" onBlur={updateOption} onEnter={updateOption}
                description={__('The sender name recipients see in their inbox (usually your site name). {site_name} is replaced by the name of this site.', 'meow-mailer')} />
            </NekoSettings>
            <SwitchSetting title={__('Force From', 'meow-mailer')} name="force_from" checked={options.force_from}
              onChange={(v) => updateOption(v, 'force_from')}
              description={__('Use the address above for every email, even when another plugin sets its own. Recommended, because providers reject mail sent from addresses you do not own.', 'meow-mailer')} />
            {/* Contact form plugins (Contact Form 7, WPForms…) set their own From header,
                which silently wins over the address above. It is the usual reason mail is
                rejected or lands in spam, and nothing else in the UI would show it. */}
            {!options.force_from && options.from_email ? (
              <>
                <NekoMessage variant="warning">
                  {__('Contact form plugins usually set their own sender, which overrides the address above. If your forms are not delivered, or land in spam, turn Force From on.', 'meow-mailer')}
                </NekoMessage>
                <NekoSpacer />
              </>
            ) : null}
            {/* Sending as a domain the site does not own is the quiet killer: SMTP hosts
                refuse to authenticate it, and servers that do accept it produce mail that
                aligns with no SPF or DKIM record, so it is dropped or filed as spam long
                after everything here has reported success. */}
            {options.from_email && !sameDomain(options.from_email, siteDomain)
              && !sameDomain(options.from_email, providerDomain) ? (
              <>
                <NekoMessage variant="warning">
                  {__('This address is not on %s. Providers often refuse to send from a domain you do not own, and mail that does get through usually lands in spam because it matches no SPF or DKIM record. Use an address at your own domain unless you manage that one too.', 'meow-mailer').replace('%s', siteDomain)}
                </NekoMessage>
                <NekoSpacer />
              </>
            ) : null}
            <NekoSettings title={__('Reply-To', 'meow-mailer')}>
              <NekoInput name="reply_to" value={options.reply_to} placeholder={__('(optional)', 'meow-mailer')} onBlur={updateOption} onEnter={updateOption}
                description={__('Where replies should go, if different from the From address. {admin_email} is replaced by the admin email of this site.', 'meow-mailer')} />
            </NekoSettings>
            <NekoSettings title={__('Return Path', 'meow-mailer')}>
              <NekoInput name="return_path" value={options.return_path} placeholder={__('(same as From)', 'meow-mailer')} onBlur={updateOption} onEnter={updateOption}
                description={__('Where bounces and non-delivery reports go, if you keep a mailbox for them. Left empty they follow the From address, which is what happens today. Generic SMTP only: the API providers handle bounces on their own side. {admin_email} works here too.', 'meow-mailer')} />
            </NekoSettings>
          </NekoBlock>
        )}

        {/* Under the provider it moves and the credentials it carries, since that is
            what an export is mostly a copy of. */}
        <MaintenanceBlock onLogsCleared={onChanged} />

        {/* Encryption rewrites the credentials, so on a network it belongs to whoever
            owns the provider group. */}
        {lockedProvider ? <LockedBlock title={__('Security', 'meow-mailer')} /> : <SecurityBlock />}

      </NekoColumn>

      {/* Sidebar: the options you set once and forget */}
      <NekoColumn minimal size="1/2">

        {testInSidebar && (
          <NekoBlock title={__('Test Email', 'meow-mailer')} busy={busy}>
            {testEmailBar}
          </NekoBlock>
        )}

        {lockedDelivery ? <LockedBlock title={__('Delivery & Logs', 'meow-mailer')} /> : (
          <NekoBlock title={__('Delivery & Logs', 'meow-mailer')} busy={busy}
            subtitle={__('What happens once WordPress hands an email over to Meow Mailer.', 'meow-mailer')}>
            <SwitchSetting title={__('Background Send', 'meow-mailer')} name="send_in_background" checked={options.send_in_background}
              onChange={(v) => updateOption(v, 'send_in_background')}
              description={__('Deliver the email after the page has finished loading instead of during it. Whoever triggered it, such as a customer checking out or a user resetting a password, no longer waits for the mail server to answer. Recommended.', 'meow-mailer')} />
            <SwitchSetting title={__('Enable Logging', 'meow-mailer')} name="logs_enabled" checked={options.logs_enabled}
              onChange={(v) => updateOption(v, 'logs_enabled')}
              description={__('Keep a record of every email in the Logs, with whether it was delivered or failed. This is how you find out an email never arrived.', 'meow-mailer')} />
            <SwitchSetting title={__('Store Body', 'meow-mailer')} name="log_body" checked={options.log_body}
              onChange={(v) => updateOption(v, 'log_body')}
              description={__('Also keep the message itself, so you can read it back and resend it. Turn off if you would rather not keep email content in your database.', 'meow-mailer')} />
            {options.log_body && (
              <SwitchSetting title={__('Keep Attachments', 'meow-mailer')} name="store_attachments" checked={options.store_attachments}
                onChange={(v) => updateOption(v, 'store_attachments')}
                description={__('Also keep the attached files, so Resend sends the email complete. Useful when another plugin builds a document on the fly, like an invoice PDF, since that file cannot be rebuilt later. It does mean those documents sit in your database, so they are kept for 30 days only, and emails over 2 MB of attachments are skipped.', 'meow-mailer')} />
            )}
            <NekoSettings title={__('Keep Logs For', 'meow-mailer')}>
              <NekoSelect scrolldown name="log_retention_days" value={String(options.log_retention_days)} onChange={(v) => updateOption(parseInt(v, 10), 'log_retention_days')}
                description={__('Older entries are deleted automatically once a day.', 'meow-mailer')}>
                <NekoOption value="0" label={__('Forever', 'meow-mailer')} />
                <NekoOption value="7" label={__('7 days', 'meow-mailer')} />
                <NekoOption value="30" label={__('30 days', 'meow-mailer')} />
                <NekoOption value="90" label={__('90 days', 'meow-mailer')} />
              </NekoSelect>
            </NekoSettings>
          </NekoBlock>
        )}

        <NekoBlock title={__('Alerts', 'meow-mailer')} busy={busy}
          subtitle={__('How you find out something went wrong, without having to log in and look.', 'meow-mailer')}>
          <SwitchSetting title={__('Failure Alerts', 'meow-mailer')} name="alerts_enabled" checked={options.alerts_enabled}
            onChange={(v) => updateOption(v, 'alerts_enabled')}
            description={__('Email you when your site stops being able to send. At most one alert per hour, however many emails fail. It is sent by WordPress itself rather than your provider, so it still reaches you when the provider is the problem.', 'meow-mailer')} />
          {options.alerts_enabled && (
            <NekoSettings title={__('Alert To', 'meow-mailer')}>
              <NekoInput name="alerts_email" value={options.alerts_email} placeholder={__('(site admin address)', 'meow-mailer')}
                onBlur={updateOption} onEnter={updateOption}
                description={__('Where alerts go. Leave empty to use the site admin address. An address at another provider is safer, since it is reachable when yours is down.', 'meow-mailer')} />
            </NekoSettings>
          )}
          <SwitchSetting title={__('Weekly Summary', 'meow-mailer')} name="summary_enabled" checked={options.summary_enabled}
            onChange={(v) => updateOption(v, 'summary_enabled')}
            description={__('A short weekly email with how much was sent, how much failed, and the most common errors. Skipped entirely on weeks where nothing was sent.', 'meow-mailer')} />
          {options.summary_enabled && (
            <NekoSettings title={__('Summary To', 'meow-mailer')}>
              <NekoInput name="summary_email" value={options.summary_email} placeholder={__('(site admin address)', 'meow-mailer')}
                onBlur={updateOption} onEnter={updateOption}
                description={__('Where the summary goes. Leave empty to use the site admin address.', 'meow-mailer')} />
            </NekoSettings>
          )}
          {/* Last in the block, because it carries whichever of the two above are on,
              and nothing else. Individual emails are never posted anywhere. */}
          {(options.alerts_enabled || options.summary_enabled) && (
            <NekoSettings title={__('Also Post To', 'meow-mailer')}>
              <NekoInput name="alerts_webhook" value={options.alerts_webhook} placeholder={__('https://hooks.slack.com/services/…', 'meow-mailer')}
                onBlur={updateOption} onEnter={updateOption}
                description={__('Optional. Send the same alerts and summary to a chat service as well, so the news does not travel by email at all. Paste the webhook URL your service gives you: Slack and Discord are recognised from the URL and get the message they expect, everything else receives plain JSON. Microsoft Teams retired its old incoming webhooks, so there it means a Power Automate workflow with the "When a Teams webhook request is received" trigger.', 'meow-mailer')} />
            </NekoSettings>
          )}
          {(options.alerts_enabled || options.summary_enabled) && !!options.alerts_webhook && (
            <>
              <NekoToolbar style={{ justifyContent: 'flex-end' }}>
                <NekoButton className="secondary" icon="bell" disabled={webhookBusy} onClick={sendWebhookTest}>
                  {__('Test Webhook', 'meow-mailer')}
                </NekoButton>
              </NekoToolbar>
              {/* Posted without waiting for a reply, so this is the only moment a
                  wrong URL or a revoked hook can say anything. */}
              {webhookNotice && <NekoMessage variant={webhookNotice.variant}>{webhookNotice.text}</NekoMessage>}
            </>
          )}
        </NekoBlock>

        <NekoBlock title={__('WordPress Notifications', 'meow-mailer')} busy={busy}
          subtitle={__('Emails WordPress sends by itself. Turn off the ones you do not want anyone to receive.', 'meow-mailer')}>
          {WP_NOTIFICATIONS.map((n) => (
            <SwitchSetting key={n.key} title={n.label} name={`notify_${n.key}`}
              checked={!(options.blocked_notifications || []).includes(n.key)}
              onChange={(v) => toggleNotification(n.key, v)}
              description={n.description} />
          ))}
          <NekoMessage variant="info">
            {__('Password reset emails are never affected. Turning those off would lock people out of the site.', 'meow-mailer')}
          </NekoMessage>
        </NekoBlock>

        {showNetworkBlock && (
          <NekoBlock title={__('Multisite', 'meow-mailer')} busy={sharedBusy}
            subtitle={__('This network has %d sites. Choose what they configure themselves, and what they inherit from here.', 'meow-mailer').replace('%d', String(network.site_count || 1))}>
            <SwitchSetting title={__('Shared Settings', 'meow-mailer')} name="network_mode" checked={shared} onChange={toggleShared}
              description={__('Set the email provider up once, here on the main site, and every site of the network sends through it. Their own Email Provider section becomes read-only. Email logs are never shared, so each site only ever sees its own.', 'meow-mailer')} />
            {shared && <>
              <SwitchSetting title={__('Also Share Sender', 'meow-mailer')} name="share_sender" checked={sharedGroups.sender}
                onChange={(v) => toggleGroup('sender', v)}
                description={__('Share the From address, name and Reply-To as well. Usually best left off: each site has its own domain, and mail is more trusted when it comes from that domain.', 'meow-mailer')} />
              <SwitchSetting title={__('Also Share Delivery', 'meow-mailer')} name="share_delivery" checked={sharedGroups.delivery}
                onChange={(v) => toggleGroup('delivery', v)}
                description={__('Share the logging, body-storage and retention options as well, so every site keeps records the same way.', 'meow-mailer')} />
            </>}
          </NekoBlock>
        )}

      </NekoColumn>

    </NekoWrapper>
  );
};

export default SettingsScreen;
