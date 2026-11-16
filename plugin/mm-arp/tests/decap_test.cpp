// La DISTO facon Decapitator (dsp/Decap.{h,cpp}, 2026-11-16) : les controles du banc du site (scripts/disto-bench.mjs)
// refaits sur le port C++. Aucun son ne sort : tout est calcule en memoire.
//   - contournee (DRIVE 0) : la sortie est l'entree au bit pres ; MM a OUTPUT 0 dB aussi
//   - chaque style plat en petit signal a 50 Hz et 1 kHz (pre et desaccentuation inverses)
//   - MIX 0 % : le sec retarde de kLatency au bit pres ; MIX 50 % sans creux (sec et mouille en phase)
//   - repliement d'un sinus de 7.3 kHz ecrete a fond (E et P, PUNISH) sous -60 dBc sous 20 kHz
//   - pas de continu, AUTO au meme niveau a 4 dB pres sur un arpege percussif synthetique, pas de clic (mise en route, STYLE, arret), stable a fond

#include "../dsp/Decap.h"

#include <chrono>
#include <cmath>
#include <complex>
#include <cstdio>
#include <cstdlib>
#include <set>
#include <vector>

using mmarp::Decap;
using mmarp::DecapSettings;

namespace {

constexpr double kSr = 48000;
constexpr double kPi = 3.14159265358979323846;
int fails = 0;

void check(const char* name, bool ok, const char* fmt = "", double a = 0, double b = 0, double c = 0) {
    std::printf("%s %-48s ", ok ? "OK  " : "FAIL", name);
    std::printf(fmt, a, b, c);
    std::printf("\n");
    if (!ok) ++fails;
}

struct Change {
    int at;
    DecapSettings s;
};

void render(std::vector<float>& L, std::vector<float>& R, DecapSettings s, const std::vector<Change>& ch = {}) {
    Decap d;
    d.prepare(kSr);
    d.set(s);
    size_t ci = 0;
    for (int i = 0; i < static_cast<int>(L.size()); i += 128) {
        while (ci < ch.size() && ch[ci].at <= i) d.set(ch[ci++].s);
        const int m = std::min(128, static_cast<int>(L.size()) - i);
        d.process(L.data() + i, R.data() + i, m);
    }
}

std::vector<float> sine(double f, double amp, int n) {
    std::vector<float> a(n);
    for (int i = 0; i < n; ++i) a[i] = static_cast<float>(amp * std::sin(2 * kPi * f * i / kSr));
    return a;
}

/** Un arpege de deux dents de scie, a -24 dBFS efficaces (le niveau de la prise). */
std::vector<float> arp(int n) {
    std::vector<float> a(n);
    const int notes[8] = {54, 57, 61, 64, 66, 61, 57, 52};
    double p1 = 0, p2 = 0;
    for (int i = 0; i < n; ++i) {
        const int step = i / 6000;
        const double f = 440 * std::pow(2.0, (notes[step % 8] - 69) / 12.0);
        const double t = (i % 6000) / kSr;
        p1 = std::fmod(p1 + f / kSr, 1.0);
        p2 = std::fmod(p2 + f * 1.003 / kSr, 1.0);
        a[i] = static_cast<float>(std::exp(-t * 12) * ((2 * p1 - 1) + (2 * p2 - 1)) * 0.5);
    }
    double s = 0;
    for (float v : a) s += v * v;
    const double g = std::pow(10.0, -24 / 20.0) / std::sqrt(s / n);
    for (float& v : a) v = static_cast<float>(v * g);
    return a;
}

double rms(const std::vector<float>& a, int from) {
    double s = 0;
    for (size_t i = from; i < a.size(); ++i) s += double(a[i]) * a[i];
    return std::sqrt(s / std::max<size_t>(1, a.size() - from));
}
double db(double x) { return 20 * std::log10(std::max(1e-12, x)); }

void fft(std::vector<std::complex<double>>& a) {
    const size_t n = a.size();
    for (size_t i = 1, j = 0; i < n; ++i) {
        size_t bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) std::swap(a[i], a[j]);
    }
    for (size_t len = 2; len <= n; len <<= 1) {
        const std::complex<double> wl = std::polar(1.0, -2 * kPi / len);
        for (size_t i = 0; i < n; i += len) {
            std::complex<double> w = 1;
            for (size_t k = 0; k < len / 2; ++k) {
                const auto u = a[i + k], v = a[i + k + len / 2] * w;
                a[i + k] = u + v;
                a[i + k + len / 2] = u - v;
                w *= wl;
            }
        }
    }
}

DecapSettings base(int style, double drive, bool autoGain = false) {
    DecapSettings s;
    s.style = style;
    s.drive = drive;
    s.autoGain = autoGain;
    s.ref = 1;
    return s;
}

} // namespace

int main() {
    const int skip = 4800;
    const char* names = "AENTP";

    // 1. Contournee, au bit pres
    {
        auto L = arp(48000), R = arp(48000);
        const auto L0 = L, R0 = R;
        render(L, R, base(0, 0));
        check("DRIVE 0 : sortie = entree au bit pres", L == L0 && R == R0);
        auto M = arp(48000), N = arp(48000);
        DecapSettings s = base(0, 0.5);
        s.mm = true;
        render(M, N, s);
        check("MM, OUTPUT 0 dB : sortie = entree au bit pres", M == L0 && N == R0);
    }
    // 2. Plat en petit signal : DRIVE au plus bas engage (1e-3), sinus a -80 dBFS
    for (int st = 0; st < 5; ++st) {
        double g[2];
        const double fs[2] = {50, 1000};
        for (int k = 0; k < 2; ++k) {
            auto L = sine(fs[k], 1e-4, 24000), R = L;
            const double in = rms(L, skip);
            render(L, R, base(st, 1e-3));
            g[k] = db(rms(L, skip)) - db(in);
        }
        char name[64];
        std::snprintf(name, sizeof name, "style %c plat en petit signal", names[st]);
        check(name, std::fabs(g[0]) < 0.3 && std::fabs(g[1]) < 0.3, "50 Hz %.2f dB, 1 kHz %.2f dB", g[0], g[1]);
    }
    // 3. MIX
    {
        auto L = sine(3000, 1e-4, 24000), R = L;
        const auto in = L;
        DecapSettings s = base(2, 1e-3);
        s.mix = 0;
        render(L, R, s);
        double err = 0;
        for (int i = skip; i < 24000; ++i) err = std::max(err, std::fabs(double(L[i]) - in[i - Decap::kLatency]));
        check("MIX 0 % : le sec retarde de 32 echantillons", err < 1e-7, "ecart %.1e", err);
        auto A = in, B = in, C = in, D = in;
        s.mix = 0.5;
        render(A, B, s);
        s.mix = 1;
        render(C, D, s);
        const double r = db(rms(A, skip)) - db(rms(C, skip));
        check("MIX 50 % sans creux (en phase)", std::fabs(r) < 0.6, "%.2f dB contre 100 %% a 3 kHz", r);
    }
    // 4. Repliement
    for (int st : {1, 4}) {
        const int N = 65536;
        const double f0 = 7300.78125;
        auto L = sine(f0, 0.25, N + 2 * skip), R = L;
        DecapSettings s = base(st, 1, true);
        s.punish = true;
        render(L, R, s);
        std::vector<std::complex<double>> a(N);
        for (int i = 0; i < N; ++i) a[i] = L[skip + i] * (0.5 - 0.5 * std::cos(2 * kPi * i / N));
        fft(a);
        auto bin = [&](double f) { return static_cast<int>(std::lround(f * N / kSr)); };
        std::set<int> hb;
        for (int h = 1; h * f0 < kSr / 2; ++h)
            for (int d = -3; d <= 3; ++d) hb.insert(bin(h * f0) + d);
        double harm = 0, alias = 0;
        for (int k = 3; k < N / 2; ++k) {
            const double p = std::norm(a[k]);
            if (hb.count(k)) harm += p;
            else if (k < bin(20000)) alias += p;
        }
        const double r = 10 * std::log10(alias / harm);
        char name[64];
        std::snprintf(name, sizeof name, "repliement style %c PUNISH a fond", names[st]);
        check(name, r < -60, "%.1f dBc sous 20 kHz", r);
    }
    // 5. Continu
    {
        auto L = arp(96000), R = L;
        render(L, R, base(3, 40.0 / 36, true));
        double m = 0;
        for (int i = skip; i < 96000; ++i) m += L[i];
        m /= 96000 - skip;
        check("pas de continu (T a +40 dB)", std::fabs(m) < 1e-3, "%.2e", m);
    }
    // 6. AUTO
    {
        double worst = 0;
        for (int st = 0; st < 5; ++st)
            for (double d : {3.0, 15.0, 27.0, 36.0}) {
                auto L = arp(96000), R = L;
                const double in = rms(L, skip);
                render(L, R, base(st, d / 36, true));
                const double e = db(rms(L, skip)) - db(in);
                if (std::getenv("DECAP_VERBOSE")) std::printf("  AUTO %c %4.0f dB : %+.2f dB\n", names[st], d, e);
                worst = std::max(worst, std::fabs(e));
            }
        // Une compensation statique (comme celle d'un Decapitator) : mesuree sur les arpeges du moteur (INIT, ACID : 1.2 dB
        // au pire, disto-bench.mjs) ; cet arpege synthetique, tres percussif, gagne jusqu'a ~3.7 dB une fois ecrase
        check("AUTO : meme niveau (arpege percussif, 4 dB)", worst < 4, "ecart max %.2f dB", worst);
    }
    // 7. Pas de clic
    {
        auto L = arp(96000), R = L;
        double ref = 0;
        for (int i = 1; i < 96000; ++i) ref = std::max(ref, std::fabs(double(L[i]) - L[i - 1]));
        DecapSettings off = base(0, 0, true), on = base(0, 24.0 / 36, true), p = on;
        p.style = 4;
        DecapSettings stop = p;
        stop.drive = 0;
        render(L, R, off, {{24000, on}, {48000, p}, {72000, stop}});
        double jump = 0;
        for (int i = 1; i < 96000; ++i) jump = std::max(jump, std::fabs(double(L[i]) - L[i - 1]));
        check("mise en route, STYLE, arret sans clic", jump < ref * 3, "saut %.4f (entree %.4f)", jump, ref);
    }
    // 8. Stable a fond
    {
        auto L = sine(60, 4, 24000), R = L;
        DecapSettings s = base(4, 1);
        s.punish = s.thump = s.steep = true;
        s.low = 1;
        s.tone = 1;
        s.high = 0;
        render(L, R, s);
        bool fin = true;
        for (float v : L) fin = fin && std::isfinite(v);
        check("stable a fond (LOW CUT, THUMP, STEEP, +56 dB)", fin);
    }
    // 9. CPU : une seconde stereo
    {
        auto L = arp(48000), R = L;
        const auto t0 = std::chrono::steady_clock::now();
        render(L, R, base(0, 0.5, true));
        const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
        check("CPU x8", ms < 200, "%.0f ms par seconde d'audio", ms);
    }
    std::printf("\n%s\n", fails ? "ECHEC" : "tous les controles OK");
    return fails ? 1 : 0;
}
