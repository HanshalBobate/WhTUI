/**
 * formatters.js
 *
 * Display formatting utilities for the TUI.
 */

'use strict';

/**
 * Strip blessed color tags when measuring visible width.
 */
function stripTags(str) {
    if (!str) return '';
    return str.replace(/\{[^}]+\}/g, '');
}

/**
 * Strip the WhatsApp domain suffix from a chat/sender ID.
 */
function formatSender(id) {
    if (!id) return '';
    return id.split('@')[0];
}

/**
 * Format an unread count for display in the chat list.
 */
function formatUnread(count) {
    if (!count || count <= 0) return '';
    if (count > 99) return '99+';
    return String(count);
}

function formatMediaType(mediaType) {
    if (!mediaType) return '';
    const labels = {
        image:    '[IMG]',
        video:    '[VID]',
        audio:    '[AUD]',
        document: '[DOC]',
        sticker:  '[STK]',
    };
    return labels[mediaType.toLowerCase()] || `[${mediaType.toUpperCase()}]`;
}

/**
 * Truncate to `len` visible characters (strips tags before measuring).
 */
function truncate(str, len) {
    if (!str) return '';
    const clean = stripTags(str);
    if (clean.length <= len) return clean;
    return clean.slice(0, Math.max(1, len - 1)) + '…';
}

/**
 * Clean a raw chat title scraped from WhatsApp Web.
 *
 * WhatsApp's DOM can include subtitle text (last message preview) inside the
 * same element as the contact name when the scraper falls back to textContent.
 * We strip everything after the first newline and collapse whitespace so that
 * the chat list shows NAME ONLY.
 *
 * @param {string} raw
 * @returns {string}
 */
function cleanTitle(raw) {
    if (!raw) return '';
    // Take only the first line
    const firstLine = raw.split(/[\r\n]/)[0];
    // Collapse runs of whitespace
    return firstLine.replace(/\s+/g, ' ').trim();
}

/**
 * Plain-text chat row — no blessed tags (list widget uses tags:false).
 *
 * Layout (selected):   "▸ ●2  Contact Name       12:30"
 * Layout (normal):     "    Contact Name          12:30"
 *
 * Shows NAME ONLY — no message preview text.
 *
 * @param {object}  chat        Chat model
 * @param {number}  totalWidth  Inner width of the chat list panel
 * @param {boolean} [isSelected=false]  Whether this row is the cursor row
 */
function formatChatRow(chat, totalWidth, isSelected = false) {
    const cursor = isSelected ? '\u25b8 ' : '  ';          // ▸ or spaces
    const time   = chat.timeLabel || '';
    const unread = chat.unreadCount > 0;
    const prefix = unread
        ? `\u25cf${formatUnread(chat.unreadCount)} `        // ●N
        : '   ';

    // Name only — cleanTitle removes any embedded last-message text
    const rawTitle  = cleanTitle(chat.title || 'Unknown');
    const available = Math.max(4, totalWidth - cursor.length - prefix.length - time.length - 1);
    const title     = truncate(rawTitle, available);

    const body = `${cursor}${prefix}${title}`;
    const pad  = Math.max(0, totalWidth - body.length - time.length);
    return `${body}${' '.repeat(pad)}${time}`;
}

/**
 * Format a single message for display in the message pane (blessed-tagged).
 */
function formatMessage(msg, showSender = true) {
    const { clockTime } = require('./time');

    const lines = [];

    if (showSender) {
        const senderLabel = msg.outgoing
            ? '{cyan-fg}You{/cyan-fg}'
            : `{green-fg}${formatSender(msg.sender)}{/green-fg}`;
        const ts = clockTime(msg.timestamp);
        lines.push(`${senderLabel}  {grey-fg}${ts}{/grey-fg}`);
    }

    if (msg.quoted) {
        const qSender = formatSender(msg.quoted.sender || '');
        const qText   = truncate(msg.quoted.text || '', 60);
        lines.push(`{grey-fg}│ ${qSender}: ${qText}{/grey-fg}`);
    }

    const mediaLabel = msg.media ? `{grey-fg}${formatMediaType(msg.media)}{/grey-fg}` : '';
    const body = msg.text || mediaLabel || '{grey-fg}[message]{/grey-fg}';
    lines.push(body);

    if (msg.reactions && msg.reactions.length > 0) {
        const rxStr = msg.reactions
            .map(r => `${r.emoji}${r.count > 1 ? r.count : ''}`)
            .join(' ');
        lines.push(`{grey-fg}${rxStr}{/grey-fg}`);
    }

    return lines.join('\n');
}

module.exports = {
    stripTags,
    formatSender,
    formatUnread,
    formatMediaType,
    truncate,
    cleanTitle,
    formatChatRow,
    formatMessage,
};
