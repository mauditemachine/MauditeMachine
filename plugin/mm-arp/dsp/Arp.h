// MM-ARP, l'arpegiateur du plugin (2026-11-09) : voyager/arp.ts du site (scheduleStep), cale sur la position de
// l'hote (ppq) au lieu de l'horloge du navigateur. Sans JUCE.
//
// Le programme (src/v4/plugin/arp/bridge.ts) donne les notes deja resolues par le site : pour chaque accord de la
// progression, la suite (EDIT ou AUTO, en midi, silences compris) ou, en RAND, le reservoir des notes. Le C++ ne fait
// que la mise en temps :
// - une double croche = 0.25 ppq, une mesure = 16 doubles croches (4/4) ; la mesure b joue prog[b % n], alignee sur
//   les mesures du morceau d'Ableton (au site : depuis RUN) ;
// - RATE : une note tous les spn pas (4, 2, 1), deux par pas en 1/32 ;
// - SWING : les doubles croches impaires retardees de swing x la duree du pas ;
// - GATE : gate x l'intervalle des notes, 5 ms au moins ;
// - les accents du site (1, 0.8, 0.92, 1.12 par double croche du temps, la seconde 1/32 a 0.85), leur profondeur
//   (ACCENT) et la main (DRIFT : +/-8 % x drift) ;
// - l'index de la note dans la suite : depuis le debut de la suite des mesures du meme accord (au site, l'arpege repart
//   de sa premiere note quand l'accord change). Sans etat : une lecture lancee n'importe ou, un export, une boucle
//   d'Ableton donnent toujours les memes notes au meme endroit ;
// - le hasard (RAND, DRIFT) tire d'une graine par position : le meme a chaque lecture ;
// - chaque pas dit au moteur sa place en temps (beat = ppq) : le LFO de MOD y lit sa phase (synthBeat du site).
#pragma once

#include <cstdint>
#include <vector>

namespace mmarp {

constexpr int kRest = -1000;

struct ArpChord {
    int c = -1;
    bool rand = false;
    // la suite (rand faux, kRest = silence) ou le reservoir (rand vrai), en midi, OCTAVE comprise
    std::vector<int> midi;
};

struct ArpProgram {
    double spn = 1;      // pas par note : 4 (1/4), 2 (1/8), 1 (1/16), 0.5 (1/32)
    double gate = 0.5;   // gateFrac(GATE) : la part de l'intervalle
    double accent = 0.5; // ACCENT (TWEAKS) : 0.5 la profondeur d'origine
    double drift = 0;    // DRIFT
    double swing = 0;    // la fraction du pas des doubles croches impaires
    std::vector<int> prog;        // indices des accords, dans l'ordre
    std::vector<ArpChord> chords; // un par accord distinct de prog
    const ArpChord* chord(int c) const {
        for (const auto& x : chords)
            if (x.c == c) return &x;
        return nullptr;
    }
};

// Ce que l'arpegiateur demande au moteur (les messages du port du worklet, en temps du contexte)
struct ArpSink {
    virtual ~ArpSink() = default;
    virtual void note(double timeSec, int midi, double gateSec, double accent, double fromMidi /* NaN : sans */) = 0;
    virtual void beat(double timeSec, double beat, double bpm, bool run) = 0;
    virtual void cancel(double timeSec) = 0;
};

// La note jouee, pour la face (l'ecran, les pads)
struct ArpShown {
    int64_t frame = 0;
    int slot = -1;
    int pos = 0;
    int len = 0;
    int chord = -1;
    int midi = -1;
};

class Arp {
public:
    void prepare(double sampleRate);
    // Un nouveau programme (thread audio : il est pris au bloc suivant, par pointeur publie par l'appelant)
    void setProgram(const ArpProgram* p) { prog_ = p; }
    // Le transport arrete (ou relance ailleurs) : la lecture repart de la position suivante
    void reset();
    // Un bloc : la position de l'hote a son premier echantillon (frame absolu f0), sa vitesse en ppq par echantillon.
    // playing faux : rien ne part. Les pas qui tombent dans [f0, f0 + n) partent vers le moteur (leurs notes peuvent
    // tomber apres le bloc : swing, seconde 1/32).
    void process(ArpSink& sink, int64_t f0, int n, bool playing, double ppq, double ppqPerSample, uint32_t seed);

    // La derniere note partie avant le frame donne (la face la montre a son heure)
    ArpShown shownAt(int64_t frame) const;
    bool running() const { return was_; }

private:
    void step(ArpSink& sink, int64_t k, double frame, double stepSamples, uint32_t seed);
    int slotsInBar(double spn) const;
    int slotsBefore(int stepInBar, double spn) const;
    int chordAt(int64_t bar) const;

    double sr_ = 48000;
    const ArpProgram* prog_ = nullptr;
    bool was_ = false;
    bool first_ = true;
    int64_t nextStep_ = 0; // le prochain pas a jouer (en doubles croches depuis ppq 0)
    double expectPpq_ = 0;
    int lastMidi_ = kRest;
    // le debut de la suite des mesures du meme accord, pour la mesure barOf_
    int64_t barOf_ = INT64_MIN;
    int64_t runStart_ = 0;

    static constexpr int kShown = 64;
    ArpShown shown_[kShown];
    int shownHead_ = 0;
};

// mulberry32 (le meme que le site)
inline uint32_t mulberryNext(uint32_t& a) {
    a += 0x6d2b79f5u;
    uint32_t t = a;
    t = (t ^ (t >> 15)) * (t | 1u);
    t ^= t + (t ^ (t >> 7)) * (t | 61u);
    return t ^ (t >> 14);
}
inline double mulberry01(uint32_t& a) { return mulberryNext(a) / 4294967296.0; }

} // namespace mmarp
