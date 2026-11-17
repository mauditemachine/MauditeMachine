// Le banc de la v27 (2026-11-17) du plugin MM-ARP : la page DELAY (dsp/Echo.h autour des deux coeurs du site, dans
// dsp/ArpFx.cpp), l'EQ parametrique 6 bandes et son analyseur (dsp/ParamEq.h), le rack enrichi (PHASER, FLANGER,
// CHORUS, CRUSH, PUMP). Sans aucun son : des tableaux.
//   - la chaine d'avant (reglages d'avant la v27 seulement) : les empreintes prises sur le code d'avant, au bit pres ;
//   - l'ancien DELAY converti (la regle de PluginProcessor::convertDelay) = l'ancien DELAY, au bit pres ;
//   - chaque reglage neuf a son neutre : la sortie d'avant au bit pres ; MIX 0 : au bit pres sans DELAY ;
//   - DELAY : le temps exact (ms et SYNC), PING-PONG, RHYTHM, DUCKING, la reinjection au maximum stable, chaque style
//     et chaque mode finis, blocs de 512 contre 77 et 1 au bit pres, pas de NaN ni de sous-normaux ;
//   - EQ : la reponse mesuree de chaque type (sinus), les pentes 12 / 24 / 48, OUTPUT, neutre au bit pres, blocs ;
//   - le cout (--cpu : aussi le detail).
//   ./mmarp_echo_test    tous les controles ; code de sortie 1 au premier echec
#include <algorithm>
#include <chrono>
#include <cstdarg>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <functional>
#include <string>
#include <vector>

#include "../dsp/ArpFx.h"
#include "../dsp/Echo.h"
#include "../dsp/ParamEq.h"

namespace {

using namespace mmarp;
using Buf = std::vector<float>;
constexpr double SR = 48000;
constexpr double PI = 3.14159265358979323846;
int failures = 0, checks = 0;

void check(bool ok, const std::string& what) {
    ++checks;
    if (!ok) ++failures;
    std::printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
}

uint64_t fnv(const Buf& a, uint64_t h = 1469598103934665603ull) {
    for (float f : a) {
        uint32_t u;
        std::memcpy(&u, &f, 4);
        for (int i = 0; i < 4; ++i) {
            h ^= (u >> (8 * i)) & 255u;
            h *= 1099511628211ull;
        }
    }
    return h;
}

// l'entree des empreintes : des salves (sinus et bruit) de 120 ms toutes les 500 ms
void bursts(int N, Buf& inL, Buf& inR) {
    inL.assign(static_cast<size_t>(N), 0.f);
    inR.assign(static_cast<size_t>(N), 0.f);
    uint32_t r = 1234567;
    for (int i = 0; i < N; ++i) {
        const double t = i / SR;
        const double env = std::fmod(t, 0.5) < 0.12 ? 1 : 0;
        r = r * 1664525u + 1013904223u;
        const double nz = ((r >> 8) * (1.0 / 16777216.0)) * 2 - 1;
        inL[static_cast<size_t>(i)] = static_cast<float>(env * (0.3 * std::sin(2 * M_PI * 220 * t) + 0.1 * nz));
        inR[static_cast<size_t>(i)] = static_cast<float>(env * (0.3 * std::sin(2 * M_PI * 330 * t) + 0.1 * nz));
    }
}

struct Out {
    Buf L, R;
    bool finite = true;
    int subnormal = 0;
    double peak = 0;
};

Out render(const ArpFxSettings& s, const Buf& inL, const Buf& inR, int block = 512, std::function<void(ArpFx&, int)> during = nullptr) {
    ArpFx fx;
    fx.prepare(SR, 512);
    fx.set(s, true);
    fx.setTransport(0, 120.0 / 60 / SR, true);
    const int N = static_cast<int>(inL.size());
    Out o;
    o.L.assign(static_cast<size_t>(N), 0.f);
    o.R.assign(static_cast<size_t>(N), 0.f);
    for (int i = 0; i < N; i += block) {
        if (during) during(fx, i);
        const int n = std::min(block, N - i);
        fx.process(inL.data() + i, inR.data() + i, o.L.data() + i, o.R.data() + i, n);
    }
    for (int i = 0; i < N; ++i)
        for (float v : {o.L[static_cast<size_t>(i)], o.R[static_cast<size_t>(i)]}) {
            if (!std::isfinite(v)) o.finite = false;
            if (std::fpclassify(v) == FP_SUBNORMAL) ++o.subnormal;
            o.peak = std::max(o.peak, static_cast<double>(std::fabs(v)));
        }
    return o;
}

uint64_t hashOf(const Out& o) { return fnv(o.R, fnv(o.L)); }

double maxDiff(const Out& a, const Out& b) {
    double d = 0;
    for (size_t i = 0; i < a.L.size() && i < b.L.size(); ++i) d = std::max({d, static_cast<double>(std::fabs(a.L[i] - b.L[i])), static_cast<double>(std::fabs(a.R[i] - b.R[i]))});
    return d;
}

double rms(const Buf& a, int from, int to) {
    double s = 0;
    for (int i = from; i < to; ++i) s += static_cast<double>(a[static_cast<size_t>(i)]) * a[static_cast<size_t>(i)];
    return std::sqrt(s / std::max(1, to - from));
}

std::string fmt(const char* f, ...) __attribute__((format(printf, 1, 2)));
std::string fmt(const char* f, ...) {
    char b[512];
    va_list a;
    va_start(a, f);
    std::vsnprintf(b, sizeof b, f, a);
    va_end(a);
    return b;
}

// la regle de PluginProcessor::convertDelay, appliquee a des reglages de la chaine
ArpFxSettings converted(ArpFxSettings s) {
    EchoSettings e;
    if (s.tape > 0) {
        e.style = ES_TAPE;
        e.wobble = s.tape;
        e.mode = EM_PINGPONG;
    } else {
        e.style = ES_DIGITAL;
        e.wobble = 0;
        e.mode = s.dlyMode == 1 ? EM_DUAL : s.dlyMode == 2 ? EM_WIDE : EM_PINGPONG;
    }
    e.fb = static_cast<double>(static_cast<float>(0.35 + (0.68 - 0.35) * s.delay)); // un parametre de l'hote : un float
    s.echo = e;
    s.tape = 0;
    s.dlyMode = 0;
    return s;
}

// des reglages de la page qui touchent a tout
EchoSettings busy(int style, int mode) {
    EchoSettings e;
    e.style = style;
    e.mode = mode;
    e.fb = 0.7;
    e.width = 0.7;
    e.offset = 0.62;
    e.sat = 0.4;
    e.wobble = 0.5;
    e.diff = 0.4;
    e.low = 0.6;
    e.high = 0.4;
    e.groove = 0.3;
    e.feel = 0.6;
    e.analog = 0.5;
    e.duck = 0.5;
    e.duckRel = 0.4;
    e.prime = true;
    e.lofi = true;
    e.rhythm = 3;
    return e;
}

const char* kStyles[ES_COUNT] = {"TAPE", "ANALOG", "DIGITAL", "SPACE", "LO-FI", "DUB", "CASSETTE", "CRYSTAL"};
const char* kModes[EM_COUNT] = {"SINGLE", "DUAL", "PING-PONG", "WIDE", "RHYTHM"};

// sinus a travers l'EQ seul : le gain mesure (dB) a f, apres l'etablissement
double eqGainDb(const EqBandSettings* b, double outDb, double f) {
    ParamEq q;
    q.prepare(SR);
    q.set(b, outDb, true);
    const int N = 48000;
    Buf L(N), R(N);
    for (int i = 0; i < N; ++i) L[static_cast<size_t>(i)] = R[static_cast<size_t>(i)] = static_cast<float>(0.25 * std::sin(2 * PI * f * i / SR));
    const double in = rms(L, N / 2, N);
    q.process(L.data(), R.data(), N);
    return 20 * std::log10(rms(L, N / 2, N) / in);
}

} // namespace

int main(int argc, char** argv) {
    const bool cpu = argc > 1 && std::strcmp(argv[1], "--cpu") == 0;
    Buf inL, inR;
    bursts(48000 * 3, inL, inR);

    /* ---------------- 1. la chaine d'avant : les empreintes du code d'avant la v27 ---------------- */
    {
        struct G {
            const char* name;
            void (*f)(ArpFxSettings&);
            uint64_t h;
        };
        const G gold[] = {
            {"tape-def", [](ArpFxSettings& s) { s.delay = 0.25; s.tape = 0.3; s.delaySeconds = 0.375; s.chorus = 1; }, 0x35458945feb40e64ull},
            {"pp", [](ArpFxSettings& s) { s.delay = 0.45; s.tape = 0; s.delaySeconds = 0.25; }, 0x5d2d4e9dd6ead9a4ull},
            {"stereo", [](ArpFxSettings& s) { s.delay = 0.55; s.tape = 0; s.dlyMode = 1; s.delaySeconds = 0.5; s.chorus = 2; }, 0x0f0927b66f76d042ull},
            {"wide", [](ArpFxSettings& s) { s.delay = 0.3; s.tape = 0; s.dlyMode = 2; s.delaySeconds = 0.375; }, 0x4738981b944d9e7bull},
            {"tape-full", [](ArpFxSettings& s) { s.delay = 0.6; s.tape = 1; s.delaySeconds = 0.75; s.reverb = 0.3; }, 0x32adadc2bec03ea3ull},
            {"phaser", [](ArpFxSettings& s) { s.phMix = 0.7; s.phRate = 0.4; s.phDepth = 0.8; s.phFb = 0.6; }, 0x9313154fd8c22b25ull},
            {"flanger", [](ArpFxSettings& s) { s.flMix = 0.6; s.flRate = 0.3; s.flDepth = 0.7; s.flFb = 0.5; }, 0x3ca2927b9390c4ebull},
            {"crush", [](ArpFxSettings& s) { s.crushBits = 0.5; s.crushRate = 0.4; }, 0x5c07d7fa24be51b8ull},
            {"pump", [](ArpFxSettings& s) { s.pumpDepth = 0.8; s.pumpRate = 1; s.pumpShape = 0.3; }, 0xb1721d489f8b7afeull},
            {"chorus2", [](ArpFxSettings& s) { s.chorus = 2; s.delay = 0; }, 0xe71a9364afd5c421ull},
            {"all", [](ArpFxSettings& s) { s.chorus = 1; s.delay = 0.4; s.tape = 0.5; s.reverb = 0.2; s.phMix = 0.4; s.flMix = 0.3; s.flFb = -0.4; s.crushBits = 0.2; s.pumpDepth = 0.5; s.eqLow = 0.7; s.eqAir = 0.6; }, 0xb2d2bbecae346769ull},
        };
        int same = 0;
        std::string bad;
        for (const G& g : gold) {
            ArpFxSettings s;
            s.volume = 0.8;
            g.f(s);
            const uint64_t h = hashOf(render(s, inL, inR));
            if (h == g.h) ++same;
            else bad += fmt(" %s=0x%016llx", g.name, static_cast<unsigned long long>(h));
        }
        check(same == 11, fmt("la chaine d'avant (DELAY du site, bande, STEREO, WIDE, PHASER, FLANGER, CRUSH, PUMP, CHORUS, EQ 4 bandes) : %d / 11 empreintes du code d'avant au bit pres", same) + bad);
    }

    /* ---------------- 2. l'ancien DELAY converti = l'ancien DELAY ---------------- */
    {
        int n = 0, exact = 0;
        double worst = 0;
        for (double tape : {0.0, 0.3, 0.65, 1.0})
            for (int mode : {0, 1, 2})
                for (double delay : {0.25, 0.55})
                    for (double t : {0.25, 0.375, 0.75}) {
                        ArpFxSettings s;
                        s.volume = 0.8;
                        s.delay = delay;
                        s.tape = tape;
                        s.dlyMode = mode;
                        s.delaySeconds = t;
                        s.chorus = mode;
                        const Out a = render(s, inL, inR), b = render(converted(s), inL, inR);
                        const double d = maxDiff(a, b);
                        worst = std::max(worst, d);
                        ++n;
                        if (d <= 0) ++exact;
                    }
        check(exact == n, fmt("l'ancien DELAY converti (TAPE 0 / 0.3 / 0.65 / 1, PING PONG / STEREO / WIDE, DELAY 0.25 / 0.55, 3 temps) : %d / %d au bit pres (ecart max %.3g)", exact, n, worst));
    }

    /* ---------------- 3. le neutre de chaque reglage neuf ---------------- */
    {
        // la page DELAY au depart (TAPE, WOBBLE 0.3, PING-PONG ...) = le DELAY du site par defaut
        ArpFxSettings s;
        s.volume = 0.8;
        s.delay = 0.25;
        s.tape = 0.3;
        s.delaySeconds = 0.375;
        ArpFxSettings n = s;
        n.tape = 0;
        n.echo = EchoSettings();
        n.echo.style = ES_TAPE;
        n.echo.fb = static_cast<double>(static_cast<float>(0.35 + (0.68 - 0.35) * 0.25));
        check(maxDiff(render(s, inL, inR), render(n, inL, inR)) <= 0, "la page DELAY a son depart (TAPE, WOBBLE 0.3, PING-PONG, 1/8., FEEDBACK du site) = le DELAY du site par defaut, au bit pres");
        // chaque reglage du rack enrichi a son neutre : les empreintes d'avant (au-dessus) ; ici, bouge, il change le son
        struct R {
            const char* name;
            void (*f)(ArpFxSettings&);
        };
        const R moves[] = {
            {"PHASER STAGES 12", [](ArpFxSettings& s) { s.phMix = 0.7; s.phStages = 12; }},
            {"PHASER CENTER", [](ArpFxSettings& s) { s.phMix = 0.7; s.phCenter = 0.8; }},
            {"PHASER SPREAD", [](ArpFxSettings& s) { s.phMix = 0.7; s.phSpread = 1; }},
            {"PHASER SYNC", [](ArpFxSettings& s) { s.phMix = 0.7; s.phSyncHz = 2; }},
            {"FLANGER DELAY", [](ArpFxSettings& s) { s.flMix = 0.6; s.flDelay = 0.8; }},
            {"FLANGER SPREAD", [](ArpFxSettings& s) { s.flMix = 0.6; s.flSpread = 0; }},
            {"FLANGER SYNC", [](ArpFxSettings& s) { s.flMix = 0.6; s.flSyncHz = 1; }},
            {"FLANGER THRU-0 OFF", [](ArpFxSettings& s) { s.flMix = 0.6; s.flThru = false; }},
            {"CHORUS I+II", [](ArpFxSettings& s) { s.chorus = 1; s.chBoth = true; }},
            {"CHORUS RATE", [](ArpFxSettings& s) { s.chorus = 1; s.chRate = 0.8; }},
            {"CHORUS DEPTH", [](ArpFxSettings& s) { s.chorus = 1; s.chDepth = 0.9; }},
            {"CHORUS WIDTH", [](ArpFxSettings& s) { s.chorus = 1; s.chWidth = 0.3; }},
            {"CHORUS MIX", [](ArpFxSettings& s) { s.chorus = 1; s.chMix = 0.9; }},
            {"CRUSH TONE", [](ArpFxSettings& s) { s.crushBits = 0.5; s.crTone = 0.3; }},
            {"CRUSH MIX", [](ArpFxSettings& s) { s.crushBits = 0.5; s.crMix = 0.4; }},
            {"PUMP ATTACK", [](ArpFxSettings& s) { s.pumpDepth = 0.8; s.puAttack = 0.9; }},
            {"PUMP CURVE", [](ArpFxSettings& s) { s.pumpDepth = 0.8; s.puCurve = 0.1; }},
        };
        int moved = 0, fin = 0;
        std::string still;
        for (const R& m : moves) {
            ArpFxSettings a;
            a.volume = 0.8;
            ArpFxSettings b = a;
            m.f(b);
            // la meme section engagee, son reglage neuf a son neutre
            ArpFxSettings c = b;
            const ArpFxSettings d0;
            c.phStages = d0.phStages;
            c.phCenter = d0.phCenter;
            c.phSpread = d0.phSpread;
            c.phSyncHz = d0.phSyncHz;
            c.flDelay = d0.flDelay;
            c.flSpread = d0.flSpread;
            c.flSyncHz = d0.flSyncHz;
            c.flThru = d0.flThru;
            c.chBoth = d0.chBoth;
            c.chRate = d0.chRate;
            c.chDepth = d0.chDepth;
            c.chWidth = d0.chWidth;
            c.chMix = d0.chMix;
            c.crTone = d0.crTone;
            c.crMix = d0.crMix;
            c.puAttack = d0.puAttack;
            c.puCurve = d0.puCurve;
            const Out ob = render(b, inL, inR), oc = render(c, inL, inR);
            if (maxDiff(ob, oc) > 1e-4) ++moved;
            else still += std::string(" ") + m.name;
            if (ob.finite && ob.subnormal == 0 && ob.peak < 4) ++fin;
        }
        check(moved == 17 && fin == 17, fmt("le rack enrichi : %d / 17 reglages neufs changent le son quand ils bougent, %d / 17 finis sans sous-normaux", moved, fin) + still);
    }

    /* ---------------- 4. MIX 0 au bit pres, tous les styles et modes ---------------- */
    {
        ArpFxSettings off;
        off.volume = 0.8;
        off.delay = 0;
        off.reverb = 0.2;
        off.delaySeconds = 0.3;
        const Out ref = render(off, inL, inR);
        int exact = 0, n = 0;
        for (int st = 0; st < ES_COUNT; ++st)
            for (int m = 0; m < EM_COUNT; ++m) {
                ArpFxSettings s = off;
                s.echo = busy(st, m);
                ++n;
                if (maxDiff(render(s, inL, inR), ref) <= 0) ++exact;
            }
        check(exact == n, fmt("MIX 0 (DELAY a zero) : %d / %d styles x modes, tout le reste engage, au bit pres sans DELAY", exact, n));
    }

    /* ---------------- 5. le temps exact ---------------- */
    {
        // une impulsion ; DIGITAL SINGLE, sans reinjection : le premier echo commence exactement au temps
        const auto firstEcho = [](double seconds, int style, int mode) {
            const int N = 48000 * 3;
            Buf L(N, 0.f), R(N, 0.f);
            L[1000] = R[1000] = 1.f;
            ArpFxSettings s;
            s.volume = 0.8;
            s.delay = 1;
            s.delaySeconds = seconds;
            s.monoLowHz = 0;
            s.echo.style = style;
            s.echo.mode = mode;
            s.echo.fb = 0;
            s.echo.wobble = 0;
            const Out o = render(s, L, R);
            // le sec (et la longue traine du bas de BASS MONO) s'annule avec le meme rendu a un autre temps : reste l'echo,
            // le premier echantillon au-dessus de 1 % de sa crete
            ArpFxSettings far = s;
            far.delaySeconds = seconds + 0.5;
            const Out f = render(far, L, R);
            double pk = 0;
            for (int i = 0; i < N; ++i) pk = std::max(pk, static_cast<double>(std::fabs(o.L[static_cast<size_t>(i)] - f.L[static_cast<size_t>(i)]) + std::fabs(o.R[static_cast<size_t>(i)] - f.R[static_cast<size_t>(i)])));
            for (int i = 0; i < N; ++i)
                if (std::fabs(o.L[static_cast<size_t>(i)] - f.L[static_cast<size_t>(i)]) + std::fabs(o.R[static_cast<size_t>(i)] - f.R[static_cast<size_t>(i)]) > 0.01 * pk) return i - 1000;
            return -1;
        };
        const double ms375 = EchoLaws::msOf(std::log(75.0) / std::log(400.0)) / 1000;
        const double sync = EchoLaws::divSixteenths(2) * EchoLaws::noteMul(1) * 60.0 / 120 / 4;  // 1/8. a 120
        const double trip = EchoLaws::divSixteenths(3) * EchoLaws::noteMul(2) * 60.0 / 100 / 4;  // 1/4 T a 100
        const int a = firstEcho(ms375, ES_DIGITAL, EM_SINGLE), b = firstEcho(sync, ES_DIGITAL, EM_SINGLE), c = firstEcho(trip, ES_DIGITAL, EM_DUAL);
        const int tp = firstEcho(sync, ES_TAPE, EM_PINGPONG);
        check(a == 18000 && b == 18000 && c == 19200 && std::abs(tp - 18000) <= 9,
              fmt("le temps : FREE 375 ms -> %d echantillons (18000), SYNC 1/8. a 120 -> %d (18000), 1/4 T a 100 -> %d (19200) ; la bande %d (son interpolation : 8 points)", a, b, c, tp));
    }

    /* ---------------- 6. PING-PONG, RHYTHM ---------------- */
    {
        const int N = 48000 * 3;
        Buf L(N, 0.f), R(N, 0.f);
        L[1000] = 1.f;
        const auto energy = [](const Out& o, int from, int to, bool left) {
            double e = 0;
            for (int i = from; i < to; ++i) e += std::fabs(left ? o.L[static_cast<size_t>(i)] : o.R[static_cast<size_t>(i)]);
            return e;
        };
        int ok = 0;
        for (int st : {ES_DIGITAL, ES_TAPE}) {
            ArpFxSettings s;
            s.volume = 0.8;
            s.delay = 1;
            s.delaySeconds = 0.25; // 12000
            s.echo.style = st;
            s.echo.mode = EM_PINGPONG;
            s.echo.fb = 0.6;
            s.echo.wobble = 0;
            const Out o = render(s, L, R);
            // echo 1 a gauche (13000), echo 2 a droite (25000, + 128 pour le numerique), echo 3 a gauche
            const bool e1 = energy(o, 12900, 13400, true) > 4 * energy(o, 12900, 13400, false);
            const bool e2 = energy(o, 24900, 25500, false) > 4 * energy(o, 24900, 25500, true);
            const bool e3 = energy(o, 36900, 37600, true) > 4 * energy(o, 36900, 37600, false);
            if (e1 && e2 && e3) ++ok;
        }
        // RHYTHM : MACHINE (prises 1, 3, 5, 8, 9 ... ) au pas de 0.1 s : la prise 2 (vide) se tait, la 3 sonne
        ArpFxSettings s;
        s.volume = 0.8;
        s.delay = 1;
        s.delaySeconds = 0.1; // 4800
        s.echo.style = ES_DIGITAL;
        s.echo.mode = EM_RHYTHM;
        s.echo.fb = 0;
        s.echo.wobble = 0;
        s.echo.rhythm = 0;
        Buf M(N, 0.f);
        M[1000] = 1.f;
        const Out o = render(s, M, M);
        const double t1 = energy(o, 5700, 6300, true), t2 = energy(o, 10500, 11100, true), t3 = energy(o, 15300, 15900, true);
        check(ok == 2 && t1 > 10 * t2 && t3 > 10 * t2, fmt("PING-PONG : gauche, droite, gauche (numerique et bande : %d / 2) ; RHYTHM : la prise vide se tait, ses voisines sonnent", ok));
    }

    /* ---------------- 7. DUCKING ---------------- */
    {
        // un son tenu 1 s puis le silence : pendant le son, les echos baissent ; apres, ils reviennent
        const int N = 48000 * 3;
        Buf L(N, 0.f), R(N, 0.f);
        for (int i = 0; i < 48000; ++i) L[static_cast<size_t>(i)] = R[static_cast<size_t>(i)] = static_cast<float>(0.4 * std::sin(2 * PI * 330 * i / SR));
        ArpFxSettings s;
        s.volume = 0.8;
        s.delay = 0.6;
        s.delaySeconds = 0.25;
        s.echo.style = ES_DIGITAL;
        s.echo.mode = EM_PINGPONG;
        s.echo.fb = 0.6;
        s.echo.wobble = 0;
        ArpFxSettings d = s;
        d.echo.duck = 1;
        d.echo.duckRel = 0.2;
        ArpFxSettings dry = s;
        dry.echo.fb = 0;
        const Out a = render(s, L, R), b = render(d, L, R);
        Buf wa(N), wb(N);
        for (int i = 0; i < N; ++i) {
            wa[static_cast<size_t>(i)] = a.L[static_cast<size_t>(i)];
            wb[static_cast<size_t>(i)] = b.L[static_cast<size_t>(i)];
        }
        // pendant le son : la difference (le mouille enleve) ; apres : les echos des deux
        Buf diff(N);
        for (int i = 0; i < N; ++i) diff[static_cast<size_t>(i)] = wa[static_cast<size_t>(i)] - wb[static_cast<size_t>(i)];
        const double during = rms(diff, 24000, 47000) / rms(wa, 24000, 47000), after = rms(wb, 62000, 90000) / rms(wa, 62000, 90000);
        check(during > 0.15 && after > 0.6, fmt("DUCKING : pendant le son, %.0f %% du niveau retire (les echos) ; apres, les echos reviennent (%.0f %%)", 100 * during, 100 * after));
    }

    /* ---------------- 8. la reinjection au maximum, chaque style, chaque mode ---------------- */
    {
        const int N = 48000 * 10;
        Buf L(N, 0.f), R(N, 0.f);
        uint32_t r = 99;
        for (int i = 0; i < N; ++i) {
            r = r * 1664525u + 1013904223u;
            const double nz = ((r >> 8) * (1.0 / 16777216.0)) * 2 - 1;
            const double env = std::fmod(i / SR, 1.0) < 0.3 ? 0.9 : 0;
            L[static_cast<size_t>(i)] = static_cast<float>(env * nz);
            R[static_cast<size_t>(i)] = static_cast<float>(env * (i % 200 < 100 ? 0.8 : -0.8));
        }
        int ok = 0, n = 0;
        double worst = 0, growth = 0;
        std::string bad;
        for (int st = 0; st < ES_COUNT; ++st)
            for (int m = 0; m < EM_COUNT; ++m) {
                ArpFxSettings s;
                s.volume = 1;
                s.delay = 1;
                s.delaySeconds = 0.21;
                s.echo = busy(st, m);
                s.echo.fb = 1;
                s.echo.duck = 0;
                const Out o = render(s, L, R);
                const double g = rms(o.L, 8 * 48000, 10 * 48000) / std::max(1e-9, rms(o.L, 4 * 48000, 6 * 48000));
                worst = std::max(worst, o.peak);
                growth = std::max(growth, g);
                ++n;
                if (o.finite && o.subnormal == 0 && o.peak < 8 && g < 1.6) ++ok;
                else bad += fmt(" %s/%s(%.2f,%.2f)", kStyles[st], kModes[m], o.peak, g);
            }
        check(ok == n, fmt("FEEDBACK 100 %% sur 10 s, bruit a 0.9 : %d / %d styles x modes finis et bornes (crete max %.2f, croissance max x%.2f), sans sous-normaux", ok, n, worst, growth) + bad);
    }

    /* ---------------- 9. tous les styles et modes : finis, blocs au bit pres ---------------- */
    {
        int fin = 0, blocks = 0, n = 0;
        std::string bad;
        for (int st = 0; st < ES_COUNT; ++st)
            for (int m = 0; m < EM_COUNT; ++m) {
                ArpFxSettings s;
                s.volume = 0.8;
                s.delay = 0.5;
                s.reverb = 0.2;
                s.delaySeconds = 0.3;
                s.chorus = 1;
                s.phMix = 0.3;
                s.phStages = 8;
                s.echo = busy(st, m);
                const Out a = render(s, inL, inR, 512), b = render(s, inL, inR, 77);
                ++n;
                if (a.finite && a.subnormal == 0 && a.peak < 4) ++fin;
                if (maxDiff(a, b) <= 0) ++blocks;
                else bad += fmt(" %s/%s", kStyles[st], kModes[m]);
            }
        // et un changement de reglages en jeu (style, mode, temps), par blocs de 1 contre 512
        ArpFxSettings s;
        s.volume = 0.8;
        s.delay = 0.5;
        s.delaySeconds = 0.3;
        s.echo = busy(ES_TAPE, EM_PINGPONG);
        const auto move = [&](ArpFx& fx, int i) {
            ArpFxSettings t = s;
            if (i >= 48000) t.echo = busy(ES_CRYSTAL, EM_DUAL);
            if (i >= 72000) t.echo = busy(ES_SPACE, EM_SINGLE);
            if (i >= 96000) {
                t.echo = busy(ES_DIGITAL, EM_RHYTHM);
                t.delaySeconds = 0.12;
            }
            if (i % 24000 == 0) fx.set(t, false);
        };
        const Out c = render(s, inL, inR, 512, move), d = render(s, inL, inR, 1, [&](ArpFx& fx, int i) { if (i % 512 == 0) move(fx, i); });
        check(fin == n && blocks == n && maxDiff(c, d) <= 0 && c.finite,
              fmt("chaque style x mode, tout engage : %d / %d finis, %d / %d blocs de 512 contre 77 au bit pres ; des changements en jeu, blocs de 1 contre 512 : au bit pres", fin, n, blocks, n) + bad);
    }

    /* ---------------- 10. l'EQ parametrique ---------------- */
    {
        EqBandSettings b[6];
        // neutre : bandes a 0 dB allumees, HP et LP eteintes, OUTPUT 0 dB
        b[0] = {false, ParamEq::T_HP, 30, 0, 0.71, 0};
        b[1] = {true, ParamEq::T_LOWSHELF, 100, 0, 0.71, 0};
        b[2] = {true, ParamEq::T_BELL, 400, 0, 0.71, 0};
        b[3] = {true, ParamEq::T_BELL, 2500, 0, 0.71, 0};
        b[4] = {true, ParamEq::T_HIGHSHELF, 8000, 0, 0.71, 0};
        b[5] = {false, ParamEq::T_LP, 18000, 0, 0.71, 0};
        {
            ParamEq q;
            q.prepare(SR);
            q.set(b, 0, true);
            Buf L = inL, R = inR;
            q.process(L.data(), R.data(), static_cast<int>(L.size()));
            check(L == inL && R == inR && q.bypassed(), "EQ au neutre (HP et LP eteintes, les autres a 0 dB, OUTPUT 0 dB) : contourne, au bit pres");
        }
        const auto one = [&](EqBandSettings x, double f) {
            EqBandSettings c[6];
            c[0] = x;
            return eqGainDb(c, 0, f);
        };
        const double bell = one({true, ParamEq::T_BELL, 1000, 12, 1, 0}, 1000), bellLo = one({true, ParamEq::T_BELL, 1000, 12, 1, 0}, 100), bellHi = one({true, ParamEq::T_BELL, 1000, 12, 1, 0}, 10000);
        const double ls = one({true, ParamEq::T_LOWSHELF, 200, 6, 0.71, 0}, 30), lsMid = one({true, ParamEq::T_LOWSHELF, 200, 6, 0.71, 0}, 200), lsHi = one({true, ParamEq::T_LOWSHELF, 200, 6, 0.71, 0}, 5000);
        const double hs = one({true, ParamEq::T_HIGHSHELF, 4000, -6, 0.71, 0}, 15000), hsLo = one({true, ParamEq::T_HIGHSHELF, 4000, -6, 0.71, 0}, 100);
        const double nt = one({true, ParamEq::T_NOTCH, 1000, 0, 2, 0}, 1000), ntOff = one({true, ParamEq::T_NOTCH, 1000, 0, 2, 0}, 3000);
        check(std::fabs(bell - 12) < 0.2 && std::fabs(bellLo) < 0.5 && std::fabs(bellHi) < 0.5, fmt("EQ BELL +12 dB a 1 kHz : %.2f dB au centre, %.2f a 100 Hz, %.2f a 10 kHz", bell, bellLo, bellHi));
        check(std::fabs(ls - 6) < 0.3 && std::fabs(lsMid - 3) < 0.6 && std::fabs(lsHi) < 0.3, fmt("EQ LOW SHELF +6 dB a 200 Hz : %.2f dB a 30 Hz, %.2f a 200 Hz, %.2f a 5 kHz", ls, lsMid, lsHi));
        check(std::fabs(hs + 6) < 0.4 && std::fabs(hsLo) < 0.3, fmt("EQ HIGH SHELF -6 dB a 4 kHz : %.2f dB a 15 kHz, %.2f a 100 Hz", hs, hsLo));
        check(nt < -30 && ntOff > -3, fmt("EQ NOTCH a 1 kHz Q 2 : %.1f dB au centre, %.2f a 3 kHz", nt, ntOff));
        std::string sl;
        bool slopes = true;
        for (int k = 0; k < 3; ++k) {
            const double want = 12.0 * (1 << k);
            const double hpC = one({true, ParamEq::T_HP, 1000, 0, 0.7071, k}, 1000), hpO = one({true, ParamEq::T_HP, 1000, 0, 0.7071, k}, 250);
            const double lpC = one({true, ParamEq::T_LP, 1000, 0, 0.7071, k}, 1000), lpO = one({true, ParamEq::T_LP, 1000, 0, 0.7071, k}, 4000);
            // deux octaves de la coupure : -2 x pente (a 1 dB pres, plus pour 48 : la coupure en bilineaire)
            slopes = slopes && std::fabs(hpC + 3) < 0.3 && std::fabs(lpC + 3) < 0.3 && std::fabs(hpO + 2 * want) < 1.5 + k && std::fabs(lpO + 2 * want) < 1.5 + k;
            sl += fmt(" %d : HP %.1f / %.1f, LP %.1f / %.1f ;", static_cast<int>(want), hpC, hpO, lpC, lpO);
        }
        check(slopes, "EQ HP et LP 12 / 24 / 48 dB par octave, a 1 kHz : -3 dB a la coupure, -2 x pente deux octaves plus loin." + sl);
        const double outG = eqGainDb(b, 6, 1000);
        check(std::fabs(outG - 6) < 0.01, fmt("EQ OUTPUT +6 dB : %.3f dB", outG));
        // les blocs, un reglage en jeu, pas de sous-normaux
        EqBandSettings all[6] = {{true, ParamEq::T_HP, 40, 0, 0.9, 2}, {true, ParamEq::T_LOWSHELF, 120, 4, 0.7, 0}, {true, ParamEq::T_BELL, 500, -6, 2, 0},
                                 {true, ParamEq::T_NOTCH, 3000, 0, 4, 0}, {true, ParamEq::T_HIGHSHELF, 9000, 5, 0.7, 0}, {true, ParamEq::T_LP, 15000, 0, 1.2, 2}};
        const auto run = [&](int block) {
            ParamEq q;
            q.prepare(SR);
            q.set(all, 2, true);
            Buf L = inL, R = inR;
            L.resize(L.size() + 96000, 0.f);
            R.resize(R.size() + 96000, 0.f);
            const int N = static_cast<int>(L.size());
            for (int i = 0; i < N;) {
                if (i == 48000) {
                    EqBandSettings t[6];
                    std::copy(all, all + 6, t);
                    t[2].db = 9;
                    t[2].hz = 1500;
                    t[0].on = false;
                    q.set(t, 0, false);
                }
                const int n = std::min(block, (i < 48000 ? 48000 : N) - i);
                q.process(L.data() + i, R.data() + i, n);
                i += n;
            }
            Out o;
            o.L = L;
            o.R = R;
            for (float v : L) {
                if (!std::isfinite(v)) o.finite = false;
                if (std::fpclassify(v) == FP_SUBNORMAL) ++o.subnormal;
            }
            return o;
        };
        const Out a = run(512), c = run(37);
        check(maxDiff(a, c) <= 0 && a.finite && a.subnormal == 0, "EQ six bandes engagees, un reglage change en jeu : blocs de 512 contre 37 au bit pres, fini, sans sous-normaux apres le silence");
        // l'analyseur : un sinus pleine echelle a 1 kHz -> 0 dB dans sa bande
        SpecAnalyzer an;
        an.prepare(SR);
        Buf L(8192), R(8192);
        for (int i = 0; i < 8192; ++i) L[static_cast<size_t>(i)] = R[static_cast<size_t>(i)] = static_cast<float>(std::sin(2 * PI * 1000 * i / SR));
        an.push(L.data(), R.data(), 8192);
        float db[SpecAnalyzer::kBins];
        an.frame(db);
        int top = 0;
        for (int j = 1; j < SpecAnalyzer::kBins; ++j)
            if (db[j] > db[top]) top = j;
        const double fTop = 20 * std::pow(1000.0, (top + 0.5) / SpecAnalyzer::kBins);
        check(std::fabs(db[top]) < 1 && fTop > 900 && fTop < 1100, fmt("ANALYZER : un sinus de 1 kHz a 0 dBFS -> %.2f dB dans la bande de %.0f Hz", db[top], fTop));
    }

    /* ---------------- 11. le cout ---------------- */
    {
        const int N = 48000 * 10;
        Buf L(N), R(N);
        for (int i = 0; i < N; ++i) {
            L[static_cast<size_t>(i)] = inL[static_cast<size_t>(i % inL.size())];
            R[static_cast<size_t>(i)] = inR[static_cast<size_t>(i % inR.size())];
        }
        const auto msPerS = [&](const ArpFxSettings& s) {
            ArpFx fx;
            fx.prepare(SR, 512);
            fx.set(s, true);
            Buf oL(512), oR(512);
            const auto t0 = std::chrono::steady_clock::now();
            for (int i = 0; i < N; i += 512) fx.process(L.data() + i, R.data() + i, oL.data(), oR.data(), std::min(512, N - i));
            return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count() / 10;
        };
        ArpFxSettings base;
        base.volume = 0.8;
        base.delay = 0;
        const double b0 = msPerS(base);
        ArpFxSettings site = base;
        site.delay = 0.4;
        site.tape = 0.3;
        const double bSite = msPerS(site) - b0;
        double worst = 0;
        std::string detail;
        for (int st = 0; st < ES_COUNT; ++st)
            for (int m : {EM_PINGPONG, EM_DUAL, EM_RHYTHM}) {
                ArpFxSettings s = base;
                s.delay = 0.5;
                s.echo = busy(st, m);
                const double c = msPerS(s) - b0;
                worst = std::max(worst, c);
                if (cpu) detail += fmt("\n       %s %s : %.1f ms/s", kStyles[st], kModes[m], c);
            }
        // l'EQ : six bandes, HP et LP a 48 dB
        EqBandSettings all[6] = {{true, ParamEq::T_HP, 40, 0, 0.9, 2}, {true, ParamEq::T_LOWSHELF, 120, 4, 0.7, 0}, {true, ParamEq::T_BELL, 500, -6, 2, 0},
                                 {true, ParamEq::T_NOTCH, 3000, 0, 4, 0}, {true, ParamEq::T_HIGHSHELF, 9000, 5, 0.7, 0}, {true, ParamEq::T_LP, 15000, 0, 1.2, 2}};
        ParamEq q;
        q.prepare(SR);
        q.set(all, 1, true);
        Buf qL = L, qR = R;
        const auto t0 = std::chrono::steady_clock::now();
        for (int i = 0; i < N; i += 512) q.process(qL.data() + i, qR.data() + i, std::min(512, N - i));
        const double eq = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count() / 10;
        SpecAnalyzer an;
        an.prepare(SR);
        float db[SpecAnalyzer::kBins];
        const auto t1 = std::chrono::steady_clock::now();
        for (int k = 0; k < 150; ++k) {
            an.push(L.data() + 3200 * k, R.data() + 3200 * k, 3200);
            an.frame(db);
        }
        const double ana = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t1).count() / 10;
        std::printf("     cout (ms par seconde de son, un coeur) : DELAY du site %.1f ; page DELAY, le pire style x mode tout engage %.1f ; EQ 6 bandes (HP / LP 48 dB) %.1f ; analyseur 15 images/s %.2f (thread du message)%s\n",
                    bSite, worst, eq, ana, detail.c_str());
        check(worst < 60 && eq < 20, fmt("le cout : la page DELAY au pire %.1f ms/s (moins de 6 %% d'un coeur), l'EQ %.1f ms/s", worst, eq));
    }

    std::printf(failures ? "%d echec(s) sur %d controles\n" : "OK (%d controles)\n", failures ? failures : checks, checks);
    return failures ? 1 : 0;
}
