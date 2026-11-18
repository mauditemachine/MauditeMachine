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
    seed_ = static_cast<uint32_t>(juce::Random::getSystemRandom().nextInt());
    bpmId_ = mmarp::Voyager::paramIndex("bpm");
    driveId_ = mmarp::Voyager::paramIndex("drive");
    const char* xk[13] = {"xl1Dest", "xl1Amt", "l2Beats", "l2Shape", "l2Dest", "l2Amt", "xRing", "xFold", "xNoiseCol", "xUnison", "xHpf", "xComb", "xCombFb"};
    for (size_t i = 0; i < 13; ++i) xId_[i] = mmarp::Voyager::paramIndex(xk[i]);
    for (int i = 0; i < kModN; ++i) {
        modKnob_[static_cast<size_t>(i)] = mmarp::knobIndex(kModIds[i]);
        modVal_[static_cast<size_t>(i)].store(std::numeric_limits<float>::quiet_NaN());
    }
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
    startTimerHz(15);
    mmarp::reserveArp(arpBuf_[0]);
    mmarp::reserveArp(arpBuf_[1]);
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
    return {fbPlaying_.load(), internalPlaying_.load(), fbSeq_.load(), fbSlot_.load(), fbPos_.load(), fbLen_.load(), fbChord_.load(), fbMidi_.load()};
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
    mmarp::arpProgram(k.data(), p->seq, p->prog.data(), p->nProg, ap);
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

// Thread du message (il tourne fenetre fermee) : SIZE, TONE ou PRE DELAY ont bouge, une nouvelle reponse se calcule
// ici et part vers le thread audio ; les anciennes sont liberees ici aussi
void MMArpProcessor::timerCallback() {
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
    parseProg(juce::JSON::parse(ls.getProperty("mm.v4.plugin.arp.prog", "").toString()), *p);
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
    // la premiere version : la reverbe d'avant, l'ancien DELAY
    if (auto* prm = apvts.getParameter("xSkyType")) prm->setValueNotifyingHost(0.f);
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
} // namespace

// Les potards ou le programme ont change : le moteur, la chaine et l'arpege en sont tires (thread audio, sans allocation)
void MMArpProcessor::update(double bpm, bool knobsChanged, bool progChanged) {
    const MMArpProgram& p = *current_;
    if (knobsChanged || fresh_) {
        // Un message 'params' du site : tous les reglages du moteur, et le tempo
        int n = mmarp::engineParams(knobs_.data(), kv_.data(), static_cast<int>(kv_.size()) - 1);
        // DISTO (2026-11-16, portee le 2026-11-17) : le potard DISTO (dist) pousse l'OVERDRIVE du moteur sur le style MM
        // (le depart : le son d'avant) ; sur A a P, le moteur reste propre et Decap sature (processBlock)
        if (mmx::exStep(mmx::ex_xDStyle, ex_[mmx::ex_xDStyle]) != 0)
            for (int i = 0; i < n; ++i)
                if (kv_[static_cast<size_t>(i)].id == driveId_) kv_[static_cast<size_t>(i)].value = 0;
        kv_[static_cast<size_t>(n++)] = {bpmId_, bpm};
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
        voy_->params(kv_.data(), n);
        mmarp::ArpFxSettings fx;
        double dly16 = 3;
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
                          eq(fx.sky.p[4], fxNow_.sky.p[4]) && sameV27(fx, fxNow_);
        if (!same) fx_.set(fx, fresh_);
        fxNow_ = fx;
        dly16_ = dly16;
        lastBpm_ = bpm;
    }
    // L'arpege dans le tampon libre, puis echange (l'arpegiateur garde son pointeur jusque-la)
    const int next = 1 - arpCur_;
    mmarp::arpProgram(knobs_.data(), p.seq, p.prog.data(), p.nProg, arpBuf_[next]);
    arpBuf_[next].swing = p.swing;
    applySteps(p, arpBuf_[next], ex_[mmx::ex_xSwing]);
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
    const bool pro = exRaw_[mmx::ex_xEngine]->load() >= 0.5f;
    o.os = osFor(sampleRate, static_cast<double>(exRaw_[mmx::ex_xQuality]->load()), isNonRealtime() && exRaw_[mmx::ex_xExportHq]->load() >= 0.5f, pro);
    o.softVoices = 8; // v32 (Mika : "8 voix") : 8 voix pleines au plus, la neuvieme note efface la plus faible en ~5 ms
#if MMARP_HEADLESS
    // le banc CPU seulement : MMARP_SOFT_VOICES=0 mesure l'avant (12 voix)
    if (const char* e = std::getenv("MMARP_SOFT_VOICES")) o.softVoices = std::atoi(e);
#endif
    osAsked_ = o.os;
    o.seed = seed_ == 0 ? 808u : seed_;
    voy_ = std::make_unique<mmarp::Voyager>(o);
    voy_->setPro(pro);
    cpuPro_.store(pro, std::memory_order_relaxed);
    fx_.prepare(sampleRate, std::max(samplesPerBlock, kChunk));
    hell_.prepare(sampleRate);
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
    for (size_t e = 0; e < ex_.size(); ++e) {
        const float r = exRaw_[e]->load();
        if (r < exLast_[e] || r > exLast_[e]) {
            exLast_[e] = r;
            ex_[e] = static_cast<double>(r);
            knobsChanged = true;
        }
    }
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
    }
    // Une nouvelle reponse de reverb (SIZE, TONE, PRE DELAY), calculee par le thread du message
    if (revLock_.tryEnter()) {
        if (revPending_ && fx_.setReverb(revPending_)) revPending_.reset();
        revLock_.exit();
    }
    if (current_ && (progChanged || knobsChanged || fresh_)) update(bpm, knobsChanged, progChanged);
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
    if (wasPlaying_ && !playing) voy_->stop(at(0));
    wasPlaying_ = playing;

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
    const bool clipWins = prio_->load() > 0.5f && (noteIn || anyHeld || (lastNoteFrame_ >= 0 && static_cast<double>(f0 - lastNoteFrame_) < barSamples));
    clipActive_.store(clipWins);

    // L'arpege : les pas de ce bloc partent vers le moteur (a l'echantillon pres, dans sa file)
    const bool arpOn = arpOn_->load() > 0.5f && !clipWins;
    VoySink sink(*voy_);
    arp_.process(sink, f0, n, playing && arpOn, ppq, pps, seed_);

    // Les notes MIDI (un clip, un clavier) : le synthe joue, la duree au note-off
    for (const auto meta : midi) {
        const auto msg = meta.getMessage();
        const int pos = juce::jlimit(0, n - 1, meta.samplePosition);
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
    for (int i = 0; i < n; i += kChunk) voy_->process(dryL_.data() + i, dryR_.data() + i, std::min(kChunk, n - i));
    const juce::int64 c1 = juce::Time::getHighResolutionTicks();
    publishMod();
    // DISTO facon Decapitator (2026-11-16, portee le 2026-11-17) : juste apres le moteur, avant la chaine du site ; DRIVE 0
    // ou MM (le depart) : contournee au bit pres (MM : OUTPUT seul, 0 dB au depart). Engagee, 32 echantillons de retard,
    // non declares a l'hote (comme WARMTH et le FLANGER). v25 : la page complete (dsp/Decap.h) ; la pedale DISTORTION est
    // masquee et convertie (convertPedal).
    {
        mmarp::DecapSettings ds;
        const int st = mmx::exStep(mmx::ex_xDStyle, ex_[mmx::ex_xDStyle]);
        ds.mm = st == 0;
        ds.style = st > 0 ? st - 1 : 0;
        ds.drive = knobs_[static_cast<size_t>(mmarp::kn_dist)];
        ds.punish = mmx::exStep(mmx::ex_xDPunish, ex_[mmx::ex_xDPunish]) == 1;
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
        // la saturation au niveau de la prise : le gain de VOLUME du site (audio/synth.ts volGain)
        ds.ref = mmarp::ArpFxLaws::volGain(knobs_[static_cast<size_t>(mmarp::kn_volume)], knobs_[static_cast<size_t>(mmarp::kn_delay)], knobs_[static_cast<size_t>(mmarp::kn_reverb)]);
        decap_.set(ds);
        decap_.process(dryL_.data(), dryR_.data(), n);
        // ATTITUDE (mm_mod, id distoVu) : -20..+3 dB vers 0..1 ; NaN quand la DISTO est contournee
        distoVu_.store(decap_.active() ? static_cast<float>(std::clamp((decap_.attitudeDb() + 20) / 23, 0.0, 1.0)) : std::numeric_limits<float>::quiet_NaN(), std::memory_order_relaxed);
    }
    // PUMP suit la position du morceau
    const juce::int64 c2 = juce::Time::getHighResolutionTicks();
    fx_.setTransport(ppq, pps, playing);
    fx_.process(dryL_.data(), dryR_.data(), outL, outR, n);
    const juce::int64 c3 = juce::Time::getHighResolutionTicks();
    const mmarp::ArpFx::Clock fc = fx_.takeClock();
    // La note montree par la face (et la note jouee, pour HELL en RANGE MIDI)
    const mmarp::ArpShown sh = arp_.shownAt(frame_ + n);
    if (sh.len > 0 && sh.midi >= 0) hellNoteHz_ = 440.0 * std::pow(2.0, (sh.midi - 69) / 12.0);
    // HELL : apres la chaine du site et le rack, avant MASTER (contourne au bit pres a MIX 0)
    {
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
        hell_.process(outL, outR, n);
        // le VU du LFO dans la face (mm_mod, id hellLfo) : NaN quand HELL est coupe
        hellLfo_.store(hell_.active() ? static_cast<float>(hell_.lfoValue()) : std::numeric_limits<float>::quiet_NaN(), std::memory_order_relaxed);
    }
    const juce::int64 c4 = juce::Time::getHighResolutionTicks();
    // v27 : l'EQ parametrique 6 bandes (contourne au neutre, au bit pres), l'analyseur de la page SOUND (PRE ou POST,
    // seulement quand la page est visible)
    {
        const auto st = [&](int e) { return mmx::exStep(e, ex_[static_cast<size_t>(e)]); };
        mmarp::EqBandSettings eb[mmarp::ParamEq::kBands];
        for (int b = 0; (knobsChanged || eqFresh_) && b < mmarp::ParamEq::kBands; ++b) {
            const int o = b * (mmx::ex_xQ2On - mmx::ex_xQ1On);
            eb[b].on = st(mmx::ex_xQ1On + o) == 1;
            eb[b].type = st(mmx::ex_xQ1Type + o);
            eb[b].hz = mmarp::ParamEq::freqOf(ex_[static_cast<size_t>(mmx::ex_xQ1Freq + o)]);
            eb[b].db = mmarp::ParamEq::gainDbOf(ex_[static_cast<size_t>(mmx::ex_xQ1Gain + o)]);
            eb[b].q = mmarp::ParamEq::qOf(ex_[static_cast<size_t>(mmx::ex_xQ1Q + o)]);
            eb[b].slope = st(mmx::ex_xQ1Slope + o);
        }
        if (knobsChanged || eqFresh_) peq_.set(eb, mmarp::ParamEq::outDbOf(ex_[mmx::ex_xQOut]), eqFresh_);
        eqFresh_ = false;
        const int ana = specOn_.load(std::memory_order_relaxed) ? st(mmx::ex_xQAna) : 0;
        if (ana == 1) spec_.push(outL, outR, n);
        peq_.process(outL, outR, n);
        if (ana == 2) spec_.push(outL, outR, n);
    }
    const juce::int64 c5 = juce::Time::getHighResolutionTicks();
    buffer.applyGain(dbToGain(master_->load()));
    frame_ += n;

    // La note montree par la face
    fbPlaying_.store(playing && arpOn);
    if (playing && sh.len > 0 && sh.frame != lastShownFrame_) {
        lastShownFrame_ = sh.frame;
        fbSlot_.store(sh.slot);
        fbPos_.store(sh.pos);
        fbLen_.store(sh.len);
        fbChord_.store(sh.chord);
        fbMidi_.store(sh.midi);
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
