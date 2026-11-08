// MM-RYTM : le moteur temps reel du plugin (voix, choke, kick monophonique, sequenceur 8 x 16).
// Sans JUCE : le plugin l'appelle depuis processBlock, tests/engine_test.cpp le pilote seul.
// Regle temps reel : rien n'alloue, ne bloque ni ne libere dans render() / trigger() / Sequencer::process().
#pragma once

#include "Shots.h"

#include <algorithm>
#include <array>
#include <atomic>
#include <cstdint>
#include <cmath>
#include <memory>
#include <vector>

namespace mm {

constexpr int kTracks = 8;
constexpr int kSteps = 16;
constexpr int kPoly = 4;           // voix qui sonnent ensemble sur une piste
constexpr int kVoicesPerTrack = 6; // + 2 cases pour les fondus de sortie

// Les 8 pistes du MM-RYTM (une famille par voix, l'ordre de la face).
enum Track { T_BD, T_SD, T_CH, T_OH, T_CP, T_TOM, T_HT, T_CY };

ShotId shotOfTrack(int t);
const char* trackName(int t);
const char* trackFamily(int t); // "bd", "sd"... (dossier des samples)

// Le son calcule d'une piste : ses variantes (jouees en alternance). Ecrit une fois, puis lu seul.
struct TrackSound {
    std::vector<Shot> variants;
    std::atomic<int> users{0};    // voix qui le jouent (audio)
    double retiredAt = -1;        // horloge du collecteur quand il a cesse d'etre courant
};

// Le mix d'une piste, ecrit par le plugin a chaque bloc.
struct TrackMix {
    float gain = 1.f;   // lineaire
    float pan = 0.f;    // -1..1
    bool mute = false;
    bool ownOut = false; // sortie separee (multi-out)
};

class Engine {
public:
    void prepare(double sampleRate);
    double sampleRate() const { return sr_; }

    // --- thread du calcul (jamais l'audio) ---
    // Publie le nouveau son d'une piste. L'ancien reste vivant tant qu'une voix le joue.
    void publish(int track, std::shared_ptr<TrackSound> s);
    // Libere les sons retires que plus aucune voix ne joue (appele regulierement, now en secondes).
    void collect(double now);
    bool hasSound(int track) const { return current_[track].load(std::memory_order_acquire) != nullptr; }

    // --- thread audio ---
    void setMix(int track, const TrackMix& m) { mix_[track] = m; }
    // Un coup, a l'echantillon offset du bloc qui va etre rendu. vel 0..1.
    void trigger(int track, float vel, int offset);
    // main : 2 canaux. aux : 8 x 2 canaux ou nullptr (la piste revient alors sur main). Les sorties sont ADDITIONNEES.
    void render(float* mainL, float* mainR, float* const* auxL, float* const* auxR, int n);
    // Coupe tout (stop du transport, changement de frequence).
    void allNotesOff();

    // Niveau crete de chaque piste depuis la derniere lecture (pour les LED de la face).
    float takePeak(int track) { return peak_[track].exchange(0.f, std::memory_order_relaxed); }

private:
    struct Voice {
        TrackSound* snd = nullptr;
        const Shot* shot = nullptr;
        size_t pos = 0;
        int delay = 0;       // echantillons avant le debut (offset dans le bloc)
        float vel = 1.f;
        int fadeLeft = -1;   // >= 0 : en fondu de sortie
        int fadeLen = 1;
        int fadeHold = 0;    // echantillons joues avant que le fondu commence
        uint32_t age = 0;
    };
    struct Pending {
        int track;
        float vel;
        int offset;
    };

    void startVoice(int track, float vel, int offset);
    void fadeTrack(int track, int samples, int offset);
    void release(Voice& v);

    double sr_ = 48000;
    std::array<std::atomic<TrackSound*>, kTracks> current_{};
    std::array<std::array<Voice, kVoicesPerTrack>, kTracks> voices_{};
    std::array<int, kTracks> nextVariant_{};
    std::array<TrackMix, kTracks> mix_{};
    std::array<std::atomic<float>, kTracks> peak_{};
    uint32_t clock_ = 0;

    // Proprietaires des sons (thread du calcul seulement).
    std::vector<std::shared_ptr<TrackSound>> owned_;
    std::array<std::shared_ptr<TrackSound>, kTracks> live_{};
};

// Le sequenceur : 8 pistes x 16 pas, cale sur la position de l'hote (en noires, ppq).
// Un pas : 0 eteint, 1 allume, 2 accent.
class Sequencer {
public:
    std::array<std::array<std::atomic<uint8_t>, kSteps>, kTracks> steps{};

    // Appelle hit(track, vel, offset) pour chaque pas qui tombe dans [ppq0, ppq0 + n * ppqPerSample).
    // swing : 0.5 (droit) a 0.8, la place du second double-croche de chaque paire. length : 1 a 16 pas.
    template <typename Hit>
    void process(double ppq0, double ppqPerSample, int n, double swing, int length, Hit&& hit) {
        if (n <= 0 || ppqPerSample <= 0) return;
        const double ppq1 = ppq0 + n * ppqPerSample;
        const long p0 = static_cast<long>(std::floor(ppq0 / 0.5)) - 1;
        const long p1 = static_cast<long>(std::floor(ppq1 / 0.5));
        for (long p = p0; p <= p1; ++p) {
            for (int e = 0; e < 2; ++e) {
                const double pos = p * 0.5 + (e == 1 ? 0.5 * swing : 0.0);
                if (pos < ppq0 || pos >= ppq1) continue;
                const long g = 2 * p + e;
                if (g < 0) continue;
                const int step = static_cast<int>(g % length);
                const int off = std::min(n - 1, std::max(0, static_cast<int>((pos - ppq0) / ppqPerSample)));
                for (int t = 0; t < kTracks; ++t) {
                    const uint8_t v = steps[t][step].load(std::memory_order_relaxed);
                    if (v) hit(t, v == 2 ? 1.f : 100.f / 127.f, off);
                }
                currentStep.store(step, std::memory_order_relaxed);
            }
        }
    }

    std::atomic<int> currentStep{-1};
};

} // namespace mm
