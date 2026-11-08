// MM-RYTM : le programme de lecture compile par la face (src/v4/plugin/bridge.ts compile()).
// La face calcule tout avec les fonctions du site (sons, verrous, hauteur, enveloppe, gain, PAN) ; le C++ joue.
#pragma once

#include "Fx.h"
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
    // FLTR (audio/drums.ts hitFilter) : 0 aucun, 1 passe-bas, 2 passe-haut, 3 passe-bande ; la coupure monte de foct octaves
    // en fatk s, puis redescend vers fhz (constante ftau s)
    int ft = 0;
    double fhz = 20000, fq = 0.7071, foct = 0, fatk = 0, ftau = 0.1;
    // Le trig (audio/trig.ts trigNow) : rien d'autre que le coup au depart
    double len = -1;   // LEN en pas ; -1 : INF (rien ne coupe)
    int prob = 100;    // PROB, 0 a 100
    int ck = 0;        // COND : 0 NONE, 1 FILL, 2 PRE, 3 NEI, 4 1ST, 5 LST, 6 A:B
    bool cn = false;   // NOT
    int ca = 0, cb = 0;
    double shift = 0;  // uTIME, en pas
    bool rtrg = false; // RTRG
    double every = 1;  // RATE : l'ecart des repetitions, en pas
    int vfad = 0;      // VFAD, -64 a 63
    double rlen = 1;   // RLEN en pas ; -1 : INF (jusqu'au trig suivant)
    bool lt = false;   // un lock trig : aucun son, ses verrous vont au coup qui sonne
    // La tranche de la piste a partir de ce coup (un verrou de TONE, DIST, CHORUS, DELAY ou REVERB) ; absente : rien ne change
    bool hasSl = false;
    SliceFx sl;
};

struct ProgTrack {
    float slice = 1.f; // gain de la tranche (LEVEL, TRK LEV)
    bool plays = true; // MUTE, SOLO, mute du pattern
    bool mono = false;
    int choke = 0;
    bool gated = false;
    bool kick = false; // la voie du kick (sans CHORUS ni envois globaux)
    SliceFx sl;        // la tranche de la voix
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
    GlobalFx fx;
};

bool shotFromSiteId(const std::string& s, ShotId& out);

} // namespace mm
