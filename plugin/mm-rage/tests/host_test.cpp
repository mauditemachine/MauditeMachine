// MM-RAGE, le banc du processeur (le vrai MMRageProcessor, sans fenetre ni son) : joue comme sous Ableton, des buffers.
// Ouverture (INIT), la table des parametres, MIX 0 (le sec retarde au bit pres), la latence, les programmes, l'etat du
// projet, l'entree mono, les blocs, le tempo, les textes pour l'hote.
//   cmake -S plugin/mm-rage -B build-host -DMM_HOST_TEST=ON && cmake --build build-host --target mmrage_host_test
#include "PluginProcessor.h"

#include <cmath>
#include <cstdio>
#include <set>
#include <vector>

static int fails = 0;
static void check(bool ok, const char* what) {
    std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what);
    if (!ok) ++fails;
}

static const double SR = 48000;

static void prepare(MMRageProcessor& p, int inCh = 2, int block = 512) {
    p.setPlayConfigDetails(inCh, 2, SR, block);
    p.prepareToPlay(SR, block);
}

static void setParam(MMRageProcessor& p, const std::string& id, float value) {
    auto* prm = p.apvts.getParameter(id);
    prm->setValueNotifyingHost(prm->convertTo0to1(value));
}

static std::vector<float> noise(size_t n, uint32_t seed, double amp = 0.8) {
    std::vector<float> x(n);
    for (auto& v : x) {
        seed = seed * 1664525u + 1013904223u;
        v = static_cast<float>(((seed >> 8) / 16777216.0 - 0.5) * amp);
    }
    return x;
}

// Joue L / R par blocs de `block`
static void play(MMRageProcessor& p, std::vector<float>& L, std::vector<float>& R, int block) {
    juce::MidiBuffer midi;
    for (size_t i = 0; i < L.size(); i += static_cast<size_t>(block)) {
        const int n = static_cast<int>(std::min<size_t>(static_cast<size_t>(block), L.size() - i));
        juce::AudioBuffer<float> b(2, n);
        b.copyFrom(0, 0, L.data() + i, n);
        b.copyFrom(1, 0, R.data() + i, n);
        p.processBlock(b, midi);
        std::copy(b.getReadPointer(0), b.getReadPointer(0) + n, L.begin() + static_cast<long>(i));
        std::copy(b.getReadPointer(1), b.getReadPointer(1) + n, R.begin() + static_cast<long>(i));
    }
}

int main() {
    juce::ScopedJuceInitialiser_GUI init;
    const size_t N = static_cast<size_t>(SR * 2);
    const auto nL = noise(N, 1), nR = noise(N, 2);
    const auto& bank = mmrage::factory();

    // 1. a l'ouverture : INIT, 54 parametres, 85 programmes, la latence, stereo et mono acceptes
    {
        MMRageProcessor p;
        prepare(p);
        const bool ok = mmrage::match(p.patch()) == mmrage::initIndex() && p.getParameters().size() == 54 && p.getCurrentProgram() == mmrage::initIndex() &&
                        p.getNumPrograms() == static_cast<int>(bank.size()) && p.getProgramName(0) == "INIT" && p.getProgramName(1) == "WARM GLUE" &&
                        p.getLatencySamples() == mmarp::Decap::kLatency;
        juce::AudioProcessor::BusesLayout mono;
        mono.inputBuses.add(juce::AudioChannelSet::mono());
        mono.outputBuses.add(juce::AudioChannelSet::stereo());
        juce::AudioProcessor::BusesLayout bad;
        bad.inputBuses.add(juce::AudioChannelSet::stereo());
        bad.outputBuses.add(juce::AudioChannelSet::mono());
        check(ok && p.checkBusesLayoutSupported(mono) && !p.checkBusesLayoutSupported(bad),
              "ouverture : INIT, 54 parametres, 85 programmes, 32 echantillons de latence, entree mono ou stereo");
    }
    // 2. la table : chaque reglage d'un patch passe par son parametre et revient tel quel (tous les presets)
    {
        MMRageProcessor p;
        prepare(p);
        bool ok = true;
        std::set<std::string> ids;
        for (const auto& f : MMRageProcessor::fields()) ids.insert(f.id);
        for (size_t i = 0; i < bank.size(); ++i) {
            p.loadPreset(static_cast<int>(i));
            if (mmrage::match(p.patch()) != static_cast<int>(i) || p.getCurrentProgram() != static_cast<int>(i)) ok = false;
        }
        check(ok && ids.size() == 54, "les 85 presets : charges dans les parametres, relus a l'identique (ids uniques)");
    }
    // 3. MIX 0 : le sec retarde de 32 echantillons au bit pres, meme tout pousse ; DRIVE 0 : toujours 32 de retard
    {
        MMRageProcessor p;
        prepare(p);
        p.loadPreset(19); // MELTDOWN
        setParam(p, pid::mix, 0);
        setParam(p, pid::out, 0.5f); // OUTPUT 0 dB (MELTDOWN : -6)
        auto L = nL, R = nR;
        for (int k = 0; k < 2; ++k) {
            L = nL;
            R = nR;
            play(p, L, R, 512);
        }
        double err = 0;
        for (size_t i = 4800; i < N; ++i) err = std::max({err, std::fabs(double(L[i]) - nL[i - 32]), std::fabs(double(R[i]) - nR[i - 32])});
        check(err == 0, "MIX 0, OUTPUT 0 dB (MELTDOWN, tout pousse) : le sec retarde de 32 echantillons, au bit pres");
        setParam(p, pid::mix, 1);
        setParam(p, pid::drive, 0);
        check(p.getLatencySamples() == 32 && mmrage::settingsOf(p.patch(), 120).drive > 0, "DRIVE 0 : le DSP reste en circuit, la latence ne bouge pas");
    }
    // 4. le meme son par blocs de 64 ou de 1000 (le DSP lisse tout a l'echantillon)
    {
        MMRageProcessor a, b;
        prepare(a, 2, 64);
        prepare(b, 2, 1000);
        a.loadPreset(5); // TRIODE BLOOM : trois bandes, MORPH, LFO, FEEDBACK, filtres, BOX
        b.loadPreset(5);
        auto L1 = nL, R1 = nR, L2 = nL, R2 = nR;
        play(a, L1, R1, 64);
        play(b, L2, R2, 1000);
        double err = 0;
        for (size_t i = 0; i < N; ++i) err = std::max(err, std::fabs(double(L1[i]) - L2[i]));
        check(err < 1e-6, "TRIODE BLOOM : la sortie ne depend pas de la taille des blocs");
    }
    // 5. une entree mono : la meme a droite
    {
        MMRageProcessor p;
        prepare(p, 1);
        auto L = nL, R = std::vector<float>(N, 0.f);
        juce::MidiBuffer midi;
        juce::AudioBuffer<float> b(2, 512);
        b.clear();
        b.copyFrom(0, 0, L.data(), 512);
        p.processBlock(b, midi);
        double d = 0;
        for (int i = 0; i < 512; ++i) d = std::max(d, std::fabs(double(b.getSample(0, i)) - b.getSample(1, i)));
        check(d == 0, "entree mono : les deux canaux identiques");
    }
    // 6. l'etat du projet : les reglages, le programme, la taille de la fenetre, la page
    {
        MMRageProcessor p;
        prepare(p);
        p.loadPreset(40); // une basse
        setParam(p, pid::drive, 0.77f);
        p.setEditorWidth(1500);
        p.setPage(2);
        juce::MemoryBlock mb;
        p.getStateInformation(mb);
        MMRageProcessor q;
        prepare(q);
        q.setStateInformation(mb.getData(), static_cast<int>(mb.getSize()));
        check(mmrage::same(p.patch(), q.patch()) && q.getCurrentProgram() == 40 && q.editorWidth() == 1500 && q.page() == 2,
              "etat du projet : reglages, programme, taille de la fenetre et page retrouves");
        // un hote qui repose le programme courant ne change rien
        q.setCurrentProgram(40);
        check(std::fabs(q.patch().drive - 0.77) < 1e-6, "setCurrentProgram du programme courant : les reglages restent");
    }
    // 7. le tempo de l'hote (LFO SYNC) et l'ATTITUDE
    {
        MMRageProcessor p;
        prepare(p);
        p.loadPreset(18); // WOBBLE GRIT : LFO 1/8
        auto L = nL, R = nR;
        play(p, L, R, 512);
        const float a = p.attitudeDb();
        check(std::fabs(p.bpm() - 120) < 1e-9 && a > -60 && a < 20, "sans tete de lecture : 120 BPM ; ATTITUDE lue (le niveau dans la saturation)");
    }
    // 8. les textes pour l'hote
    {
        MMRageProcessor p;
        prepare(p);
        auto* d = p.apvts.getParameter(pid::drive);
        setParam(p, pid::drive, 0.5f);
        const juce::String t1 = d->getCurrentValueAsText();
        setParam(p, pid::punish, 1);
        const juce::String t2 = d->getCurrentValueAsText();
        auto* low = p.apvts.getParameter(pid::low);
        auto* st = p.apvts.getParameter(pid::style);
        auto* bs = p.apvts.getParameter(pid::band(0, "Style"));
        setParam(p, pid::style, 6);
        check(t1 == "+18.0 DB" && t2 == "+38.0 DB" && low->getCurrentValueAsText() == "OFF" && st->getCurrentValueAsText() == "FUZZ" &&
                  bs->getCurrentValueAsText() == "MAIN" && p.apvts.getParameter(pid::bands)->getCurrentValueAsText() == "1",
              "textes : DRIVE (et PUNISH), LOW CUT OFF, STYLE FUZZ, LOW STYLE MAIN, BANDS 1");
    }

    std::printf(fails ? "\n%d ECHEC(S)\n" : "\nTOUT PASSE\n", fails);
    return fails ? 1 : 0;
}
