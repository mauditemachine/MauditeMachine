/**
 * Le navigateur des sons du MM-RYTM (2026-10-18, Mika : "Je trouve ca
 * difficile la selection des samples dans RYTM, y aurait-il une autre
 * facon ?") : la liste ENTIERE de SOUND de la voix choisie sur le grand
 * ecran (OFF, 909, 808, MM, les samples du site, puis ceux de ce navigateur,
 * enfin + LOAD A FILE... ; en P-LOCK, les samples des autres voix aussi : le
 * sample lock), autant de lignes que l'ecran en tient, le son du moment en
 * surbrillance, son rang (7 / 24) et une fine barre de defilement. Il
 * remplace la liste de trois lignes du 2026-10-05 (2,4 s apres un cran du
 * potard, trop courte pour choisir parmi vingt samples).
 *
 * Ce store ne garde que ce que l'ecran ne peut pas deviner : ouverte ou non,
 * la premiere ligne montree (le defilement), la ligne du clavier (le
 * curseur ; -1 : il suit le son), la ligne qui attend sa confirmation pour
 * partir (REMOVE? TAP AGAIN), une demande de focus du clavier (Entree sur le
 * bloc SOUND) et le fichier qu'on glisse au-dessus de la machine (DROP ON A
 * PAD). La liste elle-meme et ses regles viennent d'actions.ts
 * (soundBrowserView, voiceSounds) ; l'ecran (scene/screen.ts paintBrowser) la
 * dessine, ses zones (scene/renderer.ts) et ses jumeaux (ui/Hotspots.tsx) la
 * suivent.
 *
 * Ouverte par une tape sur le bloc SOUND de VOICE, un cran de SOUND, PREV et
 * NEXT ; elle reste jusqu'a Echap, une tape hors d'elle, une touche de page,
 * EDIT, les presets, le P-LOCK qui change, une autre machine, ou
 * BROWSER_IDLE_MS sans geste (actions.ts) ; une autre voix touchee : la liste
 * la suit. Un message de l'ecran (lcdMessage) ne la ferme plus : il s'ecrit a
 * son pied.
 */

import { OLED_UH, type Inst } from '../theme';

/** Sans geste pendant ce temps, la liste se ferme. */
export const BROWSER_IDLE_MS = 12000;
/**
 * Les lignes montrees : 6 au desktop (12,5 unites chacune, 18 px a l'ecran) ;
 * 4 sur l'ecran haut du telephone (27 unites, 22 px : assez pour un doigt,
 * le reste defile en glissant).
 */
export const BROWSER_ROWS = OLED_UH > 120 ? 4 : 6;
/** Une ligne armee pour partir (REMOVE? TAP AGAIN) le reste ce temps. */
export const BROWSER_ARM_MS = 4000;
/** Le fichier glisse au-dessus de la machine : son annonce tient ce temps apres le dernier dragover. */
export const DROP_HINT_MS = 400;

export interface SoundBrowserState {
  readonly open: boolean;
  /** la premiere ligne montree */
  readonly top: number;
  /** la ligne du clavier (fleches) ; -1 : celle du son du moment */
  readonly cursor: number;
  /** la ligne qui attend sa confirmation pour partir (un sample de ce navigateur), -1 aucune */
  readonly arm: number;
  /** compte les demandes de focus du clavier (Entree sur le bloc SOUND) : le jumeau de la liste le prend */
  readonly focus: number;
  /** un fichier glisse au-dessus du MM-RYTM : la voix sous le pointeur, 'pad' ailleurs sur la machine ; null rien */
  readonly drop: Inst | 'pad' | null;
  /** la ligne montree sous la souris (son rang a l'ecran, 0 la premiere montree ; desktop), -1 aucune */
  readonly hover: number;
}

const CLOSED: SoundBrowserState = { open: false, top: 0, cursor: -1, arm: -1, focus: 0, drop: null, hover: -1 };
let state: SoundBrowserState = CLOSED;
const listeners = new Set<() => void>();
let idleTimer = 0;
let armTimer = 0;
let dropTimer = 0;
/** Les attentes en cours (le choix des fichiers du systeme ouvert, un fichier qui entre) : le repos ne compte pas pendant elles. */
let holds = 0;

function emit(): void {
  listeners.forEach((fn) => fn());
}

function set(next: Partial<SoundBrowserState>): void {
  const prev = state;
  state = { ...state, ...next };
  if (state.top !== prev.top || state.cursor !== prev.cursor || state.arm !== prev.arm || state.open !== prev.open || state.focus !== prev.focus || state.drop !== prev.drop || state.hover !== prev.hover) emit();
}

/** Le minuteur du repos : BROWSER_IDLE_MS apres le dernier geste, la liste se ferme. */
function armIdle(): void {
  if (typeof window === 'undefined') return;
  window.clearTimeout(idleTimer);
  idleTimer = 0;
  if (holds > 0) return;
  idleTimer = window.setTimeout(() => {
    idleTimer = 0;
    lcdSamples.close();
  }, BROWSER_IDLE_MS);
}

export const lcdSamples = {
  get: (): SoundBrowserState => state,
  /** La liste est-elle ouverte ? */
  isOpen: (): boolean => state.open,
  /** Ouverte (ou deja ouverte : son repos repart), sa premiere ligne a top ; focus : le clavier la prend (Entree sur SOUND). */
  open(top: number, focus = false): void {
    armIdle();
    if (state.open) {
      if (focus) set({ focus: state.focus + 1 });
      return;
    }
    set({ open: true, top: Math.max(0, Math.round(top)), cursor: -1, arm: -1, hover: -1, focus: state.focus + (focus ? 1 : 0) });
  },
  /** Un geste dans la liste (une ligne, la molette, PREV et NEXT, un cran de SOUND) : son repos repart. */
  touch(): void {
    if (state.open) armIdle();
  },
  /**
   * Le repos suspendu (revue du 2026-10-18 : le choix des fichiers du systeme reste ouvert plus de douze secondes, le
   * fichier choisi revenait sur une liste fermee) : tant qu'une attente tient, la liste ne se ferme pas d'elle-meme ;
   * rend de quoi la lever, une fois (le repos repart alors de zero).
   */
  hold(): () => void {
    holds += 1;
    if (typeof window !== 'undefined') window.clearTimeout(idleTimer);
    idleTimer = 0;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      holds = Math.max(0, holds - 1);
      if (holds === 0 && state.open) armIdle();
    };
  },
  /** Le defilement, le curseur, la ligne armee (bornes posees par actions.ts) ; un geste aussi. */
  update(patch: Partial<Pick<SoundBrowserState, 'top' | 'cursor' | 'arm'>>): void {
    if (!state.open) return;
    armIdle();
    if (patch.arm !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(armTimer);
      armTimer = 0;
      if (patch.arm >= 0)
        armTimer = window.setTimeout(() => {
          armTimer = 0;
          set({ arm: -1 });
        }, BROWSER_ARM_MS);
    }
    set(patch);
  },
  /** Fermee (Echap, une tape dehors, une touche de page, le repos...). */
  close(): void {
    if (typeof window !== 'undefined') {
      window.clearTimeout(idleTimer);
      window.clearTimeout(armTimer);
    }
    idleTimer = 0;
    armTimer = 0;
    if (!state.open) return;
    set({ open: false, cursor: -1, arm: -1, hover: -1 });
  },
  /** La ligne montree sous la souris (desktop, scene/renderer.ts setHover), -1 aucune. */
  hover(k: number): void {
    const h = Math.max(-1, Math.round(k));
    if (h !== state.hover) set({ hover: h });
  },
  /**
   * Un fichier glisse au-dessus de la machine (2026-10-18) : la voix sous le
   * pointeur ('pad' : ailleurs sur le MM-RYTM ; null : plus rien). Chaque
   * dragover le repose ; sans lui pendant DROP_HINT_MS, l'annonce s'en va.
   */
  dragOver(target: Inst | 'pad' | null): void {
    if (typeof window !== 'undefined') {
      window.clearTimeout(dropTimer);
      dropTimer = 0;
      if (target)
        dropTimer = window.setTimeout(() => {
          dropTimer = 0;
          set({ drop: null });
        }, DROP_HINT_MS);
    }
    set({ drop: target });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
