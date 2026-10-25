import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Filter, MapPin, Search, Users, X,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import UserAvatar from '../../components/ui/UserAvatar'
import { DirectoryRoleBadge, DirectoryStatusBadge, UsersTabs } from '../../components/admin/UsersUi'
import { useAuthContext } from '../../contexts/AuthContext'
import { listActivations } from '../../firebase/activations'
import { listAllMemberships, listPartnerMemberships, listPartners } from '../../firebase/partners'
import {
  activeFilterCount, buildRows, DATE_WINDOWS, EMPTY_FILTERS, filterOptions, filterRows, formatDate, formatTime,
  labelOf, paginate, promptLabel, readViewState, SORT_LABELS, sortRows, triggerLabel, writeViewState,
  type DirectoryFilters, type DirectoryRow, type DirectorySort, type SortKey,
} from '../../admin/userDirectory'
import type { UserActivation } from '../../types/activation'
import type { Partner, PartnerMembership } from '../../types/partner'

const DAY = 24 * 60 * 60_000

/** Dates sort newest first on the first click; text A–Z. */
const FIRST_DIR: Record<SortKey, DirectorySort['dir']> = {
  name: 'asc', email: 'asc', country: 'asc', state: 'asc', firstActivated: 'desc', lastLogin: 'desc',
}

export function userDetailHref(row: Pick<DirectoryRow, 'uid' | 'partnerId'>): string {
  return `/admin/users/${encodeURIComponent(row.uid)}?partner=${encodeURIComponent(row.partnerId)}`
}

/**
 * Users: who signed in, from which site and page, when, and from where —
 * joined with their membership. Platform Admin sees every ecosystem; a
 * Partner Admin sees their own Partner (firestore.rules enforce the same).
 */
export default function UserDirectory() {
  const { isPlatformAdmin, activePartner } = useAuthContext()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [memberships, setMemberships] = useState<PartnerMembership[]>([])
  const [activations, setActivations] = useState<UserActivation[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityMissing, setActivityMissing] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (!activePartner) return
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.allSettled([
      isPlatformAdmin ? listAllMemberships() : listPartnerMemberships(activePartner.id),
      listActivations(isPlatformAdmin ? null : activePartner.id),
      isPlatformAdmin ? listPartners() : Promise.resolve([activePartner]),
    ]).then(([m, a, p]) => {
      if (cancelled) return
      if (m.status === 'rejected' && a.status === 'rejected') setError('You do not have permission to view these users.')
      setMemberships(m.status === 'fulfilled' ? m.value : [])
      setActivations(a.status === 'fulfilled' ? a.value : [])
      setActivityMissing(a.status === 'rejected' && m.status === 'fulfilled')
      setPartners(p.status === 'fulfilled' ? p.value : [activePartner])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [activePartner, isPlatformAdmin])

  const view = useMemo(() => readViewState(params), [params])
  // A Partner Admin's rows are their Partner's already; the ecosystem filter is Platform Admin's.
  const filters: DirectoryFilters = isPlatformAdmin ? view.filters : { ...view.filters, partnerId: '' }
  const { sort } = view

  function setView(next: { filters?: DirectoryFilters; sort?: DirectorySort; page?: number }) {
    setParams(writeViewState(next.filters ?? filters, next.sort ?? sort, next.page ?? 1), { replace: true })
  }
  const setFilter = (patch: Partial<DirectoryFilters>) => setView({ filters: { ...filters, ...patch } })

  const rows = useMemo(() => buildRows(memberships, activations), [memberships, activations])
  const options = useMemo(() => filterOptions(rows, filters.country), [rows, filters.country])
  const visible = useMemo(() => sortRows(filterRows(rows, filters, Date.now()), sort), [rows, filters, sort])
  const pageView = paginate(visible, view.page)

  const stats = useMemo(() => {
    const since = Date.now() - 7 * DAY
    return {
      users: new Set(visible.map(r => r.uid)).size,
      active: visible.filter(r => r.status === 'Active').length,
      noMembership: visible.filter(r => r.role === 'No Membership').length,
      newThisWeek: visible.filter(r => (r.activation?.firstActivatedAt ?? 0) >= since).length,
    }
  }, [visible])

  const partnerName = (id: string) => partners.find(p => p.id === id)?.displayName ?? id
  const count = activeFilterCount(filters)

  const onSort = (key: SortKey) =>
    setView({ sort: sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: FIRST_DIR[key] } })

  const subtitle = isPlatformAdmin
    ? 'Platform Admin · Every ecosystem'
    : `${activePartner?.displayName ?? ''} · Users who signed in or hold a membership`

  return (
    <div className="space-y-5">
      <PageHeader title="Users" subtitle={subtitle} icon={<Users size={18} />} />
      <UsersTabs />

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 flex gap-2 text-sm text-red-700">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}
        </div>
      )}
      {activityMissing && (
        <div role="status" className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-2 text-sm text-amber-800">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          Sign-in activity isn’t available right now, so members are listed without where and when they signed in.
        </div>
      )}

      {/* Summary */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl bg-slate-900 text-white overflow-hidden ring-1 ring-slate-800">
        {[
          { label: 'Users', value: stats.users, hint: 'in this view' },
          { label: 'Active members', value: stats.active, hint: 'can use protected areas' },
          { label: 'No membership', value: stats.noMembership, hint: 'signed in, not authorized' },
          { label: 'New this week', value: stats.newThisWeek, hint: 'first activated, 7 days' },
        ].map(({ label, value, hint }, i) => (
          <div key={label} className={`px-4 py-3.5 sm:px-5 ${i % 2 ? 'border-l border-slate-800' : ''} ${i > 1 ? 'border-t lg:border-t-0 border-slate-800' : ''} ${i === 2 ? 'lg:border-l' : ''}`}>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</dt>
            <dd className="mt-1 text-2xl font-black tabular-nums">{loading ? '—' : value}</dd>
            <dd className="text-[11px] text-slate-500">{hint}</dd>
          </div>
        ))}
      </dl>

      {/* Search and filters */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search" value={filters.search} onChange={e => setFilter({ search: e.target.value })}
              placeholder="Search by name or email" aria-label="Search by name or email"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
            />
          </div>
          <button
            type="button" onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters} aria-controls="user-filters"
            className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
          >
            <Filter size={14} aria-hidden="true" /> Filters
            {count > 0 && <span className="rounded-full bg-brand-700 px-1.5 text-[10px] text-white">{count}</span>}
          </button>
        </div>
        <div id="user-filters" className={`${showFilters ? 'grid' : 'hidden'} lg:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9 gap-2`}>
          {isPlatformAdmin && (
            <FilterSelect label="Ecosystem" value={filters.partnerId} onChange={v => setFilter({ partnerId: v })}
              options={partners.map(p => ({ value: p.id, label: p.displayName }))} />
          )}
          <FilterSelect label="Domain" value={filters.domain} onChange={v => setFilter({ domain: v })} options={options.domains} />
          <FilterSelect label="Role" value={filters.role} onChange={v => setFilter({ role: v })} options={[...options.roles]} />
          <FilterSelect label="Status" value={filters.status} onChange={v => setFilter({ status: v })} options={[...options.statuses]} />
          <FilterSelect label="Country" value={filters.country} onChange={v => setFilter({ country: v, stateOrRegion: '' })} options={options.countries} />
          <FilterSelect label="State / Region" value={filters.stateOrRegion} onChange={v => setFilter({ stateOrRegion: v })} options={options.states} />
          <FilterSelect label="Trigger" value={filters.trigger} onChange={v => setFilter({ trigger: v })}
            options={options.triggers.map(t => ({ value: t, label: triggerLabel(t) }))} />
          <FilterSelect label="First activated" value={filters.firstActivated} allLabel="Any time"
            onChange={v => setFilter({ firstActivated: v as DirectoryFilters['firstActivated'] })} options={DATE_WINDOWS.slice(1)} />
          <FilterSelect label="Last login" value={filters.lastLogin} allLabel="Any time"
            onChange={v => setFilter({ lastLogin: v as DirectoryFilters['lastLogin'] })} options={DATE_WINDOWS.slice(1)} />
        </div>
        {(count > 0 || filters.search) && (
          <button type="button" onClick={() => setView({ filters: EMPTY_FILTERS })}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
            <X size={13} aria-hidden="true" /> Clear search and filters
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500" aria-live="polite">
          {loading ? 'Loading users…' : pageView.total === 0 ? 'No users' : `Showing ${pageView.from}–${pageView.to} of ${pageView.total}`}
        </p>
        <label className="xl:hidden flex items-center gap-2 text-xs text-slate-500">
          Sort
          <select value={`${sort.key}:${sort.dir}`} aria-label="Sort users"
            onChange={e => { const [key, dir] = e.target.value.split(':'); setView({ sort: { key: key as SortKey, dir: dir as DirectorySort['dir'] } }) }}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
            {(Object.keys(SORT_LABELS) as SortKey[]).flatMap(k => [
              <option key={`${k}:desc`} value={`${k}:desc`}>{SORT_LABELS[k]} {k === 'firstActivated' || k === 'lastLogin' ? '(newest)' : '(Z–A)'}</option>,
              <option key={`${k}:asc`} value={`${k}:asc`}>{SORT_LABELS[k]} {k === 'firstActivated' || k === 'lastLogin' ? '(oldest)' : '(A–Z)'}</option>,
            ])}
          </select>
        </label>
      </div>

      {!loading && pageView.total === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">{rows.length === 0 ? 'No one has signed in yet.' : 'No users match this search.'}</p>
          {rows.length > 0 && <p className="mt-1 text-xs text-slate-500">Try fewer filters.</p>}
        </div>
      ) : (
        <>
          <UserCards rows={pageView.items} platform={isPlatformAdmin} partnerName={partnerName} />
          <UserTable rows={pageView.items} platform={isPlatformAdmin} partnerName={partnerName} sort={sort} onSort={onSort}
            onOpen={row => navigate(userDetailHref(row))} loading={loading} />
        </>
      )}

      {pageView.pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-2">
          <button type="button" disabled={pageView.page <= 1} onClick={() => setView({ page: pageView.page - 1 })}
            className="btn-secondary disabled:opacity-40"><ChevronLeft size={14} aria-hidden="true" /> Previous</button>
          <span className="text-xs text-slate-500">Page {pageView.page} of {pageView.pages}</span>
          <button type="button" disabled={pageView.page >= pageView.pages} onClick={() => setView({ page: pageView.page + 1 })}
            className="btn-secondary disabled:opacity-40">Next <ChevronRight size={14} aria-hidden="true" /></button>
        </nav>
      )}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, allLabel = 'All' }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<string | { value: string; label: string }>
  allLabel?: string
}) {
  return (
    <label className="block min-w-0">
      <span className="block mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 truncate">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`w-full border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-brand-400 ${value ? 'border-brand-300 text-brand-800 font-semibold' : 'border-slate-200 text-slate-700'}`}>
        <option value="">{allLabel}</option>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

// ── Phones and tablets: stacked cards ─────────────────────────────────────

function UserCards({ rows, platform, partnerName }: { rows: DirectoryRow[]; platform: boolean; partnerName: (id: string) => string }) {
  return (
    <ul className="xl:hidden space-y-2">
      {rows.map(r => {
        const a = r.activation
        const place = [a?.stateOrRegion, a?.country].filter(Boolean).join(', ')
        return (
          <li key={r.key}>
            <Link to={userDetailHref(r)} className="card flex items-start gap-3 p-3.5 hover:border-brand-200 transition-colors">
              <UserAvatar photoURL={r.membership?.photoURL} displayName={labelOf(r)} size="sm" className="ring-transparent flex-shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{labelOf(r)}</p>
                    {r.name && <p className="text-xs text-slate-500 truncate">{r.email}</p>}
                  </div>
                  <DirectoryStatusBadge status={r.status} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <DirectoryRoleBadge role={r.role} />
                  {platform && (
                    <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">{partnerName(r.partnerId)}</span>
                  )}
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                  <div className="flex gap-1 min-w-0"><MapPin size={12} className="mt-px flex-shrink-0 text-slate-400" aria-hidden="true" />
                    <dt className="sr-only">Location</dt><dd className="truncate">{place || 'Location unknown'}</dd></div>
                  <div className="min-w-0"><dt className="inline text-slate-400">First: </dt>
                    <dd className="inline">{a ? `${a.firstSourcePageLabel || a.firstSourcePath} · ${formatDate(a.firstActivatedAt)}` : 'Not activated'}</dd></div>
                  <div className="min-w-0"><dt className="inline text-slate-400">Last login: </dt>
                    <dd className="inline">{a ? `${formatDate(a.lastLoginAt)} ${formatTime(a.lastLoginAt)}` : '—'}</dd></div>
                </dl>
              </div>
              <ChevronRight size={16} className="mt-1 flex-shrink-0 text-slate-300" aria-hidden="true" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// ── Laptops and desktops: dense table, columns by priority ────────────────
//
// Shown from 1280px. Columns join as the width allows (1280, 1536, 1900px);
// until a column has room, its value sits under a neighbour's (email under
// the name, domain under the ecosystem, state under the country, first
// source under the first page), so every width shows every field.

/** Literal Tailwind classes, so the responsive variants are generated. */
const AT = {
  always: { col: '', stacked: 'hidden' },
  wide: { col: 'hidden 2xl:table-cell', stacked: '2xl:hidden' },
  widest: { col: 'hidden min-[1900px]:table-cell', stacked: 'min-[1900px]:hidden' },
} as const

interface Column {
  id: string
  label: string
  sort?: SortKey
  show: (typeof AT)[keyof typeof AT]['col']
  cell: (r: DirectoryRow) => ReactNode
}

const muted = 'block text-[11px] text-slate-400 truncate'
const none = <span className="text-slate-300">—</span>

function DateCell({ at }: { at: number | undefined }) {
  if (at === undefined) return none
  return <><span className="block whitespace-nowrap">{formatDate(at)}</span><span className={muted}>{formatTime(at)}</span></>
}

function columns(platform: boolean, partnerName: (id: string) => string): Column[] {
  const emailAt = AT.widest
  const user: Column = {
    id: 'user', label: 'User', sort: 'name', show: '',
    cell: r => (
      <div className="flex items-center gap-2.5 min-w-0">
        <UserAvatar photoURL={r.membership?.photoURL} displayName={labelOf(r)} size="xs" className="ring-transparent flex-shrink-0" />
        <div className="min-w-0">
          <Link to={userDetailHref(r)} onClick={e => e.stopPropagation()}
            className="block max-w-[170px] truncate font-semibold text-slate-900 hover:text-brand-700">{labelOf(r)}</Link>
          {r.name && <span className={`${muted} max-w-[170px] ${emailAt.stacked}`}>{r.email}</span>}
        </div>
      </div>
    ),
  }
  const email: Column = { id: 'email', label: 'Email', sort: 'email', show: emailAt.col, cell: r => <span className="block max-w-[170px] truncate">{r.email}</span> }
  const stateAt = platform ? AT.wide : AT.always
  const country: Column = {
    id: 'country', label: 'Country', sort: 'country', show: '',
    cell: r => <>
      <span className="block max-w-[110px] truncate">{r.activation?.country || none}</span>
      <span className={`${muted} max-w-[110px] ${stateAt.stacked}`}>{r.activation?.stateOrRegion}</span>
    </>,
  }
  const state: Column = { id: 'state', label: 'State / Region', sort: 'state', show: stateAt.col, cell: r => <span className="block max-w-[120px] truncate">{r.activation?.stateOrRegion || none}</span> }
  const sourceAt = AT.widest
  const firstPage: Column = {
    id: 'firstPage', label: 'First Page', show: '',
    cell: r => r.activation
      ? <>
          <span className="block max-w-[140px] truncate">{r.activation.firstSourcePageLabel || r.activation.firstSourcePath}</span>
          <span className={`${muted} max-w-[140px] font-mono`}>{r.activation.firstSourcePath}</span>
          {platform && <span className={`${muted} max-w-[140px] ${sourceAt.stacked}`}>{r.activation.firstSourceDomain}</span>}
        </>
      : none,
  }
  const firstActivated: Column = { id: 'firstActivated', label: 'First Activated', sort: 'firstActivated', show: '', cell: r => <DateCell at={r.activation?.firstActivatedAt} /> }
  const lastLogin: Column = { id: 'lastLogin', label: 'Last Login', sort: 'lastLogin', show: '', cell: r => <DateCell at={r.activation?.lastLoginAt} /> }

  if (!platform) {
    const statusAt = AT.wide
    return [
      user, email,
      { id: 'status', label: 'Status', show: statusAt.col, cell: r => <DirectoryStatusBadge status={r.status} /> },
      {
        id: 'role', label: 'Role', show: '',
        cell: r => <div className="flex flex-col items-start gap-1"><DirectoryRoleBadge role={r.role} /><span className={statusAt.stacked}><DirectoryStatusBadge status={r.status} /></span></div>,
      },
      country, state, firstActivated, firstPage, lastLogin,
    ]
  }
  const domainAt = AT.widest
  return [
    user, email,
    {
      id: 'ecosystem', label: 'Ecosystem', show: '',
      cell: r => <>
        <span className="block max-w-[120px] truncate font-medium">{partnerName(r.partnerId)}</span>
        <span className={`${muted} max-w-[120px] ${domainAt.stacked}`}>{r.activation?.lastSourceDomain}</span>
      </>,
    },
    { id: 'domain', label: 'Domain', show: domainAt.col, cell: r => <span className="block max-w-[130px] truncate">{r.activation?.lastSourceDomain || none}</span> },
    { id: 'role', label: 'Role', show: '', cell: r => <div className="flex flex-col items-start gap-1"><DirectoryRoleBadge role={r.role} /><DirectoryStatusBadge status={r.status} /></div> },
    country, state,
    { id: 'firstSource', label: 'First Source', show: sourceAt.col, cell: r => <span className="block max-w-[130px] truncate">{r.activation?.firstSourceDomain || none}</span> },
    firstPage,
    {
      id: 'trigger', label: 'Trigger', show: AT.wide.col,
      cell: r => r.activation
        ? <><span className="block whitespace-nowrap">{triggerLabel(r.activation.firstLoginTrigger)}</span><span className={muted}>{promptLabel(r.activation.firstLoginPromptType)}</span></>
        : none,
    },
    firstActivated, lastLogin,
  ]
}

function UserTable({ rows, platform, partnerName, sort, onSort, onOpen, loading }: {
  rows: DirectoryRow[]
  platform: boolean
  partnerName: (id: string) => string
  sort: DirectorySort
  onSort: (key: SortKey) => void
  onOpen: (row: DirectoryRow) => void
  loading: boolean
}) {
  const cols = columns(platform, partnerName)
  return (
    <div className="hidden xl:block card">
      <table className="w-full border-separate border-spacing-0 text-left text-xs text-slate-700">
        <thead>
          <tr>
            {cols.map(c => {
              const active = c.sort !== undefined && sort.key === c.sort
              const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
              return (
                <th key={c.id} scope="col"
                  aria-sort={c.sort ? (active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                  className={`${c.show} sticky top-14 z-10 bg-slate-900 px-2.5 2xl:px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 align-bottom first:rounded-tl-xl last:rounded-tr-xl`}>
                  {c.sort ? (
                    <button type="button" onClick={() => onSort(c.sort!)}
                      className={`inline-flex items-end gap-1 text-left uppercase tracking-wider hover:text-white ${active ? 'text-white' : ''}`}>
                      {c.label}<Icon size={11} aria-hidden="true" className={`mb-px flex-shrink-0 ${active ? 'text-brand-300' : 'text-slate-500'}`} />
                    </button>
                  ) : c.label}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-slate-400">Loading users…</td></tr>
          ) : rows.map(r => (
            <tr key={r.key} onClick={() => onOpen(r)} className="group cursor-pointer">
              {cols.map(c => (
                <td key={c.id} className={`${c.show} border-t border-slate-100 px-2.5 2xl:px-3 py-2.5 align-top group-hover:bg-slate-50 group-last:first:rounded-bl-xl group-last:last:rounded-br-xl`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
