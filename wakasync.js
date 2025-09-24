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

(function() {
    "use strict";

    /**
     * WakaSync - Advanced HTTP Client
     * @constructor
     */
    function WakaSync() {
        // Request tracking for grouping and cancellation
        this._requestGroups = new Map();

        // Default configuration
        this.config = {
            timeout: 30000,
            retries: 0,
            retryDelay: 1000,
            validateStatus: (response) => response.ok,
            responseType: 'auto',
            headers: {
                'User-Agent': 'WakaSync/1.0'
            }
        };
    }

    WakaSync.prototype = {
        /**
         * Makes an HTTP request with advanced options
         * @param {string} url - The URL to request
         * @param {Object} opts - Request options
         * @param {string} [opts.method='GET'] - HTTP method
         * @param {Object} [opts.headers] - Additional headers
         * @param {*} [opts.data] - Request body data
         * @param {string} [opts.groupKey] - Group key for request cancellation
         * @param {boolean} [opts.latestOnly] - Use URL as groupKey automatically
         * @param {boolean} [opts.ignoreAbort] - Suppress AbortError when cancelled
         * @param {Function} [opts.onSuccess] - Success callback
         * @param {Function} [opts.onError] - Error callback
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
         * @param {number} [opts.retryDelay=1000] - Delay between retries in milliseconds
         * @param {Function} [opts.shouldRetry] - Custom retry logic
         * @returns {Promise} Promise that resolves with response data
         */
        request(url, opts = {}) {
            // Extract and validate configuration
            const config = this.validateAndNormalizeConfig(url, opts);

            // Initialize request tracking
            if (!this._requestGroups) {
                this._requestGroups = new Map();
            }

            // Setup request state and immediately register to prevent race conditions
            const requestState = this.setupRequestState(config);

            // Create timeout promise for request timeout handling
            const timeoutPromise = config.timeout > 0 ?
                this.createTimeoutPromise(config.timeout, requestState.controller) :
                null;

            // Create the main fetch promise with retry logic
            const fetchPromise = this.executeWithRetry(config, requestState)
                .then(response => this.processResponse(response, config, requestState))
                .then(data => this.handleSuccess(data, config, requestState))
                .catch(error => this.handleError(error, config));

            // Race between fetch and timeout (if timeout is enabled)
            const finalPromise = timeoutPromise ?
                Promise.race([fetchPromise, timeoutPromise]) :
                fetchPromise;

            return finalPromise.finally(() => {
                this.cleanupRequest(config.groupKey, requestState.token);
            });
        },

        /**
         * Convenience method for GET requests
         * @param {string} url - Request URL
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        get(url, opts = {}) {
            return this.request(url, { ...opts, method: 'GET' });
        },

        /**
         * Convenience method for POST requests
         * @param {string} url - Request URL
         * @param {*} data - Request body data
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        post(url, data, opts = {}) {
            return this.request(url, { ...opts, method: 'POST', data });
        },

        /**
         * Convenience method for PUT requests
         * @param {string} url - Request URL
         * @param {*} data - Request body data
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        put(url, data, opts = {}) {
            return this.request(url, { ...opts, method: 'PUT', data });
        },

        /**
         * Convenience method for DELETE requests
         * @param {string} url - Request URL
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        delete(url, opts = {}) {
            return this.request(url, { ...opts, method: 'DELETE' });
        },

        /**
         * Convenience method for PATCH requests
         * @param {string} url - Request URL
         * @param {*} data - Request body data
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        patch(url, data, opts = {}) {
            return this.request(url, { ...opts, method: 'PATCH', data });
        },

        /**
         * Convenience method for HEAD requests
         * @param {string} url - Request URL
         * @param {Object} opts - Request options
         * @returns {Promise} Promise that resolves with response data
         */
        head(url, opts = {}) {
            return this.request(url, { ...opts, method: 'HEAD' });
        },

        /**
         * Creates a new WakaSync instance with default configuration
         * @param {Object} defaultConfig - Default configuration to apply
         * @returns {WakaSync} New WakaSync instance
         */
        create(defaultConfig = {}) {
            const instance = new WakaSync();
            instance.config = { ...this.config, ...defaultConfig };
            return instance;
        },

        /**
         * Cancels all requests in a group
         * @param {string} groupKey - Group key to cancel
         */
        cancelGroup(groupKey) {
            if (!groupKey || !this._requestGroups) {
                return;
            }

            const group = this._requestGroups.get(groupKey);
            if (group && group.controller && !group.controller.signal.aborted) {
                group.controller.abort();
            }
        },

        /**
         * Cancels all active requests
         */
        cancelAll() {
            if (!this._requestGroups) {
                return;
            }

            this._requestGroups.forEach(group => {
                if (group.controller && !group.controller.signal.aborted) {
                    group.controller.abort();
                }
            });

            this._requestGroups.clear();
        },

        /**
         * Gets the number of active requests
         * @returns {number} Number of active requests
         */
        getActiveRequestCount() {
            if (!this._requestGroups) {
                return 0;
            }

            let count = 0;
            this._requestGroups.forEach(group => {
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
                throw new Error('URL must be a non-empty string');
            }

            // Merge with instance config and provided options
            const merged = { ...this.config, ...opts };

            // Validate callback functions
            this.validateCallbacks(merged);
            this.validateAbortControls(merged);

            // Process method and body
            const { method, body } = this.normalizeMethodAndBody(merged);

            // Build headers
            const headers = this.buildHeaders(merged, body);

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
                shouldRetry: merged.shouldRetry
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

            validators.forEach(([name, fn]) => {
                if (fn && typeof fn !== 'function') {
                    throw new Error(`${name} must be a function`);
                }
            });
        },

        /**
         * Validates abort controller options
         * @param {Object} opts - Request options
         */
        validateAbortControls(opts) {
            if (opts.abortController && typeof opts.abortController.abort !== 'function') {
                throw new Error('abortController must have an abort method');
            }
        },

        /**
         * Normalizes HTTP method and body
         * @param {Object} opts - Request options
         * @returns {Object} Object with method and body
         */
        normalizeMethodAndBody(opts) {
            const method = (opts.method || 'GET').toUpperCase();

            // GET and HEAD don't use body data
            if (['GET', 'HEAD'].includes(method)) {
                if (opts.data !== undefined) {
                    console.warn(`Method ${method} should not have a body. Data will be ignored.`);
                }
                return { method };
            }

            // Process body data for other methods
            let body;
            if (opts.data !== undefined) {
                if (typeof opts.data === 'string' ||
                    opts.data instanceof FormData ||
                    opts.data instanceof Blob ||
                    opts.data instanceof ArrayBuffer) {
                    body = opts.data;
                } else {
                    body = JSON.stringify(opts.data);
                }
            }

            return { method, body };
        },

        /**
         * Builds headers object
         * @param {Object} opts - Request options
         * @param {*} body - Request body
         * @returns {Headers} Headers object
         */
        buildHeaders(opts, body) {
            const headers = new Headers();

            // Add default headers
            headers.set('X-WakaSync-Request', 'true');

            // Add content type based on body
            if (body !== undefined) {
                if (body instanceof FormData) {
                    // Don't set Content-Type for FormData
                } else if (body instanceof Blob || body instanceof ArrayBuffer) {
                    headers.set('Content-Type', 'application/octet-stream');
                } else if (typeof body === 'string') {
                    headers.set('Content-Type', 'text/plain; charset=utf-8');
                } else {
                    headers.set('Content-Type', 'application/json; charset=utf-8');
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
                return opts.urlNormalizer(url);
            } else {
                return this.normalizeUrlForGrouping(url, opts.baseUrl);
            }
        },

        /**
         * Normalizes URL for grouping
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

                // Sort query parameters
                const params = new URLSearchParams(urlObj.search);
                const sortedParams = new URLSearchParams();

                [...params.keys()].sort().forEach(key => {
                    params.getAll(key).sort().forEach(value => {
                        sortedParams.append(key, value);
                    });
                });

                urlObj.search = sortedParams.toString();
                return urlObj.toString();
            } catch {
                return url;
            }
        },

        /**
         * Sets up request state and handles grouping
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

                this._requestGroups.set(config.groupKey, { token, controller });
            }

            return { token, controller, groupKey: config.groupKey };
        },

        /**
         * Creates combined controller
         * @param {Object} config - Request configuration
         * @returns {AbortController} Controller
         */
        createCombinedController(config) {
            if (config.abortController) {
                return config.abortController;
            } else {
                return new AbortController();
            }
        },

        /**
         * Creates timeout promise
         * @param {number} timeout - Timeout in milliseconds
         * @param {AbortController} controller - Abort controller
         * @returns {Promise} Timeout promise
         */
        createTimeoutPromise(timeout, controller) {
            return new Promise((_, reject) => {
                if (controller.signal.aborted) {
                    reject(this.createTaggedCancellationError('Request was cancelled before timeout', 'timeout'));
                    return;
                }

                const timeoutId = setTimeout(() => {
                    if (!controller.signal.aborted) {
                        controller.abort();
                        reject(this.createTaggedCancellationError(`Request timeout after ${timeout}ms`, 'timeout'));
                    }
                }, timeout);

                controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
            });
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

                    // Wait before retry
                    if (config.retryDelay > 0) {
                        await this.delay(config.retryDelay);
                    }
                }
            }

            throw lastError;
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
            if (error.response && error.response.status === 429) {
                return true;
            }

            return false;
        },

        /**
         * Creates a delay promise
         * @param {number} ms - Milliseconds to delay
         * @returns {Promise} Delay promise
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
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
            if (requestState.controller.signal.aborted) {
                throw this.createTaggedCancellationError('Request was cancelled during processing', 'cancelled');
            }

            if (!config.validateStatus(response)) {
                const errorText = await this.safeGetResponseText(response);
                const error = new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
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
                throw new Error(`Failed to parse response as ${responseType}: ${error.message}`);
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

            if (/json|\+json/i.test(contentType)) {
                const text = await response.text();
                return text.trim() ? JSON.parse(text) : undefined;
            }

            if (/^text\//i.test(contentType)) {
                return response.text();
            }

            return response.blob();
        },

        /**
         * Safely gets response text for errors
         * @param {Response} response - Fetch response
         * @returns {Promise} Response text or null
         */
        async safeGetResponseText(response) {
            try {
                if (response.bodyUsed) {
                    return null;
                }
                const clone = response.clone();
                const text = await clone.text();
                return text.substring(0, 200);
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
         * Handles request errors
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
            error.cancellationType = type;
            return error;
        },

        /**
         * Checks if error is cancellation
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

            if (current.token === token) {
                this._requestGroups.delete(groupKey);
            } else if (current.token < token) {
                console.warn(`Cleaning up stale request entry for ${groupKey}`);
                this._requestGroups.delete(groupKey);
            }
        }
    };

    // Create default instance
    const wakaSync = new WakaSync();

    // Export to global scope
    if (typeof window !== 'undefined') {
        window.WakaSync = WakaSync;
        window.wakaSync = wakaSync;
    }
})();