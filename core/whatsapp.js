const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const state = require("./state");
const cache = require("./cache");

function createClient(onReady, onMessage) {

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: "whtui"
        }),
        puppeteer: {
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ],
            // 0 disables the launch timeout
            timeout: 0,
            // Increase CDP protocol timeout to 2 minutes to prevent callFunctionOn timeout
            protocolTimeout: 120000
        }
    });

    client.on("qr", (qr) => {
        console.clear();
        console.log("\nScan QR Code:\n");
        qrcode.generate(qr, {
            small: true
        });
    });

    client.on("authenticated", () => {
        console.log("Authenticated");
    });

    client.on("ready", async () => {
        console.clear();
        console.log("\nWhatsApp Connected\n└");
        // Give the page extra time to settle before evaluating scripts
        await new Promise(r => setTimeout(r, 8000));
        // Robust fetch of chats with a single retry
        const fetchChats = async (retries = 1) => {
            try {
                return await client.getChats();
            } catch (e) {
                console.error("Failed to fetch chats (timeout?)", e);
                if (retries > 0) {
                    console.log("Retrying chat fetch after short delay...");
                    await new Promise(r => setTimeout(r, 3000));
                    return fetchChats(retries - 1);
                }
                return [];
            }
        };
        const chats = await fetchChats(1);
        state.client = client;
        state.chats = chats
            .filter(c => !c.isStatus)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        if (onReady) onReady();
    });

    client.on("message", async(msg) => {

        const row = {
            id: msg.id._serialized,
            chat: msg.from,
            sender: msg.author || msg.from,
            body: msg.body || "",
            timestamp: msg.timestamp || Date.now()
        };

        cache.saveMessage(row);

        if (onMessage)
            onMessage(msg);

    });

    client.on("disconnected", (reason) => {
        console.log(
            "Disconnected:",
            reason
        );
    });

    client.initialize();

    return client;
}

async function loadMessages(chatId) {

    const client = state.client;

    if (!client)
        return [];

    const chat =
        await client.getChatById(chatId);

    const messages =
        await chat.fetchMessages({
            limit: 50
        });

    for (const msg of messages) {

        cache.saveMessage({
            id: msg.id._serialized,
            chat: chatId,
            sender: msg.author ||
                msg.from,
            body: msg.body || "",
            timestamp: msg.timestamp
        });

    }

    return cache.getMessages(chatId);
}

async function sendMessage(
    chatId,
    text
) {

    const client =
        state.client;

    if (!client)
        return;

    await client.sendMessage(
        chatId,
        text
    );

}

module.exports = {
    createClient,
    loadMessages,
    sendMessage
};