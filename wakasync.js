/*
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                              ║
 * ║    ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ███████╗██╗   ██╗███╗   ██╗ ██████╗     ║
 * ║    ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝     ║
 * ║    ██║ █╗ ██║███████║█████╔╝ ███████║███████╗ ╚████╔╝ ██╔██╗ ██║██║          ║
 * ║    ██║███╗██║██╔══██║██╔═██╗ ██╔══██║╚════██║  ╚██╔╝  ██║╚██╗██║██║          ║
 * ║    ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║███████║   ██║   ██║ ╚████║╚██████╗     ║
 * ║     ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝     ║
 * ║                                                                              ║
 * ║  WakaSync - Advanced HTTP Client with Request Management                     ║
 * ║                                                                              ║
 * ║  A powerful HTTP client library that provides request grouping, cancellation,║
 * ║  automatic retries, and intelligent response parsing. Supports modern        ║
 * ║  browser APIs and provides comprehensive error handling.                     ║
 * ║                                                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    "use strict";

    const VERSION = '1.3.0';

    /**
     * WakaSync - Advanced HTTP Client
     * @constructor
     */
    function WakaSync() {
        // Request tracking for grouping and cancellation
        this._requestGroups = new Map();

        // Interceptors with id tracking for eject support
        this._interceptorId = 0;
        this.interceptors = {
            request: [],
            response: []
        };

        // Default configuration
        this.config = {
            timeout: 30000,
            retries: 0,
            retryDelay: 1000,
            retryBackoff: 'exponential',      // 'fixed', 'exponential', or 'linear'
            retryBackoffMax: 30000,            // Cap for exponential backoff
            validateStatus: function (response) {
                return response.ok;
            },
            responseType: 'auto',
            headers: {}
        };
    }

    WakaSync.prototype = {
        // Restore constructor reference (prototype assignment destroys it)
        constructor: WakaSync,

        /**
         * Adds a request interceptor. Interceptors may be sync or async.
         * Returns an unsubscribe function to remove the interceptor.
         *
         * @public
         * @param {Function} fn - Interceptor function(config) => config
         * @returns {Function} Unsubscribe function
         */
        addRequestInterceptor(fn) {
            if (typeof fn !== 'function') {
                throw new Error('Interceptor must be a function');
            }

            const entry = {id: ++this._interceptorId, fn};
            this.interceptors.request.push(entry);

            return () => {
                const idx = this.interceptors.request.indexOf(entry);
                if (idx !== -1) {
                    this.interceptors.request.splice(idx, 1);
                }
            };
        },

        /**
         * Adds a response interceptor. Interceptors may be sync or async.
         * Returns an unsubscribe function to remove the interceptor.
         *
         * Response interceptors receive (data, config, timing) where timing
         * contains { startTime, endTime, duration } in milliseconds.
         *
         * @public
         * @param {Function} fn - Interceptor function(data, config, timing) => data
         * @returns {Function} Unsubscribe function
         */
        addResponseInterceptor(fn) {
            if (typeof fn !== 'function') {
                throw new Error('Interceptor must be a function');
            }

            const entry = {
                id: ++this._interceptorId,
                fn
            };

            this.interceptors.response.push(entry);

            return () => {
                const idx = this.interceptors.response.indexOf(entry);

                if (idx !== -1) {
                    this.interceptors.response.splice(idx, 1);
                }
            };
        },

        /**
         * Makes an HTTP request with advanced options.
         *
         * NOTE on callbacks vs promises: If both onSuccess/onError callbacks and
         * promise handling (.then/.catch) are used, the callback fires first as a
         * side effect. The promise still resolves/rejects normally. This allows
         * callbacks for side effects (e.g. logging) while using promises for
         * control flow.
         *
         * @param {string} url - The URL to request
         * @param {Object} opts - Request options
         * @param {string} [opts.method='GET'] - HTTP method
         * @param {Object} [opts.headers] - Additional headers
         * @param {*} [opts.data] - Request body data
         * @param {string} [opts.groupKey] - Group key for request cancellation
         * @param {boolean} [opts.latestOnly] - Use URL as groupKey automatically
         * @param {boolean} [opts.ignoreAbort] - Suppress AbortError when cancelled
         * @param {Function} [opts.onSuccess] - Success callback (fires before promise resolves)
         * @param {Function} [opts.onError] - Error callback (fires before promise rejects)
         * @param {number} [opts.timeout=30000] - Request timeout in milliseconds
         * @param {Function} [opts.validateStatus] - Custom status validation function
         * @param {string} [opts.responseType='auto'] - Response type: 'json', 'text', 'blob', 'response', 'auto'
         * @param {Function} [opts.urlNormalizer] - Function to normalize URLs for grouping
         * @param {string} [opts.credentials] - Fetch credentials option
         * @param {string} [opts.mode] - Fetch mode option
         * @param {string} [opts.cache] - Fetch cache option
         * @param {string} [opts.redirect] - Fetch redirect option
         * @param {string} [opts.referrer] - Fetch referrer option
         * @param {string} [opts.integrity] - Fetch integrity option
         * @param {boolean} [opts.keepalive] - Fetch keepalive option
         * @param {string} [opts.priority] - Fetch priority option
         * @param {string} [opts.baseUrl] - Base URL for URL normalization
         * @param {number} [opts.retries=0] - Number of retry attempts
         * @param {number} [opts.retryDelay=1000] - Base delay between retries in milliseconds
         * @param {string} [opts.retryBackoff='exponential'] - Backoff strategy: 'fixed', 'exponential', 'linear'
         * @param {number} [opts.retryBackoffMax=30000] - Maximum backoff delay in milliseconds
         * @param {Function} [opts.shouldRetry] - Custom retry logic
         * @public
         * @returns {Promise} Promise that resolves with response data
         */
        async request(url, opts = {}) {
            const startTime = Date.now();

            // Extract and validate configuration, apply request interceptors
            let interceptedConfig = this.validateAndNormalizeConfig(url, opts);

            // Apply request interceptors (supports async interceptors)
            // Tolerates both raw functions and { id, fn } entries for backward compatibility
            for (const entry of this.interceptors.request) {
                try {
                    const fn = typeof entry === 'function' ? entry : entry.fn;
                    const result = await fn(interceptedConfig);
                    interceptedConfig = result !== undefined ? result : interceptedConfig;
                } catch (e) {
                    const error = new Error('Request interceptor failed');
                    error.code = 'INTERCEPTOR_ERROR';
                    error.originalError = e;
                    throw error;
                }
            }

            // Setup request state and immediately register to prevent race conditions
            const requestState = this.setupRequestState(interceptedConfig);

            // Setup timeout that aborts the controller directly
            let timeoutId = null;

            if (interceptedConfig.timeout > 0) {
                timeoutId = setTimeout(() => {
                    if (!requestState.controller.signal.aborted) {
                        requestState.timedOut = true;
                        requestState.controller.abort();
                    }
                }, interceptedConfig.timeout);

                // Clear timeout if controller is aborted by something else
                requestState.controller.signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                }, {once: true});
            }

            try {
                let response = await this.executeWithRetry(interceptedConfig, requestState);
                let data = await this.processResponse(response, interceptedConfig, requestState);

                // Build timing metadata
                const endTime = Date.now();
                const timing = {
                    startTime,
                    endTime,
                    duration: endTime - startTime
                };

                // Apply response interceptors (supports async interceptors)
                // Tolerates both raw functions and { id, fn } entries for backward compatibility
                for (const entry of this.interceptors.response) {
                    try {
                        const fn = typeof entry === 'function' ? entry : entry.fn;
                        const result = await fn(data, interceptedConfig, timing);
                        data = result !== undefined ? result : data;
                    } catch (e) {
                        const error = new Error('Response interceptor failed');
                        error.code = 'INTERCEPTOR_ERROR';
                        error.originalError = e;
                        throw error;
                    }
                }

                return this.handleSuccess(data, interceptedConfig, requestState);
            } catch (error) {
                // Convert generic abort into timeout error if timeout triggered it.
                // Check both AbortError (from fetch) and CancellationError (from
                // delayWithAbortCheck during retries).
                if (requestState.timedOut && (error.name === 'AbortError' || error.name === 'CancellationError')) {
                    const timeoutError = this.createTaggedCancellationError(
                        `Request timeout after ${interceptedConfig.timeout}ms`,
                        'timeout'
                    );
                    return this.handleError(timeoutError, interceptedConfig);
                }

                return this.handleError(error, interceptedConfig);
            } finally {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }

                this.cleanupRequest(interceptedConfig.groupKey, requestState.token);
            }
        },

        /**
         * Convenience method for GET requests
         * @public
         * @param {string} url - Request URL
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        get(url, opts = {}) {
            return this.request(url, {...opts, method: 'GET'});
        },

        /**
         * Convenience method for POST requests
         * @public
         * @param {string} url - Request URL
         * @param {*} data - Request body data
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        post(url, data, opts = {}) {
            return this.request(url, {...opts, method: 'POST', data});
        },

        /**
         * Convenience method for PUT requests
         * @public
         * @param {string} url - Request URL
         * @param {*} data - Request body data
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        put(url, data, opts = {}) {
            return this.request(url, {...opts, method: 'PUT', data});
        },

        /**
         * Convenience method for DELETE requests
         * @public
         * @param {string} url - Request URL
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        delete(url, opts = {}) {
            return this.request(url, {...opts, method: 'DELETE'});
        },

        /**
         * Convenience method for PATCH requests
         * @public
         * @param {string} url - Request URL
         * @param {*} data - Request body data
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        patch(url, data, opts = {}) {
            return this.request(url, {...opts, method: 'PATCH', data});
        },

        /**
         * Convenience method for HEAD requests
         * @public
         * @param {string} url - Request URL
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        head(url, opts = {}) {
            return this.request(url, {...opts, method: 'HEAD'});
        },

        /**
         * Creates a new WakaSync instance with default configuration.
         * Interceptors are NOT inherited by default — pass copyInterceptors: true
         * to carry them over.
         *
         * @public
         * @param {Object} defaultConfig - Default configuration to apply
         * @param {Object} options - Creation options
         * @param {boolean} [options.copyInterceptors=false] - Copy interceptors from parent
         * @returns {WakaSync} New WakaSync instance
         */
        create(defaultConfig = {}, options = {}) {
            const instance = new WakaSync();

            // Deep merge headers so defaults aren't lost
            instance.config = {
                ...this.config,
                ...defaultConfig,
                headers: {
                    ...this.config.headers,
                    ...(defaultConfig.headers || {})
                }
            };

            // Optionally copy interceptors (shallow copy of entry references)
            if (options.copyInterceptors) {
                instance.interceptors = {
                    request: [...this.interceptors.request],
                    response: [...this.interceptors.response]
                };
            }

            return instance;
        },

        /**
         * Cancels all requests in a group
         * @public
         * @param {string} groupKey - Group key to cancel
         */
        cancelGroup(groupKey) {
            if (!groupKey) {
                return;
            }

            const group = this._requestGroups.get(groupKey);
            if (group && group.controller && !group.controller.signal.aborted) {
                group.controller.abort();
            }
        },

        /**
         * Cancels all active requests
         * @public
         */
        cancelAll() {
            this._requestGroups.forEach(function (group) {
                if (group.controller && !group.controller.signal.aborted) {
                    group.controller.abort();
                }
            });

            this._requestGroups.clear();
        },

        /**
         * Gets the number of active requests
         * @public
         * @returns {number} Number of active requests
         */
        getActiveRequestCount() {
            let count = 0;

            this._requestGroups.forEach(function (group) {
                if (group.controller && !group.controller.signal.aborted) {
                    count++;
                }
            });

            return count;
        },

        /**
         * Validates and normalizes request configuration
         * @param {string} url - Request URL
         * @param {Object} opts - Request options
         * @returns {Object} Normalized configuration
         */
        validateAndNormalizeConfig(url, opts) {
            // Validate required URL parameter
            if (!url || typeof url !== 'string') {
                const error = new Error('URL must be a non-empty string');
                error.code = 'INVALID_URL';
                throw error;
            }

            // Merge with instance config and provided options (deep merge headers)
            const merged = {
                ...this.config,
                ...opts,
                headers: {
                    ...this.config.headers,
                    ...(opts.headers || {})
                }
            };

            // Validate callback functions
            this.validateCallbacks(merged);
            this.validateAbortControls(merged);

            // Process method and body
            const {method, body, bodyIsJson} = this.normalizeMethodAndBody(merged);

            // Build headers
            const headers = this.buildHeaders(merged, body, bodyIsJson);

            // Build fetch options
            const fetchOptions = this.buildFetchPassthrough(merged);

            // Determine group key
            const groupKey = merged.groupKey ?? (merged.latestOnly ? this.getGroupKeyFromUrl(url, merged) : null);

            return {
                url,
                method,
                headers,
                body,
                groupKey,
                fetchOptions,
                timeout: Math.max(0, parseInt(merged.timeout) || 30000),
                ignoreAbort: !!merged.ignoreAbort,
                validateStatus: merged.validateStatus || ((response) => response.ok),
                responseType: merged.responseType || 'auto',
                onSuccess: merged.onSuccess,
                onError: merged.onError,
                onProgress: merged.onProgress,
                abortController: merged.abortController,
                retries: Math.max(0, parseInt(merged.retries) || 0),
                retryDelay: Math.max(0, parseInt(merged.retryDelay) || 1000),
                retryBackoff: merged.retryBackoff || 'exponential',
                retryBackoffMax: Math.max(0, parseInt(merged.retryBackoffMax) || 30000),
                shouldRetry: merged.shouldRetry,
                urlNormalizer: merged.urlNormalizer,
                baseUrl: merged.baseUrl
            };
        },

        /**
         * Validates callback functions
         * @param {Object} opts - Request options
         */
        validateCallbacks(opts) {
            const validators = [
                ['onSuccess', opts.onSuccess],
                ['onError', opts.onError],
                ['onProgress', opts.onProgress],
                ['urlNormalizer', opts.urlNormalizer],
                ['shouldRetry', opts.shouldRetry]
            ];

            validators.forEach(function (validator) {
                const name = validator[0];
                const fn = validator[1];

                if (fn && typeof fn !== 'function') {
                    const error = new Error(`${name} must be a function`);
                    error.code = 'INVALID_CALLBACK';
                    throw error;
                }
            });
        },

        /**
         * Validates abort controller options
         * @param {Object} opts - Request options
         */
        validateAbortControls(opts) {
            if (opts.abortController && typeof opts.abortController.abort !== 'function') {
                const error = new Error('abortController must have an abort method');
                error.code = 'INVALID_ABORT_CONTROLLER';
                throw error;
            }
        },

        /**
         * Normalizes HTTP method and body.
         * Returns a bodyIsJson flag so buildHeaders can set the correct Content-Type.
         *
         * @param {Object} opts - Request options
         * @returns {Object} Object with method, body, and bodyIsJson
         */
        normalizeMethodAndBody(opts) {
            const method = (opts.method || 'GET').toUpperCase();

            // GET and HEAD don't use body data
            if (['GET', 'HEAD'].includes(method)) {
                if (opts.data !== undefined) {
                    console.warn(`Method ${method} should not have a body. Data will be ignored.`);
                }
                return {method, body: undefined, bodyIsJson: false};
            }

            // Process body data for other methods
            let body;
            let bodyIsJson = false;

            if (opts.data !== undefined) {
                if (typeof opts.data === 'string' ||
                    opts.data instanceof FormData ||
                    opts.data instanceof Blob ||
                    opts.data instanceof ArrayBuffer) {
                    body = opts.data;
                } else {
                    body = JSON.stringify(opts.data);
                    bodyIsJson = true;
                }
            }

            return {method, body, bodyIsJson};
        },

        /**
         * Builds headers object
         * @param {Object} opts - Request options
         * @param {*} body - Request body
         * @param {boolean} bodyIsJson - Whether body was auto-serialized from a JS object
         * @returns {Headers} Headers object
         */
        buildHeaders(opts, body, bodyIsJson) {
            const headers = new Headers();

            // Add default tracking headers
            headers.set('X-WakaSync-Request', 'true');
            headers.set('X-WakaSync-Version', VERSION);

            // Add content type based on body
            if (body !== undefined) {
                if (body instanceof FormData) {
                    // Don't set Content-Type for FormData — browser sets boundary automatically
                } else if (body instanceof Blob || body instanceof ArrayBuffer) {
                    headers.set('Content-Type', 'application/octet-stream');
                } else if (bodyIsJson) {
                    // Body was auto-serialized from a JS object via JSON.stringify
                    headers.set('Content-Type', 'application/json; charset=utf-8');
                } else {
                    // Plain string body
                    headers.set('Content-Type', 'text/plain; charset=utf-8');
                }
            }

            // Add Accept header if not provided
            const userHeaders = opts.headers || {};
            const hasAccept = Object.keys(userHeaders).some(key => key.toLowerCase() === 'accept');

            if (!hasAccept) {
                headers.set('Accept', 'application/json, text/plain, */*');
            }

            // Add user headers (override defaults)
            Object.entries(userHeaders).forEach(([key, value]) => {
                headers.set(key, value);
            });

            return headers;
        },

        /**
         * Builds fetch passthrough options
         * @param {Object} opts - Request options
         * @returns {Object} Fetch options
         */
        buildFetchPassthrough(opts) {
            const fetchOptions = {};
            const passthroughKeys = [
                'credentials', 'mode', 'cache', 'redirect', 'referrer',
                'referrerPolicy', 'integrity', 'keepalive', 'priority'
            ];

            passthroughKeys.forEach(key => {
                if (opts[key] !== undefined) {
                    fetchOptions[key] = opts[key];
                }
            });

            return fetchOptions;
        },

        /**
         * Gets group key from URL for latestOnly option
         * @param {string} url - Request URL
         * @param {Object} opts - Request options
         * @returns {string} Group key
         */
        getGroupKeyFromUrl(url, opts) {
            if (opts.urlNormalizer) {
                return opts.urlNormalizer(url, opts);
            } else {
                return this.normalizeUrlForGrouping(url, opts.baseUrl);
            }
        },

        /**
         * Normalizes URL for grouping by sorting query parameter keys.
         * Multi-valued parameter order within a key is preserved (server may
         * treat ?color=red&color=blue differently from ?color=blue&color=red).
         *
         * @param {string} url - URL to normalize
         * @param {string} baseUrl - Base URL
         * @returns {string} Normalized URL
         */
        normalizeUrlForGrouping(url, baseUrl) {
            try {
                let defaultBase;
                if (typeof globalThis !== 'undefined' && globalThis.location) {
                    defaultBase = baseUrl || globalThis.location.origin;
                } else {
                    defaultBase = baseUrl || 'http://localhost';
                }

                const urlObj = new URL(url, defaultBase);
                urlObj.hash = '';

                // Sort query parameter keys, but preserve value order within each key
                const params = new URLSearchParams(urlObj.search);
                const sortedParams = new URLSearchParams();

                [...new Set(params.keys())].sort().forEach(key => {
                    // Preserve original insertion order of values for this key
                    params.getAll(key).forEach(value => {
                        sortedParams.append(key, value);
                    });
                });

                urlObj.search = sortedParams.toString();
                return urlObj.toString();
            } catch (e) {
                const error = new Error('Invalid URL for request');
                error.code = 'INVALID_URL';
                error.originalError = e;
                throw error;
            }
        },

        /**
         * Sets up request state and handles grouping.
         * When a user-provided abortController is present, creates a combined
         * internal controller so both user abort and group/timeout abort work
         * independently.
         *
         * @param {Object} config - Request configuration
         * @returns {Object} Request state
         */
        setupRequestState(config) {
            const controller = this.createCombinedController(config);
            let token = 0;

            if (config.groupKey) {
                const prev = this._requestGroups.get(config.groupKey);

                if (prev) {
                    if (prev.controller && !prev.controller.signal.aborted) {
                        prev.controller.abort();
                    }
                    token = prev.token + 1;
                } else {
                    token = 1;
                }

                this._requestGroups.set(config.groupKey, {token, controller});
            }

            return {token, controller, groupKey: config.groupKey, timedOut: false};
        },

        /**
         * Creates a combined abort controller that responds to both internal
         * cancellation (groups, timeout) and an optional user-provided controller.
         *
         * @param {Object} config - Request configuration
         * @returns {AbortController} Combined controller
         */
        createCombinedController(config) {
            const internal = new AbortController();

            if (!config.abortController) {
                return internal;
            }

            // If AbortSignal.any is supported, combine signals
            if (typeof AbortSignal.any === 'function') {
                const combined = new AbortController();
                const anySignal = AbortSignal.any([
                    internal.signal,
                    config.abortController.signal
                ]);

                anySignal.addEventListener('abort', () => {
                    if (!combined.signal.aborted) {
                        combined.abort(anySignal.reason);
                    }
                }, {once: true});

                // Preserve the internal abort method so group cancellation works
                const originalAbort = combined.abort.bind(combined);
                combined.abort = function (reason) {
                    internal.abort(reason);
                    originalAbort(reason);
                };

                return combined;
            }

            // Fallback: wire up user controller to internal
            if (config.abortController.signal.aborted) {
                internal.abort();
            } else {
                config.abortController.signal.addEventListener('abort', () => {
                    if (!internal.signal.aborted) {
                        internal.abort();
                    }
                }, {once: true});
            }

            return internal;
        },

        /**
         * Executes request with retry logic
         * @param {Object} config - Request configuration
         * @param {Object} requestState - Request state
         * @returns {Promise} Response promise
         */
        async executeWithRetry(config, requestState) {
            let lastError;
            const maxAttempts = config.retries + 1;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    return await this.executeFetch(config, requestState);
                } catch (error) {
                    lastError = error;

                    // Don't retry on cancellation
                    if (this.isCancellationError(error)) {
                        throw error;
                    }

                    // Check if we should retry
                    const shouldRetry = config.shouldRetry ?
                        config.shouldRetry(error, attempt, maxAttempts) :
                        this.defaultShouldRetry(error, attempt, maxAttempts);

                    if (!shouldRetry || attempt === maxAttempts) {
                        throw error;
                    }

                    // Calculate delay with backoff strategy
                    const delay = this.calculateRetryDelay(config, attempt, error);

                    if (delay > 0) {
                        await this.delayWithAbortCheck(delay, requestState.controller);
                    }
                }
            }

            throw lastError;
        },

        /**
         * Calculates the delay before the next retry attempt.
         * Respects Retry-After headers for 429 responses, then falls back
         * to the configured backoff strategy.
         *
         * @param {Object} config - Request configuration
         * @param {number} attempt - Current attempt number (1-based)
         * @param {Error} error - The error that triggered the retry
         * @returns {number} Delay in milliseconds
         */
        calculateRetryDelay(config, attempt, error) {
            // Respect Retry-After header from 429 responses
            if (error.response && error.response.status === 429) {
                const retryAfter = error.response.headers.get('Retry-After');

                if (retryAfter) {
                    const seconds = parseInt(retryAfter, 10);

                    if (!isNaN(seconds)) {
                        return Math.min(seconds * 1000, config.retryBackoffMax);
                    }

                    // Retry-After can also be an HTTP-date
                    const date = Date.parse(retryAfter);

                    if (!isNaN(date)) {
                        const delay = date - Date.now();
                        return Math.min(Math.max(0, delay), config.retryBackoffMax);
                    }
                }
            }

            // Apply backoff strategy
            const base = config.retryDelay;

            switch (config.retryBackoff) {
                case 'linear':
                    return Math.min(base * attempt, config.retryBackoffMax);

                case 'fixed':
                    return base;

                case 'exponential':
                default: {
                    // Exponential with jitter to prevent thundering herd
                    const exponential = base * Math.pow(2, attempt - 1);
                    const jitter = exponential * 0.1 * Math.random();
                    return Math.min(exponential + jitter, config.retryBackoffMax);
                }
            }
        },

        /**
         * Default retry logic
         * @param {Error} error - Error that occurred
         * @param {number} attempt - Current attempt number
         * @param {number} maxAttempts - Maximum attempts
         * @returns {boolean} Whether to retry
         */
        defaultShouldRetry(error, attempt, maxAttempts) {
            // Don't retry if we've exhausted attempts
            if (attempt >= maxAttempts) {
                return false;
            }

            // Don't retry cancellation errors
            if (this.isCancellationError(error)) {
                return false;
            }

            // Retry network errors
            if (error.network) {
                return true;
            }

            // Retry 5xx server errors
            if (error.response && error.response.status >= 500) {
                return true;
            }

            // Retry 429 (Too Many Requests)
            return error.response && error.response.status === 429;
        },

        /**
         * Creates a delay promise that respects abort signals
         * @param {number} ms - Milliseconds to delay
         * @param {AbortController} controller - Abort controller to check
         * @returns {Promise} Delay promise
         */
        delayWithAbortCheck(ms, controller) {
            const self = this;
            return new Promise(function (resolve, reject) {
                if (controller.signal.aborted) {
                    reject(self.createTaggedCancellationError('Request was cancelled during retry delay', 'cancelled'));
                    return;
                }

                const timeoutId = setTimeout(function () {
                    resolve();
                }, ms);

                controller.signal.addEventListener('abort', function () {
                    clearTimeout(timeoutId);
                    reject(self.createTaggedCancellationError('Request was cancelled during retry delay', 'cancelled'));
                }, {once: true});
            });
        },

        /**
         * Executes fetch request
         * @param {Object} config - Request configuration
         * @param {Object} requestState - Request state
         * @returns {Promise} Response promise
         */
        async executeFetch(config, requestState) {
            if (requestState.controller.signal.aborted) {
                throw this.createTaggedCancellationError('Request was cancelled before execution', 'cancelled');
            }

            const fetchOptions = {
                method: config.method,
                headers: config.headers,
                body: config.body,
                signal: requestState.controller.signal,
                ...config.fetchOptions
            };

            try {
                return await fetch(config.url, fetchOptions);
            } catch (e) {
                if (e.name === 'TypeError' && !requestState.controller.signal.aborted) {
                    e.network = true;
                }
                throw e;
            }
        },

        /**
         * Processes response
         * @param {Response} response - Fetch response
         * @param {Object} config - Request configuration
         * @param {Object} requestState - Request state
         * @returns {Promise} Parsed response
         */
        async processResponse(response, config, requestState) {
            // Check abort state with ignoreAbort handling
            if (requestState.controller.signal.aborted) {
                if (config.ignoreAbort) {
                    return undefined;
                }

                throw this.createTaggedCancellationError('Request was cancelled during processing', 'cancelled');
            }

            if (!config.validateStatus(response)) {
                const errorText = await this.safeGetResponseText(response);
                const error = new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
                error.code = `HTTP_${response.status}`;
                error.response = response;
                throw error;
            }

            if (config.method === 'HEAD' || [204, 205, 304].includes(response.status)) {
                return undefined;
            }

            return this.parseResponse(response, config.responseType);
        },

        /**
         * Parses response based on type
         * @param {Response} response - Fetch response
         * @param {string} responseType - Response type
         * @returns {Promise} Parsed response
         */
        async parseResponse(response, responseType) {
            try {
                switch (responseType) {
                    case 'json':
                        return await response.json();
                    case 'text':
                        return await response.text();
                    case 'blob':
                        return await response.blob();
                    case 'response':
                        return response;
                    default:
                        return this.autoParseResponse(response);
                }
            } catch (error) {
                const parseError = new Error(`Failed to parse response as ${responseType}: ${error.message}`);
                parseError.code = 'PARSE_ERROR';
                parseError.response = response;
                parseError.originalError = error;
                throw parseError;
            }
        },

        /**
         * Auto-parses response
         * @param {Response} response - Fetch response
         * @returns {Promise} Parsed response
         */
        async autoParseResponse(response) {
            const contentType = response.headers.get('content-type') || '';
            const contentLength = response.headers.get('content-length');

            if (contentLength === '0') {
                return undefined;
            }

            // More specific JSON detection: application/json or application/*+json
            if (/application\/(.+\+)?json/i.test(contentType)) {
                const text = await response.text();
                return text.trim() ? JSON.parse(text) : undefined;
            }

            if (/^text\//i.test(contentType)) {
                return response.text();
            }

            return response.blob();
        },

        /**
         * Safely gets a limited amount of response text for error messages.
         * Uses a streaming approach to avoid reading entire large bodies into memory.
         *
         * @param {Response} response - Fetch response
         * @param {number} [maxBytes=512] - Maximum bytes to read
         * @returns {Promise<string|null>} Response text excerpt or null
         */
        async safeGetResponseText(response, maxBytes = 512) {
            try {
                if (response.bodyUsed) {
                    return null;
                }

                const clone = response.clone();

                // Use streaming reader to avoid reading entire body
                if (clone.body && typeof clone.body.getReader === 'function') {
                    const reader = clone.body.getReader();
                    const chunks = [];
                    let totalBytes = 0;

                    try {
                        while (totalBytes < maxBytes) {
                            const {done, value} = await reader.read();

                            if (done) {
                                break;
                            }

                            const remaining = maxBytes - totalBytes;

                            if (value.length > remaining) {
                                chunks.push(value.slice(0, remaining));
                                totalBytes += remaining;
                            } else {
                                chunks.push(value);
                                totalBytes += value.length;
                            }
                        }
                    } finally {
                        await reader.cancel();
                    }

                    if (chunks.length === 0) {
                        return null;
                    }

                    const decoder = new TextDecoder('utf-8', {fatal: false});
                    const text = chunks.map(c => decoder.decode(c, {stream: true})).join('');
                    return text.slice(0, 200);
                }

                // Fallback for environments without ReadableStream
                const text = await clone.text();
                return text.slice(0, 200);
            } catch {
                return null;
            }
        },

        /**
         * Handles successful response
         * @param {*} data - Response data
         * @param {Object} config - Request configuration
         * @param {Object} requestState - Request state
         * @returns {*} Response data
         */
        handleSuccess(data, config, requestState) {
            if (requestState.controller.signal.aborted) {
                if (config.ignoreAbort) {
                    return undefined;
                } else {
                    throw this.createTaggedCancellationError('Request was cancelled', 'cancelled');
                }
            }

            if (config.onSuccess) {
                try {
                    config.onSuccess(data);
                } catch (callbackError) {
                    console.error('Error in success callback:', callbackError);
                }
            }

            return data;
        },

        /**
         * Handles request errors.
         * NOTE: onError callback fires as a side-effect before the promise rejects.
         * This allows using callbacks for logging/UI while using promises for flow control.
         *
         * @param {Error} error - Request error
         * @param {Object} config - Request configuration
         * @returns {*} Error handling result
         */
        handleError(error, config) {
            const isCancellation = this.isCancellationError(error);

            if (isCancellation && config.ignoreAbort) {
                return undefined;
            }

            if (config.onError) {
                try {
                    config.onError(error);
                } catch (callbackError) {
                    console.error('Error in error callback:', callbackError);
                }
            }

            throw error;
        },

        /**
         * Creates tagged cancellation error
         * @param {string} message - Error message
         * @param {string} type - Cancellation type
         * @returns {Error} Tagged error
         */
        createTaggedCancellationError(message, type) {
            const error = new Error(message);
            error.name = 'CancellationError';
            error.code = `CANCEL_${type.toUpperCase()}`;
            error.cancellationType = type;
            return error;
        },

        /**
         * Checks if error is cancellation
         * @public
         * @param {Error} error - Error to check
         * @returns {boolean} True if cancellation error
         */
        isCancellationError(error) {
            if (error.name === 'AbortError' || error.name === 'CancellationError') {
                return true;
            }

            if (error.cancellationType) {
                const cancellationTypes = ['timeout', 'cancelled', 'superseded'];
                return cancellationTypes.includes(error.cancellationType);
            }

            return false;
        },

        /**
         * Cleans up request tracking
         * @param {string} groupKey - Group key
         * @param {number} token - Request token
         */
        cleanupRequest(groupKey, token) {
            if (!groupKey) {
                return;
            }

            const current = this._requestGroups.get(groupKey);

            if (!current) {
                return;
            }

            // Only cleanup if this is the current request or no newer request exists
            if (current.token === token) {
                this._requestGroups.delete(groupKey);
            }
        }
    };

    // Static version property
    WakaSync.VERSION = VERSION;

    // Create default instance
    const wakaSync = new WakaSync();

    /* globals module, define */
    // UMD export: CommonJS, AMD, and browser global
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {WakaSync, wakaSync};
    } else if (typeof define === 'function' && define.amd) {
        define(function () {
            return {WakaSync, wakaSync};
        });
    } else if (typeof window !== 'undefined') {
        window.WakaSync = WakaSync;
        window.wakaSync = wakaSync;
    }
})();