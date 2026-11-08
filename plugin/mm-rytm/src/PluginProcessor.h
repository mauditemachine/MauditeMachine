// MM-RYTM, le processeur : parametres (APVTS), MIDI, transport de l'hote, calcul des sons hors du thread audio.
#pragma once

#include "Engine.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <atomic>

class MMRytmProcessor final : public juce::AudioProcessor {
public:
    MMRytmProcessor();
    ~MMRytmProcessor() override;

    // --- AudioProcessor ---
    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MM-RYTM"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 2.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return "Default"; }
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    // --- pour l'editeur ---
    juce::AudioProcessorValueTreeState apvts;
    mm::Sequencer seq;
    void audition(int track) { audition_.fetch_or(1u << track, std::memory_order_relaxed); }
    int playingStep() const { return seq.currentStep.load(std::memory_order_relaxed); }
    bool isRunning() const { return running_.load(std::memory_order_relaxed); }
    float takePeak(int track) { return engine_.takePeak(track); }
    // Pret a jouer (le premier calcul des sons est fait).
    bool soundsReady() const;

    static juce::String pid(int track, const char* key);

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout makeLayout();
    void setDefaultPattern();
    mm::ShotTweak tweakOf(int track, int& sampleIndex, double& stretch) const;
    juce::String signatureOf(int track) const;
    void renderLoop();

    struct Renderer;
    std::unique_ptr<Renderer> renderer_;

    mm::Engine engine_;
    std::atomic<double> sr_{0};
    std::atomic<uint32_t> audition_{0};
    std::atomic<bool> running_{false};
    double internalPpq_ = 0;
    bool wasPlaying_ = false;

    // Les parametres lus a chaque bloc (pointeurs stables de l'APVTS).
    struct TrackRaw {
        std::atomic<float>* level;
        std::atomic<float>* pan;
        std::atomic<float>* mute;
        std::atomic<float>* out;
    };
    std::array<TrackRaw, mm::kTracks> raw_{};
    std::atomic<float>* master_ = nullptr;
    std::atomic<float>* swing_ = nullptr;
    std::atomic<float>* length_ = nullptr;
    std::atomic<float>* bpm_ = nullptr;
    std::atomic<float>* run_ = nullptr;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMRytmProcessor)
};
