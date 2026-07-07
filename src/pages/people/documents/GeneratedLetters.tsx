import { useEffect, useState } from 'react'
import { FolderOpen, Download, Eye, RefreshCw, Archive, ArchiveRestore, Trash2, RotateCcw, ScrollText, X } from 'lucide-react'
import PageHeader from '../../../components/ui/PageHeader'
import SectionCard from '../../../components/ui/SectionCard'
import StatusBadge from '../../../components/ui/StatusBadge'
import {
  getAllLetters, getDefaultLetterTemplate, regenerateLetterPdf, setLetterDisabled,
  setLetterArchived, softDeleteGeneratedLetter, restoreGeneratedLetter, getAuditLogsForResource,
} from '../../../firebase/peopleLetters'
import { downloadLetterPdf, buildLetterPdf } from '../../../utils/letterPdf'
import { useAuthContext } from '../../../contexts/AuthContext'
import { SEED_GENERATED_LETTERS, SEED_LETTER_TEMPLATE } from '../../../data/peopleLettersSeed'
import { LETTER_STATUSES, LETTER_TYPE_LABELS } from '../../../types/peopleLetters'
import type { PeopleGeneratedLetter, PeopleLetterTemplate, LetterType, LetterStatus, PeopleLetterAuditLog } from '../../../types/peopleLetters'

export default function GeneratedLetters() {
  const { uid } = useAuthContext()
  const [letters, setLetters] = useState<PeopleGeneratedLetter[]>([])
  const [template, setTemplate] = useState<PeopleLetterTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<LetterType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<LetterStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [auditFor, setAuditFor] = useState<string | null>(null)
  const [auditLogs, setAuditLogs] = useState<PeopleLetterAuditLog[]>([])

  async function refresh() {
    const [l, t] = await Promise.all([getAllLetters(), getDefaultLetterTemplate()])
    setLetters(l.length ? l : SEED_GENERATED_LETTERS)
    setTemplate(t ?? SEED_LETTER_TEMPLATE)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  const visible = letters
    .filter(l => l.status !== 'Draft' && l.status !== 'Submitted for Approval' && l.status !== 'Rejected')
    .filter(l => typeFilter === 'all' || l.letterType === typeFilter)
    .filter(l => statusFilter === 'all' || l.status === statusFilter)
    .filter(l => showArchived || (!l.isArchived && !l.deletedAt))
    .filter(l => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return l.candidateName.toLowerCase().includes(q) || l.documentId.toLowerCase().includes(q)
    })

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    try { await fn() } finally { setBusyId(null); await refresh() }
  }

  async function handleDownload(letter: PeopleGeneratedLetter) {
    if (!template) return
    await downloadLetterPdf(letter, template)
  }

  async function handlePreview(letter: PeopleGeneratedLetter) {
    if (!template) return
    const pdf = await buildLetterPdf(letter, template)
    window.open(pdf.output('bloburl') as unknown as string, '_blank')
  }

  async function handleRegenerate(letter: PeopleGeneratedLetter) {
    if (!template || !uid) return
    await downloadLetterPdf(letter, template)
    await regenerateLetterPdf(letter.id, uid)
  }

  async function openAudit(letter: PeopleGeneratedLetter) {
    setAuditFor(letter.id)
    const logs = await getAuditLogsForResource(`letters/${letter.id}`)
    setAuditLogs(logs)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generated Documents"
        subtitle="Every letter that has been approved and had a PDF generated at least once"
        icon={<FolderOpen size={18} />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Search candidate / document ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as LetterType | 'all')}>
              <option value="all">All Types</option>
              <option value="offer">Offer Letters</option>
              <option value="joining">Joining Letters</option>
            </select>
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as LetterStatus | 'all')}>
              <option value="all">All Statuses</option>
              {LETTER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
              Show archived / deleted
            </label>
          </div>
        }
      />

      <SectionCard title={`Generated Documents (${visible.length})`} icon={<FolderOpen size={14} />}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-500">No generated documents match these filters.</p>
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
                  <tr key={letter.id} className="border-b border-slate-50 align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{letter.documentId}</td>
                    <td className="py-2 pr-3">{LETTER_TYPE_LABELS[letter.letterType]}</td>
                    <td className="py-2 pr-3">{letter.candidateName}</td>
                    <td className="py-2 pr-3">{letter.designation}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={letter.status} />
                        {letter.isDisabled && <StatusBadge status="Disabled" />}
                        {letter.isArchived && <StatusBadge status="Not Started" />}
                        {letter.deletedAt && <StatusBadge status="Rejected" />}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{letter.generatedAt ? new Date(letter.generatedAt).toLocaleDateString() : '—'}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button onClick={() => handlePreview(letter)} className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1">
                          <Eye size={12} /> Preview
                        </button>
                        <button onClick={() => handleDownload(letter)} className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1">
                          <Download size={12} /> Download
                        </button>
                        <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => handleRegenerate(letter))} className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1">
                          <RefreshCw size={12} /> Regenerate
                        </button>
                        <button onClick={() => openAudit(letter)} className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1">
                          <ScrollText size={12} /> Audit
                        </button>
                        <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => setLetterDisabled(letter.id, !letter.isDisabled, uid!))} className="btn-ghost text-xs px-2 py-1.5">
                          {letter.isDisabled ? 'Enable' : 'Disable'}
                        </button>
                        {!letter.isArchived ? (
                          <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => setLetterArchived(letter.id, true, uid!))} className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1">
                            <Archive size={12} /> Archive
                          </button>
                        ) : (
                          <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => setLetterArchived(letter.id, false, uid!))} className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1">
                            <ArchiveRestore size={12} /> Unarchive
                          </button>
                        )}
                        {!letter.deletedAt ? (
                          <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => softDeleteGeneratedLetter(letter.id, uid!))} className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1 text-red-600">
                            <Trash2 size={12} /> Delete
                          </button>
                        ) : (
                          <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => restoreGeneratedLetter(letter.id, uid!))} className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1">
                            <RotateCcw size={12} /> Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {auditFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setAuditFor(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><ScrollText size={14} /> Audit Trail</h3>
              <button onClick={() => setAuditFor(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500">No audit entries yet.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map(log => (
                  <div key={log.id} className="border border-slate-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-800">{log.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{log.details}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
