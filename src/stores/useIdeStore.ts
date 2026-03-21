import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  ActiveBottomPanel,
  Breakpoint,
  DebugState,
  EditorTab,
  FileNode,
  OutputLine,
  Problem,
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

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Revise.jl
  reviseEnabled: boolean;
  setReviseEnabled: (v: boolean) => void;

  // Pluto.jl
  plutoStatus: "off" | "starting" | "ready" | "error";
  plutoMessage: string | null;
  setPlutoStatus: (status: "off" | "starting" | "ready" | "error", message?: string) => void;
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

    // Command palette
    commandPaletteOpen: false,
    setCommandPaletteOpen: (open) =>
      set((s) => {
        s.commandPaletteOpen = open;
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
  }))
);
