// MM-RYTM, la fenetre du plugin : la face du site (src/v4/plugin, build dans plugin/mm-rytm/build-web) dans une WebView.
// Les fichiers de la face sont servis depuis le binaire (WebData, un zip), les samples depuis la banque.
#pragma once

#include "PluginProcessor.h"

#include <juce_gui_extra/juce_gui_extra.h>

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
    // Le MIDI de la pattern qui joue (2026-11-10, Mika : "j'aime pas la barre en dessous, je prefere que ce soit dans OPEN") :
    // la face (OPEN) le demande ; DRAG MIDI part du glisser de la face (l'evenement souris courant), SAVE .MID l'ecrit
    // dans ~/Music/MM-RYTM MIDI ; l'etat (pattern, mesures, notes) va a la face quand le programme change
    juce::File writeMidiFile(bool keep, juce::String& why);
    void dragMidi();
    void saveMidi();
    void sendMidiInfo(bool force);
    void midiStatus(const juce::String& msg, bool ok);

    struct Browser : juce::WebBrowserComponent {
        using juce::WebBrowserComponent::WebBrowserComponent;
        // Jamais d'autre page que la face
        bool pageAboutToLoad(const juce::String& url) override { return url.startsWith(getResourceProviderRoot()) || url == "about:blank"; }
    };

    MMRytmProcessor& proc_;
    std::unique_ptr<Browser> browser_;
    std::unique_ptr<juce::FileChooser> chooser_;
    int lastSeq_ = -1;
    bool lastPlaying_ = false;
    bool lastInternal_ = false;
    double lastXf_ = -1;
    int lastPatSeq_ = -1;
    int quietTicks_ = 0;
    int midiVer_ = -1;
    int midiSlot_ = -2;
    int midiTick_ = 0;
    bool meterAny_ = false;
    bool dragging_ = false;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMRytmEditor)
};
