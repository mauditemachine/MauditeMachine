// La DISTO facon Decapitator (dsp/Decap.{h,cpp}, 2026-11-16) : les controles du banc du site (scripts/disto-bench.mjs)
// refaits sur le port C++. Aucun son ne sort : tout est calcule en memoire.
//   - contournee (DRIVE 0) : la sortie est l'entree au bit pres ; MM a OUTPUT 0 dB aussi
//   - chaque style plat en petit signal a 50 Hz et 1 kHz (pre et desaccentuation inverses)
//   - MIX 0 % : le sec retarde de kLatency au bit pres ; MIX 50 % sans creux (sec et mouille en phase)
//   - repliement d'un sinus de 7.3 kHz ecrete a fond (E et P, PUNISH) sous -60 dBc sous 20 kHz
//   - pas de continu, AUTO au meme niveau a 4 dB pres sur un arpege percussif synthetique, pas de clic (mise en route, STYLE, arret), stable a fond
// v25 (la page complete) :
//   - chaque style (12) : fini, borne, sans continu ; les styles doux plats en petit signal ; AUTO de chaque style
//   - MORPH : 0 au bit pres comme sans MORPH, 1 comme le style vise, entre les deux au milieu
//   - multibande : 2 et 3 bandes plates en petit signal (somme Linkwitz-Riley), toutes contournees : plates a fond, SOLO
//   - BOX (chaque caisse), PRE et POST FILTER (LP, HP, BP, PEAK), DYNAMICS (COMP, EXPAND)
//   - FEEDBACK stable a fond (AUTO ou non, trois bandes, niveaux a +12 dB) et qui s'eteint seul
//   - ENV (plus ou moins de mordant sur les forts), LFO (chaque cible ; MIX module de plus de 3 dB)
//   - la sortie ne depend pas de la taille des blocs (tout en service), MIX 0 au bit pres tout en service
//   - ni NaN ni sous-normaux ; le cout : une bande x8, et le pire cas (trois bandes, MORPH, FEEDBACK, tout)
// v46 (PUNISH v2, CLEAN LOW) :
//   - OFF et l'ancien PUNISH (OLD) au bit pres contre la DISTO d'avant (tests/decap_ref.cpp), blocs fixes et au hasard
//   - PUNISH v2 sur trois boucles (basse, lead, pluck ; styles A T P E, DRIVE 3 et 6, AUTO) : +3 +/- 1 LU (BS.1770) en
//     moyenne au-dessus du meme son sans PUNISH, chaque cas a +/- 2 ; crete <= -0.3 dBFS, meme AUTO coupe a +18 dB ;
//     aucun NaN ; entree et sortie sans clic
//   - CLEAN LOW : LOW CUT ne coupe que la bande saturee (le 50 Hz propre passe)

#include "../dsp/Decap.h"

#include <chrono>
#include <cmath>
#include <complex>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <set>
#include <vector>

using mmarp::Decap;
using mmarp::DecapSettings;

// tests/decap_ref.cpp : la DISTO d'avant la v46
void decapRefRender(const void* s, std::size_t size, float* L, float* R, int n, int block);

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

void render(std::vector<float>& L, std::vector<float>& R, DecapSettings s, const std::vector<Change>& ch = {}, int block = 128) {
    Decap d;
    d.prepare(kSr);
    d.set(s);
    size_t ci = 0;
    uint32_t r = 12345;
    for (int i = 0; i < static_cast<int>(L.size());) {
        while (ci < ch.size() && ch[ci].at <= i) d.set(ch[ci++].s);
        int m = block;
        if (block <= 0) {
            r = r * 1664525u + 1013904223u;
            m = 1 + static_cast<int>((r >> 8) % 300);
        }
        m = std::min(m, static_cast<int>(L.size()) - i);
        d.process(L.data() + i, R.data() + i, m);
        i += m;
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

// v46 : la sonie integree BS.1770 (ponderation K a 48 kHz, blocs de 400 ms a 75 %, portes -70 LUFS et -10 LU), stereo
double lufs(const std::vector<float>& L, const std::vector<float>& R, int from) {
    const auto kw = [&](const std::vector<float>& x) {
        std::vector<double> y(x.size() - from);
        double a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0;
        for (size_t i = from; i < x.size(); ++i) {
            const double in = x[i];
            const double s1 = 1.53512485958697 * in - 2.69169618940638 * a1 + 1.19839281085285 * a2 + 1.69065929318241 * b1 - 0.73248077421585 * b2;
            a2 = a1;
            a1 = in;
            b2 = b1;
            b1 = s1;
            const double s2 = s1 - 2 * c1 + c2 + 1.99004745483398 * d1 - 0.99007225036621 * d2;
            c2 = c1;
            c1 = s1;
            d2 = d1;
            d1 = s2;
            y[i - from] = s2;
        }
        return y;
    };
    const std::vector<double> l = kw(L), r = kw(R);
    const int blk = static_cast<int>(0.4 * kSr), hop = blk / 4;
    std::vector<double> z;
    for (int i = 0; i + blk <= static_cast<int>(l.size()); i += hop) {
        double s = 0;
        for (int k = i; k < i + blk; ++k) s += l[k] * l[k] + r[k] * r[k];
        z.push_back(s / blk);
    }
    const auto gated = [&](double gate) {
        double s = 0;
        int n = 0;
        for (double v : z)
            if (-0.691 + 10 * std::log10(std::max(1e-30, v)) > gate) {
                s += v;
                ++n;
            }
        return n ? -0.691 + 10 * std::log10(s / n) : -200.0;
    };
    return gated(gated(-70) - 10);
}

/** v46 : trois boucles synthetiques au niveau de la prise : une basse (octaves en doubles croches, filtre qui s'ouvre,
 *  crete -5 dBFS), un lead (deux scies, crete -15 dBFS), un pluck (scie et sinus tres courts, crete -10 dBFS). */
std::vector<float> loop(int kind, int n) {
    std::vector<float> a(n);
    const int step = 5760; // une double croche a 125 BPM
    const int bass[8] = {33, 45, 33, 45, 31, 43, 36, 48};
    const int lead[8] = {69, 72, 76, 79, 81, 76, 72, 67};
    const int pl[8] = {81, 84, 88, 86, 84, 79, 76, 79};
    double ph = 0, ph2 = 0, lp = 0;
    for (int i = 0; i < n; ++i) {
        const int k = (i / step) % 8;
        const double t = (i % step) / kSr;
        double v;
        if (kind == 0) {
            const double f = 440 * std::pow(2.0, (bass[k] - 69) / 12.0);
            ph = std::fmod(ph + f / kSr, 1.0);
            const double saw = 2 * ph - 1;
            const double fc = 200 + 2500 * std::exp(-t * 18);
            lp += (saw - lp) * (1 - std::exp(-2 * kPi * fc / kSr));
            v = std::exp(-t * 6) * (lp + 0.6 * std::sin(2 * kPi * ph));
        } else if (kind == 1) {
            const double f = 440 * std::pow(2.0, (lead[k] - 69) / 12.0);
            ph = std::fmod(ph + f / kSr, 1.0);
            ph2 = std::fmod(ph2 + f * 1.004 / kSr, 1.0);
            v = std::min(1.0, t * 200) * std::exp(-t * 3) * ((2 * ph - 1) + (2 * ph2 - 1)) * 0.5;
        } else {
            const double f = 440 * std::pow(2.0, (pl[k] - 69) / 12.0);
            ph = std::fmod(ph + f / kSr, 1.0);
            v = std::exp(-t * 28) * (0.6 * (2 * ph - 1) + std::sin(2 * kPi * ph));
        }
        a[i] = static_cast<float>(v);
    }
    double pk = 1e-9;
    for (float v : a) pk = std::max(pk, std::fabs(static_cast<double>(v)));
    const double target = std::pow(10.0, (kind == 0 ? -5 : kind == 1 ? -15 : -10) / 20.0);
    for (float& v : a) v = static_cast<float>(v * target / pk);
    return a;
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
    // 10. Chaque style : fini, borne, sans continu ; les doux plats en petit signal
    const char* const SN[12] = {"A", "E", "N", "T", "P", "TAPE", "FUZZ", "DIODE", "AMP", "RECT", "FOLD", "CRUSH"};
    {
        bool ok = true;
        double worstDc = 0, peak = 0;
        for (int st = 0; st < 12; ++st)
            for (double d : {0.2, 0.6, 1.0}) {
                auto L = arp(48000), R = L;
                DecapSettings s = base(st, d, true);
                s.punish = d >= 1;
                render(L, R, s);
                double m = 0;
                for (int i = skip; i < 48000; ++i) {
                    ok = ok && std::isfinite(L[i]);
                    m += L[i];
                    peak = std::max(peak, std::fabs(double(L[i])));
                }
                worstDc = std::max(worstDc, std::fabs(m / (48000 - skip)));
            }
        check("12 styles : finis, bornes, sans continu", ok && peak < 8 && worstDc < 2e-3, "crete %.2f, continu %.1e", peak, worstDc);
        for (int st = 5; st < 11; ++st) {
            double g[2];
            const double fs[2] = {50, 1000};
            for (int k = 0; k < 2; ++k) {
                auto L = sine(fs[k], 1e-4, 24000), R = L;
                const double in = rms(L, skip);
                render(L, R, base(st, 1e-3));
                g[k] = db(rms(L, skip)) - db(in);
            }
            char name[64];
            std::snprintf(name, sizeof name, "style %s plat en petit signal", SN[st]);
            check(name, std::fabs(g[0]) < 0.3 && std::fabs(g[1]) < 0.3, "50 Hz %.2f dB, 1 kHz %.2f dB", g[0], g[1]);
        }
        double worst = 0;
        int wst = 0;
        for (int st = 5; st < 12; ++st)
            for (double d : {6.0, 18.0, 30.0}) {
                auto L = arp(48000), R = L;
                const double in = rms(L, skip);
                render(L, R, base(st, d / 36, true));
                const double e = db(rms(L, skip)) - db(in);
                if (std::getenv("DECAP_VERBOSE")) std::printf("  AUTO %s %4.0f dB : %+.2f dB\n", SN[st], d, e);
                if (std::fabs(e) > worst) {
                    worst = std::fabs(e);
                    wst = st;
                }
            }
        check("AUTO des styles etendus (6 dB)", worst < 6, "ecart max %.2f dB", worst);
        if (worst >= 6) std::printf("     (le pire : %s)\n", SN[wst]);
        for (int st : {6, 7, 8}) {
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
            std::snprintf(name, sizeof name, "repliement style %s PUNISH a fond", SN[st]);
            check(name, r < -50, "%.1f dBc sous 20 kHz", r);
        }
    }
    // 11. MORPH
    {
        auto A = arp(48000), B = A, C = A, D = A, E = A, F = A, G = A, H = A;
        DecapSettings s = base(0, 0.6, true);
        render(A, B, s);
        DecapSettings m0 = s;
        m0.morph = 0;
        m0.morphTo = 10;
        render(C, D, m0);
        check("MORPH 0 : au bit pres comme sans MORPH", A == C && B == D);
        DecapSettings t = base(3, 0.6, true);
        render(E, F, t);
        DecapSettings m1 = s;
        m1.morph = 1;
        m1.morphTo = 3;
        render(G, H, m1);
        double err = 0, ref = 0;
        for (int i = skip; i < 48000; ++i) {
            err = std::max(err, std::fabs(double(G[i]) - E[i]));
            ref = std::max(ref, std::fabs(double(E[i])));
        }
        check("MORPH 1 : comme le style vise (T)", err < 1e-4 * ref, "ecart %.1e (crete %.2f)", err, ref);
        auto I = arp(48000), J = I;
        DecapSettings mh = s;
        mh.morph = 0.5;
        mh.morphTo = 10;
        render(I, J, mh);
        auto K = arp(48000), Kr = K;
        DecapSettings f = base(10, 0.6, true);
        render(K, Kr, f);
        double dA = 0, dF = 0;
        for (int i = skip; i < 48000; ++i) {
            dA += (double(I[i]) - A[i]) * (double(I[i]) - A[i]);
            dF += (double(I[i]) - K[i]) * (double(I[i]) - K[i]);
        }
        check("MORPH 0.5 (A vers FOLD) : entre les deux", dA > 1e-6 && dF > 1e-6, "ecarts %.2e et %.2e", dA, dF);
    }
    // 12. Multibande
    {
        // (la reponse d'une bande : celle du style, son passe-bas compris ; le multibande n'y ajoute rien)
        for (int nbands : {2, 3}) {
            double worst = 0;
            for (double f : {40.0, 150.0, 400.0, 1000.0, 2500.0, 4000.0, 12000.0}) {
                double g[2];
                for (int k = 0; k < 2; ++k) {
                    auto L = sine(f, 1e-4, 24000), R = L;
                    DecapSettings s = base(0, 1e-3);
                    s.bands = k == 0 ? 1 : nbands;
                    s.xLo = 0.4;
                    s.xHi = 0.5;
                    render(L, R, s);
                    g[k] = db(rms(L, skip));
                }
                worst = std::max(worst, std::fabs(g[1] - g[0]));
            }
            char name[64];
            std::snprintf(name, sizeof name, "%d bandes : plates en petit signal", nbands);
            check(name, worst < 0.1, "ecart max %.3f dB contre une bande (40 Hz a 12 kHz)", worst);
        }
        double worst = 0;
        for (double f : {60.0, 700.0, 6000.0}) {
            auto L = sine(f, 0.3, 24000), R = L;
            const double in = rms(L, skip);
            DecapSettings s = base(Decap::STYLE_DIODE, 1, true);
            s.punish = true;
            s.bands = 3;
            for (auto& b : s.band) b.bypass = true;
            render(L, R, s);
            worst = std::max(worst, std::fabs(db(rms(L, skip)) - db(in)));
        }
        check("3 bandes contournees : plates a fond", worst < 0.35, "ecart max %.2f dB", worst);
        auto L = sine(5000, 1e-3, 24000), R = L;
        const double in = rms(L, skip);
        DecapSettings s = base(0, 1e-3);
        s.bands = 3;
        s.band[0].solo = true;
        render(L, R, s);
        const double att = db(rms(L, skip)) - db(in);
        check("SOLO de la bande du bas : 5 kHz tombe", att < -20, "%.1f dB", att);
        auto M = arp(48000), N = M;
        DecapSettings t = base(0, 0.7, true);
        t.bands = 3;
        t.band[0].style = 2;
        t.band[1].drive = 0.8;
        t.band[2].style = 10;
        t.band[2].mix = 0.6;
        t.band[2].level = 0.4;
        render(M, N, t);
        bool fin = true;
        for (float v : M) fin = fin && std::isfinite(v) && std::fabs(v) < 8;
        check("3 bandes, styles, DRIVE, MIX, LEVEL : fini, borne", fin);
    }
    // 13. Filtres et BOX (en petit signal : la reponse)
    {
        auto resp = [&](DecapSettings s, double f) {
            auto L = sine(f, 1e-4, 24000), R = L;
            const double in = rms(L, skip);
            render(L, R, s);
            return db(rms(L, skip)) - db(in);
        };
        DecapSettings s = base(0, 1e-3);
        s.preMode = Decap::F_LP;
        s.preFreq = std::log(1000 / 20.0) / std::log(1000.0);
        const double lp = resp(s, 4000) - resp(s, 200);
        s.preMode = Decap::F_HP;
        const double hp = resp(s, 250) - resp(s, 5000);
        s.preMode = Decap::F_PEAK;
        const double pk = resp(s, 1000);
        s.preMode = Decap::F_BP;
        const double bp = resp(s, 1000) - resp(s, 100);
        check("PRE FILTER LP, HP, PEAK, BP (1 kHz)", lp < -20 && hp < -20 && std::fabs(pk - 12) < 1 && bp > 15, "LP %.1f, HP %.1f, PEAK %.1f, BP %.1f dB", lp, hp, pk);
        DecapSettings p = base(0, 1e-3);
        p.postMode = Decap::F_LP;
        p.postFreq = std::log(2000 / 20.0) / std::log(1000.0);
        p.postReso = 0.5;
        const double pk2 = resp(p, 2000), lo2 = resp(p, 200), hi2 = resp(p, 8000);
        check("POST FILTER LP resonant (2 kHz)", pk2 > 6 && std::fabs(lo2) < 1 && hi2 < -15, "pic %.1f, 200 Hz %.1f, 8 kHz %.1f dB", pk2, lo2, hi2);
        bool ok = true;
        double radio = 0;
        for (int b = 1; b <= 4; ++b) {
            DecapSettings x = base(0, 1e-3);
            x.box = b;
            const double l = resp(x, 100), m = resp(x, 1500);
            ok = ok && std::isfinite(l) && std::isfinite(m) && std::fabs(m) < 15;
            if (b == 4) radio = m - l;
        }
        check("BOX : les quatre caisses ; RADIO creuse le grave", ok && radio > 10, "RADIO 1.5 kHz contre 100 Hz %+.1f dB", radio);
    }
    // 14. DYNAMICS : l'ecart entre un passage fort et un faible
    {
        auto two = [&](double dyn) {
            std::vector<float> L(96000);
            for (int i = 0; i < 96000; ++i) L[i] = static_cast<float>((i < 48000 ? 0.5 : 0.02) * std::sin(2 * kPi * 300 * i / kSr));
            auto R = L;
            DecapSettings s = base(0, 1e-3);
            s.dyn = dyn;
            render(L, R, s);
            double a = 0, b = 0;
            for (int i = 24000; i < 46000; ++i) a += double(L[i]) * L[i];
            for (int i = 72000; i < 94000; ++i) b += double(L[i]) * L[i];
            return 10 * std::log10(a / b);
        };
        const double n0 = two(0.5), c = two(0), e = two(1);
        check("DYNAMICS : COMP resserre, EXPAND ecarte", c < n0 - 6 && e > n0 + 6, "neutre %.1f, COMP %.1f, EXPAND %.1f dB", n0, c, e);
    }
    // 15. FEEDBACK a fond : borne, puis s'eteint seul
    for (int au = 0; au < 2; ++au) {
        std::vector<float> L(48000 * 4, 0.f);
        for (int i = 0; i < 48000; ++i) L[i] = static_cast<float>(0.5 * std::sin(2 * kPi * 110 * i / kSr));
        auto R = L;
        DecapSettings s = base(6, 1, au == 1);
        s.punish = true;
        s.fb = 1;
        s.fbFreq = 0.3;
        s.bands = 3;
        for (auto& b : s.band) {
            b.level = 1;
            b.mix = 0.5;
        }
        render(L, R, s);
        bool fin = true;
        double pk = 0, tail = 0;
        for (size_t i = 0; i < L.size(); ++i) {
            fin = fin && std::isfinite(L[i]);
            pk = std::max(pk, std::fabs(double(L[i])));
        }
        for (size_t i = 48000 * 3; i < L.size(); ++i) tail = std::max(tail, std::fabs(double(L[i])));
        char name[64];
        std::snprintf(name, sizeof name, "FEEDBACK a fond (AUTO %s) : borne, s'eteint", au ? "ON" : "OFF");
        check(name, fin && pk < 20 && tail < 1e-4, "crete %.2f, queue apres 2 s %.1e", pk, tail);
    }
    // 16. ENV : plus (ou moins) de mordant sur les forts ; LFO : chaque cible, MIX module
    {
        auto thd = [&](double env) {
            std::vector<float> L(96000);
            for (int i = 0; i < 96000; ++i) L[i] = static_cast<float>((i < 48000 ? 0.03 : 0.3) * std::sin(2 * kPi * 200 * i / kSr));
            const auto in = L;
            auto R = L;
            DecapSettings s = base(0, 0.3, true);
            s.envAmt = env;
            s.envSpeed = 0;
            render(L, R, s);
            // l'ecart a la meilleure copie lineaire de l'entree, sur le passage fort
            double xy = 0, xx = 0;
            for (int i = 60000; i < 94000; ++i) {
                xy += double(L[i]) * in[i - Decap::kLatency];
                xx += double(in[i - Decap::kLatency]) * in[i - Decap::kLatency];
            }
            const double k = xy / xx;
            double e = 0, o = 0;
            for (int i = 60000; i < 94000; ++i) {
                const double d = L[i] - k * in[i - Decap::kLatency];
                e += d * d;
                o += double(L[i]) * L[i];
            }
            return 10 * std::log10(e / o);
        };
        const double n0 = thd(0.5), up = thd(1), dn = thd(0);
        check("ENV : + mord plus, - mord moins (passage fort)", up > n0 + 3 && dn < n0 - 3, "neutre %.1f, + %.1f, - %.1f dB", n0, up, dn);
        bool fin = true;
        for (int tg = 0; tg < 6; ++tg)
            for (int sh = 0; sh < 5; ++sh) {
                auto L = arp(24000), R = L;
                DecapSettings s = base(0, 0.5, true);
                s.morphTo = 10;
                s.preMode = Decap::F_LP;
                s.postMode = Decap::F_HP;
                s.lfoTarget = tg;
                s.lfoShape = sh;
                s.lfoHz = 7;
                s.lfoAmt = 0;
                render(L, R, s);
                for (float v : L) fin = fin && std::isfinite(v) && std::fabs(v) < 8;
            }
        auto L = sine(1000, 0.1, 96000), R = L;
        DecapSettings s = base(0, 0.4, true);
        s.lfoTarget = Decap::T_MIX;
        s.lfoHz = 2;
        s.lfoAmt = 1;
        s.mix = 0.5;
        s.postMode = Decap::F_LP;
        s.postFreq = 0.3;
        render(L, R, s);
        double lo = 1e9, hi = 0;
        for (int w = 2; w < 30; ++w) {
            double e = 0;
            for (int i = w * 3000; i < (w + 1) * 3000; ++i) e += double(L[i]) * L[i];
            lo = std::min(lo, e);
            hi = std::max(hi, e);
        }
        const double swing = 10 * std::log10(hi / lo);
        check("LFO : 6 cibles x 5 formes finies ; sur MIX, 3 dB de plus", fin && swing > 3, "MIX module de %.1f dB", swing);
    }
    // 17. Les blocs, MIX 0, ni NaN ni sous-normaux : tout en service
    {
        DecapSettings s = base(1, 0.7, true);
        s.morph = 0.4;
        s.morphTo = 9;
        s.dyn = 0.2;
        s.fb = 0.6;
        s.bands = 3;
        s.band[1].style = 7;
        s.band[2].mix = 0.5;
        s.envAmt = 0.8;
        s.lfoShape = 4;
        s.lfoHz = 3;
        s.lfoAmt = 0.9;
        s.lfoTarget = Decap::T_PRE;
        s.preMode = Decap::F_BP;
        s.postMode = Decap::F_PEAK;
        s.box = 2;
        s.boxMix = 0.7;
        s.low = 0.3;
        s.thump = true;
        s.tone = 0.7;
        s.high = 0.6;
        s.steep = true;
        auto A = arp(96000), B = A, C = A, D = A;
        render(A, B, s);
        render(C, D, s, {}, 0);
        check("tout en service : la sortie ne depend pas des blocs", A == C && B == D);
        auto E = arp(48000), F = E;
        const auto in = E;
        DecapSettings z = s;
        z.mix = 0;
        z.lfoTarget = Decap::T_DRIVE;
        render(E, F, z);
        bool same = true;
        for (int i = skip; i < 48000; ++i) same = same && E[i] == in[i - Decap::kLatency];
        check("tout en service, MIX 0 : le sec retarde au bit pres", same);
        std::vector<float> G(48000 * 6, 0.f);
        for (int i = 0; i < 48000; ++i) G[i] = static_cast<float>(0.3 * std::sin(2 * kPi * 220 * i / kSr));
        auto H = G;
        render(G, H, s);
        bool clean = true;
        for (float v : G) clean = clean && std::isfinite(v) && std::fpclassify(v) != FP_SUBNORMAL;
        check("ni NaN ni sous-normaux (5 s de silence apres)", clean);
    }
    // 9. CPU : une seconde stereo
    {
        auto L = arp(48000), R = L;
        const auto t0 = std::chrono::steady_clock::now();
        render(L, R, base(0, 0.5, true));
        const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
        check("CPU x8, une bande", ms < 200, "%.0f ms par seconde d'audio", ms);
        auto M = arp(48000), N = M;
        DecapSettings w = base(0, 0.5, true);
        w.morph = 0.5;
        w.morphTo = 10;
        w.dyn = 0.2;
        w.fb = 0.8;
        w.bands = 3;
        w.envAmt = 0.8;
        w.lfoAmt = 0.9;
        w.lfoTarget = Decap::T_MORPH;
        w.preMode = Decap::F_LP;
        w.postMode = Decap::F_PEAK;
        w.box = 3;
        const auto t1 = std::chrono::steady_clock::now();
        render(M, N, w);
        const double ms3 = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t1).count();
        check("CPU pire cas (3 bandes x2 x4 x8, MORPH, FEEDBACK, tout)", ms3 < 3 * ms + 20, "%.0f ms par seconde d'audio (%.2f fois une bande)", ms3, ms3 / ms);
    }
    // 10. v46 : OFF et l'ancien PUNISH au bit pres contre la DISTO d'avant (tests/decap_ref.cpp)
    {
        std::vector<DecapSettings> cases;
        DecapSettings a = base(Decap::STYLE_T, 0.6, true);
        a.low = 0.42;
        a.thump = true;
        a.tone = 0.4;
        a.high = 0.5;
        a.steep = true;
        a.mix = 0.55;
        cases.push_back(a);
        a.punish = true;
        cases.push_back(a);
        DecapSettings b = base(Decap::STYLE_P, 1.0, true);
        b.punish = true;
        b.high = 0.62;
        b.steep = true;
        b.mix = 0.3;
        cases.push_back(b);
        DecapSettings w = base(Decap::STYLE_E, 0.55, true);
        w.punish = true;
        w.morph = 0.4;
        w.morphTo = Decap::STYLE_FOLD;
        w.dyn = 0.3;
        w.fb = 0.4;
        w.bands = 3;
        w.band[0].bypass = true;
        w.envAmt = 0.7;
        w.lfoAmt = 0.8;
        w.lfoTarget = Decap::T_TONE;
        w.preMode = Decap::F_HP;
        w.postMode = Decap::F_LP;
        w.box = 2;
        w.low = 0.3;
        cases.push_back(w);
        DecapSettings c2 = base(Decap::STYLE_FUZZ, 0.7, true);
        c2.punish = true;
        c2.bands = 2;
        c2.band[0].drive = 0.3;
        c2.low = 0.2;
        cases.push_back(c2);
        bool same = true;
        int nCase = 0;
        for (const DecapSettings& cs : cases)
            for (int blk : {128, 37}) {
                auto L = arp(48000), R = loop(0, 48000);
                auto M = L, N = R;
                render(L, R, cs, {}, blk);
                decapRefRender(&cs, sizeof cs, M.data(), N.data(), static_cast<int>(M.size()), blk);
                same = same && L == M && R == N;
                ++nCase;
            }
        check("v46 : OFF et OLD PUNISH au bit pres (la DISTO d'avant)", same, "%.0f cas (styles, multibande, blocs)", nCase);
    }
    // 11. v46 : PUNISH v2, +3 LU au-dessus du son sans PUNISH, crete sous -0.3 dBFS, aucun NaN
    {
        const int n = 48000 * 6, from = 48000;
        const double ceil = std::pow(10.0, -0.3 / 20);
        double worst = 0, peak = 0, sumAll = 0;
        bool fin = true;
        double mean[3] = {0, 0, 0};
        int cnt = 0;
        const int sts[4] = {Decap::STYLE_A, Decap::STYLE_T, Decap::STYLE_P, Decap::STYLE_E};
        for (int kind = 0; kind < 3; ++kind) {
            const auto src = loop(kind, n);
            int k = 0;
            for (int st : sts)
                for (double dr : {0.3, 0.6}) {
                    auto L = src, R = src, M = src, N = src;
                    DecapSettings s = base(st, dr, true);
                    render(L, R, s);
                    s.punish2 = true;
                    render(M, N, s);
                    const double d = lufs(M, N, from) - lufs(L, R, from);
                    for (size_t i = 0; i < M.size(); ++i) {
                        fin = fin && std::isfinite(M[i]) && std::isfinite(N[i]);
                        peak = std::max(peak, static_cast<double>(std::max(std::fabs(M[i]), std::fabs(N[i]))));
                    }
                    if (std::getenv("DECAP_VERBOSE")) std::printf("  PUNISH v2 boucle %d %c DRIVE %.1f : %+.2f LU\n", kind, "ATPE"[k / 2], dr * 10, d);
                    worst = std::max(worst, std::fabs(d - 3));
                    mean[kind] += d / 8;
                    sumAll += d;
                    ++cnt;
                    ++k;
                }
        }
        bool meanOk = true;
        for (double m : mean) meanOk = meanOk && std::fabs(m - 3) <= 1;
        check("v46 : PUNISH v2, +3 +/- 1 LU par boucle (basse, lead, pluck)", meanOk, "%+.2f / %+.2f / %+.2f LU", mean[0], mean[1], mean[2]);
        check("v46 : PUNISH v2, chaque cas a +3 +/- 2 LU", worst <= 2, "ecart max %.2f LU (%.0f cas)", worst, cnt);
        // a fond : DRIVE 10, AUTO coupe, OUTPUT +18 dB, la boucle de basse
        {
            auto L = loop(0, n), R = L;
            DecapSettings s = base(Decap::STYLE_FUZZ, 1.0, false);
            s.out = 1;
            s.punish2 = true;
            render(L, R, s, {}, 0);
            for (size_t i = 0; i < L.size(); ++i) {
                fin = fin && std::isfinite(L[i]) && std::isfinite(R[i]);
                peak = std::max(peak, static_cast<double>(std::max(std::fabs(L[i]), std::fabs(R[i]))));
            }
        }
        check("v46 : PUNISH v2, crete <= -0.3 dBFS (meme AUTO coupe, +18 dB)", peak <= ceil, "%.2f dBFS", db(peak));
        check("v46 : PUNISH v2, aucun NaN", fin);
        (void)sumAll;
    }
    // 12. v46 : PUNISH v2 entre et sort sans clic ; le traite a bien change (le snarl, le second etage)
    {
        auto L = loop(1, 96000), R = L;
        DecapSettings s = base(Decap::STYLE_A, 0.4, true);
        DecapSettings on = s;
        on.punish2 = true;
        render(L, R, s, {{24000, on}, {60000, s}});
        double jump = 0, ref = 0;
        const auto src = loop(1, 96000);
        for (size_t i = 1; i < src.size(); ++i) ref = std::max(ref, static_cast<double>(std::fabs(src[i] - src[i - 1])));
        for (size_t i = 4800; i < L.size(); ++i) jump = std::max(jump, static_cast<double>(std::fabs(L[i] - L[i - 1])));
        check("v46 : PUNISH v2, entree et sortie sans clic", jump < ref * 4, "saut %.4f (entree %.4f)", jump, ref);
    }
    // 13. v46 : CLEAN LOW (2 bandes, la basse contournee a 110 Hz) : LOW CUT (300 Hz) ne coupe que la bande saturee
    {
        auto L = sine(50, 0.01, 96000), R = L;
        DecapSettings s = base(Decap::STYLE_T, 0.5, true);
        s.bands = 2;
        s.xLo = std::log(110.0 / 40) / std::log(25.0);
        s.band[0].bypass = true;
        s.low = 0.02 + 0.98 * std::log(300.0 / 20) / std::log(50.0);
        render(L, R, s);
        const double g = db(rms(L, skip)) - db(0.01 / std::sqrt(2.0));
        auto M = sine(50, 0.01, 96000), N = M;
        s.band[0].bypass = false;
        render(M, N, s);
        const double g2 = db(rms(M, skip)) - db(0.01 / std::sqrt(2.0));
        check("v46 : CLEAN LOW, LOW CUT sur la bande saturee seulement", std::fabs(g) < 1 && g2 < -15, "50 Hz %.1f dB (sans CLEAN %.1f dB)", g, g2);
    }
    std::printf("\n%s\n", fails ? "ECHEC" : "tous les controles OK");
    return fails ? 1 : 0;
}
