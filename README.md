# julIDE

A modern, fully-featured IDE for the [Julia](https://julialang.org/) programming language, built with [Tauri 2](https://tauri.app/), React, TypeScript, and Rust.

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Julia](https://img.shields.io/badge/Julia-1.6%2B-9558B2)
<img width="2553" height="1353" alt="image" src="https://github.com/user-attachments/assets/29f6e9da-70d3-4e0c-a550-d85903ee63ed" />

---

## Features

### Code Editing
- **Monaco Editor** with full Julia syntax highlighting via a custom Monarch tokenizer
- **25+ Julia snippets** — function, struct, try/catch, @testset, comprehensions, macros, and more
- **Tabbed multi-file editing** with dirty indicators and auto-save
- **Split editor** — side-by-side editing with a resizable divider
- **Breadcrumb navigation** showing the file path below the tab bar
- **Find & Replace** (Cmd/Ctrl+F, Cmd/Ctrl+H) via Monaco's built-in widget
- Configurable font size, font family, tab size, word wrap, and minimap

### Language Intelligence (LSP)
- Powered by [LanguageServer.jl](https://github.com/julia-vscode/LanguageServer.jl)
- **Autocompletion**, **hover documentation**, **go-to-definition**, **find references**
- **Signature help** with parameter info
- **Real-time diagnostics** (errors and warnings) shown inline and in the Problems panel
- **Workspace and document symbol search**

### Julia Runtime
- **Run scripts** with rich output — inline images (PNG, JPEG, SVG), HTML, and plain text
- **Interactive REPL** via xterm.js with full PTY emulation
- **Multi-terminal support** — create, switch, and close multiple Julia REPL sessions
- **Debugger** integration via [Debugger.jl](https://github.com/JuliaDebug/Debugger.jl) — breakpoints, step-through, variable inspection, call stack
- **Revise.jl** toggle for hot-reload development
- **Pluto.jl** reactive notebook support — open `.jl` files as Pluto notebooks in a native window
- **Package Manager** — add and remove packages via `Pkg.jl` directly from the UI
- **Environment selector** — switch between Julia project environments

### File Management
- **File explorer** with tree view, create/rename/delete files and folders
- **Drag-and-drop** to move files between directories
- **File watching** — automatically detects external changes (git, other editors) and refreshes the tree
- **Quick Open** (Cmd/Ctrl+P) — fuzzy file finder across the entire workspace
- **Global Search** (Cmd/Ctrl+Shift+F) — search across all files with regex, case-sensitivity, and glob filters

### Git Integration
- **Source control panel** — view staged, unstaged, and untracked files
- **Stage / unstage** individual files or stage all at once
- **Commit** with a message directly from the UI
- **Branch display** in the status bar
- Powered by `libgit2` (via the `git2` Rust crate) — no shell dependency

### Workspace & UI
- **Activity bar** — switch between Explorer, Search, and Git views
- **Command palette** (Cmd/Ctrl+Shift+P) with 15+ commands
- **Settings panel** (Cmd/Ctrl+,) — configure editor, terminal, and appearance
- **Theme support** — Dark and Light themes with full CSS variable system
- **Welcome screen** with recent projects on startup
- **Resizable panels** — sidebar and bottom panel with drag handles
- **Status bar** — Julia version, environment, git branch, LSP status, Revise/Pluto indicators

---

## Prerequisites

- **Julia** 1.6 or later ([download](https://julialang.org/downloads/))
- **Rust** (latest stable) — [install via rustup](https://rustup.rs/)
- **Bun** — [install](https://bun.sh/) (used as the package manager and script runner)
- **System dependencies** for Tauri — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Recommended Julia packages

Install these globally for the best experience:

```julia
using Pkg
Pkg.add("LanguageServer")  # LSP support
Pkg.add("Revise")          # Hot-reload
Pkg.add("Debugger")        # Debugger integration
Pkg.add("Pluto")           # Reactive notebooks
```

---

## Getting Started

### Clone and install

```bash
git clone https://github.com/sinisterMage/JulIde.git
cd JulIde
bun install
```

### Development

```bash
# Start the Tauri dev server (frontend + native window with hot reload)
bun run tauri dev
```

This starts Vite on `localhost:1420` and opens the native Tauri window. Changes to both the React frontend and Rust backend are hot-reloaded.

### Production Build

```bash
# Build the distributable application
bun run tauri build
```

The output is placed in `src-tauri/target/release/bundle/` and includes platform-specific installers (`.dmg` on macOS, `.msi`/`.exe` on Windows, `.deb`/`.AppImage` on Linux).

---

## Architecture

```
julIDE
├── src/                        # React + TypeScript frontend
│   ├── components/             # UI components
│   │   ├── ActivityBar/        # Sidebar view switcher
│   │   ├── CommandPalette/     # Cmd+Shift+P command search
│   │   ├── Debugger/           # Debug panel (variables, call stack)
│   │   ├── Editor/             # Monaco editor, tabs, breadcrumb, split view
│   │   ├── FileExplorer/       # File tree with drag-and-drop
│   │   ├── Git/                # Source control panel
│   │   ├── OutputPanel/        # Script output with MIME rendering
│   │   ├── PackageManager/     # Julia package management UI
│   │   ├── QuickOpen/          # Fuzzy file finder (Cmd+P)
│   │   ├── SearchPanel/        # Global file search (Cmd+Shift+F)
│   │   ├── Settings/           # Preferences panel
│   │   ├── StatusBar/          # Bottom status indicators
│   │   ├── Terminal/           # Multi-terminal with xterm.js
│   │   ├── Toolbar/            # Run, debug, Revise, Pluto buttons
│   │   └── Welcome/            # Welcome screen with recent projects
│   ├── lsp/                    # LSP client and Monaco providers
│   ├── services/               # Keybinding service
│   ├── stores/                 # Zustand state management
│   ├── themes/                 # Theme definitions (dark + light)
│   ├── types/                  # TypeScript interfaces
│   └── App.tsx                 # Root layout component
│
├── src-tauri/                  # Rust backend (Tauri 2)
│   └── src/
│       ├── main.rs             # Entry point
│       ├── lib.rs              # Command registry and plugin setup
│       ├── julia.rs            # Julia discovery, execution, Pkg commands
│       ├── lsp.rs              # LanguageServer.jl JSON-RPC bridge
│       ├── pty.rs              # PTY terminal management
│       ├── debugger.rs         # Debugger.jl integration
│       ├── fs.rs               # File system operations and dialogs
│       ├── git.rs              # Git operations via libgit2
│       ├── search.rs           # Workspace-wide file search
│       ├── watcher.rs          # File change detection (notify crate)
│       ├── settings.rs         # User settings persistence
│       └── pluto.rs            # Pluto.jl notebook server
│
├── package.json                # Frontend dependencies (React, Monaco, xterm)
├── vite.config.ts              # Vite build configuration
├── tsconfig.json               # TypeScript configuration
└── src-tauri/Cargo.toml        # Rust dependencies (tauri, git2, tokio, etc.)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri 2 (Rust) |
| Frontend | React 19, TypeScript, Vite |
| Code editor | Monaco Editor |
| Terminal | xterm.js with PTY |
| State management | Zustand with Immer middleware |
| Icons | Lucide React |
| Git operations | git2 (libgit2 bindings) |
| File watching | notify crate |
| File search | walkdir + regex crates |
| LSP | LanguageServer.jl via JSON-RPC over stdio |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+P` | Command Palette |
| `Cmd/Ctrl+P` | Quick Open (file finder) |
| `Cmd/Ctrl+F` | Find in file |
| `Cmd/Ctrl+H` | Find and replace |
| `Cmd/Ctrl+Shift+F` | Search across files |
| `Cmd/Ctrl+S` | Save file |
| `` Ctrl+` `` | Toggle terminal |
| `Cmd/Ctrl+,` | Open settings |

---

## Configuration

Settings are stored in `~/.config/julide/settings.json` (Linux), `~/Library/Application Support/julide/settings.json` (macOS), or `%APPDATA%/julide/settings.json` (Windows).

Available settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `fontSize` | `14` | Editor font size |
| `fontFamily` | `JetBrains Mono, ...` | Editor font family |
| `tabSize` | `4` | Indentation width |
| `minimapEnabled` | `true` | Show minimap |
| `wordWrap` | `off` | Word wrap mode |
| `autoSave` | `true` | Auto-save on change |
| `theme` | `julide-dark` | Color theme (`julide-dark` or `julide-light`) |
| `terminalFontSize` | `13` | Terminal font size |

---

## Julia Path Detection

julIDE automatically finds Julia using these strategies (in order):

1. `$JULIA_PATH` environment variable
2. Login shell `which julia` lookup
3. `~/.juliaup/bin/julia` (juliaup default)
4. Common paths: `/opt/homebrew/bin/julia`, `/usr/local/bin/julia`, `/usr/bin/julia`
5. macOS `/Applications/Julia*.app` bundles

If Julia is not found, set the `JULIA_PATH` environment variable or use the command palette to set the path manually.

---

## License

[MIT](LICENSE) -- Copyright 2026 Ofek Bickel
