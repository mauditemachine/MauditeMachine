// Tests du moteur temps reel, sans hote ni carte son : tout se lit dans les buffers (jamais de lecture audio).
#include "../dsp/Engine.h"

#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

static int fails = 0;
#define CHECK(c, msg)                         \
    do {                                      \
        if (!(c)) {                           \
            std::printf("KO  %s\n", msg);     \
            ++fails;                          \
        } else std::printf("OK  %s\n", msg);  \
    } while (0)

static double energy(const std::vector<float>& x, int a, int b) {
    double e = 0;
    for (int i = a; i < b; ++i) e += static_cast<double>(x[static_cast<size_t>(i)]) * x[static_cast<size_t>(i)];
    return e;
}

static const double SR = 48000;

// Un programme : le kit du site (BD 909 mono, SD, CH choke 1, OH choke 1 gated), un son par piste
static std::shared_ptr<mm::PlayState> makeState(mm::Program p) {
    auto ps = std::make_shared<mm::PlayState>();
    ps->prog = p;
    for (const auto& s : p.sounds) {
        auto r = std::make_shared<mm::RenderedSound>();
        r->variants.push_back(mm::renderLayers(s.id, SR / s.pf, s.ts, 0, s.tw, nullptr));
        ps->sounds.push_back(r);
    }
    return ps;
}

static mm::Program baseProgram() {
    mm::Program p;
    p.len = 16;
    const mm::ShotId ids[4] = {mm::ShotId::BD, mm::ShotId::SD, mm::ShotId::CH, mm::ShotId::OH};
    for (int k = 0; k < 4; ++k) {
        mm::ProgSound s;
        s.id = ids[k];
        s.tw.model = k == 0 ? mm::KitModel::K909 : mm::KitModel::MM;
        p.sounds.push_back(s);
        auto& t = p.tracks[static_cast<size_t>(k)];
        t.live.snd = k;
    }
    p.tracks[0].mono = true;
    p.tracks[2].choke = 1;
    p.tracks[3].choke = 1;
    p.tracks[3].gated = true;
    p.tracks[3].mono = true;
    return p;
}

static mm::LiveHit live(const mm::PlayState& ps, int t) {
    mm::LiveHit h;
    h.track = t;
    h.hit = ps.prog.tracks[static_cast<size_t>(t)].live;
    h.slice = ps.prog.tracks[static_cast<size_t>(t)].slice;
    h.snd = ps.sounds[static_cast<size_t>(h.hit.snd)].get();
    return h;
}

int main() {
    const int n = 4800;
    std::vector<float> L(n), R(n);
    auto clear = [&] {
        std::fill(L.begin(), L.end(), 0.f);
        std::fill(R.begin(), R.end(), 0.f);
    };
    mm::BlockTransport stop;

    // 1. un coup en direct : du son des le debut du bloc
    {
        mm::Engine e;
        e.prepare(SR);
        auto ps = makeState(baseProgram());
        e.publish(ps);
        e.pushLive(live(*ps, 0));
        clear();
        e.process(stop, L.data(), R.data(), n);
        CHECK(energy(L, 0, n) > 1, "coup en direct : le kick sonne");
    }

    // 2. le sequenceur : le kick sur 0 4 8 12 a 120 BPM, un coup a chaque noire, a l'echantillon pres
    {
        mm::Program p = baseProgram();
        for (int g : {0, 4, 8, 12}) {
            mm::ProgHit h = p.tracks[0].live;
            h.g = g;
            p.tracks[0].hits.push_back(h);
        }
        mm::Engine e;
        e.prepare(SR);
        e.publish(makeState(p));
        const double pps = 120.0 / 60.0 / SR; // noires par echantillon
        std::vector<int> steps;
        double ppq = 0;
        int lastSeq = 0;
        // 4 s a 120 BPM : 8 noires, 32 seiziemes
        for (int b = 0; b < 1200; ++b) {
            clear();
            mm::BlockTransport tr{true, ppq, pps};
            e.process(tr, L.data(), R.data(), 160);
            if (e.fbSeq.load() != lastSeq) {
                lastSeq = e.fbSeq.load();
                steps.push_back(e.fbStep.load());
            }
            ppq += 160 * pps;
        }
        bool ok = steps.size() >= 32;
        for (size_t i = 0; i < steps.size() && i < 32; ++i) ok = ok && steps[i] == static_cast<int>(i % 16);
        CHECK(ok, "sequenceur : les pas 0 a 15 dans l'ordre, cale sur la position de l'hote");
    }

    // 3. le swing : le pas 1 part a 0.25 + swing x 0.25 noire
    {
        mm::Program p = baseProgram();
        p.swing = 0.1;
        std::vector<double> at;
        const double pps = 120.0 / 60.0 / SR;
        double ppq = 0;
        for (int b = 0; b < 40; ++b) {
            mm::forEachStep(p, &mm::programStepOf, ppq, pps, 512, [&](int g, int off) {
                if (g < 3) at.push_back(ppq + off * pps);
            });
            ppq += 512 * pps;
        }
        CHECK(at.size() >= 3 && std::fabs(at[1] - 0.275) < 2 * pps && std::fabs(at[2] - 0.5) < 2 * pps, "swing : le pas impair en retard, le pair a sa place");
    }

    // 4. aucun pas perdu ni double sur une frontiere de bloc (blocs de 37), longueur 12, page bouclee
    {
        mm::Program p = baseProgram();
        p.len = 12;
        int hits0 = 0, total = 0;
        const double pps = 120.0 / 60.0 / SR;
        double ppq = 0;
        for (int b = 0; b < 3000; ++b) {
            mm::forEachStep(p, &mm::programStepOf, ppq, pps, 37, [&](int g, int) {
                ++total;
                if (g == 0) ++hits0;
            });
            ppq += 37 * pps;
        }
        const int expected = static_cast<int>(std::floor(ppq * 4)) + 1;
        CHECK(std::abs(total - expected) <= 1 && std::abs(hits0 - (expected + 11) / 12) <= 1, "pas : un par seizieme, la longueur 12 boucle");
        p.len = 64;
        p.loop = 2;
        bool inPage = true;
        ppq = 0;
        for (int b = 0; b < 200; ++b) {
            mm::forEachStep(p, &mm::programStepOf, ppq, pps, 256, [&](int g, int) { inPage = inPage && g >= 32 && g < 48; });
            ppq += 256 * pps;
        }
        CHECK(inPage, "page bouclee : seulement les pas 33 a 48");
    }

    // 5. le kick mono : un second coup coupe le premier en 3 ms
    {
        mm::Engine e;
        e.prepare(SR);
        mm::Program p = baseProgram();
        mm::ProgHit h0 = p.tracks[0].live;
        h0.g = 0;
        mm::ProgHit h1 = h0;
        h1.g = 1;
        p.tracks[0].hits = {h0, h1};
        e.publish(makeState(p));
        mm::Engine solo;
        solo.prepare(SR);
        mm::Program q = baseProgram();
        q.tracks[0].hits = {h1};
        solo.publish(makeState(q));
        // 1 seizieme a 120 BPM = 6000 echantillons ; deux blocs de 9000
        std::vector<float> a(18000), b(18000), ra(18000), rb(18000);
        const double pps = 120.0 / 60.0 / SR;
        e.process({true, 0, pps}, a.data(), ra.data(), 9000);
        e.process({true, 9000 * pps, pps}, a.data() + 9000, ra.data() + 9000, 9000);
        solo.process({true, 0, pps}, b.data(), rb.data(), 9000);
        solo.process({true, 9000 * pps, pps}, b.data() + 9000, rb.data() + 9000, 9000);
        double diff = 0;
        for (int i = 6000 + 200; i < 18000; ++i) diff = std::max(diff, std::fabs(static_cast<double>(a[static_cast<size_t>(i)]) - b[static_cast<size_t>(i)]));
        CHECK(diff < 1e-6, "kick mono : apres 3 ms, seul le second coup sonne");
    }

    // 6. le choke : CH ferme l'OH (porte du groupe 1) en 8 ms
    {
        mm::Engine e;
        e.prepare(SR);
        mm::Program p = baseProgram();
        p.tracks[2].slice = 0; // on n'ecoute que l'OH
        auto ps = makeState(p);
        e.publish(ps);
        e.pushLive(live(*ps, 3));
        clear();
        e.process(stop, L.data(), R.data(), 1000);
        e.pushLive(live(*ps, 2));
        std::vector<float> L2(n), R2(n);
        e.process(stop, L2.data(), R2.data(), n);
        CHECK(energy(L, 0, 1000) > 0 && energy(L2, 400, n) == 0, "choke : CH ferme l'OH en 8 ms");
    }

    // 7. l'enveloppe : DECAY court (tau 5 ms) : plus rien apres 7 tau ; ATK : le premier echantillon part de 0
    {
        mm::Engine e;
        e.prepare(SR);
        mm::Program p = baseProgram();
        p.tracks[1].live.tau = 0.005;
        p.tracks[1].live.hold = 0.004;
        p.tracks[1].live.atk = 0.002;
        auto ps = makeState(p);
        e.publish(ps);
        e.pushLive(live(*ps, 1));
        clear();
        e.process(stop, L.data(), R.data(), n);
        const int end = static_cast<int>((0.006 + 7 * 0.005) * SR) + 2;
        CHECK(energy(L, end, n) == 0 && std::fabs(L[0]) < 1e-6 && energy(L, 0, end) > 0, "enveloppe : ATK, HOLD, DECAY, la source s'arrete a 7 tau");
    }

    // 8. le PAN : un son mono tout a gauche ne sort qu'a gauche
    {
        mm::Engine e;
        e.prepare(SR);
        mm::Program p = baseProgram();
        p.tracks[1].live.pan = -1;
        auto ps = makeState(p);
        e.publish(ps);
        e.pushLive(live(*ps, 1));
        clear();
        e.process(stop, L.data(), R.data(), n);
        CHECK(energy(L, 0, n) > 0 && energy(R, 0, n) < 1e-12, "PAN : mono a gauche, rien a droite");
    }

    // 9. la tete de lecture s'efface a l'arret
    {
        mm::Engine e;
        e.prepare(SR);
        e.publish(makeState(baseProgram()));
        const double pps = 120.0 / 60.0 / SR;
        e.process({true, 0, pps}, L.data(), R.data(), 512);
        const bool on = e.fbPlaying.load() && e.fbStep.load() == 0;
        e.process(stop, L.data(), R.data(), 512);
        CHECK(on && !e.fbPlaying.load() && e.fbStep.load() == -1, "retour : lecture, pas courant, arret");
    }

    // ---------------- phase 2 : le sequenceur des trigs (audio/seq.ts) ----------------
    // Un motif d'un pas par piste ; on compte les coups par pas sur plusieurs passages, sans son (on lit les voix jouees)
    struct Run {
        std::vector<int> hitsPerPass; // coups de la piste 1 (SD) par passage
        std::vector<float> peaks;     // crete de chaque passage
    };
    auto runPasses = [&](mm::Program p, int passes, bool fill = false, std::vector<float>* outL = nullptr) {
        mm::Engine e;
        e.prepare(SR);
        e.setFill(fill);
        e.publish(makeState(p));
        const double pps = 120.0 / 60.0 / SR;
        const int block = 250; // divise un pas (6000 echantillons a 120 BPM, 48 kHz)
        const int perPass = static_cast<int>(std::ceil(p.len * 0.25 / pps));
        std::vector<float> l(block), r(block);
        double ppq = 0;
        Run out;
        for (int k = 0; k < passes; ++k) {
            float peak = 0;
            for (int s = 0; s < perPass; s += block) {
                std::fill(l.begin(), l.end(), 0.f);
                std::fill(r.begin(), r.end(), 0.f);
                e.process({true, ppq, pps}, l.data(), r.data(), block);
                for (float x : l) peak = std::max(peak, std::fabs(x));
                if (outL) outL->insert(outL->end(), l.begin(), l.end());
                ppq += block * pps;
            }
            out.peaks.push_back(peak);
        }
        return out;
    };
    auto oneHit = [&](int ck, bool cn, int ca, int cb) {
        mm::Program p = baseProgram();
        p.len = 16;
        mm::ProgHit h = p.tracks[1].live;
        h.g = 0;
        h.ck = ck;
        h.cn = cn;
        h.ca = ca;
        h.cb = cb;
        p.tracks[1].hits = {h};
        return p;
    };
    {
        // A:B 1:2 : passages 1, 3, 5 ; !1:2 : passages 2, 4
        Run a = runPasses(oneHit(6, false, 1, 2), 4);
        Run b = runPasses(oneHit(6, true, 1, 2), 4);
        const bool okA = a.peaks[0] > 0.01f && a.peaks[1] < 1e-6f && a.peaks[2] > 0.01f && a.peaks[3] < 1e-6f;
        const bool okB = b.peaks[0] < 1e-6f && b.peaks[1] > 0.01f && b.peaks[2] < 1e-6f && b.peaks[3] > 0.01f;
        CHECK(okA && okB, "COND A:B : 1:2 joue aux passages impairs, !1:2 aux pairs");
        Run c = runPasses(oneHit(4, false, 0, 0), 3);
        CHECK(c.peaks[0] > 0.01f && c.peaks[1] < 1e-6f && c.peaks[2] < 1e-6f, "COND 1ST : seulement le premier passage");
        Run f0 = runPasses(oneHit(1, false, 0, 0), 2, false);
        Run f1 = runPasses(oneHit(1, false, 0, 0), 2, true);
        CHECK(f0.peaks[0] < 1e-6f && f1.peaks[0] > 0.01f, "COND FILL : joue seulement FILL tenu");
    }
    {
        // PROB 50 % sur 400 passages : entre 35 % et 65 % joues
        mm::Program p = oneHit(0, false, 0, 0);
        p.tracks[1].hits[0].prob = 50;
        p.len = 4; // un passage (4 pas) plus long que la caisse claire : aucune queue d'un passage a l'autre
        Run r = runPasses(p, 400);
        int played = 0;
        for (float pk : r.peaks) played += pk > 0.01f ? 1 : 0;
        CHECK(played > 140 && played < 260, "PROB 50 % : environ un coup sur deux");
        p.tracks[1].hits[0].prob = 0;
        Run z = runPasses(p, 50);
        bool none = true;
        for (float pk : z.peaks) none = none && pk < 1e-6f;
        CHECK(none, "PROB 0 % : jamais");
    }
    {
        // PRE : la piste 2 (CH) a PRE apres la piste 1 a 1:2 ; NEI : la piste 2 suit le resultat de la piste 1 du meme pas
        mm::Program p = oneHit(6, false, 1, 2);
        mm::ProgHit h = p.tracks[2].live;
        h.g = 0;
        h.ck = 3; // NEI
        p.tracks[1].slice = 0; // on n'ecoute que CH
        p.tracks[2].hits = {h};
        Run r = runPasses(p, 4);
        CHECK(r.peaks[0] > 0.001f && r.peaks[1] < 1e-6f && r.peaks[2] > 0.001f && r.peaks[3] < 1e-6f, "COND NEI : suit la voix d'avant au meme pas");
    }
    {
        // uTIME : +12/24 de pas, le coup part un demi-pas plus tard ; -12 un demi-pas plus tot (avance)
        auto firstSample = [&](double shift) {
            mm::Program p = baseProgram();
            p.len = 16;
            mm::ProgHit h = p.tracks[1].live;
            h.g = 4;
            h.shift = shift;
            p.tracks[1].hits = {h};
            std::vector<float> l;
            runPasses(p, 1, false, &l);
            for (size_t i = 0; i < l.size(); ++i)
                if (std::fabs(l[i]) > 1e-7f) return static_cast<long>(i);
            return -1L;
        };
        const long step = static_cast<long>(0.25 / (120.0 / 60.0 / SR)); // 6000
        const long a = firstSample(0), b = firstSample(0.5), c = firstSample(-0.5);
        CHECK(std::labs(a - 4 * step) <= 1 && std::labs(b - (4 * step + step / 2)) <= 1 && std::labs(c - (4 * step - step / 2)) <= 1, "uTIME : en retard et en avance, a l'echantillon pres");
    }
    {
        // RTRG : RATE 1/32 (every 0.5), RLEN 1 pas : 2 coups (le trig et une repetition), VFAD -64 : la repetition plus faible
        mm::Program p = baseProgram();
        p.len = 16;
        mm::ProgHit h = p.tracks[2].live; // CH (court)
        h.g = 0;
        h.rtrg = true;
        h.every = 0.5;
        h.rlen = 1;
        h.vfad = -64;
        p.tracks[2].hits = {h};
        std::vector<float> l;
        runPasses(p, 1, false, &l);
        const long step = static_cast<long>(0.25 / (120.0 / 60.0 / SR));
        auto peakIn = [&](long a, long b) {
            float pk = 0;
            for (long i = a; i < b && i < static_cast<long>(l.size()); ++i) pk = std::max(pk, std::fabs(l[static_cast<size_t>(i)]));
            return pk;
        };
        // la repetition (a step / 2) dure 4320 echantillons : rien apres step + 1500
        const float p0 = peakIn(0, step / 2), p1 = peakIn(step / 2, step), p2 = peakIn(step + 1500, 2 * step);
        CHECK(p0 > 0.01f && p1 > 0.001f && p1 < p0 && p2 < 1e-6f, "RTRG : une repetition a 1/32, VFAD la fait descendre, RLEN l'arrete");
    }
    {
        // LEN 1/4 de pas : plus rien apres 1/4 de pas + 8 ms (l'OH est long)
        mm::Program p = baseProgram();
        p.len = 16;
        mm::ProgHit h = p.tracks[3].live;
        h.g = 0;
        h.len = 0.25;
        p.tracks[3].hits = {h};
        std::vector<float> l;
        runPasses(p, 1, false, &l);
        const long cut = static_cast<long>(0.25 * 0.25 / (120.0 / 60.0 / SR) + 0.008 * SR) + 2;
        double after = 0, before = 0;
        for (size_t i = 0; i < l.size(); ++i) (static_cast<long>(i) < cut ? before : after) += std::fabs(l[i]);
        CHECK(before > 0 && after == 0, "LEN : le coup relache a la fin de LEN");
    }
    {
        // Lock trig : un pas sans son qui baisse le VOL du coup qui sonne (gain 0.1)
        mm::Program p = baseProgram();
        p.len = 16;
        mm::ProgHit h = p.tracks[3].live;
        h.g = 0;
        mm::ProgHit lt = h;
        lt.g = 2;
        lt.lt = true;
        lt.gain = 0.1;
        p.tracks[3].hits = {h, lt};
        std::vector<float> withLt, without;
        runPasses(p, 1, false, &withLt);
        p.tracks[3].hits = {h};
        runPasses(p, 1, false, &without);
        const long step = static_cast<long>(0.25 / (120.0 / 60.0 / SR));
        double a = 0, b = 0;
        for (long i = 2 * step + 1000; i < 3 * step; ++i) {
            a += std::fabs(withLt[static_cast<size_t>(i)]);
            b += std::fabs(without[static_cast<size_t>(i)]);
        }
        bool same = true;
        for (long i = 0; i < 2 * step; ++i) same = same && withLt[static_cast<size_t>(i)] == without[static_cast<size_t>(i)];
        CHECK(same && b > 0 && a < 0.2 * b, "lock trig : le VOL du coup qui sonne baisse au pas du lock trig");
    }

    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "TOUT EST OK", fails, fails > 1 ? "s" : "");
    return fails ? 1 : 0;
}
