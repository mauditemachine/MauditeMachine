/**
 * /techrider : la fiche technique 2026/27 en page web.
 *
 * Avant, /techrider redirigeait vers l'ancre Press Kit de la home et le
 * seul document etait un PDF : un promoteur qui veut verifier une ligne
 * (modele de mixeur, taille de table) devait telecharger un fichier. La
 * page dit la meme chose que le PDF, le PDF reste telechargeable.
 *
 * Contenu dans ../data/techrider.ts (EN + FR), comme l'EPK qui a le meme
 * bascule de langue.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../v2.css';
import Cursor from '../components/Cursor';
import useV2Chrome from '../hooks/useV2Chrome';
import { RIDER } from '../data/techrider';

const RIDER_PDF = '/Tech_Rider_Maudite_Machine_2026-27.pdf';

/** Pixel Meta : meme evenement Lead que le press kit. */
const trackDownload = () => {
  const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
  if (typeof fbq === 'function')
    fbq('track', 'Lead', { content_name: 'Tech Rider Download 2026-27' });
};

/**
 * Stage plot du live hybride, vue de dessus : la table et ses machines,
 * les deux retours, la chaine interface -> DI -> facade, le setup CDJ
 * optionnel et le public en bas. Trace en currentColor, aucun aplat de
 * couleur : il reste lisible imprime en noir et blanc.
 */
const StagePlot: React.FC<{ label: (k: string) => string }> = ({ label }) => (
  <svg
    className="v2-plot-svg"
    viewBox="0 0 920 640"
    role="img"
    aria-label={label('aria')}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      vectorEffect="non-scaling-stroke"
    >
      {/* Chaine de signal : interface -> 2 x DI -> facade */}
      <path d="M605 218 L605 110 L740 110" />
      <rect x="740" y="86" width="118" height="48" />
      <path d="M858 110 L898 110" />
      <path d="M886 103 L898 110 L886 117" />

      {/* Artiste, derriere la table */}
      <circle cx="460" cy="172" r="19" />

      {/* Table 180 x 70 */}
      <rect x="250" y="218" width="420" height="152" />
      <rect x="268" y="232" width="96" height="44" />
      <rect x="380" y="228" width="160" height="52" />
      <rect x="556" y="232" width="96" height="44" />
      <rect x="292" y="296" width="140" height="54" />
      <rect x="452" y="296" width="200" height="54" />

      {/* Cotes */}
      <path d="M250 392 L670 392" strokeDasharray="3 5" />
      <path d="M250 386 L250 398 M670 386 L670 398" />
      <path d="M222 218 L222 370" strokeDasharray="3 5" />
      <path d="M216 218 L228 218 M216 370 L228 370" />

      {/* Retours de cabine, orientes vers l'artiste */}
      <path d="M96 246 L176 226 L176 326 L96 306 Z" />
      <path d="M824 246 L744 226 L744 326 L824 306 Z" />

      {/* Setup CDJ optionnel */}
      <rect x="60" y="428" width="272" height="112" strokeDasharray="6 6" />

      {/* Public */}
      <path d="M60 596 L860 596" strokeWidth="2" />
      <path d="M460 576 L460 544" />
      <path d="M453 556 L460 544 L467 556" />
    </g>

    <g
      fill="currentColor"
      fontFamily="'SF Mono', ui-monospace, Menlo, Consolas, monospace"
      fontSize="13"
      letterSpacing="1.4"
    >
      <text x="799" y="116" textAnchor="middle">2 x DI</text>
      <text x="898" y="74" textAnchor="end">FOH</text>
      <text x="625" y="80" >L / R XLR</text>
      <text x="460" y="212" textAnchor="middle">ARTIST</text>
      <text x="316" y="259" textAnchor="middle">TYPHON</text>
      <text x="460" y="259" textAnchor="middle">MACBOOK PRO</text>
      <text x="604" y="259" textAnchor="middle">INTERFACE</text>
      <text x="362" y="328" textAnchor="middle">PUSH 3</text>
      <text x="552" y="328" textAnchor="middle">ROTO-CONTROL</text>
      <text x="460" y="386" textAnchor="middle">180 CM</text>
      <text
        x="206"
        y="294"
        textAnchor="middle"
        transform="rotate(-90 206 294)"
      >
        70 CM
      </text>
      <text x="136" y="352" textAnchor="middle">MONITOR L</text>
      <text x="784" y="352" textAnchor="middle">MONITOR R</text>
      <text x="196" y="478" textAnchor="middle">2 x CDJ + DJM</text>
      <text x="196" y="502" textAnchor="middle">{label('optional')}</text>
      <text x="460" y="626" textAnchor="middle">{label('audience')}</text>
    </g>
  </svg>
);

const TechRiderPage: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'fr'>('en');
  const t = RIDER[lang];

  useV2Chrome(
    lang === 'fr'
      ? 'Maudite Machine | Fiche technique 2026-27'
      : 'Maudite Machine | Tech Rider 2026-27'
  );

  const plotLabel = (k: string) => {
    if (k === 'optional') return lang === 'fr' ? '(OPTIONNEL)' : '(OPTIONAL)';
    if (k === 'audience') return lang === 'fr' ? 'PUBLIC' : 'AUDIENCE';
    return lang === 'fr'
      ? 'Stage plot du live hybride, vue de dessus'
      : 'Stage plot of the hybrid live set, top view';
  };

  return (
    <div className="v2-root">
      <Cursor />

      <header className="v2-radar-top">
        <Link className="v2-label v2-radar-back" to="/">
          {t.back}
        </Link>
        <div className="v2-section-head" style={{ marginBottom: 0 }}>
          <h1 className="v2-section-title">{t.title}</h1>
          <span className="v2-label">{t.edition}</span>
        </div>
      </header>

      <section className="v2-section v2-rider">
        <div className="v2-rider-intro">
          <p className="v2-rider-lead">{t.subtitle}</p>
          <div className="v2-epk-langs" role="group" aria-label="Language">
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
        </div>

        <div className="v2-rider-blocks">
          {t.blocks.map((b) => (
            <article className="v2-rider-block" key={b.num}>
              <h2 className="v2-rider-block-title">
                <span className="v2-section-num">{b.num}</span>
                {b.title}
              </h2>
              <dl className="v2-rider-list">
                {b.items.map((it) => (
                  <div className="v2-rider-row" key={it.term}>
                    <dt className="v2-label">{it.term}</dt>
                    <dd>{it.text}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>

        <figure className="v2-plot">
          <figcaption className="v2-plot-head">
            <span className="v2-rider-block-title">{t.plotTitle}</span>
            <span className="v2-label">{t.plotNote}</span>
          </figcaption>
          <div className="v2-plot-frame">
            <StagePlot label={plotLabel} />
          </div>
        </figure>

        <div className="v2-rider-cta">
          <a
            className="v2-download"
            href={RIDER_PDF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackDownload}
          >
            <span>{t.download}</span>
            <span className="v2-label">{t.downloadMeta}</span>
          </a>
          <p className="v2-label">{t.ctaFooter}</p>
        </div>
      </section>
    </div>
  );
};

export default TechRiderPage;
