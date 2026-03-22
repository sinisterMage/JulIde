mod container;
mod debugger;
mod fs;
mod git;
mod julia;
mod lsp;
mod pluto;
mod pty;
mod search;
mod settings;
mod watcher;

use julia::new_julia_state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(new_julia_state())
        .invoke_handler(tauri::generate_handler![
            // File system
            fs::fs_get_tree,
            fs::fs_read_file,
            fs::fs_write_file,
            fs::fs_create_file,
            fs::fs_create_dir,
            fs::fs_delete_entry,
            fs::fs_rename,
            fs::fs_exists,
            fs::dialog_open_file,
            fs::dialog_open_folder,
            fs::dialog_save_file,
            // Julia
            julia::julia_get_version,
            julia::julia_list_environments,
            julia::julia_run,
            julia::julia_precompile,
            julia::julia_clean,
            julia::julia_kill,
            julia::julia_set_path,
            julia::julia_pkg_add,
            julia::julia_pkg_rm,
            // PTY / Terminal
            pty::pty_create,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_close,
            // Debugger
            debugger::debug_start,
            debugger::debug_continue,
            debugger::debug_step_over,
            debugger::debug_step_into,
            debugger::debug_step_out,
            debugger::debug_stop,
            debugger::debug_set_breakpoint,
            debugger::debug_remove_breakpoint,
            debugger::debug_get_breakpoints,
            debugger::debug_get_variables,
            // LSP
            lsp::lsp_start,
            lsp::lsp_stop,
            lsp::lsp_send_request,
            lsp::lsp_send_notification,
            lsp::lsp_send_response,
            // Pluto
            pluto::pluto_open,
            pluto::pluto_stop,
            // Search
            search::fs_search_files,
            // File watcher
            watcher::watcher_start,
            watcher::watcher_stop,
            // Settings
            settings::settings_load,
            settings::settings_save,
            settings::settings_add_recent_workspace,
            // Git
            git::git_is_repo,
            git::git_branch_current,
            git::git_branches,
            git::git_status,
            git::git_diff,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_log,
            git::git_checkout_branch,
            // Container
            container::container_detect_runtime,
            container::container_set_runtime,
            container::container_list,
            container::container_list_images,
            container::container_inspect,
            container::container_start,
            container::container_stop,
            container::container_restart,
            container::container_remove,
            container::container_logs,
            container::container_pull_image,
            container::container_exec,
            container::devcontainer_detect,
            container::devcontainer_load_config,
            container::devcontainer_up,
            container::devcontainer_stop,
            container::devcontainer_rebuild,
            container::devcontainer_down,
            container::container_pty_create,
            container::container_julia_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
