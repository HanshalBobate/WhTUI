/**
 * screen.js
 *
 * Blessed screen singleton.
 *
 * Imported by every TUI module that needs to reference the screen.
 * Created once — subsequent requires return the same instance.
 */

const blessed = require('blessed');
const { THEME } = require('./theme');

const screen = blessed.screen({
    smartCSR:    true,           // Efficient per-cell updates; enables 256-colour on Windows ConPTY
    fullUnicode: true,
    dockBorders: true,           // Merge adjacent borders cleanly
    terminal:    'xterm-256color',  // Force correct colour depth
    title:       'whtui — WhatsApp Terminal',
    cursor: {
        artificial: true,
        shape:      'block',
        blink:      true,
        color:      THEME.accent,
    },
    style: {
        bg: THEME.screen.bg,
    },
});

// Ctrl+C always exits
screen.key(['C-c'], () => process.exit(0));

module.exports = screen;
