// MM-HELL, la capture de l'interface (sans hote, sans son) : le vrai processeur et la vraie fenetre, quelques presets, en
// PNG. Pour voir la face sans Ableton (Linux : sous xvfb-run ; le CI la joint a ses artefacts).
//   ./mmhell_snapshot dossier
#include "PluginEditor.h"

#include <cstdio>
#include <vector>

int main(int argc, char** argv) {
    juce::ScopedJuceInitialiser_GUI init;
    const juce::File out = juce::File::getCurrentWorkingDirectory().getChildFile(argc > 1 ? argv[1] : "snapshots");
    out.createDirectory();
    struct Case {
        const char* file;
        const char* preset;
        float mix;
        int note;
        float scale;
        int look = 0; // 1 : SETTINGS ouvert, cuir 100, lumiere 28, accent turquoise (la capture de Mika)
    };
    const std::vector<Case> cases = {
        {"01-init", "INIT", 0.35f, -1, 2.f},          {"02-halo", "HALO", 0.5f, -1, 2.f},
        {"03-purgatory-loop", "PURGATORY LOOP", 0.5f, -1, 1.f}, {"04-black-mass", "BLACK MASS", 0.5f, -1, 1.f},
        {"05-note-ghost", "NOTE GHOST", 0.5f, 57, 1.f}, {"06-ember-drift", "EMBER DRIFT", 0.6f, -1, 1.f},
        {"07-crossfire", "CROSSFIRE", 0.5f, -1, 1.f},   {"08-broken-radio", "BROKEN RADIO", 0.5f, -1, 1.f},
        {"09-off", "ABYSS", 0.f, -1, 1.f},
        {"10-settings", "SHEPARD RISE", 0.5f, -1, 2.f, 1},
        {"11-iron-bell", "IRON BELL", 0.5f, -1, 1.f},
        {"12-fifth-ladder", "FIFTH LADDER", 0.5f, 45, 1.f},
    };
    hl::SharedLook look;
    int fails = 0;
    for (const auto& c : cases) {
        MMHellProcessor p;
        p.setPlayConfigDetails(2, 2, 48000, 512);
        p.prepareToPlay(48000, 512);
        int idx = -1;
        for (size_t i = 0; i < mmhell::factory().size(); ++i)
            if (mmhell::factory()[i].name == c.preset) idx = static_cast<int>(i);
        p.loadPreset(idx);
        auto* mixP = p.apvts.getParameter(pid::mix);
        mixP->setValueNotifyingHost(mixP->convertTo0to1(c.mix));
        // une seconde de bruit doux : le LFO tourne, la note MIDI arrive
        juce::MidiBuffer midi;
        uint32_t r = 99;
        for (int b = 0; b < 94; ++b) {
            juce::AudioBuffer<float> buf(2, 512);
            for (int ch = 0; ch < 2; ++ch)
                for (int i = 0; i < 512; ++i) {
                    r = r * 1664525u + 1013904223u;
                    buf.setSample(ch, i, static_cast<float>(((r >> 8) / 16777216.0 - 0.5) * 0.2));
                }
            midi.clear();
            if (b == 0 && c.note >= 0) midi.addEvent(juce::MidiMessage::noteOn(1, c.note, 0.8f), 0);
            p.processBlock(buf, midi);
        }
        std::unique_ptr<juce::AudioProcessorEditor> ed(p.createEditor());
        auto* he = dynamic_cast<MMHellEditor*>(ed.get());
        if (he == nullptr) return 2;
        ed->setSize(MMHellProcessor::kCanvasW, MMHellProcessor::kCanvasH);
        if (c.look == 1) {
            look->set({1.f, 0.28f, 168});
            he->showSettings(true);
        } else {
            look->reset();
        }
        for (int k = 0; k < 40; ++k) he->refresh(1.f / 30.f);
        const juce::Image img = ed->createComponentSnapshot(ed->getLocalBounds(), true, c.scale);
        const juce::File f = out.getChildFile(juce::String(c.file) + ".png");
        f.deleteFile();
        juce::FileOutputStream os(f);
        juce::PNGImageFormat png;
        const bool ok = os.openedOk() && png.writeImageToStream(img, os);
        std::printf("%s  %s (%dx%d)\n", ok ? "ok  " : "FAIL", f.getFullPathName().toRawUTF8(), img.getWidth(), img.getHeight());
        if (!ok) ++fails;
    }
    look->reset();
    return fails ? 1 : 0;
}
