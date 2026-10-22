const { useState, useEffect } = wp.element;

import { useCoreContext } from '@app/contexts/core';
import { PROVIDER_LABELS, isProviderConfigured } from '@app/providers';
import { fetchLogs } from '@app/requests';
import { num } from '@app/format';
import { __ } from '@app/i18n';
import HeaderStrip from './HeaderStrip';

const Name = ({ children }) => (
  <strong style={{ fontWeight: 700, color: 'white' }}>{children}</strong>
);

/**
 * Put a node where a translated string has its %s. The sentence stays one unit for
 * translators, rather than being glued together from fragments that only line up in
 * English, and the provider still gets to stand out inside it.
 */
const fill = (template, node) => {
  const [before, after = ''] = String(template).split('%s');
  return <>{before}{node}{after}</>;
};

/**
 * The one-line answer to "is my email working?", shown above every screen.
 *
 * Everything it has to say is said in one sentence: which provider carries the mail,
 * what happens if that provider refuses, and whether any of it is being recorded.
 * Those used to be three separate things on the bar, which read as three things to
 * work out instead of one state to take in.
 */
export const deliveryState = (options) => {
  const provider = options.provider;
  const providerName = PROVIDER_LABELS[provider] || provider;

  if (provider === 'none') {
    return { status: 'paused', label: __('Inactive', 'meow-mailer'),
      sentence: [__('WordPress is sending email on its own. Pick a provider to route and log it.', 'meow-mailer')] };
  }
  if (provider === 'offline') {
    return { status: 'paused', label: __('Offline mode', 'meow-mailer'),
      sentence: [__('Every email is written to the log and none of them are delivered.', 'meow-mailer')] };
  }
  if (!isProviderConfigured(provider, options.providers[provider])) {
    return { status: 'warning', label: __('Not configured', 'meow-mailer'),
      sentence: [fill(__('Finish setting %s up before sending.', 'meow-mailer'), <Name>{providerName}</Name>)] };
  }

  const fallback = options.fallback_provider;
  const sentence = [fill(__('All WordPress email goes through %s.', 'meow-mailer'), <Name>{providerName}</Name>)];

  if (fallback && fallback !== 'none' && fallback !== provider) {
    sentence.push(fill(__('If it refuses one, %s takes over.', 'meow-mailer'), <Name>{PROVIDER_LABELS[fallback] || fallback}</Name>));
  } else {
    sentence.push(__('There is no fallback if it fails.', 'meow-mailer'));
  }
  sentence.push(options.logs_enabled ? __('Everything is logged.', 'meow-mailer') : __('Nothing is being logged.', 'meow-mailer'));

  return { status: 'ok', label: __('Active', 'meow-mailer'), sentence };
};

const StatusBar = ({ pulse }) => {
  const { state } = useCoreContext();
  const { options } = state;
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchLogs({ page: 1, limit: 1, filters: {}, sort: { accessor: 'created', by: 'desc' } })
      .then((res) => setStats(res.stats || {}))
      .catch(() => {});
  }, [pulse, options.provider]);

  const { status, label, sentence } = deliveryState(options);

  // Labelled "All time" because the dashboard below shows the same words for
  // whatever the filters currently select. Two different "Failed" numbers on
  // one screen reads as a bug unless it says which is which.
  return (
    <HeaderStrip status={status} label={label} right={<>
      <HeaderStrip.Stat icon="database" label={__('All time', 'meow-mailer')}
        hint={__('Counted over the whole log, whatever the dashboard is filtered to.', 'meow-mailer')} />
      <HeaderStrip.Stat label={__('Sent', 'meow-mailer')} value={num(stats.sent)} tone="success"
        hint={__('Handed to the provider without an error.', 'meow-mailer')} />
      <HeaderStrip.Stat label={__('Failed', 'meow-mailer')} value={num(stats.failed)} tone="danger"
        hint={__('The provider refused them, or could not be reached.', 'meow-mailer')} />
      {/* Only once it means something. Most sites never turn Offline mode on, and a
          permanent "0 OFFLINE" is a word to puzzle over for no reason. */}
      {stats.offline > 0 && (
        <HeaderStrip.Stat label={__('Offline', 'meow-mailer')} value={num(stats.offline)}
          hint={__('Captured by Offline mode and deliberately never delivered.', 'meow-mailer')} />
      )}
    </>}>
      {sentence.map((part, i) => <span key={i}>{part}{i < sentence.length - 1 ? ' ' : ''}</span>)}
    </HeaderStrip>
  );
};

export default StatusBar;
