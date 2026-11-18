// MM-HELL, le processeur : le HELL du MM-ARP (dsp/Hell.cpp, au bit pres) en effet audio stereo seul. 22 parametres pour
// l'hote (automation, MIDI Map d'Ableton), les 24 presets d'usine en programmes, le tempo de l'hote (SYNC), la derniere
// note MIDI recue (RANGE MIDI : route une piste MIDI vers le plugin). MIX 0 : le signal passe au bit pres.
#pragma once

#include "HellPatch.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>
#include <limits>

namespace pid {
inline constexpr const char* mix = "mix";
inline constexpr const char* sync = "sync";
inline constexpr const char* note = "note";
inline constexpr const char* time = "time";
inline constexpr const char* feedback = "feedback";
inline constexpr const char* cross = "cross";
inline constexpr const char* range = "range";
inline constexpr const char* shift = "shift";
inline constexpr const char* sideband = "sideband";
inline constexpr const char* spread = "spread";
inline constexpr const char* phase = "phase";
inline constexpr const char* antiRefl = "antiRefl";
inline constexpr const char* smear = "smear";
inline constexpr const char* hp = "hp";
inline constexpr const char* lp = "lp";
inline constexpr const char* lfoShape = "lfoShape";
inline constexpr const char* lfoSync = "lfoSync";
inline constexpr const char* lfoRate = "lfoRate";
inline constexpr const char* lfoNote = "lfoNote";
inline constexpr const char* lfoAmt = "lfoAmt";
inline constexpr const char* lfoStereo = "lfoStereo";
inline constexpr const char* lfoTarget = "lfoTarget";
} // namespace pid

class MMHellProcessor final : public juce::AudioProcessor {
public:
    // La fenetre : un plan de 1000 x 620 mis a l'echelle (80 % a 200 %), 120 % a l'ouverture ; la taille est gardee
    static constexpr int kCanvasW = 1000;
    static constexpr int kCanvasH = 620;
    static constexpr int kEditorDefaultW = 1200;
    static constexpr int kEditorMinW = 800;
    static constexpr int kEditorMaxW = 2000;
    static constexpr float kDefaultMix = 0.35f;

    MMHellProcessor();
    ~MMHellProcessor() override = default;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    void reset() override;
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MM-HELL"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 10.0; }

    // Les programmes : la banque d'usine (un programme regle tout sauf MIX)
    int getNumPrograms() override;
    int getCurrentProgram() override { return program_.load(); }
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState apvts;

    /** Les reglages du moment (lus dans les parametres, n'importe quel thread). */
    mmhell::HellPatch patch() const;
    float mix() const { return raw_.mix->load(); }
    /** Charge un preset d'usine (thread du message) : tout sauf MIX ; MIX a 35 % s'il etait a 0. */
    void loadPreset(int index);
    /** Le LFO (-1..1) pour le VU, NaN quand HELL est coupe. */
    float lfo() const { return lfo_.load(std::memory_order_relaxed); }
    double bpm() const { return bpm_.load(std::memory_order_relaxed); }
    double noteHz() const { return noteHz_.load(std::memory_order_relaxed); }
    int editorWidth() const { return editorW_.load(); }
    void setEditorWidth(int w) { editorW_.store(juce::jlimit(kEditorMinW, kEditorMaxW, w)); }

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout layout(MMHellProcessor* self);

    struct Raw {
        std::atomic<float>*mix = nullptr, *sync = nullptr, *note = nullptr, *time = nullptr, *feedback = nullptr, *cross = nullptr, *range = nullptr,
        *shift = nullptr, *sideband = nullptr, *spread = nullptr, *phase = nullptr, *antiRefl = nullptr, *smear = nullptr, *hp = nullptr, *lp = nullptr,
        *lfoShape = nullptr, *lfoSync = nullptr, *lfoRate = nullptr, *lfoNote = nullptr, *lfoAmt = nullptr, *lfoStereo = nullptr, *lfoTarget = nullptr;
    } raw_;

    mmarp::Hell hell_;
    std::atomic<float> lfo_{std::numeric_limits<float>::quiet_NaN()};
    std::atomic<double> bpm_{120.0};
    std::atomic<double> noteHz_{0.0};
    std::atomic<int> editorW_{kEditorDefaultW};
    std::atomic<int> program_{0};

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMHellProcessor)
};
