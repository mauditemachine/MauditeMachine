/**
 * Hub EPK /v2 : bio FR/EN (edition 2026/27), telechargements (press kit
 * PDF, tech rider PDF, pack presse) et CTA booking.
 *
 * Les deux PDF sont desormais dans public/ : la sonde runtime qui
 * cherchait des tech riders absents n'a plus de raison d'etre, les liens
 * sont directs. Le pack complet vit sous /press/ (page statique hors
 * routeur React) avec les photos, le logo et les pochettes.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BOOKING_CONTACTS } from '../data/contacts';

const BIO = {
  en: {
    meta: 'DJ · Producer · Live · VRSTL Records · Canada · France · Spain',
    main: "Maudite Machine is based between Canada, France and Spain. He started playing in Montréal in 2010, when Piknic Électronik and the SAT were the two rooms every local DJ wanted. He has played both since, along with Igloofest afters, the Phi Centre, Fonderie Darling, Théâtre Fairmount and a run of Québec festivals from TOTEM and Illusion to Future Forest and Groove & Bass. In 2026 he played OKAMI Festival in France.",
    secondary: "His sets move between deep techno and indie dance. The bass rolls, the changes come slowly and under the surface, and after a while the room stops watching the booth and moves as one. He plays it as a DJ on CDJs and as a hybrid live set where Ableton Live, a Push 3, a Dreadbox Typhon and an APC40 drive the sequences in real time. He founded VRSTL Records, an independent Canadian label with 21 EPs and 2 albums, teaches Ableton Live production, and is available for club and festival dates across Europe.",
  },
  fr: {
    meta: 'DJ · Producteur · Live · VRSTL Records · Canada · France · Espagne',
    main: "Maudite Machine est basé entre le Canada, la France et l'Espagne. Il a commencé à jouer à Montréal en 2010. Il est passé par le Piknic Électronik et la SAT, les afters d'Igloofest, le Centre Phi, la Fonderie Darling, le Théâtre Fairmount, et par les festivals québécois, de TOTEM et Illusion à Future Forest et Groove & Bass. En 2026, il a joué au OKAMI Festival en France.",
    secondary: "Ses sets naviguent entre deep techno et indie dance. La basse roule, les changements arrivent lentement et sous la surface, et au bout d'un moment la salle arrête de regarder la cabine pour bouger d'un seul bloc. Il les joue en DJ set sur CDJ et en live hybride où Ableton Live, un Push 3, un Dreadbox Typhon et un APC40 pilotent les séquences en direct. Il a fondé VRSTL Records, label indépendant canadien (21 EPs, 2 albums), enseigne la production sur Ableton Live, et est disponible pour des dates en club et en festival partout en Europe.",
  },
};

const COPY = {
  en: {
    bills: 'Shared bills',
    billsFooter: 'Rooms from 100 to 4,000 people, from Piknic Électronik to the SAT',
    downloads: 'Downloads',
    presskit: 'Press Kit 2026 / 27',
    presskitMeta: 'PDF · 5 MB · EN / FR',
    rider: 'Tech Rider 2026 / 27',
    riderMeta: 'PDF · EN',
    riderPage: 'Full tech rider',
    riderPageMeta: 'Setup · stage plot · travel',
    assets: 'Press photos, logo and artwork',
    assetsLink: 'mauditemachine.com/press',
    assetsAll: 'Download all',
    assetsMeta: 'ZIP · 7 MB',
    footer: 'Full dossier · bios · performances · discography · tech rider',
  },
  fr: {
    bills: 'Plateaux partagés',
    billsFooter: 'Des salles de 100 à 4 000 personnes, du Piknic Électronik à la SAT',
    downloads: 'Téléchargements',
    presskit: 'Press Kit 2026 / 27',
    presskitMeta: 'PDF · 5 MO · EN / FR',
    rider: 'Fiche technique 2026 / 27',
    riderMeta: 'PDF · EN',
    riderPage: 'Fiche technique complète',
    riderPageMeta: 'Setup · stage plot · déplacements',
    assets: 'Photos presse, logo et pochettes',
    assetsLink: 'mauditemachine.com/press',
    assetsAll: 'Tout télécharger',
    assetsMeta: 'ZIP · 7 MO',
    footer: 'Dossier complet · bios · performances · discographie · fiche technique',
  },
};

/** Plateaux partages, ordre fourni par Mika (2026-09). */
const SHARED_BILLS = [
  'Carl Craig',
  'Agoria',
  'Reinier Zonneveld',
  'Akufen',
  'Riva Starr',
  'Alle Farben',
  'Arno Gonzalez',
  'Egokind',
  'Kassian',
  'Mateo Murphy',
  'Elite Force',
  'Crystal Distortion',
  'Hedflux',
  'Vilify',
  'Adam Husa',
  'Van Did',
  'Florian MSK',
];

const PRESSKIT_PDF = '/Presskit_Maudite_Machine_2026-27.pdf';
const RIDER_PDF = '/Tech_Rider_Maudite_Machine_2026-27.pdf';
const PRESS_PAGE = '/press/';
const PRESS_ZIP = '/press/maudite-machine-press-kit.zip';

/** Pixel Meta : meme evenement Lead que la v1, edition mise a jour. */
const trackDownload = (name: string) => {
  const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
  if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: name });
};

const EPK: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'fr'>('en');
  const t = COPY[lang];

  return (
    <section className="v2-section" id="epk">
      <div className="v2-section-head">
        <h2 className="v2-section-title"><span className="v2-section-num">06</span>Press Kit</h2>
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

          <div className="v2-epk-bills">
            <span className="v2-label">{t.bills}</span>
            <p className="v2-epk-bills-names">
              {SHARED_BILLS.map((n, i) => (
                <React.Fragment key={n}>
                  {i > 0 && <span aria-hidden="true"> · </span>}
                  {n}
                </React.Fragment>
              ))}
            </p>
            <span className="v2-label">{t.billsFooter}</span>
          </div>
        </div>

        <div className="v2-epk-downloads">
          <span className="v2-label">{t.downloads}</span>

          <a
            className="v2-download"
            href={PRESSKIT_PDF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackDownload('Press Kit Download 2026-27')}
          >
            <span>{t.presskit}</span>
            <span className="v2-label">{t.presskitMeta}</span>
          </a>

          <a
            className="v2-download"
            href={RIDER_PDF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackDownload('Tech Rider Download 2026-27')}
          >
            <span>{t.rider}</span>
            <span className="v2-label">{t.riderMeta}</span>
          </a>

          <Link className="v2-download" to="/techrider">
            <span>{t.riderPage}</span>
            <span className="v2-label">{t.riderPageMeta}</span>
          </Link>

          <a className="v2-download" href={PRESS_ZIP}>
            <span>{t.assets}</span>
            <span className="v2-label">{t.assetsAll} · {t.assetsMeta}</span>
          </a>

          <a
            className="v2-epk-presslink v2-label"
            href={PRESS_PAGE}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.assetsLink} ↗
          </a>

          <p className="v2-label v2-epk-downloads-footer">{t.footer}</p>

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
