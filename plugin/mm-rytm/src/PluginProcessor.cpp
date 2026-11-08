#include "PluginProcessor.h"

#include "PluginEditor.h"
#include "SampleBank.h"

#include <algorithm>

namespace {

using APF = juce::AudioParameterFloat;
using APC = juce::AudioParameterChoice;
using APB = juce::AudioParameterBool;
using API = juce::AudioParameterInt;
using NR = juce::NormalisableRange<float>;

// Le kit de depart du site (audio/kitlaw.ts) : KICK en 909, les autres en MM ; BD, SD et OH jouent le premier
// sample de leur famille, la synthese a 0 (SAMPLE_FIRST).
bool sampleFirst(int t) { return t == mm::T_BD || t == mm::T_SD || t == mm::T_OH; }

// GM : la note MIDI d'entree -> la piste (-1 : ignoree).
int trackOfNote(int note) {
    switch (note) {
        case 35: case 36: return mm::T_BD;
        case 38: case 40: return mm::T_SD;
        case 42: case 44: return mm::T_CH;
        case 46: return mm::T_OH;
        case 39: return mm::T_CP;
        case 41: case 43: case 45: return mm::T_TOM;
        case 47: case 48: case 50: return mm::T_HT;
        case 49: case 51: case 52: case 55: case 57: return mm::T_CY;
        default: return -1;
    }
}

float dbToGain(float db) { return db <= -59.9f ? 0.f : juce::Decibels::decibelsToGain(db); }

struct Event {
    int offset;
    int track;
    float vel;
};

} // namespace

/* ---------------- le calcul des sons, hors du thread audio ---------------- */

struct MMRytmProcessor::Renderer : juce::Thread {
    MMRytmProcessor& p;
    std::array<juce::String, mm::kTracks> done;    // signature du son publie
    std::array<juce::String, mm::kTracks> seen;    // derniere signature lue
    std::array<double, mm::kTracks> seenAt{};      // quand elle a change
    std::atomic<int> ready{0};

    explicit Renderer(MMRytmProcessor& proc) : juce::Thread("MM-RYTM render"), p(proc) {}

    void run() override {
        while (!threadShouldExit()) {
            const double sr = p.sr_.load();
            const double now = juce::Time::getMillisecondCounterHiRes() / 1000.0;
            if (sr > 0) {
                int count = 0;
                for (int t = 0; t < mm::kTracks; ++t) {
                    const juce::String sig = p.signatureOf(t);
                    if (sig != seen[t]) {
                        seen[t] = sig;
                        seenAt[t] = now;
                    }
                    // un potard qui tourne : on attend 40 ms de repos (sauf le tout premier calcul)
                    const bool first = done[t].isEmpty();
                    if (sig != done[t] && (first || now - seenAt[t] > 0.04)) {
                        int smp = -1;
                        double stretch = 1;
                        const mm::ShotTweak tw = p.tweakOf(t, smp, stretch);
                        const auto& bank = mm::SampleBank::get().of(t);
                        const mm::SamplePcm* pcm = smp >= 0 && smp < static_cast<int>(bank.size()) ? &bank[static_cast<size_t>(smp)].pcm : nullptr;
                        auto snd = std::make_shared<mm::TrackSound>();
                        const mm::ShotId id = mm::shotOfTrack(t);
                        // un sample joue toujours le meme fichier : une seule variante
                        const int nv = tw.syn > 0 ? mm::variantsOf(id) : 1;
                        for (int v = 0; v < nv; ++v) snd->variants.push_back(mm::renderLayers(id, sr, stretch, v, tw, pcm));
                        p.engine_.publish(t, std::move(snd));
                        done[t] = sig;
                    }
                    if (done[t].isNotEmpty()) ++count;
                }
                ready.store(count);
                p.engine_.collect(now);
            }
            wait(25);
        }
    }
};

/* ---------------- les parametres ---------------- */

juce::String MMRytmProcessor::pid(int track, const char* key) { return "t" + juce::String(track + 1) + "_" + key; }

juce::AudioProcessorValueTreeState::ParameterLayout MMRytmProcessor::makeLayout() {
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    const juce::StringArray machines{"909", "808", "MM"};
    for (int t = 0; t < mm::kTracks; ++t) {
        const juce::String n = mm::trackName(t);
        auto grp = std::make_unique<juce::AudioProcessorParameterGroup>("t" + juce::String(t + 1), n, "|");
        auto add = [&](std::unique_ptr<juce::RangedAudioParameter> prm) { grp->addChild(std::move(prm)); };
        const int ver = 1;
        add(std::make_unique<APC>(juce::ParameterID{pid(t, "machine"), ver}, n + " Machine", machines, t == mm::T_BD ? 0 : 2));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "syn"), ver}, n + " Synth Level", NR(0, 1), sampleFirst(t) ? 0.f : 1.f));
        juce::StringArray samples{"OFF"};
        for (const auto& s : mm::SampleBank::get().of(t)) samples.add(s.name);
        add(std::make_unique<APC>(juce::ParameterID{pid(t, "sample"), ver}, n + " Sample", samples, sampleFirst(t) && samples.size() > 1 ? 1 : 0));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "smpLev"), ver}, n + " Sample Level", NR(0, 1), 1.f));
        add(std::make_unique<API>(juce::ParameterID{pid(t, "smpTune"), ver}, n + " Sample Tune", -24, 24, 0));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "smpStart"), ver}, n + " Sample Start", NR(0, 1), 0.f));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "smpLen"), ver}, n + " Sample Length", NR(0, 1), 1.f));
        add(std::make_unique<APB>(juce::ParameterID{pid(t, "smpRev"), ver}, n + " Sample Reverse", false));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "tune"), ver}, n + " Tune", NR(0, 1), 0.5f));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "decay"), ver}, n + " Decay", NR(0, 1), t == mm::T_BD ? 0.45f : 0.5f));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "attack"), ver}, n + " Attack", NR(0, 1), 0.5f));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "drive"), ver}, n + " Drive", NR(0, 1), 0.25f));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "snappy"), ver}, n + " Snappy", NR(0, 1), 0.5f));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "sweep"), ver}, n + " Sweep", NR(0, 1), 0.5f));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "tone"), ver}, n + " Tone", NR(0, 1), 0.5f));
        add(std::make_unique<APB>(juce::ParameterID{pid(t, "gate"), ver}, n + " Gate", false));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "stretch"), ver}, n + " Stretch", NR(-1, 1), 0.f));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "level"), ver}, n + " Level", NR(-60, 6, 0.1f, 2.5f), 0.f));
        add(std::make_unique<APF>(juce::ParameterID{pid(t, "pan"), ver}, n + " Pan", NR(-1, 1), 0.f));
        add(std::make_unique<APB>(juce::ParameterID{pid(t, "mute"), ver}, n + " Mute", false));
        add(std::make_unique<APC>(juce::ParameterID{pid(t, "out"), ver}, n + " Output", juce::StringArray{"Main", "Own"}, 0));
        layout.add(std::move(grp));
    }
    layout.add(std::make_unique<APF>(juce::ParameterID{"master", 1}, "Master", NR(-60, 6, 0.1f, 2.5f), 0.f));
    layout.add(std::make_unique<APF>(juce::ParameterID{"swing", 1}, "Swing", NR(50, 80, 1), 50.f));
    layout.add(std::make_unique<API>(juce::ParameterID{"length", 1}, "Length", 1, 16, 16));
    layout.add(std::make_unique<APF>(juce::ParameterID{"bpm", 1}, "Internal BPM", NR(40, 240, 0.1f), 122.f));
    layout.add(std::make_unique<APB>(juce::ParameterID{"run", 1}, "Internal Run", false));
    return layout;
}

MMRytmProcessor::MMRytmProcessor()
    : AudioProcessor([] {
          BusesProperties b;
          b = b.withOutput("Main", juce::AudioChannelSet::stereo(), true);
          for (int t = 0; t < mm::kTracks; ++t) b = b.withOutput(mm::trackName(t), juce::AudioChannelSet::stereo(), false);
          return b;
      }()),
      apvts(*this, nullptr, "MMRYTM", makeLayout()) {
    for (int t = 0; t < mm::kTracks; ++t)
        raw_[t] = {apvts.getRawParameterValue(pid(t, "level")), apvts.getRawParameterValue(pid(t, "pan")), apvts.getRawParameterValue(pid(t, "mute")),
                   apvts.getRawParameterValue(pid(t, "out"))};
    master_ = apvts.getRawParameterValue("master");
    swing_ = apvts.getRawParameterValue("swing");
    length_ = apvts.getRawParameterValue("length");
    bpm_ = apvts.getRawParameterValue("bpm");
    run_ = apvts.getRawParameterValue("run");
    setDefaultPattern();
    renderer_ = std::make_unique<Renderer>(*this);
    renderer_->startThread(juce::Thread::Priority::normal);
}

MMRytmProcessor::~MMRytmProcessor() { renderer_->stopThread(2000); }

void MMRytmProcessor::setDefaultPattern() {
    // Un motif indie dance : le kick a la noire, le clap sur 2 et 4, le charley ferme en contretemps de double, l'OH au contretemps
    auto set = [this](int t, std::initializer_list<int> s, uint8_t v = 1) {
        for (int i : s) seq.steps[t][i].store(v);
    };
    for (auto& tr : seq.steps)
        for (auto& s : tr) s.store(0);
    set(mm::T_BD, {0, 4, 8, 12});
    set(mm::T_CP, {4, 12});
    set(mm::T_CH, {1, 3, 5, 7, 9, 11, 13, 15});
    set(mm::T_OH, {2, 6, 10, 14});
}

bool MMRytmProcessor::soundsReady() const { return renderer_ && renderer_->ready.load() == mm::kTracks; }

mm::ShotTweak MMRytmProcessor::tweakOf(int t, int& sampleIndex, double& stretch) const {
    auto v = [&](const char* k) { return static_cast<double>(apvts.getRawParameterValue(pid(t, k))->load()); };
    mm::ShotTweak tw;
    const int machine = static_cast<int>(v("machine"));
    tw.model = machine == 0 ? mm::KitModel::K909 : machine == 1 ? mm::KitModel::K808 : mm::KitModel::MM;
    const bool kick = t == mm::T_BD;
    // TUNE et DECAY : ceux du kick sur BD, ceux de la caisse claire (sdTune, sdDecay) sur les autres voix
    tw.tune = kick ? v("tune") : 0.5;
    tw.sdTune = kick ? 0.5 : v("tune");
    tw.decay = kick ? v("decay") : 0.45;
    tw.sdDecay = kick ? 0.5 : v("decay");
    tw.attack = v("attack");
    tw.drive = v("drive");
    tw.snappy = v("snappy");
    tw.sweep = v("sweep");
    tw.sdTone = v("tone");
    tw.gate = v("gate") > 0.5;
    tw.syn = v("syn");
    sampleIndex = static_cast<int>(v("sample")) - 1;
    tw.hasSample = sampleIndex >= 0;
    tw.smp.lev = v("smpLev");
    tw.smp.st = std::round(v("smpTune"));
    tw.smp.start = v("smpStart");
    tw.smp.len = v("smpLen");
    tw.smp.rev = v("smpRev") > 0.5;
    // STRETCH : 4^v, arrondi au huitieme (la cle du site, shotKey)
    const double sv = std::round(v("stretch") * 8) / 8;
    stretch = std::pow(4.0, sv);
    return tw;
}

juce::String MMRytmProcessor::signatureOf(int t) const {
    int smp = -1;
    double stretch = 1;
    const mm::ShotTweak tw = tweakOf(t, smp, stretch);
    auto q = [](double x) { return juce::String(std::round(x * 1000) / 1000, 3); };
    juce::String s;
    s << sr_.load() << "|" << static_cast<int>(tw.model) << "|" << q(tw.tune) << q(tw.sdTune) << q(tw.decay) << q(tw.sdDecay) << q(tw.attack) << q(tw.drive)
      << q(tw.snappy) << q(tw.sweep) << q(tw.sdTone) << (tw.gate ? "g" : "-") << q(tw.syn) << "|" << smp << "|" << q(tw.smp.lev) << q(tw.smp.st)
      << q(tw.smp.start) << q(tw.smp.len) << (tw.smp.rev ? "r" : "-") << q(stretch);
    return s;
}

/* ---------------- l'audio ---------------- */

bool MMRytmProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo()) return false;
    for (int i = 1; i < layouts.outputBuses.size(); ++i) {
        const auto& set = layouts.outputBuses.getReference(i);
        if (!set.isDisabled() && set != juce::AudioChannelSet::stereo()) return false;
    }
    return layouts.inputBuses.isEmpty();
}

void MMRytmProcessor::prepareToPlay(double sampleRate, int) {
    if (sampleRate != sr_.load()) {
        engine_.prepare(sampleRate);
        sr_.store(sampleRate);
    }
}

void MMRytmProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi) {
    juce::ScopedNoDenormals noDenormals;
    const int n = buffer.getNumSamples();
    buffer.clear();
    const double sr = getSampleRate() > 0 ? getSampleRate() : sr_.load();

    // le mix de chaque piste
    for (int t = 0; t < mm::kTracks; ++t) {
        mm::TrackMix m;
        m.gain = dbToGain(raw_[t].level->load());
        m.pan = raw_[t].pan->load();
        m.mute = raw_[t].mute->load() > 0.5f;
        m.ownOut = raw_[t].out->load() > 0.5f;
        engine_.setMix(t, m);
    }

    // les coups du bloc (MIDI, sequenceur, ecoute depuis la face), joues dans l'ordre de leur offset
    std::array<Event, 512> ev;
    int ne = 0;
    auto push = [&](int track, float vel, int off) {
        if (ne < static_cast<int>(ev.size())) ev[static_cast<size_t>(ne++)] = {off, track, vel};
    };
    for (const auto meta : midi) {
        const auto msg = meta.getMessage();
        if (msg.isNoteOn()) {
            const int t = trackOfNote(msg.getNoteNumber());
            if (t >= 0) push(t, msg.getFloatVelocity(), meta.samplePosition);
        } else if (msg.isAllNotesOff() || msg.isAllSoundOff()) {
            engine_.allNotesOff();
        }
    }
    const uint32_t aud = audition_.exchange(0, std::memory_order_relaxed);
    for (int t = 0; t < mm::kTracks; ++t)
        if (aud & (1u << t)) push(t, 1.f, 0);

    // le transport : celui de l'hote s'il joue, sinon l'horloge interne (RUN)
    bool playing = false;
    double ppq = 0, bpm = bpm_->load();
    if (auto* ph = getPlayHead()) {
        if (auto pos = ph->getPosition()) {
            if (pos->getIsPlaying() && pos->getPpqPosition()) {
                playing = true;
                ppq = *pos->getPpqPosition();
                if (pos->getBpm()) bpm = *pos->getBpm();
                internalPpq_ = ppq;
            }
        }
    }
    if (!playing && run_->load() > 0.5f) {
        if (!wasPlaying_) internalPpq_ = 0;
        playing = true;
        ppq = internalPpq_;
    }
    if (playing) {
        const double pps = bpm / 60.0 / sr;
        const double swing = swing_->load() / 100.0;
        const int length = juce::jlimit(1, 16, static_cast<int>(length_->load()));
        seq.process(ppq, pps, n, swing, length, [&](int t, float vel, int off) { push(t, vel, off); });
        internalPpq_ = ppq + n * pps;
    } else if (wasPlaying_) {
        seq.currentStep.store(-1, std::memory_order_relaxed);
    }
    wasPlaying_ = playing;
    running_.store(playing, std::memory_order_relaxed);

    std::sort(ev.begin(), ev.begin() + ne, [](const Event& a, const Event& b) { return a.offset < b.offset; });
    for (int i = 0; i < ne; ++i) engine_.trigger(ev[static_cast<size_t>(i)].track, ev[static_cast<size_t>(i)].vel, ev[static_cast<size_t>(i)].offset);

    // le rendu : le main, et les sorties separees actives
    auto main = getBusBuffer(buffer, false, 0);
    float* auxL[mm::kTracks] = {};
    float* auxR[mm::kTracks] = {};
    for (int t = 0; t < mm::kTracks; ++t) {
        if (t + 1 < getBusCount(false) && getBus(false, t + 1)->isEnabled()) {
            auto aux = getBusBuffer(buffer, false, t + 1);
            if (aux.getNumChannels() >= 2) {
                auxL[t] = aux.getWritePointer(0);
                auxR[t] = aux.getWritePointer(1);
            }
        }
    }
    engine_.render(main.getWritePointer(0), main.getWritePointer(1), auxL, auxR, n);
    buffer.applyGain(dbToGain(master_->load()));
}

/* ---------------- l'etat ---------------- */

void MMRytmProcessor::getStateInformation(juce::MemoryBlock& destData) {
    auto state = apvts.copyState();
    juce::ValueTree pat("PATTERN");
    for (int t = 0; t < mm::kTracks; ++t) {
        juce::String s;
        for (int i = 0; i < mm::kSteps; ++i) s << static_cast<int>(seq.steps[t][i].load());
        pat.setProperty(mm::trackName(t), s, nullptr);
    }
    state.removeChild(state.getChildWithName("PATTERN"), nullptr);
    state.appendChild(pat, nullptr);
    if (auto xml = state.createXml()) copyXmlToBinary(*xml, destData);
}

void MMRytmProcessor::setStateInformation(const void* data, int sizeInBytes) {
    auto xml = getXmlFromBinary(data, sizeInBytes);
    if (!xml || !xml->hasTagName(apvts.state.getType())) return;
    auto state = juce::ValueTree::fromXml(*xml);
    const auto pat = state.getChildWithName("PATTERN");
    if (pat.isValid()) {
        for (int t = 0; t < mm::kTracks; ++t) {
            const juce::String s = pat.getProperty(mm::trackName(t)).toString();
            for (int i = 0; i < mm::kSteps; ++i) seq.steps[t][i].store(i < s.length() ? static_cast<uint8_t>(juce::jlimit(0, 2, s[i] - '0')) : 0);
        }
    }
    apvts.replaceState(state);
}

juce::AudioProcessorEditor* MMRytmProcessor::createEditor() { return new MMRytmEditor(*this); }

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MMRytmProcessor(); }
