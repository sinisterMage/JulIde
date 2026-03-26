use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Default)]
pub struct JuliaState {
    pub process_pid: Option<u32>,
}

pub type SharedJuliaState = Arc<Mutex<JuliaState>>;

pub fn new_julia_state() -> SharedJuliaState {
    Arc::new(Mutex::new(JuliaState::default()))
}

#[derive(Clone, Serialize, Deserialize)]
pub struct JuliaOutputEvent {
    pub kind: String, // "stdout" | "stderr" | "done" | "error"
    pub text: String,
    pub exit_code: Option<i32>,
}

static JULIA_PATH: Lazy<Arc<Mutex<Option<PathBuf>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

/// Find the Julia executable, trying multiple strategies.
pub async fn find_julia() -> Option<PathBuf> {
    let cached = JULIA_PATH.lock().await;
    if let Some(ref p) = *cached {
        return Some(p.clone());
    }
    drop(cached);

    let found = find_julia_impl();

    if let Some(ref p) = found {
        let mut cached = JULIA_PATH.lock().await;
        *cached = Some(p.clone());
    }
    found
}

fn find_julia_impl() -> Option<PathBuf> {
    // 0. Check settings-persisted julia_path (highest priority)
    {
        let settings = crate::settings::settings_load();
        if !settings.julia_path.is_empty() {
            let p = PathBuf::from(&settings.julia_path);
            if p.exists() {
                return Some(p);
            }
        }
    }

    // 1. Explicit env var override
    if let Ok(path) = std::env::var("JULIA_PATH") {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Some(p);
        }
    }

    // 2. PATH lookup via shell
    #[cfg(unix)]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        if let Ok(output) = std::process::Command::new(&shell)
            .args(["-l", "-c", "which julia"])
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .to_string();
                let p = PathBuf::from(&path);
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }
    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "where julia"]);
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        if let Ok(output) = cmd.output()
        {
            if output.status.success() {
                // `where` may return multiple lines; take the first
                let path = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                let p = PathBuf::from(&path);
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }

    // 3. juliaup default location
    #[cfg(unix)]
    {
        if let Some(home) = dirs_next::home_dir() {
            let p = home.join(".juliaup/bin/julia");
            if p.exists() {
                return Some(p);
            }
        }
    }
    #[cfg(windows)]
    {
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(&localappdata).join("juliaup\\bin\\julia.exe");
            if p.exists() {
                return Some(p);
            }
        }
    }

    // 4. Common static paths
    #[cfg(unix)]
    {
        for candidate in &[
            "/opt/homebrew/bin/julia",
            "/usr/local/bin/julia",
            "/usr/bin/julia",
        ] {
            let p = PathBuf::from(candidate);
            if p.exists() {
                return Some(p);
            }
        }
    }
    #[cfg(windows)]
    {
        // Check common Windows install locations
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            // Scan LocalAppData\Programs for Julia-* directories
            let programs = PathBuf::from(&localappdata).join("Programs");
            if let Ok(entries) = std::fs::read_dir(&programs) {
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with("Julia") && entry.path().is_dir() {
                        let bin = entry.path().join("bin\\julia.exe");
                        if bin.exists() {
                            return Some(bin);
                        }
                    }
                }
            }
        }
        // Also check Program Files
        for pf in &["C:\\Program Files", "C:\\Program Files (x86)"] {
            if let Ok(entries) = std::fs::read_dir(pf) {
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with("Julia") && entry.path().is_dir() {
                        let bin = entry.path().join("bin\\julia.exe");
                        if bin.exists() {
                            return Some(bin);
                        }
                    }
                }
            }
        }
    }

    // 5. Scan /Applications for Julia*.app (macOS only)
    #[cfg(target_os = "macos")]
    {
        if let Ok(entries) = std::fs::read_dir("/Applications") {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with("Julia") && name_str.ends_with(".app") {
                    let bin = entry
                        .path()
                        .join("Contents/Resources/julia/bin/julia");
                    if bin.exists() {
                        return Some(bin);
                    }
                }
            }
        }
    }

    None
}

#[tauri::command]
pub async fn julia_get_version() -> Result<String, String> {
    let julia = find_julia()
        .await
        .ok_or_else(|| "Julia not found. Install Julia or set JULIA_PATH.".to_string())?;

    let mut cmd = tokio::process::Command::new(&julia);
    cmd.arg("--version");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let output = cmd
        .output()
        .await
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub async fn julia_list_environments() -> Result<Vec<String>, String> {
    let home = dirs_next::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())?;
    let envs_path = home.join(".julia").join("environments");

    let mut envs = vec!["@v#.#".to_string()];
    if let Ok(entries) = std::fs::read_dir(&envs_path) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                envs.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }
    Ok(envs)
}

/// Julia code prepended to every `julia_run` invocation.
/// Registers a custom AbstractDisplay that intercepts rich MIME types
/// (images, SVG, HTML) and emits them as `%%JULIDE_MIME%%{...}%%` lines on
/// stdout so the OutputPanel can render them inline.
const MIME_HELPER: &str = r#"
using Base64
struct _JulIDEMIMEDisplay_ <: AbstractDisplay end
function Base.display(d::_JulIDEMIMEDisplay_, x)
    for mime in (MIME("image/png"), MIME("image/svg+xml"), MIME("text/html"), MIME("image/jpeg"))
        if showable(mime, x)
            buf = IOBuffer()
            show(buf, mime, x)
            data = base64encode(take!(buf))
            println(stdout, string("%%JULIDE_MIME%%{\"type\":\"", string(mime), "\",\"data\":\"", data, "\"}%%"))
            flush(stdout)
            return
        end
    end
    throw(MethodError(display, (d, x)))
end
pushdisplay(_JulIDEMIMEDisplay_())
"#;

#[tauri::command]
pub async fn julia_run(
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedJuliaState>,
    file_path: String,
    project_path: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;
    use tokio::io::AsyncBufReadExt;

    let julia = find_julia()
        .await
        .ok_or_else(|| "Julia not found. Install Julia or set JULIA_PATH.".to_string())?;

    // Build an inline script: MIME helper + include(user_file).
    // Using -e preserves @__FILE__ inside the included file.
    let script = format!("{}\ninclude({:?})", MIME_HELPER, file_path);

    let mut cmd = tokio::process::Command::new(&julia);
    if let Some(ref proj) = project_path {
        cmd.arg(format!("--project={}", proj));
    }
    cmd.arg("-e").arg(&script);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.kill_on_drop(true);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    {
        let mut lock = state.lock().await;
        lock.process_pid = child.id();
    }

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app_out = app.clone();
    let app_err = app.clone();
    let app_done = app.clone();
    let state_done = state.inner().clone();

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_out.emit(
                "julia-output",
                JuliaOutputEvent {
                    kind: "stdout".into(),
                    text: line,
                    exit_code: None,
                },
            );
        }
    });

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit(
                "julia-output",
                JuliaOutputEvent {
                    kind: "stderr".into(),
                    text: line,
                    exit_code: None,
                },
            );
        }
    });

    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status
            .map(|s| s.code().unwrap_or(-1))
            .unwrap_or(-1);
        {
            let mut lock = state_done.lock().await;
            lock.process_pid = None;
        }
        let _ = app_done.emit(
            "julia-output",
            JuliaOutputEvent {
                kind: "done".into(),
                text: String::new(),
                exit_code: Some(code),
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn julia_precompile(
    app: tauri::AppHandle,
    project_path: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;
    use tokio::io::AsyncBufReadExt;

    let julia = find_julia()
        .await
        .ok_or_else(|| "Julia not found.".to_string())?;

    let mut cmd = tokio::process::Command::new(&julia);
    if let Some(ref proj) = project_path {
        cmd.arg(format!("--project={}", proj));
    } else {
        cmd.arg("--project=@.");
    }
    cmd.arg("-e").arg("using Pkg; Pkg.precompile()");
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app_out = app.clone();
    let app_err = app.clone();
    let app_done = app.clone();

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_out.emit("julia-output", JuliaOutputEvent { kind: "stdout".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit("julia-output", JuliaOutputEvent { kind: "stderr".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        let _ = app_done.emit("julia-output", JuliaOutputEvent { kind: "done".into(), text: String::new(), exit_code: Some(code) });
    });

    Ok(())
}

#[tauri::command]
pub async fn julia_clean(
    app: tauri::AppHandle,
    project_path: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;

    let proj = project_path
        .as_deref()
        .unwrap_or(".");

    let manifest = format!("{}/Manifest.toml", proj);
    let mut cleaned = vec![];

    if std::fs::remove_file(&manifest).is_ok() {
        cleaned.push(manifest.clone());
    }

    // Remove compiled cache under .julia/compiled/
    let msg = if cleaned.is_empty() {
        "Nothing to clean.".to_string()
    } else {
        format!("Removed: {}", cleaned.join(", "))
    };

    let _ = app.emit("julia-output", JuliaOutputEvent { kind: "stdout".into(), text: msg, exit_code: None });
    let _ = app.emit("julia-output", JuliaOutputEvent { kind: "done".into(), text: String::new(), exit_code: Some(0) });

    Ok(())
}

#[tauri::command]
pub async fn julia_kill(state: tauri::State<'_, SharedJuliaState>) -> Result<(), String> {
    let lock = state.lock().await;
    if let Some(pid) = lock.process_pid {
        #[cfg(unix)]
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
        #[cfg(windows)]
        {
            // On Windows use taskkill
            let _ = std::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .output();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn julia_pkg_add(
    app: tauri::AppHandle,
    package_name: String,
    project_path: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;
    use tokio::io::AsyncBufReadExt;

    let julia = find_julia()
        .await
        .ok_or_else(|| "Julia not found.".to_string())?;

    let script = format!(r#"using Pkg; Pkg.add("{}")"#, package_name.replace('"', ""));

    let mut cmd = tokio::process::Command::new(&julia);
    if let Some(ref proj) = project_path {
        cmd.arg(format!("--project={}", proj));
    } else {
        cmd.arg("--project=@.");
    }
    cmd.arg("-e").arg(&script);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app_out = app.clone();
    let app_err = app.clone();
    let app_done = app.clone();

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_out.emit("julia-output", JuliaOutputEvent { kind: "stdout".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit("julia-output", JuliaOutputEvent { kind: "stderr".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        let _ = app_done.emit("julia-output", JuliaOutputEvent { kind: "done".into(), text: String::new(), exit_code: Some(code) });
    });

    Ok(())
}

#[tauri::command]
pub async fn julia_pkg_rm(
    app: tauri::AppHandle,
    package_name: String,
    project_path: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;
    use tokio::io::AsyncBufReadExt;

    let julia = find_julia()
        .await
        .ok_or_else(|| "Julia not found.".to_string())?;

    let script = format!(r#"using Pkg; Pkg.rm("{}")"#, package_name.replace('"', ""));

    let mut cmd = tokio::process::Command::new(&julia);
    if let Some(ref proj) = project_path {
        cmd.arg(format!("--project={}", proj));
    } else {
        cmd.arg("--project=@.");
    }
    cmd.arg("-e").arg(&script);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app_out = app.clone();
    let app_err = app.clone();
    let app_done = app.clone();

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_out.emit("julia-output", JuliaOutputEvent { kind: "stdout".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit("julia-output", JuliaOutputEvent { kind: "stderr".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        let _ = app_done.emit("julia-output", JuliaOutputEvent { kind: "done".into(), text: String::new(), exit_code: Some(code) });
    });

    Ok(())
}

/// Create a new Julia project using PkgTemplates.jl.
/// Auto-installs PkgTemplates if not already present.
#[tauri::command]
pub async fn julia_create_project(
    app: tauri::AppHandle,
    package_name: String,
    parent_dir: String,
    user_name: String,
) -> Result<(), String> {
    use tauri::Emitter;
    use tokio::io::AsyncBufReadExt;

    let julia = find_julia()
        .await
        .ok_or_else(|| "Julia not found. Install Julia or set JULIA_PATH.".to_string())?;

    let safe_dir = parent_dir.replace('\\', "/").replace('"', "\\\"");
    let safe_name = package_name.replace('"', "\\\"");
    let safe_user = user_name.replace('"', "\\\"");

    let script = format!(
        r#"try; using PkgTemplates; catch; using Pkg; Pkg.add("PkgTemplates"); using PkgTemplates; end; t = Template(; user="{user}", dir="{dir}"); t("{name}")"#,
        user = safe_user,
        dir = safe_dir,
        name = safe_name,
    );

    let mut cmd = tokio::process::Command::new(&julia);
    cmd.arg("-e").arg(&script);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.kill_on_drop(true);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app_out = app.clone();
    let app_err = app.clone();
    let app_done = app.clone();

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_out.emit("julia-output", JuliaOutputEvent { kind: "stdout".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit("julia-output", JuliaOutputEvent { kind: "stderr".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        let _ = app_done.emit("julia-output", JuliaOutputEvent { kind: "done".into(), text: String::new(), exit_code: Some(code) });
    });

    Ok(())
}

/// Create a new Julia project using BestieTemplate.jl.
/// Runs non-interactively with a clean environment (no Tauri/Cargo vars)
/// to avoid breaking pixi/CondaPkg.
#[tauri::command]
pub async fn julia_create_project_bestie(
    app: tauri::AppHandle,
    parent_dir: String,
    package_name: String,
    package_owner: String,
    authors: String,
    julia_min_version: String,
    license: String,
    strategy_level: u32,
) -> Result<(), String> {
    use tauri::Emitter;
    use tokio::io::AsyncBufReadExt;

    let julia = find_julia()
        .await
        .ok_or_else(|| "Julia not found. Install Julia or set JULIA_PATH.".to_string())?;

    let dst_path = format!(
        "{}/{}.jl",
        parent_dir.replace('\\', "/").replace('"', "\\\""),
        package_name.replace('"', "\\\"")
    );

    let script = format!(
        r#"try; using BestieTemplate; catch; using Pkg; Pkg.add("BestieTemplate"); using BestieTemplate; end
data = Dict(
    "PackageName" => "{name}",
    "PackageOwner" => "{owner}",
    "Authors" => "{authors}",
    "JuliaMinVersion" => "{julia_ver}",
    "License" => "{license}",
    "StrategyLevel" => {strategy},
)
BestieTemplate.generate("{dst}", data; defaults=true, quiet=false)"#,
        name = package_name.replace('"', "\\\""),
        owner = package_owner.replace('"', "\\\""),
        authors = authors.replace('"', "\\\""),
        julia_ver = julia_min_version.replace('"', "\\\""),
        license = license.replace('"', "\\\""),
        strategy = strategy_level,
        dst = dst_path,
    );

    let mut cmd = tokio::process::Command::new(&julia);
    // Start with a clean environment to avoid Tauri/Cargo vars
    // breaking pixi/CondaPkg.
    cmd.env_clear();
    if let Ok(home) = std::env::var("HOME") {
        cmd.env("HOME", &home);
    }
    cmd.env("TERM", "xterm-256color");
    // Get a clean PATH from the user's login shell
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    if let Ok(output) = std::process::Command::new(&shell)
        .args(["-l", "-c", "echo $PATH"])
        .output()
    {
        if output.status.success() {
            let path_val = String::from_utf8_lossy(&output.stdout).trim().to_string();
            cmd.env("PATH", &path_val);
        }
    }
    cmd.arg("-e").arg(&script);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.kill_on_drop(true);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app_out = app.clone();
    let app_err = app.clone();
    let app_done = app.clone();

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_out.emit("julia-output", JuliaOutputEvent { kind: "stdout".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit("julia-output", JuliaOutputEvent { kind: "stderr".into(), text: line, exit_code: None });
        }
    });

    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        let _ = app_done.emit("julia-output", JuliaOutputEvent { kind: "done".into(), text: String::new(), exit_code: Some(code) });
    });

    Ok(())
}

/// Evaluate a code snippet and capture output (for inline code cells).
/// Like julia_run but takes code directly instead of a file path.
#[tauri::command]
pub async fn julia_eval(
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedJuliaState>,
    code: String,
    project_path: Option<String>,
) -> Result<(), String> {
    use tauri::Emitter;
    use tokio::io::AsyncBufReadExt;

    let julia = find_julia()
        .await
        .ok_or_else(|| "Julia not found. Install Julia or set JULIA_PATH.".to_string())?;

    let script = format!("{}\n{}", MIME_HELPER, code);

    let mut cmd = tokio::process::Command::new(&julia);
    if let Some(ref proj) = project_path {
        cmd.arg(format!("--project={}", proj));
    }
    cmd.arg("-e").arg(&script);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.kill_on_drop(true);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    {
        let mut lock = state.lock().await;
        lock.process_pid = child.id();
    }

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app_out = app.clone();
    let app_err = app.clone();
    let app_done = app.clone();
    let state_done = state.inner().clone();

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_out.emit("julia-output", JuliaOutputEvent {
                kind: "stdout".into(), text: line, exit_code: None,
            });
        }
    });

    tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit("julia-output", JuliaOutputEvent {
                kind: "stderr".into(), text: line, exit_code: None,
            });
        }
    });

    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        {
            let mut lock = state_done.lock().await;
            lock.process_pid = None;
        }
        let _ = app_done.emit("julia-output", JuliaOutputEvent {
            kind: "done".into(), text: String::new(), exit_code: Some(code),
        });
    });

    Ok(())
}

#[tauri::command]
pub async fn julia_set_path(path: String) -> Result<(), String> {
    if path.is_empty() {
        let mut cached = JULIA_PATH.lock().await;
        *cached = None;
        return Ok(());
    }
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    let mut cached = JULIA_PATH.lock().await;
    *cached = Some(p);
    Ok(())
}
