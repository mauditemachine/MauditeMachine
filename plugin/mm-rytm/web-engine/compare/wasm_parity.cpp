// Le moteur natif contre le moteur WebAssembly (2026-11-25) : la meme fonction parity_render, compilee deux fois (natif,
// wasm32-wasi reacteur), joue un programme (de la face, ou tire au hasard d'une graine) 3 s a 48 kHz : RUN, coups en
// direct, FILL, un programme neuf en jouant, STOP / RUN, notes MIDI ; en mode synchrone (le VST3) ou asynchrone (le
// navigateur : les sons livres par l'API du Worker, dans le meme module). Les sorties float32 se comparent ensuite
// (wasm_parity.mjs). La banque : les fichiers de public/samples/rytm, donnes par l'appelant (mmrytm_bank_add).
//   natif : c++ -O2 -std=c++17 -I dsp -I web-engine -I tests compare/wasm_parity.cpp web-engine/RytmEngine.cpp dsp/*.cpp
//   wasm  : voir wasm_parity.mjs (l'en-tete : la commande clang)
#include "RytmEngine.h"
#include "engine_web_programs.h"

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

using namespace mmrytmtest;

namespace {

std::vector<std::string> splitLines(const char* s, int n) {
    std::vector<std::string> out;
    std::string cur;
    for (int i = 0; i < n; ++i) {
        if (s[i] == '\n') {
            if (!cur.empty()) out.push_back(cur);
            cur.clear();
        } else
            cur += s[i];
    }
    if (!cur.empty()) out.push_back(cur);
    return out;
}

void deliver(MMRytmEngine* e, int id) {
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
    for (int v = 0; v < n; ++v) mmrytm_job_sound_variant(e, id, mmrytm_rendered_L(r, v), mmrytm_rendered_mono(r, v) ? nullptr : mmrytm_rendered_R(r, v), mmrytm_rendered_len(r, v));
    mmrytm_job_sound_end(e, id);
    mmrytm_rendered_free(r);
}

void idle(MMRytmEngine* e, bool async, double now) {
    mmrytm_idle(e, now);
    if (!async) return;
    bool any = false;
    for (int id; (id = mmrytm_job_take(e)) != 0;) {
        deliver(e, id);
        any = true;
    }
    if (any) mmrytm_idle(e, now);
}

} // namespace

// keys : les cles de la banque, une par ligne ; prog (prolen > 0) : un programme de la face, sinon celui de la graine.
// Ecrit L puis R par bloc de 128 ; rend le nombre de frames.
extern "C" int parity_render(int seed, int async, const char* keysText, int keysLen, const char* prog, int progLen, float* out, int maxFrames) {
    const std::vector<std::string> keys = splitLines(keysText, keysLen);
    const std::string p1 = progLen > 0 ? std::string(prog, static_cast<size_t>(progLen)) : randomProgram(static_cast<uint32_t>(seed), keys);
    const std::string p2 = randomProgram(static_cast<uint32_t>(seed) + 9000, keys);
    MMRytmEngine* e = mmrytm_create();
    mmrytm_set_async(e, async);
    mmrytm_prepare(e, 48000, 128);
    mmrytm_program(e, p1.data(), static_cast<int>(p1.size()));
    idle(e, async != 0, 0);
    mmrytm_run(e, 1);
    Rng r(static_cast<uint32_t>(seed) * 31 + 7);
    const int blocks = std::min(48000 * 3, maxFrames) / 128;
    for (int k = 0; k < blocks; ++k) {
        const double now = k * 128 / 48000.0;
        if (k % 53 == 11) {
            const std::string h = randomHit(r, keys, soundOfProgram(k < blocks / 2 ? p1 : p2, r.pick(16)));
            mmrytm_hit(e, h.data(), static_cast<int>(h.size()));
            idle(e, async != 0, now);
        }
        if (k == 200 || k == 260) mmrytm_fill(e, k == 200);
        if (k == blocks / 2) {
            mmrytm_program(e, p2.data(), static_cast<int>(p2.size()));
            idle(e, async != 0, now);
        }
        if (k == 700 || k == 760) mmrytm_run(e, k == 760);
        if (k % 97 == 5) mmrytm_midi(e, r.pick(128), 0x90, 35 + r.pick(23), r.pick(128));
        mmrytm_process(e, out + k * 256, out + k * 256 + 128, 128);
        if (k % 37 == 0) idle(e, async != 0, now);
    }
    mmrytm_destroy(e);
    return blocks * 128;
}

#ifndef __wasm__
#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iterator>

// natif : wasm_parity <dossier des samples> <sortie.raw> <graines> [programme.json ...] ; les cles en premier dans
// <sortie.raw>.keys (le runner wasm les reprend telles quelles)
int main(int argc, char** argv) {
    if (argc < 4) return 2;
    std::vector<std::string> keys;
    for (const auto& f : std::filesystem::recursive_directory_iterator(argv[1])) {
        if (!f.is_regular_file() || f.path().extension() != ".wav") continue;
        std::ifstream in(f.path(), std::ios::binary);
        const std::string data((std::istreambuf_iterator<char>(in)), {}), name = f.path().filename().string();
        if (mmrytm_bank_add(name.data(), static_cast<int>(name.size()), data.data(), static_cast<int>(data.size())))
            keys.push_back(f.path().parent_path().filename().string() + "/" + name);
    }
    std::sort(keys.begin(), keys.end());
    std::string keysText;
    for (const auto& k : keys) keysText += k + "\n";
    std::ofstream(std::string(argv[2]) + ".keys", std::ios::binary) << keysText;
    std::FILE* out = std::fopen(argv[2], "wb");
    if (!out) return 4;
    std::vector<float> buf(48000 * 3 * 2);
    const int seeds = std::atoi(argv[3]);
    std::vector<std::string> progs(static_cast<size_t>(seeds), std::string());
    for (int a = 4; a < argc; ++a) {
        std::ifstream in(argv[a], std::ios::binary);
        progs.emplace_back((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    }
    for (size_t i = 0; i < progs.size(); ++i)
        for (int async = 0; async < 2; ++async) {
            const int n = parity_render(static_cast<int>(i) + 1, async, keysText.data(), static_cast<int>(keysText.size()), progs[i].data(), static_cast<int>(progs[i].size()), buf.data(), 48000 * 3);
            std::fwrite(buf.data(), sizeof(float), static_cast<size_t>(n) * 2, out);
        }
    std::fclose(out);
    return 0;
}
#endif
