// Le banc du moteur du navigateur (web-engine/RytmEngine.cpp), en natif, par son API C (celle du wasm) : la lecture du
// JSON (celle de juce::JSON), la banque des samples (public/samples/rytm), un programme de la face joue sur l'horloge
// interne (RUN, STOP, la tete de lecture), et surtout le mode asynchrone du navigateur (les sons calcules par un
// "Worker", ici la meme API appelee a cote) contre le mode synchrone du VST3 : la meme sortie AU BIT PRES. Les coups en
// direct, FILL, les notes MIDI, un transport d'hote, MASTER. Rien ne sort des enceintes : tout se lit dans les buffers.
//   cmake -S plugin/mm-rytm -B build -DMM_BUILD_PLUGIN=OFF && cmake --build build -j && ./build/mm_engine_web_test
#include "RytmEngine.h"
#include "engine_web_programs.h"

#ifndef MM_SAMPLES_DIR
#define MM_SAMPLES_DIR "public/samples/rytm"
#endif

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

using namespace mmrytmtest;

namespace {

int failures = 0;
void check(bool ok, const std::string& what) {
    std::printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
    if (!ok) ++failures;
}

// La banque : chaque .wav de public/samples/rytm/<famille>/, comme juce_add_binary_data ; les cles du site
std::vector<std::string> loadBank(int& files) {
    std::vector<std::string> keys;
    files = 0;
    std::error_code ec;
    for (const auto& f : std::filesystem::recursive_directory_iterator(MM_SAMPLES_DIR, ec)) {
        if (!f.is_regular_file() || f.path().extension() != ".wav") continue;
        std::ifstream in(f.path(), std::ios::binary);
        std::vector<char> b((std::istreambuf_iterator<char>(in)), {});
        const std::string name = f.path().filename().string();
        ++files;
        if (mmrytm_bank_add(name.data(), static_cast<int>(name.size()), b.data(), static_cast<int>(b.size())))
            keys.push_back(f.path().parent_path().filename().string() + "/" + name);
    }
    std::sort(keys.begin(), keys.end());
    return keys;
}

struct Eng {
    MMRytmEngine* e;
    bool async;
    // le "Worker" repond apres hold appels de service (0 : tout de suite)
    int hold = 0, waited = 0;
    explicit Eng(bool a, double sr = 48000) : e(mmrytm_create()), async(a) {
        mmrytm_set_async(e, a ? 1 : 0);
        mmrytm_prepare(e, sr, 128);
    }
    ~Eng() { mmrytm_destroy(e); }
    Eng(const Eng&) = delete;
    Eng& operator=(const Eng&) = delete;
    int program(const std::string& j) { return mmrytm_program(e, j.data(), static_cast<int>(j.size())); }
    void hit(const std::string& j) { mmrytm_hit(e, j.data(), static_cast<int>(j.size())); }
    // le calcul du Worker : la meme API, celle que rytmRender.worker.js appelle dans son instance
    void deliver(int id) {
        double d[mmrytmweb::kDescN];
        std::memcpy(d, mmrytm_job_desc(e, id), sizeof d);
        if (d[0] < 0) {
            void* ir = mmrytm_render_reverb(d[2], d[3], d[4], d[1]);
            mmrytm_job_reverb(e, id, mmrytm_reverb_parts(ir), mmrytm_reverb_H(ir, 0), mmrytm_reverb_H(ir, 1));
            mmrytm_reverb_free(ir);
            return;
        }
        const std::string smp = mmrytm_job_sample(e, id);
        void* r = mmrytm_render_sound(d, smp.data(), static_cast<int>(smp.size()));
        const int n = mmrytm_rendered_count(r);
        mmrytm_job_sound_begin(e, id, n);
        for (int v = 0; v < n; ++v)
            mmrytm_job_sound_variant(e, id, mmrytm_rendered_L(r, v), mmrytm_rendered_mono(r, v) ? nullptr : mmrytm_rendered_R(r, v), mmrytm_rendered_len(r, v));
        mmrytm_job_sound_end(e, id);
        mmrytm_rendered_free(r);
    }
    std::vector<int> queued;
    void idle(double now) {
        mmrytm_idle(e, now);
        if (!async) return;
        for (int id; (id = mmrytm_job_take(e)) != 0;) queued.push_back(id);
        if (queued.empty()) return;
        if (waited < hold) {
            ++waited;
            return;
        }
        waited = 0;
        for (int id : queued) deliver(id);
        queued.clear();
        mmrytm_idle(e, now);
    }
    const int32_t* fb() { return mmrytm_feedback(e); }
    const int32_t* stats() { return mmrytm_stats(e); }
};

struct Block {
    std::vector<float> L, R;
};
Block run(Eng& g, int n) {
    Block b{std::vector<float>(static_cast<size_t>(n)), std::vector<float>(static_cast<size_t>(n))};
    mmrytm_process(g.e, b.L.data(), b.R.data(), n);
    return b;
}
double peakOf(const Block& b) {
    double p = 0;
    for (size_t i = 0; i < b.L.size(); ++i) p = std::max(p, static_cast<double>(std::max(std::fabs(b.L[i]), std::fabs(b.R[i]))));
    return p;
}
bool finite(const Block& b) {
    for (size_t i = 0; i < b.L.size(); ++i)
        if (!std::isfinite(b.L[i]) || !std::isfinite(b.R[i])) return false;
    return true;
}

} // namespace

int main() {
    using mmrytmweb::Var;
    // 1. Le JSON de juce::JSON::parse : entiers int / int64, nombres a virgule, chaines, echappements, erreurs
    {
        Var v;
        const std::string j = R"({"a":1,"b":-2.5e-3,"c":"xé\"y","d":[true,false,null],"e":3000000000,"f":{"g":0.1},"a":7})";
        check(mmrytmweb::parseJson(j.data(), j.size(), v) && v.isObject(), "JSON : un objet");
        const Var* a = v.get("a");
        check(a && a->isInt() && a->i == 7 && v.o.size() == 6, "JSON : un nom repete remplace sa valeur (int)");
        check(v.get("b")->isDouble() && v.get("b")->d == -2.5e-3, "JSON : -2.5e-3 (double)");
        check(v.get("c")->isString() && v.get("c")->s == "x\xc3\xa9\"y", "JSON : \\u00e9 en UTF-8, \\\"");
        check(v.get("d")->getArray() && v.get("d")->a.size() == 3 && v.get("d")->a[2].type == Var::Void, "JSON : tableau, null");
        check(v.get("e")->isInt64() && v.get("e")->i == 3000000000LL, "JSON : un entier au-dela de 2^31 est int64");
        check(v.get("f")->get("g")->d == 0.1, "JSON : 0.1 relu au bit pres");
        Var bad;
        const std::string b = R"({"a":[1,],})";
        const std::string c = R"({"":1})";
        const std::string d = R"({"a":})";
        check(mmrytmweb::parseJson(b.data(), b.size(), bad) && bad.get("a")->a.size() == 1 && !mmrytmweb::parseJson(c.data(), c.size(), bad) &&
                  !mmrytmweb::parseJson(d.data(), d.size(), bad),
              "JSON : la virgule finale passe (comme JUCE), un nom vide ou une valeur manquante non");
        const std::string big = "{\"x\":0.123456789012345678901234,\"y\":1e400,\"z\":-1e-400}";
        check(mmrytmweb::parseJson(big.data(), big.size(), v) && v.get("x")->d == 0.12345678901234568 && std::isinf(v.get("y")->d) && v.get("z")->d == 0 && std::signbit(v.get("z")->d),
              "JSON : 18 chiffres significatifs (troncature de readDoubleValue), exposants hors bornes");
    }

    // 2. La banque
    int files = 0;
    const std::vector<std::string> keys = loadBank(files);
    check(files > 100 && mmrytm_bank_count() == files && static_cast<int>(keys.size()) == files, "banque : " + std::to_string(mmrytm_bank_count()) + " samples sur " + std::to_string(files) + " fichiers");
    check(mmrytm_bank_has("bd/Bd 1.wav", 11) && !mmrytm_bank_has("sd/Bd 1.wav", 11) && !mmrytm_bank_has("bd/u:abc", 8), "banque : byKey (famille et fichier)");

    // 3. Un programme, RUN sur l'horloge interne, la tete, STOP
    {
        Eng g(false);
        const std::string prog = randomProgram(1, keys);
        check(g.program(prog) == 1, "programme accepte (" + std::to_string(prog.size()) + " octets)");
        check(g.program("{\"v\":2}") == 0 && g.program("pas du json") == 0, "programme refuse : v != 1, texte invalide");
        g.idle(0);
        const int32_t* st = g.stats();
        check(st[1] == 1 && st[11] >= 16 && st[9] >= 16, "etat publie (sons " + std::to_string(st[11]) + ", pas " + std::to_string(st[9]) + ", coups " + std::to_string(st[12]) + ")");
        mmrytm_run(g.e, 1);
        double pk = 0;
        bool fin = true;
        int seq0 = -1, seqN = 0, steps = 0, lastStep = -2;
        for (int k = 0; k < 48000 * 4 / 128; ++k) {
            const Block b = run(g, 128);
            pk = std::max(pk, peakOf(b));
            fin = fin && finite(b);
            const int32_t* f = g.fb();
            if (seq0 < 0) seq0 = f[3];
            seqN = f[3];
            if (f[2] != lastStep) ++steps;
            lastStep = f[2];
            if (k % 37 == 0) g.idle(k * 128 / 48000.0);
        }
        const int32_t* f = g.fb();
        check(f[0] == 1 && f[1] == 1, "RUN : playing et internal");
        check(seqN - seq0 > 20 && steps > 20, "RUN : la tete avance (seq +" + std::to_string(seqN - seq0) + ")");
        check(pk > 0.01 && fin, "RUN : du son (crete " + std::to_string(pk) + "), fini");
        mmrytm_run(g.e, 0);
        run(g, 128);
        f = g.fb();
        check(f[0] == 0 && f[1] == 0 && f[2] == -1, "STOP : playing 0, step -1");
    }

    // 4. Le mode du navigateur (asynchrone, les sons livres par le Worker) contre celui du VST3 : au bit pres
    long mism = 0, total = 0, fbBad = 0;
    double maxDiff = 0;
    int seeds = 0;
    for (uint32_t seed = 2; seed <= 9; ++seed) {
        ++seeds;
        Eng a(false), b(true);
        Rng r(seed * 77);
        const std::string p1 = randomProgram(seed, keys), p2 = randomProgram(seed + 1000, keys);
        a.program(p1);
        b.program(p1);
        a.idle(0);
        b.idle(0);
        mmrytm_run(a.e, 1);
        mmrytm_run(b.e, 1);
        const int blocks = 48000 * 3 / 128;
        for (int k = 0; k < blocks; ++k) {
            const double now = k * 128 / 48000.0;
            // un coup en direct : le son d'un pad (tout de suite) ou un son neuf (apres son calcul)
            if (k % 53 == 11) {
                const std::string h = randomHit(r, keys, soundOfProgram(k < blocks / 2 ? p1 : p2, r.pick(16)));
                a.hit(h);
                b.hit(h);
                a.idle(now);
                b.idle(now);
            }
            if (k == 200 || k == 260) {
                mmrytm_fill(a.e, k == 200);
                mmrytm_fill(b.e, k == 200);
            }
            // un pas change sur la face : un programme neuf en jouant
            if (k == blocks / 2) {
                a.program(p2);
                b.program(p2);
                a.idle(now);
                b.idle(now);
            }
            if (k == 700 || k == 760) {
                mmrytm_run(a.e, k == 760);
                mmrytm_run(b.e, k == 760);
            }
            if (k % 97 == 5) {
                const int note = 35 + r.pick(23), vel = r.pick(128), at = r.pick(128);
                mmrytm_midi(a.e, at, 0x90, note, vel);
                mmrytm_midi(b.e, at, 0x90, note, vel);
                if (k % 3 == 0) {
                    mmrytm_midi(a.e, 100, 0xb0, 123, 0);
                    mmrytm_midi(b.e, 100, 0xb0, 123, 0);
                }
            }
            const Block x = run(a, 128), y = run(b, 128);
            for (int i = 0; i < 128; ++i) {
                ++total;
                if (std::memcmp(&x.L[static_cast<size_t>(i)], &y.L[static_cast<size_t>(i)], 4) != 0 || std::memcmp(&x.R[static_cast<size_t>(i)], &y.R[static_cast<size_t>(i)], 4) != 0) {
                    ++mism;
                    maxDiff = std::max(maxDiff, static_cast<double>(std::max(std::fabs(x.L[static_cast<size_t>(i)] - y.L[static_cast<size_t>(i)]), std::fabs(x.R[static_cast<size_t>(i)] - y.R[static_cast<size_t>(i)]))));
                }
            }
            if (std::memcmp(a.fb(), b.fb(), 5 * sizeof(int32_t)) != 0) ++fbBad;
            if (k % 37 == 0) {
                a.idle(now);
                b.idle(now);
            }
        }
    }
    (void)maxDiff;
    check(mism == 0 && fbBad == 0, "navigateur (asynchrone) = VST3 (synchrone) : " + std::to_string(seeds) + " programmes + coups + FILL + programme neuf + STOP/RUN + MIDI, " +
                                       std::to_string(total) + " echantillons, " + std::to_string(mism) + " differents, tete " + std::to_string(fbBad));

    // 5. Le Worker en retard : l'ancien etat joue, le programme neuf part a la livraison
    {
        Eng g(true);
        g.program(randomProgram(31, keys));
        g.idle(0);
        mmrytm_run(g.e, 1);
        for (int k = 0; k < 40; ++k) run(g, 128);
        const int pub0 = g.stats()[1];
        g.hold = 3;
        g.program(randomProgram(32, keys));
        g.idle(0.1);
        const int pubWait = g.stats()[1];
        double pk = 0;
        for (int k = 0; k < 20; ++k) pk = std::max(pk, peakOf(run(g, 128)));
        g.idle(0.2);
        g.idle(0.3);
        const int pubStill = g.stats()[1];
        g.idle(0.4);
        const int pubAfter = g.stats()[1];
        check(pub0 == 1 && pubWait == 1 && pubStill == 1 && pubAfter == 2 && pk > 0.001 && mmrytm_pending(g.e) == 0,
              "Worker en retard : l'ancien etat joue (crete " + std::to_string(pk) + "), le neuf publie a la livraison");
    }

    // 6. Un coup en direct d'un son neuf (un apercu) : calcule, puis il part ; le son du pad part tout de suite
    {
        Eng g(true);
        const std::string p = randomProgram(41, keys);
        g.program(p);
        g.idle(0);
        // un son que le programme n'a pas : un BD 808 accorde autrement
        g.hit("{\"t\":0,\"vel\":1,\"slice\":1,\"sound\":{\"id\":\"BD\",\"tw\":{\"model\":\"808\",\"tune\":0.4321},\"ts\":1,\"pf\":1,\"variants\":true},"
              "\"tau\":-1,\"atk\":0,\"hold\":0.004,\"gain\":1,\"pan\":0,\"start\":0,\"sl\":[0,0,0,0,0]}");
        const int later0 = g.stats()[3];
        const bool waits = mmrytm_pending(g.e) == 1;
        g.idle(0.1);
        const int later1 = g.stats()[3];
        double pk = 0;
        for (int k = 0; k < 20; ++k) pk = std::max(pk, peakOf(run(g, 128)));
        const std::string pad = "{\"t\":0,\"vel\":1,\"slice\":1,\"sound\":" + soundOfProgram(p, 0) + ",\"tau\":-1,\"atk\":0,\"hold\":0.004,\"gain\":1,\"pan\":0,\"start\":0,\"sl\":[0,0,0,0,0]}";
        g.hit(pad);
        const int now1 = g.stats()[2];
        check(waits && later0 == 0 && later1 == 1 && now1 == 1 && pk > 0.001, "coups en direct : un son neuf attend son calcul, le son du pad part tout de suite (crete " + std::to_string(pk) + ")");
    }

    // 7. Les notes MIDI (GM), All Notes Off ; un transport d'hote reprend la main sur RUN ; MASTER
    {
        Eng g(false);
        g.program(randomProgram(51, keys));
        g.idle(0);
        mmrytm_midi(g.e, 5, 0x90, 36, 100);
        mmrytm_midi(g.e, 6, 0x90, 60, 100); // hors GM : ignoree
        mmrytm_midi(g.e, 7, 0x90, 38, 0);   // velocite 0 : un NOTE OFF
        double pk = 0;
        for (int k = 0; k < 20; ++k) pk = std::max(pk, peakOf(run(g, 128)));
        check(g.stats()[7] == 1 && pk > 0.001, "MIDI : la note 36 joue le pad du BD (crete " + std::to_string(pk) + "), 60 et la velocite 0 rien");
        mmrytm_run(g.e, 1);
        run(g, 128);
        const bool internal = g.fb()[1] == 1;
        mmrytm_set_host_position(g.e, 1, 8.0, 120);
        run(g, 128);
        const int32_t* f = g.fb();
        const bool host = f[0] == 1 && f[1] == 0;
        run(g, 128); // l'hote s'arrete : RUN s'est eteint
        f = g.fb();
        check(internal && host && f[0] == 0, "transport : RUN interne, puis l'hote prend la main et RUN s'eteint");
        mmrytm_set_master_db(g.e, -60);
        mmrytm_run(g.e, 1);
        double pk2 = 0;
        for (int k = 0; k < 200; ++k) pk2 = std::max(pk2, peakOf(run(g, 128)));
        check(pk2 == 0, "MASTER a -60 dB : le silence");
    }

    std::printf("%s (%d)\n", failures ? "ECHEC" : "tout est bon", failures);
    return failures ? 1 : 0;
}
