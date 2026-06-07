/**
 * commandbar.js  —  WHTUI V2
 *
 * Vim-style command input handler.
 *
 * Supported commands:
 *   :q  / :quit        → exit the application
 *   :qa / :quitall     → exit the application (alias)
 *   :search <term>     → set search query
 *   :open <title>      → open chat by title
 *   :clear             → clear current search/filter
 *   :reload            → force re-scrape chat list
 *   :refresh           → refresh open chat messages
 *   :help              → show keybindings
 *   :logout            → logout and wipe session
 *   :theme <name>      → switch color theme
 *
 *   V2 commands:
 *   :unread            → filter chat list to unread only
 *   :pinned            → filter chat list to pinned only
 *   :groups            → filter chat list to groups only
 *   :all               → clear filter (show all chats)
 *   :compact           → toggle compact message rendering
 *   :split             → toggle split view (alias for Ctrl+W)
 */

const screen    = require('./screen');
const { commandBar, reapplyTheme } = require('./layout');
const actions   = require('../state/actions');
const state     = require('../state/state');
const log       = require('../utils/logger');
const { setTheme, getAvailableThemes } = require('./theme');

async function executeCommand(raw, context) {
    const trimmed = raw.trim();
    const [cmd, ...argParts] = trimmed.split(/\s+/);
    const args = argParts.join(' ');

    log.info(`executeCommand: :${trimmed}`);

    switch (cmd) {
        case 'q':
        case 'quit':
        case 'qa':
        case 'quitall':
            process.exit(0);
            break;

        case 'search':
            actions.setMode('search');
            actions.setSearchQuery(args);
            break;

        case 'clear':
            actions.setSearchQuery('');
            actions.setFilterMode('all');
            actions.setMode('normal');
            break;

        case 'reload':
            if (context && context.reloadChats) {
                await context.reloadChats();
            }
            break;

        case 'refresh':
            if (context && context.refreshMessages) {
                await context.refreshMessages();
            }
            break;

        case 'open':
            if (context && context.openChatByTitle) {
                await context.openChatByTitle(args);
            }
            break;

        case 'help':
            actions.setShowHelp(true);
            break;

        case 'logout':
            if (context && context.logout) {
                await context.logout();
            }
            break;

        case 'theme':
            if (!args) {
                _showMsg(`Available themes: ${getAvailableThemes().join(', ')}`);
            } else {
                if (setTheme(args)) {
                    reapplyTheme();
                    screen.render();
                } else {
                    _showError(`Unknown theme: ${args}`);
                }
            }
            break;

        // ── V2 filter commands ─────────────────────────────────────────────

        case 'unread':
            actions.setFilterMode('unread');
            _showMsg(`Showing unread chats (${state.filteredChats.length})`);
            break;

        case 'pinned':
            actions.setFilterMode('pinned');
            _showMsg(`Showing pinned chats (${state.filteredChats.length})`);
            break;

        case 'groups':
            actions.setFilterMode('groups');
            _showMsg(`Showing groups (${state.filteredChats.length})`);
            break;

        case 'all':
            actions.setFilterMode('all');
            actions.setSearchQuery('');
            break;

        // ── V2 rendering commands ──────────────────────────────────────────

        case 'compact':
            actions.setCompactMessages();  // toggle
            _showMsg(state.compactMessages ? 'Compact mode ON' : 'Compact mode OFF');
            break;

        case 'split':
            actions.setSplitView();  // toggle
            _showMsg(state.splitView ? 'Split view ON' : 'Split view OFF');
            break;

        default:
            log.warn(`Unknown command: :${cmd}`);
            _showError(`Unknown command: :${cmd}`);
    }
}

function _showError(msg) {
    commandBar.show();
    commandBar.setContent(`{red-fg}${msg}{/red-fg}`);
    screen.render();
    setTimeout(() => {
        commandBar.hide();
        screen.render();
    }, 2000);
}

function _showMsg(msg) {
    commandBar.show();
    commandBar.setContent(`{grey-fg}${msg}{/grey-fg}`);
    screen.render();
    setTimeout(() => {
        commandBar.hide();
        screen.render();
    }, 1500);
}

module.exports = { executeCommand };
