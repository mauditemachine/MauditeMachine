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
    else if (e == ex_xWidth) std::snprintf(out, static_cast<size_t>(max), "%d %%", static_cast<int>(std::lround(v * 200)));
    else std::snprintf(out, static_cast<size_t>(max), "%d %%", static_cast<int>(std::lround(v * 100)));
}

} // namespace mmx
