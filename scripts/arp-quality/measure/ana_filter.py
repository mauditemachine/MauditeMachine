import numpy as np
from ana import load, jload, jsave, db, lsq_tones, save, plt, SR, spectrum

man = jload("filter/manifest.json")
MODES = ["MOOG", "LP12", "BP", "HP"]
res_list = [0, 0.3, 0.6, 0.8, 0.9, 1.0]
colors = plt.cm.viridis(np.linspace(0, 0.9, len(res_list)))

# ---- impulses ----
imp = {}
for m in man["imp"]:
    x = load(m["file"]).astype(np.float64)
    seg = x[m["at"] - 64:]
    n = 1 << 17
    H = np.fft.rfft(seg[:n] if len(seg) >= n else np.pad(seg, (0, n - len(seg))))
    f = np.fft.rfftfreq(n, 1 / SR)
    mag = np.abs(H) / m["amp"]
    # growth / decay: envelope in the first 50 ms vs 1.5-2 s
    e0 = np.sqrt(np.mean(seg[200:2400] ** 2))
    e1 = np.sqrt(np.mean(seg[-24000:] ** 2))
    imp[(m["fmode"], m["cutoff"], m["res"], m["os"])] = (f, mag, float(db(e1) - db(e0)), float(np.max(np.abs(x))))

# ---- tones ----
tones = {}
for m in man["tones"]:
    x = load(m["file"]).astype(np.float64)
    seg = x[int(0.45 * SR):int(1.15 * SR)]
    amp, ph, resid = lsq_tones(seg, m["freqs"])
    key = (m["fmode"], m["cutoff"], m["res"], m["os"])
    d = tones.setdefault(key, {"f": [], "g": [], "resid": []})
    d["f"] += list(m["freqs"])
    d["g"] += list(amp / m["amp"])
    # residual: what is not the test tones (self-oscillation, distortion)
    d["resid"].append(float(np.sqrt(np.mean(resid ** 2))))
for k, d in tones.items():
    o = np.argsort(d["f"])
    d["f"] = np.array(d["f"])[o]
    d["g"] = np.array(d["g"])[o]


def interp_db(f, mag, fq):
    return float(np.interp(np.log(fq), np.log(np.maximum(f[1:], 1e-9)), db(mag[1:])))


results = {"impulse": [], "tones": []}
for (fm, fc, r, os), (f, mag, growth, pk) in sorted(imp.items()):
    band = (f > 15) & (f < 20000)
    i = np.argmax(mag * band)
    row = {"mode": MODES[fm], "cutoff": fc, "res": r, "os": os, "peak_db": float(db(mag[i])), "peak_hz": float(f[i]),
           "growth_db_2s": growth, "self_osc": bool(growth > -3)}
    if fm in (0, 1):
        pb = max(20.0, fc / 10)
        row["passband_db"] = interp_db(f, mag, pb)
        row["at_fc_db"] = interp_db(f, mag, fc)
        if 8 * fc < 20000:
            row["slope_db_oct_4to8fc"] = interp_db(f, mag, 8 * fc) - interp_db(f, mag, 4 * fc)
        # -3 dB point re passband
        lvl = db(mag)
        above = np.where((f > pb) & (lvl < row["passband_db"] - 3))[0]
        row["f_3db"] = float(f[above[0]]) if len(above) else None
    elif fm == 2:
        row["at_fc_db"] = interp_db(f, mag, fc)
        lvl = db(mag)
        half = np.where((band) & (lvl > lvl[i] - 3))[0]
        row["bw_oct"] = float(np.log2(f[half[-1]] / f[half[0]])) if len(half) > 1 else None
        if fc / 16 > 15:
            row["slope_low_db_oct"] = interp_db(f, mag, fc / 8) - interp_db(f, mag, fc / 16)
        if 16 * fc < 20000:
            row["slope_high_db_oct"] = interp_db(f, mag, 16 * fc) - interp_db(f, mag, 8 * fc)
    else:
        pb = min(18000.0, fc * 10)
        row["passband_db"] = interp_db(f, mag, pb)
        row["at_fc_db"] = interp_db(f, mag, fc)
        if fc / 16 > 15:
            row["slope_db_oct_low"] = interp_db(f, mag, fc / 8) - interp_db(f, mag, fc / 16)
    results["impulse"].append(row)

for (fm, fc, r, os), d in sorted(tones.items()):
    f, g = d["f"], d["g"]
    row = {"mode": MODES[fm], "cutoff": fc, "res": r, "os": os, "max_db": float(db(g.max())), "max_hz": float(f[np.argmax(g)]),
           "lowest_db": float(db(g[0])), "resid_rms_db": float(db(np.mean(d["resid"])))}
    results["tones"].append(row)

jsave("filter/results.json", results)

# ---- plots: one figure per mode, three cutoffs ----
for fm in range(4):
    fig, axs = plt.subplots(1, 3, figsize=(13, 3.8), sharey=True)
    for j, fc in enumerate([100, 1000, 5000]):
        ax = axs[j]
        for ci, r in enumerate(res_list):
            f, mag, growth, pk = imp[(fm, fc, r, 4)]
            sel = (f > 10) & (f < 24000)
            if growth < -3:
                ax.semilogx(f[sel], db(mag[sel]), color=colors[ci], lw=1.2, label=f"RES {r}")
            t = tones[(fm, fc, r, 4)]
            ax.semilogx(t["f"], db(t["g"]), "o", ms=2.5, color=colors[ci], label=(f"RES {r} (sines)" if growth >= -3 else None))
        ax.axvline(fc, color="k", lw=0.6, ls=":")
        ax.set_title(f"{MODES[fm]}  cutoff {fc} Hz (x4)")
        ax.set_xlabel("Hz")
        ax.set_xlim(10, 24000)
        ax.set_ylim(-80, 40)
    axs[0].set_ylabel("gain dB (line: impulse, dots: sines 0.01)")
    axs[2].legend(loc="lower left", ncol=2)
    save(fig, f"filter_{MODES[fm]}.png")

# x4 vs x2 at 5 kHz, MOOG and HP
fig, axs = plt.subplots(1, 2, figsize=(11, 3.6))
for j, fm in enumerate([0, 3]):
    ax = axs[j]
    for ci, r in enumerate([0, 0.6, 0.8]):
        for os, ls in ((4, "-"), (2, "--")):
            f, mag, growth, pk = imp[(fm, 5000, r, os)]
            sel = (f > 100) & (f < 24000)
            ax.semilogx(f[sel], db(mag[sel]), ls, color=colors[[0, 2, 3][ci]], lw=1, label=f"RES {r} x{os}")
    ax.set_title(f"{MODES[fm]} cutoff 5 kHz, x4 (solid) vs x2 (dashed)")
    ax.set_ylim(-60, 30)
    ax.legend()
save(fig, "filter_os_compare.png")
print("ok")
for row in results["impulse"]:
    if row["os"] == 4:
        print(row)
