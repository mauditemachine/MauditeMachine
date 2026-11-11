#include "PluginEditor.h"

#include "WebData.h"

#include <map>

namespace {

// La taille de la fenetre : les proportions de la face du MM-ARP (src/v4/plugin/arp)
constexpr int kW = 1440;
constexpr int kH = 810;
const juce::Colour kInk(0xff0b0b0c);

// Les fichiers de la face (le zip de plugin/mm-arp/build-web), lus une fois.
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
    if (ext == "wav") return "audio/wav";
    if (ext == "wasm") return "application/wasm";
    return "application/octet-stream";
}

juce::String urlDecode(const juce::String& s) { return juce::URL::removeEscapeChars(s); }

} // namespace

juce::WebBrowserComponent::Options MMArpEditor::options() {
    auto o = juce::WebBrowserComponent::Options{}
                 .withBackend(juce::WebBrowserComponent::Options::Backend::defaultBackend)
                 .withNativeIntegrationEnabled()
                 .withKeepPageLoadedWhenBrowserIsHidden()
                 .withResourceProvider([this](const juce::String& url) { return resource(url); })
                 // L'etat de la machine garde dans le projet : la face le pose dans son localStorage avant de se charger
                 .withInitialisationData("mmState", proc_.faceInitState())
                 .withEventListener("mm_program", [this](juce::var o) { proc_.faceProgram(o.getProperty("program", "").toString()); })
                 .withEventListener("mm_state", [this](juce::var o) { proc_.faceState(o.getProperty("ls", "").toString()); })
                 .withEventListener("mm_run", [this](juce::var o) { proc_.faceRun(static_cast<bool>(o.getProperty("on", false))); })
                 // Un potard tourne dans la face : le parametre de l'hote suit (sans retour vers la face)
                 .withEventListener("mm_param", [this](juce::var o) {
                     const juce::String id = o.getProperty("id", "").toString();
                     const double v = static_cast<double>(o.getProperty("v", -1.0));
                     proc_.faceParam(id, v);
                     const int i = mmx::allIndex(id.toRawUTF8());
                     if (i >= 0 && v >= 0 && v <= 1) sent_[static_cast<size_t>(i)] = static_cast<float>(v);
                 })
                 .withEventListener("mm_gesture", [this](juce::var o) { proc_.faceGesture(o.getProperty("id", "").toString(), static_cast<bool>(o.getProperty("on", false))); })
                 .withEventListener("mm_preset_save", [this](juce::var o) { presetSave(o.getProperty("name", "").toString(), o.getProperty("preset", "").toString()); })
                 .withEventListener("mm_preset_open", [this](juce::var) { presetOpen(); })
                 .withEventListener("mm_preset_list", [this](juce::var) { presetList(); })
                 .withEventListener("mm_preset_load", [this](juce::var o) { presetLoad(juce::File(o.getProperty("path", "").toString())); })
                 // DRAG MIDI depuis le capot : le glisser natif part de l'evenement souris en cours (le bouton est encore enfonce)
                 .withEventListener("mm_drag_midi", [this](juce::var o) { dragMidi(juce::jlimit(1, 8, static_cast<int>(o.getProperty("cycles", 1)))); })
                 .withEventListener("mm_save_mid", [this](juce::var o) {
                     cycles_ = juce::jlimit(1, 8, static_cast<int>(o.getProperty("cycles", 1)));
                     saveMidi();
                 })
                 // MIDI LEARN
                 .withEventListener("mm_learn", [this](juce::var o) { proc_.learn(o.getProperty("id", "").toString()); })
                 .withEventListener("mm_unmap", [this](juce::var o) {
                     proc_.unmap(static_cast<int>(o.getProperty("ch", 0)) - 1, static_cast<int>(o.getProperty("cc", -1)));
                 })
                 .withEventListener("mm_unmap_all", [this](juce::var) { proc_.unmapAll(); })
                 .withEventListener("mm_midimap_get", [this](juce::var) { browser_->emitEventIfBrowserIsVisible("mm_midimap", proc_.midiMap()); })
                 .withEventListener("mm_ready", [this](juce::var) {
                     lastSeq_ = -1;
                     quietTicks_ = 1000;
                     ready_ = true;
                     // Tous les potards vers la face (s'ils sont connus : sinon c'est la face qui donne les siens)
                     sent_.fill(-1.f);
                     if (!proc_.knobsKnown()) {
                         for (int i = 0; i < mmx::kAll; ++i)
                             if (auto* prm = proc_.knobParam(i)) sent_[static_cast<size_t>(i)] = prm->getValue();
                     }
                     presetList();
                 })
                 .withEventListener("mm_log", [](juce::var o) {
                     juce::ignoreUnused(o);
                     DBG("MM-ARP face: " << o.getProperty("where", "").toString() << " " << o.getProperty("msg", "").toString());
                 });
    return o;
}

std::optional<juce::WebBrowserComponent::Resource> MMArpEditor::resource(const juce::String& url) {
    juce::String path = url.upToFirstOccurrenceOf("?", false, false).upToFirstOccurrenceOf("#", false, false);
    if (path.isEmpty() || path == "/") path = "/index.html";
    path = urlDecode(path);
    const auto& files = webFiles();
    const auto it = files.find(path.substring(1));
    if (it == files.end()) return std::nullopt;
    return juce::WebBrowserComponent::Resource{it->second, mimeOf(path)};
}

MMArpEditor::MMArpEditor(MMArpProcessor& p) : AudioProcessorEditor(&p), proc_(p) {
    browser_ = std::make_unique<Browser>(options());
    addAndMakeVisible(*browser_);
    // Redimensionnable a proportions fixes (2026-11-11, Mika : "je ne peux pas agrandir le plugin") : 880 a 2200 de large,
    // la face suit seule (src/v4/plugin/arp/scale.ts) ; la taille choisie est gardee dans le projet
    setResizable(true, true);
    getConstrainer()->setFixedAspectRatio(static_cast<double>(kW) / kH);
    setResizeLimits(1100, 1100 * kH / kW, 2560, 2560 * kH / kW);
    const int w = juce::jlimit(1100, 2560, proc_.editorWidth());
    setSize(w, w * kH / kW);
    browser_->goToURL(juce::WebBrowserComponent::getResourceProviderRoot());
    startTimerHz(30);
}

MMArpEditor::~MMArpEditor() { stopTimer(); }

void MMArpEditor::paint(juce::Graphics& g) { g.fillAll(kInk); }

void MMArpEditor::resized() {
    if (browser_) browser_->setBounds(getLocalBounds());
    proc_.setEditorWidth(getWidth());
}

void MMArpEditor::setHint(const juce::String& m) {
    auto* o = new juce::DynamicObject();
    o->setProperty("ok", !m.startsWith("Aucun") && !m.startsWith("Impossible"));
    o->setProperty("msg", m);
    browser_->emitEventIfBrowserIsVisible("mm_drag_status", juce::var(o));
}

void MMArpEditor::dragMidi(int cycles) {
    const juce::File f = proc_.arpMidiFile(cycles);
    if (!f.existsAsFile()) {
        setHint("Aucun accord : touche des pads pour faire une progression");
        return;
    }
    // Le glisser du Mac, depuis l'evenement souris courant (celui du bouton DRAG MIDI tenu dans la face)
    const bool ok = juce::DragAndDropContainer::performExternalDragDropOfFiles({f.getFullPathName()}, false, this);
    setHint(ok ? "Depose sur une piste ou un emplacement de clip" : "Glisser impossible : SAVE .MID enregistre le clip");
}

void MMArpEditor::saveMidi() {
    int bars = 0;
    const juce::MidiFile mf = proc_.arpMidi(cycles_, bars);
    if (bars <= 0) {
        setHint("Aucun accord : touche des pads pour faire une progression");
        return;
    }
    const juce::File dir = juce::File::getSpecialLocation(juce::File::userMusicDirectory).getChildFile("Maudite Machine").getChildFile("MM-ARP Clips");
    dir.createDirectory();
    chooser_ = std::make_unique<juce::FileChooser>("Enregistrer le clip MIDI", dir.getChildFile("MM-ARP " + juce::String(bars) + " bars.mid"), "*.mid");
    chooser_->launchAsync(juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::warnAboutOverwriting,
                          [this, mf](const juce::FileChooser& fc) {
                              juce::File f = fc.getResult();
                              if (f == juce::File()) return;
                              if (!f.hasFileExtension("mid")) f = f.withFileExtension("mid");
                              f.deleteFile();
                              juce::FileOutputStream out(f);
                              const bool ok = out.openedOk() && mf.writeTo(out, 1);
                              setHint(ok ? "Clip MIDI enregistre : " + f.getFullPathName() : "Impossible d'ecrire " + f.getFullPathName());
                          });
}

void MMArpEditor::timerCallback() {
    // MIDI LEARN : la liste des CC a chaque changement
    if (ready_ && proc_.takeMapChanged()) browser_->emitEventIfBrowserIsVisible("mm_midimap", proc_.midiMap());
    // Les potards que l'hote a changes (automation, MIDI Map, le triangle d'Ableton) vers la face
    if (ready_) {
        auto* changed = new juce::DynamicObject();
        int count = 0;
        for (int i = 0; i < mmx::kAll; ++i) {
            auto* prm = proc_.knobParam(i);
            if (!prm) continue;
            const float v = prm->getValue();
            if (!(v < sent_[static_cast<size_t>(i)] || v > sent_[static_cast<size_t>(i)])) continue;
            sent_[static_cast<size_t>(i)] = v;
            changed->setProperty(mmx::allId(i), static_cast<double>(v));
            ++count;
        }
        if (count > 0) {
            auto* o = new juce::DynamicObject();
            o->setProperty("values", juce::var(changed));
            browser_->emitEventIfBrowserIsVisible("mm_knobs", juce::var(o));
        } else {
            delete changed;
        }
    }
    // La note jouee vers la face : a chaque note, a chaque depart ou arret (et une fois par seconde, au cas ou)
    const auto fb = proc_.feedback();
    ++quietTicks_;
    if (fb.seq == lastSeq_ && fb.playing == lastPlaying_ && fb.internal == lastInternal_ && quietTicks_ < 30) return;
    lastSeq_ = fb.seq;
    lastPlaying_ = fb.playing;
    lastInternal_ = fb.internal;
    quietTicks_ = 0;
    auto* o = new juce::DynamicObject();
    o->setProperty("playing", fb.playing);
    o->setProperty("internal", fb.internal);
    o->setProperty("seq", fb.seq);
    o->setProperty("slot", fb.playing ? fb.slot : -1);
    o->setProperty("pos", fb.pos);
    o->setProperty("len", fb.len);
    o->setProperty("chord", fb.playing ? fb.chord : -1);
    o->setProperty("midi", fb.playing ? fb.midi : -1);
    browser_->emitEventIfBrowserIsVisible("mm_transport", juce::var(o));
}

/* ---------------- les presets sur le disque (~/Music/Maudite Machine/MM-ARP Presets, fichiers .mmarp) ---------------- */

namespace {
juce::String safeName(const juce::String& n) {
    juce::String s = juce::File::createLegalFileName(n.trim());
    return s.isEmpty() ? juce::String("MM-ARP preset") : s;
}
} // namespace

void MMArpEditor::presetSave(const juce::String& name, const juce::String& preset) {
    if (preset.isEmpty()) return;
    const juce::File dir = MMArpProcessor::presetDir();
    dir.createDirectory();
    // La boite de dialogue du Mac, le nom donne dans la face deja ecrit, dans le dossier des presets
    chooser_ = std::make_unique<juce::FileChooser>("Enregistrer le preset MM-ARP", dir.getChildFile(safeName(name) + ".mmarp"), "*.mmarp");
    chooser_->launchAsync(juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::warnAboutOverwriting,
                          [this, preset, name](const juce::FileChooser& fc) {
                              juce::File f = fc.getResult();
                              auto* o = new juce::DynamicObject();
                              o->setProperty("name", name);
                              if (f == juce::File()) {
                                  // annule dans la boite du Mac : la face ne dit rien
                                  o->setProperty("ok", false);
                                  o->setProperty("cancelled", true);
                                  browser_->emitEventIfBrowserIsVisible("mm_saved", juce::var(o));
                                  return;
                              }
                              if (!f.hasFileExtension("mmarp")) f = f.withFileExtension("mmarp");
                              const bool ok = f.replaceWithText(preset);
                              o->setProperty("ok", ok);
                              o->setProperty("name", f.getFileNameWithoutExtension());
                              o->setProperty("path", f.getFullPathName());
                              browser_->emitEventIfBrowserIsVisible("mm_saved", juce::var(o));
                              presetList();
                          });
}

void MMArpEditor::presetOpen() {
    const juce::File dir = MMArpProcessor::presetDir();
    dir.createDirectory();
    chooser_ = std::make_unique<juce::FileChooser>("Ouvrir un preset MM-ARP", dir, "*.mmarp;*.json");
    chooser_->launchAsync(juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles, [this](const juce::FileChooser& fc) {
        const juce::File f = fc.getResult();
        if (f.existsAsFile()) presetLoad(f);
    });
}

void MMArpEditor::presetLoad(const juce::File& f) {
    if (!f.existsAsFile() || f.getSize() > 1024 * 1024) return;
    const juce::String text = f.loadFileAsString();
    if (!juce::JSON::parse(text).isObject()) return;
    auto* o = new juce::DynamicObject();
    o->setProperty("name", f.getFileNameWithoutExtension());
    o->setProperty("preset", text);
    o->setProperty("path", f.getFullPathName());
    browser_->emitEventIfBrowserIsVisible("mm_preset", juce::var(o));
}

void MMArpEditor::presetList() {
    juce::Array<juce::var> items;
    const juce::File dir = MMArpProcessor::presetDir();
    auto files = dir.findChildFiles(juce::File::findFiles, false, "*.mmarp");
    files.sort();
    for (const auto& f : files) {
        auto* it = new juce::DynamicObject();
        it->setProperty("name", f.getFileNameWithoutExtension());
        it->setProperty("path", f.getFullPathName());
        items.add(juce::var(it));
    }
    auto* o = new juce::DynamicObject();
    o->setProperty("items", items);
    o->setProperty("dir", dir.getFullPathName());
    browser_->emitEventIfBrowserIsVisible("mm_presets", juce::var(o));
}
