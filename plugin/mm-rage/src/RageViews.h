// MM-RAGE, les vues : le VU ATTITUDE (ce qui entre dans la saturation), l'ecran TRANSFER (la courbe du moment et la
// lecture STYLE / DRIVE / LEVEL), la carte des bandes (coupures a tirer), la reponse des filtres et de la caisse, le
// mouvement (LFO et enveloppe), la fenetre des presets, le panneau SETTINGS et le style des menus.
#pragma once

#include "RageLook.h"
#include "RagePatch.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <cmath>

namespace rl {

/** Le verre noir des ecrans (hood.css .mm-hell-pwin). */
void paintGlass(juce::Graphics& g, juce::Rectangle<float> r, float radius = 4.f);

/**
 * Le VU ATTITUDE (la page DISTO du MM-ARP, AttitudeVu) : face ivoire, -20 a +3 dB a la loi d'un VU, la zone rouge au-dessus
 * de 0 (la courbe mord), l'aiguille avec un rien d'inertie.
 */
class AttitudeVu final : public juce::Component {
public:
    /** Avance l'aiguille (dt en s) vers le niveau dans la saturation (dB). */
    void tick(float db, float dt);
    void paint(juce::Graphics&) override;
    static float position(float db); // -20..+3 dB -> -1..1 (au-dela : un peu plus)

private:
    float x_ = -1.07f, v_ = 0, drawn_ = 99;
    Cached face_;
};

/** L'ecran TRANSFER : la courbe (style, MORPH, DRIVE), le style vise en fantome, et la lecture STYLE / DRIVE / LEVEL. */
class TransferView final : public juce::Component {
public:
    void update(const mmrage::RagePatch& p);
    void paint(juce::Graphics&) override;

private:
    mmrage::RagePatch last_;
    bool valid_ = false;
    Cached glass_;
};

/**
 * La carte des bandes : 20 Hz a 20 kHz, les bandes (leur style, leur DRIVE, SOLO, BYP) et les coupures, a tirer a la
 * souris (XOVER LOW, XOVER HIGH : des parametres de l'hote).
 */
class BandMap final : public juce::Component {
public:
    BandMap(juce::RangedAudioParameter& xLo, juce::RangedAudioParameter& xHi);
    void update(const mmrage::RagePatch& p);
    void paint(juce::Graphics&) override;
    void mouseMove(const juce::MouseEvent&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseDrag(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;
    void mouseExit(const juce::MouseEvent&) override;
    /** La position x d'une frequence (les tests y cliquent). */
    float xOf(double hz) const;

private:
    juce::Rectangle<float> plot() const;
    double hzAt(float x) const;
    int handleAt(juce::Point<float> p) const;
    juce::RangedAudioParameter &lo_, &hi_;
    juce::ParameterAttachment loAtt_, hiAtt_;
    mmrage::RagePatch p_;
    int drag_ = -1, hot_ = -1;
    Cached glass_;
};

/** La reponse : PRE FILTER, POST FILTER et BOX (gain en dB de 20 Hz a 20 kHz). */
class ResponseView final : public juce::Component {
public:
    void update(const mmrage::RagePatch& p);
    void paint(juce::Graphics&) override;

private:
    mmrage::RagePatch last_;
    bool valid_ = false;
    Cached glass_;
};

/** Le mouvement : la forme du LFO sur une mesure (et sa cible, sa profondeur), l'enveloppe sur un coup. */
class MotionView final : public juce::Component {
public:
    void update(const mmrage::RagePatch& p, double bpm);
    void paint(juce::Graphics&) override;

private:
    mmrage::RagePatch last_;
    double bpm_ = -1;
    bool valid_ = false;
    Cached glass_;
};

/** La fenetre des presets : numero, famille, nom, description ; un clic deroule la banque. */
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
 * Le panneau SETTINGS (celui du MM-ARP et de MM-HELL : LookPanel.tsx, face.css .mm-look) : LEATHER TEXTURE, PANEL LIGHT,
 * ACCENT COLOR (la roue des teintes vives et sa pastille), RESET. Glisser sur un rail, molette, double-clic : la valeur de
 * depart.
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

} // namespace rl
