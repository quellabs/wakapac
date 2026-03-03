/*
 * ╔══════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                  ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ███╗   ███╗ ██████╗ ████████╗██╗ ██████╗ ███╗  ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗████╗ ████║██╔═══██╗╚══██╔══╝██║██╔═══██╗████╗ ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██╔████╔██║██║   ██║   ██║   ██║██║   ██║██╔██╗║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║╚██╔╝██║██║   ██║   ██║   ██║██║   ██║██║╚██║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██║ ╚═╝ ██║╚██████╔╝   ██║   ██║╚██████╔╝██║ ╚╝║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝    ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ║
 * ║                                                                                  ║
 * ║  WakaMotion - Motion Sensor Plugin for wakaPAC                                   ║
 * ║                                                                                  ║
 * ║  Provides reactive motion sensor properties for all wakaPAC components,          ║
 * ║  including tilt angles, axis inversion detection, and iOS permission handling.   ║
 * ║                                                                                  ║
 * ║  Usage:                                                                          ║
 * ║    wakaPAC.use(wakaMotion);                                                      ║
 * ║    wakaMotion.setMotionThreshold(0.5);                                           ║
 * ║                                                                                  ║
 * ║    wakaPAC('#app', { ... });                                                     ║
 * ║                                                                                  ║
 * ║    // iOS only — call from a button click handler:                               ║
 * ║    wakaMotion.requestMotionPermission();                                         ║
 * ║                                                                                  ║
 * ║  Reactive properties injected into every component:                              ║
 * ║    motionSupported             — true if DeviceMotion API is available           ║
 * ║    motionPermissionRequired    — true on iOS 13+ before permission granted       ║
 * ║    motionAccelerationX/Y/Z     — raw acceleration incl. gravity (m/s²)          ║
 * ║    motionRotationAlpha/Beta/Gamma — rotation rate (deg/s, gyroscope required)   ║
 * ║    motionTiltX / motionTiltY   — tilt angles from horizontal in degrees         ║
 * ║    motionAxisInversion         — current axis inversion multipliers { x, y }    ║
 * ║    motionAxisDetectionStep     — calibration flow state                         ║
 * ║    motionHasRotationRate         — true if gyroscope data is available         ║
 * ║    motionAxisDetectionStepLabel — human-readable calibration instruction        ║
 * ║                                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    'use strict';

    /** @type {string} */
    const VERSION = '1.0.0';

    // ============================================================================
    // Internal state — shared across all components
    // ============================================================================

    /** @type {boolean} Prevents attaching the devicemotion listener more than once */
    let _listenerAttached = false;

    /** @type {number} Dead-zone threshold in m/s². 0 = dispatch every event. */
    let _threshold = 0;

    /** @type {object|null} Last dispatched motion values for threshold comparison */
    let _lastDispatched = null;

    /** @type {{ x: number, y: number }} Per-axis inversion multipliers */
    let _axisInversion = { x: 1, y: 1 };

    /**
     * Timestamp of the last dispatched event in ms.
     * Used to enforce a minimum dispatch interval regardless of threshold setting.
     * Prevents flooding the reactive system on high-frequency sensors (60-100+ Hz).
     */
    let _lastEventTime = 0;

    /** @type {number} Minimum interval between dispatches in ms. ~60fps. */
    const MIN_DISPATCH_INTERVAL = 16;

    /**
     * Whether the first devicemotion event confirmed rotation rate data is available.
     * null = not yet determined, true/false = confirmed.
     * @type {boolean|null}
     */
    let _hasRotationRate = null;

    // ============================================================================
    // Helpers
    // ============================================================================

    /**
     * Broadcast a property update to all registered components.
     * @param {string} prop
     * @param {*} value
     */
    function broadcast(prop, value) {
        if (!window.PACRegistry || !window.PACRegistry.components) return;
        window.PACRegistry.components.forEach(function (context) {
            context.abstraction[prop] = value;
        });
    }

    /**
     * Broadcast multiple properties to all registered components.
     * @param {object} props
     */
    function broadcastAll(props) {
        if (!window.PACRegistry || !window.PACRegistry.components) return;
        window.PACRegistry.components.forEach(function (context) {
            Object.assign(context.abstraction, props);
        });
    }

    // ============================================================================
    // Motion listener
    // ============================================================================

    /**
     * Attaches the devicemotion event listener.
     * Called automatically on non-iOS, or after iOS permission is granted.
     * Guards against double-registration.
     */
    function attachListener() {
        if (_listenerAttached) {
            return;
        }

        _listenerAttached = true;

        window.addEventListener('devicemotion', function (event) {
            // Throttle to MIN_DISPATCH_INTERVAL regardless of sensor rate.
            // Sensors can fire 60-100+ times/sec; without this every event would
            // trigger a full reactive broadcast even with threshold filtering.
            const now = Date.now();
            if (now - _lastEventTime < MIN_DISPATCH_INTERVAL) return;
            _lastEventTime = now;

            const raw = event.accelerationIncludingGravity ?? {};
            const rot = event.rotationRate ?? {};

            // Detect rotation rate capability on the first event.
            // Some devices lack a gyroscope and always report null rotation values.
            // We expose this as a stable reactive property so UI can adapt.
            if (_hasRotationRate === null) {
                _hasRotationRate = rot.alpha != null || rot.beta != null || rot.gamma != null;
                broadcastAll({ motionHasRotationRate: _hasRotationRate });
            }

            // Round to 2 decimal places to suppress floating point noise
            const r2 = function (v) { return v != null ? Math.round(v * 100) / 100 : null; };
            const x = r2(raw.x), y = r2(raw.y), z = r2(raw.z);
            const alpha = r2(rot.alpha), beta = r2(rot.beta), gamma = r2(rot.gamma);

            // Skip dispatch if all axes are within the dead-zone threshold
            if (_threshold > 0 && _lastDispatched) {
                const t = _threshold;
                const last = _lastDispatched;

                const accChanged =
                    Math.abs((x     ?? last.x) - last.x) > t ||
                    Math.abs((y     ?? last.y) - last.y) > t ||
                    Math.abs((z     ?? last.z) - last.z) > t;

                const rotChanged =
                    Math.abs((alpha ?? last.alpha) - last.alpha) > t ||
                    Math.abs((beta  ?? last.beta)  - last.beta)  > t ||
                    Math.abs((gamma ?? last.gamma) - last.gamma) > t;

                if (!accChanged && !rotChanged) {
                    return;
                }
            }

            if (_threshold > 0) {
                _lastDispatched = { x, y, z, alpha, beta, gamma };
            }

            // Apply per-axis inversion multipliers
            const ix = x != null ? x * _axisInversion.x : null;
            const iy = y != null ? y * _axisInversion.y : null;

            // Compute tilt angles in whole degrees from horizontal using asin(axis / g).
            // 0° = flat, +90° = that edge tilted fully upright.
            // Clamped to [-1, 1] before asin to guard against sensor noise producing NaN.
            const G = 9.81;
            const toDeg = function (v) { return Math.round(v * (180 / Math.PI)); };
            const clamp = function (v) { return Math.max(-1, Math.min(1, v)); };
            const tiltX = ix != null ? toDeg(Math.asin(clamp(ix / G))) : null;
            const tiltY = iy != null ? toDeg(Math.asin(clamp(iy / G))) : null;

            broadcastAll({
                motionAccelerationX:   ix,
                motionAccelerationY:   iy,
                motionAccelerationZ:   z,
                motionRotationAlpha:   alpha,
                motionRotationBeta:    beta,
                motionRotationGamma:   gamma,
                motionTiltX:           tiltX,
                motionTiltY:           tiltY,
            });
        });
    }

    // ============================================================================
    // Plugin descriptor
    // ============================================================================

    /**
     * WakaMotion plugin object.
     * Register with: wakaPAC.use(wakaMotion)
     */
    const wakaMotion = {

        /** @type {string} */
        VERSION,

        /**
         * Called by wakaPAC.use(). Returns the plugin descriptor with lifecycle hooks.
         * @param {function} wakaPAC - The wakaPAC function (not used directly here)
         * @returns {{ onComponentCreated: function, onComponentDestroyed: function }}
         */
        createPacPlugin(wakaPAC) {
            // On non-iOS, attach the devicemotion listener immediately.
            // On iOS it is deferred until requestMotionPermission() is called from a tap handler.
            if (typeof DeviceMotionEvent !== 'undefined' &&
                typeof DeviceMotionEvent.requestPermission !== 'function') {
                attachListener();
            }

            return {

                /**
                 * Injects motion reactive properties into the component abstraction.
                 * Called by wakaPAC for every new component.
                 * @param {object} abstraction
                 */
                onComponentCreated(abstraction) {
                    abstraction.motionSupported = typeof DeviceMotionEvent !== 'undefined';

                    // True on iOS 13+ where requestPermission() must be called from a tap handler.
                    abstraction.motionPermissionRequired =
                        typeof DeviceMotionEvent !== 'undefined' &&
                        typeof DeviceMotionEvent.requestPermission === 'function';

                    // Raw acceleration along each device axis (m/s², includes gravity)
                    abstraction.motionAccelerationX = null;
                    abstraction.motionAccelerationY = null;
                    abstraction.motionAccelerationZ = null;

                    // Rotation rate around each axis in deg/s — requires a gyroscope
                    abstraction.motionRotationAlpha = null;
                    abstraction.motionRotationBeta  = null;
                    abstraction.motionRotationGamma = null;

                    // Tilt angles in degrees from horizontal: 0° = flat, +90° = that edge down
                    abstraction.motionTiltX = null;
                    abstraction.motionTiltY = null;

                    // Whether the device has a gyroscope. null until the first event arrives,
                    // then true or false based on whether rotationRate data is present.
                    abstraction.motionHasRotationRate = _hasRotationRate;

                    // Axis inversion detection state
                    abstraction.motionAxisDetectionStep      = 'idle';
                    abstraction.motionAxisDetectionStepLabel = '';
                    abstraction.motionAxisInversion          = { x: 1, y: 1 };
                },

                /**
                 * No cleanup needed — the global devicemotion listener is shared and
                 * persists for the lifetime of the page.
                 */
                onComponentDestroyed() {}
            };
        },

        // ============================================================================
        // Public API
        // ============================================================================

        /**
         * Enable or disable motion sensor tracking. Must be called before wakaPAC().
         * Motion is disabled by default to avoid unnecessary battery drain.
         * @param {boolean} enable
         */
        enable(enable) {
            // On non-iOS, attach immediately if enabling.
            // On iOS the listener is deferred until requestMotionPermission() is called.
            if (enable && typeof DeviceMotionEvent !== 'undefined' &&
                typeof DeviceMotionEvent.requestPermission !== 'function') {
                attachListener();
            }
        },

        /**
         * Request iOS motion sensor permission from within a user gesture (e.g. a button click).
         * On iOS 13+, DeviceMotionEvent.requestPermission() must be called from a tap handler —
         * calling it at page load causes a silent denial. On non-iOS this is a no-op.
         * Returns a Promise that resolves to 'granted', 'denied', or 'error'.
         */
        async requestMotionPermission() {
            if (typeof DeviceMotionEvent === 'undefined' ||
                typeof DeviceMotionEvent.requestPermission !== 'function') {
                // Not iOS — listener already attached at enable(), nothing to do
                return 'granted';
            }

            try {
                const result = await DeviceMotionEvent.requestPermission();

                if (result === 'granted') {
                    attachListener();
                }

                return result;
            } catch (err) {
                return 'error';
            }
        },

        /**
         * Suppress motion events unless at least one axis changes by more than `threshold`
         * since the last dispatched event. Prevents constant re-renders from sensor noise
         * while the device is stationary.
         * @param {number} threshold - Minimum change in m/s² required to trigger a dispatch.
         *                             Default is 0 (every event). Recommended: 0.5 for tilt UIs.
         */
        setMotionThreshold(threshold) {
            _threshold = Math.max(0, threshold);
            _lastDispatched = null;
        },

        /**
         * Correct for devices that report an acceleration axis inverted relative to the W3C spec.
         * Pass -1 to invert an axis, 1 to leave it as reported. Default is (1, 1).
         * @param {number} x - X axis multiplier: 1 (normal) or -1 (inverted)
         * @param {number} y - Y axis multiplier: 1 (normal) or -1 (inverted)
         */
        setMotionAxisInversion(x, y) {
            _axisInversion = {
                x: x >= 0 ? 1 : -1,
                y: y >= 0 ? 1 : -1
            };
            _lastDispatched = null;
        },

        /**
         * Detect motion axis inversion by asking the user to perform two deliberate tilt gestures.
         *
         * The detection proceeds in two sequential steps:
         *   1. Ask the user to tilt the right edge of the device downward  → detects X axis polarity
         *   2. Ask the user to tilt the bottom edge of the device downward → detects Y axis polarity
         *
         * As detection progresses, the reactive properties `motionAxisDetectionStep`,
         * `motionAxisDetectionStepLabel`, and `motionAxisInversion` are updated on all components.
         *
         * `motionAxisDetectionStep` values:
         *   'idle'    — not started
         *   'tilt-x'  — waiting for the user to tilt the right edge down
         *   'tilt-y'  — waiting for the user to tilt the bottom edge down
         *   'done'    — both axes detected; inversion values have been applied
         *   'timeout' — the user did not perform a tilt within the allotted time
         *
         * Safe to call once per session. Calling while detection is in progress is ignored.
         *
         * @param {object} [options]
         * @param {number} [options.threshold=4]  - Minimum acceleration in m/s² to register a tilt
         * @param {number} [options.timeout=8000] - Ms to wait per axis before setting step to 'timeout'
         */
        detectMotionAxisInversion({ threshold = 4, timeout = 8000 } = {}) {

            // Guard against missing registry or re-entrant calls
            if (!window.PACRegistry || !window.PACRegistry.components) return;
            const currentStep = window.PACRegistry.components[0]?.abstraction?.motionAxisDetectionStep;
            if (currentStep === 'tilt-x' || currentStep === 'tilt-y') return;

            // Accumulates detected polarity; defaults to 1 (non-inverted)
            const result = { x: 1, y: 1 };

            /**
             * Broadcast a detection step to all components, including the human-readable label.
             * @param {'tilt-x'|'tilt-y'|'done'|'timeout'} step
             */
            function setStep(step) {
                const labels = {
                    'tilt-x':  'Tilt the right edge of the device down',
                    'tilt-y':  'Tilt the bottom edge of the device down',
                    'done':    'Calibration complete',
                    'timeout': 'Timed out — please try again'
                };

                broadcastAll({
                    motionAxisDetectionStep:      step,
                    motionAxisDetectionStepLabel: labels[step] ?? ''
                });
            }

            /**
             * Broadcast the completed inversion result to all components.
             * @param {{ x: 1|-1, y: 1|-1 }} inversion
             */
            function setInversion(inversion) {
                broadcast('motionAxisInversion', inversion);
            }

            /**
             * Listen for a single deliberate tilt on the given axis.
             * Uses accelerationIncludingGravity — available without extra permissions and
             * provides a reliable gravity component when the device is tilted.
             * @param {'x'|'y'} axis
             * @param {function} onDone
             * @param {function} onTimeout
             */
            function detectAxis(axis, onDone, onTimeout) {
                let timer = null;

                function handler(event) {
                    const gravity = event.accelerationIncludingGravity;

                    // Guard against null or incomplete events from some Android WebViews
                    if (!gravity) return;

                    const val = axis === 'x' ? gravity.x : gravity.y;

                    if (val == null || Math.abs(val) < threshold) return;

                    // First sample exceeding threshold determines polarity
                    result[axis] = val > 0 ? 1 : -1;

                    cleanup();
                    onDone();
                }

                function cleanup() {
                    window.removeEventListener('devicemotion', handler);
                    clearTimeout(timer);
                }

                window.addEventListener('devicemotion', handler);

                timer = setTimeout(function () {
                    cleanup();
                    onTimeout();
                }, timeout);
            }

            /**
             * Apply and broadcast the completed inversion result.
             * Clears _lastDispatched so the next event bypasses the deduplication guard.
             */
            function applyResult() {
                const inversion = { x: result.x, y: result.y };

                _axisInversion = inversion;
                _lastDispatched = null;

                setInversion(inversion);
                setStep('done');
            }

            /**
             * Start Y axis detection after X has been confirmed.
             * A settling delay prevents residual X acceleration from immediately
             * satisfying the Y listener before the device returns to flat.
             */
            function detectYAxis() {
                setStep('tilt-y');

                setTimeout(function () {
                    detectAxis('y', applyResult, function () { setStep('timeout'); });
                }, 2000);
            }

            // ─── Detection sequence ───────────────────────────────────────────────

            setStep('tilt-x');
            detectAxis('x', detectYAxis, function () { setStep('timeout'); });
        }
    };

    /* globals module, define */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { wakaMotion };
    } else if (typeof define === 'function' && define.amd) {
        define(function () { return { wakaMotion }; });
    } else if (typeof window !== 'undefined') {
        window.wakaMotion = wakaMotion;
    }
})();