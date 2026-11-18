// MM-RAGE, les pieces de la face : le potard facon Moog (dessine en vectoriel, sans image : aucun crenelage a aucun angle
// ni a aucune taille), le levier chrome et sa LED, les touches de caoutchouc a LED (un choix parmi plusieurs), les touches
// d'action, l'interrupteur a LED, le selecteur a fenetre, les onglets des pages. Chacune est branchee sur un parametre de
// l'hote (juce::ParameterAttachment : l'automation suit, un geste s'enregistre).
// Les gestes de la face du MM-ARP : glisser vertical (160 points pour toute la course, Maj : quatre fois plus fin), molette,
// double-clic ou Alt / Cmd + clic : la valeur par defaut.
#pragma once

#include "RageLook.h"

#include <juce_audio_processors/juce_audio_processors.h>

namespace rl {

/** Une piece qui sait se decrire (la bande d'info en bas de la fenetre). */
class Control : public juce::Component {
public:
    virtual juce::String title() const = 0;
    virtual juce::String valueText() const = 0;
    juce::String help;
    /** Survolee ou tenue : la valeur s'affiche sous le nom. */
    bool hot() const { return hover_ || held_; }
    /** Sans effet tel que le son est regle (grise). */
    void setInert(bool on);
    bool inert() const { return inert_; }

protected:
    void mouseEnter(const juce::MouseEvent&) override;
    void mouseExit(const juce::MouseEvent&) override;
    bool hover_ = false, held_ = false, inert_ = false;
};

/**
 * Le potard facon Moog (2026-11-18, Mika : "des beaux knobs moog qui tournent bien avec des reflets", "j'aime pas
 * l'aliasing") : une jupe noire et son repere, une prise cannelee, un dessus noir, un insert d'aluminium tourne au centre.
 * Tout ce qui tourne est vectoriel (les cannelures, les reperes) : le trace est lisse a tout angle. Ce qui ne tourne pas
 * (les ombres, les reflets de l'aluminium, le lustre du plastique) reste fixe, comme sous une vraie lumiere : c'est ce qui
 * fait voir la rotation. L'insert est calcule pixel par pixel a la resolution de l'ecran, une fois par taille.
 * Tailles selon l'importance (comme MM-HELL) ; hero : le DRIVE, son echelle en dB autour.
 */
class Knob final : public Control {
public:
    Knob(juce::RangedAudioParameter& p, float size, juce::String name, juce::String lo = {}, juce::String hi = {}, bool hero = false);

    /** Place le potard : son centre en (cx, cy) dans le parent. */
    void placeAt(float cx, float cy);
    float knobSize() const { return size_; }
    juce::Point<float> centre() const;
    /** Le texte de la valeur (sinon celui du parametre). */
    std::function<juce::String()> textFn;
    /** Le nom affiche (sinon celui donne). */
    std::function<juce::String()> nameFn;
    /** L'echelle du potard hero (les dB du DRIVE) : les reperes v (0..1), leurs textes, et un decalage (PUNISH). */
    std::function<juce::String(int)> heroMark;
    bool bipolar = false;
    bool showValue = true;
    bool showName = true;

    juce::String title() const override;
    juce::String valueText() const override;
    float value01() const { return v_; }

    void paint(juce::Graphics&) override;
    bool hitTest(int x, int y) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseDrag(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;
    void mouseDoubleClick(const juce::MouseEvent&) override;
    void mouseWheelMove(const juce::MouseEvent&, const juce::MouseWheelDetails&) override;

private:
    void setNorm(float n, bool gesture);
    void reset();
    float margin() const { return hero_ ? 30.f : 9.f; }
    juce::RangedAudioParameter& p_;
    juce::ParameterAttachment att_;
    float size_;
    bool hero_;
    juce::String name_, lo_, hi_;
    float v_ = 0;          // normalise, celui du parametre
    float dragAcc_ = 0;    // le glisser continu (un choix a crans ne colle pas)
    bool dragging_ = false;
    Cached insert_;
};

/** Dessine le potard facon Moog : centre c, diametre s, angle (radians, 0 en haut, sens horaire). */
void paintMoogKnob(juce::Graphics& g, juce::Point<float> c, float s, float angle, Cached& insert);

class Lever final : public Control {
public:
    Lever(juce::RangedAudioParameter& p, juce::String name, juce::String off = "OFF", juce::String on = "ON");
    void placeAt(float cx, float cy); // le centre du boitier
    juce::String title() const override { return name_; }
    juce::String valueText() const override { return v_ ? onName_ : offName_; }
    void paint(juce::Graphics&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;

private:
    juce::RangedAudioParameter& p_;
    juce::ParameterAttachment att_;
    juce::String name_, offName_, onName_;
    bool v_ = false;
    Cached body_, off_, on_;
};

/**
 * Une rangee de touches a LED : un choix parmi n (un AudioParameterChoice). offset : la rangee ne montre que les choix
 * offset .. offset + labels - 1 (STYLE : CLASSIC et EXTENDED, deux rangees sur le meme parametre).
 */
class KeyRow final : public Control {
public:
    KeyRow(juce::RangedAudioParameter& p, juce::String name, juce::StringArray labels, float keyW = 38.f, float gap = 8.f, int offset = 0);
    void placeAt(float cx, float top);
    /** Dessine un pictogramme sur la touche i (les formes du LFO). */
    std::function<void(juce::Graphics&, int, juce::Rectangle<float>)> icon;
    juce::String title() const override { return name_.isEmpty() ? juce::String(p_.getName(32)) : name_; }
    juce::String valueText() const override;
    int index() const { return idx_; }
    void paint(juce::Graphics&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;
    void mouseMove(const juce::MouseEvent&) override;
    void mouseWheelMove(const juce::MouseEvent&, const juce::MouseWheelDetails&) override;
    juce::String helpFor(int i) const;
    juce::StringArray optionHelp;
    /** La touche i (locale) : sa zone (les tests y cliquent). */
    juce::Rectangle<float> keyRect(int i) const;

private:
    int keyAt(juce::Point<float> p) const;
    void choose(int i);
    juce::RangedAudioParameter& p_;
    juce::ParameterAttachment att_;
    juce::String name_;
    juce::StringArray labels_;
    float keyW_, gap_;
    int offset_;
    int idx_ = 0, pressed_ = -1;
    Cached key_;
};

/** Une touche d'action (PREV, NEXT, INIT). */
class KeyButton final : public Control {
public:
    KeyButton(juce::String name, std::function<void()> onClick, float w = 36.f, float h = 23.f);
    void placeAt(float cx, float top);
    juce::String title() const override { return name_; }
    juce::String valueText() const override { return {}; }
    void paint(juce::Graphics&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;

private:
    juce::String name_;
    std::function<void()> click_;
    float w_, h_;
    Cached key_;
};

/** Une touche a LED qui bascule un reglage ON / OFF (SOLO, BYP des bandes). */
class KeySwitch final : public Control {
public:
    KeySwitch(juce::RangedAudioParameter& p, juce::String name, juce::String label, float w = 30.f);
    void placeAt(float cx, float top);
    juce::String title() const override { return name_; }
    juce::String valueText() const override { return v_ ? "ON" : "OFF"; }
    bool on() const { return v_; }
    void paint(juce::Graphics&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;

private:
    juce::RangedAudioParameter& p_;
    juce::ParameterAttachment att_;
    juce::String name_, label_;
    float w_;
    bool v_ = false;
    Cached key_;
};

/**
 * Un selecteur a fenetre (MORPH TO, STYLE d'une bande) : le choix en clair dans un verre noir, deux chevrons. Un clic
 * deroule la liste ; molette, glisser vertical ou clic sur un chevron : le choix voisin.
 */
class Selector final : public Control {
public:
    Selector(juce::RangedAudioParameter& p, juce::String name, juce::StringArray labels, float w = 104.f, float h = 26.f);
    void placeAt(float cx, float top);
    /** Le texte long du choix (TRIODE, WAVEFOLDER...), montre en petit sous le nom court. */
    std::function<juce::String(int)> longName;
    juce::String title() const override { return name_; }
    juce::String valueText() const override;
    int index() const { return idx_; }
    void paint(juce::Graphics&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseDrag(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;
    void mouseWheelMove(const juce::MouseEvent&, const juce::MouseWheelDetails&) override;
    bool showName = true;

private:
    void choose(int i);
    juce::Rectangle<float> glass() const;
    juce::RangedAudioParameter& p_;
    juce::ParameterAttachment att_;
    juce::String name_;
    juce::StringArray labels_;
    float w_, h_;
    int idx_ = 0;
    float dragAcc_ = 0;
    bool dragged_ = false;
    Cached glass_;
};

/** Les onglets des pages (RAGE, SHAPE, BANDS, MOVE) : un plateau creuse, des touches ; celle de la page allumee. */
class PageTabs final : public juce::Component {
public:
    PageTabs(juce::StringArray names, float tabW = 104.f, float tabH = 26.f, float gap = 6.f);
    std::function<void(int)> onSelect;
    void setCurrent(int i);
    int current() const { return cur_; }
    /** La touche i : sa zone (les tests y cliquent). */
    juce::Rectangle<float> tabRect(int i) const;
    void paint(juce::Graphics&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;
    void mouseMove(const juce::MouseEvent&) override;
    void mouseExit(const juce::MouseEvent&) override;

private:
    int tabAt(juce::Point<float> p) const;
    juce::StringArray names_;
    float tabW_, tabH_, gap_;
    int cur_ = 0, hover_ = -1, pressed_ = -1;
};

} // namespace rl
