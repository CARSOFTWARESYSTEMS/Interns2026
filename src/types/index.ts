export type Status =
  | 'Not Started' | 'Research' | 'Requirements'
  | 'Simulator Development' | 'Simulator QA' | 'POC Development'
  | 'Architecture Review' | 'Product Development' | 'Unit Testing'
  | 'Cross Testing' | 'QA Review' | 'Bug Fixing' | 'Security Review'
  | 'Architect Review' | 'Demo Ready' | 'Approved' | 'Blocked';

export type QAStatus = 'Pending' | 'In Review' | 'Passed' | 'Failed' | 'Blocked';
export type ArchitectStatus = 'Pending' | 'In Review' | 'Approved' | 'Changes Required' | 'Rejected';
export type DemoStatus = 'Not Ready' | 'In Preparation' | 'Ready' | 'Presented' | 'Accepted';
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
export type EvidenceStatus = 'Missing' | 'Submitted' | 'Review Pending' | 'Approved';

export interface Developer {
  id: string;
  name: string;
  email: string;
  product: string;
  simulatorId: string;
  storyId: string;
  githubRepo: string;
  branch: string;
  pullRequest: string;
  driveFolder: string;
  status: Status;
  qaStatus: QAStatus;
  architectStatus: ArchitectStatus;
  demoStatus: DemoStatus;
  weeklyAvailability: string;
  expectedWeeklyHours: string;
  blockers: string;
  mentorNotes: string;
  qaNotes: string;
  architectNotes: string;
}

export interface SimulatorScope {
  simulates: string[];
  doesNotSimulate: string[];
  inputs: string[];
  outputs: string[];
  assumptions: string[];
  limitations: string[];
}

export interface TestCase {
  id: string;
  name: string;
  type: 'Unit' | 'Integration' | 'Negative' | 'Edge' | 'Security';
  description: string;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
}

export interface EvidenceFields {
  driveFolder: string;
  architectureDoc: string;
  designDoc: string;
  githubRepo: string;
  branch: string;
  pullRequest: string;
  verificationReport: string;
  securityReport: string;
  demoVideo: string;
  presentation: string;
  screenshots: string;
  readme: string;
  apiDoc: string;
  testReport: string;
  coverageReport: string;
  researchNotes: string;
  patentNotes: string;
  releaseNotes: string;
}

export interface QAReview {
  reviewer: string;
  reviewDate: string;
  status: QAStatus;
  issuesFound: string;
  severity: string;
  retestStatus: string;
  comments: string;
}

export interface ArchitectApproval {
  reviewer: string;
  reviewDate: string;
  status: ArchitectStatus;
  comments: string;
  finalDecision: string;
}

export interface FinalDemo {
  demoDate: string;
  demoLink: string;
  status: DemoStatus;
  evSocietyComments: string;
  certificateEligible: boolean;
}

export interface Simulator {
  id: string;
  name: string;
  ownerId: string;
  product: string;
  status: Status;
  githubRepo: string;
  streamlitLink: string;
  apiLink: string;
  testStatus: string;
  evidenceStatus: EvidenceStatus;
  purpose: string;
  businessGoal: string;
  problemStatement: string;
  userPersonas: string[];
  scope: SimulatorScope;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  technologyRequirements: string[];
  architectureNotes: string;
  sampleInputJson: Record<string, unknown>;
  sampleOutputJson: Record<string, unknown>;
  cliCommands: string[];
  apiEndpoints: ApiEndpoint[];
  testCases: TestCase[];
  securityRequirements: string[];
  manualVerificationSteps: string[];
  definitionOfDone: string[];
  usedByStories: string[];
  evidence: EvidenceFields;
  qaReview: QAReview;
  architectApproval: ArchitectApproval;
}

export interface Story {
  id: string;
  title: string;
  product: string;
  workPackage: string;
  developerId: string;
  simulatorIds: string[];
  priority: Priority;
  status: Status;
  dueDate: string;
  currentPhase: string;
  overallProgress: number;
  riskStatus: string;
  qaStatus: QAStatus;
  architectStatus: ArchitectStatus;
  demoStatus: DemoStatus;
  businessGoal: string;
  problemStatement: string;
  userPersona: string;
  epic: string;
  userStory: string;
  description: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  uiRequirements: string[];
  architectureNotes: string;
  sampleInputJson: Record<string, unknown>;
  sampleOutputJson: Record<string, unknown>;
  acceptanceCriteria: string[];
  definitionOfDone: string[];
  positiveUseCases: string[];
  negativeUseCases: string[];
  testCases: TestCase[];
  securityRequirements: string[];
  securityTestCases: string[];
  manualVerificationSteps: string[];
  evidence: EvidenceFields;
  qaReview: QAReview;
  architectApproval: ArchitectApproval;
  finalDemo: FinalDemo;
}

export interface WeeklyPlan {
  week: string;
  dates: string;
  title: string;
  activities: string[];
  focus: string;
}

// ── Assignment Module ─────────────────────────────────────────────────────────

export type AssignmentStatus =
  | 'Draft' | 'Assigned' | 'Accepted' | 'Research' | 'Analysis'
  | 'Simulator Development' | 'Simulator QA' | 'POC' | 'Architecture'
  | 'Development' | 'Unit Testing' | 'Integration' | 'Cross Testing'
  | 'QA Review' | 'Bug Fixes' | 'Architect Review' | 'Demo Ready'
  | 'Completed' | 'Blocked' | 'Cancelled';

export interface AssignmentEvidenceItem {
  status: 'Missing' | 'Submitted' | 'Approved' | 'Rejected';
  link: string;
  date: string;
  comments: string;
}

export interface AssignmentEvidence {
  architecture: AssignmentEvidenceItem;
  design: AssignmentEvidenceItem;
  github: AssignmentEvidenceItem;
  branch: AssignmentEvidenceItem;
  pr: AssignmentEvidenceItem;
  readme: AssignmentEvidenceItem;
  apiDoc: AssignmentEvidenceItem;
  verification: AssignmentEvidenceItem;
  security: AssignmentEvidenceItem;
  presentation: AssignmentEvidenceItem;
  demo: AssignmentEvidenceItem;
  research: AssignmentEvidenceItem;
  patent: AssignmentEvidenceItem;
  releaseNotes: AssignmentEvidenceItem;
}

export interface HistoryEntry {
  date: string;
  action: string;
  by: string;
  note: string;
}

export interface Assignment {
  id: string;
  product: string;
  workPackage: string;
  storyId: string;
  simulatorId: string;
  developerId: string;
  qaId: string;
  architectId: string;
  priority: Priority;
  status: AssignmentStatus;
  progress: number;
  estimatedHours: number;
  weeklyHours: number;
  dueDate: string;
  createdDate: string;
  dependencies: string[];
  evidence: AssignmentEvidence;
  history: HistoryEntry[];
}
