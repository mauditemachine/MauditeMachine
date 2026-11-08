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

    struct Browser : juce::WebBrowserComponent {
        using juce::WebBrowserComponent::WebBrowserComponent;
        // Jamais d'autre page que la face
        bool pageAboutToLoad(const juce::String& url) override { return url.startsWith(getResourceProviderRoot()) || url == "about:blank"; }
    };

    MMRytmProcessor& proc_;
    std::unique_ptr<Browser> browser_;
    int lastSeq_ = -1;
    bool lastPlaying_ = false;
    bool lastInternal_ = false;
    int quietTicks_ = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMRytmEditor)
};
