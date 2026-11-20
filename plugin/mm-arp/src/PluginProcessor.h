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
#include "ParamEq.h"
#include "ExtraParams.h"
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
    // v27 : l'analyseur de la page SOUND, seulement quand la face dit que la page est visible (le thread audio copie
    // alors la sortie dans un anneau ; specFrame, thread du message, en tire 96 bandes en dB, de 20 Hz a 20 kHz)
    void setSpecOn(bool on) { specOn_.store(on, std::memory_order_relaxed); }
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
    // DISTO facon Decapitator (2026-11-16) : entre le moteur et la chaine ; contournee au bit pres a DRIVE 0 ou en MM
    mmarp::Decap decap_;
    int driveId_ = -1;
    double hellNoteHz_ = 0;
    std::atomic<float> hellLfo_{std::numeric_limits<float>::quiet_NaN()};
    std::atomic<float> distoVu_{std::numeric_limits<float>::quiet_NaN()};
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
    std::array<mmarp::ParamKV, 96> kv_{};
    mmarp::ArpProgram arpBuf_[2];
    int arpCur_ = 0;
    mmarp::ArpFxSettings fxNow_;
    double dly16_ = 3;
    int bpmId_ = -1;
    // QUALITY et la reverb du VST3 (ExtraParams.h)
    std::array<int, 13> xId_{};
    std::array<int, 22> mId_{};
    void applySteps(const MMArpProgram& p, mmarp::ArpProgram& out, double swingOwn) const;
    int osAsked_ = 4;
    static int osFor(double sr, double quality, bool exportHq, bool pro);
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
