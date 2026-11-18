// MM-HELL, la fenetre : une interface native (JUCE, sans WebView : rien a charger, quelques Mo de memoire, aucun moteur
// web par instance), au design de la page HELL du MM-ARP (cuir, joues de bois, potards du MM-RYTM, leviers chrome,
// touches a LED, VU ivoire), resserree pour un effet seul :
//   en-tete : MAUDITE MACHINE, MM-HELL, la banque (PREV, la fenetre qui la deroule, NEXT, INIT) ;
//   DELAY (DELAY, FEEDBACK, SYNC, CROSS ; IN THE LOOP : HIGH-PASS, LOW-PASS, SMEAR) ;
//   FREQUENCY SHIFTER (RANGE en touches, le gros potard et son echelle, SIDEBAND, PHASE, ANTI REFL, SPREAD, la valeur) ;
//   HELL (MIX ; l'ECHO MAP : ou vont les repetitions) ; LFO (SHAPE, RATE, SYNC, AMOUNT, STEREO, TARGET, le VU) ;
//   la bande d'info : la piece survolee, sa valeur, ce qu'elle fait ; le tempo et la note MIDI recue.
// Un plan de 1000 x 620 mis a l'echelle (80 % a 200 %, 120 % a l'ouverture, la taille est gardee dans le projet). Rafraichi a 30 images/s :
// seuls le VU (quand l'aiguille bouge) et ce qui a change se redessinent.
#pragma once

#include "HellControls.h"
#include "HellViews.h"
#include "PluginProcessor.h"

#include <juce_audio_processors/juce_audio_processors.h>

class MMHellEditor final : public juce::AudioProcessorEditor, private juce::Timer {
public:
    explicit MMHellEditor(MMHellProcessor&);
    ~MMHellEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;
    /** Ce que fait le minuteur (le banc de capture l'appelle directement). */
    void refresh(float dt);

private:
    void timerCallback() override;
    void mouseEnter(const juce::MouseEvent&) override;
    void mouseExit(const juce::MouseEvent&) override;
    void mouseMove(const juce::MouseEvent&) override;
    void step(int d);

    // Le plan de 1000 x 620 : le fond (cuir, bois, serigraphie fixe) en cache, a la resolution de l'ecran
    struct Panel final : juce::Component {
        void paint(juce::Graphics&) override;
        hl::Cached bg;
    };
    // La valeur du decalage sous le gros potard
    struct ShiftValue final : juce::Component {
        juce::String value, line;
        void paint(juce::Graphics&) override;
    };
    // La LED du cadre HELL (MIX > 0)
    struct Dot final : juce::Component {
        bool on = false;
        void paint(juce::Graphics& g) override { hl::led(g, getLocalBounds().toFloat().getCentre(), 6.f, on); }
    };
    // La bande d'info
    struct Info final : juce::Component {
        juce::String title, value, help, status;
        void paint(juce::Graphics&) override;
    };

    MMHellProcessor& proc_;
    hl::MenuLook look_;
    Panel panel_;
    std::unique_ptr<hl::Knob> delayTime_, delayNote_, feedback_, hp_, lp_, smear_, shift_, sideband_, phase_, spread_, mix_, lfoRate_, lfoNote_, lfoAmt_;
    std::unique_ptr<hl::Lever> sync_, cross_, antiRefl_, lfoSync_, lfoStereo_;
    std::unique_ptr<hl::KeyRow> range_, shape_, target_;
    std::unique_ptr<hl::KeyButton> prev_, next_, init_;
    hl::PresetWindow presets_;
    hl::LfoVu vu_;
    hl::EchoMap map_;
    ShiftValue shiftValue_;
    Dot hellLed_;
    Info info_;
    juce::Component* hovered_ = nullptr;
    double lastTick_ = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMHellEditor)
};
