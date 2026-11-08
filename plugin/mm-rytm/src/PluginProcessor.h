// MM-RYTM, le processeur : le programme de la face (JSON) devient un etat de lecture (sons calcules hors du thread
// audio), le transport de l'hote (ou l'horloge interne, RUN de la face), les notes MIDI, l'etat du projet.
#pragma once

#include "Engine.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>
#include <map>
#include <mutex>

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

    // --- la face (thread du message) ---
    void faceProgram(const juce::String& json);
    void faceState(const juce::String& lsJson);
    void faceHit(const juce::var& hit);
    void faceRun(bool on);
    void faceFill(bool on) { engine_.setFill(on); }
    // Le crossfader de la face : le parametre XFADE (Ableton l'enregistre en automation)
    void faceXf(float x);
    // L'etat a rendre a la face a son ouverture (les cles mm.v4.* du site), "" sans etat.
    juce::String faceInitState() const;

    struct Feedback {
        bool playing;
        bool internal;
        int step;
        int seq;
        int mask;
        double xf; // le crossfader (XFADE)
    };
    Feedback feedback() const;

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout makeLayout();
    void renderLoop();
    std::shared_ptr<mm::PlayState> buildState(const mm::Program& p, double sr);
    std::shared_ptr<mm::RenderedSound> soundFor(const mm::ProgSound& s, double sr);

    struct Renderer;
    std::unique_ptr<Renderer> renderer_;

    mm::Engine engine_;
    std::atomic<double> sr_{0};
    std::atomic<bool> runInternal_{false};
    std::atomic<bool> internalPlaying_{false};
    std::atomic<double> progBpm_{130};
    double internalPpq_ = 0;
    std::atomic<float>* master_ = nullptr;
    std::atomic<float>* xfade_ = nullptr;

    // Le programme et l'etat de la face (thread du message ; le calcul lit pending sous mutex)
    mutable std::mutex mx_;
    juce::String programJson_;
    juce::String lsJson_;
    std::unique_ptr<mm::Program> pendingProgram_;
    std::vector<std::pair<mm::ProgSound, mm::LiveHit>> pendingLive_;
    std::mutex pushMx_;

    // Le cache des sons calcules (thread du calcul)
    std::map<std::string, std::shared_ptr<mm::RenderedSound>> cache_;
    std::vector<std::pair<std::string, std::shared_ptr<mm::RenderedSound>>> extras_;
    // La reponse de la REVERB (sa forme : rsize, rtone, rpre, la frequence) : recalculee seulement quand elle change
    // Les reponses de la REVERB par forme (rsize, rtone, rpre ; une par position du crossfader au plus)
    std::map<std::string, std::shared_ptr<mm::ReverbIR>> irCache_;
    mm::Program current_;
    bool haveProgram_ = false;
    double builtSr_ = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMRytmProcessor)
};
