// MM-ARP, le moteur du navigateur (2026-11-25) : le processeur du VST3 (src/PluginProcessor.cpp) sans JUCE, pour le
// compiler en WebAssembly (Emscripten) et le jouer dans un AudioWorklet, pilote par la face du plugin
// (src/v4/plugin/arp). Il doit sonner EXACTEMENT comme le VST3 : la logique du processeur est recopiee telle quelle, le
// DSP est celui de mmarp_dsp (dsp/*), compile avec les memes options (-ffp-contract=off).
//
// Ce que chaque partie recopie (src/PluginProcessor.cpp, a garder en phase quand le VST3 change) :
//   Program                      PluginProcessor.h 33-52 (MMArpProgram) ; les bornes de parseProgram, cpp 32-99
//   ArpEngine::ArpEngine         cpp 160-224 (le constructeur : defauts, ids du moteur, LFO 4, programme vide)
//   publish, setKnobsFrom        cpp 228-247
//   setProgram                   cpp 249-263 (faceProgram, la regle knobsKnown) ; le JSON est lu en JS
//   setParam                     cpp 265-270 (faceParam)
//   renderClip                   cpp 297-365 (Collect, arpMidi : les notes, pas le fichier MIDI)
//   buildLive                    cpp 367-409
//   run                          cpp 411-420 (faceRun)
//   osFor                        cpp 441-446
//   idle                         cpp 450-495 (syncLatency, timerCallback : la reverb recalculee ici, sans fil)
//   onCC, learn, unmap, unmapAll cpp 499-529
//   kModIds, publishMod          cpp 820-849
//   publishEg                    cpp 853-858
//   applySteps                   cpp 861-870
//   sameV27, sameRvPost          cpp 872-891
//   update, engineKv             cpp 894-968
//   buildFx, applyFx, buildArp   cpp 971-1116
//   voiceRoute, modFamily        cpp 1120-1190
//   modRoute ... modReset        cpp 1193-1378
//   runDisto, runHell, runEq     cpp 1381-1517
//   prepare                      cpp 1519-1588 (prepareToPlay ; la file morte fifo* n'est pas reprise)
//   cpuMeter                     cpp 1604-1621
//   process                      cpp 1623-1977 (processBlock)
//
// Ce qui remplace JUCE (le son n'en depend pas) :
//   - les parametres de l'hote : raw_ (359 float32 : les potards 0..61 puis les reglages 62..358), master_ (dB), arpOn_,
//     prio_ ; setValueNotifyingHost(v) devient raw_[i] = (float)v ;
//   - getPlayHead : aucun dans le navigateur (le tempo du programme, RUN sur l'horloge interne) ; setHostPosition en
//     donne un pour le bloc suivant seulement (optionnel : une synchro future) ;
//   - isNonRealtime : offline_ (faux par defaut : EXPORT HQ ne joue jamais dans le navigateur) ;
//   - le MidiBuffer : une file d'evenements (midi), triee par position comme MidiBuffer, vide a chaque process ;
//   - juce::Time / steady_clock du compteur CPU : nowS() ; sous __EMSCRIPTEN__ un bouchon (0, compteur a 0) sauf
//     MMARP_WEB_CPU=1 (steady_clock, donc l'import WASI clock_time_get) ;
//   - le ThreadPool de la reverb : idle(), synchrone (appele par le JS entre deux quanta) ;
//   - ScopedNoDenormals : le meme registre en natif (SSE : FTZ + DAZ ; arm64 : FZ) ; rien en wasm (pas de mode).
// Un seul fil : tous les appels sur le meme fil (le worklet), donc ni atomiques ni verrous.
#pragma once

#include "Arp.h"
#include "ArpFx.h"
#include "Decap.h"
#include "ExtraParams.h"
#include "Hell.h"
#include "Hell2.h"
#include "ModLfo.h"
#include "ParamEq.h"
#include "Params.h"
#include "Voyager.h"

#include <array>
#include <cstdint>
#include <limits>
#include <memory>
#include <vector>

namespace mmarpweb {

// Le programme de la face (MMArpProgram), deja lu par le JS
struct Program {
    double bpm = 120;
    double swing = 0;
    mmarp::SeqStateC seq;
    std::array<int, 8> prog{};
    std::array<uint8_t, 16> stAcc{}, stSlide{}, stGate{}, stRat{}, stProb{};
    Program() {
        stAcc.fill(1);
        stSlide.fill(0);
        stGate.fill(1);
        stRat.fill(1);
        stProb.fill(100);
    }
    int nProg = 0;
    bool hasKnobs = false;
    std::array<double, mmarp::kKnobs> knobs{};
    std::array<double, mmx::kExtra> extra{};
};

// Ce que le timer de l'editeur lit (PluginEditor.cpp timerCallback), en doubles (le JS : un Float64Array). L'ordre des
// champs est l'ABI : ne rien inserer, ajouter en fin.
struct Telemetry {
    // la tete (feedback(), facePpq, faceBpm)
    double playing, internal, seq, slot, pos, len, chord, midi, skip, dur, ppq, bpm;
    // les arcs (kModIds, NaN : rien ne module), la matrice (modShowK : -1 rien), les VU
    double mod[12];
    double modShowK[8];
    double modShowV[8];
    double hellLfo, distoVu;
    // l'ecran des enveloppes (eg[0] NaN : aucune voix), et ce silence en clair
    double eg[6];
    double egSilent;
    // le compteur CPU (CpuStage), le pic, le detail
    double cpu[8];
    double cpuPeak, os, voices, pro, sr, block;
    // la latence du moteur en ce moment (latNow), et la derniere vue par idle (syncLatency)
    double latency, latencyDeclared;
    // le reste : le clip a le dessus, potards connus, potard arme (MIDI LEARN, -1), table changee (sans la vider),
    // analyseur demande, l'hote joue, la frame du moteur
    double clipActive, knobsKnown, learn, mapChanged, specOn, hostPlaying, frame;
};
constexpr int kTelemetryN = 72;
static_assert(sizeof(Telemetry) == kTelemetryN * sizeof(double), "Telemetry : des doubles seulement");

class ArpEngine {
public:
    explicit ArpEngine(uint32_t seed);

    // --- l'audio ---
    void prepare(double sampleRate, int samplesPerBlock);
    void process(float* outL, float* outR, int n);
    // le timer de l'instance (15 Hz dans le VST3) : la latence, la reverb recalculee si SIZE / TONE / PRE ont bouge
    void idle();

    // --- les parametres (les potards puis les reglages, 0..1, float32 comme l'hote) : leur valeur (getValue, ce que
    // l'editeur envoie a la face), en lecture seule ; on les change par setParam ---
    float* params() { return val_.data(); }
    void setParam(int i, double v);
    bool knobsKnown() const { return knobsKnown_; }
    void setKnobsKnown(bool on) { knobsKnown_ = on; }
    void setMasterDb(double db);
    void setArpEnabled(bool on) { arpOn_ = on ? 1.f : 0.f; }
    void setClipPriority(bool on) { prio_ = on ? 1.f : 0.f; }

    // --- la face ---
    void setProgram(const Program& p);
    void run(bool on);
    void midi(int offset, int status, int d1, int d2);
    void setSpecOn(bool on) { specOn_ = on; }
    bool specFrame(float* out96) { return spec_.frame(out96); }
    const Telemetry& telemetry();

    // --- MIDI LEARN ---
    void learn(int index);
    void unmap(int ch, int cc);
    void unmapAll();
    void mapSet(int ch, int cc, int index);
    bool takeMapChanged() {
        const bool c = mapChanged_;
        mapChanged_ = false;
        return c;
    }
    int32_t* ccMap() { return ccMap_.data(); }

    // --- l'arpege en clip (arpMidi) : notes {onTick, offTick, vel, midi} (960 par noire), rend leur nombre ---
    int renderClip(int cycles, float* out, int maxNotes, int& bars) const;

    // --- divers ---
    uint32_t seed() const { return seed_; }
    void setSeed(uint32_t s) { seed_ = s; }
    void setOffline(bool on) { offline_ = on; }
    void setHostPosition(bool playing, double ppq, double bpm);

    // les ids des arcs (MMArpProcessor::kModIds)
    static constexpr int kModN = 12;
    static const char* const kModIds[kModN];
    static constexpr int kEgN = 6;
    enum CpuStage { kCpuEngine, kCpuDisto, kCpuDelay, kCpuReverb, kCpuHell, kCpuEqRack, kCpuRest, kCpuTotal, kCpuN };

    // le banc : la valeur de travail d'un reglage, le rendu par tranches
    double workValue(int k) const { return k < mmarp::kKnobs ? knobs_[static_cast<size_t>(k)] : ex_[static_cast<size_t>(k - mmarp::kKnobs)]; }
    bool modSliced() const { return modTapOn_; }
    int latencyNow() const { return latNow_; }

private:
    void publish(const Program& p);
    void setKnobsFrom(const std::array<double, mmarp::kKnobs>& k);
    void update(double bpm, bool knobsChanged, bool progChanged);

    // Le moteur et sa chaine
    std::unique_ptr<mmarp::Voyager> voy_;
    mmarp::ArpFx fx_;
    mmarp::Hell hell_;
    mmarp::Hell2 hell2_;
    std::array<int, mmarp::Hell2::kKeys> h2Ex_{};
    int hellV2Was_ = -1;
    mmarp::Decap decap_;
    int driveId_ = -1;
    double hellNoteHz_ = 0;
    float hellLfo_ = std::numeric_limits<float>::quiet_NaN();
    float distoVu_ = std::numeric_limits<float>::quiet_NaN();
    double facePpq_ = -1, faceBpm_ = 120;
    // le compteur CPU
    std::array<float, kCpuN> cpu_{};
    float cpuPeak_ = 0;
    int cpuOs_ = 1, cpuVoices_ = 0;
    bool cpuPro_ = false;
    std::array<double, kCpuN> cpuSm_{};
    double cpuPk_ = 0, cpuHold_ = 0;
    void cpuMeter(const double* s, int n);
    mmarp::ParamEq peq_;
    mmarp::SpecAnalyzer spec_;
    bool specOn_ = false;
    double dlyFree_ = 0;
    bool syncFx_ = false;
    bool eqFresh_ = true;
    std::array<float, kModN> modVal_{};
    std::array<int, kModN> modKnob_{};
    void publishMod();
    std::array<float, kEgN> egVal_{};
    void publishEg();
    mmarp::Arp arp_;
    double sr_ = 0;
    int block_ = 0;
    int64_t frame_ = 0;
    uint32_t seed_ = 0;
    std::vector<float> dryL_, dryR_;

    // Les parametres de l'hote : val_ (getValue), raw_ (getRawParameterValue, ce que lit l'audio) et ce qu'on en tire.
    // setValueNotifyingHost : hostSet (l'adaptateur de l'APVTS ne recopie pas une valeur a peu pres egale, sauf la
    // premiere fois : juce_AudioProcessorValueTreeState.cpp parameterValueChanged)
    std::array<float, mmx::kAll> val_{}, raw_{};
    std::array<bool, mmx::kAll> touched_{};
    void hostSet(int i, float v);
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
    std::array<int, 13> xId_{};
    std::array<int, 22> mId_{};
    std::array<int, 4 + 3 * mmx::kModSlots> vId_{};
    void applySteps(const Program& p, mmarp::ArpProgram& out, double swingOwn) const;
    int engineKv(double bpm, bool withBpm);
    void buildFx(double bpm, mmarp::ArpFxSettings& fx, double& dly16);
    void applyFx(const mmarp::ArpFxSettings& fx, double dly16, double bpm);
    void buildArp();
    void runDisto(float* L, float* R, int n, double bpm);
    void runHell(float* L, float* R, int n, double ppq, bool playing, double bpm);
    void runEq(float* L, float* R, int n, bool set);

    // la matrice de modulation (les 8 emplacements xMx)
    struct ModSlot {
        int src = 0, code = 0, k = -1, route = 0, dst = 0;
        double amt = 0, scale = 1;
    };
    std::array<ModSlot, mmx::kModSlots> mslot_{};
    void modRoute();
    struct ModTgt {
        int k = -1, fam = 0;
        bool slow = false;
        double host = 0, off = 0, eff = 0, sm = 0;
        float raw = 0;
    };
    static constexpr int kModTgt = 16;
    std::array<ModTgt, kModTgt> mtgt_{};
    int nTgt_ = 0;
    bool modTapOn_ = false;
    bool lfo3On_ = false, lfo4On_ = false;
    bool arpDirty_ = false;
    mmarp::DistoLfo lfo3_;
    mmarp::Lfo4 lfo4_;
    std::array<int, mmx::kModSlots> modShowK_{};
    std::array<float, mmx::kModSlots> modShowV_{};
    bool modShowAny_ = false;
    void modLfoChunk(int n, double ppqEnd, bool playing, double bpm);
    void modTapsApply(double bpm, int len, bool& eqSet);
    void modHostSync();
    void modShow();
    void modReset();
    static int modFamily(int k);
    int osAsked_ = 4;
    static int osFor(double sr, double quality, bool exportHq, bool pro);
    bool zlAsked_ = false;
    int latNow_ = 0, latDeclared_ = 0;
    // la reverb : la derniere reponse demandee (gardee ici : rien n'est libere dans process), celle en attente
    std::shared_ptr<const mmarp::ReverbIR> revWanted_, revPending_;
    std::array<double, 4> revKey_{-1, -1, -1, -1};
    bool fresh_ = true;
    double lastBpm_ = 0;

    // Le programme : publie par la face, pris au bloc suivant
    Program pending_, current_, lastProgram_;
    bool hasPending_ = false, hasCurrent_ = false, hasLast_ = false;
    bool knobsKnown_ = false;

    // Le transport
    bool runInternal_ = false;
    bool hostPlaying_ = false;
    bool internalPlaying_ = false;
    double progBpm_ = 120;
    double internalPpq_ = 0;
    bool wasPlaying_ = false;
    int lastLiveMidi_ = -1;
    std::array<bool, 128> held_{};
    std::array<bool, 128> liveKeys_{}, liveChord_{};
    bool liveDirty_ = false, liveOnPrev_ = false;
    int midiInPrev_ = 0;
    mmarp::ArpProgram liveProg_;
    void buildLive();
    bool offline_ = false;
    struct HostPos {
        bool valid = false, playing = false;
        double ppq = 0, bpm = 0;
    } host_;

    // Les parametres de l'hote en plus des potards
    float master_ = 0.f;  // dB (-60..6, au dixieme)
    float arpOn_ = 1.f;
    float prio_ = 1.f;

    // MIDI LEARN
    std::array<int32_t, 16 * 128> ccMap_{};
    int learn_ = -1;
    bool mapChanged_ = true;
    void onCC(int ch, int cc, int value);
    int64_t lastNoteFrame_ = -1;
    bool clipActive_ = false;

    // la file MIDI du prochain bloc (MidiBuffer)
    struct MidiEv {
        int pos;
        uint8_t d[3];
    };
    static constexpr int kMidiCap = 1024;
    std::array<MidiEv, kMidiCap> midiQ_{};
    int midiN_ = 0;

    // Le retour vers la face
    bool fbPlaying_ = false;
    int fbSeq_ = 0, fbSlot_ = -1, fbPos_ = 0, fbLen_ = 0, fbChord_ = -1, fbMidi_ = -1;
    bool fbSkip_ = false;
    int fbDur_ = 0;
    int64_t lastShownFrame_ = -1;

    Telemetry tele_{};
};

} // namespace mmarpweb

/* ---------------- l'API C (le worklet : Emscripten, wasm) ---------------- */

#if defined(__EMSCRIPTEN__)
#include <emscripten/emscripten.h>
#define MMARP_API EMSCRIPTEN_KEEPALIVE
#else
#define MMARP_API
#endif

extern "C" {
typedef struct MMArpEngine MMArpEngine;

MMARP_API MMArpEngine* mmarp_create(uint32_t seed);
MMARP_API void mmarp_destroy(MMArpEngine* e);
MMARP_API void mmarp_prepare(MMArpEngine* e, double sampleRate, int maxBlock);
MMARP_API void mmarp_process(MMArpEngine* e, float* outL, float* outR, int n);
MMARP_API void mmarp_idle(MMArpEngine* e);

MMARP_API int mmarp_param_count(void);
MMARP_API const char* mmarp_param_id(int i);
MMARP_API int mmarp_param_index(const char* id);
MMARP_API double mmarp_param_default(int i);
MMARP_API float* mmarp_params(MMArpEngine* e);
MMARP_API void mmarp_set_param(MMArpEngine* e, int i, double v);
MMARP_API int mmarp_knobs_known(MMArpEngine* e);
MMARP_API void mmarp_set_knobs_known(MMArpEngine* e, int on);
MMARP_API void mmarp_set_master_db(MMArpEngine* e, double db);
MMARP_API void mmarp_set_arp_enabled(MMArpEngine* e, int on);
MMARP_API void mmarp_set_clip_priority(MMArpEngine* e, int on);

MMARP_API void mmarp_set_program(MMArpEngine* e, double bpm, double swing, int seqEdit, int seqLen, const int32_t* seqBuf16, const int32_t* prog, int nProg,
                                 const uint8_t* lanes80, const float* knobs62, const float* extras297, int hasKnobs);
MMARP_API void mmarp_run(MMArpEngine* e, int on);
MMARP_API void mmarp_midi(MMArpEngine* e, int offset, int status, int d1, int d2);

MMARP_API const double* mmarp_telemetry(MMArpEngine* e);
MMARP_API int mmarp_telemetry_size(void);
MMARP_API void mmarp_set_spec_on(MMArpEngine* e, int on);
MMARP_API int mmarp_spec_frame(MMArpEngine* e, float* out96);

MMARP_API void mmarp_learn(MMArpEngine* e, int index);
MMARP_API void mmarp_unmap(MMArpEngine* e, int ch0, int cc);
MMARP_API void mmarp_unmap_all(MMArpEngine* e);
MMARP_API void mmarp_map_set(MMArpEngine* e, int ch0, int cc, int index);
MMARP_API int mmarp_take_map_changed(MMArpEngine* e);
MMARP_API int32_t* mmarp_ccmap(MMArpEngine* e);

MMARP_API int mmarp_render_clip(MMArpEngine* e, int cycles, float* outNotes, int maxNotes, int* bars);

MMARP_API uint32_t mmarp_seed(MMArpEngine* e);
MMARP_API void mmarp_set_seed(MMArpEngine* e, uint32_t seed);
MMARP_API void mmarp_set_offline(MMArpEngine* e, int on);
MMARP_API void mmarp_set_host_position(MMArpEngine* e, int playing, double ppq, double bpm);

MMARP_API void* mmarp_alloc(int bytes);
MMARP_API void mmarp_free(void* p);
}
