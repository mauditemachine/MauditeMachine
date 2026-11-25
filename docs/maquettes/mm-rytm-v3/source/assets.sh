#!/usr/bin/env bash
# Les assets des maquettes MM-RYTM v3 (2026-11-25) : les knobs PNG de Mika (ceux du MM-ARP, branche claude/nifty-bohr-7ixmpf),
# les polices, la texture d'alu brosse noir (generee), la forme d'onde du kick 808 SUB BOOM.
#   bash docs/maquettes/mm-rytm-v3/source/assets.sh && node docs/maquettes/mm-rytm-v3/source/shot.cjs <dossier> face open_sample ...
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../../.." && pwd)"; A="$HERE/assets"; mkdir -p "$A"
ARP=origin/claude/nifty-bohr-7ixmpf; V=src/v4/plugin/arp/vknob
git -C "$REPO" fetch -q origin claude/nifty-bohr-7ixmpf || true
for f in k1.png k3-mip.png k3-cap-mip.png sel-mip.png sel-cap-mip.png tiny.png; do git -C "$REPO" show "$ARP:$V/$f" > "$A/$f"; done
for f in Doto-800.woff2 Doto-900.woff2; do git -C "$REPO" show "$ARP:plugin/mm-arp/web/fonts/$f" > "$A/$f"; done
cp "$REPO"/public/fonts/SF-Pro-Display-{Regular,Medium,Semibold,Bold,Black}.woff2 "$REPO/public/fonts/RobotRadicals.woff2" "$A/"
python3 - "$A" "$REPO" <<'PY'
import sys, wave, struct, json
import numpy as np
from PIL import Image
A, REPO = sys.argv[1], sys.argv[2]
# les calques des knobs : le niveau 0 de chaque planche
Image.open(f'{A}/k3-mip.png').crop((0, 0, 256, 256)).save(f'{A}/k3.png')
Image.open(f'{A}/k3-cap-mip.png').crop((0, 0, 256, 256)).save(f'{A}/k3cap.png')
Image.open(f'{A}/sel-mip.png').crop((0, 0, 384, 384)).save(f'{A}/sel.png')
Image.open(f'{A}/sel-cap-mip.png').crop((0, 0, 384, 384)).save(f'{A}/selcap.png')
# l'alu brosse noir : du bruit file a l'horizontale, quelques traits plus clairs, un reflet doux
def box(a, L):
    c = np.cumsum(np.pad(a, ((0, 0), (L, 0)), mode='wrap'), axis=1)
    return (c[:, L:] - c[:, :-L]) / L
def brushed(W, H, base, amp, seed, L=260):
    r = np.random.default_rng(seed)
    b = box(box(r.normal(0, 1, (H, W)).astype(np.float32), L), L // 3); b /= b.std()
    g = box(r.normal(0, 1, (H, W)).astype(np.float32), 18); g /= g.std()
    rows = r.random(H) < 0.012
    s = np.zeros((H, W), np.float32); s[rows, :] = r.uniform(0.6, 1.4, rows.sum())[:, None]
    return base + amp * (0.75 * b + 0.35 * g) + amp * 1.2 * box(s, 600)
W, H = 2800, 1800
v = brushed(W, H, 22.0, 3.2, 7)
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
v = (v + np.exp(-((y / H - 0.28) ** 2) / 0.05) * 6.0 + np.exp(-((x / W - 0.62) ** 2) / 0.08) * 2.0) * (1 - 0.22 * (((x / W - 0.5) * 1.6) ** 2 + ((y / H - 0.45) * 1.4) ** 2))
Image.fromarray(np.clip(np.stack([v * 0.98, v * 0.99, v * 1.03], -1), 0, 255).astype(np.uint8)).save(f'{A}/alu.jpg', quality=92)
v2 = brushed(1200, 1800, 15.0, 2.4, 11, 180)
Image.fromarray(np.clip(np.stack([v2, v2, v2 * 1.04], -1), 0, 255).astype(np.uint8)).save(f'{A}/alu-dark.jpg', quality=92)
# la forme d'onde (min / max par colonne)
w = wave.open(f'{REPO}/plugin/mm-rytm/samples/bd/Bd 808 Sub Boom.wav'); n = w.getnframes(); ch = w.getnchannels()
d = struct.unpack('<%dh' % (n * ch), w.readframes(n))[::ch]; d = [q / 32768 for q in d]; N = 700
pts = [[round(min(d[int(i * n / N):max(int((i + 1) * n / N), int(i * n / N) + 1)]), 3), round(max(d[int(i * n / N):max(int((i + 1) * n / N), int(i * n / N) + 1)]), 3)] for i in range(N)]
json.dump({'bd': {'ms': round(n / w.getframerate() * 1000), 'pts': pts}}, open(f'{A}/wave.json', 'w'))
PY
echo "assets : $A"
