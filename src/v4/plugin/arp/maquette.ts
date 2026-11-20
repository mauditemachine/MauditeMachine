/**
 * Les maquettes v44 des pages OPEN (2026-11-20, Mika : la barre des pages, la page SOUND en colonnes facon Legend, la
 * page SEQ plus simple avec sa tete de lecture) : une option par element, choisie par l'adresse de la page,
 * ?mq=navA,soundB,seqA (nav : A, B ou C ; sound et seq : A ou B). Sans ?mq, rien ne change : la face d'avant. Le VST3
 * charge la page sans parametre : il garde la face d'avant tant qu'une option n'est pas retenue (puis ce fichier part).
 */

const raw = typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('mq') ?? '');
const pick = (k: string, max: string): string => {
  const m = raw.match(new RegExp(`${k}([A-${max}])`));
  return m ? m[1] : '';
};

export const MQ = { nav: pick('nav', 'C'), sound: pick('sound', 'B'), seq: pick('seq', 'B') } as const;
