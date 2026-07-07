import { useEffect, useState } from 'react'
import { FolderOpen, Download } from 'lucide-react'
import PageHeader from '../../../components/ui/PageHeader'
import SectionCard from '../../../components/ui/SectionCard'
import StatusBadge from '../../../components/ui/StatusBadge'
import { getAllLetters, getDefaultLetterTemplate } from '../../../firebase/peopleLetters'
import { downloadLetterPdf } from '../../../utils/letterPdf'
import { SEED_GENERATED_LETTERS, SEED_LETTER_TEMPLATE } from '../../../data/peopleLettersSeed'
import { LETTER_TYPE_LABELS } from '../../../types/peopleLetters'
import type { PeopleGeneratedLetter, PeopleLetterTemplate, LetterType } from '../../../types/peopleLetters'

export default function GeneratedLetters() {
  const [letters, setLetters] = useState<PeopleGeneratedLetter[]>([])
  const [template, setTemplate] = useState<PeopleLetterTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<LetterType | 'all'>('all')

  useEffect(() => {
    Promise.all([getAllLetters(), getDefaultLetterTemplate()]).then(([l, t]) => {
      setLetters(l.length ? l : SEED_GENERATED_LETTERS)
      setTemplate(t ?? SEED_LETTER_TEMPLATE)
      setLoading(false)
    })
  }, [])

  const visible = letters
    .filter(l => l.status !== 'Draft' && l.status !== 'Submitted for Approval' && l.status !== 'Rejected')
    .filter(l => typeFilter === 'all' || l.letterType === typeFilter)

  function handleDownload(letter: PeopleGeneratedLetter) {
    if (!template) return
    downloadLetterPdf(letter, template)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generated Letters"
        subtitle="Every letter that has been approved and had a PDF generated at least once"
        icon={<FolderOpen size={18} />}
        actions={
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as LetterType | 'all')}>
            <option value="all">All Types</option>
            <option value="offer">Offer Letters</option>
            <option value="joining">Joining Letters</option>
          </select>
        }
      />

      <SectionCard title={`Generated Letters (${visible.length})`} icon={<FolderOpen size={14} />}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-500">No generated letters yet — approve a letter and generate its PDF first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3">Document ID</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Candidate</th>
                  <th className="py-2 pr-3">Designation</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Generated</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map(letter => (
                  <tr key={letter.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-mono text-xs">{letter.documentId}</td>
                    <td className="py-2 pr-3">{LETTER_TYPE_LABELS[letter.letterType]}</td>
                    <td className="py-2 pr-3">{letter.candidateName}</td>
                    <td className="py-2 pr-3">{letter.designation}</td>
                    <td className="py-2 pr-3"><StatusBadge status={letter.status} /></td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{letter.generatedAt ? new Date(letter.generatedAt).toLocaleDateString() : '—'}</td>
                    <td className="py-2 pr-3">
                      <button onClick={() => handleDownload(letter)} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <Download size={12} /> Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
