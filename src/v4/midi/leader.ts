/**
 * Un seul onglet pilote le Roto-Control (2026-10-08, Mika : "Roto control :
 * des fois ca fonctionne, des fois ca ne fonctionne pas"). Deux onglets du
 * site ouverts recevaient tous les deux le Roto : les deux jouaient, et les
 * deux renvoyaient leurs valeurs aux memes potards motorises, qui sautaient
 * d'un jeu de valeurs a l'autre. Desormais l'onglet montre ou choisi en
 * dernier (focus, onglet qui redevient visible) prend la main ; les autres
 * ignorent le MIDI et n'envoient plus rien, leur panneau MIDI le dit.
 * - BroadcastChannel 'mm-midi' : une revendication { id, at } ; la plus
 *   recente gagne partout (a egalite, le plus grand id), donc tous les
 *   onglets tombent d'accord meme si deux revendiquent en meme temps ;
 * - un onglet qui arrive demande qui pilote ; celui qui pilote repond. Un
 *   onglet ouvert en fond (cache) attend la reponse et ne prend la main que
 *   si personne ne l'a ;
 * - l'onglet qui pilote se ferme : un onglet visible reprend tout de suite,
 *   sinon un onglet cache apres un court delai (si personne ne l'a fait).
 * Le canal est par origine : le site en ligne et le site en local
 * (localhost) ne se voient pas ; fermer l'autre onglet reste la regle.
 */

type Msg = { t: 'claim'; id: string; at: number } | { t: 'hello'; id: string } | { t: 'bye'; id: string };

const me = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
let leaderId: string | null = null;
let leaderAt = 0;
let bc: BroadcastChannel | null = null;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

/** Cet onglet pilote (sans BroadcastChannel : toujours). */
const leads = (): boolean => !bc || leaderId === me;

/** Une revendication recue (ou la sienne) : la plus recente gagne. */
function take(id: string, at: number): void {
  if (leaderId !== null && (at < leaderAt || (at === leaderAt && id < leaderId))) return;
  const was = leads();
  leaderId = id;
  leaderAt = at;
  if (was !== leads()) emit();
}

/** Cet onglet prend la main. */
function claim(): void {
  if (!bc) return;
  const at = Math.max(Date.now(), leaderAt + 1);
  take(me, at);
  try {
    bc.postMessage({ t: 'claim', id: me, at } satisfies Msg);
  } catch {
    /* canal ferme */
  }
}

const visible = (): boolean => typeof document === 'undefined' || document.visibilityState === 'visible';

if (typeof window !== 'undefined' && typeof BroadcastChannel === 'function') {
  try {
    bc = new BroadcastChannel('mm-midi');
  } catch {
    bc = null;
  }
}

if (bc) {
  const chan = bc;
  chan.onmessage = (e: MessageEvent<Msg>) => {
    const m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.t === 'claim' && typeof m.at === 'number') take(m.id, m.at);
    else if (m.t === 'hello' && leaderId === me) chan.postMessage({ t: 'claim', id: me, at: leaderAt } satisfies Msg);
    else if (m.t === 'bye' && m.id === leaderId) {
      // Celui qui pilotait est parti : un onglet visible reprend, sinon le premier onglet cache
      const was = leads();
      leaderId = null;
      leaderAt = 0;
      if (was !== leads()) emit();
      if (visible()) claim();
      else
        window.setTimeout(() => {
          if (leaderId === null) claim();
        }, 150 + Math.random() * 150);
    }
  };
  chan.postMessage({ t: 'hello', id: me } satisfies Msg);
  // Un onglet visible a l'arrivee prend la main ; un onglet cache attend la reponse
  if (visible()) claim();
  else
    window.setTimeout(() => {
      if (leaderId === null) claim();
    }, 400);
  window.addEventListener('focus', claim);
  document.addEventListener('visibilitychange', () => {
    if (visible()) claim();
  });
  window.addEventListener('pagehide', () => {
    if (leaderId === me) chan.postMessage({ t: 'bye', id: me } satisfies Msg);
  });
}

export const midiLeader = {
  leads,
  /** USE MIDI HERE (le panneau MIDI) : cet onglet prend la main. */
  claim,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
