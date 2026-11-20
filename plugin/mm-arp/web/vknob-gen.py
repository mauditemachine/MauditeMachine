#!/usr/bin/env python3
"""
v43 (Mika, 2026-11-20 : "conserve la qualite et remplace tous les knobs de ce style par ce png la") : les tables des
knobs vectoriels du MM-ARP, mesurees sur ses trois PNG (vknob-src/ : knob1 le potard, knob3 le petit, selector le
selecteur). Le knob est redessine a chaque image par un shader (src/v4/plugin/arp/vknob.ts) : ses bords (le disque, le
capuchon, la gorge, le repere) sont des formes calculees, nettes a toutes les tailles ; ces tables n'en donnent que les
matieres, mesurees ici une fois :
- la prise (knob1, knob3) : un motif periodique (six lobes, symetrique), en coordonnees polaires (rayon, phase dans le
  lobe), SANS la lumiere ; la lumiere (douce, fixe : elle ne tourne pas avec le knob) a part, K(r, angle a l'ecran) ;
  separees par moindres carres alternes (log P = log G(r, phase) + log K(r, angle), K en serie de Fourier d'ordre 3) ;
- le selecteur : sa face (la barre, le moyeu) sans la lumiere (le PNG divise par K, K ajuste sur le disque seul) ;
- le capuchon de metal brosse (fixe) : sa luminance selon l'angle (le brossage conique), mesuree sur une bande ;
- le repere : son profil le long de son axe, sans la lumiere.
Sorties : src/v4/plugin/arp/vknob/<kind>-grip.png, <kind>-light.png, <kind>-lut.png et vknobSpec.json (les cotes).
python3 plugin/mm-arp/web/vknob-gen.py   (numpy et Pillow)
"""
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'vknob-src')
OUT = os.path.join(HERE, '../../../src/v4/plugin/arp/vknob')
NT_K = 128     # angles de la table de lumiere
NC = 2048      # echantillons du capuchon (angle) et du repere (rayon)
DR = 0.002     # pas en rayon des tables polaires (part du rayon du disque)

# Les cotes mesurees sur chaque PNG (centre et rayon : le disque opaque ; rcap : le cercle ajuste au bord du capuchon ;
# le repere : son angle, sa largeur et sa longueur ; en part du rayon du disque)
SPECS = {
    'k1': dict(png='knob1.png', kind='lobed', cx=124.10, cy=123.50, R=120.0, n=6, ref=30.3, rcap=0.621, gap=0.012, mh=7.0,
               mark=dict(w=0.135, r0=0.621, r1=0.945, border=0.0), groove=dict(w=0.014, k=0.35), edge=0.3, sharp=0.6),
    'k3': dict(png='knob3.png', kind='lobed', cx=110.0, cy=110.0, R=110.0, n=6, ref=0.0, rcap=0.513, gap=0.022, mh=8.0,
               mark=dict(w=0.134, r0=0.513, r1=0.965, border=0.0), groove=dict(w=0.014, k=0.35), edge=0.3, sharp=0.6),
    'sel': dict(png='selector.png', kind='selector', cx=176.34, cy=176.01, R=172.83, ref=59.65, rcap=0.1916, bar=0.22,
                mark=dict(w=0.137, r0=0.672, r1=0.945, border=0.012), groove=dict(w=0.016, k=0.5), edge=0.25),
}


def load(name):
    a = np.asarray(Image.open(os.path.join(SRC, name)).convert('RGBA')).astype(float)
    return a


def bil(img, x, y):
    H, W = img.shape[:2]
    x = x - 0.5
    y = y - 0.5
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx = x - x0
    fy = y - y0

    def g(a, b):
        return img[np.clip(b, 0, H - 1), np.clip(a, 0, W - 1)]
    return g(x0, y0) * (1 - fx) * (1 - fy) + g(x0 + 1, y0) * fx * (1 - fy) + g(x0, y0 + 1) * (1 - fx) * fy + g(x0 + 1, y0 + 1) * fx * fy


def polar(ch, s, NT=2880):
    """un canal du PNG en (r, angle) : angle horaire depuis midi (l'ecran)"""
    rs = np.arange(0, 1.0, DR)
    ths = np.arange(NT) / NT * 2 * np.pi
    TH, RR = np.meshgrid(ths, rs)
    return rs, ths, bil(ch, s['cx'] + RR * s['R'] * np.sin(TH), s['cy'] - RR * s['R'] * np.cos(TH))


def fourier(ths, nK):
    return np.stack([np.ones_like(ths)] + [f(k * ths) for k in range(1, nK + 1) for f in (np.cos, np.sin)], 1)


def smooth_r(coef, s=2.5):
    kk = np.exp(-0.5 * (np.arange(-6, 7) / s) ** 2)
    kk /= kk.sum()
    return np.stack([np.convolve(np.pad(c, 6, mode='edge'), kk, 'valid') for c in coef])


def fit_lobed(P, rs, ths, s, r0, r1, NU=120, nK=3, iters=12):
    """log P = log G(r, phase) + log K(r, angle) ; G symetrique, periode 2 pi / n ; hors du repere"""
    ri = (rs >= r0) & (rs <= r1)
    lg = np.log(np.maximum(P[ri], 2.0))
    ref = math.radians(s['ref'])
    period = 2 * np.pi / s['n']
    u = np.mod(ths - ref, 2 * np.pi)
    ph = np.mod(u + period / 2, period) - period / 2
    ub = np.minimum((np.abs(ph) / (period / 2) * NU).astype(int), NU - 1)
    um = np.abs(np.mod(u + np.pi, 2 * np.pi) - np.pi) > math.radians(s['mh'])
    F = fourier(ths, nK)
    lK = np.zeros(lg.shape)
    for _ in range(iters):
        res = lg - lK
        G = np.zeros((lg.shape[0], NU))
        C = np.zeros_like(G)
        for i in range(lg.shape[0]):
            np.add.at(G[i], ub[um], res[i][um])
            np.add.at(C[i], ub[um], 1)
        G = G / np.maximum(C, 1)
        coef = np.linalg.lstsq(F[um], (lg - G[:, ub])[:, um].T, rcond=None)[0]
        coef = smooth_r(coef)
        coef[0] = 0
        lK = (F @ coef).T
    return np.exp(G), coef, rs[ri]


def blur2(a, s):
    k = np.exp(-0.5 * (np.arange(-4, 5) / s) ** 2)
    k /= k.sum()
    b = np.apply_along_axis(lambda v: np.convolve(np.pad(v, 4, mode='edge'), k, 'valid'), 0, a)
    return np.apply_along_axis(lambda v: np.convolve(np.pad(v, 4, mode='reflect'), k, 'valid'), 1, b)


def k_table(coef, nK):
    tt = np.arange(NT_K) / NT_K * 2 * np.pi
    return np.exp(fourier(tt, nK) @ coef).T   # (nr, NT_K)


def resample(x, y, n, lo, hi):
    return np.interp(np.linspace(lo, hi, n), x, y)


def k_at(Kt, rr, r0, r1, th):
    nr, nt = Kt.shape
    i = np.clip(np.round((np.clip(rr, r0, r1) - r0) / (r1 - r0) * (nr - 1)).astype(int), 0, nr - 1)
    j = np.round((np.mod(th, 2 * np.pi)) / (2 * np.pi) * nt).astype(int) % nt
    return Kt[i, j]


def cap_profile(P, rs, s):
    lo, hi = 0.25 * s['rcap'], s['rcap'] - 0.045
    band = P[(rs > lo) & (rs < hi)].mean(0)
    return resample(np.arange(len(band) + 1) / len(band), np.append(band, band[0]), NC, 0, 1 - 1 / NC)


def mark_profile(ch, s, Kt, r0k, r1k):
    """le repere le long de son axe (moyenne sur le quart central de sa largeur), divise par la lumiere a son angle"""
    m = s['mark']
    ref = math.radians(s['ref'])
    rr = np.linspace(m['r0'], m['r1'], 160)
    vals = []
    for r in rr:
        acc = []
        for t in np.linspace(-m['w'] * 0.22, m['w'] * 0.22, 7):
            # t : decalage perpendiculaire a l'axe (unites du rayon)
            x = r * math.sin(ref) + t * math.cos(ref)
            y = -r * math.cos(ref) + t * math.sin(ref)
            acc.append(bil(ch, np.array([s['cx'] + x * s['R']]), np.array([s['cy'] + y * s['R']]))[0])
        vals.append(np.mean(acc))
    vals = np.array(vals) / k_at(Kt, rr, r0k, r1k, np.full_like(rr, ref))
    return resample(rr, vals, NC, m['r0'], m['r1'])


def save_rgb(path, arr, scale=1.0):
    Image.fromarray(np.clip(np.round(arr * scale), 0, 255).astype(np.uint8), 'RGB').save(path, optimize=True)


def build_lobed(key, s, A):
    r0 = s['rcap'] + s['gap']
    r1 = 0.975
    G3, K3, cap3, mk3 = [], [], [], []
    for c in range(3):
        rs, ths, P = polar(A[..., c], s)
        G, coef, rsel = fit_lobed(P, rs, ths, s, r0, r1)
        # le flou de la photo, un peu rattrape (masque flou en r et en phase)
        G = np.clip(G + s['sharp'] * (G - blur2(G, 1.2)), 1, 255)
        Kt = k_table(coef, 3)
        G3.append(G)
        K3.append(Kt)
        cap3.append(cap_profile(P, rs, s))
        mk3.append(mark_profile(A[..., c], s, Kt, r0, r1))
    G = np.stack(G3, -1)        # (nr, NU, 3)
    K = np.stack(K3, -1)        # (nr, NT_K, 3)
    save_rgb(f'{OUT}/{key}-grip.png', G)
    save_rgb(f'{OUT}/{key}-light.png', K, 255 / 2)
    lut = np.stack([np.stack(cap3, -1), np.stack(mk3, -1)], 0)   # (2, NC, 3)
    save_rgb(f'{OUT}/{key}-lut.png', lut)
    return dict(kind='lobed', n=s['n'], rcap=s['rcap'], r0=r0, r1=r1, ref=s['ref'], mark=s['mark'], groove=s['groove'],
                edge=s['edge'], grip=[G.shape[1], G.shape[0]])


def build_selector(key, s, A):
    """la face (barre, moyeu) sans la lumiere : K ajuste sur le disque et le moyeu, hors de la barre, du repere, du capuchon"""
    r0, r1 = s['rcap'] + 0.01, 0.975
    ref = math.radians(s['ref'])
    H, W = A.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W] + 0.5
    X = (xx - s['cx']) / s['R']
    Y = (yy - s['cy']) / s['R']
    G3, K3, cap3, mk3 = [], [], [], []
    for c in range(3):
        rs, ths, P = polar(A[..., c], s)
        TH, RR = np.meshgrid(ths, rs)
        # la distance a l'axe de la barre (passe par le centre, dans la direction du repere)
        perp = np.abs(RR * np.sin(TH - ref))
        ok = (perp > s['bar']) & (RR > r0) & (RR < r1)
        ri = (rs >= r0) & (rs <= r1)
        F = fourier(ths, 3)
        coef = np.zeros((F.shape[1], ri.sum()))
        lg = np.log(np.maximum(P[ri], 2.0))
        okr = ok[ri]
        for i in range(lg.shape[0]):
            m = okr[i]
            if m.sum() > 40:
                coef[:, i] = np.linalg.lstsq(F[m], lg[i][m], rcond=None)[0]
        coef = smooth_r(coef, 4.0)
        coef[0] = 0
        Kt = k_table(coef, 3)
        # le PNG sans la lumiere, dans son orientation (le repere a ref) ; pres du centre, la lumiere du bord du capuchon
        rr = np.hypot(X, Y)
        th = np.mod(np.arctan2(X, -Y), 2 * np.pi)
        k = k_at(Kt, rr, r0, r1, th)
        G = A[..., c] / k
        G3.append(G)
        K3.append(Kt)
        cap3.append(cap_profile(P, rs, dict(rcap=s['rcap'])))
        mk3.append(mark_profile(A[..., c], s, Kt, r0, r1))
    G = np.stack(G3, -1)
    K = np.stack(K3, -1)
    save_rgb(f'{OUT}/{key}-grip.png', G, 0.5)
    save_rgb(f'{OUT}/{key}-light.png', K, 255 / 2)
    save_rgb(f'{OUT}/{key}-lut.png', np.stack([np.stack(cap3, -1), np.stack(mk3, -1)], 0))
    return dict(kind='selector', rcap=s['rcap'], r0=r0, r1=r1, ref=s['ref'], mark=s['mark'], groove=s['groove'],
                edge=s['edge'], grip=[W, H], center=[s['cx'] / W, s['cy'] / H], radius=[s['R'] / W, s['R'] / H])


def main():
    os.makedirs(OUT, exist_ok=True)
    spec = {}
    for key, s in SPECS.items():
        A = load(s['png'])
        spec[key] = build_lobed(key, s, A) if s['kind'] == 'lobed' else build_selector(key, s, A)
        print(key, 'ok')
    with open(f'{OUT}/vknobSpec.json', 'w') as f:
        json.dump(spec, f, indent=1)


if __name__ == '__main__':
    main()
