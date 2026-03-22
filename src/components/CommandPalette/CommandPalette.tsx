import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useIdeStore } from "../../stores/useIdeStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { FileNode } from "../../types";

interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const open = useIdeStore((s) => s.commandPaletteOpen);
  const setOpen = useIdeStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearOutput = useIdeStore((s) => s.clearOutput);
  const appendOutput = useIdeStore((s) => s.appendOutput);
  const setActiveBottomPanel = useIdeStore((s) => s.setActiveBottomPanel);
  const setIsRunning = useIdeStore((s) => s.setIsRunning);
  const setWorkspace = useIdeStore((s) => s.setWorkspace);
  const activeTabId = useIdeStore((s) => s.activeTabId);
  const openTabs = useIdeStore((s) => s.openTabs);
  const workspacePath = useIdeStore((s) => s.workspacePath);

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const editorInstance = useIdeStore((s) => s.editorInstance);
  const setQuickOpenOpen = useIdeStore((s) => s.setQuickOpenOpen);
  const setActiveSidebarView = useIdeStore((s) => s.setActiveSidebarView);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);
  const toggleSplitEditor = useIdeStore((s) => s.toggleSplitEditor);

  const commands: Command[] = [
    {
      id: "file.open-folder",
      label: "Open Folder",
      shortcut: "⌘O",
      action: async () => {
        const path = await invoke<string | null>("dialog_open_folder");
        if (!path) return;
        const tree = await invoke<FileNode>("fs_get_tree", { path });
        setWorkspace(path, tree);
      },
    },
    {
      id: "file.quick-open",
      label: "Go to File",
      shortcut: "⌘P",
      action: () => setQuickOpenOpen(true),
    },
    {
      id: "edit.find",
      label: "Find in File",
      shortcut: "⌘F",
      action: () => editorInstance?.getAction("actions.find")?.run(),
    },
    {
      id: "edit.find-replace",
      label: "Find and Replace",
      shortcut: "⌘H",
      action: () => editorInstance?.getAction("editor.action.startFindReplaceAction")?.run(),
    },
    {
      id: "search.global",
      label: "Search in Files",
      shortcut: "⌘⇧F",
      action: () => setActiveSidebarView("search"),
    },
    {
      id: "settings.open",
      label: "Open Settings",
      shortcut: "⌘,",
      action: () => setSettingsOpen(true),
    },
    {
      id: "editor.split",
      label: "Toggle Split Editor",
      action: () => toggleSplitEditor(),
    },
    {
      id: "julia.run",
      label: "Run Julia File",
      description: activeTab?.name,
      shortcut: "⌃F5",
      action: async () => {
        if (!activeTab) return;
        clearOutput();
        setActiveBottomPanel("output");
        setIsRunning(true);
        appendOutput({ kind: "info", text: `Running: ${activeTab.name}` });
        await invoke("julia_run", {
          filePath: activeTab.path,
          projectPath: workspacePath ?? null,
        }).catch((e) => appendOutput({ kind: "stderr", text: String(e) }));
      },
    },
    {
      id: "julia.precompile",
      label: "Precompile Julia Project",
      action: async () => {
        clearOutput();
        setActiveBottomPanel("output");
        appendOutput({ kind: "info", text: "Precompiling..." });
        await invoke("julia_precompile", { projectPath: workspacePath ?? null });
      },
    },
    {
      id: "julia.clean",
      label: "Clean Build Artifacts",
      action: async () => {
        clearOutput();
        setActiveBottomPanel("output");
        await invoke("julia_clean", { projectPath: workspacePath ?? null });
      },
    },
    {
      id: "julia.stop",
      label: "Stop Julia Process",
      action: async () => {
        await invoke("julia_kill");
        setIsRunning(false);
      },
    },
    {
      id: "panel.output",
      label: "Show Output Panel",
      action: () => setActiveBottomPanel("output"),
    },
    {
      id: "panel.terminal",
      label: "Show Terminal",
      shortcut: "⌃`",
      action: () => setActiveBottomPanel("terminal"),
    },
    {
      id: "panel.problems",
      label: "Show Problems",
      action: () => setActiveBottomPanel("problems"),
    },
    {
      id: "panel.debug",
      label: "Show Debug Panel",
      action: () => setActiveBottomPanel("debug"),
    },
    {
      id: "output.clear",
      label: "Clear Output",
      action: clearOutput,
    },
    {
      id: "container.reopen",
      label: "Dev Containers: Reopen in Container",
      action: async () => {
        if (!workspacePath) return;
        const { useSettingsStore: ss } = await import("../../stores/useSettingsStore");
        const s = ss.getState().settings;
        setActiveBottomPanel("container-logs");
        await invoke("devcontainer_up", {
          workspacePath,
          displayForwarding: s.displayForwarding,
          gpuPassthrough: s.gpuPassthrough,
          selinuxLabel: s.selinuxLabel,
          persistJuliaPackages: s.persistJuliaPackages,
        }).catch((e) => console.error(e));
      },
    },
    {
      id: "container.rebuild",
      label: "Dev Containers: Rebuild Container",
      action: async () => {
        if (!workspacePath) return;
        const { useSettingsStore: ss } = await import("../../stores/useSettingsStore");
        const s = ss.getState().settings;
        setActiveBottomPanel("container-logs");
        await invoke("devcontainer_rebuild", {
          workspacePath,
          displayForwarding: s.displayForwarding,
          gpuPassthrough: s.gpuPassthrough,
          selinuxLabel: s.selinuxLabel,
          persistJuliaPackages: s.persistJuliaPackages,
        }).catch((e) => console.error(e));
      },
    },
    {
      id: "container.stop",
      label: "Dev Containers: Stop Container",
      action: async () => {
        await invoke("devcontainer_stop").catch((e) => console.error(e));
      },
    },
    {
      id: "container.logs",
      label: "Dev Containers: Show Container Logs",
      action: () => setActiveBottomPanel("container-logs"),
    },
    {
      id: "container.panel",
      label: "Dev Containers: Show Container Panel",
      action: () => setActiveSidebarView("container"),
    },
  ];

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIdx(0);
  }, [setOpen]);

  // Global Cmd+Shift+P handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close, setOpen]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  const runSelected = () => {
    const cmd = filtered[selectedIdx];
    if (cmd) {
      close();
      cmd.action();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      runSelected();
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <div className="command-palette-overlay" onClick={close}>
      <div
        className="command-palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder="Type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="command-palette-list">
          {filtered.length === 0 ? (
            <div className="command-palette-empty">No commands found</div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                className={`command-palette-item ${idx === selectedIdx ? "selected" : ""}`}
                onClick={() => { close(); cmd.action(); }}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <span className="command-label">{cmd.label}</span>
                {cmd.description && (
                  <span className="command-desc">{cmd.description}</span>
                )}
                {cmd.shortcut && (
                  <span className="command-shortcut">{cmd.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
