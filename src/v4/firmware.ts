/**
 * Les firmwares des machines (2026-10-27, Mika : "ca doit changer a chaque fois qu'il y a une mise a jour : mineure 0.1,
 * grosse 1.0, 2.0") : firmware.json est la seule source des versions imprimees sur les faces et les capots.
 */
import FW from './firmware.json';

export type FirmwareId = 'mm808' | 'voy' | 'bass';

/** La version d'une machine, 4.1 */
export const fwVersion = (id: FirmwareId): string => FW[id].version;

/** Le texte imprime sur la machine, FIRMWARE V.4.1 / 2026 */
export const fwText = (id: FirmwareId): string => `FIRMWARE V.${FW[id].version} / 2026`;
