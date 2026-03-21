import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";
import { useIdeStore } from "../../stores/useIdeStore";
import type { PtyOutputEvent } from "../../types";
import { PTY_SESSION_ID } from "../../constants";

const SESSION_ID = PTY_SESSION_ID;

/** Send `using Revise\n` after a delay to give the REPL time to start. */
function injectRevise(delayMs = 2500) {
  setTimeout(() => {
    if (useIdeStore.getState().reviseEnabled) {
      invoke("pty_write", { sessionId: SESSION_ID, data: "using Revise\n" }).catch(
        console.error
      );
    }
  }, delayMs);
}

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const workspacePath = useIdeStore((s) => s.workspacePath);

  useEffect(() => {
    // If already initialized, just refit (panel became visible again)
    if (termRef.current && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 0);
      return;
    }

    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: "#1a1a1a",
        foreground: "#cccccc",
        cursor: "#9558B2",
        black: "#1e1e1e",
        red: "#CB3C33",
        green: "#389826",
        yellow: "#e5c07b",
        blue: "#4063D8",
        magenta: "#9558B2",
        cyan: "#56b6c2",
        white: "#cccccc",
        brightBlack: "#5c6370",
        brightRed: "#e06c75",
        brightGreen: "#98c379",
        brightYellow: "#e5c07b",
        brightBlue: "#61afef",
        brightMagenta: "#c678dd",
        brightCyan: "#56b6c2",
        brightWhite: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);

    // Defer fit() so the container has actual pixel dimensions
    const fitTimer = setTimeout(() => fitAddon.fit(), 50);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Send keystrokes to PTY
    term.onData((data) => {
      invoke("pty_write", { sessionId: SESSION_ID, data }).catch(console.error);
    });

    let unlistenFn: (() => void) | null = null;

    // Start async setup
    const setup = async () => {
      try {
        await invoke("pty_create", {
          sessionId: SESSION_ID,
          juliaPath: null,
          projectPath: workspacePath ?? null,
        });
        injectRevise();
      } catch (e) {
        term.writeln(`\x1b[31mFailed to start Julia REPL: ${e}\x1b[0m`);
        term.writeln(`\x1b[33mMake sure Julia is installed and on your PATH.\x1b[0m`);
      }

      unlistenFn = await listen<PtyOutputEvent>("pty-output", (event) => {
        if (event.payload.session_id === SESSION_ID) {
          term.write(event.payload.data);
        }
      });
    };

    setup();

    // Resize observer: refit + resize PTY when container dimensions change
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      invoke("pty_resize", {
        sessionId: SESSION_ID,
        rows: term.rows,
        cols: term.cols,
      }).catch(() => {});
    });
    observer.observe(containerRef.current);

    cleanupRef.current = () => {
      clearTimeout(fitTimer);
      unlistenFn?.();
      observer.disconnect();
      invoke("pty_close", { sessionId: SESSION_ID }).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };

    return () => {
      // In StrictMode, cleanup runs on the first mount's effect.
      // We delay actual teardown so StrictMode's second mount can reuse the terminal.
      const cleanup = cleanupRef.current;
      setTimeout(() => {
        // Only actually tear down if no terminal was re-created (i.e. real unmount)
        if (!termRef.current && cleanup) cleanup();
      }, 100);
    };
  }, []); // Run once on mount — workspacePath handled separately

  // Re-create PTY session when workspace changes (after terminal is up)
  useEffect(() => {
    if (!termRef.current || !workspacePath) return;
    invoke("pty_close", { sessionId: SESSION_ID })
      .then(() =>
        invoke("pty_create", {
          sessionId: SESSION_ID,
          juliaPath: null,
          projectPath: workspacePath,
        })
      )
      .then(() => injectRevise())
      .catch(console.error);
  }, [workspacePath]);

  // Inject `using Revise` whenever the toggle is turned on mid-session
  const reviseEnabled = useIdeStore((s) => s.reviseEnabled);
  useEffect(() => {
    if (!reviseEnabled || !termRef.current) return;
    injectRevise(500);
  }, [reviseEnabled]);

  return (
    <div className="terminal-panel">
      <div ref={containerRef} className="terminal-container" />
    </div>
  );
}
