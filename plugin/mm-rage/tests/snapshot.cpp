// MM-RAGE, la capture de l'interface (sans hote, sans son) : le vrai processeur et la vraie fenetre, quelques presets et
// chaque page, en PNG. Pour voir la face sans Ableton (Linux : sous xvfb-run ; le CI la joint a ses artefacts).
//   ./mmrage_snapshot dossier
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
        int page;
        float scale;
        int look = 0; // 1 : SETTINGS ouvert, cuir 100, lumiere 28, accent turquoise (la capture de Mika)
    };
    const std::vector<Case> cases = {
        {"01-rage-init", "INIT", 0, 2.f},
        {"02-rage-triode-bloom", "TRIODE BLOOM", 0, 1.f},
        {"03-shape-triode-bloom", "TRIODE BLOOM", 1, 1.f},
        {"04-bands-triode-bloom", "TRIODE BLOOM", 2, 1.f},
        {"05-move-triode-bloom", "TRIODE BLOOM", 3, 1.f},
        {"06-rage-total-carnage", "TOTAL CARNAGE", 0, 1.f},
        {"07-shape-small-radio", "SMALL RADIO", 1, 1.f},
        {"08-bands-shredder", "SHREDDER", 2, 1.f},
        {"09-move-filter-sweep", "FILTER SWEEP", 3, 1.f},
        {"10-settings", "MAUDITE", 0, 2.f, 1},
        {"11-rage-acid-squelch", "ACID SQUELCH", 0, 2.f},
    };
    rl::SharedLook look;
    int fails = 0;
    for (const auto& c : cases) {
        MMRageProcessor p;
        p.setPlayConfigDetails(2, 2, 48000, 512);
        p.prepareToPlay(48000, 512);
        int idx = -1;
        for (size_t i = 0; i < mmrage::factory().size(); ++i)
            if (mmrage::factory()[i].name == c.preset) idx = static_cast<int>(i);
        p.loadPreset(idx);
        // une seconde d'un signal de batterie doux : l'ATTITUDE bouge
        uint32_t r = 99;
        juce::MidiBuffer midi;
        for (int b = 0; b < 94; ++b) {
            juce::AudioBuffer<float> buf(2, 512);
            for (int i = 0; i < 512; ++i) {
                const double t = (b * 512 + i) / 48000.0;
                const double beat = std::fmod(t * 2, 1.0) * 0.5;
                r = r * 1664525u + 1013904223u;
                const double v = 0.5 * std::sin(2 * 3.14159265 * 55 * t) * std::exp(-beat * 6) + ((r >> 8) / 16777216.0 - 0.5) * 0.1;
                buf.setSample(0, i, static_cast<float>(v));
                buf.setSample(1, i, static_cast<float>(v));
            }
            p.processBlock(buf, midi);
        }
        p.setPage(c.page);
        std::unique_ptr<juce::AudioProcessorEditor> ed(p.createEditor());
        auto* re = dynamic_cast<MMRageEditor*>(ed.get());
        if (re == nullptr) return 2;
        ed->setSize(MMRageProcessor::kCanvasW, MMRageProcessor::kCanvasH);
        if (c.look == 1) {
            look->set({1.f, 0.28f, 168});
            re->showSettings(true);
        } else {
            look->reset();
        }
        for (int k = 0; k < 40; ++k) re->refresh(1.f / 30.f);
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
