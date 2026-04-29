/**
 * ShowsPage — concerts a venir + Wall of Fame (archive typographique).
 */

import React, { useEffect, useState } from 'react';
import EventsDisplay from '../components/EventsDisplay';
import { useTranslation } from '../lib/i18n';
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

const ShowsPage: React.FC = () => {
  const { t } = useTranslation();
  const [showsArchive, setShowsArchive] = useState<YearArchive[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}past-events.json`)
      .then((r) => r.json())
      .then((data: { events: YearArchive[] }) => {
        if (cancelled) return;
        const sorted = (data.events || [])
          .slice()
          .sort((a, b) => b.year - a.year)
          .map((y) => ({
            ...y,
            shows: y.shows.slice().sort((a, b) => b.date.localeCompare(a.date)),
          }));
        setShowsArchive(sorted);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <EventsDisplay showPastEventsButton={false} />

      {/* WALL OF FAME — typographic archive avec liens Facebook */}
      {showsArchive.length > 0 && (
        <div className="mt-24 md:mt-40">
          <div className="flex items-baseline justify-between mb-8 md:mb-14">
            <div className="text-base md:text-lg font-extrabold uppercase tracking-wide text-white font-body">
              {t.shows.wallOfFame}
            </div>
            <div className="text-sm md:text-base font-bold uppercase tracking-wide text-white/60 font-body">
              {showsArchive[showsArchive.length - 1]?.year} — {showsArchive[0]?.year}
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
