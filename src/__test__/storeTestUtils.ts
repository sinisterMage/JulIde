/**
 * Utility to reset Zustand stores between tests.
 * Only resets data properties — preserves action functions.
 */
import { useIdeStore } from "../stores/useIdeStore";
import { usePluginStore } from "../stores/usePluginStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { resetTauriMocks } from "./tauriMock";

/**
 * Reset all stores to their initial state and clear Tauri mocks.
 * Call this in `beforeEach` to ensure test isolation.
 */
export function resetAllStores(): void {
  resetTauriMocks();

  // Reset IDE store (data only — actions are preserved by not using replace)
  useIdeStore.setState({
    workspacePath: null,
    fileTree: null,
    openTabs: [],
    activeTabId: null,
    splitTabId: null,
    splitEditorOpen: false,
    juliaVersion: "Detecting...",
    juliaEnv: "@v#.#",
    availableEnvs: ["@v#.#"],
    isRunning: false,
    output: [],
    problems: [],
    activeBottomPanel: "output",
    bottomPanelHeight: 220,
    sidebarWidth: 240,
    terminalSessions: [],
    activeTerminalId: null,
    breakpoints: [],
    debug: {
      isDebugging: false,
      isPaused: false,
      currentFile: "",
      currentLine: 0,
      variables: [],
      callStack: [],
    },
    lspStatus: "off",
    lspErrorMessage: null,
    lspBackend: "languageserver",
    editorInstance: null,
    commandPaletteOpen: false,
    quickOpenOpen: false,
    activeSidebarView: "files",
    searchResults: [],
    searchQuery: "",
    isSearching: false,
    reviseEnabled: false,
    plutoStatus: "off",
    plutoMessage: null,
    containerState: "none",
    containerMode: false,
    containerId: null,
    containerName: null,
    containerRuntime: null,
    devcontainerDetected: false,
    devcontainerConfig: null,
    containerLogs: [],
    gitIsRepo: false,
    gitBranch: "",
    gitBranches: [],
    gitFiles: [],
    gitRemotes: [],
    gitStashes: [],
    gitAheadBehind: { ahead: 0, behind: 0 },
    gitProvider: null,
    gitIsSyncing: false,
  });

  // Reset plugin store
  usePluginStore.setState({
    commands: new Map(),
    sidebarPanels: [],
    bottomPanels: [],
    statusBarItems: [],
    toolbarButtons: [],
  });

  // Reset settings store
  useSettingsStore.setState({
    settings: {
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      tabSize: 4,
      minimapEnabled: true,
      wordWrap: "off",
      autoSave: true,
      theme: "julide-dark",
      terminalFontSize: 13,
      recentWorkspaces: [],
      containerRuntime: "auto",
      containerRemoteHost: "",
      containerAutoDetect: true,
      displayForwarding: true,
      gpuPassthrough: false,
      selinuxLabel: true,
      persistJuliaPackages: true,
      plutoPort: 3000,
    },
    loaded: false,
    settingsOpen: false,
  });
}
