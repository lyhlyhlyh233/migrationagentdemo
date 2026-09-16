import { useWorkspace, useWorkspaceSession } from "@/app/context";
import { ProjectSetup } from "@/features/projects/ProjectSetup";
import { SettingsDrawer } from "@/features/settings/SettingsDrawer";
import { Workspace } from "@/features/workspace/Workspace";
import { errorMessage } from "@/services/errors";
import { useTranslation } from "@/shared/i18n";
import { readPreference } from "@/shared/preferences";
import { EmptyState } from "@/shared/ui/Status";
import { Button } from "@/shared/ui/primitives";
import { Component, useState, type ReactNode } from "react";
import { WorkspaceProvider, useServiceSession } from "./WorkspaceProvider";
function Session({ onSignOut }: { onSignOut: () => void }) {
  const t = useTranslation();
  const { service, retry, store } = useWorkspaceSession();
  const loading = useWorkspace((s) => s.data.loading);
  const loadError = useWorkspace((s) => s.data.error);
  const creatingProject = useWorkspace((s) => s.ui.creating);
  const dispatchUi = useWorkspace((s) => s.dispatchUi);
  const account = useWorkspace((s) => s.account);
  const demoTools = useWorkspace(
    (s) => s.data.catalog?.capabilities?.demoTools === true,
  );
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  if (loading) return <EmptyState title="正在载入工作空间…" />;
  if (loadError)
    return (
      <EmptyState
        title="工作空间未能加载"
        detail={loadError}
        action={<Button onClick={retry}>{t("重试")}</Button>}
      />
    );
  return (
    <>
      {creatingProject ? (
        <ProjectSetup
          busy={creating}
          error={error}
          onCreate={async (info) => {
            if (creating) return;
            setCreating(true);
            setError("");
            try {
              const project = await service.createProject(
                info,
                readPreference("language"),
              );
              dispatchUi({
                type: "global",
                patch: { selected: project.id, creating: false },
              });
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setCreating(false);
            }
          }}
          onCancel={() =>
            dispatchUi({ type: "global", patch: { creating: false } })
          }
        />
      ) : (
        <Workspace onSettings={() => setSettings(true)} />
      )}
      <SettingsDrawer
        account={account}
        demoTools={demoTools}
        open={settings}
        onClose={() => setSettings(false)}
        onSignOut={async () => {
          try {
            await service.logout();
            onSignOut();
          } catch (e) {
            setError(errorMessage(e));
          }
        }}
        onConfigureAccount={async (configuration) => {
          const account = await service.configureAccount(configuration);
          store.getState().setAccount(account);
          return account;
        }}
      />
      {error && !creatingProject && <div role="alert">{t(error)}</div>}
    </>
  );
}
function AppSession() {
  const t = useTranslation();
  const { service, reset } = useServiceSession();
  const [signedOut, setSignedOut] = useState(false);
  const [session, setSession] = useState(0);
  if (!service) return <EmptyState title="正在载入工作空间…" />;
  return signedOut ? (
    <main className="signed-out-page">
      <EmptyState
        title="已退出当前账户"
        detail="本次项目与对话已清除，外观偏好已保留。"
        action={
          <Button
            onClick={() => {
              reset();
              setSession((n) => n + 1);
              setSignedOut(false);
            }}
          >
            {t("返回工作空间")}
          </Button>
        }
      />
    </main>
  ) : (
    <WorkspaceProvider key={session} service={service}>
      <Session onSignOut={() => setSignedOut(true)} />
    </WorkspaceProvider>
  );
}
class StartupBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: unknown) {
    return { error: errorMessage(e) };
  }
  render() {
    return this.state.error ? (
      <EmptyState title="无法启动工作空间" detail={this.state.error} />
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <StartupBoundary>
      <AppSession />
    </StartupBoundary>
  );
}
