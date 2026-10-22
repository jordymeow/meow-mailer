const { useState, useEffect } = wp.element;

import { NekoToolbar, NekoInput, NekoSelect, NekoOption, NekoButton } from '@neko-ui';

import { PROVIDERS } from '@app/providers';
import { __ } from '@app/i18n';

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
const FilterBar = ({ filters, onChange, onRefresh, busy }) => {
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
      <NekoInput name="search" value={searchInput} placeholder={__('Search subject or recipient…', 'meow-mailer')}
        onChange={setSearchInput} onEnter={() => onChange({ ...filters, search: searchInput })}
        style={{ flex: 1, minWidth: 200 }} />
      <NekoSelect scrolldown name="status" value={filters.status} onChange={(v) => set('status', v)} style={{ width: 130 }}>
        <NekoOption value="" label={__('All statuses', 'meow-mailer')} />
        <NekoOption value="sent" label={__('Sent', 'meow-mailer')} />
        <NekoOption value="failed" label={__('Failed', 'meow-mailer')} />
        <NekoOption value="offline" label={__('Offline', 'meow-mailer')} />
        <NekoOption value="pending" label={__('Pending', 'meow-mailer')} />
      </NekoSelect>
      <NekoSelect scrolldown name="provider" value={filters.provider} onChange={(v) => set('provider', v)} style={{ width: 160 }}>
        <NekoOption value="" label={__('All providers', 'meow-mailer')} />
        {PROVIDERS.map((p) => <NekoOption key={p.key} value={p.key} label={p.label} />)}
      </NekoSelect>
      <NekoSelect scrolldown name="days" value={String(filters.days)} onChange={(v) => set('days', parseInt(v, 10))} style={{ width: 150 }}>
        <NekoOption value="7" label={__('Last 7 days', 'meow-mailer')} />
        <NekoOption value="30" label={__('Last 30 days', 'meow-mailer')} />
        <NekoOption value="90" label={__('Last 90 days', 'meow-mailer')} />
      </NekoSelect>
      {/* Before Refresh, not after it. The search field is the one that flexes, so
          whatever appears here is paid for out of its width and Refresh stays pinned
          to the right edge instead of being shoved off it. */}
      {hasActiveFilters(filters) && (
        <NekoButton className="secondary" icon="close" disabled={busy}
          onClick={() => onChange({ ...DEFAULT_FILTERS, days: filters.days })}>
          {__('Clear', 'meow-mailer')}
        </NekoButton>
      )}
      {/* Refreshes the whole screen, which is why it sits here rather than on one of
          the panels: they all read the same rows. Last, so it ends at the right edge. */}
      <NekoButton className="primary" icon="refresh" busy={busy} onClick={onRefresh}>
        {__('Refresh', 'meow-mailer')}
      </NekoButton>
    </NekoToolbar>
  );
};

export default FilterBar;
