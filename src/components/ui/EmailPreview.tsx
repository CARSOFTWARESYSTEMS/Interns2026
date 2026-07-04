import { useState } from 'react'
import { Copy, Download, CheckCircle, Mail } from 'lucide-react'
import type { Assignment, Developer, Story, Simulator } from '../../types'

interface EmailPreviewProps {
  assignment: Assignment
  developer: Developer
  story: Story
  simulator?: Simulator
}

function buildEmailHTML(
  a: Assignment, dev: Developer, story: Story, sim: Simulator | undefined
): string {
  const daysRem = Math.ceil((new Date(a.dueDate).getTime() - new Date().getTime()) / 86400000)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>UFlight™ | EV.ENGINEER™ Internship Assignment</title>
<style>
  body { font-family: 'Arial', sans-serif; background: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
  .container { max-width: 680px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: #0f172a; padding: 32px; text-align: center; }
  .header h1 { color: #3b82f6; margin: 0; font-size: 22px; letter-spacing: 2px; }
  .header p { color: #94a3b8; margin: 6px 0 0; font-size: 13px; }
  .banner { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 20px 32px; color: white; }
  .banner h2 { margin: 0; font-size: 18px; }
  .banner p { margin: 4px 0 0; opacity: 0.85; font-size: 13px; }
  .section { padding: 24px 32px; border-bottom: 1px solid #f1f5f9; }
  .section h3 { color: #1e40af; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field label { display: block; font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  .field span { font-size: 13px; font-weight: 700; color: #1e293b; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #dbeafe; color: #1e40af; }
  .badge.critical { background: #fee2e2; color: #dc2626; }
  .badge.high { background: #fed7aa; color: #c2410c; }
  .deliverable { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; font-size: 13px; }
  .deliverable::before { content: "▹"; color: #3b82f6; flex-shrink: 0; margin-top: 1px; }
  .footer { padding: 20px 32px; background: #f8fafc; text-align: center; }
  .footer p { font-size: 11px; color: #94a3b8; margin: 4px 0; }
  .cta { background: #1e40af; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; display: inline-block; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  td:first-child { color: #64748b; font-weight: 600; width: 44%; }
  td:last-child { font-weight: 700; color: #1e293b; }
</style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div class="header">
    <h1>UFlight™ | EV.ENGINEER™</h1>
    <p>Aerospace Intelligence & Cybersecurity Platform · Intern Program 2026</p>
  </div>

  <!-- Banner -->
  <div class="banner">
    <h2>🎓 Internship Assignment — ${a.id}</h2>
    <p>${a.product} · ${a.workPackage} · Due ${a.dueDate} · ${daysRem} days remaining</p>
  </div>

  <!-- Greeting -->
  <div class="section">
    <p style="font-size:15px; line-height:1.7;">Dear <strong>${dev.name}</strong>,</p>
    <p style="font-size:14px; color:#475569; line-height:1.7;">
      Welcome to the <strong>UFlight™ | EV.ENGINEER™ Aerospace Intelligence & Cybersecurity Platform Internship Program 2026</strong>.
      You have been assigned to build a critical engineering module for the ${a.product}.
      This document is your official engineering contract — please read it carefully and confirm acceptance by replying to this email.
    </p>
  </div>

  <!-- Assignment Details -->
  <div class="section">
    <h3>Assignment Details</h3>
    <div class="grid">
      <div class="field"><label>Assignment ID</label><span>${a.id}</span></div>
      <div class="field"><label>Priority</label><span class="badge ${a.priority === 'Critical' ? 'critical' : a.priority === 'High' ? 'high' : ''}">${a.priority}</span></div>
      <div class="field"><label>Product</label><span>${a.product}</span></div>
      <div class="field"><label>Work Package</label><span>${a.workPackage}</span></div>
      <div class="field"><label>Story ID</label><span>${a.storyId}</span></div>
      <div class="field"><label>Simulator ID</label><span>${a.simulatorId}</span></div>
      <div class="field"><label>Created</label><span>${a.createdDate}</span></div>
      <div class="field"><label>Due Date</label><span>${a.dueDate}</span></div>
      <div class="field"><label>Estimated Hours</label><span>${a.estimatedHours} hours</span></div>
      <div class="field"><label>Weekly Hours</label><span>${a.weeklyHours} hrs/week</span></div>
    </div>
  </div>

  <!-- Story -->
  <div class="section">
    <h3>Your User Story</h3>
    <p style="font-size:14px; font-weight:700; color:#1e293b; margin-bottom:8px;">${story.title}</p>
    <p style="font-size:13px; color:#64748b; line-height:1.7; font-style:italic; background:#f8fafc; padding:12px; border-radius:8px; border-left:3px solid #3b82f6; margin-bottom:12px;">"${story.userStory}"</p>
    <p style="font-size:13px; color:#475569; line-height:1.7;"><strong>Business Goal:</strong> ${story.businessGoal}</p>
  </div>

  <!-- Simulator -->
  <div class="section">
    <h3>${sim ? 'Your Simulator' : 'Desktop Application'}</h3>
    ${sim
      ? `<p style="font-size:14px; font-weight:700; color:#1e293b; margin-bottom:6px;">${sim.name}</p>
    <p style="font-size:13px; color:#475569; line-height:1.7;">${sim.purpose}</p>
    <table style="margin-top:12px;">
      ${sim.githubRepo ? `<tr><td>GitHub Repository</td><td><a href="${sim.githubRepo}" style="color:#1e40af;">${sim.githubRepo}</a></td></tr>` : ''}
      ${sim.streamlitLink ? `<tr><td>Streamlit Dashboard</td><td><a href="${sim.streamlitLink}" style="color:#1e40af;">${sim.streamlitLink}</a></td></tr>` : ''}
      ${sim.apiLink ? `<tr><td>FastAPI Endpoint</td><td><a href="${sim.apiLink}" style="color:#1e40af;">${sim.apiLink}</a></td></tr>` : ''}
    </table>`
      : `<p style="font-size:13px; color:#475569; line-height:1.7;">This product uses a local desktop application (FastAPI + Streamlit) instead of a standalone simulator. Set up the application per the README and story instructions.</p>`
    }
  </div>

  <!-- Developer Info -->
  <div class="section">
    <h3>Developer Information</h3>
    <table>
      <tr><td>Name</td><td>${dev.name}</td></tr>
      <tr><td>Email</td><td>${dev.email}</td></tr>
      <tr><td>Developer ID</td><td>${dev.id}</td></tr>
      <tr><td>Weekly Availability</td><td>${dev.weeklyAvailability}</td></tr>
      <tr><td>Expected Hours/Week</td><td>${dev.expectedWeeklyHours}</td></tr>
    </table>
  </div>

  <!-- Deliverables -->
  <div class="section">
    <h3>Expected Deliverables</h3>
    ${sim ? `<div class="deliverable">Python simulator (CLI + Streamlit UI + FastAPI) — ${sim.name}</div>` : '<div class="deliverable">Local desktop application (FastAPI + Streamlit + SQLite)</div>'}
    <div class="deliverable">Functional user story implementation: ${story.title}</div>
    <div class="deliverable">Architecture document (Google Drive)</div>
    <div class="deliverable">GitHub repository with clean commit history</div>
    <div class="deliverable">Feature branch and pull request</div>
    <div class="deliverable">README with setup, usage, and sample JSON</div>
    <div class="deliverable">API documentation</div>
    <div class="deliverable">Test report with ≥ 80% coverage</div>
    <div class="deliverable">Security review report</div>
    <div class="deliverable">Verification report (manual test checklist)</div>
    <div class="deliverable">Demo video (≤ 5 minutes)</div>
    <div class="deliverable">Final presentation slides</div>
  </div>

  <!-- Timeline -->
  <div class="section">
    <h3>Internship Timeline</h3>
    <table>
      <tr><td>Week 0 (Jul 1–3)</td><td>Onboarding, environment setup, BPAN deep dive</td></tr>
      <tr><td>Week 1–2 (Jul 6–17)</td><td>Research, requirements analysis, architecture design</td></tr>
      <tr><td>Week 3–4 (Jul 20–31)</td><td>Simulator POC development and testing</td></tr>
      <tr><td>Week 5–7 (Aug 3–21)</td><td>Core story development, integration with simulator</td></tr>
      <tr><td>Week 8–9 (Aug 24 – Sep 3)</td><td>Unit testing, integration testing, security review</td></tr>
      <tr><td>Week 10–11 (Sep 7–18)</td><td>QA review, bug fixes, evidence submission</td></tr>
      <tr><td>Week 12–13 (Sep 21–25)</td><td>Architect review, approvals, demo preparation</td></tr>
      <tr><td>Final (Sep 28–30)</td><td>Final demo presentation</td></tr>
    </table>
  </div>

  <!-- Review Schedule -->
  <div class="section">
    <h3>Review Schedule</h3>
    <table>
      <tr><td>Weekly Status Update</td><td>Every Monday via email to mentor</td></tr>
      <tr><td>Mid-point Check-in</td><td>August 10–14 (Week 6)</td></tr>
      <tr><td>QA Review</td><td>September 7–11 (Week 10)</td></tr>
      <tr><td>Architect Review</td><td>September 14–18 (Week 11–12)</td></tr>
      <tr><td>Final Demo</td><td>September 28–30, 2026</td></tr>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p><strong>Questions?</strong> Reply to this email or contact your mentor.</p>
    <p>Please reply <strong>"Accepted"</strong> to confirm you have read and understood this assignment.</p>
    <p style="margin-top:16px; color:#cbd5e1;">UFlight™ | EV.ENGINEER™ Aerospace Intelligence & Cybersecurity Platform · Intern Program 2026</p>
    <p style="margin-top:12px; color:#94a3b8; font-weight:700; font-size:12px;">iTelematics Software Private Limited</p>
    <p style="color:#94a3b8; font-size:11px;">Bangalore, India</p>
    <p style="margin-top:6px; font-size:11px;">
      <a href="mailto:info@iTelematics.com" style="color:#60a5fa; text-decoration:none;">info@iTelematics.com</a>
      &nbsp;·&nbsp;
      <a href="tel:+919108206147" style="color:#94a3b8; text-decoration:none;">+91 91082 06147</a>
      &nbsp;·&nbsp;
      <a href="https://wa.me/919108206147" style="color:#4ade80; text-decoration:none;">WhatsApp</a>
    </p>
    <p style="margin-top:10px; color:#cbd5e1;">This is an internal assignment document. Do not share externally.</p>
  </div>
</div>
</body>
</html>`
}

export default function EmailPreview({ assignment, developer, story, simulator }: EmailPreviewProps) {
  const [copied, setCopied] = useState(false)

  const html = buildEmailHTML(assignment, developer, story, simulator)
  const subject = `UFlight™ | EV.ENGINEER™ Internship Assignment — ${assignment.id} — ${developer.name}`

  function handleCopy() {
    navigator.clipboard.writeText(html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${assignment.id}-${developer.name.replace(/\s+/g, '-')}-assignment-email.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <p className="text-xs text-slate-500 mb-0.5">Subject</p>
          <p className="text-sm font-semibold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-mono">{subject}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleCopy} className="btn-secondary gap-1.5">
            {copied ? <CheckCircle size={13} className="text-green-500"/> : <Copy size={13}/>}
            {copied ? 'Copied!' : 'Copy HTML'}
          </button>
          <button onClick={handleDownload} className="btn-primary gap-1.5">
            <Download size={13}/> Download
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <Mail size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800">
          <p className="font-semibold mb-0.5">Email Preview Only</p>
          <p>Gmail API integration is planned for a future milestone. For now, download the HTML file or copy it and paste into your email client.</p>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-100 px-4 py-2 flex items-center gap-2 border-b border-slate-200">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-slate-500 font-medium ml-2">Email Preview</span>
        </div>
        <iframe
          srcDoc={html}
          className="w-full"
          style={{ height: '600px', border: 'none' }}
          title="Email Preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  )
}
