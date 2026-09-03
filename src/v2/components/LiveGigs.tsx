/**
 * Live & gigs /v2 : DEUX sources fusionnees, triees par date :
 *
 * - public/events.json (dates a venir) : la source editee dans l'admin
 *   local (onglet Evenements & boutique) — un ajout dans l'admin apparait
 *   ici ET sur l'archive v1, puis migre au Wall of Fame une fois passe.
 * - l'API publique Bandsintown (app_id public, aucun secret, cache
 *   localStorage 24 h) : vide tant que le profil artiste n'existe pas,
 *   bascule automatique des qu'il aura des dates.
 *
 * Le fallback "Next dates coming soon" ne s'affiche que si les deux
 * sources sont vides. CTA par origine : Tickets (Bandsintown, billets)
 * vs Details (event local, lien Facebook/infos).
 */

import React, { useEffect, useState } from 'react';

const ARTIST = 'mauditemachine';
// Convention js_<domaine> du widget officiel : les app_id arbitraires
// repondent 403 depuis le durcissement de l'API (verifie par curl).
const APP_ID = 'js_www.mauditemachine.com';
const CACHE_KEY = 'mm_v2_bit_events';
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface BitEvent {
  id: string;
  datetime: string;
  url?: string;
  venue?: { name?: string; city?: string; region?: string; country?: string };
  offers?: { type?: string; url?: string }[];
}

/** Ligne normalisee, quelle que soit la source. */
interface GigRow {
  id: string;
  dateISO: string;
  name: string;
  place: string;
  url?: string;
  cta: 'Tickets' | 'Details';
}

interface LocalEvent {
  date: string;
  title: string;
  url?: string;
  location?: string;
}

type State = { status: 'loading' | 'ready' | 'empty'; rows: GigRow[] };

const readCache = (): BitEvent[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, events } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL || !Array.isArray(events)) return null;
    return events;
  } catch {
    return null;
  }
};

const writeCache = (events: BitEvent[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), events }));
  } catch {
    /* stockage plein ou bloque : tant pis, on refetchera */
  }
};

const fmtDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
};

const bitToRow = (ev: BitEvent): GigRow => ({
  id: `bit-${ev.id || ev.datetime}`,
  dateISO: ev.datetime,
  name: ev.venue?.name || 'TBA',
  place: [ev.venue?.city, ev.venue?.country].filter(Boolean).join(', '),
  url: ev.offers?.find((o) => o.url)?.url || ev.url,
  cta: 'Tickets',
});

const localToRow = (ev: LocalEvent): GigRow => ({
  id: `local-${ev.date}-${ev.title}`,
  dateISO: ev.date,
  name: ev.title,
  place: ev.location || '',
  url: ev.url,
  cta: 'Details',
});

/** Fusion des deux sources : tri par date, dedup par jour + nom proche. */
const merge = (locals: GigRow[], bit: GigRow[]): GigRow[] => {
  const seen = new Set(locals.map((r) => r.dateISO.slice(0, 10)));
  const rows = [...locals, ...bit.filter((r) => !seen.has(r.dateISO.slice(0, 10)))];
  return rows.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
};

const fetchLocalEvents = async (): Promise<GigRow[]> => {
  try {
    const res = await fetch('/events.json');
    const data = await res.json();
    const list: LocalEvent[] = Array.isArray(data) ? data : data.events || [];
    const today = new Date().toISOString().slice(0, 10);
    return list.filter((e) => String(e.date || '') >= today).map(localToRow);
  } catch {
    return [];
  }
};

const fetchBitEvents = async (): Promise<GigRow[]> => {
  const cached = readCache();
  if (cached) return cached.map(bitToRow);
  const res = await fetch(
    `https://rest.bandsintown.com/artists/${encodeURIComponent(ARTIST)}/events?app_id=${encodeURIComponent(APP_ID)}`
  );
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  // Artiste inconnu : Bandsintown renvoie un objet erreur, pas un tableau
  const events = Array.isArray(data) ? (data as BitEvent[]) : [];
  writeCache(events);
  return events.map(bitToRow);
};

const LiveGigs: React.FC = () => {
  const [state, setState] = useState<State>({ status: 'loading', rows: [] });

  useEffect(() => {
    let alive = true;
    Promise.all([fetchLocalEvents(), fetchBitEvents().catch(() => [] as GigRow[])]).then(
      ([locals, bit]) => {
        if (!alive) return;
        const rows = merge(locals, bit);
        setState({ status: rows.length ? 'ready' : 'empty', rows });
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="v2-section" id="live">
      <div className="v2-section-head">
        <h2 className="v2-section-title"><span className="v2-section-num">03</span>Live</h2>
        <span className="v2-label">Upcoming dates</span>
      </div>

      {state.status === 'ready' ? (
        <div className="v2-gigs" role="list">
          {state.rows.map((row) => (
            <div key={row.id} className="v2-gig-row" role="listitem">
              <span className="v2-gig-date">{fmtDate(row.dateISO)}</span>
              <span className="v2-gig-venue">{row.name}</span>
              <span className="v2-label v2-gig-city">{row.place}</span>
              {row.url ? (
                <a
                  className="v2-cta v2-gig-cta"
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {row.cta}
                </a>
              ) : (
                <span className="v2-label">TBA</span>
              )}
            </div>
          ))}
        </div>
      ) : state.status === 'empty' ? (
        <div className="v2-gigs-empty">
          <p className="v2-gigs-empty-line v2-subtitle">Next dates coming soon</p>
          <p className="v2-label">
            Available for clubs, festivals and private events in Montréal, Québec and across Canada — also booking in France &amp; Spain.
          </p>
          {/* Les deux contacts booking vivent dans la section Contact */}
          <a className="v2-cta" href="#contact">
            Book Maudite Machine
          </a>
        </div>
      ) : (
        <p className="v2-label">Loading…</p>
      )}
    </section>
  );
};

export default LiveGigs;
