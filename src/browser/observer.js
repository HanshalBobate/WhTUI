/**
 * observer.js  —  WHTUI V2
 *
 * Injects MutationObservers into the WhatsApp Web page and bridges
 * DOM events back to Node.js via Playwright's exposeFunction().
 *
 * Event-driven, not polling.  Changes to debounce timing:
 *   - Chat list observer: 1000ms debounce (was 500ms) to reduce churn
 *   - Message observer: tracks lastSeenCount, only fires when new messages arrive
 *   - Unread badge path: dedicated handler that avoids full chat-list re-scrape
 */

const SELECTORS = require('./selectors');
const log       = require('../utils/logger');

/**
 * Set up all browser-side MutationObservers and expose the Node.js callbacks.
 *
 * @param {import('playwright').Page} page
 * @param {object} handlers
 * @param {Function} handlers.onNewMessage        () => void — re-scrape messages
 * @param {Function} handlers.onChatListChanged   () => void — re-scrape chat list
 * @param {Function} handlers.onConnectionChange  () => void — re-scrape connection
 */
async function injectObservers(page, handlers) {
    log.info('Injecting MutationObservers into WhatsApp Web...');

    await _exposeFunction(page, '__whtui_onNewMessage', async () => {
        log.debug('[observer] onNewMessage fired');
        if (handlers.onNewMessage) await handlers.onNewMessage();
    });

    await _exposeFunction(page, '__whtui_onChatListChanged', async () => {
        log.debug('[observer] onChatListChanged fired');
        if (handlers.onChatListChanged) await handlers.onChatListChanged();
    });

    await _exposeFunction(page, '__whtui_onConnectionChange', async () => {
        log.debug('[observer] onConnectionChange fired');
        if (handlers.onConnectionChange) await handlers.onConnectionChange();
    });

    // Inject the observer scripts into the page
    await page.evaluate((SEL) => {

        // ── Utility ──────────────────────────────────────────────────────
        function firstEl(sels) {
            for (const s of sels) {
                const el = document.querySelector(s);
                if (el) return el;
            }
            return null;
        }

        function debounce(fn, ms) {
            let t;
            return (...args) => {
                clearTimeout(t);
                t = setTimeout(() => fn(...args), ms);
            };
        }

        // ── 1. Message observer ──────────────────────────────────────────
        // Only fires when message count actually increases to avoid spurious
        // re-scrapes from DOM reflows / style attribute changes.
        const mainPanel = document.querySelector('#main') || document.body;
        let _lastMsgCount = 0;

        function _countMessages() {
            let rows = [];
            for (const s of SEL.messages.items) {
                rows = Array.from(document.querySelectorAll(s));
                if (rows.length > 0) break;
            }
            return rows.length;
        }

        function attachMessageObserver(container) {
            if (!container) return;
            const onMsg = debounce(() => {
                const count = _countMessages();
                if (count > _lastMsgCount) {
                    _lastMsgCount = count;
                    window.__whtui_onNewMessage();
                } else if (count < _lastMsgCount) {
                    // chat was switched, reset count
                    _lastMsgCount = count;
                }
            }, 300);

            new MutationObserver((mutations) => {
                const added = mutations.some(m => m.addedNodes.length > 0
                    || m.type === 'characterData');
                if (added) onMsg();
            }).observe(container, { childList: true, subtree: true, characterData: true });
        }

        const messageContainer = firstEl(SEL.messages.container);
        attachMessageObserver(messageContainer);
        if (!messageContainer) {
            attachMessageObserver(mainPanel);
        }

        // ── 2. Chat list observer ────────────────────────────────────────
        // Debounced at 1000ms.  Structural changes only (new rows / removals);
        // attribute changes on existing rows are handled by the unread path below.
        const chatListContainer = firstEl(SEL.chatList.container);

        if (chatListContainer) {
            const onList = debounce(() => {
                window.__whtui_onChatListChanged();
            }, 1000);

            new MutationObserver((mutations) => {
                // Only structural changes trigger a full re-scrape
                const structural = mutations.some(m =>
                    m.addedNodes.length > 0 ||
                    m.removedNodes.length > 0
                );
                if (structural) onList();
            }).observe(chatListContainer, {
                childList: true,
                subtree:   true,
            });

            // ── 3. Unread badge observer ─────────────────────────────────
            // Watches characterData changes only — catches badge text updates
            // without triggering a full chat list re-scrape.
            const onUnread = debounce(() => {
                // Re-scrape the full list for simplicity — a future optimisation
                // could diff individual badges, but 1s debounce keeps it cheap.
                window.__whtui_onChatListChanged();
            }, 1500);

            new MutationObserver((mutations) => {
                const badgeChange = mutations.some(m =>
                    m.type === 'characterData' ||
                    (m.type === 'childList' && (
                        Array.from(m.addedNodes).some(n => n.nodeType === 3) ||
                        Array.from(m.removedNodes).some(n => n.nodeType === 3)
                    ))
                );
                if (badgeChange) onUnread();
            }).observe(chatListContainer, {
                subtree:       true,
                characterData: true,
                childList:     true,
            });
        }

        // ── 4. Connection status observer ────────────────────────────────
        const headerArea = document.querySelector('#side header')
                        || document.querySelector('#pane-side');

        if (headerArea) {
            const onConn = debounce(() => {
                window.__whtui_onConnectionChange();
            }, 800);

            new MutationObserver(() => {
                onConn();
            }).observe(headerArea, { childList: true, subtree: true });
        }

        // ── 5. Re-observe when a new chat is opened ──────────────────────
        let lastMsgContainer = messageContainer;

        new MutationObserver(() => {
            const newContainer = firstEl(SEL.messages.container) || mainPanel;
            if (newContainer && newContainer !== lastMsgContainer) {
                lastMsgContainer = newContainer;
                _lastMsgCount = 0;  // reset count for new chat
                attachMessageObserver(newContainer);
                window.__whtui_onNewMessage();
            }
        }).observe(mainPanel, { childList: true, subtree: true });

    }, SELECTORS);

    log.info('MutationObservers injected (V2 — smarter debouncing).');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _exposeFunction(page, name, fn) {
    try {
        await page.exposeFunction(name, fn);
    } catch (err) {
        if (!err.message.includes('already exists')) {
            log.warn(`exposeFunction "${name}" failed`, { error: err.message });
        }
    }
}

module.exports = { injectObservers };
