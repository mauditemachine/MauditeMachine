// v49 (2026-11-23, Mika : "eviter a tout prix la latence sur Ableton, le moins de ms possible") : LATENCY ZERO, sans son.
// Les demi-bandes RII a phase minimale (dsp/Halfband.h) contre les RIF a phase lineaire du site (Kaiser) :
//   1. les filtres : la cascade des decimateurs du moteur (x2, x4, x8) a 44.1 et 48 kHz : reponse en amplitude a +/-0.1 dB
//      de celle des RIF jusqu'a 18 kHz, et le repliement (tout ce qui retombe dans 0..20 kHz) au plus celui des RIF ;
//   2. le moteur (Voyager, CLASSIC et PRO, tous les taux) : latencySamples() = 0, ni NaN ni sous-normaux, spectre par
//      tiers d'octave a +/-0.1 dB d'EXACT jusqu'a 18 kHz, l'avance mesuree ; les demi-bandes seules au bit pres en blocs de
//      1, 37, 128 et 512, le moteur pas plus sensible aux blocs qu'EXACT ; EXACT (le defaut) inchange : la latence du
//      site ; le passage EXACT -> ZERO en jouant (au silence, sans NaN) ;
//   3. la DISTO (Decap) : latency() = 0, le sec de MIX 0 plat a +/-0.1 dB, ni retard pur, blocs au bit pres, le niveau
//      sature a +/-0.5 dB d'EXACT, FEEDBACK stable, multibande (CLEAN LOW, 3 bandes en petit signal a +/-0.1 dB) ;
//   4. WARMTH (la section master) : latence 0, un petit signal plat a +/-0.1 dB, le niveau engage a +/-0.2 dB d'EXACT ;
//      la BigSky par phaseurs (ecart sous -100 dB) ; le DELAY du site endormi (ecart sous -120 dB) ;
//   5. le cout (ms par seconde d'audio) : EXACT contre ZERO.
//   ./build-dsp/mmarp_latency_test
#include "ArpFx.h"
#include "Decap.h"
#include "Halfband.h"
#include "Sky.h"
#include "Voyager.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <complex>
#include <cstdio>
#include <cstring>
#include <limits>
#include <string>
#include <vector>

using namespace mmarp;

namespace {
int failures = 0;
void check(bool ok, const std::string& what) {
    std::printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
    if (!ok) ++failures;
}
std::string f2(double v, int d = 2) {
    char b[64];
    std::snprintf(b, sizeof b, "%.*f", d, v);
    return b;
}
constexpr double PI = 3.14159265358979323846;
using cd = std::complex<double>;
const double QNAN = std::numeric_limits<double>::quiet_NaN();

/* ---------------- 1. les filtres ---------------- */

double besselI0(double x) {
    double s = 1, t = 1;
    for (int k = 1; k < 80; ++k) {
        t *= (x / (2 * k)) * (x / (2 * k));
        s += t;
    }
    return s;
}
// la demi-bande de Kaiser des decimateurs du moteur (Voyager.cpp, Decimator::init)
std::vector<double> kaiserHb(int taps, double beta) {
    std::vector<double> h(static_cast<size_t>(taps));
    const double c = (taps - 1) / 2.0, i0b = besselI0(beta);
    double sum = 0;
    for (int k = 0; k < taps; ++k) {
        const double n = k - c;
        const double ideal = n == 0 ? 0.5 : std::sin(PI * n / 2) / (PI * n);
        const double r = n / c;
        h[static_cast<size_t>(k)] = ideal * besselI0(beta * std::sqrt(std::max(0.0, 1 - r * r))) / i0b;
        sum += h[static_cast<size_t>(k)];
    }
    for (double& x : h) x /= sum;
    return h;
}
double firMag(const std::vector<double>& h, double f) {
    cd s = 0;
    for (size_t k = 0; k < h.size(); ++k) s += h[k] * std::polar(1.0, -2 * PI * f * static_cast<double>(k));
    return std::abs(s);
}
double iirMag(const double* c, int n, double f) {
    const cd zi = std::polar(1.0, -2 * PI * f), z2 = zi * zi;
    cd a0 = 1, a1 = 1;
    for (int i = 0; i < n; ++i) (i % 2 == 0 ? a0 : a1) *= (c[i] + z2) / (1.0 + c[i] * z2);
    return std::abs(0.5 * (a0 + zi * a1));
}
struct Cascade {
    std::vector<double> f2, f4, f8;
    double c2[16], c4[16], c8[16];
    Cascade() : f2(kaiserHb(63, 8)), f4(kaiserHb(31, 9)), f8(kaiserHb(23, 10)) {
        // les memes que Voyager.cpp (LATENCY ZERO)
        IirHalfband::designN(8, 0.035, c2);
        IirHalfband::designN(4, 0.2, c4);
        IirHalfband::designN(5, 0.2, c8);
    }
    // la reponse de la cascade a f Hz (le taux de base sr, surechantillonnage os)
    double mag(bool iir, double f, double sr, int os) const {
        double m = 1;
        if (os >= 8) m *= iir ? iirMag(c8, 5, f / (8 * sr)) : firMag(f8, f / (8 * sr));
        if (os >= 4) m *= iir ? iirMag(c4, 4, f / (4 * sr)) : firMag(f4, f / (4 * sr));
        if (os >= 2) m *= iir ? iirMag(c2, 8, f / (2 * sr)) : firMag(f2, f / (2 * sr));
        return m;
    }
};
double dB(double x) { return 20 * std::log10(std::max(1e-300, x)); }

void filters() {
    const Cascade C;
    for (double sr : {44100.0, 48000.0})
        for (int os : {2, 4, 8}) {
            // la bande passante : l'ecart RII / RIF de 20 Hz a 18 kHz
            double dev = 0;
            for (double f = 20; f <= 18000; f += 10) dev = std::max(dev, std::fabs(dB(C.mag(true, f, sr, os)) - dB(C.mag(false, f, sr, os))));
            // le repliement : tout ce qui retombe sur 0..20 kHz (f = k sr +/- g, k = 1 .. os - 1, plus le haut de la bande
            // du taux x os), le pire gain par tranche de 1 kHz ; RII au plus RIF (+0.5 dB de tolerance de grille)
            double worstGap = -1e9, worstIir = -1e9, worstFir = -1e9;
            for (int bin = 0; bin < 20; ++bin) {
                double gi = -1e9, gf = -1e9;
                for (double g = bin * 1000.0; g <= (bin + 1) * 1000.0; g += 25)
                    for (int k = 1; k < os; ++k)
                        for (int s = -1; s <= 1; s += 2) {
                            const double f = k * sr + s * g;
                            if (f <= sr / 2 || f >= os * sr / 2) continue;
                            gi = std::max(gi, dB(C.mag(true, f, sr, os)));
                            gf = std::max(gf, dB(C.mag(false, f, sr, os)));
                        }
                worstGap = std::max(worstGap, gi - std::max(gf, -90.0));
                worstIir = std::max(worstIir, gi);
                worstFir = std::max(worstFir, gf);
            }
            // "pas pire" : nulle part dans la bande audible le repliement RII ne depasse le pire repliement RIF (et, tranche
            // par tranche, il reste sous celui du RIF ou sous -90 dB)
            check(dev <= 0.1 && worstIir <= worstFir && worstGap <= 0.5,
                  "filtres x" + std::to_string(os) + " a " + f2(sr / 1000, 1) + " kHz : RII contre RIF jusqu'a 18 kHz " + f2(dev, 4) + " dB ; repliement sur 0..20 kHz : RII " +
                      f2(worstIir, 1) + " dB, RIF " + f2(worstFir, 1) + " dB au pire (ecart par tranche de 1 kHz " + f2(worstGap, 1) + " dB)");
        }
    // le retard de groupe au grave (echantillons de base) : ce que ZERO garde de la latence, sans la declarer
    {
        const auto gd = [&](int os, double sr) {
            const double f = 100, df = 0.01;
            const auto ph = [&](double fr) {
                cd h = 1;
                const auto st = [&](const double* c, int n, double x) {
                    const cd zi = std::polar(1.0, -2 * PI * x), z2 = zi * zi;
                    cd a0 = 1, a1 = 1;
                    for (int i = 0; i < n; ++i) (i % 2 == 0 ? a0 : a1) *= (c[i] + z2) / (1.0 + c[i] * z2);
                    return 0.5 * (a0 + zi * a1);
                };
                if (os >= 8) h *= st(C.c8, 5, fr / (8 * sr));
                if (os >= 4) h *= st(C.c4, 4, fr / (4 * sr));
                if (os >= 2) h *= st(C.c2, 8, fr / (2 * sr));
                return std::arg(h);
            };
            return -(ph(f + df) - ph(f)) / (2 * PI * df) * sr;
        };
        check(gd(2, 48000) < 2.5 && gd(4, 48000) < 3 && gd(8, 48000) < 3.5,
              "retard de groupe a 100 Hz (non declare, en echantillons de base) : x2 " + f2(gd(2, 48000)) + ", x4 " + f2(gd(4, 48000)) + ", x8 " + f2(gd(8, 48000)) +
                  " (RIF : 16, 19, 21)");
    }
}

/* ---------------- 2. le moteur ---------------- */

ParamKV P(const char* id, double v) { return {Voyager::paramIndex(id), v}; }

struct Render {
    std::vector<float> L, R;
    int latency = -1;
    bool finite = true;
    int denorm = 0;
};
// un arpege brillant (scie ouverte, un peu de FM et de STACK : de l'energie jusqu'a 18 kHz), notes posees d'avance
Render engine(bool zl, bool pro, int os, int block, double seconds, double sr = 48000, bool switchMid = false, bool single = false) {
    VoyagerOptions o;
    o.sampleRate = sr;
    o.os = os;
    o.zeroLatency = zl && !switchMid;
    Voyager v(o);
    v.setPro(pro);
    const ParamKV kv[] = {P("wave1", 2), P("wave2", 2), P("cutoff", 16000), P("res", 0.3), P("fm", 0.25), P("stack", 12), P("aR", 0.4), P("drive", 0.4)};
    v.params(kv, static_cast<int>(sizeof kv / sizeof kv[0]));
    const int notes[] = {36, 48, 60, 67, 72, 79, 84, 91, 96, 72, 60, 48};
    // (single : une note a 0, les blocs ne la decalent pas ; les notes posees d'avance tombent au bloc qui les contient,
    // comme au site : leur moment depend de la taille des blocs)
    if (single) {
      v.note(0, 72, 1.5, 1, QNAN, 0, 0.8);
      v.note(0, 79, 1.5, 1, QNAN, 0, 0.8);
    } else
      for (int k = 0; k < 64; ++k) v.note(0.05 + k * 0.11, notes[k % 12], 0.09, 1, QNAN, 0, 0.8);
    Render r;
    const int n = static_cast<int>(seconds * sr);
    r.L.resize(static_cast<size_t>(n));
    r.R.resize(static_cast<size_t>(n));
    for (int i = 0; i < n; i += block) {
        const int m = std::min(block, n - i);
        if (switchMid && i >= n / 2 && i - block < n / 2) v.setZeroLatency(zl);
        v.process(r.L.data() + i, r.R.data() + i, m);
    }
    r.latency = v.latencySamples();
    for (size_t i = 0; i < r.L.size(); ++i)
        for (float x : {r.L[i], r.R[i]}) {
            if (!std::isfinite(x)) r.finite = false;
            if (x != 0 && std::fabs(x) < 1e-30f) ++r.denorm;
        }
    return r;
}

void fft(std::vector<cd>& a) {
    const size_t n = a.size();
    for (size_t i = 1, j = 0; i < n; ++i) {
        size_t bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) std::swap(a[i], a[j]);
    }
    for (size_t len = 2; len <= n; len <<= 1) {
        const cd w = std::polar(1.0, -2 * PI / static_cast<double>(len));
        for (size_t i = 0; i < n; i += len) {
            cd u = 1;
            for (size_t k = 0; k < len / 2; ++k) {
                const cd x = a[i + k], y = a[i + k + len / 2] * u;
                a[i + k] = x + y;
                a[i + k + len / 2] = x - y;
                u *= w;
            }
        }
    }
}
// la puissance moyenne (Hann, 8192 points, 50 %) par tiers d'octave, de 50 Hz a 18 kHz
std::vector<double> thirds(const std::vector<float>& x, double sr, std::vector<double>* centers = nullptr) {
    const int N = 8192;
    std::vector<double> psd(N / 2 + 1, 0);
    int frames = 0;
    for (size_t s = 0; s + N <= x.size(); s += N / 2) {
        std::vector<cd> a(N);
        for (int i = 0; i < N; ++i) a[static_cast<size_t>(i)] = static_cast<double>(x[s + static_cast<size_t>(i)]) * (0.5 - 0.5 * std::cos(2 * PI * i / N));
        fft(a);
        for (int k = 0; k <= N / 2; ++k) psd[static_cast<size_t>(k)] += std::norm(a[static_cast<size_t>(k)]);
        ++frames;
    }
    std::vector<double> out;
    for (double fc = 50; fc <= 18000 * 1.0001; fc *= std::pow(2.0, 1.0 / 3)) {
        const double lo = fc / std::pow(2.0, 1.0 / 6), hi = std::min(18000.0, fc * std::pow(2.0, 1.0 / 6));
        double e = 0;
        for (int k = 0; k <= N / 2; ++k) {
            const double f = k * sr / N;
            if (f >= lo && f < hi) e += psd[static_cast<size_t>(k)];
        }
        out.push_back(10 * std::log10(e / std::max(1, frames) + 1e-300));
        if (centers) centers->push_back(fc);
    }
    return out;
}
// l'avance de b sur a (echantillons) : le maximum de l'intercorrelation, de -64 a +64
int lead(const std::vector<float>& a, const std::vector<float>& b) {
    int best = 0;
    double bv = -1e300;
    const size_t n = std::min(a.size(), b.size());
    for (int d = -64; d <= 64; ++d) {
        double s = 0;
        for (size_t i = 100000; i < std::min(n, static_cast<size_t>(200000)); ++i) {
            const long j = static_cast<long>(i) + d;
            if (j >= 0 && static_cast<size_t>(j) < n) s += static_cast<double>(a[static_cast<size_t>(j)]) * b[i];
        }
        if (s > bv) {
            bv = s;
            best = d;
        }
    }
    return best;
}

void engineTests() {
    struct Mode {
        bool pro;
        int os;
        const char* name;
    } modes[] = {{false, 2, "CLASSIC ECO x2"}, {false, 4, "CLASSIC STD x4"}, {false, 8, "CLASSIC HQ x8"}, {true, 1, "PRO ECO x1"}, {true, 2, "PRO STD x2"}, {true, 4, "PRO HQ x4"}};
    for (const Mode& md : modes)
        for (double sr : {44100.0, 48000.0}) {
            const Render ex = engine(false, md.pro, md.os, 128, 8, sr);
            const Render z = engine(true, md.pro, md.os, 128, 8, sr);
            std::vector<double> fc;
            const auto te = thirds(ex.L, sr, &fc), tz = thirds(z.L, sr);
            double dev = 0, at = 0;
            for (size_t b = 0; b < te.size(); ++b)
                if (te[b] > -100 && std::fabs(tz[b] - te[b]) > dev) {
                    dev = std::fabs(tz[b] - te[b]);
                    at = fc[b];
                }
            const int ld = lead(ex.L, z.L);
            const bool expectLat = md.os > 1;
            check(z.latency == 0 && (ex.latency > 0) == expectLat && z.finite && z.denorm == 0 && dev <= 0.1,
                  std::string(md.name) + " a " + f2(sr / 1000, 1) + " kHz : latence ZERO " + std::to_string(z.latency) + " (EXACT " + std::to_string(ex.latency) +
                      "), tiers d'octave 50 Hz - 18 kHz a " + f2(dev, 3) + " dB d'EXACT (pire a " + f2(at, 0) + " Hz), ZERO en avance de " + std::to_string(ld) + " ech.");
        }
    // les blocs. Les demi-bandes RII seules (le decimateur x8 -> x1 du moteur) : blocs de 1, 37, 128 et 512 au bit pres
    // entre eux. Le moteur, lui, n'est pas invariant au bit pres au decoupage, EXACT compris (pro_test : les evenements
    // et les quanta de 128) : ZERO ne doit pas l'etre moins (l'ecart max entre blocs de 1, 37, 512 et 128).
    {
        double c2[16], c4[16], c8[16];
        IirHalfband::designN(8, 0.035, c2);
        IirHalfband::designN(4, 0.2, c4);
        IirHalfband::designN(5, 0.2, c8);
        uint32_t rs = 12345u;
        std::vector<double> in(8 * 48000);
        for (double& x : in) {
            rs = rs * 1664525u + 1013904223u;
            x = (rs >> 8) * (2.0 / 16777216.0) - 1;
        }
        const auto dec = [&](int blk) {
            IirDown2 s2, s4, s8;
            s2.set(c2, 8);
            s4.set(c4, 4);
            s8.set(c8, 5);
            std::vector<double> out;
            for (size_t i = 0; i < in.size() / 8; i += static_cast<size_t>(blk))
                for (size_t k = i; k < std::min(in.size() / 8, i + static_cast<size_t>(blk)); ++k) {
                    const double* x = &in[8 * k];
                    const double a = s8.run(x[0], x[1]);
                    const double b = s8.run(x[2], x[3]);
                    const double c = s8.run(x[4], x[5]);
                    const double d = s8.run(x[6], x[7]);
                    const double e = s4.run(a, b);
                    const double f = s4.run(c, d);
                    out.push_back(s2.run(e, f));
                }
            return out;
        };
        const auto r128 = dec(128);
        bool same = true;
        for (int blk : {1, 37, 512}) same = same && dec(blk) == r128;
        check(same, "demi-bandes RII x8 -> x1 : blocs de 1, 37, 128, 512 au bit pres entre eux");
    }
    for (int pro = 0; pro <= 1; ++pro) {
        const int os = pro ? 2 : 4;
        double dz = 0, de = 0;
        for (int zl = 0; zl <= 1; ++zl) {
            const Render a = engine(zl != 0, pro != 0, os, 128, 1.5, 48000, false, true);
            for (int blk : {1, 37, 512}) {
                const Render b = engine(zl != 0, pro != 0, os, blk, 1.5, 48000, false, true);
                for (size_t i = 0; i < a.L.size(); ++i) (zl ? dz : de) = std::max(zl ? dz : de, static_cast<double>(std::fabs(a.L[i] - b.L[i])));
            }
        }
        check(dz <= de * 1.5 + 1e-9, std::string(pro ? "PRO x2" : "CLASSIC x4") + " : ecart max entre blocs de 1, 37, 128, 512 : ZERO " + f2(dz, 6) + " (EXACT " + f2(de, 6) + ")");
    }
    // EXACT (le defaut) : la latence du site ; ZERO demande en jouant : le changement attend le silence, puis 0
    {
        VoyagerOptions o;
        Voyager v(o);
        check(!v.zeroLatency() && v.latencySamples() == 19, "EXACT par defaut (le site) : latence 19 en x4");
        const Render sw = engine(true, false, 4, 128, 6, 48000, true);
        check(sw.finite && sw.denorm == 0 && sw.latency == 0, "EXACT -> ZERO en jouant : fini, sans sous-normaux, latence 0 apres le silence");
    }
}

/* ---------------- 3. la DISTO ---------------- */

struct DRun {
    std::vector<float> L, R;
    int latency = -1;
    double ms = 0;
};
DRun decap(const DecapSettings& s, const std::vector<float>& in, int block) {
    Decap d;
    d.prepare(48000);
    d.set(s);
    DRun r;
    r.L = in;
    r.R = in;
    const auto t0 = std::chrono::steady_clock::now();
    for (size_t i = 0; i < in.size(); i += static_cast<size_t>(block)) {
        const int m = static_cast<int>(std::min(static_cast<size_t>(block), in.size() - i));
        d.process(r.L.data() + i, r.R.data() + i, m);
    }
    r.ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count() / (static_cast<double>(in.size()) / 48000);
    r.latency = d.latency();
    return r;
}
std::vector<float> bassLine(int n) {
    std::vector<float> x(static_cast<size_t>(n));
    double ph = 0;
    for (int i = 0; i < n; ++i) {
        const double t = i / 48000.0;
        const int step = static_cast<int>(t * 8);
        const double f = 55 * std::pow(2.0, ((step * 5) % 12) / 12.0);
        ph += f / 48000;
        ph -= std::floor(ph);
        const double env = std::exp(-6 * (t * 8 - step));
        x[static_cast<size_t>(i)] = static_cast<float>(0.5 * env * (2 * ph - 1));
    }
    return x;
}
double rmsDb(const std::vector<float>& x, size_t from = 0) {
    double s = 0;
    for (size_t i = from; i < x.size(); ++i) s += static_cast<double>(x[i]) * x[i];
    return 10 * std::log10(s / static_cast<double>(x.size() - from) + 1e-30);
}

void decapTests() {
    const int n = 48000 * 3;
    const std::vector<float> in = bassLine(n);
    DecapSettings s;
    s.style = Decap::STYLE_A;
    s.drive = 0.6;
    DecapSettings z = s;
    z.zeroLatency = true;
    const DRun ex = decap(s, in, 128), zr = decap(z, in, 128);
    bool fin = true;
    for (float v : zr.L) fin = fin && std::isfinite(v);
    const double dl = rmsDb(zr.L, 9600) - rmsDb(ex.L, 9600);
    check(zr.latency == 0 && ex.latency == Decap::kLatency && fin && std::fabs(dl) <= 0.5,
          "DISTO A ZERO : latence " + std::to_string(zr.latency) + " (EXACT " + std::to_string(ex.latency) + "), fini, niveau " + f2(dl, 3) + " dB d'EXACT");
    // les blocs
    {
        bool same = true;
        for (int blk : {1, 37, 512}) {
            const DRun b = decap(z, in, blk);
            same = same && std::memcmp(b.L.data(), zr.L.data(), zr.L.size() * sizeof(float)) == 0;
        }
        check(same, "DISTO ZERO : blocs de 1, 37, 128, 512 au bit pres entre eux");
    }
    // MIX 0 : le sec par les demi-bandes, plat a +/-0.1 dB jusqu'a 18 kHz, sans retard pur (l'impulsion)
    {
        DecapSettings m = z;
        m.mix = 0;
        std::vector<float> imp(48000, 0.f);
        imp[24000] = 1;
        const DRun r = decap(m, imp, 128);
        int pk = 0;
        for (int i = 1; i < 48000; ++i)
            if (std::fabs(r.L[static_cast<size_t>(i)]) > std::fabs(r.L[static_cast<size_t>(pk)])) pk = i;
        std::vector<cd> a(16384);
        for (int i = 0; i < 16384; ++i) a[static_cast<size_t>(i)] = r.L[static_cast<size_t>(24000 - 2048 + i)];
        fft(a);
        double dev = 0;
        for (int k = 1; k <= 16384 * 18000 / 48000; ++k) dev = std::max(dev, std::fabs(dB(std::abs(a[static_cast<size_t>(k)]))));
        check(dev <= 0.1 && pk - 24000 < 8, "DISTO ZERO, MIX 0 : le sec plat a " + f2(dev, 4) + " dB jusqu'a 18 kHz, crete de l'impulsion a +" + std::to_string(pk - 24000) +
                                               " ech. (EXACT : +32)");
    }
    // multibande (CLEAN LOW : 2 bandes, la basse contournee) et 3 bandes, PUNISH v2, FEEDBACK a fond : fini, sous 0 dBFS + 6
    {
        DecapSettings c = z;
        c.bands = 2;
        c.band[0].bypass = true;
        c.punish2 = true;
        DecapSettings t = z;
        t.bands = 3;
        t.fb = 1;
        t.morph = 0.5;
        t.morphTo = Decap::STYLE_FUZZ;
        const DRun rc = decap(c, in, 128), rt = decap(t, in, 128);
        double pk = 0;
        bool ok = true;
        for (const DRun* r : {&rc, &rt})
            for (float v : r->L) {
                ok = ok && std::isfinite(v);
                pk = std::max(pk, static_cast<double>(std::fabs(v)));
            }
        DecapSettings ce = c, te = t;
        ce.zeroLatency = te.zeroLatency = false;
        const DRun rce = decap(ce, in, 128), rte = decap(te, in, 128);
        check(ok && pk < 2 && rc.latency == 0 && rt.latency == 0 && std::fabs(rmsDb(rc.L, 9600) - rmsDb(rce.L, 9600)) <= 0.5 && std::fabs(rmsDb(rt.L, 9600) - rmsDb(rte.L, 9600)) <= 1,
              "DISTO ZERO : CLEAN LOW + PUNISH v2 et 3 bandes + FEEDBACK + MORPH : fini, crete " + f2(pk, 3) + ", niveaux " + f2(rmsDb(rc.L, 9600) - rmsDb(rce.L, 9600), 3) +
                  " / " + f2(rmsDb(rt.L, 9600) - rmsDb(rte.L, 9600), 3) + " dB d'EXACT");
        // le multibande en petit signal (la saturation lineaire) : 3 bandes x2 / x4 / x8, coupures a 1 kHz et 10.9 kHz ; la
        // reponse de ZERO a +/-0.1 dB de celle d'EXACT de 20 Hz a 18 kHz (les bandes en phase aux coupures)
        {
            DecapSettings lz = z;
            lz.bands = 3;
            lz.drive = 0.02;
            lz.xLo = 1;
            lz.xHi = 0.9;
            lz.autoGain = false;
            DecapSettings le = lz;
            le.zeroLatency = false;
            std::vector<float> imp(65536, 0.f);
            imp[32768] = 1e-3f;
            const DRun a = decap(le, imp, 128), b = decap(lz, imp, 128);
            std::vector<cd> fa(16384), fb(16384);
            for (int i = 0; i < 16384; ++i) {
                fa[static_cast<size_t>(i)] = a.L[static_cast<size_t>(32768 - 1024 + i)];
                fb[static_cast<size_t>(i)] = b.L[static_cast<size_t>(32768 - 1024 + i)];
            }
            fft(fa);
            fft(fb);
            double dev = 0, at = 0;
            for (int k = 16384 * 20 / 48000; k <= 16384 * 18000 / 48000; ++k) {
                const double d = std::fabs(dB(std::abs(fb[static_cast<size_t>(k)])) - dB(std::abs(fa[static_cast<size_t>(k)])));
                if (d > dev) {
                    dev = d;
                    at = k * 48000.0 / 16384;
                }
            }
            check(dev <= 0.1, "DISTO ZERO, 3 bandes en petit signal (coupures 1 et 10.9 kHz) : a " + f2(dev, 4) + " dB d'EXACT de 20 Hz a 18 kHz (pire a " + f2(at, 0) + " Hz)");
        }
        // le cout
        DecapSettings one = z, oneE = s;
        const DRun a = decap(oneE, in, 128), b = decap(one, in, 128);
        std::printf("        cout DISTO, une bande : EXACT %.1f ms/s, ZERO %.1f ms/s ; 3 bandes + tout : EXACT %.1f, ZERO %.1f\n", a.ms, b.ms, rte.ms, rt.ms);
    }
}

/* ---------------- 4. WARMTH ---------------- */

void warmthTests() {
    const int n = 48000 * 2;
    const auto run = [&](bool zl, double warmth, const std::vector<float>& in, std::vector<float>& out, int& lat) {
        detail::Master m;
        m.prepare(48000);
        m.setZeroLatency(zl);
        m.set(warmth, 0.5, 0.5, 0.5, true);
        out = in;
        std::vector<float> R = in;
        for (int i = 0; i < n; i += 128) m.process(out.data() + i, R.data() + i, std::min(128, n - i));
        lat = m.latency();
    };
    // un petit signal (la courbe est lineaire) : l'impulsion, plate a +/-0.1 dB jusqu'a 18 kHz
    std::vector<float> imp(static_cast<size_t>(n), 0.f);
    imp[48000] = 1e-3f;
    std::vector<float> oz;
    int lz = -1;
    run(true, 0.5, imp, oz, lz);
    std::vector<cd> a(16384);
    for (int i = 0; i < 16384; ++i) a[static_cast<size_t>(i)] = 1000.0 * oz[static_cast<size_t>(48000 - 2048 + i)];
    fft(a);
    // (le gain de compensation de WARMTH est un gain : la reponse rapportee a 1 kHz, de 100 Hz a 18 kHz)
    const double ref = std::abs(a[static_cast<size_t>(16384 * 1000 / 48000)]);
    double dev = 0;
    for (int k = 16384 * 100 / 48000; k <= 16384 * 18000 / 48000; ++k) dev = std::max(dev, std::fabs(dB(std::abs(a[static_cast<size_t>(k)]) / ref)));
    // engagee sur une basse : le niveau d'EXACT
    const std::vector<float> in = bassLine(n);
    std::vector<float> ez, ee;
    int le = -1;
    run(true, 0.8, in, ez, lz);
    run(false, 0.8, in, ee, le);
    bool fin = true;
    for (float v : ez) fin = fin && std::isfinite(v);
    const double dl = rmsDb(ez, 4800) - rmsDb(ee, 4800);
    check(lz == 0 && le == detail::Master::kLatency && fin && dev <= 0.1 && std::fabs(dl) <= 0.2,
          "WARMTH ZERO : latence " + std::to_string(lz) + " (EXACT " + std::to_string(le) + "), petit signal plat a " + f2(dev, 4) + " dB de 100 Hz a 18 kHz, niveau engage " + f2(dl, 3) +
              " dB d'EXACT");
}

/* ---------------- 4 bis. la reverbe BigSky, modulation par phaseurs ---------------- */

void skyTests() {
    const int n = 48000 * 6;
    std::vector<float> in(static_cast<size_t>(n), 0.f);
    uint32_t rs = 777u;
    for (int i = 0; i < 48000 / 2; ++i) {
        rs = rs * 1664525u + 1013904223u;
        in[static_cast<size_t>(i)] = static_cast<float>(0.3 * ((rs >> 8) * (2.0 / 16777216.0) - 1));
    }
    double worst = -400, costE = 0, costF = 0;
    for (int m : {SKY_ROOM, SKY_HALL, SKY_PLATE, SKY_CLOUD, SKY_SHIMMER}) {
        std::vector<float> out[2][2];
        for (int fast = 0; fast <= 1; ++fast) {
            Sky s;
            s.prepare(48000);
            s.setFast(fast != 0);
            SkyNorm nrm = skyDefaults(m);
            nrm.mod = 0.8;
            s.set(m, nrm, true);
            out[fast][0].assign(static_cast<size_t>(n), 0.f);
            out[fast][1].assign(static_cast<size_t>(n), 0.f);
            const auto t0 = std::chrono::steady_clock::now();
            for (int i = 0; i < n; i += 128) s.process(in.data() + i, in.data() + i, out[fast][0].data() + i, out[fast][1].data() + i, 128);
            (fast ? costF : costE) += std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count() / 6;
        }
        double pk = 0, d = 0;
        for (int c = 0; c < 2; ++c)
            for (size_t i = 0; i < out[0][c].size(); ++i) {
                pk = std::max(pk, static_cast<double>(std::fabs(out[0][c][i])));
                d = std::max(d, static_cast<double>(std::fabs(out[0][c][i] - out[1][c][i])));
            }
        worst = std::max(worst, dB(d / std::max(1e-30, pk)));
        std::printf("        machine %d : ecart %.1f dB sous la crete\n", m, dB(d / std::max(1e-30, pk)));
    }
    check(worst < -100, "BigSky ZERO (modulation par phaseurs, 5 machines, MOD 80 %) : ecart max " + f2(worst, 1) + " dB sous la crete ; cout " + f2(costE, 1) + " -> " +
                            f2(costF, 1) + " ms/s (5 machines ensemble)");
}

/* ---------------- 4 ter. le DELAY du site endormi (envoi a 0, lignes muettes) ---------------- */

void delaySleepTests() {
    // un preset sans DELAY (la banque d'usine) : 4 s sans envoi (il s'endort apres sa ligne, 2 s), puis DELAY a 0.5 ;
    // ZERO contre EXACT (la meme chaine, sans WARMTH ni reverbe : le seul ecart est le sommeil), le cout de 2.5 a 4 s
    const int sr = 48000, n = sr * 6;
    std::vector<float> xL(static_cast<size_t>(n)), xR(static_cast<size_t>(n));
    for (int i = 0; i < n; ++i) {
        const double t = static_cast<double>(i) / sr;
        const double env = std::exp(-8 * std::fmod(t, 0.25));
        xL[static_cast<size_t>(i)] = static_cast<float>(0.3 * env * std::sin(2 * PI * 220 * t));
        xR[static_cast<size_t>(i)] = static_cast<float>(0.3 * env * std::sin(2 * PI * 330 * t));
    }
    std::vector<float> out[2][2];
    double quietMs[2] = {0, 0};
    for (int zl = 0; zl <= 1; ++zl) {
        ArpFx fx;
        fx.prepare(sr, 128);
        fx.setZeroLatency(zl != 0);
        ArpFxSettings s;
        s.delay = 0;
        fx.set(s, true);
        out[zl][0].assign(static_cast<size_t>(n), 0.f);
        out[zl][1].assign(static_cast<size_t>(n), 0.f);
        for (int i = 0; i < n; i += 128) {
            if (i == 4 * sr) {
                s.delay = 0.5;
                fx.set(s, false);
            }
            const auto t0 = std::chrono::steady_clock::now();
            fx.process(xL.data() + i, xR.data() + i, out[zl][0].data() + i, out[zl][1].data() + i, 128);
            if (i >= 5 * sr / 2 && i < 4 * sr) quietMs[zl] += std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
        }
    }
    double pk = 0, d = 0;
    bool fin = true;
    for (int c = 0; c < 2; ++c)
        for (int i = 0; i < n; ++i) {
            const float a = out[0][c][static_cast<size_t>(i)], b = out[1][c][static_cast<size_t>(i)];
            fin = fin && std::isfinite(b);
            pk = std::max(pk, static_cast<double>(std::fabs(a)));
            d = std::max(d, static_cast<double>(std::fabs(a - b)));
        }
    check(fin && dB(d / pk) < -120 && quietMs[1] < quietMs[0], "DELAY du site endormi (ZERO) : 4 s sans envoi puis DELAY, ecart avec EXACT " + f2(dB(d / pk), 1) +
                                                                  " dB sous la crete ; la chaine sans DELAY " + f2(quietMs[0] / 1.5, 1) + " -> " + f2(quietMs[1] / 1.5, 1) + " ms par seconde");
}

/* ---------------- 5. le cout du moteur ---------------- */

void engineCost() {
    for (int pro = 0; pro <= 1; ++pro) {
        const int os = pro ? 2 : 4;
        double best[2] = {1e9, 1e9};
        for (int pass = 0; pass < 3; ++pass)
            for (int zl = 0; zl <= 1; ++zl) {
                const auto t0 = std::chrono::steady_clock::now();
                engine(zl != 0, pro != 0, os, 128, 4);
                best[zl] = std::min(best[zl], std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count() / 4);
            }
        std::printf("        cout du moteur (un arpege, %s) : EXACT %.1f ms/s, ZERO %.1f ms/s\n", pro ? "PRO x2" : "CLASSIC x4", best[0], best[1]);
    }
}

} // namespace

int main() {
    filters();
    engineTests();
    decapTests();
    warmthTests();
    skyTests();
    delaySleepTests();
    engineCost();
    std::printf(failures ? "%d echec(s)\n" : "OK (0 echec)\n", failures);
    return failures ? 1 : 0;
}
