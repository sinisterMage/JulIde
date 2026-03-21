import { useEffect, useRef, useCallback } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import { useIdeStore } from "../../stores/useIdeStore";
import { registerJuliaLanguage } from "./juliaLanguage";
import { lspClient } from "../../lsp/LspClient";
import { registerJuliaLspProviders, setMonacoInstance } from "../../lsp/juliaProviders";
import { PTY_SESSION_ID } from "../../constants";

const SAVE_DEBOUNCE_MS = 800;

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jl":
      return "julia";
    case "json":
      return "json";
    case "toml":
      return "toml";
    case "md":
      return "markdown";
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "rs":
      return "rust";
    default:
      return "plaintext";
  }
}

export function MonacoEditor() {
  const activeTabId = useIdeStore((s) => s.activeTabId);
  const openTabs = useIdeStore((s) => s.openTabs);
  const updateTabContent = useIdeStore((s) => s.updateTabContent);
  const markTabSaved = useIdeStore((s) => s.markTabSaved);
  const breakpoints = useIdeStore((s) => s.breakpoints);
  const toggleBreakpoint = useIdeStore((s) => s.toggleBreakpoint);
  const debug = useIdeStore((s) => s.debug);

  const activeTab = openTabs.find((t) => t.id === activeTabId) ?? null;
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lspChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lspVersionRef = useRef<Map<string, number>>(new Map());
  const decorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const debugDecoRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleBeforeMount: BeforeMount = (monaco) => {
    registerJuliaLanguage(monaco);
    setMonacoInstance(monaco);
    registerJuliaLspProviders(monaco);
    // Define theme here — beforeMount runs before the editor instance is created,
    // ensuring the theme exists when theme="julide-dark" is applied.
    monaco.editor.defineTheme("julide-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword",       foreground: "9558B2", fontStyle: "bold" },
        { token: "type.identifier", foreground: "4063D8" },
        { token: "string",        foreground: "98c379" },
        { token: "string.symbol", foreground: "e5c07b" },
        { token: "string.char",   foreground: "98c379" },
        { token: "string.escape", foreground: "56b6c2" },
        { token: "comment",       foreground: "5c6370", fontStyle: "italic" },
        { token: "number",        foreground: "389826" },
        { token: "number.float",  foreground: "389826" },
        { token: "number.hex",    foreground: "389826" },
        { token: "annotation",    foreground: "CB3C33" },
        { token: "operator",      foreground: "56b6c2" },
      ],
      colors: {
        "editor.background":                "#1e1e1e",
        "editor.foreground":                "#cccccc",
        "editor.lineHighlightBackground":   "#2a2d2e",
        "editor.selectionBackground":       "#3a3d41",
        "editorCursor.foreground":          "#9558B2",
        "editorGutter.background":          "#1e1e1e",
        "editorGlyphMargin.background":     "#1e1e1e",
        "editorLineNumber.foreground":      "#5a5a5a",
        "editorLineNumber.activeForeground":"#cccccc",
        "editor.inactiveSelectionBackground":"#3a3d41",
      },
    });
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Breakpoint gutter click
    editor.onMouseDown((e) => {
      if (
        e.target.type ===
        monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
      ) {
        const line = e.target.position?.lineNumber;
        if (line && activeTab) {
          toggleBreakpoint(activeTab.path, line);
        }
      }
    });

    // Ctrl/Cmd+S to save
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        if (activeTab) {
          saveFile(activeTab.id, activeTab.path, editor.getValue());
        }
      }
    );

    // ResizeObserver for layout
    if (containerRef.current) {
      const observer = new ResizeObserver(() => editor.layout());
      observer.observe(containerRef.current);
    }

    decorationsRef.current = editor.createDecorationsCollection([]);
    debugDecoRef.current = editor.createDecorationsCollection([]);
  };

  const saveFile = useCallback(
    async (tabId: string, path: string, content: string) => {
      try {
        await invoke("fs_write_file", { path, content });
        markTabSaved(tabId);
        // Trigger Revise.jl hot-reload if enabled
        if (useIdeStore.getState().reviseEnabled && path.endsWith(".jl")) {
          invoke("pty_write", {
            sessionId: PTY_SESSION_ID,
            data: "Revise.revise()\n",
          }).catch(console.error);
        }
      } catch (e) {
        console.error("Save failed:", e);
      }
    },
    [markTabSaved]
  );

  // LSP: notify server when a Julia file is opened or closed
  useEffect(() => {
    if (!activeTab?.path.endsWith(".jl")) return;
    const uri = `file://${activeTab.path}`;
    // Reset version counter for this URI on open
    lspVersionRef.current.set(uri, 1);
    lspClient.didOpen(uri, activeTab.content).catch(console.error);
    return () => {
      lspClient.didClose(uri).catch(console.error);
    };
  }, [activeTab?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update breakpoint decorations whenever breakpoints or active file changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !decorationsRef.current || !activeTab) return;

    const fileBreakpoints = breakpoints.filter(
      (b) => b.file === activeTab.path
    );
    const decorations: Monaco.editor.IModelDeltaDecoration[] = fileBreakpoints.map(
      (bp) => ({
        range: {
          startLineNumber: bp.line,
          startColumn: 1,
          endLineNumber: bp.line,
          endColumn: 1,
        },
        options: {
          isWholeLine: false,
          glyphMarginClassName: "breakpoint-glyph",
          glyphMarginHoverMessage: { value: "Breakpoint" },
          lineNumberHintClassName: undefined,
        },
      })
    );
    decorationsRef.current.set(decorations);
  }, [breakpoints, activeTab]);

  // Update debug current-line decoration
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !debugDecoRef.current) return;

    if (debug.isPaused && debug.currentLine > 0) {
      debugDecoRef.current.set([
        {
          range: {
            startLineNumber: debug.currentLine,
            startColumn: 1,
            endLineNumber: debug.currentLine,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            className: "debug-current-line",
            glyphMarginClassName: "debug-arrow-glyph",
          },
        },
      ]);
    } else {
      debugDecoRef.current.set([]);
    }
  }, [debug.isPaused, debug.currentLine]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (!activeTab || value === undefined) return;
      updateTabContent(activeTab.id, value, true);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveFile(activeTab.id, activeTab.path, value);
      }, SAVE_DEBOUNCE_MS);

      // LSP: notify server of content change (300ms debounce)
      if (activeTab.path.endsWith(".jl")) {
        if (lspChangeTimerRef.current) clearTimeout(lspChangeTimerRef.current);
        lspChangeTimerRef.current = setTimeout(() => {
          const uri = `file://${activeTab.path}`;
          const v = (lspVersionRef.current.get(uri) ?? 1) + 1;
          lspVersionRef.current.set(uri, v);
          lspClient.didChange(uri, value, v).catch(console.error);
        }, 300);
      }
    },
    [activeTab, updateTabContent, saveFile]
  );

  if (!activeTab) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-content">
          <div className="editor-empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <p>Open a file from the explorer or use <kbd>Cmd+O</kbd></p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="editor-container">
      <Editor
        key={activeTab.id}
        language={getLanguage(activeTab.name)}
        value={activeTab.content}
        theme="julide-dark"
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        onChange={handleChange}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontLigatures: true,
          lineNumbers: "on",
          minimap: { enabled: true, scale: 1 },
          scrollBeyondLastLine: false,
          automaticLayout: false,
          tabSize: 4,
          insertSpaces: true,
          wordWrap: "off",
          glyphMargin: true,
          folding: true,
          renderLineHighlight: "all",
          cursorBlinking: "smooth",
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );
}
