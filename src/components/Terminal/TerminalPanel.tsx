import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Plus, X } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import { useIdeStore } from "../../stores/useIdeStore";
import type { PtyOutputEvent } from "../../types";

const XTERM_THEME = {
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
};

interface TermInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  unlisten: (() => void) | null;
}

let termCounter = 0;

function injectRevise(sessionId: string, delayMs = 2500) {
  setTimeout(() => {
    if (useIdeStore.getState().reviseEnabled) {
      invoke("pty_write", { sessionId, data: "using Revise\n" }).catch(console.error);
    }
  }, delayMs);
}

export function TerminalPanel() {
  const workspacePath = useIdeStore((s) => s.workspacePath);
  const sessions = useIdeStore((s) => s.terminalSessions);
  const activeTerminalId = useIdeStore((s) => s.activeTerminalId);
  const addTerminalSession = useIdeStore((s) => s.addTerminalSession);
  const removeTerminalSession = useIdeStore((s) => s.removeTerminalSession);
  const setActiveTerminal = useIdeStore((s) => s.setActiveTerminal);

  const instancesRef = useRef<Map<string, TermInstance>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Create initial terminal session on first mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const id = `terminal-${++termCounter}`;
    addTerminalSession({ id, name: "Terminal 1" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Create xterm instances for sessions that don't have one
  useEffect(() => {
    if (!containerRef.current) return;

    for (const session of sessions) {
      if (instancesRef.current.has(session.id)) continue;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        theme: XTERM_THEME,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      // Create a wrapper div for this terminal
      const wrapper = document.createElement("div");
      wrapper.className = "terminal-instance";
      wrapper.dataset.sessionId = session.id;
      wrapper.style.display = session.id === activeTerminalId ? "block" : "none";
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      containerRef.current.appendChild(wrapper);

      term.open(wrapper);

      const instance: TermInstance = { terminal: term, fitAddon, unlisten: null };
      instancesRef.current.set(session.id, instance);

      // Send keystrokes to PTY
      term.onData((data) => {
        invoke("pty_write", { sessionId: session.id, data }).catch(console.error);
      });

      // Start PTY session
      const sessionId = session.id;
      const setup = async () => {
        try {
          const storeState = useIdeStore.getState();
          if (storeState.containerMode && storeState.containerId) {
            await invoke("container_pty_create", {
              sessionId,
              containerId: storeState.containerId,
              command: null,
              workingDir: null,
            });
          } else if (session.type === "shell") {
            await invoke("pty_create_shell", {
              sessionId,
              workingDir: workspacePath ?? null,
            });
          } else {
            await invoke("pty_create", {
              sessionId,
              juliaPath: null,
              projectPath: workspacePath ?? null,
            });
            injectRevise(sessionId);
          }
        } catch (e) {
          term.writeln(`\x1b[31mFailed to start terminal: ${e}\x1b[0m`);
        }

        instance.unlisten = await listen<PtyOutputEvent>("pty-output", (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
          }
        }) as unknown as () => void;
      };

      setup();
      setTimeout(() => fitAddon.fit(), 100);
    }
  }, [sessions, activeTerminalId, workspacePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show/hide terminals when active tab changes
  useEffect(() => {
    if (!containerRef.current) return;
    const wrappers = containerRef.current.querySelectorAll<HTMLDivElement>(".terminal-instance");
    wrappers.forEach((w) => {
      w.style.display = w.dataset.sessionId === activeTerminalId ? "block" : "none";
    });
    // Fit the active terminal
    if (activeTerminalId) {
      const inst = instancesRef.current.get(activeTerminalId);
      if (inst) {
        setTimeout(() => {
          inst.fitAddon.fit();
          inst.terminal.focus();
        }, 50);
      }
    }
  }, [activeTerminalId]);

  // ResizeObserver for all terminals
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (activeTerminalId) {
        const inst = instancesRef.current.get(activeTerminalId);
        if (inst) {
          inst.fitAddon.fit();
          invoke("pty_resize", {
            sessionId: activeTerminalId,
            rows: inst.terminal.rows,
            cols: inst.terminal.cols,
          }).catch(() => {});
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [activeTerminalId]);

  const addNewTerminal = useCallback(() => {
    const num = ++termCounter;
    const id = `terminal-${num}`;
    addTerminalSession({ id, name: `Terminal ${num}` });
  }, [addTerminalSession]);

  const closeTerminal = useCallback((id: string) => {
    const inst = instancesRef.current.get(id);
    if (inst) {
      inst.unlisten?.();
      inst.terminal.dispose();
      instancesRef.current.delete(id);
      // Remove the DOM wrapper
      const wrapper = containerRef.current?.querySelector(`[data-session-id="${id}"]`);
      wrapper?.remove();
    }
    invoke("pty_close", { sessionId: id }).catch(() => {});
    removeTerminalSession(id);
  }, [removeTerminalSession]);

  // Inject `using Revise` whenever toggle is turned on
  const reviseEnabled = useIdeStore((s) => s.reviseEnabled);
  useEffect(() => {
    if (!reviseEnabled || !activeTerminalId) return;
    injectRevise(activeTerminalId, 500);
  }, [reviseEnabled, activeTerminalId]);

  return (
    <div className="terminal-panel">
      <div className="terminal-tabs-bar">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`terminal-tab ${s.id === activeTerminalId ? "active" : ""}`}
            onClick={() => setActiveTerminal(s.id)}
          >
            <span className="terminal-tab-name">{s.name}</span>
            {sessions.length > 1 && (
              <button
                className="terminal-tab-close"
                onClick={(e) => { e.stopPropagation(); closeTerminal(s.id); }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        <button className="terminal-add-btn" onClick={addNewTerminal} title="New Terminal">
          <Plus size={13} />
        </button>
      </div>
      <div ref={containerRef} className="terminal-container" />
    </div>
  );
}
