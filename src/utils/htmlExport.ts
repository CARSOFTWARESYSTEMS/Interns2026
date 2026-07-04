import type { Assignment, Developer, EvidenceFields, Simulator, Story, TestCase, WeeklyPlan } from '../types'

type Maybe<T> = T | null | undefined

const EVIDENCE_LABELS: Array<[keyof EvidenceFields, string]> = [
  ['driveFolder', 'Google Drive Folder'],
  ['architectureDoc', 'Architecture Document'],
  ['designDoc', 'Design Document'],
  ['githubRepo', 'GitHub Repository'],
  ['branch', 'GitHub Branch'],
  ['pullRequest', 'Pull Request'],
  ['readme', 'README'],
  ['apiDoc', 'API Document'],
  ['verificationReport', 'Verification Report'],
  ['securityReport', 'Security Report'],
  ['testReport', 'Test Report'],
  ['coverageReport', 'Coverage Report'],
  ['screenshots', 'Screenshots'],
  ['demoVideo', 'Demo Video'],
  ['presentation', 'Presentation'],
  ['researchNotes', 'Research Notes'],
  ['patentNotes', 'Patent Notes'],
  ['releaseNotes', 'Release Notes'],
]

function escapeHtml(value: unknown): string {
  const text = value === null || value === undefined || value === '' ? 'Not provided' : String(value)
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function value(value: unknown): string {
  return escapeHtml(value)
}

function badge(status: unknown): string {
  const text = value(status)
  const key = String(status ?? '').toLowerCase()
  const tone =
    key.includes('critical') || key.includes('failed') || key.includes('blocked') || key.includes('rejected') || key.includes('missing') ? 'red' :
    key.includes('high') || key.includes('review') || key.includes('required') || key.includes('pending') ? 'yellow' :
    key.includes('approved') || key.includes('passed') || key.includes('ready') || key.includes('submitted') || key.includes('accepted') ? 'green' :
    'blue'

  return `<span class="badge ${tone}">${text}</span>`
}

function section(title: string, body: string, extraClass = ''): string {
  return `<section class="card ${extraClass}">
    <h2>${escapeHtml(title)}</h2>
    ${body || `<p class="muted">Not provided</p>`}
  </section>`
}

function fields(items: Array<[string, unknown, boolean?]>): string {
  return `<table class="meta-table"><tbody>${items.map(([label, raw, isBadge]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${isBadge ? badge(raw) : value(raw)}</td>
    </tr>`).join('')}</tbody></table>`
}

export function formatJsonBlock(obj: unknown): string {
  let json = 'Not provided'
  try {
    json = obj === null || obj === undefined ? 'Not provided' : JSON.stringify(obj, null, 2)
  } catch {
    json = String(obj)
  }
  return `<pre class="json-block">${escapeHtml(json)}</pre>`
}

export function formatList(items: Maybe<unknown[]>): string {
  if (!items || items.length === 0) return `<p class="muted">Not provided</p>`
  return `<ul class="list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function formatOrderedList(items: Maybe<unknown[]>): string {
  if (!items || items.length === 0) return `<p class="muted">Not provided</p>`
  return `<ol class="ordered-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
}

function formatTestCases(testCases: Maybe<TestCase[]>): string {
  if (!testCases || testCases.length === 0) return `<p class="muted">Not provided</p>`
  return `<div class="test-grid">${testCases.map(tc => `
    <div class="test-case">
      <div class="test-title"><code>${value(tc.id)}</code>${badge(tc.type)}<strong>${value(tc.name)}</strong></div>
      <p>${value(tc.description)}</p>
    </div>`).join('')}</div>`
}

export function formatEvidenceChecklist(evidence: Maybe<EvidenceFields>): string {
  return `<table class="checklist"><tbody>${EVIDENCE_LABELS.map(([key, label]) => {
    const item = evidence?.[key]
    const present = Boolean(item)
    return `<tr>
      <td class="check">${present ? '&#10003;' : '&#9633;'}</td>
      <th>${escapeHtml(label)}</th>
      <td>${item ? formatLink(item) : '<span class="muted">Not provided</span>'}</td>
    </tr>`
  }).join('')}</tbody></table>`
}

function formatLink(url: string): string {
  const safe = escapeHtml(url)
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) return safe
  return `<a href="${safe}">${safe}</a>`
}

function weeklyPlanTable(weeklyPlan: Maybe<WeeklyPlan[]>): string {
  if (!weeklyPlan || weeklyPlan.length === 0) return `<p class="muted">Not provided</p>`
  return `<div class="timeline-grid">${weeklyPlan.map(week => `
    <article class="timeline-card">
      <div class="timeline-head">
        <span class="week-pill">${value(week.week)}</span>
        <div>
          <h4>${value(week.title)}</h4>
          <p>${value(week.dates)} · ${value(week.focus)}</p>
        </div>
      </div>
      ${formatList(week.activities)}
    </article>`).join('')}</div>`
}

function assignmentSummary(assignments: Maybe<Assignment[]>, storyId?: string, simulatorId?: string): string {
  const matched = (assignments ?? []).filter(a =>
    (storyId && a.storyId === storyId) || (simulatorId && a.simulatorId === simulatorId)
  )
  if (matched.length === 0) return `<p class="muted">No matching assignment record found.</p>`
  return `<table class="meta-table"><thead><tr><th>Assignment</th><th>Developer</th><th>Status</th><th>Due</th><th>Progress</th></tr></thead><tbody>${matched.map(a => `
    <tr>
      <td>${value(a.id)}</td>
      <td>${value(a.developerId)}</td>
      <td>${badge(a.status)}</td>
      <td>${value(a.dueDate)}</td>
      <td>${value(a.progress)}%</td>
    </tr>`).join('')}</tbody></table>`
}

function shell(content: string, title: string): string {
  const generated = new Date().toLocaleString()

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; --navy: #0f172a; --blue: #2563eb; --green: #16a34a; --yellow: #ca8a04; --red: #dc2626; --ink: #1e293b; --muted: #64748b; --line: #e2e8f0; --soft: #f8fafc; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef2f7; color: var(--ink); font-family: Arial, Helvetica, sans-serif; line-height: 1.55; }
  .page { max-width: 1120px; margin: 0 auto; padding: 28px 18px 40px; }
  .hero { background: var(--navy); color: white; border-radius: 14px; overflow: hidden; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16); }
  .brand { padding: 28px 32px 18px; border-bottom: 1px solid rgba(255,255,255,0.12); }
  .brand h1 { margin: 0; color: #60a5fa; font-size: 24px; letter-spacing: 2px; }
  .brand p { margin: 6px 0 0; color: #cbd5e1; font-size: 13px; }
  .hero-main { padding: 26px 32px 30px; background: linear-gradient(135deg, rgba(37,99,235,0.32), rgba(15,23,42,0)); }
  .eyebrow { margin: 0 0 8px; color: #bfdbfe; font-size: 12px; text-transform: uppercase; letter-spacing: 1.6px; font-weight: 700; }
  .hero h2 { margin: 0; font-size: 30px; line-height: 1.15; }
  .hero .sub { margin: 10px 0 0; color: #dbeafe; font-size: 14px; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0; }
  .actions button { cursor: pointer; border: 1px solid #bfdbfe; background: white; color: #1e40af; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }
  .card { background: white; border: 1px solid var(--line); border-radius: 10px; padding: 22px; margin-top: 16px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06); break-inside: avoid; }
  .card h2 { color: #1e40af; font-size: 13px; letter-spacing: 1.6px; text-transform: uppercase; margin: 0 0 14px; }
  .card h3 { margin: 18px 0 8px; font-size: 14px; color: #0f172a; }
  .card h4 { margin: 0; font-size: 14px; color: #0f172a; }
  p { margin: 0 0 10px; }
  .muted { color: var(--muted); font-style: italic; }
  .meta-table, .checklist { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #edf2f7; padding: 9px 8px; }
  th { color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.9px; width: 30%; }
  td { color: #1e293b; }
  a { color: #1d4ed8; overflow-wrap: anywhere; }
  .badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; border: 1px solid transparent; }
  .badge.blue { background: #dbeafe; color: #1d4ed8; border-color: #bfdbfe; }
  .badge.green { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
  .badge.yellow { background: #fef3c7; color: #a16207; border-color: #fde68a; }
  .badge.red { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
  .list, .ordered-list { margin: 0; padding-left: 20px; }
  .list li, .ordered-list li { margin: 5px 0; }
  .json-block, .code-block { white-space: pre-wrap; overflow-wrap: anywhere; background: #0f172a; color: #86efac; border-radius: 8px; padding: 14px; font: 12px/1.6 Menlo, Consolas, monospace; }
  .note { background: #eff6ff; border-left: 4px solid var(--blue); padding: 14px; border-radius: 8px; }
  .test-grid { display: grid; gap: 10px; }
  .test-case { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
  .test-title { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
  code { background: #e2e8f0; color: #334155; border-radius: 5px; padding: 2px 5px; font-size: 11px; }
  .check { width: 38px; color: var(--green); font-weight: 700; font-size: 15px; }
  .timeline-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .timeline-card { border: 1px solid #dbe4ef; border-radius: 10px; background: #f8fafc; padding: 14px; break-inside: avoid; }
  .timeline-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  .timeline-head p { margin: 3px 0 0; color: #64748b; font-size: 12px; }
  .week-pill { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; min-width: 58px; padding: 4px 8px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 800; }
  .timeline-card .list { padding-left: 18px; font-size: 12px; }
  .timeline-card .list li { margin: 4px 0; }
  .footer { text-align: center; color: #64748b; font-size: 12px; padding: 26px 10px 0; }
  .page-break { page-break-before: always; }
  @media (max-width: 760px) {
    .page { padding: 12px; }
    .brand, .hero-main, .card { padding: 18px; }
    .hero h2 { font-size: 23px; }
    .grid, .timeline-grid { grid-template-columns: 1fr; }
    th { width: 38%; }
  }
  @media print {
    body { background: white; }
    .page { max-width: none; padding: 0; }
    .hero, .card { box-shadow: none; }
    .no-print { display: none; }
    .page-break { page-break-before: always; }
    .card { break-inside: avoid; }
  }
</style>
</head>
<body>
<main class="page">
${content}
<footer class="footer">
  <p>Generated by EV.ENGINEER Engineering Command Center</p>
  <p>Generated date/time: ${escapeHtml(generated)}</p>
  <p>Confidential internal engineering assignment</p>
</footer>
</main>
</body>
</html>`
}

export function generateStoryHtml(
  story: Story,
  developer: Maybe<Developer>,
  simulators: Maybe<Simulator[]>,
  assignments: Maybe<Assignment[]>,
  weeklyPlan: Maybe<WeeklyPlan[]>,
): string {
  const linkedSimulators = (simulators ?? []).filter(sim => story.simulatorIds.includes(sim.id))
  const title = `${story.id} ${story.title} Assignment`

  return shell(`
    <header class="hero">
      <div class="brand"><h1>UFlight&trade; | EV.ENGINEER&trade;</h1><p>Aerospace Intelligence &amp; Cybersecurity Platform</p></div>
      <div class="hero-main">
        <p class="eyebrow">${value(story.product)} · ${value(story.workPackage)}</p>
        <h2>${value(story.title)}</h2>
        <p class="sub">${value(story.id)} · Assigned developer: ${value(developer?.name ?? story.developerId)} · Due ${value(story.dueDate)}</p>
      </div>
    </header>

    ${section('Story Header', fields([
      ['Product name', story.product],
      ['Work package', story.workPackage],
      ['Story ID', story.id],
      ['Story title', story.title],
      ['Priority', story.priority, true],
      ['Status', story.status, true],
      ['Due date', story.dueDate],
      ['Assigned developer', developer ? `${developer.name} (${developer.email})` : story.developerId],
      ['QA status', story.qaStatus, true],
      ['Architect status', story.architectStatus, true],
    ]))}

    ${section('Executive Summary', `
      <h3>Business Goal</h3><p>${value(story.businessGoal)}</p>
      <h3>Problem Statement</h3><p>${value(story.problemStatement)}</p>
      <h3>User Persona</h3><p>${value(story.userPersona)}</p>
      <h3>Epic</h3><p>${value(story.epic)}</p>
      <h3>User Story</h3><p class="note">${value(story.userStory)}</p>
      <h3>Description</h3><p>${value(story.description)}</p>
    `)}

    <div class="grid">
      ${section('Functional Requirements', formatOrderedList(story.functionalRequirements))}
      ${section('Non-Functional Requirements', formatList(story.nonFunctionalRequirements))}
      ${section('UI Requirements', formatList(story.uiRequirements))}
      ${section('Simulator Dependencies', linkedSimulators.length
        ? formatList(linkedSimulators.map(sim => `${sim.id} - ${sim.name}`))
        : formatList(story.simulatorIds))}
    </div>

    ${section('Architecture', `
      <h3>Architecture Notes</h3><p>${value(story.architectureNotes)}</p>
      <h3>Backend Requirements</h3><p class="muted">Not provided</p>
      <h3>Frontend Requirements</h3>${formatList(story.uiRequirements)}
      <h3>Data Model</h3><p class="muted">Not provided</p>
      <h3>API Contract</h3><p class="muted">Not provided</p>
      <h3>Simulator Dependencies</h3>${linkedSimulators.length
        ? formatList(linkedSimulators.map(sim => `${sim.id}: ${sim.purpose}`))
        : formatList(story.simulatorIds)}
    `)}

    <div class="grid">
      ${section('Sample Input JSON', formatJsonBlock(story.sampleInputJson))}
      ${section('Sample Output JSON', formatJsonBlock(story.sampleOutputJson))}
    </div>

    <div class="grid">
      ${section('Positive Use Cases', formatList(story.positiveUseCases))}
      ${section('Negative Use Cases', formatList(story.negativeUseCases))}
    </div>

    ${section('Test & Security', `
      <h3>Test Cases</h3>${formatTestCases(story.testCases)}
      <h3>Security Requirements</h3>${formatList(story.securityRequirements)}
      <h3>Security Test Cases</h3>${formatList(story.securityTestCases)}
      <h3>Manual Verification Steps</h3>${formatOrderedList(story.manualVerificationSteps)}
    `)}

    ${section('Delivery Plan', `
      <h3>Weekly Timeline</h3>${weeklyPlanTable(weeklyPlan)}
      <h3>Expected Daily Check-in</h3><p>Submit daily progress, blockers, next actions, and evidence updates through the Engineering Command Center.</p>
      <h3>Evidence Expectations</h3><p>Keep all required artifacts current, linked, and review-ready throughout the assignment.</p>
      <h3>Demo Expectations</h3><p>Prepare a concise working demo with screenshots, recording, and verification notes.</p>
      <h3>Matching Assignments</h3>${assignmentSummary(assignments, story.id)}
    `, 'page-break')}

    <div class="grid">
      ${section('Acceptance Criteria', formatOrderedList(story.acceptanceCriteria))}
      ${section('Definition of Done', formatList(story.definitionOfDone))}
    </div>

    ${section('Engineering Evidence Checklist', formatEvidenceChecklist(story.evidence))}

    ${section('Review Sections', `
      <h3>QA Review</h3>${fields([
        ['Reviewer', story.qaReview.reviewer],
        ['Review date', story.qaReview.reviewDate],
        ['Status', story.qaReview.status, true],
        ['Issues found', story.qaReview.issuesFound],
        ['Severity', story.qaReview.severity],
        ['Retest status', story.qaReview.retestStatus],
        ['Comments', story.qaReview.comments],
      ])}
      <h3>Architect Approval</h3>${fields([
        ['Reviewer', story.architectApproval.reviewer],
        ['Review date', story.architectApproval.reviewDate],
        ['Status', story.architectApproval.status, true],
        ['Final decision', story.architectApproval.finalDecision],
        ['Comments', story.architectApproval.comments],
      ])}
      <h3>Final Demo</h3>${fields([
        ['Demo date', story.finalDemo.demoDate],
        ['Demo link', story.finalDemo.demoLink],
        ['Status', story.finalDemo.status, true],
        ['Certificate eligible', story.finalDemo.certificateEligible ? 'Yes' : 'No'],
        ['EV Society comments', story.finalDemo.evSocietyComments],
      ])}
    `)}
  `, title)
}

export function generateSimulatorHtml(
  simulator: Simulator,
  owner: Maybe<Developer>,
  stories: Maybe<Story[]>,
  assignments: Maybe<Assignment[]>,
  weeklyPlan: Maybe<WeeklyPlan[]>,
): string {
  const usedStories = (stories ?? []).filter(story => simulator.usedByStories.includes(story.id))
  const title = `${simulator.id} ${simulator.name} Simulator`

  return shell(`
    <header class="hero">
      <div class="brand"><h1>UFlight&trade; | EV.ENGINEER&trade;</h1><p>Aerospace Intelligence &amp; Cybersecurity Platform</p></div>
      <div class="hero-main">
        <p class="eyebrow">${value(simulator.product)}</p>
        <h2>${value(simulator.name)}</h2>
        <p class="sub">${value(simulator.id)} · Owner: ${value(owner?.name ?? simulator.ownerId)} · ${value(simulator.status)}</p>
      </div>
    </header>

    ${section('Simulator Header', fields([
      ['Product', simulator.product],
      ['Simulator ID', simulator.id],
      ['Simulator name', simulator.name],
      ['Owner', owner ? `${owner.name} (${owner.email})` : simulator.ownerId],
      ['Status', simulator.status, true],
      ['Test status', simulator.testStatus, true],
      ['Evidence status', simulator.evidenceStatus, true],
    ]))}

    ${section('Simulator Overview', `
      <h3>Purpose</h3><p>${value(simulator.purpose)}</p>
      <h3>Business Goal</h3><p>${value(simulator.businessGoal)}</p>
      <h3>Problem Statement</h3><p>${value(simulator.problemStatement)}</p>
      <h3>User Personas</h3>${formatList(simulator.userPersonas)}
      <h3>Used By Stories</h3>${usedStories.length
        ? formatList(usedStories.map(story => `${story.id} - ${story.title}`))
        : formatList(simulator.usedByStories)}
    `)}

    <div class="grid">
      ${section('Simulates', formatList(simulator.scope?.simulates))}
      ${section('Does Not Simulate', formatList(simulator.scope?.doesNotSimulate))}
      ${section('Inputs', formatList(simulator.scope?.inputs))}
      ${section('Outputs', formatList(simulator.scope?.outputs))}
      ${section('Assumptions', formatList(simulator.scope?.assumptions))}
      ${section('Limitations', formatList(simulator.scope?.limitations))}
    </div>

    <div class="grid">
      ${section('Functional Requirements', formatOrderedList(simulator.functionalRequirements))}
      ${section('Non-Functional Requirements', formatList(simulator.nonFunctionalRequirements))}
      ${section('Technology Requirements', formatList(simulator.technologyRequirements))}
    </div>

    ${section('Architecture', `
      <h3>Architecture Notes</h3><p>${value(simulator.architectureNotes)}</p>
      <h3>CLI Flow</h3>${formatList(simulator.cliCommands)}
      <h3>Streamlit UI Flow</h3><p>${formatLink(simulator.streamlitLink || '')}</p>
      <h3>FastAPI Flow</h3><p>${formatLink(simulator.apiLink || '')}</p>
      <h3>Integration Notes</h3><p>Used by ${value(simulator.usedByStories.length)} story/stories through JSON input/output contracts and API/CLI workflows.</p>
    `)}

    <div class="grid">
      ${section('Sample Input JSON', formatJsonBlock(simulator.sampleInputJson))}
      ${section('Sample Output JSON', formatJsonBlock(simulator.sampleOutputJson))}
    </div>

    ${section('Commands & API', `
      <h3>CLI Commands</h3>${simulator.cliCommands?.length
        ? simulator.cliCommands.map(cmd => `<pre class="code-block">${escapeHtml(cmd)}</pre>`).join('')
        : '<p class="muted">Not provided</p>'}
      <h3>API Endpoints</h3>${simulator.apiEndpoints?.length
        ? `<table class="meta-table"><thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead><tbody>${simulator.apiEndpoints.map(ep => `
          <tr><td>${badge(ep.method)}</td><td><code>${value(ep.path)}</code></td><td>${value(ep.description)}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Not provided</p>'}
    `)}

    ${section('Testing', `
      <h3>Test Cases</h3>${formatTestCases(simulator.testCases)}
      <h3>Security Requirements</h3>${formatList(simulator.securityRequirements)}
      <h3>Manual Verification Steps</h3>${formatOrderedList(simulator.manualVerificationSteps)}
      <h3>Definition of Done</h3>${formatList(simulator.definitionOfDone)}
    `)}

    ${section('Delivery Plan', `
      <h3>Weekly Timeline</h3>${weeklyPlanTable(weeklyPlan)}
      <h3>Matching Assignments</h3>${assignmentSummary(assignments, undefined, simulator.id)}
    `, 'page-break')}

    ${section('Evidence Checklist', formatEvidenceChecklist(simulator.evidence))}

    ${section('Review', `
      <h3>QA Review</h3>${fields([
        ['Reviewer', simulator.qaReview.reviewer],
        ['Review date', simulator.qaReview.reviewDate],
        ['Status', simulator.qaReview.status, true],
        ['Issues found', simulator.qaReview.issuesFound],
        ['Severity', simulator.qaReview.severity],
        ['Retest status', simulator.qaReview.retestStatus],
        ['Comments', simulator.qaReview.comments],
      ])}
      <h3>Architect Approval</h3>${fields([
        ['Reviewer', simulator.architectApproval.reviewer],
        ['Review date', simulator.architectApproval.reviewDate],
        ['Status', simulator.architectApproval.status, true],
        ['Final decision', simulator.architectApproval.finalDecision],
        ['Comments', simulator.architectApproval.comments],
      ])}
    `)}
  `, title)
}

export function sanitizeFilename(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'export'
}

export function downloadHtml(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function copyHtml(html: string): Promise<void> {
  await navigator.clipboard.writeText(html)
}
