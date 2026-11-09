// MM-ARP, la fenetre du plugin : la face du site (src/v4/plugin/arp, build dans plugin/mm-arp/build-web) dans une
// WebView. Les fichiers de la face sont servis depuis le binaire (WebData, un zip).
#pragma once

#include "PluginProcessor.h"

#include <juce_gui_extra/juce_gui_extra.h>

// La poignee DRAG MIDI : un glisser depuis elle emporte l'arpege en fichier MIDI, a deposer sur une piste d'Ableton (un
// plugin ne peut pas creer de clip lui-meme : Live cree le clip au depot du fichier)
class MMArpDragMidi final : public juce::Component, public juce::DragAndDropContainer {
public:
    std::function<juce::File()> makeFile;
    std::function<void(const juce::String&)> status;
    void paint(juce::Graphics& g) override;
    void mouseDown(const juce::MouseEvent&) override { dragging_ = false; }
    void mouseDrag(const juce::MouseEvent& e) override;
    void mouseEnter(const juce::MouseEvent&) override { repaint(); }
    void mouseExit(const juce::MouseEvent&) override { repaint(); }
    void mouseUp(const juce::MouseEvent&) override;

private:
    bool dragging_ = false;
};

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
    std::array<float, mmarp::kKnobs> sent_{};
    std::unique_ptr<juce::FileChooser> chooser_;
    // La bande sous la face : DRAG MIDI, la longueur du clip, SAVE .MID
    MMArpDragMidi drag_;
    juce::TextButton lenBtn_, saveMidBtn_;
    juce::Label hint_;
    int cycles_ = 1;
    void setHint(const juce::String& s);
    void saveMidi();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMArpEditor)
};
