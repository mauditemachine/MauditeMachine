#include "RageViews.h"

#include <algorithm>
#include <complex>
#include <cstdint>

namespace rl {

namespace {

using D = mmarp::Decap;
using cplx = std::complex<double>;

constexpr double kFLo = 20, kFHi = 20000;

// La caisse (BOX) de Decap.cpp, pour l'ecran seulement : passe-haut, passe-bas, deux cloches (Hz, dB, Q), la resonance
struct BoxDef {
    double hp, lp, p1, p1Db, p1Q, p2, p2Db, p2Q, ms, fb;
};
constexpr BoxDef kBox[5] = {
    {0, 0, 0, 0, 1, 0, 0, 1, 1, 0},
    {160, 4200, 1800, 5, 1.2, 0, 0, 1, 1.1, 0.35},
    {90, 5200, 1200, 4, 0.9, 2600, -3, 2, 1.7, 0.3},
    {70, 4600, 110, 4, 1.0, 2200, 3, 1.2, 2.6, 0.3},
    {420, 3000, 1500, 6, 1.5, 0, 0, 1, 0.7, 0.45},
};

// Le filtre a variables d'etat du DSP, en analogique (l'ecran) : f, sa coupure, son Q, son mode (Decap::F_*)
cplx svf(int mode, double f, double fc, double q, double peakDb = 12) {
    const double w = f / fc;
    const cplx den(1 - w * w, w / q);
    switch (mode) {
        case D::F_LP: return 1.0 / den;
        case D::F_HP: return -w * w / den;
        case D::F_BP: return cplx(0, w / q) / den;
        case D::F_PEAK: return 1.0 + (std::pow(10.0, peakDb / 20) - 1) * (cplx(0, w / q) / den);
        default: return 1;
    }
}

double dbOf(cplx h) { return 20 * std::log10(std::max(1e-9, std::abs(h))); }

juce::String upper(const std::string& s) { return juce::String(s).toUpperCase(); }

void label(juce::Graphics& g, const juce::String& s, float x, float y, float w, juce::Justification j = juce::Justification::centredLeft) {
    text(g, s, {x, y, w, 9}, font(6.5f, Weight::Bold, 0.24f), kSilkDim, j);
}

} // namespace

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

/* ------------------------------------------------------------------ le VU ATTITUDE ------------------------------------------------------------------ */

float AttitudeVu::position(float db) {
    const float a = std::pow(10.f, -20.f / 20), b = std::pow(10.f, 3.f / 20);
    const float v = std::pow(10.f, juce::jlimit(-26.f, 4.f, db) / 20);
    return (v - a) / (b - a) * 2 - 1;
}

void AttitudeVu::tick(float db, float dt) {
    const float goal = position(std::isfinite(db) ? db : -120.f);
    dt = juce::jlimit(0.001f, 0.05f, dt);
    // un second ordre un peu amorti (~0.3 s), l'aiguille bute aux extremes (DistoPage.tsx AttitudeVu)
    const float w = 12.f;
    for (int i = 0; i < 4; ++i) {
        const float h = dt / 4;
        v_ += (w * w * (goal - x_) - 2 * 0.75f * w * v_) * h;
        x_ = juce::jlimit(-1.08f, 1.08f, x_ + v_ * h);
    }
    if (std::fabs(x_ - drawn_) > 0.002f) repaint();
}

void AttitudeVu::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const float k = getWidth() / 172.f;
    drawn_ = x_;
    const float px = 4 + 7 + 75, py = 4 + 2 + 112 - 22, R = 70;
    const auto& face = face_.get(static_cast<float>(getWidth()), static_cast<float>(getHeight()), phys, [&](juce::Graphics& fg) {
        fg.addTransform(juce::AffineTransform::scale(k));
        const juce::Rectangle<float> box(0, 0, 172, 120);
        juce::ColourGradient bg(juce::Colour(0xff1f1e1d), 0, 0, juce::Colour(0xff0b0a0a), 0, 120, false);
        fg.setGradientFill(bg);
        fg.fillRoundedRectangle(box, 12);
        fg.setColour(juce::Colours::white.withAlpha(0.1f));
        fg.drawRoundedRectangle(box.reduced(0.5f), 12, 1.f);
        const juce::Rectangle<float> fr(4, 4, 164, 112);
        juce::ColourGradient cg(juce::Colour(0xffefe5cb), 86, 116, juce::Colour(0xffcbbd9a), 86 + 164 * 0.62f, 116 - 112 * 0.9f, true);
        cg.addColour(0.55, juce::Colour(0xffe3d6b8));
        fg.setGradientFill(cg);
        fg.fillRoundedRectangle(fr, 8);
        juce::ColourGradient glow(juce::Colour::fromFloatRGBA(1.f, 0.78f, 0.47f, 0.2f), 86, 4 + 112 * 0.6f, juce::Colour::fromFloatRGBA(1.f, 0.78f, 0.47f, 0.f), 86 + 70, 4 + 112 * 0.6f, true);
        fg.setGradientFill(glow);
        fg.fillRoundedRectangle(fr, 8);
        const auto arc = [&](float v, float r) {
            const float t = juce::degreesToRadians(v * 42 - 90);
            return juce::Point<float>(px + std::cos(t) * r, py + std::sin(t) * r);
        };
        const auto arcPath = [&](float a, float b, float r) {
            juce::Path p;
            p.addCentredArc(px, py, r, r, 0, juce::degreesToRadians(a * 42), juce::degreesToRadians(b * 42), true);
            return p;
        };
        const juce::Colour ink(0xff1b1714), red(0xffb3241a);
        fg.setColour(ink);
        fg.strokePath(arcPath(-1, position(0), R), juce::PathStrokeType(1.1f));
        fg.setColour(red);
        fg.strokePath(arcPath(position(0), 1, R), juce::PathStrokeType(1.1f));
        fg.strokePath(arcPath(position(0), 1, R + 1.75f), juce::PathStrokeType(3.5f));
        for (float d : {-20.f, -15.f, -10.f, -7.f, -5.f, -4.f, -3.f, -2.f, -1.f, 0.f, 1.f, 2.f, 3.f}) {
            const bool big = d == -20 || d == -10 || d == -5 || d == -3 || d == 0 || d == 3;
            const auto a = arc(position(d), R), b = arc(position(d), R + (big ? 8.f : 5.f));
            fg.setColour(d > 0 ? red : ink);
            fg.drawLine(a.x, a.y, b.x, b.y, big ? 1.4f : 0.8f);
        }
        const auto tf = font(8.5f, Weight::Bold);
        for (float d : {-20.f, -10.f, -5.f, -3.f, 0.f, 3.f}) {
            const auto p = arc(position(d), R + 15);
            text(fg, d > 0 ? "+3" : juce::String(static_cast<int>(-d)), {p.x - 9, p.y - 6, 18, 12}, tf, d > 0 ? red : ink);
        }
        text(fg, "ATTITUDE", {px - 50, py - 26 - 8, 100, 13}, font(11.f, Weight::Bold, 0.22f), ink);
        text(fg, "MAUDITE MACHINE", {px - 40, py - 15 - 4, 80, 7}, font(4.5f, Weight::Semibold, 0.3f), ink.withAlpha(0.6f));
    });
    g.setOpacity(1.f);
    g.drawImage(face, getLocalBounds().toFloat());
    // l'aiguille et son pivot, la vitre
    g.addTransform(juce::AffineTransform::scale(k));
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

/* ------------------------------------------------------------------ TRANSFER ------------------------------------------------------------------ */

void TransferView::update(const mmrage::RagePatch& p) {
    if (valid_ && mmrage::same(p, last_)) return;
    valid_ = true;
    last_ = p;
    repaint();
}

void TransferView::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto b = getLocalBounds().toFloat();
    const auto& glass = glass_.get(b.getWidth(), b.getHeight(), phys, [&](juce::Graphics& gg) { paintGlass(gg, b.reduced(3), 4); });
    g.setOpacity(1.f);
    g.drawImage(glass, b);
    const auto in = b.reduced(3);
    const auto& p = last_;
    // la courbe : celle du DSP (Decap::curve), un sinus de crete 0.2 (le niveau de la prise) pousse par le DRIVE
    const juce::Rectangle<float> plot(in.getX() + 10, in.getY() + 17, in.getHeight() - 30, in.getHeight() - 30);
    label(g, "TRANSFER", in.getX() + 10, in.getY() + 5, 80);
    g.setColour(kSilk.withAlpha(0.1f));
    g.drawHorizontalLine(juce::roundToInt(plot.getCentreY()), plot.getX(), plot.getRight());
    g.drawVerticalLine(juce::roundToInt(plot.getCentreX()), plot.getY(), plot.getBottom());
    g.setColour(kSilk.withAlpha(0.06f));
    g.drawRect(plot, 1.f);
    const double db = D::driveDbOf(std::max(0.0, p.drive), p.punish);
    const double gIn = 0.2 * std::pow(10.0, db / 20);
    const double m = std::clamp(p.morph, 0.0, 1.0);
    const auto path = [&](const std::function<double(double)>& f) {
        double peak = 1e-6;
        for (int i = 0; i <= 120; ++i) peak = std::max(peak, std::fabs(f(-1 + i / 60.0)));
        juce::Path pth;
        for (int i = 0; i <= 120; ++i) {
            const double u = -1 + i / 60.0;
            const juce::Point<float> pt(plot.getCentreX() + static_cast<float>(u) * (plot.getWidth() / 2 - 2),
                                        plot.getCentreY() - static_cast<float>(f(u) / peak) * (plot.getHeight() / 2 - 2));
            if (i == 0)
                pth.startNewSubPath(pt);
            else
                pth.lineTo(pt);
        }
        return pth;
    };
    if (m > 0) {
        g.setColour(kSilk.withAlpha(0.28f));
        g.strokePath(path([&](double x) { return D::curve(p.morphTo, gIn * x); }), juce::PathStrokeType(1.f));
    }
    const auto main = path([&](double x) { return (1 - m) * D::curve(p.style, gIn * x) + m * D::curve(p.morphTo, gIn * x); });
    g.setColour(accent().withAlpha(0.25f));
    g.strokePath(main, juce::PathStrokeType(3.f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    g.setColour(accent());
    g.strokePath(main, juce::PathStrokeType(1.4f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    // la lecture
    const float x0 = plot.getRight() + 14, w = in.getRight() - x0 - 8;
    const juce::String st = mmrage::kStyleNames[std::clamp(p.style, 0, 11)];
    const juce::String to = mmrage::kStyleNames[std::clamp(p.morphTo, 0, 11)];
    const juce::String rows[5][2] = {
        {"STYLE", st == mmrage::kStyleLong[std::clamp(p.style, 0, 11)] ? st : st + "  " + mmrage::kStyleLong[std::clamp(p.style, 0, 11)]},
        {"MORPH", m > 0 ? juce::String::fromUTF8("\xE2\x86\x92 ") + to + "  " + juce::String(juce::roundToInt(m * 100)) + " %" : juce::String("-")},
        {"DRIVE", juce::String(mmrage::text::drive(p.drive, p.punish)) + (p.punish ? "  PUNISH" : "")},
        {"LEVEL", (p.autoGain ? juce::String("AUTO  ") : juce::String("MANUAL  ")) + juce::String(mmrage::text::outDb(p.out))},
        {"MIX", juce::String(mmrage::text::percent(p.mix)) + (p.bands > 1 ? "   " + juce::String(p.bands) + " BANDS" : juce::String())},
    };
    const float rh = (in.getHeight() - 20) / 5.f;
    for (int i = 0; i < 5; ++i) {
        const float y = in.getY() + 10 + i * rh;
        label(g, rows[i][0], x0, y + rh / 2 - 4.5f, 40);
        text(g, rows[i][1], {x0 + 40, y, w - 40, rh}, font(8.5f, Weight::Bold, 0.08f), accent(), juce::Justification::centredLeft);
    }
}

/* ------------------------------------------------------------------ la carte des bandes ------------------------------------------------------------------ */

BandMap::BandMap(juce::RangedAudioParameter& xLo, juce::RangedAudioParameter& xHi)
    : lo_(xLo), hi_(xHi), loAtt_(xLo, [this](float) { repaint(); }), hiAtt_(xHi, [this](float) { repaint(); }) {}

juce::Rectangle<float> BandMap::plot() const { return getLocalBounds().toFloat().reduced(3).reduced(10, 0).withTrimmedTop(20).withTrimmedBottom(18); }

float BandMap::xOf(double hz) const {
    const auto pl = plot();
    const double t = std::log(std::clamp(hz, kFLo, kFHi) / kFLo) / std::log(kFHi / kFLo);
    return pl.getX() + static_cast<float>(t) * pl.getWidth();
}

double BandMap::hzAt(float x) const {
    const auto pl = plot();
    const double t = std::clamp(static_cast<double>((x - pl.getX()) / pl.getWidth()), 0.0, 1.0);
    return kFLo * std::pow(kFHi / kFLo, t);
}

void BandMap::update(const mmrage::RagePatch& p) {
    if (mmrage::same(p, p_)) return;
    p_ = p;
    repaint();
}

int BandMap::handleAt(juce::Point<float> pt) const {
    if (p_.bands < 2) return -1;
    const float a = xOf(D::xLoHzOf(p_.xLo)), b = xOf(D::xHiHzOf(p_.xHi));
    if (p_.bands >= 3 && std::fabs(pt.x - b) < 7) return 1;
    if (std::fabs(pt.x - a) < 7) return 0;
    return -1;
}

void BandMap::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto bnd = getLocalBounds().toFloat();
    const auto& glass = glass_.get(bnd.getWidth(), bnd.getHeight(), phys, [&](juce::Graphics& gg) { paintGlass(gg, bnd.reduced(3), 4); });
    g.setOpacity(1.f);
    g.drawImage(glass, bnd);
    const auto pl = plot();
    const auto& p = p_;
    const double xl = D::xLoHzOf(p.xLo), xh = D::xHiHzOf(p.xHi);
    label(g, "BANDS", pl.getX(), bnd.getY() + 8, 60);
    // la grille : 100 Hz, 1 kHz, 10 kHz
    const auto gf = font(5.5f, Weight::Semibold, 0.06f);
    for (double f : {100.0, 1000.0, 10000.0}) {
        g.setColour(kSilk.withAlpha(0.07f));
        g.drawVerticalLine(juce::roundToInt(xOf(f)), pl.getY(), pl.getBottom());
        text(g, f >= 1000 ? juce::String(static_cast<int>(f / 1000)) + "K" : "100", {xOf(f) - 12, pl.getBottom() + 3, 24, 8}, gf, kSilkFaint);
    }
    // les bandes
    const int nb = std::clamp(p.bands, 1, 3);
    static const char* const names3[3] = {"LOW", "MID", "HIGH"};
    static const char* const names2[2] = {"LOW", "HIGH"};
    bool anySolo = false;
    for (int b = 0; b < nb && nb > 1; ++b) anySolo = anySolo || p.band[static_cast<size_t>(b)].solo;
    for (int b = 0; b < nb; ++b) {
        const double f0 = b == 0 ? kFLo : b == 1 ? xl : xh;
        const double f1 = nb == 1 ? kFHi : b == 0 ? xl : (b == 1 && nb == 3) ? xh : kFHi;
        const juce::Rectangle<float> r(xOf(f0), pl.getY(), xOf(f1) - xOf(f0), pl.getHeight());
        const auto& bd = p.band[static_cast<size_t>(b)];
        const bool byp = nb > 1 && bd.bypass, muted = anySolo && !bd.solo;
        const float lvl = nb > 1 ? static_cast<float>(std::clamp(0.5 + (D::bandDbOf(bd.drive)) / 36.0, 0.05, 1.0)) : 0.5f;
        // le DRIVE de la bande : la hauteur du bloc
        const float hh = r.getHeight() * (0.25f + 0.65f * lvl);
        const auto blk = r.withTop(r.getBottom() - hh).reduced(1.5f, 0);
        g.setColour(accent().withAlpha(muted ? 0.04f : byp ? 0.06f : 0.16f + 0.1f * lvl));
        g.fillRect(blk);
        g.setColour(accent().withAlpha(muted ? 0.15f : byp ? 0.25f : 0.8f));
        g.drawHorizontalLine(juce::roundToInt(blk.getY()), blk.getX(), blk.getRight());
        const juce::String nm = nb == 1 ? juce::String("FULL BAND") : juce::String(nb == 2 ? names2[b] : names3[b]);
        const int st = nb > 1 ? bd.style : -1;
        const juce::String sty = byp ? juce::String("BYPASS") : st < 0 ? juce::String(mmrage::kStyleNames[std::clamp(p.style, 0, 11)]) : juce::String(mmrage::kStyleNames[st]);
        const auto tr = r.withHeight(22).translated(0, 4);
        text(g, nm, tr.withHeight(10), font(7.f, Weight::Bold, 0.2f), muted ? kSilkFaint : kSilk);
        text(g, sty + (nb > 1 && bd.solo ? "  SOLO" : ""), tr.withTrimmedTop(11), font(7.f, Weight::Bold, 0.08f), muted ? kSilkFaint : accent());
    }
    // les coupures, a tirer
    for (int k = 0; k < nb - 1; ++k) {
        const float x = xOf(k == 0 ? xl : xh);
        const bool hot = k == hot_ || k == drag_;
        g.setColour(hot ? kSilk : kSilk.withAlpha(0.55f));
        g.fillRect(x - 0.5f, pl.getY(), 1.f, pl.getHeight());
        g.setColour(hot ? accent() : kSilk.withAlpha(0.8f));
        g.fillRoundedRectangle(x - 3, pl.getCentreY() - 8, 6, 16, 2);
        text(g, mmrage::text::hz(k == 0 ? xl : xh), {x - 26, pl.getY() - 11, 52, 9}, font(6.5f, Weight::Bold, 0.06f), hot ? accent() : kSilkDim);
    }
}

void BandMap::mouseMove(const juce::MouseEvent& e) {
    const int h = handleAt(e.position);
    setMouseCursor(h >= 0 ? juce::MouseCursor::LeftRightResizeCursor : juce::MouseCursor::NormalCursor);
    if (h != hot_) {
        hot_ = h;
        repaint();
    }
}

void BandMap::mouseDown(const juce::MouseEvent& e) {
    drag_ = handleAt(e.position);
    if (drag_ == 0) loAtt_.beginGesture();
    if (drag_ == 1) hiAtt_.beginGesture();
}

void BandMap::mouseDrag(const juce::MouseEvent& e) {
    if (drag_ < 0) return;
    const double hz = hzAt(e.position.x);
    if (drag_ == 0) {
        const double v = std::clamp(std::log(hz / 40) / std::log(25.0), 0.0, 1.0);
        loAtt_.setValueAsPartOfGesture(static_cast<float>(v));
    } else {
        const double v = std::clamp(std::log(hz / 600) / std::log(25.0), 0.0, 1.0);
        hiAtt_.setValueAsPartOfGesture(static_cast<float>(v));
    }
}

void BandMap::mouseUp(const juce::MouseEvent&) {
    if (drag_ == 0) loAtt_.endGesture();
    if (drag_ == 1) hiAtt_.endGesture();
    drag_ = -1;
    repaint();
}

void BandMap::mouseExit(const juce::MouseEvent&) {
    hot_ = -1;
    repaint();
}

/* ------------------------------------------------------------------ la reponse ------------------------------------------------------------------ */

void ResponseView::update(const mmrage::RagePatch& p) {
    if (valid_ && mmrage::same(p, last_)) return;
    valid_ = true;
    last_ = p;
    repaint();
}

void ResponseView::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto b = getLocalBounds().toFloat();
    const auto& glass = glass_.get(b.getWidth(), b.getHeight(), phys, [&](juce::Graphics& gg) { paintGlass(gg, b.reduced(3), 4); });
    g.setOpacity(1.f);
    g.drawImage(glass, b);
    const auto in = b.reduced(3);
    const juce::Rectangle<float> pl(in.getX() + 22, in.getY() + 18, in.getWidth() - 30, in.getHeight() - 34);
    label(g, "RESPONSE", in.getX() + 8, in.getY() + 5, 80);
    const double dbLo = -24, dbHi = 18;
    const auto xOf = [&](double f) { return pl.getX() + static_cast<float>(std::log(f / kFLo) / std::log(kFHi / kFLo)) * pl.getWidth(); };
    const auto yOf = [&](double d) { return pl.getBottom() - static_cast<float>((std::clamp(d, dbLo, dbHi) - dbLo) / (dbHi - dbLo)) * pl.getHeight(); };
    const auto gf = font(5.5f, Weight::Semibold, 0.06f);
    for (double f : {100.0, 1000.0, 10000.0}) {
        g.setColour(kSilk.withAlpha(0.07f));
        g.drawVerticalLine(juce::roundToInt(xOf(f)), pl.getY(), pl.getBottom());
        text(g, f >= 1000 ? juce::String(static_cast<int>(f / 1000)) + "K" : "100", {xOf(f) - 12, pl.getBottom() + 3, 24, 8}, gf, kSilkFaint);
    }
    for (double d : {-12.0, 0.0, 12.0}) {
        g.setColour(kSilk.withAlpha(d == 0 ? 0.16f : 0.07f));
        g.drawHorizontalLine(juce::roundToInt(yOf(d)), pl.getX(), pl.getRight());
        text(g, d == 0 ? "0" : (d > 0 ? "+12" : "-12"), {in.getX() + 2, yOf(d) - 4, 18, 8}, gf, kSilkFaint, juce::Justification::centredRight);
    }
    const auto& p = last_;
    const auto curve = [&](const std::function<cplx(double)>& h) {
        juce::Path pth;
        for (int i = 0; i <= 160; ++i) {
            const double f = kFLo * std::pow(kFHi / kFLo, i / 160.0);
            const juce::Point<float> pt(xOf(f), yOf(dbOf(h(f))));
            if (i == 0)
                pth.startNewSubPath(pt);
            else
                pth.lineTo(pt);
        }
        return pth;
    };
    std::vector<std::pair<juce::String, juce::Colour>> legend;
    const auto draw = [&](const juce::Path& pth, juce::Colour c, float w) {
        g.setColour(c.withAlpha(c.getFloatAlpha() * 0.25f));
        g.strokePath(pth, juce::PathStrokeType(w + 2));
        g.setColour(c);
        g.strokePath(pth, juce::PathStrokeType(w));
    };
    if (p.box != 0) {
        const BoxDef& bx = kBox[std::clamp(p.box, 1, 4)];
        const double sc = D::boxScaleOf(p.boxSize), mx = std::clamp(p.boxMix, 0.0, 1.0);
        draw(curve([&](double f) {
                 cplx h = svf(D::F_HP, f, bx.hp / sc, 0.7071) * svf(D::F_LP, f, bx.lp / sc, 0.7071);
                 if (bx.p1 > 0) h *= svf(D::F_PEAK, f, bx.p1 / sc, bx.p1Q, bx.p1Db);
                 if (bx.p2 > 0) h *= svf(D::F_PEAK, f, bx.p2 / sc, bx.p2Q, bx.p2Db);
                 return (1 - mx) + mx * h;
             }),
             kCream.withAlpha(0.75f), 1.f);
        legend.push_back({"BOX " + juce::String(mmrage::kBoxNames[p.box]), kCream});
    }
    if (p.preMode != 0) {
        draw(curve([&](double f) { return svf(p.preMode, f, D::filtHzOf(p.preFreq), D::resoQOf(p.preReso)); }), kSilk.withAlpha(0.6f), 1.f);
        legend.push_back({"PRE " + juce::String(mmrage::kFilterNames[p.preMode]), kSilk.withAlpha(0.7f)});
    }
    if (p.postMode != 0) {
        draw(curve([&](double f) { return svf(p.postMode, f, D::filtHzOf(p.postFreq), D::resoQOf(p.postReso)); }), accent(), 1.4f);
        legend.push_back({"POST " + juce::String(mmrage::kFilterNames[p.postMode]), accent()});
    }
    if (legend.empty()) {
        g.setColour(kSilk.withAlpha(0.35f));
        g.drawHorizontalLine(juce::roundToInt(yOf(0)), pl.getX(), pl.getRight());
        legend.push_back({"FLAT  -  NO FILTER, NO BOX", kSilkDim});
    }
    // la legende, chaque nom dans la couleur de sa courbe, alignee a droite
    const auto lf = font(6.5f, Weight::Bold, 0.1f);
    float x = in.getRight() - 8;
    for (auto it = legend.rbegin(); it != legend.rend(); ++it) {
        const float tw = juce::GlyphArrangement::getStringWidth(lf, it->first) + 2;
        text(g, it->first, {x - tw, in.getY() + 5, tw, 9}, lf, it->second, juce::Justification::centredRight);
        x -= tw + 12;
    }
}

/* ------------------------------------------------------------------ le mouvement ------------------------------------------------------------------ */

void MotionView::update(const mmrage::RagePatch& p, double bpm) {
    if (valid_ && mmrage::same(p, last_) && (!p.lfoSync || std::fabs(bpm - bpm_) < 0.01)) return;
    valid_ = true;
    last_ = p;
    bpm_ = bpm;
    repaint();
}

void MotionView::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto b = getLocalBounds().toFloat();
    const auto& glass = glass_.get(b.getWidth(), b.getHeight(), phys, [&](juce::Graphics& gg) { paintGlass(gg, b.reduced(3), 4); });
    g.setOpacity(1.f);
    g.drawImage(glass, b);
    const auto in = b.reduced(3);
    const auto& p = last_;
    const juce::Rectangle<float> pl(in.getX() + 10, in.getY() + 20, in.getWidth() - 20, in.getHeight() - 40);
    label(g, "LFO", in.getX() + 10, in.getY() + 5, 40);
    const double amt = (std::clamp(p.lfoAmt, 0.0, 1.0) - 0.5) * 2;
    const double hz = mmrage::lfoHz(p, bpm_ > 0 ? bpm_ : 120);
    // la fenetre : une mesure (4 temps au tempo de l'hote)
    const double span = 4 * 60 / std::max(20.0, bpm_ > 0 ? bpm_ : 120);
    for (int k = 0; k <= 4; ++k) {
        const float x = pl.getX() + pl.getWidth() * k / 4.f;
        g.setColour(kSilk.withAlpha(k == 0 || k == 4 ? 0.12f : 0.06f));
        g.drawVerticalLine(juce::roundToInt(x), pl.getY(), pl.getBottom());
    }
    g.setColour(kSilk.withAlpha(0.12f));
    g.drawHorizontalLine(juce::roundToInt(pl.getCentreY()), pl.getX(), pl.getRight());
    text(g, "1 BAR", {pl.getRight() - 40, pl.getBottom() + 3, 40, 8}, font(5.5f, Weight::Semibold, 0.06f), kSilkFaint, juce::Justification::centredRight);
    juce::Path w;
    const int n = 400;
    for (int i = 0; i <= n; ++i) {
        const double t = span * i / n;
        const double ph = std::fmod(t * hz, 1.0);
        double v;
        switch (std::clamp(p.lfoShape, 0, 4)) {
            case 1: v = 4 * std::fabs(ph - 0.5) - 1; break;
            case 2: v = 2 * ph - 1; break;
            case 3: v = ph < 0.5 ? 1 : -1; break;
            case 4: {
                const auto cyc = static_cast<uint32_t>(t * hz);
                uint32_t r = cyc * 2654435761u + 97u;
                r ^= r >> 13;
                r *= 0x5bd1e995u;
                r ^= r >> 15;
                v = (r & 0xffff) / 32767.5 - 1;
                break;
            }
            default: v = std::sin(2 * juce::MathConstants<double>::pi * ph); break;
        }
        const juce::Point<float> pt(pl.getX() + pl.getWidth() * i / static_cast<float>(n), pl.getCentreY() - static_cast<float>(v * amt) * (pl.getHeight() / 2 - 2));
        if (i == 0)
            w.startNewSubPath(pt);
        else
            w.lineTo(pt);
    }
    const bool on = std::fabs(amt) > 0.002;
    g.setColour(accent().withAlpha(on ? 0.25f : 0.08f));
    g.strokePath(w, juce::PathStrokeType(3.f));
    g.setColour(on ? accent() : kSilk.withAlpha(0.3f));
    g.strokePath(w, juce::PathStrokeType(1.3f));
    // l'en-tete : la vitesse ; le pied : ce que fait le LFO, et l'enveloppe
    const juce::String rate = p.lfoSync ? juce::String(mmrage::kLfoNoteNames[std::clamp(p.lfoNote, 0, mmrage::kLfoNotes - 1)]) + "  " + juce::String(hz, hz < 1 ? 2 : 1) + " HZ"
                                        : juce::String(mmrage::text::lfoRate(p.lfoRate));
    text(g, rate, {in.getX() + 60, in.getY() + 5, in.getWidth() - 70, 9}, font(6.5f, Weight::Bold, 0.08f), accent(), juce::Justification::centredRight);
    const double a = std::fabs(amt);
    juce::String foot;
    if (!on)
        foot = "AMOUNT AT 0: NO LFO";
    else {
        switch (std::clamp(p.lfoTarget, 0, 5)) {
            case 0: foot = "+/- " + juce::String(18 * a, 1) + " DB ON THE DRIVE"; break;
            case 1: foot = "+/- " + juce::String(juce::roundToInt(50 * a)) + " % OF MORPH"; break;
            case 2: foot = "+/- " + juce::String(juce::roundToInt(100 * a)) + " % OF TONE"; break;
            case 3: foot = "+/- " + juce::String(2 * a, 1) + " OCT ON THE PRE FILTER"; break;
            case 4: foot = "+/- " + juce::String(2 * a, 1) + " OCT ON THE POST FILTER"; break;
            default: foot = "+/- " + juce::String(juce::roundToInt(50 * a)) + " % OF MIX"; break;
        }
    }
    text(g, foot, {in.getX() + 10, in.getBottom() - 14, in.getWidth() - 20, 9}, font(6.5f, Weight::Bold, 0.12f), kSilkDim, juce::Justification::centredLeft);
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
    const auto& bank = mmrage::factory();
    const int n = static_cast<int>(bank.size());
    const bool known = match_ >= 0 && match_ < n;
    const juce::String num = known ? juce::String(match_ + 1).paddedLeft('0', 2) + " / " + juce::String(n) + "   " + upper(bank[static_cast<size_t>(match_)].bank)
                                   : "-- / " + juce::String(n);
    const juce::String name = known ? juce::String(bank[static_cast<size_t>(match_)].name) : "YOUR SETTING";
    const juce::String desc = known ? juce::String(bank[static_cast<size_t>(match_)].desc)
                                    : (last_ >= 0 && last_ < n ? "Edited from " + juce::String(bank[static_cast<size_t>(last_)].name) + ". A preset sets the whole RAGE."
                                                               : "A preset sets the whole RAGE, DRIVE and MIX included.");
    text(g, num, {in.getX(), in.getY(), in.getWidth() - 16, 9}, font(6.5f, Weight::Semibold, 0.24f), kSilk.withAlpha(0.5f), juce::Justification::centredLeft);
    const auto nf = font(13.5f, Weight::Bold, 0.06f);
    const juce::Rectangle<float> nr(in.getX(), in.getY() + 9, in.getWidth() - 16, 17);
    text(g, name, nr.translated(0, 0.5f), nf, accent().withAlpha(0.25f), juce::Justification::centredLeft);
    text(g, name, nr, nf, accent(), juce::Justification::centredLeft);
    text(g, desc, {in.getX(), in.getY() + 27, in.getWidth() - 16, 10}, font(7.f, Weight::Medium, 0.03f), kSilk.withAlpha(0.6f), juce::Justification::centredLeft);
    juce::Path tri;
    const float cx = in.getRight() - 4, cy = in.getCentreY();
    tri.addTriangle(cx - 4, cy - 2, cx + 4, cy - 2, cx, cy + 3);
    g.setColour(isMouseOver() ? accent() : kSilkDim);
    g.fillPath(tri);
}

void PresetWindow::mouseDown(const juce::MouseEvent&) {
    // la banque : une section par famille ; THE CLASSICS (INIT et les 20 du MM-ARP) en premiere colonne, puis deux familles
    // par colonne
    const auto& bank = mmrage::factory();
    juce::PopupMenu m;
    juce::String cur;
    int inColumn = 0;
    for (size_t i = 0; i < bank.size(); ++i) {
        const juce::String b(bank[i].bank);
        if (b != cur) {
            const bool newColumn = !cur.isEmpty() && (cur == "THE CLASSICS" || inColumn >= 2);
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
constexpr float kPadX = 14, kTopY = 11;
constexpr float kRowY0 = kTopY + 12 + 4;
constexpr float kRowH = 6 + 10 + 26;
const char* const kLookLabels[3] = {"LEATHER TEXTURE", "PANEL LIGHT", "ACCENT COLOR"};
} // namespace

SettingsPanel::SettingsPanel() {
    setSize(kW, kH);
    look_->addChangeListener(this);
}

SettingsPanel::~SettingsPanel() { look_->removeChangeListener(this); }

juce::Rectangle<float> SettingsPanel::rail(int i) const {
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
    if (i == 0)
        st.leather = v;
    else if (i == 1)
        st.light = v;
    else
        st.hue = juce::roundToInt(v * 360.f) % 360;
    look_->set(st);
}

int SettingsPanel::rowAt(juce::Point<float> p) const {
    for (int i = 0; i < 3; ++i)
        if (rail(i).expanded(6, 2).contains(p)) return i;
    return -1;
}

void SettingsPanel::paint(juce::Graphics& g) {
    const auto b = getLocalBounds().toFloat();
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
    text(g, "SETTINGS", {kPadX, kTopY, 120, 12}, font(9.f, Weight::Bold, 0.24f), ink, juce::Justification::centredLeft);
    text(g, "RESET", resetArea(), font(7.f, Weight::Semibold, 0.18f), kSilk.withAlpha(resetHot_ ? 0.9f : 0.45f), juce::Justification::centredRight);
    for (int i = 0; i < 3; ++i) {
        const float y = kRowY0 + i * kRowH;
        text(g, kLookLabels[i], {kPadX, y + 6, 200, 10}, font(7.5f, Weight::Semibold, 0.2f), kSilk.withAlpha(0.6f), juce::Justification::centredLeft);
        const auto r = rail(i);
        const float v = get(i);
        if (i == 2) {
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
            g.setColour(kSilk.withAlpha(0.35f));
            g.fillRoundedRectangle(rr.withWidth(rr.getWidth() * v), 1);
        }
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
            text(g, juce::String(juce::roundToInt(v * 100)), vr, font(10.f, Weight::Semibold, 0.04f), kSilk.withAlpha(0.9f), juce::Justification::centredRight);
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

} // namespace rl
