/**
 * Le port USB du boitier MM-RYTM (2026-10-27, la phase 3) : le pont MMHW v2 (hardware/mm-rytm-hw/rytm-bridge.js, a venir)
 * parle seul a ce port. La couche MIDI generique (MIDI LEARN, les notes vers le MM-ARP, tout ecouteur d'entree) ignore
 * toute entree dont le nom le dit, et MIDI OUT (le retour des potards, les notes du MM-ARP) n'y envoie rien : sans ca,
 * une note du boitier (TRK 60, SCENE A 79, SCENE B 80) serait apprise ou jouee deux fois, et un moteur recevrait les CC
 * d'un autre appareil. Pur, sans import.
 */

/** Le nom du port du boitier, tel que macOS et Windows le montrent (MM-RYTM HW, MM-RYTM HW MIDI 1...). */
export const HW_PORT = /MM-RYTM HW/i;

/** Ce port est celui du boitier (un nom absent : non). */
export const isHwPort = (name: string | null | undefined): boolean => typeof name === 'string' && HW_PORT.test(name);
