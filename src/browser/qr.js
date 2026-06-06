/**
 * qr.js
 *
 * Render WhatsApp Web pairing data as an ASCII QR code for the terminal.
 */

const qrcode = require('qrcode-terminal');

/**
 * @param {string} data  Pairing string from div[data-ref]
 * @returns {Promise<string>} ASCII QR art
 */
function generateAscii(data) {
    return new Promise((resolve) => {
        qrcode.generate(data, { small: true }, resolve);
    });
}

module.exports = { generateAscii };
