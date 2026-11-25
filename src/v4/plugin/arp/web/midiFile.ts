/**
 * Le clip MIDI du MM-ARP dans le navigateur (2026-11-25, /mm-arp/play/) : le fichier que le VST3 ecrit
 * (PluginProcessor.cpp arpMidi, puis juce::MidiFile::writeTo(out, 1)), octet pour octet, a partir des notes du moteur
 * (mmarp_render_clip : {onTick, offTick, vel, midi} par note, 960 par noire).
 *
 * Comme JUCE : une piste (type 1), le texte "MM-ARP" (meta 3), le tempo 60000000 / max(20, bpm), 4/4, puis chaque note
 * (NOTE ON a onTick, NOTE OFF a offTick, canal 1) inseree apres les evenements de meme tick (MidiMessageSequence::addEvent),
 * updateMatchedPairs (une note rejouee avant sa fin recoit son NOTE OFF juste avant), le statut courant (running status)
 * et la fin de piste.
 */

const TPQ = 960;

interface Ev {
  t: number;
  d: number[];
}

const isNoteOn = (d: readonly number[]): boolean => (d[0] & 0xf0) === 0x90 && d[2] > 0;
const isNoteOff = (d: readonly number[]): boolean => (d[0] & 0xf0) === 0x80 || ((d[0] & 0xf0) === 0x90 && d[2] === 0);
// MidiMessage::getChannel : 0 pour les meta et le systeme
const channelOf = (d: readonly number[]): number => ((d[0] & 0xf0) !== 0xf0 ? (d[0] & 0x0f) + 1 : 0);

/** MidiMessageSequence::addEvent : apres le dernier evenement dont le tick est <= t. */
function addEvent(list: Ev[], t: number, d: number[]): void {
  let i = list.length;
  while (i > 0 && list[i - 1].t > t) i -= 1;
  list.splice(i, 0, { t, d });
}

/** MidiMessageSequence::updateMatchedPairs (un NOTE OFF insere quand la meme note repart avant le sien). */
function matchPairs(list: Ev[]): void {
  for (let i = 0; i < list.length; i += 1) {
    const m1 = list[i].d;
    if (!isNoteOn(m1)) continue;
    const note = m1[1];
    const chan = channelOf(m1);
    for (let j = i + 1; j < list.length; j += 1) {
      const m = list[j].d;
      if (m[1] === note && channelOf(m) === chan) {
        if (isNoteOff(m)) break;
        if (isNoteOn(m)) {
          list.splice(j, 0, { t: list[j].t, d: [0x80 | (chan - 1), note, 0] });
          break;
        }
      }
    }
  }
}

function vlq(out: number[], v: number): void {
  let buffer = v & 0x7f;
  let x = v;
  while ((x >>>= 7) !== 0) {
    buffer = buffer * 256 + ((x & 0x7f) | 0x80);
  }
  for (;;) {
    out.push(buffer & 0xff);
    if (buffer & 0x80) buffer = Math.floor(buffer / 256);
    else break;
  }
}

const be32 = (out: number[], v: number): void => {
  out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
};

/** Le fichier .mid du clip (notes : 4 valeurs par note, comme mmarp_render_clip ; bpm : le tempo du programme). */
export function midiFileBytes(notes: ArrayLike<number>, bpm: number): Uint8Array<ArrayBuffer> {
  const list: Ev[] = [];
  const text = Array.from('MM-ARP', (c) => c.charCodeAt(0));
  addEvent(list, 0, [0xff, 0x03, text.length, ...text]);
  const us = Math.trunc(60000000 / Math.max(20, bpm));
  addEvent(list, 0, [0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]);
  addEvent(list, 0, [0xff, 0x58, 0x04, 4, 2, 1, 96]);
  const n = Math.floor(notes.length / 4);
  for (let k = 0; k < n; k += 1) {
    const on = notes[k * 4];
    const off = notes[k * 4 + 1];
    const vel = notes[k * 4 + 2] & 0x7f;
    const midi = notes[k * 4 + 3] & 0x7f;
    addEvent(list, on, [0x90, midi, vel]);
    addEvent(list, off, [0x80, midi, 0]);
  }
  matchPairs(list);
  // MidiFile::writeTrack
  const trk: number[] = [];
  let lastTick = 0;
  let lastStatus = 0;
  list.forEach((ev, i) => {
    const tick = Math.round(ev.t);
    vlq(trk, Math.max(0, tick - lastTick));
    lastTick = tick;
    const s = ev.d[0];
    const data = s === lastStatus && (s & 0xf0) !== 0xf0 && ev.d.length > 1 && i > 0 ? ev.d.slice(1) : ev.d;
    trk.push(...data);
    lastStatus = s;
  });
  trk.push(0x00, 0xff, 0x2f, 0x00);
  // MidiFile::writeTo(out, 1)
  const out: number[] = [];
  out.push(0x4d, 0x54, 0x68, 0x64);
  be32(out, 6);
  out.push(0, 1, 0, 1, (TPQ >> 8) & 0xff, TPQ & 0xff);
  out.push(0x4d, 0x54, 0x72, 0x6b);
  be32(out, trk.length);
  for (const b of trk) out.push(b);
  return new Uint8Array(out);
}
