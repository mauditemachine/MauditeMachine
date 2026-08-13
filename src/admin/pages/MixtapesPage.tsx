/**
 * Admin — Mixtapes : coller un lien SoundCloud remplit tout (titre,
 * numero, annee, duree, pochette telechargee en WebP local par le
 * serveur), liste editable en dessous. Sauvegarde automatique locale.
 */

import React, { useState } from 'react';
import useAdminData, { saveLabel } from '../lib/useAdminData';
import { adminPost } from '../lib/api';

interface Mixtape {
  title: string;
  number: number;
  year: number;
  duration: string;
  soundcloudUrl: string;
  artwork: string | null;
  featured: boolean;
}

interface Data {
  profileUrl: string;
  mixtapes: Mixtape[];
}

const MixtapesPage: React.FC = () => {
  const { data, error, saveState, update } = useAdminData<Data>('mixtapes');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [extractError, setExtractError] = useState('');

  const extract = async () => {
    const target = url.trim();
    if (!target) return;
    setBusy(true);
    setExtractError('');
    try {
      const r = await adminPost<{ extracted: Partial<Mixtape> & { title: string } }>(
        '/api/admin/sc-extract',
        { url: target }
      );
      const x = r.extracted;
      update((d) => ({
        ...d,
        mixtapes: [
          {
            title: x.title || 'Sans titre',
            number: x.number ?? (d.mixtapes[0]?.number || 0) + 1,
            year: x.year ?? new Date().getFullYear(),
            duration: x.duration || '',
            soundcloudUrl: x.soundcloudUrl || target,
            artwork: x.artwork ?? null,
            featured: true,
          },
          ...d.mixtapes,
        ],
      }));
      setUrl('');
    } catch (e) {
      setExtractError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) {
    return (
      <div>
        <div className="admx-head"><h1 className="admx-title">Mixtapes</h1></div>
        <div className="admx-card">Le serveur local ne répond pas ({error}).</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="admx-head">
          <h1 className="admx-title">Mixtapes</h1>
          <span className="admx-sub">Chargement…</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="admx-head">
        <h1 className="admx-title">Mixtapes</h1>
        <span className="admx-sub">
          {data.mixtapes.length} mixtapes <b>{saveLabel(saveState)}</b>
        </span>
      </div>

      <div className="admx-card" style={{ marginBottom: 18 }}>
        <h3>Ajouter depuis SoundCloud</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="admx-input"
            style={{ flex: 1, minWidth: 240 }}
            placeholder="Colle un lien SoundCloud (https://soundcloud.com/mauditemachine/…)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') extract();
            }}
          />
          <button type="button" className="admx-btn primary" disabled={busy} onClick={extract}>
            {busy ? 'Extraction…' : 'Extraire et ajouter'}
          </button>
        </div>
        {extractError && (
          <p style={{ color: 'var(--ax-danger)', marginBottom: 0 }}>{extractError}</p>
        )}
        <p className="admx-muted" style={{ marginBottom: 0, fontSize: 12 }}>
          Titre, numéro, année, durée et pochette (convertie pour le site) sont remplis
          automatiquement.
        </p>
      </div>

      {data.mixtapes.map((m, i) => (
        <div className="admx-trow" key={`${m.number}-${m.soundcloudUrl}`}>
          {m.artwork ? (
            <img className="admx-art" src={m.artwork} alt="" loading="lazy" />
          ) : (
            <span className="admx-art admx-art-empty">{m.number}</span>
          )}
          <div className="admx-trow-fields">
            <input
              className="admx-input admx-in-title"
              value={m.title}
              placeholder="Titre"
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  mixtapes: d.mixtapes.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                }))
              }
            />
            <input
              className="admx-input admx-in-year"
              type="number"
              value={m.number || ''}
              placeholder="N°"
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  mixtapes: d.mixtapes.map((x, j) =>
                    j === i ? { ...x, number: Number(e.target.value) || 0 } : x
                  ),
                }))
              }
            />
            <input
              className="admx-input admx-in-year"
              type="number"
              value={m.year || ''}
              placeholder="Année"
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  mixtapes: d.mixtapes.map((x, j) =>
                    j === i ? { ...x, year: Number(e.target.value) || 0 } : x
                  ),
                }))
              }
            />
            <input
              className="admx-input admx-in-role"
              value={m.duration}
              placeholder="Durée (1:29:33)"
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  mixtapes: d.mixtapes.map((x, j) =>
                    j === i ? { ...x, duration: e.target.value } : x
                  ),
                }))
              }
            />
            <input
              className="admx-input admx-in-url"
              value={m.soundcloudUrl}
              placeholder="Lien SoundCloud"
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  mixtapes: d.mixtapes.map((x, j) =>
                    j === i ? { ...x, soundcloudUrl: e.target.value } : x
                  ),
                }))
              }
            />
          </div>
          <div className="admx-trow-side">
            <label className="admx-check" title="Dans les 6 affichées par défaut">
              <input
                type="checkbox"
                checked={m.featured}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    mixtapes: d.mixtapes.map((x, j) =>
                      j === i ? { ...x, featured: e.target.checked } : x
                    ),
                  }))
                }
              />
              Affichée
            </label>
            <button
              type="button"
              className="admx-btn admx-btn-sm admx-btn-danger"
              onClick={() => {
                if (window.confirm(`Supprimer « ${m.title} » ?`)) {
                  update((d) => ({ ...d, mixtapes: d.mixtapes.filter((_, j) => j !== i) }));
                }
              }}
            >
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MixtapesPage;
