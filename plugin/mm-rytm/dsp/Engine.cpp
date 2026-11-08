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
// Un lock trig fait glisser le gain du coup qui sonne (glideTo du site) en 10 ms.
constexpr double GLIDE_S = 0.01;
// Un etat ou un son retire est libere 2 s apres, quand plus personne ne le lit.
constexpr double RETIRE_S = 2.0;
constexpr double EPS = 1e-9;
constexpr double INF = std::numeric_limits<double>::infinity();

// La matrice du PAN (audio/drums.ts voice) : au centre, le son tel quel ; un son mono a puissance constante (le x racine
// de 2 est deja dans le gain du coup) ; un son stereo par le panoramique stereo de Web Audio puis x 1 / racine de 2.
void panMatrix(double pan, bool mono, float& LL, float& LR, float& RL, float& RR) {
    pan = std::max(-1.0, std::min(1.0, pan));
    if (pan == 0) {
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
}

/* ---------------- thread du calcul ---------------- */

void Engine::publish(std::shared_ptr<PlayState> s) {
    PlayState* raw = s.get();
    for (int t = 0; t < kTracks; ++t) {
        auto& at = s->at[static_cast<size_t>(t)];
        at.assign(static_cast<size_t>(std::max(1, std::min(128, s->prog.len))), -1);
        const auto& hits = s->prog.tracks[static_cast<size_t>(t)].hits;
        for (size_t i = 0; i < hits.size(); ++i)
            if (hits[i].g >= 0 && hits[i].g < static_cast<int>(at.size())) at[static_cast<size_t>(hits[i].g)] = static_cast<int>(i);
    }
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

void Engine::trigger(const PlayState& ps, int track, const ProgHit& h, float vel, float slice, RenderedSound* snd, int offset, double lenSteps, bool rep, double stepN) {
    if (!snd || snd->variants.empty()) return;
    const ProgTrack& tr = ps.prog.tracks[static_cast<size_t>(track)];
    const bool gated = tr.choke > 0 && tr.gated;
    const bool mono = tr.mono && !gated;
    if (tr.choke > 0)
        for (int u = 0; u < kTracks; ++u) {
            const ProgTrack& o = ps.prog.tracks[static_cast<size_t>(u)];
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
    v.gain = static_cast<float>(v.vel * h.gain * slice);
    v.gainTo = v.gain;
    v.gainStep = 0;
    panMatrix(h.pan, shot.mono, v.gLL, v.gLR, v.gRL, v.gRR);
    v.atkN = std::max(0.0, h.atk) * sr_;
    v.holdEndN = (std::max(0.0, h.atk) + std::max(0.0, h.hold)) * sr_;
    v.tauN = h.tau > 0 ? h.tau * sr_ : -1;
    v.stopN = v.tauN > 0 ? v.holdEndN + 7 * v.tauN : -1;
    v.cutN = lenSteps > 0 && stepN > 0 ? lenSteps * stepN : -1;
}

void Engine::lockTrig(const ProgHit& h, int track, float slice, int offset) {
    // Le coup qui sonne de la voix (le plus recent) : son VOL et son PAN prennent ceux du lock trig, en glissant
    Voice* last = nullptr;
    for (auto& v : voices_[static_cast<size_t>(track)])
        if (v.shot && v.fadeLeft < 0 && v.delay <= offset && (!last || v.age > last->age)) last = &v;
    if (!last) return;
    last->gainTo = static_cast<float>(last->vel * h.gain * slice);
    const int n = std::max(1, static_cast<int>(GLIDE_S * sr_));
    last->gainStep = (last->gainTo - last->gain) / static_cast<float>(n);
    panMatrix(h.pan, last->shot->mono, last->gLL, last->gLR, last->gRL, last->gRR);
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
bool Engine::repeats(int track, Retrig& rt, double from, double to, double before) {
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
        e.hit = rt.hit;
        e.snd = rt.snd;
        pendPush(e);
    }
}

// Un pas (le seizieme G depuis le debut du morceau) : ses coups et ses lock trigs, voix par voix dans l'ordre des pads.
void Engine::evalStep(const PlayState& ps, long G) {
    const Program& p = ps.prog;
    const int g = programStepOf(p, G);
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
        const auto& at = ps.at[static_cast<size_t>(t)];
        const int hi = g >= 0 && g < static_cast<int>(at.size()) ? at[static_cast<size_t>(g)] : -1;
        if (hi < 0) {
            if (sv.rt.on && !repeats(t, sv.rt, static_cast<double>(G), stepEnd, INF)) endRetrig(sv.rt);
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
            if (sv.rt.on && !repeats(t, sv.rt, static_cast<double>(G), stepEnd, INF)) endRetrig(sv.rt);
            if (!ok) continue;
            Ev e;
            e.ppq = pos * 0.25;
            e.track = t;
            e.slice = pt.slice;
            e.lt = true;
            e.hit = h;
            pendPush(e);
            continue;
        }
        if (!ok || !pt.plays) {
            if (sv.rt.on && !repeats(t, sv.rt, static_cast<double>(G), stepEnd, INF)) endRetrig(sv.rt);
            continue;
        }
        // Le trig joue : le retrig d'avant s'arrete a son heure (ses repetitions d'avant lui partent)
        if (sv.rt.on) {
            repeats(t, sv.rt, static_cast<double>(G), stepEnd, pos);
            endRetrig(sv.rt);
        }
        Ev e;
        e.ppq = pos * 0.25;
        e.track = t;
        e.slice = pt.slice;
        e.vel = h.vel;
        e.lenSteps = h.len;
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
            rt.hit = h;
            rt.snd = snd;
            snd->users.fetch_add(1, std::memory_order_acq_rel);
            if (!repeats(t, rt, pos, stepEnd, INF)) endRetrig(rt);
        }
    }
    maskAt_[static_cast<size_t>(g % 128)] = mask;
}

/* ---------------- le bloc ---------------- */

void Engine::process(const BlockTransport& tr, float* L, float* R, int n, const NoteEvent* notes, int nNotes) {
    PlayState* ps = current_.load(std::memory_order_acquire);
    if (ps) ps->users.fetch_add(1, std::memory_order_acq_rel);
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
            const ProgTrack& pt = ps->prog.tracks[static_cast<size_t>(nt.track)];
            Ev e;
            e.offset = std::max(0, std::min(n - 1, nt.offset));
            e.track = nt.track;
            e.slice = pt.slice;
            e.vel = nt.vel;
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
        }
        seqOn_ = true;
        expectPpq_ = ppq1;
        // L'avance : le uTIME le plus negatif du programme (au plus 23/24 de pas), en noires
        double lead = 0;
        for (const auto& pt : ps->prog.tracks)
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
        forEachStep(ps->prog, &programStepOf, ppq0, pps, n, [&](int g, int) {
            fbStep.store(g, std::memory_order_relaxed);
            fbMask.store(maskAt_[static_cast<size_t>(g % 128)], std::memory_order_relaxed);
            fbSeq.store(++seq_, std::memory_order_release);
        });
    } else if (seqOn_) {
        seqOn_ = false;
        seqReset(false);
    }
    if (tr.playing != wasPlaying_) {
        wasPlaying_ = tr.playing;
        if (!tr.playing) fbStep.store(-1, std::memory_order_relaxed);
        fbPlaying.store(tr.playing, std::memory_order_release);
    }

    // Dans l'ordre du temps (un coup coupe ceux d'avant : kick mono, choke, retrig), a offset egal dans l'ordre d'arrivee
    std::stable_sort(ev_.begin(), ev_.begin() + ne, [](const Ev& a, const Ev& b) { return a.offset < b.offset; });
    if (ps)
        for (int k = 0; k < ne; ++k) {
            const Ev& e = ev_[static_cast<size_t>(k)];
            if (e.lt) lockTrig(e.hit, e.track, e.slice, e.offset);
            else trigger(*ps, e.track, e.hit, e.vel, e.slice, e.snd, e.offset, e.lenSteps, e.rep, stepN);
        }

    // Les voix
    const int relN = std::max(1, static_cast<int>(LEN_REL_S * sr_));
    for (int t = 0; t < kTracks; ++t) {
        for (auto& v : voices_[static_cast<size_t>(t)]) {
            if (!v.shot) continue;
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
                if (v.pos >= len || v.fadeLeft == 0 || (v.stopN >= 0 && v.t >= v.stopN)) {
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
                if (v.gainStep != 0) {
                    v.gain += v.gainStep;
                    if ((v.gainStep > 0 && v.gain >= v.gainTo) || (v.gainStep < 0 && v.gain <= v.gainTo)) {
                        v.gain = v.gainTo;
                        v.gainStep = 0;
                    }
                }
                float f = v.gain * static_cast<float>(env);
                if (v.fadeLeft > 0) {
                    if (v.fadeHold > 0) --v.fadeHold;
                    else {
                        f *= static_cast<float>(v.fadeLeft) / static_cast<float>(v.fadeLen);
                        --v.fadeLeft;
                    }
                }
                const float a = sl[v.pos];
                const float b = sr[v.pos];
                L[i] += f * (v.gLL * a + v.gLR * b);
                R[i] += f * (v.gRL * a + v.gRR * b);
                ++v.pos;
                v.t += 1;
            }
            if (done || v.pos >= len || v.fadeLeft == 0) release(v);
        }
    }

    if (ps) ps->users.fetch_sub(1, std::memory_order_acq_rel);
}

} // namespace mm
