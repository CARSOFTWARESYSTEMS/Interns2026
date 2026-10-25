import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Activity, AlertCircle, ArrowLeft, BadgeCheck, Building2, Fingerprint, History, KeyRound, LogIn, LogOut, MapPin, ShieldCheck, Sparkles,
} from 'lucide-react'
import UserAvatar from '../../components/ui/UserAvatar'
import { DirectoryRoleBadge, DirectoryStatusBadge } from '../../components/admin/UsersUi'
import { useAuthContext } from '../../contexts/AuthContext'
import { getActivation, listActivationsForUser } from '../../firebase/activations'
import { getUserProfile } from '../../firebase/firestore'
import {
  getMembership, hasPlatformAdminGrant, listMembershipsForUser, listPartners,
} from '../../firebase/partners'
import {
  buildRows, formatDateTime, labelOf, promptLabel, triggerLabel, type DirectoryRow,
} from '../../admin/userDirectory'
import {
  ACCESS_RESULT_LABELS, ACTIVATION_EVENT_LABELS, LOCATION_SOURCE_LABELS, type ActivationEvent, type UserActivation,
} from '../../types/activation'
import { permissionsFor, SUPER_ADMIN_EMAILS, type UserProfile, type UserRole } from '../../types/auth'
import type { Partner, PartnerMembership } from '../../types/partner'

interface Loaded {
  profile: UserProfile | null
  memberships: PartnerMembership[]
  activations: UserActivation[]
  partners: Partner[]
  platformAdminGrant: boolean
  activityMissing: boolean
}

/**
 * One user: identity, membership, activation and access, location and recent
 * sign-in events — per Partner context. A Partner Admin sees only their own
 * Partner's context; Platform Admin sees every Partner the user is in.
 */
export default function UserDetail() {
  const { uid = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { isPlatformAdmin, activePartner } = useAuthContext()
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activePartner || !uid) return
    let cancelled = false
    setData(null)
    setError('')
    const load = async (): Promise<Loaded> => {
      if (isPlatformAdmin) {
        const [profile, memberships, activations, partners, grant] = await Promise.allSettled([
          getUserProfile(uid), listMembershipsForUser(uid), listActivationsForUser(uid), listPartners(), hasPlatformAdminGrant(uid),
        ])
        if (memberships.status === 'rejected') throw memberships.reason
        return {
          profile: profile.status === 'fulfilled' ? profile.value : null,
          memberships: memberships.value,
          activations: activations.status === 'fulfilled' ? activations.value : [],
          partners: partners.status === 'fulfilled' ? partners.value : [],
          platformAdminGrant: grant.status === 'fulfilled' && grant.value,
          activityMissing: activations.status === 'rejected',
        }
      }
      const [membership, activation] = await Promise.allSettled([getMembership(activePartner.id, uid), getActivation(activePartner.id, uid)])
      if (membership.status === 'rejected') throw membership.reason
      return {
        profile: null,
        memberships: membership.value ? [membership.value] : [],
        activations: activation.status === 'fulfilled' && activation.value ? [activation.value] : [],
        partners: [activePartner],
        platformAdminGrant: false,
        activityMissing: activation.status === 'rejected',
      }
    }
    load()
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError('You do not have permission to view this user.') })
    return () => { cancelled = true }
  }, [uid, activePartner, isPlatformAdmin])

  const contexts = useMemo(
    () => (data ? buildRows(data.memberships, data.activations) : []).sort(
      (a, b) => (b.activation?.lastLoginAt ?? 0) - (a.activation?.lastLoginAt ?? 0)),
    [data],
  )
  const wanted = params.get('partner')
  const row: DirectoryRow | undefined = contexts.find(c => c.partnerId === wanted) ?? contexts[0]
  const partnerOf = (id: string) => data?.partners.find(p => p.id === id)
  const partnerName = (id: string) => partnerOf(id)?.displayName ?? id

  const back = (
    <Link to="/admin/users" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-600">
      <ArrowLeft size={13} aria-hidden="true" /> Users
    </Link>
  )

  if (error) {
    return <div className="space-y-4">{back}<Notice tone="error">{error}</Notice></div>
  }
  if (!data) return <div className="space-y-4">{back}<p className="text-sm text-slate-400 py-10 text-center">Loading user…</p></div>
  if (!row && !data.profile) {
    return (
      <div className="space-y-4">
        {back}
        <div className="card p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">No such user{isPlatformAdmin ? '' : ` in ${activePartner?.displayName ?? 'this Partner'}`}.</p>
          <p className="mt-1 text-xs text-slate-500">They have no membership here and have never signed in to its sites.</p>
        </div>
      </div>
    )
  }

  const a = row?.activation ?? null
  const m = row?.membership ?? null
  const name = row ? labelOf(row) : (data.profile?.displayName || data.profile?.email || uid)
  const email = row?.email || data.profile?.email || ''
  const platformAdmin = isPlatformAdmin && (data.platformAdminGrant || (a?.emailVerified === true && SUPER_ADMIN_EMAILS.has(email.toLowerCase())))

  return (
    <div className="space-y-5">
      {back}

      {/* Who */}
      <header className="rounded-2xl bg-slate-900 text-white ring-1 ring-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <UserAvatar photoURL={m?.photoURL || data.profile?.photoURL} displayName={name} size="lg" className="ring-slate-700 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold break-words">{name}</h1>
          {email && email !== name && <p className="text-sm text-slate-400 break-all">{email}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {row && <DirectoryStatusBadge status={row.status} />}
            {row && <DirectoryRoleBadge role={row.role} />}
            {platformAdmin && row?.role !== 'Platform Admin' && <DirectoryRoleBadge role="Platform Admin" />}
          </div>
        </div>
        {a && (
          <div className="text-xs sm:text-right">
            <p className="text-slate-400">Last login</p>
            <p className="font-semibold whitespace-nowrap">{formatDateTime(a.lastLoginAt)}</p>
          </div>
        )}
      </header>

      {data.activityMissing && <Notice tone="warn">Sign-in activity isn’t available right now; membership details are shown without it.</Notice>}

      {/* Partner contexts (Platform Admin, several Partners) */}
      {contexts.length > 1 && (
        <nav aria-label="Ecosystems" className="flex flex-wrap gap-2">
          {contexts.map(c => (
            <button key={c.key} type="button" aria-pressed={c.key === row?.key}
              onClick={() => setParams({ partner: c.partnerId }, { replace: true })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${c.key === row?.key
                ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'}`}>
              {partnerName(c.partnerId)}
            </button>
          ))}
        </nav>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Identity" icon={<Fingerprint size={14} />}>
          <Facts items={[
            ['Name', row?.name || data.profile?.displayName || '—'],
            ['Email', email || '—'],
            ['Email verified', a ? (a.emailVerified ? <span className="inline-flex items-center gap-1 text-green-700"><BadgeCheck size={13} aria-hidden="true" /> Verified</span> : 'Not verified') : 'Unknown'],
            ['User ID', <span className="font-mono text-[11px] break-all">{uid}</span>],
            ['Account status', row ? `${row.status}${row.role === 'No Membership' ? ' · No Membership' : ''}` : 'No membership'],
          ]} />
        </Section>

        <Section title="Membership" icon={<Building2 size={14} />}>
          {row ? (
            <Facts items={[
              ['Ecosystem', partnerName(row.partnerId)],
              ['Domain', a?.lastSourceDomain || partnerOf(row.partnerId)?.defaultDomain || '—'],
              ['Partner ID', <span className="font-mono text-[11px]">{row.partnerId}</span>],
              ['Login provider', a?.loginProvider || '—'],
              ['Role', <DirectoryRoleBadge role={row.role} />],
              ['Permissions', <Permissions role={row.role === 'No Membership' ? null : row.role} />],
              ['Membership status', m ? <DirectoryStatusBadge status={m.status} /> : <span>Authenticated · <strong>No Membership</strong> — signed in, no protected access</span>],
            ]} />
          ) : <p className="text-sm text-slate-500">No membership or sign-in in any ecosystem.</p>}
        </Section>

        <Section title="Activation & Access" icon={<Sparkles size={14} />} wide>
          {a ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Source heading="First activation" at={a.firstActivatedAt} domain={a.firstSourceDomain} host={a.firstSourceHost}
                page={a.firstSourcePageLabel} path={a.firstSourcePath} trigger={a.firstLoginTrigger} prompt={a.firstLoginPromptType} />
              <Source heading="Latest login" at={a.lastLoginAt} domain={a.lastSourceDomain} host={a.lastSourceHost}
                page={a.lastSourcePageLabel} path={a.lastSourcePath} trigger={a.lastLoginTrigger} prompt={a.lastLoginPromptType}
                extra={[['Access at sign-in', ACCESS_RESULT_LABELS[a.lastAccess] ?? a.lastAccess], ['Sign-ins', String(a.loginCount)]]} />
            </div>
          ) : <p className="text-sm text-slate-500">Has not signed in to {row ? partnerName(row.partnerId) : 'this ecosystem'}’s sites since sign-in tracking began.</p>}
        </Section>

        <Section title="Location" icon={<MapPin size={14} />}>
          {a?.locationSource ? (
            <Facts items={[
              ['Country', a.country ? `${a.country}${a.countryCode && a.countryCode !== a.country ? ` (${a.countryCode})` : ''}` : '—'],
              ['State / Region', a.stateOrRegion || '—'],
              ['City', a.city || '—'],
              ['Timezone', a.timezone || '—'],
              ['Location source', LOCATION_SOURCE_LABELS[a.locationSource]],
              ['Captured at', formatDateTime(a.locationCapturedAt)],
            ]} />
          ) : <p className="text-sm text-slate-500">No location recorded. Country and state come from the user’s profile or, if it has none, approximately from their network; never GPS.</p>}
        </Section>

        <Section title="Recent Authentication Events" icon={<History size={14} />}>
          {a && a.recentEvents.length > 0 ? (
            <ol className="divide-y divide-slate-100">
              {a.recentEvents.map((e, i) => <EventRow key={`${e.at}-${i}`} event={e} />)}
            </ol>
          ) : <p className="text-sm text-slate-500">No sign-in events recorded.</p>}
        </Section>
      </div>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'error' | 'warn'; children: ReactNode }) {
  const cls = tone === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`p-3 rounded-lg border flex gap-2 text-sm ${cls}`}><AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{children}</div>
}

function Section({ title, icon, wide, children }: { title: string; icon: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`card ${wide ? 'lg:col-span-2' : ''}`} aria-label={title}>
      <h2 className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-slate-100 text-sm font-bold text-slate-900">
        <span className="text-brand-600" aria-hidden="true">{icon}</span>{title}
      </h2>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    // Phones: label above value. Wider: label and value side by side.
    <dl className="grid grid-cols-1 sm:grid-cols-[minmax(110px,auto)_1fr] sm:gap-x-4 sm:gap-y-2.5 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="data-label sm:pt-0.5">{label}</dt>
          <dd className="mb-2.5 sm:mb-0 text-slate-800 min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Source({ heading, at, domain, host, page, path, trigger, prompt, extra = [] }: {
  heading: string
  at: number
  domain: string
  host: string
  page: string
  path: string
  trigger: UserActivation['firstLoginTrigger']
  prompt: UserActivation['firstLoginPromptType']
  extra?: Array<[string, ReactNode]>
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-700">{heading}</h3>
      <Facts items={[
        ['When', formatDateTime(at)],
        ['Source domain', host && host !== domain ? <>{domain} <span className="text-slate-400">({host})</span></> : domain || '—'],
        ['Page', page || '—'],
        ['Path', <span className="font-mono text-[11px] break-all">{path || '—'}</span>],
        ['Login trigger', <>{triggerLabel(trigger)}{prompt && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{promptLabel(prompt)}</span>}</>],
        ...extra,
      ]} />
    </div>
  )
}

const EVENT_ICONS: Record<ActivationEvent['event'], ReactNode> = {
  user_activation: <Sparkles size={14} />,
  login_success: <LogIn size={14} />,
  logout: <LogOut size={14} />,
}

function EventRow({ event: e }: { event: ActivationEvent }) {
  const denied = e.access && e.access !== 'granted' && e.access !== 'platform_admin'
  return (
    <li className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden="true">
        {EVENT_ICONS[e.event] ?? <Activity size={14} />}
      </span>
      <div className="min-w-0 flex-1 text-xs">
        <p className="text-slate-400">{formatDateTime(e.at)}</p>
        <p className="font-semibold text-slate-900">{ACTIVATION_EVENT_LABELS[e.event] ?? e.event}</p>
        <p className="text-slate-600 break-words">
          {[e.host, e.pageLabel, e.trigger ? `${triggerLabel(e.trigger)}${e.promptType ? ` · ${promptLabel(e.promptType)}` : ''}` : ''].filter(Boolean).join(' · ')}
        </p>
        {e.access && (
          <p className={`mt-0.5 inline-flex items-center gap-1 ${denied ? 'text-amber-700' : 'text-green-700'}`}>
            {denied ? <KeyRound size={11} aria-hidden="true" /> : <ShieldCheck size={11} aria-hidden="true" />}
            {ACCESS_RESULT_LABELS[e.access] ?? e.access}
          </p>
        )}
      </div>
    </li>
  )
}

function Permissions({ role }: { role: Exclude<DirectoryRow['role'], 'No Membership'> | null }) {
  if (!role) return <span className="text-slate-500">None</span>
  const perms = permissionsFor(role as UserRole)
  if (perms.includes('*')) {
    return <span>{role === 'Platform Admin' ? 'All permissions, every ecosystem' : 'All permissions in this ecosystem'}</span>
  }
  return (
    <span className="flex flex-wrap gap-1">
      {perms.map(p => <code key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">{p}</code>)}
    </span>
  )
}
