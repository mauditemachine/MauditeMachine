/**
 * Page SEO / visibilite : etat du referencement en langage humain
 * (aucun jargon), donnees de visite quand GA4 est branche, et les
 * actions qui restent a faire chez Google.
 */

import React, { useEffect, useState } from 'react';
import { adminGet } from '../lib/api';

interface Check {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  why: string;
}

interface Visits {
  status?: string;
  reason?: string | null;
  windowDays?: number;
  users?: number;
  sessions?: number;
  pageViews?: number;
  cities?: { key: string; value: number }[];
  countries?: { key: string; value: number }[];
  channels?: { key: string; value: number }[];
  age?: { key: string; value: number }[] | null;
  gender?: { key: string; value: number }[] | null;
  topPages?: { key: string; value: number }[];
}

interface SeoData {
  title: string | null;
  description: string | null;
  keywords: string[];
  checks: Check[];
  score: number;
  total: number;
  visits: Visits | null;
  sitemapUrls: string[];
}

/** Petite barre de repartition, sans dependance graphique. */
const Bars: React.FC<{ rows: { key: string; value: number }[]; empty: string }> = ({
  rows,
  empty,
}) => {
  if (!rows.length) return <p className="admx-muted" style={{ fontSize: 13 }}>{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.slice(0, 8).map((r) => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 130, fontSize: 12.5, flexShrink: 0 }}>{r.key}</span>
          <span
            style={{
              height: 8,
              borderRadius: 4,
              background: '#2563eb',
              width: `${Math.max(6, (r.value / max) * 100)}%`,
              opacity: 0.85,
            }}
          />
          <b style={{ fontSize: 12.5 }}>{r.value}</b>
        </div>
      ))}
    </div>
  );
};

const TODO = [
  {
    title: 'Regarder qui visite le site',
    detail:
      'analytics.google.com → ta propriété → Rapports → Données démographiques. Les chiffres existent déjà.',
    href: 'https://analytics.google.com/',
  },
  {
    title: 'Créer la fiche Google « DJ Montréal »',
    detail:
      "Le levier n°1 pour sortir dans les recherches locales. Gratuit, environ 15 minutes.",
    href: 'https://business.google.com/',
  },
  {
    title: 'Inscrire le site sur Search Console',
    detail:
      'Ajouter mauditemachine.com puis soumettre le plan du site. C’est ce qui montre sur quelles recherches tu apparais.',
    href: 'https://search.google.com/search-console',
  },
];

const SeoPage: React.FC = () => {
  const [data, setData] = useState<SeoData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    adminGet<SeoData>('/api/admin/seo').then(
      (d) => alive && setData(d),
      (e) => alive && setError(String(e.message || e))
    );
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div>
        <div className="admx-head">
          <h1 className="admx-title">Visibilité sur Google</h1>
        </div>
        <div className="admx-card">
          Le serveur local ne répond pas ({error}). Lance <code>npm run admin</code>.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="admx-head">
          <h1 className="admx-title">Visibilité sur Google</h1>
          <span className="admx-sub">Analyse en cours…</span>
        </div>
      </div>
    );
  }

  const v = data.visits;
  const hasVisits = !!(v && v.users !== undefined);

  return (
    <div>
      <div className="admx-head">
        <h1 className="admx-title">Visibilité sur Google</h1>
        <span className="admx-sub">
          Comment ton site est présenté aux moteurs de recherche
        </span>
      </div>

      {/* Score global */}
      <div className="admx-kpis">
        <div className="admx-kpi">
          <b>
            {data.score}/{data.total}
          </b>
          <span>points en ordre</span>
          <small>
            {data.score === data.total
              ? 'Tout est bien configuré'
              : `${data.total - data.score} à améliorer`}
          </small>
        </div>
        {hasVisits && (
          <>
            <div className="admx-kpi">
              <b>{v!.users}</b>
              <span>visiteurs</span>
              <small>sur {v!.windowDays} jours</small>
            </div>
            <div className="admx-kpi">
              <b>{v!.pageViews}</b>
              <span>pages vues</span>
              <small>{v!.sessions} visites</small>
            </div>
          </>
        )}
      </div>

      {/* Ce que Google voit */}
      <div className="admx-card" style={{ marginBottom: 14 }}>
        <h3>Ce que Google affiche pour ton site</h3>
        <div
          style={{
            border: '1px solid #e4e4e7',
            borderRadius: 10,
            padding: '12px 14px',
            background: '#fcfcfd',
          }}
        >
          <div style={{ color: '#1a0dab', fontSize: 17, marginBottom: 2 }}>{data.title}</div>
          <div style={{ color: '#006621', fontSize: 12.5, marginBottom: 5 }}>
            https://mauditemachine.com
          </div>
          <div style={{ color: '#4d5156', fontSize: 13, lineHeight: 1.5 }}>
            {data.description}
          </div>
        </div>
        <p className="admx-muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          Aperçu approximatif : Google reformule parfois selon la recherche.
        </p>
      </div>

      {/* Verifications */}
      <div className="admx-card" style={{ marginBottom: 14 }}>
        <h3>Vérifications</h3>
        {data.checks.map((c) => (
          <div className="admx-health-item" key={c.key}>
            <span className={`admx-dot ${c.ok ? 'ok' : 'warn'}`} />
            <span>
              <b style={{ fontWeight: 600 }}>{c.label}</b> — {c.detail}
              <br />
              <span className="admx-muted" style={{ fontSize: 12 }}>
                {c.why}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Audience */}
      <div className="admx-grid" style={{ marginBottom: 14 }}>
        <div className="admx-card" style={{ gridColumn: 'span 2' }}>
          <h3>D'où viennent les visiteurs</h3>
          {hasVisits ? (
            <Bars rows={v!.cities || []} empty="Pas encore de données de villes." />
          ) : (
            <p className="admx-muted" style={{ fontSize: 13, margin: 0 }}>
              Google Analytics est actif sur le site, mais la connexion au tableau de
              bord n'est pas encore configurée : les chiffres restent visibles sur
              analytics.google.com en attendant.
            </p>
          )}
        </div>

        <div className="admx-card">
          <h3>Âge</h3>
          {hasVisits && v!.age ? (
            <Bars rows={v!.age} empty="Masqué par Google (trafic trop faible)." />
          ) : (
            <p className="admx-muted" style={{ fontSize: 13, margin: 0 }}>
              Nécessite d'activer les signaux Google dans Analytics.
            </p>
          )}
        </div>

        <div className="admx-card">
          <h3>Genre</h3>
          {hasVisits && v!.gender ? (
            <Bars rows={v!.gender} empty="Masqué par Google (trafic trop faible)." />
          ) : (
            <p className="admx-muted" style={{ fontSize: 13, margin: 0 }}>
              Nécessite d'activer les signaux Google dans Analytics.
            </p>
          )}
        </div>

        {hasVisits && (
          <>
            <div className="admx-card">
              <h3>Comment ils arrivent</h3>
              <Bars rows={v!.channels || []} empty="Pas encore de données." />
            </div>
            <div className="admx-card">
              <h3>Pages les plus vues</h3>
              <Bars rows={v!.topPages || []} empty="Pas encore de données." />
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="admx-card">
        <h3>À faire pour être trouvé davantage</h3>
        {TODO.map((t) => (
          <div className="admx-health-item" key={t.title}>
            <span className="admx-dot warn" />
            <span>
              <b style={{ fontWeight: 600 }}>{t.title}</b>
              <br />
              <span className="admx-muted" style={{ fontSize: 12.5 }}>
                {t.detail}
              </span>
              <br />
              <a
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2563eb', fontSize: 12.5 }}
              >
                Ouvrir ↗
              </a>
            </span>
          </div>
        ))}
        <p className="admx-muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          Le référencement met en général 4 à 8 semaines à produire des effets visibles.
        </p>
      </div>
    </div>
  );
};

export default SeoPage;
