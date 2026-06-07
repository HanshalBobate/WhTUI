# WHTUI — WhatsApp Terminal Client

A fully keyboard-driven WhatsApp client that lives entirely inside your terminal.

Uses **Playwright** to control a persistent headless Chromium browser running WhatsApp Web.
The terminal is a rendering layer only — WhatsApp Web is the source of truth.

```
Terminal UI (blessed)
      ↓
Playwright
      ↓
Persistent Chromium (headless)
      ↓
WhatsApp Web
```

---

## Requirements

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Windows / macOS / Linux** (tested on Windows 11 and Ubuntu 22.04)

---

## Quick Start (Windows)

A launcher script is included. Run it once to install dependencies and launch:

```bat
whtui.bat
```

Or, to run `whtui` from **any directory** (like `nvim`), add the project folder to your PATH:

1. Open **System Properties → Advanced → Environment Variables**
2. Under **User variables**, edit `Path`
3. Add `d:\PROJECTS\whtui` (or wherever you cloned it)
4. Open a new terminal and type `whtui`

---

## Manual Setup

```bash
# 1. Install Node dependencies
npm install

# 2. Download the Playwright Chromium browser (first time only)
npm run install:browser

# 3. Start whtui
npm start
```

On first launch you will see a QR code:

```
Open WhatsApp on your phone
Tap Menu ⋮ → Linked Devices → Link a Device
Scan the QR code
```

After scanning once, the session is stored in `storage/browser-profile/` and
**you will never need to scan again** — even after reboots.

---

## Layout

```
┌─ whtui ──────────────────────────────────────────────────────┐
│ Chat List         │  Messages                                 │
│                   │                                           │
│ ▸ Mom (2)         │  You          10:30                       │
│   Work Group (14) │  Hello!                                   │
│   Friend          │                                           │
│                   │  Mom          10:31                       │
│                   │  Hi! How are you?                         │
│                   │                                           │
├───────────────────┴───────────────────────────────────────────┤
│ NORMAL                                           ● ONLINE     │
├───────────────────────────────────────────────────────────────┤
│ :                                                             │
├───────────────────────────────────────────────────────────────┤
│ Compose message...                                            │
└───────────────────────────────────────────────────────────────┘
```

Themes available: `catppuccin` · `tokyonight` · `dracula` · `gruvbox` · `nord`

---

## Keybindings

### Normal Mode — Chat List

| Key | Action |
|---|---|
| `j` / `↑` | Move selection up |
| `k` / `↓` | Move selection down |
| `gg` | Jump to first chat |
| `G` | Jump to last chat |
| `Ctrl-d` | Jump ¼ list down |
| `Ctrl-u` | Jump ¼ list up |
| `Enter` | Open highlighted chat |
| `Space` | Preview chat (popup) |
| `/` | Start live fuzzy search |
| `:` | Enter command mode |
| `?` | Show help |
| `q` | Quit |
| `Ctrl+W` | Toggle split view |

### Normal Mode — Message Pane

| Key | Action |
|---|---|
| `j` / `↑` | Scroll older messages |
| `k` / `↓` | Scroll newer messages |
| `J` / `K` | Fine scroll (always targets message pane) |
| `Ctrl-d` / `PgDn` | Scroll half page older |
| `Ctrl-u` / `PgUp` | Scroll half page newer |
| `Ctrl-f` / `Ctrl-b` | Scroll full page |
| `gg` | Jump to oldest messages |
| `G` | Jump to newest messages |
| `i` | Compose reply (insert mode) |
| `r` | Refresh messages |
| `Esc` / `Z` | Close chat → return to list |

### Insert Mode

| Key | Action |
|---|---|
| `Enter` / `Ctrl-s` | Send message |
| `Esc` | Cancel |

### Search Mode (`/`)

| Key | Action |
|---|---|
| _(type)_ | Live fuzzy filter chat list |
| `n` / `N` | Next / previous result |
| `Enter` | Open top result |
| `Esc` | Clear search |

### Command Mode (`:`)

| Command | Action |
|---|---|
| `:q` | Quit |
| `:reload` | Refresh chat list from DOM |
| `:refresh` | Refresh open chat messages |
| `:open <name>` | Open chat by name |
| `:search <term>` | Search chats |
| `:unread` | Show unread chats only |
| `:pinned` | Show pinned chats only |
| `:groups` | Show groups only |
| `:all` | Clear filter, show all chats |
| `:compact` | Toggle compact message view |
| `:split` | Toggle split view |
| `:theme <name>` | Switch color theme |
| `:logout` | Logout and wipe session |
| `:help` | Show keybinding reference |

### Global

| Key | Action |
|---|---|
| `Ctrl-L` | Force full redraw |
| `Tab` / `Shift-Tab` | Cycle pane focus (split mode) |
| `Ctrl+W` | Toggle 30/70 split view |
| `Ctrl+c` | Force quit |

---

## Architecture

```
whtui/
│
├── index.js              Entry point
├── whtui.bat             Windows launcher (auto-installs, runs from any directory)
│
├── src/
│   ├── main.js           Orchestrator — startup, wires all layers
│   │
│   ├── browser/
│   │   ├── browser.js    Persistent Chromium context
│   │   ├── session.js    Login detection, QR polling, logout watching
│   │   ├── selectors.js  All CSS selectors — update here when WhatsApp changes DOM
│   │   ├── observer.js   MutationObserver injection via page.exposeFunction()
│   │   └── scraper.js    DOM scraping: chats, messages, send
│   │
│   ├── models/
│   │   ├── chat.js       Chat data model
│   │   └── message.js    Message data model
│   │
│   ├── state/
│   │   ├── state.js      Central mutable singleton state
│   │   └── actions.js    State mutation functions + Fuse.js fuzzy search
│   │
│   ├── tui/
│   │   ├── screen.js     Blessed screen singleton
│   │   ├── theme.js      Color palette & widget styles
│   │   ├── layout.js     Widget instantiation & positioning
│   │   ├── renderer.js   State → blessed content; manual viewport scroll engine
│   │   ├── statusbar.js  Spinner animation manager
│   │   ├── commandbar.js Vim `:` command parsing and execution
│   │   ├── helpContent.js Help text & status bar hints
│   │   └── keybindings.js All keyboard handlers (modal: normal/insert/search/command)
│   │
│   └── utils/
│       ├── logger.js     Winston file-only logger (never pollutes terminal)
│       ├── formatters.js Chat row / message formatters; emoji → :shortcode: conversion
│       ├── debounce.js   Debounce + throttle utilities
│       └── time.js       Relative timestamps, date separators
│
└── storage/
    ├── browser-profile/  Chromium user data (session persistence) ← DO NOT DELETE
    └── logs/             Daily rotating log files
```

---

## How It Works

### Session Persistence

Playwright's `launchPersistentContext()` stores the full Chromium profile
(cookies, IndexedDB, localStorage) in `storage/browser-profile/`.

WhatsApp Web stores its session in IndexedDB — so it survives all restarts.

### Live Updates (No Polling)

`observer.js` injects `MutationObserver` scripts into WhatsApp Web via
`page.evaluate()`. These watch:

- The conversation panel for new messages
- The chat list for incoming chats and unread badge changes
- The header for connection status banners

When a DOM mutation fires, the observer calls a function exposed via
`page.exposeFunction()`, which runs in Node.js and triggers a state update
and re-render.

### Ghost-Free Rendering

The message pane uses a **manual viewport slicing** engine instead of
blessed's native scroll logic. On every render, exactly `viewHeight` lines
are sliced from a pre-built line array and written as a single
`setContent()` call. Every line is space-padded to the panel width, and
`screen.realloc()` is called before each scroll to force a full terminal
redraw — making ghost characters physically impossible.

Emoji in sender names, message text, and reactions are converted to
`:shortcode:` form (e.g. `🥀` → `:wilted_flower:`) via `node-emoji`
to avoid terminal wide-char width miscounting.

### Selector Maintenance

All CSS selectors live in `src/browser/selectors.js` as **ordered arrays** —
the scraper tries each in sequence and uses the first that resolves.
When WhatsApp updates its DOM:

1. Open DevTools on `web.whatsapp.com`
2. Inspect the element you need
3. Add the new selector to the top of the relevant array in `selectors.js`

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Stuck on "Launching browser..." | Run `npm run install:browser` to download Chromium |
| QR appears every time | Don't delete `storage/browser-profile/` |
| Chats not loading | WhatsApp may have changed selectors — check logs and update `selectors.js` |
| Blank message panel | Open a chat with `Enter` after selecting it |
| Application crashes | Check `storage/logs/whtui-YYYY-MM-DD.log` |

---

## Log Files

```powershell
# Windows — follow logs in real time
Get-Content storage\logs\whtui-*.log -Wait -Tail 50
```

```bash
# Linux / macOS
tail -f storage/logs/whtui-*.log
```

---

## License

MIT
