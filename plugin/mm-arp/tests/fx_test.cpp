// Compare plugin/mm-arp/dsp/ArpFx au site, sans aucun son :
//   node plugin/mm-arp/tests/fx-ref.mjs <ref>          (les references : worklets sous Node, chaine dans Chromium)
//   g++ -O2 -std=c++17 -Wall -Wextra -I plugin/mm-arp/dsp plugin/mm-arp/tests/fx_test.cpp plugin/mm-arp/dsp/ArpFx.cpp -o fx_test
//   ./fx_test <ref> [bloc]                              (bloc : taille des blocs de l'hote, 128 par defaut)
// Ecart : crete et RMS de (C++ - reference), en dB sous la crete de la reference. Echoue au-dela de -120 dB pour les
// worklets ('mm-chorus' juno, 'mm-tape'), de -60 dB pour la chaine complete.
#include "ArpFx.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <dirent.h>
#include <fstream>
#include <iterator>
#include <map>
#include <string>
#include <vector>

using Arrays = std::map<std::string, std::vector<double>>;

static bool load(const std::string& path, Arrays& a) {
    std::ifstream f(path, std::ios::binary);
    std::vector<char> b((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
    size_t p = 0;
    while (p + 24 <= b.size()) {
        char name[17] = {0};
        std::memcpy(name, &b[p], 16);
        int32_t type = 0, count = 0;
        std::memcpy(&type, &b[p + 16], 4);
        std::memcpy(&count, &b[p + 20], 4);
        p += 24;
        std::vector<double>& v = a[name];
        v.resize(static_cast<size_t>(count));
        for (int i = 0; i < count; ++i) {
            if (type == 1) {
                double d;
                std::memcpy(&d, &b[p + static_cast<size_t>(i) * 8], 8);
                v[static_cast<size_t>(i)] = d;
            } else {
                float x;
                std::memcpy(&x, &b[p + static_cast<size_t>(i) * 4], 4);
                v[static_cast<size_t>(i)] = x;
            }
        }
        p += static_cast<size_t>(count) * (type == 1 ? 8 : 4);
    }
    return !a.empty();
}

static std::vector<float> f32(const std::vector<double>& v) { return std::vector<float>(v.begin(), v.end()); }

struct Err {
    double peakDb, rmsDb, refPeak;
};
static Err compare(const std::vector<float>& L, const std::vector<float>& R, const std::vector<double>& rL, const std::vector<double>& rR, size_t from = 0) {
    double peak = 0, emax = 0, e2 = 0;
    size_t n = 0;
    for (size_t i = from; i < rL.size(); ++i) {
        peak = std::max({peak, std::fabs(rL[i]), std::fabs(rR[i])});
        const double a = L[i] - rL[i], b = R[i] - rR[i];
        emax = std::max({emax, std::fabs(a), std::fabs(b)});
        e2 += a * a + b * b;
        n += 2;
    }
    const double rms = std::sqrt(e2 / std::max<size_t>(1, n));
    auto db = [&](double e) { return e > 0 ? 20 * std::log10(e / peak) : -999.0; };
    return {db(emax), db(rms), peak};
}

static mmarp::ArpFxSettings settingsOf(const double* p, double bpm) {
    using L = mmarp::ArpFxLaws;
    mmarp::ArpFxSettings s;
    s.chorus = L::chorusMode(p[0]);
    s.delay = p[1];
    s.reverb = p[2];
    s.tape = L::fxAmount(p[3]);
    s.delaySeconds = L::delaySeconds(p[4], bpm);
    s.monoLowHz = L::monoLowHz(p[5]);
    s.volume = p[6];
    return s;
}

int main(int argc, char** argv) {
    if (argc < 2) {
        std::fprintf(stderr, "usage : fx_test <ref> [bloc]\n");
        return 2;
    }
    const std::string dir = argv[1];
    const int block = argc > 2 ? std::max(1, std::atoi(argv[2])) : 128;
    std::vector<std::string> files;
    if (DIR* d = opendir(dir.c_str())) {
        while (dirent* e = readdir(d)) {
            const std::string n = e->d_name;
            if (n.size() > 5 && n.substr(n.size() - 5) == ".mmfx") files.push_back(n);
        }
        closedir(d);
    }
    std::sort(files.begin(), files.end());
    if (files.empty()) {
        std::fprintf(stderr, "aucun cas dans %s\n", dir.c_str());
        return 2;
    }
    const double sr = 48000;
    int fails = 0;
    // la chaine rendue plusieurs fois (<cas>.rN) : le meilleur et le pire rendu de Chromium
    std::map<std::string, std::pair<double, double>> runs;
    std::map<std::string, double> limits;
    std::printf("%-18s %8s %10s %10s %8s\n", "cas", "bloc", "crete dB", "RMS dB", "seuil");
    for (const std::string& name : files) {
        Arrays a;
        if (!load(dir + "/" + name, a)) continue;
        const int kind = static_cast<int>(a["kind"][0]);
        const std::vector<float> inL = f32(a["inL"]), inR = f32(a["inR"]);
        const int n = static_cast<int>(inL.size());
        std::vector<float> oL(static_cast<size_t>(n)), oR(static_cast<size_t>(n));
        double limit = -120;
        if (kind == 0) {
            mmarp::detail::JunoChorus j;
            j.prepare(sr);
            j.start(a["init"][0], a["init"][1], a["init"][2]);
            const auto& rate = a["rate"];
            // des morceaux de taille quelconque dans chaque bloc de 128 (les messages au debut du bloc)
            for (int q = 0; q * 128 < n; ++q) {
                if (rate[static_cast<size_t>(q)] > 0) j.setRate(rate[static_cast<size_t>(q)]);
                int done = 0;
                while (done < 128) {
                    const int len = std::min(128 - done, block % 128 == 0 ? 128 : block);
                    const size_t o = static_cast<size_t>(q * 128 + done);
                    j.process(&inL[o], &inR[o], &oL[o], &oR[o], len, done + len == 128);
                    done += len;
                }
            }
        } else if (kind == 1) {
            mmarp::detail::TapeDelay t;
            t.prepare(sr, a["init"][0]);
            const std::vector<float> time = f32(a["time"]), fb = f32(a["fb"]), tp = f32(a["tape"]);
            for (int q = 0; q * 128 < n; ++q) {
                int done = 0;
                while (done < 128) {
                    const int len = std::min(128 - done, block % 128 == 0 ? 128 : block);
                    const size_t o = static_cast<size_t>(q * 128 + done);
                    t.process(&inL[o], &inR[o], &time[o], fb[static_cast<size_t>(q)], tp[static_cast<size_t>(q)], &oL[o], &oR[o], len, done == 0, done + len == 128);
                    done += len;
                }
            }
        } else {
            limit = -60;
            const auto& init = a["init"];
            double bpm = init[0];
            mmarp::ArpFx fx;
            fx.prepare(sr, block);
            fx.set(settingsOf(&init[1], bpm), true);
            const auto& ev = a["ev"];
            const size_t evN = ev.size() / 9;
            int pos = 0;
            auto run = [&](int to) {
                while (pos < to) {
                    const int len = std::min(block, to - pos);
                    fx.process(&inL[static_cast<size_t>(pos)], &inR[static_cast<size_t>(pos)], &oL[static_cast<size_t>(pos)], &oR[static_cast<size_t>(pos)], len);
                    pos += len;
                }
            };
            for (size_t e = 0; e < evN; ++e) {
                const double* E = &ev[e * 9];
                run(static_cast<int>(E[0]));
                if (E[1] > 0) {
                    bpm = E[1];
                    fx.retimeDelay(mmarp::ArpFxLaws::delaySeconds(E[2 + 4], bpm));
                } else fx.set(settingsOf(&E[2], bpm), false);
            }
            run(n);
        }
        const Err r = compare(oL, oR, a["outL"], a["outR"]);
        // FX_TEST_SAVE=<dossier> : la sortie du C++ en float32 (gauche puis droite), <cas>.f32
        if (const char* sv = std::getenv("FX_TEST_SAVE")) {
            std::ofstream o(std::string(sv) + "/" + name.substr(0, name.size() - 5) + ".f32", std::ios::binary);
            o.write(reinterpret_cast<const char*>(oL.data()), static_cast<std::streamsize>(oL.size() * 4));
            o.write(reinterpret_cast<const char*>(oR.data()), static_cast<std::streamsize>(oR.size() * 4));
        }
        // FX_TEST_DUMP=<cas>:<debut>:<n> : les echantillons (C++, reference) gauche et droite
        if (const char* dump = std::getenv("FX_TEST_DUMP")) {
            const std::string ds = dump;
            const size_t c1 = ds.find(':'), c2 = ds.rfind(':');
            if (c1 != std::string::npos && name.find(ds.substr(0, c1)) == 0) {
                const int a0 = std::atoi(ds.c_str() + c1 + 1), cnt = std::atoi(ds.c_str() + c2 + 1);
                for (int i = a0; i < std::min(n, a0 + cnt); ++i)
                    std::printf("  %d  L %+.7f %+.7f  R %+.7f %+.7f\n", i, oL[static_cast<size_t>(i)], a["outL"][static_cast<size_t>(i)], oR[static_cast<size_t>(i)], a["outR"][static_cast<size_t>(i)]);
            }
        }
        // FX_TEST_PROFILE=<cas> : l'ecart crete par tranche de 2048 echantillons (pour trouver ou il est)
        if (const char* prof = std::getenv("FX_TEST_PROFILE"))
            if (name.find(prof) == 0)
                for (int s0 = 0; s0 < n; s0 += 2048) {
                    double e = 0, pk = 0;
                    int at = 0;
                    for (int i = s0; i < std::min(n, s0 + 2048); ++i) {
                        const double d = std::max(std::fabs(oL[static_cast<size_t>(i)] - a["outL"][static_cast<size_t>(i)]), std::fabs(oR[static_cast<size_t>(i)] - a["outR"][static_cast<size_t>(i)]));
                        if (d > e) {
                            e = d;
                            at = i;
                        }
                        pk = std::max(pk, std::fabs(a["outL"][static_cast<size_t>(i)]));
                    }
                    std::printf("  %7d  %8.1f dB  (a %d ; crete locale %.3f)\n", s0, e > 0 ? 20 * std::log10(e / r.refPeak) : -999.0, at, pk);
                }
        const bool ok = r.peakDb <= limit && std::isfinite(r.peakDb);
        const size_t dot = name.find(".r");
        if (kind == 2 && dot != std::string::npos) {
            const std::string base = name.substr(0, dot);
            auto it = runs.find(base);
            if (it == runs.end()) runs[base] = {r.peakDb, r.peakDb};
            else it->second = {std::min(it->second.first, r.peakDb), std::max(it->second.second, r.peakDb)};
            limits[base] = limit;
        } else if (!ok) ++fails;
        std::printf("%-18s %8d %10.1f %10.1f %8.0f %s\n", name.substr(0, name.size() - 5).c_str(), block, r.peakDb, r.rmsDb, limit, ok ? "ok" : "ECHEC");
    }
    if (!runs.empty()) {
        std::printf("\nchaine, plusieurs rendus de Chromium : meilleur / pire (le cas passe si son meilleur rendu passe)\n");
        for (const auto& [base, mm] : runs) {
            const bool ok = mm.first <= limits[base];
            if (!ok) ++fails;
            std::printf("%-18s %10.1f %10.1f %s\n", base.c_str(), mm.first, mm.second, ok ? "ok" : "ECHEC");
        }
    }
    return fails ? 1 : 0;
}
