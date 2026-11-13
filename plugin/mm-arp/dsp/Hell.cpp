// MM-ARP, HELL : delay + decaleur de frequence de Bode dans la boucle (voir Hell.h).
#include "Hell.h"

#include <algorithm>
#include <cmath>

namespace mmarp {

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kMaxDelayS = 4.0;
constexpr double kSpreadS = 0.023;
inline double clamp01(double v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
// le limiteur doux de la boucle : lineaire aux petits signaux, borne a +/- 2
inline double soft(double x) { return x / std::sqrt(1.0 + 0.25 * x * x); }
inline double flush(double x) { return std::fabs(x) < 1e-25 ? 0.0 : x; }
} // namespace

const double Hell::kSyncBeats[Hell::kSync] = {0, 0.125, 1.0 / 6, 0.25, 0.375, 1.0 / 3, 0.5, 0.75, 2.0 / 3, 1, 1.5, 2, 3, 4};

double Hell::timeMsOf(double v) { return 5.0 * std::pow(400.0, clamp01(v)); }
double Hell::shiftHzOf(double v) {
    const double x = 2 * clamp01(v) - 1;
    return 5000.0 * x * x * x;
}
double Hell::lfoHzOf(double v) { return 0.02 * std::pow(500.0, clamp01(v)); }
double Hell::lfoDepthHzOf(double v) { return 400.0 * clamp01(v) * clamp01(v); }

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
    const double need = (kMaxDelayS + kSpreadS + 0.01) * sr_ + 8;
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
    on_ = false;
    mix_ = mixTgt_ = mixStep_ = 0;
    reset();
}

void Hell::reset() {
    for (auto& l : line_) std::fill(l.begin(), l.end(), 0.f);
    w_ = 0;
    for (auto& h : hil_) h.clear();
    for (auto& t : tone_) t.clear();
    ph_.fill(0);
    lfoPh_ = 0;
    fb_.fill(0);
    d_ = tgtD_;
}

void Hell::set(const HellSettings& s, double bpm) {
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

void Hell::process(float* L, float* R, int n) {
    if (!on_) return;
    float* io[2] = {L, R};
    const double kD = 1.0 - std::exp(-1.0 / (0.06 * sr_));
    const double fb = clamp01(s_.feedback);
    const double up = clamp01(s_.upDown);
    const double gUp = std::min(1.0, 2 * up), gDown = std::min(1.0, 2 * (1 - up));
    const double spread = clamp01(s_.spread);
    const double lfoInc = 2 * kPi * std::max(0.0, s_.lfoHz) / sr_;
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
        if (lfoPh_ > 2 * kPi) lfoPh_ -= 2 * kPi;
        for (int c = 0; c < 2; ++c) {
            d_[static_cast<size_t>(c)] += (tgtD_[static_cast<size_t>(c)] - d_[static_cast<size_t>(c)]) * kD;
            const double dd = std::max(1.0, d_[static_cast<size_t>(c)]);
            const int di = static_cast<int>(dd);
            const double fr = dd - di;
            const std::vector<float>& ln = line_[static_cast<size_t>(c)];
            // Hermite sur quatre points
            const double y0 = ln[static_cast<size_t>((w_ - di + 1) & mask_)], y1 = ln[static_cast<size_t>((w_ - di) & mask_)],
                         y2 = ln[static_cast<size_t>((w_ - di - 1) & mask_)], y3 = ln[static_cast<size_t>((w_ - di - 2) & mask_)];
            const double c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
            const double rd = ((c3 * fr + c2) * fr + c1) * fr + y1;
            // le decaleur de Bode
            double I = 0, Q = 0;
            hil_[static_cast<size_t>(c)].run(rd, I, Q);
            const double lfo = s_.lfoDepthHz * std::sin(lfoPh_ + (c == 1 ? spread * kPi / 2 : 0.0));
            const double hz = (c == 1 ? s_.shiftHz * (1 - 2 * spread) : s_.shiftHz) + lfo;
            double& ph = ph_[static_cast<size_t>(c)];
            ph += 2 * kPi * hz / sr_;
            if (ph > kPi) ph -= 2 * kPi;
            else if (ph < -kPi) ph += 2 * kPi;
            const double co = std::cos(ph), si = std::sin(ph);
            const double upS = I * co + Q * si, downS = I * co - Q * si;
            double y = gUp * upS + gDown * downS;
            y /= std::max(1.0, gUp + gDown);
            if (toneMode_ != 0) y = tone_[static_cast<size_t>(c)].run(y);
            y = flush(y);
            fb_[static_cast<size_t>(c)] = y;
            const double x = io[c][i];
            // ce qui entre dans la ligne : l'entree, plus la boucle limitee
            line_[static_cast<size_t>(c)][static_cast<size_t>(w_)] = static_cast<float>(flush(x + fb * soft(y)));
            io[c][i] = static_cast<float>(dry * x + wet * y);
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
    for (auto& t : tone_) {
        t.z1 = flush(t.z1);
        t.z2 = flush(t.z2);
    }
    if (mix_ == 0 && mixTgt_ == 0) on_ = false;
}

} // namespace mmarp
