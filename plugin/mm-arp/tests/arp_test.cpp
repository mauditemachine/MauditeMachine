// Les tests de l'arpegiateur du plugin (dsp/Arp.cpp), sans son : les notes et les ancres envoyees au moteur.
#include "Arp.h"

#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

using namespace mmarp;

namespace {

int failures = 0;
void check(bool ok, const std::string& what) {
    std::printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
    if (!ok) ++failures;
}

struct Rec : ArpSink {
    struct N { double t; int midi; double gate; double acc; double from; };
    struct B { double t; double beat; double bpm; bool run; };
    std::vector<N> notes;
    std::vector<B> beats;
    std::vector<double> cancels;
    void note(double t, int m, double g, double a, double f) override { notes.push_back({t, m, g, a, f}); }
    void beat(double t, double b, double bpm, bool run) override { beats.push_back({t, b, bpm, run}); }
    void cancel(double t) override { cancels.push_back(t); }
};

constexpr double SR = 48000;
constexpr double BPM = 120;
const double PPS = BPM / 60.0 / SR; // ppq par echantillon
const double STEP = 0.25 / PPS;     // 6000 echantillons

// Joue de ppq0 pendant n echantillons, par blocs de taille block
Rec play(const ArpProgram& p, double ppq0, int n, int block, uint32_t seed = 1) {
    Rec r;
    Arp a;
    a.prepare(SR);
    a.setProgram(&p);
    int64_t f = 0;
    while (f < n) {
        const int m = std::min<int>(block, static_cast<int>(n - f));
        // la position de l'hote, recalculee a chaque bloc depuis son echantillon (comme Ableton)
        a.process(r, f, m, true, ppq0 + static_cast<double>(f) * PPS, PPS, seed);
        f += m;
    }
    return r;
}

ArpProgram simple() {
    ArpProgram p;
    p.spn = 1;
    p.gate = 0.5;
    p.accent = 0.5;
    p.prog = {0};
    p.chords = {{0, false, {60, 63, 67, 70}}};
    return p;
}

bool near(double a, double b, double eps = 1e-9) { return std::fabs(a - b) <= eps; }

} // namespace

int main() {
    {
        const ArpProgram p = simple();
        const Rec r = play(p, 0, static_cast<int>(STEP * 16), 4096);
        bool ok = r.notes.size() == 16;
        for (size_t i = 0; ok && i < r.notes.size(); ++i) ok = near(r.notes[i].t * SR, i * STEP, 1e-6) && r.notes[i].midi == p.chords[0].midi[i % 4];
        check(ok, "1/16 : une note par pas, la suite dans l'ordre");
        check(near(r.notes[0].gate, 0.5 * STEP / SR), "GATE : la part de l'intervalle");
        check(std::isnan(r.notes[0].from) && r.notes[1].from == 60, "GLIDE : depuis la note precedente");
        check(near(r.notes[0].acc, 1.0) && near(r.notes[1].acc, 0.8) && near(r.notes[3].acc, 1.12), "accents 1, e, et, a");
        bool beats = r.beats.size() == 16 && r.beats[0].run && !r.beats[1].run;
        for (size_t i = 0; beats && i < r.beats.size(); ++i) beats = near(r.beats[i].beat, i / 4.0) && near(r.beats[i].bpm, BPM, 1e-6);
        check(beats, "une ancre par pas (beat = ppq, RUN au premier)");
    }
    {
        // Les blocs ne changent rien
        const ArpProgram p = simple();
        const Rec a = play(p, 0, static_cast<int>(STEP * 40), 4096), b = play(p, 0, static_cast<int>(STEP * 40), 97);
        bool same = a.notes.size() == b.notes.size();
        for (size_t i = 0; same && i < a.notes.size(); ++i) same = near(a.notes[i].t, b.notes[i].t, 1e-9) && a.notes[i].midi == b.notes[i].midi;
        check(same, "taille des blocs sans effet");
    }
    {
        ArpProgram p = simple();
        p.swing = 1.0 / 3;
        const Rec r = play(p, 0, static_cast<int>(STEP * 4), 512);
        check(r.notes.size() == 4 && near(r.notes[1].t * SR, STEP + STEP / 3, 1e-6) && near(r.notes[2].t * SR, 2 * STEP, 1e-6), "SWING sur les impaires");
    }
    {
        ArpProgram p = simple();
        p.spn = 0.5;
        const Rec r = play(p, 0, static_cast<int>(STEP * 2), 512);
        check(r.notes.size() == 4 && near(r.notes[1].t * SR, STEP / 2, 1e-6) && near(r.notes[1].acc, 1 + (0.85 - 1) * 2 * 0.5) && r.notes[2].midi == 67, "1/32 : deux notes par pas");
        p.spn = 4;
        const Rec q = play(p, 0, static_cast<int>(STEP * 16), 512);
        check(q.notes.size() == 4 && near(q.notes[1].t * SR, 4 * STEP, 1e-6) && q.notes[1].midi == 63, "1/4 : une note tous les quatre pas");
    }
    {
        // Deux accords : la suite repart au changement ; le meme accord deux mesures de suite : elle continue
        ArpProgram p;
        p.spn = 1;
        p.prog = {0, 0, 1};
        p.chords = {{0, false, {60, 62, 64}}, {1, false, {50, 52}}};
        const Rec r = play(p, 0, static_cast<int>(STEP * 48), 1000);
        check(r.notes.size() == 48 && r.notes[16].midi == p.chords[0].midi[16 % 3] && r.notes[32].midi == 50 && r.notes[33].midi == 52, "la suite repart quand l'accord change, continue sinon");
        // Une lecture lancee ailleurs donne les memes notes au meme endroit
        const Rec j = play(p, 4.0 * 1 + 2.0, static_cast<int>(STEP * 8), 333);
        bool same = !j.notes.empty();
        for (size_t i = 0; same && i < j.notes.size(); ++i) same = j.notes[i].midi == r.notes[24 + i].midi;
        check(same, "lancee en mesure 2 (temps 3) : les memes notes que de bout en bout");
        // La quatrieme mesure revient au premier accord
        const Rec w = play(p, 12.0, static_cast<int>(STEP * 2), 512);
        check(!w.notes.empty() && w.notes[0].midi == 60, "la progression boucle");
    }
    {
        // Silence de la suite
        ArpProgram p;
        p.spn = 1;
        p.prog = {0};
        p.chords = {{0, false, {60, kRest, 64}}};
        const Rec r = play(p, 0, static_cast<int>(STEP * 3), 512);
        check(r.notes.size() == 2 && r.notes[1].midi == 64 && r.notes[1].from == 60, "un silence ne joue rien, GLIDE depuis la derniere note");
    }
    {
        // RAND : le meme a chaque lecture, jamais deux fois la meme note de suite
        ArpProgram p;
        p.spn = 1;
        p.drift = 1;
        p.prog = {0};
        p.chords = {{0, true, {60, 64, 67}}};
        const Rec a = play(p, 0, static_cast<int>(STEP * 64), 700, 42), b = play(p, 0, static_cast<int>(STEP * 64), 128, 42);
        bool same = a.notes.size() == 64 && b.notes.size() == 64, rep = false, varied = false;
        for (size_t i = 0; i < a.notes.size() && same; ++i) {
            same = a.notes[i].midi == b.notes[i].midi && near(a.notes[i].acc, b.notes[i].acc);
            if (i > 0 && a.notes[i].midi == a.notes[i - 1].midi) rep = true;
            if (i > 0 && a.notes[i].midi != a.notes[0].midi) varied = true;
        }
        check(same && !rep && varied, "RAND : reproductible, sans repetition");
        bool human = false;
        for (size_t i = 0; i < a.notes.size(); ++i) human |= !near(a.notes[i].acc, simple().accent == 0.5 ? (i % 4 == 0 ? 1.0 : i % 4 == 1 ? 0.8 : i % 4 == 2 ? 0.92 : 1.12) : 0);
        check(human, "DRIFT : la force des notes varie");
    }
    {
        // Un saut de l'hote (une boucle) : les notes attendues sont annulees, la lecture repart
        const ArpProgram p = simple();
        Rec r;
        Arp a;
        a.prepare(SR);
        a.setProgram(&p);
        a.process(r, 0, 3000, true, 0, PPS, 1);
        a.process(r, 3000, 3000, true, 8.0, PPS, 1);
        check(r.cancels.size() == 1 && near(r.cancels[0], 3000 / SR) && r.beats.back().run, "saut : annulation et nouveau depart");
        const ArpShown sh = a.shownAt(6000);
        check(sh.chord == 0 && sh.len == 4 && sh.slot == 0, "la note montree a la face");
    }
    {
        // Sans progression : les ancres seulement
        ArpProgram p;
        const Rec r = play(p, 0, static_cast<int>(STEP * 4), 512);
        check(r.notes.empty() && r.beats.size() == 4, "sans accord : rien ne joue, le LFO garde ses ancres");
    }
    std::printf(failures ? "%d echec(s)\n" : "tout passe\n", failures);
    return failures ? 1 : 0;
}
