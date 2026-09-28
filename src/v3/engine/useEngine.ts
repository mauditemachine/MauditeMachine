/**
 * Liaison moteur : useAudioPlayer re-exporte tel quel (le moteur v2, jamais
 * reecrit). En DEV avec ?v3mock=1, un moteur factice de meme forme. Le
 * choix est fait UNE fois au chargement du module : les regles des hooks
 * tiennent, et en prod le mock est une branche morte.
 */

import React from 'react';
import { AudioPlayerProvider, useAudioPlayer } from '../../v2/context/AudioPlayerContext';
import { MockEngineProvider, useMockEngine, type EngineCtx } from './MockEngine';

export type { EngineCtx };

const MOCK_MODE: string | null = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('v3mock')
  : null;

export const ENGINE_IS_MOCK = MOCK_MODE !== null;

const MockWithMode: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement(MockEngineProvider, { failSecond: MOCK_MODE === 'fail', children });

export const EngineProvider: React.FC<{ children: React.ReactNode }> = ENGINE_IS_MOCK
  ? MockWithMode
  : AudioPlayerProvider;

export const useEngine: () => EngineCtx = ENGINE_IS_MOCK ? useMockEngine : useAudioPlayer;
