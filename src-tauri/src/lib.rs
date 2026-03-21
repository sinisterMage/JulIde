mod debugger;
mod fs;
mod julia;
mod lsp;
mod pluto;
mod pty;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
