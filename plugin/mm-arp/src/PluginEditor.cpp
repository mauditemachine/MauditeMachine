#include "PluginEditor.h"

#include "WebData.h"

#include <cmath>
#include <map>

namespace {

// La taille de la fenetre : les proportions de la face du MM-ARP (src/v4/plugin/arp)
constexpr int kW = 1100;
constexpr int kH = 704;
constexpr int kMinW = MMArpProcessor::kEditorMinW;
constexpr int kMaxW = MMArpProcessor::kEditorMaxW;
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
#if JUCE_WINDOWS
                 // Windows (2026-11-28, la recette du MM-RYTM) : le backend par defaut de JUCE y est encore Internet
                 // Explorer ; la face demande WebView2 (Edge, livre avec Windows 10 et 11). Son dossier de donnees ne peut
                 // pas etre celui de l'hote (Program Files, en lecture seule) : il va dans AppData.
                 .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
                 .withWinWebView2Options(juce::WebBrowserComponent::Options::WinWebView2{}
                                             .withUserDataFolder(juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
                                                                     .getChildFile("Maudite Machine")
                                                                     .getChildFile("MM-ARP")
                                                                     .getChildFile("WebView2"))
                                             .withStatusBarDisabled()
                                             .withBackgroundColour(kInk))
#else
                 .withBackend(juce::WebBrowserComponent::Options::Backend::defaultBackend)
#endif
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
                 // v27 : la page SOUND visible ou non (l'analyseur ne calcule que pendant qu'on le regarde) ; v49 : et fenetre
                 // montree seulement (setShown)
                 .withEventListener("mm_view", [this](juce::var o) {
                     specWanted_ = static_cast<bool>(o.getProperty("spec", false));
                     proc_.setSpecOn(specWanted_ && shown_);
                 })
                 // v49 : la page cachee (fenetre recouverte, reduite, Live au second plan) ou de nouveau visible
                 .withEventListener("mm_vis", [this](juce::var o) {
                     faceVisible_ = static_cast<bool>(o.getProperty("on", true));
                     setShown(faceVisible_ && isShowing());
                 })
                 .withEventListener("mm_unmap", [this](juce::var o) {
                     proc_.unmap(static_cast<int>(o.getProperty("ch", 0)) - 1, static_cast<int>(o.getProperty("cc", -1)));
                 })
                 .withEventListener("mm_unmap_all", [this](juce::var) { proc_.unmapAll(); })
                 // v43 : la liste des presets du grand ecran ouverte (la face prend haut, bas et Entree) ou fermee (keysToHost)
                 .withEventListener("mm_keys", [this](juce::var o) {
                     if (!static_cast<bool>(o.getProperty("on", false))) keysToHost();
                 })
                 .withEventListener("mm_midimap_get", [this](juce::var) { emit("mm_midimap", proc_.midiMap()); })
                 .withEventListener("mm_ready", [this](juce::var) {
                     lastSeq_ = -1;
                     quietTicks_ = 1000;
                     modKey_ = "?";
                     cpuKey_.clear();
                     specHas_ = false;
                     faceVisible_ = true;
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
    // 2026-11-16 (Mika : "quand je change de piste et que je reviens ca revient tout petit") : la taille voulue est lue
    // AVANT setResizeLimits, qui force 880 sur l'editeur vide et ecrasait la taille memorisee via resized()
    const int wanted = proc_.editorWidth();
    // Sans moteur web (Windows sans le runtime WebView2) : pas de face, un message ; le plugin joue quand meme
    const auto opts = options();
    if (juce::WebBrowserComponent::areOptionsSupported(opts)) {
        browser_ = std::make_unique<Browser>(opts);
        addAndMakeVisible(*browser_);
    }
    // Redimensionnable a proportions fixes (2026-11-11, Mika : "je ne peux pas agrandir le plugin") : 880 a 2200 de large,
    // la face suit seule (src/v4/plugin/arp/scale.ts) ; la taille choisie est gardee dans le projet
    setResizable(true, true);
    getConstrainer()->setFixedAspectRatio(static_cast<double>(kW) / kH);
    // 2026-11-13 (Mika : "par defaut grossis l'app 2x") : 2200 de large par defaut, de 880 a 3300 ; 2026-11-17 (v26) :
    // 1870 par defaut (15 % plus petit) ; 2026-11-18 (v29, Mika : "20% moins grand quand on ouvre le vst et 20% moins
    // grand tout court") : 1496 par defaut, de 704 a 2640 (tout x0.8, PluginProcessor editorW7) ; jamais plus grand
    // que l'ecran (zone utile de l'ecran principal, marge pour la barre de fenetre d'Ableton)
    int maxW = kMaxW;
    if (const auto* d = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay()) {
        const auto a = d->userArea;
        maxW = juce::jmax(kMinW, juce::jmin(maxW, a.getWidth() - 40, (a.getHeight() - 90) * kW / kH));
    }
    setResizeLimits(kMinW, kMinW * kH / kW, kMaxW, kMaxW * kH / kW);
    const int w = juce::jlimit(kMinW, maxW, wanted);
    setSize(w, w * kH / kW);
    sizing_ = false;
    if (browser_) browser_->goToURL(juce::WebBrowserComponent::getResourceProviderRoot());
    startTimerHz(30);
}

MMArpEditor::~MMArpEditor() {
    stopTimer();
    // v49 : la fenetre fermee sur la page SOUND, l'analyseur ne recoit plus rien du thread audio
    proc_.setSpecOn(false);
}

/*
 * v49 (Mika : "soulager au max le CPU et eviter a tout prix la latence") : la face a l'ecran ou non. Cachee (la page le dit
 * par mm_vis : fenetre recouverte, reduite, Live au second plan ; ou la fenetre de l'editeur n'est plus montree), plus
 * rien ne part vers la WebView et l'analyseur s'arrete ; le minuteur ralentit a 4 Hz, le temps de voir revenir la
 * fenetre. Revenue : tout repart d'un coup (les potards changes entre-temps, la tete, le CPU, les arcs).
 */
void MMArpEditor::setShown(bool on) {
    if (on == shown_) return;
    shown_ = on;
    proc_.setSpecOn(specWanted_ && on);
    if (on) {
        quietTicks_ = 1000;
        modKey_ = "?"; // jamais egal : l'etat des arcs repart, meme vide
        cpuKey_.clear();
        specHas_ = false;
        modSent_ = true; // un etat des arcs part au retour (vide si plus rien n'est module)
        egKey_ = "?";    // v52 : l'etat des enveloppes aussi (vide si rien ne sonne)
        egSent_ = true;
        startTimerHz(30);
    } else {
        startTimerHz(4);
    }
}

void MMArpEditor::paint(juce::Graphics& g) {
    g.fillAll(kInk);
    if (browser_) return;
    g.setColour(juce::Colour(0xfff6f1e7));
    g.setFont(18.0f);
    g.drawFittedText("MM-ARP needs the Microsoft Edge WebView2 Runtime to show its face.\n"
                     "Install it from microsoft.com/edge/webview2, then reopen the plugin.\n"
                     "The plugin keeps playing in the meantime.",
                     getLocalBounds().reduced(40), juce::Justification::centred, 4);
}

void MMArpEditor::resized() {
    if (browser_) browser_->setBounds(getLocalBounds());
    if (!sizing_ && getWidth() >= kMinW) proc_.setEditorWidth(getWidth());
}

/*
 * v43 (Mika : "les presets je veux pouvoir les selectionner a la souris et avec la touche entree je valide le preset !") :
 * la liste des presets du grand ecran prend haut, bas et Entree (src/v4/hooks/useKeys.ts) tant qu'elle est ouverte ;
 * elle s'ouvre d'un clic dans la face, et ce clic donne deja le clavier a la WebView (WKWebView devient le premier
 * repondeur de la fenetre au clic) : rien a demander ici. Surtout pas browser_->grabKeyboardFocus() : dans JUCE 8
 * (juce_WebBrowserComponent_mac.mm), apres un resignFirstResponder de la WebView, le focus JUCE suivant part a la
 * traversee et finit en giveAwayKeyboardFocus, la WebView perdrait le clavier au lieu de le prendre.
 * Fermee (mm_keys {on: false}, envoye seulement si la page avait le clavier et qu'aucun champ de texte ne le tient) : la
 * vue JUCE de l'editeur redevient le premier repondeur (ComponentPeer::grabFocus) ; aucun composant JUCE ne prend de
 * touche (keyPressed rend false), chacune remonte la chaine des repondeurs jusqu'a l'hote : le clavier MIDI d'ordinateur
 * d'Ableton (v38) jusqu'au prochain clic dans la face. Non teste sur Mac ici (Linux, sans WebView) : a verifier par Mika.
 */
void MMArpEditor::keysToHost() {
    if (auto* peer = getPeer()) peer->grabFocus();
}

void MMArpEditor::setHint(const juce::String& m) {
    auto* o = new juce::DynamicObject();
    o->setProperty("ok", !m.startsWith("Aucun") && !m.startsWith("Impossible"));
    o->setProperty("msg", m);
    emit("mm_drag_status", juce::var(o));
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
    if (!ready_) return;
    // MIDI LEARN : la liste des CC a chaque changement (rare : meme face cachee, pour ne pas perdre le changement)
    if (proc_.takeMapChanged()) emit("mm_midimap", proc_.midiMap());
    // v49 : rien vers la face tant qu'elle n'est pas a l'ecran
    setShown(faceVisible_ && isShowing());
    if (!shown_) return;

    /*
     * v49 : un seul evenement mm_tick par tick (un seul appel a la WebView, au plus 30 par seconde), et seulement ce qui a
     * change : k (les potards bouges par l'hote), m (les arcs), t (la tete), c (le CPU), s (l'analyseur). Au repos, un seul
     * appel par seconde (la tete et le CPU ensemble : la face les sait vivants).
     */
    juce::DynamicObject::Ptr tick = new juce::DynamicObject();
    bool any = false;

    // Les potards que l'hote a changes (automation, MIDI Map, le triangle d'Ableton) vers la face (valeurs exactes)
    {
        juce::DynamicObject::Ptr changed = new juce::DynamicObject();
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
            tick->setProperty("k", juce::var(changed.get()));
            any = true;
        }
    }

    // L'arc lumineux (2026-11-16) : les reglages modules et leur valeur modulee, a 1 / 10 000 pres (0,03 degre de la
    // course : invisible), seulement s'ils ont bouge ; un dernier etat vide quand plus rien n'est module, puis plus rien
    {
        juce::Array<juce::var> ids, vals;
        juce::String key;
        const auto add = [&](const char* id, double v) {
            const long q = std::lround(v * 10000.0);
            ids.add(juce::String(id));
            vals.add(static_cast<double>(q) / 10000.0);
            key << id << ':' << juce::String(static_cast<juce::int64>(q)) << ';';
        };
        for (int i = 0; i < MMArpProcessor::kModN; ++i) {
            const float v = proc_.modValue(i);
            if (v != v) continue;
            add(MMArpProcessor::kModIds[i], static_cast<double>(v));
        }
        // v50 : chaque reglage hote vise par un emplacement actif de la matrice (xMx, cible 32 + k), sa valeur effective
        // (une fois par reglage ; cutoff, res... ont deja leur arc ci-dessus, qui compte aussi la matrice)
        for (int j = 0; j < mmx::kModSlots; ++j) {
            const int k = proc_.modShowK(j);
            if (k < 0 || k >= mmx::kAll) continue;
            const float v = proc_.modShowV(j);
            const juce::String id(mmx::allId(k));
            if (v != v || ids.contains(juce::var(id))) continue;
            add(mmx::allId(k), static_cast<double>(v));
        }
        // le VU du LFO de HELL (2026-11-17) : sa sortie, de 0 a 1
        const float hl = proc_.hellLfo();
        if (hl == hl) add("hellLfo", 0.5 + 0.5 * static_cast<double>(hl));
        // ATTITUDE, le VU de la page DISTO (v25) : de 0 a 1
        const float dv = proc_.distoVu();
        if (dv == dv) add("distoVu", static_cast<double>(dv));
        if ((!ids.isEmpty() || modSent_) && key != modKey_) {
            auto* o = new juce::DynamicObject();
            o->setProperty("ids", ids);
            o->setProperty("v", vals);
            tick->setProperty("m", juce::var(o));
            any = true;
            modSent_ = !ids.isEmpty();
        }
        modKey_ = key;
    }

    // v52 : l'ecran des enveloppes (la colonne FILTER EG / AMP EG de la face) : les deux enveloppes de la voix la plus
    // recente (niveaux, etapes, temps depuis le depart de la note et fin du gate), a 1 / 10 000 pres, seulement si quelque
    // chose a bouge ; un dernier etat vide quand plus rien ne sonne, puis plus rien (au repos : aucun envoi)
    {
        juce::Array<juce::var> ev;
        juce::String key;
        if (proc_.egValue(0) == proc_.egValue(0)) {
            for (int i = 0; i < MMArpProcessor::kEgN; ++i) {
                const long q = std::lround(static_cast<double>(proc_.egValue(i)) * 10000.0);
                ev.add(static_cast<double>(q) / 10000.0);
                key << juce::String(static_cast<juce::int64>(q)) << ',';
            }
        }
        if ((!ev.isEmpty() || egSent_) && key != egKey_) {
            tick->setProperty("e", ev);
            any = true;
            egSent_ = !ev.isEmpty();
        }
        egKey_ = key;
    }

    // La note jouee vers la face : a chaque note, a chaque depart ou arret (et une fois par seconde, au cas ou)
    bool beat = false;
    {
        const auto fb = proc_.feedback();
        ++quietTicks_;
        const double ppq = proc_.facePpq();
        const bool rolling = ppq >= 0;
        if (!(fb.seq == lastSeq_ && fb.playing == lastPlaying_ && fb.internal == lastInternal_ && rolling == lastRolling_ && quietTicks_ < 30)) {
            beat = quietTicks_ >= 30;
            lastRolling_ = rolling;
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
            // v46 (la tete de la page SEQ) : CHANCE a saute ce pas (midi -1 sans etre un silence), la duree du pas (ms)
            o->setProperty("skip", fb.playing && fb.skip);
            o->setProperty("dur", fb.dur);
            // v46 : la position du transport (noires) et le tempo : la tete de lecture de la page DELAY s'y cale
            if (rolling) o->setProperty("ppq", ppq);
            o->setProperty("bpm", proc_.faceBpm());
            tick->setProperty("t", juce::var(o));
            any = true;
        }
    }

    // v31 : le compteur CPU de la face : la charge de cette instance par etage (% du temps reel, lissee sur 250 ms) et son
    // pic tenu 1 s ; v49 : 5 fois par seconde (10 avant : chaque chiffre qui change redessine l'en-tete), au dixieme (ce
    // que la face affiche), seulement s'il change, et au moins une fois par seconde (avec le battement de la tete). La
    // fenetre fermee, l'editeur n'existe plus : rien ne tourne ni ne s'envoie.
    ++cpuQuiet_;
    if (++cpuTick_ >= 6 || (beat && cpuQuiet_ >= 15)) {
        cpuTick_ = 0;
        const auto r1 = [](float v) { return std::lround(static_cast<double>(v) * 10.0); };
        juce::Array<juce::var> sv;
        juce::String key;
        for (int i = 0; i < MMArpProcessor::kCpuN; ++i) {
            const long q = r1(proc_.cpu(i));
            sv.add(static_cast<double>(q) / 10.0);
            key << juce::String(static_cast<juce::int64>(q)) << ',';
        }
        const long pk = r1(proc_.cpuPeak());
        key << juce::String(static_cast<juce::int64>(pk)) << ',' << proc_.cpuOs() << ',' << proc_.cpuVoices() << ',' << (proc_.cpuPro() ? 1 : 0) << ','
            << juce::String(proc_.getSampleRate()) << ',' << proc_.getBlockSize();
        if (key != cpuKey_ || cpuQuiet_ >= 30 || beat) {
            cpuKey_ = key;
            cpuQuiet_ = 0;
            auto* o = new juce::DynamicObject();
            o->setProperty("s", sv);
            o->setProperty("pk", static_cast<double>(pk) / 10.0);
            o->setProperty("os", proc_.cpuOs());
            o->setProperty("voices", proc_.cpuVoices());
            o->setProperty("pro", proc_.cpuPro());
            o->setProperty("sr", proc_.getSampleRate());
            o->setProperty("block", proc_.getBlockSize());
            tick->setProperty("c", juce::var(o));
            any = true;
        }
    }

    // v27 : l'analyseur de la page SOUND, 15 fois par seconde, seulement page ouverte (96 bandes en dB entiers) ; v49 :
    // seulement si une bande a bouge (le silence, une fois retombe a -100, ne repart plus)
    if (proc_.specOn() && (++specTick_ & 1) == 0) {
        float db[mmarp::SpecAnalyzer::kBins];
        proc_.specFrame(db);
        bool same = specHas_;
        for (int i = 0; i < mmarp::SpecAnalyzer::kBins; ++i) {
            const int b = static_cast<int>(std::lround(db[i]));
            if (b != specSent_[static_cast<size_t>(i)]) same = false;
            specSent_[static_cast<size_t>(i)] = b;
        }
        if (!same) {
            specHas_ = true;
            juce::Array<juce::var> b;
            for (int v : specSent_) b.add(v);
            tick->setProperty("s", b);
            any = true;
        }
    }

    if (any) emit("mm_tick", juce::var(tick.get()));
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
                                  emit("mm_saved", juce::var(o));
                                  return;
                              }
                              if (!f.hasFileExtension("mmarp")) f = f.withFileExtension("mmarp");
                              const bool ok = f.replaceWithText(preset);
                              o->setProperty("ok", ok);
                              o->setProperty("name", f.getFileNameWithoutExtension());
                              o->setProperty("path", f.getFullPathName());
                              emit("mm_saved", juce::var(o));
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
    emit("mm_preset", juce::var(o));
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
    emit("mm_presets", juce::var(o));
}
