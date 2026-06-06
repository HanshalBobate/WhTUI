/**
 * browser.js
 *
 * Manages the persistent Chromium browser context via Playwright.
 *
 * Uses launchPersistentContext so that WhatsApp Web's IndexedDB session
 * survives across application, terminal, and system restarts.
 *
 * The browser profile is stored at:  ./storage/browser-profile/
 *
 * Exports:
 *   launch()   — start (or reuse) the browser; returns { browser, page }
 *   getPage()  — return the active page (or throw if not launched)
 *   close()    — gracefully close the browser
 */

const path = require('path');
const fs   = require('fs');
const { chromium } = require('playwright');
const log  = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_DIR = path.resolve(__dirname, '../../storage/browser-profile');
const WA_URL      = 'https://web.whatsapp.com';

/** Chromium launch options */
const LAUNCH_OPTIONS = {
    headless: true,

    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        // Prevent Chromium from throttling background tabs
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
    ],
};

// ─── Module state ─────────────────────────────────────────────────────────────

let _browser = null;
let _context = null;
let _page    = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensure the profile storage directory exists before Playwright tries to use it.
 */
function ensureProfileDir() {
    if (!fs.existsSync(PROFILE_DIR)) {
        fs.mkdirSync(PROFILE_DIR, { recursive: true });
        log.info(`Created browser profile directory: ${PROFILE_DIR}`);
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Launch (or reuse) the persistent Chromium context and open WhatsApp Web.
 *
 * @returns {{ browser: BrowserContext, page: Page }}
 */
async function launch() {
    ensureProfileDir();

    log.info('Launching persistent Chromium context...');

    // launchPersistentContext creates a single context tied to the user-data-dir.
    // This preserves cookies, IndexedDB, localStorage across restarts — meaning
    // WhatsApp Web stays logged in after the initial QR scan.
    _context = await chromium.launchPersistentContext(PROFILE_DIR, {
        ...LAUNCH_OPTIONS,
        viewport: { width: 1280, height: 900 },
        userAgent: [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'AppleWebKit/537.36 (KHTML, like Gecko)',
            'Chrome/124.0.0.0 Safari/537.36',
        ].join(' '),
        // Locale & timezone to avoid detection
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    // launchPersistentContext returns a BrowserContext directly (not a Browser).
    // Grab the underlying browser handle for bookkeeping.
    _browser = _context.browser();

    log.info('Browser context created.');

    // Reuse existing page or open a new one
    const pages = _context.pages();
    if (pages.length > 0) {
        _page = pages[0];
        log.info('Reusing existing page.');
    } else {
        _page = await _context.newPage();
        log.info('Opened new page.');
    }

    // Suppress unnecessary browser console noise in our logs
    _page.on('console', (msg) => {
        if (msg.type() === 'error') {
            log.debug(`[browser console] ${msg.text()}`);
        }
    });

    _page.on('pageerror', (err) => {
        log.warn(`[page error] ${err.message}`);
    });

    _page.on('crash', () => {
        log.error('Page crashed! Attempting recovery...');
    });

    // Navigate to WhatsApp Web only if not already there
    const currentUrl = _page.url();
    if (!currentUrl.includes('web.whatsapp.com')) {
        log.info(`Navigating to ${WA_URL}...`);
        await _page.goto(WA_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
        });
    } else {
        log.info('Already on WhatsApp Web.');
    }

    return { browser: _context, page: _page };
}

/**
 * Return the active page.
 * @throws {Error} if launch() has not been called yet.
 */
function getPage() {
    if (!_page) {
        throw new Error('Browser not launched. Call launch() first.');
    }
    return _page;
}

/**
 * Return the active browser context.
 */
function getContext() {
    return _context;
}

/**
 * Gracefully close the browser context.
 */
async function close() {
    log.info('Closing browser...');
    if (_context) {
        await _context.close();
        _context = null;
        _page    = null;
        _browser = null;
    }
}

module.exports = { launch, getPage, getContext, close };
