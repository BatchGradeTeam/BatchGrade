use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::docker::{self, CppRunResult};

const MAX_SOURCE_BYTES: u64 = 256 * 1024;

#[derive(Default)]
pub struct SelectedSource(Mutex<Option<PathBuf>>);

#[tauri::command]
pub async fn select_cpp_source(
    window: WebviewWindow,
    selected: State<'_, SelectedSource>,
) -> Result<Option<String>, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    let picker = window
        .dialog()
        .file()
        .set_title("Select C++ file")
        .add_filter("C++ source files", &["cpp"]);
    #[cfg(desktop)]
    let picker = picker.set_parent(&window);
    picker.pick_file(move |selection| {
        let _ = send.send(selection);
    });
    let Some(selection) = receive
        .await
        .map_err(|_| "The file picker did not respond.")?
    else {
        return Ok(None);
    };
    let path = selection
        .into_path()
        .map_err(|_| "Select a local C++ source file.")?;
    let display = path.to_string_lossy().into_owned();
    *selected
        .0
        .lock()
        .map_err(|_| "Could not save the file selection.")? = Some(path);
    Ok(Some(display))
}

#[tauri::command]
pub async fn run_cpp_source(selected: State<'_, SelectedSource>) -> Result<CppRunResult, String> {
    let path = selected
        .0
        .lock()
        .map_err(|_| "Could not read the file selection.")?
        .clone()
        .ok_or("Select a C++ file first.")?;
    // Keep the job alive for cleanup even if the invoking window closes.
    tauri::async_runtime::spawn(async move {
        let source = tauri::async_runtime::spawn_blocking(move || read_source(&path))
            .await
            .map_err(|_| "Could not read the C++ source file.")??;
        docker::compile_and_run(source).await
    })
    .await
    .map_err(|_| "The compiler task stopped unexpectedly.")?
}

fn read_source(path: &Path) -> Result<Vec<u8>, String> {
    let path = path
        .canonicalize()
        .map_err(|_| "Could not open the selected file.")?;
    if !path.is_file()
        || !path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("cpp"))
    {
        return Err("Select a regular .cpp file.".into());
    }
    let file = File::open(path).map_err(|_| "Could not open the selected file.")?;
    let mut bytes = Vec::new();
    file.take(MAX_SOURCE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Could not read the selected file.")?;
    if bytes.len() as u64 > MAX_SOURCE_BYTES {
        return Err("The C++ source file exceeds 256 KiB.".into());
    }
    Ok(bytes)
}
