// MM-ARP, les reglages du VST3 seul (2026-11-10, Mika : "une qualite eblouissante, seulement le VST3") : QUALITY, la
// seconde destination du LFO 1, le LFO 2, la reverb, la section master. La liste vient de plugin/mm-arp/extra-params.json
// (tests/extra-gen.mjs -> ExtraTable.inc) ; la face les montre dans l'onglet SOUND+ du capot (src/v4/plugin/arp/extra.ts).
// Les potards du site gardent les indices 0 a kKnobs - 1, ceux-ci suivent : kKnobs + ExtraId.
#pragma once

#include "Params.h"

#include <cmath>
#include <cstdio>
#include <cstring>

namespace mmx {

struct ExtraDef {
    const char* id;
    const char* label;
    const char* section;
    double def;
    int nSteps;
    const char* const* steps;
};

#include "ExtraTable.inc"

constexpr int kExtra = ex_COUNT;
constexpr int kAll = mmarp::kKnobs + kExtra;

// Le cran d'une valeur 0..1 (comme stepIndex du site)
inline int exStep(int e, double v) {
    const int n = kExtraDefs[e].nSteps;
    if (n <= 1) return 0;
    const int i = static_cast<int>(std::lround(v * (n - 1)));
    return i < 0 ? 0 : i > n - 1 ? n - 1 : i;
}

// L'indice d'un parametre (potard du site ou reglage du VST3) par son id, -1 si inconnu
inline int allIndex(const char* id) {
    if (!id) return -1;
    const int k = mmarp::knobIndex(id);
    if (k >= 0) return k;
    for (int e = 0; e < kExtra; ++e)
        if (std::strcmp(kExtraDefs[e].id, id) == 0) return mmarp::kKnobs + e;
    return -1;
}
inline const char* allId(int i) { return i < mmarp::kKnobs ? mmarp::kKnobDefs[i].id : kExtraDefs[i - mmarp::kKnobs].id; }

// Les lois (extra-params.json, help)
inline double revSeconds(double v) { return 2.4 * std::pow(4.0, 2 * v - 1); }

// Le texte d'un reglage, comme dans la face
inline void exText(int e, double v, char* out, int max) {
    const ExtraDef& d = kExtraDefs[e];
    if (d.nSteps > 0) std::snprintf(out, static_cast<size_t>(max), "%s", d.steps[exStep(e, v)]);
    else if (e == ex_xRevSize) std::snprintf(out, static_cast<size_t>(max), "%.1f s", revSeconds(v));
    else if (e == ex_xRevPre) std::snprintf(out, static_cast<size_t>(max), "%d ms", static_cast<int>(std::lround(v * 100)));
    else if (e == ex_xBass || e == ex_xAir) std::snprintf(out, static_cast<size_t>(max), "%+.1f dB", (v - 0.5) * 12);
    else if (e == ex_xPhRate) std::snprintf(out, static_cast<size_t>(max), "%.2f Hz", 0.05 * std::pow(160.0, v));
    else if (e == ex_xFlRate) std::snprintf(out, static_cast<size_t>(max), "%.2f Hz", 0.03 * std::pow(5.0 / 0.03, v));
    else if (e == ex_xHpf) { if (v > 0) std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(20.0 * std::pow(100.0, v)))); else std::snprintf(out, static_cast<size_t>(max), "OFF"); }
    else if (e == ex_xCrushBits) { if (v > 0) std::snprintf(out, static_cast<size_t>(max), "%.1f bit", 16 - 12 * v); else std::snprintf(out, static_cast<size_t>(max), "OFF"); }
    else if (e == ex_xEqLow || e == ex_xEqMid || e == ex_xEqHigh) std::snprintf(out, static_cast<size_t>(max), "%+.1f dB", (v - 0.5) * 24);
    else if (e == ex_xEqAir) std::snprintf(out, static_cast<size_t>(max), "%+.1f dB", (v - 0.5) * 20);
    else if (e >= ex_xM1Src && e <= ex_xM6Amt && (e - ex_xM1Src) % 3 == 2) std::snprintf(out, static_cast<size_t>(max), "%+d %%", static_cast<int>(std::lround((2 * v - 1) * 100)));
    else if (e == ex_xNoiseColor || e == ex_xCombFb || e == ex_xFlFb) std::snprintf(out, static_cast<size_t>(max), "%+d %%", static_cast<int>(std::lround((2 * v - 1) * 100)));
    else if (e == ex_xHellMix) { if (v > 0) std::snprintf(out, static_cast<size_t>(max), "%d %%", static_cast<int>(std::lround(v * 100))); else std::snprintf(out, static_cast<size_t>(max), "OFF"); }
    else if (e == ex_xHellTime) std::snprintf(out, static_cast<size_t>(max), "%d ms", static_cast<int>(std::lround(5.0 * std::pow(400.0, v))));
    // le decalage : sa loi depend de RANGE (Hell::shiftHzFor) ; l'hote le montre en part de la course, de -100 a +100 %
    else if (e == ex_xHellShift || e == ex_xHellLfoAmt) std::snprintf(out, static_cast<size_t>(max), "%+d %%", static_cast<int>(std::lround((2 * v - 1) * 100)));
    else if (e == ex_xHellHp) { if (v > 0.001) std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(20.0 * std::pow(200.0, v)))); else std::snprintf(out, static_cast<size_t>(max), "OFF"); }
    else if (e == ex_xHellLp) { if (v < 0.999) std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(300.0 * std::pow(20000.0 / 300.0, v)))); else std::snprintf(out, static_cast<size_t>(max), "OFF"); }
    // DISTO (dsp/Decap.h)
    else if (e == ex_xDLow) { if (v >= 0.02) std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(20.0 * std::pow(50.0, (v - 0.02) / 0.98)))); else std::snprintf(out, static_cast<size_t>(max), "OFF"); }
    else if (e == ex_xDHigh) { if (v <= 0.98) std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(1000.0 * std::pow(20.0, v / 0.98)))); else std::snprintf(out, static_cast<size_t>(max), "OFF"); }
    else if (e == ex_xDTone) std::snprintf(out, static_cast<size_t>(max), "%+.1f dB", (v - 0.5) * 12);
    else if (e == ex_xDOut) std::snprintf(out, static_cast<size_t>(max), "%+.1f dB", -18 + 36 * v);
    // DISTO v25
    else if (e == ex_xDDyn || e == ex_xDEnvAmt || e == ex_xDLfoAmt) std::snprintf(out, static_cast<size_t>(max), "%+d %%", static_cast<int>(std::lround((2 * v - 1) * 100)));
    else if (e == ex_xDFbFreq || e == ex_xDXLo || e == ex_xDXHi || e == ex_xDPreFreq || e == ex_xDPostFreq) {
        const double hz = e == ex_xDFbFreq ? 40 * std::pow(30.0, v) : e == ex_xDXLo ? 40 * std::pow(25.0, v) : e == ex_xDXHi ? 600 * std::pow(25.0, v) : 20 * std::pow(1000.0, v);
        if (hz >= 1000) std::snprintf(out, static_cast<size_t>(max), "%.1f kHz", hz / 1000);
        else std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(hz)));
    }
    else if (e == ex_xDB1Drive || e == ex_xDB2Drive || e == ex_xDB3Drive) std::snprintf(out, static_cast<size_t>(max), "%+.1f dB", -18 + 36 * v);
    else if (e == ex_xDB1Level || e == ex_xDB2Level || e == ex_xDB3Level) std::snprintf(out, static_cast<size_t>(max), "%+.1f dB", -12 + 24 * v);
    else if (e == ex_xDEnvSpd) std::snprintf(out, static_cast<size_t>(max), "%d ms", static_cast<int>(std::lround(std::pow(30.0, v))));
    else if (e == ex_xDLfoRate) std::snprintf(out, static_cast<size_t>(max), "%.2f Hz", 0.02 * std::pow(500.0, v));
    else if (e == ex_xDPreReso || e == ex_xDPostReso) std::snprintf(out, static_cast<size_t>(max), "Q %.2f", 0.7071 * std::pow(16.0, v));
    else if (e == ex_xHellPhase) std::snprintf(out, static_cast<size_t>(max), "%d deg", static_cast<int>(std::lround(v * 360)));
    else if (e == ex_xHellLfoRate) std::snprintf(out, static_cast<size_t>(max), "%.2f Hz", 0.02 * std::pow(500.0, v));
    else if (e == ex_xHellLfoDepth) std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(400.0 * v * v)));
    else if (e == ex_xHellUpDown || e == ex_xHellTone) std::snprintf(out, static_cast<size_t>(max), "%+d %%", static_cast<int>(std::lround((2 * v - 1) * 100)));
    else if (e == ex_xWidth) std::snprintf(out, static_cast<size_t>(max), "%d %%", static_cast<int>(std::lround(v * 200)));
    // v27 : la page DELAY (dsp/Echo.h)
    else if (e == ex_xDlMs) {
        const double ms = 5 * std::pow(400.0, v);
        if (ms >= 1000) std::snprintf(out, static_cast<size_t>(max), "%.2f s", ms / 1000);
        else std::snprintf(out, static_cast<size_t>(max), "%d ms", static_cast<int>(std::lround(ms)));
    }
    else if (e == ex_xDlOffset) std::snprintf(out, static_cast<size_t>(max), "%+d %%", static_cast<int>(std::lround((v - 0.5) * 50)));
    else if (e == ex_xDlFeel) std::snprintf(out, static_cast<size_t>(max), "%+.1f %%", (v - 0.5) * 12);
    else if (e == ex_xDlLow || e == ex_xDlHigh) std::snprintf(out, static_cast<size_t>(max), "%+.1f oct", 3 * (2 * v - 1));
    else if (e == ex_xDlDuckRel) std::snprintf(out, static_cast<size_t>(max), "%d ms", static_cast<int>(std::lround(30 * std::pow(30.0, v))));
    // v27 : l'EQ parametrique (dsp/ParamEq.h)
    else if (e >= ex_xQ1On && e <= ex_xQ6Slope && (e - ex_xQ1On) % 6 == 2) {
        const double hz = 20 * std::pow(1000.0, v);
        if (hz >= 1000) std::snprintf(out, static_cast<size_t>(max), "%.2f kHz", hz / 1000);
        else std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(hz)));
    }
    else if (e >= ex_xQ1On && e <= ex_xQ6Slope && (e - ex_xQ1On) % 6 == 3) std::snprintf(out, static_cast<size_t>(max), "%+.1f dB", 36 * (v - 0.5));
    else if (e >= ex_xQ1On && e <= ex_xQ6Slope && (e - ex_xQ1On) % 6 == 4) std::snprintf(out, static_cast<size_t>(max), "Q %.2f", 0.3 * std::pow(60.0, v));
    else if (e == ex_xQOut) std::snprintf(out, static_cast<size_t>(max), "%+.1f dB", 24 * (v - 0.5));
    // v27 : le rack enrichi
    else if (e == ex_xPhCenter) std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(800 * std::pow(4.0, 2 * v - 1))));
    else if (e == ex_xPhSpread || e == ex_xFlSpread) std::snprintf(out, static_cast<size_t>(max), "%d deg", static_cast<int>(std::lround(180 * v)));
    else if (e == ex_xFlDelay) std::snprintf(out, static_cast<size_t>(max), "%.2f ms", 2.5 * std::pow(4.0, 2 * v - 1));
    else if (e == ex_xChRate) std::snprintf(out, static_cast<size_t>(max), "x%.2f", std::pow(4.0, 2 * v - 1));
    else if (e == ex_xChDepth) std::snprintf(out, static_cast<size_t>(max), "x%.2f", v <= 0.5 ? 2 * v : 1 + 1.2 * (v - 0.5));
    else if (e == ex_xCrTone) { if (v < 1) std::snprintf(out, static_cast<size_t>(max), "%d Hz", static_cast<int>(std::lround(1500 * std::pow(20000.0 / 1500, v)))); else std::snprintf(out, static_cast<size_t>(max), "OFF"); }
    else if (e == ex_xPuAttack) std::snprintf(out, static_cast<size_t>(max), "%.1f ms", 2 * std::pow(25.0, 2 * v - 1));
    else std::snprintf(out, static_cast<size_t>(max), "%d %%", static_cast<int>(std::lround(v * 100)));
}

} // namespace mmx
