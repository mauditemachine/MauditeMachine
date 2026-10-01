/**
 * STRETCH (2026-10-01, comme le Time d'Impulse) : de -1 a +1 (-100 a
 * +100 % a l'ecran), 0 au centre. Il raccourcit (vers la gauche) ou
 * allonge (vers la droite) chaque coup : ses durees (balayage de hauteur,
 * enveloppes, queue) sont multipliees par 4^v, de x0.25 a x4 ; ses
 * frequences ne bougent pas. Applique a la programmation de chaque coup,
 * comme la hauteur de TONE : aucun traitement sur le bus, rien ne tourne
 * au repos, un coup deja parti garde sa duree. STRETCH du pattern et
 * STRETCH de la voix se multiplient (produit borne de x0.15 a x6).
 *
 * Remplace l'etirement granulaire de la revision 5 (un AudioWorklet sur le
 * bus, qui hachait le son).
 */

export const TIME = {
  /** facteur a +1 (et son inverse a -1) */
  range: 4,
  /** accrochage au centre : |v| sous ce seuil vaut 0 (4 sur 100) */
  snap: 0.04,
  min: 0.15,
  max: 6,
} as const;

/** Valeur bornee a -1..1 et accrochee au centre. */
export const snapTime = (v: number): number => {
  const c = Number.isFinite(v) ? (v < -1 ? -1 : v > 1 ? 1 : v) : 0;
  return Math.abs(c) < TIME.snap ? 0 : c;
};

/** Facteur des durees : exactement 1 a 0. */
export const timeFactor = (v: number): number => (v === 0 ? 1 : Math.pow(TIME.range, snapTime(v)));

/** Facteur d'un coup : celui du pattern par celui de la voix, borne. */
export const hitTime = (pattern: number, voice: number): number => {
  const f = timeFactor(pattern) * timeFactor(voice);
  return f < TIME.min ? TIME.min : f > TIME.max ? TIME.max : f;
};
