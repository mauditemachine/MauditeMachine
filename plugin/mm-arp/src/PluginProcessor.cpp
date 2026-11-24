#include "PluginProcessor.h"

#include <cstdlib>

#if !MMARP_HEADLESS
#include "PluginEditor.h"
#endif

#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>

namespace {

constexpr int kChunk = 128;
// v50 : une cible 32 + k modulee par la matrice : le bloc par tranches de 32 echantillons (la valeur effective y est
// recalculee a chaque tranche)
constexpr int kModTick = 32;

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

// La progression : 8 indices de CHORDS au plus. v43 : site (un programme sans chordBank, d'avant les accords du plugin) :
// des indices du site, convertis (dsp/Params.h chordFromSite : le meme accord a chaque pas)
void parseProg(const juce::var& arr, MMArpProgram& p, bool site) {
    p.nProg = 0;
    if (const auto* pr = arr.getArray())
        for (const auto& c : *pr)
            if (isNum(c) && p.nProg < 8 && static_cast<int>(c) >= 0 && static_cast<int>(c) < 8)
                p.prog[static_cast<size_t>(p.nProg++)] = site ? mmarp::chordFromSite(static_cast<int>(c)) : static_cast<int>(c);
}

// Le programme (ou la progression gardee) porte-t-il les indices du plugin (chordBank = kChordBank, v43) ?
bool arpBank(const juce::var& o) { return isNum(o.getProperty("chordBank", juce::var())) && static_cast<int>(o.getProperty("chordBank", 0)) == mmarp::kChordBank; }

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
    parseProg(o.getProperty("prog", juce::var()), p, !arpBank(o));
    p.hasKnobs = parseKnobs(o.getProperty("knobs", juce::var()), p.knobs);
    // Les pistes par pas (src/v4/plugin/arp/steps.ts)
    {
        const juce::var st = o.getProperty("steps", juce::var());
        auto lane = [&](const char* key, std::array<uint8_t, 16>& dst, int lo, int hi) {
            if (const auto* a = st.getProperty(key, juce::var()).getArray())
                for (int i = 0; i < std::min(16, a->size()); ++i)
                    if (isNum(a->getReference(i))) dst[static_cast<size_t>(i)] = static_cast<uint8_t>(juce::jlimit(lo, hi, static_cast<int>(a->getReference(i))));
        };
        lane("acc", p.stAcc, 0, 2);
        lane("slide", p.stSlide, 0, 1);
        lane("gate", p.stGate, 0, 3);
        lane("rat", p.stRat, 1, 4);
        lane("prob", p.stProb, 0, 100);
    }
    for (int e = 0; e < mmx::kExtra; ++e) p.extra[static_cast<size_t>(e)] = mmx::kExtraDefs[e].def;
    if (auto* x = o.getProperty("extra", juce::var()).getDynamicObject())
        for (const auto& kv : x->getProperties()) {
            const int i = mmx::allIndex(kv.name.toString().toRawUTF8()) - mmarp::kKnobs;
            if (i >= 0 && i < mmx::kExtra && isNum(kv.value)) p.extra[static_cast<size_t>(i)] = juce::jlimit(0.0, 1.0, static_cast<double>(kv.value));
        }
    return true;
}

// Le pont arpegiateur -> moteur, sur le thread audio
struct VoySink final : mmarp::ArpSink {
    mmarp::Voyager& v;
    explicit VoySink(mmarp::Voyager& voy) : v(voy) {}
    void note(double t, int midi, double gate, double acc, double from) override { v.note(t, static_cast<double>(midi), gate, acc, from); }
    // SLIDE du sequenceur : la note glisse depuis la precedente (glideSec), meme si GLIDE est a 0
    void noteGlide(double t, int midi, double gate, double acc, double from, double glideSec) override { v.note(t, static_cast<double>(midi), gate, acc, from, glideSec); }
    void beat(double t, double b, double bpm, bool run) override { v.beat(t, b, bpm, run); }
    void cancel(double t) override { v.cancel(t); }
};

} // namespace

/* ---------------- les parametres et l'etat ---------------- */

juce::AudioProcessorValueTreeState::ParameterLayout MMArpProcessor::makeLayout() {
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID{"arp", 1}, "Arpeggiator", true));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{"master", 1}, "Master", juce::NormalisableRange<float>(-60, 6, 0.1f, 2.5f), 0.f));
    // Le clip a le dessus (2026-11-09, Mika) : des notes MIDI qui arrivent (un clip, un clavier) font taire l'arpege interne
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID{"prio", 1}, "Clip Priority", true));
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
        // OVERDRIVE s'appelle DISTO dans le VST3 (2026-11-17, Mika) : seul le nom montre a l'hote change, pas l'ID (dist) :
        // l'automation et les projets restent
        // v27 : DLY TIME et TAPE sont masques (la page DELAY les remplace, convertDelay) : OLD devant, l'ID reste
        const juce::String name = std::strcmp(d.id, "dist") == 0       ? juce::String("DISTO")
                                  : std::strcmp(d.id, "dlyTime") == 0 ? juce::String("OLD DLY TIME")
                                  : std::strcmp(d.id, "tape") == 0    ? juce::String("OLD TAPE")
                                                                      : juce::String(d.label);
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{d.id, 1}, name, juce::NormalisableRange<float>(0.f, 1.f), static_cast<float>(d.def), attr));
    }
    // Les reglages du VST3 seul (SOUND+ : QUALITY, LFO, reverb, master)
    for (int e = 0; e < mmx::kExtra; ++e) {
        const auto& d = mmx::kExtraDefs[e];
        auto attr = juce::AudioParameterFloatAttributes()
                        .withStringFromValueFunction([e](float v, int) {
                            char buf[64];
                            mmx::exText(e, static_cast<double>(v), buf, static_cast<int>(sizeof(buf)));
                            return juce::String(buf);
                        })
                        .withLabel("");
        // le nom montre a l'hote : la section devant, sauf si le nom la porte deja (HELL TIME, DISTO STYLE ; pas "HELL HELL
        // TIME") ; seul le nom change, pas l'ID : l'automation reste
        const juce::String sec = juce::String(d.section).toUpperCase(), lab(d.label);
        const juce::String name = lab.startsWith(sec + " ") || lab == sec ? lab : sec + " " + lab;
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{d.id, 1}, name, juce::NormalisableRange<float>(0.f, 1.f), static_cast<float>(d.def), attr));
    }
    return layout;
}

MMArpProcessor::MMArpProcessor()
    : AudioProcessor(BusesProperties().withOutput("Main", juce::AudioChannelSet::stereo(), true)), apvts(*this, nullptr, "MMARP", makeLayout()) {
    master_ = apvts.getRawParameterValue("master");
    arpOn_ = apvts.getRawParameterValue("arp");
    prio_ = apvts.getRawParameterValue("prio");
    for (auto& c : ccMap_) c.store(-1);
    for (int i = 0; i < mmarp::kKnobs; ++i) {
        knobRaw_[static_cast<size_t>(i)] = apvts.getRawParameterValue(mmarp::kKnobDefs[i].id);
        knobParams_[static_cast<size_t>(i)] = apvts.getParameter(mmarp::kKnobDefs[i].id);
        knobs_[static_cast<size_t>(i)] = mmarp::kKnobDefs[i].def;
    }
    for (int e = 0; e < mmx::kExtra; ++e) {
        exRaw_[static_cast<size_t>(e)] = apvts.getRawParameterValue(mmx::kExtraDefs[e].id);
        knobParams_[static_cast<size_t>(mmarp::kKnobs + e)] = apvts.getParameter(mmx::kExtraDefs[e].id);
        ex_[static_cast<size_t>(e)] = mmx::kExtraDefs[e].def;
        exLast_[static_cast<size_t>(e)] = -1.f;
    }
    // v46 : les reglages de HELL v2, par leur id
    for (int k = 0; k < mmarp::Hell2::kKeys; ++k) {
        const int a = mmx::allIndex(mmarp::Hell2::kKeyIds[k]);
        jassert(a >= mmarp::kKnobs);
        h2Ex_[static_cast<size_t>(k)] = a >= mmarp::kKnobs ? a - mmarp::kKnobs : mmx::ex_xHellMix;
    }
    seed_ = static_cast<uint32_t>(juce::Random::getSystemRandom().nextInt());
    bpmId_ = mmarp::Voyager::paramIndex("bpm");
    driveId_ = mmarp::Voyager::paramIndex("drive");
    const char* xk[13] = {"xl1Dest", "xl1Amt", "l2Beats", "l2Shape", "l2Dest", "l2Amt", "xRing", "xFold", "xNoiseCol", "xUnison", "xHpf", "xComb", "xCombFb"};
    for (size_t i = 0; i < 13; ++i) xId_[i] = mmarp::Voyager::paramIndex(xk[i]);
    for (int i = 0; i < kModN; ++i) {
        modKnob_[static_cast<size_t>(i)] = mmarp::knobIndex(kModIds[i]);
        modVal_[static_cast<size_t>(i)].store(std::numeric_limits<float>::quiet_NaN());
    }
    for (auto& e : egVal_) e.store(std::numeric_limits<float>::quiet_NaN());
    // La matrice (6 lignes : source, destination, quantite), puis pbRange, voiceMode, xFeedback, ampMode
    for (int l = 0; l < 6; ++l) {
        const std::string n = std::to_string(l + 1);
        mId_[static_cast<size_t>(l * 3)] = mmarp::Voyager::paramIndex("m" + n + "Src");
        mId_[static_cast<size_t>(l * 3 + 1)] = mmarp::Voyager::paramIndex("m" + n + "Dst");
        mId_[static_cast<size_t>(l * 3 + 2)] = mmarp::Voyager::paramIndex("m" + n + "Amt");
    }
    mId_[18] = mmarp::Voyager::paramIndex("pbRange");
    mId_[19] = mmarp::Voyager::paramIndex("voiceMode");
    mId_[20] = mmarp::Voyager::paramIndex("xFeedback");
    mId_[21] = mmarp::Voyager::paramIndex("ampMode");
    // v50 : LFO 1 / 2 en FREE, les 8 lignes de plus de la matrice
    {
        const char* lk[4] = {"l1Free", "l1Hz", "l2Free", "l2Hz"};
        for (size_t i = 0; i < 4; ++i) vId_[i] = mmarp::Voyager::paramIndex(lk[i]);
        for (int j = 0; j < mmx::kModSlots; ++j) {
            const std::string n = "x" + std::to_string(j + 1);
            vId_[static_cast<size_t>(4 + 3 * j)] = mmarp::Voyager::paramIndex(n + "Src");
            vId_[static_cast<size_t>(5 + 3 * j)] = mmarp::Voyager::paramIndex(n + "Dst");
            vId_[static_cast<size_t>(6 + 3 * j)] = mmarp::Voyager::paramIndex(n + "Amt");
        }
        for (auto& a : modShowK_) a.store(-1);
        for (auto& a : modShowV_) a.store(std::numeric_limits<float>::quiet_NaN());
        lfo4_.seed = seed_ ^ 0x4C464F34u;
    }
    startTimerHz(15);
    mmarp::reserveArp(arpBuf_[0]);
    mmarp::reserveArp(arpBuf_[1]);
    mmarp::reserveArp(liveProg_);
    // Le programme de depart : sans accord, la suite AUTO
    publish(std::make_shared<MMArpProgram>());
}

MMArpProcessor::~MMArpProcessor() { stopTimer(); }

void MMArpProcessor::publish(std::shared_ptr<const MMArpProgram> p) {
    progBpm_.store(p->bpm);
    {
        std::lock_guard<std::mutex> lk(mx_);
        lastProgram_ = p;
    }
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
    if (p->hasKnobs && !knobsKnown_.load()) {
        for (int e = 0; e < mmx::kExtra; ++e)
            if (auto* prm = knobParams_[static_cast<size_t>(mmarp::kKnobs + e)]) prm->setValueNotifyingHost(static_cast<float>(p->extra[static_cast<size_t>(e)]));
        setKnobsFrom(p->knobs);
    }
    {
        std::lock_guard<std::mutex> lk(mx_);
        programJson_ = json;
    }
    publish(std::move(p));
}

void MMArpProcessor::faceParam(const juce::String& id, double v) {
    const int i = mmx::allIndex(id.toRawUTF8());
    if (i < 0 || !std::isfinite(v)) return;
    if (auto* prm = knobParams_[static_cast<size_t>(i)]) prm->setValueNotifyingHost(static_cast<float>(juce::jlimit(0.0, 1.0, v)));
    knobsKnown_.store(true);
}

void MMArpProcessor::faceGesture(const juce::String& id, bool on) {
    const int i = mmx::allIndex(id.toRawUTF8());
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
    return {fbPlaying_.load(), internalPlaying_.load(), fbSeq_.load(), fbSlot_.load(), fbPos_.load(), fbLen_.load(), fbChord_.load(), fbMidi_.load(), fbSkip_.load(), fbDur_.load()};
}

/* ---------------- l'arpege en clip MIDI (le bouton DRAG MIDI de la fenetre) ---------------- */

namespace {
// Les notes de l'arpegiateur, en temps du contexte (le meme code que la lecture)
struct Collect final : mmarp::ArpSink {
    struct N {
        double t, gate, acc;
        int midi;
    };
    std::vector<N> notes;
    void note(double t, int midi, double gate, double acc, double) override { notes.push_back({t, gate, acc, midi}); }
    void beat(double, double, double, bool) override {}
    void cancel(double) override {}
};
} // namespace

juce::MidiFile MMArpProcessor::arpMidi(int cycles, int& bars) const {
    juce::MidiFile mf;
    bars = 0;
    std::shared_ptr<const MMArpProgram> p;
    {
        std::lock_guard<std::mutex> lk(mx_);
        p = lastProgram_;
    }
    if (!p || p->nProg <= 0) return mf;
    // Les potards tels que le son les joue (l'arrondi du site), la suite, la progression, le swing de la face
    std::array<double, mmarp::kKnobs> k{};
    for (int i = 0; i < mmarp::kKnobs; ++i)
        k[static_cast<size_t>(i)] = knobParams_[static_cast<size_t>(i)] ? mmarp::knobClean(i, static_cast<double>(knobParams_[static_cast<size_t>(i)]->getValue())) : mmarp::kKnobDefs[i].def;
    mmarp::ArpProgram ap;
    mmarp::reserveArp(ap);
    // v52 : la tonalite de l'instance (xKey, xScale), comme la lecture
    const auto exVal = [&](int e) {
        auto* prm = knobParams_[static_cast<size_t>(mmarp::kKnobs + e)];
        return prm ? static_cast<double>(prm->getValue()) : mmx::kExtraDefs[e].def;
    };
    mmarp::arpProgram(k.data(), p->seq, p->prog.data(), p->nProg, ap, mmx::exStep(mmx::ex_xKey, exVal(mmx::ex_xKey)), mmx::exStep(mmx::ex_xScale, exVal(mmx::ex_xScale)));
    ap.swing = p->swing;
    applySteps(*p, ap, knobParams_[static_cast<size_t>(mmarp::kKnobs + mmx::ex_xSwing)] ? static_cast<double>(knobParams_[static_cast<size_t>(mmarp::kKnobs + mmx::ex_xSwing)]->getValue()) : 0.0);
    // La progression entiere (une mesure par accord), repetee cycles fois, depuis la mesure 1 : les memes notes que la
    // lecture d'Ableton depuis le debut du morceau (meme graine)
    bars = p->nProg * std::max(1, cycles);
    const double sr = 48000, bpm = 120, pps = bpm / 60.0 / sr;
    const double endPpq = bars * 4.0;
    mmarp::Arp a;
    a.prepare(sr);
    a.setProgram(&ap);
    Collect c;
    const int block = 4096;
    for (int64_t f = 0; static_cast<double>(f) * pps < endPpq; f += block) a.process(c, f, block, true, static_cast<double>(f) * pps, pps, seed_);
    const int tpq = 960;
    juce::MidiMessageSequence seq;
    seq.addEvent(juce::MidiMessage::textMetaEvent(3, "MM-ARP"), 0);
    seq.addEvent(juce::MidiMessage::tempoMetaEvent(static_cast<int>(60000000.0 / std::max(20.0, p->bpm))), 0);
    seq.addEvent(juce::MidiMessage::timeSignatureMetaEvent(4, 4), 0);
    const double endTick = endPpq * tpq;
    for (const auto& n : c.notes) {
        const double on = n.t * bpm / 60.0 * tpq;
        if (on >= endTick - 0.5) continue;
        // la porte, sans deborder de la fin du clip (la boucle de Live reste propre)
        const double off = std::min(endTick, on + std::max(1.0, n.gate * bpm / 60.0 * tpq));
        // la force : l'inverse de la velocite des notes MIDI du plugin (100 = l'accent 1)
        const auto vel = static_cast<juce::uint8>(juce::jlimit(1, 127, static_cast<int>(std::lround(n.acc * 100.0))));
        seq.addEvent(juce::MidiMessage::noteOn(1, n.midi, vel), std::round(on));
        seq.addEvent(juce::MidiMessage::noteOff(1, n.midi), std::round(off));
    }
    seq.updateMatchedPairs();
    mf.setTicksPerQuarterNote(tpq);
    mf.addTrack(seq);
    return mf;
}

// v38 MIDI IN ARP : le programme de l'accord tenu (thread audio, sans allocation : liveProg_ est reserve) : la cadence,
// la porte, l'accent et les pas de la face ; une seule case d'accord, ses notes selon MODE (UP, DOWN, UP/DN, RAND), RANGE
// (1 a 3 octaves) et OCTAVE
void MMArpProcessor::buildLive() {
    const mmarp::ArpProgram& b = arpBuf_[arpCur_];
    liveProg_.spn = b.spn;
    liveProg_.gate = b.gate;
    liveProg_.accent = b.accent;
    liveProg_.drift = b.drift;
    liveProg_.swing = b.swing;
    liveProg_.swingOwn = b.swingOwn;
    std::copy(std::begin(b.stepAcc), std::end(b.stepAcc), std::begin(liveProg_.stepAcc));
    std::copy(std::begin(b.stepSlide), std::end(b.stepSlide), std::begin(liveProg_.stepSlide));
    std::copy(std::begin(b.stepGate), std::end(b.stepGate), std::begin(liveProg_.stepGate));
    std::copy(std::begin(b.stepRat), std::end(b.stepRat), std::begin(liveProg_.stepRat));
    std::copy(std::begin(b.stepProb), std::end(b.stepProb), std::begin(liveProg_.stepProb));
    liveProg_.prog.clear();
    liveProg_.prog.push_back(0);
    if (liveProg_.chords.empty()) liveProg_.chords.emplace_back();
    mmarp::ArpChord& ch = liveProg_.chords[0];
    ch.c = 0;
    ch.midi.clear();
    for (size_t j = 1; j < liveProg_.chords.size(); ++j) {
        liveProg_.chords[j].c = -1;
        liveProg_.chords[j].midi.clear();
    }
    const int mode = mmarp::knobStep(mmarp::kn_mode, knobs_[static_cast<size_t>(mmarp::kn_mode)]);
    const int octs = 1 + std::max(0, std::min(2, mmarp::knobStep(mmarp::kn_range, knobs_[static_cast<size_t>(mmarp::kn_range)])));
    const int shift = 12 * (mmarp::knobStep(mmarp::kn_octave, knobs_[static_cast<size_t>(mmarp::kn_octave)]) - 2);
    ch.rand = mode == 3;
    int up[64];
    int n = 0;
    for (int o = 0; o < octs; ++o)
        for (int m = 0; m < 128 && n < 64; ++m)
            if (liveChord_[static_cast<size_t>(m)]) up[n++] = std::max(0, std::min(127, m + 12 * o + shift));
    if (mode == 1)
        for (int i = n - 1; i >= 0; --i) ch.midi.push_back(up[i]);
    else if (mode == 2) {
        for (int i = 0; i < n; ++i) ch.midi.push_back(up[i]);
        for (int i = n - 2; i >= 1; --i) ch.midi.push_back(up[i]);
    } else
        for (int i = 0; i < n; ++i) ch.midi.push_back(up[i]);
}

void MMArpProcessor::faceRun(bool on) {
    if (on)
        if (auto* prm = apvts.getParameter("xArpRun")) prm->setValueNotifyingHost(1.f);
    if (hostPlaying_.load(std::memory_order_relaxed)) {
        if (!on)
            if (auto* prm = apvts.getParameter("xArpRun")) prm->setValueNotifyingHost(0.f);
        return;
    }
    runInternal_.store(on);
}

juce::File MMArpProcessor::arpMidiFile(int cycles) const {
    int bars = 0;
    const juce::MidiFile mf = arpMidi(cycles, bars);
    if (bars <= 0) return {};
    const juce::File dir = juce::File::getSpecialLocation(juce::File::userMusicDirectory).getChildFile("Maudite Machine").getChildFile("MM-ARP Clips");
    dir.createDirectory();
    const juce::File f = dir.getChildFile("MM-ARP " + juce::Time::getCurrentTime().formatted("%Y-%m-%d %H-%M-%S") + " (" + juce::String(bars) + " bars).mid");
    juce::FileOutputStream out(f);
    if (!out.openedOk()) return {};
    mf.writeTo(out, 1);
    out.flush();
    return f;
}

/* ---------------- QUALITY, la reverb du VST3 ---------------- */

// v32 (Mika : "fait comme les autres plugins", u-he Diva : la precision temps reel et celle de l'export) : QUALITY a trois
// crans, ECO x2 (le plugin seul), STD x4 (le moteur du site, au bit pres, le depart), HQ x8 ; au-dela de 60 kHz, la moitie.
// Le rendu hors ligne (l'export de l'hote) passe en HQ si EXPORT HQ est engage.
int MMArpProcessor::osFor(double sr, double quality, bool exportHq, bool pro) {
    const int step = exportHq ? 2 : static_cast<int>(std::lround(std::clamp(quality, 0.0, 1.0) * 2));
    // v34 : PRO (les oscillateurs au taux de base) : le filtre et la saturation a x1 (ECO), x2 (STD), x4 (HQ)
    const int os = pro ? (step == 0 ? 1 : step == 1 ? 2 : 4) : (step == 0 ? 2 : step == 1 ? 4 : 8);
    return sr > 60000 ? std::max(1, os / 2) : os;
}

// v49 : la latence declaree suit celle du moteur (EXACT : elle change avec QUALITY ou ENGINE ; ZERO : toujours 0).
// Avant la v49 elle n'etait declaree qu'a prepareToPlay : changer QUALITY en jouant decalait le son de 2 a 5 echantillons.
void MMArpProcessor::syncLatency() {
    const int want = latNow_.load(std::memory_order_relaxed);
    if (want != getLatencySamples()) setLatencySamples(want);
}

// Thread du message (il tourne fenetre fermee) : SIZE, TONE ou PRE DELAY ont bouge, une nouvelle reponse se calcule
// ici et part vers le thread audio ; les anciennes sont liberees ici aussi
void MMArpProcessor::timerCallback() {
    syncLatency();
    while (fx_.takeRetiredReverb()) {}
    // v31 : une reponse calculee par le fil de la reverb part au thread audio (comme avant, en fondu enchaine)
    {
        std::shared_ptr<const mmarp::ReverbIR> got;
        {
            const juce::SpinLock::ScopedLockType sl(revJob_->lock);
            got = std::move(revJob_->ready);
        }
        if (got) {
            std::shared_ptr<const mmarp::ReverbIR> old;
            const juce::SpinLock::ScopedLockType sl(revLock_);
            old = std::move(revWanted_);
            revWanted_ = got;
            revPending_ = std::move(got);
        }
    }
    const double sr = sr_;
    if (sr <= 0) return;
    const std::array<double, 4> key{static_cast<double>(exRaw_[mmx::ex_xRevSize]->load()), static_cast<double>(exRaw_[mmx::ex_xRevTone]->load()),
                                    static_cast<double>(exRaw_[mmx::ex_xRevPre]->load()), sr};
    bool same = true;
    for (size_t i = 0; i < 4; ++i) same = same && std::fabs(key[i] - revKey_[i]) < 1e-9;
    if (same) return;
    // un calcul a la fois : le reglage d'arrivee est repris au tick suivant (le dernier gagne)
    if (revJob_->busy.load()) return;
    revJob_->busy.store(true);
    revKey_ = key;
    std::shared_ptr<RevJob> job = revJob_;
    revPool_->pool.addJob([job, key] {
        auto ir = mmarp::ArpFx::makeReverb(key[3], key[0], key[1], key[2]);
        {
            const juce::SpinLock::ScopedLockType sl(job->lock);
            job->ready = std::move(ir);
        }
        job->busy.store(false);
    });
}

/* ---------------- MIDI LEARN ---------------- */

void MMArpProcessor::onCC(int ch, int cc, int value) {
    if (ch < 0 || ch > 15 || cc < 0 || cc > 127) return;
    const size_t k = static_cast<size_t>(ch * 128 + cc);
    const int learn = learn_.load();
    if (learn >= 0) {
        // Un seul CC par potard : l'ancien part
        for (auto& c : ccMap_)
            if (c.load() == learn) c.store(-1);
        ccMap_[k].store(learn);
        learn_.store(-1);
        mapChanged_.store(true);
    }
    const int i = ccMap_[k].load();
    if (i >= 0 && i < mmx::kAll)
        if (auto* prm = knobParams_[static_cast<size_t>(i)]) prm->setValueNotifyingHost(static_cast<float>(value) / 127.f);
}

void MMArpProcessor::learn(const juce::String& id) {
    learn_.store(id.isEmpty() ? -1 : mmx::allIndex(id.toRawUTF8()));
    mapChanged_.store(true);
}

void MMArpProcessor::unmap(int ch, int cc) {
    if (ch >= 0 && ch < 16 && cc >= 0 && cc < 128) ccMap_[static_cast<size_t>(ch * 128 + cc)].store(-1);
    mapChanged_.store(true);
}

void MMArpProcessor::unmapAll() {
    for (auto& c : ccMap_) c.store(-1);
    mapChanged_.store(true);
}

juce::var MMArpProcessor::midiMap() const {
    juce::Array<juce::var> items;
    for (int k = 0; k < 16 * 128; ++k) {
        const int i = ccMap_[static_cast<size_t>(k)].load();
        if (i < 0 || i >= mmx::kAll) continue;
        auto* e = new juce::DynamicObject();
        e->setProperty("cc", k % 128);
        e->setProperty("ch", k / 128 + 1);
        e->setProperty("id", juce::String(mmx::allId(i)));
        items.add(juce::var(e));
    }
    auto* o = new juce::DynamicObject();
    o->setProperty("items", items);
    const int l = learn_.load();
    o->setProperty("learn", l >= 0 && l < mmx::kAll ? juce::String(mmx::allId(l)) : juce::String());
    return juce::var(o);
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
    // La progression : un tableau en indices du site (la premiere version), ou { chordBank, prog } (la face v43) ; un
    // tableau est aussi un objet pour juce::var (isObject) : isArray d'abord
    {
        const juce::var pv = juce::JSON::parse(ls.getProperty("mm.v4.plugin.arp.prog", "").toString());
        if (pv.isArray()) parseProg(pv, *p, true);
        else parseProg(pv.getProperty("prog", juce::var()), *p, !arpBank(pv));
    }
    setKnobsFrom(p->knobs);
    publish(std::move(p));
    return true;
}

void MMArpProcessor::getStateInformation(juce::MemoryBlock& destData) {
    juce::ValueTree state("MMARP1");
    state.setProperty("v", 2, nullptr);
    state.setProperty("seed", static_cast<juce::int64>(seed_), nullptr);
    state.setProperty("editorW7", editorW_.load(), nullptr);
    // Les parametres (les potards, Master, Arpeggiator)
    state.appendChild(apvts.copyState(), nullptr);
    // MIDI LEARN : les CC assignes
    juce::ValueTree mm("MIDIMAP");
    for (int k = 0; k < 16 * 128; ++k) {
        const int i = ccMap_[static_cast<size_t>(k)].load();
        if (i < 0 || i >= mmx::kAll) continue;
        juce::ValueTree e("CC");
        e.setProperty("ch", k / 128, nullptr);
        e.setProperty("cc", k % 128, nullptr);
        e.setProperty("id", juce::String(mmx::allId(i)), nullptr);
        mm.appendChild(e, nullptr);
    }
    state.appendChild(mm, nullptr);
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
    // (un projet d'avant le format large gardait 1100 : il rouvre a la taille par defaut ; 2026-11-17, v26, Mika : la
    // taille par defaut 15 % plus petite, 1870 ; la cle passe a editorW6 : un projet d'avant (editorW5) rouvre une fois a
    // 1870, puis garde la taille choisie)
    // 2026-11-18 (v29, Mika : "20% moins grand quand on ouvre le vst et 20% moins grand tout court") : 1496 par defaut,
    // la cle passe a editorW7 ; un projet v26-v28 (editorW6) rouvre a 80 % de sa taille, un plus ancien a 1496
    {
        int w = kEditorDefaultW;
        if (state.hasProperty("editorW7")) w = static_cast<int>(state.getProperty("editorW7"));
        else if (state.hasProperty("editorW6")) w = juce::roundToInt(0.8 * static_cast<int>(state.getProperty("editorW6")));
        editorW_.store(juce::jlimit(kEditorMinW, kEditorMaxW, w));
    }
    const juce::String ls = state.getProperty("ls", "").toString();
    {
        std::lock_guard<std::mutex> lk(mx_);
        lsJson_ = ls;
    }
    for (auto& c : ccMap_) c.store(-1);
    const auto mm = state.getChildWithName("MIDIMAP");
    for (int j = 0; j < mm.getNumChildren(); ++j) {
        const auto e = mm.getChild(j);
        const int ch = static_cast<int>(e.getProperty("ch", -1)), cc = static_cast<int>(e.getProperty("cc", -1));
        const int i = mmx::allIndex(e.getProperty("id", "").toString().toRawUTF8());
        if (ch >= 0 && ch < 16 && cc >= 0 && cc < 128 && i >= 0) ccMap_[static_cast<size_t>(ch * 128 + cc)].store(i);
    }
    mapChanged_.store(true);
    const auto params = state.getChildWithName(apvts.state.getType());
    if (params.isValid()) {
        // Un projet d'avant la reverbe facon BigSky (2026-11-16) : sans REVERB TYPE, il garde la reverbe d'avant (CLASSIC).
        // (lu avant replaceState : l'arbre est partage, et replaceState y ajoute les parametres qui manquent)
        const bool hadSky = params.getChildWithProperty("id", "xSkyType").isValid();
        // Un projet d'avant HELL complet (2026-11-17) : sans RANGE, son decalage, son TONE et son LFO DEPTH sont migres
        const bool hadRange = params.getChildWithProperty("id", "xHellRange").isValid();
        // v27 : un projet d'avant la page DELAY (sans DELAY STYLE) : l'ancien DELAY y est converti, au bit pres
        const bool hadEcho = params.getChildWithProperty("id", "xDlStyle").isValid();
        // v32 : QUALITY passe de deux crans (STD, HQ) a trois (ECO, STD, HQ) : un projet d'avant (sans EXPORT HQ) garde
        // son reglage, HQ reste HQ (1), STD (0) devient le cran du milieu ; sans QUALITY du tout : HQ, son depart d'alors
        const bool hadExport = params.getChildWithProperty("id", "xExportHq").isValid();
        // v34 : un projet d'avant le moteur PRO (sans ENGINE) s'ouvre en CLASSIC, son moteur au bit pres
        const bool hadEngine = params.getChildWithProperty("id", "xEngine").isValid();
        const bool hadQuality = params.getChildWithProperty("id", "xQuality").isValid();
        // v46 : un projet d'avant HELL v2 (sans xHellV2) garde l'ancien HELL, au bit pres ; les instances neuves : HELL v2
        const bool hadHellV2 = params.getChildWithProperty("id", "xHellV2").isValid();
        // v49 : un projet d'avant LATENCY (sans xLatency) garde les filtres a phase lineaire (EXACT), son son au bit pres ;
        // les instances neuves : ZERO
        const bool hadLatency = params.getChildWithProperty("id", "xLatency").isValid();
        // les reglages du VST3 seul que le projet ne connaissait pas : leur depart (le son d'avant), quelle que soit la
        // valeur que l'instance avait avant l'ouverture
        std::vector<int> missing;
        for (int e = 0; e < mmx::kExtra; ++e)
            if (!params.getChildWithProperty("id", mmx::kExtraDefs[e].id).isValid()) missing.push_back(e);
        apvts.replaceState(params);
        knobsKnown_.store(true);
        for (int e : missing)
            if (auto* prm = apvts.getParameter(mmx::kExtraDefs[e].id)) prm->setValueNotifyingHost(static_cast<float>(mmx::kExtraDefs[e].def));
        if (!hadSky)
            if (auto* prm = apvts.getParameter("xSkyType")) prm->setValueNotifyingHost(0.f);
        if (!hadRange) migrateHell();
        convertPedal();
        if (!hadEcho) convertDelay();
        if (!hadExport)
            if (auto* prm = apvts.getParameter("xQuality")) prm->setValueNotifyingHost(!hadQuality || prm->getValue() >= 0.5f ? 1.f : 0.5f);
        if (!hadEngine)
            if (auto* prm = apvts.getParameter("xEngine")) prm->setValueNotifyingHost(0.f);
        if (!hadHellV2)
            if (auto* prm = apvts.getParameter("xHellV2")) prm->setValueNotifyingHost(0.f);
        if (!hadLatency)
            if (auto* prm = apvts.getParameter("xLatency")) prm->setValueNotifyingHost(0.f);
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
    // la premiere version : la reverbe d'avant, l'ancien DELAY, l'ancien HELL
    if (auto* prm = apvts.getParameter("xSkyType")) prm->setValueNotifyingHost(0.f);
    if (auto* prm = apvts.getParameter("xHellV2")) prm->setValueNotifyingHost(0.f);
    if (auto* prm = apvts.getParameter("xLatency")) prm->setValueNotifyingHost(0.f);
    convertDelay();
}

/*
 * HELL d'avant RANGE (2026-11-17) : l'ancien decalage (5000 (2v - 1)^3 Hz) passe en FINE (jusqu'a 200 Hz) ou WIDE ; TONE
 * passe en LOW-PASS (dessous) ou HIGH-PASS (dessus) a la meme frequence ; LFO DEPTH (Hz vers le decalage) passe en
 * AMOUNT, TARGET FREQ. Le son reste le meme (les lois sont celles de Hell.cpp, a la meme frequence de coupure).
 */
void MMArpProcessor::migrateHell() {
    const auto get = [&](const char* id) {
        auto* p = apvts.getParameter(id);
        return p ? static_cast<double>(p->getValue()) : 0.0;
    };
    const auto put = [&](const char* id, double v) {
        if (auto* p = apvts.getParameter(id)) p->setValueNotifyingHost(static_cast<float>(std::min(1.0, std::max(0.0, v))));
    };
    const double hz = mmarp::Hell::shiftHzOf(get("xHellShift"));
    const int range = std::fabs(hz) <= 200 ? mmarp::Hell::FINE : mmarp::Hell::WIDE;
    put("xHellRange", range / 3.0);
    put("xHellShift", mmarp::Hell::shiftVFor(hz, range));
    const double t = get("xHellTone");
    if (t < 0.49) {
        put("xHellLp", std::log(600.0 * std::pow(30.0, t / 0.49) / 300.0) / std::log(20000.0 / 300.0));
        put("xHellTone", 0.5);
    } else if (t > 0.51) {
        put("xHellHp", std::log(20.0 * std::pow(150.0, (t - 0.51) / 0.49) / 20.0) / std::log(200.0));
        put("xHellTone", 0.5);
    }
    const double d = get("xHellLfoDepth");
    if (d > 0) {
        put("xHellLfoAmt", 0.5 + 0.5 * d);
        put("xHellLfoTarget", 0);
        put("xHellLfoDepth", 0);
    }
}

/*
 * La pedale DISTORTION (xDist, xDistTone), masquee le 2026-11-17 (v25, Mika : "masque la pedale avec conversion") : ses
 * parametres restent pour l'hote (l'automation des anciens projets les trouve) mais n'agissent plus. Un projet qui l'avait
 * au-dessus de 0 passe a la DISTO, le reglage le plus proche :
 *   - la pedale ecretait franc (droit jusqu'a 0.9, arrondi jusqu'a 1.2) : STYLE DIODE (droit jusqu'a 0.9, arrondi
 *     jusqu'a 1.1) ;
 *   - sa dose (36 v dB de gain) : DRIVE (dist), la meme loi : DRIVE = xDist ; sa dose entrait sur les 5 premiers % :
 *     MIX = min(1, 20 x xDist) ; elle compensait son niveau : AUTO ;
 *   - son TONE (passe-bas 12 dB/oct a 700 x (18000 / 700)^t Hz) : POST FILTER LP a la meme frequence, RESO 0 (Butterworth,
 *     le meme filtre) ; sa cloche de presence (au-dessus de 0.5, +12 (t - 0.5) dB a 3.5 kHz) : TONE vers le brillant ;
 *   - le reste de la DISTO a son depart. Seulement si la DISTO etait encore MM (un projet d'avant la page) ; sinon la
 *     pedale est simplement coupee. La pedale remise a 0 (xDist 0, xDistTone 0.5).
 * Ce qui change : la pedale etait apres CRUSH (dans la chaine), la DISTO est juste apres le moteur ; si le projet avait
 * aussi l'OVERDRIVE du moteur (dist au-dessus de 0, style MM), DRIVE prend la dose de la pedale et l'OVERDRIVE du moteur
 * s'efface (la DISTO le remplace). La face fait la meme chose pour un preset (disto.ts distoFromPedal).
 */
void MMArpProcessor::convertPedal() {
    auto* pd = apvts.getParameter("xDist");
    auto* pt = apvts.getParameter("xDistTone");
    if (!pd || !pt) return;
    const double a = static_cast<double>(pd->getValue());
    const double t = static_cast<double>(pt->getValue());
    if (!(a > 0)) return;
    const auto put = [&](const char* id, double v) {
        if (auto* p = apvts.getParameter(id)) p->setValueNotifyingHost(static_cast<float>(std::min(1.0, std::max(0.0, v))));
    };
    auto* ps = apvts.getParameter("xDStyle");
    const int st = ps ? mmx::exStep(mmx::ex_xDStyle, static_cast<double>(ps->getValue())) : 0;
    if (st == 0) {
        const int n = mmx::kExtraDefs[mmx::ex_xDStyle].nSteps;
        put("xDStyle", (1.0 + mmarp::Decap::STYLE_DIODE) / (n - 1));
        put("dist", a);
        put("xDMix", std::min(1.0, 20 * a));
        put("xDAuto", 1);
        const double hz = mmarp::ArpFxLaws::distToneHz(t);
        put("xDPostMode", static_cast<double>(mmarp::Decap::F_LP) / 4);
        put("xDPostFreq", std::log(hz / 20) / std::log(1000.0));
        put("xDPostReso", 0);
        if (t > 0.5) put("xDTone", 0.5 + mmarp::ArpFxLaws::distPresenceDb(t) / 12);
    }
    put("xDist", 0);
    put("xDistTone", 0.5);
}

/*
 * v27 : l'ancien DELAY passe a la page DELAY (dsp/Echo.h), au bit pres (tests/host_test.cpp) :
 *   TAPE au-dessus de 0.02 -> STYLE TAPE (la bande du site), WOBBLE = TAPE, MODE PING-PONG (la bande l'etait deja) ;
 *   sinon -> STYLE DIGITAL (le ping-pong du site), WOBBLE 0, MODE : PING PONG, STEREO -> DUAL, WIDE -> WIDE ;
 *   DLY TIME -> SYNC et DIVISION / NOTE : 1/8, 1/8 DOTTED, 1/4, 1/4 DOTTED, 1/2 ;
 *   FEEDBACK = la reinjection que le site tirait de DELAY, 0.35 + 0.33 x DELAY (a l'ouverture) ;
 *   DELAY (le potard de la face) devient MIX, inchange ; le reste de la page a son neutre.
 * Seul ecart : un projet qui AUTOMATISE DELAY (le potard) garde la reinjection de l'ouverture (avant, elle suivait).
 * Les potards DLY TIME et TAPE et le reglage DELAY MODE restent dans l'hote (OLD ...), sans effet.
 */
void MMArpProcessor::convertDelay() {
    const auto kn = [&](const char* id) {
        const int i = mmarp::knobIndex(id);
        auto* p = apvts.getParameter(id);
        return i < 0 ? 0.0 : p ? mmarp::knobClean(i, static_cast<double>(p->getValue())) : mmarp::kKnobDefs[i].def;
    };
    const auto put = [&](const char* id, double v) {
        if (auto* p = apvts.getParameter(id)) p->setValueNotifyingHost(static_cast<float>(std::min(1.0, std::max(0.0, v))));
    };
    const auto putStep = [&](int e, int i) { put(mmx::kExtraDefs[e].id, static_cast<double>(i) / (mmx::kExtraDefs[e].nSteps - 1)); };
    const double delay = kn("delay"), tape = kn("tape");
    const int dt = mmarp::knobStep(mmarp::knobIndex("dlyTime"), kn("dlyTime"));
    auto* pm = apvts.getParameter("xDlyMode");
    const int dm = pm ? mmx::exStep(mmx::ex_xDlyMode, static_cast<double>(pm->getValue())) : 0;
    // le reste de la page a son neutre
    for (int e = mmx::ex_xDlStyle; e <= mmx::ex_xDlRhythm; ++e) put(mmx::kExtraDefs[e].id, mmx::kExtraDefs[e].def);
    if (mmarp::ArpFxLaws::fxAmount(tape) > 0) {
        putStep(mmx::ex_xDlStyle, mmarp::ES_TAPE);
        put("xDlWobble", tape);
        putStep(mmx::ex_xDlMode, mmarp::EM_PINGPONG);
    } else {
        putStep(mmx::ex_xDlStyle, mmarp::ES_DIGITAL);
        put("xDlWobble", 0);
        putStep(mmx::ex_xDlMode, dm == 1 ? mmarp::EM_DUAL : dm == 2 ? mmarp::EM_WIDE : mmarp::EM_PINGPONG);
    }
    // 2, 3, 4, 6, 8 doubles croches : 1/8, 1/8., 1/4, 1/4., 1/2
    static const int kDiv[5] = {2, 2, 3, 3, 4}, kNote[5] = {0, 1, 0, 1, 0};
    const int k = std::max(0, std::min(4, dt));
    putStep(mmx::ex_xDlSync, 1);
    putStep(mmx::ex_xDlDiv, kDiv[k]);
    putStep(mmx::ex_xDlNote, kNote[k]);
    // la reinjection du site (ArpFx::set : PP_FB_MIN + (PP_FB_MAX - PP_FB_MIN) x delay)
    put("xDlFb", 0.35 + (0.68 - 0.35) * delay);
}

/* ---------------- l'audio ---------------- */

bool MMArpProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo() && layouts.inputBuses.isEmpty();
}

const char* const MMArpProcessor::kModIds[MMArpProcessor::kModN] = {"wave1", "wave2", "fm", "cutoff", "res", "noise", "sub", "envAmt", "stack", "xRing", "xFold", "xComb"};

// L'arc lumineux de la face : la valeur modulee de chaque reglage que la face montre (thread audio, sans allocation)
void MMArpProcessor::publishMod() {
    const mmarp::ModView& m = voy_->modView();
    const auto clamp01 = [](double x) { return x < 0 ? 0.0 : x > 1 ? 1.0 : x; };
    const auto kn = [&](int i) { const int k = modKnob_[static_cast<size_t>(i)]; return k >= 0 ? knobs_[static_cast<size_t>(k)] : 0.0; };
    const auto steps = [&](int i) { const int k = modKnob_[static_cast<size_t>(i)]; return k >= 0 && mmarp::kKnobDefs[k].nSteps > 1 ? mmarp::kKnobDefs[k].nSteps - 1 : 1; };
    const double sub0 = 0.88 * kn(6) * kn(6);
    const double st = kn(8);
    const double stC = st < 0.02 ? 0 : 3 + (27 * (st - 0.02)) / 0.98;
    const double stM = stC + m.stackCents;
    const double d[kModN] = {m.wave / steps(0), m.wave / steps(1), m.fm, m.cutOct / 9.3, m.res, m.noise, 0, m.envOct / 6, 0, m.ring, m.fold, m.comb};
    for (int i = 0; i < kModN; ++i) {
        double v;
        bool on;
        if (i == 6) {
            on = std::fabs(m.sub) > 1e-5;
            v = std::sqrt(std::max(0.0, std::min(0.88, sub0 + m.sub)) / 0.88);
        } else if (i == 8) {
            on = std::fabs(m.stackCents) > 1e-3;
            v = stM <= 0 ? 0 : stM < 3 ? 0.02 * stM / 3 : 0.02 + (stM - 3) * 0.98 / 27;
        } else {
            on = std::fabs(d[i]) > 1e-5;
            const double base = i >= 9 ? ex_[static_cast<size_t>(i == 9 ? mmx::ex_xRing : i == 10 ? mmx::ex_xFold : mmx::ex_xComb)] : kn(i);
            v = base + d[i];
        }
        modVal_[static_cast<size_t>(i)].store(on ? static_cast<float>(clamp01(v)) : std::numeric_limits<float>::quiet_NaN(), std::memory_order_relaxed);
    }
}

// v52 : l'ecran des enveloppes de la face : les deux enveloppes de la voix la plus recente (thread audio, sans allocation ;
// une lecture du moteur, le son ne change pas)
void MMArpProcessor::publishEg() {
    const mmarp::EgView e = voy_->egView();
    const float nan = std::numeric_limits<float>::quiet_NaN();
    const float v[kEgN] = {e.on ? static_cast<float>(e.fV) : nan, static_cast<float>(e.aV), static_cast<float>(e.fStage), static_cast<float>(e.aStage), static_cast<float>(e.tOn), static_cast<float>(e.tOff)};
    for (int i = 0; i < kEgN; ++i) egVal_[static_cast<size_t>(i)].store(v[i], std::memory_order_relaxed);
}

// Les pistes du sequenceur par pas et le swing propre de l'arpege, poses apres arpProgram()
void MMArpProcessor::applySteps(const MMArpProgram& p, mmarp::ArpProgram& out, double swingOwn) const {
    for (size_t i = 0; i < 16; ++i) {
        out.stepAcc[i] = p.stAcc[i];
        out.stepSlide[i] = p.stSlide[i];
        out.stepGate[i] = p.stGate[i];
        out.stepRat[i] = p.stRat[i];
        out.stepProb[i] = p.stProb[i];
    }
    out.swingOwn = swingOwn;
}

namespace {
// v27 : les reglages neufs de la chaine sont-ils les memes (la chaine n'est reposee que si quelque chose change) ?
bool sameV27(const mmarp::ArpFxSettings& a, const mmarp::ArpFxSettings& b) {
    const auto eq = [](double x, double y) { return !(x < y || x > y); };
    const mmarp::EchoSettings &e = a.echo, &f = b.echo;
    return e.style == f.style && e.mode == f.mode && eq(e.fb, f.fb) && eq(e.width, f.width) && eq(e.offset, f.offset) && eq(e.sat, f.sat) &&
           eq(e.wobble, f.wobble) && eq(e.diff, f.diff) && eq(e.low, f.low) && eq(e.high, f.high) && eq(e.groove, f.groove) && eq(e.feel, f.feel) &&
           eq(e.analog, f.analog) && eq(e.duck, f.duck) && eq(e.duckRel, f.duckRel) && e.prime == f.prime && e.lofi == f.lofi && e.rhythm == f.rhythm &&
           a.phStages == b.phStages && eq(a.phCenter, b.phCenter) && eq(a.phSpread, b.phSpread) && eq(a.phSyncHz, b.phSyncHz) && eq(a.flDelay, b.flDelay) &&
           eq(a.flSpread, b.flSpread) && eq(a.flSyncHz, b.flSyncHz) && a.flThru == b.flThru && a.chBoth == b.chBoth && eq(a.chRate, b.chRate) &&
           eq(a.chDepth, b.chDepth) && eq(a.chWidth, b.chWidth) && eq(a.chMix, b.chMix) && eq(a.crTone, b.crTone) && eq(a.crMix, b.crMix) &&
           eq(a.puAttack, b.puAttack) && eq(a.puCurve, b.puCurve);
}
// v46 : la sortie de la reverbe (l'EQ, WIDTH, DUCK, FREEZE)
bool sameRvPost(const mmarp::ArpFxSettings& a, const mmarp::ArpFxSettings& b) {
    const auto eq = [](double x, double y) { return !(x < y || x > y); };
    return eq(a.rvLoCut, b.rvLoCut) && a.rvLoSlope == b.rvLoSlope && eq(a.rvMidHz, b.rvMidHz) && eq(a.rvMidDb, b.rvMidDb) && eq(a.rvMidQ, b.rvMidQ) &&
           eq(a.rvHiCut, b.rvHiCut) && a.rvHiSlope == b.rvHiSlope && eq(a.rvWidth, b.rvWidth) && eq(a.rvDuck, b.rvDuck) && a.rvFreeze == b.rvFreeze;
}
} // namespace

// Les potards ou le programme ont change : le moteur, la chaine et l'arpege en sont tires (thread audio, sans allocation)
void MMArpProcessor::update(double bpm, bool knobsChanged, bool progChanged) {
    if (knobsChanged || fresh_) {
        // v50 : les emplacements de la matrice (xMx) et leur chemin, avant les reglages du moteur (leurs lignes en sont)
        modRoute();
        const int n = engineKv(bpm, true);
        voy_->params(kv_.data(), n);
        mmarp::ArpFxSettings fx;
        double dly16 = 3;
        buildFx(bpm, fx, dly16);
        applyFx(fx, dly16, bpm);
    }
    buildArp();
    juce::ignoreUnused(progChanged);
    fresh_ = false;
}

// Les reglages du moteur dans kv_ (un message 'params' du site : tous, et le tempo si withBpm) ; rend leur nombre
int MMArpProcessor::engineKv(double bpm, bool withBpm) {
    // Un message 'params' du site : tous les reglages du moteur, et le tempo
    int n = mmarp::engineParams(knobs_.data(), kv_.data(), static_cast<int>(kv_.size()) - 1);
    // DISTO (2026-11-16, portee le 2026-11-17) : le potard DISTO (dist) pousse l'OVERDRIVE du moteur sur le style MM
    // (le depart : le son d'avant) ; sur A a P, le moteur reste propre et Decap sature (processBlock)
    if (mmx::exStep(mmx::ex_xDStyle, ex_[mmx::ex_xDStyle]) != 0)
        for (int i = 0; i < n; ++i)
            if (kv_[static_cast<size_t>(i)].id == driveId_) kv_[static_cast<size_t>(i)].value = 0;
    if (withBpm) kv_[static_cast<size_t>(n++)] = {bpmId_, bpm};
    // Le VST3 seul : la seconde destination du LFO 1, le LFO 2
    kv_[static_cast<size_t>(n++)] = {xId_[0], static_cast<double>(mmx::exStep(mmx::ex_xLfo1Dest2, ex_[mmx::ex_xLfo1Dest2]))};
    kv_[static_cast<size_t>(n++)] = {xId_[1], ex_[mmx::ex_xLfo1Depth2]};
    kv_[static_cast<size_t>(n++)] = {xId_[2], mmx::kExBeats_xLfo2Rate[mmx::exStep(mmx::ex_xLfo2Rate, ex_[mmx::ex_xLfo2Rate])]};
    kv_[static_cast<size_t>(n++)] = {xId_[3], static_cast<double>(mmx::exStep(mmx::ex_xLfo2Shape, ex_[mmx::ex_xLfo2Shape]))};
    kv_[static_cast<size_t>(n++)] = {xId_[4], static_cast<double>(mmx::exStep(mmx::ex_xLfo2Dest, ex_[mmx::ex_xLfo2Dest]))};
    kv_[static_cast<size_t>(n++)] = {xId_[5], ex_[mmx::ex_xLfo2Depth]};
    // OSC / FILTER + du module avant
    {
        const double hp = ex_[mmx::ex_xHpf];
        static const double kUni[3] = {0, 5, 7};
        kv_[static_cast<size_t>(n++)] = {xId_[6], ex_[mmx::ex_xRing]};
        kv_[static_cast<size_t>(n++)] = {xId_[7], ex_[mmx::ex_xFold]};
        kv_[static_cast<size_t>(n++)] = {xId_[8], ex_[mmx::ex_xNoiseColor]};
        kv_[static_cast<size_t>(n++)] = {xId_[9], kUni[mmx::exStep(mmx::ex_xUnison, ex_[mmx::ex_xUnison])]};
        kv_[static_cast<size_t>(n++)] = {xId_[10], hp > 0 ? 20.0 * std::pow(100.0, hp) : 0.0};
        kv_[static_cast<size_t>(n++)] = {xId_[11], ex_[mmx::ex_xComb]};
        kv_[static_cast<size_t>(n++)] = {xId_[12], 2 * ex_[mmx::ex_xCombFb] - 1};
    }
    // La matrice de modulation, les modes de voix, FEEDBACK, AMP MODE
    {
        for (int l = 0; l < 6; ++l) {
            const int e = mmx::ex_xM1Src + l * 3;
            kv_[static_cast<size_t>(n++)] = {mId_[static_cast<size_t>(l * 3)], static_cast<double>(mmx::exStep(e, ex_[static_cast<size_t>(e)]))};
            kv_[static_cast<size_t>(n++)] = {mId_[static_cast<size_t>(l * 3 + 1)], static_cast<double>(mmx::exStep(e + 1, ex_[static_cast<size_t>(e + 1)]))};
            kv_[static_cast<size_t>(n++)] = {mId_[static_cast<size_t>(l * 3 + 2)], 2 * ex_[static_cast<size_t>(e + 2)] - 1};
        }
        static const double kPb[7] = {1, 2, 3, 5, 7, 12, 24};
        kv_[static_cast<size_t>(n++)] = {mId_[18], kPb[mmx::exStep(mmx::ex_xPbRange, ex_[mmx::ex_xPbRange])]};
        kv_[static_cast<size_t>(n++)] = {mId_[19], static_cast<double>(mmx::exStep(mmx::ex_xVoiceMode, ex_[mmx::ex_xVoiceMode]))};
        kv_[static_cast<size_t>(n++)] = {mId_[20], ex_[mmx::ex_xFeedback]};
        kv_[static_cast<size_t>(n++)] = {mId_[21], static_cast<double>(mmx::exStep(mmx::ex_xAmpMode, ex_[mmx::ex_xAmpMode]))};
    }
    // v50 : LFO 1 / LFO 2 en FREE, les 8 lignes de plus de la matrice (au repos : les valeurs neutres, le moteur d'avant)
    {
        kv_[static_cast<size_t>(n++)] = {vId_[0], mmx::exStep(mmx::ex_xLfo1Sync, ex_[mmx::ex_xLfo1Sync]) == 0 ? 1.0 : 0.0};
        kv_[static_cast<size_t>(n++)] = {vId_[1], mmarp::Hell::lfoHzOf(ex_[mmx::ex_xLfo1Hz])};
        kv_[static_cast<size_t>(n++)] = {vId_[2], mmx::exStep(mmx::ex_xLfo2Sync, ex_[mmx::ex_xLfo2Sync]) == 0 ? 1.0 : 0.0};
        kv_[static_cast<size_t>(n++)] = {vId_[3], mmarp::Hell::lfoHzOf(ex_[mmx::ex_xLfo2Hz])};
        for (int j = 0; j < mmx::kModSlots; ++j) {
            const ModSlot& s = mslot_[static_cast<size_t>(j)];
            const bool on = s.route != 0;
            kv_[static_cast<size_t>(n++)] = {vId_[static_cast<size_t>(4 + 3 * j)], on ? static_cast<double>(s.src) : 0.0};
            kv_[static_cast<size_t>(n++)] = {vId_[static_cast<size_t>(5 + 3 * j)], on ? static_cast<double>(s.dst) : 0.0};
            kv_[static_cast<size_t>(n++)] = {vId_[static_cast<size_t>(6 + 3 * j)], on ? s.amt * s.scale : 0.0};
        }
    }
    return n;
}

// La chaine (BASS MONO, CHORUS, DELAY, REVERB, le rack, le master) tiree des potards et des reglages
void MMArpProcessor::buildFx(double bpm, mmarp::ArpFxSettings& fx, double& dly16) {
    mmarp::fxSettings(knobs_.data(), fx, dly16);
    // Le master du VST3 (la reverb SIZE / TONE / PRE passe par makeReverb, hors du thread audio : timerCallback)
    fx.warmth = ex_[mmx::ex_xWarmth];
    fx.bass = ex_[mmx::ex_xBass];
    fx.air = ex_[mmx::ex_xAir];
    fx.width = ex_[mmx::ex_xWidth];
    fx.revSize = ex_[mmx::ex_xRevSize];
    fx.revTone = ex_[mmx::ex_xRevTone];
    fx.revPre = ex_[mmx::ex_xRevPre];
    // FX RACK du module avant
    fx.phMix = ex_[mmx::ex_xPhMix];
    fx.phRate = ex_[mmx::ex_xPhRate];
    fx.phDepth = ex_[mmx::ex_xPhDepth];
    fx.phFb = ex_[mmx::ex_xPhFb];
    fx.flMix = ex_[mmx::ex_xFlMix];
    fx.flRate = ex_[mmx::ex_xFlRate];
    fx.flDepth = ex_[mmx::ex_xFlDepth];
    fx.flFb = 2 * ex_[mmx::ex_xFlFb] - 1;
    fx.pumpDepth = ex_[mmx::ex_xPumpDepth];
    fx.pumpRate = mmx::exStep(mmx::ex_xPumpRate, ex_[mmx::ex_xPumpRate]);
    fx.pumpShape = ex_[mmx::ex_xPumpShape];
    fx.crushBits = ex_[mmx::ex_xCrushBits];
    fx.crushRate = ex_[mmx::ex_xCrushRate];
    fx.dlyMode = mmx::exStep(mmx::ex_xDlyMode, ex_[mmx::ex_xDlyMode]);
    fx.shimmer = ex_[mmx::ex_xShimmer];
    // la pedale DISTORTION est masquee (2026-11-17, v25) : sans effet ; un projet qui l'avait est converti a
    // l'ouverture vers la DISTO (convertPedal), son automation ne fait plus rien
    fx.dist = 0;
    fx.distTone = 0.5;
    fx.eqLow = ex_[mmx::ex_xEqLow];
    fx.eqMid = ex_[mmx::ex_xEqMid];
    fx.eqHigh = ex_[mmx::ex_xEqHigh];
    fx.eqAir = ex_[mmx::ex_xEqAir];
    // La reverbe facon BigSky (2026-11-16, dsp/Sky.h) : CLASSIC (0) est la convolution d'avant
    fx.skyType = mmx::exStep(mmx::ex_xSkyType, ex_[mmx::ex_xSkyType]);
    fx.sky.decay = ex_[mmx::ex_xSkyDecay];
    fx.sky.pre = ex_[mmx::ex_xSkyPre];
    fx.sky.tone = ex_[mmx::ex_xSkyTone];
    fx.sky.mod = ex_[mmx::ex_xSkyMod];
    fx.sky.lowEnd = ex_[mmx::ex_xSkyLow];
    fx.sky.p = {{ex_[mmx::ex_xSkyP1], ex_[mmx::ex_xSkyP2], ex_[mmx::ex_xSkyP3], ex_[mmx::ex_xSkyP4], ex_[mmx::ex_xSkyP5]}};
    const auto st = [&](int e) { return mmx::exStep(e, ex_[static_cast<size_t>(e)]); };
    // v46 : la sortie de la reverbe (dsp/ArpFx.h, 5.) ; a leurs defauts : contournee au bit pres
    fx.rvLoCut = ex_[mmx::ex_xSkyLoCut];
    fx.rvLoSlope = st(mmx::ex_xSkyLoSlope);
    fx.rvMidHz = ex_[mmx::ex_xSkyMidHz];
    fx.rvMidDb = ex_[mmx::ex_xSkyMidDb];
    fx.rvMidQ = ex_[mmx::ex_xSkyMidQ];
    fx.rvHiCut = ex_[mmx::ex_xSkyHiCut];
    fx.rvHiSlope = st(mmx::ex_xSkyHiSlope);
    fx.rvWidth = ex_[mmx::ex_xSkyWidth];
    fx.rvDuck = ex_[mmx::ex_xSkyDuck];
    fx.rvFreeze = st(mmx::ex_xSkyFreeze) == 1;
    // v27 : la page DELAY (dsp/Echo.h) ; DLY TIME, TAPE et DELAY MODE d'avant sont masques (convertDelay). Le banc
    // (testLegacyDelay) peut encore rendre l'ancien DELAY tel quel, pour comparer au bit pres
    if (testLegacyDelay) dlyFree_ = 0;
    else {
        mmarp::EchoSettings& e = fx.echo;
        e.style = st(mmx::ex_xDlStyle);
        e.mode = st(mmx::ex_xDlMode);
        e.fb = ex_[mmx::ex_xDlFb];
        e.width = ex_[mmx::ex_xDlWidth];
        e.offset = ex_[mmx::ex_xDlOffset];
        e.sat = ex_[mmx::ex_xDlSat];
        e.wobble = ex_[mmx::ex_xDlWobble];
        e.diff = ex_[mmx::ex_xDlDiff];
        e.low = ex_[mmx::ex_xDlLow];
        e.high = ex_[mmx::ex_xDlHigh];
        e.groove = ex_[mmx::ex_xDlGroove];
        e.feel = ex_[mmx::ex_xDlFeel];
        e.prime = st(mmx::ex_xDlPrime) == 1;
        e.lofi = st(mmx::ex_xDlLofi) == 1;
        e.analog = ex_[mmx::ex_xDlAnalog];
        e.duck = ex_[mmx::ex_xDlDuck];
        e.duckRel = ex_[mmx::ex_xDlDuckRel];
        e.rhythm = st(mmx::ex_xDlRhythm);
        fx.tape = 0;
        fx.dlyMode = 0;
        if (st(mmx::ex_xDlSync) == 1) {
            dlyFree_ = 0;
            dly16 = mmarp::EchoLaws::divSixteenths(st(mmx::ex_xDlDiv)) * mmarp::EchoLaws::noteMul(st(mmx::ex_xDlNote));
        } else
            dlyFree_ = mmarp::EchoLaws::msOf(ex_[mmx::ex_xDlMs]) / 1000;
    }
    // v27 : le rack enrichi
    {
        static const int kStages[4] = {4, 6, 8, 12};
        static const double kBeats[7] = {16, 8, 4, 2, 1, 0.5, 0.25};
        const auto syncHz = [&](double v) { return bpm / 60.0 / kBeats[std::max(0, std::min(6, static_cast<int>(std::lround(v * 6))))]; };
        fx.phStages = kStages[st(mmx::ex_xPhStages)];
        fx.phCenter = ex_[mmx::ex_xPhCenter];
        fx.phSpread = ex_[mmx::ex_xPhSpread];
        fx.phSyncHz = st(mmx::ex_xPhSync) == 1 ? syncHz(ex_[mmx::ex_xPhRate]) : 0;
        fx.flDelay = ex_[mmx::ex_xFlDelay];
        fx.flSpread = ex_[mmx::ex_xFlSpread];
        fx.flSyncHz = st(mmx::ex_xFlSync) == 1 ? syncHz(ex_[mmx::ex_xFlRate]) : 0;
        fx.flThru = st(mmx::ex_xFlThru) == 1;
        fx.chBoth = st(mmx::ex_xChBoth) == 1;
        fx.chRate = ex_[mmx::ex_xChRate];
        fx.chDepth = ex_[mmx::ex_xChDepth];
        fx.chWidth = ex_[mmx::ex_xChWidth];
        fx.chMix = ex_[mmx::ex_xChMix];
        fx.crTone = ex_[mmx::ex_xCrTone];
        fx.crMix = ex_[mmx::ex_xCrMix];
        fx.puAttack = ex_[mmx::ex_xPuAttack];
        fx.puCurve = ex_[mmx::ex_xPuCurve];
        syncFx_ = fx.phSyncHz > 0 || fx.flSyncHz > 0;
    }
    // DLY TIME au tempo de l'hote (audio/synth.ts delayS : 2 s au plus) ; v27 : FREE, en ms
    fx.delaySeconds = dlyFree_ > 0 ? std::min(2.0, dlyFree_) : std::min(2.0, dly16 * 60.0 / std::max(20.0, bpm) / 4.0);
}

// La chaine posee si elle a change (glisse : 20 ms, sauf a la premiere pose)
void MMArpProcessor::applyFx(const mmarp::ArpFxSettings& fx, double dly16, double bpm) {
    auto eq = [](double a, double b) { return !(a < b || a > b); };
    const bool same = !fresh_ && fx.chorus == fxNow_.chorus && eq(fx.delay, fxNow_.delay) && eq(fx.reverb, fxNow_.reverb) && eq(fx.tape, fxNow_.tape) &&
                      eq(fx.delaySeconds, fxNow_.delaySeconds) && eq(fx.monoLowHz, fxNow_.monoLowHz) && eq(fx.volume, fxNow_.volume) &&
                      eq(fx.warmth, fxNow_.warmth) && eq(fx.bass, fxNow_.bass) && eq(fx.air, fxNow_.air) && eq(fx.width, fxNow_.width) &&
                      eq(fx.phMix, fxNow_.phMix) && eq(fx.phRate, fxNow_.phRate) && eq(fx.phDepth, fxNow_.phDepth) && eq(fx.phFb, fxNow_.phFb) &&
                      eq(fx.flMix, fxNow_.flMix) && eq(fx.flRate, fxNow_.flRate) && eq(fx.flDepth, fxNow_.flDepth) && eq(fx.flFb, fxNow_.flFb) &&
                      eq(fx.pumpDepth, fxNow_.pumpDepth) && fx.pumpRate == fxNow_.pumpRate && eq(fx.pumpShape, fxNow_.pumpShape) &&
                      eq(fx.crushBits, fxNow_.crushBits) && eq(fx.crushRate, fxNow_.crushRate) && fx.dlyMode == fxNow_.dlyMode && eq(fx.shimmer, fxNow_.shimmer) &&
                      eq(fx.dist, fxNow_.dist) && eq(fx.distTone, fxNow_.distTone) && eq(fx.eqLow, fxNow_.eqLow) && eq(fx.eqMid, fxNow_.eqMid) &&
                      eq(fx.eqHigh, fxNow_.eqHigh) && eq(fx.eqAir, fxNow_.eqAir) && fx.skyType == fxNow_.skyType && eq(fx.sky.decay, fxNow_.sky.decay) &&
                      eq(fx.sky.pre, fxNow_.sky.pre) && eq(fx.sky.tone, fxNow_.sky.tone) && eq(fx.sky.mod, fxNow_.sky.mod) && eq(fx.sky.lowEnd, fxNow_.sky.lowEnd) &&
                      eq(fx.sky.p[0], fxNow_.sky.p[0]) && eq(fx.sky.p[1], fxNow_.sky.p[1]) && eq(fx.sky.p[2], fxNow_.sky.p[2]) && eq(fx.sky.p[3], fxNow_.sky.p[3]) &&
                      eq(fx.sky.p[4], fxNow_.sky.p[4]) && sameV27(fx, fxNow_) && sameRvPost(fx, fxNow_);
    if (!same) fx_.set(fx, fresh_);
    fxNow_ = fx;
    dly16_ = dly16;
    lastBpm_ = bpm;
}

// L'arpege dans le tampon libre (les potards, la suite, la progression, les pistes), puis echange
void MMArpProcessor::buildArp() {
    const MMArpProgram& p = *current_;
    // L'arpege dans le tampon libre, puis echange (l'arpegiateur garde son pointeur jusque-la)
    const int next = 1 - arpCur_;
    // v52 : dans la tonalite de l'instance (xKey, xScale : un reglage de l'hote, change ici comme un potard)
    mmarp::arpProgram(knobs_.data(), p.seq, p.prog.data(), p.nProg, arpBuf_[next], mmx::exStep(mmx::ex_xKey, ex_[mmx::ex_xKey]), mmx::exStep(mmx::ex_xScale, ex_[mmx::ex_xScale]));
    arpBuf_[next].swing = p.swing;
    applySteps(p, arpBuf_[next], ex_[mmx::ex_xSwing]);
    arp_.setProgram(&arpBuf_[next]);
    arpCur_ = next;
}

/* ---------------- v50 : la matrice de modulation (les 8 emplacements xMx) ---------------- */

namespace {
// Les familles d'un reglage module (ce qu'il faut reposer quand sa valeur effective change). 0 : relu a chaque tranche
// (la DISTO, HELL, LFO 3 / LFO 4).
enum { FAM_ENGINE = 1, FAM_FX = 2, FAM_ARP = 4, FAM_EQ = 8 };

// Un potard qui a son equivalent par voix dans la matrice du moteur (Voyager.cpp, MD_*) : la destination, et l'echelle
// (unites de la matrice par unite normalisee du potard : les lois de dsp/Params.cpp et les courses de Voyager.h, 7.).
// Les bornes sont les memes que celles du potard (sauf CUTOFF : celles du filtre).
int voiceRoute(int k, double& scale) {
    scale = 1;
    if (k == mmarp::kn_cutoff) {
        scale = 9.3 / 4;  // cutoffHz : 30 x 2^(9.3 v) ; CUTOFF : +/-4 octaves
        return 10;
    }
    if (k == mmarp::kn_res) {
        scale = 1 / 0.35;  // res : v ; RES : +/-0.35
        return 11;
    }
    if (k == mmarp::kn_envAmt) {
        scale = 6.0 / 3;  // envOctaves : 6 v ; ENV AMT : +/-3 octaves
        return 12;
    }
    if (k == mmarp::kn_fm) {
        scale = 1 / 0.6;  // fm : v ; FM : +/-0.6
        return 4;
    }
    if (k == mmarp::kn_noise) return 6;  // noise : v ; NOISE : +/-1
    const int e = k - mmarp::kKnobs;
    if (e == mmx::ex_xRing) return 8;   // RING : +/-1 autour de xRing
    if (e == mmx::ex_xFold) return 9;   // FOLD : +/-1 autour de xFold
    if (e == mmx::ex_xComb) return 19;  // COMB : +/-1 autour de xComb
    return 0;
}
} // namespace

int MMArpProcessor::modFamily(int k) {
    using namespace mmarp;
    if (k < kKnobs) {
        switch (k) {
            case kn_gate:
            case kn_accent: return FAM_ARP;
            case kn_drift: return FAM_ENGINE | FAM_ARP;
            // (volGain : le niveau du moteur suit VOLUME, DELAY et REVERB)
            case kn_delay:
            case kn_reverb:
            case kn_volume: return FAM_ENGINE | FAM_FX;
            case kn_monoLow: return FAM_FX;
            default: return FAM_ENGINE;  // (DISTO DRIVE : le moteur en MM, la DISTO la relit a chaque tranche)
        }
    }
    const int e = k - kKnobs;
    if (e == mmx::ex_xSwing) return FAM_ARP;
    if (e >= mmx::ex_xQ1On && e <= mmx::ex_xQOut) return FAM_EQ;
    switch (e) {
        case mmx::ex_xLfo1Depth2:
        case mmx::ex_xLfo2Depth:
        case mmx::ex_xRing:
        case mmx::ex_xFold:
        case mmx::ex_xNoiseColor:
        case mmx::ex_xHpf:
        case mmx::ex_xComb:
        case mmx::ex_xCombFb:
        case mmx::ex_xFeedback:
        case mmx::ex_xLfo1Hz:
        case mmx::ex_xLfo2Hz: return FAM_ENGINE;
        default: break;
    }
    const char* sec = mmx::kExtraDefs[e].section;
    if (std::strcmp(sec, "disto") == 0 || std::strcmp(sec, "hell") == 0 || std::strcmp(sec, "lfo") == 0) return 0;
    return FAM_FX;
}

// Les emplacements et leur chemin (thread audio, a chaque changement de reglage : update)
void MMArpProcessor::modRoute() {
    bool tap = false;
    lfo3On_ = lfo4On_ = false;
    for (int j = 0; j < mmx::kModSlots; ++j) {
        ModSlot& s = mslot_[static_cast<size_t>(j)];
        const int e = mmx::ex_xMx1Src + 3 * j;
        s.src = mmx::exStep(e, ex_[static_cast<size_t>(e)]);
        s.code = mmx::modDstCode(ex_[static_cast<size_t>(e + 1)]);
        s.amt = 2 * ex_[static_cast<size_t>(e + 2)] - 1;
        const mmx::ModDestDef* d = mmx::modDest(s.code);
        s.k = d ? d->k : -1;
        s.route = 0;
        s.dst = 0;
        s.scale = 1;
        if (s.src <= 0 || !d || !(s.amt < 0 || s.amt > 0)) continue;
        if (s.code < mmx::kModSynthN) {
            s.route = 1;
            s.dst = s.code;
        } else if (const int vd = voiceRoute(s.k, s.scale)) {
            s.route = 2;
            s.dst = vd;
        } else {
            s.route = 3;
            s.dst = mmx::kModDstBase + s.k;
            tap = true;
        }
        if (s.src == 12) lfo3On_ = true;
        if (s.src == 13) lfo4On_ = true;
    }
    modTapOn_ = tap || nTgt_ > 0;
}

// LFO 3 et LFO 4 pour le morceau suivant du moteur (n echantillons, ppqEnd : la position a sa fin)
void MMArpProcessor::modLfoChunk(int n, double ppqEnd, bool playing, double bpm) {
    double v3 = 0, v4 = 0;
    const auto stp = [&](int e) { return mmx::exStep(e, ex_[static_cast<size_t>(e)]); };
    if (lfo3On_) {
        const double hz = stp(mmx::ex_xDLfoSync) == 1 ? mmarp::Hell::lfoSyncHz(ex_[mmx::ex_xDLfoRate], bpm) : mmarp::Hell::lfoHzOf(ex_[mmx::ex_xDLfoRate]);
        v3 = lfo3_.run(n, hz, stp(mmx::ex_xDLfoShape), sr_);
    }
    if (lfo4On_) {
        const double v = std::clamp(ex_[mmx::ex_xLfo4Rate], 0.0, 1.0);
        const bool sync = stp(mmx::ex_xLfo4Sync) == 1;
        const double beats = mmarp::Hell::kLfoBeats[static_cast<int>(std::lround(v * (mmarp::Hell::kLfoSync - 1)))];
        const double hz = sync ? std::max(20.0, bpm) / 60.0 / beats : mmarp::Hell::lfoHzOf(v);
        v4 = lfo4_.run(n, hz, stp(mmx::ex_xLfo4Shape), sr_, sync && playing, std::max(0.0, ppqEnd) / beats);
    }
    voy_->extLfo(v3, v4);
}

// La valeur de l'hote d'un reglage module a change (automation, la face) : elle devient la base de la valeur effective
void MMArpProcessor::modHostSync() {
    for (int t = 0; t < nTgt_; ++t) {
        ModTgt& g = mtgt_[static_cast<size_t>(t)];
        const bool knob = g.k < mmarp::kKnobs;
        const size_t i = static_cast<size_t>(knob ? g.k : g.k - mmarp::kKnobs);
        const float raw = knob ? knobRawLast_[i] : exLast_[i];
        if (raw < g.raw || raw > g.raw) {
            g.raw = raw;
            const double nh = knob ? knobs_[i] : ex_[i];
            g.sm = std::clamp(g.sm + nh - g.host, 0.0, 1.0);
            g.host = nh;
            g.eff = g.slow ? g.sm : std::clamp(g.host + g.off, 0.0, 1.0);
        }
        (knob ? knobs_[i] : ex_[i]) = g.eff;
    }
}

// Apres chaque tranche du moteur : la contribution de chaque emplacement (modTaps), la valeur effective de chaque reglage
// vise, posee a la place de celle de l'hote ; les familles qui ont bouge sont reposees (le moteur pour la tranche
// suivante, la chaine et l'EQ pour celle-ci, l'arpege au bloc suivant). Un reglage qui n'est plus vise reprend la valeur
// de l'hote (sa contribution est deja revenue a 0 : la quantite glisse dans le moteur).
void MMArpProcessor::modTapsApply(double bpm, int len, bool& eqSet) {
    mmarp::Voyager::ModTap tp[mmarp::Voyager::kModTaps];
    voy_->modTaps(tp);
    for (int t = 0; t < nTgt_; ++t) mtgt_[static_cast<size_t>(t)].off = std::numeric_limits<double>::quiet_NaN();
    for (const auto& x : tp) {
        if (x.dst < mmx::kModDstBase) continue;
        const int k = x.dst - mmx::kModDstBase;
        if (k >= mmx::kAll) continue;
        int t = 0;
        while (t < nTgt_ && mtgt_[static_cast<size_t>(t)].k != k) ++t;
        if (t == nTgt_) {
            if (nTgt_ == kModTgt) continue;
            ModTgt& g = mtgt_[static_cast<size_t>(nTgt_++)];
            const bool knob = k < mmarp::kKnobs;
            const size_t i = static_cast<size_t>(knob ? k : k - mmarp::kKnobs);
            g.k = k;
            g.fam = modFamily(k);
            g.slow = !knob && std::strcmp(mmx::kExtraDefs[i].section, "hell") == 0;
            g.raw = knob ? knobRawLast_[i] : exLast_[i];
            g.host = knob ? knobs_[i] : ex_[i];
            g.eff = g.host;
            g.sm = g.host;
            g.off = std::numeric_limits<double>::quiet_NaN();
        }
        ModTgt& g = mtgt_[static_cast<size_t>(t)];
        g.off = (std::isnan(g.off) ? 0.0 : g.off) + x.v;
    }
    int fam = 0;
    // HELL (l'ancien : ses filtres se reposent d'un coup ; v2 : MIX pris par tranches de 64 et ses cercles le suivent) :
    // la valeur effective glisse en plus, 10 ms ; les autres moteurs lissent deja leurs reglages
    const double kSlow = 1 - std::exp(-len / (0.01 * sr_));
    for (int t = 0; t < nTgt_;) {
        ModTgt& g = mtgt_[static_cast<size_t>(t)];
        const bool knob = g.k < mmarp::kKnobs;
        const size_t i = static_cast<size_t>(knob ? g.k : g.k - mmarp::kKnobs);
        double& w = knob ? knobs_[i] : ex_[i];
        if (std::isnan(g.off)) {
            // plus vise : la valeur de l'hote revient
            if (w < g.host || w > g.host) fam |= g.fam;
            w = g.host;
            mtgt_[static_cast<size_t>(t)] = mtgt_[static_cast<size_t>(--nTgt_)];
            continue;
        }
        double eff = std::clamp(g.host + g.off, 0.0, 1.0);
        if (g.slow) eff = g.sm += (eff - g.sm) * kSlow;
        if (eff < w || eff > w) {
            w = eff;
            fam |= g.fam;
        }
        g.eff = eff;
        ++t;
    }
    if (fam & FAM_ENGINE) {
        const int n = engineKv(bpm, false);
        voy_->params(kv_.data(), n);
    }
    if (fam & FAM_FX) {
        mmarp::ArpFxSettings fx;
        double dly16 = 3;
        buildFx(bpm, fx, dly16);
        applyFx(fx, dly16, bpm);
    }
    if (fam & FAM_EQ) eqSet = true;
    if (fam & FAM_ARP) arpDirty_ = true;
    bool tap = false;
    for (const auto& s : mslot_) tap = tap || s.route == 3;
    modTapOn_ = tap || nTgt_ > 0;
}

// L'arc lumineux de la face (mm_tick.m) : chaque emplacement actif qui vise un reglage hote, sa valeur effective
void MMArpProcessor::modShow() {
    bool any = false;
    mmarp::Voyager::ModTap tp[mmarp::Voyager::kModTaps];
    bool have = false;
    for (int j = 0; j < mmx::kModSlots; ++j) {
        const ModSlot& s = mslot_[static_cast<size_t>(j)];
        if (s.route != 2 && s.route != 3) {
            if (modShowAny_) modShowK_[static_cast<size_t>(j)].store(-1, std::memory_order_relaxed);
            continue;
        }
        double eff;
        if (s.route == 3) {
            eff = workValue(s.k);
        } else {
            // le chemin par voix : la valeur du potard + les contributions (de la voix la plus recente) ramenees au potard
            if (!have) {
                voy_->modTaps(tp);
                have = true;
            }
            double off = 0;
            for (int q = 0; q < mmx::kModSlots; ++q) {
                const ModSlot& o = mslot_[static_cast<size_t>(q)];
                if (o.route == 2 && o.k == s.k && tp[q].dst == o.dst) off += tp[q].v / o.scale;
            }
            eff = std::clamp(workValue(s.k) + off, 0.0, 1.0);
        }
        modShowK_[static_cast<size_t>(j)].store(s.k, std::memory_order_relaxed);
        modShowV_[static_cast<size_t>(j)].store(static_cast<float>(eff), std::memory_order_relaxed);
        any = true;
    }
    modShowAny_ = any;
}

// prepareToPlay : plus rien de module (les potards sont relus au premier bloc), les LFO repartent
void MMArpProcessor::modReset() {
    nTgt_ = 0;
    arpDirty_ = false;
    lfo3_.reset();
    lfo4_.reset();
    lfo4_.seed = seed_ ^ 0x4C464F34u;
    bool tap = false;
    for (const auto& s : mslot_) tap = tap || s.route == 3;
    modTapOn_ = tap;
}

// L'etage DISTO facon Decapitator (dsp/Decap.h) : ses reglages relus a chaque appel (un bloc, ou une tranche en v50)
void MMArpProcessor::runDisto(float* L, float* R, int n, double bpm) {
    mmarp::DecapSettings ds;
    const int st = mmx::exStep(mmx::ex_xDStyle, ex_[mmx::ex_xDStyle]);
    ds.mm = st == 0;
    ds.style = st > 0 ? st - 1 : 0;
    ds.drive = knobs_[static_cast<size_t>(mmarp::kn_dist)];
    ds.punish = mmx::exStep(mmx::ex_xDPunish, ex_[mmx::ex_xDPunish]) == 1; // OLD DISTO PUNISH, au bit pres
    // v46 : PUNISH v2 (DISTO PUNISH, en fin de liste) ; la face convertit l'ancien au premier appui
    ds.punish2 = mmx::exStep(mmx::ex_xDPunish2, ex_[mmx::ex_xDPunish2]) == 1;
    ds.low = ex_[mmx::ex_xDLow];
    ds.thump = mmx::exStep(mmx::ex_xDThump, ex_[mmx::ex_xDThump]) == 1;
    ds.tone = ex_[mmx::ex_xDTone];
    ds.high = ex_[mmx::ex_xDHigh];
    ds.steep = mmx::exStep(mmx::ex_xDSteep, ex_[mmx::ex_xDSteep]) == 1;
    ds.mix = ex_[mmx::ex_xDMix];
    ds.out = ex_[mmx::ex_xDOut];
    ds.autoGain = mmx::exStep(mmx::ex_xDAuto, ex_[mmx::ex_xDAuto]) == 1;
    // v25 : MORPH, DYNAMICS, FEEDBACK, le multibande, ENV, LFO, les filtres, BOX
    const auto stp = [&](int e) { return mmx::exStep(e, ex_[static_cast<size_t>(e)]); };
    ds.morph = ex_[mmx::ex_xDMorph];
    ds.morphTo = stp(mmx::ex_xDMorphTo);
    ds.dyn = ex_[mmx::ex_xDDyn];
    ds.fb = ex_[mmx::ex_xDFb];
    ds.fbFreq = ex_[mmx::ex_xDFbFreq];
    ds.bands = 1 + stp(mmx::ex_xDBands);
    ds.xLo = ex_[mmx::ex_xDXLo];
    ds.xHi = ex_[mmx::ex_xDXHi];
    {
        const int k[3][6] = {{mmx::ex_xDB1Style, mmx::ex_xDB1Drive, mmx::ex_xDB1Mix, mmx::ex_xDB1Level, mmx::ex_xDB1Solo, mmx::ex_xDB1Byp},
                             {mmx::ex_xDB2Style, mmx::ex_xDB2Drive, mmx::ex_xDB2Mix, mmx::ex_xDB2Level, mmx::ex_xDB2Solo, mmx::ex_xDB2Byp},
                             {mmx::ex_xDB3Style, mmx::ex_xDB3Drive, mmx::ex_xDB3Mix, mmx::ex_xDB3Level, mmx::ex_xDB3Solo, mmx::ex_xDB3Byp}};
        for (int b = 0; b < 3; ++b) {
            mmarp::DecapBand& bd = ds.band[static_cast<size_t>(b)];
            bd.style = stp(k[b][0]) - 1; // MAIN : -1
            bd.drive = ex_[static_cast<size_t>(k[b][1])];
            bd.mix = ex_[static_cast<size_t>(k[b][2])];
            bd.level = ex_[static_cast<size_t>(k[b][3])];
            bd.solo = stp(k[b][4]) == 1;
            bd.bypass = stp(k[b][5]) == 1;
        }
    }
    ds.envAmt = ex_[mmx::ex_xDEnvAmt];
    ds.envSpeed = ex_[mmx::ex_xDEnvSpd];
    ds.lfoShape = stp(mmx::ex_xDLfoShape);
    ds.lfoHz = stp(mmx::ex_xDLfoSync) == 1 ? mmarp::Hell::lfoSyncHz(ex_[mmx::ex_xDLfoRate], bpm) : mmarp::Hell::lfoHzOf(ex_[mmx::ex_xDLfoRate]);
    ds.lfoAmt = ex_[mmx::ex_xDLfoAmt];
    ds.lfoTarget = stp(mmx::ex_xDLfoTarget);
    ds.preMode = stp(mmx::ex_xDPreMode);
    ds.preFreq = ex_[mmx::ex_xDPreFreq];
    ds.preReso = ex_[mmx::ex_xDPreReso];
    ds.postMode = stp(mmx::ex_xDPostMode);
    ds.postFreq = ex_[mmx::ex_xDPostFreq];
    ds.postReso = ex_[mmx::ex_xDPostReso];
    ds.box = stp(mmx::ex_xDBox);
    ds.boxSize = ex_[mmx::ex_xDBoxSize];
    ds.boxMix = ex_[mmx::ex_xDBoxMix];
    ds.zeroLatency = zlAsked_; // v49 LATENCY ZERO : sans les 32 echantillons de retard
    // la saturation au niveau de la prise : le gain de VOLUME du site (audio/synth.ts volGain)
    ds.ref = mmarp::ArpFxLaws::volGain(knobs_[static_cast<size_t>(mmarp::kn_volume)], knobs_[static_cast<size_t>(mmarp::kn_delay)], knobs_[static_cast<size_t>(mmarp::kn_reverb)]);
    decap_.set(ds);
    decap_.process(L, R, n);
    // ATTITUDE (mm_mod, id distoVu) : -20..+3 dB vers 0..1 ; NaN quand la DISTO est contournee
    distoVu_.store(decap_.active() ? static_cast<float>(std::clamp((decap_.attitudeDb() + 20) / 23, 0.0, 1.0)) : std::numeric_limits<float>::quiet_NaN(), std::memory_order_relaxed);
    // v50 : LFO 3 (le LFO de la DISTO, source de la matrice) reste en phase avec celui de la DISTO quand elle tourne
    if (lfo3On_ && decap_.active()) {
        double ph = 0, sm = 0, rnd = 0;
        uint32_t g = 0;
        decap_.lfoState(ph, sm, rnd, g);
        lfo3_.sync(ph, sm, rnd, g);
    }
}

// HELL (Hell.h) ou HELL v2 (Hell2.h), apres la chaine et le rack
void MMArpProcessor::runHell(float* L, float* R, int n, double ppq, bool playing, double bpm) {
    const bool hellV2 = mmx::exStep(mmx::ex_xHellV2, ex_[mmx::ex_xHellV2]) == 1;
    if (hellV2Was_ >= 0 && hellV2 != (hellV2Was_ == 1)) {
        // le moteur change : celui qu'on quitte se tait et repartira vide
        if (hellV2) hell_.reset();
        else hell2_.stop();
    }
    hellV2Was_ = hellV2 ? 1 : 0;
    if (hellV2) {
        double hv[mmarp::Hell2::kKeys];
        for (int k = 0; k < mmarp::Hell2::kKeys; ++k) hv[k] = ex_[static_cast<size_t>(h2Ex_[static_cast<size_t>(k)])];
        hell2_.set(mmarp::Hell2::settingsOf(hv, ex_[mmx::ex_xHellMix], bpm, hellNoteHz_), bpm);
        hell2_.process(L, R, n, ppq, playing, hellNoteHz_);
        hellLfo_.store(hell2_.active() ? static_cast<float>(hell2_.lfoValue()) : std::numeric_limits<float>::quiet_NaN(), std::memory_order_relaxed);
    } else {
        const auto on = [&](int e) { return mmx::exStep(e, ex_[static_cast<size_t>(e)]) == 1; };
        mmarp::HellSettings hs;
        hs.mix = ex_[mmx::ex_xHellMix];
        hs.sync = mmx::exStep(mmx::ex_xHellSync, ex_[mmx::ex_xHellSync]);
        hs.timeMs = mmarp::Hell::timeMsOf(ex_[mmx::ex_xHellTime]);
        hs.feedback = ex_[mmx::ex_xHellFb];
        hs.cross = on(mmx::ex_xHellCross);
        hs.shiftHz = mmarp::Hell::shiftHzFor(ex_[mmx::ex_xHellShift], mmx::exStep(mmx::ex_xHellRange, ex_[mmx::ex_xHellRange]), bpm, hellNoteHz_);
        hs.upDown = ex_[mmx::ex_xHellUpDown];
        hs.spread = ex_[mmx::ex_xHellSpread];
        hs.phase = ex_[mmx::ex_xHellPhase];
        hs.antiRefl = on(mmx::ex_xHellAntiRefl);
        hs.smear = ex_[mmx::ex_xHellSmear];
        hs.hpHz = mmarp::Hell::hpHzOf(ex_[mmx::ex_xHellHp]);
        hs.lpHz = mmarp::Hell::lpHzOf(ex_[mmx::ex_xHellLp]);
        hs.lfoHz = on(mmx::ex_xHellLfoSync) ? mmarp::Hell::lfoSyncHz(ex_[mmx::ex_xHellLfoRate], bpm) : mmarp::Hell::lfoHzOf(ex_[mmx::ex_xHellLfoRate]);
        hs.lfoDepthHz = mmarp::Hell::lfoDepthHzOf(ex_[mmx::ex_xHellLfoDepth]);
        hs.lfoShape = mmx::exStep(mmx::ex_xHellLfoShape, ex_[mmx::ex_xHellLfoShape]);
        hs.lfoAmt = 2 * ex_[mmx::ex_xHellLfoAmt] - 1;
        hs.lfoStereo = on(mmx::ex_xHellLfoStereo);
        hs.lfoTarget = mmx::exStep(mmx::ex_xHellLfoTarget, ex_[mmx::ex_xHellLfoTarget]);
        hs.tone = ex_[mmx::ex_xHellTone];
        hell_.set(hs, bpm);
        hell_.process(L, R, n);
        // le VU du LFO dans la face (mm_mod, id hellLfo) : NaN quand HELL est coupe
        hellLfo_.store(hell_.active() ? static_cast<float>(hell_.lfoValue()) : std::numeric_limits<float>::quiet_NaN(), std::memory_order_relaxed);
    }
}

// L'EQ parametrique 6 bandes (ParamEq.h) ; set : ses reglages ont pu changer
void MMArpProcessor::runEq(float* L, float* R, int n, bool set) {
    const auto st = [&](int e) { return mmx::exStep(e, ex_[static_cast<size_t>(e)]); };
    mmarp::EqBandSettings eb[mmarp::ParamEq::kBands];
    for (int b = 0; set && b < mmarp::ParamEq::kBands; ++b) {
        const int o = b * (mmx::ex_xQ2On - mmx::ex_xQ1On);
        eb[b].on = st(mmx::ex_xQ1On + o) == 1;
        eb[b].type = st(mmx::ex_xQ1Type + o);
        eb[b].hz = mmarp::ParamEq::freqOf(ex_[static_cast<size_t>(mmx::ex_xQ1Freq + o)]);
        eb[b].db = mmarp::ParamEq::gainDbOf(ex_[static_cast<size_t>(mmx::ex_xQ1Gain + o)]);
        eb[b].q = mmarp::ParamEq::qOf(ex_[static_cast<size_t>(mmx::ex_xQ1Q + o)]);
        eb[b].slope = st(mmx::ex_xQ1Slope + o);
    }
    if (set) peq_.set(eb, mmarp::ParamEq::outDbOf(ex_[mmx::ex_xQOut]), eqFresh_);
    eqFresh_ = false;
    const int ana = specOn_.load(std::memory_order_relaxed) ? st(mmx::ex_xQAna) : 0;
    if (ana == 1) spec_.push(L, R, n);
    peq_.process(L, R, n);
    if (ana == 2) spec_.push(L, R, n);
}

void MMArpProcessor::prepareToPlay(double sampleRate, int samplesPerBlock) {
    sr_ = sampleRate;
    frame_ = 0;
    mmarp::VoyagerOptions o;
    o.sampleRate = sampleRate;
    const bool pro = exRaw_[mmx::ex_xEngine]->load() >= 0.5f;
    o.os = osFor(sampleRate, static_cast<double>(exRaw_[mmx::ex_xQuality]->load()), isNonRealtime() && exRaw_[mmx::ex_xExportHq]->load() >= 0.5f, pro);
    o.softVoices = 8; // v32 (Mika : "8 voix") : 8 voix pleines au plus, la neuvieme note efface la plus faible en ~5 ms
#if MMARP_HEADLESS
    // le banc CPU seulement : MMARP_SOFT_VOICES=0 mesure l'avant (12 voix)
    if (const char* e = std::getenv("MMARP_SOFT_VOICES")) o.softVoices = std::atoi(e);
#endif
    osAsked_ = o.os;
    // v49 LATENCY : ZERO (les instances neuves) ou EXACT (un projet d'avant)
    zlAsked_ = exRaw_[mmx::ex_xLatency]->load() >= 0.5f;
    o.zeroLatency = zlAsked_;
    o.seed = seed_ == 0 ? 808u : seed_;
    voy_ = std::make_unique<mmarp::Voyager>(o);
    voy_->setPro(pro);
    cpuPro_.store(pro, std::memory_order_relaxed);
    fx_.prepare(sampleRate, std::max(samplesPerBlock, kChunk));
    fx_.setZeroLatency(zlAsked_);
    hell_.prepare(sampleRate);
    hell2_.prepare(sampleRate);
    hellV2Was_ = -1;
    decap_.prepare(sampleRate);
    peq_.prepare(sampleRate);
    spec_.prepare(sampleRate);
    eqFresh_ = true;
    // La reverb des reglages du projet, tout de suite (rien ne joue encore) ; ensuite le timer suit SIZE, TONE, PRE DELAY
    {
        const double rs = static_cast<double>(exRaw_[mmx::ex_xRevSize]->load()), rt = static_cast<double>(exRaw_[mmx::ex_xRevTone]->load()),
                     rp = static_cast<double>(exRaw_[mmx::ex_xRevPre]->load());
        const juce::SpinLock::ScopedLockType sl(revLock_);
        revWanted_ = mmarp::ArpFx::makeReverb(sampleRate, rs, rt, rp);
        revPending_.reset();
        fx_.setReverb(revWanted_);
        revKey_ = {rs, rt, rp, sampleRate};
    }
    while (fx_.takeRetiredReverb()) {}
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
    modReset();
    // tous les potards relus au premier bloc
    for (auto& k : knobRawLast_) k = -1.f;
    for (auto& k : exLast_) k = -1.f;
    wasPlaying_ = false;
    held_.fill(false);
    lastLiveMidi_ = -1;
    lastNoteFrame_ = -1;
    // Le programme courant rejoue sur le nouveau moteur
    {
        const juce::SpinLock::ScopedLockType sl(progLock_);
        if (!pending_ && current_) pending_ = current_;
        current_.reset();
    }
    latNow_.store(voy_->latencySamples() + fx_.latencySamples(), std::memory_order_relaxed);
    setLatencySamples(voy_->latencySamples() + fx_.latencySamples());
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

void MMArpProcessor::cpuMeter(const double* s, int n) {
    const double dur = static_cast<double>(n) / sr_;
    if (!(dur > 0)) return;
    const double a = 1.0 - std::exp(-dur / 0.25);
    for (int i = 0; i < kCpuN; ++i) {
        const double pc = 100.0 * std::max(0.0, s[i]) / dur;
        cpuSm_[static_cast<size_t>(i)] += (pc - cpuSm_[static_cast<size_t>(i)]) * a;
        cpu_[static_cast<size_t>(i)].store(static_cast<float>(cpuSm_[static_cast<size_t>(i)]), std::memory_order_relaxed);
    }
    // le pic du total : tenu 1 s, puis il redescend vers la moyenne
    const double tot = 100.0 * s[kCpuTotal] / dur;
    if (tot >= cpuPk_) {
        cpuPk_ = tot;
        cpuHold_ = 1.0;
    } else if ((cpuHold_ -= dur) <= 0)
        cpuPk_ = std::max(cpuSm_[kCpuTotal], cpuPk_ * std::exp(-dur / 0.4));
    cpuPeak_.store(static_cast<float>(cpuPk_), std::memory_order_relaxed);
}

void MMArpProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi) {
    juce::ScopedNoDenormals noDenormals;
    const int n = buffer.getNumSamples();
    buffer.clear();
    if (!voy_ || n <= 0) return;
    // v31 : le compteur CPU, quelques lectures de l'horloge par bloc
    const juce::int64 c0 = juce::Time::getHighResolutionTicks();
    const double sr = sr_;
    const int64_t f0 = frame_;
    auto at = [&](int pos) { return static_cast<double>(f0 + pos) / sr; };

    // v38 MIDI IN : en ARP, les touches tenues font l'accord (HOLD : il reste au lacher ; une note apres avoir tout lache
    // en commence un autre) ; ailleurs, rien n'est garde
    const int midiIn = mmx::exStep(mmx::ex_xMidiIn, static_cast<double>(exRaw_[mmx::ex_xMidiIn]->load()));
    if (midiIn == 1) {
        const bool hold = exRaw_[mmx::ex_xArpHold]->load() >= 0.5f;
        for (const auto meta : midi) {
            const auto msg = meta.getMessage();
            if (msg.isNoteOn()) {
                bool any = false;
                for (bool k : liveKeys_) any = any || k;
                if (!any && hold) liveChord_.fill(false);
                liveKeys_[static_cast<size_t>(msg.getNoteNumber())] = true;
                liveChord_[static_cast<size_t>(msg.getNoteNumber())] = true;
                liveDirty_ = true;
            } else if (msg.isNoteOff()) {
                liveKeys_[static_cast<size_t>(msg.getNoteNumber())] = false;
                liveDirty_ = true;
            } else if (msg.isAllNotesOff() || msg.isAllSoundOff()) {
                liveKeys_.fill(false);
                liveChord_.fill(false);
                liveDirty_ = true;
            }
        }
        if (!hold && liveChord_ != liveKeys_) {
            liveChord_ = liveKeys_;
            liveDirty_ = true;
        }
    } else if (midiInPrev_ == 1) {
        liveKeys_.fill(false);
        liveChord_.fill(false);
    }
    bool liveOn = false;
    if (midiIn == 1)
        for (bool k : liveChord_) liveOn = liveOn || k;

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
    // (v38 : en MIDI IN ARP, un accord tenu fait tourner l'horloge interne, Ableton a l'arret : ca joue des qu'on appuie)
    if (!hostPlaying && (runInternal_.load() || liveOn)) {
        if (!internalPlaying_.load()) internalPpq_ = 0;
        internal = true;
        ppq = internalPpq_;
    }
    // L'hote reprend la main : RUN s'eteint
    if (hostPlaying && runInternal_.load()) runInternal_.store(false);
    internalPlaying_.store(internal);
    hostPlaying_.store(hostPlaying, std::memory_order_relaxed);
    // v40 : l'hote joue et ARP RUN est a STOP : l'arpege est en pause (le reste suit le transport) ; RUN le relance au
    // pas suivant de la grille de l'hote (l'arpege suit la position de l'hote)
    const bool playing = hostPlaying || internal;
    const bool arpRun = internal || exRaw_[mmx::ex_xArpRun]->load() >= 0.5f;
    const double pps = bpm / 60.0 / sr;
    // v46 : la tete de lecture de la page DELAY suit le transport (mm_transport ppq, bpm)
    facePpq_.store(playing ? std::max(0.0, ppq) : -1.0, std::memory_order_relaxed);
    faceBpm_.store(bpm, std::memory_order_relaxed);
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
    for (size_t e = 0; e < ex_.size(); ++e) {
        const float r = exRaw_[e]->load();
        if (r < exLast_[e] || r > exLast_[e]) {
            exLast_[e] = r;
            ex_[e] = static_cast<double>(r);
            knobsChanged = true;
        }
    }
    // v50 : les reglages modules par la matrice gardent leur valeur effective (l'hote a pu bouger leur valeur)
    if (nTgt_ > 0) modHostSync();
    // QUALITY : x8 en HQ (x4 au-dela de 60 kHz), le taux du site en STD ; le moteur change sans allocation (setOs)
    {
        const bool pro = ex_[mmx::ex_xEngine] >= 0.5;
        const int os = osFor(sr, ex_[mmx::ex_xQuality], isNonRealtime() && ex_[mmx::ex_xExportHq] >= 0.5, pro);
        if (os != osAsked_) {
            voy_->setOs(os);
            osAsked_ = os;
        }
        if (pro != voy_->pro()) voy_->setPro(pro);
        cpuPro_.store(pro, std::memory_order_relaxed);
        // v49 LATENCY : ZERO ou EXACT (le moteur change au silence, comme QUALITY ; WARMTH et la DISTO suivent)
        const bool zl = mmx::exStep(mmx::ex_xLatency, ex_[mmx::ex_xLatency]) == 1;
        if (zl != zlAsked_) {
            voy_->setZeroLatency(zl);
            fx_.setZeroLatency(zl);
            zlAsked_ = zl;
        }
        // la latence du moteur en ce moment (le timer la declare a l'hote si elle a change)
        latNow_.store(voy_->latencySamples() + fx_.latencySamples(), std::memory_order_relaxed);
    }
    // Une nouvelle reponse de reverb (SIZE, TONE, PRE DELAY), calculee par le thread du message
    if (revLock_.tryEnter()) {
        if (revPending_ && fx_.setReverb(revPending_)) revPending_.reset();
        revLock_.exit();
    }
    if (current_ && (progChanged || knobsChanged || fresh_)) update(bpm, knobsChanged, progChanged);
    else if (current_ && arpDirty_) {
        // v50 : GATE, ACCENT, DRIFT ou SWING modules par la matrice : l'arpege de ce bloc les prend
        buildArp();
        liveDirty_ = true;
    }
    arpDirty_ = false;
    // Le tempo change : le LFO libre et le DELAY le suivent
    if (current_ && std::fabs(bpm - lastBpm_) > 1e-9) {
        const mmarp::ParamKV b{bpmId_, bpm};
        voy_->params(&b, 1);
        if (dlyFree_ <= 0) {
            fx_.retimeDelay(std::min(2.0, dly16_ * 60.0 / std::max(20.0, bpm) / 4.0));
            fxNow_.delaySeconds = std::min(2.0, dly16_ * 60.0 / std::max(20.0, bpm) / 4.0);
        }
        // v27 : PHASER ou FLANGER au tempo
        if (syncFx_) {
            static const double kBeats[7] = {16, 8, 4, 2, 1, 0.5, 0.25};
            const auto syncHz = [&](double v) { return bpm / 60.0 / kBeats[std::max(0, std::min(6, static_cast<int>(std::lround(v * 6))))]; };
            if (fxNow_.phSyncHz > 0) fxNow_.phSyncHz = syncHz(ex_[mmx::ex_xPhRate]);
            if (fxNow_.flSyncHz > 0) fxNow_.flSyncHz = syncHz(ex_[mmx::ex_xFlRate]);
            fx_.set(fxNow_, false);
        }
        lastBpm_ = bpm;
    }

    // STOP : ce qui sonne s'eteint en 12 ms, plus rien d'attendu (synthStop du site)
    // (v40 : la pause de l'arpege eteint aussi ce qui sonne, sauf des notes MIDI tenues par l'utilisateur)
    {
        bool userHeld = false;
        for (bool h : held_) userHeld = userHeld || h;
        const bool now = playing && arpRun;
        if (wasPlaying_ && !now && (!playing || !userHeld)) voy_->stop(at(0));
        wasPlaying_ = now;
    }

    // Les notes MIDI de ce bloc (un clip, un clavier) et les CC (MIDI LEARN) : d'abord lus, l'arpege en depend
    bool noteIn = false;
    for (const auto meta : midi) {
        const auto msg = meta.getMessage();
        if (msg.isNoteOn()) noteIn = true;
        else if (msg.isController()) {
            onCC(msg.getChannel() - 1, msg.getControllerNumber(), msg.getControllerValue());
            // la molette de modulation (CC 1) : une source de la matrice
            if (msg.getControllerNumber() == 1) voy_->modWheel(msg.getControllerValue() / 127.0);
        } else if (msg.isPitchWheel()) voy_->pitchBend((msg.getPitchWheelValue() - 8192) / 8192.0);
        else if (msg.isChannelPressure()) voy_->aftertouch(msg.getChannelPressureValue() / 127.0);
    }
    if (noteIn) lastNoteFrame_ = f0;
    // Le clip a le dessus : des notes tenues, ou arrivees il y a moins d'une mesure, et l'arpege interne se tait
    bool anyHeld = false;
    for (bool h : held_) anyHeld = anyHeld || h;
    const double barSamples = 4.0 * 60.0 / bpm * sr;
    // (v38 : seulement en MIDI IN NOTES ; en ARP les notes font l'accord, en LAYER elles jouent par-dessus l'arpege)
    const bool clipWins = midiIn == 0 && prio_->load() > 0.5f && (noteIn || anyHeld || (lastNoteFrame_ >= 0 && static_cast<double>(f0 - lastNoteFrame_) < barSamples));
    clipActive_.store(clipWins);

    // L'arpege : les pas de ce bloc partent vers le moteur (a l'echantillon pres, dans sa file)
    // v38 MIDI IN ARP : l'accord des touches, son programme ; en quittant ARP, celui de la face revient
    if (midiIn == 1) {
        if (liveDirty_ || progChanged || knobsChanged || midiInPrev_ != 1) buildLive();
        liveDirty_ = false;
        arp_.setProgram(&liveProg_);
    } else if (midiInPrev_ == 1)
        arp_.setProgram(current_ ? &arpBuf_[arpCur_] : nullptr);
    midiInPrev_ = midiIn;
    liveOnPrev_ = liveOn;
    const bool arpOn = arpOn_->load() > 0.5f && !clipWins && (midiIn != 1 || liveOn);
    VoySink sink(*voy_);
    arp_.process(sink, f0, n, playing && arpRun && arpOn, ppq, pps, seed_);

    // Les notes MIDI (un clip, un clavier) : le synthe joue, la duree au note-off
    for (const auto meta : midi) {
        const auto msg = meta.getMessage();
        const int pos = juce::jlimit(0, n - 1, meta.samplePosition);
        if (midiIn == 1 && (msg.isNoteOn() || msg.isNoteOff())) continue; // v38 ARP : les notes font l'accord, rien d'autre
        if (msg.isNoteOn()) {
            const int m = msg.getNoteNumber();
            const double from = lastLiveMidi_ >= 0 ? static_cast<double>(lastLiveMidi_) : std::numeric_limits<double>::quiet_NaN();
            voy_->note(at(pos), m, std::numeric_limits<double>::infinity(), accentOf(msg.getFloatVelocity()), from, 0.0, static_cast<double>(msg.getFloatVelocity()));
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
        if (msg.isNoteOff() || msg.isNoteOn()) lastNoteFrame_ = f0 + pos;
    }

    // Le moteur par blocs de 128 exactement (tout ce que ce bloc a mis dans sa file est connu), dans la file ; la sortie
    // en reprend n, 128 echantillons plus tard ; puis la chaine (BASS MONO, CHORUS, DELAY, TAPE, REVERB, VOLUME)
    float* outL = buffer.getWritePointer(0);
    float* outR = buffer.getWritePointer(1);
    if (static_cast<int>(dryL_.size()) < n) {
        dryL_.resize(static_cast<size_t>(n));
        dryR_.resize(static_cast<size_t>(n));
    }
    // Faible latence (2026-11-11, Mika : "le top du top a faible latence") : le moteur rend directement le bloc de
    // l'hote, par morceaux de 128 au plus (plus de file de 128 echantillons : il ne reste que le retard des decimateurs,
    // 0.4 ms). Les morceaux ne tombent plus toujours sur la grille de 128 du site : ecart mesure 0.1 dB au plus.
    const juce::int64 cE = juce::Time::getHighResolutionTicks();
    juce::int64 c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0;
    mmarp::ArpFx::Clock fc{};
    mmarp::ArpShown sh{};
    if (!modTapOn_) {
        // Le bloc entier, etage apres etage (v49, au bit pres : aucune cible 32 + k hors du moteur n'est modulee)
        for (int i = 0; i < n; i += kChunk) {
            const int len = std::min(kChunk, n - i);
            // v50 : LFO 3 / LFO 4, sources de la matrice, seulement quand un emplacement les lit
            if (lfo3On_ || lfo4On_) modLfoChunk(len, ppq + (i + len) * pps, playing, bpm);
            voy_->process(dryL_.data() + i, dryR_.data() + i, len);
        }
        c1 = juce::Time::getHighResolutionTicks();
        publishMod();
        // DISTO facon Decapitator (2026-11-16, portee le 2026-11-17) : juste apres le moteur, avant la chaine du site ; DRIVE 0
        // ou MM (le depart) : contournee au bit pres (MM : OUTPUT seul, 0 dB au depart). Engagee, 32 echantillons de retard,
        // non declares a l'hote (comme WARMTH et le FLANGER). v25 : la page complete (dsp/Decap.h) ; la pedale DISTORTION est
        // masquee et convertie (convertPedal).
        runDisto(dryL_.data(), dryR_.data(), n, bpm);
        // PUMP suit la position du morceau
        c2 = juce::Time::getHighResolutionTicks();
        fx_.setTransport(ppq, pps, playing);
        fx_.process(dryL_.data(), dryR_.data(), outL, outR, n);
        c3 = juce::Time::getHighResolutionTicks();
        fc = fx_.takeClock();
        // La note montree par la face (et la note jouee, pour HELL en RANGE MIDI)
        sh = arp_.shownAt(frame_ + n);
        if (sh.len > 0 && sh.midi >= 0) hellNoteHz_ = 440.0 * std::pow(2.0, (sh.midi - 69) / 12.0);
        // HELL : apres la chaine du site et le rack, avant MASTER (contourne au bit pres a MIX 0). v46 : HELL v2 (xHellV2 a
        // ON, les instances neuves) ; un projet d'avant (xHellV2 a OFF) garde l'ancien moteur, au bit pres.
        runHell(outL, outR, n, ppq, playing, bpm);
        c4 = juce::Time::getHighResolutionTicks();
        // v27 : l'EQ parametrique 6 bandes (contourne au neutre, au bit pres), l'analyseur de la page SOUND (PRE ou POST,
        // seulement quand la page est visible)
        runEq(outL, outR, n, knobsChanged || eqFresh_);
        c5 = juce::Time::getHighResolutionTicks();
    } else {
        // v50 : une cible 32 + k hors du moteur est modulee par la matrice : le bloc par tranches de kModTick (32)
        // echantillons. Pour chacune : le moteur, la contribution de chaque emplacement (modTaps), la valeur effective
        // de chaque reglage vise (posee dans knobs_ / ex_ : la DISTO, HELL et l'EQ la relisent a chaque tranche, le moteur
        // et la chaine la recoivent si leur famille a bouge), puis la DISTO, la chaine, HELL, l'EQ.
        sh = arp_.shownAt(frame_ + n);
        if (sh.len > 0 && sh.midi >= 0) hellNoteHz_ = 440.0 * std::pow(2.0, (sh.midi - 69) / 12.0);
        juce::int64 tE = 0, tD = 0, tF = 0, tH = 0, tQ = 0;
        bool eqSet = knobsChanged || eqFresh_;
        for (int i = 0; i < n; i += kModTick) {
            const int len = std::min(kModTick, n - i);
            const double pq = ppq + i * pps;
            const juce::int64 a0 = juce::Time::getHighResolutionTicks();
            if (lfo3On_ || lfo4On_) modLfoChunk(len, ppq + (i + len) * pps, playing, bpm);
            voy_->process(dryL_.data() + i, dryR_.data() + i, len);
            modTapsApply(bpm, len, eqSet);
            const juce::int64 a1 = juce::Time::getHighResolutionTicks();
            runDisto(dryL_.data() + i, dryR_.data() + i, len, bpm);
            const juce::int64 a2 = juce::Time::getHighResolutionTicks();
            fx_.setTransport(pq, pps, playing);
            fx_.process(dryL_.data() + i, dryR_.data() + i, outL + i, outR + i, len);
            const juce::int64 a3 = juce::Time::getHighResolutionTicks();
            runHell(outL + i, outR + i, len, pq, playing, bpm);
            const juce::int64 a4 = juce::Time::getHighResolutionTicks();
            runEq(outL + i, outR + i, len, eqSet);
            eqSet = false;
            const juce::int64 a5 = juce::Time::getHighResolutionTicks();
            tE += a1 - a0;
            tD += a2 - a1;
            tF += a3 - a2;
            tH += a4 - a3;
            tQ += a5 - a4;
        }
        publishMod();
        fc = fx_.takeClock();
        c1 = cE + tE;
        c2 = c1 + tD;
        c3 = c2 + tF;
        c4 = c3 + tH;
        c5 = c4 + tQ;
    }
    modShow();
    publishEg();
    buffer.applyGain(dbToGain(master_->load()));
    frame_ += n;

    // La note montree par la face
    fbPlaying_.store(playing && arpRun && arpOn);
    if (playing && sh.len > 0 && sh.frame != lastShownFrame_) {
        lastShownFrame_ = sh.frame;
        fbSlot_.store(sh.slot);
        fbPos_.store(sh.pos);
        fbLen_.store(sh.len);
        fbChord_.store(sh.chord);
        fbMidi_.store(sh.midi);
        fbSkip_.store(sh.skip);
        fbDur_.store(static_cast<int>(std::lround(sh.durMs)));
        fbSeq_.fetch_add(1);
    }
    // v31 : le compteur CPU, par etage (le reste : les reglages, l'arpege, BASS MONO, le CHORUS, la prise de la chaine)
    {
        const double k = tickS_;
        double st[kCpuN];
        st[kCpuEngine] = static_cast<double>(c1 - cE) * k;
        st[kCpuDisto] = static_cast<double>(c2 - c1) * k;
        st[kCpuDelay] = fc.delay;
        st[kCpuReverb] = fc.reverb;
        st[kCpuHell] = static_cast<double>(c4 - c3) * k;
        st[kCpuEqRack] = fc.rack + static_cast<double>(c5 - c4) * k;
        st[kCpuTotal] = static_cast<double>(juce::Time::getHighResolutionTicks() - c0) * k;
        st[kCpuRest] = std::max(0.0, st[kCpuTotal] - st[kCpuEngine] - st[kCpuDisto] - st[kCpuDelay] - st[kCpuReverb] - st[kCpuHell] - st[kCpuEqRack]);
        cpuMeter(st, n);
        cpuOs_.store(osAsked_, std::memory_order_relaxed);
        cpuVoices_.store(voy_->activeVoices(), std::memory_order_relaxed);
    }
}

#if MMARP_HEADLESS
// Le banc sans fenetre (tests/host_test.cpp, Linux) : le meme processeur, sans la WebView
juce::AudioProcessorEditor* MMArpProcessor::createEditor() { return nullptr; }
#else
juce::AudioProcessorEditor* MMArpProcessor::createEditor() { return new MMArpEditor(*this); }
#endif

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MMArpProcessor(); }
