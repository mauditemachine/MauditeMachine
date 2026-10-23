import numpy as np
from ana import load, jload, jsave, db, save, plt, SR, spectrum, hilbert_env

man = jload("selfosc/manifest.json")
out = {"threshold": [], "steady": []}

# ---- A) growth rate of a tiny ringing (dB/s), linear regime ----
rows = {}
for m in man["thr"]:
    x = load(m["file"]).astype(np.float64)
    seg = x[m["at"] + 200:]
    env = hilbert_env(seg)
    # RMS per 10 ms frame, fit a line to log level over 0.05..0.9 s (still tiny, linear)
    fr = 480
    nfr = len(seg) // fr
    lv = np.array([np.sqrt(np.mean(seg[i * fr:(i + 1) * fr] ** 2)) for i in range(nfr)])
    t = (np.arange(nfr) + 0.5) * fr / SR
    sel = (t > 0.05) & (t < 0.9) & (lv > 1e-14)
    slope = np.polyfit(t[sel], db(lv[sel]), 1)[0] if sel.sum() > 5 else np.nan
    rows.setdefault((m["cutoff"], m["os"]), []).append((m["res"], slope))
for (fc, os), lst in sorted(rows.items()):
    lst.sort()
    r = np.array([a for a, _ in lst])
    s = np.array([b for _, b in lst])
    # threshold: linear interpolation of the zero crossing of the growth rate
    thr = None
    for i in range(len(r) - 1):
        if s[i] < 0 <= s[i + 1]:
            thr = float(r[i] + (0 - s[i]) * (r[i + 1] - r[i]) / (s[i + 1] - s[i]))
            break
    out["threshold"].append({"cutoff": fc, "os": os, "res_threshold": thr, "rates_db_s": {f"{a:.3f}": float(b) for a, b in lst}})

fig, ax = plt.subplots(figsize=(6.5, 3.6))
for (fc, os), lst in sorted(rows.items()):
    lst.sort()
    ax.plot([a for a, _ in lst], [b for _, b in lst], "-" if os == 4 else "--", label=f"{fc} Hz x{os}")
ax.axhline(0, color="k", lw=0.6)
ax.axvline(0.9, color="k", lw=0.6, ls=":")
ax.set_xlabel("RES")
ax.set_ylabel("growth of a tiny ringing, dB/s")
ax.set_ylim(-400, 400)
ax.legend(ncol=2)
ax.set_title("Self-oscillation threshold (MOOG): where the ringing stops decaying")
save(fig, "selfosc_threshold.png")

# ---- B) steady state ----
for m in man["ss"]:
    x = load(m["file"]).astype(np.float64)
    env = hilbert_env(x)
    k = 480
    lv = np.array([np.sqrt(np.mean(x[i * k:(i + 1) * k] ** 2)) for i in range(len(x) // k)])
    final = np.median(lv[-50:])
    t = (np.arange(len(lv)) + 0.5) * k / SR
    reach = np.where(lv >= final * 10 ** (-3 / 20))[0]
    t_build = float(t[reach[0]]) if len(reach) and final > 1e-6 else None
    seg = x[int(1.4 * SR):int(1.4 * SR) + 32768]
    f, a = spectrum(seg, n=32768)
    i = np.argmax(a[5:]) + 5
    # parabolic interpolation on log amplitude
    y0, y1, y2 = np.log(a[i - 1] + 1e-30), np.log(a[i] + 1e-30), np.log(a[i + 1] + 1e-30)
    dlt = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)
    fo = (i + dlt) * SR / 32768
    amp1 = a[i]
    harms = []
    for h in range(2, 8):
        if h * fo < 23000:
            j = int(round(h * fo * 32768 / SR))
            harms.append(float(db(a[max(0, j - 3):j + 4].max()) - db(amp1)))
    hp = sum(10 ** (v / 10) for v in harms)
    out["steady"].append({
        "mode": ["MOOG", "LP12"][m["fmode"]], "cutoff": m["cutoff"], "res": m["res"], "os": m["os"],
        "freq_hz": float(fo), "cents": float(1200 * np.log2(fo / m["cutoff"])) if final > 1e-6 else None,
        "level_dbfs": float(db(amp1)), "rms_dbfs": float(db(final)), "thd_db": float(10 * np.log10(hp)) if hp > 0 else None,
        "h2_dbc": harms[0] if harms else None, "h3_dbc": harms[1] if len(harms) > 1 else None,
        "build_s": t_build,
    })
jsave("selfosc/results.json", out)

# plots: cents error vs cutoff, level vs cutoff, harmonics
st = out["steady"]
fig, axs = plt.subplots(1, 3, figsize=(13, 3.6))
for res in [0.9, 0.92, 0.95, 0.97, 1.0]:
    for os, ls in ((4, "-"), (2, "--")):
        rr = [s for s in st if s["res"] == res and s["os"] == os and s["mode"] == "MOOG" and s["cents"] is not None]
        if not rr:
            continue
        fc = [s["cutoff"] for s in rr]
        axs[0].semilogx(fc, [s["cents"] for s in rr], ls, marker="o", ms=3, label=f"RES {res} x{os}")
        axs[1].semilogx(fc, [s["level_dbfs"] for s in rr], ls, marker="o", ms=3, label=f"RES {res} x{os}")
        axs[2].semilogx(fc, [s["thd_db"] for s in rr], ls, marker="o", ms=3, label=f"RES {res} x{os}")
axs[0].set_ylabel("pitch error re cutoff (cents)")
axs[1].set_ylabel("level of the oscillation (dBFS, engine out)")
axs[2].set_ylabel("THD of the oscillation (dB re fundamental)")
for ax in axs:
    ax.set_xlabel("cutoff Hz")
axs[0].legend(fontsize=6, ncol=2)
fig.suptitle("Self-oscillation, MOOG, NOISE seed 0.003, no oscillator")
save(fig, "selfosc_steady.png")

# one waveform close-up and spectrum for 1 kHz RES 1.0 vs 0.95
fig, axs = plt.subplots(1, 2, figsize=(12, 3.4))
for res in [0.92, 0.95, 1.0]:
    x = load(f"selfosc/ss_m0_f1000_r{res if res != 1.0 else 1}_os4.npy").astype(np.float64)
    seg = x[int(1.5 * SR):int(1.5 * SR) + 240]
    axs[0].plot(np.arange(240) / SR * 1000, seg, label=f"RES {res}")
    f, a = spectrum(x[int(1.4 * SR):int(1.4 * SR) + 32768], n=32768)
    axs[1].semilogx(f[1:], db(a[1:]), lw=0.7, label=f"RES {res}")
axs[0].set_xlabel("ms")
axs[0].legend()
axs[1].set_xlim(100, 24000)
axs[1].set_ylim(-160, 0)
axs[1].set_xlabel("Hz")
axs[1].set_ylabel("dBFS")
axs[1].legend()
axs[0].set_title("self-oscillation waveform, cutoff 1 kHz")
axs[1].set_title("its spectrum")
save(fig, "selfosc_wave.png")
for o in out["threshold"]:
    print(o["cutoff"], o["os"], o["res_threshold"])
for s in st:
    if s["mode"] == "MOOG" and s["os"] == 4:
        print(s)
for s in st:
    if s["mode"] == "LP12" or s["os"] == 2:
        if s["cutoff"] in (110, 1000, 8000, 16000):
            print(s)
