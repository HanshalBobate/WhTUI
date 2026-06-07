/**
 * commandbar.js
 *
 * Vim-style command input handler.
 *
 * Handles the ':' command mode input, parsing, and execution.
 *
 * Supported commands:
 *   :q  / :quit        → exit the application
 *   :qa / :quitall     → exit the application (alias)
 *   :search <term>     → set search query
 *   :open <title>      → open chat by title
 *   :clear             → clear current search
 *   :reload            → force re-scrape chat list
 *   :help              → show keybindings in the message box
 */

const screen    = require('./screen');
const { commandBar, reapplyTheme } = require('./layout');
const actions   = require('../state/actions');
const log       = require('../utils/logger');
const { setTheme, getAvailableThemes } = require('./theme');

/** Map of registered command handlers: command-name → async handler(args) */
const COMMANDS = {};

/**
 * Register a command handler.
 *
 * @param {string}   name     The command name (without ':')
 * @param {Function} handler  async (args: string) => void
 */
function registerCommand(name, handler) {
    COMMANDS[name] = handler;
}

/**
 * Execute a raw command string (without the leading ':').
 *
 * @param {string}   raw       e.g. 'q' or 'search hello'
 * @param {object}   context   { reloadChats: Function }
 */
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
                _showError(`Available themes: ${getAvailableThemes().join(', ')}`);
            } else {
                if (setTheme(args)) {
                    reapplyTheme();
                    screen.render();
                } else {
                    _showError(`Unknown theme: ${args}`);
                }
            }
            break;

        default:
            log.warn(`Unknown command: :${cmd}`);
            _showError(`Unknown command: :${cmd}`);
    }
}

function _showError(msg) {
    commandBar.show();
    commandBar.setContent(`{red-fg}Error: ${msg}{/red-fg}`);
    screen.render();
    setTimeout(() => {
        commandBar.hide();
        screen.render();
    }, 2000);
}

module.exports = { executeCommand, registerCommand };
