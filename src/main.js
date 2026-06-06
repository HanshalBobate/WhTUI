/**
 * main.js
 *
 * Application orchestrator — the single file that wires everything together.
 *
 * Startup sequence:
 *   1.  Initialize TUI screen (immediately shows UI shell)
 *   2.  Start spinner  "Launching browser..."
 *   3.  Launch persistent Chromium via browser.js
 *   4.  Detect login state via session.js
 *      4a. Not logged in → "Waiting for QR scan..." → poll for auth
 *      4b. Already logged in → proceed
 *   5.  "Loading chats..."
 *   6.  Scrape initial chat list via scraper.js
 *   7.  Inject MutationObservers via observer.js
 *   8.  Register all keybindings
 *   9.  Start connection heartbeat
 *  10.  "Ready."
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// ── Utilities (must load before anything that logs) ────────────────────────
const log = require('./utils/logger');

log.info('=== WHTUI starting ===');

// ── Browser layer ─────────────────────────────────────────────────────────────
const browser  = require('./browser/browser');
const Session  = require('./browser/session');
const scraper  = require('./browser/scraper');
const { generateAscii } = require('./browser/qr');
const { injectObservers } = require('./browser/observer');

// ── Models ────────────────────────────────────────────────────────────────────
const { Chat }    = require('./models/chat');
const { Message } = require('./models/message');

// ── State ─────────────────────────────────────────────────────────────────────
const state   = require('./state/state');
const actions = require('./state/actions');

// ── TUI ───────────────────────────────────────────────────────────────────────
// Import screen FIRST to initialize blessed before any widgets are created
const screen   = require('./tui/screen');
const { chatList, messageBox, inputBox } = require('./tui/layout');
const { render, renderStatusBar }        = require('./tui/renderer');
const { startSpinner, stopSpinner }      = require('./tui/statusbar');
const { registerKeys }                   = require('./tui/keybindings');

// ── Wire up the render function into actions ──────────────────────────────────
// We pass a wrapper that includes the current spinner frame.
// The spinner manager updates this reference on each tick.
let _currentSpinnerFrame = null;

actions.setRenderFn(() => {
    render(_currentSpinnerFrame);
});

// ── Storage dirs ──────────────────────────────────────────────────────────────
[
    path.resolve(__dirname, '../storage/browser-profile'),
    path.resolve(__dirname, '../storage/logs'),
].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Spinner wrapper ──────────────────────────────────────────────────────────

/** While true, withSpinner keeps the global loading flag set between steps. */
let _startupPhase = true;

/**
 * Run an async operation while showing a spinner.
 *
 * @param {string}   text      Spinner label
 * @param {Function} asyncFn   async () → result
 * @returns {Promise<any>}     Result of asyncFn
 */
async function withSpinner(text, asyncFn) {
    actions.setLoading(true, text);

    const stop = startSpinner(text, (frame) => {
        _currentSpinnerFrame = frame;
        renderStatusBar(frame);
        screen.render();
    });

    try {
        const result = await asyncFn();
        return result;
    } finally {
        stopSpinner(stop);
        _currentSpinnerFrame = null;
        if (!_startupPhase) {
            actions.setLoading(false);
        }
    }
}

// ─── Chat actions (passed to keybindings) ─────────────────────────────────────

let _page = null;  // set after browser launch

/**
 * Scrape and load messages for the currently selected chat.
 */
async function openSelectedChat() {
    const chat = state.filteredChats[state.selectedChatIdx];
    if (!chat) return;

    log.info(`Opening chat: ${chat.title} (${chat.id})`);

    actions.selectChat(chat.id, chat.title);

    await withSpinner(`Loading ${chat.title}...`, async () => {
        await scraper.openChat(_page, chat.id, chat.title, chat.rowIndex);
        await _page.waitForTimeout(800);
        const messages = await scraper.scrapeMessages(_page);
        actions.setMessages(messages);
        await injectObservers(_page, {
            onNewMessage,
            onChatListChanged,
            onConnectionChange,
        });
    });

    actions.setConnectionStatus('ONLINE');
    chatList.focus();
}

/**
 * Log out of WhatsApp by closing the browser and wiping the profile data.
 */
async function logout() {
    actions.setLoading(true, 'Logging out and clearing session data...');
    try {
        await browser.close();
        const fs = require('fs');
        const path = require('path');
        const profilePath = path.resolve(__dirname, '../storage/browser-profile');
        if (fs.existsSync(profilePath)) {
            fs.rmSync(profilePath, { recursive: true, force: true });
        }
    } catch (err) {
        log.error('Error during logout', { error: err.message });
    }
    // Clean up screen before exiting
    require('./tui/screen').destroy();
    console.log('\n\x1b[32mSuccessfully logged out and wiped session data.\x1b[0m');
    console.log('Run the app again to scan a new QR code.\n');
    process.exit(0);
}

/**
 * Send the given text to the currently open chat.
 * @param {string} text
 */
async function sendMessage(text) {
    if (!state.currentChatId || !text.trim()) return;

    log.info(`Sending message to ${state.currentChatId}`);

    const ok = await scraper.sendMessage(_page, text);

    if (ok) {
        await _page.waitForTimeout(500);
        const messages = await scraper.scrapeMessages(_page);
        actions.setMessages(messages);
    } else {
        actions.setConnectionStatus('ONLINE');
        log.warn('sendMessage: failed — compose box may not be focused in WhatsApp Web');
    }
}

/**
 * Re-scrape the full chat list from WhatsApp Web.
 */
async function reloadChats() {
    await withSpinner('Reloading chats...', async () => {
        const chats = await scraper.scrapeChats(_page);
        actions.setChats(chats);
    });
}

async function refreshMessages() {
    if (!state.currentChatId) return;
    await withSpinner('Refreshing messages...', async () => {
        const messages = await scraper.scrapeMessages(_page);
        actions.setMessages(messages);
    });
}

/**
 * Open a chat by searching its title string.
 * @param {string} title
 */
async function openChatByTitle(title) {
    const chat = state.chats.find(
        c => c.title.toLowerCase().includes(title.toLowerCase())
    );
    if (!chat) {
        log.warn(`openChatByTitle: no match for "${title}"`);
        return;
    }
    const originalIdx = state.filteredChats.indexOf(chat);
    if (originalIdx >= 0) {
        actions.moveChatSelection('down', 0); // no-op, just ensure state is set
        state.selectedChatIdx = originalIdx;
    }
    await openSelectedChat();
}

// ─── Observer event handlers ──────────────────────────────────────────────────

/**
 * Called by MutationObserver when a new message arrives in the open chat.
 */
async function onNewMessage() {
    if (!state.currentChatId) return;
    log.debug('onNewMessage: re-scraping messages');
    const messages = await scraper.scrapeMessages(_page);
    actions.setMessages(messages);
}

async function onChatListChanged() {
    log.debug('onChatListChanged: re-scraping chat list');
    const chats = await scraper.scrapeChats(_page);
    actions.setChats(chats);
}

async function onConnectionChange() {
    const status = await scraper.scrapeConnectionStatus(_page);
    actions.setConnectionStatus(status);
}

function messageSignature(messages) {
    if (!messages.length) return '';
    const last = messages[messages.length - 1];
    return `${messages.length}:${last.id}:${last.text}`;
}

/**
 * Poll WhatsApp Web as a safety net when MutationObservers miss an update.
 */
function startLiveRefresh() {
    setInterval(async () => {
        if (!_page || state.isLoading || _startupPhase) return;

        try {
            const chats = await scraper.scrapeChats(_page);
            if (chats.length > 0) {
                actions.setChats(chats);
            }

            if (state.currentChatId) {
                const messages = await scraper.scrapeMessages(_page);
                const prevSig = messageSignature(state.messages);
                const nextSig = messageSignature(messages);
                if (prevSig !== nextSig) {
                    log.debug('liveRefresh: messages updated');
                    actions.setMessages(messages);
                }
            }
        } catch (err) {
            log.warn('liveRefresh failed', { error: err.message });
        }
    }, 3_000);
}

// ─── Connection heartbeat ─────────────────────────────────────────────────────

/**
 * Poll connection status every 15 seconds as a lightweight safety net.
 * The MutationObserver covers most changes; this catches anything missed.
 */
function startHeartbeat() {
    setInterval(async () => {
        try {
            const status = await scraper.scrapeConnectionStatus(_page);
            if (status !== state.connectionStatus) {
                actions.setConnectionStatus(status);
            }
        } catch (err) {
            log.warn('Heartbeat failed', { error: err.message });
        }
    }, 15_000);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

async function main() {
    actions.setShowWelcome(false);
    actions.setLoading(true, 'Starting whtui...');
    render();

    try {
        // 1. Launch browser
        const { page } = await withSpinner('Launching browser...', () =>
            browser.launch()
        );
        _page = page;

        // 2. Session detection
        const session = new Session(_page);

        session.on('qr', async (pairingData) => {
            actions.setConnectionStatus('CONNECTING');
            actions.setLoading(true, 'Scan QR with your phone (Linked Devices)');

            let qrAscii = '';
            try {
                qrAscii = await generateAscii(pairingData);
            } catch (err) {
                log.warn('Failed to render QR in terminal', { error: err.message });
            }

            actions.setQrDisplay([
                '',
                '{center}{green-fg}{bold}  whtui  {/bold}{/green-fg}{/center}',
                '',
                '{center}Open WhatsApp on your phone{/center}',
                '{center}Menu → Linked Devices → Link a Device{/center}',
                '',
                '{center}{bold}Scan this QR code:{/bold}{/center}',
                '',
                qrAscii,
                '',
                '{center}{grey-fg}Waiting for QR scan... (refreshes automatically){/grey-fg}{/center}',
            ].join('\n'));
            log.info('Displayed QR code in TUI.');
        });

        session.on('authenticated', () => {
            actions.setQrDisplay(null);
            actions.setLoading(true, 'Authenticated. Loading chats...');
        });

        // 3. Wait for ready state (blocks until authenticated + chat list loaded)
        await session.waitForReady();

        // 4. Scrape initial chat list
        const chats = await withSpinner('Loading chats...', () =>
            scraper.scrapeChats(_page)
        );
        actions.setChats(chats);

        // 5. Inject MutationObservers
        await withSpinner('Initializing live updates...', () =>
            injectObservers(_page, {
                onNewMessage,
                onChatListChanged,
                onConnectionChange,
            })
        );

        // 6. Register keyboard handlers
        registerKeys({
            openSelectedChat,
            sendMessage,
            reloadChats,
            refreshMessages,
            openChatByTitle,
            logout,
        });

        // 7. Give keyboard focus to the chat list
        chatList.focus();

        // 8. Start heartbeat + live refresh polling
        startHeartbeat();
        startLiveRefresh();

        // 9. Final ready state
        _startupPhase = false;
        actions.setQrDisplay(null);
        actions.setLoading(false);
        actions.setShowWelcome(chats.length > 0);
        actions.setConnectionStatus('ONLINE');
        log.info('WHTUI ready.');

        // Draw once more cleanly
        render();

    } catch (err) {
        _startupPhase = false;
        actions.setLoading(false);
        actions.setQrDisplay(null);
        log.error('Fatal startup error', { error: err.message, stack: err.stack });
        // Show error in TUI rather than crashing silently
        messageBox.setContent(
            `{red-fg}{bold}Startup Error{/bold}{/red-fg}\n\n${err.message}\n\n` +
            `{grey-fg}Check logs in storage/logs/ for details.{/grey-fg}\n\n` +
            `{grey-fg}Press q to quit.{/grey-fg}`
        );
        screen.render();
    }
}

// ─── Handle unexpected process errors ────────────────────────────────────────

process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection', {
        error: reason instanceof Error ? reason.message : String(reason),
    });
});

process.on('exit', () => {
    log.info('Process exiting.');
    browser.close().catch(() => {});
});

// ─── Run ─────────────────────────────────────────────────────────────────────

main();
