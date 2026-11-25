/**
 * L'entree de la face du plugin MM-ARP (2026-11-09, plugin/mm-arp/web/index.html) : l'etat du projet d'abord
 * (plugin/restore.ts, le meme que le MM-RYTM : avant que les stores du site lisent le localStorage), puis la face et son
 * pont.
 */

import { restoreState } from '../restore';

restoreState();

void import('./boot').then((m) => m.boot());
