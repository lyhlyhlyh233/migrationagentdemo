import {
  initialExecutionView,
  initialValidationView,
  type ExecutionView,
  type ValidationView,
} from "@/features/migration/state";
import type { Catalog, ProjectSnapshot, StageId } from "@/domain/models";
import { EMPTY_WORKSPACE_ID } from "@/domain/models";
import type { RiskLocation } from "@/features/risks/presentation";
import {
  initialPlanningView,
  type PlanningView,
} from "@/features/planning/state";
export type SidePanelTab = "risk" | "planning" | "execution" | "validation";
export type PanelId =
  | "planning"
  | "execution"
  | "connection"
  | "issues"
  | "tasks"
  | "risk"
  | "deliverables"
  | "logs"
  | "creation"
  | "sync"
  | "cutover"
  | "validation"
  | null;
export type { ConversationView } from "@/features/conversations/state";
export interface ProjectUi {
  activeStage: StageId;
  conversationId: string | null;
  lastStages: Partial<Record<StageId, string>>;
  panel: PanelId;
  notice: string;
  handoff: StageId | null;
  riskLocation: RiskLocation;
  assessmentRiskOpened: boolean;
  planningOpened: boolean;
  planningView: PlanningView;
  managementChatCollapsed: boolean;
  contextLabel: string;
  executionView: ExecutionView;
  validationView: ValidationView;
  executionOpened: boolean;
  validationOpened: boolean;
  sidePanel: {
    tabs: SidePanelTab[];
    active: SidePanelTab;
    open: boolean;
  };
}
export const projectUi = (): ProjectUi => ({
  activeStage: "research",
  conversationId: null,
  lastStages: {},
  panel: null,
  notice: "",
  handoff: null,
  riskLocation: { mode: "category" },
  assessmentRiskOpened: false,
  planningOpened: false,
  planningView: initialPlanningView(),
  managementChatCollapsed: false,
  contextLabel: "",
  executionView: initialExecutionView(),
  validationView: initialValidationView(),
  executionOpened: false,
  validationOpened: false,
  sidePanel: { tabs: [], active: "risk", open: false },
});
export interface UiState {
  selected: string;
  creating: boolean;
  navCollapsed: boolean;
  projects: Record<string, ProjectUi>;
}
export const initialUi: UiState = {
  selected: EMPTY_WORKSPACE_ID,
  creating: false,
  navCollapsed: false,
  projects: {},
};
export type UiAction =
  | { type: "planning-view"; id: string; patch: Partial<PlanningView> }
  | { type: "global"; patch: Partial<Omit<UiState, "projects">> }
  | { type: "project"; id: string; patch: Partial<ProjectUi> }
  | {
      type: "conversation";
      id: string;
      conversationId: string;
      stageId?: StageId;
      expected?: string;
    };
export function uiReducer(s: UiState, a: UiAction): UiState {
  if (a.type === "global") return { ...s, ...a.patch };
  const p = s.projects[a.id] ?? projectUi();
  if (a.type === "planning-view")
    return {
      ...s,
      projects: {
        ...s.projects,
        [a.id]: { ...p, planningView: { ...p.planningView, ...a.patch } },
      },
    };
  if (a.type === "project")
    return { ...s, projects: { ...s.projects, [a.id]: { ...p, ...a.patch } } };
  if (a.expected && p.conversationId && p.conversationId !== a.expected)
    return s;
  return {
    ...s,
    projects: {
      ...s.projects,
      [a.id]: {
        ...p,
        conversationId: a.conversationId,
        panel: null,
        handoff: null,
        activeStage: a.stageId ?? p.activeStage,
        lastStages: a.stageId
          ? { ...p.lastStages, [a.stageId]: a.conversationId }
          : p.lastStages,
      },
    },
  };
}
export interface DataState {
  snapshots: Record<string, ProjectSnapshot>;
  catalog: Catalog | null;
  loading: boolean;
  error: string;
}
export type DataAction =
  | { type: "snapshot"; snapshot: ProjectSnapshot }
  | { type: "ready"; catalog: Catalog }
  | { type: "error"; message: string }
  | { type: "loading" };
export const initialData: DataState = {
  snapshots: {},
  catalog: null,
  loading: true,
  error: "",
};
export function dataReducer(s: DataState, a: DataAction): DataState {
  if (a.type === "snapshot") {
    const old = s.snapshots[a.snapshot.id];
    if (old && old.revision > a.snapshot.revision) return s;
    return { ...s, snapshots: { ...s.snapshots, [a.snapshot.id]: a.snapshot } };
  }
  if (a.type === "ready")
    return { ...s, catalog: a.catalog, loading: false, error: "" };
  if (a.type === "loading") return { ...s, loading: true, error: "" };
  return { ...s, loading: false, error: a.message };
}
