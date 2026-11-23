// MM-ARP, la fenetre du plugin : la face du site (src/v4/plugin/arp, build dans plugin/mm-arp/build-web) dans une
// WebView. Les fichiers de la face sont servis depuis le binaire (WebData, un zip).
#pragma once

#include "PluginProcessor.h"

#include <juce_gui_extra/juce_gui_extra.h>

class MMArpEditor final : public juce::AudioProcessorEditor, private juce::Timer {
public:
    explicit MMArpEditor(MMArpProcessor&);
    ~MMArpEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    std::optional<juce::WebBrowserComponent::Resource> resource(const juce::String& url);
    void presetSave(const juce::String& name, const juce::String& preset);
    void presetOpen();
    void presetLoad(const juce::File& f);
    void presetList();
    void keysToHost();
    juce::WebBrowserComponent::Options options();

    struct Browser : juce::WebBrowserComponent {
        using juce::WebBrowserComponent::WebBrowserComponent;
        // Jamais d'autre page que la face
        bool pageAboutToLoad(const juce::String& url) override { return url.startsWith(getResourceProviderRoot()) || url == "about:blank"; }
    };

    MMArpProcessor& proc_;
    std::unique_ptr<Browser> browser_;
    int lastSeq_ = -1;
    bool lastPlaying_ = false;
    bool lastInternal_ = false;
    bool lastRolling_ = false; // v46 : le transport roule (mm_transport ppq)
    int quietTicks_ = 0;
    // mm_mod : le dernier evenement envoye avait des reglages modules
    bool modSent_ = false;
    unsigned specTick_ = 0;
    int cpuTick_ = 0; // v31 : le compteur CPU, 10 fois par seconde
    bool ready_ = false;
    // v49 (Mika : "soulager au max le CPU") : un seul evenement mm_tick par tick, seulement ce qui a change, rien quand la
    // face n'est pas a l'ecran (mm_vis de la page, isShowing de la fenetre)
    bool faceVisible_ = true; // la page dit qu'elle est visible (document.visibilityState, mm_vis)
    bool shown_ = true;       // l'editeur envoie (la page visible et la fenetre montree)
    bool specWanted_ = false; // la page SOUND regardee (mm_view) : l'analyseur ne tourne que fenetre montree
    juce::String modKey_;     // les arcs : le dernier envoi (ids et valeurs arrondies)
    juce::String cpuKey_;     // le compteur CPU : le dernier envoi (arrondi au dixieme, comme l'affichage)
    int cpuQuiet_ = 0;        // ticks du compteur sans envoi (un envoi au moins par seconde : la face le montre vivant)
    std::array<int, mmarp::SpecAnalyzer::kBins> specSent_{};
    bool specHas_ = false;
    void setShown(bool on);
    bool sizing_ = true;  // pendant le constructeur : ne pas memoriser les tailles transitoires (880 force par les limites)
    // La derniere valeur de chaque potard connue de la face (-1 : a envoyer)
    std::array<float, mmx::kAll> sent_{};
    std::unique_ptr<juce::FileChooser> chooser_;
    // DRAG MIDI et SAVE .MID (les boutons sont dans le capot de la face)
    int cycles_ = 1;
    void setHint(const juce::String& s);
    void saveMidi();
    void dragMidi(int cycles);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMArpEditor)
};
