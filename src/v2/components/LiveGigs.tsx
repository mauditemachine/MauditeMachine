/**
 * Live & gigs /v2 : dates via l'API publique Bandsintown (app_id public,
 * aucun secret), cache localStorage 24 h. Pas encore de profil artiste :
 * fallback elegant "Next dates coming soon" + CTA booking. Des que le
 * profil Bandsintown existera, les vraies dates apparaitront toutes
 * seules, sans redeploiement.
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

type State = { status: 'loading' | 'ready' | 'empty'; events: BitEvent[] };

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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
};

const LiveGigs: React.FC = () => {
  const [state, setState] = useState<State>(() => {
    const cached = readCache();
    if (cached) return { status: cached.length ? 'ready' : 'empty', events: cached };
    return { status: 'loading', events: [] };
  });

  useEffect(() => {
    if (state.status !== 'loading') return;
    let alive = true;
    fetch(
      `https://rest.bandsintown.com/artists/${encodeURIComponent(ARTIST)}/events?app_id=${encodeURIComponent(APP_ID)}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        // Artiste inconnu : Bandsintown renvoie un objet erreur, pas un tableau
        return Array.isArray(data) ? (data as BitEvent[]) : [];
      })
      .then((events) => {
        if (!alive) return;
        writeCache(events);
        setState({ status: events.length ? 'ready' : 'empty', events });
      })
      .catch(() => {
        if (alive) setState({ status: 'empty', events: [] });
      });
    return () => {
      alive = false;
    };
  }, [state.status]);

  return (
    <section className="v2-section" id="live">
      <div className="v2-section-head">
        <h2 className="v2-section-title"><span className="v2-section-num">03</span>Live</h2>
        <span className="v2-label">Upcoming dates</span>
      </div>

      {state.status === 'ready' ? (
        <div className="v2-gigs" role="list">
          {state.events.map((ev) => {
            const ticket = ev.offers?.find((o) => o.url)?.url || ev.url;
            const place = [ev.venue?.city, ev.venue?.country].filter(Boolean).join(', ');
            return (
              <div key={ev.id || ev.datetime} className="v2-gig-row" role="listitem">
                <span className="v2-gig-date">{fmtDate(ev.datetime)}</span>
                <span className="v2-gig-venue">{ev.venue?.name || 'TBA'}</span>
                <span className="v2-label v2-gig-city">{place}</span>
                {ticket ? (
                  <a
                    className="v2-cta v2-gig-cta"
                    href={ticket}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Tickets
                  </a>
                ) : (
                  <span className="v2-label">TBA</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="v2-gigs-empty">
          <p className="v2-gigs-empty-line v2-subtitle">Next dates coming soon</p>
          <p className="v2-label">
            Booking inquiries welcome for Canada, France &amp; Spain.
          </p>
          {/* Les deux contacts booking vivent dans la section Contact */}
          <a className="v2-cta" href="#contact">
            Book Maudite Machine
          </a>
        </div>
      )}
    </section>
  );
};

export default LiveGigs;
