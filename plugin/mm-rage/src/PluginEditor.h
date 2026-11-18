// MM-RAGE, la fenetre : une interface native (JUCE, sans WebView), au design du MM-ARP et de MM-HELL (cuir, joues de bois,
// leviers chrome, touches a LED, VU ivoire), de la taille de MM-HELL (un plan de 1000 x 620), en pages (2026-11-18, Mika :
// "si jamais tu ne peux pas, fais plusieurs pages avec des boutons design") :
//   en-tete : le menu (trois traits : SETTINGS, WINDOW SIZE), MAUDITE MACHINE, MM-RAGE, la banque (PREV, la fenetre qui la
//   deroule en familles, NEXT, INIT) ;
//   les onglets RAGE, SHAPE, BANDS, MOVE ; a droite, toujours la : le VU ATTITUDE, le DRIVE (le gros potard), PUNISH, AUTO,
//   MIX et OUTPUT ;
//   RAGE : STYLE (CLASSIC, EXTENDED), l'ecran TRANSFER, MORPH et MORPH TO, LOW CUT et THUMP, TONE, HIGH CUT et STEEP ;
//   SHAPE : PRE FILTER, BOX, POST FILTER, DYNAMICS, FEEDBACK et FB FREQ, la reponse ;
//   BANDS : BANDS, les coupures (et la carte, ou on les tire), la matrice LOW / MID / HIGH (STYLE, DRIVE, MIX, LEVEL, SOLO, BYP) ;
//   MOVE : ENVELOPE -> DRIVE (AMOUNT, SPEED), le LFO (SHAPE, RATE, SYNC, AMOUNT, TARGET) et sa forme sur une mesure ;
//   la bande d'info : la piece survolee, sa valeur, ce qu'elle fait ; le tempo.
// Rafraichi a 30 images/s : seuls le VU (quand l'aiguille bouge) et ce qui a change se redessinent.
#pragma once

#include "PluginProcessor.h"
#include "RageControls.h"
#include "RageViews.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <map>

class MMRageEditor final : public juce::AudioProcessorEditor, private juce::Timer, private juce::ChangeListener {
public:
    explicit MMRageEditor(MMRageProcessor&);
    ~MMRageEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;
    /** Ce que fait le minuteur (le banc de capture l'appelle directement). */
    void refresh(float dt);
    /** Le panneau SETTINGS (le menu hamburger l'ouvre ; les bancs aussi). */
    void showSettings(bool on);
    bool settingsShown() const { return settings_.isVisible(); }
    rl::SettingsPanel& settingsPanel() { return settings_; }
    /** La page (0 RAGE, 1 SHAPE, 2 BANDS, 3 MOVE). */
    void showPage(int i);
    int page() const { return page_; }
    rl::PageTabs& tabs() { return tabs_; }
    /** La taille de la fenetre en pour cent du plan (WINDOW SIZE du menu). */
    void setScalePercent(int pct);
    /** Une piece par l'id de son parametre (les bancs). */
    juce::Component* control(const std::string& id) const;

private:
    void timerCallback() override;
    void changeListenerCallback(juce::ChangeBroadcaster*) override;
    void openMenu();
    void mouseEnter(const juce::MouseEvent&) override;
    void mouseExit(const juce::MouseEvent&) override;
    void mouseMove(const juce::MouseEvent&) override;
    void step(int d);

    // Le plan de 1000 x 620 : le fond (cuir, bois, serigraphie fixe) en cache, a la resolution de l'ecran
    struct Panel final : juce::Component {
        void paint(juce::Graphics&) override;
        rl::Cached bg;
    };
    // Une page : sa serigraphie (titres, filets) en cache ; ses pieces sont ses enfants
    struct Page final : juce::Component {
        std::function<void(juce::Graphics&)> silk;
        rl::Cached bg;
        void paint(juce::Graphics&) override;
    };
    // Le bouton du menu (trois traits), en haut a gauche
    struct Burger final : juce::Component {
        std::function<void()> onClick;
        bool open = false;
        void paint(juce::Graphics&) override;
        void mouseDown(const juce::MouseEvent&) override {
            if (onClick) onClick();
        }
        void mouseEnter(const juce::MouseEvent&) override { repaint(); }
        void mouseExit(const juce::MouseEvent&) override { repaint(); }
    };
    // Sous le panneau SETTINGS ouvert : un clic ailleurs le referme (et ne fait rien d'autre)
    struct Scrim final : juce::Component {
        std::function<void()> onClick;
        void mouseDown(const juce::MouseEvent&) override {
            if (onClick) onClick();
        }
    };
    // Le nom d'une rangee de la matrice des bandes (LOW, MID, HIGH ; avec deux bandes : LOW, HIGH)
    struct RowName final : juce::Component {
        juce::String name;
        bool on = true;
        void paint(juce::Graphics&) override;
    };
    // La bande d'info
    struct Info final : juce::Component {
        juce::String title, value, help, status;
        void paint(juce::Graphics&) override;
    };

    template <class T, class... A>
    T* make(juce::Component& parent, const std::string& id, A&&... args);
    juce::RangedAudioParameter& P(const std::string& id) const { return *proc_.apvts.getParameter(id); }

    MMRageProcessor& proc_;
    rl::MenuLook look_;
    rl::SharedLook lookState_;
    Panel panel_;
    std::array<Page, MMRageProcessor::kPages> pages_;
    std::vector<std::unique_ptr<juce::Component>> owned_;
    std::map<std::string, juce::Component*> byId_;
    rl::PageTabs tabs_;
    rl::Knob *drive_ = nullptr, *lfoRate_ = nullptr, *lfoNote_ = nullptr;
    std::array<RowName, 3> rowNames_;
    std::unique_ptr<rl::KeyButton> prev_, next_, init_;
    rl::PresetWindow presets_;
    rl::AttitudeVu vu_;
    rl::TransferView transfer_;
    std::unique_ptr<rl::BandMap> bandMap_;
    rl::ResponseView response_;
    rl::MotionView motion_;
    Info info_;
    Burger burger_;
    Scrim scrim_;
    rl::SettingsPanel settings_;
    juce::Component* hovered_ = nullptr;
    double lastTick_ = 0;
    int page_ = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMRageEditor)
};
