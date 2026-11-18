#include "PluginEditor.h"

#include <cmath>

using rl::KeyButton;
using rl::KeyRow;
using rl::KeySwitch;
using rl::Knob;
using rl::Lever;
using rl::Selector;

namespace {

constexpr float W = MMRageProcessor::kCanvasW;
constexpr float H = MMRageProcessor::kCanvasH;

// Le plan de 1000 x 620
constexpr float kX0 = 40, kX1 = 716;      // les pages
constexpr float kColX0 = 728, kColX1 = 960; // la colonne de droite (toujours la)
constexpr float kColC = (kColX0 + kColX1) / 2;
constexpr float kTop = 132, kBottom = 566;  // les pages, sous les onglets
constexpr float kInfoY = 576;

juce::StringArray arr(const char* const* n, int count) {
    juce::StringArray a;
    for (int i = 0; i < count; ++i) a.add(n[i]);
    return a;
}

// Les pictogrammes des formes du LFO, sur les touches
void shapeIcon(juce::Graphics& g, int i, juce::Rectangle<float> r) {
    juce::Path p;
    const float x0 = r.getX(), x1 = r.getRight(), y0 = r.getY(), y1 = r.getBottom(), ym = r.getCentreY(), xm = r.getCentreX();
    if (i == 0) {
        p.startNewSubPath(x0, ym);
        for (int k = 1; k <= 24; ++k) {
            const float t = k / 24.f;
            p.lineTo(x0 + t * (x1 - x0), ym - std::sin(t * juce::MathConstants<float>::twoPi) * (ym - y0));
        }
    } else if (i == 1) {
        p.startNewSubPath(x0, ym);
        p.lineTo(x0 + (x1 - x0) * 0.25f, y0);
        p.lineTo(x0 + (x1 - x0) * 0.75f, y1);
        p.lineTo(x1, ym);
    } else if (i == 2) {
        p.startNewSubPath(x0, y1);
        p.lineTo(xm, y0);
        p.lineTo(xm, y1);
        p.lineTo(x1, y0);
    } else if (i == 3) {
        p.startNewSubPath(x0, y1);
        p.lineTo(x0, y0);
        p.lineTo(xm, y0);
        p.lineTo(xm, y1);
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
    g.setColour(rl::kSilk.withAlpha(0.8f));
    g.strokePath(p, juce::PathStrokeType(1.f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
}

void caption(juce::Graphics& g, const juce::String& t, float cx, float y, float w = 160) {
    rl::text(g, t, {cx - w / 2, y, w, 10}, rl::font(7.f, rl::Weight::Bold, 0.26f), rl::kSilkDim);
}

// Un intertitre entre deux filets : ---- CLASSIC ----
void ruledCaption(juce::Graphics& g, const juce::String& t, float x0, float x1, float y) {
    const float cx = (x0 + x1) / 2;
    const float tw = juce::GlyphArrangement::getStringWidth(rl::font(7.f, rl::Weight::Bold, 0.26f), t) / 2 + 10;
    caption(g, t, cx, y - 5);
    g.setColour(rl::kLine);
    g.fillRect(x0, y, cx - tw - x0, 1.f);
    g.fillRect(cx + tw, y, x1 - cx - tw, 1.f);
}

} // namespace

template <class T, class... A>
T* MMRageEditor::make(juce::Component& parent, const std::string& id, A&&... args) {
    auto c = std::make_unique<T>(std::forward<A>(args)...);
    T* raw = c.get();
    parent.addAndMakeVisible(*raw);
    if (!id.empty()) byId_[id] = raw;
    owned_.push_back(std::move(c));
    return raw;
}

juce::Component* MMRageEditor::control(const std::string& id) const {
    const auto it = byId_.find(id);
    return it == byId_.end() ? nullptr : it->second;
}

/* ------------------------------------------------------------------ le fond ------------------------------------------------------------------ */

void MMRageEditor::Panel::paint(juce::Graphics& g) {
    const float phys = rl::physicalScale(g);
    const auto look = rl::SharedLook()->state();
    const auto& img = bg.get(W, H, phys, [look](juce::Graphics& b) {
        rl::paintPanel(b, {0, 0, W, H}, look);
        // l'en-tete : le wordmark et le nom, comme la face du MM-ARP
        rl::text(b, "MAUDITE MACHINE", {86, 20, 300, 30}, rl::logoFont(23.f), rl::kSilk.withAlpha(0.92f), juce::Justification::centredLeft);
        rl::text(b, "MM-RAGE", {352, 16, 180, 26}, rl::font(16.f, rl::Weight::Medium, 0.32f), rl::kSilk, juce::Justification::centredLeft);
        rl::text(b, "FIRMWARE V." MMRAGE_VERSION " / 2026", {353, 42, 180, 10}, rl::font(6.5f, rl::Weight::Semibold, 0.24f), rl::kSilkDim,
                 juce::Justification::centredLeft);
        // les filets : sous l'en-tete, la colonne de droite, au-dessus de la bande d'info
        rl::groove(b, {kX0, 74, kColX1 - kX0, 1});
        rl::groove(b, {(kX1 + kColX0) / 2, 84, 1, kBottom - 84});
        rl::groove(b, {kX0, kInfoY - 3, kColX1 - kX0, 1});
        // la colonne de droite : le nom du DRIVE, sous le gros potard
        rl::text(b, "DRIVE", {kColC - 60, 371, 120, 14}, rl::font(10.5f, rl::Weight::Semibold, 0.26f), rl::kSilk);
    });
    g.setOpacity(1.f);
    g.drawImage(img, juce::Rectangle<float>(0, 0, W, H));
}

void MMRageEditor::Page::paint(juce::Graphics& g) {
    if (!silk) return;
    const float phys = rl::physicalScale(g);
    const auto& img = bg.get(W, H, phys, [this](juce::Graphics& b) { silk(b); });
    g.setOpacity(1.f);
    g.drawImage(img, juce::Rectangle<float>(0, 0, W, H));
}

void MMRageEditor::Burger::paint(juce::Graphics& g) {
    const auto b = getLocalBounds().toFloat().reduced(1);
    const bool hot = isMouseOver() || open;
    g.setColour(juce::Colours::black.withAlpha(0.55f));
    g.fillRoundedRectangle(b.translated(0, 1), 4);
    juce::ColourGradient cg(juce::Colour(0xff1d1b1a), 0, b.getY(), juce::Colour(0xff0e0d0c), 0, b.getBottom(), false);
    g.setGradientFill(cg);
    g.fillRoundedRectangle(b, 4);
    g.setColour(juce::Colours::white.withAlpha(hot ? 0.16f : 0.09f));
    g.drawRoundedRectangle(b.reduced(0.5f), 4, 1);
    g.setColour(hot ? rl::accent() : rl::kSilk);
    const float w = 14, x = b.getCentreX() - w / 2;
    for (int i = -1; i <= 1; ++i) g.fillRoundedRectangle(x, b.getCentreY() + i * 4.5f - 0.75f, w, 1.5f, 0.75f);
}

void MMRageEditor::RowName::paint(juce::Graphics& g) {
    rl::text(g, name, getLocalBounds().toFloat(), rl::font(10.5f, rl::Weight::Bold, 0.24f), on ? rl::kSilk : rl::kSilkFaint, juce::Justification::centredLeft);
}

void MMRageEditor::Info::paint(juce::Graphics& g) {
    auto b = getLocalBounds().toFloat();
    const auto tf = rl::font(8.5f, rl::Weight::Bold, 0.18f), vf = rl::font(8.5f, rl::Weight::Bold, 0.08f), hf = rl::font(8.f, rl::Weight::Medium, 0.03f);
    float x = b.getX();
    const auto put = [&](const juce::String& s, const juce::Font& f, juce::Colour c, float gap) {
        if (s.isEmpty()) return;
        const float w = juce::GlyphArrangement::getStringWidth(f, s) + 2;
        rl::text(g, s, {x, b.getY(), w, b.getHeight()}, f, c, juce::Justification::centredLeft);
        x += w + gap;
    };
    const float sw = status.isEmpty() ? 0 : juce::GlyphArrangement::getStringWidth(vf, status) + 16;
    rl::text(g, status, b.withTrimmedLeft(b.getWidth() - sw), rl::font(7.5f, rl::Weight::Semibold, 0.14f), rl::kSilkDim, juce::Justification::centredRight);
    put(title, tf, rl::kSilk, 10);
    put(value, vf, rl::accent(), 14);
    rl::text(g, help, {x, b.getY(), b.getRight() - sw - x - 8, b.getHeight()}, hf, rl::kSilk.withAlpha(0.62f), juce::Justification::centredLeft);
}

/* ------------------------------------------------------------------ la fenetre ------------------------------------------------------------------ */

MMRageEditor::MMRageEditor(MMRageProcessor& p)
    : AudioProcessorEditor(&p), proc_(p), tabs_(juce::StringArray{"RAGE", "SHAPE", "BANDS", "MOVE"}) {
    setLookAndFeel(&look_);
    setOpaque(true);
    panel_.setOpaque(true);
    addAndMakeVisible(panel_);
    for (auto& pg : pages_) {
        pg.setBounds(0, 0, static_cast<int>(W), static_cast<int>(H));
        pg.setInterceptsMouseClicks(false, true);
        panel_.addChildComponent(pg);
    }
    auto& col = panel_;
    auto& rage = pages_[0];
    auto& shape = pages_[1];
    auto& bands = pages_[2];
    auto& move = pages_[3];
    namespace m = mmrage;

    /* ---------------- la colonne de droite : ATTITUDE, DRIVE, PUNISH, AUTO, MIX, OUTPUT ---------------- */
    vu_.setBounds(juce::roundToInt(kColC - 98), 84, 196, 137);
    vu_.setInterceptsMouseClicks(false, false);
    vu_.getProperties().set("title", "ATTITUDE");
    vu_.getProperties().set("help", "How hard the signal hits the curves: -20 to +3 dB. In the red, the saturation bites.");
    col.addAndMakeVisible(vu_);
    drive_ = make<Knob>(col, pid::drive, P(pid::drive), 100.f, "DRIVE", "", "", true);
    drive_->help = "How hard the signal is pushed into the saturation: 0 to +36 dB (PUNISH: +20 dB more). AUTO keeps the level.";
    drive_->heroMark = [this](int i) { return juce::String(i * 6 + (proc_.patch().punish ? 20 : 0)); };
    drive_->placeAt(kColC, 304);
    auto* punish = make<Lever>(col, pid::punish, P(pid::punish), "PUNISH");
    punish->help = "+20 dB of DRIVE: the curves are slammed (the scale around DRIVE moves to 20..56 dB).";
    punish->placeAt(kColC - 54, 412);
    auto* autoG = make<Lever>(col, pid::autoGain, P(pid::autoGain), "AUTO");
    autoG->help = "AUTO: the output follows DRIVE down, the level stays about the same. OFF: more DRIVE, more level.";
    autoG->placeAt(kColC + 54, 412);
    auto* mix = make<Knob>(col, pid::mix, P(pid::mix), 58.f, "MIX", "DRY", "WET");
    mix->help = "Dry and wet, in phase (the dry is delayed like the wet). 0: the dry alone, bit for bit.";
    mix->placeAt(kColC - 54, 500);
    auto* out = make<Knob>(col, pid::out, P(pid::out), 58.f, "OUTPUT", "-18", "+18");
    out->bipolar = true;
    out->help = "The output level, -18 to +18 dB.";
    out->placeAt(kColC + 54, 500);

    /* ---------------- les onglets ---------------- */
    tabs_.setTopLeftPosition(juce::roundToInt((kX0 + kX1) / 2 - tabs_.getWidth() / 2.f), 80);
    tabs_.onSelect = [this](int i) { showPage(i); };
    tabs_.getProperties().set("title", "PAGES");
    tabs_.getProperties().set("help", "RAGE: the core. SHAPE: filters, box, dynamics, feedback. BANDS: multiband. MOVE: envelope and LFO.");
    col.addAndMakeVisible(tabs_);

    /* ---------------- RAGE : STYLE, TRANSFER, MORPH, TONE ---------------- */
    {
        const float sx = 208;
        auto* classic = make<KeyRow>(rage, "styleClassic", P(pid::style), "", juce::StringArray{"A", "E", "N", "T", "P"}, 38.f, 8.f, 0);
        classic->help = "The classic styles.";
        classic->optionHelp = {"A tube tape preamp: soft, warm, even harmonics.", "A transistor console: a harder knee, odd, crisp highs.",
                               "A class A transformer input: the lows saturate first, thick.", "A triode: very asymmetric, even, the grain.",
                               "A pentode: hard, buzzing, odd, the highs held."};
        classic->placeAt(sx, 160);
        auto* ext = make<KeyRow>(rage, "styleExtended", P(pid::style), "", juce::StringArray{"TAPE", "FUZZ", "DIODE", "AMP", "RECT", "FOLD", "CRUSH"}, 38.f, 8.f, 5);
        ext->help = "The extended styles.";
        ext->optionHelp = {"Tape: a soft arctangent, the highs pre-emphasised.", "Fuzz: a very hard, offset knee; the lows hollowed.",
                           "Diode: a straight hard clip.", "Guitar amp: asymmetric, the mids pushed, the highs cut at 7 kHz.",
                           "Rectifier: the negative half flips up, an octave above grows with the level.", "Wavefolder: the peaks fold back instead of flattening.",
                           "Bit crusher: twelve coarse steps, then a hard clip."};
        ext->placeAt(sx, 222);
        transfer_.setBounds(400, 140, 312, 140);
        transfer_.setInterceptsMouseClicks(false, false);
        transfer_.getProperties().set("title", "TRANSFER");
        transfer_.getProperties().set("help", "The curve of the moment (style, MORPH, DRIVE), its target in grey; the style, the drive and the level in clear.");
        rage.addAndMakeVisible(transfer_);
        auto* morph = make<Knob>(rage, pid::morph, P(pid::morph), 62.f, "MORPH", "0", "100");
        morph->help = "Slides the curve from the style toward MORPH TO (its emphasis and its AUTO too).";
        morph->placeAt(140, 378);
        auto* morphTo = make<Selector>(rage, pid::morphTo, P(pid::morphTo), "MORPH TO", arr(m::kStyleNames, m::kStyles), 108.f, 26.f);
        morphTo->longName = [](int i) { return juce::String(mmrage::kStyleLong[juce::jlimit(0, 11, i)]); };
        morphTo->help = "The style MORPH slides toward. Click for the list, wheel or drag for the next one.";
        morphTo->placeAt(140, 470);
        auto* low = make<Knob>(rage, pid::low, P(pid::low), 58.f, "LOW CUT", "OFF", "1K");
        low->help = "Before the saturation: cuts the lows, 20 Hz to 1 kHz, 12 dB/oct. Fully left: off.";
        low->placeAt(330, 380);
        auto* thump = make<Lever>(rage, pid::thump, P(pid::thump), "THUMP");
        thump->help = "A resonant bump at the LOW CUT frequency: the cut keeps its punch.";
        thump->placeAt(330, 494);
        auto* tone = make<Knob>(rage, pid::tone, P(pid::tone), 68.f, "TONE", "DARK", "BRIGHT");
        tone->bipolar = true;
        tone->help = "Tilts the sound into the saturation around 700 Hz, +/- 6 dB: dark grit or bright bite.";
        tone->placeAt(486, 382);
        auto* high = make<Knob>(rage, pid::high, P(pid::high), 58.f, "HIGH CUT", "1K", "OFF");
        high->help = "After the saturation: rounds the highs, 1 to 20 kHz. Fully right: off.";
        high->placeAt(642, 380);
        auto* steep = make<Lever>(rage, pid::steep, P(pid::steep), "STEEP");
        steep->help = "HIGH CUT at 30 dB/oct instead of 6: a wall.";
        steep->placeAt(642, 494);
        rage.silk = [sx](juce::Graphics& g) {
            rl::sectionTitle(g, "STYLE", sx, kTop + 4);
            ruledCaption(g, "CLASSIC", sx - 118, sx + 118, 154);
            ruledCaption(g, "EXTENDED", sx - 160, sx + 160, 216);
            rl::groove(g, {kX0 + 8, 296, kX1 - kX0 - 16, 1});
            rl::sectionTitle(g, "MORPH", 140, 306);
            rl::sectionTitle(g, "TONE", 486, 306);
            rl::groove(g, {250, 306, 1, kBottom - 316});
        };
    }

    /* ---------------- SHAPE : PRE FILTER, BOX, POST FILTER, DYNAMICS, FEEDBACK ---------------- */
    {
        const float c1 = 148, c2 = 376, c3 = 604;
        const juce::StringArray filt = arr(m::kFilterNames, 5);
        const juce::StringArray filtHelp = {"Off.", "Low-pass: the highs removed.", "Band-pass: a narrow band kept.", "High-pass: the lows removed.",
                                            "Peak: a +12 dB bell, pushed into the saturation."};
        auto* preMode = make<KeyRow>(shape, pid::preMode, P(pid::preMode), "", filt, 30.f, 8.f);
        preMode->help = "A filter BEFORE the saturation: it decides what distorts.";
        preMode->optionHelp = filtHelp;
        preMode->placeAt(c1, 156);
        auto* preFreq = make<Knob>(shape, pid::preFreq, P(pid::preFreq), 50.f, "FREQ", "20", "20K");
        preFreq->help = "PRE FILTER frequency, 20 Hz to 20 kHz.";
        preFreq->placeAt(c1 - 48, 262);
        auto* preReso = make<Knob>(shape, pid::preReso, P(pid::preReso), 50.f, "RESO", "0", "MAX");
        preReso->help = "PRE FILTER resonance, Q 0.71 to 11.";
        preReso->placeAt(c1 + 48, 262);
        auto* box = make<KeyRow>(shape, pid::box, P(pid::box), "", arr(m::kBoxNames, 5), 30.f, 8.f);
        box->help = "A short box after the saturation (filters and a resonance of a few ms).";
        box->optionHelp = {"Off.", "A small speaker: narrow, honky.", "A combo amp: open mids.", "A 4x12 stack: deep, a low bump.", "A radio: thin, nasal."};
        box->placeAt(c2, 156);
        auto* boxSize = make<Knob>(shape, pid::boxSize, P(pid::boxSize), 50.f, "SIZE", "-", "+");
        boxSize->bipolar = true;
        boxSize->help = "Makes the box bigger (lower) or smaller (higher), +/- 0.6 octave.";
        boxSize->placeAt(c2 - 48, 262);
        auto* boxMix = make<Knob>(shape, pid::boxMix, P(pid::boxMix), 50.f, "MIX", "0", "100");
        boxMix->help = "How much of the box.";
        boxMix->placeAt(c2 + 48, 262);
        auto* postMode = make<KeyRow>(shape, pid::postMode, P(pid::postMode), "", filt, 30.f, 8.f);
        postMode->help = "A filter AFTER the saturation: it shapes the result.";
        postMode->optionHelp = filtHelp;
        postMode->placeAt(c3, 156);
        auto* postFreq = make<Knob>(shape, pid::postFreq, P(pid::postFreq), 50.f, "FREQ", "20", "20K");
        postFreq->help = "POST FILTER frequency, 20 Hz to 20 kHz.";
        postFreq->placeAt(c3 - 48, 262);
        auto* postReso = make<Knob>(shape, pid::postReso, P(pid::postReso), 50.f, "RESO", "0", "MAX");
        postReso->help = "POST FILTER resonance, Q 0.71 to 11.";
        postReso->placeAt(c3 + 48, 262);
        auto* dyn = make<Knob>(shape, pid::dyn, P(pid::dyn), 62.f, "DYNAMICS", "COMP", "EXPAND");
        dyn->bipolar = true;
        dyn->help = "Left: the wet is compressed (the loud parts come down). Right: expanded (the hits jump out). Up to 12 dB.";
        dyn->placeAt(118, 446);
        auto* fb = make<Knob>(shape, pid::fb, P(pid::fb), 58.f, "FEEDBACK", "0", "MAX");
        fb->help = "The wet comes back into the saturation through a band-pass: it rings, sings, howls. Stable even at max.";
        fb->placeAt(250, 446);
        auto* fbFreq = make<Knob>(shape, pid::fbFreq, P(pid::fbFreq), 46.f, "FB FREQ", "40", "1.2K");
        fbFreq->help = "The note the feedback rings at, 40 Hz to 1.2 kHz.";
        fbFreq->placeAt(350, 446);
        response_.setBounds(408, 352, 304, 208);
        response_.setInterceptsMouseClicks(false, false);
        response_.getProperties().set("title", "RESPONSE");
        response_.getProperties().set("help", "The frequency response of the PRE FILTER (grey), the BOX (cream) and the POST FILTER (accent).");
        shape.addAndMakeVisible(response_);
        shape.silk = [c1, c2, c3](juce::Graphics& g) {
            rl::sectionTitle(g, "PRE FILTER", c1, kTop + 4);
            rl::sectionTitle(g, "BOX", c2, kTop + 4);
            rl::sectionTitle(g, "POST FILTER", c3, kTop + 4);
            rl::groove(g, {(c1 + c2) / 2, kTop + 6, 1, 196});
            rl::groove(g, {(c2 + c3) / 2, kTop + 6, 1, 196});
            rl::groove(g, {kX0 + 8, 342, kX1 - kX0 - 16, 1});
            rl::sectionTitle(g, "DYNAMICS", 118, 352);
            rl::sectionTitle(g, "FEEDBACK", 300, 352);
            rl::groove(g, {184, 356, 1, 196});
        };
    }

    /* ---------------- BANDS : BANDS, les coupures, la carte, la matrice ---------------- */
    {
        auto* nb = make<KeyRow>(bands, pid::bands, P(pid::bands), "BANDS", arr(m::kBandsNames, 3), 34.f, 8.f);
        nb->help = "1: one band, the whole page. 2 or 3: the sound is split (Linkwitz-Riley, 24 dB/oct), each band with its own drive.";
        nb->optionHelp = {"One band: the plain RAGE.", "Two bands: LOW and HIGH, split at XOVER LOW.", "Three bands: LOW, MID, HIGH."};
        nb->placeAt(124, 140);
        auto* xLo = make<Knob>(bands, pid::xLo, P(pid::xLo), 44.f, "LOW / MID", "40", "1K");
        xLo->help = "The split between LOW and the band above, 40 Hz to 1 kHz. Also draggable on the map.";
        xLo->placeAt(84, 238);
        auto* xHi = make<Knob>(bands, pid::xHi, P(pid::xHi), 44.f, "MID / HIGH", "600", "15K");
        xHi->help = "The split between MID and HIGH, 600 Hz to 15 kHz (three bands). Also draggable on the map.";
        xHi->placeAt(166, 238);
        bandMap_ = std::make_unique<rl::BandMap>(P(pid::xLo), P(pid::xHi));
        bandMap_->setBounds(222, 138, 490, 136);
        bandMap_->getProperties().set("title", "BAND MAP");
        bandMap_->getProperties().set("help", "The bands, their style and drive. Drag a split to move it.");
        bands.addAndMakeVisible(*bandMap_);
        byId_["bandMap"] = bandMap_.get();
        const float cy[3] = {340, 424, 508};
        const float xs = 196, xd = 300, xm = 380, xl = 460, xso = 560, xby = 636;
        for (int b = 0; b < 3; ++b) {
            auto& rn = rowNames_[static_cast<size_t>(b)];
            rn.setBounds(52, juce::roundToInt(cy[b] - 9), 80, 18);
            rn.setInterceptsMouseClicks(false, false);
            bands.addAndMakeVisible(rn);
            const auto id = [b](const char* w) { return pid::band(b, w); };
            auto* st = make<Selector>(bands, id("Style"), P(id("Style")), "STYLE", arr(m::kBandStyleNames, m::kStyles + 1), 100.f, 24.f);
            st->showName = false;
            st->longName = [](int i) { return i == 0 ? juce::String("THE PAGE STYLE AND ITS MORPH") : juce::String(mmrage::kStyleLong[juce::jlimit(0, 11, i - 1)]); };
            st->help = "The style of this band. MAIN: the style of the RAGE page, with its MORPH.";
            st->placeAt(xs, cy[b] - 15);
            auto* dr = make<Knob>(bands, id("Drive"), P(id("Drive")), 38.f, "DRIVE");
            dr->showName = false;
            dr->bipolar = true;
            dr->help = "This band's drive, +/- 18 dB around DRIVE.";
            dr->placeAt(xd, cy[b]);
            auto* mx = make<Knob>(bands, id("Mix"), P(id("Mix")), 38.f, "MIX");
            mx->showName = false;
            mx->help = "Dry and wet of this band.";
            mx->placeAt(xm, cy[b]);
            auto* lv = make<Knob>(bands, id("Level"), P(id("Level")), 38.f, "LEVEL");
            lv->showName = false;
            lv->bipolar = true;
            lv->help = "The level of this band, +/- 12 dB.";
            lv->placeAt(xl, cy[b]);
            auto* so = make<KeySwitch>(bands, id("Solo"), P(id("Solo")), "SOLO", "", 30.f);
            so->help = "Hear this band alone (several can be soloed).";
            so->placeAt(xso, cy[b] - 16);
            auto* by = make<KeySwitch>(bands, id("Byp"), P(id("Byp")), "BYPASS", "", 30.f);
            by->help = "This band passes without saturation.";
            by->placeAt(xby, cy[b] - 16);
        }
        bands.silk = [=](juce::Graphics& g) {
            rl::groove(g, {kX0 + 8, 288, kX1 - kX0 - 16, 1});
            const float y = 296;
            caption(g, "BAND", 72, y, 60);
            caption(g, "STYLE", xs, y);
            caption(g, "DRIVE", xd, y);
            caption(g, "MIX", xm, y);
            caption(g, "LEVEL", xl, y);
            caption(g, "SOLO", xso, y);
            caption(g, "BYP", xby, y);
            for (int b = 0; b < 2; ++b) {
                g.setColour(rl::kLine.withMultipliedAlpha(0.5f));
                g.fillRect(kX0 + 8, (cy[b] + cy[b + 1]) / 2 + 4, kX1 - kX0 - 16, 1.f);
            }
        };
    }

    /* ---------------- MOVE : ENVELOPE -> DRIVE, LFO ---------------- */
    {
        auto* envAmt = make<Knob>(move, pid::envAmt, P(pid::envAmt), 66.f, "AMOUNT", "LESS", "MORE");
        envAmt->bipolar = true;
        envAmt->help = "The input's envelope moves DRIVE, up to +/- 24 dB. Right: the louder, the dirtier. Left: loud stays clean, tails get dirty.";
        envAmt->placeAt(140, 236);
        auto* envSpd = make<Knob>(move, pid::envSpeed, P(pid::envSpeed), 52.f, "SPEED", "FAST", "SLOW");
        envSpd->help = "The envelope's attack (1 to 30 ms) and release (30 ms to 0.9 s).";
        envSpd->placeAt(140, 396);
        auto* shapeK = make<KeyRow>(move, pid::lfoShape, P(pid::lfoShape), "SHAPE", arr(m::kShapeNames, 5), 38.f, 8.f);
        shapeK->icon = shapeIcon;
        shapeK->help = "The shape of the LFO.";
        shapeK->optionHelp = {"A smooth swing.", "A triangle: straight up, straight down.", "A rising saw, then a jump.", "Flips between two values: gates and jumps.",
                              "A new random value each cycle (smoothed a little)."};
        shapeK->placeAt(380, 150);
        auto* sync = make<Lever>(move, pid::lfoSync, P(pid::lfoSync), "SYNC", "FREE", "SYNC");
        sync->help = "FREE: the rate in Hz. SYNC: in notes, locked to the tempo of the host.";
        sync->placeAt(620, 176);
        lfoRate_ = make<Knob>(move, pid::lfoRate, P(pid::lfoRate), 56.f, "RATE", ".02", "10 HZ");
        lfoRate_->help = "The speed of the LFO: 0.02 to 10 Hz. Raise SYNC to set it in notes.";
        lfoRate_->placeAt(318, 282);
        lfoNote_ = make<Knob>(move, pid::lfoNote, P(pid::lfoNote), 56.f, "RATE", "8 BAR", "1/32");
        lfoNote_->help = "The speed of the LFO in notes, locked to the tempo: one cycle every 8 bars to every 1/32.";
        lfoNote_->placeAt(318, 282);
        auto* amt = make<Knob>(move, pid::lfoAmt, P(pid::lfoAmt), 56.f, "AMOUNT", "-", "+");
        amt->bipolar = true;
        amt->help = "How far the LFO moves its target, both ways. Centre: no LFO.";
        amt->placeAt(428, 282);
        auto* tgt = make<KeyRow>(move, pid::lfoTarget, P(pid::lfoTarget), "TARGET", arr(m::kTargetNames, 6), 30.f, 6.f);
        tgt->help = "What the LFO moves.";
        tgt->optionHelp = {"DRIVE, +/- 18 dB: wobble, pump, gate the grit.", "MORPH, +/- 50 %: the curve shifts between the two styles.",
                           "TONE, the whole course: the colour sweeps.", "The PRE FILTER frequency, +/- 2 octaves: a wah before the drive.",
                           "The POST FILTER frequency, +/- 2 octaves: a filter sweep after.", "MIX, +/- 50 %: the dirt comes and goes."};
        tgt->placeAt(598, 250);
        motion_.setBounds(268, 356, 444, 204);
        motion_.setInterceptsMouseClicks(false, false);
        motion_.getProperties().set("title", "LFO");
        motion_.getProperties().set("help", "The LFO over one bar at the tempo of the host: its shape, its depth and what it moves.");
        move.addAndMakeVisible(motion_);
        move.silk = [](juce::Graphics& g) {
            rl::sectionTitle(g, juce::String::fromUTF8("ENVELOPE  \xE2\x86\x92  DRIVE"), 140, kTop + 4);
            rl::sectionTitle(g, "LFO", 490, kTop + 4);
            rl::groove(g, {250, kTop + 6, 1, kBottom - kTop - 14});
        };
    }

    /* ---------------- la banque ---------------- */
    presets_.onLoad = [this](int i) { proc_.loadPreset(i); };
    presets_.getProperties().set("title", "PRESETS");
    presets_.getProperties().set("help", "The MM-RAGE bank: 85 presets in 9 families. Click to open the list. A preset sets the whole RAGE, DRIVE and MIX included.");
    presets_.setBounds(576, 8, 284, 58);
    prev_ = std::make_unique<KeyButton>("PREV", [this] { step(-1); });
    prev_->help = "The previous preset.";
    next_ = std::make_unique<KeyButton>("NEXT", [this] { step(1); });
    next_->help = "The next preset.";
    init_ = std::make_unique<KeyButton>("INIT", [this] { proc_.loadPreset(mmrage::initIndex()); });
    init_->help = "INIT: style A, a quarter of DRIVE, everything else at rest.";
    prev_->placeAt(546, 20);
    next_->placeAt(890, 20);
    init_->placeAt(938, 20);
    for (juce::Component* c : std::initializer_list<juce::Component*>{prev_.get(), next_.get(), init_.get(), &presets_}) panel_.addAndMakeVisible(*c);

    info_.setBounds(juce::roundToInt(kX0), juce::roundToInt(kInfoY), juce::roundToInt(kColX1 - kX0), 30);
    info_.setInterceptsMouseClicks(false, false);
    panel_.addAndMakeVisible(info_);

    // ---- le menu, en haut a gauche ----
    burger_.setBounds(46, 22, 30, 26);
    burger_.onClick = [this] { openMenu(); };
    burger_.setMouseCursor(juce::MouseCursor::PointingHandCursor);
    burger_.getProperties().set("title", "MENU");
    burger_.getProperties().set("help", "SETTINGS (leather, panel light, accent colour) and WINDOW SIZE.");
    panel_.addAndMakeVisible(burger_);
    scrim_.setBounds(0, 0, static_cast<int>(W), static_cast<int>(H));
    scrim_.onClick = [this] { showSettings(false); };
    settings_.setTopLeftPosition(40, 54);
    settings_.getProperties().set("title", "SETTINGS");
    settings_.getProperties().set("help", "The look of every MM-RAGE: drag a rail, double-click for its starting value. RESET: all back.");
    panel_.addChildComponent(scrim_);
    panel_.addChildComponent(settings_);
    panel_.addMouseListener(this, true);
    lookState_->addChangeListener(this);

    showPage(proc_.page());

    // La taille : celle du projet, jamais plus grande que l'ecran ; proportions fixes
    setResizable(true, true);
    getConstrainer()->setFixedAspectRatio(static_cast<double>(W) / H);
    int maxW = MMRageProcessor::kEditorMaxW;
    if (const auto* d = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay())
        maxW = juce::jmax(MMRageProcessor::kEditorMinW, juce::jmin(maxW, d->userArea.getWidth() - 40, juce::roundToInt((d->userArea.getHeight() - 90) * W / H)));
    const int wanted = juce::jlimit(MMRageProcessor::kEditorMinW, maxW, proc_.editorWidth());
    setResizeLimits(MMRageProcessor::kEditorMinW, juce::roundToInt(MMRageProcessor::kEditorMinW * H / W), MMRageProcessor::kEditorMaxW,
                    juce::roundToInt(MMRageProcessor::kEditorMaxW * H / W));
    setSize(wanted, juce::roundToInt(wanted * H / W));
    refresh(0.f);
    lastTick_ = juce::Time::getMillisecondCounterHiRes();
    startTimerHz(30);
}

MMRageEditor::~MMRageEditor() {
    stopTimer();
    lookState_->removeChangeListener(this);
    panel_.removeMouseListener(this);
    setLookAndFeel(nullptr);
}

void MMRageEditor::paint(juce::Graphics& g) { g.fillAll(rl::kInk); }

void MMRageEditor::resized() {
    const float s = getWidth() / W;
    panel_.setBounds(0, 0, static_cast<int>(W), static_cast<int>(H));
    panel_.setTransform(juce::AffineTransform::scale(s));
    if (getWidth() >= MMRageProcessor::kEditorMinW) proc_.setEditorWidth(getWidth());
}

void MMRageEditor::changeListenerCallback(juce::ChangeBroadcaster*) {
    // LEATHER TEXTURE, PANEL LIGHT : le fond est refait ; ACCENT COLOR : tout se redessine
    panel_.bg.clear();
    for (auto& pg : pages_) pg.bg.clear();
    panel_.repaint();
}

void MMRageEditor::showPage(int i) {
    page_ = juce::jlimit(0, MMRageProcessor::kPages - 1, i);
    for (int k = 0; k < MMRageProcessor::kPages; ++k) pages_[static_cast<size_t>(k)].setVisible(k == page_);
    tabs_.setCurrent(page_);
    proc_.setPage(page_);
    hovered_ = nullptr;
}

void MMRageEditor::showSettings(bool on) {
    scrim_.setVisible(on);
    settings_.setVisible(on);
    if (on) {
        scrim_.toFront(false);
        settings_.toFront(false);
    }
    burger_.open = on;
    burger_.repaint();
}

void MMRageEditor::setScalePercent(int pct) {
    int w = juce::roundToInt(W * pct / 100.f);
    if (const auto* d = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay())
        w = juce::jmin(w, d->userArea.getWidth() - 40, juce::roundToInt((d->userArea.getHeight() - 90) * W / H));
    w = juce::jlimit(MMRageProcessor::kEditorMinW, MMRageProcessor::kEditorMaxW, w);
    setSize(w, juce::roundToInt(w * H / W));
}

void MMRageEditor::openMenu() {
    if (settings_.isVisible()) {
        showSettings(false);
        return;
    }
    juce::PopupMenu sizes;
    const int now = juce::roundToInt(getWidth() * 100.f / W);
    for (int pct : {80, 100, 120, 150, 200}) sizes.addItem(100 + pct, juce::String(pct) + " %", true, std::abs(now - pct) <= 2);
    juce::PopupMenu m;
    m.addSectionHeader("MM-RAGE");
    m.addItem(1, "SETTINGS");
    m.addSubMenu("WINDOW SIZE", sizes);
    m.addSeparator();
    m.addItem(2, "FIRMWARE V." MMRAGE_VERSION " / 2026", false, false);
    burger_.open = true;
    burger_.repaint();
    juce::Component::SafePointer<MMRageEditor> safe(this);
    m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(&burger_).withMinimumWidth(170), [safe](int r) {
        if (!safe) return;
        safe->burger_.open = false;
        safe->burger_.repaint();
        if (r == 1)
            safe->showSettings(true);
        else if (r > 100)
            safe->setScalePercent(r - 100);
    });
}

void MMRageEditor::step(int d) {
    const int n = static_cast<int>(mmrage::factory().size());
    const int m = mmrage::match(proc_.patch());
    const int from = m >= 0 ? m : proc_.getCurrentProgram();
    proc_.loadPreset(((from + d) % n + n) % n);
}

void MMRageEditor::timerCallback() {
    const double now = juce::Time::getMillisecondCounterHiRes();
    const float dt = static_cast<float>((now - lastTick_) / 1000.0);
    lastTick_ = now;
    refresh(dt);
}

void MMRageEditor::refresh(float dt) {
    const auto p = proc_.patch();
    const double bpm = proc_.bpm();
    vu_.tick(proc_.attitudeDb(), dt);
    presets_.set(mmrage::match(p), proc_.getCurrentProgram());
    // le DRIVE : son echelle suit PUNISH
    if (drive_->getProperties()["punish"] != juce::var(p.punish)) {
        drive_->getProperties().set("punish", p.punish);
        drive_->repaint();
    }
    // les pieces doublees (la vitesse libre ou en notes) et ce qui est grise
    lfoNote_->setVisible(p.lfoSync);
    lfoRate_->setVisible(!p.lfoSync);
    const auto inert = [&](const std::string& id, bool on) {
        if (auto* c = dynamic_cast<rl::Control*>(control(id))) c->setInert(on);
    };
    inert(pid::morphTo, mmrage::inert(p, "morphTo"));
    inert(pid::fbFreq, mmrage::inert(p, "fbFreq"));
    inert(pid::xLo, mmrage::inert(p, "xLo"));
    inert(pid::xHi, mmrage::inert(p, "xHi"));
    inert(pid::envSpeed, mmrage::inert(p, "envSpeed"));
    for (const char* id : {pid::lfoShape, pid::lfoSync, pid::lfoRate, pid::lfoNote, pid::lfoTarget}) inert(id, mmrage::inert(p, "lfo"));
    for (const char* id : {pid::preFreq, pid::preReso}) inert(id, mmrage::inert(p, "pre"));
    for (const char* id : {pid::postFreq, pid::postReso}) inert(id, mmrage::inert(p, "post"));
    for (const char* id : {pid::boxSize, pid::boxMix}) inert(id, mmrage::inert(p, "box"));
    static const char* const rowLabels3[3] = {"LOW", "MID", "HIGH"};
    for (int b = 0; b < 3; ++b) {
        const bool off = mmrage::inert(p, "b" + std::to_string(b + 1));
        for (const char* w : {"Style", "Drive", "Mix", "Level", "Solo", "Byp"}) inert(pid::band(b, w), off);
        auto& rn = rowNames_[static_cast<size_t>(b)];
        const juce::String nm = p.bands == 2 ? (b == 0 ? "LOW" : b == 1 ? "HIGH" : "-") : juce::String(rowLabels3[b]);
        if (rn.name != nm || rn.on != !off) {
            rn.name = nm;
            rn.on = !off;
            rn.repaint();
        }
    }
    transfer_.update(p);
    if (bandMap_) bandMap_->update(p);
    response_.update(p);
    motion_.update(p, bpm);
    // la bande d'info
    {
        juce::String t, v, h;
        if (auto* c = dynamic_cast<rl::Control*>(hovered_)) {
            t = c->title();
            v = c->valueText();
            h = c->help;
            if (auto* kr = dynamic_cast<KeyRow*>(c)) {
                const int k = kr->getProperties().getWithDefault("hoverKey", -1);
                if (k >= 0) h = kr->helpFor(k);
            }
            if (c->inert()) h = "(No effect as set.) " + h;
        } else if (hovered_ != nullptr) {
            t = hovered_->getProperties()["title"].toString();
            h = hovered_->getProperties()["help"].toString();
        } else {
            t = "MM-RAGE";
            h = "Hover a control to read what it does. Drag up or down (Shift: finer), double-click: default value.";
        }
        const juce::String s = juce::String(juce::roundToInt(bpm)) + " BPM";
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
        if (dynamic_cast<rl::Control*>(c) != nullptr || c->getProperties().contains("help")) return c;
    return nullptr;
}
} // namespace

void MMRageEditor::mouseEnter(const juce::MouseEvent& e) { hovered_ = describable(e.eventComponent, &panel_); }
void MMRageEditor::mouseMove(const juce::MouseEvent& e) { hovered_ = describable(e.eventComponent, &panel_); }
void MMRageEditor::mouseExit(const juce::MouseEvent& e) {
    if (describable(e.eventComponent, &panel_) == hovered_) hovered_ = nullptr;
}
