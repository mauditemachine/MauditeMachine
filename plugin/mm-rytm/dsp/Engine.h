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

// Un pattern jouable : son programme, l'index pas -> coup de chaque piste, la reponse de la REVERB a chaque position du
// crossfader (ses scenes).
struct PatPlay {
    const Program* prog = nullptr;
    std::array<std::vector<int>, kTracks> at; // at[t][g] : indice du coup dans prog->tracks[t].hits, -1 sinon
    std::vector<std::shared_ptr<ReverbIR>> irK;
};

// Ce que le thread audio joue : le programme (le pattern courant de la face et les autres patterns remplis), ses sons
// calcules, l'index de chaque pattern.
struct PlayState {
    Program prog;
    std::vector<std::shared_ptr<RenderedSound>> sounds; // aligne sur prog.sounds (nul : son impossible)
    std::vector<std::string> keys;                      // la cle de chaque son (sounds : ceux du programme, puis ceux joues en direct)
    std::shared_ptr<ReverbIR> reverbIR;                 // la reponse de la REVERB (rsize, rtone, rpre)
    // Les reponses de chaque position du crossfader : irKs[0] pour prog, irKs[1 + j] pour prog.pats[j] (calculees hors du thread audio)
    std::vector<std::vector<std::shared_ptr<ReverbIR>>> irKs;
    std::vector<PatPlay> pats; // pats[0] : prog ; puis prog.pats (Engine::publish)
    Program empty;             // un emplacement vide : le kit, aucun coup
    PatPlay emptyPat;
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
    // Le pattern suivant et la chaine choisis sur la face (PTN puis TRIG en lecture) : joues a la fin du pattern
    void queuePatterns(int next, const int* chain, int n);

    // --- thread audio, avant process() : un program change (un clip d'Ableton) choisit le pattern 0 a 127
    void programChange(int slot) { pcIn_ = slot; }
    // --- n'importe quel thread : le crossfader (le parametre XFADE), 0 = A, 1 = B
    void setX(float x) { x_.store(x, std::memory_order_relaxed); }
    // --- n'importe quel thread : PERFORM (2026-11-12). Les pads tenus : cut, les pistes coupees (bit t) ; flags, bits 0 a 2 le
    // beat repeat (0 aucun, 1 a 4 : 1/4 1/8 1/16 1/32), 8 LOW CUT, 16 DELAY THROW, 32 REVERB WASH, 64 TAPE STOP, 128 HELL THROW
    // (2026-11-13). Le FILTER (le parametre FILTER) : -1 passe-bas ... 0 ouvert ... 1 passe-haut
    enum { PERF_LOWCUT = 8, PERF_THROW_D = 16, PERF_THROW_R = 32, PERF_TAPE = 64, PERF_THROW_H = 128 };
    void setPerf(uint32_t cut, int flags) {
        perfCut_.store(cut, std::memory_order_relaxed);
        perfFlags_.store(flags, std::memory_order_relaxed);
    }
    void setFilter(float v) { perfFilter_.store(v, std::memory_order_relaxed); }
    // --- n'importe quel thread : le SIDECHAIN de PERFORM (le parametre SIDECHAIN), 0 a 1
    void setSide(float v) { perfSide_.store(v, std::memory_order_relaxed); }
    // --- n'importe quel thread : le MIX de HELL (le parametre Hell Mix, 2026-11-13), 0 a 1 ; negatif : celui du programme
    void setHellMix(float v) { hellMix_.store(v, std::memory_order_relaxed); }
    // La latence (echantillons) : l'avance du LIMITEUR
    int latency() const { return fx_.latency(); }

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
    // Les pas depuis le debut du pattern, sans repartir avec lui (2026-11-11, LIVE REC : une piste a sa longueur, TLEN, joue
    // le pas fbRel modulo TLEN ; la face ecrit ses verrous sur ce pas-la)
    std::atomic<int> fbRel{-1};
    std::atomic<int> fbPat{-1};     // le pattern joue
    std::atomic<int> fbPatSeq{0};   // +1 a chaque changement de pattern fait par le moteur
    // Les VU-metres (2026-11-10) : la crete de chaque piste depuis la derniere lecture (le thread du message la remet a 0)
    std::array<std::atomic<float>, kTracks> fbPeak{};

    // Le thread du calcul garde ses sons ici (toujours vivants tant qu'un etat ou une voix les tient).
    void own(const std::shared_ptr<RenderedSound>& s) { soundsOwned_.push_back(s); }

private:
    // Une courbe de LFO continue d'un coup (audio/drums.ts lfoCurves) : des rampes lineaires entre des points (la valeur de
    // l'AudioParam), de t0 a la fin du coup (au plus 8 s, 512 rampes) ; relancee par un lock trig : de gVal a gFrom, 3 ms
    // de glissement vers la nouvelle courbe
    struct Curve {
        bool on = false;
        double t0 = 0, seg = 1; // le premier point (echantillons de la voix) et l'ecart des points
        int n = 0;              // le nombre de rampes ; 0 : une valeur fixe ; -1 : gVal tenue
        long k = -1;            // la rampe en cours (a, b : ses bouts) ; n : la derniere valeur (a)
        double a = 0, b = 0, p0 = 0;
        double gFrom = -1, gVal = 0;
    };
    enum { CV_PITCH, CV_FREQ, CV_RESO, CV_VOL, CV_PAN, CV_N };
    // Un lock trig qui attend son heure dans le bloc (le moment de la voix ou il tombe)
    struct PendLock {
        bool on = false;
        double at = 0;
        int lk = 0;
        double level = 0.8, pan = 0, reso = 0, cut = 20000;
        bool re = false; // LFO.T : les LFO du coup repartent de anchor
        double anchor = 0;
        // Le glissement vers le pas suivant, apres ses valeurs : ce qui glisse, les cibles, la duree (echantillons)
        int sd = 0;
        double sdLevel = 0.8, sdPan = 0, sdReso = 0, sdCut = 20000, sdPf = 1, sdN = 0;
    };
    struct Voice {
        RenderedSound* snd = nullptr;
        const Shot* shot = nullptr;
        size_t pos = 0;
        double fpos = 0;       // un LFO PITCH : la lecture a vitesse variable, interpolee (sinon pos, a vitesse 1)
        int delay = 0;
        double t = 0;          // echantillons joues depuis le debut (l'enveloppe)
        float gLL = 1, gRL = 0, gLR = 0, gRR = 1; // matrice du PAN (sortie <- entree)
        bool panner = false;   // un panoramique (hors du centre, ou force : un LFO PAN, un lock trig PAN)
        double panNow = 0, panTo = 0;
        float gain = 1, gainTo = 1; // un lock trig fait glisser le gain (setTargetAtTime, 1 ms)
        float gain0 = 1;       // le gain du depart (la base du VOL d'un lock trig)
        double vol = 0.8;      // le LEVEL du coup
        float vel = 1, slice = 1;
        float sRatio = 1;      // le crossfader : la tranche du moment rapportee a celle du depart du coup (LEVEL, TRK LEV)
        // Les LFO du coup : leur position (en pas) au debut du coup, leur ancre, un pas en echantillons, la fin des courbes
        int nlfo = 0;
        Lfo lfo[2];
        double lPos = 0, lAnchor = 0, lStepN = 1, lEndN = 0;
        double baseLevel = 0.8, baseReso = 0, basePan = 0;
        std::array<Curve, CV_N> cv{};
        bool anyCv = false;
        PendLock pl;
        // Le glissement vers le pas suivant (LIVE REC, 2026-11-12) : ce qui glisse (1 VOL, 2 PAN, 4 RESO, 8 FREQ), ce qu'il
        // reste a parcourir (echantillons), les cibles (le gain, le PAN, le Q, la coupure) et leurs bases (LEVEL, RESO)
        int sdBits = 0;
        double sdLeft = 0;
        float sdGain = 1;
        double sdPan = 0, sdQ = 0.7071, sdCut = 20000, sdLevel = 0.8, sdReso = 0;
        // La hauteur qui glisse (256 : TUNE, FINE, TONE) : la vitesse de lecture du moment et sa cible, rapportees au pf du
        // son du coup (pf0) ; rateOn : la lecture interpolee (fpos), comme sous un LFO PITCH
        bool rateOn = false;
        double rate = 1, sdRate = 1, pf0 = 1;
        double varRate = 1; // VAR : la hauteur tiree au sort pour ce coup (un glissement de hauteur la garde)
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
        int hi = -1;       // le coup du programme (son indice ; -2 : le coup du pad) : le crossfader le reprend a sa position
        double anchor = 0; // l'ancre des LFO du coup (en pas) ; un lock trig : la nouvelle si re
        bool re = false;
        double sdSteps = 0; // le glissement vers le pas suivant : sa duree en pas (0 : aucun)
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
        // Un lock trig qui relance les LFO pendant le retrig : les repetitions d'avant preUntil gardent preAnchor
        double preUntil = -INFINITY, preAnchor = 0;
        int hi = -1;
        ProgHit hit;
        RenderedSound* snd = nullptr; // tenu (users) tant que le retrig dure
    };
    struct TrackSeq {
        int pre = -1; // -1 : aucun resultat, 0 faux, 1 vrai
        double anchor = 0; // l'ancre des LFO de la voix (en pas) : PLAY, puis le dernier trig a LFO.T
        Retrig rt;
    };

    void trigger(const PlayState& ps, int track, const ProgHit& h, float vel, float slice, RenderedSound* snd, int offset, double lenSteps, bool rep, double stepN, double lpos, double anchor, int hi, double sdN = 0);
    // Le crossfader : un coup (hi ; -2 le coup du pad), la tranche et le gain de tranche d'une piste, les effets globaux, a x
    const ProgHit& hitAtX(const PlayState& ps, int t, int hi, const ProgHit& base, ProgHit& tmp) const;
    SliceFx voiceSlAt(const PlayState& ps, int t) const;
    float trackSliceAt(const PlayState& ps, int t) const;
    GlobalFx globalAt(const PlayState& ps) const;
    const ReverbIR* irAt(const PlayState& ps) const;
    void followX(const PlayState& ps, double bpm, int n);
    void lockTrig(const ProgHit& h, int track, int offset, bool re, double anchor, double sdN);
    void applyLock(Voice& v);
    // Le glissement d'un coup vers les valeurs du pas suivant, en N echantillons ; son avance (16 echantillons) ; sa fin
    void startSlide(Voice& v, int bits, double level, double pan, double reso, double cut, double pf, double N);
    bool slideTick(Voice& v);
    void slideTrack(const PlayState& ps, int n);
    // VAR (MOD 3/3) : un tirage dans [-1, 1] (d : la dimension) ; seed 0 : libre, sinon fixe par piste, pas et graine
    double varDraw(const VarSet& vs, int track, int g, int d);
    void filterCoefs(Voice& v, double f, double q) const;
    double filterFreq(const Voice& v) const;
    void updateFilter(Voice& v);
    void setPan(Voice& v, double pan);
    // Les LFO continus : la somme d'une destination au temps t de la voix, sa loi, la courbe (depart, relance, valeur)
    double lfoSumAt(const Voice& v, int dest, double t) const;
    double lawOf(const Voice& v, int c, double s) const;
    void curveStart(Voice& v, int c, double from, double held);
    double curveAt(Voice& v, int c, double t) const;
    void fadeTrack(int track, int samples, int offset);
    void release(Voice& v);
    void seqReset(bool full);
    void evalStep(const PlayState& ps, long G);
    // Les patterns : celui d'un emplacement (vide : le kit sans coup), le passage a un autre (la fin du pattern, un program change)
    const PatPlay& patOf(const PlayState& ps, int slot) const;
    void usePattern(const PlayState& ps, int slot, long startG, bool byEngine);
    bool repeats(int track, Retrig& rt, double from, double to, double before, double anchor);
    void endRetrig(Retrig& rt);
    void pendPush(const Ev& e);
    uint32_t rngNext();

    void processChunk(const BlockTransport& tr, float* L, float* R, int n, const NoteEvent* notes, int nNotes);
    void applySlice(const PlayState& ps, int track, const SliceFx& s);

    double sr_ = 48000;
    FxChain fx_;
    const PlayState* fxState_ = nullptr;
    double fxBpm_ = 0;
    bool dry_ = false;
    std::array<SliceFx, kTracks> sliceNow_{};
    // Le glissement de la tranche d'une piste vers celle du pas suivant (DIST, CHORUS, DELAY, REVERB) : ce qu'il reste
    // (echantillons), ce qui glisse (16, 32, 64, 128 ; 512 : TONE), la cible
    struct SliceSlide {
        double left = 0;
        int bits = 0;
        SliceFx to;
    };
    std::array<SliceSlide, kTracks> slSd_{};
    // Le pattern joue (thread audio) : son emplacement, son programme, le seizieme ou il a commence ; le suivant, la chaine ;
    // le program change recu ; le dernier emplacement courant de la face
    int slot_ = -1, next_ = -1, pcIn_ = -1, faceSlot_ = -1;
    const Program* P_ = nullptr;
    const PatPlay* PA_ = nullptr;
    long patStart_ = 0;
    std::array<int, 64> chain_{};
    int chainN_ = 0, chainPos_ = 0;
    // Le pattern suivant et la chaine venus de la face : deux tampons, l'indice du dernier ecrit (thread du message -> audio)
    struct PtnMsg {
        int next = -1;
        std::array<int, 64> chain{};
        int n = 0;
    };
    std::array<PtnMsg, 2> ptnBuf_{};
    std::atomic<int> ptnW_{0}, ptnSeq_{0};
    int ptnSeen_ = 0;
    // Le crossfader (thread audio) : x du bloc, programme a scenes ; d'ou vient la tranche de chaque piste (l'indice du coup,
    // -1 la voix, -2 le coup du pad, -3 un coup en direct de la face : fixe) et l'ecart qu'un LFO pris au coup y a mis
    std::atomic<float> x_{0};
    // PERFORM : les pads tenus et le FILTER (Engine::setPerf, setFilter)
    std::atomic<uint32_t> perfCut_{0};
    std::atomic<int> perfFlags_{0};
    std::atomic<float> perfFilter_{0};
    std::atomic<float> perfSide_{0};
    std::atomic<float> hellMix_{-1};
    double xNow_ = 0, xFx_ = -1;
    bool xOn_ = false;
    std::array<int, kTracks> sliceSrc_{};
    std::array<SliceFx, kTracks> sliceLfoD_{};
    const ReverbIR* irWant_ = nullptr;
    int irStable_ = 0;
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
// forEachStepRel : hit(g, offset, rel), rel le nombre de pas depuis start (le debut du pattern).
template <typename Fn>
void forEachStepRel(const Program& p, int (*stepOf)(const Program&, long), double ppq0, double pps, int n, Fn&& hit, long start = 0) {
    if (n <= 0 || pps <= 0) return;
    const double ppq1 = ppq0 + n * pps;
    const long G0 = static_cast<long>(std::floor(ppq0 * 4)) - 1;
    const long G1 = static_cast<long>(std::floor(ppq1 * 4));
    for (long G = std::max(0L, G0); G <= G1; ++G) {
        if (G < start) continue;
        const int g = stepOf(p, G - start);
        const double pos = G * 0.25 + (((g % 16) & 1) ? p.swing * 0.25 : 0.0);
        if (pos < ppq0 || pos >= ppq1) continue;
        const int off = std::min(n - 1, std::max(0, static_cast<int>((pos - ppq0) / pps)));
        hit(g, off, G - start);
    }
}
template <typename Fn>
void forEachStep(const Program& p, int (*stepOf)(const Program&, long), double ppq0, double pps, int n, Fn&& hit, long start = 0) {
    forEachStepRel(p, stepOf, ppq0, pps, n, [&hit](int g, int off, long) { hit(g, off); }, start);
}

// Le pas du motif pour le seizieme G depuis le debut du morceau (len pas, ou la page bouclee).
int programStepOf(const Program& p, long G);

} // namespace mm
