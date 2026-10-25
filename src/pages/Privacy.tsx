import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import PartnerBrandMark from '../components/ui/PartnerBrandMark'
import { useBranding } from '../contexts/PartnerContext'

/**
 * /privacy — what signing in records, for every site this login host signs
 * people in to. Public: linked from the sign-in pages before anyone signs in.
 * Keep it true to server/auth and firestore.rules when either changes.
 */
export default function Privacy() {
  const b = useBranding()
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 sm:py-14 text-slate-300">
      <main className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <PartnerBrandMark size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white break-words">{b.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Engineering Command Center</p>
          </div>
        </div>

        <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8 shadow-2xl space-y-6 text-sm leading-relaxed">
          <header className="space-y-2">
            <h1 className="flex items-center gap-2 text-xl font-bold text-white">
              <ShieldCheck size={20} className="text-brand-400 flex-shrink-0" aria-hidden="true" />
              Sign-in privacy notice
            </h1>
            <p>
              {b.name} sites sign you in through this Engineering Command Center. This notice explains what signing in
              records about you and why. It covers sign-in only.
            </p>
            <p className="text-xs text-slate-500">Last updated 25 October 2026</p>
          </header>

          <Part title="What we record when you sign in">
            <li><b>Your account identity</b> from Google: your name, email address, whether Google has verified that address, and an account ID.</li>
            <li><b>Your membership</b>: the ecosystems you belong to, your role in each and its status.</li>
            <li><b>Where you signed in from</b>: the site and page you were on (the page address only, never anything after “?” or “#”), and what led you to sign in — a premium page, the optional sign-in prompt, the Login button or the Engineering Command Center.</li>
            <li><b>When</b>: your first sign-in to each ecosystem’s sites, your latest one, and your last few sign-ins and sign-outs.</li>
            <li><b>Approximate location</b>: country, state or region, city and time zone. We use what you entered on your profile; if you haven’t, we estimate it from your network address when you sign in.</li>
          </Part>

          <Part title="What we don’t collect">
            <li>No precise location: no GPS, coordinates, street address or postal code, and we never ask your browser for its location.</li>
            <li>No browsing history: we don’t record the pages you visit after you sign in.</li>
            <li>No passwords: Google checks your password; we never see it.</li>
            <li>Sign-in codes, tokens and session cookies are never kept on your account record or shown to anyone.</li>
          </Part>

          <Part title="Why we use it">
            <li>To keep your account secure and decide what you can access.</li>
            <li>To tailor engineering content and support to your region.</li>
            <li>To understand which content brings people to our programmes, and to improve it.</li>
            <li>To run our engineering programmes and manage their members.</li>
          </Part>

          <Part title="Who can see it">
            <li>Administrators of an ecosystem you signed in to, for that ecosystem only, and the platform’s administrators.</li>
            <li>It is never public. Our sites’ analytics receive which page and which kind of prompt led to a sign-in, never your name or email address.</li>
          </Part>

          <Part title="How long we keep it">
            <li>Your account record — identity, memberships, first and latest sign-in, approximate location — for as long as you have an account with us.</li>
            <li>Security logs of sign-in activity, which include your network (IP) address and browser type, are kept apart from your account record, are not shown to administrators, and are deleted automatically after 400 days.</li>
          </Part>

          <Part title="Your choices">
            <li>You can add or change your country, state and city on your profile at any time; your profile takes precedence over the network estimate.</li>
            <li>
              To ask what we hold about you, or to have it corrected or deleted,{' '}
              {b.contact.email
                ? <>write to <a href={`mailto:${b.contact.email}`} className="text-brand-400 hover:text-brand-300 break-all">{b.contact.email}</a>.</>
                : 'contact your ecosystem’s administrator.'}
            </li>
          </Part>
        </article>

        <p className="mt-6 text-center text-xs">
          <Link to="/login" className="text-slate-500 hover:text-slate-300">Go to sign in</Link>
        </p>
      </main>
    </div>
  )
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-600">{children}</ul>
    </section>
  )
}
