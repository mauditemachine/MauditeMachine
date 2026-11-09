#include "SampleBank.h"

#include "BinaryData.h"

#include <juce_audio_formats/juce_audio_formats.h>

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

/* ---------------- les samples perso ---------------- */

namespace {
const char* const kAudioExt = "*.wav;*.wave;*.aif;*.aiff;*.flac;*.mp3";
int familyIndex(const juce::String& f) {
    for (int t = 0; t < 8; ++t)
        if (f == SampleBank::kFamilies[t]) return t;
    return -1;
}
} // namespace

UserLibrary& UserLibrary::get() {
    static UserLibrary lib;
    return lib;
}

juce::File UserLibrary::root() const {
    return juce::File::getSpecialLocation(juce::File::userMusicDirectory).getChildFile("MM-RYTM Samples");
}

void UserLibrary::rescan() {
    std::vector<Entry> found;
    const juce::File r = root();
    for (int t = 0; t < 8; ++t) {
        const juce::File dir = r.getChildFile(SampleBank::kFamilies[t]);
        if (!dir.isDirectory()) dir.createDirectory();
        juce::Array<juce::File> files = dir.findChildFiles(juce::File::findFiles, false, kAudioExt);
        std::vector<juce::String> names;
        for (const auto& f : files)
            if (!f.getFileName().startsWithChar('.')) names.push_back(f.getFileName());
        std::sort(names.begin(), names.end(), [](const juce::String& a, const juce::String& b) { return a.compareNatural(b) < 0; });
        for (const auto& n : names) found.push_back({t, n});
    }
    std::lock_guard<std::mutex> lk(mx_);
    entries_ = std::move(found);
}

std::vector<UserLibrary::Entry> UserLibrary::list() const {
    std::lock_guard<std::mutex> lk(mx_);
    return entries_;
}

juce::String UserLibrary::listJson() const {
    juce::Array<juce::var> arr;
    for (const auto& e : list()) {
        auto* o = new juce::DynamicObject();
        o->setProperty("family", SampleBank::kFamilies[e.family]);
        o->setProperty("file", e.file);
        arr.add(juce::var(o));
    }
    return juce::JSON::toString(juce::var(arr), true);
}

juce::File UserLibrary::fileOf(const juce::String& key) const {
    const juce::String fam = key.upToFirstOccurrenceOf("/", false, false);
    const juce::String file = key.fromFirstOccurrenceOf("/~", false, false);
    if (familyIndex(fam) < 0 || file.isEmpty() || file.containsAnyOf("/\\") || file.startsWith(".")) return {};
    return root().getChildFile(fam).getChildFile(file);
}

const BankSample* UserLibrary::byKey(const juce::String& key) {
    if (!isUserKey(key)) return nullptr;
    std::lock_guard<std::mutex> lk(mx_);
    if (auto it = loaded_.find(key); it != loaded_.end()) return it->second.get();
    const juce::File f = fileOf(key);
    if (!f.existsAsFile()) return nullptr;
    juce::AudioFormatManager fm;
    fm.registerBasicFormats();
    std::unique_ptr<juce::AudioFormatReader> rd(fm.createReaderFor(f));
    if (!rd || rd->sampleRate <= 0 || rd->lengthInSamples <= 0) return nullptr;
    const int len = static_cast<int>(std::min<juce::int64>(rd->lengthInSamples, static_cast<juce::int64>(kMaxSeconds * rd->sampleRate)));
    const int ch = static_cast<int>(std::min<unsigned int>(2, rd->numChannels));
    juce::AudioBuffer<float> buf(ch, len);
    rd->read(&buf, 0, len, 0, true, ch > 1);
    auto s = std::make_unique<BankSample>();
    s->file = f.getFileName();
    s->name = f.getFileNameWithoutExtension();
    s->pcm.sr = rd->sampleRate;
    s->pcm.L.assign(buf.getReadPointer(0), buf.getReadPointer(0) + len);
    if (ch > 1) s->pcm.R.assign(buf.getReadPointer(1), buf.getReadPointer(1) + len);
    // Les octets du fichier : la face les demande pour dessiner le sample (/samples/rytm/<cle>)
    juce::MemoryBlock mb;
    if (f.getSize() < 64 * 1024 * 1024 && f.loadFileAsData(mb)) {
        auto& b = bytes_[key];
        b.assign(static_cast<const char*>(mb.getData()), static_cast<const char*>(mb.getData()) + mb.getSize());
        s->data = b.data();
        s->size = static_cast<int>(b.size());
    }
    const BankSample* out = s.get();
    loaded_[key] = std::move(s);
    return out;
}

juce::String UserLibrary::import(const juce::Array<juce::File>& files, int family) {
    if (family < 0 || family >= 8) return {};
    const juce::File dir = root().getChildFile(SampleBank::kFamilies[family]);
    dir.createDirectory();
    juce::String first;
    for (const auto& src : files) {
        if (!src.existsAsFile()) continue;
        juce::File dst = dir.getChildFile(src.getFileName());
        // Le meme fichier deja la : rien a copier ; un autre du meme nom : un nom libre (Mon kick (2).wav)
        if (dst.existsAsFile() && dst.getSize() != src.getSize()) dst = dir.getNonexistentChildFile(src.getFileNameWithoutExtension(), src.getFileExtension(), true);
        if (!dst.existsAsFile() && !src.copyFileTo(dst)) continue;
        if (first.isEmpty()) first = juce::String(SampleBank::kFamilies[family]) + "/~" + dst.getFileName();
    }
    rescan();
    return first;
}

} // namespace mm
