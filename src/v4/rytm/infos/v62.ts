/**
 * Les cartes INFOS reservees a V.6.2 (lane D5). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.5) : la lane y ajoute
 * ses cartes (un id de rytm/diagrams.ts chacune) ; l'ordre des fichiers est fige dans rytm/infos/index.ts.
 */

import type { RytmInfoId } from '../diagrams';
import type { Raw } from './types';

export const RAW_V62 = {} satisfies Partial<Record<RytmInfoId, Raw>>;
