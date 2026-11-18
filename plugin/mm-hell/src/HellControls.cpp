#include "HellControls.h"

#include <cmath>

namespace hl {

namespace {

constexpr float kSweep = 135.f;
constexpr float kDragRange = 160.f; // points pour toute la course (la face du MM-ARP)

bool stepped(const juce::RangedAudioParameter& p) {
    const int n = p.getNumSteps();
    return n > 1 && n < 64;
}

/*
 * Le potard facon Moog, dessine en vectoriel (v1.2, Mika : "de l'aliasing sur les knobs, je veux des beaux knobs Moog qui
 * tournent bien avec des reflets") : plus d'image tournee (son bord crenelait), tout est trace a la resolution de l'ecran.
 * La lumiere vient d'en haut a gauche et ne bouge pas :
 *   - fixe (en cache) : l'ombre portee, la jupe noire mate et son arete ;
 *   - qui tourne : la prise cannelee (le contour festonne, chaque cannelure accroche la lumiere selon son orientation : les
 *     reflets defilent quand on tourne) et le repere blanc ;
 *   - fixe (en cache) : le capuchon d'alu brosse, ses reflets coniques, son biseau (un brossage concentrique ne tourne pas
 *     sous une lumiere fixe).
 */
constexpr float kLight = -0.78539816f; // en haut a gauche (0 en haut, sens horaire)

juce::Colour mix(juce::Colour a, juce::Colour b, float t) { return a.interpolatedWith(b, juce::jlimit(0.f, 1.f, t)); }

void paintKnobBase(juce::Graphics& b, juce::Point<float> o, float s) {
    const float R = s / 2;
    // l'ombre portee, douce, vers le bas a droite
    {
        const juce::Point<float> sc = o + juce::Point<float>(0.05f * s, 0.08f * s);
        juce::ColourGradient sg(juce::Colours::black.withAlpha(0.72f), sc.x, sc.y, juce::Colours::black.withAlpha(0.f), sc.x + R * 1.22f, sc.y, true);
        sg.addColour(0.74, juce::Colours::black.withAlpha(0.42f));
        b.setGradientFill(sg);
        b.fillEllipse(sc.x - R * 1.22f, sc.y - R * 1.22f, R * 2.44f, R * 2.44f);
    }
    // la jupe : noir mat, une nappe de lumiere en haut a gauche
    {
        const juce::Point<float> lc = o + juce::Point<float>(-0.36f * R, -0.42f * R);
        juce::ColourGradient jg(juce::Colour(0xff3b3835), lc.x, lc.y, juce::Colour(0xff060606), lc.x + 1.45f * R, lc.y, true);
        jg.addColour(0.5, juce::Colour(0xff171615));
        b.setGradientFill(jg);
        b.fillEllipse(o.x - R, o.y - R, 2 * R, 2 * R);
        // l'arete : claire en haut a gauche, perdue en bas a droite
        juce::ColourGradient eg(juce::Colours::white.withAlpha(0.32f), o.x - 0.7f * R, o.y - 0.7f * R, juce::Colours::black.withAlpha(0.5f), o.x + 0.7f * R,
                                o.y + 0.7f * R, false);
        b.setGradientFill(eg);
        b.drawEllipse(o.x - R + 0.6f, o.y - R + 0.6f, 2 * R - 1.2f, 2 * R - 1.2f, juce::jmax(0.7f, 0.022f * s));
        // la marche entre la jupe et la prise
        b.setColour(juce::Colours::black.withAlpha(0.6f));
        b.drawEllipse(o.x - 0.86f * R, o.y - 0.86f * R, 1.72f * R, 1.72f * R, juce::jmax(0.8f, 0.03f * s));
    }
}

void paintKnobCap(juce::Graphics& b, juce::Point<float> o, float rc) {
    // le dessous du biseau
    b.setColour(juce::Colour(0xff1c1c1d));
    b.fillEllipse(o.x - rc, o.y - rc, 2 * rc, 2 * rc);
    // l'alu brosse, calcule pixel par pixel a la resolution de l'ecran (les secteurs traces moiraient) : deux nappes de
    // reflet coniques opposees face a la lumiere, un brossage radial fin (un bruit selon l'angle), plus sombre vers le bord
    const float ri = rc * 0.92f;
    const float phys = b.getInternalContext().getPhysicalPixelScaleFactor();
    const int n = juce::jmax(4, juce::roundToInt(2 * ri * phys));
    juce::Image img(juce::Image::ARGB, n, n, true);
    {
        constexpr int kCells = 720;
        static float cells[kCells];
        static bool init = false;
        if (!init) {
            uint32_t seed = 0x5eed;
            for (auto& c : cells) {
                seed = seed * 1664525u + 1013904223u;
                c = (seed >> 9) / 8388608.f - 0.5f;
            }
            init = true;
        }
        const auto brushed = [](float t) {
            const float x = t / juce::MathConstants<float>::twoPi * kCells;
            const int i = static_cast<int>(std::floor(x));
            const float f = x - static_cast<float>(i);
            const float a = cells[((i % kCells) + kCells) % kCells], c = cells[(((i + 1) % kCells) + kCells) % kCells];
            return a + (c - a) * (f * f * (3 - 2 * f));
        };
        const juce::Colour dark(0xff47484b), light(0xfff7f7f5);
        juce::Image::BitmapData d(img, juce::Image::BitmapData::writeOnly);
        const float half = n / 2.f;
        for (int y = 0; y < n; ++y)
            for (int x = 0; x < n; ++x) {
                const float dx = (x + 0.5f - half) / phys, dy = (y + 0.5f - half) / phys;
                const float r = std::sqrt(dx * dx + dy * dy);
                const float cover = juce::jlimit(0.f, 1.f, (ri - r) * phys + 0.5f);
                if (cover <= 0) continue;
                const float t = std::atan2(dx, -dy);
                float f = 0.5f + 0.34f * std::cos(2 * (t - kLight)) + 0.06f * std::cos(6 * t + 1.3f) + 0.09f * brushed(t) + 0.04f * brushed(t * 3.7f + 1.f);
                f -= 0.1f * (r / ri) * (r / ri);
                d.setPixelColour(x, y, mix(dark, light, f).withAlpha(cover));
            }
    }
    b.setOpacity(1.f);
    b.drawImage(img, juce::Rectangle<float>(o.x - n / (2 * phys), o.y - n / (2 * phys), n / phys, n / phys));
    // le biseau : clair en haut a gauche, sombre en bas a droite ; le bord
    juce::ColourGradient bg(juce::Colours::white.withAlpha(0.65f), o.x - 0.7f * rc, o.y - 0.7f * rc, juce::Colours::black.withAlpha(0.7f), o.x + 0.7f * rc,
                            o.y + 0.7f * rc, false);
    b.setGradientFill(bg);
    b.drawEllipse(o.x - ri, o.y - ri, 2 * ri, 2 * ri, rc * 0.075f);
    b.setColour(juce::Colours::black.withAlpha(0.85f));
    b.drawEllipse(o.x - rc * 0.985f, o.y - rc * 0.985f, rc * 1.97f, rc * 1.97f, juce::jmax(0.6f, rc * 0.05f));
}

/** Le potard entier : le fond et le capuchon en cache, la prise et le repere traces a chaque fois. */
void paintMoogKnob(juce::Graphics& g, juce::Point<float> c, float s, float ang, Cached& base, Cached& cap, float phys) {
    const float R = s / 2;
    const float bw = s * 1.5f;
    const auto& bimg = base.get(bw, bw, phys, [&](juce::Graphics& b) { paintKnobBase(b, {bw / 2, bw / 2}, s); });
    g.setOpacity(1.f);
    g.drawImage(bimg, juce::Rectangle<float>(c.x - bw / 2, c.y - bw / 2, bw, bw));
    // la prise cannelee, qui tourne
    const int n = s >= 100 ? 40 : s >= 70 ? 34 : 28;
    const float rg = 0.82f * R, depth = 0.055f * R;
    juce::Path grip;
    const int pts = n * 8;
    for (int i = 0; i <= pts; ++i) {
        const float t = juce::MathConstants<float>::twoPi * i / pts;
        const float r = rg - depth * (0.5f - 0.5f * std::cos(n * (t - ang)));
        const juce::Point<float> p(c.x + std::sin(t) * r, c.y - std::cos(t) * r);
        if (i == 0) grip.startNewSubPath(p);
        else grip.lineTo(p);
    }
    grip.closeSubPath();
    {
        juce::ColourGradient gg(juce::Colour(0xff34312e), c.x - 0.6f * R, c.y - 0.6f * R, juce::Colour(0xff0b0a0a), c.x + 0.6f * R, c.y + 0.6f * R, false);
        g.setGradientFill(gg);
        g.fillPath(grip);
        g.setColour(juce::Colours::black.withAlpha(0.85f));
        g.strokePath(grip, juce::PathStrokeType(juce::jmax(0.6f, 0.018f * s)));
    }
    // les cannelures : chaque arete s'eclaire selon son orientation face a la lumiere
    const float lw = juce::jmax(0.55f, 0.022f * s);
    for (int i = 0; i < n; ++i) {
        const float t = ang + juce::MathConstants<float>::twoPi * i / n;
        const float lit = std::cos(t - kLight);
        const float r0 = 0.66f * R, r1 = rg - 0.004f * R;
        if (lit > 0) {
            g.setColour(juce::Colours::white.withAlpha(0.5f * std::pow(lit, 2.2f)));
            g.drawLine(c.x + std::sin(t) * r0, c.y - std::cos(t) * r0, c.x + std::sin(t) * r1, c.y - std::cos(t) * r1, lw);
        }
        const float tv = t + juce::MathConstants<float>::pi / n; // le creux
        g.setColour(juce::Colours::black.withAlpha(0.35f + 0.3f * std::pow(juce::jmax(0.f, -std::cos(tv - kLight)), 1.5f)));
        g.drawLine(c.x + std::sin(tv) * r0, c.y - std::cos(tv) * r0, c.x + std::sin(tv) * (rg - depth), c.y - std::cos(tv) * (rg - depth), lw * 1.2f);
    }
    // le dessus de la prise : un plateau noir satine, un reflet doux en haut a gauche
    {
        const float rt = 0.66f * R;
        juce::ColourGradient tg(juce::Colour(0xff2f2c2a), c.x - 0.5f * rt, c.y - 0.5f * rt, juce::Colour(0xff0f0e0d), c.x + 0.7f * rt, c.y + 0.7f * rt, false);
        g.setGradientFill(tg);
        g.fillEllipse(c.x - rt, c.y - rt, 2 * rt, 2 * rt);
        g.setColour(juce::Colours::black.withAlpha(0.6f));
        g.drawEllipse(c.x - rt, c.y - rt, 2 * rt, 2 * rt, juce::jmax(0.5f, 0.012f * s));
        const juce::Point<float> sp(c.x + std::sin(kLight) * 0.5f * rt, c.y - std::cos(kLight) * 0.5f * rt);
        juce::ColourGradient sg(juce::Colours::white.withAlpha(0.13f), sp.x, sp.y, juce::Colours::white.withAlpha(0.f), sp.x + 0.55f * rt, sp.y, true);
        g.setGradientFill(sg);
        g.fillEllipse(c.x - rt, c.y - rt, 2 * rt, 2 * rt);
    }
    // le repere blanc, qui tourne, et son ombre
    {
        const float rc = 0.46f * R, a0 = rc * 1.08f, a1 = 0.76f * R, w = juce::jmax(1.2f, 0.09f * R);
        const juce::Point<float> p0(c.x + std::sin(ang) * a0, c.y - std::cos(ang) * a0), p1(c.x + std::sin(ang) * a1, c.y - std::cos(ang) * a1);
        const juce::Point<float> so(0.035f * R, 0.05f * R);
        juce::Path m;
        m.startNewSubPath(p0);
        m.lineTo(p1);
        g.setColour(juce::Colours::black.withAlpha(0.5f));
        g.strokePath(m, juce::PathStrokeType(w * 1.15f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded), juce::AffineTransform::translation(so));
        g.setColour(juce::Colour(0xfff4f0e8));
        g.strokePath(m, juce::PathStrokeType(w, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    }
    // le capuchon d'alu, fixe
    {
        const float rc = 0.46f * R, cw = rc * 2 + 2;
        const auto& cimg = cap.get(cw, cw, phys, [&](juce::Graphics& b) { paintKnobCap(b, {cw / 2, cw / 2}, rc); });
        g.setOpacity(1.f);
        g.drawImage(cimg, juce::Rectangle<float>(c.x - cw / 2, c.y - cw / 2, cw, cw));
    }
}

} // namespace

void Control::mouseEnter(const juce::MouseEvent&) {
    hover_ = true;
    repaint();
}

void Control::mouseExit(const juce::MouseEvent&) {
    hover_ = false;
    repaint();
}

/* ------------------------------------------------------------------ le potard ------------------------------------------------------------------ */

Knob::Knob(juce::RangedAudioParameter& p, float size, juce::String name, juce::String lo, juce::String hi, bool hero)
    : p_(p), att_(p, [this](float x) {
          v_ = p_.convertTo0to1(x);
          repaint();
      }),
      size_(size), hero_(hero), name_(std::move(name)), lo_(std::move(lo)), hi_(std::move(hi)) {
    setRepaintsOnMouseActivity(false);
    setMouseCursor(juce::MouseCursor::UpDownResizeCursor);
    att_.sendInitialUpdate();
}

float Knob::knobSize() const { return size_; }

juce::Point<float> Knob::centre() const {
    if (hero_) return {getWidth() / 2.f, getHeight() / 2.f};
    return {getWidth() / 2.f, 2.f + size_ / 2.f};
}

void Knob::placeAt(float cx, float cy) {
    const float s = size_;
    if (hero_) {
        const float box = 236.f;
        setBounds(juce::roundToInt(cx - box / 2), juce::roundToInt(cy - box / 2), juce::roundToInt(box), juce::roundToInt(box));
        return;
    }
    // assez large pour les bouts de course (DOWN, 1 BAR, 10 HZ) et le nom
    const float w = juce::jmax(80.f, s + 44.f);
    const float h = 2.f + s + 30.f;
    setBounds(juce::roundToInt(cx - w / 2), juce::roundToInt(cy - 2.f - s / 2), juce::roundToInt(w), juce::roundToInt(h));
}

juce::String Knob::title() const { return nameFn ? nameFn() : name_; }
juce::String Knob::valueText() const { return textFn ? textFn() : p_.getCurrentValueAsText(); }

bool Knob::hitTest(int x, int y) {
    const auto c = centre();
    const float r = hero_ ? 104.f : size_ / 2 + 6;
    // le potard et son nom
    return c.getDistanceFrom({static_cast<float>(x), static_cast<float>(y)}) <= r || (!hero_ && y > c.y);
}

void Knob::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto c = centre();
    const float s = size_;
    if (under) under(g, c);
    const float ang = juce::degreesToRadians(-kSweep + 2 * kSweep * v_);
    paintMoogKnob(g, c, s, ang, body_, cap_, phys);
    if (bipolar) {
        // le centre d'un reglage bipolaire (AMOUNT) : un point a l'accent au-dessus du potard
        g.setColour(accent().withAlpha(0.9f));
        g.fillEllipse(c.x - 1.4f, c.y - s / 2 - 4.5f, 2.8f, 2.8f);
    }
    if (hero_) return;
    // les bouts de course, le nom, la valeur pendant le geste
    const float yl = c.y + s * 0.38f;
    const auto small = font(6.5f, Weight::Medium, 0.08f);
    // centres sous les coins du potard (comme les bouts de course de la face), assez larges pour DOWN, 1 BAR, 10 HZ
    if (lo_.isNotEmpty()) text(g, lo_, {c.x - s * 0.44f - 20, yl, 40, 9}, small, kSilkDim);
    if (hi_.isNotEmpty()) text(g, hi_, {c.x + s * 0.44f - 20, yl, 40, 9}, small, kSilkDim);
    const float yn = c.y + s / 2 + (s < 50 ? 3.f : 5.f);
    const bool hotNow = hot() || dragging_;
    text(g, title(), {0, yn, static_cast<float>(getWidth()), 12}, font(s < 50 ? 8.5f : 9.5f, Weight::Medium, 0.2f), hotNow ? kSilk.brighter(0.2f) : kSilk);
    if (showValue && hotNow) text(g, valueText(), {0, yn + 12, static_cast<float>(getWidth()), 11}, font(7.5f, Weight::Semibold, 0.08f), accent());
}

void Knob::setNorm(float n, bool gesture) {
    n = juce::jlimit(0.f, 1.f, n);
    const float x = p_.convertFrom0to1(n);
    if (gesture)
        att_.setValueAsPartOfGesture(x);
    else
        att_.setValueAsCompleteGesture(x);
}

void Knob::reset() { att_.setValueAsCompleteGesture(p_.convertFrom0to1(p_.getDefaultValue())); }

void Knob::mouseDown(const juce::MouseEvent& e) {
    if (e.mods.isPopupMenu()) return;
    if (e.mods.isAltDown() || e.mods.isCommandDown() || e.mods.isCtrlDown()) {
        reset();
        return;
    }
    dragging_ = true;
    held_ = true;
    dragStart_ = v_;
    dragAcc_ = v_;
    att_.beginGesture();
    repaint();
}

void Knob::mouseDrag(const juce::MouseEvent& e) {
    if (!dragging_) return;
    const float y = e.position.y;
    // l'increment depuis le dernier evenement (Maj : quatre fois plus fin, sans saut quand on l'enfonce en cours de route)
    const float prev = getProperties().getWithDefault("lastY", e.getMouseDownPosition().y);
    getProperties().set("lastY", y);
    dragAcc_ = juce::jlimit(0.f, 1.f, dragAcc_ + (prev - y) / kDragRange * (e.mods.isShiftDown() ? 0.25f : 1.f));
    setNorm(dragAcc_, true);
}

void Knob::mouseUp(const juce::MouseEvent&) {
    getProperties().remove("lastY");
    if (dragging_) att_.endGesture();
    dragging_ = false;
    held_ = false;
    repaint();
}

void Knob::mouseDoubleClick(const juce::MouseEvent&) { reset(); }

void Knob::mouseWheelMove(const juce::MouseEvent& e, const juce::MouseWheelDetails& w) {
    const float d = (w.isReversed ? -1.f : 1.f) * (std::fabs(w.deltaY) > std::fabs(w.deltaX) ? w.deltaY : -w.deltaX);
    if (std::fabs(d) < 1e-6f) return;
    if (stepped(p_)) {
        float acc = static_cast<float>(getProperties().getWithDefault("wheel", 0.0)) + d;
        if (std::fabs(acc) < 0.12f) {
            getProperties().set("wheel", acc);
            return;
        }
        getProperties().set("wheel", 0.0);
        setNorm(v_ + (acc > 0 ? 1.f : -1.f) / static_cast<float>(p_.getNumSteps() - 1) + 1e-4f * (acc > 0 ? 1.f : -1.f), false);
        return;
    }
    setNorm(v_ + d * 0.15f * (e.mods.isShiftDown() ? 0.25f : 1.f), false);
}

/* ------------------------------------------------------------------ le levier ------------------------------------------------------------------ */

Lever::Lever(juce::RangedAudioParameter& p, juce::String name, juce::String off, juce::String on)
    : p_(p), att_(p, [this](float x) {
          v_ = x >= 0.5f;
          repaint();
      }),
      name_(std::move(name)), offName_(std::move(off)), onName_(std::move(on)) {
    setMouseCursor(juce::MouseCursor::PointingHandCursor);
    att_.sendInitialUpdate();
}

void Lever::placeAt(float cx, float cy) {
    // le boitier de 46 x 21 (hood.css .mm-p2-tog-sw), la LED a droite, les crans et le nom dessous
    setBounds(juce::roundToInt(cx - 23 - 14), juce::roundToInt(cy - 10.5f - 3), 84, 58);
}

void Lever::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const juce::Rectangle<float> b(14, 3, 46, 21.1f);
    // l'ombre du boitier
    {
        juce::Path sh;
        sh.addRoundedRectangle(b.translated(-1, 2.5f).expanded(0.5f), 10.f);
        g.setColour(juce::Colours::black.withAlpha(0.45f));
        g.fillPath(sh);
    }
    drawScaled(g, body_, Img::ToggleBody, b, phys);
    const auto lb = held_ ? b.translated(0, 0.4f) : b;
    if (v_)
        drawScaled(g, on_, Img::LeverOn, lb, phys);
    else
        drawScaled(g, off_, Img::LeverOff, lb, phys);
    led(g, {b.getRight() + 9.5f, b.getCentreY()}, 7.f, v_);
    const auto f = font(6.5f, Weight::Semibold, 0.08f);
    text(g, offName_, {b.getX() - 14, 27, 28, 9}, f, v_ ? kSilkDim : kSilk);
    text(g, onName_, {b.getRight() - 14, 27, 28, 9}, f, v_ ? kSilk : kSilkDim);
    text(g, name_, {0, 40, static_cast<float>(getWidth()), 12}, font(9.f, Weight::Medium, 0.2f), hot() ? kSilk.brighter(0.2f) : kSilk);
}

void Lever::mouseDown(const juce::MouseEvent& e) {
    if (e.mods.isPopupMenu()) return;
    held_ = true;
    att_.setValueAsCompleteGesture(v_ ? 0.f : 1.f);
    repaint();
}

void Lever::mouseUp(const juce::MouseEvent&) {
    held_ = false;
    repaint();
}

/* ------------------------------------------------------------------ les touches a LED ------------------------------------------------------------------ */

KeyRow::KeyRow(juce::RangedAudioParameter& p, juce::String name, juce::StringArray labels, float keyW, float gap)
    : p_(p), att_(p, [this](float x) {
          idx_ = juce::roundToInt(x);
          repaint();
      }),
      name_(std::move(name)), labels_(std::move(labels)), keyW_(keyW), gap_(gap) {
    setMouseCursor(juce::MouseCursor::PointingHandCursor);
    att_.sendInitialUpdate();
}

void KeyRow::placeAt(float cx, float top) {
    const float w = labels_.size() * keyW_ + (labels_.size() - 1) * gap_ + 16;
    setBounds(juce::roundToInt(cx - w / 2), juce::roundToInt(top), juce::roundToInt(w), name_.isEmpty() ? 48 : 60);
}

juce::Rectangle<float> KeyRow::keyRect(int i) const { return {8 + i * (keyW_ + gap_), 11, keyW_, keyW_ * 140.f / 214.f}; }

int KeyRow::keyAt(juce::Point<float> p) const {
    for (int i = 0; i < labels_.size(); ++i)
        if (keyRect(i).expanded(gap_ / 2, 12).contains(p)) return i;
    return -1;
}

juce::String KeyRow::valueText() const { return labels_[juce::jlimit(0, labels_.size() - 1, idx_)]; }

juce::String KeyRow::helpFor(int i) const { return i >= 0 && i < optionHelp.size() ? labels_[i] + ": " + optionHelp[i] : help; }

void KeyRow::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto lf = font(6.8f, Weight::Semibold, 0.1f);
    for (int i = 0; i < labels_.size(); ++i) {
        auto r = keyRect(i);
        led(g, {r.getCentreX(), 4.5f}, 5.5f, i == idx_);
        if (i == pressed_) r = r.translated(0, 1.2f).reduced(0.4f);
        drawScaled(g, key_, Img::Key, r, phys);
        if (i == pressed_) {
            g.setColour(juce::Colours::black.withAlpha(0.15f));
            g.fillRoundedRectangle(r.reduced(r.getWidth() * 0.12f, r.getHeight() * 0.16f), 2.f);
        }
        if (icon) icon(g, i, r.reduced(r.getWidth() * 0.24f, r.getHeight() * 0.3f).translated(0, -1));
        text(g, labels_[i], {r.getX() - gap_ / 2 - 4, r.getBottom() + 1, r.getWidth() + gap_ + 8, 10}, lf, i == idx_ ? accent() : kSilkDim);
    }
    if (name_.isNotEmpty()) text(g, name_, {0, 47, static_cast<float>(getWidth()), 12}, font(9.f, Weight::Medium, 0.2f), hot() ? kSilk.brighter(0.2f) : kSilk);
}

void KeyRow::choose(int i) {
    if (i < 0 || i >= labels_.size()) return;
    att_.setValueAsCompleteGesture(static_cast<float>(i));
}

void KeyRow::mouseDown(const juce::MouseEvent& e) {
    if (e.mods.isPopupMenu()) return;
    pressed_ = keyAt(e.position);
    held_ = pressed_ >= 0;
    choose(pressed_);
    repaint();
}

void KeyRow::mouseUp(const juce::MouseEvent&) {
    pressed_ = -1;
    held_ = false;
    repaint();
}

void KeyRow::mouseMove(const juce::MouseEvent& e) {
    const int k = keyAt(e.position);
    if (k != static_cast<int>(getProperties().getWithDefault("hoverKey", -1))) getProperties().set("hoverKey", k);
}

void KeyRow::mouseWheelMove(const juce::MouseEvent&, const juce::MouseWheelDetails& w) {
    float acc = static_cast<float>(getProperties().getWithDefault("wheel", 0.0)) + w.deltaY * (w.isReversed ? -1.f : 1.f);
    if (std::fabs(acc) < 0.12f) {
        getProperties().set("wheel", acc);
        return;
    }
    getProperties().set("wheel", 0.0);
    choose(juce::jlimit(0, labels_.size() - 1, idx_ + (acc > 0 ? 1 : -1)));
}

/* ------------------------------------------------------------------ les touches d'action ------------------------------------------------------------------ */

KeyButton::KeyButton(juce::String name, std::function<void()> onClick, float w, float h) : name_(std::move(name)), click_(std::move(onClick)), w_(w), h_(h) {
    setMouseCursor(juce::MouseCursor::PointingHandCursor);
}

void KeyButton::placeAt(float cx, float top) { setBounds(juce::roundToInt(cx - w_ / 2 - 8), juce::roundToInt(top), juce::roundToInt(w_ + 16), juce::roundToInt(h_ + 14)); }

void KeyButton::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    auto r = juce::Rectangle<float>(8, 0, w_, h_);
    if (held_) r = r.translated(0, 1.2f).reduced(0.4f);
    drawScaled(g, key_, Img::Key, r, phys);
    if (held_) {
        g.setColour(juce::Colours::black.withAlpha(0.15f));
        g.fillRoundedRectangle(r.reduced(r.getWidth() * 0.12f, r.getHeight() * 0.16f), 2.f);
    } else if (hover_) {
        g.setColour(juce::Colours::white.withAlpha(0.05f));
        g.fillRoundedRectangle(r.reduced(r.getWidth() * 0.12f, r.getHeight() * 0.16f), 2.f);
    }
    text(g, name_, {0, h_ + 2, static_cast<float>(getWidth()), 10}, font(6.8f, Weight::Semibold, 0.14f), hot() ? kSilk : kSilkDim);
}

void KeyButton::mouseDown(const juce::MouseEvent& e) {
    if (e.mods.isPopupMenu()) return;
    held_ = true;
    repaint();
    if (click_) click_();
}

void KeyButton::mouseUp(const juce::MouseEvent&) {
    held_ = false;
    repaint();
}

} // namespace hl
