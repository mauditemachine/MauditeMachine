#include "PluginProcessor.h"

#if !MMHELL_HEADLESS
#include "PluginEditor.h"
#endif

#include <cmath>

using juce::AudioParameterBool;
using juce::AudioParameterChoice;
using juce::AudioParameterFloat;
using juce::ParameterID;

namespace {

juce::StringArray names(const char* const* n, int count) {
    juce::StringArray a;
    for (int i = 0; i < count; ++i) a.add(n[i]);
    return a;
}

// Un reglage 0..1 (les lois du MM-ARP), son texte pour l'hote
std::unique_ptr<AudioParameterFloat> unit(const char* id, const char* name, float def, std::function<std::string(double)> txt) {
    return std::make_unique<AudioParameterFloat>(
        ParameterID{id, 1}, name, juce::NormalisableRange<float>(0.f, 1.f), def,
        juce::AudioParameterFloatAttributes().withStringFromValueFunction([txt](float v, int) { return juce::String(txt(static_cast<double>(v))); }));
}

std::unique_ptr<AudioParameterBool> onOff(const char* id, const char* name, bool def) {
    return std::make_unique<AudioParameterBool>(ParameterID{id, 1}, name, def, juce::AudioParameterBoolAttributes().withStringFromValueFunction([](bool v, int) {
        return juce::String(v ? "ON" : "OFF");
    }));
}

} // namespace

juce::AudioProcessorValueTreeState::ParameterLayout MMHellProcessor::layout(MMHellProcessor* self) {
    namespace t = mmhell::text;
    const mmhell::HellPatch d; // les valeurs par defaut : INIT
    juce::AudioProcessorValueTreeState::ParameterLayout l;
    // l'ordre : celui de l'hote (Ableton montre les premiers dans la barre du plugin)
    l.add(unit(pid::mix, "MIX", kDefaultMix, t::mix));
    l.add(unit(pid::shift, "SHIFT", static_cast<float>(d.shift), [self](double v) {
        const int r = self && self->raw_.range ? static_cast<int>(self->raw_.range->load()) : 0;
        return t::shift(v, r);
    }));
    l.add(std::make_unique<AudioParameterChoice>(ParameterID{pid::range, 1}, "RANGE", names(mmhell::kRangeNames, 4), d.range));
    l.add(unit(pid::sideband, "SIDEBAND", static_cast<float>(d.sideband), t::sideband));
    l.add(unit(pid::phase, "PHASE", static_cast<float>(d.phase), t::phase));
    l.add(onOff(pid::antiRefl, "ANTI REFL", d.antiRefl));
    l.add(onOff(pid::sync, "DELAY SYNC", d.sync));
    l.add(std::make_unique<AudioParameterChoice>(ParameterID{pid::note, 1}, "DELAY NOTE", names(mmhell::kNoteNames, mmhell::kNotes), d.note));
    l.add(unit(pid::time, "DELAY TIME", static_cast<float>(d.time), t::time));
    l.add(unit(pid::feedback, "FEEDBACK", static_cast<float>(d.feedback), t::percent));
    l.add(onOff(pid::cross, "CROSS", d.cross));
    l.add(unit(pid::hp, "HIGH-PASS", static_cast<float>(d.hp), t::hp));
    l.add(unit(pid::lp, "LOW-PASS", static_cast<float>(d.lp), t::lp));
    l.add(unit(pid::smear, "SMEAR", static_cast<float>(d.smear), t::percent));
    l.add(unit(pid::spread, "SPREAD", static_cast<float>(d.spread), t::percent));
    l.add(std::make_unique<AudioParameterChoice>(ParameterID{pid::lfoShape, 1}, "LFO SHAPE", names(mmhell::kShapeNames, 4), d.lfoShape));
    l.add(onOff(pid::lfoSync, "LFO SYNC", d.lfoSync));
    l.add(unit(pid::lfoRate, "LFO RATE", static_cast<float>(d.lfoRate), t::lfoRate));
    l.add(std::make_unique<AudioParameterChoice>(ParameterID{pid::lfoNote, 1}, "LFO NOTE", names(mmhell::kLfoNoteNames, mmhell::kLfoNotes), d.lfoNote));
    l.add(std::make_unique<AudioParameterFloat>(
        ParameterID{pid::lfoAmt, 1}, "LFO AMOUNT", juce::NormalisableRange<float>(-1.f, 1.f), static_cast<float>(d.lfoAmt),
        juce::AudioParameterFloatAttributes().withStringFromValueFunction([](float v, int) { return juce::String(t::bipolar(static_cast<double>(v))); })));
    l.add(onOff(pid::lfoStereo, "LFO STEREO", d.lfoStereo));
    l.add(std::make_unique<AudioParameterChoice>(ParameterID{pid::lfoTarget, 1}, "LFO TARGET", names(mmhell::kTargetNames, 4), d.lfoTarget));
    return l;
}

MMHellProcessor::MMHellProcessor()
    : AudioProcessor(BusesProperties().withInput("Input", juce::AudioChannelSet::stereo(), true).withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "MMHELL", layout(this)) {
    const auto raw = [this](const char* id) { return apvts.getRawParameterValue(id); };
    raw_.mix = raw(pid::mix);
    raw_.sync = raw(pid::sync);
    raw_.note = raw(pid::note);
    raw_.time = raw(pid::time);
    raw_.feedback = raw(pid::feedback);
    raw_.cross = raw(pid::cross);
    raw_.range = raw(pid::range);
    raw_.shift = raw(pid::shift);
    raw_.sideband = raw(pid::sideband);
    raw_.spread = raw(pid::spread);
    raw_.phase = raw(pid::phase);
    raw_.antiRefl = raw(pid::antiRefl);
    raw_.smear = raw(pid::smear);
    raw_.hp = raw(pid::hp);
    raw_.lp = raw(pid::lp);
    raw_.lfoShape = raw(pid::lfoShape);
    raw_.lfoSync = raw(pid::lfoSync);
    raw_.lfoRate = raw(pid::lfoRate);
    raw_.lfoNote = raw(pid::lfoNote);
    raw_.lfoAmt = raw(pid::lfoAmt);
    raw_.lfoStereo = raw(pid::lfoStereo);
    raw_.lfoTarget = raw(pid::lfoTarget);
    program_ = mmhell::initIndex();
}

mmhell::HellPatch MMHellProcessor::patch() const {
    const auto on = [](const std::atomic<float>* a) { return a->load() >= 0.5f; };
    const auto ix = [](const std::atomic<float>* a) { return static_cast<int>(std::lround(a->load())); };
    const auto v = [](const std::atomic<float>* a) { return static_cast<double>(a->load()); };
    mmhell::HellPatch p;
    p.sync = on(raw_.sync);
    p.note = ix(raw_.note);
    p.time = v(raw_.time);
    p.feedback = v(raw_.feedback);
    p.cross = on(raw_.cross);
    p.range = ix(raw_.range);
    p.shift = v(raw_.shift);
    p.sideband = v(raw_.sideband);
    p.spread = v(raw_.spread);
    p.phase = v(raw_.phase);
    p.antiRefl = on(raw_.antiRefl);
    p.smear = v(raw_.smear);
    p.hp = v(raw_.hp);
    p.lp = v(raw_.lp);
    p.lfoShape = ix(raw_.lfoShape);
    p.lfoSync = on(raw_.lfoSync);
    p.lfoRate = v(raw_.lfoRate);
    p.lfoNote = ix(raw_.lfoNote);
    p.lfoAmt = v(raw_.lfoAmt);
    p.lfoStereo = on(raw_.lfoStereo);
    p.lfoTarget = ix(raw_.lfoTarget);
    return p;
}

void MMHellProcessor::prepareToPlay(double sampleRate, int) {
    hell_.prepare(sampleRate);
    lfo_.store(std::numeric_limits<float>::quiet_NaN());
}

void MMHellProcessor::reset() { hell_.reset(); }

bool MMHellProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    const auto in = layouts.getMainInputChannelSet(), out = layouts.getMainOutputChannelSet();
    return out == juce::AudioChannelSet::stereo() && (in == juce::AudioChannelSet::stereo() || in == juce::AudioChannelSet::mono());
}

void MMHellProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi) {
    juce::ScopedNoDenormals noDenormals;
    const int n = buffer.getNumSamples();
    // la derniere note recue (RANGE MIDI), gardee apres son relachement
    for (const auto m : midi) {
        const auto msg = m.getMessage();
        if (msg.isNoteOn()) noteHz_.store(juce::MidiMessage::getMidiNoteInHertz(msg.getNoteNumber()), std::memory_order_relaxed);
    }
    midi.clear();
    double bpm = 120;
    if (auto* ph = getPlayHead())
        if (const auto pos = ph->getPosition())
            if (const auto b = pos->getBpm())
                if (*b > 0) bpm = *b;
    bpm_.store(bpm, std::memory_order_relaxed);
    if (buffer.getNumChannels() < 2 || n <= 0) return;
    // une entree mono : la meme a droite
    if (getTotalNumInputChannels() == 1) buffer.copyFrom(1, 0, buffer, 0, 0, n);
    hell_.set(mmhell::settingsOf(patch(), static_cast<double>(raw_.mix->load()), bpm, noteHz_.load(std::memory_order_relaxed)), bpm);
    hell_.process(buffer.getWritePointer(0), buffer.getWritePointer(1), n);
    lfo_.store(hell_.active() ? static_cast<float>(hell_.lfoValue()) : std::numeric_limits<float>::quiet_NaN(), std::memory_order_relaxed);
}

int MMHellProcessor::getNumPrograms() { return static_cast<int>(mmhell::factory().size()); }

const juce::String MMHellProcessor::getProgramName(int index) {
    const auto& b = mmhell::factory();
    return index >= 0 && index < static_cast<int>(b.size()) ? juce::String(b[static_cast<size_t>(index)].name) : juce::String();
}

void MMHellProcessor::setCurrentProgram(int index) {
    // un hote qui repose le programme courant (a la reouverture d'un projet) ne doit rien changer
    if (index == program_.load()) return;
    loadPreset(index);
}

void MMHellProcessor::loadPreset(int index) {
    const auto& b = mmhell::factory();
    if (index < 0 || index >= static_cast<int>(b.size())) return;
    const mmhell::HellPatch& p = b[static_cast<size_t>(index)].p;
    program_.store(index);
    const auto put = [this](const char* id, float value) {
        if (auto* prm = apvts.getParameter(id)) {
            const float v = prm->convertTo0to1(value);
            if (std::fabs(prm->getValue() - v) < 1e-7f) return;
            prm->beginChangeGesture();
            prm->setValueNotifyingHost(v);
            prm->endChangeGesture();
        }
    };
    const auto b01 = [](bool x) { return x ? 1.f : 0.f; };
    const auto f = [](double x) { return static_cast<float>(x); };
    put(pid::sync, b01(p.sync));
    put(pid::note, f(p.note));
    put(pid::time, f(p.time));
    put(pid::feedback, f(p.feedback));
    put(pid::cross, b01(p.cross));
    put(pid::range, f(p.range));
    put(pid::shift, f(p.shift));
    put(pid::sideband, f(p.sideband));
    put(pid::spread, f(p.spread));
    put(pid::phase, f(p.phase));
    put(pid::antiRefl, b01(p.antiRefl));
    put(pid::smear, f(p.smear));
    put(pid::hp, f(p.hp));
    put(pid::lp, f(p.lp));
    put(pid::lfoShape, f(p.lfoShape));
    put(pid::lfoSync, b01(p.lfoSync));
    put(pid::lfoRate, f(p.lfoRate));
    put(pid::lfoNote, f(p.lfoNote));
    put(pid::lfoAmt, f(p.lfoAmt));
    put(pid::lfoStereo, b01(p.lfoStereo));
    put(pid::lfoTarget, f(p.lfoTarget));
    if (raw_.mix->load() <= 0.f) put(pid::mix, kDefaultMix);
}

void MMHellProcessor::getStateInformation(juce::MemoryBlock& destData) {
    auto st = apvts.copyState();
    st.setProperty("editorW", editorW_.load(), nullptr);
    st.setProperty("program", program_.load(), nullptr);
    if (auto xml = st.createXml()) copyXmlToBinary(*xml, destData);
}

void MMHellProcessor::setStateInformation(const void* data, int sizeInBytes) {
    const auto xml = getXmlFromBinary(data, sizeInBytes);
    if (!xml || !xml->hasTagName(apvts.state.getType())) return;
    const auto t = juce::ValueTree::fromXml(*xml);
    apvts.replaceState(t);
    setEditorWidth(static_cast<int>(t.getProperty("editorW", kEditorDefaultW)));
    program_.store(juce::jlimit(0, getNumPrograms() - 1, static_cast<int>(t.getProperty("program", mmhell::initIndex()))));
}

juce::AudioProcessorEditor* MMHellProcessor::createEditor() {
#if MMHELL_HEADLESS
    return nullptr;
#else
    return new MMHellEditor(*this);
#endif
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MMHellProcessor(); }
