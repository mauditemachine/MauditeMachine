/**
 * Les firmwares des machines (2026-10-27, Mika : "ca doit changer a chaque fois qu'il y a une mise a jour : mineure 0.1,
 * grosse 1.0, 2.0") : firmware.json est la seule source des versions imprimees sur les faces et les capots.
 */
import FW from './firmware.json';

export type FirmwareId = 'mm808' | 'voy' | 'bass';

function rytmFaceVer(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const f = new URLSearchParams(window.location.search).get('face');
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

/** Le texte imprime sur la machine, FIRMWARE V.4.1 / 2026 */
export const fwText = (id: FirmwareId): string => `FIRMWARE V.${fwVersion(id)} / 2026`;
