// Le banc du moteur du navigateur : un preset de presets/factory.json pose comme le fait la face (bridge.ts factoryLoad ->
// applyDiskPreset -> mm_param, mm_program), par l'API C du moteur. Partage par tests/engine_web_test.cpp et
// web-engine/compare/compare_vst.cpp (la comparaison au VST3).
#pragma once

#include "ArpEngine.h"

#include <cmath>
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <map>
#include <string>
#include <vector>

namespace mmarptest {

/* ---- un lecteur JSON minimal (factory.json : objets, tableaux, nombres, textes, vrai / faux / null) ---- */

struct J {
    enum T { Null, Bool, Num, Str, Arr, Obj } t = Null;
    double n = 0;
    bool b = false;
    std::string s;
    std::vector<J> a;
    std::map<std::string, J> o;
    const J* get(const char* k) const {
        if (t != Obj) return nullptr;
        const auto it = o.find(k);
        return it == o.end() ? nullptr : &it->second;
    }
    bool isNum() const { return t == Num; }
};

struct Reader {
    const std::string& src;
    size_t i = 0;
    bool ok = true;
    explicit Reader(const std::string& s) : src(s) {}
    void ws() {
        while (i < src.size() && (src[i] == ' ' || src[i] == '\n' || src[i] == '\r' || src[i] == '\t')) ++i;
    }
    std::string str() {
        std::string out;
        ++i; // "
        while (i < src.size() && src[i] != '"') {
            if (src[i] == '\\' && i + 1 < src.size()) {
                const char c = src[++i];
                if (c == 'u') {
                    out += '?';
                    i += 4;
                } else
                    out += c == 'n' ? '\n' : c == 't' ? '\t' : c;
                ++i;
            } else
                out += src[i++];
        }
        ++i;
        return out;
    }
    J value() {
        ws();
        J v;
        if (i >= src.size()) {
            ok = false;
            return v;
        }
        const char c = src[i];
        if (c == '{') {
            v.t = J::Obj;
            ++i;
            ws();
            if (src[i] == '}') {
                ++i;
                return v;
            }
            while (ok) {
                ws();
                const std::string k = str();
                ws();
                ++i; // :
                v.o[k] = value();
                ws();
                if (src[i] == ',') ++i;
                else {
                    ++i; // }
                    break;
                }
            }
        } else if (c == '[') {
            v.t = J::Arr;
            ++i;
            ws();
            if (src[i] == ']') {
                ++i;
                return v;
            }
            while (ok) {
                v.a.push_back(value());
                ws();
                if (src[i] == ',') ++i;
                else {
                    ++i; // ]
                    break;
                }
            }
        } else if (c == '"') {
            v.t = J::Str;
            v.s = str();
        } else if (src.compare(i, 4, "true") == 0) {
            v.t = J::Bool;
            v.b = true;
            i += 4;
        } else if (src.compare(i, 5, "false") == 0) {
            v.t = J::Bool;
            i += 5;
        } else if (src.compare(i, 4, "null") == 0) {
            i += 4;
        } else {
            char* end = nullptr;
            v.n = std::strtod(src.c_str() + i, &end);
            if (end == src.c_str() + i) ok = false;
            v.t = J::Num;
            i = static_cast<size_t>(end - src.c_str());
        }
        return v;
    }
};

/* ---- un preset pose comme la face (bridge.ts factoryLoad -> applyDiskPreset -> mm_param, mm_program) ---- */

struct Face {
    // le programme tel que bridge.ts compile() l'enverrait (mm_program), deja lu
    double bpm = 120, swing = 0;
    int seqEdit = 0, seqLen = 8;
    int32_t seqBuf[16] = {};
    int32_t prog[8] = {};
    int nProg = 0;
    uint8_t lanes[80] = {};
    std::vector<float> knobs = std::vector<float>(mmarp::kKnobs), extras = std::vector<float>(mmx::kExtra);
};

inline bool instanceOnly(const char* id) {
    // factoryLoad : QUALITY, ENGINE, LATENCY et la tonalite (xKey, xScale) restent ceux de l'instance
    return !std::strcmp(id, "xQuality") || !std::strcmp(id, "xEngine") || !std::strcmp(id, "xLatency") || !std::strcmp(id, "xKey") || !std::strcmp(id, "xScale");
}

inline Face faceOf(const J& p, const float* current) {
    Face f;
    const J* knobs = p.get("knobs");
    for (int i = 0; i < mmarp::kKnobs; ++i) {
        const J* v = knobs ? knobs->get(mmarp::kKnobDefs[i].id) : nullptr;
        // voyParams.set : borne, sur son cran ou au millieme (knobClean)
        f.knobs[static_cast<size_t>(i)] = static_cast<float>(mmarp::knobClean(i, v && v->isNum() ? v->n : mmarp::kKnobDefs[i].def));
    }
    // applyExtra : ceux du preset ; les absents a leur depart (xSkyType : CLASSIC ; HELL d'avant v2 : l'ancien)
    const J* ex = p.get("extra");
    const J* hv2 = ex ? ex->get("xHellV2") : nullptr;
    const J* hmix = ex ? ex->get("xHellMix") : nullptr;
    const bool oldHell = !(hv2 && hv2->isNum()) && hmix && hmix->isNum() && hmix->n > 0;
    for (int e = 0; e < mmx::kExtra; ++e) {
        const char* id = mmx::kExtraDefs[e].id;
        float v = current[mmarp::kKnobs + e];
        if (!instanceOnly(id)) {
            const J* x = ex ? ex->get(id) : nullptr;
            if (x && x->isNum() && std::isfinite(x->n)) v = static_cast<float>(std::min(1.0, std::max(0.0, x->n)));
            else if (!std::strcmp(id, "xSkyType")) v = 0;
            else if (!std::strcmp(id, "xHellV2") && oldHell) v = 0;
            else v = static_cast<float>(mmx::kExtraDefs[e].def);
        }
        f.extras[static_cast<size_t>(e)] = v;
    }
    if (const J* b = p.get("bpm"); b && b->isNum()) f.bpm = b->n;
    if (const J* s = p.get("seq")) {
        const J* ed = s->get("edit");
        f.seqEdit = ed && ed->t == J::Bool && ed->b ? 1 : 0;
        const J* ln = s->get("len");
        f.seqLen = ln && ln->isNum() ? static_cast<int>(ln->n) : 8;
        const J* buf = s->get("buf");
        for (int i = 0; i < 16; ++i) {
            const J* d = buf && buf->t == J::Arr && i < static_cast<int>(buf->a.size()) ? &buf->a[static_cast<size_t>(i)] : nullptr;
            f.seqBuf[i] = d && d->isNum() ? static_cast<int32_t>(d->n) : d ? mmarp::kSeqRest : 0;
        }
    }
    // chords.ts arpProgOf : sans chordBank 2, les indices du site convertis (kSiteToArp)
    const J* cb = p.get("chordBank");
    const bool arpBank = cb && cb->isNum() && static_cast<int>(cb->n) == mmarp::kChordBank;
    if (const J* pr = p.get("prog"); pr && pr->t == J::Arr)
        for (const J& c : pr->a)
            if (c.isNum() && c.n >= 0 && c.n < 8 && f.nProg < 8) f.prog[f.nProg++] = arpBank ? static_cast<int>(c.n) : mmarp::chordFromSite(static_cast<int>(c.n));
    // les pistes (steps.ts) : celles du preset, sinon leurs departs
    const char* lane[5] = {"acc", "slide", "gate", "rat", "prob"};
    const uint8_t def[5] = {1, 0, 1, 1, 100};
    const J* st = p.get("steps");
    for (int l = 0; l < 5; ++l) {
        const J* a = st ? st->get(lane[l]) : nullptr;
        for (int i = 0; i < 16; ++i) {
            const J* v = a && a->t == J::Arr && i < static_cast<int>(a->a.size()) ? &a->a[static_cast<size_t>(i)] : nullptr;
            f.lanes[l * 16 + i] = v && v->isNum() ? static_cast<uint8_t>(v->n) : def[l];
        }
    }
    return f;
}

inline void sendProgram(MMArpEngine* e, const Face& f, int hasKnobs) {
    mmarp_set_program(e, f.bpm, f.swing, f.seqEdit, f.seqLen, f.seqBuf, f.prog, f.nProg, f.lanes, f.knobs.data(), f.extras.data(), hasKnobs);
}

// factoryLoad : chaque potard en mm_param, puis le programme
inline void loadPreset(MMArpEngine* e, const Face& f) {
    for (int i = 0; i < mmarp::kKnobs; ++i) mmarp_set_param(e, i, f.knobs[static_cast<size_t>(i)]);
    for (int x = 0; x < mmx::kExtra; ++x) mmarp_set_param(e, mmarp::kKnobs + x, f.extras[static_cast<size_t>(x)]);
    sendProgram(e, f, 1);
}

// presets/factory.json lu en entier (le tableau presets) ; false : illisible ou vide. stdio (pas de fstream : la libc++
// de WASI n'en a pas, le banc wasm_parity le compile aussi en WebAssembly)
inline bool readFactory(const char* path, J& root) {
    std::string text;
    if (std::FILE* fp = std::fopen(path, "rb")) {
        char buf[65536];
        for (size_t n; (n = std::fread(buf, 1, sizeof(buf), fp)) > 0;) text.append(buf, n);
        std::fclose(fp);
    }
    Reader rd(text);
    root = rd.value();
    const J* presets = root.get("presets");
    return rd.ok && presets && presets->t == J::Arr && !presets->a.empty();
}

} // namespace mmarptest
