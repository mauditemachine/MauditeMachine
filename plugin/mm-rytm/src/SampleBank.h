// Les samples de Mika (public/samples/rytm/<famille>/*.wav), embarques par juce_add_binary_data et decodes au chargement.
#pragma once

#include "Shots.h"

#include <juce_core/juce_core.h>

#include <array>
#include <vector>

namespace mm {

struct BankSample {
    juce::String name; // "Bd 1"
    SamplePcm pcm;
};

class SampleBank {
public:
    static const SampleBank& get();
    // Les samples d'une piste (Track), dans l'ordre du site (tri naturel : Bd 1, Bd 2 ... Bd 10).
    const std::vector<BankSample>& of(int track) const { return byTrack_[static_cast<size_t>(track)]; }

private:
    SampleBank();
    std::array<std::vector<BankSample>, 8> byTrack_;
};

} // namespace mm
