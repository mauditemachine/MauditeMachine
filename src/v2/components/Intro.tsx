/**
 * Bloc About de la home (bio du profil SoundCloud, sans prenom).
 * Composition editoriale asymetrique : colonne laterale mono (label +
 * affiliations VRSTL / 8day en liens directs), lead tres grand en
 * graisses melees, puis deux paragraphes decales. Memes couleurs et
 * memes textes que la version precedente, seule la mise en page change.
 */

import React from 'react';

const Intro: React.FC = () => (
  <section className="v2-intro" aria-label="About Maudite Machine">
    <aside className="v2-intro-aside">
      <span className="v2-label">About</span>
      <div className="v2-intro-affil">
        <a href="https://vrstlrecords.com" target="_blank" rel="noopener noreferrer">
          VRSTL Records ↗
        </a>
        <a href="https://www.8day.ca" target="_blank" rel="noopener noreferrer">
          8day collective ↗
        </a>
      </div>
    </aside>

    <div className="v2-intro-main">
      <p className="v2-intro-lead">
        Maudite Machine bends <strong>minimal</strong> and{' '}
        <strong>indie dance</strong> into something{' '}
        <strong>raw and hypnotic</strong>: machine grooves with a human
        pulse, built for dark rooms and long nights.
      </p>

      <div className="v2-intro-cols">
        <p>
          Deeply rooted in the Montréal scene as a member of the 8day
          collective, Maudite Machine has performed at major events and
          iconic venues across the country, delivering sets that blur the
          line between underground grit and dancefloor euphoria.
        </p>
        <p className="v2-intro-offset">
          As the founder of VRSTL Records, the project curates releases
          that reflect an uncompromising vision and a deep connection to
          the scene's roots. No-nonsense, immersive, built for those who
          understand that the best moments happen when the music takes
          control.
        </p>
      </div>
    </div>
  </section>
);

export default Intro;
