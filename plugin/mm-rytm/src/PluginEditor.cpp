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
    if (ext == "wav") return "audio/wav";
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
                 .withEventListener("mm_program", [this](juce::var o) { proc_.faceProgram(o.getProperty("program", "").toString()); })
                 .withEventListener("mm_state", [this](juce::var o) { proc_.faceState(o.getProperty("ls", "").toString()); })
                 .withEventListener("mm_hit", [this](juce::var o) { proc_.faceHit(o); })
                 .withEventListener("mm_run", [this](juce::var o) { proc_.faceRun(static_cast<bool>(o.getProperty("on", false))); })
                 .withEventListener("mm_ready", [this](juce::var) {
                     lastSeq_ = -1;
                     quietTicks_ = 1000;
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
    // Les samples de Mika : servis depuis la banque du plugin (les memes octets que public/samples/rytm)
    if (path.startsWith("/samples/rytm/")) {
        const juce::String key = path.fromFirstOccurrenceOf("/samples/rytm/", false, false);
        if (const auto* b = mm::SampleBank::get().byKey(key)) {
            std::vector<std::byte> bytes(static_cast<size_t>(b->size));
            std::memcpy(bytes.data(), b->data, static_cast<size_t>(b->size));
            return juce::WebBrowserComponent::Resource{std::move(bytes), "audio/wav"};
        }
        return std::nullopt;
    }
    const auto& files = webFiles();
    const auto it = files.find(path.substring(1));
    if (it == files.end()) return std::nullopt;
    return juce::WebBrowserComponent::Resource{it->second, mimeOf(path)};
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
    if (fb.seq == lastSeq_ && fb.playing == lastPlaying_ && fb.internal == lastInternal_ && quietTicks_ < 30) return;
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
    browser_->emitEventIfBrowserIsVisible("mm_transport", juce::var(o));
}
