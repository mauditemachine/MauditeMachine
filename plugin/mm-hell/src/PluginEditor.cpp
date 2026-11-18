#include "PluginEditor.h"

#include <cmath>

using hl::Knob;
using hl::KeyButton;
using hl::KeyRow;
using hl::Lever;

namespace {

constexpr float W = MMHellProcessor::kCanvasW;
constexpr float H = MMHellProcessor::kCanvasH;

// Les cadres (le plan de 1000 x 620)
constexpr float kTop = 84, kBottom = 432;              // DELAY, FREQUENCY SHIFTER, HELL
constexpr float kDelayX0 = 40, kDelayX1 = 292;
constexpr float kShiftX0 = 304, kShiftX1 = 696;
constexpr float kHellX0 = 708, kHellX1 = 960;
constexpr float kLfoY0 = 446, kLfoY1 = 566;
constexpr float kInfoY = 576;

juce::RangedAudioParameter& P(MMHellProcessor& p, const char* id) { return *p.apvts.getParameter(id); }

// Les pictogrammes des formes du LFO, sur les touches
void shapeIcon(juce::Graphics& g, int i, juce::Rectangle<float> r) {
    juce::Path p;
    const float x0 = r.getX(), x1 = r.getRight(), y0 = r.getY(), y1 = r.getBottom(), ym = r.getCentreY();
    if (i == 0) {
        p.startNewSubPath(x0, ym);
        for (int k = 1; k <= 24; ++k) {
            const float t = k / 24.f;
            p.lineTo(x0 + t * (x1 - x0), ym - std::sin(t * juce::MathConstants<float>::twoPi) * (ym - y0));
        }
    } else if (i == 1) {
        p.startNewSubPath(x0, y1);
        p.lineTo(x0 + (x1 - x0) * 0.5f, y0);
        p.lineTo(x0 + (x1 - x0) * 0.5f, y1);
        p.lineTo(x1, y0);
    } else if (i == 2) {
        p.startNewSubPath(x0, y1);
        p.lineTo(x0, y0);
        p.lineTo(x0 + (x1 - x0) * 0.5f, y0);
        p.lineTo(x0 + (x1 - x0) * 0.5f, y1);
        p.lineTo(x1, y1);
        p.lineTo(x1, y0);
    } else {
        const float lv[5] = {0.3f, 0.9f, 0.1f, 0.65f, 0.4f};
        p.startNewSubPath(x0, y0 + lv[0] * (y1 - y0));
        for (int k = 0; k < 5; ++k) {
            const float xa = x0 + (x1 - x0) * k / 5.f, xb = x0 + (x1 - x0) * (k + 1) / 5.f, y = y0 + lv[k] * (y1 - y0);
            p.lineTo(xa, y);
            p.lineTo(xb, y);
        }
    }
    g.setColour(hl::kSilk.withAlpha(0.8f));
    g.strokePath(p, juce::PathStrokeType(1.f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
}

void sectionTitle(juce::Graphics& g, const juce::String& t, float cx, float y) {
    hl::text(g, t, {cx - 120, y, 240, 14}, hl::font(10.5f, hl::Weight::Semibold, 0.26f), hl::kSilk);
}

} // namespace

/* ------------------------------------------------------------------ le fond ------------------------------------------------------------------ */

void MMHellEditor::Panel::paint(juce::Graphics& g) {
    const float phys = hl::physicalScale(g);
    const auto look = hl::SharedLook()->state();
    const auto& img = bg.get(W, H, phys, [look](juce::Graphics& b) {
        hl::paintPanel(b, {0, 0, W, H}, look);
        // l'en-tete : le wordmark et le nom, comme la face du MM-ARP
        hl::text(b, "MAUDITE MACHINE", {86, 20, 300, 30}, hl::logoFont(23.f), hl::kSilk.withAlpha(0.92f), juce::Justification::centredLeft);
        hl::text(b, "MM-HELL", {352, 16, 180, 26}, hl::font(16.f, hl::Weight::Medium, 0.32f), hl::kSilk, juce::Justification::centredLeft);
        // la ligne de firmware des machines Maudite Machine (MM-RYTM, MM-ARP : "FIRMWARE V.2.5 / 2026")
        hl::text(b, "FIRMWARE V." MMHELL_VERSION " / 2026", {353, 42, 180, 10}, hl::font(6.5f, hl::Weight::Semibold, 0.24f), hl::kSilkDim,
                 juce::Justification::centredLeft);
        // les cadres : les titres, les filets entre eux
        sectionTitle(b, "DELAY", (kDelayX0 + kDelayX1) / 2, kTop + 4);
        sectionTitle(b, "FREQUENCY SHIFTER", (kShiftX0 + kShiftX1) / 2, kTop + 4);
        sectionTitle(b, "HELL", (kHellX0 + kHellX1) / 2 - 6, kTop + 4);
        sectionTitle(b, "LFO", 500, kLfoY0 + 2);
        b.setColour(hl::kLine);
        for (float x : {(kDelayX1 + kShiftX0) / 2, (kShiftX1 + kHellX0) / 2}) b.fillRect(x, kTop + 2, 1.f, kBottom - kTop - 4);
        b.fillRect(kDelayX0, kLfoY0 - 6, kHellX1 - kDelayX0, 1.f);
        b.fillRect(kDelayX0, kInfoY - 3, kHellX1 - kDelayX0, 1.f);
        b.setColour(juce::Colours::black.withAlpha(0.35f));
        for (float x : {(kDelayX1 + kShiftX0) / 2 + 1, (kShiftX1 + kHellX0) / 2 + 1}) b.fillRect(x, kTop + 2, 1.f, kBottom - kTop - 4);
        b.fillRect(kDelayX0, kLfoY0 - 5, kHellX1 - kDelayX0, 1.f);
        // IN THE LOOP, entre deux filets
        {
            const float y = 314, cx = (kDelayX0 + kDelayX1) / 2;
            hl::text(b, "IN THE LOOP", {cx - 60, y - 5, 120, 10}, hl::font(7.5f, hl::Weight::Bold, 0.24f), hl::kSilkDim);
            b.setColour(hl::kLine);
            b.fillRect(kDelayX0 + 12, y, cx - 48 - (kDelayX0 + 12), 1.f);
            b.fillRect(cx + 48, y, kDelayX1 - 12 - (cx + 48), 1.f);
        }
        // SIDEBAND : la modulation en anneau au centre de sa course
        hl::text(b, "R.M.", {346, 172, 40, 9}, hl::font(6.5f, hl::Weight::Semibold, 0.1f), hl::kSilkDim);
    });
    g.setOpacity(1.f);
    g.drawImage(img, juce::Rectangle<float>(0, 0, W, H));
}

void MMHellEditor::Burger::paint(juce::Graphics& g) {
    const auto b = getLocalBounds().toFloat().reduced(1);
    const bool hot = isMouseOver() || open;
    // une petite touche sombre encastree, trois traits de serigraphie (l'accent quand le menu est ouvert ou survole)
    g.setColour(juce::Colours::black.withAlpha(0.55f));
    g.fillRoundedRectangle(b.translated(0, 1), 4);
    juce::ColourGradient cg(juce::Colour(0xff1d1b1a), 0, b.getY(), juce::Colour(0xff0e0d0c), 0, b.getBottom(), false);
    g.setGradientFill(cg);
    g.fillRoundedRectangle(b, 4);
    g.setColour(juce::Colours::white.withAlpha(hot ? 0.16f : 0.09f));
    g.drawRoundedRectangle(b.reduced(0.5f), 4, 1);
    g.setColour(hot ? hl::accent() : hl::kSilk);
    const float w = 14, x = b.getCentreX() - w / 2;
    for (int i = -1; i <= 1; ++i) g.fillRoundedRectangle(x, b.getCentreY() + i * 4.5f - 0.75f, w, 1.5f, 0.75f);
}

void MMHellEditor::ShiftValue::paint(juce::Graphics& g) {
    const auto b = getLocalBounds().toFloat();
    const auto f = hl::font(15.f, hl::Weight::Bold, 0.08f);
    hl::text(g, value, b.withHeight(20).translated(0, 0.6f), f, hl::accent().withAlpha(0.3f));
    hl::text(g, value, b.withHeight(20), f, hl::accent());
    hl::text(g, line, b.withTrimmedTop(21).withHeight(10), hl::font(6.8f, hl::Weight::Semibold, 0.2f), hl::kSilkDim);
}

void MMHellEditor::Info::paint(juce::Graphics& g) {
    auto b = getLocalBounds().toFloat();
    const auto tf = hl::font(8.5f, hl::Weight::Bold, 0.18f), vf = hl::font(8.5f, hl::Weight::Bold, 0.08f), hf = hl::font(8.f, hl::Weight::Medium, 0.03f);
    float x = b.getX();
    const auto put = [&](const juce::String& s, const juce::Font& f, juce::Colour c, float gap) {
        if (s.isEmpty()) return;
        const float w = juce::GlyphArrangement::getStringWidth(f, s) + 2;
        hl::text(g, s, {x, b.getY(), w, b.getHeight()}, f, c, juce::Justification::centredLeft);
        x += w + gap;
    };
    const float sw = status.isEmpty() ? 0 : juce::GlyphArrangement::getStringWidth(vf, status) + 16;
    hl::text(g, status, b.withTrimmedLeft(b.getWidth() - sw), hl::font(7.5f, hl::Weight::Semibold, 0.14f), hl::kSilkDim, juce::Justification::centredRight);
    put(title, tf, hl::kSilk, 10);
    put(value, vf, hl::accent(), 14);
    hl::text(g, help, {x, b.getY(), b.getRight() - sw - x - 8, b.getHeight()}, hf, hl::kSilk.withAlpha(0.62f), juce::Justification::centredLeft);
}

/* ------------------------------------------------------------------ la fenetre ------------------------------------------------------------------ */

MMHellEditor::MMHellEditor(MMHellProcessor& p) : AudioProcessorEditor(&p), proc_(p) {
    setLookAndFeel(&look_);
    setOpaque(true);
    panel_.setOpaque(true);
    addAndMakeVisible(panel_);
    const auto add = [this](juce::Component& c) { panel_.addAndMakeVisible(c); };

    // ---- DELAY ----
    delayTime_ = std::make_unique<Knob>(P(p, pid::time), 60.f, "DELAY", "5 MS", "2 S");
    delayTime_->help = "The time between repeats: 5 ms to 2 s. Raise SYNC to set it in notes, locked to the tempo of the host.";
    delayNote_ = std::make_unique<Knob>(P(p, pid::note), 60.f, "DELAY", "1/32", "1 BAR");
    delayNote_->help = "The time between repeats, in notes locked to the tempo of the host (1/32 to 1 bar). Lower SYNC for milliseconds.";
    feedback_ = std::make_unique<Knob>(P(p, pid::feedback), 60.f, "FEEDBACK", "0", "FULL");
    feedback_->help = "How much of each repeat goes back into the loop. A soft limiter holds it, even at FULL.";
    sync_ = std::make_unique<Lever>(P(p, pid::sync), "SYNC", "FREE", "SYNC");
    sync_->help = "FREE: the delay in milliseconds. SYNC: in notes, locked to the tempo of the host.";
    cross_ = std::make_unique<Lever>(P(p, pid::cross), "CROSS");
    cross_->help = "Crossed feedback: each channel goes back into the other one (with SPREAD, the echo bounces and bends).";
    hp_ = std::make_unique<Knob>(P(p, pid::hp), 44.f, "HIGH-PASS", "OFF", "4K");
    hp_->help = "In the loop: each repeat loses more lows. 20 Hz to 4 kHz, 12 dB/oct. Fully left: off.";
    lp_ = std::make_unique<Knob>(P(p, pid::lp), 44.f, "LOW-PASS", "300", "OFF");
    lp_->help = "In the loop: each repeat gets darker. 300 Hz to 20 kHz, 12 dB/oct. Fully right: off.";
    smear_ = std::make_unique<Knob>(P(p, pid::smear), 44.f, "SMEAR", "0", "FULL");
    smear_->help = "Diffusion inside the loop (four allpass filters, 3 to 11 ms): the repeats blur and soften.";
    const float dcx = (kDelayX0 + kDelayX1) / 2;
    delayTime_->placeAt(dcx - 60, 154);
    delayNote_->placeAt(dcx - 60, 154);
    feedback_->placeAt(dcx + 60, 154);
    sync_->placeAt(dcx - 60, 244);
    cross_->placeAt(dcx + 60, 244);
    hp_->placeAt(dcx - 76, 362);
    lp_->placeAt(dcx, 362);
    smear_->placeAt(dcx + 76, 362);

    // ---- FREQUENCY SHIFTER ----
    shift_ = std::make_unique<Knob>(P(p, pid::shift), 120.f, "SHIFT", juce::String(), juce::String(), true);
    shift_->help = "The Bode frequency shifter, inside the loop: each repeat is shifted once more. Right: up, left: down, centre: none. Spirals and endless stairs.";
    shift_->under = [this](juce::Graphics& g, juce::Point<float> c) { hl::paintShiftScale(g, c, range_ ? range_->index() : 0); };
    range_ = std::make_unique<KeyRow>(P(p, pid::range), "", juce::StringArray{"FINE", "WIDE", "SYNC", "MIDI"});
    range_->help = "The range of the shifter.";
    range_->optionHelp = {"+/- 3 to 200 Hz: slow spirals, chorus, dub drift.", "+/- 10 Hz to 5 kHz: metal, bells, broken radio.",
                          "Multiples of the tempo, 1/16 to 16 cycles per beat: a rhythmic barber pole.",
                          "A part of the last MIDI note received (1/16 to 2 x): route a MIDI track to MM-HELL."};
    sideband_ = std::make_unique<Knob>(P(p, pid::sideband), 44.f, "SIDEBAND", "DOWN", "UP");
    sideband_->help = "DOWN: only the band shifted down. UP: only the band shifted up. Centre (R.M.): both, a ring modulator.";
    phase_ = std::make_unique<Knob>(P(p, pid::phase), 44.f, "PHASE", juce::String::fromUTF8("0\xC2\xB0"), juce::String::fromUTF8("360\xC2\xB0"));
    phase_->help = "A fixed phase offset of the shifter's oscillator, 0 to 360 degrees. With no shift: a pure phase rotation.";
    antiRefl_ = std::make_unique<Lever>(P(p, pid::antiRefl), "ANTI REFL");
    antiRefl_->help = "ON: nothing folds back below 0 Hz when a band goes down (a high-pass just above the shift, before the shifter).";
    spread_ = std::make_unique<Knob>(P(p, pid::spread), 44.f, "SPREAD", "0", "FULL");
    spread_->help = "The right channel: its shift turns the other way (fully right: opposite), its line up to 23 ms longer, its LFO in quadrature.";
    const float scx = (kShiftX0 + kShiftX1) / 2;
    range_->placeAt(scx, kTop + 18);
    shift_->placeAt(scx, 270);
    sideband_->placeAt(kShiftX0 + 62, 204);
    phase_->placeAt(kShiftX0 + 62, 344);
    antiRefl_->placeAt(kShiftX1 - 62, 196);
    spread_->placeAt(kShiftX1 - 62, 344);
    shiftValue_.setBounds(juce::roundToInt(scx - 110), 360, 220, 34);
    shiftValue_.setInterceptsMouseClicks(false, false);

    // ---- HELL ----
    mix_ = std::make_unique<Knob>(P(p, pid::mix), 80.f, "MIX", "OFF", "FULL");
    mix_->help = "The dose of HELL. 0: bypassed, bit for bit. Half way: dry and wet both full. Presets never touch it.";
    const float hcx = (kHellX0 + kHellX1) / 2;
    mix_->placeAt(hcx, 152);
    hellLed_.setBounds(juce::roundToInt(hcx + 18), juce::roundToInt(kTop + 5), 12, 12);
    hellLed_.setInterceptsMouseClicks(false, false);
    map_.setBounds(juce::roundToInt(kHellX0 + 8), 232, juce::roundToInt(kHellX1 - kHellX0 - 8), 196);
    map_.getProperties().set("title", "ECHO MAP");
    map_.getProperties().set("help", "Where the repeats go, one after the other: their pitch (Hz, log scale) and level, for a 440 Hz tone (or the last MIDI note). "
                                     "Darkened: what the loop filters remove. Rings: folded below 0 Hz.");

    // ---- LFO ----
    shape_ = std::make_unique<KeyRow>(P(p, pid::lfoShape), "SHAPE", juce::StringArray{"SINE", "SAW", "SQUARE", "RANDOM"});
    shape_->icon = shapeIcon;
    shape_->help = "The shape of the LFO.";
    shape_->optionHelp = {"A smooth swing.", "A rising saw, then a jump.", "Flips between two values: trills and jumps.", "A new random value each cycle (sample and hold)."};
    lfoRate_ = std::make_unique<Knob>(P(p, pid::lfoRate), 54.f, "RATE", ".02", "10 HZ");
    lfoRate_->help = "The speed of the LFO: 0.02 to 10 Hz. Raise SYNC to set it in notes.";
    lfoNote_ = std::make_unique<Knob>(P(p, pid::lfoNote), 54.f, "RATE", "8 BAR", "1/32");
    lfoNote_->help = "The speed of the LFO in notes, locked to the tempo of the host: one cycle every 8 bars to every 1/32.";
    lfoSync_ = std::make_unique<Lever>(P(p, pid::lfoSync), "SYNC", "FREE", "SYNC");
    lfoSync_->help = "FREE: the rate in Hz. SYNC: in notes, locked to the tempo of the host.";
    lfoAmt_ = std::make_unique<Knob>(P(p, pid::lfoAmt), 54.f, "AMOUNT", "-", "+");
    lfoAmt_->bipolar = true;
    lfoAmt_->help = "How far the LFO moves its target, both ways. Centre: no LFO.";
    lfoStereo_ = std::make_unique<Lever>(P(p, pid::lfoStereo), "STEREO");
    lfoStereo_->help = "The LFO of the right channel a quarter cycle later: the movement spreads across the stereo field.";
    target_ = std::make_unique<KeyRow>(P(p, pid::lfoTarget), "TARGET", juce::StringArray{"FREQ", "PHASE", "LOW-PASS", "DELAY"}, 40.f, 10.f);
    target_->help = "What the LFO moves.";
    target_->optionHelp = {"The shift, up to +/- 400 Hz: sirens and trills.", "The phase of the shifter, up to +/- 180 degrees: hollow sweeps.",
                           "The loop low-pass, up to +/- 3 octaves: embers that flicker.", "The delay time, up to +/- 25 %: a melting tape."};
    shape_->placeAt(150, kLfoY0 + 22);
    lfoRate_->placeAt(302, 505);
    lfoNote_->placeAt(302, 505);
    lfoSync_->placeAt(388, 498);
    lfoAmt_->placeAt(472, 505);
    lfoStereo_->placeAt(556, 498);
    target_->placeAt(700, kLfoY0 + 22);
    vu_.setBounds(812, juce::roundToInt(kLfoY0 + 10), 144, 100);
    vu_.setInterceptsMouseClicks(false, false);
    vu_.getProperties().set("title", "LFO");
    vu_.getProperties().set("help", "The LFO, live (it rests at 0 while HELL is off).");

    // ---- la banque ----
    presets_.onLoad = [this](int i) { proc_.loadPreset(i); };
    presets_.getProperties().set("title", "PRESETS");
    presets_.getProperties().set("help", "The MM-HELL bank: 72 presets in 8 families. Click to open the list. A preset sets everything except MIX.");
    presets_.setBounds(576, 8, 284, 58);
    prev_ = std::make_unique<KeyButton>("PREV", [this] { step(-1); });
    prev_->help = "The previous preset.";
    next_ = std::make_unique<KeyButton>("NEXT", [this] { step(1); });
    next_->help = "The next preset.";
    init_ = std::make_unique<KeyButton>("INIT", [this] { proc_.loadPreset(mmhell::initIndex()); });
    init_->help = "INIT: a plain delay, no shift (MIX kept).";
    prev_->placeAt(546, 20);
    next_->placeAt(890, 20);
    init_->placeAt(938, 20);

    info_.setBounds(juce::roundToInt(kDelayX0), juce::roundToInt(kInfoY), juce::roundToInt(kHellX1 - kDelayX0), 30);
    info_.setInterceptsMouseClicks(false, false);

    // ---- le menu, en haut a gauche ----
    burger_.setBounds(46, 22, 30, 26);
    burger_.onClick = [this] { openMenu(); };
    burger_.setMouseCursor(juce::MouseCursor::PointingHandCursor);
    burger_.getProperties().set("title", "MENU");
    burger_.getProperties().set("help", "SETTINGS (leather, panel light, accent colour) and WINDOW SIZE.");
    scrim_.setBounds(0, 0, static_cast<int>(W), static_cast<int>(H));
    scrim_.onClick = [this] { showSettings(false); };
    settings_.setTopLeftPosition(40, 54);
    settings_.getProperties().set("title", "SETTINGS");
    settings_.getProperties().set("help", "The look of every MM-HELL: drag a rail, double-click for its starting value. RESET: all back.");

    for (juce::Component* c : std::initializer_list<juce::Component*>{
             delayTime_.get(), delayNote_.get(), feedback_.get(), sync_.get(), cross_.get(), hp_.get(), lp_.get(), smear_.get(), range_.get(), shift_.get(),
             sideband_.get(), phase_.get(), antiRefl_.get(), spread_.get(), mix_.get(), shape_.get(), lfoRate_.get(), lfoNote_.get(), lfoSync_.get(),
             lfoAmt_.get(), lfoStereo_.get(), target_.get(), prev_.get(), next_.get(), init_.get(), &presets_, &map_, &vu_, &shiftValue_, &hellLed_, &info_,
             &burger_})
        add(*c);
    // par-dessus tout : le voile puis le panneau, caches au depart
    panel_.addChildComponent(scrim_);
    panel_.addChildComponent(settings_);
    panel_.addMouseListener(this, true);
    lookState_->addChangeListener(this);

    // La taille : celle du projet, jamais plus grande que l'ecran ; proportions fixes
    setResizable(true, true);
    getConstrainer()->setFixedAspectRatio(static_cast<double>(W) / H);
    int maxW = MMHellProcessor::kEditorMaxW;
    if (const auto* d = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay())
        maxW = juce::jmax(MMHellProcessor::kEditorMinW, juce::jmin(maxW, d->userArea.getWidth() - 40, juce::roundToInt((d->userArea.getHeight() - 90) * W / H)));
    const int wanted = juce::jlimit(MMHellProcessor::kEditorMinW, maxW, proc_.editorWidth());
    setResizeLimits(MMHellProcessor::kEditorMinW, juce::roundToInt(MMHellProcessor::kEditorMinW * H / W), MMHellProcessor::kEditorMaxW,
                    juce::roundToInt(MMHellProcessor::kEditorMaxW * H / W));
    setSize(wanted, juce::roundToInt(wanted * H / W));
    refresh(0.f);
    lastTick_ = juce::Time::getMillisecondCounterHiRes();
    startTimerHz(30);
}

MMHellEditor::~MMHellEditor() {
    stopTimer();
    lookState_->removeChangeListener(this);
    panel_.removeMouseListener(this);
    setLookAndFeel(nullptr);
}

void MMHellEditor::paint(juce::Graphics& g) { g.fillAll(hl::kInk); }

void MMHellEditor::resized() {
    const float s = getWidth() / W;
    panel_.setBounds(0, 0, static_cast<int>(W), static_cast<int>(H));
    panel_.setTransform(juce::AffineTransform::scale(s));
    if (getWidth() >= MMHellProcessor::kEditorMinW) proc_.setEditorWidth(getWidth());
}

void MMHellEditor::changeListenerCallback(juce::ChangeBroadcaster*) {
    // LEATHER TEXTURE, PANEL LIGHT : le fond est refait ; ACCENT COLOR : tout se redessine
    panel_.bg.clear();
    panel_.repaint();
}

void MMHellEditor::showSettings(bool on) {
    scrim_.setVisible(on);
    settings_.setVisible(on);
    if (on) {
        scrim_.toFront(false);
        settings_.toFront(false);
    }
    burger_.open = on;
    burger_.repaint();
}

void MMHellEditor::setScalePercent(int pct) {
    int w = juce::roundToInt(W * pct / 100.f);
    if (const auto* d = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay())
        w = juce::jmin(w, d->userArea.getWidth() - 40, juce::roundToInt((d->userArea.getHeight() - 90) * W / H));
    w = juce::jlimit(MMHellProcessor::kEditorMinW, MMHellProcessor::kEditorMaxW, w);
    setSize(w, juce::roundToInt(w * H / W));
}

void MMHellEditor::openMenu() {
    if (settings_.isVisible()) {
        showSettings(false);
        return;
    }
    juce::PopupMenu sizes;
    const int now = juce::roundToInt(getWidth() * 100.f / W);
    for (int pct : {80, 100, 120, 150, 200}) sizes.addItem(100 + pct, juce::String(pct) + " %", true, std::abs(now - pct) <= 2);
    juce::PopupMenu m;
    m.addSectionHeader("MM-HELL");
    m.addItem(1, "SETTINGS");
    m.addSubMenu("WINDOW SIZE", sizes);
    m.addSeparator();
    m.addItem(2, "FIRMWARE V." MMHELL_VERSION " / 2026", false, false);
    burger_.open = true;
    burger_.repaint();
    juce::Component::SafePointer<MMHellEditor> safe(this);
    m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(&burger_).withMinimumWidth(170), [safe](int r) {
        if (!safe) return;
        safe->burger_.open = false;
        safe->burger_.repaint();
        if (r == 1) safe->showSettings(true);
        else if (r > 100) safe->setScalePercent(r - 100);
    });
}

void MMHellEditor::step(int d) {
    const int n = static_cast<int>(mmhell::factory().size());
    const int m = mmhell::match(proc_.patch());
    const int from = m >= 0 ? m : proc_.getCurrentProgram();
    proc_.loadPreset(((from + d) % n + n) % n);
}

void MMHellEditor::timerCallback() {
    const double now = juce::Time::getMillisecondCounterHiRes();
    const float dt = static_cast<float>((now - lastTick_) / 1000.0);
    lastTick_ = now;
    refresh(dt);
}

void MMHellEditor::refresh(float dt) {
    const auto p = proc_.patch();
    const double bpm = proc_.bpm(), note = proc_.noteHz();
    const float mix = proc_.mix();
    // les pieces doublees : la note ou le temps libre
    delayNote_->setVisible(p.sync);
    delayTime_->setVisible(!p.sync);
    lfoNote_->setVisible(p.lfoSync);
    lfoRate_->setVisible(!p.lfoSync);
    vu_.tick(proc_.lfo(), dt);
    map_.update(p, mix, bpm, note);
    presets_.set(mmhell::match(p), proc_.getCurrentProgram());
    if (hellLed_.on != (mix > 0)) {
        hellLed_.on = mix > 0;
        hellLed_.repaint();
    }
    // la valeur sous le gros potard, et l'echelle quand RANGE change
    {
        static const char* const desc[4] = {"FINE  -  +/- 3 TO 200 HZ", "WIDE  -  +/- 10 HZ TO 5 KHZ", "SYNC  -  CYCLES PER BEAT", "MIDI  -  PART OF THE PLAYED NOTE"};
        const int r = juce::jlimit(0, 3, p.range);
        juce::String v = mmhell::text::shift(p.shift, r), line = desc[r];
        const auto now = mmhell::text::shiftHzNow(p.shift, r, bpm, note);
        if (!now.empty()) line = juce::String(desc[r]).upToFirstOccurrenceOf("  -", false, false) + "  =  " + juce::String(now) +
                                 (r == 2 ? " AT " + juce::String(juce::roundToInt(bpm)) + " BPM" : note > 0 ? " ON " + juce::String(mmhell::text::noteName(note)) : juce::String());
        if (v != shiftValue_.value || line != shiftValue_.line) {
            const bool rangeChanged = shift_->getProperties()["range"] != juce::var(r);
            shiftValue_.value = v;
            shiftValue_.line = line;
            shiftValue_.repaint();
            if (rangeChanged) {
                shift_->getProperties().set("range", r);
                shift_->repaint();
            }
        }
    }
    // la bande d'info
    {
        juce::String t, v, h;
        if (auto* c = dynamic_cast<hl::Control*>(hovered_)) {
            t = c->title();
            v = c->valueText();
            h = c->help;
            if (auto* kr = dynamic_cast<KeyRow*>(c)) {
                const int k = kr->getProperties().getWithDefault("hoverKey", -1);
                if (k >= 0) h = kr->helpFor(k);
            }
        } else if (hovered_ != nullptr) {
            t = hovered_->getProperties()["title"].toString();
            h = hovered_->getProperties()["help"].toString();
        } else {
            t = "MM-HELL";
            h = "Hover a control to read what it does. Drag up or down (Shift: finer), double-click: default value.";
        }
        juce::String s = juce::String(juce::roundToInt(bpm)) + " BPM";
        if (note > 0) s << "   MIDI " << mmhell::text::noteName(note);
        if (t != info_.title || v != info_.value || h != info_.help || s != info_.status) {
            info_.title = t;
            info_.value = v;
            info_.help = h;
            info_.status = s;
            info_.repaint();
        }
    }
}

/* ------------------------------------------------------------------ la piece survolee ------------------------------------------------------------------ */

namespace {
juce::Component* describable(juce::Component* c, juce::Component* stop) {
    for (; c != nullptr && c != stop; c = c->getParentComponent())
        if (dynamic_cast<hl::Control*>(c) != nullptr || c->getProperties().contains("help")) return c;
    return nullptr;
}
} // namespace

void MMHellEditor::mouseEnter(const juce::MouseEvent& e) { hovered_ = describable(e.eventComponent, &panel_); }
void MMHellEditor::mouseMove(const juce::MouseEvent& e) { hovered_ = describable(e.eventComponent, &panel_); }
void MMHellEditor::mouseExit(const juce::MouseEvent& e) {
    if (describable(e.eventComponent, &panel_) == hovered_) hovered_ = nullptr;
}
