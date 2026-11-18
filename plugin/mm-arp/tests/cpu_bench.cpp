// v31 (Mika : "je viens de freez mon cpu", "optimise le plugin") : le banc CPU du processeur MM-ARP, sans fenetre ni son.
// Le vrai MMArpProcessor (MMARP_HEADLESS) joue chaque preset de la banque d'usine (sa suite, sa progression, ses
// reglages), INIT et un pire cas, en HQ et en STD, a 48 kHz par blocs de 128, transport en lecture ; la charge est le
// temps de processBlock rapporte a la duree du son rendu (% d'un coeur), avec le detail par etage du compteur du plugin.
//   cmake -S plugin/mm-arp -B build-host -DMM_HOST_TEST=ON && cmake --build build-host --target mmarp_cpu_bench
//   ./build-host/mmarp_cpu_bench_artefacts/Release/mmarp_cpu_bench [secondes] [filtre]   (depuis la racine du depot)
#include "PluginProcessor.h"

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <string>
#include <vector>

namespace {

struct Head final : juce::AudioPlayHead {
    bool playing = true;
    double ppq = 0, bpm = 120;
    juce::Optional<PositionInfo> getPosition() const override {
        PositionInfo p;
        p.setIsPlaying(playing);
        p.setBpm(bpm);
        p.setPpqPosition(ppq);
        return p;
    }
};

struct Result {
    double total = 0;                       // % d'un coeur, mesure directe
    double stage[MMArpProcessor::kCpuN]{};  // le compteur du plugin, moyenne sur le passage
    int voices = 0;
    double voicesAvg = 0;
};

struct Scene {
    std::string name;
    juce::var preset; // un objet de factory.json, ou vide (INIT)
    std::vector<std::pair<std::string, double>> extra; // reglages poses en plus (le pire cas)
    bool idle = false;                                  // transport arrete, aucune note : l'instance qui attend
    int block = 128;                                    // la taille des blocs de l'hote
    double bpm = 0;                                     // 0 : celui du preset (120 sans preset)
    const char* seq = nullptr;                          // la suite (JSON), sinon celle du preset ou la suite par defaut
};

static int gEngine = 1; // v34 : 1 PRO, 0 CLASSIC
Result play(const Scene& sc, int quality, double seconds) {
    MMArpProcessor p;
    Head h;
    h.bpm = sc.bpm > 0 ? sc.bpm : sc.preset.isObject() ? static_cast<double>(sc.preset.getProperty("bpm", 120)) : 120.0;
    p.setPlayHead(&h);
    if (auto* o = sc.preset.getProperty("knobs", juce::var()).getDynamicObject())
        for (const auto& kv : o->getProperties()) {
            const int ix = mmx::allIndex(kv.name.toString().toRawUTF8());
            if (ix >= 0) p.knobParam(ix)->setValueNotifyingHost(static_cast<float>(static_cast<double>(kv.value)));
        }
    if (auto* o = sc.preset.getProperty("extra", juce::var()).getDynamicObject())
        for (const auto& kv : o->getProperties()) {
            const int ix = mmx::allIndex(kv.name.toString().toRawUTF8());
            if (ix >= 0) p.knobParam(ix)->setValueNotifyingHost(static_cast<float>(static_cast<double>(kv.value)));
        }
    for (const auto& kv : sc.extra) {
        const int ix = mmx::allIndex(kv.first.c_str());
        if (ix >= 0) p.knobParam(ix)->setValueNotifyingHost(static_cast<float>(kv.second));
    }
    // v32 : QUALITY a trois crans (0 ECO, 0.5 STD, 1 HQ)
    p.knobParam(mmx::allIndex("xQuality"))->setValueNotifyingHost(static_cast<float>(quality) * 0.5f);
    p.knobParam(mmx::allIndex("xEngine"))->setValueNotifyingHost(static_cast<float>(gEngine));
    // le programme de la face : la suite et la progression du preset (sinon celles de la face par defaut)
    juce::DynamicObject::Ptr prog = new juce::DynamicObject();
    prog->setProperty("v", 2);
    prog->setProperty("kind", "arp");
    prog->setProperty("bpm", h.bpm);
    prog->setProperty("swing", 0);
    if (sc.preset.isObject()) {
        prog->setProperty("seq", sc.preset.getProperty("seq", juce::var()));
        prog->setProperty("prog", sc.preset.getProperty("prog", juce::var()));
        prog->setProperty("knobs", sc.preset.getProperty("knobs", juce::var()));
        if (sc.preset.hasProperty("steps")) prog->setProperty("steps", sc.preset.getProperty("steps", juce::var()));
    } else {
        prog->setProperty("seq", juce::JSON::parse(sc.seq ? sc.seq : R"({"edit":false,"len":8,"buf":[0,2,4,null,7,4,2,0,0,0,0,0,0,0,0,0]})"));
        prog->setProperty("prog", juce::JSON::parse("[0,5,3,4]"));
        prog->setProperty("knobs", juce::JSON::parse("{}"));
    }
    juce::MemoryBlock mb;
    p.getStateInformation(mb);
    auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
    juce::ValueTree st = juce::ValueTree::fromXml(*xml);
    st.setProperty("seed", 777, nullptr);
    st.setProperty("program", juce::JSON::toString(juce::var(prog.get()), true), nullptr);
    juce::MemoryBlock m2;
    juce::AudioProcessor::copyXmlToBinary(*st.createXml(), m2);
    p.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
    const int block = sc.block;
    const double sr = 48000;
    p.prepareToPlay(sr, block);
    juce::AudioBuffer<float> buf(2, block);
    juce::MidiBuffer midi;
    // une seconde de mise en route (la reverb, les queues), non comptee
    const int warm = static_cast<int>(sr) / block;
    const int blocks = static_cast<int>(seconds * sr) / block;
    h.playing = !sc.idle;
    Result r;
    double busy = 0;
    int counted = 0;
    for (int b = 0; b < warm + blocks; ++b) {
        const auto t0 = std::chrono::steady_clock::now();
        p.processBlock(buf, midi);
        const auto t1 = std::chrono::steady_clock::now();
        if (h.playing) h.ppq += block * h.bpm / 60.0 / sr;
        if (b < warm) continue;
        busy += std::chrono::duration<double>(t1 - t0).count();
        for (int i = 0; i < MMArpProcessor::kCpuN; ++i) r.stage[i] += p.cpu(i);
        r.voices = std::max(r.voices, p.cpuVoices());
        r.voicesAvg += p.cpuVoices();
        ++counted;
    }
    r.total = 100.0 * busy / (counted * block / sr);
    r.voicesAvg /= std::max(1, counted);
    for (double& v : r.stage) v /= std::max(1, counted);
    return r;
}

} // namespace

int main(int argc, char** argv) {
    juce::ScopedJuceInitialiser_GUI gui;
    const double seconds = argc > 1 ? std::atof(argv[1]) : 6.0;
    const std::string filter = argc > 2 ? argv[2] : "";
    // les crans de QUALITY a mesurer (argv[3], ex. "21" : HQ puis STD ; 2 HQ, 1 STD, 0 ECO)
    const std::string qs = argc > 3 ? argv[3] : "210";
    // v34 : le moteur (argv[4] : pro, classic ; par defaut pro)
    gEngine = argc > 4 && std::string(argv[4]) == "classic" ? 0 : 1;
    std::vector<Scene> scenes;
    // v32 : le cas de Mika (58.jpg) : un RANDOM ARP retouche, arpege 1/16 UP/DN a 116 BPM, YOUR NOTES, release long (12 voix
    // sans limite), blocs de 256 ; la voix de la famille ARP (hypno.ts : OCTAVE -1, filtre moyen, un peu de FM, STACK et
    // WIDE, CHORUS I, DELAY et REVERB doses)
    {
        Scene m{"CAS DE MIKA", juce::var(), {{"rate", 2.0 / 3}, {"mode", 2.0 / 3}, {"range", 0.5}, {"gate", 0.67}, {"octave", 0.25}, {"cutoff", 0.45}, {"res", 0.35},
                                            {"envAmt", 0.45}, {"fm", 0.2}, {"stack", 0.3}, {"wide", 0.4}, {"aA", 0.0}, {"aD", 0.5}, {"aS", 0.6}, {"aR", 0.85},
                                            {"fD", 0.4}, {"fR", 0.6}, {"chorus", 1.0 / 3}, {"delay", 0.25}, {"reverb", 0.3}}};
        m.block = 256;
        m.bpm = 116;
        m.seq = R"({"edit":true,"len":8,"buf":[0,2,4,7,9,7,4,2,0,0,0,0,0,0,0,0],"has":true})";
        scenes.push_back(m);
    }
    scenes.push_back({"INIT", juce::var(), {}});
    const juce::File f = juce::File::getCurrentWorkingDirectory().getChildFile("plugin/mm-arp/presets/factory.json");
    const juce::var bank = juce::JSON::parse(f.loadFileAsString());
    if (auto* o = bank.getDynamicObject())
        if (auto* list = o->getProperties().getVarPointer("presets"))
            for (const auto& pr : *list->getArray()) scenes.push_back({pr.getProperty("name", "?").toString().toStdString(), pr, {}});
    // le pire cas : UNISON 7, accords, DISTO 3 bandes, DELAY RHYTHM, HELL plein, reverb HALL, SHIMMER, PHASER, FLANGER, CHORUS
    scenes.push_back({"PIRE CAS", juce::var(), {{"xUnison", 1.0}, {"stack", 1.0}, {"chord", 1.0}, {"notes", 1.0}, {"dist", 0.7}, {"xDStyle", 0.5}, {"xDBands", 1.0},
                                                {"xDlMode", 1.0}, {"delay", 0.6}, {"xHellMix", 1.0}, {"xSkyType", 0.25}, {"reverb", 0.6}, {"xShimmer", 0.6},
                                                {"xPhMix", 0.6}, {"xFlMix", 0.6}, {"chorus", 1.0}, {"xQ3Gain", 0.7}}});
    // l'instance qui attend (transport arrete, rien ne sonne) : ce que coute une piste muette dans le projet
    {
        std::vector<Scene> more;
        Scene a{"INIT (ARRET)", juce::var(), {}};
        a.idle = true;
        more.push_back(a);
        for (const auto& sc : scenes)
            if (sc.name == "CATHEDRAL DRONE" || sc.name == "MUNICH BASS") {
                Scene b = sc;
                b.name += " (ARRET)";
                b.idle = true;
                more.push_back(b);
            }
        scenes.insert(scenes.end(), more.begin(), more.end());
    }
    static const char* const QN[3] = {gEngine ? "pECO" : "ECO", gEngine ? "pSTD" : "STD", gEngine ? "pHQ" : "HQ"};
    std::printf("Banc CPU MM-ARP : 48 kHz, blocs de 128 (le cas de Mika : 256), %.0f s par passage (aucun son joue) ; %% d'un coeur\n\n", seconds);
    std::printf("%-24s %4s %7s %7s | %6s %6s %6s %6s %6s %6s %6s | %s\n", "SCENE", "Q", "TOTAL", "COMPT.", "MOTEUR", "DISTO", "DELAY", "REVERB", "HELL", "EQ+RCK", "RESTE", "VOIX MAX/MOY");
    double sum[3] = {0, 0, 0};
    int cnt[3] = {0, 0, 0};
    double worst[3] = {0, 0, 0};
    std::string worstName[3];
    for (const auto& sc : scenes) {
        if (!filter.empty() && sc.name.find(filter) == std::string::npos) continue;
        for (char qc : qs) {
            const int q = qc - '0';
            if (q < 0 || q > 2) continue;
            const Result r = play(sc, q, seconds);
            std::printf("%-24s %4s %6.2f%% %6.2f%% | %6.2f %6.2f %6.2f %6.2f %6.2f %6.2f %6.2f | %d / %.1f\n", sc.name.c_str(), QN[q], r.total, r.stage[MMArpProcessor::kCpuTotal],
                        r.stage[MMArpProcessor::kCpuEngine], r.stage[MMArpProcessor::kCpuDisto], r.stage[MMArpProcessor::kCpuDelay], r.stage[MMArpProcessor::kCpuReverb],
                        r.stage[MMArpProcessor::kCpuHell], r.stage[MMArpProcessor::kCpuEqRack], r.stage[MMArpProcessor::kCpuRest], r.voices, r.voicesAvg);
            std::fflush(stdout);
            if (sc.name != "PIRE CAS" && sc.name != "INIT" && sc.name != "CAS DE MIKA" && !sc.idle) {
                sum[q] += r.total;
                cnt[q] += 1;
                if (r.total > worst[q]) {
                    worst[q] = r.total;
                    worstName[q] = sc.name;
                }
            }
        }
    }
    for (int q = 2; q >= 0; --q)
        if (cnt[q] > 0)
            std::printf("\nbanque d'usine en %s : moyenne %.2f %%, pire %.2f %% (%s)", QN[q], sum[q] / cnt[q], worst[q], worstName[q].c_str());
    std::printf("\n");
    return 0;
}
