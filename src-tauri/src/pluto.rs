use crate::julia::find_julia;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct PlutoStatusEvent {
    pub status: String, // "off" | "starting" | "ready" | "error"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

struct PlutoState {
    process: Option<tokio::process::Child>,
}

static PLUTO_STATE: Lazy<Arc<Mutex<PlutoState>>> =
    Lazy::new(|| Arc::new(Mutex::new(PlutoState { process: None })));

// ── URL extraction ────────────────────────────────────────────────────────────

fn extract_pluto_url(line: &str) -> Option<String> {
    for prefix in &["http://127.0.0.1:", "http://localhost:"] {
        if let Some(start) = line.find(prefix) {
            let rest = &line[start..];
            let end = rest
                .find(|c: char| c.is_whitespace() || c == '"' || c == '\'')
                .unwrap_or(rest.len());
            let url = &rest[..end];
            // Need at least prefix + port digit
            if url.len() > prefix.len() + 1 {
                return Some(url.to_string());
            }
        }
    }
    None
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Start a Pluto.jl server for `notebook_path` and open a new JulIDE window.
/// Pass an empty `notebook_path` to open the Pluto dashboard without a specific notebook.
#[tauri::command]
pub async fn pluto_open(
    app: tauri::AppHandle,
    notebook_path: String,
    workspace_path: Option<String>,
    port: u32,
) -> Result<(), String> {
    let julia = find_julia()
        .await
        .ok_or_else(|| "Julia not found. Install Julia or set JULIA_PATH.".to_string())?;

    let notebook_name = if notebook_path.is_empty() {
        "Notebooks".to_string()
    } else {
        std::path::Path::new(&notebook_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("notebook.jl")
            .to_string()
    };

    let _ = app.emit(
        "pluto-status",
        PlutoStatusEvent {
            status: "starting".to_string(),
            message: Some(format!("Starting Pluto for {}", notebook_name)),
        },
    );

    // Build the Julia one-liner that starts Pluto
    let escaped_path = notebook_path
        .replace('\\', "\\\\")
        .replace('"', "\\\"");
    let pluto_code = if notebook_path.is_empty() {
        format!(
            concat!(
                "try; using Pluto; catch; ",
                r#"error("Pluto.jl not installed. Run: using Pkg; Pkg.add(\"Pluto\")"); "#,
                "end; ",
                "Pluto.run(launch_browser=false, port={})"
            ),
            port
        )
    } else {
        format!(
            concat!(
                "try; using Pluto; catch; ",
                r#"error("Pluto.jl not installed. Run: using Pkg; Pkg.add(\"Pluto\")"); "#,
                r#"end; Pluto.run(notebook="{}", launch_browser=false, port={})"#
            ),
            escaped_path,
            port
        )
    };

    let mut cmd = tokio::process::Command::new(&julia);
    if let Some(ref proj) = workspace_path {
        cmd.arg(format!("--project={}", proj));
    }
    cmd.arg("--startup-file=no");
    cmd.arg("-e").arg(&pluto_code);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Store child — drop of the previous child kills the previous server
    {
        let mut state = PLUTO_STATE.lock().await;
        state.process = None; // drops & kills any previous Pluto
        state.process = Some(child);
    }

    // Drain stdout silently (Pluto logs go to stderr via Julia's @info)
    tokio::spawn(async move {
        use tokio::io::AsyncBufReadExt;
        let mut lines = tokio::io::BufReader::new(stdout).lines();
        while let Ok(Some(_)) = lines.next_line().await {}
    });

    // Read stderr: find the server URL, then open a new Tauri window
    let app_err = app.clone();
    let notebook_name_err = notebook_name.clone();
    tokio::spawn(async move {
        use tokio::io::AsyncBufReadExt;
        let mut lines = tokio::io::BufReader::new(stderr).lines();
        let mut url_found = false;
        let mut error_buf: Vec<String> = Vec::new();

        while let Ok(Some(line)) = lines.next_line().await {
            if !url_found {
                if let Some(url) = extract_pluto_url(&line) {
                    url_found = true;
                    let _ = app_err.emit(
                        "pluto-status",
                        PlutoStatusEvent {
                            status: "ready".to_string(),
                            message: Some(url.clone()),
                        },
                    );
                    if let Ok(parsed) = url.parse::<tauri::Url>() {
                        let label = format!("pluto-{}", uuid::Uuid::new_v4().simple());
                        let _ = tauri::WebviewWindowBuilder::new(
                            &app_err,
                            label,
                            tauri::WebviewUrl::External(parsed),
                        )
                        .title(format!("Pluto \u{2014} {}", notebook_name_err))
                        .inner_size(1280.0, 800.0)
                        .build();
                    }
                } else if line.to_lowercase().contains("error") {
                    error_buf.push(line);
                }
            }
        }

        // Server exited or never started
        if !url_found {
            let msg = if !error_buf.is_empty() {
                error_buf.join("; ")
            } else {
                "Pluto server did not start. Is Pluto.jl installed?".to_string()
            };
            let _ = app_err.emit(
                "pluto-status",
                PlutoStatusEvent {
                    status: "error".to_string(),
                    message: Some(msg),
                },
            );
        } else {
            // Normal exit after user closes the server
            let _ = app_err.emit(
                "pluto-status",
                PlutoStatusEvent {
                    status: "off".to_string(),
                    message: None,
                },
            );
        }
    });

    Ok(())
}

/// Stop the running Pluto server (if any).
#[tauri::command]
pub async fn pluto_stop() -> Result<(), String> {
    let mut state = PLUTO_STATE.lock().await;
    state.process = None; // kill_on_drop terminates the process
    Ok(())
}
