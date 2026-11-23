use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

/// 递归搜索的最大目录深度。
const SEARCH_MAX_DEPTH: usize = 6;
/// 递归搜索最多返回的结果条数。
const SEARCH_MAX_RESULTS: usize = 50;
/// 列目录最多返回的条目数。
const LIST_MAX_ENTRIES: usize = 500;

/// 打开白名单内的应用程序。
///
/// 只接受内置白名单中的名称（大小写不敏感，可带 `.exe` 后缀），
/// 直接用 `std::process::Command` 启动可执行文件，绝不经过 shell。
#[tauri::command]
fn open_application(app: String) -> Result<String, String> {
    let raw = app.trim();
    if raw.is_empty() {
        return Err("missing application name".to_string());
    }

    let lower = raw.to_lowercase();
    let key = lower.strip_suffix(".exe").unwrap_or(&lower).trim();

    let exe = match key {
        "notepad" => "notepad",
        "calc" | "calculator" => "calc",
        "explorer" | "files" => "explorer",
        "mspaint" | "paint" => "mspaint",
        "cmd" | "command prompt" => "cmd",
        "msedge" | "edge" => "msedge",
        "chrome" | "google chrome" => "chrome",
        "taskmgr" | "task manager" => "taskmgr",
        "control" | "control panel" => "control",
        _ => return Err(format!("not allowed: {}", raw)),
    };

    std::process::Command::new(exe)
        .spawn()
        .map_err(|e| format!("failed to launch {}: {}", exe, e))?;

    Ok(format!("opened {}", exe))
}

/// 用系统文件管理器打开一个已存在的路径。
///
/// 使用 `explorer <path>` 直接启动进程，不经过 shell，因此路径中的
/// 特殊字符不会被解释为命令。
#[tauri::command]
fn open_path(path: String) -> Result<String, String> {
    let target = path.trim();
    if target.is_empty() {
        return Err("missing path".to_string());
    }
    if !std::path::Path::new(target).exists() {
        return Err(format!("path does not exist: {}", target));
    }

    std::process::Command::new("explorer")
        .arg(target)
        .spawn()
        .map_err(|e| format!("failed to open path: {}", e))?;

    Ok(format!("opened {}", target))
}

/// 列出目录内容（名称排序，最多 500 条）。
#[tauri::command]
fn list_directory(path: String) -> Result<Vec<String>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.exists() {
        return Err(format!("path does not exist: {}", path));
    }
    if !dir.is_dir() {
        return Err(format!("not a directory: {}", path));
    }

    let read = std::fs::read_dir(dir)
        .map_err(|e| format!("cannot read directory {}: {}", path, e))?;

    let mut entries: Vec<String> = read
        .flatten()
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .collect();
    entries.sort();
    entries.truncate(LIST_MAX_ENTRIES);
    Ok(entries)
}

/// 在目录及其子目录中按文件名通配模式搜索文件。
#[tauri::command]
fn search_files(directory: String, pattern: String) -> Result<Vec<String>, String> {
    let pattern = pattern.trim();
    if pattern.is_empty() {
        return Err("missing pattern".to_string());
    }

    let dir = std::path::Path::new(&directory);
    if !dir.exists() {
        return Err(format!("path does not exist: {}", directory));
    }
    if !dir.is_dir() {
        return Err(format!("not a directory: {}", directory));
    }

    let mut results = Vec::new();
    collect_matches(dir, pattern, 0, &mut results);
    Ok(results)
}

/// 返回基础系统信息（操作系统、CPU 架构、主机名）。
#[tauri::command]
fn system_info() -> Result<serde_json::Value, String> {
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "unknown".to_string());

    Ok(serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "hostname": hostname,
    }))
}

/// 简单的通配符匹配，支持 `*`（任意多个字符）与 `?`（单个字符），
/// 大小写不敏感。避免为此引入额外的 crate。
fn wildcard_match(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.to_lowercase().chars().collect();
    let t: Vec<char> = text.to_lowercase().chars().collect();

    let mut pi = 0usize;
    let mut ti = 0usize;
    let mut star: Option<usize> = None;
    let mut match_from = 0usize;

    while ti < t.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == t[ti]) {
            pi += 1;
            ti += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = Some(pi);
            match_from = ti;
            pi += 1;
        } else if let Some(star_pi) = star {
            pi = star_pi + 1;
            match_from += 1;
            ti = match_from;
        } else {
            return false;
        }
    }

    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

/// 递归收集匹配的文件路径，跳过无权限或读取失败的目录。
fn collect_matches(
    dir: &std::path::Path,
    pattern: &str,
    depth: usize,
    results: &mut Vec<String>,
) {
    if depth > SEARCH_MAX_DEPTH || results.len() >= SEARCH_MAX_RESULTS {
        return;
    }

    let read = match std::fs::read_dir(dir) {
        Ok(read) => read,
        Err(_) => return,
    };

    for entry in read.flatten() {
        if results.len() >= SEARCH_MAX_RESULTS {
            return;
        }

        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        let path = entry.path();

        if file_type.is_dir() {
            collect_matches(&path, pattern, depth + 1, results);
        } else if file_type.is_file() {
            let name = entry.file_name().to_string_lossy().to_string();
            if wildcard_match(pattern, &name) {
                results.push(path.to_string_lossy().to_string());
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // 禁止主窗口最大化，防止双击标题栏时触发 maximize
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_maximizable(false);
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- System tray ---
            let toggle = MenuItem::with_id(app, "toggle", "Show/Hide", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &settings, &quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("open-settings", ());
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_application,
            open_path,
            list_directory,
            search_files,
            system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
