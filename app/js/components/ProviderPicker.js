import { NekoButton, NekoSpacer } from '@neko-ui';

import { PROVIDERS } from '@app/providers';
import { t } from '@app/i18n';

// 'none' is the state we're leaving, and 'offline' is a mode rather than a
// provider, so it gets its own line below the grid.
const CHOICES = PROVIDERS.filter((p) => p.key !== 'none' && p.key !== 'offline');

/**
 * First run: nothing is configured yet, so the dropdown is a poor welcome. Show
 * the providers as a grid and let one click get things moving. Once a provider
 * is picked the normal select takes over, so this is only ever seen once.
 */
const ProviderPicker = ({ onPick }) => (
  <>
    <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{t('Which service sends your email?')}</p>
    <p style={{ margin: '0 0 14px', color: 'var(--neko-gray-50)', fontSize: 13 }}>
      {t('Pick one to get started. You can change it at any time, and nothing is sent until you do.')}
    </p>

    {/* Wide enough that the longest names ("Microsoft 365 / Outlook") don't
        crowd their button. */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
      {CHOICES.map((p) => (
        <NekoButton key={p.key} fullWidth className="secondary" onClick={() => onPick(p.key)}>
          {t(p.label)}
        </NekoButton>
      ))}
    </div>

    <NekoSpacer />

    <p style={{ margin: 0, color: 'var(--neko-gray-50)', fontSize: 13 }}>
      {t('Just testing, or on a staging site?')}{' '}
      <a href="#" onClick={(e) => { e.preventDefault(); onPick('offline'); }}>{t('Use Offline mode')}</a>
      {'. '}{t('Every email is logged, none are delivered.')}
    </p>
  </>
);

export default ProviderPicker;
