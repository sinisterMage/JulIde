use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_tab_size")]
    pub tab_size: u32,
    #[serde(default = "default_true")]
    pub minimap_enabled: bool,
    #[serde(default = "default_word_wrap")]
    pub word_wrap: String,
    #[serde(default = "default_true")]
    pub auto_save: bool,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_terminal_font_size")]
    pub terminal_font_size: u32,
    #[serde(default)]
    pub recent_workspaces: Vec<String>,
    #[serde(default = "default_container_runtime")]
    pub container_runtime: String,
    #[serde(default)]
    pub container_remote_host: String,
    #[serde(default = "default_true")]
    pub container_auto_detect: bool,
    #[serde(default = "default_true")]
    pub display_forwarding: bool,
    #[serde(default)]
    pub gpu_passthrough: bool,
    #[serde(default = "default_true")]
    pub selinux_label: bool,
    #[serde(default = "default_true")]
    pub persist_julia_packages: bool,
    #[serde(default = "default_pluto_port")]
    pub pluto_port: u32,
}

fn default_font_size() -> u32 { 14 }
fn default_pluto_port() -> u32 { 3000 }
fn default_font_family() -> String { "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace".into() }
fn default_tab_size() -> u32 { 4 }
fn default_true() -> bool { true }
fn default_word_wrap() -> String { "off".into() }
fn default_theme() -> String { "julide-dark".into() }
fn default_terminal_font_size() -> u32 { 13 }
fn default_container_runtime() -> String { "auto".into() }

impl Default for Settings {
    fn default() -> Self {
        Settings {
            font_size: default_font_size(),
            font_family: default_font_family(),
            tab_size: default_tab_size(),
            minimap_enabled: default_true(),
            word_wrap: default_word_wrap(),
            auto_save: default_true(),
            theme: default_theme(),
            terminal_font_size: default_terminal_font_size(),
            recent_workspaces: Vec::new(),
            container_runtime: default_container_runtime(),
            container_remote_host: String::new(),
            container_auto_detect: default_true(),
            display_forwarding: default_true(),
            gpu_passthrough: false,
            selinux_label: default_true(),
            persist_julia_packages: default_true(),
            pluto_port: default_pluto_port(),
        }
    }
}

fn settings_path() -> PathBuf {
    let config = dirs_next::config_dir().unwrap_or_else(|| PathBuf::from("."));
    config.join("julide").join("settings.json")
}

#[tauri::command]
pub fn settings_load() -> Settings {
    let path = settings_path();
    if let Ok(content) = fs::read_to_string(&path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Settings::default()
    }
}

#[tauri::command]
pub fn settings_save(settings: Settings) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn settings_add_recent_workspace(workspace_path: String) -> Result<(), String> {
    let mut settings = settings_load();
    settings.recent_workspaces.retain(|w| w != &workspace_path);
    settings.recent_workspaces.insert(0, workspace_path);
    settings.recent_workspaces.truncate(10);
    settings_save(settings)
}
