/**
 * Hub EPK /v2 : bio FR/EN (textes du site actuel), telechargements
 * (press kit PDF, tech riders EN/FR, bundle ZIP) et CTA booking.
 *
 * Les tech riders PDF separes seront deposes par Mika dans public/
 * (techrider-en.pdf / techrider-fr.pdf) : on sonde leur existence au
 * runtime (HEAD + content-type pdf, car le fallback SPA repond 200 en
 * html), et on bascule automatiquement du ZIP aux PDF sans redeploiement.
 */

import React, { useEffect, useState } from 'react';
import { BOOKING_CONTACTS } from '../data/contacts';

const BIO = {
  en: {
    meta: 'DJ · Producer · VRSTL Records · Canada · France · Spain',
    main: "A pillar of the Montreal underground for over 15 years, Mika has forged the identity of Maudite Machine between the immersive walls of SAT and the effervescent stages of Piknic Électronik. Sharing the bill with legends like Carl Craig, Agoria, and Reinier Zonneveld, his footprint reaches far beyond a simple DJ set.",
    secondary: "At the helm of VRSTL Records, he sculpts the future of North American Indie Dance and Dark Disco. A sonic architect navigating between hardware sequencers and analog synthesizers, he turns every Live Set into a raw, unfiltered ceremony. With a decade and a half dedicated to teaching music production, he doesn't just play tomorrow's music: he trains those who will create it.",
  },
  fr: {
    meta: 'DJ · Producteur · VRSTL Records · Canada · France · Espagne',
    main: "Pilier de l'underground montréalais depuis plus de 15 ans, Mika a forgé l'identité de Maudite Machine entre les murs immersifs de la SAT et les scènes effervescentes du Piknic Électronik. Partageant l'affiche avec des légendes telles que Carl Craig, Agoria ou Reinier Zonneveld, son empreinte s'étend bien au-delà d'un simple DJ set.",
    secondary: "À la tête de VRSTL Records, il sculpte le futur de l'Indie Dance et du Dark Disco nord-américain. Architecte sonore naviguant entre séquenceurs matériels et synthétiseurs analogiques, il transforme chaque Live Set en une cérémonie brute et sans filtre. Fort d'une décennie et demie dédiée à l'enseignement de la production, il ne se contente pas de jouer la musique de demain : il forme ceux qui la créeront.",
  },
};

const PRESSKIT_PDF = '/Presskit_Maudite_Machine_2026.pdf';
const BUNDLE_ZIP = `/${encodeURIComponent('Maudite Machine PressKit & Techrider.zip')}`;
const RIDER_EN = '/techrider-en.pdf';
const RIDER_FR = '/techrider-fr.pdf';

/** true si l'URL sert un vrai PDF (le fallback SPA renvoie 200 en text/html) */
const pdfExists = async (url: string) => {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok && (res.headers.get('content-type') || '').includes('pdf');
  } catch {
    return false;
  }
};

const EPK: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'fr'>('en');
  const [riders, setRiders] = useState<{ en: boolean; fr: boolean }>({ en: false, fr: false });

  useEffect(() => {
    let alive = true;
    Promise.all([pdfExists(RIDER_EN), pdfExists(RIDER_FR)]).then(([en, fr]) => {
      if (alive) setRiders({ en, fr });
    });
    return () => {
      alive = false;
    };
  }, []);

  const hasRiders = riders.en || riders.fr;

  return (
    <section className="v2-section" id="epk">
      <div className="v2-section-head">
        <h2 className="v2-section-title">EPK</h2>
        <span className="v2-label">Press kit &amp; booking</span>
      </div>

      <div className="v2-epk">
        <div className="v2-epk-bio">
          <div className="v2-epk-langs" role="group" aria-label="Bio language">
            {(['en', 'fr'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={`v2-filter${lang === l ? ' is-active' : ''}`}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="v2-epk-bio-main">{BIO[lang].main}</p>
          <p className="v2-epk-bio-secondary">{BIO[lang].secondary}</p>
          <p className="v2-label">{BIO[lang].meta}</p>
        </div>

        <div className="v2-epk-downloads">
          <span className="v2-label">Downloads</span>
          <a className="v2-download" href={PRESSKIT_PDF} target="_blank" rel="noopener noreferrer">
            <span>Press Kit 2026</span>
            <span className="v2-label">PDF · 10 MB</span>
          </a>
          {riders.en && (
            <a className="v2-download" href={RIDER_EN} target="_blank" rel="noopener noreferrer">
              <span>Tech Rider</span>
              <span className="v2-label">PDF · EN</span>
            </a>
          )}
          {riders.fr && (
            <a className="v2-download" href={RIDER_FR} target="_blank" rel="noopener noreferrer">
              <span>Tech Rider</span>
              <span className="v2-label">PDF · FR</span>
            </a>
          )}
          {!hasRiders && (
            <a className="v2-download" href={BUNDLE_ZIP}>
              <span>Press Kit + Tech Rider</span>
              <span className="v2-label">ZIP bundle</span>
            </a>
          )}
          <a className="v2-download" href={BUNDLE_ZIP}>
            <span>Photos pack</span>
            <span className="v2-label">ZIP · Hi-res</span>
          </a>

          <div className="v2-contacts v2-epk-contacts">
            {BOOKING_CONTACTS.map((c) => (
              <div key={c.id} className="v2-contact-block">
                <span className="v2-label">{c.label[lang]}</span>
                {c.name && <span className="v2-contact-name">{c.name}</span>}
                <a className="v2-contact-mail" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EPK;
