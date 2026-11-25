#!/usr/bin/env python3
"""
v43 (Mika, 2026-11-20 : "Je ne veux pas que tu redessines ... je me suis pas fait chier a faire ca pour rien !", puis
"attention que ce soit pas flou ! je veux de la nettete, de la proprete") : les knobs de Mika, SES pixels, seulement
decoupes au masque pour qu'une partie reste fixe pendant que l'autre tourne. Aucune retouche : chaque calque est le PNG
d'origine, son alpha multiplie par un masque (un disque, antialiase au pixel), dans une marge transparente (le
filtrage ne bave pas au bord ; la taille arrondie a 32 px : les reductions tombent juste).
- knob1.png (le potard) : il tourne entier (son repere deborde sur le capuchon) -> k1 ;
- knob3.png (le petit) : le repere est sur la jupe : le capuchon fixe (k3-cap, le disque du capuchon) au-dessus du PNG
  entier qui tourne (k3) ; il tourne autour du centre du capuchon ;
- selector.png (le selecteur) : son petit capuchon fixe (sel-cap) au-dessus du PNG entier qui tourne (sel) ;
- 74.png (le tout petit, pages d'OPEN) : le knob detoure de sa capture au disque, un demi-pixel en dedans de son bord
  (ni cuir, ni chiffres, ni graduations, pas de frange) -> tiny ; son ombre sur le cuir, gardee en alpha (noir) a part
  -> tiny-shadow (fixe).
Pour la face (three.js) : chaque calque avec sa chaine de reductions precalculee ici (Lanczos sur l'alpha premultiplie :
ni moire sur le brosse, ni lisere sombre au bord), en une planche <calque>-mip.png (le niveau 0, puis chaque moitie, cote
a cote, en haut) ; vknob.ts les envoie telles quelles. Les pages d'OPEN (CSS) prennent le niveau 0 (<calque>.png).
Les centres, rayons et angles des reperes (mesures sur les PNG) partent dans vknobSpec.json.
python3 plugin/mm-arp/web/vknob-cut.py   (numpy et Pillow)
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'vknob-src')
OUT = os.path.join(HERE, '../../../src/v4/plugin/arp/vknob')
PAD = 8
ALIGN = 32

# Mesures (px du PNG) : le disque (centre, rayon), l'axe de rotation (le centre du capuchon quand il reste fixe), le
# rayon du capuchon fixe (un demi-pixel en dedans de son bord), l'angle du repere (degres, sens horaire depuis midi)
KNOBS = {
    'k1': dict(png='knob1.png', disc=(124.10, 123.50, 120.0), axis=(124.10, 123.50), cap=None, ref=30.3, mips=True, css=True),
    'k3': dict(png='knob3.png', disc=(110.0, 110.0, 110.0), axis=(111.83, 110.52), cap=56.4 - 0.5, ref=0.0, mips=True),
    'sel': dict(png='selector.png', disc=(176.34, 176.01, 172.83), axis=(176.36, 176.16), cap=33.1 - 0.5, ref=59.65, mips=True),
    'tiny': dict(png='tiny-src.png', disc=(141.5, 111.0, 52.5), axis=(141.5, 111.0), cap=None, ref=282.7, cutout=52.0, css=True),
}


def disc_mask(h, w, cx, cy, r):
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    d = np.hypot(xx - cx, yy - cy)
    return np.clip(r - d + 0.5, 0, 1)


def to_img(a):
    a = a.copy()
    a[a[..., 3] <= 0, :3] = 0   # hors du masque : rien (le rendu ne lit pas ces pixels)
    return Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8), 'RGBA')


def save(a, path):
    to_img(a).save(path, optimize=True)


def place(a, cx, cy):
    """dans une marge transparente, la taille arrondie a ALIGN ; le decalage applique"""
    h, w = a.shape[:2]
    W = int(math.ceil((w + 2 * PAD) / ALIGN) * ALIGN)
    H = int(math.ceil((h + 2 * PAD) / ALIGN) * ALIGN)
    ox = (W - w) // 2
    oy = (H - h) // 2
    b = np.zeros((H, W, 4))
    b[oy:oy + h, ox:ox + w] = a
    return b, ox, oy


def mip_atlas(img, path):
    """la chaine de reductions (Lanczos sur l'alpha premultiplie), cote a cote en haut d'une planche"""
    pm = img.convert('RGBa')
    w, h = img.size
    levels = []
    while True:
        lw = max(1, w >> len(levels))
        lh = max(1, h >> len(levels))
        lv = pm if not levels else pm.resize((lw, lh), Image.LANCZOS, reducing_gap=None)
        levels.append(lv.convert('RGBA'))
        if lw == 1 and lh == 1:
            break
    atlas = Image.new('RGBA', (sum(l.size[0] for l in levels), h), (0, 0, 0, 0))
    x = 0
    for l in levels:
        atlas.paste(l, (x, 0))
        x += l.size[0]
    atlas.save(path, optimize=True)
    return [l.size for l in levels]


def main():
    os.makedirs(OUT, exist_ok=True)
    spec = {}
    for key, k in KNOBS.items():
        a = np.asarray(Image.open(os.path.join(SRC, k['png'])).convert('RGBA')).astype(float)
        cx, cy, R = k['disc']
        ax, ay = k['axis']
        shadow = None
        if k.get('cutout'):
            # le tout petit : sa capture est opaque ; on garde le disque du knob (un demi-pixel en dedans de son bord), et a
            # part son ombre sur le cuir (l'assombrissement du cuir sous le knob, en noir avec cet alpha)
            H, W = a.shape[:2]
            L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
            yy, xx = np.mgrid[0:H, 0:W] + 0.5
            r = np.hypot(xx - cx, yy - cy)
            th = np.degrees(np.arctan2(xx - cx, -(yy - cy))) % 360
            knob = disc_mask(H, W, cx, cy, k['cutout'])
            ring = (r > R + 16) & (r < R + 30) & (th > 130) & (th < 230)
            leather = np.median(L[ring])
            sect = np.clip(1 - np.abs(((th - 180 + 180) % 360) - 180) / 75, 0, 1)
            band = np.clip((R + 14 - r) / 6, 0, 1) * (r > R - 1)
            sh = np.clip(1 - L / leather, 0, 1) * sect * band
            sh = np.asarray(Image.fromarray((sh * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))).astype(float) / 255
            shadow = np.zeros_like(a)
            shadow[..., 3] = sh * (1 - knob) * 255
            a = a.copy()
            a[..., 3] = knob * 255
        b, ox, oy = place(a, cx, cy)
        H, W = b.shape[:2]
        ent = dict(w=W, h=H, cx=cx + ox, cy=cy + oy, R=R, ax=ax + ox, ay=ay + oy, ref=k['ref'], cap=bool(k['cap']))
        if k.get('css'):
            save(b, f'{OUT}/{key}.png')
        if shadow is not None:
            sb, _, _ = place(shadow, cx, cy)
            save(sb, f'{OUT}/{key}-shadow.png')
        if k.get('mips'):
            ent['mips'] = mip_atlas(to_img(b), f'{OUT}/{key}-mip.png')
        if k['cap']:
            m = disc_mask(H, W, ax + ox, ay + oy, k['cap'])
            c = b.copy()
            c[..., 3] = b[..., 3] * m
            ent['capR'] = k['cap']
            mip_atlas(to_img(c), f'{OUT}/{key}-cap-mip.png')
        spec[key] = ent
        print(key, {kk: v for kk, v in ent.items() if kk != 'mips'}, 'levels', len(ent.get('mips', [])))
    with open(f'{OUT}/vknobSpec.json', 'w') as f:
        json.dump(spec, f, indent=1)


if __name__ == '__main__':
    main()
