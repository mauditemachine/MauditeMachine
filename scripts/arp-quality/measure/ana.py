"""Shared analysis helpers for the MM-ARP measurements (numpy / scipy / matplotlib, run with the scratchpad venv)."""
import json
import os

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "scripts", "output", "arp-quality", "measure")
PLOTS = os.path.join(OUT, "plots")
SR = 48000
os.makedirs(PLOTS, exist_ok=True)

plt.rcParams.update({
    "figure.dpi": 110,
    "axes.grid": True,
    "grid.alpha": 0.3,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "font.size": 9,
    "legend.fontsize": 8,
    "legend.frameon": False,
})


def load(p):
    return np.load(os.path.join(OUT, p) if not os.path.isabs(p) else p)


def jload(p):
    with open(os.path.join(OUT, p) if not os.path.isabs(p) else p) as f:
        return json.load(f)


def jsave(p, obj):
    full = os.path.join(OUT, p) if not os.path.isabs(p) else p
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        json.dump(obj, f, indent=1, default=float)


def db(x, floor=1e-30):
    return 20 * np.log10(np.maximum(floor, np.abs(x)))


def lsq_tones(x, freqs, sr=SR, dc=True):
    """Joint least-squares fit of sinusoids at known frequencies: returns amplitudes, phases (and the residual)."""
    n = len(x)
    t = np.arange(n) / sr
    cols = []
    for f in freqs:
        cols.append(np.cos(2 * np.pi * f * t))
        cols.append(np.sin(2 * np.pi * f * t))
    if dc:
        cols.append(np.ones(n))
    A = np.stack(cols, axis=1)
    coef, *_ = np.linalg.lstsq(A, x.astype(np.float64), rcond=None)
    a = coef[0:2 * len(freqs):2]
    b = coef[1:2 * len(freqs):2]
    amp = np.hypot(a, b)
    ph = np.arctan2(-b, a)
    res = x - A @ coef
    return amp, ph, res


def bh_window(n):
    t = 2 * np.pi * np.arange(n) / (n - 1)
    return 0.35875 - 0.48829 * np.cos(t) + 0.14128 * np.cos(2 * t) - 0.01168 * np.cos(3 * t)


def spectrum(x, n=None, start=0, sr=SR):
    """Amplitude spectrum (peak-calibrated for a sinusoid) with a 4-term Blackman-Harris window."""
    n = n or len(x) - start
    seg = np.asarray(x[start:start + n], dtype=np.float64)
    w = bh_window(n)
    X = np.fft.rfft(seg * w)
    amp = np.abs(X) * 2 / w.sum()
    f = np.fft.rfftfreq(n, 1 / sr)
    return f, amp


def power_spectrum(x, n=None, start=0, sr=SR):
    """Power per bin (sum over bins = mean square with the window's noise bandwidth), BH window."""
    n = n or len(x) - start
    seg = np.asarray(x[start:start + n], dtype=np.float64)
    w = bh_window(n)
    X = np.fft.rfft(seg * w)
    p = (np.abs(X) ** 2) * 2 / (w ** 2).sum() / n
    f = np.fft.rfftfreq(n, 1 / sr)
    return f, p


def harmonic_split(x, f0s, sr=SR, n=65536, start=0, lo=20.0, hi=20000.0, tol_bins=6, maxh=None):
    """Harmonic vs non-harmonic power in [lo, hi] for one or several fundamental frequencies (each a list of
    partial bases, e.g. detuned STACK copies). Returns dict: harm, non, ratio_db, worst alias (dBc re the strongest
    harmonic), alias power below 5 kHz."""
    f, p = power_spectrum(x, n=n, start=start, sr=sr)
    bin_hz = sr / n
    mask = np.zeros_like(p, dtype=bool)
    for f0 in np.atleast_1d(f0s):
        k = 1
        while k * f0 <= sr / 2 and (maxh is None or k <= maxh):
            c = k * f0 / bin_hz
            i0 = max(0, int(np.floor(c - tol_bins)))
            i1 = min(len(p) - 1, int(np.ceil(c + tol_bins)))
            mask[i0:i1 + 1] = True
            k += 1
    band = (f >= lo) & (f <= hi)
    harm = p[band & mask].sum()
    non = p[band & ~mask].sum()
    # strongest harmonic peak, worst non-harmonic peak (amplitude spectrum)
    fa, amp = spectrum(x, n=n, start=start, sr=sr)
    hmax = amp[band & mask].max() if (band & mask).any() else 1e-30
    nonmask = band & ~mask
    worst = amp[nonmask].max() if nonmask.any() else 1e-30
    worst_f = fa[nonmask][np.argmax(amp[nonmask])] if nonmask.any() else 0
    low = (f >= lo) & (f <= 5000) & ~mask
    return {
        "harm": float(harm),
        "non": float(non),
        "ratio_db": float(10 * np.log10(harm / max(non, 1e-30))),
        "worst_dbc": float(db(worst) - db(hmax)),
        "worst_hz": float(worst_f),
        "alias_below5k_dbc": float(10 * np.log10(max(p[low].sum(), 1e-30) / max(harm, 1e-30))),
    }


def save(fig, name):
    path = os.path.join(PLOTS, name)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
    return path


def hilbert_env(x):
    from scipy.signal import hilbert
    return np.abs(hilbert(x))


def inst_freq(x, sr=SR, smooth_s=0.005):
    """Instantaneous frequency (Hz) from the analytic phase, smoothed with a moving average."""
    from scipy.signal import hilbert
    ph = np.unwrap(np.angle(hilbert(x)))
    fi = np.diff(ph) * sr / (2 * np.pi)
    k = max(1, int(smooth_s * sr))
    if k > 1:
        fi = np.convolve(fi, np.ones(k) / k, mode="same")
    return fi
