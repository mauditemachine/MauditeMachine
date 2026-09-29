/**
 * Repli sans WebGL (spec 11.5) : WebGL2 absent, renderer en echec, contexte
 * perdu, erreur de rendu, ?nowebgl=1. Jamais d'ecran noir ni de message
 * technique : une page HTML sobre, le titre, le modele, la machine en SVG
 * isometrique statique (StaticMachine), puis toutes les sections depliees
 * (les memes composants que le panneau ; les pistes restent jouables par
 * le moteur SoundCloud). Pas de sequenceur ici, ni de raccourcis.
 */

import React from 'react';
import { COPY } from '../theme';
import { Contact } from '../ui/sections/Contact';
import { Mixtapes } from '../ui/sections/Mixtapes';
import { Press } from '../ui/sections/Press';
import { Shows } from '../ui/sections/Shows';
import { Studio } from '../ui/sections/Studio';
import { Tracks } from '../ui/sections/Tracks';
import { StaticMachine } from './StaticMachine';

const NoWebGL: React.FC = () => (
  <section className="v4-fallback" aria-labelledby="v4-fallback-title">
    <h1 id="v4-fallback-title" className="v4-fallback-title">
      {COPY.wordmark}
    </h1>
    <p className="v4-fallback-model">{COPY.model}</p>
    <StaticMachine />
    <div className="v4-fallback-sections">
      <Tracks active focusable />
      <Mixtapes active focusable />
      <Press active focusable />
      <Shows active focusable />
      <Contact active focusable />
      <Studio active focusable />
    </div>
  </section>
);

export default NoWebGL;
