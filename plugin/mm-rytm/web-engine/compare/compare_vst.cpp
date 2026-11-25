// La parite du moteur du navigateur avec le VST3 : le vrai MMRytmProcessor (src/PluginProcessor.cpp et SampleBank.cpp
// tels quels, sans fenetre) et RytmEngine (web-engine, par son API C) cote a cote, memes entrees : des programmes de la
// face (les fichiers donnes en argument, ex. les presets d'usine captures par bridge.compile) et des programmes tires au
// hasard (tests/engine_web_programs.h : samples, LFO, COND, PROB, lock trigs, verrous, RTRG, uTIME, FLTR, effets), des
// coups en direct (son du pad, son neuf), FILL, un programme neuf en jouant, RUN / STOP, les notes MIDI, un transport
// d'hote (et ses sauts), MASTER, des blocs de 1 a 1024 et de 441, 44,1 / 48 / 96 kHz. Sortie et tete de lecture
// comparees AU BIT PRES a chaque bloc. A relancer apres toute modification de PluginProcessor.cpp ou du moteur.
// Rien ne sort des enceintes. Hors du build du depot (il faut JUCE) : voir web-engine/README.md.
//
// Le fil du calcul du VST3 (Renderer) est arrete apres la construction : son renderLoop est appele ici, aux memes moments
// que mmrytm_idle (le programme et les sons sont les memes ; seul le moment du passage, libre dans le VST3, est fixe).
#include <juce_audio_processors/juce_audio_processors.h>

#include "Engine.h"

#include <atomic>
#include <map>
#include <mutex>

// renderLoop et le fil du calcul sont prives : ce banc seulement les atteint
#define private public
#include "PluginProcessor.h"
#undef private

#include "RytmEngine.h"
#include "SampleBank.h"
#include "engine_web_programs.h"

#include <algorithm>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iterator>

using namespace mmrytmtest;

namespace {

int failures = 0;
void check(bool ok, const std::string& what) {
    std::printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
    std::fflush(stdout);
    if (!ok) ++failures;
}

struct Head final : juce::AudioPlayHead {
    bool playing = false;
    double ppq = 0, bpm = 120;
    juce::Optional<PositionInfo> getPosition() const override {
        PositionInfo p;
        p.setIsPlaying(playing);
        p.setBpm(bpm);
        p.setPpqPosition(ppq);
        return p;
    }
};

struct Totals {
    long blocks = 0, samples = 0, mismatchSamples = 0, fbMismatch = 0;
    double maxDiff = 0, peak = 0;
} all;

struct Pair {
    std::unique_ptr<MMRytmProcessor> p;
    MMRytmEngine* e = nullptr;
    Head head;
    bool useHead = false;
    double sr = 48000, t = 0;
    long mism = 0, fbBad = 0, firstBad = -1, samples = 0;
    double peak = 0;
    explicit Pair(double rate, int block) : p(new MMRytmProcessor()), e(mmrytm_create()), sr(rate) {
        // le fil du calcul s'arrete : ses passages se font ici (renderLoop), comme mmrytm_idle
        reinterpret_cast<juce::Thread*>(p->renderer_.get())->stopThread(3000);
        p->setRateAndBufferSizeDetails(rate, block);
        p->prepareToPlay(rate, block);
        mmrytm_prepare(e, rate, block);
        idle();
    }
    ~Pair() { mmrytm_destroy(e); }
    void idle() {
        p->renderLoop();
        mmrytm_idle(e, t);
    }
    void program(const std::string& j) {
        p->faceProgram(juce::String::fromUTF8(j.data(), static_cast<int>(j.size())));
        mmrytm_program(e, j.data(), static_cast<int>(j.size()));
        idle();
    }
    void hit(const std::string& j) {
        // la WebView : l'objet du message, lu par JSON::parse
        p->faceHit(juce::JSON::parse(juce::String::fromUTF8(j.data(), static_cast<int>(j.size()))));
        mmrytm_hit(e, j.data(), static_cast<int>(j.size()));
        idle();
    }
    void run(bool on) {
        p->faceRun(on);
        mmrytm_run(e, on ? 1 : 0);
    }
    void fill(bool on) {
        p->faceFill(on);
        mmrytm_fill(e, on ? 1 : 0);
    }
    void master(double db) {
        auto* prm = p->apvts.getParameter("master");
        prm->setValueNotifyingHost(prm->convertTo0to1(static_cast<float>(db)));
        mmrytm_set_master_db(e, p->master_->load());
    }
    struct Midi {
        int pos, s, d1, d2;
    };
    void block(int n, const std::vector<Midi>& midi = {}) {
        juce::AudioBuffer<float> buf(2, n);
        juce::MidiBuffer mb;
        for (const auto& m : midi) {
            mb.addEvent(juce::MidiMessage(m.s, m.d1, m.d2), m.pos);
            mmrytm_midi(e, m.pos, m.s, m.d1, m.d2);
        }
        if (useHead) {
            p->setPlayHead(&head);
            mmrytm_set_host_position(e, head.playing ? 1 : 0, head.ppq, head.bpm);
        } else
            p->setPlayHead(nullptr);
        p->processBlock(buf, mb);
        std::vector<float> L(static_cast<size_t>(n)), R(static_cast<size_t>(n));
        mmrytm_process(e, L.data(), R.data(), n);
        for (int i = 0; i < n; ++i) {
            const float a = buf.getSample(0, i), b = buf.getSample(1, i);
            peak = std::max(peak, static_cast<double>(std::max(std::fabs(a), std::fabs(b))));
            if (std::memcmp(&a, &L[static_cast<size_t>(i)], 4) != 0 || std::memcmp(&b, &R[static_cast<size_t>(i)], 4) != 0) {
                ++mism;
                if (firstBad < 0) firstBad = samples + i;
                all.maxDiff = std::max(all.maxDiff, static_cast<double>(std::max(std::fabs(a - L[static_cast<size_t>(i)]), std::fabs(b - R[static_cast<size_t>(i)]))));
            }
        }
        const auto fb = p->feedback();
        const int32_t* w = mmrytm_feedback(e);
        if (w[0] != (fb.playing ? 1 : 0) || w[1] != (fb.internal ? 1 : 0) || w[2] != (fb.playing ? fb.step : -1) || w[3] != fb.seq || w[4] != fb.mask) ++fbBad;
        samples += n;
        t += n / sr;
        ++all.blocks;
    }
    void done(const std::string& what) {
        all.samples += samples;
        all.mismatchSamples += mism;
        all.fbMismatch += fbBad;
        all.peak = std::max(all.peak, peak);
        check(mism == 0 && fbBad == 0 && peak > 0, what + " : " + std::to_string(samples) + " ech., crete " + std::to_string(peak) + ", " + std::to_string(mism) +
                                                     " differents" + (firstBad >= 0 ? " (le premier a " + std::to_string(firstBad) + ")" : "") + ", tete " + std::to_string(fbBad));
    }
};

std::string readFile(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    return std::string((std::istreambuf_iterator<char>(in)), {});
}

} // namespace

int main(int argc, char** argv) {
    juce::ScopedJuceInitialiser_GUI gui;
    // La banque du moteur : les memes fichiers que BinaryData (celle du VST3 se charge d'elle-meme)
    std::vector<std::string> keys;
    for (const auto& f : std::filesystem::recursive_directory_iterator(MM_SAMPLES_DIR)) {
        if (!f.is_regular_file() || f.path().extension() != ".wav") continue;
        const std::string data = readFile(f.path().string()), name = f.path().filename().string();
        if (mmrytm_bank_add(name.data(), static_cast<int>(name.size()), data.data(), static_cast<int>(data.size())))
            keys.push_back(f.path().parent_path().filename().string() + "/" + name);
    }
    std::sort(keys.begin(), keys.end());
    int vstBank = 0;
    for (int t = 0; t < 8; ++t) vstBank += static_cast<int>(mm::SampleBank::get().of(t).size());
    check(mmrytm_bank_count() == vstBank && vstBank > 100, "banque : " + std::to_string(vstBank) + " samples (VST3) = " + std::to_string(mmrytm_bank_count()) + " (moteur)");

    // 1. Les programmes de la face (fichiers) : 4 mesures, RUN, les pads de temps en temps
    for (int a = 1; a < argc; ++a) {
        const std::string prog = readFile(argv[a]);
        if (prog.empty()) continue;
        Pair x(48000, 128);
        x.program(prog);
        x.run(true);
        Rng r(static_cast<uint32_t>(a));
        const int blocks = static_cast<int>(48000 * 8.0 / 128);
        for (int k = 0; k < blocks; ++k) {
            if (k % 61 == 7) {
                const int i = r.pick(8);
                const std::string snd = soundOfProgram(prog, i);
                if (!snd.empty())
                    x.hit("{\"t\":" + std::to_string(i) + ",\"vel\":1,\"slice\":1,\"sound\":" + snd + ",\"tau\":-1,\"atk\":0,\"hold\":0.004,\"gain\":1,\"pan\":0,\"start\":0,\"sl\":[0,0,0,0,0]}");
            }
            x.block(128);
            if (k % 37 == 0) x.idle();
        }
        x.done("face " + std::filesystem::path(argv[a]).filename().string());
    }

    // 2. Des programmes au hasard : tout ce que lit le processeur, et tous les evenements
    const int kSeeds = 24;
    for (uint32_t seed = 1; seed <= kSeeds; ++seed) {
        Rng r(seed * 1013);
        const double rates[4] = {48000, 48000, 44100, 96000};
        const double sr = rates[seed % 4];
        const int mode = static_cast<int>(seed % 3); // 0 : 128 ; 1 : 1 a 1024 ; 2 : 441
        Pair x(sr, mode == 2 ? 441 : 1024);
        const std::string p1 = randomProgram(seed, keys), p2 = randomProgram(seed + 5000, keys);
        x.program(p1);
        const bool host = seed % 5 == 0;
        x.useHead = host;
        x.head.bpm = 90 + r.pick(80);
        x.head.ppq = host ? r.range(0, 32) : 0;
        if (!host) x.run(true);
        else x.head.playing = true;
        const double seconds = 6;
        long done = 0;
        int k = 0;
        bool switched = false;
        while (done < static_cast<long>(sr * seconds)) {
            const int n = mode == 0 ? 128 : mode == 2 ? 441 : 1 + r.pick(1024);
            std::vector<Pair::Midi> midi;
            if (r.chance(0.04)) midi.push_back({r.pick(n), 0x90, 35 + r.pick(23), r.pick(128)});
            if (r.chance(0.01)) midi.push_back({r.pick(n), 0xb0, r.chance(0.5) ? 123 : 120, 0});
            if (r.chance(0.02)) {
                const std::string& cur = switched ? p2 : p1;
                x.hit(randomHit(r, keys, soundOfProgram(cur, r.pick(16))));
            }
            if (r.chance(0.01)) x.fill(r.chance(0.5));
            if (!switched && done > static_cast<long>(sr * seconds / 2)) {
                switched = true;
                x.program(p2);
            }
            if (!host && r.chance(0.006)) x.run(r.chance(0.6));
            if (r.chance(0.004)) x.master(r.chance(0.7) ? r.range(-20, 6) : r.chance(0.5) ? 0 : -60);
            x.block(n, midi);
            if (host) {
                // l'hote avance ; parfois sa boucle (un saut), parfois il s'arrete et RUN reprend
                x.head.ppq += n * x.head.bpm / 60.0 / sr;
                if (r.chance(0.01)) x.head.ppq = r.range(0, 16);
                if (r.chance(0.005)) {
                    x.head.playing = !x.head.playing;
                    if (!x.head.playing) x.run(true);
                }
            }
            done += n;
            if (++k % 23 == 0) x.idle();
        }
        x.done("hasard " + std::to_string(seed) + " (" + std::to_string(static_cast<int>(sr)) + " Hz, " + (mode == 0 ? "128" : mode == 2 ? "441" : "1..1024") +
               (host ? ", hote" : "") + ")");
    }

    std::printf("\nTOTAL : %ld blocs, %ld echantillons, %ld differents (ecart max %g), tete %ld differente, crete %g\n", all.blocks, all.samples, all.mismatchSamples,
                all.maxDiff, all.fbMismatch, all.peak);
    std::printf("%s (%d)\n", failures ? "ECHEC" : "tout est identique", failures);
    return failures ? 1 : 0;
}
