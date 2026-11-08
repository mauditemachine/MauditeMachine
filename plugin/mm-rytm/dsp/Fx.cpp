#include "Fx.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace mm {

namespace {
constexpr double PI = 3.14159265358979323846;
constexpr double BUTTER_Q = 0.70710678118654752; // le Q de Butterworth (BUTTER_Q_DB du site, ramene en lineaire)
constexpr double RYTM_TRIM = 0.84;               // drums.ts RYTM_TRIM
constexpr double DELAY_SEND = 1.2, REVERB_SEND = 1.0;
constexpr double LINE_W = 1.9447398407953985;    // 2 cos(0.075 pi)
inline double jsRound(double x) { return std::floor(x + 0.5); }
inline bool near(double a, double b) { return std::fabs(a - b) < 1e-6; }
inline double clampd(double v, double lo, double hi) { return std::max(lo, std::min(hi, v)); }

// mulberry32 (sends.ts makeImpulse, audio/trig.ts) : identique bit a bit
struct M32 {
    uint32_t a;
    explicit M32(uint32_t s) : a(s) {}
    double next() {
        a += 0x6D2B79F5u;
        uint32_t t = a;
        t = (t ^ (t >> 15)) * (t | 1u);
        t ^= t + (t ^ (t >> 7)) * (t | 61u);
        return static_cast<double>(t ^ (t >> 14)) / 4294967296.0;
    }
};

// La table d'interpolation du chorus (chorus.worklet.js) : 513 phases x 16 points, sinc fenetre de Kaiser (beta 8)
double besselI0(double x) {
    double s = 1, t = 1;
    for (int k = 1; k <= 40; ++k) {
        t *= (x / (2 * k)) * (x / (2 * k));
        s += t;
        if (t < 1e-12 * s) break;
    }
    return s;
}
const std::vector<float>& sincTable() {
    static const std::vector<float> T = [] {
        std::vector<float> out(513 * 16);
        const double i08 = besselI0(8);
        for (int p = 0; p <= 512; ++p) {
            double sum = 0;
            float row[16];
            for (int k = 0; k < 16; ++k) {
                const double x = p / 512.0 + 7 - k;
                const double r = x / 8;
                double v = 0;
                if (std::fabs(r) < 1) {
                    const double sinc = x == 0 ? 1 : std::sin(PI * x) / (PI * x);
                    v = sinc * besselI0(8 * std::sqrt(1 - r * r)) / i08;
                }
                row[k] = static_cast<float>(v);
                sum += row[k];
            }
            for (int k = 0; k < 16; ++k) out[static_cast<size_t>(p * 16 + k)] = static_cast<float>(row[k] / sum);
        }
        return out;
    }();
    return T;
}

// FFT complexe radix 2 en place (taille ReverbIR::N), facteurs precalcules
struct Fft {
    int n;
    std::vector<std::complex<float>> tw;
    std::vector<int> rev;
    explicit Fft(int size) : n(size), tw(static_cast<size_t>(size / 2)), rev(static_cast<size_t>(size)) {
        for (int k = 0; k < n / 2; ++k) tw[static_cast<size_t>(k)] = std::polar(1.0f, static_cast<float>(-2 * PI * k / n));
        int bits = 0;
        while ((1 << bits) < n) ++bits;
        for (int i = 0; i < n; ++i) {
            int r = 0;
            for (int b = 0; b < bits; ++b)
                if (i & (1 << b)) r |= 1 << (bits - 1 - b);
            rev[static_cast<size_t>(i)] = r;
        }
    }
    void run(std::complex<float>* a, bool inverse) const {
        for (int i = 0; i < n; ++i)
            if (i < rev[static_cast<size_t>(i)]) std::swap(a[i], a[rev[static_cast<size_t>(i)]]);
        for (int len = 2; len <= n; len <<= 1) {
            const int step = n / len;
            for (int i = 0; i < n; i += len)
                for (int j = 0; j < len / 2; ++j) {
                    std::complex<float> w = tw[static_cast<size_t>(j * step)];
                    if (inverse) w = std::conj(w);
                    const std::complex<float> u = a[i + j];
                    const std::complex<float> v = a[i + j + len / 2] * w;
                    a[i + j] = u + v;
                    a[i + j + len / 2] = u - v;
                }
        }
        if (inverse)
            for (int i = 0; i < n; ++i) a[i] /= static_cast<float>(n);
    }
};
const Fft& fft() {
    static const Fft f(ReverbIR::N);
    return f;
}

// Une rampe lineaire sur le bloc (les glissements de 20 ms du site, au bloc pres)
struct Ramp {
    double cur = 0;
    bool init = false;
    template <typename Fn>
    void apply(double target, int n, Fn&& fn) {
        if (!init) {
            cur = target;
            init = true;
        }
        const double step = (target - cur) / std::max(1, n);
        for (int i = 0; i < n; ++i) fn(i, cur + step * (i + 1));
        cur = target;
    }
};
} // namespace

/* ---------------- les lois ---------------- */

double FxLaws::dtoneHz(double v) { return near(v, 0.638) ? 4500 : clampd(800 * std::pow(15.0, clampd(v, 0, 1)), 200, 20000); }
double FxLaws::reverbSeconds(double v) { return near(v, 0.566) ? 2.4 : clampd(0.5 * std::pow(16.0, clampd(v, 0, 1)), 0.1, 10); }
double FxLaws::reverbHiEnd(double v) { return near(v, 0.442) ? 3000 : clampd(1000 * std::pow(12.0, clampd(v, 0, 1)), 200, 20000); }
double FxLaws::reverbPre(double v) { return near(v, 0.167) ? 0.02 : clampd(0.12 * clampd(v, 0, 1), 0, 0.25); }
double FxLaws::xtoneHz(double v) { return near(v, 1) ? 16000 : 1000 * std::pow(16.0, clampd(v, 0, 1)); }
double FxLaws::chorusMul(double v) { return near(v, 0.624) ? 1 : clampd(0.1 * std::pow(40.0, clampd(v, 0, 1)), 0.05, 8); }
double FxLaws::chorusDepth(double v) { return near(v, 0.5) ? 0.007 : clampd(0.014 * clampd(v, 0, 1), 0, 0.02); }
int FxLaws::bitRate(double v) { return near(v, 0) ? 1 : 1 + static_cast<int>(jsRound(clampd(v, 0, 1) * 15)); }
double FxLaws::delaySeconds(double dtime, double bpm) {
    static const int DIVS[6] = {1, 2, 3, 4, 6, 8};
    const int i = static_cast<int>(clampd(jsRound(clampd(dtime, 0, 1) * 5), 0, 5));
    return std::min(2.0, DIVS[i] * 60.0 / std::max(1.0, bpm) / 4);
}
double FxLaws::delayFeedback(double dfb) { return clampd(0.87 * clampd(dfb, 0, 1), 0, 0.9); }

/* ---------------- la reponse de la reverb ---------------- */

void ReverbIR::impulse(double seconds, double hiEnd, double preDelay, double sr, std::vector<float>& L, std::vector<float>& R) {
    const long pre = static_cast<long>(jsRound(preDelay * sr));
    const long n = std::max(pre + 2, static_cast<long>(jsRound(seconds * sr)) + pre - static_cast<long>(jsRound(0.02 * sr)));
    const long len = n - pre;
    const double hiStart = std::max(9000.0, hiEnd);
    const long fade = std::max(1L, static_cast<long>(jsRound(0.003 * sr)));
    const double decay = std::exp(std::log(0.001) / static_cast<double>(len));
    const uint32_t seeds[2] = {808, 909};
    for (int ch = 0; ch < 2; ++ch) {
        std::vector<float>& buf = ch == 0 ? L : R;
        buf.assign(static_cast<size_t>(n), 0.f);
        M32 rnd(seeds[ch]);
        double y = 0, a = 0, env = 1, E = 0;
        for (long i = 0; i < len; ++i) {
            if (i % 64 == 0) {
                const double fc = hiStart * std::pow(hiEnd / hiStart, static_cast<double>(i) / static_cast<double>(len));
                a = 1 - std::exp(-2 * PI * fc / sr);
            }
            y += a * (rnd.next() * 2 - 1 - y);
            const double v = y * env * (i < fade ? static_cast<double>(i) / static_cast<double>(fade) : 1);
            buf[static_cast<size_t>(pre + i)] = static_cast<float>(v);
            E += v * v;
            env *= decay;
        }
        const double g = E > 0 ? 1 / std::sqrt(E) : 0;
        for (long i = pre; i < n; ++i) buf[static_cast<size_t>(i)] = static_cast<float>(buf[static_cast<size_t>(i)] * g);
    }
}

std::shared_ptr<ReverbIR> ReverbIR::make(double seconds, double hiEnd, double preDelay, double sr) {
    auto ir = std::make_shared<ReverbIR>();
    std::vector<float> L, R;
    impulse(seconds, hiEnd, preDelay, sr, L, R);
    const int len = static_cast<int>(L.size());
    ir->parts = std::max(1, (len + B - 1) / B);
    std::vector<std::complex<float>> a(static_cast<size_t>(N));
    for (int ch = 0; ch < 2; ++ch) {
        const std::vector<float>& src = ch == 0 ? L : R;
        auto& H = ir->H[static_cast<size_t>(ch)];
        H.assign(static_cast<size_t>(ir->parts * (N / 2 + 1)), {0, 0});
        for (int p = 0; p < ir->parts; ++p) {
            std::fill(a.begin(), a.end(), std::complex<float>(0, 0));
            for (int i = 0; i < B && p * B + i < len; ++i) a[static_cast<size_t>(i)] = src[static_cast<size_t>(p * B + i)];
            fft().run(a.data(), false);
            for (int k = 0; k <= N / 2; ++k) H[static_cast<size_t>(p * (N / 2 + 1) + k)] = a[static_cast<size_t>(k)];
        }
    }
    return ir;
}

/* ---------------- les briques ---------------- */

void FxChain::Bq::lowpass(double f, double sr) {
    f = clampd(f, 20, sr / 2 * 0.999);
    const double w = 2 * PI * f / sr, cw = std::cos(w), alpha = std::sin(w) / (2 * BUTTER_Q), a0 = 1 + alpha;
    b0 = (1 - cw) / 2 / a0; b1 = (1 - cw) / a0; b2 = b0; a1 = -2 * cw / a0; a2 = (1 - alpha) / a0;
}
void FxChain::Bq::highpass(double f, double sr) {
    f = clampd(f, 1, sr / 2 * 0.999);
    const double w = 2 * PI * f / sr, cw = std::cos(w), alpha = std::sin(w) / (2 * BUTTER_Q), a0 = 1 + alpha;
    b0 = (1 + cw) / 2 / a0; b1 = -(1 + cw) / a0; b2 = b0; a1 = -2 * cw / a0; a2 = (1 - alpha) / a0;
}

// TONE (tone.ts) : a 0, rien ; sinon un passe-haut puis un passe-bas de Butterworth
void FxChain::Tone::set(double tone, double sr) {
    double t = clampd(tone, -1, 1);
    if (std::fabs(t) < 0.04) t = 0;
    if (t == v) return;
    if (v == 0) {
        hp.clear();
        lp.clear();
    }
    v = t;
    if (v == 0) return;
    hp.highpass(v > 0 ? 20 * std::pow(9.0, v) : 20, sr);
    lp.lowpass(std::min(v < 0 ? 20000 * std::pow(0.045, -v) : 20000.0, 0.95 * sr / 2), sr);
}
void FxChain::Tone::process(float* L, float* R, int n) {
    if (v == 0) return;
    for (int i = 0; i < n; ++i) {
        L[i] = lp.run(0, hp.run(0, L[i]));
        R[i] = lp.run(1, hp.run(1, R[i]));
    }
}

// DIST (fx.ts) : dry k (1 - m), wet k m, la courbe tanh(8 u) bornee, le passe-bas DIST TONE (ouvert a 16 kHz)
void FxChain::Dist::set(double drive, double xtoneHz, double sr) {
    d = clampd(drive, 0, 1);
    const double m = 0.85 * d, k = std::pow(10.0, -9 * d / 20);
    dry = k * (1 - m);
    wet = k * m;
    pre = (1 + 12 * d) / 8;
    lpOn = xtoneHz < 16000;
    if (lpOn && xtoneHz != x) lp.lowpass(clampd(xtoneHz, 20, sr / 2), sr);
    x = xtoneHz;
}
void FxChain::Dist::process(float* L, float* R, int n) {
    if (d <= 0) return;
    for (int i = 0; i < n; ++i) {
        float sl = static_cast<float>(std::tanh(8 * clampd(pre * L[i], -1, 1)));
        float sr = static_cast<float>(std::tanh(8 * clampd(pre * R[i], -1, 1)));
        if (lpOn) {
            sl = lp.run(0, sl);
            sr = lp.run(1, sr);
        }
        L[i] = static_cast<float>(dry * L[i] + wet * sl);
        R[i] = static_cast<float>(dry * R[i] + wet * sr);
    }
}

// CHORUS (chorus.ts, chorus.worklet.js 'bus') : deux voix modulees, lues avec la table sinc, en croix gauche / droite
void FxChain::Chorus::prepare(double sr) {
    const int n = static_cast<int>(std::ceil(0.06 * sr)) + 8;
    bl.assign(static_cast<size_t>(n), 0.f);
    br.assign(static_cast<size_t>(n), 0.f);
    w = 0;
    ph[0] = ph[1] = 0;
    ks = 1 - std::exp(-1 / (0.02 * sr));
}
void FxChain::Chorus::set(double amount, double mulV, double depthS) {
    t = clampd(amount, 0, 1);
    mul = mulV;
    depth = depthS;
    const double d = 1 - 0.5 * t, ww = LINE_W * t, kk = 1 / std::sqrt(d * d + 1.16 * ww * ww);
    dry = kk * d;
    wet = kk * ww;
}
void FxChain::Chorus::process(float* L, float* R, int n, double sr) {
    if (t <= 0 || bl.empty()) return;
    const auto& T = sincTable();
    const int N = static_cast<int>(bl.size());
    static const double DEL[2] = {0.014, 0.021}, RATE[2] = {0.53, 0.71};
    const double cA = 0.9723699203976766, cB = 0.2334453638559054; // cos et sin de 0.075 pi
    for (int i = 0; i < n; ++i) {
        const float inL = L[i], inR = R[i];
        bl[static_cast<size_t>(w)] = inL;
        br[static_cast<size_t>(w)] = inR;
        smDepth += (depth - smDepth) * ks;
        smMul += (mul - smMul) * ks;
        double outL = 0, outR = 0;
        for (int v = 0; v < 2; ++v) {
            const double dd = std::max(8.0, (DEL[v] + std::sin(2 * PI * ph[v]) * smDepth) * sr);
            ph[v] += RATE[v] * smMul / sr;
            if (ph[v] >= 1) ph[v] -= 1;
            const std::vector<float>& b = v == 0 ? bl : br;
            double pos = w - dd;
            while (pos < 0) pos += N;
            const double fi = std::floor(pos);
            const int ii = static_cast<int>(fi);
            const double fp = (pos - fi) * 512;
            const int p0 = std::min(511, static_cast<int>(std::floor(fp)));
            const double tt = fp - p0;
            double y0 = 0, y1 = 0;
            for (int k = 0; k < 16; ++k) {
                int j = ii - 7 + k;
                j %= N;
                if (j < 0) j += N;
                const double s = b[static_cast<size_t>(j)];
                y0 += T[static_cast<size_t>(p0 * 16 + k)] * s;
                y1 += T[static_cast<size_t>((p0 + 1) * 16 + k)] * s;
            }
            const double y = y0 + tt * (y1 - y0);
            outL += y * (v == 0 ? cA : cB);
            outR += y * (v == 0 ? cB : cA);
        }
        w = (w + 1) % N;
        L[i] = static_cast<float>(dry * inL + wet * outL);
        R[i] = static_cast<float>(dry * inR + wet * outR);
    }
}

// DELAY (sends.ts) : sum = in + fb y ; y = HP 180 ( LP dtone ( retard (sum) ) )
void FxChain::DelayUnit::prepare(double sr) {
    const int n = static_cast<int>(std::ceil(2.1 * sr)) + 4;
    bl.assign(static_cast<size_t>(n), 0.f);
    br.assign(static_cast<size_t>(n), 0.f);
    w = 0;
    lp.clear();
    hp.clear();
    hp.highpass(180, sr);
}
void FxChain::DelayUnit::process(const float* inL, const float* inR, float* outL, float* outR, int n, double sr) {
    const int N = static_cast<int>(bl.size());
    const double dS = std::max(1.0, time * sr);
    for (int i = 0; i < n; ++i) {
        double pos = w - dS;
        while (pos < 0) pos += N;
        const int i0 = static_cast<int>(pos);
        const int i1 = (i0 + 1) % N;
        const double f = pos - i0;
        const float rl = static_cast<float>(bl[static_cast<size_t>(i0)] * (1 - f) + bl[static_cast<size_t>(i1)] * f);
        const float rr = static_cast<float>(br[static_cast<size_t>(i0)] * (1 - f) + br[static_cast<size_t>(i1)] * f);
        const float yl = hp.run(0, lp.run(0, rl));
        const float yr = hp.run(1, lp.run(1, rr));
        outL[i] = yl;
        outR[i] = yr;
        bl[static_cast<size_t>(w)] = static_cast<float>(inL[i] + fb * yl);
        br[static_cast<size_t>(w)] = static_cast<float>(inR[i] + fb * yr);
        w = (w + 1) % N;
    }
}

// La convolution par blocs (la REVERB : ConvolverNode du site, ici avec un bloc de latence)
// Tout est alloue ici, pour la plus longue reponse possible (10 s + 0.25 s de pre-delai) : attach() n'alloue rien
void FxChain::Convolver::prepare(double sr) {
    const int maxParts = static_cast<int>(std::ceil(10.3 * sr / ReverbIR::B)) + 2;
    for (int c = 0; c < 2; ++c) {
        inBuf[static_cast<size_t>(c)].assign(ReverbIR::N, 0.f);
        outBlock[static_cast<size_t>(c)].assign(ReverbIR::B, 0.f);
        fdl[static_cast<size_t>(c)].assign(static_cast<size_t>(maxParts * (ReverbIR::N / 2 + 1)), {0, 0});
    }
    tmp.assign(ReverbIR::N, {0, 0});
    acc.assign(ReverbIR::N, {0, 0});
    ir = nullptr;
    fill = 0;
    head = 0;
    idle = 1 << 20;
}

void FxChain::Convolver::attach(const ReverbIR* r) {
    // Une reponse plus longue que la place (une autre frequence) : on la garde pour le prochain prepare()
    if (r && static_cast<size_t>(r->parts * (ReverbIR::N / 2 + 1)) > fdl[0].size()) r = nullptr;
    ir = r;
    for (int c = 0; c < 2; ++c) {
        std::fill(inBuf[static_cast<size_t>(c)].begin(), inBuf[static_cast<size_t>(c)].end(), 0.f);
        std::fill(outBlock[static_cast<size_t>(c)].begin(), outBlock[static_cast<size_t>(c)].end(), 0.f);
        if (r) std::fill(fdl[static_cast<size_t>(c)].begin(), fdl[static_cast<size_t>(c)].begin() + r->parts * (ReverbIR::N / 2 + 1), std::complex<float>(0, 0));
    }
    fill = 0;
    head = 0;
    idle = 1 << 20;
}
void FxChain::Convolver::block() {
    constexpr int B = ReverbIR::B, N = ReverbIR::N, K = N / 2 + 1;
    const int parts = ir->parts;
    bool silent = true;
    for (int c = 0; c < 2 && silent; ++c)
        for (int i = B; i < N; ++i)
            if (inBuf[static_cast<size_t>(c)][static_cast<size_t>(i)] != 0) {
                silent = false;
                break;
            }
    idle = silent ? idle + 1 : 0;
    head = (head + 1) % parts;
    for (int c = 0; c < 2; ++c) {
        auto& in = inBuf[static_cast<size_t>(c)];
        auto& F = fdl[static_cast<size_t>(c)];
        auto& out = outBlock[static_cast<size_t>(c)];
        if (idle > parts + 1) {
            // Rien depuis plus que la longueur de la reponse : la queue est finie
            std::fill(F.begin() + head * K, F.begin() + (head + 1) * K, std::complex<float>(0, 0));
            std::fill(out.begin(), out.end(), 0.f);
        } else {
            for (int i = 0; i < N; ++i) tmp[static_cast<size_t>(i)] = in[static_cast<size_t>(i)];
            fft().run(tmp.data(), false);
            for (int k = 0; k < K; ++k) F[static_cast<size_t>(head * K + k)] = tmp[static_cast<size_t>(k)];
            const auto& H = ir->H[static_cast<size_t>(c)];
            std::fill(acc.begin(), acc.end(), std::complex<float>(0, 0));
            for (int p = 0; p < parts; ++p) {
                const int slot = ((head - p) % parts + parts) % parts;
                const std::complex<float>* x = &F[static_cast<size_t>(slot * K)];
                const std::complex<float>* h = &H[static_cast<size_t>(p * K)];
                for (int k = 0; k < K; ++k) acc[static_cast<size_t>(k)] += x[k] * h[k];
            }
            for (int k = 1; k < N / 2; ++k) acc[static_cast<size_t>(N - k)] = std::conj(acc[static_cast<size_t>(k)]);
            fft().run(acc.data(), true);
            for (int i = 0; i < B; ++i) out[static_cast<size_t>(i)] = acc[static_cast<size_t>(B + i)].real();
        }
        // la moitie recente devient l'ancienne
        std::memmove(in.data(), in.data() + B, sizeof(float) * B);
    }
}
void FxChain::Convolver::process(const float* inL, const float* inR, float* outL, float* outR, int n) {
    if (!ir) {
        std::memset(outL, 0, sizeof(float) * static_cast<size_t>(n));
        std::memset(outR, 0, sizeof(float) * static_cast<size_t>(n));
        return;
    }
    constexpr int B = ReverbIR::B;
    for (int i = 0; i < n; ++i) {
        outL[i] = outBlock[0][static_cast<size_t>(fill)];
        outR[i] = outBlock[1][static_cast<size_t>(fill)];
        inBuf[0][static_cast<size_t>(B + fill)] = inL[i];
        inBuf[1][static_cast<size_t>(B + fill)] = inR[i];
        if (++fill == B) {
            block();
            fill = 0;
        }
    }
}

// GLUE (glue.worklet.js) : BIT (repli d'echantillonnage et de bits) puis COMP (detecteur crete et RMS, genou, AUTO)
void FxChain::Glue::process(float* L, float* R, int n, const GlobalFx& g, double sr) {
    const double bits = clampd(g.bits, 0, 1), comp = clampd(g.comp, 0, 1);
    if (bits <= 0 && comp <= 0 && mixB < 1e-4 && mixC < 1e-4) {
        mixB = mixC = 0;
        return; // l'identite exacte
    }
    static const double RATIOS[8] = {1, 1.5, 2, 3, 4, 6, 10, 20};
    static const double HPF[3] = {0, 60, 120};
    const double thr = -40 * clampd(g.cthr, 0, 1);
    const double ratio = RATIOS[static_cast<int>(clampd(jsRound(clampd(g.cratio, 0, 1) * 7), 0, 7))];
    const double knee = 12 * clampd(g.cknee, 0, 1);
    const double atkS = 0.0001 * std::pow(500.0, clampd(g.catk, 0, 1));
    const bool autoRel = g.crel >= 0.996;
    const double relS = 0.02 * std::pow(40.0, clampd(g.crel, 0, 1));
    const bool autoMake = g.cmake <= 0.004;
    const double make = autoMake ? std::min(18.0, (1 - 1 / ratio) * 3.6 * std::log(1 + std::exp((-12.5 - thr) / 3.6))) : -6 + 24 * clampd(g.cmake, 0, 1);
    const double hpf = HPF[static_cast<int>(clampd(jsRound(clampd(g.chpf, 0, 1) * 2), 0, 2))];
    const double kg = 1 - std::exp(-1 / (0.01 * sr)), kp = 1 - std::exp(-1 / (0.02 * sr)), kr = 1 - std::exp(-1 / (0.008 * sr));
    const double pkRel = std::exp(-1 / (0.01 * sr)), atk = std::exp(-1 / (atkS * sr)), rel = std::exp(-1 / (relS * sr));
    const double fast = std::exp(-1 / (0.06 * sr)), slowA = std::exp(-1 / (3 * sr)), slowR = std::exp(-1 / (1.2 * sr));
    const double slope = 1 - 1 / ratio;
    if (first) {
        thrS = thr;
        slopeS = slope;
        kneeS = knee;
        makeS = make;
        first = false;
    }
    const int fac = FxLaws::bitRate(g.brate);
    const double q = std::pow(2.0, 15 - 12 * bits);
    // le passe-haut du detecteur (forme directe I)
    double hb0 = 1, hb1 = 0, hb2 = 0, ha1 = 0, ha2 = 0;
    if (hpf > 0) {
        const double w = 2 * PI * hpf / sr, cw = std::cos(w), al = std::sin(w) / std::sqrt(2.0), a0 = 1 + al;
        hb0 = (1 + cw) / 2 / a0; hb1 = -(1 + cw) / a0; hb2 = hb0; ha1 = -2 * cw / a0; ha2 = (1 - al) / a0;
    }
    for (int i = 0; i < n; ++i) {
        mixB += ((bits > 0 ? 1.0 : 0.0) - mixB) * kg;
        mixC += (comp - mixC) * kg;
        double xs[2] = {L[i], R[i]};
        if (mixB > 1e-4) {
            if (++ph >= fac) {
                ph = 0;
                hold[0] = jsRound(xs[0] * q) / q;
                hold[1] = jsRound(xs[1] * q) / q;
            }
            xs[0] += (hold[0] - xs[0]) * mixB;
            xs[1] += (hold[1] - xs[1]) * mixB;
        }
        if (mixC > 1e-4) {
            thrS += (thr - thrS) * kp;
            slopeS += (slope - slopeS) * kp;
            kneeS += (knee - kneeS) * kp;
            makeS += (make - makeS) * kp;
            double sc[2] = {xs[0], xs[1]};
            if (hpf > 0)
                for (int c = 0; c < 2; ++c) {
                    const double y = hb0 * sc[c] + hb1 * hx1[c] + hb2 * hx2[c] - ha1 * hy1[c] - ha2 * hy2[c];
                    hx2[c] = hx1[c]; hx1[c] = sc[c]; hy2[c] = hy1[c]; hy1[c] = y;
                    sc[c] = y;
                }
            const double e = std::max(std::fabs(sc[0]), std::fabs(sc[1]));
            ms += (e * e - ms) * kr;
            pk = e > pk ? e : pk * pkRel;
            const double lv = 8.685889638 * (0.75 * std::log(pk + 1e-15) + 0.125 * std::log(2 * ms + 1e-30));
            const double o = lv - thrS;
            const double W = kneeS;
            double t;
            if (W > 0.01 && std::fabs(2 * o) < W) t = slopeS * (o + W / 2) * (o + W / 2) / (2 * W);
            else t = o > 0 ? slopeS * o : 0;
            if (autoRel) {
                gr = t > gr ? atk * gr + (1 - atk) * t : fast * gr + (1 - fast) * t;
                slow = t > slow ? slowA * slow + (1 - slowA) * t : slowR * slow + (1 - slowR) * t;
                gr = std::max(gr, slow);
            } else {
                gr = t > gr ? atk * gr + (1 - atk) * t : rel * gr + (1 - rel) * t;
                slow = gr;
            }
            const double gm = 1 + (std::exp((makeS - gr) * 0.115129255) - 1) * mixC;
            xs[0] *= gm;
            xs[1] *= gm;
        } else if (gr != 0 || ms != 0) {
            gr = slow = ms = pk = 0;
            for (int c = 0; c < 2; ++c) hx1[c] = hx2[c] = hy1[c] = hy2[c] = 0;
        }
        L[i] = std::isfinite(xs[0]) ? static_cast<float>(xs[0]) : 0.f;
        R[i] = std::isfinite(xs[1]) ? static_cast<float>(xs[1]) : 0.f;
    }
    if (ms < 1e-15) ms = 0;
    if (pk < 1e-15) pk = 0;
    if (gr < 1e-9) gr = 0;
    if (slow < 1e-9) slow = 0;
}

// LIMITEUR (limiter.worklet.js) : plafond -0.3 dB, 3 ms d'avance, relachement 120 ms, gain lisse en boite
void FxChain::Limiter::prepare(double sr) {
    Lw = std::max(2, static_cast<int>(jsRound(0.003 * sr)));
    rel = 1 - std::exp(-1 / (0.12 * sr));
    ringL.assign(static_cast<size_t>(Lw), 0.f);
    ringR.assign(static_cast<size_t>(Lw), 0.f);
    reqs.assign(static_cast<size_t>(Lw), 1.0);
    box.assign(static_cast<size_t>(Lw), 1.0);
    boxSum = Lw;
    idx = boxIdx = 0;
    g = 1;
}
void FxChain::Limiter::process(float* L, float* R, int n) {
    const double CEIL = std::pow(10.0, -0.3 / 20);
    for (int i = 0; i < n; ++i) {
        const double peak = std::max(std::fabs(static_cast<double>(L[i])), std::fabs(static_cast<double>(R[i])));
        const double req = peak > CEIL ? CEIL / peak : 1;
        reqs[static_cast<size_t>(boxIdx)] = req;
        double target = 1;
        for (double r : reqs) target = std::min(target, r);
        g = target < g ? target : g + (target - g) * rel;
        boxSum += g - box[static_cast<size_t>(boxIdx)];
        box[static_cast<size_t>(boxIdx)] = g;
        boxIdx = (boxIdx + 1) % Lw;
        const double gain = boxSum / Lw;
        const int rd = (idx + 1) % Lw;
        const float dl = ringL[static_cast<size_t>(rd)], dr = ringR[static_cast<size_t>(rd)];
        ringL[static_cast<size_t>(idx)] = L[i];
        ringR[static_cast<size_t>(idx)] = R[i];
        idx = rd;
        const double ol = clampd(dl * gain, -CEIL, CEIL), orr = clampd(dr * gain, -CEIL, CEIL);
        L[i] = std::isfinite(ol) ? static_cast<float>(ol) : 0.f;
        R[i] = std::isfinite(orr) ? static_cast<float>(orr) : 0.f;
    }
    double s = 0;
    for (double b : box) s += b;
    boxSum = s;
}

/* ---------------- la chaine ---------------- */

void FxChain::prepare(double sr) {
    sr_ = sr;
    for (int t = 0; t < kTracks; ++t) {
        tl_[static_cast<size_t>(t)].assign(kMaxBlock, 0.f);
        tr_[static_cast<size_t>(t)].assign(kMaxBlock, 0.f);
        sChorus_[static_cast<size_t>(t)].prepare(sr);
        sTone_[static_cast<size_t>(t)] = Tone{};
        sDist_[static_cast<size_t>(t)] = Dist{};
    }
    padsChorus_.prepare(sr);
    padsTone_ = Tone{};
    kickTone_ = Tone{};
    padsDist_ = Dist{};
    kickDist_ = Dist{};
    delay_.prepare(sr);
    reverb_.prepare(sr);
    glue_ = Glue{};
    limiter_.prepare(sr);
    for (auto* v : {&padsL_, &padsR_, &kickL_, &kickR_, &revL_, &revR_, &delL_, &delR_, &wetL_, &wetR_, &mL_, &mR_}) v->assign(kMaxBlock, 0.f);
    tail_.fill(0);
}

void FxChain::reset() { prepare(sr_); }

void FxChain::setGlobal(const GlobalFx& g, double bpm) {
    g_ = g;
    const double x = FxLaws::xtoneHz(g.xtone);
    padsDist_.set(g.drive, x, sr_);
    kickDist_.set(g.drive, x, sr_);
    padsTone_.set(g.tone, sr_);
    kickTone_.set(g.tone, sr_);
    padsChorus_.set(g.chorus, FxLaws::chorusMul(g.crate), FxLaws::chorusDepth(g.cdepth));
    delay_.time = FxLaws::delaySeconds(g.dtime, bpm);
    delay_.fb = FxLaws::delayFeedback(g.dfb);
    delay_.lp.lowpass(std::min(FxLaws::dtoneHz(g.dtone), sr_ / 2), sr_);
    for (int t = 0; t < kTracks; ++t) setSlice(t, slice_[static_cast<size_t>(t)], kick_[static_cast<size_t>(t)]);
}

void FxChain::setSlice(int t, const SliceFx& s, bool kickLane) {
    if (t < 0 || t >= kTracks) return;
    slice_[static_cast<size_t>(t)] = s;
    kick_[static_cast<size_t>(t)] = kickLane;
    sTone_[static_cast<size_t>(t)].set(s.tone, sr_);
    sDist_[static_cast<size_t>(t)].set(s.dist, FxLaws::xtoneHz(g_.xtone), sr_);
    sChorus_[static_cast<size_t>(t)].set(s.chorus, FxLaws::chorusMul(g_.crate), FxLaws::chorusDepth(g_.cdepth));
}

void FxChain::clearTracks(int n) {
    for (int t = 0; t < kTracks; ++t) {
        std::memset(tl_[static_cast<size_t>(t)].data(), 0, sizeof(float) * static_cast<size_t>(n));
        std::memset(tr_[static_cast<size_t>(t)].data(), 0, sizeof(float) * static_cast<size_t>(n));
        active_[static_cast<size_t>(t)] = false;
    }
}

void FxChain::process(float* outL, float* outR, int n) {
    if (nextIR_ != reverb_.ir && !(nextIR_ == nullptr && reverb_.ir == nullptr)) reverb_.attach(nextIR_);
    for (auto* v : {&padsL_, &padsR_, &kickL_, &kickR_, &revL_, &revR_, &delL_, &delR_})
        std::memset(v->data(), 0, sizeof(float) * static_cast<size_t>(n));
    const double lv = g_.level * g_.level; // LEVEL au carre : le bus et les prises des envois
    // Les tranches : TONE, DIST, CHORUS, puis le bus (kick ou pads) et les envois de la piste
    for (int t = 0; t < kTracks; ++t) {
        const size_t ti = static_cast<size_t>(t);
        const SliceFx& s = slice_[ti];
        const bool chorusOn = sChorus_[ti].t > 0;
        if (active_[ti]) tail_[ti] = chorusOn ? static_cast<int>(0.06 * sr_ / 64) + 4 : 0;
        else if (tail_[ti] > 0) --tail_[ti];
        if (!active_[ti] && tail_[ti] <= 0) continue;
        float* L = tl_[ti].data();
        float* R = tr_[ti].data();
        sTone_[ti].process(L, R, n);
        sDist_[ti].process(L, R, n);
        if (chorusOn) sChorus_[ti].process(L, R, n, sr_);
        float* bL = kick_[ti] ? kickL_.data() : padsL_.data();
        float* bR = kick_[ti] ? kickR_.data() : padsR_.data();
        const double rs = s.reverb * REVERB_SEND * lv, ds = s.delay * DELAY_SEND * lv;
        for (int i = 0; i < n; ++i) {
            bL[i] += L[i];
            bR[i] += R[i];
            if (rs > 0) {
                revL_[static_cast<size_t>(i)] += static_cast<float>(L[i] * rs);
                revR_[static_cast<size_t>(i)] += static_cast<float>(R[i] * rs);
            }
            if (ds > 0) {
                delL_[static_cast<size_t>(i)] += static_cast<float>(L[i] * ds);
                delR_[static_cast<size_t>(i)] += static_cast<float>(R[i] * ds);
            }
        }
    }
    // Le bus des pads : DIST, TONE, CHORUS globaux ; ses envois globaux ; le bus du kick : DIST et TONE seulement
    padsDist_.process(padsL_.data(), padsR_.data(), n);
    padsTone_.process(padsL_.data(), padsR_.data(), n);
    padsChorus_.process(padsL_.data(), padsR_.data(), n, sr_);
    kickDist_.process(kickL_.data(), kickR_.data(), n);
    kickTone_.process(kickL_.data(), kickR_.data(), n);
    const double gr = g_.reverb * REVERB_SEND * lv, gd = g_.delay * DELAY_SEND * lv;
    for (int i = 0; i < n; ++i) {
        const size_t ii = static_cast<size_t>(i);
        if (gr > 0) {
            revL_[ii] += static_cast<float>(padsL_[ii] * gr);
            revR_[ii] += static_cast<float>(padsR_[ii] * gr);
        }
        if (gd > 0) {
            delL_[ii] += static_cast<float>(padsL_[ii] * gd);
            delR_[ii] += static_cast<float>(padsR_[ii] * gd);
        }
        mL_[ii] = static_cast<float>((padsL_[ii] + kickL_[ii]) * lv);
        mR_[ii] = static_cast<float>((padsR_[ii] + kickR_[ii]) * lv);
    }
    // Les retours (sans LEVEL : il est deja sur les prises)
    delay_.process(delL_.data(), delR_.data(), wetL_.data(), wetR_.data(), n, sr_);
    for (int i = 0; i < n; ++i) {
        mL_[static_cast<size_t>(i)] += wetL_[static_cast<size_t>(i)];
        mR_[static_cast<size_t>(i)] += wetR_[static_cast<size_t>(i)];
    }
    reverb_.process(revL_.data(), revR_.data(), wetL_.data(), wetR_.data(), n);
    for (int i = 0; i < n; ++i) {
        mL_[static_cast<size_t>(i)] += wetL_[static_cast<size_t>(i)];
        mR_[static_cast<size_t>(i)] += wetR_[static_cast<size_t>(i)];
    }
    masterOnly(mL_.data(), mR_.data(), n);
    for (int i = 0; i < n; ++i) {
        outL[i] += mL_[static_cast<size_t>(i)];
        outR[i] += mR_[static_cast<size_t>(i)];
    }
}

void FxChain::masterOnly(float* L, float* R, int n) {
    glue_.process(L, R, n, g_, sr_);
    for (int i = 0; i < n; ++i) {
        L[i] = static_cast<float>(L[i] * RYTM_TRIM);
        R[i] = static_cast<float>(R[i] * RYTM_TRIM);
    }
    limiter_.process(L, R, n);
}

} // namespace mm
