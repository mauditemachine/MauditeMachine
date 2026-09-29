/**
 * Drapeaux d'URL (spec 15.1), lus au chargement du module puis a chaque
 * montage de /v4 (navigation SPA). debug, mute et motion=reduce restent
 * acquis pour toute la page une fois vus : un remontage sans ?mute=1 ne
 * doit jamais rendre le son aux enceintes pendant une revue.
 */

export interface V4Flags {
  debug: boolean;
  mute: boolean;
  motionReduce: boolean;
  nowebgl: boolean;
  /** DEV seulement : le MockEngine de /v3 remplace SoundCloud */
  v4mock: 'off' | 'on' | 'fail';
}

const read = (): V4Flags => {
  const q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const mock = q.get('v4mock');
  return {
    debug: q.get('debug') === '1',
    mute: q.get('mute') === '1',
    motionReduce: q.get('motion') === 'reduce',
    nowebgl: q.get('nowebgl') === '1',
    v4mock: import.meta.env.DEV ? (mock === 'fail' ? 'fail' : mock === '1' ? 'on' : 'off') : 'off',
  };
};

export const FLAGS: V4Flags = read();

/** Au montage : relit l'URL courante sans jamais retirer debug, mute ni reduce. */
export function syncFlags(): V4Flags {
  const now = read();
  FLAGS.debug = FLAGS.debug || now.debug;
  FLAGS.mute = FLAGS.mute || now.mute;
  FLAGS.motionReduce = FLAGS.motionReduce || now.motionReduce;
  FLAGS.nowebgl = now.nowebgl;
  if (now.v4mock !== 'off') FLAGS.v4mock = now.v4mock;
  return FLAGS;
}
