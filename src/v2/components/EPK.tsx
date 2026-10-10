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
    meta: 'DJ · Producer · Live · VRSTL Records · Montpellier · South of France',
    main: "Maudite Machine is a DJ and producer based in Montpellier, in the south of France, after fifteen years in the Montréal underground. He plays indie dance and dark disco with a psychedelic edge: rolling basslines, dark synths and long tension that builds over the set, as a DJ on CDJs or as a hybrid live with synths and grooveboxes.",
    secondary: "He has played Techno Parade Paris, Okami Festival in France and Groove and Bass in Québec, and Montréal rooms from the SAT to Piknic Électronik, on bills with Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox and Perfect Stranger. He runs VRSTL Records, an independent label with 21 EPs and 2 albums from artists in Québec, Brazil, Argentina and Europe. His own releases include Limbos (2025) and Voodoo (2026).",
  },
  fr: {
    meta: 'DJ · Producteur · Live · VRSTL Records · Montpellier · Sud de la France',
    main: "Maudite Machine est DJ et producteur, installé à Montpellier dans le Sud de la France après quinze ans dans l'underground montréalais. Il joue de l'indie dance et de la dark disco à tendance psychédélique : basses qui roulent, synthés sombres, tension qui monte sur la longueur du set. Il joue en DJ set sur CDJ ou en live hybride avec synthés et grooveboxes.",
    secondary: "Il a joué à la Techno Parade de Paris, à Okami Festival en France, à Groove and Bass au Québec, et dans les salles de Montréal, de la SAT au Piknic Électronik, sur des plateaux avec Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox et Perfect Stranger. Il dirige VRSTL Records, label indépendant de 21 EPs et 2 albums d'artistes du Québec, du Brésil, d'Argentine et d'Europe. Ses propres sorties comptent Limbos (2025) et Voodoo (2026).",
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

/** Plateaux partages, liste et ordre fournis par Mika (2026-10-01). */
const SHARED_BILLS = [
  'Carl Craig',
  'Popof',
  'Christian Smith',
  'Perc',
  'Agoria',
  'Nick Curly',
  'Damon Jee',
  'John 00 Fleming',
  'Reinier Zonneveld',
  'Akufen',
  'D-Nox',
  'Perfect Stranger',
  'Riva Starr',
  'Alle Farben',
  'FM Radio Gods',
  'Tom Baker',
  'Kassian',
  'Mateo Murphy',
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
