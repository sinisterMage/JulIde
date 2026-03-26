use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

#[derive(Clone, Serialize, Deserialize)]
pub struct PtyOutputEvent {
    pub session_id: String,
    pub data: String,
}

pub(crate) struct PtySession {
    pub(crate) writer: Box<dyn Write + Send>,
    pub(crate) master: Box<dyn portable_pty::MasterPty + Send>,
}

pub(crate) static PTY_SESSIONS: Lazy<Arc<Mutex<HashMap<String, PtySession>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

#[tauri::command]
pub async fn pty_create(
    app: tauri::AppHandle,
    session_id: String,
    julia_path: Option<String>,
    project_path: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;

    let julia = if let Some(p) = julia_path {
        std::path::PathBuf::from(p)
    } else {
        crate::julia::find_julia()
            .await
            .ok_or_else(|| "Julia not found.".to_string())?
    };

    let pty_system = portable_pty::native_pty_system();
    let pair = pty_system
        .openpty(portable_pty::PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = portable_pty::CommandBuilder::new(&julia);
    if let Some(ref proj) = project_path {
        cmd.arg(format!("--project={}", proj));
    }
    cmd.env("TERM", "xterm-256color");
    if let Ok(home) = std::env::var("HOME") {
        cmd.env("HOME", &home);
    }
    // Pass PATH from shell detection
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    if let Ok(output) = std::process::Command::new(&shell)
        .args(["-l", "-c", "echo $PATH"])
        .output()
    {
        if output.status.success() {
            let path_val = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();
            cmd.env("PATH", &path_val);
        }
    }

    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    {
        let mut sessions = PTY_SESSIONS.lock().unwrap();
        sessions.insert(
            session_id.clone(),
            PtySession {
                writer,
                master: pair.master,
            },
        );
    }

    // Spawn background reader thread
    let app_clone = app.clone();
    let sid = session_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(
                        "pty-output",
                        PtyOutputEvent {
                            session_id: sid.clone(),
                            data,
                        },
                    );
                }
            }
        }
    });

    Ok(())
}

/// Create a PTY running the user's login shell instead of Julia.
/// Used for tasks like BestieTemplate that need a clean environment.
#[tauri::command]
pub async fn pty_create_shell(
    app: tauri::AppHandle,
    session_id: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());

    let pty_system = portable_pty::native_pty_system();
    let pair = pty_system
        .openpty(portable_pty::PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    // Use `env -i` to start with a completely clean environment,
    // then launch a login shell which re-sources the user's profile.
    let mut cmd = portable_pty::CommandBuilder::new("env");
    cmd.args(["-i", &format!("TERM=xterm-256color")]);
    if let Ok(home) = std::env::var("HOME") {
        cmd.arg(format!("HOME={}", home));
    }
    cmd.arg(&shell);
    cmd.arg("-l");
    if let Some(ref dir) = working_dir {
        cmd.cwd(dir);
    }

    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    {
        let mut sessions = PTY_SESSIONS.lock().unwrap();
        sessions.insert(
            session_id.clone(),
            PtySession {
                writer,
                master: pair.master,
            },
        );
    }

    let app_clone = app.clone();
    let sid = session_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(
                        "pty-output",
                        PtyOutputEvent {
                            session_id: sid.clone(),
                            data,
                        },
                    );
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn pty_write(session_id: String, data: String) -> Result<(), String> {
    let mut sessions = PTY_SESSIONS.lock().unwrap();
    if let Some(session) = sessions.get_mut(&session_id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_resize(session_id: String, rows: u16, cols: u16) -> Result<(), String> {
    let sessions = PTY_SESSIONS.lock().unwrap();
    if let Some(session) = sessions.get(&session_id) {
        session
            .master
            .resize(portable_pty::PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_close(session_id: String) -> Result<(), String> {
    let mut sessions = PTY_SESSIONS.lock().unwrap();
    sessions.remove(&session_id);
    Ok(())
}
