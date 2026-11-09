// MM-RYTM, la fenetre du plugin : la face du site (src/v4/plugin, build dans plugin/mm-rytm/build-web) dans une WebView.
// Les fichiers de la face sont servis depuis le binaire (WebData, un zip), les samples depuis la banque.
#pragma once

#include "PluginProcessor.h"

#include <juce_gui_extra/juce_gui_extra.h>

/**
 * La barre MIDI (2026-11-09, Mika : "un bouton pour tout transferer directement la pattern qui joue dans un clip MIDI, avec
 * les bonnes velocites, comme un Drum Rack") : sous la face, un composant JUCE natif (un glisser vers Ableton ne part
 * surement que d'un composant natif, pas de la WebView). DRAG MIDI : le pattern qui joue, glisse sur une piste MIDI ou un Drum
 * Rack, devient un clip ; SAVE .MID : le fichier dans ~/Music/MM-RYTM MIDI, montre dans le Finder.
 */
class MidiBar final : public juce::Component, private juce::Timer {
public:
    static constexpr int kHeight = 34;
    explicit MidiBar(MMRytmProcessor& p);
    // NEW et CLEAR (2026-11-09, Mika : "je veux un bouton CLEAR ou NEW preset vierge") : confirmes ici, faits par la face
    std::function<void(const juce::String&)> onCommand;
    ~MidiBar() override;
    void paint(juce::Graphics&) override;
    void resized() override;
    void mouseMove(const juce::MouseEvent&) override;
    void mouseExit(const juce::MouseEvent&) override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseDrag(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;

private:
    void timerCallback() override;
    void refresh(bool force);
    // Le fichier du pattern qui joue : dans le dossier temporaire (le glisser) ou dans ~/Music/MM-RYTM MIDI (SAVE) ; nul : rien
    juce::File writeFile(bool keep);

    MMRytmProcessor& proc_;
    void ask(const juce::String& cmd);
    juce::Rectangle<int> drag_, save_, new_, clear_;
    juce::String info_ = "the playing pattern";
    int ver_ = -1;
    int slot_ = -2;
    int notes_ = 0;
    bool hotDrag_ = false, hotSave_ = false, hotNew_ = false, hotClear_ = false, dragging_ = false, downOnDrag_ = false;
    juce::String flash_;
    double flashUntil_ = 0;
};

class MMRytmEditor final : public juce::AudioProcessorEditor, private juce::Timer {
public:
    explicit MMRytmEditor(MMRytmProcessor&);
    ~MMRytmEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    std::optional<juce::WebBrowserComponent::Resource> resource(const juce::String& url);
    juce::WebBrowserComponent::Options options();
    // Les samples perso : la liste du dossier (JSON), son envoi a la face, l'import de fichiers choisis au Mac
    static juce::String userList();
    void sendUserList();
    void importFiles(int family, int track);
    void revealSamples(const juce::String& family);

    struct Browser : juce::WebBrowserComponent {
        using juce::WebBrowserComponent::WebBrowserComponent;
        // Jamais d'autre page que la face
        bool pageAboutToLoad(const juce::String& url) override { return url.startsWith(getResourceProviderRoot()) || url == "about:blank"; }
    };

    MMRytmProcessor& proc_;
    std::unique_ptr<Browser> browser_;
    std::unique_ptr<MidiBar> midiBar_;
    std::unique_ptr<juce::FileChooser> chooser_;
    int lastSeq_ = -1;
    bool lastPlaying_ = false;
    bool lastInternal_ = false;
    double lastXf_ = -1;
    int lastPatSeq_ = -1;
    int quietTicks_ = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMRytmEditor)
};
