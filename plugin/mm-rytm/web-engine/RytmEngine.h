// MM-RYTM, le moteur du navigateur (2026-11-25) : le processeur du VST3 (src/PluginProcessor.cpp) sans JUCE, pour le
// compiler en WebAssembly et le jouer dans un AudioWorklet, pilote par la face du plugin (src/v4/plugin). Il doit sonner
// EXACTEMENT comme le VST3 : la logique du processeur est recopiee telle quelle, le DSP est celui de mm_dsp (dsp/*).
//
// Ce que chaque partie recopie (src/PluginProcessor.cpp, a garder en phase quand le VST3 change) :
//   trackOfNote, dbToGain        cpp 11-25
//   num, flag                    cpp 27-35 (sur Var, le juce::var de JSON::parse, plus bas)
//   parseSound                   cpp 38-69
//   parseHit                     cpp 71-131
//   parseFx                      cpp 134-161
//   parseProgram                 cpp 163-200
//   renderSound, soundFor        cpp 218-234 (le calcul du son, puis le cache)
//   buildState                   cpp 236-256
//   renderLoop                   cpp 258-307 (un passage du fil du calcul, Renderer 206-216)
//   faceProgram                  cpp 330-340
//   faceHit                      cpp 352-378
//   faceRun, faceFill, feedback  cpp 380-384 (et PluginProcessor.h 48-59)
//   prepare                      cpp 418-424 (prepareToPlay)
//   process                      cpp 426-471 (processBlock)
//   Bank                         src/SampleBank.cpp 1-48 (les samples : le nom du fichier dit sa famille, byKey)
//
// Ce qui remplace JUCE (le son n'en depend pas) :
//   - juce::JSON::parse et juce::var : Var et parseJson (recopies de juce_JSON.cpp : entiers int / int64, nombres a
//     virgule par strtod apres la troncature a 18 chiffres de readDoubleValue, chaines, objets, tableaux) ;
//   - le fil du calcul (Renderer, wake.wait(100)) : renderLoop(now), un passage, appele par le JS apres chaque message
//     qui reveille le fil et toutes les ~100 ms ; mode asynchrone (setAsync) : les sons et la reponse de la reverb
//     (des fonctions pures : mm::renderLayers, mm::ReverbIR::make) se calculent ailleurs, dans un Worker du site avec
//     une autre instance du meme module (jobs plus bas), et le passage attend qu'ils soient tous la ;
//   - les mutex et atomiques du processeur : un seul fil (le worklet), des valeurs simples ;
//   - le parametre master de l'APVTS : master_ (dB, la valeur brute float) ;
//   - getPlayHead : aucun dans le navigateur (le tempo du programme, RUN sur l'horloge interne) ; setHostPosition en
//     donne un pour le bloc suivant seulement (les bancs) ;
//   - le MidiBuffer : une file d'evenements (midi), triee par position comme MidiBuffer, vide a chaque process ;
//   - ScopedNoDenormals : le meme registre en natif (SSE : FTZ + DAZ ; arm64 : FZ) ; rien en wasm (pas de mode) ;
//   - getStateInformation / setStateInformation : non repris (la page garde l'etat de la face dans son localStorage).
#pragma once

#include "Engine.h"

#include <array>
#include <cstdint>
#include <map>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace mmrytmweb {

// juce::var tel que juce::JSON::parse le donne : ce que le processeur en lit
struct Var {
    enum Type { Void, Bool, Int, Int64, Double, String, Array, Object };
    Type type = Void;
    bool b = false;
    int64_t i = 0;
    double d = 0;
    std::string s;
    std::vector<Var> a;
    std::vector<std::pair<std::string, Var>> o; // NamedValueSet : l'ordre d'arrivee, un nom repete remplace sa valeur

    bool isBool() const { return type == Bool; }
    bool isInt() const { return type == Int; }
    bool isInt64() const { return type == Int64; }
    bool isDouble() const { return type == Double; }
    bool isString() const { return type == String; }
    bool isObject() const { return type == Object; }
    const std::vector<Var>* getArray() const { return type == Array ? &a : nullptr; }
    // getProperty(k, var()) : la valeur, ou nul hors d'un objet ou sans la propriete
    const Var* get(const char* k) const;
    double toDouble() const;      // static_cast<double>(var)
    bool toBool() const;          // static_cast<bool>(var)
    std::string toString() const; // var::toString (les chaines comparees : jamais un nombre a virgule)
};

// juce::JSON::parse (String) : un objet ou un tableau ; une erreur de syntaxe rend faux (var() pour JUCE)
bool parseJson(const char* text, size_t n, Var& out);

// La banque des samples (SampleBank.cpp) : des fichiers WAV donnes un a un (le VST3 : BinaryData ; le navigateur : le
// Worker les telecharge de public/samples/rytm), decodes par mm::decodeWav. Commune a toutes les instances, comme
// SampleBank::get().
struct BankSample {
    std::string name; // "Bd 1"
    std::string file; // "Bd 1.wav"
    mm::SamplePcm pcm;
};
class Bank {
public:
    static Bank& get();
    // Un fichier : sa famille par son nom ("Bd 1.wav" -> bd) ; faux si ce n'est pas un .wav d'une famille, ou s'il ne se
    // decode pas. Les noms sont uniques : l'ordre d'arrivee ne change rien a byKey (le VST3 trie par nom naturel).
    bool add(const std::string& file, const void* data, size_t size);
    // Un sample par sa cle du site ("bd/Bd 1.wav") ; nul s'il n'est pas dans la banque (un sample perso du navigateur).
    const BankSample* byKey(const std::string& key) const;
    int count() const;
    void clear();
    static const char* const kFamilies[8];

private:
    std::array<std::vector<BankSample>, 8> byTrack_;
};

// Le son du processeur (soundFor sans le cache) : ses variantes a la frequence sr / pf, la couche SAMPLE de la banque.
std::shared_ptr<mm::RenderedSound> renderSound(const mm::ProgSound& s, double sr);
// La cle de la reponse de la reverb (buildState : juce::String(sec, 6) | (hi, 3) | (pre, 6) | String(sr))
std::string reverbKeyOf(double sec, double hi, double pre, double sr);

// Un son a calculer, en nombres (le message vers le Worker) : kDescN doubles, puis la cle du sample a part
constexpr int kDescN = 23;
void soundToDesc(const mm::ProgSound& s, double sr, double* d);
void descToSound(const double* d, mm::ProgSound& s, double& sr);

class RytmEngine {
public:
    RytmEngine();

    // --- la face (le fil du message) ---
    bool faceProgram(const char* json, size_t n);
    void faceHit(const char* json, size_t n);
    void faceRun(bool on) { runInternal_ = on; }
    void faceFill(bool on) { engine_.setFill(on); }

    // --- le fil du calcul : un passage (now : secondes, pour liberer les etats retires) ---
    void renderLoop(double now);
    // Le passage a-t-il du travail en attente (un programme, des coups en direct) ?
    bool pending() const { return pendingProgram_ != nullptr || !pendingLive_.empty(); }

    // --- l'audio ---
    void prepare(double sampleRate);
    void process(float* L, float* R, int n);
    void midi(int offset, int status, int d1, int d2);
    void setHostPosition(bool playing, double ppq, double bpm);
    void setMasterDb(float db) { master_ = db; }
    float masterDb() const { return master_; }

    // --- retour vers la face (Feedback de PluginProcessor.h) ---
    struct Feedback {
        bool playing;
        bool internal;
        int step;
        int seq;
        int mask;
    };
    Feedback feedback() const;

    // --- le mode asynchrone : les calculs lourds dans un Worker ---
    struct Job {
        int id = 0;
        bool reverb = false;
        bool sent = false;
        std::string key;
        double sr = 0;
        mm::ProgSound sound;
        double sec = 0, hi = 0, pre = 0;
    };
    void setAsync(bool on) { async_ = on; }
    bool async() const { return async_; }
    // Le prochain calcul a envoyer (marque envoye), ou nul
    const Job* takeJob();
    const Job* job(int id) const;
    // Un son calcule (ses variantes) ou une reponse de reverb, pour le passage qui l'attend
    bool deliverSound(int id, std::vector<mm::Shot>&& variants);
    bool deliverReverb(int id, std::shared_ptr<mm::ReverbIR> ir);
    // Le Worker n'a pas pu : le calcul se fait ici
    void failJob(int id);

    // --- ce que les essais lisent ---
    struct Stats {
        int programs = 0;   // programmes acceptes (faceProgram)
        int published = 0;  // etats publies (engine_.publish)
        int liveNow = 0;    // coups en direct partis tout de suite (le son deja calcule)
        int liveLater = 0;  // coups en direct partis apres leur calcul
        int rendered = 0;   // sons calcules ici (mode synchrone, ou un echec du Worker)
        int delivered = 0;  // sons et reponses livres par le Worker
        int jobs = 0;       // calculs demandes
        int notes = 0;      // notes MIDI prises
    };
    Stats stats;
    std::shared_ptr<mm::PlayState> latest() const { return engine_.latest(); }

private:
    std::shared_ptr<mm::PlayState> buildState(const mm::Program& p, double sr);
    std::shared_ptr<mm::RenderedSound> soundFor(const mm::ProgSound& s, double sr);
    // Mode asynchrone : tout ce que le prochain passage calculerait est-il la ? (sinon les calculs sont demandes)
    bool ready(double sr);
    bool haveSound(const mm::ProgSound& s, double sr, bool srChange);
    int request(Job j);

    mm::Engine engine_;
    double sr_ = 0;
    bool runInternal_ = false;
    bool internalPlaying_ = false;
    double progBpm_ = 130;
    double internalPpq_ = 0;
    float master_ = 0.f;

    // Le programme de la face (le fil du message) ; le calcul lit pending (programJson_ et lsJson_ du VST3 ne servent qu'a
    // l'etat du projet, non repris)
    std::unique_ptr<mm::Program> pendingProgram_;
    std::vector<std::pair<mm::ProgSound, mm::LiveHit>> pendingLive_;

    // Le cache des sons calcules (le fil du calcul)
    std::map<std::string, std::shared_ptr<mm::RenderedSound>> cache_;
    std::vector<std::pair<std::string, std::shared_ptr<mm::RenderedSound>>> extras_;
    std::shared_ptr<mm::ReverbIR> reverbIR_;
    std::string reverbKey_;
    mm::Program current_;
    bool haveProgram_ = false;
    double builtSr_ = 0;

    // Le MidiBuffer du prochain bloc, la tete de lecture d'un hote (le prochain bloc seulement)
    struct MidiEv {
        int pos, s, d1, d2;
    };
    std::vector<MidiEv> midi_;
    struct HostPos {
        bool has = false, playing = false;
        double ppq = 0, bpm = 120;
    } host_;

    // Le mode asynchrone : les calculs demandes (par id), ceux livres (par cle)
    bool async_ = false;
    int nextJob_ = 1;
    std::map<int, Job> jobs_;
    std::map<std::string, std::shared_ptr<mm::RenderedSound>> deliveredSounds_;
    std::map<std::string, std::shared_ptr<mm::ReverbIR>> deliveredIR_;
};

} // namespace mmrytmweb

// --- l'API C (celle du wasm) : toutes les fonctions prennent le moteur en premier argument, sauf la banque et le
// calcul du Worker. Un seul fil par instance. ---
extern "C" {
typedef struct MMRytmEngine MMRytmEngine;

MMRytmEngine* mmrytm_create(void);
void mmrytm_destroy(MMRytmEngine* e);
void mmrytm_prepare(MMRytmEngine* e, double sampleRate, int maxBlock);
void mmrytm_process(MMRytmEngine* e, float* L, float* R, int n);
// un passage du fil du calcul ; rend 1 s'il reste du travail en attente (un calcul du Worker)
int mmrytm_idle(MMRytmEngine* e, double nowSeconds);
int mmrytm_pending(MMRytmEngine* e);
// mm_program {program} : le texte JSON (UTF-8) ; rend 1 si le programme est pris
int mmrytm_program(MMRytmEngine* e, const char* json, int len);
// mm_hit : l'objet du message en JSON (UTF-8)
void mmrytm_hit(MMRytmEngine* e, const char* json, int len);
void mmrytm_run(MMRytmEngine* e, int on);
void mmrytm_fill(MMRytmEngine* e, int on);
void mmrytm_midi(MMRytmEngine* e, int offset, int status, int d1, int d2);
void mmrytm_set_host_position(MMRytmEngine* e, int playing, double ppq, double bpm);
void mmrytm_set_master_db(MMRytmEngine* e, double db);
// playing, internal, step (-1 a l'arret, comme l'editeur l'envoie), seq, mask
const int32_t* mmrytm_feedback(MMRytmEngine* e);
// 16 entiers : les compteurs (Stats : programs, published, liveNow, liveLater, rendered, delivered, jobs, notes), puis le
// dernier etat publie : bpm x 1000, len, loop, sons, coups, pistes jouees, reverb x 1000, swing x 1000
const int32_t* mmrytm_stats(MMRytmEngine* e);
int mmrytm_stats_size(void);

// le mode asynchrone (le Worker)
void mmrytm_set_async(MMRytmEngine* e, int on);
// le prochain calcul a envoyer : son id (0 : aucun) ; sa description : kDescN doubles (un son : voir soundToDesc ; une
// reverb : [-1, sr, sec, hi, pre]), et la cle du sample d'un son (texte, "" sans sample)
int mmrytm_job_take(MMRytmEngine* e);
const double* mmrytm_job_desc(MMRytmEngine* e, int id);
const char* mmrytm_job_sample(MMRytmEngine* e, int id);
int mmrytm_job_desc_size(void);
// la livraison d'un son : begin (le nombre de variantes), une variante (R nul : mono), end ; rend 0 si le calcul n'est
// plus attendu
void mmrytm_job_sound_begin(MMRytmEngine* e, int id, int variants);
void mmrytm_job_sound_variant(MMRytmEngine* e, int id, const float* L, const float* R, int n);
int mmrytm_job_sound_end(MMRytmEngine* e, int id);
// la livraison d'une reponse de reverb : parts x (N/2+1) complexes (re, im) par canal
int mmrytm_job_reverb(MMRytmEngine* e, int id, int parts, const float* H0, const float* H1);
void mmrytm_job_fail(MMRytmEngine* e, int id);

// la banque des samples (commune a l'instance du module)
int mmrytm_bank_add(const char* file, int fileLen, const void* data, int size);
int mmrytm_bank_count(void);
int mmrytm_bank_has(const char* key, int keyLen);

// le calcul du Worker : un son d'apres sa description (le meme code que soundFor) ; ses variantes
void* mmrytm_render_sound(const double* desc, const char* sample, int sampleLen);
int mmrytm_rendered_count(void* r);
int mmrytm_rendered_len(void* r, int v);
int mmrytm_rendered_mono(void* r, int v);
const float* mmrytm_rendered_L(void* r, int v);
const float* mmrytm_rendered_R(void* r, int v);
void mmrytm_rendered_free(void* r);
// la reponse de la reverb (ReverbIR::make) : ses blocs, ses spectres par canal
void* mmrytm_render_reverb(double sec, double hi, double pre, double sr);
int mmrytm_reverb_parts(void* ir);
const float* mmrytm_reverb_H(void* ir, int ch);
void mmrytm_reverb_free(void* ir);

void* mmrytm_alloc(int bytes);
void mmrytm_free(void* p);
}
