// MM-ARP v27 : l'EQ parametrique 6 bandes et l'analyseur (voir ParamEq.h).
#include "ParamEq.h"

#include <algorithm>
#include <cmath>

namespace mmarp {

namespace {
constexpr double PI = 3.14159265358979323846;
inline double clamp01(double v) { return v != v ? 0 : v < 0 ? 0 : v > 1 ? 1 : v; }
inline double flushd(double v) { return std::fabs(v) < 1e-25 ? 0 : v; }
// les Q des Butterworth d'ordre 4 et 8 (sections du second ordre)
constexpr double kBw4[2] = {0.54119610014619698, 1.3065629648763766};
constexpr double kBw8[4] = {0.50979557910415917, 0.60134488693504529, 0.89997622313641570, 2.5629154477415055};
constexpr double SQRT1_2 = 0.70710678118654752440;
} // namespace

double ParamEq::freqOf(double v) { return 20 * std::pow(1000.0, clamp01(v)); }
double ParamEq::gainDbOf(double v) { return 36 * (clamp01(v) - 0.5); }
double ParamEq::qOf(double v) { return 0.3 * std::pow(60.0, clamp01(v)); }
double ParamEq::outDbOf(double v) { return 24 * (clamp01(v) - 0.5); }

void ParamEq::prepare(double sr) {
    sr_ = sr;
    mixStep_ = 1.0 / (0.01 * sr);
    reset();
}

bool ParamEq::needs(const EqBandSettings& w) {
    if (!w.on) return false;
    if (w.type == T_HP || w.type == T_LP || w.type == T_NOTCH) return true;
    return w.db != 0;
}

void ParamEq::reset() {
    for (Band& b : b_) {
        b.hz = b.want.hz;
        b.db = b.want.db;
        b.q = b.want.q;
        b.type = b.want.type;
        b.slope = b.want.slope;
        b.act = needs(b.want);
        b.mix = b.mixT = b.act ? 1 : 0;
        for (Sec& s : b.sec) s.ic1[0] = s.ic1[1] = s.ic2[0] = s.ic2[1] = 0;
        if (b.act) coefs(b);
    }
    out_ = outT_;
    tick_ = 0;
}

bool ParamEq::bypassed() const {
    for (const Band& b : b_)
        if (b.act) return false;
    return out_ == 1 && outT_ == 1;
}

void ParamEq::coefs(Band& b) {
    const double f = std::max(10.0, std::min(b.hz, 0.45 * sr_));
    const double g0 = std::tan(PI * f / sr_);
    const double q = std::max(0.1, b.q);
    const auto svf = [](Sec& s, double g, double k, double m0, double m1, double m2) {
        s.a1 = 1 / (1 + g * (g + k));
        s.a2 = g * s.a1;
        s.a3 = g * s.a2;
        s.m0 = m0;
        s.m1 = m1;
        s.m2 = m2;
    };
    switch (b.type) {
    case T_HP:
    case T_LP: {
        const int n = b.slope <= 0 ? 1 : b.slope == 1 ? 2 : 4;
        const bool hp = b.type == T_HP;
        for (int i = 0; i < n; ++i) {
            double qi = q;
            if (n == 2) qi = i == 1 ? kBw4[1] * q / SQRT1_2 : kBw4[0];
            else if (n == 4) qi = i == 3 ? kBw8[3] * q / SQRT1_2 : kBw8[i];
            const double k = 1 / qi;
            if (hp) svf(b.sec[i], g0, k, 1, -k, -1);
            else svf(b.sec[i], g0, k, 0, 0, 1);
        }
        b.nSec = n;
        return;
    }
    case T_NOTCH: {
        const double k = 1 / q;
        svf(b.sec[0], g0, k, 1, -k, 0);
        b.nSec = 1;
        return;
    }
    case T_BELL: {
        const double A = std::pow(10.0, b.db / 40);
        const double k = 1 / (q * A);
        svf(b.sec[0], g0, k, 1, k * (A * A - 1), 0);
        b.nSec = 1;
        return;
    }
    case T_LOWSHELF: {
        const double A = std::pow(10.0, b.db / 40);
        const double k = 1 / q;
        svf(b.sec[0], g0 / std::sqrt(A), k, 1, k * (A - 1), A * A - 1);
        b.nSec = 1;
        return;
    }
    default: { // HIGH SHELF
        const double A = std::pow(10.0, b.db / 40);
        const double k = 1 / q;
        svf(b.sec[0], g0 * std::sqrt(A), k, A * A, k * (1 - A) * A, 1 - A * A);
        b.nSec = 1;
        return;
    }
    }
}

void ParamEq::set(const EqBandSettings* bands, double outDb, bool now) {
    for (int i = 0; i < kBands; ++i) {
        Band& b = b_[i];
        EqBandSettings w = bands[i];
        w.type = std::max(0, std::min(T_COUNT - 1, w.type));
        w.slope = std::max(0, std::min(2, w.slope));
        if (!std::isfinite(w.hz)) w.hz = 1000;
        if (!std::isfinite(w.db)) w.db = 0;
        if (!std::isfinite(w.q)) w.q = 0.71;
        w.hz = std::max(10.0, std::min(24000.0, w.hz));
        w.db = std::max(-30.0, std::min(30.0, w.db));
        w.q = std::max(0.1, std::min(40.0, w.q));
        const bool need = needs(w);
        const bool form = w.type != b.type || w.slope != b.slope;
        b.want = w;
        if (now || (need && !b.act)) {
            // posee : une bande qui s'allume part d'etats a zero (en jeu : fondu de 10 ms depuis l'entree)
            if (!b.act)
                for (Sec& s : b.sec) s.ic1[0] = s.ic1[1] = s.ic2[0] = s.ic2[1] = 0;
            b.hz = w.hz;
            b.db = w.db;
            b.q = w.q;
            b.type = w.type;
            b.slope = w.slope;
            if (now) b.mix = need ? 1 : 0;
            else if (!b.act) b.mix = 0;
            b.mixT = need ? 1 : 0;
            b.act = need || (!now && b.act);
            if (b.act) coefs(b);
            continue;
        }
        if (need && form) {
            const int was = b.nSec;
            b.type = w.type;
            b.slope = w.slope;
            coefs(b);
            for (int s = was; s < b.nSec; ++s) b.sec[s].ic1[0] = b.sec[s].ic1[1] = b.sec[s].ic2[0] = b.sec[s].ic2[1] = 0;
        }
        b.mixT = need ? 1 : 0;
    }
    outT_ = std::pow(10.0, std::max(-24.0, std::min(24.0, std::isfinite(outDb) ? outDb : 0)) / 20);
    if (now) out_ = outT_;
}

void ParamEq::process(float* L, float* R, int n) {
    if (bypassed()) return; // tout au neutre : la sortie d'avant, au bit pres
    const double outK = 1 - std::exp(-1 / (0.02 * sr_));
    for (int i = 0; i < n; ++i) {
        if ((tick_ % kTick) == 0) {
            // les reglages glissent vers leur cible (un cinquieme du chemin tous les 16 echantillons)
            for (Band& b : b_) {
                if (!b.act) continue;
                bool ch = false;
                if (b.hz != b.want.hz) {
                    const double r = b.want.hz / b.hz;
                    b.hz = r > 0.9999 && r < 1.0001 ? b.want.hz : b.hz * std::pow(r, 0.2);
                    ch = true;
                }
                if (b.q != b.want.q) {
                    const double r = b.want.q / b.q;
                    b.q = r > 0.9999 && r < 1.0001 ? b.want.q : b.q * std::pow(r, 0.2);
                    ch = true;
                }
                if (b.db != b.want.db) {
                    const double d = b.want.db - b.db;
                    b.db = std::fabs(d) < 1e-4 ? b.want.db : b.db + 0.2 * d;
                    ch = true;
                }
                if (ch) coefs(b);
                for (int s = 0; s < b.nSec; ++s)
                    for (int c = 0; c < 2; ++c) {
                        b.sec[s].ic1[c] = flushd(b.sec[s].ic1[c]);
                        b.sec[s].ic2[c] = flushd(b.sec[s].ic2[c]);
                    }
            }
        }
        ++tick_;
        double x[2] = {L[i], R[i]};
        for (Band& b : b_) {
            if (!b.act) continue;
            for (int c = 0; c < 2; ++c) {
                double y = x[c];
                for (int s = 0; s < b.nSec; ++s) {
                    Sec& q = b.sec[s];
                    const double v0 = y;
                    const double v3 = v0 - q.ic2[c];
                    const double v1 = q.a1 * q.ic1[c] + q.a2 * v3;
                    const double v2 = q.ic2[c] + q.a2 * q.ic1[c] + q.a3 * v3;
                    q.ic1[c] = 2 * v1 - q.ic1[c];
                    q.ic2[c] = 2 * v2 - q.ic2[c];
                    y = q.m0 * v0 + q.m1 * v1 + q.m2 * v2;
                }
                x[c] = b.mix >= 1 ? y : x[c] + b.mix * (y - x[c]);
            }
            if (b.mix != b.mixT) {
                b.mix = b.mixT > b.mix ? std::min(b.mixT, b.mix + mixStep_) : std::max(b.mixT, b.mix - mixStep_);
                if (b.mix <= 0 && b.mixT <= 0) {
                    b.act = false;
                    for (Sec& s : b.sec) s.ic1[0] = s.ic1[1] = s.ic2[0] = s.ic2[1] = 0;
                }
            }
        }
        if (out_ != outT_) {
            out_ += outK * (outT_ - out_);
            if (std::fabs(out_ - outT_) < 1e-7) out_ = outT_;
        }
        if (out_ != 1) {
            x[0] *= out_;
            x[1] *= out_;
        }
        L[i] = static_cast<float>(x[0]);
        R[i] = static_cast<float>(x[1]);
    }
}

/* ---------------- l'analyseur ---------------- */

void SpecAnalyzer::prepare(double sr) {
    sr_ = sr;
    win_.resize(kN);
    for (int i = 0; i < kN; ++i) win_[static_cast<size_t>(i)] = 0.5 - 0.5 * std::cos(2 * PI * (i + 0.5) / kN);
    re_.assign(kN, 0);
    im_.assign(kN, 0);
    smooth_.fill(-100);
    for (int j = 0; j <= kBins; ++j) {
        const double f = 20 * std::pow(1000.0, static_cast<double>(j) / kBins);
        edge_[static_cast<size_t>(j)] = static_cast<int>(std::floor(f * kN / sr));
    }
}

void SpecAnalyzer::push(const float* L, const float* R, int n) {
    int w = w_.load(std::memory_order_relaxed);
    for (int i = 0; i < n; ++i) {
        ring_[static_cast<size_t>(w)] = 0.5f * (L[i] + R[i]);
        w = (w + 1) & (kRing - 1);
    }
    w_.store(w, std::memory_order_release);
}

bool SpecAnalyzer::frame(float* out) {
    const int w = w_.load(std::memory_order_acquire);
    if (w == lastW_) {
        // rien de neuf : la descente continue (l'analyseur retombe quand le son s'arrete)
        for (int j = 0; j < kBins; ++j) {
            smooth_[static_cast<size_t>(j)] = std::max(-100.f, smooth_[static_cast<size_t>(j)] - 1.5f);
            out[j] = smooth_[static_cast<size_t>(j)];
        }
        return false;
    }
    lastW_ = w;
    for (int k = 0; k < kN; ++k) {
        re_[static_cast<size_t>(k)] = ring_[static_cast<size_t>((w - kN + k) & (kRing - 1))] * win_[static_cast<size_t>(k)];
        im_[static_cast<size_t>(k)] = 0;
    }
    // la FFT (radix 2, en place)
    for (int i = 1, j = 0; i < kN; ++i) {
        int bit = kN >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) std::swap(re_[static_cast<size_t>(i)], re_[static_cast<size_t>(j)]);
    }
    for (int len = 2; len <= kN; len <<= 1) {
        const double a = -2 * PI / len;
        const double wr = std::cos(a), wi = std::sin(a);
        for (int i = 0; i < kN; i += len) {
            double cr = 1, ci = 0;
            for (int k = 0; k < len / 2; ++k) {
                const size_t u = static_cast<size_t>(i + k), v = static_cast<size_t>(i + k + len / 2);
                const double xr = re_[v] * cr - im_[v] * ci, xi = re_[v] * ci + im_[v] * cr;
                re_[v] = re_[u] - xr;
                im_[v] = im_[u] - xi;
                re_[u] += xr;
                im_[u] += xi;
                const double t = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = t;
            }
        }
    }
    // une sinusoide pleine echelle : 0 dB (la fenetre de Hann rend une crete de N / 4)
    const auto mag = [&](int k) { return std::hypot(re_[static_cast<size_t>(k)], im_[static_cast<size_t>(k)]) * 4.0 / kN; };
    for (int j = 0; j < kBins; ++j) {
        const int a = std::max(1, edge_[static_cast<size_t>(j)]), b = std::min(kN / 2 - 1, edge_[static_cast<size_t>(j + 1)]);
        double m = 0;
        if (b > a)
            for (int k = a; k < b; ++k) m = std::max(m, mag(k));
        else {
            const double f = 20 * std::pow(1000.0, (j + 0.5) / kBins) * kN / sr_;
            const int k0 = std::max(1, std::min(kN / 2 - 2, static_cast<int>(f)));
            const double t = std::max(0.0, std::min(1.0, f - k0));
            m = (1 - t) * mag(k0) + t * mag(k0 + 1);
        }
        const float db = static_cast<float>(std::max(-100.0, std::min(12.0, 20 * std::log10(std::max(1e-6, m)))));
        float& s = smooth_[static_cast<size_t>(j)];
        s = db > s ? db : std::max(db, s - 1.5f);
        out[j] = s;
    }
    return true;
}

} // namespace mmarp
