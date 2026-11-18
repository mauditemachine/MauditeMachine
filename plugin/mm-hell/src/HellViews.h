// MM-HELL, les vues : l'echelle du FREQUENCY SHIFTER (selon RANGE), le VU a aiguille du LFO, l'ECHO MAP (ou vont les
// repetitions : la spirale, les filtres de la boucle, le repliement sous 0 Hz), la fenetre des presets, la bande d'info,
// et le style des menus.
#pragma once

#include "HellLook.h"
#include "HellPatch.h"

#include <cmath>

namespace hl {

/** L'echelle autour du gros potard (HellPage.tsx ShiftScale) : reperes selon RANGE, 0 a l'accent. */
void paintShiftScale(juce::Graphics& g, juce::Point<float> c, int range);

/** Le VU a aiguille du LFO (HellPage.tsx HellVu) : face ivoire, aiguille avec un rien d'inertie. */
class LfoVu final : public juce::Component {
public:
    /** Avance l'aiguille (dt en s) vers la valeur du LFO (-1..1 ; NaN : HELL coupe, l'aiguille revient a 0). */
    void tick(float lfo, float dt);
    void paint(juce::Graphics&) override;

private:
    float x_ = 0, v_ = 0, drawn_ = 99;
    bool on_ = false, drawnOn_ = false;
    Cached face_;
};

/** L'ECHO MAP : chaque repetition, sa hauteur (Hz, echelle log) et son niveau, calcules depuis les reglages. */
class EchoMap final : public juce::Component {
public:
    void update(const mmhell::HellPatch& p, double mix, double bpm, double noteHz);
    void paint(juce::Graphics&) override;

private:
    struct Dot {
        int k;        // la repetition (1..)
        double hz;    // sa frequence
        double amp;   // son niveau (0..1)
        int chain;    // 0 : celle qui part de gauche, 1 : de droite
        bool folded;  // repliee sous 0 Hz
    };
    std::vector<Dot> dots_;
    mmhell::HellPatch last_;
    double lastMix_ = -1, lastBpm_ = -1, lastNote_ = -1, f0_ = 440, hp_ = 0, lp_ = 0;
    bool valid_ = false, spread_ = false, folded_ = false;
    juce::String head_, foot_;
    Cached glass_;
};

/** La fenetre des presets : numero, nom, description ; un clic deroule la banque. */
class PresetWindow final : public juce::Component {
public:
    std::function<void(int)> onLoad;
    /** Le preset reconnu (-1 : tes reglages) et le dernier charge. */
    void set(int match, int lastLoaded);
    void paint(juce::Graphics&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseEnter(const juce::MouseEvent&) override { repaint(); }
    void mouseExit(const juce::MouseEvent&) override { repaint(); }

private:
    int match_ = -2, last_ = -1;
    Cached glass_;
};

/** Le style des menus (la banque deroulee) : verre noir, la police de la face, l'accent. */
class MenuLook final : public juce::LookAndFeel_V4 {
public:
    MenuLook();
    void drawPopupMenuBackground(juce::Graphics&, int width, int height) override;
    void drawPopupMenuItem(juce::Graphics&, const juce::Rectangle<int>& area, bool isSeparator, bool isActive, bool isHighlighted, bool isTicked,
                           bool hasSubMenu, const juce::String& text, const juce::String& shortcutKeyText, const juce::Drawable* icon,
                           const juce::Colour* textColour) override;
    void drawPopupMenuSectionHeader(juce::Graphics&, const juce::Rectangle<int>& area, const juce::String& sectionName) override;
    juce::Font getPopupMenuFont() override;
    void getIdealPopupMenuItemSize(const juce::String& text, bool isSeparator, int standardMenuItemHeight, int& idealWidth, int& idealHeight) override;
};

/**
 * Le panneau SETTINGS (v1.1, celui du MM-ARP : LookPanel.tsx, face.css .mm-look) : LEATHER TEXTURE, PANEL LIGHT, ACCENT
 * COLOR (la roue des teintes vives et sa pastille), RESET. Glisser sur un rail, molette, double-clic : la valeur de depart.
 */
class SettingsPanel final : public juce::Component, private juce::ChangeListener {
public:
    SettingsPanel();
    ~SettingsPanel() override;
    static constexpr int kW = 248, kH = 160;
    void paint(juce::Graphics&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseDrag(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;
    void mouseMove(const juce::MouseEvent&) override;
    void mouseExit(const juce::MouseEvent&) override;
    void mouseDoubleClick(const juce::MouseEvent&) override;
    void mouseWheelMove(const juce::MouseEvent&, const juce::MouseWheelDetails&) override;
    /** Le rail i (0 cuir, 1 lumiere, 2 couleur) : sa zone (les tests y cliquent). */
    juce::Rectangle<float> rail(int i) const;
    juce::Rectangle<float> resetArea() const { return {static_cast<float>(kW) - 14 - 44, 9, 44, 16}; }

private:
    void changeListenerCallback(juce::ChangeBroadcaster*) override { repaint(); }
    int rowAt(juce::Point<float> p) const;
    float get(int i) const;
    void put(int i, float v);
    SharedLook look_;
    int drag_ = -1;
    bool resetHot_ = false;
};

/** Le verre noir des ecrans (hood.css .mm-hell-pwin). */
void paintGlass(juce::Graphics& g, juce::Rectangle<float> r, float radius = 4.f);

} // namespace hl
