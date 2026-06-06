/**
 * logger.js
 *
 * Application-wide logger built on Winston.
 *
 * Writes ONLY to a rotating daily log file in:  ./storage/logs/
 * Never writes to stdout/stderr — the terminal is owned by the blessed TUI.
 *
 * Usage:
 *   const log = require('./logger');
 *   log.info('Something happened');
 *   log.warn('Watch out');
 *   log.error('Something broke', { detail: err.message });
 *   log.debug('Low-level trace', { data });
 */

const path    = require('path');
const fs      = require('fs');
const winston = require('winston');

// ─── Ensure log directory exists ──────────────────────────────────────────────

const LOG_DIR = path.resolve(__dirname, '../../storage/logs');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ─── Date-stamped filename ────────────────────────────────────────────────────

function todayFilename() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return path.join(LOG_DIR, `whtui-${y}-${m}-${day}.log`);
}

// ─── Winston instance ─────────────────────────────────────────────────────────

const log = winston.createLogger({
    level: process.env.WHTUI_LOG_LEVEL || 'debug',

    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length
                ? ' ' + JSON.stringify(meta)
                : '';
            return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}`;
        })
    ),

    transports: [
        new winston.transports.File({
            filename: todayFilename(),
            maxsize: 10 * 1024 * 1024, // 10 MB per file
            tailable: true,
        }),
    ],

    // Prevent winston from calling process.exit on uncaught exceptions
    exitOnError: false,
});

module.exports = log;
