// Le moteur natif contre le moteur WebAssembly (2026-11-25) : la meme fonction parity_render, compilee deux fois (natif,
// wasm32-wasi reacteur), rend un preset d'usine (presets/factory.json, passe en memoire) ; les sorties float32 doivent
// etre identiques. Lance par plugin/mm-arp/web-engine/wasm_parity.sh.
#include "ArpEngine.h"
#include "../../tests/engine_web_preset.h"

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

using namespace mmarptest;

// Rend le preset idx du JSON (moteur xEngine eng), 4 mesures, RUN ; ecrit L puis R par bloc de 128 dans out (frames
// entrelaces par blocs) ; rend le nombre de frames, ou -1
extern "C" int parity_render(const char* json, int len, int idx, double eng, float* out, int maxFrames) {
    const std::string text(json, static_cast<size_t>(len));
    Reader rd(text);
    const J root = rd.value();
    const J* presets = root.get("presets");
    if (!rd.ok || !presets || idx < 0 || idx >= static_cast<int>(presets->a.size())) return -1;
    MMArpEngine* e = mmarp_create(808);
    mmarp_prepare(e, 48000, 128);
    const Face f = faceOf(presets->a[static_cast<size_t>(idx)], mmarp_params(e));
    loadPreset(e, f);
    mmarp_set_param(e, mmarp_param_index("xEngine"), eng);
    mmarp_run(e, 1);
    int total = static_cast<int>(48000.0 * 60.0 / f.bpm * 4.0 * 4.0) / 128 * 128;
    if (total > maxFrames) total = maxFrames / 128 * 128;
    for (int done = 0; done < total; done += 128) {
        mmarp_process(e, out + done * 2, out + done * 2 + 128, 128);
        if (done % (128 * 64) == 0) mmarp_idle(e);
    }
    mmarp_destroy(e);
    return total;
}

#ifndef __wasm__
int main(int argc, char** argv) {
    if (argc < 4) return 2;
    std::string text;
    if (std::FILE* fp = std::fopen(argv[1], "rb")) {
        char buf[65536];
        for (size_t n; (n = std::fread(buf, 1, sizeof(buf), fp)) > 0;) text.append(buf, n);
        std::fclose(fp);
    }
    std::FILE* out = std::fopen(argv[2], "wb");
    if (!out) return 4;
    std::vector<float> buf(48000 * 2 * 40);
    for (int a = 3; a < argc; ++a)
        for (double eng : {0.0, 1.0}) {
            const int n = parity_render(text.data(), static_cast<int>(text.size()), std::atoi(argv[a]), eng, buf.data(), 48000 * 40);
            if (n > 0) std::fwrite(buf.data(), sizeof(float), static_cast<size_t>(n) * 2, out);
        }
    std::fclose(out);
    return 0;
}
#endif
