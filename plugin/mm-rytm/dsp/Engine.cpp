#include "Engine.h"

#include <algorithm>

namespace mm {

namespace {
constexpr double PI = 3.14159265358979323846;
// Le kick monophonique : le coup suivant coupe le precedent en 3 ms ; une porte du groupe de choke se ferme en 8 ms ;
// une piste qui depasse ses 4 voix ferme la plus vieille en 8 ms (audio/drums.ts).
constexpr double MONO_CUT_S = 0.003;
constexpr double CHOKE_S = 0.008;
constexpr double STEAL_S = 0.008;
// Un etat ou un son retire est libere 2 s apres, quand plus personne ne le lit.
constexpr double RETIRE_S = 2.0;
} // namespace

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
}

/* ---------------- thread du calcul ---------------- */

void Engine::publish(std::shared_ptr<PlayState> s) {
    PlayState* raw = s.get();
    // l'index pas -> coup de chaque piste
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
    // Un son n'est plus tenu que par cette liste (aucun etat, aucun cache) : libere 2 s apres, sans voix qui le joue
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

/* ---------------- thread audio ---------------- */

void Engine::release(Voice& v) {
    if (v.snd) v.snd->users.fetch_sub(1, std::memory_order_acq_rel);
    v = Voice{};
}

void Engine::allNotesOff() {
    for (auto& tv : voices_)
        for (auto& v : tv) release(v);
}

void Engine::fadeTrack(int track, int samples, int offset) {
    for (auto& v : voices_[static_cast<size_t>(track)]) {
        if (!v.shot) continue;
        if (v.delay > offset) {
            // pas encore parti avant le nouveau coup : il ne sonnera pas
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

void Engine::trigger(const PlayState& ps, int track, const ProgHit& h, float slice, RenderedSound* snd, int offset) {
    if (!snd || snd->variants.empty()) return;
    const ProgTrack& tr = ps.prog.tracks[static_cast<size_t>(track)];
    const bool gated = tr.choke > 0 && tr.gated;
    const bool mono = tr.mono && !gated;
    // Le groupe de choke : un coup ferme les portes du groupe (les pistes gated de meme numero, elle comprise)
    if (tr.choke > 0)
        for (int u = 0; u < kTracks; ++u) {
            const ProgTrack& o = ps.prog.tracks[static_cast<size_t>(u)];
            if (o.choke == tr.choke && o.gated) fadeTrack(u, static_cast<int>(CHOKE_S * sr_), offset);
        }
    if (mono) fadeTrack(track, static_cast<int>(MONO_CUT_S * sr_), offset);

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
    // START : plus loin dans l'echantillon, sa fin avance d'autant
    v.pos = static_cast<size_t>(std::max(0.0, std::min(1.0, h.start)) * static_cast<double>(shot.size()));
    v.gain = static_cast<float>(std::max(0.f, h.vel) * h.gain * slice);
    // PAN (audio/drums.ts voice) : au centre, le son tel quel ; hors du centre, un son mono a puissance constante (hitParams
    // a deja mis x racine de 2 dans gain), un son stereo par le panoramique stereo de Web Audio puis x 1 / racine de 2
    const double pan = std::max(-1.0, std::min(1.0, h.pan));
    if (pan == 0) {
        v.gLL = 1; v.gRL = 0; v.gLR = 0; v.gRR = 1;
    } else if (shot.mono) {
        const double x = (pan + 1) / 2;
        v.gLL = static_cast<float>(std::cos(x * PI / 2));
        v.gRR = static_cast<float>(std::sin(x * PI / 2));
        v.gRL = 0; v.gLR = 0; // un son mono : L == R a l'entree, gLL et gRR le placent
    } else {
        const double c = 1.0 / std::sqrt(2.0);
        if (pan <= 0) {
            const double x = pan + 1;
            v.gLL = static_cast<float>(c); v.gLR = static_cast<float>(c * std::cos(x * PI / 2));
            v.gRL = 0; v.gRR = static_cast<float>(c * std::sin(x * PI / 2));
        } else {
            const double x = pan;
            v.gLL = static_cast<float>(c * std::cos(x * PI / 2)); v.gLR = 0;
            v.gRL = static_cast<float>(c * std::sin(x * PI / 2)); v.gRR = static_cast<float>(c);
        }
    }
    // L'enveloppe : la rampe d'ATK, la tenue, puis DECAY (setTargetAtTime vers 0) ; la source s'arrete 7 tau apres
    v.atkN = std::max(0.0, h.atk) * sr_;
    v.holdEndN = (std::max(0.0, h.atk) + std::max(0.0, h.hold)) * sr_;
    v.tauN = h.tau > 0 ? h.tau * sr_ : -1;
    v.stopN = v.tauN > 0 ? v.holdEndN + 7 * v.tauN : -1;
}

void Engine::process(const BlockTransport& tr, float* L, float* R, int n, const NoteEvent* notes, int nNotes) {
    PlayState* ps = current_.load(std::memory_order_acquire);
    if (ps) ps->users.fetch_add(1, std::memory_order_acq_rel);
    int ne = 0;
    auto push = [&](int offset, int track, float slice, const ProgHit& h, RenderedSound* snd) {
        if (ne >= kEvCap) return;
        Ev& e = ev_[static_cast<size_t>(ne++)];
        e.offset = offset;
        e.track = track;
        e.slice = slice;
        e.hit = h;
        e.snd = snd;
    };
    auto soundOf = [&](int i) -> RenderedSound* {
        return ps && i >= 0 && i < static_cast<int>(ps->sounds.size()) ? ps->sounds[static_cast<size_t>(i)].get() : nullptr;
    };

    // Les coups en direct de la face (au debut du bloc)
    for (int r = liveR_.load(std::memory_order_relaxed); r != liveW_.load(std::memory_order_acquire); r = (r + 1) % kLiveCap) {
        const LiveHit& h = live_[static_cast<size_t>(r)];
        if (ps && h.track >= 0 && h.track < kTracks) push(0, h.track, h.slice, h.hit, h.snd);
        liveR_.store((r + 1) % kLiveCap, std::memory_order_release);
    }
    // Les notes MIDI : le coup du pad de la piste, a la velocite de la note
    if (ps)
        for (int k = 0; k < nNotes; ++k) {
            const NoteEvent& nt = notes[k];
            if (nt.track < 0 || nt.track >= kTracks) continue;
            const ProgTrack& pt = ps->prog.tracks[static_cast<size_t>(nt.track)];
            ProgHit h = pt.live;
            h.vel = nt.vel;
            push(std::max(0, std::min(n - 1, nt.offset)), nt.track, pt.slice, h, soundOf(h.snd));
        }

    // Le sequenceur
    if (ps && tr.playing) {
        const Program& p = ps->prog;
        forEachStep(p, &programStepOf, tr.ppq, tr.ppqPerSample, n, [&](int g, int off) {
            int mask = 0;
            for (int t = 0; t < kTracks; ++t) {
                const ProgTrack& pt = p.tracks[static_cast<size_t>(t)];
                if (!pt.plays) continue;
                const auto& at = ps->at[static_cast<size_t>(t)];
                if (g < 0 || g >= static_cast<int>(at.size())) continue;
                const int hi = at[static_cast<size_t>(g)];
                if (hi < 0) continue;
                const ProgHit& h = pt.hits[static_cast<size_t>(hi)];
                push(off, t, pt.slice, h, soundOf(h.snd));
                if (t < 8) mask |= 1 << t;
            }
            fbStep.store(g, std::memory_order_relaxed);
            fbMask.store(mask, std::memory_order_relaxed);
            fbSeq.store(++seq_, std::memory_order_release);
        });
    }
    if (tr.playing != wasPlaying_) {
        wasPlaying_ = tr.playing;
        if (!tr.playing) fbStep.store(-1, std::memory_order_relaxed);
        fbPlaying.store(tr.playing, std::memory_order_release);
    }

    // Dans l'ordre du temps (un coup coupe ceux d'avant : kick mono, choke), a offset egal dans l'ordre d'arrivee
    std::stable_sort(ev_.begin(), ev_.begin() + ne, [](const Ev& a, const Ev& b) { return a.offset < b.offset; });
    if (ps)
        for (int k = 0; k < ne; ++k) {
            const Ev& e = ev_[static_cast<size_t>(k)];
            trigger(*ps, e.track, e.hit, e.slice, e.snd, e.offset);
        }

    // Les voix
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
                double env = 1;
                if (v.atkN > 0 && v.t < v.atkN) env = v.t / v.atkN;
                if (v.tauN > 0 && v.t > v.holdEndN) env *= std::exp(-(v.t - v.holdEndN) / v.tauN);
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
