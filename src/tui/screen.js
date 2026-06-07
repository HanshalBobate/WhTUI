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
    smartCSR:    false,          // Disable CSR scrolling — prevents ghost chars on fast scroll
    useBCE:      true,           // Use Background Color Erase to properly clear cells
    fullUnicode: true,
    dockBorders: true,
    terminal:    'xterm-256color',
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
