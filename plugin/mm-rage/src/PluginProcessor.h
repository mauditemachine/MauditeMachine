// MM-RAGE, le processeur : la DISTO du MM-ARP (dsp/Decap.cpp, au bit pres) en effet audio stereo seul. 54 parametres pour
// l'hote (automation, MIDI Map d'Ableton), les 85 presets d'usine en programmes, le tempo de l'hote (LFO SYNC). Le DSP
// reste toujours en circuit (DRIVE 0 = 0 dB) : 32 echantillons de retard, declares a l'hote, qui ne changent jamais.
#pragma once

#include "RagePatch.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>
#include <functional>
#include <limits>
#include <string>
#include <vector>

namespace pid {
inline constexpr const char* style = "style";
inline constexpr const char* drive = "drive";
inline constexpr const char* punish = "punish";
inline constexpr const char* low = "low";
inline constexpr const char* thump = "thump";
inline constexpr const char* tone = "tone";
inline constexpr const char* high = "high";
inline constexpr const char* steep = "steep";
inline constexpr const char* mix = "mix";
inline constexpr const char* out = "out";
inline constexpr const char* autoGain = "auto";
inline constexpr const char* morph = "morph";
inline constexpr const char* morphTo = "morphTo";
inline constexpr const char* dyn = "dyn";
inline constexpr const char* fb = "fb";
inline constexpr const char* fbFreq = "fbFreq";
inline constexpr const char* bands = "bands";
inline constexpr const char* xLo = "xLo";
inline constexpr const char* xHi = "xHi";
inline constexpr const char* envAmt = "envAmt";
inline constexpr const char* envSpeed = "envSpeed";
inline constexpr const char* lfoShape = "lfoShape";
inline constexpr const char* lfoSync = "lfoSync";
inline constexpr const char* lfoRate = "lfoRate";
inline constexpr const char* lfoNote = "lfoNote";
inline constexpr const char* lfoAmt = "lfoAmt";
inline constexpr const char* lfoTarget = "lfoTarget";
inline constexpr const char* preMode = "preMode";
inline constexpr const char* preFreq = "preFreq";
inline constexpr const char* preReso = "preReso";
inline constexpr const char* postMode = "postMode";
inline constexpr const char* postFreq = "postFreq";
inline constexpr const char* postReso = "postReso";
inline constexpr const char* box = "box";
inline constexpr const char* boxSize = "boxSize";
inline constexpr const char* boxMix = "boxMix";
/** Les reglages d'une bande (b : 0..2) : "b1Style", "b2Drive"... */
std::string band(int b, const char* what);
} // namespace pid

class MMRageProcessor final : public juce::AudioProcessor {
public:
    // La fenetre : un plan de 1000 x 620 (celui de MM-HELL) mis a l'echelle (80 % a 200 %), 120 % a l'ouverture
    static constexpr int kCanvasW = 1000;
    static constexpr int kCanvasH = 620;
    static constexpr int kEditorDefaultW = 1200;
    static constexpr int kEditorMinW = 800;
    static constexpr int kEditorMaxW = 2000;
    static constexpr int kPages = 4; // RAGE, SHAPE, BANDS, MOVE

    /**
     * Un reglage : son parametre (id, nom pour l'hote, genre), sa lecture et son ecriture dans un RagePatch. La table
     * (fields) fait le lien parametres <-> patch, dans l'ordre montre a l'hote.
     */
    struct Field {
        enum Kind { Unit, Bool, Choice };
        std::string id, name;
        Kind kind = Unit;
        juce::StringArray choices;
        std::function<double(const mmrage::RagePatch&)> get;
        std::function<void(mmrage::RagePatch&, double)> set;
        std::function<std::string(double)> text; // Unit
    };
    static const std::vector<Field>& fields();

    MMRageProcessor();
    ~MMRageProcessor() override = default;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    void reset() override;
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MM-RAGE"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 1.0; }

    // Les programmes : la banque d'usine (un programme regle toute la DISTO, DRIVE et MIX compris)
    int getNumPrograms() override;
    int getCurrentProgram() override { return program_.load(); }
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState apvts;

    /** Les reglages du moment (lus dans les parametres, n'importe quel thread). */
    mmrage::RagePatch patch() const;
    /** Charge un preset d'usine (thread du message) : toute la DISTO. */
    void loadPreset(int index);
    /** Pose un patch entier (thread du message), en gestes de l'hote. */
    void applyPatch(const mmrage::RagePatch& p);
    /** ATTITUDE : le niveau qui entre dans la saturation, en dB (0 : la courbe commence a mordre). */
    float attitudeDb() const { return attitude_.load(std::memory_order_relaxed); }
    double bpm() const { return bpm_.load(std::memory_order_relaxed); }
    int editorWidth() const { return editorW_.load(); }
    void setEditorWidth(int w) { editorW_.store(juce::jlimit(kEditorMinW, kEditorMaxW, w)); }
    int page() const { return page_.load(); }
    void setPage(int p) { page_.store(juce::jlimit(0, kPages - 1, p)); }

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout layout(MMRageProcessor* self);

    std::vector<std::atomic<float>*> raw_; // dans l'ordre de fields()
    std::atomic<float>* rawPunish_ = nullptr;
    mmarp::Decap decap_;
    std::atomic<float> attitude_{-120.f};
    std::atomic<double> bpm_{120.0};
    std::atomic<int> editorW_{kEditorDefaultW};
    std::atomic<int> program_{0};
    std::atomic<int> page_{0};

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMRageProcessor)
};
