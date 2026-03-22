import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useIdeStore } from "../../stores/useIdeStore";
import { GitBranch, Container } from "lucide-react";

export function StatusBar() {
  const juliaVersion = useIdeStore((s) => s.juliaVersion);
  const juliaEnv = useIdeStore((s) => s.juliaEnv);
  const isRunning = useIdeStore((s) => s.isRunning);
  const debug = useIdeStore((s) => s.debug);
  const openTabs = useIdeStore((s) => s.openTabs);
  const activeTabId = useIdeStore((s) => s.activeTabId);
  const lspStatus = useIdeStore((s) => s.lspStatus);
  const lspErrorMessage = useIdeStore((s) => s.lspErrorMessage);
  const reviseEnabled = useIdeStore((s) => s.reviseEnabled);
  const plutoStatus = useIdeStore((s) => s.plutoStatus);
  const plutoMessage = useIdeStore((s) => s.plutoMessage);
  const setJuliaVersion = useIdeStore((s) => s.setJuliaVersion);
  const setAvailableEnvs = useIdeStore((s) => s.setAvailableEnvs);

  const workspacePath = useIdeStore((s) => s.workspacePath);
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const [gitBranch, setGitBranch] = useState("");

  useEffect(() => {
    if (!workspacePath) { setGitBranch(""); return; }
    invoke<boolean>("git_is_repo", { workspacePath }).then((isRepo) => {
      if (isRepo) {
        invoke<string>("git_branch_current", { workspacePath }).then(setGitBranch).catch(() => setGitBranch(""));
      } else {
        setGitBranch("");
      }
    }).catch(() => setGitBranch(""));
  }, [workspacePath]);

  useEffect(() => {
    invoke<string>("julia_get_version")
      .then((v) => setJuliaVersion(v))
      .catch(() => setJuliaVersion("Julia not found"));

    invoke<string[]>("julia_list_environments")
      .then((envs) => setAvailableEnvs(envs))
      .catch(() => {});
  }, [setJuliaVersion, setAvailableEnvs]);

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span
          className={`status-item status-julia ${isRunning ? "running" : ""} ${debug.isDebugging ? "debugging" : ""}`}
          title={juliaVersion}
        >
          {debug.isDebugging ? "🐛 Debugging" : isRunning ? "▶ Running" : `⚡ ${juliaVersion}`}
        </span>
        <span className="status-item status-env" title="Julia environment">
          env: {juliaEnv}
        </span>
        {gitBranch && (
          <span className="status-item status-git" title={`Git branch: ${gitBranch}`}>
            <GitBranch size={11} /> {gitBranch}
          </span>
        )}
        {useIdeStore.getState().containerMode && (
          <span
            className={`status-item status-container status-container-${useIdeStore.getState().containerState}`}
            title={useIdeStore.getState().containerName ? `Container: ${useIdeStore.getState().containerName}` : "Dev Container"}
          >
            <Container size={11} />{" "}
            {useIdeStore.getState().containerState === "running"
              ? "Container"
              : useIdeStore.getState().containerState === "building"
              ? "Building..."
              : useIdeStore.getState().containerState === "starting"
              ? "Starting..."
              : useIdeStore.getState().containerState === "error"
              ? "Container Err"
              : "Container"}
          </span>
        )}
      </div>

      <div className="status-center">
        <span className="status-item status-filename">
          {activeTab ? activeTab.name : "julIDE"}
        </span>
      </div>

      <div className="status-bar-right">
        {activeTab && (
          <span className="status-item status-language">
            {activeTab.name.endsWith(".jl") ? "Julia" : "Text"}
          </span>
        )}
        <span className="status-item status-encoding">UTF-8</span>
        {reviseEnabled && (
          <span
            className="status-item status-revise"
            title="Revise.jl hot-reload active"
          >
            Rev ●
          </span>
        )}
        {plutoStatus !== "off" && (
          <span
            className={`status-item status-pluto status-pluto-${plutoStatus}`}
            title={
              plutoStatus === "error"
                ? (plutoMessage ?? "Pluto error")
                : plutoStatus === "ready"
                ? (plutoMessage ?? "Pluto running")
                : "Pluto starting…"
            }
          >
            {plutoStatus === "starting"
              ? "Pluto…"
              : plutoStatus === "ready"
              ? "Pluto ●"
              : "Pluto ✕"}
          </span>
        )}
        <span
          className={`status-item status-lsp status-lsp-${lspStatus}`}
          title={
            lspStatus === "error"
              ? (lspErrorMessage ?? "LSP error")
              : `Julia LSP: ${lspStatus}`
          }
        >
          {lspStatus === "off"
            ? "LSP"
            : lspStatus === "starting"
            ? "LSP…"
            : lspStatus === "ready"
            ? "LSP ●"
            : "LSP ✕"}
        </span>
      </div>
    </div>
  );
}
