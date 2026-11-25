// MM-ARP, le moteur du navigateur : le processeur du VST3 recopie sans JUCE (voir ArpEngine.h pour la carte des lignes
// de src/PluginProcessor.cpp). Les commentaires d'origine sont gardes en court ; le code est le meme, aux types pres.
#include "ArpEngine.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <string>

#if !defined(__EMSCRIPTEN__) && (defined(__x86_64__) || defined(_M_X64) || defined(__SSE__))
#include <xmmintrin.h>
#define MMARP_FTZ_SSE 1
#elif !defined(__EMSCRIPTEN__) && defined(__aarch64__)
#define MMARP_FTZ_ARM 1
#endif

#ifndef MMARP_WEB_CPU
#define MMARP_WEB_CPU 0
#endif

namespace mmarpweb {

namespace {

constexpr int kChunk = 128;
// v50 : une cible 32 + k modulee par la matrice : le bloc par tranches de 32 echantillons
constexpr int kModTick = 32;

// Le compteur CPU : l'horloge (juce::Time en VST3) ; sous Emscripten un bouchon, sauf MMARP_WEB_CPU=1
#if defined(__EMSCRIPTEN__) && !MMARP_WEB_CPU
constexpr bool kClock = false;
double nowS() { return 0; }
#else
constexpr bool kClock = true;
double nowS() { return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count(); }
#endif

// juce::ScopedNoDenormals : SSE FTZ + DAZ (0x8040), arm64 FZ ; rien en wasm
struct NoDenormals {
#if MMARP_FTZ_SSE
    unsigned int csr;
    NoDenormals() : csr(_mm_getcsr()) { _mm_setcsr(csr | 0x8040u); }
    ~NoDenormals() { _mm_setcsr(csr); }
#elif MMARP_FTZ_ARM
    uint64_t fpcr = 0;
    NoDenormals() {
        asm volatile("mrs %0, fpcr" : "=r"(fpcr));
        const uint64_t w = fpcr | (uint64_t{1} << 24);
        asm volatile("msr fpcr, %0" : : "r"(w));
    }
    ~NoDenormals() { asm volatile("msr fpcr, %0" : : "r"(fpcr)); }
#endif
};

// juce::Decibels::decibelsToGain (float, -100 dB), sous -59.9 dB : silence
float dbToGain(float db) { return db <= -59.9f ? 0.f : (db > -100.0f ? std::pow(10.0f, db * 0.05f) : 0.0f); }

template <typename T>
T jlimit(T lo, T hi, T v) {
    return v < lo ? lo : hi < v ? hi : v;
}

// La force d'une note MIDI : velocite 100 = l'accent 1 du site (0.3 a 2, les bornes du moteur)
double accentOf(float vel) { return jlimit(0.3, 2.0, static_cast<double>(vel) * 127.0 / 100.0); }

// Les messages MIDI (juce::MidiMessage, juce_MidiMessage.cpp) : les memes tests sur les memes octets
struct Msg {
    const uint8_t* d;
    bool isNoteOn() const { return (d[0] & 0xf0) == 0x90 && d[2] != 0; }
    bool isNoteOff() const { return (d[0] & 0xf0) == 0x80 || (d[2] == 0 && (d[0] & 0xf0) == 0x90); }
    bool isNoteOnOrOff() const { return (d[0] & 0xf0) == 0x90 || (d[0] & 0xf0) == 0x80; }
    bool isController() const { return (d[0] & 0xf0) == 0xb0; }
    bool isAllNotesOff() const { return (d[0] & 0xf0) == 0xb0 && d[1] == 123; }
    bool isAllSoundOff() const { return d[1] == 120 && (d[0] & 0xf0) == 0xb0; }
    bool isPitchWheel() const { return (d[0] & 0xf0) == 0xe0; }
    bool isChannelPressure() const { return (d[0] & 0xf0) == 0xd0; }
    int getChannel() const { return (d[0] & 0xf0) != 0xf0 ? (d[0] & 0xf) + 1 : 0; }
    int getNoteNumber() const { return d[1]; }
    int getControllerNumber() const { return d[1]; }
    int getControllerValue() const { return d[2]; }
    int getPitchWheelValue() const { return d[1] | (d[2] << 7); }
    int getChannelPressureValue() const { return d[1]; }
    float getFloatVelocity() const { return (isNoteOnOrOff() ? d[2] : 0) * (1.0f / 127.0f); }
};

// Le pont arpegiateur -> moteur
struct VoySink final : mmarp::ArpSink {
    mmarp::Voyager& v;
    explicit VoySink(mmarp::Voyager& voy) : v(voy) {}
    void note(double t, int midi, double gate, double acc, double from) override { v.note(t, static_cast<double>(midi), gate, acc, from); }
    void noteGlide(double t, int midi, double gate, double acc, double from, double glideSec) override { v.note(t, static_cast<double>(midi), gate, acc, from, glideSec); }
    void beat(double t, double b, double bpm, bool run) override { v.beat(t, b, bpm, run); }
    void cancel(double t) override { v.cancel(t); }
};

// Les notes de l'arpegiateur, en temps du contexte (arpMidi)
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

const char* const ArpEngine::kModIds[ArpEngine::kModN] = {"wave1", "wave2", "fm", "cutoff", "res", "noise", "sub", "envAmt", "stack", "xRing", "xFold", "xComb"};

/* ---------------- le constructeur (cpp 160-224) ---------------- */

ArpEngine::ArpEngine(uint32_t seed) {
    for (auto& c : ccMap_) c = -1;
    for (int i = 0; i < mmarp::kKnobs; ++i) {
        raw_[static_cast<size_t>(i)] = val_[static_cast<size_t>(i)] = static_cast<float>(mmarp::kKnobDefs[i].def);
        knobs_[static_cast<size_t>(i)] = mmarp::kKnobDefs[i].def;
    }
    for (int e = 0; e < mmx::kExtra; ++e) {
        raw_[static_cast<size_t>(mmarp::kKnobs + e)] = val_[static_cast<size_t>(mmarp::kKnobs + e)] = static_cast<float>(mmx::kExtraDefs[e].def);
        ex_[static_cast<size_t>(e)] = mmx::kExtraDefs[e].def;
        exLast_[static_cast<size_t>(e)] = -1.f;
    }
    // v46 : les reglages de HELL v2, par leur id
    for (int k = 0; k < mmarp::Hell2::kKeys; ++k) {
        const int a = mmx::allIndex(mmarp::Hell2::kKeyIds[k]);
        h2Ex_[static_cast<size_t>(k)] = a >= mmarp::kKnobs ? a - mmarp::kKnobs : mmx::ex_xHellMix;
    }
    // la graine : donnee par le JS (le VST3 la tire au hasard, puis la garde dans le projet)
    seed_ = seed;
    bpmId_ = mmarp::Voyager::paramIndex("bpm");
    driveId_ = mmarp::Voyager::paramIndex("drive");
    const char* xk[13] = {"xl1Dest", "xl1Amt", "l2Beats", "l2Shape", "l2Dest", "l2Amt", "xRing", "xFold", "xNoiseCol", "xUnison", "xHpf", "xComb", "xCombFb"};
    for (size_t i = 0; i < 13; ++i) xId_[i] = mmarp::Voyager::paramIndex(xk[i]);
    for (int i = 0; i < kModN; ++i) {
        modKnob_[static_cast<size_t>(i)] = mmarp::knobIndex(kModIds[i]);
        modVal_[static_cast<size_t>(i)] = std::numeric_limits<float>::quiet_NaN();
    }
    for (auto& e : egVal_) e = std::numeric_limits<float>::quiet_NaN();
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
    {
        const char* lk[4] = {"l1Free", "l1Hz", "l2Free", "l2Hz"};
        for (size_t i = 0; i < 4; ++i) vId_[i] = mmarp::Voyager::paramIndex(lk[i]);
        for (int j = 0; j < mmx::kModSlots; ++j) {
            const std::string n = "x" + std::to_string(j + 1);
            vId_[static_cast<size_t>(4 + 3 * j)] = mmarp::Voyager::paramIndex(n + "Src");
            vId_[static_cast<size_t>(5 + 3 * j)] = mmarp::Voyager::paramIndex(n + "Dst");
            vId_[static_cast<size_t>(6 + 3 * j)] = mmarp::Voyager::paramIndex(n + "Amt");
        }
        for (auto& a : modShowK_) a = -1;
        for (auto& a : modShowV_) a = std::numeric_limits<float>::quiet_NaN();
        lfo4_.seed = seed_ ^ 0x4C464F34u;
    }
    mmarp::reserveArp(arpBuf_[0]);
    mmarp::reserveArp(arpBuf_[1]);
    mmarp::reserveArp(liveProg_);
    // Le programme de depart : sans accord, la suite AUTO
    publish(Program());
}

/* ---------------- la face (cpp 228-270, 411-420) ---------------- */

void ArpEngine::publish(const Program& p) {
    progBpm_ = p.bpm;
    lastProgram_ = p;
    hasLast_ = true;
    pending_ = p;
    hasPending_ = true;
}

// setValueNotifyingHost sur un parametre 0..1 (NormalisableRange 0..1, sans grille : la valeur telle quelle)
void ArpEngine::hostSet(int i, float v) {
    const size_t k = static_cast<size_t>(i);
    v = v < 0.f ? 0.f : v > 1.f ? 1.f : v;
    val_[k] = v;
    const float r = raw_[k];
    // juce::approximatelyEqual (float) : abs FLT_MIN, rel FLT_EPSILON
    const float diff = std::fabs(r - v);
    const bool approx = std::isfinite(r) && std::isfinite(v) ? (diff <= std::numeric_limits<float>::min() || diff <= std::numeric_limits<float>::epsilon() * std::max(std::fabs(r), std::fabs(v))) : r == v;
    if (touched_[k] && approx) return;
    raw_[k] = v;
    touched_[k] = true;
}

void ArpEngine::setKnobsFrom(const std::array<double, mmarp::kKnobs>& k) {
    for (int i = 0; i < mmarp::kKnobs; ++i) hostSet(i, static_cast<float>(k[static_cast<size_t>(i)]));
    knobsKnown_ = true;
}

void ArpEngine::setProgram(const Program& p) {
    // Une instance neuve : les potards de la face deviennent ceux du plugin
    if (p.hasKnobs && !knobsKnown_) {
        for (int e = 0; e < mmx::kExtra; ++e) hostSet(mmarp::kKnobs + e, static_cast<float>(p.extra[static_cast<size_t>(e)]));
        setKnobsFrom(p.knobs);
    }
    publish(p);
}

void ArpEngine::setParam(int i, double v) {
    if (i < 0 || i >= mmx::kAll || !std::isfinite(v)) return;
    hostSet(i, static_cast<float>(jlimit(0.0, 1.0, v)));
    knobsKnown_ = true;
}

// 'master' : NormalisableRange<float>(-60, 6, 0.1f, 2.5f), la valeur posee sur sa grille (snapToLegalValue)
void ArpEngine::setMasterDb(double db) {
    if (!std::isfinite(db)) return;
    float v = static_cast<float>(db);
    v = -60.f + 0.1f * std::floor((v - -60.f) / 0.1f + 0.5f);
    master_ = v <= -60.f ? -60.f : v >= 6.f ? 6.f : v;
}

void ArpEngine::run(bool on) {
    if (on) hostSet(mmarp::kKnobs + mmx::ex_xArpRun, 1.f);
    if (hostPlaying_) {
        if (!on) hostSet(mmarp::kKnobs + mmx::ex_xArpRun, 0.f);
        return;
    }
    runInternal_ = on;
}

void ArpEngine::midi(int offset, int status, int d1, int d2) {
    if (midiN_ >= kMidiCap) return;
    MidiEv& m = midiQ_[static_cast<size_t>(midiN_++)];
    m.pos = offset;
    m.d[0] = static_cast<uint8_t>(status & 0xff);
    m.d[1] = static_cast<uint8_t>(d1 & 0x7f);
    m.d[2] = static_cast<uint8_t>(d2 & 0x7f);
}

void ArpEngine::setHostPosition(bool playing, double ppq, double bpm) {
    host_.valid = true;
    host_.playing = playing;
    host_.ppq = ppq;
    host_.bpm = bpm;
}

/* ---------------- l'arpege en clip (cpp 297-365) ---------------- */

int ArpEngine::renderClip(int cycles, float* out, int maxNotes, int& bars) const {
    bars = 0;
    if (!hasLast_) return 0;
    const Program* p = &lastProgram_;
    if (p->nProg <= 0) return 0;
    std::array<double, mmarp::kKnobs> k{};
    for (int i = 0; i < mmarp::kKnobs; ++i) k[static_cast<size_t>(i)] = mmarp::knobClean(i, static_cast<double>(val_[static_cast<size_t>(i)]));
    mmarp::ArpProgram ap;
    mmarp::reserveArp(ap);
    const auto exVal = [&](int e) { return static_cast<double>(val_[static_cast<size_t>(mmarp::kKnobs + e)]); };
    mmarp::arpProgram(k.data(), p->seq, p->prog.data(), p->nProg, ap, mmx::exStep(mmx::ex_xKey, exVal(mmx::ex_xKey)), mmx::exStep(mmx::ex_xScale, exVal(mmx::ex_xScale)));
    ap.swing = p->swing;
    applySteps(*p, ap, exVal(mmx::ex_xSwing));
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
    const double endTick = endPpq * tpq;
    int count = 0;
    for (const auto& n : c.notes) {
        const double on = n.t * bpm / 60.0 * tpq;
        if (on >= endTick - 0.5) continue;
        const double off = std::min(endTick, on + std::max(1.0, n.gate * bpm / 60.0 * tpq));
        const int vel = jlimit(1, 127, static_cast<int>(std::lround(n.acc * 100.0)));
        if (out && count < maxNotes) {
            float* o = out + 4 * count;
            o[0] = static_cast<float>(std::round(on));
            o[1] = static_cast<float>(std::round(off));
            o[2] = static_cast<float>(vel);
            o[3] = static_cast<float>(n.midi);
        }
        ++count;
    }
    return count;
}

/* ---------------- MIDI IN ARP (cpp 367-409) ---------------- */

void ArpEngine::buildLive() {
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

/* ---------------- QUALITY, la reverb (cpp 441-495) ---------------- */

int ArpEngine::osFor(double sr, double quality, bool exportHq, bool pro) {
    const int step = exportHq ? 2 : static_cast<int>(std::lround(std::clamp(quality, 0.0, 1.0) * 2));
    const int os = pro ? (step == 0 ? 1 : step == 1 ? 2 : 4) : (step == 0 ? 2 : step == 1 ? 4 : 8);
    return sr > 60000 ? std::max(1, os / 2) : os;
}

// timerCallback : la latence (syncLatency), les reponses de reverb liberees, la nouvelle calculee ici (le VST3 : sur un
// fil, reprise au tick suivant ; ici tout de suite : un seul fil). Le JS l'appelle entre deux quanta (~15 fois par seconde).
void ArpEngine::idle() {
    latDeclared_ = latNow_;
    while (fx_.takeRetiredReverb()) {}
    const double sr = sr_;
    if (sr <= 0) return;
    const std::array<double, 4> key{static_cast<double>(raw_[static_cast<size_t>(mmarp::kKnobs + mmx::ex_xRevSize)]),
                                    static_cast<double>(raw_[static_cast<size_t>(mmarp::kKnobs + mmx::ex_xRevTone)]),
                                    static_cast<double>(raw_[static_cast<size_t>(mmarp::kKnobs + mmx::ex_xRevPre)]), sr};
    bool same = true;
    for (size_t i = 0; i < 4; ++i) same = same && std::fabs(key[i] - revKey_[i]) < 1e-9;
    if (same) return;
    revKey_ = key;
    std::shared_ptr<const mmarp::ReverbIR> got = mmarp::ArpFx::makeReverb(key[3], key[0], key[1], key[2]);
    if (got) {
        // l'ancienne demandee est liberee ici (jamais dans process)
        revWanted_ = got;
        revPending_ = std::move(got);
    }
}

/* ---------------- MIDI LEARN (cpp 499-529) ---------------- */

void ArpEngine::onCC(int ch, int cc, int value) {
    if (ch < 0 || ch > 15 || cc < 0 || cc > 127) return;
    const size_t k = static_cast<size_t>(ch * 128 + cc);
    const int learn = learn_;
    if (learn >= 0) {
        // Un seul CC par potard : l'ancien part
        for (auto& c : ccMap_)
            if (c == learn) c = -1;
        ccMap_[k] = learn;
        learn_ = -1;
        mapChanged_ = true;
    }
    const int i = ccMap_[k];
    if (i >= 0 && i < mmx::kAll) hostSet(i, static_cast<float>(value) / 127.f);
}

void ArpEngine::learn(int index) {
    learn_ = index >= 0 && index < mmx::kAll ? index : -1;
    mapChanged_ = true;
}

void ArpEngine::unmap(int ch, int cc) {
    if (ch >= 0 && ch < 16 && cc >= 0 && cc < 128) ccMap_[static_cast<size_t>(ch * 128 + cc)] = -1;
    mapChanged_ = true;
}

void ArpEngine::unmapAll() {
    for (auto& c : ccMap_) c = -1;
    mapChanged_ = true;
}

// L'etat du projet (setStateInformation, cpp 642-649) : une assignation rechargee
void ArpEngine::mapSet(int ch, int cc, int index) {
    if (ch >= 0 && ch < 16 && cc >= 0 && cc < 128) ccMap_[static_cast<size_t>(ch * 128 + cc)] = index >= 0 && index < mmx::kAll ? index : -1;
    mapChanged_ = true;
}

/* ---------------- les arcs, les enveloppes (cpp 820-858) ---------------- */

void ArpEngine::publishMod() {
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
        modVal_[static_cast<size_t>(i)] = on ? static_cast<float>(clamp01(v)) : std::numeric_limits<float>::quiet_NaN();
    }
}

void ArpEngine::publishEg() {
    const mmarp::EgView e = voy_->egView();
    const float nan = std::numeric_limits<float>::quiet_NaN();
    const float v[kEgN] = {e.on ? static_cast<float>(e.fV) : nan, static_cast<float>(e.aV), static_cast<float>(e.fStage), static_cast<float>(e.aStage), static_cast<float>(e.tOn), static_cast<float>(e.tOff)};
    for (int i = 0; i < kEgN; ++i) egVal_[static_cast<size_t>(i)] = v[i];
}

// Les pistes du sequenceur par pas et le swing propre de l'arpege, poses apres arpProgram()
void ArpEngine::applySteps(const Program& p, mmarp::ArpProgram& out, double swingOwn) const {
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
// v27 : les reglages neufs de la chaine sont-ils les memes ?
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

/* ---------------- les reglages vers le moteur, la chaine, l'arpege (cpp 894-1116) ---------------- */

void ArpEngine::update(double bpm, bool knobsChanged, bool progChanged) {
    if (knobsChanged || fresh_) {
        // v50 : les emplacements de la matrice (xMx) et leur chemin, avant les reglages du moteur
        modRoute();
        const int n = engineKv(bpm, true);
        voy_->params(kv_.data(), n);
        mmarp::ArpFxSettings fx;
        double dly16 = 3;
        buildFx(bpm, fx, dly16);
        applyFx(fx, dly16, bpm);
    }
    buildArp();
    (void)progChanged;
    fresh_ = false;
}

int ArpEngine::engineKv(double bpm, bool withBpm) {
    int n = mmarp::engineParams(knobs_.data(), kv_.data(), static_cast<int>(kv_.size()) - 1);
    // DISTO : sur A a P, le moteur reste propre et Decap sature
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
    // v50 : LFO 1 / LFO 2 en FREE, les 8 lignes de plus de la matrice
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

void ArpEngine::buildFx(double bpm, mmarp::ArpFxSettings& fx, double& dly16) {
    mmarp::fxSettings(knobs_.data(), fx, dly16);
    // Le master du VST3 (SIZE / TONE / PRE passent par makeReverb : idle)
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
    // la pedale DISTORTION est masquee (v25) : sans effet
    fx.dist = 0;
    fx.distTone = 0.5;
    fx.eqLow = ex_[mmx::ex_xEqLow];
    fx.eqMid = ex_[mmx::ex_xEqMid];
    fx.eqHigh = ex_[mmx::ex_xEqHigh];
    fx.eqAir = ex_[mmx::ex_xEqAir];
    // La reverbe facon BigSky : CLASSIC (0) est la convolution d'avant
    fx.skyType = mmx::exStep(mmx::ex_xSkyType, ex_[mmx::ex_xSkyType]);
    fx.sky.decay = ex_[mmx::ex_xSkyDecay];
    fx.sky.pre = ex_[mmx::ex_xSkyPre];
    fx.sky.tone = ex_[mmx::ex_xSkyTone];
    fx.sky.mod = ex_[mmx::ex_xSkyMod];
    fx.sky.lowEnd = ex_[mmx::ex_xSkyLow];
    fx.sky.p = {{ex_[mmx::ex_xSkyP1], ex_[mmx::ex_xSkyP2], ex_[mmx::ex_xSkyP3], ex_[mmx::ex_xSkyP4], ex_[mmx::ex_xSkyP5]}};
    const auto st = [&](int e) { return mmx::exStep(e, ex_[static_cast<size_t>(e)]); };
    // v46 : la sortie de la reverbe
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
    // v27 : la page DELAY (le banc testLegacyDelay du VST3 n'est pas repris : toujours la page)
    {
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
    // DLY TIME au tempo (2 s au plus) ; v27 : FREE, en ms
    fx.delaySeconds = dlyFree_ > 0 ? std::min(2.0, dlyFree_) : std::min(2.0, dly16 * 60.0 / std::max(20.0, bpm) / 4.0);
}

void ArpEngine::applyFx(const mmarp::ArpFxSettings& fx, double dly16, double bpm) {
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

void ArpEngine::buildArp() {
    const Program& p = current_;
    const int next = 1 - arpCur_;
    // v52 : dans la tonalite de l'instance (xKey, xScale)
    mmarp::arpProgram(knobs_.data(), p.seq, p.prog.data(), p.nProg, arpBuf_[next], mmx::exStep(mmx::ex_xKey, ex_[mmx::ex_xKey]), mmx::exStep(mmx::ex_xScale, ex_[mmx::ex_xScale]));
    arpBuf_[next].swing = p.swing;
    applySteps(p, arpBuf_[next], ex_[mmx::ex_xSwing]);
    arp_.setProgram(&arpBuf_[next]);
    arpCur_ = next;
}

/* ---------------- v50 : la matrice de modulation (cpp 1120-1378) ---------------- */

namespace {
enum { FAM_ENGINE = 1, FAM_FX = 2, FAM_ARP = 4, FAM_EQ = 8 };

int voiceRoute(int k, double& scale) {
    scale = 1;
    if (k == mmarp::kn_cutoff) {
        scale = 9.3 / 4;
        return 10;
    }
    if (k == mmarp::kn_res) {
        scale = 1 / 0.35;
        return 11;
    }
    if (k == mmarp::kn_envAmt) {
        scale = 6.0 / 3;
        return 12;
    }
    if (k == mmarp::kn_fm) {
        scale = 1 / 0.6;
        return 4;
    }
    if (k == mmarp::kn_noise) return 6;
    const int e = k - mmarp::kKnobs;
    if (e == mmx::ex_xRing) return 8;
    if (e == mmx::ex_xFold) return 9;
    if (e == mmx::ex_xComb) return 19;
    return 0;
}
} // namespace

int ArpEngine::modFamily(int k) {
    using namespace mmarp;
    if (k < kKnobs) {
        switch (k) {
            case kn_gate:
            case kn_accent: return FAM_ARP;
            case kn_drift: return FAM_ENGINE | FAM_ARP;
            case kn_delay:
            case kn_reverb:
            case kn_volume: return FAM_ENGINE | FAM_FX;
            case kn_monoLow: return FAM_FX;
            default: return FAM_ENGINE;
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

void ArpEngine::modRoute() {
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

void ArpEngine::modLfoChunk(int n, double ppqEnd, bool playing, double bpm) {
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

void ArpEngine::modHostSync() {
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

void ArpEngine::modTapsApply(double bpm, int len, bool& eqSet) {
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

void ArpEngine::modShow() {
    bool any = false;
    mmarp::Voyager::ModTap tp[mmarp::Voyager::kModTaps];
    bool have = false;
    for (int j = 0; j < mmx::kModSlots; ++j) {
        const ModSlot& s = mslot_[static_cast<size_t>(j)];
        if (s.route != 2 && s.route != 3) {
            if (modShowAny_) modShowK_[static_cast<size_t>(j)] = -1;
            continue;
        }
        double eff;
        if (s.route == 3) {
            eff = workValue(s.k);
        } else {
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
        modShowK_[static_cast<size_t>(j)] = s.k;
        modShowV_[static_cast<size_t>(j)] = static_cast<float>(eff);
        any = true;
    }
    modShowAny_ = any;
}

void ArpEngine::modReset() {
    nTgt_ = 0;
    arpDirty_ = false;
    lfo3_.reset();
    lfo4_.reset();
    lfo4_.seed = seed_ ^ 0x4C464F34u;
    bool tap = false;
    for (const auto& s : mslot_) tap = tap || s.route == 3;
    modTapOn_ = tap;
}

/* ---------------- DISTO, HELL, l'EQ (cpp 1381-1517) ---------------- */

void ArpEngine::runDisto(float* L, float* R, int n, double bpm) {
    mmarp::DecapSettings ds;
    const int st = mmx::exStep(mmx::ex_xDStyle, ex_[mmx::ex_xDStyle]);
    ds.mm = st == 0;
    ds.style = st > 0 ? st - 1 : 0;
    ds.drive = knobs_[static_cast<size_t>(mmarp::kn_dist)];
    ds.punish = mmx::exStep(mmx::ex_xDPunish, ex_[mmx::ex_xDPunish]) == 1;
    ds.punish2 = mmx::exStep(mmx::ex_xDPunish2, ex_[mmx::ex_xDPunish2]) == 1;
    ds.low = ex_[mmx::ex_xDLow];
    ds.thump = mmx::exStep(mmx::ex_xDThump, ex_[mmx::ex_xDThump]) == 1;
    ds.tone = ex_[mmx::ex_xDTone];
    ds.high = ex_[mmx::ex_xDHigh];
    ds.steep = mmx::exStep(mmx::ex_xDSteep, ex_[mmx::ex_xDSteep]) == 1;
    ds.mix = ex_[mmx::ex_xDMix];
    ds.out = ex_[mmx::ex_xDOut];
    ds.autoGain = mmx::exStep(mmx::ex_xDAuto, ex_[mmx::ex_xDAuto]) == 1;
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
            bd.style = stp(k[b][0]) - 1;
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
    ds.zeroLatency = zlAsked_;
    ds.ref = mmarp::ArpFxLaws::volGain(knobs_[static_cast<size_t>(mmarp::kn_volume)], knobs_[static_cast<size_t>(mmarp::kn_delay)], knobs_[static_cast<size_t>(mmarp::kn_reverb)]);
    decap_.set(ds);
    decap_.process(L, R, n);
    distoVu_ = decap_.active() ? static_cast<float>(std::clamp((decap_.attitudeDb() + 20) / 23, 0.0, 1.0)) : std::numeric_limits<float>::quiet_NaN();
    // v50 : LFO 3 reste en phase avec celui de la DISTO quand elle tourne
    if (lfo3On_ && decap_.active()) {
        double ph = 0, sm = 0, rnd = 0;
        uint32_t g = 0;
        decap_.lfoState(ph, sm, rnd, g);
        lfo3_.sync(ph, sm, rnd, g);
    }
}

void ArpEngine::runHell(float* L, float* R, int n, double ppq, bool playing, double bpm) {
    const bool hellV2 = mmx::exStep(mmx::ex_xHellV2, ex_[mmx::ex_xHellV2]) == 1;
    if (hellV2Was_ >= 0 && hellV2 != (hellV2Was_ == 1)) {
        if (hellV2) hell_.reset();
        else hell2_.stop();
    }
    hellV2Was_ = hellV2 ? 1 : 0;
    if (hellV2) {
        double hv[mmarp::Hell2::kKeys];
        for (int k = 0; k < mmarp::Hell2::kKeys; ++k) hv[k] = ex_[static_cast<size_t>(h2Ex_[static_cast<size_t>(k)])];
        hell2_.set(mmarp::Hell2::settingsOf(hv, ex_[mmx::ex_xHellMix], bpm, hellNoteHz_), bpm);
        hell2_.process(L, R, n, ppq, playing, hellNoteHz_);
        hellLfo_ = hell2_.active() ? static_cast<float>(hell2_.lfoValue()) : std::numeric_limits<float>::quiet_NaN();
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
        hellLfo_ = hell_.active() ? static_cast<float>(hell_.lfoValue()) : std::numeric_limits<float>::quiet_NaN();
    }
}

void ArpEngine::runEq(float* L, float* R, int n, bool set) {
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
    const int ana = specOn_ ? st(mmx::ex_xQAna) : 0;
    if (ana == 1) spec_.push(L, R, n);
    peq_.process(L, R, n);
    if (ana == 2) spec_.push(L, R, n);
}

/* ---------------- prepare (cpp 1519-1588) ---------------- */

void ArpEngine::prepare(double sampleRate, int samplesPerBlock) {
    sr_ = sampleRate;
    block_ = samplesPerBlock;
    frame_ = 0;
    mmarp::VoyagerOptions o;
    o.sampleRate = sampleRate;
    const auto rawEx = [&](int e) { return raw_[static_cast<size_t>(mmarp::kKnobs + e)]; };
    const bool pro = rawEx(mmx::ex_xEngine) >= 0.5f;
    o.os = osFor(sampleRate, static_cast<double>(rawEx(mmx::ex_xQuality)), offline_ && rawEx(mmx::ex_xExportHq) >= 0.5f, pro);
    o.softVoices = 8; // v32 : 8 voix pleines au plus
    osAsked_ = o.os;
    // v49 LATENCY : ZERO (les instances neuves) ou EXACT
    zlAsked_ = rawEx(mmx::ex_xLatency) >= 0.5f;
    o.zeroLatency = zlAsked_;
    o.seed = seed_ == 0 ? 808u : seed_;
    voy_ = std::make_unique<mmarp::Voyager>(o);
    voy_->setPro(pro);
    cpuPro_ = pro;
    fx_.prepare(sampleRate, std::max(samplesPerBlock, kChunk));
    fx_.setZeroLatency(zlAsked_);
    hell_.prepare(sampleRate);
    hell2_.prepare(sampleRate);
    hellV2Was_ = -1;
    decap_.prepare(sampleRate);
    peq_.prepare(sampleRate);
    spec_.prepare(sampleRate);
    eqFresh_ = true;
    // La reverb des reglages en cours, tout de suite ; ensuite idle suit SIZE, TONE, PRE DELAY
    {
        const double rs = static_cast<double>(rawEx(mmx::ex_xRevSize)), rt = static_cast<double>(rawEx(mmx::ex_xRevTone)),
                     rp = static_cast<double>(rawEx(mmx::ex_xRevPre));
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
    if (!hasPending_ && hasCurrent_) {
        pending_ = current_;
        hasPending_ = true;
    }
    hasCurrent_ = false;
    latNow_ = voy_->latencySamples() + fx_.latencySamples();
    latDeclared_ = latNow_;
}

void ArpEngine::cpuMeter(const double* s, int n) {
    const double dur = static_cast<double>(n) / sr_;
    if (!(dur > 0)) return;
    const double a = 1.0 - std::exp(-dur / 0.25);
    for (int i = 0; i < kCpuN; ++i) {
        const double pc = 100.0 * std::max(0.0, s[i]) / dur;
        cpuSm_[static_cast<size_t>(i)] += (pc - cpuSm_[static_cast<size_t>(i)]) * a;
        cpu_[static_cast<size_t>(i)] = static_cast<float>(cpuSm_[static_cast<size_t>(i)]);
    }
    const double tot = 100.0 * s[kCpuTotal] / dur;
    if (tot >= cpuPk_) {
        cpuPk_ = tot;
        cpuHold_ = 1.0;
    } else if ((cpuHold_ -= dur) <= 0)
        cpuPk_ = std::max(cpuSm_[kCpuTotal], cpuPk_ * std::exp(-dur / 0.4));
    cpuPeak_ = static_cast<float>(cpuPk_);
}

/* ---------------- process (cpp 1623-1977, processBlock) ---------------- */

void ArpEngine::process(float* outL, float* outR, int n) {
    NoDenormals noDenormals;
    (void)noDenormals;
    if (n > 0) {
        std::fill(outL, outL + n, 0.f);
        std::fill(outR, outR + n, 0.f);
    }
    if (!voy_ || n <= 0) {
        midiN_ = 0;
        host_.valid = false;
        return;
    }
    // la file MIDI dans l'ordre du MidiBuffer : par position, stable
    for (int a = 1; a < midiN_; ++a) {
        const MidiEv ev = midiQ_[static_cast<size_t>(a)];
        int b = a - 1;
        while (b >= 0 && midiQ_[static_cast<size_t>(b)].pos > ev.pos) {
            midiQ_[static_cast<size_t>(b + 1)] = midiQ_[static_cast<size_t>(b)];
            --b;
        }
        midiQ_[static_cast<size_t>(b + 1)] = ev;
    }
    const int nMidi = midiN_;
    const double c0 = nowS();
    const double sr = sr_;
    const int64_t f0 = frame_;
    auto at = [&](int pos) { return static_cast<double>(f0 + pos) / sr; };
    const auto rawEx = [&](int e) { return raw_[static_cast<size_t>(mmarp::kKnobs + e)]; };

    // v38 MIDI IN : en ARP, les touches tenues font l'accord
    const int midiIn = mmx::exStep(mmx::ex_xMidiIn, static_cast<double>(rawEx(mmx::ex_xMidiIn)));
    if (midiIn == 1) {
        const bool hold = rawEx(mmx::ex_xArpHold) >= 0.5f;
        for (int q = 0; q < nMidi; ++q) {
            const Msg msg{midiQ_[static_cast<size_t>(q)].d};
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

    // Le transport : celui de l'hote s'il joue (setHostPosition, rien par defaut), sinon l'horloge interne (RUN)
    double bpm = progBpm_;
    bool hostPlaying = false;
    double ppq = 0;
    if (host_.valid) {
        if (host_.bpm > 0) bpm = host_.bpm;
        if (host_.playing) {
            hostPlaying = true;
            ppq = host_.ppq;
        }
    }
    host_.valid = false;
    bpm = jlimit(20.0, 400.0, bpm);
    bool internal = false;
    if (!hostPlaying && (runInternal_ || liveOn)) {
        if (!internalPlaying_) internalPpq_ = 0;
        internal = true;
        ppq = internalPpq_;
    }
    if (hostPlaying && runInternal_) runInternal_ = false;
    internalPlaying_ = internal;
    hostPlaying_ = hostPlaying;
    const bool playing = hostPlaying || internal;
    const bool arpRun = internal || rawEx(mmx::ex_xArpRun) >= 0.5f;
    const double pps = bpm / 60.0 / sr;
    facePpq_ = playing ? std::max(0.0, ppq) : -1.0;
    faceBpm_ = bpm;
    if (internal) internalPpq_ += n * pps;

    // Un nouveau programme de la face
    bool progChanged = false;
    if (hasPending_) {
        current_ = pending_;
        hasCurrent_ = true;
        hasPending_ = false;
        progChanged = true;
    }
    // Les potards (automation, MIDI Map, la face)
    bool knobsChanged = false;
    for (size_t i = 0; i < knobs_.size(); ++i) {
        const float r = raw_[i];
        if (r < knobRawLast_[i] || r > knobRawLast_[i]) {
            knobRawLast_[i] = r;
            knobs_[i] = mmarp::knobClean(static_cast<int>(i), static_cast<double>(r));
            knobsChanged = true;
        }
    }
    for (size_t e = 0; e < ex_.size(); ++e) {
        const float r = raw_[static_cast<size_t>(mmarp::kKnobs) + e];
        if (r < exLast_[e] || r > exLast_[e]) {
            exLast_[e] = r;
            ex_[e] = static_cast<double>(r);
            knobsChanged = true;
        }
    }
    // v50 : les reglages modules par la matrice gardent leur valeur effective
    if (nTgt_ > 0) modHostSync();
    // QUALITY, ENGINE, LATENCY
    {
        const bool pro = ex_[mmx::ex_xEngine] >= 0.5;
        const int os = osFor(sr, ex_[mmx::ex_xQuality], offline_ && ex_[mmx::ex_xExportHq] >= 0.5, pro);
        if (os != osAsked_) {
            voy_->setOs(os);
            osAsked_ = os;
        }
        if (pro != voy_->pro()) voy_->setPro(pro);
        cpuPro_ = pro;
        const bool zl = mmx::exStep(mmx::ex_xLatency, ex_[mmx::ex_xLatency]) == 1;
        if (zl != zlAsked_) {
            voy_->setZeroLatency(zl);
            fx_.setZeroLatency(zl);
            zlAsked_ = zl;
        }
        latNow_ = voy_->latencySamples() + fx_.latencySamples();
    }
    // Une nouvelle reponse de reverb (idle)
    if (revPending_ && fx_.setReverb(revPending_)) revPending_.reset();
    if (hasCurrent_ && (progChanged || knobsChanged || fresh_)) update(bpm, knobsChanged, progChanged);
    else if (hasCurrent_ && arpDirty_) {
        // v50 : GATE, ACCENT, DRIFT ou SWING modules par la matrice : l'arpege de ce bloc les prend
        buildArp();
        liveDirty_ = true;
    }
    arpDirty_ = false;
    // Le tempo change : le LFO libre et le DELAY le suivent
    if (hasCurrent_ && std::fabs(bpm - lastBpm_) > 1e-9) {
        const mmarp::ParamKV b{bpmId_, bpm};
        voy_->params(&b, 1);
        if (dlyFree_ <= 0) {
            fx_.retimeDelay(std::min(2.0, dly16_ * 60.0 / std::max(20.0, bpm) / 4.0));
            fxNow_.delaySeconds = std::min(2.0, dly16_ * 60.0 / std::max(20.0, bpm) / 4.0);
        }
        if (syncFx_) {
            static const double kBeats[7] = {16, 8, 4, 2, 1, 0.5, 0.25};
            const auto syncHz = [&](double v) { return bpm / 60.0 / kBeats[std::max(0, std::min(6, static_cast<int>(std::lround(v * 6))))]; };
            if (fxNow_.phSyncHz > 0) fxNow_.phSyncHz = syncHz(ex_[mmx::ex_xPhRate]);
            if (fxNow_.flSyncHz > 0) fxNow_.flSyncHz = syncHz(ex_[mmx::ex_xFlRate]);
            fx_.set(fxNow_, false);
        }
        lastBpm_ = bpm;
    }

    // STOP : ce qui sonne s'eteint en 12 ms (sauf des notes MIDI tenues pendant la pause de l'arpege)
    {
        bool userHeld = false;
        for (bool h : held_) userHeld = userHeld || h;
        const bool now = playing && arpRun;
        if (wasPlaying_ && !now && (!playing || !userHeld)) voy_->stop(at(0));
        wasPlaying_ = now;
    }

    // Les notes MIDI de ce bloc et les CC (MIDI LEARN) : d'abord lus, l'arpege en depend
    bool noteIn = false;
    for (int q = 0; q < nMidi; ++q) {
        const Msg msg{midiQ_[static_cast<size_t>(q)].d};
        if (msg.isNoteOn()) noteIn = true;
        else if (msg.isController()) {
            onCC(msg.getChannel() - 1, msg.getControllerNumber(), msg.getControllerValue());
            if (msg.getControllerNumber() == 1) voy_->modWheel(msg.getControllerValue() / 127.0);
        } else if (msg.isPitchWheel()) voy_->pitchBend((msg.getPitchWheelValue() - 8192) / 8192.0);
        else if (msg.isChannelPressure()) voy_->aftertouch(msg.getChannelPressureValue() / 127.0);
    }
    if (noteIn) lastNoteFrame_ = f0;
    // Le clip a le dessus : des notes tenues, ou arrivees il y a moins d'une mesure
    bool anyHeld = false;
    for (bool h : held_) anyHeld = anyHeld || h;
    const double barSamples = 4.0 * 60.0 / bpm * sr;
    const bool clipWins = midiIn == 0 && prio_ > 0.5f && (noteIn || anyHeld || (lastNoteFrame_ >= 0 && static_cast<double>(f0 - lastNoteFrame_) < barSamples));
    clipActive_ = clipWins;

    // L'arpege : les pas de ce bloc partent vers le moteur ; v38 MIDI IN ARP : l'accord des touches
    if (midiIn == 1) {
        if (liveDirty_ || progChanged || knobsChanged || midiInPrev_ != 1) buildLive();
        liveDirty_ = false;
        arp_.setProgram(&liveProg_);
    } else if (midiInPrev_ == 1)
        arp_.setProgram(hasCurrent_ ? &arpBuf_[arpCur_] : nullptr);
    midiInPrev_ = midiIn;
    liveOnPrev_ = liveOn;
    const bool arpOn = arpOn_ > 0.5f && !clipWins && (midiIn != 1 || liveOn);
    VoySink sink(*voy_);
    arp_.process(sink, f0, n, playing && arpRun && arpOn, ppq, pps, seed_);

    // Les notes MIDI (un clip, un clavier) : le synthe joue, la duree au note-off
    for (int q = 0; q < nMidi; ++q) {
        const Msg msg{midiQ_[static_cast<size_t>(q)].d};
        const int pos = jlimit(0, n - 1, midiQ_[static_cast<size_t>(q)].pos);
        if (midiIn == 1 && (msg.isNoteOn() || msg.isNoteOff())) continue;
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
    midiN_ = 0;

    // Le moteur par morceaux de 128 au plus, puis la DISTO, la chaine, HELL, l'EQ
    if (static_cast<int>(dryL_.size()) < n) {
        dryL_.resize(static_cast<size_t>(n));
        dryR_.resize(static_cast<size_t>(n));
    }
    const double cE = nowS();
    double c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0;
    mmarp::ArpFx::Clock fc{};
    mmarp::ArpShown sh{};
    if (!modTapOn_) {
        // Le bloc entier, etage apres etage
        for (int i = 0; i < n; i += kChunk) {
            const int len = std::min(kChunk, n - i);
            if (lfo3On_ || lfo4On_) modLfoChunk(len, ppq + (i + len) * pps, playing, bpm);
            voy_->process(dryL_.data() + i, dryR_.data() + i, len);
        }
        c1 = nowS();
        publishMod();
        runDisto(dryL_.data(), dryR_.data(), n, bpm);
        c2 = nowS();
        fx_.setTransport(ppq, pps, playing);
        fx_.process(dryL_.data(), dryR_.data(), outL, outR, n);
        c3 = nowS();
        fc = fx_.takeClock();
        // La note montree par la face (et la note jouee, pour HELL en RANGE MIDI)
        sh = arp_.shownAt(frame_ + n);
        if (sh.len > 0 && sh.midi >= 0) hellNoteHz_ = 440.0 * std::pow(2.0, (sh.midi - 69) / 12.0);
        runHell(outL, outR, n, ppq, playing, bpm);
        c4 = nowS();
        runEq(outL, outR, n, knobsChanged || eqFresh_);
        c5 = nowS();
    } else {
        // v50 : une cible 32 + k hors du moteur est modulee : le bloc par tranches de kModTick (32) echantillons
        sh = arp_.shownAt(frame_ + n);
        if (sh.len > 0 && sh.midi >= 0) hellNoteHz_ = 440.0 * std::pow(2.0, (sh.midi - 69) / 12.0);
        double tE = 0, tD = 0, tF = 0, tH = 0, tQ = 0;
        bool eqSet = knobsChanged || eqFresh_;
        for (int i = 0; i < n; i += kModTick) {
            const int len = std::min(kModTick, n - i);
            const double pq = ppq + i * pps;
            const double a0 = nowS();
            if (lfo3On_ || lfo4On_) modLfoChunk(len, ppq + (i + len) * pps, playing, bpm);
            voy_->process(dryL_.data() + i, dryR_.data() + i, len);
            modTapsApply(bpm, len, eqSet);
            const double a1 = nowS();
            runDisto(dryL_.data() + i, dryR_.data() + i, len, bpm);
            const double a2 = nowS();
            fx_.setTransport(pq, pps, playing);
            fx_.process(dryL_.data() + i, dryR_.data() + i, outL + i, outR + i, len);
            const double a3 = nowS();
            runHell(outL + i, outR + i, len, pq, playing, bpm);
            const double a4 = nowS();
            runEq(outL + i, outR + i, len, eqSet);
            eqSet = false;
            const double a5 = nowS();
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
    // buffer.applyGain (JUCE 8 : une multiplication, sans cas particulier)
    {
        const float g = dbToGain(master_);
        for (int i = 0; i < n; ++i) outL[i] *= g;
        for (int i = 0; i < n; ++i) outR[i] *= g;
    }
    frame_ += n;

    // La note montree par la face
    fbPlaying_ = playing && arpRun && arpOn;
    if (playing && sh.len > 0 && sh.frame != lastShownFrame_) {
        lastShownFrame_ = sh.frame;
        fbSlot_ = sh.slot;
        fbPos_ = sh.pos;
        fbLen_ = sh.len;
        fbChord_ = sh.chord;
        fbMidi_ = sh.midi;
        fbSkip_ = sh.skip;
        fbDur_ = static_cast<int>(std::lround(sh.durMs));
        ++fbSeq_;
    }
    // le compteur CPU, par etage (sans horloge : tout a 0)
    {
        if (!kClock) fc = {};
        double st[kCpuN];
        st[kCpuEngine] = c1 - cE;
        st[kCpuDisto] = c2 - c1;
        st[kCpuDelay] = fc.delay;
        st[kCpuReverb] = fc.reverb;
        st[kCpuHell] = c4 - c3;
        st[kCpuEqRack] = fc.rack + (c5 - c4);
        st[kCpuTotal] = nowS() - c0;
        st[kCpuRest] = std::max(0.0, st[kCpuTotal] - st[kCpuEngine] - st[kCpuDisto] - st[kCpuDelay] - st[kCpuReverb] - st[kCpuHell] - st[kCpuEqRack]);
        cpuMeter(st, n);
        cpuOs_ = osAsked_;
        cpuVoices_ = voy_->activeVoices();
    }
}

/* ---------------- ce que lit le timer de l'editeur ---------------- */

const Telemetry& ArpEngine::telemetry() {
    Telemetry& t = tele_;
    t.playing = fbPlaying_ ? 1 : 0;
    t.internal = internalPlaying_ ? 1 : 0;
    t.seq = fbSeq_;
    t.slot = fbSlot_;
    t.pos = fbPos_;
    t.len = fbLen_;
    t.chord = fbChord_;
    t.midi = fbMidi_;
    t.skip = fbSkip_ ? 1 : 0;
    t.dur = fbDur_;
    t.ppq = facePpq_;
    t.bpm = faceBpm_;
    for (int i = 0; i < kModN; ++i) t.mod[i] = static_cast<double>(modVal_[static_cast<size_t>(i)]);
    for (int j = 0; j < mmx::kModSlots; ++j) {
        t.modShowK[j] = modShowK_[static_cast<size_t>(j)];
        t.modShowV[j] = static_cast<double>(modShowV_[static_cast<size_t>(j)]);
    }
    t.hellLfo = static_cast<double>(hellLfo_);
    t.distoVu = static_cast<double>(distoVu_);
    for (int i = 0; i < kEgN; ++i) t.eg[i] = static_cast<double>(egVal_[static_cast<size_t>(i)]);
    t.egSilent = std::isnan(egVal_[0]) ? 1 : 0;
    for (int i = 0; i < kCpuN; ++i) t.cpu[i] = static_cast<double>(cpu_[static_cast<size_t>(i)]);
    t.cpuPeak = static_cast<double>(cpuPeak_);
    t.os = cpuOs_;
    t.voices = cpuVoices_;
    t.pro = cpuPro_ ? 1 : 0;
    t.sr = sr_;
    t.block = block_;
    t.latency = latNow_;
    t.latencyDeclared = latDeclared_;
    t.clipActive = clipActive_ ? 1 : 0;
    t.knobsKnown = knobsKnown_ ? 1 : 0;
    t.learn = learn_;
    t.mapChanged = mapChanged_ ? 1 : 0;
    t.specOn = specOn_ ? 1 : 0;
    t.hostPlaying = hostPlaying_ ? 1 : 0;
    t.frame = static_cast<double>(frame_);
    return t;
}

} // namespace mmarpweb

/* ---------------- l'API C ---------------- */

using mmarpweb::ArpEngine;

namespace {
ArpEngine* E(MMArpEngine* e) { return reinterpret_cast<ArpEngine*>(e); }
} // namespace

extern "C" {

MMArpEngine* mmarp_create(uint32_t seed) { return reinterpret_cast<MMArpEngine*>(new ArpEngine(seed)); }
void mmarp_destroy(MMArpEngine* e) { delete E(e); }
void mmarp_prepare(MMArpEngine* e, double sampleRate, int maxBlock) {
    if (e && sampleRate > 0) E(e)->prepare(sampleRate, maxBlock > 0 ? maxBlock : 128);
}
void mmarp_process(MMArpEngine* e, float* outL, float* outR, int n) {
    if (e && outL && outR) E(e)->process(outL, outR, n);
}
void mmarp_idle(MMArpEngine* e) {
    if (e) E(e)->idle();
}

int mmarp_param_count(void) { return mmx::kAll; }
const char* mmarp_param_id(int i) { return i >= 0 && i < mmx::kAll ? mmx::allId(i) : nullptr; }
int mmarp_param_index(const char* id) { return mmx::allIndex(id); }
double mmarp_param_default(int i) {
    if (i < 0 || i >= mmx::kAll) return 0;
    return i < mmarp::kKnobs ? mmarp::kKnobDefs[i].def : mmx::kExtraDefs[i - mmarp::kKnobs].def;
}
float* mmarp_params(MMArpEngine* e) { return e ? E(e)->params() : nullptr; }
void mmarp_set_param(MMArpEngine* e, int i, double v) {
    if (e) E(e)->setParam(i, v);
}
int mmarp_knobs_known(MMArpEngine* e) { return e && E(e)->knobsKnown() ? 1 : 0; }
void mmarp_set_knobs_known(MMArpEngine* e, int on) {
    if (e) E(e)->setKnobsKnown(on != 0);
}
void mmarp_set_master_db(MMArpEngine* e, double db) {
    if (e) E(e)->setMasterDb(db);
}
void mmarp_set_arp_enabled(MMArpEngine* e, int on) {
    if (e) E(e)->setArpEnabled(on != 0);
}
void mmarp_set_clip_priority(MMArpEngine* e, int on) {
    if (e) E(e)->setClipPriority(on != 0);
}

// Le programme deja lu par le JS (bridge.ts compile) ; les bornes de parseProgram (cpp 32-99) reposees ici
void mmarp_set_program(MMArpEngine* e, double bpm, double swing, int seqEdit, int seqLen, const int32_t* seqBuf16, const int32_t* prog, int nProg,
                       const uint8_t* lanes80, const float* knobs62, const float* extras297, int hasKnobs) {
    if (!e) return;
    mmarpweb::Program p;
    const auto clampD = [](double v, double lo, double hi, double def) { return std::isfinite(v) ? std::min(hi, std::max(lo, v)) : def; };
    p.bpm = clampD(bpm, 20.0, 400.0, 120);
    p.swing = clampD(swing, 0.0, 0.5, 0);
    p.seq.edit = seqEdit != 0;
    p.seq.len = std::min(16, std::max(1, seqLen));
    for (int i = 0; i < 16; ++i) {
        const int d = seqBuf16 ? seqBuf16[i] : 0;
        p.seq.buf[i] = d == mmarp::kSeqRest ? mmarp::kSeqRest : std::min(24, std::max(-7, d));
    }
    // la progression : les indices du plugin (chordBank 2 : le JS a deja converti ceux du site, chords.ts arpProgOf)
    p.nProg = 0;
    for (int i = 0; prog && i < nProg; ++i)
        if (p.nProg < 8 && prog[i] >= 0 && prog[i] < 8) p.prog[static_cast<size_t>(p.nProg++)] = prog[i];
    if (lanes80) {
        const auto lane = [&](int k, std::array<uint8_t, 16>& dst, int lo, int hi) {
            for (int i = 0; i < 16; ++i) dst[static_cast<size_t>(i)] = static_cast<uint8_t>(std::min(hi, std::max(lo, static_cast<int>(lanes80[k * 16 + i]))));
        };
        lane(0, p.stAcc, 0, 2);
        lane(1, p.stSlide, 0, 1);
        lane(2, p.stGate, 0, 3);
        lane(3, p.stRat, 1, 4);
        lane(4, p.stProb, 0, 100);
    }
    p.hasKnobs = hasKnobs != 0;
    for (int i = 0; i < mmarp::kKnobs; ++i) {
        const double v = knobs62 ? static_cast<double>(knobs62[i]) : std::numeric_limits<double>::quiet_NaN();
        p.knobs[static_cast<size_t>(i)] = std::isfinite(v) ? std::min(1.0, std::max(0.0, v)) : mmarp::kKnobDefs[i].def;
    }
    for (int x = 0; x < mmx::kExtra; ++x) {
        const double v = extras297 ? static_cast<double>(extras297[x]) : std::numeric_limits<double>::quiet_NaN();
        p.extra[static_cast<size_t>(x)] = std::isfinite(v) ? std::min(1.0, std::max(0.0, v)) : mmx::kExtraDefs[x].def;
    }
    E(e)->setProgram(p);
}
void mmarp_run(MMArpEngine* e, int on) {
    if (e) E(e)->run(on != 0);
}
void mmarp_midi(MMArpEngine* e, int offset, int status, int d1, int d2) {
    if (e) E(e)->midi(offset, status, d1, d2);
}

const double* mmarp_telemetry(MMArpEngine* e) { return e ? reinterpret_cast<const double*>(&E(e)->telemetry()) : nullptr; }
int mmarp_telemetry_size(void) { return mmarpweb::kTelemetryN; }
void mmarp_set_spec_on(MMArpEngine* e, int on) {
    if (e) E(e)->setSpecOn(on != 0);
}
int mmarp_spec_frame(MMArpEngine* e, float* out96) { return e && out96 && E(e)->specFrame(out96) ? 1 : 0; }

void mmarp_learn(MMArpEngine* e, int index) {
    if (e) E(e)->learn(index);
}
void mmarp_unmap(MMArpEngine* e, int ch0, int cc) {
    if (e) E(e)->unmap(ch0, cc);
}
void mmarp_unmap_all(MMArpEngine* e) {
    if (e) E(e)->unmapAll();
}
void mmarp_map_set(MMArpEngine* e, int ch0, int cc, int index) {
    if (e) E(e)->mapSet(ch0, cc, index);
}
int mmarp_take_map_changed(MMArpEngine* e) { return e && E(e)->takeMapChanged() ? 1 : 0; }
int32_t* mmarp_ccmap(MMArpEngine* e) { return e ? E(e)->ccMap() : nullptr; }

int mmarp_render_clip(MMArpEngine* e, int cycles, float* outNotes, int maxNotes, int* bars) {
    int b = 0;
    const int n = e ? E(e)->renderClip(cycles, outNotes, maxNotes, b) : 0;
    if (bars) *bars = b;
    return n;
}

uint32_t mmarp_seed(MMArpEngine* e) { return e ? E(e)->seed() : 0; }
void mmarp_set_seed(MMArpEngine* e, uint32_t seed) {
    if (e) E(e)->setSeed(seed);
}
void mmarp_set_offline(MMArpEngine* e, int on) {
    if (e) E(e)->setOffline(on != 0);
}
void mmarp_set_host_position(MMArpEngine* e, int playing, double ppq, double bpm) {
    if (e) E(e)->setHostPosition(playing != 0, ppq, bpm);
}

void* mmarp_alloc(int bytes) { return bytes > 0 ? std::malloc(static_cast<size_t>(bytes)) : nullptr; }
void mmarp_free(void* p) { std::free(p); }

} // extern "C"
