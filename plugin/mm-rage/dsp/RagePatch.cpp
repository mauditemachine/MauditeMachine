#include "RagePatch.h"

#include <algorithm>
#include <cstdio>

namespace mmrage {

const char* const kStyleNames[kStyles] = {"A", "E", "N", "T", "P", "TAPE", "FUZZ", "DIODE", "AMP", "RECT", "FOLD", "CRUSH"};
const char* const kStyleLong[kStyles] = {"TUBE PREAMP", "TRANSISTOR", "TRANSFORMER", "TRIODE", "PENTODE", "TAPE",
                                         "FUZZ", "DIODE CLIP", "GUITAR AMP", "RECTIFIER", "WAVEFOLDER", "BIT CRUSHER"};
const char* const kBandStyleNames[kStyles + 1] = {"MAIN", "A", "E", "N", "T", "P", "TAPE", "FUZZ", "DIODE", "AMP", "RECT", "FOLD", "CRUSH"};
const char* const kBandsNames[3] = {"1", "2", "3"};
const char* const kFilterNames[5] = {"OFF", "LP", "BP", "HP", "PEAK"};
const char* const kBoxNames[5] = {"OFF", "SMALL", "COMBO", "STACK", "RADIO"};
const char* const kShapeNames[5] = {"SINE", "TRI", "SAW", "SQUARE", "RANDOM"};
const char* const kTargetNames[6] = {"DRIVE", "MORPH", "TONE", "PRE", "POST", "MIX"};
const char* const kLfoNoteNames[kLfoNotes] = {"8 BAR", "4 BAR", "2 BAR", "1 BAR", "1/2", "1/4", "1/8", "1/16", "1/32"};
const double kLfoBeats[kLfoNotes] = {32, 16, 8, 4, 2, 1, 0.5, 0.25, 0.125};

namespace {

using D = mmarp::Decap;

double clamp01(double v) { return std::min(1.0, std::max(0.0, v)); }

/* ------------------------------------------------------------------ la banque ------------------------------------------------------------------ */

// Les noms des styles, des filtres, des caisses, des formes, des cibles et des notes du LFO (comme disto.ts)
enum { A, E, N, T, P, TAPE, FUZZ, DIODE, AMP, RECT, FOLD, CRUSH };
constexpr int MAIN = -1;
enum { F_OFF, LP, BP, HP, PEAK };
enum { NO_BOX, SMALL, COMBO, STACK, RADIO };
enum { SINE, TRI, SAW, SQUARE, RANDOM };
enum { T_DRIVE, T_MORPH, T_TONE, T_PRE, T_POST, T_MIX };
enum { N8BAR, N4BAR, N2BAR, N1BAR, N1_2, N1_4, N1_8, N1_16, N1_32 };

/**
 * Un preset dans les unites de disto.ts (Units) : Hz, dB, -1..1, puis les lois inverses de disto.ts (lowV, highV, filtV,
 * bip...). Ce qui n'est pas dit reste a son depart (extra-params.json), comme P() de disto.ts.
 */
struct B {
    RagePatch p;
    B(int st, double drive) {
        p.style = st;
        p.drive = drive;
    }
    static double bip(double x) { return 0.5 + x / 2; }
    B& punish() { return p.punish = true, *this; }
    B& low(double hz) { return p.low = hz <= 0 ? 0 : 0.02 + 0.98 * std::log(hz / 20) / std::log(50.0), *this; }
    B& thump() { return p.thump = true, *this; }
    B& tone(double x) { return p.tone = bip(x), *this; }
    B& high(double hz) { return p.high = hz <= 0 ? 1 : 0.98 * std::log(hz / 1000) / std::log(20.0), *this; }
    B& steep() { return p.steep = true, *this; }
    B& mix(double m) { return p.mix = m, *this; }
    B& out(double db) { return p.out = (db + 18) / 36, *this; }
    B& manual() { return p.autoGain = false, *this; }
    B& morph(double m, int to) {
        p.morph = m;
        p.morphTo = to;
        return *this;
    }
    B& to(int t) { return p.morphTo = t, *this; }
    B& dyn(double x) { return p.dyn = bip(x), *this; }
    B& fb(double a, double hz = 0) {
        p.fb = a;
        if (hz > 0) p.fbFreq = std::log(hz / 40) / std::log(30.0);
        return *this;
    }
    B& bands(int n, double xLo = 0, double xHi = 0) {
        p.bands = n;
        if (xLo > 0) p.xLo = std::log(xLo / 40) / std::log(25.0);
        if (xHi > 0) p.xHi = std::log(xHi / 600) / std::log(25.0);
        return *this;
    }
    B& band(int i, int st = MAIN, double drDb = 0, double mx = 1, double lvDb = 0, bool byp = false, bool solo = false) {
        BandPatch& b = p.band[static_cast<size_t>(i)];
        b.style = st;
        b.drive = (drDb + 18) / 36;
        b.mix = mx;
        b.level = (lvDb + 12) / 24;
        b.bypass = byp;
        b.solo = solo;
        return *this;
    }
    B& bypass(int i) { return band(i, MAIN, 0, 1, 0, true); }
    B& env(double amt, double spd = -1) {
        p.envAmt = bip(amt);
        if (spd >= 0) p.envSpeed = spd;
        return *this;
    }
    B& lfo(int shape, double hz, double amt, int tgt) {
        p.lfoShape = shape;
        p.lfoSync = false;
        p.lfoRate = std::log(hz / 0.02) / std::log(500.0);
        p.lfoAmt = bip(amt);
        p.lfoTarget = tgt;
        return *this;
    }
    B& lfoSync(int shape, int note, double amt, int tgt) {
        p.lfoShape = shape;
        p.lfoSync = true;
        p.lfoNote = note;
        p.lfoAmt = bip(amt);
        p.lfoTarget = tgt;
        return *this;
    }
    static double filtV(double hz) { return std::log(hz / 20) / std::log(1000.0); }
    B& pre(int mode, double hz, double reso = 0) {
        p.preMode = mode;
        p.preFreq = filtV(hz);
        p.preReso = reso;
        return *this;
    }
    B& post(int mode, double hz, double reso = 0) {
        p.postMode = mode;
        p.postFreq = filtV(hz);
        p.postReso = reso;
        return *this;
    }
    B& box(int type, double size = 0.5, double mx = 1) {
        p.box = type;
        p.boxSize = size;
        p.boxMix = mx;
        return *this;
    }
};

std::vector<RagePreset> build() {
    std::vector<RagePreset> v;
    std::string fam;
    const auto add = [&](const char* name, const char* desc, const B& b) { v.push_back({name, desc, b.p, fam}); };

    // ---- THE CLASSICS : INIT, puis les 20 de la DISTO du MM-ARP (disto.ts DISTO_PRESETS, dans l'ordre, memes valeurs) ----
    fam = "THE CLASSICS";
    add("INIT", "Style A, a quarter of DRIVE, everything else at rest", B(A, 0.25));
    add("WARM GLUE", "Style A, a little drive, the level kept by AUTO", B(A, 0.25).tone(0.1).high(16000));
    add("TAPE KISS", "Tape saturation, the highs rounded off", B(TAPE, 0.35).low(30).high(9000).dyn(-0.2));
    add("CONSOLE PUSH", "Style N with THUMP, mix bus grit", B(N, 0.45).low(60).thump().high(14000));
    add("PENTODE BITE", "Style P, bright and forward", B(P, 0.55).tone(0.4).low(120));
    add("TRIODE BLOOM", "Triode warmth folding into the highs, breathing with the playing",
        B(T, 0.62).low(70).thump().tone(0.2).high(11000).mix(0.85).morph(0.35, FOLD).dyn(-0.36).fb(0.18).bands(3, 120, 3100)
            .band(0, MAIN, -6, 0.6).band(1, MAIN, 4).band(2, FOLD, 0, 0.72, -1.5).env(0.36, 0.3).lfoSync(SINE, N1_2, 0.24, T_MORPH)
            .pre(HP, 90, 0.2).post(LP, 9000, 0.38).box(COMBO, 0.4, 0.3));
    add("PUNISHED", "Style E with PUNISH, steep high cut", B(E, 0.7).punish().low(80).high(6000).steep());
    add("FUZZ CELLAR", "Fuzz through a low box, dark and woolly", B(FUZZ, 0.75).tone(-0.3).post(LP, 3500, 0.2).box(STACK, 0.7, 0.8));
    add("DIODE RAIL", "Hard diode clipping, tight lows", B(DIODE, 0.6).low(150).high(12000).steep());
    add("OCTAVE GHOST", "Rectifier: an octave up shimmering over the note", B(RECT, 0.55).mix(0.6).pre(HP, 300).post(LP, 9000));
    add("FOLDED SINE", "Wavefolder morphed by the LFO, in tempo", B(A, 0.5).morph(0.4, FOLD).mix(0.8).lfoSync(SINE, N1_4, 0.6, T_MORPH));
    add("BITTER CRUSH", "Bit crusher tamed by the post low-pass", B(CRUSH, 0.4).mix(0.75).post(LP, 4500, 0.3));
    add("SMALL RADIO", "Band-pass before, a radio box after", B(E, 0.45).low(200).pre(BP, 1200, 0.3).box(RADIO, 0.5, 1));
    add("AMP IN A BOX", "Guitar amp into a combo", B(AMP, 0.6).low(90).box(COMBO, 0.5, 1));
    add("STACK ATTACK", "Amp into a stack, two bands", B(AMP, 0.65).dyn(0.3).bands(2, 250).band(0, N, -6).box(STACK, 0.6, 0.9));
    add("SUB SAFE", "Three bands: the lows left clean, the mids driven", B(P, 0.6).bands(3, 150, 3500).bypass(0).band(1, MAIN, 6).band(2, MAIN, 0, 0.6, -3));
    add("AIR TEARS", "Three bands: the highs folded, the rest warm", B(A, 0.45).bands(3, 200, 5000).band(0, TAPE).band(2, FOLD, 6, 0.7));
    add("BREATHING DIRT", "Expanding dynamics, the envelope opens the drive", B(T, 0.35).dyn(0.5).env(0.7, 0.4));
    add("WOBBLE GRIT", "The LFO on DRIVE, synced to 1/8", B(FUZZ, 0.45).lfoSync(SINE, N1_8, 0.7, T_DRIVE).post(LP, 6000));
    add("MELTDOWN", "Feedback, PUNISH and fuzz: handle with care", B(FUZZ, 0.8).punish().fb(0.85, 220).out(-6).post(LP, 5000, 0.4));
    add("MAUDITE", "The house sound: tape into triode, a touch of box", B(TAPE, 0.4).morph(0.3, T).dyn(-0.2).high(15000).box(SMALL, 0.5, 0.35));

    // ---- BUS & GLUE : discret, pour une piste de groupe ou le mix ----
    fam = "BUS & GLUE";
    add("BUS GLUE", "Style A barely pushed, the wet held by a soft compression: the mix sticks together", B(A, 0.16).dyn(-0.24).high(18000));
    add("TAPE MACHINE", "Tape at a hot level: a lift in the lows, the highs eased, the peaks rounded",
        B(TAPE, 0.26).low(28).thump().high(15000).dyn(-0.12));
    add("CONSOLE CHANNEL", "A transistor desk channel: a little crunch in the highs, nothing more", B(E, 0.2).low(30).tone(0.08).high(17000));
    add("PARALLEL WARMTH", "A heavy triode blended low under the dry: weight and warmth, the attack untouched",
        B(T, 0.5).mix(0.3).low(60).high(12000));
    add("AIR EXCITER", "Only the air above 6 kHz is driven and blended in: shine without harshness",
        B(TAPE, 0.2).bands(3, 200, 6000).bypass(0).bypass(1).band(2, TAPE, 12, 0.5));
    add("LOW END GLUE", "Only the lows under 120 Hz saturate: a thicker kick and bass, the top left clean",
        B(N, 0.22).bands(2, 120).band(0, MAIN, 4).bypass(1));
    add("SOFT CLIPPER", "A diode clipper for the peaks: under -3 dBFS nothing moves, above they are shaved", B(DIODE, 0.297).manual().out(-9));
    add("VINTAGE DESK", "Transformer into tape, the old desk: thick, round, a little dark",
        B(N, 0.4).morph(0.5, TAPE).low(25).thump().high(11000).dyn(-0.35));

    // ---- DRUMS ----
    fam = "DRUMS";
    add("KICK THUMP", "For the kick: the low resonance comes out, the click stays tight",
        B(N, 0.4).low(25).thump().tone(-0.3).bands(2, 150).band(0, MAIN, 3).band(1, MAIN, -6, 0.7));
    add("SNARE CRACK", "Snares and claps: a crack on every hit, the body left alone",
        B(E, 0.5).low(150).tone(0.45).pre(PEAK, 2000, 0.3).high(14000).env(0.4, 0.15));
    add("HAT SIZZLE", "Hats and cymbals: a bright pentode sizzle blended in", B(P, 0.45).pre(HP, 4000, 0.2).mix(0.5));
    add("ROOM SMASH", "The drum bus smashed in a small room and blended under: the classic parallel crush",
        B(FUZZ, 0.8).dyn(-1).mix(0.5).low(60).box(STACK, 0.9, 0.7).high(6000));
    add("BREAKBEAT DIRT", "Breaks with a dusty bit grit, rounded by tape",
        B(CRUSH, 0.35).morph(0.4, TAPE).post(LP, 6500, 0.2).high(9000).mix(0.7));
    add("TRANSIENT BITE", "Only the hits bite: a fast envelope opens the drive on each transient",
        B(T, 0.45).env(0.85, 0.05).dyn(0.4).mix(0.8));
    add("909 DIRT", "Drum machine through a small amp: a punchy, forward middle",
        B(AMP, 0.5).low(40).thump().box(COMBO, 0.5, 0.35));
    add("TOM BOOM", "Feedback tuned to 90 Hz: the drums ring like big toms",
        B(A, 0.55).low(40).thump().fb(0.25, 90).tone(-0.4).high(8000));

    // ---- BASS ----
    fam = "BASS";
    add("ACID SQUELCH", "Diode clip into a resonant low-pass that the LFO opens in eighths",
        B(DIODE, 0.55).post(LP, 1400, 0.75).lfoSync(SAW, N1_8, 0.5, T_POST));
    add("SUB GROWL", "The sub stays clean under 110 Hz, the harmonics above growl",
        B(FUZZ, 0.5).bands(2, 110).bypass(0).band(1, MAIN, 6));
    add("REESE GRIT", "Detuned basses: the mids torn, an octave of grit above, the sub safe",
        B(E, 0.5).morph(0.5, RECT).bands(3, 150, 3000).bypass(0).band(2, MAIN, 0, 0.5, -3).high(9000));
    add("TUBE BASS", "A fat round tube on bass: more weight and sustain, nothing harsh",
        B(T, 0.4).low(30).thump().bands(2, 250).band(0, MAIN, 4).band(1, A, -8, 0.6).high(6000).dyn(-0.3));
    add("FUZZ BASS", "Seventies fuzz bass into a cabinet", B(FUZZ, 0.65).low(40).pre(HP, 60).post(LP, 3500, 0.25).mix(0.85).box(STACK, 0.6, 0.4));
    add("WOBBLE FOLD", "The LFO folds the bass in eighths: a wobble without a synth",
        B(A, 0.5).morph(0.5, FOLD).lfoSync(SINE, N1_8, 0.7, T_MORPH).post(LP, 5000));
    add("DEEP DUB", "Dub bass: dark tape, a resonance at 60 Hz, the highs cut steep",
        B(TAPE, 0.45).low(30).thump().tone(-0.3).high(3000).steep().fb(0.35, 55));
    add("RECTIFIED OCTAVE", "An octave above the bass from the rectifier, blended under the original",
        B(RECT, 0.5).mix(0.5).pre(LP, 600, 0.2));

    // ---- SYNTHS ----
    fam = "SYNTHS";
    add("LEAD SCREAM", "A lead that screams: pentode with PUNISH into a combo",
        B(P, 0.65).punish().low(200).pre(PEAK, 1500, 0.4).post(LP, 9000).box(COMBO, 0.5, 0.5));
    add("ANALOG HEAT", "A synth bus warmed like an old analog desk: rounder, richer", B(T, 0.35).tone(0.15).high(12000).dyn(-0.15));
    add("GLASS FOLD", "Wavefolder on pads and plucks: glassy overtones", B(FOLD, 0.45).pre(HP, 300).post(LP, 12000, 0.2).mix(0.7));
    add("ARP SHIMMER", "Arpeggios with a folded shimmer on top",
        B(A, 0.25).bands(3, 300, 3000).band(2, FOLD, 12, 0.7));
    add("CHORD STAB", "House chord stabs: snappy, nasal, punchy",
        B(E, 0.45).low(120).pre(BP, 1200, 0.25).env(0.5, 0.2).box(SMALL, 0.5, 0.3).out(2));
    add("DARK PAD", "Pads darkened and thickened, the highs rolled off",
        B(TAPE, 0.3).tone(-0.5).high(4500).dyn(-0.3).morph(0.2, N));
    add("PLUCK SNAP", "Plucks: the attack driven hard, the tail left clean", B(DIODE, 0.4).env(0.9, 0.05).dyn(0.5).low(80));
    add("SINGING FEEDBACK", "Feedback singing at 800 Hz under the lead",
        B(AMP, 0.5).fb(0.5, 800).post(BP, 2000, 0.5).mix(0.7).out(5));

    // ---- VOICE & RADIO ----
    fam = "VOICE & RADIO";
    add("TELEPHONE", "An old telephone line: 350 Hz to 3.4 kHz, a little broken",
        B(E, 0.45).low(350).high(3400).steep().pre(BP, 1200, 0.2).out(4));
    add("MEGAPHONE", "A megaphone: honky, squeezed, shouting", B(P, 0.6).box(RADIO, 0.6, 1).pre(PEAK, 1800, 0.5).low(400));
    add("AM RADIO", "A distant AM station, drifting a little", B(TAPE, 0.3).box(RADIO, 0.5, 1).high(4500).lfo(RANDOM, 3, 0.15, T_TONE).out(3));
    add("WALKIE-TALKIE", "Walkie-talkie: narrow, crushed, clipped",
        B(CRUSH, 0.3).morph(0.4, DIODE).low(500).high(3000).steep().pre(BP, 1800, 0.4).out(7));
    add("VOCAL EDGE", "Vocals pushed forward: a little edge and density, blended", B(A, 0.22).low(80).tone(0.25).dyn(-0.3).mix(0.6));
    add("WHISPER GRIT", "Only the upper voice is driven and tucked under: breath and grit", B(E, 0.35).pre(HP, 1500).mix(0.35).high(12000));
    add("ROBOT VOICE", "Robotic: folded, a ring at 220 Hz, chopped in sixteenths",
        B(FOLD, 0.5).fb(0.4, 220).lfoSync(SQUARE, N1_16, 0.3, T_DRIVE));
    add("DEMON", "Demonic: a rectified octave and fuzz on a dark filter",
        B(RECT, 0.55).morph(0.5, FUZZ).pre(LP, 1500, 0.3).post(LP, 4000).dyn(-0.4).mix(0.8));

    // ---- LO-FI & TEXTURE ----
    fam = "LO-FI & TEXTURE";
    add("CASSETTE", "A worn cassette: soft, dark, wavering", B(TAPE, 0.3).low(40).high(9000).lfo(SINE, 0.6, 0.1, T_TONE).dyn(-0.2));
    add("DUSTY SAMPLER", "A 12-bit sampler: the grain softened by tape", B(CRUSH, 0.25).morph(0.6, TAPE).high(11000).post(LP, 10000));
    add("8-BIT CONSOLE", "Hard bit steps, nothing filtered: an old game console", B(CRUSH, 0.6).pre(HP, 150).out(-3));
    add("BLOWN SPEAKER", "A blown little speaker: buzzing, boxed, narrow", B(FUZZ, 0.6).box(SMALL, 0.3, 1).pre(BP, 900, 0.6).high(5000).out(6));
    add("RINGING ROOM", "A small dark room that rings, behind a triode", B(T, 0.5).fb(0.2, 300).box(STACK, 1, 0.6));
    add("FAX MACHINE", "Data tones: rectified, crushed, narrow", B(RECT, 0.6).morph(0.5, CRUSH).pre(BP, 2500, 0.7).high(5000).steep().mix(0.8).out(7));
    add("PAPER CONE", "A cheap paper-cone amp in the corner", B(AMP, 0.35).box(COMBO, 0.9, 1).tone(-0.1).low(100).high(6000).mix(0.8));
    add("DIRTY DIGITAL", "Digital dirt flickering in sixteenths between clip and bit crush",
        B(DIODE, 0.5).morph(0.6, CRUSH).lfoSync(RANDOM, N1_16, 0.4, T_MORPH).post(LP, 9000));

    // ---- MOTION ----
    fam = "MOTION";
    add("PUMPING TUBE", "A falling saw each beat: the drive pumps like a sidechain", B(A, 0.4).lfoSync(SAW, N1_4, -0.8, T_DRIVE));
    add("FILTER SWEEP", "A resonant low-pass sweeping up and down over one bar", B(E, 0.45).post(LP, 2000, 0.55).lfoSync(TRI, N1BAR, 0.9, T_POST));
    add("GATED DIRT", "The fuzz chops in and out in sixteenths", B(FUZZ, 0.7).mix(0.5).high(8000).lfoSync(SQUARE, N1_16, 0.9, T_MIX));
    add("MORPH CYCLE", "From triode to bit crush and back, over one bar", B(T, 0.5).morph(0.5, CRUSH).lfoSync(TRI, N1BAR, 0.9, T_MORPH));
    add("RANDOM TONE", "The tone jumps to a new place every eighth", B(N, 0.4).lfoSync(RANDOM, N1_8, 0.8, T_TONE));
    add("AUTO WAH", "An auto-wah before the amp, in quarter notes", B(AMP, 0.5).pre(BP, 800, 0.6).lfoSync(SINE, N1_4, 0.8, T_PRE).out(3));
    add("CLEAN UP", "The envelope turned around: loud notes stay clean, the tails fuzz out", B(FUZZ, 1).env(-1, 0.5).post(LP, 7000));
    add("SLOW TIDE", "The saturation rises and falls over four bars, the tone darkening with it",
        B(TAPE, 0.5).tone(-0.3).high(10000).morph(0.2, A).lfoSync(TRI, N4BAR, 0.8, T_DRIVE));

    // ---- DESTRUCTION ----
    fam = "DESTRUCTION";
    add("TOTAL CARNAGE", "Everything at the top: fuzz at +56 dB. Mind your ears", B(FUZZ, 1).punish().post(LP, 6000, 0.3).out(-4));
    add("SPEAKER RIP", "A diode slammed into a tiny speaker", B(DIODE, 0.85).punish().box(SMALL, 0.4, 1).high(4000).steep());
    add("FEEDBACK SCREAM", "Feedback tuned near 1.1 kHz: screaming harmonics", B(E, 0.75).fb(0.95, 1100).pre(HP, 200).high(7000).out(-3));
    add("NOISE WALL", "Bit crush folded on itself: a wall of digital noise", B(CRUSH, 1).morph(0.5, FOLD).post(LP, 8000).out(-6));
    add("FOLD STORM", "Folds that never settle: a random LFO in thirty-seconds",
        B(FOLD, 0.9).morph(0.3, RECT).lfoSync(RANDOM, N1_32, 0.6, T_MORPH));
    add("SHREDDER", "Three bands, three tortures: fuzz, crush and fold",
        B(A, 0.7).bands(3, 200, 2500).band(0, FUZZ, 6).band(1, CRUSH).band(2, FOLD, 6));
    add("INDUSTRIAL", "Industrial grind: rectified, compressed, a metal ring at 120 Hz", B(RECT, 0.8).box(STACK, 0.8, 1).dyn(-0.6).fb(0.3, 120));
    add("BLACK HOLE", "Crushed into the dark: the highs gone, the lows collapsing",
        B(TAPE, 0.9).punish().tone(-1).high(2500).steep().fb(0.6, 55).dyn(-1));
    return v;
}

} // namespace

const std::vector<RagePreset>& factory() {
    static const std::vector<RagePreset> v = build();
    return v;
}

const std::vector<std::string>& families() {
    static const std::vector<std::string> f = [] {
        std::vector<std::string> r;
        for (const auto& p : factory())
            if (r.empty() || r.back() != p.bank) r.push_back(p.bank);
        return r;
    }();
    return f;
}

int initIndex() { return 0; }

bool same(const RagePatch& a, const RagePatch& b) {
    const auto eq = [](double x, double y) { return std::fabs(x - y) < 1.5e-3; };
    if (a.style != b.style || a.punish != b.punish || a.thump != b.thump || a.steep != b.steep || a.autoGain != b.autoGain || a.morphTo != b.morphTo ||
        a.bands != b.bands || a.lfoShape != b.lfoShape || a.lfoSync != b.lfoSync || a.lfoTarget != b.lfoTarget || a.preMode != b.preMode ||
        a.postMode != b.postMode || a.box != b.box)
        return false;
    if (a.lfoSync && a.lfoNote != b.lfoNote) return false;
    if (!a.lfoSync && !eq(a.lfoRate, b.lfoRate)) return false;
    for (size_t i = 0; i < 3; ++i) {
        const auto &x = a.band[i], &y = b.band[i];
        if (x.style != y.style || x.solo != y.solo || x.bypass != y.bypass || !eq(x.drive, y.drive) || !eq(x.mix, y.mix) || !eq(x.level, y.level)) return false;
    }
    return eq(a.drive, b.drive) && eq(a.low, b.low) && eq(a.tone, b.tone) && eq(a.high, b.high) && eq(a.mix, b.mix) && eq(a.out, b.out) &&
           eq(a.morph, b.morph) && eq(a.dyn, b.dyn) && eq(a.fb, b.fb) && eq(a.fbFreq, b.fbFreq) && eq(a.xLo, b.xLo) && eq(a.xHi, b.xHi) &&
           eq(a.envAmt, b.envAmt) && eq(a.envSpeed, b.envSpeed) && eq(a.lfoAmt, b.lfoAmt) && eq(a.preFreq, b.preFreq) && eq(a.preReso, b.preReso) &&
           eq(a.postFreq, b.postFreq) && eq(a.postReso, b.postReso) && eq(a.boxSize, b.boxSize) && eq(a.boxMix, b.boxMix);
}

int match(const RagePatch& p) {
    const auto& b = factory();
    for (size_t i = 0; i < b.size(); ++i)
        if (same(p, b[i].p)) return static_cast<int>(i);
    return -1;
}

double lfoHz(const RagePatch& p, double bpm) {
    if (p.lfoSync) {
        const int i = std::clamp(p.lfoNote, 0, kLfoNotes - 1);
        return std::max(20.0, bpm) / 60.0 / kLfoBeats[i];
    }
    return 0.02 * std::pow(500.0, clamp01(p.lfoRate));
}

mmarp::DecapSettings settingsOf(const RagePatch& p, double bpm) {
    mmarp::DecapSettings s;
    s.mm = false;
    s.style = std::clamp(p.style, 0, kStyles - 1);
    // DRIVE 0 reste en circuit (0 dB) : le DSP ne se contourne jamais, le retard declare a l'hote ne change pas
    s.drive = std::max(1e-6, clamp01(p.drive));
    s.punish = p.punish;
    s.low = clamp01(p.low);
    s.thump = p.thump;
    s.tone = clamp01(p.tone);
    s.high = clamp01(p.high);
    s.steep = p.steep;
    s.mix = clamp01(p.mix);
    s.out = clamp01(p.out);
    s.autoGain = p.autoGain;
    s.ref = kRef;
    s.morph = clamp01(p.morph);
    s.morphTo = std::clamp(p.morphTo, 0, kStyles - 1);
    s.dyn = clamp01(p.dyn);
    s.fb = clamp01(p.fb);
    s.fbFreq = clamp01(p.fbFreq);
    s.bands = std::clamp(p.bands, 1, 3);
    s.xLo = clamp01(p.xLo);
    s.xHi = clamp01(p.xHi);
    for (size_t b = 0; b < 3; ++b) {
        s.band[b].style = std::clamp(p.band[b].style, -1, kStyles - 1);
        s.band[b].drive = clamp01(p.band[b].drive);
        s.band[b].mix = clamp01(p.band[b].mix);
        s.band[b].level = clamp01(p.band[b].level);
        s.band[b].solo = p.band[b].solo;
        s.band[b].bypass = p.band[b].bypass;
    }
    s.envAmt = clamp01(p.envAmt);
    s.envSpeed = clamp01(p.envSpeed);
    s.lfoShape = std::clamp(p.lfoShape, 0, 4);
    s.lfoHz = lfoHz(p, bpm);
    s.lfoAmt = clamp01(p.lfoAmt);
    s.lfoTarget = std::clamp(p.lfoTarget, 0, 5);
    s.preMode = std::clamp(p.preMode, 0, 4);
    s.preFreq = clamp01(p.preFreq);
    s.preReso = clamp01(p.preReso);
    s.postMode = std::clamp(p.postMode, 0, 4);
    s.postFreq = clamp01(p.postFreq);
    s.postReso = clamp01(p.postReso);
    s.box = std::clamp(p.box, 0, 4);
    s.boxSize = clamp01(p.boxSize);
    s.boxMix = clamp01(p.boxMix);
    return s;
}

bool inert(const RagePatch& p, const std::string& id) {
    // disto.ts distoInert, sans le style MM (il n'existe pas ici)
    const bool lfoOn = std::fabs(p.lfoAmt - 0.5) > 0.001;
    if (id.size() == 2 && id[0] == 'b' && id[1] >= '1' && id[1] <= '3') return p.bands == 1 || (id[1] - '0') > p.bands;
    if (id == "xLo") return p.bands < 2;
    if (id == "xHi") return p.bands < 3;
    if (id == "morphTo") return p.morph <= 0 && !(lfoOn && p.lfoTarget == 1);
    if (id == "fbFreq") return p.fb <= 0;
    if (id == "envSpeed") return std::fabs(p.envAmt - 0.5) < 0.001;
    if (id == "lfo") return !lfoOn;
    if (id == "pre") return p.preMode == 0;
    if (id == "post") return p.postMode == 0;
    if (id == "box") return p.box == 0;
    return false;
}

/* ------------------------------------------------------------------ les textes ------------------------------------------------------------------ */

namespace text {

namespace {
std::string fmt(const char* f, double x) {
    char b[48];
    std::snprintf(b, sizeof b, f, x);
    return b;
}
} // namespace

std::string db(double d, int decimals) {
    if (std::fabs(d) < (decimals == 0 ? 0.5 : 0.05)) return decimals == 0 ? "0 DB" : "0.0 DB";
    return fmt(decimals == 0 ? "%+.0f DB" : "%+.1f DB", d);
}

std::string hz(double f) {
    if (f >= 9995) return fmt("%.1f KHZ", f / 1000);
    if (f >= 1000) return fmt("%.2f KHZ", f / 1000);
    if (f >= 100) return fmt("%.0f HZ", f);
    return fmt("%.1f HZ", f);
}

std::string percent(double v) { return fmt("%.0f %%", clamp01(v) * 100); }

std::string drive(double v, bool punish) {
    if (v <= 0) return punish ? "+20.0 DB" : "0.0 DB";
    return fmt("+%.1f DB", D::driveDbOf(clamp01(v), punish));
}

std::string low(double v) {
    const double f = D::lowHzOf(clamp01(v));
    return f <= 0 ? "OFF" : hz(f);
}

std::string high(double v) {
    const double f = D::highHzOf(clamp01(v));
    return f <= 0 ? "OFF" : hz(f);
}

std::string tone(double v) {
    const double t = D::tiltOf(clamp01(v));
    if (std::fabs(t) < 0.005) return "FLAT";
    return (t < 0 ? "DARK " : "BRIGHT ") + fmt("%.0f %%", std::fabs(t) * 100);
}

std::string outDb(double v) { return db(D::outDbOf(clamp01(v))); }

std::string dyn(double v) {
    const double t = (clamp01(v) - 0.5) * 2;
    if (std::fabs(t) < 0.005) return "0";
    return (t < 0 ? "COMP " : "EXPAND ") + fmt("%.0f %%", std::fabs(t) * 100);
}

std::string bipolar(double v) {
    const double t = (clamp01(v) - 0.5) * 2;
    if (std::fabs(t) < 0.005) return "0";
    return fmt("%+.0f %%", t * 100);
}

std::string fbFreq(double v) { return hz(D::fbHzOf(v)); }
std::string xLo(double v) { return hz(D::xLoHzOf(v)); }
std::string xHi(double v) { return hz(D::xHiHzOf(v)); }
std::string filtFreq(double v) { return hz(D::filtHzOf(v)); }
std::string reso(double v) { return fmt("Q %.2f", D::resoQOf(v)); }
std::string bandDrive(double v) { return db(D::bandDbOf(v)); }
std::string level(double v) { return db(D::levelDbOf(v)); }

std::string envSpeed(double v) {
    char b[64];
    std::snprintf(b, sizeof b, "%.0f / %.0f MS", D::envAtkMs(v), D::envRelMs(v));
    return b;
}

std::string lfoRate(double v) {
    const double f = 0.02 * std::pow(500.0, clamp01(v));
    return f < 1 ? fmt("%.2f HZ", f) : fmt("%.1f HZ", f);
}

std::string boxSize(double v) {
    const double oct = (clamp01(v) - 0.5) * 1.2;
    if (std::fabs(oct) < 0.005) return "0 OCT";
    return fmt("%+.2f OCT", oct);
}

} // namespace text

} // namespace mmrage
