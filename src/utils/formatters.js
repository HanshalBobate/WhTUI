/**
 * formatters.js
 *
 * Display formatting utilities for the TUI.
 */

'use strict';

const nodeEmoji = require('node-emoji');

/**
 * Convert all emoji characters in a string to :shortcode: form.
 * e.g. "RBU Shreyank 🥀" → "RBU Shreyank :wilted_flower:"
 * This avoids terminal wide-char width miscount that causes ghost chars and misalignment.
 *
 * @param {string} str
 * @returns {string}
 */
function deEmoji(str) {
    if (!str) return '';
    return nodeEmoji.unemojify(str);
}

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
    if (!id) return 'Unknown';
    const raw = id.split('@')[0];
    return deEmoji(raw);
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
 * Hard-wrap a single tagged line at `maxWidth` visible characters.
 * Returns an array of lines. Preserves leading whitespace indent on continuation lines.
 * Tags (e.g. {green-fg}) are invisible and not counted toward width.
 *
 * @param {string} line      Raw line, may contain blessed tags
 * @param {number} maxWidth  Max visible character width
 * @param {number} [indent=0] Number of spaces to prefix continuation lines
 * @returns {string[]}  One or more lines, each within maxWidth visible chars
 */
function wrapLine(line, maxWidth, indent = 0) {
    if (!line) return [''];
    if (maxWidth <= 0) return [line];

    const indentStr = ' '.repeat(indent);
    const firstMax  = maxWidth;
    const contMax   = maxWidth - indent;

    // Split into tokens: either a {tag} or a run of visible chars
    const tokens = [];
    const tokenRe = /\{[^}]+\}|./gsu;
    let m;
    while ((m = tokenRe.exec(line)) !== null) tokens.push(m[0]);

    const result = [];
    let current   = '';
    let visLen    = 0;
    let lineMax   = firstMax;
    let isFirst   = true;

    for (const tok of tokens) {
        const isTag  = tok.startsWith('{') && tok.endsWith('}');
        // tok.length (UTF-16 units) = 2 for BMP emoji → matches 2 terminal columns.
        // [...tok].length (code points) = 1 for emoji → UNDERCOUNTS terminal width.
        const tokLen = isTag ? 0 : tok.length;

        if (!isTag && visLen + tokLen > lineMax) {
            // Flush current line
            result.push(current);
            current  = (isFirst ? '' : indentStr);
            visLen   = isFirst ? 0 : indent;
            lineMax  = contMax;
            isFirst  = false;
        }
        current += tok;
        if (!isTag) visLen += tokLen;
    }
    if (current) result.push(current);
    return result.length ? result : [''];
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
    return deEmoji(firstLine.replace(/\s+/g, ' ').trim());
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
        const qText   = truncate(deEmoji(msg.quoted.text || ''), 60);
        lines.push(`{grey-fg}│ ${qSender}: ${qText}{/grey-fg}`);
    }

    const mediaLabel = msg.media ? `{grey-fg}${formatMediaType(msg.media)}{/grey-fg}` : '';
    const body = deEmoji(msg.text || '') || mediaLabel || '';
    if (body) lines.push(body);

    if (msg.reactions && msg.reactions.length > 0) {
        const rxStr = msg.reactions
            .map(r => `${deEmoji(r.emoji)}${r.count > 1 ? r.count : ''}`)
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
        text = deEmoji(msg.text || '');
    }

    let rx = '';
    if (msg.reactions && msg.reactions.length > 0) {
        rx = '  ' + msg.reactions.map(r => `${deEmoji(r.emoji)}${r.count > 1 ? r.count : ''}`).join(' ');
    }

    if (!text && !rx) return '';
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
function formatGroupedMessages(msgs, panelWidth) {
    const { clockTime } = require('./time');
    // Leave a 2-column safety margin for any emoji width edge cases
    const maxW = (panelWidth && panelWidth > 6) ? panelWidth - 4 : 76;
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
            const qText   = truncate(deEmoji(msg.quoted.text || ''), 60);
            lines.push(...wrapLine(`  {grey-fg}│ ${qSender}: ${qText}{/grey-fg}`, maxW, 4));
        }

        // Message body — sanitize newlines so they don't break line accounting
        const ts = clockTime(msg.timestamp);
        let body = '';
        if (msg.media) {
            body = `{grey-fg}${formatMediaType(msg.media)}{/grey-fg}`;
        } else {
            body = deEmoji((msg.text || '').replace(/\r?\n/g, ' '));
        }

        // Reactions inline
        let rx = '';
        if (msg.reactions && msg.reactions.length > 0) {
            rx = '  ' + msg.reactions.map(r => `${deEmoji(r.emoji)}${r.count > 1 ? r.count : ''}`).join(' ');
        }

        if (body || rx) {
            // Prefix first line with timestamp, continuation lines indented
            const tsPrefix = `  {grey-fg}${ts}{/grey-fg} `;
            const tsPrefixLen = 2 + ts.length + 1; // '  ' + ts + ' '
            const fullLine = `${tsPrefix}${body}${rx}`;
            lines.push(...wrapLine(fullLine, maxW, tsPrefixLen));
        } else if (msg.quoted) {
            lines.push(`  {grey-fg}${ts}{/grey-fg}`);
        }
    }

    return lines;
}

module.exports = {
    deEmoji,
    stripTags,
    formatSender,
    formatUnread,
    formatMediaType,
    truncate,
    wrapLine,
    cleanTitle,
    formatChatRow,
    formatMessage,
    formatMessageCompact,
    formatGroupedMessages,
    formatTimeAgo,
};
