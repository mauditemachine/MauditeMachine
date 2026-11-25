// Des programmes de la face (src/v4/plugin/bridge.ts compile, le JSON de mm_program) et des coups en direct (mm_hit),
// tires au hasard d'une graine : tout ce que le processeur lit (sons et leurs recettes, samples de la banque ou absents,
// STRETCH, hauteur, pistes mono / choke / gated / kick, tranches, coups avec DECAY, FLTR et son enveloppe, START, PAN,
// LEN, PROB, COND, uTIME, RTRG, lock trigs, verrous de tranche, LFO, effets globaux, SWING, pages). Pour les bancs du
// moteur du navigateur (engine_web_test.cpp, web-engine/compare) : les memes textes vont au VST3 et au moteur.
#pragma once

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

namespace mmrytmtest {

struct Rng {
    uint32_t s;
    explicit Rng(uint32_t seed) : s(seed * 2654435761u + 12345u) {}
    uint32_t next() {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        return s;
    }
    double uni() { return (next() >> 8) / 16777216.0; }
    double range(double a, double b) { return a + (b - a) * uni(); }
    int pick(int n) { return static_cast<int>(next() % static_cast<uint32_t>(n)); }
    bool chance(double p) { return uni() < p; }
};

// Un nombre comme JSON.stringify : un entier sans virgule, sinon 17 chiffres (le meme double a la relecture)
inline std::string jnum(double v) {
    char b[48];
    if (v == static_cast<double>(static_cast<long long>(v)) && v > -1e15 && v < 1e15) std::snprintf(b, sizeof b, "%lld", static_cast<long long>(v));
    else std::snprintf(b, sizeof b, "%.17g", v);
    return b;
}
// r6 du pont (Math.round(v * 1e6) / 1e6) : la plupart des valeurs du programme
inline double r6(double v) { return static_cast<double>(static_cast<long long>(v * 1e6 + (v >= 0 ? 0.5 : -0.5))) / 1e6; }

inline const char* const kShotIds[9] = {"BD", "SD", "CH", "CHopen", "OH", "CP", "TOM", "HT", "CY"};
inline const char* const kFams[8] = {"bd", "sd", "ch", "oh", "cp", "tom", "ht", "cy"};

// Un son (ProgSound) : sampleKeys, les cles de la banque ("bd/Bd 1.wav") ; parfois un sample absent (perso, synthetise)
inline std::string randomSound(Rng& r, int idIndex, const std::vector<std::string>& sampleKeys, bool forceSample = false) {
    const char* models[3] = {"909", "808", "mm"};
    std::string tw = "{\"model\":\"" + std::string(models[r.pick(3)]) + "\"";
    const char* knobs[10] = {"tune", "attack", "decay", "drive", "snappy", "sweep", "sdTune", "sdDecay", "sdTone", "syn"};
    for (int k = 0; k < 10; ++k) {
        if (k == 5) tw += std::string(",\"gate\":") + (r.chance(0.3) ? "true" : "false");
        double v = r.chance(0.4) ? 0.5 : r6(r.uni());
        if (k == 9) v = r.chance(0.3) ? 0 : r.chance(0.5) ? 1 : r6(r.range(0.2, 1));
        tw += ",\"" + std::string(knobs[k]) + "\":" + jnum(v);
    }
    if (forceSample || r.chance(0.55)) {
        std::string key;
        if (!sampleKeys.empty() && (forceSample || r.chance(0.8))) key = sampleKeys[static_cast<size_t>(r.pick(static_cast<int>(sampleKeys.size())))];
        else key = std::string(kFams[r.pick(8)]) + (r.chance(0.5) ? "/u:abc123" : "/Synth 3.wav");
        tw += ",\"sample\":\"" + key + "\",\"smp\":{\"lev\":" + jnum(r6(r.range(0.3, 1))) + ",\"st\":" + jnum(r.chance(0.5) ? 0 : r6(r.range(-12, 12))) +
              ",\"start\":" + jnum(r.chance(0.6) ? 0 : r6(r.range(0, 0.5))) + ",\"len\":" + jnum(r.chance(0.6) ? 1 : r6(r.range(0.2, 1))) +
              ",\"rev\":" + (r.chance(0.2) ? "true" : "false") + "}";
    }
    tw += "}";
    const double ts = r.chance(0.6) ? 1 : r6(r.range(0.7, 1.8));
    const double pf = r.chance(0.5) ? 1 : r6(std::pow(2.0, r.range(-1, 1)));
    return std::string("{\"id\":\"") + kShotIds[idIndex % 9] + "\",\"tw\":" + tw + ",\"ts\":" + jnum(ts) + ",\"pf\":" + jnum(pf) +
           ",\"variants\":" + (r.chance(0.8) ? "true" : "false") + "}";
}

inline std::string slice5(Rng& r, bool zero = false) {
    if (zero) return "[0,0,0,0,0]";
    return "[" + jnum(r.chance(0.5) ? 0 : r6(r.range(-1, 1))) + "," + jnum(r.chance(0.5) ? 0 : r6(r.uni())) + "," + jnum(r.chance(0.6) ? 0 : r6(r.uni())) + "," +
           jnum(r.chance(0.5) ? 0 : r6(r.uni())) + "," + jnum(r.chance(0.5) ? 0 : r6(r.uni())) + "]";
}

// Les champs du coup (hitOf du pont) : son, DECAY, ATK, HOLD, gain, PAN, START, et parfois FLTR
inline std::string hitCore(Rng& r, int g, double vel, int snd) {
    std::string h = "\"g\":" + std::to_string(g) + ",\"vel\":" + jnum(vel) + ",\"snd\":" + std::to_string(snd);
    h += ",\"tau\":" + jnum(r.chance(0.4) ? -1 : r6(0.012 * std::pow(60.0, r.uni())));
    h += ",\"atk\":" + jnum(r.chance(0.7) ? 0 : r6(r.range(0, 0.05)));
    h += ",\"hold\":" + jnum(r.chance(0.7) ? 0.004 : r6(r.range(0, 0.2)));
    h += ",\"gain\":" + jnum(r.chance(0.5) ? 1 : r6(r.range(0.1, 1.6)));
    h += ",\"pan\":" + jnum(r.chance(0.5) ? 0 : r6(r.range(-1, 1)));
    h += ",\"start\":" + jnum(r.chance(0.7) ? 0 : r6(r.range(0, 0.5)));
    if (r.chance(0.3)) {
        h += ",\"ft\":" + std::to_string(1 + r.pick(3)) + ",\"fhz\":" + jnum(r6(20 * std::pow(1000.0, r.uni()))) + ",\"fq\":" + jnum(r6(r.range(0.5, 12))) +
             ",\"foct\":" + jnum(r.chance(0.5) ? 0 : r6(r.range(-3, 5))) + ",\"fatk\":" + jnum(r.chance(0.5) ? 0 : r6(r.range(0, 0.05))) +
             ",\"ftau\":" + jnum(r6(r.range(0.01, 0.5)));
    }
    return h;
}

inline std::string lfoArr(Rng& r) {
    // [n, spd, mult, fade, dest, wave, phase, mode, depth]
    const int dest = 1 + r.pick(10);
    return "[" + std::to_string(1 + r.pick(2)) + "," + std::to_string(r.pick(128) - 64) + "," + std::to_string(1 << r.pick(5)) + "," +
           std::to_string(r.chance(0.6) ? 0 : r.pick(128) - 64) + "," + std::to_string(dest) + "," + std::to_string(r.pick(7)) + "," + jnum(r.pick(128) / 128.0) +
           "," + std::to_string(r.pick(5)) + "," + jnum((r.pick(128) - 64) / 64.0) + "]";
}

// Un programme complet (Program du pont), 16 pistes
inline std::string randomProgram(uint32_t seed, const std::vector<std::string>& sampleKeys) {
    Rng r(seed);
    const int lens[5] = {16, 16, 32, 64, 128};
    const int len = lens[r.pick(5)];
    const int loop = r.chance(0.7) ? -1 : r.pick(4);
    std::string sounds, tracks;
    const int nSounds = 16 + r.pick(6);
    for (int i = 0; i < nSounds; ++i) sounds += (i ? "," : "") + randomSound(r, i < 16 ? (i < 8 ? i + (i >= 3 ? 1 : 0) : r.pick(9)) : r.pick(9), sampleKeys, i == 0);
    for (int t = 0; t < 16; ++t) {
        const int snd = t < nSounds ? t : r.pick(nSounds);
        std::string hits;
        const double density = r.range(0.05, 0.5);
        int nh = 0;
        for (int g = 0; g < len; ++g) {
            if (!r.chance(density)) continue;
            const bool lt = r.chance(0.08);
            const double vels[3] = {1, 0.6, 0.32};
            std::string h = "{" + hitCore(r, g, lt ? 0 : vels[r.pick(3)], r.chance(0.85) ? snd : r.pick(nSounds));
            const bool locked = lt || r.chance(0.2);
            if (locked) h += ",\"sl\":" + slice5(r);
            h += ",\"len\":" + jnum(r.chance(0.7) ? -1 : r.pick(4) == 0 ? 0.125 : 1 + r.pick(8));
            h += ",\"prob\":" + std::to_string(r.chance(0.7) ? 100 : r.pick(101));
            const int ck = r.chance(0.7) ? 0 : 1 + r.pick(6);
            h += ",\"ck\":" + std::to_string(ck) + ",\"cn\":" + std::to_string(ck && r.chance(0.3) ? 1 : 0);
            const int cb = ck == 6 ? 2 + r.pick(7) : 0;
            h += ",\"ca\":" + std::to_string(cb ? 1 + r.pick(cb) : 0) + ",\"cb\":" + std::to_string(cb);
            h += ",\"shift\":" + jnum(r.chance(0.7) ? 0 : r6((r.pick(47) - 23) / 24.0));
            const bool rt = r.chance(0.12);
            h += ",\"rtrg\":" + std::to_string(rt ? 1 : 0) + ",\"every\":" + jnum(rt ? 1.0 / (1 << r.pick(4)) : 1);
            h += ",\"vfad\":" + std::to_string(rt ? r.pick(128) - 64 : 0) + ",\"rlen\":" + jnum(rt ? (r.chance(0.3) ? -1 : 1 + r.pick(3)) : 1);
            if (lt) h += ",\"lt\":1";
            h += ",\"lfot\":" + std::to_string(r.chance(0.8) ? 1 : 0);
            const bool lfo = r.chance(0.2);
            if (lfo) {
                h += ",\"lfo\":[" + lfoArr(r);
                if (r.chance(0.4)) h += "," + lfoArr(r);
                h += "]";
            }
            if (lfo || lt || r.chance(0.1)) h += ",\"lb\":[" + jnum(r6(r.range(0.2, 1))) + "," + jnum(r6(r.uni())) + "," + jnum(r6(r.uni())) + "]";
            if (r.chance(0.1)) h += ",\"fp\":1";
            if (lt) {
                const int lk = r.pick(16);
                h += ",\"lk\":" + std::to_string(lk);
                if (lk & 8) h += ",\"lc\":" + jnum(r6(20 * std::pow(1000.0, r.uni())));
            }
            h += "}";
            hits += (nh++ ? "," : "") + h;
        }
        const bool kick = t == 0 || (t >= 8 && r.chance(0.3));
        tracks += std::string(t ? "," : "") + "{\"key\":\"T" + std::to_string(t + 1) + "\",\"slice\":" + jnum(r.chance(0.5) ? 1 : r6(r.range(0.2, 1))) +
                  ",\"plays\":" + (r.chance(0.9) ? "true" : "false") + ",\"mono\":" + (t == 0 || r.chance(0.3) ? "true" : "false") +
                  ",\"choke\":" + std::to_string(t == 2 || t == 3 ? 1 : r.chance(0.1) ? 2 : 0) + ",\"gated\":" + (t == 3 ? "true" : "false") +
                  ",\"kick\":" + (kick ? "true" : "false") + ",\"sl\":" + slice5(r, r.chance(0.5)) + ",\"live\":{" + hitCore(r, -1, 1, snd) + "},\"hits\":[" + hits + "]}";
    }
    const char* fxk[25] = {"drive", "reverb", "delay", "chorus", "dtime", "dfb", "bits", "comp", "dtone", "rsize", "rtone", "rpre", "xtone",
                           "crate", "cdepth", "brate", "catk", "crel", "cthr", "cratio", "cknee", "cmake", "chpf", "tone", "level"};
    const double fxd[25] = {0, 0, 0, 0, 0.4, 0.666667, 0, 0, 0.638, 0.566, 0.442, 0.167, 1, 0.624, 0.5, 0, 0.742, 1, 0.45, 0.571, 0.5, 0, 0.5, 0, 0.8};
    std::string fx = "{\"swing\":0.3";
    for (int k = 0; k < 25; ++k) {
        double v = fxd[k];
        if (r.chance(0.5)) v = k == 23 ? r6(r.range(-1, 1)) : r6(r.uni());
        fx += ",\"" + std::string(fxk[k]) + "\":" + jnum(v);
    }
    fx += "}";
    return "{\"v\":1,\"bpm\":" + jnum(r.chance(0.5) ? 60 + r.pick(141) : r6(r.range(60, 200))) + ",\"len\":" + std::to_string(len) + ",\"loop\":" + std::to_string(loop) +
           ",\"swing\":" + jnum(r.chance(0.5) ? 0 : r6(r.range(0, 0.25))) + ",\"sounds\":[" + sounds + "],\"tracks\":[" + tracks + "],\"fx\":" + fx + "}";
}

// Un coup en direct (le message mm_hit du pont : liveHook) ; souvent le son du pad, parfois un son neuf (un apercu)
inline std::string randomHit(Rng& r, const std::vector<std::string>& sampleKeys, const std::string& padSound = "") {
    const int t = r.pick(16);
    const std::string sound = !padSound.empty() && r.chance(0.6) ? padSound : randomSound(r, r.pick(9), sampleKeys);
    std::string h = "{\"t\":" + std::to_string(t) + ",\"vel\":" + jnum(r.chance(0.5) ? 1 : r6(r.uni())) + ",\"slice\":" + jnum(r.chance(0.5) ? 1 : r.uni()) +
                    ",\"sound\":" + sound + ",\"tau\":" + jnum(r.chance(0.5) ? -1 : 0.012 * std::pow(60.0, r.uni())) + ",\"atk\":0,\"hold\":0.004,\"gain\":" +
                    jnum(r.range(0.2, 1.2)) + ",\"pan\":" + jnum(r.chance(0.5) ? 0 : r.range(-1, 1)) + ",\"start\":0";
    if (r.chance(0.3)) h += ",\"ft\":1,\"fhz\":" + jnum(r6(r.range(200, 8000))) + ",\"fq\":0.7071,\"foct\":2,\"fatk\":0.01,\"ftau\":0.1";
    h += ",\"sl\":" + slice5(r) + "}";
    return h;
}

// Le son d'un programme genere (pour un coup en direct qui reprend un son deja calcule)
inline std::string soundOfProgram(const std::string& prog, int i) {
    const size_t a = prog.find("\"sounds\":[");
    if (a == std::string::npos) return "";
    size_t p = a + 10;
    for (int k = 0; k <= i; ++k) {
        if (prog[p] != '{') return "";
        int depth = 0;
        size_t q = p;
        for (; q < prog.size(); ++q) {
            if (prog[q] == '{') ++depth;
            else if (prog[q] == '}' && --depth == 0) break;
        }
        if (k == i) return prog.substr(p, q + 1 - p);
        p = q + 2;
    }
    return "";
}

} // namespace mmrytmtest
