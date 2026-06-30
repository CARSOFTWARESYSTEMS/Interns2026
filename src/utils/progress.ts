import type { Assignment, AssignmentStatus } from '../types'

// Maps assignment status to how many phases (0-indexed) are fully complete
const STATUS_PHASE_INDEX: Record<AssignmentStatus, number> = {
  'Draft':                  -1,
  'Assigned':                0,
  'Accepted':                0,
  'Research':                1,
  'Analysis':                2,
  'Simulator Development':   3,
  'Simulator QA':            4,
  'POC':                     5,
  'Architecture':            6,
  'Development':             7,
  'Unit Testing':            8,
  'Integration':             8,
  'Cross Testing':           8,
  'QA Review':               9,
  'Bug Fixes':               9,
  'Architect Review':       10,
  'Demo Ready':             11,
  'Completed':              12,
  'Blocked':                -2,
  'Cancelled':              -3,
}

export function getPhaseIndex(status: AssignmentStatus): number {
  return STATUS_PHASE_INDEX[status] ?? 0
}

export function calcSimulatorProgress(status: string): number {
  const map: Record<string, number> = {
    'Not Started': 0, 'Research': 10, 'Simulator Development': 40,
    'Simulator QA': 70, 'Demo Ready': 85, 'Approved': 100, 'Blocked': 15,
  }
  return map[status] ?? 0
}

export function calcEvidenceProgress(evidence: Assignment['evidence']): number {
  const items = Object.values(evidence)
  const submitted = items.filter(i => i.status !== 'Missing').length
  return Math.round((submitted / items.length) * 100)
}

export function calcQAProgress(status: string): number {
  const map: Record<string, number> = {
    'Pending': 0, 'In Review': 50, 'Passed': 100, 'Failed': 15, 'Blocked': 10,
  }
  return map[status] ?? 0
}

export function calcArchitectProgress(status: string): number {
  const map: Record<string, number> = {
    'Pending': 0, 'In Review': 50, 'Approved': 100,
    'Changes Required': 25, 'Rejected': 10,
  }
  return map[status] ?? 0
}

export function calcOverallProgress(
  simPct: number, storyPct: number, evidencePct: number,
  qaPct: number, archPct: number
): number {
  return Math.round(
    simPct * 0.20 + storyPct * 0.40 + evidencePct * 0.15 +
    qaPct * 0.15 + archPct * 0.10
  )
}

export function getDaysRemaining(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getRiskLevel(daysRemaining: number, progress: number): 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical Risk' {
  const expected = Math.max(0, Math.min(100, ((88 - daysRemaining) / 88) * 100))
  const gap = expected - progress
  if (gap < 10) return 'Low Risk'
  if (gap < 25) return 'Medium Risk'
  if (gap < 40) return 'High Risk'
  return 'Critical Risk'
}
