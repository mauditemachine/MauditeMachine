#include "HellViews.h"

#include <algorithm>
#include <map>

namespace hl {

namespace {

constexpr float kSweep = 135.f;
constexpr double kDead = 0.03;

juce::Point<float> polar(juce::Point<float> c, float v01, float r) {
    const float a = juce::degreesToRadians(-kSweep + 2 * kSweep * v01);
    return {c.x + std::sin(a) * r, c.y - std::cos(a) * r};
}

} // namespace

/* ------------------------------------------------------------------ l'echelle du decaleur ------------------------------------------------------------------ */

void paintShiftScale(juce::Graphics& g, juce::Point<float> c, int range) {
    struct Mark {
        float v;
        juce::String t;
    };
    std::vector<Mark> half;
    if (range == 0)
        for (double hz : {10.0, 30.0, 80.0, 200.0}) half.push_back({static_cast<float>(mmarp::Hell::shiftVFor(hz, 0)), juce::String(static_cast<int>(hz))});
    else if (range == 1)
        for (double hz : {50.0, 200.0, 1000.0, 5000.0})
            half.push_back({static_cast<float>(mmarp::Hell::shiftVFor(hz, 1)), hz >= 1000 ? juce::String(static_cast<int>(hz / 1000)) + "K" : juce::String(static_cast<int>(hz))});
    else if (range == 2)
        for (int i : {2, 4, 6, 8}) {
            const double m = mmhell::kSyncMult[i];
            const double ax = kDead + (1 - kDead) * (i + 0.5) / 9;
            half.push_back({static_cast<float>(0.5 + ax / 2), m >= 1 ? juce::String(static_cast<int>(m)) : "1/" + juce::String(juce::roundToInt(1 / m))});
        }
    else
        for (double r : {0.25, 0.5, 1.0, 2.0}) {
            const double ax = kDead + (1 - kDead) * ((std::log2(r) + 4) / 5);
            half.push_back({static_cast<float>(0.5 + ax / 2), r >= 1 ? juce::String(static_cast<int>(r)) + "X" : "1/" + juce::String(juce::roundToInt(1 / r))});
        }
    const float r0 = 70, r1 = 78, rt = 92;
    g.setColour(kSilk.withAlpha(0.18f));
    g.drawEllipse(c.x - r1 - 2, c.y - r1 - 2, 2 * (r1 + 2), 2 * (r1 + 2), 0.8f);
    g.setColour(kSilk.withAlpha(0.4f));
    for (int i = 0; i <= 40; ++i) {
        const auto a = polar(c, i / 40.f, r0 + 3), b = polar(c, i / 40.f, r1 - 1);
        g.drawLine(a.x, a.y, b.x, b.y, 0.7f);
    }
    const auto f = font(9.f, Weight::Bold, 0.04f);
    const auto mark = [&](float v, const juce::String& t, bool zero) {
        const auto a = polar(c, v, r0), b = polar(c, v, r1 + 2), p = polar(c, v, rt);
        g.setColour(kSilk.withAlpha(0.9f));
        g.drawLine(a.x, a.y, b.x, b.y, 1.3f);
        text(g, t, {p.x - 18, p.y - 6, 36, 12}, f, zero ? accent() : kSilk.withAlpha(0.9f));
    };
    for (const auto& m : half) {
        mark(m.v, m.t, false);
        mark(1.f - m.v, m.t, false);
    }
    mark(0.5f, "0", true);
    const auto sf = font(13.f, Weight::Bold);
    text(g, "-", {c.x - 28 - 8, c.y - rt - 8 - 16, 16, 16}, sf, kSilk.withAlpha(0.8f));
    text(g, "+", {c.x + 28 - 8, c.y - rt - 8 - 16, 16, 16}, sf, kSilk.withAlpha(0.8f));
}

/* ------------------------------------------------------------------ le verre noir ------------------------------------------------------------------ */

void paintGlass(juce::Graphics& g, juce::Rectangle<float> r, float radius) {
    g.setColour(juce::Colours::white.withAlpha(0.08f));
    g.fillRoundedRectangle(r.expanded(3), radius + 3);
    g.setColour(juce::Colour(0xff050505));
    g.fillRoundedRectangle(r.expanded(2), radius + 2);
    {
        juce::ColourGradient lg(juce::Colour(0xff0b0906), 0, r.getY(), juce::Colour(0xff141008), 0, r.getBottom(), false);
        g.setGradientFill(lg);
        g.fillRoundedRectangle(r, radius);
    }
    {
        const float hx = r.getX() + r.getWidth() * 0.3f;
        juce::ColourGradient rg(juce::Colours::white.withAlpha(0.05f), hx, r.getY(), juce::Colours::white.withAlpha(0.f), hx + r.getWidth() * 0.66f, r.getY(), true);
        g.setGradientFill(rg);
        g.fillRoundedRectangle(r, radius);
    }
    // l'ombre interieure (inset 0 2px 10px)
    {
        juce::Graphics::ScopedSaveState s(g);
        juce::Path clip;
        clip.addRoundedRectangle(r, radius);
        g.reduceClipRegion(clip);
        juce::ColourGradient ig(juce::Colours::black.withAlpha(0.95f), 0, r.getY(), juce::Colours::black.withAlpha(0.f), 0, r.getY() + 12, false);
        g.setGradientFill(ig);
        g.fillRect(r.withHeight(12));
        for (int side = 0; side < 2; ++side) {
            const float x = side == 0 ? r.getX() : r.getRight();
            juce::ColourGradient sg(juce::Colours::black.withAlpha(0.6f), x, 0, juce::Colours::black.withAlpha(0.f), side == 0 ? x + 8 : x - 8, 0, false);
            g.setGradientFill(sg);
            g.fillRect(side == 0 ? r.withWidth(8) : r.withLeft(r.getRight() - 8));
        }
    }
}

/* ------------------------------------------------------------------ le VU du LFO ------------------------------------------------------------------ */

void LfoVu::tick(float lfo, float dt) {
    on_ = !std::isnan(lfo);
    const float goal = on_ ? juce::jlimit(-1.f, 1.f, lfo) : 0.f;
    dt = juce::jlimit(0.001f, 0.05f, dt);
    // un second ordre un peu amorti (~0.3 s), l'aiguille bute aux extremes (HellPage.tsx)
    const float w = 14.f;
    for (int i = 0; i < 4; ++i) {
        const float h = dt / 4;
        v_ += (w * w * (goal - x_) - 2 * 0.72f * w * v_) * h;
        x_ = juce::jlimit(-1.08f, 1.08f, x_ + v_ * h);
    }
    if (std::fabs(x_ - drawn_) > 0.002f || on_ != drawnOn_) repaint();
}

void LfoVu::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const float k = getWidth() / 172.f;
    drawn_ = x_;
    drawnOn_ = on_;
    // le boitier, la face ivoire et son echelle : fixes, en cache (deux etats : eteint, allume)
    const auto& face = face_.get(static_cast<float>(getWidth()), static_cast<float>(getHeight()) * 2, phys, [&](juce::Graphics& fg) {
        for (int lit = 0; lit < 2; ++lit) {
            juce::Graphics::ScopedSaveState s(fg);
            fg.addTransform(juce::AffineTransform::scale(k).translated(0, lit * static_cast<float>(getHeight())));
            const juce::Rectangle<float> box(0, 0, 172, 120);
            juce::ColourGradient bg(juce::Colour(0xff1f1e1d), 0, 0, juce::Colour(0xff0b0a0a), 0, 120, false);
            fg.setGradientFill(bg);
            fg.fillRoundedRectangle(box, 12);
            fg.setColour(juce::Colours::white.withAlpha(0.1f));
            fg.drawRoundedRectangle(box.reduced(0.5f), 12, 1.f);
            const juce::Rectangle<float> fr(4, 4, 164, 112);
            juce::ColourGradient cg(lit ? juce::Colour(0xffefe5cb) : juce::Colour(0xffe9dfc6), 86, 116, lit ? juce::Colour(0xffcbbd9a) : juce::Colour(0xffc6b896), 86 + 164 * 0.62f, 116 - 112 * 0.9f, true);
            cg.addColour(0.55, lit ? juce::Colour(0xffe3d6b8) : juce::Colour(0xffddd1b4));
            fg.setGradientFill(cg);
            fg.fillRoundedRectangle(fr, 8);
            if (lit) {
                juce::ColourGradient glow(juce::Colour::fromFloatRGBA(1.f, 0.78f, 0.47f, 0.22f), 86, 4 + 112 * 0.6f, juce::Colour::fromFloatRGBA(1.f, 0.78f, 0.47f, 0.f), 86 + 70, 4 + 112 * 0.6f, true);
                fg.setGradientFill(glow);
                fg.fillRoundedRectangle(fr, 8);
            }
            const float px = 4 + 7 + 75, py = 4 + 2 + 112 - 22, R = 70;
            const auto arc = [&](float v, float r) {
                const float t = juce::degreesToRadians(v * 42 - 90);
                return juce::Point<float>(px + std::cos(t) * r, py + std::sin(t) * r);
            };
            const auto arcPath = [&](float a, float b, float r) {
                juce::Path p;
                p.addCentredArc(px, py, r, r, 0, juce::degreesToRadians(a * 42), juce::degreesToRadians(b * 42), true);
                return p;
            };
            const juce::Colour ink(0xff1b1714);
            fg.setColour(ink);
            fg.strokePath(arcPath(-1, 1, R), juce::PathStrokeType(1.1f));
            fg.setColour(juce::Colour(0xffb3241a));
            fg.strokePath(arcPath(0.55f, 1, R + 1.75f), juce::PathStrokeType(3.5f));
            fg.setColour(ink);
            for (int i = 0; i <= 20; ++i) {
                const float v = -1 + i / 10.f;
                const bool big = i % 5 == 0;
                const auto a = arc(v, R), b = arc(v, R + (big ? 8.f : 5.f));
                fg.drawLine(a.x, a.y, b.x, b.y, big ? 1.4f : 0.8f);
            }
            const auto tf = font(10.f, Weight::Bold);
            int idx = 0;
            for (float v : {-1.f, 0.f, 1.f}) {
                const auto p = arc(v, R + 16);
                text(fg, idx == 0 ? "-" : idx == 1 ? "0" : "+", {p.x - 8, p.y - 7, 16, 14}, tf, ink);
                ++idx;
            }
            text(fg, "LFO", {px - 40, py - 26 - 8, 80, 13}, font(11.f, Weight::Bold, 0.2f), ink);
            text(fg, "MAUDITE MACHINE", {px - 40, py - 15 - 4, 80, 7}, font(4.5f, Weight::Semibold, 0.3f), ink.withAlpha(0.6f));
        }
    });
    const int lit = on_ ? 1 : 0;
    {
        juce::Graphics::ScopedSaveState s(g);
        g.reduceClipRegion(getLocalBounds());
        g.setOpacity(1.f);
        g.drawImage(face, juce::Rectangle<float>(0, -lit * static_cast<float>(getHeight()), static_cast<float>(getWidth()), static_cast<float>(getHeight()) * 2));
    }
    // l'aiguille et son pivot, la vitre
    g.addTransform(juce::AffineTransform::scale(k));
    const float px = 4 + 7 + 75, py = 4 + 2 + 112 - 22, R = 70;
    const float t = juce::degreesToRadians(x_ * 42 - 90);
    const juce::Point<float> tip(px + std::cos(t) * (R - 6), py + std::sin(t) * (R - 6));
    g.setColour(juce::Colours::black.withAlpha(0.3f));
    g.drawLine(px + 1.5f, py + 2, tip.x + 1.5f, tip.y + 2, 1.6f);
    g.setColour(juce::Colour(0xff120f0d));
    g.drawLine(px, py, tip.x, tip.y, 1.4f);
    g.setColour(juce::Colour(0xff111111));
    g.fillEllipse(px - 7, py - 7, 14, 14);
    g.setColour(juce::Colour(0xff3a3836));
    g.drawEllipse(px - 7, py - 7, 14, 14, 1.f);
    const juce::Rectangle<float> fr(4, 4, 164, 112);
    juce::Path clip;
    clip.addRoundedRectangle(fr, 8);
    g.reduceClipRegion(clip);
    juce::ColourGradient gl(juce::Colours::white.withAlpha(0.42f), fr.getX(), fr.getY(), juce::Colours::white.withAlpha(0.f), fr.getX() + fr.getWidth() * 0.22f,
                            fr.getY() + fr.getHeight() * 0.95f, false);
    gl.addColour(0.6, juce::Colours::white.withAlpha(0.06f));
    g.setGradientFill(gl);
    g.fillRect(fr);
    juce::ColourGradient bot(juce::Colours::black.withAlpha(0.22f), 0, fr.getBottom(), juce::Colours::black.withAlpha(0.f), 0, fr.getBottom() - fr.getHeight() * 0.3f, false);
    g.setGradientFill(bot);
    g.fillRect(fr);
}

/* ------------------------------------------------------------------ l'ECHO MAP ------------------------------------------------------------------ */

void EchoMap::update(const mmhell::HellPatch& p, double mix, double bpm, double noteHz) {
    const bool rangeNeedsBpm = p.range == 2 || p.sync || p.lfoSync;
    if (valid_ && mmhell::same(p, last_) && p.note == last_.note && p.lfoNote == last_.lfoNote && std::fabs(mix - lastMix_) < 1e-4 &&
        (!rangeNeedsBpm || std::fabs(bpm - lastBpm_) < 0.01) && (p.range != 3 || std::fabs(noteHz - lastNote_) < 1e-9))
        return;
    valid_ = true;
    last_ = p;
    lastMix_ = mix;
    lastBpm_ = bpm;
    lastNote_ = noteHz;
    dots_.clear();

    const double sL = mmhell::shiftHz(p, bpm, noteHz);
    const double spread = juce::jlimit(0.0, 1.0, p.spread);
    const double sR = sL * (1 - 2 * spread);
    const double up = juce::jlimit(0.0, 1.0, p.sideband);
    const double gUp = std::min(1.0, 2 * up), gDown = std::min(1.0, 2 * (1 - up));
    const double norm = 1.0 / std::max(1.0, gUp + gDown);
    const double wUp = gUp * norm, wDown = gDown * norm;
    hp_ = mmarp::Hell::hpHzOf(p.hp);
    lp_ = mmarp::Hell::lpHzOf(p.lp);
    f0_ = noteHz > 0 ? noteHz : 440.0;
    const double fb = juce::jlimit(0.0, 1.0, p.feedback);
    spread_ = std::fabs(sR - sL) > 0.05;
    folded_ = false;

    const auto filt = [&](double f) {
        double gn = 1;
        if (hp_ > 0) {
            const double x = std::pow(f / hp_, 2);
            gn *= x / std::sqrt(1 + x * x);
        }
        if (lp_ > 0) {
            const double x = std::pow(f / lp_, 2);
            gn *= 1 / std::sqrt(1 + x * x);
        }
        if (f > 20000) gn = 0;
        return gn;
    };
    const auto pass = [&](const std::map<long, std::pair<double, bool>>& in, double sh) {
        std::map<long, std::pair<double, bool>> out;
        const bool down = (sh > 0 && gDown > 0) || (sh < 0 && gUp > 0);
        for (const auto& [key, ab] : in) {
            const double f = key / 4.0;
            double a = ab.first;
            if (p.antiRefl && down && std::fabs(sh) > 5) {
                const double x = std::pow(f / (1.2 * std::fabs(sh)), 2);
                const double h = x / std::sqrt(1 + x * x);
                a *= h * h;
            }
            for (int band = 0; band < 2; ++band) {
                const double w = band == 0 ? wUp : wDown;
                if (w <= 0) continue;
                double nf = band == 0 ? f + sh : f - sh;
                bool fold = ab.second;
                if (nf < 0) {
                    nf = -nf;
                    fold = true;
                }
                const double na = a * w * filt(nf);
                if (na < 0.004) continue;
                auto& slot = out[std::lround(nf * 4)];
                slot.first = std::sqrt(slot.first * slot.first + na * na);
                slot.second = slot.second || fold;
            }
        }
        // les 48 plus fortes
        if (out.size() > 48) {
            std::vector<std::pair<long, std::pair<double, bool>>> v(out.begin(), out.end());
            std::nth_element(v.begin(), v.begin() + 48, v.end(), [](const auto& a, const auto& b) { return a.second.first > b.second.first; });
            v.resize(48);
            out = std::map<long, std::pair<double, bool>>(v.begin(), v.end());
        }
        return out;
    };
    constexpr int K = 12;
    for (int chain = 0; chain < (spread_ || p.cross ? 2 : 1); ++chain) {
        std::map<long, std::pair<double, bool>> comps{{std::lround(f0_ * 4), {1.0, false}}};
        for (int k = 1; k <= K; ++k) {
            // la ligne de ce passage : CROSS alterne les canaux (et leurs decalages)
            const int ch = p.cross ? (chain + k - 1) % 2 : chain;
            comps = pass(comps, ch == 0 ? sL : sR);
            const double lvl = std::pow(fb, k - 1);
            for (const auto& [key, ab] : comps) {
                const double a = ab.first * lvl;
                if (a < 0.012) continue;
                dots_.push_back({k, key / 4.0, std::min(1.0, a), chain, ab.second});
                folded_ = folded_ || ab.second;
            }
            if (fb <= 0) break;
        }
    }
    // l'en-tete : le temps, le decalage par tour ; le pied : ce que fait le LFO
    const double sec = mmhell::delaySeconds(p, bpm);
    const juce::String t = p.sync ? juce::String(mmhell::kNoteNames[juce::jlimit(0, mmhell::kNotes - 1, p.note)]) + "  " + juce::String(juce::roundToInt(sec * 1000)) + " MS"
                                  : juce::String(mmhell::text::time(p.time));
    head_ = t + "   " + (p.range == 3 && noteHz <= 0 ? juce::String("WAITING FOR A MIDI NOTE") : juce::String(mmhell::text::hz(sL)) + " / REPEAT");
    const double a = std::fabs(juce::jlimit(-1.0, 1.0, p.lfoAmt));
    if (a < 0.005)
        foot_ = {};
    else if (p.lfoTarget == 0)
        foot_ = "LFO  +/- " + juce::String(juce::roundToInt(400 * a * a)) + " HZ ON THE SHIFT";
    else if (p.lfoTarget == 1)
        foot_ = "LFO  +/- " + juce::String(juce::roundToInt(180 * a)) + juce::String::fromUTF8("\xC2\xB0") + " ON THE PHASE";
    else if (p.lfoTarget == 2)
        foot_ = "LFO  +/- " + juce::String(3 * a, 1) + " OCT ON THE LOW-PASS";
    else
        foot_ = "LFO  +/- " + juce::String(juce::roundToInt(25 * a)) + " % ON THE DELAY";
    repaint();
}

void EchoMap::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto b = getLocalBounds().toFloat();
    const auto& glass = glass_.get(b.getWidth(), b.getHeight(), phys, [&](juce::Graphics& gg) { paintGlass(gg, b.reduced(3), 4); });
    g.setOpacity(1.f);
    g.drawImage(glass, b);
    const auto inner = b.reduced(3);
    text(g, "ECHO MAP", {inner.getX() + 8, inner.getY() + 5, 80, 9}, font(6.5f, Weight::Bold, 0.24f), kSilkDim, juce::Justification::centredLeft);
    text(g, head_, {inner.getX() + 70, inner.getY() + 5, inner.getWidth() - 78, 9}, font(6.5f, Weight::Semibold, 0.08f), accent(), juce::Justification::centredRight);
    const juce::Rectangle<float> plot(inner.getX() + 26, inner.getY() + 20, inner.getWidth() - 34, inner.getHeight() - 46);
    const double fLo = 25, fHi = 18000;
    const auto yOf = [&](double f) {
        const double t = std::log(std::max(fLo, std::min(fHi, f)) / fLo) / std::log(fHi / fLo);
        return plot.getBottom() - static_cast<float>(t) * plot.getHeight();
    };
    constexpr int K = 12;
    const auto xOf = [&](int k) { return plot.getX() + plot.getWidth() * (k + 0.5f) / (K + 1); };
    // les filtres de la boucle : ce qu'ils retirent, assombri
    if (hp_ > 0) {
        const float y = yOf(hp_);
        g.setColour(juce::Colours::black.withAlpha(0.42f));
        g.fillRect(plot.withTop(y));
        g.setColour(kSilk.withAlpha(0.25f));
        g.drawHorizontalLine(juce::roundToInt(y), plot.getX(), plot.getRight());
        text(g, "HP", {plot.getRight() - 20, y + 1, 18, 8}, font(5.5f, Weight::Bold, 0.1f), kSilkDim, juce::Justification::centredRight);
    }
    if (lp_ > 0) {
        const float y = yOf(lp_);
        g.setColour(juce::Colours::black.withAlpha(0.42f));
        g.fillRect(plot.withBottom(y));
        g.setColour(kSilk.withAlpha(0.25f));
        g.drawHorizontalLine(juce::roundToInt(y), plot.getX(), plot.getRight());
        text(g, "LP", {plot.getRight() - 20, y - 9, 18, 8}, font(5.5f, Weight::Bold, 0.1f), kSilkDim, juce::Justification::centredRight);
    }
    // la grille : 100 Hz, 1 kHz, 10 kHz
    const auto gf = font(5.5f, Weight::Semibold, 0.06f);
    for (double f : {100.0, 1000.0, 10000.0}) {
        const float y = yOf(f);
        g.setColour(kSilk.withAlpha(0.08f));
        g.drawHorizontalLine(juce::roundToInt(y), plot.getX(), plot.getRight());
        text(g, f >= 1000 ? juce::String(static_cast<int>(f / 1000)) + "K" : "100", {inner.getX() + 4, y - 4, 20, 8}, gf, kSilkFaint, juce::Justification::centredRight);
    }
    for (int k = 0; k <= K; k += 4) text(g, k == 0 ? "IN" : juce::String(k), {xOf(k) - 10, plot.getBottom() + 2, 20, 8}, gf, kSilkFaint);
    // l'entree
    {
        const float x = xOf(0), y = yOf(f0_);
        g.setColour(kSilk.withAlpha(0.85f));
        g.fillEllipse(x - 3, y - 3, 6, 6);
    }
    // les repetitions : la plus forte de chaque tour reliee (la spirale), toutes en points
    const juce::Colour cc[2] = {accent(), kCream};
    for (int chain = 0; chain < 2; ++chain) {
        juce::Path line;
        line.startNewSubPath(xOf(0), yOf(f0_));
        bool any = false;
        for (int k = 1; k <= K; ++k) {
            const Dot* best = nullptr;
            for (const auto& d : dots_)
                if (d.chain == chain && d.k == k && (!best || d.amp > best->amp)) best = &d;
            if (!best) break;
            line.lineTo(xOf(k), yOf(best->hz));
            any = true;
        }
        if (any) {
            g.setColour(cc[chain].withAlpha(0.35f));
            g.strokePath(line, juce::PathStrokeType(1.f));
        }
    }
    for (const auto& d : dots_) {
        const float x = xOf(d.k) + (d.chain == 1 ? 3.f : 0.f), y = yOf(d.hz);
        const float r = 1.4f + 2.6f * static_cast<float>(std::sqrt(d.amp));
        const auto c = cc[d.chain].withAlpha(0.25f + 0.75f * static_cast<float>(d.amp));
        g.setColour(c);
        if (d.folded)
            g.drawEllipse(x - r, y - r, 2 * r, 2 * r, 1.f);
        else
            g.fillEllipse(x - r, y - r, 2 * r, 2 * r);
    }
    // le pied : la legende
    juce::String legend;
    if (spread_) legend << "L / R";
    if (folded_) legend << (legend.isEmpty() ? "" : "   ") << "O FOLDED BELOW 0 HZ";
    text(g, legend, {inner.getX() + 8, inner.getBottom() - 13, inner.getWidth() / 2, 9}, font(5.5f, Weight::Bold, 0.12f), kSilkDim, juce::Justification::centredLeft);
    text(g, foot_, {inner.getCentreX() - 30, inner.getBottom() - 13, inner.getWidth() / 2 + 22, 9}, font(5.5f, Weight::Bold, 0.12f), kSilkDim, juce::Justification::centredRight);
}

/* ------------------------------------------------------------------ la fenetre des presets ------------------------------------------------------------------ */

void PresetWindow::set(int match, int lastLoaded) {
    if (match == match_ && lastLoaded == last_) return;
    match_ = match;
    last_ = lastLoaded;
    repaint();
}

void PresetWindow::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto b = getLocalBounds().toFloat();
    const auto& glass = glass_.get(b.getWidth(), b.getHeight(), phys, [&](juce::Graphics& gg) { paintGlass(gg, b.reduced(3), 4); });
    g.setOpacity(1.f);
    g.drawImage(glass, b);
    const auto in = b.reduced(3).reduced(12, 6);
    const auto& bank = mmhell::factory();
    const int n = static_cast<int>(bank.size());
    const bool known = match_ >= 0 && match_ < n;
    const juce::String num = known ? juce::String(match_ + 1).paddedLeft('0', 2) + " / " + juce::String(n) + "   " + juce::String(bank[static_cast<size_t>(match_)].bank)
                                   : "-- / " + juce::String(n);
    const juce::String name = known ? juce::String(bank[static_cast<size_t>(match_)].name) : "YOUR SETTING";
    const juce::String desc = known ? juce::String(bank[static_cast<size_t>(match_)].desc)
                                    : (last_ >= 0 && last_ < n ? "Edited from " + juce::String(bank[static_cast<size_t>(last_)].name) + ". A preset sets everything but MIX."
                                                               : "A preset sets every HELL control except MIX.");
    text(g, num, {in.getX(), in.getY(), in.getWidth() - 16, 9}, font(6.5f, Weight::Semibold, 0.24f), kSilk.withAlpha(0.5f), juce::Justification::centredLeft);
    // le nom a l'accent, avec son halo
    const auto nf = font(13.5f, Weight::Bold, 0.06f);
    const juce::Rectangle<float> nr(in.getX(), in.getY() + 9, in.getWidth() - 16, 17);
    text(g, name, nr.translated(0, 0.5f), nf, accent().withAlpha(0.25f), juce::Justification::centredLeft);
    text(g, name, nr, nf, accent(), juce::Justification::centredLeft);
    text(g, desc, {in.getX(), in.getY() + 27, in.getWidth() - 16, 10}, font(7.f, Weight::Medium, 0.03f), kSilk.withAlpha(0.6f), juce::Justification::centredLeft);
    // le chevron : la banque se deroule
    juce::Path tri;
    const float cx = in.getRight() - 4, cy = in.getCentreY();
    tri.addTriangle(cx - 4, cy - 2, cx + 4, cy - 2, cx, cy + 3);
    g.setColour(isMouseOver() ? accent() : kSilkDim);
    g.fillPath(tri);
}

void PresetWindow::mouseDown(const juce::MouseEvent&) {
    // la banque : une section par categorie ; THE CLASSICS et MORE HELL (ceux du MM-ARP) en premiere colonne, puis deux
    // categories par colonne
    const auto& bank = mmhell::factory();
    juce::PopupMenu m;
    juce::String cur;
    int inColumn = 0;
    for (size_t i = 0; i < bank.size(); ++i) {
        const juce::String b(bank[i].bank);
        if (b != cur) {
            const bool newColumn = !cur.isEmpty() && (b == "SPACE & DUB" || inColumn >= 2);
            if (newColumn) {
                m.addColumnBreak();
                inColumn = 0;
            }
            m.addSectionHeader(b);
            cur = b;
            ++inColumn;
        }
        m.addItem(static_cast<int>(i) + 1, juce::String(static_cast<int>(i) + 1).paddedLeft('0', 2) + "  " + juce::String(bank[i].name), true, static_cast<int>(i) == match_);
    }
    juce::Component::SafePointer<PresetWindow> safe(this);
    m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(this), [safe](int r) {
        if (safe && r > 0 && safe->onLoad) safe->onLoad(r - 1);
    });
}

/* ------------------------------------------------------------------ les menus ------------------------------------------------------------------ */

MenuLook::MenuLook() {
    setColour(juce::PopupMenu::backgroundColourId, juce::Colour(0xff0a0908));
    setColour(juce::PopupMenu::textColourId, kSilk);
    setColour(juce::PopupMenu::highlightedBackgroundColourId, accent().withAlpha(0.18f));
    setColour(juce::PopupMenu::highlightedTextColourId, juce::Colour(0xfffff4ea));
}

void MenuLook::drawPopupMenuBackground(juce::Graphics& g, int width, int height) {
    g.fillAll(juce::Colour(0xff0a0908));
    g.setColour(juce::Colours::white.withAlpha(0.1f));
    g.drawRect(0, 0, width, height, 1);
}

void MenuLook::drawPopupMenuItem(juce::Graphics& g, const juce::Rectangle<int>& area, bool isSeparator, bool isActive, bool isHighlighted, bool isTicked,
                                 bool hasSubMenu, const juce::String& t, const juce::String&, const juce::Drawable*, const juce::Colour*) {
    if (isSeparator) {
        g.setColour(kSilk.withAlpha(0.12f));
        g.fillRect(area.toFloat().reduced(10, 0).withSizeKeepingCentre(area.getWidth() - 20.f, 1.f));
        return;
    }
    auto r = area.toFloat().reduced(4, 1);
    if ((isHighlighted && isActive) || isTicked) {
        g.setColour(accent().withAlpha(isHighlighted ? 0.22f : 0.12f));
        g.fillRoundedRectangle(r, 2);
    }
    const auto f = font(8.5f, Weight::Semibold, 0.06f);
    const juce::Colour main = !isActive ? kSilk.withAlpha(0.35f) : isTicked ? accent() : isHighlighted ? juce::Colour(0xfffff4ea) : kSilk.withAlpha(0.85f);
    // un preset : "07  NOM" (le numero en retrait) ; sinon le texte seul
    if (t.length() > 4 && t.substring(2, 4) == "  " && t.substring(0, 2).containsOnly("0123456789")) {
        text(g, t.substring(0, 2), r.withWidth(22).translated(6, 0), f, kSilk.withAlpha(0.4f), juce::Justification::centredLeft);
        text(g, t.substring(4), r.withTrimmedLeft(30), f, main, juce::Justification::centredLeft);
    } else {
        text(g, t, r.withTrimmedLeft(10), f, main, juce::Justification::centredLeft);
    }
    if (hasSubMenu) {
        juce::Path tri;
        const float x = r.getRight() - 8, y = r.getCentreY();
        tri.addTriangle(x - 2.5f, y - 3.5f, x - 2.5f, y + 3.5f, x + 2.5f, y);
        g.setColour(main);
        g.fillPath(tri);
    }
}

void MenuLook::drawPopupMenuSectionHeader(juce::Graphics& g, const juce::Rectangle<int>& area, const juce::String& sectionName) {
    text(g, sectionName, area.toFloat().reduced(10, 0), font(7.f, Weight::Bold, 0.24f), kSilkDim, juce::Justification::bottomLeft);
}

juce::Font MenuLook::getPopupMenuFont() { return font(9.f, Weight::Semibold, 0.06f); }

void MenuLook::getIdealPopupMenuItemSize(const juce::String& t, bool isSeparator, int, int& idealWidth, int& idealHeight) {
    idealHeight = isSeparator ? 6 : 20;
    idealWidth = 60 + juce::roundToInt(juce::GlyphArrangement::getStringWidth(font(8.5f, Weight::Semibold, 0.06f), t));
}

/* ------------------------------------------------------------------ le panneau SETTINGS ------------------------------------------------------------------ */

namespace {
constexpr float kPadX = 14, kTop = 11;
constexpr float kRowY0 = kTop + 12 + 4; // sous le titre
constexpr float kRowH = 6 + 10 + 26;    // padding, label, fader (face.css .mm-look-row)
const char* const kLookLabels[3] = {"LEATHER TEXTURE", "PANEL LIGHT", "ACCENT COLOR"};
} // namespace

SettingsPanel::SettingsPanel() {
    setSize(kW, kH);
    look_->addChangeListener(this);
}

SettingsPanel::~SettingsPanel() { look_->removeChangeListener(this); }

juce::Rectangle<float> SettingsPanel::rail(int i) const {
    // la colonne du fader (1fr), 6 de marge de chaque cote ; la valeur dans 26 a droite, 10 d'ecart
    const float x0 = kPadX + 6, x1 = static_cast<float>(kW) - kPadX - 26 - 10 - 6;
    const float y = kRowY0 + i * kRowH + 6 + 10;
    return {x0, y, x1 - x0, 26};
}

float SettingsPanel::get(int i) const {
    const auto st = look_->state();
    return i == 0 ? st.leather : i == 1 ? st.light : static_cast<float>(st.hue) / 360.f;
}

void SettingsPanel::put(int i, float v) {
    auto st = look_->state();
    v = juce::jlimit(0.f, 1.f, v);
    if (i == 0) st.leather = v;
    else if (i == 1) st.light = v;
    else st.hue = juce::roundToInt(v * 360.f) % 360;
    look_->set(st);
}

int SettingsPanel::rowAt(juce::Point<float> p) const {
    for (int i = 0; i < 3; ++i)
        if (rail(i).expanded(6, 2).contains(p)) return i;
    return -1;
}

void SettingsPanel::paint(juce::Graphics& g) {
    const auto b = getLocalBounds().toFloat();
    // le verre fume (face.css .mm-look) : plus opaque qu'en CSS, sans flou d'arriere-plan
    {
        juce::ColourGradient bg(juce::Colour::fromFloatRGBA(30 / 255.f, 28 / 255.f, 27 / 255.f, 0.995f), 0, 0,
                                juce::Colour::fromFloatRGBA(14 / 255.f, 13 / 255.f, 12 / 255.f, 0.995f), 0, b.getHeight(), false);
        g.setGradientFill(bg);
        g.fillRoundedRectangle(b, 6);
        g.setColour(juce::Colours::white.withAlpha(0.08f));
        g.drawRoundedRectangle(b.reduced(0.5f), 6, 1);
        g.setColour(juce::Colours::white.withAlpha(0.06f));
        g.drawHorizontalLine(1, 6, b.getWidth() - 6);
    }
    const juce::Colour ink = juce::Colour::fromFloatRGBA(240 / 255.f, 234 / 255.f, 224 / 255.f, 0.86f);
    text(g, "SETTINGS", {kPadX, kTop, 120, 12}, font(9.f, Weight::Bold, 0.24f), ink, juce::Justification::centredLeft);
    text(g, "RESET", resetArea(), font(7.f, Weight::Semibold, 0.18f), kSilk.withAlpha(resetHot_ ? 0.9f : 0.45f), juce::Justification::centredRight);
    for (int i = 0; i < 3; ++i) {
        const float y = kRowY0 + i * kRowH;
        text(g, kLookLabels[i], {kPadX, y + 6, 200, 10}, font(7.5f, Weight::Semibold, 0.2f), kSilk.withAlpha(0.6f), juce::Justification::centredLeft);
        const auto r = rail(i);
        const float v = get(i);
        if (i == 2) {
            // la roue des teintes vives, plus epaisse
            const juce::Rectangle<float> rr(r.getX(), r.getY() + 10, r.getWidth(), 6);
            juce::ColourGradient hg(hueColour(0), rr.getX(), 0, hueColour(360), rr.getRight(), 0, false);
            for (int h = 30; h < 360; h += 30) hg.addColour(h / 360.0, hueColour(static_cast<float>(h)));
            g.setColour(juce::Colours::black.withAlpha(0.75f));
            g.fillRoundedRectangle(rr.expanded(1), 4);
            g.setGradientFill(hg);
            g.fillRoundedRectangle(rr, 3);
        } else {
            const juce::Rectangle<float> rr(r.getX(), r.getY() + 12, r.getWidth(), 2);
            g.setColour(juce::Colour(0xff050505));
            g.fillRoundedRectangle(rr, 1);
            g.setColour(juce::Colours::white.withAlpha(0.07f));
            g.drawHorizontalLine(juce::roundToInt(rr.getBottom()), rr.getX(), rr.getRight());
            g.setColour(kSilk.withAlpha(0.35f / 0.84f * 0.84f));
            g.fillRoundedRectangle(rr.withWidth(rr.getWidth() * v), 1);
        }
        // la tete : un capuchon noir, une ligne claire au milieu
        {
            const juce::Rectangle<float> hd(r.getX() + r.getWidth() * v - 5.5f, r.getY() + 3, 11, 20);
            juce::DropShadow(juce::Colours::black.withAlpha(0.7f), 4, {0, 2}).drawForRectangle(g, hd.toNearestInt());
            juce::ColourGradient cg(juce::Colour(0xff2c2a28), 0, hd.getY(), juce::Colour(0xff0c0b0a), 0, hd.getBottom(), false);
            cg.addColour(0.55, juce::Colour(0xff161514));
            g.setGradientFill(cg);
            g.fillRoundedRectangle(hd, 2);
            g.setColour(juce::Colours::black.withAlpha(0.7f));
            g.drawRoundedRectangle(hd.expanded(0.5f), 2.5f, 1);
            g.setColour(juce::Colours::white.withAlpha(0.14f));
            g.drawHorizontalLine(juce::roundToInt(hd.getY() + 1), hd.getX() + 1, hd.getRight() - 1);
            g.setColour(juce::Colour(0xffece6dc));
            g.fillRect(hd.getX() + 4.5f, hd.getY() + 2, 2.f, hd.getHeight() - 4);
        }
        // la valeur (0 a 100), ou la pastille de la couleur
        const juce::Rectangle<float> vr(static_cast<float>(kW) - kPadX - 26, r.getY(), 26, 26);
        if (i == 2) {
            const juce::Rectangle<float> sw(vr.getRight() - 14, vr.getCentreY() - 7, 14, 14);
            const auto a = accent();
            for (int k = 3; k >= 1; --k) {
                g.setColour(a.withAlpha(0.1f * (4 - k)));
                g.fillRoundedRectangle(sw.expanded(k * 1.5f), 3 + k * 1.5f);
            }
            g.setColour(juce::Colours::black.withAlpha(0.8f));
            g.fillRoundedRectangle(sw.expanded(1), 4);
            g.setColour(a);
            g.fillRoundedRectangle(sw, 3);
            g.setColour(juce::Colours::white.withAlpha(0.35f));
            g.drawHorizontalLine(juce::roundToInt(sw.getY() + 1), sw.getX() + 2, sw.getRight() - 2);
        } else {
            text(g, juce::String(juce::roundToInt(v * 100)), vr, font(10.f, Weight::Semibold, 0.04f), kSilk.withAlpha(0.9f / 0.84f * 0.84f), juce::Justification::centredRight);
        }
    }
}

void SettingsPanel::mouseDown(const juce::MouseEvent& e) {
    if (resetArea().contains(e.position)) {
        look_->reset();
        return;
    }
    drag_ = rowAt(e.position);
    if (drag_ >= 0) put(drag_, (e.position.x - rail(drag_).getX()) / rail(drag_).getWidth());
}

void SettingsPanel::mouseDrag(const juce::MouseEvent& e) {
    if (drag_ >= 0) put(drag_, (e.position.x - rail(drag_).getX()) / rail(drag_).getWidth());
}

void SettingsPanel::mouseUp(const juce::MouseEvent&) { drag_ = -1; }

void SettingsPanel::mouseMove(const juce::MouseEvent& e) {
    const bool hot = resetArea().contains(e.position);
    if (hot != resetHot_) {
        resetHot_ = hot;
        repaint();
    }
    setMouseCursor(hot ? juce::MouseCursor::PointingHandCursor : rowAt(e.position) >= 0 ? juce::MouseCursor::LeftRightResizeCursor : juce::MouseCursor::NormalCursor);
}

void SettingsPanel::mouseExit(const juce::MouseEvent&) {
    if (resetHot_) {
        resetHot_ = false;
        repaint();
    }
}

void SettingsPanel::mouseDoubleClick(const juce::MouseEvent& e) {
    const int i = rowAt(e.position);
    if (i < 0) return;
    const Look::State d;
    put(i, i == 0 ? d.leather : i == 1 ? d.light : static_cast<float>(d.hue) / 360.f);
}

void SettingsPanel::mouseWheelMove(const juce::MouseEvent& e, const juce::MouseWheelDetails& w) {
    const int i = rowAt(e.position);
    if (i < 0 || std::fabs(w.deltaY) < 1e-6f) return;
    put(i, get(i) + (w.deltaY > 0 ? 0.02f : -0.02f) * (i == 2 ? 0.5f : 1.f));
}

} // namespace hl
