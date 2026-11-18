// MM-HELL, le banc de l'interface (la vraie fenetre, sans hote ni son ; Linux : sous xvfb-run) : les gestes de la souris
// sur les pieces vont bien aux parametres de l'hote, et l'interface suit l'automation.
//   glisser un potard (160 points = toute la course, Maj : 4 fois plus fin), double-clic et Alt + clic : la valeur par
//   defaut, molette ; un levier bascule ; une touche choisit ; PREV / NEXT / INIT ; DELAY passe aux notes avec SYNC ;
//   la fenetre a la taille du projet, proportions fixes.
#include "PluginEditor.h"

#include <cmath>
#include <cstdio>
#include <vector>

static int fails = 0;
static void check(bool ok, const char* what) {
    std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what);
    if (!ok) ++fails;
}

template <typename T>
static T* find(juce::Component* root, const juce::String& title) {
    for (auto* c : root->getChildren()) {
        if (auto* t = dynamic_cast<T*>(c))
            if (t->title() == title && t->isVisible()) return t;
        if (auto* t = find<T>(c, title)) return t;
    }
    return nullptr;
}

static juce::MouseEvent ev(juce::Component* c, juce::Point<float> pos, juce::Point<float> down, juce::ModifierKeys mods = {}, int clicks = 1, bool dragged = false) {
    return juce::MouseEvent(juce::Desktop::getInstance().getMainMouseSource(), pos, mods, juce::MouseInputSource::defaultPressure, 0, 0, 0, 0, c, c,
                            juce::Time::getCurrentTime(), down, juce::Time::getCurrentTime(), clicks, dragged);
}

// Un glisser vertical de dy points (vers le haut si positif), en n pas
static void drag(juce::Component* c, float dy, juce::ModifierKeys mods = {}, int n = 8) {
    const juce::Point<float> p0(c->getWidth() / 2.f, 20.f);
    c->mouseDown(ev(c, p0, p0, mods));
    for (int i = 1; i <= n; ++i) c->mouseDrag(ev(c, p0.translated(0, -dy * i / n), p0, mods, 1, true));
    c->mouseUp(ev(c, p0.translated(0, -dy), p0, mods, 1, true));
}

static void click(juce::Component* c, juce::Point<float> p, juce::ModifierKeys mods = {}, int clicks = 1) {
    c->mouseDown(ev(c, p, p, mods, clicks));
    c->mouseUp(ev(c, p, p, mods, clicks));
    if (clicks == 2) c->mouseDoubleClick(ev(c, p, p, mods, 2));
}

static float norm(MMHellProcessor& p, const char* id) { return p.apvts.getParameter(id)->getValue(); }

int main() {
    juce::ScopedJuceInitialiser_GUI init;
    MMHellProcessor p;
    p.setPlayConfigDetails(2, 2, 48000, 512);
    p.prepareToPlay(48000, 512);
    std::unique_ptr<juce::AudioProcessorEditor> ed(p.createEditor());
    auto* he = dynamic_cast<MMHellEditor*>(ed.get());
    if (he == nullptr) return 2;
    he->refresh(0.03f);

    // 0. la taille : 1200 de large a l'ouverture (120 %), proportions du plan 1000 x 620
    check(ed->getWidth() == 1200 && ed->getHeight() == 744 && ed->isResizable(), "fenetre : 1200 x 744 a l'ouverture, redimensionnable");

    // 1. FEEDBACK : 80 points vers le haut = +0.5 ; Maj : 80 points = +0.125 ; double-clic : 0.5 ; molette
    auto* fb = find<hl::Knob>(ed.get(), "FEEDBACK");
    check(fb != nullptr, "FEEDBACK trouve");
    if (fb) {
        const float v0 = norm(p, pid::feedback);
        drag(fb, -40); // vers le bas : 0.5 - 0.25
        const float a = norm(p, pid::feedback);
        drag(fb, 80, juce::ModifierKeys::shiftModifier);
        const float b = norm(p, pid::feedback);
        click(fb, {fb->getWidth() / 2.f, 20.f}, {}, 2);
        const float c = norm(p, pid::feedback);
        fb->mouseWheelMove(ev(fb, {40, 20}, {40, 20}), juce::MouseWheelDetails{0.f, 0.2f, false, false, false});
        const float d = norm(p, pid::feedback);
        char msg[200];
        std::snprintf(msg, sizeof msg, "FEEDBACK : 0.50 -> glisser -40 : %.3f, Maj +80 : %.3f, double-clic : %.3f, molette : %.3f", a, b, c, d);
        check(std::fabs(v0 - 0.5f) < 1e-6f && std::fabs(a - 0.25f) < 1e-3f && std::fabs(b - 0.375f) < 1e-3f && std::fabs(c - 0.5f) < 1e-6f && d > 0.52f && d < 0.54f, msg);
    }
    // 2. Alt + clic : la valeur par defaut (MIX 35 %)
    auto* mix = find<hl::Knob>(ed.get(), "MIX");
    if (mix) {
        drag(mix, 100);
        const float a = norm(p, pid::mix);
        click(mix, {mix->getWidth() / 2.f, 20.f}, juce::ModifierKeys::altModifier);
        check(a > 0.9f && std::fabs(norm(p, pid::mix) - 0.35f) < 1e-6f, "MIX : glisse au maximum puis Alt + clic : 35 %");
    }
    // 3. un levier bascule (CROSS), une touche choisit (RANGE : WIDE)
    auto* cross = find<hl::Lever>(ed.get(), "CROSS");
    if (cross) {
        click(cross, {36, 14});
        const bool on = p.patch().cross;
        click(cross, {36, 14});
        check(on && !p.patch().cross, "CROSS : un clic leve, un clic baisse");
    }
    auto* target = find<hl::KeyRow>(ed.get(), "TARGET");
    if (target) {
        // la 3e touche (LOW-PASS) : 8 + 2 x (40 + 10) + 20
        click(target, {8 + 2 * 50.f + 20, 22});
        check(p.patch().lfoTarget == 2 && target->index() == 2, "TARGET : la 3e touche choisit LOW-PASS");
    }
    // 4. SYNC baisse : le potard DELAY passe aux millisecondes (et revient aux notes)
    {
        auto* sync = find<hl::Lever>(ed.get(), "SYNC");
        auto* delay = find<hl::Knob>(ed.get(), "DELAY");
        const juce::String before = delay ? delay->valueText() : "";
        if (sync) click(sync, {36, 14});
        he->refresh(0.03f);
        auto* delay2 = find<hl::Knob>(ed.get(), "DELAY");
        const juce::String after = delay2 ? delay2->valueText() : "";
        if (delay2) drag(delay2, 32); // +0.2 : 100 ms -> 5 x 400^0.7
        const bool timeMoved = std::fabs(p.patch().time - 0.7) < 1e-3;
        char msg[200];
        std::snprintf(msg, sizeof msg, "SYNC baisse : DELAY passe de %s a %s, glisse +32 : TIME 0.70 (%s)", before.toRawUTF8(), after.toRawUTF8(),
                      juce::String(mmhell::text::time(p.patch().time)).toRawUTF8());
        check(before == "1/8." && after == "100 MS" && timeMoved && !p.patch().sync, msg);
    }
    // 5. PREV / NEXT / INIT, et la fenetre des presets qui suit
    {
        auto* next = find<hl::KeyButton>(ed.get(), "NEXT");
        auto* prev = find<hl::KeyButton>(ed.get(), "PREV");
        auto* initK = find<hl::KeyButton>(ed.get(), "INIT");
        if (initK) click(initK, {20, 10});
        const bool a = mmhell::match(p.patch()) == mmhell::initIndex();
        if (next) click(next, {20, 10});
        const bool b = mmhell::match(p.patch()) == mmhell::initIndex() + 1;
        if (prev) click(prev, {20, 10});
        if (prev) click(prev, {20, 10});
        const bool c = mmhell::match(p.patch()) == mmhell::initIndex() - 1;
        check(a && b && c && std::fabs(norm(p, pid::mix) - 0.35f) < 1e-6f, "INIT, NEXT (SULFUR RAIN), PREV x2 (DEEP STAIRS) ; MIX garde");
    }
    // 6. l'automation de l'hote bouge les pieces
    {
        auto* prm = p.apvts.getParameter(pid::smear);
        prm->setValueNotifyingHost(0.8f);
        auto* smear = find<hl::Knob>(ed.get(), "SMEAR");
        auto* range = p.apvts.getParameter(pid::range);
        range->setValueNotifyingHost(range->convertTo0to1(3));
        auto* rangeRow = dynamic_cast<hl::KeyRow*>(find<hl::KeyRow>(ed.get(), ""));
        check(smear && std::fabs(smear->value01() - 0.8f) < 1e-6f && rangeRow && rangeRow->index() == 3, "automation : SMEAR 80 % et RANGE MIDI arrivent aux pieces");
    }
    // 8. v1.1 : les potards tournent (le corps suit la valeur), un seul modele en tailles selon l'importance
    {
        auto* shift = find<hl::Knob>(ed.get(), "SHIFT");
        auto* mixK = find<hl::Knob>(ed.get(), "MIX");
        auto* fbK = find<hl::Knob>(ed.get(), "FEEDBACK");
        auto* hpK = find<hl::Knob>(ed.get(), "HIGH-PASS");
        check(shift && mixK && fbK && hpK && shift->knobSize() > mixK->knobSize() && mixK->knobSize() > fbK->knobSize() && fbK->knobSize() > hpK->knobSize(),
              "tailles : SHIFT > MIX > FEEDBACK > HIGH-PASS");
    }
    // 9. v1.1 : le menu et le panneau SETTINGS (LEATHER TEXTURE, PANEL LIGHT, ACCENT COLOR, RESET), un clic dehors le ferme
    {
        hl::SharedLook look;
        look->reset();
        he->showSettings(true);
        auto& sp = he->settingsPanel();
        const bool shown = he->settingsShown() && sp.isVisible();
        // un clic au debut du rail du cuir (0), au bout de celui de la lumiere (100), au milieu de la couleur (180 degres)
        const auto r0 = sp.rail(0), r1 = sp.rail(1), r2 = sp.rail(2);
        click(&sp, {r0.getX(), r0.getCentreY()});
        click(&sp, {r1.getRight(), r1.getCentreY()});
        click(&sp, {r2.getCentreX(), r2.getCentreY()});
        const auto st = look->state();
        const bool set = st.leather < 0.01f && st.light > 0.99f && st.hue == 180 && hl::accent() == hl::hueColour(180);
        sp.mouseDoubleClick(ev(&sp, {r1.getCentreX(), r1.getCentreY()}, {r1.getCentreX(), r1.getCentreY()}, {}, 2));
        const bool dbl = std::fabs(look->state().light - 0.5f) < 1e-6f;
        click(&sp, sp.resetArea().getCentre());
        const auto d = look->state();
        const bool reset = std::fabs(d.leather - 0.7f) < 1e-6f && std::fabs(d.light - 0.5f) < 1e-6f && d.hue == 336 && hl::accent() == juce::Colour(0xffff0066);
        // le voile sous le panneau : un clic dehors le ferme
        juce::Component* scrim = nullptr;
        for (auto* c : sp.getParentComponent()->getChildren())
            if (c != &sp && c->isVisible() && c->getBounds() == sp.getParentComponent()->getLocalBounds()) scrim = c;
        if (scrim) click(scrim, {600, 300});
        char msg[200];
        std::snprintf(msg, sizeof msg, "SETTINGS : ouvert %d, rails (cuir 0, lumiere 100, teinte 180) %d, double-clic %d, RESET (70, 50, #FF0066) %d, clic dehors ferme %d",
                      shown, set, dbl, reset, !he->settingsShown());
        check(shown && set && dbl && reset && scrim && !he->settingsShown(), msg);
    }
    // 7. la taille : agrandie, gardee par le processeur
    {
        ed->setSize(1600, 992);
        check(p.editorWidth() == 1600, "agrandie a 1600 : la taille est gardee pour le projet");
    }
    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "OK", fails, fails > 1 ? "s" : "");
    ed.reset();
    return fails ? 1 : 0;
}
