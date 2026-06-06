/**
 * chat.js
 *
 * Chat model — represents a single conversation entry in the chat list.
 *
 * All fields are extracted directly from the WhatsApp Web DOM.
 * No values are fabricated or inferred beyond what is visible.
 */

class Chat {

    /**
     * @param {object} data  Raw data extracted from the DOM.
     */
    constructor(data = {}) {
        /** @type {string} Unique chat identifier (DOM element id / wa-id) */
        this.id = data.id || '';

        /** @type {string} Contact name or group title */
        this.title = data.title || '';

        /** @type {number} Number of unread messages (0 if read) */
        this.unreadCount = typeof data.unreadCount === 'number'
            ? data.unreadCount
            : parseInt(data.unreadCount, 10) || 0;

        /** @type {string} Preview text of the last message */
        this.lastMessage = data.lastMessage || '';

        /** @type {number|null} Unix timestamp (ms) of the last message */
        this.lastTimestamp = data.lastTimestamp || null;

        /** @type {boolean} Whether this chat is pinned to the top */
        this.pinned = Boolean(data.pinned);

        /** @type {boolean} Whether notifications are muted */
        this.muted = Boolean(data.muted);

        /** @type {boolean} Whether this chat is in the archived view */
        this.archived = Boolean(data.archived);

        /** @type {number} Row index in the DOM chat list (for reliable clicking) */
        this.rowIndex = typeof data.rowIndex === 'number' ? data.rowIndex : -1;

        /** @type {string} Display time string scraped from WhatsApp (e.g. "12:30") */
        this.timeLabel = data.timeLabel || '';
    }

    /**
     * Create a Chat from a plain object (e.g. from DOM scraping).
     * @param {object} obj
     * @returns {Chat}
     */
    static from(obj) {
        return new Chat(obj);
    }

    /**
     * Return a plain object representation.
     * @returns {object}
     */
    toJSON() {
        return {
            id:            this.id,
            title:         this.title,
            unreadCount:   this.unreadCount,
            lastMessage:   this.lastMessage,
            lastTimestamp: this.lastTimestamp,
            pinned:        this.pinned,
            muted:         this.muted,
            archived:      this.archived,
            rowIndex:      this.rowIndex,
            timeLabel:     this.timeLabel,
        };
    }
}

module.exports = { Chat };
