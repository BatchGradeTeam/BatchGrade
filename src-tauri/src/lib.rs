mod cpp;
mod docker;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(cpp::SelectedSource::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            docker::check_docker_status,
            docker::start_docker_desktop,
            docker::check_cpp_environment,
            docker::provision_cpp_environment,
            cpp::select_cpp_source,
            cpp::run_cpp_source
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
