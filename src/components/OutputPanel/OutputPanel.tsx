import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { Trash2 } from "lucide-react";
import { useIdeStore } from "../../stores/useIdeStore";
import type { JuliaOutputEvent } from "../../types";

const MIME_MARKER = "%%JULIDE_MIME%%";

function parseMimeLine(text: string): { type: string; data: string } | null {
  if (!text.startsWith(MIME_MARKER) || !text.endsWith("%%")) return null;
  try {
    const json = text.slice(MIME_MARKER.length, -2);
    const parsed = JSON.parse(json) as { type: string; data: string };
    if (typeof parsed.type === "string" && typeof parsed.data === "string") {
      return parsed;
    }
  } catch {
    // Not a valid MIME line
  }
  return null;
}

export function OutputPanel() {
  const output = useIdeStore((s) => s.output);
  const clearOutput = useIdeStore((s) => s.clearOutput);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Listen for Julia output events — one listener at a time
  useEffect(() => {
    let active = true;

    listen<JuliaOutputEvent>("julia-output", (event) => {
      if (!active) return;
      const { kind, text, exit_code } = event.payload;
      const store = useIdeStore.getState();
      if (kind === "done") {
        store.setIsRunning(false);
        store.appendOutput({
          kind: "info",
          text: `Process exited with code ${exit_code ?? -1}`,
        });
      } else if (kind === "stdout") {
        const mime = parseMimeLine(text);
        if (mime) {
          store.appendOutput({ kind: "stdout", text: "", mime });
        } else {
          store.appendOutput({ kind: "stdout", text });
        }
      } else if (kind === "stderr") {
        store.appendOutput({ kind: "stderr", text });
      }
    }).then((unlisten) => {
      if (!active) unlisten();
      else (activeUnlisten = unlisten);
    });

    let activeUnlisten: (() => void) | null = null;
    return () => {
      active = false;
      activeUnlisten?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  return (
    <div className="output-panel">
      <div className="output-toolbar">
        <button
          className="output-clear-btn"
          onClick={clearOutput}
          title="Clear output"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="output-content">
        {output.map((line) =>
          line.mime ? (
            <div key={line.id} className="output-line output-mime">
              {(line.mime.type === "image/png" ||
                line.mime.type === "image/jpeg" ||
                line.mime.type === "image/gif") && (
                <img
                  src={`data:${line.mime.type};base64,${line.mime.data}`}
                  className="output-mime-image"
                  alt="Julia output"
                />
              )}
              {line.mime.type === "image/svg+xml" && (
                <img
                  src={`data:image/svg+xml;base64,${line.mime.data}`}
                  className="output-mime-image"
                  alt="Julia SVG output"
                />
              )}
              {line.mime.type === "text/html" && (
                <iframe
                  srcDoc={atob(line.mime.data)}
                  className="output-mime-html"
                  sandbox="allow-scripts"
                  title="Julia HTML output"
                />
              )}
            </div>
          ) : (
            <div key={line.id} className={`output-line output-${line.kind}`}>
              <span className="output-text">{line.text}</span>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
