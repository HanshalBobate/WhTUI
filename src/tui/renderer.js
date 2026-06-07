/**
 * renderer.js
 *
 * Rendering functions that translate application state → blessed widget content.
 *
 * Key fixes in this version:
 *  - Chat list shows NAME ONLY (no message preview)
 *  - Message pane only auto-scrolls to bottom when messages actually change
 *    (prevents J/K scroll position being reset on every j/k keypress)
 *  - LazyNvim-style statusline with mode pill
 */

'use strict';

const screen  = require('./screen');
const {
    chatList, messageBox, statusBar, commandBar,
    applyLayout, getChatListInnerWidth,
} = require('./layout');
const { THEME }   = require('./theme');
const state   = require('../state/state');
const { formatChatRow, formatMessage, truncate } = require('../utils/formatters');
const { dateSeparator, sameDay } = require('../utils/time');
const {
    getWelcomeText,
    getHelpText,
    getContextHints,
    getChatPreview,
} = require('./helpContent');

// Maximum messages to render at once (virtualization ceiling)
const MAX_MESSAGES = 200;

// ── Message scroll tracking ───────────────────────────────────────────────────
// We only snap the message pane to the bottom when messages genuinely change
// (new chat opened, or new message received). Otherwise the user's manual
// J/K scroll position is preserved across renders.
let _msgSig = '';        // signature of last rendered message list

function _getMessageSig(msgs) {
    if (!msgs.length) return '';
    const last = msgs[msgs.length - 1];
    return `${msgs.length}:${last.id}:${last.text}`;
}

/**
 * Call this whenever the app intentionally navigates to a new chat so the
 * next renderMessages() knows to snap to the bottom.
 */
function resetMessageScroll() {
    _msgSig = '';
}

// ── Chat list renderer ────────────────────────────────────────────────────────

function renderChats() {
    const chats = state.filteredChats;
    const width = getChatListInnerWidth();

    const selectedIdx = Math.min(
        state.selectedChatIdx,
        Math.max(0, chats.length - 1)
    );

    // Build plain-text items — no blessed tags (list widget uses tags:false)
    const items = chats.map((chat, idx) =>
        formatChatRow(chat, width, idx === selectedIdx)
    );

    // Label
    if (state.mode === 'search' && state.searchQuery) {
        chatList.setLabel(` /${state.searchQuery} `);
    } else if (chats.length > 0) {
        chatList.setLabel(` Chats (${chats.length}) `);
    } else {
        chatList.setLabel(' Chats ');
    }

    chatList.setItems(items);

    if (items.length > 0) {
        chatList.select(selectedIdx);

        // Ensure the selected row is visible — scroll the list if needed.
        // We control this ourselves because vi:false means blessed won't auto-scroll.
        const innerH = chatList.height - 2;   // subtract borders
        const child  = chatList.childOffset || 0;
        if (selectedIdx < child) {
            chatList.scrollTo(selectedIdx);
        } else if (selectedIdx >= child + innerH) {
            chatList.scrollTo(Math.max(0, selectedIdx - innerH + 1));
        }
    }
}

// ── Message renderer ─────────────────────────────────────────────────────────

function renderMessages() {
    // ── Special screens ────────────────────────────────────────────────────
    if (state.qrDisplayContent) {
        messageBox.setLabel(' {bold}Link Device{/bold} ');
        messageBox.setContent(state.qrDisplayContent);
        screen.render();
        return;
    }

    if (state.isLoading) {
        messageBox.setLabel(' {bold}Loading…{/bold} ');
        messageBox.setContent(
            `\n{center}{yellow-fg}${state.loadingText}{/yellow-fg}{/center}\n`
        );
        screen.render();
        return;
    }

    if (state.showHelpPanel) {
        messageBox.setLabel(' {bold}Help{/bold} ');
        messageBox.setContent(getHelpText());
        screen.render();
        return;
    }

    if (state.showWelcome && !state.currentChatId && state.chats.length > 0) {
        messageBox.setLabel(' {bold}Getting Started{/bold} ');
        messageBox.setContent(getWelcomeText(state.chats.length));
        screen.render();
        return;
    }

    if (!state.currentChatId && state.chats.length === 0) {
        messageBox.setLabel(' {bold}Notice{/bold} ');
        messageBox.setContent([
            '{red-fg}{bold}No chats found.{/bold}{/red-fg}',
            '',
            'WhatsApp Web loaded but the chat list is empty.',
            'Wait a moment, then run {cyan-fg}:reload{/cyan-fg}.',
            'If it persists, restart whtui or check {grey-fg}storage/logs/{/grey-fg}.',
        ].join('\n'));
        screen.render();
        return;
    }

    // ── Normal message rendering ───────────────────────────────────────────
    const msgs = state.messages.slice(-MAX_MESSAGES);
    const newSig = _getMessageSig(msgs);
    const messagesChanged = newSig !== _msgSig;
    _msgSig = newSig;

    if (msgs.length === 0) {
        if (state.currentChatId) {
            messageBox.setContent(
                '\n{center}{grey-fg}No messages loaded yet{/grey-fg}{/center}'
            );
        } else {
            const selected = state.filteredChats[state.selectedChatIdx] || null;
            messageBox.setContent(getChatPreview(selected));
        }
        messageBox.setLabel(
            state.currentChatTitle
                ? ` {bold}${truncate(state.currentChatTitle, 40)}{/bold} `
                : ' {bold}Preview{/bold} '
        );
        screen.render();
        return;
    }

    const lines = [];
    let prevTs  = null;

    for (const msg of msgs) {
        if (!sameDay(prevTs, msg.timestamp)) {
            const sep = dateSeparator(msg.timestamp);
            lines.push('');
            lines.push(`{center}{grey-fg}─── ${sep} ───{/grey-fg}{/center}`);
            lines.push('');
        }
        prevTs = msg.timestamp;
        lines.push(formatMessage(msg, true));
        lines.push('');
    }

    messageBox.setContent(lines.join('\n'));

    // Only auto-scroll to bottom when messages genuinely changed
    // so manual J/K scrolling is not reset by unrelated state updates.
    if (messagesChanged) {
        messageBox.setScrollPerc(100);
    }

    messageBox.setLabel(
        state.currentChatTitle
            ? ` {bold}${truncate(state.currentChatTitle, 40)}{/bold} `
            : ' {bold}Messages{/bold} '
    );

    screen.render();
}

// ── Status bar (LazyNvim-style) ───────────────────────────────────────────────

/**
 * Mode pills — mimic LazyNvim's colored mode indicator.
 *
 * In blessed, {COLOR-bg}{COLOR-fg} creates background-colored blocks.
 * We pad the mode label so it reads like a pill.
 */
function getModePills() {
    return {
        normal:  `{${THEME.modes.normal.fg}-fg}{${THEME.modes.normal.bg}-bg}  NORMAL  {/}`,
        insert:  `{${THEME.modes.insert.fg}-fg}{${THEME.modes.insert.bg}-bg}  INSERT  {/}`,
        search:  `{${THEME.modes.search.fg}-fg}{${THEME.modes.search.bg}-bg}  SEARCH  {/}`,
        command: `{${THEME.modes.command.fg}-fg}{${THEME.modes.command.bg}-bg}  COMMAND  {/}`,
    };
}

/** Strip blessed tags to measure visible length */
function _vis(s) {
    return s.replace(/\{[^}]+\}/g, '');
}

function renderStatusBar(spinnerFrame) {
    const mode    = state.mode;
    const loading = state.isLoading;
    const conn    = state.connectionStatus;
    const W       = screen.width;

    // ── Left section: mode pill + context ─────────────────────────────────
    let leftRaw, leftVis;

    if (loading && spinnerFrame) {
        const pill = `{${THEME.modes.search.fg}-fg}{${THEME.modes.search.bg}-bg}  LOADING  {/}`;
        const label = ` {grey-fg}${spinnerFrame} ${state.loadingText}{/grey-fg}`;
        leftRaw = pill + label;
        leftVis = _vis(pill) + _vis(label);
    } else {
        const pills = getModePills();
        const pill  = pills[mode] || pills.normal;
        let   label = '';
        if (state.currentChatTitle) {
            label = ` {bold}${truncate(state.currentChatTitle, 30)}{/bold}`;
        } else {
            label = ' {grey-fg}whtui{/grey-fg}';
        }
        leftRaw = pill + label;
        leftVis = _vis(pill) + _vis(label);
    }

    // ── Right section: hints + connection ─────────────────────────────────
    const hints = getContextHints(state);

    let connStr, connVis;
    switch (conn) {
        case 'ONLINE':     connStr = '{green-fg}● ONLINE{/green-fg}';       connVis = '● ONLINE';      break;
        case 'OFFLINE':    connStr = '{red-fg}● OFFLINE{/red-fg}';          connVis = '● OFFLINE';     break;
        case 'CONNECTING': connStr = '{yellow-fg}◌ CONNECTING{/yellow-fg}'; connVis = '◌ CONNECTING';  break;
        case 'SYNCING':    connStr = '{yellow-fg}⟳ SYNCING{/yellow-fg}';    connVis = '⟳ SYNCING';     break;
        default:           connStr = '{grey-fg}◌ STARTING{/grey-fg}';       connVis = '◌ STARTING';
    }

    const hintStr = hints ? `{grey-fg}${hints}{/grey-fg}` : '';
    const hintVis = hints || '';

    const rightRaw = `${hintStr}  ${connStr} `;
    const rightVis = `${hintVis}  ${connVis} `;

    // ── Padding to fill the line ───────────────────────────────────────────
    const padLen = Math.max(1, W - leftVis.length - rightVis.length);
    const pad    = ' '.repeat(padLen);

    statusBar.setContent(`${leftRaw}${pad}${rightRaw}`);
}

// ── Command bar ───────────────────────────────────────────────────────────────

function renderCommandBar(prefix, text) {
    if (prefix === null) {
        commandBar.hide();
    } else {
        commandBar.show();
        commandBar.setContent(
            `{bold}${prefix}{/bold}{white-fg}${text}{/white-fg}{blink}▌{/blink}`
        );
    }
}

// ── Master render ─────────────────────────────────────────────────────────────

function render(spinnerFrame) {
    applyLayout();
    renderChats();
    renderMessages();
    renderStatusBar(spinnerFrame);

    if (state.mode === 'command') {
        renderCommandBar(':', state.commandInput);
    } else if (state.mode === 'search') {
        renderCommandBar('/', state.searchQuery);
    } else {
        renderCommandBar(null, '');
    }

    screen.render();
}

module.exports = {
    render,
    renderChats,
    renderMessages,
    renderStatusBar,
    renderCommandBar,
    resetMessageScroll,
};
