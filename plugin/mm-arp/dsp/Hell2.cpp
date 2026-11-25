// MM-ARP, HELL v2 : la descente en six cercles (voir Hell2.h). Porte du prototype hors ligne de la maquette v44
// (tests/hell2_proto.cpp), avec : l'horloge de l'hote (ppq), les constantes ramenees au taux d'echantillonnage, aucune
// allocation dans process, MIX qui glisse et contourne au bit pres, le niveau mesure sur le chemin HELL seul.
#include "Hell2.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace mmarp {

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kCeilKnee = 0.7943282347242815; // -2 dBFS : lineaire jusque-la
constexpr double kCeilTop = 0.8912509381337456;  // -1 dBFS : jamais au-dessus
constexpr double kPeriodBeats = 32;              // les tirages recommencent toutes les 8 mesures
inline double clamp01(double v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
inline int stepOf(double v, int n) {
    if (n <= 1) return 0;
    const int i = static_cast<int>(std::lround(v * (n - 1)));
    return i < 0 ? 0 : i > n - 1 ? n - 1 : i;
}
inline uint32_t hash32(uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}
inline double rnd01(uint32_t k) { return (hash32(k) & 0xffffff) / 16777216.0; }
inline double smooth01(double x) {
    x = clamp01(x);
    return x * x * (3 - 2 * x);
}
inline double flush(double x) { return std::fabs(x) < 1e-25 ? 0.0 : x; }
// un coefficient de lissage par echantillon donne a 48 kHz, ramene au taux
inline double at48(double k, double sr) { return 1 - std::pow(1 - k, 48000.0 / sr); }
// le numero d'une case ramene a la periode des tirages (8 mesures), toujours positif
inline uint32_t keyOf(int64_t idx, double unitBeats) {
    const int64_t per = std::max<int64_t>(1, static_cast<int64_t>(std::llround(kPeriodBeats / unitBeats)));
    return static_cast<uint32_t>(((idx % per) + per) % per);
}
inline double ceilSoft(double v) {
    const double a = std::fabs(v);
    if (a <= kCeilKnee) return v;
    const double span = kCeilTop - kCeilKnee;
    const double o = kCeilKnee + span * std::tanh((a - kCeilKnee) / span);
    return v < 0 ? -o : o;
}
} // namespace

const char* const Hell2::kKeyIds[Hell2::kKeys] = {
    "xHellSync", "xHellTime", "xHellFb", "xHellCross", "xHellRange", "xHellShift", "xHellUpDown", "xHellSpread", "xHellPhase", "xHellAntiRefl",
    "xHellSmear", "xHellHp", "xHellLp", "xHellLfoShape", "xHellLfoSync", "xHellLfoRate", "xHellLfoAmt", "xHellLfoStereo", "xHellLfoTarget",
    "xHellLfoDepth", "xHellTone", "xHellWarp", "xHellWarpRate", "xHellWarpShape", "xHellSpin", "xHellSpinRate", "xHellDrunk", "xHellSweep",
    "xHellShatter", "xHellShatterSize", "xHellShatterSpray", "xHellChop", "xHellChopGrid", "xHellChopPitch", "xHellChopGate", "xHellRing",
    "xHellRingTune", "xHellComb", "xHellCombSeq", "xHellDescent"};
const int Hell2::kKeySteps[Hell2::kKeys] = {14, 0, 0, 2, 4, 0, 0, 0, 0, 2, 0, 0, 0, 4, 2, 0, 0, 2, 4, 0, 0,
                                            0, 7, 5, 0, 7, 0, 0, 0, 5, 0, 0, 7, 0, 0, 0, 6, 0, 5, 2};
const double Hell2::kRateBeats[7] = {0.25, 0.5, 1, 2, 4, 8, 16};
const double Hell2::kChopBeats[7] = {1.0 / 16, 1.0 / 8, 1.0 / 6, 1.0 / 4, 1.0 / 3, 1.0 / 2, 1};
const double Hell2::kGrainBeats[5] = {1.0 / 16, 1.0 / 8, 1.0 / 4, 1.0 / 2, 1};
const double Hell2::kEntry[Hell2::kCircles] = {0, 0.1, 0.22, 0.36, 0.5, 0.64};

double Hell2::depth(int circle, double m, int mode) {
    if (m <= 0) return 0;
    if (mode == 1) return std::min(1.0, m);
    const double e = kEntry[circle];
    return smooth01((m - e) / std::max(1e-6, 1 - e));
}

Hell2Settings Hell2::settingsOf(const double* v, double mix, double bpm, double noteHz) {
    const auto st = [&](int k) { return stepOf(v[k], kKeySteps[k]); };
    Hell2Settings s;
    HellSettings& e = s.echo;
    // I ECHO : les lois de Hell.cpp, comme l'ancien moteur dans PluginProcessor.cpp
    e.mix = 0.5;
    e.sync = st(kSync);
    e.timeMs = Hell::timeMsOf(v[kTime]);
    e.feedback = v[kFb];
    e.cross = st(kCross) == 1;
    e.shiftHz = Hell::shiftHzFor(v[kShift], st(kRange), bpm, noteHz);
    e.upDown = v[kUpDown];
    e.spread = v[kSpread];
    e.phase = v[kPhase];
    e.antiRefl = st(kAntiRefl) == 1;
    e.smear = v[kSmear];
    e.hpHz = Hell::hpHzOf(v[kHp]);
    e.lpHz = Hell::lpHzOf(v[kLp]);
    e.lfoHz = st(kLfoSync) == 1 ? Hell::lfoSyncHz(v[kLfoRate], bpm) : Hell::lfoHzOf(v[kLfoRate]);
    e.lfoDepthHz = Hell::lfoDepthHzOf(v[kLfoDepth]);
    e.lfoShape = st(kLfoShape);
    e.lfoAmt = 2 * v[kLfoAmt] - 1;
    e.lfoStereo = st(kLfoStereo) == 1;
    e.lfoTarget = st(kLfoTarget);
    e.tone = v[kTone];
    // II a VI
    s.mix = clamp01(mix);
    s.descent = st(kDescent);
    s.warp = clamp01(v[kWarp]);
    s.warpRate = st(kWarpRate);
    s.warpShape = st(kWarpShape);
    s.spin = clamp01(v[kSpin]);
    s.spinRate = st(kSpinRate);
    s.drunk = clamp01(v[kDrunk]);
    s.sweep = clamp01(v[kSweep]);
    s.shatter = clamp01(v[kShatter]);
    s.shatterSize = st(kShatterSize);
    s.spray = clamp01(v[kShatterSpray]);
    s.chop = clamp01(v[kChop]);
    s.chopGrid = st(kChopGrid);
    s.chopSemis = static_cast<int>(std::lround(24 * (clamp01(v[kChopPitch]) - 0.5)));
    s.chopGate = clamp01(v[kChopGate]);
    s.ring = clamp01(v[kRing]);
    s.ringTune = st(kRingTune);
    s.comb = clamp01(v[kComb]);
    s.combSeq = st(kCombSeq);
    return s;
}

/* ---------------- les lignes ---------------- */

void Hell2::Line::alloc(double samples) {
    int n = 1;
    while (n < samples + 8) n <<= 1;
    b.assign(static_cast<size_t>(n), 0.f);
    m = n - 1;
    w = 0;
}

void Hell2::Line::clear() {
    std::fill(b.begin(), b.end(), 0.f);
    w = 0;
}

double Hell2::Line::read(double d) const {
    d = std::max(2.0, std::min(static_cast<double>(m - 4), d));
    const int di = static_cast<int>(d);
    const double f = d - di;
    const auto at = [&](int k) { return static_cast<double>(b[static_cast<size_t>((w - k) & m)]); };
    const double y0 = at(di - 1), y1 = at(di), y2 = at(di + 1), y3 = at(di + 2);
    const double c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    return ((c3 * f + c2) * f + c1) * f + y1;
}

/* ---------------- la preparation ---------------- */

void Hell2::prepare(double sampleRate) {
    sr_ = sampleRate > 0 ? sampleRate : 48000;
    echo_.prepare(sr_);
    // une case CHOP de 1/4 a 20 BPM : 3 s
    capN_ = static_cast<int>(std::ceil(3.2 * sr_)) + 8;
    for (int c = 0; c < 2; ++c) {
        rec_[static_cast<size_t>(c)].assign(static_cast<size_t>(capN_), 0.f);
        cap_[static_cast<size_t>(c)].assign(static_cast<size_t>(capN_), 0.f);
        wl_[static_cast<size_t>(c)].alloc(4.6 * sr_);
        gl_[static_cast<size_t>(c)].alloc(2.4 * sr_);
        comb_[static_cast<size_t>(c)].alloc(0.06 * sr_);
        ch_[static_cast<size_t>(c)].alloc(0.05 * sr_);
    }
    kComb_ = at48(0.002, sr_);
    kW1_ = at48(0.0004, sr_);
    kW2_ = at48(0.0008, sr_);
    kPull_ = at48(0.00002, sr_);
    aRms_ = 1 - std::exp(-1 / (0.3 * sr_));
    rel_ = std::exp(-1 / (0.15 * sr_));
    hold_ = std::exp(-1 / (3.0 * sr_));
    gDown_ = 1 / (0.03 * sr_);
    gUp_ = 1 / (0.5 * sr_);
    dcR_ = std::exp(-2 * kPi * 10 / sr_);
    on_ = false;
    m_ = mTgt_ = mStep_ = 0;
    tick_ = tickBase_ = 0;
    beatBase_ = 0;
    bps_ = 0;
    anchored_ = false;
    reset();
}

void Hell2::reset() {
    echo_.reset();
    // (rec_ et cap_ ne sont pas vides : une case est enregistree en entier avant d'etre rejouee)
    for (int c = 0; c < 2; ++c) {
        wl_[static_cast<size_t>(c)].clear();
        gl_[static_cast<size_t>(c)].clear();
        comb_[static_cast<size_t>(c)].clear();
        ch_[static_cast<size_t>(c)].clear();
        for (int v = 0; v < 3; ++v) walk_[c][v] = walkV_[c][v] = 0;
        sv1_[c] = sv2_[c] = 0;
        dc_[c] = dcX_[c] = 0;
    }
    recLen_ = capLen_ = 0;
    chopSlot_ = INT64_MIN;
    chopRep_ = chopFresh_ = false;
    chopCount_ = 0;
    chopPos_ = oldPos_ = 0;
    chopRatio_ = oldRatio_ = 1;
    chopGain_ = 1;
    oldGain_ = 0;
    oldRep_ = false;
    chopXf_ = 1;
    chopNow_ = 0;
    wd_ = wdOld_ = 2.5;
    wXf_ = 1;
    wCycle_ = INT64_MIN;
    wRandFrom_ = wRandTo_ = 0;
    for (auto& g : grains_) g = Grain{};
    gHop_ = INT64_MIN;
    combP_ = combPT_ = 100;
    combNh_ = 0;
    combBeat_ = INT64_MIN;
    ringPh_ = 0;
    eIn_ = pIn_ = eRef_ = pRef_ = eY_ = pY_ = 0;
    gain_ = 1;
    latched_ = false;
    chunkM_ = 0;
}

void Hell2::set(const Hell2Settings& s, double bpm) {
    s_ = s;
    bpm_ = std::max(20.0, bpm);
    const double m = clamp01(s.mix);
    if (m != mTgt_) {
        mTgt_ = m;
        mStep_ = (mTgt_ - m_) / (0.02 * sr_);
    }
}

void Hell2::stop() {
    on_ = false;
    m_ = mTgt_ = mStep_ = 0;
}

void Hell2::activate() {
    reset();
    on_ = true;
}

double Hell2::beatNow() const { return beatAt(tick_); }

/* ---------------- V CHOP ---------------- */

void Hell2::runChop(int n, uint64_t t0, double bps) {
    const double amt = chopNow_;
    if (amt <= 0 && !chopRep_ && chopXf_ >= 1) {
        chopSlot_ = INT64_MIN; // revenu : la premiere case (entamee) passe
        return;
    }
    const double slotB = kChopBeats[s_.chopGrid];
    const double slotLen = std::min(static_cast<double>(capN_ - 4), slotB / bps);
    const double gateEnd = std::max(0.05, s_.chopGate) * slotLen;
    const double xfInc = 1.0 / (0.003 * sr_);
    const double fadeG = 1.0 / (0.002 * sr_);
    float* y[2] = {y_[0].data(), y_[1].data()};
    const auto readCap = [&](int c, double p) {
        const long k0 = static_cast<long>(p);
        const double f = p - static_cast<double>(k0);
        const std::vector<float>& b = cap_[static_cast<size_t>(c)];
        const long k1 = k0 + 1 < capLen_ ? k0 + 1 : 0;
        return b[static_cast<size_t>(k0)] * (1 - f) + b[static_cast<size_t>(k1)] * f;
    };
    for (int j = 0; j < n; ++j) {
        const double beat = beatAt(t0 + static_cast<uint64_t>(j));
        const double sf = std::floor(beat / slotB);
        const int64_t slot = static_cast<int64_t>(sf);
        const double inSlot = (beat - sf * slotB) / bps; // en echantillons
        if (slot != chopSlot_) {
            const bool fresh = chopSlot_ == INT64_MIN;
            // la case d'avant enregistree en entier (une case entamee au depart, ou apres un saut de l'hote : non)
            const bool whole = !fresh && !chopFresh_ && slot == chopSlot_ + 1 && static_cast<double>(recLen_) >= 0.9 * slotLen;
            chopFresh_ = fresh;
            bool rep = !fresh && rnd01(keyOf(slot, slotB) * 2654435761u + 17u) < amt;
            if (rep && !chopRep_ && !whole) rep = false;
            const bool change = rep || chopRep_;
            oldRep_ = chopRep_;
            oldPos_ = chopPos_;
            oldRatio_ = chopRatio_;
            oldGain_ = chopGain_;
            if (rep && !chopRep_) {
                // la case d'avant (en direct) devient la boucle
                capLen_ = std::min(recLen_, static_cast<long>(capN_));
                for (int c = 0; c < 2; ++c)
                    std::memcpy(cap_[static_cast<size_t>(c)].data(), rec_[static_cast<size_t>(c)].data(), static_cast<size_t>(capLen_) * sizeof(float));
                chopCount_ = 0;
            }
            chopCount_ = rep ? chopCount_ + 1 : 0;
            chopRep_ = rep;
            chopSlot_ = slot;
            recLen_ = 0;
            chopXf_ = change ? 0 : 1;
            if (rep) {
                const int semis = std::max(-24, std::min(24, chopCount_ * s_.chopSemis));
                chopRatio_ = std::pow(2.0, semis / 12.0);
                chopPos_ = 0;
                chopGain_ = 1;
            }
        }
        if (recLen_ < capN_) {
            rec_[0][static_cast<size_t>(recLen_)] = y[0][j];
            rec_[1][static_cast<size_t>(recLen_)] = y[1][j];
            ++recLen_;
        }
        double o[2] = {y[0][j], y[1][j]};
        if (chopRep_ && capLen_ > 8) {
            // GATE : la repetition s'arrete avant la fin de la case (fondu de 2 ms)
            chopGain_ = inSlot > gateEnd ? std::max(0.0, 1 - (inSlot - gateEnd) * fadeG) : 1.0;
            for (int c = 0; c < 2; ++c) o[c] = readCap(c, chopPos_) * chopGain_;
            chopPos_ += chopRatio_;
            if (chopPos_ >= static_cast<double>(capLen_)) chopPos_ = std::fmod(chopPos_, static_cast<double>(capLen_));
        }
        if (chopXf_ < 1) {
            // le fondu de 3 ms : la voix d'avant continue sous la nouvelle
            double old[2] = {y[0][j], y[1][j]};
            if (oldRep_ && capLen_ > 8) {
                for (int c = 0; c < 2; ++c) old[c] = readCap(c, oldPos_) * oldGain_;
                oldPos_ += oldRatio_;
                if (oldPos_ >= static_cast<double>(capLen_)) oldPos_ = std::fmod(oldPos_, static_cast<double>(capLen_));
            }
            for (int c = 0; c < 2; ++c) o[c] = chopXf_ * o[c] + (1 - chopXf_) * old[c];
            chopXf_ += xfInc;
        }
        y[0][j] = static_cast<float>(o[0]);
        y[1][j] = static_cast<float>(o[1]);
    }
}

/* ---------------- II WARP ---------------- */

void Hell2::runWarp(int n, uint64_t t0, double bps, double dWarp) {
    float* y[2] = {y_[0].data(), y_[1].data()};
    if (s_.warp <= 0) {
        for (int j = 0; j < n; ++j)
            for (int c = 0; c < 2; ++c) wl_[static_cast<size_t>(c)].push(y[c][j]);
        return;
    }
    const double wSt = 12 * s_.warp * s_.warp * dWarp;
    const int shape = s_.warpShape;
    const double wB = kRateBeats[s_.warpRate];
    const double C = wB / bps; // echantillons par cycle
    const double base = 2.5;
    const double maxD = 4.3 * sr_;
    const double A = std::min(1.9 * sr_, (std::pow(2.0, wSt / 12) - 1) * C / (2 * kPi));
    const double pullTo = base + 0.02 * sr_ * std::min(1.0, wSt);
    const double xfInc = 1.0 / (0.008 * sr_);
    for (int j = 0; j < n; ++j) {
        for (int c = 0; c < 2; ++c) wl_[static_cast<size_t>(c)].push(y[c][j]);
        const double beat = beatAt(t0 + static_cast<uint64_t>(j));
        const double cf = std::floor(beat / wB);
        const int64_t cyc = static_cast<int64_t>(cf);
        const double ph = beat / wB - cf;
        double d;
        if (shape == 0) {
            // WOBBLE : un retard sinusoidal, la hauteur va de -st a +st
            d = base + A * (1 - std::sin(2 * kPi * ph));
            wd_ = d;
        } else {
            if (cyc != wCycle_) {
                // un cycle neuf : DROP et STOP repartent du retard minimal (fondu de 8 ms)
                if (shape == 2 || shape == 3) {
                    wdOld_ = wd_;
                    wd_ = base;
                    wXf_ = 0;
                }
                wRandFrom_ = wRandTo_;
                wRandTo_ = 2 * rnd01(keyOf(cyc, wB) * 7919u + 3u) - 1;
                wCycle_ = cyc;
            }
            double rate;
            if (shape == 3) rate = ph < 0.75 ? 1.0 : std::max(0.0, 1 - (wSt / 12) * (ph - 0.75) / 0.25); // STOP
            else {
                double semis;
                if (shape == 1) semis = wSt * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph); // BEND : triangle
                else if (shape == 2) semis = -wSt * ph;                           // DROP
                else semis = wSt * (wRandFrom_ + (wRandTo_ - wRandFrom_) * smooth01(ph / 0.35)); // RANDOM
                rate = std::exp2(semis / 12);
            }
            wd_ += 1 - rate;
            if (shape == 1 || shape == 4) wd_ += (pullTo - wd_) * kPull_; // la derive ramenee
            wd_ = std::max(base, std::min(maxD, wd_));
            d = wd_;
        }
        for (int c = 0; c < 2; ++c) {
            double o = wl_[static_cast<size_t>(c)].read(d);
            if (wXf_ < 1) o = wXf_ * o + (1 - wXf_) * wl_[static_cast<size_t>(c)].read(wdOld_);
            y[c][j] = static_cast<float>(o);
        }
        if (wXf_ < 1) wXf_ = std::min(1.0, wXf_ + xfInc);
    }
}

/* ---------------- IV SHATTER ---------------- */

void Hell2::runShatter(int n, uint64_t t0, double bps, double dSh) {
    float* y[2] = {y_[0].data(), y_[1].data()};
    if (s_.shatter <= 0) {
        for (int j = 0; j < n; ++j)
            for (int c = 0; c < 2; ++c) gl_[static_cast<size_t>(c)].push(y[c][j]);
        for (auto& g : grains_) g.on = false;
        gHop_ = INT64_MIN;
        return;
    }
    static const double RAT[5] = {1, 2, 0.5, 1.5, 0.75};
    const double gAmt = s_.shatter * dSh;
    const double gLen = std::min(0.6 * sr_, std::max(0.012 * sr_, kGrainBeats[s_.shatterSize] / bps));
    const double hopB = 0.5 * gLen * bps; // temps par demi-grain
    const double spray = s_.spray;
    const double w0 = 2 * kPi / gLen;
    for (int j = 0; j < n; ++j) {
        for (int c = 0; c < 2; ++c) gl_[static_cast<size_t>(c)].push(y[c][j]);
        const double beat = beatAt(t0 + static_cast<uint64_t>(j));
        const int64_t hop = static_cast<int64_t>(std::floor(beat / hopB));
        if (hop != gHop_) {
            gHop_ = hop;
            for (auto& g : grains_)
                if (!g.on) {
                    const uint32_t k = keyOf(hop, hopB);
                    const double r1 = rnd01(k * 31 + 1), r2 = rnd01(k * 31 + 2), r3 = rnd01(k * 31 + 3), r4 = rnd01(k * 31 + 4), r5 = rnd01(k * 31 + 5);
                    const int ri = r1 < 1 - spray ? 0 : 1 + static_cast<int>(r2 * 4) % 4;
                    g = Grain{};
                    g.on = true;
                    g.len = gLen;
                    g.rate = RAT[ri];
                    g.rev = r3 < 0.45 * spray;
                    g.pos = gLen * std::max(1.0, g.rate) + 0.02 * sr_ + r4 * 0.25 * sr_ * spray; // en arriere
                    const double pan = (r5 * 2 - 1) * spray;
                    g.gl = std::sqrt(0.5 * (1 - pan)) * 1.414;
                    g.gr = std::sqrt(0.5 * (1 + pan)) * 1.414;
                    break;
                }
        }
        double o[2] = {0, 0};
        for (auto& g : grains_) {
            if (!g.on) continue;
            const double w = 0.5 - 0.5 * std::cos(w0 * g.t);
            const double off = g.rev ? g.pos - g.len * g.rate + g.t * (1 + g.rate) : g.pos + g.t * (1 - g.rate);
            o[0] += gl_[0].read(off) * w * g.gl;
            o[1] += gl_[1].read(off) * w * g.gr;
            g.t += 1;
            if (g.t >= g.len) g.on = false;
        }
        for (int c = 0; c < 2; ++c) y[c][j] = static_cast<float>((1 - gAmt) * y[c][j] + gAmt * o[c]);
    }
}

/* ---------------- VI METAL ---------------- */

void Hell2::runMetal(int n, uint64_t t0, double bps, double dMetal, double noteHz) {
    float* y[2] = {y_[0].data(), y_[1].data()};
    const double ra = s_.ring * dMetal, ca = s_.comb * dMetal;
    if (ra <= 0 && s_.comb <= 0) return;
    const double nh = noteHz > 0 ? noteHz : 220;
    static const double TUNE_MUL[4] = {1, 1.5, 2, 0.5};
    const int tune = s_.ringTune;
    const double fr = tune < 4 ? nh * TUNE_MUL[tune] : 0;
    const double perBeat = tune == 4 ? 8 : 32;
    static const int SEQ[4][8] = {{0, 12, 0, -12, 0, 12, 24, 12}, {0, 7, 12, 7, 0, 7, 12, 19}, {0, 3, 7, 10, 12, 10, 7, 3}, {0, 1, 2, 3, 4, 5, 6, 7}};
    const double g = 0.55 + 0.35 * s_.comb;
    for (int j = 0; j < n; ++j) {
        const double beat = beatAt(t0 + static_cast<uint64_t>(j));
        if (ra > 0) {
            double cr;
            if (tune < 4) {
                ringPh_ += fr / sr_;
                ringPh_ -= std::floor(ringPh_);
                cr = std::cos(2 * kPi * ringPh_);
            } else {
                const double b = beat * perBeat;
                cr = std::cos(2 * kPi * (b - std::floor(b)));
            }
            for (int c = 0; c < 2; ++c) y[c][j] = static_cast<float>((1 - ra) * y[c][j] + ra * y[c][j] * cr * 1.414);
        }
        if (s_.comb > 0) {
            const int64_t bi = static_cast<int64_t>(std::floor(beat));
            if (bi != combBeat_ || nh != combNh_) {
                combBeat_ = bi;
                combNh_ = nh;
                const uint32_t k = keyOf(bi, 1);
                const int semi = s_.combSeq < 4 ? SEQ[s_.combSeq][k % 8] : static_cast<int>(rnd01(k * 13 + 5) * 13);
                double fc = nh * std::pow(2.0, semi / 12.0);
                while (fc < 110) fc *= 2;
                while (fc > 1800) fc /= 2;
                combPT_ = sr_ / fc;
            }
            combP_ += (combPT_ - combP_) * kComb_;
            for (int c = 0; c < 2; ++c) {
                // le peigne a reinjection : y = x + g y[n - P]
                Line& L = comb_[static_cast<size_t>(c)];
                const double cy = y[c][j] + g * L.read(combP_);
                L.push(flush(cy));
                y[c][j] = static_cast<float>((1 - ca) * y[c][j] + ca * cy * (1 - g) * 1.6);
            }
        }
    }
}

/* ---------------- III SPIN ---------------- */

void Hell2::runSpin(int n, uint64_t t0, double bps, double dSpin) {
    float* y[2] = {y_[0].data(), y_[1].data()};
    const double sp = s_.spin * dSpin, dr = s_.drunk * dSpin, sw = s_.sweep * dSpin;
    if (s_.drunk <= 0 && s_.sweep <= 0 && sp <= 0) return;
    const double sB = kRateBeats[s_.spinRate];
    const double msS = sr_ / 1000;
    for (int j = 0; j < n; ++j) {
        const double beat = beatAt(t0 + static_cast<uint64_t>(j));
        const double ph = beat / sB - std::floor(beat / sB);
        if (s_.drunk > 0) {
            // le chorus ivre : trois voix, une marche aleatoire lissee, un pas par double-croche
            const uint32_t k = keyOf(static_cast<int64_t>(std::floor(beat * 4)), 0.25);
            for (int c = 0; c < 2; ++c) {
                Line& L = ch_[static_cast<size_t>(c)];
                L.push(y[c][j]);
                double o = 0;
                for (int v = 0; v < 3; ++v) {
                    const double target = rnd01(k * 7 + static_cast<uint32_t>(v * 101 + c * 997)) * 2 - 1;
                    walkV_[c][v] += (target - walkV_[c][v]) * kW1_;
                    walk_[c][v] += (walkV_[c][v] - walk_[c][v]) * kW2_;
                    const double dms = 9 + v * 4 + walk_[c][v] * 7 * dr;
                    o += L.read(dms * msS);
                }
                y[c][j] = static_cast<float>((1 - 0.6 * dr) * y[c][j] + 0.6 * dr * o / 1.7);
            }
        }
        if (s_.sweep > 0) {
            // le passe-bas resonant (SVF, Q 3.2) qui balaie de 250 Hz a 11 kHz au rythme de SPIN RATE
            const double fc = 250 * std::exp2(5.5 * (0.5 - 0.5 * std::cos(2 * kPi * ph)));
            const double gg = std::tan(kPi * std::min(fc, 0.45 * sr_) / sr_), k = 1 / 3.2;
            const double a1 = 1 / (1 + gg * (gg + k)), a2 = gg * a1, a3 = gg * a2;
            for (int c = 0; c < 2; ++c) {
                const double x = y[c][j];
                const double v3 = x - sv2_[c], v1 = a1 * sv1_[c] + a2 * v3, v2 = sv2_[c] + a2 * sv1_[c] + a3 * v3;
                sv1_[c] = 2 * v1 - sv1_[c];
                sv2_[c] = 2 * v2 - sv2_[c];
                y[c][j] = static_cast<float>((1 - sw) * x + sw * v2 * 0.8);
            }
        }
        if (sp > 0) {
            // le panoramique qui tournoie (puissance constante sur le milieu, le cote garde)
            const double th = kPi / 4 * (1 + sp * std::sin(2 * kPi * ph));
            const double mid = 0.5 * (y[0][j] + y[1][j]), side = 0.5 * (y[0][j] - y[1][j]);
            y[0][j] = static_cast<float>(mid * std::cos(th) * 1.4142135623730951 + side);
            y[1][j] = static_cast<float>(mid * std::sin(th) * 1.4142135623730951 - side);
        }
    }
}

/* ---------------- le bloc ---------------- */

void Hell2::process(float* L, float* R, int n, double ppq, bool playing, double noteHz) {
    // l'horloge : la position de l'hote quand il joue (recalee s'il saute ou change de tempo), sinon la sienne
    const double bps = bpm_ / 60.0 / sr_;
    const double pred = beatNow();
    if (playing) {
        if (!anchored_ || std::fabs(ppq - pred) > 1e-3 || bps != bps_) {
            beatBase_ = ppq;
            tickBase_ = tick_;
            bps_ = bps;
            anchored_ = true;
        }
    } else if (bps != bps_) {
        beatBase_ = pred;
        tickBase_ = tick_;
        bps_ = bps;
    }
    if (!on_) {
        if (mTgt_ <= 0) {
            tick_ += static_cast<uint64_t>(n);
            return; // contourne au bit pres
        }
        activate();
    }
    float* io[2] = {L, R};
    int i = 0;
    while (i < n) {
        const int len = std::min(n - i, kChunk - static_cast<int>(tick_ % kChunk));
        const uint64_t t0 = tick_;
        // la part de chaque cercle a la position de MIX, prise au debut de la tranche de 64 (meme coupee par l'hote)
        if (tick_ % kChunk == 0 || !latched_) {
            chunkM_ = m_;
            latched_ = true;
        }
        const double m = chunkM_;
        const int mode = s_.descent;
        const double dEcho = std::min(1.0, 2 * m);
        for (int c = 0; c < 2; ++c) std::memcpy(y_[static_cast<size_t>(c)].data(), io[c] + i, static_cast<size_t>(len) * sizeof(float));
        // V CHOP (sur l'entree)
        chopNow_ = s_.chop * depth(kChopC, m, mode);
        runChop(len, t0, bps_);
        // I ECHO (Hell.cpp : sec et mouille pleins, sa reinjection monte avec MIX)
        {
            HellSettings e = s_.echo;
            e.mix = 0.5;
            e.feedback *= 0.6 + 0.4 * dEcho;
            echo_.set(e, bpm_);
            echo_.process(y_[0].data(), y_[1].data(), len);
        }
        runWarp(len, t0, bps_, depth(kWarpC, m, mode));
        runShatter(len, t0, bps_, depth(kShatterC, m, mode));
        runMetal(len, t0, bps_, depth(kMetalC, m, mode), noteHz);
        runSpin(len, t0, bps_, depth(kSpinC, m, mode));
        // le niveau, MIX, le plafond
        for (int j = 0; j < len; ++j) {
            if (mStep_ != 0) {
                m_ += mStep_;
                if ((mStep_ > 0 && m_ >= mTgt_) || (mStep_ < 0 && m_ <= mTgt_)) {
                    m_ = mTgt_;
                    mStep_ = 0;
                }
            }
            const double part = std::min(1.0, 2 * m_);
            const double x0 = io[0][i + j], x1 = io[1][i + j];
            eIn_ += (0.5 * (x0 * x0 + x1 * x1) - eIn_) * aRms_;
            pIn_ = std::max(std::max(std::fabs(x0), std::fabs(x1)), pIn_ * rel_);
            // la reference de l'entree garde sa memoire 3 s : une queue d'echos n'est pas coupee quand les notes s'arretent
            eRef_ = std::max(eIn_, eRef_ * hold_);
            pRef_ = std::max(pIn_, pRef_ * hold_);
            double yd[2];
            for (int c = 0; c < 2; ++c) {
                // un passe-haut de 10 Hz sur le chemin HELL (WARP et les grains peuvent pousser du continu)
                const double yv = y_[static_cast<size_t>(c)][static_cast<size_t>(j)];
                dc_[c] = yv - dcX_[c] + dcR_ * dc_[c];
                dcX_[c] = yv;
                yd[c] = dc_[c];
            }
            eY_ += (0.5 * (yd[0] * yd[0] + yd[1] * yd[1]) - eY_) * aRms_;
            pY_ = std::max(std::max(std::fabs(yd[0]), std::fabs(yd[1])), pY_ * rel_);
            const double want = std::min({1.58, 1.26 * std::sqrt((eRef_ + 1e-9) / (eY_ + 1e-9)), 1.41 * (pRef_ + 1e-6) / (pY_ + 1e-6)});
            gain_ += (want - gain_) * (want < gain_ ? gDown_ : gUp_);
            // le plafond entre avec MIX (plein des 2.5 %) : a MIX 0 la sortie rejoint l'entree sans saut
            const double ck = std::min(1.0, 20 * part);
            const double xs[2] = {x0, x1};
            for (int c = 0; c < 2; ++c) {
                const double v = (1 - part) * xs[c] + part * gain_ * yd[c];
                io[c][i + j] = static_cast<float>(v + ck * (ceilSoft(v) - v));
            }
        }
        // sans sous-normaux ; un etat devenu non fini repart de zero
        for (int c = 0; c < 2; ++c) {
            sv1_[c] = flush(sv1_[c]);
            sv2_[c] = flush(sv2_[c]);
            dc_[c] = flush(dc_[c]);
            dcX_[c] = flush(dcX_[c]);
            for (int v = 0; v < 3; ++v) {
                walk_[c][v] = flush(walk_[c][v]);
                walkV_[c][v] = flush(walkV_[c][v]);
            }
        }
        eIn_ = flush(eIn_);
        eY_ = flush(eY_);
        pIn_ = flush(pIn_);
        pY_ = flush(pY_);
        eRef_ = flush(eRef_);
        pRef_ = flush(pRef_);
        if (!std::isfinite(gain_) || !std::isfinite(eY_) || !std::isfinite(sv1_[0] + sv1_[1] + sv2_[0] + sv2_[1])) {
            const double keep = m_;
            reset();
            m_ = keep;
        }
        tick_ += static_cast<uint64_t>(len);
        i += len;
    }
    if (m_ == 0 && mTgt_ == 0) on_ = false;
}

} // namespace mmarp
