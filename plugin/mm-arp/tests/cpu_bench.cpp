// v31 (Mika : "je viens de freez mon cpu", "optimise le plugin") : le banc CPU du processeur MM-ARP, sans fenetre ni son.
// Le vrai MMArpProcessor (MMARP_HEADLESS) joue chaque preset de la banque d'usine (sa suite, sa progression, ses
// reglages), INIT, un pire cas et les effets lourds engages, a 48 kHz, transport en lecture ; la charge est le temps de
// processBlock rapporte a la duree du son rendu (% d'un coeur), avec le detail par etage du compteur du plugin.
// v49 (2026-11-23, Mika : "optimise a fond", "le moins de ms possible") : la taille des blocs, le moteur (pro, classic,
// both), le meilleur de N passages (machine partagee), la latence declaree a l'hote et le mode LATENCY.
//   cmake -S plugin/mm-arp -B build-host -DMM_HOST_TEST=ON && cmake --build build-host --target mmarp_cpu_bench
//   ./build-host/mmarp_cpu_bench_artefacts/Release/mmarp_cpu_bench [secondes] [filtre] [crans] [moteur] [blocs] [passages]
//     crans    "210" (2 HQ, 1 STD, 0 ECO)         moteur  pro | classic | both
//     blocs    "128" ou "32,64,128,512"           passages : le meilleur de N (defaut 1)
//   MMARP_LATENCY=zero | exact : impose LATENCY (sans effet sur un build d'avant la v49)
// v50 : les scenes "INIT + MOD 4 / 8" et "CAS DE MIKA + MOD 4 / 8" : la matrice de l'encart LFO engagee (4 puis 8
// emplacements xMx, chemins par voix et generiques) ; un build d'avant la v50 les joue sans matrice (filtre : "MOD").
// Le filtre "=NOM" ne garde que la scene de ce nom exact (ex. "=INIT").
// (depuis la racine du depot)
#include "PluginProcessor.h"

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include "hell2_presets.inc" // GENERE par tests/hell2-presets-gen.mjs (la banque de la page HELL v2)

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
    int latency = 0;
    bool latencyMoved = false;
    uint64_t hash = 1469598103934665603ull; // FNV-1a de la sortie (MMARP_HASH=1 : deux builds compares au bit pres)
};

struct Scene {
    std::string name;
    juce::var preset; // un objet de factory.json, ou vide (INIT)
    std::vector<std::pair<std::string, double>> extra; // reglages poses en plus (le pire cas)
    bool idle = false;                                  // transport arrete, aucune note : l'instance qui attend
    int block = 0;                                      // 0 : la taille de la passe ; sinon impose (le cas de Mika : 256)
    double bpm = 0;                                     // 0 : celui du preset (120 sans preset)
    const char* seq = nullptr;                          // la suite (JSON), sinon celle du preset ou la suite par defaut
    bool bank = false;                                  // un preset de la banque d'usine (compte dans la moyenne)
};

void setParam(MMArpProcessor& p, const char* id, double v) {
    const int ix = mmx::allIndex(id);
    if (ix >= 0) p.knobParam(ix)->setValueNotifyingHost(static_cast<float>(v));
}

Result play(const Scene& sc, int engine, int quality, int block, double seconds) {
    MMArpProcessor p;
    Head h;
    h.bpm = sc.bpm > 0 ? sc.bpm : sc.preset.isObject() ? static_cast<double>(sc.preset.getProperty("bpm", 120)) : 120.0;
    p.setPlayHead(&h);
    if (auto* o = sc.preset.getProperty("knobs", juce::var()).getDynamicObject())
        for (const auto& kv : o->getProperties()) setParam(p, kv.name.toString().toRawUTF8(), static_cast<double>(kv.value));
    if (auto* o = sc.preset.getProperty("extra", juce::var()).getDynamicObject())
        for (const auto& kv : o->getProperties()) setParam(p, kv.name.toString().toRawUTF8(), static_cast<double>(kv.value));
    for (const auto& kv : sc.extra) setParam(p, kv.first.c_str(), kv.second);
    // v32 : QUALITY a trois crans (0 ECO, 0.5 STD, 1 HQ)
    setParam(p, "xQuality", quality * 0.5);
    setParam(p, "xEngine", engine);
    if (const char* e = std::getenv("MMARP_LATENCY")) setParam(p, "xLatency", std::strcmp(e, "exact") == 0 ? 0.0 : 1.0);
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
    const double sr = 48000;
    p.prepareToPlay(sr, block);
    juce::AudioBuffer<float> buf(2, block);
    juce::MidiBuffer midi;
    // une seconde de mise en route (la reverb, les queues), non comptee
    const int warm = static_cast<int>(sr) / block;
    const int blocks = static_cast<int>(seconds * sr) / block;
    h.playing = !sc.idle;
    Result r;
    r.hash = 1469598103934665603ull;
    double busy = 0;
    int counted = 0;
    const int lat0 = p.getLatencySamples();
    // MMARP_DUMP=dossier : la sortie (float32 G/D entrelaces) dans dossier/<scene>_<moteur><cran>_<bloc>.f32 (comparer deux
    // builds au bit pres, mesurer le son ; rien n'est joue)
    std::FILE* dump = nullptr;
    const bool hashOn = std::getenv("MMARP_HASH") != nullptr;
    if (const char* d = std::getenv("MMARP_DUMP")) {
        std::string nm = sc.name;
        for (char& ch : nm)
            if (!std::isalnum(static_cast<unsigned char>(ch))) ch = '_';
        const std::string path = std::string(d) + "/" + nm + "_" + (engine ? "p" : "c") + std::to_string(quality) + "_" + std::to_string(block) + ".f32";
        dump = std::fopen(path.c_str(), "wb");
    }
    for (int b = 0; b < warm + blocks; ++b) {
        const auto t0 = std::chrono::steady_clock::now();
        p.processBlock(buf, midi);
        const auto t1 = std::chrono::steady_clock::now();
        if (hashOn)
            for (int c = 0; c < 2; ++c)
                for (int i = 0; i < block; ++i) {
                    const float v = buf.getSample(c, i);
                    uint32_t u;
                    std::memcpy(&u, &v, 4);
                    for (int k = 0; k < 4; ++k) {
                        r.hash ^= (u >> (8 * k)) & 0xffu;
                        r.hash *= 1099511628211ull;
                    }
                }
        if (dump)
            for (int i = 0; i < block; ++i) {
                const float lr[2] = {buf.getSample(0, i), buf.getSample(1, i)};
                std::fwrite(lr, sizeof(float), 2, dump);
            }
        if (h.playing) h.ppq += block * h.bpm / 60.0 / sr;
        if (p.getLatencySamples() != lat0) r.latencyMoved = true;
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
    r.latency = p.getLatencySamples();
    if (dump) std::fclose(dump);
    return r;
}

std::vector<int> parseList(const std::string& s) {
    std::vector<int> v;
    std::stringstream ss(s);
    std::string t;
    while (std::getline(ss, t, ','))
        if (!t.empty()) v.push_back(std::atoi(t.c_str()));
    return v;
}

} // namespace

int main(int argc, char** argv) {
    juce::ScopedJuceInitialiser_GUI gui;
    const double seconds = argc > 1 ? std::atof(argv[1]) : 6.0;
    const std::string filter = argc > 2 ? argv[2] : "";
    // les crans de QUALITY a mesurer (argv[3], ex. "21" : HQ puis STD ; 2 HQ, 1 STD, 0 ECO)
    const std::string qs = argc > 3 ? argv[3] : "210";
    // v34 : le moteur (argv[4] : pro, classic, both ; par defaut pro)
    const std::string eng = argc > 4 ? argv[4] : "pro";
    std::vector<int> engines;
    if (eng == "both") engines = {0, 1};
    else engines = {eng == "classic" ? 0 : 1};
    const bool blocksGiven = argc > 5;
    const std::vector<int> blockList = blocksGiven ? parseList(argv[5]) : std::vector<int>{128};
    const int passes = argc > 6 ? std::max(1, std::atoi(argv[6])) : 1;
    std::vector<Scene> scenes;
    // v32 : le cas de Mika (58.jpg) : un RANDOM ARP retouche, arpege 1/16 UP/DN a 116 BPM, YOUR NOTES, release long (12 voix
    // sans limite), blocs de 256 ; la voix de la famille ARP (hypno.ts : OCTAVE -1, filtre moyen, un peu de FM, STACK et
    // WIDE, CHORUS I, DELAY et REVERB doses)
    {
        Scene m{"CAS DE MIKA", juce::var(), {{"rate", 2.0 / 3}, {"mode", 2.0 / 3}, {"range", 0.5}, {"gate", 0.67}, {"octave", 0.25}, {"cutoff", 0.45}, {"res", 0.35},
                                            {"envAmt", 0.45}, {"fm", 0.2}, {"stack", 0.3}, {"wide", 0.4}, {"aA", 0.0}, {"aD", 0.5}, {"aS", 0.6}, {"aR", 0.85},
                                            {"fD", 0.4}, {"fR", 0.6}, {"chorus", 1.0 / 3}, {"delay", 0.25}, {"reverb", 0.3}}};
        if (!blocksGiven) m.block = 256;
        m.bpm = 116;
        m.seq = R"({"edit":true,"len":8,"buf":[0,2,4,7,9,7,4,2,0,0,0,0,0,0,0,0],"has":true})";
        scenes.push_back(m);
    }
    scenes.push_back({"INIT", juce::var(), {}});
    const juce::File f = juce::File::getCurrentWorkingDirectory().getChildFile("plugin/mm-arp/presets/factory.json");
    const juce::var bank = juce::JSON::parse(f.loadFileAsString());
    if (auto* o = bank.getDynamicObject())
        if (auto* list = o->getProperties().getVarPointer("presets"))
            for (const auto& pr : *list->getArray()) {
                Scene s{pr.getProperty("name", "?").toString().toStdString(), pr, {}};
                s.bank = true;
                scenes.push_back(s);
            }
    // le pire cas : UNISON 7, accords, DISTO 3 bandes, DELAY RHYTHM, HELL plein, reverb HALL, SHIMMER, PHASER, FLANGER, CHORUS
    scenes.push_back({"PIRE CAS", juce::var(), {{"xUnison", 1.0}, {"stack", 1.0}, {"chord", 1.0}, {"notes", 1.0}, {"dist", 0.7}, {"xDStyle", 0.5}, {"xDBands", 1.0},
                                                {"xDlMode", 1.0}, {"delay", 0.6}, {"xHellMix", 1.0}, {"xSkyType", 0.25}, {"reverb", 0.6}, {"xShimmer", 0.6},
                                                {"xPhMix", 0.6}, {"xFlMix", 0.6}, {"chorus", 1.0}, {"xQ3Gain", 0.7}}});
    // v49 : les effets lourds engages sur INIT (le son de la face par defaut) : DISTO A avec PUNISH v2 et CLEAN LOW, HELL v2
    // THE DESCENT a MIX 100, REVERB HALL avec EQ, WIDTH et FREEZE, DELAY PING-PONG, WARMTH
    {
        Scene hv{"EFFETS LOURDS", juce::var(), {{"dist", 0.7}, {"xDStyle", 1.0 / 12}, {"xDPunish2", 1.0}, {"xDBands", 0.5}, {"xDB1Byp", 1.0}}};
        for (const auto& pr : kHell2Presets)
            if (std::strcmp(pr.name, "THE DESCENT") == 0)
                for (int k = 0; k < kHell2PresetKeys; ++k) hv.extra.push_back({kHell2PresetIds[k], pr.v[k]});
        for (const auto& kv : std::vector<std::pair<std::string, double>>{{"xHellMix", 1.0}, {"xSkyType", 2.0 / 12}, {"reverb", 0.6}, {"xSkyLoCut", 0.3}, {"xSkyMidDb", 0.7},
                                                                          {"xSkyHiCut", 0.7}, {"xSkyWidth", 0.8}, {"xSkyFreeze", 1.0}, {"delay", 0.5}, {"xDlMode", 0.5}, {"xWarmth", 0.5}})
            hv.extra.push_back(kv);
        scenes.push_back(hv);
        // et la DISTO seule (une bande, PUNISH v2) : son cout propre
        scenes.push_back({"DISTO SEULE", juce::var(), {{"dist", 0.7}, {"xDStyle", 1.0 / 12}, {"xDPunish2", 1.0}}});
        scenes.push_back({"DISTO 3 BANDES", juce::var(), {{"dist", 0.7}, {"xDStyle", 1.0 / 12}, {"xDBands", 1.0}}});
        scenes.push_back({"WARMTH SEULE", juce::var(), {{"xWarmth", 0.6}}});
    }
    // v50 : la matrice de l'encart LFO engagee (les emplacements xMx), sur INIT et sur le cas de Mika : 4 puis 8 emplacements,
    // chemins melanges (par voix : FILTER CUTOFF, PAN ; generiques, le rendu par tranches de 32 : DELAY FEEDBACK, OSC 2
    // LEVEL, MASTER WIDTH, PHASER RATE, EQ 3 GAIN, A ENV DECAY), les 4 LFO, une enveloppe, RANDOM, S&H, VELOCITY
    {
        const auto slot = [](int n, int src, const char* dst, double amt) {
            const std::string b = "xMx" + std::to_string(n);
            const int code = std::strncmp(dst, "m:", 2) == 0 ? std::atoi(dst + 2) : mmx::kModDstBase + mmx::allIndex(dst);
            return std::vector<std::pair<std::string, double>>{{b + "Src", src / 13.0}, {b + "Dst", code / 1023.0}, {b + "Amt", 0.5 + 0.5 * amt}};
        };
        std::vector<std::pair<std::string, double>> m4, m8;
        for (const auto& v : {slot(1, 6, "cutoff", 0.3), slot(2, 7, "xDlFb", 0.3), slot(3, 13, "osc2", -0.4), slot(4, 9, "xWidth", 0.5)}) m4.insert(m4.end(), v.begin(), v.end());
        m4.push_back({"xLfo2Sync", 0});
        m4.push_back({"xLfo4Sync", 0});
        m8 = m4;
        for (const auto& v : {slot(5, 12, "xPhRate", 0.4), slot(6, 11, "m:15", 0.6), slot(7, 10, "xQ3Gain", 0.3), slot(8, 1, "aD", 0.3)}) m8.insert(m8.end(), v.begin(), v.end());
        m8.push_back({"xQ3On", 1});
        for (const auto& base : {std::string("INIT"), std::string("CAS DE MIKA")}) {
            Scene b0;
            bool found = false;
            for (const auto& sc : scenes)
                if (sc.name == base) b0 = sc, found = true;
            if (!found) continue;
            for (int k : {4, 8}) {
                Scene s = b0;
                s.name = base + " + MOD " + std::to_string(k);
                s.bank = false;
                const auto& add = k == 4 ? m4 : m8;
                s.extra.insert(s.extra.end(), add.begin(), add.end());
                scenes.push_back(s);
            }
        }
    }
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
                b.bank = false;
                more.push_back(b);
            }
        scenes.insert(scenes.end(), more.begin(), more.end());
    }
    static const char* const QN[2][3] = {{"ECO", "STD", "HQ"}, {"pECO", "pSTD", "pHQ"}};
    std::printf("Banc CPU MM-ARP : 48 kHz, %.1f s par passage, meilleur de %d (aucun son joue) ; %% d'un coeur ; LAT : la latence declaree (ech.)\n\n", seconds,
                passes);
    std::printf("%-24s %4s %4s %7s %7s | %6s %6s %6s %6s %6s %6s %6s | %-10s | %s\n", "SCENE", "Q", "BLK", "TOTAL", "COMPT.", "MOTEUR", "DISTO", "DELAY", "REVERB", "HELL",
                "EQ+RCK", "RESTE", "VOIX", "LAT");
    struct Acc {
        double sum = 0, worst = 0;
        int n = 0;
        std::string worstName;
    };
    std::map<std::string, Acc> acc;
    for (const int engine : engines)
        for (const int blk : blockList)
            for (const auto& sc : scenes) {
                // (v50 : "=NOM" ne garde que la scene de ce nom exact ; sinon une partie du nom)
                if (!filter.empty() && (filter[0] == '=' ? sc.name != filter.substr(1) : sc.name.find(filter) == std::string::npos)) continue;
                for (char qc : qs) {
                    const int q = qc - '0';
                    if (q < 0 || q > 2) continue;
                    const int block = sc.block > 0 ? sc.block : blk;
                    Result best;
                    best.total = 1e9;
                    for (int ps = 0; ps < passes; ++ps) {
                        const Result r = play(sc, engine, q, block, seconds);
                        if (r.total < best.total) best = r;
                    }
                    const Result& r = best;
                    char vo[32];
                    std::snprintf(vo, sizeof vo, "%d / %.1f", r.voices, r.voicesAvg);
                    std::printf("%-24s %4s %4d %6.2f%% %6.2f%% | %6.2f %6.2f %6.2f %6.2f %6.2f %6.2f %6.2f | %-10s | %d%s\n", sc.name.c_str(), QN[engine][q], block, r.total,
                                r.stage[MMArpProcessor::kCpuTotal], r.stage[MMArpProcessor::kCpuEngine], r.stage[MMArpProcessor::kCpuDisto], r.stage[MMArpProcessor::kCpuDelay],
                                r.stage[MMArpProcessor::kCpuReverb], r.stage[MMArpProcessor::kCpuHell], r.stage[MMArpProcessor::kCpuEqRack], r.stage[MMArpProcessor::kCpuRest], vo,
                                r.latency, r.latencyMoved ? " (A BOUGE)" : "");
                    if (std::getenv("MMARP_HASH")) std::printf("HASH %s %s %d %016llx\n", sc.name.c_str(), QN[engine][q], block, static_cast<unsigned long long>(r.hash));
                    std::fflush(stdout);
                    if (sc.bank) {
                        char key[64];
                        std::snprintf(key, sizeof key, "%s blocs de %d", QN[engine][q], block);
                        Acc& a = acc[key];
                        a.sum += r.total;
                        a.n += 1;
                        if (r.total > a.worst) {
                            a.worst = r.total;
                            a.worstName = sc.name;
                        }
                    }
                }
            }
    std::printf("\n");
    for (const auto& kv : acc)
        std::printf("banque d'usine %-20s : moyenne %.2f %%, pire %.2f %% (%s)\n", kv.first.c_str(), kv.second.sum / kv.second.n, kv.second.worst, kv.second.worstName.c_str());
    return 0;
}
