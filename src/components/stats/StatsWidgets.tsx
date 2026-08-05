/**
 * Widgets du dashboard /mm-admin/stats.
 * Regroupes dans un module unique : SummaryCards, FollowersChart,
 * StreamsChart, GeoChart, PostsGrid. Style dark minimal du site
 * (verre .radar-glass-like, SF Pro, pas de caps forcees).
 */

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  type StatsPublic,
  type Snapshot,
  latestSnapshot,
  delta,
  followersSeries,
  geoBreakdown,
} from '../../utils/statsData';

/** Couleurs par plateforme : seules touches colorees du dashboard. */
export const PLATFORM_COLORS: Record<string, string> = {
  YouTube: '#ef4444',
  Spotify: '#22c55e',
  Instagram: '#d946ef',
  Facebook: '#3b82f6',
  SoundCloud: '#f97316',
  TikTok: '#22d3ee',
  Ditto: '#a3a3a3',
};

const glass = 'rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-5';

const nf = new Intl.NumberFormat('fr-CA');

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-block font-body text-[10px] text-white/60 border border-white/15 rounded-full px-2 py-0.5">
    {children}
  </span>
);

const tooltipStyle = {
  backgroundColor: 'rgba(10,10,12,0.95)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  color: '#fff',
  fontSize: 12,
};

/* ---------------- Cards resume ---------------- */

interface CardDef {
  platform: string;
  status: string;
  error?: string;
  value?: number;
  diff: number | null;
  sub?: string;
}

export const SummaryCards: React.FC<{ stats: StatsPublic; labels: { unavailable: string; disabled: string } }> = ({
  stats,
  labels,
}) => {
  const last = latestSnapshot(stats);
  const defs: CardDef[] = [
    {
      platform: 'YouTube',
      status: last?.youtube.status ?? 'unavailable',
      error: last?.youtube.error,
      ...delta(stats, (s: Snapshot) => (s.youtube.status === 'ok' ? s.youtube.subscribers : undefined)),
      sub: last?.youtube.status === 'ok' ? `${nf.format(last.youtube.totalViews ?? 0)} vues` : undefined,
    },
    {
      platform: 'Spotify',
      status: last?.spotify.status ?? 'unavailable',
      error: last?.spotify.error,
      ...delta(stats, (s: Snapshot) => (s.spotify.status === 'ok' ? s.spotify.followers : undefined)),
      sub: last?.spotify.status === 'ok' ? `popularité ${last.spotify.popularity}` : undefined,
    },
    {
      platform: 'Instagram',
      status: last?.instagram.status ?? 'unavailable',
      error: last?.instagram.error,
      ...delta(stats, (s: Snapshot) => (s.instagram.status === 'ok' ? s.instagram.followers : undefined)),
      sub:
        last?.instagram.status === 'ok' && last.instagram.reach !== undefined
          ? `reach 28 j : ${nf.format(last.instagram.reach)}`
          : undefined,
    },
    {
      platform: 'Facebook',
      status: last?.facebook.status ?? 'unavailable',
      error: last?.facebook.error,
      ...delta(stats, (s: Snapshot) => (s.facebook.status === 'ok' ? s.facebook.followers : undefined)),
    },
    {
      platform: 'SoundCloud',
      status: last?.soundcloud.status ?? 'unavailable',
      error: last?.soundcloud.error,
      ...delta(stats, (s: Snapshot) => (s.soundcloud.status === 'ok' ? s.soundcloud.followers : undefined)),
    },
    ...(stats.manual.tiktok
      ? [
          {
            platform: 'TikTok',
            status: 'ok',
            value: stats.manual.tiktok.followers,
            diff: null,
            sub: `import CSV ${stats.manual.tiktok.importedAt.slice(0, 10)}`,
          } as CardDef,
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {defs.map((d) => (
        <div key={d.platform} className={glass}>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: PLATFORM_COLORS[d.platform] || '#888' }}
              aria-hidden="true"
            />
            <span className="font-body font-semibold text-white/85 text-xs">{d.platform}</span>
          </div>
          {d.status === 'ok' ? (
            <>
              <div className="font-body font-bold text-white text-xl md:text-2xl leading-none">
                {d.value !== undefined ? nf.format(d.value) : '–'}
              </div>
              <div className="mt-1.5 flex items-center gap-2 min-h-[18px]">
                {d.diff !== null && d.diff !== 0 && (
                  <span
                    className={`font-body text-[11px] font-semibold ${d.diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {d.diff > 0 ? '+' : ''}
                    {nf.format(d.diff)}
                  </span>
                )}
                {d.sub && <span className="font-body text-[10px] text-white/45 truncate">{d.sub}</span>}
              </div>
            </>
          ) : (
            <div title={d.error}>
              <Badge>{d.status === 'disabled' ? labels.disabled : labels.unavailable}</Badge>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/* ---------------- Ligne : followers dans le temps ---------------- */

export const FollowersChart: React.FC<{ stats: StatsPublic; title: string; empty: string }> = ({
  stats,
  title,
  empty,
}) => {
  const data = followersSeries(stats);
  const hasData = data.some((d) => Object.values(d).some((v) => typeof v === 'number'));
  return (
    <div className={glass}>
      <div className="font-body font-semibold text-white/85 text-sm mb-3">{title}</div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} />
            <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
            {Object.keys(PLATFORM_COLORS)
              .filter((p) => ['YouTube', 'Spotify', 'Instagram', 'Facebook', 'SoundCloud'].includes(p))
              .map((p) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={p}
                  stroke={PLATFORM_COLORS[p]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="font-body text-white/45 text-sm m-0 py-8 text-center">{empty}</p>
      )}
    </div>
  );
};

/* ---------------- Barres : streams par plateforme (Ditto) ---------------- */

export const StreamsChart: React.FC<{ stats: StatsPublic; title: string; empty: string }> = ({
  stats,
  title,
  empty,
}) => {
  const ditto = stats.manual.ditto;
  const data = ditto
    ? Object.entries(ditto.streamsByPlatform)
        .map(([platform, streams]) => ({ platform, streams }))
        .sort((a, b) => b.streams - a.streams)
        .slice(0, 12)
    : [];
  return (
    <div className={glass}>
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-body font-semibold text-white/85 text-sm">{title}</div>
        {ditto && (
          <span className="font-body text-[10px] text-white/45">import {ditto.importedAt.slice(0, 10)}</span>
        )}
      </div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="platform" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} />
            <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="streams" fill="rgba(255,255,255,0.75)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="font-body text-white/45 text-sm m-0 py-8 text-center">{empty}</p>
      )}
    </div>
  );
};

/* ---------------- Camembert : provenance geographique ---------------- */

const PIE_COLORS = ['#ffffff', '#a3a3a3', '#737373', '#ef4444', '#22c55e', '#3b82f6', '#d946ef', '#f97316', '#22d3ee', '#eab308'];

export const GeoChart: React.FC<{ stats: StatsPublic; title: string; empty: string }> = ({ stats, title, empty }) => {
  // Agrege toutes sources confondues, top 9 + Autres
  const merged: Record<string, number> = {};
  for (const { country, value } of geoBreakdown(stats)) {
    merged[country] = (merged[country] || 0) + value;
  }
  const sorted = Object.entries(merged).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 9).map(([name, value]) => ({ name, value }));
  const rest = sorted.slice(9).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) top.push({ name: 'Autres', value: rest });

  return (
    <div className={glass}>
      <div className="font-body font-semibold text-white/85 text-sm mb-3">{title}</div>
      {top.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={top} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} stroke="none">
              {top.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.85} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <p className="font-body text-white/45 text-sm m-0 py-8 text-center">{empty}</p>
      )}
    </div>
  );
};

/* ---------------- Grille des derniers contenus ---------------- */

interface GridItem {
  key: string;
  platform: string;
  title: string;
  date: string;
  thumbnail?: string;
  link?: string;
  metrics: string;
}

export const PostsGrid: React.FC<{ stats: StatsPublic; title: string; empty: string }> = ({ stats, title, empty }) => {
  const last = latestSnapshot(stats);
  const items: GridItem[] = [];

  if (last?.youtube.status === 'ok') {
    for (const v of last.youtube.videos ?? []) {
      items.push({
        key: `yt-${v.id}`,
        platform: 'YouTube',
        title: v.title,
        date: v.publishedAt.slice(0, 10),
        thumbnail: v.thumbnail,
        link: `https://www.youtube.com/watch?v=${v.id}`,
        metrics: `${nf.format(v.views)} vues · ${nf.format(v.likes)} likes`,
      });
    }
  }
  if (last?.instagram.status === 'ok') {
    for (const p of last.instagram.posts ?? []) {
      items.push({
        key: `ig-${p.id}`,
        platform: 'Instagram',
        title: p.caption || p.type,
        date: p.timestamp.slice(0, 10),
        thumbnail: p.thumbnail,
        link: p.permalink,
        metrics: [
          `${nf.format(p.likes)} likes`,
          p.plays !== undefined ? `${nf.format(p.plays)} plays` : null,
          p.saves !== undefined ? `${nf.format(p.saves)} saves` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className={glass}>
      <div className="font-body font-semibold text-white/85 text-sm mb-3">{title}</div>
      {items.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.slice(0, 18).map((it) => (
            <a
              key={it.key}
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block no-underline text-inherit rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-white/30 transition-colors"
            >
              <div className="aspect-square bg-white/5 overflow-hidden">
                {it.thumbnail && (
                  <img src={it.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: PLATFORM_COLORS[it.platform] || '#888' }}
                  />
                  <span className="font-body text-[10px] text-white/50">{it.date}</span>
                </div>
                <div className="font-body text-[11px] text-white/85 leading-tight truncate mt-0.5">{it.title}</div>
                <div className="font-body text-[10px] text-white/45 truncate mt-0.5">{it.metrics}</div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="font-body text-white/45 text-sm m-0 py-8 text-center">{empty}</p>
      )}
    </div>
  );
};
