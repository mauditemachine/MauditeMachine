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

    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "TOUT EST OK", fails, fails > 1 ? "s" : "");
    return fails ? 1 : 0;
}
