import { useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { FileExplorer } from "./components/FileExplorer/FileExplorer";
import { EditorTabs } from "./components/Editor/EditorTabs";
import { MonacoEditor } from "./components/Editor/MonacoEditor";
import { OutputPanel } from "./components/OutputPanel/OutputPanel";
import { TerminalPanel } from "./components/Terminal/TerminalPanel";
import { DebugPanel } from "./components/Debugger/DebugPanel";
import { StatusBar } from "./components/StatusBar/StatusBar";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { PackageManager } from "./components/PackageManager/PackageManager";
import { useIdeStore } from "./stores/useIdeStore";
import { lspClient } from "./lsp/LspClient";
import { setMonacoMarkers } from "./lsp/juliaProviders";
import type { LspPublishDiagnosticsParams } from "./lsp/LspClient";
import type { Problem } from "./types";
import "./App.css";


type PanelId = "output" | "terminal" | "problems" | "debug" | "packages";

const PANEL_LABELS: Record<PanelId, string> = {
  output: "Output",
  terminal: "Terminal",
  problems: "Problems",
  debug: "Debug",
  packages: "Packages",
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
  const setLspStatus = useIdeStore((s) => s.setLspStatus);
  const setProblems = useIdeStore((s) => s.setProblems);
  const setPlutoStatus = useIdeStore((s) => s.setPlutoStatus);
  const getProblems = () => useIdeStore.getState().problems;

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

  // Keyboard shortcut: Ctrl+` for terminal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setActiveBottomPanel("terminal");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveBottomPanel]);

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

  const panels: PanelId[] = ["output", "terminal", "problems", "debug", "packages"];

  return (
    <div
      className="ide-root"
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* Toolbar spans full width */}
      <div className="ide-toolbar-area">
        <Toolbar />
      </div>

      {/* Sidebar */}
      <div className="ide-sidebar" style={{ width: sidebarWidth }}>
        <FileExplorer />
      </div>

      {/* Sidebar resize handle */}
      <div
        className="sidebar-resize-handle"
        style={{ left: sidebarWidth }}
        onMouseDown={onSidebarDragStart}
      />

      {/* Main content area */}
      <div className="ide-main">
        {/* Tab bar */}
        <EditorTabs />

        {/* Editor */}
        <div className="ide-editor-area">
          <MonacoEditor />
        </div>

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
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="ide-statusbar-area">
        <StatusBar />
      </div>

      {/* Command palette overlay */}
      <CommandPalette />
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
