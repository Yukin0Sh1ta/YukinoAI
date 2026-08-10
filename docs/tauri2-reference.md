# Tauri 2 Desktop Pet App - Technical Reference

This document covers all the Tauri 2 topics needed for your Nuxt 4 + Tauri 2 desktop pet application on Windows.

---

## 1. Transparent Always-on-Top Window

### `tauri.conf.json` Window Configuration

```json
{
  "productName": "desktop-pet",
  "version": "1.0.0",
  "identifier": "com.desktoppet.app",
  "build": {
    "devtools": true
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "label": "main",
        "title": "Desktop Pet",
        "width": 500,
        "height": 600,
        "resizable": false,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "center": true
      }
    ]
  }
}
```

**Key Configuration Fields:**
- `decorations: false` - Removes the native window titlebar/frame
- `transparent: true` - Enables window transparency (required for transparent backgrounds)
- `alwaysOnTop: true` - Keeps window above all other windows
- `skipTaskbar: true` - Hides from taskbar (optional, good for desktop pets)

### Click-Through (Mouse Pass-Through) on Transparent Areas

Use the `setIgnoreCursorEvents` API to make the window ignore mouse events on transparent areas:

```typescript
// composables/useMousePassthrough.ts
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useMousePassthrough() {
  const enablePassthrough = async () => {
    await getCurrentWindow().setIgnoreCursorEvents(true);
  };

  const disablePassthrough = async () => {
    await getCurrentWindow().setIgnoreCursorEvents(false);
  };

  return { enablePassthrough, disablePassthrough };
}
```

**Important:** The window will still be clickable unless you implement pixel detection to only ignore events on transparent areas. For a desktop pet, you typically want the Live2D canvas to be interactive (draggable) but allow clicks to pass through around the character.

---

## 2. System Tray in Tauri 2

### Rust Side - `src-tauri/src/lib.rs`

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Create menu items
            let show_hide = MenuItem::with_id(app, "toggle", "Show/Hide", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            // Build menu
            let menu = Menu::with_items(app, &[&show_hide, &settings, &quit])?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
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
                    }
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Note:** Ensure you have a default window icon set in `tauri.conf.json`:

```json
{
  "app": {
    "windows": [...],
    "security": {
      "dangerousDisableAssetCspModification": true
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

---

## 3. Tauri 2 Plugin Setup

### 3a. tauri-plugin-shell

**Cargo.toml:**
```toml
[dependencies]
tauri-plugin-shell = "2"
```

**lib.rs registration:**
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**capabilities/default.json:**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "shell:allow-open",
      "allow": [
        { "url": "https://**" },
        { "url": "http://**" }
      ]
    },
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "open-url",
          "cmd": "cmd",
          "args": ["/c", "start", { "validator": ".*" }]
        }
      ]
    }
  ]
}
```

**NPM package:**
```bash
npm install @tauri-apps/plugin-shell
```

**JS/TS Usage:**
```typescript
import { Command, open } from '@tauri-apps/plugin-shell';

// Open a URL in default browser
await open('https://github.com');

// Execute a system command
const result = await Command.create('open-url', ['https://example.com']).execute();

// Windows: Open file with default application
await Command.create('cmd', ['/c', 'start', '', 'document.pdf']).execute();
```

---

### 3b. tauri-plugin-store

**Cargo.toml:**
```toml
[dependencies]
tauri-plugin-store = "2"
```

**lib.rs registration:**
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**capabilities/default.json:**
```json
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:default"
  ]
}
```

**NPM package:**
```bash
npm install @tauri-apps/plugin-store
```

**JS/TS Usage:**
```typescript
import { load, LazyStore } from '@tauri-apps/plugin-store';

// Using load() - creates or retrieves existing store
const store = await load('settings.json', { autoSave: true });

// Set values
await store.set('windowPosition', { x: 100, y: 200 });
await store.set('petType', 'cat');
await store.set('scale', 1.5);

// Get values
const position = await store.get<{ x: number; y: number }>('windowPosition');
const petType = await store.get<string>('petType');

// Using LazyStore - loads on first access
const lazyStore = new LazyStore('config.json');
const settings = await lazyStore.get('settings');

// Manual save (if autoSave is false)
await store.save();
```

---

### 3c. tauri-plugin-sql (SQLite)

**Cargo.toml:**
```toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

**lib.rs registration:**
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**capabilities/default.json:**
```json
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select"
  ]
}
```

**NPM package:**
```bash
npm install @tauri-apps/plugin-sql
```

**JS/TS Usage:**
```typescript
import Database from '@tauri-apps/plugin-sql';

// Connect to SQLite database
const db = await Database.load('sqlite:petdata.db');

// Create tables
await db.execute(`
  CREATE TABLE IF NOT EXISTS pet_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id TEXT NOT NULL,
    state_name TEXT NOT NULL,
    state_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert data
await db.execute(
  'INSERT INTO pet_states (pet_id, state_name, state_data) VALUES ($1, $2, $3)',
  ['pet_001', 'happy', JSON.stringify({ mood: 100, energy: 80 })]
);

// Query data
const result = await db.select<Array<{
  id: number;
  pet_id: string;
  state_name: string;
  state_data: string;
  created_at: string;
}>>('SELECT * FROM pet_states WHERE pet_id = $1', ['pet_001']);

console.log(result);
```

---

### 3d. tauri-plugin-http

**Cargo.toml:**
```toml
[dependencies]
tauri-plugin-http = "2"
```

**lib.rs registration:**
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**capabilities/default.json:**
```json
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://api.openai.com/**" },
        { "url": "https://api.anthropic.com/**" },
        { "url": "https://**.openai.com/**" }
      ]
    }
  ]
}
```

**NPM package:**
```bash
npm install @tauri-apps/plugin-http
```

**JS/TS Usage - Basic Request:**
```typescript
import { fetch } from '@tauri-apps/plugin-http';

// Simple GET request
const response = await fetch('https://api.example.com/data');
const data = await response.json();

// POST request with JSON body
const postResponse = await fetch('https://api.example.com/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});
```

**JS/TS Usage - Streaming (for LLM APIs):**
```typescript
// For streaming responses (Server-Sent Events)
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Tell me a story' }],
    stream: true
  })
});

// Read the stream
const reader = response.body?.getReader();
const decoder = new TextDecoder();

if (reader) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    console.log('Stream chunk:', chunk);
    
    // Parse SSE format: "data: {...}\n\n"
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          console.log('Content:', parsed.choices?.[0]?.delta?.content);
        } catch (e) {
          // Ignore parse errors for incomplete chunks
        }
      }
    }
  }
}
```

---

## 4. Multi-Window in Tauri 2

### Configure Windows in `tauri.conf.json`

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Desktop Pet",
        "width": 500,
        "height": 600,
        "resizable": false,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "center": true
      },
      {
        "label": "settings",
        "title": "Settings",
        "width": 400,
        "height": 500,
        "resizable": true,
        "decorations": true,
        "visible": false,
        "center": true
      }
    ]
  }
}
```

### Open Settings Window via JS API

```typescript
// utils/windowManager.ts
import { WebviewWindow, getCurrentWindow } from '@tauri-apps/api/webviewWindow';

export async function openSettingsWindow() {
  // Check if settings window already exists
  const existingWindow = await WebviewWindow.getByLabel('settings');
  
  if (existingWindow) {
    // Show and focus existing window
    await existingWindow.show();
    await existingWindow.setFocus();
    return;
  }

  // Create new settings window
  const settingsWindow = new WebviewWindow('settings', {
    url: '/settings',
    title: 'Settings',
    width: 400,
    height: 500,
    resizable: true,
    center: true,
    focus: true,
  });

  settingsWindow.once('tauri://created', () => {
    console.log('Settings window created');
  });

  settingsWindow.once('tauri://error', (e) => {
    console.error('Failed to create settings window:', e);
  });
}

export async function closeSettingsWindow() {
  const settingsWindow = await WebviewWindow.getByLabel('settings');
  if (settingsWindow) {
    await settingsWindow.close();
  }
}
```

### Capabilities for Multi-Window

**capabilities/default.json:**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for all windows",
  "windows": ["main", "settings"],
  "permissions": [
    "core:default",
    "core:webview:allow-create-webview-window",
    "core:webview:allow-close-webview-window",
    "core:webview:allow-show",
    "core:webview:allow-hide",
    "core:webview:allow-set-focus"
  ]
}
```

### Listen for Settings Event from Main Window

```typescript
// In your main window component
import { listen } from '@tauri-apps/api/event';
import { openSettingsWindow } from '~/utils/windowManager';

onMounted(async () => {
  await listen('open-settings', () => {
    openSettingsWindow();
  });
});
```

---

## 5. Window Dragging Without Title Bar

### Option 1: Using `data-tauri-drag-region` Attribute

The simplest approach - add the attribute to any element that should trigger dragging:

```vue
<!-- components/DesktopPet.vue -->
<template>
  <div 
    class="pet-container" 
    data-tauri-drag-region
  >
    <!-- Your Live2D canvas here -->
    <canvas ref="live2dCanvas" />
    
    <!-- Optional: drag handle area -->
    <div class="drag-handle" data-tauri-drag-region>
      <span>Drag me to move</span>
    </div>
  </div>
</template>

<style scoped>
.pet-container {
  width: 100%;
  height: 100%;
  /* Transparent background for click-through on edges */
  background: transparent;
}

.drag-handle {
  /* Visual indicator for drag area */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  cursor: move;
}
</style>
```

### Option 2: Manual Dragging with JavaScript

For more control (e.g., double-click to maximize), use `startDragging()`:

```vue
<!-- components/DesktopPet.vue -->
<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

const handleMouseDown = async (e: MouseEvent) => {
  // Only handle left mouse button
  if (e.buttons !== 1) return;
  
  if (e.detail === 2) {
    // Double-click: toggle maximize (optional for desktop pet)
    // Usually not needed for desktop pet windows
    // await appWindow.toggleMaximize();
  } else {
    // Single click: start dragging
    await appWindow.startDragging();
  }
};
</script>

<template>
  <div 
    class="pet-container" 
    @mousedown="handleMouseDown"
  >
    <canvas ref="live2dCanvas" />
  </div>
</template>
```

### Handling Drag Region on Child Elements

The `data-tauri-drag-region` attribute only applies to the element it's directly on. For child elements, apply it individually:

```vue
<template>
  <div data-tauri-drag-region>
    <!-- Interactive elements within drag region -->
    <button @click.stop="interact">Interact</button>
    
    <!-- Using @click.stop prevents drag from interfering with click -->
  </div>
</template>
```

### Prevent Dragging on Specific Elements

Use `data-tauri-drag-region="false"` to prevent dragging on specific elements:

```vue
<template>
  <div data-tauri-drag-region>
    <!-- This button won't trigger window drag -->
    <button data-tauri-drag-region="false" @click="doSomething">
      Click me
    </button>
  </div>
</template>
```

---

## Summary

| Feature | Tauri 2 API |
|---------|-------------|
| Transparent window | `tauri.conf.json`: `"transparent": true` |
| Always on top | `tauri.conf.json`: `"alwaysOnTop": true` or `window.setAlwaysOnTop(true)` |
| Borderless window | `tauri.conf.json`: `"decorations": false` |
| Mouse passthrough | `window.setIgnoreCursorEvents(true)` |
| System tray | `TrayIconBuilder` in Rust |
| Plugins | `tauri::Builder::default().plugin(...)` in lib.rs |
| Multi-window | `new WebviewWindow()` in JS or `WebviewWindowBuilder` in Rust |
| Window drag | `data-tauri-drag-region` attribute or `window.startDragging()` |

All plugin APIs shown above use Tauri v2 (the "2" version in Cargo.toml and npm packages). The APIs differ significantly from Tauri 1 - particularly the system tray (now uses `TrayIconBuilder` instead of `SystemTray`) and plugin initialization.
