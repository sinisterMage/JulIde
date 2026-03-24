import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useIdeStore } from "../../stores/useIdeStore";
import type { EditorTab } from "../../types";

export function Breadcrumb() {
  const activeTabId = useIdeStore((s) => s.activeTabId);
  const openTabs = useIdeStore((s) => s.openTabs);
  const workspacePath = useIdeStore((s) => s.workspacePath);
  const openFile = useIdeStore((s) => s.openFile);

  const [dropdown, setDropdown] = useState<{ index: number; items: string[] } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTab = openTabs.find((t) => t.id === activeTabId);
  if (!activeTab) return null;

  let relativePath = activeTab.path;
  if (workspacePath && relativePath.startsWith(workspacePath)) {
    relativePath = relativePath.slice(workspacePath.length + 1);
  }

  const segments = relativePath.split(/[/\\]/);

  const handleSegmentClick = async (index: number) => {
    if (!workspacePath) return;
    // Build the directory path up to this segment
    const dirSegments = segments.slice(0, index + 1);
    const dirPath = `${workspacePath}/${dirSegments.join("/")}`;

    // If it's the last segment (file), do nothing (already open)
    if (index === segments.length - 1) return;

    try {
      const tree = await invoke<{ children?: Array<{ name: string; path: string; is_dir: boolean }> }>(
        "fs_get_tree",
        { path: dirPath }
      );
      const siblings = (tree.children ?? [])
        .filter((c) => !c.is_dir)
        .map((c) => c.name)
        .sort();
      setDropdown({ index, items: siblings });
    } catch {
      setDropdown(null);
    }
  };

  const openSibling = async (filename: string, segmentIndex: number) => {
    if (!workspacePath) return;
    const dirSegments = segments.slice(0, segmentIndex + 1);
    const filePath = `${workspacePath}/${dirSegments.join("/")}/${filename}`;
    try {
      const content = await invoke<string>("fs_read_file", { path: filePath });
      const tab: EditorTab = {
        id: filePath,
        path: filePath,
        name: filename,
        content,
        isDirty: false,
        language: filename.split(".").pop() ?? "plaintext",
      };
      openFile(tab);
    } catch {
      // ignore
    }
    setDropdown(null);
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdown]);

  return (
    <div className="breadcrumb">
      {segments.map((segment, i) => (
        <span key={i} className="breadcrumb-segment">
          {i > 0 && <ChevronRight size={12} className="breadcrumb-separator" />}
          <span
            className={`${i === segments.length - 1 ? "breadcrumb-current" : "breadcrumb-dir"} breadcrumb-clickable`}
            onClick={() => handleSegmentClick(i)}
          >
            {segment}
          </span>
          {dropdown && dropdown.index === i && dropdown.items.length > 0 && (
            <div className="breadcrumb-dropdown" ref={dropdownRef}>
              {dropdown.items.map((item) => (
                <div
                  key={item}
                  className={`breadcrumb-dropdown-item ${item === segments[segments.length - 1] ? "active" : ""}`}
                  onClick={() => openSibling(item, i)}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </span>
      ))}
    </div>
  );
}
