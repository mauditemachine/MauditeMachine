#include "PluginEditor.h"

#include "WebData.h"

#include <map>

namespace {

// La taille de la fenetre : les proportions de la face du MM-ARP (src/v4/plugin/arp)
constexpr int kW = 1100;
constexpr int kH = 704;

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
                     const int i = mmarp::knobIndex(id.toRawUTF8());
                     if (i >= 0 && v >= 0 && v <= 1) sent_[static_cast<size_t>(i)] = static_cast<float>(v);
                 })
                 .withEventListener("mm_gesture", [this](juce::var o) { proc_.faceGesture(o.getProperty("id", "").toString(), static_cast<bool>(o.getProperty("on", false))); })
                 .withEventListener("mm_preset_save", [this](juce::var o) { presetSave(o.getProperty("name", "").toString(), o.getProperty("preset", "").toString()); })
                 .withEventListener("mm_preset_open", [this](juce::var) { presetOpen(); })
                 .withEventListener("mm_preset_list", [this](juce::var) { presetList(); })
                 .withEventListener("mm_preset_load", [this](juce::var o) { presetLoad(juce::File(o.getProperty("path", "").toString())); })
                 .withEventListener("mm_ready", [this](juce::var) {
                     lastSeq_ = -1;
                     quietTicks_ = 1000;
                     ready_ = true;
                     // Tous les potards vers la face (s'ils sont connus : sinon c'est la face qui donne les siens)
                     sent_.fill(-1.f);
                     if (!proc_.knobsKnown()) {
                         for (int i = 0; i < mmarp::kKnobs; ++i)
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
    setSize(kW, kH);
    browser_->goToURL(juce::WebBrowserComponent::getResourceProviderRoot());
    startTimerHz(30);
}

MMArpEditor::~MMArpEditor() { stopTimer(); }

void MMArpEditor::paint(juce::Graphics& g) { g.fillAll(juce::Colour(0xff0b0b0c)); }

void MMArpEditor::resized() {
    if (browser_) browser_->setBounds(getLocalBounds());
}

void MMArpEditor::timerCallback() {
    // Les potards que l'hote a changes (automation, MIDI Map, le triangle d'Ableton) vers la face
    if (ready_) {
        auto* changed = new juce::DynamicObject();
        int count = 0;
        for (int i = 0; i < mmarp::kKnobs; ++i) {
            auto* prm = proc_.knobParam(i);
            if (!prm) continue;
            const float v = prm->getValue();
            if (v == sent_[static_cast<size_t>(i)]) continue;
            sent_[static_cast<size_t>(i)] = v;
            changed->setProperty(mmarp::kKnobDefs[i].id, static_cast<double>(v));
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
                                  o->setProperty("ok", false);
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
