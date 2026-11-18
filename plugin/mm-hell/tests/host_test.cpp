// MM-HELL, le banc du processeur (le vrai MMHellProcessor, sans fenetre ni son) : joue comme sous Ableton, des buffers.
// Reglages par defaut, MIX 0 au bit pres, programmes, etat du projet, note MIDI, entree mono, blocs, textes pour l'hote.
//   cmake -S plugin/mm-hell -B build-host -DMM_HOST_TEST=ON && cmake --build build-host --target mmhell_host_test
#include "PluginProcessor.h"

#include <cmath>
#include <cstdio>
#include <vector>

static int fails = 0;
static void check(bool ok, const char* what) {
    std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what);
    if (!ok) ++fails;
}

static const double SR = 48000;

static void prepare(MMHellProcessor& p, int inCh = 2) {
    p.setPlayConfigDetails(inCh, 2, SR, 512);
    p.prepareToPlay(SR, 512);
}

static void setParam(MMHellProcessor& p, const char* id, float value) {
    auto* prm = p.apvts.getParameter(id);
    prm->setValueNotifyingHost(prm->convertTo0to1(value));
}

static std::vector<float> noise(size_t n, uint32_t seed) {
    std::vector<float> x(n);
    for (auto& v : x) {
        seed = seed * 1664525u + 1013904223u;
        v = static_cast<float>(((seed >> 8) / 16777216.0 - 0.5) * 0.8);
    }
    return x;
}

// Joue L / R par blocs de `block`, avec un MidiBuffer (vide sauf note)
static void play(MMHellProcessor& p, std::vector<float>& L, std::vector<float>& R, int block, int noteOn = -1) {
    juce::MidiBuffer midi;
    for (size_t i = 0; i < L.size(); i += static_cast<size_t>(block)) {
        const int n = static_cast<int>(std::min<size_t>(static_cast<size_t>(block), L.size() - i));
        juce::AudioBuffer<float> b(2, n);
        b.copyFrom(0, 0, L.data() + i, n);
        b.copyFrom(1, 0, R.data() + i, n);
        midi.clear();
        if (noteOn >= 0 && i == 0) midi.addEvent(juce::MidiMessage::noteOn(1, noteOn, 0.8f), 0);
        p.processBlock(b, midi);
        std::copy(b.getReadPointer(0), b.getReadPointer(0) + n, L.begin() + static_cast<long>(i));
        std::copy(b.getReadPointer(1), b.getReadPointer(1) + n, R.begin() + static_cast<long>(i));
    }
}

int main() {
    juce::ScopedJuceInitialiser_GUI init;
    const size_t N = static_cast<size_t>(SR * 2);
    const auto nL = noise(N, 1), nR = noise(N, 2);

    // 1. a l'ouverture : INIT, MIX 35 %, 22 parametres, le programme INIT, stereo et mono acceptes
    {
        MMHellProcessor p;
        prepare(p);
        const bool ok = mmhell::match(p.patch()) == mmhell::initIndex() && std::fabs(p.mix() - 0.35f) < 1e-6f && p.getParameters().size() == 22 &&
                        p.getCurrentProgram() == mmhell::initIndex() && p.getNumPrograms() == 72 && p.getProgramName(0) == "SLOW ASCENT";
        juce::AudioProcessor::BusesLayout mono;
        mono.inputBuses.add(juce::AudioChannelSet::mono());
        mono.outputBuses.add(juce::AudioChannelSet::stereo());
        juce::AudioProcessor::BusesLayout bad;
        bad.inputBuses.add(juce::AudioChannelSet::stereo());
        bad.outputBuses.add(juce::AudioChannelSet::mono());
        check(ok && p.checkBusesLayoutSupported(mono) && !p.checkBusesLayoutSupported(bad), "ouverture : INIT, MIX 35 %, 22 parametres, 72 programmes, entree mono ou stereo");
    }
    // 2. MIX 0 : le signal passe au bit pres, meme tout pousse
    {
        MMHellProcessor p;
        prepare(p);
        p.setCurrentProgram(4); // ABYSS
        setParam(p, pid::feedback, 1);
        setParam(p, pid::cross, 1);
        setParam(p, pid::smear, 1);
        setParam(p, pid::mix, 0);
        auto L = nL, R = nR;
        play(p, L, R, 512);
        check(L == nL && R == nR && std::isnan(p.lfo()), "MIX 0 : sortie = entree au bit pres (ABYSS, FEEDBACK 1, CROSS, SMEAR 1), VU eteint");
    }
    // 3. un programme regle tout sauf MIX ; a MIX 0 il le met a 35 % ; reposer le programme courant ne change rien
    {
        MMHellProcessor p;
        prepare(p);
        setParam(p, pid::mix, 0.8f);
        p.setCurrentProgram(0);
        const bool a = mmhell::match(p.patch()) == 0 && std::fabs(p.mix() - 0.8f) < 1e-6f;
        setParam(p, pid::mix, 0);
        p.setCurrentProgram(16); // PURGATORY LOOP
        const bool b = mmhell::match(p.patch()) == 16 && std::fabs(p.mix() - 0.35f) < 1e-6f;
        setParam(p, pid::feedback, 0.33f);
        p.setCurrentProgram(16);
        const bool c = std::fabs(p.patch().feedback - 0.33) < 1e-6;
        check(a && b && c, "programmes : SLOW ASCENT garde MIX 80 %, a MIX 0 -> 35 %, le programme courant repose ne touche pas aux reglages");
    }
    // 4. l'etat du projet : les reglages, MIX, la taille de la fenetre, le programme
    {
        MMHellProcessor a;
        prepare(a);
        a.setCurrentProgram(19); // EMBER DRIFT
        setParam(a, pid::smear, 0.61f);
        setParam(a, pid::mix, 0.42f);
        a.setEditorWidth(1640);
        juce::MemoryBlock st;
        a.getStateInformation(st);
        MMHellProcessor b;
        prepare(b);
        b.setStateInformation(st.getData(), static_cast<int>(st.getSize()));
        const auto pa = a.patch(), pb = b.patch();
        const bool ok = mmhell::same(pa, pb) && std::fabs(pb.smear - 0.61) < 1e-6 && std::fabs(b.mix() - 0.42f) < 1e-6f && b.editorWidth() == 1640 &&
                        b.getCurrentProgram() == 19;
        b.setCurrentProgram(19); // l'hote repose le programme a la reouverture
        check(ok && std::fabs(b.patch().smear - 0.61) < 1e-6, "etat : reglages, MIX, taille de la fenetre et programme rouverts ; le programme repose ne les ecrase pas");
    }
    // 5. RANGE MIDI : la derniere note recue fixe le decalage ; les blocs (64 et 1000) donnent la meme sortie au bit pres
    {
        std::vector<float> out[2][2];
        int k = 0;
        for (int block : {64, 1000}) {
            MMHellProcessor p;
            prepare(p);
            p.setCurrentProgram(20); // NOTE GHOST
            setParam(p, pid::mix, 0.7f);
            auto L = nL, R = nR;
            play(p, L, R, block, 57); // A2 = 220 Hz
            out[k][0] = L;
            out[k][1] = R;
            ++k;
            if (block == 64) check(std::fabs(p.noteHz() - 220.0) < 1e-9 && std::fabs(p.bpm() - 120.0) < 1e-9 && !std::isnan(p.lfo()), "MIDI : note 57 -> 220 Hz ; sans tempo de l'hote, 120 BPM ; VU allume");
        }
        bool fin = true;
        for (float v : out[0][0]) fin = fin && std::isfinite(v);
        check(fin && out[0][0] == out[1][0] && out[0][1] == out[1][1], "blocs de 64 et de 1000 echantillons : meme sortie au bit pres");
    }
    // 6. entree mono : la droite recoit la gauche (rien de ce qui trainait dans le canal droit)
    {
        MMHellProcessor m, s;
        prepare(m, 1);
        prepare(s, 2);
        for (auto* p : {&m, &s}) {
            p->setCurrentProgram(5); // CROOKED PONG
            setParam(*p, pid::mix, 0.6f);
        }
        auto L1 = nL, R1 = nR; // le canal droit "sale" en mono
        auto L2 = nL, R2 = nL;
        play(m, L1, R1, 256);
        play(s, L2, R2, 256);
        check(L1 == L2 && R1 == R2, "entree mono : comme une stereo dont les deux canaux sont la gauche");
    }
    // 7. les textes pour l'hote
    {
        MMHellProcessor p;
        prepare(p);
        auto txt = [&](const char* id) { return p.apvts.getParameter(id)->getCurrentValueAsText(); };
        p.setCurrentProgram(0);
        const bool a = txt(pid::shift) == "+35.0 HZ" && txt(pid::note) == "1/4" && txt(pid::feedback) == "72 %" && txt(pid::mix) == "35 %";
        p.setCurrentProgram(16);
        const bool b = txt(pid::shift) == "+1 / BEAT" && txt(pid::range) == "SYNC" && txt(pid::lp) == "7.00 KHZ";
        p.setCurrentProgram(23);
        const bool c = txt(pid::lfoAmt) == "-90 %" && txt(pid::lfoNote) == "1 BAR" && txt(pid::lfoTarget) == "LOW-PASS" && txt(pid::antiRefl) == "ON";
        check(a && b && c, "textes : +35.0 HZ, 1/4, 72 %, +1 / BEAT, 7.00 KHZ, -90 %, 1 BAR, LOW-PASS, ON");
    }
    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "OK", fails, fails > 1 ? "s" : "");
    return fails ? 1 : 0;
}
