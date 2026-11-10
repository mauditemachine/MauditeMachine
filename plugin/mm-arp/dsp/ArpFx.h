// MM-ARP : tout ce qui suit le moteur dans le graphe du site (src/v4/audio/synth.ts build, buildPingPong, applyFx,
// retime, volGain), en C++17 pur, sans JUCE. Port du 2026-11-09.
//
// Le graphe du site, tel qu'il est porte (chaque noeud du Web Audio a son equivalent ici) :
//
//   moteur -+-> HP1 -> HP2 (BASS MONO, Butterworth Q -3.0103 dB) -> CHORUS Juno-106 (insert) -> VOLUME --+--> sortie
//           |                                                                                            |
//           +-> mono (L+R)/2 -> LP1 -> LP2 -> gain du bas (= VOLUME) ------------> (mono duplique) ------+
//                                                                                                        |
//   VOLUME -> envoi DELAY -> HP 260 -> retard L <-> retard R (LP 4800 chacun, reinjection) -> merge ---+   |
//   VOLUME -> envoi TAPE -> 'mm-tape' (chorus.worklet.js) ----------------------------------------------+-> wet 0.8
//   VOLUME -> x1.25 (REVERB_BOOST) -> envoi REVERB (Send.set : min(1, max(0, v)) x 1.0) -> convolueur ---> sortie
//
// - CHORUS : chorus.ts buildJunoChorus (insert a bypass reel, sec JUNO.trim, mouille JUNO.trim x JUNO.wet ; OFF -> I/II :
//   la branche neuve se remplit 8 ms puis sec et mouille glissent en 20 ms ; I <-> II : la vitesse du triangle seule,
//   au debut du bloc de 128 suivant, sans saut ; OFF : retour en 20 ms, la branche meurt 60 ms apres (un ON avant
//   reprend la meme ligne, apres : une ligne neuve)) et chorus.worklet.js 'mm-chorus' kind 'juno', au bit pres.
// - DELAY : deux DelayNode (interpolation lineaire, delayTime a-rate), les biquads du Web Audio (Q 1 dB par defaut),
//   et le retard de 128 echantillons que Chromium ajoute dans le cycle (la reinjection gauche -> droite lit la sortie
//   du passe-bas gauche du bloc de rendu precedent : verifie dans un OfflineAudioContext, impulsion a 4800 echantillons
//   de retard -> echos a 4800, 9728 (+128), 14528...).
// - TAPE : chorus.worklet.js 'mm-tape' au bit pres (time a-rate, fb et tape k-rate lus au debut de chaque bloc de 128).
// - REVERB : la reverbe a lui du MM-ARP (drums.ts arpReverb = buildReverbBus(c, arpOut) : toujours IR_DEFAULT,
//   2.4 s, coupure 9 kHz -> 3 kHz, pre-delai 20 ms, graines 808 / 909, energie 1 par canal), fx.ts makeImpulse au bit
//   pres, ConvolverNode normalize = false (canal gauche par la reponse gauche, droit par la droite, sans latence).
//   La convolution FFT par blocs de 256 de plugin/mm-rytm/dsp/Fx.cpp, sans sa latence : les 256 premiers echantillons
//   de la reponse sont nuls (le pre-delai), ils sont retires.
// - VOLUME : volGain = volume^2 x 0.66 / (1 + 0.35 delay + 0.5 reverb), le meme sur le bas de BASS MONO.
// - AudioParam : valeurs en float, rampes lineaires (glide.ts : 20 ms depuis la valeur du dernier echantillon rendu),
//   retime (au moins 0.2 s, au plus 0.25 s de retard par seconde), coefficients des biquads recalcules a chaque
//   echantillon pendant une rampe de frequence (a-rate, comme Chromium).
// Ce qui suit la prise ARP du site (drums.ts arpOut -> analyseur -> limiteur/ecreteur du master -> MASTER) n'est pas a
// l'ARP : le seul reglage propre a l'ARP sur arpOut est le SIDECHAIN (Ducker), non porte ici.
//
// API (aucune allocation dans process ; tout est alloue dans prepare) :
//   ArpFx fx;
//   fx.prepare(sampleRate, maxBlock);           // alloue, calcule la reponse de la reverb, remet a zero
//   fx.set(settings, true);                     // comme applyFx(g, p, true) : valeurs posees (le CHORUS et l'envoi
//                                               // REVERB glissent quand meme, comme au site)
//   fx.set(settings, false);                    // comme applyFx(g, p) : glides de 20 ms, retime du DELAY
//   fx.retimeDelay(seconds);                    // un changement de tempo seul (pattern.subscribe du site)
//   fx.process(inL, inR, outL, outR, n);        // entree : la sortie du moteur ; sortie : la prise ARP (remplacee)
//   fx.reset();                                 // lignes et filtres a zero, reglages poses sans rampe
//   fx.latencySamples();                        // 0 (a toute frequence >= 12.8 kHz)
// Independant de la taille des blocs de l'hote (au bit pres) : tout est calcule par blocs de rendu de 128 comme le Web
// Audio (valeurs des rampes, parametres k-rate, messages au worklet, sommeil de la bande).
// Ecarts connus au site (mesures, plugin/mm-arp/tests/fx_test.cpp) : les biquads de Chromium different d'un ulp float
// par endroits (le passe-haut a 10 Hz de BASS MONO l'amplifie : -81 dB) ; juste apres un changement du graphe (le
// CHORUS qui s'engage ou se coupe), Chromium rend parfois quelques blocs du DELAY autrement (non deterministe d'un
// rendu a l'autre, jusqu'a -40 dB sur l'echo de ces blocs) : non porte, ce n'est pas le son voulu du site.
// Comme au site, set(.., false) repart de la valeur courante a chaque appel : l'appeler quand un reglage change (le
// site l'appelle a chaque changement de voyParams), pas a chaque bloc.
//
// ----------------------------------------------------------------------------------------------------------------
// LES EXTENSIONS DU PLUGIN (2026-11-10, Mika : "une qualite absolument eblouissante" ; le site ne les connait pas).
// Regle : chaque reglage neuf a son neutre rend la chaine d'avant (la REVERB a mieux que -120 dB, voir plus bas ;
// la section master AU BIT PRES : elle est contournee). Verifie par plugin/mm-arp/tests/hq_test.cpp.
//
// 1. REVERB : SIZE, TONE, PRE DELAY (ArpFxSettings revSize / revTone / revPre, 0..1 ; lois : ArpFxLaws)
//      duree     2.4 s x 4^(2 size - 1)             0.6 s .. 9.6 s (0.5 : 2.4 s, celle du site)
//      tone      9 kHz -> 3 kHz x 4^(2 tone - 1)    18 kHz au plus (0.5 : celle du site)
//      pre-delai pre x 100 ms                       (0.2 : 20 ms, celui du site)
//    Aux defauts : la reponse du site AU BIT PRES (fx.ts makeImpulse). Le calcul d'une reponse (jusqu'a 9.7 s, ses
//    spectres) alloue et prend des dizaines de ms : JAMAIS sur le thread audio. Le protocole :
//      thread du message :  auto ir = ArpFx::makeReverb(sampleRate, size, tone, pre);   // alloue, calcule
//                           ... passer ir au thread audio (une case a un producteur / un consommateur) ...
//      thread audio :       fx.setReverb(std::move(ir));     // un echange de pointeurs, rien d'autre
//      thread du message :  while (fx.takeRetiredReverb()) {}  // de temps en temps (un timer) : libere les anciennes
//    setReverb ne libere ni n'alloue jamais : la reponse neuve attend (une seule en attente : la derniere demandee
//    gagne), entre en fondu enchaine (40 ms par etage de la convolution : la tete et les blocs de 256 tout de suite,
//    les blocs de 2048 puis de 16384 a leur prochain bloc : la queue lointaine suit en 0.7 s au plus), puis
//    l'ancienne est rangee dans une file de 8 cases que takeRetiredReverb() vide (un seul thread a la fois, pas
//    forcement le thread audio). Si la file est pleine (personne ne la vide), le fondu fini attend une case, et un
//    setReverb qui devrait y ranger la demande en attente rend false sans rien prendre : pour que rien ne soit
//    jamais libere sur le thread audio, l'appelant garde sa propre reference jusqu'a ce que setReverb rende true (le
//    plus simple : le thread du message garde toujours la derniere reponse demandee). prepare() calcule lui-meme la
//    reponse des reglages en cours (ou des defauts) : sans makeReverb, la reverb est celle du site.
//    set() NE recalcule PAS la reponse quand revSize / revTone / revPre changent (thread audio) : ils ne servent
//    qu'a prepare() ; a l'appelant de lancer makeReverb quand ils bougent (reverb() rend la reponse en place).
//    La convolution : a partitions non uniformes, sans latence a toute frequence d'echantillonnage et pour tout
//    pre-delai (une tete directe de 256 points, sautee quand elle est nulle ; des blocs de 256 pour 256..4096, de
//    2048 pour 4096..32768, de 16384 au-dela ; le calcul des grands blocs est etale sur les blocs de 256, sans
//    pointe). Contre la convolution d'avant (blocs de 256 seuls), reponse par defaut : voir hq_test.
//
// 2. MASTER (apres tout le reste, dans cet ordre ; chacun contourne EXACTEMENT a son neutre, rampes de 20 ms) :
//      warmth 0..1 (0 : contournee)  une saturation douce facon transfo / bande : tanh a peine asymetrique
//             (biais 0.06 : un peu d'harmonique 2), entree x 2 warmth, gain unite aux petits signaux et compensee
//             en niveau (sinus de 0.3 : meme RMS) ; seule la part non lineaire passe par le surechantillonnage
//             local x4 (demi-bandes Kaiser 63 et 31 points) et un bloqueur de continu a 5 Hz, le signal lui-meme
//             n'est que retarde : aucun filtre sur le son direct. Engagee, elle retarde la sortie de
//             masterLatencySamples() = 39 echantillons (0 quand warmth = 0) ; le fondu de 20 ms couvre le passage.
//      bass   0..1 (0.5 neutre)      plateau grave a 120 Hz, -6 .. +6 dB (12 x (v - 0.5)), second ordre, Q 0.707
//      air    0..1 (0.5 neutre)      plateau aigu a 10 kHz, -6 .. +6 dB
//      width  0..1 (0.5 neutre)      0 : mono ; 1 : le cote x2 ; au-dessus de 0.5 seul le cote au-dessus de 150 Hz
//             s'elargit (passe-haut Butterworth d'ordre 2 sur la part ajoutee) : les graves restent ou ils sont.
// ----------------------------------------------------------------------------------------------------------------
#pragma once

#include <array>
#include <atomic>
#include <complex>
#include <cstdint>
#include <memory>
#include <vector>

namespace mmarp {

struct ArpFxSettings {
    int chorus = 0;             // chorusMode(p.chorus) : 0 OFF, 1 I, 2 II
    double delay = 0;           // p.delay (0..1) : envoi et reinjection
    double reverb = 0;          // p.reverb (0..1) : la loi de Send.set appliquee dans le C++
    double tape = 0;            // fxAmount(p.tape)
    double delaySeconds = 0.375; // min(2, delaySixteenths(p.dlyTime) * 60 / bpm / 4) (le C++ appelant le calcule)
    double monoLowHz = 0;       // monoLowHz(p.monoLow) (0 : OFF -> 10 Hz)
    double volume = 0.8;        // p.volume brut ; volGain calcule dans ArpFx
    // --- le plugin seul (voir en tete) ; a ces defauts : la chaine du site ---
    double revSize = 0.5;       // REVERB SIZE (lu par prepare seulement : voir makeReverb / setReverb)
    double revTone = 0.5;       // REVERB TONE (idem)
    double revPre = 0.2;        // REVERB PRE DELAY (idem)
    double warmth = 0;          // MASTER WARMTH (0 : contournee)
    double bass = 0.5;          // MASTER BASS (0.5 : contourne)
    double air = 0.5;           // MASTER AIR (0.5 : contourne)
    double width = 0.5;         // MASTER WIDTH (0.5 : contournee)
};

/**
 * Une reponse de reverb prete a convoluer (ArpFx::makeReverb) : immuable une fois construite, partagee entre le
 * thread du message (qui la calcule et la libere) et le thread audio (qui la lit).
 */
struct ReverbIR {
    static constexpr int kStages = 3;
    static constexpr int kBlock[kStages] = {256, 2048, 16384};   // la taille des blocs de chaque etage
    static constexpr int kFrom[kStages] = {256, 4096, 32768};    // le premier echantillon de la reponse de l'etage
    double sampleRate = 48000, size = 0.5, tone = 0.5, pre = 0.2; // les reglages demandes
    double seconds = 2.4, hiStart = 9000, hiEnd = 3000, preSeconds = 0.02; // ce qu'ils donnent
    int length = 0;                                  // en echantillons
    std::array<std::vector<float>, 2> ir;            // la reponse (gauche, droite)
    int headFrom = 256;                              // le premier point non nul de la tete (256 : tete nulle)
    std::array<std::vector<float>, 2> head;          // la tete a l'envers : head[k] = ir[255 - k], k < 256 - headFrom
    std::array<int, kStages> parts{};                // le nombre de blocs de chaque etage
    std::array<std::array<std::vector<float>, 2>, kStages> re, im; // les spectres : [etage][canal][bloc x (B + 1)]
};

// Les lois du site (src/v4/voyager/params.ts) pour l'appelant, a partir des valeurs brutes 0..1 des potards.
struct ArpFxLaws {
    static int chorusMode(double v);          // stepIndex('chorus') : round(v * 2)
    static double fxAmount(double v);         // v < 0.02 : 0
    static double monoLowHz(double v);        // v < 0.04 : 0, sinon 40 x 7.5^((v - 0.04) / 0.96)
    static int delaySixteenths(double v);     // [2, 3, 4, 6, 8][round(v * 4)]
    static double delaySeconds(double dlyTime, double bpm); // min(2, seiziemes x 60 / bpm / 4)
    static double volGain(double volume, double delay, double reverb);
    // le plugin seul (extra-params.json)
    static double revSeconds(double v);       // 2.4 x 4^(2v - 1)
    static double revToneFactor(double v);    // 4^(2v - 1) (x 9 kHz -> 3 kHz, 18 kHz au plus)
    static double revPreSeconds(double v);    // v / 10
    static double shelfDb(double v);          // 12 x (v - 0.5)
};

namespace detail {

// Un AudioParam : valeur en float, une rampe lineaire au plus (toutes celles du site partent de "maintenant" apres
// cancelScheduledValues) : v0 tenu jusqu'a t1, puis droite jusqu'a v1 en t2 (secondes du contexte). Les valeurs de la
// rampe sont calculees comme Chromium (audio_param_timeline.cc ProcessLinearRamp, x86) : en float, par paquets de 4
// avec increment, le calcul repartant au debut de chaque bloc de rendu ; a k-rate, la formule serie.
struct Param {
    float v0 = 0, v1 = 0, last = 0;
    double t1 = 0, t2 = 0, sr = 48000;
    long sF = 0, eF = 0;
    bool ramp = false;
    void setNow(float v) {
        ramp = false;
        v0 = v1 = last = v;
        cq = -1;
    }
    // setValueAtTime(p.value, now) [setValueAtTime(p.value, t1)] linearRampToValueAtTime(to, t2)
    void rampTo(double t1s, double t2s, float to, double rate);
    float value() const { return last; }
    // les valeurs a-rate de n echantillons a partir de k0 (dans un meme bloc de rendu)
    void fill(long k0, int n, float* out);
    // la valeur k-rate du bloc qui commence en k
    float at(long k);
    bool moving() const { return ramp; }

private:
    void compute(long k0, int n, float* out);
    void run(long cf, int len, float* out) const;
    float serial(long cf) const;
    // les valeurs du bloc de rendu en cours (calculees d'un coup, quelle que soit la taille des blocs de l'hote)
    std::array<float, 128> cache{};
    long cq = -1;
};

// Le BiquadFilterNode de Chromium (Linux) : coefficients de l'Audio EQ Cookbook, Q en dB pour lowpass / highpass,
// forme directe I en double, sortie arrondie en float (et gardee telle dans l'etat).
struct WebBiquad {
    double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
    double x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    void set(bool lowpass, float hz, float qDb, double sr);
    float run(float x) {
        const float y = static_cast<float>(b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2);
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        return y;
    }
    void endQuantum(); // le rinçage des sous-normaux de Blink en fin de bloc
    void clear() { x1 = x2 = y1 = y2 = 0; }
};

// chorus.worklet.js 'mm-chorus' kind 'juno' (le mouille seul, deux sorties), au bit pres.
class JunoChorus {
public:
    void prepare(double sr);
    void start(double dmin, double dmax, double rate); // un noeud neuf (processorOptions)
    void setRate(double rate) { rate_ = rate; }        // un message { rate }
    // n echantillons d'un bloc de 128 ; endOfQuantum : le bloc finit ici (rinçage des etats)
    void process(const float* inL, const float* inR, float* oL, float* oR, int n, bool endOfQuantum);

private:
    double sr_ = 48000;
    std::vector<float> buf_;
    int w_ = 0;
    double c0_ = 0, c1_ = 0, pb_ = 0, pa_ = 0, px_ = 0, py_ = 0, ph_ = 0, rate_ = 0.513;
    std::array<double, 12> bq_{};
    std::array<double, 8> bz_{};
};

// chorus.worklet.js 'mm-tape', au bit pres.
class TapeDelay {
public:
    void prepare(double sr, double maxS);
    void reset();
    // n echantillons d'un bloc de 128 (qStart / qEnd : le morceau ouvre / ferme le bloc) ; times : le temps (s) par
    // echantillon (float, a-rate) ; fb et tape : les valeurs k-rate du bloc ; inL null : pas d'entree. Le sommeil se
    // decide par bloc de 128, comme le worklet, quelle que soit la taille des morceaux.
    void process(const float* inL, const float* inR, const float* times, float fb, float tape, float* oL, float* oR, int n, bool qStart = true, bool qEnd = true);

private:
    struct Bq {
        double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
        void make(bool lp, double hz, double sr, double q);
        double run(double x) {
            const double y = b0 * x + z1;
            z1 = b1 * x - a1 * y + z2;
            z2 = b2 * x - a2 * y;
            return y;
        }
    };
    double sr_ = 48000;
    std::vector<float> bL_, bR_;
    int w_ = 0;
    Bq hpIn_, hpL_, hpR_, lpL_, lpR_;
    double lpTape_ = -1, phW_ = 0, phF_ = 0.25;
    long quiet_ = 0;
    bool asleep_ = false, qQuiet_ = true;
    int skipped_ = 0;
};

// Le DelayNode : ligne en float, lecture en interpolation lineaire a delayTime x sr echantillons.
struct WebDelay {
    std::vector<float> buf;
    int w = 0;
    void prepare(double maxS, double sr) {
        buf.assign(static_cast<size_t>(maxS * sr) + 512, 0.f);
        w = 0;
    }
    float run(float x, float delayS, double sr) {
        const int N = static_cast<int>(buf.size());
        buf[static_cast<size_t>(w)] = x;
        double pos = static_cast<double>(w) + N - static_cast<double>(delayS) * sr;
        if (pos >= N) pos -= N;
        int i1 = static_cast<int>(pos);
        if (i1 >= N) i1 -= N;
        const int i2 = (i1 + 1) % N;
        const double f = pos - i1;
        if (++w == N) w = 0;
        return static_cast<float>((1.0 - f) * buf[static_cast<size_t>(i1)] + f * buf[static_cast<size_t>(i2)]);
    }
};

struct PFft;

// La reverb : fx.ts makeImpulse (au bit pres) et une convolution FFT a partitions non uniformes, sans latence :
// une tete directe (les 256 premiers points, sautee quand ils sont nuls : le pre-delai), puis trois etages de blocs
// de 256, 2048 et 16384 (ReverbIR::kBlock / kFrom). Les blocs de 256 sont calcules d'un coup a chaque bloc (comme
// plugin/mm-rytm/dsp/Fx.cpp) ; le travail d'un grand bloc (FFT par passes, produits, FFT inverse) est etale sur les
// blocs de 256 qui suivent, il sort un grand bloc plus tard. Un etage qui n'a rien a convoluer (silence plus long
// que sa part de la reponse) ne calcule rien.
class Convolver {
public:
    static constexpr int B = 256, RING = 65536, kRetired = 8;
    // fx.ts makeImpulse (hiStart = max(9000, hiEnd)), et la meme avec la frequence de depart donnee (TONE)
    static void impulse(double seconds, double hiEnd, double preDelay, double sr, std::vector<float>& L, std::vector<float>& R);
    static void impulse(double seconds, double hiStart, double hiEnd, double preDelay, double sr, std::vector<float>& L, std::vector<float>& R);
    static std::shared_ptr<const ReverbIR> make(double sr, double size, double tone, double pre);
    // alloue pour la plus longue reponse (SIZE 1, PRE 1) et pose ir (sans fondu)
    void prepare(double sr, std::shared_ptr<const ReverbIR> ir);
    void reset();
    void process(const float* inL, const float* inR, float* outL, float* outR, int n);
    int latency() const { return 0; }
    // thread audio : voir le protocole en tete
    bool set(std::shared_ptr<const ReverbIR>& ir);
    // un autre thread (un seul) : la plus ancienne des reponses rangees, ou nul
    std::shared_ptr<const ReverbIR> takeRetired();
    const ReverbIR* target() const { return want_ ? want_.get() : next_ ? next_.get() : cur_.get(); }
    bool busy() const { return static_cast<bool>(next_) || static_cast<bool>(want_); }

private:
    struct Op {
        uint8_t op, ch, ir;
        int32_t arg;
    };
    struct Stage {
        int B = 0, N = 0, K = 0, bits = 0, ticks = 1, cap = 0, head = 0;
        const PFft* fft = nullptr;
        std::array<std::vector<float>, 2> fRe, fIm; // la ligne a retard des spectres : cap x K
        std::vector<float> wRe, wIm;                // le plan de travail (N)
        std::array<std::array<std::vector<float>, 2>, 2> out; // [tampon][canal] : B
        std::array<bool, 2> zero{{true, true}};     // le tampon ne contient que des zeros
        int cur = 0;                                // le tampon lu
        std::vector<Op> ops;                        // le travail du bloc en cours
        int nOps = 0, done = 0, ticksLeft = 0;
        long long T = 0;                            // l'instant ou le bloc en cours a commence
        const ReverbIR* a = nullptr;
        const ReverbIR* b = nullptr;
        long long fade0 = 0, fadePos = 0;
        int xf = 0;                                 // 0 : l'ancienne ; 1 : en fondu ; 2 : la neuve
    };
    void tick();
    void startJob(int s);
    void runOps(Stage& st, int count);
    void promote();
    void retire();
    bool pushRetired(std::shared_ptr<const ReverbIR>& p);

    double sr_ = 48000;
    long long n_ = 0, lastNZ_ = -(1LL << 60);
    int fill_ = 0, rpos_ = 0, fadeLen_ = 1920;
    std::array<std::vector<float>, 2> ring_;
    std::array<Stage, ReverbIR::kStages> st_;
    std::shared_ptr<const ReverbIR> cur_, next_, want_;
    int headXf_ = 0;
    long long headFade_ = 0;
    std::array<std::shared_ptr<const ReverbIR>, kRetired> ret_;
    std::atomic<unsigned> retW_{0}, retR_{0};
};

// La section master du plugin (voir en tete) : WARMTH, BASS, AIR, WIDTH, en place, chacun contourne a son neutre.
class Master {
public:
    static constexpr int kLatency = 39; // le retard de WARMTH engagee (les quatre demi-bandes du x4 local)
    void prepare(double sr);
    void reset();
    void set(double warmth, double bass, double air, double width, bool now);
    void process(float* L, float* R, int n);
    int latency() const { return wOn_.target > 0 ? kLatency : 0; }
    bool bypassed() const { return !wActive_ && !bActive_ && !aActive_ && !sActive_; }

private:
    struct Glide { // une rampe lineaire de 20 ms
        double v = 0, target = 0, step = 0;
        int left = 0;
        void setNow(double x) {
            v = target = x;
            left = 0;
        }
        void to(double x, int n) {
            if (x == target) return;
            target = x;
            left = n > 0 ? n : 1;
            step = (x - v) / left;
        }
        double next() {
            if (left > 0) {
                v += step;
                if (--left == 0) v = target;
            }
            return v;
        }
        bool moving() const { return left > 0; }
    };
    struct Svf { // le filtre d'etat de Zavalishin / Simper (trapezes)
        double a1 = 0, a2 = 0, a3 = 0, k = 1, m0 = 1, m1 = 0, m2 = 0;
        double ic1[2] = {0, 0}, ic2[2] = {0, 0};
        void clear() { ic1[0] = ic1[1] = ic2[0] = ic2[1] = 0; }
    };
    struct Half { // un etage x2 : la demi-bande (ses points pairs, le centre vaut 1/2) et ses histoires
        int taps = 0, half = 0, c = 0; // points pairs : half = (taps + 1) / 2 ; c : le centre
        std::array<double, 32> h{};
    };
    void shelf(Svf& f, bool high, double db, double g0);
    void warmCoefs(double a);
    void warmClear();
    double sr_ = 48000;
    int rampN_ = 960;
    // WARMTH
    Glide wAmt_, wOn_;
    bool wActive_ = false;
    Half hbA_, hbB_;
    double wG_ = 0, wInv_ = 0, wK_ = 1, wAt_ = -1, wTb_ = 0, dcR_ = 0;
    std::array<double, 65> wKtab_{};
    struct WarmCh {
        std::array<double, 64> dry{}, upA{};   // le sec (retard de 39), l'entree de l'etage 1x -> 2x
        std::array<double, 32> upB{};          // l'entree de l'etage 2x -> 4x
        std::array<double, 64> dnB{}, dnA{};   // les entrees des deux decimateurs (au rythme x4, x2)
        double dcX = 0, dcY = 0;
    } wc_[2];
    int wI_ = 0, wIb_ = 0, wJb_ = 0, wJa_ = 0;
    // BASS, AIR
    Glide bDb_, aDb_;
    bool bActive_ = false, aActive_ = false;
    Svf bF_, aF_;
    double bG0_ = 0, aG0_ = 0;
    // WIDTH
    Glide sW_ = {1, 1, 0, 0}; // le gain du cote : 2 x width
    bool sActive_ = false;
    Svf sF_;
};

} // namespace detail

class ArpFx {
public:
    void prepare(double sampleRate, int maxBlock);
    void set(const ArpFxSettings& s, bool now);
    void retimeDelay(double seconds);
    void process(const float* inL, const float* inR, float* outL, float* outR, int n);
    void reset();
    int latencySamples() const { return conv_.latency(); } // 0 (la convolution n'a pas de latence)

    // --- le plugin seul (voir en tete) ---
    /** Thread du message : calcule (et alloue) la reponse de ces reglages, 0..1 chacun. */
    static std::shared_ptr<const ReverbIR> makeReverb(double sampleRate, double size, double tone, double pre);
    /** Thread audio : la reponse neuve entre en fondu enchaine ; ni allocation ni liberation. false : refusee (nulle,
     *  autre frequence d'echantillonnage ou trop longue pour prepare, ou file des anciennes pleine), rien n'est pris. */
    bool setReverb(std::shared_ptr<const ReverbIR> ir);
    /** Un autre thread (un seul a la fois) : une reponse que le thread audio ne lit plus, a liberer ; nul : aucune. */
    std::shared_ptr<const ReverbIR> takeRetiredReverb() { return conv_.takeRetired(); }
    /** Thread audio : la reponse en place ou en route (la derniere acceptee), et si un fondu ou une attente court. */
    const ReverbIR* reverb() const { return conv_.target(); }
    bool reverbBusy() const { return conv_.busy(); }
    /** Le retard de la section master : 39 echantillons quand WARMTH est engagee, 0 sinon. */
    int masterLatencySamples() const { return master_.latency(); }

    // Pour les tests et l'interface
    int chorusMode() const { return mode_; }
    bool chorusLive() const { return branch_; }

private:
    static constexpr int Q = 128; // le bloc de rendu du Web Audio
    void processPiece(const float* inL, const float* inR, float* outL, float* outR, int n);
    void chorusSet(int m);
    void insertEngage(float dry, float wet);
    void insertRamp(detail::Param& p, float v);
    void insertRelease();
    void glide(detail::Param& p, double target);
    void retime(detail::Param& p, double t);
    void splitCoefs(float hz);

    double sr_ = 48000;
    int maxBlock_ = 0;
    long frame_ = 0;
    ArpFxSettings cur_{};
    bool have_ = false;

    // BASS MONO
    detail::Param splitHz_, low_;
    // les valeurs a-rate du morceau en cours
    std::array<float, Q> aSplit_{}, aLow_{}, aDry_{}, aWet_{}, aVol_{}, aDs_{}, aFb_{}, aDt_{}, aTs_{}, aTt_{}, aRs_{};
    detail::WebBiquad hp1_[2], hp2_[2], lp1_, lp2_;
    float splitAt_ = -1;
    // CHORUS (insert)
    int mode_ = 0;
    bool direct_ = true, branch_ = false;
    double notBefore_ = 0, teardownAt_ = -1;
    detail::Param dry_, wet_;
    detail::JunoChorus juno_;
    double pendingRate_ = 0;
    // VOLUME
    detail::Param vol_;
    // DELAY ping-pong
    detail::Param dSend_, fb_, dTime_;
    detail::WebBiquad dHp_, lpL_, lpR_;
    detail::WebDelay dl_, dr_;
    std::array<float, Q> lpHist_{};
    int lpHistI_ = 0;
    double delayAt_ = 0;
    // TAPE
    detail::Param tSend_, tFb_, tAmt_, tTime_;
    detail::TapeDelay tape_;
    float qFb_ = 0, qTape_ = 0;
    // REVERB
    detail::Param rSend_;
    detail::Convolver conv_;
    // MASTER
    detail::Master master_;

    // tampons (prepare)
    std::vector<float> bHiL_, bHiR_, bJL_, bJR_, bTL_, bTR_, bTo_L_, bTo_R_, bTime_, bRL_, bRR_, bRoL_, bRoR_;
};

} // namespace mmarp
