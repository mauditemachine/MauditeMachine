// Le banc du processeur MM-ARP sans fenetre (2026-11-09) : le vrai MMArpProcessor (src/PluginProcessor.cpp, compile
// avec MMARP_HEADLESS=1) joue comme sous Ableton : un faux transport (ppq, tempo, lecture), un programme de la face,
// des notes MIDI, l'etat sauve puis recharge. Rien ne sort des enceintes : tout se verifie dans les buffers.
//   cmake -S plugin/mm-arp -B build-host -DMM_HOST_TEST=ON && cmake --build build-host -j && ./build-host/mmarp_host_test
#include "PluginProcessor.h"
#include "Hell.h"

#include <cmath>
#include <map>
#include <tuple>
#include <cstdio>
#include <cstring>
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
Stats run(MMArpProcessor& p, Head& h, int n, int block, juce::MidiBuffer* first = nullptr, std::vector<float>* keepL = nullptr, std::vector<float>* keepR = nullptr) {
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
                if (keepR && c == 1) keepR->push_back(v);
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
        check(p.getLatencySamples() >= 16 && p.getLatencySamples() <= 24, "latence declaree (les decimateurs seuls) : " + juce::String(p.getLatencySamples()).toStdString());
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
        // L'arc lumineux de la face (2026-11-16) : LFO 1 sur CUTOFF, la valeur modulee de CUTOFF part ; profondeur 0 : plus rien
        {
            auto* dst = p.knobParam(mmarp::knobIndex("lfoDest"));
            auto* amt = p.knobParam(mmarp::knobIndex("lfoAmt"));
            const float d0 = dst->getValue(), a0 = amt->getValue();
            dst->setValueNotifyingHost(0.25f);
            amt->setValueNotifyingHost(0.6f);
            float lo = 2, hi = -1;
            bool others = false;
            for (int k = 0; k < 40; ++k) {
                run(p, h, 1200, 512);
                const float v = p.modValue(3);
                if (v == v) {
                    lo = std::min(lo, v);
                    hi = std::max(hi, v);
                }
                for (int i = 0; i < MMArpProcessor::kModN; ++i)
                    if (i != 3 && p.modValue(i) == p.modValue(i)) others = true;
            }
            check(hi > lo + 0.05 && hi <= 1 && lo >= 0 && !others && juce::String(MMArpProcessor::kModIds[3]) == "cutoff", "LFO 1 sur CUTOFF : la face recoit la coupure modulee (" + juce::String(lo, 2).toStdString() + " a " + juce::String(hi, 2).toStdString() + "), rien d'autre");
            amt->setValueNotifyingHost(0.f);
            run(p, h, 9600, 512);
            bool none = true;
            for (int i = 0; i < MMArpProcessor::kModN; ++i) none = none && p.modValue(i) != p.modValue(i);
            check(none, "profondeur 0 : plus aucun reglage module");
            dst->setValueNotifyingHost(d0);
            amt->setValueNotifyingHost(a0);
            run(p, h, 4800, 512);
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
            // v32 : trois crans, ECO (0, x2), STD (0.5, x4, le depart), HQ (1, x8)
            X("xQuality")->setValueNotifyingHost(1.f);
            run(p, h, 24000, 512);
            const Stats hq = run(p, h, 48000, 512);
            X("xQuality")->setValueNotifyingHost(0.5f);
            run(p, h, 24000, 512);
            const Stats stdq = run(p, h, 48000, 512);
            X("xQuality")->setValueNotifyingHost(0.f);
            run(p, h, 24000, 512);
            const Stats eco = run(p, h, 48000, 512);
            X("xQuality")->setValueNotifyingHost(1.f);
            run(p, h, 24000, 512);
            check(hq.finite && stdq.finite && eco.finite && std::fabs(db(hq.rms) - db(stdq.rms)) < 1.5 && std::fabs(db(eco.rms) - db(stdq.rms)) < 1.5,
                  "QUALITY : HQ (x8), STD (x4) et ECO (x2) au meme niveau (" + juce::String(db(hq.rms), 1).toStdString() + " / " + juce::String(db(stdq.rms), 1).toStdString() + " / " +
                      juce::String(db(eco.rms), 1).toStdString() + " dBFS)");
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
        // Le module avant : sequenceur par pas (RATCHET x4 = plus de notes dans le clip), FX RACK, OSC / FILTER +
        {
            auto X = [&](const char* id) { return p.knobParam(mmx::allIndex(id)); };
            int bars = 0;
            const int base = p.arpMidi(1, bars).getTrack(0)->getNumEvents();
            p.faceProgram(juce::String(R"({"v":2,"kind":"arp","bpm":123,"swing":0,"seq":{"edit":false,"len":8,"buf":[0,2,4,null,7,4,2,0,0,0,0,0,0,0,0,0]},"prog":[0,5],"knobs":{},)") +
                          R"("steps":{"acc":[2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,1],"slide":[0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0],"gate":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],"rat":[4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],"prob":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]}})");
            const int rat = p.arpMidi(1, bars).getTrack(0)->getNumEvents();
            check(rat > base * 3, "STEP SEQUENCER : RATCHET x4 (" + juce::String(base).toStdString() + " -> " + juce::String(rat).toStdString() + " evenements dans le clip)");
            const char* on[] = {"xPhMix", "xFlMix", "xPumpDepth", "xCrushBits", "xCrushRate", "xShimmer", "xRing", "xFold", "xComb", "xHpf"};
            for (const char* id : on) X(id)->setValueNotifyingHost(0.8f);
            X("xUnison")->setValueNotifyingHost(1.f);
            X("xDlyMode")->setValueNotifyingHost(1.f);
            run(p, h, 9600, 512);
            const Stats all = run(p, h, 48000 * 2, 512);
            for (const char* id : on) X(id)->setValueNotifyingHost(0.f);
            X("xUnison")->setValueNotifyingHost(0.f);
            X("xDlyMode")->setValueNotifyingHost(0.f);
            p.faceProgram(program("[0,5]"));
            run(p, h, 48000, 512);
            check(all.finite && all.peak > 0.001 && all.peak < 2.0, "FX RACK + OSC / FILTER + tous engages : fini, sans debordement (crete " + juce::String(db(all.peak), 1).toStdString() + " dBFS)");
            check(X("xHpf")->getText(0.f, 32) == "OFF" && X("xPumpRate")->getText(0.5f, 32) == "1/4", "le texte des reglages du module avant");
        }
        // La matrice : MOD WHEEL -> CUTOFF (la molette ouvre le filtre), le pitch bend, MONO
        {
            auto X = [&](const char* id) { return p.knobParam(mmx::allIndex(id)); };
            X("xM1Src")->setValueNotifyingHost(2.f / 11.f);
            X("xM1Dst")->setValueNotifyingHost(10.f / 19.f);
            X("xM1Amt")->setValueNotifyingHost(1.f);
            p.knobParam(mmarp::knobIndex("cutoff"))->setValueNotifyingHost(0.15f);
            run(p, h, 24000, 512);
            const Stats shut = run(p, h, 48000, 512);
            juce::MidiBuffer mw;
            mw.addEvent(juce::MidiMessage::controllerEvent(1, 1, 127), 0);
            mw.addEvent(juce::MidiMessage::pitchWheel(1, 16383), 1);
            mw.addEvent(juce::MidiMessage::channelPressureChange(1, 100), 2);
            run(p, h, 4800, 512, &mw);
            const Stats open = run(p, h, 48000, 512);
            juce::MidiBuffer mw0;
            mw0.addEvent(juce::MidiMessage::controllerEvent(1, 1, 0), 0);
            mw0.addEvent(juce::MidiMessage::pitchWheel(1, 8192), 1);
            mw0.addEvent(juce::MidiMessage::channelPressureChange(1, 0), 2);
            run(p, h, 4800, 512, &mw0);
            X("xM1Src")->setValueNotifyingHost(0.f);
            X("xM1Dst")->setValueNotifyingHost(0.f);
            X("xM1Amt")->setValueNotifyingHost(0.5f);
            p.knobParam(mmarp::knobIndex("cutoff"))->setValueNotifyingHost(0.5f);
            check(open.finite && open.rms > shut.rms * 1.3, "MATRICE : MOD WHEEL -> CUTOFF ouvre le filtre (" + juce::String(db(shut.rms), 1).toStdString() + " -> " + juce::String(db(open.rms), 1).toStdString() + " dBFS)");
            const char* on[] = {"xFeedback", "xEqLow", "xEqHigh", "xEqAir"};
            for (const char* id : on) X(id)->setValueNotifyingHost(1.f);
            // DISTO (2026-11-17, v25) : style P, PUNISH, DRIVE a fond, trois bandes, FEEDBACK, MORPH vers FOLD, BOX
            X("xDStyle")->setValueNotifyingHost(5.f / 12);
            X("xDPunish")->setValueNotifyingHost(1.f);
            X("xDBands")->setValueNotifyingHost(1.f);
            X("xDFb")->setValueNotifyingHost(1.f);
            X("xDMorph")->setValueNotifyingHost(0.5f);
            X("xDMorphTo")->setValueNotifyingHost(10.f / 11);
            X("xDBox")->setValueNotifyingHost(0.75f);
            X("xDLfoAmt")->setValueNotifyingHost(1.f);
            p.knobParam(mmarp::knobIndex("dist"))->setValueNotifyingHost(1.f);
            X("xVoiceMode")->setValueNotifyingHost(1.f);
            X("xAmpMode")->setValueNotifyingHost(1.f);
            run(p, h, 9600, 512);
            const Stats all = run(p, h, 48000, 512);
            X("xFeedback")->setValueNotifyingHost(0.f);
            for (int e = 0; e < mmx::kExtra; ++e)
                if (std::strcmp(mmx::kExtraDefs[e].section, "disto") == 0) X(mmx::kExtraDefs[e].id)->setValueNotifyingHost(static_cast<float>(mmx::kExtraDefs[e].def));
            p.knobParam(mmarp::knobIndex("dist"))->setValueNotifyingHost(0.f);
            for (const char* id : {"xEqLow", "xEqHigh", "xEqAir"}) X(id)->setValueNotifyingHost(0.5f);
            X("xVoiceMode")->setValueNotifyingHost(0.f);
            X("xAmpMode")->setValueNotifyingHost(0.f);
            run(p, h, 48000, 512);
            check(all.finite && all.peak > 0.001 && all.peak < 4.0, "LEGATO + SATURATED + FEEDBACK + DISTO P PUNISH 3 bandes FEEDBACK MORPH BOX + EQ a fond : fini (crete " + juce::String(db(all.peak), 1).toStdString() + " dBFS)");
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
        // La reverbe facon BigSky (2026-11-16) : HALL par defaut ; le projet garde la sienne ; un projet d'avant (sans
        // REVERB TYPE) revient a CLASSIC (la reverbe d'avant)
        {
            const int ti = mmx::allIndex("xSkyType");
            check(std::fabs(p.knobParam(ti)->getValue() - 2.f / 12.f) < 1e-6f && std::fabs(q.knobParam(ti)->getValue() - 2.f / 12.f) < 1e-6f, "REVERB TYPE : HALL par defaut, et il revient avec le projet");
            auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
            bool removed = false;
            if (xml)
                for (auto* e : xml->getChildIterator())
                    for (auto* c : e->getChildIterator())
                        if (c->getStringAttribute("id") == "xSkyType") {
                            e->removeChildElement(c, true);
                            removed = true;
                            break;
                        }
            juce::MemoryBlock old;
            if (xml) juce::AudioProcessor::copyXmlToBinary(*xml, old);
            MMArpProcessor r;
            Head h3;
            r.setPlayHead(&h3);
            r.setStateInformation(old.getData(), static_cast<int>(old.getSize()));
            r.prepareToPlay(48000, 256);
            check(removed && r.knobParam(ti)->getValue() == 0.f, "un projet d'avant (sans REVERB TYPE) : la reverbe d'avant (CLASSIC) " + std::string(removed ? "" : "[cle non trouvee] ") + juce::String(r.knobParam(ti)->getValue()).toStdString());
            // chaque machine joue, finie et bornee, et le passage d'une machine a l'autre ne saute pas
            h3.playing = true;
            run(r, h3, 4800, 256);
            bool ok = true;
            double pk = 0;
            for (int m = 0; m <= 12; ++m) {
                r.knobParam(ti)->setValueNotifyingHost(m / 12.f);
                const Stats st = run(r, h3, 24000, 256);
                ok = ok && st.finite;
                pk = std::max(pk, st.peak);
            }
            check(ok && pk < 2, "les 13 reverbes l'une apres l'autre (CLASSIC puis les douze machines) : fini, crete " + juce::String(pk, 2).toStdString());
        }
        {
            // HELL d'avant RANGE (2026-11-17) : l'ancien decalage, TONE et LFO DEPTH migres au chargement, sans changer le son
            MMArpProcessor a;
            Head ha;
            a.setPlayHead(&ha);
            a.prepareToPlay(48000, 256);
            const auto P = [&](MMArpProcessor& pr, const char* id) { return pr.knobParam(mmx::allIndex(id)); };
            P(a, "xHellShift")->setValueNotifyingHost(0.7f); // 5000 x 0.4^3 = 320 Hz : WIDE
            P(a, "xHellTone")->setValueNotifyingHost(0.2f);  // passe-bas
            P(a, "xHellLfoDepth")->setValueNotifyingHost(0.5f);
            juce::MemoryBlock blob;
            a.getStateInformation(blob);
            auto xml = juce::AudioProcessor::getXmlFromBinary(blob.getData(), static_cast<int>(blob.getSize()));
            int gone = 0;
            if (xml)
                for (auto* e : xml->getChildIterator()) {
                    std::vector<juce::XmlElement*> kill;
                    for (auto* c : e->getChildIterator())
                        if (c->getStringAttribute("id").startsWith("xHell") &&
                            c->getStringAttribute("id") != "xHellShift" && c->getStringAttribute("id") != "xHellTone" && c->getStringAttribute("id") != "xHellLfoDepth" &&
                            c->getStringAttribute("id") != "xHellMix" && c->getStringAttribute("id") != "xHellSync" && c->getStringAttribute("id") != "xHellTime" &&
                            c->getStringAttribute("id") != "xHellFb" && c->getStringAttribute("id") != "xHellUpDown" && c->getStringAttribute("id") != "xHellSpread" &&
                            c->getStringAttribute("id") != "xHellLfoRate")
                            kill.push_back(c);
                    for (auto* c : kill) e->removeChildElement(c, true);
                    gone += static_cast<int>(kill.size());
                }
            juce::MemoryBlock old;
            if (xml) juce::AudioProcessor::copyXmlToBinary(*xml, old);
            MMArpProcessor b;
            Head hb;
            b.setPlayHead(&hb);
            b.setStateInformation(old.getData(), static_cast<int>(old.getSize()));
            b.prepareToPlay(48000, 256);
            const int range = static_cast<int>(std::lround(P(b, "xHellRange")->getValue() * 3));
            const double hz = mmarp::Hell::shiftHzFor(P(b, "xHellShift")->getValue(), range, 120, 0);
            const double lp = mmarp::Hell::lpHzOf(P(b, "xHellLp")->getValue());
            const double lpWas = 600.0 * std::pow(30.0, 0.2 / 0.49);
            const bool ok = gone == 12 && range == mmarp::Hell::WIDE && std::fabs(hz - 320) < 0.5 && std::fabs(P(b, "xHellTone")->getValue() - 0.5f) < 1e-6f &&
                            std::fabs(lp - lpWas) < 0.01 * lpWas && std::fabs(P(b, "xHellLfoAmt")->getValue() - 0.75f) < 1e-3f && P(b, "xHellLfoDepth")->getValue() == 0.f;
            check(ok, "HELL d'avant (sans RANGE) : 320 Hz -> WIDE " + juce::String(hz, 1).toStdString() + " Hz, TONE -> LOW-PASS " + juce::String(lp, 0).toStdString() + " Hz (avant " +
                          juce::String(lpWas, 0).toStdString() + "), LFO DEPTH -> AMOUNT, " + std::to_string(gone) + " reglages retires");
        }
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
        // Sans la file de 128 (faible latence), la taille des blocs deplace les decisions prises au rythme des blocs
        // (DRIFT) : le son reste le meme a l'oreille, plus au bit pres. Controle : la meme sonie.
        double ra = 0, rb = 0;
        for (size_t i = 0; i < a.size() && i < b.size(); ++i) {
            ra += static_cast<double>(a[i]) * a[i];
            rb += static_cast<double>(b[i]) * b[i];
        }
        juce::ignoreUnused(d2);
        check(std::fabs(db(std::sqrt(ra)) - db(std::sqrt(rb))) < 0.5, "blocs de 512 contre 77 : la meme sonie (" + juce::String(db(std::sqrt(ra)) - db(std::sqrt(rb)), 2).toStdString() + " dB d'ecart)");
    }
    {
        // DISTO (2026-11-17, v25) : un projet d'avant (sans aucun reglage de la DISTO), DISTO (l'OVERDRIVE du moteur) a
        // 0.6, sonne au bit pres comme avant ; le style A change le son. La pedale DISTORTION masquee : un projet qui
        // l'avait (0.5, TONE 0.7) passe a la DISTO (DIODE, DRIVE 0.5, MIX, AUTO, POST FILTER LP, TONE) et sonne au bit
        // pres comme ce reglage pose a la main
        auto render = [](bool strip, float style, double pedal, double pedalTone, const std::vector<std::pair<const char*, double>>& set) {
            MMArpProcessor p;
            Head h;
            p.setPlayHead(&h);
            juce::MemoryBlock mb;
            p.getStateInformation(mb);
            auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
            int removed = 0;
            for (auto* e : xml->getChildIterator()) {
                std::vector<juce::XmlElement*> kill;
                for (auto* c : e->getChildIterator()) {
                    const juce::String id = c->getStringAttribute("id");
                    if (id == "dist") c->setAttribute("value", 0.6);
                    if (id == "xDist") c->setAttribute("value", pedal);
                    if (id == "xDistTone") c->setAttribute("value", pedalTone);
                    if (id == "xDStyle") c->setAttribute("value", static_cast<double>(style));
                    for (const auto& kv : set)
                        if (id == kv.first) c->setAttribute("value", kv.second);
                    const int ix = mmx::allIndex(id.toRawUTF8());
                    if (strip && ix >= mmarp::kKnobs && std::strcmp(mmx::kExtraDefs[ix - mmarp::kKnobs].section, "disto") == 0) kill.push_back(c);
                }
                for (auto* c : kill) e->removeChildElement(c, true);
                removed += static_cast<int>(kill.size());
            }
            juce::ValueTree st = juce::ValueTree::fromXml(*xml);
            st.setProperty("seed", 12345, nullptr);
            st.setProperty("program", program(), nullptr);
            juce::MemoryBlock m2;
            juce::AudioProcessor::copyXmlToBinary(*st.createXml(), m2);
            p.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
            p.prepareToPlay(48000, 512);
            h.playing = true;
            std::vector<float> L;
            run(p, h, 48000 * 2, 512, nullptr, &L);
            std::map<std::string, double> v;
            for (const char* id : {"dist", "xDist", "xDistTone", "xDStyle", "xDMix", "xDAuto", "xDPostMode", "xDPostFreq", "xDPostReso", "xDTone"})
                v[id] = static_cast<double>(p.knobParam(mmx::allIndex(id))->getValue());
            return std::make_tuple(L, removed, v);
        };
        int nDisto = 0;
        for (int e = 0; e < mmx::kExtra; ++e) nDisto += std::strcmp(mmx::kExtraDefs[e].section, "disto") == 0 ? 1 : 0;
        const auto now = render(false, 0.f, 0, 0.5, {}), old = render(true, 0.f, 0, 0.5, {}), a = render(false, 1.f / 12, 0, 0.5, {});
        double d = 0, dA = 0, pk = 0;
        for (size_t i = 0; i < std::get<0>(now).size() && i < std::get<0>(old).size() && i < std::get<0>(a).size(); ++i) {
            d = std::max(d, static_cast<double>(std::fabs(std::get<0>(now)[i] - std::get<0>(old)[i])));
            dA = std::max(dA, static_cast<double>(std::fabs(std::get<0>(now)[i] - std::get<0>(a)[i])));
            pk = std::max(pk, static_cast<double>(std::fabs(std::get<0>(now)[i])));
        }
        check(std::get<1>(old) == nDisto && nDisto == 52 && pk > 0.01 && d <= 0 && dA > 0.001,
              "DISTO : un projet d'avant (" + std::to_string(std::get<1>(old)) + " reglages de la DISTO absents, DISTO 0.6) sonne au bit pres comme avant ; le style A change le son (ecart " +
                  juce::String(dA, 3).toStdString() + ")");
        // la pedale : convertie
        const auto conv = render(true, 0.f, 0.5, 0.7, {});
        const auto& cv = std::get<2>(conv);
        const double toneHz = mmarp::ArpFxLaws::distToneHz(0.7);
        const double wantFreq = std::log(toneHz / 20) / std::log(1000.0);
        const bool vals = std::fabs(cv.at("xDStyle") - 8.0 / 12) < 1e-6 && std::fabs(cv.at("dist") - 0.5) < 1e-6 && cv.at("xDMix") > 0.999 && cv.at("xDAuto") > 0.999 &&
                          std::fabs(cv.at("xDPostMode") - 0.25) < 1e-6 && std::fabs(cv.at("xDPostFreq") - wantFreq) < 1e-6 && cv.at("xDPostReso") < 1e-6 &&
                          std::fabs(cv.at("xDTone") - (0.5 + 12 * 0.2 / 12)) < 1e-6 && cv.at("xDist") == 0 && std::fabs(cv.at("xDistTone") - 0.5) < 1e-6;
        const auto hand = render(false, 8.f / 12, 0, 0.5,
                                 {{"dist", 0.5}, {"xDMix", 1}, {"xDAuto", 1}, {"xDPostMode", 0.25}, {"xDPostFreq", static_cast<double>(static_cast<float>(wantFreq))}, {"xDPostReso", 0}, {"xDTone", 0.7}});
        double dc = 0, dn = 0;
        for (size_t i = 0; i < std::get<0>(conv).size() && i < std::get<0>(hand).size(); ++i) {
            dc = std::max(dc, static_cast<double>(std::fabs(std::get<0>(conv)[i] - std::get<0>(hand)[i])));
            dn = std::max(dn, static_cast<double>(std::fabs(std::get<0>(conv)[i] - std::get<0>(now)[i])));
        }
        check(vals && dc <= 0 && dn > 0.001,
              "pedale DISTORTION (0.5, TONE 0.7) convertie : DIODE, DRIVE 0.5, MIX 100 %, AUTO, POST LP " + std::to_string(std::lround(toneHz)) +
                  " Hz, TONE ; au bit pres comme ce reglage pose a la main ; la pedale a 0");
        // une pedale en dessous de 5 % : MIX suit sa dose ; une DISTO deja reglee (style T) : la pedale est seulement coupee
        const auto low = render(true, 0.f, 0.02, 0.5, {});
        const auto keep = render(false, 4.f / 12, 0.4, 0.5, {});
        check(std::fabs(std::get<2>(low).at("xDMix") - 0.4) < 1e-6 && std::fabs(std::get<2>(low).at("dist") - 0.02) < 1e-6 && std::fabs(std::get<2>(keep).at("xDStyle") - 4.0 / 12) < 1e-6 &&
                  std::fabs(std::get<2>(keep).at("dist") - 0.6) < 1e-6 && std::get<2>(keep).at("xDist") == 0,
              "pedale a 2 % : MIX 40 % ; DISTO deja en T : la pedale seulement coupee, DRIVE garde");
    }
    {
        // v27 : l'ancien DELAY (DLY TIME, TAPE, DELAY MODE) converti a l'ouverture vers la page DELAY. Le meme projet
        // d'avant (sans aucun reglage v27 : DELAY, EQ parametrique, rack enrichi) rendu par l'ancien DELAY tel quel
        // (testLegacyDelay) et par la page DELAY convertie : au bit pres. Puis l'ancien TAPE n'agit plus (OLD).
        struct Old {
            double delay, dlyTime, tape, mode;
        };
        auto render = [](const Old& o, bool legacy, bool strip, const std::vector<std::pair<const char*, double>>& after, std::map<std::string, double>* vals) {
            MMArpProcessor::testLegacyDelay = legacy;
            MMArpProcessor p;
            Head h;
            p.setPlayHead(&h);
            juce::MemoryBlock mb;
            p.getStateInformation(mb);
            auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
            for (auto* e : xml->getChildIterator()) {
                std::vector<juce::XmlElement*> kill;
                for (auto* c : e->getChildIterator()) {
                    const juce::String id = c->getStringAttribute("id");
                    if (id == "delay") c->setAttribute("value", o.delay);
                    if (id == "dlyTime") c->setAttribute("value", o.dlyTime);
                    if (id == "tape") c->setAttribute("value", o.tape);
                    if (id == "xDlyMode") c->setAttribute("value", o.mode);
                    const int ix = mmx::allIndex(id.toRawUTF8());
                    if (strip && ix >= mmarp::kKnobs + mmx::ex_xDlStyle) kill.push_back(c);
                }
                for (auto* c : kill) e->removeChildElement(c, true);
            }
            juce::ValueTree st = juce::ValueTree::fromXml(*xml);
            st.setProperty("seed", 12345, nullptr);
            st.setProperty("program", program(), nullptr);
            juce::MemoryBlock m2;
            juce::AudioProcessor::copyXmlToBinary(*st.createXml(), m2);
            p.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
            for (const auto& kv : after) p.knobParam(mmx::allIndex(kv.first))->setValueNotifyingHost(static_cast<float>(kv.second));
            p.prepareToPlay(48000, 512);
            h.playing = true;
            std::vector<float> L, R;
            run(p, h, 48000 * 3, 512, nullptr, &L, &R);
            if (vals)
                for (int e = mmx::ex_xDlStyle; e <= mmx::ex_xDlRhythm; ++e) (*vals)[mmx::kExtraDefs[e].id] = static_cast<double>(p.knobParam(mmarp::kKnobs + e)->getValue());
            MMArpProcessor::testLegacyDelay = false;
            L.insert(L.end(), R.begin(), R.end());
            return L;
        };
        // le defaut du site (TAPE 0.3 : la bande), le ping-pong, STEREO, WIDE, la bande a fond ; tous les DLY TIME
        const Old cases[] = {{0.25, 0.25, 0.3, 0}, {0.4, 0.75, 0, 0}, {0.55, 0.5, 0, 0.5}, {0.3, 1, 0, 1}, {0.45, 0, 0.65, 0.5}, {0.38, 0.25, 0.01, 0}};
        int exact = 0;
        double worst = 0, pk = 0;
        std::string why;
        for (const Old& o : cases) {
            std::map<std::string, double> v;
            const auto a = render(o, true, true, {}, nullptr), b = render(o, false, true, {}, &v);
            double d = 0;
            for (size_t i = 0; i < a.size() && i < b.size(); ++i) {
                d = std::max(d, static_cast<double>(std::fabs(a[i] - b[i])));
                pk = std::max(pk, static_cast<double>(std::fabs(a[i])));
            }
            worst = std::max(worst, d);
            if (d <= 0 && a.size() == b.size()) ++exact;
            else why += " cas " + std::to_string(&o - cases) + " ecart " + juce::String(d, 9).toStdString();
        }
        check(exact == 6 && pk > 0.01, "DELAY v27 : 6 projets d'avant (TAPE, PING PONG, STEREO, WIDE, tous les DLY TIME) convertis sonnent au bit pres comme l'ancien DELAY" + why);
        // les valeurs converties : la bande, et le ping-pong STEREO a 1/4.
        std::map<std::string, double> vt, vd;
        render({0.25, 0.25, 0.3, 0}, false, true, {}, &vt);
        render({0.55, 0.75, 0, 0.5}, false, true, {}, &vd);
        const auto stepOf = [](int e, double v) { return mmx::exStep(e, v); };
        const bool okT = stepOf(mmx::ex_xDlStyle, vt["xDlStyle"]) == mmarp::ES_TAPE && std::fabs(vt["xDlWobble"] - 0.3) < 1e-6 && stepOf(mmx::ex_xDlMode, vt["xDlMode"]) == mmarp::EM_PINGPONG &&
                         stepOf(mmx::ex_xDlSync, vt["xDlSync"]) == 1 && stepOf(mmx::ex_xDlDiv, vt["xDlDiv"]) == 2 && stepOf(mmx::ex_xDlNote, vt["xDlNote"]) == 1 &&
                         static_cast<float>(vt["xDlFb"]) == static_cast<float>(0.35 + (0.68 - 0.35) * 0.25);
        const bool okD = stepOf(mmx::ex_xDlStyle, vd["xDlStyle"]) == mmarp::ES_DIGITAL && vd["xDlWobble"] == 0 && stepOf(mmx::ex_xDlMode, vd["xDlMode"]) == mmarp::EM_DUAL &&
                         stepOf(mmx::ex_xDlDiv, vd["xDlDiv"]) == 3 && stepOf(mmx::ex_xDlNote, vd["xDlNote"]) == 1 && static_cast<float>(vd["xDlFb"]) == static_cast<float>(0.35 + (0.68 - 0.35) * 0.55);
        check(okT && okD, "DELAY v27 : la regle de conversion (TAPE -> style TAPE, WOBBLE = TAPE, PING-PONG ; sinon DIGITAL, STEREO -> DUAL ; DLY TIME -> 1/8. ou 1/4. ; FEEDBACK = 0.35 + 0.33 x DELAY)");
        // l'ancien TAPE (OLD TAPE) n'agit plus ; le STYLE de la page, si
        const auto base = render({0.4, 0.25, 0.3, 0}, false, true, {}, nullptr);
        const auto oldTape = render({0.4, 0.25, 0.3, 0}, false, true, {{"tape", 0.9}, {"dlyTime", 1}}, nullptr);
        const auto style = render({0.4, 0.25, 0.3, 0}, false, true, {{"xDlStyle", 6.0 / 7}}, nullptr);
        double dOld = 0, dSt = 0;
        for (size_t i = 0; i < base.size() && i < oldTape.size() && i < style.size(); ++i) {
            dOld = std::max(dOld, static_cast<double>(std::fabs(base[i] - oldTape[i])));
            dSt = std::max(dSt, static_cast<double>(std::fabs(base[i] - style[i])));
        }
        check(dOld <= 0 && dSt > 0.001, "DELAY v27 : OLD TAPE et OLD DLY TIME automatises ne changent plus rien ; le STYLE CASSETTE de la page change le son (ecart " + juce::String(dSt, 3).toStdString() + ")");
        // les noms dans l'hote : OLD devant
        MMArpProcessor p;
        check(p.knobParam(mmx::allIndex("tape"))->getName(64) == "OLD TAPE" && p.knobParam(mmx::allIndex("dlyTime"))->getName(64) == "OLD DLY TIME" &&
                  p.knobParam(mmx::allIndex("xDlyMode"))->getName(64) == "OLD DLY MODE" && p.knobParam(mmx::allIndex("xEqLow"))->getName(64) == "OLD EQ LOW" &&
                  p.knobParam(mmx::allIndex("xDlStyle"))->getName(64) == "DELAY STYLE" && p.knobParam(mmx::allIndex("xQ3Gain"))->getName(64) == "EQ 3 GAIN",
              "DELAY v27 : dans l'hote, OLD TAPE, OLD DLY TIME, OLD DLY MODE, OLD EQ LOW ; les neufs en fin de liste (DELAY STYLE, EQ 3 GAIN)");
        // les neufs sont en fin de liste : l'index des anciens ne bouge pas
        check(mmx::ex_xDlStyle == 150 && mmx::ex_xPuCurve == 226 && mmx::allIndex("xDBoxMix") == mmarp::kKnobs + 149, "v27 : 77 reglages neufs ajoutes en fin de liste (les 150 d'avant gardent leur place)");
        // v32 : EXPORT HQ, le seul neuf, en fin de liste
        check(mmx::ex_xExportHq == 227 && mmx::kExtra == 228, "v32 : EXPORT HQ ajoute en fin de liste (les 227 d'avant gardent leur place)");
    }
    {
        // v27 : la banque d'usine (presets/factory.json, la page DELAY convertie par build.mjs) sonne au bit pres comme
        // avec l'ancien DELAY (DLY TIME, TAPE, DELAY MODE du preset, testLegacyDelay)
        const juce::File f = juce::File::getCurrentWorkingDirectory().getChildFile("plugin/mm-arp/presets/factory.json");
        const juce::var bank = juce::JSON::parse(f.loadFileAsString());
        const juce::var* list = bank.getDynamicObject() ? bank.getDynamicObject()->getProperties().getVarPointer("presets") : nullptr;
        int n = 0, exact = 0;
        std::string bad;
        if (list && list->isArray())
            for (const auto& pr : *list->getArray()) {
                const auto play = [&](bool legacy) {
                    MMArpProcessor::testLegacyDelay = legacy;
                    MMArpProcessor p;
                    Head h;
                    h.bpm = static_cast<double>(pr.getProperty("bpm", 120));
                    p.setPlayHead(&h);
                    for (const char* part : {"knobs", "extra"})
                        if (auto* o = pr.getProperty(part, juce::var()).getDynamicObject())
                            for (const auto& kv : o->getProperties()) {
                                const int ix = mmx::allIndex(kv.name.toString().toRawUTF8());
                                if (ix >= 0) p.knobParam(ix)->setValueNotifyingHost(static_cast<float>(static_cast<double>(kv.value)));
                            }
                    juce::MemoryBlock mb;
                    p.getStateInformation(mb);
                    auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
                    juce::ValueTree st = juce::ValueTree::fromXml(*xml);
                    st.setProperty("seed", 777, nullptr);
                    st.setProperty("program", program(), nullptr);
                    juce::MemoryBlock m2;
                    juce::AudioProcessor::copyXmlToBinary(*st.createXml(), m2);
                    p.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
                    p.prepareToPlay(48000, 512);
                    h.playing = true;
                    std::vector<float> L, R;
                    run(p, h, 48000 * 2, 512, nullptr, &L, &R);
                    MMArpProcessor::testLegacyDelay = false;
                    L.insert(L.end(), R.begin(), R.end());
                    return L;
                };
                const auto a = play(true), b = play(false);
                double d = 0;
                for (size_t i = 0; i < a.size() && i < b.size(); ++i) d = std::max(d, static_cast<double>(std::fabs(a[i] - b[i])));
                ++n;
                if (d <= 0 && a.size() == b.size()) ++exact;
                else bad += " " + pr.getProperty("name", "?").toString().toStdString();
            }
        check(n == 40 && exact == n, "DELAY v27 : la banque d'usine, " + std::to_string(exact) + " / " + std::to_string(n) + " presets au bit pres comme avec l'ancien DELAY" + bad);
    }
    {
        // v27 : l'analyseur de la page SOUND (seulement page ouverte) : une note jouee, ses bandes au-dessus de -60 dB
        MMArpProcessor p;
        Head h;
        p.setPlayHead(&h);
        p.prepareToPlay(48000, 512);
        juce::MemoryBlock mb;
        p.getStateInformation(mb);
        auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
        juce::ValueTree st = juce::ValueTree::fromXml(*xml);
        st.setProperty("program", program(), nullptr);
        juce::MemoryBlock m2;
        juce::AudioProcessor::copyXmlToBinary(*st.createXml(), m2);
        p.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
        h.playing = true;
        float db[mmarp::SpecAnalyzer::kBins];
        run(p, h, 48000, 512, nullptr, nullptr);
        const bool idle = !p.specFrame(db);
        p.setSpecOn(true);
        run(p, h, 48000, 512, nullptr, nullptr);
        const bool got = p.specFrame(db);
        float top = -200;
        for (float v : db) top = std::max(top, v);
        p.setSpecOn(false);
        check(idle && got && top > -60, "EQ ANALYZER : rien tant que la page est fermee ; page ouverte, 96 bandes (crete " + juce::String(top, 1).toStdString() + " dB)");
    }
    {
        // La taille de la fenetre (2026-11-18, v29) : 1496 par defaut ; la taille choisie reste dans le projet (editorW7) ;
        // un projet v26-v28 (editorW6) rouvre a 80 % ; un plus ancien (editorW5) a 1496
        MMArpProcessor a;
        const int def = a.editorWidth();
        a.setEditorWidth(1300);
        juce::MemoryBlock mb;
        a.getStateInformation(mb);
        MMArpProcessor b;
        b.setStateInformation(mb.getData(), static_cast<int>(mb.getSize()));
        auto reopen = [&](const char* key, int w) {
            auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
            xml->removeAttribute("editorW7");
            xml->setAttribute(key, w);
            juce::MemoryBlock m2;
            juce::AudioProcessor::copyXmlToBinary(*xml, m2);
            MMArpProcessor c;
            c.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
            return c.editorWidth();
        };
        const int w6 = reopen("editorW6", 1870), w6b = reopen("editorW6", 3300), w5 = reopen("editorW5", 2500);
        check(def == 1496 && b.editorWidth() == 1300 && w6 == 1496 && w6b == 2640 && w5 == 1496,
              "taille : 1496 par defaut, la taille choisie gardee (1300), un projet v26-v28 a 1870 rouvre a " + std::to_string(w6) +
                  ", a 3300 a " + std::to_string(w6b) + ", un plus ancien (editorW5 2500) a " + std::to_string(w5));
    }
    {
        // v31 : le compteur CPU (la charge de l'instance par etage, lissee, et son pic) : des valeurs finies, le total
        // au-dessus de la somme des etages mesures a part, le pic au-dessus de la moyenne, les voix et QUALITY (HQ : x8)
        MMArpProcessor p;
        Head h;
        p.setPlayHead(&h);
        p.prepareToPlay(48000, 128);
        juce::MemoryBlock mb;
        p.getStateInformation(mb);
        auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
        juce::ValueTree st = juce::ValueTree::fromXml(*xml);
        st.setProperty("program", program(), nullptr);
        juce::MemoryBlock m2;
        juce::AudioProcessor::copyXmlToBinary(*st.createXml(), m2);
        p.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
        h.playing = true;
        const bool idle0 = p.cpu(MMArpProcessor::kCpuTotal) == 0.f;
        run(p, h, 48000, 128, nullptr, nullptr);
        bool finite = true;
        double parts = 0;
        for (int i = 0; i < MMArpProcessor::kCpuN; ++i) {
            finite = finite && std::isfinite(p.cpu(i)) && p.cpu(i) >= 0;
            if (i != MMArpProcessor::kCpuTotal) parts += p.cpu(i);
        }
        const double tot = p.cpu(MMArpProcessor::kCpuTotal);
        char buf[200];
        std::snprintf(buf, sizeof buf, "v31 compteur CPU : total %.2f %% (etages %.2f %%), pic %.2f %%, moteur %.2f %%, %d voix, x%d (STD)", tot, parts, static_cast<double>(p.cpuPeak()),
                      static_cast<double>(p.cpu(MMArpProcessor::kCpuEngine)), p.cpuVoices(), p.cpuOs());
        check(idle0 && finite && tot > 0 && tot < 1000 && std::fabs(parts - tot) < 0.05 * tot + 0.05 && p.cpuPeak() >= tot && p.cpu(MMArpProcessor::kCpuEngine) > 0 && p.cpuOs() == 4, buf);
        // v32 : EXPORT HQ : le rendu hors ligne passe en HQ x8 (QUALITY reste STD), le temps reel revient a x4
        p.setNonRealtime(true);
        run(p, h, 4800, 128, nullptr, nullptr);
        const int osOff = p.cpuOs();
        p.knobParam(mmx::allIndex("xExportHq"))->setValueNotifyingHost(0.f);
        run(p, h, 4800, 128, nullptr, nullptr);
        const int osOffNo = p.cpuOs();
        p.setNonRealtime(false);
        p.knobParam(mmx::allIndex("xExportHq"))->setValueNotifyingHost(1.f);
        run(p, h, 4800, 128, nullptr, nullptr);
        const int osRt = p.cpuOs();
        p.knobParam(mmx::allIndex("xQuality"))->setValueNotifyingHost(0.f);
        run(p, h, 4800, 128, nullptr, nullptr);
        const int osEco = p.cpuOs();
        check(osOff == 8 && osOffNo == 4 && osRt == 4 && osEco == 2,
              "v32 QUALITY : STD x4 au depart, EXPORT HQ hors ligne x" + std::to_string(osOff) + " (coupe : x" + std::to_string(osOffNo) + "), temps reel x" + std::to_string(osRt) + ", ECO x" + std::to_string(osEco));
    }
    {
        // v32 : un projet d'avant (QUALITY a deux crans, sans EXPORT HQ) : HQ reste HQ, STD reste STD ; une instance neuve : STD
        const auto reload = [&](float oldQ) {
            MMArpProcessor a;
            juce::MemoryBlock mb;
            a.getStateInformation(mb);
            auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
            juce::ValueTree st = juce::ValueTree::fromXml(*xml);
            juce::ValueTree params = st.getChild(0);
            for (int i = params.getNumChildren(); --i >= 0;) {
                juce::ValueTree c = params.getChild(i);
                if (c.getProperty("id").toString() == "xExportHq") params.removeChild(i, nullptr);
                else if (c.getProperty("id").toString() == "xQuality") c.setProperty("value", oldQ, nullptr);
            }
            juce::MemoryBlock m2;
            juce::AudioProcessor::copyXmlToBinary(*st.createXml(), m2);
            MMArpProcessor b;
            b.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
            return std::make_pair(b.knobParam(mmx::allIndex("xQuality"))->getValue(), b.knobParam(mmx::allIndex("xExportHq"))->getValue());
        };
        MMArpProcessor fresh;
        const auto hqOld = reload(1.f), stdOld = reload(0.f);
        check(fresh.knobParam(mmx::allIndex("xQuality"))->getValue() == 0.5f && hqOld.first == 1.f && stdOld.first == 0.5f && hqOld.second == 1.f,
              "v32 : instance neuve en STD ; projet d'avant en HQ : HQ ; en STD : STD ; EXPORT HQ engage");
    }
    {
        // v32 (Mika : "8 voix") : un arpege rapide au release long ; le moteur seul (la limite du plugin, softVoices 8) :
        // jamais plus de 8 voix pleines, les volees s'effacent en ~5 ms ; sans limite, 12
        const auto play = [](int soft, int& maxFull, int& maxOn, double& rms) {
            mmarp::VoyagerOptions o;
            o.os = 4;
            o.softVoices = soft;
            mmarp::Voyager v(o);
            const mmarp::ParamKV kv[] = {{mmarp::Voyager::paramIndex("aR"), 0.9}, {mmarp::Voyager::paramIndex("aS"), 0.7}};
            v.params(kv, 2);
            std::vector<float> L(128), R(128);
            maxFull = maxOn = 0;
            double sum = 0;
            int n = 0;
            for (int b = 0; b < 48000 * 3 / 128; ++b) {
                const double t = b * 128 / 48000.0;
                if (b % 12 == 0) v.note(t, 48 + (b / 12) % 24, 0.05, 1, std::numeric_limits<double>::quiet_NaN(), 0, 0.8);
                v.process(L.data(), R.data(), 128);
                maxFull = std::max(maxFull, v.fullVoices());
                maxOn = std::max(maxOn, v.activeVoices());
                for (int i = 0; i < 128; ++i) sum += static_cast<double>(L[static_cast<size_t>(i)]) * L[static_cast<size_t>(i)];
                n += 128;
            }
            rms = std::sqrt(sum / n);
        };
        int f8, o8, f0, o0;
        double r8, r0;
        play(8, f8, o8, r8);
        play(0, f0, o0, r0);
        check(f8 <= 8 && o8 <= 12 && f0 == 12 && r8 > 0 && std::fabs(20 * std::log10(r8 / r0)) < 3,
              "v32 voix : limite 8 : " + std::to_string(f8) + " pleines (" + std::to_string(o8) + " avec celles qui s'effacent) ; sans limite : " + std::to_string(f0) +
                  " ; niveau " + juce::String(20 * std::log10(r8 / r0), 1).toStdString() + " dB");
    }
    std::printf(failures ? "%d echec(s)\n" : "tout passe\n", failures);
    return failures ? 1 : 0;
}
