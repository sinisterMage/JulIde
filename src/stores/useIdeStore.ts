import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type * as Monaco from "monaco-editor";
import type {
  ActiveBottomPanel,
  Breakpoint,
  ContainerState,
  DebugState,
  DevContainerConfig,
  EditorTab,
  FileNode,
  OutputLine,
  Problem,
  SearchResult,
  SidebarView,
} from "../types";

interface IdeStore {
  // Workspace
  workspacePath: string | null;
  fileTree: FileNode | null;
  setWorkspace: (path: string, tree: FileNode) => void;
  setFileTree: (tree: FileNode) => void;

  // Editor tabs
  openTabs: EditorTab[];
  activeTabId: string | null;
  openFile: (tab: EditorTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string, isDirty: boolean) => void;
  markTabSaved: (id: string) => void;

  // Split editor
  splitTabId: string | null;
  setSplitTab: (id: string | null) => void;
  splitEditorOpen: boolean;
  toggleSplitEditor: () => void;

  // Julia
  juliaVersion: string;
  juliaEnv: string;
  availableEnvs: string[];
  isRunning: boolean;
  setJuliaVersion: (v: string) => void;
  setJuliaEnv: (env: string) => void;
  setAvailableEnvs: (envs: string[]) => void;
  setIsRunning: (v: boolean) => void;

  // Output
  output: OutputLine[];
  appendOutput: (line: Omit<OutputLine, "id" | "timestamp">) => void;
  clearOutput: () => void;

  // Problems
  problems: Problem[];
  setProblems: (problems: Problem[]) => void;

  // Bottom panel
  activeBottomPanel: ActiveBottomPanel;
  setActiveBottomPanel: (panel: ActiveBottomPanel) => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (h: number) => void;

  // Sidebar
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;

  // Terminal sessions
  terminalSessions: { id: string; name: string }[];
  activeTerminalId: string | null;
  addTerminalSession: (session: { id: string; name: string }) => void;
  removeTerminalSession: (id: string) => void;
  setActiveTerminal: (id: string) => void;

  // Breakpoints
  breakpoints: Breakpoint[];
  addBreakpoint: (bp: Breakpoint) => void;
  removeBreakpoint: (file: string, line: number) => void;
  toggleBreakpoint: (file: string, line: number) => void;

  // Debug
  debug: DebugState;
  setDebugState: (state: Partial<DebugState>) => void;

  // LSP
  lspStatus: "off" | "starting" | "ready" | "error";
  lspErrorMessage: string | null;
  setLspStatus: (status: "off" | "starting" | "ready" | "error", message?: string) => void;

  // Editor instance (for triggering actions like Find from outside)
  editorInstance: Monaco.editor.IStandaloneCodeEditor | null;
  setEditorInstance: (editor: Monaco.editor.IStandaloneCodeEditor | null) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Quick Open
  quickOpenOpen: boolean;
  setQuickOpenOpen: (open: boolean) => void;

  // Sidebar view
  activeSidebarView: SidebarView;
  setActiveSidebarView: (view: SidebarView) => void;

  // Search
  searchResults: SearchResult[];
  searchQuery: string;
  isSearching: boolean;
  setSearchResults: (results: SearchResult[]) => void;
  setSearchQuery: (query: string) => void;
  setIsSearching: (v: boolean) => void;

  // Revise.jl
  reviseEnabled: boolean;
  setReviseEnabled: (v: boolean) => void;

  // Pluto.jl
  plutoStatus: "off" | "starting" | "ready" | "error";
  plutoMessage: string | null;
  setPlutoStatus: (status: "off" | "starting" | "ready" | "error", message?: string) => void;

  // Container
  containerState: ContainerState;
  containerMode: boolean;
  containerId: string | null;
  containerName: string | null;
  containerRuntime: string | null;
  devcontainerDetected: boolean;
  devcontainerConfig: DevContainerConfig | null;
  containerLogs: OutputLine[];
  setContainerState: (state: ContainerState) => void;
  setContainerMode: (mode: boolean) => void;
  setContainerId: (id: string | null) => void;
  setContainerName: (name: string | null) => void;
  setContainerRuntime: (runtime: string | null) => void;
  setDevcontainerDetected: (detected: boolean) => void;
  setDevcontainerConfig: (config: DevContainerConfig | null) => void;
  appendContainerLog: (line: Omit<OutputLine, "id" | "timestamp">) => void;
  clearContainerLogs: () => void;
}

let outputIdCounter = 0;

export const useIdeStore = create<IdeStore>()(
  immer((set) => ({
    // Workspace
    workspacePath: null,
    fileTree: null,
    setWorkspace: (path, tree) =>
      set((s) => {
        s.workspacePath = path;
        s.fileTree = tree;
      }),
    setFileTree: (tree) =>
      set((s) => {
        s.fileTree = tree;
      }),

    // Tabs
    openTabs: [],
    activeTabId: null,
    openFile: (tab) =>
      set((s) => {
        const existing = s.openTabs.find((t) => t.path === tab.path);
        if (existing) {
          s.activeTabId = existing.id;
        } else {
          s.openTabs.push(tab);
          s.activeTabId = tab.id;
        }
      }),
    closeTab: (id) =>
      set((s) => {
        const idx = s.openTabs.findIndex((t) => t.id === id);
        s.openTabs.splice(idx, 1);
        if (s.activeTabId === id) {
          s.activeTabId =
            s.openTabs[Math.max(0, idx - 1)]?.id ?? s.openTabs[0]?.id ?? null;
        }
      }),
    setActiveTab: (id) =>
      set((s) => {
        s.activeTabId = id;
      }),
    updateTabContent: (id, content, isDirty) =>
      set((s) => {
        const tab = s.openTabs.find((t) => t.id === id);
        if (tab) {
          tab.content = content;
          tab.isDirty = isDirty;
        }
      }),
    markTabSaved: (id) =>
      set((s) => {
        const tab = s.openTabs.find((t) => t.id === id);
        if (tab) tab.isDirty = false;
      }),

    // Split editor
    splitTabId: null,
    splitEditorOpen: false,
    setSplitTab: (id) =>
      set((s) => {
        s.splitTabId = id;
      }),
    toggleSplitEditor: () =>
      set((s) => {
        s.splitEditorOpen = !s.splitEditorOpen;
        if (s.splitEditorOpen && !s.splitTabId) {
          // Default to showing the active tab in the split
          s.splitTabId = s.activeTabId;
        }
        if (!s.splitEditorOpen) {
          s.splitTabId = null;
        }
      }),

    // Julia
    juliaVersion: "Detecting...",
    juliaEnv: "@v#.#",
    availableEnvs: ["@v#.#"],
    isRunning: false,
    setJuliaVersion: (v) =>
      set((s) => {
        s.juliaVersion = v;
      }),
    setJuliaEnv: (env) =>
      set((s) => {
        s.juliaEnv = env;
      }),
    setAvailableEnvs: (envs) =>
      set((s) => {
        s.availableEnvs = envs;
      }),
    setIsRunning: (v) =>
      set((s) => {
        s.isRunning = v;
      }),

    // Output
    output: [],
    appendOutput: (line) =>
      set((s) => {
        s.output.push({
          id: String(outputIdCounter++),
          timestamp: Date.now(),
          ...line,
        });
        // Keep last 5000 lines
        if (s.output.length > 5000) {
          s.output.splice(0, s.output.length - 5000);
        }
      }),
    clearOutput: () =>
      set((s) => {
        s.output = [];
      }),

    // Problems
    problems: [],
    setProblems: (problems) =>
      set((s) => {
        s.problems = problems;
      }),

    // Bottom panel
    activeBottomPanel: "output",
    setActiveBottomPanel: (panel) =>
      set((s) => {
        s.activeBottomPanel = panel;
      }),
    bottomPanelHeight: 220,
    setBottomPanelHeight: (h) =>
      set((s) => {
        s.bottomPanelHeight = h;
      }),

    // Sidebar
    sidebarWidth: 240,
    setSidebarWidth: (w) =>
      set((s) => {
        s.sidebarWidth = w;
      }),

    // Terminal sessions
    terminalSessions: [],
    activeTerminalId: null,
    addTerminalSession: (session) =>
      set((s) => {
        s.terminalSessions.push(session);
        s.activeTerminalId = session.id;
      }),
    removeTerminalSession: (id) =>
      set((s) => {
        s.terminalSessions = s.terminalSessions.filter((t) => t.id !== id);
        if (s.activeTerminalId === id) {
          s.activeTerminalId = s.terminalSessions[0]?.id ?? null;
        }
      }),
    setActiveTerminal: (id) =>
      set((s) => {
        s.activeTerminalId = id;
      }),

    // Breakpoints
    breakpoints: [],
    addBreakpoint: (bp) =>
      set((s) => {
        if (!s.breakpoints.find((b) => b.file === bp.file && b.line === bp.line)) {
          s.breakpoints.push(bp);
        }
      }),
    removeBreakpoint: (file, line) =>
      set((s) => {
        s.breakpoints = s.breakpoints.filter(
          (b) => !(b.file === file && b.line === line)
        );
      }),
    toggleBreakpoint: (file, line) =>
      set((s) => {
        const idx = s.breakpoints.findIndex(
          (b) => b.file === file && b.line === line
        );
        if (idx >= 0) {
          s.breakpoints.splice(idx, 1);
        } else {
          s.breakpoints.push({ file, line });
        }
      }),

    // Debug
    debug: {
      isDebugging: false,
      isPaused: false,
      currentFile: "",
      currentLine: 0,
      variables: [],
      callStack: [],
    },
    setDebugState: (partial) =>
      set((s) => {
        Object.assign(s.debug, partial);
      }),

    // LSP
    lspStatus: "off",
    lspErrorMessage: null,
    setLspStatus: (status, message) =>
      set((s) => {
        s.lspStatus = status;
        s.lspErrorMessage = message ?? null;
      }),

    // Editor instance
    editorInstance: null,
    setEditorInstance: (editor) =>
      set((s) => {
        // Cast to draft-compatible — Immer can't proxy the Monaco editor object
        s.editorInstance = editor as any;
      }),

    // Command palette
    commandPaletteOpen: false,
    setCommandPaletteOpen: (open) =>
      set((s) => {
        s.commandPaletteOpen = open;
      }),

    // Quick Open
    quickOpenOpen: false,
    setQuickOpenOpen: (open) =>
      set((s) => {
        s.quickOpenOpen = open;
      }),

    // Sidebar view
    activeSidebarView: "files",
    setActiveSidebarView: (view) =>
      set((s) => {
        s.activeSidebarView = view;
      }),

    // Search
    searchResults: [],
    searchQuery: "",
    isSearching: false,
    setSearchResults: (results) =>
      set((s) => {
        s.searchResults = results;
      }),
    setSearchQuery: (query) =>
      set((s) => {
        s.searchQuery = query;
      }),
    setIsSearching: (v) =>
      set((s) => {
        s.isSearching = v;
      }),

    // Revise.jl
    reviseEnabled: false,
    setReviseEnabled: (v) =>
      set((s) => {
        s.reviseEnabled = v;
      }),

    // Pluto.jl
    plutoStatus: "off",
    plutoMessage: null,
    setPlutoStatus: (status, message) =>
      set((s) => {
        s.plutoStatus = status;
        s.plutoMessage = message ?? null;
      }),

    // Container
    containerState: "none",
    containerMode: false,
    containerId: null,
    containerName: null,
    containerRuntime: null,
    devcontainerDetected: false,
    devcontainerConfig: null,
    containerLogs: [],
    setContainerState: (state) =>
      set((s) => {
        s.containerState = state;
      }),
    setContainerMode: (mode) =>
      set((s) => {
        s.containerMode = mode;
      }),
    setContainerId: (id) =>
      set((s) => {
        s.containerId = id;
      }),
    setContainerName: (name) =>
      set((s) => {
        s.containerName = name;
      }),
    setContainerRuntime: (runtime) =>
      set((s) => {
        s.containerRuntime = runtime;
      }),
    setDevcontainerDetected: (detected) =>
      set((s) => {
        s.devcontainerDetected = detected;
      }),
    setDevcontainerConfig: (config) =>
      set((s) => {
        s.devcontainerConfig = config as any;
      }),
    appendContainerLog: (line) =>
      set((s) => {
        s.containerLogs.push({
          id: String(outputIdCounter++),
          timestamp: Date.now(),
          ...line,
        });
        if (s.containerLogs.length > 5000) {
          s.containerLogs.splice(0, s.containerLogs.length - 5000);
        }
      }),
    clearContainerLogs: () =>
      set((s) => {
        s.containerLogs = [];
      }),
  }))
);
