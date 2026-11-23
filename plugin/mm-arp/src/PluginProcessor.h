// MM-ARP, le processeur (2026-11-09) :
// - les 53 potards du site (voyager/params.ts VOY_KNOBS) sont des parametres de l'hote (automation, MIDI Map, le triangle
//   d'Ableton) ; le C++ en tire lui-meme le moteur, les effets et les notes de l'arpege (dsp/Params.cpp, les lois du
//   site) : tout marche fenetre fermee ;
// - la face envoie le reste (la suite EDIT, la progression, le tempo de son horloge, le swing) et ses gestes sur les
//   potards ;
// - les notes MIDI d'Ableton jouent le synthe ; l'etat du projet garde les parametres, la face et la graine.
#pragma once

#include "Arp.h"
#include "ArpFx.h"
#include "Decap.h"
#include "Hell.h"
#include "Hell2.h"
#include "ParamEq.h"
#include "ExtraParams.h"
#include "ModLfo.h"
#include "Params.h"
#include "Voyager.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <atomic>
#include <limits>
#include <memory>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

// Ce que la face envoie en plus des potards (programme v2, src/v4/plugin/arp/bridge.ts)
struct MMArpProgram {
    double bpm = 120;
    double swing = 0;
    mmarp::SeqStateC seq;
    std::array<int, 8> prog{};
    // Les pistes du sequenceur par pas (16 pas ; defauts : la suite telle que le site la joue)
    std::array<uint8_t, 16> stAcc{}, stSlide{}, stGate{}, stRat{}, stProb{};
    MMArpProgram() {
        stAcc.fill(1);
        stSlide.fill(0);
        stGate.fill(1);
        stRat.fill(1);
        stProb.fill(100);
    }
    int nProg = 0;
    // les potards de la face (le premier programme d'une instance neuve ou d'un projet d'avant les parametres)
    bool hasKnobs = false;
    std::array<double, mmarp::kKnobs> knobs{};
    std::array<double, mmx::kExtra> extra{};
};

class MMArpProcessor final : public juce::AudioProcessor, private juce::Timer {
public:
    MMArpProcessor();
    ~MMArpProcessor() override;

    // --- AudioProcessor ---
    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MM-ARP"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 4.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return "Default"; }
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    // --- la face (thread du message) ---
    void faceProgram(const juce::String& json);
    void faceState(const juce::String& lsJson);
    // v40 : RUN/STOP de la face ; l'hote joue : la pause de l'arpege (ARP RUN, le parametre en fin de liste) ; sinon
    // l'horloge interne, comme avant. RUN remet toujours ARP RUN a 1.
    void faceRun(bool on);
    void faceParam(const juce::String& id, double v);
    void faceGesture(const juce::String& id, bool on);
    juce::String faceInitState() const;
    // Les potards sont-ils connus du plugin (projet, automation) ? Sinon la face donne les siens au premier programme
    bool knobsKnown() const { return knobsKnown_.load(); }
    // Le parametre d'un potard (0..1), nullptr si inconnu
    juce::RangedAudioParameter* knobParam(int i) const { return knobParams_[static_cast<size_t>(i)]; }

    struct Feedback {
        bool playing;
        bool internal;
        int seq;
        int slot;
        int pos;
        int len;
        int chord;
        int midi;
        // v46 : CHANCE a saute la note de ce pas (pas un silence de la suite), la duree du pas en ms
        bool skip;
        int dur;
    };
    Feedback feedback() const;

    // L'arc lumineux de la face (2026-11-16) : les reglages que la face sait montrer modules, et leur valeur modulee
    // (0..1, la valeur du potard + l'ecart des modulations du dernier bloc, Voyager::modView), NaN quand rien ne les
    // module. Ecrites par le thread audio (des atomiques, sans allocation ni verrou), lues par le timer de l'editeur.
    static constexpr int kModN = 12;
    static const char* const kModIds[kModN];
    float modValue(int i) const { return modVal_[static_cast<size_t>(i)].load(std::memory_order_relaxed); }
    // Le LFO de HELL (-1..1, NaN quand HELL est coupe) : le VU de sa page dans la face
    float hellLfo() const { return hellLfo_.load(std::memory_order_relaxed); }
    // ATTITUDE, le VU de la page DISTO (2026-11-17, v25) : 0..1 pour -20..+3 dB dans la saturation ; NaN : DISTO coupee
    float distoVu() const { return distoVu_.load(std::memory_order_relaxed); }
    // v50, la matrice de modulation (les 8 emplacements xMx) : pour chaque emplacement actif qui vise un reglage hote
    // (cible 32 + k), l'indice k (mmx, -1 : rien) et la valeur effective normalisee du reglage (l'arc de la face,
    // mm_tick.m). Ecrits par le thread audio a chaque bloc, lus par le timer de l'editeur.
    int modShowK(int slot) const { return modShowK_[static_cast<size_t>(slot)].load(std::memory_order_relaxed); }
    float modShowV(int slot) const { return modShowV_[static_cast<size_t>(slot)].load(std::memory_order_relaxed); }
    // le banc seulement : la valeur de travail d'un reglage (la valeur effective quand un emplacement le module)
    double workValue(int k) const { return k < mmarp::kKnobs ? knobs_[static_cast<size_t>(k)] : ex_[static_cast<size_t>(k - mmarp::kKnobs)]; }
    // le banc seulement : le rendu par tranches de 32 echantillons est-il en service (une cible 32 + k hors du moteur) ?
    bool modSliced() const { return modTapOn_; }
    // v46 : la position (en noires, ppq) et le tempo du transport au debut du dernier bloc, pour la tete de lecture de la
    // page DELAY (mm_transport) ; -1 quand rien ne joue (ni l'hote, ni l'horloge interne)
    double facePpq() const { return facePpq_.load(std::memory_order_relaxed); }
    double faceBpm() const { return faceBpm_.load(std::memory_order_relaxed); }
    // v27 : l'analyseur de la page SOUND, seulement quand la face dit que la page est visible (le thread audio copie
    // alors la sortie dans un anneau ; specFrame, thread du message, en tire 96 bandes en dB, de 20 Hz a 20 kHz)
    void setSpecOn(bool on) { specOn_.store(on, std::memory_order_relaxed); }
    // v49 LATENCY : declare a l'hote la latence que le moteur a en ce moment, si elle a change (thread du message : le
    // timer de l'instance ; le banc l'appelle lui-meme). En ZERO elle reste a 0 ; en EXACT elle suit QUALITY et ENGINE.
    void syncLatency();
    // la latence que le moteur a en ce moment (ce que syncLatency declarera)
    int latencyNow() const { return latNow_.load(std::memory_order_relaxed); }
    // Le banc seulement (tests/host_test.cpp) : rendre l'ancien DELAY (DLY TIME, TAPE, DELAY MODE) comme avant la v27
    static inline bool testLegacyDelay = false;
    bool specOn() const { return specOn_.load(std::memory_order_relaxed); }
    bool specFrame(float* out96) { return spec_.frame(out96); }

    // v31 (Mika : "un compteur de cpu en haut a droite du plugin") : la charge de CETTE instance, en % du temps reel
    // (le temps de processBlock rapporte a la duree du bloc), lissee sur 250 ms, par etage, et le pic du total tenu 1 s.
    // Ecrites par le thread audio (des atomiques, sans allocation), lues par le timer de l'editeur.
    enum CpuStage { kCpuEngine, kCpuDisto, kCpuDelay, kCpuReverb, kCpuHell, kCpuEqRack, kCpuRest, kCpuTotal, kCpuN };
    float cpu(int i) const { return cpu_[static_cast<size_t>(i)].load(std::memory_order_relaxed); }
    float cpuPeak() const { return cpuPeak_.load(std::memory_order_relaxed); }
    // le surechantillonnage du moteur (8 en HQ) et les voix qui sonnent, pour le detail du compteur
    int cpuOs() const { return cpuOs_.load(std::memory_order_relaxed); }
    int cpuVoices() const { return cpuVoices_.load(std::memory_order_relaxed); }
    bool cpuPro() const { return cpuPro_.load(std::memory_order_relaxed); }

    // L'arpege en clip MIDI : la progression entiere, cycles fois, avec les reglages du moment (thread du message).
    // bars : le nombre de mesures (0 sans accord).
    juce::MidiFile arpMidi(int cycles, int& bars) const;
    // Le meme, ecrit dans ~/Music/Maudite Machine/MM-ARP Clips (un fichier par glisser) ; File() sans accord
    juce::File arpMidiFile(int cycles) const;

    // MIDI LEARN (thread du message) : arme un potard (id vide : annule), retire une assignation (canal 1..16 cote face)
    void learn(const juce::String& id);
    void unmap(int ch, int cc);
    void unmapAll();
    // {items: [{cc, ch (1..16), id}], learn: id arme ou ""}
    juce::var midiMap() const;
    bool takeMapChanged() { return mapChanged_.exchange(false); }
    // Le clip a le dessus en ce moment (l'arpege interne se tait)
    bool clipActive() const { return clipActive_.load(); }

    // La largeur de la fenetre choisie par Mika (gardee dans le projet)
    // La taille de la fenetre (2026-11-18, v29, Mika : "20% moins grand") : 1496 par defaut, de 704 a 2640
    static constexpr int kEditorDefaultW = 1496;
    static constexpr int kEditorMinW = 704;
    static constexpr int kEditorMaxW = 2640;
    int editorWidth() const { return editorW_.load(); }
    void setEditorWidth(int w) { editorW_.store(w); }

    // Le dossier des presets sur le disque : ~/Music/Maudite Machine/MM-ARP Presets
    static juce::File presetDir();

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout makeLayout();
    void publish(std::shared_ptr<const MMArpProgram> p);
    void setKnobsFrom(const std::array<double, mmarp::kKnobs>& k);
    bool legacyFromLs(const juce::String& lsJson);
    void update(double bpm, bool knobsChanged, bool progChanged);

    // Le moteur et sa chaine (thread audio, recrees par prepareToPlay)
    std::unique_ptr<mmarp::Voyager> voy_;
    mmarp::ArpFx fx_;
    // HELL (2026-11-13) : delay + decaleur de Bode, apres la chaine ; contourne au bit pres a MIX 0
    mmarp::Hell hell_;
    // v46 : HELL v2 (Hell2.h), la descente en six cercles, a la place de HELL quand xHellV2 est a ON ; h2Ex_ : l'indice
    // (extra) de chacun de ses reglages (Hell2::kKeyIds) ; hellV2Was_ : le moteur du bloc d'avant (un changement vide l'autre)
    mmarp::Hell2 hell2_;
    std::array<int, mmarp::Hell2::kKeys> h2Ex_{};
    int hellV2Was_ = -1;
    // DISTO facon Decapitator (2026-11-16) : entre le moteur et la chaine ; contournee au bit pres a DRIVE 0 ou en MM
    mmarp::Decap decap_;
    int driveId_ = -1;
    double hellNoteHz_ = 0;
    std::atomic<float> hellLfo_{std::numeric_limits<float>::quiet_NaN()};
    std::atomic<float> distoVu_{std::numeric_limits<float>::quiet_NaN()};
    std::atomic<double> facePpq_{-1}, faceBpm_{120};
    void migrateHell();
    // La pedale DISTORTION (xDist, xDistTone), masquee en v25 : un projet qui l'avait passe a la DISTO (convertPedal)
    void convertPedal();
    // v27 : l'ancien DELAY (DLY TIME, TAPE, DELAY MODE, masques : OLD ...) passe a la page DELAY (convertDelay)
    void convertDelay();
    // v31 : le compteur CPU (thread audio : les lissages ; les atomiques pour l'editeur)
    std::array<std::atomic<float>, kCpuN> cpu_{};
    std::atomic<float> cpuPeak_{0};
    std::atomic<int> cpuOs_{1}, cpuVoices_{0};
    std::atomic<bool> cpuPro_{false};
    std::array<double, kCpuN> cpuSm_{};
    double cpuPk_ = 0, cpuHold_ = 0;
    const double tickS_ = 1.0 / static_cast<double>(juce::Time::getHighResolutionTicksPerSecond());
    void cpuMeter(const double* s, int n);
    // v27 : l'EQ parametrique 6 bandes (apres HELL), son analyseur
    mmarp::ParamEq peq_;
    mmarp::SpecAnalyzer spec_;
    std::atomic<bool> specOn_{false};
    double dlyFree_ = 0; // DELAY en FREE : son temps (s) ; 0 : au tempo (SYNC)
    bool syncFx_ = false;
    bool eqFresh_ = true;  // PHASER ou FLANGER au tempo : la chaine suit les changements de tempo
    std::array<std::atomic<float>, kModN> modVal_{};
    std::array<int, kModN> modKnob_{};
    void publishMod();
    mmarp::Arp arp_;
    double sr_ = 0;
    int64_t frame_ = 0;
    uint32_t seed_ = 0;
    std::vector<float> dryL_, dryR_;
    // Le moteur rend par blocs de 128 exactement (le son du site au bit pres, comme l'AudioWorklet) : sa sortie passe
    // par une file, 128 echantillons de retard declares a l'hote
    std::vector<float> fifoL_, fifoR_;
    size_t fifoHead_ = 0, fifoSize_ = 0;
    int64_t engFrames_ = 0;
    void fifoReserve(size_t cap);

    // Les potards sur le thread audio : leurs valeurs, ce qui en est tire
    std::array<std::atomic<float>*, mmarp::kKnobs> knobRaw_{};
    // les potards du site puis les reglages du VST3 seul (ExtraParams.h)
    std::array<juce::RangedAudioParameter*, mmx::kAll> knobParams_{};
    std::array<std::atomic<float>*, mmx::kExtra> exRaw_{};
    std::array<float, mmx::kExtra> exLast_{};
    std::array<double, mmx::kExtra> ex_{};
    std::array<double, mmarp::kKnobs> knobs_{};
    std::array<float, mmarp::kKnobs> knobRawLast_{};
    std::array<mmarp::ParamKV, 160> kv_{};
    mmarp::ArpProgram arpBuf_[2];
    int arpCur_ = 0;
    mmarp::ArpFxSettings fxNow_;
    double dly16_ = 3;
    int bpmId_ = -1;
    // QUALITY et la reverb du VST3 (ExtraParams.h)
    std::array<int, 13> xId_{};
    std::array<int, 22> mId_{};
    // v50 : l1Free, l1Hz, l2Free, l2Hz, puis x1Src, x1Dst, x1Amt ... x8Amt (les cles du moteur)
    std::array<int, 4 + 3 * mmx::kModSlots> vId_{};
    void applySteps(const MMArpProgram& p, mmarp::ArpProgram& out, double swingOwn) const;
    // update() en morceaux (v50 : la matrice les rappelle pour les seules familles modulees) : les reglages du moteur
    // (bpm compris ou non), la chaine (construite puis posee si elle change), l'arpege
    int engineKv(double bpm, bool withBpm);
    void buildFx(double bpm, mmarp::ArpFxSettings& fx, double& dly16);
    void applyFx(const mmarp::ArpFxSettings& fx, double dly16, double bpm);
    void buildArp();
    // l'etage DISTO, HELL (ancien ou v2), l'EQ parametrique : un bloc (v49) ou une tranche (v50)
    void runDisto(float* L, float* R, int n, double bpm);
    void runHell(float* L, float* R, int n, double ppq, bool playing, double bpm);
    void runEq(float* L, float* R, int n, bool set);

    // v50, la matrice de modulation : les 8 emplacements (xMx{n}Src / Dst / Amt) et leur chemin. route : 0 au repos ;
    // 1 destination synthe (1..19, une ligne du moteur) ; 2 un potard qui a son equivalent par voix (cutoff -> CUTOFF...,
    // une ligne du moteur, quantite x scale) ; 3 un autre reglage hote (le moteur en calcule la contribution, modTaps, le
    // processeur l'applique au reglage, par tranches de 32 echantillons)
    struct ModSlot {
        int src = 0, code = 0, k = -1, route = 0, dst = 0;
        double amt = 0, scale = 1;
    };
    std::array<ModSlot, mmx::kModSlots> mslot_{};
    void modRoute();
    // les reglages modules par une contribution (route 3, ou une ligne qui glisse encore vers 0) : leur valeur hote
    // gardee (host, et le flottant brut de l'hote pour voir qu'il change), la contribution, la valeur effective
    // (ecrite dans knobs_ / ex_ a la place de celle de l'hote), la famille (FAM_*)
    struct ModTgt {
        int k = -1, fam = 0;
        bool slow = false; // HELL : la valeur effective glisse en plus (10 ms), voir modTapsApply
        double host = 0, off = 0, eff = 0, sm = 0;
        float raw = 0;
    };
    static constexpr int kModTgt = 16;
    std::array<ModTgt, kModTgt> mtgt_{};
    int nTgt_ = 0;
    bool modTapOn_ = false;           // le rendu par tranches (une route 3 ou une cible encore modulee)
    bool lfo3On_ = false, lfo4On_ = false;
    bool arpDirty_ = false;           // l'arpege a refaire au bloc suivant (GATE, ACCENT, DRIFT, SWING modules)
    mmarp::DistoLfo lfo3_;
    mmarp::Lfo4 lfo4_;
    std::array<std::atomic<int>, mmx::kModSlots> modShowK_{};
    std::array<std::atomic<float>, mmx::kModSlots> modShowV_{};
    bool modShowAny_ = false;
    void modLfoChunk(int n, double ppqEnd, bool playing, double bpm);
    void modTapsApply(double bpm, int len, bool& eqSet);
    void modHostSync();
    void modShow();
    void modReset();
    static int modFamily(int k);
    int osAsked_ = 4;
    static int osFor(double sr, double quality, bool exportHq, bool pro);
    // v49 LATENCY (ZERO / EXACT) : le mode demande au dernier bloc ; la latence que le moteur a en ce moment (thread audio),
    // declaree a l'hote par le timer (thread du message : setLatencySamples n'est pas pour le thread audio) quand elle
    // change ; en ZERO elle reste a 0
    bool zlAsked_ = false;
    std::atomic<int> latNow_{0};
    void timerCallback() override;
    juce::SpinLock revLock_;
    std::shared_ptr<const mmarp::ReverbIR> revWanted_, revPending_;
    std::array<double, 4> revKey_{-1, -1, -1, -1};
    // v31 (Mika : "je viens de freez mon cpu") : la reponse de la reverb se calcule sur un fil partage par les instances
    // (RevPool), plus sur le thread du message : 6 a 40 ms par calcul, jusqu'a 15 fois par seconde sous automation de
    // SIZE, TONE ou PRE DELAY, ce qui bloquait l'interface de l'hote. Le timer lance le calcul et reprend le resultat.
    struct RevJob {
        juce::SpinLock lock;
        std::shared_ptr<const mmarp::ReverbIR> ready;
        std::atomic<bool> busy{false};
    };
    struct RevPool {
        juce::ThreadPool pool{juce::ThreadPoolOptions{}.withThreadName("MM-ARP reverb").withNumberOfThreads(1).withDesiredThreadPriority(juce::Thread::Priority::low)};
        ~RevPool() { pool.removeAllJobs(true, 5000); }
    };
    std::shared_ptr<RevJob> revJob_ = std::make_shared<RevJob>();
    juce::SharedResourcePointer<RevPool> revPool_;
    bool fresh_ = true;
    double lastBpm_ = 0;

    // Le programme : publie par le thread du message, pris par le thread audio au bloc suivant
    juce::SpinLock progLock_;
    std::shared_ptr<const MMArpProgram> pending_;
    std::shared_ptr<const MMArpProgram> retired_;
    std::shared_ptr<const MMArpProgram> current_;
    std::atomic<bool> knobsKnown_{false};
    std::atomic<int> editorW_{kEditorDefaultW};

    // Le transport
    std::atomic<bool> runInternal_{false};
    std::atomic<bool> hostPlaying_{false}; // v40 : l'hote joue (dernier bloc)
    std::atomic<bool> internalPlaying_{false};
    std::atomic<double> progBpm_{120};
    double internalPpq_ = 0;
    bool wasPlaying_ = false;
    int lastLiveMidi_ = -1;
    std::array<bool, 128> held_{};
    // v38 MIDI IN (NOTES, ARP, LAYER) : en ARP, les touches tenues (liveKeys_) font l'accord arpege (liveChord_, garde
    // apres le lacher avec HOLD), son programme a part (liveProg_, reserve d'avance : ni allocation ni verrou)
    std::array<bool, 128> liveKeys_{}, liveChord_{};
    bool liveDirty_ = false, liveOnPrev_ = false;
    int midiInPrev_ = 0;
    mmarp::ArpProgram liveProg_;
    void buildLive();

    // Les parametres de l'hote (en plus des potards)
    std::atomic<float>* master_ = nullptr;
    std::atomic<float>* arpOn_ = nullptr;
    std::atomic<float>* prio_ = nullptr;

    // MIDI LEARN : canal x 128 + CC -> potard (-1 : rien) ; le potard arme
    std::array<std::atomic<int>, 16 * 128> ccMap_{};
    std::atomic<int> learn_{-1};
    std::atomic<bool> mapChanged_{true};
    void onCC(int ch, int cc, int value);
    // Le clip a le dessus : la derniere note MIDI recue (frame)
    int64_t lastNoteFrame_ = -1;
    std::atomic<bool> clipActive_{false};

    // Le retour vers la face
    std::atomic<bool> fbPlaying_{false};
    std::atomic<int> fbSeq_{0}, fbSlot_{-1}, fbPos_{0}, fbLen_{0}, fbChord_{-1}, fbMidi_{-1};
    std::atomic<bool> fbSkip_{false};
    std::atomic<int> fbDur_{0};
    int64_t lastShownFrame_ = -1;

    // L'etat de la face (thread du message)
    mutable std::mutex mx_;
    juce::String programJson_;
    juce::String lsJson_;
    std::shared_ptr<const MMArpProgram> lastProgram_;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMArpProcessor)
};
