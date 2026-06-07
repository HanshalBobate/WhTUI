/**
 * helpContent.js  —  WHTUI V2
 *
 * Welcome screen, help text, and contextual hint strings for the status bar.
 */

function getHelpText() {
    return [
        '{bold}{green-fg}whtui v2 — keyboard reference{/green-fg}{/bold}',
        '',
        '{bold}Navigation (Chat List){/bold}',
        '  j / k / ↑ / ↓       Move selection up/down',
        '  gg                   Jump to first chat',
        '  G                    Jump to last chat',
        '  Ctrl-d / Ctrl-u      Jump ¼ list down / up',
        '  Enter                Open highlighted chat',
        '  Space                Preview chat (popup)',
        '',
        '{bold}Messages (Chat View){/bold}',
        '  j / k                Scroll messages 3 lines',
        '  J / K                Scroll messages 3 lines (always)',
        '  Ctrl-d / Ctrl-u      Scroll half page',
        '  Ctrl-f / Ctrl-b      Scroll full page',
        '  gg / G               Jump to top / bottom',
        '  i                    Compose reply (INSERT mode)',
        '  r                    Refresh messages',
        '  Esc / Z              Close chat → chat list',
        '',
        '{bold}Insert Mode{/bold}',
        '  Enter / Ctrl-s       Send message',
        '  Esc                  Cancel',
        '',
        '{bold}Search{/bold}',
        '  /                    Start live search',
        '  n / N                Next / prev result',
        '  Enter                Open top result',
        '  Esc                  Clear search',
        '',
        '{bold}Commands (:){/bold}',
        '  :reload              Refresh chat list',
        '  :refresh             Refresh open chat messages',
        '  :open <name>         Open chat by name',
        '  :search <term>       Search chats',
        '  :unread              Show unread chats only',
        '  :pinned              Show pinned chats only',
        '  :groups              Show groups only',
        '  :all                 Show all chats (clear filter)',
        '  :compact             Toggle compact message style',
        '  :split               Toggle split view',
        '  :theme <name>        Switch color theme',
        '  :logout              Logout and wipe session',
        '  :q                   Quit',
        '',
        '{bold}Layout{/bold}',
        '  Ctrl-W               Toggle 30/70 split view',
        '  Tab / Shift-Tab      Cycle pane focus (split mode)',
        '  Ctrl-L               Force redraw',
        '',
        '{bold}Themes:{/bold} catppuccin · tokyonight · dracula · gruvbox · nord',
        '',
        '{grey-fg}Press Esc or Enter to close help{/grey-fg}',
    ].join('\n');
}

/**
 * Short hints shown in the status bar for the current mode.
 *
 * @param {import('../state/state')} s
 * @returns {string}
 */
function getContextHints(s) {
    if (s.isLoading) return '';  // Spinner label shown in pill instead

    switch (s.mode) {
        case 'insert':
            return 'Enter send  Esc cancel';
        case 'search':
            return 'type to filter  n/N cycle  Enter open  Esc clear';
        case 'command':
            return 'Enter run  Esc cancel';
        default:
            if (s.showHelpPanel) return 'Esc close help';

            if (s.viewMode === 'chat-view' || (s.viewMode === 'split' && s.currentChatId)) {
                return 'j/k scroll  i reply  r refresh  Z close  / search  ? help';
            }

            if (s.viewMode === 'split') {
                return 'Tab focus  j/k nav  Enter open  Space preview  Ctrl-W unsplit';
            }

            return 'j/k nav  Enter open  Space preview  / search  : cmd  ? help  q quit';
    }
}

module.exports = {
    getHelpText,
    getContextHints,
};
