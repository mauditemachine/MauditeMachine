/**
 * MM-ARP dans le navigateur (2026-11-25, /mm-arp/play/) : l'etat de l'instance a part de celui du site. Dans le VST3,
 * la face a son propre stockage (la WebView, l'etat du projet : plugin/restore.ts) ; ici, la page partage l'origine du
 * site : sans rien faire, la face du plugin ecrirait dans les cles mm.v4.* du MM-ARP et du MM-RYTM du site (les potards,
 * le tempo, et des presets mis de cote avec les accords du plugin, chordBank 2, que le site lirait de travers).
 *
 * window.localStorage devient, pour toute la page, un stockage ou chaque cle mm.v4.* vit sous mm.web.arp.ls:mm.v4.*
 * (celles du site restent intactes et invisibles) ; les autres cles passent telles quelles. A poser avant le premier
 * module de la machine (les stores lisent le localStorage a leur chargement). Un rechargement de /mm-arp/play/ retrouve
 * l'etat de l'instance, comme un projet rouvert.
 */

const SITE = 'mm.v4.';
const NS = 'mm.web.arp.ls:';

let done = false;

export function isolateStorage(): void {
  if (done || typeof window === 'undefined') return;
  let real: Storage;
  try {
    real = window.localStorage;
    if (!real) return;
  } catch {
    // stockage refuse : la face fait deja sans
    return;
  }
  done = true;
  const inner = (k: string): string => (k.startsWith(SITE) ? NS + k : k);
  /** Les cles que la page voit : celles de l'instance (sans l'espace), les autres ; jamais les mm.v4.* du site. */
  const visible = (): string[] => {
    const out: string[] = [];
    for (let i = 0; i < real.length; i += 1) {
      const k = real.key(i);
      if (k === null || k.startsWith(SITE)) continue;
      out.push(k.startsWith(NS) ? k.slice(NS.length) : k);
    }
    return out;
  };
  const store: Storage = {
    get length(): number {
      return visible().length;
    },
    key: (i: number): string | null => visible()[i] ?? null,
    getItem: (k: string): string | null => real.getItem(inner(String(k))),
    setItem: (k: string, v: string): void => real.setItem(inner(String(k)), String(v)),
    removeItem: (k: string): void => real.removeItem(inner(String(k))),
    // seulement l'etat de l'instance (jamais le reste du site)
    clear: (): void => {
      for (const k of visible()) if (k.startsWith(SITE)) real.removeItem(NS + k);
    },
  };
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => store });
  } catch {
    done = false;
  }
}
