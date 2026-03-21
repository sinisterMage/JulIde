import { useState, useCallback, useRef } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  BookOpen,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useIdeStore } from "../../stores/useIdeStore";
import type { FileNode } from "../../types";

// Inline prompt that works in Tauri (replaces window.prompt which returns null)
interface InlinePromptProps {
  placeholder: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}
function InlinePrompt({ placeholder, onConfirm, onCancel }: InlinePromptProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="inline-prompt" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        autoFocus
        className="inline-prompt-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        className="inline-prompt-btn confirm"
        onClick={() => value.trim() && onConfirm(value.trim())}
        title="Confirm"
      >
        <Check size={11} />
      </button>
      <button className="inline-prompt-btn cancel" onClick={onCancel} title="Cancel">
        <X size={11} />
      </button>
    </div>
  );
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return <FileText size={14} className={`file-icon ext-${ext}`} />;
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  onOpen: (node: FileNode) => void;
  onRefresh: () => void;
}

function FileTreeNode({ node, depth, onOpen, onRefresh }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  // Inline prompts for new file/folder inside this directory
  const [promptMode, setPromptMode] = useState<"file" | "folder" | null>(null);

  const handleClick = useCallback(() => {
    if (node.is_dir) {
      setExpanded((e) => !e);
    } else {
      onOpen(node);
    }
  }, [node, onOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeMenu = () => setContextMenu(null);

  const handleDelete = async () => {
    closeMenu();
    const confirmed = await showConfirm(`Delete "${node.name}"?`);
    if (!confirmed) return;
    try {
      await invoke("fs_delete_entry", { path: node.path });
      onRefresh();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const handleOpenAsPluto = () => {
    closeMenu();
    const workspacePath = useIdeStore.getState().workspacePath;
    invoke("pluto_open", {
      notebookPath: node.path,
      workspacePath: workspacePath ?? null,
    }).catch(console.error);
  };

  const handleNewFile = () => {
    closeMenu();
    setExpanded(true);
    setPromptMode("file");
  };

  const handleNewFolder = () => {
    closeMenu();
    setExpanded(true);
    setPromptMode("folder");
  };

  const handleRename = () => {
    closeMenu();
    setRenaming(true);
  };

  const commitRename = async () => {
    setRenaming(false);
    if (newName === node.name || !newName.trim()) return;
    const dir = node.path.replace(/[^/\\]+$/, "");
    const newPath = `${dir}${newName.trim()}`;
    try {
      await invoke("fs_rename", { oldPath: node.path, newPath });
      onRefresh();
    } catch (e) {
      console.error("Rename failed:", e);
      setNewName(node.name);
    }
  };

  const handlePromptConfirm = async (name: string) => {
    setPromptMode(null);
    const dir = node.is_dir ? node.path : node.path.replace(/[^/\\]+$/, "");
    const sep = dir.endsWith("/") || dir.endsWith("\\") ? "" : "/";
    const newPath = `${dir}${sep}${name}`;
    try {
      if (promptMode === "file") {
        await invoke("fs_create_file", { path: newPath });
      } else {
        await invoke("fs_create_dir", { path: newPath });
      }
      onRefresh();
    } catch (e) {
      console.error("Create failed:", e);
    }
  };

  const indentPx = depth * 12 + 8;

  return (
    <>
      <div
        className="file-tree-node"
        style={{ paddingLeft: indentPx }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="file-tree-chevron">
          {node.is_dir ? (
            expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : null}
        </span>
        <span className="file-tree-icon">
          {node.is_dir ? (
            expanded ? (
              <FolderOpen size={14} className="folder-icon" />
            ) : (
              <Folder size={14} className="folder-icon" />
            )
          ) : (
            getFileIcon(node.name)
          )}
        </span>
        {renaming ? (
          <input
            className="file-tree-rename-input"
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setRenaming(false);
                setNewName(node.name);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-tree-name">{node.name}</span>
        )}
      </div>

      {/* Inline prompt for new file/folder */}
      {promptMode && (
        <div style={{ paddingLeft: indentPx + 24 }}>
          <InlinePrompt
            placeholder={promptMode === "file" ? "filename.jl" : "folder name"}
            onConfirm={handlePromptConfirm}
            onCancel={() => setPromptMode(null)}
          />
        </div>
      )}

      {node.is_dir &&
        expanded &&
        node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onOpen={onOpen}
            onRefresh={onRefresh}
          />
        ))}

      {contextMenu && (
        <>
          <div className="context-menu-overlay" onClick={closeMenu} />
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {node.is_dir && (
              <>
                <button onClick={handleNewFile}>
                  <FilePlus size={13} /> New File
                </button>
                <button onClick={handleNewFolder}>
                  <FolderPlus size={13} /> New Folder
                </button>
                <div className="context-menu-separator" />
              </>
            )}
            <button onClick={handleRename}>
              <Edit2 size={13} /> Rename
            </button>
            <button onClick={handleDelete} className="danger">
              <Trash2 size={13} /> Delete
            </button>
            {!node.is_dir && node.name.endsWith(".jl") && (
              <>
                <div className="context-menu-separator" />
                <button onClick={handleOpenAsPluto}>
                  <BookOpen size={13} /> Open as Pluto Notebook
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

// A simple confirm that works in Tauri via a custom overlay
function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center";
    const box = document.createElement("div");
    box.style.cssText =
      "background:#2d2d30;border:1px solid #3e3e42;border-radius:8px;padding:20px 24px;min-width:280px;color:#ccc;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,.6)";
    box.innerHTML = `<p style="margin:0 0 16px">${message}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="c-no"  style="padding:5px 14px;border-radius:4px;border:1px solid #3e3e42;background:#1e1e1e;color:#ccc;cursor:pointer;font-size:12px">Cancel</button>
        <button id="c-yes" style="padding:5px 14px;border-radius:4px;border:none;background:#CB3C33;color:#fff;cursor:pointer;font-size:12px;font-weight:600">Delete</button>
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const cleanup = (result: boolean) => {
      document.body.removeChild(overlay);
      resolve(result);
    };
    box.querySelector("#c-yes")!.addEventListener("click", () => cleanup(true));
    box.querySelector("#c-no")!.addEventListener("click", () => cleanup(false));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cleanup(false); });
  });
}

export function FileExplorer() {
  const workspacePath = useIdeStore((s) => s.workspacePath);
  const fileTree = useIdeStore((s) => s.fileTree);
  const openFile = useIdeStore((s) => s.openFile);
  const setWorkspace = useIdeStore((s) => s.setWorkspace);
  const setFileTree = useIdeStore((s) => s.setFileTree);

  // Root-level new file/folder prompts
  const [rootPrompt, setRootPrompt] = useState<"file" | "folder" | null>(null);

  const openFolder = async () => {
    try {
      const path = await invoke<string | null>("dialog_open_folder");
      if (!path) return;
      const tree = await invoke<FileNode>("fs_get_tree", { path });
      setWorkspace(path, tree);
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  };

  const refreshTree = useCallback(async () => {
    if (!workspacePath) return;
    try {
      const tree = await invoke<FileNode>("fs_get_tree", { path: workspacePath });
      setFileTree(tree);
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  }, [workspacePath, setFileTree]);

  const handleOpen = useCallback(
    async (node: FileNode) => {
      if (node.is_dir) return;
      const existingTabs = useIdeStore.getState().openTabs;
      const existing = existingTabs.find((t) => t.path === node.path);
      if (existing) {
        useIdeStore.getState().setActiveTab(existing.id);
        return;
      }
      try {
        const content = await invoke<string>("fs_read_file", { path: node.path });
        openFile({
          id: `${Date.now()}-${Math.random()}`,
          path: node.path,
          name: node.name,
          content,
          isDirty: false,
          language: node.name.endsWith(".jl") ? "julia" : "plaintext",
        });
      } catch (e) {
        console.error("Cannot open file:", e);
      }
    },
    [openFile]
  );

  const handleRootPromptConfirm = async (name: string) => {
    if (!workspacePath) return;
    setRootPrompt(null);
    const sep = workspacePath.endsWith("/") || workspacePath.endsWith("\\") ? "" : "/";
    const newPath = `${workspacePath}${sep}${name}`;
    try {
      if (rootPrompt === "file") {
        await invoke("fs_create_file", { path: newPath });
      } else {
        await invoke("fs_create_dir", { path: newPath });
      }
      refreshTree();
    } catch (e) {
      console.error("Create failed:", e);
    }
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span className="file-explorer-title">
          {workspacePath
            ? workspacePath.split(/[/\\]/).pop()?.toUpperCase()
            : "EXPLORER"}
        </span>
        <div className="file-explorer-actions">
          {workspacePath && (
            <>
              <button title="New File" onClick={() => setRootPrompt("file")}>
                <FilePlus size={14} />
              </button>
              <button title="New Folder" onClick={() => setRootPrompt("folder")}>
                <FolderPlus size={14} />
              </button>
              <button title="Refresh" onClick={refreshTree}>
                <RefreshCw size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="file-explorer-tree">
        {!workspacePath ? (
          <div className="file-explorer-empty">
            <p>No folder open</p>
            <button className="btn-primary" onClick={openFolder}>
              Open Folder
            </button>
          </div>
        ) : (
          <>
            {rootPrompt && (
              <div style={{ padding: "2px 8px" }}>
                <InlinePrompt
                  placeholder={rootPrompt === "file" ? "filename.jl" : "folder name"}
                  onConfirm={handleRootPromptConfirm}
                  onCancel={() => setRootPrompt(null)}
                />
              </div>
            )}
            {fileTree?.children?.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={0}
                onOpen={handleOpen}
                onRefresh={refreshTree}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
