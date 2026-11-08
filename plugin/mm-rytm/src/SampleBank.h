// Les samples de Mika (public/samples/rytm/<famille>/*.wav), embarques par juce_add_binary_data et decodes au chargement.
#pragma once

#include "Shots.h"

#include <juce_core/juce_core.h>

#include <array>
#include <vector>

namespace mm {

struct BankSample {
    juce::String name; // "Bd 1"
    juce::String file; // "Bd 1.wav"
    SamplePcm pcm;
    const char* data = nullptr; // le fichier tel quel (la face le demande par /samples/rytm/<famille>/<fichier>)
    int size = 0;
};

class SampleBank {
public:
    static const SampleBank& get();
    // Les samples d'une piste (Track), dans l'ordre du site (tri naturel : Bd 1, Bd 2 ... Bd 10).
    const std::vector<BankSample>& of(int family) const { return byTrack_[static_cast<size_t>(family)]; }
    // Un sample par sa cle du site ("bd/Bd 1.wav") ; nul s'il n'est pas dans la banque (un sample perso du navigateur).
    const BankSample* byKey(const juce::String& key) const;
    static const char* const kFamilies[8];

private:
    SampleBank();
    std::array<std::vector<BankSample>, 8> byTrack_;
};

} // namespace mm
