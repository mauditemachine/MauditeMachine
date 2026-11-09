// MM-RYTM : la pattern qui joue en clip MIDI (2026-11-09, Mika : "un bouton pour tout transferer directement la pattern
// qui joue dans un clip MIDI, avec les bonnes velocites, comme un Drum Rack").
//
// exportPattern rejoue les trigs du programme comme le moteur (Engine::evalStep) : la velocite de chaque coup, le swing,
// uTIME, LEN, le retrig (RATE, VFAD, RLEN), TLEN, les conditions et PROB (une realisation, comme un enregistrement), le
// mute ; les lock trigs ne font pas de note. Le clip dure un cycle entier (TLEN et A:B compris), en mesures de 4/4.
// writeSmf en fait un fichier MIDI standard (format 0, 960 ticks par noire).
// Sans JUCE : teste sur Linux (tests/engine_test.cpp).
#pragma once

#include "Program.h"

#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace mm {

// La note de chaque piste, facon Drum Rack : les 16 pads d'Ableton (C1 36 a D#2 51), chacun une fois ; les huit premieres
// pistes sur leurs notes GM (BD 36, SD 38, CH 42, OH 46, CP 39, TOM 45, HT 50, CY 49), les huit autres sur les pads restants
// (BD2 37, SD2 40, CH2 44, OH2 47, CP2 43, TOM2 41, HT2 48, CY2 51).
constexpr std::array<int, kProgTracks> kTrackNote = {36, 38, 42, 46, 39, 45, 50, 49, 37, 40, 44, 47, 43, 41, 48, 51};

// La piste d'une note MIDI d'entree (-1 : ignoree) : la table de kTrackNote, plus quelques alias GM (35, 52, 55, 57).
int trackOfMidiNote(int note);

constexpr int kExportPpq = 960;
constexpr int kTicksPerStep = kExportPpq / 4;

struct ExportNote {
    long tick = 0;
    long len = 0;
    int note = 36;
    int vel = 100; // 1 a 127
    int track = 0;
};

struct ExportResult {
    std::vector<ExportNote> notes; // par tick croissant
    long steps = 16;               // la longueur du clip, en pas (des mesures entieres)
    bool capped = false;           // le cycle depassait maxSteps : coupe
};

// Les notes de la pattern, sur un cycle (au plus maxSteps pas). seed : le tirage de PROB (le meme a chaque export).
ExportResult exportPattern(const Program& p, long maxSteps = 1024, uint32_t seed = 0x2545F491u);

// Le fichier MIDI : le nom de la piste, 4/4, le tempo, les notes (canal 10), la fin au bout du clip.
std::vector<uint8_t> writeSmf(const ExportResult& r, double bpm, const std::string& name);

// Le nom d'un emplacement : A01 a H16.
std::string slotName(int slot);

} // namespace mm
