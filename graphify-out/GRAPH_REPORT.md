# Graph Report - whtui  (2026-06-07)

## Corpus Check
- 40 files · ~19,084 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 362 nodes · 567 edges · 23 communities (21 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4e567c35`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]

## God Nodes (most connected - your core abstractions)
1. `_render()` - 22 edges
2. `renderMessages()` - 15 edges
3. `render()` - 14 edges
4. `WHTUI — WhatsApp Terminal Client` - 13 edges
5. `truncate()` - 10 edges
6. `formatGroupedMessages()` - 10 edges
7. `Session` - 8 edges
8. `Message` - 8 edges
9. `formatMessage()` - 8 edges
10. `Keybindings` - 8 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `render()`  [EXTRACTED]
  src/main.js → src/tui/renderer.js
- `executeCommand()` --calls--> `setTheme()`  [EXTRACTED]
  src/tui/commandbar.js → src/tui/theme.js
- `_scrollMsg()` --calls--> `render()`  [EXTRACTED]
  src/tui/keybindings.js → src/tui/renderer.js
- `formatMessage()` --calls--> `clockTime()`  [INFERRED]
  src/utils/formatters.js → src/utils/time.js
- `formatMessageCompact()` --calls--> `clockTime()`  [INFERRED]
  src/utils/formatters.js → src/utils/time.js

## Communities (23 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (15): screen, actions, { chatList, messageBox, inputBox, commandBar }, { chatPanel, msgPanel, inputBox, commandBar, setFocusBorder }, dismissHelp(), { executeCommand }, focusChat(), focusMessage() (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (34): generateAscii(), qrcode, actions, browser, { Chat }, { chatList, messageBox, inputBox }, { chatPanel, msgPanel, inputBox }, fs (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (53): getChatPreview(), getContextHints(), getHelpText(), getWelcomeText(), _scrollMsg(), applyLayout(), getChatPanelInnerWidth(), getMsgPanelInnerWidth() (+45 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (11): { Chat }, findEls(), findSelector(), log, { Message }, openChat(), SELECTORS, sendMessage() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (28): appendMessage(), _applySearch(), Fuse, jumpChatSelection(), log, moveChatSelection(), _rebuildFuse(), _render() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (17): dependencies, blessed, fuse.js, node-emoji, playwright, qrcode-terminal, winston, description (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (10): { chromium }, ensureProfileDir(), fs, launch(), LAUNCH_OPTIONS, log, path, PROFILE_DIR (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (17): findFirst(), readQrPairingData(), _exposeFunction(), injectObservers(), log, SELECTORS, SELECTORS, { EventEmitter } (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (7): db, path, sqlite3, cache, { Client, LocalAuth }, qrcode, state

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (11): { chatList, input }, screen, chatList, input, blessed, chatList, screen, statusBar (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.40
Nodes (5): Browser Profile Storage, Persistent Chromium, Playwright, WhatsApp Web, WHTUI Client

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (31): Architecture, code:block1 (Terminal UI (blessed)), code:bat (whtui.bat), code:bash (# 1. Install Node dependencies), code:block4 (Open WhatsApp on your phone), code:block5 (┌─ whtui ───────────────────────────────────────────────────), code:block6 (whtui/), code:powershell (# Windows — follow logs in real time) (+23 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (13): state, actions, { commandBar, reapplyTheme }, COMMANDS, executeCommand(), log, screen, { setTheme, getAvailableThemes } (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (13): blessed, chatList, screen, statusBar, chatPanel, inputBox, messageBox, msgPanel (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (9): blessed, screen, { THEME }, log, setTheme(), THEME, { themes, buildTheme }, buildTheme() (+1 more)

## Knowledge Gaps
- **146 isolated node(s):** `browser`, `scraper`, `name`, `version`, `description` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Message` connect `Community 3` to `Community 1`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `Chat` connect `Community 3` to `Community 1`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `browser`, `scraper`, `name` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0627177700348432 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07743496672716274 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09230769230769231 - nodes in this community are weakly interconnected._