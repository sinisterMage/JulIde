export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}

export interface OutputLine {
  id: string;
  kind: "stdout" | "stderr" | "info" | "done";
  text: string;
  timestamp: number;
  /** Rich MIME content (images, HTML, SVG) from Julia display() calls. */
  mime?: { type: string; data: string };
}

export interface Problem {
  id: string;
  file: string;
  line: number;
  col: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface DebugVariable {
  name: string;
  value: string;
  type_name: string;
}

export interface Breakpoint {
  file: string;
  line: number;
}

export interface DebugState {
  isDebugging: boolean;
  isPaused: boolean;
  currentFile: string;
  currentLine: number;
  variables: DebugVariable[];
  callStack: string[];
}

export type ActiveBottomPanel = "output" | "terminal" | "problems" | "debug" | "packages";

export interface JuliaOutputEvent {
  kind: "stdout" | "stderr" | "done" | "error";
  text: string;
  exit_code?: number;
}

export interface PtyOutputEvent {
  session_id: string;
  data: string;
}

export interface DebugStoppedEvent {
  file: string;
  line: number;
  reason: string;
}

export interface DebugOutputEvent {
  kind: string;
  text: string;
}

export interface DebugVariablesEvent {
  variables: DebugVariable[];
}
