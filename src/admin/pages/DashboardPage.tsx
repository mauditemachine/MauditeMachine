/**
 * Tableau de bord admin : compteurs, sante du contenu (en langage humain,
 * jamais de jargon), etat de publication. Toutes les donnees viennent de
 * server.js (/api/admin/summary et /api/admin/git/status).
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminGet, isReadOnly } from '../lib/api';

interface Summary {
  readOnly?: boolean;
  counts: {
    tracks: number;
    tracksPlayable: number;
    tracksFeatured: number;
    mixtapes: number;
    releases: number;
    upcomingEvents: number;
    pastEvents: number;
    mixes: number;
    storeItems: number;
  };
  health: {
    tracksWithoutPlayback: string[];
    tracksIncomplete: string[];
    missingImages: string[];
    pdfs: { presskit: boolean; riderEn: boolean; riderFr: boolean };
  };
  media: { imagesBytes: number; videosBytes: number; eventsBytes: number };
}

interface GitStatus {
  branch: string;
  changedFiles: string[];
  lastCommit: { when: string; message: string } | null;
  deploy: { status: string; conclusion: string | null; at: string } | null;
}

const fmtMB = (b: number) => `${Math.round(b / 1024 / 1024)} Mo`;

/** Traduit un chemin de fichier modifie en domaine lisible. */
function humanArea(file: string): string {
  if (file.includes('discography')) return 'Discographie';
  if (file.includes('mixtapes')) return 'Mixtapes';
  if (file.includes('releases')) return 'Radar / releases';
  if (file.includes('events')) return 'Événements';
  if (file.includes('store')) return 'Boutique';
  if (file.includes('translations') || file.includes('copy')) return 'Textes';
  if (file.startsWith('public/images') || file.startsWith('public/videos')) return 'Médias';
  if (file.startsWith('docs/')) return 'Notes de travail';
  if (
    file.startsWith('src/') ||
    file.startsWith('dist/') ||
    file.startsWith('scripts/') ||
    /\.(ts|tsx|js|mjs|css|html)$/.test(file)
  ) {
    return 'Site (code)';
  }
  return file;
}

const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [git, setGit] = useState<GitStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    adminGet<Summary & { success: boolean }>('/api/admin/summary').then(
      (s) => alive && setSummary(s),
      (e) => alive && setError(String(e.message || e))
    );
    adminGet<GitStatus & { success: boolean }>('/api/admin/git/status').then(
      (g) => alive && setGit(g),
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div>
        <div className="admx-head">
          <h1 className="admx-title">Tableau de bord</h1>
        </div>
        <div className="admx-card">
          Le serveur local ne répond pas ({error}). Lance <code>npm run admin</code> puis recharge.
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div>
        <div className="admx-head">
          <h1 className="admx-title">Tableau de bord</h1>
          <span className="admx-sub">Chargement…</span>
        </div>
      </div>
    );
  }

  const { counts, health, media } = summary;
  const issues =
    health.tracksWithoutPlayback.length +
    health.tracksIncomplete.length +
    health.missingImages.length +
    (health.pdfs.riderEn ? 0 : 1) +
    (health.pdfs.riderFr ? 0 : 1);

  // Domaines modifies non publies, dedupliques, hors bruit technique
  const pendingAreas = [...new Set((git?.changedFiles || []).map(humanArea))];

  return (
    <div>
      <div className="admx-head">
        <h1 className="admx-title">Tableau de bord</h1>
        <span className="admx-sub">
          Vue d'ensemble du contenu du site
        </span>
      </div>

      <div className="admx-kpis">
        <div className="admx-kpi">
          <b>{counts.tracks}</b>
          <span>pistes discographie</span>
          <small>
            {counts.tracksPlayable} écoutables · {counts.tracksFeatured} en sélection
          </small>
        </div>
        <div className="admx-kpi">
          <b>{counts.mixtapes}</b>
          <span>mixtapes</span>
        </div>
        <div className="admx-kpi">
          <b>{counts.releases}</b>
          <span>releases Radar</span>
        </div>
        <div className="admx-kpi">
          <b>{counts.upcomingEvents}</b>
          <span>dates à venir</span>
          <small>{counts.pastEvents} passées (Wall of Fame)</small>
        </div>
        <div className="admx-kpi">
          <b>{counts.storeItems}</b>
          <span>articles boutique</span>
        </div>
      </div>

      <div className="admx-grid">
        <div className="admx-card" style={{ gridColumn: 'span 2' }}>
          <h3>
            Santé du contenu{' '}
            {issues === 0 ? (
              <span className="admx-pill ok">tout est en ordre</span>
            ) : (
              <span className="admx-pill warn">{issues} point{issues > 1 ? 's' : ''} à régler</span>
            )}
          </h3>

          {health.tracksWithoutPlayback.length > 0 && (
            <div className="admx-health-item">
              <span className="admx-dot warn" />
              <span>
                {health.tracksWithoutPlayback.length} piste
                {health.tracksWithoutPlayback.length > 1 ? 's' : ''} sans écoute :{' '}
                <span className="admx-muted">
                  {health.tracksWithoutPlayback.slice(0, 4).join(', ')}
                  {health.tracksWithoutPlayback.length > 4 ? '…' : ''}
                </span>
              </span>
            </div>
          )}
          {health.tracksIncomplete.length > 0 && (
            <div className="admx-health-item">
              <span className="admx-dot warn" />
              <span>
                {health.tracksIncomplete.length} piste
                {health.tracksIncomplete.length > 1 ? 's' : ''} aux informations incomplètes
              </span>
            </div>
          )}
          {health.missingImages.map((m) => (
            <div className="admx-health-item" key={m}>
              <span className="admx-dot danger" />
              <span>{m}</span>
            </div>
          ))}
          <div className="admx-health-item">
            <span className={`admx-dot ${health.pdfs.presskit ? 'ok' : 'danger'}`} />
            <span>Press kit PDF {health.pdfs.presskit ? 'en place' : 'introuvable'}</span>
          </div>
          <div className="admx-health-item">
            <span className={`admx-dot ${health.pdfs.riderEn && health.pdfs.riderFr ? 'ok' : 'warn'}`} />
            <span>
              Tech riders :{' '}
              {health.pdfs.riderEn && health.pdfs.riderFr
                ? 'EN et FR en place'
                : `manquant${!health.pdfs.riderEn && !health.pdfs.riderFr ? 's' : ''} : ${[
                    !health.pdfs.riderEn && 'EN',
                    !health.pdfs.riderFr && 'FR',
                  ]
                    .filter(Boolean)
                    .join(' + ')} (le site affiche le ZIP en attendant)`}
            </span>
          </div>
        </div>

        <div className="admx-card" style={{ display: isReadOnly() ? 'none' : undefined }}>
          <h3>Publication</h3>
          {git ? (
            <>
              <div className="admx-health-item">
                <span className={`admx-dot ${pendingAreas.length ? 'warn' : 'ok'}`} />
                <span>
                  {pendingAreas.length
                    ? `Modifications non publiées : ${pendingAreas.join(', ')}`
                    : 'Tout est publié'}
                </span>
              </div>
              {git.lastCommit && (
                <div className="admx-health-item">
                  <span className="admx-dot ok" />
                  <span>
                    Dernier enregistrement {git.lastCommit.when}
                    <br />
                    <span className="admx-muted">{git.lastCommit.message}</span>
                  </span>
                </div>
              )}
              {git.deploy && (
                <div className="admx-health-item">
                  <span
                    className={`admx-dot ${
                      git.deploy.conclusion === 'success'
                        ? 'ok'
                        : git.deploy.status === 'in_progress'
                          ? 'warn'
                          : 'danger'
                    }`}
                  />
                  <span>
                    Mise en ligne :{' '}
                    {git.deploy.status === 'in_progress'
                      ? 'en cours…'
                      : git.deploy.conclusion === 'success'
                        ? 'réussie'
                        : 'à vérifier'}
                  </span>
                </div>
              )}
            </>
          ) : (
            <span className="admx-muted">Lecture de l'état…</span>
          )}
        </div>

        <div className="admx-card" style={{ display: isReadOnly() ? 'none' : undefined }}>
          <h3>Médias</h3>
          <div className="admx-health-item">
            <span className={`admx-dot ${media.imagesBytes > 150 * 1024 * 1024 ? 'warn' : 'ok'}`} />
            <span>Images : {fmtMB(media.imagesBytes)}</span>
          </div>
          <div className="admx-health-item">
            <span className="admx-dot ok" />
            <span>Vidéos : {fmtMB(media.videosBytes)}</span>
          </div>
          <div className="admx-health-item">
            <span className="admx-dot ok" />
            <span>Affiches événements : {fmtMB(media.eventsBytes)}</span>
          </div>
        </div>

        <div className="admx-card">
          <h3>Raccourcis</h3>
          <p style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: 0 }}>
            <Link className="admx-btn" to="/mm-admin/contenu">
              Ajouter une date
            </Link>
            <Link className="admx-btn" to="/mm-admin/discographie">
              Corriger les pistes
            </Link>
            <Link className="admx-btn" to="/mm-admin/mixtapes">
              Nouvelle mixtape
            </Link>
            <Link className="admx-btn primary" to="/mm-admin/publier">
              Publier
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
