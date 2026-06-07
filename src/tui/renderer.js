/**
 * renderer.js  —  WHTUI V2
 *
 * Translates application state → blessed widget content.
 *
 * Design principles:
 *   - Diff-aware: only redraw what changed
 *   - Grouped sender messages by default, compact mode optional
 *   - No labels/borders on main panels — content only
 *   - Startup splash runs until startupDone
 *   - Preview popup is a floating overlay
 */

'use strict';

const screen = require('./screen');
const {
    topBar, chatPanel, msgPanel, statusBar, commandBar,
    inputBox, previewBox, startupBox,
    applyLayout, getChatPanelInnerWidth, getMsgPanelInnerWidth,
} = require('./layout');
const { THEME } = require('./theme');
const state   = require('../state/state');
const {
    formatChatRow, formatMessage, formatMessageCompact,
    formatGroupedMessages, truncate, stripTags, formatTimeAgo, wrapLine,
} = require('../utils/formatters');
const { dateSeparator, sameDay } = require('../utils/time');
const {
    getHelpText,
    getContextHints,
} = require('./helpContent');

// ── Constants ─────────────────────────────────────────────────────────────────

// Maximum messages to render at once (virtualization ceiling)
const MAX_MESSAGES = 200;

/**
 * Pad a tagged line with trailing spaces to fill `width` visible columns.
 * Forces blessed to overwrite every terminal cell in the row, preventing
 * ghost characters from old renders from persisting.
 *
 * @param {string} line   Blessed-tagged line
 * @param {number} width  Panel inner width
 * @returns {string}
 */
function _padLine(line, width) {
    if (!line) return ' '.repeat(width);
    const visible = stripTags(line).length;
    const pad = Math.max(0, width - visible);
    return line + ' '.repeat(pad);
}

/**
 * Center tagged text within `width` columns using spaces (no {center} tag needed).
 * Works correctly with wrap:false.
 */
function _centerLine(taggedText, width) {
    const visLen = stripTags(taggedText).length;
    if (visLen >= width) return taggedText;
    const left  = Math.floor((width - visLen) / 2);
    const right = width - visLen - left;
    return ' '.repeat(left) + taggedText + ' '.repeat(right);
}

// Startup splash steps accumulator
const _startupSteps = [];  // { text, done }
let   _startupCurrentText = null;

// ── Message scroll state (manual — we manage offset ourselves) ────────────────

/** Full rendered line array from the last build — we slice into it for display. */
let _allLines = [];

/**
 * Reset scroll to bottom (called when switching chats or new messages arrive).
 * Also wipes the cached line array.
 */
function resetMessageScroll() {
    state.msgScrollOffset = 0;
    _allLines = [];
}

// ── Startup splash ────────────────────────────────────────────────────────────

/**
 * Record a startup step (called from main.js withSpinner).
 * Keeps a running list of steps with their completion state.
 *
 * @param {string|null} text  Step description or null when done
 */
function recordStartupStep(text) {
    if (text === null) {
        // Mark last step as done
        if (_startupSteps.length > 0) {
            _startupSteps[_startupSteps.length - 1].done = true;
        }
        _startupCurrentText = null;
        return;
    }
    // Dedup: only add a new entry if this step text is different from the last one recorded
    if (_startupCurrentText === text) return;
    // Mark previous step done if any
    if (_startupSteps.length > 0 && !_startupSteps[_startupSteps.length - 1].done) {
        _startupSteps[_startupSteps.length - 1].done = true;
    }
    _startupSteps.push({ text, done: false });
    _startupCurrentText = text;
}

function renderStartup(spinnerFrame) {
    if (state.startupDone) {
        startupBox.hide();
        return;
    }

    const W = screen.width;
    const H = screen.height;

    // Build lines
    const lines = [];
    lines.push('');
    lines.push(_centerLine('{bold}{green-fg}whtui{/green-fg}{/bold}', W));
    lines.push('');

    for (const step of _startupSteps) {
        const icon = step.done
            ? '{green-fg}✓{/green-fg}'
            : (spinnerFrame ? `{yellow-fg}${spinnerFrame}{/yellow-fg}` : '{yellow-fg}◌{/yellow-fg}');
        const label = step.done
            ? `{grey-fg}${step.text}{/grey-fg}`
            : `{white-fg}${step.text}{/white-fg}`;
        lines.push(`  ${label.padEnd(36, ' ')} ${icon}`);
    }

    if (state.startupDone) {
        lines.push('');
        lines.push('  {green-fg}Ready.{/green-fg}');
    }

    // Center vertically
    const contentH = lines.length;
    const padTop   = Math.max(0, Math.floor((H - contentH) / 2));
    const padLines = Array(padTop).fill('');

    startupBox.setContent([...padLines, ...lines].join('\n'));
    startupBox.show();
}

// ── Top bar ───────────────────────────────────────────────────────────────────

function renderTopBar() {
    const W    = screen.width;
    const conn = state.connectionStatus;
    const vm   = state.viewMode;

    // Left: WHTUI brand
    const brand = '{bold}{green-fg}WHTUI{/green-fg}{/bold}';
    const brandVis = 'WHTUI';

    // Center / context
    let ctx = '';
    let ctxVis = '';

    if (state.mode === 'search' && state.searchQuery) {
        ctx    = `{yellow-fg}/ ${state.searchQuery}{/yellow-fg}`;
        ctxVis = `/ ${state.searchQuery}`;
    } else if (vm === 'chat-view' && state.currentChatTitle) {
        ctx    = `{bold}${truncate(state.currentChatTitle, 40)}{/bold}`;
        ctxVis = truncate(state.currentChatTitle, 40);
    } else if (vm === 'chat-list' || vm === 'split') {
        const n = state.filteredChats.length;
        const fm = state.filterMode !== 'all' ? ` · ${state.filterMode}` : '';
        ctx    = `{grey-fg}${n} chats${fm}{/grey-fg}`;
        ctxVis = `${n} chats${fm}`;
    }

    // Right: connection status
    let connStr, connVis;
    switch (conn) {
        case 'ONLINE':     connStr = '{green-fg}● ONLINE{/green-fg}';         connVis = '● ONLINE';       break;
        case 'OFFLINE':    connStr = '{red-fg}● OFFLINE{/red-fg}';            connVis = '● OFFLINE';      break;
        case 'CONNECTING': connStr = '{yellow-fg}◌ CONNECTING{/yellow-fg}';   connVis = '◌ CONNECTING';   break;
        case 'SYNCING':    connStr = '{yellow-fg}⟳ SYNCING{/yellow-fg}';      connVis = '⟳ SYNCING';      break;
        default:           connStr = '{grey-fg}◌ STARTING{/grey-fg}';         connVis = '◌ STARTING';
    }

    // Padding
    const leftLen  = brandVis.length + 2;
    const rightLen = connVis.length + 2;
    const ctxLen   = ctxVis.length;
    const padL     = Math.max(1, Math.floor((W - ctxLen) / 2) - leftLen);
    const padR     = Math.max(1, W - leftLen - padL - ctxLen - rightLen);

    topBar.setContent(
        ` ${brand}${' '.repeat(padL)}${ctx}${' '.repeat(padR)}${connStr} `
    );
}

// ── Chat list ─────────────────────────────────────────────────────────────────

function renderChats() {
    const chats = state.filteredChats;
    const width = getChatPanelInnerWidth();

    const selectedIdx = Math.min(
        state.selectedChatIdx,
        Math.max(0, chats.length - 1)
    );

    const items = chats.map((chat, idx) =>
        formatChatRow(chat, width, idx === selectedIdx)
    );

    chatPanel.setItems(items);

    if (items.length > 0) {
        chatPanel.select(selectedIdx);

        // Scroll to keep selection visible
        const innerH = chatPanel.height - 1;
        const child  = chatPanel.childOffset || 0;
        if (selectedIdx < child) {
            chatPanel.scrollTo(selectedIdx);
        } else if (selectedIdx >= child + innerH) {
            chatPanel.scrollTo(Math.max(0, selectedIdx - innerH + 1));
        }
    }
}

// ── Message renderer ──────────────────────────────────────────────────────────

function renderMessages(spinnerFrame) {
    // ── QR screen ──────────────────────────────────────────────────────────
    if (state.qrDisplayContent) {
        msgPanel.setContent(state.qrDisplayContent);
        return;
    }

    // ── Loading ─────────────────────────────────────────────────────────────
    if (state.isLoading) {
        const spin = spinnerFrame ? `{yellow-fg}${spinnerFrame}{/yellow-fg} ` : '';
        const W2 = getMsgPanelInnerWidth();
        const loadLine = `${spin}{yellow-fg}${state.loadingText}{/yellow-fg}`;
        msgPanel.setContent('\n' + _centerLine(loadLine, W2) + '\n');
        return;
    }

    // ── Help panel ──────────────────────────────────────────────────────────
    if (state.showHelpPanel) {
        msgPanel.setContent(getHelpText());
        return;
    }

    // ── No chats ─────────────────────────────────────────────────────────────
    if (!state.currentChatId && state.chats.length === 0) {
        msgPanel.setContent([
            '',
            '{red-fg}{bold}No chats found.{/bold}{/red-fg}',
            '',
            'WhatsApp Web loaded but the chat list is empty.',
            'Wait a moment, then run {cyan-fg}:reload{/cyan-fg}.',
            'If it persists, restart whtui.',
        ].join('\n'));
        return;
    }

    // ── Welcome / no chat selected ───────────────────────────────────────────────
    if (!state.currentChatId) {
        const n = state.chats.length;
        const W = getMsgPanelInnerWidth();
        msgPanel.setContent([
            ' '.repeat(W),
            _centerLine('{bold}{green-fg}whtui{/green-fg}{/bold}', W),
            ' '.repeat(W),
            _centerLine(`{grey-fg}${n} chat${n === 1 ? '' : 's'} loaded{/grey-fg}`, W),
            ' '.repeat(W),
            _centerLine('j/k navigate  ·  Enter open  ·  / search  ·  Space preview  ·  ? help', W),
            ' '.repeat(W),
            _centerLine('{grey-fg}Ctrl+W to toggle split view{/grey-fg}', W),
        ].join('\n'));
        return;
    }

    // ── Normal message rendering ─────────────────────────────────────────────
    const rawMsgs = state.messages.slice(-MAX_MESSAGES);
    const msgs = rawMsgs.filter(m => m.text || m.media || (m.reactions && m.reactions.length > 0) || m.quoted);

    const innerW = getMsgPanelInnerWidth();

    // Rebuild full line list only when messages change
    const newSig = `${msgs.length}:${msgs[msgs.length - 1]?.id}`;
    if (newSig !== _allLines._sig) {
        const built = [];

        if (msgs.length === 0) {
            built.push(_centerLine('{grey-fg}No messages loaded yet.  Press r to refresh.{/grey-fg}', innerW));
        } else if (state.compactMessages) {
            let prevTs = null;
            for (const msg of msgs) {
                if (!sameDay(prevTs, msg.timestamp)) {
                    const sep = dateSeparator(msg.timestamp);
                    built.push(_padLine('', innerW));
                    built.push(_centerLine(`{grey-fg}──── ${sep} ────{/grey-fg}`, innerW));
                    built.push(_padLine('', innerW));
                }
                prevTs = msg.timestamp;
                const cl = formatMessageCompact(msg);
                if (cl) built.push(cl);
            }
        } else {
            let prevTs = null;
            let i = 0;
            while (i < msgs.length) {
                const msg = msgs[i];
                if (!sameDay(prevTs, msg.timestamp)) {
                    const sep = dateSeparator(msg.timestamp);
                    built.push(_padLine('', innerW));
                    built.push(_centerLine(`{grey-fg}──── ${sep} ────{/grey-fg}`, innerW));
                    built.push(_padLine('', innerW));
                }
                const senderKey = msg.outgoing ? '__me__' : (msg.sender || 'contact');
                const run = [msg];
                let j = i + 1;
                while (j < msgs.length) {
                    const next = msgs[j];
                    if (!sameDay(prevTs, next.timestamp) && !sameDay(msg.timestamp, next.timestamp)) break;
                    const nextKey = next.outgoing ? '__me__' : (next.sender || 'contact');
                    if (nextKey !== senderKey) break;
                    run.push(next);
                    j++;
                }
                built.push(...formatGroupedMessages(run, innerW));
                prevTs = run[run.length - 1].timestamp;
                i = j;
            }
        }

        // Pad every line to panel width — every terminal cell gets written, no ghosts possible
        _allLines = built.map(l => _padLine(l, innerW));
        _allLines._sig = newSig;
        state.msgScrollOffset = 0;  // new messages → snap to bottom
    }

    // ── Viewport slicing ─────────────────────────────────────────────────────
    // Visible rows = panel height minus 2 border rows
    const viewH = Math.max(1, msgPanel.height - 2);
    const total = _allLines.length;

    // clamp scroll offset so we can't scroll past the top
    state.msgScrollOffset = Math.max(0, Math.min(state.msgScrollOffset, Math.max(0, total - viewH)));

    const startIdx = Math.max(0, total - viewH - state.msgScrollOffset);
    const slice    = _allLines.slice(startIdx, startIdx + viewH);

    // Pad top with blank lines so the panel is always completely full
    const blank = ' '.repeat(innerW);
    while (slice.length < viewH) slice.unshift(blank);

    msgPanel.setContent(slice.join('\n'));
}


// ── Preview popup ─────────────────────────────────────────────────────────────

function renderPreview() {
    const chat = state.previewChat;

    if (!chat) {
        previewBox.hide();
        return;
    }

    previewBox.setLabel(` ${truncate(chat.title, 40)} `);

    const lines = [];

    // Meta info
    if (chat.unreadCount > 0) {
        lines.push(`{green-fg}● ${chat.unreadCount} unread message${chat.unreadCount !== 1 ? 's' : ''}{/green-fg}`);
    } else {
        lines.push('{grey-fg}Up to date{/grey-fg}');
    }

    if (chat.muted)  lines.push('{grey-fg}⊗ Muted{/grey-fg}');
    if (chat.pinned) lines.push('{grey-fg}⊕ Pinned{/grey-fg}');

    // Last activity
    const ago = formatTimeAgo(chat.lastTimestamp);
    if (ago) lines.push(`{grey-fg}Last active: ${ago}{/grey-fg}`);

    lines.push('');
    lines.push('{grey-fg}────────────────────────────{/grey-fg}');
    lines.push('');

    // If this is the currently open chat, show actual messages
    if (chat.id === state.currentChatId && state.messages.length > 0) {
        const preview = state.messages
            .filter(m => m.text || m.media || (m.reactions && m.reactions.length > 0) || m.quoted)
            .slice(-8);
        const previewW = Math.max(20, Math.floor(screen.width * 0.66) - 4);
        const previewLines = formatGroupedMessages(preview, previewW);
        lines.push(...previewLines);
    } else if (chat.lastMessage) {
        lines.push(`{grey-fg}Last message:{/grey-fg}`);
        lines.push(chat.lastMessage);
    } else {
        lines.push('{grey-fg}No message preview available{/grey-fg}');
    }

    lines.push('');
    lines.push('{grey-fg}Space/Esc dismiss  ·  Enter open{/grey-fg}');

    previewBox.setContent(lines.join('\n'));
    previewBox.show();
}

// ── Status bar ────────────────────────────────────────────────────────────────

function getModePills() {
    return {
        normal:  `{${THEME.modes.normal.fg}-fg}{${THEME.modes.normal.bg}-bg}  NORMAL  {/}`,
        insert:  `{${THEME.modes.insert.fg}-fg}{${THEME.modes.insert.bg}-bg}  INSERT  {/}`,
        search:  `{${THEME.modes.search.fg}-fg}{${THEME.modes.search.bg}-bg}  SEARCH  {/}`,
        command: `{${THEME.modes.command.fg}-fg}{${THEME.modes.command.bg}-bg}  COMMAND  {/}`,
    };
}

function _vis(s) {
    return stripTags(s);
}

function renderStatusBar(spinnerFrame) {
    const mode    = state.mode;
    const loading = state.isLoading;
    const W       = screen.width;

    // Left: mode pill + context label
    let leftRaw, leftVis;

    if (loading && spinnerFrame) {
        const pill  = `{${THEME.modes.search.fg}-fg}{${THEME.modes.search.bg}-bg}  LOADING  {/}`;
        const label = ` {grey-fg}${spinnerFrame} ${state.loadingText}{/grey-fg}`;
        leftRaw = pill + label;
        leftVis = _vis(pill) + _vis(label);
    } else {
        const pills = getModePills();
        const pill  = pills[mode] || pills.normal;
        let label = '';
        if (state.compactMessages && mode === 'normal') {
            label = ' {grey-fg}compact{/grey-fg}';
        }
        if (state.filterMode !== 'all') {
            label += ` {grey-fg}[${state.filterMode}]{/grey-fg}`;
        }
        leftRaw = pill + label;
        leftVis = _vis(pill) + _vis(label);
    }

    // Right: context hints
    const hints    = getContextHints(state);
    const hintStr  = hints ? `{grey-fg}${hints}{/grey-fg}` : '';
    const hintVis  = hints || '';

    const rightRaw = hintStr ? `${hintStr} ` : '';
    const rightVis = hintVis ? `${hintVis} ` : '';

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

// Last-render signature for diff detection
let _lastSig = {
    viewMode: null,
    splitView: null,
    mode: null,
    insertMode: null,
    startupDone: false,
    previewChat: null,
    screenW: null,
    screenH: null,
};

function render(spinnerFrame) {
    const vm         = state.viewMode;
    const insertMode = state.mode === 'insert';
    const split      = state.splitView;

    // ── Startup overlay ───────────────────────────────────────────────────
    if (!state.startupDone) {
        recordStartupStep(state.startupStep);
        renderStartup(spinnerFrame);
        renderStatusBar(spinnerFrame);
        screen.render();
        return;
    } else if (!_lastSig.startupDone) {
        startupBox.hide();
    }

    // ── Layout (only when mode/split/insert changes) ──────────────────────
    const W = screen.width;
    const H = screen.height;
    const layoutChanged = (
        vm         !== _lastSig.viewMode  ||
        split      !== _lastSig.splitView ||
        insertMode !== _lastSig.insertMode ||
        W          !== _lastSig.screenW ||
        H          !== _lastSig.screenH
    );

    if (layoutChanged) {
        applyLayout(vm, insertMode);
    }

    // ── Render each section ───────────────────────────────────────────────

    // Chat panel: render when visible
    if (vm === 'chat-list' || vm === 'split') {
        renderChats();
    }

    // Message panel: render when visible
    if (vm === 'chat-view' || vm === 'split') {
        renderMessages(spinnerFrame);
    }

    // In chat-list mode, if loading/QR/help show it in the full screen
    if (vm === 'chat-list') {
        if (state.qrDisplayContent || state.isLoading || state.showHelpPanel) {
            // Switch to full-screen message view temporarily
            applyLayout('chat-view', false);
            renderMessages(spinnerFrame);
        }
    }

    // Top bar, status bar — always
    renderTopBar();
    renderStatusBar(spinnerFrame);

    // Command bar
    if (state.mode === 'command') {
        renderCommandBar(':', state.commandInput);
    } else if (state.mode === 'search') {
        renderCommandBar('/', state.searchQuery);
    } else {
        renderCommandBar(null, '');
    }

    // Preview popup
    renderPreview();

    // Track last sig
    _lastSig = {
        viewMode:    vm,
        splitView:   split,
        mode:        state.mode,
        insertMode,
        startupDone: state.startupDone,
        previewChat: state.previewChat,
        screenW:     W,
        screenH:     H,
    };

    screen.render();
}

screen.on('resize', () => {
    // Force complete redraw on resize
    screen.clearRegion(0, screen.width, 0, screen.height);
    render();
});



module.exports = {
    render,
    renderChats,
    renderMessages,
    renderStatusBar,
    renderCommandBar,
    renderTopBar,
    renderPreview,
    recordStartupStep,
    resetMessageScroll,
};
