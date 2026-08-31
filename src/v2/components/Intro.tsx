/**
 * Bloc About de la home : la bio du profil SoundCloud (le texte de
 * reference de Mika), enrichie des appartenances VRSTL Records et
 * collectif 8day. Bloc editorial entre le hero et Music — pas une
 * section numerotee, pas d'entree menu.
 */

import React from 'react';

const Intro: React.FC = () => (
  <section className="v2-intro" aria-label="About Maudite Machine">
    <p className="v2-intro-lead">
      Maudite Machine is the solo project of Mika — a Canadian DJ and
      producer known for a raw, hypnotic approach to minimal and indie
      dance.
    </p>
    <div className="v2-intro-cols">
      <p>
        Deeply rooted in the Montréal scene as a member of the{' '}
        <a href="https://www.8day.ca" target="_blank" rel="noopener noreferrer">
          8day collective
        </a>
        , he has performed at major events and iconic venues across the
        country, delivering sets that blur the line between underground
        grit and dancefloor euphoria.
      </p>
      <p>
        As the founder of{' '}
        <a href="https://vrstlrecords.com" target="_blank" rel="noopener noreferrer">
          VRSTL Records
        </a>
        , he curates releases that reflect an uncompromising vision and a
        deep connection to the scene's roots — no-nonsense, immersive,
        built for those who understand that the best moments happen when
        the music takes control.
      </p>
    </div>
  </section>
);

export default Intro;
