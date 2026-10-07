/**
 * Deux machines (2026-10-03, demande de Mika) : la MM-808 et le
 * MM-VOYAGER, cote a cote sur la meme table. focus dit laquelle on
 * utilise : 'all' (vue d'ensemble, desktop : un clic sur une machine zoome
 * dessus), 'mm808' ou 'voy'. Au telephone, une machine a la fois : on
 * glisse pour passer de l'une a l'autre. Le Stage anime le cadrage vers la
 * cible (settled passe a true a l'arrivee) ; les jumeaux, la couche de
 * saisie, l'en-tete et le Dock le lisent.
 *
 * Sans le MM-VOYAGER (?voyager=0), la 808 seule : focus reste 'mm808'.
 */

export type MachineId = 'mm808' | 'voy' | 'bass' | 'dj';
export type Focus = 'all' | MachineId;

/**
 * Le MM-VOYAGER est-il sur la table ? Oui pour tout le monde depuis le
 * 2026-10-03 (Mika : "active le pour tout le monde") ; ?voyager=0 le
 * retire (retenu pour l'onglet), ?voyager=1 le remet.
 */
export const VOYAGER: boolean = (() => {
  if (typeof window === 'undefined') return true;
  try {
    const q = new URLSearchParams(window.location.search).get('voyager');
    if (q === '1' || q === '0') window.sessionStorage.setItem('mm.v4.voyager', q);
    return window.sessionStorage.getItem('mm.v4.voyager') !== '0';
  } catch {
    return true;
  }
})();

/**
 * Le MM-DECKS (2026-10-04, les Decks de sonaa.ca) : a droite du MM-ARP.
 * Sur la table pour tout le monde depuis le 2026-10-04 (Mika : "publie Deck
 * sans le drapeau") ; ?dj=0 le retire (retenu pour l'onglet), ?dj=1 le
 * remet. Il suppose le MM-VOYAGER sur la table.
 */
export const DJ: boolean = (() => {
  if (typeof window === 'undefined' || !VOYAGER) return false;
  try {
    const q = new URLSearchParams(window.location.search).get('dj');
    if (q === '1' || q === '0') window.sessionStorage.setItem('mm.v4.dj', q);
    return window.sessionStorage.getItem('mm.v4.dj') !== '0';
  } catch {
    return true;
  }
})();

/**
 * Le MM-BASS (2026-10-07, Mika : "un prototype de generateur de bassline,
 * la meme taille que MM-RYTM") : a droite du MM-RYTM, le MM-ARP apres lui
 * (la place d'abord a droite du MM-ARP, changee le meme jour).
 * Pour tout le monde ; ?bass=0 le retire (retenu pour l'onglet), ?bass=1 le
 * remet. Il suppose le MM-VOYAGER sur la table.
 */
export const BASS: boolean = (() => {
  if (typeof window === 'undefined' || !VOYAGER) return false;
  try {
    const q = new URLSearchParams(window.location.search).get('bass');
    if (q === '1' || q === '0') window.sessionStorage.setItem('mm.v4.bass', q);
    return window.sessionStorage.getItem('mm.v4.bass') !== '0';
  } catch {
    return true;
  }
})();

/**
 * Les machines sur la table, de gauche a droite : MM-RYTM, MM-BASS, MM-ARP,
 * MM-DECKS (2026-10-07, Mika : "MM-BASS devrait se situer avant MM-ARP" :
 * la basse est a droite du MM-RYTM, avec lui les deux machines de rythme).
 * Le MM-SMPL (2026-10-04) est parti le 2026-10-07 : son sampler est dans
 * chaque platine du MM-DECKS (Mika : "supprime MM-SMPL, ca ne sert a rien").
 */
export const MACHINES: readonly MachineId[] = VOYAGER ? ['mm808', ...(BASS ? (['bass'] as const) : []), 'voy', ...(DJ ? (['dj'] as const) : [])] : ['mm808'];

/**
 * La machine d'arrivee (2026-10-04, Mika : "oui, ajoute ?m=dj") : ?m=dj
 * (ou decks), ?m=arp, ?m=rytm ouvrent le site sur cette machine, apres
 * l'intro (les anciens liens de sonaa.ca vers les Decks y menent). Sans
 * parametre : la vue d'ensemble sur desktop, le MM-RYTM au telephone. Pris
 * une seule fois, au premier Stage (une reconstruction, Dark / Light ou
 * une platine ajoutee, garde la machine en cours).
 */
const START_ALIASES: Readonly<Record<string, MachineId>> = {
  dj: 'dj',
  decks: 'dj',
  'mm-decks': 'dj',
  arp: 'voy',
  voy: 'voy',
  'mm-arp': 'voy',
  rytm: 'mm808',
  '808': 'mm808',
  mm808: 'mm808',
  'mm-rytm': 'mm808',
  bass: 'bass',
  'mm-bass': 'bass',
  acid: 'bass',
  // Le MM-SMPL est dans les platines depuis le 2026-10-07 : ses anciens liens menent au MM-DECKS
  smpl: 'dj',
  sampler: 'dj',
  'mm-smpl': 'dj',
  grain: 'dj',
};
let start: MachineId | null = (() => {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search).get('m');
  const id = q ? START_ALIASES[q.trim().toLowerCase()] : undefined;
  return id && MACHINES.includes(id) ? id : null;
})();
export const startMachine = {
  /** La machine demandee par ?m=, une fois ; null ensuite (ou sans parametre). */
  take(): MachineId | null {
    const s = start;
    start = null;
    return s;
  },
};

let current: Focus = 'mm808';
/** le cadrage est arrive (false pendant le zoom d'une machine a l'autre) */
let settled = true;
let changes = 0;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

export const focus = {
  get: (): Focus => current,
  settled: (): boolean => settled,
  /** Nouvelle cible ; une machine absente de la table : la 808. */
  set(f: Focus): void {
    const next: Focus = f === 'all' || MACHINES.includes(f) ? (VOYAGER ? f : 'mm808') : 'mm808';
    if (next === current) return;
    current = next;
    settled = false;
    changes += 1;
    emit();
  },
  /** Le Stage : le cadrage est arrive. */
  settle(): void {
    if (settled) return;
    settled = true;
    emit();
  },
  /** La machine utilisee (vue d'ensemble : aucune). */
  machine: (): MachineId | null => (current === 'all' ? null : current),
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  get changes(): number {
    return changes;
  },
};
