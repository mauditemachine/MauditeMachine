#include "MidiExport.h"

#include "Engine.h"

#include <algorithm>
#include <cmath>
#include <numeric>

namespace mm {

int trackOfMidiNote(int note) {
    for (int t = 0; t < kProgTracks; ++t)
        if (kTrackNote[static_cast<size_t>(t)] == note) return t;
    switch (note) {
        case 35: return 0;                     // Acoustic Bass Drum : BD
        case 52: case 55: case 57: return 7;   // les autres cymbales : CY
        default: return -1;
    }
}

std::string slotName(int slot) {
    const int s = std::max(0, std::min(127, slot));
    std::string out(1, static_cast<char>('A' + s / 16));
    const int n = s % 16 + 1;
    out += static_cast<char>('0' + n / 10);
    out += static_cast<char>('0' + n % 10);
    return out;
}

namespace {

constexpr double kEps = 1e-9;
constexpr double kInf = 1e18;

struct Rng {
    uint32_t s;
    uint32_t next() {
        s += 0x6d2b79f5u;
        uint32_t t = s;
        t = (t ^ (t >> 15)) * (t | 1u);
        t ^= t + (t ^ (t >> 7)) * (t | 61u);
        return t ^ (t >> 14);
    }
};

// Un coup a poser : sa place (en pas, depuis le debut), sa piste, sa velocite, sa longueur (LEN, -1 : INF)
struct Hit {
    double pos;
    int track;
    float vel;
    double len;
};

// Le retrig d'une piste (Engine::Retrig, sans le son)
struct Rt {
    bool on = false;
    double pos = 0, every = 1, end = 0, span = 16;
    int vfad = 0;
    float vel = 1;
    double len = -1;
};

struct Seq {
    int pre = -1;
    Rt rt;
};

// Les repetitions dans [from, to), avant `before` ; false : le retrig est fini (Engine::repeats)
bool repeats(int track, Rt& rt, double from, double to, double before, std::vector<Hit>& out) {
    long k = std::max(1L, static_cast<long>(std::ceil((from - rt.pos) / rt.every - kEps)));
    for (;; ++k) {
        const double rp = rt.pos + static_cast<double>(k) * rt.every;
        if (rp >= to - kEps || rp >= before - kEps) return true;
        if (rp >= rt.end - kEps) return false;
        out.push_back({rp, track, rtrgGain(rt.vel, rt.vfad, (rp - rt.pos) / rt.span), rt.len});
    }
}

long lcm(long a, long b) { return a / std::gcd(a, b) * b; }

} // namespace

ExportResult exportPattern(const Program& p, long maxSteps, uint32_t seed) {
    ExportResult r;
    const int len = std::max(1, std::min(128, p.len));
    // Un passage du pattern (la page bouclee, sinon toute la longueur)
    const long pass = p.loop >= 0 && p.loop * 16 < len ? std::min(16, len - p.loop * 16) : len;
    // Le cycle : les passages qu'il faut aux conditions A:B, les longueurs des pistes (TLEN), des mesures entieres
    long passes = 1;
    long cycle = 0;
    std::array<std::vector<int>, kProgTracks> at;
    for (int t = 0; t < kProgTracks; ++t) {
        const ProgTrack& pt = p.tracks[static_cast<size_t>(t)];
        at[static_cast<size_t>(t)].assign(static_cast<size_t>(len), -1);
        for (size_t i = 0; i < pt.hits.size(); ++i) {
            const ProgHit& h = pt.hits[i];
            if (h.g >= 0 && h.g < len) at[static_cast<size_t>(t)][static_cast<size_t>(h.g)] = static_cast<int>(i);
            if (h.ck == 6 && h.cb > 1) passes = lcm(passes, h.cb);
        }
    }
    cycle = pass * passes;
    for (int t = 0; t < kProgTracks; ++t) {
        const ProgTrack& pt = p.tracks[static_cast<size_t>(t)];
        if (pt.tlen > 0 && p.loop < 0 && !pt.hits.empty()) cycle = lcm(cycle, pt.tlen);
    }
    cycle = lcm(cycle, 16);
    if (cycle > maxSteps) {
        cycle = std::max(16L, maxSteps / 16 * 16);
        r.capped = true;
    }
    r.steps = cycle;

    // Trois cycles joues comme le moteur ; le deuxieme (le regime : les retrigs, les PRE et les avances de uTIME d'avant lui)
    std::vector<Hit> hits;
    std::array<Seq, kProgTracks> ts;
    Rng rng{seed};
    int passN = 1;
    bool seenFirst = false;
    const long total = cycle * 3;
    for (long G = 0; G < total; ++G) {
        const int g = programStepOf(p, G);
        if (g == 0) {
            if (seenFirst) ++passN;
            seenFirst = true;
        }
        const double swingFrac = ((g % 16) & 1) ? p.swing : 0.0;
        const double stepEnd = static_cast<double>(G) + 1;
        for (int t = 0; t < kProgTracks; ++t) {
            const ProgTrack& pt = p.tracks[static_cast<size_t>(t)];
            Seq& sv = ts[static_cast<size_t>(t)];
            const int nei = t > 0 ? ts[static_cast<size_t>(t - 1)].pre : -1;
            if (!pt.plays) sv.rt.on = false;
            const int gt = pt.tlen > 0 && p.loop < 0 ? static_cast<int>(G % pt.tlen) : g;
            const auto& map = at[static_cast<size_t>(t)];
            const int hi = gt >= 0 && gt < static_cast<int>(map.size()) ? map[static_cast<size_t>(gt)] : -1;
            if (hi < 0) {
                if (sv.rt.on && !repeats(t, sv.rt, static_cast<double>(G), stepEnd, kInf, hits)) sv.rt.on = false;
                continue;
            }
            const ProgHit& h = pt.hits[static_cast<size_t>(hi)];
            bool ok = true;
            if (h.ck != 0) {
                ok = condTrue(h.ck, h.cn, h.ca, h.cb, passN, false, false, sv.pre, nei);
                sv.pre = ok ? 1 : 0;
            } else if (h.prob < 100) {
                ok = (rng.next() / 4294967296.0) * 100 < h.prob;
                sv.pre = ok ? 1 : 0;
            }
            const double pos = static_cast<double>(G) + swingFrac + h.shift;
            if (h.lt) {
                if (sv.rt.on && !repeats(t, sv.rt, static_cast<double>(G), stepEnd, kInf, hits)) sv.rt.on = false;
                continue;
            }
            if (!ok || !pt.plays) {
                if (sv.rt.on && !repeats(t, sv.rt, static_cast<double>(G), stepEnd, kInf, hits)) sv.rt.on = false;
                continue;
            }
            if (sv.rt.on) {
                repeats(t, sv.rt, static_cast<double>(G), stepEnd, pos, hits);
                sv.rt.on = false;
            }
            hits.push_back({pos, t, h.vel, h.len});
            if (h.rtrg) {
                Rt& rt = sv.rt;
                rt.on = true;
                rt.pos = pos;
                rt.every = std::max(1.0 / 8, h.every);
                rt.end = h.rlen < 0 ? kInf : pos + h.rlen;
                rt.span = h.rlen < 0 ? 16 : h.rlen;
                rt.vfad = h.vfad;
                rt.vel = h.vel;
                rt.len = h.len;
                if (!repeats(t, rt, pos, stepEnd, kInf, hits)) rt.on = false;
            }
        }
    }

    // Le deuxieme cycle, ramene a zero ; une note par piste et par tick ; la velocite de 1 a 127
    const double c0 = static_cast<double>(cycle);
    const double c1 = 2.0 * c0;
    for (const Hit& h : hits) {
        if (h.pos < c0 - kEps || h.pos >= c1 - kEps || h.vel <= 0.f) continue;
        ExportNote n;
        n.tick = std::max(0L, std::min(cycle * kTicksPerStep - 1, static_cast<long>(std::lround((h.pos - c0) * kTicksPerStep))));
        n.track = h.track;
        n.note = kTrackNote[static_cast<size_t>(h.track)];
        n.vel = std::max(1, std::min(127, static_cast<int>(std::lround(h.vel * 127.0))));
        // LEN : sa longueur ; INF : un pas (un Drum Rack joue ses pads en entier)
        n.len = std::max(1L, static_cast<long>(std::lround((h.len > 0 ? h.len : 1.0) * kTicksPerStep)));
        r.notes.push_back(n);
    }
    std::stable_sort(r.notes.begin(), r.notes.end(), [](const ExportNote& a, const ExportNote& b) { return a.tick < b.tick || (a.tick == b.tick && a.track < b.track); });
    r.notes.erase(std::unique(r.notes.begin(), r.notes.end(), [](const ExportNote& a, const ExportNote& b) { return a.tick == b.tick && a.note == b.note; }), r.notes.end());
    // Deux notes de la meme hauteur ne se chevauchent pas (la suivante coupe la precedente), ni la fin du clip
    const long end = cycle * kTicksPerStep;
    for (size_t i = 0; i < r.notes.size(); ++i) {
        long next = end;
        for (size_t j = i + 1; j < r.notes.size(); ++j)
            if (r.notes[j].note == r.notes[i].note) {
                next = r.notes[j].tick;
                break;
            }
        r.notes[i].len = std::max(1L, std::min(r.notes[i].len, next - r.notes[i].tick - 1));
    }
    return r;
}

namespace {

void vlq(std::vector<uint8_t>& o, uint32_t v) {
    uint8_t buf[5];
    int n = 0;
    buf[n++] = static_cast<uint8_t>(v & 0x7f);
    while ((v >>= 7) != 0) buf[n++] = static_cast<uint8_t>((v & 0x7f) | 0x80);
    while (n > 0) o.push_back(buf[--n]);
}

void be32(std::vector<uint8_t>& o, uint32_t v) {
    for (int s = 24; s >= 0; s -= 8) o.push_back(static_cast<uint8_t>((v >> s) & 0xff));
}

} // namespace

std::vector<uint8_t> writeSmf(const ExportResult& r, double bpm, const std::string& name) {
    struct Ev {
        long tick;
        int order; // a tick egal : les fins de note avant les debuts
        uint8_t a, b, c;
    };
    std::vector<Ev> evs;
    for (const ExportNote& n : r.notes) {
        evs.push_back({n.tick, 1, 0x99, static_cast<uint8_t>(n.note), static_cast<uint8_t>(n.vel)});
        evs.push_back({n.tick + n.len, 0, 0x89, static_cast<uint8_t>(n.note), 0});
    }
    std::stable_sort(evs.begin(), evs.end(), [](const Ev& x, const Ev& y) { return x.tick < y.tick || (x.tick == y.tick && x.order < y.order); });

    std::vector<uint8_t> trk;
    // Le nom, 4/4, le tempo
    vlq(trk, 0);
    trk.insert(trk.end(), {0xff, 0x03});
    vlq(trk, static_cast<uint32_t>(name.size()));
    trk.insert(trk.end(), name.begin(), name.end());
    vlq(trk, 0);
    trk.insert(trk.end(), {0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08});
    const uint32_t us = static_cast<uint32_t>(std::lround(60000000.0 / std::max(20.0, std::min(400.0, bpm))));
    vlq(trk, 0);
    trk.insert(trk.end(), {0xff, 0x51, 0x03, static_cast<uint8_t>((us >> 16) & 0xff), static_cast<uint8_t>((us >> 8) & 0xff), static_cast<uint8_t>(us & 0xff)});
    long last = 0;
    for (const Ev& e : evs) {
        vlq(trk, static_cast<uint32_t>(e.tick - last));
        last = e.tick;
        trk.insert(trk.end(), {e.a, e.b, e.c});
    }
    // La fin de la piste au bout du clip (des mesures entieres)
    const long end = std::max(last, r.steps * kTicksPerStep);
    vlq(trk, static_cast<uint32_t>(end - last));
    trk.insert(trk.end(), {0xff, 0x2f, 0x00});

    std::vector<uint8_t> out = {'M', 'T', 'h', 'd', 0, 0, 0, 6, 0, 0, 0, 1};
    out.push_back(static_cast<uint8_t>((kExportPpq >> 8) & 0xff));
    out.push_back(static_cast<uint8_t>(kExportPpq & 0xff));
    out.insert(out.end(), {'M', 'T', 'r', 'k'});
    be32(out, static_cast<uint32_t>(trk.size()));
    out.insert(out.end(), trk.begin(), trk.end());
    return out;
}

} // namespace mm
