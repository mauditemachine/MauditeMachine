/**
 * /mm-admin/stats — dashboard analytics musique multi-plateformes.
 *
 * Lecture : public/data/stats-public.json (fichier statique, dispo partout,
 * y compris en prod GitHub Pages derriere le rideau StatsGate).
 * Actions (localhost uniquement, via server.js) : refresh manuel du
 * collecteur, import des CSV Ditto / Bandcamp / TikTok, lecture des revenus
 * prives (data/stats-private.json, jamais publie).
 *
 * StatsGate : rideau mot de passe cote client pour la prod. C'est un rideau,
 * pas un coffre (site statique) : les donnees publiees restent des stats
 * d'artiste essentiellement publiques ; les revenus, eux, ne quittent pas
 * le local.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadStatsPublic,
  loadStatsPrivate,
  latestSnapshot,
  EMPTY_STATS,
  type StatsPublic,
  type StatsPrivate,
} from '../utils/statsData';
import { SummaryCards, FollowersChart, StreamsChart, GeoChart, PostsGrid } from '../components/stats/StatsWidgets';
import AdminCurtain from '../components/ui/AdminCurtain';
import AdminNav from '../components/ui/AdminNav';

const isLocalhost = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const API = 'http://localhost:3001';

/* ---------------- Dashboard ---------------- */

const AdminStatsPage: React.FC = () => {
  const [stats, setStats] = useState<StatsPublic>(EMPTY_STATS);
  const [priv, setPriv] = useState<StatsPrivate | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvType, setCsvType] = useState<'ditto' | 'bandcamp' | 'tiktok'>('ditto');

  const reload = useCallback(async () => {
    setStats(await loadStatsPublic());
    setPriv(await loadStatsPrivate());
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const notify = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 6000);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API}/api/stats/refresh`, { method: 'POST' });
      const data = await res.json();
      notify(data.success ? 'Snapshot mis à jour.' : `Refresh en erreur : ${String(data.log || '').slice(-160)}`);
      await reload();
    } catch {
      notify('Serveur local injoignable (npm run admin).');
    } finally {
      setRefreshing(false);
    }
  };

  const uploadCsv = async (file: File) => {
    try {
      const body = new FormData();
      body.append('csv', file);
      const res = await fetch(`${API}/api/stats/upload-csv?type=${csvType}`, { method: 'POST', body });
      const data = await res.json();
      if (data.success) {
        const warn = data.warnings?.length ? ` (attention : ${data.warnings.join(', ')})` : '';
        notify(`CSV ${csvType} importé, ${data.rows} lignes${warn}.`);
      } else {
        notify(`Import échoué : ${data.message}`);
      }
      await reload();
    } catch {
      notify('Serveur local injoignable (npm run admin).');
    }
  };

  const last = latestSnapshot(stats);
  const local = isLocalhost();
  const lastRevenue = priv?.dittoRevenue?.[priv.dittoRevenue.length - 1];

  const labels = { unavailable: 'indisponible', disabled: 'désactivé' };

  return (
    <section className="pt-24 pb-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <h1 className="sr-only">Stats Maudite Machine</h1>

      <AdminNav />

      {/* En-tete : etat + actions */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="text-base md:text-lg font-extrabold text-white font-body mr-auto">Stats</div>
        {last && (
          <span className="font-body text-[11px] text-white/50">
            dernier snapshot : {last.generatedAt.slice(0, 16).replace('T', ' ')} ({last.origin})
          </span>
        )}
        {local && (
          <>
            <select
              value={csvType}
              onChange={(e) => setCsvType(e.target.value as typeof csvType)}
              className="font-body text-xs text-white bg-white/5 border border-white/15 rounded-lg px-2 py-1.5"
            >
              <option value="ditto">CSV Ditto</option>
              <option value="bandcamp">CSV Bandcamp</option>
              <option value="tiktok">CSV TikTok</option>
            </select>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="font-body text-xs font-semibold text-white/85 bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 cursor-pointer hover:border-white/40"
            >
              Importer
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCsv(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="font-body text-xs font-semibold bg-white text-black border-0 rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-50"
            >
              {refreshing ? 'Refresh…' : 'Rafraîchir les sources'}
            </button>
          </>
        )}
      </div>

      {flash && (
        <p className="font-body text-xs text-white/80 bg-white/10 border border-white/15 rounded-lg px-3 py-2 mb-4">
          {flash}
        </p>
      )}

      {loaded && stats.snapshots.length === 0 ? (
        <p className="font-body text-white/50">
          Aucun snapshot. {local ? 'Clique "Rafraîchir les sources" ou lance npm run stats.' : ''}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <SummaryCards stats={stats} labels={labels} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FollowersChart stats={stats} title="Évolution des followers" empty="Pas encore assez de snapshots." />
            <GeoChart
              stats={stats}
              title="Provenance des auditeurs"
              empty="Aucune donnée géo (YouTube Analytics, Instagram ou CSV Ditto)."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StreamsChart stats={stats} title="Streams par plateforme (Ditto)" empty="Importe un rapport Ditto." />

            {/* Revenus : local uniquement, jamais publies */}
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-5">
              <div className="font-body font-semibold text-white/85 text-sm mb-3">
                Revenus Ditto <span className="text-white/40 font-normal">(local uniquement)</span>
              </div>
              {!local ? (
                <p className="font-body text-white/45 text-sm m-0 py-8 text-center">
                  Consultables uniquement en local (npm run admin).
                </p>
              ) : lastRevenue ? (
                <>
                  <div className="font-body font-bold text-white text-2xl">
                    {lastRevenue.total.toFixed(2)} {lastRevenue.currency}
                  </div>
                  <div className="font-body text-[11px] text-white/45 mb-3">
                    import {lastRevenue.importedAt.slice(0, 10)}
                  </div>
                  <div className="flex flex-col gap-1">
                    {Object.entries(lastRevenue.byPlatform)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([platform, amount]) => (
                        <div key={platform} className="flex justify-between font-body text-xs text-white/70">
                          <span>{platform}</span>
                          <span>
                            {amount.toFixed(2)} {lastRevenue.currency}
                          </span>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <p className="font-body text-white/45 text-sm m-0 py-8 text-center">Importe un rapport Ditto.</p>
              )}
            </div>
          </div>

          <PostsGrid stats={stats} title="Derniers contenus" empty="Aucun post récupéré (YouTube / Instagram indisponibles)." />
        </div>
      )}
    </section>
  );
};

const AdminStatsWithGate: React.FC = () => (
  <AdminCurtain>
    <AdminStatsPage />
  </AdminCurtain>
);

export default AdminStatsWithGate;
