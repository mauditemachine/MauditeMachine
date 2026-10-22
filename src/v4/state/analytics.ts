/**
 * Les evenements GA4 de MM-STUDIO (2026-10-21, audit SEO F8 et IMP4, Mika : "je veux du monde dans mon site !") :
 * sans eux, impossible de savoir combien de gens jouent, partagent un beat, choisissent un preset ou un sample, ni si
 * un lancement (Reddit, TikTok...) a marche. Aucun traceur de plus : la fonction gtag d'index.html (le meme
 * G-HP92HGMNJT, sa file dataLayer) s'il est la ; sans lui (bloque, absent), rien ne part et rien ne casse. En dev,
 * rien ne part non plus (les sessions de Mika ne gonflent pas les chiffres) : les evenements restent dans log, pour
 * les tests (window.__v4.analytics, debug.ts).
 *
 * Le consentement n'est pas decide ici (audit SEO F7, une decision de Mika : docs/seo/2026-10-21-plan-trafic.md) :
 * ces evenements suivent ce que fait gtag pour la page vue.
 *
 * Les evenements (noms et parametres courts, en snake_case comme GA4) :
 * - machine_focus { machine } : une machine cadree apres l'intro (rytm, arp, bass, decks, studio) ;
 * - play_start { machine } : une machine se met a jouer (RUN, l'arpege, une platine) ;
 * - preset_load { machine, factory, preset } : un preset charge (son nom si c'est un preset d'usine) ;
 * - sample_choice { voice, sample, source } : un son choisi a la main pour une voix du MM-RYTM (le nom d'un sample de
 *   ce navigateur ne part jamais : 'own') ;
 * - share_beat { method, bpm } et open_shared_beat { ok, bpm } : le lien de partage (state/share.ts).
 * Le meme evenement avec les memes parametres en moins de 1,5 s n'est envoye qu'une fois (un double clic, un
 * potard qu'on fait defiler).
 */

type Params = Record<string, string | number | boolean>;

interface Logged {
  name: string;
  params: Params;
  at: number;
  sent: boolean;
}

const DEDUP_MS = 1500;
const LOG_MAX = 60;
const log: Logged[] = [];
const lastSent = new Map<string, number>();
let hushUntil = 0;

type Gtag = (...args: unknown[]) => void;

/** Un evenement GA4 ; rien sans gtag, rien en dev, jamais d'exception. */
export function track(name: string, params: Params = {}): void {
  try {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const key = `${name}|${JSON.stringify(params)}`;
    const last = lastSent.get(key);
    if (last !== undefined && now - last < DEDUP_MS) return;
    lastSent.set(key, now);
    const g = typeof window !== 'undefined' ? (window as Window & { gtag?: Gtag }).gtag : undefined;
    const send = !import.meta.env.DEV && typeof g === 'function';
    if (send) g('event', name, params);
    log.push({ name, params, at: now, sent: send });
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  } catch {
    /* une mesure ne casse jamais la machine */
  }
}

export const analytics = {
  /** Les derniers evenements (tests). */
  log: (): readonly Logged[] => log.slice(),
  /**
   * Les changements qui suivent ne sont pas des gestes (un preset, un beat partage ou un UNDO remis sur la machine,
   * state/presets.ts apply) : pas de sample_choice pendant ms.
   */
  hush(ms = 400): void {
    hushUntil = Math.max(hushUntil, (typeof performance !== 'undefined' ? performance.now() : Date.now()) + ms);
  },
  hushed: (): boolean => (typeof performance !== 'undefined' ? performance.now() : Date.now()) < hushUntil,
};
