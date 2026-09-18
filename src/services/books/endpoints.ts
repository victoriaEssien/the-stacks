/**
 * Where our own endpoints live.
 *
 * Deliberately a file of nothing but strings. The client needs these paths and
 * so do the handlers, and if the client imported them from a handler's module
 * then that handler would sit in the browser's module graph, dropped only by
 * tree shaking - which holds right up until someone reads `process.env` at the
 * top level of one and the bundle breaks on import.
 */

export const COVER_PROXY_PATH = '/api/cover';
export const SEARCH_PROXY_PATH = '/api/search';
