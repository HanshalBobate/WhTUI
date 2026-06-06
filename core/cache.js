const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(
    path.join(__dirname, "..", "data", "messages.db")
);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chat TEXT NOT NULL,
            sender TEXT NOT NULL,
            body TEXT,
            timestamp INTEGER
        )
    `);
});

function saveMessage(msg) {
    db.run(
        `
        INSERT OR IGNORE INTO messages
        (id, chat, sender, body, timestamp)
        VALUES (?, ?, ?, ?, ?)
        `, [
            msg.id,
            msg.chat,
            msg.sender,
            msg.body,
            msg.timestamp
        ]
    );
}

function getMessages(chatId) {
    return new Promise((resolve, reject) => {
        db.all(
            `
            SELECT *
            FROM messages
            WHERE chat = ?
            ORDER BY timestamp ASC
            `, [chatId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

module.exports = {
    db,
    saveMessage,
    getMessages
};