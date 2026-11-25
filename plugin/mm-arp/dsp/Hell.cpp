// MM-ARP, HELL : delay + decaleur de frequence de Bode dans la boucle (voir Hell.h).
#include "Hell.h"

#include <algorithm>
#include <cmath>

namespace mmarp {

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kMaxDelayS = 4.0;
constexpr double kSpreadS = 0.023;
// le cran mort au centre du decaleur (une part de la demi-course)
constexpr double kDead = 0.03;
// SMEAR : les quatre passe-tout (ms) ; le canal droit 7 % plus long
constexpr double kSmearMs[4] = {3.1, 4.7, 7.3, 11.1};
inline double clamp01(double v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
// le limiteur doux de la boucle : lineaire aux petits signaux, borne a +/- 2
inline double soft(double x) { return x / std::sqrt(1.0 + 0.25 * x * x); }
inline double flush(double x) { return std::fabs(x) < 1e-25 ? 0.0 : x; }
} // namespace

const double Hell::kSyncBeats[Hell::kSync] = {0, 0.125, 1.0 / 6, 0.25, 0.375, 1.0 / 3, 0.5, 0.75, 2.0 / 3, 1, 1.5, 2, 3, 4};
const double Hell::kLfoBeats[Hell::kLfoSync] = {32, 16, 8, 4, 2, 1, 0.5, 0.25, 0.125};

double Hell::timeMsOf(double v) { return 5.0 * std::pow(400.0, clamp01(v)); }
double Hell::shiftHzOf(double v) {
    const double x = 2 * clamp01(v) - 1;
    return 5000.0 * x * x * x;
}

double Hell::shiftHzFor(double v, int range, double bpm, double noteHz) {
    const double x = 2 * clamp01(v) - 1;
    const double ax = std::fabs(x);
    if (ax < kDead) return 0;
    const double t = std::min(1.0, (ax - kDead) / (1 - kDead));
    double hz;
    switch (range) {
    case FINE:
        hz = 3.0 * std::pow(200.0 / 3.0, t);
        break;
    case SYNC: {
        // des multiples du tempo : 1/16 a 16 cycles par temps
        static const double m[9] = {1.0 / 16, 1.0 / 8, 1.0 / 4, 1.0 / 2, 1, 2, 4, 8, 16};
        const int i = std::min(8, static_cast<int>(std::floor(t * 9)));
        hz = std::max(20.0, bpm) / 60.0 * m[i];
        break;
    }
    case MIDI:
        // une fraction de la note jouee : 1/16 a 2 fois sa frequence (rien tant qu'aucune note n'a joue)
        hz = noteHz > 0 ? noteHz * std::pow(2.0, -4 + 5 * t) : 0;
        break;
    default:
        hz = 10.0 * std::pow(500.0, t);
        break;
    }
    return x < 0 ? -hz : hz;
}

double Hell::shiftVFor(double hz, int range) {
    const double a = std::fabs(hz);
    if (a < 0.5) return 0.5;
    const double t = range == FINE ? std::log(std::min(200.0, std::max(3.0, a)) / 3.0) / std::log(200.0 / 3.0)
                                   : std::log(std::min(5000.0, std::max(10.0, a)) / 10.0) / std::log(500.0);
    const double ax = kDead + (1 - kDead) * t;
    return 0.5 + (hz < 0 ? -ax : ax) / 2;
}

double Hell::lfoHzOf(double v) { return 0.02 * std::pow(500.0, clamp01(v)); }
double Hell::lfoDepthHzOf(double v) { return 400.0 * clamp01(v) * clamp01(v); }
double Hell::hpHzOf(double v) { return v <= 0.001 ? 0.0 : 20.0 * std::pow(200.0, clamp01(v)); }
double Hell::lpHzOf(double v) { return v >= 0.999 ? 0.0 : 300.0 * std::pow(20000.0 / 300.0, clamp01(v)); }
double Hell::lfoSyncHz(double v, double bpm) {
    const int i = static_cast<int>(std::lround(clamp01(v) * (kLfoSync - 1)));
    return std::max(20.0, bpm) / 60.0 / kLfoBeats[i];
}

void Hell::Hilbert::clear() {
    xa.fill(0);
    ya.fill(0);
    xb.fill(0);
    yb.fill(0);
    bPrev = 0;
}

// Olli Niemitalo : deux chaines de passe-tout dont les phases different de 90 degres sur presque toute la bande
void Hell::Hilbert::run(double x, double& i, double& q) {
    double u = x;
    for (int k = 0; k < 4; ++k) {
        const int o = k * 2;
        const double y = a[static_cast<size_t>(k)] * (u + ya[static_cast<size_t>(o + 1)]) - xa[static_cast<size_t>(o + 1)];
        xa[static_cast<size_t>(o + 1)] = xa[static_cast<size_t>(o)];
        xa[static_cast<size_t>(o)] = u;
        ya[static_cast<size_t>(o + 1)] = ya[static_cast<size_t>(o)];
        ya[static_cast<size_t>(o)] = y;
        u = y;
    }
    i = bPrev;
    bPrev = u;
    double v = x;
    for (int k = 0; k < 4; ++k) {
        const int o = k * 2;
        const double y = b[static_cast<size_t>(k)] * (v + yb[static_cast<size_t>(o + 1)]) - xb[static_cast<size_t>(o + 1)];
        xb[static_cast<size_t>(o + 1)] = xb[static_cast<size_t>(o)];
        xb[static_cast<size_t>(o)] = v;
        yb[static_cast<size_t>(o + 1)] = yb[static_cast<size_t>(o)];
        yb[static_cast<size_t>(o)] = y;
        v = y;
    }
    q = v;
}

void Hell::Biquad::set(bool lowpass, double hz, double sr) {
    const double w = 2 * kPi * std::min(hz, 0.45 * sr) / sr;
    const double c = std::cos(w), al = std::sin(w) / (2 * 0.7071067811865476);
    const double a0 = 1 + al;
    if (lowpass) {
        b0 = (1 - c) / 2 / a0;
        b1 = (1 - c) / a0;
        b2 = b0;
    } else {
        b0 = (1 + c) / 2 / a0;
        b1 = -(1 + c) / a0;
        b2 = b0;
    }
    a1 = -2 * c / a0;
    a2 = (1 - al) / a0;
}

void Hell::prepare(double sampleRate) {
    sr_ = sampleRate > 0 ? sampleRate : 48000;
    int size = 1;
    const double need = (kMaxDelayS * 1.3 + kSpreadS + 0.01) * sr_ + 8;
    while (size < need) size <<= 1;
    for (auto& l : line_) l.assign(static_cast<size_t>(size), 0.f);
    mask_ = size - 1;
    static const double A[4] = {0.6923878, 0.9360654322959, 0.9882295226860, 0.9987488452737};
    static const double B[4] = {0.4021921162426, 0.8561710882420, 0.9722909545651, 0.9952884791278};
    for (auto& h : hil_)
        for (int k = 0; k < 4; ++k) {
            h.a[static_cast<size_t>(k)] = A[k];
            h.b[static_cast<size_t>(k)] = B[k];
        }
    for (int c = 0; c < 2; ++c)
        for (int k = 0; k < 4; ++k) {
            Allpass& ap = smear_[static_cast<size_t>(c)][static_cast<size_t>(k)];
            ap.len = std::max(1, static_cast<int>(std::lround(kSmearMs[k] * (c == 1 ? 1.07 : 1.0) * sr_ / 1000.0)));
            ap.buf.assign(static_cast<size_t>(ap.len), 0.f);
        }
    on_ = false;
    mix_ = mixTgt_ = mixStep_ = 0;
    reset();
}

void Hell::reset() {
    for (auto& l : line_) std::fill(l.begin(), l.end(), 0.f);
    w_ = 0;
    for (auto& h : hil_) h.clear();
    for (auto& t : tone_) t.clear();
    for (auto& t : hp_) t.clear();
    for (auto& t : lp_) t.clear();
    for (auto& c : ar_)
        for (auto& t : c) t.clear();
    for (auto& c : smear_)
        for (auto& ap : c) {
            std::fill(ap.buf.begin(), ap.buf.end(), 0.f);
            ap.pos = 0;
        }
    arAct_.fill(false);
    ph_.fill(0);
    lfoPh_ = 0;
    lfoOut_.fill(0);
    rnd_.fill(0);
    lastFrac_.fill(0);
    seed_ = 0x4e11u;
    tick_ = 0;
    fb_.fill(0);
    d_ = tgtD_;
}

void Hell::set(const HellSettings& s, double bpm) {
    const bool hpWas = s_.hpHz > 0, lpWas = s_.lpHz > 0 || (s_.lfoTarget == 2 && s_.lfoAmt != 0);
    s_ = s;
    double sec = s.sync > 0 && s.sync < kSync ? kSyncBeats[s.sync] * 60.0 / std::max(20.0, bpm) : s.timeMs / 1000.0;
    sec = std::min(kMaxDelayS, std::max(0.001, sec));
    tgtD_[0] = sec * sr_;
    tgtD_[1] = (sec + kSpreadS * clamp01(s.spread)) * sr_;
    // TONE : 0.5 neutre (a 0.02 pres : un cran mort au centre)
    const double t = clamp01(s.tone);
    const int mode = t < 0.49 ? 1 : t > 0.51 ? 2 : 0;
    if (mode == 1) {
        const double hz = 600.0 * std::pow(30.0, t / 0.49);
        for (auto& f : tone_) f.set(true, hz, sr_);
    } else if (mode == 2) {
        const double hz = 20.0 * std::pow(150.0, (t - 0.51) / 0.49);
        for (auto& f : tone_) f.set(false, hz, sr_);
    }
    if (mode != toneMode_)
        for (auto& f : tone_) f.clear();
    toneMode_ = mode;
    // HIGH-PASS, LOW-PASS (le LOW-PASS module par le LFO est recalcule dans process)
    if (s.hpHz > 0)
        for (auto& f : hp_) f.set(false, s.hpHz, sr_);
    if (s.hpHz > 0 && !hpWas)
        for (auto& f : hp_) f.clear();
    const bool lpMod = s.lfoTarget == 2 && s.lfoAmt != 0;
    if (s.lpHz > 0 && !lpMod)
        for (auto& f : lp_) f.set(true, s.lpHz, sr_);
    if ((s.lpHz > 0 || lpMod) && !lpWas)
        for (auto& f : lp_) f.clear();
    const double m = clamp01(s.mix);
    if (m != mixTgt_) {
        mixTgt_ = m;
        mixStep_ = (mixTgt_ - mix_) / (0.02 * sr_);
    }
    if (!on_ && mixTgt_ > 0) {
        on_ = true;
        reset();
        d_ = tgtD_;
    }
}

// La forme du LFO a la phase ph (0..1) : sinus, dent de scie montante, carre, aleatoire (echantillonne-bloque)
double Hell::lfoShape(double ph, int c) {
    switch (s_.lfoShape) {
    case 1:
        return 2 * ph - 1;
    case 2:
        return ph < 0.5 ? 1.0 : -1.0;
    case 3:
        if (ph < lastFrac_[static_cast<size_t>(c)]) {
            seed_ = seed_ * 1664525u + 1013904223u;
            rnd_[static_cast<size_t>(c)] = (seed_ >> 8) / 8388608.0 - 1.0;
        }
        lastFrac_[static_cast<size_t>(c)] = ph;
        return rnd_[static_cast<size_t>(c)];
    default:
        return std::sin(2 * kPi * ph);
    }
}

void Hell::process(float* L, float* R, int n) {
    if (!on_) return;
    float* io[2] = {L, R};
    const double kD = 1.0 - std::exp(-1.0 / (0.06 * sr_));
    const double kL = 1.0 - std::exp(-1.0 / (0.002 * sr_));
    const double fb = clamp01(s_.feedback);
    const double up = clamp01(s_.upDown);
    const double gUp = std::min(1.0, 2 * up), gDown = std::min(1.0, 2 * (1 - up));
    const double norm = 1.0 / std::max(1.0, gUp + gDown);
    const double spread = clamp01(s_.spread);
    const double lfoInc = std::max(0.0, s_.lfoHz) / sr_;
    const double a = std::max(-1.0, std::min(1.0, s_.lfoAmt));
    const int tgt = s_.lfoTarget;
    const double freqDepth = s_.lfoDepthHz + (tgt == 0 ? 400.0 * a * std::fabs(a) : 0.0);
    const double rOff = spread * 0.25 + (s_.lfoStereo ? 0.25 : 0.0);
    const bool lpMod = tgt == 2 && a != 0;
    const double lpBase = s_.lpHz > 0 ? s_.lpHz : 20000.0;
    const bool lpOn = s_.lpHz > 0 || lpMod;
    const bool hpOn = s_.hpHz > 0;
    const double smearG = 0.7 * clamp01(s_.smear);
    const double phase0 = 2 * kPi * clamp01(s_.phase);
    const double dMax = static_cast<double>(mask_) - 4;
    for (int i = 0; i < n; ++i) {
        // MIX glisse vers sa cible
        if (mixStep_ != 0) {
            mix_ += mixStep_;
            if ((mixStep_ > 0 && mix_ >= mixTgt_) || (mixStep_ < 0 && mix_ <= mixTgt_)) {
                mix_ = mixTgt_;
                mixStep_ = 0;
            }
        }
        const double dry = std::min(1.0, 2 * (1 - mix_)), wet = std::min(1.0, 2 * mix_);
        lfoPh_ += lfoInc;
        if (lfoPh_ >= 1) lfoPh_ -= 1;
        for (int c = 0; c < 2; ++c) {
            double p = lfoPh_ + (c == 1 ? rOff : 0.0);
            p -= std::floor(p);
            const double raw = lfoShape(p, c);
            lfoOut_[static_cast<size_t>(c)] += (raw - lfoOut_[static_cast<size_t>(c)]) * kL;
        }
        const bool upd = (tick_ & 15u) == 0;
        ++tick_;
        double yc[2];
        for (int c = 0; c < 2; ++c) {
            const size_t cc = static_cast<size_t>(c);
            const double lfo = lfoOut_[cc];
            d_[cc] += (tgtD_[cc] - d_[cc]) * kD;
            double dd = d_[cc];
            if (tgt == 3 && a != 0) dd *= 1 + 0.25 * a * lfo;
            dd = std::min(dMax, std::max(1.0, dd));
            const int di = static_cast<int>(dd);
            const double fr = dd - di;
            const std::vector<float>& ln = line_[cc];
            // Hermite sur quatre points
            const double y0 = ln[static_cast<size_t>((w_ - di + 1) & mask_)], y1 = ln[static_cast<size_t>((w_ - di) & mask_)],
                         y2 = ln[static_cast<size_t>((w_ - di - 1) & mask_)], y3 = ln[static_cast<size_t>((w_ - di - 2) & mask_)];
            const double c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
            double rd = ((c3 * fr + c2) * fr + c1) * fr + y1;
            // SMEAR : la diffusion dans la boucle
            if (smearG > 0)
                for (auto& ap : smear_[cc]) rd = ap.run(rd, smearG);
            // le decalage du moment (le LFO vers FREQ, l'ancien LFO DEPTH)
            const double hz = (c == 1 ? s_.shiftHz * (1 - 2 * spread) : s_.shiftHz) + freqDepth * lfo;
            // ANTI REFL : une bande qui descend de |hz| : ce qui est sous |hz| partirait sous 0 Hz et s'y replierait
            if (s_.antiRefl) {
                const bool down = (hz > 0 && gDown > 0) || (hz < 0 && gUp > 0);
                const double f = down ? std::fabs(hz) : 0.0;
                if (upd) {
                    const bool on = f > 5;
                    if (on) {
                        // un peu au-dessus de |hz| : ce qui frole 0 Hz part aussi
                        ar_[cc][0].set(false, f * 1.2, sr_);
                        ar_[cc][1].set(false, f * 1.2, sr_);
                        if (!arAct_[cc]) {
                            ar_[cc][0].clear();
                            ar_[cc][1].clear();
                        }
                    }
                    arAct_[cc] = on;
                }
                if (arAct_[cc]) rd = ar_[cc][1].run(ar_[cc][0].run(rd));
            }
            // le decaleur de Bode
            double I = 0, Q = 0;
            hil_[cc].run(rd, I, Q);
            double& ph = ph_[cc];
            ph += 2 * kPi * hz / sr_;
            if (ph > kPi) ph -= 2 * kPi;
            else if (ph < -kPi) ph += 2 * kPi;
            const double phi = ph + phase0 + (tgt == 1 ? a * kPi * lfo : 0.0);
            const double co = std::cos(phi), si = std::sin(phi);
            const double upS = I * co + Q * si, downS = I * co - Q * si;
            double y = (gUp * upS + gDown * downS) * norm;
            if (toneMode_ != 0) y = tone_[cc].run(y);
            if (hpOn) y = hp_[cc].run(y);
            if (lpOn) {
                if (lpMod && upd) lp_[cc].set(true, std::min(20000.0, std::max(60.0, lpBase * std::pow(2.0, 3 * a * lfo))), sr_);
                y = lp_[cc].run(y);
            }
            yc[c] = flush(y);
        }
        for (int c = 0; c < 2; ++c) {
            const size_t cc = static_cast<size_t>(c);
            fb_[cc] = yc[c];
            const double x = io[c][i];
            // ce qui entre dans la ligne : l'entree, plus la boucle limitee (CROSS : celle de l'autre canal)
            const double back = s_.cross ? yc[1 - c] : yc[c];
            line_[cc][static_cast<size_t>(w_)] = static_cast<float>(flush(x + fb * soft(back)));
            io[c][i] = static_cast<float>(dry * x + wet * yc[c]);
        }
        w_ = (w_ + 1) & mask_;
    }
    // les etats des filtres sans sous-normaux
    for (auto& h : hil_) {
        for (auto& v : h.xa) v = flush(v);
        for (auto& v : h.ya) v = flush(v);
        for (auto& v : h.xb) v = flush(v);
        for (auto& v : h.yb) v = flush(v);
        h.bPrev = flush(h.bPrev);
    }
    const auto fl = [](Biquad& t) {
        t.z1 = flush(t.z1);
        t.z2 = flush(t.z2);
    };
    for (auto& t : tone_) fl(t);
    for (auto& t : hp_) fl(t);
    for (auto& t : lp_) fl(t);
    for (auto& c : ar_)
        for (auto& t : c) fl(t);
    if (mix_ == 0 && mixTgt_ == 0) on_ = false;
}

} // namespace mmarp
