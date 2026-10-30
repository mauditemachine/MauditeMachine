/**
 * window.__v4 (spec 15.2), installe seulement avec ?debug=1 : le baril (P0, 2026-10-30, cahier dt2 5.0). Le coeur et
 * ses types dans debug/index.ts ; un fichier par lane (debug/audio.ts, face.ts, input.ts, screen.ts) pour ses champs.
 * Aucun import du site ne change.
 */

export * from './debug/index';
