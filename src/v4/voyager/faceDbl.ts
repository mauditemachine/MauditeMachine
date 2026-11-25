/**
 * Le clic sur un potard de la face (le plugin MM-ARP seul). Au site, une tape ne fait rien de plus (deux tapes : la valeur
 * de depart, ui/Hotspots.tsx tapDial). Le plugin inscrit ici son crochet (plugin/arp/hellKnob.tsx) : un clic sans
 * mouvement ouvre le capot sur la page du reglage (2026-11-16 ; le double clic du 2026-11-13 avant).
 *
 * v54 (2026-11-25, Mika : "quand on double clic sur un knob on reset ce meme knob") : le double clic remet le potard a sa
 * valeur de depart (Alt / Cmd / Ctrl + clic aussi, comme avant). Un potard qui a sa page l'ouvre donc FACE_DBL.ms apres le
 * clic, le temps de voir si un deuxieme appui suit (il annule l'ouverture). Vide au site : rien ne change.
 */

/** Ce qu'a fait le clic : 'act' une action (un levier, une touche, un cran, le viseur), 'knob' rien (un potard), ou la page a ouvrir plus tard. */
export type FaceTap = 'act' | 'knob' | (() => void);

/** Le double clic : le deuxieme appui au plus ms apres le premier lacher (le meme potard). */
export const FACE_DBL = { ms: 300 } as const;

let hook: ((dial: string) => FaceTap) | null = null;
let timer = 0;

export const faceDbl = {
  /** Le crochet du plugin ; null le retire. */
  set(fn: ((dial: string) => FaceTap) | null): void {
    hook = fn;
    faceDbl.cancel();
  },
  /** Un clic sur ce potard (DialId : v:<id>, z:<id>) : 'page' si sa page s'ouvre dans FACE_DBL.ms, sinon ce qu'a fait le clic. */
  open(dial: string): 'act' | 'knob' | 'page' {
    faceDbl.cancel();
    const r = hook ? hook(dial) : 'knob';
    if (typeof r !== 'function') return r;
    timer = window.setTimeout(() => {
      timer = 0;
      r();
    }, FACE_DBL.ms);
    return 'page';
  },
  /** Le deuxieme appui d'un double clic (ou un clic avec modificateur) : la page attendue ne s'ouvre pas. */
  cancel(): void {
    if (timer !== 0) window.clearTimeout(timer);
    timer = 0;
  },
  /** Le plugin a-t-il un crochet (le clic ouvre, le double clic remet) ? */
  on(): boolean {
    return hook !== null;
  },
};
