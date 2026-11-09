/**
 * Le plugin (2026-11-08, plugin/mm-rytm) : la face du MM-RYTM dans la fenetre du VST3 (WebView JUCE). Pose par la page du
 * plugin (window.__MM_PLUGIN__, avant tout module) ou ?plugin=1 (essai dans un navigateur). Lu a l'evaluation des modules,
 * jamais retenu. Un module sans import : rytm/faceplate.ts (la geometrie de la face) le lit sans cycle avec theme/base.ts
 * (qui le reexporte en PLUGIN).
 */
export const IN_PLUGIN: boolean = (() => {
  if (typeof window === 'undefined') return false;
  try {
    if ((window as unknown as { __MM_PLUGIN__?: boolean }).__MM_PLUGIN__ === true) return true;
    return new URLSearchParams(window.location.search).get('plugin') === '1';
  } catch {
    return false;
  }
})();
