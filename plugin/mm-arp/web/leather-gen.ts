/**
 * L'image du cuir du plugin MM-ARP (v35, 2026-11-19) : src/v4/plugin/arp/retro/leather.png, une tuile de 1024 px en
 * boucle (4 unites du panneau), en gris, aux valeurs du fond de Legend HZ (moyenne 23 / 255, ecart-type ~4). La meme
 * image sert a la face 3D (voyager/leather.ts) et aux pages d'OPEN (hood.css). Le calcul : src/v4/voyager/leatherField.ts.
 * npm run plugin:arp:leather
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { deflateSync } from 'zlib';
import { leatherBake, leatherField, LEATHER_MEAN, LEATHER_SD, LEATHER_SOFT } from '../../../src/v4/voyager/leatherField';

const N = 1024;
const gain = leatherBake(leatherField(N), N, LEATHER_SD, 1966, LEATHER_SOFT);
const px = Buffer.alloc(N * N);
let sum = 0;
for (let i = 0; i < N * N; i += 1) {
  px[i] = Math.max(0, Math.min(255, Math.round(LEATHER_MEAN * gain[i])));
  sum += px[i];
}

/* ---- un PNG gris 8 bits (zlib seul) ---- */
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b: Buffer): number => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i += 1) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8; // 8 bits
ihdr[9] = 0; // gris
const raw = Buffer.alloc((N + 1) * N);
for (let y = 0; y < N; y += 1) px.copy(raw, y * (N + 1) + 1, y * N, (y + 1) * N);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = resolve(process.argv[2] ?? 'src/v4/plugin/arp/retro/leather.png');
writeFileSync(out, png);
console.log(`${out} : ${N} px, ${(png.length / 1024).toFixed(0)} ko, moyenne ${(sum / (N * N)).toFixed(1)}`);
