/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ███╗   ███╗ █████╗ ███████╗██╗  ██╗               ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗████╗ ████║██╔══██╗██╔════╝██║ ██╔╝               ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██╔████╔██║███████║███████╗█████╔╝                ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║╚██╔╝██║██╔══██║╚════██║██╔═██╗                ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██║ ╚═╝ ██║██║  ██║███████║██║  ██╗               ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝               ║
 * ║                                                                                      ║
 * ║  WakaPAC Plugin — WakaMask                                                           ║
 * ║                                                                                      ║
 * ║  Live input masking (phone numbers, dates, codes — any literal/placeholder           ║
 * ║  pattern) implemented entirely on top of WakaPAC's existing message pipeline.        ║
 * ║  No parallel DOM listeners: the plugin installs a single global message hook         ║
 * ║  and intercepts MSG_KEYDOWN, MSG_CHAR, and MSG_PASTE for elements it owns,           ║
 * ║  the same pipeline every keystroke and paste already flows through.                  ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(WakaMask);                                                            ║
 * ║                                                                                      ║
 * ║  HTML:                                                                               ║
 * ║    <input type="text" data-pac-mask="999-999-9999" data-pac-value="phone">           ║
 * ║                                                                                      ║
 * ║  Pattern tokens:                                                                     ║
 * ║    9  — digit            [0-9]                                                       ║
 * ║    a  — letter           [A-Za-z]                                                    ║
 * ║    *  — alphanumeric     [A-Za-z0-9]                                                 ║
 * ║    \x — literal x        (escape a token character so it's treated as literal)       ║
 * ║    anything else is inserted automatically and cannot be typed over                  ║
 * ║                                                                                      ║
 * ║  Messages dispatched (via sendMessage — synchronous, same call stack):               ║
 * ║    MSG_MASK_COMPLETE — every non-literal slot is filled;                             ║
 * ║                        wParam = raw value length,                                    ║
 * ║                        extended.target = the <input>, extended.value = formatted     ║
 * ║    MSG_MASK_REJECT   — a typed character didn't match its slot and was dropped;      ║
 * ║                        wParam = rejected character code, extended.target = the       ║
 * ║                        <input>. Does NOT fire when the mask is simply full — that's  ║
 * ║                        expected behavior, not a rejection.                           ║
 * ║                                                                                      ║
 * ║  event.target does NOT identify which input fired these messages: they go through    ║
 * ║  sendMessage() -> createPacMessage(), which sets no target override, so the top-     ║
 * ║  level event.target resolves to the PAC container (set by the native dispatchEvent() ║
 * ║  call), not the input. Use extended.target (event.detail.target) instead — named to  ║
 * ║  match the same concept on real DOM-originated messages, just one level deeper.      ║
 * ║  Matters as soon as a component has more than one masked field.                      ║
 * ║                                                                                      ║
 * ║  API:                                                                                ║
 * ║    WakaMask.setValue(input, value)  — programmatically set a masked input's value.   ║
 * ║                                        Accepts raw or already-formatted input;       ║
 * ║                                        non-mask characters are stripped and the      ║
 * ║                                        result is reformatted. Fires a real 'input'   ║
 * ║                                        event so two-way bindings stay in sync.       ║
 * ║    WakaMask.getRawValue(input)       — returns the significant characters only,      ║
 * ║                                        with literals stripped out.                   ║
 * ║                                                                                      ║
 * ║  Known limitations:                                                                  ║
 * ║    - input[type="number"] is not supported — the spec forbids setSelectionRange()    ║
 * ║      on it. Use type="text" with inputmode="numeric" for numeric masks instead.      ║
 * ║    - Inputs added to the DOM after their container's onComponentCreated fires        ║
 * ║      (e.g. rows appended inside a foreach after initial render) are not picked up.   ║
 * ║      Re-scan manually via WakaMask.registerElement() if you need this — not          ║
 * ║      currently exposed, since it hasn't come up in practice yet.                     ║
 * ║    - IME composition (event.key === 'Process') is not intercepted. Composed text     ║
 * ║      lands in the field unmasked; the field will format correctly on the next        ║
 * ║      plain keystroke, paste, or WakaMask.setValue() call, but not while composing.   ║
 * ║    - MSG_PLUGIN offsets below assume no other installed plugin has claimed the       ║
 * ║      0x200 range. WakaYouTube/WakaVideo use 0x100–0x10C; if you have other plugins   ║
 * ║      installed, check their offsets don't collide with this one.                     ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    // =========================================================================
    // Pattern parsing
    // =========================================================================

    /**
     * Token shapes produced by parseMaskPattern():
     *   { type: 'digit' | 'letter' | 'alnum' }  — a fillable slot
     *   { literal: '<char>' }                    — an auto-inserted, non-editable character
     * @typedef {{type?: string, literal?: string}} MaskToken
     */

    /**
     * Parses a data-pac-mask pattern string into an ordered token list.
     * @param {string} pattern
     * @returns {MaskToken[]}
     */
    function parseMaskPattern(pattern) {
        const tokens = [];

        for (let i = 0; i < pattern.length; i++) {
            const ch = pattern[i];

            if (ch === '\\' && i + 1 < pattern.length) {
                tokens.push({ literal: pattern[i + 1] });
                i++;
                continue;
            }

            switch (ch) {
                case '9':
                    tokens.push({ type: 'digit' });
                    break;

                case 'a':
                    tokens.push({ type: 'letter' });
                    break;

                case '*':
                    tokens.push({ type: 'alnum' });
                    break;

                default:
                    tokens.push({ literal: ch });
                    break;
            }
        }

        return tokens;
    }

    /**
     * Tests whether a single character satisfies a fillable token's type.
     * @param {string} ch
     * @param {string} type - 'digit' | 'letter' | 'alnum'
     * @returns {boolean}
     */
    function matchesToken(ch, type) {
        switch (type) {
            case 'digit':
                return /[0-9]/.test(ch);

            case 'letter':
                return /[A-Za-z]/.test(ch);

            case 'alnum':
                return /[A-Za-z0-9]/.test(ch);

            default:
                return false;
        }
    }

    /**
     * Total number of fillable (non-literal) slots in a token list.
     * Used to detect when a mask is fully satisfied.
     * @param {MaskToken[]} tokens
     * @returns {number}
     */
    function countFillableSlots(tokens) {
        return tokens.reduce((n, t) => n + (t.literal === undefined ? 1 : 0), 0);
    }

    // =========================================================================
    // Formatting
    // =========================================================================

    /**
     * Builds the formatted display string for a sequence of raw significant
     * characters, walking the token list in order. Literal characters are
     * auto-inserted immediately after the slot they follow has just been
     * filled (or while more raw input remains), so separators appear the
     * instant a block is complete rather than only once the whole mask fills.
     * Raw characters that don't match their slot are dropped silently — the
     * caller decides whether to report the rejection via MSG_MASK_REJECT.
     * @param {MaskToken[]} tokens
     * @param {string} rawChars
     * @returns {string} The formatted value
     */
    function formatValue(tokens, rawChars) {
        let result = '';
        let ti = 0;
        let ri = 0;
        let justFilled = false;

        while (ti < tokens.length) {
            const token = tokens[ti];

            if (token.literal !== undefined) {
                if (ri < rawChars.length || justFilled) {
                    result += token.literal;
                    ti++;

                    // If the user typed the literal themselves (e.g. the dash in a
                    // phone number), consume it so it isn't re-inserted as raw input.
                    if (rawChars[ri] === token.literal) {
                        ri++;
                    }

                    continue;
                }

                break;
            }

            justFilled = false;

            if (ri >= rawChars.length) {
                break;
            }

            if (matchesToken(rawChars[ri], token.type)) {
                result += rawChars[ri];
                ti++;
                ri++;
                justFilled = true;
            } else {
                // Doesn't fit this slot — drop it and retry the same slot
                // against the next raw character.
                ri++;
            }
        }

        return result;
    }

    /**
     * Reverses formatValue(): given a previously mask-conformant display value,
     * extracts just the significant (non-literal) characters. Assumes the value
     * was produced by this plugin — arbitrary strings (initial server-rendered
     * values, pasted text) should go through sanitizeToRaw() instead.
     * @param {MaskToken[]} tokens
     * @param {string} value
     * @returns {string}
     */
    function extractRaw(tokens, value) {
        let raw = '';
        let ti = 0;
        let vi = 0;

        while (ti < tokens.length && vi < value.length) {
            const token = tokens[ti];

            if (token.literal !== undefined) {
                if (value[vi] === token.literal) {
                    vi++;
                }

                ti++;
                continue;
            }

            if (matchesToken(value[vi], token.type)) {
                raw += value[vi];
                ti++;
                vi++;
            } else {
                // Value isn't mask-conformant at this position — skip defensively
                // rather than throwing. Shouldn't normally happen.
                vi++;
            }
        }

        return raw;
    }

    /**
     * Strips an arbitrary string (pasted text, an initial server-rendered value)
     * down to alphanumeric candidates and formats them against the mask. Unlike
     * extractRaw(), this doesn't assume the input already conforms to the mask —
     * literals already present (e.g. pasting an already-formatted phone number)
     * are discarded and rebuilt rather than matched positionally.
     * @param {MaskToken[]} tokens
     * @param {string} arbitraryString
     * @returns {string} Formatted value
     */
    function sanitizeAndFormat(tokens, arbitraryString) {
        const candidates = arbitraryString.replace(/[^A-Za-z0-9]/g, '');
        return formatValue(tokens, candidates);
    }

    // =========================================================================
    // Registry
    // =========================================================================

    /**
     * Registered masked inputs, keyed by the <input> element itself.
     * @type {Map<HTMLInputElement, {tokens: MaskToken[], pattern: string, pacId: string}>}
     */
    const _registry = new Map();

    /**
     * Scans a container for [data-pac-mask] inputs and registers each one.
     * Reformats any pre-existing value (e.g. server-rendered) so it starts
     * mask-conformant.
     * @param {HTMLElement} container
     * @param {string} pacId
     */
    function registerContainer(container, pacId) {
        const inputs = container.querySelectorAll('input[data-pac-mask]');

        inputs.forEach((input) => {
            if (input.type === 'number') {
                console.warn('WakaMask: input[type="number"] does not support setSelectionRange() and cannot be masked. Use type="text" with inputmode="numeric" instead.', input);
                return;
            }

            const pattern = input.getAttribute('data-pac-mask');

            if (!pattern) {
                return;
            }

            const tokens = parseMaskPattern(pattern);
            _registry.set(input, { tokens, pattern, pacId });

            if (input.value) {
                const formatted = sanitizeAndFormat(tokens, input.value);

                if (formatted !== input.value) {
                    input.value = formatted;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });
    }

    /**
     * Removes all registered inputs belonging to a destroyed component.
     * @param {string} pacId
     */
    function unregisterContainer(pacId) {
        for (const [input, entry] of _registry) {
            if (entry.pacId === pacId) {
                _registry.delete(input);
            }
        }
    }

    // =========================================================================
    // Caret-aware value application
    // =========================================================================

    /**
     * Writes a new formatted value + caret position into the input and fires
     * a real 'input' event so WakaPAC's own document-level listener picks it
     * up and syncs any two-way binding — this plugin never talks to the
     * reactive abstraction directly.
     * @param {HTMLInputElement} input
     * @param {string} formatted
     * @param {number} caret
     */
    function applyValue(input, formatted, caret) {
        input.value = formatted;
        input.setSelectionRange(caret, caret);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * Reports mask state after a value-changing operation: fires
     * MSG_MASK_COMPLETE if every fillable slot is now full.
     *
     * Note: messages sent via pac.sendMessage() go through createPacMessage(),
     * which never sets a target override the way wrapDomEventAsMessage() does
     * for real DOM-originated messages. event.target on the delivered message
     * ends up being the PAC container (set by the native dispatchEvent() call),
     * not the input — useless for telling fields apart when a component has
     * more than one masked input. Passed explicitly as extended.target instead.
     *
     * @param {Object} pac
     * @param {string} pacId
     * @param {HTMLInputElement} input
     * @param {MaskToken[]} tokens
     * @param {string} rawValue
     * @param {string} formattedValue
     * @param {number} MSG_MASK_COMPLETE
     */
    function maybeReportComplete(pac, pacId, input, tokens, rawValue, formattedValue, MSG_MASK_COMPLETE) {
        if (rawValue.length === countFillableSlots(tokens)) {
            pac.sendMessage(pacId, MSG_MASK_COMPLETE, rawValue.length, 0, { target: input, value: formattedValue });
        }
    }

    // =========================================================================
    // Message hook handlers
    // =========================================================================

    /**
     * True if Ctrl/Cmd/Alt is held — these are browser/OS shortcuts (select-all,
     * copy, undo, AltGr composition), not mask-relevant keystrokes, and are left
     * alone. Shift is allowed through normally.
     * @param {Object} pac
     * @param {CustomEvent} event
     * @returns {boolean}
     */
    function isBlockingModifier(pac, event) {
        return (event.lParam & pac.KM_CONTROL) !== 0 ||
            (event.lParam & pac.KM_META) !== 0 ||
            (event.lParam & pac.KM_ALT) !== 0;
    }

    /**
     * Walks the token list to find the fillable slot a new character would land
     * on, given how many fillable slots are already consumed before the caret.
     * Returns undefined if there's no slot left — the mask is already full.
     * @param {MaskToken[]} tokens
     * @param {number} filledCount - Fillable slots already consumed before the caret
     * @returns {MaskToken|undefined}
     */
    function findTargetToken(tokens, filledCount) {
        let ti = 0;
        let filled = 0;

        while (ti < tokens.length && filled < filledCount) {
            if (tokens[ti].literal === undefined) {
                filled++;
            }

            ti++;
        }

        while (ti < tokens.length && tokens[ti].literal !== undefined) {
            ti++;
        }

        return tokens[ti];
    }

    /**
     * Handles MSG_KEYDOWN for a registered masked input — Backspace and forward
     * Delete, including range-selection deletes. Everything else (navigation,
     * modifier combos) passes through untouched.
     * @param {Object} pac
     * @param {CustomEvent} event
     * @param {Function} next
     * @param {HTMLInputElement} input
     * @param {{tokens: MaskToken[], pacId: string}} entry
     */
    function handleKeydownMessage(pac, event, next, input, entry) {
        if (isBlockingModifier(pac, event) ||
            (event.wParam !== pac.VK_BACK && event.wParam !== pac.VK_DELETE)) {
            next();
            return;
        }

        const { tokens } = entry;
        const pos = input.selectionStart;
        const selEnd = input.selectionEnd;
        const raw = extractRaw(tokens, input.value);

        let rawArray, deleteIndex;

        if (pos !== selEnd) {
            // A range is selected — delete the whole selection regardless of
            // which key (Backspace or Delete) triggered it.
            const startIdx = extractRaw(tokens, input.value.slice(0, pos)).length;
            const endIdx = extractRaw(tokens, input.value.slice(0, selEnd)).length;
            rawArray = raw.slice(0, startIdx) + raw.slice(endIdx);
            deleteIndex = startIdx;
        } else if (event.wParam === pac.VK_BACK) {
            deleteIndex = extractRaw(tokens, input.value.slice(0, pos)).length - 1;

            if (deleteIndex < 0) {
                next();
                return;
            }

            rawArray = raw.slice(0, deleteIndex) + raw.slice(deleteIndex + 1);
        } else {
            // VK_DELETE — forward delete
            deleteIndex = extractRaw(tokens, input.value.slice(0, pos)).length;

            if (deleteIndex >= raw.length) {
                next();
                return;
            }

            rawArray = raw.slice(0, deleteIndex) + raw.slice(deleteIndex + 1);
        }

        event.preventDefault();

        const formatted = formatValue(tokens, rawArray);
        const caret = formatValue(tokens, rawArray.slice(0, deleteIndex)).length;

        applyValue(input, formatted, caret);
        next();
    }

    /**
     * Handles MSG_CHAR for a registered masked input — validates the typed
     * character against the slot it would land on, then either inserts it,
     * rejects it (MSG_MASK_REJECT), or silently drops it if the mask is
     * already full.
     * @param {Object} pac
     * @param {CustomEvent} event
     * @param {Function} next
     * @param {HTMLInputElement} input
     * @param {{tokens: MaskToken[], pacId: string}} entry
     * @param {{MSG_MASK_COMPLETE: number, MSG_MASK_REJECT: number}} msgConstants
     */
    function handleCharMessage(pac, event, next, input, entry, msgConstants) {
        if (isBlockingModifier(pac, event)) {
            next();
            return;
        }

        const { tokens, pacId } = entry;
        const typedChar = event.originalEvent.key;
        const pos = input.selectionStart;
        const selEnd = input.selectionEnd;
        const raw = extractRaw(tokens, input.value);

        const startIdx = extractRaw(tokens, input.value.slice(0, pos)).length;
        const endIdx = pos !== selEnd
            ? extractRaw(tokens, input.value.slice(0, selEnd)).length
            : startIdx;

        // Locate the token this character would land on and check it fits
        // before doing anything — this is also how we detect + report
        // MSG_MASK_REJECT without mutating anything on a bad keystroke.
        const targetToken = findTargetToken(tokens, startIdx);

        event.preventDefault();

        if (!targetToken) {
            // No slot left at all — the mask is already full. This is
            // expected, not an error (same as hitting maxlength on a
            // plain input), so no MSG_MASK_REJECT fires for it.
            next();
            return;
        }

        if (!matchesToken(typedChar, targetToken.type)) {
            // There IS a slot, but this character is the wrong type for
            // it (e.g. a letter typed into a digit slot) — this is the
            // one genuine rejection case.
            pac.sendMessage(pacId, msgConstants.MSG_MASK_REJECT, typedChar.charCodeAt(0), 0, { target: input });
            next();
            return;
        }

        const rawArray = raw.slice(0, startIdx) + typedChar + raw.slice(endIdx);
        const formatted = formatValue(tokens, rawArray);
        const caret = formatValue(tokens, rawArray.slice(0, startIdx + 1)).length;

        applyValue(input, formatted, caret);
        maybeReportComplete(pac, pacId, input, tokens, extractRaw(tokens, formatted), formatted, msgConstants.MSG_MASK_COMPLETE);
        next();
    }

    /**
     * Handles MSG_PASTE for a registered masked input. Pasted text is stripped
     * to alphanumeric candidates and reformatted from the current caret/selection
     * position — already-formatted pasted numbers (e.g. "555-123-4567") have
     * their literals discarded and rebuilt rather than matched positionally.
     * @param {Object} pac
     * @param {CustomEvent} event
     * @param {Function} next
     * @param {HTMLInputElement} input
     * @param {{tokens: MaskToken[], pacId: string}} entry
     * @param {{MSG_MASK_COMPLETE: number, MSG_MASK_REJECT: number}} msgConstants
     */
    function handlePasteMessage(pac, event, next, input, entry, msgConstants) {
        event.preventDefault();

        const { tokens, pacId } = entry;
        const pastedText = event.detail['text/plain'] ?? '';
        const candidates = pastedText.replace(/[^A-Za-z0-9]/g, '');
        const pos = input.selectionStart;
        const selEnd = input.selectionEnd;
        const raw = extractRaw(tokens, input.value);

        const startIdx = extractRaw(tokens, input.value.slice(0, pos)).length;
        const endIdx = pos !== selEnd
            ? extractRaw(tokens, input.value.slice(0, selEnd)).length
            : startIdx;

        const rawArray = raw.slice(0, startIdx) + candidates + raw.slice(endIdx);
        const formatted = formatValue(tokens, rawArray);

        // Caret goes right after the pasted content: format just the prefix
        // up to (and including) the pasted characters, same technique as the
        // single-character insert case above.
        const caret = formatValue(tokens, rawArray.slice(0, startIdx + candidates.length)).length;

        applyValue(input, formatted, caret);
        maybeReportComplete(pac, pacId, input, tokens, extractRaw(tokens, formatted), formatted, msgConstants.MSG_MASK_COMPLETE);
        next();
    }

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaMask = {

        createPacPlugin(pac, _options = {}) {
            // Derive message constants from the host's MSG_PLUGIN base.
            const MSG_MASK_COMPLETE = pac.MSG_PLUGIN + 0x200;
            const MSG_MASK_REJECT = pac.MSG_PLUGIN + 0x201;

            // Attach constants so components can reference WakaMask.MSG_MASK_COMPLETE etc.
            this.MSG_MASK_COMPLETE = MSG_MASK_COMPLETE;
            this.MSG_MASK_REJECT = MSG_MASK_REJECT;

            const msgConstants = { MSG_MASK_COMPLETE, MSG_MASK_REJECT };

            // Installed once, for the lifetime of the page — intercepts MSG_KEYDOWN,
            // MSG_CHAR, and MSG_PASTE for every masked input on every container,
            // regardless of which component the message would otherwise target.
            // Each message type's logic lives in its own handler function above;
            // this is just the dispatch.
            pac.installMessageHook((event, next) => {
                const entry = _registry.get(event.target);

                if (!entry || (event.message !== pac.MSG_KEYDOWN &&
                    event.message !== pac.MSG_CHAR &&
                    event.message !== pac.MSG_PASTE)) {
                    next();
                    return;
                }

                const input = event.target;

                switch (event.message) {
                    case pac.MSG_KEYDOWN:
                        handleKeydownMessage(pac, event, next, input, entry);
                        break;
                    case pac.MSG_CHAR:
                        handleCharMessage(pac, event, next, input, entry, msgConstants);
                        break;
                    case pac.MSG_PASTE:
                        handlePasteMessage(pac, event, next, input, entry, msgConstants);
                        break;
                }
            });

            return {
                /**
                 * Called by WakaPAC after a component is created. Scans the new
                 * container for [data-pac-mask] inputs and registers each one.
                 * @param {Object} _abstraction
                 * @param {string} pacId
                 * @param {Object} _config
                 */
                onComponentCreated(_abstraction, pacId, _config) {
                    const container = pac.getContainerByPacId(pacId);

                    if (container) {
                        registerContainer(container, pacId);
                    }
                },

                /**
                 * Called by WakaPAC when a component is destroyed. Unregisters
                 * every masked input that belonged to it.
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    unregisterContainer(pacId);
                }
            };
        },

        // =====================================================================
        // Public API
        // =====================================================================

        /**
         * Programmatically sets a masked input's value. Accepts raw digits/letters
         * or an already-formatted string — non-mask characters are stripped and
         * the result is reformatted against the input's pattern. Fires a real
         * 'input' event so any two-way binding on the field stays in sync.
         * @param {HTMLInputElement} input
         * @param {string} value
         */
        setValue(input, value) {
            const entry = _registry.get(input);

            if (!entry) {
                console.warn('WakaMask.setValue(): element is not a registered masked input.', input);
                return;
            }

            const formatted = sanitizeAndFormat(entry.tokens, String(value));
            applyValue(input, formatted, formatted.length);
        },

        /**
         * Returns the significant characters of a masked input's current value,
         * with literals stripped out.
         * @param {HTMLInputElement} input
         * @returns {string}
         */
        getRawValue(input) {
            const entry = _registry.get(input);

            if (!entry) {
                console.warn('WakaMask.getRawValue(): element is not a registered masked input.', input);
                return '';
            }

            return extractRaw(entry.tokens, input.value);
        }
    };

    window.wakaMask = window.WakaMask;

})();