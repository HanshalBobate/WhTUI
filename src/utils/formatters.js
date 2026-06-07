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
 * @param {string} raw
 * @returns {string}
 */
function cleanTitle(raw) {
    if (!raw) return '';
    const firstLine = raw.split(/[\r\n]/)[0];
    return firstLine.replace(/\s+/g, ' ').trim();
}

/**
 * Format a timestamp as a human-readable relative time string.
 * Used in the chat list for "last activity".
 *
 * @param {number} timestamp  Unix epoch ms, or 0/null
 * @returns {string}  e.g. "2m", "1h", "3d", "now"
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const now   = Date.now();
    const diff  = now - timestamp;
    const sec   = Math.floor(diff / 1000);
    const min   = Math.floor(sec / 60);
    const hr    = Math.floor(min / 60);
    const day   = Math.floor(hr / 24);
    const week  = Math.floor(day / 7);

    if (sec < 60)    return 'now';
    if (min < 60)    return `${min}m`;
    if (hr  < 24)    return `${hr}h`;
    if (day < 7)     return `${day}d`;
    if (week < 5)    return `${week}w`;
    return `${Math.floor(day / 30)}mo`;
}

/**
 * Plain-text chat row — no blessed tags (list widget uses tags:false).
 *
 * Layout:
 *   ▸ ⊗ ⊕ Contact Name         2m  ●4
 *
 *   ▸  = cursor (selected)
 *   ⊗  = muted
 *   ⊕  = pinned
 *   ●4 = unread count badge
 *
 * @param {object}  chat        Chat model
 * @param {number}  totalWidth  Inner width of the chat list panel
 * @param {boolean} [isSelected=false]
 */
function formatChatRow(chat, totalWidth, isSelected = false) {
    const cursor  = isSelected ? '▸ ' : '  ';
    const timeStr = formatTimeAgo(chat.lastTimestamp) || chat.timeLabel || '';
    const unread  = chat.unreadCount > 0;

    // Indicators (mute/pin) — shown after cursor, before name
    let indicators = '';
    if (chat.pinned) indicators += '⊕';
    if (chat.muted)  indicators += '⊗';
    if (indicators)  indicators += ' ';

    // Unread badge — right-side suffix
    const badge = unread ? `●${formatUnread(chat.unreadCount)}` : '';

    // Available width for name:
    //   totalWidth - cursor - indicators - space before time - time - space - badge
    const rightW  = (timeStr ? timeStr.length + 1 : 0) + (badge ? badge.length + 1 : 0);
    const leftW   = cursor.length + indicators.length;
    const nameW   = Math.max(4, totalWidth - leftW - rightW - 1);
    const rawTitle = cleanTitle(chat.title || 'Unknown');
    const name    = truncate(rawTitle, nameW);

    // Calculate exact padding needed to push `right` to the right edge
    const right   = [timeStr, badge].filter(Boolean).join('  ');
    
    // totalWidth - leftWidth - name.length - right.length
    const padCount = Math.max(1, totalWidth - leftW - name.length - right.length);
    const pad      = ' '.repeat(padCount);

    return `${cursor}${indicators}${name}${pad}${right}`;
}

/**
 * Format a single message for display in the message pane (blessed-tagged).
 * Used in compact mode (one line per message).
 *
 * @param {object} msg
 * @param {boolean} [showSender=true]
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

/**
 * Format a single message in compact single-line style.
 *
 * Output: "10:32 Mom > where are you"
 *         "10:33 You > home  👍"
 *
 * @param {object} msg
 * @returns {string}  A single blessed-tagged line
 */
function formatMessageCompact(msg) {
    const { clockTime } = require('./time');
    const ts     = clockTime(msg.timestamp);
    const sender = msg.outgoing
        ? '{cyan-fg}You{/cyan-fg}'
        : `{green-fg}${formatSender(msg.sender)}{/green-fg}`;

    let text = '';
    if (msg.media) {
        text = `{grey-fg}${formatMediaType(msg.media)}{/grey-fg}`;
    } else {
        text = msg.text || '{grey-fg}[message]{/grey-fg}';
    }

    let rx = '';
    if (msg.reactions && msg.reactions.length > 0) {
        rx = '  ' + msg.reactions.map(r => `${r.emoji}${r.count > 1 ? r.count : ''}`).join(' ');
    }

    return `{grey-fg}${ts}{/grey-fg} ${sender} {grey-fg}›{/grey-fg} ${text}${rx}`;
}

/**
 * Build grouped-sender message blocks for the message pane.
 *
 * When consecutive messages come from the same sender, only one sender
 * header is shown. Subsequent messages in the same run are indented and
 * prefixed with their timestamp only.
 *
 * Output format:
 *   {green-fg}Mom{/green-fg}
 *     {grey-fg}10:32{/grey-fg} hello
 *     {grey-fg}10:33{/grey-fg} how are you
 *   {cyan-fg}You{/cyan-fg}
 *     {grey-fg}10:34{/grey-fg} ok
 *
 * @param {object[]} msgs
 * @returns {string[]}  Array of blessed-tagged lines
 */
function formatGroupedMessages(msgs) {
    const { clockTime } = require('./time');
    const lines = [];
    let lastSender = null;

    for (const msg of msgs) {
        const senderKey = msg.outgoing ? '__me__' : (msg.sender || 'contact');

        if (senderKey !== lastSender) {
            // New sender group — emit header
            if (lines.length > 0) lines.push('');
            const label = msg.outgoing
                ? '{cyan-fg}You{/cyan-fg}'
                : `{green-fg}${formatSender(msg.sender)}{/green-fg}`;
            lines.push(label);
            lastSender = senderKey;
        }

        // Quoted block
        if (msg.quoted) {
            const qSender = formatSender(msg.quoted.sender || '');
            const qText   = truncate(msg.quoted.text || '', 60);
            lines.push(`  {grey-fg}│ ${qSender}: ${qText}{/grey-fg}`);
        }

        // Message body
        const ts = clockTime(msg.timestamp);
        let body = '';
        if (msg.media) {
            body = `{grey-fg}${formatMediaType(msg.media)}{/grey-fg}`;
        } else {
            body = msg.text || '{grey-fg}[message]{/grey-fg}';
        }

        // Reactions inline
        let rx = '';
        if (msg.reactions && msg.reactions.length > 0) {
            rx = '  ' + msg.reactions.map(r => `${r.emoji}${r.count > 1 ? r.count : ''}`).join(' ');
        }

        lines.push(`  {grey-fg}${ts}{/grey-fg} ${body}${rx}`);
    }

    return lines;
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
    formatMessageCompact,
    formatGroupedMessages,
    formatTimeAgo,
};
