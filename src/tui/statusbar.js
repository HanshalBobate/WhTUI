/**
 * statusbar.js
 *
 * Spinner animation manager for the status bar.
 *
 * Provides start/stop for spinner animations that show activity during
 * long-running operations (browser launch, chat load, message fetch).
 *
 * Usage:
 *   const { startSpinner, stopSpinner } = require('./statusbar');
 *   const stop = startSpinner('Loading chats...', renderFn);
 *   // ... async work ...
 *   stopSpinner(stop);
 */

const SPINNER_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
const SPINNER_INTERVAL_MS = 80;

/**
 * Start a spinner animation.
 *
 * @param {string}   text      Label shown next to the spinner
 * @param {Function} renderFn  Called each tick with the current frame character
 * @returns {Function}         Call this function to stop the spinner
 */
function startSpinner(text, renderFn) {
    let index = 0;
    const id  = setInterval(() => {
        const frame = SPINNER_FRAMES[index % SPINNER_FRAMES.length];
        index++;
        renderFn(frame, text);
    }, SPINNER_INTERVAL_MS);

    // Return a stopper
    return () => {
        clearInterval(id);
    };
}

/**
 * Stop a running spinner (convenience alias for calling the stopper).
 *
 * @param {Function} stopper  The function returned by startSpinner()
 */
function stopSpinner(stopper) {
    if (typeof stopper === 'function') stopper();
}

module.exports = { startSpinner, stopSpinner, SPINNER_FRAMES };
