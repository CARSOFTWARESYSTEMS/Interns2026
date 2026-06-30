import type { Status, QAStatus, ArchitectStatus, DemoStatus, Priority, EvidenceStatus } from '../../types'

type AnyStatus = Status | QAStatus | ArchitectStatus | DemoStatus | Priority | EvidenceStatus | string

const colorMap: Record<string, string> = {
  // Status
  'Not Started':           'bg-slate-100 text-slate-600 border-slate-200',
  'Research':              'bg-purple-100 text-purple-700 border-purple-200',
  'Requirements':          'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Simulator Development': 'bg-blue-100 text-blue-700 border-blue-200',
  'Simulator QA':          'bg-cyan-100 text-cyan-700 border-cyan-200',
  'POC Development':       'bg-teal-100 text-teal-700 border-teal-200',
  'Architecture Review':   'bg-sky-100 text-sky-700 border-sky-200',
  'Product Development':   'bg-brand-100 text-brand-700 border-brand-200',
  'Unit Testing':          'bg-violet-100 text-violet-700 border-violet-200',
  'Cross Testing':         'bg-amber-100 text-amber-700 border-amber-200',
  'QA Review':             'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Bug Fixing':            'bg-orange-100 text-orange-700 border-orange-200',
  'Security Review':       'bg-red-100 text-red-700 border-red-200',
  'Architect Review':      'bg-blue-100 text-blue-700 border-blue-200',
  'Demo Ready':            'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Approved':              'bg-green-100 text-green-700 border-green-200',
  'Blocked':               'bg-red-100 text-red-700 border-red-200',
  // QA
  'Pending':               'bg-slate-100 text-slate-600 border-slate-200',
  'In Review':             'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Passed':                'bg-green-100 text-green-700 border-green-200',
  'Failed':                'bg-red-100 text-red-700 border-red-200',
  // Architect
  'Changes Required':      'bg-orange-100 text-orange-700 border-orange-200',
  'Rejected':              'bg-red-100 text-red-700 border-red-200',
  // Demo
  'Not Ready':             'bg-slate-100 text-slate-600 border-slate-200',
  'In Preparation':        'bg-blue-100 text-blue-700 border-blue-200',
  'Ready':                 'bg-teal-100 text-teal-700 border-teal-200',
  'Presented':             'bg-purple-100 text-purple-700 border-purple-200',
  'Accepted':              'bg-green-100 text-green-700 border-green-200',
  // Priority
  'Critical':              'bg-red-100 text-red-700 border-red-200',
  'High':                  'bg-orange-100 text-orange-700 border-orange-200',
  'Medium':                'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Low':                   'bg-green-100 text-green-700 border-green-200',
  // Evidence
  'Missing':               'bg-red-100 text-red-600 border-red-200',
  'Submitted':             'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Review Pending':        'bg-blue-100 text-blue-700 border-blue-200',
  // Risk
  'Medium Risk':           'bg-yellow-100 text-yellow-700 border-yellow-200',
  'High Risk':             'bg-orange-100 text-orange-700 border-orange-200',
  'Critical Risk':         'bg-red-100 text-red-700 border-red-200',
  'Low Risk':              'bg-green-100 text-green-700 border-green-200',
}

interface StatusBadgeProps {
  status: AnyStatus
  size?: 'xs' | 'sm'
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cls = colorMap[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold border ${textSize} ${cls} whitespace-nowrap`}>
      {status}
    </span>
  )
}
