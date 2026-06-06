/**
 * selectors.js
 *
 * Single source of truth for every CSS selector used against WhatsApp Web.
 *
 * When WhatsApp updates their DOM, edit ONLY this file.
 * Each selector group is an ordered array — the scraper tries them in sequence
 * and uses the first one that resolves.
 *
 * WhatsApp Web URL: https://web.whatsapp.com
 * Last verified: 2026
 */

const SELECTORS = {

    // ──────────────────────────────────────────────────────────────────────────
    // Login / QR
    // ──────────────────────────────────────────────────────────────────────────

    login: {
        /** The QR canvas or image shown before authentication */
        qrCode: [
            'canvas[aria-label="Scan this QR code to link a device!"]',
            '[data-testid="link-device-qr-code"]',
            'canvas[aria-label="Scan me!"]',
            '[data-testid="qrcode"]',
            '[data-ref]',
        ],

        /** Element that appears only while loading, before QR or app */
        loadingProgress: [
            '[data-testid="intro-md-beta-logo-dark"]',
            '.landing-header',
            '[data-testid="startup"]',
        ],

        /** The main app shell — present only when authenticated */
        appShell: [
            '#pane-side',
            '#side',
            '[data-testid="chat-list"]',
            'div[data-testid="chat-list"]',
            '#app .two',
        ],
    },

    // ──────────────────────────────────────────────────────────────────────────
    // Chat List (left panel)
    // ──────────────────────────────────────────────────────────────────────────

    chatList: {
        /** Scrollable container for all chat rows */
        container: [
            '#pane-side',
            '[data-testid="chat-list"]',
            'div[aria-label="Chat list"]',
        ],

        /** Individual chat list items */
        items: [
            '#pane-side [data-testid="cell-frame-container"]',
            '#pane-side div[role="listitem"]',
            '#pane-side [role="listitem"]',
        ],

        /** Chat title / contact name inside a chat row */
        title: [
            '[data-testid="cell-frame-title"] span[title]',
            '[data-testid="cell-frame-title"]',
            'span[title][dir="auto"]',
        ],

        /** Last message preview inside a chat row */
        lastMessage: [
            '[data-testid="last-msg-status"] ~ span',
            '[data-testid="cell-frame-secondary"]',
            '.e1C8P span',
        ],

        /** Timestamp of last message */
        timestamp: [
            '[data-testid="cell-frame-primary-detail"]',
            '.Di5zd span',
        ],

        /** Unread badge (circle with number) */
        unreadBadge: [
            '[data-testid="icon-unread-count"]',
            'span[data-testid="icon-unread-count"]',
        ],

        /** Pinned indicator */
        pinned: [
            '[data-testid="pinned"]',
            '[data-icon="pinned2"]',
        ],

        /** Muted indicator */
        muted: [
            '[data-testid="muted"]',
            '[data-icon="muted"]',
        ],
    },

    // ──────────────────────────────────────────────────────────────────────────
    // Message List (right panel / conversation)
    // ──────────────────────────────────────────────────────────────────────────

    messages: {
        /** Scrollable message container */
        container: [
            '#main [data-testid="conversation-panel-messages"]',
            '#main .copyable-area',
            '[data-testid="msg-container"]',
        ],

        /** Individual message rows */
        items: [
            '[data-testid="msg-container"]',
            '.message-in, .message-out',
            '[class*="message-"]',
        ],

        /** Message text content */
        text: [
            '[data-testid="msg-text"] span',
            '.selectable-text span',
            '[class*="copyable-text"] span',
        ],

        /** Timestamp inside message */
        timestamp: [
            '[data-testid="msg-meta"] span',
            '.copyable-text[data-pre-plain-text]',
            'span[dir="auto"][class*="tail"]',
        ],

        /** Attribute on a message bubble that marks outgoing messages */
        outgoingClass: 'message-out',

        /** Quoted message block */
        quoted: [
            '[data-testid="quoted-message"]',
            '.quoted-mention',
            '[class*="quoted"]',
        ],

        /** Media indicator elements */
        media: {
            image: [
                '[data-testid="media-url-preview-tall"]',
                '[data-testid="image-thumb"]',
                'img[src*="blob"]',
            ],
            video: [
                '[data-testid="video-thumb"]',
                '[data-testid="media-video"]',
            ],
            audio: [
                '[data-testid="audio-player"]',
                '[data-testid="ptt"]',
            ],
            document: [
                '[data-testid="document-thumb"]',
                '[data-testid="media-document"]',
            ],
            sticker: [
                '[data-testid="sticker"]',
                'img[class*="sticker"]',
            ],
        },

        /** Reaction emoji under a message */
        reactions: [
            '[data-testid="reaction-list"]',
            '[class*="reaction"]',
        ],

        /** Sender name (in group chats) */
        senderName: [
            '[data-testid="msg-meta"] .copyable-text ~ span',
            '._amk4 span',
            '[class*="author"]',
        ],

        /** Message ID attribute */
        idAttr: 'data-id',
    },

    // ──────────────────────────────────────────────────────────────────────────
    // Composer (message input area)
    // ──────────────────────────────────────────────────────────────────────────

    composer: {
        /** The main editable div where the user types */
        inputBox: [
            '[data-testid="conversation-compose-box-input"]',
            '#main footer div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"][data-tab="10"]',
            'footer div[contenteditable="true"]',
        ],

        /** Send button */
        sendButton: [
            '[data-testid="send"]',
            'button[data-testid="send"]',
            'span[data-testid="send"]',
            'button[aria-label="Send"]',
            '[data-icon="send"]',
        ],
    },

    // ──────────────────────────────────────────────────────────────────────────
    // Connection / Status
    // ──────────────────────────────────────────────────────────────────────────

    connection: {
        /** Header bar that shows offline/connecting/syncing banners */
        banner: [
            '[data-testid="banner"]',
            '#side header .zoWT4',
            '._aig-',
        ],

        /** Text inside the banner */
        bannerText: [
            '[data-testid="banner"] span',
            '._aig- span',
        ],

        /** Online status indicator (green dot) */
        onlineIndicator: [
            '[data-testid="online-indicator"]',
            '[aria-label="Online"]',
        ],
    },

    // ──────────────────────────────────────────────────────────────────────────
    // Chat open / Navigation
    // ──────────────────────────────────────────────────────────────────────────

    navigation: {
        /** The header of an open conversation showing the contact/group name */
        conversationHeader: [
            '#main header [data-testid="conversation-info-header"]',
            '#main header ._amig',
        ],

        /** Search box in the chat list header */
        searchBox: [
            '[data-testid="chat-list-search"]',
            'div[contenteditable="true"][data-tab="3"]',
        ],
    },
};

module.exports = SELECTORS;
