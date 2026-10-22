/**
 * Le demarrage visible de l'accueil (2026-10-21, audit SEO F1 et runtime RS-6, Mika : "je veux du monde dans mon site
 * !") : au telephone en 4G lente, l'accueil restait un ecran noir vide environ 4,5 s, le temps de 560 Ko de JavaScript.
 * scripts/prerender-seo.mjs pose maintenant dans le HTML des pages de la machine une coquille (#mm-boot : le logo, le
 * titre de la page, une ligne, une barre qui avance), peinte avec le HTML, avant le moindre script. La machine la
 * retire ici, en fondu, quand elle a de quoi la remplacer :
 * - la premiere image de la scene (scene/renderer.ts) : l'intro commence, telle qu'avant ;
 * - le repli sans WebGL (index.tsx) ;
 * - une arrivee par une section hors capot (/tracks/, /shows/...) : son panneau, ouvert au montage, se peint d'abord.
 * Une navigation du routeur vers une autre page la retire aussi (src/App.tsx). ready() dit ensuite que le demarrage est
 * fait : ce qui peut attendre (les WAV du MM-RYTM, audio/shots.ts prewarm ; les photos du hoodie du menu) part apres,
 * pour ne plus prendre de bande passante au JavaScript de la machine. Sans coquille (le serveur de dev, une page
 * archivee), seul ready() compte.
 */

const SHELL_ID = 'mm-boot';
/** La duree du fondu de la coquille (le style de prerender-seo.mjs : opacity .35s). */
const FADE_MS = 380;

let ready = false;
const listeners = new Set<() => void>();

/** La coquille, en fondu puis retiree ; rien si elle n'est pas (ou plus) la. */
export function hideShell(): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(SHELL_ID);
  if (!el || el.dataset.gone === '1') return;
  el.dataset.gone = '1';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  window.setTimeout(() => el.remove(), FADE_MS);
}

export const boot = {
  ready: (): boolean => ready,
  /** Le demarrage est fait : la coquille s'en va, ce qui attendait part (une fois). */
  mark(): void {
    hideShell();
    if (ready) return;
    ready = true;
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch {
        /* un abonne ne bloque pas les autres */
      }
    }
    listeners.clear();
  },
  /** fn apres le demarrage (tout de suite s'il est deja fait) ; rend de quoi se desabonner. */
  onReady(fn: () => void): () => void {
    if (ready) {
      fn();
      return () => undefined;
    }
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
