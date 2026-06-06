/**
 * time.js
 *
 * Time formatting utilities.
 *
 * All functions are pure — no side effects.
 */

/**
 * Format a Unix timestamp (ms or s) as a relative human-readable string.
 *
 * @param {number|null} ts  Unix timestamp in milliseconds (or seconds if < 1e10)
 * @returns {string}
 */
function relativeTime(ts) {
    if (!ts) return '';

    // Normalise seconds → milliseconds
    const ms   = ts < 1_000_000_000_000 ? ts * 1000 : ts;
    const now  = Date.now();
    const diff = now - ms; // milliseconds ago

    if (diff < 0)           return 'just now';
    if (diff < 60_000)      return 'just now';
    if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 172_800_000) return 'Yesterday';

    // Older: show date
    const d = new Date(ms);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/**
 * Format a timestamp as HH:MM (24-hour clock).
 *
 * @param {number|null} ts
 * @returns {string}
 */
function clockTime(ts) {
    if (!ts) return '';
    const ms = ts < 1_000_000_000_000 ? ts * 1000 : ts;
    const d  = new Date(ms);
    const h  = String(d.getHours()).padStart(2, '0');
    const m  = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Return a date separator label for message grouping.
 *
 * @param {number|null} ts
 * @returns {string}  e.g. 'Today', 'Yesterday', '3 Jun 2024'
 */
function dateSeparator(ts) {
    if (!ts) return '';
    const ms  = ts < 1_000_000_000_000 ? ts * 1000 : ts;
    const now = new Date();
    const d   = new Date(ms);

    const isToday     = d.toDateString() === now.toDateString();
    const yesterday   = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday)     return 'Today';
    if (isYesterday) return 'Yesterday';

    return d.toLocaleDateString('en-GB', {
        day:   'numeric',
        month: 'short',
        year:  'numeric',
    });
}

/**
 * Check whether two timestamps fall on the same calendar day.
 *
 * @param {number|null} a
 * @param {number|null} b
 * @returns {boolean}
 */
function sameDay(a, b) {
    if (!a || !b) return false;
    const toMs = (t) => (t < 1_000_000_000_000 ? t * 1000 : t);
    return new Date(toMs(a)).toDateString() === new Date(toMs(b)).toDateString();
}

module.exports = { relativeTime, clockTime, dateSeparator, sameDay };
