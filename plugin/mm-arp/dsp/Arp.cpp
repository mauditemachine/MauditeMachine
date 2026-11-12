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

// Le sequenceur par pas du plugin (voir Arp.h)
constexpr double kAccSoft = 0.7, kAccHard = 1.35, kAccMax = 2.0, kRatAcc = 0.8, kSwingMax = 0.75;

// PROB : la note de la position pos joue-t-elle a la place (k, kk) du morceau ? Un tirage a part, par place et graine
bool probPlays(const ArpProgram& p, int pos, int64_t k, int kk, uint32_t seed) {
    const int pr = p.stepProb[pos & (ArpProgram::kSteps - 1)];
    if (pr >= 100) return true;
    if (pr <= 0) return false;
    uint32_t a = (seed ^ 0x50524F42u) + static_cast<uint32_t>(static_cast<uint64_t>(k * 2 + kk)) * 0x85EBCA6Bu;
    mulberryNext(a);
    return mulberry01(a) * 100.0 < pr;
}

bool anySlide(const ArpProgram& p) {
    for (int i = 0; i < ArpProgram::kSteps; ++i)
        if (p.stepSlide[i]) return true;
    return false;
}

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

// Le debut de la suite des mesures du meme accord (l'arpege repart de sa premiere note quand l'accord change)
int64_t Arp::runStartOf(int64_t bar, int c) const {
    const auto& pr = prog_->prog;
    const bool uniform = std::all_of(pr.begin(), pr.end(), [&](int x) { return x == pr[0]; });
    int64_t b0 = bar;
    if (uniform) b0 = std::min<int64_t>(bar, 0);
    else
        for (size_t g = 0; g < pr.size() && chordAt(b0 - 1) == c; ++g) --b0;
    return b0;
}

// Le retard des doubles croches impaires : SWING de la face + le swing propre (jusqu'a un tiers de pas en plus)
double Arp::swingOf(int s, double stepSec) const {
    if ((s & 1) == 0) return 0;
    const ArpProgram* p = prog_;
    if (!(p->swingOwn > 0)) return p->swing * stepSec;
    return std::min(kSwingMax, p->swing + std::min(1.0, p->swingOwn) / 3.0) * stepSec;
}

bool Arp::slotAt(int64_t k, int kk, int64_t k0, double stepSec, uint32_t seed, Slot& out) const {
    const ArpProgram* p = prog_;
    const int64_t bar = floorDiv(k, 16);
    const int s = static_cast<int>(k - bar * 16);
    const double spn = p->spn;
    if (spn > 1 && s % static_cast<int>(spn) != 0) return false;
    const int c = chordAt(bar);
    const ArpChord* ch = p->chord(c);
    if (!ch || ch->midi.empty()) return false;
    const int len = static_cast<int>(ch->midi.size());
    const int64_t noteIdx = (bar - runStartOf(bar, c)) * slotsInBar(spn) + slotsBefore(s, spn) + kk;
    out.rel = static_cast<double>(k - k0) * stepSec + swingOf(s, stepSec) + kk * (spn * stepSec);
    out.pos = static_cast<int>(((noteIdx % len) + len) % len);
    out.len = len;
    out.c = c;
    out.ch = ch;
    out.plays = (ch->rand || ch->midi[static_cast<size_t>(out.pos)] != kRest) && probPlays(*p, out.pos, k, kk, seed);
    return true;
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
    const double swing = swingOf(s, stepSec);
    const double interval = spn * stepSec;
    const int per = spn < 1 ? 2 : 1;
    const int len = static_cast<int>(ch->midi.size());
    if (bar != barOf_) {
        barOf_ = bar;
        runStart_ = runStartOf(bar, c);
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
        // PROB : une note qui ne joue pas est un silence (son tirage a part : celui de RAND et de DRIFT ne bouge pas)
        const int sp = pos & (ArpProgram::kSteps - 1);
        if (d != kRest && !probPlays(*p, pos, k, kk, seed)) d = kRest;
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
        double acc = std::max(0.3, (1 + (kAccent[s % 4] * (kk == 1 ? 0.85 : 1) - 1) * 2 * p->accent) * human);
        const int trAcc = p->stepAcc[sp], trGate = p->stepGate[sp];
        const int rat = std::min(4, std::max(1, static_cast<int>(p->stepRat[sp])));
        const bool slide = p->stepSlide[sp] != 0 && lastMidi_ != kRest;
        if (trAcc != 1) acc = std::min(kAccMax, std::max(0.3, acc * (trAcc == 0 ? kAccSoft : kAccHard)));
        const double from = lastMidi_ == kRest ? std::numeric_limits<double>::quiet_NaN() : static_cast<double>(lastMidi_);
        // La note suivante (son heure, si elle joue, si elle glisse) : seulement quand une piste en a besoin
        double toNext = interval;
        bool tieNext = false;
        if (trGate >= 2 || rat > 1 || anySlide(*p)) {
            Slot nx;
            const bool have = kk + 1 < per ? slotAt(k, kk + 1, k, stepSec, seed, nx) : slotAt(k + std::max<int64_t>(1, static_cast<int64_t>(spn)), 0, k, stepSec, seed, nx);
            if (have) {
                toNext = std::max(kGateMin, nx.rel - (swing + kk * interval));
                tieNext = nx.plays && p->stepSlide[nx.pos & (ArpProgram::kSteps - 1)] != 0;
            }
        }
        if (rat == 1 && trGate == 1 && !tieNext) {
            // le chemin d'avant, exactement
            const double gate = std::max(kGateMin, p->gate * interval);
            sink.noteGlide(when, d, gate, acc, from, slide ? kSlideSec : 0.0);
        } else {
            const double sub = rat == 1 ? toNext : toNext / rat; // la place de chaque repetition
            const double base = rat == 1 ? interval : sub;       // ce que GATE divise
            for (int r = 0; r < rat; ++r) {
                double g = p->gate * base;
                if (trGate == 0) g *= 0.5;
                else if (trGate == 2) g = std::min(g * 1.5, sub);
                else if (trGate >= 3) g = sub;
                g = std::max(kGateMin, g);
                if (r == rat - 1 && tieNext) g = std::max(g, sub);
                const double ar = r == 0 ? acc : std::min(kAccMax, std::max(0.3, acc * kRatAcc));
                sink.noteGlide(when + r * sub, d, g, ar, r == 0 ? from : static_cast<double>(d), r == 0 && slide ? kSlideSec : 0.0);
            }
        }
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
