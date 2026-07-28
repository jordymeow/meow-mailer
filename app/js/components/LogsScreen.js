const { useState, useEffect, useCallback } = wp.element;

import {
  NekoWrapper, NekoColumn, NekoBlock, NekoTable, NekoPaging, NekoToolbar, NekoSelect, NekoOption,
  NekoInput, NekoButton, NekoStatus, NekoSpacer, NekoEmpty,
} from '@neko-ui';

import { useCoreContext } from '@app/contexts/core';
import { fetchLogs, deleteLogs, clearLogs, exportLogs } from '@app/requests';
import { PROVIDERS, PROVIDER_LABELS } from '@app/providers';
import { wrapperBody } from '@app/layout';
import { t } from '@app/i18n';

const LIMIT = 20;

// Module-scoped so the user's filters/page/sort survive a tab switch (NekoTab
// unmounts inactive content). Reset only on a full page reload.
let viewState = { page: 1, status: '', provider: '', search: '', searchInput: '', sort: { accessor: 'created', by: 'desc' } };

export const statusOf = (status) => {
  switch (status) {
    case 'sent':    return { type: 'ok', label: t('Sent') };
    case 'failed':  return { type: 'error', label: t('Failed') };
    case 'offline': return { type: 'paused', label: t('Offline') };
    case 'pending': return { type: 'pending', label: t('Pending') };
    default:        return { type: 'info', label: status || '-' };
  }
};

const countAddresses = (value) => (value ? value.split(',').filter((x) => x.trim()).length : 0);

const COLUMNS = [
  { accessor: 'created', title: t('Date'), width: '160px', sortable: true },
  { accessor: 'to', title: t('To') },
  { accessor: 'subject', title: t('Subject') },
  { accessor: 'provider', title: t('Provider'), width: '130px' },
  { accessor: 'status', title: t('Status'), width: '110px' },
  { accessor: 'actions', title: '', width: '90px' },
];

const LogsScreen = ({ onView, reloadSignal, onChanged = () => {} }) => {
  const { state, actions } = useCoreContext();
  const { setError } = actions;
  const loggingOff = !state.options.logs_enabled;

  const [page, setPage] = useState(viewState.page);
  const [filters, setFilters] = useState({ status: viewState.status, provider: viewState.provider, search: viewState.search });
  const [searchInput, setSearchInput] = useState(viewState.searchInput);
  const [sort, setSort] = useState(viewState.sort);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState([]);

  // Remember the view so a tab switch doesn't lose the user's filters/page.
  useEffect(() => {
    viewState = { page, status: filters.status, provider: filters.provider, search: filters.search, searchInput, sort };
  }, [page, filters, searchInput, sort]);

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

  // Live search, debounced so we don't fetch on every keystroke.
  const applySearch = () => { setPage(1); setFilters((f) => ({ ...f, search: searchInput })); };
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== filters.search) {
        applySearch();
      }
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

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

  const clearAll = async () => {
    if (!window.confirm(t('Delete ALL log entries? This cannot be undone.'))) return;
    try {
      await clearLogs();
      setSelected([]);
      setPage(1);
      load();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const exportCsv = async () => {
    try {
      const csv = await exportLogs(filters, sort);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meow-mailer-logs.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const hasFilters = !!(filters.status || filters.provider || filters.search);
  const clearFilters = () => {
    setPage(1);
    setSearchInput('');
    setFilters({ status: '', provider: '', search: '' });
  };

  // Filters first: with logging off but older emails still on record, blaming the
  // setting would be wrong, because the rows exist and simply don't match.
  let empty;
  if (hasFilters) {
    empty = <NekoEmpty inline icon="filter" title={t('Nothing matches these filters')}
      subtitle={t('Try another status, provider or search term.')}
      action={<NekoButton className="secondary" onClick={clearFilters}>{t('Clear filters')}</NekoButton>} />;
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
      created: row.created,
      to: extra
        ? <>{row.email_to} <span style={{ opacity: 0.5 }} title={t('Cc / Bcc recipients')}>+{extra}</span></>
        : row.email_to,
      subject: row.subject || <em style={{ opacity: 0.5 }}>{t('(no subject)')}</em>,
      provider: PROVIDER_LABELS[row.provider] || row.provider || '-',
      status: <NekoStatus status={st.type}>{st.label}</NekoStatus>,
      actions: (
        <NekoButton rounded icon="search" className="primary" title={t('View')} aria-label={t('View email')}
          onClick={() => onView(row.id)} />
      ),
    };
  });

  return (
    <NekoWrapper style={wrapperBody}>
    <NekoColumn minimal fullWidth>
    <NekoBlock title={t('Email Logs')}
      action={<NekoButton className="primary" icon="refresh" busy={busy} onClick={load}>{t('Refresh')}</NekoButton>}>

      <NekoToolbar>
        <NekoInput name="search" value={searchInput} placeholder={t('Search subject or recipient…')}
          onChange={setSearchInput} onEnter={applySearch} style={{ flex: 1, minWidth: 200 }} />
        <NekoSelect scrolldown name="status" value={filters.status} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, status: v })); }} style={{ width: 130 }}>
          <NekoOption value="" label={t('All statuses')} />
          <NekoOption value="sent" label={t('Sent')} />
          <NekoOption value="failed" label={t('Failed')} />
          <NekoOption value="offline" label={t('Offline')} />
          <NekoOption value="pending" label={t('Pending')} />
        </NekoSelect>
        <NekoSelect scrolldown name="provider" value={filters.provider} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, provider: v })); }} style={{ width: 160 }}>
          <NekoOption value="" label={t('All providers')} />
          {PROVIDERS.map((p) => <NekoOption key={p.key} value={p.key} label={t(p.label)} />)}
        </NekoSelect>
      </NekoToolbar>

      <NekoSpacer />

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
        <NekoButton className="secondary" disabled={!total} onClick={clearAll}>{t('Clear All')}</NekoButton>
        <NekoButton className="secondary" icon="download" disabled={!total} onClick={exportCsv}>{t('Export CSV')}</NekoButton>
        <div style={{ flex: 1 }} />
        <NekoPaging currentPage={page} limit={LIMIT} total={total} onClick={setPage} />
      </div>
    </NekoBlock>
    </NekoColumn>
    </NekoWrapper>
  );
};

export default LogsScreen;
