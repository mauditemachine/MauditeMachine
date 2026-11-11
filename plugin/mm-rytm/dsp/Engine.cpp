#include "Engine.h"

#include <algorithm>
#include <limits>

namespace mm {

namespace {
constexpr double PI = 3.14159265358979323846;
// Le kick monophonique : le coup suivant coupe le precedent en 3 ms ; une porte du groupe de choke se ferme en 8 ms ;
// une piste qui depasse ses 4 voix ferme la plus vieille en 8 ms ; une repetition de retrig coupe le coup d'avant en
// 8 ms ; LEN relache en 8 ms (audio/drums.ts, audio/seqhit.ts).
constexpr double MONO_CUT_S = 0.003;
constexpr double CHOKE_S = 0.008;
constexpr double STEAL_S = 0.008;
constexpr double LEN_REL_S = 0.008;
// Un lock trig mene le coup qui sonne vers ses valeurs (glideTo du site : setTargetAtTime, 1 ms) ; un LFO relance glisse
// de sa valeur du moment vers sa nouvelle courbe en 3 ms (audio/drums.ts LIVE_TAU_S, LIVE_GLIDE_S).
constexpr double LIVE_TAU_S = 0.001;
constexpr double LIVE_GLIDE_S = 0.003;
// Les courbes des LFO continus (audio/seqhit.ts lfoPoints) : 24 points par cycle du plus rapide, de 2 a 40 ms, sur au
// plus 8 s, au plus 512 rampes ; PITCH +/-12 demi-tons, FREQ +/-5 octaves a DEP +/-64.
constexpr double LFO_SPAN_S = 8;
constexpr double SEG_MIN_S = 0.002;
constexpr double SEG_MAX_S = 0.04;
constexpr int SEG_COUNT = 512;
constexpr double LFO_PITCH_CENTS = 1200;
constexpr double LFO_FREQ_CENTS = 6000;
// Un etat ou un son retire est libere 2 s apres, quand plus personne ne le lit.
constexpr double RETIRE_S = 2.0;
constexpr double EPS = 1e-9;
constexpr double INF = std::numeric_limits<double>::infinity();

// La matrice du PAN (audio/drums.ts voice) : au centre sans panoramique, le son tel quel ; un son mono a puissance
// constante (le x racine de 2 est deja dans le gain du coup) ; un son stereo par le panoramique stereo de Web Audio puis
// x 1 / racine de 2. force : le panoramique meme au centre (un LFO PAN, un lock trig PAN).
void panMatrix(double pan, bool mono, bool force, float& LL, float& LR, float& RL, float& RR) {
    pan = std::max(-1.0, std::min(1.0, pan));
    if (pan == 0 && !force) {
        LL = 1; LR = 0; RL = 0; RR = 1;
    } else if (mono) {
        const double x = (pan + 1) / 2;
        LL = static_cast<float>(std::cos(x * PI / 2));
        RR = static_cast<float>(std::sin(x * PI / 2));
        LR = 0; RL = 0;
    } else {
        const double c = 1.0 / std::sqrt(2.0);
        if (pan <= 0) {
            const double x = pan + 1;
            LL = static_cast<float>(c); LR = static_cast<float>(c * std::cos(x * PI / 2));
            RL = 0; RR = static_cast<float>(c * std::sin(x * PI / 2));
        } else {
            const double x = pan;
            LL = static_cast<float>(c * std::cos(x * PI / 2)); LR = 0;
            RL = static_cast<float>(c * std::sin(x * PI / 2)); RR = static_cast<float>(c);
        }
    }
}

// Les lois de la voix (audio/voicelaw.ts)
double clamp01(double v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
double clamp11(double v) { return v < -1 ? -1 : v > 1 ? 1 : v; }
double voiceGain(double level) { return (level / 0.8) * (level / 0.8); }
double resoQ(double v) { return 0.70710678118654752440 * (1 + 16 * std::pow(clamp01(v), 1.5)); }
double decayTau(double v) { return v >= 0.995 ? -1 : 0.012 * std::pow(60.0, std::max(0.0, v)); }
double snapPan(double v) {
    const double c = clamp11(v);
    return std::fabs(c) < 0.02 ? 0 : std::round(c * 1000) / 1000;
}
// TONE mene par un LFO : au 1/32 (au plus 65 valeurs), sous 0.04 le centre (audio/seqhit.ts lfoHitLock, tone.ts snapTone)
double lfoTone(double v) {
    const double c = std::round(clamp11(v) * 32) / 32;
    return std::fabs(c) < 0.04 ? 0 : c;
}
} // namespace

bool condTrue(int ck, bool cn, int ca, int cb, int pass, bool fill, bool last, int pre, int nei) {
    bool r;
    switch (ck) {
        case 0: return true;
        case 1: r = fill; break;
        case 2: r = pre == 1; break;
        case 3: r = nei == 1; break;
        case 4: r = pass == 1; break;
        case 5: r = last; break;
        default: r = cb > 0 && (pass - 1) % cb == ca - 1;
    }
    return cn ? !r : r;
}

float rtrgGain(float vel, int vfad, double frac) {
    const double f = std::max(0.0, std::min(1.0, frac));
    const double d = std::max(-1.0, std::min(1.0, vfad / 64.0));
    if (d == 0) return vel;
    return static_cast<float>(d < 0 ? vel * (1 + d * f) : vel * (1 - d * (1 - f)));
}

int programStepOf(const Program& p, long G) {
    const int len = std::max(1, std::min(128, p.len));
    if (p.loop >= 0 && p.loop * 16 < len) {
        const int pageLen = std::min(16, len - p.loop * 16);
        return p.loop * 16 + static_cast<int>(G % pageLen);
    }
    return static_cast<int>(G % len);
}

void Engine::prepare(double sampleRate) {
    sr_ = sampleRate;
    allNotesOff();
    seqReset(true);
    fx_.prepare(sampleRate);
    fxState_ = nullptr;
}

// La tranche d'une piste a partir d'un coup : ses verrous de TONE, DIST, CHORUS, DELAY, REVERB, ou ceux de la voix
// (audio/drums.ts postSends, postInserts : l'etat de la tranche jusqu'au coup suivant de la voix)
void Engine::applySlice(const PlayState& ps, int track, const SliceFx& s) {
    const ProgTrack& pt = (P_ ? *P_ : ps.prog).tracks[static_cast<size_t>(track)];
    SliceFx& now = sliceNow_[static_cast<size_t>(track)];
    if (s.tone == now.tone && s.dist == now.dist && s.chorus == now.chorus && s.delay == now.delay && s.reverb == now.reverb) return;
    now = s;
    fx_.setSlice(track, s, pt.kick);
}

/* ---------------- le crossfader (les scenes, prog.xk) ---------------- */

const ProgHit& Engine::hitAtX(const PlayState& ps, int t, int hi, const ProgHit& base, ProgHit& tmp) const {
    const Program& p = P_ ? *P_ : ps.prog;
    if (!xOn_ || hi < -2 || hi == -1) return base;
    size_t k;
    double f;
    xkAt(p, xNow_, k, f);
    const ProgTrack& a = p.xk[k].tracks[static_cast<size_t>(t)];
    const ProgTrack& b = p.xk[k + 1].tracks[static_cast<size_t>(t)];
    if (hi == -2) {
        tmp = blendHit(a.live, b.live, f);
        return tmp;
    }
    const size_t i = static_cast<size_t>(hi);
    if (i >= a.hits.size() || i >= b.hits.size()) return base;
    tmp = blendHit(a.hits[i], b.hits[i], f);
    return tmp;
}

SliceFx Engine::voiceSlAt(const PlayState& ps, int t) const {
    const Program& p = P_ ? *P_ : ps.prog;
    if (!xOn_) return p.tracks[static_cast<size_t>(t)].sl;
    size_t k;
    double f;
    xkAt(p, xNow_, k, f);
    return blendSlice(p.xk[k].tracks[static_cast<size_t>(t)].sl, p.xk[k + 1].tracks[static_cast<size_t>(t)].sl, f);
}

float Engine::trackSliceAt(const PlayState& ps, int t) const {
    const Program& p = P_ ? *P_ : ps.prog;
    if (!xOn_) return p.tracks[static_cast<size_t>(t)].slice;
    size_t k;
    double f;
    xkAt(p, xNow_, k, f);
    const float a = p.xk[k].tracks[static_cast<size_t>(t)].slice, b = p.xk[k + 1].tracks[static_cast<size_t>(t)].slice;
    return a + (b - a) * static_cast<float>(f);
}

GlobalFx Engine::globalAt(const PlayState& ps) const {
    const Program& p = P_ ? *P_ : ps.prog;
    if (!xOn_) return p.fx;
    size_t k;
    double f;
    xkAt(p, xNow_, k, f);
    return blendFx(p.xk[k].fx, p.xk[k + 1].fx, f);
}

// La REVERB a la position la plus proche (sa reponse se calcule hors du thread audio, une par forme)
const ReverbIR* Engine::irAt(const PlayState& ps) const {
    if (!xOn_ || !PA_ || !P_ || PA_->irK.size() != P_->xk.size()) return ps.reverbIR.get();
    const auto& irK = PA_->irK;
    const size_t k = static_cast<size_t>(std::lround(std::max(0.0, std::min(1.0, xNow_)) * static_cast<double>(irK.size() - 1)));
    return irK[k] ? irK[k].get() : ps.reverbIR.get();
}

// Le crossfader a bouge : les effets globaux et la tranche de chaque piste a sa position (les coups qui sonnent gardent leurs
// reglages de coup, comme au site ; leur niveau de tranche suit, dans la boucle des voix). La forme de la REVERB change
// quand x se pose (150 ms) : une nouvelle reponse coupe la queue en cours.
void Engine::followX(const PlayState& ps, double bpm, int n) {
    if (!xOn_) return;
    if (std::fabs(xNow_ - xFx_) > 1e-4) {
        xFx_ = xNow_;
        fx_.setGlobal(globalAt(ps), bpm);
        ProgHit tmp;
        for (int t = 0; t < kTracks; ++t) {
            const int src = sliceSrc_[static_cast<size_t>(t)];
            if (src == -3) continue;
            SliceFx s;
            if (src == -1) s = voiceSlAt(ps, t);
            else {
                const ProgTrack& pt = P_->tracks[static_cast<size_t>(t)];
                const ProgHit& base = src == -2 ? pt.live : (static_cast<size_t>(src) < pt.hits.size() ? pt.hits[static_cast<size_t>(src)] : pt.live);
                const ProgHit& h = hitAtX(ps, t, src, base, tmp);
                s = h.hasSl ? h.sl : voiceSlAt(ps, t);
                if (h.lt) s.tone = sliceNow_[static_cast<size_t>(t)].tone; // un lock trig ne change pas TONE
            }
            const SliceFx& d = sliceLfoD_[static_cast<size_t>(t)];
            s = {clamp11(s.tone + d.tone), clamp01(s.dist + d.dist), clamp01(s.chorus + d.chorus), clamp01(s.delay + d.delay), clamp01(s.reverb + d.reverb)};
            applySlice(ps, t, s);
        }
    }
    const ReverbIR* want = irAt(ps);
    if (want != irWant_) {
        irWant_ = want;
        irStable_ = 0;
    } else if (want != fx_.reverbIR()) {
        irStable_ += n;
        if (irStable_ >= static_cast<int>(0.15 * sr_)) fx_.setReverbIR(want);
    }
}

/* ---------------- thread du calcul ---------------- */

void Engine::publish(std::shared_ptr<PlayState> s) {
    PlayState* raw = s.get();
    // Chaque pattern (le courant de la face, puis les autres) : son index pas -> coup, ses reponses de REVERB ; l'emplacement
    // vide : le kit sans coup
    auto index = [](PatPlay& pp, const Program& p) {
        pp.prog = &p;
        for (int t = 0; t < kTracks; ++t) {
            auto& at = pp.at[static_cast<size_t>(t)];
            at.assign(static_cast<size_t>(std::max(1, std::min(128, p.len))), -1);
            const auto& hits = p.tracks[static_cast<size_t>(t)].hits;
            for (size_t i = 0; i < hits.size(); ++i)
                if (hits[i].g >= 0 && hits[i].g < static_cast<int>(at.size())) at[static_cast<size_t>(hits[i].g)] = static_cast<int>(i);
        }
    };
    s->pats.assign(1 + s->prog.pats.size(), PatPlay{});
    index(s->pats[0], s->prog);
    for (size_t j = 0; j < s->prog.pats.size(); ++j) index(s->pats[1 + j], s->prog.pats[j]);
    for (size_t j = 0; j < s->pats.size() && j < s->irKs.size(); ++j) s->pats[j].irK = s->irKs[j];
    s->empty = s->prog;
    s->empty.pats.clear();
    s->empty.sounds.clear();
    s->empty.xk.clear();
    s->empty.slot = -1;
    s->empty.len = 16;
    s->empty.loop = -1;
    for (auto& t : s->empty.tracks) t.hits.clear();
    index(s->emptyPat, s->empty);
    states_.push_back(s);
    {
        std::lock_guard<std::mutex> lk(latestMx_);
        latestPtr_ = s;
    }
    current_.store(raw, std::memory_order_release);
}

std::shared_ptr<PlayState> Engine::latest() const {
    std::lock_guard<std::mutex> lk(latestMx_);
    return latestPtr_;
}

void Engine::collect(double now) {
    PlayState* cur = current_.load(std::memory_order_acquire);
    for (size_t i = 0; i < states_.size();) {
        auto& s = states_[i];
        if (s.get() == cur) {
            ++i;
            continue;
        }
        if (s->retiredAt < 0) s->retiredAt = now;
        if (now - s->retiredAt > RETIRE_S && s->users.load(std::memory_order_acquire) == 0) {
            states_.erase(states_.begin() + static_cast<long>(i));
            continue;
        }
        ++i;
    }
    for (size_t i = 0; i < soundsOwned_.size();) {
        auto& s = soundsOwned_[i];
        if (s.use_count() > 1) {
            s->retiredAt = -1;
            ++i;
            continue;
        }
        if (s->retiredAt < 0) s->retiredAt = now;
        if (now - s->retiredAt > RETIRE_S && s->users.load(std::memory_order_acquire) == 0) {
            soundsOwned_.erase(soundsOwned_.begin() + static_cast<long>(i));
            continue;
        }
        ++i;
    }
}

/* ---------------- les patterns ---------------- */

const PatPlay& Engine::patOf(const PlayState& ps, int slot) const {
    for (const auto& pp : ps.pats)
        if (pp.prog && pp.prog->slot == slot) return pp;
    return ps.emptyPat;
}

// Le pattern d'un emplacement joue a partir du seizieme startG ; ses passages repartent de 1 (les conditions 1ST, A:B), les
// tranches mises par ses coups d'avant restent comme elles sont jusqu'au coup suivant. byEngine : la face le suivra.
void Engine::usePattern(const PlayState& ps, int slot, long startG, bool byEngine) {
    slot_ = slot;
    PA_ = &patOf(ps, slot);
    P_ = PA_->prog;
    patStart_ = startG;
    passN_ = 1;
    seenFirst_ = false;
    for (auto& src : sliceSrc_)
        if (src >= 0 || src == -2) src = -3;
    xFx_ = -1;
    if (byEngine) fbPatSeq.fetch_add(1, std::memory_order_release);
    fbPat.store(slot, std::memory_order_relaxed);
}

void Engine::queuePatterns(int next, const int* chain, int n) {
    const int w = 1 - ptnW_.load(std::memory_order_relaxed);
    PtnMsg& m = ptnBuf_[static_cast<size_t>(w)];
    m.next = next;
    m.n = std::max(0, std::min(n, static_cast<int>(m.chain.size())));
    for (int i = 0; i < m.n; ++i) m.chain[static_cast<size_t>(i)] = chain[i];
    ptnW_.store(w, std::memory_order_release);
    ptnSeq_.fetch_add(1, std::memory_order_release);
}

/* ---------------- thread du message ---------------- */

bool Engine::pushLive(const LiveHit& h) {
    const int w = liveW_.load(std::memory_order_relaxed);
    const int next = (w + 1) % kLiveCap;
    if (next == liveR_.load(std::memory_order_acquire)) return false;
    live_[static_cast<size_t>(w)] = h;
    liveW_.store(next, std::memory_order_release);
    return true;
}

/* ---------------- les voix ---------------- */

void Engine::release(Voice& v) {
    if (v.snd) v.snd->users.fetch_sub(1, std::memory_order_acq_rel);
    v = Voice{};
}

void Engine::allNotesOff() {
    for (auto& tv : voices_)
        for (auto& v : tv) release(v);
    for (auto& t : ts_) endRetrig(t.rt);
    npend_ = 0;
}

void Engine::fadeTrack(int track, int samples, int offset) {
    for (auto& v : voices_[static_cast<size_t>(track)]) {
        if (!v.shot) continue;
        if (v.delay > offset) {
            release(v);
            continue;
        }
        if (v.fadeLeft < 0 || v.fadeLeft > samples) {
            v.fadeLeft = std::max(1, samples);
            v.fadeLen = v.fadeLeft;
            v.fadeHold = std::max(0, offset - v.delay);
        }
    }
}

void Engine::trigger(const PlayState& ps, int track, const ProgHit& h, float vel, float slice, RenderedSound* snd, int offset, double lenSteps, bool rep, double stepN, double lpos, double anchor, int hi) {
    if (!snd || snd->variants.empty()) return;
    const Program& P = P_ ? *P_ : ps.prog;
    const ProgTrack& tr = P.tracks[static_cast<size_t>(track)];
    // Les LFO pris au moment du coup (audio/seqhit.ts lfoHitLock) : DIST, DELAY, REVERB, TONE dans la tranche (comme un
    // verrou du coup), DECAY dans son enveloppe ; sur les valeurs que le coup joue (la voix ou son verrou)
    const SliceFx sl0 = h.hasSl ? h.sl : voiceSlAt(ps, track);
    SliceFx sl = sl0;
    double tau = h.tau;
    for (int d = LD_DIST; d <= LD_DECAY && h.nlfo > 0; ++d) {
        double sum = 0;
        bool any = false;
        for (int i = 0; i < h.nlfo; ++i)
            if (h.lfo[i].dest == d) {
                sum += lfoValue(h.lfo[i], lpos, anchor);
                any = true;
            }
        if (!any) continue;
        if (d == LD_DIST) sl.dist = clamp01(sl.dist + sum);
        else if (d == LD_DELAY) sl.delay = clamp01(sl.delay + sum);
        else if (d == LD_REVERB) sl.reverb = clamp01(sl.reverb + sum);
        else if (d == LD_TONE) sl.tone = lfoTone(sl.tone + sum);
        else tau = decayTau(clamp01(h.lbDecay + sum));
    }
    applySlice(ps, track, sl);
    // D'ou vient la tranche (le crossfader la reprend a sa position) et l'ecart des LFO pris au coup
    sliceSrc_[static_cast<size_t>(track)] = h.hasSl ? (hi >= 0 || hi == -2 ? hi : -3) : -1;
    sliceLfoD_[static_cast<size_t>(track)] = {sl.tone - sl0.tone, sl.dist - sl0.dist, sl.chorus - sl0.chorus, sl.delay - sl0.delay, sl.reverb - sl0.reverb};
    const bool gated = tr.choke > 0 && tr.gated;
    const bool mono = tr.mono && !gated;
    if (tr.choke > 0)
        for (int u = 0; u < kTracks; ++u) {
            const ProgTrack& o = P.tracks[static_cast<size_t>(u)];
            if (o.choke == tr.choke && o.gated) fadeTrack(u, static_cast<int>(CHOKE_S * sr_), offset);
        }
    if (mono) fadeTrack(track, static_cast<int>(MONO_CUT_S * sr_), offset);
    // Une repetition de retrig : le coup d'avant de la voix s'efface en 8 ms (une voix, un coup a la fois)
    if (rep) fadeTrack(track, static_cast<int>(CHOKE_S * sr_), offset);

    auto& tv = voices_[static_cast<size_t>(track)];
    int sounding = 0;
    Voice* oldest = nullptr;
    for (auto& v : tv)
        if (v.shot && v.fadeLeft < 0) {
            ++sounding;
            if (!oldest || v.age < oldest->age) oldest = &v;
        }
    if (sounding >= kPoly && oldest) {
        oldest->fadeLeft = std::max(1, static_cast<int>(STEAL_S * sr_));
        oldest->fadeLen = oldest->fadeLeft;
        oldest->fadeHold = std::max(0, offset - oldest->delay);
    }
    Voice* slot = nullptr;
    for (auto& v : tv)
        if (!v.shot) {
            slot = &v;
            break;
        }
    if (!slot) {
        slot = &tv[0];
        for (auto& v : tv) {
            const int a = v.fadeLeft < 0 ? 1 << 30 : v.fadeLeft;
            const int b = slot->fadeLeft < 0 ? 1 << 30 : slot->fadeLeft;
            if (a < b) slot = &v;
        }
        release(*slot);
    }

    snd->users.fetch_add(1, std::memory_order_acq_rel);
    const int nv = static_cast<int>(snd->variants.size());
    const int vi = snd->next.fetch_add(1, std::memory_order_relaxed) % nv;
    const Shot& shot = snd->variants[static_cast<size_t>(vi)];
    Voice& v = *slot;
    v.snd = snd;
    v.shot = &shot;
    v.delay = std::max(0, offset);
    v.t = 0;
    v.age = ++clock_;
    v.fadeLeft = -1;
    v.pos = static_cast<size_t>(std::max(0.0, std::min(1.0, h.start)) * static_cast<double>(shot.size()));
    v.vel = std::max(0.f, vel);
    v.slice = slice;
    v.sRatio = 1;
    v.gain = static_cast<float>(v.vel * h.gain * slice);
    v.gainTo = v.gain;
    v.gain0 = v.gain;
    v.vol = h.lbLevel;
    v.panNow = v.panTo = std::max(-1.0, std::min(1.0, h.pan));
    v.panner = h.pan != 0 || h.fp;
    v.pl = PendLock{};
    v.atkN = std::max(0.0, h.atk) * sr_;
    v.holdEndN = (std::max(0.0, h.atk) + std::max(0.0, h.hold)) * sr_;
    v.tauN = tau > 0 ? tau * sr_ : -1;
    v.stopN = v.tauN > 0 ? v.holdEndN + 7 * v.tauN : -1;
    v.cutN = lenSteps > 0 && stepN > 0 ? lenSteps * stepN : -1;
    // FLTR
    v.ft = h.ft >= 1 && h.ft <= 3 ? h.ft : 0;
    v.zL1 = v.zL2 = v.zR1 = v.zR2 = 0;
    if (v.ft) {
        const double top = std::min(20000.0, sr_ * 0.45);
        v.f0 = std::max(20.0, std::min(top, h.fhz));
        v.fq = h.fq;
        v.fEnv = h.foct != 0;
        v.fPeak = std::max(20.0, std::min(top, h.fhz * std::pow(2.0, h.foct)));
        v.fAtkN = std::max(0.0, h.fatk) * sr_;
        v.fTauN = std::max(1e-4, h.ftau) * sr_;
    }
    // Les LFO continus (PITCH, FREQ, RESO, VOL, PAN : audio/drums.ts lfoCurves) : des courbes sur la duree du coup
    v.nlfo = 0;
    v.anyCv = false;
    for (auto& c : v.cv) c = Curve{};
    if (h.nlfo > 0 && stepN > 0) {
        v.nlfo = std::min(2, h.nlfo);
        for (int i = 0; i < v.nlfo; ++i) v.lfo[i] = h.lfo[i];
        v.lPos = lpos;
        v.lAnchor = anchor;
        v.lStepN = stepN;
        v.baseLevel = h.lbLevel;
        v.baseReso = h.lbReso;
        v.basePan = v.panNow;
        // La fin du coup (son echantillon, son DECAY, LEN), au plus 8 s
        double endN = static_cast<double>(shot.size() - std::min(shot.size(), v.pos));
        if (v.stopN >= 0) endN = std::min(endN, v.stopN);
        if (v.cutN >= 0) endN = std::min(endN, v.cutN + (LEN_REL_S + 0.002) * sr_);
        v.lEndN = std::min(endN, LFO_SPAN_S * sr_);
        for (int i = 0; i < v.nlfo; ++i) {
            const int c = v.lfo[i].dest - LD_PITCH;
            if (c < 0 || c >= CV_N) continue;
            if ((c == CV_FREQ || c == CV_RESO) && !v.ft) continue; // sans filtre (la face en pose un) : rien a mener
            v.cv[static_cast<size_t>(c)].on = true;
            v.anyCv = true;
        }
        // Un LFO PAN au centre : le panoramique quand meme, au niveau du centre (seqExtra : x racine de 2)
        if (v.cv[CV_PAN].on && !v.panner) {
            v.panner = true;
            v.gain = v.gainTo = v.gain0 = static_cast<float>(v.gain * std::sqrt(2.0));
        }
        for (int c = 0; c < CV_N; ++c)
            if (v.cv[static_cast<size_t>(c)].on) curveStart(v, c, 0, 0);
        if (v.cv[CV_PITCH].on) v.fpos = static_cast<double>(v.pos);
        if (v.cv[CV_PAN].on) v.panNow = v.panTo = curveAt(v, CV_PAN, 0);
    }
    panMatrix(v.panNow, shot.mono, v.panner, v.gLL, v.gLR, v.gRL, v.gRR);
    if (v.ft) updateFilter(v);
}

/* ---------------- les LFO continus (audio/drums.ts lfoLaw, lfoCurves ; seqhit.ts lfoPoints) ---------------- */

double Engine::lfoSumAt(const Voice& v, int dest, double t) const {
    const double pos = v.lPos + t / v.lStepN;
    double s = 0;
    for (int i = 0; i < v.nlfo; ++i)
        if (v.lfo[i].dest == dest) s += lfoValue(v.lfo[i], pos, v.lAnchor);
    return s;
}

// La loi d'une destination continue : la valeur de l'AudioParam du site pour une valeur s des LFO (PITCH et FREQ : le
// detune en cents ; RESO : le Q, en dB hors du passe-bande ; VOL : le gain rapporte au LEVEL ; PAN : le panoramique)
double Engine::lawOf(const Voice& v, int c, double s) const {
    switch (c) {
        case CV_PITCH: return s * LFO_PITCH_CENTS;
        case CV_FREQ: return s * LFO_FREQ_CENTS;
        case CV_RESO: {
            const double q = resoQ(clamp01(v.baseReso + s));
            return v.ft == 3 ? q : 20 * std::log10(q);
        }
        case CV_VOL: {
            const double b = voiceGain(v.baseLevel);
            return b > 1e-6 ? voiceGain(clamp01(v.baseLevel + s)) / b : 1;
        }
        default: return clamp11(v.basePan + s);
    }
}

// Une courbe depuis from (echantillons de la voix) : 0 au depart du coup ; plus tard (un lock trig), la valeur held tenue
// a from, puis 3 ms vers la nouvelle courbe. Des points tous les seg (24 par cycle du plus rapide, 2 a 40 ms) jusqu'a la
// fin du coup, au plus 512 rampes (au-dela, la courbe s'arrete plus tot) ; un LFO immobile (HLD ou SPD 0, sans FADE) : un point.
void Engine::curveStart(Voice& v, int c, double from, double held) {
    Curve& cv = v.cv[static_cast<size_t>(c)];
    const double t1 = v.lEndN;
    double t0 = std::max(0.0, from);
    if (from > 0) {
        if (t0 >= t1) return; // le coup a fini sa courbe : il garde sa derniere valeur
        cv.gFrom = t0;
        cv.gVal = held;
        t0 += LIVE_GLIDE_S * sr_;
        if (t0 >= t1) {
            cv.n = -1;
            return;
        }
    } else {
        cv.gFrom = -1;
    }
    cv.t0 = t0;
    cv.k = -1;
    const int dest = c + LD_PITCH;
    bool still = true;
    double cyc = INF;
    for (int i = 0; i < v.nlfo; ++i) {
        const Lfo& l = v.lfo[i];
        if (l.dest != dest) continue;
        const double lc = lfoCycle(l);
        if (!((l.mode == LM_HLD || !std::isfinite(lc)) && l.fade == 0)) still = false;
        cyc = std::min(cyc, lc * v.lStepN);
    }
    if (still || !(t1 > t0)) {
        cv.n = 0;
        cv.seg = 1;
    } else {
        double seg = std::max(SEG_MIN_S * sr_, std::min(SEG_MAX_S * sr_, std::isfinite(cyc) ? cyc / 24 : SEG_MAX_S * sr_));
        long n = std::max(1L, static_cast<long>(std::ceil((t1 - t0) / seg)));
        if (n > SEG_COUNT) n = SEG_COUNT;
        else seg = (t1 - t0) / static_cast<double>(n);
        cv.n = static_cast<int>(n);
        cv.seg = seg;
    }
    cv.p0 = lawOf(v, c, lfoSumAt(v, dest, cv.t0));
}

// La valeur de la courbe au temps t de la voix (les rampes lineaires d'AudioParam entre ses points)
double Engine::curveAt(Voice& v, int c, double t) const {
    Curve& cv = v.cv[static_cast<size_t>(c)];
    if (cv.n < 0) return cv.gVal;
    if (t < cv.t0) {
        if (cv.gFrom < 0 || t <= cv.gFrom) return cv.gFrom < 0 ? cv.p0 : cv.gVal;
        return cv.gVal + (cv.p0 - cv.gVal) * (t - cv.gFrom) / (cv.t0 - cv.gFrom);
    }
    const int dest = c + LD_PITCH;
    const long k = cv.n == 0 ? 0 : std::min(static_cast<long>(cv.n), static_cast<long>(std::floor((t - cv.t0) / cv.seg)));
    if (k >= cv.n) {
        if (cv.k != cv.n) {
            cv.a = cv.n == 0 ? cv.p0 : lawOf(v, c, lfoSumAt(v, dest, cv.t0 + cv.n * cv.seg));
            cv.k = cv.n;
        }
        return cv.a;
    }
    if (k != cv.k) {
        cv.a = k == 0 ? cv.p0 : (k == cv.k + 1 ? cv.b : lawOf(v, c, lfoSumAt(v, dest, cv.t0 + static_cast<double>(k) * cv.seg)));
        cv.b = lawOf(v, c, lfoSumAt(v, dest, cv.t0 + static_cast<double>(k + 1) * cv.seg));
        cv.k = k;
    }
    const double fr = (t - (cv.t0 + static_cast<double>(k) * cv.seg)) / cv.seg;
    return cv.a + (cv.b - cv.a) * fr;
}

void Engine::setPan(Voice& v, double pan) {
    v.panNow = pan;
    panMatrix(pan, v.shot && v.shot->mono, v.panner, v.gLL, v.gLR, v.gRL, v.gRR);
}

// Le filtre du moment : la coupure de l'enveloppe (et le detune d'un LFO FREQ), le Q (celui d'un LFO RESO)
void Engine::updateFilter(Voice& v) {
    double f = filterFreq(v);
    if (v.cv[CV_FREQ].on) f *= std::exp2(curveAt(v, CV_FREQ, v.t) / 1200);
    double q = v.fq;
    if (v.cv[CV_RESO].on) {
        const double x = curveAt(v, CV_RESO, v.t);
        q = v.ft == 3 ? x : std::pow(10.0, x / 20);
    }
    filterCoefs(v, f, q);
}

// Le biquad de Web Audio (le BiquadFilterNode : passe-bas et passe-haut avec Q en dB, ici deja ramene en lineaire par le
// site, passe-bande a gain 0 dB au centre)
void Engine::filterCoefs(Voice& v, double f, double q) const {
    const double top = std::min(20000.0, sr_ * 0.45);
    f = std::max(20.0, std::min(top, f));
    const double w0 = 2 * PI * f / sr_;
    const double cw = std::cos(w0), sw = std::sin(w0);
    const double alpha = sw / (2 * std::max(1e-3, q));
    double B0, B1, B2;
    const double A0 = 1 + alpha, A1 = -2 * cw, A2 = 1 - alpha;
    if (v.ft == 1) {
        B0 = (1 - cw) / 2; B1 = 1 - cw; B2 = B0;
    } else if (v.ft == 2) {
        B0 = (1 + cw) / 2; B1 = -(1 + cw); B2 = B0;
    } else {
        B0 = alpha; B1 = 0; B2 = -alpha;
    }
    v.b0 = B0 / A0; v.b1 = B1 / A0; v.b2 = B2 / A0; v.a1 = A1 / A0; v.a2 = A2 / A0;
}

// La coupure au temps t de la voix (exponentialRampToValueAtTime puis setTargetAtTime, audio/drums.ts voice)
double Engine::filterFreq(const Voice& v) const {
    if (!v.fEnv) return v.f0;
    if (v.fAtkN > 0 && v.t < v.fAtkN) return v.f0 * std::pow(v.fPeak / v.f0, v.t / v.fAtkN);
    return v.f0 + (v.fPeak - v.f0) * std::exp(-(v.t - v.fAtkN) / v.fTauN);
}

// Un lock trig (audio/drums.ts lockTrigOn) : le coup qui sonne de la voix (le plus recent) le prend a son heure
void Engine::lockTrig(const ProgHit& h, int track, int offset, bool re, double anchor) {
    Voice* last = nullptr;
    for (auto& v : voices_[static_cast<size_t>(track)])
        if (v.shot && v.fadeLeft < 0 && v.delay <= offset && (!last || v.age > last->age)) last = &v;
    if (!last) return;
    if (last->pl.on) applyLock(*last); // un lock trig d'avant dans le meme bloc passe d'abord
    PendLock& p = last->pl;
    p.on = true;
    p.at = last->t + std::max(0, offset - last->delay);
    p.lk = h.lk;
    p.level = h.lbLevel;
    p.pan = h.pan;
    p.reso = h.lbReso;
    p.cut = h.lc;
    p.re = re;
    p.anchor = anchor;
}

// Ce que le lock trig change du coup qui sonne : VOL (rapporte au LEVEL du coup), PAN, la coupure et la RESO du filtre,
// en glissant (1 ms) ; LFO.T : l'ancre de ses LFO ; ses LFO continus repartent de la (une base ou l'ancre a change)
void Engine::applyLock(Voice& v) {
    PendLock p = v.pl;
    v.pl.on = false;
    std::array<double, CV_N> held{};
    for (int c = 0; c < CV_N; ++c)
        if (v.cv[static_cast<size_t>(c)].on) held[static_cast<size_t>(c)] = lawOf(v, c, lfoSumAt(v, c + LD_PITCH, v.t));
    if (p.lk & 1) {
        const double b = voiceGain(v.vol);
        v.gainTo = static_cast<float>(v.gain0 * (b > 1e-6 ? voiceGain(p.level) / b : 1));
        v.baseLevel = p.level;
    }
    if ((p.lk & 2) && v.panner) {
        v.basePan = snapPan(p.pan);
        if (!v.cv[CV_PAN].on) v.panTo = v.basePan;
    }
    if ((p.lk & 8) && v.ft) {
        v.fEnv = false;
        v.f0 = std::max(20.0, std::min(std::min(20000.0, sr_ * 0.45), p.cut));
    }
    if ((p.lk & 4) && v.ft) {
        v.baseReso = p.reso;
        if (!v.cv[CV_RESO].on) v.fq = resoQ(p.reso);
    }
    if (p.re) v.lAnchor = p.anchor;
    for (int c = 0; c < CV_N; ++c)
        if (v.cv[static_cast<size_t>(c)].on) curveStart(v, c, std::max(1e-9, v.t), held[static_cast<size_t>(c)]);
    if (v.ft) updateFilter(v);
}

/* ---------------- le sequenceur des trigs (audio/seq.ts seqStep) ---------------- */

uint32_t Engine::rngNext() {
    rng_ += 0x6d2b79f5u;
    uint32_t t = rng_;
    t = (t ^ (t >> 15)) * (t | 1u);
    t ^= t + (t ^ (t >> 7)) * (t | 61u);
    return t ^ (t >> 14);
}

void Engine::endRetrig(Retrig& rt) {
    if (rt.on && rt.snd) rt.snd->users.fetch_sub(1, std::memory_order_acq_rel);
    rt.on = false;
    rt.snd = nullptr;
}

void Engine::seqReset(bool full) {
    npend_ = 0;
    for (auto& t : ts_) {
        endRetrig(t.rt);
        if (full) t.pre = -1;
    }
    if (full) {
        passN_ = 1;
        seenFirst_ = false;
    }
    maskAt_.fill(0);
}

void Engine::pendPush(const Ev& e) {
    if (npend_ < kPendCap) pend_[static_cast<size_t>(npend_++)] = e;
}

// Les repetitions du retrig dans la fenetre [from, to) (en pas), avant `before` ; false : il est fini (RLEN atteint).
bool Engine::repeats(int track, Retrig& rt, double from, double to, double before, double anchor) {
    long k = std::max(1L, static_cast<long>(std::ceil((from - rt.pos) / rt.every - EPS)));
    for (;; ++k) {
        const double rp = rt.pos + k * rt.every;
        if (rp >= to - EPS || rp >= before - EPS) return true;
        if (rp >= rt.end - EPS) return false;
        Ev e;
        e.ppq = rp * 0.25;
        e.track = track;
        e.slice = rt.slice;
        e.vel = rtrgGain(rt.vel, rt.vfad, (rp - rt.pos) / rt.span);
        e.lenSteps = rt.lenSteps;
        e.rep = true;
        e.anchor = rp < rt.preUntil - EPS ? rt.preAnchor : anchor;
        e.hi = rt.hi;
        e.hit = rt.hit;
        e.snd = rt.snd;
        pendPush(e);
    }
}

// Un pas (le seizieme G depuis le debut du morceau) : ses coups et ses lock trigs, voix par voix dans l'ordre des pads.
void Engine::evalStep(const PlayState& ps, long G) {
    if (G < patStart_) patStart_ = 0;
    int g = programStepOf(*P_, G - patStart_);
    // La fin du pattern (son premier pas revient) : le suivant choisi (la face, un program change), sinon la chaine
    const int first = P_->loop >= 0 && P_->loop * 16 < std::max(1, P_->len) ? P_->loop * 16 : 0;
    if (G > patStart_ && g == first) {
        int to = -1;
        if (next_ >= 0) {
            to = next_;
            next_ = -1;
            for (int i = 0; i < chainN_; ++i)
                if (chain_[static_cast<size_t>(i)] == to) chainPos_ = i;
        } else if (chainN_ > 1) {
            chainPos_ = (chainPos_ + 1) % chainN_;
            to = chain_[static_cast<size_t>(chainPos_)];
        }
        if (to >= 0 && to != slot_) {
            usePattern(ps, to, G, true);
            g = programStepOf(*P_, 0);
        }
    }
    const Program& p = *P_;
    // TLEN : une piste a sa longueur boucle depuis le debut du pattern, sans repartir avec lui (la polymetrie)
    const long rel = G - patStart_;
    // Le passage du pattern (les conditions A:B, 1ST) : 1 au lancement, +1 a chaque retour au premier pas
    if (g == 0) {
        if (seenFirst_) ++passN_;
        seenFirst_ = true;
    }
    const bool fill = fill_.load(std::memory_order_relaxed);
    const double swingFrac = ((g % 16) & 1) ? p.swing : 0.0;
    const double stepEnd = static_cast<double>(G) + 1;
    int mask = 0;
    for (int t = 0; t < kTracks; ++t) {
        const ProgTrack& pt = p.tracks[static_cast<size_t>(t)];
        TrackSeq& sv = ts_[static_cast<size_t>(t)];
        const int nei = t > 0 ? ts_[static_cast<size_t>(t - 1)].pre : -1;
        // Le mute de la voix arrete son retrig
        if (!pt.plays) endRetrig(sv.rt);
        const auto& at = PA_->at[static_cast<size_t>(t)];
        const int gt = pt.tlen > 0 && p.loop < 0 ? static_cast<int>(rel % pt.tlen) : g;
        const int hi = gt >= 0 && gt < static_cast<int>(at.size()) ? at[static_cast<size_t>(gt)] : -1;
        if (hi < 0) {
            if (sv.rt.on && !repeats(t, sv.rt, static_cast<double>(G), stepEnd, INF, sv.anchor)) endRetrig(sv.rt);
            continue;
        }
        const ProgHit& h = pt.hits[static_cast<size_t>(hi)];
        // La condition : une COND gagne sur PROB ; un trig sans l'une ni l'autre ne change pas le resultat de la voix
        bool ok = true;
        if (h.ck != 0) {
            ok = condTrue(h.ck, h.cn, h.ca, h.cb, passN_, fill, false, sv.pre, nei);
            sv.pre = ok ? 1 : 0;
        } else if (h.prob < 100) {
            ok = (rngNext() / 4294967296.0) * 100 < h.prob;
            sv.pre = ok ? 1 : 0;
        }
        const double pos = static_cast<double>(G) + swingFrac + h.shift;
        RenderedSound* snd = h.snd >= 0 && h.snd < static_cast<int>(ps.sounds.size()) ? ps.sounds[static_cast<size_t>(h.snd)].get() : nullptr;
        if (h.lt) {
            // LFO.T : les LFO repartent du lock trig ; les repetitions d'un retrig en cours d'avant lui gardent l'ancre d'avant
            const bool re = ok && h.lfot;
            if (sv.rt.on && re) {
                sv.rt.preUntil = pos;
                sv.rt.preAnchor = sv.anchor;
            }
            if (re) sv.anchor = pos;
            if (sv.rt.on && !repeats(t, sv.rt, static_cast<double>(G), stepEnd, INF, sv.anchor)) endRetrig(sv.rt);
            if (!ok) continue;
            Ev e;
            e.ppq = pos * 0.25;
            e.track = t;
            e.slice = pt.slice;
            e.lt = true;
            e.hi = hi;
            e.re = re;
            e.anchor = pos;
            e.hit = h;
            pendPush(e);
            continue;
        }
        if (!ok || !pt.plays) {
            if (sv.rt.on && !repeats(t, sv.rt, static_cast<double>(G), stepEnd, INF, sv.anchor)) endRetrig(sv.rt);
            continue;
        }
        // Le trig joue : le retrig d'avant s'arrete a son heure (ses repetitions d'avant lui partent)
        if (sv.rt.on) {
            repeats(t, sv.rt, static_cast<double>(G), stepEnd, pos, sv.anchor);
            endRetrig(sv.rt);
        }
        if (h.lfot) sv.anchor = pos;
        Ev e;
        e.ppq = pos * 0.25;
        e.track = t;
        e.slice = pt.slice;
        e.vel = h.vel;
        e.lenSteps = h.len;
        e.anchor = sv.anchor;
        e.hi = hi;
        e.hit = h;
        e.snd = snd;
        pendPush(e);
        if (t < 8) mask |= 1 << t;
        if (h.rtrg && snd) {
            Retrig& rt = sv.rt;
            rt.on = true;
            rt.pos = pos;
            rt.every = std::max(1.0 / 8, h.every);
            rt.end = h.rlen < 0 ? INF : pos + h.rlen;
            rt.span = h.rlen < 0 ? 16 : h.rlen;
            rt.vfad = h.vfad;
            rt.vel = h.vel;
            rt.slice = pt.slice;
            rt.lenSteps = h.len;
            rt.preUntil = -INF;
            rt.preAnchor = 0;
            rt.hi = hi;
            rt.hit = h;
            rt.snd = snd;
            snd->users.fetch_add(1, std::memory_order_acq_rel);
            if (!repeats(t, rt, pos, stepEnd, INF, sv.anchor)) endRetrig(rt);
        }
    }
    maskAt_[static_cast<size_t>(g % 128)] = mask;
}

/* ---------------- le bloc ---------------- */

void Engine::process(const BlockTransport& tr, float* L, float* R, int n, const NoteEvent* notes, int nNotes) {
    // Par morceaux de FxChain::kMaxBlock (les tampons des tranches) ; la position et les notes suivent
    for (int off = 0; off < n; off += FxChain::kMaxBlock) {
        const int c = std::min(FxChain::kMaxBlock, n - off);
        BlockTransport t2 = tr;
        t2.ppq = tr.ppq + off * tr.ppqPerSample;
        int nn = 0;
        for (int k = 0; k < nNotes && nn < static_cast<int>(chunkNotes_.size()); ++k)
            if (notes[k].offset >= off && notes[k].offset < off + c) {
                chunkNotes_[static_cast<size_t>(nn)] = notes[k];
                chunkNotes_[static_cast<size_t>(nn++)].offset -= off;
            }
        processChunk(t2, L + off, R + off, c, chunkNotes_.data(), nn);
    }
}

void Engine::processChunk(const BlockTransport& tr, float* L, float* R, int n, const NoteEvent* notes, int nNotes) {
    PlayState* ps = current_.load(std::memory_order_acquire);
    if (ps) ps->users.fetch_add(1, std::memory_order_acq_rel);
    // Le pattern joue (2026-11-08). La face a pose un autre pattern courant : a l'arret il joue tout de suite, en lecture a la
    // fin du pattern. Le pattern suivant et la chaine choisis sur la face. Un program change d'Ableton : en lecture a la fin
    // du pattern, a l'arret tout de suite.
    const bool playingNow = seqOn_ && tr.playing;
    if (ps) {
        if (ps->prog.slot != faceSlot_) {
            faceSlot_ = ps->prog.slot;
            if (!playingNow || slot_ < 0) slot_ = faceSlot_;
            else if (slot_ != faceSlot_) next_ = faceSlot_;
        }
        if (slot_ < 0) slot_ = ps->prog.slot;
        const int sq = ptnSeq_.load(std::memory_order_acquire);
        if (sq != ptnSeen_) {
            ptnSeen_ = sq;
            const PtnMsg& m = ptnBuf_[static_cast<size_t>(ptnW_.load(std::memory_order_acquire))];
            if (playingNow && m.next >= 0 && m.next != slot_) next_ = m.next;
            chainN_ = m.n;
            for (int i = 0; i < chainN_; ++i) chain_[static_cast<size_t>(i)] = m.chain[static_cast<size_t>(i)];
            chainPos_ = 0;
            for (int i = 0; i < chainN_; ++i)
                if (chain_[static_cast<size_t>(i)] == slot_) chainPos_ = i;
        }
        if (pcIn_ >= 0) {
            const int pc = std::min(127, pcIn_);
            pcIn_ = -1;
            chainN_ = 0;
            if (playingNow) next_ = pc == slot_ ? -1 : pc;
            else if (pc != slot_) {
                slot_ = pc;
                fbPatSeq.fetch_add(1, std::memory_order_release);
            }
        }
        PA_ = &patOf(*ps, slot_);
        P_ = PA_->prog;
        fbPat.store(slot_, std::memory_order_relaxed);
    } else {
        PA_ = nullptr;
        P_ = nullptr;
    }
    // Le crossfader : x du bloc (le parametre XFADE), seulement pour un programme a scenes
    xOn_ = P_ && P_->xk.size() >= 2;
    xNow_ = static_cast<double>(x_.load(std::memory_order_relaxed));
    // Les effets du programme : un nouvel etat, ou un autre tempo (le temps du DELAY)
    const double bpm = tr.ppqPerSample > 0 ? tr.ppqPerSample * 60 * sr_ : (ps ? ps->prog.bpm : 130);
    if (ps && (ps != fxState_ || std::fabs(bpm - fxBpm_) > 0.01)) {
        if (ps != fxState_)
            for (int t = 0; t < kTracks; ++t) {
                sliceNow_[static_cast<size_t>(t)] = voiceSlAt(*ps, t);
                sliceSrc_[static_cast<size_t>(t)] = -1;
                sliceLfoD_[static_cast<size_t>(t)] = SliceFx{};
                fx_.setSlice(t, sliceNow_[static_cast<size_t>(t)], ps->prog.tracks[static_cast<size_t>(t)].kick);
            }
        fx_.setGlobal(globalAt(*ps), bpm);
        if (ps != fxState_) {
            irWant_ = irAt(*ps);
            fx_.setReverbIR(irWant_);
        }
        fxState_ = ps;
        fxBpm_ = bpm;
        xFx_ = xNow_;
    }
    if (ps) followX(*ps, bpm, n);
    fx_.clearTracks(n);
    const double pps = tr.ppqPerSample;
    const double stepN = pps > 0 ? 0.25 / pps : 0; // echantillons par pas
    int ne = 0;
    auto push = [&](const Ev& e) {
        if (ne < kEvCap) ev_[static_cast<size_t>(ne++)] = e;
    };
    auto soundOf = [&](int i) -> RenderedSound* {
        return ps && i >= 0 && i < static_cast<int>(ps->sounds.size()) ? ps->sounds[static_cast<size_t>(i)].get() : nullptr;
    };

    // Les coups en direct de la face (au debut du bloc)
    for (int r = liveR_.load(std::memory_order_relaxed); r != liveW_.load(std::memory_order_acquire); r = (r + 1) % kLiveCap) {
        const LiveHit& h = live_[static_cast<size_t>(r)];
        if (ps && h.track >= 0 && h.track < kTracks) {
            Ev e;
            e.track = h.track;
            e.slice = h.slice;
            e.vel = h.hit.vel;
            e.hit = h.hit;
            e.snd = h.snd;
            push(e);
        }
        liveR_.store((r + 1) % kLiveCap, std::memory_order_release);
    }
    // Les notes MIDI : le coup du pad de la piste, a la velocite de la note
    if (ps)
        for (int k = 0; k < nNotes; ++k) {
            const NoteEvent& nt = notes[k];
            if (nt.track < 0 || nt.track >= kTracks) continue;
            const ProgTrack& pt = P_->tracks[static_cast<size_t>(nt.track)];
            Ev e;
            e.offset = std::max(0, std::min(n - 1, nt.offset));
            e.track = nt.track;
            e.slice = pt.slice;
            e.vel = nt.vel;
            e.hi = -2;
            e.hit = pt.live;
            e.snd = soundOf(pt.live.snd);
            push(e);
        }

    // Le sequenceur : chaque pas est evalue un peu avant son heure (l'avance d'un uTIME negatif), ses coups attendent
    if (ps && tr.playing && pps > 0) {
        const double ppq0 = tr.ppq;
        const double ppq1 = ppq0 + n * pps;
        const bool start = !seqOn_;
        const bool jump = seqOn_ && std::fabs(ppq0 - expectPpq_) > pps * 2;
        if (start || jump) {
            seqReset(start);
            nextG_ = static_cast<long>(std::ceil(ppq0 * 4 - 1e-9));
            if (nextG_ < 0) nextG_ = 0;
            // Les LFO partent de PLAY (et d'un saut de l'hote : sa boucle, un clic sur la timeline)
            for (auto& t : ts_) t.anchor = static_cast<double>(nextG_);
            // Le pattern cale sur la mesure du morceau ; au depart, celui qui attendait, ou le debut de la chaine (un saut de
            // l'hote garde le pattern et ses passages)
            if (start) {
                int to = slot_;
                if (next_ >= 0) to = next_;
                else if (chainN_ > 1) {
                    chainPos_ = 0;
                    to = chain_[0];
                }
                next_ = -1;
                usePattern(*ps, to, 0, to != slot_);
            } else
                patStart_ = 0;
        }
        seqOn_ = true;
        expectPpq_ = ppq1;
        // L'avance : le uTIME le plus negatif du programme (au plus 23/24 de pas), en noires
        double lead = 0;
        for (const auto& pt : P_->tracks)
            for (const auto& h : pt.hits) lead = std::max(lead, -h.shift);
        lead *= 0.25;
        while (nextG_ * 0.25 - lead < ppq1) evalStep(*ps, nextG_++);
        // Les coups du bloc ; ceux d'apres restent ; un coup en retard d'un pas au plus part tout de suite
        int keep = 0;
        for (int i = 0; i < npend_; ++i) {
            Ev& e = pend_[static_cast<size_t>(i)];
            // A l'echantillon le plus proche (une position d'hote un rien sous le pas ne le fait pas partir un echantillon trop tot)
            const double off = std::floor((e.ppq - ppq0) / pps + 0.5);
            if (off >= n) {
                pend_[static_cast<size_t>(keep++)] = e;
                continue;
            }
            if (e.ppq < ppq0 - 0.25) continue;
            e.offset = std::max(0, static_cast<int>(off));
            push(e);
        }
        npend_ = keep;
        // La tete de lecture : le pas dont la grille (swing compris) tombe dans le bloc
        forEachStepRel(*P_, &programStepOf, ppq0, pps, n, [&](int g, int, long rel) {
            fbStep.store(g, std::memory_order_relaxed);
            fbMask.store(maskAt_[static_cast<size_t>(g % 128)], std::memory_order_relaxed);
            fbRel.store(static_cast<int>(rel % 1048576L), std::memory_order_relaxed);
            fbSeq.store(++seq_, std::memory_order_release);
        }, patStart_);
    } else if (seqOn_) {
        seqOn_ = false;
        seqReset(false);
    }
    if (tr.playing != wasPlaying_) {
        wasPlaying_ = tr.playing;
        if (!tr.playing) {
            fbStep.store(-1, std::memory_order_relaxed);
            fbRel.store(-1, std::memory_order_relaxed);
        }
        fbPlaying.store(tr.playing, std::memory_order_release);
    }

    // Dans l'ordre du temps (un coup coupe ceux d'avant : kick mono, choke, retrig), a offset egal dans l'ordre d'arrivee
    std::stable_sort(ev_.begin(), ev_.begin() + ne, [](const Ev& a, const Ev& b) { return a.offset < b.offset; });
    if (ps)
        for (int k = 0; k < ne; ++k) {
            const Ev& e = ev_[static_cast<size_t>(k)];
            // Le crossfader : le coup a la position du moment (ses reglages, son son, sa tranche)
            ProgHit hx;
            const ProgHit& h = hitAtX(*ps, e.track, e.hi, e.hit, hx);
            const float slice = xOn_ && e.hi != -1 ? trackSliceAt(*ps, e.track) : e.slice;
            RenderedSound* snd = e.snd;
            if (&h != &e.hit && h.snd != e.hit.snd) snd = soundOf(h.snd);
            if (e.lt) {
                // Ses envois et ses inserts vont a la tranche jusqu'au coup suivant de la voix (son TONE ne change rien)
                SliceFx sl = h.hasSl ? h.sl : voiceSlAt(*ps, e.track);
                sl.tone = sliceNow_[static_cast<size_t>(e.track)].tone;
                applySlice(*ps, e.track, sl);
                if (h.hasSl) {
                    sliceSrc_[static_cast<size_t>(e.track)] = e.hi >= 0 ? e.hi : -3;
                    sliceLfoD_[static_cast<size_t>(e.track)] = SliceFx{};
                }
                lockTrig(h, e.track, e.offset, e.re, e.anchor);
            } else
                trigger(*ps, e.track, h, e.vel, slice, snd, e.offset, e.lenSteps, e.rep, stepN, e.ppq * 4, e.anchor, e.hi);
        }

    // Les voix, dans la tranche de leur piste (ou tout droit dans la sortie, sans effets)
    const int relN = std::max(1, static_cast<int>(LEN_REL_S * sr_));
    // Le glissement d'un lock trig (setTargetAtTime, 1 ms) : par echantillon pour le gain, par 16 pour le PAN
    const float kG = static_cast<float>(1 - std::exp(-1.0 / (LIVE_TAU_S * sr_)));
    const double kP = 1 - std::exp(-16.0 / (LIVE_TAU_S * sr_));
    for (int t = 0; t < kTracks; ++t) {
        float* TL = dry_ ? L : fx_.trackL(t);
        float* TR = dry_ ? R : fx_.trackR(t);
        bool any = false;
        // Le crossfader : le niveau de tranche de la piste (LEVEL, TRK LEV) suit x pendant que ses coups sonnent
        const float sNow = xOn_ && ps ? trackSliceAt(*ps, t) : 0.f;
        for (auto& v : voices_[static_cast<size_t>(t)]) {
            if (v.shot) any = true;
            if (!v.shot) continue;
            const float rTo = xOn_ && v.slice > 0 ? sNow / v.slice : 1.f;
            const float rStep = (rTo - v.sRatio) / static_cast<float>(n);
            const std::vector<float>& sl = v.shot->L;
            const std::vector<float>& sr = v.shot->right();
            const size_t len = sl.size();
            int i = 0;
            if (v.delay > 0) {
                i = std::min(n, v.delay);
                v.delay -= i;
            }
            bool done = false;
            for (; i < n; ++i) {
                // Un lock trig a son heure
                if (v.pl.on && v.t >= v.pl.at) applyLock(v);
                const bool pitched = v.cv[CV_PITCH].on;
                if ((pitched ? v.fpos >= static_cast<double>(len) : v.pos >= len) || v.fadeLeft == 0 || (v.stopN >= 0 && v.t >= v.stopN)) {
                    done = true;
                    break;
                }
                // LEN : un relachement de 8 ms a la fin de LEN, puis la source s'arrete
                if (v.cutN >= 0 && v.t >= v.cutN && v.fadeLeft < 0) {
                    v.fadeLeft = relN;
                    v.fadeLen = relN;
                    v.fadeHold = 0;
                }
                double env = 1;
                if (v.atkN > 0 && v.t < v.atkN) env = v.t / v.atkN;
                if (v.tauN > 0 && v.t > v.holdEndN) env *= std::exp(-(v.t - v.holdEndN) / v.tauN);
                if (v.gain != v.gainTo) {
                    v.gain += (v.gainTo - v.gain) * kG;
                    if (std::fabs(v.gainTo - v.gain) < 1e-7f) v.gain = v.gainTo;
                }
                if (rStep != 0) v.sRatio += rStep;
                float f = v.gain * static_cast<float>(env) * v.sRatio;
                const bool tick = (static_cast<long>(v.t) & 15) == 0;
                if (v.anyCv) {
                    if (v.cv[CV_VOL].on) f *= static_cast<float>(curveAt(v, CV_VOL, v.t));
                    if (tick && v.cv[CV_PAN].on) setPan(v, curveAt(v, CV_PAN, v.t));
                }
                // Un lock trig PAN : le panoramique glisse
                if (tick && v.panNow != v.panTo && !v.cv[CV_PAN].on) {
                    double pn = v.panNow + (v.panTo - v.panNow) * kP;
                    if (std::fabs(v.panTo - pn) < 1e-6) pn = v.panTo;
                    setPan(v, pn);
                }
                if (v.fadeLeft > 0) {
                    if (v.fadeHold > 0) --v.fadeHold;
                    else {
                        f *= static_cast<float>(v.fadeLeft) / static_cast<float>(v.fadeLen);
                        --v.fadeLeft;
                    }
                }
                float a, b;
                if (pitched) {
                    // Un LFO PITCH : la lecture a la vitesse 2^(cents / 1200), interpolee (la source a playbackRate du site)
                    const size_t i0 = static_cast<size_t>(v.fpos);
                    const size_t i1 = std::min(i0 + 1, len - 1);
                    const float fr = static_cast<float>(v.fpos - static_cast<double>(i0));
                    a = sl[i0] + (sl[i1] - sl[i0]) * fr;
                    b = sr[i0] + (sr[i1] - sr[i0]) * fr;
                } else {
                    a = sl[v.pos];
                    b = sr[v.pos];
                }
                if (v.ft) {
                    // La coupure suit son enveloppe (et les LFO FREQ, RESO) : les coefficients tous les 16 echantillons
                    if (tick && (v.fEnv || v.cv[CV_FREQ].on || v.cv[CV_RESO].on)) updateFilter(v);
                    const double ya = v.b0 * a + v.zL1;
                    v.zL1 = v.b1 * a - v.a1 * ya + v.zL2;
                    v.zL2 = v.b2 * a - v.a2 * ya;
                    a = static_cast<float>(ya);
                    if (v.shot->mono) b = a;
                    else {
                        const double yb = v.b0 * b + v.zR1;
                        v.zR1 = v.b1 * b - v.a1 * yb + v.zR2;
                        v.zR2 = v.b2 * b - v.a2 * yb;
                        b = static_cast<float>(yb);
                    }
                }
                TL[i] += f * (v.gLL * a + v.gLR * b);
                TR[i] += f * (v.gRL * a + v.gRR * b);
                if (pitched) v.fpos += std::exp2(curveAt(v, CV_PITCH, v.t) / 1200);
                else ++v.pos;
                v.t += 1;
            }
            v.sRatio = rTo; // la rampe finit pile sur sa cible (sans le reste des additions)
            if (done || (v.cv[CV_PITCH].on ? v.fpos >= static_cast<double>(len) : v.pos >= len) || v.fadeLeft == 0) release(v);
        }
        if (any) fx_.markActive(t);
    }
    if (!dry_) {
        fx_.process(L, R, n);
        for (int t = 0; t < kTracks; ++t) {
            const float p = fx_.takePeak(t);
            auto& a = fbPeak[static_cast<size_t>(t)];
            if (p > a.load(std::memory_order_relaxed)) a.store(p, std::memory_order_relaxed);
        }
    }

    if (ps) ps->users.fetch_sub(1, std::memory_order_acq_rel);
}

} // namespace mm
