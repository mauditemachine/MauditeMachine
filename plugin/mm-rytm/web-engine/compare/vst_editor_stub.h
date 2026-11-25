// La parite (compare_vst.cpp) : le processeur du VST3 sans sa fenetre. Copie en PluginEditor.h a cote des sources du
// processeur (CMakeLists.txt) : la WebView et la face ne servent pas au son, createEditor n'est jamais appele.
#pragma once

#include "PluginProcessor.h"

class MMRytmEditor final : public juce::AudioProcessorEditor {
public:
    explicit MMRytmEditor(MMRytmProcessor& p) : AudioProcessorEditor(&p) {}
    void paint(juce::Graphics&) override {}
};
