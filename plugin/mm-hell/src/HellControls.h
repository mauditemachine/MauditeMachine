// MM-HELL, les pieces de la face : le potard du MM-RYTM (retro/knob.png, son repere, son capuchon), le petit knob fin,
// le levier chrome et sa LED, les touches de caoutchouc a LED (un choix parmi plusieurs), les touches d'action. Chacune est
// branchee sur un parametre de l'hote (juce::ParameterAttachment : l'automation suit, un geste s'enregistre).
// Les gestes de la face du MM-ARP : glisser vertical (160 points pour toute la course, Maj : quatre fois plus fin), molette,
// double-clic ou Alt / Cmd + clic : la valeur par defaut.
#pragma once

#include "HellLook.h"

#include <juce_audio_processors/juce_audio_processors.h>

namespace hl {

/** Une piece qui sait se decrire (la bande d'info en bas de la fenetre). */
class Control : public juce::Component {
public:
    virtual juce::String title() const = 0;
    virtual juce::String valueText() const = 0;
    juce::String help;
    /** Survolee ou tenue : la valeur s'affiche sous le nom. */
    bool hot() const { return hover_ || held_; }

protected:
    void mouseEnter(const juce::MouseEvent&) override;
    void mouseExit(const juce::MouseEvent&) override;
    bool hover_ = false, held_ = false;
};

/**
 * Le potard du MM-RYTM (retro/knob.png) en toutes tailles, selon l'importance du reglage (v1.1, Mika : "des knobs comme
 * l'image 1 de tailles differentes selon l'importance, et que les knobs tournent vraiment") : le corps (base, prise a six
 * lobes, repere) tourne avec la valeur ; le capuchon de metal brosse (retro/knob-cap.png) reste fixe par-dessus, sa lumiere
 * ne tourne pas (comme un vrai potard eclaire d'en haut). hero : le gros potard du decaleur, son echelle autour.
 */
class Knob final : public Control {
public:
    Knob(juce::RangedAudioParameter& p, float size, juce::String name, juce::String lo = {}, juce::String hi = {}, bool hero = false);

    /** Place le potard : son centre en (cx, cy) dans le parent. */
    void placeAt(float cx, float cy);
    float knobSize() const;
    juce::Point<float> centre() const;
    /** Dessine sous le potard (l'echelle du FREQUENCY SHIFTER), dans les coordonnees du composant. */
    std::function<void(juce::Graphics&, juce::Point<float>)> under;
    /** Le texte de la valeur (sinon celui du parametre). */
    std::function<juce::String()> textFn;
    /** Le nom affiche (sinon celui donne) : DELAY (NOTE) quand SYNC est leve. */
    std::function<juce::String()> nameFn;
    bool bipolar = false;
    bool showValue = true;

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
    juce::RangedAudioParameter& p_;
    juce::ParameterAttachment att_;
    float size_;
    bool hero_;
    juce::String name_, lo_, hi_;
    float v_ = 0;          // normalise, celui du parametre
    float dragStart_ = 0;  // normalise, au debut du glisser
    float dragAcc_ = 0;    // le glisser continu (un choix a crans ne colle pas)
    bool dragging_ = false;
    Cached body_, cap_;
};

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

/** Une rangee de touches a LED : un choix parmi n (un AudioParameterChoice). */
class KeyRow final : public Control {
public:
    KeyRow(juce::RangedAudioParameter& p, juce::String name, juce::StringArray labels, float keyW = 38.f, float gap = 8.f);
    void placeAt(float cx, float top);
    /** Dessine un pictogramme sur la touche i (les formes du LFO). */
    std::function<void(juce::Graphics&, int, juce::Rectangle<float>)> icon;
    juce::String title() const override { return name_; }
    juce::String valueText() const override;
    int index() const { return idx_; }
    void paint(juce::Graphics&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;
    void mouseMove(const juce::MouseEvent&) override;
    void mouseWheelMove(const juce::MouseEvent&, const juce::MouseWheelDetails&) override;
    juce::String helpFor(int i) const;
    juce::StringArray optionHelp;

private:
    int keyAt(juce::Point<float> p) const;
    juce::Rectangle<float> keyRect(int i) const;
    void choose(int i);
    juce::RangedAudioParameter& p_;
    juce::ParameterAttachment att_;
    juce::String name_;
    juce::StringArray labels_;
    float keyW_, gap_;
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

} // namespace hl
