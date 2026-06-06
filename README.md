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

## Setup

```bash
# 1. Install Node dependencies
npm install

# 2. Download the Playwright Chromium browser
npm run install:browser

# 3. Start whtui
npm start
```

On first launch you will see:

```
Open WhatsApp on your phone
Tap Menu ⋮ → Linked Devices → Link a Device
Scan the QR code in the browser window
Waiting for QR scan...
```

After scanning once, the session is stored in `storage/browser-profile/` and
**you will never need to scan again** — even after system reboots.

---

## Layout

```
┌────────────────────┬──────────────────────────────────────┐
│ Chats              │ Messages                             │
│                    │                                      │
│ Mom (2)            │ [10:30] You                          │
│ Work Group (14)    │ Hello!                               │
│ Friend             │                                      │
│                    │ [10:31] Mom                          │
│                    │ Hi! How are you?                     │
│                    │                                      │
├────────────────────┴──────────────────────────────────────┤
│ NORMAL                                      ● ONLINE      │
├───────────────────────────────────────────────────────────┤
│ :                                                         │
├───────────────────────────────────────────────────────────┤
│ Compose                                                   │
└───────────────────────────────────────────────────────────┘
```

---

## Keybindings

### Normal Mode

| Key        | Action                          |
|------------|---------------------------------|
| `j` / `↓` | Move down in chat list          |
| `k` / `↑` | Move up in chat list            |
| `gg`       | Jump to first chat              |
| `G`        | Jump to last chat               |
| `Ctrl+d`   | Half-page down                  |
| `Ctrl+u`   | Half-page up                    |
| `Enter`    | Open selected chat              |
| `J`        | Scroll messages down            |
| `K`        | Scroll messages up              |
| `i`        | Enter insert (compose) mode     |
| `/`        | Enter search mode               |
| `:`        | Enter command mode              |
| `q`        | Quit                            |
| `Ctrl+c`   | Force quit                      |

### Insert Mode

| Key       | Action                  |
|-----------|-------------------------|
| `Ctrl+s`  | Send message            |
| `Esc`     | Cancel / back to normal |

### Search Mode (`/`)

| Key        | Action                    |
|------------|---------------------------|
| _(type)_   | Filter chat list (fuzzy)  |
| `n`        | Next match                |
| `N`        | Previous match            |
| `Enter`    | Open first result         |
| `Esc`      | Clear search              |

### Command Mode (`:`)

| Command          | Action                      |
|------------------|-----------------------------|
| `:q`             | Quit                        |
| `:reload`        | Reload chat list from DOM   |
| `:search <term>` | Search chats                |
| `:clear`         | Clear active search         |
| `:open <title>`  | Open chat by title          |
| `:help`          | Show this keybinding guide  |

---

## Architecture

```
whtui/
│
├── index.js              Entry point (delegates to src/main.js)
│
├── src/
│   ├── main.js           Orchestrator — startup, wires all layers together
│   │
│   ├── browser/
│   │   ├── browser.js    Persistent Chromium context (launchPersistentContext)
│   │   ├── session.js    Login detection, QR polling, logout watching
│   │   ├── selectors.js  ALL CSS selectors — edit here when WhatsApp changes DOM
│   │   ├── observer.js   MutationObserver injection via page.exposeFunction()
│   │   └── scraper.js    DOM scraping: chats, messages, status, send
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
│   │   ├── renderer.js   State → blessed content (chat rows, messages, status)
│   │   ├── statusbar.js  Spinner animation manager
│   │   ├── commandbar.js Vim `:` command parsing and execution
│   │   └── keybindings.js All keyboard handlers (modal: normal/insert/search/command)
│   │
│   └── utils/
│       ├── logger.js     Winston file-only logger (never pollutes terminal)
│       ├── formatters.js Chat row / message display formatters
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

Playwright's `launchPersistentContext()` stores the full Chromium user profile
(cookies, IndexedDB, localStorage) in `storage/browser-profile/`.

WhatsApp Web stores its session in IndexedDB — so it survives all restarts.

### Live Updates (No Polling)

When the app starts, `observer.js` injects `MutationObserver` scripts into the
WhatsApp Web page via `page.evaluate()`. These observers watch:

- The conversation panel for new messages
- The chat list for incoming chats and unread badge changes
- The header for connection status banners

When any DOM mutation fires, the browser-side observer calls a function exposed
via `page.exposeFunction()`, which runs in Node.js and triggers a state update
and re-render.

### Selector Maintenance

All CSS selectors are in one file: `src/browser/selectors.js`.

Each selector group is an **ordered array** — the scraper tries them in sequence
and uses the first one that resolves. When WhatsApp updates its DOM:

1. Open DevTools in a browser on `web.whatsapp.com`
2. Inspect the element you need
3. Update the relevant array in `selectors.js`

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Stuck on "Launching browser..." | Run `npm run install:browser` to download Chromium |
| QR appears every time | Don't delete `storage/browser-profile/` |
| Chats not loading | WhatsApp Web may have changed selectors — check `storage/logs/` and update `selectors.js` |
| Blank message panel | Open a chat with `Enter` after selecting it |
| Application crashes | Check `storage/logs/whtui-YYYY-MM-DD.log` for the error trace |

---

## Log Files

Logs are written to `storage/logs/whtui-YYYY-MM-DD.log`.

To follow in real time (while whtui is running in another terminal):

```powershell
# Windows PowerShell
Get-Content storage\logs\whtui-*.log -Wait -Tail 50
```

```bash
# Linux / macOS
tail -f storage/logs/whtui-*.log
```

---

## License

MIT
