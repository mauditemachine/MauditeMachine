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
void check(bool ok, const char* fmt, double a, double b = 0) {
    char buf[256];
    std::snprintf(buf, sizeof buf, fmt, a, b);
    check(ok, std::string(buf));
}
void check(bool ok, const char* fmt, int a) {
    char buf[256];
    std::snprintf(buf, sizeof buf, fmt, a);
    check(ok, std::string(buf));
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

// Avec le glissement propre de chaque note (le sequenceur par pas)
struct Rec2 : ArpSink {
    struct N { double t; int midi; double gate; double acc; double from; double glide; };
    std::vector<N> notes;
    void note(double, int, double, double, double) override {}
    void noteGlide(double t, int m, double g, double a, double f, double gl) override { notes.push_back({t, m, g, a, f, gl}); }
    void beat(double, double, double, bool) override {}
    void cancel(double) override {}
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

Rec2 play2(const ArpProgram& p, double ppq0, int n, int block, uint32_t seed = 1) {
    Rec2 r;
    Arp a;
    a.prepare(SR);
    a.setProgram(&p);
    int64_t f = 0;
    while (f < n) {
        const int m = std::min<int>(block, static_cast<int>(n - f));
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
    /* ---------------- le sequenceur par pas (2026-11-11) ---------------- */
    const double STEP_S = STEP / SR;
    {
        // Les defauts : les notes d'avant, exactement (memes heures, portes, accents, origines ; aucun glissement)
        ArpProgram p;
        p.spn = 1;
        p.drift = 1;
        p.swing = 0.2;
        p.prog = {0, 1};
        p.chords = {{0, false, {60, 63, kRest, 67, 70}}, {1, true, {50, 53, 57}}};
        const Rec a = play(p, 0, static_cast<int>(STEP * 64), 512, 7);
        const Rec2 b = play2(p, 0, static_cast<int>(STEP * 64), 512, 7);
        bool same = a.notes.size() == b.notes.size() && !a.notes.empty(), glide = false;
        for (size_t i = 0; same && i < a.notes.size(); ++i) {
            const auto& x = a.notes[i];
            const auto& y = b.notes[i];
            same = x.t == y.t && x.midi == y.midi && x.gate == y.gate && x.acc == y.acc && ((std::isnan(x.from) && std::isnan(y.from)) || x.from == y.from);
            glide |= y.glide != 0;
        }
        check(same && !glide, "pistes aux defauts : noteGlide recoit les notes d'avant, glissement 0 (le GLIDE du patch)");
        // ... et ArpSink::note seule (un pont d'avant) les recoit toutes, pistes engagees comprises
        ArpProgram q = p;
        q.stepSlide[1] = 1;
        q.stepRat[3] = 3;
        const Rec c = play(q, 0, static_cast<int>(STEP * 64), 512, 7);
        const Rec2 d = play2(q, 0, static_cast<int>(STEP * 64), 512, 7);
        check(c.notes.size() == d.notes.size() && c.notes.size() > a.notes.size(), "sans surcharge de noteGlide : note() recoit tout");
    }
    {
        // ACC : 0 doux x0.7, 2 appuye x1.35, borne a 0.3..2 ; indexe par la position dans la suite
        ArpProgram p = simple();
        p.stepAcc[0] = 2;
        p.stepAcc[1] = 0;
        const Rec2 r = play2(p, 0, static_cast<int>(STEP * 8), 512);
        check(r.notes.size() == 8 && near(r.notes[0].acc, 1.35) && near(r.notes[1].acc, 0.8 * 0.7) && near(r.notes[2].acc, 0.92) && near(r.notes[4].acc, 1.35) && near(r.notes[5].acc, 0.56),
              "ACC : appuye x1.35, doux x0.7, par position de la suite");
        p.accent = 1;
        p.stepAcc[3] = 2;
        p.stepAcc[1] = 0;
        const Rec2 q = play2(p, 0, static_cast<int>(STEP * 4), 512);
        // la position 3 : 1 + 0.12 x 2 = 1.24, x1.35 = 1.674 ; la position 1 : 1 - 0.2 x 2 = 0.6, x0.7 = 0.42
        check(near(q.notes[3].acc, 1.24 * 1.35) && near(q.notes[1].acc, 0.42), "ACC : multiplie l'accent du site");
        p.accent = 4;
        const Rec2 w = play2(p, 0, static_cast<int>(STEP * 4), 512);
        check(near(w.notes[3].acc, 2.0) && near(w.notes[1].acc, 0.3), "ACC : borne a 0.3..2");
    }
    {
        // SLIDE : la note glisse depuis la precedente (60 ms), qui est tenue jusqu'a elle
        ArpProgram p = simple();
        p.stepSlide[2] = 1;
        const Rec2 r = play2(p, 0, static_cast<int>(STEP * 8), 512);
        bool ok = r.notes.size() == 8;
        ok = ok && near(r.notes[2].glide, kSlideSec) && r.notes[2].from == 63 && r.notes[0].glide == 0 && r.notes[1].glide == 0 && r.notes[3].glide == 0;
        ok = ok && near(r.notes[1].gate, STEP_S) && near(r.notes[0].gate, 0.5 * STEP_S) && near(r.notes[2].gate, 0.5 * STEP_S) && near(r.notes[6].glide, kSlideSec) && near(r.notes[5].gate, STEP_S);
        check(ok, "SLIDE : glissement de 60 ms depuis la precedente, tenue jusqu'a elle (legato)");
        // la premiere note d'une lecture ne glisse de nulle part ; apres un silence : depuis la derniere note, sans tenue
        ArpProgram q;
        q.spn = 1;
        q.prog = {0};
        q.chords = {{0, false, {60, kRest, 64}}};
        q.stepSlide[0] = q.stepSlide[2] = 1;
        const Rec2 s = play2(q, 0, static_cast<int>(STEP * 3), 512);
        check(s.notes.size() == 2 && s.notes[0].glide == 0 && std::isnan(s.notes[0].from) && near(s.notes[1].glide, kSlideSec) && s.notes[1].from == 60 && near(s.notes[0].gate, 0.5 * STEP_S),
              "SLIDE : rien a la premiere note ; apres un silence, depuis la derniere note");
        // avec du swing : la tenue va jusqu'a l'heure reelle de la note suivante
        ArpProgram w = simple();
        w.swing = 0.25;
        w.stepSlide[1] = 1;
        const Rec2 x = play2(w, 0, static_cast<int>(STEP * 4), 512);
        check(near(x.notes[0].gate, 1.25 * STEP_S) && near(x.notes[1].t, 1.25 * STEP_S), "SLIDE + SWING : tenue jusqu'a la note retardee");
    }
    {
        // GATE : court x0.5, long x1.5 (sans depasser la suivante), lie
        ArpProgram p = simple();
        p.stepGate[0] = 0;
        p.stepGate[1] = 2;
        p.stepGate[2] = 3;
        const Rec2 r = play2(p, 0, static_cast<int>(STEP * 4), 512);
        check(near(r.notes[0].gate, 0.25 * STEP_S) && near(r.notes[1].gate, 0.75 * STEP_S) && near(r.notes[2].gate, STEP_S) && near(r.notes[3].gate, 0.5 * STEP_S), "GATE : court, long, lie, normal");
        p.gate = 0.9;
        const Rec2 q = play2(p, 0, static_cast<int>(STEP * 4), 512);
        check(near(q.notes[1].gate, STEP_S) && near(q.notes[0].gate, 0.45 * STEP_S), "GATE long : jamais au-dela de la note suivante");
        p.spn = 4;
        const Rec2 w = play2(p, 0, static_cast<int>(STEP * 16), 512);
        check(near(w.notes[2].gate, 4 * STEP_S), "GATE lie en 1/4 : quatre pas");
    }
    {
        // RATCHET : 1 a 4 notes dans la duree du pas
        ArpProgram p = simple();
        p.stepRat[1] = 2;
        p.stepRat[2] = 3;
        p.stepRat[3] = 4;
        const Rec2 r = play2(p, 0, static_cast<int>(STEP * 4), 512);
        bool ok = r.notes.size() == 1 + 2 + 3 + 4;
        // le pas 1 : deux notes a un demi-pas, portes de la moitie, la seconde a x0.8, sans glissement
        ok = ok && near(r.notes[1].t, STEP_S) && near(r.notes[2].t, 1.5 * STEP_S) && near(r.notes[1].gate, 0.25 * STEP_S) && near(r.notes[2].gate, 0.25 * STEP_S);
        ok = ok && near(r.notes[1].acc, 0.8) && near(r.notes[2].acc, 0.64) && r.notes[2].midi == 63 && r.notes[2].from == 63 && r.notes[2].glide == 0;
        ok = ok && near(r.notes[3].t, 2 * STEP_S) && near(r.notes[5].t, (2 + 2.0 / 3) * STEP_S) && near(r.notes[9].t, 3.75 * STEP_S) && near(r.notes[9].gate, 0.125 * STEP_S);
        check(ok, "RATCHET : 2, 3, 4 notes dans le pas (%d notes), portes divisees, la premiere appuyee", static_cast<int>(r.notes.size()));
        ArpProgram q = simple();
        for (int i = 0; i < 16; ++i) q.stepRat[i] = 4;
        const Rec2 a = play2(q, 0, static_cast<int>(STEP * 16), 512);
        check(a.notes.size() == 64, "RATCHET x4 partout : 64 notes par mesure (%d)", static_cast<int>(a.notes.size()));
        // lie + ratchet : chaque repetition tient jusqu'a la suivante ; slide : la premiere seule glisse
        ArpProgram w = simple();
        w.stepRat[1] = 2;
        w.stepGate[1] = 3;
        w.stepSlide[1] = 1;
        const Rec2 x = play2(w, 0, static_cast<int>(STEP * 4), 512);
        check(x.notes.size() == 5 && near(x.notes[1].gate, 0.5 * STEP_S) && near(x.notes[2].gate, 0.5 * STEP_S) && near(x.notes[1].glide, kSlideSec) && x.notes[2].glide == 0 && near(x.notes[0].gate, STEP_S),
              "RATCHET + lie + SLIDE");
    }
    {
        // PROB : 0 jamais, 100 toujours, 50 la moitie ; le meme a chaque lecture, autre avec une autre graine
        ArpProgram p = simple();
        p.stepProb[1] = 0;
        const Rec2 r = play2(p, 0, static_cast<int>(STEP * 16), 512);
        bool none = r.notes.size() == 12;
        for (const auto& n : r.notes) none = none && n.midi != 63;
        check(none, "PROB 0 : la position ne joue jamais (12 notes sur 16)");
        for (int i = 0; i < 16; ++i) p.stepProb[i] = 50;
        const int N = 4096;
        const Rec2 a = play2(p, 0, static_cast<int>(STEP * N), 4096, 42), b = play2(p, 0, static_cast<int>(STEP * N), 333, 42), c = play2(p, 0, static_cast<int>(STEP * N), 4096, 43);
        bool same = a.notes.size() == b.notes.size(), other = a.notes.size() != c.notes.size();
        for (size_t i = 0; same && i < a.notes.size(); ++i) same = near(a.notes[i].t, b.notes[i].t) && a.notes[i].midi == b.notes[i].midi;
        for (size_t i = 0; !other && i < a.notes.size(); ++i) other = !near(a.notes[i].t, c.notes[i].t);
        const double f = static_cast<double>(a.notes.size()) / N;
        check(same && other && f > 0.47 && f < 0.53, "PROB 50 : %.1f %% des notes jouent, les memes a chaque lecture, d'autres avec une autre graine", 100 * f);
        for (int i = 0; i < 16; ++i) p.stepProb[i] = 25;
        const double f25 = static_cast<double>(play2(p, 0, static_cast<int>(STEP * N), 4096, 42).notes.size()) / N;
        for (int i = 0; i < 16; ++i) p.stepProb[i] = 90;
        const double f90 = static_cast<double>(play2(p, 0, static_cast<int>(STEP * N), 4096, 42).notes.size()) / N;
        check(f25 > 0.22 && f25 < 0.28 && f90 > 0.87 && f90 < 0.93, "PROB 25 / 90 : %.1f %% / %.1f %%", 100 * f25, 100 * f90);
        // une lecture lancee ailleurs : les memes notes au meme endroit
        for (int i = 0; i < 16; ++i) p.stepProb[i] = 50;
        const Rec2 j = play2(p, 8.0, static_cast<int>(STEP * 32), 512, 42);
        size_t i0 = 0;
        while (i0 < a.notes.size() && a.notes[i0].t < 32 * STEP_S - 1e-9) ++i0;
        bool pos = !j.notes.empty();
        for (size_t i = 0; pos && i < j.notes.size(); ++i) pos = i0 + i < a.notes.size() && near(a.notes[i0 + i].t - 32 * STEP_S, j.notes[i].t, 1e-7) && a.notes[i0 + i].midi == j.notes[i].midi;
        check(pos, "PROB : par position du morceau (lancee en mesure 3 : les memes notes)");
        // le tirage de PROB ne bouge pas celui de RAND / DRIFT : les notes qui jouent gardent leur hauteur et leur force
        ArpProgram q;
        q.spn = 1;
        q.drift = 1;
        q.prog = {0};
        q.chords = {{0, false, {60, 62, 64, 65, 67}}};
        const Rec2 full = play2(q, 0, static_cast<int>(STEP * 64), 512, 9);
        for (int i = 0; i < 16; ++i) q.stepProb[i] = 60;
        const Rec2 part = play2(q, 0, static_cast<int>(STEP * 64), 512, 9);
        bool keep = !part.notes.empty() && part.notes.size() < full.notes.size();
        size_t fi = 0;
        for (const auto& n : part.notes) {
            while (fi < full.notes.size() && !near(full.notes[fi].t, n.t)) ++fi;
            keep = keep && fi < full.notes.size() && full.notes[fi].midi == n.midi && near(full.notes[fi].acc, n.acc);
        }
        check(keep, "PROB : le hasard de DRIFT ne bouge pas (memes forces pour les notes qui jouent)");
        // une note qui ne joue pas ne tient pas la precedente (SLIDE) et se montre comme un silence
        ArpProgram w = simple();
        w.stepSlide[1] = 1;
        w.stepProb[1] = 0;
        const Rec2 x = play2(w, 0, static_cast<int>(STEP * 4), 512);
        check(x.notes.size() == 3 && near(x.notes[0].gate, 0.5 * STEP_S), "PROB 0 + SLIDE : la precedente n'est pas tenue");
    }
    {
        // Le swing propre : jusqu'a un tiers de pas, ajoute a celui de la face
        ArpProgram p = simple();
        p.swingOwn = 1;
        const Rec2 r = play2(p, 0, static_cast<int>(STEP * 4), 512);
        check(near(r.notes[1].t * SR, STEP + STEP / 3, 1e-6) && near(r.notes[2].t * SR, 2 * STEP, 1e-6) && near(r.notes[3].t * SR, 3 * STEP + STEP / 3, 1e-6), "swing propre a 1 : un tiers de pas sur les impaires");
        p.swingOwn = 0.5;
        p.swing = 0.1;
        const Rec2 q = play2(p, 0, static_cast<int>(STEP * 4), 512);
        check(near(q.notes[1].t * SR, STEP * (1 + 0.1 + 0.5 / 3), 1e-6), "swing propre + SWING de la face : la somme");
        p.swing = 0.6;
        p.swingOwn = 1;
        const Rec2 w = play2(p, 0, static_cast<int>(STEP * 4), 512);
        check(near(w.notes[1].t * SR, STEP * 1.75, 1e-6), "la somme bornee a 0.75 pas");
    }
    {
        // Les pistes suivent la position dans la suite, modulo 16 si elle est plus longue ; blocs sans effet
        ArpProgram p;
        p.spn = 1;
        p.prog = {0};
        ArpChord ch{0, false, {}};
        for (int i = 0; i < 20; ++i) ch.midi.push_back(48 + i);
        p.chords = {ch};
        p.stepAcc[3] = 2;
        p.stepRat[5] = 2;
        p.stepSlide[7] = 1;
        p.stepGate[9] = 3;
        p.swingOwn = 0.4;
        const Rec2 a = play2(p, 0, static_cast<int>(STEP * 40), 4096), b = play2(p, 0, static_cast<int>(STEP * 40), 61);
        bool same = a.notes.size() == b.notes.size() && a.notes.size() == 40 + 3; // les positions 5, 21 (= 5) et 25 (= 5 + 20)
        for (size_t i = 0; same && i < a.notes.size(); ++i)
            same = near(a.notes[i].t, b.notes[i].t) && a.notes[i].midi == b.notes[i].midi && near(a.notes[i].gate, b.notes[i].gate) && near(a.notes[i].acc, b.notes[i].acc) && a.notes[i].glide == b.notes[i].glide;
        int hard = 0;
        for (const auto& n : a.notes)
            if (n.midi == 48 + 3 || n.midi == 48 + 19) hard += n.acc > 1.3 ? 1 : 0;
        check(same && hard == 3, "pistes : position modulo 16 (suite de 20 notes), taille des blocs sans effet");
    }
    std::printf(failures ? "%d echec(s)\n" : "tout passe\n", failures);
    return failures ? 1 : 0;
}
