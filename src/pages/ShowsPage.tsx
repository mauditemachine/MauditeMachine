/**
 * ShowsPage — concerts a venir + Wall of Fame (archive typographique).
 */

import React, { useEffect, useState } from 'react';
import EventsDisplay from '../components/EventsDisplay';
import { useTranslation } from '../lib/i18n';
import { setJsonLd } from '../lib/seo';
import { buildEventsJsonLd, type UpcomingEvent } from '../lib/eventSchema';
import { fetchEvents } from '../utils/sanityQueries';
import { cn } from '../lib/cn';

interface PastShow {
  name: string;
  date: string;
  venue: string;
  city: string;
  lineup?: string[];
  facebook_event?: string;
}
interface YearArchive {
  year: number;
  shows: PastShow[];
}

/** "2026-07-23" -> 2026 */
const anneeDe = (date: string): number => Number(String(date).slice(0, 4)) || 0;

/**
 * Cle de dedup du Wall of Fame, insensible a la casse et a la ponctuation :
 * le meme show peut s'ecrire "GROOVE & BASS" dans l'archive et "GROOVE&BASS"
 * dans events.json, il ne doit pas apparaitre deux fois.
 */
const showKey = (name: string, date: string): string =>
  `${String(date).slice(0, 10)}|${String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}`;

const ShowsPage: React.FC = () => {
  const { t } = useTranslation();
  const [showsArchive, setShowsArchive] = useState<YearArchive[]>([]);

  useEffect(() => {
    let cancelled = false;

    const base = import.meta.env.BASE_URL;
    const jour = (d: unknown) => String(d ?? '').slice(0, 10);

    Promise.all([
      // 1. L'archive curee, avec lineups et liens Facebook.
      fetch(`${base}past-events.json`)
        .then((r) => r.json())
        .catch(() => null),
      // 2. Le fichier des dates, jamais filtre : c'est le filet de securite.
      fetch(`${base}events.json?t=${Date.now()}`)
        .then((r) => r.json())
        .catch(() => null),
      // 3. Sanity en incluant les dates marquees "past", que fetchEvents()
      //    ecarte par defaut. Un event qui n'existerait que la doit remonter.
      fetchEvents(true).catch(() => null),
    ]).then(([archive, locaux, distants]) => {
      if (cancelled) return;

      const parAnnee = new Map<number, PastShow[]>();
      const vus = new Set<string>();

      const ajouter = (show: PastShow) => {
        const date = jour(show.date);
        if (!date) return;
        const cle = showKey(show.name, date);
        if (vus.has(cle)) return;
        vus.add(cle);
        const an = anneeDe(date);
        if (!parAnnee.has(an)) parAnnee.set(an, []);
        parAnnee.get(an)!.push({ ...show, date });
      };

      // L'archive passe en premier : ses entrees sont les plus riches, et
      // le dedup garde la premiere vue de chaque show.
      for (const y of (archive?.events ?? []) as YearArchive[]) {
        for (const s of y?.shows ?? []) ajouter(s);
      }

      // Toute date deja passee rejoint l'archive automatiquement. C'est ce
      // qui manquait : un show termine mais jamais recopie a la main dans
      // past-events.json n'apparaissait nulle part sur le site, ni dans les
      // dates a venir (trop tard) ni dans le Wall of Fame (jamais ajoute).
      const aujourdhui = new Date().toISOString().slice(0, 10);
      const versShow = (e: any): PastShow => ({
        name: e?.title ?? '',
        date: jour(e?.date),
        venue: e?.location ?? '',
        city: '',
        facebook_event: e?.url || undefined,
      });

      for (const e of Array.isArray(locaux) ? locaux : []) {
        if (jour(e?.date) < aujourdhui) ajouter(versShow(e));
      }
      for (const e of Array.isArray(distants) ? distants : []) {
        if (jour(e?.date) < aujourdhui) ajouter(versShow(e));
      }

      const fusionne = Array.from(parAnnee.entries())
        .map(([year, shows]) => ({
          year,
          shows: shows.slice().sort((a, b) => b.date.localeCompare(a.date)),
        }))
        .sort((a, b) => b.year - a.year);

      setShowsArchive(fusionne);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // JSON-LD MusicEvent pour les dates a venir : declenche les rich results
  // Google Events (carrousel de concerts dans les resultats de recherche).
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}events.json`)
      .then((r) => r.json())
      .then((data: UpcomingEvent[]) => {
        if (cancelled) return;
        setJsonLd('ld-events', buildEventsJsonLd(Array.isArray(data) ? data : []));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      // Retire le JSON-LD events quand on quitte la page Shows
      document.getElementById('ld-events')?.remove();
    };
  }, []);

  return (
    <section className="pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <h1 className="sr-only">{t.headings.shows}</h1>

      <EventsDisplay showPastEventsButton={false} />

      {/* WALL OF FAME — typographic archive avec liens Facebook */}
      {showsArchive.length > 0 && (
        <div className="mt-24 md:mt-40">
          <div className="flex items-baseline justify-between mb-8 md:mb-14">
            <div className="text-base md:text-lg font-extrabold uppercase tracking-wide text-white font-body">
              {t.shows.wallOfFame}
            </div>
            <div className="text-sm md:text-base font-bold uppercase tracking-wide text-white/60 font-body">
              {showsArchive[showsArchive.length - 1]?.year} / {showsArchive[0]?.year}
            </div>
          </div>

          <div className="pk-glass rounded-2xl md:rounded-3xl p-4 md:p-6">
            <div className="max-h-[500px] overflow-y-auto pr-4 custom-scrollbar divide-y divide-white/5">
              {showsArchive.map((row, i) => (
                <div
                  key={row.year}
                  className={cn(
                    'grid gap-4 md:gap-8 py-6 md:py-10 animate-fade-up items-start',
                    'grid-cols-1 md:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr]',
                  )}
                  style={{
                    animationDelay: `${100 + i * 60}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  <div
                    className={cn(
                      'font-display font-black uppercase text-ink-95',
                      'text-4xl md:text-6xl lg:text-7xl',
                      'leading-none tracking-[-0.03em]',
                      'md:sticky md:top-0',
                    )}
                  >
                    {row.year}
                  </div>
                  <div className="flex flex-col gap-2 md:gap-3 min-w-0">
                    {row.shows.map((show, j) => {
                      const href = show.facebook_event;
                      const content = (
                        <>
                          <div className="font-body font-medium leading-tight text-ink-95 text-base md:text-xl lg:text-2xl group-hover:text-white transition-colors">
                            {show.name}
                          </div>
                          <div className="font-body text-xs md:text-sm text-white/50 leading-tight mt-0.5">
                            {show.venue}
                            {show.city ? ` · ${show.city}` : ''}
                            {show.lineup && show.lineup.length > 0 && (
                              <span className="text-white/30">
                                {' · w/ '}
                                {show.lineup.slice(0, 3).join(', ')}
                                {show.lineup.length > 3 && ' …'}
                              </span>
                            )}
                          </div>
                        </>
                      );
                      if (href) {
                        return (
                          <a
                            key={`${row.year}-${j}`}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-start gap-3 md:gap-4 no-underline text-inherit hover:bg-white/[0.03] rounded-lg px-2 py-1 -mx-2 transition-colors"
                          >
                            <span className="flex-1 min-w-0">{content}</span>
                            <svg
                              className="shrink-0 w-4 h-4 md:w-5 md:h-5 mt-1 text-white/30 group-hover:text-white transition-colors"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M7 17L17 7M17 7H8M17 7v9" />
                            </svg>
                          </a>
                        );
                      }
                      return (
                        <div key={`${row.year}-${j}`} className="px-2 py-1 -mx-2">
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ShowsPage;
