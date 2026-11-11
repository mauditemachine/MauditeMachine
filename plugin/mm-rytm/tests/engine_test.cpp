// Tests du moteur temps reel, sans hote ni carte son : tout se lit dans les buffers (jamais de lecture audio).
#include "../dsp/Engine.h"
#include "../dsp/MidiExport.h"

#include <array>
#include <cmath>
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
