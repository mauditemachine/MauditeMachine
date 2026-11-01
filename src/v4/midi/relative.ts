/**
 * Les CC relatifs (V.6.0, lane B6, cahier dt2 2.6 et critique C4) : LEVEL/DATA (rytm:data) est un encodeur sans butee, sa
 * cible MIDI est de kind 'relative' et recoit des crans signes. Un controleur l'envoie de l'une de ces facons :
 * - abs : un potard ordinaire, 0 a 127 (le Roto-Control dans ses setups) ; le cran est l'ecart a la valeur d'avant ;
 * - twos : complement a deux (1 a 63 : +1 a +63 ; 127 a 65 : -1 a -63), le plus courant ;
 * - offset : decalage binaire (65 : +1, 63 : -1 ; 64 : rien) ;
 * - sign : bit de signe (1 a 63 : +1 a +63 ; 65 a 127 : -1 a -63).
 * Personne ne le dit : on le devine aux premieres valeurs, une fois par cle (cc:canal:numero), et on peut se raviser tant
 * que la preuve manque. Pur, sans dependance (node le lit tel quel).
 *
 * Regles : une valeur de 16 a 48 ou de 80 a 112 n'existe que sur un potard absolu (abs, definitif) ; 113 a 127, le
 * complement a deux (definitif) ; 49 a 63, le decalage binaire (definitif) ; 1 a 15 puis 65 a 79 (ou l'inverse) : le
 * bit de signe (definitif) ; 1 a 15 seuls : twos (provisoire, le meme sens que sign) ; 65 a 79 seuls ou 64 : offset
 * (provisoire) ; deux valeurs egales de suite hors des bords : un relatif (un potard absolu ne repete pas). Une entree
 * Roto (son nom contient "roto") est toujours abs : ses potards sont absolus dans les setups du site.
 */

export type RelMode = 'abs' | 'twos' | 'offset' | 'sign';

export interface RelState {
  /** le mode retenu ; null : rien vu */
  mode: RelMode | null;
  /** le mode est prouve (il ne change plus) */
  sure: boolean;
  /** la derniere valeur (0 a 127) */
  last: number | null;
}

export const relStart = (abs = false): RelState => ({ mode: abs ? 'abs' : null, sure: abs, last: null });

/** Un ecart abs au-dela : un saut (le potard a ete tourne ailleurs), on ne le prend pas en entier. */
const ABS_JUMP = 16;

const inAbs = (v: number): boolean => (v >= 16 && v <= 48) || (v >= 80 && v <= 112);

/** Le mode apres une valeur (et ce qu'on savait). */
function classify(s: RelState, v: number): { mode: RelMode; sure: boolean } {
  if (s.sure && s.mode) return { mode: s.mode, sure: true };
  if (inAbs(v)) return { mode: 'abs', sure: true };
  if (v >= 113) return { mode: 'twos', sure: true };
  if (v >= 49 && v <= 63) return { mode: 'offset', sure: true };
  const lo = v >= 1 && v <= 15;
  const hi = v >= 65 && v <= 79;
  if (lo && (s.mode === 'offset' || s.mode === 'sign')) return { mode: 'sign', sure: s.mode === 'offset' || s.sure };
  if (hi && (s.mode === 'twos' || s.mode === 'sign')) return { mode: 'sign', sure: true };
  // Une valeur repetee hors des bords : un relatif, le mode deja devine reste
  const repeat = s.last === v && v !== 0 && v !== 127;
  if (lo) return { mode: s.mode === 'abs' && !repeat ? 'abs' : 'twos', sure: false };
  if (hi || v === 64) return { mode: s.mode === 'abs' && !repeat ? 'abs' : 'offset', sure: false };
  // 0 (ou 127 deja traite) : un bord, abs si rien d'autre
  return { mode: s.mode ?? 'abs', sure: false };
}

/** Les crans d'une valeur dans un mode (abs : l'ecart a la derniere). */
function deltaOf(mode: RelMode, v: number, last: number | null): number {
  switch (mode) {
    case 'twos':
      return v === 0 ? 0 : v < 64 ? v : v - 128;
    case 'offset':
      return v - 64;
    case 'sign':
      return v === 0 || v === 64 ? 0 : v < 64 ? v : -(v - 64);
    default: {
      if (last === null) return 0;
      const d = v - last;
      return Math.abs(d) > ABS_JUMP ? Math.sign(d) : d;
    }
  }
}

/** Une valeur recue (0 a 127) : les crans a tourner et l'etat suivant de la cle. */
export function relDecode(s: RelState, v7: number): { delta: number; next: RelState } {
  const v = Math.max(0, Math.min(127, Math.round(Number.isFinite(v7) ? v7 : 0)));
  const c = classify(s, v);
  // Un passage de abs (devine) a un relatif : la valeur d'avant ne voulait rien dire, on prend celle-ci comme un cran
  const delta = deltaOf(c.mode, v, c.mode === 'abs' ? s.last : null);
  return { delta, next: { mode: c.mode, sure: c.sure, last: v } };
}
