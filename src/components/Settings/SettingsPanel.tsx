import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { PluginSettings } from "./PluginSettings";
import { GitAuthSettings } from "../Git/GitAuthSettings";

export function SettingsPanel() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const setOpen = useSettingsStore((s) => s.setSettingsOpen);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
      // Cmd+, to open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={() => setOpen(false)}>
      <div
        ref={panelRef}
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="settings-body">
          <SettingsSection title="Editor">
            <SettingRow label="Font Size">
              <input
                type="number"
                className="settings-input settings-number"
                value={settings.fontSize}
                min={8}
                max={32}
                onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              />
            </SettingRow>

            <SettingRow label="Font Family">
              <input
                type="text"
                className="settings-input"
                value={settings.fontFamily}
                onChange={(e) => updateSettings({ fontFamily: e.target.value })}
              />
            </SettingRow>

            <SettingRow label="Tab Size">
              <input
                type="number"
                className="settings-input settings-number"
                value={settings.tabSize}
                min={1}
                max={8}
                onChange={(e) => updateSettings({ tabSize: Number(e.target.value) })}
              />
            </SettingRow>

            <SettingRow label="Word Wrap">
              <select
                className="settings-select"
                value={settings.wordWrap}
                onChange={(e) => updateSettings({ wordWrap: e.target.value })}
              >
                <option value="off">Off</option>
                <option value="on">On</option>
                <option value="wordWrapColumn">Word Wrap Column</option>
                <option value="bounded">Bounded</option>
              </select>
            </SettingRow>

            <SettingRow label="Minimap">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.minimapEnabled}
                  onChange={(e) => updateSettings({ minimapEnabled: e.target.checked })}
                />
                <span className="settings-toggle-label">
                  {settings.minimapEnabled ? "Enabled" : "Disabled"}
                </span>
              </label>
            </SettingRow>

            <SettingRow label="Auto Save">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => updateSettings({ autoSave: e.target.checked })}
                />
                <span className="settings-toggle-label">
                  {settings.autoSave ? "Enabled" : "Disabled"}
                </span>
              </label>
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Terminal">
            <SettingRow label="Font Size">
              <input
                type="number"
                className="settings-input settings-number"
                value={settings.terminalFontSize}
                min={8}
                max={28}
                onChange={(e) => updateSettings({ terminalFontSize: Number(e.target.value) })}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Appearance">
            <SettingRow label="Theme">
              <select
                className="settings-select"
                value={settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value })}
              >
                <option value="julide-dark">JulIDE Dark</option>
                <option value="julide-light">JulIDE Light</option>
              </select>
            </SettingRow>

            <SettingRow label="Start Maximized">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.startMaximized}
                  onChange={(e) => updateSettings({ startMaximized: e.target.checked })}
                />
                <span className="settings-toggle-label">
                  {settings.startMaximized ? "Maximized" : "Windowed"}
                </span>
              </label>
              <span className="settings-hint">
                Takes effect on next launch
              </span>
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Julia">
            <SettingRow label="Julia Executable Path">
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="Auto-detect"
                  value={settings.juliaPath}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateSettings({ juliaPath: val });
                    invoke("julia_set_path", { path: val }).catch(() => {});
                  }}
                />
                <button
                  className="settings-browse-btn"
                  onClick={async () => {
                    const path = await invoke<string | null>("dialog_pick_executable");
                    if (path) {
                      await updateSettings({ juliaPath: path });
                      invoke("julia_set_path", { path }).catch(() => {});
                    }
                  }}
                >
                  Browse
                </button>
              </div>
              <span className="settings-hint">
                Leave empty to auto-detect
              </span>
            </SettingRow>

            <SettingRow label="Pluto Port">
              <input
                type="number"
                className="settings-input settings-number"
                value={settings.plutoPort}
                min={1024}
                max={65535}
                onChange={(e) => updateSettings({ plutoPort: Number(e.target.value) })}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Containers">
            <SettingRow label="Runtime">
              <select
                className="settings-select"
                value={settings.containerRuntime}
                onChange={(e) => updateSettings({ containerRuntime: e.target.value })}
              >
                <option value="auto">Auto Detect</option>
                <option value="docker">Docker</option>
                <option value="podman">Podman</option>
              </select>
            </SettingRow>

            <SettingRow label="Remote Host">
              <input
                type="text"
                className="settings-input"
                placeholder="ssh://user@host (optional)"
                value={settings.containerRemoteHost}
                onChange={(e) => updateSettings({ containerRemoteHost: e.target.value })}
                title="SSH connection address (not a password). Auth uses SSH keys via ssh-agent."
              />
              <span className="settings-hint">
                Uses SSH key auth — never stores passwords
              </span>
            </SettingRow>

            <SettingRow label="Auto-detect devcontainer.json">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.containerAutoDetect}
                  onChange={(e) => updateSettings({ containerAutoDetect: e.target.checked })}
                />
                <span className="settings-toggle-label">
                  {settings.containerAutoDetect ? "Enabled" : "Disabled"}
                </span>
              </label>
            </SettingRow>

            <SettingRow label="Display Forwarding (X11)">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.displayForwarding}
                  onChange={(e) => updateSettings({ displayForwarding: e.target.checked })}
                />
                <span className="settings-toggle-label">
                  {settings.displayForwarding ? "Enabled" : "Disabled"}
                </span>
              </label>
            </SettingRow>

            <SettingRow label="GPU Passthrough">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.gpuPassthrough}
                  onChange={(e) => updateSettings({ gpuPassthrough: e.target.checked })}
                />
                <span className="settings-toggle-label">
                  {settings.gpuPassthrough ? "Enabled (GLMakie)" : "Disabled"}
                </span>
              </label>
            </SettingRow>

            <SettingRow label="SELinux :Z Label">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.selinuxLabel}
                  onChange={(e) => updateSettings({ selinuxLabel: e.target.checked })}
                />
                <span className="settings-toggle-label">
                  {settings.selinuxLabel ? "Auto (Fedora/RHEL)" : "Disabled"}
                </span>
              </label>
            </SettingRow>

            <SettingRow label="Persist Julia Packages">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.persistJuliaPackages}
                  onChange={(e) => updateSettings({ persistJuliaPackages: e.target.checked })}
                />
                <span className="settings-toggle-label">
                  {settings.persistJuliaPackages ? "Enabled (~/.julia volume)" : "Disabled"}
                </span>
              </label>
            </SettingRow>
          </SettingsSection>

          <GitAuthSettings />

          <PluginSettings />
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{title}</h3>
      {children}
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <label className="settings-label">{label}</label>
      <div className="settings-control">{children}</div>
    </div>
  );
}
