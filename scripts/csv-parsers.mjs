/**
 * Parseurs des exports CSV manuels : Ditto, Bandcamp, TikTok Studio.
 *
 * Utilises par server.js (upload dans l'admin local). Les formats de
 * colonnes varient selon les versions d'export : chaque parseur cherche
 * ses colonnes par NOM (insensible casse/espaces) plutot que par position,
 * et renvoie ce qu'il a pu comprendre + la liste des colonnes ignorees.
 *
 * Regle de separation des donnees :
 * - streams / plays / followers -> stats-public.json (bloc manual)
 * - REVENUS Ditto -> data/stats-private.json, local uniquement
 */


/** Parseur CSV minimal : gere guillemets, virgules internes, CRLF. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const src = String(text || '').replace(/^﻿/, ''); // BOM

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);

  const headers = (rows.shift() || []).map((h) => h.trim());
  return { headers, rows };
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Index d'une colonne par liste de noms candidats. -1 si absente. */
function col(headers, candidates) {
  const normed = headers.map(norm);
  for (const cand of candidates) {
    const idx = normed.indexOf(norm(cand));
    if (idx >= 0) return idx;
  }
  return -1;
}

const toNumber = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/* ---------------- Ditto ---------------- */


/**
 * Rapport Ditto : une ligne par (plateforme, pays, periode...) avec
 * quantite de streams et revenu. Colonnes typiques : "Store"/"Platform",
 * "Country"/"Territory", "Quantity"/"Streams", "Royalty"/"Net Revenue".
 */
export function parseDitto(text) {
  const { headers, rows } = parseCsv(text);
  const warnings = [];

  const iPlatform = col(headers, ['store', 'platform', 'dsp', 'retailer', 'shop']);
  const iCountry = col(headers, ['country', 'territory', 'countryofsale', 'region']);
  const iStreams = col(headers, ['quantity', 'streams', 'units', 'plays', 'totalstreams']);
  const iRevenue = col(headers, ['royalty', 'netrevenue', 'revenue', 'earnings', 'netroyalty', 'amountdue']);
  const iCurrency = col(headers, ['currency', 'royaltycurrency']);

  if (iPlatform < 0) warnings.push('colonne plateforme introuvable');
  if (iStreams < 0 && iRevenue < 0) warnings.push('ni streams ni revenus reconnus');

  const streamsByPlatform = {};
  const streamsByCountry = {};
  const revenueByPlatform = {};
  const revenueByCountry = {};
  let totalRevenue = 0;
  let currency = '';

  for (const row of rows) {
    const platform = iPlatform >= 0 ? row[iPlatform]?.trim() || 'Autre' : 'Autre';
    const country = iCountry >= 0 ? row[iCountry]?.trim() || '??' : '??';
    if (iStreams >= 0) {
      const q = toNumber(row[iStreams]);
      streamsByPlatform[platform] = (streamsByPlatform[platform] || 0) + q;
      streamsByCountry[country] = (streamsByCountry[country] || 0) + q;
    }
    if (iRevenue >= 0) {
      const r = toNumber(row[iRevenue]);
      revenueByPlatform[platform] = (revenueByPlatform[platform] || 0) + r;
      revenueByCountry[country] = (revenueByCountry[country] || 0) + r;
      totalRevenue += r;
    }
    if (!currency && iCurrency >= 0 && row[iCurrency]) currency = row[iCurrency].trim();
  }

  return {
    streamsByPlatform,
    streamsByCountry,
    revenueByPlatform,
    revenueByCountry,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    currency: currency || 'USD',
    rowCount: rows.length,
    warnings,
  };
}

/* ---------------- Bandcamp ---------------- */


/** Export Bandcamp (sales report ou stats) : on agrege plays et ventes. */
export function parseBandcamp(text) {
  const { headers, rows } = parseCsv(text);
  const warnings = [];

  const iPlays = col(headers, ['plays', 'streams', 'playcount']);
  const iQty = col(headers, ['quantity', 'qty', 'items sold', 'itemssold']);
  const iType = col(headers, ['item type', 'itemtype', 'type']);

  if (iPlays < 0 && iQty < 0) warnings.push('ni plays ni quantites reconnus');

  let plays = 0;
  let sales = 0;
  for (const row of rows) {
    if (iPlays >= 0) plays += toNumber(row[iPlays]);
    if (iQty >= 0) {
      // Les lignes "payout"/"pending" ne sont pas des ventes d'items
      const type = iType >= 0 ? norm(row[iType] || '') : '';
      if (!type || ['album', 'track', 'merch', 'package'].some((t) => type.includes(t))) {
        sales += toNumber(row[iQty]);
      }
    }
  }
  return { plays, sales, rowCount: rows.length, warnings };
}

/* ---------------- TikTok Studio ---------------- */


/**
 * Export TikTok Studio "Overview" : soit une serie datee (Date, Video Views,
 * Profile Views, Likes, ..., Followers), soit un resume cle/valeur. On prend
 * les TOTAUX de la periode pour les flux, la DERNIERE valeur pour followers.
 */
export function parseTikTok(text) {
  const { headers, rows } = parseCsv(text);
  const warnings = [];

  const iViews = col(headers, ['video views', 'videoviews', 'views']);
  const iProfile = col(headers, ['profile views', 'profileviews']);
  const iLikes = col(headers, ['likes', 'totallikes']);
  const iFollowers = col(headers, ['followers', 'totalfollowers', 'net followers', 'netfollowers']);

  if ([iViews, iProfile, iLikes, iFollowers].every((i) => i < 0)) {
    warnings.push('aucune colonne TikTok reconnue');
  }

  let videoViews = 0;
  let profileViews = 0;
  let likes = 0;
  let followers;

  for (const row of rows) {
    if (iViews >= 0) videoViews += toNumber(row[iViews]);
    if (iProfile >= 0) profileViews += toNumber(row[iProfile]);
    if (iLikes >= 0) likes += toNumber(row[iLikes]);
    if (iFollowers >= 0 && row[iFollowers]?.trim()) followers = toNumber(row[iFollowers]);
  }

  return {
    followers,
    videoViews: iViews >= 0 ? videoViews : undefined,
    profileViews: iProfile >= 0 ? profileViews : undefined,
    likes: iLikes >= 0 ? likes : undefined,
    rowCount: rows.length,
    warnings,
  };
}
