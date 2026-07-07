// ── Corporate Document Catalog (PEOPLE-003) ─────────────────────────────────
// The full roadmap of document kinds the Corporate Document Engine is meant
// to eventually support. Only 'offer' and 'joining' are implemented today —
// everything else is a documented, visible catalog entry so the engine reads
// as "architecture ready" without pretending unbuilt workflows exist.
//
// Deliberately NOT merged into `LetterType` (which stays 'offer' | 'joining')
// so the existing, tightly-typed letter workflow is never put at risk by
// this broader, mostly-aspirational catalog.

export type DocumentCatalogCategory =
  | 'Offer & Joining'
  | 'Employment'
  | 'Completion & Experience'
  | 'Compensation & Recognition'
  | 'Legal & Compliance'

export interface DocumentCatalogEntry {
  key: string
  label: string
  category: DocumentCatalogCategory
  implemented: boolean
}

export const DOCUMENT_CATALOG: DocumentCatalogEntry[] = [
  { key: 'offer',                       label: 'Internship Offer Letter',        category: 'Offer & Joining',              implemented: true },
  { key: 'joining',                     label: 'Internship Joining Letter',      category: 'Offer & Joining',              implemented: true },
  { key: 'employment_offer',            label: 'Employment Offer Letter',        category: 'Employment',                   implemented: false },
  { key: 'employment_joining',          label: 'Employment Joining Letter',      category: 'Employment',                   implemented: false },
  { key: 'internship_completion',       label: 'Internship Completion Certificate', category: 'Completion & Experience',   implemented: false },
  { key: 'project_completion',          label: 'Project Completion Certificate', category: 'Completion & Experience',      implemented: false },
  { key: 'experience_letter',           label: 'Experience Letter',              category: 'Completion & Experience',      implemented: false },
  { key: 'relieving_letter',            label: 'Relieving Letter',               category: 'Completion & Experience',      implemented: false },
  { key: 'promotion_letter',            label: 'Promotion Letter',               category: 'Compensation & Recognition',   implemented: false },
  { key: 'salary_revision_letter',      label: 'Salary Revision Letter',         category: 'Compensation & Recognition',   implemented: false },
  { key: 'appreciation_letter',         label: 'Appreciation Letter',            category: 'Compensation & Recognition',   implemented: false },
  { key: 'nda',                        label: 'NDA',                            category: 'Legal & Compliance',           implemented: false },
  { key: 'confidentiality_agreement',   label: 'Confidentiality Agreement',      category: 'Legal & Compliance',           implemented: false },
  { key: 'ip_agreement',                label: 'IP Agreement',                   category: 'Legal & Compliance',           implemented: false },
  { key: 'policy_acknowledgement',      label: 'Policy Acknowledgement',         category: 'Legal & Compliance',           implemented: false },
]
