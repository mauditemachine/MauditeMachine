/**
 * Bloc About de la home. Composition editoriale asymetrique : colonne
 * laterale mono (label + affiliations VRSTL / 8day en liens directs), lead
 * tres grand en graisses melees, puis deux paragraphes decales.
 * Textes (brief de Mika, 2026-10-10, mot pour mot) : le lead porte la bio
 * courte EN, les deux paragraphes la bio longue EN (1er paragraphe, puis
 * les 2e et 3e reunis).
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
        <strong>Indie dance</strong> and <strong>dark disco</strong> with a psychedelic edge. DJ, producer, founder of VRSTL Records. Fifteen years in the Montréal underground, now based in the south of France.
      </p>

      <div className="v2-intro-cols">
        <p>
          Maudite Machine is a DJ and producer based in Montpellier, in the south of France, after fifteen years in the Montréal underground. He plays indie dance and dark disco with a psychedelic edge: rolling basslines, dark synths and long tension that builds over the set, as a DJ on CDJs or as a hybrid live with synths and grooveboxes.
        </p>
        <p className="v2-intro-offset">
          He has played Techno Parade Paris, Okami Festival in France and Groove and Bass in Québec, and Montréal rooms from the SAT to Piknic Électronik, on bills with Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox and Perfect Stranger. He runs VRSTL Records, an independent label with 21 EPs and 2 albums from artists in Québec, Brazil, Argentina and Europe. His own releases include Limbos (2025) and Voodoo (2026).
        </p>
      </div>
    </div>
  </section>
);

export default Intro;
