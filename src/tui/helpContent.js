/**
 * helpContent.js
 *
 * Welcome screen, help text, and contextual hint strings for the status bar.
 */

function getWelcomeText(chatCount) {
    return [
        '{bold}{green-fg}Welcome to whtui{/green-fg}{/bold}',
        '',
        '{grey-fg}A keyboard-driven WhatsApp client in your terminal.{/grey-fg}',
        '',
        `{bold}You have ${chatCount} chat${chatCount === 1 ? '' : 's'} loaded.{/bold}`,
        '',
        '{bold}Quick start{/bold}',
        '  1. Use j/k or arrows to highlight a chat',
        '  2. Press Enter to open it',
        '  3. Press i to compose, type your message, press Enter to send',
        '',
        '{bold}Useful keys{/bold}',
        '  {cyan-fg}/{cyan-fg}  search chats    {cyan-fg}?{/cyan-fg}  full help    {cyan-fg}q{/cyan-fg}  quit',
        '',
        '{grey-fg}Press ? anytime for the full key reference.{/grey-fg}',
    ].join('\n');
}

function getHelpText() {
    return [
        '{bold}{green-fg}whtui — keyboard reference{/green-fg}{/bold}',
        '',
        '{bold}Chat list (Normal mode){/bold}',
        '  j / k / ↑ / ↓     Move selection',
        '  Enter             Open highlighted chat',
        '  gg                Jump to first chat',
        '  G                 Jump to last chat',
        '  Ctrl+d / Ctrl+u   Scroll chat list faster',
        '',
        '{bold}Messages (Normal mode){/bold}',
        '  J / K             Scroll message pane',
        '  i                 Compose a reply (Insert mode)',
        '',
        '{bold}Insert mode (after pressing i){/bold}',
        '  Enter             Send message',
        '  Ctrl+Enter        Send message (alternate)',
        '  Esc               Cancel and go back',
        '',
        '{bold}Search{/bold}',
        '  /                 Start search, then type a name',
        '  Enter             Open first match',
        '  Esc               Clear search',
        '',
        '{bold}Commands{/bold}',
        '  :reload           Refresh chat list',
        '  :refresh          Refresh open chat messages',
        '  :open <name>      Open chat by name',
        '  :search <term>    Search chats',
        '  :help             Show this screen',
        '  :q                Quit',
        '',
        '{bold}Other{/bold}',
        '  ?                 Show this help',
        '  q                 Quit',
        '',
        '{grey-fg}Press Esc to close help{/grey-fg}',
    ].join('\n');
}

/**
 * Short hints shown in the status bar for the current mode.
 *
 * @param {import('../state/state')} s
 * @returns {string}
 */
function getContextHints(s) {
    if (s.isLoading) return s.loadingText || 'Starting...';

    switch (s.mode) {
        case 'insert':
            return 'Enter send · Esc cancel';
        case 'search':
            return 'type to filter · Enter open · Esc clear';
        case 'command':
            return 'Enter run · Esc cancel';
        default:
            if (s.showHelpPanel) return 'Esc close help';
            if (s.currentChatId) {
                return 'j/k select · Enter open · i reply · J/K scroll · / search · ? help';
            }
            return 'j/k select · Enter open · / search · ? help · q quit';
    }
}

function getChatPreview(chat) {
    if (!chat) {
        return '\n{center}{grey-fg}No chats loaded{/grey-fg}{/center}';
    }

    const lastMsg = chat.lastMessage
        ? chat.lastMessage
        : '{grey-fg}(no preview){/grey-fg}';

    return [
        '',
        `{bold}{green-fg}${chat.title}{/green-fg}{/bold}`,
        chat.unreadCount > 0
            ? `{green-fg}${chat.unreadCount} unread message${chat.unreadCount === 1 ? '' : 's'}{/green-fg}`
            : '{grey-fg}Up to date{/grey-fg}',
        '',
        '{grey-fg}Last message:{/grey-fg}',
        lastMsg,
        '',
        '{center}{cyan-fg}Press Enter to open this chat{/cyan-fg}{/center}',
        '{center}{grey-fg}Press ? for keyboard help{/grey-fg}{/center}',
    ].join('\n');
}

module.exports = {
    getWelcomeText,
    getHelpText,
    getContextHints,
    getChatPreview,
};
