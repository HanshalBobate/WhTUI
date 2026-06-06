const blessed = require("blessed");

const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    dockBorders: true,
    title: "whtui"
});

screen.key(
    ["C-c"],
    () => process.exit(0)
);

module.exports = screen;