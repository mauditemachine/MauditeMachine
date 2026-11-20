// MM-ARP, HELL v2 (dsp/Hell2.{h,cpp}) : contourne au bit pres a MIX 0 (et revenu a 0), les 16 presets de la page
// (hell2.ts, via tests/hell2_presets.inc) a MIX 25, 50, 75 et 100 % : ni NaN, ni crete au-dessus de -1 dBFS ; la
// descente (MIX de 0 a 1) ; l'independance a la taille des blocs ; la grille calee sur la position de l'hote (CHOP) et
// l'horloge propre quand l'hote est a l'arret ; la stabilite aux reglages extremes ; 44.1 et 96 kHz ; le cout.
// Aucun son n'est joue : tout est rendu en memoire.
//   ./mmarp_hell2_test                    les verifications (le CI)
//   ./mmarp_hell2_test --render <dossier> en plus : les 16 presets a MIX 75 % en WAV, les mesures (sync, differences)
#include "Hell2.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <complex>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <string>
#include <vector>

#include "hell2_presets.inc" // GENERE par tests/hell2-presets-gen.mjs depuis src/v4/plugin/arp/hell2.ts
#include "hell_presets.inc"  // l'ancienne banque (hell.ts), pour comparer (le mode --render)

using mmarp::Hell2;
using mmarp::Hell2Settings;

static int fails = 0;
static void check(bool ok, const std::string& what) {
    std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what.c_str());
    if (!ok) ++fails;
}

static const double PI = 3.14159265358979323846;
static const double CEIL = 0.8912509381337456; // -1 dBFS
static double db(double x) { return 20 * std::log10(std::max(1e-12, x)); }

/* ---------------- un preset de la page vers le DSP (comme PluginProcessor.cpp) ---------------- */

struct Vals {
    double v[Hell2::kKeys];
    bool v2 = true;
};

// la face arrondit au millieme (extra.ts clean), un cran tombe juste ; l'hote garde un float
static double asHost(double x, int steps) {
    const double c = steps > 1 ? std::lround(x * (steps - 1)) / static_cast<double>(steps - 1) : std::round(x * 1000) / 1000;
    return static_cast<double>(static_cast<float>(c));
}

static Vals valsOf(const Hell2PresetRef& p) {
    Vals o;
    for (int k = 0; k < Hell2::kKeys; ++k) {
        o.v[k] = -1;
        for (int i = 0; i < kHell2PresetKeys; ++i)
            if (std::strcmp(kHell2PresetIds[i], Hell2::kKeyIds[k]) == 0) o.v[k] = asHost(p.v[i], Hell2::kKeySteps[k]);
    }
    for (int i = 0; i < kHell2PresetKeys; ++i)
        if (std::strcmp(kHell2PresetIds[i], "xHellV2") == 0) o.v2 = p.v[i] >= 0.5;
    return o;
}

/* ---------------- les entrees ---------------- */

struct Input {
    std::vector<float> x;
    std::vector<double> note;
};
static double midiHz(int m) { return 440.0 * std::pow(2.0, (m - 69) / 12.0); }

// ARP : doubles-croches a 120 BPM, F# mineur, dent de scie filtree, 8 s puis 4 s de silence (crete -5.7 dBFS)
static Input makeArp(double sr, double bpm = 120) {
    Input in;
    const long N = static_cast<long>(12 * sr);
    in.x.assign(static_cast<size_t>(N), 0.f);
    in.note.assign(static_cast<size_t>(N), midiHz(66));
    const int seq[8] = {54, 57, 61, 66, 69, 73, 69, 66};
    const long step = static_cast<long>(sr * 60 / bpm / 4);
    double ph = 0, lp = 0;
    for (long i = 0; i < static_cast<long>(8 * sr); ++i) {
        const long k = i / step, t = i - k * step;
        const double f = midiHz(seq[k % 8]);
        ph += f / sr;
        if (ph >= 1) ph -= 1;
        double s = 2 * ph - 1;
        const double dt = f / sr;
        if (ph < dt) {
            const double u = ph / dt;
            s -= u + u - u * u - 1;
        } else if (ph > 1 - dt) {
            const double u = (ph - 1) / dt;
            s -= u * u + u + u + 1;
        }
        const double te = t / sr;
        const double env = std::min(1.0, te / 0.002) * std::exp(-te / 0.06);
        const double fc = 700 + 4000 * std::exp(-te / 0.03);
        lp += (s - lp) * (1 - std::exp(-2 * PI * fc / sr));
        in.x[static_cast<size_t>(i)] = static_cast<float>(0.55 * env * lp);
        in.note[static_cast<size_t>(i)] = f;
    }
    return in;
}

// DRONE : un accord tenu, sans rythme propre (la mesure du sync)
static Input makeDrone(double sr) {
    Input in;
    const long N = static_cast<long>(12 * sr);
    in.x.assign(static_cast<size_t>(N), 0.f);
    in.note.assign(static_cast<size_t>(N), midiHz(54));
    const int notes[4] = {42, 49, 54, 57};
    double ph[8] = {0};
    double lp = 0;
    for (long i = 0; i < static_cast<long>(8 * sr); ++i) {
        double s = 0;
        for (int v = 0; v < 8; ++v) {
            const double f = midiHz(notes[v / 2]) * (v % 2 ? 1.5 : 1.0);
            ph[v] += f / sr;
            if (ph[v] >= 1) ph[v] -= 1;
            s += 2 * ph[v] - 1;
        }
        lp += (s - lp) * (1 - std::exp(-2 * PI * 2500 / sr));
        const double env = std::min(1.0, i / (0.05 * sr)) * std::min(1.0, (8 * sr - i) / (0.05 * sr));
        in.x[static_cast<size_t>(i)] = static_cast<float>(0.09 * lp * env);
    }
    return in;
}

/* ---------------- le rendu ---------------- */

struct Out {
    std::vector<float> L, R;
    double ms = 0;
    bool activeAtEnd = false;
};

struct Run {
    double sr = 48000, bpm = 120;
    int block = 256;
    double ppq0 = 0;
    bool playing = true;
    double rampTo = -1;   // >= 0 : MIX glisse de mix a rampTo en 8 s
    double cutAt = -1;    // >= 0 : MIX a 0 a partir de cette seconde
};

static Out render(const Vals& p, const Input& in, double mix, const Run& r = Run{}) {
    Hell2 h;
    h.prepare(r.sr);
    Out o{in.x, in.x};
    const long N = static_cast<long>(in.x.size());
    const double pps = r.bpm / 60.0 / r.sr;
    const auto t0 = std::chrono::steady_clock::now();
    for (long i = 0; i < N; i += r.block) {
        const int n = static_cast<int>(std::min<long>(r.block, N - i));
        double m = mix;
        if (r.rampTo >= 0) m = mix + (r.rampTo - mix) * std::min(1.0, i / (8 * r.sr));
        if (r.cutAt >= 0 && i >= r.cutAt * r.sr) m = 0;
        const double nh = in.note[static_cast<size_t>(i)];
        h.set(Hell2::settingsOf(p.v, m, r.bpm, nh), r.bpm);
        h.process(o.L.data() + i, o.R.data() + i, n, r.ppq0 + static_cast<double>(i) * pps, r.playing, nh);
    }
    o.ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
    o.activeAtEnd = h.active();
    return o;
}

static double peakOf(const Out& o, long a = 0, long b = -1) {
    if (b < 0) b = static_cast<long>(o.L.size());
    double pk = 0;
    for (long i = a; i < b; ++i) pk = std::max(pk, static_cast<double>(std::max(std::fabs(o.L[static_cast<size_t>(i)]), std::fabs(o.R[static_cast<size_t>(i)]))));
    return pk;
}
static bool finiteOf(const Out& o) {
    for (size_t i = 0; i < o.L.size(); ++i)
        if (!std::isfinite(o.L[i]) || !std::isfinite(o.R[i])) return false;
    return true;
}
static double rms(const std::vector<float>& L, const std::vector<float>& R, long a, long b) {
    double s = 0;
    for (long i = a; i < b; ++i) s += 0.5 * (L[static_cast<size_t>(i)] * L[static_cast<size_t>(i)] + R[static_cast<size_t>(i)] * R[static_cast<size_t>(i)]);
    return std::sqrt(s / std::max(1L, b - a));
}

/* ---------------- les mesures (le mode --render) ---------------- */

// l'ancienne banque (24 presets de hell.ts) dans l'ancien moteur, a MIX donne (comme PluginProcessor.cpp, xHellV2 OFF)
static Out renderOld(const HellPresetRef& p, const Input& in, double mix) {
    const double* v = p.v;
    const auto st = [](double x, int n) { return std::max(0, std::min(n - 1, static_cast<int>(std::lround(x * (n - 1))))); };
    mmarp::HellSettings s;
    s.mix = mix;
    s.sync = st(v[hp_xHellSync], mmarp::Hell::kSync);
    s.timeMs = mmarp::Hell::timeMsOf(v[hp_xHellTime]);
    s.feedback = v[hp_xHellFb];
    s.cross = st(v[hp_xHellCross], 2) == 1;
    s.shiftHz = mmarp::Hell::shiftHzFor(v[hp_xHellShift], st(v[hp_xHellRange], 4), 120, 220);
    s.upDown = v[hp_xHellUpDown];
    s.spread = v[hp_xHellSpread];
    s.phase = v[hp_xHellPhase];
    s.antiRefl = st(v[hp_xHellAntiRefl], 2) == 1;
    s.smear = v[hp_xHellSmear];
    s.hpHz = mmarp::Hell::hpHzOf(v[hp_xHellHp]);
    s.lpHz = mmarp::Hell::lpHzOf(v[hp_xHellLp]);
    s.lfoHz = st(v[hp_xHellLfoSync], 2) == 1 ? mmarp::Hell::lfoSyncHz(v[hp_xHellLfoRate], 120) : mmarp::Hell::lfoHzOf(v[hp_xHellLfoRate]);
    s.lfoDepthHz = mmarp::Hell::lfoDepthHzOf(v[hp_xHellLfoDepth]);
    s.lfoShape = st(v[hp_xHellLfoShape], 4);
    s.lfoAmt = 2 * v[hp_xHellLfoAmt] - 1;
    s.lfoStereo = st(v[hp_xHellLfoStereo], 2) == 1;
    s.lfoTarget = st(v[hp_xHellLfoTarget], 4);
    s.tone = v[hp_xHellTone];
    mmarp::Hell h;
    h.prepare(48000);
    Out o{in.x, in.x};
    for (size_t i = 0; i < o.L.size(); i += 256) {
        const int n = static_cast<int>(std::min<size_t>(256, o.L.size() - i));
        h.set(s, 120);
        h.process(o.L.data() + i, o.R.data() + i, n);
    }
    return o;
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

// la part du mouvement (le flux spectral toutes les 10 ms, son spectre de modulation) qui tombe sur le tempo ; feat
// recoit la forme du spectre de modulation (12 bandes) et son energie
static double syncScore(const Out& o, double sr, double bpm, std::vector<double>* feat) {
    const size_t NF = 1024, HOP = 480, NB = 32;
    std::vector<double> flux;
    std::vector<double> prev[2] = {std::vector<double>(NB, -200), std::vector<double>(NB, -200)};
    for (size_t s0 = static_cast<size_t>(0.5 * sr); s0 + NF < static_cast<size_t>(8 * sr); s0 += HOP) {
        double fx = 0;
        for (int c = 0; c < 2; ++c) {
            const std::vector<float>& x = c ? o.R : o.L;
            std::vector<std::complex<double>> a(NF);
            for (size_t i = 0; i < NF; ++i) a[i] = x[s0 + i] * (0.5 - 0.5 * std::cos(2 * PI * i / NF));
            fft(a);
            std::vector<double> band(NB, 1e-12);
            for (size_t k = 1; k < NF / 2; ++k) {
                const double f = k * sr / NF;
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
    const double frameHz = sr / HOP;
    std::vector<std::complex<double>> a(M);
    for (size_t i = 0; i < M; ++i) a[i] = i < flux.size() ? (flux[i] - mean) * (0.5 - 0.5 * std::cos(2 * PI * i / flux.size())) : 0;
    fft(a);
    double on = 0, all = 0;
    const double bh = bpm / 60;
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

// le timbre (8 bandes), la largeur, le mouvement du panoramique, la planeite, la queue, le spectre de modulation
static std::vector<double> features(const Out& o, const Out& drone, double sr, double& sync) {
    std::vector<double> F;
    const size_t NF = 4096;
    std::vector<double> band(24, 0);
    for (size_t s0 = 0; s0 + NF < static_cast<size_t>(8 * sr); s0 += NF) {
        std::vector<std::complex<double>> a(NF);
        for (size_t i = 0; i < NF; ++i) a[i] = 0.5 * (o.L[s0 + i] + o.R[s0 + i]) * (0.5 - 0.5 * std::cos(2 * PI * i / NF));
        fft(a);
        for (size_t k = 1; k < NF / 2; ++k) {
            const double f = k * sr / NF;
            if (f < 30 || f > 16000) continue;
            band[static_cast<size_t>(std::min(23, static_cast<int>(24 * std::log(f / 30) / std::log(16000.0 / 30))))] += std::norm(a[k]);
        }
    }
    double tot = 0;
    for (double e : band) tot += e;
    for (size_t b = 0; b < 24; b += 3) F.push_back(10 * std::log10((band[b] + band[b + 1] + band[b + 2]) / tot + 1e-9) / 3);
    double ms = 0, ss = 0;
    for (long i = 0; i < static_cast<long>(8 * sr); ++i) {
        const double m = 0.5 * (o.L[static_cast<size_t>(i)] + o.R[static_cast<size_t>(i)]), s = 0.5 * (o.L[static_cast<size_t>(i)] - o.R[static_cast<size_t>(i)]);
        ms += m * m;
        ss += s * s;
    }
    F.push_back(std::max(-40.0, 10 * std::log10((ss + 1e-12) / (ms + 1e-12))) / 2);
    sync = syncScore(drone, sr, 120, &F);
    // le panoramique qui bouge (DRONE, fenetres de 10 ms)
    std::vector<double> bal;
    for (size_t s0 = static_cast<size_t>(0.5 * sr); s0 + 2048 < static_cast<size_t>(8 * sr); s0 += 480) {
        double eL = 1e-12, eR = 1e-12;
        for (size_t i = 0; i < 2048; ++i) {
            eL += drone.L[s0 + i] * drone.L[s0 + i];
            eR += drone.R[s0 + i] * drone.R[s0 + i];
        }
        bal.push_back(10 * std::log10(eL / eR));
    }
    double bm = 0, bq = 0;
    for (double x : bal) bm += x / bal.size();
    for (double x : bal) bq += (x - bm) * (x - bm) / bal.size();
    F.push_back(std::min(20.0, std::sqrt(bq)) / 3);
    F.push_back(std::max(-80.0, db(rms(o.L, o.R, static_cast<long>(8.5 * sr), static_cast<long>(11 * sr)) + 1e-9)) / 20);
    return F;
}

static void writeWav(const std::string& path, const Out& o, double sr) {
    std::ofstream f(path, std::ios::binary);
    const uint32_t n = static_cast<uint32_t>(o.L.size()), bytes = n * 4, rate = static_cast<uint32_t>(sr);
    const auto w32 = [&](uint32_t v) { f.write(reinterpret_cast<const char*>(&v), 4); };
    const auto w16 = [&](uint16_t v) { f.write(reinterpret_cast<const char*>(&v), 2); };
    f.write("RIFF", 4);
    w32(36 + bytes);
    f.write("WAVEfmt ", 8);
    w32(16);
    w16(1);
    w16(2);
    w32(rate);
    w32(rate * 4);
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

/* ---------------- les verifications ---------------- */

int main(int argc, char** argv) {
    std::string wavDir;
    for (int a = 1; a + 1 < argc; ++a)
        if (std::strcmp(argv[a], "--render") == 0) wavDir = argv[a + 1];
    const int NP = static_cast<int>(sizeof(kHell2Presets) / sizeof(kHell2Presets[0]));
    std::vector<Vals> bank;
    for (int i = 0; i < NP; ++i) bank.push_back(valsOf(kHell2Presets[i]));
    const double SR = 48000;
    const Input arp = makeArp(SR), drone = makeDrone(SR);

    // la loi de la descente : la meme dans la face (hell2.ts CIRCLES) et le DSP
    {
        bool same = true;
        for (int c = 0; c < Hell2::kCircles; ++c) same = same && std::fabs(kHell2CircleEntry[c] - Hell2::kEntry[c]) < 1e-12;
        bool keys = NP == 16;
        for (const Vals& p : bank) {
            keys = keys && p.v2;
            for (int k = 0; k < Hell2::kKeys; ++k) keys = keys && p.v[k] >= 0 && p.v[k] <= 1;
        }
        check(same, "l'entree des six cercles sur la course de MIX : la meme dans hell2.ts et Hell2.cpp");
        check(keys, "les 16 presets de hell2.ts portent les 40 reglages de HELL v2, xHellV2 a ON");
    }

    // MIX 0 : contourne au bit pres, quel que soit le preset
    {
        bool same = true;
        for (const Vals& p : bank) {
            const Out o = render(p, arp, 0);
            for (size_t i = 0; i < o.L.size(); ++i) same = same && o.L[i] == arp.x[i] && o.R[i] == arp.x[i];
            same = same && !o.activeAtEnd;
        }
        check(same, "MIX 0 : les 16 presets contournes au bit pres (process ne touche pas au signal)");
    }

    // les 16 presets a MIX 25, 50, 75, 100 % : ni NaN, ni crete au-dessus de -1 dBFS
    double inPk = 0;
    for (float s : arp.x) inPk = std::max(inPk, static_cast<double>(std::fabs(s)));
    const double inRms = rms(arp.x, arp.x, 0, static_cast<long>(8 * SR));
    std::printf("\nENTREE ARP : RMS %.1f dBFS, crete %.1f dBFS\n%-18s %5s | %6s %7s %7s | %5s\n", db(inRms), db(inPk), "PRESET", "MIX", "GAIN", "CRETE", "QUEUE", "CPU%");
    {
        bool ok = true;
        double worst = 0, gLo = 99, gHi = -99, cpuMax = 0;
        for (int i = 0; i < NP; ++i)
            for (double mx : {0.25, 0.5, 0.75, 1.0}) {
                const Out o = render(bank[static_cast<size_t>(i)], arp, mx);
                const double pk = peakOf(o);
                const double g = db(rms(o.L, o.R, 0, static_cast<long>(8 * SR))) - db(inRms);
                const double tail = db(rms(o.L, o.R, static_cast<long>(9 * SR), static_cast<long>(12 * SR))) - db(inRms);
                const double cpu = 100 * o.ms / 12000.0;
                const bool good = finiteOf(o) && pk <= CEIL + 1e-6;
                ok = ok && good;
                worst = std::max(worst, pk);
                gLo = std::min(gLo, g);
                gHi = std::max(gHi, g);
                cpuMax = std::max(cpuMax, cpu);
                std::printf("%-18s %4.0f%% | %+6.1f %7.2f %+7.1f | %5.2f %s\n", kHell2Presets[i].name, mx * 100, g, db(pk), tail, cpu, good ? "" : "A REVOIR");
            }
        check(ok, "16 presets x MIX 25/50/75/100 % : finis, crete " + std::to_string(db(worst)).substr(0, 6) + " dBFS (<= -1 dBFS), gain " +
                      std::to_string(gLo).substr(0, 5) + " a " + std::to_string(gHi).substr(0, 5) + " dB, cout max " + std::to_string(cpuMax).substr(0, 4) + " % d'un coeur");
        // le cout : le meilleur de trois rendus (un banc partage peut etre occupe), les presets les plus lourds a MIX 100 %
        double heavy = 0;
        for (int pi : {0, 5, 12, 15}) {
            double best = 1e9;
            for (int k = 0; k < 3; ++k) best = std::min(best, render(bank[static_cast<size_t>(pi)], arp, 1).ms);
            heavy = std::max(heavy, 100 * best / 12000.0);
        }
        check(heavy < 10, "le cout : " + std::to_string(heavy).substr(0, 4) + " % d'un coeur a 48 kHz au plus (THE DESCENT, SEASICK, DEMON CHOIR, LSD a MIX 100 %, moins de 10 %)");
    }

    // la descente : MIX de 0 a 1 en 8 s, puis retour a 0 : fini, sous le plafond, contourne de nouveau, au bit pres
    {
        bool ok = true;
        double pk = 0;
        for (const Vals& p : bank) {
            Run r;
            r.rampTo = 1;
            const Out o = render(p, arp, 0, r);
            ok = ok && finiteOf(o);
            pk = std::max(pk, peakOf(o));
        }
        check(ok && pk <= CEIL + 1e-6, "la descente (MIX 0 -> 100 % en 8 s), 16 presets : finie, crete " + std::to_string(db(pk)).substr(0, 6) + " dBFS");
        Run r;
        r.cutAt = 4;
        const Out o = render(bank[15], arp, 0.8, r);
        bool back = !o.activeAtEnd;
        // apres le glissement de 20 ms (et la tranche en cours), plus rien n'est touche
        for (size_t i = static_cast<size_t>(4.05 * SR); i < o.L.size(); ++i) back = back && o.L[i] == arp.x[i] && o.R[i] == arp.x[i];
        check(back, "MIX revenu a 0 (LSD, a 4 s) : HELL v2 se coupe et la sortie redevient l'entree au bit pres");
    }

    // la taille des blocs ne change rien (tranches de 64 sur un compteur global)
    {
        bool same = true;
        Input fixed = arp; // la note jouee fixe : l'hote la donne par bloc
        std::fill(fixed.note.begin(), fixed.note.end(), midiHz(61));
        for (int pi : {0, 3, 9, 15}) {
            Run a, b, c;
            a.block = 64;
            b.block = 333;
            c.block = 1;
            const Out oa = render(bank[static_cast<size_t>(pi)], fixed, 0.75, a), ob = render(bank[static_cast<size_t>(pi)], fixed, 0.75, b),
                      oc = render(bank[static_cast<size_t>(pi)], fixed, 0.75, c);
            for (size_t i = 0; i < oa.L.size(); ++i)
                same = same && oa.L[i] == ob.L[i] && oa.R[i] == ob.R[i] && oa.L[i] == oc.L[i] && oa.R[i] == oc.R[i];
        }
        check(same, "blocs de 1, 64 et 333 : la meme sortie au bit pres (THE DESCENT, STUTTER GOD, HELICOPTER, LSD)");
    }

    // la grille calee sur l'hote : CHOP a 100 % (1/16), le reste coupe ; la premiere repetition commence sur la grille de
    // l'hote (la troisieme case : la premiere est entamee, la deuxieme est enregistree), quelle que soit sa position
    {
        Vals p = bank[0];
        for (int k = Hell2::kWarp; k < Hell2::kKeys; ++k) p.v[k] = 0;
        p.v[Hell2::kFb] = 0;
        p.v[Hell2::kChop] = 1;
        p.v[Hell2::kChopGrid] = 3.0 / 6; // 1/16
        p.v[Hell2::kChopPitch] = 0.5;
        p.v[Hell2::kChopGate] = 1;
        p.v[Hell2::kDescent] = 1; // ALL : CHOP entre des la deuxieme tranche
        Vals q = p;
        q.v[Hell2::kChop] = 0;
        bool ok = true;
        std::string got;
        for (double phi : {0.0, 0.03, 0.11, 0.2, 7.9}) {
            Run r;
            r.ppq0 = phi;
            const Out a = render(p, arp, 1, r), b = render(q, arp, 1, r);
            long first = -1;
            for (size_t i = 0; i < a.L.size() && first < 0; ++i)
                if (a.L[i] != b.L[i] || a.R[i] != b.R[i]) first = static_cast<long>(i);
            const double slot = 0.25, spb = SR * 60 / 120;
            const double firstSlot = std::floor(phi / slot) + 1; // la premiere case entiere
            const double expect = std::ceil((((firstSlot + 1) * slot) - phi) * spb - 1e-9);
            got += " " + std::to_string(first) + "/" + std::to_string(static_cast<long>(expect));
            // (le fondu de 3 ms part de la voix d'avant : le premier echantillon change est celui d'apres le bord)
            ok = ok && first >= 0 && std::fabs(first - (expect + 1)) <= 1;
        }
        check(ok, "CHOP suit la grille de l'hote (ppq 0, 0.03, 0.11, 0.2, 7.9) : la repetition commence sur la case, a 1 echantillon pres :" + got);
    }

    // l'horloge : recalee quand l'hote saute ; a l'arret, elle continue au meme tempo
    {
        Hell2 h;
        h.prepare(48000);
        Vals p = bank[0];
        h.set(Hell2::settingsOf(p.v, 0.5, 120, 220), 120);
        std::vector<float> L(512, 0.f), R(512, 0.f);
        h.process(L.data(), R.data(), 512, 16.0, true, 220);
        const double a = h.beatNow();
        h.process(L.data(), R.data(), 512, 3.0, true, 220); // l'hote boucle
        const double b = h.beatNow();
        h.process(L.data(), R.data(), 512, 0.0, false, 220); // l'hote s'arrete
        const double c = h.beatNow();
        const double step = 512 * 2.0 / 48000;
        check(std::fabs(a - (16 + step)) < 1e-9 && std::fabs(b - (3 + step)) < 1e-9 && std::fabs(c - (3 + 2 * step)) < 1e-9,
              "l'horloge suit la position de l'hote (saut de boucle compris) et continue seule a l'arret");
    }

    // la stabilite : tous les cercles au maximum, la reinjection a 1, ALL, 20 s ; et aux reglages extremes de chaque cran
    {
        bool ok = true;
        double pk = 0;
        Input longIn = makeArp(SR);
        longIn.x.resize(static_cast<size_t>(20 * SR), 0.f);
        longIn.note.resize(static_cast<size_t>(20 * SR), midiHz(66));
        for (int variant = 0; variant < 6; ++variant) {
            Vals p = bank[15];
            for (int k = Hell2::kWarp; k < Hell2::kKeys; ++k) p.v[k] = Hell2::kKeySteps[k] > 1 ? (variant % 2 ? 1.0 : 0.0) : 1.0;
            p.v[Hell2::kFb] = 1;
            p.v[Hell2::kDescent] = 1;
            p.v[Hell2::kWarpShape] = (variant % 5) / 4.0; // les cinq formes
            p.v[Hell2::kChopPitch] = variant % 2 ? 1 : 0;
            const Out o = render(p, longIn, 1);
            ok = ok && finiteOf(o);
            pk = std::max(pk, peakOf(o));
        }
        check(ok && pk <= CEIL + 1e-6, "reglages extremes (tout au maximum, FEEDBACK 1, ALL, les cinq formes de WARP, 20 s) : fini, crete " + std::to_string(db(pk)).substr(0, 6) + " dBFS");
    }

    // 44.1 et 96 kHz, et un autre tempo
    {
        bool ok = true;
        double pk = 0;
        for (double sr : {44100.0, 96000.0}) {
            const Input in = makeArp(sr, 97);
            for (int pi : {1, 6, 9, 15}) {
                Run r;
                r.sr = sr;
                r.bpm = 97;
                const Out o = render(bank[static_cast<size_t>(pi)], in, 0.75, r);
                ok = ok && finiteOf(o);
                pk = std::max(pk, peakOf(o));
            }
        }
        check(ok && pk <= CEIL + 1e-6, "44.1 et 96 kHz a 97 BPM (TAPE DEATH, ACID BATH, HELICOPTER, LSD) : fini, crete " + std::to_string(db(pk)).substr(0, 6) + " dBFS");
    }

    // le mode --render : les WAV a MIX 75 %, le sync et les differences entre presets
    if (!wavDir.empty()) {
        std::vector<std::vector<double>> F;
        std::vector<double> syncs;
        // l'ancienne banque d'abord (a MIX 50 %, la ou elle sonnait), pour la normalisation commune
        const int NO = static_cast<int>(sizeof(kHellPresets) / sizeof(kHellPresets[0]));
        std::vector<std::vector<double>> FO;
        std::vector<double> syncO;
        double oldPk = 0;
        int oldOver = 0;
        for (int i = 0; i < NO; ++i) {
            const Out o = renderOld(kHellPresets[i], arp, 0.5), d = renderOld(kHellPresets[i], drone, 0.5);
            double sy = 0;
            FO.push_back(features(o, d, SR, sy));
            syncO.push_back(sy);
            const double pk = peakOf(o);
            oldPk = std::max(oldPk, pk);
            oldOver += pk > 1 ? 1 : 0;
        }
        for (int i = 0; i < NP; ++i) {
            const Out o = render(bank[static_cast<size_t>(i)], arp, 0.75);
            const Out d = render(bank[static_cast<size_t>(i)], drone, 0.75);
            double s = 0;
            F.push_back(features(o, d, SR, s));
            syncs.push_back(s);
            std::string fn = kHell2Presets[i].name;
            for (auto& ch : fn)
                if (ch == ' ') ch = '-';
            char num[8];
            std::snprintf(num, sizeof num, "%02d", i + 1);
            writeWav(wavDir + "/HELL-V2-" + num + "-" + fn + ".wav", o, SR);
        }
        // un temoin hors tempo (un tremolo et un vibrato a 1.37 et 0.71 Hz sur le DRONE)
        {
            Out ref{drone.x, drone.x};
            for (size_t i = 0; i < ref.L.size(); ++i) {
                const double t = i / SR;
                const double g = std::pow(10.0, -0.3 * (1 + std::sin(2 * PI * 1.37 * t)));
                const double dd = 0.004 * SR * (1 + 0.5 * std::sin(2 * PI * 0.71 * t));
                const double si = static_cast<double>(i) - dd;
                const long k = static_cast<long>(std::floor(si));
                const double f = si - k;
                const double v = k >= 0 ? drone.x[static_cast<size_t>(k)] * (1 - f) + drone.x[static_cast<size_t>(k + 1)] * f : 0;
                ref.L[i] = ref.R[i] = static_cast<float>(v * g);
            }
            std::printf("\nSYNC (part du mouvement sur le tempo, DRONE, MIX 75 %%) ; temoin hors tempo %.2f\n", syncScore(ref, SR, 120, nullptr));
        }
        const size_t D = F[0].size();
        std::vector<double> mu(D, 0), sd(D, 0);
        std::vector<std::vector<double>> all = F;
        all.insert(all.end(), FO.begin(), FO.end());
        for (const auto& f : all)
            for (size_t k = 0; k < D; ++k) mu[k] += f[k] / all.size();
        for (const auto& f : all)
            for (size_t k = 0; k < D; ++k) sd[k] += std::pow(f[k] - mu[k], 2) / all.size();
        for (auto& s : sd) s = std::sqrt(s) + 1e-6;
        const auto distOf = [&](const std::vector<double>& a, const std::vector<double>& b) {
            double s = 0;
            for (size_t k = 0; k < D; ++k) s += std::pow((a[k] - b[k]) / sd[k], 2);
            return std::sqrt(s / D);
        };
        const auto dist = [&](size_t a, size_t b) { return distOf(F[a], F[b]); };
        {
            std::vector<double> nnO;
            for (size_t a = 0; a < FO.size(); ++a) {
                double best = 1e9;
                for (size_t b = 0; b < FO.size(); ++b)
                    if (b != a) best = std::min(best, distOf(FO[a], FO[b]));
                nnO.push_back(best);
            }
            std::sort(nnO.begin(), nnO.end());
            std::sort(syncO.begin(), syncO.end());
            std::printf("  L'ANCIENNE BANQUE (24, ancien moteur, MIX 50 %%) : distance au plus proche voisin minimum %.2f, mediane %.2f ; sync mediane %.2f ; crete %.1f dBFS, %d presets au-dessus de 0 dBFS\n",
                        nnO.front(), nnO[nnO.size() / 2], syncO[syncO.size() / 2], db(oldPk), oldOver);
        }
        std::vector<double> nn;
        for (size_t a = 0; a < F.size(); ++a) {
            double best = 1e9;
            size_t bi = a;
            for (size_t b = 0; b < F.size(); ++b)
                if (b != a && dist(a, b) < best) {
                    best = dist(a, b);
                    bi = b;
                }
            nn.push_back(best);
            std::printf("  %-18s sync %4.2f   plus proche : %-18s %5.2f\n", kHell2Presets[a].name, syncs[a], kHell2Presets[bi].name, best);
        }
        std::sort(nn.begin(), nn.end());
        std::sort(syncs.begin(), syncs.end());
        std::printf("  distance au plus proche voisin : minimum %.2f, mediane %.2f ; sync mediane %.2f\n", nn.front(), nn[nn.size() / 2], syncs[syncs.size() / 2]);
        std::printf("WAV ecrits dans %s\n", wavDir.c_str());
    }

    std::printf("\n%s\n", fails ? "ECHEC" : "HELL v2 : tout est bon");
    return fails ? 1 : 0;
}
