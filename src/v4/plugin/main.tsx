/**
 * L'entree de la face du plugin (2026-11-08, plugin/mm-rytm/web/index.html) : l'etat du projet d'abord (plugin/restore.ts,
 * avant que les stores du site lisent le localStorage), puis la face et son pont.
 */

import { restoreState } from './restore';

restoreState();

void import('./boot').then((m) => m.boot());
