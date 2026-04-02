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
 * ║    wakaPAC.use(WakaStdlib);                                                          ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ Stdlib.beep() }}                                                    ║
 * ║  Flat:        {{ beep() }}  (requires data-pac-uses="Stdlib")                        ║
 * ║                                                                                      ║
 * ║  Note: beep() is a side-effect function and is not meaningful in {{ }} expressions.  ║
 * ║  Use it in event bindings: data-pac-on:click="Stdlib.beep(440, 200)"                ║
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
                     * Plays an audible beep using the Web Audio API.
                     * Requires a prior user gesture (click, keypress, etc.) — browsers block
                     * audio on pages the user hasn't interacted with yet.
                     * Not meaningful as a {{ }} interpolation; use in event bindings.
                     * @param {number} [frequency=440]  - Tone frequency in Hz
                     * @param {number} [duration=200]   - Duration in milliseconds
                     * @param {number} [volume=0.5]     - Gain level (0.0 – 1.0)
                     * @param {string} [type='square']  - Oscillator type: sine|square|sawtooth|triangle
                     */
                    /**
                     * Logs one or more values to the browser console.
                     * Useful for inspecting abstraction state from within bind expressions.
                     * @param {...*} args - Values to log
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
                    }
                },

                /**
                 * Add unit to abstraction if instructed.
                 * @param abstraction
                 * @param pacId
                 * @param config
                 */
                onComponentCreated(abstraction, pacId, config) {
                    const key = config.stdlib?.property;

                    if (key && key in abstraction) {
                        abstraction[key] = this.functions;
                    }
                }
            };
        }
    };

})();