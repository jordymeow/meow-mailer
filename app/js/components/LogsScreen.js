const { useState, useEffect, useCallback } = wp.element;

import {
  NekoBlock, NekoTable, NekoPaging, NekoButton, NekoIcon, NekoSpacer, NekoEmpty,
} from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { fetchLogs, deleteLogs, exportLogs } from '@app/requests';
import { PROVIDER_LABELS } from '@app/providers';
import { download } from '@app/download';
import { hasActiveFilters } from './FilterBar';
import { t } from '@app/i18n';

const LIMIT = 20;

// Module-scoped so the page and sort survive a screen switch (the dashboard is
// unmounted while Settings is open). The filters are not here: they belong to
// MainScreen, which stays mounted and shares them with the statistics.
let viewState = { page: 1, sort: { accessor: 'created', by: 'desc' } };

export const statusOf = (status) => {
  switch (status) {
    case 'sent':    return { type: 'ok', label: t('Sent') };
    case 'failed':  return { type: 'error', label: t('Failed') };
    case 'offline': return { type: 'paused', label: t('Offline') };
    case 'pending': return { type: 'pending', label: t('Pending') };
    default:        return { type: 'info', label: status || '-' };
  }
};

// The icon carries the status on its own in the table, so it always ships with a
// title: an icon with no words is only obvious to whoever chose it.
const STATUS_ICONS = {
  sent:    { icon: 'check-circle', color: 'var(--neko-green)' },
  failed:  { icon: 'alert-circle', color: 'var(--neko-red)' },
  offline: { icon: 'pause-circle', color: 'var(--neko-gray-60)' },
  pending: { icon: 'timer-outline', color: 'var(--neko-orange)' },
};

const StatusCell = ({ status, label, onExplain }) => {
  const { icon, color } = STATUS_ICONS[status] || { icon: 'info-outline', color: 'var(--neko-gray-60)' };
  const clickable = !!onExplain;
  return (
    <span title={clickable ? `${label} — ${t('click to find out why')}` : label}
      aria-label={label}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onExplain : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExplain(); } } : undefined}
      style={{ display: 'inline-flex', cursor: clickable ? 'pointer' : 'default' }}>
      <NekoIcon icon={icon} width={20} height={20} color={color} />
    </span>
  );
};

const countAddresses = (value) => (value ? value.split(',').filter((x) => x.trim()).length : 0);

// Stored as "YYYY-MM-DD HH:MM:SS". Stacking the time under the date keeps the
// column narrow, which leaves the width for the recipient and the subject.
const DateCell = ({ value }) => {
  const [date, time] = String(value || '').split(' ');
  if (!time) {
    return <>{value}</>;
  }
  return (
    <>
      <div>{date}</div>
      <div style={{ fontSize: 11, color: 'var(--neko-gray-50)', lineHeight: 1.3 }}>{time}</div>
    </>
  );
};

// Status leads: scanning a log is looking for the thing that went wrong, and one
// column of icons down the left edge answers that faster than reading any row.
const COLUMNS = [
  { accessor: 'status', title: '', width: '38px' },
  { accessor: 'created', title: t('Date'), width: '105px', sortable: true },
  { accessor: 'to', title: t('To') },
  { accessor: 'subject', title: t('Subject') },
  { accessor: 'provider', title: t('Provider'), width: '130px' },
  { accessor: 'actions', title: '', width: '46px' },
];

const LogsScreen = ({ filters, onView, onExplainError, reloadSignal,
  onChanged = () => {}, onBusy = () => {} }) => {
  const { state, actions } = useCoreContext();
  const { setError } = actions;
  const loggingOff = !state.options.logs_enabled;

  const [page, setPage] = useState(viewState.page);
  const [sort, setSort] = useState(viewState.sort);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState([]);

  // Remember the view so a screen switch doesn't lose the user's page/sort.
  useEffect(() => { viewState = { page, sort }; }, [page, sort]);

  // A narrower filter usually means fewer pages, so staying on page 7 would land on
  // an empty table that looks like "no results" rather than "you are past the end".
  useEffect(() => { setPage(1); }, [filters]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetchLogs({ page, limit: LIMIT, filters, sort });
      setRows(res.logs || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [page, filters, sort, setError]);

  useEffect(() => { load(); }, [load]);
  // Reload when an action elsewhere (e.g. a resend from the modal) changes the data.
  useEffect(() => { if (reloadSignal) load(); }, [reloadSignal]);

  // The shared Refresh button lives in the filter bar and spins for both panels.
  useEffect(() => { onBusy(busy); }, [busy]);

  const removeSelected = async () => {
    if (!selected.length) return;
    try {
      await deleteLogs(selected);
      setSelected([]);
      load();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const exportCsv = async () => {
    try {
      download('meow-mailer-logs.csv', await exportLogs(filters, sort), 'text/csv;charset=utf-8;');
    } catch (err) {
      setError(err.message);
    }
  };

  const hasFilters = hasActiveFilters(filters);

  // Filters first: with logging off but older emails still on record, blaming the
  // setting would be wrong, because the rows exist and simply don't match.
  let empty;
  if (hasFilters) {
    // No button to clear them: the filter bar sits a few centimetres above with its
    // own Clear, and a second one here would be the same action twice on one screen.
    empty = <NekoEmpty inline icon="filter" title={t('Nothing matches these filters')}
      subtitle={t('Try another status, provider, period or search term.')} />;
  }
  else if (loggingOff) {
    empty = <NekoEmpty inline icon="eye-off" title={t('Logging is turned off')}
      subtitle={t('Emails are still sent, they are just not recorded. Turn Enable Logging back on in the Settings.')} />;
  }
  else {
    empty = <NekoEmpty inline icon="mail" title={t('No emails yet')}
      subtitle={t('Once WordPress sends an email, it will show up here.')} />;
  }

  const data = rows.map((row) => {
    const st = statusOf(row.status);
    // Cc/Bcc have no column of their own; without this hint the email looks like it
    // only ever went to one person.
    const extra = countAddresses(row.cc) + countAddresses(row.bcc);
    return {
      id: row.id,
      created: <DateCell value={row.created} />,
      to: extra
        ? <>{row.email_to} <span style={{ opacity: 0.5 }} title={t('Cc / Bcc recipients')}>+{extra}</span></>
        : row.email_to,
      subject: row.subject || <em style={{ opacity: 0.5 }}>{t('(no subject)')}</em>,
      provider: PROVIDER_LABELS[row.provider] || row.provider || '-',
      // Only a failure has something to explain, so only that icon invites a click.
      // The modal itself is owned by MainScreen, alongside the email one, so both
      // live at the page root rather than inside a table that re-renders constantly.
      status: <StatusCell status={row.status} label={st.label}
        onExplain={row.status === 'failed' ? () => onExplainError(row) : null} />,
      actions: (
        <NekoButton rounded icon="search" className="primary" title={t('View')} aria-label={t('View email')}
          onClick={() => onView(row.id)} />
      ),
    };
  });

  // No wrapper of its own: MainScreen lays this out beside the statistics. No title
  // either — the filter bar above already says what this is, and a heading over a
  // table whose columns are labelled is a line of chrome that earns nothing.
  return (
    <NekoBlock>
      <NekoTable
        variant="raw"
        busy={busy}
        columns={COLUMNS}
        data={data}
        sort={sort}
        onSortChange={(accessor, by) => setSort({ accessor, by })}
        selectedItems={selected}
        onSelect={(ids) => setSelected(Array.from(new Set([...selected, ...ids])))}
        onUnselect={(ids) => setSelected(selected.filter((x) => !ids.includes(x)))}
        emptyMessage={empty}
      />

      <NekoSpacer />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <NekoButton className="danger" disabled={!selected.length} onClick={removeSelected}>
          {selected.length ? `${t('Delete')} (${selected.length})` : t('Delete')}
        </NekoButton>
        {/* Emptying the whole log lives in Settings › Maintenance now. Beside the
            filters it was one slip from the button that only changes the view. */}
        <NekoButton className="secondary" icon="download" disabled={!total} onClick={exportCsv}>{t('Export CSV')}</NekoButton>
        <div style={{ flex: 1 }} />
        <NekoPaging currentPage={page} limit={LIMIT} total={total} onClick={setPage} />
      </div>
    </NekoBlock>
  );
};

export default LogsScreen;
