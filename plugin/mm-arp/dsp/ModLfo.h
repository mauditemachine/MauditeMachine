// MM-ARP v50 (2026-11-23) : LFO 3 et LFO 4, deux sources globales de la matrice de modulation (les emplacements xMx du
// plugin). Le plugin les calcule seulement quand un emplacement les utilise, par morceau (un appel de run par morceau
// rendu par le moteur, 128 echantillons au plus), et donne au moteur leur valeur de fin de morceau (Voyager::extLfo :
// il y glisse lineairement). Sans allocation, sans etat partage.
//
// LFO 3 = le LFO de la DISTO (dsp/Decap.cpp, process : RATE xDLfoRate, SHAPE xDLfoShape, SYNC xDLfoSync), sa copie
// exacte : la meme phase (Hz / sr par echantillon), les memes formes (SINE, TRI, SAW, SQUARE, RANDOM), le meme hasard
// (generateur congruentiel, graine 22222, un tirage par cycle), le meme lissage (1.5 ms ; RANDOM 15 ms). Quand la DISTO
// tourne, le plugin recopie l'etat de son LFO apres chaque passage (sync) : les deux restent en phase ; DISTO coupee, il
// tourne seul. Sa route DISTO (xDLfoTarget / xDLfoAmt) reste celle de Decap, inchangee.
//
// LFO 4 : un LFO de plus, les formes du LFO 2 du moteur (SINE (-cos : part du bas), TRI, SAW descendante, RAMP montante,
// SQR, S&H, RND lisse), la vitesse de xDLfoRate : FREE 0.02 x 500^v Hz ; SYNC 8 BAR a 1/32 (Hell::kLfoBeats), la phase
// calee sur la position du transport quand il joue (une boucle ou un export rejouent le meme LFO), libre au tempo sinon.
// Son hasard : une valeur par cycle tiree de (graine, numero du cycle), sans etat. Sortie lissee 2 ms (comme les LFO du
// moteur).
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace mmarp {

struct DistoLfo {
    double ph = 0, sm = 0, rnd = 0;
    uint32_t rng = 22222u;
    void reset() {
        ph = sm = rnd = 0;
        rng = 22222u;
    }
    // n echantillons a hz (forme 0..4) ; rend la valeur lissee apres le dernier (-1..1)
    double run(int n, double hz, int shape, double sr) {
        const double inc = std::clamp(hz, 0.0, 50.0) / sr;
        const int sh = std::clamp(shape, 0, 4);
        const double k = 1 - std::exp(-1 / ((sh == 4 ? 0.015 : 0.0015) * sr));
        for (int i = 0; i < n; ++i) {
            ph += inc;
            if (ph >= 1) {
                ph -= std::floor(ph);
                rng = rng * 1664525u + 1013904223u;
                rnd = (rng >> 8) * (2.0 / 16777216.0) - 1;
            }
            double raw;
            switch (sh) {
                case 1: raw = 4 * std::fabs(ph - 0.5) - 1; break;
                case 2: raw = 2 * ph - 1; break;
                case 3: raw = ph < 0.5 ? 1 : -1; break;
                case 4: raw = rnd; break;
                default: raw = std::sin(2 * 3.14159265358979323846 * ph); break;
            }
            sm += (raw - sm) * k;
        }
        return sm;
    }
    // l'etat du LFO de la DISTO (Decap::lfoState) : la suite est la sienne
    void sync(double p, double s, double r, uint32_t g) {
        ph = p;
        sm = s;
        rnd = r;
        rng = g;
    }
};

struct Lfo4 {
    double cyc = 0;   // la phase en cycles (non repliee : le hasard change a chaque cycle)
    double sm = 0;
    bool fresh = true;
    uint32_t seed = 0x4C464F34u;
    void reset() {
        cyc = sm = 0;
        fresh = true;
    }
    static double hashU(uint32_t seed, int64_t c) {
        uint64_t z = static_cast<uint64_t>(c) * 0x9E3779B97F4A7C15ull + (static_cast<uint64_t>(seed) << 1 | 1u);
        z ^= z >> 30;
        z *= 0xBF58476D1CE4E5B9ull;
        z ^= z >> 27;
        z *= 0x94D049BB133111EBull;
        z ^= z >> 31;
        return static_cast<double>(z >> 11) * (1.0 / 9007199254740992.0);
    }
    double raw(int shape) const {
        const double c = std::floor(cyc);
        const double ph = cyc - c;
        const int64_t ci = c > -9e15 && c < 9e15 ? static_cast<int64_t>(c) : 0;
        switch (shape) {
            case 1: return 1 - 4 * std::fabs(ph - 0.5);
            case 2: return 1 - 2 * ph;
            case 3: return 2 * ph - 1;
            case 4: return ph < 0.5 ? 1 : -1;
            case 5: return hashU(seed, ci) * 2 - 1;
            case 6: {
                const double a = hashU(seed, ci) * 2 - 1, b = hashU(seed, ci + 1) * 2 - 1;
                return a + (b - a) * ph * ph * (3 - 2 * ph);
            }
            default: return -std::cos(2 * 3.14159265358979323846 * ph);
        }
    }
    // n echantillons. locked : cycEnd est la phase (en cycles) a la fin du morceau (le transport) ; sinon la phase avance
    // de n x hz / sr. Rend la valeur lissee (2 ms) a la fin du morceau.
    double run(int n, double hz, int shape, double sr, bool locked, double cycEnd) {
        if (locked)
            cyc = cycEnd;
        else
            cyc += n * std::clamp(hz, 0.0, 50.0) / sr;
        const double r = raw(std::clamp(shape, 0, 6));
        if (fresh) {
            sm = r;
            fresh = false;
        } else
            sm += (r - sm) * (1 - std::exp(-n / (0.002 * sr)));
        return sm;
    }
};

}  // namespace mmarp
