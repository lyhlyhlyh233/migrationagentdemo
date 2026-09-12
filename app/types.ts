export type MigrationPhaseId = 'assessment' | 'planning' | 'implementation' | 'validation';

export interface MigrationPhase {
  id: MigrationPhaseId;
  name: string;
  englishName: string;
  detail: string;
  status: 'completed' | 'active' | 'pending';
  progress: number;
  gatesPassed: number;
  gatesTotal: number;
}

export interface MigrationProject {
  id: string;
  name: string;
  sourceStack: string;
  targetStack: string;
  progress: number;
  health: 'healthy' | 'at-risk' | 'blocked';
  currentPhase: MigrationPhaseId;
  phases: MigrationPhase[];
}

export interface ExecutionStep {
  id: string;
  label: string;
  status: 'completed' | 'running' | 'pending' | 'failed';
  duration?: string;
}

export interface AgentRun {
  id: string;
  title: string;
  status: 'running' | 'paused' | 'stopped' | 'waiting-approval' | 'completed';
  progress: number;
  steps: ExecutionStep[];
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  time: string;
  run?: AgentRun;
  approvalId?: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  summary: string;
  reason: string;
  impact: string[];
  rollback: string;
  risk: 'high' | 'medium';
  status: 'pending' | 'approved' | 'rejected' | 'changes-requested';
}

export interface MigrationTask {
  id: string;
  title: string;
  phase: MigrationPhaseId;
  owner: string;
  status: 'done' | 'running' | 'blocked' | 'todo';
  due: string;
}

export interface Risk {
  id: string;
  title: string;
  level: 'high' | 'medium' | 'low';
  status: 'open' | 'mitigating' | 'closed';
  owner: string;
}

export interface Artifact {
  id: string;
  name: string;
  type: 'report' | 'code' | 'plan' | 'evidence';
  phase: MigrationPhaseId;
  updatedAt: string;
  status: 'ready' | 'draft' | 'review';
}

export interface ValidationResult {
  id: string;
  name: string;
  passed: number;
  total: number;
  status: 'passed' | 'warning' | 'failed';
}
