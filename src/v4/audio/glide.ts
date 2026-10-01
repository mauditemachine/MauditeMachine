/**
 * Rampe des reglages audio (TONE, LEVEL, DIST, REVERB, DELAY, CHORUS,
 * STRETCH, inserts) : 20 ms, section 19 item 51.
 */

export const GLIDE_S = 0.02;

/**
 * Rampe lineaire de 20 ms depuis une valeur posee a l'instant present.
 * Pas setTargetAtTime : Chrome calcule cette approche pas a pas sur les
 * blocs REELLEMENT rendus, et un noeud au repos (bus muet entre deux coups)
 * n'en rend aucun ; le premier coup apres un reglage partait alors avec
 * l'ancienne valeur (mesure a l'analyseur : CH plein pot juste apres TONE
 * a 0). Une rampe se calcule depuis ses deux points, rendu ou non.
 */
export function glide(p: AudioParam, target: number, c: BaseAudioContext): void {
  const now = c.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(target, now + GLIDE_S);
}
