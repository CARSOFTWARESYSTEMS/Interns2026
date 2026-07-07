import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSignature, Settings2, FileCheck2, FolderOpen, ArrowRight } from 'lucide-react'
import PageHeader from '../../../components/ui/PageHeader'
import SectionCard from '../../../components/ui/SectionCard'
import { getAllLetters } from '../../../firebase/peopleLetters'
import { SEED_GENERATED_LETTERS } from '../../../data/peopleLettersSeed'
import type { PeopleGeneratedLetter } from '../../../types/peopleLetters'

const CARDS = [
  {
    to: '/people/documents/templates',
    title: 'Templates',
    desc: 'Configure the reusable offer & joining letter template — company details, clauses, signature.',
    icon: Settings2,
  },
  {
    to: '/people/documents/offer-letter',
    title: 'Offer Letter',
    desc: 'Draft, submit for approval, approve, and generate internship offer letters.',
    icon: FileSignature,
  },
  {
    to: '/people/documents/joining-letter',
    title: 'Joining Letter',
    desc: 'Generate joining letters for candidates whose offer has been accepted.',
    icon: FileCheck2,
  },
  {
    to: '/people/documents/generated',
    title: 'Generated Letters',
    desc: 'Browse every generated letter, its document ID, status, and download the PDF.',
    icon: FolderOpen,
  },
]

export default function DocumentsHome() {
  const [letters, setLetters] = useState<PeopleGeneratedLetter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllLetters().then(l => {
      setLetters(l.length ? l : SEED_GENERATED_LETTERS)
      setLoading(false)
    })
  }, [])

  const counts = {
    drafts: letters.filter(l => l.status === 'Draft').length,
    pendingApproval: letters.filter(l => l.status === 'Submitted for Approval').length,
    approved: letters.filter(l => l.status === 'Approved').length,
    generated: letters.filter(l => l.status === 'PDF Generated' || l.status === 'Sent' || l.status === 'Downloaded').length,
    accepted: letters.filter(l => l.status === 'Accepted').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Internship offer letters and joining letters — templates, approvals, and generated PDFs"
        icon={<FileSignature size={18} />}
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          ['Drafts', counts.drafts],
          ['Pending Approval', counts.pendingApproval],
          ['Approved', counts.approved],
          ['Generated', counts.generated],
          ['Accepted', counts.accepted],
        ].map(([label, value]) => (
          <div key={label as string} className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{loading ? '—' : value}</p>
            <p className="text-[11px] text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(({ to, title, desc, icon: Icon }) => (
          <Link key={to} to={to}>
            <SectionCard>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center text-brand-700 flex-shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {title} <ArrowRight size={13} className="text-slate-400" />
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{desc}</p>
                </div>
              </div>
            </SectionCard>
          </Link>
        ))}
      </div>
    </div>
  )
}
