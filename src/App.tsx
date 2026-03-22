import { useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { FileExplorer } from "./components/FileExplorer/FileExplorer";
import { EditorSplitContainer } from "./components/Editor/EditorSplitContainer";
import { OutputPanel } from "./components/OutputPanel/OutputPanel";
import { TerminalPanel } from "./components/Terminal/TerminalPanel";
import { DebugPanel } from "./components/Debugger/DebugPanel";
import { StatusBar } from "./components/StatusBar/StatusBar";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { QuickOpen } from "./components/QuickOpen/QuickOpen";
import { SearchPanel } from "./components/SearchPanel/SearchPanel";
import { PackageManager } from "./components/PackageManager/PackageManager";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { ActivityBar } from "./components/ActivityBar/ActivityBar";
import { GitPanel } from "./components/Git/GitPanel";
import { ContainerPanel } from "./components/Container/ContainerPanel";
import { ContainerLogsPanel } from "./components/Container/ContainerLogsPanel";
import { WelcomeScreen } from "./components/Welcome/WelcomeScreen";
import { useSettingsStore } from "./stores/useSettingsStore";
import { useIdeStore } from "./stores/useIdeStore";
import { lspClient } from "./lsp/LspClient";
import { setMonacoMarkers } from "./lsp/juliaProviders";
import type { LspPublishDiagnosticsParams } from "./lsp/LspClient";
import type { ContainerOutputEvent, ContainerState, ContainerStatusEvent, DevContainerConfig, Problem } from "./types";
import "./App.css";


type PanelId = "output" | "terminal" | "problems" | "debug" | "packages" | "container-logs";

const PANEL_LABELS: Record<PanelId, string> = {
  output: "Output",
  terminal: "Terminal",
  problems: "Problems",
  debug: "Debug",
  packages: "Packages",
  "container-logs": "Container",
};

export default function App() {
  const activeBottomPanel = useIdeStore((s) => s.activeBottomPanel);
  const setActiveBottomPanel = useIdeStore((s) => s.setActiveBottomPanel);
  const bottomPanelHeight = useIdeStore((s) => s.bottomPanelHeight);
  const setBottomPanelHeight = useIdeStore((s) => s.setBottomPanelHeight);
  const sidebarWidth = useIdeStore((s) => s.sidebarWidth);
  const setSidebarWidth = useIdeStore((s) => s.setSidebarWidth);
  const problems = useIdeStore((s) => s.problems);
  const debug = useIdeStore((s) => s.debug);

  const workspacePath = useIdeStore((s) => s.workspacePath);
  const activeSidebarView = useIdeStore((s) => s.activeSidebarView);
  const setActiveSidebarView = useIdeStore((s) => s.setActiveSidebarView);
  const setLspStatus = useIdeStore((s) => s.setLspStatus);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
  const setProblems = useIdeStore((s) => s.setProblems);
  const setPlutoStatus = useIdeStore((s) => s.setPlutoStatus);
  const setFileTree = useIdeStore((s) => s.setFileTree);
  const getProblems = () => useIdeStore.getState().problems;

  // File watcher: start when workspace opens
  useEffect(() => {
    if (!workspacePath) return;
    invoke("watcher_start", { workspacePath }).catch(console.error);
    return () => {
      invoke("watcher_stop").catch(console.error);
    };
  }, [workspacePath]);

  // Handle fs-changed events: refresh tree, reload open file content
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    listen<{ path: string; kind: string }>("fs-changed", (e) => {
      // Debounce tree refresh (many events can fire rapidly)
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const wp = useIdeStore.getState().workspacePath;
        if (!wp) return;
        try {
          const tree = await invoke<import("./types").FileNode>("fs_get_tree", { path: wp });
          setFileTree(tree);
        } catch { /* ignore */ }
      }, 500);

      // Reload open file if modified externally and not dirty
      if (e.payload.kind === "modify") {
        const state = useIdeStore.getState();
        const tab = state.openTabs.find((t) => t.path === e.payload.path);
        if (tab && !tab.isDirty) {
          invoke<string>("fs_read_file", { path: tab.path }).then((content) => {
            if (content !== tab.content) {
              state.updateTabContent(tab.id, content, false);
            }
          }).catch(() => {});
        }
      }
    }).then((fn) => { unlisten = fn; });

    return () => {
      unlisten?.();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [setFileTree]);

  // LSP lifecycle: start when workspace opens, stop when it closes
  useEffect(() => {
    if (!workspacePath) return;
    lspClient.start(workspacePath).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      setLspStatus("error", msg);
    });
    return () => {
      lspClient.stop().catch(console.error);
    };
  }, [workspacePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror Rust lsp-status events into the store
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<{ status: string; message?: string }>("lsp-status", (e) => {
      setLspStatus(
        e.payload.status as "off" | "starting" | "ready" | "error",
        e.payload.message
      );
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror Rust pluto-status events into the store
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<{ status: string; message?: string }>("pluto-status", (e) => {
      setPlutoStatus(
        e.payload.status as "off" | "starting" | "ready" | "error",
        e.payload.message
      );
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror container-status events into the store
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<ContainerStatusEvent>("container-status", (e) => {
      const store = useIdeStore.getState();
      store.setContainerState(e.payload.status as ContainerState);
      if (e.payload.container_id) store.setContainerId(e.payload.container_id);
      if (e.payload.message) store.setContainerName(e.payload.message);
      if (e.payload.status === "running") store.setContainerMode(true);
      if (e.payload.status === "stopped" || e.payload.status === "none") {
        store.setContainerMode(false);
        store.setContainerId(null);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror container-output events into the store
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<ContainerOutputEvent>("container-output", (e) => {
      const store = useIdeStore.getState();
      store.appendContainerLog({
        kind: e.payload.kind as "stdout" | "stderr" | "info" | "done",
        text: e.payload.text,
      });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect devcontainer.json when workspace opens
  useEffect(() => {
    if (!workspacePath) return;
    const autoDetect = useSettingsStore.getState().settings.containerAutoDetect;
    if (!autoDetect) return;
    invoke<boolean>("devcontainer_detect", { workspacePath })
      .then((detected) => {
        useIdeStore.getState().setDevcontainerDetected(detected);
        if (detected) {
          invoke<DevContainerConfig>("devcontainer_load_config", { workspacePath })
            .then((config) => useIdeStore.getState().setDevcontainerConfig(config))
            .catch(() => {});
        }
      })
      .catch(() => useIdeStore.getState().setDevcontainerDetected(false));
  }, [workspacePath]);

  // Route LSP publishDiagnostics notifications to the store and Monaco markers
  useEffect(() => {
    const unsubscribe = lspClient.onNotification((method, params) => {
      if (method !== "textDocument/publishDiagnostics") return;
      const { uri, diagnostics } = params as LspPublishDiagnosticsParams;
      const filePath = uri.replace(/^file:\/\//, "");

      const otherProblems = getProblems().filter((p) => p.file !== filePath);
      const newProblems: Problem[] = diagnostics.map((d, i) => ({
        id: `lsp-${filePath}-${i}`,
        file: filePath,
        line: d.range.start.line + 1,
        col: d.range.start.character + 1,
        severity:
          d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "info",
        message: d.message,
      }));
      setProblems([...otherProblems, ...newProblems]);
      setMonacoMarkers(uri, diagnostics);
    });
    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isDraggingBottomRef = useRef(false);
  const isDraggingSidebarRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartWRef = useRef(0);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setActiveBottomPanel("terminal");
      }
      // Cmd/Ctrl+Shift+F for global search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setActiveSidebarView("search");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveBottomPanel, setActiveSidebarView]);

  const onBottomDragStart = useCallback((e: React.MouseEvent) => {
    isDraggingBottomRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHRef.current = bottomPanelHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [bottomPanelHeight]);

  const onSidebarDragStart = useCallback((e: React.MouseEvent) => {
    isDraggingSidebarRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWRef.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingBottomRef.current) {
        const delta = dragStartYRef.current - e.clientY;
        const newH = Math.max(80, Math.min(600, dragStartHRef.current + delta));
        setBottomPanelHeight(newH);
      }
      if (isDraggingSidebarRef.current) {
        const delta = e.clientX - dragStartXRef.current;
        const newW = Math.max(150, Math.min(480, dragStartWRef.current + delta));
        setSidebarWidth(newW);
      }
    };
    const onMouseUp = () => {
      isDraggingBottomRef.current = false;
      isDraggingSidebarRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [setBottomPanelHeight, setSidebarWidth]);

  const panels: PanelId[] = ["output", "terminal", "problems", "debug", "packages", "container-logs"];

  const currentTheme = useSettingsStore((s) => s.settings.theme);
  const themeClass = currentTheme === "julide-light" ? "theme-light" : "theme-dark";

  return (
    <div
      className={`ide-root ${themeClass}`}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* Toolbar spans full width */}
      <div className="ide-toolbar-area">
        <Toolbar />
      </div>

      {/* Activity Bar */}
      <ActivityBar />

      {/* Sidebar */}
      <div className="ide-sidebar" style={{ width: sidebarWidth }}>
        {activeSidebarView === "files" && <FileExplorer />}
        {activeSidebarView === "search" && <SearchPanel />}
        {activeSidebarView === "git" && <GitPanel />}
        {activeSidebarView === "container" && <ContainerPanel />}
      </div>

      {/* Sidebar resize handle */}
      <div
        className="sidebar-resize-handle"
        style={{ left: `calc(48px + ${sidebarWidth}px)` }}
        onMouseDown={onSidebarDragStart}
      />

      {/* Main content area */}
      <div className="ide-main">
        {/* Editor or Welcome Screen */}
        {!workspacePath && useIdeStore.getState().openTabs.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <EditorSplitContainer />
        )}

        {/* Bottom panel resize handle */}
        <div
          className="bottom-panel-resize-handle"
          onMouseDown={onBottomDragStart}
        />

        {/* Bottom panel */}
        <div className="ide-bottom-panel" style={{ height: bottomPanelHeight }}>
          <div className="bottom-panel-tabs">
            {panels.map((id) => (
              <button
                key={id}
                className={`bottom-tab ${activeBottomPanel === id ? "active" : ""}`}
                onClick={() => setActiveBottomPanel(id)}
              >
                {PANEL_LABELS[id]}
                {id === "problems" && problems.length > 0 && (
                  <span className="tab-badge">{problems.length}</span>
                )}
                {id === "debug" && debug.isDebugging && (
                  <span className="tab-badge debug-badge">●</span>
                )}
              </button>
            ))}
          </div>
          <div className="bottom-panel-content">
            {activeBottomPanel === "output" && <OutputPanel />}
            {activeBottomPanel === "terminal" && <TerminalPanel />}
            {activeBottomPanel === "problems" && <ProblemsPanel />}
            {activeBottomPanel === "debug" && <DebugPanel />}
            {activeBottomPanel === "packages" && <PackageManager />}
            {activeBottomPanel === "container-logs" && <ContainerLogsPanel />}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="ide-statusbar-area">
        <StatusBar />
      </div>

      {/* Overlays */}
      <CommandPalette />
      <QuickOpen />
      <SettingsPanel />
    </div>
  );
}

function ProblemsPanel() {
  const problems = useIdeStore((s) => s.problems);
  if (problems.length === 0) {
    return (
      <div className="problems-empty">
        <span>No problems detected.</span>
      </div>
    );
  }
  return (
    <div className="problems-list">
      {problems.map((p) => (
        <div key={p.id} className={`problem-item ${p.severity}`}>
          <span className="problem-severity">{p.severity === "error" ? "✕" : "⚠"}</span>
          <span className="problem-message">{p.message}</span>
          <span className="problem-location">
            {p.file.split(/[/\\]/).pop()}:{p.line}:{p.col}
          </span>
        </div>
      ))}
    </div>
  );
}
