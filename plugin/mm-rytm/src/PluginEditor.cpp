#include "PluginEditor.h"

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
    setSize(kW, kH);
    browser_->goToURL(juce::WebBrowserComponent::getResourceProviderRoot());
    startTimerHz(30);
}

MMRytmEditor::~MMRytmEditor() { stopTimer(); }

void MMRytmEditor::paint(juce::Graphics& g) { g.fillAll(juce::Colour(0xff0b0b0c)); }

void MMRytmEditor::resized() {
    if (browser_) browser_->setBounds(getLocalBounds());
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
