import numpy as np
from ana import load, jload, jsave, harmonic_split, save, plt, spectrum, db, SR

man = jload("alias/manifest.json")
rows = []
for c in man["cases"]:
    x = load(c["file"]).astype(np.float64)
    tol = 6
    r = harmonic_split(x, c["bases"], start=int(0.2 * SR), n=65536, tol_bins=tol)
    rows.append({k: c[k] for k in ("filter", "level", "case", "midi", "os")} | r)
jsave("alias/results.json", rows)

# table: purity (harmonic / non-harmonic, dB) for each case, C6 C7 C8, x4 / x2, MOOG open at 0.62
cases = list(dict.fromkeys(r["case"] for r in rows))
print("purity dB (harm/non-harm 20 Hz-20 kHz) | worst alias dBc | alias<5k dBc")
for filt, lvl in (("moog", 0.62), ("moog", 0.1), ("raw", 0.1)):
    print(f"\n== filter {filt}, level {lvl}")
    print("case".ljust(9) + "".join(f"{'C'+str(m//12-1)+' x'+str(o):>22}" for o in (4, 2) for m in (84, 96, 108)))
    for cs in cases:
        line = cs.ljust(9)
        for o in (4, 2):
            for m in (84, 96, 108):
                rr = [r for r in rows if r["filter"] == filt and r["level"] == lvl and r["case"] == cs and r["midi"] == m and r["os"] == o]
                if not rr:
                    line += f"{'-':>22}"
                    continue
                r = rr[0]
                line += f"{r['ratio_db']:7.1f} {r['worst_dbc']:6.1f} {r['alias_below5k_dbc']:6.1f} "
        print(line)

# plot: purity vs case at C7 and C8, x4 vs x2 (MOOG 0.62)
fig, axs = plt.subplots(1, 2, figsize=(13, 3.8), sharey=True)
for j, m in enumerate((96, 108)):
    for o, col in ((4, "C0"), (2, "C1")):
        vals = [next(r["ratio_db"] for r in rows if r["filter"] == "moog" and r["level"] == 0.62 and r["case"] == cs and r["midi"] == m and r["os"] == o) for cs in cases]
        axs[j].bar(np.arange(len(cases)) + (0.2 if o == 2 else -0.2), vals, width=0.4, color=col, label=f"x{o}")
    axs[j].set_xticks(np.arange(len(cases)))
    axs[j].set_xticklabels(cases, rotation=60, fontsize=7)
    axs[j].set_title(f"purity (harmonic / non-harmonic), {['C7', 'C8'][j]}, MOOG open, OSC 0.62")
    axs[j].axhline(60, color="k", lw=0.5, ls=":")
axs[0].set_ylabel("dB (higher = cleaner)")
axs[0].legend()
save(fig, "alias_purity.png")

# spectra of a few worst cases
worst = sorted([r for r in rows if r["filter"] == "moog" and r["level"] == 0.62], key=lambda r: r["ratio_db"])[:6]
fig, axs = plt.subplots(2, 3, figsize=(14, 6))
for ax, r in zip(axs.ravel(), worst):
    fn = f"alias/{r['filter']}_{r['level']}_{r['case']}_{r['midi']}_os{r['os']}.npy"
    x = load(fn).astype(np.float64)
    f, a = spectrum(x, n=65536, start=int(0.2 * SR))
    ax.plot(f, db(a), lw=0.5)
    ax.set_xlim(0, 24000)
    ax.set_ylim(-160, 0)
    ax.set_title(f"{r['case']} midi {r['midi']} x{r['os']}: {r['ratio_db']:.1f} dB, worst {r['worst_dbc']:.0f} dBc @ {r['worst_hz']:.0f} Hz", fontsize=8)
save(fig, "alias_worst.png")
