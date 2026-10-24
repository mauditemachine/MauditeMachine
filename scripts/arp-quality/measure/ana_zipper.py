import numpy as np
from scipy.signal import hilbert, butter, sosfiltfilt, stft
from ana import load, jload, jsave, db, save, plt, SR, spectrum

man = jload("zipper/manifest.json")
out = {"A": [], "sweep": []}
by = {}
for c in man["cases"]:
    by.setdefault(c["name"], {})[c["kind"]] = c

# A) the self-oscillation pitch path
fig, axs = plt.subplots(1, 2, figsize=(13, 3.6))
ref = None
for kind, c in by["A_selfosc_cutoff"].items():
    x = load(c["file"]).astype(np.float64)
    # band-pass 700 Hz .. 6 kHz then the analytic phase
    sos = butter(4, [700, 6000], "bandpass", fs=SR, output="sos")
    y = sosfiltfilt(sos, x)
    ph = np.unwrap(np.angle(hilbert(y)))
    fi = np.diff(ph) * SR / (2 * np.pi)
    k = 96
    fi = fi[: len(fi) // k * k].reshape(-1, k).mean(axis=1)  # 500 Hz frame rate
    t = (np.arange(len(fi)) + 0.5) * k / SR
    cents = 1200 * np.log2(np.maximum(fi, 1) / 1000)
    if kind == "smooth":
        ref = cents
    axs[0].plot(t, cents, lw=0.8, label=kind)
    if ref is not None:
        axs[1].plot(t, cents - ref, lw=0.8, label=kind)
    sel = (t > c["t0"] + 0.05) & (t < c["t1"] - 0.05)
    if ref is not None:
        dev = cents[sel] - ref[sel]
        # the staircase seen in the pitch: the part of the path above 8 Hz (a smooth sweep has almost none)
        hpd = cents[sel] - np.convolve(cents[sel], np.ones(100) / 100, mode="same")
        out["A"].append({"kind": kind, "dev_rms_cents": float(np.sqrt(np.mean(dev ** 2))), "dev_max_cents": float(np.max(np.abs(dev))), "ripple_rms_cents": float(np.sqrt(np.mean(hpd[60:-60] ** 2)))})
axs[0].set_xlim(0.7, 2.1)
axs[0].set_ylabel("self-oscillation pitch (cents re 1 kHz)")
axs[0].set_ylim(-200, 2600)
axs[0].set_xlabel("s")
axs[0].legend(fontsize=7)
axs[0].set_title("CUTOFF 1 -> 4 kHz at RES 1.0: the pitch follows the knob")
axs[1].set_xlim(0.8, 2.0)
axs[1].set_ylim(-80, 80)
axs[1].set_ylabel("cents re the smooth sweep")
axs[1].set_xlabel("s")
axs[1].legend(fontsize=7)
axs[1].set_title("deviation from a per-block smooth sweep (7-bit step = 88 cents)")

# B..F: sidebands / roughness the steps add, measured as the energy of (stepped - smooth) spectrogram difference
# relative to the smooth render, plus a modulation index: the output envelope's spectrum from 20 to 200 Hz
def env_mod(x, t0, t1):
    s0, s1 = int(t0 * SR), int(t1 * SR)
    e = np.abs(hilbert(x[s0:s1]))
    e = e[: len(e) // 48 * 48].reshape(-1, 48).mean(axis=1)  # 1 kHz
    le = np.log(np.maximum(e, 1e-9))
    trend = np.convolve(le, np.ones(101) / 101, mode="same")
    r = (le - trend)[60:-60]
    from scipy.signal import welch
    f, P = welch(r, fs=1000, nperseg=256)
    band = (f >= 20) & (f <= 200)
    return float(10 * np.log10(np.sum(P[band]) + 1e-30)), float(np.sqrt(np.mean(r ** 2)) * 8.686)


for name in ["B_saw_cutoff_res08", "C_sine_osc1_level", "D_saw_res", "E_sine_drive", "F_wave_morph"]:
    cs = by[name]
    xs = {k: load(c["file"]).astype(np.float64) for k, c in cs.items()}
    t0, t1 = cs["smooth"]["t0"], cs["smooth"]["t1"]
    # spectrogram difference: |S_k| - |S_smooth| in dB, averaged in the sweep, above the smooth level
    f, tt, S0 = stft(xs["smooth"], fs=SR, nperseg=2048, noverlap=1536)
    A0 = np.abs(S0)
    sel = (tt > t0 + 0.05) & (tt < t1 - 0.05)
    for kind, x in xs.items():
        f, tt, S = stft(x, fs=SR, nperseg=2048, noverlap=1536)
        A = np.abs(S)
        diff = np.abs(A[:, sel] - A0[:, sel])
        rel = 10 * np.log10(np.sum(diff ** 2) / np.sum(A0[:, sel] ** 2))
        em, er = env_mod(x, t0, t1)
        out["sweep"].append({"case": name, "kind": kind, "spectral_diff_db": float(rel), "env_mod_20_200Hz_db": em, "env_ripple_rms_db": er})
jsave("zipper/results.json", out)
save(fig, "zipper_selfosc.png")
for r in out["A"]:
    print("A", r)
for r in out["sweep"]:
    print(r)
