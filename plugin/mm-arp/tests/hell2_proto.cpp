// HELL v2, prototype HORS LIGNE (aucun son joue : rendu en memoire, mesures, fichiers WAV optionnels).
// La chaine proposee : CHOP -> I ECHO (le vrai Hell.cpp du depot) -> II WARP -> IV SHATTER -> VI METAL -> III SPIN,
// puis le niveau automatique, la loi de MIX (descente), le limiteur doux.
//   node plugin/mm-arp/tests/hell2-bank-gen.mjs . bank.txt   (la banque de src/v4/plugin/arp/hell2.ts)
//   g++ -O2 -std=c++17 -Iplugin/mm-arp/dsp plugin/mm-arp/tests/hell2_proto.cpp plugin/mm-arp/dsp/Hell.cpp -o hell2_proto
//   ./hell2_proto bank.txt [dossier des wav]   (non branche au CMake ni au CI : un outil de mesure de la maquette v44)
#include "Hell.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <complex>
#include <cstdint>
#include <cstdio>
#include <fstream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

using mmarp::Hell;
using mmarp::HellSettings;

static const double SR = 48000;
static const double PI = 3.14159265358979323846;
static const double BPM = 120;

struct Preset {
    std::string name;
    bool old = false;
    std::map<std::string, double> v;
    double of(const std::string& k, double d = 0) const {
        auto it = v.find(k);
        return it == v.end() ? d : it->second;
    }
};

static int stepOf(double v, int n) { return std::max(0, std::min(n - 1, static_cast<int>(std::lround(v * (n - 1))))); }
static double clamp01(double x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
static uint32_t hash32(uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}
static double rnd01(uint32_t k) { return (hash32(k) & 0xffffff) / 16777216.0; }

// les tables de hell2.ts
static const double RATE_BEATS[7] = {0.25, 0.5, 1, 2, 4, 8, 16};
static const double CHOP_BEATS[7] = {1.0 / 16, 1.0 / 8, 1.0 / 6, 1.0 / 4, 1.0 / 3, 1.0 / 2, 1};
static const double GRAIN_BEATS[5] = {1.0 / 16, 1.0 / 8, 1.0 / 4, 1.0 / 2, 1};
static std::map<std::string, double> ENTRY;

static double smooth(double x) {
    x = clamp01(x);
    return x * x * (3 - 2 * x);
}
static double depthOf(const std::string& id, double m, int mode) {
    if (m <= 0) return 0;
    if (mode == 1) return std::min(1.0, m);
    const double e = ENTRY[id];
    return smooth((m - e) / std::max(1e-6, 1 - e));
}

static HellSettings echoSettings(const Preset& p, double noteHz) {
    HellSettings s;
    s.mix = 0.5; // sec 1, mouille 1 : le son direct et ses echos (la chaine passe ensuite)
    s.sync = stepOf(p.of("xHellSync"), Hell::kSync);
    s.timeMs = Hell::timeMsOf(p.of("xHellTime", 0.5));
    s.feedback = p.of("xHellFb", 0.5);
    s.cross = stepOf(p.of("xHellCross"), 2) == 1;
    s.shiftHz = Hell::shiftHzFor(p.of("xHellShift", 0.5), stepOf(p.of("xHellRange"), 4), BPM, noteHz);
    s.upDown = p.of("xHellUpDown", 1);
    s.spread = p.of("xHellSpread");
    s.phase = p.of("xHellPhase");
    s.antiRefl = stepOf(p.of("xHellAntiRefl"), 2) == 1;
    s.smear = p.of("xHellSmear");
    s.hpHz = Hell::hpHzOf(p.of("xHellHp"));
    s.lpHz = Hell::lpHzOf(p.of("xHellLp", 1));
    s.lfoHz = stepOf(p.of("xHellLfoSync"), 2) == 1 ? Hell::lfoSyncHz(p.of("xHellLfoRate"), BPM) : Hell::lfoHzOf(p.of("xHellLfoRate", 0.4));
    s.lfoDepthHz = Hell::lfoDepthHzOf(p.of("xHellLfoDepth"));
    s.lfoShape = stepOf(p.of("xHellLfoShape"), 4);
    s.lfoAmt = 2 * p.of("xHellLfoAmt", 0.5) - 1;
    s.lfoStereo = stepOf(p.of("xHellLfoStereo"), 2) == 1;
    s.lfoTarget = stepOf(p.of("xHellLfoTarget"), 4);
    s.tone = p.of("xHellTone", 0.5);
    return s;
}

/* ---------------- les cercles ---------------- */

struct Ring {
    std::vector<float> b;
    int m = 0, w = 0;
    void alloc(double sec) {
        int n = 1;
        while (n < sec * SR) n <<= 1;
        b.assign(static_cast<size_t>(n), 0.f);
        m = n - 1;
        w = 0;
    }
    void push(double x) {
        b[static_cast<size_t>(w)] = static_cast<float>(x);
        w = (w + 1) & m;
    }
    // d echantillons en arriere (fractionnaire), Hermite
    double read(double d) const {
        d = std::max(1.0, std::min(static_cast<double>(m - 4), d));
        const int di = static_cast<int>(d);
        const double f = d - di;
        auto at = [&](int k) { return static_cast<double>(b[static_cast<size_t>((w - k) & m)]); };
        const double y0 = at(di - 1), y1 = at(di), y2 = at(di + 1), y3 = at(di + 2);
        const double c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
        return ((c3 * f + c2) * f + c1) * f + y1;
    }
};

struct Svf {
    double ic1 = 0, ic2 = 0;
    double lp(double x, double fc, double q) {
        const double g = std::tan(PI * std::min(fc, 0.45 * SR) / SR), k = 1 / q;
        const double a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
        const double v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2 * v1 - ic1;
        ic2 = 2 * v2 - ic2;
        return v2;
    }
};

struct Engine {
    Preset p;
    Hell hell;
    // CHOP
    std::vector<float> cap[2];
    long capLen = 0;
    long chopSlot = -1;
    bool chopRep = false;
    int chopCount = 0;
    double chopPrevOut[2] = {0, 0};
    double chopXf = 1;
    std::vector<float> slotRec[2];
    // WARP
    Ring wr[2];
    double wd = 0, wdOld = 0, wXf = 1;
    long wCycle = -1;
    double wRandFrom = 0, wRandTo = 0;
    // SHATTER
    Ring gr[2];
    struct Grain {
        double pos = 0, len = 0, rate = 1, t = 0, pan = 0;
        bool rev = false, on = false;
    };
    Grain grains[16];
    long gNext = 0;
    uint32_t gSeed = 1;
    // METAL
    Ring comb[2];
    double combP = 100, combPT = 100;
    // SPIN
    Ring ch[2];
    double walk[2][3] = {{0}}, walkV[2][3] = {{0}};
    Svf sw[2];
    // niveau
    double eIn = 1e-6, eY = 1e-6, gl = 1, pIn = 1e-6, pY = 1e-6, eRef = 1e-6, pRef = 1e-6;
    double dc[2] = {0, 0}, dcX[2] = {0, 0};

    void prepare(const Preset& pp) {
        p = pp;
        hell.prepare(SR);
        for (int c = 0; c < 2; ++c) {
            cap[c].assign(static_cast<size_t>(SR * 2.2), 0.f);
            slotRec[c].assign(static_cast<size_t>(SR * 2.2), 0.f);
            wr[c].alloc(4.5);
            gr[c].alloc(2.5);
            comb[c].alloc(0.1);
            ch[c].alloc(0.1);
        }
    }

    /** Un bloc : x (entree stereo), m (MIX), pos0 (echantillon absolu, la mesure commence a 0), noteHz. */
    void process(float* L, float* R, int n, double m, long pos0, double noteHz) {
        if (m <= 0) return; // contourne au bit pres
        if (p.old) {
            HellSettings s = echoSettings(p, noteHz);
            s.mix = m;
            hell.set(s, BPM);
            hell.process(L, R, n);
            return;
        }
        const int mode = stepOf(p.of("xHellDescent"), 2);
        const double dEcho = std::min(1.0, 2 * m);
        const double dWarp = depthOf("warp", m, mode), dSpin = depthOf("spin", m, mode), dSh = depthOf("shatter", m, mode);
        const double dChop = depthOf("chop", m, mode), dMetal = depthOf("metal", m, mode);
        const double c = std::min(1.0, 2 * m); // la part du chemin HELL dans la sortie
        const double beatS = 60.0 / BPM;
        std::vector<float> yl(L, L + n), yr(R, R + n);
        float* y[2] = {yl.data(), yr.data()};

        // ---- V CHOP (sur l'entree) ----
        const double chopAmt = p.of("xHellChop") * dChop;
        if (chopAmt > 0) {
            const double slotLen = CHOP_BEATS[stepOf(p.of("xHellChopGrid", 0.5), 7)] * beatS * SR;
            const double st = std::round(24 * (p.of("xHellChopPitch", 0.5) - 0.5));
            const double gate = std::max(0.05, p.of("xHellChopGate", 1));
            for (int i = 0; i < n; ++i) {
                const long pos = pos0 + i;
                const long slot = static_cast<long>(std::floor(pos / slotLen));
                const double inSlot = pos - slot * slotLen;
                if (slot != chopSlot) {
                    // une case qui commence : on rejoue la case d'avant, ou on laisse passer
                    const bool rep = rnd01(static_cast<uint32_t>(slot) * 2654435761u + 17) < chopAmt;
                    if (rep && !chopRep) {
                        // la case d'avant (en direct) devient la boucle
                        for (int cc = 0; cc < 2; ++cc) std::copy(slotRec[cc].begin(), slotRec[cc].begin() + static_cast<long>(slotLen) + 1, cap[cc].begin());
                        capLen = static_cast<long>(slotLen);
                        chopCount = 0;
                    }
                    chopCount = rep ? chopCount + 1 : 0;
                    chopRep = rep;
                    chopSlot = slot;
                    chopXf = 0;
                }
                const long ri = static_cast<long>(inSlot);
                for (int cc = 0; cc < 2; ++cc) slotRec[cc][static_cast<size_t>(std::min<long>(ri, static_cast<long>(slotRec[cc].size()) - 1))] = y[cc][i];
                for (int cc = 0; cc < 2; ++cc) {
                    double o = y[cc][i];
                    if (chopRep && capLen > 8) {
                        const double ratio = std::pow(2.0, chopCount * st / 12.0);
                        double rp = std::fmod(inSlot * ratio, static_cast<double>(capLen));
                        const long k0 = static_cast<long>(rp);
                        const double f = rp - k0;
                        o = cap[cc][static_cast<size_t>(k0)] * (1 - f) + cap[cc][static_cast<size_t>(std::min(capLen, k0 + 1))] * f;
                        // GATE : la repetition s'arrete avant la fin de la case (fondu de 2 ms)
                        const double gEnd = gate * slotLen;
                        if (inSlot > gEnd) o *= std::max(0.0, 1 - (inSlot - gEnd) / (0.002 * SR));
                    }
                    // fondu de 3 ms entre deux cases
                    const double xf = std::min(1.0, chopXf);
                    o = xf * o + (1 - xf) * chopPrevOut[cc];
                    if (chopXf >= 1) chopPrevOut[cc] = o;
                    else chopPrevOut[cc] += (o - chopPrevOut[cc]) * 0.0;
                    y[cc][i] = static_cast<float>(o);
                }
                chopXf += 1.0 / (0.003 * SR);
            }
        }

        // ---- I ECHO (le vrai Hell.cpp) ----
        {
            HellSettings s = echoSettings(p, noteHz);
            s.feedback *= 0.6 + 0.4 * dEcho;
            hell.set(s, BPM);
            hell.process(y[0], y[1], n);
        }

        // ---- II WARP ----
        const double wSt = 12 * std::pow(p.of("xHellWarp"), 2) * dWarp;
        const int wShape = stepOf(p.of("xHellWarpShape"), 5);
        const double wBeats = RATE_BEATS[stepOf(p.of("xHellWarpRate", 2.0 / 6), 7)];
        for (int i = 0; i < n; ++i) {
            for (int cc = 0; cc < 2; ++cc) wr[cc].push(y[cc][i]);
            if (wSt <= 0.001) continue;
            const double beats = (pos0 + i) / SR / beatS;
            const long cyc = static_cast<long>(std::floor(beats / wBeats));
            const double ph = beats / wBeats - cyc;
            const double C = wBeats * beatS * SR; // echantillons par cycle
            const double base = 0.004 * SR;
            double d;
            if (wShape == 0) {
                // WOBBLE : un retard sinusoidal, la hauteur va de -st a +st (exact, borne)
                const double A = std::min(1.9 * SR, (std::pow(2.0, wSt / 12) - 1) * C / (2 * PI));
                d = base + A * (1 - std::sin(2 * PI * ph));
            } else {
                if (cyc != wCycle) {
                    // un cycle neuf : DROP et STOP repartent du retard minimal (fondu de 8 ms)
                    if (wShape == 2 || wShape == 3) {
                        wdOld = wd;
                        wd = base;
                        wXf = 0;
                    }
                    wRandFrom = wRandTo;
                    wRandTo = (2 * rnd01(static_cast<uint32_t>(cyc) * 7919u + 3) - 1) * wSt;
                    wCycle = cyc;
                }
                double semis = 0;
                if (wShape == 1) semis = wSt * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph); // BEND : triangle
                else if (wShape == 2) semis = -wSt * ph;                               // DROP
                else if (wShape == 4) semis = wRandFrom + (wRandTo - wRandFrom) * smooth(ph / 0.35);
                double rate = std::pow(2.0, semis / 12);
                if (wShape == 3) rate = ph < 0.75 ? 1 : std::max(0.0, 1 - (wSt / 12) * (ph - 0.75) / 0.25); // STOP
                wd += 1 - rate;
                if (wShape == 1 || wShape == 4) wd += (base + 0.02 * SR - wd) * 0.00002; // la derive ramenee
                wd = std::max(base, std::min(4.2 * SR, wd));
                d = wd;
            }
            for (int cc = 0; cc < 2; ++cc) {
                double o = wr[cc].read(d);
                if (wXf < 1) o = wXf * o + (1 - wXf) * wr[cc].read(wdOld);
                y[cc][i] = static_cast<float>(o);
            }
            if (wXf < 1) wXf = std::min(1.0, wXf + 1.0 / (0.008 * SR));
        }

        // ---- IV SHATTER ----
        const double gAmt = p.of("xHellShatter") * dSh;
        const double gLen = std::max(0.012 * SR, GRAIN_BEATS[stepOf(p.of("xHellShatterSize", 0.5), 5)] * beatS * SR);
        const double spray = p.of("xHellShatterSpray", 0.3);
        for (int i = 0; i < n; ++i) {
            for (int cc = 0; cc < 2; ++cc) gr[cc].push(y[cc][i]);
            if (gAmt <= 0) continue;
            const long pos = pos0 + i;
            const long hop = static_cast<long>(gLen / 2);
            if (pos % std::max(1L, hop) == 0) {
                for (auto& g : grains)
                    if (!g.on) {
                        const uint32_t k = static_cast<uint32_t>(pos / std::max(1L, hop));
                        const double r1 = rnd01(k * 31 + 1), r2 = rnd01(k * 31 + 2), r3 = rnd01(k * 31 + 3), r4 = rnd01(k * 31 + 4);
                        static const double RAT[5] = {1, 2, 0.5, 1.5, 0.75};
                        const int ri = r1 < 1 - spray ? 0 : 1 + static_cast<int>(r2 * 4) % 4;
                        g = Grain{};
                        g.on = true;
                        g.len = gLen;
                        g.rate = RAT[ri];
                        g.rev = r3 < 0.45 * spray;
                        g.pos = gLen * std::max(1.0, g.rate) + 0.02 * SR + r4 * 0.25 * SR * spray; // en arriere
                        g.pan = (rnd01(k * 31 + 5) * 2 - 1) * spray;
                        break;
                    }
            }
            double o[2] = {0, 0};
            for (auto& g : grains) {
                if (!g.on) continue;
                const double w = 0.5 - 0.5 * std::cos(2 * PI * g.t / g.len);
                const double off = g.rev ? g.pos - g.len * g.rate + g.t * (1 + g.rate) : g.pos - g.t * g.rate + g.t;
                for (int cc = 0; cc < 2; ++cc) {
                    const double pan = cc == 0 ? std::sqrt(0.5 * (1 - g.pan)) : std::sqrt(0.5 * (1 + g.pan));
                    o[cc] += gr[cc].read(std::max(2.0, off)) * w * pan * 1.414;
                }
                g.t += 1;
                if (g.t >= g.len) g.on = false;
            }
            for (int cc = 0; cc < 2; ++cc) y[cc][i] = static_cast<float>((1 - gAmt) * y[cc][i] + gAmt * o[cc]);
        }

        // ---- VI METAL ----
        const double ringAmt = p.of("xHellRing") * dMetal;
        const double combAmt = p.of("xHellComb") * dMetal;
        const int tune = stepOf(p.of("xHellRingTune"), 6);
        const double nh = noteHz > 0 ? noteHz : 220;
        static const double TUNE_MUL[4] = {1, 1.5, 2, 0.5};
        const double fr = tune < 4 ? nh * TUNE_MUL[tune] : BPM / 60 * (tune == 4 ? 8 : 32);
        const int seq = stepOf(p.of("xHellCombSeq"), 5);
        static const int SEQ[4][8] = {{0, 12, 0, -12, 0, 12, 24, 12}, {0, 7, 12, 7, 0, 7, 12, 19}, {0, 3, 7, 10, 12, 10, 7, 3}, {0, 1, 2, 3, 4, 5, 6, 7}};
        for (int i = 0; i < n; ++i) {
            const long pos = pos0 + i;
            if (ringAmt > 0) {
                const double cr = std::cos(2 * PI * fr * pos / SR);
                for (int cc = 0; cc < 2; ++cc) y[cc][i] = static_cast<float>((1 - ringAmt) * y[cc][i] + ringAmt * y[cc][i] * cr * 1.414);
            }
            if (combAmt > 0) {
                const long beat = static_cast<long>(std::floor(pos / SR / beatS));
                const int semi = seq < 4 ? SEQ[seq][beat % 8] : static_cast<int>(rnd01(static_cast<uint32_t>(beat) * 13 + 5) * 13);
                double fc = nh * std::pow(2.0, semi / 12.0);
                while (fc < 110) fc *= 2;
                while (fc > 1800) fc /= 2;
                combPT = SR / fc;
                combP += (combPT - combP) * 0.002;
                const double g = 0.55 + 0.35 * p.of("xHellComb");
                for (int cc = 0; cc < 2; ++cc) {
                    // le peigne a reinjection : y = x + g y[n - P]
                    const double fbk = comb[cc].read(combP);
                    const double cy = y[cc][i] + g * fbk;
                    comb[cc].push(cy);
                    y[cc][i] = static_cast<float>((1 - combAmt) * y[cc][i] + combAmt * cy * (1 - g) * 1.6);
                }
            }
        }

        // ---- III SPIN (le chorus ivre, le balayage, le panoramique qui tournoie) ----
        const double spinAmt = p.of("xHellSpin") * dSpin, drunk = p.of("xHellDrunk") * dSpin, sweep = p.of("xHellSweep") * dSpin;
        const double sBeats = RATE_BEATS[stepOf(p.of("xHellSpinRate", 4.0 / 6), 7)];
        for (int i = 0; i < n; ++i) {
            const long pos = pos0 + i;
            const double ph = std::fmod(pos / SR / beatS / sBeats, 1.0);
            for (int cc = 0; cc < 2; ++cc) ch[cc].push(y[cc][i]);
            if (drunk > 0) {
                for (int cc = 0; cc < 2; ++cc) {
                    double o = 0;
                    for (int v = 0; v < 3; ++v) {
                        // une marche aleatoire lissee (le pas change tous les 1/16)
                        const long k = pos / static_cast<long>(beatS * SR / 4);
                        const double target = rnd01(static_cast<uint32_t>(k * 7 + v * 101 + cc * 997)) * 2 - 1;
                        walkV[cc][v] += (target - walkV[cc][v]) * 0.0004;
                        walk[cc][v] += (walkV[cc][v] - walk[cc][v]) * 0.0008;
                        const double dms = 9 + v * 4 + walk[cc][v] * 7 * drunk;
                        o += ch[cc].read(dms * SR / 1000);
                    }
                    y[cc][i] = static_cast<float>((1 - 0.6 * drunk) * y[cc][i] + 0.6 * drunk * o / 1.7);
                }
            }
            if (sweep > 0) {
                const double fc = 250 * std::pow(2.0, 5.5 * (0.5 - 0.5 * std::cos(2 * PI * ph)));
                for (int cc = 0; cc < 2; ++cc) y[cc][i] = static_cast<float>((1 - sweep) * y[cc][i] + sweep * sw[cc].lp(y[cc][i], fc, 3.2) * 0.8);
            }
            if (spinAmt > 0) {
                const double th = PI / 4 * (1 + spinAmt * std::sin(2 * PI * ph));
                const double mid = 0.5 * (y[0][i] + y[1][i]), side = 0.5 * (y[0][i] - y[1][i]);
                y[0][i] = static_cast<float>(mid * std::cos(th) * 1.414 + side);
                y[1][i] = static_cast<float>(mid * std::sin(th) * 1.414 - side);
            }
        }

        // ---- le niveau : la sortie jamais plus forte que l'entree +2 dB (RMS 300 ms), ses cretes +1 dB au plus ; un gain
        // lent (descente 30 ms, remontee 500 ms, +4 dB au plus quand le chemin s'eteint), puis le plafond doux a -1 dBFS ----
        const double aIn = 1 - std::exp(-1 / (0.3 * SR));
        const double rel = std::exp(-1 / (0.15 * SR));
        float* io[2] = {L, R};
        for (int i = 0; i < n; ++i) {
            const double xi = 0.5 * (L[i] * L[i] + R[i] * R[i]);
            eIn += (xi - eIn) * aIn;
            pIn = std::max(static_cast<double>(std::max(std::fabs(L[i]), std::fabs(R[i]))), pIn * rel);
            double o[2];
            for (int cc = 0; cc < 2; ++cc) {
                // un passe-haut de 10 Hz sur le chemin HELL (le WARP et les grains peuvent pousser du continu)
                const double x = y[cc][i];
                dc[cc] = x - dcX[cc] + 0.9987 * dc[cc];
                dcX[cc] = x;
                o[cc] = (1 - c) * io[cc][i] + c * dc[cc];
            }
            const double oi = 0.5 * (o[0] * o[0] + o[1] * o[1]);
            eY += (oi - eY) * aIn;
            pY = std::max(std::max(std::fabs(o[0]), std::fabs(o[1])), pY * rel);
            // la reference de l'entree garde sa memoire 3 s : une queue d'echos n'est pas coupee quand les notes s'arretent
            const double hold = std::exp(-1 / (3.0 * SR));
            eRef = std::max(eIn, eRef * hold);
            pRef = std::max(pIn, pRef * hold);
            const double want = std::min({1.58, 1.26 * std::sqrt((eRef + 1e-9) / (eY + 1e-9)), 1.41 * (pRef + 1e-6) / (pY + 1e-6)});
            gl += (want - gl) * (want < gl ? 1 / (0.03 * SR) : 1 / (0.5 * SR));
            for (int cc = 0; cc < 2; ++cc) {
                double v = o[cc] * gl;
                const double av = std::fabs(v);
                if (av > 0.794) v = (v > 0 ? 1 : -1) * (0.794 + 0.097 * std::tanh((av - 0.794) / 0.097)); // plafond -1 dBFS
                io[cc][i] = static_cast<float>(v);
            }
        }
    }
};

/* ---------------- l'entree d'essai ---------------- */

struct Input {
    std::vector<float> x;
    std::vector<double> note; // la note jouee (Hz) par echantillon
};

static double midiHz(int m) { return 440.0 * std::pow(2.0, (m - 69) / 12.0); }

// ARP : doubles-croches a 120 BPM, F# mineur (F#3 A3 C#4 F#4 A4 C#5 A4 F#4), dent de scie filtree, 8 s puis 4 s de silence
static Input makeArp() {
    Input in;
    const long N = static_cast<long>(12 * SR);
    in.x.assign(static_cast<size_t>(N), 0.f);
    in.note.assign(static_cast<size_t>(N), 0);
    const int seq[8] = {54, 57, 61, 66, 69, 73, 69, 66};
    const long step = static_cast<long>(SR * 60 / BPM / 4);
    double ph = 0, lp = 0;
    for (long i = 0; i < static_cast<long>(8 * SR); ++i) {
        const long k = i / step;
        const long t = i - k * step;
        const double f = midiHz(seq[k % 8]);
        ph += f / SR;
        if (ph >= 1) ph -= 1;
        double s = 2 * ph - 1;
        // PolyBLEP
        const double dt = f / SR;
        if (ph < dt) {
            const double u = ph / dt;
            s -= u + u - u * u - 1;
        } else if (ph > 1 - dt) {
            const double u = (ph - 1) / dt;
            s -= u * u + u + u + 1;
        }
        const double te = t / SR;
        const double env = std::min(1.0, te / 0.002) * std::exp(-te / 0.06);
        const double fc = 700 + 4000 * std::exp(-te / 0.03);
        lp += (s - lp) * (1 - std::exp(-2 * PI * fc / SR));
        in.x[static_cast<size_t>(i)] = static_cast<float>(0.55 * env * lp);
        in.note[static_cast<size_t>(i)] = f;
    }
    for (long i = static_cast<long>(8 * SR); i < N; ++i) in.note[static_cast<size_t>(i)] = midiHz(66);
    return in;
}

// DRONE : un accord tenu (F#2 C#3 F#3 A3), deux dents de scie legerement desaccordees : sans rythme propre (la mesure du sync)
static Input makeDrone() {
    Input in;
    const long N = static_cast<long>(12 * SR);
    in.x.assign(static_cast<size_t>(N), 0.f);
    in.note.assign(static_cast<size_t>(N), midiHz(54));
    const int notes[4] = {42, 49, 54, 57};
    double ph[8] = {0};
    double lp = 0;
    for (long i = 0; i < static_cast<long>(8 * SR); ++i) {
        double s = 0;
        for (int v = 0; v < 8; ++v) {
            const double f = midiHz(notes[v / 2]) * (v % 2 ? 1.5 : 1.0);
            ph[v] += f / SR;
            if (ph[v] >= 1) ph[v] -= 1;
            s += 2 * ph[v] - 1;
        }
        lp += (s - lp) * (1 - std::exp(-2 * PI * 2500 / SR));
        const double env = std::min(1.0, i / (0.05 * SR)) * std::min(1.0, (8 * SR - i) / (0.05 * SR));
        in.x[static_cast<size_t>(i)] = static_cast<float>(0.09 * lp * env);
    }
    return in;
}

/* ---------------- le rendu, les mesures ---------------- */

struct OutT {
    std::vector<float> L, R;
    double ms = 0;
};
using Out = OutT;

static Out render(const Preset& p, const Input& in, double mix, bool ramp = false) {
    Engine e;
    e.prepare(p);
    Out o{in.x, in.x};
    const int B = 128;
    const auto t0 = std::chrono::steady_clock::now();
    const long N = static_cast<long>(in.x.size());
    for (long i = 0; i < N; i += B) {
        const int n = static_cast<int>(std::min<long>(B, N - i));
        const double m = ramp ? std::min(1.0, i / (8 * SR)) : mix;
        e.process(o.L.data() + i, o.R.data() + i, n, m, i, in.note[static_cast<size_t>(i)]);
    }
    o.ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
    return o;
}

double db(double x) { return 20 * std::log10(std::max(1e-12, x)); }
static double rms(const std::vector<float>& L, const std::vector<float>& R, long a, long b) {
    double s = 0;
    for (long i = a; i < b; ++i) s += 0.5 * (L[static_cast<size_t>(i)] * L[static_cast<size_t>(i)] + R[static_cast<size_t>(i)] * R[static_cast<size_t>(i)]);
    return std::sqrt(s / std::max(1L, b - a));
}

static void fft(std::vector<std::complex<double>>& a) {
    const size_t n = a.size();
    for (size_t i = 1, j = 0; i < n; ++i) {
        size_t bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) std::swap(a[i], a[j]);
    }
    for (size_t len = 2; len <= n; len <<= 1) {
        const double ang = -2 * PI / static_cast<double>(len);
        const std::complex<double> wl(std::cos(ang), std::sin(ang));
        for (size_t i = 0; i < n; i += len) {
            std::complex<double> w(1);
            for (size_t j = 0; j < len / 2; ++j) {
                const auto u = a[i + j], v = a[i + j + len / 2] * w;
                a[i + j] = u + v;
                a[i + j + len / 2] = u - v;
                w *= wl;
            }
        }
    }
}

double db(double x);
static double rms(const std::vector<float>& L, const std::vector<float>& R, long a, long b);
double syncScore(const OutT& o, std::vector<double>* feat);
struct Feat {
    std::vector<double> f;
    double centroid = 0, width = 0, sync = 0, pitchMove = 0, panMove = 0, gate = 0, flat = 0;
};

// le timbre (24 bandes), la largeur, le mouvement (la modulation de l'enveloppe), sur 0..8 s
static Feat features(const Out& o, const Out* drone) {
    Feat F;
    const size_t NF = 4096;
    std::vector<double> band(24, 0);
    double cn = 0, cd = 0;
    for (size_t s0 = 0; s0 + NF < static_cast<size_t>(8 * SR); s0 += NF) {
        std::vector<std::complex<double>> a(NF);
        for (size_t i = 0; i < NF; ++i) a[i] = 0.5 * (o.L[s0 + i] + o.R[s0 + i]) * (0.5 - 0.5 * std::cos(2 * PI * i / NF));
        fft(a);
        for (size_t k = 1; k < NF / 2; ++k) {
            const double f = k * SR / NF, e = std::norm(a[k]);
            if (f < 30 || f > 16000) continue;
            const int b = std::min(23, static_cast<int>(24 * std::log(f / 30) / std::log(16000.0 / 30)));
            band[static_cast<size_t>(b)] += e;
            cn += f * e;
            cd += e;
        }
    }
    double tot = 0;
    for (double e : band) tot += e;
    for (size_t b = 0; b < 24; b += 3) F.f.push_back(10 * std::log10((band[b] + band[b + 1] + band[b + 2]) / tot + 1e-9) / 3);
    F.centroid = cn / std::max(1e-12, cd);
    // la largeur : cote / milieu
    double ms = 0, ss = 0;
    for (long i = 0; i < static_cast<long>(8 * SR); ++i) {
        const double m = 0.5 * (o.L[static_cast<size_t>(i)] + o.R[static_cast<size_t>(i)]), s = 0.5 * (o.L[static_cast<size_t>(i)] - o.R[static_cast<size_t>(i)]);
        ms += m * m;
        ss += s * s;
    }
    F.width = 10 * std::log10((ss + 1e-12) / (ms + 1e-12));
    F.f.push_back(std::max(-40.0, F.width) / 2);
    // le mouvement : sur le DRONE (sans rythme propre), le flux spectral (32 bandes, gauche et droite) toutes les 10 ms,
    // puis son spectre de modulation : la part qui tombe sur le tempo (1/32 de temps a 8 par temps, +/- 4 %)
    if (drone) {
        F.sync = syncScore(*drone, &F.f);
        const size_t NF2 = 2048, HOP = 480;
        std::vector<double> pitch, bal, lev, flat;
        for (size_t s0 = static_cast<size_t>(0.5 * SR); s0 + NF2 < static_cast<size_t>(8 * SR); s0 += HOP) {
            std::vector<std::complex<double>> a(NF2);
            double eL = 1e-12, eR = 1e-12;
            for (size_t i = 0; i < NF2; ++i) {
                const double w = 0.5 - 0.5 * std::cos(2 * PI * i / NF2);
                a[i] = 0.5 * (drone->L[s0 + i] + drone->R[s0 + i]) * w;
                eL += drone->L[s0 + i] * drone->L[s0 + i];
                eR += drone->R[s0 + i] * drone->R[s0 + i];
            }
            fft(a);
            size_t kb = 0;
            double best = 0, gs = 0, as = 0;
            int cnt = 0;
            for (size_t k = 2; k < NF2 / 2 - 1; ++k) {
                const double f = k * SR / NF2, e = std::norm(a[k]);
                if (f > 150 && f < 1500 && e > best) {
                    best = e;
                    kb = k;
                }
                if (f > 100 && f < 8000) {
                    gs += std::log(e + 1e-20);
                    as += e;
                    ++cnt;
                }
            }
            if (kb > 0) {
                const double l = std::log(std::norm(a[kb - 1]) + 1e-20), c0 = std::log(std::norm(a[kb]) + 1e-20), r = std::log(std::norm(a[kb + 1]) + 1e-20);
                const double d = 0.5 * (l - r) / (l - 2 * c0 + r - 1e-12);
                pitch.push_back((kb + d) * SR / NF2);
            }
            bal.push_back(10 * std::log10(eL / eR));
            lev.push_back(10 * std::log10(0.5 * (eL + eR) / NF2));
            flat.push_back(10 * (gs / std::max(1, cnt) - std::log(as / std::max(1, cnt) + 1e-20)) / std::log(10.0));
        }
        auto median = [](std::vector<double> v) {
            std::sort(v.begin(), v.end());
            return v.empty() ? 0.0 : v[v.size() / 2];
        };
        auto sdev = [](const std::vector<double>& v) {
            double m = 0, q = 0;
            for (double x : v) m += x / v.size();
            for (double x : v) q += (x - m) * (x - m) / v.size();
            return std::sqrt(q);
        };
        const double pm = median(pitch);
        std::vector<double> st;
        for (double f : pitch) st.push_back(std::max(-12.0, std::min(12.0, 12 * std::log2(f / pm))));
        F.pitchMove = sdev(st);
        F.panMove = std::min(20.0, sdev(bal));
        const double lm = median(lev);
        int gates = 0;
        for (double l : lev)
            if (l < lm - 20) ++gates;
        F.gate = static_cast<double>(gates) / std::max<size_t>(1, lev.size());
        F.flat = median(flat);
        F.f.push_back(F.panMove / 3);
        F.f.push_back(F.flat / 6);
    }
    // la queue (ARP, 8.5 a 11 s) : l'echo qui reste
    F.f.push_back(std::max(-80.0, db(rms(o.L, o.R, static_cast<long>(8.5 * SR), static_cast<long>(11 * SR)) + 1e-9)) / 20);
    return F;
}

double syncScore(const OutT& o, std::vector<double>* feat) {
    const size_t NF = 1024, HOP = 480, NB = 32;
    std::vector<double> flux;
    std::vector<double> prev[2] = {std::vector<double>(NB, -200), std::vector<double>(NB, -200)};
    for (size_t s0 = static_cast<size_t>(0.5 * SR); s0 + NF < static_cast<size_t>(8 * SR); s0 += HOP) {
        double fx = 0;
        for (int c = 0; c < 2; ++c) {
            const std::vector<float>& x = c ? o.R : o.L;
            std::vector<std::complex<double>> a(NF);
            for (size_t i = 0; i < NF; ++i) a[i] = x[s0 + i] * (0.5 - 0.5 * std::cos(2 * PI * i / NF));
            fft(a);
            std::vector<double> band(NB, 1e-12);
            for (size_t k = 1; k < NF / 2; ++k) {
                const double f = k * SR / NF;
                if (f < 60 || f > 12000) continue;
                band[std::min(NB - 1, static_cast<size_t>(NB * std::log(f / 60) / std::log(200.0)))] += std::norm(a[k]);
            }
            for (size_t b = 0; b < NB; ++b) {
                const double e = 10 * std::log10(band[b]);
                if (prev[c][b] > -150) fx += std::max(0.0, e - prev[c][b]);
                prev[c][b] = e;
            }
        }
        flux.push_back(fx);
    }
    double mean = 0;
    for (double e : flux) mean += e;
    mean /= static_cast<double>(flux.size());
    const size_t M = 1024;
    const double frameHz = SR / HOP;
    std::vector<std::complex<double>> a(M);
    for (size_t i = 0; i < M; ++i) a[i] = i < flux.size() ? (flux[i] - mean) * (0.5 - 0.5 * std::cos(2 * PI * i / flux.size())) : 0;
    fft(a);
    double on = 0, all = 0;
    const double bh = BPM / 60;
    const double rel[] = {1.0 / 32, 1.0 / 16, 1.0 / 8, 1.0 / 4, 1.0 / 2, 1, 1.5, 2, 3, 4, 6, 8};
    std::vector<double> modb(12, 0);
    for (size_t k = 1; k < M / 2; ++k) {
        const double f = k * frameHz / M, e = std::norm(a[k]);
        if (f < 0.2 || f > 20) continue;
        all += e;
        bool hit = false;
        for (double r : rel)
            if (std::fabs(f - bh * r) <= std::max(0.1, 0.04 * bh * r)) hit = true;
        if (hit) on += e;
        modb[std::min<size_t>(11, static_cast<size_t>(std::log2(f / 0.2) / std::log2(100.0) * 12))] += e;
    }
    if (feat) {
        double mt = 0;
        for (double e : modb) mt += e;
        for (double e : modb) feat->push_back(4 * std::log10(e / (mt + 1e-12) + 1e-6));
        feat->push_back(std::min(40.0, 10 * std::log10(all + 1e-9)) / 4);
    }
    return all > 1e-9 ? on / all : 0;
}

static void writeWav(const std::string& path, const Out& o) {
    std::ofstream f(path, std::ios::binary);
    const uint32_t n = static_cast<uint32_t>(o.L.size()), bytes = n * 4;
    auto w32 = [&](uint32_t v) { f.write(reinterpret_cast<const char*>(&v), 4); };
    auto w16 = [&](uint16_t v) { f.write(reinterpret_cast<const char*>(&v), 2); };
    f.write("RIFF", 4);
    w32(36 + bytes);
    f.write("WAVEfmt ", 8);
    w32(16);
    w16(1);
    w16(2);
    w32(48000);
    w32(48000 * 4);
    w16(4);
    w16(16);
    f.write("data", 4);
    w32(bytes);
    for (uint32_t i = 0; i < n; ++i) {
        const int16_t l = static_cast<int16_t>(std::lround(std::max(-1.0f, std::min(1.0f, o.L[i])) * 32767));
        const int16_t r = static_cast<int16_t>(std::lround(std::max(-1.0f, std::min(1.0f, o.R[i])) * 32767));
        f.write(reinterpret_cast<const char*>(&l), 2);
        f.write(reinterpret_cast<const char*>(&r), 2);
    }
}

int main(int argc, char** argv) {
    if (argc < 2) return 1;
    std::ifstream bf(argv[1]);
    const std::string wavDir = argc > 2 ? argv[2] : "";
    std::vector<Preset> bank;
    std::string line;
    Preset cur;
    while (std::getline(bf, line)) {
        if (line.rfind("circle ", 0) == 0) {
            std::istringstream ss(line.substr(7));
            std::string id;
            double e;
            ss >> id >> e;
            ENTRY[id] = e;
        } else if (line.rfind("preset ", 0) == 0 || line.rfind("old ", 0) == 0) {
            cur = Preset{};
            cur.old = line[0] == 'o';
            cur.name = line.substr(cur.old ? 4 : 7);
        } else if (line == "end") bank.push_back(cur);
        else if (!line.empty()) {
            std::istringstream ss(line);
            std::string k;
            double v;
            ss >> k >> v;
            cur.v[k] = v;
        }
    }
    const Input arp = makeArp(), drone = makeDrone();
    {
        OutT ref{drone.x, drone.x}, dry{drone.x, drone.x};
        for (size_t i = 0; i < ref.L.size(); ++i) {
            const double t = i / SR;
            const double g = std::pow(10.0, -0.3 * (1 + std::sin(2 * PI * 1.37 * t)));
            const double d = 0.004 * SR * (1 + 0.5 * std::sin(2 * PI * 0.71 * t));
            const double si = static_cast<double>(i) - d;
            const long k = static_cast<long>(std::floor(si));
            const double f = si - k;
            const double v = k >= 0 ? drone.x[static_cast<size_t>(k)] * (1 - f) + drone.x[static_cast<size_t>(k + 1)] * f : 0;
            ref.L[i] = static_cast<float>(v * g);
            ref.R[i] = static_cast<float>(v * g);
        }
        std::printf("TEMOINS DU SYNC : le DRONE seul %.2f ; un tremolo et un vibrato hors tempo (1.37 Hz, 0.71 Hz) %.2f\n", syncScore(dry, nullptr), syncScore(ref, nullptr));
    }
    const double inRms = rms(arp.x, arp.x, 0, static_cast<long>(8 * SR));
    double inPk = 0;
    for (float s : arp.x) inPk = std::max(inPk, static_cast<double>(std::fabs(s)));
    double inShort = 0;
    for (long i = 0; i + 2400 < static_cast<long>(8 * SR); i += 2400) inShort = std::max(inShort, rms(arp.x, arp.x, i, i + 2400));
    std::printf("ENTREE ARP : RMS %.1f dBFS, crete %.1f dBFS, RMS 50 ms max %.1f dBFS\n", db(inRms), db(inPk), db(inShort));
    std::printf("\n%-18s %4s | %6s %6s %6s %6s %6s %6s | %5s %5s %5s | %5s | %s\n", "PRESET", "MIX", "GAIN", "CRETE", "50MS", "QUEUE", "LARG", "PLAF%", "PANO", "PLAT", "SYNC", "CPU%", "etat");
    std::vector<Feat> feats;
    std::vector<std::string> names;
    std::vector<bool> isOld;
    int bad = 0;
    // la banque neuve (MIX 0.25, 0.5, 0.75, 1) et l'ancienne (son seul cercle, MIX 0.5 et 1)
    for (const auto& p : bank) {
        Feat keep;
        const std::vector<double> mixes = p.old ? std::vector<double>{0.5, 1.0} : std::vector<double>{0.25, 0.5, 0.75, 1.0};
        for (double mx : mixes) {
            const Out o = render(p, arp, mx);
            const Out d = render(p, drone, mx);
            const double r = rms(o.L, o.R, 0, static_cast<long>(8 * SR));
            double pk = 0, maxShort = 0, sat = 0;
            bool nan = false;
            for (size_t i = 0; i < o.L.size(); ++i) {
                if (std::fabs(o.L[i]) > 0.794 || std::fabs(o.R[i]) > 0.794) sat += 1;
                if (!std::isfinite(o.L[i]) || !std::isfinite(o.R[i])) nan = true;
                pk = std::max(pk, static_cast<double>(std::max(std::fabs(o.L[i]), std::fabs(o.R[i]))));
            }
            for (long i = 0; i + 2400 < static_cast<long>(12 * SR); i += 2400) maxShort = std::max(maxShort, rms(o.L, o.R, i, i + 2400));
            const double tail = rms(o.L, o.R, static_cast<long>(9 * SR), static_cast<long>(12 * SR));
            const Feat F = features(o, &d);
            const double cpu = 100 * o.ms / 12000.0;
            const bool ok = !nan && pk < 1.0 && db(maxShort) - db(inShort) < 3.5;
            if (!ok) ++bad;
            std::printf("%-18s %4.2f | %+6.1f %6.1f %+6.1f %6.1f %6.1f %6.3f | %5.1f %5.1f %5.2f | %5.1f | %s\n", p.name.c_str(), mx, db(r) - db(inRms), db(pk), db(maxShort) - db(inShort), db(tail) - db(inRms), std::max(-99.0, F.width), 100 * sat / o.L.size(), F.panMove, F.flat, F.sync, cpu, ok ? "ok" : "A REVOIR");
            if (mx == (p.old ? 1.0 : 0.75)) keep = F;
            if (!p.old && mx == 0.75 && !wavDir.empty()) {
                std::string fn = p.name;
                for (auto& ch : fn)
                    if (ch == ' ') ch = '-';
                writeWav(wavDir + "/HELL2-" + fn + ".wav", o);
            }
        }
        feats.push_back(keep);
        names.push_back(p.name);
        isOld.push_back(p.old);
    }
    // MIX de 0 a 1 en 8 s (la descente) : le niveau de sortie rapporte a l'entree, par fenetres de 250 ms (deux notes)
    std::printf("\nLA DESCENTE (MIX 0 -> 1 en 8 s, ARP) : sortie / entree par fenetres de 250 ms, son plus grand saut, la crete\n");
    for (const auto& p : bank) {
        if (p.old) continue;
        const Out o = render(p, arp, 0, true);
        const long W = static_cast<long>(0.25 * SR);
        double lo = 1e9, hi = -1e9, jump = 0, last = 0, pk = 0;
        bool first = true;
        for (long i = 0; i + W <= static_cast<long>(8 * SR); i += W) {
            const double r = db(rms(o.L, o.R, i, i + W)) - db(rms(arp.x, arp.x, i, i + W));
            lo = std::min(lo, r);
            hi = std::max(hi, r);
            if (!first) jump = std::max(jump, std::fabs(r - last));
            last = r;
            first = false;
        }
        for (size_t i = 0; i < o.L.size(); ++i) pk = std::max(pk, static_cast<double>(std::max(std::fabs(o.L[i]), std::fabs(o.R[i]))));
        std::printf("  %-18s de %+5.1f a %+5.1f dB, saut max %4.1f dB, crete %5.1f dBFS\n", p.name.c_str(), lo, hi, jump, db(pk));
    }
    // MIX 0 : contourne au bit pres
    {
        const Out o = render(bank[0], arp, 0);
        bool same = true;
        for (size_t i = 0; i < o.L.size(); ++i)
            if (o.L[i] != arp.x[i] || o.R[i] != arp.x[i]) same = false;
        std::printf("\nMIX 0 : %s\n", same ? "contourne au bit pres" : "DIFFERENT");
    }
    // les distances : chaque preset et son plus proche voisin (timbre, largeur, mouvement), dans chaque banque
    const size_t D = feats[0].f.size();
    std::vector<double> mu(D, 0), sd(D, 0);
    for (const auto& F : feats)
        for (size_t k = 0; k < D; ++k) mu[k] += F.f[k] / feats.size();
    for (const auto& F : feats)
        for (size_t k = 0; k < D; ++k) sd[k] += std::pow(F.f[k] - mu[k], 2) / feats.size();
    for (auto& s : sd) s = std::sqrt(s) + 1e-6;
    auto dist = [&](size_t a, size_t b) {
        double s = 0;
        for (size_t k = 0; k < D; ++k) s += std::pow((feats[a].f[k] - feats[b].f[k]) / sd[k], 2);
        return std::sqrt(s / D);
    };
    for (int oldBank = 0; oldBank < 2; ++oldBank) {
        std::printf("\n%s : le plus proche voisin (distance normalisee ; plus c'est grand, plus il est different)\n", oldBank ? "ANCIENNE BANQUE (24, MIX 1)" : "BANQUE PROPOSEE (16, MIX 0.75)");
        std::vector<double> nn;
        for (size_t a = 0; a < feats.size(); ++a) {
            if (isOld[a] != static_cast<bool>(oldBank)) continue;
            double best = 1e9;
            size_t bi = a;
            for (size_t b = 0; b < feats.size(); ++b)
                if (b != a && isOld[b] == isOld[a] && dist(a, b) < best) {
                    best = dist(a, b);
                    bi = b;
                }
            nn.push_back(best);
            std::printf("  %-18s -> %-18s %5.2f   sync %4.2f\n", names[a].c_str(), names[bi].c_str(), best, feats[a].sync);
        }
        std::sort(nn.begin(), nn.end());
        std::printf("  minimum %.2f, mediane %.2f\n", nn.front(), nn[nn.size() / 2]);
    }
    std::printf("\n%d rendu(s) a revoir\n", bad);
    return bad ? 2 : 0;
}
