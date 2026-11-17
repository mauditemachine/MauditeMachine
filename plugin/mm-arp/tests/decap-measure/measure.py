#!/usr/bin/env python3
"""
Mesure de la DISTO du MM-ARP contre le Soundtoys Decapitator (2026-11-16, Mika : "prepare le script de mesure").

Boite noire uniquement : des signaux de test passent dans l'appareil, on mesure ce qui sort. Le binaire n'est jamais
ouvert ni desassemble (la licence Soundtoys l'interdit) et il ne va JAMAIS dans le depot (public) : seules les mesures
y vont. Tout est rendu hors ligne, en memoire : aucun son ne sort des enceintes.

Les memes signaux passent dans les deux appareils :
  --plugin <Decapitator.vst3>     le Decapitator, charge par pedalboard (Spotify)
  --cli <mmarp_decap_cli>         la DISTO du plugin (dsp/Decap.h), en ligne de commande
puis
  --compare a.json b.json         les deux cote a cote

Les mesures :
  laws       la loi de chaque reglage : la valeur affichee pour 41 positions de 0 a 1
  harmonics  chaque style, DRIVE 0 a 1 (et PUNISH) : sinus de 100 Hz et 1 kHz de -36 a 0 dBFS : gain, THD,
             harmoniques H2 a H9, continu
  autogain   AUTO allume : le gain a 1 kHz, -18 dBFS, pour chaque style et DRIVE
  response   en petit signal (-30 dBFS) : la reponse de 20 Hz a 20 kHz de chaque style, de LOW CUT (+ THUMP),
             HIGH CUT (+ STEEP) et TONE
  burst      une salve apres un silence : l'enveloppe des 100 premieres ms (une saturation qui respire ?)
  latency    une impulsion : son retard

Usage le plus simple : ./run.sh (voir README.md).
"""

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import time

import numpy as np

SR = 48000
STYLES = ["A", "E", "N", "T", "P"]
# Les mesures en petit signal (filtres, retard) a un DRIVE minimal mais non nul : a 0, la DISTO du MM-ARP se contourne
LIN_DRIVE = 0.02
KEYS = ["style", "drive", "punish", "low", "thump", "tone", "high", "steep", "mix", "out", "auto"]
PREROLL = 0.3  # s de silence avant tout : les lissages des reglages s'installent
GAP = 0.05

# Les noms possibles de chaque reglage chez le Decapitator (normalises : minuscules, sans espaces ni ponctuation)
CANDIDATES = {
    "style": ["style", "mode", "circuit", "model"],
    "drive": ["drive", "inputdrive", "gain"],
    "punish": ["punish"],
    "low": ["lowcut", "locut", "lowcutfreq", "lowcutfrequency", "hpf", "highpass"],
    "thump": ["thump"],
    "tone": ["tone", "tilt"],
    "high": ["highcut", "hicut", "highcutfreq", "highcutfrequency", "lpf", "lowpass"],
    "steep": ["steep"],
    "mix": ["mix", "drywet", "wet", "drywetmix"],
    "out": ["output", "out", "outputgain", "outgain", "outputlevel"],
    "auto": ["auto", "autogain", "autooutput"],
}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def number(text):
    """Le nombre d'une valeur affichee ('1.2 kHz' -> 1200, '-6.0 dB' -> -6, 'Off' -> None)."""
    if text is None:
        return None
    t = text.strip().lower()
    m = re.search(r"[-+]?\d+(?:[.,]\d+)?", t)
    if not m:
        return None
    v = float(m.group(0).replace(",", "."))
    if re.search(r"\d\s*k(hz)?\b", t) or t.endswith("k"):
        v *= 1000
    return v


def is_off(text):
    return text is not None and "off" in text.lower()


# ---------------------------------------------------------------- les appareils


class PluginDevice:
    """Le Decapitator (ou tout VST3 / AU de distorsion), par pedalboard."""

    kind = "plugin"

    def __init__(self, path, overrides):
        from pedalboard import load_plugin  # noqa: import tardif : le mode --cli n'en a pas besoin

        self.path = path
        self.p = load_plugin(path)
        self.params = dict(self.p.parameters)
        self.map = {}
        names = {norm(n): n for n in self.params}
        for key in KEYS:
            if key in overrides:
                self.map[key] = overrides[key]
                continue
            hit = next((names[c] for c in CANDIDATES[key] if c in names), None)
            if hit is None:
                hit = next((n for nn, n in names.items() for c in CANDIDATES[key] if c in nn), None)
            if hit is not None:
                self.map[key] = hit
        self._law = {k: self._scan(k) for k in self.map}
        self.name = getattr(self.p, "name", path)

    def _param(self, key):
        return self.params[self.map[key]]

    def _scan(self, key, n=41):
        prm = self._param(key)
        keep = prm.raw_value
        out = []
        for i in range(n):
            r = i / (n - 1)
            prm.raw_value = r
            out.append([round(r, 4), prm.string_value])
        prm.raw_value = keep
        return out

    def laws(self):
        return {k: v for k, v in self._law.items()}

    def _raw_where(self, key, pred, default):
        for r, s in self._law.get(key, []):
            if pred(s):
                return r
        return default

    def _raw_for_number(self, key, target, log=False):
        best, err = None, float("inf")
        for r, s in self._law.get(key, []):
            v = number(s)
            if v is None or (log and v <= 0):
                continue
            e = abs(math.log(v / target)) if log else abs(v - target)
            if e < err:
                best, err = r, e
        return best

    def set(self, st):
        """st : style (lettre), drive / low / tone / high / mix / out en position 0..1 (low / high None : OFF), punish /
        thump / steep / auto en booleen ; out None : 0 dB ; tone None : neutre."""
        m = self.map
        if "style" in m:
            prm = self._param("style")
            r = self._raw_where("style", lambda s: s.strip().upper().startswith(st["style"]), None)
            if r is None:
                raise SystemExit(f"style {st['style']} introuvable dans {[s for _, s in self._law['style']]}")
            prm.raw_value = r
        if "drive" in m:
            self._param("drive").raw_value = st["drive"]
        for key in ("punish", "thump", "steep", "auto"):
            if key in m:
                self._param(key).raw_value = 1.0 if st[key] else 0.0
        if "low" in m:
            r = st["low"] if st["low"] is not None else self._raw_where("low", is_off, 0.0)
            self._param("low").raw_value = r
        if "high" in m:
            r = st["high"] if st["high"] is not None else self._raw_where("high", is_off, 1.0)
            self._param("high").raw_value = r
        if "tone" in m:
            r = st["tone"] if st["tone"] is not None else self._raw_for_number("tone", 0.0)
            self._param("tone").raw_value = 0.5 if r is None else r
        if "mix" in m:
            r = self._raw_for_number("mix", 100.0) if st["mix"] >= 1 else st["mix"]
            self._param("mix").raw_value = 1.0 if r is None else r
        if "out" in m:
            r = st["out"] if st["out"] is not None else self._raw_for_number("out", 0.0)
            self._param("out").raw_value = 0.5 if r is None else r

    def process(self, x):
        y = self.p.process(x.astype(np.float32), SR, buffer_size=512, reset=True)
        return np.asarray(y, dtype=np.float64)

    def info(self):
        return {"kind": self.kind, "path": self.path, "name": str(self.name), "map": self.map, "all_params": sorted(self.params)}


class CliDevice:
    """La DISTO du MM-ARP (plugin/mm-arp/dsp/Decap.h), par mmarp_decap_cli."""

    kind = "mm-disto"

    def __init__(self, exe):
        self.exe = exe
        self.args = []
        self.name = "MM-ARP DISTO"

    @staticmethod
    def _hz(v, lo):
        if lo:
            return "Off" if v < 0.02 else f"{20 * 50 ** ((v - 0.02) / 0.98):.0f} Hz"
        return "Off" if v > 0.98 else f"{1000 * 20 ** (v / 0.98):.0f} Hz"

    def laws(self):
        g = [i / 40 for i in range(41)]
        return {
            "style": [[round(r, 4), STYLES[min(4, int(r * 5))]] for r in g],
            "drive": [[round(r, 4), f"{36 * r:.1f} dB"] for r in g],
            "low": [[round(r, 4), self._hz(r, True)] for r in g],
            "high": [[round(r, 4), self._hz(r, False)] for r in g],
            "tone": [[round(r, 4), f"{(r - 0.5) * 12:+.1f} dB tilt"] for r in g],
            "mix": [[round(r, 4), f"{r * 100:.0f} %"] for r in g],
            "out": [[round(r, 4), f"{-18 + 36 * r:+.1f} dB"] for r in g],
        }

    def set(self, st):
        a = ["--style", STYLES.index(st["style"]), "--drive", st["drive"], "--punish", int(st["punish"]), "--thump", int(st["thump"]),
             "--steep", int(st["steep"]), "--auto", int(st["auto"]), "--mix", st["mix"], "--ref", 1, "--sr", SR,
             "--low", 0 if st["low"] is None else st["low"], "--high", 1 if st["high"] is None else st["high"],
             "--tone", 0.5 if st["tone"] is None else st["tone"], "--out", 0.5 if st["out"] is None else st["out"]]
        self.args = [str(v) for v in a]

    def process(self, x):
        data = np.ascontiguousarray(x.T.astype(np.float32)).tobytes()
        r = subprocess.run([self.exe, *self.args], input=data, capture_output=True, check=True)
        y = np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).T
        return y.astype(np.float64)

    def info(self):
        return {"kind": self.kind, "path": self.exe, "name": self.name}


# ---------------------------------------------------------------- les signaux et l'analyse


def base(style="A", drive=0.0, **kw):
    st = {"style": style, "drive": drive, "punish": False, "low": None, "thump": False, "tone": None, "high": None,
          "steep": False, "mix": 1.0, "out": None, "auto": False}
    st.update(kw)
    return st


def tones(segs, seg_s):
    """segs : [(f, dBFS)] ; renvoie le signal stereo et les fenetres d'analyse (debut, fin) en echantillons."""
    n_seg = int(seg_s * SR)
    n_gap = int(GAP * SR)
    pre = int(PREROLL * SR)
    total = pre + len(segs) * (n_seg + n_gap)
    x = np.zeros(total)
    win = []
    fade = int(0.005 * SR)
    ramp = np.ones(n_seg)
    ramp[:fade] = np.linspace(0, 1, fade)
    ramp[-fade:] = np.linspace(1, 0, fade)
    t = np.arange(n_seg) / SR
    for i, (f, dbfs) in enumerate(segs):
        s0 = pre + i * (n_seg + n_gap)
        x[s0:s0 + n_seg] = 10 ** (dbfs / 20) * np.sin(2 * np.pi * f * t) * ramp
        a = s0 + int(min(0.12, seg_s * 0.4) * SR)
        b = s0 + n_seg - int(0.02 * SR)
        win.append((a, b))
    return np.vstack([x, x]), win


def blackman_harris(n):
    k = np.arange(n) / (n - 1)
    return 0.35875 - 0.48829 * np.cos(2 * np.pi * k) + 0.14128 * np.cos(4 * np.pi * k) - 0.01168 * np.cos(6 * np.pi * k)


def tone_at(y, f, w):
    n = np.arange(len(y))
    return 2 * abs(np.sum(w * y * np.exp(-2j * np.pi * f * n / SR))) / np.sum(w)


def analyse(xin, yout, f, a, b):
    xi = xin[a:b]
    yo = yout[a:b]
    w = blackman_harris(len(yo))
    h1 = tone_at(yo, f, w)
    harm = []
    for k in range(2, 10):
        if k * f >= 20000:
            break
        harm.append(round(20 * math.log10(max(1e-12, tone_at(yo, k * f, w)) / max(1e-12, h1)), 2))
    rest = [10 ** (h / 20) for h in harm]
    thd = 100 * math.sqrt(sum(r * r for r in rest))
    rms_i = math.sqrt(np.mean(xi * xi))
    rms_o = math.sqrt(np.mean(yo * yo))
    even = sum(10 ** (h / 10) for i, h in enumerate(harm) if (i + 2) % 2 == 0)
    odd = sum(10 ** (h / 10) for i, h in enumerate(harm) if (i + 2) % 2 == 1)
    return {
        "gain_db": round(20 * math.log10(max(1e-12, rms_o) / max(1e-12, rms_i)), 3),
        "h1_db": round(20 * math.log10(max(1e-12, h1) / max(1e-12, tone_at(xi, f, w))), 3),
        "thd_pct": round(thd, 4),
        "harm_db": harm,
        "even_odd_db": round(10 * math.log10(max(1e-30, even) / max(1e-30, odd)), 2),
        "dc": round(float(np.mean(yo)), 6),
    }


def run(dev, st, x):
    dev.set(st)
    y = dev.process(x)
    if y.shape[1] < x.shape[1]:
        y = np.pad(y, ((0, 0), (0, x.shape[1] - y.shape[1])))
    return y[:, : x.shape[1]]


# ---------------------------------------------------------------- les mesures


def m_harmonics(dev, quick):
    drives = [0.0, 0.5, 1.0] if quick else [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    levels = [-24, -12, 0] if quick else [-36, -24, -18, -12, -6, 0]
    freqs = [1000] if quick else [100, 1000]
    segs = [(f, l) for f in freqs for l in levels]
    x, win = tones(segs, 0.4)
    out = []
    for style in STYLES:
        for drive in drives:
            for punish in ([False, True] if drive in (0.5, 1.0) or (not quick and drive in (0.6, 1.0)) else [False]):
                y = run(dev, base(style, drive, punish=punish), x)
                for (f, l), (a, b) in zip(segs, win):
                    out.append({"style": style, "drive": drive, "punish": punish, "f": f, "dbfs": l, **analyse(x[0], y[0], f, a, b)})
        print(f"  harmonics {style}", file=sys.stderr)
    return out


def m_autogain(dev, quick):
    drives = [0.0, 0.5, 1.0] if quick else [i / 10 for i in range(11)]
    x, win = tones([(1000, -18)], 0.5)
    out = []
    for style in STYLES:
        for drive in drives:
            for punish in (False, True):
                y = run(dev, base(style, drive, punish=punish, auto=True), x)
                a, b = win[0]
                r = analyse(x[0], y[0], 1000, a, b)
                out.append({"style": style, "drive": drive, "punish": punish, "gain_db": r["gain_db"], "thd_pct": r["thd_pct"]})
    return out


def m_response(dev, quick):
    nf = 12 if quick else 31
    freqs = [round(20 * 1000 ** (i / (nf - 1)), 2) for i in range(nf)]
    segs = [(f, -30) for f in freqs]
    x, win = tones(segs, 0.35)
    pos = [0.2, 0.5, 0.8] if quick else [0.1, 0.3, 0.5, 0.7, 0.9]
    d = LIN_DRIVE
    configs = [(f"flat {s}", base(s, d)) for s in STYLES]
    configs += [(f"low {p} thump {int(t)}", base("A", d, low=p, thump=t)) for p in pos for t in (False, True)]
    configs += [(f"high {p} steep {int(t)}", base("A", d, high=p, steep=t)) for p in pos for t in (False, True)]
    configs += [(f"tone {p}", base("A", d, tone=p)) for p in [0.0, 0.25, 0.75, 1.0]]
    out = []
    for name, st in configs:
        y = run(dev, st, x)
        g = []
        for f, (a, b) in zip(freqs, win):
            w = blackman_harris(b - a)
            g.append(round(20 * math.log10(max(1e-12, tone_at(y[0][a:b], f, w)) / max(1e-12, tone_at(x[0][a:b], f, w))), 3))
        out.append({"config": name, "settings": st, "freqs": freqs, "gain_db": g})
        print(f"  response {name}", file=sys.stderr)
    return out


def m_burst(dev):
    pre = int(PREROLL * SR)
    n = pre + int(1.2 * SR)
    x = np.zeros(n)
    t0 = pre + int(0.2 * SR)
    nb = int(0.5 * SR)
    t = np.arange(nb) / SR
    x[t0:t0 + nb] = 10 ** (-12 / 20) * np.sin(2 * np.pi * 1000 * t)
    xs = np.vstack([x, x])
    out = []
    for style in STYLES:
        y = run(dev, base(style, 0.6), xs)[0]
        steady = math.sqrt(np.mean(y[t0 + nb - int(0.1 * SR): t0 + nb] ** 2))
        env = []
        step = int(0.002 * SR)
        for i in range(50):
            s = y[t0 + i * step: t0 + (i + 1) * step]
            env.append(round(20 * math.log10(max(1e-12, math.sqrt(np.mean(s * s))) / max(1e-12, steady)), 2))
        out.append({"style": style, "drive": 0.6, "env_db_2ms": env, "dc_after": round(float(np.mean(y[t0 + nb + int(0.05 * SR):])), 7)})
    return out


def m_latency(dev):
    pre = int(PREROLL * SR)
    x = np.zeros(pre + SR // 2)
    x[pre] = 0.5
    y = run(dev, base("A", LIN_DRIVE), np.vstack([x, x]))[0]
    return {"samples": int(np.argmax(np.abs(y[pre:])))}


# ---------------------------------------------------------------- la comparaison


def compare(fa, fb):
    A = json.load(open(fa))
    B = json.load(open(fb))
    na, nb = A["device"]["name"], B["device"]["name"]
    print(f"A : {na}\nB : {nb}\n")
    print("LOIS (position -> affichage)")
    for key in ("drive", "low", "high", "tone", "out", "mix"):
        la = {r: s for r, s in A["laws"].get(key, [])}
        lb = {r: s for r, s in B["laws"].get(key, [])}
        if not la and not lb:
            continue
        print(f"  {key}")
        for r in (0.0, 0.25, 0.5, 0.75, 1.0):
            print(f"    {r:4.2f}  A {str(la.get(r, '-')):>14}   B {str(lb.get(r, '-')):>14}")
    print("\nHARMONIQUES a 1 kHz, -18 dBFS (gain dB / THD % / H2 H3 H5 dBc / pair-impair dB)")

    def pick(D, style, drive, punish):
        for r in D["harmonics"]:
            if r["style"] == style and abs(r["drive"] - drive) < 1e-6 and r["punish"] == punish and r["f"] == 1000 and r["dbfs"] in (-18, -12):
                if r["dbfs"] == -18 or not any(q["dbfs"] == -18 for q in D["harmonics"]):
                    return r
        return None

    def fmt(r):
        if not r:
            return "-".rjust(40)
        h = r["harm_db"] + [float("nan")] * 4
        return f"{r['gain_db']:+6.1f} {r['thd_pct']:6.2f}% {h[0]:6.1f} {h[1]:6.1f} {h[3]:6.1f} {r['even_odd_db']:+6.1f}"

    drives = sorted({r["drive"] for r in A["harmonics"]} & {r["drive"] for r in B["harmonics"]})
    for style in STYLES:
        print(f"  {style}")
        for d in drives:
            for p in (False, True):
                ra, rb = pick(A, style, d, p), pick(B, style, d, p)
                if ra or rb:
                    print(f"    drive {d:3.1f}{' P' if p else '  '}  A {fmt(ra)}   B {fmt(rb)}")
    print("\nAUTO : le gain a 1 kHz, -18 dBFS (dB)")
    for style in STYLES:
        ga = {(r["drive"], r["punish"]): r["gain_db"] for r in A["autogain"] if r["style"] == style}
        gb = {(r["drive"], r["punish"]): r["gain_db"] for r in B["autogain"] if r["style"] == style}
        row = "  ".join(f"{k[0]:.1f}{'P' if k[1] else ' '} {ga[k]:+5.1f}/{gb[k]:+5.1f}" for k in sorted(ga) if k in gb)
        print(f"  {style}  {row}")
    print("\nREPONSES : les -3 dB (Hz), la bosse (dB)")

    def corner(r, low):
        """Le passage a -3 dB (par rapport a 1 kHz), interpole en log de frequence ; None : aucun."""
        g = np.array(r["gain_db"])
        f = np.array(r["freqs"])
        rel = g - g[np.argmin(abs(np.log(f / 1000)))]
        lf = np.log(f)
        if low:
            # du grave vers 1 kHz : le dernier passage de sous -3 a au-dessus
            for i in range(len(f) - 1):
                if f[i + 1] <= 1000 and rel[i] < -3 <= rel[i + 1]:
                    t = (-3 - rel[i]) / (rel[i + 1] - rel[i])
                    best = float(np.exp(lf[i] + t * (lf[i + 1] - lf[i])))
            return locals().get("best")
        for i in range(len(f) - 1):
            if f[i] >= 1000 and rel[i] >= -3 > rel[i + 1]:
                t = (-3 - rel[i]) / (rel[i + 1] - rel[i])
                return float(np.exp(lf[i] + t * (lf[i + 1] - lf[i])))
        return None

    ra = {r["config"]: r for r in A["response"]}
    rb = {r["config"]: r for r in B["response"]}
    for name in ra:
        if name not in rb:
            continue
        low = name.startswith("low")
        ca, cb = corner(ra[name], low), corner(rb[name], low)
        bump_a = max(ra[name]["gain_db"]) - ra[name]["gain_db"][len(ra[name]["freqs"]) // 2]
        bump_b = max(rb[name]["gain_db"]) - rb[name]["gain_db"][len(rb[name]["freqs"]) // 2]
        print(f"  {name:22} A {str(round(ca) if ca else '-'):>6} Hz bosse {bump_a:+5.1f}   B {str(round(cb) if cb else '-'):>6} Hz bosse {bump_b:+5.1f}")
    print(f"\nRETARD : A {A['latency']['samples']} ech.   B {B['latency']['samples']} ech.")


# ---------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--plugin", help="le VST3 / AU a mesurer (le Decapitator)")
    ap.add_argument("--cli", help="mmarp_decap_cli (la DISTO du MM-ARP)")
    ap.add_argument("--out", help="le fichier JSON des mesures")
    ap.add_argument("--map", action="append", default=[], help="cle=nom du parametre (si la detection rate), ex. low='Low Cut'")
    ap.add_argument("--list", action="store_true", help="liste les parametres du plugin et leurs valeurs, puis sort")
    ap.add_argument("--quick", action="store_true", help="une grille reduite (essai rapide)")
    ap.add_argument("--compare", nargs=2, metavar=("A_JSON", "B_JSON"))
    a = ap.parse_args()

    if a.compare:
        compare(*a.compare)
        return
    if bool(a.plugin) == bool(a.cli):
        ap.error("--plugin ou --cli (un seul)")
    overrides = dict(m.split("=", 1) for m in a.map)
    if a.plugin:
        dev = PluginDevice(a.plugin, overrides)
        if a.list:
            print(json.dumps({"params": sorted(dev.params), "map": dev.map, "laws": dev.laws()}, indent=1, ensure_ascii=False))
            return
        missing = [k for k in KEYS if k not in dev.map]
        print(f"parametres trouves : {dev.map}", file=sys.stderr)
        if missing:
            print(f"ATTENTION, non trouves : {missing} (--list pour voir les noms, --map cle=nom)", file=sys.stderr)
    else:
        if not shutil.which(a.cli) and not a.cli.startswith(("/", ".")):
            ap.error(f"{a.cli} introuvable")
        dev = CliDevice(a.cli)
    t0 = time.time()
    res = {
        "version": 1,
        "date": time.strftime("%Y-%m-%d %H:%M"),
        "sample_rate": SR,
        "quick": a.quick,
        "device": dev.info(),
        "laws": dev.laws(),
    }
    print("latency", file=sys.stderr)
    res["latency"] = m_latency(dev)
    print("harmonics", file=sys.stderr)
    res["harmonics"] = m_harmonics(dev, a.quick)
    print("autogain", file=sys.stderr)
    res["autogain"] = m_autogain(dev, a.quick)
    print("response", file=sys.stderr)
    res["response"] = m_response(dev, a.quick)
    print("burst", file=sys.stderr)
    res["burst"] = m_burst(dev)
    res["seconds"] = round(time.time() - t0, 1)
    out = a.out or f"{'decapitator' if a.plugin else 'mm-disto'}.json"
    with open(out, "w") as fh:
        json.dump(res, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print(f"{out} ecrit ({res['seconds']} s)", file=sys.stderr)


if __name__ == "__main__":
    main()
