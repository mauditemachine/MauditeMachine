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
            check(shut.rms < open.rms * 0.7, "automation de CUTOFF sans la face : le son se ferme (" + juce::String(db(open.rms), 1).toStdString() + " -> " + juce::String(db(shut.rms), 1).toStdString() + " dBFS)");
            char txt[64];
            mmarp::knobText(mmarp::knobIndex("rate"), 2.0 / 3, txt, 64);
            check(cut->getText(0.5f, 32).isNotEmpty() && juce::String(txt) == "1/16", "le texte des parametres (RATE : " + juce::String(txt).toStdString() + ")");
            check(p.getParameters().size() == mmx::kAll + 3, "les potards du site en parametres de l'hote : " + juce::String(p.getParameters().size()).toStdString());
        }
        // DRAG MIDI : l'arpege en clip (F#m D, 2 mesures, 1/16 : 16 pas par mesure, 2 silences sur 8 dans la suite)
        {
            int bars = 0;
            const juce::MidiFile mf = p.arpMidi(1, bars);
            const auto* tr = mf.getNumTracks() > 0 ? mf.getTrack(0) : nullptr;
            int ons = 0, offs = 0, maxEnd = 0, firstNote = -1;
            bool velOk = true;
            if (tr)
                for (const auto* ev : *tr) {
                    if (ev->message.isNoteOn()) {
                        if (firstNote < 0) firstNote = ev->message.getNoteNumber();
                        ++ons;
                        velOk = velOk && ev->message.getVelocity() >= 1;
                    }
                    if (ev->message.isNoteOff()) {
                        ++offs;
                        maxEnd = std::max(maxEnd, static_cast<int>(ev->message.getTimeStamp()));
                    }
                }
            check(bars == 2 && ons > 20 && ons == offs && velOk && maxEnd <= 2 * 4 * 960, "DRAG MIDI : " + juce::String(ons).toStdString() + " notes sur " + juce::String(bars).toStdString() + " mesures, dans le clip");
            int bars4 = 0;
            const juce::MidiFile m4 = p.arpMidi(4, bars4);
            check(bars4 == 8 && m4.getNumTracks() == 1 && m4.getTrack(0)->getNumEvents() > tr->getNumEvents() * 3, "DRAG MIDI x4 : la progression 4 fois");
            const juce::File f = p.arpMidiFile(1);
            check(f.existsAsFile() && f.getSize() > 100, "le fichier MIDI a glisser : " + f.getFileName().toStdString());
            f.deleteFile();
        }
        // SOUND+ (le VST3 seul) : QUALITY STD / HQ, le LFO 2, le master
        {
            auto X = [&](const char* id) { return p.knobParam(mmx::allIndex(id)); };
            const Stats hq = run(p, h, 48000, 512);
            X("xQuality")->setValueNotifyingHost(0.f);
            run(p, h, 24000, 512);
            const Stats stdq = run(p, h, 48000, 512);
            X("xQuality")->setValueNotifyingHost(1.f);
            run(p, h, 24000, 512);
            check(hq.finite && stdq.finite && std::fabs(db(hq.rms) - db(stdq.rms)) < 1.5, "QUALITY : HQ (x8) et STD (x4) au meme niveau (" + juce::String(db(hq.rms), 1).toStdString() + " / " + juce::String(db(stdq.rms), 1).toStdString() + " dBFS)");
            // LFO 2 sur AMP, plein : le niveau baisse (tremolo)
            X("xLfo2Dest")->setValueNotifyingHost(6.f / 14.f);
            X("xLfo2Depth")->setValueNotifyingHost(1.f);
            run(p, h, 4800, 512);
            const Stats trem = run(p, h, 48000, 512);
            X("xLfo2Dest")->setValueNotifyingHost(0.f);
            run(p, h, 4800, 512);
            check(trem.finite && trem.rms < hq.rms * 0.9, "LFO 2 sur AMP : tremolo (" + juce::String(db(hq.rms), 1).toStdString() + " -> " + juce::String(db(trem.rms), 1).toStdString() + " dBFS)");
            // WIDTH a 0 : mono
            X("xWidth")->setValueNotifyingHost(0.f);
            run(p, h, 9600, 512);
            juce::AudioBuffer<float> b(2, 512);
            juce::MidiBuffer mb;
            double diff = 0;
            for (int k = 0; k < 40; ++k) {
                p.processBlock(b, mb);
                h.ppq += 512 * h.bpm / 60.0 / 48000.0;
                for (int i = 0; i < 512; ++i) diff = std::max(diff, static_cast<double>(std::fabs(b.getSample(0, i) - b.getSample(1, i))));
            }
            X("xWidth")->setValueNotifyingHost(0.5f);
            X("xWarmth")->setValueNotifyingHost(1.f);
            X("xBass")->setValueNotifyingHost(1.f);
            X("xAir")->setValueNotifyingHost(1.f);
            const Stats m = run(p, h, 48000, 512);
            X("xWarmth")->setValueNotifyingHost(0.f);
            X("xBass")->setValueNotifyingHost(0.5f);
            X("xAir")->setValueNotifyingHost(0.5f);
            run(p, h, 9600, 512);
            check(diff < 1e-5 && m.finite && m.peak < 1.5, "MASTER : WIDTH 0 = mono, WARMTH + BASS + AIR sans debordement");
            check(X("xRevSize")->getText(0.5f, 32) == "2.4 s" && X("xLfo2Rate")->getText(8.f / 13.f, 32) == "1/4", "le texte des reglages SOUND+");
        }
        // MIDI LEARN : CUTOFF arme, le CC 74 du canal 2 l'assigne et le pilote
        {
            p.learn("cutoff");
            juce::MidiBuffer cc;
            cc.addEvent(juce::MidiMessage::controllerEvent(2, 74, 0), 0);
            run(p, h, 512, 512, &cc);
            const juce::var map = p.midiMap();
            const juce::var list = map.getProperty("items", juce::var());
            const auto* items = list.getArray();
            const bool mapped = items && items->size() == 1 && static_cast<int>((*items)[0].getProperty("cc", -1)) == 74 && static_cast<int>((*items)[0].getProperty("ch", -1)) == 2;
            juce::MidiBuffer cc2;
            cc2.addEvent(juce::MidiMessage::controllerEvent(2, 74, 127), 0);
            run(p, h, 512, 512, &cc2);
            check(mapped && std::fabs(p.knobParam(mmarp::knobIndex("cutoff"))->getValue() - 1.f) < 1e-6f && p.midiMap().getProperty("learn", "x").toString().isEmpty(), "MIDI LEARN : CC 74 canal 2 -> CUTOFF");
            p.unmapAll();
            p.knobParam(mmarp::knobIndex("cutoff"))->setValueNotifyingHost(0.5f);
        }
        // Le clip a le dessus : une note MIDI fait taire l'arpege, il reprend une mesure apres la derniere note
        {
            juce::MidiBuffer on1;
            on1.addEvent(juce::MidiMessage::noteOn(1, 60, static_cast<juce::uint8>(100)), 0);
            run(p, h, 512, 512, &on1);
            const bool quiet = p.clipActive();
            juce::MidiBuffer off1;
            off1.addEvent(juce::MidiMessage::noteOff(1, 60), 0);
            run(p, h, 512, 512, &off1);
            run(p, h, 48000 * 3, 512);
            check(quiet && !p.clipActive(), "Clip Priority : l'arpege se tait pendant le clip, reprend apres une mesure");
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
