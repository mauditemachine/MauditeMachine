import numpy as np
from scipy.signal import butter, sosfiltfilt
from ana import load, jload, jsave, db, save, plt, SR

man = jload("clicks/manifest.json")
sos = butter(4, 5000, "highpass", fs=SR, output="sos")
rows = []
for c in man["cases"]:
    x = load(c["file"]).astype(np.float64)
    hp = sosfiltfilt(sos, x)
    te = c["te"]
    if te is None or te < 0:
        rows.append({"case": c["name"], "error": "no event time"})
        continue
    i = int(te * SR)
    w0 = max(0, i - int(0.003 * SR))
    w1 = min(len(x), i + int(0.03 * SR))
    note_amp = np.max(np.abs(x[max(0, i - int(0.06 * SR)):i])) if i > int(0.06 * SR) else np.max(np.abs(x))
    if note_amp < 1e-6:
        note_amp = np.max(np.abs(x))
    ev = np.max(np.abs(hp[w0:w1]))
    pre = hp[max(0, i - int(0.06 * SR)):max(0, i - int(0.01 * SR))]
    floor = np.sqrt(np.mean(pre ** 2)) if len(pre) else 0.0
    # periodic events (LFO): the worst edge over the whole note
    if c["name"].startswith("lfo_"):
        ev = np.max(np.abs(hp[int(0.15 * SR):int(0.95 * SR)]))
        floor = np.median(np.abs(hp[int(0.15 * SR):int(0.95 * SR)]))
    post = hp[min(len(x) - 1, i + int(0.04 * SR)):min(len(x), i + int(0.09 * SR))]
    prepk = np.max(np.abs(pre)) if len(pre) else 0.0
    postpk = np.max(np.abs(post)) if len(post) else 0.0
    excess = float(db(ev) - db(max(prepk, postpk, 1e-12)))
    if c["name"].startswith("lfo_"):
        excess = float(db(ev) - db(max(floor, 1e-12)))
    rows.append({"case": c["name"], "excess_db": excess, "click_dbc": float(db(ev) - db(note_amp)), "hf_floor_dbc": float(db(floor) - db(note_amp)) if floor > 0 else None,
                 "click_dbfs_engine": float(db(ev)), "click_dbfs_after_default_volume": float(db(ev * 0.306)), "note": c.get("note", "")})
jsave("clicks/results.json", rows)
for r in sorted(rows, key=lambda r: -r.get("click_dbc", -999)):
    print(f"{r['case']:36s} excess {r.get('excess_db', float('nan')):6.1f} dB  click {r.get('click_dbc', float('nan')):7.1f} dBc  floor {r.get('hf_floor_dbc') if r.get('hf_floor_dbc') is None else round(r['hf_floor_dbc'], 1)}  ({r.get('click_dbfs_after_default_volume', float('nan')):.1f} dBFS after VOLUME)  {r.get('note', '')}")

# plot a few
names = ["on_attack1ms_phase90", "off_release5ms", "steal_1voice", "stop_message", "switch_sync_on_saw7", "switch_keytrack_jump", "lfo_square_cutoff_res08", "voice_cut_res095"]
fig, axs = plt.subplots(2, 4, figsize=(15, 5.5))
for ax, nm in zip(axs.ravel(), names):
    c = next(cc for cc in man["cases"] if cc["name"] == nm)
    x = load(c["file"]).astype(np.float64)
    hp = sosfiltfilt(sos, x)
    te = c["te"]
    i = int(te * SR)
    s = slice(max(0, i - int(0.01 * SR)), min(len(x), i + int(0.03 * SR)))
    t = (np.arange(len(x))[s] - i) / SR * 1000
    ax.plot(t, x[s], lw=0.8, label="out")
    ax.plot(t, hp[s] * 10, lw=0.8, label="HF > 5 kHz x10")
    ax.set_title(nm, fontsize=8)
    ax.set_xlabel("ms re event")
axs[0, 0].legend(fontsize=7)
save(fig, "clicks.png")
