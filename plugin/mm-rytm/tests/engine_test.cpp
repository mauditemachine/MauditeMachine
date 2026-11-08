// Tests du moteur temps reel, sans hote ni carte son : tout se lit dans les buffers.
#include "../dsp/Engine.h"

#include <cmath>
#include <cstdio>
#include <vector>

static int fails = 0;
#define CHECK(c, msg)                                   \
    do {                                                \
        if (!(c)) {                                     \
            std::printf("KO  %s\n", msg);               \
            ++fails;                                    \
        } else std::printf("OK  %s\n", msg);            \
    } while (0)

static double energy(const std::vector<float>& x, int a, int b) {
    double e = 0;
    for (int i = a; i < b; ++i) e += static_cast<double>(x[i]) * x[i];
    return e;
}

int main() {
    const double sr = 48000;
    mm::Engine eng;
    eng.prepare(sr);
    for (int t = 0; t < mm::kTracks; ++t) {
        auto s = std::make_shared<mm::TrackSound>();
        mm::ShotTweak tw;
        tw.model = t == mm::T_BD ? mm::KitModel::K909 : mm::KitModel::MM;
        for (int v = 0; v < mm::variantsOf(mm::shotOfTrack(t)); ++v) s->variants.push_back(mm::renderShot(mm::shotOfTrack(t), sr, 1, v, tw));
        eng.publish(t, s);
    }

    // 1. un coup du kick a l'offset 100 : silence avant, du son apres
    const int n = 4800;
    std::vector<float> L(n), R(n);
    eng.trigger(mm::T_BD, 1.f, 100);
    eng.render(L.data(), R.data(), nullptr, nullptr, n);
    CHECK(energy(L, 0, 100) == 0 && energy(L, 100, n) > 1, "kick : rien avant son offset, du son apres");

    // 2. le kick monophonique : un second coup coupe le premier en 3 ms
    eng.allNotesOff();
    std::fill(L.begin(), L.end(), 0.f);
    std::fill(R.begin(), R.end(), 0.f);
    eng.trigger(mm::T_BD, 1.f, 0);
    eng.trigger(mm::T_BD, 1.f, 2000);
    eng.render(L.data(), R.data(), nullptr, nullptr, n);
    // le nouveau coup, a 2000 + 3 ms + quelques echantillons, est la seule voix : comparer a un coup seul
    std::vector<float> L2(n), R2(n);
    mm::Engine solo;
    solo.prepare(sr);
    {
        auto s = std::make_shared<mm::TrackSound>();
        mm::ShotTweak tw;
        tw.model = mm::KitModel::K909;
        s->variants.push_back(mm::renderShot(mm::ShotId::BD, sr, 1, 0, tw));
        solo.publish(mm::T_BD, s);
    }
    solo.trigger(mm::T_BD, 1.f, 2000);
    solo.render(L2.data(), R2.data(), nullptr, nullptr, n);
    double diff = 0;
    for (int i = 2000 + 200; i < n; ++i) diff = std::max(diff, std::fabs(static_cast<double>(L[i]) - L2[i]));
    CHECK(diff < 1e-6, "kick mono : apres 3 ms, seul le second coup sonne");
    double before = 0;
    for (int i = 1900; i < 2000; ++i) before = std::max(before, std::fabs(static_cast<double>(L[i])));
    CHECK(before > 1e-3, "kick mono : le premier sonne jusqu'au second");

    // 3. le choke : OH coupe par CH
    eng.allNotesOff();
    std::fill(L.begin(), L.end(), 0.f);
    std::fill(R.begin(), R.end(), 0.f);
    mm::TrackMix mute;
    mute.mute = true;
    eng.setMix(mm::T_CH, mute); // on n'ecoute que l'OH
    eng.trigger(mm::T_OH, 1.f, 0);
    eng.trigger(mm::T_CH, 1.f, 1000);
    eng.render(L.data(), R.data(), nullptr, nullptr, n);
    CHECK(energy(L, 0, 1000) > 0 && energy(L, 1000 + 400, n) == 0, "choke : CH ferme l'OH en 8 ms");
    eng.setMix(mm::T_CH, mm::TrackMix{});

    // 4. multi-out : une piste sur sa sortie, rien sur le main
    eng.allNotesOff();
    std::vector<std::vector<float>> aux(16, std::vector<float>(n, 0.f));
    float* al[8];
    float* ar[8];
    for (int t = 0; t < 8; ++t) {
        al[t] = aux[2 * t].data();
        ar[t] = aux[2 * t + 1].data();
    }
    std::fill(L.begin(), L.end(), 0.f);
    mm::TrackMix own;
    own.ownOut = true;
    eng.setMix(mm::T_SD, own);
    eng.trigger(mm::T_SD, 1.f, 0);
    eng.render(L.data(), R.data(), al, ar, n);
    CHECK(energy(L, 0, n) == 0 && energy(aux[2], 0, n) > 0.1, "multi-out : SD sur sa sortie seulement");
    eng.setMix(mm::T_SD, mm::TrackMix{});

    // 5. le sequenceur : 16 pas droits sur 4 noires, le pas 2 avec swing 0.66
    mm::Sequencer seq;
    for (int s = 0; s < 16; ++s) seq.steps[mm::T_CH][s] = 1;
    std::vector<double> at;
    const double bpm = 120, pps = bpm / 60 / sr;
    double ppq = 0;
    for (int b = 0; b < 200; ++b) {
        seq.process(ppq, pps, 512, 0.5, 16, [&](int, float, int off) { at.push_back(ppq + off * pps); });
        ppq += 512 * pps;
    }
    bool regular = at.size() >= 16;
    for (size_t i = 0; i < at.size() && i < 16; ++i) regular = regular && std::fabs(at[i] - 0.25 * i) < 2 * pps;
    CHECK(regular, "sequenceur : un pas tous les seizieme, cale sur la position de l'hote");
    at.clear();
    ppq = 0;
    for (int b = 0; b < 20; ++b) {
        seq.process(ppq, pps, 512, 0.66, 16, [&](int, float, int off) { at.push_back(ppq + off * pps); });
        ppq += 512 * pps;
    }
    CHECK(at.size() >= 2 && std::fabs(at[1] - 0.33) < 2 * pps, "sequenceur : swing 66 % place le second pas a 0.33 noire");
    // aucun pas perdu ni double sur une frontiere de bloc
    mm::Sequencer one;
    one.steps[0][0] = 1;
    int hits = 0;
    ppq = 0;
    for (int b = 0; b < 1000; ++b) {
        one.process(ppq, pps, 37, 0.5, 16, [&](int, float, int) { ++hits; });
        ppq += 37 * pps;
    }
    const int bars = static_cast<int>(ppq / 4) + 1;
    CHECK(hits == bars, "sequenceur : un coup par mesure, blocs de 37 echantillons");

    std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "TOUT EST OK", fails, fails > 1 ? "s" : "");
    return fails ? 1 : 0;
}
