// Le banc du processeur MM-ARP sans fenetre (2026-11-09) : le vrai MMArpProcessor (src/PluginProcessor.cpp, compile
// avec MMARP_HEADLESS=1) joue comme sous Ableton : un faux transport (ppq, tempo, lecture), un programme de la face,
// des notes MIDI, l'etat sauve puis recharge. Rien ne sort des enceintes : tout se verifie dans les buffers.
//   cmake -S plugin/mm-arp -B build-host -DMM_HOST_TEST=ON && cmake --build build-host -j && ./build-host/mmarp_host_test
#include "PluginProcessor.h"

#include <cmath>
#include <cstdio>
#include <string>

namespace {

int failures = 0;
void check(bool ok, const std::string& what) {
    std::printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
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

// Le programme v2 de la face (src/v4/plugin/arp/bridge.ts) : la suite AUTO, une progression F#m D, les potards du site
// par defaut (seulement pris par une instance neuve)
juce::String program(const char* prog = "[0,5]", const char* knobs = "{}") {
    return juce::String(R"({"v":2,"kind":"arp","bpm":123,"swing":0,"seq":{"edit":false,"len":8,"buf":[0,2,4,null,7,4,2,0,0,0,0,0,0,0,0,0]},"prog":)") + prog +
           R"(,"knobs":)" + knobs + "}";
}

struct Stats {
    double peak = 0, rms = 0;
    bool finite = true;
};

// n echantillons par blocs de block ; le transport avance si playing
Stats run(MMArpProcessor& p, Head& h, int n, int block, juce::MidiBuffer* first = nullptr, std::vector<float>* keepL = nullptr) {
    Stats s;
    juce::AudioBuffer<float> buf(2, block);
    double sum = 0;
    int done = 0;
    while (done < n) {
        const int m = std::min(block, n - done);
        buf.setSize(2, m, false, false, true);
        juce::MidiBuffer midi;
        if (first && done == 0) midi = *first;
        p.processBlock(buf, midi);
        for (int c = 0; c < 2; ++c)
            for (int i = 0; i < m; ++i) {
                const float v = buf.getSample(c, i);
                if (!std::isfinite(v)) s.finite = false;
                s.peak = std::max(s.peak, static_cast<double>(std::fabs(v)));
                sum += static_cast<double>(v) * v;
                if (keepL && c == 0) keepL->push_back(v);
            }
        if (h.playing) h.ppq += m * h.bpm / 60.0 / 48000.0;
        done += m;
    }
    s.rms = std::sqrt(sum / std::max(1, 2 * n));
    return s;
}

double db(double x) { return 20 * std::log10(std::max(x, 1e-12)); }

} // namespace

int main() {
    juce::ScopedJuceInitialiser_GUI init;
    {
        MMArpProcessor p;
        Head h;
        p.setPlayHead(&h);
        p.prepareToPlay(48000, 512);
        check(p.getLatencySamples() >= 128 + 19, "latence declaree (blocs de 128 + decimateurs) : " + juce::String(p.getLatencySamples()).toStdString());
        // Sans programme, transport arrete : silence
        Stats s = run(p, h, 48000, 512);
        check(s.finite && s.peak <= 0, "sans programme : silence");
        p.faceProgram(program("[0,5]", R"({"cutoff":0.5,"delay":0.3,"reverb":0.25,"chorus":0.5})"));
        check(p.knobsKnown() && std::fabs(p.knobParam(mmarp::knobIndex("cutoff"))->getValue() - 0.5f) < 1e-6f, "instance neuve : les potards de la face deviennent les parametres");
        s = run(p, h, 24000, 512);
        check(s.finite && s.peak <= 0, "programme, Ableton arrete : silence (pas de RUN)");
        // Ableton joue : l'arpege
        h.playing = true;
        h.ppq = 0;
        s = run(p, h, 48000 * 4, 512);
        check(s.finite && s.peak > 0.01 && s.peak < 1.0, "Ableton joue : l'arpege sonne (crete " + juce::String(db(s.peak), 1).toStdString() + " dBFS, rms " + juce::String(db(s.rms), 1).toStdString() + " dBFS)");
        const auto fb = p.feedback();
        check(fb.playing && fb.chord >= 0 && fb.len > 0 && fb.seq > 0, "la face recoit la note jouee (accord " + juce::String(fb.chord).toStdString() + ", pas " + juce::String(fb.pos).toStdString() + "/" + juce::String(fb.len).toStdString() + ")");
        // L'automation d'un potard (fenetre fermee) change le son : CUTOFF ferme
        {
            auto* cut = p.knobParam(mmarp::knobIndex("cutoff"));
            const Stats open = run(p, h, 48000, 512);
            cut->setValueNotifyingHost(0.05f);
            const Stats shut = run(p, h, 48000, 512);
            cut->setValueNotifyingHost(0.5f);
            check(shut.rms < open.rms * 0.5, "automation de CUTOFF sans la face : le son se ferme (" + juce::String(db(open.rms), 1).toStdString() + " -> " + juce::String(db(shut.rms), 1).toStdString() + " dBFS)");
            char txt[64];
            mmarp::knobText(mmarp::knobIndex("rate"), 2.0 / 3, txt, 64);
            check(cut->getText(0.5f, 32).isNotEmpty() && juce::String(txt) == "1/16", "le texte des parametres (RATE : " + juce::String(txt).toStdString() + ")");
            check(p.getParameters().size() == mmarp::kKnobs + 2, "les potards du site en parametres de l'hote : " + juce::String(p.getParameters().size()).toStdString());
        }
        // STOP : la queue s'eteint (reverb comprise) sous -80 dB en 4 s
        h.playing = false;
        run(p, h, 48000 * 4, 512);
        s = run(p, h, 4800, 512);
        check(s.finite && s.peak < 1e-4, "STOP : silence apres la queue (" + juce::String(db(s.peak), 1).toStdString() + " dBFS)");
        // RUN de la face, Ableton arrete : horloge interne
        p.faceRun(true);
        s = run(p, h, 48000 * 2, 512);
        check(s.peak > 0.01 && p.feedback().internal, "RUN de la face : l'horloge interne joue");
        p.faceRun(false);
        run(p, h, 48000 * 4, 512);
        // MIDI : une note tenue joue le synthe, sans l'arpege (progression vide)
        p.faceProgram(program("[]"));
        run(p, h, 4800, 512);
        juce::MidiBuffer on;
        on.addEvent(juce::MidiMessage::noteOn(1, 57, static_cast<juce::uint8>(100)), 10);
        s = run(p, h, 48000, 512, &on);
        check(s.finite && s.peak > 0.01, "une note MIDI tenue sonne (" + juce::String(db(s.peak), 1).toStdString() + " dBFS)");
        juce::MidiBuffer off;
        off.addEvent(juce::MidiMessage::noteOff(1, 57), 0);
        run(p, h, 48000 * 4, 512, &off);
        s = run(p, h, 4800, 512);
        check(s.peak < 1e-4, "note-off : la note s'eteint");
        // L'etat du projet : sauve puis recharge dans un autre processeur, il joue sans fenetre
        p.faceProgram(program());
        p.faceState(R"({"mm.v4.voyager.1":"{}"})");
        juce::MemoryBlock mb;
        run(p, h, 512, 512);
        p.getStateInformation(mb);
        MMArpProcessor q;
        Head h2;
        q.setPlayHead(&h2);
        q.setStateInformation(mb.getData(), static_cast<int>(mb.getSize()));
        q.prepareToPlay(48000, 256);
        check(q.faceInitState().contains("mm.v4.voyager.1"), "l'etat de la face revient a la face");
        check(q.knobsKnown() && std::fabs(q.knobParam(mmarp::knobIndex("cutoff"))->getValue() - 0.5f) < 1e-6f, "les parametres reviennent avec le projet");
        h2.playing = true;
        s = run(q, h2, 48000 * 2, 256);
        check(s.peak > 0.01, "projet recharge : il joue fenetre fermee");
    }
    {
        // Un projet de la premiere version (sans parametres) : les potards, la suite et la progression de l'etat de la face
        juce::ValueTree st("MMARP1");
        st.setProperty("master", 0.0, nullptr);
        st.setProperty("arp", true, nullptr);
        st.setProperty("seed", 7, nullptr);
        const juce::String vk = R"({"v":1,"knobs":{"cutoff":0.3,"rate":0.34}})";
        juce::DynamicObject::Ptr lso = new juce::DynamicObject();
        lso->setProperty("mm.v4.voyager.1", vk);
        lso->setProperty("mm.v4.plugin.arp.prog", "[2]");
        juce::DynamicObject::Ptr top = new juce::DynamicObject();
        top->setProperty("ls", juce::var(lso.get()));
        st.setProperty("ls", juce::JSON::toString(juce::var(top.get())), nullptr);
        juce::MemoryBlock mb;
        juce::AudioProcessor::copyXmlToBinary(*st.createXml(), mb);
        MMArpProcessor p;
        Head h;
        p.setPlayHead(&h);
        p.setStateInformation(mb.getData(), static_cast<int>(mb.getSize()));
        p.prepareToPlay(48000, 512);
        check(std::fabs(p.knobParam(mmarp::knobIndex("cutoff"))->getValue() - 0.3f) < 1e-6f && std::fabs(p.knobParam(mmarp::knobIndex("rate"))->getValue() - 0.34f) < 1e-6f,
              "projet de la premiere version : ses potards repris");
        h.playing = true;
        const Stats s = run(p, h, 48000 * 2, 512);
        check(s.peak > 0.01, "projet de la premiere version : sa progression joue");
    }
    {
        // Le meme passage joue deux fois (une boucle d'Ableton, un export) : le meme son, quels que soient les blocs
        auto render = [](int block) {
            MMArpProcessor p;
            Head h;
            p.setPlayHead(&h);
            juce::MemoryBlock mb;
            p.getStateInformation(mb);
            juce::ValueTree st = juce::ValueTree::fromXml(*juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize())));
            st.setProperty("seed", 12345, nullptr);
            st.setProperty("program", program(), nullptr);
            juce::MemoryBlock m2;
            juce::AudioProcessor::copyXmlToBinary(*st.createXml(), m2);
            p.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
            p.prepareToPlay(48000, block);
            h.playing = true;
            std::vector<float> L;
            run(p, h, 48000 * 3, block, nullptr, &L);
            return L;
        };
        const auto a = render(512), b = render(77), c = render(512);
        double d1 = 0, d2 = 0, pk = 0;
        for (size_t i = 0; i < a.size() && i < b.size() && i < c.size(); ++i) {
            d1 = std::max(d1, static_cast<double>(std::fabs(a[i] - c[i])));
            d2 = std::max(d2, static_cast<double>(std::fabs(a[i] - b[i])));
            pk = std::max(pk, static_cast<double>(std::fabs(a[i])));
        }
        check(pk > 0.01 && d1 <= 0, "meme graine, meme passage : identique au bit pres");
        check(db(d2 / pk) < -100, "blocs de 512 contre 77 : ecart " + juce::String(db(d2 / pk), 1).toStdString() + " dB");
    }
    std::printf(failures ? "%d echec(s)\n" : "tout passe\n", failures);
    return failures ? 1 : 0;
}
