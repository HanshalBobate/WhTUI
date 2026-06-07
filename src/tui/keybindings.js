/**
 * keybindings.js  —  WHTUI V2
 *
 * All keyboard event handlers.  Vim/lazygit-inspired.
 *
 * NORMAL MODE (chat-list view)
 * ─────────────────────────────────────────────────
 *  j / ↓          Move selection down
 *  k / ↑          Move selection up
 *  Ctrl-d         Jump down ¼ of list
 *  Ctrl-u         Jump up ¼ of list
 *  gg             Jump to first chat
 *  G              Jump to last chat
 *  Enter          Open highlighted chat  (→ chat-view)
 *  Space          Toggle preview popup
 *  /              Enter search mode
 *  :              Enter command mode
 *  ?              Show help
 *  q              Quit
 *
 * NORMAL MODE (chat-view / split — message pane focused)
 * ─────────────────────────────────────────────────
 *  j / k / J / K  Scroll messages
 *  Ctrl-d / Ctrl-u  Scroll half-page
 *  Ctrl-f / PgDn  Page down
 *  Ctrl-b / PgUp  Page up
 *  gg             Jump to top of messages
 *  G              Jump to bottom of messages
 *  Esc / Z        Close chat → return to chat-list
 *  i              Compose (→ INSERT mode)
 *  r              Refresh messages
 *
 * SPLIT MODE
 * ─────────────────────────────────────────────────
 *  Tab / Shift+Tab  Cycle focus between panes
 *
 * GLOBAL
 * ─────────────────────────────────────────────────
 *  Ctrl-W         Toggle split view
 *  Ctrl-L         Force full redraw
 *  Ctrl-c         Quit always
 *
 * INSERT MODE
 * ─────────────────────────────────────────────────
 *  Enter / Ctrl-s  Send message
 *  Esc             Cancel → NORMAL
 *
 * SEARCH MODE
 * ─────────────────────────────────────────────────
 *  (type)          Build query live
 *  Backspace       Delete char
 *  n / N           Next / prev result
 *  Enter           Open top result
 *  Esc             Clear search → NORMAL
 *
 * COMMAND MODE
 * ─────────────────────────────────────────────────
 *  (type)          Build command
 *  Backspace       Delete char
 *  Enter           Execute
 *  Esc             Cancel → NORMAL
 *
 * PREVIEW POPUP
 * ─────────────────────────────────────────────────
 *  Space / Esc     Dismiss
 *  Enter           Open chat
 */

'use strict';

const screen  = require('./screen');
const { chatPanel, msgPanel, inputBox, commandBar, setFocusBorder } = require('./layout');
const actions = require('../state/actions');
const state   = require('../state/state');
const { executeCommand } = require('./commandbar');
const { render, resetMessageScroll } = require('./renderer');
const log     = require('../utils/logger');

// gg double-tap detection
let _lastGTime = 0;
const GG_WINDOW_MS = 400;

// ─── Focus tracking ──────────────────────────────────────────────────────────

/** Which pane has logical focus in split mode: 'chat' | 'message' */
let _focusPane = 'chat';

function focusChat() {
    _focusPane = 'chat';
    chatPanel.focus();
    setFocusBorder('chat');
}

function focusMessage() {
    _focusPane = 'message';
    msgPanel.focus();
    setFocusBorder('message');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Scroll the message pane by `delta` lines (positive = down/towards newer, negative = up/towards older). */
function _scrollMsg(delta) {
    state.msgScrollOffset = Math.max(0, state.msgScrollOffset - delta);
    screen.realloc();  // Force blessed to rewrite every terminal cell — eliminates ghost chars
    render();
}

/** True when j/k should navigate the message pane (not the chat list). */
function _inMessagePane() {
    return state.viewMode === 'chat-view'
        || (state.viewMode === 'split' && _focusPane === 'message');
}

/** True when we're in the chat list pane. */
function _inChatPane() {
    return state.viewMode === 'chat-list'
        || (state.viewMode === 'split' && _focusPane === 'chat');
}

// ─── Register ────────────────────────────────────────────────────────────────

function registerKeys(context) {
    const {
        openSelectedChat,
        sendMessage,
        reloadChats,
        refreshMessages,
        openChatByTitle,
        logout,
    } = context;

    // ── Send helper ─────────────────────────────────────────────────────────
    async function sendFromCompose() {
        const text = inputBox.getValue().trim();
        if (!text) return;
        inputBox.clearValue();
        if (typeof inputBox.scrollTo === 'function') inputBox.scrollTo(0);
        screen.render();
        await sendMessage(text);
    }

    // ── Preview popup helper ─────────────────────────────────────────────────
    function togglePreview() {
        if (state.previewChat) {
            actions.setPreviewChat(null);
            return;
        }
        const chat = state.filteredChats[state.selectedChatIdx];
        if (chat) {
            actions.setPreviewChat(chat);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION: j / k / arrows
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['j', 'down'], () => {
        if (state.mode !== 'normal') return;
        if (state.previewChat) return;
        if (_inMessagePane()) {
            _scrollMsg(3);
        } else {
            actions.moveChatSelection('up', 1);
        }
    });

    screen.key(['k', 'up'], () => {
        if (state.mode !== 'normal') return;
        if (state.previewChat) return;
        if (_inMessagePane()) {
            _scrollMsg(-3);
        } else {
            actions.moveChatSelection('down', 1);
        }
    });

    // Large jumps — Ctrl-d / Ctrl-u
    screen.key(['C-d'], () => {
        if (state.mode !== 'normal') return;
        if (_inMessagePane()) {
            _scrollMsg(Math.max(3, Math.floor(msgPanel.height / 2)));
        } else {
            const step = Math.max(1, Math.floor(state.filteredChats.length / 4));
            actions.moveChatSelection('up', step);
        }
    });

    screen.key(['C-u'], () => {
        if (state.mode !== 'normal') return;
        if (_inMessagePane()) {
            _scrollMsg(-Math.max(3, Math.floor(msgPanel.height / 2)));
        } else {
            const step = Math.max(1, Math.floor(state.filteredChats.length / 4));
            actions.moveChatSelection('down', step);
        }
    });

    // Page scroll
    screen.key(['C-f', 'pagedown'], () => {
        if (state.mode !== 'normal') return;
        _scrollMsg(Math.max(3, msgPanel.height - 2));
    });

    screen.key(['C-b', 'pageup'], () => {
        if (state.mode !== 'normal') return;
        _scrollMsg(-Math.max(3, msgPanel.height - 2));
    });

    // Shift+J / Shift+K
    screen.key(['J'], () => {
        if (state.mode !== 'normal') return;
        _scrollMsg(3);
    });

    screen.key(['K'], () => {
        if (state.mode !== 'normal') return;
        _scrollMsg(-3);
    });

    // gg — jump to top
    screen.key(['g'], () => {
        if (state.mode !== 'normal') return;
        const now = Date.now();
        if (now - _lastGTime <= GG_WINDOW_MS) {
            if (_inMessagePane()) {
                state.msgScrollOffset = 999999;  // will be clamped to max
                screen.realloc();
                render();
            } else {
                actions.jumpChatSelection('first');
            }
            _lastGTime = 0;
        } else {
            _lastGTime = now;
        }
    });

    // G — jump to bottom
    screen.key(['S-g'], () => {
        if (state.mode !== 'normal') return;
        if (_inMessagePane()) {
            state.msgScrollOffset = 0;
            screen.realloc();
            render();
        } else {
            actions.jumpChatSelection('last');
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ENTER — open / confirm
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['enter'], async () => {
        if (state.mode === 'insert') return;

        if (state.mode === 'command') {
            const cmd = state.commandInput;
            state.commandInput = '';
            actions.setMode('normal');
            commandBar.hide();
            screen.render();
            await executeCommand(cmd, { reloadChats, refreshMessages, openChatByTitle, logout });
            return;
        }

        if (state.mode === 'search') {
            actions.setMode('normal');
            resetMessageScroll();
            if (state.previewChat) actions.setPreviewChat(null);
            await openSelectedChat();
            return;
        }

        if (state.showHelpPanel) {
            actions.setShowHelp(false);
            focusChat();
            screen.render();
            return;
        }

        // Preview open: Enter = open that chat
        if (state.previewChat) {
            const chat = state.previewChat;
            actions.setPreviewChat(null);
            // Select the previewed chat
            const idx = state.filteredChats.findIndex(c => c.id === chat.id);
            if (idx >= 0) state.selectedChatIdx = idx;
            resetMessageScroll();
            await openSelectedChat();
            return;
        }

        resetMessageScroll();
        await openSelectedChat();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SPACE — preview popup toggle
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['space'], () => {
        if (state.mode !== 'normal') return;
        if (state.showHelpPanel) return;
        togglePreview();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SPLIT VIEW — Ctrl+W
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['C-w'], () => {
        if (state.mode === 'insert') return;
        actions.setSplitView();  // toggle
        if (state.splitView) {
            // Focus chat pane by default when entering split
            focusChat();
        }
        screen.render();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // TAB — cycle focus in split mode
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['tab'], () => {
        if (state.mode !== 'normal') return;
        if (state.viewMode === 'split') {
            if (_focusPane === 'chat') {
                focusMessage();
            } else {
                focusChat();
            }
            screen.render();
        }
    });

    screen.key(['S-tab'], () => {
        if (state.mode !== 'normal') return;
        if (state.viewMode === 'split') {
            if (_focusPane === 'message') {
                focusChat();
            } else {
                focusMessage();
            }
            screen.render();
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Z — close chat, return to chat-list
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['S-z'], () => {
        if (state.mode !== 'normal') return;
        if (state.previewChat) {
            actions.setPreviewChat(null);
            return;
        }
        if (state.currentChatId || state.viewMode === 'chat-view') {
            actions.selectChat(null, null);
            actions.setViewMode('chat-list');
            focusChat();
            screen.render();
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // r — refresh messages
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['r'], async () => {
        if (state.mode !== 'normal') return;
        if (!state.currentChatId) return;
        await refreshMessages();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Ctrl+L — force full redraw
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['C-l'], () => {
        screen.clearRegion(0, screen.width, 0, screen.height);
        screen.render();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // INSERT MODE
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['i'], async () => {
        if (state.mode !== 'normal') return;
        if (!state.currentChatId) {
            await openSelectedChat();
        }
        if (!state.currentChatId) return;
        actions.setShowHelp(false);
        actions.setPreviewChat(null);
        actions.setMode('insert');
        inputBox.focus();
        screen.render();
    });

    // Send via Ctrl-s
    screen.key(['C-s'], async () => {
        if (state.mode !== 'insert') return;
        await sendFromCompose();
    });

    inputBox.key(['C-s'], async () => {
        if (state.mode !== 'insert') return;
        await sendFromCompose();
    });

    inputBox.key(['C-m'], async () => {
        if (state.mode !== 'insert') return;
        await sendFromCompose();
    });

    inputBox.key(['enter'], async () => {
        if (state.mode !== 'insert') return;
        await sendFromCompose();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ESCAPE — back to normal
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['escape'], () => {
        // Preview popup: dismiss
        if (state.previewChat) {
            actions.setPreviewChat(null);
            return;
        }

        // Help panel: dismiss
        if (state.showHelpPanel) {
            actions.setShowHelp(false);
            if (!state.currentChatId) actions.setShowWelcome(true);
            focusChat();
            screen.render();
            return;
        }

        if (state.mode === 'normal') {
            // In chat-view: Esc returns to chat-list
            if (state.viewMode === 'chat-view') {
                actions.selectChat(null, null);
                actions.setViewMode('chat-list');
                focusChat();
                screen.render();
            }
            return;
        }

        if (state.mode === 'insert') {
            if (state.currentChatId && !state.splitView) {
                // Return to chat-view
                actions.setMode('normal');
                focusMessage();
            } else {
                actions.setMode('normal');
                focusChat();
            }
        }
        if (state.mode === 'search') {
            actions.setSearchQuery('');
        }
        if (state.mode === 'command') {
            state.commandInput = '';
            commandBar.hide();
        }

        actions.setMode('normal');
        screen.render();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SEARCH MODE  /
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['/'], () => {
        if (state.mode !== 'normal') return;
        actions.setShowHelp(false);
        actions.setMode('search');
        actions.setSearchQuery('');
        commandBar.show();
        screen.render();
    });

    screen.key(['backspace'], () => {
        if (state.mode === 'search') {
            actions.setSearchQuery(state.searchQuery.slice(0, -1));
            return;
        }
        if (state.mode === 'command') {
            state.commandInput = state.commandInput.slice(0, -1);
            screen.render();
        }
    });

    // n / N — next/prev search result
    screen.key(['n'], () => {
        if (state.mode !== 'normal' && state.mode !== 'search') return;
        if (!state.searchQuery) return;
        actions.moveChatSelection('down', 1);
    });

    screen.key(['N'], () => {
        if (state.mode !== 'normal' && state.mode !== 'search') return;
        if (!state.searchQuery) return;
        actions.moveChatSelection('up', 1);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // COMMAND MODE  :
    // ═══════════════════════════════════════════════════════════════════════

    screen.key([':'], () => {
        if (state.mode !== 'normal') return;
        actions.setShowHelp(false);
        actions.setMode('command');
        state.commandInput = '';
        commandBar.show();
        screen.render();
    });

    // ── Printable character routing ──────────────────────────────────────────
    screen.on('keypress', (ch, key) => {
        if (!ch || key.ctrl || key.meta) return;
        if (ch.length !== 1) return;
        const code = ch.charCodeAt(0);
        if (code < 32 || code > 126) return;

        if (state.mode === 'search') {
            if (ch === '/') return;
            actions.setSearchQuery(state.searchQuery + ch);
        } else if (state.mode === 'command') {
            if (ch === ':') return;
            state.commandInput += ch;
            screen.render();
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // HELP  &  QUIT
    // ═══════════════════════════════════════════════════════════════════════

    screen.key(['?', 'S-/'], () => {
        if (state.mode !== 'normal') return;
        actions.setShowHelp(true);
        // Show help in msgPanel regardless of viewMode
        if (state.viewMode === 'chat-list') {
            actions.setViewMode('chat-view');
        }
        focusMessage();
    });

    screen.key(['q'], () => {
        if (state.mode !== 'normal') return;
        log.info('User quit.');
        process.exit(0);
    });

    log.info('Keybindings registered (V2).');
}

module.exports = { registerKeys };
