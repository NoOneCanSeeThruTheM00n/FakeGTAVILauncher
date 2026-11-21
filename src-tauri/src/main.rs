#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::{AppHandle, Manager, State};

const GAME_EXECUTABLE: &str = "gta-vi-splash.exe";

struct GameProcess(Mutex<bool>);

fn install_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not find the application data directory: {error}"))?;

    Ok(app_data_dir.join("GTA VI").join(GAME_EXECUTABLE))
}

fn bundled_executable(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Could not find the bundled resources: {error}"))?
        .join(GAME_EXECUTABLE);

    if resource_path.is_file() {
        return Ok(resource_path);
    }

    let development_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join(GAME_EXECUTABLE);
    if development_path.is_file() {
        return Ok(development_path);
    }

    Err(format!(
        "The bundled game executable is missing: {}",
        resource_path.display()
    ))
}

#[tauri::command]
fn get_install_status(app: AppHandle) -> Result<bool, String> {
    Ok(install_path(&app)?.is_file())
}

#[tauri::command]
fn install_game(app: AppHandle) -> Result<String, String> {
    let source = bundled_executable(&app)?;
    let destination = install_path(&app)?;
    let install_dir = destination
        .parent()
        .ok_or_else(|| "Could not determine the game install directory.".to_string())?;
    let temporary = install_dir.join(format!(".{GAME_EXECUTABLE}.installing"));

    fs::create_dir_all(install_dir)
        .map_err(|error| format!("Could not create the game install directory: {error}"))?;
    if let Err(error) = fs::copy(&source, &temporary) {
        let cleanup_error = fs::remove_file(&temporary).err();
        let cleanup_message = cleanup_error
            .map(|cleanup| format!(" Could not remove the incomplete temporary file: {cleanup}"))
            .unwrap_or_default();
        return Err(format!(
            "Could not copy the game executable: {error}.{cleanup_message}"
        ));
    }

    if destination.exists() {
        if let Err(error) = fs::remove_file(&destination) {
            let cleanup_error = fs::remove_file(&temporary).err();
            let cleanup_message = cleanup_error
                .map(|cleanup| format!(" Could not remove the temporary file: {cleanup}"))
                .unwrap_or_default();
            return Err(format!(
                "Could not replace the existing game executable: {error}.{cleanup_message}"
            ));
        }
    }
    if let Err(error) = fs::rename(&temporary, &destination) {
        let cleanup_error = fs::remove_file(&temporary).err();
        let cleanup_message = cleanup_error
            .map(|cleanup| format!(" Could not remove the temporary file: {cleanup}"))
            .unwrap_or_default();
        return Err(format!(
            "Could not finish installing the game executable: {error}.{cleanup_message}"
        ));
    }

    Ok(destination.display().to_string())
}

#[tauri::command]
fn play_game(app: AppHandle, game_process: State<'_, GameProcess>) -> Result<(), String> {
    let executable = install_path(&app)?;
    if !executable.is_file() {
        return Err("The game is not installed. Install it before playing.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let child = Command::new(&executable)
            .spawn()
            .map_err(|error| format!("Could not start the game executable: {error}"))?;
        *game_process
            .0
            .lock()
            .map_err(|_| "Could not access game process state.".to_string())? = child.id() > 0;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = executable;
        Err("The supplied game executable can only run on Windows.".to_string())
    }
}

#[cfg(target_os = "windows")]
fn process_is_running() -> bool {
    #[cfg(target_os = "windows")]
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    #[allow(unused_mut)]
    let mut command = Command::new("tasklist");
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command
        .args(["/FI", "IMAGENAME eq gta-vi-splash.exe", "/FO", "CSV", "/NH"])
        .output();

    match output {
        Ok(output) => {
            let text = String::from_utf8_lossy(&output.stdout);
            text.to_lowercase().contains("gta-vi-splash.exe")
        }
        Err(_) => true,
    }
}

#[tauri::command]
fn get_game_running(game_process: State<'_, GameProcess>) -> Result<bool, String> {
    let _pid_guard = game_process
        .0
        .lock()
        .map_err(|_| "Could not access game process state.".to_string())?;

    #[cfg(target_os = "windows")]
    return Ok(process_is_running());

    #[cfg(not(target_os = "windows"))]
    Ok(false)
}

#[tauri::command]
fn close_game(game_process: State<'_, GameProcess>) -> Result<(), String> {
    let mut running_guard = game_process
        .0
        .lock()
        .map_err(|_| "Could not access game process state.".to_string())?;
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let status = Command::new("taskkill")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/IM", "gta-vi-splash.exe", "/T", "/F"])
            .status()
            .map_err(|error| format!("Could not close the game: {error}"))?;
        if !status.success() {
            return Err("Could not close the running game process.".to_string());
        }
    }

    *running_guard = false;
    Ok(())
}

#[tauri::command]
fn uninstall_game(app: AppHandle) -> Result<(), String> {
    let executable = install_path(&app)?;
    if executable.is_file() {
        fs::remove_file(&executable)
            .map_err(|error| format!("Could not uninstall the game: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
fn check_game_files(app: AppHandle) -> Result<String, String> {
    let source = bundled_executable(&app)?;
    let destination = install_path(&app)?;

    if !destination.is_file() {
        return Err("The game is not installed.".to_string());
    }

    let source_size = source.metadata().map_err(|error| error.to_string())?.len();
    let destination_size = destination.metadata().map_err(|error| error.to_string())?.len();
    if source_size == destination_size {
        Ok("Game files are intact.".to_string())
    } else {
        Err("The installed game file appears to be damaged.".to_string())
    }
}

#[tauri::command]
fn open_game_folder(app: AppHandle) -> Result<(), String> {
    let executable = install_path(&app)?;
    let folder = executable
        .parent()
        .ok_or_else(|| "Could not determine the game install folder.".to_string())?;

    fs::create_dir_all(folder)
        .map_err(|error| format!("Could not create the game install folder: {error}"))?;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe")
            .arg(folder)
            .spawn()
            .map_err(|error| format!("Could not open the game folder: {error}"))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Opening the game folder is only supported on Windows.".to_string())
    }
}

#[tauri::command]
fn open_github() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32.exe")
            .args([
                "url.dll,FileProtocolHandler",
                "https://github.com/NoOneCanSeeThruTheM00n/FakeGTAVILauncher",
            ])
            .spawn()
            .map_err(|error| format!("Could not open GitHub: {error}"))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Opening GitHub is only supported on Windows.".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .manage(GameProcess(Mutex::new(false)))
        .invoke_handler(tauri::generate_handler![
            get_install_status,
            install_game,
            play_game,
            get_game_running,
            close_game,
            uninstall_game,
            check_game_files,
            open_game_folder,
            open_github
        ])
        .run(tauri::generate_context!())
        .expect("error while running the GTA VI launcher");
}
