// MM-ARP v50 (2026-11-23) : le banc de la matrice de modulation de l'encart LFO (les 8 emplacements xMx), de LFO 1 / 2
// en FREE, de LFO 3 (le LFO de la DISTO) et de LFO 4. Le moteur seul (dsp/Voyager) puis le vrai MMArpProcessor sans
// fenetre (MMARP_HEADLESS, comme host_test). Aucun son ne sort : tout se verifie dans les buffers.
//   cmake -S plugin/mm-arp -B build-host -DMM_HOST_TEST=ON && cmake --build build-host --target mmarp_mod_test
//   ./build-host/mmarp_mod_test_artefacts/Release/mmarp_mod_test
// Ce qui est verifie :
//   1. rien d'actif = le moteur d'avant au bit pres (les cles neuves posees a leur neutre, un emplacement a 0 %) ;
//   2. un emplacement xMx regle comme une ligne xM (destinations 1..19, les 11 sources communes) : la meme sortie, au bit
//      pres, dans le moteur et dans le processeur ;
//   3. LFO 1 et LFO 2 en FREE (frequence mesuree), SYNC inchange ; LFO 4 FREE et SYNC (frequence, phase calee sur le
//      transport), LFO 3 a la vitesse du LFO de la DISTO ;
//   4. chaque source (les 13) vers une cible generique : la valeur effective bouge, finie ;
//   5. une cible generique par famille (synthe, arpege, SOUND, DISTO, DELAY, HELL, REVERB, MASTER, LFO) : valeur effective
//      attendue (MOD WHEEL a fond : hote + quantite, bornee), sortie finie, le reglage agit, pas de clic ;
//   6. une cible avec un equivalent par voix (FILTER CUTOFF -> CUTOFF) : l'arc de la face suit la loi du potard ;
//   7. aucune allocation dans processBlock, la matrice engagee ; retour au chemin d'avant quand tout est coupe.
#include "PluginProcessor.h"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <new>
#include <string>
#include <vector>

/* ---- les allocations, comptees seulement pendant processBlock (gCount) ---- */
static std::atomic<long> gAllocs{0};
static std::atomic<bool> gCount{false};
void* operator new(std::size_t n) {
    if (gCount.load(std::memory_order_relaxed)) gAllocs.fetch_add(1, std::memory_order_relaxed);
    if (void* p = std::malloc(n ? n : 1)) return p;
    throw std::bad_alloc();
}
void* operator new[](std::size_t n) {
    if (gCount.load(std::memory_order_relaxed)) gAllocs.fetch_add(1, std::memory_order_relaxed);
    if (void* p = std::malloc(n ? n : 1)) return p;
    throw std::bad_alloc();
}
void operator delete(void* p) noexcept { std::free(p); }
void operator delete[](void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }
void operator delete[](void* p, std::size_t) noexcept { std::free(p); }

namespace {

int gFails = 0, gChecks = 0;
void check(bool ok, const char* fmt, ...) __attribute__((format(printf, 2, 3)));
void check(bool ok, const char* fmt, ...) {
    ++gChecks;
    if (!ok) ++gFails;
    std::printf("%s ", ok ? "ok  " : "FAIL");
    va_list a;
    va_start(a, fmt);
    std::vprintf(fmt, a);
    va_end(a);
    std::printf("\n");
}

constexpr double SR = 48000;
enum { S_OFF = 0, S_VEL, S_MW, S_AT, S_PB, S_KEY, S_LFO1, S_LFO2, S_FENV, S_AENV, S_SH, S_RND, S_LFO3, S_LFO4 };
const char* const kSrc[14] = {"OFF", "VELOCITY", "MOD WHEEL", "AFTERTOUCH", "PITCH BEND", "KEY", "LFO 1", "LFO 2", "FILTER ENV", "AMP ENV", "S&H", "RANDOM", "LFO 3", "LFO 4"};

/* ---------------- le moteur seul ---------------- */

using KV = std::vector<std::pair<std::string, double>>;

// Une suite de notes (hauteurs et velocites qui changent), avec les controleurs ; n echantillons par blocs de block
std::vector<float> engineRender(const KV& kv, int n, int block = 128, std::vector<double>* taps = nullptr, int tapRow = 0) {
    mmarp::VoyagerOptions o;
    o.sampleRate = SR;
    o.os = 4;
    o.seed = 808;
    mmarp::Voyager v(o, {{"cutoff", 900}, {"res", 0.35}, {"lfoAmt", 0.2}, {"lfoBeats", 1}, {"lfoShape", 4}, {"bpm", 120}});
    v.params(kv);
    v.modWheel(0.6);
    v.aftertouch(0.3);
    v.pitchBend(0.2);
    for (int k = 0; k < 16; ++k) v.note(0.05 + 0.15 * k, 48 + (k * 7) % 24, 0.12, 1, std::nan(""), 0, 0.2 + 0.05 * (k % 16));
    std::vector<float> L(static_cast<size_t>(n)), R(static_cast<size_t>(n));
    mmarp::Voyager::ModTap tp[mmarp::Voyager::kModTaps];
    for (int i = 0; i < n; i += block) {
        const int m = std::min(block, n - i);
        v.process(L.data() + i, R.data() + i, m);
        if (taps) {
            v.modTaps(tp);
            taps->push_back(tp[tapRow].v);
        }
    }
    L.insert(L.end(), R.begin(), R.end());
    return L;
}

// Les passages par zero montants d'une suite echantillonnee a rate par seconde : la frequence moyenne entre le premier
// et le dernier
double freqOf(const std::vector<double>& x, double rate, double skip = 0.3) {
    double mean = 0;
    const size_t s = static_cast<size_t>(skip * rate);
    if (x.size() <= s + 4) return 0;
    for (size_t i = s; i < x.size(); ++i) mean += x[i];
    mean /= static_cast<double>(x.size() - s);
    double first = -1, last = -1;
    int n = 0;
    for (size_t i = s + 1; i < x.size(); ++i)
        if (x[i - 1] < mean && x[i] >= mean) {
            const double t = (static_cast<double>(i) - 1 + (mean - x[i - 1]) / (x[i] - x[i - 1])) / rate;
            if (first < 0) first = t;
            last = t;
            ++n;
        }
    return n >= 2 ? (n - 1) / (last - first) : 0;
}

void engineTests() {
    std::printf("-- le moteur seul\n");
    const int N = static_cast<int>(SR * 2.4);
    // 1. les cles neuves a leur neutre (posees) : la sortie d'avant
    {
        const std::vector<float> a = engineRender({}, N);
        KV kv = {{"l1Free", 0}, {"l1Hz", 0.24}, {"l2Free", 0}, {"l2Hz", 3}};
        for (int r = 1; r <= 8; ++r) {
            kv.push_back({"x" + std::to_string(r) + "Src", 0});
            kv.push_back({"x" + std::to_string(r) + "Dst", 0});
            kv.push_back({"x" + std::to_string(r) + "Amt", 0});
        }
        kv.push_back({"x3Src", S_LFO1});  // une source et une cible, quantite 0 : rien
        kv.push_back({"x3Dst", 10});
        const std::vector<float> b = engineRender(kv, N);
        check(a == b, "moteur : LFO SYNC, 8 lignes xN au repos (une avec source et cible a 0 %%) : au bit pres comme avant");
    }
    // 2. une ligne xN = une ligne mN, au bit pres : les 11 sources communes x les 19 destinations
    {
        int same = 0, total = 0;
        double worst = 0;
        for (int s = 1; s <= 11; ++s)
            for (int d = 1; d <= 19; ++d) {
                const double amt = (s + d) % 2 ? 0.7 : -0.55;
                const int row = 1 + (s + d) % 6, xr = 1 + (s * 3 + d) % 8;
                const std::vector<float> a =
                    engineRender({{"m" + std::to_string(row) + "Src", s}, {"m" + std::to_string(row) + "Dst", d}, {"m" + std::to_string(row) + "Amt", amt}, {"l2Dest", 0}}, N / 6);
                const std::vector<float> b =
                    engineRender({{"x" + std::to_string(xr) + "Src", s}, {"x" + std::to_string(xr) + "Dst", d}, {"x" + std::to_string(xr) + "Amt", amt}, {"l2Dest", 0}}, N / 6);
                ++total;
                if (a == b) ++same;
                for (size_t i = 0; i < a.size(); ++i) worst = std::max(worst, static_cast<double>(std::fabs(a[i] - b[i])));
            }
        check(same == total, "moteur : ligne xN = ligne mN au bit pres, %d / %d (11 sources x 19 destinations ; ecart max %.3g)", same, total, worst);
        // deux lignes sur la meme destination (l'ordre des sommes : les lignes mN d'abord, puis xN)
        const std::vector<float> a = engineRender({{"m1Src", S_LFO1}, {"m1Dst", 10}, {"m1Amt", 0.5}, {"m4Src", S_VEL}, {"m4Dst", 10}, {"m4Amt", -0.3}}, N / 3);
        const std::vector<float> b = engineRender({{"m1Src", S_LFO1}, {"m1Dst", 10}, {"m1Amt", 0.5}, {"x2Src", S_VEL}, {"x2Dst", 10}, {"x2Amt", -0.3}}, N / 3);
        check(a == b, "moteur : mN + xN sur CUTOFF = deux lignes mN, au bit pres");
    }
    // 3. LFO 1 / LFO 2 en FREE : la frequence (la contribution d'une ligne xN vers une cible hors du moteur, tous les 128)
    {
        const double rate = SR / 128;
        std::vector<double> t1, t2, t3;
        engineRender({{"l1Free", 1}, {"l1Hz", 2.5}, {"lfoShape", 0}, {"x1Src", S_LFO1}, {"x1Dst", 40}, {"x1Amt", 1}}, static_cast<int>(SR * 6), 128, &t1, 0);
        engineRender({{"l2Free", 1}, {"l2Hz", 3.7}, {"l2Shape", 0}, {"x5Src", S_LFO2}, {"x5Dst", 41}, {"x5Amt", 1}}, static_cast<int>(SR * 6), 128, &t2, 4);
        // SYNC (le defaut) : lfoBeats 1 a 120 bpm, 2 Hz, comme avant
        engineRender({{"lfoShape", 0}, {"x1Src", S_LFO1}, {"x1Dst", 40}, {"x1Amt", 1}}, static_cast<int>(SR * 6), 128, &t3, 0);
        const double f1 = freqOf(t1, rate), f2 = freqOf(t2, rate), f3 = freqOf(t3, rate);
        check(std::fabs(f1 / 2.5 - 1) < 0.01 && std::fabs(f2 / 3.7 - 1) < 0.01 && std::fabs(f3 / 2 - 1) < 0.01,
              "moteur : LFO 1 FREE 2.5 Hz mesure %.3f, LFO 2 FREE 3.7 Hz mesure %.3f, LFO 1 SYNC (1 temps, 120 bpm) %.3f Hz", f1, f2, f3);
    }
    // 4. LFO 3 / 4 donnes par extLfo : la contribution suit la valeur donnee (fin de bloc)
    {
        mmarp::VoyagerOptions o;
        mmarp::Voyager v(o);
        v.params({{"x2Src", S_LFO3}, {"x2Dst", 50}, {"x2Amt", 0.5}, {"x7Src", S_LFO4}, {"x7Dst", 60}, {"x7Amt", -1}});
        std::vector<float> L(128), R(128);
        for (int k = 0; k < 200; ++k) {
            v.extLfo(0.8, -0.4);
            v.process(L.data(), R.data(), 128);
        }
        mmarp::Voyager::ModTap tp[mmarp::Voyager::kModTaps];
        v.modTaps(tp);
        check(tp[1].dst == 50 && std::fabs(tp[1].v - 0.4) < 1e-9 && tp[6].dst == 60 && std::fabs(tp[6].v - 0.4) < 1e-9 && tp[0].dst == 0 && std::fabs(tp[0].v) < 1e-300,
              "moteur : LFO 3 et LFO 4 (extLfo) vers des cibles hors du moteur : contributions %.4f, %.4f", tp[1].v, tp[6].v);
    }
}

/* ---------------- le processeur ---------------- */

struct Head final : juce::AudioPlayHead {
    bool playing = false;
    double ppq = 0, bpm = 120;
    juce::Optional<PositionInfo> getPosition() const override {
        PositionInfo p;
        p.setIsPlaying(playing);
        p.setBpm(bpm);
        p.setPpqPosition(ppq);
        return p;
    }
};

juce::String program(const char* prog = "[0,5]") {
    return juce::String(R"({"v":2,"kind":"arp","bpm":120,"swing":0,"seq":{"edit":false,"len":8,"buf":[0,2,4,null,7,4,2,0,0,0,0,0,0,0,0,0]},"prog":)") + prog + R"(,"knobs":{}})";
}

void set(MMArpProcessor& p, const char* id, double v) {
    const int i = mmx::allIndex(id);
    if (i < 0) {
        std::printf("reglage inconnu : %s\n", id);
        std::exit(2);
    }
    p.knobParam(i)->setValueNotifyingHost(static_cast<float>(v));
}
// Un emplacement : source (cran), cible (code), quantite (-1..1)
void slot(MMArpProcessor& p, int n, int src, int code, double amt) {
    const std::string b = "xMx" + std::to_string(n);
    set(p, (b + "Src").c_str(), src / 13.0);
    set(p, (b + "Dst").c_str(), code / 1023.0);
    set(p, (b + "Amt").c_str(), 0.5 + 0.5 * amt);
}
int codeOf(const char* id) { return mmx::kModDstBase + mmx::allIndex(id); }

struct Run {
    std::vector<float> L;
    std::vector<double> w;  // la valeur de travail (effective) du reglage suivi, apres chaque bloc
    bool finite = true;
    long allocs = 0;
};

// n echantillons par blocs de block ; des notes MIDI (hauteurs, velocites qui changent) si notes ; le reglage k suivi
Run render(MMArpProcessor& p, Head& h, int n, int block, int k, bool notes, int cc1 = -1, int at = -1, int bend = -1, const std::function<void(int)>& each = {}) {
    Run r;
    juce::AudioBuffer<float> buf(2, block);
    int done = 0, idx = 0;
    while (done < n) {
        const int m = std::min(block, n - done);
        buf.setSize(2, m, false, false, true);
        juce::MidiBuffer midi;
        if (done == 0) {
            if (cc1 >= 0) midi.addEvent(juce::MidiMessage::controllerEvent(1, 1, cc1), 0);
            if (at >= 0) midi.addEvent(juce::MidiMessage::channelPressureChange(1, at), 0);
            if (bend >= 0) midi.addEvent(juce::MidiMessage::pitchWheel(1, bend), 0);
        }
        if (notes) {
            // une note tous les 0.2 s (hauteur et velocite changent), 0.15 s
            const int per = static_cast<int>(SR * 0.2);
            for (int i = 0; i < m; ++i) {
                const int f = done + i;
                if (f % per == 0) {
                    ++idx;
                    midi.addEvent(juce::MidiMessage::noteOn(1, 48 + (idx * 5) % 24, static_cast<juce::uint8>(30 + (idx * 37) % 97)), i);
                } else if (f % per == static_cast<int>(SR * 0.15))
                    midi.addEvent(juce::MidiMessage::noteOff(1, 48 + (idx * 5) % 24), i);
            }
        }
        if (each) each(done);
        const long a0 = gAllocs.load();
        gCount.store(true);
        p.processBlock(buf, midi);
        gCount.store(false);
        r.allocs += gAllocs.load() - a0;
        for (int i = 0; i < m; ++i) {
            const float v = buf.getSample(0, i);
            if (!std::isfinite(v) || !std::isfinite(buf.getSample(1, i))) r.finite = false;
            r.L.push_back(v);
        }
        if (k >= 0) r.w.push_back(p.workValue(k));
        if (h.playing) h.ppq += m * h.bpm / 60.0 / SR;
        done += m;
    }
    return r;
}

// Une instance prete : la face a donne son programme, l'arpege joue (playing) ou non
struct Inst {
    MMArpProcessor p;
    Head h;
    explicit Inst(bool playing, const char* prog = "[0,5]") {
        // la meme graine pour toutes les instances (le hasard du moteur et de l'arpege : DRIFT, RAND...), par l'etat
        {
            juce::MemoryBlock mb;
            p.getStateInformation(mb);
            auto xml = juce::AudioProcessor::getXmlFromBinary(mb.getData(), static_cast<int>(mb.getSize()));
            juce::ValueTree st = juce::ValueTree::fromXml(*xml);
            st.setProperty("seed", 777, nullptr);
            juce::MemoryBlock m2;
            juce::AudioProcessor::copyXmlToBinary(*st.createXml(), m2);
            p.setStateInformation(m2.getData(), static_cast<int>(m2.getSize()));
        }
        p.setPlayHead(&h);
        p.faceProgram(program(prog));
        h.playing = playing;
        // les notes MIDI de ce banc jouent par-dessus l'arpege
        if (auto* prm = p.apvts.getParameter("prio")) prm->setValueNotifyingHost(0.f);
    }
    void prepare(int block) { p.prepareToPlay(SR, block); }
};

double rmsOf(const std::vector<float>& x, size_t from = 0) {
    double e = 0;
    for (size_t i = from; i < x.size(); ++i) e += static_cast<double>(x[i]) * x[i];
    return std::sqrt(e / std::max<size_t>(1, x.size() - from));
}
// Le clic : la plus grande derivee seconde, rapportee a la valeur efficace (sur ce qui suit from)
double clickOf(const std::vector<float>& x, size_t from) {
    double mx = 0;
    for (size_t i = std::max<size_t>(from, 2); i < x.size(); ++i) mx = std::max(mx, std::fabs(static_cast<double>(x[i]) - 2.0 * x[i - 1] + x[i - 2]));
    return mx / std::max(1e-9, rmsOf(x, from));
}

void processorTests() {
    std::printf("-- le processeur (MMARP_HEADLESS)\n");
    const int N = static_cast<int>(SR * 3);
    // 1. rien d'actif : au bit pres comme une instance sans emplacement ; un emplacement a 0 %, ou sans cible : idem
    {
        Inst a(true), b(true);
        slot(b.p, 2, S_LFO1, codeOf("xDlFb"), 0);    // quantite 0
        slot(b.p, 5, S_LFO2, 25, 0.8);              // un code sans cible ("---")
        slot(b.p, 7, S_OFF, codeOf("cutoff"), 0.8);  // source OFF
        a.prepare(256);
        b.prepare(256);
        const Run ra = render(a.p, a.h, N, 256, -1, false), rb = render(b.p, b.h, N, 256, -1, false);
        check(ra.L == rb.L && !b.p.modSliced() && rmsOf(ra.L) > 1e-3, "processeur : emplacements au repos (0 %%, \"---\", source OFF) : au bit pres comme sans, chemin d'avant (%s)",
              b.p.modSliced() ? "tranches" : "bloc entier");
    }
    // 2. xMx = xM (destination synthe), le processeur entier : au bit pres
    {
        int same = 0;
        const int combos[5][3] = {{S_LFO1, 10, 0}, {S_VEL, 14, 1}, {S_MW, 3, 2}, {S_RND, 15, 3}, {S_FENV, 12, 4}};
        for (const auto& c : combos) {
            Inst a(true), b(true);
            const std::string m = "xM" + std::to_string(c[2] + 1);
            set(a.p, (m + "Src").c_str(), c[0] / 11.0);
            set(a.p, (m + "Dst").c_str(), c[1] / 19.0);
            set(a.p, (m + "Amt").c_str(), 0.8);
            slot(b.p, 8 - c[2], c[0], c[1], 0.6);
            a.prepare(128);
            b.prepare(128);
            const Run ra = render(a.p, a.h, N / 2, 128, -1, true, 90), rb = render(b.p, b.h, N / 2, 128, -1, true, 90);
            if (ra.L == rb.L && rmsOf(ra.L) > 1e-3) ++same;
        }
        check(same == 5, "processeur : emplacement xMx (destination synthe) = ligne xM de la page SEQ, au bit pres : %d / 5", same);
    }
    // 3. chaque source vers une cible generique (MASTER WIDTH, 0.5 + source) : la valeur effective bouge ou vaut la source
    {
        const int k = mmx::allIndex("xWidth");
        std::string line;
        bool all = true;
        for (int s = 1; s <= 13; ++s) {
            Inst a(true, "[]");
            slot(a.p, 1 + s % 8, s, codeOf("xWidth"), 1);
            if (s == S_LFO4) set(a.p, "xLfo4Sync", 0), set(a.p, "xLfo4Rate", 0.6);
            if (s == S_LFO3) set(a.p, "xDLfoRate", 0.6);
            if (s == S_LFO2) set(a.p, "xLfo2Sync", 0), set(a.p, "xLfo2Hz", 0.6);
            a.prepare(64);
            const Run r = render(a.p, a.h, static_cast<int>(SR * 2), 64, k, true, s == S_MW ? 127 : -1, s == S_AT ? 40 : -1, s == S_PB ? 0 : -1);
            double lo = 9, hi = -9;
            bool fin = r.finite;
            for (size_t i = r.w.size() / 4; i < r.w.size(); ++i) {
                lo = std::min(lo, r.w[i]);
                hi = std::max(hi, r.w[i]);
                fin = fin && std::isfinite(r.w[i]);
            }
            const double last = r.w.back();
            bool ok;
            if (s == S_MW) ok = std::fabs(last - 1.0) < 1e-6;                    // 0.5 + 1, bornee a 1
            else if (s == S_AT) ok = std::fabs(last - (0.5 + 40 / 127.0)) < 1e-4;  // 0.5 + 0.315
            else if (s == S_PB) ok = std::fabs(last - 0.0) < 1e-6;              // 0.5 - 1, bornee a 0
            else ok = hi - lo > 0.05;
            ok = ok && fin && r.allocs == 0;
            all = all && ok;
            char b[96];
            std::snprintf(b, sizeof(b), "%s%s %.2f..%.2f", line.empty() ? "" : ", ", kSrc[s], lo, hi);
            line += b;
            if (!ok) line += " (KO)";
        }
        check(all, "processeur : les 13 sources vers MASTER WIDTH (0.5 + source, sans allocation) : %s", line.c_str());
    }
    // 4. une cible generique par famille : MOD WHEEL a fond (1), quantite +40 % : valeur effective = hote + 0.4 (bornee) ;
    // le reglage agit (la sortie change), finie, sans clic (LFO 4 carre a 4 Hz, quantite 40 %), sans allocation
    {
        struct Fam {
            const char* fam;
            const char* id;
            double host;
            const char* setup;
        };
        const Fam fams[] = {
            {"synthe", "osc2", 0.3, ""},           {"synthe (env)", "aD", 0.2, ""},       {"filtre", "xHpf", 0.2, ""},
            {"arpege", "gate", 0.3, ""},           {"LFO", "lfoAmt", 0.2, "lfo"},       {"SOUND", "xPhMix", 0.3, ""},
            {"SOUND (EQ)", "xQ3Gain", 0.3, "eq"},  {"DISTO", "xDMix", 0.3, "disto"},    {"DELAY", "xDlFb", 0.3, ""},
            {"DELAY (mix)", "delay", 0.3, ""},     {"HELL", "xHellMix", 0.45, ""},       {"REVERB", "xSkyDecay", 0.3, ""},
            {"REVERB (mix)", "reverb", 0.3, ""},   {"MASTER", "volume", 0.5, ""},       {"MASTER", "xWarmth", 0.2, ""},
        };
        for (const Fam& f : fams) {
            const int k = mmx::allIndex(f.id);
            const auto prep = [&](Inst& a) {
                set(a.p, f.id, f.host);
                if (!std::strcmp(f.setup, "disto")) set(a.p, "dist", 0.6), set(a.p, "xDStyle", 1.0 / 12);
                if (!std::strcmp(f.setup, "eq")) set(a.p, "xQ3On", 1);
                if (!std::strcmp(f.setup, "lfo")) set(a.p, "lfoDest", 0.25);
            };
            // a : sans modulation ; b : MOD WHEEL (1) x 40 % ; c : LFO 4 carre 4 Hz x 40 % (le clic) ; e : le meme carre par
            // l'automation de l'hote, un bloc de 256 apres l'autre, sans lissage (la reference : ce que l'hote fait deja)
            Inst a(true), b(true), c(true), e(true);
            prep(a);
            prep(b);
            prep(c);
            prep(e);
            slot(b.p, 3, S_MW, codeOf(f.id), 0.4);
            slot(c.p, 6, S_LFO4, codeOf(f.id), 0.4);
            set(c.p, "xLfo4Sync", 0);
            set(c.p, "xLfo4Shape", 4.0 / 6);
            set(c.p, "xLfo4Rate", std::log(4.0 / 0.02) / std::log(500.0));
            a.prepare(256);
            b.prepare(256);
            c.prepare(256);
            e.prepare(256);
            const Run ra = render(a.p, a.h, N, 256, k, false, 127), rb = render(b.p, b.h, N, 256, k, false, 127), rc = render(c.p, c.h, N, 256, k, false, 127);
            const double hv = ra.w.back();
            const Run re = render(e.p, e.h, N, 256, k, false, 127, -1, -1, [&](int done) {
                const bool up = (done * 8 / static_cast<int>(SR)) % 2 == 0;
                set(e.p, f.id, std::clamp(hv + (up ? 0.4 : -0.4), 0.0, 1.0));
            });
            // la valeur hote telle que le processeur la lit (un potard du site : au millieme)
            const double host = ra.w.back();
            const double want = std::min(1.0, host + 0.4);
            const bool val = std::fabs(rb.w.back() - want) < 1e-6;
            double d = 0;
            for (size_t i = 0; i < ra.L.size(); ++i) d = std::max(d, static_cast<double>(std::fabs(ra.L[i] - rb.L[i])));
            const size_t from = static_cast<size_t>(SR * 0.5);
            const double ca = clickOf(ra.L, from), cb = clickOf(rb.L, from), cc = clickOf(rc.L, from), ce = clickOf(re.L, from);
            double lo = 9, hi = -9;
            for (size_t i = rc.w.size() / 4; i < rc.w.size(); ++i) lo = std::min(lo, rc.w[i]), hi = std::max(hi, rc.w[i]);
            const bool ok = val && d > 1e-4 && ra.finite && rb.finite && rc.finite && (cc < 3 * ca + 0.5 || cc < 1.2 * ce) && rb.allocs == 0 && rc.allocs == 0 && hi - lo > 0.3;
            check(ok, "processeur : %s, %s : hote %.3f -> effective %.4f (attendu %.4f), sortie changee de %.3g, LFO 4 carre %.2f..%.2f, clic %.2f (sans : %.2f ; MOD WHEEL fixe : %.2f ; le carre par l'hote : %.2f), allocations %ld",
                  f.fam, f.id, host, rb.w.back(), want, d, lo, hi, cc, ca, cb, ce, rb.allocs + rc.allocs);
        }
    }
    // 5. FILTER CUTOFF (chemin par voix : CUTOFF x 9.3 / 4) : l'arc de la face = potard + source x quantite, borne ; le son
    // = celui de la destination synthe CUTOFF a la quantite equivalente (a l'arrondi du float de l'hote pres)
    {
        Inst a(true), b(true);
        set(a.p, "cutoff", 0.4);
        set(b.p, "cutoff", 0.4);
        slot(a.p, 4, S_MW, codeOf("cutoff"), 0.3);
        slot(b.p, 4, S_MW, 10, 0.3 * 9.3 / 4);
        a.prepare(128);
        b.prepare(128);
        const Run ra = render(a.p, a.h, N, 128, -1, false, 127), rb = render(b.p, b.h, N, 128, -1, false, 127);
        double d = 0;
        for (size_t i = 0; i < ra.L.size(); ++i) d = std::max(d, static_cast<double>(std::fabs(ra.L[i] - rb.L[i])));
        const int sk = a.p.modShowK(3);
        const float sv = a.p.modShowV(3);
        check(!a.p.modSliced() && sk == mmx::allIndex("cutoff") && std::fabs(sv - 0.7f) < 1e-3f && d < 1e-3 && rmsOf(ra.L) > 1e-3,
              "processeur : FILTER CUTOFF par le chemin par voix (sans tranches) : arc %.4f (attendu 0.7), ecart avec CUTOFF %.2e (valeur efficace %.3f)", sv, d, rmsOf(ra.L));
    }
    // 6. LFO 4 : FREE (frequence), SYNC (frequence au tempo, phase calee sur le transport) ; LFO 3 a la vitesse de la DISTO
    {
        const int k = mmx::allIndex("xWidth");
        const double rate = SR / 32;
        Inst a(false, "[]"), b(true, "[]"), c(true, "[]"), d(false, "[]");
        slot(a.p, 1, S_LFO4, codeOf("xWidth"), 0.5);
        set(a.p, "xLfo4Sync", 0);
        set(a.p, "xLfo4Rate", std::log(3.3 / 0.02) / std::log(500.0));
        slot(b.p, 1, S_LFO4, codeOf("xWidth"), 0.5);
        set(b.p, "xLfo4Rate", 4.0 / 8);  // SYNC : le 5e cran, 2 temps par cycle
        b.h.bpm = 150;
        slot(c.p, 1, S_LFO4, codeOf("xWidth"), 0.5);
        set(c.p, "xLfo4Rate", 4.0 / 8);
        c.h.bpm = 150;
        c.h.ppq = 0.5;  // un quart de cycle plus loin
        slot(d.p, 1, S_LFO3, codeOf("xWidth"), 0.5);
        set(d.p, "xDLfoRate", std::log(1.7 / 0.02) / std::log(500.0));
        set(d.p, "xDLfoShape", 1.0 / 4);  // TRI
        set(d.p, "xDLfoSync", 0);         // FREE
        a.prepare(32);
        b.prepare(32);
        c.prepare(32);
        d.prepare(32);
        const Run ra = render(a.p, a.h, static_cast<int>(SR * 6), 32, k, false), rb = render(b.p, b.h, static_cast<int>(SR * 6), 32, k, false),
                  rc = render(c.p, c.h, static_cast<int>(SR * 6), 32, k, false), rd = render(d.p, d.h, static_cast<int>(SR * 6), 32, k, false);
        const double fa = freqOf(ra.w, rate), fb = freqOf(rb.w, rate), fd = freqOf(rd.w, rate);
        // SYNC cale : b au temps t a la meme valeur que c au temps t - 0.5 temps (c est parti un quart de cycle plus loin)
        const size_t lag = static_cast<size_t>(std::lround(0.5 * 60 / 150.0 * rate));
        double dm = 0;
        for (size_t i = rb.w.size() / 2; i < rb.w.size(); ++i) dm = std::max(dm, std::fabs(rb.w[i] - rc.w[i - lag]));
        check(std::fabs(fa / 3.3 - 1) < 0.01 && std::fabs(fb / 1.25 - 1) < 0.01 && dm < 0.01 && std::fabs(fd / 1.7 - 1) < 0.01,
              "processeur : LFO 4 FREE 3.3 Hz mesure %.3f, SYNC 2 temps a 150 bpm (1.25 Hz) mesure %.3f, cale sur le transport (ecart %.4f), LFO 3 1.7 Hz mesure %.3f", fa, fb, dm, fd);
    }
    // 7. tout coupe : la cible reprend la valeur de l'hote, retour au chemin d'avant (bloc entier)
    {
        Inst a(true);
        const int k = mmx::allIndex("xDlFb");
        set(a.p, "xDlFb", 0.3);
        slot(a.p, 2, S_LFO1, codeOf("xDlFb"), 0.5);
        a.prepare(128);
        render(a.p, a.h, static_cast<int>(SR), 128, k, false);
        const bool sliced = a.p.modSliced();
        set(a.p, "xMx2Amt", 0.5);
        const Run r = render(a.p, a.h, static_cast<int>(SR * 0.5), 128, k, false);
        check(sliced && !a.p.modSliced() && std::fabs(r.w.back() - 0.3) < 1e-6 && a.p.modShowK(1) < 0,
              "processeur : emplacement coupe : DELAY FEEDBACK revient a l'hote (%.4f), plus de tranches, plus d'arc", r.w.back());
    }
}

} // namespace

int main() {
    juce::ScopedJuceInitialiser_GUI init;
    engineTests();
    processorTests();
    std::printf("mod_test : %d controles, %d echecs\n", gChecks, gFails);
    return gFails ? 1 : 0;
}
