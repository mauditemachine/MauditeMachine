#include "PluginProcessor.h"

#if !MMARP_HEADLESS
#include "PluginEditor.h"
#endif

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

bool isNum(const juce::var& v) { return v.isDouble() || v.isInt() || v.isInt64(); }

// La force d'une note MIDI : velocite 100 = l'accent 1 du site (0.3 a 2, les bornes du moteur)
double accentOf(float vel) { return juce::jlimit(0.3, 2.0, static_cast<double>(vel) * 127.0 / 100.0); }

// La suite (voyager/seq.ts SeqState : edit, len, buf de 16 degres ou null)
void parseSeq(const juce::var& o, mmarp::SeqStateC& s) {
    s.edit = static_cast<bool>(o.getProperty("edit", false));
    s.len = juce::jlimit(1, 16, static_cast<int>(num(o, "len", 8)));
    for (int i = 0; i < 16; ++i) s.buf[i] = 0;
    if (const auto* b = o.getProperty("buf", juce::var()).getArray())
        for (int i = 0; i < std::min(16, b->size()); ++i) {
            const juce::var& d = b->getReference(i);
            s.buf[i] = isNum(d) ? juce::jlimit(-7, 24, static_cast<int>(d)) : mmarp::kSeqRest;
        }
}

void parseProg(const juce::var& arr, MMArpProgram& p) {
    p.nProg = 0;
    if (const auto* pr = arr.getArray())
        for (const auto& c : *pr)
            if (isNum(c) && p.nProg < 8 && static_cast<int>(c) >= 0 && static_cast<int>(c) < 8) p.prog[static_cast<size_t>(p.nProg++)] = static_cast<int>(c);
}

bool parseKnobs(const juce::var& o, std::array<double, mmarp::kKnobs>& k) {
    auto* d = o.getDynamicObject();
    if (!d) return false;
    for (int i = 0; i < mmarp::kKnobs; ++i) k[static_cast<size_t>(i)] = mmarp::kKnobDefs[i].def;
    for (const auto& kv : d->getProperties()) {
        const int i = mmarp::knobIndex(kv.name.toString().toRawUTF8());
        if (i >= 0 && isNum(kv.value)) k[static_cast<size_t>(i)] = juce::jlimit(0.0, 1.0, static_cast<double>(kv.value));
    }
    return true;
}

// Le programme v2 de la face (src/v4/plugin/arp/bridge.ts) : voir plugin/mm-arp/README.md
bool parseProgram(const juce::String& json, MMArpProgram& p) {
    const juce::var o = juce::JSON::parse(json);
    if (!o.isObject() || static_cast<int>(num(o, "v", 0)) != 2) return false;
    p.bpm = juce::jlimit(20.0, 400.0, num(o, "bpm", 120));
    p.swing = juce::jlimit(0.0, 0.5, num(o, "swing", 0));
    parseSeq(o.getProperty("seq", juce::var()), p.seq);
    parseProg(o.getProperty("prog", juce::var()), p);
    p.hasKnobs = parseKnobs(o.getProperty("knobs", juce::var()), p.knobs);
    return true;
}

// Le pont arpegiateur -> moteur, sur le thread audio
struct VoySink final : mmarp::ArpSink {
    mmarp::Voyager& v;
    explicit VoySink(mmarp::Voyager& voy) : v(voy) {}
    void note(double t, int midi, double gate, double acc, double from) override { v.note(t, static_cast<double>(midi), gate, acc, from); }
    void beat(double t, double b, double bpm, bool run) override { v.beat(t, b, bpm, run); }
    void cancel(double t) override { v.cancel(t); }
};

} // namespace

/* ---------------- les parametres et l'etat ---------------- */

juce::AudioProcessorValueTreeState::ParameterLayout MMArpProcessor::makeLayout() {
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID{"arp", 1}, "Arpeggiator", true));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{"master", 1}, "Master", juce::NormalisableRange<float>(-60, 6, 0.1f, 2.5f), 0.f));
    // Les potards du site, dans l'ordre de la face (voyager/params.ts VOY_KNOBS), leur texte comme a l'ecran
    for (int i = 0; i < mmarp::kKnobs; ++i) {
        const auto& d = mmarp::kKnobDefs[i];
        auto attr = juce::AudioParameterFloatAttributes()
                        .withStringFromValueFunction([i](float v, int) {
                            char buf[64];
                            mmarp::knobText(i, static_cast<double>(v), buf, static_cast<int>(sizeof(buf)));
                            return juce::String(buf);
                        })
                        .withLabel("");
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{d.id, 1}, juce::String(d.label), juce::NormalisableRange<float>(0.f, 1.f), static_cast<float>(d.def), attr));
    }
    return layout;
}

MMArpProcessor::MMArpProcessor()
    : AudioProcessor(BusesProperties().withOutput("Main", juce::AudioChannelSet::stereo(), true)), apvts(*this, nullptr, "MMARP", makeLayout()) {
    master_ = apvts.getRawParameterValue("master");
    arpOn_ = apvts.getRawParameterValue("arp");
    for (int i = 0; i < mmarp::kKnobs; ++i) {
        knobRaw_[static_cast<size_t>(i)] = apvts.getRawParameterValue(mmarp::kKnobDefs[i].id);
        knobParams_[static_cast<size_t>(i)] = apvts.getParameter(mmarp::kKnobDefs[i].id);
        knobs_[static_cast<size_t>(i)] = mmarp::kKnobDefs[i].def;
    }
    seed_ = static_cast<uint32_t>(juce::Random::getSystemRandom().nextInt());
    bpmId_ = mmarp::Voyager::paramIndex("bpm");
    mmarp::reserveArp(arpBuf_[0]);
    mmarp::reserveArp(arpBuf_[1]);
    // Le programme de depart : sans accord, la suite AUTO
    publish(std::make_shared<MMArpProgram>());
}

MMArpProcessor::~MMArpProcessor() = default;

void MMArpProcessor::publish(std::shared_ptr<const MMArpProgram> p) {
    progBpm_.store(p->bpm);
    std::shared_ptr<const MMArpProgram> old;
    {
        const juce::SpinLock::ScopedLockType sl(progLock_);
        pending_ = std::move(p);
        // Le programme que le thread audio a quitte : libere ici, jamais sur le thread audio
        old = std::move(retired_);
    }
}

void MMArpProcessor::setKnobsFrom(const std::array<double, mmarp::kKnobs>& k) {
    for (int i = 0; i < mmarp::kKnobs; ++i)
        if (auto* prm = knobParams_[static_cast<size_t>(i)]) prm->setValueNotifyingHost(static_cast<float>(k[static_cast<size_t>(i)]));
    knobsKnown_.store(true);
}

void MMArpProcessor::faceProgram(const juce::String& json) {
    auto p = std::make_shared<MMArpProgram>();
    if (!parseProgram(json, *p)) return;
    // Une instance neuve (ou un projet d'avant les parametres) : les potards de la face deviennent ceux du plugin
    if (p->hasKnobs && !knobsKnown_.load()) setKnobsFrom(p->knobs);
    {
        std::lock_guard<std::mutex> lk(mx_);
        programJson_ = json;
    }
    publish(std::move(p));
}

void MMArpProcessor::faceParam(const juce::String& id, double v) {
    const int i = mmarp::knobIndex(id.toRawUTF8());
    if (i < 0 || !std::isfinite(v)) return;
    if (auto* prm = knobParams_[static_cast<size_t>(i)]) prm->setValueNotifyingHost(static_cast<float>(juce::jlimit(0.0, 1.0, v)));
    knobsKnown_.store(true);
}

void MMArpProcessor::faceGesture(const juce::String& id, bool on) {
    const int i = mmarp::knobIndex(id.toRawUTF8());
    if (i < 0) return;
    if (auto* prm = knobParams_[static_cast<size_t>(i)]) {
        if (on) prm->beginChangeGesture();
        else prm->endChangeGesture();
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

MMArpProcessor::Feedback MMArpProcessor::feedback() const {
    return {fbPlaying_.load(), internalPlaying_.load(), fbSeq_.load(), fbSlot_.load(), fbPos_.load(), fbLen_.load(), fbChord_.load(), fbMidi_.load()};
}

juce::File MMArpProcessor::presetDir() {
    return juce::File::getSpecialLocation(juce::File::userMusicDirectory).getChildFile("Maudite Machine").getChildFile("MM-ARP Presets");
}

// Un projet d'avant les parametres (2026-11-09, la premiere version) : les potards, la suite et la progression sont dans
// l'etat de la face (les cles mm.v4.* du site)
bool MMArpProcessor::legacyFromLs(const juce::String& lsJson) {
    const juce::var st = juce::JSON::parse(lsJson);
    const juce::var ls = st.getProperty("ls", juce::var());
    if (!ls.isObject()) return false;
    auto p = std::make_shared<MMArpProgram>();
    const juce::var knobs = juce::JSON::parse(ls.getProperty("mm.v4.voyager.1", "").toString());
    if (!parseKnobs(knobs.getProperty("knobs", juce::var()), p->knobs)) return false;
    parseSeq(juce::JSON::parse(ls.getProperty("mm.v4.voyager.seq.1", "").toString()), p->seq);
    parseProg(juce::JSON::parse(ls.getProperty("mm.v4.plugin.arp.prog", "").toString()), *p);
    setKnobsFrom(p->knobs);
    publish(std::move(p));
    return true;
}

void MMArpProcessor::getStateInformation(juce::MemoryBlock& destData) {
    juce::ValueTree state("MMARP1");
    state.setProperty("v", 2, nullptr);
    state.setProperty("seed", static_cast<juce::int64>(seed_), nullptr);
    // Les parametres (les potards, Master, Arpeggiator)
    state.appendChild(apvts.copyState(), nullptr);
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
    // La graine du projet : le hasard du moteur et de l'arpege (RAND, DRIFT) rejoue pareil a chaque ouverture et a l'export
    if (state.hasProperty("seed")) seed_ = static_cast<uint32_t>(static_cast<juce::int64>(state.getProperty("seed")));
    const juce::String ls = state.getProperty("ls", "").toString();
    {
        std::lock_guard<std::mutex> lk(mx_);
        lsJson_ = ls;
    }
    const auto params = state.getChildWithName(apvts.state.getType());
    if (params.isValid()) {
        apvts.replaceState(params);
        knobsKnown_.store(true);
        // La suite, la progression, le tempo de la face : le programme garde (le plugin joue fenetre fermee)
        const juce::String prog = state.getProperty("program", "").toString();
        if (prog.isNotEmpty()) faceProgram(prog);
        return;
    }
    // Un projet de la premiere version : Master et Arpeggiator a part, le reste dans l'etat de la face
    if (auto* prm = apvts.getParameter("master"))
        prm->setValueNotifyingHost(prm->convertTo0to1(static_cast<float>(static_cast<double>(state.getProperty("master", 0.0)))));
    if (auto* prm = apvts.getParameter("arp")) prm->setValueNotifyingHost(static_cast<bool>(state.getProperty("arp", true)) ? 1.f : 0.f);
    legacyFromLs(ls);
}

/* ---------------- l'audio ---------------- */

bool MMArpProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo() && layouts.inputBuses.isEmpty();
}

// Les potards ou le programme ont change : le moteur, la chaine et l'arpege en sont tires (thread audio, sans allocation)
void MMArpProcessor::update(double bpm, bool knobsChanged, bool progChanged) {
    const MMArpProgram& p = *current_;
    if (knobsChanged || fresh_) {
        // Un message 'params' du site : tous les reglages du moteur, et le tempo
        int n = mmarp::engineParams(knobs_.data(), kv_.data(), static_cast<int>(kv_.size()) - 1);
        kv_[static_cast<size_t>(n++)] = {bpmId_, bpm};
        voy_->params(kv_.data(), n);
        mmarp::ArpFxSettings fx;
        double dly16 = 3;
        mmarp::fxSettings(knobs_.data(), fx, dly16);
        // DLY TIME au tempo de l'hote (audio/synth.ts delayS : 2 s au plus)
        fx.delaySeconds = std::min(2.0, dly16 * 60.0 / std::max(20.0, bpm) / 4.0);
        auto eq = [](double a, double b) { return !(a < b || a > b); };
        const bool same = !fresh_ && fx.chorus == fxNow_.chorus && eq(fx.delay, fxNow_.delay) && eq(fx.reverb, fxNow_.reverb) && eq(fx.tape, fxNow_.tape) &&
                          eq(fx.delaySeconds, fxNow_.delaySeconds) && eq(fx.monoLowHz, fxNow_.monoLowHz) && eq(fx.volume, fxNow_.volume);
        if (!same) fx_.set(fx, fresh_);
        fxNow_ = fx;
        dly16_ = dly16;
        lastBpm_ = bpm;
    }
    // L'arpege dans le tampon libre, puis echange (l'arpegiateur garde son pointeur jusque-la)
    const int next = 1 - arpCur_;
    mmarp::arpProgram(knobs_.data(), p.seq, p.prog.data(), p.nProg, arpBuf_[next]);
    arpBuf_[next].swing = p.swing;
    arp_.setProgram(&arpBuf_[next]);
    arpCur_ = next;
    juce::ignoreUnused(progChanged);
    fresh_ = false;
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
    fifoReserve(static_cast<size_t>(std::max(samplesPerBlock, kChunk)) + 2 * kChunk);
    // 128 echantillons de silence d'avance : le retard fixe de la file
    fifoHead_ = 0;
    fifoSize_ = kChunk;
    std::fill(fifoL_.begin(), fifoL_.end(), 0.f);
    std::fill(fifoR_.begin(), fifoR_.end(), 0.f);
    engFrames_ = 0;
    fresh_ = true;
    lastBpm_ = 0;
    // tous les potards relus au premier bloc
    for (auto& k : knobRawLast_) k = -1.f;
    wasPlaying_ = false;
    held_.fill(false);
    lastLiveMidi_ = -1;
    // Le programme courant rejoue sur le nouveau moteur
    {
        const juce::SpinLock::ScopedLockType sl(progLock_);
        if (!pending_ && current_) pending_ = current_;
        current_.reset();
    }
    setLatencySamples(kChunk + voy_->latencySamples() + fx_.latencySamples());
}

void MMArpProcessor::fifoReserve(size_t cap) {
    if (fifoL_.size() >= cap) return;
    // Agrandie en gardant l'ordre (prepareToPlay, ou un hote qui depasse le bloc annonce : rare)
    std::vector<float> l(cap, 0.f), r(cap, 0.f);
    for (size_t i = 0; i < fifoSize_; ++i) {
        const size_t j = (fifoHead_ + i) % fifoL_.size();
        l[i] = fifoL_[j];
        r[i] = fifoR_[j];
    }
    fifoL_.swap(l);
    fifoR_.swap(r);
    fifoHead_ = 0;
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

    // Un nouveau programme de la face (la suite, la progression)
    bool progChanged = false;
    if (progLock_.tryEnter()) {
        if (pending_) {
            retired_ = std::move(current_);
            current_ = std::move(pending_);
            progChanged = true;
        }
        progLock_.exit();
    }
    // Les potards (automation, MIDI Map, la face)
    bool knobsChanged = false;
    for (size_t i = 0; i < knobs_.size(); ++i) {
        const float r = knobRaw_[i]->load();
        if (r < knobRawLast_[i] || r > knobRawLast_[i]) {
            knobRawLast_[i] = r;
            // arrondi comme voyParams.set du site (un float de l'hote rend la valeur exacte d'un reglage du site)
            knobs_[i] = mmarp::knobClean(static_cast<int>(i), static_cast<double>(r));
            knobsChanged = true;
        }
    }
    if (current_ && (progChanged || knobsChanged || fresh_)) update(bpm, knobsChanged, progChanged);
    // Le tempo change : le LFO libre et le DELAY le suivent
    if (current_ && std::fabs(bpm - lastBpm_) > 1e-9) {
        const mmarp::ParamKV b{bpmId_, bpm};
        voy_->params(&b, 1);
        fx_.retimeDelay(std::min(2.0, dly16_ * 60.0 / std::max(20.0, bpm) / 4.0));
        fxNow_.delaySeconds = std::min(2.0, dly16_ * 60.0 / std::max(20.0, bpm) / 4.0);
        lastBpm_ = bpm;
    }

    // STOP : ce qui sonne s'eteint en 12 ms, plus rien d'attendu (synthStop du site)
    if (wasPlaying_ && !playing) voy_->stop(at(0));
    wasPlaying_ = playing;

    // L'arpege : les pas de ce bloc partent vers le moteur (a l'echantillon pres, dans sa file)
    const bool arpOn = arpOn_->load() > 0.5f;
    VoySink sink(*voy_);
    arp_.process(sink, f0, n, playing && arpOn, ppq, pps, seed_);

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

    // Le moteur par blocs de 128 exactement (tout ce que ce bloc a mis dans sa file est connu), dans la file ; la sortie
    // en reprend n, 128 echantillons plus tard ; puis la chaine (BASS MONO, CHORUS, DELAY, TAPE, REVERB, VOLUME)
    float* outL = buffer.getWritePointer(0);
    float* outR = buffer.getWritePointer(1);
    if (static_cast<int>(dryL_.size()) < n) {
        dryL_.resize(static_cast<size_t>(n));
        dryR_.resize(static_cast<size_t>(n));
    }
    fifoReserve(static_cast<size_t>(n) + 2 * kChunk + fifoSize_);
    const size_t cap = fifoL_.size();
    float bl[kChunk], br[kChunk];
    while (engFrames_ + kChunk <= f0 + n) {
        voy_->process(bl, br, kChunk);
        for (int i = 0; i < kChunk; ++i) {
            const size_t j = (fifoHead_ + fifoSize_ + static_cast<size_t>(i)) % cap;
            fifoL_[j] = bl[i];
            fifoR_[j] = br[i];
        }
        fifoSize_ += kChunk;
        engFrames_ += kChunk;
    }
    for (int i = 0; i < n; ++i) {
        dryL_[static_cast<size_t>(i)] = fifoL_[fifoHead_];
        dryR_[static_cast<size_t>(i)] = fifoR_[fifoHead_];
        fifoHead_ = (fifoHead_ + 1) % cap;
    }
    fifoSize_ -= static_cast<size_t>(n);
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

#if MMARP_HEADLESS
// Le banc sans fenetre (tests/host_test.cpp, Linux) : le meme processeur, sans la WebView
juce::AudioProcessorEditor* MMArpProcessor::createEditor() { return nullptr; }
#else
juce::AudioProcessorEditor* MMArpProcessor::createEditor() { return new MMArpEditor(*this); }
#endif

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MMArpProcessor(); }
