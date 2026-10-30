/** Les INFOS du MM-RYTM : leurs types (deplaces de rytm/infos.ts en P0, 2026-10-30, cahier dt2 5.0). */

import { type Inst } from '../../theme';
import { type RytmInfoAvail, type RytmInfoId, type RytmResolveCtx, type RytmVoiceGroup } from '../diagrams';

/**
 * Le verrou d'un reglage (P-lock, 2026-10-08) : yes, il se verrouille pas
 * par pas ; no, pas (NO LOCK a l'ecran) ; global, toute la machine, jamais
 * (GLOBAL) ; vel, la velocite du pas lui-meme.
 */
export type RytmLockable = 'yes' | 'no' | 'global' | 'vel';

export interface RytmInfo {
  /** l'id de la carte (un bloc de l'ecran : le reglage qu'il tient) */
  id: RytmInfoId;
  /** la section (ENV C, TWEAKS / KICK, TRANSPORT...), en petites capitales sur la carte */
  section: string;
  /** le nom, tel qu'a l'ecran ou serigraphie */
  title: string;
  /** la recette en trois gestes, avant le texte (revue de R4 : le LOCK etait un paragraphe de 750 signes) */
  steps?: string[];
  text: string;
  /** la touche du clavier (Au clavier : S.) ; la carte ne l'ecrit qu'au desktop (revue de R4 : un telephone n'a pas de touche S) */
  key?: string;
  tip?: string;
  /** live : branche ; soon : un reglage a venir */
  avail: RytmInfoAvail;
  /** pour un reglage des ecrans : son verrou */
  lock?: RytmLockable;
}

export interface RytmInfoCtx extends RytmResolveCtx {
  /** un potard de la plaque TWEAKS (OPEN), pas un bloc de l'ecran */
  plate?: boolean;
  /** le pas montre (un pas, le P-LOCK) : 0 a 15 */
  step?: number;
  /** le verrou du bloc d'apres rytm/pages.ts (slot.lock : yes ; scope all : global ; sinon no) */
  lockable?: RytmLockable;
  /** un encodeur du desktop (0 a 7) : son FX global (2026-10-09) ; la section le dit */
  encoder?: number;
}

/** Les mots d'une voix ; lock null : rien a verrouiller pour cette voix (MACHINE sur CY), pas de phrase de verrou. */
export type Words = Partial<Pick<Raw, 'title' | 'text' | 'tip'>> & { lock?: RytmLockable | null };

export interface Raw {
  section: string;
  title: string;
  steps?: string[];
  text: string;
  /** la touche du clavier, sans phrase (S, Espace) */
  key?: string;
  tip?: string;
  lock?: RytmLockable;
  /** sur la plaque TWEAKS : son nom serigraphie et sa section */
  plate?: { title: string; section: string };
  /** la voix choisie change les mots : par voix (BD...), par famille (bd, sd, hh, cp, tom, cy), ou sans voix (none) */
  voice?: Partial<Record<Inst | RytmVoiceGroup | 'none', Words>>;
  /**
   * au telephone : les mots d'une carte qui parlait de la souris, des
   * encodeurs du desktop ou du clavier (theme.ts BLOCKS_ARE_KNOBS) ; la voix
   * choisie passe encore avant
   */
  phone?: { text?: string; steps?: string[] };
}
