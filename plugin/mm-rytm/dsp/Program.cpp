#include "Program.h"

#include <cmath>
#include <cstdio>

namespace mm {

bool shotFromSiteId(const std::string& s, ShotId& out) { return shotFromName(s, out); }

std::string ProgSound::key() const {
    char buf[512];
    std::snprintf(buf, sizeof(buf), "%s|%d|%.6f|%.6f|%.6f|%.6f|%.6f|%d|%.6f|%.6f|%.6f|%.6f|%.6f|%.6f|%.6f|%.6f|%.6f|%d|%.6f|%.6f|%d|",
                  shotName(id), static_cast<int>(tw.model), tw.tune, tw.attack, tw.decay, tw.drive, tw.snappy, tw.gate ? 1 : 0, tw.sweep,
                  tw.sdTune, tw.sdDecay, tw.sdTone, tw.syn, tw.smp.lev, tw.smp.st, tw.smp.start, tw.smp.len, tw.smp.rev ? 1 : 0, ts, pf,
                  variants ? 1 : 0);
    return std::string(buf) + sample;
}

namespace {
double lin(double a, double b, double f) { return a + (b - a) * f; }
// Une grandeur > 0 a loi exponentielle (coupure, Q, constante de temps) : interpolee en logarithme ; sinon lineaire
double logl(double a, double b, double f) { return a > 0 && b > 0 ? a * std::pow(b / a, f) : lin(a, b, f); }
} // namespace

ProgHit blendHit(const ProgHit& a, const ProgHit& b, double f) {
    if (f <= 0) return a;
    if (f >= 1) return b;
    // Le plus proche : le son (sa hauteur, sa recette), le type de filtre, les drapeaux et le trig (hors des scenes)
    ProgHit h = f < 0.5 ? a : b;
    // DECAY : -1 (le son entier) d'un cote, la plus proche ; sinon en logarithme
    h.tau = a.tau > 0 && b.tau > 0 ? logl(a.tau, b.tau, f) : (f < 0.5 ? a.tau : b.tau);
    h.atk = lin(a.atk, b.atk, f);
    h.hold = lin(a.hold, b.hold, f);
    h.gain = lin(a.gain, b.gain, f);
    h.pan = lin(a.pan, b.pan, f);
    h.start = lin(a.start, b.start, f);
    if (a.ft == b.ft) {
        h.fhz = logl(a.fhz, b.fhz, f);
        h.fq = logl(a.fq, b.fq, f);
        h.foct = lin(a.foct, b.foct, f);
        h.fatk = lin(a.fatk, b.fatk, f);
        h.ftau = logl(a.ftau, b.ftau, f);
    }
    if (a.hasSl && b.hasSl) h.sl = blendSlice(a.sl, b.sl, f);
    h.lbLevel = lin(a.lbLevel, b.lbLevel, f);
    h.lbReso = lin(a.lbReso, b.lbReso, f);
    h.lbDecay = lin(a.lbDecay, b.lbDecay, f);
    h.lc = logl(a.lc, b.lc, f);
    return h;
}

SliceFx blendSlice(const SliceFx& a, const SliceFx& b, double f) {
    return {lin(a.tone, b.tone, f), lin(a.dist, b.dist, f), lin(a.chorus, b.chorus, f), lin(a.delay, b.delay, f), lin(a.reverb, b.reverb, f)};
}

GlobalFx blendFx(const GlobalFx& a, const GlobalFx& b, double f) {
    GlobalFx g = f < 0.5 ? a : b;
    g.drive = lin(a.drive, b.drive, f);
    g.reverb = lin(a.reverb, b.reverb, f);
    g.delay = lin(a.delay, b.delay, f);
    g.chorus = lin(a.chorus, b.chorus, f);
    g.dtime = lin(a.dtime, b.dtime, f);
    g.dfb = lin(a.dfb, b.dfb, f);
    g.bits = lin(a.bits, b.bits, f);
    g.comp = lin(a.comp, b.comp, f);
    g.dtone = lin(a.dtone, b.dtone, f);
    g.xtone = lin(a.xtone, b.xtone, f);
    g.crate = lin(a.crate, b.crate, f);
    g.cdepth = lin(a.cdepth, b.cdepth, f);
    g.brate = lin(a.brate, b.brate, f);
    g.catk = lin(a.catk, b.catk, f);
    g.crel = lin(a.crel, b.crel, f);
    g.cthr = lin(a.cthr, b.cthr, f);
    g.cratio = lin(a.cratio, b.cratio, f);
    g.cknee = lin(a.cknee, b.cknee, f);
    g.cmake = lin(a.cmake, b.cmake, f);
    g.chpf = lin(a.chpf, b.chpf, f);
    g.tone = lin(a.tone, b.tone, f);
    g.level = lin(a.level, b.level, f);
    // La forme de la REVERB (rsize, rtone, rpre) : la reponse de la position la plus proche (calculee a part)
    return g;
}

} // namespace mm
