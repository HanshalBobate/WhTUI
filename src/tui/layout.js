/**
 * layout.js
 *
 * LazyNvim-inspired two-pane layout.
 *
 * Layout (bottom-up):
 *   inputBox   — 3 rows (with border), bottom: 0
 *   statusLine — 1 row, bottom: 3
 *   [panels]   — fill remaining height: '100%-4'
 *
 * The commandBar overlays the statusLine position when active.
 */

'use strict';

const blessed = require('blessed');
const screen  = require('./screen');
const { THEME } = require('./theme');

// Number of rows consumed by the footer (statusline + input)
const FOOTER_H = 4;

// ── Chat list (left panel) ────────────────────────────────────────────────────
const chatList = blessed.list({
    parent: screen,
    label:  ' Chats ',
    tags:   false,

    left:   0,
    top:    0,
    width:  36,
    height: `100%-${FOOTER_H}`,

    border: { type: 'line' },
    style: {
        ...THEME.chatList,
        border:    THEME.chatList.border,
        label:     THEME.chatList.label,
        selected:  THEME.chatList.selected,
        item:      THEME.chatList.item,
        scrollbar: THEME.chatList.scrollbar,
    },

    scrollable:   true,
    alwaysScroll: true,
    mouse:        true,
    // Disable native keys and vi mode. We handle j/k/up/down in keybindings.js 
    // to prevent blessed from scrolling the terminal at boundaries.
    keys:         false,
    vi:           false,

    scrollbar: {
        ch:    '▐',
        track: { bg: THEME.bgPanel },
        style: { inverse: false, fg: THEME.surface1 },
    },
});

// ── Message box (right panel) ─────────────────────────────────────────────────
const messageBox = blessed.box({
    parent: screen,
    label:  ' Messages ',
    tags:   true,

    left:   36,
    top:    0,
    width:  '100%-36',
    height: `100%-${FOOTER_H}`,

    border: { type: 'line' },
    wrap:   true,
    style: {
        ...THEME.messages,
        border:    THEME.messages.border,
        label:     THEME.messages.label,
        scrollbar: THEME.messages.scrollbar,
    },

    scrollable:   true,
    alwaysScroll: true,
    mouse:        true,
    // keys + vi on messageBox lets it respond to j/k when focused,
    // and also makes .scroll() work reliably.
    keys:         true,
    vi:           true,

    scrollbar: {
        ch:    '▐',
        track: { bg: THEME.bg },
        style: { inverse: false, fg: THEME.surface1 },
    },
});

// ── Status line (LazyNvim-style, sits above input) ────────────────────────────
const statusBar = blessed.box({
    parent: screen,
    tags:   true,

    left:   0,
    bottom: 3,
    width:  '100%',
    height: 1,

    style: THEME.statusBar,
    content: '',
});

// ── Command bar (overlays statusBar when in : or / mode) ─────────────────────
const commandBar = blessed.box({
    parent: screen,
    tags:   true,

    left:   0,
    bottom: 3,
    width:  '100%',
    height: 1,

    style: THEME.commandBar,
    content: '',
    hidden:  true,
});

// ── Compose / input box ───────────────────────────────────────────────────────
const inputBox = blessed.textarea({
    parent: screen,
    label:  ' Compose ',
    tags:   false,

    left:   0,
    bottom: 0,
    width:  '100%',
    height: 3,

    border: { type: 'line' },
    style: {
        ...THEME.input,
        border: THEME.input.border,
        label:  THEME.input.label,
    },

    inputOnFocus: true,
    mouse:        true,
    content:      '',
});

// ── Responsive resize ─────────────────────────────────────────────────────────

function applyLayout() {
    const W = screen.width;
    const H = screen.height;

    // Chat list: 30–35% wide, min 28, max 46
    const chatW = Math.max(28, Math.min(46, Math.floor(W * 0.30)));
    const mainH = Math.max(4, H - FOOTER_H);

    chatList.width  = chatW;
    chatList.height = mainH;
    chatList.left   = 0;
    chatList.top    = 0;

    messageBox.left   = chatW;
    messageBox.width  = Math.max(16, W - chatW);
    messageBox.height = mainH;
    messageBox.top    = 0;

    statusBar.width  = W;
    commandBar.width = W;
    inputBox.width   = W;
}

applyLayout();
screen.on('resize', () => {
    applyLayout();
    screen.render();
});

function reapplyTheme() {
    chatList.style = {
        ...THEME.chatList,
        border:    THEME.chatList.border,
        label:     THEME.chatList.label,
        selected:  THEME.chatList.selected,
        item:      THEME.chatList.item,
        scrollbar: THEME.chatList.scrollbar,
    };
    chatList.scrollbar.track.bg = THEME.bgPanel;
    chatList.scrollbar.style.fg = THEME.borderFocus; // use accent color for scrollbar thumb

    messageBox.style = {
        ...THEME.messages,
        border:    THEME.messages.border,
        label:     THEME.messages.label,
        scrollbar: THEME.messages.scrollbar,
    };
    messageBox.scrollbar.track.bg = THEME.bg;
    messageBox.scrollbar.style.fg = THEME.borderFocus;

    statusBar.style = THEME.statusBar;
    commandBar.style = THEME.commandBar;

    inputBox.style = {
        ...THEME.input,
        border: THEME.input.border,
        label:  THEME.input.label,
    };
}

module.exports = {
    chatList,
    messageBox,
    statusBar,
    commandBar,
    inputBox,
    applyLayout,
    reapplyTheme,
    getChatListInnerWidth: () => Math.max(16, chatList.width - 4),
};
