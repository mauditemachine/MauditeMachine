// MM-RAGE, le banc de l'interface (la vraie fenetre, sans hote ni son ; Linux : sous xvfb-run) : les gestes de la souris
// sur les pieces vont bien aux parametres de l'hote, et l'interface suit l'automation.
//   glisser un potard (160 points = toute la course, Maj : 4 fois plus fin), double-clic et Alt + clic : la valeur par
//   defaut, molette ; un levier bascule ; les touches de STYLE (deux rangees, un parametre) ; les onglets des pages ; les
//   filtres, la caisse et les bandes grises tant qu'ils ne font rien ; la carte des bandes (tirer une coupure) ; le
//   selecteur MORPH TO ; LFO SYNC ; PREV / NEXT / INIT ; l'automation ; les tailles des potards ; le potard qui tourne
//   (cannelures et reperes) sous des reflets fixes ; SETTINGS ; la taille de la fenetre.
#include "PluginEditor.h"

#include <cmath>
#include <cstdio>
#include <vector>

static int fails = 0;
static void check(bool ok, const char* what) {
    std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what);
    if (!ok) ++fails;
}

static juce::MouseEvent ev(juce::Component* c, juce::Point<float> pos, juce::Point<float> down, juce::ModifierKeys mods = {}, int clicks = 1, bool dragged = false) {
    return juce::MouseEvent(juce::Desktop::getInstance().getMainMouseSource(), pos, mods, juce::MouseInputSource::defaultPressure, 0, 0, 0, 0, c, c,
                            juce::Time::getCurrentTime(), down, juce::Time::getCurrentTime(), clicks, dragged);
}

// Un glisser vertical de dy points (vers le haut si positif), en n pas
static void drag(juce::Component* c, float dy, juce::ModifierKeys mods = {}, int n = 8) {
    const juce::Point<float> p0(c->getWidth() / 2.f, 30.f);
    c->mouseDown(ev(c, p0, p0, mods));
    for (int i = 1; i <= n; ++i) c->mouseDrag(ev(c, p0.translated(0, -dy * i / n), p0, mods, 1, true));
    c->mouseUp(ev(c, p0.translated(0, -dy), p0, mods, 1, true));
}

static void click(juce::Component* c, juce::Point<float> p, juce::ModifierKeys mods = {}, int clicks = 1) {
    c->mouseDown(ev(c, p, p, mods, clicks));
    c->mouseUp(ev(c, p, p, mods, clicks));
    if (clicks == 2) c->mouseDoubleClick(ev(c, p, p, mods, 2));
}

static float norm(MMRageProcessor& p, const std::string& id) { return p.apvts.getParameter(id)->getValue(); }

// A l'ecran (la fenetre n'est pas sur le bureau : isShowing ne vaut rien ici) : la piece et sa page visibles
static bool shown(juce::Component* c) {
    for (; c != nullptr && c->getParentComponent() != nullptr; c = c->getParentComponent())
        if (!c->isVisible()) return false;
    return c != nullptr;
}

template <typename T>
static T* ctl(MMRageEditor* e, const std::string& id) {
    return dynamic_cast<T*>(e->control(id));
}

int main() {
    juce::ScopedJuceInitialiser_GUI init;
    MMRageProcessor p;
    p.setPlayConfigDetails(2, 2, 48000, 512);
    p.prepareToPlay(48000, 512);
    std::unique_ptr<juce::AudioProcessorEditor> ed(p.createEditor());
    auto* re = dynamic_cast<MMRageEditor*>(ed.get());
    if (re == nullptr) return 2;
    re->refresh(0.03f);

    // 0. la taille : 1200 de large a l'ouverture (120 %), proportions du plan 1000 x 620 ; la page RAGE
    check(ed->getWidth() == 1200 && ed->getHeight() == 744 && ed->isResizable() && re->page() == 0, "fenetre : 1200 x 744 a l'ouverture, redimensionnable, page RAGE");

    // 1. DRIVE : 80 points vers le bas = -0.5 (borne a 0), Maj ; double-clic : 25 % ; molette
    if (auto* drive = ctl<rl::Knob>(re, pid::drive)) {
        drag(drive, 40); // 0.25 + 0.25
        const float a = norm(p, pid::drive);
        drag(drive, -80, juce::ModifierKeys::shiftModifier); // -0.125
        const float b = norm(p, pid::drive);
        click(drive, drive->centre(), {}, 2);
        const float c = norm(p, pid::drive);
        drive->mouseWheelMove(ev(drive, drive->centre(), drive->centre()), juce::MouseWheelDetails{0.f, 0.2f, false, false, false});
        const float d = norm(p, pid::drive);
        char msg[200];
        std::snprintf(msg, sizeof msg, "DRIVE : 0.25 -> glisser +40 : %.3f, Maj -80 : %.3f, double-clic : %.3f, molette : %.3f", a, b, c, d);
        check(std::fabs(a - 0.5f) < 1e-3f && std::fabs(b - 0.375f) < 1e-3f && std::fabs(c - 0.25f) < 1e-6f && d > 0.27f && d < 0.29f, msg);
    } else {
        check(false, "DRIVE trouve");
    }
    // 2. Alt + clic : la valeur par defaut (MIX 100 %)
    if (auto* mix = ctl<rl::Knob>(re, pid::mix)) {
        drag(mix, -100);
        const float a = norm(p, pid::mix);
        click(mix, mix->centre(), juce::ModifierKeys::altModifier);
        check(a < 0.4f && std::fabs(norm(p, pid::mix) - 1.f) < 1e-6f, "MIX : glisse vers le bas puis Alt + clic : 100 %");
    }
    // 3. PUNISH bascule, le texte du DRIVE suit (+20 dB)
    if (auto* punish = ctl<rl::Lever>(re, pid::punish)) {
        const juce::String before = ctl<rl::Knob>(re, pid::drive)->valueText();
        click(punish, {36, 14});
        const juce::String after = ctl<rl::Knob>(re, pid::drive)->valueText();
        const bool on = p.patch().punish;
        click(punish, {36, 14});
        char msg[200];
        std::snprintf(msg, sizeof msg, "PUNISH : un clic leve (DRIVE %s -> %s), un clic baisse", before.toRawUTF8(), after.toRawUTF8());
        const double d = p.patch().drive;
        check(on && !p.patch().punish && before == juce::String(mmrage::text::drive(d, false)) && after == juce::String(mmrage::text::drive(d, true)), msg);
    }
    // 4. STYLE : deux rangees, un parametre ; la 2e touche d'EXTENDED (FUZZ), puis la 4e de CLASSIC (T)
    {
        auto* ext = ctl<rl::KeyRow>(re, "styleExtended");
        auto* cls = ctl<rl::KeyRow>(re, "styleClassic");
        if (ext && cls) {
            click(ext, ext->keyRect(1).getCentre());
            const int a = p.patch().style;
            click(cls, cls->keyRect(3).getCentre());
            const int b = p.patch().style;
            check(a == 6 && b == 3 && cls->index() == 3 && ext->index() == 3 && ext->valueText() == "T", "STYLE : EXTENDED 2e touche = FUZZ, CLASSIC 4e touche = T");
        } else {
            check(false, "STYLE trouve");
        }
    }
    // 5. les onglets : SHAPE ; les reglages du PRE FILTER gris tant qu'il est OFF, puis LP
    {
        auto& tabs = re->tabs();
        click(&tabs, tabs.tabRect(1).getCentre());
        re->refresh(0.03f);
        auto* freq = ctl<rl::Knob>(re, pid::preFreq);
        const bool onPage = re->page() == 1 && p.page() == 1 && freq && shown(freq) && !shown(ctl<rl::Knob>(re, pid::morph));
        const bool greyBefore = freq && freq->inert();
        auto* mode = ctl<rl::KeyRow>(re, pid::preMode);
        if (mode) click(mode, mode->keyRect(1).getCentre());
        re->refresh(0.03f);
        check(onPage && greyBefore && p.patch().preMode == 1 && freq && !freq->inert(), "onglet SHAPE : la page change ; FREQ gris avec PRE OFF, actif avec LP");
    }
    // 6. BANDS : 3 bandes, les rangees s'allument ; une coupure tiree sur la carte
    {
        auto& tabs = re->tabs();
        click(&tabs, tabs.tabRect(2).getCentre());
        re->refresh(0.03f);
        auto* midDrive = ctl<rl::Knob>(re, pid::band(1, "Drive"));
        const bool greyBefore = midDrive && midDrive->inert();
        auto* nb = ctl<rl::KeyRow>(re, pid::bands);
        if (nb) click(nb, nb->keyRect(2).getCentre());
        re->refresh(0.03f);
        auto* map = dynamic_cast<rl::BandMap*>(re->control("bandMap"));
        bool dragged = false;
        if (map) {
            map->update(p.patch());
            const float x0 = map->xOf(mmarp::Decap::xLoHzOf(p.patch().xLo));
            const float y = map->getHeight() / 2.f;
            const float x1 = map->xOf(300);
            map->mouseDown(ev(map, {x0, y}, {x0, y}));
            map->mouseDrag(ev(map, {x1, y}, {x0, y}, {}, 1, true));
            map->mouseUp(ev(map, {x1, y}, {x0, y}, {}, 1, true));
            dragged = std::fabs(mmarp::Decap::xLoHzOf(p.patch().xLo) - 300) < 6;
        }
        char msg[200];
        std::snprintf(msg, sizeof msg, "BANDS : la rangee MID grise a 1 bande (%d), 3 bandes : active (%d) ; XOVER LOW tiree a %.0f Hz", greyBefore,
                      midDrive && !midDrive->inert(), mmarp::Decap::xLoHzOf(p.patch().xLo));
        check(greyBefore && p.patch().bands == 3 && midDrive && !midDrive->inert() && dragged, msg);
    }
    // 7. MORPH TO : la molette passe au voisin
    {
        auto& tabs = re->tabs();
        click(&tabs, tabs.tabRect(0).getCentre());
        auto* sel = ctl<rl::Selector>(re, pid::morphTo);
        if (sel) {
            sel->mouseWheelMove(ev(sel, {20, 10}, {20, 10}), juce::MouseWheelDetails{0.f, -0.3f, false, false, false});
            sel->mouseWheelMove(ev(sel, {20, 10}, {20, 10}), juce::MouseWheelDetails{0.f, -0.3f, false, false, false});
        }
        check(sel && p.patch().morphTo == 2 && sel->valueText() == "N", "MORPH TO : deux crans de molette, A -> N");
    }
    // 8. MOVE : SYNC leve, RATE passe aux notes ; une cible
    {
        auto& tabs = re->tabs();
        click(&tabs, tabs.tabRect(3).getCentre());
        re->refresh(0.03f);
        auto* rate = ctl<rl::Knob>(re, pid::lfoRate);
        auto* note = ctl<rl::Knob>(re, pid::lfoNote);
        const bool freeShown = rate && shown(rate) && note && !shown(note);
        if (auto* sync = ctl<rl::Lever>(re, pid::lfoSync)) click(sync, {36, 14});
        re->refresh(0.03f);
        auto* tgt = ctl<rl::KeyRow>(re, pid::lfoTarget);
        if (tgt) click(tgt, tgt->keyRect(4).getCentre());
        check(freeShown && p.patch().lfoSync && shown(note) && !shown(rate) && note->valueText() == "1/4" && p.patch().lfoTarget == 4,
              "MOVE : SYNC leve, RATE en notes (1/4) ; TARGET 5e touche = POST");
    }
    // 9. PREV / NEXT / INIT, et la fenetre des presets qui suit
    {
        std::vector<rl::KeyButton*> keys;
        std::function<void(juce::Component*)> walk = [&](juce::Component* c) {
            for (auto* k : c->getChildren()) {
                if (auto* b = dynamic_cast<rl::KeyButton*>(k)) keys.push_back(b);
                walk(k);
            }
        };
        walk(ed.get());
        rl::KeyButton *prev = nullptr, *nx = nullptr, *ini = nullptr;
        for (auto* b : keys) {
            if (b->title() == "PREV") prev = b;
            if (b->title() == "NEXT") nx = b;
            if (b->title() == "INIT") ini = b;
        }
        if (ini) click(ini, {20, 10});
        const bool a = mmrage::match(p.patch()) == mmrage::initIndex();
        if (nx) click(nx, {20, 10});
        if (nx) click(nx, {20, 10});
        const bool b = mmrage::match(p.patch()) == 2;
        if (prev) click(prev, {20, 10});
        if (prev) click(prev, {20, 10});
        if (prev) click(prev, {20, 10});
        const bool c = mmrage::match(p.patch()) == static_cast<int>(mmrage::factory().size()) - 1;
        check(a && b && c, "INIT, NEXT x2 (TAPE KISS), PREV x3 (le dernier, en boucle)");
    }
    // 10. l'automation de l'hote bouge les pieces
    {
        p.apvts.getParameter(pid::tone)->setValueNotifyingHost(0.8f);
        auto* st = p.apvts.getParameter(pid::style);
        st->setValueNotifyingHost(st->convertTo0to1(10));
        auto* tone = ctl<rl::Knob>(re, pid::tone);
        auto* ext = ctl<rl::KeyRow>(re, "styleExtended");
        check(tone && std::fabs(tone->value01() - 0.8f) < 1e-6f && ext && ext->index() == 10, "automation : TONE 80 % et STYLE FOLD arrivent aux pieces");
    }
    // 11. les tailles selon l'importance : DRIVE > TONE > LOW CUT > FREQ > DRIVE d'une bande
    {
        auto* d = ctl<rl::Knob>(re, pid::drive);
        auto* t = ctl<rl::Knob>(re, pid::tone);
        auto* l = ctl<rl::Knob>(re, pid::low);
        auto* f = ctl<rl::Knob>(re, pid::preFreq);
        auto* b = ctl<rl::Knob>(re, pid::band(0, "Drive"));
        check(d && t && l && f && b && d->knobSize() > t->knobSize() && t->knobSize() > l->knobSize() && l->knobSize() > f->knobSize() && f->knobSize() > b->knobSize(),
              "tailles : DRIVE > TONE > LOW CUT > FREQ > DRIVE d'une bande");
    }
    // 12. le potard tourne : les cannelures et les reperes suivent la valeur, les reflets de l'aluminium restent
    {
        juce::AudioParameterFloat prm(juce::ParameterID{"t", 1}, "T", 0.f, 1.f, 0.2f);
        rl::Knob k(prm, 80.f, "TEST");
        k.placeAt(60, 60);
        const auto shot = [&](float v) {
            prm.setValueNotifyingHost(v);
            return k.createComponentSnapshot(k.getLocalBounds(), false, 2.f);
        };
        const juce::Image a = shot(0.2f), b = shot(0.8f);
        const auto c = k.centre() * 2.f;
        const float R = 80.f; // le rayon a l'echelle 2
        // sous le centre (angle 180 degres) : ni l'un ni l'autre repere n'y passe
        double insertDiff = 0, gripDiff = 0;
        int nIns = 0, nGrip = 0;
        for (int dy = -4; dy <= 4; ++dy)
            for (int dx = -4; dx <= 4; ++dx) {
                const auto pi = juce::Point<int>(juce::roundToInt(c.x) + dx, juce::roundToInt(c.y + R * 0.3f) + dy);
                const auto pa = a.getPixelAt(pi.x, pi.y), pb = b.getPixelAt(pi.x, pi.y);
                insertDiff += std::fabs(pa.getBrightness() - pb.getBrightness());
                ++nIns;
            }
        for (int i = 0; i < 360; ++i) {
            const float t = juce::degreesToRadians(static_cast<float>(i));
            const auto pg = juce::Point<int>(juce::roundToInt(c.x + std::sin(t) * R * 0.76f), juce::roundToInt(c.y - std::cos(t) * R * 0.76f));
            gripDiff += std::fabs(a.getPixelAt(pg.x, pg.y).getBrightness() - b.getPixelAt(pg.x, pg.y).getBrightness());
            ++nGrip;
        }
        char msg[200];
        std::snprintf(msg, sizeof msg, "potard : l'aluminium ne bouge pas (ecart %.4f), les cannelures tournent (ecart %.4f)", insertDiff / nIns, gripDiff / nGrip);
        check(insertDiff / nIns < 0.002 && gripDiff / nGrip > 0.01, msg);
    }
    // 13. le menu et le panneau SETTINGS (LEATHER TEXTURE 100 au depart, PANEL LIGHT, ACCENT COLOR, RESET), un clic dehors le ferme
    {
        rl::SharedLook look;
        look->reset();
        re->showSettings(true);
        auto& sp = re->settingsPanel();
        const bool open = re->settingsShown() && sp.isVisible();
        const auto r0 = sp.rail(0), r1 = sp.rail(1), r2 = sp.rail(2);
        click(&sp, {r0.getX(), r0.getCentreY()});
        click(&sp, {r1.getRight(), r1.getCentreY()});
        click(&sp, {r2.getCentreX(), r2.getCentreY()});
        const auto st = look->state();
        const bool set = st.leather < 0.01f && st.light > 0.99f && st.hue == 180 && rl::accent() == rl::hueColour(180);
        sp.mouseDoubleClick(ev(&sp, {r0.getCentreX(), r0.getCentreY()}, {r0.getCentreX(), r0.getCentreY()}, {}, 2));
        const bool dbl = std::fabs(look->state().leather - 1.f) < 1e-6f;
        click(&sp, sp.resetArea().getCentre());
        const auto d = look->state();
        const bool reset = std::fabs(d.leather - 1.f) < 1e-6f && std::fabs(d.light - 0.5f) < 1e-6f && d.hue == 336 && rl::accent() == juce::Colour(0xffff0066);
        juce::Component* scrim = nullptr;
        for (auto* c : sp.getParentComponent()->getChildren())
            if (c != &sp && c->isVisible() && c->getBounds() == sp.getParentComponent()->getLocalBounds() && dynamic_cast<rl::Control*>(c) == nullptr &&
                c->getNumChildComponents() == 0)
                scrim = c;
        if (scrim) click(scrim, {600, 300});
        char msg[200];
        std::snprintf(msg, sizeof msg, "SETTINGS : ouvert %d, rails (cuir 0, lumiere 100, teinte 180) %d, double-clic cuir 100 %d, RESET (100, 50, #FF0066) %d, clic dehors ferme %d",
                      open, set, dbl, reset, !re->settingsShown());
        check(open && set && dbl && reset && scrim && !re->settingsShown(), msg);
    }
    // 14. la taille : agrandie, gardee par le processeur
    {
        ed->setSize(1600, 992);
        check(p.editorWidth() == 1600, "agrandie a 1600 : la taille est gardee pour le projet");
    }
    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "OK", fails, fails > 1 ? "s" : "");
    ed.reset();
    return fails ? 1 : 0;
}
