/**
 * Le clic sur un potard de la face (le plugin MM-ARP seul). Au site, une tape ne fait rien de plus (deux tapes : la valeur
 * de depart, ui/Hotspots.tsx tapDial). Le plugin inscrit ici son crochet (plugin/arp/hellKnob.tsx) : un clic sans
 * mouvement ouvre le capot sur la page du reglage (2026-11-16 ; le double clic du 2026-11-13 avant), la remise passe a
 * Alt / Cmd / Ctrl + clic. Vide au site : rien ne change.
 */

let hook: ((dial: string) => boolean) | null = null;

export const faceDbl = {
  /** Le crochet du plugin ; null le retire. */
  set(fn: ((dial: string) => boolean) | null): void {
    hook = fn;
  },
  /** Un clic sur ce potard (DialId : v:<id>, z:<id>) : true si le plugin l'a pris. */
  open(dial: string): boolean {
    return hook ? hook(dial) : false;
  },
  /** Le plugin a-t-il un crochet (le clic ouvre, la remise passe au clic avec modificateur) ? */
  on(): boolean {
    return hook !== null;
  },
};
