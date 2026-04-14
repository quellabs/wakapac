/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ███████╗████████╗██████╗ ██╗     ██╗██████╗                                         ║
 * ║  ██╔════╝╚══██╔══╝██╔══██╗██║     ██║██╔══██╗                                        ║
 * ║  ███████╗   ██║   ██║  ██║██║     ██║██████╔╝                                        ║
 * ║  ╚════██║   ██║   ██║  ██║██║     ██║██╔══██╗                                        ║
 * ║  ███████║   ██║   ██████╔╝███████╗██║██████╔╝                                        ║
 * ║  ╚══════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝╚═════╝                                         ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — Stdlib                                                               ║
 * ║                                                                                      ║
 * ║  General-purpose standard library functions as a WakaPAC unit.                       ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(Stdlib);                                                              ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ Stdlib.log(value) }}                                                ║
 * ║  Flat:        {{ log(value) }}  (requires data-pac-uses="Stdlib")                    ║
 * ║                                                                                      ║
 * ║  Note: log() and beep() are side-effect functions; use them in event bindings:       ║
 * ║    data-pac-bind="click: Stdlib.beep(440, 200)"                                      ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    /** Shared AudioContext — created once on first beep(), reused thereafter. */
    let _audioCtx = null;

    function getAudioContext() {
        if (!_audioCtx || _audioCtx.state === 'closed') {
            _audioCtx = new AudioContext();
        }

        return _audioCtx;
    }

    window.Stdlib = {

        createPacPlugin() {
            return {
                /** Unit namespace — accessible in binds as Stdlib.fn() */
                name: 'Stdlib',

                functions: {
                    /**
                     * Logs one or more values to the browser console.
                     * Useful for inspecting abstraction state from within bind expressions.
                     * @param {...*} args - Values to log
                     * @returns {void}
                     */
                    log: (...args) => console.log(...args),

                    /**
                     * Plays an audible beep using the Web Audio API.
                     * Requires a prior user gesture (click, keypress, etc.) — browsers block
                     * audio on pages the user hasn't interacted with yet.
                     * Not meaningful as a {{ }} interpolation; use in event bindings.
                     * @param {number} [frequency=440]  - Tone frequency in Hz
                     * @param {number} [duration=200]   - Duration in milliseconds
                     * @param {number} [volume=0.5]     - Gain level (0.0 – 1.0)
                     * @param {string} [type='square']  - Oscillator type: sine|square|sawtooth|triangle
                     * @returns {void}
                     */
                    beep: (frequency = 440, duration = 200, volume = 0.5, type = 'square') => {
                        const ctx = getAudioContext();
                        const oscillator = ctx.createOscillator();
                        const gain = ctx.createGain();

                        oscillator.connect(gain);
                        gain.connect(ctx.destination);

                        oscillator.type = type;
                        oscillator.frequency.value = frequency;
                        gain.gain.value = volume;

                        oscillator.start();
                        oscillator.stop(ctx.currentTime + duration / 1000);
                    },

                    /**
                     * Sends a message to a specific WakaPAC component by id.
                     * Equivalent to calling wakaPAC.sendMessage() directly, but usable
                     * in binding expressions via data-pac-bind.
                     * @param {string} pacId            - The data-pac-id of the target component
                     * @param {number} message          - Message identifier (e.g. wakaPAC.MSG_USER + 1)
                     * @param {number} [wParam=0]       - First message parameter (integer)
                     * @param {number} [lParam=0]       - Second message parameter (integer)
                     * @param {Object} [extended={}]    - Additional data passed via event.detail
                     * @returns {void}
                     */
                    sendMessage: (pacId, message, wParam = 0, lParam = 0, extended = {}) => {
                        wakaPAC.sendMessage(pacId, message, wParam, lParam, extended);
                    },

                    /**
                     * Sends a message to the parent component of the given container.
                     * Equivalent to calling wakaPAC.sendMessageToParent() directly, but usable
                     * in binding expressions via data-pac-bind.
                     * @param {string} pacId            - The data-pac-id of the child component
                     * @param {number} message          - Message identifier (e.g. wakaPAC.MSG_USER + 1)
                     * @param {number} [wParam=0]       - First message parameter (integer)
                     * @param {number} [lParam=0]       - Second message parameter (integer)
                     * @param {Object} [extended={}]    - Additional data passed via event.detail
                     * @returns {void}
                     */
                    sendMessageToParent: (pacId, message, wParam = 0, lParam = 0, extended = {}) => {
                        wakaPAC.sendMessageToParent(pacId, message, wParam, lParam, extended);
                    },

                    /**
                     * Broadcasts a message to all active WakaPAC components.
                     * Equivalent to calling wakaPAC.broadcastMessage() directly, but usable
                     * in binding expressions via data-pac-bind.
                     * @param {number} message          - Message identifier (e.g. wakaPAC.MSG_USER + 1)
                     * @param {number} [wParam=0]       - First message parameter (integer)
                     * @param {number} [lParam=0]       - Second message parameter (integer)
                     * @param {Object} [extended={}]    - Additional data passed via event.detail
                     * @returns {void}
                     */
                    broadcastMessage: (message, wParam = 0, lParam = 0, extended = {}) => {
                        wakaPAC.broadcastMessage(message, wParam, lParam, extended);
                    }
                }
            };
        }
    };

})();