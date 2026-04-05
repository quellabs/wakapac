/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██████╗  █████╗ ████████╗███████╗██╗   ██╗████████╗██╗██╗     ███████╗              ║
 * ║  ██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██║   ██║╚══██╔══╝██║██║     ██╔════╝              ║
 * ║  ██║  ██║███████║   ██║   █████╗  ██║   ██║   ██║   ██║██║     ███████╗              ║
 * ║  ██║  ██║██╔══██║   ██║   ██╔══╝  ██║   ██║   ██║   ██║██║     ╚════██║              ║
 * ║  ██████╔╝██║  ██║   ██║   ███████╗╚██████╔╝   ██║   ██║███████╗███████║              ║
 * ║  ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝ ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝              ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — dateUtils                                                            ║
 * ║                                                                                      ║
 * ║  Exposes common date formatting and comparison operations as a WakaPAC unit,         ║
 * ║  making them available in bind expressions and text interpolations.                  ║
 * ║  Backed entirely by the native Intl API — no external libraries required.            ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(DateUtils);                          // browser default locale        ║
 * ║    wakaPAC.use(DateUtils, { locale: 'nl-NL' });     // explicit locale               ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ DateUtils.formatShort(date) }}                                      ║
 * ║  Flat:        {{ formatShort(date) }}  (requires data-pac-uses="DateUtils")          ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    /**
     * Normalises a value to a Date object.
     * Accepts a Date, a numeric timestamp, or a date string.
     * Returns null for invalid or missing input.
     * @param {Date|number|string} value
     * @returns {Date|null}
     */
    function toDate(value) {
        if (!value && value !== 0) {
            return null;
        }

        const d = value instanceof Date ? value : new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Returns a cloned Date object, leaving the original untouched.
     * @param {Date} date
     * @returns {Date}
     */
    function clone(date) {
        return new Date(date.getTime());
    }

    window.DateUtils = {

        createPacPlugin(pac, options) {
            const locale = options.locale ?? navigator.language;

            return {
                /** Unit namespace — accessible in binds as dateUtils.fn() */
                name: 'DateUtils',

                functions: {
                    /**
                     * Formats a date as a short locale date string (e.g. "29-3-2026" in nl-NL).
                     * @param {Date|number|string} date
                     * @returns {string}
                     */
                    formatShort: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return '';
                        }

                        return new Intl.DateTimeFormat(locale, /** @type {any} */({ dateStyle: 'short' })).format(d);
                    },

                    /**
                     * Formats a date as a medium locale date string (e.g. "29 mrt 2026" in nl-NL).
                     * @param {Date|number|string} date
                     * @returns {string}
                     */
                    formatMedium: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return '';
                        }

                        return new Intl.DateTimeFormat(locale, /** @type {any} */({ dateStyle: 'medium' })).format(d);
                    },

                    /**
                     * Formats a date as a long locale date string (e.g. "29 maart 2026" in nl-NL).
                     * @param {Date|number|string} date
                     * @returns {string}
                     */
                    formatLong: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return '';
                        }

                        return new Intl.DateTimeFormat(locale, /** @type {any} */({ dateStyle: 'long' })).format(d);
                    },

                    /**
                     * Formats a date with both date and time (e.g. "29 mrt 2026 14:05" in nl-NL).
                     * @param {Date|number|string} date
                     * @returns {string}
                     */
                    formatDateTime: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return '';
                        }

                        return new Intl.DateTimeFormat(locale, /** @type {any} */({ dateStyle: 'medium', timeStyle: 'short' })).format(d);
                    },

                    /**
                     * Formats only the time portion of a date (e.g. "14:05").
                     * @param {Date|number|string} date
                     * @returns {string}
                     */
                    formatTime: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return '';
                        }

                        return new Intl.DateTimeFormat(locale, /** @type {any} */({ timeStyle: 'short' })).format(d);
                    },

                    /**
                     * Returns a relative time string from now (e.g. "3 days ago", "in 2 hours").
                     * Uses the largest unit where the difference is >= 1.
                     * @param {Date|number|string} date
                     * @returns {string}
                     */
                    fromNow: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return '';
                        }

                        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
                        const diffMs = d.getTime() - Date.now();
                        const diffSec = Math.round(diffMs / 1000);
                        const diffMin = Math.round(diffSec / 60);
                        const diffHour = Math.round(diffMin / 60);
                        const diffDay = Math.round(diffHour / 24);
                        const diffMonth = Math.round(diffDay / 30.44);
                        const diffYear = Math.round(diffDay / 365.25);

                        if (Math.abs(diffSec) < 60) {
                            return rtf.format(diffSec, 'second');
                        }

                        if (Math.abs(diffMin) < 60) {
                            return rtf.format(diffMin, 'minute');
                        }

                        if (Math.abs(diffHour) < 24) {
                            return rtf.format(diffHour, 'hour');
                        }

                        if (Math.abs(diffDay) < 30) {
                            return rtf.format(diffDay, 'day');
                        }

                        if (Math.abs(diffMonth) < 12) {
                            return rtf.format(diffMonth, 'month');
                        }

                        return rtf.format(diffYear, 'year');
                    },

                    /**
                     * Returns the full year of a date (e.g. 2026).
                     * @param {Date|number|string} date
                     * @returns {number}
                     */
                    year: (date) => {
                        const d = toDate(date);
                        return d ? d.getFullYear() : null;
                    },

                    /**
                     * Returns the month of a date as a 1-based integer (1–12).
                     * @param {Date|number|string} date
                     * @returns {number}
                     */
                    month: (date) => {
                        const d = toDate(date);
                        return d ? d.getMonth() + 1 : null;
                    },

                    /**
                     * Returns the day of the month (1–31).
                     * @param {Date|number|string} date
                     * @returns {number}
                     */
                    day: (date) => {
                        const d = toDate(date);
                        return d ? d.getDate() : null;
                    },

                    /**
                     * Returns the locale-aware month name (e.g. "maart" in nl-NL).
                     * @param {Date|number|string} date
                     * @returns {string}
                     */
                    monthName: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return '';
                        }

                        return new Intl.DateTimeFormat(locale, { month: 'long' }).format(d);
                    },

                    /**
                     * Returns the locale-aware weekday name (e.g. "zondag" in nl-NL).
                     * @param {Date|number|string} date
                     * @returns {string}
                     */
                    weekday: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return '';
                        }

                        return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d);
                    },

                    /**
                     * Returns today's date at midnight as a Date object.
                     * @returns {Date}
                     */
                    today: () => {
                        const d = new Date();
                        d.setHours(0, 0, 0, 0);
                        return d;
                    },

                    /**
                     * Returns the current date and time as a Date object.
                     * Note: re-evaluates on every render cycle — use sparingly in binds.
                     * @returns {Date}
                     */
                    now: () => new Date(),

                    /**
                     * Returns true if the date is in the past.
                     * @param {Date|number|string} date
                     * @returns {boolean}
                     */
                    isPast: (date) => {
                        const d = toDate(date);
                        return d ? d.getTime() < Date.now() : false;
                    },

                    /**
                     * Returns true if the date is in the future.
                     * @param {Date|number|string} date
                     * @returns {boolean}
                     */
                    isFuture: (date) => {
                        const d = toDate(date);
                        return d ? d.getTime() > Date.now() : false;
                    },

                    /**
                     * Returns true if two dates fall on the same calendar day.
                     * @param {Date|number|string} a
                     * @param {Date|number|string} b
                     * @returns {boolean}
                     */
                    isSameDay: (a, b) => {
                        const da = toDate(a);
                        const db = toDate(b);

                        if (!da || !db) {
                            return false;
                        }

                        return da.getFullYear() === db.getFullYear()
                            && da.getMonth() === db.getMonth()
                            && da.getDate() === db.getDate();
                    },

                    /**
                     * Returns the difference in whole days between two dates.
                     * Positive if b is after a, negative if before.
                     * @param {Date|number|string} a
                     * @param {Date|number|string} b
                     * @returns {number}
                     */
                    diffDays: (a, b) => {
                        const da = toDate(a);
                        const db = toDate(b);

                        if (!da || !db) {
                            return null;
                        }

                        return Math.round((db.getTime() - da.getTime()) / 86400000);
                    },

                    /**
                     * Returns a new Date with the given number of days added.
                     * Pass a negative value to subtract.
                     * @param {Date|number|string} date
                     * @param {number} n
                     * @returns {Date|null}
                     */
                    addDays: (date, n) => {
                        const d = toDate(date);

                        if (!d) {
                            return null;
                        }

                        const r = clone(d);
                        r.setDate(r.getDate() + n);
                        return r;
                    },

                    /**
                     * Returns a new Date with the given number of months added.
                     * Pass a negative value to subtract.
                     * Clamps to the last day of the target month if the original day
                     * exceeds it (e.g. Jan 31 + 1 month → Feb 28/29).
                     * @param {Date|number|string} date
                     * @param {number} n
                     * @returns {Date|null}
                     */
                    addMonths: (date, n) => {
                        const d = toDate(date);

                        if (!d) {
                            return null;
                        }

                        const r = clone(d);
                        const targetMonth = r.getMonth() + n;
                        r.setDate(1);
                        r.setMonth(targetMonth);
                        r.setDate(Math.min(d.getDate(), new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
                        return r;
                    },

                    /**
                     * Returns a new Date with the given number of years added.
                     * Pass a negative value to subtract.
                     * Clamps Feb 29 to Feb 28 in non-leap target years.
                     * @param {Date|number|string} date
                     * @param {number} n
                     * @returns {Date|null}
                     */
                    addYears: (date, n) => {
                        const d = toDate(date);

                        if (!d) {
                            return null;
                        }

                        const r = clone(d);
                        const targetYear = r.getFullYear() + n;
                        r.setDate(1);
                        r.setFullYear(targetYear);
                        r.setDate(Math.min(d.getDate(), new Date(targetYear, r.getMonth() + 1, 0).getDate()));
                        return r;
                    },

                    /**
                     * Returns a new Date snapped to the start of the given unit (00:00:00.000).
                     * Supported units: 'day', 'week', 'month', 'year'.
                     * Week start is Monday (ISO).
                     * @param {Date|number|string} date
                     * @param {'day'|'week'|'month'|'year'} unit
                     * @returns {Date|null}
                     */
                    startOf: (date, unit) => {
                        const d = toDate(date);

                        if (!d) {
                            return null;
                        }

                        const r = clone(d);

                        switch (unit) {
                            case 'day':
                                r.setHours(0, 0, 0, 0);
                                return r;

                            case 'week': {
                                const dow = r.getDay();
                                const diffToMonday = (dow === 0 ? -6 : 1 - dow);
                                r.setDate(r.getDate() + diffToMonday);
                                r.setHours(0, 0, 0, 0);
                                return r;
                            }

                            case 'month':
                                r.setDate(1);
                                r.setHours(0, 0, 0, 0);
                                return r;

                            case 'year':
                                r.setMonth(0, 1);
                                r.setHours(0, 0, 0, 0);
                                return r;

                            default:
                                console.warn(`dateUtils.startOf: unknown unit "${unit}"`);
                                return null;
                        }
                    },

                    /**
                     * Returns a new Date snapped to the end of the given unit (23:59:59.999).
                     * Supported units: 'day', 'week', 'month', 'year'.
                     * Week end is Sunday (ISO).
                     * @param {Date|number|string} date
                     * @param {'day'|'week'|'month'|'year'} unit
                     * @returns {Date|null}
                     */
                    endOf: (date, unit) => {
                        const d = toDate(date);

                        if (!d) {
                            return null;
                        }

                        const r = clone(d);

                        switch (unit) {
                            case 'day':
                                r.setHours(23, 59, 59, 999);
                                return r;

                            case 'week': {
                                const dow = r.getDay();
                                const diffToSunday = dow === 0 ? 0 : 7 - dow;
                                r.setDate(r.getDate() + diffToSunday);
                                r.setHours(23, 59, 59, 999);
                                return r;
                            }

                            case 'month':
                                r.setMonth(r.getMonth() + 1, 0);
                                r.setHours(23, 59, 59, 999);
                                return r;

                            case 'year':
                                r.setMonth(11, 31);
                                r.setHours(23, 59, 59, 999);
                                return r;

                            default:
                                console.warn(`dateUtils.endOf: unknown unit "${unit}"`);
                                return null;
                        }
                    },

                    /**
                     * Returns true if date falls between start and end (inclusive).
                     * @param {Date|number|string} date
                     * @param {Date|number|string} start
                     * @param {Date|number|string} end
                     * @returns {boolean}
                     */
                    isBetween: (date, start, end) => {
                        const d  = toDate(date);
                        const ds = toDate(start);
                        const de = toDate(end);

                        if (!d || !ds || !de) {
                            return false;
                        }

                        return d.getTime() >= ds.getTime() && d.getTime() <= de.getTime();
                    },

                    /**
                     * Returns true if the date falls on a Saturday or Sunday.
                     * @param {Date|number|string} date
                     * @returns {boolean}
                     */
                    isWeekend: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return false;
                        }

                        const dow = d.getDay();
                        return dow === 0 || dow === 6;
                    },

                    /**
                     * Returns the ISO week number of the year (1–53).
                     * @param {Date|number|string} date
                     * @returns {number|null}
                     */
                    weekNumber: (date) => {
                        const d = toDate(date);

                        if (!d) {
                            return null;
                        }

                        const r = clone(d);
                        r.setHours(0, 0, 0, 0);
                        r.setDate(r.getDate() + 3 - (r.getDay() + 6) % 7);
                        const yearStart = new Date(r.getFullYear(), 0, 4);
                        return 1 + Math.round(((r.getTime() - yearStart.getTime()) / 86400000 - 3 + (yearStart.getDay() + 6) % 7) / 7);
                    },

                    /**
                     * Returns the quarter of the year (1–4).
                     * @param {Date|number|string} date
                     * @returns {number|null}
                     */
                    quarter: (date) => {
                        const d = toDate(date);
                        return d ? Math.ceil((d.getMonth() + 1) / 3) : null;
                    },

                    /**
                     * Returns the number of whole years between two dates.
                     * Positive if b is after a, negative if before.
                     * Equivalent to Delphi's DateUtils.YearsBetween().
                     * @param {Date|number|string} a
                     * @param {Date|number|string} b
                     * @returns {number|null}
                     */
                    yearsBetween: (a, b) => {
                        const da = toDate(a);
                        const db = toDate(b);

                        if (!da || !db) {
                            return null;
                        }

                        return Math.trunc((db.getTime() - da.getTime()) / 31557600000);
                    },

                    /**
                     * Returns the number of whole months between two dates.
                     * Positive if b is after a, negative if before.
                     * Equivalent to Delphi's DateUtils.MonthsBetween().
                     * @param {Date|number|string} a
                     * @param {Date|number|string} b
                     * @returns {number|null}
                     */
                    monthsBetween: (a, b) => {
                        const da = toDate(a);
                        const db = toDate(b);

                        if (!da || !db) {
                            return null;
                        }

                        return Math.trunc((db.getTime() - da.getTime()) / 2629800000);
                    },

                    /**
                     * Returns the number of whole weeks between two dates.
                     * Positive if b is after a, negative if before.
                     * Equivalent to Delphi's DateUtils.WeeksBetween().
                     * @param {Date|number|string} a
                     * @param {Date|number|string} b
                     * @returns {number|null}
                     */
                    weeksBetween: (a, b) => {
                        const da = toDate(a);
                        const db = toDate(b);

                        if (!da || !db) {
                            return null;
                        }

                        return Math.trunc((db.getTime() - da.getTime()) / 604800000);
                    }
                }
            };
        }
    };

})();