/** Les cibles MIDI : l'assemblage (groupes dans un ordre fige), la recherche, les machines chargees a part. Deplace de midi/targets.ts en P0. */

import { SCREEN_PAGE, isRytmScreen } from '../../rytm/pages';
import { sceneTag } from '../../rytm/sceneParams';
import { type MachineId } from '../../state/focus';
import { DT_FACE, FACE_FOLLOWS_PAGE, GLOBAL_ENCODERS } from '../../theme';
import type { MidiTarget, TargetScope } from './types';
import { rytmTargets } from './rytm';
import { voyTargets } from './voy';
import { navTargets } from './nav';
import { face60Targets } from './face60';
import { tracks60Targets } from './tracks60';
import { phone60Targets } from './phone60';
import { pages61Targets } from './pages61';
import { seq61Targets } from './seq61';
import { face61Targets } from './face61';
import { kit62Targets } from './kit62';
import { song62Targets } from './song62';
import { settings62Targets } from './settings62';
import { face62Targets } from './face62';

/**
 * Les groupes de cibles, dans un ORDRE FIGE (P0, cahier dt2 5.5) : ceux d'aujourd'hui (MM-RYTM, MM-ARP, la navigation),
 * puis un fichier reserve par lane des trois versions, vide en P0. Le CSV (npm run docs:midi) s'ecrit par machine : une
 * cible RYTM d'une lane sort a la fin du bloc mm808, quel que soit l'ordre de fin des lanes. Jamais reordonne.
 */
const GROUPS: readonly ((out: MidiTarget[]) => void)[] = [
  rytmTargets,
  voyTargets,
  navTargets,
  face60Targets,
  tracks60Targets,
  phone60Targets,
  pages61Targets,
  seq61Targets,
  face61Targets,
  kit62Targets,
  song62Targets,
  settings62Targets,
  face62Targets,
];

function coreTargets(): MidiTarget[] {
  const out: MidiTarget[] = [];
  for (const g of GROUPS) g(out);
  // Les scenes (2026-10-27) : chaque cible de valeur du MM-RYTM dit son role, ou sa classe si elle se morphe (rien d'autre
  // ne change : ni id, ni nom, ni ordre)
  for (const t of out) if (t.scope === 'mm808' && t.kind === 'value') t.scene = sceneTag(t.id);
  return out;
}

export const MACHINE_NAME: Readonly<Record<MachineId, string>> = { mm808: 'MM-RYTM', voy: 'MM-ARP', bass: 'MM-BASS', dj: 'MM-DECKS' };

let core: Map<string, MidiTarget> | null = null;
const coreMap = (): Map<string, MidiTarget> => {
  core ??= new Map(coreTargets().map((t) => [t.id, t]));
  return core;
};

/** Les cibles des machines chargees a part : le MM-DECKS (sa liste suit ses platines), le MM-BASS. */
const lazy = new Map<string, { list: () => MidiTarget[]; find: (id: string) => MidiTarget | undefined }>();
const lazyListeners = new Set<() => void>();

/**
 * Les cibles trouvees des machines chargees a part, gardees (2026-10-08, Mika :
 * "Roto control : des fois ca fonctionne, des fois ca ne fonctionne pas") :
 * le MM-DECKS refaisait sa cible a chaque recherche, et le retour vers le
 * Roto en cherche des centaines toutes les 50 ms. Une cible lit l'etat de sa
 * commande a chaque appel : la garder ne fige rien. Vide a chaque inscription.
 */
const lazyFound = new Map<string, MidiTarget>();

/** Une machine chargee a part inscrit ses cibles (prefixe : dj, bass). */
export function registerTargets(prefix: string, list: () => MidiTarget[], find: (id: string) => MidiTarget | undefined): void {
  lazy.set(prefix, { list, find });
  lazyFound.clear();
  lazyListeners.forEach((fn) => fn());
}
export function onTargetsRegistered(fn: () => void): () => void {
  lazyListeners.add(fn);
  return () => {
    lazyListeners.delete(fn);
  };
}

export const prefixOf = (id: string): string => id.slice(0, id.indexOf(':'));

/** La cible d'un id ; undefined si sa machine n'est pas encore chargee (ou si elle n'existe plus). */
export function targetOf(id: string): MidiTarget | undefined {
  const c = coreMap().get(id);
  if (c) return c;
  const kept = lazyFound.get(id);
  if (kept) return kept;
  const t = lazy.get(prefixOf(id))?.find(id);
  if (t) lazyFound.set(id, t);
  return t;
}

/** Les cibles d'une machine (ou de la navigation), dans l'ordre de la machine. */
export function targetsOf(scope: TargetScope): MidiTarget[] {
  const core = [...coreMap().values()].filter((t) => t.scope === scope);
  const extra = [...lazy.values()].flatMap((l) => l.list()).filter((t) => t.scope === scope);
  return [...core, ...extra];
}

/** La cible d'une commande de la scene (ui/Hotspots.tsx, MIDI LEARN : on la touche, puis on bouge le controleur). */
export function targetIdOfHotspot(h: { id?: string; kind: string; param?: string; rknob?: string; rpage?: string; inst?: string; index?: number; vpad?: number; vbtn?: string; vknob?: string; dj?: string; bass?: string; scene?: string }): string | null {
  switch (h.kind) {
    case 'encoder':
    // MASTER et TEMPO dans l'ecran (2026-10-19) : les memes cibles que leurs potards d'avant
    case 'rdial':
      return h.param ? `rytm:enc:${h.param}` : null;
    // Un encodeur du telephone (2026-10-09) : son FX global a poste fixe ; au desktop depuis le 2026-10-27 (les potards
    // suivent la page) son potard de page, rytm:knob:k+1 (les assignations a rytm:enc:* restent valables)
    case 'penc':
      if (typeof h.index !== 'number') return null;
      if (FACE_FOLLOWS_PAGE) return h.index >= 0 && h.index < 8 ? `rytm:knob:${h.index + 1}` : null;
      return GLOBAL_ENCODERS[h.index] ? `rytm:enc:${GLOBAL_ENCODERS[h.index]}` : null;
    // Une touche de page ; un onglet de l'en-tete (lcd-tab-<ecran>) : son ecran
    case 'pkey':
      if (!h.rpage) return null;
      return isRytmScreen(h.rpage) && (h.id?.startsWith('lcd-tab-') || SCREEN_PAGE[h.rpage] !== h.rpage) ? `rytm:screen:${h.rpage}` : `rytm:page:${h.rpage}`;
    case 'rknob':
      return h.rknob ? `rytm:kit:${h.rknob}` : null;
    // La touche i de l'ecran du MM-RYTM (R4) : MIDI LEARN l'apprend aussi
    case 'rinfo':
      return 'rytm:infos';
    // Un bloc de l'ecran (INFOS allume) : son potard de page
    case 'rblock':
      return typeof h.index === 'number' ? `rytm:knob:${h.index + 1}` : null;
    case 'pad':
      return h.inst ? `rytm:pad:${h.inst}` : null;
    case 'step':
      return typeof h.index === 'number' ? `rytm:step:${h.index}` : null;
    // TRK, SCENE A et B, le crossfader de la face V.4.0 (2026-10-27, la phase 3) : MIDI LEARN les apprend au toucher
    case 'trk':
      return 'rytm:trk';
    case 'scene':
      return h.scene === 'a' || h.scene === 'b' ? `rytm:scene:${h.scene}` : null;
    case 'xfade':
      return 'rytm:xfade';
    // V.5.0 au desktop : la touche PLAY apprend rytm:play (sa pause) ; FUNC, REC, STOP, YES et NO leurs cibles
    case 'run':
      return DT_FACE ? 'rytm:play' : 'rytm:run';
    case 'func':
    case 'rec':
    case 'stop':
    case 'yes':
    case 'no':
      return `rytm:${h.kind}`;
    case 'clear':
    case 'random':
    case 'mute':
    case 'solo':
    case 'edit':
    case 'open':
      return `rytm:${h.kind}`;
    case 'vknob':
    // Un bouton poussoir (SUB OCT, 2026-10-11 ; CHORUS, 2026-10-12) : son reglage, comme un potard (un CC pose le cran)
    case 'vpush':
      return h.vknob ? `voy:knob:${h.vknob}` : null;
    case 'vpad':
      return typeof h.vpad === 'number' ? `voy:pad:${h.vpad}` : null;
    case 'vbtn':
      return h.vbtn ? `voy:${h.vbtn}` : null;
    case 'vopen':
      return 'voy:open';
    // La touche i du grand ecran (2026-10-08) : MIDI LEARN l'apprend aussi
    case 'vinfo':
      return 'voy:infos';
    case 'djknob':
    case 'djfader':
    case 'djkey':
      return h.dj ? `dj:${h.dj}` : null;
    case 'bassknob':
      // Un encodeur de la face du MM-BASS (2026-10-09) : son FX global (bass:global:drive...), jamais un P-lock
      return h.bass ? (h.bass.startsWith('global:') ? `bass:${h.bass}` : `bass:knob:${h.bass}`) : null;
    case 'basskey':
      // Une puce d'onglet de l'ecran (2026-10-09, le moteur MONARK) : bass:screen:<ecran> ; les touches, bass:key:<touche>
      return h.bass ? (h.bass.startsWith('screen:') ? `bass:${h.bass}` : `bass:key:${h.bass}`) : null;
    case 'basstrig':
      return h.bass ? `bass:trig:${h.bass}` : null;
    case 'basslock':
      return h.bass ? `bass:lock:${h.bass}` : null;
    default:
      return null;
  }
}
