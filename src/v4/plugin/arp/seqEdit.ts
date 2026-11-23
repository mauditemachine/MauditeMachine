/**
 * v50 : ce que partagent les deux vues du sequenceur, la page SEQ d'OPEN (pages2.tsx) et la page SQ de l'encart d'EDIT
 * (encart50.ts) : l'accord dont on lit les notes, la note des potards a une place, l'ecriture des notes d'un coup, le
 * hasard doux des pistes. Les deux vues lisent et ecrivent les memes donnees (voyager/seq.ts, steps.ts) : elles restent
 * synchronisees sans rien de plus.
 */

import { arp, arpExternal } from '../../voyager/arp';
import { degreeMidi, degreeName, type ArpMode } from '../../voyager/chords';
import { stepIndex, voyParams } from '../../voyager/params';
import { poolSteps, seq, SEQ_MAX, SEQ_MIN, SEQ_TOP, type SeqStep } from '../../voyager/seq';
import { STEPS_N, type StepTrack } from './steps';

/**
 * La piste NOTES (v27, la maquette v26 validee) : CHORD, l'accord dont on lit les notes (celui qui joue, sinon le premier
 * de la progression ; un clic en choisit un, un second le rend). La page SQ suit le meme choix.
 */
let notesView: number | null = null;
const notesViewL = new Set<() => void>();
export const notesViewStore = {
  get: (): number | null => notesView,
  set(v: number | null): void {
    notesView = v;
    notesViewL.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    notesViewL.add(fn);
    return () => {
      notesViewL.delete(fn);
    };
  },
};

/** L'accord dont on lit les notes (le choix de CHORD, celui qui joue, sinon le premier), ses notes, la longueur. */
export function chordShown(): { chord: number; notes: SeqStep[]; len: number } {
  const sq = seq.get();
  const ar = arp.get();
  const playing = ar.running && arpExternal.headState.chord >= 0 ? arpExternal.headState.chord : -1;
  const chord = notesView ?? (playing >= 0 ? playing : (ar.prog[0] ?? 0));
  const notes = seq.shown(chord);
  return { chord, notes, len: Math.max(1, Math.min(STEPS_N, sq.edit ? sq.len : notes.length || STEPS_N)) };
}

/** La note des potards a cette place (le pas remis a zero de la piste NOTES). */
export function knobNote(chord: number, i: number): number {
  const p = voyParams.get();
  const m = stepIndex('mode', p.mode);
  const pool = poolSteps(chord, p, (m === 3 ? 0 : m) as ArpMode);
  return pool.length > 0 ? pool[i % pool.length] : 0;
}

/** Les notes de la suite reecrites d'un coup (decaler, RANDOM) : la suite EDIT, la suite AUTO copiee sinon. */
export function writeNotes(chord: number, f: (cur: SeqStep[], len: number) => SeqStep[]): void {
  const shown = seq.shown(chord);
  const len = Math.max(1, Math.min(SEQ_MAX, shown.length || 1));
  const st = seq.get();
  const buf = st.edit ? st.buf.slice() : Array.from({ length: SEQ_MAX }, (_, j) => (shown.length > 0 ? shown[j % shown.length] : 0));
  const next = f(buf.slice(0, len), len);
  for (let j = 0; j < len; j += 1) buf[j] = next[j] === null ? null : Math.max(SEQ_MIN, Math.min(SEQ_TOP, Math.round(next[j] as number)));
  seq.restore({ edit: true, buf, len, has: true });
}

export const rotate = <T>(a: T[], d: number): T[] => a.map((_, j) => a[(((j - d) % a.length) + a.length) % a.length]);

/** Le nom d'une note de la suite, avec son octave (F#3). */
export const noteName = (chord: number, d: number): string => `${degreeName(chord, d)}${Math.floor(degreeMidi(chord, d) / 12) - 1}`;

/** RANDOM doux des notes : la plupart restent, quelques-unes bougent d'un ou deux degres, rares silences. */
export function randomNotes(chord: number): void {
  writeNotes(chord, (cur) =>
    cur.map((d, j) => {
      const r = Math.random();
      if (d === null) return r < 0.5 ? knobNote(chord, j) : null;
      if (r < 0.08) return null;
      if (r < 0.4) return d + [-2, -1, 1, 2][Math.floor(Math.random() * 4)];
      return d;
    }),
  );
}

/** Ce qu'un clic allume sur un pas neutre : le dernier niveau dessine sur la piste (les deux vues le partagent). */
export const lastOn: Record<StepTrack, number> = { acc: 2, slide: 1, gate: 2, rat: 2, prob: 50 };
/** Les niveaux d'une piste, du plus bas au plus haut (glisser vers le haut : plus). */
export const LEVELS: Readonly<Record<StepTrack, readonly number[]>> = { acc: [0, 1, 2], slide: [0, 1], gate: [0, 1, 2, 3], rat: [1, 2, 3, 4], prob: [0, 25, 50, 75, 100] };

/** RANDOM doux d'une piste : la plupart des pas restent neutres, quelques-uns prennent une valeur voisine. */
export const SOFT_RANDOM: Readonly<Record<StepTrack, (r: number) => number>> = {
  acc: (r) => (r < 0.25 ? 2 : r < 0.33 ? 0 : 1),
  slide: (r) => (r < 0.15 ? 1 : 0),
  gate: (r) => (r < 0.12 ? 3 : r < 0.26 ? 2 : r < 0.36 ? 0 : 1),
  rat: (r) => (r < 0.12 ? 2 : r < 0.16 ? 3 : 1),
  prob: (r) => (r < 0.2 ? 75 : r < 0.28 ? 50 : 100),
};
