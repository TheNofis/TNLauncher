use crate::error::Result;
use crate::services::launcher::{self, LaunchEvent};
use crate::state::AppState;
use tauri::{ipc::Channel, AppHandle, State};

#[tauri::command]
/// `world`: a folder in the instance's `saves/` to open straight away; `None` = the title screen.
pub async fn launch(app: AppHandle, id: String, world: Option<String>, on_event: Channel<LaunchEvent>) -> Result<()> {
    launcher::launch(&app, &id, world.as_deref(), on_event).await
}

#[tauri::command]
pub fn stop_game(state: State<'_, AppState>, id: String) -> Result<()> {
    launcher::stop(&state, &id)
}

/// The last session's game output, for instances whose lines were not streamed this run.
#[tauri::command]
pub fn read_game_log(state: State<'_, AppState>, id: String) -> Result<String> {
    launcher::read_log(&state, &id)
}

/// The last session's crash report and JVM error file; empty when it wrote none.
#[tauri::command]
pub fn read_crash_report(state: State<'_, AppState>, id: String) -> Result<String> {
    crate::services::repair::crash_reports(&state, &id)
}

/// Uploads a log to mclo.gs, which strips IPs and tokens; returns the page URL.
#[tauri::command]
pub async fn share_log(state: State<'_, AppState>, text: String) -> Result<String> {
    #[derive(serde::Deserialize)]
    struct Out {
        success: bool,
        url: Option<String>,
        error: Option<String>,
    }
    // mclo.gs keeps at most 25k lines; the end of a log is where it broke.
    let lines: Vec<&str> = text.lines().collect();
    let content = lines[lines.len().saturating_sub(25_000)..].join("\n");
    let out: Out = state.http.post("https://api.mclo.gs/1/log").form(&[("content", content)]).send().await?.json().await?;
    match out {
        Out { success: true, url: Some(url), .. } => Ok(url),
        Out { error, .. } => Err(crate::error::AppError::Invalid(error.unwrap_or_else(|| "mclo.gs refused the upload".into()))),
    }
}
