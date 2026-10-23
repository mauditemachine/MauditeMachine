import numpy as np
from scipy.special import jv
from ana import load, jload, jsave, db, lsq_tones, save, plt, power_spectrum

man = jload("osc/manifest.json")
cases = {c["name"]: c for c in man["cases"]}
midi_hz = lambda m: 440 * 2 ** ((m - 69) / 12)


def ideal(name, n):
    k = np.arange(1, n + 1)
    if "SINE" == name:
        return np.where(k == 1, 1.0, 0.0)
    if name == "TRI":
        return np.where(k % 2 == 1, 8 / (np.pi ** 2 * k ** 2), 0.0)
    if name == "SAW":
        return 2 / (np.pi * k)
    if name == "SQUARE":
        return np.where(k % 2 == 1, 4 / (np.pi * k), 0.0)
    if name == "PULSE":
        return 4 / (np.pi * k) * np.abs(np.sin(np.pi * k * 0.14))
    if name.startswith("PWM"):
        frac = {"PWM 25%": 0.25, "PWM 50%": 0.5, "PWM 75%": 0.75}[name]
        d = 0.5 - (0.5 - 0.14) * frac
        return 4 / (np.pi * k) * np.abs(np.sin(np.pi * k * d))
    return None


def analyse(c, nh=40):
    x = load(c["file"]).astype(np.float64)
    sr = 48000 * c["os"]
    f0 = midi_hz(c["midi"])
    if c["name"].startswith("sub_"):
        f0 = f0 / (2 if c["params"]["subOct"] == 1 else 4)
    if "_r3.5" in c["name"]:
        f0 = f0 / 2
    # an integer number of periods from 0.2 s
    per = sr / f0
    s0 = int(0.2 * sr)
    nper = int((len(x) - s0 - 10) / per)
    n = int(nper * per)
    seg = x[s0:s0 + n]
    fr = [f0 * k for k in range(1, nh + 1) if f0 * k < sr / 2.2]
    amp, ph, res = lsq_tones(seg, fr, sr=sr)
    # DC: plain mean over whole periods
    dc = float(np.mean(seg))
    return x, sr, f0, amp, ph, dc, seg


out = {"shapes": [], "sync": [], "fm": [], "sub": [], "noise": {}}
W = ["SINE", "SINE>TRI", "TRI", "TRI>SAW", "SAW", "SAW>SQR", "SQUARE", "PWM 25%", "PWM 50%", "PWM 75%", "PULSE", "PULSE>FM", "FM"]
fig, axs = plt.subplots(3, 5, figsize=(15, 7.5))
axs = axs.ravel()
for i, lab in enumerate(W):
    key = "w1_" + "".join(ch if ch.isalnum() else "_" for ch in lab)
    key = key.replace("__", "_")
    for a in ("A2", "A5"):
        name = f"{key}_{a}".replace("__", "_")
        c = cases.get(name) or next(v for k, v in cases.items() if k.startswith(key) and k.endswith(a))
        x, sr, f0, amp, ph, dc, seg = analyse(c)
        idl = ideal(lab, len(amp))
        row = {"wave": lab, "note": a, "dc": dc, "h1": float(amp[0]), "h1_phase_deg": float(np.degrees(ph[0])),
               "rms": float(np.sqrt(np.mean(seg ** 2))), "peak": float(np.max(np.abs(seg)))}
        if idl is not None:
            ok = idl > 1e-6
            dev = db(amp[ok]) - db(idl[ok])
            row["max_dev_db_first20"] = float(np.max(np.abs(dev[:20])))
            hz = (np.arange(1, len(amp) + 1) * f0)[ok]
            row["dev_db_at"] = {f"{int(h)}Hz": float(d) for h, d in zip(hz, dev) if h in (hz[0],) or abs(h - 5000) < f0 / 2 or abs(h - 10000) < f0 / 2 or abs(h - 15000) < f0 / 2 or abs(h - 19000) < f0 / 2}
            zero = ~ok
            if zero.any():
                row["missing_harm_max_dbc"] = float(db(np.max(amp[zero])) - db(amp[0]))
        out["shapes"].append(row)
        if a == "A2":
            per = int(round(sr / f0))
            axs[i].plot(np.arange(2 * per) / sr * 1000, seg[:2 * per], lw=1)
            axs[i].set_title(f"{lab}  DC {dc:+.4f}", fontsize=8)
axs[13].axis("off")
axs[14].axis("off")
save(fig, "osc_shapes.png")

# spectra vs ideal for SAW / SQUARE / TRI / PULSE at A5 (880 Hz)
fig, axs = plt.subplots(1, 4, figsize=(15, 3.4))
for j, lab in enumerate(["SAW", "SQUARE", "TRI", "PULSE"]):
    c = cases[f"w1_{lab}_A5"]
    x, sr, f0, amp, ph, dc, seg = analyse(c, nh=27)
    k = np.arange(1, len(amp) + 1)
    idl = ideal(lab, len(amp))
    axs[j].plot(k * f0, db(amp), "o", ms=3, label="measured (x4, at the filter input)")
    axs[j].plot(k * f0, db(idl), "k_", ms=8, label="ideal")
    axs[j].set_title(f"{lab} A5 harmonics")
    axs[j].set_ylim(-80, 5)
    axs[j].set_xlabel("Hz")
axs[0].legend(fontsize=7)
save(fig, "osc_harmonics.png")

# SYNC vs an ideal hard-synced saw (Fourier of a finely sampled period)
for semi in (7, 12, 19):
    for wv in ("saw", "sqr"):
        c = cases[f"sync_{wv}_{semi}_A2"]
        x, sr, f0, amp, ph, dc, seg = analyse(c, nh=60)
        r = 2 ** (semi / 12)
        t = np.arange(1 << 16) / (1 << 16)
        p = (r * t) % 1.0
        ref = (1 - 2 * p) if wv == "saw" else np.where(p < 0.5, 1.0, -1.0)
        R = np.abs(np.fft.rfft(ref)) / (1 << 15)
        idl = R[1:len(amp) + 1]
        dev = db(amp) - db(idl)
        sel = idl > 1e-3
        out["sync"].append({"wave": wv, "semi": semi, "max_dev_db_first30": float(np.max(np.abs(dev[:30][sel[:30]]))), "rms_dev_db_first30": float(np.sqrt(np.mean(dev[:30][sel[:30]] ** 2))), "dc": dc})
# FM vs Bessel
for fm in (0.3, 0.6, 1):
    for ratio in (1, 2, 3.5):
        c = cases[f"fm_{fm}_r{ratio}_A2"]
        x, sr, f0, amp, ph, dc, seg = analyse(c, nh=60)
        fc = midi_hz(c["midi"])
        I = 6 * fm * fm
        # spectrum lines at |fc + n * ratio * fc|; collect predicted amplitudes per harmonic of f0
        pred = np.zeros(len(amp))
        for nn in range(-60, 61):
            fl = fc + nn * ratio * fc
            hk = int(round(abs(fl) / f0))
            if 1 <= hk <= len(amp) and abs(abs(fl) - hk * f0) < 1e-6 * fc:
                sgn = -1 if fl < 0 else 1
                pred[hk - 1] += sgn * jv(nn, I)  # crude sum of same-frequency lines (phase signs approximate)
        pred = np.abs(pred)
        top = np.argsort(pred)[-6:]
        out["fm"].append({"fm": fm, "ratio": ratio, "index_rad": I, "top_lines_meas_vs_bessel_db": {int((k + 1) * f0): [float(db(amp[k])), float(db(pred[k]))] for k in sorted(top)}, "dc": dc})
for c in man["cases"]:
    if c["name"].startswith("sub_"):
        x, sr, f0, amp, ph, dc, seg = analyse(c, nh=20)
        out["sub"].append({"case": c["name"], "f0": f0, "h1": float(amp[0]), "dc": dc, "h2_dbc": float(db(amp[1]) - db(amp[0])), "h3_dbc": float(db(amp[2]) - db(amp[0]))})
# NOISE: level and spectral tilt (sample-and-hold at the context rate)
for nm, os in (("noise", 4), ("noise_os2", 2)):
    x = load(cases[nm]["file"]).astype(np.float64)
    sr = 48000 * os
    f, p = power_spectrum(x[int(0.1 * sr):], n=1 << 16, sr=sr)
    band = lambda lo, hi: 10 * np.log10(np.mean(p[(f >= lo) & (f < hi)]))
    ref = band(200, 2000)
    out["noise"][nm] = {"rms": float(np.sqrt(np.mean(x[int(0.1 * sr):] ** 2))), "tilt_db": {"5k": band(4500, 5500) - ref, "10k": band(9500, 10500) - ref, "15k": band(14500, 15500) - ref, "20k": band(19000, 20000) - ref, "30k_image": band(29000, 31000) - ref}}
# the default pair
c = cases["default_pair_A2"]
x = load(c["file"]).astype(np.float64)
out["default_pair"] = {"peak": float(np.max(np.abs(x[int(0.2 * 192000):]))), "rms": float(np.sqrt(np.mean(x[int(0.2 * 192000):] ** 2)))}
jsave("osc/results.json", out)
for r in out["shapes"]:
    print({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()})
for k in ("sync", "fm", "sub"):
    for r in out[k]:
        print(k, r)
print(out["noise"], out["default_pair"])
