// MM-ARP, la reverbe facon BigSky (dsp/Sky.{h,cpp}) : le Tr60 mesure contre DECAY (HALL, ROOM), l'energie de chaque
// machine a son reglage de depart (~1 par canal, celle de la reverbe d'avant), les douze machines bornees tout au max
// (ni NaN, ni sous-normaux), le rendu independant de la taille des blocs, le cout.
//   ./mmarp_sky_test
#include "Sky.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <string>
#include <vector>

using namespace mmarp;

static int fails = 0;
static void check(bool ok, const char* what) {
    std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what);
    if (!ok) ++fails;
}

static const double SR = 48000;
static const char* NAMES[kSkyMachines] = {"ROOM", "HALL", "PLATE", "SPRING", "SWELL", "BLOOM", "CLOUD", "CHORALE", "SHIMMER", "MAGNETO", "NONLINEAR", "REFLECTIONS"};

struct Out {
    std::vector<float> L, R;
};

template <class F>
static Out render(Sky& s, double seconds, F input, int block = 128) {
    const size_t n = static_cast<size_t>(seconds * SR);
    Out o;
    o.L.assign(n, 0.f);
    o.R.assign(n, 0.f);
    std::vector<float> iL(n), iR(n);
    for (size_t i = 0; i < n; ++i) iL[i] = iR[i] = static_cast<float>(input(i));
    for (size_t i = 0; i < n; i += static_cast<size_t>(block)) {
        const int m = static_cast<int>(std::min<size_t>(static_cast<size_t>(block), n - i));
        s.process(iL.data() + i, iR.data() + i, o.L.data() + i, o.R.data() + i, m);
    }
    return o;
}

static double energy(const std::vector<float>& x) {
    double e = 0;
    for (float v : x) e += static_cast<double>(v) * v;
    return e;
}

/** Tr60 par l'integration de Schroeder (pente de -5 a -35 dB, extrapolee a 60). */
static double t60Of(const Out& o) {
    const size_t n = o.L.size();
    std::vector<double> e(n);
    double acc = 0;
    for (size_t i = n; i-- > 0;) {
        const double v = 0.5 * (o.L[i] + o.R[i]);
        acc += v * v;
        e[i] = acc;
    }
    const double tot = e[0];
    long i5 = -1, i35 = -1;
    for (size_t i = 0; i < n; ++i) {
        const double db = 10 * std::log10(e[i] / tot);
        if (i5 < 0 && db <= -5) i5 = static_cast<long>(i);
        if (db <= -35) {
            i35 = static_cast<long>(i);
            break;
        }
    }
    if (i5 < 0 || i35 < 0) return NAN;
    return (i35 - i5) / SR * 2;
}

static uint32_t seed = 12345;
static double noise() {
    seed = seed * 1103515245u + 12345u;
    return ((seed >> 8) / 16777216.0) * 2 - 1;
}

int main(int argc, char** argv) {
    const bool cpuOnly = argc > 1 && std::string(argv[1]) == "--cpu";
    (void)cpuOnly;
    char msg[256];
    // 1. le Tr60 mesure contre DECAY (HALL, ROOM, trois reglages chacun)
    for (int m : {SKY_HALL, SKY_ROOM}) {
        for (double dv : {0.2, 0.43, 0.7}) {
            SkyNorm nrm = skyDefaults(m);
            nrm.decay = dv;
            nrm.pre = 0;
            Sky s;
            s.prepare(SR);
            s.set(m, nrm, true);
            s.reset();
            const double want = skyDecayOf(m, dv);
            const Out o = render(s, want * 1.6 + 1.5, [](size_t i) { return i == 0 ? 1.0 : 0.0; });
            const double t = t60Of(o);
            std::snprintf(msg, sizeof msg, "%s DECAY %.2f : Tr60 mesure %.2f s pour %.2f s demandes (%+.1f %%)", NAMES[m], dv, t, want, 100 * (t / want - 1));
            check(std::fabs(t / want - 1) <= 0.06, msg);
        }
    }
    // 2. l'energie de chaque machine a son reglage de depart (une impulsion ; SWELL : une salve rapportee a HALL)
    for (int m = 0; m < kSkyMachines; ++m) {
        Sky s;
        s.prepare(SR);
        s.set(m, skyDefaults(m), true);
        s.reset();
        const SkyEngine e = skyEngine(m, skyDefaults(m));
        const double dur = std::min(40.0, std::max(3.0, e.t60 * 1.6 + e.pre + 1.5));
        double eL, eR;
        if (m == SKY_SWELL) {
            seed = 777;
            const auto burst = [](size_t i) { return i < 48000 ? noise() * 0.1 : 0.0; };
            const Out o = render(s, dur, burst);
            Sky h;
            h.prepare(SR);
            h.set(SKY_HALL, skyDefaults(SKY_HALL), true);
            h.reset();
            seed = 777;
            const Out hb = render(h, dur, burst);
            Sky h2;
            h2.prepare(SR);
            h2.set(SKY_HALL, skyDefaults(SKY_HALL), true);
            h2.reset();
            const Out hi = render(h2, dur, [](size_t i) { return i == 0 ? 1.0 : 0.0; });
            const double ref = (energy(hi.L) + energy(hi.R)) / (energy(hb.L) + energy(hb.R));
            eL = energy(o.L) * ref;
            eR = energy(o.R) * ref;
        } else {
            const Out o = render(s, dur, [](size_t i) { return i == 0 ? 1.0 : 0.0; });
            eL = energy(o.L);
            eR = energy(o.R);
        }
        std::snprintf(msg, sizeof msg, "%-11s au depart : energie %.3f / %.3f par canal (la reverb d'avant : 1)", NAMES[m], eL, eR);
        check(eL > 0.6 && eL < 1.6 && eR > 0.6 && eR < 1.6, msg);
    }
    // 3. tout au max : 6 s de bruit puis 6 s de silence, bornee, ni NaN ni sous-normaux, la queue redescend
    for (int m = 0; m < kSkyMachines; ++m) {
        SkyNorm nrm = skyDefaults(m);
        nrm.decay = nrm.pre = nrm.tone = nrm.mod = nrm.lowEnd = 1;
        for (auto& v : nrm.p) v = 1;
        if (m == SKY_SHIMMER) nrm.p[3] = 0.5; // REGEN
        Sky s;
        s.prepare(SR);
        s.set(m, nrm, true);
        s.reset();
        seed = 99;
        const Out o = render(s, 12, [](size_t i) { return i < 6 * 48000 ? noise() * 0.5 : 0.0; }, 333);
        double pk = 0, tail = 0;
        bool fin = true, sub = false;
        for (size_t i = 0; i < o.L.size(); ++i)
            for (float v : {o.L[i], o.R[i]}) {
                fin = fin && std::isfinite(v);
                sub = sub || std::fpclassify(v) == FP_SUBNORMAL;
                pk = std::max(pk, static_cast<double>(std::fabs(v)));
                if (i > o.L.size() - 24000) tail = std::max(tail, static_cast<double>(std::fabs(v)));
            }
        std::snprintf(msg, sizeof msg, "%-11s tout au max : crete %.2f, fin de queue %.2g, fini, sans sous-normaux", NAMES[m], pk, tail);
        check(fin && !sub && pk < 30 && tail < pk, msg);
    }
    // 4. le rendu ne depend pas de la taille des blocs (une salve, la queue, le repos, une seconde salve)
    for (int m : {SKY_HALL, SKY_CHORALE, SKY_SHIMMER, SKY_NONLINEAR, SKY_SPRING}) {
        Out ref;
        bool same = true;
        for (int blk : {64, 512, 1000}) {
            Sky s;
            s.prepare(SR);
            s.set(m, skyDefaults(m), true);
            s.reset();
            seed = 5;
            const Out o = render(s, 14, [](size_t i) { return i < 24000 || (i > 12 * 48000 && i < 12 * 48000 + 4800) ? noise() * 0.3 : 0.0; }, blk);
            if (ref.L.empty())
                ref = o;
            else
                for (size_t i = 0; same && i < o.L.size(); ++i) same = o.L[i] == ref.L[i] && o.R[i] == ref.R[i];
        }
        std::snprintf(msg, sizeof msg, "%-11s blocs de 64, 512, 1000 (repos et reveil compris) : meme sortie au bit pres", NAMES[m]);
        check(same, msg);
    }
    // 5. le cout : secondes de calcul par seconde de son (bruit en entree, reglage de depart)
    double worst = 0;
    for (int m = 0; m < kSkyMachines; ++m) {
        Sky s;
        s.prepare(SR);
        s.set(m, skyDefaults(m), true);
        s.reset();
        seed = 3;
        const size_t n = static_cast<size_t>(4 * SR);
        std::vector<float> iL(n), iR(n), oL(n), oR(n);
        for (size_t i = 0; i < n; ++i) iL[i] = iR[i] = static_cast<float>(noise() * 0.3);
        const auto t0 = std::chrono::steady_clock::now();
        for (size_t i = 0; i < n; i += 256) s.process(iL.data() + i, iR.data() + i, oL.data() + i, oR.data() + i, 256);
        const double c = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count() / 4;
        worst = std::max(worst, c);
        std::printf("      %-11s cout %.1f %% d'un coeur\n", NAMES[m], 100 * c);
    }
    std::snprintf(msg, sizeof msg, "cout : %.1f %% d'un coeur au pire (borne : 25 %%)", 100 * worst);
    check(worst < 0.25, msg);
    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "OK", fails, fails > 1 ? "s" : "");
    return fails ? 1 : 0;
}
