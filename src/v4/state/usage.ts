/**
 * Ce que l'on mesure de l'usage de MM-STUDIO (2026-10-21, audit SEO IMP4 ; les evenements : state/analytics.ts) :
 * la machine cadree, une machine qui se met a jouer, un sample choisi a la main. Les presets et le partage se
 * mesurent la ou ils se font (state/presets.ts, state/share.ts). Branche au montage de la machine (index.tsx),
 * debranche au demontage.
 */

import { KIT_FAMILIES, kit, type KitFamily } from '../audio/kit';
import { isUserKey } from '../audio/samples';
import { analytics, track } from './analytics';
import { focus, type Focus } from './focus';
import { intro } from './intro';
import { onPlayStart } from './playLock';

/** Les noms courts des machines dans GA4. */
const NAME: Record<Focus, string> = { all: 'studio', mm808: 'rytm', voy: 'arp', bass: 'bass', dj: 'decks' };

/** Un sample choisi ne part qu'une fois le choix pose (la liste qu'on fait defiler ne compte pas a chaque cran). */
const SAMPLE_SETTLE_MS = 1500;

export function startUsage(): () => void {
  // La machine cadree, apres l'intro (l'arrivee n'est pas un choix)
  let lastFocus = focus.get();
  const offFocus = focus.subscribe(() => {
    const f = focus.get();
    if (f === lastFocus) return;
    lastFocus = f;
    if (intro.get() === 'done') track('machine_focus', { machine: NAME[f] });
  });
  const offPlay = onPlayStart((m) => track('play_start', { machine: NAME[m] }));
  // Le sample d'une voix change seul (un geste) : pas un preset, un UNDO ou un beat partage (kit.replace, analytics.hush)
  const last = Object.fromEntries(KIT_FAMILIES.map((f) => [f, kit.get().sample[f] ?? ''])) as Record<KitFamily, string>;
  let pending: { f: KitFamily; timer: number } | null = null;
  const offKit = kit.subscribe((changed) => {
    const now = Object.fromEntries(KIT_FAMILIES.map((f) => [f, kit.get().sample[f] ?? ''])) as Record<KitFamily, string>;
    const moved = KIT_FAMILIES.filter((f) => now[f] !== last[f]);
    Object.assign(last, now);
    if (!moved.length || analytics.hushed() || changed.length !== 1 || moved.length !== 1) {
      if (moved.length && pending) {
        window.clearTimeout(pending.timer);
        pending = null;
      }
      return;
    }
    const f = moved[0];
    if (pending) window.clearTimeout(pending.timer);
    pending = {
      f,
      timer: window.setTimeout(() => {
        pending = null;
        const key = kit.get().sample[f] ?? '';
        // Le nom d'un sample de ce navigateur ne part jamais (c'est un fichier de la personne)
        track('sample_choice', { voice: f, sample: !key ? 'off' : isUserKey(key) ? 'own' : kit.sampleLabel(f), source: !key ? 'synth' : isUserKey(key) ? 'own' : 'site' });
      }, SAMPLE_SETTLE_MS),
    };
  });
  return () => {
    offFocus();
    offPlay();
    offKit();
    if (pending) window.clearTimeout(pending.timer);
  };
}
