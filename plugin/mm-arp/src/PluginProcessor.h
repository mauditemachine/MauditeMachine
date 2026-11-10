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
#include "ExtraParams.h"
#include "Params.h"
#include "Voyager.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <atomic>
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
    void faceRun(bool on) { runInternal_.store(on); }
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
    };
    Feedback feedback() const;

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
    std::array<int, 6> xId_{};
    int osAsked_ = 4;
    static int osFor(double sr, double quality);
    void timerCallback() override;
    juce::SpinLock revLock_;
    std::shared_ptr<const mmarp::ReverbIR> revWanted_, revPending_;
    std::array<double, 4> revKey_{-1, -1, -1, -1};
    bool fresh_ = true;
    double lastBpm_ = 0;

    // Le programme : publie par le thread du message, pris par le thread audio au bloc suivant
    juce::SpinLock progLock_;
    std::shared_ptr<const MMArpProgram> pending_;
    std::shared_ptr<const MMArpProgram> retired_;
    std::shared_ptr<const MMArpProgram> current_;
    std::atomic<bool> knobsKnown_{false};

    // Le transport
    std::atomic<bool> runInternal_{false};
    std::atomic<bool> internalPlaying_{false};
    std::atomic<double> progBpm_{120};
    double internalPpq_ = 0;
    bool wasPlaying_ = false;
    int lastLiveMidi_ = -1;
    std::array<bool, 128> held_{};

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
    int64_t lastShownFrame_ = -1;

    // L'etat de la face (thread du message)
    mutable std::mutex mx_;
    juce::String programJson_;
    juce::String lsJson_;
    std::shared_ptr<const MMArpProgram> lastProgram_;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMArpProcessor)
};
