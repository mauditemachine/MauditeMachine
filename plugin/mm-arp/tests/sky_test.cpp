// MM-ARP, la reverbe facon BigSky (dsp/Sky.{h,cpp}) : le Tr60 mesure contre DECAY (HALL, ROOM), l'energie de chaque
// machine a son reglage de depart (~1 par canal, celle de la reverbe d'avant), les douze machines bornees tout au max
// (ni NaN, ni sous-normaux), le rendu independant de la taille des blocs, le cout.
// v46 (la page REVERB option A) : la sortie de la reverbe dans ArpFx (l'EQ trois points mesure, WIDTH, DUCK ; au neutre la
// sortie d'avant au bit pres) et FREEZE (la queue tenue 40 s sans NaN ni explosion ni chute, l'entree coupee, sans clic).
//   ./mmarp_sky_test
#include "Sky.h"
#include "../dsp/ArpFx.h"
#include "../src/ExtraParams.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

using namespace mmarp;

static int fails = 0;
static void check(bool ok, const char* what) {
    std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what);
    if (!ok) ++fails;
}

static const double SR = 48000;
static constexpr double kPi = 3.14159265358979323846;
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
    // 6. v46 : la sortie de la reverbe (ArpFx : l'EQ trois points, WIDTH, DUCK) et FREEZE (Sky)
    {
        // 6a. les defauts du JSON (extra-params.json) sont le neutre du DSP
        const auto def = [](int e) { return mmx::kExtraDefs[e].def; };
        const ArpFxSettings z{};
        const bool jsonNeutral = def(mmx::ex_xSkyLoCut) == z.rvLoCut && mmx::exStep(mmx::ex_xSkyLoSlope, def(mmx::ex_xSkyLoSlope)) == z.rvLoSlope &&
                                 def(mmx::ex_xSkyMidHz) == z.rvMidHz && def(mmx::ex_xSkyMidDb) == z.rvMidDb && def(mmx::ex_xSkyMidQ) == z.rvMidQ &&
                                 def(mmx::ex_xSkyHiCut) == z.rvHiCut && mmx::exStep(mmx::ex_xSkyHiSlope, def(mmx::ex_xSkyHiSlope)) == z.rvHiSlope &&
                                 def(mmx::ex_xSkyWidth) == z.rvWidth && def(mmx::ex_xSkyDuck) == z.rvDuck && (mmx::exStep(mmx::ex_xSkyFreeze, def(mmx::ex_xSkyFreeze)) == 1) == z.rvFreeze &&
                                 ArpFxLaws::rvMidDb(z.rvMidDb) == 0 && ArpFxLaws::rvWidth(z.rvWidth) == 1;
        check(jsonNeutral, "REVERB v46 : les defauts des 10 reglages neufs (extra-params.json) sont le neutre du DSP (0 dB, 100 %, OFF)");
    }
    // un rendu de la chaine ArpFx : des notes (0.5 s jouees, 1 s de silence), la reverbe a 0.6 ; tonal : un sinus et un
    // peu de bruit (sinon du bruit seul, pour mesurer un spectre) ; prime : des reglages poses avant (puis reset)
    struct Fx2 {
        std::vector<float> L, R;
    };
    const auto fxRender = [](const ArpFxSettings& s, int block, double seconds, double amp = 0.3, const ArpFxSettings* later = nullptr, double laterAt = 0,
                             bool tonal = true, const ArpFxSettings* prime = nullptr) {
        ArpFx fx;
        fx.prepare(SR, 1024);
        if (prime) {
            fx.set(*prime, true);
            fx.set(s, true);
            fx.reset();
        } else
            fx.set(s, true);
        const size_t n = static_cast<size_t>(seconds * SR);
        Fx2 o;
        o.L.assign(n, 0.f);
        o.R.assign(n, 0.f);
        std::vector<float> iL(n), iR(n);
        uint32_t sd = 4242;
        for (size_t i = 0; i < n; ++i) {
            sd = sd * 1664525u + 1013904223u;
            const double nz = ((sd >> 8) / 16777216.0) * 2 - 1;
            sd = sd * 1664525u + 1013904223u;
            const double nz2 = ((sd >> 8) / 16777216.0) * 2 - 1;
            const bool on = (i % 72000) < 24000;
            const double t = static_cast<double>(i) / SR;
            iL[i] = static_cast<float>(!on ? 0 : tonal ? amp * (0.7 * std::sin(2 * kPi * 220 * t) + 0.3 * nz) : amp * nz);
            iR[i] = static_cast<float>(!on ? 0 : tonal ? amp * (0.7 * std::sin(2 * kPi * 277 * t) + 0.3 * nz) : amp * nz2);
        }
        bool done = false;
        for (size_t i = 0; i < n; i += static_cast<size_t>(block)) {
            if (later && !done && static_cast<double>(i) >= laterAt * SR) {
                fx.set(*later, false);
                done = true;
            }
            const int m = static_cast<int>(std::min<size_t>(static_cast<size_t>(block), n - i));
            fx.process(iL.data() + i, iR.data() + i, o.L.data() + i, o.R.data() + i, m);
        }
        return o;
    };
    const auto sameFx = [](const Fx2& a, const Fx2& b) {
        for (size_t i = 0; i < a.L.size(); ++i)
            if (a.L[i] != b.L[i] || a.R[i] != b.R[i]) return false;
        return true;
    };
    ArpFxSettings base;
    base.reverb = 0.6;
    base.volume = 0.8;
    {
        // 6b. au neutre : la sortie d'avant (CLASSIC et HALL, ROOM) ; et un passage EQ / WIDTH / DUCK / FREEZE engages
        // puis rendus a leur neutre ne laisse rien (contournes, aucun etat)
        bool same = true;
        for (int t : {0, 2, 1, 9}) {
            ArpFxSettings a = base;
            a.skyType = t;
            if (t == 9) a.shimmer = 0.4;
            ArpFxSettings b = a;
            b.rvLoCut = 0.5;
            b.rvMidDb = 0.9;
            b.rvHiCut = 0.3;
            b.rvWidth = 0.1;
            b.rvDuck = 0.7;
            b.rvFreeze = true;
            // la meme suite (des reglages poses, puis ceux-ci, puis reset) : d'abord sans rien d'engage, puis avec tout
            const Fx2 r0 = fxRender(a, 128, 4, 0.3, nullptr, 0, true, &a);
            const Fx2 r1 = fxRender(a, 128, 4, 0.3, nullptr, 0, true, &b);
            same = same && sameFx(r0, r1);
        }
        check(same, "REVERB v46 : EQ, WIDTH, DUCK, FREEZE engages puis rendus au neutre : la sortie d'avant au bit pres (CLASSIC, ROOM, HALL, SHIMMER)");
    }
    // la reverbe seule : le rendu moins celui ou FREEZE tient une reverbe vide depuis le debut (le sec, le bas, rien d'autre)
    const auto wetOf = [&](const ArpFxSettings& s, double seconds, double amp, bool tonal = true) {
        ArpFxSettings d = s;
        d.rvFreeze = true;
        d.rvDuck = 0;
        d.rvLoCut = 0;
        d.rvMidDb = 0.5;
        d.rvHiCut = 1;
        d.rvWidth = 0.5;
        const Fx2 a = fxRender(s, 128, seconds, amp, nullptr, 0, tonal), b = fxRender(d, 128, seconds, amp, nullptr, 0, tonal);
        Fx2 w;
        w.L.resize(a.L.size());
        w.R.resize(a.R.size());
        for (size_t i = 0; i < a.L.size(); ++i) {
            w.L[i] = a.L[i] - b.L[i];
            w.R[i] = a.R[i] - b.R[i];
        }
        return w;
    };
    // l'energie d'un signal dans une bande etroite autour de f (deux passe-bande RBJ de Q 12 en cascade), apres 0.3 s
    const auto bandDb = [](const Fx2& x, double f) {
        const double w = 2 * kPi * f / SR, al = std::sin(w) / (2 * 12), a0 = 1 + al;
        const double b0 = al / a0, b2 = -al / a0, a1 = -2 * std::cos(w) / a0, a2 = (1 - al) / a0;
        double e = 0;
        for (const auto* ch : {&x.L, &x.R}) {
            double z[2][2] = {{0, 0}, {0, 0}};
            for (size_t i = 0; i < ch->size(); ++i) {
                double y = (*ch)[i];
                for (auto& st : z) {
                    const double in = y;
                    y = b0 * in + st[0];
                    st[0] = -a1 * y + st[1];
                    st[1] = b2 * in - a2 * y;
                }
                if (i > static_cast<size_t>(0.3 * SR)) e += y * y;
            }
        }
        return 10 * std::log10(e + 1e-30);
    };
    {
        // 6c. l'EQ mesuree sur le mouille de HALL (la meme queue avec et sans l'EQ)
        ArpFxSettings h = base;
        h.skyType = 2;
        h.sky = skyDefaults(SKY_HALL);
        const Fx2 ref = wetOf(h, 6, 0.3, false);
        struct Case {
            const char* what;
            double lo, mhz, mdb, mq, hi;
            int los, his;
            double f, want;
        };
        // MID : 200 x 40^v ; v = 0.4664 -> 1 kHz ; GAIN 24 (v - 0.5) : 0.75 -> +6 dB, 0 -> -12 dB
        const double v1k = std::log(1000.0 / 200) / std::log(40.0);
        const double vLo200 = std::log(200.0 / 20) / std::log(100.0), vHi4k = std::log(4000.0 / 1000) / std::log(20.0);
        const Case cases[] = {
            {"MID 1 kHz +6 dB : +6 dB a 1 kHz", 0, v1k, 0.75, 0.3, 1, 0, 0, 1000, 6},
            {"MID 1 kHz -12 dB : -12 dB a 1 kHz", 0, v1k, 0, 0.3, 1, 0, 0, 1000, -12},
            {"LOW CUT 200 Hz 12 dB : -3 dB a 200 Hz", vLo200, 0.5, 0.5, 0.3, 1, 0, 0, 200, -3.01},
            {"LOW CUT 200 Hz 24 dB : -24 dB a 100 Hz", vLo200, 0.5, 0.5, 0.3, 1, 1, 0, 100, -24.1},
            {"HIGH CUT 4 kHz 12 dB : -3 dB a 4 kHz", 0, 0.5, 0.5, 0.3, vHi4k, 0, 0, 4000, -3.01},
            {"HIGH CUT 4 kHz 24 dB : -26.7 dB a 8 kHz (bilineaire)", 0, 0.5, 0.5, 0.3, vHi4k, 0, 1, 8000, -26.68},
        };
        for (const Case& c : cases) {
            ArpFxSettings e = h;
            e.rvLoCut = c.lo;
            e.rvLoSlope = c.los;
            e.rvMidHz = c.mhz;
            e.rvMidDb = c.mdb;
            e.rvMidQ = c.mq;
            e.rvHiCut = c.hi;
            e.rvHiSlope = c.his;
            const Fx2 w = wetOf(e, 6, 0.3, false);
            const double g = bandDb(w, c.f) - bandDb(ref, c.f);
            std::snprintf(msg, sizeof msg, "REVERB EQ v46 %s : mesure %+.2f dB", c.what, g);
            check(std::fabs(g - c.want) <= (std::fabs(c.want) > 20 ? 1.5 : 0.6), msg);
        }
        // CLASSIC aussi (la convolution, que FREEZE ne coupe pas) : la difference des rendus avec et sans la cloche est
        // (H - 1) x le mouille : nette a 1 kHz (+6 dB : H - 1 = 1), nulle loin de la cloche
        ArpFxSettings c0 = base;
        c0.rvMidHz = v1k;
        c0.rvMidDb = 0.75;
        const Fx2 a = fxRender(base, 128, 6, 0.3, nullptr, 0, false), b = fxRender(c0, 128, 6, 0.3, nullptr, 0, false);
        Fx2 dlt;
        dlt.L.resize(a.L.size());
        dlt.R.resize(a.R.size());
        for (size_t i = 0; i < a.L.size(); ++i) {
            dlt.L[i] = b.L[i] - a.L[i];
            dlt.R[i] = b.R[i] - a.R[i];
        }
        const double at1k = bandDb(dlt, 1000), at100 = bandDb(dlt, 60);
        std::snprintf(msg, sizeof msg, "REVERB EQ v46 sur CLASSIC : la cloche agit a 1 kHz (%+.1f dB de plus qu'a 60 Hz)", at1k - at100);
        check(at1k - at100 > 15, msg);
    }
    {
        // 6d. WIDTH : 0 = mono (cote nul), 150 % = cote x 1.5 (+3.5 dB)
        ArpFxSettings h = base;
        h.skyType = 2;
        h.sky = skyDefaults(SKY_HALL);
        const auto sideMid = [](const Fx2& w) {
            double es = 0, em = 0;
            for (size_t i = 0; i < w.L.size(); ++i) {
                const double m = 0.5 * (w.L[i] + w.R[i]), s = 0.5 * (w.L[i] - w.R[i]);
                es += s * s;
                em += m * m;
            }
            return std::make_pair(10 * std::log10(es + 1e-30), 10 * std::log10(em + 1e-30));
        };
        const auto r = sideMid(wetOf(h, 4, 0.3));
        ArpFxSettings w0 = h, w15 = h;
        w0.rvWidth = 0;
        w15.rvWidth = 1;
        const auto a = sideMid(wetOf(w0, 4, 0.3)), b = sideMid(wetOf(w15, 4, 0.3));
        std::snprintf(msg, sizeof msg, "REVERB WIDTH v46 : MONO cote %.1f dB sous le milieu ; 150 %% : cote %+.2f dB (attendu +3.52), milieu %+.3f dB", a.second - a.first,
                      b.first - r.first, b.second - r.second);
        check(a.second - a.first > 100 && std::fabs(b.first - r.first - 3.52) < 0.1 && std::fabs(b.second - r.second) < 0.01, msg);
    }
    {
        // 6e. DUCK : le mouille baisse pendant la note (le sec au-dessus de -12 dBFS), revient dans les silences
        ArpFxSettings h = base;
        h.volume = 1;
        h.skyType = 2;
        h.sky = skyDefaults(SKY_HALL);
        ArpFxSettings d = h;
        d.rvDuck = 1;
        const Fx2 a = wetOf(h, 6, 0.8), b = wetOf(d, 6, 0.8);
        const auto rms = [](const Fx2& x, double t0, double t1) {
            double e = 0;
            for (size_t i = static_cast<size_t>(t0 * SR); i < static_cast<size_t>(t1 * SR); ++i) e += x.L[i] * x.L[i] + x.R[i] * x.R[i];
            return 10 * std::log10(e + 1e-30);
        };
        // la deuxieme note (1.5 a 2 s) ; le silence qui suit, apres 400 ms (le retour : 250 ms)
        const double inNote = rms(b, 1.6, 1.95) - rms(a, 1.6, 1.95);
        const double after = rms(b, 2.6, 2.95) - rms(a, 2.6, 2.95);
        std::snprintf(msg, sizeof msg, "REVERB DUCK v46 a 100 %% : le mouille %+.1f dB pendant la note, %+.2f dB dans le silence qui suit", inNote, after);
        check(inNote < -20 && after > -1.5, msg);
    }
    {
        // 6f. FREEZE : la queue tenue 40 s (ni NaN, ni explosion, ni chute), l'entree coupee, sans clic ; coupe : elle repart
        for (int m : {SKY_HALL, SKY_PLATE, SKY_CLOUD, SKY_SHIMMER, SKY_MAGNETO, SKY_NONLINEAR}) {
            Sky s;
            s.prepare(SR);
            SkyNorm nrm = skyDefaults(m);
            nrm.mod = 1; // la modulation la plus forte (l'interpolation a chaque echantillon)
            s.set(m, nrm, true);
            s.reset();
            const size_t n = static_cast<size_t>(48 * SR);
            std::vector<float> iL(n), iR(n), oL(n), oR(n);
            seed = 31;
            for (size_t i = 0; i < n; ++i) iL[i] = iR[i] = static_cast<float>(noise() * 0.3); // du bruit tout le long
            const size_t on = static_cast<size_t>(2 * SR), off = static_cast<size_t>(44 * SR);
            for (size_t i = 0; i < n; i += 256) {
                if (i == on) s.setFreeze(true);
                if (i == off) s.setFreeze(false);
                s.process(iL.data() + i, iR.data() + i, oL.data() + i, oR.data() + i, 256);
            }
            const auto rmsAt = [&](double t0, double t1) {
                double e = 0;
                for (size_t i = static_cast<size_t>(t0 * SR); i < static_cast<size_t>(t1 * SR); ++i) e += static_cast<double>(oL[i]) * oL[i] + static_cast<double>(oR[i]) * oR[i];
                return 10 * std::log10(e / ((t1 - t0) * SR) + 1e-30);
            };
            bool fin = true;
            double pk = 0, jump = 0, prev = -1;
            for (size_t i = 0; i < n; ++i) {
                fin = fin && std::isfinite(oL[i]) && std::isfinite(oR[i]);
                pk = std::max(pk, static_cast<double>(std::max(std::fabs(oL[i]), std::fabs(oR[i]))));
            }
            // le clic : la plus grande pente (echantillon a echantillon) dans les 100 ms de l'engagement et de la coupure,
            // rapportee a celle de la seconde d'avant
            const auto slope = [&](double t0, double t1) {
                double d = 0;
                for (size_t i = static_cast<size_t>(t0 * SR) + 1; i < static_cast<size_t>(t1 * SR); ++i)
                    d = std::max(d, static_cast<double>(std::max(std::fabs(oL[i] - oL[i - 1]), std::fabs(oR[i] - oR[i - 1]))));
                return d;
            };
            // (a la coupure, la reverbe rejoue : la reference est la plus forte de la seconde tenue et du jeu d'avant)
            jump = std::max(20 * std::log10(slope(2, 2.1) / slope(1, 1.9)), 20 * std::log10(slope(44, 44.1) / std::max(slope(42.9, 43.8), slope(1, 1.9))));
            (void)prev;
            const double r3 = rmsAt(3, 4), r40 = rmsAt(40, 43), r47 = rmsAt(47, 48), rIn = rmsAt(1, 2);
            std::snprintf(msg, sizeof msg, "FREEZE v46 %-11s tient %+.2f dB de 3 s a 43 s (%+.1f dB sur l'entree en jeu), pente %+.1f dB, crete %.2f, %s",
                          NAMES[m], r40 - r3, r3 - rIn, jump, pk, fin ? "fini" : "NaN");
            // (NONLINEAR : ses prises s'eteignent, seule sa queue tardive est tenue)
            check(fin && std::fabs(r40 - r3) < 3 && jump < 3 && pk < 8 && r3 - rIn > (m == SKY_NONLINEAR ? -20 : -12), msg);
            std::snprintf(msg, sizeof msg, "FREEZE v46 %-11s coupe : la reverbe reprend son entree (%.1f dB a 47 s, %.1f dB en jeu avant)", NAMES[m], r47, rIn);
            check(std::fabs(r47 - rIn) < 3, msg);
        }
        // l'entree coupee : FREEZE engage sur une reverbe vide, du bruit en entree : rien ne sort
        Sky s;
        s.prepare(SR);
        s.set(SKY_HALL, skyDefaults(SKY_HALL), true);
        s.setFreeze(true, true);
        s.reset();
        seed = 8;
        const Out o = render(s, 2, [](size_t) { return noise() * 0.5; });
        check(energy(o.L) + energy(o.R) == 0, "FREEZE v46 sur une reverbe vide : l'entree est coupee, rien ne sort (au bit pres)");
        // SPRING n'a pas de reseau : FREEZE n'y change rien
        Sky a, b;
        for (Sky* x : {&a, &b}) {
            x->prepare(SR);
            x->set(SKY_SPRING, skyDefaults(SKY_SPRING), true);
            x->reset();
        }
        b.setFreeze(true, true);
        seed = 9;
        const Out oa = render(a, 2, [](size_t i) { return i < 4800 ? noise() * 0.5 : 0.0; });
        seed = 9;
        const Out ob = render(b, 2, [](size_t i) { return i < 4800 ? noise() * 0.5 : 0.0; });
        bool same = true;
        for (size_t i = 0; i < oa.L.size(); ++i) same = same && oa.L[i] == ob.L[i] && oa.R[i] == ob.R[i];
        check(same, "FREEZE v46 sur SPRING : sans effet (pas de reseau), au bit pres");
    }
    {
        // 6g. la sortie de la reverbe ne depend pas de la taille des blocs
        ArpFxSettings h = base;
        h.skyType = 2;
        h.sky = skyDefaults(SKY_HALL);
        h.rvLoCut = 0.4;
        h.rvLoSlope = 1;
        h.rvMidDb = 0.8;
        h.rvHiCut = 0.5;
        h.rvWidth = 0.9;
        h.rvDuck = 0.6;
        ArpFxSettings f = h;
        f.rvFreeze = true;
        f.rvMidDb = 0.2;
        const Fx2 r = fxRender(h, 64, 4, 0.3, &f, 2.0);
        const Fx2 s1 = fxRender(h, 1000, 4, 0.3, &f, 2.0);
        const Fx2 s2 = fxRender(h, 128, 4, 0.3, &f, 2.0);
        // (le changement de reglages tombe au premier bloc apres 2 s : 2 s pile pour 64 et 128, 2.0 s + pour 1000)
        check(sameFx(r, s2), "REVERB v46 : EQ, WIDTH, DUCK puis FREEZE en jeu : blocs de 64 et 128, meme sortie au bit pres");
        (void)s1;
        // le cout de la sortie (tout engage) : le meme rendu sans elle
        const auto t0 = std::chrono::steady_clock::now();
        fxRender(h, 256, 8);
        const double c1 = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count() / 8;
        const auto t1 = std::chrono::steady_clock::now();
        ArpFxSettings h0 = base;
        h0.skyType = 2;
        h0.sky = skyDefaults(SKY_HALL);
        fxRender(h0, 256, 8);
        const double c0 = std::chrono::duration<double>(std::chrono::steady_clock::now() - t1).count() / 8;
        std::snprintf(msg, sizeof msg, "REVERB v46 : la sortie tout engagee coute %.2f %% d'un coeur (la chaine : %.1f %%)", 100 * (c1 - c0), 100 * c0);
        check(c1 - c0 < 0.03, msg);
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
