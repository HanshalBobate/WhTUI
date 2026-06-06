/**
 * observer.js
 *
 * Injects MutationObservers into the WhatsApp Web page and bridges
 * DOM events back to Node.js via Playwright's exposeFunction().
 *
 * No polling loops.  Browser-side observers fire callbacks; those
 * callbacks invoke the exposed Node.js functions which update state.
 *
 * Observed events:
 *   - New messages in the active conversation
 *   - Chat list changes (new chats, reordering)
 *   - Unread badge changes
 *   - Connection status banner changes
 */

const SELECTORS = require('./selectors');
const log       = require('../utils/logger');

// ─── Public API ───────────────────────────────────────────────────────────────

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

    // Expose Node.js callback functions to the browser context
    // exposeFunction is idempotent if the name is already registered —
    // we catch and ignore the "already exists" error on re-injection.
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

        // ── Utility: resolve first matching element from a selector list ──
        function firstEl(sels) {
            for (const s of sels) {
                const el = document.querySelector(s);
                if (el) return el;
            }
            return null;
        }

        // ── Utility: debounce helper (browser-side) ─────────────────────
        function debounce(fn, ms) {
            let t;
            return (...args) => {
                clearTimeout(t);
                t = setTimeout(() => fn(...args), ms);
            };
        }

        // ── 1. Message observer ─────────────────────────────────────────
        const mainPanel = document.querySelector('#main') || document.body;

        function attachMessageObserver(container) {
            if (!container) return;
            const onMsg = debounce(() => {
                window.__whtui_onNewMessage();
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

        // ── 2. Chat list observer ───────────────────────────────────────
        // Watches for new chats arriving, reordering, or unread badges updating.
        const chatListContainer = firstEl(SEL.chatList.container);

        if (chatListContainer) {
            const onList = debounce(() => {
                window.__whtui_onChatListChanged();
            }, 500);

            new MutationObserver((mutations) => {
                // Only react to structural changes (new chat rows) or
                // attribute changes (unread badge text update).
                const relevant = mutations.some(m =>
                    m.addedNodes.length > 0 ||
                    m.removedNodes.length > 0 ||
                    m.type === 'characterData'
                );
                if (relevant) onList();
            }).observe(chatListContainer, {
                childList:     true,
                subtree:       true,
                characterData: true,
            });
        }

        // ── 3. Connection status observer ───────────────────────────────
        // Watches the header area for connection banner appearance/removal.
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

        // ── 4. Re-observe message container when a new chat is opened ───
        let lastMsgContainer = messageContainer;

        new MutationObserver(() => {
            const newContainer = firstEl(SEL.messages.container) || mainPanel;
            if (newContainer && newContainer !== lastMsgContainer) {
                lastMsgContainer = newContainer;
                attachMessageObserver(newContainer);
                window.__whtui_onNewMessage();
            }
        }).observe(mainPanel, { childList: true, subtree: true });

    }, SELECTORS);

    log.info('MutationObservers injected successfully.');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Expose a function, ignoring "already registered" errors on re-injection.
 */
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
