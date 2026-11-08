// Compare le portage C++ (dsp/Shots.cpp) au vrai shotsdsp.ts du site.
// 1) node tests/render-ref.mjs <ref>   2) mm_compare <ref> <public/samples/rytm>
// Echoue si un coup differe en longueur, en canaux, ou de plus de -80 dBFS (erreur crete) de la reference.
#include "../dsp/Shots.h"

#include <cmath>
#include <cstdio>
#include <fstream>
#include <iterator>
#include <sstream>
#include <string>
#include <vector>

static std::vector<char> readAll(const std::string& p) {
    std::ifstream f(p, std::ios::binary);
    return std::vector<char>(std::istreambuf_iterator<char>(f), std::istreambuf_iterator<char>());
}

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "usage: mm_compare <ref-dir> <samples-dir>\n");
        return 2;
    }
    const std::string ref = argv[1];
    const std::string samples = argv[2];
    std::ifstream tsv(ref + "/cases.tsv");
    if (!tsv) {
        std::fprintf(stderr, "cases.tsv introuvable dans %s\n", ref.c_str());
        return 2;
    }
    const double sr = 48000;
    const double tol = std::pow(10.0, -80.0 / 20.0);
    int fails = 0, total = 0;
    std::string line;
    while (std::getline(tsv, line)) {
        if (line.empty()) continue;
        std::vector<std::string> c;
        std::stringstream ss(line);
        std::string cell;
        while (std::getline(ss, cell, '\t')) c.push_back(cell);
        if (c.size() < 24) continue;
        const int n = std::stoi(c[0]);
        mm::ShotId id;
        if (!mm::shotFromName(c[1], id)) {
            std::fprintf(stderr, "voix inconnue %s\n", c[1].c_str());
            return 2;
        }
        mm::ShotTweak tw;
        tw.model = c[2] == "909" ? mm::KitModel::K909 : c[2] == "808" ? mm::KitModel::K808 : mm::KitModel::MM;
        const int variant = std::stoi(c[3]);
        const double stretch = std::stod(c[4]);
        tw.tune = std::stod(c[5]);
        tw.attack = std::stod(c[6]);
        tw.decay = std::stod(c[7]);
        tw.drive = std::stod(c[8]);
        tw.snappy = std::stod(c[9]);
        tw.gate = c[10] == "1";
        tw.sweep = std::stod(c[11]);
        tw.sdTune = std::stod(c[12]);
        tw.sdDecay = std::stod(c[13]);
        tw.sdTone = std::stod(c[14]);
        tw.syn = std::stod(c[15]);
        tw.smp.lev = std::stod(c[16]);
        tw.smp.st = std::stod(c[17]);
        tw.smp.start = std::stod(c[18]);
        tw.smp.len = std::stod(c[19]);
        tw.smp.rev = c[20] == "1";
        mm::SamplePcm pcm;
        const mm::SamplePcm* pp = nullptr;
        if (c[21] != "-") {
            const auto bytes = readAll(samples + "/" + c[21]);
            if (!mm::decodeWav(bytes.data(), bytes.size(), pcm)) {
                std::fprintf(stderr, "WAV illisible %s\n", c[21].c_str());
                return 2;
            }
            tw.hasSample = true;
            pp = &pcm;
        }
        const size_t len = std::stoul(c[22]);
        const bool mono = c[23] == "1";
        const auto raw = readAll(ref + "/" + std::to_string(n) + ".f32");
        const float* r = reinterpret_cast<const float*>(raw.data());
        const mm::Shot s = mm::renderLayers(id, sr, stretch, variant, tw, pp);
        ++total;
        bool ok = s.size() == len && s.mono == mono && raw.size() == len * (mono ? 1 : 2) * sizeof(float);
        double err = 0, peak = 0;
        if (ok) {
            for (size_t i = 0; i < len; ++i) {
                err = std::max(err, std::fabs(static_cast<double>(s.L[i]) - r[i]));
                peak = std::max(peak, std::fabs(static_cast<double>(r[i])));
                if (!mono) err = std::max(err, std::fabs(static_cast<double>(s.R[i]) - r[len + i]));
            }
            ok = err < tol;
        }
        std::printf("%-3s %-7s %-4s v%d %-14s len %7zu/%7zu %s err %.2e (%.1f dB) %s\n", ok ? "OK" : "KO", c[1].c_str(), c[2].c_str(), variant,
                    c[21] == "-" ? "synth" : c[21].c_str(), s.size(), len, s.mono ? "mono" : "st  ", err, err > 0 ? 20 * std::log10(err) : -999.0,
                    peak > 0 ? "" : "(silence)");
        if (!ok) ++fails;
    }
    std::printf("%d/%d coups identiques a la reference (tolerance -80 dBFS)\n", total - fails, total);
    return fails == 0 && total > 0 ? 0 : 1;
}
