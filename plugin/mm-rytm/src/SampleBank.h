// Les samples de Mika (public/samples/rytm/<famille>/*.wav), embarques par juce_add_binary_data et decodes au chargement.
#pragma once

#include "Shots.h"

#include <juce_core/juce_core.h>

#include <array>
#include <map>
#include <memory>
#include <mutex>
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

// Les samples perso de Mika (2026-11-08, "lance les samples perso dans le plugin") : un dossier sur le Mac,
// ~/Music/MM-RYTM Samples/<famille>/ (bd, sd, ch, oh, cp, tom, ht, cy), qu'il remplit au Finder ou par + LOAD A FILE... de
// SOUNDS. Cle d'un sample : "<famille>/~<fichier>" ("bd/~Mon kick.wav"). Lus par le moteur (fenetre fermee comprise),
// decodes a la demande (WAV, AIFF, FLAC, MP3 : les formats de JUCE), au plus 30 s. Thread-safe.
class UserLibrary {
public:
    static UserLibrary& get();
    static constexpr double kMaxSeconds = 30.0;
    juce::File root() const;
    // Relit le dossier ; la liste : { famille, fichier } dans l'ordre naturel des noms
    void rescan();
    struct Entry {
        int family = 0;
        juce::String file;
    };
    std::vector<Entry> list() const;
    // La liste pour la face, en JSON : [{"family":"bd","file":"Mon kick.wav"}, ...]
    juce::String listJson() const;
    // Un sample par sa cle (decode a la premiere demande) ; nul s'il n'est pas la ou illisible
    const BankSample* byKey(const juce::String& key);
    // Copie des fichiers dans le dossier d'une famille ; rend la cle du premier copie ("" : aucun)
    juce::String import(const juce::Array<juce::File>& files, int family);
    static bool isUserKey(const juce::String& key) { return key.fromFirstOccurrenceOf("/", false, false).startsWith("~"); }

private:
    UserLibrary() = default;
    juce::File fileOf(const juce::String& key) const;
    mutable std::mutex mx_;
    std::vector<Entry> entries_;
    std::map<juce::String, std::unique_ptr<BankSample>> loaded_;
    std::map<juce::String, std::vector<char>> bytes_;
};

} // namespace mm
