/**
 * Thousands separators, in whatever the browser's locale is. A busy site's log runs
 * into six figures, and "1000000" is a number nobody can read at a glance.
 */
export const num = (value) => Number(value || 0).toLocaleString();
