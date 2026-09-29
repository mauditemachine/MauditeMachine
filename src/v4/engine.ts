/**
 * Liaison moteur (spec 8.4), comme src/v3/engine/useEngine.ts : le moteur
 * audio de la v2 (AudioPlayerProvider, qui pilote src/utils/scWidget.ts)
 * reutilise tel quel. En DEV avec ?v4mock=1 (ou ?v4mock=fail), le moteur
 * factice de /v3 (meme forme, latence 1500 ms, duree 300 s, aucun son,
 * aucune iframe) pour revoir les visuels de lecture. Le choix est fait UNE
 * fois au chargement du module ; en production le mock est une branche
 * morte.
 *
 * EngineBridge est le seul consommateur du contexte : il re-rend a chaque
 * progression du widget et recopie l'etat dans le pont (audio/soundcloud.ts)
 * dans un effet ; le reste de /v4 lit le pont, jamais le contexte.
 */

import React, { useEffect } from 'react';
import { AudioPlayerProvider, useAudioPlayer } from '../v2/context/AudioPlayerContext';
import { MockEngineProvider, useMockEngine, type EngineCtx } from '../v3/engine/MockEngine';
import { sc } from './audio/soundcloud';
import { FLAGS } from './state/flags';

export type { EngineCtx };

const MOCK = FLAGS.v4mock;

export const ENGINE_IS_MOCK = MOCK !== 'off';

const MockWithMode: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement(MockEngineProvider, { failSecond: MOCK === 'fail', children });

export const EngineProvider: React.FC<{ children: React.ReactNode }> = ENGINE_IS_MOCK ? MockWithMode : AudioPlayerProvider;

export const useEngine: () => EngineCtx = ENGINE_IS_MOCK ? useMockEngine : useAudioPlayer;

/** Recopie le moteur dans le pont ; ne rend rien. */
export const EngineBridge: React.FC = () => {
  const e = useEngine();
  const { current, playing, progress, duration, notice, play, toggle } = e;
  useEffect(() => {
    sc.attach({ play, toggle });
  }, [play, toggle]);
  useEffect(
    () => () => {
      sc.attach(null);
      sc.reset();
    },
    []
  );
  useEffect(() => {
    sc.sync({ current, playing, progress, duration, notice });
  }, [current, playing, progress, duration, notice]);
  return null;
};
