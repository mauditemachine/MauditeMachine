// MM-HELL (copie conforme du test du MM-ARP, plugin/mm-arp/tests/hell_test.cpp) : HELL (dsp/Hell.{h,cpp}), contourne au bit pres a MIX 0, le decaleur monte et descend, la spirale de la
// boucle, la stabilite au FEEDBACK maximal (ni NaN, ni sous-normaux, borne), l'independance a la taille des blocs.
//   ./mmhell_hell_test
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
    // ---- 2026-11-17 : HELL complet (facon Echobode) ----
    std::vector<float> sine(N), zero(N, 0.f);
    for (size_t i = 0; i < N; ++i) sine[i] = static_cast<float>(0.5 * std::sin(2 * PI * 1000 * i / SR));
    // 8. SIDEBAND au centre : la modulation en anneau, les deux bandes, la porteuse eteinte
    {
        HellSettings s;
        s.mix = 1;
        s.feedback = 0;
        s.timeMs = 50;
        s.shiftHz = 200;
        s.upDown = 0.5;
        const Out o = run(s, sine, sine, 128);
        const double hi = goertzel(o.L, N / 2, N, 1200), lo = goertzel(o.L, N / 2, N, 800), c = goertzel(o.L, N / 2, N, 1000);
        char msg[200];
        std::snprintf(msg, sizeof msg, "SIDEBAND r.m. : 800 et 1200 Hz a %.1f dB l'un de l'autre, la porteuse a %.1f dB", 20 * std::log10(hi / lo), 20 * std::log10(c / std::max(hi, lo) + 1e-12));
        check(hi > 0.1 && lo > 0.1 && std::fabs(20 * std::log10(hi / lo)) < 1.5 && c < 0.05 * std::max(hi, lo), msg);
    }
    // 9. CROSS : un signal a gauche seulement ; sans CROSS la droite reste muette, avec CROSS l'echo y passe
    {
        std::vector<float> b(N, 0.f);
        for (size_t i = 0; i < static_cast<size_t>(0.05 * SR); ++i) b[i] = static_cast<float>(0.5 * std::sin(2 * PI * 500 * i / SR));
        double rOff = 0, rOn = 0;
        for (int k = 0; k < 2; ++k) {
            HellSettings s;
            s.mix = 1;
            s.feedback = 0.7;
            s.timeMs = 120;
            s.cross = k == 1;
            const Out o = run(s, b, zero, 128);
            double e = 0;
            for (float v : o.R) e += static_cast<double>(v) * v;
            (k == 0 ? rOff : rOn) = e;
        }
        char msg[160];
        std::snprintf(msg, sizeof msg, "CROSS : energie a droite %.2g sans, %.2g avec", rOff, rOn);
        check(rOff == 0 && rOn > 1, msg);
    }
    // 10. ANTI REFL : un sinus de 200 Hz descendu de 300 Hz : sans, il se replie a 100 Hz ; avec, presque plus rien
    {
        std::vector<float> s2(N);
        for (size_t i = 0; i < N; ++i) s2[i] = static_cast<float>(0.5 * std::sin(2 * PI * 200 * i / SR));
        double refl[2];
        for (int k = 0; k < 2; ++k) {
            HellSettings s;
            s.mix = 1;
            s.feedback = 0;
            s.timeMs = 30;
            s.shiftHz = -300;
            s.upDown = 1;
            s.antiRefl = k == 1;
            const Out o = run(s, s2, s2, 128);
            refl[k] = goertzel(o.L, N / 2, N, 100);
        }
        char msg[160];
        std::snprintf(msg, sizeof msg, "ANTI REFL : la composante repliee a 100 Hz baisse de %.1f dB", 20 * std::log10(refl[1] / refl[0] + 1e-12));
        check(refl[0] > 0.1 && refl[1] < refl[0] * 0.1, msg);
    }
    // 11. le LFO et ses cibles : chacune change le son (contre AMOUNT 0), et FREQ decale bien de +/- 400 a^2 Hz
    {
        const char* names[4] = {"FREQ", "PHASE", "LOW-PASS", "DELAY"};
        HellSettings base;
        base.mix = 1;
        base.feedback = 0.4;
        base.timeMs = 80;
        base.shiftHz = 30;
        base.lpHz = 3000;
        base.lfoHz = 2;
        base.lfoShape = 2;
        const Out ref = run(base, noiseL, noiseR, 128);
        for (int t = 0; t < 4; ++t) {
            HellSettings s = base;
            s.lfoTarget = t;
            s.lfoAmt = 0.8;
            const Out o = run(s, noiseL, noiseR, 128);
            double diff = 0, e = 0;
            bool fin = true;
            for (size_t i = N / 3; i < N; ++i) {
                diff += (o.L[i] - ref.L[i]) * (o.L[i] - ref.L[i]);
                e += ref.L[i] * ref.L[i];
                fin = fin && std::isfinite(o.L[i]) && std::isfinite(o.R[i]);
            }
            char msg[160];
            std::snprintf(msg, sizeof msg, "LFO vers %s : ecart %.1f dB sous le signal, fini", names[t], 10 * std::log10(diff / e));
            check(fin && diff > 0.01 * e, msg);
        }
        // FREQ, carre lent : un sinus de 1 kHz, decale de 0 +/- 256 Hz (0.8^2 x 400) selon la moitie du cycle
        HellSettings s;
        s.mix = 1;
        s.feedback = 0;
        s.timeMs = 20;
        s.lfoHz = 0.5;
        s.lfoShape = 2;
        s.lfoAmt = 0.8;
        const Out o = run(s, sine, sine, 128);
        const double up = goertzel(o.L, static_cast<size_t>(0.2 * SR), static_cast<size_t>(0.9 * SR), 1256);
        const double dn = goertzel(o.L, static_cast<size_t>(1.2 * SR), static_cast<size_t>(1.9 * SR), 744);
        check(up > 0.15 && dn > 0.15, "LFO FREQ, carre : 1 kHz -> 1256 Hz puis 744 Hz (+/- 256 Hz)");
    }
    // 12. les lois : RANGE FINE / WIDE / SYNC / MIDI, l'inverse (la migration)
    {
        const bool f = std::fabs(Hell::shiftHzFor(1, Hell::FINE, 120, 0) - 200) < 1e-9 && std::fabs(Hell::shiftHzFor(0, Hell::FINE, 120, 0) + 200) < 1e-9 &&
                       Hell::shiftHzFor(0.5, Hell::FINE, 120, 0) == 0;
        const bool w = std::fabs(Hell::shiftHzFor(1, Hell::WIDE, 120, 0) - 5000) < 1e-9;
        const bool sy = std::fabs(Hell::shiftHzFor(1, Hell::SYNC, 120, 0) - 32) < 1e-9;
        const bool mi = std::fabs(Hell::shiftHzFor(1, Hell::MIDI, 120, 440) - 880) < 1e-9 && Hell::shiftHzFor(1, Hell::MIDI, 120, 0) == 0;
        bool inv = true;
        for (double hz : {-180.0, -12.0, 5.0, 77.0, 199.0}) inv = inv && std::fabs(Hell::shiftHzFor(Hell::shiftVFor(hz, Hell::FINE), Hell::FINE, 120, 0) - hz) < 1e-6 * std::fabs(hz) + 1e-9;
        for (double hz : {-4800.0, -320.0, 250.0, 3000.0}) inv = inv && std::fabs(Hell::shiftHzFor(Hell::shiftVFor(hz, Hell::WIDE), Hell::WIDE, 120, 0) - hz) < 1e-6 * std::fabs(hz) + 1e-9;
        const bool other = std::fabs(Hell::lfoSyncHz(1, 120) - 16) < 1e-9 && Hell::hpHzOf(0) == 0 && Hell::lpHzOf(1) == 0 && std::fabs(Hell::lpHzOf(0) - 300) < 1e-9;
        check(f && w && sy && mi && inv && other, "RANGE : FINE +/-200 Hz, WIDE 5 kHz, SYNC 16 cycles par temps (32 Hz a 120), MIDI 2 x la note ; l'inverse au millionieme");
    }
    // 13. MIX 0 au bit pres, tous les nouveaux reglages pousses
    {
        HellSettings s;
        s.mix = 0;
        s.feedback = 1;
        s.cross = true;
        s.shiftHz = -900;
        s.antiRefl = true;
        s.smear = 1;
        s.hpHz = 400;
        s.lpHz = 2000;
        s.phase = 0.3;
        s.lfoAmt = -1;
        s.lfoShape = 3;
        s.lfoTarget = 3;
        s.lfoStereo = true;
        const Out o = run(s, noiseL, noiseR, 128);
        bool same = true;
        for (size_t i = 0; i < N; ++i) same = same && o.L[i] == noiseL[i] && o.R[i] == noiseR[i];
        check(same, "MIX 0 : sortie = entree au bit pres (CROSS, SMEAR, ANTI REFL, HP / LP, PHASE, LFO aleatoire vers DELAY)");
    }
    // 14. la stabilite au maximum : chaque cible, chaque forme, FEEDBACK 1, CROSS, SMEAR 1 ; 3 s de bruit fort puis 3 s
    //     de silence : fini, sans sous-normaux, borne
    {
        double worst = 0;
        bool ok = true;
        for (int t = 0; t < 4; ++t)
            for (int sh = 0; sh < 4; ++sh) {
                HellSettings s;
                s.mix = 1;
                s.feedback = 1;
                s.cross = true;
                s.smear = 1;
                s.timeMs = t == 3 ? 5 : 140;
                s.shiftHz = sh == 0 ? 0 : sh == 1 ? 5000 : sh == 2 ? -200 : 3;
                s.upDown = sh == 3 ? 0.5 : 1;
                s.antiRefl = sh == 2;
                s.lfoHz = 10;
                s.lfoShape = sh;
                s.lfoAmt = 1;
                s.lfoTarget = t;
                s.lfoStereo = true;
                s.lpHz = t == 2 ? 1000 : 0;
                s.hpHz = sh == 1 ? 2000 : 0;
                std::vector<float> L(2 * N, 0.f), R(2 * N, 0.f);
                for (size_t i = 0; i < N; ++i) {
                    L[i] = noiseL[i] * 2.5f;
                    R[i] = noiseR[i] * 2.5f;
                }
                const Out o = run(s, L, R, 333);
                for (size_t i = 0; i < o.L.size(); ++i)
                    for (float v : {o.L[i], o.R[i]}) {
                        ok = ok && std::isfinite(v) && std::fpclassify(v) != FP_SUBNORMAL;
                        worst = std::max(worst, static_cast<double>(std::fabs(v)));
                    }
            }
        char msg[200];
        std::snprintf(msg, sizeof msg, "au maximum (4 cibles x 4 formes, FEEDBACK 1, CROSS, SMEAR 1) : fini, sans sous-normaux, crete %.2f (borne a 6)", worst);
        check(ok && worst < 6, msg);
    }
    // 15. independance a la taille des blocs, tout engage (LFO aleatoire vers LOW-PASS, ANTI REFL, SMEAR, CROSS)
    {
        HellSettings s;
        s.mix = 0.8;
        s.feedback = 0.85;
        s.cross = true;
        s.sync = 5;
        s.shiftHz = 140;
        s.upDown = 0.2;
        s.antiRefl = true;
        s.smear = 0.6;
        s.hpHz = 80;
        s.lpHz = 6000;
        s.phase = 0.25;
        s.lfoHz = 3.1;
        s.lfoShape = 3;
        s.lfoAmt = 0.7;
        s.lfoTarget = 2;
        s.lfoStereo = true;
        const Out a = run(s, noiseL, noiseR, 64), b = run(s, noiseL, noiseR, 512), c = run(s, noiseL, noiseR, 1000);
        bool same = true;
        for (size_t i = 0; i < N; ++i) same = same && a.L[i] == b.L[i] && a.R[i] == b.R[i] && a.L[i] == c.L[i] && a.R[i] == c.R[i];
        check(same, "tout engage : blocs de 64, 512, 1000, meme sortie au bit pres");
    }
    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "OK", fails, fails > 1 ? "s" : "");
    return fails ? 1 : 0;
}
