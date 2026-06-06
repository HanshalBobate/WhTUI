/**
 * session.js
 *
 * Manages the WhatsApp Web authentication state.
 *
 * Responsibilities:
 *   - Detect whether the user is already logged in (session exists)
 *   - Detect QR code presence and emit status updates
 *   - Wait for full app readiness (chat list loaded)
 *   - Monitor for unexpected logouts
 *
 * Emits events via a simple EventEmitter:
 *   'qr'             — QR pairing data ready for terminal display
 *   'authenticated'  — login completed (QR was scanned)
 *   'ready'          — app shell loaded and chats are accessible
 *   'disconnected'   — session lost / WhatsApp logged the user out
 */

const { EventEmitter } = require('events');
const SELECTORS = require('./selectors');
const { findFirst, readQrPairingData } = require('./dom');
const log       = require('../utils/logger');

// ─── Session class ────────────────────────────────────────────────────────────

class Session extends EventEmitter {

    constructor(page) {
        super();
        this.page          = page;
        this._polling      = null;
        this._lastQrData   = null;
    }

    /**
     * Begin authentication detection.
     * Returns a promise that resolves when the app is fully ready.
     */
    async waitForReady(retry = 0) {
        log.info('Waiting for WhatsApp Web to initialize...');

        await this.page.waitForLoadState('domcontentloaded');

        const appShellSel = await findFirst(
            this.page,
            SELECTORS.login.appShell,
            45_000
        );

        if (appShellSel) {
            log.info(`App shell found (${appShellSel}) — session already authenticated.`);
            await this._waitForChatList();
            this._startLogoutWatcher();
            this.emit('ready');
            return;
        }

        const qrSel = await findFirst(
            this.page,
            SELECTORS.login.qrCode,
            90_000
        );

        if (qrSel) {
            log.info(`QR code detected (${qrSel}) — waiting for user to scan...`);
            await this._emitCurrentQr();
            await this._pollUntilAuthenticated();
            log.info('Authentication detected after QR scan.');
            this.emit('authenticated');
            await this._waitForChatList();
            this._startLogoutWatcher();
            this.emit('ready');
            return;
        }

        if (retry >= 1) {
            throw new Error(
                'WhatsApp Web did not show a login QR code or chat list. Check your network and try again.'
            );
        }

        log.warn('Neither app shell nor QR detected. Reloading and retrying once...');
        await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
        return this.waitForReady(retry + 1);
    }

    /**
     * Emit the current QR pairing payload when it changes.
     */
    async _emitCurrentQr() {
        const data = await readQrPairingData(this.page);
        if (!data || data === this._lastQrData) return;

        this._lastQrData = data;
        this.emit('qr', data);
    }

    /**
     * Poll until the authenticated app shell appears.
     */
    async _pollUntilAuthenticated() {
        const MAX_WAIT_MS = 5 * 60 * 1_000;
        const INTERVAL    = 1_000;
        const started     = Date.now();

        while (Date.now() - started < MAX_WAIT_MS) {
            const found = await findFirst(
                this.page,
                SELECTORS.login.appShell,
                500
            );
            if (found) return;

            await this._emitCurrentQr();
            await this.page.waitForTimeout(INTERVAL);
        }

        throw new Error('Timed out waiting for QR scan (5 minutes).');
    }

    /**
     * Wait until the chat list pane is visible and has at least one item.
     */
    async _waitForChatList() {
        log.info('Waiting for chat list to populate...');

        const containerSel = await findFirst(
            this.page,
            SELECTORS.chatList.container,
            30_000
        );

        if (!containerSel) {
            log.warn('Chat list container not found within timeout — continuing anyway.');
            return;
        }

        const itemSel = SELECTORS.chatList.items[0];
        try {
            await this.page.waitForSelector(itemSel, { timeout: 20_000 });
            log.info('Chat list populated.');
        } catch {
            log.warn('Chat items not found within timeout — WhatsApp may be still syncing.');
        }
    }

    /**
     * Start a background watcher that detects if WhatsApp logs the user out.
     */
    _startLogoutWatcher() {
        const CHECK_INTERVAL = 15_000;

        this._polling = setInterval(async () => {
            try {
                const qrVisible = await findFirst(
                    this.page,
                    SELECTORS.login.qrCode,
                    500
                );
                if (qrVisible) {
                    log.warn('QR code reappeared — session has been invalidated!');
                    clearInterval(this._polling);
                    this.emit('disconnected', 'session_revoked');
                }
            } catch {
                // Ignore transient errors during polling
            }
        }, CHECK_INTERVAL);
    }

    destroy() {
        if (this._polling) {
            clearInterval(this._polling);
            this._polling = null;
        }
    }
}

module.exports = Session;
