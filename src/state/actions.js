/**
 * actions.js
 *
 * Pure action dispatchers for mutating application state.
 *
 * Every function here:
 *   1. Validates / normalises its input
 *   2. Mutates state
 *   3. Calls render() to push the change to the TUI
 *
 * Import order matters — render is injected lazily to break the
 * circular dependency between state → tui → state.
 */

const Fuse   = require('fuse.js');
const state  = require('./state');
const log    = require('../utils/logger');

// Lazy reference to the render function (set by main.js on startup)
let _render = () => {};

/**
 * Wire up the render callback.  Called once from main.js after TUI is ready.
 * @param {Function} renderFn
 */
function setRenderFn(renderFn) {
    _render = renderFn;
}

// ─── Fuse.js instance (rebuilt when chats change) ─────────────────────────────

let _fuse = null;

function _rebuildFuse() {
    _fuse = new Fuse(state.chats, {
        keys:              ['title'],
        threshold:         0.4,   // 0 = exact, 1 = match anything
        includeScore:      false,
        minMatchCharLength: 1,
    });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Replace the full chat list with newly scraped chats.
 * Rebuilds the fuzzy-search index.
 *
 * @param {import('../models/chat').Chat[]} chats
 */
function setChats(chats) {
    const prevId = state.currentChatId
        || state.filteredChats[state.selectedChatIdx]?.id;
    const prevTitle = state.filteredChats[state.selectedChatIdx]?.title
        || state.currentChatTitle;

    state.chats = chats;
    _rebuildFuse();
    _applySearch();

    if (prevId || prevTitle) {
        const idx = state.filteredChats.findIndex(
            c => (prevId && c.id === prevId) || (prevTitle && c.title === prevTitle)
        );
        if (idx >= 0) state.selectedChatIdx = idx;
    }

    log.info(`setChats: ${chats.length} chats loaded`);
    _render();
}

/**
 * Open a chat by its id string.
 * Clears the message list (messages will load asynchronously).
 *
 * @param {string} chatId
 * @param {string} title
 */
function selectChat(chatId, title) {
    state.currentChatId    = chatId;
    state.currentChatTitle = title || '';
    state.messages         = [];
    state.showWelcome      = false;
    state.showHelpPanel    = false;
    log.info(`selectChat: ${chatId}`);
    _render();
}

/**
 * Toggle or set the keyboard help panel in the message area.
 *
 * @param {boolean} [visible]
 */
function setShowHelp(visible) {
    state.showHelpPanel = typeof visible === 'boolean' ? visible : !state.showHelpPanel;
    if (state.showHelpPanel) {
        state.showWelcome = false;
    }
    _render();
}

/**
 * Show or hide the getting-started welcome panel.
 *
 * @param {boolean} visible
 */
function setShowWelcome(visible) {
    state.showWelcome = visible;
    _render();
}

/**
 * Show or hide the QR login panel.
 *
 * @param {string|null} content  blessed-tagged QR screen content, or null to hide
 */
function setQrDisplay(content) {
    state.qrDisplayContent = content;
    if (content) {
        state.showWelcome = false;
    }
    _render();
}

/**
 * Replace the message list for the currently open chat.
 *
 * @param {import('../models/message').Message[]} messages
 */
function setMessages(messages) {
    state.messages = messages;
    _render();
}

/**
 * Append a single new incoming message to the bottom of the list.
 * No-op if not currently relevant to the open chat.
 *
 * @param {import('../models/message').Message} message
 * @param {string} chatId  The chat this message belongs to
 */
function appendMessage(message, chatId) {
    if (chatId !== state.currentChatId) return;
    state.messages.push(message);
    _render();
}

/**
 * Update the connection status indicator.
 *
 * @param {'ONLINE'|'OFFLINE'|'CONNECTING'|'SYNCING'|'STARTING'|'READY'} status
 */
function setConnectionStatus(status) {
    state.connectionStatus = status;
    _render();
}

/**
 * Switch UI mode.
 *
 * @param {'normal'|'insert'|'search'|'command'} mode
 */
function setMode(mode) {
    state.mode = mode;
    if (mode !== 'search') {
        state.searchQuery = '';
        _applySearch();
    }
    if (mode !== 'command') {
        state.commandInput = '';
    }
    _render();
}

/**
 * Update the search query and re-filter the chat list.
 *
 * @param {string} query
 */
function setSearchQuery(query) {
    state.searchQuery = query;
    _applySearch();
    // Reset selection to top of filtered results
    state.selectedChatIdx = 0;
    _render();
}

/**
 * Show or hide the loading spinner.
 *
 * @param {boolean} loading
 * @param {string}  [text]
 */
function setLoading(loading, text = 'Loading...') {
    state.isLoading  = loading;
    state.loadingText = text;
    _render();
}

/**
 * Move the selected chat index up or down.
 * Clamps to the bounds of filteredChats.
 *
 * @param {'up'|'down'} direction
 * @param {number} [amount=1]
 */
function moveChatSelection(direction, amount = 1) {
    if (state.filteredChats.length > 0) {
        state.showWelcome = false;
    }
    const max = Math.max(0, state.filteredChats.length - 1);
    if (direction === 'down') {
        state.selectedChatIdx = Math.min(max, state.selectedChatIdx + amount);
    } else {
        state.selectedChatIdx = Math.max(0, state.selectedChatIdx - amount);
    }
    _render();
}

/**
 * Jump to first or last chat.
 * @param {'first'|'last'} position
 */
function jumpChatSelection(position) {
    if (position === 'first') {
        state.selectedChatIdx = 0;
    } else {
        state.selectedChatIdx = Math.max(0, state.filteredChats.length - 1);
    }
    _render();
}

/**
 * Update a single chat's unread count (from MutationObserver badge update).
 *
 * @param {string} chatId
 * @param {number} unreadCount
 */
function updateUnread(chatId, unreadCount) {
    const chat = state.chats.find(c => c.id === chatId);
    if (chat) {
        chat.unreadCount = unreadCount;
        _applySearch();
        _render();
    }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Filter state.chats → state.filteredChats using the current searchQuery.
 * Uses Fuse for fuzzy matching; falls back to the full list when query is empty.
 */
function _applySearch() {
    if (!state.searchQuery || state.searchQuery.trim() === '') {
        state.filteredChats = state.chats;
        return;
    }
    if (!_fuse) {
        _rebuildFuse();
    }
    const results = _fuse.search(state.searchQuery);
    state.filteredChats = results.map(r => r.item);
}

module.exports = {
    setRenderFn,
    setChats,
    selectChat,
    setMessages,
    appendMessage,
    setConnectionStatus,
    setMode,
    setSearchQuery,
    setLoading,
    moveChatSelection,
    jumpChatSelection,
    updateUnread,
    setShowHelp,
    setShowWelcome,
    setQrDisplay,
};
