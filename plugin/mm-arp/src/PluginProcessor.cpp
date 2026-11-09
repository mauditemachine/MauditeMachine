#include "PluginProcessor.h"

#include "PluginEditor.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace {

constexpr int kChunk = 128;

float dbToGain(float db) { return db <= -59.9f ? 0.f : juce::Decibels::decibelsToGain(db); }

double num(const juce::var& o, const char* k, double def) {
    const juce::var v = o.getProperty(k, juce::var());
    return v.isDouble() || v.isInt() || v.isInt64() ? static_cast<double>(v) : def;
}

// La force d'une note MIDI : velocite 100 = l'accent 1 du site (0.3 a 2, les bornes du moteur)
double accentOf(float vel) { return juce::jlimit(0.3, 2.0, static_cast<double>(vel) * 127.0 / 100.0); }

// Le programme de la face (src/v4/plugin/arp/bridge.ts) : voir plugin/mm-arp/README.md
bool parseProgram(const juce::String& json, MMArpProgram& p) {
    const juce::var o = juce::JSON::parse(json);
    if (!o.isObject() || static_cast<int>(num(o, "v", 0)) != 1) return false;
    p.bpm = juce::jlimit(20.0, 400.0, num(o, "bpm", 120));
    p.arp.swing = juce::jlimit(0.0, 0.5, num(o, "swing", 0));
    if (auto* eng = o.getProperty("engine", juce::var()).getDynamicObject())
        for (const auto& kv : eng->getProperties()) {
            const juce::var& v = kv.value;
            if (!(v.isDouble() || v.isInt() || v.isInt64())) continue;
            const double d = static_cast<double>(v);
            if (!std::isfinite(d)) continue;
            const std::string key = kv.name.toString().toStdString();
            if (key == "bpm") continue; // le tempo est celui de l'hote
            p.engine.emplace_back(key, d);
        }
    const juce::var fx = o.getProperty("fx", juce::var());
    p.fx.chorus = juce::jlimit(0, 2, static_cast<int>(num(fx, "chorus", 0)));
    p.fx.delay = juce::jlimit(0.0, 1.0, num(fx, "delay", 0));
    p.fx.reverb = juce::jlimit(0.0, 1.0, num(fx, "reverb", 0));
    p.fx.tape = juce::jlimit(0.0, 1.0, num(fx, "tape", 0));
    p.dly16 = juce::jlimit(1.0, 16.0, num(fx, "dly16", 3));
    p.fx.monoLowHz = juce::jlimit(0.0, 1000.0, num(fx, "monoHz", 0));
    p.fx.volume = juce::jlimit(0.0, 1.0, num(fx, "volume", 0.8));
    const juce::var a = o.getProperty("arp", juce::var());
    p.arp.spn = num(a, "spn", 1);
    if (!(p.arp.spn == 4 || p.arp.spn == 2 || p.arp.spn == 1 || p.arp.spn == 0.5)) p.arp.spn = 1;
    p.arp.gate = juce::jlimit(0.0, 1.0, num(a, "gate", 0.5));
    p.arp.accent = juce::jlimit(0.0, 1.0, num(a, "accent", 0.5));
    p.arp.drift = juce::jlimit(0.0, 1.0, num(a, "drift", 0));
    p.arp.prog.clear();
    if (const auto* pr = a.getProperty("prog", juce::var()).getArray())
        for (const auto& c : *pr)
            if ((c.isInt() || c.isDouble() || c.isInt64()) && p.arp.prog.size() < 8) p.arp.prog.push_back(static_cast<int>(c));
    p.arp.chords.clear();
    if (const auto* cs = a.getProperty("chords", juce::var()).getArray())
        for (const auto& cv : *cs) {
            mmarp::ArpChord ch;
            ch.c = static_cast<int>(num(cv, "c", -1));
            const juce::var pool = cv.getProperty("pool", juce::var());
            const juce::var steps = cv.getProperty("steps", juce::var());
            const juce::Array<juce::var>* arr = pool.getArray();
            ch.rand = arr != nullptr;
            if (!arr) arr = steps.getArray();
            if (arr)
                for (const auto& m : *arr) {
                    if (m.isInt() || m.isDouble() || m.isInt64()) ch.midi.push_back(juce::jlimit(0, 127, static_cast<int>(m)));
                    else if (!ch.rand) ch.midi.push_back(mmarp::kRest);
                }
            p.arp.chords.push_back(std::move(ch));
        }
    return true;
}

// Le pont arpegiateur -> moteur, sur le thread audio
struct VoySink final : mmarp::ArpSink {
    mmarp::Voyager& v;
    explicit VoySink(mmarp::Voyager& voy) : v(voy) {}
    void note(double t, int midi, double gate, double acc, double from) override { v.note(t, midi, gate, acc, from); }
    void beat(double t, double b, double bpm, bool run) override { v.beat(t, b, bpm, run); }
    void cancel(double t) override { v.cancel(t); }
};

} // namespace

/* ---------------- les parametres et l'etat ---------------- */

juce::AudioProcessorValueTreeState::ParameterLayout MMArpProcessor::makeLayout() {
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{"master", 1}, "Master", juce::NormalisableRange<float>(-60, 6, 0.1f, 2.5f), 0.f));
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID{"arp", 1}, "Arpeggiator", true));
    return layout;
}

MMArpProcessor::MMArpProcessor()
    : AudioProcessor(BusesProperties().withOutput("Main", juce::AudioChannelSet::stereo(), true)), apvts(*this, nullptr, "MMARP", makeLayout()) {
    master_ = apvts.getRawParameterValue("master");
    arpOn_ = apvts.getRawParameterValue("arp");
    seed_ = static_cast<uint32_t>(juce::Random::getSystemRandom().nextInt());
    live_.reserve(64);
    kv_.reserve(128);
    liveAudio_.reserve(64);
}

MMArpProcessor::~MMArpProcessor() = default;

void MMArpProcessor::faceProgram(const juce::String& json) {
    auto p = std::make_shared<MMArpProgram>();
    if (!parseProgram(json, *p)) return;
    progBpm_.store(p->bpm);
    {
        std::lock_guard<std::mutex> lk(mx_);
        programJson_ = json;
    }
    std::shared_ptr<const MMArpProgram> old;
    {
        const juce::SpinLock::ScopedLockType sl(progLock_);
        pending_ = std::move(p);
        // Le programme que le thread audio a quitte : libere ici, jamais sur le thread audio
        old = std::move(retired_);
    }
}

void MMArpProcessor::faceState(const juce::String& lsJson) {
    std::lock_guard<std::mutex> lk(mx_);
    lsJson_ = lsJson;
}

juce::String MMArpProcessor::faceInitState() const {
    std::lock_guard<std::mutex> lk(mx_);
    return lsJson_;
}

void MMArpProcessor::faceNote(int midi, double gateSec, double accent) {
    if (midi < 0 || midi > 127 || !(gateSec > 0)) return;
    const juce::SpinLock::ScopedLockType sl(liveLock_);
    if (live_.size() < 64) live_.push_back({midi, std::min(gateSec, 8.0), juce::jlimit(0.3, 2.0, accent)});
}

MMArpProcessor::Feedback MMArpProcessor::feedback() const {
    return {fbPlaying_.load(), internalPlaying_.load(), fbSeq_.load(), fbSlot_.load(), fbPos_.load(), fbLen_.load(), fbChord_.load(), fbMidi_.load()};
}

void MMArpProcessor::getStateInformation(juce::MemoryBlock& destData) {
    juce::ValueTree state("MMARP1");
    state.setProperty("master", master_->load(), nullptr);
    state.setProperty("arp", arpOn_->load() > 0.5f, nullptr);
    state.setProperty("seed", static_cast<juce::int64>(seed_), nullptr);
    {
        std::lock_guard<std::mutex> lk(mx_);
        state.setProperty("program", programJson_, nullptr);
        state.setProperty("ls", lsJson_, nullptr);
    }
    if (auto xml = state.createXml()) copyXmlToBinary(*xml, destData);
}

void MMArpProcessor::setStateInformation(const void* data, int sizeInBytes) {
    auto xml = getXmlFromBinary(data, sizeInBytes);
    if (!xml || !xml->hasTagName("MMARP1")) return;
    const auto state = juce::ValueTree::fromXml(*xml);
    if (auto* prm = apvts.getParameter("master"))
        prm->setValueNotifyingHost(prm->convertTo0to1(static_cast<float>(static_cast<double>(state.getProperty("master", 0.0)))));
    if (auto* prm = apvts.getParameter("arp")) prm->setValueNotifyingHost(static_cast<bool>(state.getProperty("arp", true)) ? 1.f : 0.f);
    // La graine du projet : le hasard du moteur et de l'arpege (RAND, DRIFT) rejoue pareil a chaque ouverture et a l'export
    if (state.hasProperty("seed")) seed_ = static_cast<uint32_t>(static_cast<juce::int64>(state.getProperty("seed")));
    {
        std::lock_guard<std::mutex> lk(mx_);
        lsJson_ = state.getProperty("ls", "").toString();
    }
    // Le programme garde : le plugin joue fenetre fermee des le chargement du projet
    const juce::String prog = state.getProperty("program", "").toString();
    if (prog.isNotEmpty()) faceProgram(prog);
}

/* ---------------- l'audio ---------------- */

bool MMArpProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo() && layouts.inputBuses.isEmpty();
}

mmarp::ArpFxSettings MMArpProcessor::fxFor(const MMArpProgram& p, double bpm) const {
    mmarp::ArpFxSettings s = p.fx;
    // DLY TIME au tempo de l'hote (audio/synth.ts delayS : 2 s au plus)
    s.delaySeconds = std::min(2.0, p.dly16 * 60.0 / std::max(20.0, bpm) / 4.0);
    return s;
}

void MMArpProcessor::applyProgram(const MMArpProgram& p, double bpm, bool now) {
    // Un message 'params' du site : tous les reglages du moteur, et le tempo
    // (kv_ reserve d'avance, des cles courtes : pas d'allocation sur le thread audio)
    kv_.clear();
    for (const auto& e : p.engine) kv_.push_back(e);
    kv_.emplace_back("bpm", bpm);
    voy_->params(kv_);
    fx_.set(fxFor(p, bpm), now);
    arp_.setProgram(&p.arp);
}

void MMArpProcessor::prepareToPlay(double sampleRate, int samplesPerBlock) {
    sr_ = sampleRate;
    frame_ = 0;
    mmarp::VoyagerOptions o;
    o.sampleRate = sampleRate;
    o.os = sampleRate > 60000 ? 2 : 4;
    o.seed = seed_ == 0 ? 808u : seed_;
    voy_ = std::make_unique<mmarp::Voyager>(o);
    fx_.prepare(sampleRate, std::max(samplesPerBlock, kChunk));
    arp_.prepare(sampleRate);
    arp_.setProgram(nullptr);
    dryL_.assign(static_cast<size_t>(std::max(samplesPerBlock, kChunk)), 0.f);
    dryR_.assign(static_cast<size_t>(std::max(samplesPerBlock, kChunk)), 0.f);
    fresh_ = true;
    lastBpm_ = 0;
    wasPlaying_ = false;
    held_.fill(false);
    lastLiveMidi_ = -1;
    // Le programme courant rejoue sur le nouveau moteur
    {
        const juce::SpinLock::ScopedLockType sl(progLock_);
        if (!pending_ && current_) pending_ = current_;
        current_.reset();
    }
    setLatencySamples(voy_->latencySamples() + fx_.latencySamples());
}

void MMArpProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi) {
    juce::ScopedNoDenormals noDenormals;
    const int n = buffer.getNumSamples();
    buffer.clear();
    if (!voy_ || n <= 0) return;
    const double sr = sr_;
    const int64_t f0 = frame_;
    auto at = [&](int pos) { return static_cast<double>(f0 + pos) / sr; };

    // Le transport : celui de l'hote s'il joue, sinon l'horloge interne (RUN de la face)
    double bpm = progBpm_.load();
    bool hostPlaying = false;
    double ppq = 0;
    if (auto* ph = getPlayHead())
        if (auto pos = ph->getPosition()) {
            if (pos->getBpm()) bpm = *pos->getBpm();
            if (pos->getIsPlaying() && pos->getPpqPosition()) {
                hostPlaying = true;
                ppq = *pos->getPpqPosition();
            }
        }
    bpm = juce::jlimit(20.0, 400.0, bpm);
    bool internal = false;
    if (!hostPlaying && runInternal_.load()) {
        if (!internalPlaying_.load()) internalPpq_ = 0;
        internal = true;
        ppq = internalPpq_;
    }
    // L'hote reprend la main : RUN s'eteint
    if (hostPlaying && runInternal_.load()) runInternal_.store(false);
    internalPlaying_.store(internal);
    const bool playing = hostPlaying || internal;
    const double pps = bpm / 60.0 / sr;
    if (internal) internalPpq_ += n * pps;

    // Un nouveau programme de la face
    if (progLock_.tryEnter()) {
        if (pending_) {
            retired_ = std::move(current_);
            current_ = std::move(pending_);
            applyProgram(*current_, bpm, fresh_);
            fresh_ = false;
            lastBpm_ = bpm;
        }
        progLock_.exit();
    }
    // Le tempo change : le LFO libre et le DELAY le suivent
    if (current_ && bpm != lastBpm_) {
        kv_.clear();
        kv_.emplace_back("bpm", bpm);
        voy_->params(kv_);
        fx_.set(fxFor(*current_, bpm), false);
        lastBpm_ = bpm;
    }

    // STOP : ce qui sonne s'eteint en 12 ms, plus rien d'attendu (synthStop du site)
    if (wasPlaying_ && !playing) voy_->stop(at(0));
    wasPlaying_ = playing;

    // L'arpege : les pas de ce bloc partent vers le moteur (a l'echantillon pres, dans sa file)
    const bool arpOn = arpOn_->load() > 0.5f;
    VoySink sink(*voy_);
    arp_.process(sink, f0, n, playing && arpOn, ppq, pps, seed_);

    // Les notes de la face (apercus)
    if (liveLock_.tryEnter()) {
        liveAudio_.swap(live_);
        live_.clear();
        liveLock_.exit();
    }
    for (const auto& ln : liveAudio_) voy_->note(at(0), ln.midi, ln.gate, ln.accent, std::numeric_limits<double>::quiet_NaN());
    liveAudio_.clear();

    // Les notes MIDI (un clip, un clavier) : le synthe joue, la duree au note-off
    for (const auto meta : midi) {
        const auto msg = meta.getMessage();
        const int pos = juce::jlimit(0, n - 1, meta.samplePosition);
        if (msg.isNoteOn()) {
            const int m = msg.getNoteNumber();
            const double from = lastLiveMidi_ >= 0 ? static_cast<double>(lastLiveMidi_) : std::numeric_limits<double>::quiet_NaN();
            voy_->note(at(pos), m, std::numeric_limits<double>::infinity(), accentOf(msg.getFloatVelocity()), from);
            held_[static_cast<size_t>(m)] = true;
            lastLiveMidi_ = m;
        } else if (msg.isNoteOff()) {
            const int m = msg.getNoteNumber();
            voy_->noteOff(m, at(pos));
            held_[static_cast<size_t>(m)] = false;
        } else if (msg.isAllNotesOff() || msg.isAllSoundOff()) {
            for (int m = 0; m < 128; ++m)
                if (held_[static_cast<size_t>(m)]) {
                    voy_->noteOff(m, at(pos));
                    held_[static_cast<size_t>(m)] = false;
                }
        }
    }

    // Le moteur par morceaux de 128 au plus, puis sa chaine (BASS MONO, CHORUS, DELAY, TAPE, REVERB, VOLUME)
    float* outL = buffer.getWritePointer(0);
    float* outR = buffer.getWritePointer(1);
    if (static_cast<int>(dryL_.size()) < n) {
        // un hote qui depasse le bloc annonce (rare) : agrandi une fois
        dryL_.resize(static_cast<size_t>(n));
        dryR_.resize(static_cast<size_t>(n));
    }
    for (int i = 0; i < n; i += kChunk) {
        const int m = std::min(kChunk, n - i);
        voy_->process(dryL_.data() + i, dryR_.data() + i, m);
    }
    fx_.process(dryL_.data(), dryR_.data(), outL, outR, n);
    buffer.applyGain(dbToGain(master_->load()));
    frame_ += n;

    // La note montree par la face
    fbPlaying_.store(playing && arpOn);
    const mmarp::ArpShown sh = arp_.shownAt(frame_);
    if (playing && sh.len > 0 && sh.frame != lastShownFrame_) {
        lastShownFrame_ = sh.frame;
        fbSlot_.store(sh.slot);
        fbPos_.store(sh.pos);
        fbLen_.store(sh.len);
        fbChord_.store(sh.chord);
        fbMidi_.store(sh.midi);
        fbSeq_.fetch_add(1);
    }
}

juce::AudioProcessorEditor* MMArpProcessor::createEditor() { return new MMArpEditor(*this); }

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MMArpProcessor(); }
