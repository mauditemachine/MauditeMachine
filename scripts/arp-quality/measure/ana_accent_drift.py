import numpy as np
from scipy.signal import hilbert, welch
from ana import load, jload, jsave, db, save, plt, SR, power_spectrum

man = jload("accent/manifest.json")
out = {"acc": [], "drift": [], "scatter": {}}
ACC = [0.4, 0.6, 0.8, 0.92, 1.0, 1.12, 1.24, 1.35]
fig, axs = plt.subplots(1, 3, figsize=(14, 3.6))
for m in man["acc"]:
    x = load(m["file"]).astype(np.float64)
    per = {a: {"peak": [], "rms": [], "cent": [], "hi": []} for a in ACC}
    for n in m["notes"][8:]:  # skip the first round (GLUE's level tracker settles)
        s = int(n["time"] * SR)
        e = s + int(0.1 * SR)
        seg = x[s:e]
        f, p = power_spectrum(seg, n=4096)
        per[n["accent"]]["peak"].append(np.max(np.abs(seg)))
        per[n["accent"]]["rms"].append(np.sqrt(np.mean(seg[:int(0.05 * SR)] ** 2)))
        per[n["accent"]]["cent"].append(np.sum(f * p) / np.sum(p))
        per[n["accent"]]["hi"].append(np.sum(p[(f > 1000) & (f < 8000)]))
    row = {"accFlt": m["accFlt"], "glue": m["glue"], "by_accent": {}}
    for a in ACC:
        row["by_accent"][str(a)] = {"peak_dbfs": float(db(np.mean(per[a]["peak"]))), "rms_dbfs": float(db(np.mean(per[a]["rms"]))), "centroid_hz": float(np.mean(per[a]["cent"])), "hi_db": float(10 * np.log10(np.mean(per[a]["hi"])))}
    b = row["by_accent"]
    row["rms_range_db"] = b["1.35"]["rms_dbfs"] - b["0.4"]["rms_dbfs"]
    row["rms_range_0.8_1.12_db"] = b["1.12"]["rms_dbfs"] - b["0.8"]["rms_dbfs"]
    row["hi_range_db"] = b["1.35"]["hi_db"] - b["0.4"]["hi_db"]
    row["centroid_ratio"] = b["1.35"]["centroid_hz"] / b["0.4"]["centroid_hz"]
    rms = [b[str(a)]["rms_dbfs"] for a in ACC]
    row["monotonic_rms"] = bool(np.all(np.diff(rms) > 0))
    out["acc"].append(row)
    ls = "-" if m["glue"] == 0 else "--"
    axs[0].plot(ACC, [b[str(a)]["rms_dbfs"] for a in ACC], ls, marker="o", ms=3, label=f"ACC FLT {m['accFlt']} GLUE {m['glue']}")
    axs[1].plot(ACC, [b[str(a)]["centroid_hz"] for a in ACC], ls, marker="o", ms=3, label=f"ACC FLT {m['accFlt']} GLUE {m['glue']}")
axs[0].set_xlabel("accent (note force)")
axs[0].set_ylabel("RMS of the first 50 ms (dBFS)")
axs[0].legend(fontsize=6)
axs[1].set_xlabel("accent")
axs[1].set_ylabel("spectral centroid of the first 100 ms (Hz)")

# DRIFT: instantaneous pitch (cents) from the analytic phase, decimated to 1 kHz
for m in man["drift"]:
    x = load(m["file"]).astype(np.float64)
    a = hilbert(x)
    ph = np.unwrap(np.angle(a))
    fi = np.diff(ph) * SR / (2 * np.pi)
    k = 48
    fi = fi[: len(fi) // k * k].reshape(-1, k).mean(axis=1)  # 1 kHz
    c = 1200 * np.log2(np.maximum(fi, 1) / 440.0)
    c = c[200:-1000]  # skip the onset and the analytic-signal edge
    t = np.arange(len(c)) / 1000
    # slow / fast parts
    slow = np.convolve(c, np.ones(500) / 500, mode="same")
    fast = c - slow
    f, P = welch(c - c.mean(), fs=1000, nperseg=8192)
    out["drift"].append({"drift": m["drift"], "osc": m["osc"], "mean_cents": float(c.mean()), "std_cents": float(c.std()), "pp_cents": float(c.max() - c.min()),
                         "std_slow_cents": float(slow[500:-500].std()), "std_fast_cents": float(fast[500:-500].std()),
                         "max_rate_cents_per_s": float(np.max(np.abs(np.diff(slow[500:-500]))) * 1000)})
    if m["drift"] == 1:
        axs[2].plot(t, c, lw=0.6, label=f"OSC {m['osc']}, DRIFT 1 (knob 5)")
    else:
        axs[2].plot(t, c, lw=0.4, alpha=0.6, label=f"OSC {m['osc']}, DRIFT 2 (knob 10)")
axs[2].set_xlabel("s")
axs[2].set_ylabel("cents re A4")
axs[2].legend(fontsize=6)
axs[2].set_title("DRIFT: pitch of a held note")
save(fig, "accent_drift.png")

# per-note scatter
m = man["scatter"][0]
x = load(m["file"]).astype(np.float64)
offs = []
for n in m["notes"]:
    s = int((n["time"] + 0.03) * SR)
    e = int((n["time"] + 0.22) * SR)
    seg = x[s:e]
    a = hilbert(seg)
    ph = np.unwrap(np.angle(a))
    tt = np.arange(len(ph)) / SR
    fq = np.polyfit(tt[100:-100], ph[100:-100], 1)[0] / (2 * np.pi)
    offs.append(1200 * np.log2(fq / 440.0))
offs = np.array(offs)
out["scatter"] = {"n": len(offs), "mean_cents": float(offs.mean()), "std_cents": float(offs.std()), "min": float(offs.min()), "max": float(offs.max())}
jsave("accent/results.json", out)
for r in out["acc"]:
    print({k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items() if k != "by_accent"})
    print("   ", {a: (round(v["rms_dbfs"], 1), round(v["centroid_hz"])) for a, v in r["by_accent"].items()})
for r in out["drift"]:
    print(r)
print(out["scatter"])
