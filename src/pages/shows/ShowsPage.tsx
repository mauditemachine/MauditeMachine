/**
 * /shows/ en page a part (2026-11-27, Mika : "je trouve ca pas cool d'ouvrir cette page directement dans la page des
 * machines.. je voudrais faire une autre page pour ca"), maquette A choisie : l'affiche du prochain show en grand a
 * gauche, sa date, son lieu et le bouton des billets a droite, puis les autres dates a venir et les shows passes.
 *
 * Les dates viennent de public/events.json (a venir, et les passees recentes) et public/past-events.json (l'historique
 * par annee), lus au montage. Le texte lisible sans JavaScript (et par Google) reste #seo-static, pose par
 * scripts/prerender-seo.mjs a cote de #root. La page ne charge rien de la machine (chunk a part, pas de three).
 */

import React, { useEffect, useMemo, useState } from 'react';
import './shows.css';

interface RawEvent {
  date?: unknown;
  title?: unknown;
  venue?: unknown;
  city?: unknown;
  street?: unknown;
  location?: unknown;
  startTime?: unknown;
  endDate?: unknown;
  price?: unknown;
  currency?: unknown;
  image?: unknown;
  url?: unknown;
  ticketUrl?: unknown;
}

interface Show {
  date: string;
  title: string;
  venue: string | null;
  city: string | null;
  street: string | null;
  location: string;
  start: string | null;
  end: string | null;
  price: string | null;
  image: string | null;
  url: string | null;
  ticketUrl: string | null;
}

interface PastShow {
  date: string;
  name: string;
  place: string;
  url: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const http = (v: unknown): string | null => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim()) ? v.trim() : null);
const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));
const isoToday = (d: Date = new Date()): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const partsOf = (iso: string): { y: number; m: number; d: number; wd: number } => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() };
};
/** "Sat 27 Feb 2027" */
const longDate = (iso: string): string => {
  const p = partsOf(iso);
  return `${DAYS[p.wd]} ${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
};
/** "27 Feb 2027" */
const shortDate = (iso: string): string => {
  const p = partsOf(iso);
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
};
/** L'heure "21:00" d'un "21:00-05:00" ou d'une date ISO complete. */
const hourOf = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const m = /(?:^|T)(\d{2}:\d{2})/.exec(s);
  return m ? m[1] : null;
};

function toShow(e: RawEvent): Show | null {
  const date = str(e.date);
  const title = str(e.title);
  if (!date || !DATE_RE.test(date) || !title) return null;
  const price = typeof e.price === 'number' ? String(e.price) : str(e.price);
  const cur = str(e.currency)?.toUpperCase();
  const image = str(e.image);
  return {
    date,
    title,
    venue: str(e.venue),
    city: str(e.city),
    street: str(e.street),
    location: str(e.location) ?? '',
    start: hourOf(e.startTime),
    end: hourOf(e.endDate),
    price: price ? (cur === 'EUR' ? `${price} €` : `${price} $`) : null,
    image: image ? `/${image.replace(/^\/+/, '')}` : null,
    url: http(e.url),
    ticketUrl: http(e.ticketUrl),
  };
}

const placeOf = (s: Show): string => {
  if (s.venue) return [s.venue, s.street, s.city].filter(Boolean).join(', ');
  return s.location;
};

const fetchJson = (url: string): Promise<unknown> =>
  fetch(url, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

const LOGO = '/logo/mauditemachine-logo-gold.svg';
const NAV: readonly [string, string][] = [
  ['Tracks', '/tracks/'],
  ['Mixtapes', '/mixtapes/'],
  ['MM-RYTM', '/mm-rytm/'],
  ['MM-ARP', '/mm-arp/'],
  ['Goodies', '/goodies/'],
  ['Shows', '/shows/'],
  ['Press', '/presskit/'],
  ['Contact', '/contact/'],
];

const Ext: React.FC<{ href: string; className?: string; children: React.ReactNode }> = ({ href, className, children }) => (
  <a href={href} className={className} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

const ShowsPage: React.FC = () => {
  const [events, setEvents] = useState<Show[] | null>(null);
  const [history, setHistory] = useState<PastShow[]>([]);

  useEffect(() => {
    // La coquille de demarrage de la machine n'a rien a faire ici (prerendu ou navigation depuis la machine)
    document.getElementById('mm-boot')?.remove();
    document.documentElement.classList.add('mm-shows-root');
    let alive = true;
    Promise.all([fetchJson('/events.json'), fetchJson('/past-events.json')]).then(([ev, past]) => {
      if (!alive) return;
      const list = (Array.isArray(ev) ? ev : []).map((e) => toShow(e as RawEvent)).filter((s): s is Show => s !== null);
      setEvents(list);
      const years = past && typeof past === 'object' && Array.isArray((past as { events?: unknown }).events) ? (past as { events: { shows?: unknown }[] }).events : [];
      const out: PastShow[] = [];
      for (const y of years) {
        for (const s of Array.isArray(y.shows) ? (y.shows as Record<string, unknown>[]) : []) {
          const date = str(s.date);
          const name = str(s.name);
          if (!date || !DATE_RE.test(date) || !name) continue;
          out.push({ date, name, place: [str(s.venue), str(s.city)].filter(Boolean).join(', '), url: http(s.facebook_event) ?? http(s.url) });
        }
      }
      setHistory(out);
    });
    return () => {
      alive = false;
      document.documentElement.classList.remove('mm-shows-root');
    };
  }, []);

  const today = isoToday();
  const upcoming = useMemo(() => (events ?? []).filter((s) => s.date >= today).sort((a, b) => a.date.localeCompare(b.date)), [events, today]);
  const past = useMemo(() => {
    const recent: PastShow[] = (events ?? [])
      .filter((s) => s.date < today)
      .map((s) => ({ date: s.date, name: s.title, place: s.location, url: s.url }));
    const seen = new Set(recent.map((s) => `${s.date}|${s.name.toLowerCase()}`));
    const all = [...recent, ...history.filter((s) => !seen.has(`${s.date}|${s.name.toLowerCase()}`))];
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }, [events, history, today]);
  const byYear = useMemo(() => {
    const m = new Map<string, PastShow[]>();
    for (const s of past) {
      const y = s.date.slice(0, 4);
      if (!m.has(y)) m.set(y, []);
      m.get(y)!.push(s);
    }
    return [...m.entries()];
  }, [past]);

  // En vedette : toujours la plus proche date (2026-11-27, Mika : "affiche dabord les premiers") ; les autres dessous
  const next = upcoming[0] ?? null;
  const more = upcoming.slice(1);

  return (
    <div className="mms">
      <header className="mms-head">
        <a href="/" className="mms-logo" aria-label="Maudite Machine, home">
          <img src={LOGO} alt="Maudite Machine" width={150} height={33} />
        </a>
        <nav className="mms-nav" aria-label="Site">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} aria-current={href === '/shows/' ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <a href="/" className="mms-machines">
          Machines <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className="mms-main">
        {events === null && <p className="mms-wait">Loading dates…</p>}

        {events !== null && next && (
          <section className="mms-next" aria-labelledby="mms-next-title">
            {!next.image && (
              <figure className="mms-poster mms-poster--blank" aria-hidden="true">
                <span>{next.title.split(' · ')[0]}</span>
                <small>{shortDate(next.date)}</small>
              </figure>
            )}
            {next.image && (
              <figure className="mms-poster">
                {next.ticketUrl || next.url ? (
                  <Ext href={(next.ticketUrl ?? next.url)!}>
                    <img src={next.image} alt={`${next.title} poster`} />
                  </Ext>
                ) : (
                  <img src={next.image} alt={`${next.title} poster`} />
                )}
              </figure>
            )}
            <div className="mms-info">
              <p className="mms-k">Next show</p>
              <h1 className="mms-title" id="mms-next-title">
                {next.title.split(' · ')[0]}
              </h1>
              <p className="mms-when">
                <time dateTime={next.date}>{longDate(next.date)}</time>
                {next.start && ` · ${next.start}${next.end ? ` - ${next.end}` : ''}`}
              </p>
              <p className="mms-where">
                {placeOf(next)}
                {next.title.includes(' · ') && ` · ${next.title.split(' · ').slice(1).join(' · ')}`}
              </p>
              {(next.ticketUrl || next.url) && (
                <Ext href={(next.ticketUrl ?? next.url)!} className="mms-btn">
                  {next.ticketUrl ? `Get tickets${next.price ? ` · from ${next.price}` : ''}` : 'Event info'}
                </Ext>
              )}

              {more.length > 0 && (
                <div className="mms-block">
                  <h2 className="mms-k">Also coming</h2>
                  <ol className="mms-rows">
                    {more.map((s) => {
                      const body = (
                        <>
                          <time className="mms-k mms-row-date" dateTime={s.date}>
                            {shortDate(s.date)}
                          </time>
                          <span className="mms-row-title">{s.title}</span>
                          <span className="mms-row-place">{s.city ?? s.location}</span>
                        </>
                      );
                      const href = s.ticketUrl ?? s.url;
                      return (
                        <li key={`${s.date}-${s.title}`}>
                          {href ? (
                            <Ext href={href} className="mms-row">
                              {body}
                            </Ext>
                          ) : (
                            <span className="mms-row">{body}</span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          </section>
        )}

        {events !== null && !next && (
          <section className="mms-empty">
            <h1 className="mms-title">Shows</h1>
            <p className="mms-where">No upcoming dates. For booking, write to me.</p>
            <a href="/contact/" className="mms-btn">
              Booking
            </a>
          </section>
        )}

        {byYear.length > 0 && (
          <section className="mms-past" aria-labelledby="mms-past-title">
            <h2 className="mms-k" id="mms-past-title">
              Past shows
            </h2>
            {byYear.map(([year, shows]) => (
              <div className="mms-year" key={year}>
                <h3 className="mms-year-n">{year}</h3>
                <ul>
                  {shows.map((s) => (
                    <li key={`${s.date}-${s.name}`}>
                      {s.url ? <Ext href={s.url}>{s.name}</Ext> : s.name}
                      {s.place && <span className="mms-mute"> · {s.place}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <footer className="mms-foot">
          <a href="/contact/">Booking</a>
          <a href="/techrider/">Tech rider</a>
          <a href="/press/">Press</a>
          <a href="/">MM-STUDIO</a>
        </footer>
      </main>
    </div>
  );
};

export default ShowsPage;
