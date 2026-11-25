// La parite du moteur du navigateur avec le VST3 : le vrai MMArpProcessor (src/PluginProcessor.cpp, sans fenetre,
// MMARP_HEADLESS) et ArpEngine (web-engine, par son API C) cote a cote, memes entrees (presets d'usine, automation,
// matrice, MIDI, blocs de toutes tailles, transport d'hote, reverb recalculee, clip MIDI), sorties, telemetrie et
// parametres compares AU BIT PRES a chaque bloc. A relancer apres toute modification de PluginProcessor.cpp ou du moteur.
// Rien ne sort des enceintes. Hors du build du depot (il faut JUCE) : voir web-engine/README.md.
#include "PluginProcessor.h"
#include "engine_web_preset.h"

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <random>
#include <thread>

using namespace mmarptest;

namespace {

int failures = 0;
void check(bool ok, const std::string& what) {
    std::printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
    if (!ok) ++failures;
}

double db(double x) { return 20 * std::log10(std::max(x, 1e-12)); }

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

std::string num(double v) {
    char b[64];
    std::snprintf(b, sizeof b, "%.17g", v);
    return b;
}

std::string programJson(const Face& f) {
    std::string s = "{\"v\":2,\"kind\":\"arp\",\"bpm\":" + num(f.bpm) + ",\"swing\":" + num(f.swing) + ",\"seq\":{\"edit\":" + (f.seqEdit ? "true" : "false") +
                    ",\"len\":" + std::to_string(f.seqLen) + ",\"buf\":[";
    for (int i = 0; i < 16; ++i) s += (i ? "," : "") + (f.seqBuf[i] == mmarp::kSeqRest ? std::string("null") : std::to_string(f.seqBuf[i]));
    s += "]},\"prog\":[";
    for (int i = 0; i < f.nProg; ++i) s += (i ? "," : "") + std::to_string(f.prog[i]);
    s += "],\"chordBank\":2,\"knobs\":{";
    for (int i = 0; i < mmarp::kKnobs; ++i) s += std::string(i ? "," : "") + "\"" + mmarp::kKnobDefs[i].id + "\":" + num(f.knobs[static_cast<size_t>(i)]);
    s += "},\"extra\":{";
    for (int e = 0; e < mmx::kExtra; ++e) s += std::string(e ? "," : "") + "\"" + mmx::kExtraDefs[e].id + "\":" + num(f.extras[static_cast<size_t>(e)]);
    s += "},\"steps\":{";
    const char* lane[5] = {"acc", "slide", "gate", "rat", "prob"};
    for (int l = 0; l < 5; ++l) {
        s += std::string(l ? "," : "") + "\"" + lane[l] + "\":[";
        for (int i = 0; i < 16; ++i) s += (i ? "," : "") + std::to_string(f.lanes[l * 16 + i]);
        s += "]";
    }
    s += "}}";
    return s;
}

struct Ev {
    int pos, s, d1, d2;
};

bool feq(double a, double b) { return (std::isnan(a) && std::isnan(b)) || a == b; }

struct Pair {
    std::unique_ptr<MMArpProcessor> p;
    MMArpEngine* e = nullptr;
    Head head;
    bool useHead = false;
    uint32_t seed = 0;
    int64_t samples = 0;
    long slicedBlocks = 0;
    long mismatchBlocks = 0, mismatchSamples = 0, teleMismatch = 0, paramMismatch = 0;
    double maxDiff = 0;
    int64_t firstMismatch = -1;
    std::string firstTele;
    double peak = 0;
    Pair() : p(new MMArpProcessor()) {
        juce::MemoryBlock mb;
        p->getStateInformation(mb);
        auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
        seed = static_cast<uint32_t>(static_cast<juce::int64>(xml->getStringAttribute("seed").getLargeIntValue()));
        e = mmarp_create(seed);
    }
    ~Pair() { mmarp_destroy(e); }
    void param(int i, double v) {
        p->faceParam(mmx::allId(i), v);
        mmarp_set_param(e, i, v);
    }
    void param(const char* id, double v) { param(mmx::allIndex(id), v); }
    void program(const Face& f) {
        p->faceProgram(programJson(f));
        sendProgram(e, f, 1);
    }
    void load(const Face& f) {
        for (int i = 0; i < mmarp::kKnobs; ++i) param(i, f.knobs[static_cast<size_t>(i)]);
        for (int x = 0; x < mmx::kExtra; ++x) param(mmarp::kKnobs + x, f.extras[static_cast<size_t>(x)]);
        program(f);
    }
    void prepare(int block) {
        p->prepareToPlay(48000, block);
        mmarp_prepare(e, 48000, block);
    }
    void run(bool on) {
        p->faceRun(on);
        mmarp_run(e, on ? 1 : 0);
    }
    void block(int n, const std::vector<Ev>& evs = {}) {
        juce::AudioBuffer<float> buf(2, n);
        juce::MidiBuffer mb;
        for (const auto& v : evs) {
            const int st = v.s & 0xf0;
            if (st == 0xc0 || st == 0xd0) mb.addEvent(juce::MidiMessage(v.s, v.d1), v.pos);
            else mb.addEvent(juce::MidiMessage(v.s, v.d1, v.d2), v.pos);
            mmarp_midi(e, v.pos, v.s, v.d1, v.d2);
        }
        if (useHead) {
            p->setPlayHead(&head);
            mmarp_set_host_position(e, head.playing ? 1 : 0, head.ppq, head.bpm);
        } else
            p->setPlayHead(nullptr);
        p->processBlock(buf, mb);
        std::vector<float> L(static_cast<size_t>(n)), R(static_cast<size_t>(n));
        mmarp_process(e, L.data(), R.data(), n);
        bool bad = false;
        for (int i = 0; i < n; ++i) {
            const float a = buf.getSample(0, i), b = buf.getSample(1, i);
            peak = std::max(peak, static_cast<double>(std::max(std::fabs(a), std::fabs(b))));
            if (std::memcmp(&a, &L[static_cast<size_t>(i)], 4) != 0 || std::memcmp(&b, &R[static_cast<size_t>(i)], 4) != 0) {
                ++mismatchSamples;
                bad = true;
                maxDiff = std::max(maxDiff, static_cast<double>(std::max(std::fabs(a - L[static_cast<size_t>(i)]), std::fabs(b - R[static_cast<size_t>(i)]))));
                if (firstMismatch < 0) firstMismatch = samples + i;
            }
        }
        if (bad) ++mismatchBlocks;
        samples += n;
        if (useHead && head.playing) head.ppq += n * head.bpm / 60.0 / 48000.0;
        teleCheck();
    }
    void teleCheck() {
        const double* t = mmarp_telemetry(e);
        const auto fb = p->feedback();
        std::string bad;
        const auto chk = [&](const char* what, double a, double b) {
            if (!feq(a, b) && bad.empty()) bad = std::string(what) + " vst=" + num(a) + " web=" + num(b);
        };
        chk("playing", fb.playing, t[0]);
        chk("internal", fb.internal, t[1]);
        chk("seq", fb.seq, t[2]);
        chk("slot", fb.slot, t[3]);
        chk("pos", fb.pos, t[4]);
        chk("len", fb.len, t[5]);
        chk("chord", fb.chord, t[6]);
        chk("midi", fb.midi, t[7]);
        chk("skip", fb.skip, t[8]);
        chk("dur", fb.dur, t[9]);
        chk("ppq", p->facePpq(), t[10]);
        chk("bpm", p->faceBpm(), t[11]);
        const mmarpweb::Telemetry& T = *reinterpret_cast<const mmarpweb::Telemetry*>(t);
        for (int i = 0; i < 12; ++i) chk("mod", p->modValue(i), T.mod[i]);
        for (int j = 0; j < 8; ++j) {
            chk("modShowK", p->modShowK(j), T.modShowK[j]);
            chk("modShowV", p->modShowV(j), T.modShowV[j]);
        }
        chk("hellLfo", p->hellLfo(), T.hellLfo);
        chk("distoVu", p->distoVu(), T.distoVu);
        for (int i = 0; i < 6; ++i) chk("eg", p->egValue(i), T.eg[i]);
        chk("os", p->cpuOs(), T.os);
        chk("voices", p->cpuVoices(), T.voices);
        chk("pro", p->cpuPro(), T.pro);
        chk("latency", p->latencyNow(), T.latency);
        chk("clipActive", p->clipActive(), T.clipActive);
        chk("knobsKnown", p->knobsKnown(), T.knobsKnown);
        chk("sliced", p->modSliced(), reinterpret_cast<mmarpweb::ArpEngine*>(e)->modSliced());
        if (p->modSliced()) ++slicedBlocks;
        for (int k = 0; k < mmx::kAll; ++k) {
            const float a = p->knobParam(k)->getValue(), b = mmarp_params(e)[k];
            if (a != b) {
                ++paramMismatch;
                if (bad.empty()) bad = std::string("param ") + mmx::allId(k) + " vst=" + num(a) + " web=" + num(b);
            }
        }
        for (int k = 0; k < mmx::kAll; ++k) chk("work", p->workValue(k), reinterpret_cast<mmarpweb::ArpEngine*>(e)->workValue(k));
        if (!bad.empty()) {
            ++teleMismatch;
            if (firstTele.empty()) firstTele = "@" + std::to_string(samples) + " " + bad;
        }
    }
    bool report(const std::string& name) {
        const bool ok = mismatchSamples == 0 && teleMismatch == 0;
        char b[512];
        std::snprintf(b, sizeof b, "%s : %lld echantillons, crete %.1f dBFS, %ld blocs differents (max %.3g, premier %lld), telemetrie %ld%s%s", name.c_str(),
                      static_cast<long long>(samples), db(peak), mismatchBlocks, maxDiff, static_cast<long long>(firstMismatch), teleMismatch, firstTele.empty() ? "" : " ",
                      firstTele.c_str());
        check(ok && peak > 0, b);
        return ok;
    }
};

int barSamples(double bpm, int bars) { return static_cast<int>(std::ceil(bars * 4 * 60.0 / bpm * 48000.0)); }

int dstCodeOf(const char* id) {
    const int k = mmx::allIndex(id);
    for (int i = 0; i < mmx::kModDestCount; ++i)
        if (mmx::kModDests[i].k == k) return mmx::kModDests[i].code;
    return -1;
}
double codeV(int code) { return static_cast<double>(code) / (mmx::kModDstN - 1); }
double stepV(const char* id, int step) {
    const int e = mmx::allIndex(id) - mmarp::kKnobs;
    return static_cast<double>(step) / (mmx::kExtraDefs[e].nSteps - 1);
}

} // namespace

int main(int argc, char** argv) {
    juce::ScopedJuceInitialiser_GUI init;
    const char* path = argc > 1 ? argv[1] : MMARP_FACTORY_JSON;
    J root;
    if (!readFactory(path, root)) {
        std::printf("factory.json illisible : %s\n", path);
        return 1;
    }
    const J* presets = root.get("presets");
    const int nP = static_cast<int>(presets->a.size());

    // 1. Chaque preset d'usine, 2 mesures, blocs de 128, RUN
    int okP = 0;
    for (int k = 0; k < nP; ++k) {
        Pair q;
        const J& pr = presets->a[static_cast<size_t>(k)];
        const Face f = faceOf(pr, mmarp_params(q.e));
        q.load(f);
        q.prepare(128);
        q.run(true);
        const int n = barSamples(f.bpm, 2);
        for (int d = 0; d < n; d += 128) q.block(128);
        const J* nm = pr.get("name");
        okP += q.report("preset " + std::to_string(k) + " " + (nm ? nm->s : "")) ? 1 : 0;
    }
    std::printf("presets identiques : %d / %d\n", okP, nP);

    // 2. Automation, QUALITY / ENGINE / LATENCY en route, DISTO, HELL, la matrice (tranches de 32), RUN / STOP, programme
    for (int pi : {0, 7, 23, 41, 66}) {
        if (pi >= nP) continue;
        Pair q;
        Face f = faceOf(presets->a[static_cast<size_t>(pi)], mmarp_params(q.e));
        q.load(f);
        q.prepare(128);
        q.run(true);
        const int code = dstCodeOf("xDlFb"), codeH = dstCodeOf("xHellMix"), codeG = dstCodeOf("gate");
        for (int b = 0; b < 1500; ++b) {
            if (b % 3 == 0) q.param("cutoff", 0.3 + 0.4 * std::sin(b * 0.05));
            if (b == 100) q.param("xQuality", 1.0);
            if (b == 200) q.param("xEngine", 0.0);
            if (b == 300) q.param("xLatency", 0.0);
            if (b == 350) {
                q.param("xDStyle", stepV("xDStyle", 3));
                q.param("dist", 0.6);
            }
            if (b == 400) {
                q.param("xMx1Src", stepV("xMx1Src", 6)); // LFO 1
                q.param("xMx1Dst", codeV(code));
                q.param("xMx1Amt", 0.9);
            }
            if (b == 500) {
                q.param("xHellMix", 0.4);
                q.param("xMx2Src", stepV("xMx2Src", 13)); // LFO 4
                q.param("xMx2Dst", codeV(codeH));
                q.param("xMx2Amt", 0.2);
            }
            if (b == 600) {
                q.param("xMx3Src", stepV("xMx3Src", 12)); // LFO 3
                q.param("xMx3Dst", codeV(codeG));
                q.param("xMx3Amt", 0.8);
                q.param("xMx4Src", stepV("xMx4Src", 7)); // LFO 2 sur CUTOFF (route 2)
                q.param("xMx4Dst", codeV(dstCodeOf("cutoff")));
                q.param("xMx4Amt", 0.3);
            }
            if (b == 700) q.param("xHellV2", 0.0);
            if (b == 800) q.run(false);
            if (b == 850) q.run(true);
            if (b == 900) {
                f.prog[0] = 3;
                f.nProg = std::max(f.nProg, 2);
                f.prog[1] = 5;
                f.bpm = 131;
                q.program(f);
            }
            if (b == 1000) q.param("xMx1Amt", 0.5); // l'emplacement 1 au repos : la valeur de l'hote revient
            if (b == 1100) q.param("xSwing", 0.4);
            if (b == 1200) q.param("xQuality", 0.0);
            q.block(128);
        }
        q.report("automation, matrice, HELL, DISTO, RUN, programme (preset " + std::to_string(pi) + ", " + std::to_string(q.slicedBlocks) + " blocs en tranches)");
    }

    // 3. MIDI : notes (NOTES), CC appris, pitch bend, aftertouch, molette, puis MIDI IN ARP avec HOLD, puis LAYER
    {
        Pair q;
        Face f = faceOf(presets->a[3], mmarp_params(q.e));
        q.load(f);
        q.prepare(128);
        q.p->learn("res");
        mmarp_learn(q.e, mmarp::kn_res);
        std::mt19937 rng(7);
        for (int b = 0; b < 1200; ++b) {
            std::vector<Ev> ev;
            if (b % 20 == 0) ev.push_back({static_cast<int>(rng() % 128), 0x90, 40 + static_cast<int>(rng() % 24), 30 + static_cast<int>(rng() % 97)});
            if (b % 20 == 7) ev.push_back({static_cast<int>(rng() % 128), 0x80, 0, 0});
            if (b % 20 == 9) ev.push_back({5, 0x90, 52, 0}); // note on velocite 0 = note off
            if (b % 13 == 0) ev.push_back({static_cast<int>(rng() % 128), 0xB2, 71, static_cast<int>(rng() % 128)});
            if (b % 17 == 0) ev.push_back({static_cast<int>(rng() % 128), 0xE0, static_cast<int>(rng() % 128), static_cast<int>(rng() % 128)});
            if (b % 19 == 0) ev.push_back({static_cast<int>(rng() % 128), 0xD0, static_cast<int>(rng() % 128), 0});
            if (b % 23 == 0) ev.push_back({static_cast<int>(rng() % 128), 0xB0, 1, static_cast<int>(rng() % 128)});
            if (b == 400) {
                q.param("xMidiIn", stepV("xMidiIn", 1)); // ARP
                q.param("xArpHold", 1.0);
            }
            if (b == 401) ev.push_back({0, 0x90, 54, 100});
            if (b == 402) ev.push_back({3, 0x90, 57, 100});
            if (b == 403) ev.push_back({9, 0x90, 61, 100});
            if (b == 500) {
                ev.push_back({0, 0x80, 54, 0});
                ev.push_back({0, 0x80, 57, 0});
            }
            if (b == 700) ev.push_back({0, 0xB0, 123, 0});
            if (b == 800) q.param("xMidiIn", stepV("xMidiIn", 2)); // LAYER
            if (b == 801) q.run(true);
            // pour que le melange des positions egales passe par le tri stable
            if (b == 900) {
                ev.push_back({64, 0x90, 60, 90});
                ev.push_back({10, 0x90, 64, 90});
                ev.push_back({64, 0x80, 60, 0});
            }
            q.block(128, ev);
        }
        q.report("MIDI : notes, CC appris, bend, aftertouch, molette, MIDI IN ARP + HOLD, LAYER");
    }

    // 4. Des blocs de toutes tailles (1 a 1024) ; 441
    for (int mode = 0; mode < 2; ++mode) {
        Pair q;
        Face f = faceOf(presets->a[12], mmarp_params(q.e));
        q.load(f);
        q.prepare(mode ? 441 : 1024);
        q.run(true);
        std::mt19937 rng(11);
        for (int b = 0; b < 600; ++b) {
            if (b == 300) q.param("xMx1Src", stepV("xMx1Src", 6)), q.param("xMx1Dst", codeV(dstCodeOf("xSkyWidth"))), q.param("xMx1Amt", 0.1);
            q.block(mode ? 441 : 1 + static_cast<int>(rng() % 1024));
        }
        q.report(mode ? "blocs de 441" : "blocs de 1 a 1024 (aleatoires)");
    }

    // 5. Un transport d'hote (setHostPosition / setPlayHead), l'hote joue puis s'arrete, RUN pendant qu'il joue
    {
        Pair q;
        Face f = faceOf(presets->a[30], mmarp_params(q.e));
        q.load(f);
        q.prepare(256);
        q.useHead = true;
        q.head.bpm = 124;
        q.head.ppq = 3.5;
        q.run(true);
        for (int b = 0; b < 900; ++b) {
            if (b == 50) q.head.playing = true;
            if (b == 300) q.run(false); // ARP RUN a STOP pendant que l'hote joue
            if (b == 400) q.run(true);
            if (b == 600) q.head.playing = false;
            if (b == 700) q.head.bpm = 98;
            q.block(256);
        }
        q.report("transport d'hote, ARP RUN, tempo de l'hote");
    }

    // 5b. La reverb recalculee : le timer du VST3 (fil de la reverb, puis reprise) contre idle()
    {
        Pair q;
        Face f = faceOf(presets->a[72], mmarp_params(q.e));
        q.load(f);
        q.param("xSkyType", 0.0);
        q.param("reverb", 0.7);
        q.prepare(128);
        q.run(true);
        for (int b = 0; b < 700; ++b) {
            if (b == 200 || b == 450) {
                q.param("xRevSize", b == 200 ? 0.85 : 0.2);
                q.param("xRevTone", b == 200 ? 0.3 : 0.7);
                // le VST3 : un tick du timer lance le calcul sur le fil de la reverb, un tick suivant reprend la reponse
                // (juce::Timer est une base privee : le cast a la C y donne acces, timerCallback y est public)
                auto* timer = (juce::Timer*) q.p.get();
                timer->timerCallback();
                std::this_thread::sleep_for(std::chrono::milliseconds(400));
                timer->timerCallback();
                mmarp_idle(q.e);
            }
            q.block(128);
        }
        q.report("reverb recalculee (timer du VST3 contre idle)");
    }

    // 6. Le clip MIDI (arpMidi) : les memes notes
    {
        int same = 0, total = 0;
        for (int k = 0; k < nP; k += 5) {
            Pair q;
            Face f = faceOf(presets->a[static_cast<size_t>(k)], mmarp_params(q.e));
            q.load(f);
            int barsP = 0;
            const juce::MidiFile mf = q.p->arpMidi(2, barsP);
            std::vector<std::array<int, 4>> a, b;
            if (mf.getNumTracks() > 0) {
                const auto* tr = mf.getTrack(0);
                for (int i = 0; i < tr->getNumEvents(); ++i) {
                    const auto& m = tr->getEventPointer(i)->message;
                    if (!m.isNoteOn()) continue;
                    const int j = tr->getIndexOfMatchingKeyUp(i);
                    a.push_back({static_cast<int>(m.getTimeStamp()), j >= 0 ? static_cast<int>(tr->getEventTime(j)) : -1, m.getVelocity(), m.getNoteNumber()});
                }
            }
            std::vector<float> notes(4 * 4096);
            int barsW = 0;
            const int n = mmarp_render_clip(q.e, 2, notes.data(), 4096, &barsW);
            for (int i = 0; i < n; ++i) b.push_back({static_cast<int>(notes[4 * i]), static_cast<int>(notes[4 * i + 1]), static_cast<int>(notes[4 * i + 2]), static_cast<int>(notes[4 * i + 3])});
            std::sort(a.begin(), a.end());
            std::sort(b.begin(), b.end());
            ++total;
            if (a == b && barsP == barsW) ++same;
        }
        check(same == total, "clip MIDI identique : " + std::to_string(same) + " / " + std::to_string(total));
    }

    std::printf("%s (%d echec%s)\n", failures ? "ECHEC" : "OK", failures, failures > 1 ? "s" : "");
    return failures ? 1 : 0;
}
