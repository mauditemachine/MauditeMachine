import numpy as np
from ana import load, jload, jsave, db, lsq_tones, save, plt, SR

man = jload("drive/manifest.json")
H = 15


def harmonics(x, f0, nh=H):
    seg = x[int(0.4 * SR):int(1.15 * SR)].astype(np.float64)
    fr = [f0 * k for k in range(1, nh + 1) if f0 * k < 20000]
    amp, ph, res = lsq_tones(seg, fr)
    return amp, float(np.mean(seg)), float(np.sqrt(np.mean(seg ** 2))), res


def summarize(amp):
    a1 = amp[0]
    even = np.sum(amp[1::2] ** 2)
    odd = np.sum(amp[2::2] ** 2)
    thd = np.sqrt(np.sum(amp[1:] ** 2)) / a1
    return {
        "h_dbc": [float(db(a) - db(a1)) for a in amp[1:10]],
        "thd_db": float(db(thd)),
        "thd_pct": float(100 * thd),
        "even_minus_odd_db": float(10 * np.log10(max(even, 1e-30) / max(odd, 1e-30))),
    }


out = {"level": [], "od": [], "imd": []}
for m in man["level"]:
    x = load(m["file"])
    amp, dc, rms, _ = harmonics(x, m["f0"])
    row = {k: m[k] for k in ("filter", "cutoff", "res", "level")}
    row.update(summarize(amp))
    row["h1_dbfs"] = float(db(amp[0]))
    # what a bare tanh of the same amplitude would give (H3 re H1), at the voice VCA (before OUT_GAIN 1.25)
    A = amp[0] / 1.25
    t = np.tanh(A * np.sin(2 * np.pi * np.arange(4096) / 4096))
    T = np.abs(np.fft.rfft(t)) / 2048
    row["tanh_only_h3_dbc"] = float(db(T[3]) - db(T[1]))
    row["gain_db"] = float(db(amp[0]) - db(m["level"] * 1.25))
    out["level"].append(row)
for m in man["od"]:
    x = load(m["file"])
    amp, dc, rms, _ = harmonics(x, m["f0"])
    row = {k: m[k] for k in ("wave", "level", "drive")}
    if m["wave"] == "sine":
        row.update(summarize(amp))
    else:
        # saw: the change of each harmonic re drive 0 is computed below
        row["h_db"] = [float(db(a)) for a in amp[:12]]
    row["rms_dbfs"] = float(db(rms))
    row["dc"] = dc
    out["od"].append(row)
# saw: harmonic change vs drive 0 and loudness change
base = {r["level"]: r for r in out["od"] if r["wave"] == "saw" and r["drive"] == 0}
for r in out["od"]:
    if r["wave"] == "saw":
        b = base[r["level"]]
        r["delta_h_db"] = [round(a - c, 2) for a, c in zip(r["h_db"], b["h_db"])]
        r["rms_change_db"] = r["rms_dbfs"] - b["rms_dbfs"]
for r in out["od"]:
    if r["wave"] == "sine":
        b = [q for q in out["od"] if q["wave"] == "sine" and q["level"] == r["level"] and q["drive"] == 0][0]
        r["rms_change_db"] = r["rms_dbfs"] - b["rms_dbfs"]

for m in man["imd"]:
    x = load(m["file"]).astype(np.float64)[int(0.4 * SR):int(1.15 * SR)]
    f1, f2 = m["f1"], m["f2"]
    prods = {"f1": f1, "f2": f2, "f2-f1": f2 - f1, "2f1-f2": 2 * f1 - f2, "2f2-f1": 2 * f2 - f1, "3f1-2f2": 3 * f1 - 2 * f2, "3f2-2f1": 3 * f2 - 2 * f1, "f1+f2": f1 + f2, "2f1": 2 * f1, "3f1": 3 * f1}
    amp, ph, res = lsq_tones(x, list(prods.values()))
    a = dict(zip(prods.keys(), amp))
    ref = a["f1"] + a["f2"]
    imd2 = a["f2-f1"] / ref
    imd3 = (a["2f1-f2"] + a["2f2-f1"]) / ref
    out["imd"].append({"kind": m["kind"], "level": m["level"], "drive": m["drive"], "d2_db": float(db(imd2)), "d3_db": float(db(imd3)),
                       "d5_db": float(db((a["3f1-2f2"] + a["3f2-2f1"]) / ref)), "sum_db": float(db(a["f1+f2"] / ref)), "h2_db": float(db(a["2f1"] / ref)), "h3_db": float(db(a["3f1"] / ref))})
jsave("drive/results.json", out)

# plots
fig, axs = plt.subplots(1, 3, figsize=(13, 3.6))
for j, fname in enumerate(["open", "res", "res_low"]):
    rr = [r for r in out["level"] if r["filter"] == fname]
    for hk in range(0, 5):
        axs[j].semilogx([r["level"] for r in rr], [r["h_dbc"][hk] for r in rr], marker="o", ms=3, label=f"H{hk + 2}")
    axs[j].semilogx([r["level"] for r in rr], [r["tanh_only_h3_dbc"] for r in rr], "k:", label="H3 of a bare tanh (voice VCA)")
    axs[j].set_title({"open": "filter open (21.6 kHz, RES 0)", "res": "cutoff 2 kHz, RES 0.8", "res_low": "cutoff 400 Hz, RES 0.6"}[fname] + ", sine 110 Hz")
    axs[j].set_xlabel("input level (OSC gain; 1.76 = OSC 1 + OSC 2 at max)")
    axs[j].set_ylim(-140, 0)
axs[0].set_ylabel("harmonic level (dBc)")
axs[0].legend(fontsize=7)
save(fig, "drive_level.png")

fig, axs = plt.subplots(1, 3, figsize=(13, 3.6))
rr = [r for r in out["od"] if r["wave"] == "sine" and r["level"] == 0.62]
for hk in range(0, 6):
    axs[0].plot([r["drive"] for r in rr], [r["h_dbc"][hk] for r in rr], marker="o", ms=3, label=f"H{hk + 2}")
axs[0].set_title("OVERDRIVE, sine 110 Hz at 0.62")
axs[0].set_xlabel("OVERDRIVE")
axs[0].set_ylabel("dBc")
axs[0].legend(fontsize=7)
rr = [r for r in out["od"] if r["wave"] == "saw" and r["level"] == 0.62]
for r in rr:
    axs[1].plot(range(1, 13), r["delta_h_db"], marker="o", ms=3, label=f"OD {r['drive']}")
axs[1].set_title("OVERDRIVE on a saw 110 Hz: harmonic change re OD 0")
axs[1].set_xlabel("harmonic")
axs[1].set_ylabel("dB")
axs[1].legend(fontsize=7)
for lvl in (0.1, 0.62, 0.88):
    rr = [r for r in out["od"] if r["wave"] == "saw" and r["level"] == lvl]
    axs[2].plot([r["drive"] for r in rr], [r["rms_change_db"] for r in rr], marker="o", label=f"saw at {lvl}")
    rr = [r for r in out["od"] if r["wave"] == "sine" and r["level"] == lvl]
    axs[2].plot([r["drive"] for r in rr], [r["rms_change_db"] for r in rr], "--", marker="x", label=f"sine at {lvl}")
axs[2].set_title("level change with OVERDRIVE (RMS re OD 0)")
axs[2].set_xlabel("OVERDRIVE")
axs[2].legend(fontsize=7)
save(fig, "drive_od.png")

for r in out["level"]:
    print("LVL", r["filter"], r["level"], "gain", round(r["gain_db"], 2), "thd%", round(r["thd_pct"], 3), "H2..H5", [round(v, 1) for v in r["h_dbc"][:4]], "tanhH3", round(r["tanh_only_h3_dbc"], 1), "even-odd", round(r["even_minus_odd_db"], 1))
for r in out["od"]:
    if r["wave"] == "sine":
        print("OD sine", r["level"], r["drive"], "thd%", round(r["thd_pct"], 2), "H2..H6", [round(v, 1) for v in r["h_dbc"][:5]], "even-odd", round(r["even_minus_odd_db"], 1), "rms chg", round(r["rms_change_db"], 2), "dc", r["dc"])
    else:
        print("OD saw", r["level"], r["drive"], "dH", r["delta_h_db"][:10], "rms chg", round(r["rms_change_db"], 2), "dc", r["dc"])
for r in out["imd"]:
    print("IMD", r)
