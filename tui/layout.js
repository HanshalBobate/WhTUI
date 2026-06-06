const blessed = require("blessed");
const screen = require("./screen");

const chatList = blessed.list({
    parent: screen,

    label: " Chats ",

    width: "30%",
    height: "100%-3",

    left: 0,
    top: 0,

    border: "line",

    keys: true,
    mouse: true,
    vi: true,

    scrollable: true,

    style: {
        selected: {
            bold: true,
            inverse: true
        }
    }
});

const messages = blessed.box({
    parent: screen,

    label: " Messages ",

    left: "30%",
    top: 0,

    width: "70%",
    height: "100%-3",

    border: "line",

    scrollable: true,
    alwaysScroll: true,

    keys: true,
    mouse: true,

    tags: true,

    scrollbar: {
        ch: "│"
    }
});
const statusBar = blessed.box({
    parent: screen,

    bottom: 3,
    left: 0,

    width: "100%",
    height: 1,

    tags: true,

    content: "Starting..."
});

const input = blessed.textbox({
    parent: screen,

    bottom: 0,
    left: 0,

    width: "100%",
    height: 3,

    border: "line",

    inputOnFocus: true,

    label: " Input "
});

module.exports = {
    chatList,
    messages,
    input,
    statusBar
};