/**
 * Le double clic sur un potard de la face (2026-11-13, le plugin MM-ARP seul) : au site, deux tapes remettent le potard
 * a sa valeur de depart (ui/Hotspots.tsx tapDial). Le plugin inscrit ici son crochet : deux tapes ouvrent le capot sur
 * la page du reglage (plugin/arp/hoodPage.ts), la remise passe a Alt / Cmd / Ctrl + clic. Vide au site : rien ne change.
 */

let hook: ((dial: string) => boolean) | null = null;

export const faceDbl = {
  /** Le crochet du plugin ; null le retire. */
  set(fn: ((dial: string) => boolean) | null): void {
    hook = fn;
  },
  /** Deux tapes sur ce potard (DialId : v:<id>, z:<id>) : true si le plugin les a prises. */
  open(dial: string): boolean {
    return hook ? hook(dial) : false;
  },
  /** Le plugin a-t-il un crochet (la remise passe alors au clic avec modificateur) ? */
  on(): boolean {
    return hook !== null;
  },
};
