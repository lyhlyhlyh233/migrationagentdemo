import type {
  MigrationConnectionInput,
  SimulationScenario,
} from "@/domain/execution";
export interface ExecutionView {
  batchId: string;
  issueId: string;
  expandedTask?: string;
  dashboardPage: number;
  dashboardSize: number;
  selected: string[];
  computeResource: string;
  network: string;
  window: string;
  targetBatchId: string;
  scenario: SimulationScenario;
  connectionDraft?: Omit<MigrationConnectionInput, "password">;
  solution: "automatic" | "manual";
  note: string;
  simulateFailure: boolean;
  diagnosticFailure: "" | "log-failed" | "inconclusive";
}
export const initialExecutionView = (): ExecutionView => ({
  dashboardPage: 1,
  dashboardSize: 10,
  batchId: "",
  issueId: "",
  selected: [],
  computeResource: "目标资源池",
  network: "目标业务网络",
  window: "",
  targetBatchId: "",
  scenario: "normal",
  solution: "automatic",
  note: "",
  simulateFailure: false,
  diagnosticFailure: "",
});
export interface ValidationView {
  group: "batch" | "system";
  scope: string;
  query: string;
  status: string;
  page: number;
  size: number;
  selected: string[];
  expanded: string;
  editor: "" | "record" | "difference" | "feedback";
  result: "passed" | "failed" | "pending";
  note: string;
  blocking: boolean;
  editorRevision?: number;
  feedbackRevision?: number;
  feedbackId: string;
  resolution: string;
}
export const initialValidationView = (): ValidationView => ({
  group: "batch",
  scope: "",
  query: "",
  status: "",
  page: 1,
  size: 20,
  selected: [],
  expanded: "",
  editor: "",
  result: "passed",
  note: "",
  blocking: true,
  feedbackId: "",
  resolution: "",
});
