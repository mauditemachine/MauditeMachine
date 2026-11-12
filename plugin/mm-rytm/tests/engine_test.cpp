// Tests du moteur temps reel, sans hote ni carte son : tout se lit dans les buffers (jamais de lecture audio).
#include "../dsp/Engine.h"
#include "../dsp/MidiExport.h"

#include <array>
#include <cmath>
#include <cstdlib>
#include <functional>
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
        e.setDry(true);
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
        e.setDry(true);
        e.publish(makeState(p));
        const double pps = 120.0 / 60.0 / SR; // noires par echantillon
        std::vector<int> steps;
        std::vector<int> rels;
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
                rels.push_back(e.fbRel.load());
            }
            ppq += 160 * pps;
        }
        bool ok = steps.size() >= 32;
        for (size_t i = 0; i < steps.size() && i < 32; ++i) ok = ok && steps[i] == static_cast<int>(i % 16);
        CHECK(ok, "sequenceur : les pas 0 a 15 dans l'ordre, cale sur la position de l'hote");
        // LIVE REC (2026-11-11) : les pas depuis le debut du pattern ne repartent pas avec lui (le pas d'une piste a sa
        // longueur, TLEN, est rel modulo TLEN)
        bool okRel = rels.size() >= 32;
        for (size_t i = 0; i < rels.size() && i < 32; ++i) okRel = okRel && rels[i] == static_cast<int>(i);
        CHECK(okRel, "tete de lecture : rel compte les pas depuis le debut du pattern, sans repartir (0, 1 ... 31)");
        clear();
        e.process(stop, L.data(), R.data(), 160);
        CHECK(e.fbRel.load() == -1, "tete de lecture : rel a -1 a l'arret");
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
        e.setDry(true);
        mm::Program p = baseProgram();
        mm::ProgHit h0 = p.tracks[0].live;
        h0.g = 0;
        mm::ProgHit h1 = h0;
        h1.g = 1;
        p.tracks[0].hits = {h0, h1};
        e.publish(makeState(p));
        mm::Engine solo;
        solo.prepare(SR);
    solo.setDry(true);
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
        e.setDry(true);
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
        e.setDry(true);
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
        e.setDry(true);
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
        e.setDry(true);
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
        e.setDry(true);
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
        lt.lk = 1;                         // il verrouille VOL
        lt.lbLevel = 0.8 * std::sqrt(0.1); // voiceGain : 0.1 du LEVEL du coup
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

    // ---------------- le glissement vers le pas suivant (LIVE REC, 2026-11-12) ----------------
    {
        const long step = 6000; // 120 BPM, 48 kHz
        // VOL : le coup du pas 0 glisse vers le LEVEL du pas suivant (gain x 0.1) sur la duree du pas, en ligne droite
        mm::Program p = baseProgram();
        mm::ProgHit h = p.tracks[3].live;
        h.g = 0;
        mm::ProgHit hs = h;
        hs.sd = 1;
        hs.sdLevel = 0.8 * std::sqrt(0.1);
        std::vector<float> plain, slide;
        p.tracks[3].hits = {h};
        runPasses(p, 1, false, &plain);
        p.tracks[3].hits = {hs};
        runPasses(p, 1, false, &slide);
        auto ratio = [&](long a, long b) {
            double x = 0, y = 0;
            for (long i = a; i < b; ++i) {
                x += std::fabs(slide[static_cast<size_t>(i)]);
                y += std::fabs(plain[static_cast<size_t>(i)]);
            }
            return y > 0 ? x / y : -1;
        };
        const double r0 = ratio(0, 200), rq = ratio(step / 4 - 100, step / 4 + 100), rm = ratio(step / 2 - 100, step / 2 + 100), re = ratio(step + 400, step + 2000);
        CHECK(r0 > 0.97 && std::fabs(rq - 0.775) < 0.02 && std::fabs(rm - 0.55) < 0.02 && std::fabs(re - 0.1) < 0.005,
              "glissement : le VOL va en ligne droite a la valeur du pas suivant, puis y reste");
        // Sans le drapeau (sd 0), les cibles ne changent rien : le coup d'avant, a l'echantillon pres
        mm::ProgHit hn = hs;
        hn.sd = 0;
        std::vector<float> none;
        p.tracks[3].hits = {hn};
        runPasses(p, 1, false, &none);
        bool same = none.size() == plain.size();
        for (size_t i = 0; same && i < plain.size(); ++i) same = none[i] == plain[i];
        CHECK(same, "glissement : sans le drapeau, le coup ne change pas");
        // FREQ, par des lock trigs : passe-bas a 200 Hz au pas 0 ; le lock trig du pas 1 glisse vers les 8 kHz du pas 2.
        // En escalier (sans sd), le pas 1 reste sourd ; avec le glissement, il s'ouvre pendant le pas ; au pas 2, pareil.
        mm::ProgHit f0 = p.tracks[3].live;
        f0.g = 0;
        f0.ft = 1;
        f0.fhz = 200;
        f0.fq = 0.7071;
        mm::ProgHit l1 = f0, l2 = f0;
        l1.g = 1;
        l1.lt = true;
        l1.lk = 8;
        l1.lc = 200;
        l2.g = 2;
        l2.lt = true;
        l2.lk = 8;
        l2.lc = 8000;
        mm::ProgHit l1s = l1;
        l1s.sd = 8;
        l1s.sdCut = 8000;
        std::vector<float> stairs, glide;
        p.tracks[3].hits = {f0, l1, l2};
        runPasses(p, 1, false, &stairs);
        p.tracks[3].hits = {f0, l1s, l2};
        runPasses(p, 1, false, &glide);
        const double sEarly = energy(stairs, static_cast<int>(step), static_cast<int>(step + step / 8)), gEarly = energy(glide, static_cast<int>(step), static_cast<int>(step + step / 8));
        const double sLate = energy(stairs, static_cast<int>(step + step / 2), static_cast<int>(2 * step - 50)), gLate = energy(glide, static_cast<int>(step + step / 2), static_cast<int>(2 * step - 50));
        const double sAfter = energy(stairs, static_cast<int>(2 * step + 500), static_cast<int>(3 * step)), gAfter = energy(glide, static_cast<int>(2 * step + 500), static_cast<int>(3 * step));
        bool before = true;
        for (long i = 0; i < step; ++i) before = before && stairs[static_cast<size_t>(i)] == glide[static_cast<size_t>(i)];
        CHECK(before && sLate > 0 && gLate > 4 * sLate && gEarly < 3 * sEarly + 1e-9 && sAfter > 0 && std::fabs(gAfter / sAfter - 1) < 0.1,
              "glissement : la coupure d'un lock trig s'ouvre pendant le pas, et arrive a la valeur du pas suivant");
        // Le swing : le glissement dure jusqu'a la grille du pas suivant (un pas impair part en retard)
        mm::Program pw = baseProgram();
        pw.swing = 0.2;
        pw.tracks[3].hits = {hs};
        std::vector<float> sw;
        runPasses(pw, 1, false, &sw);
        double x = 0, y = 0;
        const long mid = static_cast<long>(0.6 * step); // le milieu d'un glissement de 1.2 pas
        for (long i = mid - 100; i < mid + 100; ++i) {
            x += std::fabs(sw[static_cast<size_t>(i)]);
            y += std::fabs(plain[static_cast<size_t>(i)]);
        }
        CHECK(y > 0 && std::fabs(x / y - 0.55) < 0.02, "glissement : avec du swing, il dure jusqu'au pas suivant");
    }
    {
        // La hauteur (TUNE, FINE, TONE) : le kick du pas 0 glisse vers un son deux fois plus haut (pf x 2) ; la lecture
        // accelere pendant le pas : apres lui, le kick sonne une octave plus haut (deux fois plus de passages par zero),
        // et son debut est celui du coup sans glissement
        mm::Program p = baseProgram();
        mm::ProgHit h = p.tracks[0].live;
        h.g = 0;
        mm::ProgHit hs = h;
        hs.sd = 256;
        hs.sdPf = 2 * p.sounds[0].pf;
        std::vector<float> plain, slide;
        p.tracks[0].hits = {h};
        runPasses(p, 1, false, &plain);
        p.tracks[0].hits = {hs};
        runPasses(p, 1, false, &slide);
        auto crossings = [](const std::vector<float>& x, size_t a, size_t b) {
            int n = 0;
            for (size_t i = a + 1; i < b; ++i)
                if ((x[i - 1] < 0) != (x[i] < 0)) ++n;
            return n;
        };
        const int zp = crossings(plain, 6000, 12000), zs = crossings(slide, 6000, 12000);
        double d0 = 0, ref = 0;
        for (size_t i = 0; i < 64; ++i) {
            d0 = std::max(d0, std::fabs(static_cast<double>(slide[i]) - plain[i]));
            ref = std::max(ref, std::fabs(static_cast<double>(plain[i])));
        }
        if (std::getenv("MM_TEST_VERBOSE")) std::printf("   hauteur : passages %d -> %d, depart %.5f / %.5f\n", zp, zs, d0, ref);
        CHECK(zp >= 4 && zs > 1.6 * zp && zs < 2.6 * zp && ref > 0 && d0 < 0.2 * ref, "glissement : la hauteur monte d'une octave pendant le pas, sans saut au depart");
    }
    {
        // La tranche : DIST du pas 0 (0) glisse vers celle du pas suivant (0.8). En escalier, le pas 0 est celui d'une piste
        // sans DIST ; avec le glissement, le son a deja change a la moitie du pas, pas encore a son debut.
        auto runSlice = [&](const mm::Program& p, std::vector<float>& l) {
            mm::Engine e;
            e.prepare(SR);
            e.publish(makeState(p));
            const double pps = 120.0 / 60.0 / SR;
            const int block = 250;
            std::vector<float> a(block), b(block);
            l.clear();
            double ppq = 0;
            for (int s = 0; s < 3 * 6000; s += block) {
                std::fill(a.begin(), a.end(), 0.f);
                std::fill(b.begin(), b.end(), 0.f);
                e.process({true, ppq, pps}, a.data(), b.data(), block);
                l.insert(l.end(), a.begin(), a.end());
                ppq += block * pps;
            }
        };
        mm::Program p = baseProgram();
        mm::ProgHit h = p.tracks[1].live;
        h.g = 0;
        h.hasSl = true;
        h.sl = mm::SliceFx{};
        mm::ProgHit hs = h;
        hs.sd = 16;
        hs.sdSl = h.sl;
        hs.sdSl.dist = 0.8;
        std::vector<float> flat, glide;
        p.tracks[1].hits = {h};
        runSlice(p, flat);
        p.tracks[1].hits = {hs};
        runSlice(p, glide);
        const int lat = 600; // l'avance du limiteur, large
        double early = 0, late = 0, ref = 0;
        for (int i = lat; i < lat + 250; ++i) early = std::max(early, std::fabs(static_cast<double>(glide[static_cast<size_t>(i)]) - flat[static_cast<size_t>(i)]));
        for (int i = 3000 + lat; i < 6000; ++i) {
            late = std::max(late, std::fabs(static_cast<double>(glide[static_cast<size_t>(i)]) - flat[static_cast<size_t>(i)]));
            ref = std::max(ref, std::fabs(static_cast<double>(flat[static_cast<size_t>(i)])));
        }
        CHECK(ref > 1e-4 && late > 0.05 * ref && early < 0.25 * late, "glissement : la DIST de la tranche change pendant le pas");
    }

    // ---------------- VAR, MOD 3/3 (2026-11-12) : chaque coup tire au sort ses ecarts ----------------
    {
        mm::Program p = baseProgram();
        for (int g = 0; g < 16; g += 2) {
            mm::ProgHit h = p.tracks[1].live;
            h.g = g;
            p.tracks[1].hits.push_back(h);
        }
        // Trois tours : on compare le deuxieme et le troisieme (chacun a recu les queues du tour d'avant) ; a 1e-5 pres (l'ordre
        // des voix dans la somme peut changer d'un tour a l'autre selon la machine)
        auto passes = [&](const mm::Program& q) {
            std::vector<float> l;
            runPasses(q, 3, false, &l);
            return l;
        };
        auto tourDiff = [](const std::vector<float>& x) {
            const size_t n = x.size() / 3;
            double d = 0;
            for (size_t i = 0; i < n; ++i) d = std::max(d, std::fabs(static_cast<double>(x[n + i]) - x[2 * n + i]));
            return d;
        };
        auto diff = [](const std::vector<float>& x, const std::vector<float>& y) {
            double d = 0;
            for (size_t i = 0; i < x.size() && i < y.size(); ++i) d = std::max(d, std::fabs(static_cast<double>(x[i]) - y[i]));
            return d;
        };
        const std::vector<float> ref = passes(p);
        mm::Program ps = p;
        ps.tracks[1].var.on = true;
        ps.tracks[1].var.tune = 7;
        ps.tracks[1].var.lev = 0.8;
        ps.tracks[1].var.seed = 12;
        const std::vector<float> seeded = passes(ps);
        mm::Program pf = ps;
        pf.tracks[1].var.seed = 0;
        const std::vector<float> freeV = passes(pf);
        const double dRef = tourDiff(ref), dSeed = tourDiff(seeded), dFree = tourDiff(freeV), dVar = diff(seeded, ref);
        const bool okSeed = dVar > 0.01 && dSeed < 1e-5 && dFree > 1e-3;
        if (std::getenv("MM_TEST_VERBOSE") || !okSeed) std::printf("   var : tours ref %.2g, graine %.2g, libre %.2g ; ecart a la ref %.3g\n", dRef, dSeed, dFree, dVar);
        CHECK(okSeed, "VAR : la graine rejoue la meme variation a chaque tour, le libre en tire une autre");
        // CHNC 0 : rien ne varie
        mm::Program p0 = ps;
        p0.tracks[1].var.chance = 0;
        CHECK(diff(passes(p0), ref) == 0, "VAR : CHNC 0, le son de toujours a l'echantillon pres");
        // LEV : les coups n'ont plus tous la meme crete
        mm::Program pl = p;
        pl.tracks[1].var.on = true;
        pl.tracks[1].var.lev = 0.9;
        pl.tracks[1].var.seed = 3;
        const std::vector<float> lv = passes(pl);
        float lo = 1e9f, hi = 0;
        for (int k = 0; k < 8; ++k) {
            float pk = 0;
            for (size_t i = static_cast<size_t>(k) * 12000; i < static_cast<size_t>(k) * 12000 + 3000 && i < lv.size(); ++i) pk = std::max(pk, std::fabs(lv[i]));
            lo = std::min(lo, pk);
            hi = std::max(hi, pk);
        }
        if (std::getenv("MM_TEST_VERBOSE")) std::printf("   var lev : cretes de %.3f a %.3f\n", lo, hi);
        CHECK(hi > 0 && lo < 0.7f * hi, "VAR : LEV, les coups n'ont plus le meme niveau");
    }

    // ---------------- PERFORM, le live (2026-11-12) : cuts, low cut, FILTER, beat repeat, tape stop, throws ----------------
    {
        const double pps = 120.0 / 60.0 / SR; // un pas : 6000 echantillons
        auto runPerf = [&](const mm::Program& p, long total, const std::function<void(mm::Engine&, long)>& at, std::vector<float>& l, int* lat) {
            mm::Engine e;
            e.prepare(SR);
            auto ps = makeState(p);
            ps->reverbIR = mm::ReverbIR::make(2.4, 3000, 0.02, SR);
            e.publish(ps);
            if (lat) *lat = e.latency();
            const int block = 250;
            std::vector<float> a(block), b(block);
            l.clear();
            double ppq = 0;
            for (long s = 0; s < total; s += block) {
                if (at) at(e, s);
                std::fill(a.begin(), a.end(), 0.f);
                std::fill(b.begin(), b.end(), 0.f);
                e.process({true, ppq, pps}, a.data(), b.data(), block);
                l.insert(l.end(), a.begin(), a.end());
                ppq += block * pps;
            }
        };
        auto en = [](const std::vector<float>& x, long a, long b) {
            double s = 0;
            for (long i = std::max(0L, a); i < b && i < static_cast<long>(x.size()); ++i) s += static_cast<double>(x[static_cast<size_t>(i)]) * x[static_cast<size_t>(i)];
            return s;
        };
        auto every = [&](int track, int stride) {
            mm::Program p = baseProgram();
            for (int g = 0; g < 16; g += stride) {
                mm::ProgHit h = p.tracks[static_cast<size_t>(track)].live;
                h.g = g;
                p.tracks[static_cast<size_t>(track)].hits.push_back(h);
            }
            return p;
        };
        const std::function<void(mm::Engine&, long)> none;
        int lat = 0;
        // CUT : le CH a chaque pas ; coupe des pas 4 a 8, rendu ensuite
        {
            const mm::Program p = every(2, 1);
            std::vector<float> ref, cut;
            runPerf(p, 16 * 6000, none, ref, &lat);
            runPerf(p, 16 * 6000, [](mm::Engine& e, long s) { e.setPerf(s >= 24000 && s < 48000 ? 1u << 2 : 0u, 0); }, cut, nullptr);
            const double in = en(cut, 24500 + lat, 47500 + lat) / std::max(1e-12, en(ref, 24500 + lat, 47500 + lat));
            const double back = en(cut, 54000 + lat, 90000 + lat) / std::max(1e-12, en(ref, 54000 + lat, 90000 + lat));
            CHECK(in < 1e-4 && back > 0.95 && back < 1.05, "PERFORM CUT : la piste se tait tenue, revient relachee");
        }
        // LOW CUT : le kick a chaque temps perd ses basses ; FILTER : le CH au passe-bas ferme, le kick au passe-haut ferme
        {
            const mm::Program kick = every(0, 4), hats = every(2, 1);
            std::vector<float> ref, low, hp, refH, lp;
            runPerf(kick, 16 * 6000, none, ref, &lat);
            runPerf(kick, 16 * 6000, [](mm::Engine& e, long) { e.setPerf(0, mm::Engine::PERF_LOWCUT); }, low, nullptr);
            runPerf(kick, 16 * 6000, [](mm::Engine& e, long) { e.setFilter(1.f); }, hp, nullptr);
            runPerf(hats, 16 * 6000, none, refH, nullptr);
            runPerf(hats, 16 * 6000, [](mm::Engine& e, long) { e.setFilter(-1.f); }, lp, nullptr);
            const double rLow = en(low, 12000, 96000) / en(ref, 12000, 96000);
            const double rHp = en(hp, 12000, 96000) / en(ref, 12000, 96000);
            const double rLp = en(lp, 12000, 96000) / en(refH, 12000, 96000);
            if (std::getenv("MM_TEST_VERBOSE")) std::printf("   low cut %.3f, passe-haut %.4f, passe-bas %.5f\n", rLow, rHp, rLp);
            CHECK(rLow < 0.35 && rHp < 0.05 && rLp < 0.02, "PERFORM LOW CUT et FILTER : les basses du kick partent, le passe-haut et le passe-bas ferment");
        }
        // BEAT REPEAT 1/8 (deux pas) tenu des 9000 : la boucle part de la grille (0) ; le deuxieme tour rejoue le premier
        {
            mm::Program p = baseProgram();
            for (int k = 0; k < 4; ++k) {
                mm::ProgHit h = p.tracks[static_cast<size_t>(k)].live;
                h.g = k;
                p.tracks[static_cast<size_t>(k)].hits = {h};
            }
            std::vector<float> ref, rep;
            runPerf(p, 6 * 6000, none, ref, &lat);
            runPerf(p, 6 * 6000, [](mm::Engine& e, long s) { e.setPerf(0, s >= 9000 ? 2 : 0); }, rep, nullptr);
            auto corr = [](const std::vector<float>& a, long ia, const std::vector<float>& b, long ib, long n) {
                double ab = 0, aa = 0, bb = 0;
                for (long k = 0; k < n; ++k) {
                    const double x = a[static_cast<size_t>(ia + k)], y = b[static_cast<size_t>(ib + k)];
                    ab += x * y;
                    aa += x * x;
                    bb += y * y;
                }
                return aa > 0 && bb > 0 ? ab / std::sqrt(aa * bb) : 0.0;
            };
            bool firstLive = true;
            for (long i = 0; i < 9000 + lat; ++i) firstLive = firstLive && rep[static_cast<size_t>(i)] == ref[static_cast<size_t>(i)];
            const double loop = corr(rep, 12000 + lat + 300, ref, lat + 300, 11400);
            const double loop2 = corr(rep, 24000 + lat + 300, ref, lat + 300, 11400);
            const double notLive = corr(ref, 12000 + lat + 300, ref, lat + 300, 11400);
            if (std::getenv("MM_TEST_VERBOSE")) std::printf("   repeat : %.4f %.4f (le direct %.3f), premier tour %d\n", loop, loop2, notLive, firstLive ? 1 : 0);
            CHECK(firstLive && loop > 0.98 && loop2 > 0.98 && notLive < 0.9, "PERFORM REPEAT 1/8 : sur la grille, le premier tour en direct, puis la boucle");
        }
        // TAPE STOP : la bande ralentit puis se tait (0.7 s) ; relachee, le direct revient
        {
            const mm::Program p = every(2, 1);
            std::vector<float> ref, tape;
            runPerf(p, 16 * 6000, none, ref, &lat);
            runPerf(p, 16 * 6000, [](mm::Engine& e, long s) { e.setPerf(0, s >= 24000 && s < 72000 ? mm::Engine::PERF_TAPE : 0); }, tape, nullptr);
            const double early = en(tape, 24000 + lat + 500, 24000 + lat + 4500) / en(ref, 24000 + lat + 500, 24000 + lat + 4500);
            const double end = en(tape, 24000 + lat + 36000, 72000 + lat) / en(ref, 24000 + lat + 36000, 72000 + lat);
            const double back = en(tape, 76000 + lat, 95000) / en(ref, 76000 + lat, 95000);
            if (std::getenv("MM_TEST_VERBOSE")) std::printf("   tape : debut %.3f, fin %.6f, retour %.3f\n", early, end, back);
            CHECK(early > 0.3 && end < 1e-4 && back > 0.95 && back < 1.05, "PERFORM TAPE STOP : la bande ralentit jusqu'au silence, puis le direct revient");
        }
        // SIDECHAIN : le kick (sa voie) ne bouge pas ; les hats plongent au debut de chaque temps et remontent ensuite
        {
            mm::Program kick = every(0, 4);
            kick.tracks[0].kick = true; // la voie du kick (plugin/bridge.ts : la famille bd)
            const mm::Program hats = every(2, 1);
            std::vector<float> k0, k1, h0, h1;
            runPerf(kick, 8 * 6000, none, k0, &lat);
            runPerf(kick, 8 * 6000, [](mm::Engine& e, long) { e.setSide(1.f); }, k1, nullptr);
            runPerf(hats, 8 * 6000, none, h0, nullptr);
            runPerf(hats, 8 * 6000, [](mm::Engine& e, long) { e.setSide(1.f); }, h1, nullptr);
            double kd = 0;
            for (size_t i = 0; i < k0.size(); ++i) kd = std::max(kd, std::fabs(static_cast<double>(k0[i]) - k1[i]));
            // Par temps (24000 echantillons) : le debut (de 3 a 30 ms) et la fin (le dernier quart)
            double early0 = 0, early1 = 0, late0 = 0, late1 = 0;
            for (int bt = 1; bt < 2; ++bt) {
                const long b0 = bt * 24000 + lat;
                early0 += en(h0, b0 + 150, b0 + 1440);
                early1 += en(h1, b0 + 150, b0 + 1440);
                late0 += en(h0, b0 + 18000, b0 + 24000);
                late1 += en(h1, b0 + 18000, b0 + 24000);
            }
            const double dip = early1 / std::max(1e-12, early0), rest = late1 / std::max(1e-12, late0);
            if (std::getenv("MM_TEST_VERBOSE")) std::printf("   sidechain : kick %.2g, debut du temps %.3f, fin %.3f\n", kd, dip, rest);
            CHECK(kd == 0 && dip < 0.1 && rest > 0.9, "PERFORM SIDECHAIN : le kick reste, le reste plonge a chaque temps puis remonte");
        }
        // DELAY THROW et REVERB WASH : la caisse claire au pas 0, sans envoi ; jetee le temps du coup, son echo et sa queue
        {
            mm::Program p = baseProgram();
            mm::ProgHit h = p.tracks[1].live;
            h.g = 0;
            p.tracks[1].hits = {h};
            std::vector<float> ref, thd, thr;
            runPerf(p, 6 * 6000, none, ref, &lat);
            runPerf(p, 6 * 6000, [](mm::Engine& e, long s) { e.setPerf(0, s < 6000 ? mm::Engine::PERF_THROW_D : 0); }, thd, nullptr);
            runPerf(p, 6 * 6000, [](mm::Engine& e, long s) { e.setPerf(0, s < 6000 ? mm::Engine::PERF_THROW_R : 0); }, thr, nullptr);
            const long echo = static_cast<long>(mm::FxLaws::delaySeconds(0.4, 120) * SR);
            const double d = en(thd, echo + lat, echo + lat + 6000), dRef = en(ref, echo + lat, echo + lat + 6000);
            const double rv = en(thr, 12000 + lat, 30000 + lat), rvRef = en(ref, 12000 + lat, 30000 + lat);
            if (std::getenv("MM_TEST_VERBOSE")) std::printf("   echo %.3g / %.3g, queue %.3g / %.3g\n", d, dRef, rv, rvRef);
            CHECK(d > 1e-4 && d > 50 * dRef && rv > 1e-4 && rv > 50 * rvRef, "PERFORM DELAY THROW et REVERB WASH : l'echo et la queue d'un coup jete");
        }
    }

    // ---------------- phase 3 : FLTR ----------------
    {
        auto energyOf = [&](int track, int ft, double hz, double oct) {
            mm::Engine e;
            e.prepare(SR);
        e.setDry(true);
            mm::Program p = baseProgram();
            p.tracks[static_cast<size_t>(track)].live.ft = ft;
            p.tracks[static_cast<size_t>(track)].live.fhz = hz;
            p.tracks[static_cast<size_t>(track)].live.fq = 0.7071;
            p.tracks[static_cast<size_t>(track)].live.foct = oct;
            p.tracks[static_cast<size_t>(track)].live.fatk = 0.002;
            p.tracks[static_cast<size_t>(track)].live.ftau = 0.05;
            auto ps = makeState(p);
            e.publish(ps);
            e.pushLive(live(*ps, track));
            std::vector<float> l(n), r(n);
            e.process(stop, l.data(), r.data(), n);
            return energy(l, 0, n);
        };
        const double ch = energyOf(2, 0, 0, 0), chLp = energyOf(2, 1, 300, 0), chLpEnv = energyOf(2, 1, 300, 5);
        const double bd = energyOf(0, 0, 0, 0), bdHp = energyOf(0, 2, 5000, 0);
        CHECK(chLp < 0.01 * ch && chLpEnv > chLp && bdHp < 0.05 * bd, "FLTR : passe-bas et passe-haut, l'enveloppe ouvre la coupure");
    }

    // ---------------- phase 3 : les effets (tranche, bus, envois, master) ----------------
    {
        // Un coup en direct passe par toute la chaine ; la sortie de 1 s (48000 echantillons)
        auto runFx = [&](mm::Program p, int track, std::vector<float>& l, std::vector<float>& r) {
            mm::Engine e;
            e.prepare(SR);
            auto ps = makeState(p);
            ps->reverbIR = mm::ReverbIR::make(2.4, 3000, 0.02, SR);
            e.publish(ps);
            e.pushLive(live(*ps, track));
            l.assign(48000, 0.f);
            r.assign(48000, 0.f);
            for (int off = 0; off < 48000; off += 480) e.process(stop, l.data() + off, r.data() + off, 480);
        };
        auto peakIn = [](const std::vector<float>& x, size_t a, size_t b) {
            float pk = 0;
            for (size_t i = a; i < b && i < x.size(); ++i) pk = std::max(pk, std::fabs(x[i]));
            return pk;
        };
        mm::Program p0 = baseProgram();
        std::vector<float> l, r, dl, dr;
        // Le niveau du site : la caisse claire seule, LEVEL 0.8 (0.64) et la garniture 0.84
        {
            mm::Engine e;
            e.prepare(SR);
            e.setDry(true);
            auto ps = makeState(p0);
            e.publish(ps);
            e.pushLive(live(*ps, 1));
            dl.assign(48000, 0.f);
            dr.assign(48000, 0.f);
            for (int off = 0; off < 48000; off += 480) e.process(stop, dl.data() + off, dr.data() + off, 480);
        }
        runFx(p0, 1, l, r);
        const double ratio = peakIn(l, 0, 48000) / peakIn(dl, 0, 48000);
        CHECK(std::fabs(ratio - 0.64 * 0.84) < 0.01, "niveau : LEVEL 0.8 au carre et la garniture 0.84, comme le site");
        // REVERB : une queue apres la caisse claire (0.3 s) ; le kick n'a pas d'envoi global
        mm::Program pr = p0;
        pr.fx.reverb = 0.6;
        pr.tracks[0].kick = true; // BD sur la voie du kick (tracks.family 'bd')
        runFx(pr, 1, l, r);
        const float sdTail = peakIn(l, 24000, 48000);
        // Le kick (1.35 s a lui seul) : avec ou sans REVERB globale, le meme son
        runFx(pr, 0, l, r);
        mm::Program pk = pr;
        pk.fx.reverb = 0;
        std::vector<float> lk, rk;
        runFx(pk, 0, lk, rk);
        double bdDiff = 0;
        for (size_t i = 0; i < 48000; ++i) bdDiff = std::max(bdDiff, std::fabs(static_cast<double>(l[i]) - lk[i]));
        // et la caisse claire seche s'est tue a 0.5 s : sa queue est la reverb
        mm::Program ps0 = p0;
        std::vector<float> ls, rs;
        runFx(ps0, 1, ls, rs);
        CHECK(sdTail > 1e-3f && peakIn(ls, 24000, 48000) < 1e-6f && bdDiff < 1e-7, "REVERB : l'envoi global des pads a sa queue, la voie du kick n'en a pas");
        // DELAY de la piste : l'echo arrive au temps du DELAY (3 pas a 130 BPM = 0.346 s)
        mm::Program pd = p0;
        pd.tracks[2].sl.delay = 0.8;
        pd.tracks[2].live.hasSl = false;
        runFx(pd, 2, l, r);
        const size_t at = static_cast<size_t>(mm::FxLaws::delaySeconds(0.4, 130) * SR);
        CHECK(peakIn(l, at - 200, at + 2000) > 1e-3f && peakIn(l, 9000, at - 400) < 1e-4f, "DELAY : l'echo de la piste au temps du DELAY");
        // DIST de la piste : le son change ; CHORUS global : la caisse claire mono s'ouvre en stereo
        mm::Program px = p0;
        px.tracks[1].sl.dist = 0.8;
        runFx(px, 1, l, r);
        std::vector<float> l2, r2;
        runFx(p0, 1, l2, r2);
        double diff = 0;
        for (size_t i = 0; i < 20000; ++i) diff = std::max(diff, std::fabs(static_cast<double>(l[i]) - l2[i]));
        mm::Program pc = p0;
        pc.fx.chorus = 1;
        runFx(pc, 1, l, r);
        double side = 0;
        for (size_t i = 0; i < 20000; ++i) side = std::max(side, std::fabs(static_cast<double>(l[i]) - r[i]));
        CHECK(diff > 0.01 && side > 0.01, "DIST de la piste et CHORUS global : le son change, le chorus ouvre la stereo");
        // Le LIMITEUR : jamais au-dessus de -0.3 dBFS, meme a LEVEL fort et DIST a fond
        mm::Program pl = p0;
        pl.fx.level = 1.0;
        pl.tracks[0].slice = 4;
        runFx(pl, 0, l, r);
        CHECK(peakIn(l, 0, 48000) <= 0.9661f && peakIn(r, 0, 48000) <= 0.9661f, "LIMITEUR : plafond a -0.3 dBFS");
    }

    // ---------------- phase 3 bis : les LFO ----------------
    {
        // Le motif joue a 120 BPM (un pas : 6000 echantillons), sans effets, gauche et droite
        auto runLR = [&](const mm::Program& p, int steps, std::vector<float>& l, std::vector<float>& r) {
            mm::Engine e;
            e.prepare(SR);
            e.setDry(true);
            e.publish(makeState(p));
            const double pps = 120.0 / 60.0 / SR;
            const int block = 250;
            const int total = steps * 6000;
            l.assign(static_cast<size_t>(total), 0.f);
            r.assign(static_cast<size_t>(total), 0.f);
            double ppq = 0;
            for (int off = 0; off < total; off += block) {
                e.process({true, ppq, pps}, l.data() + off, r.data() + off, block);
                ppq += block * pps;
            }
        };
        auto absSum = [](const std::vector<float>& x, int a, int b) {
            double s = 0;
            for (int i = a; i < b && i < static_cast<int>(x.size()); ++i) s += std::fabs(x[static_cast<size_t>(i)]);
            return s;
        };
        auto maxDiff = [](const std::vector<float>& a, const std::vector<float>& b) {
            double d = 0;
            for (size_t i = 0; i < a.size() && i < b.size(); ++i) d = std::max(d, std::fabs(static_cast<double>(a[i]) - b[i]));
            return d;
        };
        auto lfo = [](int dest, int wave, int mode, double depth, int spd = 32) {
            mm::Lfo l;
            l.spd = spd;
            l.dest = dest;
            l.wave = wave;
            l.mode = mode;
            l.depth = depth;
            return l;
        };
        auto oneHit = [&](int track, const mm::Lfo* l) {
            mm::Program p = baseProgram();
            mm::ProgHit h = p.tracks[static_cast<size_t>(track)].live;
            h.g = 0;
            if (l) {
                h.nlfo = 1;
                h.lfo[0] = *l;
            }
            p.tracks[static_cast<size_t>(track)].hits = {h};
            return p;
        };
        std::vector<float> l0, r0, l1, r1;

        // VOL, SQR, un cycle de 4 pas : +0.5 la premiere moitie (LEVEL 1 : x 1.5625), -0.5 la seconde (LEVEL 0.3 : x 0.1406)
        const mm::Lfo vol = lfo(mm::LD_VOL, mm::LW_SQR, mm::LM_FRE, 0.5);
        runLR(oneHit(3, nullptr), 4, l0, r0);
        runLR(oneHit(3, &vol), 4, l1, r1);
        const double up = absSum(l1, 2000, 10000) / absSum(l0, 2000, 10000);
        const double down = absSum(l1, 14000, 22000) / absSum(l0, 14000, 22000);
        CHECK(std::fabs(up - 1.5625) < 0.005 && std::fabs(down - 0.140625) < 0.002 && absSum(l0, 14000, 22000) > 1, "LFO VOL : la forme carree mene le gain du coup qui sonne (loi du LEVEL)");

        // DECAY, pris au coup : -0.5 sur DECAY 1 (le son entier) donne la constante de temps de DECAY 0.5
        mm::Lfo dec = lfo(mm::LD_DECAY, mm::LW_SQR, mm::LM_FRE, -0.5);
        mm::Program pdec = oneHit(3, &dec);
        pdec.tracks[3].hits[0].lbDecay = 1;
        runLR(pdec, 4, l1, r1);
        mm::Program ptau = oneHit(3, nullptr);
        ptau.tracks[3].hits[0].tau = 0.012 * std::pow(60.0, 0.5);
        runLR(ptau, 4, l0, r0);
        CHECK(maxDiff(l0, l1) == 0 && absSum(l1, 0, 4000) > 1, "LFO DECAY : la valeur du LFO au coup donne son DECAY");

        // PITCH : +0.5 tenu (HLD) = +6 demi-tons, la lecture a racine de 2 : le son finit racine de 2 fois plus tot
        const mm::Lfo pit = lfo(mm::LD_PITCH, mm::LW_SQR, mm::LM_HLD, 0.5);
        runLR(oneHit(1, nullptr), 4, l0, r0);
        runLR(oneHit(1, &pit), 4, l1, r1);
        auto lastNz = [](const std::vector<float>& x) {
            long k = -1;
            for (size_t i = 0; i < x.size(); ++i)
                if (x[i] != 0) k = static_cast<long>(i);
            return k;
        };
        const double ratio = static_cast<double>(lastNz(l0)) / static_cast<double>(lastNz(l1));
        CHECK(lastNz(l0) > 1000 && std::fabs(ratio - std::sqrt(2.0)) < 0.01, "LFO PITCH : +6 demi-tons, le son lu racine de 2 fois plus vite");

        // PAN : SQR a fond, un cycle de 2 pas : a droite la premiere moitie, a gauche la seconde (un son mono au centre)
        const mm::Lfo pan = lfo(mm::LD_PAN, mm::LW_SQR, mm::LM_FRE, 1, 64);
        runLR(oneHit(1, &pan), 2, l1, r1);
        const bool right = absSum(r1, 600, 5400) > 1 && absSum(l1, 600, 5400) < 1e-3;
        const bool left = absSum(l1, 6600, 11400) > 1e-2 && absSum(r1, 6600, 11400) < 1e-4;
        CHECK(right && left, "LFO PAN : la forme carree passe le coup de droite a gauche");

        // FREQ : +1 tenu sur un passe-bas a 632 Hz = +5 octaves, le filtre de 20 kHz ; RESO : +0.5 = le Q de RESO 0.5
        const mm::Lfo frq = lfo(mm::LD_FREQ, mm::LW_SQR, mm::LM_HLD, 1);
        mm::Program pf = oneHit(1, &frq);
        pf.tracks[1].hits[0].ft = 1;
        pf.tracks[1].hits[0].fhz = 632.455532;
        runLR(pf, 2, l1, r1);
        mm::Program pf0 = oneHit(1, nullptr);
        pf0.tracks[1].hits[0].ft = 1;
        pf0.tracks[1].hits[0].fhz = 20000;
        runLR(pf0, 2, l0, r0);
        const double dFreq = maxDiff(l0, l1);
        const mm::Lfo rso = lfo(mm::LD_RESO, mm::LW_SQR, mm::LM_HLD, 0.5);
        mm::Program pq = oneHit(1, &rso);
        pq.tracks[1].hits[0].ft = 1;
        pq.tracks[1].hits[0].fhz = 2000;
        pq.tracks[1].hits[0].lbReso = 0;
        runLR(pq, 2, l1, r1);
        mm::Program pq0 = oneHit(1, nullptr);
        pq0.tracks[1].hits[0].ft = 1;
        pq0.tracks[1].hits[0].fhz = 2000;
        pq0.tracks[1].hits[0].fq = 0.70710678118654752440 * (1 + 16 * std::pow(0.5, 1.5));
        runLR(pq0, 2, l0, r0);
        CHECK(dFreq < 1e-6 && maxDiff(l0, l1) < 1e-5 && absSum(l1, 0, 6000) > 1, "LFO FREQ et RESO : la coupure en octaves, le Q de la loi RESO");

        // TRG et LFO.T : un lock trig au pas 1 relance le LFO VOL (TRG) du coup qui sonne ; sans LFO.T, rien ne change
        const mm::Lfo trg = lfo(mm::LD_VOL, mm::LW_SQR, mm::LM_TRG, 0.5);
        mm::Program pt = oneHit(3, &trg);
        mm::ProgHit lt = pt.tracks[3].hits[0];
        lt.g = 1;
        lt.lt = true;
        lt.lfot = true;
        pt.tracks[3].hits.push_back(lt);
        runLR(pt, 4, l1, r1);
        mm::Program pt0 = pt;
        pt0.tracks[3].hits[1].lfot = false;
        std::vector<float> l2, r2;
        runLR(pt0, 4, l2, r2);
        runLR(oneHit(3, nullptr), 4, l0, r0);
        const double relaunched = absSum(l1, 13000, 17000) / absSum(l0, 13000, 17000);
        const double kept = absSum(l2, 13000, 17000) / absSum(l0, 13000, 17000);
        bool sameBefore = true;
        for (int i = 0; i < 6000; ++i) sameBefore = sameBefore && l1[static_cast<size_t>(i)] == l2[static_cast<size_t>(i)];
        CHECK(sameBefore && std::fabs(relaunched - 1.5625) < 0.005 && std::fabs(kept - 0.140625) < 0.002, "LFO TRG : un lock trig a LFO.T relance la forme a son heure");
    }

    // ---------------- le crossfader dans le moteur (les scenes, prog.xk) ----------------
    {
        // Le motif a 120 BPM, sans effets ; x passe de x0 a x1 a l'echantillon at
        auto runX = [&](const mm::Program& p, int total, float x0, float x1, int at, std::vector<float>& l) {
            mm::Engine e;
            e.prepare(SR);
            e.setDry(true);
            e.publish(makeState(p));
            const double pps = 120.0 / 60.0 / SR;
            const int block = 250;
            l.assign(static_cast<size_t>(total), 0.f);
            std::vector<float> r(static_cast<size_t>(total), 0.f);
            double ppq = 0;
            for (int off = 0; off < total; off += block) {
                e.setX(off >= at ? x1 : x0);
                e.process({true, ppq, pps}, l.data() + off, r.data() + off, block);
                ppq += block * pps;
            }
        };
        auto absSum = [](const std::vector<float>& x, int a, int b) {
            double s = 0;
            for (int i = a; i < b && i < static_cast<int>(x.size()); ++i) s += std::fabs(x[static_cast<size_t>(i)]);
            return s;
        };
        // L'OH au pas 0 ; scene A : gain 1, scene B : gain 0.25 (deux positions)
        mm::Program p = baseProgram();
        mm::ProgHit h = p.tracks[3].live;
        h.g = 0;
        p.tracks[3].hits = {h};
        mm::ProgX a, b;
        a.fx = b.fx = p.fx;
        a.tracks = b.tracks = p.tracks;
        b.tracks[3].hits[0].gain = 0.25;
        p.xk = {a, b};
        std::vector<float> l0, l5, l1, ls;
        runX(p, 12000, 0.f, 0.f, 0, l0);
        runX(p, 12000, 0.5f, 0.5f, 0, l5);
        runX(p, 12000, 1.f, 1.f, 0, l1);
        const double ref = absSum(l0, 0, 12000);
        const double r5 = absSum(l5, 0, 12000) / ref, r1 = absSum(l1, 0, 12000) / ref;
        CHECK(ref > 1 && std::fabs(r5 - 0.625) < 1e-3 && std::fabs(r1 - 0.25) < 1e-3, "crossfader : le coup prend les reglages de sa position (A, milieu, B)");
        // Le niveau de tranche (LEVEL) suit x pendant que le coup sonne : B a 0, x passe a 1 au milieu du son
        mm::Program pt = p;
        pt.xk[1].tracks[3].hits[0].gain = 1;
        pt.xk[1].tracks[3].slice = 0;
        runX(pt, 12000, 0.f, 1.f, 6000, ls);
        CHECK(absSum(ls, 0, 6000) > 1 && absSum(ls, 6250, 12000) < 1e-6, "crossfader : le niveau de la piste suit x pendant que le coup sonne");
        // Sans scene (xk vide) : x ne change rien
        mm::Program pn = p;
        pn.xk.clear();
        std::vector<float> n0, n1;
        runX(pn, 12000, 0.f, 0.f, 0, n0);
        runX(pn, 12000, 1.f, 1.f, 0, n1);
        CHECK(n0 == n1, "crossfader : sans scene, x ne change rien");
    }

    // ---------------- les patterns : program change, chaine, fin de pattern ----------------
    {
        // Pattern A01 (emplacement 0) : CH au pas 0 ; A02 (emplacement 1) : SD au pas 8. 120 BPM : un pas = 6000 echantillons
        mm::Program p = baseProgram();
        p.slot = 0;
        mm::ProgHit ch = p.tracks[2].live;
        ch.g = 0;
        p.tracks[2].hits = {ch};
        mm::Program q = p;
        q.slot = 1;
        q.tracks[2].hits.clear();
        mm::ProgHit sd = p.tracks[1].live;
        sd.g = 8;
        q.tracks[1].hits = {sd};
        p.pats = {q};
        const int STEP = 6000;
        // steps pas joues ; action(e, bloc) avant chaque bloc ; pats : le pattern joue au debut de chaque pas
        auto run = [&](int steps, const std::function<void(mm::Engine&, long)>& action, std::vector<float>& l, std::vector<int>& pats) {
            mm::Engine e;
            e.prepare(SR);
            e.setDry(true);
            e.publish(makeState(p));
            const double pps = 120.0 / 60.0 / SR;
            const int block = 250;
            const long total = static_cast<long>(steps) * STEP;
            l.assign(static_cast<size_t>(total), 0.f);
            std::vector<float> r(static_cast<size_t>(total), 0.f);
            pats.clear();
            double ppq = 0;
            for (long off = 0; off < total; off += block) {
                action(e, off / block);
                e.process({true, ppq, pps}, l.data() + off, r.data() + off, block);
                if (off % STEP == 0) pats.push_back(e.fbPat.load());
                ppq += block * pps;
            }
        };
        auto energyStep = [&](const std::vector<float>& l, int step) {
            double s = 0;
            for (long i = static_cast<long>(step) * STEP; i < static_cast<long>(step + 1) * STEP && i < static_cast<long>(l.size()); ++i) s += std::fabs(l[static_cast<size_t>(i)]);
            return s;
        };
        std::vector<float> l;
        std::vector<int> pats;
        // Un program change (2) au pas 5 : A01 finit ses 16 pas, A02 commence au pas 16 (pas de CH a 16, la SD a 24)
        run(32, [](mm::Engine& e, long b) { if (b == 5 * 24) e.programChange(1); }, l, pats);
        const bool pcOk = pats[4] == 0 && pats[15] == 0 && pats[17] == 1 && energyStep(l, 0) > 1 && energyStep(l, 16) < 1e-6 && energyStep(l, 24) > 1;
        CHECK(pcOk, "patterns : un program change d'Ableton joue le pattern a la fin de celui qui joue");
        // La chaine de la face (A01, A02) : les deux en alternance, un pattern chacun
        const int chain[2] = {0, 1};
        run(64, [&](mm::Engine& e, long b) { if (b == 0) e.queuePatterns(-1, chain, 2); }, l, pats);
        const bool chainOk = pats[1] == 0 && pats[17] == 1 && pats[33] == 0 && pats[49] == 1 && energyStep(l, 32) > 1 && energyStep(l, 40) < 1e-6;
        CHECK(chainOk, "patterns : la chaine de la face joue ses patterns l'un apres l'autre");
        // A l'arret, un program change change le pattern tout de suite
        mm::Engine e;
        e.prepare(SR);
        e.setDry(true);
        e.publish(makeState(p));
        std::vector<float> a(256), b(256);
        e.process({}, a.data(), b.data(), 256);
        const int seq0 = e.fbPatSeq.load();
        e.programChange(1);
        e.process({}, a.data(), b.data(), 256);
        CHECK(e.fbPat.load() == 1 && e.fbPatSeq.load() == seq0 + 1, "patterns : a l'arret, un program change change le pattern tout de suite");
    }

    // ---------------- TLEN : la longueur par piste ----------------
    {
        // Un pattern de 16 pas ; le CH au pas 0 avec TLEN 3 : il joue aux pas 0, 3, 6 ... 15, puis 18, 21 (il ne repart pas a 16)
        mm::Program p = baseProgram();
        p.len = 16;
        mm::ProgHit ch = p.tracks[2].live;
        ch.g = 0;
        p.tracks[2].hits = {ch};
        p.tracks[2].tlen = 3;
        const int STEP = 6000;
        std::vector<float> l;
        runPasses(p, 2, false, &l);
        auto at = [&](int step) {
            double s = 0;
            for (long i = static_cast<long>(step) * STEP; i < static_cast<long>(step) * STEP + 1500 && i < static_cast<long>(l.size()); ++i) s += std::fabs(l[static_cast<size_t>(i)]);
            return s;
        };
        bool ok = true;
        for (int st = 0; st < 30; ++st) {
            const bool want = st % 3 == 0;
            ok = ok && (want ? at(st) > 0.1 : at(st) < 1e-6);
        }
        CHECK(ok, "TLEN : une piste de 3 pas boucle sur 3 pas a travers le pattern de 16 (polymetrie)");
    }

    // ---------------- l'export MIDI (la pattern qui joue en clip) ----------------
    {
        auto hitAt = [](int g, float vel) {
            mm::ProgHit h;
            h.g = g;
            h.vel = vel;
            h.snd = 0;
            return h;
        };
        auto notesOf = [](const mm::ExportResult& r, int note) {
            std::vector<long> out;
            for (const auto& n : r.notes)
                if (n.note == note) out.push_back(n.tick);
            return out;
        };
        // Les notes : BD sur les noires, SD aux pas 4 et 12 a mi-velocite ; une mesure, les velocites justes
        mm::Program p;
        p.len = 16;
        p.tracks[0].hits = {hitAt(0, 1.f), hitAt(4, 1.f), hitAt(8, 1.f), hitAt(12, 1.f)};
        p.tracks[1].hits = {hitAt(4, 0.5f), hitAt(12, 0.5f)};
        auto r = mm::exportPattern(p);
        bool ok = r.steps == 16 && r.notes.size() == 6 && notesOf(r, 36) == std::vector<long>{0, 960, 1920, 2880} && notesOf(r, 38) == std::vector<long>{960, 2880};
        for (const auto& n : r.notes) ok = ok && n.vel == (n.note == 36 ? 127 : 64) && n.len == 240;
        CHECK(ok, "MIDI : BD sur les noires (note 36, velocite 127), SD aux pas 5 et 13 (note 38, velocite 64), une mesure, des notes d'un pas");

        // Le swing (les pas impairs en retard) et uTIME (le pas 1 en avance : a la fin du clip)
        mm::Program q;
        q.len = 16;
        q.swing = 0.5;
        mm::ProgHit early = hitAt(0, 1.f);
        early.shift = -0.25;
        q.tracks[2].hits = {early, hitAt(1, 1.f), hitAt(2, 1.f)};
        r = mm::exportPattern(q);
        CHECK(notesOf(r, 42) == (std::vector<long>{240 + 120, 480, 3840 - 60}), "MIDI : le swing retarde les pas impairs, uTIME avance le premier pas a la fin du clip");

        // TLEN : une piste de 3 pas dans un pattern de 16 : 3 mesures (48 pas), 16 notes
        mm::Program t3;
        t3.len = 16;
        t3.tracks[2].hits = {hitAt(0, 1.f)};
        t3.tracks[2].tlen = 3;
        t3.tracks[0].hits = {hitAt(0, 1.f)};
        r = mm::exportPattern(t3);
        auto ch = notesOf(r, 42);
        ok = r.steps == 48 && ch.size() == 16;
        for (size_t i = 0; i < ch.size(); ++i) ok = ok && ch[i] == static_cast<long>(i) * 3 * 240;
        CHECK(ok && notesOf(r, 36).size() == 3, "MIDI : TLEN 3 dans 16 pas : un clip de 3 mesures, la piste sur ses 3 pas");

        // A:B : 1:2 ne joue qu'un passage sur deux : 2 mesures, la note dans la premiere ; 2:2 dans la seconde
        mm::Program ab;
        ab.len = 16;
        mm::ProgHit c1 = hitAt(0, 1.f);
        c1.ck = 6;
        c1.ca = 1;
        c1.cb = 2;
        mm::ProgHit c2 = hitAt(0, 1.f);
        c2.ck = 6;
        c2.ca = 2;
        c2.cb = 2;
        ab.tracks[0].hits = {c1};
        ab.tracks[1].hits = {c2};
        r = mm::exportPattern(ab);
        CHECK(r.steps == 32 && notesOf(r, 36) == std::vector<long>{0} && notesOf(r, 38) == std::vector<long>{3840}, "MIDI : A:B 1:2 et 2:2, deux mesures, chaque note dans son passage");

        // RTRG : un pas de 2 repetitions par pas (RATE 1/2 pas), RLEN 2 pas, VFAD -64 : 4 notes qui descendent
        mm::Program rt;
        rt.len = 16;
        mm::ProgHit rh = hitAt(0, 1.f);
        rh.rtrg = true;
        rh.every = 0.5;
        rh.rlen = 2;
        rh.vfad = -64;
        rt.tracks[3].hits = {rh};
        r = mm::exportPattern(rt);
        auto oh = notesOf(r, 46);
        ok = oh == (std::vector<long>{0, 120, 240, 360});
        int lastVel = 128;
        for (size_t k = 0; k < r.notes.size(); ++k) {
            const auto& n = r.notes[k];
            ok = ok && n.vel < lastVel && n.len == (k + 1 < r.notes.size() ? 119 : 240);
            lastVel = n.vel;
        }
        CHECK(ok, "MIDI : RTRG, 4 repetitions qui descendent (VFAD), sans chevauchement");

        // Le mute, le lock trig, LEN ; la piste 16 sur son pad (D#2, 51)
        mm::Program m;
        m.len = 16;
        m.tracks[0].hits = {hitAt(0, 1.f)};
        m.tracks[0].plays = false;
        mm::ProgHit lt = hitAt(4, 1.f);
        lt.lt = true;
        m.tracks[1].hits = {lt};
        mm::ProgHit ln = hitAt(8, 0.8f);
        ln.len = 2;
        m.tracks[15].hits = {ln};
        r = mm::exportPattern(m);
        CHECK(r.notes.size() == 1 && r.notes[0].note == 51 && r.notes[0].tick == 1920 && r.notes[0].len == 480 && r.notes[0].vel == 102, "MIDI : une piste coupee et un lock trig sans note, LEN 2 pas, CY2 sur D#2 (51)");

        // La table des notes : 16 pistes, 16 pads de C1 a D#2, chacun une fois ; l'entree MIDI du plugin les relit
        bool table = true;
        std::array<int, 128> seen{};
        for (int k = 0; k < mm::kProgTracks; ++k) {
            const int nn = mm::kTrackNote[static_cast<size_t>(k)];
            table = table && nn >= 36 && nn <= 51 && ++seen[static_cast<size_t>(nn)] == 1 && mm::trackOfMidiNote(nn) == k;
        }
        CHECK(table && mm::trackOfMidiNote(35) == 0 && mm::trackOfMidiNote(60) == -1, "MIDI : les 16 pistes sur les 16 pads (C1 a D#2), relues par l'entree MIDI");

        // Le fichier : MThd format 0, 960 ticks, une piste ; autant de note-on que de notes, la fin au bout des 4 noires
        r = mm::exportPattern(p);
        const auto f = mm::writeSmf(r, 130, "MM-RYTM A01");
        ok = f.size() > 22 && f[0] == 'M' && f[1] == 'T' && f[2] == 'h' && f[3] == 'd' && f[9] == 0 && f[11] == 1 && ((f[12] << 8) | f[13]) == 960 && f[14] == 'M' && f[17] == 'k';
        const size_t trkLen = (static_cast<size_t>(f[18]) << 24) | (static_cast<size_t>(f[19]) << 16) | (static_cast<size_t>(f[20]) << 8) | f[21];
        ok = ok && trkLen + 22 == f.size();
        // Relire : les delta-times, les note-on, le tick de la fin
        size_t i = 22;
        long tick = 0;
        int ons = 0;
        long endTick = -1;
        uint8_t status = 0;
        while (ok && i < f.size()) {
            uint32_t d = 0;
            for (;;) {
                const uint8_t b = f[i++];
                d = (d << 7) | (b & 0x7f);
                if (!(b & 0x80)) break;
            }
            tick += d;
            if (f[i] == 0xff) {
                const uint8_t ty = f[i + 1];
                const uint8_t l = f[i + 2];
                if (ty == 0x2f) endTick = tick;
                i += 3 + l;
                continue;
            }
            status = f[i++];
            const uint8_t a = f[i++];
            const uint8_t b = f[i++];
            if ((status & 0xf0) == 0x90 && b > 0) ++ons;
            (void)a;
        }
        CHECK(ok && ons == 6 && endTick == 3840, "MIDI : le fichier se relit (format 0, 960 ticks, 6 notes, la fin a 4 noires)");
        CHECK(mm::slotName(0) == "A01" && mm::slotName(17) == "B02" && mm::slotName(127) == "H16", "MIDI : le nom de l'emplacement (A01, B02, H16)");
    }

    // VU-metres (2026-11-10) : un coup du SD en direct, avec les effets : la crete du SD monte, celle du BD reste a 0 ; la
    // lecture la remet a 0
    {
        mm::Engine e;
        e.prepare(SR);
        auto ps = makeState(baseProgram());
        e.publish(ps);
        e.pushLive(live(*ps, 1));
        for (int k = 0; k < 10; ++k) {
            clear();
            e.process(stop, L.data(), R.data(), 480);
        }
        const float sd = e.fbPeak[1].exchange(0.f);
        const float bd = e.fbPeak[0].exchange(0.f);
        CHECK(sd > 0.01f && bd == 0.f, "VU : le SD frappe, sa crete monte, le BD reste a zero");
        CHECK(e.fbPeak[1].load() == 0.f, "VU : la lecture remet la crete a zero");
    }

    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "TOUT EST OK", fails, fails > 1 ? "s" : "");
    return fails ? 1 : 0;
}
