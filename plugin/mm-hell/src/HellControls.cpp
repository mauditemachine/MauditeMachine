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

// L'ombre douce d'une piece ronde (drop-shadow de hood.css), un degrade radial decale
void roundShadow(juce::Graphics& g, juce::Point<float> c, float r, juce::Point<float> off, float blur, float alpha) {
    const juce::Point<float> p = c + off;
    juce::ColourGradient cg(juce::Colours::black.withAlpha(alpha), p.x, p.y, juce::Colours::black.withAlpha(0.f), p.x + r + blur, p.y, true);
    cg.addColour(r / (r + blur), juce::Colours::black.withAlpha(alpha * 0.85f));
    g.setGradientFill(cg);
    g.fillEllipse(p.x - r - blur, p.y - r - blur, 2 * (r + blur), 2 * (r + blur));
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

Knob::Knob(juce::RangedAudioParameter& p, Style s, juce::String name, juce::String lo, juce::String hi)
    : p_(p), att_(p, [this](float x) {
          v_ = p_.convertTo0to1(x);
          repaint();
      }),
      style_(s), name_(std::move(name)), lo_(std::move(lo)), hi_(std::move(hi)) {
    setRepaintsOnMouseActivity(false);
    setMouseCursor(juce::MouseCursor::UpDownResizeCursor);
    att_.sendInitialUpdate();
}

float Knob::knobSize() const {
    switch (style_) {
    case Style::Fine: return 44.f;
    case Style::Big: return 76.f;
    case Style::Hero: return 120.f;
    case Style::Main: break;
    }
    return 56.f;
}

juce::Point<float> Knob::centre() const {
    if (style_ == Style::Hero) return {getWidth() / 2.f, getHeight() / 2.f};
    return {getWidth() / 2.f, 2.f + knobSize() / 2.f};
}

void Knob::placeAt(float cx, float cy) {
    const float s = knobSize();
    if (style_ == Style::Hero) {
        const float box = 236.f;
        setBounds(juce::roundToInt(cx - box / 2), juce::roundToInt(cy - box / 2), juce::roundToInt(box), juce::roundToInt(box));
        return;
    }
    const float w = style_ == Style::Fine ? 76.f : style_ == Style::Big ? 112.f : 92.f;
    const float h = 2.f + s + 30.f;
    setBounds(juce::roundToInt(cx - w / 2), juce::roundToInt(cy - 2.f - s / 2), juce::roundToInt(w), juce::roundToInt(h));
}

juce::String Knob::title() const { return nameFn ? nameFn() : name_; }
juce::String Knob::valueText() const { return textFn ? textFn() : p_.getCurrentValueAsText(); }

bool Knob::hitTest(int x, int y) {
    const auto c = centre();
    const float r = style_ == Style::Hero ? 104.f : knobSize() / 2 + 6;
    // le potard et son nom
    return c.getDistanceFrom({static_cast<float>(x), static_cast<float>(y)}) <= r || (style_ != Style::Hero && y > c.y);
}

void Knob::paint(juce::Graphics& g) {
    const float phys = physicalScale(g);
    const auto c = centre();
    const float s = knobSize();
    if (under) under(g, c);
    const float ang = juce::degreesToRadians(-kSweep + 2 * kSweep * v_);
    if (style_ == Style::Fine) {
        // le petit knob fin (pcbui.tsx FINE_KNOB) : ses graduations, son image, son repere depuis le centre
        const float k = s / 44.f;
        for (int i = 0; i <= 10; ++i) {
            const float a = juce::degreesToRadians(-kSweep + 2 * kSweep * i / 10.f);
            const bool major = i % 5 == 0;
            const float t0 = 16.f * k, t1 = (major ? 20.2f : 19.f) * k;
            g.setColour(kSilk.withAlpha(major ? 0.92f : 0.72f));
            g.drawLine(c.x + std::sin(a) * t0, c.y - std::cos(a) * t0, c.x + std::sin(a) * t1, c.y - std::cos(a) * t1, major ? 1.1f : 0.8f);
        }
        if (bipolar) {
            g.setColour(kAccent.withAlpha(0.9f));
            g.fillEllipse(c.x - 1.3f, c.y - 22.5f * k, 2.6f, 2.6f);
        }
        const float img = 13.f * 2 * 1.12f * k;
        roundShadow(g, c, img / 2 - 1, {-1.5f, 3.f}, 2.5f, 0.75f);
        drawScaled(g, body_, Img::FineKnob, {c.x - img / 2, c.y - img / 2, img, img}, phys);
        const float m0 = 0.6f * k, m1 = 8.9f * k, w = 1.5f * k;
        juce::Path mark;
        mark.addRoundedRectangle(-w / 2, -m1, w, m1 - m0, w / 2);
        g.setColour(juce::Colour(0xfff3efe8));
        g.fillPath(mark, juce::AffineTransform::rotation(ang).translated(c));
    } else {
        // le potard du MM-RYTM vu de dessus (pcbui.tsx KNOB_IMG) : l'image fixe, le repere qui tourne, le capuchon
        const float k = s / 52.f;
        roundShadow(g, c, s * 0.47f, {-1.f, 2.f}, 2.f * k, 0.55f);
        const juce::Rectangle<float> r(c.x - s / 2, c.y - s / 2, s, s);
        drawScaled(g, body_, Img::Knob, r, phys);
        const float r0 = 15.2f * k, r1 = 22.f * k, w = 3.f * k;
        juce::Path mark;
        mark.addRectangle(-w / 2, -r1, w, r1 - r0);
        const auto t = juce::AffineTransform::rotation(ang).translated(c);
        g.setColour(juce::Colours::black.withAlpha(0.5f));
        g.strokePath(mark, juce::PathStrokeType(0.6f), t);
        g.setColour(juce::Colour(0xffefebe3));
        g.fillPath(mark, t);
        drawScaled(g, cap_, Img::KnobCap, r, phys);
    }
    if (style_ == Style::Hero) return;
    // les bouts de course, le nom, la valeur pendant le geste
    const float yl = c.y + s * 0.38f;
    const auto small = font(6.5f, Weight::Medium, 0.08f);
    // centres sous les coins du potard (comme les bouts de course de la face), assez larges pour DOWN, 1 BAR, 10 HZ
    if (lo_.isNotEmpty()) text(g, lo_, {c.x - s * 0.44f - 20, yl, 40, 9}, small, kSilkDim);
    if (hi_.isNotEmpty()) text(g, hi_, {c.x + s * 0.44f - 20, yl, 40, 9}, small, kSilkDim);
    const float yn = c.y + s / 2 + (style_ == Style::Fine ? 2.f : 5.f);
    const bool hotNow = hot() || dragging_;
    text(g, title(), {0, yn, static_cast<float>(getWidth()), 12}, font(style_ == Style::Fine ? 8.f : 9.5f, Weight::Medium, 0.2f), hotNow ? kSilk.brighter(0.2f) : kSilk);
    if (showValue && hotNow) text(g, valueText(), {0, yn + 12, static_cast<float>(getWidth()), 11}, font(7.5f, Weight::Semibold, 0.08f), kAccent);
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
        text(g, labels_[i], {r.getX() - gap_ / 2 - 4, r.getBottom() + 1, r.getWidth() + gap_ + 8, 10}, lf, i == idx_ ? kAccent : kSilkDim);
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
