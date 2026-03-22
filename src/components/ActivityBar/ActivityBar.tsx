import { Files, Search, GitBranch, Settings, Container } from "lucide-react";
import { useIdeStore } from "../../stores/useIdeStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { SidebarView } from "../../types";

export function ActivityBar() {
  const activeSidebarView = useIdeStore((s) => s.activeSidebarView);
  const setActiveSidebarView = useIdeStore((s) => s.setActiveSidebarView);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);

  const toggle = (view: SidebarView) => {
    setActiveSidebarView(activeSidebarView === view ? view : view);
  };

  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        <button
          className={`activity-bar-btn ${activeSidebarView === "files" ? "active" : ""}`}
          onClick={() => toggle("files")}
          title="Explorer"
        >
          <Files size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activeSidebarView === "search" ? "active" : ""}`}
          onClick={() => toggle("search")}
          title="Search"
        >
          <Search size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activeSidebarView === "git" ? "active" : ""}`}
          onClick={() => toggle("git")}
          title="Source Control"
        >
          <GitBranch size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activeSidebarView === "container" ? "active" : ""}`}
          onClick={() => toggle("container")}
          title="Dev Containers"
        >
          <Container size={20} />
        </button>
      </div>
      <div className="activity-bar-bottom">
        <button
          className="activity-bar-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
