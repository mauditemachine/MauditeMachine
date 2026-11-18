#include "RageControls.h"

#include <cmath>

namespace rl {

namespace {

constexpr float kSweep = 135.f;
constexpr float kDragRange = 160.f; // points pour toute la course (la face du MM-ARP)
constexpr float kLight = -0.62f;    // la lumiere : en haut a gauche (radians depuis le haut, sens horaire)
constexpr float kTwoPi = juce::MathConstants<float>::twoPi;

bool stepped(const juce::RangedAudioParameter& p) {
    const int n = p.getNumSteps();
    return n > 1 && n < 64;
}

juce::Point<float> polar(juce::Point<float> c, float a, float r) { return {c.x + std::sin(a) * r, c.y - std::cos(a) * r}; }

uint32_t hash32(uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

/**
 * L'insert d'aluminium tourne, pixel par pixel (D x D pixels, rayon rp pixels ; phys : pixels par point) : un gris
 * metal, le reflet en noeud papillon d'un metal tourne (aligne sur la lumiere, plus fort de son cote), le grain des sillons
 * concentriques, le chanfrein du bord (clair du cote de la lumiere, sombre de l'autre), le creux du centre. Le bord est
 * lisse par la couverture exacte du pixel.
 */
juce::Image makeInsert(int D, float rp, float phys) {
    juce::Image img(juce::Image::ARGB, D, D, true);
    juce::Image::BitmapData bd(img, juce::Image::BitmapData::writeOnly);
    const float cx = D * 0.5f, cy = D * 0.5f;
    for (int y = 0; y < D; ++y)
        for (int x = 0; x < D; ++x) {
            const float dx = x + 0.5f - cx, dy = y + 0.5f - cy;
            const float d = std::sqrt(dx * dx + dy * dy);
            const float alpha = juce::jlimit(0.f, 1.f, rp - d + 0.5f);
            if (alpha <= 0) continue;
            const float rn = d / rp;
            const float a = std::atan2(dx, -dy);
            const float facing = std::cos(a - kLight);
            const float c2 = std::cos(2 * (a - kLight));
            const float lobe = std::pow(juce::jmax(0.f, c2), 7.f);
            const float centreFade = juce::jlimit(0.f, 1.f, (rn - 0.08f) / 0.3f);
            float lum = 0.5f + 0.07f * facing + lobe * (0.32f + 0.14f * facing) * centreFade;
            // les sillons : ~1.6 par point, chacun un peu plus clair ou plus sombre
            const float ring = d / phys * 1.6f;
            const uint32_t h = hash32(static_cast<uint32_t>(ring) * 2654435761u + 17u);
            lum += 0.035f * ((h & 0xffff) / 32767.5f - 1.f) + 0.012f * std::sin(ring * 2.3f);
            // le chanfrein (les 13 % du bord)
            if (rn > 0.87f) {
                const float t = (rn - 0.87f) / 0.13f;
                lum += t * (0.3f * facing - 0.06f);
            }
            // le creux du centre
            if (rn < 0.09f) lum *= 0.78f + 0.22f * rn / 0.09f;
            lum = juce::jlimit(0.f, 1.f, lum);
            bd.setPixelColour(x, y, juce::Colour::fromFloatRGBA(lum * 0.965f, lum * 0.972f, lum * 0.99f, alpha));
        }
    return img;
}

void ticks(juce::Graphics& g, juce::Point<float> c, float r0, float r1, int n, bool bipolar) {
    for (int i = 0; i < n; ++i) {
        const float v = i / static_cast<float>(n - 1);
        const float a = juce::degreesToRadians(-kSweep + 2 * kSweep * v);
        const bool end = i == 0 || i == n - 1, mid = i == (n - 1) / 2 && (n % 2 == 1);
        const auto p0 = polar(c, a, r0), p1 = polar(c, a, end || mid ? r1 + 1.f : r1);
        g.setColour(bipolar && mid ? accent().withAlpha(0.9f) : end ? kSilk.withAlpha(0.55f) : kSilk.withAlpha(0.3f));
        g.drawLine(p0.x, p0.y, p1.x, p1.y, end || mid ? 1.f : 0.8f);
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

void Control::setInert(bool on) {
    if (on == inert_) return;
    inert_ = on;
    setAlpha(on ? 0.38f : 1.f);
}

/* ------------------------------------------------------------------ le potard facon Moog ------------------------------------------------------------------ */

void paintMoogKnob(juce::Graphics& g, juce::Point<float> c, float s, float ang, Cached& insertCache) {
    const float phys = physicalScale(g);
    const float R = s / 2;
    const float Rg = R * 0.8f, Rt = R * 0.66f, Ra = R * 0.46f;
    const juce::Colour black = juce::Colours::black, white = juce::Colours::white;

    // 1. l'ombre portee : la lumiere vient d'en haut a gauche, l'ombre tombe en bas a droite, douce
    {
        const juce::Point<float> p = c + juce::Point<float>(R * 0.07f, R * 0.13f);
        const float rr = R * 1.32f;
        juce::ColourGradient cg(black.withAlpha(0.66f), p.x, p.y, black.withAlpha(0.f), p.x + rr, p.y, true);
        cg.addColour(0.6, black.withAlpha(0.55f));
        cg.addColour(0.78, black.withAlpha(0.2f));
        g.setGradientFill(cg);
        g.fillEllipse(p.x - rr, p.y - rr, 2 * rr, 2 * rr);
    }
    // 2. la jupe : un cone de plastique noir, plus clair du cote de la lumiere
    {
        const auto lit = polar(c, kLight, R), dark = polar(c, kLight + juce::MathConstants<float>::pi, R);
        juce::ColourGradient sk(juce::Colour(0xff3b3b40), lit.x, lit.y, juce::Colour(0xff09090a), dark.x, dark.y, false);
        sk.addColour(0.5, juce::Colour(0xff19191c));
        g.setGradientFill(sk);
        g.fillEllipse(c.x - R, c.y - R, s, s);
        juce::ColourGradient rim(white.withAlpha(0.32f), lit.x, lit.y, white.withAlpha(0.f), c.x, c.y, false);
        g.setGradientFill(rim);
        g.drawEllipse(c.x - R + 0.6f, c.y - R + 0.6f, s - 1.2f, s - 1.2f, 0.9f);
        g.setColour(black.withAlpha(0.85f));
        g.drawEllipse(c.x - R, c.y - R, s, s, 0.7f);
    }
    // 3. la prise cannelee : le contour festonne et ses cannelures tournent avec la valeur
    {
        const int nFl = s >= 90 ? 40 : s >= 50 ? 30 : 22;
        const float depth = R * 0.045f;
        juce::Path grip;
        const int seg = 8;
        for (int j = 0; j <= nFl * seg; ++j) {
            const float u = static_cast<float>(j % seg) / seg;
            const float a = ang + kTwoPi * j / static_cast<float>(nFl * seg);
            const float sn = std::sin(juce::MathConstants<float>::pi * u);
            const auto p = polar(c, a, Rg - depth * sn * sn);
            if (j == 0)
                grip.startNewSubPath(p);
            else
                grip.lineTo(p);
        }
        grip.closeSubPath();
        juce::ColourGradient gg(juce::Colour(0xff2e2e33), c.x, c.y - Rg, juce::Colour(0xff060607), c.x, c.y + Rg, false);
        gg.addColour(0.5, juce::Colour(0xff141416));
        g.setGradientFill(gg);
        g.fillPath(grip);
        // le lustre du plastique (fixe : la lumiere ne tourne pas)
        {
            const auto hp = polar(c, kLight, Rg * 0.55f);
            juce::ColourGradient sh(white.withAlpha(0.13f), hp.x, hp.y, white.withAlpha(0.f), hp.x + Rg * 0.95f, hp.y, true);
            g.setGradientFill(sh);
            g.fillPath(grip);
        }
        // les cannelures : l'ombre du creux, la crete qui prend la lumiere selon son angle
        const float r0 = Rt + 0.4f, r1 = Rg - depth * 0.35f;
        const float half = kTwoPi / nFl * 0.5f;
        for (int k = 0; k < nFl; ++k) {
            const float a = ang + kTwoPi * (k + 0.5f) / nFl; // le fond d'un creux
            const float facing = std::cos(a - kLight);
            const auto d0 = polar(c, a, r0), d1 = polar(c, a, r1);
            g.setColour(black.withAlpha(0.55f));
            g.drawLine(d0.x, d0.y, d1.x, d1.y, juce::jmax(0.7f, s * 0.012f));
            const float ac = a + half * 0.85f; // la crete suivante
            const auto c0 = polar(c, ac, r0 + 0.3f), c1 = polar(c, ac, Rg - 0.2f);
            g.setColour(white.withAlpha(0.03f + 0.24f * std::pow(juce::jmax(0.f, facing), 1.6f)));
            g.drawLine(c0.x, c0.y, c1.x, c1.y, juce::jmax(0.6f, s * 0.01f));
        }
        g.setColour(black.withAlpha(0.7f));
        g.strokePath(grip, juce::PathStrokeType(0.7f));
    }
    // 4. le dessus noir, un rien bombe, et son arete
    {
        const auto hp = polar(c, kLight, Rt * 0.35f);
        juce::ColourGradient tg(juce::Colour(0xff313136), hp.x, hp.y, juce::Colour(0xff0d0d0f), hp.x + Rt * 1.25f, hp.y, true);
        g.setGradientFill(tg);
        g.fillEllipse(c.x - Rt, c.y - Rt, 2 * Rt, 2 * Rt);
        const auto lit = polar(c, kLight, Rt), dark = polar(c, kLight + juce::MathConstants<float>::pi, Rt);
        juce::ColourGradient eg(white.withAlpha(0.3f), lit.x, lit.y, black.withAlpha(0.6f), dark.x, dark.y, false);
        g.setGradientFill(eg);
        g.drawEllipse(c.x - Rt, c.y - Rt, 2 * Rt, 2 * Rt, 0.9f);
    }
    // 5. le repere creme sur le dessus noir
    const float w = juce::jmax(1.3f, s * 0.042f);
    {
        const auto p0 = polar(c, ang, Ra + R * 0.03f), p1 = polar(c, ang, Rt - R * 0.025f);
        juce::Path m;
        m.startNewSubPath(p0);
        m.lineTo(p1);
        g.setColour(black.withAlpha(0.5f));
        g.strokePath(m, juce::PathStrokeType(w + 1.f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
        g.setColour(juce::Colour(0xfff4f0e8));
        g.strokePath(m, juce::PathStrokeType(w, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    }
    // 6. l'insert d'aluminium (fixe : ses reflets suivent la lumiere), son logement, le repere grave qui tourne dessus
    {
        const int D = juce::jmax(4, static_cast<int>(std::ceil(2 * Ra * phys)) + 2);
        const float rp = Ra * phys;
        const auto& img = insertCache.pixels(D, D, juce::roundToInt(rp * 64), [rp, phys](int dd, int) { return makeInsert(dd, rp, phys); });
        const float L = D / phys;
        g.setColour(black.withAlpha(0.8f));
        g.fillEllipse(c.x - Ra - 0.7f, c.y - Ra - 0.7f, 2 * Ra + 1.4f, 2 * Ra + 1.4f);
        g.setOpacity(1.f);
        g.drawImage(img, juce::Rectangle<float>(c.x - L / 2, c.y - L / 2, L, L));
        const auto p0 = polar(c, ang, R * 0.1f), p1 = polar(c, ang, Ra - R * 0.07f);
        juce::Path m;
        m.startNewSubPath(p0);
        m.lineTo(p1);
        g.setColour(white.withAlpha(0.35f));
        g.strokePath(m, juce::PathStrokeType(w * 0.85f + 0.8f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded),
                     juce::AffineTransform::translation(0.35f, 0.45f));
        g.setColour(juce::Colour(0xff121214));
        g.strokePath(m, juce::PathStrokeType(w * 0.85f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    }
}

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

juce::Point<float> Knob::centre() const { return {getWidth() / 2.f, margin() + size_ / 2.f}; }

void Knob::placeAt(float cx, float cy) {
    const float s = size_, m = margin();
    // assez large pour les bouts de course (DARK, BRIGHT, 1 KHZ) et le nom
    const float w = hero_ ? s + 2 * m + 24 : juce::jmax(84.f, s + 2 * m + 26);
    const float h = m + s + (hero_ ? 12.f : 34.f);
    setBounds(juce::roundToInt(cx - w / 2), juce::roundToInt(cy - m - s / 2), juce::roundToInt(w), juce::roundToInt(h));
}

juce::String Knob::title() const { return nameFn ? nameFn() : name_; }
juce::String Knob::valueText() const { return textFn ? textFn() : p_.getCurrentValueAsText(); }

bool Knob::hitTest(int x, int y) {
    const auto c = centre();
    const float r = size_ / 2 + (hero_ ? 14 : 6);
    // le potard et son nom
    return c.getDistanceFrom({static_cast<float>(x), static_cast<float>(y)}) <= r || (!hero_ && y > c.y && std::fabs(x - c.x) < size_ / 2 + 24);
}

void Knob::paint(juce::Graphics& g) {
    const auto c = centre();
    const float s = size_, R = s / 2;
    if (hero_) {
        // l'echelle du DRIVE : 25 reperes, 7 chiffres (0 a 36 dB, ou 20 a 56 avec PUNISH)
        ticks(g, c, R + 4, R + 8, 25, false);
        for (int i = 0; i <= 6; ++i) {
            const float a = juce::degreesToRadians(-kSweep + 2 * kSweep * i / 6.f);
            const auto p = polar(c, a, R + 19);
            text(g, heroMark ? heroMark(i) : juce::String(i * 6), {p.x - 14, p.y - 6, 28, 12}, font(8.5f, Weight::Bold, 0.04f), kSilk.withAlpha(0.85f));
        }
    } else {
        ticks(g, c, R + 2.5f, R + 5.5f, 11, bipolar);
    }
    const float ang = juce::degreesToRadians(-kSweep + 2 * kSweep * v_);
    paintMoogKnob(g, c, s, ang, insert_);
    if (hero_) return;
    // les bouts de course, le nom, la valeur pendant le geste
    const float yl = c.y + R * 0.72f + 3;
    const auto small = font(6.5f, Weight::Medium, 0.08f);
    if (lo_.isNotEmpty()) text(g, lo_, {c.x - R * 0.78f - 22, yl, 34, 9}, small, kSilkDim, juce::Justification::centredRight);
    if (hi_.isNotEmpty()) text(g, hi_, {c.x + R * 0.78f - 12, yl, 34, 9}, small, kSilkDim, juce::Justification::centredLeft);
    if (!showName) return;
    const float yn = c.y + R + 7.f;
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

KeyRow::KeyRow(juce::RangedAudioParameter& p, juce::String name, juce::StringArray labels, float keyW, float gap, int offset)
    : p_(p), att_(p, [this](float x) {
          idx_ = juce::roundToInt(x);
          repaint();
      }),
      name_(std::move(name)), labels_(std::move(labels)), keyW_(keyW), gap_(gap), offset_(offset) {
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

juce::String KeyRow::valueText() const {
    const int i = idx_ - offset_;
    return i >= 0 && i < labels_.size() ? labels_[i] : p_.getCurrentValueAsText();
}

juce::String KeyRow::helpFor(int i) const { return i >= 0 && i < optionHelp.size() ? labels_[i] + ": " + optionHelp[i] : help; }

void KeyRow::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto lf = font(6.8f, Weight::Semibold, 0.1f);
    for (int i = 0; i < labels_.size(); ++i) {
        auto r = keyRect(i);
        const bool on = i + offset_ == idx_;
        led(g, {r.getCentreX(), 4.5f}, 5.5f, on);
        if (i == pressed_) r = r.translated(0, 1.2f).reduced(0.4f);
        drawScaled(g, key_, Img::Key, r, phys);
        if (i == pressed_) {
            g.setColour(juce::Colours::black.withAlpha(0.15f));
            g.fillRoundedRectangle(r.reduced(r.getWidth() * 0.12f, r.getHeight() * 0.16f), 2.f);
        }
        if (icon) icon(g, i, r.reduced(r.getWidth() * 0.24f, r.getHeight() * 0.3f).translated(0, -1));
        text(g, labels_[i], {r.getX() - gap_ / 2 - 4, r.getBottom() + 1, r.getWidth() + gap_ + 8, 10}, lf, on ? accent() : kSilkDim);
    }
    if (name_.isNotEmpty()) text(g, name_, {0, 47, static_cast<float>(getWidth()), 12}, font(9.f, Weight::Medium, 0.2f), hot() ? kSilk.brighter(0.2f) : kSilk);
}

void KeyRow::choose(int i) {
    if (i < 0 || i >= labels_.size()) return;
    att_.setValueAsCompleteGesture(static_cast<float>(i + offset_));
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
    const int cur = juce::jlimit(0, labels_.size() - 1, idx_ - offset_);
    choose(juce::jlimit(0, labels_.size() - 1, cur + (acc > 0 ? 1 : -1)));
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

/* ------------------------------------------------------------------ l'interrupteur a LED ------------------------------------------------------------------ */

KeySwitch::KeySwitch(juce::RangedAudioParameter& p, juce::String name, juce::String label, float w)
    : p_(p), att_(p, [this](float x) {
          v_ = x >= 0.5f;
          repaint();
      }),
      name_(std::move(name)), label_(std::move(label)), w_(w) {
    setMouseCursor(juce::MouseCursor::PointingHandCursor);
    att_.sendInitialUpdate();
}

void KeySwitch::placeAt(float cx, float top) { setBounds(juce::roundToInt(cx - w_ / 2 - 8), juce::roundToInt(top), juce::roundToInt(w_ + 16), 46); }

void KeySwitch::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    auto r = juce::Rectangle<float>(8, 11, w_, w_ * 140.f / 214.f);
    led(g, {r.getCentreX(), 4.5f}, 5.5f, v_);
    if (held_) r = r.translated(0, 1.2f).reduced(0.4f);
    drawScaled(g, key_, Img::Key, r, phys);
    if (held_) {
        g.setColour(juce::Colours::black.withAlpha(0.15f));
        g.fillRoundedRectangle(r.reduced(r.getWidth() * 0.12f, r.getHeight() * 0.16f), 2.f);
    }
    if (label_.isNotEmpty())
        text(g, label_, {0, r.getBottom() + 1, static_cast<float>(getWidth()), 10}, font(6.8f, Weight::Semibold, 0.1f), v_ ? accent() : hot() ? kSilk : kSilkDim);
}

void KeySwitch::mouseDown(const juce::MouseEvent& e) {
    if (e.mods.isPopupMenu()) return;
    held_ = true;
    att_.setValueAsCompleteGesture(v_ ? 0.f : 1.f);
    repaint();
}

void KeySwitch::mouseUp(const juce::MouseEvent&) {
    held_ = false;
    repaint();
}

/* ------------------------------------------------------------------ le selecteur a fenetre ------------------------------------------------------------------ */

Selector::Selector(juce::RangedAudioParameter& p, juce::String name, juce::StringArray labels, float w, float h)
    : p_(p), att_(p, [this](float x) {
          idx_ = juce::roundToInt(x);
          repaint();
      }),
      name_(std::move(name)), labels_(std::move(labels)), w_(w), h_(h) {
    setMouseCursor(juce::MouseCursor::PointingHandCursor);
    att_.sendInitialUpdate();
}

void Selector::placeAt(float cx, float top) { setBounds(juce::roundToInt(cx - w_ / 2 - 4), juce::roundToInt(top), juce::roundToInt(w_ + 8), juce::roundToInt(h_ + (showName ? 22 : 6))); }

juce::Rectangle<float> Selector::glass() const { return {4, 3, w_, h_}; }

juce::String Selector::valueText() const { return labels_[juce::jlimit(0, labels_.size() - 1, idx_)]; }

void Selector::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto r = glass();
    const auto& img = glass_.get(static_cast<float>(getWidth()), static_cast<float>(getHeight()), phys, [r](juce::Graphics& gg) {
        gg.setColour(juce::Colours::white.withAlpha(0.07f));
        gg.fillRoundedRectangle(r.expanded(1.5f), 4.5f);
        gg.setColour(juce::Colour(0xff050505));
        gg.fillRoundedRectangle(r.expanded(0.8f), 4);
        juce::ColourGradient lg(juce::Colour(0xff0b0906), 0, r.getY(), juce::Colour(0xff15110a), 0, r.getBottom(), false);
        gg.setGradientFill(lg);
        gg.fillRoundedRectangle(r, 3.5f);
        juce::ColourGradient ig(juce::Colours::black.withAlpha(0.9f), 0, r.getY(), juce::Colours::black.withAlpha(0.f), 0, r.getY() + 7, false);
        gg.setGradientFill(ig);
        gg.fillRoundedRectangle(r.withHeight(7), 3.5f);
    });
    g.setOpacity(1.f);
    g.drawImage(img, juce::Rectangle<float>(0, 0, static_cast<float>(getWidth()), static_cast<float>(getHeight())));
    const juce::String v = valueText();
    const auto vf = font(h_ > 22 ? 10.5f : 9.f, Weight::Bold, 0.08f);
    text(g, v, r.withTrimmedRight(14).translated(0, 0.5f), vf, accent().withAlpha(0.25f));
    text(g, v, r.withTrimmedRight(14), vf, accent());
    // les chevrons
    const float x = r.getRight() - 10, y = r.getCentreY();
    juce::Path up, dn;
    up.addTriangle(x - 3.2f, y - 2.2f, x + 3.2f, y - 2.2f, x, y - 6.f);
    dn.addTriangle(x - 3.2f, y + 2.2f, x + 3.2f, y + 2.2f, x, y + 6.f);
    g.setColour(hot() ? kSilk : kSilkDim);
    g.fillPath(up);
    g.fillPath(dn);
    if (showName) {
        const juce::String ln = longName ? longName(idx_) : juce::String();
        text(g, hot() && ln.isNotEmpty() ? ln : name_, {0, r.getBottom() + 5, static_cast<float>(getWidth()), 12}, font(hot() && ln.isNotEmpty() ? 7.5f : 9.f, Weight::Medium, 0.2f),
             hot() && ln.isNotEmpty() ? accent() : kSilk);
    }
}

void Selector::choose(int i) {
    i = juce::jlimit(0, labels_.size() - 1, i);
    if (i != idx_) att_.setValueAsCompleteGesture(static_cast<float>(i));
}

void Selector::mouseDown(const juce::MouseEvent& e) {
    if (e.mods.isPopupMenu()) return;
    held_ = true;
    dragged_ = false;
    dragAcc_ = 0;
    // un chevron : le voisin, tout de suite
    const auto r = glass();
    if (e.position.x > r.getRight() - 18 && r.contains(e.position)) {
        choose(idx_ + (e.position.y < r.getCentreY() ? -1 : 1));
        dragged_ = true;
    }
    repaint();
}

void Selector::mouseDrag(const juce::MouseEvent& e) {
    const float dy = static_cast<float>(e.getDistanceFromDragStartY());
    if (!dragged_ && std::fabs(dy) < 4) return;
    dragged_ = true;
    const float prev = getProperties().getWithDefault("lastY", e.getMouseDownPosition().y);
    getProperties().set("lastY", e.position.y);
    dragAcc_ += e.position.y - prev;
    while (dragAcc_ > 12) {
        choose(idx_ + 1);
        dragAcc_ -= 12;
    }
    while (dragAcc_ < -12) {
        choose(idx_ - 1);
        dragAcc_ += 12;
    }
}

void Selector::mouseUp(const juce::MouseEvent& e) {
    getProperties().remove("lastY");
    held_ = false;
    repaint();
    if (dragged_ || !getLocalBounds().contains(e.getPosition())) return;
    // un clic : la liste
    juce::PopupMenu m;
    m.addSectionHeader(name_);
    for (int i = 0; i < labels_.size(); ++i) {
        const juce::String ln = longName ? longName(i) : juce::String();
        m.addItem(i + 1, ln.isNotEmpty() && ln != labels_[i] ? labels_[i] + "   " + ln : labels_[i], true, i == idx_);
    }
    juce::Component::SafePointer<Selector> safe(this);
    m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(this).withMinimumWidth(juce::roundToInt(w_ + 8)), [safe](int r) {
        if (safe && r > 0) safe->choose(r - 1);
    });
}

void Selector::mouseWheelMove(const juce::MouseEvent&, const juce::MouseWheelDetails& w) {
    float acc = static_cast<float>(getProperties().getWithDefault("wheel", 0.0)) + w.deltaY * (w.isReversed ? -1.f : 1.f);
    if (std::fabs(acc) < 0.12f) {
        getProperties().set("wheel", acc);
        return;
    }
    getProperties().set("wheel", 0.0);
    choose(idx_ + (acc > 0 ? -1 : 1));
}

/* ------------------------------------------------------------------ les onglets ------------------------------------------------------------------ */

PageTabs::PageTabs(juce::StringArray names, float tabW, float tabH, float gap) : names_(std::move(names)), tabW_(tabW), tabH_(tabH), gap_(gap) {
    setMouseCursor(juce::MouseCursor::PointingHandCursor);
    const float w = names_.size() * tabW_ + (names_.size() + 1) * gap_;
    setSize(juce::roundToInt(w + 8), juce::roundToInt(tabH_ + 2 * gap_ + 8));
}

juce::Rectangle<float> PageTabs::tabRect(int i) const { return {4 + gap_ + i * (tabW_ + gap_), 4 + gap_, tabW_, tabH_}; }

int PageTabs::tabAt(juce::Point<float> p) const {
    for (int i = 0; i < names_.size(); ++i)
        if (tabRect(i).expanded(gap_ / 2).contains(p)) return i;
    return -1;
}

void PageTabs::setCurrent(int i) {
    i = juce::jlimit(0, names_.size() - 1, i);
    if (i == cur_) return;
    cur_ = i;
    repaint();
}

void PageTabs::paint(juce::Graphics& g) {
    // le plateau creuse (la barre des pages du MM-ARP) : noir, l'ombre du haut, une arete claire en bas
    const juce::Rectangle<float> tray(4, 4, getWidth() - 8.f, getHeight() - 8.f);
    g.setColour(juce::Colours::white.withAlpha(0.07f));
    g.fillRoundedRectangle(tray.expanded(1.5f).translated(0, 0.8f), 7);
    g.setColour(juce::Colour(0xff060606));
    g.fillRoundedRectangle(tray, 6);
    {
        juce::Graphics::ScopedSaveState s(g);
        juce::Path clip;
        clip.addRoundedRectangle(tray, 6);
        g.reduceClipRegion(clip);
        juce::ColourGradient ig(juce::Colours::black, 0, tray.getY(), juce::Colours::black.withAlpha(0.f), 0, tray.getY() + 8, false);
        g.setGradientFill(ig);
        g.fillRect(tray.withHeight(8));
    }
    for (int i = 0; i < names_.size(); ++i) {
        auto r = tabRect(i);
        const bool on = i == cur_;
        if (i == pressed_) r = r.translated(0, 0.8f);
        if (on) {
            // la touche allumee : l'accent, son halo, le texte noir
            for (int k = 3; k >= 1; --k) {
                g.setColour(accent().withAlpha(0.08f * (4 - k)));
                g.fillRoundedRectangle(r.expanded(k * 2.f), 4 + k * 2.f);
            }
            juce::ColourGradient cg(accent().interpolatedWith(juce::Colours::white, 0.35f), 0, r.getY(), accent().darker(0.15f), 0, r.getBottom(), false);
            g.setGradientFill(cg);
            g.fillRoundedRectangle(r, 3.5f);
            g.setColour(juce::Colours::white.withAlpha(0.45f));
            g.drawHorizontalLine(juce::roundToInt(r.getY() + 1), r.getX() + 3, r.getRight() - 3);
            text(g, names_[i], r, font(9.5f, Weight::Bold, 0.24f), juce::Colour(0xff0b0b0c));
        } else {
            juce::ColourGradient cg(juce::Colour(0xff2b2a29), 0, r.getY(), juce::Colour(0xff161514), 0, r.getBottom(), false);
            g.setGradientFill(cg);
            g.fillRoundedRectangle(r, 3.5f);
            g.setColour(juce::Colours::white.withAlpha(i == hover_ ? 0.16f : 0.09f));
            g.drawRoundedRectangle(r.reduced(0.5f), 3.5f, 1.f);
            g.setColour(juce::Colours::black.withAlpha(0.6f));
            g.drawHorizontalLine(juce::roundToInt(r.getBottom()), r.getX() + 2, r.getRight() - 2);
            text(g, names_[i], r, font(9.5f, Weight::Semibold, 0.24f), i == hover_ ? kSilk : kSilkDim);
        }
    }
}

void PageTabs::mouseDown(const juce::MouseEvent& e) {
    pressed_ = tabAt(e.position);
    if (pressed_ >= 0) {
        setCurrent(pressed_);
        if (onSelect) onSelect(pressed_);
    }
    repaint();
}

void PageTabs::mouseUp(const juce::MouseEvent&) {
    pressed_ = -1;
    repaint();
}

void PageTabs::mouseMove(const juce::MouseEvent& e) {
    const int h = tabAt(e.position);
    if (h != hover_) {
        hover_ = h;
        repaint();
    }
}

void PageTabs::mouseExit(const juce::MouseEvent&) {
    hover_ = -1;
    repaint();
}

} // namespace rl
