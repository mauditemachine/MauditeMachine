// MM-HELL : le patch, la banque d'usine (le port de src/v4/plugin/arp/hell.ts du MM-ARP), les textes. Voir HellPatch.h.
#include "HellPatch.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <functional>
#include <stdexcept>

namespace mmhell {

const char* const kNoteNames[kNotes] = {"1/32", "1/16T", "1/16", "1/16.", "1/8T", "1/8", "1/8.", "1/4T", "1/4", "1/4.", "1/2", "1/2.", "1 BAR"};
const char* const kLfoNoteNames[kLfoNotes] = {"8 BAR", "4 BAR", "2 BAR", "1 BAR", "1/2", "1/4", "1/8", "1/16", "1/32"};
const char* const kRangeNames[4] = {"FINE", "WIDE", "SYNC", "MIDI"};
const char* const kShapeNames[4] = {"SINE", "SAW", "SQUARE", "RANDOM"};
const char* const kTargetNames[4] = {"FREQ", "PHASE", "LOW-PASS", "DELAY"};
const double kSyncMult[9] = {1.0 / 16, 1.0 / 8, 1.0 / 4, 1.0 / 2, 1, 2, 4, 8, 16};

namespace {

constexpr double kDead = 0.03; // le cran mort au centre du decaleur (Hell.cpp)
inline double clamp01(double v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

int indexOf(const char* const* names, int n, const std::string& s) {
    for (int i = 0; i < n; ++i)
        if (s == names[i]) return i;
    throw std::invalid_argument("MM-HELL : nom inconnu " + s);
}

// Les lois inverses de hell.ts (msV, lfoV, hpV, lpV, syncShiftV, midiShiftV)
double msV(double t) { return std::log(t / 5) / std::log(400.0); }
double lfoV(double hz) { return std::log(hz / 0.02) / std::log(500.0); }
double hpV(double hz) { return hz <= 0 ? 0 : std::log(hz / 20) / std::log(200.0); }
double lpV(double hz) { return hz <= 0 ? 1 : std::log(hz / 300) / std::log(20000.0 / 300.0); }
double syncShiftV(double m) {
    int i = -1;
    for (int k = 0; k < 9; ++k)
        if (std::fabs(kSyncMult[k] - std::fabs(m)) < 1e-9) i = k;
    if (i < 0) throw std::invalid_argument("MM-HELL : multiple SYNC inconnu");
    const double ax = kDead + (1 - kDead) * (i + 0.5) / 9;
    return 0.5 + (m < 0 ? -ax : ax) / 2;
}
double midiShiftV(double r) {
    const double ax = kDead + (1 - kDead) * ((std::log2(std::fabs(r)) + 4) / 5);
    return 0.5 + (r < 0 ? -ax : ax) / 2;
}

// Les unites d'un preset (hell.ts Units) : une note ou des ms, Hz, degres...
struct U {
    std::string t;        // une note ('1/8.') ; vide : tMs
    double tMs = 0;
    double fb = 0;
    bool cross = false;
    std::string range;    // vide : FINE jusqu'a 200 Hz, WIDE au-dela
    double sh = 0;        // FINE, WIDE : Hz ; SYNC : cycles par temps ; MIDI : part de la note
    double ud = 1, sp = 0, ph = 0;
    bool ar = false;
    double smear = 0, hp = 0, lp = 0;
    std::string shape = "SINE";
    double lrHz = 0.4;    // le LFO en Hz...
    std::string lrNote;   // ... ou en notes (SYNC)
    double amt = 0;
    bool st = false;
    std::string tgt = "FREQ";
};

HellPreset P(const char* name, const char* desc, const std::function<void(U&)>& f) {
    U o;
    f(o);
    HellPatch p;
    const std::string range = o.range.empty() ? (std::fabs(o.sh) > 200 ? "WIDE" : "FINE") : o.range;
    p.range = indexOf(kRangeNames, 4, range);
    p.sync = !o.t.empty();
    p.note = p.sync ? indexOf(kNoteNames, kNotes, o.t) : 5; // FREE : la note du levier SYNC revient a 1/8 (hell.ts lastNote)
    p.time = p.sync ? 0.5 : msV(o.tMs);
    p.feedback = o.fb;
    p.cross = o.cross;
    p.shift = p.range == 2 ? syncShiftV(o.sh) : p.range == 3 ? midiShiftV(o.sh) : mmarp::Hell::shiftVFor(o.sh, p.range);
    p.sideband = o.ud;
    p.spread = o.sp;
    p.phase = o.ph / 360;
    p.antiRefl = o.ar;
    p.smear = o.smear;
    p.hp = hpV(o.hp);
    p.lp = lpV(o.lp);
    p.lfoShape = indexOf(kShapeNames, 4, o.shape);
    p.lfoSync = !o.lrNote.empty();
    p.lfoNote = p.lfoSync ? indexOf(kLfoNoteNames, kLfoNotes, o.lrNote) : 5;
    p.lfoRate = p.lfoSync ? lfoV(0.4) : lfoV(o.lrHz);
    p.lfoAmt = o.amt;
    p.lfoStereo = o.st;
    p.lfoTarget = indexOf(kTargetNames, 4, o.tgt);
    return {name, desc, p};
}

// 2026-11-18, une correction du MM-ARP : BARBER DOWN, ABYSS, DEEP STAIRS, SULFUR RAIN et HELLFIRE SWELL avaient un
// decalage negatif ET la bande DOWN (ud 0) : les deux signes s'annulent (bande basse d'un decalage negatif = f + |hz|) et
// ces presets montaient au lieu de descendre (mesure : tests/presets_test.cpp ; l'ECHO MAP le montrait). Ici, SIDEBAND UP
// (la bande qui suit le signe) : ils descendent comme leurs noms le disent, et leur ANTI REFL (prevu pour une descente)
// s'enclenche enfin. Tout le reste est celui du MM-ARP.
std::vector<HellPreset> build() {
    std::vector<HellPreset> b;
    // les douze d'avant (MM-ARP, 2026-11-13)
    b.push_back(P("SLOW ASCENT", "Each repeat climbs a little: a slow rising spiral", [](U& u) { u.t = "1/4"; u.fb = 0.72; u.sh = 35; u.sp = 0.2; }));
    b.push_back(P("BARBER DOWN", "Endless falling staircase on sixteenths", [](U& u) { u.t = "1/16"; u.fb = 0.88; u.sh = -18; u.ud = 1; u.lp = 5800; }));
    b.push_back(P("TIN CAN", "Short metallic box, both sidebands", [](U& u) { u.tMs = 18; u.fb = 0.82; u.sh = 7; u.ud = 0.5; u.sp = 0.5; u.hp = 120; }));
    b.push_back(P("HALO", "Bright shimmer, a fifth-ish up each pass", [](U& u) {
        u.t = "1/8.";
        u.fb = 0.7;
        u.sh = 420;
        u.sp = 0.35;
        u.lrHz = 0.3;
        u.amt = 0.22;
        u.hp = 90;
        u.smear = 0.25;
    }));
    b.push_back(P("ABYSS", "Falls deep and dark, repeat after repeat", [](U& u) { u.t = "1/4."; u.fb = 0.9; u.sh = -140; u.ud = 1; u.lp = 1500; u.ar = true; }));
    b.push_back(P("CROOKED PONG", "Left climbs, right falls: a bent ping-pong", [](U& u) { u.t = "1/8"; u.fb = 0.6; u.sh = 12; u.sp = 1; u.cross = true; }));
    b.push_back(P("INFERNAL DUB", "Dub echo that drifts out of tune", [](U& u) {
        u.t = "1/4.";
        u.fb = 0.85;
        u.sh = -6;
        u.lp = 2400;
        u.hp = 140;
        u.lrHz = 0.25;
        u.amt = 0.27;
    }));
    b.push_back(P("SIREN", "The shift swings with a slow LFO", [](U& u) { u.t = "1/8T"; u.fb = 0.65; u.sh = 60; u.sp = 0.5; u.lrHz = 0.4; u.amt = 0.79; }));
    b.push_back(P("GHOST CHOIR", "Barely shifted, both ways: a ghostly chorus", [](U& u) {
        u.tMs = 90;
        u.fb = 0.78;
        u.sh = 3;
        u.ud = 0.5;
        u.lrHz = 0.1;
        u.amt = 0.14;
        u.smear = 0.4;
    }));
    b.push_back(P("BROKEN RADIO", "Far shift, thin and wide", [](U& u) { u.tMs = 45; u.fb = 0.7; u.sh = 900; u.ud = 0.5; u.sp = 0.7; u.hp = 700; }));
    b.push_back(P("DEEP STAIRS", "Half notes stepping down", [](U& u) { u.t = "1/2"; u.fb = 0.8; u.sh = -55; u.ud = 1; u.ar = true; }));
    b.push_back(P("INIT", "Plain delay, no shift", [](U& u) { u.t = "1/8."; u.fb = 0.5; u.sh = 0; }));
    // les nouveaux (MM-ARP, 2026-11-17) : SMEAR, CROSS, ANTI REFL, PHASE, RANGE SYNC et MIDI, le LFO et ses cibles
    b.push_back(P("SULFUR RAIN", "Smeared falling drops, each one a little lower", [](U& u) {
        u.t = "1/16.";
        u.fb = 0.82;
        u.sh = -24;
        u.ud = 1;
        u.smear = 0.7;
        u.lp = 4200;
        u.ar = true;
    }));
    b.push_back(P("CHAPEL OF RUST", "A diffused halo whose phase turns slowly", [](U& u) {
        u.tMs = 140;
        u.fb = 0.86;
        u.sh = 0;
        u.smear = 0.85;
        u.lrHz = 0.08;
        u.amt = 1;
        u.tgt = "PHASE";
        u.st = true;
        u.hp = 160;
    }));
    b.push_back(P("MOLTEN TAPE", "A melting tape echo: the delay time wobbles", [](U& u) {
        u.t = "1/8";
        u.fb = 0.7;
        u.sh = 2;
        u.shape = "SINE";
        u.lrHz = 0.7;
        u.amt = 0.35;
        u.tgt = "DELAY";
        u.lp = 3800;
        u.hp = 90;
    }));
    b.push_back(P("CROSSFIRE", "Crossed feedback, opposite shifts: the echo bounces and bends", [](U& u) {
        u.t = "1/8.";
        u.fb = 0.78;
        u.sh = 25;
        u.sp = 1;
        u.cross = true;
        u.st = true;
    }));
    b.push_back(P("PURGATORY LOOP", "The shift locked to the tempo: a rhythmic barber pole", [](U& u) {
        u.t = "1/4";
        u.fb = 0.9;
        u.range = "SYNC";
        u.sh = 1;
        u.smear = 0.3;
        u.lp = 7000;
    }));
    b.push_back(P("DEVIL TRILL", "A square LFO flips the shift on the beat", [](U& u) {
        u.t = "1/16";
        u.fb = 0.6;
        u.sh = 0;
        u.shape = "SQUARE";
        u.lrNote = "1/8";
        u.amt = 0.55;
        u.tgt = "FREQ";
        u.st = true;
    }));
    b.push_back(P("BLACK MASS", "Low ring modulation, a dark bell under every note", [](U& u) {
        u.tMs = 260;
        u.fb = 0.55;
        u.range = "WIDE";
        u.sh = 110;
        u.ud = 0.5;
        u.lp = 2200;
    }));
    b.push_back(P("EMBER DRIFT", "Random LFO on the low-pass: embers that flicker", [](U& u) {
        u.t = "1/8T";
        u.fb = 0.75;
        u.sh = 9;
        u.shape = "RANDOM";
        u.lrNote = "1/8";
        u.amt = 0.8;
        u.tgt = "LOW-PASS";
        u.lp = 2600;
        u.smear = 0.35;
    }));
    b.push_back(P("NOTE GHOST", "The shift follows the played note: a harmonic shadow", [](U& u) {
        u.t = "1/8.";
        u.fb = 0.66;
        u.range = "MIDI";
        u.sh = 0.5;
        u.ud = 1;
        u.hp = 100;
    }));
    b.push_back(P("PHASE MONK", "No shift, only the phase swinging: a slow hollow sweep", [](U& u) {
        u.tMs = 30;
        u.fb = 0.62;
        u.sh = 0;
        u.shape = "SAW";
        u.lrHz = 0.15;
        u.amt = 1;
        u.tgt = "PHASE";
        u.st = true;
    }));
    b.push_back(P("TEMPO SPIRAL", "Upward spiral in tempo, crossed and smeared", [](U& u) {
        u.t = "1/8";
        u.fb = 0.85;
        u.range = "SYNC";
        u.sh = 4;
        u.cross = true;
        u.smear = 0.5;
        u.ar = true;
    }));
    b.push_back(P("HELLFIRE SWELL", "A rising saw opens and closes the loop", [](U& u) {
        u.t = "1/4.";
        u.fb = 0.8;
        u.sh = -40;
        u.ud = 1;
        u.shape = "SAW";
        u.lrNote = "1 BAR";
        u.amt = -0.9;
        u.tgt = "LOW-PASS";
        u.lp = 1800;
        u.ar = true;
    }));
    return b;
}

std::string fmt(const char* f, double v) {
    char b[48];
    std::snprintf(b, sizeof b, f, v);
    return b;
}

} // namespace

const std::vector<HellPreset>& factory() {
    static const std::vector<HellPreset> bank = build();
    return bank;
}

int initIndex() {
    static const int i = [] {
        const auto& b = factory();
        for (size_t k = 0; k < b.size(); ++k)
            if (b[k].name == "INIT") return static_cast<int>(k);
        return 0;
    }();
    return i;
}

bool same(const HellPatch& a, const HellPatch& b) {
    const auto eq = [](double x, double y) { return std::fabs(x - y) < 1.5e-3; };
    return a.sync == b.sync && (!a.sync || a.note == b.note) && (a.sync || eq(a.time, b.time)) && eq(a.feedback, b.feedback) && a.cross == b.cross &&
           a.range == b.range && eq(a.shift, b.shift) && eq(a.sideband, b.sideband) && eq(a.spread, b.spread) && eq(a.phase, b.phase) &&
           a.antiRefl == b.antiRefl && eq(a.smear, b.smear) && eq(a.hp, b.hp) && eq(a.lp, b.lp) && a.lfoShape == b.lfoShape && a.lfoSync == b.lfoSync &&
           (!a.lfoSync || a.lfoNote == b.lfoNote) && (a.lfoSync || eq(a.lfoRate, b.lfoRate)) && eq(a.lfoAmt, b.lfoAmt) && a.lfoStereo == b.lfoStereo &&
           a.lfoTarget == b.lfoTarget;
}

int match(const HellPatch& p) {
    const auto& b = factory();
    for (size_t k = 0; k < b.size(); ++k)
        if (same(p, b[k].p)) return static_cast<int>(k);
    return -1;
}

double shiftHz(const HellPatch& p, double bpm, double noteHz) { return mmarp::Hell::shiftHzFor(p.shift, p.range, bpm, noteHz); }

double delaySeconds(const HellPatch& p, double bpm) {
    const double sec = p.sync ? mmarp::Hell::kSyncBeats[1 + std::clamp(p.note, 0, kNotes - 1)] * 60.0 / std::max(20.0, bpm) : mmarp::Hell::timeMsOf(p.time) / 1000.0;
    return std::min(4.0, std::max(0.001, sec));
}

double lfoHz(const HellPatch& p, double bpm) {
    return p.lfoSync ? mmarp::Hell::lfoSyncHz(std::clamp(p.lfoNote, 0, kLfoNotes - 1) / static_cast<double>(kLfoNotes - 1), bpm) : mmarp::Hell::lfoHzOf(p.lfoRate);
}

mmarp::HellSettings settingsOf(const HellPatch& p, double mix, double bpm, double noteHz) {
    mmarp::HellSettings s;
    s.mix = clamp01(mix);
    s.sync = p.sync ? 1 + std::clamp(p.note, 0, kNotes - 1) : 0;
    s.timeMs = mmarp::Hell::timeMsOf(p.time);
    s.feedback = clamp01(p.feedback);
    s.cross = p.cross;
    s.shiftHz = shiftHz(p, bpm, noteHz);
    s.upDown = clamp01(p.sideband);
    s.spread = clamp01(p.spread);
    s.phase = clamp01(p.phase);
    s.antiRefl = p.antiRefl;
    s.smear = clamp01(p.smear);
    s.hpHz = mmarp::Hell::hpHzOf(p.hp);
    s.lpHz = mmarp::Hell::lpHzOf(p.lp);
    s.lfoHz = lfoHz(p, bpm);
    s.lfoDepthHz = 0;
    s.lfoShape = std::clamp(p.lfoShape, 0, 3);
    s.lfoAmt = std::max(-1.0, std::min(1.0, p.lfoAmt));
    s.lfoStereo = p.lfoStereo;
    s.lfoTarget = std::clamp(p.lfoTarget, 0, 3);
    s.tone = 0.5;
    return s;
}

namespace text {

std::string hz(double f) {
    const double a = std::fabs(f);
    const char* sgn = f > 0 ? "+" : f < 0 ? "-" : "";
    if (a < 0.05) return "0 HZ";
    if (a >= 1000) return sgn + fmt("%.2f KHZ", a / 1000);
    if (a >= 100) return sgn + fmt("%.0f HZ", a);
    return sgn + fmt("%.1f HZ", a);
}

std::string mix(double v) { return v <= 0.0005 ? "OFF" : fmt("%.0f %%", v * 100); }

std::string time(double v) {
    const double t = mmarp::Hell::timeMsOf(v);
    return t >= 1000 ? fmt("%.2f S", t / 1000) : fmt("%.0f MS", t);
}

std::string percent(double v) { return fmt("%.0f %%", clamp01(v) * 100); }

std::string shift(double v, int range) {
    const double ax = std::fabs(2 * clamp01(v) - 1);
    if (ax < kDead) return "0 HZ";
    const double t = std::min(1.0, (ax - kDead) / (1 - kDead));
    const std::string sgn = v < 0.5 ? "-" : "+";
    if (range == 2) {
        const double m = kSyncMult[std::min(8, static_cast<int>(std::floor(t * 9)))];
        return sgn + (m >= 1 ? fmt("%.0f", m) : fmt("1/%.0f", 1 / m)) + " / BEAT";
    }
    if (range == 3) return sgn + fmt("%.2f", std::pow(2.0, -4 + 5 * t)) + " x NOTE";
    return hz(mmarp::Hell::shiftHzFor(v, range, 120, 0));
}

std::string shiftHzNow(double v, int range, double bpm, double noteHz) {
    if (range < 2) return "";
    if (range == 3 && noteHz <= 0) return "NO MIDI NOTE YET";
    return hz(mmarp::Hell::shiftHzFor(v, range, bpm, noteHz));
}

std::string sideband(double v) {
    v = clamp01(v);
    if (v >= 0.995) return "UP";
    if (v <= 0.005) return "DOWN";
    if (std::fabs(v - 0.5) < 0.006) return "R.M. (BOTH)";
    const double gUp = std::min(1.0, 2 * v), gDown = std::min(1.0, 2 * (1 - v));
    return v > 0.5 ? fmt("UP + %.0f %% DOWN", gDown * 100) : fmt("DOWN + %.0f %% UP", gUp * 100);
}

std::string phase(double v) { return fmt("%.0f\xC2\xB0", clamp01(v) * 360); }

std::string hp(double v) {
    const double f = mmarp::Hell::hpHzOf(v);
    return f <= 0 ? "OFF" : hz(f).substr(1);
}

std::string lp(double v) {
    const double f = mmarp::Hell::lpHzOf(v);
    return f <= 0 ? "OFF" : hz(f).substr(1);
}

std::string lfoRate(double v) {
    const double f = mmarp::Hell::lfoHzOf(v);
    return f < 1 ? fmt("%.2f HZ", f) : fmt("%.1f HZ", f);
}

std::string bipolar(double v) {
    const double p = std::max(-1.0, std::min(1.0, v)) * 100;
    if (std::fabs(p) < 0.5) return "0 %";
    return (p > 0 ? "+" : "-") + fmt("%.0f %%", std::fabs(p));
}

std::string noteName(double f) {
    if (f <= 0) return "";
    static const char* const n[12] = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
    const int m = static_cast<int>(std::lround(69 + 12 * std::log2(f / 440.0)));
    // la convention d'Ableton : 60 = C3, 69 = A3 (440 Hz)
    const int oct = static_cast<int>(std::floor(m / 12.0)) - 2;
    return std::string(n[((m % 12) + 12) % 12]) + std::to_string(oct);
}

} // namespace text

} // namespace mmhell
