// MM-RAGE, la banque et les reglages (sans JUCE, sans son : tout se calcule en memoire).
//   - la banque : INIT en tete, puis les 20 presets de la DISTO du MM-ARP valeur par valeur (presets_ref.inc, tire du vrai
//     disto.ts par presets-ref.mjs), puis les familles du MM-RAGE (8 presets chacune), noms uniques, descriptions ;
//   - settingsOf : DRIVE 0 reste en circuit, la reference de niveau (kRef), le LFO SYNC au tempo ;
//   - chaque preset rendu sur une meme matiere (kick, charley, basse, un sinus tenu) : fini, niveau borne (-20 / +6 dB de
//     l'entree), stable (le FEEDBACK s'eteint seul), et sa signature (niveau, brillance, grave, harmoniques, mouvement,
//     crete) : aucune paire de presets trop proche ;
//   - les textes.
#include "../dsp/RagePatch.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <map>
#include <set>
#include <string>
#include <vector>

#include "presets_ref.inc"

using mmrage::RagePatch;

namespace {

int fails = 0;
void check(const char* what, bool ok, const char* fmt = nullptr, double a = 0, double b = 0, double c = 0) {
    std::printf("%s  %s", ok ? "ok  " : "FAIL", what);
    if (fmt) {
        std::printf("  (");
        std::printf(fmt, a, b, c);
        std::printf(")");
    }
    std::printf("\n");
    if (!ok) ++fails;
}

constexpr double kSr = 48000;
constexpr double kPi = 3.14159265358979323846;

// Les reglages d'un patch dans les cles de disto.ts (0..1), pour la comparaison au MM-ARP
std::map<std::string, double> arpValues(const RagePatch& p) {
    std::map<std::string, double> v;
    v["dist"] = p.drive;
    v["xDStyle"] = (p.style + 1) / 12.0;
    v["xDPunish"] = p.punish;
    v["xDLow"] = p.low;
    v["xDThump"] = p.thump;
    v["xDTone"] = p.tone;
    v["xDHigh"] = p.high;
    v["xDSteep"] = p.steep;
    v["xDMix"] = p.mix;
    v["xDOut"] = p.out;
    v["xDAuto"] = p.autoGain;
    v["xDMorph"] = p.morph;
    v["xDMorphTo"] = p.morphTo / 11.0;
    v["xDDyn"] = p.dyn;
    v["xDFb"] = p.fb;
    v["xDFbFreq"] = p.fbFreq;
    v["xDBands"] = (p.bands - 1) / 2.0;
    v["xDXLo"] = p.xLo;
    v["xDXHi"] = p.xHi;
    for (int b = 0; b < 3; ++b) {
        const auto& bd = p.band[static_cast<size_t>(b)];
        const std::string k = "xDB" + std::to_string(b + 1);
        v[k + "Style"] = (bd.style + 1) / 12.0;
        v[k + "Drive"] = bd.drive;
        v[k + "Mix"] = bd.mix;
        v[k + "Level"] = bd.level;
        v[k + "Solo"] = bd.solo;
        v[k + "Byp"] = bd.bypass;
    }
    v["xDEnvAmt"] = p.envAmt;
    v["xDEnvSpd"] = p.envSpeed;
    v["xDLfoShape"] = p.lfoShape / 4.0;
    v["xDLfoSync"] = p.lfoSync;
    // le MM-ARP n'a qu'un reglage pour la vitesse : en SYNC, son cran (8 BAR ... 1/32)
    v["xDLfoRate"] = p.lfoSync ? p.lfoNote / 8.0 : p.lfoRate;
    v["xDLfoAmt"] = p.lfoAmt;
    v["xDLfoTarget"] = p.lfoTarget / 5.0;
    v["xDPreMode"] = p.preMode / 4.0;
    v["xDPreFreq"] = p.preFreq;
    v["xDPreReso"] = p.preReso;
    v["xDPostMode"] = p.postMode / 4.0;
    v["xDPostFreq"] = p.postFreq;
    v["xDPostReso"] = p.postReso;
    v["xDBox"] = p.box / 4.0;
    v["xDBoxSize"] = p.boxSize;
    v["xDBoxMix"] = p.boxMix;
    return v;
}

// ---- la matiere : un petit morceau a 120 BPM (kick, charley, basse en dents de scie), puis un sinus tenu ----
struct Material {
    std::vector<float> mixL, sine;
};

Material material() {
    Material m;
    const int n = static_cast<int>(kSr * 4);
    m.mixL.assign(static_cast<size_t>(n), 0.f);
    uint32_t r = 12345;
    double ph = 0, kickPh = 0;
    for (int i = 0; i < n; ++i) {
        const double t = i / kSr;
        const double beat = std::fmod(t * 2, 1.0); // 120 BPM : un temps toutes les 0.5 s
        const double tb = beat * 0.5;
        // kick : un sinus qui descend de 120 a 48 Hz
        const double kf = 48 + 72 * std::exp(-tb * 30);
        kickPh += kf / kSr;
        const double kick = std::sin(2 * kPi * kickPh) * std::exp(-tb * 7);
        // charley sur le contretemps
        r = r * 1664525u + 1013904223u;
        const double noise = (r >> 8) / 8388608.0 - 1;
        const double off = std::fmod(beat + 0.5, 1.0) * 0.5;
        const double hat = noise * std::exp(-off * 60);
        // basse : dents de scie a 55 Hz, en croches
        ph += 55 / kSr;
        const double saw = 2 * (ph - std::floor(ph)) - 1;
        const double gate = std::fmod(t * 4, 1.0) < 0.7 ? 1.0 : 0.0;
        m.mixL[static_cast<size_t>(i)] = static_cast<float>(0.45 * kick + 0.12 * hat + 0.22 * saw * gate);
    }
    const int ns = static_cast<int>(kSr * 3);
    m.sine.assign(static_cast<size_t>(ns), 0.f);
    for (int i = 0; i < ns; ++i) m.sine[static_cast<size_t>(i)] = static_cast<float>(0.35 * std::sin(2 * kPi * 220 * i / kSr));
    return m;
}

void render(const RagePatch& p, std::vector<float>& L, std::vector<float>& R, int block = 512) {
    mmarp::Decap d;
    d.prepare(kSr);
    for (size_t i = 0; i < L.size(); i += static_cast<size_t>(block)) {
        const int n = static_cast<int>(std::min(static_cast<size_t>(block), L.size() - i));
        d.set(mmrage::settingsOf(p, 120));
        d.process(L.data() + i, R.data() + i, n);
    }
}

double rms(const std::vector<float>& x, size_t from, size_t to) {
    double s = 0;
    for (size_t i = from; i < to; ++i) s += double(x[i]) * x[i];
    return std::sqrt(s / std::max<size_t>(1, to - from));
}
double dbOf(double x) { return 20 * std::log10(std::max(1e-12, x)); }

// La part de l'energie au-dessus de fc (un passe-haut du premier ordre, deux fois)
double bandShare(const std::vector<float>& x, double fc, bool high, size_t from) {
    const double a = std::exp(-2 * kPi * fc / kSr);
    double l1 = 0, l2 = 0, e = 0, tot = 0;
    for (size_t i = 0; i < x.size(); ++i) {
        l1 = (1 - a) * x[i] + a * l1;
        l2 = (1 - a) * l1 + a * l2;
        const double y = high ? x[i] - l2 : l2;
        if (i >= from) {
            e += y * y;
            tot += double(x[i]) * x[i];
        }
    }
    return e / std::max(1e-20, tot);
}

struct Sig {
    double gain, bright, low, thd, motion, crest;
    double heard; // le niveau sans le grave (deux passe-haut a 150 Hz) : ce que l'oreille compare
};

double rmsHp(const std::vector<float>& x, size_t from) {
    const double a = std::exp(-2 * kPi * 150 / kSr);
    double l1 = 0, l2 = 0, e = 0;
    for (size_t i = 0; i < x.size(); ++i) {
        l1 = (1 - a) * x[i] + a * l1;
        const double h1 = x[i] - l1;
        l2 = (1 - a) * h1 + a * l2;
        const double h2 = h1 - l2;
        if (i >= from) e += h2 * h2;
    }
    return std::sqrt(e / static_cast<double>(x.size() - from));
}

Sig signature(const RagePatch& p, const Material& m, bool& finite, double& peak) {
    Sig s{};
    const size_t from = static_cast<size_t>(kSr * 0.3);
    std::vector<float> L = m.mixL, R = m.mixL;
    render(p, L, R);
    finite = true;
    peak = 0;
    for (float v : L) {
        if (!std::isfinite(v)) finite = false;
        peak = std::max(peak, double(std::fabs(v)));
    }
    s.gain = dbOf(rms(L, from, L.size())) - dbOf(rms(m.mixL, from, m.mixL.size()));
    s.heard = dbOf(rmsHp(L, from)) - dbOf(rmsHp(m.mixL, from));
    s.bright = 10 * std::log10(bandShare(L, 4000, true, from) / bandShare(m.mixL, 4000, true, from));
    s.low = 10 * std::log10(bandShare(L, 150, false, from) / bandShare(m.mixL, 150, false, from));
    double pkIn = 0, pkOut = 0;
    for (size_t i = from; i < L.size(); ++i) {
        pkIn = std::max(pkIn, double(std::fabs(m.mixL[i])));
        pkOut = std::max(pkOut, double(std::fabs(L[i])));
    }
    s.crest = (dbOf(pkOut) - dbOf(rms(L, from, L.size()))) - (dbOf(pkIn) - dbOf(rms(m.mixL, from, m.mixL.size())));
    // le sinus tenu : les harmoniques (ce qui n'est pas le fondamental, le retard compte) et le mouvement (50 ms)
    std::vector<float> S = m.sine, T = m.sine;
    render(p, S, T);
    const size_t a = static_cast<size_t>(kSr * 0.5), b = S.size();
    double c = 0, si = 0, tot = 0;
    for (size_t i = a; i < b; ++i) {
        const double w = 2 * kPi * 220 * i / kSr;
        c += S[i] * std::cos(w);
        si += S[i] * std::sin(w);
        tot += double(S[i]) * S[i];
    }
    const double fund = 2 * (c * c + si * si) / static_cast<double>(b - a);
    s.thd = 10 * std::log10(std::max(1e-9, (tot - fund) / std::max(1e-20, fund)));
    std::vector<double> fr;
    const size_t w = static_cast<size_t>(kSr * 0.05);
    for (size_t i = a; i + w <= b; i += w) fr.push_back(dbOf(rms(S, i, i + w)));
    double mean = 0, var = 0;
    for (double x : fr) mean += x;
    mean /= static_cast<double>(fr.size());
    for (double x : fr) var += (x - mean) * (x - mean);
    s.motion = std::sqrt(var / static_cast<double>(fr.size()));
    return s;
}

double distance(const Sig& a, const Sig& b) {
    const double d[6] = {(a.gain - b.gain) / 3, (a.bright - b.bright) / 3, (a.low - b.low) / 3, (a.thd - b.thd) / 6, (a.motion - b.motion) / 1.5,
                         (a.crest - b.crest) / 2};
    double s = 0;
    for (double x : d) s += x * x;
    return std::sqrt(s);
}

} // namespace

int main() {
    const auto& bank = mmrage::factory();
    const int n = static_cast<int>(bank.size());

    // ---- 1. la banque ----
    check("INIT en tete (style A, DRIVE 25 %, le reste au depart)",
          bank[0].name == "INIT" && mmrage::initIndex() == 0 && bank[0].p.style == 0 && std::fabs(bank[0].p.drive - 0.25) < 1e-12 && mmrage::same(bank[0].p, [] {
              RagePatch d;
              return d;
          }()));
    {
        bool names = kRefCount == 20, values = true;
        double worst = 0;
        std::string where;
        for (int i = 0; i < kRefCount && i + 1 < n; ++i) {
            const auto& pr = bank[static_cast<size_t>(i + 1)];
            if (pr.name != kRefNames[i] || pr.bank != "THE CLASSICS") names = false;
            const auto v = arpValues(pr.p);
            for (int k = 0; k < kRefKeyCount; ++k) {
                const auto it = v.find(kRefKeys[k]);
                const double d = it == v.end() ? 1e9 : std::fabs(it->second - kRefValues[i][k]);
                if (d > worst) {
                    worst = d;
                    where = pr.name + " " + kRefKeys[k];
                }
                if (d > 1e-9) values = false;
            }
        }
        check("les 20 presets du MM-ARP : memes noms, meme ordre, apres INIT", names);
        check("les 20 presets du MM-ARP : chaque reglage egal a disto.ts (1e-9)", values, "pire ecart %.3g", worst);
        if (!values) std::printf("      ecart : %s\n", where.c_str());
    }
    {
        std::set<std::string> seen;
        bool unique = true, desc = true, upper = true;
        for (const auto& p : bank) {
            if (!seen.insert(p.name).second) unique = false;
            if (p.desc.size() < 12 || p.desc.size() > 96) desc = false;
            for (char ch : p.name)
                if (ch >= 'a' && ch <= 'z') upper = false;
        }
        check("noms uniques, en capitales", unique && upper);
        check("chaque preset a sa description (12 a 96 signes, pour la fenetre)", desc);
        const auto& fam = mmrage::families();
        bool eight = true;
        for (size_t f = 1; f < fam.size(); ++f) {
            int c = 0;
            for (const auto& p : bank) c += p.bank == fam[f];
            if (c != 8) eight = false;
        }
        check("familles : THE CLASSICS (21) puis 8 familles de 8", fam.size() == 9 && eight && n == 21 + 64, "%g familles, %g presets", double(fam.size()), double(n));
        bool matchAll = true;
        for (int i = 0; i < n; ++i)
            if (mmrage::match(bank[static_cast<size_t>(i)].p) != i) matchAll = false;
        check("match() reconnait chaque preset (et aucun n'est le double d'un autre)", matchAll);
    }

    // ---- 2. settingsOf ----
    {
        RagePatch p;
        p.drive = 0;
        const auto s = mmrage::settingsOf(p, 120);
        check("DRIVE 0 : le DSP reste en circuit (le retard ne change pas)", s.drive > 0 && !s.mm);
        check("la reference de niveau est celle du MM-ARP (VOLUME 75 %)", std::fabs(s.ref - 0.75 * 0.75 * 0.66) < 1e-12);
        p.lfoSync = true;
        p.lfoNote = 5;
        check("LFO SYNC 1/4 a 120 BPM : 2 Hz", std::fabs(mmrage::settingsOf(p, 120).lfoHz - 2) < 1e-12);
        p.lfoSync = false;
        p.lfoRate = 0.4;
        check("LFO FREE 0.4 : 0.02 x 500^0.4 Hz (la loi du MM-ARP)", std::fabs(mmrage::settingsOf(p, 120).lfoHz - 0.02 * std::pow(500.0, 0.4)) < 1e-12);
        mmarp::Decap d;
        d.prepare(kSr);
        d.set(s);
        std::vector<float> a(512, 0.1f), b(512, 0.1f);
        d.process(a.data(), b.data(), 512);
        check("DRIVE 0 : latence de 32 echantillons tenue", d.latency() == mmarp::Decap::kLatency);
    }

    // ---- 3. chaque preset rendu ----
    const Material m = material();
    std::vector<Sig> sig(static_cast<size_t>(n));
    bool allFinite = true, levels = true;
    double lo = 1e9, hi = -1e9, maxPeak = 0;
    std::string loN, hiN, pkN;
    for (int i = 0; i < n; ++i) {
        bool fin = true;
        double pk = 0;
        sig[static_cast<size_t>(i)] = signature(bank[static_cast<size_t>(i)].p, m, fin, pk);
        const Sig& s = sig[static_cast<size_t>(i)];
        if (!fin) allFinite = false;
        if (s.heard < lo) lo = s.heard, loN = bank[static_cast<size_t>(i)].name;
        if (s.gain > hi) hi = s.gain, hiN = bank[static_cast<size_t>(i)].name;
        if (pk > maxPeak) maxPeak = pk, pkN = bank[static_cast<size_t>(i)].name;
        if (s.gain < -26 || s.gain > 6 || s.heard < -12 || s.heard > 6 || pk > 4) levels = false;
        std::printf("      %02d %-18s %-16s gain %+6.1f  heard %+6.1f  bright %+6.1f  low %+6.1f  thd %+6.1f  motion %5.2f  crest %+5.1f  peak %.2f\n", i + 1,
                    bank[static_cast<size_t>(i)].name.c_str(), bank[static_cast<size_t>(i)].bank.c_str(), s.gain, s.heard, s.bright, s.low, s.thd, s.motion,
                    s.crest, pk);
    }
    check("chaque preset : sortie finie", allFinite);
    check("niveaux : de -26 a +6 dB de l'entree (sans le grave : -12 a +6 dB), crete sous 4", levels, "pire %.1f, plus haut %+.1f dB, crete %.2f", lo, hi, maxPeak);
    std::printf("      le plus bas : %s ; le plus haut : %s ; la plus forte crete : %s\n", loN.c_str(), hiN.c_str(), pkN.c_str());
    {
        // la paire la plus proche ; les cinq plus proches affichees
        struct Pair {
            double d;
            int a, b;
        };
        std::vector<Pair> pairs;
        for (int a = 0; a < n; ++a)
            for (int b = a + 1; b < n; ++b) pairs.push_back({distance(sig[static_cast<size_t>(a)], sig[static_cast<size_t>(b)]), a, b});
        std::sort(pairs.begin(), pairs.end(), [](const Pair& x, const Pair& y) { return x.d < y.d; });
        for (size_t k = 0; k < 6 && k < pairs.size(); ++k)
            std::printf("      proches : %-18s %-18s %.2f\n", bank[static_cast<size_t>(pairs[k].a)].name.c_str(), bank[static_cast<size_t>(pairs[k].b)].name.c_str(),
                        pairs[k].d);
        // les 20 du MM-ARP gardent leurs reglages : la regle ne vaut que pour les presets propres au MM-RAGE
        double worstNew = 1e9;
        for (const auto& pr : pairs)
            if (pr.b > 20) worstNew = std::min(worstNew, pr.d);
        check("diversite : aucun preset du MM-RAGE trop proche d'un autre (signature)", worstNew > 0.45, "distance minimale %.2f", worstNew);
    }

    // ---- 4. stabilite : du bruit fort pendant 3 s, puis le silence : tout s'eteint ----
    {
        bool ok = true;
        std::string bad;
        for (const auto& pr : bank) {
            std::vector<float> L(static_cast<size_t>(kSr * 5), 0.f);
            uint32_t r = 7;
            for (size_t i = 0; i < static_cast<size_t>(kSr * 3); ++i) {
                r = r * 1664525u + 1013904223u;
                L[i] = static_cast<float>(((r >> 8) / 8388608.0 - 1) * 0.9);
            }
            std::vector<float> R = L;
            render(pr.p, L, R, 256);
            double pk = 0;
            for (size_t i = 0; i < L.size(); ++i)
                if (!std::isfinite(L[i])) pk = 1e9;
                else pk = std::max(pk, double(std::fabs(L[i])));
            const double tail = rms(L, static_cast<size_t>(kSr * 4.5), L.size());
            if (pk > 8 || tail > 1e-3) {
                ok = false;
                bad += pr.name + " ";
            }
        }
        check("stabilite : bruit a fond puis silence, chaque preset borne et qui s'eteint", ok);
        if (!ok) std::printf("      %s\n", bad.c_str());
    }

    // ---- 5. les textes ----
    {
        namespace t = mmrage::text;
        check("textes : DRIVE", t::drive(0.5, false) == "+18.0 DB" && t::drive(0.5, true) == "+38.0 DB");
        check("textes : LOW CUT, HIGH CUT", t::low(0) == "OFF" && t::high(1) == "OFF" && t::low(1) == "1.00 KHZ" && t::high(0) == "1.00 KHZ");
        check("textes : TONE, DYNAMICS, OUTPUT", t::tone(0.5) == "FLAT" && t::tone(0) == "DARK 100 %" && t::dyn(1) == "EXPAND 100 %" && t::outDb(0.5) == "0.0 DB" &&
                                                     t::outDb(1) == "+18.0 DB");
        check("textes : filtres, Q, frequences", t::filtFreq(0) == "20.0 HZ" && t::filtFreq(1) == "20.0 KHZ" && t::reso(0) == "Q 0.71" && t::hz(440) == "440 HZ");
    }

    std::printf(fails ? "\n%d ECHEC(S)\n" : "\nTOUT PASSE\n", fails);
    return fails ? 1 : 0;
}
