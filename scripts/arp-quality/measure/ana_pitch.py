import numpy as np
from scipy.signal import hilbert
from ana import load, jload, jsave, db, save, plt, SR

man = jload("pitch/manifest.json")


def f0_phase(x, fexp, sr=SR):
    """Fundamental frequency by phase regression of the band-passed analytic signal."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / sr)
    X[(f < fexp * 0.8) | (f > fexp * 1.2)] = 0
    y = np.fft.irfft(X, n)
    a = hilbert(y)
    ph = np.unwrap(np.angle(a))
    t = np.arange(n) / sr
    sel = slice(n // 8, n - n // 8)
    slope = np.polyfit(t[sel], ph[sel], 1)[0]
    return slope / (2 * np.pi), float(np.sqrt(np.mean(y[sel] ** 2)) * np.sqrt(2))


rows = []
for m in man["notes"]:
    x = load(m["file"]).astype(np.float64)[int(0.15 * SR):]
    rms = float(np.sqrt(np.mean(x ** 2)))
    if m.get("beyond"):
        rows.append({**m, "rms_dbfs": float(db(rms)), "peak_dbfs": float(db(np.max(np.abs(x))))})
        continue
    if m["f"] < 23000:
        fm, a1 = f0_phase(x, m["f"])
        rows.append({**m, "f_meas": fm, "cents": float(1200 * np.log2(fm / m["f"])), "rms_dbfs": float(db(rms)), "h1_dbfs": float(db(a1))})
    else:
        rows.append({**m, "rms_dbfs": float(db(rms))})

out = {"notes": rows}
# default patch across the keyboard
dd = []
for m in man["def"]:
    x = load(m["file"]).astype(np.float64)
    dd.append({"midi": m["midi"], "peak_dbfs": float(db(np.max(np.abs(x)))), "rms_dbfs": float(db(np.sqrt(np.mean(x[480:int(0.08 * SR)] ** 2))))})
out["default_patch"] = dd
# key tracking: slope (octaves of cutoff per octave of note) by linear fit in log
tr = []
for t in man["track"]:
    notes = np.array(t["notes"], float)
    fc = np.array(t["fc"], float)
    ok = (fc > 25) & (fc < 21000)
    sl = np.polyfit(notes[ok] / 12, np.log2(fc[ok]), 1)[0]
    pred = 1000 * 2 ** (t["kt"] * (notes - 54) / 12)
    dev = 1200 * np.log2(fc / np.clip(pred, 20, 21600))
    tr.append({"drift": t["drift"], "keyTrack": t["kt"], "slope_oct_per_oct": float(sl), "fc_at_12": float(fc[0]), "fc_at_120": float(fc[-1]),
               "max_dev_cents": float(np.max(np.abs(dev[ok]))), "rms_dev_cents": float(np.sqrt(np.mean(dev[ok] ** 2)))})
out["keytrack"] = tr
jsave("pitch/results.json", out)

fig, axs = plt.subplots(1, 3, figsize=(13, 3.6))
for wave in ["sine", "saw"]:
    for os, ls in ((4, "-"), (2, "--")):
        rr = [r for r in rows if r["wave"] == wave and r["os"] == os and "cents" in r]
        axs[0].plot([r["midi"] for r in rr], [r["cents"] for r in rr], ls, label=f"{wave} x{os}")
        axs[1].plot([r["midi"] for r in rr], [r["h1_dbfs"] - db(0.05 * 1.25) for r in rr], ls, label=f"{wave} x{os}")
axs[0].set_ylabel("pitch error (cents)")
axs[0].set_xlabel("MIDI note")
axs[1].set_ylabel("fundamental level re ideal (dB)")
axs[1].set_xlabel("MIDI note")
axs[0].legend()
axs[1].legend()
axs[1].set_ylim(-8, 1)
axs[2].plot([d["midi"] for d in dd], [d["peak_dbfs"] for d in dd], label="peak")
axs[2].plot([d["midi"] for d in dd], [d["rms_dbfs"] for d in dd], label="RMS (first 80 ms)")
axs[2].set_title("INIT patch, one 1/16 note per key")
axs[2].set_xlabel("MIDI note")
axs[2].set_ylabel("dBFS (engine out, before VOLUME)")
axs[2].legend()
save(fig, "pitch_level.png")

fig, ax = plt.subplots(figsize=(6, 3.6))
for t in man["track"]:
    if t["drift"] == 0:
        ax.semilogy(t["notes"], t["fc"], marker="o", ms=2, label=f"KEY TRACK {t['kt']}")
ax.axvline(54, color="k", ls=":", lw=0.6)
ax.set_xlabel("MIDI note")
ax.set_ylabel("cutoff the voice computes (Hz), CUTOFF = 1 kHz")
ax.legend()
save(fig, "keytrack.png")
for r in rows:
    if r["midi"] in (12, 24, 36, 48, 60, 72, 84, 96, 108, 115, 120, 127) or r.get("beyond"):
        print({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items() if k != "file"})
for t in tr:
    print(t)
for d in dd[::4]:
    print(d)
