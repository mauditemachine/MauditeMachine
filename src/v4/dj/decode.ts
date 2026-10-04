/**
 * Le decodage des morceaux (2026-10-04, Mika : "unable to decode audio
 * data, resous le probleme"). Le navigateur decode d'abord ; s'il refuse,
 * un decodeur a nous lit les formats sans compression que Chrome, Brave et
 * Edge ne lisent pas, et que les DJ utilisent beaucoup :
 * - AIFF et AIFF-C (PCM 8 a 32 bits gros-boutiste, 'sowt' petit-boutiste,
 *   flottants 32 et 64 bits) ;
 * - WAV que le navigateur rejette (RF64, WAVE_FORMAT_EXTENSIBLE, tailles
 *   fausses) : PCM 8 a 32 bits, flottants.
 * Le reste (ALAC, AAC protege d'iTunes) : une erreur qui dit le format, et
 * quoi faire. Le morceau reste a la frequence du fichier : la lecture
 * reechantillonne.
 */

/** Les octets lus comme du texte (identifiants de blocs). */
const tag = (v: DataView, at: number): string => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));

/** Le flottant 80 bits (etendu IEEE 754) de la frequence d'un AIFF. */
function extended(v: DataView, at: number): number {
  const se = v.getUint16(at);
  const exp = se & 0x7fff;
  const hi = v.getUint32(at + 2);
  const lo = v.getUint32(at + 6);
  if (exp === 0 && hi === 0 && lo === 0) return 0;
  const x = (hi * 4294967296 + lo) * Math.pow(2, exp - 16383 - 63);
  return se & 0x8000 ? -x : x;
}

type Kind = 'int' | 'uint' | 'float';

interface Pcm {
  channels: number;
  frames: number;
  rate: number;
  /** octets par echantillon */
  bytes: number;
  kind: Kind;
  little: boolean;
  /** debut des echantillons dans le fichier */
  data: number;
}

/** Un echantillon -> -1..1 (un entier est cadre a gauche : sa taille en octets fait l'echelle). */
function reader(v: DataView, p: Pcm): (at: number) => number {
  const { bytes, kind, little } = p;
  if (kind === 'float') return bytes === 8 ? (at) => v.getFloat64(at, little) : (at) => v.getFloat32(at, little);
  if (bytes === 1) return kind === 'uint' ? (at) => (v.getUint8(at) - 128) / 128 : (at) => v.getInt8(at) / 128;
  if (bytes === 2) return (at) => v.getInt16(at, little) / 32768;
  if (bytes === 3)
    return little
      ? (at) => (v.getUint8(at) | (v.getUint8(at + 1) << 8) | (v.getInt8(at + 2) << 16)) / 8388608
      : (at) => (v.getUint8(at + 2) | (v.getUint8(at + 1) << 8) | (v.getInt8(at) << 16)) / 8388608;
  return (at) => v.getInt32(at, little) / 2147483648;
}

/** Les canaux d'un PCM entrelace ; mono : la moyenne des canaux (les analyses n'en veulent qu'un). */
function toBuffer(v: DataView, p: Pcm, mono: boolean): AudioBuffer {
  const step = p.bytes * p.channels;
  const frames = Math.max(0, Math.min(p.frames, Math.floor((v.byteLength - p.data) / step)));
  if (frames === 0 || p.channels < 1 || !(p.rate >= 3000 && p.rate <= 768000)) throw new Error('empty or invalid audio');
  const read = reader(v, p);
  const outCh = mono ? 1 : p.channels;
  const buf = new AudioBuffer({ length: frames, numberOfChannels: outCh, sampleRate: Math.round(p.rate) });
  if (mono) {
    const out = buf.getChannelData(0);
    const k = 1 / p.channels;
    for (let f = 0, at = p.data; f < frames; f += 1, at += step) {
      let s = 0;
      for (let c = 0; c < p.channels; c += 1) s += read(at + c * p.bytes);
      out[f] = s * k;
    }
    return buf;
  }
  for (let c = 0; c < p.channels; c += 1) {
    const out = buf.getChannelData(c);
    for (let f = 0, at = p.data + c * p.bytes; f < frames; f += 1, at += step) out[f] = read(at);
  }
  return buf;
}

/** AIFF / AIFF-C : blocs COMM (format) et SSND (echantillons), gros-boutistes. */
function parseAiff(v: DataView): Pcm | null {
  if (v.byteLength < 12 || tag(v, 0) !== 'FORM') return null;
  const form = tag(v, 8);
  if (form !== 'AIFF' && form !== 'AIFC') return null;
  let comm: Omit<Pcm, 'data'> | null = null;
  let data = -1;
  for (let at = 12; at + 8 <= v.byteLength;) {
    const id = tag(v, at);
    const size = v.getUint32(at + 4);
    const body = at + 8;
    if (id === 'COMM' && body + 18 <= v.byteLength) {
      const channels = v.getInt16(body);
      const frames = v.getUint32(body + 2);
      const bits = v.getInt16(body + 6);
      const rate = extended(v, body + 8);
      const codec = form === 'AIFC' && body + 22 <= v.byteLength ? tag(v, body + 18) : 'NONE';
      const bytes = Math.ceil(bits / 8);
      if (codec === 'NONE' || codec === 'twos') comm = { channels, frames, rate, bytes, kind: 'int', little: false };
      else if (codec === 'sowt') comm = { channels, frames, rate, bytes, kind: 'int', little: true };
      else if (codec === 'raw ') comm = { channels, frames, rate, bytes: 1, kind: 'uint', little: false };
      else if (codec === 'fl32' || codec === 'FL32') comm = { channels, frames, rate, bytes: 4, kind: 'float', little: false };
      else if (codec === 'fl64' || codec === 'FL64') comm = { channels, frames, rate, bytes: 8, kind: 'float', little: false };
      else throw new Error(`AIFF-C ${codec.trim()} compression is not supported`);
    } else if (id === 'SSND' && body + 8 <= v.byteLength) {
      data = body + 8 + v.getUint32(body);
    }
    if (comm && data >= 0) break;
    at = body + size + (size & 1);
  }
  return comm && data >= 0 ? { ...comm, data } : null;
}

/** WAV / RF64 : blocs fmt et data, petits-boutistes (une taille fausse ou 0xFFFFFFFF : jusqu'au bout du fichier). */
function parseWav(v: DataView): Pcm | null {
  if (v.byteLength < 12) return null;
  const riff = tag(v, 0);
  if ((riff !== 'RIFF' && riff !== 'RF64' && riff !== 'BW64') || tag(v, 8) !== 'WAVE') return null;
  let fmt: Omit<Pcm, 'data' | 'frames'> | null = null;
  let data = -1;
  let dataSize = 0;
  for (let at = 12; at + 8 <= v.byteLength;) {
    const id = tag(v, at);
    const size = v.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ' && body + 16 <= v.byteLength) {
      let format = v.getUint16(body, true);
      const channels = v.getUint16(body + 2, true);
      const rate = v.getUint32(body + 4, true);
      const bits = v.getUint16(body + 14, true);
      // WAVE_FORMAT_EXTENSIBLE : le vrai format est au debut du GUID
      if (format === 0xfffe && body + 26 <= v.byteLength) format = v.getUint16(body + 24, true);
      const bytes = Math.ceil(bits / 8);
      if (format === 1) fmt = { channels, rate, bytes, kind: bytes === 1 ? 'uint' : 'int', little: true };
      else if (format === 3) fmt = { channels, rate, bytes, kind: 'float', little: true };
      else return null;
    } else if (id === 'data') {
      data = body;
      dataSize = size === 0xffffffff || body + size > v.byteLength ? v.byteLength - body : size;
      break;
    }
    if (size === 0xffffffff) break;
    at = body + size + (size & 1);
  }
  if (!fmt || data < 0) return null;
  return { ...fmt, data, frames: Math.floor(dataSize / (fmt.bytes * fmt.channels)) };
}

/** Le format d'un fichier, d'apres ses premiers (et derniers) octets : pour dire ce qui ne se lit pas. */
function sniff(v: DataView): string {
  if (v.byteLength < 12) return 'empty file';
  const head = tag(v, 0);
  if (head === 'fLaC') return 'FLAC';
  if (head === 'OggS') return 'Ogg';
  if (head === 'FORM') return 'AIFF';
  if (head === 'RIFF' || head === 'RF64') return 'WAV';
  if (tag(v, 4) === 'ftyp') {
    // MP4 : Apple Lossless ou AAC protege (iTunes) se reconnaissent a leurs atomes
    const has = (word: string): boolean => {
      const a = word.charCodeAt(0);
      const scan = (from: number, to: number): boolean => {
        for (let i = from; i < to - 4; i += 1) if (v.getUint8(i) === a && tag(v, i) === word) return true;
        return false;
      };
      const span = Math.min(v.byteLength, 2 << 20);
      return scan(0, span) || scan(Math.max(0, v.byteLength - span), v.byteLength);
    };
    if (has('alac')) return 'ALAC';
    if (has('drms') || tag(v, 8) === 'M4P ') return 'protected AAC';
    return 'M4A';
  }
  if (head.startsWith('ID3') || (v.getUint8(0) === 0xff && (v.getUint8(1) & 0xe0) === 0xe0)) return 'MP3';
  return 'unknown format';
}

/**
 * Decode un morceau : le navigateur d'abord, puis l'AIFF ou le WAV a la
 * main. mono : un seul canal, la moyenne (analyses de BPM). Une erreur
 * lisible sinon (son format, et quoi faire).
 */
export async function decodeAudio(ctx: BaseAudioContext, bytes: ArrayBuffer, mono = false): Promise<AudioBuffer> {
  try {
    // decodeAudioData detache le tampon qu'on lui donne : une copie, l'original sert au repli
    return await ctx.decodeAudioData(bytes.slice(0));
  } catch (err) {
    const v = new DataView(bytes);
    const pcm = parseAiff(v) ?? parseWav(v);
    if (pcm) return toBuffer(v, pcm, mono);
    const what = sniff(v);
    if (what === 'ALAC') throw new Error('Apple Lossless (ALAC) does not play in this browser: Safari does, or convert to AIFF');
    if (what === 'protected AAC') throw new Error('protected iTunes file (DRM): it cannot be played here');
    throw err instanceof Error ? new Error(`${err.message} (${what})`) : new Error(`unable to decode (${what})`);
  }
}
