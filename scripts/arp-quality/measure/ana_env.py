import numpy as np
from ana import load, jload, jsave, db, save, plt, SR, hilbert_env

man = jload("env/manifest.json")
out = {"attack": [], "decay": [], "release": [], "fenv": [], "retrig": []}


def env_of(x):
    e = hilbert_env(x.astype(np.float64))
    # smooth over one cycle of the 1 kHz carrier
    k = 48
    return np.convolve(e, np.ones(k) / k, mode="same")


def first_cross(e, thr, start=0):
    idx = np.where(e[start:] >= thr)[0]
    return (start + idx[0]) / SR if len(idx) else None


def first_below(e, thr, start=0):
    idx = np.where(e[start:] <= thr)[0]
    return (start + idx[0]) / SR if len(idx) else None


fig, axs = plt.subplots(1, 3, figsize=(14, 3.8))
for m in man["attack"]:
    x = load(m["file"])
    e = env_of(x)
    s0 = int(m["t0"] * SR)
    pk = np.max(e[s0:])
    t10 = first_cross(e, 0.1 * pk, s0) - m["t0"]
    t50 = first_cross(e, 0.5 * pk, s0) - m["t0"]
    t90 = first_cross(e, 0.9 * pk, s0) - m["t0"]
    t99 = first_cross(e, 0.99 * pk, s0) - m["t0"]
    out["attack"].append({"knob": m["knob"], "label_s": m["label_s"], "t10_s": t10, "t50_s": t50, "t90_s": t90, "t99_s": t99, "t10_90_s": t90 - t10})
    t = (np.arange(len(e)) - s0) / SR
    axs[0].plot(t / m["label_s"], e / pk, lw=1, label=f"knob {m['knob']} ({m['label_s'] * 1000:.0f} ms)")
axs[0].set_xlim(0, 1.3)
axs[0].set_xlabel("time / label")
axs[0].set_title("ATTACK shape (amp), normalized")
axs[0].legend(fontsize=6)
for m in man["decay"]:
    x = load(m["file"])
    e = env_of(x)
    s0 = int(m["t0"] * SR)
    ip = s0 + np.argmax(e[s0:s0 + int(0.01 * SR)])
    pk = e[ip]
    row = {"knob": m["knob"], "label_s": m["label_s"]}
    for d in (6, 20, 40, 60):
        tb = first_below(e, pk * 10 ** (-d / 20), ip)
        row[f"t_minus{d}db_s"] = (tb - ip / SR) if tb else None
    out["decay"].append(row)
    t = (np.arange(len(e)) - ip) / SR
    axs[1].plot(t / m["label_s"], db(e / pk), lw=1, label=f"knob {m['knob']} ({m['label_s'] * 1000:.0f} ms)")
axs[1].set_xlim(0, 1.6)
axs[1].set_ylim(-80, 3)
axs[1].set_xlabel("time / label")
axs[1].set_ylabel("dB")
axs[1].set_title("DECAY (sustain 0), dB")
for m in man["release"]:
    x = load(m["file"])
    e = env_of(x)
    s0 = int(m["t_off"] * SR)
    pk = e[s0 - 100]
    row = {"knob": m["knob"], "label_s": m["label_s"]}
    for d in (6, 20, 40, 60):
        tb = first_below(e, pk * 10 ** (-d / 20), s0)
        row[f"t_minus{d}db_s"] = (tb - m["t_off"]) if tb else None
    # where the voice stops (its output exactly 0 afterwards, after the DC blocker settles) and the last level before it
    nz = np.where(np.abs(x) > 0)[0]
    row["last_nonzero_s"] = float(nz[-1] / SR - m["t_off"]) if len(nz) else None
    out["release"].append(row)
    t = (np.arange(len(e)) - s0) / SR
    axs[2].plot(t / m["label_s"], db(e / pk), lw=1, label=f"knob {m['knob']}")
axs[2].set_xlim(-0.1, 1.6)
axs[2].set_ylim(-90, 3)
axs[2].set_xlabel("time / label")
axs[2].set_title("RELEASE, dB (the voice stops at -66 dB)")
save(fig, "env_amp.png")

for m in man["fenv"]:
    fv = np.array(m["fV"])
    tb = (np.arange(len(fv)) * 128) / SR - m["t0"]
    ipk = np.argmax(fv)
    row = {"knob": m["knob"], "fA": m["fA"], "fD": m["fD"], "peak": float(fv[ipk]), "t_peak_s": float(tb[ipk])}
    # decay: time for (fV - fS) to fall 40 dB
    d = fv[ipk:] - m["fS"]
    j = np.where(d <= (fv[ipk] - m["fS"]) * 0.01)[0]
    row["t_dec40_s"] = float(j[0] * 128 / SR) if len(j) else None
    out["fenv"].append(row)
for m in man["retrig"]:
    x = load(m["file"])
    out["retrig"].append({"maxVoices": m["maxVoices"], "peak": float(np.max(np.abs(x)))})
out["presets"] = man["presets"]
jsave("env/results.json", out)
for k in ("attack", "decay", "release", "fenv"):
    for r in out[k]:
        print(k, {a: (round(b, 5) if isinstance(b, float) else b) for a, b in r.items()})
