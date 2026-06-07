/**
 * keybindings.js
 *
 * All keyboard event handlers for WHTUI.
 *
 * LazyNvim-inspired keybindings:
 *
 *  NORMAL MODE (chat list)
 *  ────────────────────────
 *  j / ↓        Move selection down
 *  k / ↑        Move selection up
 *  Ctrl-d       Jump down ¼ of list
 *  Ctrl-u       Jump up ¼ of list
 *  gg           Jump to first chat
 *  G            Jump to last chat
 *  Enter        Open highlighted chat
 *  i            Compose (Insert mode) for open chat
 *  Tab          Switch focus: chat list ↔ message pane
 *
 *  MESSAGE PANE SCROLL (Normal mode)
 *  ──────────────────────────────────
 *  J / K        Scroll messages down / up (3 lines)
 *  Ctrl-f       Scroll messages down half-page
 *  Ctrl-b       Scroll messages up half-page
 *
 *  SEARCH MODE  /  COMMAND MODE
 *  ─────────────────────────────
 *  /            Enter search
 *  :            Enter command
 *  Esc          Cancel / back to normal
 *  Enter        Confirm
 *
 *  INSERT MODE (compose)
 *  ──────────────────────
 *  Esc          Cancel compose
 *  Enter        Send message
 *
 *  GLOBAL
 *  ───────
 *  ?            Show keybinding help
 *  q            Quit (normal mode only)
 *  Ctrl-c       Quit (always)
 */

'use strict';

const screen   = require('./screen');
const { chatList, messageBox, inputBox, commandBar } = require('./layout');
const actions  = require('../state/actions');
const state    = require('../state/state');
const { executeCommand } = require('./commandbar');
const { resetMessageScroll } = require('./renderer');
const log      = require('../utils/logger');

// gg double-tap detection
let _lastGTime = 0;
const GG_WINDOW_MS = 400;

// ─── Focus tracking ──────────────────────────────────────────────────────────

/** Which pane has logical focus: 'chat' | 'message' */
let _focusPane = 'chat';

function focusChat() {
    _focusPane = 'chat';
    chatList.focus();
}

function focusMessage() {
    _focusPane = 'message';
    messageBox.focus();
}

// ─── Help ────────────────────────────────────────────────────────────────────

function showHelp() {
    actions.setShowHelp(true);
    focusChat();
}

function dismissHelp() {
    if (!state.showHelpPanel) return false;
    actions.setShowHelp(false);
    if (!state.currentChatId) actions.setShowWelcome(true);
    focusChat();
    screen.render();
    return true;
}

// ─── Register ────────────────────────────────────────────────────────────────

function registerKeys(context) {
    const { 
        openSelectedChat, 
        sendMessage, 
        reloadChats, 
        refreshMessages, 
        openChatByTitle, 
        logout 
    } = context;

    // ── Send helper ────────────────────────────────────────────────────────
    async function sendFromCompose() {
        const text = inputBox.getValue().trim();
        if (!text) return;
        inputBox.clearValue();
        screen.render();
        await sendMessage(text);
    }

    // ══════════════════════════════════════════════════════════════════════
    // CHAT LIST NAVIGATION
    // (We handle all movement ourselves — vi:false on chatList means no
    //  blessed passthrough that would scroll the terminal at list boundaries)
    // ══════════════════════════════════════════════════════════════════════

    screen.key(['j', 'down'], () => {
        if (state.mode !== 'normal') return;
        if (_focusPane === 'message') {
            messageBox.scroll(1);
            screen.render();
        } else {
            actions.moveChatSelection('down', 1);
        }
    });

    screen.key(['k', 'up'], () => {
        if (state.mode !== 'normal') return;
        if (_focusPane === 'message') {
            messageBox.scroll(-1);
            screen.render();
        } else {
            actions.moveChatSelection('up', 1);
        }
    });

    screen.key(['C-d'], () => {
        if (state.mode !== 'normal') return;
        const step = Math.max(1, Math.floor(state.filteredChats.length / 4));
        actions.moveChatSelection('down', step);
    });

    screen.key(['C-u'], () => {
        if (state.mode !== 'normal') return;
        const step = Math.max(1, Math.floor(state.filteredChats.length / 4));
        actions.moveChatSelection('up', step);
    });

    // gg — jump to first chat
    screen.key(['g'], () => {
        if (state.mode !== 'normal') return;
        const now = Date.now();
        if (now - _lastGTime <= GG_WINDOW_MS) {
            actions.jumpChatSelection('first');
            _lastGTime = 0;
        } else {
            _lastGTime = now;
        }
    });

    // G — jump to last chat
    screen.key(['S-g'], () => {
        if (state.mode !== 'normal') return;
        actions.jumpChatSelection('last');
    });

    // S-z — Close current chat and return to Welcome Screen
    screen.key(['S-z'], () => {
        if (state.mode !== 'normal') return;
        if (state.currentChatId) {
            actions.selectChat(null, null);
            actions.setShowWelcome(true);
            focusChat();
            screen.render();
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    // MESSAGE PANE SCROLLING
    // J/K scroll 3 lines at a time; Ctrl-f/Ctrl-b scroll half a page.
    // These work regardless of which pane has focus.
    // ══════════════════════════════════════════════════════════════════════

    screen.key(['J'], () => {
        if (state.mode !== 'normal') return;
        messageBox.scroll(3);
        screen.render();
    });

    screen.key(['K'], () => {
        if (state.mode !== 'normal') return;
        messageBox.scroll(-3);
        screen.render();
    });

    screen.key(['C-f', 'pagedown'], () => {
        if (state.mode !== 'normal') return;
        const half = Math.max(3, Math.floor((messageBox.height - 2) / 2));
        messageBox.scroll(half);
        screen.render();
    });

    screen.key(['C-b', 'pageup'], () => {
        if (state.mode !== 'normal') return;
        const half = Math.max(3, Math.floor((messageBox.height - 2) / 2));
        messageBox.scroll(-half);
        screen.render();
    });

    // ── Tab: toggle focus between chat list and message pane ───────────────
    screen.key(['tab'], () => {
        if (state.mode !== 'normal') return;
        if (_focusPane === 'chat') {
            focusMessage();
        } else {
            focusChat();
        }
        screen.render();
    });

    // ══════════════════════════════════════════════════════════════════════
    // ENTER — context-sensitive confirm
    // ══════════════════════════════════════════════════════════════════════

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
            await openSelectedChat();
            return;
        }

        if (state.showHelpPanel) {
            dismissHelp();
            return;
        }

        resetMessageScroll();
        await openSelectedChat();
    });

    // ══════════════════════════════════════════════════════════════════════
    // INSERT MODE (compose)
    // ══════════════════════════════════════════════════════════════════════

    screen.key(['i'], async () => {
        if (state.mode !== 'normal') return;
        if (!state.currentChatId) {
            await openSelectedChat();
        }
        if (!state.currentChatId) return;
        actions.setShowHelp(false);
        actions.setMode('insert');
        inputBox.focus();
        screen.render();
    });

    // Send via Ctrl-s from screen or inputBox
    screen.key(['C-s'], async () => {
        if (state.mode !== 'insert') return;
        await sendFromCompose();
    });

    inputBox.key(['C-s'], async () => {
        if (state.mode !== 'insert') return;
        await sendFromCompose();
    });

    // Enter inside inputBox sends
    inputBox.key(['C-m'], async () => {
        if (state.mode !== 'insert') return;
        await sendFromCompose();
    });

    inputBox.key(['enter'], async () => {
        if (state.mode !== 'insert') return;
        await sendFromCompose();
    });

    // ══════════════════════════════════════════════════════════════════════
    // ESCAPE — back to normal
    // ══════════════════════════════════════════════════════════════════════

    screen.key(['escape'], () => {
        if (dismissHelp()) return;

        if (state.mode === 'normal') return;

        if (state.mode === 'insert') {
            inputBox.clearValue();
            focusChat();
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

    // ══════════════════════════════════════════════════════════════════════
    // SEARCH MODE  /
    // ══════════════════════════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════════════════════════
    // COMMAND MODE  :
    // ══════════════════════════════════════════════════════════════════════

    screen.key([':'], () => {
        if (state.mode !== 'normal') return;
        actions.setShowHelp(false);
        actions.setMode('command');
        state.commandInput = '';
        commandBar.show();
        screen.render();
    });

    // ── Printable character routing ───────────────────────────────────────
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

    // ══════════════════════════════════════════════════════════════════════
    // HELP  &  QUIT
    // ══════════════════════════════════════════════════════════════════════

    screen.key(['?', 'S-/'], () => {
        if (state.mode !== 'normal') return;
        showHelp();
    });

    screen.key(['q'], () => {
        if (state.mode !== 'normal') return;
        log.info('User quit.');
        process.exit(0);
    });

    log.info('Keybindings registered.');
}

module.exports = { registerKeys };
