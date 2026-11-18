// MM-HELL, le dessin : la serigraphie, les couleurs et les pieces de la face du MM-ARP (src/v4/plugin/arp/hood.css,
// retro/*.png), en natif. Rien n'est recalcule a chaque image : les images sont mises a l'echelle une fois, a la resolution
// reelle de l'ecran (l'echelle de la fenetre x celle de l'ecran Retina), et gardees.
#pragma once

#include <juce_gui_basics/juce_gui_basics.h>
#include <juce_data_structures/juce_data_structures.h>

#include <functional>

namespace hl {

// les couleurs de la face (hood.css : --r-silk, --r-led, --mm-accent...)
const juce::Colour kSilk = juce::Colour::fromFloatRGBA(240 / 255.f, 234 / 255.f, 224 / 255.f, 0.84f);
const juce::Colour kSilkDim = juce::Colour::fromFloatRGBA(240 / 255.f, 234 / 255.f, 224 / 255.f, 0.55f);
const juce::Colour kSilkFaint = juce::Colour::fromFloatRGBA(240 / 255.f, 234 / 255.f, 224 / 255.f, 0.32f);
const juce::Colour kLine = juce::Colour::fromFloatRGBA(240 / 255.f, 234 / 255.f, 224 / 255.f, 0.2f);
const juce::Colour kLedOff(0xff3e1d1b);
const juce::Colour kInk(0xff0b0b0c);
const juce::Colour kGlass(0xff0b0906);
const juce::Colour kCream(0xffe6dcc2);

/** La couleur d'accent du moment (ACCENT COLOR des SETTINGS ; #FF0066 au depart). */
juce::Colour accent();
/** Une teinte vive (degres) a la saturation et la luminosite de #FF0066 (TSV 100 %, 100 % ; accent.ts du MM-ARP). */
juce::Colour hueColour(float hueDeg);

/**
 * Les reglages d'aspect (2026-11-18, v1.1, Mika : "un bouton settings dans un menu hamburger, a gauche", comme les SETTINGS
 * du MM-ARP, look.ts) : LEATHER TEXTURE (0 la laque lisse a 1 le cuir plein ; 0.7), PANEL LIGHT (0.5 neutre), ACCENT COLOR
 * (une teinte, 336 = #FF0066). Pas des parametres de l'hote : un reglage de l'atelier, le meme pour toutes les instances
 * de MM-HELL, garde sur le Mac (~/Library/Application Support/Maudite Machine/MM-HELL.settings). Les fenetres ouvertes
 * l'ecoutent (ChangeBroadcaster) et se redessinent.
 */
class Look final : public juce::ChangeBroadcaster {
public:
    struct State {
        float leather = 0.7f;
        float light = 0.5f;
        int hue = 336;
    };
    Look();
    ~Look() override;
    State state() const { return s_; }
    void set(State s);
    void reset() { set(State{}); }

private:
    std::unique_ptr<juce::PropertiesFile> file_;
    State s_;
};
/** Le Look partage (vit tant qu'une fenetre le tient). */
using SharedLook = juce::SharedResourcePointer<Look>;

enum class Weight { Medium, Semibold, Bold };
/** La police de la face (SF Pro Display), en points (comme le font-size du CSS), tracking en em. */
juce::Font font(float pt, Weight w = Weight::Semibold, float tracking = 0.f);
/** Le wordmark MAUDITE MACHINE (Robot Radicals). */
juce::Font logoFont(float pt);

enum class Img { Knob, KnobCap, Key, Leather, ToggleBody, LeverOff, LeverOn, WoodL, WoodR };
const juce::Image& image(Img id);

/** L'echelle physique du contexte (fenetre x ecran) : la resolution des caches. */
float physicalScale(juce::Graphics& g);

/** Une image gardee, refaite seulement si sa taille physique change. */
class Cached {
public:
    /** w, h : la taille logique ; render dessine dans un Graphics deja mis a l'echelle (unites logiques). */
    const juce::Image& get(float w, float h, float phys, const std::function<void(juce::Graphics&)>& render);
    void clear() { img_ = {}; }
    /** L'image source mise a la taille physique (w, h logiques x phys), gardee. */
    const juce::Image& image(Img id, float w, float h, float phys);

private:
    juce::Image img_;
    int pw_ = 0, ph_ = 0;
};

/** Une image source mise a la taille voulue (pixels physiques), par moities successives (sans crenelage). */
juce::Image rescale(const juce::Image& src, int w, int h);
/** Dessine une image source dans r (unites logiques) a la resolution physique, avec son cache. */
void drawScaled(juce::Graphics& g, Cached& cache, Img id, juce::Rectangle<float> r, float phys);

/** Le texte de serigraphie, une ligne. */
void text(juce::Graphics& g, const juce::String& s, juce::Rectangle<float> r, const juce::Font& f, juce::Colour c,
          juce::Justification j = juce::Justification::centred);
/** Une LED a lentille (hood.css .mm-p2-led) : eteinte, ou allumee a l'accent avec son halo. */
void led(juce::Graphics& g, juce::Point<float> c, float d, bool on);
/** Le fond du panneau (cuir, laque, joues de bois) sur tout le plan, avec LEATHER TEXTURE et PANEL LIGHT. */
void paintPanel(juce::Graphics& g, juce::Rectangle<float> area, const Look::State& look);

} // namespace hl
