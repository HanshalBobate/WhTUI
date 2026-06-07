/**
 * scraper.js
 *
 * DOM scraping functions that extract structured data from WhatsApp Web.
 *
 * All scraping runs inside page.evaluate() — the functions execute in the
 * browser context, where document/querySelector are available.
 *
 * Rules:
 *   - Never fabricate values
 *   - Use the ordered selector arrays from selectors.js
 *   - Log every selector failure for maintenance visibility
 *   - Return empty arrays / null on failure, never throw
 */

const SELECTORS = require('./selectors');
const { Chat }     = require('../models/chat');
const { Message }  = require('../models/message');
const log          = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Try each selector in list; return the first matching element, or null.
 * Runs in Node context — uses Playwright's page.$().
 *
 * @param {import('playwright').Page} page
 * @param {string[]} selList
 */
async function findEl(page, selList) {
    for (const sel of selList) {
        const el = await page.$(sel);
        if (el) return el;
    }
    return null;
}

/**
 * Try each selector in list; return all matching elements for the first
 * selector that returns at least one result.
 *
 * @param {import('playwright').Page} page
 * @param {string[]} selList
 */
async function findEls(page, selList) {
    for (const sel of selList) {
        const els = await page.$$(sel);
        if (els.length > 0) return els;
    }
    return [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scrape the full chat list from WhatsApp Web's left pane.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Chat[]>}
 */
async function scrapeChats(page) {
    try {
        const chats = await page.evaluate((SEL) => {
            function qs(root, sels) {
                for (const s of sels) {
                    const el = root.querySelector(s);
                    if (el) return el;
                }
                return null;
            }

            function qsText(root, sels) {
                const el = qs(root, sels);
                if (!el) return '';
                let text = '';
                const walk = (node) => {
                    if (node.nodeType === 3) text += node.textContent;
                    else if (node.nodeType === 1) {
                        if (node.tagName.toLowerCase() === 'img' && node.hasAttribute('alt')) {
                            text += node.getAttribute('alt');
                        } else {
                            for (const child of node.childNodes) walk(child);
                        }
                    }
                };
                walk(el);
                return text.trim();
            }

            function parseUnread(row) {
                const badge = row.querySelector('[data-testid="icon-unread-count"]');
                if (badge) {
                    const n = parseInt(badge.textContent.trim(), 10);
                    if (!Number.isNaN(n) && n > 0) return n;
                }
                const aria = row.getAttribute('aria-label') || '';
                const match = aria.match(/(\d+)\s+unread/i);
                if (match) return parseInt(match[1], 10);
                return 0;
            }

            function parseTitle(row, lastMessageStr = '', timeLabel = '') {
                let extractedText = '';

                // Try 1: Known title span
                const titleSpan = row.querySelector('span[dir="auto"][title]');
                if (titleSpan) {
                    extractedText = titleSpan.getAttribute('title') || titleSpan.textContent || '';
                }

                // Try 2: First dir="auto" span
                if (!extractedText) {
                    const dirSpans = Array.from(row.querySelectorAll('span[dir="auto"]'));
                    if (dirSpans.length > 0) {
                        extractedText = dirSpans[0].textContent || '';
                    }
                }

                // Try 3: cell-frame-title
                if (!extractedText) {
                    const titleFrame = row.querySelector('[data-testid="cell-frame-title"]');
                    if (titleFrame) {
                        extractedText = titleFrame.textContent || '';
                    }
                }

                // Try 4: Raw row text
                if (!extractedText) {
                    extractedText = row.innerText || row.textContent || '';
                }

                // FOOLPROOF STRIPPING
                // No matter how we got the text, if it's concatenated with the message or time,
                // we aggressively strip them out.
                extractedText = extractedText.replace(/\n/g, ' ').trim();

                if (lastMessageStr && extractedText.includes(lastMessageStr)) {
                    extractedText = extractedText.replace(lastMessageStr, '');
                }
                
                if (timeLabel && extractedText.includes(timeLabel)) {
                    extractedText = extractedText.replace(timeLabel, '');
                }

                // Also strip unread counts like "2 unread messages"
                extractedText = extractedText.replace(/\d+\s+unread messages?/i, '');

                extractedText = extractedText.trim();
                
                return extractedText || 'Unknown Chat';
            }

            function parseLastMessage(row) {
                const text = qsText(row, SEL.chatList.lastMessage);
                if (!text) return '';
                if (/unread message/i.test(text)) return '';
                return text;
            }

            let rows = [];
            for (const s of SEL.chatList.items) {
                rows = Array.from(document.querySelectorAll(s));
                if (rows.length > 0) break;
            }

            return rows.map((row, index) => {
                const lastMessage = parseLastMessage(row);
                const tsEl = qs(row, SEL.chatList.timestamp);
                const timeLabel = tsEl ? tsEl.textContent.trim() : '';
                
                const title = parseTitle(row, lastMessage, timeLabel);
                const unreadCount = parseUnread(row);
                const pinned = Boolean(qs(row, SEL.chatList.pinned));
                const muted  = Boolean(qs(row, SEL.chatList.muted));

                const dataId = row.getAttribute('data-id');
                const id = dataId
                    || (title ? `title:${title}` : `chat-${index}`);

                return {
                    id,
                    title,
                    unreadCount,
                    lastMessage,
                    lastTimestamp: 0,
                    timeLabel,
                    rowIndex: index,
                    pinned,
                    muted,
                    archived: false,
                };
            }).filter(c => c.title);
        }, SELECTORS);

        log.info(`scrapeChats: found ${chats.length} chats`);
        return chats.map(c => Chat.from(c));

    } catch (err) {
        log.error('scrapeChats failed', { error: err.message });
        return [];
    }
}

/**
 * Scrape the messages visible in the currently open conversation.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<Message[]>}
 */
async function scrapeMessages(page) {
    try {
        const msgs = await page.evaluate((SEL) => {
            function qs(root, sels) {
                for (const s of sels) {
                    const el = root.querySelector(s);
                    if (el) return el;
                }
                return null;
            }

            function qsText(root, sels) {
                const el = qs(root, sels);
                if (!el) return '';
                
                let text = '';
                const walk = (node) => {
                    if (node.nodeType === 3) { // TEXT_NODE
                        text += node.textContent;
                    } else if (node.nodeType === 1) { // ELEMENT_NODE
                        if (node.tagName.toLowerCase() === 'img' && node.hasAttribute('alt')) {
                            text += node.getAttribute('alt');
                        } else {
                            for (const child of node.childNodes) {
                                walk(child);
                            }
                        }
                    }
                };
                walk(el);
                return text.trim();
            }

            // Find message container
            let container = null;
            for (const s of SEL.messages.container) {
                container = document.querySelector(s);
                if (container) break;
            }
            if (!container) return [];

            // Find all message elements
            let rows = [];
            for (const s of SEL.messages.items) {
                rows = Array.from(container.querySelectorAll(s));
                if (rows.length > 0) break;
            }

            let lastValidTimestamp = Date.now();
            let lastIncomingSender = 'contact';

            return rows.map((row) => {
                // ID
                const id = row.getAttribute(SEL.messages.idAttr) || '';

                // Outgoing detection
                const outgoing = row.classList.contains(SEL.messages.outgoingClass)
                    || row.querySelector('.message-out') !== null;

                // Sender
                let sender = '';
                if (outgoing) {
                    sender = 'me';
                } else {
                    // Primary: data-pre-plain-text carries "[HH:MM, DD/MM/YYYY] Name: "
                    // This is the most reliable source for group sender names.
                    const ptEl = row.querySelector('[data-pre-plain-text]');
                    if (ptEl) {
                        const raw = ptEl.getAttribute('data-pre-plain-text') || '';
                        // Extract everything after the closing bracket up to the trailing colon
                        const nameMatch = raw.match(/\]\s*(.+):\s*$/);
                        if (nameMatch && nameMatch[1] && nameMatch[1].trim()) {
                            sender = nameMatch[1].trim();
                        }
                    }
                    // Fallback: DOM author element
                    if (!sender) {
                        const senderEl = qs(row, SEL.messages.senderName);
                        if (senderEl) sender = senderEl.textContent.trim();
                    }
                    
                    if (sender) {
                        lastIncomingSender = sender;
                    } else {
                        sender = lastIncomingSender;
                    }
                }

                // Text
                const text = qsText(row, SEL.messages.text);

                // Timestamp — WhatsApp embeds it in data-pre-plain-text attribute
                let timestamp = null;
                const copyableEl = row.querySelector('[data-pre-plain-text]');
                if (copyableEl) {
                    const raw = copyableEl.getAttribute('data-pre-plain-text') || '';
                    // Format: "[11:04 PM, 6/6/2026] Name: "
                    const match = raw.match(/\[([^,\]]+),\s*([^\]]+)\]/);
                    if (match) {
                        const [_, timeStr, dateStr] = match;
                        let dt = new Date(`${dateStr} ${timeStr}`);
                        if (isNaN(dt.getTime())) {
                            // Try swapping day/month if it failed (e.g. DD/MM/YYYY)
                            const parts = dateStr.split(/[\/\-\.]/);
                            if (parts.length === 3) {
                                dt = new Date(`${parts[1]}/${parts[0]}/${parts[2]} ${timeStr}`);
                            }
                        }
                        if (!isNaN(dt.getTime())) {
                            timestamp = dt.getTime();
                        }
                    }
                }
                
                if (!timestamp) {
                    // Try to parse the visible time from the DOM
                    const tsText = qsText(row, SEL.messages.timestamp);
                    if (tsText && lastValidTimestamp) {
                        const d = new Date(lastValidTimestamp);
                        const dateString = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                        let dt = new Date(`${dateString} ${tsText}`);
                        if (!isNaN(dt.getTime())) {
                            timestamp = dt.getTime();
                        }
                    }
                }

                if (!timestamp) {
                    timestamp = lastValidTimestamp;
                } else {
                    lastValidTimestamp = timestamp;
                }

                // Quoted message
                let quoted = null;
                const quotedEl = qs(row, SEL.messages.quoted);
                if (quotedEl) {
                    quoted = {
                        sender: quotedEl.querySelector('span[aria-label]')?.textContent?.trim() || '',
                        text:   quotedEl.querySelector('span')?.textContent?.trim() || '',
                    };
                }

                // Media detection
                let media = null;
                const mediaSels = SEL.messages.media;
                if (row.querySelector(mediaSels.image[0]) || row.querySelector(mediaSels.image[1]))
                    media = 'image';
                else if (row.querySelector(mediaSels.video[0]))
                    media = 'video';
                else if (row.querySelector(mediaSels.audio[0]) || row.querySelector(mediaSels.audio[1]))
                    media = 'audio';
                else if (row.querySelector(mediaSels.document[0]))
                    media = 'document';
                else if (row.querySelector(mediaSels.sticker[0]))
                    media = 'sticker';

                // Reactions
                const reactions = [];
                const rxEl = qs(row, SEL.messages.reactions);
                if (rxEl) {
                    rxEl.querySelectorAll('span').forEach(span => {
                        const t = span.textContent.trim();
                        if (t) reactions.push({ emoji: t, count: 1 });
                    });
                }

                return { id, sender, text, timestamp, outgoing, quoted, media, reactions };
            });
        }, SELECTORS);

        log.debug(`scrapeMessages: found ${msgs.length} messages`);
        return msgs.map(m => Message.from(m));

    } catch (err) {
        log.error('scrapeMessages failed', { error: err.message });
        return [];
    }
}

/**
 * Scrape the current connection status from WhatsApp Web.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<'ONLINE'|'OFFLINE'|'CONNECTING'|'SYNCING'>}
 */
async function scrapeConnectionStatus(page) {
    try {
        const status = await page.evaluate((SEL) => {
            // Check for banner text (shown during OFFLINE / CONNECTING / SYNCING)
            let bannerText = '';
            for (const s of SEL.connection.bannerText) {
                const el = document.querySelector(s);
                if (el) { bannerText = el.textContent.trim().toLowerCase(); break; }
            }

            if (bannerText.includes('connecting')) return 'CONNECTING';
            if (bannerText.includes('offline'))    return 'OFFLINE';
            if (bannerText.includes('syncing'))    return 'SYNCING';

            // No banner = online
            return 'ONLINE';
        }, SELECTORS);

        return status;
    } catch (err) {
        log.warn('scrapeConnectionStatus failed', { error: err.message });
        return 'CONNECTING';
    }
}

/**
 * Click a chat row in the DOM to open it.
 * Tries clicking by title match, then by index.
 *
 * @param {import('playwright').Page} page
 * @param {string} chatId       The id stored in the Chat model
 * @param {string} chatTitle    Fallback: the chat title text
 */
async function openChat(page, chatId, chatTitle, rowIndex = -1) {
    try {
        if (rowIndex >= 0) {
            const rows = await findEls(page, SELECTORS.chatList.items);
            if (rows[rowIndex]) {
                await rows[rowIndex].click();
                log.info(`openChat: clicked row index ${rowIndex} "${chatTitle}"`);
                await page.waitForTimeout(600);
                return;
            }
        }

        const byId = await page.$(`[data-id="${chatId}"]`);
        if (byId) {
            await byId.click();
            log.info(`openChat: clicked by data-id "${chatId}"`);
            await page.waitForTimeout(600);
            return;
        }

        const byLabel = await page.$(`[aria-label="${chatTitle}"]`);
        if (byLabel) {
            await byLabel.click();
            log.info(`openChat: clicked by aria-label "${chatTitle}"`);
            await page.waitForTimeout(600);
            return;
        }

        const rows = await findEls(page, SELECTORS.chatList.items);
        for (const row of rows) {
            const titleEl = await row.$(SELECTORS.chatList.title[0]);
            if (titleEl) {
                const t = await titleEl.getAttribute('title')
                       || await titleEl.textContent();
                if (t && t.trim() === chatTitle.trim()) {
                    await row.click();
                    log.info(`openChat: clicked by title scan "${chatTitle}"`);
                    await page.waitForTimeout(600);
                    return;
                }
            }
        }

        log.warn(`openChat: could not find chat "${chatTitle}" (${chatId})`);

    } catch (err) {
        log.error('openChat failed', { error: err.message, chatId });
    }
}

/**
 * Find the first matching selector string on the page.
 */
async function findSelector(page, selList) {
    for (const sel of selList) {
        const el = await page.$(sel);
        if (el && await el.isVisible().catch(() => false)) return sel;
    }
    for (const sel of selList) {
        const el = await page.$(sel);
        if (el) return sel;
    }
    return null;
}

/**
 * Type and send a message in the currently open conversation.
 */
async function sendMessage(page, text) {
    try {
        const inputSel = await findSelector(page, SELECTORS.composer.inputBox);
        if (!inputSel) {
            log.error('sendMessage: composer input not found');
            return false;
        }

        await page.click(inputSel);
        await page.waitForTimeout(150);

        const typed = await page.evaluate(({ selector, message }) => {
            const el = document.querySelector(selector);
            if (!el) return false;
            el.focus();

            if (document.execCommand) {
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, message);
            } else {
                el.textContent = message;
            }

            el.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: message,
            }));
            return (el.textContent || el.innerText || '').includes(message.slice(0, 8));
        }, { selector: inputSel, message: text });

        if (!typed) {
            await page.keyboard.press('Control+A');
            await page.keyboard.type(text, { delay: 15 });
        }

        await page.waitForTimeout(100);

        for (const sel of SELECTORS.composer.sendButton) {
            const btn = await page.$(sel);
            if (btn && await btn.isVisible().catch(() => false)) {
                await btn.click();
                log.info(`sendMessage: clicked send button (${sel})`);
                await page.waitForTimeout(300);
                return true;
            }
        }

        await page.keyboard.press('Enter');
        log.info(`sendMessage: sent via Enter "${text.slice(0, 40)}${text.length > 40 ? '…' : ''}"`);
        await page.waitForTimeout(300);
        return true;

    } catch (err) {
        log.error('sendMessage failed', { error: err.message });
        return false;
    }
}

module.exports = {
    scrapeChats,
    scrapeMessages,
    scrapeConnectionStatus,
    openChat,
    sendMessage,
};
