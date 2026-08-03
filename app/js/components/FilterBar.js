const { useState, useEffect } = wp.element;

import { NekoToolbar, NekoInput, NekoSelect, NekoOption, NekoButton } from '@neko-ui';

import { PROVIDERS } from '@app/providers';
import { t } from '@app/i18n';

export const DEFAULT_FILTERS = { search: '', status: '', provider: '', days: 30 };

export const hasActiveFilters = (filters) =>
  !!(filters.search || filters.status || filters.provider);

/**
 * One set of filters for the whole dashboard.
 *
 * It sits above both columns rather than inside the log, because it narrows the
 * log, the totals, the chart and the error ranking together. Owning it here is
 * what stops the panels describing different sets of emails: the period used to
 * belong to the statistics alone, so the log beside them quietly ignored it.
 *
 * The range is a filter like any other and reads as one. It stays a fixed set of
 * choices rather than a date picker: the chart draws a bar per day, so the useful
 * ranges are the ones that still fit across a column.
 */
const FilterBar = ({ filters, onChange, busy }) => {
  const [searchInput, setSearchInput] = useState(filters.search);

  // Typing shouldn't fire four queries per keystroke, so the text lands after a
  // pause. The selects apply immediately: choosing from a list is already a pause.
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== filters.search) {
        onChange({ ...filters, search: searchInput });
      }
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Someone else cleared them (the empty state's button), so follow.
  useEffect(() => { setSearchInput(filters.search); }, [filters.search]);

  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <NekoToolbar style={{ flexWrap: 'wrap' }}>
      <NekoInput name="search" value={searchInput} placeholder={t('Search subject or recipient…')}
        onChange={setSearchInput} onEnter={() => onChange({ ...filters, search: searchInput })}
        style={{ flex: 1, minWidth: 200 }} />
      <NekoSelect scrolldown name="status" value={filters.status} onChange={(v) => set('status', v)} style={{ width: 130 }}>
        <NekoOption value="" label={t('All statuses')} />
        <NekoOption value="sent" label={t('Sent')} />
        <NekoOption value="failed" label={t('Failed')} />
        <NekoOption value="offline" label={t('Offline')} />
        <NekoOption value="pending" label={t('Pending')} />
      </NekoSelect>
      <NekoSelect scrolldown name="provider" value={filters.provider} onChange={(v) => set('provider', v)} style={{ width: 160 }}>
        <NekoOption value="" label={t('All providers')} />
        {PROVIDERS.map((p) => <NekoOption key={p.key} value={p.key} label={t(p.label)} />)}
      </NekoSelect>
      <NekoSelect scrolldown name="days" value={String(filters.days)} onChange={(v) => set('days', parseInt(v, 10))} style={{ width: 150 }}>
        <NekoOption value="7" label={t('Last 7 days')} />
        <NekoOption value="30" label={t('Last 30 days')} />
        <NekoOption value="90" label={t('Last 90 days')} />
      </NekoSelect>
      {/* Only once there is something to clear: a permanently greyed button is one
          more thing to read past on a toolbar that is already four controls wide. */}
      {hasActiveFilters(filters) && (
        <NekoButton className="secondary" icon="close" disabled={busy}
          onClick={() => onChange({ ...DEFAULT_FILTERS, days: filters.days })}>
          {t('Clear')}
        </NekoButton>
      )}
    </NekoToolbar>
  );
};

export default FilterBar;
