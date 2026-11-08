#include "Engine.h"

namespace mm {

namespace {
const ShotId kShot[kTracks] = {ShotId::BD, ShotId::SD, ShotId::CH, ShotId::OH, ShotId::CP, ShotId::TOM, ShotId::HT, ShotId::CY};
const char* kName[kTracks] = {"BD", "SD", "CH", "OH", "CP", "TOM", "HT", "CY"};
const char* kFamily[kTracks] = {"bd", "sd", "ch", "oh", "cp", "tom", "ht", "cy"};

// Le kick monophonique : le coup suivant coupe le precedent en 3 ms ; le choke des charleys en 8 ms (le site).
constexpr double KICK_CUT_S = 0.003;
constexpr double CHOKE_S = 0.008;
// Une piste poly coupe sa plus vieille voix en 8 ms quand ses 4 voix jouent.
constexpr double STEAL_S = 0.008;
// Un son retire est libere 2 s apres, quand plus aucune voix ne le joue.
constexpr double RETIRE_S = 2.0;

bool isMonoTrack(int t) { return t == T_BD; }
// Le groupe de choke : CH et OH se ferment l'un l'autre.
int chokeGroup(int t) { return t == T_CH || t == T_OH ? 1 : 0; }
} // namespace

ShotId shotOfTrack(int t) { return kShot[t]; }
const char* trackName(int t) { return kName[t]; }
const char* trackFamily(int t) { return kFamily[t]; }

void Engine::prepare(double sampleRate) {
    sr_ = sampleRate;
    allNotesOff();
}

void Engine::publish(int track, std::shared_ptr<TrackSound> s) {
    TrackSound* raw = s.get();
    owned_.push_back(std::move(s));
    live_[track] = owned_.back();
    current_[track].store(raw, std::memory_order_release);
}

void Engine::collect(double now) {
    for (size_t i = 0; i < owned_.size();) {
        auto& s = owned_[i];
        bool isLive = false;
        for (auto& l : live_)
            if (l == s) isLive = true;
        if (isLive) {
            ++i;
            continue;
        }
        if (s->retiredAt < 0) s->retiredAt = now;
        if (now - s->retiredAt > RETIRE_S && s->users.load(std::memory_order_acquire) == 0) {
            owned_.erase(owned_.begin() + static_cast<long>(i));
            continue;
        }
        ++i;
    }
}

void Engine::release(Voice& v) {
    if (v.snd) v.snd->users.fetch_sub(1, std::memory_order_acq_rel);
    v = Voice{};
}

void Engine::allNotesOff() {
    for (auto& tv : voices_)
        for (auto& v : tv) release(v);
}

void Engine::fadeTrack(int track, int samples, int offset) {
    for (auto& v : voices_[track]) {
        if (!v.shot) continue;
        if (v.delay > offset) {
            // pas encore commence avant le nouveau coup : il ne sonnera pas
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

void Engine::trigger(int track, float vel, int offset) {
    if (track < 0 || track >= kTracks) return;
    if (isMonoTrack(track)) fadeTrack(track, static_cast<int>(KICK_CUT_S * sr_), offset);
    const int g = chokeGroup(track);
    if (g)
        for (int t = 0; t < kTracks; ++t)
            if (chokeGroup(t) == g) fadeTrack(t, static_cast<int>(CHOKE_S * sr_), offset);
    startVoice(track, vel, offset);
}

void Engine::startVoice(int track, float vel, int offset) {
    TrackSound* snd = current_[track].load(std::memory_order_acquire);
    if (!snd || snd->variants.empty()) return;
    snd->users.fetch_add(1, std::memory_order_acq_rel);
    auto& tv = voices_[track];
    // Polyphonie : kPoly voix qui sonnent ; au-dela, la plus vieille se ferme en 8 ms (elle garde sa case le temps du fondu).
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
        // toutes les cases prises (des fondus en cours) : la voix la plus proche de sa fin
        slot = &tv[0];
        for (auto& v : tv) {
            const int a = v.fadeLeft < 0 ? 1 << 30 : v.fadeLeft;
            const int b = slot->fadeLeft < 0 ? 1 << 30 : slot->fadeLeft;
            if (a < b) slot = &v;
        }
        release(*slot);
    }
    const int nv = static_cast<int>(snd->variants.size());
    const int vi = nextVariant_[track] % nv;
    nextVariant_[track] = (vi + 1) % nv;
    slot->snd = snd;
    slot->shot = &snd->variants[static_cast<size_t>(vi)];
    slot->pos = 0;
    slot->delay = std::max(0, offset);
    slot->vel = vel;
    slot->fadeLeft = -1;
    slot->age = ++clock_;
}

void Engine::render(float* mainL, float* mainR, float* const* auxL, float* const* auxR, int n) {
    for (int t = 0; t < kTracks; ++t) {
        const TrackMix& m = mix_[t];
        float* outL = mainL;
        float* outR = mainR;
        if (m.ownOut && auxL && auxR && auxL[t] && auxR[t]) {
            outL = auxL[t];
            outR = auxR[t];
        }
        const float pan = std::max(-1.f, std::min(1.f, m.pan));
        const float gl = m.gain * std::min(1.f, 1.f - pan);
        const float gr = m.gain * std::min(1.f, 1.f + pan);
        float peak = 0;
        for (auto& v : voices_[t]) {
            if (!v.shot) continue;
            const std::vector<float>& L = v.shot->L;
            const std::vector<float>& R = v.shot->right();
            const size_t len = L.size();
            int i = 0;
            if (v.delay > 0) {
                i = std::min(n, v.delay);
                v.delay -= i;
            }
            const float a = v.vel * gl;
            const float b = v.vel * gr;
            for (; i < n; ++i) {
                if (v.pos >= len || v.fadeLeft == 0) break;
                float f = 1.f;
                if (v.fadeLeft > 0) {
                    if (v.fadeHold > 0) --v.fadeHold;
                    else {
                        f = static_cast<float>(v.fadeLeft) / static_cast<float>(v.fadeLen);
                        --v.fadeLeft;
                    }
                }
                const float l = L[v.pos] * a * f;
                const float r = R[v.pos] * b * f;
                ++v.pos;
                if (!m.mute) {
                    outL[i] += l;
                    outR[i] += r;
                    peak = std::max(peak, std::max(std::fabs(l), std::fabs(r)));
                }
            }
            if (v.pos >= len || v.fadeLeft == 0) release(v);
        }
        if (peak > peak_[t].load(std::memory_order_relaxed)) peak_[t].store(peak, std::memory_order_relaxed);
    }
}

} // namespace mm
