// MM-RYTM : le programme de lecture compile par la face (src/v4/plugin/bridge.ts compile()).
// La face calcule tout avec les fonctions du site (sons, verrous, hauteur, enveloppe, gain, PAN) ; le C++ joue.
#pragma once

#include "Fx.h"
#include "Lfo.h"
#include "Shots.h"

#include <algorithm>
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
    // Les LFO du coup (audio/lfo.ts activeLfos : la voix, les verrous du pas) ; lfot : LFO.T (le trig relance leur ancre)
    int nlfo = 0;
    Lfo lfo[2];
    bool lfot = true;
    // Les bases des lois (audio/drums.ts lfoLaw, seqhit.ts lfoHitLock) : LEVEL, RESO et DECAY du coup (la voix ou son verrou)
    double lbLevel = 0.8, lbReso = 0, lbDecay = 1;
    // Le panoramique meme au centre (un LFO PAN ou un lock trig PAN de la voix : audio/drums.ts seqExtra forcePan ; le gain
    // porte deja le x racine de 2)
    bool fp = false;
    // Un lock trig : ce qu'il verrouille de ce que la voix change en direct (1 VOL, 2 PAN, 4 RESO, 8 FREQ ; lc : la coupure)
    int lk = 0;
    double lc = 20000;
};

struct ProgTrack {
    float slice = 1.f; // gain de la tranche (LEVEL, TRK LEV)
    bool plays = true; // MUTE, SOLO, mute du pattern
    bool mono = false;
    int choke = 0;
    bool gated = false;
    bool kick = false; // la voie du kick (sans CHORUS ni envois globaux)
    SliceFx sl;        // la tranche de la voix
    int tlen = 0;      // TLEN (2026-11-08) : la longueur de la piste en pas, qu'elle boucle depuis le debut du pattern ; 0 : celle du pattern
    ProgHit live;
    std::vector<ProgHit> hits; // par pas croissant
};

// Le programme a une position du crossfader (2026-11-08) : ce que les scenes changent (les effets globaux, les tranches, le
// coup du pad, les coups : les memes, dans le meme ordre que ceux du programme).
struct ProgX {
    GlobalFx fx;
    std::array<ProgTrack, kProgTracks> tracks;
};

struct Program {
    double bpm = 130;
    int len = 16;   // 1 a 64 pas
    int loop = -1;  // -1 : toutes les pages ; 0 a 3 : la page bouclee
    double swing = 0; // retard des pas impairs, en part de pas
    std::vector<ProgSound> sounds;
    std::array<ProgTrack, kProgTracks> tracks;
    GlobalFx fx;
    // Les scenes : le programme aux positions x = k / (xk.size() - 1) du crossfader ; vide sans scene
    std::vector<ProgX> xk;
    // L'emplacement du pattern (0 a 127, A01 a H16) ; les autres patterns remplis (2026-11-08) : des programmes entiers
    // (le kit, les sons et les effets d'ici, leurs coups, leur mute, leurs scenes), joues apres une fin de pattern
    int slot = 0;
    std::vector<Program> pats;
};

// Le crossfader : la position x (0 a 1) entre deux programmes voisins de xk (k, et f de 0 a 1 vers k + 1)
inline void xkAt(const Program& p, double x, size_t& k, double& f) {
    const double n = static_cast<double>(p.xk.size() - 1);
    const double u = std::max(0.0, std::min(1.0, x)) * n;
    k = std::min(p.xk.size() - 2, static_cast<size_t>(u));
    f = u - static_cast<double>(k);
}
// Un coup, un effet, une tranche entre deux positions : lineaire ; logarithmique pour les grandeurs > 0 (coupure, Q, constantes
// de temps : leurs lois sont exponentielles) ; le plus proche pour le reste (le son, le type de filtre, les drapeaux)
ProgHit blendHit(const ProgHit& a, const ProgHit& b, double f);
SliceFx blendSlice(const SliceFx& a, const SliceFx& b, double f);
GlobalFx blendFx(const GlobalFx& a, const GlobalFx& b, double f);

bool shotFromSiteId(const std::string& s, ShotId& out);

} // namespace mm
