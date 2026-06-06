/**
 * debounce.js
 *
 * Debounce and throttle utilities.
 * Pure functions — no external dependencies.
 */

/**
 * Returns a debounced version of `fn` that delays invoking it until
 * after `delay` ms have elapsed since the last call.
 *
 * @param {Function} fn
 * @param {number}   delay  milliseconds
 * @returns {Function}
 */
function debounce(fn, delay) {
    let timer = null;

    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(this, args);
        }, delay);
    };
}

/**
 * Returns a throttled version of `fn` that invokes it at most once per
 * `interval` ms, with the most-recent call's arguments.
 *
 * @param {Function} fn
 * @param {number}   interval  milliseconds
 * @returns {Function}
 */
function throttle(fn, interval) {
    let lastCall  = 0;
    let pendingId = null;

    return function (...args) {
        const now = Date.now();

        if (now - lastCall >= interval) {
            lastCall = now;
            fn.apply(this, args);
        } else {
            // Schedule a trailing call with the latest arguments
            clearTimeout(pendingId);
            pendingId = setTimeout(() => {
                lastCall = Date.now();
                fn.apply(this, args);
            }, interval - (now - lastCall));
        }
    };
}

module.exports = { debounce, throttle };
