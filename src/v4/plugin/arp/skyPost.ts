/**
 * v46 (2026-11-20, Mika : la page REVERB option A) : la sortie de la reverbe, sur le mouille seul (CLASSIC compris) :
 * l'EQ trois points (LOW CUT, MID, HIGH CUT), WIDTH, DUCK, FREEZE. Les lois sont celles du C++ (plugin/mm-arp/dsp/ArpFx.h,
 * 5. ; ArpFxLaws::rv*) ; les reglages sont en fin de plugin/mm-arp/extra-params.json (section sky), neutres par defaut :
 * un projet ou un preset d'avant sonne au bit pres comme avant. Aucun import : extra.ts (le texte) et pcbui.tsx (le gris)
 * s'en servent.
 */

export const SKY_POST = ['xSkyLoCut', 'xSkyLoSlope', 'xSkyMidHz', 'xSkyMidDb', 'xSkyMidQ', 'xSkyHiCut', 'xSkyHiSlope', 'xSkyWidth', 'xSkyDuck', 'xSkyFreeze'] as const;

const c01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export const skyPostLaws = {
  /** LOW CUT : 0 OFF, sinon 20 Hz x 100^v */
  loHz: (v: number): number => 20 * Math.pow(100, c01(v)),
  loV: (hz: number): number => c01(Math.log(hz / 20) / Math.log(100)),
  loOn: (v: number): boolean => v > 0.0005,
  /** HIGH CUT : 1 OFF, sinon 1 kHz x 20^v */
  hiHz: (v: number): number => 1000 * Math.pow(20, c01(v)),
  hiV: (hz: number): number => c01(Math.log(hz / 1000) / Math.log(20)),
  hiOn: (v: number): boolean => v < 0.9995,
  /** MID : 200 Hz x 40^v, 24 (v - 0.5) dB, Q 0.4 x 10^v */
  midHz: (v: number): number => 200 * Math.pow(40, c01(v)),
  midV: (hz: number): number => c01(Math.log(hz / 200) / Math.log(40)),
  midDb: (v: number): number => 24 * (c01(v) - 0.5),
  midQ: (v: number): number => 0.4 * Math.pow(10, c01(v)),
  midOn: (v: number): boolean => Math.abs(v - 0.5) > 0.0005,
  /** WIDTH : 0 mono, 0.5 : 100 %, 1 : 150 % */
  widthPct: (v: number): number => (c01(v) <= 0.5 ? 200 * c01(v) : 100 + 100 * (c01(v) - 0.5)),
};

const hz = (f: number): string => {
  if (f < 1000) return `${Math.round(f)} HZ`;
  const k = (f / 1000).toFixed(1);
  return `${f >= 10000 ? k.replace(/\.0$/, '') : k} KHZ`;
};

/** Le texte d'un de ces reglages (null : pas un des leurs). */
export function skyPostText(id: string, v: number): string | null {
  const L = skyPostLaws;
  switch (id) {
    case 'xSkyLoCut':
      return L.loOn(v) ? hz(L.loHz(v)) : 'OFF';
    case 'xSkyHiCut':
      return L.hiOn(v) ? hz(L.hiHz(v)) : 'OFF';
    case 'xSkyMidHz':
      return hz(L.midHz(v));
    case 'xSkyMidDb': {
      const d = L.midDb(v);
      return `${d > 0.05 ? '+' : ''}${Math.abs(d) < 0.05 ? '0.0' : d.toFixed(1)} DB`;
    }
    case 'xSkyMidQ':
      return `Q ${L.midQ(v).toFixed(2)}`;
    case 'xSkyWidth':
      return v <= 0.0005 ? 'MONO' : `${Math.round(L.widthPct(v))} %`;
    case 'xSkyDuck':
      return v <= 0.0005 ? 'OFF' : `${Math.round(c01(v) * 100)} %`;
    default:
      return null;
  }
}

/**
 * Grises : la frequence et le Q de MID tant que son gain est a 0 dB, la pente d'une coupure eteinte, FREEZE sur CLASSIC
 * (la convolution) et SPRING (les ressorts n'ont pas de reseau a tenir). type : xSkyType en index (0 CLASSIC, 4 SPRING).
 */
export function skyPostInert(id: string, of: (id: string) => number, type: number): boolean {
  switch (id) {
    case 'xSkyMidHz':
    case 'xSkyMidQ':
      return !skyPostLaws.midOn(of('xSkyMidDb'));
    case 'xSkyLoSlope':
      return !skyPostLaws.loOn(of('xSkyLoCut'));
    case 'xSkyHiSlope':
      return !skyPostLaws.hiOn(of('xSkyHiCut'));
    case 'xSkyFreeze':
      return type === 0 || type === 4;
    default:
      return false;
  }
}
