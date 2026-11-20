#!/usr/bin/env python3
"""
v43 (Mika, 2026-11-20 : "Je ne veux pas que tu redessines ... je me suis pas fait chier a faire ca pour rien !") : les
knobs de Mika, SES pixels, seulement decoupes au masque pour qu'une partie reste fixe pendant que l'autre tourne. Aucune
retouche : chaque calque est le PNG d'origine, son alpha multiplie par un masque (un disque, antialiase au pixel), avec
une marge transparente autour (le filtrage ne bave pas au bord).
- knob1.png (le potard) : il tourne entier (son repere deborde sur le capuchon) -> k1.png ;
- knob3.png (le petit) : le repere est sur la jupe : le capuchon fixe (k3-cap.png, le disque du capuchon) au-dessus du
  PNG entier qui tourne (k3.png) ; il tourne autour du centre du capuchon ;
- selector.png (le selecteur) : son petit capuchon fixe (sel-cap.png) au-dessus du PNG entier qui tourne (sel.png) ;
- 74.png (le tout petit, pages d'OPEN) : le knob detoure de sa capture (fond cuir, chiffres, graduations dehors) au
  disque -> tiny.png ; son ombre sur le cuir, gardee en alpha (noir) a part -> tiny-shadow.png (fixe).
Les centres, rayons et angles des reperes (mesures sur les PNG) partent dans vknobSpec.json.
python3 plugin/mm-arp/web/vknob-cut.py   (numpy et Pillow)
"""
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'vknob-src')
OUT = os.path.join(HERE, '../../../src/v4/plugin/arp/vknob')
PAD = 8

# Mesures (px du PNG) : le disque (centre, rayon), l'axe de rotation (le centre du capuchon quand il reste fixe), le
# rayon du capuchon fixe, l'angle du repere (degres, sens horaire depuis midi)
KNOBS = {
    'k1': dict(png='knob1.png', disc=(124.10, 123.50, 120.0), axis=(124.10, 123.50), cap=None, ref=30.3),
    'k3': dict(png='knob3.png', disc=(110.0, 110.0, 110.0), axis=(111.83, 110.52), cap=56.4 - 0.5, ref=0.0),
    'sel': dict(png='selector.png', disc=(176.34, 176.01, 172.83), axis=(176.36, 176.16), cap=33.1 - 0.5, ref=59.65),
    'tiny': dict(png='tiny-src.png', disc=(141.5, 111.0, 52.5), axis=(141.5, 111.0), cap=None, ref=282.7, cutout=True),
}


def disc_mask(h, w, cx, cy, r):
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    d = np.hypot(xx - cx, yy - cy)
    return np.clip(r - d + 0.5, 0, 1)


def save(a, path):
    a = a.copy()
    a[a[..., 3] <= 0, :3] = 0   # hors du masque : rien (le PNG est plus leger ; le rendu ne lit pas ces pixels)
    Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8), 'RGBA').save(path, optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    spec = {}
    for key, k in KNOBS.items():
        a = np.asarray(Image.open(os.path.join(SRC, k['png'])).convert('RGBA')).astype(float)
        cx, cy, R = k['disc']
        ax, ay = k['axis']
        if k.get('cutout'):
            # le tout petit : la capture entiere est opaque ; on garde le disque du knob, puis son ombre sur le cuir
            # (l'assombrissement du cuir sous le knob, en noir avec cet alpha), rien d'autre
            H, W = a.shape[:2]
            L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
            yy, xx = np.mgrid[0:H, 0:W] + 0.5
            r = np.hypot(xx - cx, yy - cy)
            th = np.degrees(np.arctan2(xx - cx, -(yy - cy))) % 360
            knob = disc_mask(H, W, cx, cy, R)
            # le cuir autour, loin des graduations : sa luminance moyenne
            ring = (r > R + 16) & (r < R + 30) & (th > 130) & (th < 230)
            leather = np.median(L[ring])
            # l'ombre : sous le knob (la ou il n'y a ni graduation ni chiffre), de R a R + 14 px, lissee
            sect = np.clip(1 - np.abs(((th - 180 + 180) % 360) - 180) / 75, 0, 1)
            band = np.clip((R + 14 - r) / 6, 0, 1) * (r > R - 1)
            sh = np.clip(1 - L / leather, 0, 1) * sect * band
            from PIL import ImageFilter
            sh = np.asarray(Image.fromarray((sh * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))).astype(float) / 255
            # le knob (ses pixels, au disque) et, a part, son ombre (noire, fixe : elle ne tourne pas avec lui)
            shadow = np.zeros_like(a)
            shadow[..., 3] = sh * (1 - knob) * 255
            sb = np.zeros((a.shape[0] + 2 * PAD, a.shape[1] + 2 * PAD, 4))
            sb[PAD:-PAD, PAD:-PAD] = shadow
            save(sb, f'{OUT}/{key}-shadow.png')
            a = a.copy()
            a[..., 3] = knob * 255
        h, w = a.shape[:2]
        b = np.zeros((h + 2 * PAD, w + 2 * PAD, 4))
        b[PAD:PAD + h, PAD:PAD + w] = a
        save(b, f'{OUT}/{key}.png')
        ent = dict(w=w + 2 * PAD, h=h + 2 * PAD, cx=cx + PAD, cy=cy + PAD, R=R, ax=ax + PAD, ay=ay + PAD, ref=k['ref'], cap=bool(k['cap']))
        if k['cap']:
            m = disc_mask(h + 2 * PAD, w + 2 * PAD, ax + PAD, ay + PAD, k['cap'])
            c = b.copy()
            c[..., 3] = b[..., 3] * m
            save(c, f'{OUT}/{key}-cap.png')
            ent['capR'] = k['cap']
        spec[key] = ent
        print(key, ent)
    with open(f'{OUT}/vknobSpec.json', 'w') as f:
        json.dump(spec, f, indent=1)


if __name__ == '__main__':
    main()
