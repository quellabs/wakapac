/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║    ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██████╗  █████╗  ██████╗                        ║
 * ║    ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██╔════╝                        ║
 * ║    ██║ █╗ ██║███████║█████╔╝ ███████║██████╔╝███████║██║                             ║
 * ║    ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██╔═══╝ ██╔══██║██║                             ║
 * ║    ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██║     ██║  ██║╚██████╗                        ║
 * ║     ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝ ╚═════╝                        ║
 * ║                                                                                      ║
 * ║  PAC Framework - Presentation-Abstraction-Control for JavaScript                     ║
 * ║                                                                                      ║
 * ║  A powerful reactive framework that creates hierarchical components with two-way     ║
 * ║  data binding, event handling, and automatic DOM synchronization. Supports           ║
 * ║  deep reactivity for arrays and nested objects!                                      ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // =============================================================================
    // CONSTANTS AND CONFIGURATION
    // =============================================================================

    /** @type {string} Selector for PAC-managed containers */
    const CONTAINER_SEL = '[data-pac-id]';

    /** @type {string} Selector for containers that accept drops */
    const DROP_TARGET_SEL = '[data-pac-drop-target]';

    /**
     * Libraries passed to wakaPAC.use(). Tracked to prevent
     * duplicate registration — the duplicate check compares
     * against these original references.
     * @type {Array<Object>}
     */
    const _registeredLibs = [];

    /**
     * Plugin descriptors returned by each library's createPacPlugin().
     * Contains the lifecycle hooks (onComponentCreated, onComponentDestroyed)
     * that wakaPAC invokes during component creation and cleanup.
     * @type {Array<Object>}
     */
    const _plugins = [];

    /**
     * Unit function registries keyed by unit name.
     * Populated by plugins that return a `functions` object from createPacPlugin().
     * @type {Map<string, Object>}
     */
    const _units = new Map();

    /**
     * Maps library objects to their registered unit names.
     * Populated by wakaPAC.use() for libraries that expose a named function set.
     * Enables wakaPAC.unit(CollectionUtils) as an alternative to wakaPAC.unit('CollectionUtils').
     * @type {WeakMap<Object, string>}
     */
    const _unitNames = new WeakMap();

    /**
     * Registered message hooks, installed via wakaPAC.installMessageHook().
     * Each entry holds a handle (for removal) and the hook function.
     * Hooks are invoked in registration order before the message reaches its container.
     * @type {Array<{handle: number, fn: Function}>}
     */
    const _hooks = [];

    /** Registry of partial templates; keys are names, values are raw textContent strings. @type {Map<string, string>} */
    const _partials = new Map();

    /** Guards collectPartials() so it only runs once. @type {boolean} */
    let _partialsCollected = false;

    /**
     * Monotonically increasing counter used to generate unique hook handles.
     * Returned by installMessageHook() and used by uninstallMessageHook() to
     * identify which hook to remove. Equivalent to Win32 HHOOK.
     * @type {number}
     */
    let _nextHookHandle = 1;

    /**
     * Matches handlebars-style interpolation: {{variable}}
     * Captures variable name/expression with global flag
     * @type {RegExp}
     */
    const INTERPOLATION_REGEX = /\{\{(?!>)\s*([^}]+)\s*}}/g;

    /**
     * Tests for presence of interpolation syntax without capture groups
     * More efficient for boolean checks than INTERPOLATION_REGEX
     * @type {RegExp}
     */
    const INTERPOLATION_TEST_REGEX = /\{\{(?!>).*?}}/;

    /**
     * Extracts foreach item metadata from PAC syntax
     * Format: "pac-foreach-item: name, index=N, renderIndex=M"
     * Captures: [itemName, index, renderIndex] (indices as strings)
     * @type {RegExp}
     */
    const FOREACH_INDEX_REGEX = /pac-foreach-item:\s*([^,]+),\s*index=(\d+),\s*renderIndex=(\d+)/;

    /**
     * Matches wp-if comment directives
     * Format: <!-- wp-if: expression --> or <!-- /wp-if --> or <!-- wp-else -->
     * Captures: expression for opening tags
     * Note: Comment nodes don't include <!-- --> in their textContent
     * @type {RegExp}
     */
    const WP_IF_COMMENT_REGEX = /^\s*wp-if:\s*(.+?)\s*$/;
    const WP_IF_CLOSE_COMMENT_REGEX = /^\s*\/wp-if\s*$/;
    const WP_ELSE_IF_COMMENT_REGEX = /^\s*wp-else-if:\s*(.+?)\s*$/;
    const WP_ELSE_COMMENT_REGEX = /^\s*wp-else\s*$/;

    /** Attribute for partial definition elements: <script type="text/template" data-pac-partial="name"> */
    const PAC_PARTIAL_ATTR = 'data-pac-partial';

    /** Custom event names dispatched on PAC containers */
    const EV_PAC_EVENT = 'pac:event';
    const EV_PAC_CHANGE = 'pac:change';
    const EV_PAC_BROWSER_STATE = 'pac:browser-state';

    /**
     * Matches {{> name}} and {{> name root}} injection syntax in raw strings.
     * Capture group 1: partial name
     * Capture group 2: optional root alias (the argument passed to the partial)
     * @type {RegExp}
     */
    const PARTIAL_INJECT_REGEX = /\{\{>\s*([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s+([a-zA-Z_$][a-zA-Z0-9_$.]*))?\s*}}/g;

    /**
     * Matches the parameter placeholder "$." inside a partial body.
     * Replaced with "rootAlias." during expansion when a root argument is passed.
     * @type {RegExp}
     */
    const PARTIAL_PARAM_REGEX = /\$\./g;

    /**
     * This regexp finds runs of dots and square brackets.
     * @type {RegExp}
     */
    const DOTS_AND_BRACKETS_PATTERN = /[.[\]]+/;

    /**
     * HTML attributes that are boolean (present = true, absent = false)
     * @constant {string[]}
     */
    const BOOLEAN_ATTRIBUTES = new Set([
        "readonly", "required", "selected", "checked", "hidden", "multiple", "autofocus",
        "disabled", "async", "defer", "formnovalidate", "ismap", "novalidate",
        "open", "reversed", "scoped", "seamless", "truespeed"
    ]);

    // List of extended keys
    const EXTENDED_KEYS = new Set([
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
        'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete',
        'NumpadEnter', 'NumpadDivide', 'MetaLeft', 'MetaRight', 'ContextMenu'
    ]);

    // List of text input types
    const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']);

    /**
     * List of tags that are interactive. Used primarily for MSG_MOUSEENTER_DESCENDANT and MSG_MOUSELEAVE_DESCENDANT
     */
    const INTERACTIVE_TAGS = new Set(['A', 'BUTTON', 'DETAILS', 'INPUT', 'LABEL', 'SELECT', 'SUMMARY', 'TEXTAREA',]);

    // Non-text input types that commit values via the change event.
    const CHANGE_INPUT_TYPES = new Set(['checkbox', 'radio', 'color', 'range', 'date', 'datetime-local', 'month', 'week', 'time']);

    /**
     * Reverse mapping cache from virtual-key codes to human-readable names.
     * Populated on first use to avoid repeated reflection on wakaPAC.
     * @type {Object<number, string>|null}
     */
    let cachedKeyNames = null;

    /**
     * The wheel delta constant (120 units per notch is Win32 standard)
     * @type {number}
     */
    const WHEEL_DELTA = 120;

    /**
     * Windows-style message type constants for event handling
     * Hex values match Win32 API message identifiers
     */
    const MSG_UNKNOWN = 0x0000;
    const MSG_DESTROYED = 0x0002;
    const MSG_SIZE = 0x0005;
    const MSG_PAINT = 0x000F;
    const MSG_DPR_CHANGE = 0x0010;
    const MSG_MOUSEMOVE = 0x0200;
    const MSG_LBUTTONDOWN = 0x0201;
    const MSG_LBUTTONUP = 0x0202;
    const MSG_LBUTTONDBLCLK = 0x0203;
    const MSG_RBUTTONDOWN = 0x0204;
    const MSG_RBUTTONUP = 0x0205;
    const MSG_MBUTTONDOWN = 0x0207;
    const MSG_MBUTTONUP = 0x0208;
    const MSG_MOUSEENTER = 0x020B;
    const MSG_MOUSELEAVE = 0x020C;
    const MSG_MOUSEENTER_DESCENDANT = 0x020D;
    const MSG_MOUSELEAVE_DESCENDANT = 0x020E;
    const MSG_LCLICK = 0x0210;
    const MSG_MCLICK = 0x0211;
    const MSG_RCLICK = 0x0212;
    const MSG_CONTEXTMENU = 0x007B;
    const MSG_CAPTURECHANGED = 0x0215;
    const MSG_DRAGENTER = 0x0231;
    const MSG_DRAGOVER  = 0x0232;
    const MSG_DRAGLEAVE = 0x0233;
    const MSG_DROP      = 0x0234;
    const MSG_CHAR = 0x0300;
    const MSG_CHANGE = 0x0301;
    const MSG_SUBMIT = 0x0302;
    const MSG_INPUT = 0x0303;
    const MSG_INPUT_COMPLETE = 0x0304;
    const MSG_COPY = 0x0305;
    const MSG_PASTE = 0x0306;
    const MSG_SETFOCUS = 0x0007;
    const MSG_KILLFOCUS = 0x0008;
    const MSG_KEYDOWN = 0x0100;
    const MSG_KEYUP = 0x0101;
    const MSG_ACCEL = 0x0112;
    const MSG_COMMAND = 0x0111;
    const MSG_TIMER = 0x0113;
    const MSG_MOUSEWHEEL = 0x020A;
    const MSG_GESTURE = 0x0250;
    const MSG_FOREACH_REBUILT = 0x0400;
    const MSG_WEBGL_READY = 0x0401;
    const MSG_WEBGL_CONTEXT_LOST = 0x0402;
    const MSG_WEBGL_CONTEXT_RESTORED = 0x0403;
    const MSG_USER = 0x1000;
    const MSG_PLUGIN = 0x2000;

    /**
     * Mouse and keyboard modifier key state flags
     * Used as bitmask - multiple flags can be OR'd together
     */
    const MK_LBUTTON  = 0x0001;  // Left mouse button
    const MK_RBUTTON  = 0x0002;  // Right mouse button
    const MK_SHIFT    = 0x0004;  // Shift key
    const MK_CONTROL  = 0x0008;  // Ctrl key
    const MK_MBUTTON  = 0x0010;  // Middle mouse button
    const MK_XBUTTON1 = 0x0020;  // First extra mouse button (browser back)
    const MK_XBUTTON2 = 0x0040;  // Second extra mouse button (browser forward)
    const MK_ALT      = 0x0080;  // Alt key (extension, not in Win32 wParam)
    const MK_META     = 0x0100;  // Meta/Windows key (extension, not in Win32 wParam)

    /**
     * Keyboard lParam modifier key state flags
     * Used for extracting modifier states from keyboard event lParam
     * These are at different bit positions than MK_* (which are for mouse wParam)
     */
    const KM_SHIFT   = (1 << 25);  // Shift key held down (lParam bit 25)
    const KM_CONTROL = (1 << 26);  // Ctrl key held down (lParam bit 26)
    const KM_META    = (1 << 27);  // Meta/Windows/Command key held down (lParam bit 27)
    const KM_ALT     = (1 << 29);  // Alt key held down (lParam bit 29)

    /**
     * MSG_SIZE constants
     * @type {number}
     */
    const SIZE_RESTORED   = 0; // Normal resize (user action, layout change)
    const SIZE_HIDDEN     = 1; // Element became hidden (width/height = 0)
    const SIZE_FULLSCREEN = 2; // Element entered fullscreen mode

    /**
     * Win32 Virtual Key codes
     * Hex values match Win32 API virtual key code identifiers
     * Reference: https://docs.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
     */
        // Control keys
    const VK_BACK = 0x08;           // Backspace
    const VK_TAB = 0x09;            // Tab
    const VK_RETURN = 0x0D;         // Enter
    const VK_SHIFT = 0x10;          // Shift
    const VK_CONTROL = 0x11;        // Ctrl
    const VK_MENU = 0x12;           // Alt
    const VK_PAUSE = 0x13;          // Pause
    const VK_CAPITAL = 0x14;        // CapsLock
    const VK_ESCAPE = 0x1B;         // Escape
    const VK_SPACE = 0x20;          // Space
    const VK_PRIOR = 0x21;          // Page Up
    const VK_NEXT = 0x22;           // Page Down
    const VK_END = 0x23;            // End
    const VK_HOME = 0x24;           // Home
    const VK_LEFT = 0x25;           // Left Arrow
    const VK_UP = 0x26;             // Up Arrow
    const VK_RIGHT = 0x27;          // Right Arrow
    const VK_DOWN = 0x28;           // Down Arrow
    const VK_SNAPSHOT = 0x2C;       // PrintScreen
    const VK_INSERT = 0x2D;         // Insert
    const VK_DELETE = 0x2E;         // Delete

    // Number keys (0-9)
    const VK_0 = 0x30;
    const VK_1 = 0x31;
    const VK_2 = 0x32;
    const VK_3 = 0x33;
    const VK_4 = 0x34;
    const VK_5 = 0x35;
    const VK_6 = 0x36;
    const VK_7 = 0x37;
    const VK_8 = 0x38;
    const VK_9 = 0x39;

    // Letter keys (A-Z)
    const VK_A = 0x41;
    const VK_B = 0x42;
    const VK_C = 0x43;
    const VK_D = 0x44;
    const VK_E = 0x45;
    const VK_F = 0x46;
    const VK_G = 0x47;
    const VK_H = 0x48;
    const VK_I = 0x49;
    const VK_J = 0x4A;
    const VK_K = 0x4B;
    const VK_L = 0x4C;
    const VK_M = 0x4D;
    const VK_N = 0x4E;
    const VK_O = 0x4F;
    const VK_P = 0x50;
    const VK_Q = 0x51;
    const VK_R = 0x52;
    const VK_S = 0x53;
    const VK_T = 0x54;
    const VK_U = 0x55;
    const VK_V = 0x56;
    const VK_W = 0x57;
    const VK_X = 0x58;
    const VK_Y = 0x59;
    const VK_Z = 0x5A;

    // Windows keys
    const VK_LWIN = 0x5B;           // Left Windows key
    const VK_RWIN = 0x5C;           // Right Windows key
    const VK_APPS = 0x5D;           // Context Menu key

    // Numpad keys
    const VK_NUMPAD0 = 0x60;
    const VK_NUMPAD1 = 0x61;
    const VK_NUMPAD2 = 0x62;
    const VK_NUMPAD3 = 0x63;
    const VK_NUMPAD4 = 0x64;
    const VK_NUMPAD5 = 0x65;
    const VK_NUMPAD6 = 0x66;
    const VK_NUMPAD7 = 0x67;
    const VK_NUMPAD8 = 0x68;
    const VK_NUMPAD9 = 0x69;
    const VK_MULTIPLY = 0x6A;       // Numpad *
    const VK_ADD = 0x6B;            // Numpad +
    const VK_SUBTRACT = 0x6D;       // Numpad -
    const VK_DECIMAL = 0x6E;        // Numpad .
    const VK_DIVIDE = 0x6F;         // Numpad /

    // Function keys
    const VK_F1 = 0x70;
    const VK_F2 = 0x71;
    const VK_F3 = 0x72;
    const VK_F4 = 0x73;
    const VK_F5 = 0x74;
    const VK_F6 = 0x75;
    const VK_F7 = 0x76;
    const VK_F8 = 0x77;
    const VK_F9 = 0x78;
    const VK_F10 = 0x79;
    const VK_F11 = 0x7A;
    const VK_F12 = 0x7B;

    // Lock keys
    const VK_NUMLOCK = 0x90;        // NumLock
    const VK_SCROLL = 0x91;         // ScrollLock

    // Browser keys
    const VK_BROWSER_BACK = 0xA6;
    const VK_BROWSER_FORWARD = 0xA7;
    const VK_BROWSER_REFRESH = 0xA8;
    const VK_BROWSER_STOP = 0xA9;
    const VK_BROWSER_SEARCH = 0xAA;
    const VK_BROWSER_FAVORITES = 0xAB;
    const VK_BROWSER_HOME = 0xAC;

    // Media keys
    const VK_VOLUME_MUTE = 0xB5;
    const VK_VOLUME_DOWN = 0xB6;
    const VK_VOLUME_UP = 0xB7;
    const VK_MEDIA_NEXT_TRACK = 0xB0;
    const VK_MEDIA_PREV_TRACK = 0xB1;
    const VK_MEDIA_STOP = 0xB2;
    const VK_MEDIA_PLAY_PAUSE = 0xB3;

    // OEM keys (punctuation - US layout)
    const VK_OEM_1 = 0xBA;          // Semicolon (;:)
    const VK_OEM_PLUS = 0xBB;       // Equal (=+)
    const VK_OEM_COMMA = 0xBC;      // Comma (,<)
    const VK_OEM_MINUS = 0xBD;      // Minus (-_)
    const VK_OEM_PERIOD = 0xBE;     // Period (.>)
    const VK_OEM_2 = 0xBF;          // Slash (/?)
    const VK_OEM_3 = 0xC0;          // Backquote (`~)
    const VK_OEM_4 = 0xDB;          // Left bracket ([{)
    const VK_OEM_5 = 0xDC;          // Backslash (\|)
    const VK_OEM_6 = 0xDD;          // Right bracket (]})
    const VK_OEM_7 = 0xDE;          // Quote ('")
    const VK_OEM_102 = 0xE2;        // Non-US backslash

    /**
     * Maps KeyboardEvent.code values to Win32 Virtual Key codes.
     * Defined at module level to avoid per-call object allocation in getVirtualKeyCode().
     * @type {Object<string, number>}
     */
    const VK_MAP = {
        // Control keys
        'Backspace': VK_BACK,
        'Tab': VK_TAB,
        'Enter': VK_RETURN,
        'ShiftLeft': VK_SHIFT,
        'ShiftRight': VK_SHIFT,
        'ControlLeft': VK_CONTROL,
        'ControlRight': VK_CONTROL,
        'AltLeft': VK_MENU,
        'AltRight': VK_MENU,
        'Pause': VK_PAUSE,
        'CapsLock': VK_CAPITAL,
        'Escape': VK_ESCAPE,
        'Space': VK_SPACE,

        // Navigation keys
        'PageUp': VK_PRIOR,
        'PageDown': VK_NEXT,
        'End': VK_END,
        'Home': VK_HOME,
        'ArrowLeft': VK_LEFT,
        'ArrowUp': VK_UP,
        'ArrowRight': VK_RIGHT,
        'ArrowDown': VK_DOWN,
        'PrintScreen': VK_SNAPSHOT,
        'Insert': VK_INSERT,
        'Delete': VK_DELETE,

        // Number keys (top row)
        'Digit0': VK_0, 'Digit1': VK_1, 'Digit2': VK_2, 'Digit3': VK_3, 'Digit4': VK_4,
        'Digit5': VK_5, 'Digit6': VK_6, 'Digit7': VK_7, 'Digit8': VK_8, 'Digit9': VK_9,

        // Letter keys
        'KeyA': VK_A, 'KeyB': VK_B, 'KeyC': VK_C, 'KeyD': VK_D, 'KeyE': VK_E, 'KeyF': VK_F,
        'KeyG': VK_G, 'KeyH': VK_H, 'KeyI': VK_I, 'KeyJ': VK_J, 'KeyK': VK_K, 'KeyL': VK_L,
        'KeyM': VK_M, 'KeyN': VK_N, 'KeyO': VK_O, 'KeyP': VK_P, 'KeyQ': VK_Q, 'KeyR': VK_R,
        'KeyS': VK_S, 'KeyT': VK_T, 'KeyU': VK_U, 'KeyV': VK_V, 'KeyW': VK_W, 'KeyX': VK_X,
        'KeyY': VK_Y, 'KeyZ': VK_Z,

        // Windows/Meta keys
        'MetaLeft': VK_LWIN,
        'MetaRight': VK_RWIN,
        'ContextMenu': VK_APPS,

        // Numpad keys
        'Numpad0': VK_NUMPAD0, 'Numpad1': VK_NUMPAD1, 'Numpad2': VK_NUMPAD2,
        'Numpad3': VK_NUMPAD3, 'Numpad4': VK_NUMPAD4, 'Numpad5': VK_NUMPAD5,
        'Numpad6': VK_NUMPAD6, 'Numpad7': VK_NUMPAD7, 'Numpad8': VK_NUMPAD8,
        'Numpad9': VK_NUMPAD9,
        'NumpadMultiply': VK_MULTIPLY,
        'NumpadAdd': VK_ADD,
        'NumpadSubtract': VK_SUBTRACT,
        'NumpadDecimal': VK_DECIMAL,
        'NumpadDivide': VK_DIVIDE,

        // Function keys
        'F1': VK_F1, 'F2': VK_F2, 'F3': VK_F3, 'F4': VK_F4, 'F5': VK_F5, 'F6': VK_F6,
        'F7': VK_F7, 'F8': VK_F8, 'F9': VK_F9, 'F10': VK_F10, 'F11': VK_F11, 'F12': VK_F12,

        // Lock keys
        'NumLock': VK_NUMLOCK,
        'ScrollLock': VK_SCROLL,

        // Browser keys
        'BrowserBack': VK_BROWSER_BACK,
        'BrowserForward': VK_BROWSER_FORWARD,
        'BrowserRefresh': VK_BROWSER_REFRESH,
        'BrowserStop': VK_BROWSER_STOP,
        'BrowserSearch': VK_BROWSER_SEARCH,
        'BrowserFavorites': VK_BROWSER_FAVORITES,
        'BrowserHome': VK_BROWSER_HOME,

        // Media keys
        'AudioVolumeMute': VK_VOLUME_MUTE,
        'AudioVolumeDown': VK_VOLUME_DOWN,
        'AudioVolumeUp': VK_VOLUME_UP,
        'MediaTrackNext': VK_MEDIA_NEXT_TRACK,
        'MediaTrackPrevious': VK_MEDIA_PREV_TRACK,
        'MediaStop': VK_MEDIA_STOP,
        'MediaPlayPause': VK_MEDIA_PLAY_PAUSE,

        // OEM keys (punctuation - US layout)
        'Semicolon': VK_OEM_1,
        'Equal': VK_OEM_PLUS,
        'Comma': VK_OEM_COMMA,
        'Minus': VK_OEM_MINUS,
        'Period': VK_OEM_PERIOD,
        'Slash': VK_OEM_2,
        'Backquote': VK_OEM_3,
        'BracketLeft': VK_OEM_4,
        'Backslash': VK_OEM_5,
        'BracketRight': VK_OEM_6,
        'Quote': VK_OEM_7,
        'IntlBackslash': VK_OEM_102
    };

    /**
     * Maps data-pac-event modifier names to KeyboardEvent.key values.
     * Defined at module level to avoid per-call object allocation in processEventModifiers().
     * @type {Object<string, string>}
     */
    const KEY_MODIFIER_MAP = {
        enter: 'Enter',
        escape: 'Escape',
        esc: 'Escape',
        space: ' ',
        tab: 'Tab',
        delete: 'Delete',
        del: 'Delete',
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight'
    };

    // ========================================================================
    // METAFILE — Display list recording and playback
    // ========================================================================

    /**
     * Maps metafile op names to their CanvasRenderingContext2D property names.
     * Used by playMetaFile for direct property assignment: ctx[prop] = op.value.
     * @type {Object<string, string>}
     */
    const _metaFileProps = {
        setFillStyle:       'fillStyle',
        setStrokeStyle:     'strokeStyle',
        setLineWidth:       'lineWidth',
        setLineCap:         'lineCap',
        setLineJoin:        'lineJoin',
        setLineDashOffset:  'lineDashOffset',
        setMiterLimit:      'miterLimit',
        setGlobalAlpha:     'globalAlpha',
        setGlobalComposite: 'globalCompositeOperation',
        setFont:            'font',
        setTextAlign:       'textAlign',
        setTextBaseline:    'textBaseline',
        setTextRendering:   'textRendering',
        setLetterSpacing:   'letterSpacing',
        setWordSpacing:     'wordSpacing'
    };

    /**
     * Maps metafile op names to their CanvasRenderingContext2D method names.
     * Used by playMetaFile for no-argument method calls: ctx.method().
     * @type {Object<string, string>}
     */
    const _metaFileMethods = {
        save:           'save',
        restore:        'restore',
        beginPath:      'beginPath',
        closePath:      'closePath',
        stroke:         'stroke',
        resetTransform: 'resetTransform'
    };

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * Core utility functions for the framework
     * @namespace Utils
     */
    const Utils = {

        /**
         * Generates a unique identifier string based on current timestamp and optional random component
         * @param {string} [prefix=""] - Optional prefix to prepend to the generated ID
         * @param {boolean} [random=false] - Whether to append a random suffix for additional uniqueness
         * @returns {string} A unique identifier in hexadecimal format
         */
        uniqid(prefix = "", random = false) {
            // Get current timestamp in milliseconds and add sub-millisecond precision
            // Date.now() * 1000 converts ms to microseconds, Math.random() * 1000 adds fractional component
            const sec = Date.now() * 1000 + Math.random() * 1000;

            // Convert to hexadecimal string and ensure minimum 14 character length
            // The padEnd ensures consistent length even if the hex conversion results in fewer digits
            const id = sec.toString(16).padEnd(14, "0");

            // Combine prefix + base ID + optional random suffix.
            // Random suffix is a truncated 8-digit random number for additional entropy
            return `${prefix}${id}${random ? `.${Math.trunc(Math.random() * 100000000)}` : ""}`;
        },

        /**
         * Returns true if the given value is a plain object (i.e. created via object
         * literal, Object.create(null), or new Object()), and false for class instances,
         * arrays, null, primitives, and other built-ins.
         * Cross-realm safe (works across iframes and vm contexts).
         * @param {*} value - The value to check
         * @returns {boolean}
         */
        isPlainObject(value) {
            // Reject if the type is not 'object'
            if (value === null || typeof value !== 'object') {
                return false;
            }

            // Get prototype
            const proto = Object.getPrototypeOf(value);

            // Accept Object.create(null) (no prototype) and plain objects whose
            // prototype chain is exactly: value -> Object.prototype -> null
            return proto === null || Object.getPrototypeOf(proto) === null;
        },

        /**
         * Gets a nested property value from an object using dot and bracket notation
         * @param {object} obj - The object to read from
         * @param {string} path - The property path (e.g., "configuration[theme]" or "todos[0].completed")
         * @returns {*} The value at the given path, or undefined if any part of the path does not exist
         */
        getNestedValue(obj, path) {
            const parts = path.split(DOTS_AND_BRACKETS_PATTERN).filter(Boolean);
            let current = obj;

            for (const part of parts) {
                if (!(part in current)) {
                    return undefined;
                }

                current = current[part];
            }

            return current;
        },

        /**
         * Sets a nested property value on the reactive abstraction
         * @param {string} path - The property path (e.g., "todos[0].completed")
         * @param {*} value - The value to set
         * @param {object} current
         */
        setNestedProperty(path, value, current) {
            const parts = path.split(DOTS_AND_BRACKETS_PATTERN).filter(Boolean);

            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                const nextPart = parts[i + 1];

                // If current part doesn't exist, create it
                if (!(part in current)) {
                    // Create array if next part is numeric, object otherwise
                    current[part] = /^\d+$/.test(nextPart) ? [] : {};
                }

                current = current[part];
            }

            // Set the final property
            const finalPart = parts[parts.length - 1];
            current[finalPart] = value;
        },

        /**
         * Gets a unique identifier for an element to use in queue tracking
         * @param {HTMLElement} element - The element to identify
         * @returns {string} A unique identifier for the element
         */
        getElementIdentifier(element) {
            // If element has an ID, use it
            if (element.id) {
                return element.id;
            }

            // If element has a data-pac-element-id, use it
            if (element.hasAttribute('data-pac-element-id')) {
                return element.getAttribute('data-pac-element-id');
            }

            // Otherwise, generate and assign a unique ID
            const uniqueId = Utils.uniqid('pac-el-');
            element.setAttribute('data-pac-element-id', uniqueId);
            return uniqueId;
        },

        /**
         * Converts a path string into an array of segments.
         * @param {string|string[]} pathString - Path expression as string or array.
         * @returns {string[]} Array of path segments.
         */
        pathStringToArray(pathString) {
            if (Array.isArray(pathString)) {
                return pathString;
            }

            return String(pathString).split(DOTS_AND_BRACKETS_PATTERN).filter(Boolean);
        },

        /**
         * Converts an array of path segments into a JavaScript property access string.
         * Handles both dot notation for properties and bracket notation for numeric indices.
         * @param {string[]} pathArray - Array of path segments representing object property access
         * @returns {string} Formatted property access string (e.g., "user.settings[0].name")
         */
        pathArrayToString(pathArray) {
            // If there are no segments, return an empty string
            if (pathArray.length === 0) {
                return '';
            }

            // Start with the first segment — it never needs dot/bracket prefix
            let result = String(pathArray[0]); // Convert first token to string

            // Iterate through remaining path segments
            for (let i = 1; i < pathArray.length; ++i) {
                // Fetch part
                const part = pathArray[i];

                // If the segment is numeric (number or numeric string),
                // use bracket notation to represent an array index
                if (typeof part === 'number' || /^\d+$/.test(String(part))) {
                    result += `[${part}]`; // Handle numeric indices
                } else {
                    result += `.${part}`;  // Handle property names
                }
            }

            // Return the fully constructed access string
            return result;
        },

        /**
         * Determines if an element belongs to the specified PAC container.
         * An element belongs to a container if that container is its immediate PAC parent.
         * @param {Element} container - The PAC container element with data-pac-id attribute
         * @param {Node} element - The element to check (can be Element or Text node)
         * @returns {boolean} True if element belongs directly to this container, false otherwise
         */
        belongsToPacContainer(container, element) {
            // Early validation: ensure container is an Element with required attribute
            if (!(container instanceof Element) || !container.hasAttribute('data-pac-id')) {
                return false;
            }

            // Handle Text nodes and Comment nodes by getting their parent element for containment checking
            const isTextNode = element && (element.nodeType === Node.TEXT_NODE || element.nodeType === Node.COMMENT_NODE);
            const targetElement = isTextNode ? element.parentElement : element;

            // Validate that we have a valid Element to work with
            if (!(targetElement instanceof Element)) {
                return false;
            }

            // Quick containment check - if not contained, definitely doesn't belong
            if (!container.contains(targetElement)) {
                return false;
            }

            // Find the closest PAC container ancestor (or self)
            const immediateContainer = targetElement.closest(CONTAINER_SEL);

            // Element belongs to this container only if this container is its immediate PAC parent
            return immediateContainer === container;
        },

        /**
         * Checks if an element is at least partially visible in the viewport
         * @param {HTMLElement} element - The element to check
         * @returns {boolean} True if element intersects with viewport
         */
        isElementVisible(element) {
            const rect = element.getBoundingClientRect();
            const viewHeight = window.innerHeight;
            const viewWidth = window.innerWidth;

            return (
                rect.top < viewHeight &&
                rect.bottom > 0 &&
                rect.left < viewWidth &&
                rect.right > 0
            );
        },

        /**
         * Checks if an element is completely visible in the viewport
         * @param {HTMLElement} element - The element to check
         * @returns {boolean} True if entire element is within viewport bounds
         */
        isElementFullyVisible(element) {
            const rect = element.getBoundingClientRect();
            const viewHeight = window.innerHeight;
            const viewWidth = window.innerWidth;

            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= viewHeight &&
                rect.right <= viewWidth
            );
        },

        /**
         * Checks if an element has direct focus (is the activeElement)
         * @param {HTMLElement} element - The element to check
         * @returns {boolean} True if the element is currently focused
         */
        isElementDirectlyFocused(element) {
            return element === document.activeElement;
        },

        /**
         * Checks if an element or any of its descendants has focus
         * @param {HTMLElement} element - The container element to check
         * @returns {boolean} True if focus is within the element's boundaries
         */
        isElementFocusWithin(element) {
            return element === document.activeElement || element.contains(document.activeElement);
        },

        /**
         * Converts a DOMRect object to a plain JavaScript object
         * @param {DOMRect|DOMRectReadOnly} domRect - The DOMRect object to convert
         * @returns {Object} Plain object containing all DOMRect properties
         */
        domRectToSimpleObject(domRect) {
            return {
                // Position relative to viewport
                top: domRect.top,           // Distance from top of viewport
                left: domRect.left,         // Distance from left of viewport
                right: domRect.right,       // Distance from left of viewport to right edge
                bottom: domRect.bottom,     // Distance from top of viewport to bottom edge

                // Dimensions
                width: domRect.width,       // Width of the element
                height: domRect.height,     // Height of the element

                // Alternative position properties (aliases)
                x: domRect.x,               // Same as left, but included for DOMRect compatibility
                y: domRect.y                // Same as top, but included for DOMRect compatibility
            };
        },

        /**
         * Detects current network quality
         * @returns {*|string}
         */
        getNetworkEffectiveType() {
            if ('connection' in navigator && navigator.connection?.effectiveType) {
                return navigator.connection.effectiveType;
            } else {
                return '4g';
            }
        },

        /**
         * Detects current network quality by measuring response time
         * to a small test resource.
         */
        detectNetworkQuality() {
            if (!navigator.onLine) {
                return 'offline';
            }

            // Use Network Information API when available (Chrome, Edge, mobile browsers)
            switch (this.getNetworkEffectiveType()) {
                case 'slow-2g':
                case '2g':
                case '3g':
                    return 'slow';

                default:
                    return 'fast';
            }
        },

        /**
         * Deep equality comparison optimized for performance
         * @param {*} a - First value
         * @param {*} b - Second value
         * @returns {boolean} True if values are deeply equal
         */
        isEqual(a, b) {
            if (a === b) {
                return true;
            }

            if (Number.isNaN(a) && Number.isNaN(b)) {
                return true;
            }

            if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
                return false;
            }

            if (Array.isArray(a)) {
                return Array.isArray(b) &&
                    a.length === b.length &&
                    a.every((item, i) => this.isEqual(item, b[i]));
            }

            const keysA = Object.keys(a);
            const keysB = Object.keys(b);

            return keysA.length === keysB.length &&
                keysA.every(k => Object.hasOwn(b, k) && this.isEqual(a[k], b[k]));
        },

        /**
         * Builds the reverse key name mapping once for caching.
         * @returns {Object<number, string>}
         */
        buildCachedKeyNames() {
            // Build reverse mapping from wakaPAC VK constants to names
            const keyNames = {};

            // Add all exported VK constants
            for (const key in wakaPAC) {
                if (key.startsWith('VK_')) {
                    keyNames[wakaPAC[key]] = key;
                }
            }

            return keyNames;
        },

        /**
         * Retrieves a string that represents the name of a key.
         * @param {number} keyCode
         * @returns {string}
         */
        getKeyName(keyCode) {
            if (cachedKeyNames === null) {
                cachedKeyNames = this.buildCachedKeyNames();
            }

            if (Object.prototype.hasOwnProperty.call(cachedKeyNames, keyCode)) {
                return cachedKeyNames[keyCode];
            }

            if (keyCode >= 0x30 && keyCode <= 0x39) {
                return String.fromCharCode(keyCode);
            }

            if (keyCode >= 0x41 && keyCode <= 0x5A) {
                return String.fromCharCode(keyCode);
            }

            return '0x' + keyCode.toString(16).toUpperCase().padStart(2, '0');
        },

        /**
         * Compute a signed semantic delta for a beforeinput/input event.
         * The returned value encodes both operation direction and magnitude:
         *
         *   > 0  → insertion (character or text added)
         *   < 0  → deletion (semantic delete step)
         *   = 0  → non-length mutation (formatting, history, etc.)
         *
         * @param {InputEvent} event - A beforeinput or input event.
         * @returns {number} Signed delta representing the text mutation.
         */
        computeInputDelta(event) {
            // Normalize input type and payload for safe inspection
            const type = event.inputType || "";
            const data = event.data;

            // Insert operations: return payload length when known,
            // otherwise assume a single semantic insert
            if (type.startsWith("insert")) {
                return typeof data === "string" ? data.length : 1;
            }

            // Delete operations: represent as a single semantic delete step
            if (type.startsWith("delete")) {
                return -1;
            }

            // Formatting/history/other mutations have no length delta
            return 0;
        },

        /**
         * Infer the text that would be removed from a text control during a
         * delete-style beforeinput event. This must be called before the DOM
         * mutation occurs, while the element value and selection still reflect
         * the pre-edit state.
         *
         * Behavior:
         *   - If a selection exists, returns the selected text.
         *   - If the caret is collapsed:
         *       • backward delete → character before caret
         *       • forward delete  → character after caret
         *   - Returns an empty string when no deletion can be inferred.
         *
         * @param {HTMLInputElement|HTMLTextAreaElement} element
         *   A text input or textarea element supporting selection APIs.
         * @param {"backward"|"forward"} direction
         *   Delete direction derived from the inputType.
         * @returns {string}
         *   The inferred text that would be deleted, or empty string if none.
         */
        getDeletedTextFromTextControl(element, direction) {
            // Capture pre-mutation selection bounds
            const start = element.selectionStart;
            const end = element.selectionEnd;

            if (start == null || end == null) {
                return "";
            }

            // Selection delete always wins
            if (start !== end) {
                return element.value.slice(start, end);
            }

            // Collapsed caret deletion
            if (direction === "backward" && start > 0) {
                return element.value.slice(start - 1, start);
            }

            if (direction === "forward" && start < element.value.length) {
                return element.value.slice(start, start + 1);
            }

            return "";
        },

        /**
         * Normalize an InputEvent inputType into a delete direction.
         * @param {string|null|undefined} inputType
         *   The inputType from a beforeinput/input event.
         * @returns {"backward"|"forward"|null}
         *   The normalized delete direction, or null if the inputType does not
         *   describe a directional delete operation.
         */
        getDeleteDirection(inputType) {
            // Guard against missing or non-delete input types
            if (!inputType) {
                return null;
            }

            // Backward delete (e.g., backspace-style operations)
            if (inputType.includes("Backward")) {
                return "backward";
            }

            // Forward delete (e.g., delete-key operations)
            if (inputType.includes("Forward")) {
                return "forward";
            }

            // Not a directional delete operation
            return null;
        },

        /**
         * Normalize a text control selection into an ordered range.
         * Ensures the returned range always satisfies: start ≤ end
         * @param {HTMLInputElement|HTMLTextAreaElement} element
         *   A text input or textarea element.
         * @returns {{start:number, end:number}|null}
         *   Ordered selection range, or null if unavailable.
         */
        getNormalizedSelectionRange(element) {
            const rawStart = element.selectionStart;
            const rawEnd = element.selectionEnd;

            if (rawStart == null || rawEnd == null) {
                return null;
            }

            const start = Math.min(rawStart, rawEnd);
            const end = Math.max(rawStart, rawEnd);

            return { start, end };
        },

        /**
         * Computes the union of two axis-aligned rectangles.
         * The union is the smallest rectangle that contains both input rectangles.
         * @param {{x:number, y:number, width:number, height:number}} a
         * @param {{x:number, y:number, width:number, height:number}} b
         * @returns {{x:number, y:number, width:number, height:number}}
         */
        unionRect(a, b) {
            const x = Math.min(a.x, b.x);
            const y = Math.min(a.y, b.y);
            const right  = Math.max(a.x + a.width,  b.x + b.width);
            const bottom = Math.max(a.y + a.height, b.y + b.height);
            return { x, y, width: right - x, height: bottom - y };
        },

        /**
         * Returns a debounced version of fn that delays invocation until after `delay`
         * milliseconds have elapsed since the last call. Any pending invocation is
         * cancelled when the debounced function is called again before the timer fires.
         *
         * The returned function exposes a .cancel() method to abort a pending call,
         * which is required for proper cleanup (e.g. component teardown).
         *
         * @param {Function} fn    - Function to debounce
         * @param {number}   delay - Quiet period in milliseconds
         * @returns {Function} Debounced wrapper with a .cancel() method
         */
        debounce(fn, delay) {
            let timer = null;

            function debounced(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    timer = null;
                    fn.apply(this, args);
                }, delay);
            }

            debounced.cancel = function() {
                clearTimeout(timer);
                timer = null;
            };

            return debounced;
        }
    }

    // ========================================================================
    // UNIT HANDLING
    // ========================================================================

    function _registerUnit(library, options = {}) {
        // Prevent duplicate registration
        if (_registeredLibs.indexOf(library) !== -1) {
            return;
        }

        // The library must expose a factory method that returns
        // a plugin descriptor. wakaPAC passes itself as the argument,
        // so the library never needs a hard reference to wakaPAC.
        if (typeof library.createPacPlugin !== 'function') {
            throw new Error('wakaPAC.use(): library must implement createPacPlugin()');
        }

        // Add to registered libs array to prevent duplicates
        _registeredLibs.push(library);

        // Create the plugin and store
        const plugin = library.createPacPlugin(wakaPAC, options);
        _plugins.push(plugin);

        // If the plugin exposes named functions, register it as a unit
        if (plugin.name && Utils.isPlainObject(plugin.functions)) {
            if (_units.get(plugin.name)) {
                console.warn(`WakaPAC: unit "${plugin.name}" is already registered`);
            } else {
                _units.set(plugin.name, plugin.functions);
                _unitNames.set(library, plugin.name);
            }
        }
    }


    // ========================================================================
    // REACTIVE PROXY
    // ========================================================================

    function makeDeepReactiveProxy(value, container) {

        /**
         * List of all methods allowed on an array
         * @type {string[]}
         */
        const ARRAY_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

        /**
         * Determines whether a property should be wrapped in a reactive proxy.
         * Properties starting with underscore (_) or dollar sign ($) are treated as non-reactive
         * to avoid performance overhead when storing complex objects, DOM references, or internal state.
         * @param {string|symbol|number} prop - The property name being accessed or set
         * @returns {boolean} True if the property should trigger reactivity and DOM updates, false otherwise
         */
        function shouldMakeReactive(prop) {
            return typeof prop === 'string' && !prop.startsWith('_') && !prop.startsWith('$');
        }

        /**
         * Creates a wrapped array method that handles reactivity
         * @param {Array} target - The array being proxied
         * @param {string} methodName - The array method name (push, pop, etc.)
         * @param {Array} currentPath - The path to this array in the data structure
         * @returns {Function} Wrapped array method
         */
        function createReactiveArrayMethod(target, methodName, currentPath) {
            return function () {
                // Store the old array state before modification
                const oldArray = Array.prototype.slice.call(target);

                // Apply the array method to get the result
                const result = Array.prototype[methodName].apply(target, arguments);

                // Get the new array state after modification
                const newArray = Array.prototype.slice.call(target);

                // Re-proxy all items with correct indices after the operation
                // This ensures all objects have the proper path references
                newArray.forEach((item, index) => {
                    if (item && typeof item === 'object' && !item._isReactive) {
                        const correctPath = currentPath.concat([index]);
                        newArray[index] = createProxy(item, correctPath);
                        newArray[index]._isReactive = true;
                    }
                });

                // Update the target array with the newly proxied items
                // This is necessary because forEach works on a copy
                for (let i = 0; i < newArray.length; i++) {
                    target[i] = newArray[i];
                }

                // Dispatch events for the array change
                container.dispatchEvent(new CustomEvent(EV_PAC_CHANGE, {
                    detail: {
                        path: currentPath,
                        oldValue: oldArray,
                        newValue: target
                    }
                }));

                // Return the result
                return result;
            };
        }

        /**
         * Handles array length property changes
         * @param {Array} target - The array being modified
         * @param {number} newLength - The new length value
         * @param {Array} currentPath - The path to this array
         * @returns {boolean} Always returns true
         */
        function handleArrayLengthSet(target, newLength, currentPath) {
            const oldLength = target.length;

            // Only trigger events if length actually changes
            if (oldLength === newLength) {
                return true;
            }

            // Store old array state before truncation
            const oldArray = Array.prototype.slice.call(target);

            // Perform the truncation
            target.length = newLength;

            // Dispatch events
            container.dispatchEvent(new CustomEvent(EV_PAC_CHANGE, {
                detail: {
                    path: currentPath,
                    oldValue: oldArray,
                    newValue: Array.prototype.slice.call(target)
                }
            }));

            return true;
        }

        /**
         * Handles scroll property assignments
         * @param {string} prop - Property name
         * @param {*} newValue - New scroll value
         * @param {Array} propertyPath - Full property path
         */
        function handleScrollPropertySet(prop, newValue, propertyPath) {
            // Only handle scroll properties at root level
            if (propertyPath.length !== 1) {
                return;
            }

            if (prop === 'containerScrollX' && container) {
                container.scrollLeft = newValue;
            } else if (prop === 'containerScrollY' && container) {
                container.scrollTop = newValue;
            } else if (prop === 'browserScrollX') {
                window.scrollTo(newValue, window.scrollY);
            } else if (prop === 'browserScrollY') {
                window.scrollTo(window.scrollX, newValue);
            }
        }

        /**
         * Proxy get trap handler
         * @param {Object|Array} target - The object being proxied
         * @param {string|symbol} prop - Property being accessed
         * @param {Array} currentPath - Current path in the data structure
         * @returns {*} The property value (potentially wrapped in a proxy)
         */
        function proxyGetHandler(target, prop, currentPath) {
            const val = target[prop];

            // Handle array methods first
            if (Array.isArray(target) && typeof val === 'function' && ARRAY_METHODS.includes(prop)) {
                return createReactiveArrayMethod(target, prop, currentPath);
            }

            // Check if this property is a getter-only property (computed property)
            const descriptor = Object.getOwnPropertyDescriptor(target, prop);

            if (descriptor && descriptor.get && !descriptor.set) {
                // This is a getter-only property (computed), return the value as-is
                return val;
            }

            // Don't make functions reactive, just return them as-is
            if (typeof val === 'function') {
                return val;
            }

            // If the value is an object/array and not already reactive, wrap it in a proxy
            if (val && typeof val === 'object' && !val._isReactive && shouldMakeReactive(prop)) {
                // Return raw value if the data is already proxied
                if (val._externalProxy) {
                    return val;
                }

                const propertyPath = currentPath.concat([prop]);
                const proxiedVal = createProxy(val, propertyPath);
                proxiedVal._isReactive = true;

                // Write directly to target without going through the proxy set trap.
                // This caches the proxy without firing pac:change.
                Object.defineProperty(target, prop, {
                    value: proxiedVal,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });

                return proxiedVal;
            }

            return val;
        }

        /**
         * Proxy set trap handler
         * @param {Object|Array} target - The object being proxied
         * @param {string|symbol} prop - Property being set
         * @param {*} newValue - New value being assigned
         * @param {Array} currentPath - Current path in the data structure
         * @returns {boolean} Always returns true
         */
        function proxySetHandler(target, prop, newValue, currentPath) {
            // Handle array length truncation
            if (Array.isArray(target) && prop === 'length') {
                return handleArrayLengthSet(target, newValue, currentPath);
            }

            // Do nothing when value did not change
            const oldValue = target[prop];
            const propertyPath = currentPath.concat([prop]);

            if (oldValue === newValue) {
                return true;
            }

            // Special handling for scroll properties
            handleScrollPropertySet(prop, newValue, propertyPath);

            // Only make reactive and dispatch events for non-underscore properties
            if (!shouldMakeReactive(prop)) {
                target[prop] = newValue;
                return true;
            }

            // Wrap objects and arrays in proxies when they're assigned
            if (newValue && typeof newValue === 'object') {
                target[prop] = createProxy(newValue, propertyPath);
                target[prop]._isReactive = true;
            } else {
                target[prop] = newValue;
            }

            // Dispatch array-specific event if this is an array assignment
            container.dispatchEvent(new CustomEvent(EV_PAC_CHANGE, {
                detail: {
                    path: propertyPath,
                    oldValue: oldValue,
                    newValue: target[prop]
                }
            }));

            return true;
        }

        /**
         * Proxy deleteProperty trap handler.
         * Fires a pac:change event when a reactive property is deleted,
         * allowing the DOM to update in response.
         * @param {Object|Array} target - The object being proxied
         * @param {string|symbol} prop - Property being deleted
         * @param {Array} currentPath - Current path in the data structure
         * @returns {boolean} True if deletion succeeded
         */
        function proxyDeleteHandler(target, prop, currentPath) {
            // Property doesn't exist — nothing to do
            if (!(prop in target)) {
                return true;
            }

            // Non-reactive properties: delete silently
            if (!shouldMakeReactive(prop)) {
                delete target[prop];
                return true;
            }

            // Capture old value before deletion for the change event
            const oldValue = target[prop];
            const propertyPath = currentPath.concat([prop]);

            // Perform the actual deletion
            delete target[prop];

            // Notify the DOM that this property is gone
            container.dispatchEvent(new CustomEvent(EV_PAC_CHANGE, {
                detail: {
                    path: propertyPath,
                    oldValue: oldValue,
                    newValue: undefined
                }
            }));

            return true;
        }

        /**
         * Creates a reactive proxy for an object or array
         * @param {Object|Array} obj - The object to make reactive
         * @param {Array} currentPath - Current path in the data structure
         * @returns {Object|Array} A proxied version of the object
         */
        function createProxy(obj, currentPath) {
            currentPath = currentPath || [];

            return new Proxy(obj, {
                get: function (target, prop) {
                    return proxyGetHandler(target, prop, currentPath);
                },

                set: function (target, prop, newValue) {
                    return proxySetHandler(target, prop, newValue, currentPath);
                },

                deleteProperty: function (target, prop) {
                    return proxyDeleteHandler(target, prop, currentPath);
                }
            });
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        return createProxy(value, []);
    }

    // ============================================================================
    // Send PAC-events for changed DOM elements
    // ============================================================================

    const DomUpdateTracker = {
        /** @private {boolean} Flag to prevent multiple initializations */
        _initialized: false,


        /** @private {boolean} Flag indicating if mouse capture is currently active */
        _captureActive: false,

        /** @private {HTMLElement|null} The container that currently has the pointer inside it */
        _hoveredContainer: null,

        /** @private {HTMLElement|null} The descendant element that currently has the pointer inside it */
        _hoveredDescendant: null,

        /** @private {HTMLElement|null} The container element that has captured mouse input */
        _capturedContainer: null,

        /** @private Shared intersection observer */
        _intersectionObserver: null,

        /** @private Shared resize observer */
        _resizeObserver: null,

        // Keep track of key repeat count
        _repeatCounts : new Map(),

        /** @type {string[]} List of valid drop effects for drag/drop */
        validDropEffects: ['none', 'copy', 'link', 'move'],

        /** @type {WeakMap} Increment depth for drag/drop */
        _enterDepths: new WeakMap(),

        /** @type {Element|null} Dropzone being targeted */
        _dropzoneTarget: null,

        /**
         * Performs one-time initialization of the input/event subsystem.
         * @returns {void}
         */
        initialize() {
            // Guard against multiple initialization passes
            if (this._initialized) {
                return;
            }

            // Mark subsystem as initialized before registering listeners
            this._initialized = true;

            // Setup all event categories — each method wires a specific domain
            this._setupBrowserStateEvents(); // Visibility/network state tracking
            this._setupFocusEvents();        // Focus/blur routing
            this._setupMouseEvents();        // Mouse button/movement handling
            this._setupTouchEvents();        // Touch normalization
            this._setupKeyboardEvents();     // Keyboard input dispatch
            this._setupFormEvents();         // Form interaction tracking
            this._setupWindowEvents();       // Scroll/resize state updates
            this._setupObservers();          // Intersection/resize observers
        },

        /**
         * Registers browser-level state listeners and publishes normalized
         * visibility and network status updates to the system. Tracks document visibility,
         * online/offline transitions, and — when available — connection characteristic changes.
         * @private
         * @returns {void}
         */
        _setupBrowserStateEvents() {
            // Preserve instance reference for use inside DOM callbacks
            const self = this;

            // Visibility changes
            // Fires when the document becomes hidden or visible (tab/app switch)
            document.addEventListener('visibilitychange', function() {
                // Dispatch visibility state snapshot
                self.dispatchBrowserStateEvent('visibility', {
                    visible: !document.hidden // True when page is foregrounded
                });
            });

            // Network state changes — online
            // Fires when browser regains connectivity
            window.addEventListener('online', function() {
                // Publish network availability and quality metadata
                self.dispatchBrowserStateEvent('online', {
                    online: true,
                    networkType: Utils.getNetworkEffectiveType(), // Browser-reported connection class
                    networkQuality: Utils.detectNetworkQuality(), // App-level quality heuristic
                });
            });

            // Network state changes — offline
            // Fires when browser loses connectivity
            window.addEventListener('offline', function() {
                // Publish loss of connectivity and last-known characteristics
                self.dispatchBrowserStateEvent('online', {
                    online: false,
                    networkType: Utils.getNetworkEffectiveType(),
                    networkQuality: Utils.detectNetworkQuality(),
                });
            });

            // Connection type/quality changes (if supported by the browser)
            // Provides updates when connection characteristics shift
            if ('connection' in navigator && navigator.connection) {
                navigator.connection.addEventListener('change', function() {
                    // Dispatch updated connection state snapshot
                    self.dispatchBrowserStateEvent('online', {
                        online: navigator.onLine, // Current connectivity flag
                        networkType: Utils.getNetworkEffectiveType(),
                        networkQuality: Utils.detectNetworkQuality(),
                    });
                });
            }

            // Screen orientation changes
            // Fires when the device is rotated and the screen orientation changes
            if (screen.orientation) {
                screen.orientation.addEventListener('change', function() {
                    self.dispatchBrowserStateEvent('orientation', {
                        angle: screen.orientation.angle,
                        type: screen.orientation.type
                    });
                });
            }

            // Device pixel ratio changes
            // Fires when the display DPR changes (monitor switch, OS scaling change)
            (function watchDPR() {
                const dpr = window.devicePixelRatio || 1;
                const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);

                mq.addEventListener('change', function onChange() {
                    mq.removeEventListener('change', onChange);

                    self.dispatchBrowserStateEvent('dpr', {
                        ratio: window.devicePixelRatio || 1
                    });

                    watchDPR(); // Re-register for the next change
                });
            })();
        },

        /**
         * Registers focus transition listeners and translates them into
         * normalized focus/blur messages for the container system.
         * @private
         * @returns {void}
         */
        _setupFocusEvents() {
            const self = this;

            // Pending focus messages keyed by container element.
            // Within a single tick, a KILLFOCUS followed by SETFOCUS on the same
            // container nets to no change and both are dropped.
            const pending = new Map();

            // Single shared debounce timer for all focus events.
            // Restarted on every focusin/focusout so the flush always happens
            // after the last event in a burst has been processed.
            let debounceTimer = null;

            function scheduleFlush() {
                // Cancel the previous pending flush — we haven't seen the full
                // picture yet, more focus events may arrive in this tick
                if (debounceTimer !== null) {
                    clearTimeout(debounceTimer);
                }

                // Defer to the next task so both focusout and focusin have fired
                // before we dispatch anything. By then pending holds the net state.
                debounceTimer = setTimeout(function() {
                    debounceTimer = null;

                    // Dispatch only the net message per container — intermediate
                    // transitions that cancelled out are never seen by msgProc
                    for (const [container, { message, domEvent }] of pending) {
                        const customEvent = self.wrapDomEventAsMessage(message, domEvent);
                        self.dispatchToContainer(container, customEvent);
                    }

                    // Reset for the next focus burst
                    pending.clear();
                }, 0);
            }

            document.addEventListener('focusin', function(event) {
                const container = self.getContainerForEvent(MSG_SETFOCUS, event);

                // Overwrite any pending KILLFOCUS for this container — if focus moved
                // within the same container the net result is that focus stayed,
                // so the kill is cancelled and only SETFOCUS remains
                pending.set(container, { message: MSG_SETFOCUS, domEvent: event });

                // Flush change
                scheduleFlush();
            });

            document.addEventListener('focusout', function(event) {
                const container = self.getContainerForEvent(MSG_KILLFOCUS, event);

                // Only write KILLFOCUS if no SETFOCUS is already pending for this
                // container. A pending SETFOCUS means focusin already fired (or will
                // fire) in the same tick, so the kill would be cancelled anyway —
                // skip it to avoid overwriting the more recent state.
                if (!pending.has(container)) {
                    pending.set(container, { message: MSG_KILLFOCUS, domEvent: event });
                }

                // Flush change
                scheduleFlush();
            });
        },

        /**
         * Setup all mouse event handlers
         * @private
         */
        _setupMouseEvents() {
            this._setupMouseButtonEvents();
            this._setupMouseMoveEvent();
            this._setupMouseWheelEvent();
            this._setupClipboardEvents();
            this._setupDragDropEvents();
            this._setupDragPrevention();
            this._setupDocumentLeave();
        },

        /**
         * Registers mouse button and click-related listeners and translates them
         * into normalized internal messages.
         * @private
         * @returns {void}
         */
        _setupMouseButtonEvents() {
            // Preserve instance reference for use inside DOM callbacks
            const self = this;

            // Mouse down
            // Capture button press and normalize into message format
            document.addEventListener('mousedown', function(event) {
                // Map DOM button codes to internal message identifiers
                const buttonMap = {
                    0: MSG_LBUTTONDOWN,
                    1: MSG_MBUTTONDOWN,
                    2: MSG_RBUTTONDOWN,
                };

                // Ignore unsupported buttons
                const messageType = buttonMap[event.button];

                if (!messageType) {
                    return;
                }

                // Begin gesture recording when right button is pressed
                if (event.button === 2) {
                    MouseGestureRecognizer.startRecording(event);
                }

                // Resolve container responsible for handling the interaction
                const container = self.getContainerForEvent(messageType, event);

                // Dispatch normalized message
                self.dispatchMouseMessage(messageType, event, container);
            });

            // Mouse up
            // Capture button release and optionally finalize gesture recording
            window.addEventListener('mouseup', function(event) {
                // Map DOM button codes to internal release messages
                const buttonMap = {
                    0: MSG_LBUTTONUP,
                    1: MSG_MBUTTONUP,
                    2: MSG_RBUTTONUP,
                };

                // Ignore unsupported buttons
                const messageType = buttonMap[event.button];

                if (!messageType) {
                    return;
                }

                // Stop gesture recording if right-button interaction completes
                if (event.button === 2 && MouseGestureRecognizer.isRecording) {
                    MouseGestureRecognizer.stopRecording(event);
                }

                // Resolve container and dispatch message
                const container = self.getContainerForEvent(messageType, event);
                self.dispatchMouseMessage(messageType, event, container);

                // Synthesize MSG_RCLICK on right button release, parallel to how the
                // browser's 'click' event synthesizes MSG_LCLICK on left button release.
                // Guard against gesture: if a gesture was just recognized the contextmenu
                // handler will suppress it, and we should not fire a click either.
                if (event.button === 2 && !MouseGestureRecognizer.gestureJustDispatched) {
                    self.dispatchMouseMessage(MSG_RCLICK, event, container);
                }
            });

            // Left click
            document.addEventListener('click', function(event) {
                const container = self.getContainerForEvent(MSG_LCLICK, event);
                self.dispatchMouseMessage(MSG_LCLICK, event, container);
            });

            // Middle click
            document.addEventListener('auxclick', function(event) {
                if (event.button === 1) {
                    const container = self.getContainerForEvent(MSG_MCLICK, event);
                    self.dispatchMouseMessage(MSG_MCLICK, event, container);
                }
            });

            // Context menu
            // Fires on right-click AND the keyboard context menu key.
            // Dispatched as MSG_CONTEXTMENU so components can intercept and suppress
            // the native browser menu via event.preventDefault().
            document.addEventListener('contextmenu', function(event) {
                // Suppress native menu if a gesture was just dispatched
                if (MouseGestureRecognizer.gestureJustDispatched) {
                    MouseGestureRecognizer.gestureJustDispatched = false;
                    event.preventDefault();
                    return;
                }

                // Dispatch MSG_CONTEXTMENU — calling event.preventDefault() inside
                // msgProc will suppress the native browser context menu
                const container = self.getContainerForEvent(MSG_CONTEXTMENU, event);
                self.dispatchMouseMessage(MSG_CONTEXTMENU, event, container);
            });

            // Double click (left button only)
            // Capture rapid primary-button activation
            document.addEventListener('dblclick', function(event) {
                if (event.button === 0) {
                    const container = self.getContainerForEvent(MSG_LBUTTONDBLCLK, event);
                    self.dispatchMouseMessage(MSG_LBUTTONDBLCLK, event, container);
                }
            });
        },

        /**
         * Sets up the mousemove event handler with coalesced (throttled) delivery.
         * @private
         */
        _setupMouseMoveEvent() {
            const self = this;

            this.setupMoveCoalescer(
                'mousemove',
                wakaPAC.mouseMoveThrottleFps,
                function (event) {
                    // Feed the gesture recognizer before anything else
                    if (MouseGestureRecognizer.isRecording) {
                        MouseGestureRecognizer.recordPoint(event);
                    }

                    // Fetch container info
                    const currentContainer = self.getContainerForEvent(MSG_MOUSEMOVE, event);
                    const captured = self.hasCapture();

                    // ----- Container transition -----
                    // When the cursor crosses from one container to another,
                    // dispatch leave/enter events and reset descendant tracking.
                    // Transitions are suppressed during capture to keep events
                    // locked to the capturing container.
                    if (self._hoveredContainer !== currentContainer) {
                        if (!captured) {
                            // Leaving old container
                            if (self._hoveredContainer) {
                                // Clean up any lingering descendant hover first
                                if (self._hoveredDescendant) {
                                    self.dispatchMouseMessage(MSG_MOUSELEAVE_DESCENDANT, event, self._hoveredContainer);
                                }

                                self.dispatchMouseMessage(MSG_MOUSELEAVE, event, self._hoveredContainer);
                            }

                            // Entering new container
                            if (currentContainer) {
                                self.dispatchMouseMessage(MSG_MOUSEENTER, event, currentContainer);
                            }
                        }

                        self._hoveredContainer = currentContainer;
                        self._hoveredDescendant = null;
                    }

                    // Within the current container, track which child element the
                    // cursor is over. Fires enter/leave events when that element
                    // changes, enabling per-element hover effects without requiring
                    // each child to register its own listeners.
                    if (currentContainer && !captured) {
                        // Resolve the descendant: any element other than the
                        // container root itself is a hovered child
                        const currentDescendant = self.findInteractiveDescendant(event.target, currentContainer);

                        if (self._hoveredDescendant !== currentDescendant) {
                            if (self._hoveredDescendant) {
                                self.dispatchMouseMessage(MSG_MOUSELEAVE_DESCENDANT, event, currentContainer);
                            }

                            if (currentDescendant) {
                                self.dispatchMouseMessage(MSG_MOUSEENTER_DESCENDANT, event, currentContainer);
                            }

                            self._hoveredDescendant = currentDescendant;
                        }
                    }

                    // Unconditionally dispatch the move event to the current
                    // container (if any), regardless of capture state.
                    if (currentContainer) {
                        self.dispatchMouseMessage(MSG_MOUSEMOVE, event, currentContainer);
                    }
                }
            );
        },

        /**
         * Registers mouse wheel listeners and normalizes scroll input into the
         * internal message format. Wheel deltas and modifier state are encoded so
         * consumers receive a consistent representation regardless of browser differences.
         * @private
         * @returns {void}
         */
        _setupMouseWheelEvent() {
            // Preserve instance reference for use inside DOM callback
            const self = this;

            // Listen for wheel input at the document level
            document.addEventListener("wheel", function(event) {
                // Fetch all data
                const container = self.getContainerForEvent(MSG_MOUSEWHEEL, event);
                const modifiers = self.getModifierState(event);
                const wParam = self.buildWheelWParam(event.deltaY, modifiers);
                const lParam = self.buildMouseLParam(event, container);

                // Wrap DOM wheel event with raw delta metadata for downstream consumers
                const customEvent = self.wrapDomEventAsMessage(MSG_MOUSEWHEEL, event, wParam, lParam, {
                    wheelDelta: event.deltaY,   // Primary vertical scroll delta
                    wheelDeltaX: event.deltaX,  // Horizontal scroll delta (if supported)
                    deltaMode: event.deltaMode  // Unit mode (pixels, lines, pages)
                });

                // Dispatch normalized wheel message
                self.dispatchToContainer(container, customEvent);
            }, {
                passive: true
            });
        },

        /**
         * Registers clipboard event listeners and translates them into
         * normalized clipboard messages for the container system.
         * @private
         * @returns {void}
         */
        _setupClipboardEvents() {
            // Preserve instance reference for use inside DOM callbacks
            const self = this;

            // Copy event
            // Fires when the user initiates a copy operation (Ctrl+C, context menu, etc.)
            document.addEventListener("copy", function(event) {
                // Resolve container responsible for the focused/selected element
                const container = self.getContainerForEvent(MSG_COPY, event);
                const selectedText = window.getSelection().toString();
                const wParam = self.getModifierState(event);
                const lParam = selectedText.length;

                // Build clipboard message with mutable copyData struct
                // msgProc can populate copyData to override clipboard contents
                const customEvent = self.wrapDomEventAsMessage(MSG_COPY, event, wParam, lParam, {
                    selectedText: selectedText,
                    copyData: null
                });

                // Dispatch synchronously — msgProc runs before we continue
                self.dispatchToContainer(container, customEvent);

                // Post-dispatch: check if msgProc wants to override clipboard contents
                // If copyData was populated, prevent default copy and write custom data
                // Format keys should be MIME types (e.g., 'text/plain', 'text/html')
                if (customEvent.detail.copyData && !event.defaultPrevented) {
                    event.preventDefault();

                    for (const format in customEvent.detail.copyData) {
                        event.clipboardData.setData(format, customEvent.detail.copyData[format]);
                    }
                }
            });

            // Paste event
            // Fires when the user initiates a paste operation (Ctrl+V, context menu, etc.)
            document.addEventListener("paste", function(event) {
                // Resolve container responsible for the focused element
                const container = self.getContainerForEvent(MSG_PASTE, event);
                const clipboardData = event.clipboardData;
                const uriRaw = clipboardData.getData('text/uri-list');
                const uris = uriRaw ? uriRaw.split(/\r?\n/).filter(line => line && !line.startsWith('#')) : [];
                const wParam = self.getModifierState(event);
                const lParam = clipboardData.getData('text/plain').length;

                // Extract file metadata for image/file paste operations (e.g., screenshot paste)
                // Only captures metadata — file blobs are accessible via event.clipboardData.files
                const files = Array.from(clipboardData.files).map(function(f) {
                    return { name: f.name, size: f.size, type: f.type };
                });

                // Build clipboard message with all available paste data.
                // Detail keys mirror DataTransfer property names and MIME types.
                // msgProc can return false to cancel the paste, which prevents
                // subsequent MSG_INPUT/MSG_INPUT_COMPLETE from firing.
                const customEvent = self.wrapDomEventAsMessage(MSG_PASTE, event, wParam, lParam, {
                    'text/plain':    clipboardData.getData('text/plain'),
                    'text/html':     clipboardData.getData('text/html'),
                    'text/rtf':      clipboardData.getData('text/rtf'),
                    'text/uri-list': uriRaw,
                    uris:            uris,
                    files:           files,
                    types:           Array.from(clipboardData.types)
                });

                // Dispatch to container — no post-dispatch readback needed
                // Paste is read-only from msgProc's perspective
                self.dispatchToContainer(container, customEvent);
            });
        },

        /**
         * Sets up document-level drag-and-drop event delegation for PAC
         * containers. All drag events are captured at the document level
         * and dispatched to the nearest ancestor with a `[data-pac-id]` attribute.
         * @private
         */
        _setupDragDropEvents() {
            this._onDragEnter();
            this._onDragLeave();
            this._onDragOver();
            this._onDrop();
        },

        /**
         * Registers a dragstart handler that suppresses the browser’s native
         * drag behavior while the system has pointer capture.
         * @private
         * @returns {void}
         */
        _setupDragPrevention() {
            // Intercept drag initiation at the document level
            document.addEventListener('dragstart', event => {
                // If the input system currently owns capture, block native drag
                if (this.hasCapture()) {
                    event.preventDefault();
                }
            });
        },

        /**
         * Dispatches MSG_DRAGENTER only on the first real entry into a
         * container, ignoring child-boundary crossings.
         * @private
         */
        _onDragEnter() {
            const self = this;

            document.addEventListener('dragenter', function (event) {
                // Find container
                const container = self.getContainerForEvent(MSG_DRAGENTER, event);

                // None found, abort
                if (!container) {
                    return;
                }

                // Increment depth — child-boundary crossings fire dragenter
                // without the cursor actually entering the container
                const depth = (self._enterDepths.get(container) || 0) + 1;
                self._enterDepths.set(container, depth);

                // Already inside the container; ignore internal boundary noise
                if (depth !== 1) {
                    return;
                }

                // Create the event
                const lParam = self.buildMouseLParam(event, container);
                const wParam = self.getModifierState(event);

                const customEvent = self.wrapDomEventAsMessage(
                    MSG_DRAGENTER, event, wParam, lParam, {
                        types: Array.from(event.dataTransfer.types)
                    }
                );

                // Dispatch the event
                self.dispatchToContainer(container, customEvent);
            });
        },

        /**
         * Dispatches MSG_DRAGLEAVE only when the cursor has fully exited
         * the container (depth counter drops back to zero).
         * @private
         */
        _onDragLeave() {
            const self = this;

            document.addEventListener('dragleave', function (event) {
                // Find container
                const container = self.getContainerForEvent(MSG_DRAGLEAVE, event);

                // If none found, abort
                if (!container) {
                    return;
                }

                // Decrement depth — child-boundary crossings fire dragleave
                // without the cursor actually leaving the container
                const depth = (self._enterDepths.get(container) || 0) - 1;
                self._enterDepths.set(container, depth);

                // Still inside the container; ignore internal boundary noise
                if (depth !== 0) {
                    return;
                }

                // Create event
                const lParam = self.buildMouseLParam(event, container);
                const wParam = self.getModifierState(event);

                const customEvent = self.wrapDomEventAsMessage(
                    MSG_DRAGLEAVE, event, wParam, lParam, {
                        types: Array.from(event.dataTransfer.types)
                    }
                );

                // Dispatch event
                self.dispatchToContainer(container, customEvent);
            });
        },

        /**
         * Coalesces high-frequency dragover events into a single dispatch
         * per animation frame.  Only fires for valid drop targets whose
         * element has actually changed.
         * @private
         */
        _onDragOver() {
            const self = this;

            document.addEventListener('dragover', function (event) {
                // Fetch the container
                const container = self.getContainerForEvent(MSG_DRAGOVER, event);

                // If none found, abort
                if (!container) {
                    return;
                }

                // Find the drop target
                const dropTarget = event.target.closest(DROP_TARGET_SEL);

                // If none found, abort
                if (!dropTarget) {
                    event.dataTransfer.dropEffect = 'none';
                    return;
                }

                // Prevent default on valid drop target.
                // For drag/drop operations this means: allow drop
                event.preventDefault();

                // If we are already hovering over the drop target, do not send new 'over' event
                if (event.target === self._dropzoneTarget) {
                    return;
                }

                // Update the effect (mouse pointer)
                const effect = dropTarget.getAttribute('data-pac-drop-target');
                event.dataTransfer.dropEffect = self.validDropEffects.includes(effect) ? effect : 'copy';

                // Store the new dropzone
                self._dropzoneTarget = dropTarget;

                // Create the event
                const lParam = self.buildMouseLParam(event, container);
                const wParam = self.getModifierState(event);

                const customEvent = self.wrapDomEventAsMessage(
                    MSG_DRAGOVER,
                    event,
                    wParam,
                    lParam,
                    {
                        dropTarget: dropTarget,
                        types: Array.from(event.dataTransfer.types)
                    }
                );

                // Dispatch the event
                self.dispatchToContainer(container, customEvent);
            });
        },

        /**
         * Handles the drop: prevents the browser default, resets tracking
         * state, extracts transfer payload, and dispatches MSG_DROP.
         * @private
         */
        _onDrop() {
            const self = this;

            document.addEventListener('drop', function (event) {
                // Fetch container
                const container = self.getContainerForEvent(MSG_DROP, event);

                if (!container) {
                    return;
                }

                // Check if this is a valid drop target
                const dropTarget = event.target.closest(DROP_TARGET_SEL);

                if (!dropTarget) {
                    return;
                }

                // Mark the target as valid by calling preventDefault on it
                event.preventDefault();

                // Drag sequence complete — clean up tracking state
                self._enterDepths.delete(container);

                // Create the event
                const transfer = event.dataTransfer;
                const lParam = self.buildMouseLParam(event, container);
                const wParam = self.getModifierState(event);

                const customEvent = self.wrapDomEventAsMessage(
                    MSG_DROP, event, wParam, lParam, {
                        dropTarget: dropTarget,
                        text: transfer.getData('text/plain'),
                        html: transfer.getData('text/html'),
                        uri: transfer.getData('text/uri-list'),
                        files: self._extractFileMetadata(transfer.files),
                        rawFiles: transfer.files
                    }
                );

                // Dispatch event
                self.dispatchToContainer(container, customEvent);
            });
        },

        /**
         * Extracts serializable metadata from a FileList.
         * Same shape as MSG_PASTE / form-submit payloads.
         * @private
         * @param   {FileList} fileList
         * @returns {Array<{name: string, size: number, type: string}>}
         */
        _extractFileMetadata(fileList) {
            return Array.from(fileList).map(function (f) {
                return { name: f.name, size: f.size, type: f.type };
            });
        },

        /**
         * Registers document-level mouseleave to handle pointer leaving viewport.
         * Ensures MSG_MOUSELEAVE_DESCENDANT and MSG_MOUSELEAVE are dispatched
         * when the pointer exits the document.
         * @private
         * @returns {void}
         */
        _setupDocumentLeave() {
            const self = this;

            document.addEventListener('mouseleave', function(event) {
                // Only fire if mouse actually left the document (relatedTarget is null)
                if (event.relatedTarget !== null) {
                    return;
                }

                // Don't fire leave during capture - captured container logically retains pointer
                if (self.hasCapture()) {
                    return;
                }

                // Dispatch leave to whatever container was last hovered
                if (self._hoveredContainer) {
                    // Clean up any lingering descendant hover first
                    if (self._hoveredDescendant) {
                        self.dispatchMouseMessage(MSG_MOUSELEAVE_DESCENDANT, event, self._hoveredContainer);
                        self._hoveredDescendant = null;
                    }

                    // Dispatch mouse leave event
                    self.dispatchMouseMessage(MSG_MOUSELEAVE, event, self._hoveredContainer);

                    // Clear tracked state
                    self._hoveredContainer = null;
                }
            }, true); // Use capture phase
        },

        /**
         * Registers touch interaction handlers and normalizes them into the
         * internal mouse-style message system.
         * @private
         * @returns {void}
         */
        _setupTouchEvents() {
            // Preserve instance reference for use inside event callbacks
            const self = this;

            // Touch button events
            // Map touch lifecycle events onto mouse-style button semantics
            const touchMap = {
                'touchstart': MSG_LBUTTONDOWN,  // Finger contact behaves like left button press
                'touchend': MSG_LBUTTONUP,      // Finger release behaves like left button release
                'touchcancel': MSG_LBUTTONUP    // Cancellation is treated as a release for consistency
            };

            // Register touch handlers that normalize events into the message system
            Object.entries(touchMap).forEach(([eventName, msgType]) => {
                document.addEventListener(eventName, function(event) {
                    const container = self.getContainerForEvent(msgType, event);
                    self.dispatchMouseMessage(msgType, event, container);
                });
            });

            // Touch move (throttled)
            // Coalesce high-frequency movement to match mouse move dispatch behavior
            this.setupMoveCoalescer('touchmove', wakaPAC.mouseMoveThrottleFps, (event) => {
                // Ignore events without active touch points
                if (event.touches.length > 0) {
                    const container = self.getContainerForEvent(MSG_MOUSEMOVE, event);
                    self.dispatchMouseMessage(MSG_MOUSEMOVE, event, container);
                }
            });
        },

        /**
         * Registers keyboard listeners and translates DOM key activity into the
         * internal message format.
         * @returns {void}
         * @private
         */
        _setupKeyboardEvents() {
            // Preserve instance reference for use inside DOM callbacks
            const self = this;

            /**
             * Clear keyboard repeat count on blur
             */
            window.addEventListener('blur', function() {
                self._repeatCounts.clear();
            });

            // Key down (with MSG_CHAR for printable characters)
            // Handles key press and optional character emission
            document.addEventListener('keydown', function(event) {
                // Increment repeat count
                self._updateRepeatState(event);

                // Resolve target container for keyboard input
                const container = self.getContainerForEvent(MSG_KEYDOWN, event);

                // Encode keyboard press state
                const wParam = self.buildKeyboardWParam(event);
                const lParam = self.buildKeyboardLParam(event);

                // Wrap key-down message
                const keyDownEvent = self.wrapDomEventAsMessage(MSG_KEYDOWN, event, wParam, lParam, {
                    key: event.key,   // Logical key value
                    code: event.code  // Physical key identifier
                });

                // Translate accelerators before dispatch. If a match is found,
                // MSG_ACCEL is sent to the container, the keydown is suppressed,
                // and the browser default action is prevented.
                if (container && _translateAccelerator(keyDownEvent, container)) {
                    event.preventDefault();
                    return;
                }

                // Dispatch the key event
                self.dispatchToContainer(container, keyDownEvent);

                // Win32-style WM_CHAR: emit character message for printable input
                if (event.key && event.key.length === 1) {
                    // Convert character to numeric code representation
                    const msgCharWparam = event.key.charCodeAt(0);

                    // Wrap character event using same positional metadata
                    const msgCharEvent = self.wrapDomEventAsMessage(
                        MSG_CHAR,
                        event,
                        msgCharWparam,
                        lParam
                    );

                    // Dispatch character message alongside key-down event
                    self.dispatchToContainer(container, msgCharEvent);
                }
            });

            // Key up
            // Capture key release and forward normalized keyboard state
            document.addEventListener('keyup', function(event) {
                // Clear repeat count
                self._updateRepeatState(event);

                // Resolve container responsible for handling this keyboard event
                const container = self.getContainerForEvent(MSG_KEYUP, event);

                // Encode keyboard state into message parameters
                const wParam = self.buildKeyboardWParam(event);
                const lParam = self.buildKeyboardLParam(event);

                // Wrap DOM event with additional key metadata for consumers
                const customEvent = self.wrapDomEventAsMessage(MSG_KEYUP, event, wParam, lParam, {
                    key: event.key,   // Logical key value
                    code: event.code  // Physical key identifier
                });

                // Dispatch normalized key-up message
                self.dispatchToContainer(container, customEvent);
            });
        },

        /**
         * Setup form event handling (change, input, submit)
         * @returns {void}
         * @private
         */
        _setupFormEvents() {
            // Preserve instance reference for DOM callback scope
            const self = this;

            // Change events (select, radio, checkbox)
            // Handles discrete value changes for non-text form controls
            document.addEventListener('change', function(event) {
                // Fetch target element
                const target = event.target;

                // Identify supported control types
                const isSelect = target.tagName === 'SELECT';
                const isChangeInput = target.tagName === 'INPUT' && CHANGE_INPUT_TYPES.has(target.type);

                // Only process relevant control changes
                if (isSelect || isChangeInput) {
                    // Resolve owning container and build change message payload
                    const container = self.getContainerForEvent(MSG_CHANGE, event);
                    const wParam = self.buildChangeWParam(event);
                    const lParam = 0; // No positional payload required

                    // Create wrapper event (MSG_CHANGE)
                    const customEvent = self.wrapDomEventAsMessage(MSG_CHANGE, event, wParam, lParam, {
                        elementType: isSelect ? 'select' : target.type // Describe control type for consumers
                    });

                    // Dispatch normalized change event
                    self.dispatchToContainer(container, customEvent);
                }
            });

            // Input events (text fields, textareas, contenteditable)
            // Captures live text/content mutations rather than discrete value commits
            document.addEventListener('beforeinput', function(event) {
                // Fetch target element
                const target = event.target;

                // Identify editable text sources
                const isTextInput = target.tagName === 'INPUT' && TEXT_INPUT_TYPES.has(target.type);
                const isTextarea = target.tagName === 'TEXTAREA';
                const isContentEditable = target.isContentEditable === true;

                // Only process text/content updates
                if (isTextInput || isTextarea || isContentEditable) {
                    // Resolve container and encode text delta metadata
                    const container = self.getContainerForEvent(MSG_INPUT, event);
                    const supportsSelectionAPI = isTextInput || isTextarea;
                    const deleteDirection = Utils.getDeleteDirection(event.inputType);
                    const wParam = Utils.computeInputDelta(event);
                    const lParam = self.getModifierState(event);

                    // Fetch inserted/deleted text
                    let text = null;

                    if (wParam > 0) {
                        text = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
                    } else if (wParam < 0 && (isTextInput || isTextarea)) {
                        text = Utils.getDeletedTextFromTextControl(target, deleteDirection);
                    }

                    // Normalize selection
                    const selectionInfo = Utils.getNormalizedSelectionRange(target);

                    // Create wrapper event (MSG_INPUT)
                    const customEvent = self.wrapDomEventAsMessage(MSG_INPUT, event, wParam, lParam, {
                        inputType: event.inputType,
                        elementType: target.tagName.toLowerCase(),
                        text: text,
                        selectionStart: supportsSelectionAPI ? (selectionInfo?.start ?? null) : null,
                        selectionEnd: supportsSelectionAPI ? (selectionInfo?.end ?? null) : null
                    });

                    // Dispatch normalized input event
                    self.dispatchToContainer(container, customEvent);
                }
            });

            // Post-input events (text fields, textareas, contenteditable)
            // Fires after the DOM has been updated, providing accurate targetElement.value
            // for two-way data binding. The beforeinput event above captures pre-mutation
            // delta information, while this handler ensures value bindings read the final value.
            document.addEventListener('input', function(event) {
                const target = event.target;

                const isTextInput = target.tagName === 'INPUT' && TEXT_INPUT_TYPES.has(target.type);
                const isRangeInput = target.tagName === 'INPUT' && target.type === 'range';
                const isTextarea = target.tagName === 'TEXTAREA';
                const isContentEditable = target.isContentEditable === true;

                if (isTextInput || isRangeInput || isTextarea || isContentEditable) {
                    // Fetch info
                    const container = self.getContainerForEvent(MSG_INPUT_COMPLETE, event);
                    const value = isTextInput || isTextarea || isRangeInput ? target.value : (target.textContent ?? '');
                    const wParam = value.length;
                    const lParam = self.getModifierState(event);

                    // Create custom event
                    const customEvent = self.wrapDomEventAsMessage(MSG_INPUT_COMPLETE, event, wParam, lParam, {
                        inputType: event.inputType ?? null,
                        elementType: target.tagName.toLowerCase(),
                        value: value
                    });

                    // Dispatch custom event
                    self.dispatchToContainer(container, customEvent);
                }
            });

            // Submit events
            // Serializes form state into a structured message payload
            document.addEventListener('submit', function(event) {
                // Fetch target (form)
                const form = event.target;

                // Snapshot current form data
                const formData = new FormData(form);

                // Resolve dispatch container
                const container = self.getContainerForEvent(MSG_SUBMIT, event);
                const wParam = 0;
                const lParam = 0;

                // Identify the control responsible for submission (if available)
                const submitter = event.submitter;

                // Create wrapper event (MSG_SUBMIT)
                const customEvent = self.wrapDomEventAsMessage(MSG_SUBMIT, event, wParam, lParam, {
                    // Flat key/value representation of form entries
                    entries: Object.fromEntries(formData.entries()),

                    // Submission metadata
                    action: form.action,
                    method: form.method.toUpperCase(),
                    enctype: form.enctype,
                    name: form.getAttribute('name'),

                    // Browser validation state at submit time
                    isValid: form.checkValidity(),

                    // Submit button metadata (if applicable)
                    submitter: submitter ? {
                        name: submitter.name,
                        value: submitter.value,
                        id: submitter.id
                    } : null,

                    // File input metadata (names, sizes, types — not file blobs)
                    files: Array.from(form.elements)
                        .filter(el => el.type === 'file' && el.files.length > 0)
                        .reduce((acc, el) => {
                            acc[el.name] = Array.from(el.files).map(f => ({
                                name: f.name,
                                size: f.size,
                                type: f.type
                            }));
                            return acc;
                        }, {}),

                    // Multi-value fields (e.g., multi-select, repeated inputs)
                    multiEntries: Array.from(new Set(
                        Array.from(formData.keys()).filter(key =>
                            formData.getAll(key).length > 1
                        )
                    )).reduce((acc, key) => {
                        acc[key] = formData.getAll(key);
                        return acc;
                    }, {})
                });

                // Dispatch structured submit message
                self.dispatchToContainer(container, customEvent);
            });
        },

        /**
         * Setup window-level events (scroll, resize)
         * @returns {void}
         * @private
         */
        _setupWindowEvents() {
            // Preserve instance context for use inside coalesced callbacks
            const self = this;

            // Scroll tracking (debounced)
            // Coalesces rapid scroll events into a controlled dispatch rate
            this.setupMoveCoalescer('window.scroll', 60, function() {
                // Publish current scroll offsets as a browser state update
                self.dispatchBrowserStateEvent('scroll', {
                    scrollX: window.scrollX, // Horizontal scroll position in pixels
                    scrollY: window.scrollY  // Vertical scroll position in pixels
                });
            });

            // Resize tracking (debounced)
            // Coalesces rapid resize/layout changes to avoid excessive dispatch
            this.setupMoveCoalescer('window.resize', 60, function() {
                // Publish viewport and document metrics after resize
                self.dispatchBrowserStateEvent('resize', {
                    viewportWidth: window.innerWidth,   // Visible viewport width
                    viewportHeight: window.innerHeight, // Visible viewport height

                    // Total scrollable document dimensions
                    documentWidth: document.documentElement.scrollWidth,
                    documentHeight: document.documentElement.scrollHeight,

                    // Scroll offsets at time of resize (useful for layout consumers)
                    scrollX: window.scrollX,
                    scrollY: window.scrollY
                });
            });
        },

        /**
         * Setup intersection and resize observers
         * @returns {void}
         * @private
         */
        _setupObservers() {
            const self = this;

            // Intersection observer (viewport visibility tracking)
            this._intersectionObserver = new IntersectionObserver((entries) => {
                // Process all intersection updates generated in this observer batch
                entries.forEach(entry => {
                    // Resolve the framework component associated with the observed element
                    const component = window.PACRegistry.getByElement(entry.target);

                    // Only update state when a valid abstraction layer exists
                    if (component && component.abstraction) {
                        // Snapshot of the element’s client rectangle at the time of intersection
                        const rect = entry.boundingClientRect;

                        // Whether any portion of the container is visible in the viewport
                        component.abstraction.containerVisible = entry.isIntersecting;

                        // Treat near-complete intersection as fully visible (tolerates float precision)
                        component.abstraction.containerFullyVisible = entry.intersectionRatio >= 0.99;

                        // Persist simplified geometry for downstream layout/logic consumers
                        component.abstraction.containerClientRect = Utils.domRectToSimpleObject(rect);
                    }
                });
            }, {
                threshold: [0, 1.0] // Fire when element transitions between hidden, partially visible, and fully visible states
            });

            /**
             * Resize observer (element size tracking)
             * @type {ResizeObserver}
             * @private
             */
            this._resizeObserver = new ResizeObserver((entries) => {
                // Iterate over all resize notifications produced in this batch
                entries.forEach(entry => {
                    // The DOM element whose size changed
                    const container = entry.target;

                    // Resolve the framework component associated with this element
                    const component = window.PACRegistry.getByElement(container);

                    // Only proceed if a valid abstraction layer exists
                    if (component && component.abstraction) {
                        // Normalize reported size to integer pixels
                        const width = Math.round(entry.contentRect.width);
                        const height = Math.round(entry.contentRect.height);

                        // Persist latest container dimensions on the abstraction
                        component.abstraction.containerWidth = width;
                        component.abstraction.containerHeight = height;

                        // Determine logical size state used by the message system
                        let sizeType;

                        if (width === 0 && height === 0) {
                            sizeType = SIZE_HIDDEN;
                        } else if (document.fullscreenElement === container) {
                            sizeType = SIZE_FULLSCREEN;
                        } else {
                            sizeType = SIZE_RESTORED;
                        }

                        // Message parameters encode size state and dimensions
                        const wParam = sizeType;
                        const lParam = self.makeLParam(width, height);

                        // Build structured resize message including raw observer data
                        const customEvent = self.wrapDomEventAsMessage(
                            MSG_SIZE,
                            null, // No originating DOM event — observer-driven
                            wParam,
                            lParam,
                            {
                                // Pixel dimensions after normalization
                                width: width,
                                height: height,

                                // Simplified rectangle snapshot for consumers
                                contentRect: Utils.domRectToSimpleObject(entry.contentRect),

                                // Low-level box metrics from ResizeObserver
                                borderBoxSize: entry.borderBoxSize,
                                contentBoxSize: entry.contentBoxSize
                            }
                        );

                        // Dispatch size update to the owning container/component
                        self.dispatchToContainer(container, customEvent);

                        // For WebGL canvas components, dispatch MSG_WEBGL_READY after the first MSG_SIZE.
                        // At this point the canvas is laid out and getDC() returns a valid context — safe to
                        // compile shaders, upload geometry, and set up any other GL resources. Only fires once
                        // per component lifetime.
                        if (!component._webglReadySent) {
                            component._webglReadySent = true;

                            const pacContextType = container.dataset?.pacContext;

                            if (pacContextType === 'webgl' || pacContextType === 'webgl2') {
                                self.dispatchToContainer(container, self.wrapDomEventAsMessage(
                                    MSG_WEBGL_READY,
                                    null,
                                    0,
                                    0,
                                    {
                                        // Provide the GL context directly on the event so components
                                        // can set up shaders in the handler without a separate getDC() call.
                                        glContext: wakaPAC.getDC(container.dataset.pacId)
                                    }
                                ));
                            }
                        }
                    }
                });
            });
        },

        /**
         * Updates the internal per-key repeat counter to emulate Win32 key repeat
         * semantics. The counter represents how many keydown messages have occurred
         * since the last keyup for a given physical key.
         *
         * Behavior:
         * * First keydown → repeat count becomes 1
         * * Auto-repeat keydown → repeat count increments
         * * Keyup → repeat state is cleared for that key
         *
         * @param {KeyboardEvent} event - DOM keyboard event used to update repeat state
         * @returns {void}
         */
        _updateRepeatState(event) {
            // Fetch the key
            const key = event.code;

            // Reset repeat tracking when the key is released
            if (event.type === 'keyup') {
                this._repeatCounts.delete(key);
                return;
            }

            // First key press initializes the repeat counter
            if (!event.repeat) {
                this._repeatCounts.set(key, 1);
                return;
            }

            // Auto-repeat increments the existing counter
            this._repeatCounts.set(key, this._getRepeatCount(event) + 1);
        },

        /**
         * Retrieves the current Win32-style repeat count for a key based on the
         * internal tracking state. This method is read-only and does not mutate state.
         * @param {KeyboardEvent} event - DOM keyboard event identifying the key
         * @returns {number} Current repeat count for the key
         */
        _getRepeatCount(event) {
            // Fallback to 1 if tracking is unavailable or the key is not tracked
            if (!this._repeatCounts) {
                return 1;
            }

            return this._repeatCounts.get(event.code) || 1;
        },

        /**
         * Determines the Win32-style "previous key state" for a keyboard event.
         * @param {KeyboardEvent} event - DOM keyboard event identifying the key
         * @returns {number} 1 if the key was previously down, otherwise 0
         */
        _getPreviousKeyState(event) {
            // A key release implies the key was previously pressed
            if (event.type === 'keyup') {
                return 1;
            }

            // For keydown, the browser repeat flag indicates prior key state
            return event.repeat ? 1 : 0;
        },

        /**
         * Start observing the container element for intersection and size changes
         * @param {HTMLElement} container
         * @returns {void}
         */
        observeContainer(container) {
            this._intersectionObserver.observe(container);
            this._resizeObserver.observe(container);
        },

        /**
         * Stop observing the container element
         * @param {HTMLElement} container
         * @returns {void}
         */
        unObserveContainer(container) {
            this._resizeObserver.unobserve(container);
            this._intersectionObserver.unobserve(container);
        },

        /**
         * Coalesce high-frequency pointer events (e.g. mousemove, touchmove) to
         * at most once per animation frame, with optional FPS limiting.
         * @param {string} domEventName - Name of the DOM event to listen for.
         * @param {number} targetFps - Desired dispatch rate. Set 0 for uncapped (≈60Hz).
         * @param {(event: Event) => void} dispatch - Callback to receive the coalesced event.
         */
        setupMoveCoalescer(domEventName, targetFps, dispatch) {
            // Resolves a dotted event descriptor into a DOM target and event name
            const resolved = this.resolveEventTarget(domEventName);

            // If this is impossible to do, abort further processing
            if (!resolved) {
                return;
            }

            // Timestamp of the last dispatched event
            let lastTime = 0;

            // Most recent event to dispatch
            let pendingEvent = null;

            // Flag to ensure only one RAF callback is queued at a time
            let scheduled = false;

            // Milliseconds between allowed dispatches (0 = uncapped)
            const interval = targetFps > 0 ? 1000 / targetFps : 0;

            // Start listening
            resolved.target.addEventListener(resolved.event, (ev) => {
                // Only keep the latest event until the next frame
                pendingEvent = ev;

                // Schedule a frame callback if none is pending
                if (scheduled) {
                    return;
                }

                scheduled = true;

                requestAnimationFrame(function onFrame(now) {
                    // Interval not yet met — schedule another frame to
                    // guarantee the pending event is eventually dispatched.
                    // Without this, the final event in a burst can be lost
                    // when no further DOM events arrive to re-trigger the loop.
                    if (interval > 0 && now - lastTime < interval) {
                        requestAnimationFrame(onFrame);
                        return;
                    }

                    // Dispatch if uncapped or enough time elapsed
                    dispatch(pendingEvent);
                    lastTime = now;
                    scheduled = false;
                });
            });
        },

        /**
         * Resolves a dotted event descriptor into a DOM target and event name.
         * Supports "window.scroll", "document.click", "body.mousemove", or
         * plain event names (which default to document).
         * @param {string} domEventName - Event descriptor, optionally prefixed with target
         * @returns {{ target: EventTarget, event: string } | null} Null if target is unrecognised
         */
        resolveEventTarget(domEventName) {
            // Map of recognised target keywords to their corresponding DOM objects.
            // "body" uses a getter because document.body may not exist at definition time.
            const targetMap = { window, document, get body() { return document.body; } };

            // Find the separator between the optional target prefix and the event name
            const dotIndex = domEventName.indexOf(".");

            // No dot found — treat the entire string as an event name on document
            if (dotIndex === -1) {
                return { target: document, event: domEventName };
            }

            // Extract the prefix and look it up in the target map
            const target = targetMap[domEventName.slice(0, dotIndex)];

            // Return the resolved target + event name, or null if the prefix was unrecognized
            return target
                ? { target, event: domEventName.slice(dotIndex + 1) }
                : null;
        },

        /**
         * Creates a custom event that wraps the original DOM event with Win32-style
         * message properties (message, wParam, lParam) as top-level event properties.
         * The event is dispatched to the nearest container element with a [data-pac-id] attribute.
         * @param {number} messageType - The Win32 message type (e.g., MSG_LBUTTONDOWN, MSG_KEYUP)
         * @param {Event|null} originalEvent - The original DOM event to wrap
         * @param {number} wParam - The wParam value (typically flags or primary data)
         * @param {number} lParam - The lParam value (typically coordinates or secondary data)
         * @param {Object} [extended={}] - Additional extended data to include in event.detail
         * @param {HTMLElement|null} targetOverride
         * @returns {CustomEvent<{}>}
         */
        wrapDomEventAsMessage(messageType, originalEvent, wParam = 0, lParam = 0, extended = {}, targetOverride = null) {
            // Create custom event with extended data in detail (optional)
            const customEvent = new CustomEvent(EV_PAC_EVENT, {
                bubbles: true,
                cancelable: true,
                detail: extended
            });

            // Add Win32-style message properties directly to the event object
            // This avoids the event.detail.property nesting and keeps Win32 semantics clean
            Object.defineProperties(customEvent, {
                // Core Win32-style message data
                message: { value: messageType, enumerable: true, configurable: true },
                wParam: { value: wParam, enumerable: true, configurable: true },
                lParam: { value: lParam, enumerable: true, configurable: true },

                // Standard tracking fields
                timestamp: { value: Date.now(), enumerable: true, configurable: true },
                target: { value: targetOverride ?? originalEvent?.target, enumerable: true, configurable: true },

                // Reference to the original DOM event for debugging/advanced usage
                originalEvent: { value: originalEvent, enumerable: true, configurable: true }
            });

            // Forward event control methods to the original event
            // This allows consumers to call preventDefault() on the custom event
            // and have it affect the original event
            if (originalEvent) {
                const methodsToForward = ['preventDefault', 'stopPropagation', 'stopImmediatePropagation'];

                methodsToForward.forEach(methodName => {
                    // Store reference to the custom event's original method
                    const originalCustomMethod = customEvent[methodName];

                    // Override the method to call both the custom event method and original event method
                    customEvent[methodName] = function () {
                        // Call the custom event's method first (if it exists)
                        if (originalCustomMethod) {
                            originalCustomMethod.call(this);
                        }

                        // Then call the original event's method (if it exists)
                        if (originalEvent[methodName]) {
                            originalEvent[methodName].call(originalEvent);
                        }
                    };
                });
            }

            // Return the event
            return customEvent;
        },

        /**
         * Returns the container the event will be dispatched to
         * @param {number} msgType
         * @param {Event} originalEvent
         * @returns {HTMLElement|*}
         */
        getContainerForEvent(msgType, originalEvent) {
            // originalEvent.target can be a TextNode when the cursor is over bare text content.
            // TextNode does not implement Element and has no closest() — normalise to the
            // nearest Element ancestor before querying the PAC container hierarchy.
            const target = originalEvent.target instanceof Element
                ? originalEvent.target
                : originalEvent.target?.parentElement;

            // Walk up the DOM to find the nearest [data-pac-id] ancestor (or self).
            // Returns null if the event originated outside any registered container.
            let container = target?.closest(CONTAINER_SEL) ?? null;

            // Mouse capture overrides hit-testing: all affected mouse events are redirected
            // to the capturing container regardless of cursor position — Win32 SetCapture() semantics.
            if (this._captureActive && this.isCaptureAffected(msgType)) {
                if (this._capturedContainer?.isConnected) {
                    container = this._capturedContainer;
                } else {
                    // Capturing container was removed from the DOM — release and resume normal routing.
                    this.releaseCapture();
                }
            }

            return container;
        },

        /**
         * Walks up from a target element to find the nearest interactive
         * descendant within a container, mimicking Win32's child window
         * hit-testing. Returns null if the target is plain content (text
         * nodes, layout divs, etc.) that wouldn't be a "control".
         *
         * An element is considered interactive if it:
         * - Is a native form/link element (input, button, select, etc.)
         * - Has a [data-pac-hoverable] attribute
         * - Has a tabindex (making it focusable/interactive by convention)
         *
         * @param {Element} target - The DOM element that received the event
         * @param {Element} container - The container root to stop walking at
         * @returns {Element|null} The nearest interactive ancestor of target, or null
         * @private
         */
        findInteractiveDescendant(target, container) {
            let el = target;

            // Walk up the DOM tree from the event target, stopping at
            // the container boundary. The first interactive element we
            // encounter is the logical "child window" being hovered.
            while (el && el !== container) {
                if (INTERACTIVE_TAGS.has(el.tagName) ||
                    el.hasAttribute('data-pac-hoverable') ||
                    el.hasAttribute('tabindex')) {
                    return el;
                }

                el = el.parentElement;
            }

            // Target is either the container itself or plain
            // non-interactive content — no descendant to report
            return null;
        },

        /**
         * Dispatches a PAC message to its target container, running it through the
         * installed message hook chain before delivery to the container's msgProc.
         * Equivalent to the Win32 DispatchMessage() path with WH_CALLWNDPROC hooks active.
         * @param {HTMLElement} container - Target PAC container element
         * @param {CustomEvent} event - PAC message event created by createPacMessage()
         */
        dispatchToContainer(container, event) {
            // Bail out if no container was resolved
            if (!container) {
                return;
            }

            // Apply event modifiers before entering the hook chain.
            // processEventModifiers handles concerns like mouse capture routing and
            // drag state filtering. Returning false means the event should be suppressed
            // entirely — do not enter the hook chain at all.
            if (!this.processEventModifiers(event.target, event)) {
                return;
            }

            // Stamp the container onto the event so hooks and handlers always know the pacId.
            // _pacId is cached on the element at registration time to avoid a DOM attribute read here.
            event.pacId = container._pacId || container.getAttribute('data-pac-id');

            // Snapshot the hook array at dispatch time. This prevents mutations to _hooks
            // (installs or uninstalls that happen inside a hook function) from affecting
            // the current dispatch chain — identical to how Win32 freezes the hook chain
            // for the duration of a single message dispatch.
            const hookFns = _hooks.map(h => h.fn);

            // Index into hookFns tracking which hook fires next when callNextHookEx() is called
            let index = 0;

            // callNextHookEx advances the chain by one step. Each hook receives this function
            // as its second argument and is responsible for calling it to continue delivery.
            // If a hook omits the call, the message is swallowed — neither subsequent hooks
            // nor the container's msgProc will receive it.
            const callNextHookEx = () => {
                if (index < hookFns.length) {
                    // Advance the index before invoking so that if the hook calls
                    // callNextHookEx() synchronously, it proceeds to the correct next entry
                    const fn = hookFns[index++];

                    try {
                        fn(event, callNextHookEx);
                    } catch(e) {
                        // A throwing hook must not break message delivery for the container.
                        // Log the error and continue the chain as if the hook called
                        // callNextHookEx() itself — fault isolation over silent failure.
                        console.warn('wakaPAC: message hook threw an error, continuing chain:', e);
                        callNextHookEx();
                    }
                } else {
                    // All hooks have been traversed — deliver the message to the container.
                    // This triggers the 'pac:event' listener on the container element,
                    // which routes to Context.handlePacEvent() and ultimately msgProc().
                    container.dispatchEvent(event);
                }
            };

            // Kick off the chain. If no hooks are installed this immediately falls through
            // to container.dispatchEvent(), making the overhead a single function call and
            // an index bounds check — negligible for high-frequency messages like MSG_MOUSEMOVE.
            callNextHookEx();
        },

        /**
         * Helper to dispatch mouse messages with proper wParam/lParam encoding
         * @param {number} msgType
         * @param {Event} domEvent
         * @param {HTMLElement} container
         * @param {Object} extended
         */
        dispatchMouseMessage(msgType, domEvent, container, extended={}) {
            const wParam = this.getModifierState(domEvent);
            const lParam = this.buildMouseLParam(domEvent, container);
            const targetOverride = (msgType === MSG_MOUSEENTER || msgType === MSG_MOUSELEAVE) ? container : null;
            const customEvent = this.wrapDomEventAsMessage(msgType, domEvent, wParam, lParam, extended, targetOverride);

            this.dispatchToContainer(container, customEvent);
        },

        /**
         * Dispatches browser state events (visibility, online/offline, etc.) to all PAC containers
         * @param {string} stateType - Type of state change ('visibility', 'online', etc.)
         * @param {Object} stateData - State data to include in event
         */
        dispatchBrowserStateEvent(stateType, stateData) {
            window.PACRegistry.components.forEach((context) => {
                const customEvent = new CustomEvent(EV_PAC_BROWSER_STATE, {
                    detail: {
                        target: context.container,
                        stateType: stateType,
                        stateData: stateData,
                        timestamp: Date.now()
                    }
                });

                context.container.dispatchEvent(customEvent);
            });
        },

        /**
         * Builds wParam for mouse messages following Win32 WM_LBUTTONDOWN format
         * Contains key state flags indicating which modifier keys and mouse buttons are pressed
         * @param {Event} event - The mouse event
         * @returns {number} wParam value with packed key state flags
         */
        getModifierState(event) {
            let wParam = 0;

            if (event.ctrlKey) {
                wParam |= MK_CONTROL;
            }

            if (event.shiftKey) {
                wParam |= MK_SHIFT;
            }

            if (event.altKey) {
                wParam |= MK_ALT;
            }

            if (event.metaKey) {
                wParam |= MK_META;
            }

            if (event.buttons !== undefined) {
                // Real mouse event
                if (event.buttons & 1) {
                    wParam |= MK_LBUTTON;
                }

                if (event.buttons & 2) {
                    wParam |= MK_RBUTTON;
                }

                if (event.buttons & 4) {
                    wParam |= MK_MBUTTON;
                }

                if (event.buttons & 8) {
                    wParam |= MK_XBUTTON1;
                }

                if (event.buttons & 16) {
                    wParam |= MK_XBUTTON2;
                }
            } else if (event.touches && event.touches.length > 0) {
                // Touch event with active touches = simulate left button
                wParam |= MK_LBUTTON;
            }

            return wParam;
        },

        /**
         * Builds lParam for mouse messages following Win32 format
         * Packs x,y coordinates into a single 32-bit value
         * Coordinates are relative to the container element (client-area relative)
         * LOWORD (bits 0-15) = x-coordinate, HIWORD (bits 16-31) = y-coordinate
         * @param {MouseEvent|TouchEvent} event - The mouse event
         * @param {Element} container - The PAC container element with data-pac-id
         * @returns {number} lParam value with packed container-relative coordinates
         */
        buildMouseLParam(event, container) {
            // Skip lParam if container not set
            if (!container) {
                return 0;
            }

            // Fetch clientX and Y from event
            const touch = event.touches?.[0] || event.changedTouches?.[0];
            const clientX = touch ? touch.clientX : event.clientX;
            const clientY = touch ? touch.clientY : event.clientY;

            // Read the container’s on-screen bounds so we can convert
            // global/page coordinates into container-local coordinates.
            const rect = container.getBoundingClientRect();

            // Translate the input coordinates into values relative to
            // the container’s client area (Win32-style origin at top-left).
            const relativeX = clientX - rect.left;
            const relativeY = clientY - rect.top;

            // Get container's bounding rectangle to calculate relative coordinates
            return this.makeLParam(relativeX, relativeY);
        },

        /**
         * Build a Win32-style lParam value by converting page coordinates into a single 32-bit integer.
         * @param {number} x
         * @param {number} y
         * @returns {number}
         */
        makeLParam(x, y) {
            // Round to integers and clamp into an unsigned 16-bit range
            // so they are safe to pack into a single lParam value.
            const transformedX = Math.max(0, Math.min(0xFFFF, Math.round(x)));
            const transformedY = Math.max(0, Math.min(0xFFFF, Math.round(y)));

            // Combine into a 32-bit value:
            // low word = x, high word = y.
            return (transformedY << 16) | transformedX;
        },

        /**
         * Packs wheel delta and modifier keys into wParam
         * HIWORD = signed wheel delta (typically ±120 per notch)
         * LOWORD = modifier key flags (MK_SHIFT, MK_CONTROL, etc.)
         * @param {number} delta - Raw wheel delta from event
         * @param {number} modifiers - Bitmask of MK_* flags
         * @returns {number} Packed wParam value
         */
        buildWheelWParam(delta, modifiers) {
            // Normalize delta to ±120 per notch (Win32 standard)
            const normalizedDelta = Math.sign(delta) * WHEEL_DELTA;

            // Pack: HIWORD=delta (signed), LOWORD=modifiers
            return ((normalizedDelta & 0xFFFF) << 16) | (modifiers & 0xFFFF);
        },

        /**
         * Builds lParam for keyboard messages following Win32 WM_KEYDOWN/WM_KEYUP format
         * Encodes keyboard state information in various bit fields
         * Note: Bits 16-23 (scan code) are not available in JavaScript and remain 0
         * @param {KeyboardEvent} event - The keyboard event
         * @returns {number} lParam value with keyboard state information
         */
        buildKeyboardLParam(event) {
            let lParam = 0;

            // Bits 0-15: Repeat count
            // Win32 increments this for each WM_KEYDOWN while key is held
            lParam |= (this._getRepeatCount(event) & 0xFFFF);

            // Bits 16-23: Scan code (hardware scan code)
            // Not available in JavaScript - would require platform-specific mapping
            // Left as 0

            // Bit 24: Extended key flag (arrow keys, function keys, numpad, etc.)
            if (this.isExtendedKey(event.code)) {
                lParam |= (1 << 24);
            }

            // Bit 25: Shift key state
            // 1 if Shift is pressed, 0 otherwise
            if (event.shiftKey) {
                lParam |= KM_SHIFT;
            }

            // Bit 26: Ctrl key state
            // 1 if Ctrl is pressed, 0 otherwise
            if (event.ctrlKey) {
                lParam |= KM_CONTROL;
            }

            // Bit 27: Meta key state
            if (event.metaKey) {
                lParam |= KM_META;
            }

            // Bit 28: Reserved (not used)

            // Bit 29: Context code (Alt key state)
            // 1 if Alt is pressed, 0 otherwise
            if (event.altKey) {
                lParam |= KM_ALT;
            }

            // Bit 30: Previous key state
            if (this._getPreviousKeyState(event)) {
                lParam |= (1 << 30);
            }

            // Bit 31: Transition state (0 for keydown, 1 for keyup)
            if (event.type === 'keyup') {
                lParam |= (1 << 31);
            }

            return lParam;
        },

        /**
         * Builds wParam for keyboard messages using Win32 Virtual Key codes
         * More accurate than deprecated keyCode property
         * @param {KeyboardEvent} event - The keyboard event
         * @returns {number} Win32-compatible virtual key code
         */
        buildKeyboardWParam(event) {
            // Try to map event.code to Win32 VK code first
            const vkCode = this.getVirtualKeyCode(event.code);

            if (vkCode !== null) {
                return vkCode;
            }

            // Fallback to keyCode for compatibility (deprecated but still works)
            // Note: keyCode is usually close to VK codes for common keys
            return event.keyCode || event.which || 0;
        },

        /**
         * Builds wParam for change events based on element type
         * @param {Event} event - The change event
         * @returns {number} wParam value appropriate for the element type
         */
        buildChangeWParam(event) {
            const element = event.target;

            switch (element.type) {
                case 'checkbox':
                    return element.checked ? 1 : 0;  // Boolean state as integer

                case 'radio': {
                    // For radio buttons, get the selected index in the group
                    const radioGroup = document.querySelectorAll(`input[name="${element.name}"]`);
                    return Array.from(radioGroup).indexOf(element);
                }

                default:
                    // For selects and other elements, use selectedIndex if available
                    if ('selectedIndex' in element) {
                        return element.selectedIndex;
                    }

                    // Fallback to 0 for unknown element types
                    return 0;
            }
        },

        /**
         * Determines if a key is an "extended" key in Win32 terms
         * Extended keys include arrow keys, function keys, numpad keys, etc.
         * @param {string} code - The KeyboardEvent.code value
         * @returns {boolean} True if this is considered an extended key
         */
        isExtendedKey(code) {
            return code ? EXTENDED_KEYS.has(code) : false;
        },

        /**
         * Maps JavaScript KeyboardEvent.code to Win32 Virtual Key codes
         * Provides more accurate Win32 compatibility than deprecated keyCode
         * @param {string} code - The KeyboardEvent.code value
         * @returns {number|null} The Win32 VK_ code, or null if no mapping exists
         */
        getVirtualKeyCode(code) {
            return VK_MAP[code] || null;
        },

        /**
         * Processes event modifiers defined on an element via the `data-pac-event` attribute.
         * @param {Element|null|undefined} element - DOM element that may contain modifier attribute.
         * @param {Event & { originalEvent?: Event }} event - Event wrapper or native event.
         * @returns {boolean} True if the event should continue to be dispatched, false if blocked.
         */
        processEventModifiers(element, event) {
            // Guard: invalid element or missing attribute API → allow event
            if (!element || typeof element.getAttribute !== 'function') {
                return true;
            }

            // Read modifier string from attribute
            const attr = element.getAttribute('data-pac-event');

            if (!attr) {
                return true;
            }

            // Support wrapped events
            const originalEvent = event.originalEvent || event;

            // Split modifiers on whitespace
            const modifiers = attr.split(/\s+/);

            // Precompute keyboard-event check once
            const isKeyboard = originalEvent.type === 'keyup' || originalEvent.type === 'keydown';

            // Map modifier names to required KeyboardEvent.key values
            const keyMap = KEY_MODIFIER_MAP;

            for (const raw of modifiers) {
                // transform modifier to lowercase
                const modifier = raw.toLowerCase();

                // Flow-control modifiers with side effects
                if (modifier === 'prevent') {
                    originalEvent.preventDefault();
                    continue;
                }

                if (modifier === 'stop') {
                    originalEvent.stopPropagation();
                    continue;
                }

                // Key filter modifiers
                const requiredKey = keyMap[modifier];

                if (!requiredKey) {
                    continue; // Unknown modifier → ignore
                }

                // If keyboard event and key does not match → block dispatch
                if (isKeyboard && originalEvent.key !== requiredKey) {
                    return false;
                }
            }

            // All modifiers satisfied → allow event
            return true;
        },

        /**
         * Determines if a message type is affected by mouse capture
         * @param {number} messageType - The message type to check
         * @returns {boolean} True if this message type should use capture routing
         */
        isCaptureAffected(messageType) {
            return messageType === MSG_MOUSEMOVE ||
                messageType === MSG_MOUSEWHEEL ||
                messageType === MSG_LBUTTONDOWN ||
                messageType === MSG_LBUTTONUP ||
                messageType === MSG_LBUTTONDBLCLK ||
                messageType === MSG_RBUTTONDOWN ||
                messageType === MSG_RBUTTONUP ||
                messageType === MSG_MBUTTONDOWN ||
                messageType === MSG_MBUTTONUP ||
                messageType === MSG_LCLICK ||
                messageType === MSG_MCLICK ||
                messageType === MSG_RCLICK ||
                messageType === MSG_CONTEXTMENU;
        },

        /**
         * Enable mouse capture for a specific PAC container.
         * When active, all mouse events are treated as if they target this container,
         * even if the cursor is over a different element or outside the browser window.
         * @param {HTMLElement} container - Target PAC container that should receive captured mouse events
         * @returns {boolean} True if capture was successfully set, false if container is invalid
         */
        setCapture(container) {
            // Validate that container exists and is attached to the DOM
            // Can't capture events for disconnected elements
            if (!container?.isConnected) {
                console.warn('Cannot capture disconnected element');
                return false;
            }

            // If this exact container already has capture, nothing to do
            // Return true to indicate capture is active (idempotent operation)
            if (this.hasCapture() && this._capturedContainer === container) {
                return true;
            }

            // If a different container currently has capture, release it first
            // Only one container can have capture at a time (Win32 behavior)
            if (this.hasCapture()) {
                this.releaseCapture();
            }

            // Add CSS class to body for styling purposes
            // Allows CSS to react to capture mode (e.g., change cursor globally)
            document.body.classList.add('pac-capture-active');

            // Mark capture as active in internal state
            this._captureActive = true;

            // Store reference to the container that will receive captured events
            this._capturedContainer = container;

            // Return success
            return true;
        },

        /**
         * Disable mouse capture and restore normal mouse event routing.
         * After this call, events are dispatched based on standard hit-testing again.
         */
        releaseCapture() {
            // If capture is not active, there is nothing to release
            if (!this.hasCapture()) {
                return;
            }

            // Send capture changed message to container losing the capture
            if (this._capturedContainer?.isConnected) {
                const pacId = this._capturedContainer._pacId || this._capturedContainer.getAttribute('data-pac-id');

                if (pacId !== null) {
                    wakaPAC.sendMessage(pacId, wakaPAC.MSG_CAPTURECHANGED, 0, 0);
                }
            }

            // Remove the global CSS flag that indicates capture mode
            document.body.classList.remove('pac-capture-active');

            // Reset internal capture state
            this._captureActive = false;

            // Clear the stored reference to the previously captured container
            this._capturedContainer = null;
        },

        /**
         * Determine whether mouse capture mode is currently enabled.
         * @returns {boolean} True when a container is actively capturing mouse events, otherwise false.
         */
        hasCapture() {
            return this._captureActive;
        },
    }

    // ============================================================================
    // EXPRESSION PARSER
    // ============================================================================

    const ExpressionParser = {
        /**
         * Active token stream for the current parse frame.
         * Saved and restored by parseExpression() so nested calls
         * (re-entrant unit functions, future recursive evaluation)
         * cannot corrupt an in-progress parse.
         * @type {Array}
         */
        tokens: [],

        /**
         * Cursor into the active token stream.
         * @type {number}
         */
        currentToken: 0,

        /**
         * Stack of suspended parse frames.
         * Each entry is { tokens, currentToken } saved by parseExpression()
         * before overwriting the active state, and popped on return.
         * Under normal (non-reentrant) usage this stack stays empty.
         * @type {Array<{tokens: Array, currentToken: number}>}
         */
        _parseStack: [],

        OPERATOR_PRECEDENCE: {
            '||': 1, '&&': 2,
            '===': 6, '!==': 6, '==': 6, '!=': 6,
            '<': 7, '>': 7, '<=': 7, '>=': 7,
            '+': 8, '-': 8, '*': 9, '/': 9, '%': 9,
            '!': 10, 'unary-': 10, 'unary+': 10
        },

        OPERATOR_TYPES: {
            '||': 'logical', '&&': 'logical',
            '===': 'comparison', '!==': 'comparison', '==': 'comparison', '!=': 'comparison',
            '>=': 'comparison', '<=': 'comparison', '>': 'comparison', '<': 'comparison',
            '+': 'arithmetic', '-': 'arithmetic', '*': 'arithmetic', '/': 'arithmetic',
            '%': 'arithmetic'
        },

        /** Lookup table for keyword literal values — avoids a switch in parsePrimary */
        KEYWORD_VALUES: {
            'true': true,
            'false': false,
            'null': null,
            'undefined': undefined
        },

        /** Single-character token type map — hoisted out of tokenize() to avoid per-call allocation */
        SINGLE_CHAR_TOKENS: {
            '(': 'LPAREN',
            ')': 'RPAREN',
            '{': 'LBRACE',
            '}': 'RBRACE',
            '[': 'LBRACKET',
            ']': 'RBRACKET',
            ',': 'COMMA',
            '.': 'DOT'
        },

        /**
         * Main entry point for parsing JavaScript-like expressions into an AST.
         *
         * Re-entrancy: this method may be called while a parse is already in
         * progress (e.g. a unit function triggers expression evaluation during
         * argument resolution).  To handle this safely, the current token stream
         * and cursor are pushed onto _parseStack before the new parse begins and
         * restored unconditionally in a finally block when it completes.  Under
         * the common non-reentrant path the stack remains empty and there is no
         * measurable overhead.
         *
         * @param {string|Object} expression - The expression string to parse
         * @returns {Object|null} Parsed AST node or null if unparseable
         */
        parseExpression(expression) {
            // Remove whitespace around expression
            expression = String(expression).trim();

            // Save the current parse frame so a re-entrant call cannot clobber it
            this._parseStack.push({ tokens: this.tokens, currentToken: this.currentToken });

            try {
                // Tokenize and parse
                this.tokens = this.tokenize(expression);
                this.currentToken = 0;

                if (this.tokens.length === 0) {
                    return null;
                }

                // Add dependencies to the result
                return this.parseTernary();
            } finally {
                // Always restore the previous frame, even if an exception was thrown
                const frame = this._parseStack.pop();
                this.tokens = frame.tokens;
                this.currentToken = frame.currentToken;
            }
        },

        /**
         * Tokenizes the input expression into an array of tokens
         * @param {string} expression - Expression to tokenize
         * @returns {Array} Array of token objects
         */
        tokenize(expression) {
            const tokens = [];
            let i = 0;

            while (i < expression.length) {
                const char = expression[i];

                // Skip whitespace
                if (/\s/.test(char)) {
                    i++;
                    continue;
                }

                // String literals
                if (char === '"' || char === "'") {
                    const result = this.tokenizeString(expression, i);
                    tokens.push(result.token);
                    i = result.nextIndex;
                    continue;
                }

                // Numbers
                if (/\d/.test(char) || (char === '.' && /\d/.test(expression[i + 1]))) {
                    const result = this.tokenizeNumber(expression, i);
                    tokens.push(result.token);
                    i = result.nextIndex;
                    continue;
                }

                // Multi-character operators
                const multiChar = /^(===|!==|==|!=|>=|<=|&&|\|\|)/.exec(expression.slice(i));

                if (multiChar) {
                    const op = multiChar[1];
                    tokens.push({type: 'OPERATOR', value: op, precedence: this.getOperatorPrecedence(op)});
                    i += op.length;
                    continue;
                }

                // Single character tokens
                const singleCharTokens = this.SINGLE_CHAR_TOKENS;

                if (singleCharTokens[char]) {
                    tokens.push({type: singleCharTokens[char], value: char});
                    i++;
                    continue;
                }

                // Single character operators
                if ('+-*/<>!?:%'.includes(char)) {
                    const precedence = this.getOperatorPrecedence(char);

                    let type;
                    switch (char) {
                        case '?':
                            type = 'QUESTION';
                            break;

                        case ':':
                            type = 'COLON';
                            break;

                        default:
                            type = 'OPERATOR';
                            break;
                    }

                    tokens.push({type, value: char, precedence});
                    i++;
                    continue;
                }

                // Identifiers and keywords
                if (/[a-zA-Z_$]/.test(char)) {
                    const result = this.tokenizeIdentifier(expression, i);
                    tokens.push(result.token);
                    i = result.nextIndex;
                    continue;
                }

                // Unknown character - skip it
                i++;
            }

            return tokens;
        },

        /**
         * Tokenizes a string literal
         * @param {string} expression - Full expression
         * @param {number} start - Starting index
         * @returns {Object} {token, nextIndex}
         */
        tokenizeString(expression, start) {
            const quote = expression[start];
            let i = start + 1;
            let value = '';

            while (i < expression.length) {
                const char = expression[i];

                if (char === '\\' && i + 1 < expression.length) {
                    // Handle escaped characters
                    const nextChar = expression[i + 1];

                    if (nextChar === quote || nextChar === '\\') {
                        value += nextChar;
                        i += 2;
                    } else {
                        value += char;
                        i++;
                    }
                } else if (char === quote) {
                    // End of string
                    return {
                        token: {type: 'STRING', value},
                        nextIndex: i + 1
                    };
                } else {
                    value += char;
                    i++;
                }
            }

            // Unterminated string - throw error
            throw new Error(`Unterminated string literal starting at position ${start}: expected closing ${quote}`);
        },

        /**
         * Tokenizes a number literal
         * @param {string} expression - Full expression
         * @param {number} start - Starting index
         * @returns {Object} {token, nextIndex}
         */
        tokenizeNumber(expression, start) {
            const numberMatch = /^(\d*\.?\d+(?:[eE][+-]?\d+)?)/.exec(expression.slice(start));

            if (numberMatch) {
                return {
                    token: {type: 'NUMBER', value: parseFloat(numberMatch[1])},
                    nextIndex: start + numberMatch[1].length
                };
            }
        },

        /**
         * Tokenizes an identifier or keyword
         * @param {string} expression - Full expression
         * @param {number} start - Starting index
         * @returns {Object} {token, nextIndex}
         */
        tokenizeIdentifier(expression, start) {
            const identMatch = /^([a-zA-Z_$][a-zA-Z0-9_$]*)/.exec(expression.slice(start));

            if (identMatch) {
                const value = identMatch[1];
                const type = ['true', 'false', 'null', 'undefined'].includes(value) ? 'KEYWORD' : 'IDENTIFIER';

                return {
                    token: {type, value},
                    nextIndex: start + value.length
                };
            }
        },

        /**
         * Gets operator precedence (higher number = higher precedence)
         * @param {string} operator - Operator to check
         * @returns {number} Precedence level (0 if operator not found)
         */
        getOperatorPrecedence(operator) {
            return this.OPERATOR_PRECEDENCE[operator] || 0;
        },

        /**
         * Parses ternary conditional expressions (condition ? true : false)
         * @returns {Object|null} Ternary AST node or lower precedence expression
         */
        parseTernary() {
            let expr = this.parseBinaryWithPrecedence(1);

            if (this.match('QUESTION')) {
                const trueExpr = this.parseTernary();
                this.consume('COLON', 'Expected ":" in ternary expression');
                const falseExpr = this.parseTernary();

                return {
                    type: 'ternary',
                    condition: expr,
                    trueValue: trueExpr,
                    falseValue: falseExpr
                };
            }

            return expr;
        },

        /**
         * Parse binary expressions with operator precedence using the precedence climbing method.
         * This recursive algorithm handles operator precedence and associativity correctly.
         * @param {number} minPrec - Minimum precedence level for operators to be parsed at this level
         * @returns {Object} AST node representing the parsed expression tree
         */
        parseBinaryWithPrecedence(minPrec) {
            // Start by parsing the left operand (could be a unary expression, literal, etc.)
            let left = this.parseUnary();

            // Continue parsing while we encounter operators
            while (this.peek().type === 'OPERATOR') {
                // Get the precedence of the current operator
                const opPrec = this.getOperatorPrecedence(this.peek().value);

                // If this operator's precedence is lower than our minimum threshold,
                // we should stop parsing at this level and let a higher level handle it
                if (opPrec < minPrec) {
                    break;
                }

                // Consume the operator token
                const op = this.advance().value;

                // Parse the right operand with higher precedence (opPrec + 1)
                // This ensures left-associativity by requiring higher precedence for right side
                // For right-associative operators, you would use opPrec instead of opPrec + 1
                const right = this.parseBinaryWithPrecedence(opPrec + 1);

                // Determine the AST node type based on the operator
                // Falls back to 'arithmetic' if operator type is not defined
                const type = this.OPERATOR_TYPES[op] || 'arithmetic';

                // Create a new binary expression node with the parsed components
                // This becomes the new left operand for potential further parsing
                left = {type, left, operator: op, right};
            }

            // Return the final parsed expression (could be the original left operand
            // if no operators were processed, or a complex binary expression tree)
            return left;
        },

        /**
         * Parses unary expressions (!, -, +)
         * @returns {Object|null} Unary AST node or primary expression
         */
        parseUnary() {
            if (this.matchOperator('!', '-', '+')) {
                const operator = this.previous().value;
                const operand = this.parseUnary();

                return {
                    type: 'unary',
                    operator,
                    operand
                };
            }

            return this.parsePrimary();
        },

        /**
         * Parses primary expressions (parentheses, properties, literals)
         * @returns {Object|null} Primary expression AST node
         */
        parsePrimary() {
            // Parentheses
            if (this.match('LPAREN')) {
                const expr = this.parseTernary();
                this.consume('RPAREN', 'Expected closing parenthesis');

                return this.parsePostfixOperators({
                    type: 'parentheses',
                    inner: expr
                });
            }

            // Array literals
            if (this.match('LBRACKET')) {
                return this.parsePostfixOperators(this.parseArrayLiteral());
            }

            // Object literals
            if (this.match('LBRACE')) {
                return this.parsePostfixOperators(this.parseObjectLiteral());
            }

            // String and number literals share the same AST shape
            if (this.check('STRING') || this.check('NUMBER')) {
                return this.parsePostfixOperators({
                    type: 'literal',
                    value: this.advance().value
                });
            }

            // Keywords (true, false, null, undefined)
            if (this.check('KEYWORD')) {
                return this.parsePostfixOperators({
                    type: 'literal',
                    value: ExpressionParser.KEYWORD_VALUES[this.advance().value]
                });
            }

            // Property access
            if (this.check('IDENTIFIER')) {
                return this.parsePostfixOperators(this.parsePropertyAccess());
            }

            return null;
        },

        /**
         * Parses postfix operators including array/object indexing, property access, and method calls.
         * Handles chaining of multiple postfix operations (e.g., obj.prop[0].method()).
         * @param {Object} expr - The base expression to apply postfix operators to
         * @returns {Object} The final expression tree with all postfix operations applied
         * @throws {Error} When expected tokens are missing (closing bracket, property name, closing parenthesis)
         */
        parsePostfixOperators(expr) {
            // Continuously consume postfix operators left-to-right until none remain.
            // Each iteration wraps `expr` in a new AST node, building an inside-out tree
            // where the outermost node is the last operation in the chain.
            while (true) {
                // Array/object indexing: expr[index]
                // The index is a full expression (parsed via parseTernary) so
                // computed access like obj[cond ? a : b] is supported.
                if (this.match('LBRACKET')) {
                    const index = this.parseTernary();

                    this.consume('RBRACKET', 'Expected closing bracket');

                    expr = {
                        type: 'index',
                        object: expr,
                        index
                    };

                    continue;
                }

                // Property access or method call: expr.name or expr.name(args)
                // The token after the dot must be an identifier; anything else
                // (e.g., a number literal or operator) is a syntax error.
                if (this.match('DOT')) {
                    if (this.check('IDENTIFIER')) {
                        const property = this.advance().value;

                        if (this.match('LPAREN')) {
                            const args = this.parseArgumentList();
                            this.consume('RPAREN', 'Expected closing parenthesis');

                            // Emit qualified_call only when the object is a bare root identifier.
                            // Chained access (user.StringUtils.fn()) is unambiguously a method_call.
                            if (expr.type === 'identifier') {
                                expr = {
                                    type: 'qualified_call',
                                    unit: expr.name,
                                    method: property,
                                    arguments: args
                                };
                            } else {
                                expr = {
                                    type: 'method_call',
                                    object: expr,
                                    method: property,
                                    arguments: args
                                };
                            }
                        } else {
                            expr = {
                                type: 'member',
                                object: expr,
                                property
                            };
                        }
                    } else {
                        throw new Error('Expected property name after "."');
                    }

                    continue;
                }

                // Standalone function call: name(args)
                // This branch only fires when the base expression is a bare
                // identifier (not a member/index result), preventing expressions
                // like (a + b)(args) from being misinterpreted as calls.
                // Chained calls like foo()() are not matched here — the first
                // call produces a 'call' node, and subsequent parentheses won't
                // satisfy the expr.type === 'identifier' guard.
                if (expr.type === 'identifier' && this.match('LPAREN')) {
                    const args = this.parseArgumentList();
                    this.consume('RPAREN', 'Expected closing parenthesis');

                    expr = {
                        type: 'call',
                        name: expr.name,
                        arguments: args
                    };

                    continue;
                }

                // No postfix operator found — exit the loop and return the
                // fully-wrapped expression tree.
                break;
            }

            return expr;
        },

        /**
         * Parses a comma-separated list of function arguments.
         * Continues parsing until reaching a closing parenthesis or end of input.
         * @returns {Array} Array of parsed argument expressions
         */
        parseArgumentList() {
            const args = [];

            if (!this.check('RPAREN')) {
                do {
                    args.push(this.parseTernary());
                } while (this.match('COMMA') && !this.check('RPAREN'));
            }

            return args;
        },

        /**
         * Parses an array literal expression, handling comma-separated elements.
         * Expects the opening bracket to already be consumed.
         * @returns {{type: string, elements: *[]}} AST node representing the array literal
         * @returns {string} returns.type - Always 'array'
         * @returns {Array} returns.elements - Array of parsed element expressions
         * @throws {Error} When closing bracket is missing
         * @example
         */
        parseArrayLiteral() {
            const elements = [];

            if (!this.check('RBRACKET')) {
                do {
                    elements.push(this.parseTernary());
                } while (this.match('COMMA') && !this.check('RBRACKET'));
            }

            this.consume('RBRACKET', 'Expected closing bracket');

            return {
                type: 'array',
                elements
            };
        },

        /**
         * Parses object literals { key: value, ... }
         * @returns {Object} Object literal AST node
         */
        parseObjectLiteral() {
            const pairs = [];

            if (!this.check('RBRACE')) {
                do {
                    // Parse key
                    let key;
                    if (this.check('STRING')) {
                        key = this.advance().value;
                    } else if (this.check('IDENTIFIER')) {
                        key = this.advance().value;
                    } else {
                        throw new Error('Expected property name');
                    }

                    this.consume('COLON', 'Expected ":" after object key');

                    // Parse value
                    const value = this.parseTernary();

                    pairs.push({key, value});

                } while (this.match('COMMA') && !this.check('RBRACE'));
            }

            this.consume('RBRACE', 'Expected closing brace');

            return {
                type: 'object',
                pairs
            };
        },

        /**
         * Parses property access expressions (obj.prop, obj[key], etc.)
         * @returns {Object} Property access AST node
         */
        parsePropertyAccess() {
            const node = { type: 'identifier', name: this.advance().value };
            return this.parsePostfixOperators(node);
        },

        /**
         * Converts an AST node back to a dot/bracket path string
         * for the reactive binding system's change tracking.
         * @param {Object} node - AST node (identifier, member, or index)
         * @returns {string} Path string (e.g. "foo.bar[0].baz")
         */
        astToPath(node) {
            if (!node) {
                return '';
            }

            switch (node.type) {
                case 'identifier':
                    return node.name;

                case 'member':
                    return this.astToPath(node.object) + '.' + node.property;

                case 'index': {
                    const obj = this.astToPath(node.object);

                    if (node.index.type === 'literal') {
                        return obj + '[' + JSON.stringify(node.index.value) + ']';
                    }

                    return obj + '[' + this.astToPath(node.index) + ']';
                }

                case 'literal':
                    return JSON.stringify(node.value);

                case 'arithmetic':
                    return this.astToPath(node.left) + ' ' + node.operator + ' ' + this.astToPath(node.right);

                default:
                    return '';
            }
        },

        /**
         * Checks if current token matches any of the given types
         * @param {...string} types - Token types to match
         * @returns {boolean} True if current token matches any type
         */
        match(...types) {
            for (const type of types) {
                if (this.check(type)) {
                    this.advance();
                    return true;
                }
            }

            return false;
        },

        /**
         * Checks if current token is an operator with given value(s)
         * @param {...string} operators - Operator values to match
         * @returns {boolean} True if current token is a matching operator
         */
        matchOperator(...operators) {
            if (this.check('OPERATOR')) {
                const current = this.peek();

                if (operators.includes(current.value)) {
                    this.advance();
                    return true;
                }
            }

            return false;
        },

        /**
         * Checks if current token is of given type
         * @param {string} type - Token type to check
         * @returns {boolean} True if current token matches type
         */
        check(type) {
            if (this.isAtEnd()) {
                return false;
            }

            return this.peek().type === type;
        },

        /**
         * Advances to next token and returns previous
         * @returns {Object} Previous token
         */
        advance() {
            if (!this.isAtEnd()) {
                this.currentToken++;
            }

            return this.previous();
        },

        /**
         * Checks if we're at end of tokens
         * @returns {boolean} True if at end
         */
        isAtEnd() {
            return this.currentToken >= this.tokens.length;
        },

        /**
         * Returns current token without advancing
         * @returns {Object} Current token
         */
        peek() {
            return this.tokens[this.currentToken] || {type: 'EOF', value: null};
        },

        /**
         * Returns previous token
         * @returns {Object} Previous token
         */
        previous() {
            return this.tokens[this.currentToken - 1];
        },

        /**
         * Consumes token of given type or throws error
         * @param {string} type - Expected token type
         * @param {string} message - Error message if not found
         * @returns {Object} Consumed token
         */
        consume(type, message) {
            if (this.check(type)) {
                return this.advance();
            }

            throw new Error(message + ` at token: ${JSON.stringify(this.peek())}`);
        },

        /**
         * Evaluates a parsed expression in the given context
         * @param {Object} node - Parsed expression object
         * @param {Object} context - Evaluation context
         * @param scope
         * @returns {*} Evaluated result
         */
        evaluate(node, context, scope = null) {
            if (!node) {
                return undefined;
            }

            switch (node.type) {
                case 'literal':
                    return node.value;

                case 'property':
                    return this.getProperty(node.path, context, scope);

                case 'identifier':
                    return this.getProperty(node.name, context, scope);

                case 'parentheses':
                    return this.evaluate(node.inner, context, scope);

                case 'array':
                    return this.evaluateArrayLiteral(node, context, scope);

                case 'object':
                    return this.evaluateObjectLiteral(node, context, scope);

                case 'index': {
                    if (scope) {
                        return this.getProperty(this.astToPath(node), context, scope);
                    }

                    const obj = this.evaluate(node.object, context, scope);
                    const key = this.evaluate(node.index, context, scope);
                    return obj && obj[key];
                }

                case 'ternary': {
                    const condition = this.evaluate(node.condition, context, scope);

                    return condition ?
                        this.evaluate(node.trueValue, context, scope) :
                        this.evaluate(node.falseValue, context, scope);
                }

                case 'logical': {
                    const leftLogical = this.evaluate(node.left, context, scope);

                    if (node.operator === '&&') {
                        return leftLogical ? this.evaluate(node.right, context, scope) : leftLogical;
                    } else if (node.operator === '||') {
                        return leftLogical ? leftLogical : this.evaluate(node.right, context, scope);
                    } else {
                        return leftLogical;
                    }
                }

                case 'comparison':
                case 'arithmetic': {
                    const leftVal = this.evaluate(node.left, context, scope);
                    const rightVal = this.evaluate(node.right, context, scope);
                    return this.performOperation(leftVal, node.operator, rightVal);
                }

                case 'unary': {
                    const operandValue = this.evaluate(node.operand, context, scope);

                    switch (node.operator) {
                        case '!':
                            return !operandValue;

                        case '-':
                            return -operandValue;

                        case '+':
                            return +operandValue;

                        default:
                            return operandValue;
                    }
                }

                case 'member': {
                    if (scope) {
                        return this.getProperty(this.astToPath(node), context, scope);
                    }

                    const obj = this.evaluate(node.object, context, scope);
                    return obj && obj[node.property];
                }

                case 'method_call': {
                    const object = this.evaluate(node.object, context, scope);

                    // Handle array methods
                    if (Array.isArray(object)) {
                        return this.evaluateArrayMethod(object, node.method,
                            node.arguments.map(arg => this.evaluate(arg, context, scope))
                        );
                    }

                    // Security: Only allow methods on whitelisted objects
                    console.warn('Method calls only supported on arrays');
                    return undefined;
                }

                case 'qualified_call': {
                    // Variable wins: if the identifier exists in the data context, treat as
                    // a regular method call on that object.
                    const obj = this.getProperty(node.unit, context, scope);

                    if (obj !== undefined) {
                        // Warn when a data variable is shadowing a registered unit
                        if (_units.get(node.unit)) {
                            console.warn(`WakaPAC: data property "${node.unit}" is shadowing a registered unit`);
                        }

                        const args = node.arguments.map(arg => this.evaluate(arg, context, scope));

                        if (Array.isArray(obj)) {
                            return this.evaluateArrayMethod(obj, node.method, args);
                        }

                        if (typeof obj[node.method] === 'function') {
                            return obj[node.method](...args);
                        }

                        return undefined;
                    }

                    // Fall back to unit registry (namespaced call)
                    const unit = _units.get(node.unit);

                    if (unit && typeof unit[node.method] === 'function') {
                        const args = node.arguments.map(arg => this.evaluate(arg, context, scope));
                        return unit[node.method](...args);
                    }

                    console.warn(`WakaPAC: unknown qualified call ${node.unit}.${node.method}()`);
                    return undefined;
                }

                case 'call': {
                    // Check the component's own data context first
                    const fn = this.getProperty(node.name, context, scope);

                    if (typeof fn === 'function') {
                        const args = node.arguments.map(arg => this.evaluate(arg, context, scope));
                        return fn.call(context, ...args);
                    }

                    // Fall back to imported units (from data-pac-uses flat import)
                    const importedUnits = scope?.importedUnits;

                    if (importedUnits && typeof importedUnits[node.name] === 'function') {
                        const args = node.arguments.map(arg => this.evaluate(arg, context, scope));
                        return importedUnits[node.name](...args);
                    }

                    // Not found
                    console.warn(`WakaPAC: unknown function call "${node.name}()" in template`);
                    return undefined;
                }

                default:
                    return undefined;
            }
        },

        /**
         * Evaluates a supported array method by name, acting as a safe dispatch
         * layer that prevents arbitrary method execution on arrays.
         * @param {Array} array - The array to invoke the method on.
         * @param {string} methodName - The name of the array method to evaluate.
         * @param {Array} args - The arguments to pass to the array method.
         * @returns {*} The result of the array method, or undefined if the method is not supported.
         */
        evaluateArrayMethod(array, methodName, args) {
            switch (methodName) {
                case 'includes':
                    return array.includes(args[0]);

                case 'indexOf':
                    return array.indexOf(args[0]);

                case 'length':
                    return array.length;

                case 'join':
                    return array.join(args[0] || ',');

                default:
                    console.warn(`Array method '${methodName}' not supported`);
                    return undefined;
            }
        },

        /**
         * Retrieves a value from a nested object using a dot/bracket notation path.
         * Supports scope resolution for resolving aliased or scoped paths before traversal.
         * @param {string} path - The property path to resolve (e.g. "user.address[0].street").
         * @param {Object} obj - The source object to retrieve the value from.
         * @param {Object|null} [scope=null] - Optional resolver with a `resolveScopedPath` method
         *   that transforms the path before traversal. If the resolved path is a number, it is returned directly.
         * @returns {*} The value at the resolved path, or `undefined` if the path is invalid
         *   or any intermediate property is nullish.
         */
        getProperty(path, obj, scope = null) {
            if (!obj || !path) {
                return undefined;
            }

            let resolvedPath = path;

            // Use context to resolve scoped paths if available
            if (scope && scope.resolveScopedPath) {
                resolvedPath = scope.resolveScopedPath(path);
            }

            // If resolved path is a number, return it directly
            if (typeof resolvedPath === 'number') {
                return resolvedPath;
            }

            // Ensure resolvedPath is a string for string operations
            resolvedPath = String(resolvedPath);

            // Handle simple property access (no dots or brackets)
            if (resolvedPath.indexOf('.') === -1 && resolvedPath.indexOf('[') === -1) {
                return (resolvedPath in obj) ? obj[resolvedPath] : undefined;
            }

            // Split path by both dots and brackets, handling bracket notation correctly
            const parts = resolvedPath.split(DOTS_AND_BRACKETS_PATTERN).filter(Boolean);
            let current = obj;

            for (let i = 0; i < parts.length; i++) {
                // Null check
                if (current == null) {
                    return undefined;
                }

                // Extract the part
                let part = parts[i];

                // If current is a string, access native string properties directly
                if (typeof current === 'string') {
                    return current[part];
                }

                // If the path segment is not a numeric index and not a direct key on the
                // current object, try to resolve it as a variable from the root context.
                // This allows dynamic bracket notation like regions[country] where 'country'
                // is a reactive property rather than a literal key.
                if (isNaN(part) && !(part in current) && part in obj) {
                    part = obj[part];
                }

                current = current[part];
            }

            return current;
        },

        /**
         * Evaluates an array literal AST node into a JavaScript array by recursively
         * evaluating each element expression.
         * @param {Object} arrayExpr - The array literal AST node.
         * @param {Object} arrayExpr.elements - The array of element expressions to evaluate.
         * @param {Object} context - The evaluation context providing variable bindings.
         * @param {Object|null} [resolverContext=null] - Optional scope resolver context
         * @returns {Array<*>} The evaluated array, or an empty array if no elements are defined.
         */
        evaluateArrayLiteral(arrayExpr, context, resolverContext = null) {
            const self = this;

            if (!arrayExpr.elements) {
                return [];
            }

            return arrayExpr.elements.map(function(element) {
                return self.evaluate(element, context, resolverContext);
            });
        },

        /**
         * Evaluates an object literal AST node into a plain JavaScript object by recursively
         * evaluating each value expression.
         * @param {Object} node - The object literal AST node.
         * @param {Array<{key: string, value: Object}>} node.pairs - The key-value pairs to evaluate.
         * @param {Object} context - The evaluation context providing variable bindings.
         * @param {Object|null} [scope=null] - Optional scope resolver context
         * @returns {Object} The evaluated plain object, or an empty object if no pairs are defined.
         */
        evaluateObjectLiteral: function(node, context, scope) {
            const self = this;
            const result = {};

            if (node.pairs) {
                node.pairs.forEach(function({key, value}) {
                    result[key] = self.evaluate(value, context, scope);
                });
            }

            return result;
        },

        /**
         * Performs a binary operation on two operands.
         * Arithmetic operators (`-`, `*`, `/`, `%`) coerce operands to `Number`;
         * `+` uses native addition (supporting both numeric addition and string concatenation).
         * @param {*} left - The left-hand operand.
         * @param {string} operator - The operator to apply.
         * @param {*} right - The right-hand operand.
         * @returns {number|boolean} The result of the operation, or `false` for unrecognized operators.
         */
        performOperation(left, operator, right) {
            switch (operator) {
                case '+':
                    return left + right;

                case '-':
                    return Number(left) - Number(right);

                case '*':
                    return Number(left) * Number(right);

                case '/':
                    return Number(left) / Number(right);

                case '%':
                    return Number(left) % Number(right);

                case '===':
                    return left === right;

                case '!==':
                    return left !== right;

                case '==':
                    return left == right;

                case '!=':
                    return left != right;

                case '>=':
                    return left >= right;

                case '<=':
                    return left <= right;

                case '>':
                    return left > right;

                case '<':
                    return left < right;

                default:
                    return false;
            }
        },

        /**
         * Parses a binding string into key-value pairs
         * @param {string} bindingString - Binding string to parse
         * @returns {Array} Array of binding pairs
         */
        parseBindingString(bindingString) {
            const pairs = [];
            let current = '';
            let inQuotes = false;
            let quoteChar = '';
            let parenDepth = 0;
            let braceDepth = 0;
            let bracketDepth = 0;  // ADD: Track bracket depth

            for (let i = 0; i < bindingString.length; i++) {
                const char = bindingString[i];
                const isEscaped = i > 0 && bindingString[i - 1] === '\\';

                if ((char === '"' || char === "'") && !isEscaped) {
                    if (!inQuotes) {
                        inQuotes = true;
                        quoteChar = char;
                    } else if (char === quoteChar) {
                        inQuotes = false;
                        quoteChar = '';
                    }
                }

                if (!inQuotes) {
                    if (char === '(') {
                        parenDepth++;
                    } else if (char === ')') {
                        parenDepth--;
                    } else if (char === '{') {
                        braceDepth++;
                    } else if (char === '}') {
                        braceDepth--;
                    } else if (char === '[') {          // ADD: Track opening brackets
                        bracketDepth++;
                    } else if (char === ']') {          // ADD: Track closing brackets
                        bracketDepth--;
                    }
                }

                // Only split on commas at top level (not inside nested structures)
                if (char === ',' && !inQuotes && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
                    this.addBindingPairIfValid(current, pairs);
                    current = '';
                } else {
                    current += char;
                }
            }

            this.addBindingPairIfValid(current, pairs);
            return pairs;
        },

        /**
         * Parses a single "key: value" binding fragment and appends it to the result list
         * if it is structurally valid.
         * @param {string} pairString - Raw binding fragment (no top-level commas)
         * @param {Array} pairs - Accumulator array for parsed bindings
         */
        addBindingPairIfValid(pairString, pairs) {
            // Remove leading/trailing whitespace so empty fragments can be ignored early
            const trimmedPair = pairString.trim();

            if (!trimmedPair) {
                return;
            }

            // Locate the first colon.
            const colonIndex = trimmedPair.indexOf(':');

            // No colon means this fragment cannot be a key-value binding
            if (colonIndex === -1) {
                return;
            }

            // Extract the raw key portion (everything before the colon)
            const rawKey = trimmedPair.slice(0, colonIndex).trim();

            // Normalize the key by stripping surrounding quotes if present.
            // Only outer quotes are removed; inner quotes are preserved.
            const key = rawKey.replace(/^['"]|['"]$/g, '');

            // Guard against cases like ": value" or "'': value"
            if (!key) {
                return;
            }

            // Extract the value portion (everything after the first colon).
            // The value is kept intact because it may contain nested structures
            // such as objects, arrays, function calls, or ternaries.
            const value = trimmedPair.slice(colonIndex + 1).trim();

            // Store the parsed binding pair in a normalized structure
            pairs.push({
                type: key,
                target: value
            });
        }
    };

    // ============================================================================
    // Parser caching
    // ============================================================================

    /**
     * A caching layer for parsed expressions with LRU eviction policy.
     * Improves performance by avoiding redundant parsing of identical expressions.
     * @namespace ExpressionCache
     */
    const ExpressionCache = {
        /** @type {Map<string, *>} Internal cache storage mapping expression strings to parsed results */
        cache: new Map(),

        /** @type {Map<string, *>} Internal cache for binding strings */
        bindingCache: new Map(),

        /** @type {number} Maximum number of cached entries before LRU eviction begins */
        maxSize: 1000, // Prevent unbounded growth

        /**
         * Returns a cached parse result for a key, computing and storing it if absent.
         * Keys are normalized via trimming. When the cache reaches maxSize,
         * the oldest entry is evicted (FIFO) before inserting the new value.
         * @param {Map<string, *>} cache - Cache storing normalized keys to parse results.
         * @param {*} key - Input key to normalize and parse.
         * @param {(key: *) => *} parseFn - Function that computes the result for the key.
         * @returns {*} The cached or newly computed parse result.
         */
        _cachedParse(cache, key, parseFn) {
            // Normalize the key to avoid duplicate entries caused by whitespace.
            const trimmed = String(key).trim();

            // Fast path: return cached value if present.
            if (cache.has(trimmed)) {
                return cache.get(trimmed);
            }

            // Compute the value since it is not cached yet.
            const result = parseFn(key);

            // Evict the oldest entry if the cache is at capacity.
            if (cache.size >= this.maxSize) {
                cache.delete(cache.keys().next().value);
            }

            // Store the computed result under the normalized key.
            cache.set(trimmed, result);

            // Return the result
            return result;
        },

        /**
         * Parses an expression with caching support.
         * Uses string representation of the expression as cache key for consistent lookups.
         * Implements simple LRU eviction when cache exceeds maxSize.
         * @param {*} expression - The expression to parse (will be converted to string for caching)
         * @returns {*} The parsed expression result from ExpressionParser or cache
         */
        parseExpression(expression) {
            return this._cachedParse(this.cache, expression, e => ExpressionParser.parseExpression(e));
        },

        /**
         * Parses a binding string with caching support.
         * Uses string representation of the binding string as cache key for consistent lookups.
         * Implements simple LRU eviction when cache exceeds maxSize.
         * @param {string} bindingString - The binding string to parse (e.g., "value: name, class: { active: isActive }")
         * @returns {Array} The parsed binding pairs from ExpressionParser or cache
         */
        parseBindingString(bindingString) {
            return this._cachedParse(this.bindingCache, bindingString, s => ExpressionParser.parseBindingString(s));
        }
    };

    // ========================================================================
    // BINDING HANDLERS - Extensible binding type registry
    // ========================================================================

    /**
     * Registry of binding handlers. Each handler is a function that applies
     * a binding value to a DOM element.
     *
     * Handler signature: function(context, element, value)
     * - context: Reference to context
     * - element: The DOM element to update
     * - value: The evaluated binding value
     *
     * Users can register custom bindings via wakaPAC.registerBinding()
     */
    const BindingHandlers = {};

    // =============================================================================
    // BUILT-IN BINDING HANDLERS
    // =============================================================================

    /**
     * Value binding - Updates form element values
     * @param {Context} context - The PAC component context
     * @param {Element} element - The container element
     * @param value - The evaluated expression
     */
    BindingHandlers.value = function(context, element, value) {
        // Handle radio buttons specially - they should be checked/unchecked based on value match
        if (element.type === 'radio') {
            element.checked = (element.value === String(value));
            return;
        }

        // Handle <select multiple> — value must be an array of selected option values.
        // Iterates all options and sets each one's selected state individually so that
        // non-array values (null, undefined, a plain string) deselect everything gracefully.
        if (element.multiple) {
            const selected = Array.isArray(value) ? value.map(String) : [];

            for (let i = 0; i < element.options.length; i++) {
                element.options[i].selected = selected.includes(element.options[i].value);
            }

            return;
        }

        // Handle all other elements with value property (input, select, textarea, etc.)
        if ('value' in element) {
            const stringValue = String(value || '');

            if (element.value !== stringValue) {
                element.value = stringValue;
            }
        }
    };

    /**
     * Checked binding - Updates checkbox/radio checked state
     * @param {Context} context - The PAC component context
     * @param {Element} element - The container element
     * @param value - The evaluated expression
     */
    BindingHandlers.checked = function(context, element, value) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            const newChecked = Boolean(value);

            // Only update if the value is actually different
            if (element.checked !== newChecked) {
                element.checked = newChecked;
            }
        }
    };

    /**
     * Visible binding - Shows/hides elements by managing display CSS
     * @param {Context} context - The PAC component context
     * @param {Element} element - The container element
     * @param value - The evaluated expression
     */
    BindingHandlers.visible = function(context, element, value) {
        const shouldShow = !!value;

        if (shouldShow) {
            if (element.hasAttribute('data-pac-hidden')) {
                element.style.display = element.getAttribute('data-pac-orig-display') || 'block';
                element.removeAttribute('data-pac-hidden');
                element.removeAttribute('data-pac-orig-display');
            }
        } else {
            if (!element.hasAttribute('data-pac-hidden')) {
                const currentDisplay = getComputedStyle(element).display;

                if (currentDisplay !== 'none') {
                    element.setAttribute('data-pac-orig-display', currentDisplay);
                }

                element.style.display = 'none';
                element.setAttribute('data-pac-hidden', 'true');
            }
        }
    };

    /**
     * If binding — conditionally renders an element's child content.
     * @param {Context} context - The PAC component context
     * @param {Element} element - The container element
     * @param {*} value - Truthy = show, falsy = hide
     */
    BindingHandlers.if = function(context, element, value) {
        // Convert value to boolean
        const shouldShow = !!value;

        // First invocation: snapshot child nodes as live references
        if (element._pacIfChildren === undefined) {
            element._pacIfChildren = Array.from(element.childNodes);
            element._pacIsVisible = true;
        }

        // If already shown, do not change
        if (shouldShow === element._pacIsVisible) {
            return;
        }

        // Toggle DOM first, then update flag
        context.domUpdater.toggleNodeVisibility(element._pacIfChildren, shouldShow);

        // Set new show flag after successful DOM update
        element._pacIsVisible = shouldShow;

        // Scan from the if-container so restored children (including
        // foreach elements) are treated as children, not as parentElement
        if (shouldShow) {
            context.scanAndRegisterNewElements(element);
        }
    };

    /**
     * Class binding - Manages CSS classes (string or object syntax)
     * @param {Context} context - The PAC component context
     * @param {Element} element - The container element
     * @param value - The evaluated expression
     */
    BindingHandlers.class = function(context, element, value) {
        // Object syntax: { active: true, disabled: false }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            for (const className in value) {
                if (value[className]) {
                    element.classList.add(className);
                } else {
                    element.classList.remove(className);
                }
            }

            return;
        }

        // String syntax: "active disabled" or single "active"
        if (typeof value === 'string') {
            // Parse new classes from the space-separated string
            const newClasses = value.split(/\s+/).filter(Boolean);

            // Remove old dynamic classes that aren't in the new set
            if (element._pacDynamicClasses) {
                for (let i = 0; i < element._pacDynamicClasses.length; i++) {
                    if (newClasses.indexOf(element._pacDynamicClasses[i]) === -1) {
                        element.classList.remove(element._pacDynamicClasses[i]);
                    }
                }
            }

            // Add new classes
            for (let i = 0; i < newClasses.length; i++) {
                element.classList.add(newClasses[i]);
            }

            // Track current set for next update
            element._pacDynamicClasses = newClasses;
        }
    };

    /**
     * Style binding - Applies inline styles (object or string syntax)
     * @param {Context} context - The PAC component context
     * @param {Element} element - The container element
     * @param value - The evaluated expression
     */
    BindingHandlers.style = function(context, element, value) {
        // Object syntax: { color: 'red', fontSize: '16px' }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            for (const prop in value) {
                if (value[prop] != null) {
                    if (prop.startsWith('--')) {
                        element.style.setProperty(prop, value[prop]);
                    } else {
                        element.style[prop] = value[prop];
                    }
                }
            }

            return;
        }

        // String syntax: "color: red; font-size: 16px;"
        if (typeof value === 'string') {
            element.style.cssText = value;
        }
    };

    // ========================================================================
    // DOM UPDATER - Handles ALL binding applications
    // ========================================================================

    /**
     * Factory that creates a scopeResolver object for ExpressionParser.evaluate().
     * All scopeResolver instances share the same shape — this avoids repeating the
     * object literal at every call site and gives the minifier a single declaration to mangle.
     * @param {Function} normalizeFn - Bound normalizePath function (already bound to correct `this`)
     * @param {Element} element - The DOM element to use as path scope anchor
     * @param importedUnits - List of imported units
     * @returns {{ resolveScopedPath: function(string): * }}
     */
    function makeScopeResolver(normalizeFn, element, importedUnits) {
        return {
            resolveScopedPath: (path) => normalizeFn(path, element),
            importedUnits: importedUnits || {}
        };
    }

    function DomUpdater(context) {
        this.context = context;
    }

    /**
     * Updates a text node by interpolating expressions within the template string.
     * Replaces interpolation patterns with evaluated expression results.
     * @param {Text|Node} element - The text node or element to update
     * @param {string} template - Template string containing interpolation expressions (e.g., "Hello {{name}}")
     * @returns {void}
     */
    DomUpdater.prototype.updateTextNode = function (element, template) {
        const self = this;

        const newText = template.replace(INTERPOLATION_REGEX, (match, expression) => {
            try {
                // Evaluate the expression using the scope resolver
                const result = ExpressionParser.evaluate(
                    ExpressionCache.parseExpression(expression),
                    self.context.abstraction,
                    makeScopeResolver(
                        self.context.normalizePath.bind(self.context),
                        element,
                        self.context.importedUnits
                    )
                );

                return result != null ? String(result) : '';
            } catch (error) {
                console.warn('Error in text interpolation:', expression, error);
                return match;
            }
        });

        if (element.textContent !== newText) {
            element.textContent = newText;
        }
    };

    /**
     * Updates an element's attribute or property based on data binding configuration.
     * Evaluates the binding expression and applies the result using the appropriate binding method.
     * @param {Element} element - The DOM element to update
     * @param {string} bindingType - Type of binding (value, checked, visible, class, style, or attribute name)
     * @param {Object} bindingData - Binding configuration object
     * @param {string} bindingData.target - Expression string to evaluate for the binding value
     * @param {*} [value] - Pre-evaluated value to skip redundant expression evaluation
     * @returns {void}
     */
    DomUpdater.prototype.updateAttributeBinding = function (element, bindingType, bindingData, value) {
        try {
            // Use registered handler if available
            const handler = BindingHandlers[bindingType];

            if (handler) {
                handler(this.context, element, value);
                return;
            }

            // Click and foreach handled elsewhere
            if (bindingType === 'click' || bindingType === 'foreach') {
                return;
            }

            // Default: set as attribute for unrecognized binding types
            if (bindingType === 'enable') {
                // Handle 'enable' as reverse of 'disabled'
                element.toggleAttribute('disabled', !value);
            } else if (BOOLEAN_ATTRIBUTES.has(bindingType)) {
                element.toggleAttribute(bindingType, !!value);
            } else if (value != null) {
                element.setAttribute(bindingType, value);
            } else {
                element.removeAttribute(bindingType);
            }
        } catch (error) {
            console.warn('Error updating binding:', bindingType, bindingData, error);
        }
    };

    /**
     * Toggles visibility of a set of DOM nodes by swapping them with
     * lightweight placeholder comments. Preserves all node state (event
     * listeners, component instances, form values) across hide/show cycles.
     * @param {Node[]} nodes - The DOM nodes to show or hide
     * @param {boolean} show - True to restore nodes, false to replace with placeholders
     * @returns {void}
     */
    DomUpdater.prototype.toggleNodeVisibility = function(nodes, show) {
        if (show) {
            for (let i = 0; i < nodes.length; i++) {
                const placeholder = nodes[i]._pacIfPlaceholder;

                if (placeholder && placeholder.parentNode) {
                    placeholder.parentNode.replaceChild(nodes[i], placeholder);
                }
            }
        } else {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].parentNode) {
                    if (!nodes[i]._pacIfPlaceholder) {
                        nodes[i]._pacIfPlaceholder = document.createComment('pac-if: hidden');
                    }

                    nodes[i].parentNode.replaceChild(nodes[i]._pacIfPlaceholder, nodes[i]);
                }
            }
        }
    };

    // =============================================================================
    // RAF Scheduler for timers
    // =============================================================================

    /**
     * Shared requestAnimationFrame-based timer engine.
     * Replaces setInterval for all WakaPAC component timers to avoid Firefox
     * throttling issues that cause irregular MSG_TIMER delivery.
     *
     * All active timers across all components share a single rAF loop.
     * The loop starts automatically when the first timer is added and stops
     * itself when the last timer is removed — no idle overhead.
     *
     * Timer IDs are globally unique across all components, eliminating the need
     * for compound keys or per-context ID sequences.
     */
    const RafTimerEngine = {
        /** @type {number|null} Current rAF handle, null when loop is not running */
        rafId: null,

        /** @type {number} Global timer ID counter, incremented on each add() call */
        nextTimerId: 1,

        /** @type {Map<number, {context: Context, timerId: number, elapse: number, lastFired: number}>} */
        timers: new Map(),

        /**
         * Registers a new timer entry and returns its globally unique ID.
         * Starts the rAF loop if it wasn't already running.
         * @param {Context} context - Owning context, used to resolve pacId for sendMessage
         * @param {number} elapse - Desired interval in milliseconds
         * @returns {number} Globally unique timer ID
         */
        add(context, elapse) {
            // Generate a globally unique timer ID across all components
            const timerId = this.nextTimerId++;

            this.timers.set(timerId, {
                context,
                timerId,
                elapse,
                // Initialize to now so the first fire happens after one full interval,
                // matching setInterval semantics rather than firing immediately
                lastFired: performance.now()
            });

            // Start the loop only if it isn't already running
            if (this.rafId === null) {
                this.rafId = requestAnimationFrame(this.loop.bind(this));
            }

            // Return the ID so the context can store it for killTimer lookups
            return timerId;
        },

        /**
         * Removes a timer entry by its globally unique ID.
         * Stops the rAF loop if no timers remain, avoiding idle rAF calls.
         * @param {number} timerId - Globally unique timer ID to remove
         */
        remove(timerId) {
            this.timers.delete(timerId);

            // No timers left — stop the loop to avoid running it idle
            if (this.timers.size === 0 && this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        },

        /**
         * Removes all timers belonging to a specific context.
         * Called by killAllTimers to clean up when a component is destroyed.
         * @param {Context} context - The context whose timers should be removed
         */
        removeAllForContext(context) {
            // Match entries by context reference — globally unique IDs make this safe
            for (const [timerId, entry] of this.timers) {
                if (entry.context === context) {
                    this.timers.delete(timerId);
                }
            }

            // Stop loop if no timers remain after the purge
            if (this.timers.size === 0 && this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        },

        /**
         * The rAF loop tick. Checks every registered timer against elapsed time
         * and dispatches MSG_TIMER for any that have reached their interval.
         * Reschedules itself as long as timers remain active.
         * @param {number} now - Timestamp provided by requestAnimationFrame (via performance.now())
         */
        loop(now) {
            for (const [, entry] of this.timers) {
                if (now - entry.lastFired >= entry.elapse) {
                    // Update lastFired before dispatch so that any re-entrant timer
                    // operations inside msgProc see a consistent state
                    entry.lastFired = now;
                    wakaPAC.sendMessage(entry.context.abstraction.pacId, MSG_TIMER, entry.timerId, 0);
                }
            }

            // Reschedule only if timers still exist — a killTimer inside msgProc
            // may have emptied the map, in which case we let the loop die naturally
            if (this.timers.size > 0) {
                this.rafId = requestAnimationFrame(this.loop.bind(this));
            } else {
                this.rafId = null;
            }
        }
    };

    // ========================================================================
    // CONTEXT
    // ========================================================================

    function Context(container, abstraction, config) {
        const self = this;

        this.originalAbstraction = abstraction;
        this.parent = null;
        this.children = new Set();
        this.container = container;
        this.config = config;
        this.interpolationMap = new Map();
        this.textInterpolationMap = new Map();
        this.commentBindingMap = new Map();
        this.readyCalled = false;
        this.abstraction = this.createReactiveAbstraction();
        this.domUpdater = new DomUpdater(this);

        // Resolve data-pac-uses into a flat function map for this component.
        // Functions are merged in declaration order; last entry wins on collision.
        this.importedUnits = {};
        const usesAttr = container.getAttribute('data-pac-uses');

        if (usesAttr) {
            usesAttr.split(',').forEach(name => {
                const unitName = name.trim();
                const unit = _units.get(unitName);

                if (!unit) {
                    console.warn(`WakaPAC: data-pac-uses references unknown unit "${unitName}"`);
                    return;
                }

                Object.assign(this.importedUnits, unit);
            });
        }

        // Setup dependencies
        this.dependencies = this.getDependencies();

        // Set up container-specific scroll tracking
        this.setupContainerScrollTracking();

        // Register container to shared observers
        DomUpdateTracker.observeContainer(this.container);

        // Add interval for checking updateQueue
        this.updateQueue = new Map();
        this.updateQueueTimer = null;
        this.updateQueueFireAt = 0;

        // Handle click events
        this.boundHandlePacEvent = function(event) { self.handleEvent(event); };

        // Add listeners using the stored references
        this.container.addEventListener(EV_PAC_EVENT, this.boundHandlePacEvent);
        this.container.addEventListener(EV_PAC_CHANGE, this.boundHandlePacEvent);
        this.container.addEventListener(EV_PAC_BROWSER_STATE, this.boundHandlePacEvent);
    }

    // =============================================================================
    // LIFECYCLE METHODS
    // =============================================================================

    /**
     * Component destructor - performs complete cleanup and resource deallocation.
     *
     * This method is automatically called by CleanupObserver when the component's DOM container
     * is removed from the document. It ensures all resources are properly released to prevent
     * memory leaks and dangling references.
     *
     * IMPORTANT: Do not call this method directly unless you have a very specific reason.
     * The framework handles component lifecycle automatically through DOM observation.
     *
     * Cleanup order is carefully designed to prevent issues during teardown:
     * 1. Release external resources (mouse capture)
     * 2. Remove event listeners (prevent new updates during teardown)
     * 3. Disconnect observers and clear timers (stop async callbacks)
     * 4. Call user's destroy hook (user cleanup with data still accessible)
     * 5. Kill component timers (after user hook completes)
     * 6. Remove from parent's children (break hierarchy links)
     * 7. Clear internal maps (release binding data)
     * 8. Deregister from global registry (remove from framework tracking)
     * 9. Nullify references (enable garbage collection)
     *
     * @returns {void}
     */
    Context.prototype.destroy = function() {
        // Release mouse capture if this container had it
        if (
            DomUpdateTracker._captureActive &&
            DomUpdateTracker._capturedContainer &&
            this.container === DomUpdateTracker._capturedContainer
        ) {
            DomUpdateTracker.releaseCapture();
        }

        // Clean up observers
        DomUpdateTracker.unObserveContainer(this.container);

        // Remove event listeners
        this.container.removeEventListener(EV_PAC_BROWSER_STATE, this.boundHandlePacEvent);
        this.container.removeEventListener(EV_PAC_CHANGE, this.boundHandlePacEvent);
        this.container.removeEventListener(EV_PAC_EVENT, this.boundHandlePacEvent);

        // Clear updateQueueTimer
        if (this.updateQueueTimer !== null) {
            clearTimeout(this.updateQueueTimer);
            this.updateQueueTimer = null;
        }

        // Clear boundHandlePacEvent callback
        this.boundHandlePacEvent = null;

        // Clean up container scroll listener and cancel any pending debounced call
        if (this.containerScrollHandler) {
            this.containerScrollHandler.cancel();
            this.container.removeEventListener('scroll', this.containerScrollHandler);
            this.containerScrollHandler = null;
        }

        // Kill all timers for this component
        this.killAllTimers();

        // Call user's destroy hook
        // Note: Called after event listeners are removed to prevent the user's cleanup
        // code from accidentally triggering reactive updates during component teardown.
        // Maps are still available if user code needs to access binding data.
        if (this.abstraction.destroy && typeof this.abstraction.destroy === 'function') {
            try {
                this.abstraction.destroy();
            } catch (e) {
                console.warn('Error in user destroy() hook:', e);
            }
        }

        // Remove this component from parent's children set
        if (this.parent && this.parent.children) {
            this.parent.children.delete(this);
        }

        // Clean up all maps
        this.interpolationMap.clear();
        this.textInterpolationMap.clear();
        this.commentBindingMap.clear();
        this.updateQueue.clear();

        // Cancel any active render loop for this component
        if (this.abstraction?.pacId && _renderLoops.has(this.abstraction.pacId)) {
            cancelAnimationFrame(_renderLoops.get(this.abstraction.pacId));
            _renderLoops.delete(this.abstraction.pacId);
        }

        // Capture identifiers needed for MSG_DESTROYED before nullification
        const destroyedPacId = this.abstraction.pacId || null;
        const parentPacId = this.parent ? (this.parent.abstraction?.pacId || null) : null;

        // Remove from registry
        if (destroyedPacId) {
            window.PACRegistry.deregister(destroyedPacId);
        }

        // Nullify all references to allow garbage collection
        this.abstraction = null;
        this.container = null;
        this.parent = null;
        this.children = null;
        this.config = null;

        // Notify parent that a direct child was destroyed.
        if (parentPacId && destroyedPacId) {
            wakaPAC.postMessage(parentPacId, MSG_DESTROYED, 0, 0, { childPacId: destroyedPacId });
        }
    }

    // =============================================================================
    // TIMERS
    // =============================================================================

    /**
     * Sets a timer for this component, similar to Win32 SetTimer.
     * Sends MSG_TIMER messages to the component's msgProc at the specified interval.
     * Uses a shared requestAnimationFrame loop instead of setInterval to avoid
     * Firefox timer throttling causing irregular MSG_TIMER delivery.
     * Timer IDs are globally unique across all components.
     * @param {number} elapse - Timer interval in milliseconds
     * @returns {number} The globally unique timer ID (use this to kill the timer later)
     */
    Context.prototype.setTimer = function(elapse) {
        // Delegate ID generation and registration to the engine
        return RafTimerEngine.add(this, elapse);
    };

    /**
     * Kills a specific timer for this component, similar to Win32 KillTimer.
     * Stops the timer from sending further MSG_TIMER messages.
     * @param {number} timerId - The timer ID returned from setTimer()
     * @returns {void}
     */
    Context.prototype.killTimer = function(timerId) {
        // Delegate directly to the engine — timer IDs are globally unique
        return RafTimerEngine.remove(timerId);
    };

    /**
     * Kills all timers for this component.
     * Called automatically on component destruction to prevent MSG_TIMER delivery
     * to a context that no longer exists.
     * @returns {void}
     */
    Context.prototype.killAllTimers = function() {
        // Delegate bulk removal to the engine, which matches by context reference
        return RafTimerEngine.removeAllForContext(this);
    };

    // =============================================================================
    // CONTAINER STATE TRACKING (Scroll & Visibility)
    // =============================================================================

    /**
     * Sets up scroll event tracking for the container element with debounced handling.
     * Creates an optimized scroll listener that updates container scroll state at ~60fps
     * to prevent performance issues during rapid scroll events.
     * @memberof {Object} - The parent class/object containing this method
     * @method setupContainerScrollTracking
     * @returns {void}
     */
    Context.prototype.setupContainerScrollTracking = function() {
        // First time setup
        requestAnimationFrame(() => this.updateContainerScrollState());

        // Debounce scroll updates to ~1 frame (16 ms) so rapid scroll events
        // are coalesced rather than triggering a state update on every pixel.
        const scrollHandler = Utils.debounce(() => {
            this.updateContainerScrollState();
        }, 16);

        // Add scroll listener to this container
        this.container.addEventListener('scroll', scrollHandler, { passive: true });

        // Store reference for cleanup (scrollHandler.cancel() is called on teardown)
        this.containerScrollHandler = scrollHandler;
    }

    // Add new method to update container scroll state
    Context.prototype.updateContainerScrollState = function() {
        // Get scroll measurements
        const scrollX = this.container.scrollLeft;
        const scrollY = this.container.scrollTop;
        const clientWidth = this.container.clientWidth;
        const clientHeight = this.container.clientHeight;
        const scrollContentWidth = this.container.scrollWidth;
        const scrollContentHeight = this.container.scrollHeight;

        // Calculate scrollable state (use existing containerWidth/Height for visible dimensions)
        const isScrollable =
            scrollContentWidth > this.abstraction.containerWidth ||
            scrollContentHeight > this.abstraction.containerHeight;

        // Update individual properties
        this.abstraction.containerScrollX = scrollX;
        this.abstraction.containerScrollY = scrollY;
        this.abstraction.containerContentWidth = scrollContentWidth;
        this.abstraction.containerContentHeight = scrollContentHeight;
        this.abstraction.containerIsScrollable = isScrollable;

        // Update scroll window object
        Object.assign(this.abstraction.containerScrollWindow, {
            top: scrollY,
            left: scrollX,
            right: scrollX + clientWidth,
            bottom: scrollY + clientHeight,
            x: scrollX,
            y: scrollY
        });
    }

    // =============================================================================
    // DOM SCANNING AND BINDING REGISTRATION
    // =============================================================================

    /**
     * Scans and registers newly created content within a foreach container
     * @param {Element} parentElement - The foreach container element
     */
    Context.prototype.scanAndRegisterNewElements = function(parentElement) {
        const self = this;

        // Expand partial templates before scanning so injected markup
        // is visible to scanBindings and scanTextBindings
        expandPartials(parentElement);

        // Scan for new bound elements within this container
        const newBindings = this.scanBindings(parentElement);
        const newTextBindings = this.scanTextBindings(parentElement);
        const newCommentBindings = this.scanCommentBindings(parentElement);

        // Add new bindings to main maps
        newBindings.forEach((mappingData, element) => {
            if (element !== parentElement) {
                this.interpolationMap.set(element, mappingData);
            }
        });

        newTextBindings.forEach((mappingData, textNode) => {
            this.textInterpolationMap.set(textNode, mappingData);
        });

        // Store comment bindings
        newCommentBindings.forEach((mappingData, commentNode) => {
            this.commentBindingMap.set(commentNode, mappingData);
            self.updateCommentConditional(commentNode, mappingData);
        });

        // Apply initial bindings to new elements
        newBindings.forEach((mappingData, element) => {
            Object.keys(mappingData.bindings).forEach(bindingType => {
                // Skip event bindings — they are never evaluated eagerly, only on user interaction.
                if (bindingType === 'click' || bindingType === 'submit') {
                    return;
                }

                // Evaluate the expression
                const bindingData = mappingData.bindings[bindingType];

                const value = ExpressionParser.evaluate(
                    ExpressionCache.parseExpression(bindingData.target),
                    self.abstraction,
                    makeScopeResolver(
                        self.normalizePath.bind(self),
                        element,
                        self.importedUnits
                    )
                );

                self.domUpdater.updateAttributeBinding(element, bindingType, bindingData, value);
            });
        });

        // Apply text interpolations
        newTextBindings.forEach((mappingData, textNode) => {
            self.domUpdater.updateTextNode(textNode, mappingData.template);
        });

        // Handle nested foreach rendering (sort by depth, deepest first)
        Array.from(newBindings.entries())
            .filter(([element, mappingData]) =>
                mappingData.bindings.foreach && element !== parentElement
            )
            .sort(([, mappingDataA], [, mappingDataB]) => {
                const depthA = mappingDataA.depth;
                const depthB = mappingDataB.depth;
                return depthB - depthA; // deepest first
            })
            .forEach(([element]) => {
                this.renderForeach(element);
            });
    };

    /**
     * Calculates how deeply an element is nested inside this context's container.
     * Used to ensure inner foreach blocks render before outer ones.
     * @param element
     * @returns {number}
     */
    Context.prototype.getElementDepth = function(element) {
        // Depth counter relative to the container root
        let depth = 0;

        // Walk up the DOM tree starting from the element
        let current = element;

        // Stop when we reach the container or run out of parents
        while (current && current !== this.container) {
            depth++;
            current = current.parentElement;
        }

        // Return computed nesting depth
        return depth;
    };

    /**
     * Builds a dependency graph by executing each computed property through a tracking
     * proxy, then transitively expanding chains so that upstream data changes propagate
     * through all computed layers.
     * @returns {Map<string, Set<string>>} Keys are accessed property names; values are
     *   the set of computed properties that ultimately depend on them.
     */
    Context.prototype.getDependencies = function () {
        const computed = this.originalAbstraction.computed ?? {};
        const computedNames = new Set(Object.keys(computed));

        // Build the direct dependency map by executing each computed property
        // through a proxy that records every property access.
        const accessed = new Set();
        const proxy = new Proxy(this.originalAbstraction, {
            get(target, prop) {
                if (typeof prop === 'string') {
                    accessed.add(prop);
                }

                // Transparently invoke computed properties so that computed-on-computed
                // access resolves to a value rather than recording a function reference.
                const value = target[prop];
                return (typeof value === 'function' && computedNames.has(prop))
                    ? value.call(proxy)
                    : value;
            }
        });

        /** @type {Map<string, Set<string>>} */
        const dependencies = new Map();

        for (const name of computedNames) {
            accessed.clear();
            computed[name].call(proxy);

            for (const prop of accessed) {
                if (!dependencies.has(prop)) {
                    dependencies.set(prop, new Set());
                }

                dependencies.get(prop).add(name);
            }
        }

        // Transitively expand the graph so that data → computed → computed chains
        // are flattened. A change to `rawData` must list every downstream computed
        // property as a dependent, not only the first one in the chain.
        // The loop converges because duplicates are never added to a Set.
        let changed = true;

        while (changed) {
            changed = false;

            for (const [, dependents] of dependencies) {
                for (const dep of [...dependents]) {
                    if (!computedNames.has(dep)) {
                        continue;
                    }

                    for (const transitive of (dependencies.get(dep) ?? [])) {
                        if (!dependents.has(transitive)) {
                            dependents.add(transitive);
                            changed = true;
                        }
                    }
                }
            }
        }

        return dependencies;
    };

    /**
     * Try to infer which array property in the abstraction is the "source" array
     * behind a given computed property (for example, linking `filteredTodos` back to `todos`).
     * @param {string} computedName - Name of the computed getter (e.g. `"filteredTodos"`).
     * @returns {string|null} The source array property name (e.g. `"todos"`) or null if not found.
     */
    Context.prototype.inferArrayRoot = function inferArrayRoot(computedName) {
        // Step 1: Try dependency map (cheap and reliable if set up correctly).
        for (const [rootProperty, dependentList] of this.dependencies) {
            const rootValue = this.abstraction[rootProperty];
            const isArrayRoot = Array.isArray(rootValue);

            if (dependentList.has(computedName) && isArrayRoot) {
                return rootProperty; // e.g. "todos"
            }
        }

        // Nothing matched
        return computedName;
    };

    /**
     * Processes pending delayed updates from the update queue.
     *
     * Iterates through queued entries in a single pass, immediately applying any
     * whose scheduled time has elapsed and tracking the earliest future entry
     * for rescheduling. Blur-triggered entries are skipped here since they are
     * handled synchronously by {@link Context#handleDomBlur}.
     *
     * Deletion of processed entries is deferred to a separate pass to avoid
     * mutating the Map during iteration.
     *
     * @returns {void}
     */
    Context.prototype.updateQueueHandler = function() {
        // Clear timer reference — this callback is now executing
        this.updateQueueTimer = null;
        this.updateQueueFireAt = 0;

        // Fast exit when nothing is queued
        if (this.updateQueue.size === 0) {
            return;
        }

        const now = Date.now();
        let nextExecuteAt = Infinity;

        // Paths whose entries have been applied and should be removed.
        // Collected separately because deleting Map keys during forEach
        // can cause unpredictable visitation order.
        const pathsToDelete = [];

        // Single-pass scan: apply expired delay entries, find nearest future one
        this.updateQueue.forEach((queueEntry, resolvedPath) => {
            // Skip non-delay entries (e.g. blur-triggered); those are
            // processed event-driven in handleDomBlur
            if (queueEntry.trigger !== 'delay') {
                return;
            }

            if (now >= queueEntry.executeAt) {
                // Entry has matured — apply the value directly to the
                // reactive abstraction and mark the path for cleanup
                pathsToDelete.push(resolvedPath);

                try {
                    Utils.setNestedProperty(resolvedPath, queueEntry.value, this.abstraction);
                } catch (error) {
                    console.warn(`Error applying queued update for path "${resolvedPath}":`, error);
                }
            } else if (queueEntry.executeAt < nextExecuteAt) {
                // Track the earliest future entry so we can schedule
                // the next processing pass at exactly the right time
                nextExecuteAt = queueEntry.executeAt;
            }
        });

        // Remove processed entries after iteration is complete
        for (let i = 0; i < pathsToDelete.length; i++) {
            this.updateQueue.delete(pathsToDelete[i]);
        }

        // If any delay entries remain, schedule the next run to fire
        // when the earliest one matures (avoids perpetual polling)
        if (nextExecuteAt < Infinity) {
            this.scheduleQueueProcessing(nextExecuteAt - now);
        }
    };

    /**
     * Schedules a future run of the update queue processor.
     *
     * Sets a single timeout to fire {@link Context#updateQueueHandler} after
     * the given delay. If a timer is already pending, it is replaced only when
     * the new delay would fire sooner — ensuring the earliest queued entry is
     * always processed on time without creating redundant timers.
     *
     * @param {number} delay - Milliseconds until the queue should be processed.
     *                         Clamped to a minimum of 1ms to guarantee asynchronous execution.
     * @returns {void}
     */
    Context.prototype.scheduleQueueProcessing = function(delay) {
        const self = this;
        const clampedDelay = Math.max(delay, 1);
        const fireAt = Date.now() + clampedDelay;

        // If an existing timer already covers this deadline, keep it
        if (this.updateQueueTimer !== null && this.updateQueueFireAt <= fireAt) {
            return;
        }

        // Cancel the existing timer — the new one fires sooner
        if (this.updateQueueTimer !== null) {
            clearTimeout(this.updateQueueTimer);
        }

        // Run timeout
        this.updateQueueFireAt = fireAt;
        this.updateQueueTimer = setTimeout(function() {
            self.updateQueueHandler();
        }, clampedDelay);
    };

    /**
     * Retrieves the update configuration for a specific element, combining element-specific
     * attributes with context-wide configuration defaults.
     * @param {HTMLElement} element - The DOM element to get update configuration for
     * @returns {{updateMode: (string|string|*), delay: number}} The update configuration object
     * @returns {string} returns.updateMode - The update mode ('immediate' or other configured modes)
     * @returns {number} returns.delay - The delay in milliseconds, capped at maximum 3000ms
     */
    Context.prototype.getUpdateConfiguration = function(element) {
        // Check element attributes first
        const updateMode = element.getAttribute('data-pac-update-mode') || this.config.updateMode || 'immediate';
        const delay = parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay || 300;

        // Cap maximum delay at 3000ms for safety
        const cappedDelay = Math.min(delay, 3000);

        // Return the delay information
        return { updateMode, delay: cappedDelay };
    };

    // =============================================================================
    // EVENT HANDLING (User Interactions & System Events)
    // =============================================================================

    /**
     * Handles incoming events by dispatching them to appropriate handler methods based on event type.
     * This is the central event routing mechanism for the Context system.
     * @param {Object} event - The event object to be processed
     * @param {string} event.type - The type of event, determines which handler is called
     * @param {...*} event - Additional event properties vary by event type
     */
    Context.prototype.handleEvent = function(event) {
        // Route events to specialized handlers based on type
        // Each event type corresponds to a different aspect of the PAC (Presentation-Abstraction-Control) architecture
        switch(event.type) {
            // Handle general PAC events (likely business logic or component interactions)
            case 'pac:event':
                this.handlePacEvent(event);
                break;

            // Handle reactive data binding changes (property updates, computed value changes)
            case 'pac:change':
                if (Array.isArray(event.detail.newValue)) {
                    this.handleArrayChange(event);
                }

                this.handleReactiveChange(event);
                break;

            // Handle browser state changes (navigation, history, URL changes)
            case 'pac:browser-state':
                this.handleBrowserStateEvent(event);
                break;

            default:
                console.warn(`Unhandled event type ${event.type}`);
                break;
        }
    };

    /**
     * Handles PAC events based on message type
     * @param {CustomEvent} event - The PAC event with Win32-style message properties
     * @param {Number} event.message - Message type from wakaPAC message constants (wakaPAC.MSG_*)
     * @param {Number} event.wParam - Windows-style wParam (modifier keys, button states)
     * @param {Number} event.lParam - Windows-style lParam (coordinates, key codes)
     * @param {Event} event.originalEvent - Reference to the original DOM event
     * @returns {void}
     */
    Context.prototype.handlePacEvent = function(event) {
        // Call user's message handler (msgProc) before framework processes the event
        // This allows user code to intercept and handle messages first, Win32-style
        let preventDefault = false;

        if (this.originalAbstraction.msgProc && typeof this.originalAbstraction.msgProc === 'function') {
            const msgProcResult = this.originalAbstraction.msgProc.call(this.abstraction, event);

            // Certain message types can prevent framework's default behavior by returning false
            // Similar to Win32: returning 0 from WndProc means "I handled this, skip default processing"
            const cancellableEvents = [
                MSG_LBUTTONUP, MSG_MBUTTONUP, MSG_RBUTTONUP,
                MSG_LCLICK, MSG_MCLICK, MSG_RCLICK, MSG_CONTEXTMENU,
                MSG_SUBMIT, MSG_CHANGE, MSG_GESTURE, MSG_CHAR,
                MSG_COPY, MSG_PASTE, MSG_KEYDOWN, MSG_KEYUP
            ];

            if (cancellableEvents.includes(event.message) && msgProcResult === false) {
                preventDefault = true;
            }
        }

        // Stop processing if msgProc handled the event
        if (preventDefault) {
            event.preventDefault();
            return;
        }

        // Call built in event handlers
        switch(event.message) {
            case MSG_SETFOCUS:
                this.updateFocusProperties();
                break;

            case MSG_KILLFOCUS:
                this.updateFocusProperties();
                this.handleDomBlur(event);
                break;

            case MSG_LCLICK:
                // Mouse button up events - handle DOM clicks
                this.handleDomClicks(event);
                break;

            case MSG_SUBMIT:
                // Form submission events
                this.handleDomSubmit(event);
                break;

            case MSG_CHANGE:
                // DOM change event
                this.handleDomChange(event);
                break;

            case MSG_INPUT_COMPLETE:
                // Post-mutation input (input event - value is updated)
                this.handleDomInputComplete(event);
                break;
        }
    }

    /**
     * Updates container focus reactive properties
     * Called automatically after MSG_SETFOCUS/MSG_KILLFOCUS events
     */
    Context.prototype.updateFocusProperties = function() {
        this.abstraction.containerFocus = Utils.isElementDirectlyFocused(this.container);
        this.abstraction.containerFocusWithin = Utils.isElementFocusWithin(this.container);
    }

    /**
     * Handles DOM click events by executing bound abstraction methods.
     * Supports both regular click handlers and foreach context-aware handlers.
     * @param {CustomEvent} event - Custom event containing click details
     * @param {Element} event.target - The DOM element that was clicked
     * @throws {Error} Logs errors if method execution fails
     */
    Context.prototype.handleDomClicks = function (event) {
        // Get interpolation data for the clicked element
        const mappingData = this.interpolationMap.get(event.target);
        if (!mappingData?.bindings?.click) {
            return;
        }

        const bindingTarget = mappingData.bindings.click.target;

        try {
            // Check if click occurred within a foreach loop context
            const contextInfo = this.extractClosestForeachContext(event.target);

            // Build scope resolver once, shared across all evaluations below
            const scopeResolver = makeScopeResolver(
                this.normalizePath.bind(this),
                event.target,
                this.importedUnits
            );

            if (contextInfo) {
                // Find the foreach element that contains this click target
                const foreachElement = Array.from(this.interpolationMap.entries())
                    .find(([, data]) => data.foreachId === contextInfo.foreachId)?.[0];

                if (foreachElement) {
                    // Evaluate the foreach expression to get the source array
                    const foreachData = this.interpolationMap.get(foreachElement);
                    const array = ExpressionParser.evaluate(
                        ExpressionCache.parseExpression(foreachData.foreachExpr),
                        this.abstraction,
                        scopeResolver
                    );

                    // Inject foreach context into scope so expressions can reference $item, $index, $event
                    const scopedAbstraction = Object.assign(Object.create(this.abstraction), {
                        $item: array[contextInfo.index],
                        $index: contextInfo.index,
                        $event: event
                    });

                    const foreachResult = ExpressionParser.evaluate(
                        ExpressionCache.parseExpression(bindingTarget),
                        scopedAbstraction,
                        scopeResolver
                    );

                    // Fallback: bare method name — call with (item, index, event)
                    if (typeof foreachResult === 'function') {
                        foreachResult.call(this.abstraction, array[contextInfo.index], contextInfo.index, event);
                    }

                    return;
                }
            }

            // Simple case: evaluate expression with $event in scope
            const scopedAbstraction = Object.assign(Object.create(this.abstraction), {
                $event: event
            });

            const result = ExpressionParser.evaluate(
                ExpressionCache.parseExpression(bindingTarget),
                scopedAbstraction,
                scopeResolver
            );

            // Fallback: bare method name — call with (event)
            if (typeof result === 'function') {
                result.call(this.abstraction, event);
            }
        } catch (error) {
            console.warn(`Error executing click binding '${bindingTarget}':`, error);
        }
    }

    /**
     * Handles DOM submit events by executing bound abstraction methods.
     * @param {CustomEvent} event - The PAC submit event
     * @param {HTMLElement} event.target - The DOM element that triggered the submit
     * @returns {void}
     */
    Context.prototype.handleDomSubmit = function(event) {
        // Retrieve mapping data for the target element from the interpolation map
        const mappingData = this.interpolationMap.get(event.target);

        // Early return if no mapping exists or no submit binding is configured
        if (!mappingData?.bindings?.submit) {
            return;
        }

        // Get the method reference from the abstraction object using the binding target
        const method = this.abstraction[mappingData.bindings.submit.target];

        // Verify the target is actually a callable function
        if (typeof method !== 'function') {
            return;
        }

        try {
            // Execute the bound method with the abstraction as context and pass the event
            method.call(this.abstraction, event);
        } catch (error) {
            // Log execution errors with context for debugging
            console.warn(`Error executing submit binding '${mappingData.bindings.submit.target}':`, error);
        }
    };

    /**
     * Handles DOM change events for data-bound elements, updating the underlying data model
     * when form controls change their values. This enables two-way data binding by listening
     * for custom DOM change events and propagating changes back to the data context.
     * @param {CustomEvent} event - The DOM change event containing target element and new value
     * @param {Element} event.target - The DOM element that changed
     * @param {*} event.value - The new value from the changed element
     */
    Context.prototype.handleDomChange = function(event) {
        const self = this;
        const targetElement = event.target;

        // Get the mapping data for this specific element from the interpolation map
        // This contains all the binding information (value, checked, etc.) for the element
        const mappingData = this.interpolationMap.get(targetElement);

        // If no mapping data found, this element isn't data-bound so nothing to do
        if (!mappingData) {
            return;
        }

        // Handle value binding (for inputs, selects, textareas)
        // This covers most form controls that have a "value" property
        if (mappingData.bindings.value) {
            // Fetch value binding
            const valueBinding = mappingData.bindings.value;

            // Resolve the target path considering any scoped context (e.g., loops, nested objects)
            const resolvedPath = self.normalizePath(valueBinding.target, targetElement);

            // Update the options
            let selectOption;

            if (targetElement.tagName === 'SELECT' && targetElement.multiple) {
                selectOption = Array.from(targetElement.selectedOptions).map(opt => opt.value);
            } else {
                selectOption = targetElement.value;
            }

            // Set new option(s)
            Utils.setNestedProperty(resolvedPath, selectOption, this.abstraction);
        }

        // Handle checked binding (for checkboxes and radio buttons)
        // These controls have special behavior different from regular value binding
        if (mappingData.bindings.checked) {
            // Fetch checked binding
            const checkedBinding = mappingData.bindings.checked;

            // Resolve the target path for the checked property binding
            const resolvedPath = self.normalizePath(checkedBinding.target, targetElement);

            // Checkbox: set boolean value based on checked state
            // Radio button: only update when this radio is selected, use its value
            if (targetElement.type === 'checkbox') {
                Utils.setNestedProperty(resolvedPath, targetElement.checked, this.abstraction);
            } else if (targetElement.type === 'radio' && targetElement.checked) {
                Utils.setNestedProperty(resolvedPath, targetElement.value, this.abstraction);
            }
        }

        // Handle change binding (method execution)
        if (mappingData.bindings.change) {
            // Resolve the target method from the abstraction object
            const method = this.abstraction[mappingData.bindings.change.target];

            if (typeof method === 'function') {
                try {
                    // Execute the bound method with the abstraction as context
                    method.call(this.abstraction, event);
                } catch (error) {
                    console.warn(`Error executing change binding '${mappingData.bindings.change.target}':`, error);
                }
            }
        }
    };

    /**
     * Handles post-mutation input events for data-bound elements, updating the underlying
     * data model with the correct (post-mutation) value from targetElement.value.
     * Fires on the 'input' DOM event via MSG_INPUT_COMPLETE.
     * @param {CustomEvent} event - The post-mutation input event
     * @param {Element} event.target - The DOM element whose value changed
     */
    Context.prototype.handleDomInputComplete = function(event) {
        const self = this;
        const targetElement = event.target;

        // Get the mapping data for this specific element from the interpolation map
        // This contains all the binding information (value, checked, etc.) for the element
        const mappingData = this.interpolationMap.get(targetElement);

        // If no mapping data found, this element isn't data-bound so nothing to do
        if (!mappingData) {
            return;
        }

        // Handle value binding (for inputs, selects, textareas)
        // This covers most form controls that have a "value" property
        if (mappingData.bindings.value) {
            // Fetch value binding
            const valueBinding = mappingData.bindings.value;

            // Resolve the target path considering any scoped context (e.g., loops, nested objects)
            const resolvedPath = self.normalizePath(valueBinding.target, targetElement);

            // Get update configuration for this element
            const config = this.getUpdateConfiguration(targetElement);

            // Update the data model using nested property setter to handle complex object paths
            // e.g., "user.profile.name" gets properly set in the nested object structure
            switch (config.updateMode) {
                case 'immediate':
                    // Immediate update - bypass queue entirely
                    Utils.setNestedProperty(resolvedPath, targetElement.value, this.abstraction);
                    break;

                case 'delayed':
                    // Delayed update - add to queue with time trigger
                    this.updateQueue.set(resolvedPath, {
                        trigger: 'delay',
                        value: targetElement.value,
                        executeAt: Date.now() + config.delay
                    });

                    this.scheduleQueueProcessing(config.delay);
                    break;

                case 'change':
                    // Change mode - add to queue with blur trigger
                    this.updateQueue.set(resolvedPath, {
                        trigger: 'blur',
                        value: targetElement.value,
                        elementId: Utils.getElementIdentifier(targetElement)
                    });

                    break;
            }
        }
    };

    /**
     * Handles DOM blur events for data-bound elements
     * Processes any pending "change" mode updates that should trigger on blur
     * @param {CustomEvent} event - The blur event containing target element details
     * @param {Object} event.detail - Event detail object
     * @param {HTMLElement} event.target - The DOM element that lost focus
     * @returns {void}
     */
    Context.prototype.handleDomBlur = function (event) {
        const targetElement = event.target;

        // Get the mapping data for this element
        const mappingData = this.interpolationMap.get(targetElement);

        // If no mapping data, this element isn't data-bound
        if (!mappingData) {
            return;
        }

        // Find all queued updates for this element that should trigger on blur
        const elementId = Utils.getElementIdentifier(targetElement);
        const updatesToProcess = [];

        this.updateQueue.forEach((queueEntry, resolvedPath) => {
            if (queueEntry.trigger === 'blur' && queueEntry.elementId === elementId) {
                updatesToProcess.push({
                    path: resolvedPath,
                    value: queueEntry.value
                });
            }
        });

        // Apply all blur-triggered updates for this element
        updatesToProcess.forEach(update => {
            try {
                Utils.setNestedProperty(update.path, update.value, this.abstraction);
                this.updateQueue.delete(update.path);
            } catch (error) {
                console.warn('Error applying blur-triggered update for path:', update.path, error);
                // Remove failed update to prevent infinite retries
                this.updateQueue.delete(update.path);
            }
        });
    };

    /**
     * Handles reactive data binding changes triggered by property updates
     * Orchestrates updates to all binding types: element attributes, text interpolations,
     * comment conditionals, watchers, and foreach loops
     * @param {CustomEvent} event - The pac:change event containing change details
     * @param {Object} event.detail - Event payload
     * @param {string[]} event.detail.path - Array representing the property path that changed (e.g., ['todos', '0', 'completed'])
     * @param {*} event.detail.oldValue - The previous value before the change
     * @param {*} event.detail.newValue - The new value after the change
     */
    Context.prototype.handleReactiveChange = function (event) {
        this.updateElementBindings();
        this.updateTextInterpolations();
        this.updateCommentConditionals();
        this.handleWatchersForChange(event);
        this.handleForeachRebuildForChange(event);

        //wakaPAC.sendMessage(this.abstraction.pacId, MSG_VALUE_CHANGE, 0, 0, event.detail);
    };

    // =============================================================================
    // DOM UPDATE METHODS (Reactive Data → DOM Sync)
    // =============================================================================

    /**
     * Updates all element attribute bindings (value, checked, visible, if, class, style, etc.).
     * Evaluates each binding expression and updates the DOM if the value has changed.
     */
    Context.prototype.updateElementBindings = function() {
        // Cache frequently accessed properties to avoid repeated lookups
        // through `this` in the inner loops
        const abstraction = this.abstraction;
        const domUpdater = this.domUpdater;
        const self = this;

        this.interpolationMap.forEach(function(mappingData, element) {
            const bindings = mappingData.bindings;
            const keys = Object.keys(bindings);

            // Nothing to process if there are no bindings
            if (keys.length === 0) {
                return;
            }

            // Initialize the previous values store on first encounter.
            // Cache the reference to avoid repeated DOM element property access
            // inside the binding loop.
            if (!element._pacPreviousValues) {
                element._pacPreviousValues = {};
            }

            // Fetch the previousValues list
            const previousValues = element._pacPreviousValues;

            // Iterate bindings using a for loop to avoid closure creation per key
            for (let i = 0, len = keys.length; i < len; i++) {
                // Fetch the binding type
                const bindingType = keys[i];

                // Skip foreach and click binds — they are handled elsewhere.
                // Uses direct equality checks instead of Array.includes() to
                // avoid array allocation and linear scan on every iteration.
                if (bindingType === 'foreach' || bindingType === 'click') {
                    continue;
                }

                try {
                    // Parse and evaluate the binding expression
                    const bindingData = bindings[bindingType];

                    const currentValue = ExpressionParser.evaluate(
                        ExpressionCache.parseExpression(bindingData.target),
                        abstraction,
                        makeScopeResolver(
                            self.normalizePath.bind(self),
                            element,
                            self.importedUnits
                        )
                    );

                    // Only touch the DOM if the value actually changed.
                    // DOM writes are expensive, so we diff against the cached
                    // previous value first.
                    if (!Utils.isEqual(previousValues[bindingType], currentValue)) {
                        // Update value
                        previousValues[bindingType] = currentValue;

                        // Update DOM — pass pre-computed value to avoid re-evaluating
                        // the same expression through a second normalizePath chain
                        domUpdater.updateAttributeBinding(element, bindingType, bindingData, currentValue);
                    }
                } catch (error) {
                    console.warn('Error evaluating binding:', bindingType, error);
                }
            }
        });
    };

    /**
     * Updates all text interpolations ({{expression}} in text nodes).
     * Re-evaluates template expressions and updates text content if changed.
     */
    Context.prototype.updateTextInterpolations = function() {
        const abstraction = this.abstraction;
        const self = this;

        this.textInterpolationMap.forEach((mappingData, textNode) => {
            try {
                // Store previous text content to detect changes
                if (!textNode._pacPreviousText) {
                    textNode._pacPreviousText = textNode.textContent;
                }

                // Build the scope resolver once per text node, not once per expression.
                // The resolver only depends on the text node for path normalization.
                const newText = mappingData.template.replace(INTERPOLATION_REGEX, function(match, expression) {
                    try {
                        const result = ExpressionParser.evaluate(
                            ExpressionCache.parseExpression(expression),
                            abstraction,
                            makeScopeResolver(
                                self.normalizePath.bind(self),
                                textNode,
                                self.importedUnits
                            )
                        );

                        return result != null ? String(result) : '';
                    } catch (error) {
                        console.warn('Error evaluating text interpolation:', expression, error);
                        return match;
                    }
                });

                // Only update DOM if text actually changed
                if (textNode._pacPreviousText !== newText) {
                    textNode.textContent = newText;
                    textNode._pacPreviousText = newText;
                }
            } catch (error) {
                console.warn('Error updating text node:', error);
            }
        });
    };

    /**
     * Updates all comment-based wp-if conditionals
     * Re-evaluates conditions and shows/hides content as needed
     */
    Context.prototype.updateCommentConditionals = function() {
        this.commentBindingMap.forEach((mappingData, commentNode) => {
            this.updateCommentConditional(commentNode, mappingData);
        });
    };

    /**
     * Triggers watchers for property changes
     * Handles both root-level and nested property changes, passing appropriate before/after values
     * Note: Does not trigger for array element changes - arrays are handled by foreach rebuilds
     * @param {CustomEvent} event - The pac:change event with change details
     */
    Context.prototype.handleWatchersForChange = function(event) {
        // Root-level change (e.g., this.count = 5)
        // Pass the actual primitive or object values directly
        const path = event.detail.path;
        const rootProperty = path[0];

        if (path.length === 1) {
            this.triggerWatcher(rootProperty, event.detail.newValue, event.detail.oldValue);
            return;
        }

        // Nested property change (e.g., this.settings.theme = 'dark')
        // Reconstruct the parent object in both before/after states
        // Get the current parent object (contains the new value)
        const newParentObject = this.abstraction[rootProperty];

        // Don't trigger watchers for array element changes
        // Arrays are handled by foreach rebuilds, not watchers
        if (Array.isArray(newParentObject)) {
            return;
        }

        // Cannot reconstruct old state for externally managed proxies
        if (newParentObject && newParentObject._externalProxy) {
            this.triggerWatcher(rootProperty, newParentObject, null);
            return;
        }

        // Clone the parent object to reconstruct the old state
        const oldParentObject = { ...newParentObject };

        // Navigate through the path to find the changed property
        // For path ['settings', 'theme'], navigate to oldParentObject.theme
        let target = oldParentObject;

        for (let i = 1; i < path.length - 1; i++) {
            target = target[path[i]];
        }

        // Set the old value at the final property
        // This reconstructs the object as it was before the change
        const lastProperty = path[path.length - 1];
        target[lastProperty] = event.detail.oldValue;

        // Trigger watcher with complete before/after objects
        // newParentObject has the changed value, oldParentObject has the old value
        this.triggerWatcher(rootProperty, newParentObject, oldParentObject);
    };

    /**
     * Handles foreach rebuilds triggered by reactive property changes.
     * When a property changes, checks if any foreach elements need re-rendering,
     * either because they're bound directly to the changed array, or because
     * they're bound to a computed property that depends on the changed property
     * (e.g., changing 'filter' triggers rebuild of foreach bound to 'filteredTodos').
     * @param {CustomEvent} event - The pac:change event containing change details
     * @param {string[]} event.detail.path - Property path that changed
     */
    Context.prototype.handleForeachRebuildForChange = function(event) {
        // Only handle top-level property changes (e.g., ['filter'], not ['todos', '0', 'text'])
        const path = event.detail.path;

        if (path.length !== 1) {
            return;
        }

        const changedProp = path[0];
        const dependents = this.dependencies.get(changedProp);

        // Build a pattern that matches the changed property used as a dynamic bracket
        // key inside a foreach expression, e.g. cities[country][region] contains [region].
        // This covers dependent dropdowns where options depend on a parent scalar value.
        const bracketPattern = new RegExp('\\[' + changedProp + '\\]');

        // Single-pass scan of interpolationMap instead of calling
        // findForeachElementsByArrayPath once per candidate property
        for (const [element, mappingData] of this.interpolationMap) {
            // Skip non-foreach elements
            if (!mappingData.bindings || !mappingData.bindings.foreach) {
                continue;
            }

            const expr = mappingData.foreachExpr;
            const source = mappingData.sourceArray;

            // Match 1: computed property dependency (e.g., filter → filteredTodos)
            const computedMatch = dependents && (dependents.has(expr) || dependents.has(source));

            // Match 2: expression uses changedProp as a dynamic bracket key
            // e.g. changing 'region' should rebuild foreach: cities[country][region]
            const bracketMatch = bracketPattern.test(expr);

            if (computedMatch || bracketMatch) {
                if (this.shouldRebuildForeach(element)) {
                    this.renderForeach(element);
                }
            }
        }
    };

    /**
     * Triggers watchers for property changes - simple property name matching only
     * @param {string} property - The property that changed
     * @param {*} newValue - The new value
     * @param {*} oldValue - The old value
     */
    Context.prototype.triggerWatcher = function(property, newValue, oldValue) {
        // Guard missing watch object
        if (!this.originalAbstraction.watch) {
            return;
        }

        // Only handle direct property watchers - no pattern matching
        if (
            this.originalAbstraction.watch[property] &&
            typeof this.originalAbstraction.watch[property] === 'function'
        ) {
            try {
                this.originalAbstraction.watch[property].call(this.abstraction, newValue, oldValue);
            } catch (error) {
                console.warn('Error in watcher for \'' + property + '\':', error);
            }
        }
    };

    /**
     * Handles browser state change events and updates the context abstraction accordingly.
     * This method processes various types of browser state changes including visibility,
     * network connectivity, scroll position, and viewport dimensions.
     * @param {CustomEvent} event - Browser state change event
     * @param {Object} event.detail - Event payload containing state information
     * @param {string} event.detail.stateType - Type of state change ('visibility'|'online'|'scroll'|'resize')
     * @param {Object} event.detail.stateData - State-specific data object
     */
    Context.prototype.handleBrowserStateEvent = function(event) {
        const { stateType, stateData } = event.detail;

        switch(stateType) {
            case 'visibility':
                // Update browser visibility state
                this.abstraction.browserVisible = stateData.visible;
                break;

            case 'online':
                // Update network connectivity and connection type
                this.abstraction.browserOnline = stateData.online;
                this.abstraction.browserNetworkEffectiveType = stateData.networkType;
                this.abstraction.browserNetworkQuality = stateData.networkQuality;
                break;

            case 'scroll':
                // Update scroll position coordinates
                this.abstraction.browserScrollX = stateData.scrollX;
                this.abstraction.browserScrollY = stateData.scrollY;
                break;

            case 'resize': {
                // Update viewport dimensions and document size
                this.abstraction.browserViewportWidth = stateData.viewportWidth;
                this.abstraction.browserViewportHeight = stateData.viewportHeight;
                this.abstraction.browserContentWidth = stateData.documentWidth;
                this.abstraction.browserContentHeight = stateData.documentHeight;

                // Update scroll position (resize can change scroll)
                this.abstraction.browserScrollX = stateData.scrollX;
                this.abstraction.browserScrollY = stateData.scrollY;

                // Get bounding rect
                const rect = this.container.getBoundingClientRect();

                // Set dimensions
                this.abstraction.containerClientRect = Utils.domRectToSimpleObject(rect);
                this.abstraction.containerWidth = rect.width;
                this.abstraction.containerHeight = rect.height;

                // Use Utils for consistent visibility calculation
                this.abstraction.containerVisible = Utils.isElementVisible(this.container);
                this.abstraction.containerFullyVisible = Utils.isElementFullyVisible(this.container);
                break;
            }

            case 'orientation':
                // Screen orientation angle in degrees (0, 90, 180, 270)
                // and type string e.g. 'portrait-primary', 'landscape-secondary'
                this.abstraction.browserOrientationAngle = stateData.angle;
                this.abstraction.browserOrientationType = stateData.type;
                break;

            case 'dpr':
                this.abstraction.browserDevicePixelRatio = stateData.ratio;
                wakaPAC.sendMessage(this.abstraction.pacId, MSG_DPR_CHANGE, Math.round(stateData.ratio * 100), 0);
                break;

            default:
                console.warn('Unknown browser state message ' + stateType);
                break;
        }
    };

    /**
     * Handles array change events by re-rendering associated foreach elements.
     * @param {CustomEvent} event - The array change event containing details about the modification
     * @param {Object} event.detail - The event detail object
     * @param {Array<string|number>} event.detail.path - Array representing the path to the changed array
     */
    Context.prototype.handleArrayChange = function(event) {
        const detail = event.detail;
        const pathString = Utils.pathArrayToString(detail.path);
        const foreachElements = this.findForeachElementsByArrayPath(pathString);

        if (foreachElements.length === 0) {
            return;
        }

        for (let i = 0, len = foreachElements.length; i < len; i++) {
            this.renderForeach(foreachElements[i]);
        }
    };

    /**
     * Scans the container for elements with data-pac-bind attributes and extracts
     * their binding information along with expression dependencies.
     * @returns {Map<WeakKey, any>}
     */
    Context.prototype.scanBindings = function(parentElement) {
        const interpolationMap = new Map();
        const elements = parentElement.querySelectorAll('[data-pac-bind]');

        // Use a for loop instead of forEach to avoid closure creation per iteration
        for (let i = 0, len = elements.length; i < len; i++) {
            const element = elements[i];
            const belongs = Utils.belongsToPacContainer(this.container, element);

            // Skip elements that don't belong to this container
            if (!belongs) {
                continue;
            }

            // Extract and parse the binding string from the element's attribute
            const bindingString = element.getAttribute('data-pac-bind');
            const parsedBindings = ExpressionCache.parseBindingString(bindingString);

            // Transform bindings array into object keyed by binding type.
            // Object.create(null) avoids prototype chain lookups on property access.
            const bindingsObject = Object.create(null);

            for (let j = 0, bLen = parsedBindings.length; j < bLen; j++) {
                bindingsObject[parsedBindings[j].type] = {
                    target: parsedBindings[j].target
                };
            }

            // Store the binding string and parsed bindings, keyed by element
            interpolationMap.set(element, {
                bindingString: bindingString,
                bindings: bindingsObject
            });
        }

        // Extend data of foreach bindings
        this.extendBindingsWithForEachData(interpolationMap);

        // Return the map
        return interpolationMap;
    };

    /**
     * Finds the element associated with a specific forEach identifier.
     * @param {string|number} forEachId - Identifier used to look up the element.
     * @returns {*} The matching element, or null if no match is found.
     */
    Context.prototype.findElementByForEachId = function (forEachId) {
        // Loop over all element → mappingData pairs in the interpolation map
        for (const [element, mappingData] of this.interpolationMap) {
            // Check whether this entry belongs to the requested forEachId
            if (mappingData.foreachId === forEachId) {
                // Return the matching element immediately
                return element;
            }
        }

        // No matching element was found
        return null;
    };

    /**
     * Extend data of foreach binds
     * @param interpolationMap {Map<WeakKey, any>}
     */
    Context.prototype.extendBindingsWithForEachData = function(interpolationMap) {
        const self = this;

        interpolationMap.forEach((mappingData, element) => {
            // Do nothing when this is not a foreach binding
            if (!mappingData.bindings.foreach) {
                return;
            }

            // Do nothing when the binding already has a foreachId
            if (mappingData.foreachId) {
                return;
            }

            // If the element has an foreach-id attribute, but no internal foreachId, this is probably
            // a foreach that becomes out of hiding through the if binding. Lookup the previous element
            // and put its elementData inside the new element. Then remove the old binding
            if (element.hasAttribute('data-pac-foreach-id')) {
                const foreachId = element.getAttribute('data-pac-foreach-id');
                const elementByForEach = self.findElementByForEachId(foreachId);
                const elementData = self.interpolationMap.get(elementByForEach);

                if (elementByForEach && elementData) {
                    interpolationMap.set(element, elementData);
                    self.interpolationMap.delete(elementByForEach);
                    return;
                }

                // Old element no longer exists — strip the stale id
                element.removeAttribute('data-pac-foreach-id');
            }

            // Set a new foreachId
            const foreachId = Utils.uniqid('foreach');
            element.setAttribute('data-pac-foreach-id', foreachId);

            // Store the updated mapping data into the map
            const foreachExpr = mappingData.bindings.foreach.target;
            const itemVar = element.getAttribute('data-pac-item') || 'item';
            const indexVar = element.getAttribute('data-pac-index') || '$index';
            const depth = self.getElementDepth(element);

            Object.assign(mappingData, {
                foreachId: foreachId,
                foreachExpr: foreachExpr,
                sourceArray: this.inferArrayRoot(foreachExpr),
                template: element.innerHTML, // Capture clean template
                itemVar: itemVar,
                indexVar: indexVar,
                depth: depth
            });

            interpolationMap.set(element, mappingData);
        })
    }

    /**
     * Scans the container for text nodes containing interpolation expressions and builds
     * a mapping of nodes to their templates and dependencies.
     * @returns {Map<WeakKey, any>}
     */
    Context.prototype.scanTextBindings = function(parentElement) {
        const interpolationMap = new Map();
        const container = this.container;

        // Create tree walker to find text nodes with interpolation expressions
        const walker = document.createTreeWalker(
            parentElement,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: node => {
                    // Skip if no interpolation or node doesn't belong to this container
                    if (!INTERPOLATION_TEST_REGEX.test(node.textContent) ||
                        !Utils.belongsToPacContainer(container, node)) {
                        return NodeFilter.FILTER_SKIP;
                    }

                    // Process this node
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        // Walk through matching text nodes and record their templates
        let node;
        while ((node = walker.nextNode())) {
            interpolationMap.set(node, {
                template: node.textContent
            });
        }

        // Return bindings map
        return interpolationMap;
    };

    /**
     * Collects <script type="text/template" data-pac-partial="name"> elements into
     * _partials once on the first wakaPAC() call. Uses textContent so {{> name}}
     * is never entity-encoded.
     * @returns {void}
     */
    function collectPartials() {
        if (_partialsCollected) {
            return;
        }

        _partialsCollected = true;

        // Find all partials
        document.querySelectorAll('script[type="text/template"][' + PAC_PARTIAL_ATTR + ']').forEach(function(el) {
            // Extract name
            const name = el.getAttribute(PAC_PARTIAL_ATTR);

            // If none passed, ignore
            if (!name) {
                return;
            }

            // If already defined, warn the user and ignore
            if (_partials.has(name)) {
                console.warn('wakaPAC: Duplicate partial "' + name + '" — only the first definition is used.');
                return;
            }

            // textContent gives the raw unencoded string — > is never encoded
            // inside a script tag, so {{> name}} injection syntax is preserved
            _partials.set(name, el.textContent);
        });
    }

    /**
     * Expands {{> name}} injections in a raw HTML string. Recursive up to depth 10.
     * Normalizes {{&gt; to {{> first to handle strings captured via element.innerHTML.
     * @param {string} html
     * @param {number} [depth=0]
     * @returns {string}
     */
    function expandPartialsInString(html, depth) {
        if (_partials.size === 0) {
            return html;
        }

        depth = depth || 0;

        if (depth >= 10) {
            console.warn('wakaPAC: Partial expansion stopped at maximum depth (10). Check for circular partial references.');
            return html;
        }

        // Normalize &gt; encoding from innerHTML-captured templates
        html = html.replace(/\{\{&gt;/g, '{{>');

        // Quick check before paying regex cost
        if (html.indexOf('{{>') === -1) {
            return html;
        }

        PARTIAL_INJECT_REGEX.lastIndex = 0;

        const expanded = html.replace(PARTIAL_INJECT_REGEX, function (match, name, root) {
            if (!_partials.has(name)) {
                console.warn('wakaPAC: Unknown partial "{{> ' + name + '}}" — register a <div data-pac-partial="' + name + '"> element in the document.');
                return match;
            }

            // Extract the body
            let body = _partials.get(name);

            // If a root argument was supplied, substitute "$." with "root." throughout
            // the partial body so property paths resolve against the passed object.
            if (root) {
                PARTIAL_PARAM_REGEX.lastIndex = 0;
                body = body.replace(PARTIAL_PARAM_REGEX, root + '.');
            }

            return body;
        });

        // Recurse only if something was replaced and depth allows
        PARTIAL_INJECT_REGEX.lastIndex = 0;

        if (expanded !== html && expanded.indexOf('{{>') !== -1) {
            return expandPartialsInString(expanded, depth + 1);
        }

        return expanded;
    }

    /**
     * Expands {{> name}} injections inside a live DOM element by walking its
     * text nodes (textContent is never entity-encoded, unlike innerHTML).
     * @param {Element} element
     * @returns {void}
     */
    function expandPartials(element) {
        if (_partials.size === 0) {
            return;
        }

        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const hits = [];

        let node;
        while ((node = walker.nextNode())) {
            if (node.textContent.indexOf('{{>') !== -1) {
                hits.push(node);
            }
        }

        if (hits.length === 0) {
            return;
        }

        hits.forEach(function (textNode) {
            const expanded = expandPartialsInString(textNode.textContent, 0);

            if (expanded === textNode.textContent) {
                return;
            }

            // Replace the text node with parsed HTML nodes.
            // Create a temporary container, parse the expanded HTML into it,
            // then insert its children before the text node and remove it.
            const temp = document.createElement('template');
            temp.innerHTML = expanded;
            const fragment = temp.content;
            textNode.parentNode.replaceChild(fragment, textNode);
        });
    }

    /**
     * Calls scanAndRegisterNewElements on every Element node in the given array.
     * Extracted as a module-level helper so it is defined once rather than
     * recreated as a closure on each updateCommentConditional call.
     * @param {Context} context
     * @param {Node[]} nodes
     */
    function scanElementNodes(context, nodes) {
        nodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                context.scanAndRegisterNewElements(node);
            }
        });
    }

    /**
     * Scans the container for comment nodes with wp-if conditionals
     * Builds mapping similar to element bindings but for comment-based conditionals
     * @param {Element} parentElement - The parent element to scan
     * @returns {Map<Comment, {expression: string, closingComment: Comment, branches: Array<{expression: string|null, nodes: Node[], scanned: boolean}>, scopeResolver: Object, isVisible: number|null}>}
     */
    Context.prototype.scanCommentBindings = function(parentElement) {
        const commentBindingMap = new Map();
        const openComments = []; // Stack to track nested wp-if comments

        // Create tree walker to find comment nodes
        const walker = document.createTreeWalker(
            parentElement,
            NodeFilter.SHOW_COMMENT,
            {
                acceptNode: node =>
                    Utils.belongsToPacContainer(this.container, node)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_SKIP
            }
        );

        let commentNode;

        while ((commentNode = walker.nextNode())) {
            // nodeValue is more direct than textContent for comment nodes
            const text = commentNode.nodeValue;

            // Check for opening wp-if comment
            const openMatch = text.match(WP_IF_COMMENT_REGEX);

            // If found, add it to the array
            if (openMatch) {
                openComments.push({ comment: commentNode, expression: openMatch[1].trim() });
                continue;
            }

            // Check for closing /wp-if comment — must have a matching open
            if (!text.match(WP_IF_CLOSE_COMMENT_REGEX) || openComments.length === 0) {
                continue;
            }

            // pop comment off array
            const { comment: openComment, expression } = openComments.pop();

            // Build a unified branches array so updateCommentConditional can
            // iterate a single list regardless of how many wp-else-if clauses exist.
            const branches = [{ expression, nodes: [], scanned: false }];
            let activeBucket = branches[0].nodes;

            for (let node = openComment.nextSibling; node && node !== commentNode; node = node.nextSibling) {
                if (node.nodeType === Node.COMMENT_NODE) {
                    const elseIfMatch = node.nodeValue.match(WP_ELSE_IF_COMMENT_REGEX);

                    if (elseIfMatch) {
                        const branch = { expression: elseIfMatch[1].trim(), nodes: [], scanned: false };
                        branches.push(branch);
                        activeBucket = branch.nodes;
                        continue;
                    }

                    if (node.nodeValue.match(WP_ELSE_COMMENT_REGEX)) {
                        const branch = { expression: null, nodes: [], scanned: false };
                        branches.push(branch);
                        activeBucket = branch.nodes;
                        continue;
                    }
                }

                activeBucket.push(node);
            }

            // Build the scopeResolver once at scan time. The comment's parent
            // element is stable for the lifetime of the binding, so there is
            // no benefit to rebuilding this on every evaluation.
            let scopeParent = openComment.parentNode;

            while (scopeParent && scopeParent.nodeType !== Node.ELEMENT_NODE) {
                scopeParent = scopeParent.parentNode;
            }

            const scopeResolver = {
                resolveScopedPath: (path) => scopeParent
                    ? this.normalizePath(path, scopeParent)
                    : path
            };

            // Store in map
            commentBindingMap.set(openComment, {
                expression,
                closingComment: commentNode,
                branches,
                scopeResolver,
                isVisible: null  // null sentinel forces first evaluation to always run
            });
        }

        // Warn about unmatched opening tags
        if (openComments.length > 0) {
            console.warn('WakaPAC: Unmatched wp-if comment directives found', openComments);
        }

        // Return bindings map
        return commentBindingMap;
    };

    /**
     * Updates the visibility of content controlled by a wp-if comment.
     * Evaluates each branch in order and shows the first one that matches,
     * hiding all others. The plain wp-else branch (expression === null) always
     * matches when reached. Exactly one branch is visible at a time.
     * @param {Comment} commentNode - The wp-if comment node
     * @param {Object} mappingData - The binding data for this comment
     */
    Context.prototype.updateCommentConditional = function(commentNode, mappingData) {
        try {
            const abstraction = this.abstraction;
            const scopeResolver = mappingData.scopeResolver;
            const branches = mappingData.branches;

            // Find the first branch whose expression is truthy.
            // expression === null means plain wp-else, which always wins.
            let winningBranch = -1;

            for (let i = 0; i < branches.length; i++) {
                const branch = branches[i];

                if (branch.expression === null || ExpressionParser.evaluate(
                    ExpressionCache.parseExpression(branch.expression),
                    abstraction,
                    scopeResolver
                )) {
                    winningBranch = i;
                    break;
                }
            }

            // Bail early if the same branch is already visible
            if (winningBranch === mappingData.isVisible) {
                return;
            }

            // Show the winning branch, hide all others
            for (let i = 0; i < branches.length; i++) {
                this.domUpdater.toggleNodeVisibility(branches[i].nodes, i === winningBranch);
            }

            mappingData.isVisible = winningBranch;

            // Scan the newly shown branch once to register any reactive bindings
            // inside content that started hidden
            if (winningBranch !== -1 && !branches[winningBranch].scanned) {
                scanElementNodes(this, branches[winningBranch].nodes);
                branches[winningBranch].scanned = true;
            }
        } catch (error) {
            console.warn('WakaPAC: Error processing wp-if comment directive:', mappingData.expression, error);
        }
    };

    // =============================================================================
    // REACTIVE ABSTRACTION (Proxy Creation & System Properties)
    // =============================================================================

    /**
     * Setup reactive properties for this container
     * @returns {*|object}
     */
    Context.prototype.createReactiveAbstraction = function() {
        const self = this;

        // Inject system properties
        this.injectHierarchyProperties(this.originalAbstraction);
        this.injectSystemProperties(this.originalAbstraction);

        // Create reactive proxy directly from original abstraction
        const proxiedReactive = makeDeepReactiveProxy(this.originalAbstraction, this.container);

        // Copy all methods from the original abstraction to the reactive proxy (except the special
        // 'computed' property which gets handled separately), but critically: rebind their 'this'
        // context to point to the reactive proxy instead of the original object.
        // This ensures that when methods access properties via 'this.propertyName', they interact
        // with the reactive proxy (triggering DOM updates) rather than the non-reactive original.
        Object.keys(this.originalAbstraction).forEach(function (key) {
            if (typeof self.originalAbstraction[key] === 'function' && key !== 'computed') {
                proxiedReactive[key] = self.originalAbstraction[key].bind(proxiedReactive);
            }
        });

        // Add computed properties as getters
        const computed = this.originalAbstraction.computed || {};
        Object.keys(computed).forEach(function (computedName) {
            Object.defineProperty(proxiedReactive, computedName, {
                get: function () {
                    return computed[computedName].call(proxiedReactive);
                },
                enumerable: true,
                configurable: true
            });
        });

        /**
         * Hierarchy communication methods
         */
        Object.assign(proxiedReactive, {
            /**
             * Serializing the reactive object to JSON (excluding non-serializable properties)
             * @returns {Object}
             */
            toJSON: function() {
                // Initialize the result object that will hold serializable properties
                const result = {};

                // Get list of computed property names from the original component definition
                // Computed properties are derived values and shouldn't be serialized
                const computedProps = self.originalAbstraction.computed ? Object.keys(self.originalAbstraction.computed) : [];

                // Iterate through all properties in the component's abstraction layer
                Object.keys(this).forEach(key => {
                    const value = this[key];

                    // Include property in serialization only if it meets all criteria:
                    if (value !== undefined &&              // Has a defined value
                        typeof value !== 'function' &&      // Is not a function
                        !computedProps.includes(key)        // Is not a computed property
                    ) {
                        // Add the property to our serialized result
                        result[key] = value;
                    }
                });

                // Return the clean, serializable object
                return result;
            }
        });

        // Add utility methods as non-enumerable properties
        Object.defineProperties(proxiedReactive, {

            /**
             * Converts container-relative coordinates to viewport-absolute coordinates
             * Equivalent to Win32 ClientToScreen - converts client-area to screen coordinates
             * @param {number} x - Container-relative x coordinate
             * @param {number} y - Container-relative y coordinate
             * @returns {{x: number, y: number}} Viewport-absolute coordinates
             */
            containerToViewport: {
                value: (x, y) => {
                    const rect = self.container.getBoundingClientRect();

                    return {
                        x: x + rect.left,
                        y: y + rect.top
                    };
                },
                writable: false,
                enumerable: false
            },

            /**
             * Converts viewport-absolute coordinates to container-relative coordinates
             * Equivalent to Win32 ScreenToClient - converts screen to client-area coordinates
             * @param {number} x - Viewport-absolute x coordinate
             * @param {number} y - Viewport-absolute y coordinate
             * @returns {{x: number, y: number}} Container-relative coordinates
             */
            viewportToContainer: {
                value: (x, y) => {
                    const rect = self.container.getBoundingClientRect();
                    return {
                        x: x - rect.left,
                        y: y - rect.top
                    };
                },
                writable: false,
                enumerable: false
            }
        });

        // Return the proxy
        return proxiedReactive;
    };

    /**
     * Injects hierarchy-related properties into an abstraction object.
     * These properties are used to track parent-child relationships within a hierarchical structure.
     * @param {Object} abstraction - The abstraction object to inject properties into
     * @param {number} abstraction.childrenCount - Will be set to 0, representing the number of child elements
     * @param {boolean} abstraction.hasParent - Will be set to false, indicating whether this abstraction has a parent
     * @returns {void} This method modifies the abstraction object in place
     */
    Context.prototype.injectHierarchyProperties = function(abstraction) {
        abstraction.childrenCount = 0;
        abstraction.hasParent = false;
    };

    /**
     * Injects system properties into the abstraction
     * @param {Object} abstraction - The abstraction to enhance
     */
    Context.prototype.injectSystemProperties = function(abstraction) {
        // Add container element reference and identification
        abstraction.container = this.container;
        abstraction.pacId = this.container._pacId || this.container.getAttribute('data-pac-id');

        // Initialize online/offline state and network quality
        abstraction.browserOnline = navigator.onLine;
        abstraction.browserNetworkEffectiveType = Utils.getNetworkEffectiveType();
        abstraction.browserNetworkQuality = Utils.detectNetworkQuality();

        // Initialize page visibility state - tracks if the browser tab/window is currently visible
        // Useful for pausing animations or reducing CPU usage when user switches tabs
        abstraction.browserVisible = !document.hidden;

        // Initialize current horizontal/vertical scroll position in pixels from left/top of document
        abstraction.browserScrollX  = window.scrollX;
        abstraction.browserScrollY = window.scrollY;

        // Initialize current viewport width & height - the visible area of the browser window
        // Updates automatically when user resizes window or rotates mobile device
        abstraction.browserViewportHeight = window.innerHeight;
        abstraction.browserViewportWidth = window.innerWidth;

        // Initialize total document width/height including content outside the viewport
        // Useful for calculating scroll percentages or infinite scroll triggers
        abstraction.browserContentWidth = document.documentElement.scrollWidth;
        abstraction.browserContentHeight = document.documentElement.scrollHeight;

        // Container scroll properties
        abstraction.containerIsScrollable = false;                         // Can scroll in any direction
        abstraction.containerScrollX = this.container.scrollLeft;           // Current horizontal scroll position
        abstraction.containerScrollY = this.container.scrollTop;            // Current vertical scroll position
        abstraction.containerContentWidth = this.container.scrollWidth;     // Total scrollable content width
        abstraction.containerContentHeight = this.container.scrollHeight;   // Total scrollable content height
        abstraction.containerScrollWindow = {
            top: 0,        // scrollTop
            left: 0,       // scrollLeft
            right: 0,      // scrollWidth
            bottom: 0,     // scrollHeight
            x: 0,          // scrollLeft (alias)
            y: 0           // scrollTop (alias)
        };

        // Initialised to null — DOM state is not reliable at construction time.
        // IntersectionObserver will set the real value asynchronously, guaranteeing
        // a null → true/false transition that always triggers watchers, including
        // for elements that are already in the viewport on page load.
        abstraction.containerVisible = null;
        abstraction.containerFullyVisible = null;

        // Per-container viewport visibility properties
        abstraction.containerFocus = Utils.isElementDirectlyFocused(this.container);
        abstraction.containerFocusWithin = Utils.isElementFocusWithin(this.container);
        abstraction.containerClientRect = {top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0};
        abstraction.containerWidth = this.container.clientWidth;
        abstraction.containerHeight = this.container.clientHeight;

        // Screen orientation
        abstraction.browserOrientationAngle = screen.orientation ? screen.orientation.angle : 0;
        abstraction.browserOrientationType = screen.orientation ? screen.orientation.type : 'unknown';

        // Pixel ratio
        abstraction.browserDevicePixelRatio = window.devicePixelRatio || 1;
    };

    /**
     * Finds the nearest parent element that has a foreach binding.
     * @param {Element} element - The DOM element to start searching from. Must be a valid DOM Element.
     * @returns {Element|null} The nearest parent element with a foreach binding, or null
     */
    Context.prototype.findParentForeachElement = function(element) {
        let current = element.parentElement;

        while (current && current !== this.container) {
            if (current.hasAttribute('data-pac-bind') &&
                current.getAttribute('data-pac-bind').includes('foreach:')) {
                return current;
            }

            current = current.parentElement;
        }

        return null;
    }

    // =============================================================================
    // FOREACH RENDERING (Array → DOM List Generation)
    // =============================================================================

    /**
     * Builds a mapping from render indices to source indices, accounting for duplicate values.
     * @param {Array} sourceArray - The original unfiltered array containing all items.
     * @param {Array} filteredArray - A subset (or reordering) of sourceArray to map back to source positions.
     * @returns {Map<number, number>} A Map where each key is a render index (position in filteredArray)
     *                                and each value is the corresponding source index (position in sourceArray).
     */
    Context.prototype.buildIndexMap = function (sourceArray, filteredArray) {
        const claimed = new Set();
        const result = new Map(); // keyed by renderIndex

        filteredArray.forEach((item, renderIndex) => {
            for (let i = 0; i < sourceArray.length; i++) {
                if (!claimed.has(i) && sourceArray[i] === item) {
                    claimed.add(i);
                    result.set(renderIndex, i);
                    break;
                }
            }
        });

        return result;
    }

    /**
     * Renders a foreach loop by evaluating its array expression and generating DOM content.
     * @param {Element} foreachElement - DOM element with foreach binding
     * @returns {void}
     */
    Context.prototype.renderForeach = function(foreachElement) {
        const self = this;
        const mappingData = this.interpolationMap.get(foreachElement);

        if (!mappingData || !mappingData.foreachId) {
            console.warn('No foreach binding found for element');
            return;
        }

        // Clean up old elements from maps before clearing innerHTML
        // This prevents memory leaks when re-rendering dynamic content
        this.cleanupForeachMaps(foreachElement);

        try {
            // Evaluate the foreach expression (e.g., "todos" or "todo.subs")
            const array = ExpressionParser.evaluate(
                ExpressionCache.parseExpression(mappingData.foreachExpr),
                this.abstraction,
                makeScopeResolver(
                    this.normalizePath.bind(this),
                    foreachElement,
                    this.importedUnits
                )
            );

            // TIMING FIX: Handle the case where parent context doesn't exist yet
            // Strategy: Silently skip rendering now, let natural retry handle it later
            // When parent foreach renders and calls scanAndRegisterNewElements(), this
            // method will be called again with proper context available.
            if (!array) {
                // Don't clear innerHTML - preserve template for when context becomes available
                // Don't log errors - this is expected behavior during initialization
                return;
            }

            // Validate that the resolved expression is actually an array
            if (!Array.isArray(array)) {
                console.warn(`Foreach expression "${mappingData.foreachExpr}" did not evaluate to an array, got:`, typeof array, array);
                foreachElement.innerHTML = ''; // Clear invalid content
                return;
            }

            // Resolve the source array for index mapping.
            // For filtered/sorted expressions the foreach may render a subset of a larger
            // array — fall back to the evaluated array itself when no root can be found.
            const sourceRootName = mappingData.sourceArray || this.inferArrayRoot(mappingData.foreachExpr);
            const sourceRootArray = sourceRootName && this.abstraction[sourceRootName];
            const sourceArray = Array.isArray(sourceRootArray) ? sourceRootArray : array;

            // Store array to be able to compare later
            foreachElement._pacPreviousArray = array;

            // Build complete HTML string first, then set innerHTML once
            // This prevents DOM corruption caused by repeated innerHTML += operations
            let completeHTML = '';

            // Expand partial templates in the foreach template string once, up front,
            // rather than on every iteration — partials are static markup
            const expandedTemplate = expandPartialsInString(mappingData.template);

            // Generate DOM content for each array item
            // HTML comments mark the boundaries and context for each iteration
            const indexMap = self.buildIndexMap(sourceArray, array);

            array.forEach((item, renderIndex) => {
                // Find the original index in the source array
                const originalIndex = indexMap.has(renderIndex) ? indexMap.get(renderIndex) : renderIndex;

                // Build the HTML for this item
                completeHTML += self.buildForeachItemHTML(
                    mappingData.foreachId, expandedTemplate, originalIndex, renderIndex
                );
            });

            // Set the complete HTML at once - this preserves comment structure
            foreachElement.innerHTML = completeHTML;

            // Cache context on item elements for fast lookups
            this.cacheContextOnItemElements(foreachElement);

            // Recursively scan the newly generated content for bindings and nested foreach elements
            // This is where the "natural retry" happens - nested foreach elements found here
            // will now have proper parent context available for successful rendering
            this.scanAndRegisterNewElements(foreachElement);

            // After rebuilding children, sync <select> DOM state back to the model.
            // When a foreach replaces <option> elements inside a <select>, the browser
            // reconciles the selection against the new option set. The resulting .value
            // is the source of truth — push it into the abstraction so the proxy fires
            // a change event and all dependent bindings update naturally.
            this.syncSelectAfterForeach(foreachElement);

            // Notify the component that this foreach has finished rendering.
            // wParam carries the number of rendered items; detail carries the
            // source array name so the handler can retrieve data and DOM elements.
            wakaPAC.sendMessage(
                this.abstraction.pacId,
                MSG_FOREACH_REBUILT,
                array.length,
                0,
                {
                    arrayName: mappingData.foreachExpr,
                    marker: foreachElement.getAttribute('data-pac-marker') ?? null
                }
            );

        } catch (error) {
            console.warn(`Error evaluating foreach expression "${mappingData.foreachExpr}":`, error);
            // Don't clear innerHTML on error during initial scan - preserve template
            // The error might resolve itself when parent context becomes available
        }
    };

    /**
     * Syncs a <select> element's DOM value back into the model after its
     * child <option> elements were rebuilt by a foreach. The browser reconciles
     * the selection against the new option set; this method reads the resulting
     * .value and writes it into the abstraction so the proxy fires a pac:change
     * event and dependent bindings stay in sync.
     * @param {Element} foreachElement - The element whose foreach just rebuilt
     */
    Context.prototype.syncSelectAfterForeach = function(foreachElement) {
        let selectElement = null;
        let selectMappingData = null;

        // Case 1: the foreach element itself is a <select>
        if (foreachElement.tagName === 'SELECT') {
            selectElement = foreachElement;
            selectMappingData = this.interpolationMap.get(foreachElement);
        }

        // Case 2: the foreach element's immediate parent is a <select>
        else if (foreachElement.parentElement && foreachElement.parentElement.tagName === 'SELECT') {
            selectElement = foreachElement.parentElement;
            selectMappingData = this.interpolationMap.get(selectElement);
        }

        if (!selectElement || !selectMappingData || !selectMappingData.bindings.value) {
            return;
        }

        // Read what the browser settled on after the options were replaced
        const domValue = selectElement.value;

        // Resolve the bound property path and write the DOM value into the abstraction
        const valueBinding = selectMappingData.bindings.value;
        const resolvedPath = this.normalizePath(valueBinding.target, selectElement);

        // Write the DOM value into the abstraction — the proxy handles the change event
        Utils.setNestedProperty(resolvedPath, domValue, this.abstraction);
    };

    /**
     * Walks up the DOM from a given element and collects all enclosing
     * foreach contexts, starting from the closest one.
     * @param {Element} element
     * @returns {Array<Object>}
     */
    Context.prototype.getForeachChain = function(element) {
        // Return cached chain if available — avoids repeated DOM traversal
        // and comment parsing for the same element across multiple normalizePath calls.
        // Cache is valid until foreach rebuild (old elements are discarded entirely).
        if (element._pacForeachChain) {
            return element._pacForeachChain;
        }

        // Accumulates the discovered foreach contexts in traversal order
        const chain = [];

        // Cache frequently accessed properties to avoid repeated lookups
        const containerRoot = this.container;
        const interpolationMap = this.interpolationMap;

        // Start traversal at the provided element
        let currentElement = element;

        // Continue walking up the foreach hierarchy until no parent exists
        while (currentElement) {
            // Resolve the closest foreach context associated with this element
            const foreachContext = this.extractClosestForeachContext(currentElement);

            if (foreachContext) {
                // Locate the DOM container tied to this foreach instance
                const foreachContainer = containerRoot.querySelector(
                    `[data-pac-foreach-id="${foreachContext.foreachId}"]`
                );

                // Retrieve stored metadata for this container, if available
                const foreachData = foreachContainer && interpolationMap.get(foreachContainer);

                if (foreachData) {
                    // Store a snapshot of the current foreach state
                    chain.push({
                        foreachId: foreachContext.foreachId,
                        depth: foreachData.depth,
                        index: foreachContext.index,
                        renderIndex: foreachContext.renderIndex,
                        container: foreachContainer,
                        itemVar: foreachData.itemVar,
                        indexVar: foreachData.indexVar,
                        sourceArray: foreachData.sourceArray
                    });
                }
            }

            // Move to the next parent foreach element in the hierarchy
            currentElement = this.findParentForeachElement(currentElement);
        }

        // Cache the chain on the element for subsequent lookups
        element._pacForeachChain = chain;

        // Return the collected foreach chain
        return chain;
    };

    /**
     * Resolve scoped variables into a flattened token array.
     * Scope values may be numbers or string paths.
     */
    Context.prototype.resolveScopedTokens = function(tokens, scope) {
        const resolved = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (!scope.has(token)) {
                resolved.push(token);
                continue;
            }

            const value = scope.get(token);

            if (typeof value === "number") {
                resolved.push(value);
                continue;
            }

            // Convert once when expanding scope value
            const parts = Utils.pathStringToArray(value);

            for (let j = 0; j < parts.length; j++) {
                resolved.push(parts[j]);
            }
        }

        return resolved;
    };

    /**
     * Build a scoped variable map from foreach frames.
     * @param {Array<Object>} frames - Effective foreach frames (outer → inner).
     * @returns {Map<string, string|number>} Scoped variable map.
     */
    Context.prototype.buildForeachScope = function (frames) {
        // Stores scoped variable → resolved path/index mappings
        const scope = new Map();

        // Expand each foreach frame into scoped variables
        for (const f of frames) {
            // Resolve item variable into a fully-qualified global path
            if (!scope.has(f.itemVar)) {
                // Normalize the frame source path into tokens
                const tokens = Utils.pathStringToArray(f.sourceArray);

                // Resolve tokens against the current scope chain
                const resolved = this.resolveScopedTokens(tokens, scope);

                // Convert resolved tokens into a normalized base path string
                const base = Utils.pathArrayToString(resolved);

                // Append the current index to produce the final scoped path
                scope.set(
                    f.itemVar,
                    `${base}[${f.index}]`
                );
            }

            // Map index variable directly to its numeric index
            if (f.indexVar && !scope.has(f.indexVar)) {
                scope.set(f.indexVar, f.index);
            }
        }

        return scope;
    };

    /**
     * Normalize a scoped path to a fully-qualified global data path.
     * Counts leading "parent" tokens to determine how many foreach scopes to
     * climb, selects the remaining frames, builds a scope map, and resolves
     * the path through it.
     * @param {string|Array<string|number>} pathSegments - Local path expression.
     * @param {HTMLElement} element - Element inside a foreach hierarchy.
     * @returns {string|number} Fully-qualified path or direct numeric index.
     */
    Context.prototype.normalizePath = function(pathSegments, element) {
        // Convert incoming path into normalized token form
        const path = Utils.pathStringToArray(pathSegments);

        // Empty paths resolve to nothing
        if (path.length === 0) {
            return "";
        }

        // Count consecutive leading "parent" tokens — each one climbs one foreach scope
        let climbs = 0;
        while (climbs < path.length && path[climbs] === "parent") {
            climbs++;
        }

        // Retrieve full foreach chain and apply parent climbs
        const chain = this.getForeachChain(element);
        if (climbs > chain.length) {
            console.warn(`Cannot climb ${climbs} levels - only ${chain.length} available`);
            climbs = chain.length;
        }

        // Frames after climbing, reversed to outer → inner order for scope resolution
        const frames = chain.slice(climbs).reverse();

        // Fast path: no foreach frames in scope — return remaining path directly
        if (frames.length === 0) {
            const remaining = path.slice(climbs);

            if (remaining.length === 0) {
                return "";
            } else if (remaining.length === 1 && typeof remaining[0] === "number") {
                return remaining[0];
            } else {
                return Utils.pathArrayToString(remaining);
            }
        }

        // Build a scoped variable map from those frames
        const scope = this.buildForeachScope(frames);

        // Remove parent climb tokens from the working path
        const remaining = path.slice(climbs);

        // If nothing remains, resolution ends at root scope
        if (remaining.length === 0) {
            return "";
        }

        // Resolve remaining tokens through scoped mappings
        const resolved = this.resolveScopedTokens(remaining, scope);

        // Special case: a single numeric token resolves directly
        if (resolved.length === 1 && typeof resolved[0] === "number") {
            return resolved[0];
        }

        // Convert resolved tokens back into normalized path string
        return Utils.pathArrayToString(resolved);
    };

    /**
     * Determines whether a foreach element needs to be rebuilt based on array changes
     * @param {Element} foreachElement - The DOM element with foreach directive
     * @returns {boolean} True if the foreach should be rebuilt, false otherwise
     */
    Context.prototype.shouldRebuildForeach = function(foreachElement) {
        // Get the mapping data for this foreach element from the interpolation map
        const mappingData = this.interpolationMap.get(foreachElement);

        // No mapping data means this isn't a valid foreach element
        if (!mappingData) {
            return false;
        }

        // Evaluate the foreach expression to get the current array
        const newArray = ExpressionParser.evaluate(
            ExpressionCache.parseExpression(mappingData.foreachExpr),
            this.abstraction,
            makeScopeResolver(
                this.normalizePath.bind(this),
                foreachElement,
                this.importedUnits
            )
        );

        // If evaluation doesn't result in an array, no rebuild needed
        if (!Array.isArray(newArray)) {
            return false;
        }

        // Get the previously cached array from the element's internal property
        const previousArray = foreachElement._pacPreviousArray;

        if (!previousArray) {
            // First time rendering - rebuild required
            return true;
        }

        // Quick length comparison - if lengths differ, rebuild needed
        if (newArray.length !== previousArray.length) {
            return true;
        }

        // Check if any array items changed by reference comparison
        // This catches object mutations and item replacements
        for (let i = 0; i < newArray.length; i++) {
            if (newArray[i] !== previousArray[i]) {
                return true;
            }
        }

        // Arrays are identical - no rebuild needed
        return false;
    };

    /**
     * Find all registered DOM elements whose foreach binding is driven by
     * the given array path.
     * @param {string} arrayPath - Fully-qualified data array path to match.
     * @returns {HTMLElement[]} Elements whose foreach bindings depend on the array.
     */
    Context.prototype.findForeachElementsByArrayPath = function (arrayPath) {
        const elementsToUpdate = [];

        for (const [element, mappingData] of this.interpolationMap) {
            // Do not do anything if no foreach was mapped
            if (!mappingData.bindings?.foreach) {
                continue;
            }

            // Fetch the foreach expression and source array
            const { foreachExpr, sourceArray } = mappingData;

            // Check whether arrayPath is or descends from the bound expression.
            // e.g. "rows[1].cells[3]" should match a foreach bound to "rows[1].cells".
            const matches = (expr) => expr === arrayPath || arrayPath.startsWith(expr + '[');

            // Try the raw expressions first — no allocation needed
            if (matches(foreachExpr) || matches(sourceArray)) {
                elementsToUpdate.push(element);
                continue;
            }

            // foreachExpr may be scoped (e.g. "row.cells" inside an outer foreach),
            // so resolve it against this element's context and try again.
            // Result is cached on mappingData to avoid redundant resolution.
            try {
                const resolvedExpr = (mappingData._resolvedForeachExpr ??= this.normalizePath(foreachExpr, element));

                if (matches(resolvedExpr)) {
                    elementsToUpdate.push(element);
                }
            } catch (_e) {
                // normalizePath throws for malformed expressions — skip silently
            }
        }

        return elementsToUpdate;
    };

    /**
     * Parses a comment node as a foreach item marker.
     * @param {Comment} commentNode - The DOM comment node to parse
     * @returns {{foreachId: string, index: number, renderIndex: number}|null}
     */
    Context.parseForeachComment = function(commentNode) {
        const match = commentNode.textContent.trim().match(FOREACH_INDEX_REGEX);

        if (!match) {
            return null;
        }

        return {
            foreachId: match[1].trim(),
            index: parseInt(match[2], 10),
            renderIndex: parseInt(match[3], 10)
        };
    };

    /**
     * Extracts the closest foreach context information by walking up the DOM tree
     * from a starting element, looking for comment markers that identify foreach items.
     * Checks cache first for O(1) lookup before falling back to comment parsing.
     * @param {Element} startElement - The DOM element to start searching from
     * @returns {number|null} Foreach context object with foreachId, index, and renderIndex or null
     * @returns {string} returns.foreachId - The identifier of the foreach loop
     * @returns {number} returns.index - The logical index in the data array
     * @returns {number|null} returns.renderIndex - The rendering index (may differ from logical index)
     */
    Context.prototype.extractClosestForeachContext = function(startElement) {
        // Cache container
        const container = this.container;

        // Cache the constant to avoid repeated global property lookups in the inner loop
        const COMMENT_NODE = Node.COMMENT_NODE;

        // Start from the element and walk up the DOM tree
        let current = startElement;

        while (current && current !== container) {
            // Check cache first — avoids repeated DOM traversal and regex matching
            if (current._pacForeachContext) {
                return current._pacForeachContext;
            }

            // Not cached — check previous siblings for comment markers
            let sibling = current.previousSibling;

            while (sibling) {
                // Only process comment nodes
                if (sibling.nodeType === COMMENT_NODE) {
                    const context = Context.parseForeachComment(sibling);

                    if (context) {
                        // Cache on the starting element so subsequent lookups
                        // from the same element or its descendants are O(1)
                        startElement._pacForeachContext = context;
                        return context;
                    }
                }

                // Move to the next previous sibling
                sibling = sibling.previousSibling;
            }

            // Move up to parent element to continue searching
            current = current.parentElement;
        }

        // No foreach context found in the entire tree up to container
        return null;
    };

    /**
     * Caches foreach context on item elements after rendering.
     * Walks the DOM tree, finds comment markers, and attaches context to the first element after each start marker.
     * This enables O(1) context lookups instead of repeated comment parsing.
     * @param {HTMLElement} foreachElement - The foreach container element
     */
    Context.prototype.cacheContextOnItemElements = function(foreachElement) {
        let node;
        let currentContext = null;

        const walker = document.createTreeWalker(foreachElement, NodeFilter.SHOW_ALL);

        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.COMMENT_NODE) {
                const context = Context.parseForeachComment(node);

                if (context) {
                    // Found start marker - prepare context for next element
                    currentContext = context;
                } else if (node.textContent.trim() === '/pac-foreach-item') {
                    // Found end marker - clear context
                    currentContext = null;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && currentContext) {
                // Cache context on the first element after start comment
                node._pacForeachContext = currentContext;
            }
        }
    };

    /**
     * Removes all child elements of a foreach container from interpolation maps
     * @param {Element} foreachElement - The foreach container element
     */
    Context.prototype.cleanupForeachMaps = function(foreachElement) {
        const elementsToRemove = [];
        const textNodesToRemove = [];

        // Find all elements that belong to this foreach container
        this.interpolationMap.forEach((mappingData, element) => {
            if (foreachElement.contains(element) && element !== foreachElement) {
                elementsToRemove.push(element);
            }
        });

        this.textInterpolationMap.forEach((mappingData, textNode) => {
            if (foreachElement.contains(textNode)) {
                textNodesToRemove.push(textNode);
            }
        });

        // Remove them from the maps AND clean up cached state
        elementsToRemove.forEach(element => {
            this.interpolationMap.delete(element);

            // Clean up cached state to prevent memory leaks
            delete element._pacPreviousValues;
            delete element._pacPreviousArray;
            delete element._pacDynamicClasses;
            delete element._pacForeachChain;
            delete element._pacForeachContext;
        });

        textNodesToRemove.forEach(textNode => {
            this.textInterpolationMap.delete(textNode);

            // Clean up cached text state
            delete textNode._pacPreviousText;
            delete textNode._pacForeachChain;
        });
    };

    // =============================================================================
    // COMPONENT HIERARCHY (Parent-Child Communication)
    // =============================================================================

    /**
     * Establishes parent-child relationships for this component
     * @param {Context|null} parent - Parent component (or null if top-level)
     * @param {Context[]} children - Array of child components
     */
    Context.prototype.establishHierarchy = function(parent, children) {
        // Updates relationships
        this.updateParentRelationship(parent);
        this.updateChildrenRelationships(children);

        // Updates reactive hierarchy properties
        this.abstraction.childrenCount = this.children.size;
        this.abstraction.hasParent = !!this.parent;

        // Perform scanning when all containers are properly marked
        this.scanAndRegisterNewElements(this.container);

        // Call ready() method if it exists after all bindings have been applied
        // Only call once per component instance
        if (
            !this.readyCalled &&
            this.abstraction.ready &&
            typeof this.abstraction.ready === 'function'
        ) {
            this.readyCalled = true;

            try {
                this.abstraction.ready.call(this.abstraction);
            } catch (error) {
                console.warn('Error in ready() method:', error);
            }
        }
    };

    /**
     * Updates parent relationship - only sets parent reference
     * @param {Object|null} newParent - New parent component or null
     */
    Context.prototype.updateParentRelationship = function(newParent) {
        // Do nothing when parent did not change
        if (this.parent === newParent) {
            return;
        }

        // Remove from old parent's children set
        if (this.parent) {
            this.parent.children.delete(this);
        }

        // Set new parent
        this.parent = newParent;

        // Add to new parent's children set
        if (newParent) {
            newParent.children.add(this);
        }
    };

    /**
     * Rebuilds children relationships from current DOM hierarchy
     * @param {Array} currentChildren - Children found in DOM
     */
    Context.prototype.updateChildrenRelationships = function(currentChildren) {
        this.children.clear();

        currentChildren.forEach(child => {
            // Remove child from previous parent if different
            if (child.parent && child.parent !== this) {
                child.parent.children.delete(child);
            }

            child.parent = this;
            this.children.add(child);
        });
    };

    /**
     * Builds the HTML string for a single foreach item, wrapped in boundary comments.
     * @param {string} foreachId - The unique identifier for this foreach loop
     * @param {string} template - The raw HTML template for one iteration
     * @param {number} originalIndex - The item's index in the source array
     * @param {number} renderIndex - The item's position in the rendered output
     * @returns {string} Comment-delimited HTML string for one foreach iteration
     */
    Context.prototype.buildForeachItemHTML = function(foreachId, template, originalIndex, renderIndex) {
        return `<!-- pac-foreach-item: ${foreachId}, index=${originalIndex}, renderIndex=${renderIndex} -->` +
            template +
            `<!-- /pac-foreach-item -->`;
    }

    // =============================================================================
    // CLEANUP OBSERVER
    // =============================================================================

    /**
     * Monitors DOM for removed components and automatically triggers cleanup
     * Uses MutationObserver to detect when elements with data-pac-id are removed
     */
    const CleanupObserver = {
        observer: null,

        /**
         * Initialize the MutationObserver to watch for removed PAC components
         * Should be called once during framework initialization
         */
        initialize() {
            if (this.observer) {
                return; // Already initialized
            }

            // Process all DOM mutations in this batch
            this.observer = new MutationObserver(mutations => {
                // Track PAC ids already destroyed in this mutation batch
                const destroyed = new Set();

                mutations.forEach(mutation => {
                    mutation.removedNodes.forEach(node => {
                        // Only element nodes can contain attributes/query selectors
                        if (node.nodeType !== Node.ELEMENT_NODE) {
                            return;
                        }

                        // Collect PAC elements in this removed subtree:
                        // include the root node if it is a PAC container,
                        // followed by all nested PAC containers
                        const pacNodes = [
                            ...(node.matches(CONTAINER_SEL) ? [node] : []),
                            ...node.querySelectorAll(CONTAINER_SEL)
                        ];

                        // Destroy deepest nodes first to preserve parent/child teardown order
                        for (let i = pacNodes.length - 1; i >= 0; i--) {
                            // Fetch the pacId
                            const pacId = pacNodes[i].getAttribute('data-pac-id');

                            // Skip invalid ids or components already destroyed this batch
                            if (!pacId || destroyed.has(pacId)) {
                                continue;
                            }

                            // Cleanup plugins
                            _plugins.forEach(function(plugin) {
                                if (typeof plugin.onComponentDestroyed === 'function') {
                                    plugin.onComponentDestroyed(pacId);
                                }
                            });

                            // Add to destroyed list
                            destroyed.add(pacId);

                            // Destroy the registered component if it still exists
                            window.PACRegistry.components.get(pacId)?.destroy();
                        }
                    });
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    };

    // =============================================================================
    // MOUSE GESTURE RECOGNIZER
    // =============================================================================

    /**
     * Mouse Gesture Recognition System
     *
     * Recognizes mouse gesture patterns drawn while holding the right mouse button.
     * Similar to Opera browser's mouse gestures - users can draw shapes (L, inverted-L,
     * lines, etc.) to trigger custom actions.
     *
     * Recognition Process:
     * 1. User presses right mouse button - start recording path
     * 2. User drags mouse - record points along the path
     * 3. User releases button - analyze path into directional segments
     * 4. Match segments against known patterns
     * 5. Dispatch MSG_GESTURE event to containing PAC component
     *
     * Built-in Patterns (minimal set):
     * - Single directions: right, left, up, down
     * - L-shapes: L (right-down), inverted-L (down-right)
     *
     * Users can register custom patterns via wakaPAC.registerGesture()
     *
     * @namespace MouseGestureRecognizer
     */
    const MouseGestureRecognizer = {
        /** @private {boolean} Flag to prevent multiple initializations */
        _initialized: false,

        /** @private {boolean} Whether we're currently recording a gesture */
        isRecording: false,

        /** @private {Array<{x: number, y: number, time: number}>} Recorded gesture points */
        gesturePoints: [],

        /** @private {number} Timestamp when gesture recording started */
        startTime: 0,

        /** @private {HTMLElement|null} PAC container where gesture was initiated */
        gestureContainer: null,

        /** @private {boolean} Whether gesture was dispatched to msgProc */
        gestureJustDispatched: false,

        /** @private {boolean} Whether last gesture was prevented by msgProc */
        lastGesturePrevented: false,

        // Configuration constants

        /** @constant {number} Minimum distance in pixels between recorded points (filters jitter) */
        MIN_DISTANCE: 10,

        /** @constant {number} Minimum length in pixels for a directional segment to be recognized */
        MIN_SEGMENT_LENGTH: 30,

        /** @constant {number} Direction classification threshold (cos 45° ≈ 0.7) */
        DIRECTION_THRESHOLD: 0.7,

        /** @constant {number} Maximum gesture duration in milliseconds */
        MAX_GESTURE_TIME: 2000,

        /**
         * Gesture pattern registry
         * Maps pattern names to arrays of directions: R (right), L (left), U (up), D (down)
         * Users can add custom patterns via registerPattern()
         * @type {Object<string, string[]>}
         */
        patterns: {
            // Single directions
            'right': ['R'],
            'left': ['L'],
            'up': ['U'],
            'down': ['D'],

            // Common L-shapes
            'L': ['D', 'R'],
            'inverted-L': ['D', 'L'],
        },

        /**
         * Registers a custom gesture pattern
         * Allows users to define their own gesture shortcuts
         * @param {string} name - Name for the pattern (e.g., "back", "forward", "refresh")
         * @param {string[]} directions - Array of direction codes: 'R', 'L', 'U', 'D'
         * @throws {Error} If name or directions are invalid
         */
        registerPattern(name, directions) {
            // Validate name
            if (!name || typeof name !== 'string') {
                throw new Error('Gesture pattern name must be a non-empty string');
            }

            // Validate directions array
            if (!Array.isArray(directions) || directions.length === 0) {
                throw new Error('Gesture directions must be a non-empty array');
            }

            // Validate each direction
            const validDirections = ['R', 'L', 'U', 'D'];
            for (let i = 0; i < directions.length; i++) {
                if (!validDirections.includes(directions[i])) {
                    throw new Error(`Invalid direction "${directions[i]}". Must be one of: R, L, U, D`);
                }
            }

            // Warn if overriding existing pattern
            if (this.patterns[name]) {
                console.warn(`WakaPAC: Overriding existing gesture pattern '${name}'`);
            }

            // Register the pattern
            this.patterns[name] = directions;
        },

        /**
         * Removes a registered gesture pattern
         * @param {string} name - Name of the pattern to remove
         * @returns {boolean} True if pattern was removed, false if not found
         */
        unregisterPattern(name) {
            const exists = name in this.patterns;

            if (exists) {
                delete this.patterns[name];
            }

            return exists;
        },

        /**
         * Begins recording a new gesture
         * Called when right mouse button is pressed
         * @param {MouseEvent} event - The mousedown event
         * @returns {void}
         */
        startRecording(event) {
            // Find which PAC container this gesture is happening in
            this.gestureContainer = this.findContainer(event.target);

            // Enable recording mode
            this.isRecording = true;

            // Initialize points array with starting position
            this.gesturePoints = [{
                x: event.clientX,
                y: event.clientY,
                time: Date.now()
            }];

            // Record when gesture started for duration calculation
            this.startTime = Date.now();
        },

        /**
         * Records a point along the gesture path
         * Only records if moved far enough from last point to filter out jitter
         * @param {Event} event - The mousemove event
         * @returns {void}
         */
        recordPoint(event) {
            // Get the most recent recorded point
            const lastPoint = this.gesturePoints[this.gesturePoints.length - 1];

            // Calculate distance from last point
            const dx = event.clientX - lastPoint.x;
            const dy = event.clientY - lastPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only record if moved enough distance to avoid recording jitter
            // This creates a cleaner path with fewer redundant points
            if (distance >= this.MIN_DISTANCE) {
                this.gesturePoints.push({
                    x: event.clientX,
                    y: event.clientY,
                    time: Date.now()
                });
            }
        },

        /**
         * Stops recording and analyzes the gesture
         * Called when right mouse button is released
         * @param {MouseEvent} event - The mouseup event
         * @returns {void}
         */
        stopRecording(event) {
            // Disable recording mode
            this.isRecording = false;

            // Calculate how long the gesture took
            const duration = Date.now() - this.startTime;

            // Validate gesture:
            // - Need at least 2 points to form a direction
            // - Duration must be reasonable (not too slow)
            if (this.gesturePoints.length < 2 || duration > this.MAX_GESTURE_TIME) {
                this.gesturePoints = [];
                return;
            }

            // Convert raw point path into directional segments (R, L, U, D)
            const directions = this.extractDirections();

            // If no valid directions detected, abort
            if (directions.length === 0) {
                this.gesturePoints = [];
                return;
            }

            // Try to match the direction sequence against known patterns
            const pattern = this.matchPattern(directions);

            // Mark that a gesture was attempted (even if unrecognized)
            // This tells contextmenu handler to suppress the menu
            this.gestureJustDispatched = true;

            // Dispatch gesture event if we have a pattern and a container
            if (pattern && this.gestureContainer) {
                this.dispatchGesture(event, pattern, directions);
            }

            // Clean up for next gesture
            this.gesturePoints = [];
            this.gestureContainer = null;
        },

        /**
         * Extracts directional segments from raw gesture points
         * Analyzes direction between consecutive points, then groups into segments
         * @returns {string[]} Array of direction codes: 'R', 'L', 'U', 'D'
         */
        extractDirections() {
            if (this.gesturePoints.length < 2) {
                return [];
            }

            const segments = [];
            const minLengthSq = this.MIN_SEGMENT_LENGTH * this.MIN_SEGMENT_LENGTH; // Avoid repeated sqrt

            let segmentStart = this.gesturePoints[0];
            let segmentEnd = this.gesturePoints[0];
            let currentDir = null;

            for (let i = 1; i < this.gesturePoints.length; i++) {
                const curr = this.gesturePoints[i];
                const dx = curr.x - this.gesturePoints[i - 1].x;
                const dy = curr.y - this.gesturePoints[i - 1].y;
                const direction = this.getDirection(dx, dy);

                if (!direction) continue;

                if (direction === currentDir) {
                    segmentEnd = curr;
                } else {
                    // Save previous segment if long enough
                    if (currentDir !== null) {
                        const sdx = segmentEnd.x - segmentStart.x;
                        const sdy = segmentEnd.y - segmentStart.y;

                        if (sdx * sdx + sdy * sdy >= minLengthSq) {
                            segments.push(currentDir);
                        }
                    }

                    // Start new segment
                    currentDir = direction;
                    segmentStart = segmentEnd;
                    segmentEnd = curr;
                }
            }

            // Handle final segment
            if (currentDir !== null) {
                const dx = segmentEnd.x - segmentStart.x;
                const dy = segmentEnd.y - segmentStart.y;

                if (dx * dx + dy * dy >= minLengthSq) {
                    segments.push(currentDir);
                }
            }

            return segments;
        },

        /**
         * Classifies a movement vector into a cardinal direction
         * Uses squared magnitudes to avoid expensive sqrt/normalization
         * @param {number} dx - Horizontal movement (positive = right)
         * @param {number} dy - Vertical movement (positive = down, screen coordinates)
         * @returns {string|null} Direction code ('R', 'L', 'U', 'D') or null if invalid
         */
        getDirection(dx, dy) {
            // Zero-length movement has no direction
            if (dx === 0 && dy === 0) {
                return null;
            }

            // Square both components to work with magnitudes without expensive sqrt
            // Comparing x² vs y² is equivalent to comparing |x| vs |y|
            const dxSq = dx * dx;
            const dySq = dy * dy;

            // For threshold 0.7: we need the dominant axis to satisfy:
            // dominant² > (1 - 0.7²) / 0.7² * other²
            // Which simplifies to: dominant² > 1.0408 * other²
            // Precompute: (1 - 0.49) / 0.49 = 0.51 / 0.49 ≈ 1.0408
            const thresholdSq = this.DIRECTION_THRESHOLD * this.DIRECTION_THRESHOLD;
            const minRatio = (1 - thresholdSq) / thresholdSq;

            // Check for pure cardinal directions (one axis strongly dominant)
            if (dxSq > minRatio * dySq) {
                return dx > 0 ? 'R' : 'L';
            } else if (dySq > minRatio * dxSq) {
                return dy > 0 ? 'D' : 'U';
            } else if (dx > 0) {
                return dxSq > dySq ? 'R' : (dy > 0 ? 'D' : 'U');
            } else {
                return dxSq > dySq ? 'L' : (dy > 0 ? 'D' : 'U');
            }
        },

        /**
         * Matches a direction sequence against known patterns
         * Tries to find a named pattern, otherwise returns raw direction string
         * @param {string[]} directions - Array of direction codes from extractDirections()
         * @returns {string|null} Pattern name (e.g., "L", "inverted-L") or null if none found
         */
        matchPattern(directions) {
            // Implode directions into one string
            const directionString = directions.join('');

            // Search through all known patterns
            // Using for...in avoids creating entry arrays
            for (const patternName in this.patterns) {
                if (this.patterns[patternName].join('') === directionString) {
                    return patternName;
                }
            }

            // No match found - return null to indicate unrecognized gesture
            return null;
        },

        /**
         * Finds the containing PAC component for an element
         * Walks up the DOM tree to find a registered PAC container
         * @param {HTMLElement} element - Starting element (typically event.target)
         * @returns {HTMLElement|null} The PAC container element or null if not found
         */
        findContainer(element) {
            // Ensure we start with an actual Element node
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                element = element?.parentElement;
            }

            while (element && element !== document.body) {
                const pacId = element.getAttribute('data-pac-id');

                if (pacId) {
                    const context = window.PACRegistry.get(pacId);

                    if (context) {
                        return context.container;
                    }
                }

                element = element.parentElement;
            }

            return null;
        },

        /**
         * Dispatches a gesture event to the PAC container
         * Creates a pac:event with MSG_GESTURE and all gesture data
         * @param {MouseEvent} originalEvent - The original mouseup event
         * @param {string} pattern - Matched pattern name (e.g., "L", "inverted-L")
         * @param {string[]} directions - Array of direction codes used in matching
         * @returns {void}
         */
        dispatchGesture(originalEvent, pattern, directions) {
            const points = this.gesturePoints;
            const pointCount = points.length;
            const now = Date.now();

            // Calculate gesture bounds in viewport coordinates
            // Single-pass min/max to avoid multiple array iterations
            let minX = points[0].x, maxX = minX;
            let minY = points[0].y, maxY = minY;

            for (let i = 1; i < pointCount; i++) {
                const { x, y } = points[i];
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }

            // Convert all coordinates from viewport-relative to container-relative
            // This makes gesture coordinates match mouse event coordinates in msgProc
            const rect = this.gestureContainer.getBoundingClientRect();
            const toRelativeX = x => x - rect.left;
            const toRelativeY = y => y - rect.top;

            // Calculate gesture center for lParam (Win32 standard packing: Y in high word, X in low word)
            // Clamp to 16-bit range (0-65535) to prevent overflow in bitwise operations
            const centerX = Math.max(0, Math.min(65535, Math.round((minX + maxX) / 2 - rect.left)));
            const centerY = Math.max(0, Math.min(65535, Math.round((minY + maxY) / 2 - rect.top)));

            // Convert gesture start/end points to container-relative
            const startX = toRelativeX(points[0].x);
            const startY = toRelativeY(points[0].y);
            const endX = toRelativeX(points[pointCount - 1].x);
            const endY = toRelativeY(points[pointCount - 1].y);

            // Convert bounds to container-relative (DOMRect-like format)
            const left = toRelativeX(minX);
            const top = toRelativeY(minY);
            const width = maxX - minX;  // Width/height are same in both coordinate systems
            const height = maxY - minY;

            // lParam data: packed center coordinates (Y high word, X low word)
            const lParam = (centerY << 16) | centerX; //

            // Build the event using the standard factory
            const customEvent = DomUpdateTracker.wrapDomEventAsMessage(MSG_GESTURE, originalEvent, 0, lParam, {
                pattern,      // Matched pattern name (e.g. 'back') or raw direction string if unregistered
                directions,   // Array of direction codes used in matching: ['R', 'D', 'L']
                pointCount,   // Number of recorded points along the gesture path
                startX,       // Where gesture started (container-relative)
                startY,
                endX,         // Where gesture ended (container-relative)
                endY,
                duration: now - this.startTime, // Milliseconds from mousedown to mouseup
                bounds: {                        // Bounding box of the drawn path (DOMRect format)
                    x: left,                     // Alias for left
                    y: top,                      // Alias for top
                    left,
                    top,
                    right: left + width,
                    bottom: top + height,
                    width,
                    height,
                },
            });

            // Dispatch to the container where gesture was initiated
            DomUpdateTracker.dispatchToContainer(this.gestureContainer, customEvent);
        }
    };

    // =============================================================================
    // COMPONENT REGISTRY
    // =============================================================================

    /**
     * Global registry for managing PAC components and their hierarchical relationships
     */
    function ComponentRegistry() {
        /** @type {Map<string, Context>} All registered components indexed by pac-id */
        this.components = new Map();

        /** @type {Set<Context>} Components waiting for hierarchy establishment */
        this.pendingHierarchy = new Set();

        /**
         * Debounced wrapper around establishAllHierarchies().
         * Batches rapid registrations (e.g. from a single wakaPAC() call that mounts
         * many child components) into one hierarchy pass 10 ms after the last one.
         * @type {Function}
         */
        this._scheduleHierarchy = Utils.debounce(() => this.establishAllHierarchies(), 10);
    }

    ComponentRegistry.prototype = {
        /**
         * Registers a new PAC component
         * @param {string} selector - Unique identifier for the component (from data-pac-id)
         * @param {Object} context - The PAC component context object
         */
        register(selector, context) {
            this.components.set(selector, context);
            this.pendingHierarchy.add(context);

            // Batch rapid registrations — hierarchy is established once the burst settles
            this._scheduleHierarchy();
        },

        /**
         * Removes a component from the registry
         * @param {string} id - The pac-id of the component to remove
         */
        deregister(id) {
            const context = this.components.get(id);

            if (context) {
                this.pendingHierarchy.delete(context);
                this.components.delete(id);
            }
        },

        /**
         * Retrieves a registered component by its pac-id
         * @param {string} id - The pac-id of the component to retrieve
         * @returns {Object|undefined} The component context or undefined if not found
         */
        get(id) {
            return this.components.get(id);
        },

        /**
         * Retrieves a PAC instance associated with a DOM element.
         * @param {Element} element - The DOM element to resolve from.
         * @returns {*} The associated PAC instance, or null if not found.
         */
        getByElement(element) {
            const container = element.closest(CONTAINER_SEL);
            const pacId = container?.getAttribute('data-pac-id');
            return pacId ? this.get(pacId) : undefined;
        },

        /**
         * Processes all pending components to establish their parent-child relationships.
         *
         * Builds a fresh hierarchy map and assigns parent/children to each pending component.
         *
         * This method handles cascading component registrations by:
         * 1. Building hierarchy map for all components
         * 2. Processing all currently pending components in a batch
         * 3. Detecting if new components were registered during processing
         * 4. Scheduling another round if needed to handle the new components
         *
         * The recursive processing continues until no new components are added,
         * ensuring all components eventually get their hierarchy established even
         * when parent components dynamically create child components.
         *
         * @returns {void}
         */
        establishAllHierarchies() {
            // Nothing to do if no components are waiting
            if (this.pendingHierarchy.size === 0) {
                return;
            }

            // Build fresh hierarchy map for all components
            const hierarchyMap = this.buildHierarchyMap();

            // Snapshot the current pending components before clearing
            // This prevents infinite loops from components added during processing
            const componentsToProcess = Array.from(this.pendingHierarchy);
            this.pendingHierarchy.clear();

            // Establish hierarchy for each component
            // Note: This may trigger registration of new child components
            componentsToProcess.forEach(component => {
                const hierarchy = hierarchyMap.get(component.container);

                if (hierarchy) {
                    component.establishHierarchy(hierarchy.parent, hierarchy.children);
                } else {
                    component.establishHierarchy(null, []);
                }
            });

            // Check if any new components were registered during processing
            // This happens when parent components dynamically create children
            if (this.pendingHierarchy.size > 0) {
                // Schedule another pass — _scheduleHierarchy() will debounce any
                // additional registrations that arrive before the 10 ms window closes
                this._scheduleHierarchy();
            }
        },

        /**
         * Builds complete hierarchy map for all components in a single DOM traversal
         *
         * Algorithm:
         * 1. Creates a lookup index mapping container elements to components
         * 2. For each component, walks up the DOM tree to find its parent component
         * 3. Builds bidirectional parent-child relationships in the hierarchy map
         *
         * The resulting map contains entries for every component, where each entry has:
         * - parent: The parent component (or null if top-level)
         * - children: Array of direct child components
         *
         * Time complexity: O(n) where n is the number of components
         * Space complexity: O(n) for the hierarchy map and container index
         *
         * @returns {Map<Element, {parent: Context|null, children: Context[]}>} Complete hierarchy map
         */
        buildHierarchyMap() {
            // Step 1: Create fast lookup index - container element -> component
            // Enables constant-time parent detection during hierarchy building
            const containerMap = new Map();
            this.components.forEach(component => {
                containerMap.set(component.container, component);
            });

            // Step 2: Build hierarchy map with parent and children for each component
            const hierarchyMap = new Map();

            this.components.forEach(component => {
                const container = component.container;

                // Walk up DOM tree to find parent component
                // Stops at first PAC container found (closest parent)
                let parent = null;
                let element = container.parentElement;

                while (element) {
                    // Check if this element is a PAC container
                    if (containerMap.has(element)) {
                        parent = containerMap.get(element);
                        break;
                    }

                    element = element.parentElement;
                }

                // Initialize hierarchy entry for this component
                if (!hierarchyMap.has(container)) {
                    hierarchyMap.set(container, { parent: null, children: [] });
                }

                const hierarchy = hierarchyMap.get(container);
                hierarchy.parent = parent;

                // Add this component as child to its parent
                if (parent) {
                    // Ensure parent has hierarchy entry
                    if (!hierarchyMap.has(parent.container)) {
                        hierarchyMap.set(parent.container, { parent: null, children: [] });
                    }

                    // Add to parent's children array
                    hierarchyMap.get(parent.container).children.push(component);
                }
            });

            return hierarchyMap;
        }
    };

    // ========================================================================
    // ACCELERATOR TABLES
    // ========================================================================
    /**
     * Accelerator table registry.
     * Keys are pac-id strings (or the sentinel value ACCEL_GLOBAL_KEY for the
     * application-wide table).  Values are arrays of accelerator descriptors:
     *   { vk, modifiers, cmdId }
     *   vk        — Win32 virtual key code (number)
     *   modifiers — bitmask of ACCEL_* flags (see below)
     *   cmdId     — command identifier posted in wParam of MSG_ACCEL
     * @type {Map<string|symbol, Array<{vk:number, modifiers:number, cmdId:number}>>}
     */
    const _accelTables = new Map();

    /**
     * Sentinel key used to store the application-wide (global) accelerator table.
     * A global table fires regardless of which container currently has focus.
     * Container-scoped tables take priority over the global table.
     * @type {symbol}
     */
    const ACCEL_GLOBAL_KEY = Symbol('global');

    /**
     * Returns the ordered list of accelerator tables to search for a container,
     * walking up the hierarchy innermost-first with the global table as fallback.
     * @param {HTMLElement} container
     * @returns {Array}
     * @private
     */
    function _accelTablesForContainer(container) {
        const tables = [];

        // Walk up the container hierarchy, innermost first.
        // Uses closest() on parentElement to skip non-container ancestors in one step.
        for (let el = container; el; el = el.parentElement?.closest(CONTAINER_SEL)) {
            // Fetch pacId
            const id = el.getAttribute('data-pac-id');

            // Use !== null rather than truthiness to correctly handle id="0" or id=""
            if (id !== null) {
                const table = _accelTables.get(id);

                if (table) {
                    tables.push(table);
                }
            }
        }

        // Append the global table last so local bindings always take precedence.
        const global = _accelTables.get(ACCEL_GLOBAL_KEY);

        if (global) {
            tables.push(global);
        }

        return tables;
    }

    /**
     * Translates a MSG_KEYDOWN event into MSG_ACCEL if the key combination
     * matches a registered accelerator entry. Tables are checked innermost-first
     * by walking up the container hierarchy, with the global table as final fallback.
     * Returns true and dispatches MSG_ACCEL on a match (suppressing the keydown);
     * returns false otherwise.
     * @param {CustomEvent}  pacEvent  — The MSG_KEYDOWN PAC event.
     * @param {HTMLElement}  container — The target container element.
     * @returns {boolean} True if the message was translated (caller should swallow it).
     * @private
     */
    function _translateAccelerator(pacEvent, container) {
        // Skip immediately if no tables are registered — common case when the
        // feature is not in use.
        if (_accelTables.size === 0) {
            return false;
        }

        // wParam carries the virtual key code for keyboard messages
        const vk = pacEvent.wParam;

        // Isolate the modifier bits from lParam — other bits carry repeat count,
        // extended key flag, etc. and must not affect the comparison.
        const modifiers = pacEvent.lParam & (KM_SHIFT | KM_CONTROL | KM_ALT);

        // Fetch the pacId from the container
        const pacId = container._pacId || container.getAttribute('data-pac-id');

        // Fetch accelerator tables of this container and parent containers
        const tables = _accelTablesForContainer(container);

        // Walk them to map accelerators
        for (const table of tables) {
            if (!table) {
                continue;
            }

            for (const entry of table) {
                // Both the key code and the exact modifier combination must match.
                // Partial modifier matches are intentionally rejected — Ctrl+Shift+S
                // must not trigger a Ctrl+S entry.
                if (entry.vk === vk && entry.modifiers === modifiers) {
                    wakaPAC.sendMessage(pacId, MSG_ACCEL, entry.cmdId, 0);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Parses a shortcut string into a { vk, modifiers } descriptor.
     * @param {string} key - Shortcut string, e.g. "Ctrl+S", "Ctrl+Shift+Z", "F5"
     * @returns {{ vk: number, modifiers: number }}
     * @throws {TypeError} If the string is empty, the key name is missing or unknown, or more than one key name is present.
     * @private
     */
    function _parseAcceleratorKey(key) {
        // Reject early so the rest of the function can assume a non-empty string
        if (typeof key !== 'string' || key.trim() === '') {
            throw new TypeError(`wakaPAC: accelerator key must be a non-empty string, got: ${JSON.stringify(key)}`);
        }

        // Map the three recognised modifier names to their KM_* bitmask values
        const MODIFIER_TOKENS = { CTRL: KM_CONTROL, SHIFT: KM_SHIFT, ALT: KM_ALT };

        // Split on "+" and trim each token to tolerate "Ctrl + S" as well as "Ctrl+S"
        const tokens = key.split('+').map(t => t.trim());

        // Consume all but the last token as modifiers. Iterating up to length - 1
        // means the final token is always treated as the key name, which makes
        // the two phases structurally separate rather than distinguished by a flag.
        let i = 0;
        let modifiers = 0;

        while (i < tokens.length - 1) {
            // Isolate bit
            const bit = MODIFIER_TOKENS[tokens[i].toUpperCase()];

            // Any non-modifier token in this position is a mistake — the key name
            // must come last, so an unknown token here can't be anything valid.
            if (!bit) {
                throw new TypeError(`wakaPAC: unknown token "${tokens[i]}" in accelerator key: ${JSON.stringify(key)}`);
            }

            modifiers |= bit;
            i++;
        }

        // Whatever remains after the modifiers is the key name
        const keyName = tokens[i];

        if (!keyName) {
            throw new TypeError(`wakaPAC: no key name found in accelerator key: ${JSON.stringify(key)}`);
        }

        // Look up the VK_* constant by prepending the prefix and uppercasing,
        // so "s", "S", and "s" all resolve to VK_S
        const vkName = 'VK_' + keyName.toUpperCase();

        if (!(vkName in wakaPAC)) {
            throw new TypeError(`wakaPAC: unknown key "${keyName}" in accelerator key: ${JSON.stringify(key)} (no constant ${vkName})`);
        }

        return { vk: wakaPAC[vkName], modifiers };
    }

    // ========================================================================
    // PAINT INVALIDATION ENGINE
    // ========================================================================

    /**
     * Tracks canvas containers that have been invalidated and are waiting for
     * their MSG_PAINT to be dispatched on the next animation frame.
     *
     * Key:   pacId (string)
     * Value: {
     *   container: HTMLCanvasElement,
     *   rcPaint:   {x, y, width, height}  — union of all dirty rects; used by getDC() for clipping
     *   rects:     [{x, y, width, height}] — list of discrete dirty rects; exposed via getUpdateRgn()
     * }
     *
     * A container is present in this map if and only if a rAF flush is already
     * scheduled for it. Multiple invalidateRect() calls before the next frame
     * are accumulated: rcPaint grows as the bounding union, while rects collects
     * each distinct incoming rectangle (absorbed duplicates are dropped).
     *
     * @type {Map<string, {container: HTMLCanvasElement, rcPaint: {x:number, y:number, width:number, height:number}, rects: Array<{x:number, y:number, width:number, height:number}>}>}
     */
    const _dirtyCanvases = new Map();

    /**
     * Tracks active render loops for WebGL canvas components registered with renderLoop: true.
     * Key:   pacId (string)
     * Value: rAF handle (number) — the return value of the most recent requestAnimationFrame call,
     *        used to cancel the loop via cancelAnimationFrame() when the component is destroyed.
     * @type {Map<string, number>}
     */
    const _renderLoops = new Map();

    /**
     * Dispatches MSG_PAINT to all invalidated canvas containers, then clears
     * the dirty set. Called once per animation frame by requestAnimationFrame.
     */
    function _flushPaintQueue() {
        _dirtyCanvases.forEach(function(entry) {
            const { container } = entry;

            // Skip containers that were removed from the DOM before the frame fired
            if (!container.isConnected) {
                return;
            }

            // Mark as actively painting so getDC() knows to apply the clip
            entry.painting = true;

            DomUpdateTracker.dispatchToContainer(container, DomUpdateTracker.wrapDomEventAsMessage(
                MSG_PAINT,
                null,   // No originating DOM event
                0,      // wParam unused
                0       // lParam unused
            ));

            // Clear the painting flag — releaseDC() uses this to decide whether
            // to restore the context state
            entry.painting = false;
        });

        _dirtyCanvases.clear();
    }

    /**
     * Marks a canvas PAC container as needing repaint and schedules a
     * requestAnimationFrame flush if one is not already pending.
     *
     * Multiple calls with different rects before the next frame are accumulated
     * into a dirty region: rcPaint tracks the bounding union (used by getDC()
     * for clipping), while rects collects each distinct incoming rectangle for
     * getUpdateRgn(). Incoming rects that are fully contained within an
     * already-queued rect are dropped to keep the list compact.
     *
     * @param {string} pacId  - data-pac-id of the target canvas container
     * @param {{x:number, y:number, width:number, height:number}|null} [rect]
     *   Rectangle to invalidate in canvas-local coordinates.
     *   Pass null (or omit) to invalidate the entire canvas.
     * @returns {void}
     */
    function _invalidateRect(pacId, rect) {
        // Fetch the container
        const container = wakaPAC.getContainerByPacId(pacId);

        // If not found, bail
        if (!container) {
            return;
        }

        // Do nothing if the container is not a canvas
        if (!(container instanceof HTMLCanvasElement)) {
            return;
        }

        // Normalize: null rect means the whole canvas
        const fullRect = {
            x: 0,
            y: 0,
            width: container.width,
            height: container.height
        };

        // Fetch the rect or default to the entire canvas if omitted
        const incoming = rect || fullRect;

        // Queue the repaint
        if (_dirtyCanvases.has(pacId)) {
            const existing = _dirtyCanvases.get(pacId);

            // If the canvas is already fully invalidated there is nothing more to accumulate
            if (existing.rcPaint.x === 0 && existing.rcPaint.y === 0 &&
                existing.rcPaint.width === container.width &&
                existing.rcPaint.height === container.height) {
                return;
            }

            // Drop the incoming rect if it is fully contained within any rect already
            // in the list — it adds no new dirty area
            const absorbed = existing.rects.some(r =>
                incoming.x >= r.x &&
                incoming.y >= r.y &&
                incoming.x + incoming.width <= r.x + r.width &&
                incoming.y + incoming.height <= r.y + r.height
            );

            if (!absorbed) {
                existing.rects.push(incoming);
                existing.rcPaint = Utils.unionRect(existing.rcPaint, incoming);
            }
        } else {
            // First invalidation this frame — schedule the flush
            _dirtyCanvases.set(pacId, { container, rcPaint: incoming, rects: [incoming] });
            requestAnimationFrame(_flushPaintQueue);
        }
    }

    // ========================================================================
    // PAINT INTERNAL HELPERS
    // ========================================================================

    /**
     * Returns true if the given rendering context is a WebGL or WebGL2 context.
     * @param {RenderingContext} ctx
     * @returns {boolean}
     */
    function _isWebGLContext(ctx) {
        return ctx instanceof WebGLRenderingContext || ctx instanceof WebGL2RenderingContext;
    }

    /**
     * Copies srcCanvas onto a 2D destDC using drawImage.
     * For WebGL sources, the source canvas must have been created with
     * preserveDrawingBuffer: true in its glAttributes, otherwise the drawing
     * buffer will have been cleared by the browser after compositing and the
     * copy will produce a blank result.
     * @param {CanvasRenderingContext2D} destCtx2D
     * @param {HTMLCanvasElement} srcCanvas
     * @param {number} sx - Source X
     * @param {number} sy - Source Y
     * @param {number} sw - Source width
     * @param {number} sh - Source height
     * @param {number} dx - Destination X
     * @param {number} dy - Destination Y
     * @param {number} dw - Destination width
     * @param {number} dh - Destination height
     */
    function _blitToCanvas2D(destCtx2D, srcCanvas, sx, sy, sw, sh, dx, dy, dw, dh) {
        destCtx2D.drawImage(srcCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    /**
     * Copies a source canvas onto a WebGL destination as a texture bound to
     * the currently active texture unit. The caller is responsible for binding
     * the target texture before calling this function.
     * @param {WebGLRenderingContext|WebGL2RenderingContext} destGL
     * @param {HTMLCanvasElement} srcCanvas
     */
    function _blitToWebGL(destGL, srcCanvas) {
        destGL.texImage2D(
            destGL.TEXTURE_2D,
            0,                  // mip level
            destGL.RGBA,             // internal format
            destGL.RGBA,             // format
            destGL.UNSIGNED_BYTE,
            srcCanvas
        );
    }

    // ========================================================================
    // STDLIB — built-in unit
    // ========================================================================

    _registerUnit({
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

                    beep: (() => {
                        /** Shared AudioContext — created once on first beep(), reused thereafter. */
                        let _audioCtx = null;

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
                        return (frequency = 440, duration = 200, volume = 0.5, type = 'square') => {
                            // Create or reuse the shared AudioContext
                            if (!_audioCtx || _audioCtx.state === 'closed') {
                                _audioCtx = new AudioContext();
                            }

                            const oscillator = _audioCtx.createOscillator();
                            const gain       = _audioCtx.createGain();

                            oscillator.connect(gain);
                            gain.connect(_audioCtx.destination);

                            oscillator.type            = type;
                            oscillator.frequency.value = frequency;
                            gain.gain.value            = volume;

                            oscillator.start();
                            oscillator.stop(_audioCtx.currentTime + duration / 1000);
                        };
                    })(),

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
                     * Returns the pac-id of the parent component of the given container, or null if none.
                     * Equivalent to calling wakaPAC.getParentPacId() directly, but usable
                     * in binding expressions via data-pac-bind.
                     * @param {string} pacId            - The data-pac-id of the child component
                     * @returns {string|null}
                     */
                    getParentPacId: (pacId) => {
                        return wakaPAC.getParentPacId(pacId);
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
    });

    // ========================================================================
    // MAIN FRAMEWORK
    // ========================================================================

    /**
     * Creates reactive PAC (Presentation-Abstraction-Control) components
     * @param {string} selector - CSS selector ('#id' returns single, '.class' returns array)
     * @param {Object} [abstraction={}] - Reactive data model with properties and methods
     * @param {Object} [options={}] - Configuration options
     * @returns {Object|Object[]|undefined} Single abstraction for ID, array for class/tag selectors
     */
    function wakaPAC(selector, abstraction = {}, options = {}) {
        // Collect data-pac-partial elements from the document (once only)
        collectPartials();

        // Initialize global event tracking first
        DomUpdateTracker.initialize();

        // Initialize automatic cleanup observer
        CleanupObserver.initialize();

        // Allow passing a pac-id directly instead of a CSS selector
        const originalSelector = selector;
        let isPacId = false;

        if (
            !selector.startsWith('#') &&
            !selector.startsWith('.') &&
            !selector.startsWith('[') &&
            !/\s/.test(selector)
        ) {
            selector = `[data-pac-id="${selector}"]`;
            isPacId = true;
        }

        // Fetch all matching elements (supports both ID and class selectors)
        const containers = document.querySelectorAll(selector);

        // Determine if selector is for multiple elements (class, attribute, tag)
        const isMultiSelector = !selector.startsWith('#') && !isPacId;

        if (containers.length === 0) {
            console.warn(`wakaPAC: No elements found for selector "${originalSelector}"`);
            return isMultiSelector ? [] : undefined;
        }

        // Process each container and collect abstractions
        const abstractions = [];

        containers.forEach(container => {
            // Get or generate pac-id
            let pacId = container.getAttribute('data-pac-id');

            if (!pacId) {
                // Use element's id if available, otherwise generate random id
                pacId = container.id || Utils.uniqid('pac-');
                container.setAttribute('data-pac-id', pacId);
            }

            // Cache on the element itself so dispatchToContainer can read it without
            // a DOM attribute lookup on every message dispatch
            container._pacId = pacId;

            // Check if component already exists for this container
            // If so, return existing abstraction instead of creating new one
            const existingComponent = window.PACRegistry.get(pacId);

            if (existingComponent) {
                abstractions.push(existingComponent.abstraction);
                return; // Skip to next container
            }

            // Merge configuration
            const config = Object.assign({
                updateMode: 'immediate',
                delay: 300
            }, options);

            // Create a per-container copy so hydration does not bleed across containers
            const containerAbstraction = isMultiSelector ? Object.assign({}, abstraction) : abstraction;

            // Hydrate fields into abstraction before context is created
            if (config?.hydrate === true) {
                // Read initial state from data-pac-state attribute if present
                const pacState = container.dataset.pacState;

                if (pacState) {
                    try {
                        Object.assign(abstraction, JSON.parse(pacState));
                    } catch (e) {
                        console.warn('WakaPAC: Failed to parse data-pac-state:', e);
                    }
                }

                // Scan data-pac-field elements and add to abstraction
                container.querySelectorAll('[data-pac-field]').forEach(el => {
                    // Element belongs to another container. Skip.
                    if (!Utils.belongsToPacContainer(container, el)) {
                        return;
                    }

                    // Fetch name attribute
                    const name = el.getAttribute('name');

                    // No name attribute exists. Skip.
                    if (!name) {
                        return;
                    }

                    switch (el.type) {
                        case 'checkbox':
                            // Read checked state as boolean
                            Utils.setNestedProperty(name, el.checked, abstraction);
                            break;

                        case 'number':
                        case 'range':
                            // Convert numeric input values to actual numbers
                            Utils.setNestedProperty(name, el.value !== '' ? Number(el.value) : '', abstraction);
                            break;

                        case 'radio':
                            // Initialize the group property with an empty string on first encounter
                            if (Utils.getNestedValue(abstraction, name) === undefined) {
                                Utils.setNestedProperty(name, '', abstraction);
                            }

                            // Only overwrite if this radio button is the selected one
                            if (el.checked) {
                                Utils.setNestedProperty(name, el.value, abstraction);
                            }

                            break;

                        case 'file':
                            // File inputs cannot be hydrated — skip
                            break;

                        default:
                            // For all other field types, read the current value or fall back to the HTML attribute
                            Utils.setNestedProperty(name, el.value ?? el.getAttribute('value'), abstraction);
                            break;
                    }
                });
            }

            // Create context for this container
            const context = new Context(container, containerAbstraction, config);

            // Register using pac-id as key (not selector)
            window.PACRegistry.register(pacId, context);

            // Let plugins augment the component
            _plugins.forEach(function(plugin) {
                if (typeof plugin.onComponentCreated === 'function') {
                    plugin.onComponentCreated(context.abstraction, pacId, context.config);
                }
            });

            // Call init() method if it exists after all setup is complete
            if (
                context.abstraction.init &&
                typeof context.abstraction.init === 'function'
            ) {
                try {
                    context.abstraction.init.call(context.abstraction);
                } catch (error) {
                    console.warn('Error in init() method:', error);
                }
            }

            const isCanvasElement = container instanceof HTMLCanvasElement;
            const contextType = isCanvasElement ? (container.dataset.pacContext || '2d') : '2d';

            if (isCanvasElement) {
                // Synchronously flush any paint requests queued during observation
                // to avoid a blank frame before the first animation frame fires.
                // Only applies to 2D canvases — WebGL canvases use MSG_PAINT via
                // the render loop or manage their own redraws.
                if (contextType === '2d') {
                    _invalidateRect(container._pacId);
                    _flushPaintQueue();
                }

                // Setup renderloop for webgl if renderLoop is set to true
                if (contextType !== '2d' && config.renderLoop === true) {
                    const loop = function () {
                        if (!_renderLoops.has(pacId)) {
                            return; // Loop was canceled — component destroyed
                        }

                        // Do not dispatch MSG_PAINT before MSG_WEBGL_READY has been sent —
                        // shaders and GL resources are not yet initialized at that point.
                        const _component = window.PACRegistry.getByElement(container);

                        if (_component && _component._webglReadySent) {
                            DomUpdateTracker.dispatchToContainer(container, DomUpdateTracker.wrapDomEventAsMessage(
                                MSG_PAINT,
                                null,
                                0,
                                0
                            ));
                        }

                        _renderLoops.set(pacId, requestAnimationFrame(loop));
                    };

                    _renderLoops.set(pacId, requestAnimationFrame(loop));
                }

                // Attach WebGL context loss/restore handlers for all WebGL canvases,
                // regardless of whether renderLoop is active.
                if (contextType !== '2d') {
                    container.addEventListener('webglcontextlost', function (e) {
                        // Calling preventDefault() is required — without it the browser
                        // will not attempt to restore the context after it is lost.
                        e.preventDefault();

                        // Pause the render loop while the context is unavailable.
                        // Dispatching MSG_PAINT to a lost context produces GL errors and
                        // is meaningless — suspend the loop until the context is restored.
                        if (_renderLoops.has(pacId)) {
                            cancelAnimationFrame(_renderLoops.get(pacId));
                            // Use a sentinel value to indicate suspended (not destroyed).
                            // The loop check uses _renderLoops.has(), so we must keep the
                            // key present to allow resumption on restore.
                            _renderLoops.set(pacId, null);
                        }

                        // Notify the component so it can null out all GL resource handles.
                        // All WebGL objects (buffers, textures, programs, etc.) are invalid
                        // after context loss and must not be used until MSG_WEBGL_CONTEXT_RESTORED.
                        DomUpdateTracker.dispatchToContainer(container, DomUpdateTracker.wrapDomEventAsMessage(
                            MSG_WEBGL_CONTEXT_LOST,
                            e,
                            0,
                            0
                        ));
                    });

                    container.addEventListener('webglcontextrestored', function (e) {
                        // The context has been recreated by the browser — all GL resources
                        // must be rebuilt from scratch (shaders, buffers, textures, etc.).
                        // Provide the fresh context on event.glContext, mirroring MSG_WEBGL_READY.
                        DomUpdateTracker.dispatchToContainer(container, DomUpdateTracker.wrapDomEventAsMessage(
                            MSG_WEBGL_CONTEXT_RESTORED,
                            e,
                            0,
                            0,
                            {
                                glContext: wakaPAC.getDC(pacId)
                            }
                        ));

                        // Resume the render loop if it was running before context loss.
                        if (_renderLoops.has(pacId) && _renderLoops.get(pacId) === null) {
                            const loop = function () {
                                if (!_renderLoops.has(pacId)) {
                                    return;
                                }

                                DomUpdateTracker.dispatchToContainer(container, DomUpdateTracker.wrapDomEventAsMessage(
                                    MSG_PAINT,
                                    null,
                                    0,
                                    0
                                ));

                                _renderLoops.set(pacId, requestAnimationFrame(loop));
                            };

                            _renderLoops.set(pacId, requestAnimationFrame(loop));
                        }
                    });
                }
            }

            // Signal that a new component is ready
            document.dispatchEvent(new CustomEvent('pac:component-ready', {
                detail: { component: context, selector: selector, pacId: pacId }
            }));

            // Collect the abstraction
            abstractions.push(context.abstraction);
        });

        // Return array for multi-selectors, single abstraction for ID selectors
        return isMultiSelector ? abstractions : abstractions[0];
    }

    /**
     * Create a wakapac CustomEvent carrying Win32-style message data.
     * @param {number} messageId
     * @param {number} wParam
     * @param {number} lParam
     * @param {Object} extended
     * @returns {CustomEvent}
     */
    wakaPAC.createPacMessage = function (messageId, wParam, lParam, extended = {}) {
        // Throw error when extended is not an object
        if (extended !== null && !Utils.isPlainObject(extended)) {
            throw new TypeError(`wakaPAC.createPacMessage(): extended must be a plain object, got ${typeof extended}`);
        }

        // Create a custom wakapac event that carries Win32-style message data.
        const event = new CustomEvent(EV_PAC_EVENT, {
            bubbles: false,
            cancelable: true,
            detail: extended
        });

        // Attach core Win32-style message fields directly to the event object.
        // These are top-level properties to avoid nesting under event.detail
        // and to keep message handling semantics explicit and predictable.
        Object.defineProperties(event, {
            message:   { value: messageId, enumerable: true },
            wParam:    { value: wParam,    enumerable: true },
            lParam:    { value: lParam,    enumerable: true },
            timestamp: { value: Date.now(), enumerable: true }
        });

        // Return the constructed message for delivery by postMessage or sendMessage.
        return event;
    };

    /**
     * Resolve a WakaPAC component by its data-pac-id.
     * @param {string} pacId Identifier of the target container
     * @returns {HTMLElement|null} The resolved container element, or null
     */
    wakaPAC.getContextByPacId = function (pacId) {
        return window.PACRegistry.get(pacId);
    };

    /**
     * Resolve a WakaPAC container element by its data-pac-id.
     * @param {string} pacId Identifier of the target container
     * @returns {HTMLElement|null} The resolved container element, or null
     */
    wakaPAC.getContainerByPacId = function (pacId) {
        const context = window.PACRegistry.get(pacId);

        if (!context) {
            console.warn(`wakaPAC: Container with id "${pacId}" not found`);
            return null;
        }

        return context.container;
    };

    /**
     * Shows a PAC container by removing its HTML hidden attribute.
     * Equivalent to Win32 ShowWindow(hWnd, SW_SHOW).
     * Has no effect if the container is already visible or does not exist.
     * @param {string} pacId - data-pac-id of the target container
     */
    wakaPAC.showContainer = function(pacId) {
        const container = this.getContainerByPacId(pacId);

        if (!container) {
            return;
        }

        container.removeAttribute('hidden');
    };

    /**
     * Hides a PAC container by setting its HTML hidden attribute.
     * Equivalent to Win32 ShowWindow(hWnd, SW_HIDE).
     * The component remains registered and continues to receive messages
     * while hidden — callers are responsible for suppressing irrelevant
     * messages in their msgProc if needed.
     * Has no effect if the container is already hidden or does not exist.
     * @param {string} pacId - data-pac-id of the target container
     */
    wakaPAC.hideContainer = function(pacId) {
        const container = this.getContainerByPacId(pacId);

        if (!container) {
            return;
        }

        container.setAttribute('hidden', '');
    };

    /**
     * Returns the pac-id of the parent component of the given container, or null if none.
     * Equivalent to Win32 GetParent() returning a parent HWND.
     * @param {string} pacId - The data-pac-id of the child container
     * @returns {string|null} The parent's pac-id, or null if the container has no parent
     */
    wakaPAC.getParentPacId = function(pacId) {
        const context = window.PACRegistry.get(pacId);

        if (!context || !context.parent) {
            return null;
        }

        return context.parent.container._pacId || context.parent.container.getAttribute('data-pac-id');
    };

    /**
     * Send a message to a specific WakaPAC container by its data-pac-id
     * Similar to Win32 PostMessage with a specific HWND
     * @param {string} pacId - Target container's data-pac-id attribute value
     * @param {number} messageId - Message identifier (integer constant, e.g., WM_USER + 1)
     * @param {number} wParam - First message parameter (integer)
     * @param {number} lParam - Second message parameter (integer)
     * @param {Object} [extended={}] - Additional data stored in event.detail for custom use cases
     */
    wakaPAC.postMessage = function (pacId, messageId, wParam, lParam, extended = {}) {
        // Resolve the target container from the registry.
        // If the container does not exist, the message is dropped.
        const container = this.getContainerByPacId(pacId);

        if (!container) {
            return;
        }

        // Construct a wakapac message object carrying messageId, wParam, and lParam.
        // This does not deliver the message by itself.
        const event = this.createPacMessage(messageId, wParam, lParam, extended);

        // Dispatch the message through the DOM event system.
        // Delivery is asynchronous and follows normal event routing semantics.
        setTimeout(function() {
            if (container.isConnected) {
                DomUpdateTracker.dispatchToContainer(container, event);
            }
        }, 0);
    };

    /**
     * Send a message to a specific WakaPAC container by its data-pac-id
     * Similar to Win32 SendMessage with a specific HWND
     * This bypasses DOM event dispatch and invokes the container’s message procedure directly.
     * @param {string} pacId - Target container's data-pac-id attribute value
     * @param {number} messageId - Message identifier (integer constant, e.g., WM_USER + 1)
     * @param {number} wParam - First message parameter (integer)
     * @param {number} lParam - Second message parameter (integer)
     * @param {Object} [extended={}] - Additional data stored in event.detail for custom use cases
     */
    wakaPAC.sendMessage = function (pacId, messageId, wParam, lParam, extended = {}) {
        // Resolve the target container. If it does not exist, the message is dropped.
        const container = this.getContainerByPacId(pacId);

        if (!container) {
            return;
        }

        // Construct a wakapac message object carrying messageId, wParam, and lParam.
        // This does not dispatch anything by itself.
        const event = this.createPacMessage(messageId, wParam, lParam, extended);

        // Invoke the message procedure directly.
        // This call is synchronous and executes immediately in the current call stack.
        DomUpdateTracker.dispatchToContainer(container, event);
    };

    /**
     * Send a message to the parent component of the given container (synchronous).
     * Similar to Win32 SendMessage directed at the parent HWND.
     * If the container has no parent, the message is dropped.
     * @param {string} pacId - The data-pac-id of the child container
     * @param {number} messageId - Message identifier (integer constant, e.g., WM_USER + 1)
     * @param {number} wParam - First message parameter (integer)
     * @param {number} lParam - Second message parameter (integer)
     * @param {Object} [extended={}] - Additional data stored in event.detail for custom use cases
     */
    wakaPAC.sendMessageToParent = function(pacId, messageId, wParam, lParam, extended = {}) {
        const parentId = this.getParentPacId(pacId);

        if (!parentId) {
            return;
        }

        this.sendMessage(parentId, messageId, wParam, lParam, extended);
    };

    /**
     * Post a message to the parent component of the given container (asynchronous).
     * Similar to Win32 PostMessage directed at the parent HWND.
     * If the container has no parent, the message is dropped.
     * @param {string} pacId - The data-pac-id of the child container
     * @param {number} messageId - Message identifier (integer constant, e.g., WM_USER + 1)
     * @param {number} wParam - First message parameter (integer)
     * @param {number} lParam - Second message parameter (integer)
     * @param {Object} [extended={}] - Additional data stored in event.detail for custom use cases
     */
    wakaPAC.postMessageToParent = function(pacId, messageId, wParam, lParam, extended = {}) {
        const parentId = this.getParentPacId(pacId);

        if (!parentId) {
            return;
        }

        this.postMessage(parentId, messageId, wParam, lParam, extended);
    };

    /**
     * Broadcast a message to all WakaPAC containers.
     * A fresh event object is created for each container so that a hook or
     * msgProc calling preventDefault() on one dispatch cannot affect the rest.
     * @param {number} messageId - Message identifier (integer constant, e.g., WM_USER + 1)
     * @param {number} wParam - First message parameter (integer)
     * @param {number} lParam - Second message parameter (integer)
     * @param {Object} [extended={}] - Additional data stored in event.detail for custom use cases
     */
    wakaPAC.broadcastMessage = function(messageId, wParam, lParam, extended = {}) {
        window.PACRegistry.components.forEach((context) => {
            const event = this.createPacMessage(messageId, wParam, lParam, extended);
            DomUpdateTracker.dispatchToContainer(context.container, event);
        });
    };

    /**
     * Broadcasts a message to all descendant components of the given container,
     * traversing the full subtree depth-first. The container itself does not receive
     * the message — only its children, grandchildren, and so on.
     * @param {string} pacId - data-pac-id of the root container whose subtree receives the message
     * @param {number} messageId - Message identifier (integer constant, e.g., wakaPAC.MSG_USER + 1)
     * @param {number} wParam - First message parameter (integer)
     * @param {number} lParam - Second message parameter (integer)
     * @param {Object} [extended={}] - Additional data stored in 'event.detail' for custom use cases
     */
    wakaPAC.broadcastToChildren = function(pacId, messageId, wParam, lParam, extended = {}) {
        // Resolve the root container. If it does not exist, the broadcast is dropped.
        const container = window.PACRegistry.get(pacId);

        if (!container) {
            return;
        }

        // Iterative breadth-first traversal using a queue.
        // A fresh event object is created for each container so that a hook or
        // msgProc calling preventDefault() on one dispatch cannot affect the rest.
        const queue = [...container.children];

        while (queue.length) {
            const node = queue.shift();
            const event = this.createPacMessage(messageId, wParam, lParam, extended);
            DomUpdateTracker.dispatchToContainer(node.container, event);
            queue.push(...node.children);
        }
    };

    /**
     * Installs a message hook that intercepts all PAC messages before they reach
     * their target container's msgProc. Hooks are called in registration order.
     * @param {Function} fn - Hook function with signature (event, callNextHook) => void
     * @returns {number} Hook handle (hookId) — pass to uninstallMessageHook() to remove
     */
    wakaPAC.installMessageHook = function(fn) {
        // Assign the current counter value as the unique handle, then increment
        // for the next registration. Handles are never reused.
        const handle = _nextHookHandle++;

        // Register the hook with its handle for later identification and removal
        _hooks.push({ handle, fn });

        // Return the handle so the caller can uninstall the hook later
        return handle;
    };

    /**
     * Uninstalls a previously installed message hook, removing it from the chain.
     * After removal the hook function will no longer be called for any messages.
     * @param {number} hookId - Hook handle returned by installMessageHook()
     */
    wakaPAC.uninstallMessageHook = function(hookId) {
        // Locate the hook entry by its handle
        const index = _hooks.findIndex(h => h.handle === hookId);

        // Remove the hook if found — silently ignore unknown handles
        if (index !== -1) {
            _hooks.splice(index, 1);
        }
    };

    /**
     * Sets a timer for a specific component, similar to Win32 SetTimer
     * @param {string} pacId - Target container's data-pac-id
     * @param {number} elapse - Timer interval in milliseconds
     * @returns {number|null} The timerId if successful, null if failed
     */
    wakaPAC.setTimer = function(pacId, elapse) {
        const context = window.PACRegistry.get(pacId);

        if (!context) {
            console.warn(`No PAC container found with id: ${pacId}`);
            return null;
        }

        return context.setTimer(elapse);
    };

    /**
     * Kills a timer, similar to Win32 KillTimer
     * @param {string} pacId - Target container's data-pac-id
     * @param {number} timerId - Timer identifier to kill
     * @returns {boolean} True if timer was killed, false if not found
     */
    wakaPAC.killTimer = function(pacId, timerId) {
        const context = window.PACRegistry.get(pacId);

        if (!context) {
            return false;
        }

        return context.killTimer(timerId);
    };

    /**
     * Stops all timers associated with a PAC context identified by pacId.
     * Returns the number of timers that were stopped, or 0 if no context exists.
     * @param {string} pacId - Target container's data-pac-id
     * @returns {*|number}
     */
    wakaPAC.killAllTimers = function (pacId) {
        // Look up the PAC execution context from the global registry
        const context = window.PACRegistry.get(pacId);

        // If no context is found, there are no timers to stop
        if (!context) {
            return 0;
        }

        // Delegate timer cleanup to the context and return its result
        return context.killAllTimers();
    };

    /**
     * Register a custom binding handler
     * Allows users to extend WakaPAC with their own binding types
     * @param {string} name - The binding name (e.g., 'tooltip' for wp-tooltip="...")
     * @param {Function} handler - Handler function(domUpdater, element, value)
     * @throws {Error} If name is invalid or handler is not a function
     */
    wakaPAC.registerBinding = function(name, handler) {
        if (!name || typeof name !== 'string') {
            throw new Error('Binding name must be a non-empty string');
        }

        if (typeof handler !== 'function') {
            throw new Error('Binding handler must be a function');
        }

        // Warn if overriding built-in binding
        if (BindingHandlers[name]) {
            console.warn(`WakaPAC: Overriding built-in binding type '${name}'`);
        }

        BindingHandlers[name] = handler;
    };

    /**
     * Extracts the low-order word (x coordinate) from lParam
     * Equivalent to Win32 LOWORD macro - gets bits 0-15
     * Coordinates are container-relative (client-area relative in Win32 terms)
     * @param {number} lParam - Packed mouse coordinates from event.lParam
     * @returns {number} X coordinate relative to container's left edge
     */
    wakaPAC.LOWORD = function(lParam) {
        return lParam & 0xFFFF;
    };

    /**
     * Extracts the high-order word (y coordinate) from lParam
     * Equivalent to Win32 HIWORD macro - gets bits 16-31
     * Coordinates are container-relative (client-area relative in Win32 terms)
     * @param {number} lParam - Packed mouse coordinates from event.lParam
     * @returns {number} Y coordinate relative to container's top edge
     */
    wakaPAC.HIWORD = function(lParam) {
        return (lParam >> 16) & 0xFFFF;
    };

    /**
     * Extracts both x and y coordinates from lParam
     * Equivalent to Win32 MAKEPOINTS macro - converts lParam to POINTS structure
     * @param {number} lParam - Packed mouse coordinates from event.lParam
     * @returns {{x: number, y: number}} Object containing container-relative x and y coordinates
     */
    wakaPAC.MAKEPOINTS = function(lParam) {
        return {
            x: lParam & 0xFFFF,           // Low 16 bits = x coordinate (container-relative)
            y: (lParam >> 16) & 0xFFFF    // High 16 bits = y coordinate (container-relative)
        };
    };

    /**
     * Extracts wheel delta from MSG_MOUSEWHEEL wParam
     * Positive = scroll up, Negative = scroll down
     * Standard value is ±120 per notch
     * @param wParam
     * @returns {number}
     */
    wakaPAC.GET_WHEEL_DELTA = function(wParam) {
        const hiWord = (wParam >> 16) & 0xFFFF;
        return (hiWord << 16) >> 16; // Sign-extend
    };

    /**
     * Gets modifier keys from wheel event wParam
     * @param wParam
     * @returns {number}
     */
    wakaPAC.GET_KEYSTATE = function(wParam) {
        return wParam & 0xFFFF; // LOWORD
    };

    /**
     * Extracts the Win32 repeat count from a keyboard lParam value.
     * Bits 0–15 encode how many times the key message has repeated.
     * @param {number} lParam - Encoded keyboard lParam
     * @returns {number} Repeat count
     */
    wakaPAC.GET_REPEAT_COUNT_LPARAM = function(lParam) {
        // Mask lower 16 bits where Win32 stores the repeat count
        return lParam & 0xFFFF;
    };

    /**
     * Retrieves a string that represents the name of a key.
     * @param keyCode
     * @returns {string|null}
     */
    wakaPAC.getKeyName = Utils.getKeyName.bind(Utils);

    /**
     * Registers a new gesture
     * @param name
     * @param directions
     */
    wakaPAC.registerGesture = function(name, directions) {
        return MouseGestureRecognizer.registerPattern(name, directions);
    };

    /**
     * Removes a gesture's registration
     * @param name
     */
    wakaPAC.unregisterGesture = function(name) {
        return MouseGestureRecognizer.unregisterPattern(name);
    };

    /**
     * Sets mouse capture to the specified PAC container.
     * While capture is active, mouse events are routed to this container
     * regardless of cursor position.
     * @param {string} pacId - The pac-id of the container to capture mouse input
     */
    wakaPAC.setCapture = function(pacId) {
        const context = window.PACRegistry.get(pacId);

        if (!context) {
            console.warn(`No PAC container found with id: ${pacId}`);
            return;
        }

        return DomUpdateTracker.setCapture(context.container);
    };

    /**
     * Releases mouse capture, returning to normal event routing
     */
    wakaPAC.releaseCapture = function() {
        return DomUpdateTracker.releaseCapture();
    };

    /**
     * Checks if mouse capture is currently active
     * @returns {boolean} True if capture is active
     */
    wakaPAC.hasCapture = function() {
        return DomUpdateTracker.hasCapture();
    };

    /**
     * Gets the pac-id of the container that currently has mouse capture, if any.
     * Similar to Win32 GetCapture() which returns the window handle that has capture.
     * @returns {string|null} The pac-id of the capturing container, or null if no capture is active
     */
    wakaPAC.getCapture = function() {
        // Return null if no capture is currently active
        if (!DomUpdateTracker._captureActive) {
            return null;
        }

        // Extract the pac-id from the captured container element
        // Use optional chaining since container might be removed from DOM
        const pacId = DomUpdateTracker._capturedContainer?._pacId || DomUpdateTracker._capturedContainer?.getAttribute('data-pac-id');

        // Return pac-id or null if container no longer has the attribute
        return pacId || null;
    };

    /**
     * Tests whether a point lies within an element's bounding rectangle
     * Equivalent to Win32 PtInRect - basic hit testing
     * @param {number} x - X coordinate in client space
     * @param {number} y - Y coordinate in client space
     * @param {HTMLElement} element - Element to test against
     * @returns {boolean} True if point is inside element's bounds
     */
    wakaPAC.ptInElement = function(x, y, element) {
        if (!element) {
            return false;
        }

        const rect = element.getBoundingClientRect();

        return x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom;
    };

    /**
     * Returns the topmost DOM element at the given client coordinates.
     * @param {number} x - Horizontal coordinate in client space.
     * @param {number} y - Vertical coordinate in client space.
     * @returns {Element|null} The element at the position, or null if none.
     */
    wakaPAC.elementFromPoint = function(x, y) {
        return document.elementFromPoint(x, y);
    };

    /**
     * Returns the nearest PAC container at a client coordinate.
     * @param {number} x - X coordinate in client space
     * @param {number} y - Y coordinate in client space
     * @returns {Element|null}
     */
    wakaPAC.containerFromPoint = function containerFromPoint(x, y) {
        const hitElement = wakaPAC.elementFromPoint(x, y);

        if (!hitElement) {
            return null;
        }

        return hitElement.closest("[data-pac-id]");
    };

    /**
     * Registers an external library as a wakaPAC plugin.
     *
     * The library must implement a createPacPlugin(pac) method that
     * receives the wakaPAC object and returns a plugin descriptor
     * with lifecycle hooks:
     *
     *   onComponentCreated(abstraction, id)   — called for each new component
     *   onComponentDestroyed(id)              — called when a component is removed
     *
     * All hooks are optional. Duplicate registrations are silently ignored.
     *
     * @param {Object} library - Library to integrate (e.g. wakaSync)
     * @param {Object} [options={}] - Options forwarded to createPacPlugin (e.g. { locale: 'nl-NL' })
     * @throws {Error} If lib does not implement createPacPlugin()
     */
    wakaPAC.use = function(library, options = {}) {
        _registerUnit(library, options);
    };

    /**
     * Retrieves the function set exported by a registered unit.
     * Accepts either the unit's string name or the original library object
     * passed to wakaPAC.use() — both forms return the same result.
     * @param {string|Object} name - Unit name (e.g. 'CollectionUtils') or library reference (e.g. CollectionUtils)
     * @returns {Object|null} The unit's function set, or null if not found
     */
    wakaPAC.unit = function (name) {
        if (typeof name === 'object') {
            name = _unitNames.get(name) ?? null;

            if (!name) {
                return null;
            }
        }

        return _units.get(name) ?? null;
    };

    // ========================================================================
    // PUBLIC ACCELERATOR API
    // ========================================================================

    /**
     * Loads (registers) an accelerator table for a PAC container or for the
     * application globally.
     *
     * Each entry is a plain object with a human-readable shortcut string and a
     * command identifier:
     *   { key: "Ctrl+S", cmdId: 101 }
     *
     * The key string consists of optional modifier tokens (Ctrl, Shift, Alt)
     * followed by a key name, all joined by "+". The key name is a VK_* constant
     * name with the "VK_" prefix omitted. Parsing is case-insensitive.
     *
     *   "Ctrl+S"           → Ctrl + S
     *   "Ctrl+Shift+Z"     → Ctrl + Shift + Z
     *   "F5"               → F5 (no modifiers)
     *   "Ctrl+OEM_PLUS"    → Ctrl + = / +  key
     *   "Alt+F4"           → Alt + F4
     *
     * Calling loadAcceleratorTable() for the same pacId a second time completely
     * replaces the existing table — entries are not merged.
     *
     * @param {string|null} pacId — Target container's data-pac-id, or null for global.
     * @param {Array<{key: string, cmdId: number}>} entries
     * @throws {TypeError} If entries is not an array, any entry is malformed, or any key string cannot be parsed.
     */
    wakaPAC.loadAcceleratorTable = function(pacId, entries) {
        if (!Array.isArray(entries)) {
            throw new TypeError('wakaPAC.loadAcceleratorTable(): entries must be an array');
        }

        // Parse and validate every entry up-front so callers get a clear error
        // message rather than a silent misfire at dispatch time.
        const parsed = [];

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];

            if (typeof e !== 'object' || e === null) {
                throw new TypeError(`wakaPAC.loadAcceleratorTable(): entry[${i}] must be an object`);
            }

            if (typeof e.key !== 'string') {
                throw new TypeError(`wakaPAC.loadAcceleratorTable(): entry[${i}].key must be a string`);
            }

            if (typeof e.cmdId !== 'number' || e.cmdId <= 0) {
                throw new TypeError(`wakaPAC.loadAcceleratorTable(): entry[${i}].cmdId must be a positive number`);
            }

            // _parseAcceleratorKey throws a descriptive TypeError on bad input
            const { vk, modifiers } = _parseAcceleratorKey(e.key);

            // Add parsed accelerator key to list
            parsed.push({ vk, modifiers, cmdId: e.cmdId, key: e.key });
        }

        // Store the data
        const tableKey = (pacId === null || pacId === undefined) ? ACCEL_GLOBAL_KEY : pacId;
        _accelTables.set(tableKey, parsed);
    };

    /**
     * Destroys the accelerator table for a container or for the global scope.
     * @param {string|null} pacId — Container pac-id, or null for global.
     */
    wakaPAC.destroyAcceleratorTable = function(pacId) {
        const tableKey = (pacId === null || pacId === undefined) ? ACCEL_GLOBAL_KEY : pacId;
        _accelTables.delete(tableKey);
    };

    /**
     * Returns a copy of the registered entries for a container or the global scope.
     * Each entry includes the original key string, making this suitable for
     * rendering a keyboard shortcuts help dialog.
     * Returns null if no table is registered for the given scope.
     * @param {string|null} pacId — Container pac-id, or null for global.
     * @returns {Array<{key: string, cmdId: number}>|null}
     */
    wakaPAC.getAcceleratorTable = function(pacId) {
        const tableKey = (pacId === null || pacId === undefined) ? ACCEL_GLOBAL_KEY : pacId;
        const table = _accelTables.get(tableKey);
        return table ? table.map(e => ({ key: e.key, cmdId: e.cmdId })) : null;
    };

    // ========================================================================
    // METAFILE BUILDER
    // ========================================================================

    /**
     * Fluent display list builder.
     *
     * Provides a chainable API for constructing display lists (metafiles) without
     * manually pushing raw op objects onto an array. Mirrors the CanvasRenderingContext2D
     * API so drawing code reads naturally.
     *
     * Usage:
     *   const dl = new wakaPAC.MetaFile()
     *       .setFillStyle('#4e79a7')
     *       .beginPath()
     *       .arc(cx, cy, r, startAngle, endAngle)
     *       .fill()
     *       .build();
     *
     * For conditional ops, break the chain:
     *   const dl = new wakaPAC.MetaFile();
     *   dl.setFillStyle('#4e79a7').beginPath().arc(cx, cy, r, 0, Math.PI * 2).fill();
     *   if (o.gap > 0) {
     *       dl.setStrokeStyle('#ffffff').setLineWidth(o.gap).stroke();
     *   }
     *   return dl.build();
     */
    function MetaFile() {
        this._ops = [];
    }

    // Single-value setters: method(value) → push {op, value}
    [
        'setFillStyle', 'setStrokeStyle', 'setLineWidth', 'setLineCap', 'setLineJoin',
        'setLineDashOffset', 'setMiterLimit', 'setGlobalAlpha', 'setGlobalComposite',
        'setFont', 'setTextAlign', 'setTextBaseline', 'setTextRendering',
        'setLetterSpacing', 'setWordSpacing', 'setLineDash',
    ].forEach(function (name) {
        MetaFile.prototype[name] = function (value) {
            this._ops.push({op: name, value});
            return this;
        };
    });

    // No-argument state ops: method() → push {op}
    [
        'save', 'restore', 'beginPath', 'closePath', 'stroke', 'resetTransform', 'clearShadow',
    ].forEach(function (name) {
        MetaFile.prototype[name] = function () {
            this._ops.push({op: name});
            return this;
        };
    });

    // Other ops
    MetaFile.prototype.moveTo = function(x, y) { this._ops.push({op: 'moveTo', x, y}); return this; };
    MetaFile.prototype.lineTo = function(x, y) { this._ops.push({op: 'lineTo', x, y}); return this; };
    MetaFile.prototype.arc = function(cx, cy, r, startAngle, endAngle, ccw = false) { this._ops.push({op: 'arc', cx, cy, r, startAngle, endAngle, ccw}); return this; };
    MetaFile.prototype.arcTo = function(x1, y1, x2, y2, r) { this._ops.push({op: 'arcTo', x1, y1, x2, y2, r}); return this; };
    MetaFile.prototype.ellipse = function(cx, cy, rx, ry, rotation, startAngle, endAngle, ccw = false) { this._ops.push({op: 'ellipse', cx, cy, rx, ry, rotation, startAngle, endAngle, ccw}); return this; };
    MetaFile.prototype.rect = function(x, y, w, h) { this._ops.push({op: 'rect', x, y, w, h}); return this; };
    MetaFile.prototype.roundRect = function(x, y, w, h, r) { this._ops.push({op: 'roundRect', x, y, w, h, r}); return this; };
    MetaFile.prototype.fill = function(rule = 'nonzero') { this._ops.push({op: 'fill', rule}); return this; };
    MetaFile.prototype.clip = function(rule = 'nonzero') { this._ops.push({op: 'clip', rule}); return this; };
    MetaFile.prototype.fillRect = function(x, y, w, h) { this._ops.push({op: 'fillRect', x, y, w, h}); return this; };
    MetaFile.prototype.strokeRect = function(x, y, w, h) { this._ops.push({op: 'strokeRect', x, y, w, h}); return this; };
    MetaFile.prototype.clearRect = function(x, y, w, h) { this._ops.push({op: 'clearRect', x, y, w, h}); return this; };
    MetaFile.prototype.fillText = function(text, x, y, maxWidth) { this._ops.push({op: 'fillText', text, x, y, maxWidth}); return this; };
    MetaFile.prototype.strokeText = function(text, x, y, maxWidth) { this._ops.push({op: 'strokeText', text, x, y, maxWidth}); return this; };
    MetaFile.prototype.bezierCurveTo = function(cp1x, cp1y, cp2x, cp2y, x, y) { this._ops.push({op: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y}); return this; };
    MetaFile.prototype.quadraticCurveTo = function(cpx, cpy, x, y) { this._ops.push({op: 'quadraticCurveTo', cpx, cpy, x, y}); return this; };
    MetaFile.prototype.drawImage = function(image, dx, dy, dw, dh) { this._ops.push({op: 'drawImage', image, dx, dy, dw, dh}); return this; };
    MetaFile.prototype.translate = function(x, y) { this._ops.push({op: 'translate', x, y}); return this; };
    MetaFile.prototype.rotate = function(angle) { this._ops.push({op: 'rotate', angle}); return this; };
    MetaFile.prototype.scale = function(x, y) { this._ops.push({op: 'scale', x, y}); return this; };
    MetaFile.prototype.transform = function(a, b, c, d, e, f) { this._ops.push({op: 'transform', a, b, c, d, e, f}); return this; };
    MetaFile.prototype.setTransform = function(a, b, c, d, e, f) { this._ops.push({op: 'setTransform', a, b, c, d, e, f}); return this; };
    MetaFile.prototype.setShadow = function(color, blur, offsetX = 0, offsetY = 0) { this._ops.push({op: 'setShadow', color, blur, offsetX, offsetY}); return this; };
    MetaFile.prototype.setImageSmoothing = function(enabled, quality) { this._ops.push({op: 'setImageSmoothing', enabled, quality}); return this; };

    /**
     * Appends a hit area op. `shape` is 'rect' or 'sector'; `params` contains
     * the shape-specific fields (x/y/w/h for rect, cx/cy/r/innerR/startAngle/endAngle
     * for sector) plus a `data` payload returned by metaFileHitTest on a match.
     * @param {string} shape
     * @param {Object} params
     */
    MetaFile.prototype.hitArea = function(shape, params) { this._ops.push({op: 'hitArea', shape, ...params}); return this; };

    /**
     * Returns the completed display list array.
     * The builder should not be used after calling build().
     * @returns {Array<Object>}
     */
    MetaFile.prototype.build = function() { return this._ops; };

    // ========================================================================
    // PUBLIC PAINT API
    // ========================================================================

    /**
     * Returns the rendering context for a canvas PAC container.
     * Equivalent to Win32 GetDC() — retrieves the drawing context for a window.
     *
     * The context type is determined by the data-pac-context attribute on the
     * canvas element (defaults to '2d' if absent):
     *   '2d'     — returns CanvasRenderingContext2D  (dcAttributes from config)
     *   'webgl'  — returns WebGLRenderingContext      (glAttributes from config)
     *   'webgl2' — returns WebGL2RenderingContext     (glAttributes from config)
     *
     * Calling getDC() on a WebGL/WebGL2 canvas returns the WebGL context directly.
     * The dirty-rect clip logic only applies to 2D contexts; WebGL components drive
     * their own render loop via requestAnimationFrame and do not use invalidateRect.
     *
     * Returns null if the container does not exist, is not a <canvas> element, or
     * if the requested context type is not supported by the browser.
     *
     * @param {string} pacId
     * @returns {CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext|null}
     */
    wakaPAC.getDC = function (pacId) {
        const container = this.getContainerByPacId(pacId);

        if (!container || !(container instanceof HTMLCanvasElement)) {
            return null;
        }

        // Resolve context attributes from component config
        const pacContext = window.PACRegistry.get(pacId);
        const contextType = container.dataset.pacContext || '2d';
        const attributes = pacContext?.config?.dcAttributes;

        // Delegate context acquisition to getDCFromElement
        const ctx = this.getDCFromElement(container, attributes);

        if (!ctx) {
            return null;
        }

        // For 2D contexts only: if we're inside a MSG_PAINT dispatch, restrict
        // drawing to the dirty region — equivalent to Win32 BeginPaint() setting
        // up a clip region over the update region. Callers must balance this with
        // a matching releaseDC() call so the saved state is properly unwound.
        // WebGL contexts drive their own render loop and do not use this mechanism.
        if (contextType === '2d') {
            const entry = _dirtyCanvases.get(pacId);

            if (entry?.painting && entry.rects?.length) {
                ctx.save();
                ctx.beginPath();

                for (const r of entry.rects) {
                    ctx.rect(r.x, r.y, r.width, r.height);
                }

                ctx.clip();
            }
        }

        return ctx;
    };

    /**
     * Releases a device context previously obtained with getDC().
     * Must be called once for every getDC() call made inside a MSG_PAINT
     * handler for 2D canvases; outside of paint cycles this is a no-op and
     * safe to call unconditionally.
     * For WebGL/WebGL2 contexts this is always a no-op — they do not use
     * the dirty-rect clip mechanism.
     * @param {CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext} ctx - the context returned by getDC()
     */
    wakaPAC.releaseDC = function (ctx) {
        // Bail if no ctx passed
        if (!ctx) {
            return;
        }

        // WebGL contexts do not participate in the dirty-rect clip mechanism
        if (ctx instanceof WebGLRenderingContext || ctx instanceof WebGL2RenderingContext) {
            return;
        }

        // Recover the pacId from the canvas element the context belongs to
        const pacId = ctx.canvas?.dataset?.pacId;

        if (!pacId) {
            return;
        }

        // Fetch entry from the store
        const entry = _dirtyCanvases.get(pacId);

        // Only restore if getDC() pushed a save — it does so only during painting
        if (entry?.painting && entry.rects?.length) {
            ctx.restore();
        }
    };

    /**
     * Creates an off-screen context sized to match the canvas backing store.
     * The context type matches the source canvas's data-pac-context attribute,
     * so a WebGL2 canvas produces a WebGL2 OffscreenCanvas context.
     * The component owns the returned DC; recreate it in MSG_SIZE after resizing.
     * @param {string} pacId
     * @returns {OffscreenCanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext|null}
     */
    wakaPAC.createCompatibleDC = function(pacId) {
        const container = this.getContainerByPacId(pacId);

        if (!container || !(container instanceof HTMLCanvasElement)) {
            return null;
        }

        const contextType = container.dataset.pacContext || '2d';
        const pacContext = window.PACRegistry.get(pacId);
        const attributes = pacContext?.config?.dcAttributes;

        return new OffscreenCanvas(container.width, container.height).getContext(contextType, attributes);
    };

    /**
     * Releases a compatible DC. Zeros the OffscreenCanvas dimensions to free
     * the pixel buffer promptly rather than waiting on GC.
     * @param {CanvasRenderingContext2D} dc
     */
    wakaPAC.deleteCompatibleDC = function(dc) {
        // OffscreenCanvas has no explicit destroy method — nulling the canvas
        // width and height releases the pixel buffer immediately in most engines,
        // allowing the GC to reclaim the backing store without waiting for a
        // full collection cycle.
        if (!dc) {
            return;
        }

        const offscreen = dc.canvas;

        if (offscreen instanceof OffscreenCanvas) {
            offscreen.width  = 0;
            offscreen.height = 0;
        }
    };

    /**
     * Returns the rendering context for any canvas element — not tied to
     * a PAC container. Use this to get a drawing context for canvas elements
     * inside foreach items or other non-container canvases.
     *
     * The context type is determined by the data-pac-context attribute on the
     * canvas element (defaults to '2d' if absent):
     *   '2d'     — returns CanvasRenderingContext2D
     *   'webgl'  — returns WebGLRenderingContext
     *   'webgl2' — returns WebGL2RenderingContext
     *
     * @param {HTMLCanvasElement} canvasElement
     * @param {Object} [attributes] - Context attributes passed to getContext()
     * @returns {CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext|null}
     */
    wakaPAC.getDCFromElement = function(canvasElement, attributes) {
        if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) {
            return null;
        }

        const contextType = canvasElement.dataset.pacContext || '2d';
        return canvasElement.getContext(contextType, attributes);
    };

    /**
     * Marks a canvas PAC container as needing repaint.
     * @param {string} pacId - data-pac-id of the target canvas container
     * @param {{x:number, y:number, width:number, height:number}|null} [rect]
     *   Rectangle to invalidate in canvas-local pixel coordinates.
     *   Omit or pass null to invalidate the entire canvas surface.
     */
    wakaPAC.invalidateRect = function(pacId, rect) {
        _invalidateRect(pacId, rect || null);
    };

    /**
     * Schedules a single MSG_PAINT for a WebGL canvas component on the next
     * animation frame. Equivalent to invalidateRect() for 2D canvases — use
     * this to trigger an on-demand redraw on a WebGL canvas that does not use
     * renderLoop: true.
     *
     * Safe to call multiple times before the next frame — only one MSG_PAINT
     * will fire, since requestAnimationFrame deduplicates same-frame callbacks.
     *
     * Has no effect if the container does not exist, is not a canvas, or is
     * not a WebGL/WebGL2 canvas.
     *
     * @param {string} pacId - data-pac-id of the target canvas container
     */
    wakaPAC.requestRender = function(pacId) {
        const container = this.getContainerByPacId(pacId);

        // Bail if the container does not exist or is not a canvas element
        if (!container || !(container instanceof HTMLCanvasElement)) {
            return;
        }

        const contextType = container.dataset.pacContext || '2d';

        // requestRender is for WebGL canvases only — 2D canvases use invalidateRect()
        if (contextType === '2d') {
            console.warn(`wakaPAC.requestRender: "${pacId}" is a 2D canvas — use invalidateRect() instead.`);
            return;
        }

        requestAnimationFrame(() => {
            // Guard: component may have been destroyed before the frame fired
            if (!window.PACRegistry.get(pacId)) {
                return;
            }

            DomUpdateTracker.dispatchToContainer(container, DomUpdateTracker.wrapDomEventAsMessage(
                MSG_PAINT,
                null,
                0,
                0
            ));
        });
    };

    /**
     * Returns the bounding rectangle of the invalidated region for a canvas
     * PAC container, or null if no repaint is currently pending.
     * @param {string} pacId - data-pac-id of the target canvas container
     * @returns {{x:number, y:number, width:number, height:number}|null}
     */
    wakaPAC.getInvalidatedRect = function (pacId) {
        const entry = _dirtyCanvases.get(pacId);

        if (!entry) {
            return null;
        }

        return entry.rects.reduce((acc, r) => Utils.unionRect(acc, r));
    };

    /**
     * Returns the list of discrete invalidated rectangles for a canvas PAC
     * container, or null if no repaint is pending.
     * @param {string} pacId - data-pac-id of the target canvas container
     * @returns {Array<{x:number, y:number, width:number, height:number}>|null}
     */
    wakaPAC.getUpdateRgn = function (pacId) {
        const entry = _dirtyCanvases.get(pacId);

        if (!entry) {
            return null;
        }

        return entry.rects.map(r => ({...r}));
    };

    /**
     * Performs a bit-block transfer from srcDC to destDC.
     * Equivalent to Win32 BitBlt() — copies a rectangle of pixels from the source
     * to the destination at 1:1 scale. No stretching or compression is performed.
     *
     * cx/cy define the size of the rectangle copied; the same dimensions apply to
     * both the source and the destination. sx/sy define the top-left corner of the
     * source rectangle; omit to copy from (0, 0).
     *
     * Supports mixed 2D ↔ WebGL/WebGL2 copies:
     *
     *   2D   → 2D     drawImage() — straightforward
     *   WebGL → 2D    drawImage() on the WebGL canvas — requires preserveDrawingBuffer: true
     *                 in dcAttributes, otherwise the copy produces a blank result.
     *   2D   → WebGL  texImage2D() on the currently bound TEXTURE_2D — caller must
     *                 bind the target texture before calling bitBlt().
     *   WebGL → WebGL drawImage() via the source canvas — requires preserveDrawingBuffer: true.
     *
     * @param {CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext} destDC
     * @param {CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext} srcDC
     * @param {number} dx - Destination X
     * @param {number} dy - Destination Y
     * @param {number} [cx] - Width of the rectangle to copy. Defaults to full source width
     * @param {number} [cy] - Height of the rectangle to copy. Defaults to full source height
     * @param {number} [sx=0] - Source X offset
     * @param {number} [sy=0] - Source Y offset
     */
    wakaPAC.bitBlt = function(destDC, srcDC, dx, dy, cx, cy, sx = 0, sy = 0) {
        if (!destDC || !srcDC) {
            return;
        }

        const srcCanvas = srcDC.canvas;
        const w = cx ?? srcCanvas.width;
        const h = cy ?? srcCanvas.height;
        const destIsGL = _isWebGLContext(destDC);

        if (destIsGL) {
            // WebGL destination — upload source canvas as a texture.
            // The caller must have bound the target texture before calling bitBlt().
            _blitToWebGL(destDC, srcCanvas);
        } else {
            // 2D destination — drawImage handles both 2D and WebGL sources.
            // WebGL sources require preserveDrawingBuffer: true.
            _blitToCanvas2D(destDC, srcCanvas, sx, sy, w, h, dx, dy, w, h);
        }
    };

    /**
     * Blits srcDC onto destDC at (dx, dy) scaled to (dw, dh).
     * Unlike bitBlt, the source is always stretched to fill the destination rect.
     * Use this when the offscreen DC dimensions differ from the target canvas.
     *
     * Supports the same mixed 2D ↔ WebGL/WebGL2 copy paths as bitBlt().
     * See bitBlt() for preserveDrawingBuffer and texture-binding requirements.
     *
     * @param {CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext} destDC
     * @param {CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext} srcDC
     * @param {number} dx - Destination X
     * @param {number} dy - Destination Y
     * @param {number} dw - Destination width
     * @param {number} dh - Destination height
     */
    wakaPAC.stretchBlt = function(destDC, srcDC, dx, dy, dw, dh) {
        if (!destDC || !srcDC) {
            return;
        }

        const srcCanvas = srcDC.canvas;
        const destIsGL = _isWebGLContext(destDC);

        if (destIsGL) {
            // WebGL destination — upload source canvas as a texture.
            // The caller must have bound the target texture before calling stretchBlt().
            // dx, dy, dw, dh are ignored; scaling is the caller's responsibility
            // via their shader and geometry.
            _blitToWebGL(destDC, srcCanvas);
        } else {
            // 2D destination — drawImage handles stretching natively.
            // WebGL sources require preserveDrawingBuffer: true.
            _blitToCanvas2D(destDC, srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, dx, dy, dw, dh);
        }
    };

    /**
     * Resizes the backing store of a canvas PAC container to the given dimensions.
     * @param {string} pacId  - data-pac-id of the target canvas container
     * @param {number} width  - New backing store width in pixels
     * @param {number} height - New backing store height in pixels
     */
    wakaPAC.resizeCanvas = function (pacId, width, height) {
        // Fetch the container
        const container = this.getContainerByPacId(pacId);

        // resizeCanvas is only meaningful for canvas containers
        if (!container || !(container instanceof HTMLCanvasElement)) {
            return;
        }

        // Skip if dimensions are unchanged — assigning to width/height clears the
        // backing store even when the value is the same, so avoid it entirely
        if (container.width === width && container.height === height) {
            return;
        }

        // Resize the backing store; existing pixel data is cleared by the browser
        container.width = width;
        container.height = height;

        // Schedule a repaint for 2D canvases — the canvas content is invalid after
        // every resize. WebGL canvases drive their own render loop via
        // requestAnimationFrame and do not use the dirty rect / MSG_PAINT mechanism.
        const contextType = container.dataset.pacContext || '2d';

        if (contextType === '2d') {
            _invalidateRect(pacId, null);
        }
    };

    /**
     * Returns the current backing store dimensions of a canvas PAC container.
     * These reflect the actual pixel dimensions of the canvas element, which may
     * differ from the CSS layout size when devicePixelRatio scaling is in use.
     * Returns null if the pacId does not refer to a canvas container.
     * @param {string} pacId - data-pac-id of the target canvas container
     * @returns {{width:number, height:number}|null}
     */
    wakaPAC.getCanvasSize = function(pacId) {
        const container = this.getContainerByPacId(pacId);

        if (!container || !(container instanceof HTMLCanvasElement)) {
            return null;
        }

        return {
            width: container.width,
            height: container.height
        };
    };

    /**
     * Loads a bitmap from a variety of sources, returning an opaque bitmap handle
     * ready to pass to bitBlt, getBitmapSize, saveBitmap, and deleteBitmap.
     * The caller owns the returned handle and must call deleteBitmap() when done.
     *
     * Accepted sources:
     *   - string               URL or data URI; fetched and decoded via createImageBitmap()
     *   - HTMLImageElement     Must be fully loaded (complete && naturalWidth > 0)
     *   - ImageBitmap          Used directly; caller retains ownership and must close it themselves
     *   - ImageData            Raw RGBA pixel buffer; drawn at its own dimensions
     *   - Blob                 Decoded via createImageBitmap()
     *   - HTMLCanvasElement    Snapshot of the canvas at call time
     *   - OffscreenCanvas      Snapshot of the offscreen canvas at call time
     *
     * @param {string|HTMLImageElement|ImageBitmap|ImageData|Blob|HTMLCanvasElement|OffscreenCanvas} source
     * @returns {Promise<CanvasRenderingContext2D|null>} Bitmap handle, or null on failure
     */
    wakaPAC.loadBitmap = async function(source) {
        try {
            let bitmap;

            if (typeof source === 'string') {
                // URL or data URI — fetch the resource and decode it;
                // network or CORS failures propagate to the outer catch, returning null
                bitmap = await createImageBitmap(await (await fetch(source)).blob());
            } else if (source instanceof HTMLImageElement) {
                // <img> element — must be fully decoded before we can read pixels
                if (!source.complete || source.naturalWidth === 0) {
                    return null;
                }

                bitmap = await createImageBitmap(source);
            } else if (source instanceof ImageBitmap) {
                // Already an ImageBitmap — use directly; caller retains ownership
                // and is responsible for closing it
                const dc = new OffscreenCanvas(source.width, source.height).getContext('2d');
                dc.drawImage(source, 0, 0);
                return /** @type {CanvasRenderingContext2D} */ (dc);
            } else if (
                source instanceof ImageData        ||
                source instanceof Blob             ||
                source instanceof HTMLCanvasElement ||
                source instanceof OffscreenCanvas
            ) {
                // ImageData, Blob, canvas snapshot — all accepted directly by createImageBitmap()
                bitmap = await createImageBitmap(source);
            } else {
                return null;
            }

            // Draw the bitmap into a fresh OffscreenCanvas-backed DC
            const dc = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
            dc.drawImage(bitmap, 0, 0);

            // ImageBitmap holds GPU-side memory and must be explicitly released;
            // unlike Image, it is not GC'd cleanly without an explicit close()
            bitmap.close();

            return /** @type {CanvasRenderingContext2D} */ (dc);
        } catch {
            return null;
        }
    };

    /**
     * Saves the contents of a DC or bitmap handle to an image file, triggering a browser download.
     * Works with DCs from createCompatibleDC, bitmap handles from loadBitmap, and DCs from getDC.
     * The image format is derived from the filename extension: .png, .jpg/.jpeg, or .webp.
     * Defaults to PNG if the extension is absent or unrecognized.
     * @param {CanvasRenderingContext2D} dc                     - Source DC or bitmap handle to save
     * @param {string}                  [filename='bitmap.png'] - Output filename
     * @returns {Promise<boolean>} true on success, false on failure
     */
    wakaPAC.saveBitmap = async function(dc, filename = 'bitmap.png') {
        if (!dc) {
            return false;
        }

        // Derive MIME type from filename extension; fall back to PNG
        const ext  = filename.split('.').pop().toLowerCase();
        const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[ext] ?? 'image/png';

        try {
            let blob;

            if (dc.canvas instanceof OffscreenCanvas) {
                // OffscreenCanvas — compatible DCs and bitmap handles
                blob = await dc.canvas.convertToBlob({ type: mime });
            } else {
                // HTMLCanvasElement — DCs from getDC()
                blob = await new Promise((resolve, reject) =>
                    dc.canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), mime)
                );
            }

            // createObjectURL creates a temporary URL pointing to the blob in memory.
            // It must be revoked after use to release the memory; the download is
            // already queued by the time revokeObjectURL is called so it is safe to
            // revoke immediately.
            const url = URL.createObjectURL(blob);
            const a   = Object.assign(document.createElement('a'), { href: url, download: filename });

            a.click();
            URL.revokeObjectURL(url);
            return true;
        } catch {
            return false;
        }
    };

    /**
     * Releases a bitmap handle created by loadBitmap().
     * Alias for deleteCompatibleDC() — provided so call sites that use loadBitmap()
     * can pair it with a semantically matching release call.
     * @param {CanvasRenderingContext2D} hBitmap
     */
    wakaPAC.deleteBitmap = function(hBitmap) {
        wakaPAC.deleteCompatibleDC(hBitmap);
    };

    /**
     * Returns the dimensions of a bitmap handle created by loadBitmap().
     * Equivalent to calling GetObject(hBitmap) to retrieve BITMAP.bmWidth/bmHeight in Win32.
     * Returns null if hBitmap is invalid.
     * @param {CanvasRenderingContext2D} hBitmap
     * @returns {{width: number, height: number}|null}
     */
    wakaPAC.getBitmapSize = function(hBitmap) {
        if (!hBitmap) {
            return null;
        }

        return {
            width:  hBitmap.canvas.width,
            height: hBitmap.canvas.height
        };
    };

    /**
     * Executes a display list (metafile) onto a canvas context.
     * Equivalent to Win32's PlayEnhMetaFile() — plays back a recorded sequence
     * of drawing operations produced by ChartUtils or any other display list producer.
     *
     * The offset is applied via ctx.translate so all coordinates in the display
     * list are naturally relative to (0, 0). State is saved and restored around
     * the entire playback so the caller's context is unaffected.
     *
     * Non-drawing instructions (op: 'hitArea') are silently skipped.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array<Object>} dl - Display list returned by a chart or drawing function
     * @param {number} [offsetX=0] - X offset to apply to the entire display list
     * @param {number} [offsetY=0] - Y offset to apply to the entire display list
     */
    wakaPAC.playMetaFile = function(ctx, dl, offsetX = 0, offsetY = 0) {
        if (!ctx || !Array.isArray(dl) || dl.length === 0) {
            return;
        }

        ctx.save();

        if (offsetX !== 0 || offsetY !== 0) {
            ctx.translate(offsetX, offsetY);
        }

        for (let i = 0, len = dl.length; i < len; i++) {
            const op = dl[i];

            // Direct property assignments: op.value → ctx[property]
            if (op.op in _metaFileProps) {
                ctx[_metaFileProps[op.op]] = op.value;
                continue;
            }

            // Direct no-argument method calls: ctx.method()
            if (op.op in _metaFileMethods) {
                ctx[_metaFileMethods[op.op]]();
                continue;
            }

            // Ops requiring custom argument mapping
            switch (op.op) {
                case 'moveTo':
                    ctx.moveTo(op.x, op.y);
                    break;

                case 'lineTo':
                    ctx.lineTo(op.x, op.y);
                    break;

                case 'arc':
                    ctx.arc(op.cx, op.cy, op.r, op.startAngle, op.endAngle, op.ccw ?? false);
                    break;

                case 'arcTo':
                    ctx.arcTo(op.x1, op.y1, op.x2, op.y2, op.r);
                    break;

                case 'ellipse':
                    ctx.ellipse(op.cx, op.cy, op.rx, op.ry, op.rotation, op.startAngle, op.endAngle, op.ccw ?? false);
                    break;

                case 'rect':
                    ctx.rect(op.x, op.y, op.w, op.h);
                    break;

                case 'roundRect':
                    ctx.roundRect(op.x, op.y, op.w, op.h, op.r);
                    break;

                case 'bezierCurveTo':
                    ctx.bezierCurveTo(op.cp1x, op.cp1y, op.cp2x, op.cp2y, op.x, op.y);
                    break;

                case 'quadraticCurveTo':
                    ctx.quadraticCurveTo(op.cpx, op.cpy, op.x, op.y);
                    break;

                case 'fill':
                    ctx.fill(op.rule ?? 'nonzero');
                    break;

                case 'clip':
                    ctx.clip(op.rule ?? 'nonzero');
                    break;

                case 'fillRect':
                    ctx.fillRect(op.x, op.y, op.w, op.h);
                    break;

                case 'strokeRect':
                    ctx.strokeRect(op.x, op.y, op.w, op.h);
                    break;

                case 'clearRect':
                    ctx.clearRect(op.x, op.y, op.w, op.h);
                    break;

                case 'fillText':
                    ctx.fillText(op.text, op.x, op.y, op.maxWidth);
                    break;

                case 'strokeText':
                    ctx.strokeText(op.text, op.x, op.y, op.maxWidth);
                    break;

                case 'drawImage':
                    ctx.drawImage(op.image, op.dx, op.dy, op.dw, op.dh);
                    break;

                case 'translate':
                    ctx.translate(op.x, op.y);
                    break;

                case 'rotate':
                    ctx.rotate(op.angle);
                    break;

                case 'scale':
                    ctx.scale(op.x, op.y);
                    break;

                case 'transform':
                    ctx.transform(op.a, op.b, op.c, op.d, op.e, op.f);
                    break;

                case 'setTransform':
                    ctx.setTransform(op.a, op.b, op.c, op.d, op.e, op.f);
                    break;

                case 'setLineDash':
                    ctx.setLineDash(op.value);
                    break;

                case 'setShadow':
                    ctx.shadowColor = op.color;
                    ctx.shadowBlur = op.blur;
                    ctx.shadowOffsetX = op.offsetX ?? 0;
                    ctx.shadowOffsetY = op.offsetY ?? 0;
                    break;

                case 'clearShadow':
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    break;

                case 'setImageSmoothing':
                    ctx.imageSmoothingEnabled = op.enabled;

                    if (op.quality) {
                        ctx.imageSmoothingQuality = op.quality;
                    }

                    break;

                case 'hitArea':
                    break; // Non-drawing — skip

                default:
                    console.warn(`wakaPAC.playMetaFile: unknown op "${op.op}"`);
                    break;
            }
        }

        ctx.restore();
    };

    /**
     * Hit-tests a point against the hitArea entries in a display list.
     * Returns the data payload of the first matching hit area, or null if none matched.
     *
     * Supported hitArea shapes:
     *   rect   — { x, y, w, h } axis-aligned rectangle
     *   sector — { cx, cy, r, startAngle, endAngle } pie/donut sector
     *
     * Pass the same offsetX/offsetY that were passed to playMetaFile — the function
     * subtracts them from the test point internally so the caller works in container
     * coordinates throughout.
     *
     * @param {Array<Object>} dl - Display list to test against
     * @param {number}        x        - X coordinate to test (container coordinates)
     * @param {number}        y        - Y coordinate to test (container coordinates)
     * @param {number}        [offsetX=0] - X offset passed to playMetaFile
     * @param {number}        [offsetY=0] - Y offset passed to playMetaFile
     * @returns {*|null} The matching hitArea's data payload, or null
     */
    wakaPAC.metaFileHitTest = function (dl, x, y, offsetX = 0, offsetY = 0) {
        if (!Array.isArray(dl)) {
            return null;
        }

        // Translate the test point into display list space
        const lx = x - offsetX;
        const ly = y - offsetY;

        for (let i = 0, len = dl.length; i < len; i++) {
            const op = dl[i];

            if (op.op !== 'hitArea') {
                continue;
            }

            const shape = op.shape ?? 'rect';

            switch (shape) {
                case 'rect':
                    if (lx >= op.x && lx <= op.x + op.w &&
                        ly >= op.y && ly <= op.y + op.h) {
                        return op.data ?? null;
                    }
                    break;

                case 'sector': {
                    // Distance from centre
                    const dx = lx - op.cx;
                    const dy = ly - op.cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > op.r) {
                        break;
                    }

                    // Inner radius for donut charts — 0 means full pie
                    if (op.innerR && dist < op.innerR) {
                        break;
                    }

                    // Full circle — any point within radius is a hit
                    if (Math.abs(op.endAngle - op.startAngle) >= Math.PI * 2) {
                        return op.data ?? null;
                    }

                    // Angle from centre — atan2 returns [-π, π], normalise to [0, 2π]
                    let angle = Math.atan2(dy, dx);

                    if (angle < 0) {
                        angle += Math.PI * 2;
                    }

                    // Normalise sector angles to [0, 2π] for consistent comparison
                    let start = op.startAngle % (Math.PI * 2);
                    let end = op.endAngle % (Math.PI * 2);

                    if (start < 0) {
                        start += Math.PI * 2;
                    }

                    if (end < 0) {
                        end += Math.PI * 2;
                    }

                    const inSector = start <= end
                        ? angle >= start && angle <= end
                        : angle >= start || angle <= end; // wraps past 2π

                    if (inSector) {
                        return op.data ?? null;
                    }

                    break;
                }
            }
        }

        return null;
    };

    /**
     * Returns true if the point falls within any hitArea entry in the display list.
     * Equivalent to ptInElement() but for metafile hit areas.
     * Pass the same offsetX/offsetY that were passed to playMetaFile.
     * @param {Array<Object>} dl          - Display list to test against
     * @param {number}        x           - X coordinate to test (container coordinates)
     * @param {number}        y           - Y coordinate to test (container coordinates)
     * @param {number}        [offsetX=0] - X offset passed to playMetaFile
     * @param {number}        [offsetY=0] - Y offset passed to playMetaFile
     * @returns {boolean}
     */
    wakaPAC.ptInMetaFile = function(dl, x, y, offsetX = 0, offsetY = 0) {
        return wakaPAC.metaFileHitTest(dl, x, y, offsetX, offsetY) !== null;
    };

    // Registry file
    window.PACRegistry = window.PACRegistry || new ComponentRegistry();

    // Export Metafile
    wakaPAC.MetaFile = MetaFile;

    // Export main function to global scope
    window.wakaPAC = wakaPAC;

    // Attach message type constants to wakaPAC
    Object.assign(wakaPAC, {
        // Message types
        MSG_UNKNOWN, MSG_DESTROYED, MSG_MOUSEMOVE, MSG_LBUTTONDOWN, MSG_LBUTTONUP, MSG_LBUTTONDBLCLK,
        MSG_RBUTTONDOWN, MSG_RBUTTONUP, MSG_MBUTTONDOWN, MSG_MBUTTONUP, MSG_LCLICK, MSG_MCLICK,
        MSG_RCLICK, MSG_CONTEXTMENU, MSG_CHAR, MSG_CHANGE, MSG_SUBMIT, MSG_INPUT, MSG_INPUT_COMPLETE,
        MSG_PLUGIN, MSG_SETFOCUS, MSG_KILLFOCUS, MSG_KEYDOWN, MSG_KEYUP, MSG_USER, MSG_TIMER, MSG_ACCEL,
        MSG_COMMAND, MSG_COPY, MSG_PASTE, MSG_MOUSEWHEEL, MSG_GESTURE, MSG_PAINT, MSG_SIZE, MSG_FOREACH_REBUILT,
        MSG_WEBGL_READY, MSG_WEBGL_CONTEXT_LOST, MSG_WEBGL_CONTEXT_RESTORED, MSG_MOUSEENTER, MSG_MOUSELEAVE,
        MSG_MOUSEENTER_DESCENDANT, MSG_MOUSELEAVE_DESCENDANT, MSG_CAPTURECHANGED, MSG_DRAGENTER, MSG_DRAGOVER,
        MSG_DRAGLEAVE, MSG_DROP, MSG_DPR_CHANGE,

        // Mouse modifier keys
        MK_LBUTTON, MK_RBUTTON, MK_MBUTTON, MK_SHIFT, MK_CONTROL, MK_ALT,
        MK_XBUTTON1, MK_XBUTTON2, MK_META,

        // Keyboard modifier keys
        KM_SHIFT, KM_CONTROL, KM_ALT, KM_META,

        // Constants for MSG_SIZE
        SIZE_RESTORED, SIZE_HIDDEN, SIZE_FULLSCREEN,

        // Control keys
        VK_BACK, VK_TAB, VK_RETURN, VK_SHIFT, VK_CONTROL, VK_MENU, VK_PAUSE,
        VK_CAPITAL, VK_ESCAPE, VK_SPACE, VK_PRIOR, VK_NEXT, VK_END, VK_HOME,
        VK_LEFT, VK_UP, VK_RIGHT, VK_DOWN, VK_SNAPSHOT, VK_INSERT, VK_DELETE,

        // Number keys
        VK_0, VK_1, VK_2, VK_3, VK_4, VK_5, VK_6, VK_7, VK_8, VK_9,

        // Letter keys
        VK_A, VK_B, VK_C, VK_D, VK_E, VK_F, VK_G, VK_H, VK_I, VK_J, VK_K, VK_L,
        VK_M, VK_N, VK_O, VK_P, VK_Q, VK_R, VK_S, VK_T, VK_U, VK_V, VK_W, VK_X,
        VK_Y, VK_Z,

        // Windows keys
        VK_LWIN, VK_RWIN, VK_APPS,

        // Numpad keys
        VK_NUMPAD0, VK_NUMPAD1, VK_NUMPAD2, VK_NUMPAD3, VK_NUMPAD4, VK_NUMPAD5,
        VK_NUMPAD6, VK_NUMPAD7, VK_NUMPAD8, VK_NUMPAD9, VK_MULTIPLY, VK_ADD,
        VK_SUBTRACT, VK_DECIMAL, VK_DIVIDE,

        // Function keys
        VK_F1, VK_F2, VK_F3, VK_F4, VK_F5, VK_F6, VK_F7, VK_F8, VK_F9, VK_F10,
        VK_F11, VK_F12,

        // Lock keys
        VK_NUMLOCK, VK_SCROLL,

        // Browser keys
        VK_BROWSER_BACK, VK_BROWSER_FORWARD, VK_BROWSER_REFRESH, VK_BROWSER_STOP,
        VK_BROWSER_SEARCH, VK_BROWSER_FAVORITES, VK_BROWSER_HOME,

        // Media keys
        VK_VOLUME_MUTE, VK_VOLUME_DOWN, VK_VOLUME_UP, VK_MEDIA_NEXT_TRACK,
        VK_MEDIA_PREV_TRACK, VK_MEDIA_STOP, VK_MEDIA_PLAY_PAUSE,

        // OEM keys
        VK_OEM_1, VK_OEM_PLUS, VK_OEM_COMMA, VK_OEM_MINUS, VK_OEM_PERIOD,
        VK_OEM_2, VK_OEM_3, VK_OEM_4, VK_OEM_5, VK_OEM_6, VK_OEM_7, VK_OEM_102
    });

    /**
     * Global mousemove throttling configuration
     * Controls the maximum frame rate for mousemove event processing
     * @type {number}
     * @default 60
     */
    wakaPAC.mouseMoveThrottleFps = 60;

})();