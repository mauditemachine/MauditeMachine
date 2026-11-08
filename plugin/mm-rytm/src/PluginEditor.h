// MM-RYTM, la face : la grille 8 x 16 a gauche, les potards de la piste choisie a droite.
#pragma once

#include "PluginProcessor.h"

#include <juce_audio_utils/juce_audio_utils.h>

class MMRytmEditor final : public juce::AudioProcessorEditor, private juce::Timer {
public:
    explicit MMRytmEditor(MMRytmProcessor&);
    ~MMRytmEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;
    void mouseDown(const juce::MouseEvent&) override;

private:
    void timerCallback() override;
    void selectTrack(int t);
    juce::Rectangle<int> stepBounds(int track, int step) const;
    juce::Rectangle<int> nameBounds(int track) const;
    juce::Rectangle<int> muteBounds(int track) const;
    juce::Rectangle<int> playBounds(int track) const;

    struct Knob {
        juce::Slider slider;
        juce::Label label;
        std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> att;
        const char* key = nullptr;
    };
    struct Toggle {
        juce::ToggleButton button;
        std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> att;
        const char* key = nullptr;
    };
    struct Combo {
        juce::ComboBox box;
        juce::Label label;
        std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> att;
        const char* key = nullptr;
    };

    MMRytmProcessor& proc_;
    juce::LookAndFeel_V4 laf_;
    int selected_ = 0;
    int lastStep_ = -2;
    std::array<float, mm::kTracks> leds_{};

    std::vector<std::unique_ptr<Knob>> knobs_;
    std::vector<std::unique_ptr<Toggle>> toggles_;
    std::vector<std::unique_ptr<Combo>> combos_;
    std::vector<std::unique_ptr<Knob>> globals_;
    std::unique_ptr<Toggle> run_;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMRytmEditor)
};
