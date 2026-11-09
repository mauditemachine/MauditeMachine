#include "Arp.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace mmarp {

namespace {

// Accents par double croche du temps : 1, e, et, a (voyager/arp.ts ACCENT)
constexpr double kAccent[4] = {1, 0.8, 0.92, 1.12};
// La porte la plus courte (audio/synth.ts GATE_MIN_S)
constexpr double kGateMin = 0.005;
constexpr double kStepPpq = 0.25;
// Un saut de l'hote : la position ne suit pas celle attendue (en ppq)
constexpr double kJumpPpq = 1e-3;

int64_t floorDiv(int64_t a, int64_t b) {
    int64_t q = a / b;
    if ((a % b != 0) && ((a < 0) != (b < 0))) --q;
    return q;
}

} // namespace

void Arp::prepare(double sampleRate) {
    sr_ = sampleRate > 0 ? sampleRate : 48000;
    reset();
}

void Arp::reset() {
    was_ = false;
    first_ = true;
    lastMidi_ = kRest;
    barOf_ = std::numeric_limits<int64_t>::min();
    for (auto& s : shown_) s = ArpShown{};
    shownHead_ = 0;
}

int Arp::chordAt(int64_t bar) const {
    const auto& p = prog_->prog;
    const int64_t n = static_cast<int64_t>(p.size());
    return p[static_cast<size_t>(((bar % n) + n) % n)];
}

int Arp::slotsInBar(double spn) const {
    if (spn >= 4) return 4;
    if (spn >= 2) return 8;
    if (spn >= 1) return 16;
    return 32;
}

int Arp::slotsBefore(int s, double spn) const {
    if (spn >= 4) return (s + 3) / 4;
    if (spn >= 2) return (s + 1) / 2;
    if (spn >= 1) return s;
    return 2 * s;
}

void Arp::process(ArpSink& sink, int64_t f0, int n, bool playing, double ppq, double ppqPerSample, uint32_t seed) {
    if (!playing || !(ppqPerSample > 0) || n <= 0) {
        was_ = false;
        return;
    }
    if (!was_ || std::fabs(ppq - expectPpq_) > kJumpPpq) {
        // Depart ou saut (une boucle d'Ableton, un clic dans la timeline) : ce qui etait attendu est oublie, la lecture
        // repart du premier pas a venir
        if (was_) sink.cancel(static_cast<double>(f0) / sr_);
        first_ = true;
        lastMidi_ = kRest;
        barOf_ = std::numeric_limits<int64_t>::min();
        nextStep_ = static_cast<int64_t>(std::ceil(ppq / kStepPpq - 1e-9));
    }
    was_ = true;
    const double ppqEnd = ppq + n * ppqPerSample;
    expectPpq_ = ppqEnd;
    const double stepSamples = kStepPpq / ppqPerSample;
    for (int guard = 0; guard < 4096; ++guard) {
        const double sp = static_cast<double>(nextStep_) * kStepPpq;
        if (sp >= ppqEnd) break;
        const double frame = static_cast<double>(f0) + (sp - ppq) / ppqPerSample;
        step(sink, nextStep_, std::max(static_cast<double>(f0), frame), stepSamples, seed);
        ++nextStep_;
    }
}

void Arp::step(ArpSink& sink, int64_t k, double frame, double stepSamples, uint32_t seed) {
    const int64_t bar = floorDiv(k, 16);
    const int s = static_cast<int>(k - bar * 16);
    const double stepSec = stepSamples / sr_;
    const double t = frame / sr_;
    // MOD cale sur la mesure : la place de ce pas en temps, a chaque pas (synthBeat), RUN au premier
    sink.beat(t, static_cast<double>(k) / 4.0, 60.0 / (4.0 * stepSec), first_);
    first_ = false;
    const ArpProgram* p = prog_;
    if (!p || p->prog.empty()) return;
    const int c = chordAt(bar);
    const ArpChord* ch = p->chord(c);
    if (!ch || ch->midi.empty()) return;
    const double spn = p->spn;
    if (spn > 1 && s % static_cast<int>(spn) != 0) return;
    const double swing = (s & 1) == 1 ? p->swing * stepSec : 0;
    const double interval = spn * stepSec;
    const int per = spn < 1 ? 2 : 1;
    const int len = static_cast<int>(ch->midi.size());
    // Le debut de la suite des mesures du meme accord (l'arpege repart de sa premiere note quand l'accord change)
    if (bar != barOf_) {
        barOf_ = bar;
        const auto& pr = p->prog;
        const bool uniform = std::all_of(pr.begin(), pr.end(), [&](int x) { return x == pr[0]; });
        int64_t b0 = bar;
        if (uniform) b0 = std::min<int64_t>(bar, 0);
        else
            for (size_t g = 0; g < pr.size() && chordAt(b0 - 1) == c; ++g) --b0;
        runStart_ = b0;
    }
    int64_t noteIdx = (bar - runStart_) * slotsInBar(spn) + slotsBefore(s, spn);
    const int nProg = static_cast<int>(p->prog.size());
    const int slot = static_cast<int>(((bar % nProg) + nProg) % nProg);
    for (int kk = 0; kk < per; ++kk) {
        const double when = t + swing + kk * interval;
        const int pos = static_cast<int>(((noteIdx % len) + len) % len);
        ++noteIdx;
        // Le hasard de cette position (RAND, DRIFT) : le meme a chaque lecture
        uint32_t a = seed ^ (static_cast<uint32_t>(static_cast<uint64_t>(k * 2 + kk)) * 0x9E3779B1u);
        mulberryNext(a);
        int d;
        if (ch->rand) {
            int pick = static_cast<int>(std::floor(mulberry01(a) * len));
            pick = std::min(std::max(pick, 0), len - 1);
            if (len > 1 && ch->midi[static_cast<size_t>(pick)] == lastMidi_) pick = (pick + 1) % len;
            d = ch->midi[static_cast<size_t>(pick)];
        } else {
            d = ch->midi[static_cast<size_t>(pos)];
        }
        ArpShown& sh = shown_[shownHead_];
        shownHead_ = (shownHead_ + 1) % kShown;
        sh.frame = static_cast<int64_t>(std::llround(when * sr_));
        sh.slot = slot;
        sh.pos = pos;
        sh.len = len;
        sh.chord = c;
        sh.midi = d == kRest ? -1 : d;
        // Un silence de la suite : rien ne part, le glissement repartira de la derniere note
        if (d == kRest) continue;
        const double human = 1 + (mulberry01(a) - 0.5) * 0.16 * p->drift;
        const double acc = std::max(0.3, (1 + (kAccent[s % 4] * (kk == 1 ? 0.85 : 1) - 1) * 2 * p->accent) * human);
        const double gate = std::max(kGateMin, p->gate * interval);
        sink.note(when, d, gate, acc, lastMidi_ == kRest ? std::numeric_limits<double>::quiet_NaN() : static_cast<double>(lastMidi_));
        lastMidi_ = d;
    }
}

ArpShown Arp::shownAt(int64_t frame) const {
    ArpShown best;
    bool have = false;
    for (const auto& s : shown_) {
        if (s.len == 0 || s.frame > frame) continue;
        if (!have || s.frame >= best.frame) {
            best = s;
            have = true;
        }
    }
    return best;
}

} // namespace mmarp
