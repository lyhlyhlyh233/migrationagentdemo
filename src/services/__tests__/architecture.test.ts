import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();
describe("architecture dependency guards", () => {
  it.each([
    ["features", "import '@/services/mock';"],
    ["features", "export * from '../../services/http/client';"],
    ["app", "export const load = () => import('@/services/mock/index');"],
    ["stores", "import '@/services/mock';"],
    ["stores", "export * from '../features/conversations/state';"],
    ["stores", "export const load = () => import('@/app/context');"],
    ["services", "import '@/stores/workspaceStore';"],
    [
      "services",
      "export const load = () => import('../features/migration/ExecutionWorkspace');",
    ],
    ["domain", "import '@/stores/workspaceStore';"],
    ["domain", "export const load = () => import('@/shared/ui/Select');"],
  ])("rejects %s imports across the boundary: %s", async (layer, code) => {
    const [result] = await eslint.lintText(code, {
      filePath: `src/${layer}/boundary-probe.ts`,
    });
    expect(
      result.messages.some(
        (message) =>
          message.ruleId === "no-restricted-imports" ||
          message.ruleId === "no-restricted-syntax",
      ),
    ).toBe(true);
  });

  it.each([
    ["features", "import type {} from '@/services/contracts';"],
    ["stores", "import type {} from '@/domain/models';"],
    ["stores", "import 'zustand/vanilla';"],
    ["stores", "import '@/shared/preference-config';"],
    ["services", "import '@/domain/execution';"],
    ["services", "import './mock';"],
    ["domain", "import './models';"],
  ])("allows the intended %s dependency: %s", async (layer, code) => {
    const [result] = await eslint.lintText(code, {
      filePath: `src/${layer}/boundary-probe.ts`,
    });
    expect(result.errorCount).toBe(0);
  });
});
