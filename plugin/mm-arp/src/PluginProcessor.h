// MM-ARP, le processeur (2026-11-09) : le programme de la face (JSON : les reglages du moteur, des effets et les
// notes de l'arpege resolues par le site) joue sur le transport de l'hote (ou l'horloge interne, RUN de la face) ; les
// notes MIDI d'Ableton jouent le synthe directement ; l'etat du projet garde le programme et la face.
#pragma once

#include "Arp.h"
#include "ArpFx.h"
#include "Voyager.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

// Le programme de la face, pret a jouer (construit sur le thread du message, lu par le thread audio)
struct MMArpProgram {
    double bpm = 120;
    std::vector<std::pair<std::string, double>> engine;
    mmarp::ArpFxSettings fx;
    double dly16 = 3; // DLY TIME en doubles croches (le temps se calcule au tempo de l'hote)
    mmarp::ArpProgram arp;
};

class MMArpProcessor final : public juce::AudioProcessor {
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
    void faceNote(int midi, double gateSec, double accent);
    juce::String faceInitState() const;

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

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout makeLayout();
    void applyProgram(const MMArpProgram& p, double bpm, bool now);
    mmarp::ArpFxSettings fxFor(const MMArpProgram& p, double bpm) const;

    // Le moteur et sa chaine (thread audio, recrees par prepareToPlay)
    std::unique_ptr<mmarp::Voyager> voy_;
    mmarp::ArpFx fx_;
    mmarp::Arp arp_;
    double sr_ = 0;
    int64_t frame_ = 0;
    uint32_t seed_ = 0;
    std::vector<float> dryL_, dryR_;
    std::vector<std::pair<std::string, double>> kv_;

    // Le programme : publie par le thread du message, pris par le thread audio au bloc suivant
    juce::SpinLock progLock_;
    std::shared_ptr<const MMArpProgram> pending_;
    std::shared_ptr<const MMArpProgram> retired_;
    std::shared_ptr<const MMArpProgram> current_;
    bool fresh_ = true;
    double lastBpm_ = 0;

    // Les notes jouees par la face (apercus) : vers le thread audio
    struct LiveNote {
        int midi;
        double gate;
        double accent;
    };
    juce::SpinLock liveLock_;
    std::vector<LiveNote> live_;
    std::vector<LiveNote> liveAudio_;

    // Le transport
    std::atomic<bool> runInternal_{false};
    std::atomic<bool> internalPlaying_{false};
    std::atomic<double> progBpm_{120};
    double internalPpq_ = 0;
    bool wasPlaying_ = false;
    int lastLiveMidi_ = -1;
    std::array<bool, 128> held_{};

    // Les parametres de l'hote
    std::atomic<float>* master_ = nullptr;
    std::atomic<float>* arpOn_ = nullptr;

    // Le retour vers la face
    std::atomic<bool> fbPlaying_{false};
    std::atomic<int> fbSeq_{0}, fbSlot_{-1}, fbPos_{0}, fbLen_{0}, fbChord_{-1}, fbMidi_{-1};
    int64_t lastShownFrame_ = -1;

    // L'etat de la face (thread du message)
    mutable std::mutex mx_;
    juce::String programJson_;
    juce::String lsJson_;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MMArpProcessor)
};
