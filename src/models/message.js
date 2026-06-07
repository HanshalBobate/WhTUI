/**
 * message.js
 *
 * Message model — represents a single message within a conversation.
 *
 * All fields are extracted directly from the WhatsApp Web DOM.
 */

/** Supported media type strings */
const MEDIA_TYPES = Object.freeze({
    IMAGE:    'image',
    VIDEO:    'video',
    AUDIO:    'audio',
    DOCUMENT: 'document',
    STICKER:  'sticker',
    NONE:     null,
});

class Message {

    /**
     * @param {object} data  Raw data extracted from the DOM.
     */
    constructor(data = {}) {
        /** @type {string} Unique message identifier (from data-id attribute) */
        this.id = data.id || '';

        /**
         * @type {string} Sender identifier.
         * For group messages: the participant's number or name.
         * For DMs / outgoing: 'me' or the contact's number.
         */
        this.sender = data.sender || '';

        /** @type {string} Plain text body of the message */
        this.text = data.text || '';

        /** @type {number|null} Unix timestamp in milliseconds */
        this.timestamp = data.timestamp || null;

        /** @type {boolean} True if the message was sent by us */
        this.outgoing = Boolean(data.outgoing);

        /**
         * @type {object|null} Quoted message data if this is a reply.
         * Shape: { sender: string, text: string }
         */
        this.quoted = data.quoted || null;

        /**
         * @type {string|null} Media type if message contains media.
         * One of: 'image', 'video', 'audio', 'document', 'sticker', or null.
         */
        this.media = data.media || null;

        /**
         * @type {Array<{emoji: string, count: number}>} Emoji reactions on this message.
         */
        this.reactions = Array.isArray(data.reactions) ? data.reactions : [];
    }

    /**
     * Create a Message from a plain object.
     * @param {object} obj
     * @returns {Message}
     */
    static from(obj) {
        return new Message(obj);
    }

    /**
     * Human-readable media label for terminal display.
     * @returns {string}  e.g. '[IMAGE]', '[VIDEO]', or ''
     */
    mediaLabel() {
        if (!this.media) return '';
        return `[${this.media.toUpperCase()}]`;
    }

    /**
     * Return the display text: either message body or media label.
     * @returns {string}
     */
    displayText() {
        return this.text || this.mediaLabel() || '';
    }

    /**
     * Return a plain object representation.
     * @returns {object}
     */
    toJSON() {
        return {
            id:        this.id,
            sender:    this.sender,
            text:      this.text,
            timestamp: this.timestamp,
            outgoing:  this.outgoing,
            quoted:    this.quoted,
            media:     this.media,
            reactions: this.reactions,
        };
    }
}

module.exports = { Message, MEDIA_TYPES };
