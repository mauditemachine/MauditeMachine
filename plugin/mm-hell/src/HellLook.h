// MM-HELL, le dessin : la serigraphie, les couleurs et les pieces de la face du MM-ARP (src/v4/plugin/arp/hood.css,
// retro/*.png), en natif. Rien n'est recalcule a chaque image : les images sont mises a l'echelle une fois, a la resolution
// reelle de l'ecran (l'echelle de la fenetre x celle de l'ecran Retina), et gardees.
#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

#include <functional>

namespace hl {

// les couleurs de la face (hood.css : --r-silk, --r-led, --mm-accent...)
const juce::Colour kSilk = juce::Colour::fromFloatRGBA(240 / 255.f, 234 / 255.f, 224 / 255.f, 0.84f);
const juce::Colour kSilkDim = juce::Colour::fromFloatRGBA(240 / 255.f, 234 / 255.f, 224 / 255.f, 0.55f);
const juce::Colour kSilkFaint = juce::Colour::fromFloatRGBA(240 / 255.f, 234 / 255.f, 224 / 255.f, 0.32f);
const juce::Colour kLine = juce::Colour::fromFloatRGBA(240 / 255.f, 234 / 255.f, 224 / 255.f, 0.2f);
const juce::Colour kAccent(0xffff0066);
const juce::Colour kLedOff(0xff3e1d1b);
const juce::Colour kInk(0xff0b0b0c);
const juce::Colour kGlass(0xff0b0906);
const juce::Colour kCream(0xffe6dcc2);

enum class Weight { Medium, Semibold, Bold };
/** La police de la face (SF Pro Display), en points (comme le font-size du CSS), tracking en em. */
juce::Font font(float pt, Weight w = Weight::Semibold, float tracking = 0.f);
/** Le wordmark MAUDITE MACHINE (Robot Radicals). */
juce::Font logoFont(float pt);

enum class Img { Knob, KnobCap, FineKnob, Key, Leather, ToggleBody, LeverOff, LeverOn, WoodL, WoodR };
const juce::Image& image(Img id);

/** L'echelle physique du contexte (fenetre x ecran) : la resolution des caches. */
float physicalScale(juce::Graphics& g);

/** Une image gardee, refaite seulement si sa taille physique change. */
class Cached {
public:
    /** w, h : la taille logique ; render dessine dans un Graphics deja mis a l'echelle (unites logiques). */
    const juce::Image& get(float w, float h, float phys, const std::function<void(juce::Graphics&)>& render);
    void clear() { img_ = {}; }

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
/** Le fond du panneau (cuir, laque, joues de bois, filets) sur tout le plan. */
void paintPanel(juce::Graphics& g, juce::Rectangle<float> area);

} // namespace hl
