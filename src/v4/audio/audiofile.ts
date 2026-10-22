/**
 * Lire un fichier audio sans risque (2026-10-21, audit des samples du
 * MM-RYTM, Mika : "controle les selections de samples dans RYTM ! je ne veux
 * plus que ca plante"). Calcul pur, sans DOM (testable sous Node), comme
 * audio/sampledsp.ts :
 * - probeAudio : le format et la duree lus dans l'en-tete, AVANT tout
 *   decodage. Un mp3 de 9 Mo et 2 h 30 se decodait en entier (59 s, 3,4 Go
 *   de memoire, l'onglet d'un telephone tue) avant d'etre refuse a 12 s. WAV :
 *   ses trames (canaux, bits, frequence ; le debit annonce seulement pour un
 *   WAV compresse, 2026-10-22) ; AIFF : ses trames ; FLAC : STREAMINFO ; MP3 :
 *   la trame Xing, Info ou VBRI, sinon le debit de la premiere trame (une
 *   estimation, exact false) ; M4A : mvhd ; OGG : la position de la derniere
 *   page. seconds null : l'en-tete ne le dit pas.
 * - decodeAiff : l'AIFF et l'AIFC non compresses (NONE, twos, sowt, fl32,
 *   fl64 ; 8 a 32 bits) lus ici, a leur frequence : Chrome et Firefox ne les
 *   decodent pas (l'ecran disait NOT AUDIO alors que le champ de fichiers les
 *   proposait). null : un AIFC compresse, laisse au navigateur (Safari).
 * - cleanPcm : les valeurs non finies (NaN, Inf d'un WAV flottant abime) a
 *   0, le reste borne a +/-4 (+12 dB) ; rend la crete (un fichier muet se
 *   refuse, audio/usersamples.ts).
 */

import type { SamplePcm } from './sampledsp';

export type AudioFormat = 'wav' | 'aiff' | 'flac' | 'mp3' | 'm4a' | 'ogg' | 'unknown';

export interface AudioProbe {
  format: AudioFormat;
  /** la duree lue dans l'en-tete ; null : inconnue */
  seconds: number | null;
  /** false : une estimation (un mp3 sans trame Xing : le debit de sa premiere trame) */
  exact: boolean;
}

/** Au-dela, une valeur d'echantillon n'a plus de sens (+12 dB au-dessus de la pleine echelle) : bornee. */
export const PCM_LIMIT = 4;

const ascii = (v: DataView, at: number, n = 4): string => {
  let s = '';
  for (let i = 0; i < n && at + i < v.byteLength; i += 1) s += String.fromCharCode(v.getUint8(at + i));
  return s;
};

/** La taille d'une balise ID3v2 au debut d'un mp3 ou d'un FLAC (0 sans elle). */
function id3Size(v: DataView): number {
  if (v.byteLength < 10 || ascii(v, 0, 3) !== 'ID3') return 0;
  const syncsafe = ((v.getUint8(6) & 0x7f) << 21) | ((v.getUint8(7) & 0x7f) << 14) | ((v.getUint8(8) & 0x7f) << 7) | (v.getUint8(9) & 0x7f);
  const footer = (v.getUint8(5) & 0x10) !== 0;
  return 10 + syncsafe + (footer ? 10 : 0);
}

/** Un flottant etendu de 80 bits (la frequence d'un AIFF). */
function extended80(v: DataView, at: number): number {
  const se = v.getUint16(at);
  const sign = se & 0x8000 ? -1 : 1;
  const exp = se & 0x7fff;
  const hi = v.getUint32(at + 2);
  const lo = v.getUint32(at + 6);
  if (exp === 0 && hi === 0 && lo === 0) return 0;
  if (exp === 0x7fff) return NaN;
  return sign * (hi * 2 ** 32 + lo) * 2 ** (exp - 16383 - 63);
}

/** Le bloc fmt d'un WAV : ce qui donne sa duree. */
interface WavFmt {
  /** 1 PCM, 3 flottant, 0xFFFE extensible ; un autre : compresse (ADPCM, GSM, mp3 dans un WAV...) */
  tag: number;
  channels: number;
  rate: number;
  byteRate: number;
  align: number;
  bits: number;
}
const WAV_PLAIN: ReadonlySet<number> = new Set([1, 3, 0xfffe]);

/**
 * La duree d'un WAV (2026-10-22, revue RA1-6) : en trames, plus au debit annonce. byteRate n'est qu'une indication
 * que le decodeur ignore : un en-tete faux (byteRate 1e9, ou 0) passait le controle et 600 s se decodaient en entier
 * (110 Mo de PCM) avant le refus. Non compresse : la taille d'une trame (canaux x octets par echantillon, ce que compte
 * le decodeur) et la frequence ; blockAlign qui dit autre chose : le plus petit des deux (la duree la plus longue), une
 * estimation. Compresse : le debit, une estimation (la marge de usersamples.ts s'applique) ; rien : null.
 */
function wavSeconds(f: WavFmt | null, n: number): { seconds: number | null; exact: boolean } {
  if (!f) return { seconds: null, exact: false };
  if (WAV_PLAIN.has(f.tag)) {
    const frame = f.channels > 0 && f.bits > 0 ? f.channels * Math.ceil(f.bits / 8) : 0;
    const align = frame > 0 && f.align > 0 ? Math.min(frame, f.align) : frame || f.align;
    if (f.rate > 0 && align > 0) return { seconds: n / (f.rate * align), exact: frame > 0 && frame === f.align };
    return { seconds: null, exact: false };
  }
  return f.byteRate > 0 ? { seconds: n / f.byteRate, exact: false } : { seconds: null, exact: false };
}

function probeWav(v: DataView): AudioProbe {
  let at = 12;
  let fmt: WavFmt | null = null;
  while (at + 8 <= v.byteLength) {
    const id = ascii(v, at);
    const size = v.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ' && size >= 14 && body + 14 <= v.byteLength) {
      fmt = {
        tag: v.getUint16(body, true),
        channels: v.getUint16(body + 2, true),
        rate: v.getUint32(body + 4, true),
        byteRate: v.getUint32(body + 8, true),
        align: v.getUint16(body + 12, true),
        bits: size >= 16 && body + 16 <= v.byteLength ? v.getUint16(body + 14, true) : 0,
      };
    }
    if (id === 'data') {
      const left = v.byteLength - body;
      // Une taille absente (0, 0xFFFFFFFF : un enregistrement en continu) ou plus grande que le fichier : ce qui reste
      const n = size === 0 || size === 0xffffffff || size > left ? left : size;
      return { format: 'wav', ...wavSeconds(fmt, n) };
    }
    at = body + size + (size & 1);
  }
  return { format: 'wav', seconds: null, exact: false };
}

/** Le bloc COMM d'un AIFF ou d'un AIFC : ce qu'il faut pour le lire. */
interface AiffComm {
  channels: number;
  frames: number;
  bits: number;
  rate: number;
  /** NONE, twos, sowt, fl32, fl64... (AIFF : NONE) */
  comp: string;
  /** ou commencent les echantillons (apres l'offset de SSND), -1 sans SSND */
  data: number;
  /** combien d'octets de donnees le fichier a vraiment */
  dataBytes: number;
}

function aiffComm(v: DataView): AiffComm | null {
  if (v.byteLength < 12 || ascii(v, 0) !== 'FORM') return null;
  const kind = ascii(v, 8);
  if (kind !== 'AIFF' && kind !== 'AIFC') return null;
  let at = 12;
  let comm: AiffComm | null = null;
  let data = -1;
  let dataBytes = 0;
  while (at + 8 <= v.byteLength) {
    const id = ascii(v, at);
    const size = v.getUint32(at + 4);
    const body = at + 8;
    if (id === 'COMM' && body + 18 <= v.byteLength) {
      comm = {
        channels: v.getInt16(body),
        frames: v.getUint32(body + 2),
        bits: v.getInt16(body + 6),
        rate: extended80(v, body + 8),
        comp: kind === 'AIFC' && body + 22 <= v.byteLength ? ascii(v, body + 18) : 'NONE',
        data: -1,
        dataBytes: 0,
      };
    } else if (id === 'SSND' && body + 8 <= v.byteLength) {
      data = body + 8 + v.getUint32(body);
      dataBytes = Math.max(0, Math.min(size - 8 - v.getUint32(body), v.byteLength - data));
    }
    at = body + size + (size & 1);
  }
  if (!comm) return null;
  comm.data = data;
  comm.dataBytes = dataBytes;
  return comm;
}

function probeFlac(v: DataView, at: number): AudioProbe {
  // fLaC, puis le premier bloc de metadonnees : STREAMINFO (type 0), 34 octets
  const b = at + 8;
  if (b + 18 > v.byteLength || (v.getUint8(at + 4) & 0x7f) !== 0) return { format: 'flac', seconds: null, exact: false };
  const rate = (v.getUint8(b + 10) << 12) | (v.getUint8(b + 11) << 4) | (v.getUint8(b + 12) >> 4);
  const total = (v.getUint8(b + 13) & 0x0f) * 2 ** 32 + v.getUint32(b + 14);
  return rate > 0 && total > 0 ? { format: 'flac', seconds: total / rate, exact: true } : { format: 'flac', seconds: null, exact: false };
}

/* Les tables d'un en-tete de trame MPEG audio (debits en kbit/s ; [version MPEG 1, 2 ou 2.5][couche]) */
const MP3_RATES: Readonly<Record<string, readonly number[]>> = {
  '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  '2-3': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_SR = [44100, 48000, 32000];

/** La premiere trame MPEG audio a partir de at (cherchee sur 64 Ko au plus) : son debut, ses reglages ; null sans trame. */
function mp3Frame(v: DataView, from: number): { at: number; ver: 1 | 2 | 25; layer: 1 | 2 | 3; kbps: number; sr: number; mono: boolean } | null {
  const end = Math.min(v.byteLength - 4, from + 65536);
  for (let at = from; at < end; at += 1) {
    if (v.getUint8(at) !== 0xff || (v.getUint8(at + 1) & 0xe0) !== 0xe0) continue;
    const h = v.getUint32(at);
    const verBits = (h >>> 19) & 3;
    const layerBits = (h >>> 17) & 3;
    const rateIdx = (h >>> 12) & 15;
    const srIdx = (h >>> 10) & 3;
    if (verBits === 1 || layerBits === 0 || rateIdx === 0 || rateIdx === 15 || srIdx === 3) continue;
    const ver = verBits === 3 ? 1 : verBits === 2 ? 2 : 25;
    const layer = (4 - layerBits) as 1 | 2 | 3;
    const kbps = MP3_RATES[`${ver === 1 ? 1 : 2}-${layer}`][rateIdx];
    const sr = MP3_SR[srIdx] / (ver === 1 ? 1 : ver === 2 ? 2 : 4);
    // La trame suivante doit suivre (un octet 0xFF au hasard d'un fichier qui n'est pas un mp3 n'en est pas une)
    const len = mp3Len(h, layer, ver);
    const nx = at + len;
    if (len < 24 || (nx + 2 <= v.byteLength && (v.getUint8(nx) !== 0xff || (v.getUint8(nx + 1) & 0xfe) !== (v.getUint8(at + 1) & 0xfe)))) continue;
    return { at, ver, layer, kbps, sr, mono: ((h >>> 6) & 3) === 3 };
  }
  return null;
}

function probeMp3(v: DataView): AudioProbe {
  const start = id3Size(v);
  const fr = mp3Frame(v, start);
  if (!fr) return { format: 'unknown', seconds: null, exact: false };
  const spf = fr.layer === 1 ? 384 : fr.layer === 2 ? 1152 : fr.ver === 1 ? 1152 : 576;
  // Xing ou Info (le nombre de trames d'un VBR, ou d'un CBR encode par LAME) : apres les infos laterales
  const side = fr.layer !== 3 ? 0 : fr.ver === 1 ? (fr.mono ? 17 : 32) : fr.mono ? 9 : 17;
  const x = fr.at + 4 + side;
  const tag = ascii(v, x);
  if ((tag === 'Xing' || tag === 'Info') && x + 12 <= v.byteLength && (v.getUint32(x + 4) & 1) !== 0) {
    const frames = v.getUint32(x + 8);
    if (frames > 0) return { format: 'mp3', seconds: (frames * spf) / fr.sr, exact: true };
  }
  // VBRI (l'encodeur de Fraunhofer) : 32 octets apres l'en-tete
  const vb = fr.at + 36;
  if (ascii(v, vb) === 'VBRI' && vb + 18 <= v.byteLength) {
    const frames = v.getUint32(vb + 14);
    if (frames > 0) return { format: 'mp3', seconds: (frames * spf) / fr.sr, exact: true };
  }
  // Sinon les trames comptees une a une (un VBR sans en-tete : le debit de la premiere trame se trompait de 5 fois) ;
  // quelques dizaines de milliers d'en-tetes de 4 octets pour 10 Mo, presque rien
  let at = fr.at;
  let frames = 0;
  let end = at;
  while (at + 4 <= v.byteLength) {
    const len = mp3Len(v.getUint32(at), fr.layer, fr.ver);
    if (len <= 0) break;
    frames += 1;
    at += len;
    end = at;
    if (at + 2 <= v.byteLength && (v.getUint8(at) !== 0xff || (v.getUint8(at + 1) & 0xe0) !== 0xe0)) break;
  }
  const seconds = (frames * spf) / fr.sr;
  // Le compte s'arrete avant la fin (des donnees qui ne sont pas des trames) : le reste estime au debit moyen
  const covered = (end - fr.at) / Math.max(1, v.byteLength - fr.at);
  if (covered >= 0.9) return { format: 'mp3', seconds, exact: true };
  return { format: 'mp3', seconds: covered > 0 ? seconds / covered : ((v.byteLength - fr.at) * 8) / (fr.kbps * 1000), exact: false };
}

/** La longueur d'une trame MPEG audio d'en-tete h (0 : pas une trame de ce flux). */
function mp3Len(h: number, layer: 1 | 2 | 3, ver: 1 | 2 | 25): number {
  if (h >>> 21 !== 0x7ff || 4 - ((h >>> 17) & 3) !== layer) return 0;
  const rateIdx = (h >>> 12) & 15;
  const srIdx = (h >>> 10) & 3;
  if (rateIdx === 0 || rateIdx === 15 || srIdx === 3) return 0;
  const kbps = MP3_RATES[`${ver === 1 ? 1 : 2}-${layer}`][rateIdx];
  const sr = MP3_SR[srIdx] / (ver === 1 ? 1 : ver === 2 ? 2 : 4);
  const pad = (h >>> 9) & 1;
  return layer === 1 ? (Math.floor((12000 * kbps) / sr) + pad) * 4 : Math.floor(((layer === 3 && ver !== 1 ? 72000 : 144000) * kbps) / sr) + pad;
}

/** Les boites MP4 de [from, to) : la premiere de ce type, son contenu ; null sans elle. */
function mp4Box(v: DataView, from: number, to: number, type: string): { body: number; end: number } | null {
  let at = from;
  while (at + 8 <= to) {
    let size = v.getUint32(at);
    const t = ascii(v, at + 4);
    let head = 8;
    if (size === 1) {
      if (at + 16 > to) return null;
      size = v.getUint32(at + 8) * 2 ** 32 + v.getUint32(at + 12);
      head = 16;
    } else if (size === 0) size = to - at;
    if (size < head) return null;
    if (t === type) return { body: at + head, end: Math.min(to, at + size) };
    at += size;
  }
  return null;
}

function probeM4a(v: DataView): AudioProbe {
  const moov = mp4Box(v, 0, v.byteLength, 'moov');
  const mvhd = moov ? mp4Box(v, moov.body, moov.end, 'mvhd') : null;
  if (!mvhd || mvhd.body + 32 > v.byteLength) return { format: 'm4a', seconds: null, exact: false };
  const b = mvhd.body;
  const v1 = v.getUint8(b) === 1;
  const scale = v1 ? v.getUint32(b + 20) : v.getUint32(b + 12);
  const dur = v1 ? v.getUint32(b + 24) * 2 ** 32 + v.getUint32(b + 28) : v.getUint32(b + 16);
  return scale > 0 && dur > 0 && dur !== 0xffffffff ? { format: 'm4a', seconds: dur / scale, exact: true } : { format: 'm4a', seconds: null, exact: false };
}

function probeOgg(v: DataView): AudioProbe {
  // La frequence : l'en-tete Vorbis (\x01vorbis) ou Opus (OpusHead, toujours compte a 48 kHz) de la premiere page
  const segs = v.byteLength > 27 ? v.getUint8(26) : 0;
  const p = 27 + segs;
  let rate = 0;
  let skip = 0;
  if (p + 16 <= v.byteLength && ascii(v, p + 1, 6) === 'vorbis') rate = v.getUint32(p + 12, true);
  else if (p + 12 <= v.byteLength && ascii(v, p, 8) === 'OpusHead') {
    rate = 48000;
    skip = v.getUint16(p + 10, true);
  }
  if (rate <= 0) return { format: 'ogg', seconds: null, exact: false };
  // La position (en echantillons) de la derniere page
  for (let at = v.byteLength - 27; at >= 0 && at > v.byteLength - 70000; at -= 1) {
    if (ascii(v, at) !== 'OggS') continue;
    const gran = v.getUint32(at + 10, true) * 2 ** 32 + v.getUint32(at + 6, true);
    return gran > 0 ? { format: 'ogg', seconds: Math.max(0, gran - skip) / rate, exact: true } : { format: 'ogg', seconds: null, exact: false };
  }
  return { format: 'ogg', seconds: null, exact: false };
}

/** Le format et la duree d'un fichier audio, lus dans son en-tete (sans le decoder). */
export function probeAudio(data: ArrayBuffer): AudioProbe {
  try {
    const v = new DataView(data);
    if (v.byteLength < 12) return { format: 'unknown', seconds: null, exact: false };
    const head = ascii(v, 0);
    if (head === 'RIFF' && ascii(v, 8) === 'WAVE') return probeWav(v);
    if (head === 'FORM') {
      const c = aiffComm(v);
      if (c) return { format: 'aiff', seconds: c.rate > 0 ? c.frames / c.rate : null, exact: c.rate > 0 };
    }
    if (ascii(v, 4) === 'ftyp') return probeM4a(v);
    if (head === 'OggS') return probeOgg(v);
    const id3 = id3Size(v);
    if (id3 + 4 <= v.byteLength && ascii(v, id3) === 'fLaC') return probeFlac(v, id3);
    return probeMp3(v);
  } catch {
    // Un en-tete tronque ou faux : rien de su, le decodage dira
    return { format: 'unknown', seconds: null, exact: false };
  }
}

/** Un AIFF ou un AIFC ? (ses quatre premiers octets et son type). */
export function isAiff(data: ArrayBuffer): boolean {
  if (data.byteLength < 12) return false;
  const v = new DataView(data);
  return ascii(v, 0) === 'FORM' && (ascii(v, 8) === 'AIFF' || ascii(v, 8) === 'AIFC');
}

/**
 * Un AIFF ou un AIFC non compresse decode ici, a sa frequence, ses deux
 * premiers canaux (un mono : R null). null : compresse autrement (ulaw,
 * ima4...) ou illisible, le navigateur essaiera.
 */
export function decodeAiff(data: ArrayBuffer): SamplePcm | null {
  const v = new DataView(data);
  const c = aiffComm(v);
  if (!c || c.data < 0 || c.channels < 1 || !(c.rate >= 1000 && c.rate <= 768000)) return null;
  const comp = c.comp.toLowerCase();
  const float = comp === 'fl32' || comp === 'fl64';
  const little = comp === 'sowt';
  if (!float && !little && comp !== 'none' && comp !== 'twos') return null;
  const bytes = comp === 'fl32' ? 4 : comp === 'fl64' ? 8 : Math.ceil(c.bits / 8);
  if (bytes < 1 || bytes > 8 || (!float && bytes > 4)) return null;
  const frameBytes = bytes * c.channels;
  const n = Math.min(c.frames, Math.floor(c.dataBytes / frameBytes));
  if (n <= 0) return null;
  const chans = Math.min(2, c.channels);
  const out = Array.from({ length: chans }, () => new Float32Array(n));
  const scale = float ? 1 : 1 / 2 ** (bytes * 8 - 1);
  for (let i = 0; i < n; i += 1) {
    const base = c.data + i * frameBytes;
    for (let ch = 0; ch < chans; ch += 1) {
      const at = base + ch * bytes;
      let x: number;
      if (comp === 'fl32') x = v.getFloat32(at);
      else if (comp === 'fl64') x = v.getFloat64(at);
      else if (bytes === 1) x = v.getInt8(at);
      else if (bytes === 2) x = v.getInt16(at, little);
      else if (bytes === 3) {
        const b0 = v.getUint8(at);
        const b1 = v.getUint8(at + 1);
        const b2 = v.getUint8(at + 2);
        const u = little ? (b2 << 16) | (b1 << 8) | b0 : (b0 << 16) | (b1 << 8) | b2;
        x = u & 0x800000 ? u - 0x1000000 : u;
      } else x = v.getInt32(at, little);
      out[ch][i] = x * scale;
    }
  }
  return { L: out[0], R: chans > 1 ? out[1] : null, sr: c.rate };
}

/** Les valeurs non finies a 0, le reste borne a +/-PCM_LIMIT, en place ; rend la crete. */
export function cleanPcm(p: SamplePcm): number {
  let peak = 0;
  for (const x of p.R && p.R !== p.L ? [p.L, p.R] : [p.L]) {
    for (let i = 0; i < x.length; i += 1) {
      const s = x[i];
      // Le cas courant d'abord (une seule comparaison double) ; NaN et +/-Inf a 0, le reste borne
      if (!(s >= -PCM_LIMIT && s <= PCM_LIMIT)) x[i] = !Number.isFinite(s) ? 0 : s > 0 ? PCM_LIMIT : -PCM_LIMIT;
      const a = Math.abs(x[i]);
      if (a > peak) peak = a;
    }
  }
  return peak;
}
