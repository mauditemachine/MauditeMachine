// MM-ARP, LATENCY ZERO (2026-11-23, Mika : "le moins de ms possible") : les demi-bandes a phase minimale.
//
// Un filtre demi-bande RII polyphase (deux chaines paralleles de passe-tout du premier ordre en z^-2, Valenzuela et
// Constantinides ; la conception par fonctions elliptiques suit la methode publiee de HIIR, Laurent de Soras, licence
// WTFPL ; ecrite ici) remplace les demi-bandes RIF a phase lineaire (Kaiser) des decimateurs du moteur, de la DISTO et de
// WARMTH. Aucune latence pure : le retard de groupe au grave est de 1.7 a 2.8 echantillons de base pour la cascade du
// moteur (x2 a x8, mesure par latency_test), il n'y a rien a declarer a l'hote. La reponse en amplitude est celle d'un elliptique : plate a 1e-6 dB pres dans la bande
// passante, -3 dB au quart du taux (le complement en puissance), puis l'attenuation demandee. Deux a quatre fois moins
// d'operations que les RIF qu'elles remplacent.
//
//   double c[kMaxCoefs]; int n = IirHalfband::design(attenDb, transition, c);   // transition : sa largeur totale, en
//                                                                                // part du taux haut, centree sur 1/4
//   IirDown2 d; d.set(c, n); y = d.run(xOlder, xNewer);                          // deux echantillons hauts -> un
//   IirUp2 u; u.set(c, n); u.run(x, y0, y1);                                     // un echantillon -> deux (y0 d'abord)
//
// Tout est en double ; aucune allocation ; clear() remet a zero (le silence du moteur).
#pragma once

#include <cmath>

namespace mmarp {

struct IirHalfband {
    static constexpr int kMaxCoefs = 16;
    // Les coefficients (ordre croissant : pairs pour la premiere chaine, impairs pour la seconde) d'un demi-bande de
    // `attenDb` dB d'attenuation hors bande, la bande de transition de `transition` (part du taux haut, centree sur le
    // quart : la bande passante s'arrete a (0.25 - transition / 2) x taux haut). Retourne leur nombre (au plus maxCoefs).
    static int design(double attenDb, double transition, double* coefs, int maxCoefs = kMaxCoefs) {
        double k = 0, q = 0;
        transitionParam(k, q, transition);
        const double a2 = std::pow(10.0, -attenDb / 10.0);
        const double a = a2 / (1 - a2);
        int order = static_cast<int>(std::ceil(std::log(a * a / 16) / std::log(q)));
        if ((order & 1) == 0) ++order;
        if (order < 3) order = 3;
        int n = (order - 1) / 2;
        if (n > maxCoefs) n = maxCoefs;
        order = 2 * n + 1;
        for (int i = 0; i < n; ++i) coefs[i] = coef(i, k, q, order);
        return n;
    }
    // Le meme a nombre de coefficients impose (la transition fixee : l'attenuation en decoule)
    static void designN(int n, double transition, double* coefs) {
        double k = 0, q = 0;
        transitionParam(k, q, transition);
        const int order = 2 * n + 1;
        for (int i = 0; i < n; ++i) coefs[i] = coef(i, k, q, order);
    }

private:
    static constexpr double kPi = 3.14159265358979323846;
    static void transitionParam(double& k, double& q, double transition) {
        k = std::tan((1 - transition * 2) * kPi / 4);
        k *= k;
        const double kk = std::pow(1 - k * k, 0.25);
        const double e = 0.5 * (1 - kk) / (1 + kk);
        const double e2 = e * e, e4 = e2 * e2;
        q = e * (1 + e4 * (2 + e4 * (15 + 150 * e4)));
    }
    static double ipow(double x, int p) {
        double r = 1;
        while (p > 0) {
            if (p & 1) r *= x;
            x *= x;
            p >>= 1;
        }
        return r;
    }
    static double coef(int index, double k, double q, int order) {
        const int c = index + 1;
        double num = 0, den = 0;
        {
            int i = 0, j = 1;
            double t;
            do {
                t = ipow(q, i * (i + 1)) * std::sin((i * 2 + 1) * c * kPi / order) * j;
                num += t;
                j = -j;
                ++i;
            } while (std::fabs(t) > 1e-100 && i < 64);
        }
        {
            int i = 1, j = -1;
            double t;
            do {
                t = ipow(q, i * i) * std::cos(i * 2 * c * kPi / order) * j;
                den += t;
                j = -j;
                ++i;
            } while (std::fabs(t) > 1e-100 && i < 64);
        }
        num *= std::pow(q, 0.25);
        den += 0.5;
        const double ww = num / den, w2 = ww * ww;
        const double x = std::sqrt((1 - w2 * k) * (1 - w2 / k)) / (1 + w2);
        return (1 - x) / (1 + x);
    }
};

// Deux echantillons du taux haut (le plus ancien, le plus recent) -> un echantillon de base.
// H(z) = (A0(z^2) + z^-1 A1(z^2)) / 2 ; A0 : les coefficients pairs, sur l'echantillon le plus recent.
struct IirDown2 {
    double c[IirHalfband::kMaxCoefs] = {};
    double x[IirHalfband::kMaxCoefs] = {}, y[IirHalfband::kMaxCoefs] = {};
    int n = 0;
    void set(const double* coefs, int nc) {
        n = nc;
        for (int i = 0; i < nc; ++i) c[i] = coefs[i];
        clear();
    }
    void clear() {
        for (int i = 0; i < IirHalfband::kMaxCoefs; ++i) x[i] = y[i] = 0;
    }
    double run(double older, double newer) {
        double s0 = newer, s1 = older;
        int i = 0;
        for (; i + 1 < n; i += 2) {
            const double t0 = (s0 - y[i]) * c[i] + x[i];
            const double t1 = (s1 - y[i + 1]) * c[i + 1] + x[i + 1];
            x[i] = s0;
            x[i + 1] = s1;
            y[i] = t0;
            y[i + 1] = t1;
            s0 = t0;
            s1 = t1;
        }
        if (i < n) {
            const double t0 = (s0 - y[i]) * c[i] + x[i];
            x[i] = s0;
            y[i] = t0;
            s0 = t0;
        }
        return 0.5 * (s0 + s1);
    }
    // les etats sous le denormal remis a zero (fin de bloc)
    void flush() {
        for (int i = 0; i < n; ++i) {
            if (std::fabs(x[i]) < 1e-25) x[i] = 0;
            if (std::fabs(y[i]) < 1e-25) y[i] = 0;
        }
    }
};

// Un echantillon de base -> deux du taux haut (out0 d'abord). H(z) = A0(z^2) + z^-1 A1(z^2) (le gain 2 du bourrage de
// zeros compense).
struct IirUp2 {
    double c[IirHalfband::kMaxCoefs] = {};
    double x[IirHalfband::kMaxCoefs] = {}, y[IirHalfband::kMaxCoefs] = {};
    int n = 0;
    void set(const double* coefs, int nc) {
        n = nc;
        for (int i = 0; i < nc; ++i) c[i] = coefs[i];
        clear();
    }
    void clear() {
        for (int i = 0; i < IirHalfband::kMaxCoefs; ++i) x[i] = y[i] = 0;
    }
    void run(double in, double& out0, double& out1) {
        double s0 = in, s1 = in;
        int i = 0;
        for (; i + 1 < n; i += 2) {
            const double t0 = (s0 - y[i]) * c[i] + x[i];
            const double t1 = (s1 - y[i + 1]) * c[i + 1] + x[i + 1];
            x[i] = s0;
            x[i + 1] = s1;
            y[i] = t0;
            y[i + 1] = t1;
            s0 = t0;
            s1 = t1;
        }
        if (i < n) {
            const double t0 = (s0 - y[i]) * c[i] + x[i];
            x[i] = s0;
            y[i] = t0;
            s0 = t0;
        }
        out0 = s0;
        out1 = s1;
    }
    void flush() {
        for (int i = 0; i < n; ++i) {
            if (std::fabs(x[i]) < 1e-25) x[i] = 0;
            if (std::fabs(y[i]) < 1e-25) y[i] = 0;
        }
    }
};

} // namespace mmarp
