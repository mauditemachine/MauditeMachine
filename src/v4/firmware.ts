/**
 * Les firmwares des machines (2026-10-27, Mika : "ca doit changer a chaque fois qu'il y a une mise a jour : mineure 0.1,
 * grosse 1.0, 2.0") : firmware.json est la seule source des versions imprimees sur les faces et les capots.
 */
import FW from './firmware.json';

export type FirmwareId = 'mm808' | 'voy' | 'bass';

function rytmFaceVer(): string | null {
  if (typeof window === 'undefined') return null;
  // Le plugin : la machine complete, la version du firmware
  const pf = (window as unknown as { __MM_PLUGIN__?: unknown }).__MM_PLUGIN__;
  if (pf === true || pf === 'arp') return null;
  try {
    const f = new URLSearchParams(window.location.search).get('face');
    // Le site sans ?face= : la V.3.0 depuis le 2026-11-08 (theme/base.ts RYTM_FACE_VER) ; ?face=v6 ou dt2 : la version du firmware
    if (f === null || f === '') return '3.0';
    if (f === 'v1' || f === '1' || f === '1.0') return '1.0';
    if (f === 'v2' || f === '2' || f === '2.0') return '2.0';
    if (f === 'v3' || f === '3' || f === '3.0') return '3.0';
    if (f === 'v4' || f === '4' || f === '4.0') return '4.0';
    if (f === 'v5' || f === '5' || f === '5.0') return '5.0';
    return null;
  } catch {
    return null;
  }
}

/** La version d'une machine, 4.1 */
export const fwVersion = (id: FirmwareId): string => (id === 'mm808' ? (rytmFaceVer() ?? FW[id].version) : FW[id].version);

/**
 * La version du build du plugin MM-ARP (2026-11-11, Mika : "mets a jour le numero a chaque mise a jour, comme ca je
 * saurai si ca a fonctionne") : « VST3 · BUILD 11 NOV 14:32 · a1b2c3d » (date UTC du build, commit court), injectee au
 * build par plugin/mm-arp/web/vite.config.ts (define __MM_ARP_BUILD__). Hors de ce build (le site, npm run dev) :
 * « VST3 · DEV BUILD ».
 */
declare const __MM_ARP_BUILD__: string | undefined;
export const ARP_BUILD: string = typeof __MM_ARP_BUILD__ === 'string' && __MM_ARP_BUILD__ ? __MM_ARP_BUILD__ : 'VST3 · DEV BUILD';

/** Le plugin MM-ARP (window.__MM_PLUGIN__ = 'arp' ou ?plugin=arp, comme theme/base.ts PLUGIN_ARP, sans l'importer : pas de cycle). */
function pluginArp(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as unknown as { __MM_PLUGIN__?: unknown }).__MM_PLUGIN__ === 'arp') return true;
  try {
    return new URLSearchParams(window.location.search).get('plugin') === 'arp';
  } catch {
    return false;
  }
}

/** Le texte imprime sur la machine, FIRMWARE V.4.1 / 2026 ; le MM-ARP du plugin : la version de son build (ARP_BUILD) */
export const fwText = (id: FirmwareId): string => (id === 'voy' && pluginArp() ? ARP_BUILD : `FIRMWARE V.${fwVersion(id)} / 2026`);
