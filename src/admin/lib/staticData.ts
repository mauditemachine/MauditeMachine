/**
 * Mode consultation (production).
 *
 * Le site est statique : en ligne il n'existe aucun serveur d'ecriture.
 * Les pages de LECTURE (tableau de bord, visibilite Google) refont donc
 * le meme travail directement dans le navigateur, a partir des fichiers
 * publics du site deploye. Avantage : en prod l'audit porte sur le site
 * REELLEMENT en ligne, pas sur les sources locales.
 *
 * L'ECRITURE reste impossible en ligne (aucun backend) : les pages
 * d'edition affichent un message clair et renvoient vers l'admin local.
 */

import discographyData from '../../v2/data/discography.json';
import mixtapesData from '../../v2/data/mixtapes.json';

const j = async <T>(url: string, fallback: T): Promise<T> => {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
};

const txt = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
};

/** Une image referencee existe-t-elle vraiment sur le site en ligne ? */
const imageExists = async (rel?: string): Promise<boolean> => {
  if (!rel) return false;
  try {
    const res = await fetch(`/${String(rel).replace(/^\//, '')}`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
};

/* ---------------- Tableau de bord ---------------- */

export async function staticSummary() {
  const tracks = (discographyData as any).tracks || [];
  const mixtapes = (mixtapesData as any).mixtapes || [];

  const [releasesRaw, eventsRaw, storeRaw, mixesRaw] = await Promise.all([
    j<any>('/releases.json', []),
    j<any>('/events.json', []),
    j<any>('/store.json', []),
    j<any>('/mixes.json', []),
  ]);

  const releases = Array.isArray(releasesRaw) ? releasesRaw : releasesRaw.releases || [];
  const events = Array.isArray(eventsRaw) ? eventsRaw : eventsRaw.events || [];
  const store = Array.isArray(storeRaw) ? storeRaw : [];
  const mixes = Array.isArray(mixesRaw) ? mixesRaw : [];

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e: any) => String(e.date || '') >= today);

  const tracksNoSc = tracks.filter((t: any) => !t.soundcloudUrl);
  const tracksIncomplete = tracks.filter(
    (t: any) => !t.title || !t.project || !t.year || !t.link
  );

  // Verification reelle des visuels sur le site en ligne
  const mixArt = await Promise.all(mixtapes.map((m: any) => imageExists(m.artwork)));
  const relCovers = await Promise.all(releases.map((r: any) => imageExists(r.cover)));
  const missingImages = [
    ...mixtapes.filter((_: any, i: number) => !mixArt[i]).map((m: any) => `Mixtape ${m.number} : pochette introuvable`),
    ...releases.filter((_: any, i: number) => !relCovers[i]).map((r: any) => `Release « ${r.title} » : visuel introuvable`),
  ];

  const [presskit, riderEn, riderFr] = await Promise.all([
    imageExists('Presskit_Maudite_Machine_2026.pdf'),
    imageExists('techrider-en.pdf'),
    imageExists('techrider-fr.pdf'),
  ]);

  return {
    success: true,
    readOnly: true,
    counts: {
      tracks: tracks.length,
      tracksPlayable: tracks.length - tracksNoSc.length,
      tracksFeatured: tracks.filter((t: any) => t.featured).length,
      mixtapes: mixtapes.length,
      releases: releases.length,
      upcomingEvents: upcoming.length,
      pastEvents: events.length - upcoming.length,
      mixes: mixes.length,
      storeItems: store.length,
    },
    health: {
      tracksWithoutPlayback: tracksNoSc.map((t: any) => t.title),
      tracksIncomplete: tracksIncomplete.map((t: any) => t.title),
      missingImages,
      pdfs: { presskit, riderEn, riderFr },
    },
    // Poids des medias : mesurable seulement sur le disque local
    media: { imagesBytes: 0, videosBytes: 0, eventsBytes: 0 },
  };
}

/* ---------------- Visibilite Google ---------------- */

export async function staticSeo() {
  const [html, sitemap, robots, stats] = await Promise.all([
    txt('/'),
    txt('/sitemap.xml'),
    txt('/robots.txt'),
    j<any>('/data/stats-public.json', { snapshots: [] }),
  ]);

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (name: string) =>
    doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || null;

  const title = doc.querySelector('title')?.textContent || null;
  const description = meta('description');
  const keywords = meta('keywords');

  let musicGroup: any = null;
  try {
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.textContent || '[]');
    musicGroup = Array.isArray(ld) ? ld.find((x: any) => x['@type'] === 'MusicGroup') : null;
  } catch {
    /* JSON-LD illisible : les verifications le signaleront */
  }

  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const ga4 = (html.match(/G-[A-Z0-9]{8,}/) || [])[0] || null;
  const fbPixel = /fbq\('init'/.test(html);

  const last = (stats.snapshots || []).slice(-1)[0];
  const visits = last?.ga4?.status === 'ok' ? last.ga4 : last?.ga4 ? { status: last.ga4.status } : null;

  const checks = [
    {
      key: 'title',
      label: 'Titre du site',
      ok: !!title && /montr[ée]al/i.test(title),
      detail: title || 'absent',
      why: 'Le titre est la première chose que Google affiche. Contenir « Montréal » aide à sortir sur « DJ Montréal ».',
    },
    {
      key: 'description',
      label: 'Description',
      ok: !!description && description.length > 80 && description.length < 320,
      detail: description ? description.slice(0, 160) + (description.length > 160 ? '…' : '') : 'absente',
      why: 'Le texte affiché sous le titre dans Google. Entre 80 et 320 caractères.',
    },
    {
      key: 'localBusiness',
      label: 'Zones desservies (booking local)',
      ok: !!musicGroup?.areaServed,
      detail: musicGroup?.areaServed
        ? musicGroup.areaServed.map((a: any) => a.name).join(', ')
        : 'non déclarées',
      why: 'Indique à Google les villes où tu es disponible pour jouer.',
    },
    {
      key: 'offer',
      label: 'Service DJ déclaré',
      ok: !!musicGroup?.makesOffer,
      detail: musicGroup?.makesOffer ? musicGroup.makesOffer.itemOffered.name : 'non déclaré',
      why: 'Permet à Google de comprendre que tu proposes des prestations.',
    },
    {
      key: 'socials',
      label: 'Réseaux sociaux liés',
      ok: (musicGroup?.sameAs || []).length >= 10,
      detail: `${(musicGroup?.sameAs || []).length} profils`,
      why: 'Relie le site à tes profils : Google recoupe et te reconnaît.',
    },
    {
      key: 'sitemap',
      label: 'Plan du site',
      ok: sitemapUrls.length > 0,
      detail: `${sitemapUrls.length} page(s) : ${sitemapUrls
        .map((u) => u.replace('https://mauditemachine.com', '') || '/')
        .join(', ')}`,
      why: 'La liste des pages à indexer, à soumettre dans Search Console.',
    },
    {
      key: 'robots',
      label: 'Fichier robots',
      ok: robots.includes('Sitemap:'),
      detail: robots.includes('Sitemap:') ? 'présent, plan du site déclaré' : 'plan du site non déclaré',
      why: 'Autorise les moteurs et leur indique le plan du site.',
    },
    {
      key: 'analytics',
      label: "Mesure d'audience",
      ok: !!ga4,
      detail: ga4
        ? `Google Analytics actif (${ga4})${fbPixel ? ' + pixel Facebook' : ''}`
        : 'absente',
      why: 'Sans mesure, impossible de savoir qui visite le site.',
    },
  ];

  return {
    success: true,
    readOnly: true,
    title,
    description,
    keywords: keywords ? keywords.split(',').map((k) => k.trim()) : [],
    checks,
    score: checks.filter((c) => c.ok).length,
    total: checks.length,
    visits,
    sitemapUrls,
  };
}
