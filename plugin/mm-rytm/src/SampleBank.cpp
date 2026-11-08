#include "SampleBank.h"

#include "BinaryData.h"

namespace mm {

const char* const SampleBank::kFamilies[8] = {"bd", "sd", "ch", "oh", "cp", "tom", "ht", "cy"};

const SampleBank& SampleBank::get() {
    static const SampleBank bank;
    return bank;
}

SampleBank::SampleBank() {
    // Le prefixe du fichier dit sa famille ("Bd 1.wav", "Tom 3.wav") : une famille par piste.
    for (int i = 0; i < BinaryData::namedResourceListSize; ++i) {
        const juce::String file = BinaryData::originalFilenames[i];
        if (!file.endsWithIgnoreCase(".wav")) continue;
        const juce::String name = file.dropLastCharacters(4);
        const juce::String prefix = name.upToFirstOccurrenceOf(" ", false, false).toLowerCase();
        int track = -1;
        for (int t = 0; t < 8; ++t)
            if (prefix == kFamilies[t]) track = t;
        if (track < 0) continue;
        int size = 0;
        const char* data = BinaryData::getNamedResource(BinaryData::namedResourceList[i], size);
        BankSample s;
        s.name = name;
        s.file = file;
        s.data = data;
        s.size = size;
        if (data && decodeWav(data, static_cast<size_t>(size), s.pcm)) byTrack_[static_cast<size_t>(track)].push_back(std::move(s));
    }
    for (auto& list : byTrack_)
        std::sort(list.begin(), list.end(), [](const BankSample& a, const BankSample& b) { return a.name.compareNatural(b.name) < 0; });
}

const BankSample* SampleBank::byKey(const juce::String& key) const {
    const juce::String fam = key.upToFirstOccurrenceOf("/", false, false);
    const juce::String file = key.fromFirstOccurrenceOf("/", false, false);
    for (int t = 0; t < 8; ++t)
        if (fam == kFamilies[t])
            for (const auto& s : byTrack_[static_cast<size_t>(t)])
                if (s.file == file) return &s;
    return nullptr;
}

} // namespace mm
