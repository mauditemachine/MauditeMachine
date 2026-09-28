/**
 * Les perles de la ligne : 37 pistes (discography.json) + 5 mixtapes
 * (mixtapes.json), lues en lecture seule depuis src/v2/data. Tri
 * chronologique ascendant (2012 -> maintenant), placement en t sur la
 * ligne, groupes de patterns I a IV (le rotary du 303), annees du ruler.
 */

import discographyData from '../../v2/data/discography.json';
import mixtapesData from '../../v2/data/mixtapes.json';
import { isPlayable, type V2Track } from '../../v2/context/AudioPlayerContext';

export type GroupId = 1 | 2 | 3 | 4;

export interface MixtapeInfo {
  number: number;
  duration: string;
  durationMinutes: number;
  artwork: string | null;
  title: string;
}

export interface Bead {
  /** 0..36 pistes, 37..41 mixtapes : index d'instance dans la scene */
  index: number;
  id: string;
  track: V2Track;
  kind: 'track' | 'mixtape';
  t: number;
  radius: number;
  playable: boolean;
  featured: boolean;
  year: number;
  /** "Original", "Remix" ou "Mixtape" (singulier, pour l'affichage) */
  categoryLabel: string;
  mixtape?: MixtapeInfo;
}

interface MixtapeJson {
  title: string;
  number: number;
  year: number;
  duration: string;
  soundcloudUrl: string;
  artwork: string | null;
  featured: boolean;
}

const DISCO = discographyData as { tracks: V2Track[] };
const MIX = mixtapesData as { profileUrl: string; mixtapes: MixtapeJson[] };

export const SOUNDCLOUD_PROFILE_URL = MIX.profileUrl;

const dateKey = (t: V2Track) => t.releaseDate || `${t.year}-01-01`;

/** Ascendant : la plus ancienne d'abord, tracklist d'album par trackNo, puis id. */
const TRACKS: V2Track[] = [...DISCO.tracks].sort(
  (a, b) =>
    dateKey(a).localeCompare(dateKey(b)) ||
    (a.trackNo ?? 0) - (b.trackNo ?? 0) ||
    a.id.localeCompare(b.id)
);

const DAY = 86400000;
const T0 = Date.UTC(2012, 4, 15);
const T1 = Date.UTC(2026, 1, 11);
const yearLin = (t: V2Track) => {
  const d = dateKey(t).split('-').map(Number);
  const ms = Date.UTC(d[0], (d[1] || 1) - 1, d[2] || 1);
  return Math.max(0, Math.min(1, (ms - T0) / DAY / ((T1 - T0) / DAY)));
};

const CATEGORY_LABEL: Record<string, string> = {
  originals: 'Original',
  remixes: 'Remix',
  vrstl: 'Original',
};

const parseDuration = (s: string): number => {
  const p = s.split(':').map(Number);
  if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
  if (p.length === 2) return p[0] + p[1] / 60;
  return 0;
};

/** Une mixtape est une piste comme une autre pour le moteur (meme id que v2 : non, id v3 propre). */
export const mixtapeToTrack = (m: MixtapeJson): V2Track => ({
  id: `mixtape-${m.number}`,
  title: m.title,
  project: `Mixtape ${m.number}`,
  artist: 'Maudite Machine',
  role: 'DJ',
  year: m.year,
  category: 'originals',
  link: m.soundcloudUrl,
  soundcloudUrl: m.soundcloudUrl,
  featured: m.featured,
  releaseDate: `${m.year}-01-01`,
  trackNo: 0,
});

const MIXTAPES = [...MIX.mixtapes].sort((a, b) => a.number - b.number);

const beadRadius = (t: V2Track) => (!isPlayable(t) ? 0.22 : t.featured ? 0.42 : 0.28);

export const BEADS: Bead[] = [
  ...TRACKS.map((track, i): Bead => ({
    index: i,
    id: track.id,
    track,
    kind: 'track',
    // 40 % annee reelle (2012..2020 clairsemes et loin), 60 % rang (les
    // dix-neuf pistes de 2025 restent selectionnables)
    t: 0.1 + 0.8 * (0.4 * yearLin(track) + 0.6 * (i / Math.max(1, TRACKS.length - 1))),
    radius: beadRadius(track),
    playable: isPlayable(track),
    featured: !!track.featured,
    year: track.year,
    categoryLabel: CATEGORY_LABEL[track.category] || 'Original',
  })),
  ...MIXTAPES.map((m, k): Bead => {
    const track = mixtapeToTrack(m);
    return {
      index: TRACKS.length + k,
      id: track.id,
      track,
      kind: 'mixtape',
      t: 0.925 + 0.018 * k,
      radius: 0.24,
      playable: true,
      featured: m.featured,
      year: m.year,
      categoryLabel: 'Mixtape',
      mixtape: {
        number: m.number,
        duration: m.duration,
        durationMinutes: parseDuration(m.duration),
        artwork: m.artwork,
        title: m.title,
      },
    };
  }),
];

export const TRACK_COUNT = TRACKS.length;
export const MIXTAPE_COUNT = MIXTAPES.length;
export const BEAD_COUNT = BEADS.length;

export const BEAD_BY_ID: Record<string, Bead> = Object.fromEntries(BEADS.map((b) => [b.id, b]));
export const BEAD_BY_TITLE: Record<string, Bead> = Object.fromEntries(BEADS.map((b) => [b.track.title, b]));

/** La perle la plus recente (dock de repos de l'anneau). */
export const NEWEST_TRACK: Bead = BEADS[TRACKS.length - 1];

export const GROUP_LABELS: Record<GroupId, string> = {
  1: 'FEATURED',
  2: 'ORIGINALS',
  3: 'REMIXES',
  4: 'MIXTAPES',
};
export const GROUP_ROMAN: Record<GroupId, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
export const GROUP_IDS: GroupId[] = [1, 2, 3, 4];

/** Chaque groupe est chronologique ascendant : FWD va vers maintenant. */
export const GROUPS: Record<GroupId, Bead[]> = {
  1: BEADS.filter((b) => b.kind === 'track' && b.featured),
  2: BEADS.filter((b) => b.kind === 'track' && b.track.category !== 'remixes'),
  3: BEADS.filter((b) => b.kind === 'track' && b.track.category === 'remixes'),
  4: BEADS.filter((b) => b.kind === 'mixtape'),
};

/** La file passee au moteur : le groupe entier, injouables incluses (le moteur les saute). */
export const GROUP_TRACKS: Record<GroupId, V2Track[]> = {
  1: GROUPS[1].map((b) => b.track),
  2: GROUPS[2].map((b) => b.track),
  3: GROUPS[3].map((b) => b.track),
  4: GROUPS[4].map((b) => b.track),
};

export const beadInGroup = (bead: Bead, g: GroupId) => GROUPS[g].includes(bead);

/** Le groupe qui contient la perle : le courant s'il convient, sinon sa categorie. */
export function groupOf(bead: Bead, current: GroupId): GroupId {
  if (beadInGroup(bead, current)) return current;
  if (bead.kind === 'mixtape') return 4;
  if (bead.track.category === 'remixes') return 3;
  return 2;
}

/** Deplacement de la selection dans un groupe (dir -1 = vers le passe). */
export function stepInGroup(id: string | null, g: GroupId, dir: 1 | -1): Bead {
  const list = GROUPS[g];
  if (!id) return dir > 0 ? list[0] : list[list.length - 1];
  const i = list.findIndex((b) => b.id === id);
  if (i < 0) {
    // Selection hors groupe : la plus proche en t dans la direction demandee
    const cur = BEAD_BY_ID[id];
    const cand = dir > 0 ? list.find((b) => b.t > cur.t) : [...list].reverse().find((b) => b.t < cur.t);
    return cand || (dir > 0 ? list[list.length - 1] : list[0]);
  }
  return list[Math.max(0, Math.min(list.length - 1, i + dir))];
}

export interface RulerYear {
  label: string;
  /** t de la premiere perle de l'annee (ou du premier hub pour MIX) */
  t: number;
  year: number | null;
}

const RULER_YEARS = [2012, 2014, 2017, 2020, 2023, 2025];
export const RULER: RulerYear[] = [
  ...RULER_YEARS.map((y) => {
    const first = BEADS.find((b) => b.kind === 'track' && b.year >= y) || BEADS[0];
    return { label: String(y), t: first.t, year: y };
  }),
  { label: 'MIX', t: GROUPS[4][0].t, year: null },
];

/** Ligne meta du display : "Limbos LP, 2025, Original" ou "Mixtape 37, 2025, 2:01:23". */
export function beadMeta(bead: Bead): string {
  if (bead.mixtape) return `Mixtape ${bead.mixtape.number}, ${bead.year}, ${bead.mixtape.duration}`;
  return `${bead.track.project}, ${bead.year}, ${bead.categoryLabel}`;
}

export const fmtTime = (s: number): string => {
  if (!Number.isFinite(s) || s <= 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  return `${m}:${r.toString().padStart(2, '0')}`;
};
