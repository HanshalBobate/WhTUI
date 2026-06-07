/**
 * layout.js  —  WHTUI V2
 *
 * Borderless, modal layout inspired by lazygit / neovim.
 *
 * Widget hierarchy (bottom to top in z-order):
 *
 *   topBar      — 1 row, top:0         "WHTUI  ONLINE  843 chats"
 *   separator   — 1 col wide, between chat/msg in split mode
 *   chatPanel   — fills left side (or full screen in chat-list mode)
 *   msgPanel    — fills right side (or full screen in chat-view mode)
 *   statusBar   — 1 row, bottom:0      mode pill + hints + connection
 *   commandBar  — overlays statusBar in : / / modes
 *   inputBox    — 3 rows above statusBar in INSERT mode
 *   previewBox  — centered floating popup (Space key)
 *   startupBox  — full-screen overlay during startup
 *
 * The four layout modes are applied by applyLayout():
 *
 *   'chat-list'  — chatPanel fills 100% width; msgPanel hidden
 *   'chat-view'  — msgPanel fills 100% width; chatPanel hidden
 *   'split'      — chatPanel 30%, separator 1 col, msgPanel ~70%
 *
 * Focus highlighting:
 *   Both chatPanel and msgPanel have thin borders (1px).
 *   setFocusBorder('chat' | 'message') swaps border colours to show
 *   which pane is active.  In single-pane modes the active panel
 *   always gets the focus colour.
 */

'use strict';

const blessed = require('blessed');
const screen  = require('./screen');
const { THEME } = require('./theme');

// ── Row budget ────────────────────────────────────────────────────────────────
const TOPBAR_H    = 1;
const STATUSBAR_H = 1;
const INPUT_H     = 3;

// ── Top bar ───────────────────────────────────────────────────────────────────
const topBar = blessed.box({
    parent: screen,
    tags:   true,

    left:   0,
    top:    0,
    width:  '100%',
    height: TOPBAR_H,

    style: {
        bg: THEME.bgPanel,
        fg: THEME.fg,
    },
    content: '',
});

// ── Chat panel (left pane / full-screen chat list) ────────────────────────────
const chatPanel = blessed.list({
    parent: screen,
    tags:   false,

    left:   0,
    top:    TOPBAR_H,
    width:  '100%',
    height: `100%-${TOPBAR_H + STATUSBAR_H}`,

    border: { type: 'line' },
    style: {
        bg:       THEME.chatList.bg,
        fg:       THEME.chatList.fg,
        border:   { fg: THEME.borderFocus },   // Focus colour — always "focused" in single-pane
        selected: THEME.chatList.selected,
        item:     THEME.chatList.item,
    },

    scrollable:   true,
    alwaysScroll: true,
    cleanSides:   true,    // ← prevents trailing chars during scroll
    mouse:        false,
    keys:         false,
    vi:           false,

    scrollbar: {
        ch:    '▐',
        track: { bg: THEME.bgPanel },
        style: { inverse: false, fg: THEME.surface1 || THEME.fgMuted },
    },
});

// ── Separator (1-col vertical line between panes in split mode) ───────────────
const separator = blessed.box({
    parent: screen,
    tags:   false,

    left:   0,    // positioned by applyLayout
    top:    TOPBAR_H,
    width:  1,
    height: `100%-${TOPBAR_H + STATUSBAR_H}`,

    style: {
        bg: THEME.bgPanel,
        fg: THEME.border || THEME.fgMuted,
    },
    content: '│'.repeat(200),  // tall enough to fill any screen
    hidden: true,
});

// ── Message panel (right pane / full-screen chat view) ────────────────────────
const msgPanel = blessed.box({
    parent: screen,
    tags:   true,

    left:   0,
    top:    TOPBAR_H,
    width:  '100%',
    height: `100%-${TOPBAR_H + STATUSBAR_H}`,

    border: { type: 'line' },
    wrap:   false,
    style: {
        bg:     THEME.messages.bg,
        fg:     THEME.messages.fg,
        border: { fg: THEME.border },    // dim until focused
    },

    scrollable:   false,
    alwaysScroll: false,
    cleanSides:   true,
    mouse:        false,
    keys:         false,
    vi:           false,
});

// ── Status bar ────────────────────────────────────────────────────────────────
const statusBar = blessed.box({
    parent: screen,
    tags:   true,

    left:   0,
    bottom: 0,
    width:  '100%',
    height: STATUSBAR_H,

    style: THEME.statusBar,
    content: '',
});

// ── Command bar (overlays statusBar in : or / mode) ───────────────────────────
const commandBar = blessed.box({
    parent: screen,
    tags:   true,

    left:   0,
    bottom: 0,
    width:  '100%',
    height: STATUSBAR_H,

    style: THEME.commandBar,
    content: '',
    hidden:  true,
});

// ── Input box (visible only in INSERT mode, slides up above statusBar) ─────────
const inputBox = blessed.textarea({
    parent: screen,
    label:  ' Compose ',
    tags:   false,

    left:   0,
    bottom: STATUSBAR_H,
    width:  '100%',
    height: INPUT_H,

    border: { type: 'line' },
    style: {
        bg:     THEME.input.bg,
        fg:     THEME.input.fg,
        border: THEME.input.border,
        label:  THEME.input.label,
        focus: {
            border: THEME.input.focus ? THEME.input.focus.border : { fg: THEME.borderFocus },
        },
    },

    inputOnFocus: true,
    mouse:        false,
    hidden:       true,
    content:      '',
});

// ── Preview popup (Space key — floating centered dialog) ──────────────────────
const previewBox = blessed.box({
    parent: screen,
    tags:   true,

    // Centered, 66% wide, 50% tall
    left:   '17%',
    top:    '25%',
    width:  '66%',
    height: '50%',

    border: { type: 'line' },
    wrap:   false,
    style: {
        bg:     THEME.bgPanel,
        fg:     THEME.fg,
        border: { fg: THEME.borderFocus },
        label:  { fg: THEME.fg, bold: true },
    },

    scrollable: true,
    hidden:     true,
    shadow:     false,
});

// ── Startup splash overlay ─────────────────────────────────────────────────────
const startupBox = blessed.box({
    parent: screen,
    tags:   true,

    left:   0,
    top:    0,
    width:  '100%',
    height: '100%',

    style: {
        bg: THEME.bg,
        fg: THEME.fg,
    },

    content: '',
    hidden:  false,  // Visible at startup
});

// ── Focus border helper ───────────────────────────────────────────────────────

/**
 * Update the border colours of chatPanel and msgPanel to reflect which pane
 * currently has logical focus.  Call this any time focus switches.
 *
 * @param {'chat'|'message'} pane
 */
function setFocusBorder(pane) {
    if (pane === 'chat') {
        chatPanel.style.border = { fg: THEME.borderFocus };
        msgPanel.style.border  = { fg: THEME.border };
    } else {
        chatPanel.style.border = { fg: THEME.border };
        msgPanel.style.border  = { fg: THEME.borderFocus };
    }
    screen.render();
}

// ── Layout calculator ─────────────────────────────────────────────────────────

/**
 * Recalculate and apply all widget positions based on current viewMode and insertMode.
 *
 * @param {string}  viewMode    'chat-list' | 'chat-view' | 'split'
 * @param {boolean} insertMode  Whether the input box should be visible
 */
function applyLayout(viewMode, insertMode) {
    const W = screen.width;
    const H = screen.height;

    // Height budget: top + bottom chrome
    const bottomH  = insertMode ? STATUSBAR_H + INPUT_H : STATUSBAR_H;
    const contentH = Math.max(1, H - TOPBAR_H - bottomH);

    // Common vertical positioning for panels
    const panelTop = TOPBAR_H;

    switch (viewMode) {
        case 'chat-list': {
            // chatPanel = full width, focused border
            chatPanel.left   = 0;
            chatPanel.top    = panelTop;
            chatPanel.width  = W;
            chatPanel.height = contentH;
            chatPanel.style.border = { fg: THEME.borderFocus };
            chatPanel.show();

            // msgPanel hidden
            msgPanel.hide();
            separator.hide();

            // Input box: full width
            if (insertMode) {
                inputBox.left   = 0;
                inputBox.bottom = STATUSBAR_H;
                inputBox.width  = W;
                inputBox.show();
            } else {
                inputBox.hide();
            }
            break;
        }

        case 'chat-view': {
            // msgPanel = full width, focused border
            msgPanel.left   = 0;
            msgPanel.top    = panelTop;
            msgPanel.width  = W;
            msgPanel.height = contentH;
            msgPanel.style.border = { fg: THEME.borderFocus };
            msgPanel.show();

            // chatPanel hidden
            chatPanel.hide();
            separator.hide();

            // Input box: full width
            if (insertMode) {
                inputBox.left   = 0;
                inputBox.bottom = STATUSBAR_H;
                inputBox.width  = W;
                inputBox.show();
            } else {
                inputBox.hide();
            }
            break;
        }

        case 'split': {
            // 30% chat, 1 col separator, rest messages
            const chatW = Math.max(24, Math.min(44, Math.floor(W * 0.30)));
            const sepX  = chatW;
            const msgX  = chatW + 1;
            const msgW  = Math.max(10, W - msgX);

            chatPanel.left   = 0;
            chatPanel.top    = panelTop;
            chatPanel.width  = chatW;
            chatPanel.height = contentH;
            chatPanel.show();

            separator.left   = sepX;
            separator.top    = panelTop;
            separator.height = contentH;
            separator.show();

            msgPanel.left   = msgX;
            msgPanel.top    = panelTop;
            msgPanel.width  = msgW;
            msgPanel.height = contentH;
            msgPanel.show();

            // Input box: aligned with the message panel only (not spanning chat list)
            if (insertMode) {
                inputBox.left   = msgX;
                inputBox.bottom = STATUSBAR_H;
                inputBox.width  = msgW;
                inputBox.show();
            } else {
                inputBox.hide();
            }
            break;
        }

        default:
            break;
    }

    // Top + status bars always full width
    topBar.width     = W;
    statusBar.width  = W;
    commandBar.width = W;
}

// Resize is handled in renderer.js to regenerate strings

// ── Theme reapplication ───────────────────────────────────────────────────────

function reapplyTheme() {
    chatPanel.style = {
        bg:       THEME.chatList.bg,
        fg:       THEME.chatList.fg,
        border:   { fg: THEME.borderFocus },
        selected: THEME.chatList.selected,
        item:     THEME.chatList.item,
    };
    if (chatPanel.scrollbar) {
        chatPanel.scrollbar.track.bg = THEME.bgPanel;
        chatPanel.scrollbar.style.fg = THEME.borderFocus;
    }

    msgPanel.style = {
        bg:     THEME.messages.bg,
        fg:     THEME.messages.fg,
        border: { fg: THEME.border },
    };
    if (msgPanel.scrollbar) {
        msgPanel.scrollbar.track.bg = THEME.bg;
        msgPanel.scrollbar.style.fg = THEME.borderFocus;
    }

    topBar.style     = { bg: THEME.bgPanel, fg: THEME.fg };
    statusBar.style  = THEME.statusBar;
    commandBar.style = THEME.commandBar;

    inputBox.style = {
        bg:     THEME.input.bg,
        fg:     THEME.input.fg,
        border: THEME.input.border,
        label:  THEME.input.label,
        focus: {
            border: THEME.input.focus ? THEME.input.focus.border : { fg: THEME.borderFocus },
        },
    };

    previewBox.style = {
        bg:     THEME.bgPanel,
        fg:     THEME.fg,
        border: { fg: THEME.borderFocus },
    };

    startupBox.style = {
        bg: THEME.bg,
        fg: THEME.fg,
    };

    separator.style = {
        bg: THEME.bgPanel,
        fg: THEME.border || THEME.fgMuted,
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Inner content width of the chat panel.
 * Subtracts the 2 border pixels and 1 for the scrollbar track.
 */
function getChatPanelInnerWidth() {
    const state = require('../state/state');
    const w = state.viewMode === 'split' 
        ? Math.max(24, Math.min(44, Math.floor(screen.width * 0.30))) 
        : screen.width;
    return Math.max(10, w - 3); // -2 for borders, -1 for scrollbar
}

/**
 * Inner content width of the message panel.
 * Subtracts the 2 border pixels.
 */
function getMsgPanelInnerWidth() {
    const state = require('../state/state');
    const chatW = Math.max(24, Math.min(44, Math.floor(screen.width * 0.30)));
    const w = state.viewMode === 'split' ? Math.max(10, screen.width - chatW - 1) : screen.width;
    return Math.max(10, w - 2);
}

module.exports = {
    topBar,
    chatPanel,
    msgPanel,
    separator,
    statusBar,
    commandBar,
    inputBox,
    previewBox,
    startupBox,
    applyLayout,
    reapplyTheme,
    setFocusBorder,
    getChatPanelInnerWidth,
    getMsgPanelInnerWidth,
    TOPBAR_H,
    STATUSBAR_H,
    INPUT_H,
};
