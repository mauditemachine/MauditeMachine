// MM-RYTM : les LFO du site (src/v4/audio/lfo.ts), a l'identique : deux par voix, cales sur le tempo (en pas), sept formes,
// cinq modes, FADE. Pur : tests/compare_lfo compare lfoValue au site.
#pragma once

#include <cmath>
#include <cstdint>
#include <limits>

namespace mm {

// Les destinations, les formes et les modes : les rangs du site (LFO_DESTS, LFO_WAVES, LFO_MODES)
enum LfoDest { LD_OFF, LD_PITCH, LD_FREQ, LD_RESO, LD_VOL, LD_PAN, LD_DIST, LD_DELAY, LD_REVERB, LD_TONE, LD_DECAY };
enum LfoWave { LW_TRI, LW_SINE, LW_SQR, LW_SAW, LW_EXP, LW_RMP, LW_RND };
enum LfoMode { LM_FRE, LM_TRG, LM_HLD, LM_ONE, LM_HLF };

struct Lfo {
    int n = 1;          // 1 ou 2 (le sel de RND)
    int spd = 32;       // -64 a 63
    int mult = 1;       // 1 a 128
    int fade = 0;       // -64 a 63
    int dest = LD_OFF;
    int wave = LW_TRI;
    double phase = 0;   // 0 a 127/128
    int mode = LM_FRE;
    double depth = 0;   // -1 a 63/64
};

inline double lfoCycle(const Lfo& l) {
    return l.spd == 0 ? std::numeric_limits<double>::infinity() : 128.0 / (std::abs(l.spd) * l.mult);
}

// hash01 du site (Math.imul et >>> 0 : l'arithmetique des uint32)
inline double lfoHash01(int32_t i, int32_t salt) {
    uint32_t h = (static_cast<uint32_t>(i) * 0x9e3779b1u) ^ (static_cast<uint32_t>(salt) * 0x85ebca77u);
    h = (h ^ (h >> 16)) * 0x7feb352du;
    h = (h ^ (h >> 15)) * 0x846ca68bu;
    return static_cast<double>(h ^ (h >> 16)) / 4294967296.0;
}

inline double lfoWaveAt(int w, double u, int salt) {
    const double f = u - std::floor(u);
    switch (w) {
        case LW_TRI: return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
        case LW_SINE: return std::sin(2 * 3.14159265358979323846 * f);
        case LW_SQR: return f < 0.5 ? 1 : -1;
        case LW_SAW: return 2 * f - 1;
        case LW_EXP: return (std::exp(4 * f) - 1) / (std::exp(4.0) - 1);
        case LW_RMP: return 1 - f;
        default: {
            // RND : une valeur par quart de cycle (Math.floor puis l'entier 32 bits de | 0)
            const double q = std::floor(u * 4);
            const int32_t qi = static_cast<int32_t>(static_cast<uint32_t>(static_cast<int64_t>(q)));
            return lfoHash01(qi, salt) * 2 - 1;
        }
    }
}

// La valeur d'un LFO a la position pos (en pas depuis PLAY), son ancre (le dernier trig qui l'a relance)
inline double lfoValue(const Lfo& l, double pos, double anchor) {
    const double cyc = lfoCycle(l);
    const double dir = l.spd < 0 ? -1 : 1;
    const double since = std::max(0.0, pos - anchor);
    double el;
    switch (l.mode) {
        case LM_FRE: el = pos; break;
        case LM_TRG: el = since; break;
        case LM_HLD: el = anchor; break;
        case LM_ONE: el = std::min(since, cyc * 0.999999); break;
        default: el = std::min(since, cyc * 0.499999);
    }
    const double u = l.phase + (std::isfinite(cyc) ? (dir * el) / cyc : 0);
    double v = lfoWaveAt(l.wave, u, l.n);
    if (l.fade != 0) {
        const double e = l.mode == LM_FRE ? pos : since;
        const double t = 64.0 / std::abs(l.fade);
        const double k = std::min(1.0, e / t);
        v *= l.fade < 0 ? k : 1 - k;
    }
    return v * l.depth;
}

} // namespace mm
