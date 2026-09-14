/**
 * /archives — le musee du site : chaque version de mauditemachine.com
 * retrouvee dans la Wayback Machine depuis 2010, avec sa capture et un
 * lien vers la version navigable dans l'archive.
 *
 * Les captures sont generees une fois et stockees en local
 * (public/images/archive/) : la page ne depend d'aucun service externe
 * au chargement. Donnees : src/v2/data/archive.json.
 */

import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import '../v2.css';
import archiveData from '../data/archive.json';
import Cursor from '../components/Cursor';
import useReveals from '../hooks/useReveals';
import useV2Chrome from '../hooks/useV2Chrome';

interface Version {
  id: string;
  year: string;
  label: string;
  title: string;
  note: string;
  tech: string;
  image: string;
  url: string;
  live?: boolean;
}

const VERSIONS = (archiveData as { versions: Version[] }).versions;
const WAYBACK_ALL = (archiveData as { source: string }).source;

const ArchivePage: React.FC = () => {
  useV2Chrome('Maudite Machine — Archives du site');
  const rootRef = useRef<HTMLDivElement>(null);
  useReveals(rootRef);

  return (
    <div ref={rootRef} className="v2-root">
      <Cursor />

      <header className="v2-radar-top">
        <Link className="v2-label v2-radar-back" to="/">
          ← Back to site
        </Link>
        <div className="v2-section-head" style={{ marginBottom: 0 }}>
          <h1 className="v2-section-title">Archives</h1>
          <span className="v2-label">{VERSIONS.length} versions · depuis 2010</span>
        </div>
      </header>

      <section className="v2-section v2-radar-body">
        <p className="v2-section-intro">
          Seize ans de mauditemachine.com, exhumés de la Wayback Machine :
          du portail Joomla de 2010 au site actuel. Clique sur une version
          pour la parcourir dans l'archive, telle qu'elle était.
        </p>

        <div className="v2-arc-grid">
          {VERSIONS.map((v, i) => (
            <a
              key={v.id}
              className={`v2-arc-card${i === 0 ? ' is-wide' : ''}`}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="v2-arc-shot">
                <img src={v.image} alt={`Le site en ${v.year} : ${v.title}`} loading={i < 2 ? "eager" : "lazy"} decoding="async" />
                <span className="v2-arc-year">{v.year}</span>
              </span>

              <span className="v2-arc-meta">
                <span className="v2-label v2-arc-top">
                  {v.label} · {v.tech}
                  {v.live && <b className="v2-arc-live">en ligne</b>}
                </span>
                <span className="v2-arc-title">{v.title}</span>
                <span className="v2-arc-note">{v.note}</span>
                <span className="v2-label v2-arc-go">
                  {v.live ? 'Voir le site' : 'Ouvrir dans l’archive'} ↗
                </span>
              </span>
            </a>
          ))}
        </div>

        <p className="v2-label v2-matrix-note">
          Certaines pages apparaissent sans mise en forme : la Wayback Machine
          a gardé le texte mais pas toujours les feuilles de style d’époque.
          C’est l’archive telle qu’elle existe.{' '}
          <a
            href={WAYBACK_ALL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline' }}
          >
            Toutes les captures sur archive.org
          </a>
          .
        </p>
      </section>
    </div>
  );
};

export default ArchivePage;
