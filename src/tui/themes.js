/**
 * themes.js
 *
 * Pre-defined theme palettes for WHTUI.
 */

const themes = {
    catppuccin: {
        bg:          '#1e1e2e',
        bgPanel:     '#181825',
        bgSelected:  '#313244',
        bgInput:     '#313244',
        fg:          '#cdd6f4',
        fgDim:       '#a6adc8',
        fgMuted:     '#6c7086',
        border:      '#585b70',   // Brightened from surface0 to surface2 for visibility
        borderFocus: '#89b4fa',
        accent:      '#00a884',
        modes: {
            normal:  { bg: '#00a884', fg: '#1e1e2e' },
            insert:  { bg: '#89b4fa', fg: '#1e1e2e' },
            search:  { bg: '#f9e2af', fg: '#1e1e2e' },
            command: { bg: '#cba6f7', fg: '#1e1e2e' },
        }
    },
    tokyonight: {
        bg:          '#1a1b26',
        bgPanel:     '#16161e',
        bgSelected:  '#283457',
        bgInput:     '#1f2335',
        fg:          '#c0caf5',
        fgDim:       '#a9b1d6',
        fgMuted:     '#565f89',
        border:      '#414868',   // Distinct border
        borderFocus: '#7aa2f7',
        accent:      '#9ece6a',
        modes: {
            normal:  { bg: '#9ece6a', fg: '#1a1b26' },
            insert:  { bg: '#7aa2f7', fg: '#1a1b26' },
            search:  { bg: '#e0af68', fg: '#1a1b26' },
            command: { bg: '#bb9af7', fg: '#1a1b26' },
        }
    },
    dracula: {
        bg:          '#282a36',
        bgPanel:     '#21222c',
        bgSelected:  '#44475a',
        bgInput:     '#282a36',
        fg:          '#f8f8f2',
        fgDim:       '#bfbfbf',
        fgMuted:     '#6272a4',
        border:      '#6272a4',   // Distinct border
        borderFocus: '#bd93f9',
        accent:      '#50fa7b',
        modes: {
            normal:  { bg: '#50fa7b', fg: '#282a36' },
            insert:  { bg: '#bd93f9', fg: '#282a36' },
            search:  { bg: '#f1fa8c', fg: '#282a36' },
            command: { bg: '#ff79c6', fg: '#282a36' },
        }
    },
    gruvbox: {
        bg:          '#282828',
        bgPanel:     '#1d2021',
        bgSelected:  '#3c3836',
        bgInput:     '#32302f',
        fg:          '#ebdbb2',
        fgDim:       '#a89984',
        fgMuted:     '#928374',
        border:      '#7c6f64',   // Distinct border
        borderFocus: '#83a598',
        accent:      '#b8bb26',
        modes: {
            normal:  { bg: '#b8bb26', fg: '#282828' },
            insert:  { bg: '#83a598', fg: '#282828' },
            search:  { bg: '#fabd2f', fg: '#282828' },
            command: { bg: '#d3869b', fg: '#282828' },
        }
    },
    nord: {
        bg:          '#2e3440',
        bgPanel:     '#242933',
        bgSelected:  '#3b4252',
        bgInput:     '#3b4252',
        fg:          '#eceff4',
        fgDim:       '#d8dee9',
        fgMuted:     '#4c566a',
        border:      '#4c566a',   // Distinct border
        borderFocus: '#88c0d0',
        accent:      '#a3be8c',
        modes: {
            normal:  { bg: '#a3be8c', fg: '#2e3440' },
            insert:  { bg: '#88c0d0', fg: '#2e3440' },
            search:  { bg: '#ebcb8b', fg: '#2e3440' },
            command: { bg: '#b48ead', fg: '#2e3440' },
        }
    }
};

/**
 * Re-calculate full theme object based on palette
 */
function buildTheme(palette) {
    return {
        ...palette,
        chatList: {
            bg: palette.bgPanel,
            fg: palette.fgDim,
            border: { fg: palette.border },
            label: { fg: palette.fg, bold: true },
            scrollbar: { bg: palette.bgPanel, fg: palette.fgMuted },
            item: { fg: palette.fgDim },
            selected: { bg: palette.bgSelected, fg: palette.fg, bold: true },
        },
        messages: {
            bg: palette.bg,
            fg: palette.fg,
            border: { fg: palette.border },
            label: { fg: palette.fg, bold: true },
            scrollbar: { bg: palette.bg, fg: palette.fgMuted },
        },
        statusBar: {
            bg: palette.bgPanel,
            fg: palette.fgDim,
        },
        footer: {
            bg: palette.bgPanel,
            fg: palette.fgMuted,
        },
        input: {
            bg: palette.bgInput,
            fg: palette.fg,
            border: { fg: palette.borderFocus },
            label: { fg: palette.fgDim },
        },
        commandBar: {
            bg: palette.bgPanel,
            fg: palette.fg,
        },
        screen: {
            bg: palette.bg,
        }
    };
}

module.exports = {
    themes,
    buildTheme,
};
