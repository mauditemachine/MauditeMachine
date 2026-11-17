// La DISTO (dsp/Decap.h) en ligne de commande (2026-11-16) : pour la mesurer avec les memes signaux que le Decapitator
// (tests/decap-measure/measure.py). Lit du stereo entrelace en float32 sur l'entree standard jusqu'a la fin, ecrit le
// resultat au meme format sur la sortie standard, par blocs de 128. Aucun son ne sort.
//
//   mmarp_decap_cli [--sr 48000] [--style 0..4 (A E N T P)] [--drive 0..1] [--punish 0|1] [--low 0..1] [--thump 0|1]
//                   [--tone 0..1] [--high 0..1] [--steep 0|1] [--mix 0..1] [--out 0..1] [--auto 0|1] [--ref 1]

#include "../dsp/Decap.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

int main(int argc, char** argv) {
    mmarp::DecapSettings s;
    s.ref = 1;
    double sr = 48000;
    for (int i = 1; i + 1 < argc; i += 2) {
        const std::string k = argv[i];
        const double v = std::atof(argv[i + 1]);
        if (k == "--sr") sr = v;
        else if (k == "--style") s.style = static_cast<int>(v);
        else if (k == "--drive") s.drive = v;
        else if (k == "--punish") s.punish = v >= 0.5;
        else if (k == "--low") s.low = v;
        else if (k == "--thump") s.thump = v >= 0.5;
        else if (k == "--tone") s.tone = v;
        else if (k == "--high") s.high = v;
        else if (k == "--steep") s.steep = v >= 0.5;
        else if (k == "--mix") s.mix = v;
        else if (k == "--out") s.out = v;
        else if (k == "--auto") s.autoGain = v >= 0.5;
        else if (k == "--ref") s.ref = v;
        else {
            std::fprintf(stderr, "reglage inconnu : %s\n", k.c_str());
            return 2;
        }
    }
    mmarp::Decap d;
    d.prepare(sr);
    d.set(s);
    std::vector<float> in(256), L(128), R(128);
    for (;;) {
        const size_t got = std::fread(in.data(), sizeof(float), in.size(), stdin);
        const int n = static_cast<int>(got / 2);
        if (n <= 0) break;
        for (int i = 0; i < n; ++i) {
            L[i] = in[2 * i];
            R[i] = in[2 * i + 1];
        }
        d.process(L.data(), R.data(), n);
        for (int i = 0; i < n; ++i) {
            in[2 * i] = L[i];
            in[2 * i + 1] = R[i];
        }
        std::fwrite(in.data(), sizeof(float), static_cast<size_t>(2 * n), stdout);
        if (got < in.size()) break;
    }
    return 0;
}
