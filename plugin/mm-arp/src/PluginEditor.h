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
    int quietTicks_ = 0;
    bool ready_ = false;
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
