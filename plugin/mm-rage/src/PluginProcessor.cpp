#include "PluginProcessor.h"

#if !MMRAGE_HEADLESS
#include "PluginEditor.h"
#endif

#include <cmath>

using juce::AudioParameterBool;
using juce::AudioParameterChoice;
using juce::AudioParameterFloat;
using juce::ParameterID;
using mmrage::RagePatch;
using Field = MMRageProcessor::Field;

std::string pid::band(int b, const char* what) { return "b" + std::to_string(b + 1) + what; }

namespace {

juce::StringArray names(const char* const* n, int count) {
    juce::StringArray a;
    for (int i = 0; i < count; ++i) a.add(n[i]);
    return a;
}

Field unit(const char* id, const char* name, double RagePatch::*m, std::function<std::string(double)> txt) {
    Field f;
    f.id = id;
    f.name = name;
    f.kind = Field::Unit;
    f.get = [m](const RagePatch& p) { return p.*m; };
    f.set = [m](RagePatch& p, double v) { p.*m = v; };
    f.text = std::move(txt);
    return f;
}

Field onOff(const char* id, const char* name, bool RagePatch::*m) {
    Field f;
    f.id = id;
    f.name = name;
    f.kind = Field::Bool;
    f.get = [m](const RagePatch& p) { return p.*m ? 1.0 : 0.0; };
    f.set = [m](RagePatch& p, double v) { p.*m = v >= 0.5; };
    return f;
}

Field choice(const char* id, const char* name, int RagePatch::*m, juce::StringArray c, int offset = 0) {
    Field f;
    f.id = id;
    f.name = name;
    f.kind = Field::Choice;
    f.choices = std::move(c);
    f.get = [m, offset](const RagePatch& p) { return static_cast<double>(p.*m - offset); };
    f.set = [m, offset](RagePatch& p, double v) { p.*m = static_cast<int>(std::lround(v)) + offset; };
    return f;
}

std::vector<Field> buildFields() {
    namespace t = mmrage::text;
    std::vector<Field> v;
    // l'ordre : celui de l'hote (Ableton montre les premiers dans la barre du plugin) : le coeur d'abord
    v.push_back(unit(pid::drive, "DRIVE", &RagePatch::drive, [](double x) { return t::drive(x, false); }));
    v.push_back(choice(pid::style, "STYLE", &RagePatch::style, names(mmrage::kStyleNames, mmrage::kStyles)));
    v.push_back(unit(pid::mix, "MIX", &RagePatch::mix, t::percent));
    v.push_back(unit(pid::out, "OUTPUT", &RagePatch::out, t::outDb));
    v.push_back(onOff(pid::punish, "PUNISH", &RagePatch::punish));
    v.push_back(onOff(pid::autoGain, "AUTO", &RagePatch::autoGain));
    v.push_back(unit(pid::tone, "TONE", &RagePatch::tone, t::tone));
    v.push_back(unit(pid::low, "LOW CUT", &RagePatch::low, t::low));
    v.push_back(onOff(pid::thump, "THUMP", &RagePatch::thump));
    v.push_back(unit(pid::high, "HIGH CUT", &RagePatch::high, t::high));
    v.push_back(onOff(pid::steep, "STEEP", &RagePatch::steep));
    v.push_back(unit(pid::morph, "MORPH", &RagePatch::morph, t::percent));
    v.push_back(choice(pid::morphTo, "MORPH TO", &RagePatch::morphTo, names(mmrage::kStyleNames, mmrage::kStyles)));
    v.push_back(unit(pid::dyn, "DYNAMICS", &RagePatch::dyn, t::dyn));
    v.push_back(unit(pid::fb, "FEEDBACK", &RagePatch::fb, t::percent));
    v.push_back(unit(pid::fbFreq, "FB FREQ", &RagePatch::fbFreq, t::fbFreq));
    v.push_back(choice(pid::preMode, "PRE FILTER", &RagePatch::preMode, names(mmrage::kFilterNames, 5)));
    v.push_back(unit(pid::preFreq, "PRE FREQ", &RagePatch::preFreq, t::filtFreq));
    v.push_back(unit(pid::preReso, "PRE RESO", &RagePatch::preReso, t::reso));
    v.push_back(choice(pid::box, "BOX", &RagePatch::box, names(mmrage::kBoxNames, 5)));
    v.push_back(unit(pid::boxSize, "BOX SIZE", &RagePatch::boxSize, t::boxSize));
    v.push_back(unit(pid::boxMix, "BOX MIX", &RagePatch::boxMix, t::percent));
    v.push_back(choice(pid::postMode, "POST FILTER", &RagePatch::postMode, names(mmrage::kFilterNames, 5)));
    v.push_back(unit(pid::postFreq, "POST FREQ", &RagePatch::postFreq, t::filtFreq));
    v.push_back(unit(pid::postReso, "POST RESO", &RagePatch::postReso, t::reso));
    {
        Field f = choice(pid::bands, "BANDS", &RagePatch::bands, names(mmrage::kBandsNames, 3), 1);
        v.push_back(f);
    }
    v.push_back(unit(pid::xLo, "XOVER LOW", &RagePatch::xLo, t::xLo));
    v.push_back(unit(pid::xHi, "XOVER HIGH", &RagePatch::xHi, t::xHi));
    static const char* const bandName[3] = {"LOW", "MID", "HIGH"};
    for (int b = 0; b < 3; ++b) {
        const size_t i = static_cast<size_t>(b);
        const std::string n = bandName[b];
        Field st;
        st.id = pid::band(b, "Style");
        st.name = n + " STYLE";
        st.kind = Field::Choice;
        st.choices = names(mmrage::kBandStyleNames, mmrage::kStyles + 1);
        st.get = [i](const RagePatch& p) { return static_cast<double>(p.band[i].style + 1); };
        st.set = [i](RagePatch& p, double x) { p.band[i].style = static_cast<int>(std::lround(x)) - 1; };
        v.push_back(st);
        const auto bandUnit = [&](const char* what, const char* label, double mmrage::BandPatch::*m, std::function<std::string(double)> txt) {
            Field f;
            f.id = pid::band(b, what);
            f.name = n + " " + label;
            f.kind = Field::Unit;
            f.get = [i, m](const RagePatch& p) { return p.band[i].*m; };
            f.set = [i, m](RagePatch& p, double x) { p.band[i].*m = x; };
            f.text = std::move(txt);
            v.push_back(f);
        };
        const auto bandBool = [&](const char* what, const char* label, bool mmrage::BandPatch::*m) {
            Field f;
            f.id = pid::band(b, what);
            f.name = n + " " + label;
            f.kind = Field::Bool;
            f.get = [i, m](const RagePatch& p) { return p.band[i].*m ? 1.0 : 0.0; };
            f.set = [i, m](RagePatch& p, double x) { p.band[i].*m = x >= 0.5; };
            v.push_back(f);
        };
        bandUnit("Drive", "DRIVE", &mmrage::BandPatch::drive, t::bandDrive);
        bandUnit("Mix", "MIX", &mmrage::BandPatch::mix, t::percent);
        bandUnit("Level", "LEVEL", &mmrage::BandPatch::level, t::level);
        bandBool("Solo", "SOLO", &mmrage::BandPatch::solo);
        bandBool("Byp", "BYPASS", &mmrage::BandPatch::bypass);
    }
    v.push_back(unit(pid::envAmt, "ENV AMOUNT", &RagePatch::envAmt, t::bipolar));
    v.push_back(unit(pid::envSpeed, "ENV SPEED", &RagePatch::envSpeed, t::envSpeed));
    v.push_back(choice(pid::lfoShape, "LFO SHAPE", &RagePatch::lfoShape, names(mmrage::kShapeNames, 5)));
    v.push_back(onOff(pid::lfoSync, "LFO SYNC", &RagePatch::lfoSync));
    v.push_back(unit(pid::lfoRate, "LFO RATE", &RagePatch::lfoRate, t::lfoRate));
    v.push_back(choice(pid::lfoNote, "LFO NOTE", &RagePatch::lfoNote, names(mmrage::kLfoNoteNames, mmrage::kLfoNotes)));
    v.push_back(unit(pid::lfoAmt, "LFO AMOUNT", &RagePatch::lfoAmt, t::bipolar));
    v.push_back(choice(pid::lfoTarget, "LFO TARGET", &RagePatch::lfoTarget, names(mmrage::kTargetNames, 6)));
    return v;
}

} // namespace

const std::vector<Field>& MMRageProcessor::fields() {
    static const std::vector<Field> f = buildFields();
    return f;
}

juce::AudioProcessorValueTreeState::ParameterLayout MMRageProcessor::layout(MMRageProcessor* self) {
    const RagePatch d; // les valeurs par defaut : INIT
    juce::AudioProcessorValueTreeState::ParameterLayout l;
    for (const auto& f : fields()) {
        const float def = static_cast<float>(f.get(d));
        if (f.kind == Field::Bool) {
            l.add(std::make_unique<AudioParameterBool>(ParameterID{f.id, 1}, f.name, def >= 0.5f,
                                                       juce::AudioParameterBoolAttributes().withStringFromValueFunction([](bool v, int) { return juce::String(v ? "ON" : "OFF"); })));
        } else if (f.kind == Field::Choice) {
            l.add(std::make_unique<AudioParameterChoice>(ParameterID{f.id, 1}, f.name, f.choices, juce::roundToInt(def)));
        } else {
            std::function<std::string(double)> txt = f.text;
            // DRIVE : son texte suit PUNISH (+20 dB)
            if (f.id == pid::drive)
                txt = [self](double v) { return mmrage::text::drive(v, self && self->rawPunish_ && self->rawPunish_->load() >= 0.5f); };
            l.add(std::make_unique<AudioParameterFloat>(
                ParameterID{f.id, 1}, f.name, juce::NormalisableRange<float>(0.f, 1.f), def,
                juce::AudioParameterFloatAttributes().withStringFromValueFunction([txt](float v, int) { return juce::String(txt(static_cast<double>(v))); })));
        }
    }
    return l;
}

MMRageProcessor::MMRageProcessor()
    : AudioProcessor(BusesProperties().withInput("Input", juce::AudioChannelSet::stereo(), true).withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "MMRAGE", layout(this)) {
    for (const auto& f : fields()) raw_.push_back(apvts.getRawParameterValue(f.id));
    rawPunish_ = apvts.getRawParameterValue(pid::punish);
    program_ = mmrage::initIndex();
    setLatencySamples(mmarp::Decap::kLatency);
}

RagePatch MMRageProcessor::patch() const {
    RagePatch p;
    const auto& f = fields();
    for (size_t i = 0; i < f.size(); ++i) f[i].set(p, static_cast<double>(raw_[i]->load()));
    return p;
}

void MMRageProcessor::prepareToPlay(double sampleRate, int) {
    decap_.prepare(sampleRate);
    setLatencySamples(mmarp::Decap::kLatency);
    attitude_.store(-120.f);
}

void MMRageProcessor::reset() { decap_.reset(); }

bool MMRageProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    const auto in = layouts.getMainInputChannelSet(), out = layouts.getMainOutputChannelSet();
    return out == juce::AudioChannelSet::stereo() && (in == juce::AudioChannelSet::stereo() || in == juce::AudioChannelSet::mono());
}

void MMRageProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi) {
    juce::ScopedNoDenormals noDenormals;
    midi.clear();
    const int n = buffer.getNumSamples();
    double bpm = 120;
    if (auto* ph = getPlayHead())
        if (const auto pos = ph->getPosition())
            if (const auto b = pos->getBpm())
                if (*b > 0) bpm = *b;
    bpm_.store(bpm, std::memory_order_relaxed);
    if (buffer.getNumChannels() < 2 || n <= 0) return;
    // une entree mono : la meme a droite
    if (getTotalNumInputChannels() == 1) buffer.copyFrom(1, 0, buffer, 0, 0, n);
    decap_.set(mmrage::settingsOf(patch(), bpm));
    decap_.process(buffer.getWritePointer(0), buffer.getWritePointer(1), n);
    attitude_.store(static_cast<float>(decap_.attitudeDb()), std::memory_order_relaxed);
}

int MMRageProcessor::getNumPrograms() { return static_cast<int>(mmrage::factory().size()); }

const juce::String MMRageProcessor::getProgramName(int index) {
    const auto& b = mmrage::factory();
    return index >= 0 && index < static_cast<int>(b.size()) ? juce::String(b[static_cast<size_t>(index)].name) : juce::String();
}

void MMRageProcessor::setCurrentProgram(int index) {
    // un hote qui repose le programme courant (a la reouverture d'un projet) ne doit rien changer
    if (index == program_.load()) return;
    loadPreset(index);
}

void MMRageProcessor::applyPatch(const RagePatch& p) {
    for (const auto& f : fields()) {
        auto* prm = apvts.getParameter(f.id);
        if (prm == nullptr) continue;
        const float v = prm->convertTo0to1(static_cast<float>(f.get(p)));
        if (std::fabs(prm->getValue() - v) < 1e-7f) continue;
        prm->beginChangeGesture();
        prm->setValueNotifyingHost(v);
        prm->endChangeGesture();
    }
}

void MMRageProcessor::loadPreset(int index) {
    const auto& b = mmrage::factory();
    if (index < 0 || index >= static_cast<int>(b.size())) return;
    program_.store(index);
    applyPatch(b[static_cast<size_t>(index)].p);
}

void MMRageProcessor::getStateInformation(juce::MemoryBlock& destData) {
    auto st = apvts.copyState();
    st.setProperty("editorW", editorW_.load(), nullptr);
    st.setProperty("program", program_.load(), nullptr);
    st.setProperty("page", page_.load(), nullptr);
    if (auto xml = st.createXml()) copyXmlToBinary(*xml, destData);
}

void MMRageProcessor::setStateInformation(const void* data, int sizeInBytes) {
    const auto xml = getXmlFromBinary(data, sizeInBytes);
    if (!xml || !xml->hasTagName(apvts.state.getType())) return;
    const auto t = juce::ValueTree::fromXml(*xml);
    apvts.replaceState(t);
    setEditorWidth(static_cast<int>(t.getProperty("editorW", kEditorDefaultW)));
    program_.store(juce::jlimit(0, getNumPrograms() - 1, static_cast<int>(t.getProperty("program", mmrage::initIndex()))));
    setPage(static_cast<int>(t.getProperty("page", 0)));
}

juce::AudioProcessorEditor* MMRageProcessor::createEditor() {
#if MMRAGE_HEADLESS
    return nullptr;
#else
    return new MMRageEditor(*this);
#endif
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MMRageProcessor(); }
