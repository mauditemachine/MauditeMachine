// MM-RYTM : le moteur temps reel du plugin. Il joue le programme compile par la face (Program.h) :
// 16 pistes, le sequenceur cale sur la position de l'hote (ppq), les voix comme audio/drums.ts voice() (enveloppe
// ATK / HOLD / DECAY, START, PAN a puissance constante, kick mono, choke des portes, 4 voix par piste).
// Sans JUCE : tests/engine_test.cpp le pilote seul.
// Regle temps reel : rien n'alloue, ne bloque ni ne libere dans process() / pushLive().
#pragma once

#include "Fx.h"
#include "Program.h"

#include <array>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <memory>
#include <mutex>
#include <vector>

namespace mm {

constexpr int kTracks = kProgTracks;
constexpr int kPoly = 4;            // voix qui sonnent ensemble sur une piste (LEGACY_POLY_MAX du site)
constexpr int kVoicesPerTrack = 6;  // + 2 cases pour les fondus de sortie

// Un son calcule (ses variantes, a la frequence de rendu sr / pf) ; lu par les voix, jamais modifie.
struct RenderedSound {
    std::vector<Shot> variants;
    std::atomic<int> users{0};
    std::atomic<int> next{0};   // la variante suivante (sons bruites : jamais deux fois la meme)
    double retiredAt = -1;
};

// Ce que le thread audio joue : le programme, ses sons calcules, l'index pas -> coup de chaque piste.
struct PlayState {
    Program prog;
    std::vector<std::shared_ptr<RenderedSound>> sounds; // aligne sur prog.sounds (nul : son impossible)
    std::array<std::vector<int>, kTracks> at;           // at[t][g] : indice du coup dans prog.tracks[t].hits, -1 sinon
    std::vector<std::string> keys;                      // la cle de chaque son (sounds : ceux du programme, puis ceux joues en direct)
    std::shared_ptr<ReverbIR> reverbIR;                 // la reponse de la REVERB (rsize, rtone, rpre)
    std::atomic<int> users{0};
    double retiredAt = -1;
};

// Un coup en direct (pad, touche de la face), resolu par le thread du message.
struct LiveHit {
    int track = 0;
    float slice = 1.f;
    ProgHit hit;
    RenderedSound* snd = nullptr;
};

// Une note MIDI recue par le plugin (un clip d'Ableton) : la piste, sa velocite, sa place dans le bloc.
struct NoteEvent {
    int track = 0;
    float vel = 1.f;
    int offset = 0;
};

// Le transport du bloc, calcule par le plugin (hote ou horloge interne).
struct BlockTransport {
    bool playing = false;
    double ppq = 0;          // position du debut du bloc, en noires
    double ppqPerSample = 0;
};

class Engine {
public:
    void prepare(double sampleRate);
    double sampleRate() const { return sr_; }

    // --- thread du calcul ---
    void publish(std::shared_ptr<PlayState> s);
    void collect(double now);
    // --- n'importe quel thread (mutex) : le dernier etat publie (le thread du message y cherche les sons des coups en direct)
    std::shared_ptr<PlayState> latest() const;

    // --- thread du message (un seul producteur) ---
    bool pushLive(const LiveHit& h);
    // FILL tenu sur la face (les trigs a condition FILL jouent, !FILL se taisent)
    void setFill(bool on) { fill_.store(on, std::memory_order_relaxed); }

    // --- thread audio ---
    void process(const BlockTransport& tr, float* L, float* R, int n, const NoteEvent* notes = nullptr, int nNotes = 0);
    // Sans les effets (les tests du moteur d'avant la phase 3 : la sortie des voix seules)
    void setDry(bool on) { dry_ = on; }
    void allNotesOff();

    // --- retour vers la face (atomiques) ---
    std::atomic<bool> fbPlaying{false};
    std::atomic<int> fbStep{-1};
    std::atomic<int> fbSeq{0};
    std::atomic<int> fbMask{0};

    // Le thread du calcul garde ses sons ici (toujours vivants tant qu'un etat ou une voix les tient).
    void own(const std::shared_ptr<RenderedSound>& s) { soundsOwned_.push_back(s); }

private:
    struct Voice {
        RenderedSound* snd = nullptr;
        const Shot* shot = nullptr;
        size_t pos = 0;
        int delay = 0;
        double t = 0;          // echantillons joues depuis le debut (l'enveloppe)
        float gLL = 1, gRL = 0, gLR = 0, gRR = 1; // matrice du PAN (sortie <- entree)
        float gain = 1, gainTo = 1, gainStep = 0; // un lock trig fait glisser le gain
        float vel = 1, slice = 1;
        double atkN = 0, holdEndN = 0, tauN = -1, stopN = -1;
        double cutN = -1;      // LEN : le relachement de 8 ms commence ici (-1 : INF)
        // FLTR : le biquad du coup (formules du BiquadFilterNode), sa coupure menee par l'enveloppe
        int ft = 0;
        double f0 = 20000, fPeak = 20000, fq = 0.7071, fAtkN = 0, fTauN = 1;
        bool fEnv = false;
        double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
        double zL1 = 0, zL2 = 0, zR1 = 0, zR2 = 0;
        int fadeLeft = -1, fadeLen = 1, fadeHold = 0;
        uint32_t age = 0;
    };
    static constexpr int kLiveCap = 256;

    // Un coup a jouer dans ce bloc ou plus tard (sa position en noires)
    struct Ev {
        double ppq = 0;
        int offset = 0;
        int track = 0;
        float slice = 1.f;
        float vel = 1.f;
        double lenSteps = -1;
        bool rep = false;  // une repetition de retrig : coupe le coup d'avant de la voix en 8 ms
        bool lt = false;   // un lock trig
        ProgHit hit;
        RenderedSound* snd = nullptr;
    };
    static constexpr int kEvCap = 1024;
    std::array<Ev, kEvCap> ev_{};
    static constexpr int kPendCap = 2048;
    std::array<Ev, kPendCap> pend_{};
    int npend_ = 0;

    // Ce que le sequenceur garde d'une voix d'un pas a l'autre (audio/seq.ts SeqVoice)
    struct Retrig {
        bool on = false;
        double pos = 0, every = 1, end = 0, span = 16;
        int vfad = 0;
        float vel = 1, slice = 1;
        double lenSteps = -1;
        ProgHit hit;
        RenderedSound* snd = nullptr; // tenu (users) tant que le retrig dure
    };
    struct TrackSeq {
        int pre = -1; // -1 : aucun resultat, 0 faux, 1 vrai
        Retrig rt;
    };

    void trigger(const PlayState& ps, int track, const ProgHit& h, float vel, float slice, RenderedSound* snd, int offset, double lenSteps, bool rep, double stepN);
    void lockTrig(const ProgHit& h, int track, float slice, int offset);
    void filterCoefs(Voice& v, double f) const;
    double filterFreq(const Voice& v) const;
    void fadeTrack(int track, int samples, int offset);
    void release(Voice& v);
    void seqReset(bool full);
    void evalStep(const PlayState& ps, long G);
    bool repeats(int track, Retrig& rt, double from, double to, double before);
    void endRetrig(Retrig& rt);
    void pendPush(const Ev& e);
    uint32_t rngNext();

    void processChunk(const BlockTransport& tr, float* L, float* R, int n, const NoteEvent* notes, int nNotes);
    void applySlice(const PlayState& ps, int track, const ProgHit& h);

    double sr_ = 48000;
    FxChain fx_;
    const PlayState* fxState_ = nullptr;
    double fxBpm_ = 0;
    bool dry_ = false;
    std::array<SliceFx, kTracks> sliceNow_{};
    std::array<NoteEvent, 256> chunkNotes_{};
    std::array<std::array<Voice, kVoicesPerTrack>, kTracks> voices_{};
    std::atomic<PlayState*> current_{nullptr};
    uint32_t clock_ = 0;
    bool wasPlaying_ = false;
    int seq_ = 0;

    // Le sequenceur (thread audio)
    std::array<TrackSeq, kTracks> ts_{};
    long nextG_ = 0;
    double expectPpq_ = -1;
    bool seqOn_ = false;
    int passN_ = 1;
    bool seenFirst_ = false;
    uint32_t rng_ = 0x2545F491u;
    std::atomic<bool> fill_{false};
    std::array<int, 128> maskAt_{};

    std::array<LiveHit, kLiveCap> live_{};
    std::atomic<int> liveW_{0}, liveR_{0};

    // Proprietaires (thread du calcul) ; latestPtr_ sous mutex.
    std::vector<std::shared_ptr<PlayState>> states_;
    std::vector<std::shared_ptr<RenderedSound>> soundsOwned_;
    mutable std::mutex latestMx_;
    std::shared_ptr<PlayState> latestPtr_;
};

// La condition d'un trig (audio/trig.ts condTrue) : pass, le passage du pattern (1 au depart) ; fill ; last : un
// changement de pattern prevu ; pre, nei : le dernier resultat de la voix et de la voix d'avant (-1 : aucun).
bool condTrue(int ck, bool cn, int ca, int cb, int pass, bool fill, bool last, int pre, int nei);
// La velocite d'une repetition (audio/trig.ts rtrgGain).
float rtrgGain(float vel, int vfad, double frac);

// Le sequenceur (pur, pour les tests) : appelle hit(g, offset) pour chaque pas qui tombe dans le bloc.
// Les pas impairs (g % 16) partent en retard de swing x un pas (audio/clock.ts).
template <typename Fn>
void forEachStep(const Program& p, int (*stepOf)(const Program&, long), double ppq0, double pps, int n, Fn&& hit) {
    if (n <= 0 || pps <= 0) return;
    const double ppq1 = ppq0 + n * pps;
    const long G0 = static_cast<long>(std::floor(ppq0 * 4)) - 1;
    const long G1 = static_cast<long>(std::floor(ppq1 * 4));
    for (long G = std::max(0L, G0); G <= G1; ++G) {
        const int g = stepOf(p, G);
        const double pos = G * 0.25 + (((g % 16) & 1) ? p.swing * 0.25 : 0.0);
        if (pos < ppq0 || pos >= ppq1) continue;
        const int off = std::min(n - 1, std::max(0, static_cast<int>((pos - ppq0) / pps)));
        hit(g, off);
    }
}

// Le pas du motif pour le seizieme G depuis le debut du morceau (len pas, ou la page bouclee).
int programStepOf(const Program& p, long G);

} // namespace mm
