import numpy as np
from ana import load, jload, jsave, harmonic_split, save, plt, power_spectrum, SR

man = jload("alias_sync/manifest.json")
rows = []
for c in man["cases"]:
    x = load(c["file"]).astype(np.float64)
    r = harmonic_split(x, c["bases"], start=int(0.2 * SR), n=65536, tol_bins=6)
    rows.append({k: c[k] for k in ("os", "semi", "fine", "wave2", "ratio")} | r)
jsave("alias_sync/results.json", rows)
fig, axs = plt.subplots(1, 2, figsize=(13, 3.6))
for os, ls in ((4, "-"), (2, "--")):
    rr = sorted([r for r in rows if r["os"] == os and r["fine"] == 0 and r["wave2"] == 2], key=lambda r: r["semi"])
    axs[0].plot([r["semi"] for r in rr], [r["ratio_db"] for r in rr], ls, marker="o", ms=3, label=f"x{os}")
    for semi, col in ((19, "C2"), (24, "C3")):
        rr = sorted([r for r in rows if r["os"] == os and r["semi"] == semi and r["wave2"] == 2], key=lambda r: r["fine"])
        axs[1].plot([r["fine"] for r in rr], [r["ratio_db"] for r in rr], ls, color=col, marker="o", ms=3, label=f"+{semi} semis x{os}")
axs[0].set_xlabel("OSC 2 tune (semitones above OSC 1), FINE 0")
axs[0].set_ylabel("purity dB (harmonic / non-harmonic)")
axs[0].set_title("hard SYNC, saw slave, C7, level 0.1, HP 20 Hz")
axs[0].legend()
axs[1].set_xlabel("FINE 2 (cents)")
axs[1].set_title("around ratios 3 (+19) and 4 (+24)")
axs[1].legend()
save(fig, "alias_sync.png")
for r in rows:
    if r["fine"] == 0:
        print(r["os"], r["wave2"], r["semi"], round(r["ratio"], 4), round(r["ratio_db"], 1), round(r["worst_dbc"], 1), round(r["worst_hz"]))
print("fine sweep")
for r in rows:
    if r["semi"] in (19, 24) and r["wave2"] == 2:
        print(r["os"], r["semi"], r["fine"], round(r["ratio"], 4), round(r["ratio_db"], 1))

# STACK again, with masks wide enough for the beating products of the copies (k * spread around each harmonic)
am = jload("alias/manifest.json")
out = []
for c in am["cases"]:
    if c["case"] not in ("STACK", "SAW"):
        continue
    x = load(c["file"]).astype(np.float64)
    f, p = power_spectrum(x, n=65536, start=int(0.2 * SR))
    f0 = 440 * 2 ** ((c["midi"] - 69) / 12)
    spread = f0 * (2 ** (16.5 / 1200) - 1) if c["case"] == "STACK" else 0
    mask = np.zeros_like(p, dtype=bool)
    k = 1
    while k * f0 < 24000:
        w = 4 * k * spread + 6 * SR / 65536
        mask |= np.abs(f - k * f0) <= w
        k += 1
    band = (f >= 20) & (f <= 20000)
    out.append({k2: c[k2] for k2 in ("filter", "level", "case", "midi", "os")} | {"ratio_db_clusters": float(10 * np.log10(p[band & mask].sum() / max(p[band & ~mask].sum(), 1e-30)))})
jsave("alias/stack_clusters.json", out)
for r in out:
    print(r)
