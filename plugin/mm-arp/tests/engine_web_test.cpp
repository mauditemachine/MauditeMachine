// Le banc du moteur du navigateur (web-engine/ArpEngine.cpp), en natif, par son API C (celle du wasm) : le premier preset
// de presets/factory.json pose comme le fait la face (bridge.ts factoryLoad / applyDiskPreset), RUN sur l'horloge
// interne, 4 mesures rendues par blocs de 128 a 48 kHz. Rien ne sort des enceintes : tout se verifie dans les buffers.
//   cmake -S plugin/mm-arp -B build -DMM_BUILD_PLUGIN=OFF && cmake --build build -j && ./build/mmarp_engine_test [factory.json]
#include "ArpEngine.h"
#include "engine_web_preset.h"

#ifndef MMARP_FACTORY_JSON
#define MMARP_FACTORY_JSON "plugin/mm-arp/presets/factory.json"
#endif

#include <cmath>
#include <cstddef>
#include <cstdio>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

namespace {

using namespace mmarptest;

int failures = 0;
void check(bool ok, const std::string& what) {
    std::printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
    if (!ok) ++failures;
}

struct Render {
    std::vector<float> L, R;
    double peak = 0, rms = 0;
    bool finite = true;
    int seqStart = 0, seqEnd = 0, posChanges = 0, notesShown = 0;
    double ppqEnd = -1, bpm = 0;
    double cpuTotal = 0;
    int os = 0, voices = 0;
};

const double* tele(MMArpEngine* e) { return mmarp_telemetry(e); }
// les indices du Telemetry (ArpEngine.h)
enum { T_PLAYING = 0, T_SEQ = 2, T_POS = 4, T_PPQ = 10, T_BPM = 11 };
const int T_CPU_TOTAL = static_cast<int>(offsetof(mmarpweb::Telemetry, cpu) / sizeof(double)) + mmarpweb::ArpEngine::kCpuTotal;
const int T_OS = static_cast<int>(offsetof(mmarpweb::Telemetry, os) / sizeof(double));
const int T_VOICES = static_cast<int>(offsetof(mmarpweb::Telemetry, voices) / sizeof(double));

Render render(MMArpEngine* e, int samples, int block) {
    Render r;
    std::vector<float> l(static_cast<size_t>(block)), rr(static_cast<size_t>(block));
    double sum = 0;
    r.seqStart = static_cast<int>(tele(e)[T_SEQ]);
    int lastPos = -1;
    for (int done = 0; done < samples; done += block) {
        const int m = std::min(block, samples - done);
        mmarp_process(e, l.data(), rr.data(), m);
        for (int i = 0; i < m; ++i) {
            const float a = l[static_cast<size_t>(i)], b = rr[static_cast<size_t>(i)];
            if (!std::isfinite(a) || !std::isfinite(b)) r.finite = false;
            r.peak = std::max(r.peak, static_cast<double>(std::max(std::fabs(a), std::fabs(b))));
            sum += static_cast<double>(a) * a + static_cast<double>(b) * b;
            r.L.push_back(a);
            r.R.push_back(b);
        }
        // le timer de l'editeur, ~30 fois par seconde ; idle (le timer de l'instance) ~15 fois
        if ((done / block) % 12 == 0) {
            const double* t = tele(e);
            const int pos = static_cast<int>(t[T_POS]);
            if (pos != lastPos) ++r.posChanges;
            lastPos = pos;
        }
        if ((done / block) % 25 == 0) mmarp_idle(e);
    }
    const double* t = tele(e);
    r.seqEnd = static_cast<int>(t[T_SEQ]);
    r.notesShown = r.seqEnd - r.seqStart;
    r.ppqEnd = t[T_PPQ];
    r.bpm = t[T_BPM];
    r.cpuTotal = t[T_CPU_TOTAL];
    r.os = static_cast<int>(t[T_OS]);
    r.voices = static_cast<int>(t[T_VOICES]);
    r.rms = std::sqrt(sum / std::max(1.0, 2.0 * static_cast<double>(r.L.size())));
    return r;
}

double db(double x) { return 20 * std::log10(std::max(x, 1e-12)); }

int barsSamples(double bpm, int bars) { return static_cast<int>(std::ceil(bars * 4 * 60.0 / bpm * 48000.0)); }

struct Engine {
    MMArpEngine* e;
    explicit Engine(uint32_t seed) : e(mmarp_create(seed)) {}
    ~Engine() { mmarp_destroy(e); }
};

// Un rendu complet : un moteur neuf, le preset, des reglages en plus (indice, valeur), RUN, n mesures
Render play(const J& preset, const std::vector<std::pair<const char*, double>>& extra, int bars = 4, int block = 128) {
    Engine en(808);
    mmarp_prepare(en.e, 48000, block);
    const Face f = faceOf(preset, mmarp_params(en.e));
    loadPreset(en.e, f);
    for (const auto& kv : extra) mmarp_set_param(en.e, mmarp_param_index(kv.first), kv.second);
    mmarp_run(en.e, 1);
    return render(en.e, barsSamples(f.bpm, bars), block);
}

bool same(const Render& a, const Render& b) {
    return a.L.size() == b.L.size() && std::memcmp(a.L.data(), b.L.data(), a.L.size() * sizeof(float)) == 0 &&
           std::memcmp(a.R.data(), b.R.data(), a.R.size() * sizeof(float)) == 0;
}

std::string fmt(const char* f, double a, double b = 0, double c = 0) {
    char buf[256];
    std::snprintf(buf, sizeof(buf), f, a, b, c);
    return buf;
}

} // namespace

int main(int argc, char** argv) {
    const char* path = argc > 1 ? argv[1] : MMARP_FACTORY_JSON;
    J root;
    const bool read = readFactory(path, root);
    check(read, std::string("factory.json lu : ") + path);
    if (!read) return 1;
    const J* presets = root.get("presets");
    const J& p0 = presets->a[0];
    const J* name = p0.get("name");
    std::printf("preset : %s\n", name ? name->s.c_str() : "?");

    // L'API : les parametres et leurs ids
    check(mmarp_param_count() == 359, "359 parametres (62 potards + 297 reglages)");
    check(mmarp_param_index("cutoff") == mmarp::kn_cutoff && mmarp_param_index("xScale") == 358 && mmarp_param_index("nope") == -1, "ids et indices");
    check(std::strcmp(mmarp_param_id(62), "xQuality") == 0 && mmarp_param_default(62) == 0.5, "xQuality en 62, defaut STD");
    check(mmarp_telemetry_size() == mmarpweb::kTelemetryN, "taille de la telemetrie");

    // 1. Le preset, 4 mesures : fini, non muet, la tete avance
    const Render a = play(p0, {});
    check(a.finite, "4 mesures : echantillons finis");
    check(a.peak > 1e-3, fmt("4 mesures : non muet (crete %.1f dBFS, RMS %.1f dBFS)", db(a.peak), db(a.rms)));
    check(a.notesShown >= 8, fmt("la tete avance : %g notes montrees (seq), %g positions vues", a.notesShown, a.posChanges));
    check(a.ppqEnd > 15.5 && a.ppqEnd < 16.5, fmt("ppq de l'horloge interne a la fin : %.3f (16 attendu)", a.ppqEnd));
    check(std::fabs(a.bpm - 122) < 1e-9, fmt("tempo du programme : %g", a.bpm));
    // la position dans la suite avance aussi (le premier preset a une suite plus longue qu'un pas)
    for (const J& pr : presets->a) {
        Engine probe(0);
        if (faceOf(pr, mmarp_params(probe.e)).seqLen < 4) continue;
        const Render r = play(pr, {}, 2);
        const J* nm = pr.get("name");
        check(r.finite && r.posChanges >= 3, std::string("la position avance (") + (nm ? nm->s : "?") + fmt(") : %g positions vues sur 2 mesures", r.posChanges));
        break;
    }

    // 2. Deterministe : deux moteurs neufs, les memes buffers au bit pres
    const Render b = play(p0, {});
    check(same(a, b), "deterministe : deux moteurs neufs identiques au bit pres");

    // 3. ENGINE CLASSIC et PRO, deux QUALITY (ECO, HQ)
    const Render classic = play(p0, {{"xEngine", 0}});
    const Render pro = play(p0, {{"xEngine", 1}});
    const Render eco = play(p0, {{"xQuality", 0}});
    const Render hq = play(p0, {{"xQuality", 1}});
    for (const auto& [n, r] : std::vector<std::pair<const char*, const Render*>>{{"CLASSIC", &classic}, {"PRO", &pro}, {"ECO", &eco}, {"HQ", &hq}})
        check(r->finite && r->peak > 1e-3, std::string(n) + fmt(" : fini, non muet (crete %.1f dBFS, os x%g, voix %g)", db(r->peak), r->os, r->voices));
    check(!same(classic, pro), "CLASSIC et PRO different");
    check(!same(eco, hq), "ECO et HQ different");
    check(classic.os == 4 && pro.os == 2 && eco.os == 1 && hq.os == 4, fmt("surechantillonnage : CLASSIC x%g, PRO x%g, ECO (PRO) x%g", classic.os, pro.os, eco.os));

    // 4. Les blocs de l'hote : 441 au lieu de 128, le meme son (le moteur rend par morceaux de 128 au plus)
    const Render odd = play(p0, {}, 1, 441);
    check(odd.finite && odd.peak > 1e-3, "blocs de 441 : fini, non muet");

    // 5. La regle knobsKnown (faceProgram) : une instance neuve prend les potards du programme, une seule fois
    {
        Engine en(1);
        mmarp_prepare(en.e, 48000, 128);
        check(!mmarp_knobs_known(en.e), "instance neuve : potards inconnus");
        Face f = faceOf(p0, mmarp_params(en.e));
        sendProgram(en.e, f, 1);
        bool eq = true;
        for (int i = 0; i < mmarp::kKnobs; ++i) eq = eq && mmarp_params(en.e)[i] == f.knobs[static_cast<size_t>(i)];
        for (int x = 0; x < mmx::kExtra; ++x) eq = eq && mmarp_params(en.e)[mmarp::kKnobs + x] == f.extras[static_cast<size_t>(x)];
        check(eq && mmarp_knobs_known(en.e), "le premier programme donne ses potards et reglages");
        Face g = f;
        g.knobs[mmarp::kn_cutoff] = 0.123f;
        sendProgram(en.e, g, 1);
        check(mmarp_params(en.e)[mmarp::kn_cutoff] == f.knobs[mmarp::kn_cutoff], "le suivant ne les reprend plus");
    }

    // 6. MIDI LEARN : CUTOFF arme, le CC 74 du canal 1 le prend
    {
        Engine en(2);
        mmarp_prepare(en.e, 48000, 128);
        mmarp_learn(en.e, mmarp::kn_cutoff);
        mmarp_midi(en.e, 5, 0xB0, 74, 127);
        std::vector<float> l(128), r(128);
        mmarp_process(en.e, l.data(), r.data(), 128);
        check(mmarp_ccmap(en.e)[74] == mmarp::kn_cutoff && mmarp_params(en.e)[mmarp::kn_cutoff] == 1.f && mmarp_take_map_changed(en.e), "MIDI LEARN : CC 74 -> CUTOFF, valeur 127 -> 1");
        mmarp_unmap(en.e, 0, 74);
        check(mmarp_ccmap(en.e)[74] == -1, "unmap");
    }

    // 7. Une note MIDI (MIDI IN NOTES, sans RUN) : le synthe joue
    {
        Engine en(3);
        mmarp_prepare(en.e, 48000, 128);
        loadPreset(en.e, faceOf(p0, mmarp_params(en.e)));
        mmarp_midi(en.e, 10, 0x90, 45, 100);
        const Render r = render(en.e, 48000 / 2, 128);
        const double* t = tele(en.e);
        check(r.finite && r.peak > 1e-3, fmt("note MIDI : le synthe joue (crete %.1f dBFS)", db(r.peak)));
        check(t[offsetof(mmarpweb::Telemetry, clipActive) / sizeof(double)] == 1, "le clip a le dessus (Clip Priority)");
    }

    // 8. L'arpege en clip MIDI : la progression, deux fois
    {
        Engine en(808);
        mmarp_prepare(en.e, 48000, 128);
        const Face f = faceOf(p0, mmarp_params(en.e));
        loadPreset(en.e, f);
        std::vector<float> notes(4 * 1024);
        int bars = 0;
        const int n = mmarp_render_clip(en.e, 2, notes.data(), 1024, &bars);
        check(bars == 2 * f.nProg && n > 0 && notes[0] >= 0 && notes[1] > notes[0] && notes[2] >= 1 && notes[2] <= 127, fmt("clip MIDI : %g notes sur %g mesures", n, bars));
    }

    // 9. La reverb recalculee par idle (SIZE bouge), le son reste fini
    {
        Engine en(808);
        mmarp_prepare(en.e, 48000, 128);
        loadPreset(en.e, faceOf(p0, mmarp_params(en.e)));
        mmarp_set_param(en.e, mmarp::kn_reverb, 0.6);
        mmarp_run(en.e, 1);
        render(en.e, 48000 / 4, 128);
        mmarp_set_param(en.e, mmarp_param_index("xRevSize"), 0.9);
        mmarp_idle(en.e);
        const Render r = render(en.e, 48000, 128);
        check(r.finite && r.peak > 1e-3, "reverb recalculee (idle) : fini, non muet");
    }

    std::printf("%s (%d echec%s)\n", failures ? "ECHEC" : "OK", failures, failures > 1 ? "s" : "");
    return failures ? 1 : 0;
}
