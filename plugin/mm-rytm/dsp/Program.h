// MM-RYTM : le programme de lecture compile par la face (src/v4/plugin/bridge.ts compile()).
// La face calcule tout avec les fonctions du site (sons, verrous, hauteur, enveloppe, gain, PAN) ; le C++ joue.
#pragma once

#include "Shots.h"

#include <array>
#include <string>
#include <vector>

namespace mm {

constexpr int kProgTracks = 16;

// Un son a calculer : le moteur, la recette du site (ShotTweak), le sample (cle du site, "bd/Bd 1.wav"), STRETCH, la hauteur.
struct ProgSound {
    ShotId id = ShotId::BD;
    ShotTweak tw;
    std::string sample; // vide : pas de couche SAMPLE
    double ts = 1.0;
    double pf = 1.0;
    bool variants = true;
    // La cle du son (recette complete) : deux sons de meme cle sont le meme calcul.
    std::string key() const;
};

// Un coup : son pas, sa velocite, son son, son enveloppe, son gain, son PAN, son START.
struct ProgHit {
    int g = 0;
    float vel = 1.f;
    int snd = -1;
    double tau = -1;   // DECAY : constante de temps (s) ; -1 : le son entier
    double atk = 0;    // rampe d'attaque (s)
    double hold = 0.004;
    double gain = 1;   // gain du coup (VOL verrouille, loi du PAN) en plus de la velocite
    double pan = 0;
    double start = 0;  // part de la duree du son ou il commence
};

struct ProgTrack {
    float slice = 1.f; // gain de la tranche (LEVEL, TRK LEV)
    bool plays = true; // MUTE, SOLO, mute du pattern
    bool mono = false;
    int choke = 0;
    bool gated = false;
    ProgHit live;
    std::vector<ProgHit> hits; // par pas croissant
};

struct Program {
    double bpm = 130;
    int len = 16;   // 1 a 64 pas
    int loop = -1;  // -1 : toutes les pages ; 0 a 3 : la page bouclee
    double swing = 0; // retard des pas impairs, en part de pas
    std::vector<ProgSound> sounds;
    std::array<ProgTrack, kProgTracks> tracks;
};

bool shotFromSiteId(const std::string& s, ShotId& out);

} // namespace mm
