/**
 * theme.js
 *
 * LazyNvim-inspired Catppuccin Mocha dark theme for WHTUI.
 *
 * Palette: Catppuccin Mocha
 *   https://github.com/catppuccin/catppuccin
 */

const { themes, buildTheme } = require('./themes');
const log = require('../utils/logger');

// Start with Catppuccin
const THEME = buildTheme(themes.catppuccin);

function setTheme(name) {
    if (!themes[name]) {
        log.warn(`Theme ${name} not found`);
        return false;
    }
    // Mutate the THEME object so references in other files receive the update
    Object.assign(THEME, buildTheme(themes[name]));
    log.info(`Theme set to ${name}`);
    return true;
}

module.exports = {
    THEME,
    setTheme,
    getAvailableThemes: () => Object.keys(themes),
};
