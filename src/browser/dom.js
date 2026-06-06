/**
 * dom.js
 *
 * Shared DOM helpers for Playwright page interaction.
 */

/**
 * Try each selector; return the first visible match within the total timeout.
 * Polls all selectors together instead of waiting sequentially per selector.
 *
 * @param {import('playwright').Page} page
 * @param {string[]} selectorList
 * @param {number} timeout  total timeout in ms
 * @returns {Promise<string|null>}
 */
async function findFirst(page, selectorList, timeout = 2000) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        for (const sel of selectorList) {
            const el = await page.$(sel);
            if (!el) continue;

            const visible = await el.isVisible().catch(() => false);
            if (visible) return sel;
        }
        await page.waitForTimeout(250);
    }

    return null;
}

/**
 * Read WhatsApp Web pairing data from the login screen.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string|null>}
 */
async function readQrPairingData(page) {
    return page.evaluate(() => {
        const el = document.querySelector('[data-ref]');
        if (!el) return null;

        const value = el.getAttribute('data-ref');
        return value && value.trim() ? value.trim() : null;
    });
}

module.exports = { findFirst, readQrPairingData };
