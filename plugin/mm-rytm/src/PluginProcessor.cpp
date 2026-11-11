#include "PluginProcessor.h"

#include "MidiExport.h"
#include "PluginEditor.h"
#include "SampleBank.h"

#include <algorithm>

namespace {

// La note MIDI d'entree -> la piste (-1 : ignoree) : les 16 pads d'un Drum Rack (C1 a D#2), les huit premieres pistes sur
// leurs notes GM ; la meme table que l'export MIDI (dsp/MidiExport.h kTrackNote, 2026-11-09) : un clip exporte rejoue le plugin.
int trackOfNote(int note) { return mm::trackOfMidiNote(note); }

float dbToGain(float db) { return db <= -59.9f ? 0.f : juce::Decibels::decibelsToGain(db); }

double num(const juce::var& o, const char* k, double def) {
    const juce::var v = o.getProperty(k, juce::var());
    return v.isDouble() || v.isInt() || v.isInt64() ? static_cast<double>(v) : def;
}

bool flag(const juce::var& o, const char* k) {
    const juce::var v = o.getProperty(k, juce::var());
    return v.isBool() ? static_cast<bool>(v) : (v.isInt() || v.isDouble() ? static_cast<double>(v) != 0 : false);
}

// Un son du programme (src/v4/plugin/bridge.ts ProgSound) : le moteur, la recette du site, STRETCH, la hauteur.
bool parseSound(const juce::var& o, mm::ProgSound& s) {
    if (!o.isObject()) return false;
    if (!mm::shotFromSiteId(o.getProperty("id", "").toString().toStdString(), s.id)) return false;
    const juce::var tw = o.getProperty("tw", juce::var());
    const juce::String model = tw.getProperty("model", "mm").toString();
    s.tw.model = model == "909" ? mm::KitModel::K909 : model == "808" ? mm::KitModel::K808 : mm::KitModel::MM;
    s.tw.tune = num(tw, "tune", 0.5);
    s.tw.attack = num(tw, "attack", 0.5);
    s.tw.decay = num(tw, "decay", 0.45);
    s.tw.drive = num(tw, "drive", 0.25);
    s.tw.snappy = num(tw, "snappy", 0.5);
    s.tw.gate = flag(tw, "gate");
    s.tw.sweep = num(tw, "sweep", 0.5);
    s.tw.sdTune = num(tw, "sdTune", 0.5);
    s.tw.sdDecay = num(tw, "sdDecay", 0.5);
    s.tw.sdTone = num(tw, "sdTone", 0.5);
    s.tw.syn = num(tw, "syn", 1.0);
    const juce::var smpKey = tw.getProperty("sample", juce::var());
    s.sample = smpKey.isString() ? smpKey.toString().toStdString() : std::string();
    const juce::var smp = tw.getProperty("smp", juce::var());
    if (smp.isObject()) {
        s.tw.smp.lev = num(smp, "lev", 1);
        s.tw.smp.st = num(smp, "st", 0);
        s.tw.smp.start = num(smp, "start", 0);
        s.tw.smp.len = num(smp, "len", 1);
        s.tw.smp.rev = flag(smp, "rev");
    }
    s.ts = num(o, "ts", 1);
    s.pf = std::max(1e-3, num(o, "pf", 1));
    s.variants = flag(o, "variants");
    return true;
}

void parseHit(const juce::var& o, mm::ProgHit& h) {
    h.g = static_cast<int>(num(o, "g", -1));
    h.vel = static_cast<float>(num(o, "vel", 1));
    h.snd = static_cast<int>(num(o, "snd", -1));
    h.tau = num(o, "tau", -1);
    h.atk = num(o, "atk", 0);
    h.hold = num(o, "hold", 0.004);
    h.gain = num(o, "gain", 1);
    h.pan = num(o, "pan", 0);
    h.start = num(o, "start", 0);
    h.ft = static_cast<int>(num(o, "ft", 0));
    h.fhz = num(o, "fhz", 20000);
    h.fq = std::max(1e-3, num(o, "fq", 0.7071));
    h.foct = num(o, "foct", 0);
    h.fatk = num(o, "fatk", 0);
    h.ftau = std::max(1e-4, num(o, "ftau", 0.1));
    h.len = num(o, "len", -1);
    h.prob = static_cast<int>(num(o, "prob", 100));
    h.ck = static_cast<int>(num(o, "ck", 0));
    h.cn = num(o, "cn", 0) != 0;
    h.ca = static_cast<int>(num(o, "ca", 0));
    h.cb = static_cast<int>(num(o, "cb", 0));
    h.shift = num(o, "shift", 0);
    h.rtrg = num(o, "rtrg", 0) != 0;
    h.every = std::max(1.0 / 8, num(o, "every", 1));
    h.vfad = static_cast<int>(num(o, "vfad", 0));
    h.rlen = num(o, "rlen", 1);
    h.lt = num(o, "lt", 0) != 0;
    if (const auto* sl = o.getProperty("sl", juce::var()).getArray(); sl && sl->size() >= 5) {
        h.hasSl = true;
        h.sl = {static_cast<double>((*sl)[0]), static_cast<double>((*sl)[1]), static_cast<double>((*sl)[2]), static_cast<double>((*sl)[3]), static_cast<double>((*sl)[4])};
    }
    // Les LFO : [n, spd, mult, fade, dest, wave, phase, mode, depth] aux rangs du site (dsp/Lfo.h)
    h.nlfo = 0;
    if (const auto* ls = o.getProperty("lfo", juce::var()).getArray())
        for (const auto& lv : *ls) {
            const auto* a = lv.getArray();
            if (!a || a->size() < 9 || h.nlfo >= 2) continue;
            auto at = [&](int i) { return static_cast<double>((*a)[i]); };
            mm::Lfo& l = h.lfo[h.nlfo];
            l.n = static_cast<int>(at(0)) == 2 ? 2 : 1;
            l.spd = juce::jlimit(-64, 63, static_cast<int>(at(1)));
            l.mult = juce::jlimit(1, 128, static_cast<int>(at(2)));
            l.fade = juce::jlimit(-64, 63, static_cast<int>(at(3)));
            l.dest = juce::jlimit(0, static_cast<int>(mm::LD_DECAY), static_cast<int>(at(4)));
            l.wave = juce::jlimit(0, static_cast<int>(mm::LW_RND), static_cast<int>(at(5)));
            l.phase = juce::jlimit(0.0, 1.0, at(6));
            l.mode = juce::jlimit(0, static_cast<int>(mm::LM_HLF), static_cast<int>(at(7)));
            l.depth = juce::jlimit(-1.0, 1.0, at(8));
            if (l.dest != mm::LD_OFF && l.depth != 0) ++h.nlfo;
        }
    h.lfot = num(o, "lfot", 1) != 0;
    if (const auto* lb = o.getProperty("lb", juce::var()).getArray(); lb && lb->size() >= 3) {
        h.lbLevel = static_cast<double>((*lb)[0]);
        h.lbReso = static_cast<double>((*lb)[1]);
        h.lbDecay = static_cast<double>((*lb)[2]);
    }
    h.fp = num(o, "fp", 0) != 0;
    h.lk = static_cast<int>(num(o, "lk", 0));
    h.lc = num(o, "lc", 20000);
}

// Les effets globaux du programme (pattern.fx par morph.fx, TONE et LEVEL du mix)
void parseFx(const juce::var& o, mm::GlobalFx& g) {
    if (!o.isObject()) return;
    g.drive = num(o, "drive", g.drive);
    g.reverb = num(o, "reverb", g.reverb);
    g.delay = num(o, "delay", g.delay);
    g.chorus = num(o, "chorus", g.chorus);
    g.dtime = num(o, "dtime", g.dtime);
    g.dfb = num(o, "dfb", g.dfb);
    g.bits = num(o, "bits", g.bits);
    g.comp = num(o, "comp", g.comp);
    g.dtone = num(o, "dtone", g.dtone);
    g.rsize = num(o, "rsize", g.rsize);
    g.rtone = num(o, "rtone", g.rtone);
    g.rpre = num(o, "rpre", g.rpre);
    g.xtone = num(o, "xtone", g.xtone);
    g.crate = num(o, "crate", g.crate);
    g.cdepth = num(o, "cdepth", g.cdepth);
    g.brate = num(o, "brate", g.brate);
    g.catk = num(o, "catk", g.catk);
    g.crel = num(o, "crel", g.crel);
    g.cthr = num(o, "cthr", g.cthr);
    g.cratio = num(o, "cratio", g.cratio);
    g.cknee = num(o, "cknee", g.cknee);
    g.cmake = num(o, "cmake", g.cmake);
    g.chpf = num(o, "chpf", g.chpf);
    g.tone = num(o, "tone", g.tone);
    g.level = num(o, "level", g.level);
}

void parseXk(const juce::var& o, mm::Program& p);

bool parseProgram(const juce::String& json, mm::Program& p) {
    const juce::var o = juce::JSON::parse(json);
    if (!o.isObject() || static_cast<int>(num(o, "v", 0)) != 1) return false;
    p.bpm = num(o, "bpm", 130);
    p.len = std::max(1, std::min(128, static_cast<int>(num(o, "len", 16))));
    p.loop = static_cast<int>(num(o, "loop", -1));
    p.swing = num(o, "swing", 0);
    parseFx(o.getProperty("fx", juce::var()), p.fx);
    p.sounds.clear();
    if (const auto* arr = o.getProperty("sounds", juce::var()).getArray())
        for (const auto& sv : *arr) {
            mm::ProgSound s;
            if (!parseSound(sv, s)) s = mm::ProgSound{}; // garde les indices alignes
            p.sounds.push_back(s);
        }
    if (const auto* arr = o.getProperty("tracks", juce::var()).getArray())
        for (int t = 0; t < std::min(mm::kProgTracks, arr->size()); ++t) {
            const juce::var& tv = arr->getReference(t);
            auto& tr = p.tracks[static_cast<size_t>(t)];
            tr.slice = static_cast<float>(num(tv, "slice", 1));
            tr.plays = flag(tv, "plays");
            tr.mono = flag(tv, "mono");
            tr.choke = static_cast<int>(num(tv, "choke", 0));
            tr.gated = flag(tv, "gated");
            tr.kick = flag(tv, "kick");
            tr.tlen = std::max(0, std::min(128, static_cast<int>(num(tv, "tlen", 0))));
            if (const auto* sl = tv.getProperty("sl", juce::var()).getArray(); sl && sl->size() >= 5)
                tr.sl = {static_cast<double>((*sl)[0]), static_cast<double>((*sl)[1]), static_cast<double>((*sl)[2]), static_cast<double>((*sl)[3]), static_cast<double>((*sl)[4])};
            parseHit(tv.getProperty("live", juce::var()), tr.live);
            tr.hits.clear();
            if (const auto* hs = tv.getProperty("hits", juce::var()).getArray())
                for (const auto& hv : *hs) {
                    mm::ProgHit h;
                    parseHit(hv, h);
                    tr.hits.push_back(h);
                }
        }
    parseXk(o, p);
    p.slot = std::max(0, std::min(127, static_cast<int>(num(o, "slot", 0))));
    // Les autres patterns remplis : le kit d'ici, leurs coups, leur mute, leurs scenes
    p.pats.clear();
    if (const auto* ps = o.getProperty("pats", juce::var()).getArray())
        for (const auto& pv : *ps) {
            mm::Program q = p;
            q.sounds.clear();
            q.pats.clear();
            q.slot = std::max(0, std::min(127, static_cast<int>(num(pv, "slot", 0))));
            if (q.slot == p.slot) continue;
            q.len = std::max(1, std::min(128, static_cast<int>(num(pv, "len", 16))));
            q.loop = static_cast<int>(num(pv, "loop", -1));
            if (const auto* arr = pv.getProperty("tracks", juce::var()).getArray())
                for (int t = 0; t < std::min(mm::kProgTracks, arr->size()); ++t) {
                    const juce::var& tv = arr->getReference(t);
                    auto& tr = q.tracks[static_cast<size_t>(t)];
                    tr.plays = flag(tv, "plays");
                    tr.tlen = std::max(0, std::min(128, static_cast<int>(num(tv, "tlen", 0))));
                    tr.hits.clear();
                    if (const auto* hs = tv.getProperty("hits", juce::var()).getArray())
                        for (const auto& hv : *hs) {
                            mm::ProgHit h;
                            parseHit(hv, h);
                            tr.hits.push_back(h);
                        }
                }
            parseXk(pv, q);
            p.pats.push_back(std::move(q));
        }
    return true;
}

// Les scenes : le programme aux positions du crossfader (les memes coups, dans le meme ordre ; sinon ignorees)
void parseXk(const juce::var& o, mm::Program& p) {
    p.xk.clear();
    if (const auto* xs = o.getProperty("xk", juce::var()).getArray(); xs && xs->size() >= 2) {
        bool same = true;
        for (const auto& xv : *xs) {
            mm::ProgX x;
            parseFx(xv.getProperty("fx", juce::var()), x.fx);
            const auto* arr = xv.getProperty("tracks", juce::var()).getArray();
            for (int t = 0; arr && t < std::min(mm::kProgTracks, arr->size()); ++t) {
                const juce::var& tv = arr->getReference(t);
                auto& tr = x.tracks[static_cast<size_t>(t)];
                tr.slice = static_cast<float>(num(tv, "slice", 1));
                if (const auto* sl = tv.getProperty("sl", juce::var()).getArray(); sl && sl->size() >= 5)
                    tr.sl = {static_cast<double>((*sl)[0]), static_cast<double>((*sl)[1]), static_cast<double>((*sl)[2]), static_cast<double>((*sl)[3]), static_cast<double>((*sl)[4])};
                parseHit(tv.getProperty("live", juce::var()), tr.live);
                if (const auto* hs = tv.getProperty("hits", juce::var()).getArray())
                    for (const auto& hv : *hs) {
                        mm::ProgHit h;
                        parseHit(hv, h);
                        tr.hits.push_back(h);
                    }
                if (tr.hits.size() != p.tracks[static_cast<size_t>(t)].hits.size()) same = false;
            }
            p.xk.push_back(std::move(x));
        }
        if (!same) p.xk.clear();
    }
}

} // namespace

/* ---------------- le calcul des sons, hors du thread audio ---------------- */

struct MMRytmProcessor::Renderer : juce::Thread {
    MMRytmProcessor& p;
    juce::WaitableEvent wake;
    explicit Renderer(MMRytmProcessor& proc) : juce::Thread("MM-RYTM render"), p(proc) {}
    void run() override {
        while (!threadShouldExit()) {
            p.renderLoop();
            wake.wait(100);
        }
    }
};

std::shared_ptr<mm::RenderedSound> MMRytmProcessor::soundFor(const mm::ProgSound& s, double sr) {
    const std::string key = s.key();
    if (auto it = cache_.find(key); it != cache_.end()) return it->second;
    auto r = std::make_shared<mm::RenderedSound>();
    mm::ShotTweak tw = s.tw;
    const mm::SamplePcm* pcm = nullptr;
    if (!s.sample.empty()) {
        const juce::String skey(s.sample);
        // Un sample perso (le dossier ~/Music/MM-RYTM Samples) ou un sample de la banque
        const auto* b = mm::UserLibrary::isUserKey(skey) ? mm::UserLibrary::get().byKey(skey) : mm::SampleBank::get().byKey(skey);
        if (b) pcm = &b->pcm;
    }
    // Un sample absent de la banque (un sample perso du navigateur, la banque synthetisee) : la couche SAMPLE se tait
    tw.hasSample = pcm != nullptr;
    const int nv = s.variants && tw.syn > 0 ? mm::variantsOf(s.id) : 1;
    // Le son a sa hauteur : calcule a sr / pf, lu a vitesse 1 (audio/shots.ts)
    for (int v = 0; v < nv; ++v) r->variants.push_back(mm::renderLayers(s.id, sr / s.pf, s.ts, v, tw, pcm));
    cache_[key] = r;
    engine_.own(r);
    return r;
}

std::shared_ptr<mm::PlayState> MMRytmProcessor::buildState(const mm::Program& prog, double sr) {
    auto ps = std::make_shared<mm::PlayState>();
    ps->prog = prog;
    // La REVERB du site (fx.ts makeImpulse, identique bit a bit) : une reponse par forme, gardee tant qu'un etat la joue ;
    // les scenes : celle de chaque position du crossfader
    std::map<std::string, std::shared_ptr<mm::ReverbIR>> used;
    auto irFor = [&](const mm::GlobalFx& g) {
        const double sec = mm::FxLaws::reverbSeconds(g.rsize), hi = mm::FxLaws::reverbHiEnd(g.rtone), pre = mm::FxLaws::reverbPre(g.rpre);
        const std::string key = juce::String(sec, 6).toStdString() + "|" + juce::String(hi, 3).toStdString() + "|" + juce::String(pre, 6).toStdString() + "|" + juce::String(sr).toStdString();
        auto it = irCache_.find(key);
        std::shared_ptr<mm::ReverbIR> ir = it != irCache_.end() ? it->second : mm::ReverbIR::make(sec, hi, pre, sr);
        used[key] = ir;
        return ir;
    };
    ps->reverbIR = irFor(prog.fx);
    auto irsOf = [&](const mm::Program& q) {
        std::vector<std::shared_ptr<mm::ReverbIR>> v;
        for (const auto& x : q.xk) v.push_back(irFor(x.fx));
        return v;
    };
    ps->irKs.push_back(irsOf(prog));
    for (const auto& q : prog.pats) ps->irKs.push_back(irsOf(q));
    irCache_ = std::move(used);
    for (const auto& s : prog.sounds) {
        ps->sounds.push_back(soundFor(s, sr));
        ps->keys.push_back(s.key());
    }
    for (const auto& [k, r] : extras_) {
        ps->sounds.push_back(r);
        ps->keys.push_back(k);
    }
    return ps;
}

void MMRytmProcessor::renderLoop() {
    const double sr = sr_.load();
    if (sr <= 0) return;
    std::unique_ptr<mm::Program> prog;
    std::vector<std::pair<mm::ProgSound, mm::LiveHit>> live;
    {
        std::lock_guard<std::mutex> lk(mx_);
        prog = std::move(pendingProgram_);
        live.swap(pendingLive_);
    }
    bool rebuild = false;
    if (sr != builtSr_) {
        // Une autre frequence : tous les sons se recalculent
        cache_.clear();
        extras_.clear();
        builtSr_ = sr;
        rebuild = haveProgram_;
    }
    if (prog) {
        current_ = *prog;
        haveProgram_ = true;
        rebuild = true;
    }
    // Les sons joues en direct que le programme n'avait pas (un apercu de SOUNDS) : calcules, gardes (64 au plus)
    for (auto& [s, h] : live) {
        auto r = soundFor(s, sr);
        const std::string k = s.key();
        if (std::none_of(extras_.begin(), extras_.end(), [&](const auto& e) { return e.first == k; })) {
            extras_.emplace_back(k, r);
            if (extras_.size() > 64) extras_.erase(extras_.begin());
        }
        h.snd = r.get();
        rebuild = true;
    }
    if (rebuild && haveProgram_) {
        auto ps = buildState(current_, sr);
        // Le cache ne garde que les sons de l'etat publie (les autres partent avec leur dernier etat)
        for (auto it = cache_.begin(); it != cache_.end();) {
            if (std::find(ps->keys.begin(), ps->keys.end(), it->first) == ps->keys.end()) it = cache_.erase(it);
            else ++it;
        }
        engine_.publish(ps);
    }
    // Les coups qui attendaient leur son : ils partent maintenant
    for (auto& [s, h] : live) {
        std::lock_guard<std::mutex> lk(pushMx_);
        engine_.pushLive(h);
    }
    engine_.collect(juce::Time::getMillisecondCounterHiRes() / 1000.0);
}

/* ---------------- les parametres et l'etat ---------------- */

juce::AudioProcessorValueTreeState::ParameterLayout MMRytmProcessor::makeLayout() {
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{"master", 1}, "Master", juce::NormalisableRange<float>(-60, 6, 0.1f, 2.5f), 0.f));
    // Le crossfader des scenes (2026-11-08, Octatrack) : A a 0, B a 1 ; automatisable, mappable a un controleur dans Ableton
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{"xfade", 1}, "Crossfader", juce::NormalisableRange<float>(0, 1), 0.f));
    return layout;
}

MMRytmProcessor::MMRytmProcessor()
    : AudioProcessor(BusesProperties().withOutput("Main", juce::AudioChannelSet::stereo(), true)), apvts(*this, nullptr, "MMRYTM", makeLayout()) {
    master_ = apvts.getRawParameterValue("master");
    xfade_ = apvts.getRawParameterValue("xfade");
    renderer_ = std::make_unique<Renderer>(*this);
    renderer_->startThread(juce::Thread::Priority::normal);
}

MMRytmProcessor::~MMRytmProcessor() {
    renderer_->signalThreadShouldExit();
    renderer_->wake.signal();
    renderer_->stopThread(3000);
}

void MMRytmProcessor::faceProgram(const juce::String& json) {
    auto p = std::make_unique<mm::Program>();
    if (!parseProgram(json, *p)) return;
    progBpm_.store(p->bpm);
    {
        std::lock_guard<std::mutex> lk(mx_);
        programJson_ = json;
        pendingProgram_ = std::move(p);
    }
    progVer_.fetch_add(1, std::memory_order_relaxed);
    renderer_->wake.signal();
}

// L'export MIDI (2026-11-09) : le pattern que joue le moteur (son emplacement, celui de la face ou l'un des autres du
// programme), rejoue par dsp/MidiExport.cpp ; un emplacement vide : aucune note.
MMRytmProcessor::MidiExport MMRytmProcessor::exportMidi() const {
    MidiExport out;
    juce::String json;
    {
        std::lock_guard<std::mutex> lk(mx_);
        json = programJson_;
    }
    mm::Program p;
    if (json.isEmpty() || !parseProgram(json, p)) return out;
    const int playing = engine_.fbPat.load();
    const mm::Program* use = &p;
    if (playing >= 0 && playing != p.slot) {
        use = nullptr;
        for (const auto& q : p.pats)
            if (q.slot == playing) use = &q;
    }
    out.slot = use ? use->slot : (playing >= 0 ? playing : p.slot);
    out.name = "MM-RYTM " + juce::String(mm::slotName(out.slot));
    if (!use) {
        out.ok = true;
        return out;
    }
    const auto r = mm::exportPattern(*use);
    out.ok = true;
    out.steps = r.steps;
    out.notes = static_cast<int>(r.notes.size());
    out.capped = r.capped;
    out.bytes = mm::writeSmf(r, p.bpm, out.name.toStdString());
    return out;
}

void MMRytmProcessor::faceState(const juce::String& lsJson) {
    std::lock_guard<std::mutex> lk(mx_);
    lsJson_ = lsJson;
}

juce::String MMRytmProcessor::faceInitState() const {
    std::lock_guard<std::mutex> lk(mx_);
    return lsJson_;
}

void MMRytmProcessor::faceHit(const juce::var& o) {
    mm::ProgSound s;
    if (!parseSound(o.getProperty("sound", juce::var()), s)) return;
    mm::LiveHit h;
    h.track = static_cast<int>(num(o, "t", -1));
    if (h.track < 0 || h.track >= mm::kTracks) return;
    h.slice = static_cast<float>(num(o, "slice", 1));
    parseHit(o, h.hit);
    h.hit.vel = static_cast<float>(num(o, "vel", 1));
    // Son deja calcule (le cas courant : le son du pad est dans le programme) : il part tout de suite
    const std::string key = s.key();
    if (auto ps = engine_.latest()) {
        for (size_t i = 0; i < ps->keys.size(); ++i)
            if (ps->keys[i] == key && ps->sounds[i]) {
                h.snd = ps->sounds[i].get();
                std::lock_guard<std::mutex> lk(pushMx_);
                engine_.pushLive(h);
                return;
            }
    }
    // Sinon il se calcule, et le coup part juste apres
    {
        std::lock_guard<std::mutex> lk(mx_);
        pendingLive_.emplace_back(s, h);
    }
    renderer_->wake.signal();
}

void MMRytmProcessor::faceRun(bool on) { runInternal_.store(on); }

void MMRytmProcessor::facePtn(const juce::var& o) {
    std::array<int, 64> chain{};
    int n = 0;
    if (const auto* arr = o.getProperty("chain", juce::var()).getArray())
        for (const auto& v : *arr)
            if (n < static_cast<int>(chain.size())) chain[static_cast<size_t>(n++)] = juce::jlimit(0, 127, static_cast<int>(v));
    engine_.queuePatterns(static_cast<int>(num(o, "next", -1)), chain.data(), n);
}

void MMRytmProcessor::faceXf(float x) {
    if (auto* prm = apvts.getParameter("xfade")) {
        prm->beginChangeGesture();
        prm->setValueNotifyingHost(juce::jlimit(0.f, 1.f, x));
        prm->endChangeGesture();
    }
}

MMRytmProcessor::Feedback MMRytmProcessor::feedback() const {
    return {engine_.fbPlaying.load(), internalPlaying_.load(), engine_.fbStep.load(), engine_.fbSeq.load(), engine_.fbMask.load(), static_cast<double>(xfade_->load()), engine_.fbPat.load(), engine_.fbPatSeq.load(), engine_.fbRel.load()};
}

void MMRytmProcessor::getStateInformation(juce::MemoryBlock& destData) {
    juce::ValueTree state("MMRYTM2");
    state.setProperty("master", master_->load(), nullptr);
    state.setProperty("xfade", xfade_->load(), nullptr);
    if (uiW_.load() > 0) state.setProperty("uiW", uiW_.load(), nullptr);
    {
        std::lock_guard<std::mutex> lk(mx_);
        state.setProperty("program", programJson_, nullptr);
        state.setProperty("ls", lsJson_, nullptr);
    }
    if (auto xml = state.createXml()) copyXmlToBinary(*xml, destData);
}

void MMRytmProcessor::setStateInformation(const void* data, int sizeInBytes) {
    auto xml = getXmlFromBinary(data, sizeInBytes);
    if (!xml || !xml->hasTagName("MMRYTM2")) return;
    const auto state = juce::ValueTree::fromXml(*xml);
    if (auto* prm = apvts.getParameter("master"))
        prm->setValueNotifyingHost(prm->convertTo0to1(static_cast<float>(static_cast<double>(state.getProperty("master", 0.0)))));
    if (auto* prm = apvts.getParameter("xfade"))
        prm->setValueNotifyingHost(juce::jlimit(0.f, 1.f, static_cast<float>(static_cast<double>(state.getProperty("xfade", 0.0)))));
    uiW_.store(static_cast<int>(state.getProperty("uiW", 0)));
    {
        std::lock_guard<std::mutex> lk(mx_);
        lsJson_ = state.getProperty("ls", "").toString();
    }
    // Le programme garde : le plugin joue fenetre fermee des le chargement du projet
    const juce::String prog = state.getProperty("program", "").toString();
    if (prog.isNotEmpty()) faceProgram(prog);
}

/* ---------------- l'audio ---------------- */

bool MMRytmProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo() && layouts.inputBuses.isEmpty();
}

void MMRytmProcessor::prepareToPlay(double sampleRate, int) {
    if (sampleRate != sr_.load()) {
        engine_.prepare(sampleRate);
        sr_.store(sampleRate);
        renderer_->wake.signal();
    }
    // L'avance du LIMITEUR (3 ms) : Ableton la compense, le MM-RYTM tombe pile avec les autres pistes
    setLatencySamples(engine_.latency());
}

void MMRytmProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi) {
    juce::ScopedNoDenormals noDenormals;
    const int n = buffer.getNumSamples();
    buffer.clear();
    const double sr = getSampleRate() > 0 ? getSampleRate() : sr_.load();

    // Les notes MIDI (un clip d'Ableton) : GM vers les huit premieres pistes
    std::array<mm::NoteEvent, 256> notes;
    int nn = 0;
    for (const auto meta : midi) {
        const auto msg = meta.getMessage();
        if (msg.isNoteOn() && nn < static_cast<int>(notes.size())) {
            const int t = trackOfNote(msg.getNoteNumber());
            if (t >= 0) notes[static_cast<size_t>(nn++)] = {t, msg.getFloatVelocity(), meta.samplePosition};
        } else if (msg.isProgramChange()) {
            // Un program change (le Pgm d'un clip d'Ableton) : le pattern 1 a 128 (A01 a H16), a la fin du pattern en lecture
            engine_.programChange(msg.getProgramChangeNumber());
        } else if (msg.isAllNotesOff() || msg.isAllSoundOff()) {
            engine_.allNotesOff();
        }
    }

    // Le transport : celui de l'hote s'il joue, sinon l'horloge interne (RUN de la face)
    mm::BlockTransport tr;
    double bpm = progBpm_.load();
    bool hostPlaying = false;
    if (auto* ph = getPlayHead())
        if (auto pos = ph->getPosition())
            if (pos->getIsPlaying() && pos->getPpqPosition()) {
                hostPlaying = true;
                tr.ppq = *pos->getPpqPosition();
                if (pos->getBpm()) bpm = *pos->getBpm();
            }
    bool internal = false;
    if (!hostPlaying && runInternal_.load()) {
        if (!internalPlaying_.load()) internalPpq_ = 0;
        internal = true;
        tr.ppq = internalPpq_;
    }
    // L'hote reprend la main : RUN s'eteint
    if (hostPlaying && runInternal_.load()) runInternal_.store(false);
    internalPlaying_.store(internal);
    tr.playing = hostPlaying || internal;
    tr.ppqPerSample = bpm / 60.0 / sr;
    if (internal) internalPpq_ += n * tr.ppqPerSample;

    engine_.setX(xfade_->load());
    engine_.process(tr, buffer.getWritePointer(0), buffer.getWritePointer(1), n, notes.data(), nn);
    buffer.applyGain(dbToGain(master_->load()));
    // Les VU-metres : la crete de la sortie (apres MAIN VOLUME)
    for (int ch = 0; ch < 2; ++ch) {
        const float p = buffer.getMagnitude(ch, 0, n);
        if (p > outPk_[ch].load(std::memory_order_relaxed)) outPk_[ch].store(p, std::memory_order_relaxed);
    }
}

bool MMRytmProcessor::takeMeters(float* tracks16, float& l, float& r) {
    const float g = dbToGain(master_->load());
    bool any = false;
    for (int t = 0; t < 16; ++t) {
        tracks16[t] = engine_.fbPeak[static_cast<size_t>(t)].exchange(0.f, std::memory_order_relaxed) * g;
        any = any || tracks16[t] > 1e-5f;
    }
    l = outPk_[0].exchange(0.f, std::memory_order_relaxed);
    r = outPk_[1].exchange(0.f, std::memory_order_relaxed);
    return any || l > 1e-5f || r > 1e-5f;
}

juce::AudioProcessorEditor* MMRytmProcessor::createEditor() { return new MMRytmEditor(*this); }

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MMRytmProcessor(); }
