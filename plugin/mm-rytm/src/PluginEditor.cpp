#include "PluginEditor.h"

namespace {

const juce::Colour kBg(0xff191919);
const juce::Colour kPanel(0xff232323);
const juce::Colour kCream(0xfff6f1e7);
const juce::Colour kDim(0xff4a4a4a);
const juce::Colour kAccent(0xffe8452c);

constexpr int kW = 1060;
constexpr int kH = 580;
constexpr int kGridX = 150;
constexpr int kGridY = 84;
constexpr int kRowH = 54;
constexpr int kStepW = 26;
constexpr int kStepGap = 4;
constexpr int kGroupGap = 8;
constexpr int kPanelX = 676;

struct KnobDef {
    const char* key;
    const char* label;
};
const KnobDef kKnobs[] = {{"syn", "SYNTH"}, {"tune", "TUNE"}, {"decay", "DECAY"}, {"tone", "TONE"},          {"attack", "ATTACK"},
                          {"drive", "DRIVE"}, {"snappy", "SNAPPY"}, {"sweep", "SWEEP"}, {"stretch", "STRETCH"}, {"smpLev", "SMP LEV"},
                          {"smpTune", "SMP TUNE"}, {"smpStart", "START"}, {"smpLen", "LENGTH"}, {"level", "LEVEL"}, {"pan", "PAN"}};
const KnobDef kToggles[] = {{"smpRev", "REV"}, {"gate", "GATE"}, {"mute", "MUTE"}};
const KnobDef kCombos[] = {{"machine", "MACHINE"}, {"sample", "SAMPLE"}, {"out", "OUTPUT"}};

void styleKnob(juce::Slider& s, juce::Label& l, const char* text) {
    s.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    s.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 64, 16);
    s.setColour(juce::Slider::rotarySliderFillColourId, kAccent);
    s.setColour(juce::Slider::rotarySliderOutlineColourId, kDim);
    s.setColour(juce::Slider::thumbColourId, kCream);
    s.setColour(juce::Slider::textBoxTextColourId, kCream);
    s.setColour(juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    l.setText(text, juce::dontSendNotification);
    l.setJustificationType(juce::Justification::centred);
    l.setColour(juce::Label::textColourId, kCream.withAlpha(0.7f));
    l.setFont(juce::FontOptions(11.f, juce::Font::bold));
}

} // namespace

MMRytmEditor::MMRytmEditor(MMRytmProcessor& p) : AudioProcessorEditor(&p), proc_(p) {
    laf_.setColour(juce::ComboBox::backgroundColourId, kPanel.brighter(0.08f));
    laf_.setColour(juce::ComboBox::textColourId, kCream);
    laf_.setColour(juce::ComboBox::outlineColourId, kDim);
    laf_.setColour(juce::ComboBox::arrowColourId, kCream);
    laf_.setColour(juce::PopupMenu::backgroundColourId, kPanel);
    laf_.setColour(juce::PopupMenu::textColourId, kCream);
    laf_.setColour(juce::PopupMenu::highlightedBackgroundColourId, kAccent);
    laf_.setColour(juce::ToggleButton::textColourId, kCream);
    laf_.setColour(juce::ToggleButton::tickColourId, kAccent);
    laf_.setColour(juce::ToggleButton::tickDisabledColourId, kDim);
    setLookAndFeel(&laf_);

    for (const auto& d : kKnobs) {
        auto k = std::make_unique<Knob>();
        k->key = d.key;
        styleKnob(k->slider, k->label, d.label);
        addAndMakeVisible(k->slider);
        addAndMakeVisible(k->label);
        knobs_.push_back(std::move(k));
    }
    for (const auto& d : kToggles) {
        auto t = std::make_unique<Toggle>();
        t->key = d.key;
        t->button.setButtonText(d.label);
        addAndMakeVisible(t->button);
        toggles_.push_back(std::move(t));
    }
    for (const auto& d : kCombos) {
        auto c = std::make_unique<Combo>();
        c->key = d.key;
        c->label.setText(d.label, juce::dontSendNotification);
        c->label.setColour(juce::Label::textColourId, kCream.withAlpha(0.7f));
        c->label.setFont(juce::FontOptions(11.f, juce::Font::bold));
        addAndMakeVisible(c->box);
        addAndMakeVisible(c->label);
        combos_.push_back(std::move(c));
    }
    const KnobDef globals[] = {{"master", "MASTER"}, {"swing", "SWING"}, {"length", "STEPS"}, {"bpm", "BPM"}};
    for (const auto& d : globals) {
        auto k = std::make_unique<Knob>();
        k->key = d.key;
        styleKnob(k->slider, k->label, d.label);
        k->att = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(proc_.apvts, d.key, k->slider);
        addAndMakeVisible(k->slider);
        addAndMakeVisible(k->label);
        globals_.push_back(std::move(k));
    }
    run_ = std::make_unique<Toggle>();
    run_->button.setButtonText("RUN");
    run_->button.setTooltip("Horloge interne quand l'hote ne joue pas (Standalone)");
    run_->att = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>(proc_.apvts, "run", run_->button);
    addAndMakeVisible(run_->button);

    selectTrack(0);
    setSize(kW, kH);
    startTimerHz(30);
}

MMRytmEditor::~MMRytmEditor() {
    stopTimer();
    setLookAndFeel(nullptr);
}

void MMRytmEditor::selectTrack(int t) {
    selected_ = t;
    using SA = juce::AudioProcessorValueTreeState::SliderAttachment;
    using BA = juce::AudioProcessorValueTreeState::ButtonAttachment;
    using CA = juce::AudioProcessorValueTreeState::ComboBoxAttachment;
    for (auto& k : knobs_) {
        k->att.reset();
        k->att = std::make_unique<SA>(proc_.apvts, MMRytmProcessor::pid(t, k->key), k->slider);
    }
    for (auto& b : toggles_) {
        b->att.reset();
        b->att = std::make_unique<BA>(proc_.apvts, MMRytmProcessor::pid(t, b->key), b->button);
    }
    for (auto& c : combos_) {
        c->att.reset();
        c->box.clear(juce::dontSendNotification);
        if (auto* prm = dynamic_cast<juce::AudioParameterChoice*>(proc_.apvts.getParameter(MMRytmProcessor::pid(t, c->key))))
            c->box.addItemList(prm->choices, 1);
        c->att = std::make_unique<CA>(proc_.apvts, MMRytmProcessor::pid(t, c->key), c->box);
    }
    repaint();
}

juce::Rectangle<int> MMRytmEditor::stepBounds(int track, int step) const {
    const int x = kGridX + step * (kStepW + kStepGap) + (step / 4) * kGroupGap;
    const int y = kGridY + track * kRowH + 8;
    return {x, y, kStepW, kRowH - 16};
}
juce::Rectangle<int> MMRytmEditor::playBounds(int track) const { return {18, kGridY + track * kRowH + 13, 28, kRowH - 26}; }
juce::Rectangle<int> MMRytmEditor::nameBounds(int track) const { return {52, kGridY + track * kRowH + 8, 58, kRowH - 16}; }
juce::Rectangle<int> MMRytmEditor::muteBounds(int track) const { return {114, kGridY + track * kRowH + 13, 26, kRowH - 26}; }

void MMRytmEditor::paint(juce::Graphics& g) {
    g.fillAll(kBg);
    g.setColour(kCream);
    g.setFont(juce::FontOptions(26.f, juce::Font::bold));
    g.drawText("MM-RYTM", 18, 14, 220, 34, juce::Justification::centredLeft);
    g.setColour(kCream.withAlpha(0.45f));
    g.setFont(juce::FontOptions(11.f));
    g.drawText(proc_.soundsReady() ? "MAUDITE MACHINE" : "CALCUL DES SONS...", 190, 24, 200, 18, juce::Justification::centredLeft);

    const int step = proc_.playingStep();
    for (int t = 0; t < mm::kTracks; ++t) {
        const bool sel = t == selected_;
        // ecoute
        auto pb = playBounds(t).toFloat();
        g.setColour(kDim);
        g.drawRoundedRectangle(pb, 4, 1);
        juce::Path tri;
        const auto c = pb.getCentre();
        tri.addTriangle(c.x - 4, c.y - 6, c.x - 4, c.y + 6, c.x + 6, c.y);
        g.setColour(kCream.withAlpha(0.8f));
        g.fillPath(tri);
        // nom + LED
        auto nb = nameBounds(t).toFloat();
        g.setColour(sel ? kCream : kPanel);
        g.fillRoundedRectangle(nb, 4);
        g.setColour(sel ? kBg : kCream);
        g.setFont(juce::FontOptions(15.f, juce::Font::bold));
        g.drawText(mm::trackName(t), nb.toNearestInt(), juce::Justification::centred);
        g.setColour(kAccent.withAlpha(juce::jlimit(0.f, 1.f, leds_[t])));
        g.fillEllipse(nb.getRight() - 9, nb.getY() + 4, 5, 5);
        // mute
        const bool muted = proc_.apvts.getRawParameterValue(MMRytmProcessor::pid(t, "mute"))->load() > 0.5f;
        auto mb = muteBounds(t).toFloat();
        g.setColour(muted ? kAccent : kPanel);
        g.fillRoundedRectangle(mb, 4);
        g.setColour(kCream.withAlpha(muted ? 1.f : 0.6f));
        g.setFont(juce::FontOptions(12.f, juce::Font::bold));
        g.drawText("M", mb.toNearestInt(), juce::Justification::centred);
        // les pas
        for (int s = 0; s < mm::kSteps; ++s) {
            const auto r = stepBounds(t, s).toFloat();
            const uint8_t v = proc_.seq.steps[t][s].load();
            juce::Colour col = (s / 4) % 2 ? kPanel.brighter(0.05f) : kPanel;
            if (v == 1) col = kCream.withAlpha(0.75f);
            if (v == 2) col = kAccent;
            g.setColour(col);
            g.fillRoundedRectangle(r, 3);
            if (s == step) {
                g.setColour(kCream);
                g.drawRoundedRectangle(r.reduced(0.5f), 3, 2);
            }
        }
    }
    // la longueur du motif
    const int len = static_cast<int>(proc_.apvts.getRawParameterValue("length")->load());
    if (len < 16) {
        const auto a = stepBounds(0, len);
        g.setColour(kBg.withAlpha(0.6f));
        g.fillRect(a.getX() - 2, kGridY, stepBounds(0, 15).getRight() - a.getX() + 4, kRowH * mm::kTracks);
    }
    g.setColour(kCream.withAlpha(0.35f));
    g.setFont(juce::FontOptions(11.f));
    g.drawText("clic : on / accent / off   -   MIDI : GM (36 BD, 38 SD, 42 CH, 46 OH, 39 CP, 45 TOM, 50 HT, 49 CY)", kGridX, kH - 30, 520, 18,
               juce::Justification::centredLeft);

    // le panneau de la piste
    g.setColour(kPanel);
    g.fillRoundedRectangle(juce::Rectangle<float>(kPanelX, 70, kW - kPanelX - 16, kH - 86), 8);
    g.setColour(kCream);
    g.setFont(juce::FontOptions(20.f, juce::Font::bold));
    g.drawText(mm::trackName(selected_), kPanelX + 16, 78, 120, 28, juce::Justification::centredLeft);
}

void MMRytmEditor::resized() {
    // l'en-tete : les reglages globaux
    int x = kW - 16 - 4 * 70 - 70;
    for (auto& k : globals_) {
        k->label.setBounds(x, 4, 64, 14);
        k->slider.setBounds(x, 16, 64, 54);
        x += 70;
    }
    run_->button.setBounds(x + 4, 26, 64, 24);

    // le panneau
    const int px = kPanelX + 16;
    int y = 112;
    const int cw = (kW - kPanelX - 48) / 3;
    for (size_t i = 0; i < combos_.size(); ++i) {
        auto& c = combos_[i];
        const int cx = px + static_cast<int>(i) * (cw + 8);
        c->label.setBounds(cx, y, cw, 14);
        c->box.setBounds(cx, y + 16, cw, 26);
    }
    y += 52;
    const int kw = (kW - kPanelX - 32) / 5;
    for (size_t i = 0; i < knobs_.size(); ++i) {
        auto& k = knobs_[i];
        const int col = static_cast<int>(i) % 5;
        const int row = static_cast<int>(i) / 5;
        const int kx = px - 8 + col * kw;
        const int ky = y + row * 104;
        k->label.setBounds(kx, ky, kw, 14);
        k->slider.setBounds(kx + 4, ky + 14, kw - 8, 82);
    }
    y += 3 * 104 + 4;
    for (size_t i = 0; i < toggles_.size(); ++i) toggles_[i]->button.setBounds(px + static_cast<int>(i) * 96, y, 90, 26);
}

void MMRytmEditor::mouseDown(const juce::MouseEvent& e) {
    const auto p = e.getPosition();
    for (int t = 0; t < mm::kTracks; ++t) {
        if (playBounds(t).contains(p)) {
            proc_.audition(t);
            return;
        }
        if (nameBounds(t).contains(p)) {
            selectTrack(t);
            return;
        }
        if (muteBounds(t).contains(p)) {
            if (auto* prm = proc_.apvts.getParameter(MMRytmProcessor::pid(t, "mute"))) {
                prm->beginChangeGesture();
                prm->setValueNotifyingHost(prm->getValue() > 0.5f ? 0.f : 1.f);
                prm->endChangeGesture();
            }
            repaint();
            return;
        }
        for (int s = 0; s < mm::kSteps; ++s) {
            if (stepBounds(t, s).contains(p)) {
                auto& st = proc_.seq.steps[t][s];
                const uint8_t v = st.load();
                st.store(e.mods.isRightButtonDown() ? 0 : static_cast<uint8_t>((v + 1) % 3));
                // le motif n'est pas un parametre : on previent l'hote que l'etat a change
                proc_.updateHostDisplay(juce::AudioProcessor::ChangeDetails().withNonParameterStateChanged(true));
                repaint();
                return;
            }
        }
    }
}

void MMRytmEditor::timerCallback() {
    for (int t = 0; t < mm::kTracks; ++t) {
        const float pk = proc_.takePeak(t);
        leds_[t] = std::max(leds_[t] * 0.82f, pk > 0.001f ? 1.f : 0.f);
    }
    lastStep_ = proc_.playingStep();
    repaint();
}
