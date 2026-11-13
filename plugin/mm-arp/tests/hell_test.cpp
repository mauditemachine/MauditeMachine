// MM-ARP, HELL (dsp/Hell.{h,cpp}) : contourne au bit pres a MIX 0, le decaleur monte et descend, la spirale de la
// boucle, la stabilite au FEEDBACK maximal (ni NaN, ni sous-normaux, borne), l'independance a la taille des blocs.
//   ./mmarp_hell_test
#include "Hell.h"

#include <cmath>
#include <cstdio>
#include <cstdint>
#include <vector>

using mmarp::Hell;
using mmarp::HellSettings;

static int fails = 0;
static void check(bool ok, const char* what) {
    std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what);
    if (!ok) ++fails;
}

static const double SR = 48000;
static const double PI = 3.14159265358979323846;

static double goertzel(const std::vector<float>& x, size_t from, size_t to, double hz) {
    const double w = 2 * PI * hz / SR, c = 2 * std::cos(w);
    double s1 = 0, s2 = 0;
    for (size_t i = from; i < to; ++i) {
        const double s = x[i] + c * s1 - s2;
        s2 = s1;
        s1 = s;
    }
    const double p = s1 * s1 + s2 * s2 - c * s1 * s2;
    return std::sqrt(std::max(0.0, p)) / static_cast<double>(to - from);
}

struct Out {
    std::vector<float> L, R;
};

static Out run(HellSettings s, const std::vector<float>& inL, const std::vector<float>& inR, int block, double bpm = 120) {
    Hell h;
    h.prepare(SR);
    h.set(s, bpm);
    Out o{inL, inR};
    for (size_t i = 0; i < o.L.size(); i += static_cast<size_t>(block)) {
        const int n = static_cast<int>(std::min<size_t>(static_cast<size_t>(block), o.L.size() - i));
        h.set(s, bpm);
        h.process(o.L.data() + i, o.R.data() + i, n);
    }
    return o;
}

int main() {
    const size_t N = static_cast<size_t>(SR * 3);
    std::vector<float> noiseL(N), noiseR(N);
    uint32_t r = 12345;
    for (size_t i = 0; i < N; ++i) {
        r = r * 1664525u + 1013904223u;
        noiseL[i] = static_cast<float>(((r >> 8) / 16777216.0 - 0.5) * 0.8);
        r = r * 1664525u + 1013904223u;
        noiseR[i] = static_cast<float>(((r >> 8) / 16777216.0 - 0.5) * 0.8);
    }

    // 1. MIX 0 : contourne au bit pres, meme avec tous les autres reglages pousses
    {
        HellSettings s;
        s.mix = 0;
        s.feedback = 1;
        s.shiftHz = 900;
        s.tone = 0.1;
        s.lfoDepthHz = 300;
        const Out o = run(s, noiseL, noiseR, 128);
        bool same = true;
        for (size_t i = 0; i < N; ++i) same = same && o.L[i] == noiseL[i] && o.R[i] == noiseR[i];
        check(same, "MIX 0 : sortie = entree au bit pres (FEEDBACK 1, SHIFT 900 Hz, TONE, LFO)");
    }
    // 1b. engage puis remis a 0 : de nouveau contourne au bit pres apres la rampe
    {
        Hell h;
        h.prepare(SR);
        HellSettings s;
        s.mix = 0.6;
        s.feedback = 0.8;
        s.shiftHz = 120;
        std::vector<float> L = noiseL, R = noiseR;
        const size_t half = N / 2;
        for (size_t i = 0; i < half; i += 256) {
            h.set(s, 120);
            h.process(L.data() + i, R.data() + i, 256);
        }
        s.mix = 0;
        size_t i = half;
        for (; i < half + 2048; i += 256) {
            h.set(s, 120);
            h.process(L.data() + i, R.data() + i, 256);
        }
        bool same = !h.active();
        for (; i + 256 <= N; i += 256) {
            h.set(s, 120);
            h.process(L.data() + i, R.data() + i, 256);
        }
        for (size_t k = half + 2048; k + 256 <= N; ++k) same = same && L[k] == noiseL[k] && R[k] == noiseR[k];
        check(same, "MIX remis a 0 : contourne au bit pres des la fin de la rampe de 20 ms");
    }
    // 2. le decaleur : un sinus de 1 kHz, sans reinjection, UP -> 1.2 kHz, DOWN -> 800 Hz
    {
        std::vector<float> sL(N), sR(N);
        for (size_t i = 0; i < N; ++i) sL[i] = sR[i] = static_cast<float>(0.5 * std::sin(2 * PI * 1000 * i / SR));
        for (int dir = 0; dir < 2; ++dir) {
            HellSettings s;
            s.mix = 1;
            s.feedback = 0;
            s.timeMs = 50;
            s.shiftHz = 200;
            s.upDown = dir == 0 ? 1 : 0;
            const Out o = run(s, sL, sR, 128);
            const double hi = goertzel(o.L, N / 2, N, 1200), lo = goertzel(o.L, N / 2, N, 800), c = goertzel(o.L, N / 2, N, 1000);
            const double want = dir == 0 ? hi : lo, other = dir == 0 ? lo : hi;
            char msg[200];
            std::snprintf(msg, sizeof msg, "%s 200 Hz : 1 kHz -> %s Hz, l'autre bande a %.1f dB, la porteuse a %.1f dB", dir == 0 ? "UP" : "DOWN", dir == 0 ? "1200" : "800",
                          20 * std::log10(other / want + 1e-12), 20 * std::log10(c / want + 1e-12));
            check(want > 0.2 && other < want * 0.05 && c < want * 0.05, msg); // le Hilbert IIR a 8 passe-tout : ~30 dB de rejet
        }
    }
    // 3. la spirale : une salve de 1 kHz, 200 ms de retard, +100 Hz par tour : le 3e echo est a 1.3 kHz
    {
        std::vector<float> b(N, 0.f);
        for (size_t i = 0; i < static_cast<size_t>(0.05 * SR); ++i) b[i] = static_cast<float>(0.5 * std::sin(2 * PI * 1000 * i / SR) * std::sin(PI * i / (0.05 * SR)));
        HellSettings s;
        s.mix = 1;
        s.feedback = 0.8;
        s.timeMs = 200;
        s.shiftHz = 100;
        const Out o = run(s, b, b, 128);
        const size_t a = static_cast<size_t>(0.6 * SR), e = static_cast<size_t>(0.65 * SR);
        const double f13 = goertzel(o.L, a, e, 1300), f12 = goertzel(o.L, a, e, 1200), f10 = goertzel(o.L, a, e, 1000);
        check(f13 > 4 * f12 && f13 > 4 * f10, "spirale : la 3e repetition (600 ms) est montee de 3 x 100 Hz");
    }
    // 4. la stabilite : FEEDBACK 1, decaleur a 0 Hz (le pire : rien ne sort de la bande) et a 3 kHz, LFO, TONE, 3 s de
    //    bruit plein pot puis 3 s de silence : fini, borne, sans sous-normaux
    {
        for (int k = 0; k < 4; ++k) {
            HellSettings s;
            s.mix = 1;
            s.feedback = 1;
            s.timeMs = k == 0 ? 5 : 120;
            s.shiftHz = k == 1 ? 0 : k == 2 ? 3000 : -40;
            s.upDown = k == 3 ? 0.5 : 1;
            s.spread = k == 3 ? 1 : 0;
            s.lfoDepthHz = k == 2 ? 400 : 0;
            s.tone = k == 0 ? 0.9 : k == 2 ? 0.2 : 0.5;
            std::vector<float> L(2 * N, 0.f), R(2 * N, 0.f);
            for (size_t i = 0; i < N; ++i) {
                L[i] = noiseL[i] * 2.5f;
                R[i] = noiseR[i] * 2.5f;
            }
            const Out o = run(s, L, R, 333);
            double peak = 0;
            bool fin = true, sub = false;
            for (size_t i = 0; i < o.L.size(); ++i)
                for (float v : {o.L[i], o.R[i]}) {
                    fin = fin && std::isfinite(v);
                    sub = sub || std::fpclassify(v) == FP_SUBNORMAL;
                    peak = std::max(peak, static_cast<double>(std::fabs(v)));
                }
            char msg[200];
            std::snprintf(msg, sizeof msg, "FEEDBACK 1, cas %d : fini, sans sous-normaux, crete %.2f (entree a +/-1 ; borne a 6)", k, peak);
            check(fin && !sub && peak < 6, msg);
        }
    }
    // 5. independance a la taille des blocs (au bit pres)
    {
        HellSettings s;
        s.mix = 0.7;
        s.feedback = 0.9;
        s.sync = 7;
        s.shiftHz = -230;
        s.spread = 0.6;
        s.lfoDepthHz = 80;
        s.lfoHz = 1.3;
        s.tone = 0.3;
        const Out a = run(s, noiseL, noiseR, 64), b = run(s, noiseL, noiseR, 512), c = run(s, noiseL, noiseR, 1000);
        bool same = true;
        for (size_t i = 0; i < N; ++i) same = same && a.L[i] == b.L[i] && a.R[i] == b.R[i] && a.L[i] == c.L[i] && a.R[i] == c.R[i];
        check(same, "blocs de 64, 512, 1000 : meme sortie au bit pres");
    }
    // 6. le temps cale au tempo : 1/8. a 120 BPM = 375 ms ; FREE ; les lois
    {
        Hell h;
        h.prepare(SR);
        HellSettings s;
        s.mix = 1;
        s.sync = 7;
        h.set(s, 120);
        const bool t1 = std::fabs(h.delaySeconds() - 0.375) < 1e-9;
        s.sync = 13;
        h.set(s, 60);
        const bool t2 = std::fabs(h.delaySeconds() - 4.0) < 1e-9;
        s.sync = 0;
        s.timeMs = Hell::timeMsOf(0.5);
        h.set(s, 60);
        const bool t3 = std::fabs(h.delaySeconds() - 0.1) < 1e-9;
        const bool laws = std::fabs(Hell::shiftHzOf(0.5)) < 1e-12 && std::fabs(Hell::shiftHzOf(1) - 5000) < 1e-9 && std::fabs(Hell::shiftHzOf(0) + 5000) < 1e-9 &&
                          std::fabs(Hell::lfoDepthHzOf(0)) < 1e-12;
        check(t1 && t2 && t3 && laws, "TIME : 1/8. a 120 BPM = 375 ms, 1 BAR a 60 BPM borne a 4 s, FREE 0.5 = 100 ms ; SHIFT 0.5 = 0 Hz");
    }
    // 7. l'echo arrive a l'heure : une impulsion, 100 ms, decaleur a 0 : le premier echo a 100 ms (+ le retard de groupe
    //    du transformateur de Hilbert, quelques echantillons)
    {
        std::vector<float> imp(N, 0.f);
        imp[100] = 1.f; // MIX glisse de 0 a 1 en 20 ms : le sec de l'impulsion passe, on cherche apres 50 ms
        HellSettings s;
        s.mix = 1;
        s.feedback = 0;
        s.timeMs = 100;
        s.shiftHz = 0;
        const Out o = run(s, imp, imp, 128);
        size_t at = 0;
        double best = 0;
        for (size_t i = 2400; i < N; ++i)
            if (std::fabs(o.L[i]) > best) {
                best = std::fabs(o.L[i]);
                at = i;
            }
        const long late = static_cast<long>(at) - 100 - 4800;
        char msg[160];
        std::snprintf(msg, sizeof msg, "impulsion : l'echo a 100 ms + %ld echantillons", late);
        check(late >= 0 && late < 40, msg);
    }
    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "OK", fails, fails > 1 ? "s" : "");
    return fails ? 1 : 0;
}
