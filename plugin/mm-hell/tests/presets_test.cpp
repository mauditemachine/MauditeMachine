// MM-HELL : la banque d'usine (dsp/HellPatch.cpp) = celle du HELL du MM-ARP (tests/presets_ref.inc, tiree de hell.ts),
// les reglages par defaut = INIT, chaque preset joue sans exploser, les lois et les textes.
//   ./mmhell_presets_test
#include "HellPatch.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "presets_ref.inc"

using namespace mmhell;

static int fails = 0;
static void check(bool ok, const char* what) {
    std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what);
    if (!ok) ++fails;
}

// Un patch du MM-HELL vu avec les reglages 0..1 du MM-ARP (l'ordre des colonnes de presets_ref.inc)
static std::vector<double> arpView(const HellPatch& p) {
    return {p.sync ? (p.note + 1) / 13.0 : 0.0,
            p.time,
            p.feedback,
            p.cross ? 1.0 : 0.0,
            p.range / 3.0,
            p.shift,
            p.sideband,
            p.spread,
            p.phase,
            p.antiRefl ? 1.0 : 0.0,
            p.smear,
            p.hp,
            p.lp,
            p.lfoShape / 3.0,
            p.lfoSync ? 1.0 : 0.0,
            p.lfoSync ? p.lfoNote / 8.0 : p.lfoRate,
            0.5 + 0.5 * p.lfoAmt,
            p.lfoStereo ? 1.0 : 0.0,
            p.lfoTarget / 3.0};
}

// Les ecarts voulus avec le MM-ARP (HellPatch.cpp) : SIDEBAND UP au lieu de DOWN sur les presets qui doivent descendre
static bool fixedFall(const std::string& name) {
    return name == "BARBER DOWN" || name == "ABYSS" || name == "DEEP STAIRS" || name == "SULFUR RAIN" || name == "HELLFIRE SWELL";
}

int main() {
    const auto& bank = factory();
    // 1. la banque = celle du MM-ARP, nom par nom, valeur par valeur
    {
        bool ok = bank.size() == 72;
        double worst = 0;
        for (size_t i = 0; ok && i < 24; ++i) {
            ok = ok && bank[i].name == kRef[i].name && bank[i].desc == kRef[i].desc;
            const auto v = arpView(bank[i].p);
            for (size_t k = 0; k < v.size(); ++k) {
                // la colonne 6 (SIDEBAND) des presets qui descendent : 1 ici, 0 au MM-ARP (voir fixedFall)
                const double want = k == 6 && fixedFall(bank[i].name) ? 1.0 : kRef[i].v[k];
                const double d = std::fabs(v[k] - want);
                worst = std::max(worst, d);
                if (d > 1e-12) {
                    std::printf("     %s, colonne %zu : %.15f contre %.15f\n", kRef[i].name, k, v[k], want);
                    ok = false;
                }
            }
        }
        char msg[160];
        std::snprintf(msg, sizeof msg, "banque : 72 presets, les 24 premiers = ceux du MM-ARP (noms, descriptions, valeurs ; ecart max %.1e)", worst);
        check(ok, msg);
    }
    // 1b. le sens du decalage : un sinus de 1 kHz, sans reinjection ni LFO ni filtres ; ce qui doit descendre descend
    //     (au MM-ARP, BARBER DOWN, ABYSS, DEEP STAIRS, SULFUR RAIN et HELLFIRE SWELL montaient)
    {
        const double SR = 48000, PI = 3.14159265358979323846;
        const size_t N = static_cast<size_t>(SR * 2.5); // le premier echo de DEEP STAIRS (1/2 a 120 BPM) arrive a 1 s
        bool ok = true;
        std::string bad;
        for (const auto& pr : bank) {
            HellPatch p = pr.p;
            p.feedback = 0;
            p.lfoAmt = 0;
            p.hp = 0;
            p.lp = 1;
            p.smear = 0;
            p.spread = 0;
            const double sh = shiftHz(p, 120, 0);
            if (p.range == 3 || std::fabs(sh) < 1 || std::fabs(p.sideband - 0.5) < 0.01) continue;
            mmarp::Hell h;
            h.prepare(SR);
            std::vector<float> L(N), R(N);
            for (size_t i = 0; i < N; ++i) L[i] = R[i] = static_cast<float>(0.5 * std::sin(2 * PI * 1000 * static_cast<double>(i) / SR));
            for (size_t i = 0; i < N; i += 256) {
                h.set(settingsOf(p, 1, 120, 0), 120);
                h.process(L.data() + i, R.data() + i, static_cast<int>(std::min<size_t>(256, N - i)));
            }
            const auto gz = [&](double hz) {
                const double w = 2 * PI * hz / SR, c = 2 * std::cos(w);
                double s1 = 0, s2 = 0;
                for (size_t i = N / 2; i < N; ++i) {
                    const double s = L[i] + c * s1 - s2;
                    s2 = s1;
                    s1 = s;
                }
                return std::sqrt(std::max(0.0, s1 * s1 + s2 * s2 - c * s1 * s2));
            };
            const double up = gz(1000 + std::fabs(sh)), down = gz(std::fabs(1000 - std::fabs(sh)));
            const bool falls = down > 4 * up, rises = up > 4 * down;
            if (sh < 0 ? !falls : !rises) {
                ok = false;
                bad += " " + pr.name;
            }
        }
        check(ok, ("le sens : un decalage negatif descend, un positif monte, pour chaque preset a une bande" + bad).c_str());
    }
    // 1c. v1.1 : les 48 du MM-HELL, six categories de huit apres les deux du MM-ARP ; des noms uniques ; et pas un preset
    //     qui saute au visage : un son de 0.35 s (dent de scie de 220 Hz et un coup de bruit), MIX a fond, 4 s ecoutees,
    //     le niveau mouille entre -20 et +6 dB de l'entree, la crete sous 2
    {
        const char* const banks[8] = {"THE CLASSICS", "MORE HELL", "SPACE & DUB", "METAL & RESONATORS", "MOTION", "SPIRALS & ALIENS", "HARMONIC & RHYTHM", "TEXTURES & DRONES"};
        bool ok = true;
        for (int k = 0; k < 8; ++k) {
            int n = 0;
            for (const auto& pr : bank) n += pr.bank == banks[k] ? 1 : 0;
            ok = ok && n == (k < 2 ? 12 : 8);
        }
        for (size_t i = 0; i < bank.size(); ++i)
            for (size_t j = i + 1; j < bank.size(); ++j) ok = ok && bank[i].name != bank[j].name;
        check(ok, "categories : THE CLASSICS 12, MORE HELL 12, puis six de 8 ; 72 noms uniques");

        const double SR = 48000, PI = 3.14159265358979323846;
        const size_t N = static_cast<size_t>(SR * 4), on = static_cast<size_t>(SR * 0.35);
        std::vector<float> in(N, 0.f);
        uint32_t r = 7;
        for (size_t i = 0; i < on; ++i) {
            const double env = std::min(1.0, static_cast<double>(i) / 200.0) * std::min(1.0, static_cast<double>(on - i) / 2000.0);
            double saw = 0;
            for (int h = 1; h <= 12; ++h) saw += std::sin(2 * PI * 220 * h * static_cast<double>(i) / SR) / h;
            r = r * 1664525u + 1013904223u;
            const double nz = ((r >> 8) / 16777216.0 - 0.5) * (i < 2400 ? 1.0 : 0.05);
            in[i] = static_cast<float>(0.3 * env * saw + 0.3 * nz);
        }
        double inE = 0;
        for (size_t i = 0; i < on; ++i) inE += static_cast<double>(in[i]) * in[i];
        const double inRms = std::sqrt(inE / static_cast<double>(on));
        double lo = 99, hi = -99, crest = 0;
        std::string bad;
        for (const auto& pr : bank) {
            mmarp::Hell h;
            h.prepare(SR);
            std::vector<float> L = in, R = in;
            for (size_t i = 0; i < N; i += 256) {
                h.set(settingsOf(pr.p, 1, 120, 220), 120);
                h.process(L.data() + i, R.data() + i, static_cast<int>(std::min<size_t>(256, N - i)));
            }
            // le niveau sur la duree ou ca sonne (jusqu'a -40 dB de la plus forte trame de 1024)
            std::vector<double> fr;
            for (size_t s0 = 0; s0 + 1024 <= N; s0 += 1024) {
                double e = 0;
                for (size_t k = s0; k < s0 + 1024; ++k) e += 0.5 * (static_cast<double>(L[k]) * L[k] + static_cast<double>(R[k]) * R[k]);
                fr.push_back(e / 1024);
            }
            const double mx = *std::max_element(fr.begin(), fr.end());
            size_t last = 0;
            for (size_t k = 0; k < fr.size(); ++k)
                if (fr[k] > mx * 1e-4) last = k;
            double e = 0, pk = 0;
            for (size_t k = 0; k <= last; ++k) e += fr[k];
            for (size_t i = 0; i < N; ++i) pk = std::max(pk, static_cast<double>(std::max(std::fabs(L[i]), std::fabs(R[i]))));
            const double db = 20 * std::log10(std::sqrt(e / static_cast<double>(last + 1)) / inRms + 1e-12);
            lo = std::min(lo, db);
            hi = std::max(hi, db);
            crest = std::max(crest, pk);
            if (db < -20 || db > 6 || pk >= 2) bad += " " + pr.name;
        }
        char msg[220];
        std::snprintf(msg, sizeof msg, "niveau : les 72 presets mouilles entre %.1f et %+.1f dB de l'entree, crete max %.2f (bornes -20 / +6 dB, 2)%s", lo, hi, crest, bad.c_str());
        check(bad.empty(), msg);
    }
    // 2. les reglages par defaut sont INIT ; chaque preset se reconnait lui-meme
    {
        const HellPatch def;
        bool ok = bank[static_cast<size_t>(initIndex())].name == "INIT" && same(def, bank[static_cast<size_t>(initIndex())].p) && match(def) == initIndex();
        for (size_t i = 0; i < bank.size(); ++i) ok = ok && match(bank[i].p) == static_cast<int>(i);
        HellPatch moved = def;
        moved.feedback = 0.51;
        ok = ok && match(moved) == -1;
        check(ok, "les reglages par defaut = INIT ; chaque preset reconnu, un reglage bouge = aucun");
    }
    // 3. le patch vers le DSP : le temps cale (1/8. a 120 = 375 ms), FREE, le LFO cale, les lois du MM-ARP
    {
        HellPatch p;
        const bool t1 = std::fabs(delaySeconds(p, 120) - 0.375) < 1e-12;
        p.sync = false;
        p.time = 0.5;
        const bool t2 = std::fabs(delaySeconds(p, 120) - 0.1) < 1e-12;
        p.lfoSync = true;
        p.lfoNote = 5; // 1/4 : un cycle par temps
        const bool l1 = std::fabs(lfoHz(p, 120) - 2.0) < 1e-12;
        p.range = 2;
        p.shift = 1;
        const bool s1 = std::fabs(shiftHz(p, 120, 0) - 32) < 1e-9;
        p.range = 3;
        p.shift = 1;
        const bool s2 = std::fabs(shiftHz(p, 120, 220) - 440) < 1e-9 && shiftHz(p, 120, 0) == 0;
        const mmarp::HellSettings s = settingsOf(bank[0].p, 0.4, 120, 0);
        const bool m = s.mix == 0.4 && s.sync == 1 + 8 && s.tone == 0.5 && s.lfoDepthHz == 0 && std::fabs(s.shiftHz - 35) < 1e-6;
        check(t1 && t2 && l1 && s1 && s2 && m, "1/8. a 120 BPM = 375 ms, FREE 0.5 = 100 ms, LFO 1/4 = 2 Hz, SYNC 16/temps = 32 Hz, MIDI 2 x 220 Hz, SLOW ASCENT = +35 Hz");
    }
    // 4. chaque preset joue : 2 s de bruit fort puis 4 s de silence, MIX 0.5 : fini, sans sous-normaux, borne
    {
        const double SR = 48000;
        const size_t N = static_cast<size_t>(SR * 6), loud = static_cast<size_t>(SR * 2);
        double worst = 0;
        bool ok = true;
        std::string bad;
        for (const auto& pr : bank) {
            mmarp::Hell h;
            h.prepare(SR);
            std::vector<float> L(N, 0.f), R(N, 0.f);
            uint32_t r = 777;
            for (size_t i = 0; i < loud; ++i) {
                r = r * 1664525u + 1013904223u;
                L[i] = static_cast<float>(((r >> 8) / 16777216.0 - 0.5) * 2.0);
                r = r * 1664525u + 1013904223u;
                R[i] = static_cast<float>(((r >> 8) / 16777216.0 - 0.5) * 2.0);
            }
            for (size_t i = 0; i < N; i += 256) {
                h.set(settingsOf(pr.p, 0.5, 124, 110), 124);
                h.process(L.data() + i, R.data() + i, static_cast<int>(std::min<size_t>(256, N - i)));
            }
            double peak = 0;
            bool fin = true;
            for (size_t i = 0; i < N; ++i)
                for (float v : {L[i], R[i]}) {
                    fin = fin && std::isfinite(v) && std::fpclassify(v) != FP_SUBNORMAL;
                    peak = std::max(peak, static_cast<double>(std::fabs(v)));
                }
            if (!fin || peak >= 6) {
                ok = false;
                bad += " " + pr.name;
            }
            worst = std::max(worst, peak);
        }
        char msg[200];
        std::snprintf(msg, sizeof msg, "les 72 presets a MIX 50 %% : finis, sans sous-normaux, crete max %.2f (entree a +/-1 ; borne a 6)%s", worst, bad.c_str());
        check(ok, msg);
    }
    // 5. les textes (l'hote et l'interface)
    {
        const bool ok = text::shift(0.5, 0) == "0 HZ" && text::shift(1, 0) == "+200 HZ" && text::shift(0, 1) == "-5.00 KHZ" && text::shift(1, 2) == "+16 / BEAT" &&
                        text::shift(1, 3) == "+2.00 x NOTE" && text::time(0.5) == "100 MS" && text::time(1) == "2.00 S" && text::mix(0) == "OFF" &&
                        text::sideband(0.5) == "R.M. (BOTH)" && text::sideband(1) == "UP" && text::sideband(0) == "DOWN" && text::hp(0) == "OFF" &&
                        text::lp(1) == "OFF" && text::lp(0) == "300 HZ" && text::noteName(440) == "A3" && text::noteName(261.6256) == "C3" &&
                        text::bipolar(-0.35) == "-35 %" && text::shiftHzNow(1, 3, 120, 0) == "NO MIDI NOTE YET";
        check(ok, "textes : 0 HZ, +200 HZ, -5.00 KHZ, +16 / BEAT, +2.00 x NOTE, 100 MS, R.M., OFF, A3 = 440 Hz (Ableton), -35 %");
    }
    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "OK", fails, fails > 1 ? "s" : "");
    return fails ? 1 : 0;
}
