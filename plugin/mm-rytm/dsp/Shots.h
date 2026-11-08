// MM-RYTM : le calcul des one-shots, porte de src/v4/audio/shotsdsp.ts (+ sampledsp.ts, stretch.ts).
// C++17 pur, sans JUCE : testable seul (tests/compare.cpp) et appele hors du thread audio par le plugin.
// Chaque fonction suit son original TypeScript ligne a ligne ; un ecart de son est un bug du portage.
#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace mm {

// Les 9 moteurs (EngineId du site) : BD SD CH CHopen OH CP TOM HT CY.
enum class ShotId { BD, SD, CH, CHopen, OH, CP, TOM, HT, CY };
constexpr int kNumShotIds = 9;

const char* shotName(ShotId id);
bool shotFromName(const std::string& s, ShotId& out);

enum class KitModel { K909, K808, MM };

// Les reglages de la couche SAMPLE (la page SMPL).
struct SampleLayer {
    double lev = 1.0;   // LEVEL 0..1 (gain au carre)
    double st = 0.0;    // TUNE + FINE, demi-tons
    double start = 0.0; // 0..1
    double len = 1.0;   // 0..1
    bool rev = false;
};

// Ce que le calcul d'un son sait du kit (ShotTweak du site). Valeurs 0..1, 0.5 = celle d'avant.
struct ShotTweak {
    KitModel model = KitModel::MM;
    double tune = 0.5, attack = 0.5, decay = 0.45, drive = 0.25, snappy = 0.5;
    bool gate = false;
    double sweep = 0.5;
    double sdTune = 0.5, sdDecay = 0.5, sdTone = 0.5;
    double syn = 1.0;        // niveau de la couche SYNTH
    bool hasSample = false;  // couche SAMPLE presente
    SampleLayer smp;
};

// Un echantillon decode (L, R vide si mono).
struct SamplePcm {
    std::vector<float> L;
    std::vector<float> R; // vide : mono
    double sr = 44100.0;
};

// Un coup calcule. mono : R n'est pas rempli, R == L a la lecture.
struct Shot {
    std::vector<float> L;
    std::vector<float> R;
    bool mono = true;
    const std::vector<float>& right() const { return mono ? L : R; }
    size_t size() const { return L.size(); }
};

int variantsOf(ShotId id);

// Le coup synthetique seul, cale sur sa sonie (renderShot).
Shot renderShot(ShotId id, double sr, double stretch, int variant, const ShotTweak& tw);
// Le coup d'un echantillon (renderSampleShot).
Shot renderSampleShot(ShotId id, double sr, double stretch, const SamplePcm& pcm, const ShotTweak& tw);
// Le coup complet, ses deux couches (renderLayers). pcm peut etre nul.
Shot renderLayers(ShotId id, double sr, double stretch, int variant, const ShotTweak& tw, const SamplePcm* pcm);

// Outils exposes pour les tests.
double shotLoudness(const Shot& s, double sr);
std::vector<float> timeStretch(const std::vector<float>& x, double f, double sr);

// Lecture d'un WAV PCM 16/24/32 bits ou float 32 (mono ou stereo) depuis la memoire.
bool decodeWav(const void* data, size_t size, SamplePcm& out);

} // namespace mm
