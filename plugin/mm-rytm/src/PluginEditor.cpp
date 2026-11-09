#include "PluginEditor.h"

#include "MidiExport.h"
#include "SampleBank.h"
#include "WebData.h"

#include <map>

namespace {

// La face fait 256 x 156 mm : la fenetre garde ces proportions
constexpr int kW = 1200;
constexpr int kH = 731;

// Les fichiers de la face (le zip de plugin/mm-rytm/build-web), lus une fois.
const std::map<juce::String, std::vector<std::byte>>& webFiles() {
    static const auto files = [] {
        std::map<juce::String, std::vector<std::byte>> out;
        juce::MemoryInputStream zipStream(WebData::web_zip, WebData::web_zipSize, false);
        juce::ZipFile zip(zipStream);
        for (int i = 0; i < zip.getNumEntries(); ++i) {
            const auto* e = zip.getEntry(i);
            if (!e || e->filename.endsWithChar('/')) continue;
            std::unique_ptr<juce::InputStream> in(zip.createStreamForEntry(i));
            if (!in) continue;
            juce::MemoryBlock mb;
            in->readIntoMemoryBlock(mb);
            std::vector<std::byte> bytes(mb.getSize());
            std::memcpy(bytes.data(), mb.getData(), mb.getSize());
            juce::String name = e->filename.replaceCharacter('\\', '/');
            if (name.startsWith("./")) name = name.substring(2);
            out[name] = std::move(bytes);
        }
        return out;
    }();
    return files;
}

juce::String mimeOf(const juce::String& path) {
    const juce::String ext = path.fromLastOccurrenceOf(".", false, false).toLowerCase();
    if (ext == "html") return "text/html";
    if (ext == "js" || ext == "mjs") return "text/javascript";
    if (ext == "css") return "text/css";
    if (ext == "json") return "application/json";
    if (ext == "svg") return "image/svg+xml";
    if (ext == "png") return "image/png";
    if (ext == "jpg" || ext == "jpeg") return "image/jpeg";
    if (ext == "webp") return "image/webp";
    if (ext == "woff2") return "font/woff2";
    if (ext == "woff") return "font/woff";
    if (ext == "ttf") return "font/ttf";
    if (ext == "otf") return "font/otf";
    if (ext == "wav" || ext == "wave") return "audio/wav";
    if (ext == "aif" || ext == "aiff") return "audio/aiff";
    if (ext == "flac") return "audio/flac";
    if (ext == "mp3") return "audio/mpeg";
    if (ext == "wasm") return "application/wasm";
    return "application/octet-stream";
}

juce::String urlDecode(const juce::String& s) { return juce::URL::removeEscapeChars(s); }

} // namespace

juce::WebBrowserComponent::Options MMRytmEditor::options() {
    auto o = juce::WebBrowserComponent::Options{}
                 .withBackend(juce::WebBrowserComponent::Options::Backend::defaultBackend)
                 .withNativeIntegrationEnabled()
                 .withKeepPageLoadedWhenBrowserIsHidden()
                 .withResourceProvider([this](const juce::String& url) { return resource(url); })
                 // L'etat de la machine garde dans le projet : la face le pose dans son localStorage avant de se charger
                 .withInitialisationData("mmState", proc_.faceInitState())
                 // Les samples perso (le dossier ~/Music/MM-RYTM Samples, relu a l'ouverture) : connus de la face avant son kit
                 .withInitialisationData("mmUser", userList())
                 .withEventListener("mm_program", [this](juce::var o) { proc_.faceProgram(o.getProperty("program", "").toString()); })
                 .withEventListener("mm_state", [this](juce::var o) { proc_.faceState(o.getProperty("ls", "").toString()); })
                 .withEventListener("mm_hit", [this](juce::var o) { proc_.faceHit(o); })
                 .withEventListener("mm_run", [this](juce::var o) { proc_.faceRun(static_cast<bool>(o.getProperty("on", false))); })
                 .withEventListener("mm_fill", [this](juce::var o) { proc_.faceFill(static_cast<bool>(o.getProperty("on", false))); })
                 .withEventListener("mm_xf", [this](juce::var o) { proc_.faceXf(static_cast<float>(static_cast<double>(o.getProperty("x", 0.0)))); })
                 .withEventListener("mm_ptn", [this](juce::var o) { proc_.facePtn(o); })
                 // + LOAD A FILE... de SOUNDS : le choix de fichiers du Mac, copies dans le dossier du type de la piste
                 .withEventListener("mm_import", [this](juce::var o) { importFiles(static_cast<int>(o.getProperty("family", -1)), static_cast<int>(o.getProperty("track", -1))); })
                 // SAMPLES et OPEN (2026-11-09) : le dossier des samples perso dans le Finder (cree s'il manque), sa relecture
                 .withEventListener("mm_reveal", [this](juce::var o) { revealSamples(o.getProperty("family", "").toString()); })
                 .withEventListener("mm_rescan", [this](juce::var) {
                     mm::UserLibrary::get().rescan();
                     sendUserList();
                 })
                 .withEventListener("mm_ready", [this](juce::var) {
                     lastSeq_ = -1;
                     quietTicks_ = 1000;
                     sendUserList();
                 })
                 .withEventListener("mm_log", [](juce::var o) {
                     juce::ignoreUnused(o);
                     DBG("MM-RYTM face: " << o.getProperty("where", "").toString() << " " << o.getProperty("msg", "").toString());
                 });
    return o;
}

std::optional<juce::WebBrowserComponent::Resource> MMRytmEditor::resource(const juce::String& url) {
    juce::String path = url.upToFirstOccurrenceOf("?", false, false).upToFirstOccurrenceOf("#", false, false);
    if (path.isEmpty() || path == "/") path = "/index.html";
    path = urlDecode(path);
    // Les samples de Mika : servis depuis la banque du plugin (les memes octets que public/samples/rytm), ses samples
    // perso depuis son dossier
    if (path.startsWith("/samples/rytm/")) {
        const juce::String key = path.fromFirstOccurrenceOf("/samples/rytm/", false, false);
        const auto* b = mm::UserLibrary::isUserKey(key) ? mm::UserLibrary::get().byKey(key) : mm::SampleBank::get().byKey(key);
        if (b && b->data) {
            std::vector<std::byte> bytes(static_cast<size_t>(b->size));
            std::memcpy(bytes.data(), b->data, static_cast<size_t>(b->size));
            return juce::WebBrowserComponent::Resource{std::move(bytes), mimeOf(key)};
        }
        return std::nullopt;
    }
    const auto& files = webFiles();
    const auto it = files.find(path.substring(1));
    if (it == files.end()) return std::nullopt;
    return juce::WebBrowserComponent::Resource{it->second, mimeOf(path)};
}

/* ---------------- les samples perso ---------------- */

juce::String MMRytmEditor::userList() {
    mm::UserLibrary::get().rescan();
    return mm::UserLibrary::get().listJson();
}

void MMRytmEditor::sendUserList() {
    auto* o = new juce::DynamicObject();
    o->setProperty("list", juce::JSON::parse(userList()));
    browser_->emitEventIfBrowserIsVisible("mm_user", juce::var(o));
}

void MMRytmEditor::revealSamples(const juce::String& family) {
    juce::File dir = mm::UserLibrary::get().root();
    for (int f = 0; f < 8; ++f) {
        const juce::File sub = dir.getChildFile(mm::SampleBank::kFamilies[f]);
        if (!sub.isDirectory()) sub.createDirectory();
    }
    if (family.isNotEmpty()) {
        for (int f = 0; f < 8; ++f)
            if (family == mm::SampleBank::kFamilies[f]) dir = dir.getChildFile(family);
    }
    if (dir.isDirectory()) dir.startAsProcess();
}

void MMRytmEditor::importFiles(int family, int track) {
    if (family < 0 || family >= 8) return;
    chooser_ = std::make_unique<juce::FileChooser>(juce::String("MM-RYTM : samples ") + juce::String(mm::SampleBank::kFamilies[family]).toUpperCase(),
                                                   juce::File::getSpecialLocation(juce::File::userMusicDirectory), "*.wav;*.wave;*.aif;*.aiff;*.flac;*.mp3");
    const auto flags = juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::canSelectMultipleItems;
    juce::Component::SafePointer<MMRytmEditor> safe(this);
    chooser_->launchAsync(flags, [safe, family, track](const juce::FileChooser& fc) {
        if (!safe) return;
        const juce::String key = mm::UserLibrary::get().import(fc.getResults(), family);
        safe->sendUserList();
        if (key.isNotEmpty()) {
            auto* o = new juce::DynamicObject();
            o->setProperty("track", track);
            o->setProperty("key", key);
            safe->browser_->emitEventIfBrowserIsVisible("mm_imported", juce::var(o));
        }
    });
}

MMRytmEditor::MMRytmEditor(MMRytmProcessor& p) : AudioProcessorEditor(&p), proc_(p) {
    browser_ = std::make_unique<Browser>(options());
    addAndMakeVisible(*browser_);
    midiBar_ = std::make_unique<MidiBar>(p);
    midiBar_->onCommand = [this](const juce::String& cmd) {
        auto* o = new juce::DynamicObject();
        o->setProperty("cmd", cmd);
        browser_->emitEventIfBrowserIsVisible("mm_cmd", juce::var(o));
    };
    addAndMakeVisible(*midiBar_);
    setSize(kW, kH + MidiBar::kHeight);
    browser_->goToURL(juce::WebBrowserComponent::getResourceProviderRoot());
    startTimerHz(30);
}

MMRytmEditor::~MMRytmEditor() { stopTimer(); }

void MMRytmEditor::paint(juce::Graphics& g) { g.fillAll(juce::Colour(0xff0b0b0c)); }

void MMRytmEditor::resized() {
    auto r = getLocalBounds();
    if (midiBar_) midiBar_->setBounds(r.removeFromBottom(MidiBar::kHeight));
    if (browser_) browser_->setBounds(r);
}

/* ---------------- la barre MIDI ---------------- */

namespace {
const juce::Colour kBarBg(0xff111113), kBarLine(0x22f6f1e7), kBone(0xfff6f1e7), kOrange(0xffff781f);
}

MidiBar::MidiBar(MMRytmProcessor& p) : proc_(p) {
    setMouseCursor(juce::MouseCursor::NormalCursor);
    refresh(true);
    startTimerHz(2);
}

MidiBar::~MidiBar() { stopTimer(); }

void MidiBar::resized() {
    auto r = getLocalBounds().reduced(8, 5);
    drag_ = r.removeFromLeft(150);
    save_ = r.removeFromRight(104);
    r.removeFromRight(6);
    clear_ = r.removeFromRight(78);
    r.removeFromRight(6);
    new_ = r.removeFromRight(78);
}

void MidiBar::ask(const juce::String& cmd) {
    const bool isNew = cmd == "new";
    const juce::String title = isNew ? "NEW: a blank preset?" : "CLEAR the pattern?";
    const juce::String text = isNew ? "The playing pattern starts from zero: no steps, the 16 tracks on the first sample of their type with their start settings, "
                                      "the global FX off, no scene, no mute.\n\nCmd+Z in the machine undoes it."
                                    : "The steps, their P-LOCKs and the trig settings of the pattern go away; the sounds, the FX and the scenes stay.\n\nCmd+Z in "
                                      "the machine undoes it.";
    juce::Component::SafePointer<MidiBar> safe(this);
    juce::AlertWindow::showAsync(juce::MessageBoxOptions()
                                     .withIconType(juce::MessageBoxIconType::QuestionIcon)
                                     .withTitle(title)
                                     .withMessage(text)
                                     .withButton(isNew ? "NEW" : "CLEAR")
                                     .withButton("CANCEL")
                                     .withAssociatedComponent(this),
                                 [safe, cmd](int result) {
                                     if (!safe || result != 1) return;
                                     if (safe->onCommand) safe->onCommand(cmd);
                                     safe->flash_ = cmd == "new" ? "NEW: blank preset (Cmd+Z in the machine: undo)" : "CLEARED: the steps of the pattern (Cmd+Z in the machine: undo)";
                                     safe->flashUntil_ = juce::Time::getMillisecondCounterHiRes() + 3000;
                                     safe->repaint();
                                 });
}

void MidiBar::refresh(bool force) {
    const int ver = proc_.programVersion();
    const int slot = proc_.feedback().pat;
    if (!force && ver == ver_ && slot == slot_) return;
    ver_ = ver;
    slot_ = slot;
    const auto x = proc_.exportMidi();
    notes_ = x.notes;
    if (!x.ok) info_ = "the playing pattern (no program yet)";
    else {
        const long bars = std::max(1L, x.steps / 16);
        info_ = juce::String(mm::slotName(x.slot)) + "   /   " + juce::String(bars) + (bars > 1 ? " BARS" : " BAR") + "   /   " + juce::String(x.notes) + (x.notes == 1 ? " NOTE" : " NOTES") +
                (x.capped ? "   /   CUT AT 64 BARS" : "") + "      drop it on a MIDI track or a Drum Rack (16 pads, C1 to D#2)";
        if (x.notes == 0) info_ = juce::String(mm::slotName(x.slot)) + "   /   EMPTY PATTERN, nothing to drag";
    }
    repaint();
}

void MidiBar::timerCallback() {
    refresh(false);
    if (flashUntil_ > 0 && juce::Time::getMillisecondCounterHiRes() > flashUntil_) {
        flashUntil_ = 0;
        flash_.clear();
        repaint();
    }
}

juce::File MidiBar::writeFile(bool keep) {
    const auto x = proc_.exportMidi();
    if (!x.ok || x.notes == 0 || x.bytes.empty()) return {};
    juce::File f;
    if (keep) {
        const juce::File dir = juce::File::getSpecialLocation(juce::File::userMusicDirectory).getChildFile("MM-RYTM MIDI");
        if (!dir.isDirectory() && !dir.createDirectory()) return {};
        f = dir.getChildFile(x.name + ".mid").getNonexistentSibling(true);
    } else {
        const juce::File dir = juce::File::getSpecialLocation(juce::File::tempDirectory).getChildFile("MM-RYTM MIDI");
        if (!dir.isDirectory() && !dir.createDirectory()) return {};
        f = dir.getChildFile(x.name + ".mid");
        f.deleteFile();
    }
    if (!f.replaceWithData(x.bytes.data(), x.bytes.size())) return {};
    return f;
}

void MidiBar::paint(juce::Graphics& g) {
    g.fillAll(kBarBg);
    g.setColour(kBarLine);
    g.fillRect(0, 0, getWidth(), 1);
    const bool can = notes_ > 0;
    // DRAG MIDI : la poignee (six points), le mot ; orange au survol et pendant le glisser
    const auto d = drag_.toFloat();
    const bool hot = (hotDrag_ || dragging_) && can;
    g.setColour(hot ? kOrange : kOrange.withAlpha(can ? 0.16f : 0.06f));
    g.fillRoundedRectangle(d, 6.f);
    g.setColour(kOrange.withAlpha(can ? 1.f : 0.35f));
    g.drawRoundedRectangle(d.reduced(0.5f), 6.f, 1.f);
    const juce::Colour ink = hot ? kBarBg : (can ? kBone : kBone.withAlpha(0.4f));
    g.setColour(ink);
    for (int i = 0; i < 3; ++i)
        for (int j = 0; j < 2; ++j) g.fillEllipse(d.getX() + 12.f + j * 5.f, d.getCentreY() - 6.f + i * 5.f, 2.6f, 2.6f);
    g.setFont(juce::Font(juce::FontOptions(13.f, juce::Font::bold)));
    g.drawText(dragging_ ? "DROP IN ABLETON" : "DRAG MIDI", drag_.withTrimmedLeft(26), juce::Justification::centredLeft);
    // SAVE .MID
    const auto s = save_.toFloat();
    g.setColour(kBone.withAlpha(hotSave_ && can ? 0.14f : 0.05f));
    g.fillRoundedRectangle(s, 6.f);
    g.setColour(kBone.withAlpha(can ? 0.35f : 0.15f));
    g.drawRoundedRectangle(s.reduced(0.5f), 6.f, 1.f);
    g.setColour(can ? kBone : kBone.withAlpha(0.4f));
    g.setFont(juce::Font(juce::FontOptions(12.f, juce::Font::bold)));
    g.drawText("SAVE .MID", save_, juce::Justification::centred);
    // NEW et CLEAR : des touches sobres, toujours actives
    for (const auto& [rc, word, hotK] : {std::tuple<juce::Rectangle<int>, const char*, bool>{new_, "NEW", hotNew_}, {clear_, "CLEAR", hotClear_}}) {
        const auto rf = rc.toFloat();
        g.setColour(kBone.withAlpha(hotK ? 0.14f : 0.05f));
        g.fillRoundedRectangle(rf, 6.f);
        g.setColour(kBone.withAlpha(0.35f));
        g.drawRoundedRectangle(rf.reduced(0.5f), 6.f, 1.f);
        g.setColour(kBone);
        g.drawText(word, rc, juce::Justification::centred);
    }
    // Ce qui part : le pattern, sa longueur, ses notes (ou le message du moment)
    auto mid = getLocalBounds().reduced(8, 0).withTrimmedLeft(drag_.getRight() + 6).withTrimmedRight(getWidth() - new_.getX() + 6);
    g.setColour(flash_.isNotEmpty() ? kOrange : kBone.withAlpha(0.75f));
    g.setFont(juce::Font(juce::FontOptions(12.5f, juce::Font::plain)));
    g.drawFittedText(flash_.isNotEmpty() ? flash_ : info_, mid, juce::Justification::centredLeft, 1, 0.9f);
}

void MidiBar::mouseMove(const juce::MouseEvent& e) {
    const bool a = drag_.contains(e.getPosition());
    const bool b = save_.contains(e.getPosition());
    const bool c = new_.contains(e.getPosition());
    const bool d = clear_.contains(e.getPosition());
    if (a != hotDrag_ || b != hotSave_ || c != hotNew_ || d != hotClear_) {
        hotDrag_ = a;
        hotSave_ = b;
        hotNew_ = c;
        hotClear_ = d;
        setMouseCursor(a && notes_ > 0 ? juce::MouseCursor::DraggingHandCursor : (b && notes_ > 0) || c || d ? juce::MouseCursor::PointingHandCursor : juce::MouseCursor::NormalCursor);
        if (a || b) refresh(false);
        repaint();
    }
}

void MidiBar::mouseExit(const juce::MouseEvent&) {
    hotDrag_ = hotSave_ = hotNew_ = hotClear_ = false;
    setMouseCursor(juce::MouseCursor::NormalCursor);
    repaint();
}

void MidiBar::mouseDown(const juce::MouseEvent& e) {
    downOnDrag_ = drag_.contains(e.getMouseDownPosition());
    if (downOnDrag_) refresh(true);
}

void MidiBar::mouseDrag(const juce::MouseEvent& e) {
    if (!downOnDrag_ || dragging_ || e.getDistanceFromDragStart() < 5) return;
    const juce::File f = writeFile(false);
    if (!f.existsAsFile()) {
        flash_ = "Nothing to drag: the playing pattern has no notes";
        flashUntil_ = juce::Time::getMillisecondCounterHiRes() + 2500;
        repaint();
        return;
    }
    dragging_ = true;
    repaint();
    juce::Component::SafePointer<MidiBar> safe(this);
    juce::DragAndDropContainer::performExternalDragDropOfFiles({f.getFullPathName()}, false, this, [safe] {
        if (!safe) return;
        safe->dragging_ = false;
        safe->repaint();
    });
}

void MidiBar::mouseUp(const juce::MouseEvent& e) {
    const bool wasDrag = e.getDistanceFromDragStart() >= 5;
    downOnDrag_ = false;
    if (wasDrag) return;
    if (new_.contains(e.getPosition())) {
        ask("new");
        return;
    }
    if (clear_.contains(e.getPosition())) {
        ask("clear");
        return;
    }
    if (save_.contains(e.getPosition()) || drag_.contains(e.getPosition())) {
        // Un clic (DRAG MIDI ou SAVE .MID) : le fichier garde dans ~/Music/MM-RYTM MIDI, montre dans le Finder
        const juce::File f = writeFile(true);
        if (f.existsAsFile()) {
            f.revealToUser();
            flash_ = "Saved: Music / MM-RYTM MIDI / " + f.getFileName() + "  (drag it from the Finder, or drag DRAG MIDI directly)";
        } else flash_ = "Nothing to save: the playing pattern has no notes";
        flashUntil_ = juce::Time::getMillisecondCounterHiRes() + 4000;
        repaint();
    }
}

void MMRytmEditor::timerCallback() {
    // La tete de lecture vers la face : a chaque pas joue, a chaque depart ou arret (et une fois par seconde, au cas ou)
    const auto fb = proc_.feedback();
    ++quietTicks_;
    // Le crossfader mene par Ableton (automation, controleur) : la face le suit aussi a l'arret
    if (fb.seq == lastSeq_ && fb.playing == lastPlaying_ && fb.internal == lastInternal_ && std::abs(fb.xf - lastXf_) < 1e-4 && fb.patSeq == lastPatSeq_ && quietTicks_ < 30) return;
    lastXf_ = fb.xf;
    lastPatSeq_ = fb.patSeq;
    lastSeq_ = fb.seq;
    lastPlaying_ = fb.playing;
    lastInternal_ = fb.internal;
    quietTicks_ = 0;
    auto* o = new juce::DynamicObject();
    o->setProperty("playing", fb.playing);
    o->setProperty("internal", fb.internal);
    o->setProperty("step", fb.playing ? fb.step : -1);
    o->setProperty("seq", fb.seq);
    o->setProperty("mask", fb.mask);
    o->setProperty("xf", fb.xf);
    o->setProperty("pat", fb.pat);
    o->setProperty("patSeq", fb.patSeq);
    browser_->emitEventIfBrowserIsVisible("mm_transport", juce::var(o));
}
