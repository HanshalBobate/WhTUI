const screen = require("./screen");
const { chatList, input } = require("./layout");

function registerKeys(actions) {

    const {
        openSelectedChat,
        sendCurrentMessage
    } = actions;

    // Move down
    screen.key(["j"], () => {
        chatList.down(1);
        screen.render();
    });

    // Move up
    screen.key(["k"], () => {
        chatList.up(1);
        screen.render();
    });

    // Open chat
    screen.key(["enter"], async() => {
        await openSelectedChat();
    });

    // Input mode
    screen.key(["i"], () => {
        input.focus();
    });

    // Leave input mode
    input.key(["escape"], () => {
        chatList.focus();
        screen.render();
    });

    // Send message
    screen.key(["C-s"], async() => {

        const text =
            input.getValue().trim();

        if (!text)
            return;

        await sendCurrentMessage(text);

        input.clearValue();

        chatList.focus();

        screen.render();
    });

    // Quit
    screen.key(["q"], () => {
        process.exit(0);
    });
}

module.exports = registerKeys;