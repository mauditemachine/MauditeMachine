#include "HellLook.h"

#include "HellAssets.h"

#include <atomic>
#include <cmath>
#include <cstring>

namespace hl {

namespace {

// Un fichier de assets/ par son nom d'origine
const void* bytes(const char* file, int& size) {
    for (int i = 0; i < HellAssets::namedResourceListSize; ++i)
        if (std::strcmp(HellAssets::originalFilenames[i], file) == 0) return HellAssets::getNamedResource(HellAssets::namedResourceList[i], size);
    size = 0;
    jassertfalse;
    return nullptr;
}

juce::Typeface::Ptr typeface(const char* file) {
    int n = 0;
    const void* d = bytes(file, n);
    return d ? juce::Typeface::createSystemTypefaceFor(d, static_cast<size_t>(n)) : nullptr;
}

juce::Image load(const char* file) {
    int n = 0;
    const void* d = bytes(file, n);
    return d ? juce::ImageCache::getFromMemory(d, n) : juce::Image();
}

std::atomic<uint32_t> gAccent{0xffff0066u};

} // namespace

juce::Colour accent() { return juce::Colour(gAccent.load(std::memory_order_relaxed)); }

juce::Colour hueColour(float hueDeg) {
    // accent.ts hsvHex(hue, 1) : la roue des teintes vives
    const float h = std::fmod(std::fmod(hueDeg, 360.f) + 360.f, 360.f) / 60.f;
    const auto f = [h](float n) {
        const float k = std::fmod(n + h, 6.f);
        return 1.f - juce::jmax(0.f, juce::jmin(k, 4.f - k, 1.f));
    };
    return juce::Colour::fromFloatRGBA(f(5), f(3), f(1), 1.f);
}

Look::Look() {
    juce::PropertiesFile::Options o;
    o.applicationName = "MM-HELL";
    o.folderName = "Maudite Machine";
    o.filenameSuffix = ".settings";
    o.osxLibrarySubFolder = "Application Support";
    o.millisecondsBeforeSaving = 400;
    file_ = std::make_unique<juce::PropertiesFile>(o);
    State st;
    st.leather = static_cast<float>(file_->getDoubleValue("leather", st.leather));
    st.light = static_cast<float>(file_->getDoubleValue("light", st.light));
    st.hue = file_->getIntValue("hue", st.hue);
    s_ = State{-1.f, -1.f, -1};
    set(st);
}

Look::~Look() {
    if (file_) file_->saveIfNeeded();
}

void Look::set(State s) {
    // au centieme (les curseurs montrent 0 a 100), une teinte entiere 0..359 (look.ts)
    s.leather = std::round(juce::jlimit(0.f, 1.f, s.leather) * 100.f) / 100.f;
    s.light = std::round(juce::jlimit(0.f, 1.f, s.light) * 100.f) / 100.f;
    s.hue = ((s.hue % 360) + 360) % 360;
    if (std::fabs(s.leather - s_.leather) < 1e-6f && std::fabs(s.light - s_.light) < 1e-6f && s.hue == s_.hue) return;
    const bool first = s_.hue < 0;
    s_ = s;
    gAccent.store(hueColour(static_cast<float>(s.hue)).getARGB(), std::memory_order_relaxed);
    if (first) return;
    file_->setValue("leather", static_cast<double>(s.leather));
    file_->setValue("light", static_cast<double>(s.light));
    file_->setValue("hue", s.hue);
    sendChangeMessage();
}

juce::Font font(float pt, Weight w, float tracking) {
    static const juce::Typeface::Ptr medium = typeface("SF-Pro-Display-Medium.otf");
    static const juce::Typeface::Ptr semibold = typeface("SF-Pro-Display-Semibold.otf");
    static const juce::Typeface::Ptr bold = typeface("SF-Pro-Display-Bold.otf");
    const auto& tf = w == Weight::Medium ? medium : w == Weight::Bold ? bold : semibold;
    return juce::Font(juce::FontOptions{}.withTypeface(tf).withPointHeight(pt).withKerningFactor(tracking));
}

juce::Font nameFont(float pt) {
    static const juce::Typeface::Ptr mont = typeface("Montserrat-Bold.ttf");
    // l'interlettrage de JUCE est une part de la hauteur de la police (1.219 em pour Montserrat) : -0.05 em
    return juce::Font(juce::FontOptions{}.withTypeface(mont).withPointHeight(pt).withKerningFactor(-0.05f / 1.219f));
}

void drawLogo(juce::Graphics& g, Logo which, juce::Rectangle<float> area, juce::Colour c, juce::RectanglePlacement placement) {
    static const auto parse = [](const char* file) {
        int n = 0;
        const void* d = bytes(file, n);
        return d ? juce::Drawable::createFromImageData(d, static_cast<size_t>(n)) : nullptr;
    };
    static const std::unique_ptr<juce::Drawable> stack = parse("mauditemachine-logo.svg"), mark = parse("mauditemachine-logotype.svg");
    const auto& src = which == Logo::Stack ? stack : mark;
    if (!src) return;
    auto d = src->createCopy();
    d->replaceColour(juce::Colours::white, c);
    d->drawWithin(g, area, placement, 1.f);
}

const juce::Image& image(Img id) {
    static const juce::Image imgs[] = {load("key.png"),          load("leather.png"),        load("toggle-body.png"), load("toggle-lever-off.png"),
                                       load("toggle-lever-on.png"), load("wood-l.jpg"),         load("wood-r.jpg")};
    return imgs[static_cast<int>(id)];
}

float physicalScale(juce::Graphics& g) { return juce::jlimit(0.25f, 4.f, g.getInternalContext().getPhysicalPixelScaleFactor()); }

const juce::Image& Cached::get(float w, float h, float phys, const std::function<void(juce::Graphics&)>& render) {
    const int pw = juce::jmax(1, juce::roundToInt(w * phys)), ph = juce::jmax(1, juce::roundToInt(h * phys));
    if (img_.isValid() && pw == pw_ && ph == ph_) return img_;
    pw_ = pw;
    ph_ = ph;
    img_ = juce::Image(juce::Image::ARGB, pw, ph, true);
    juce::Graphics ig(img_);
    ig.addTransform(juce::AffineTransform::scale(static_cast<float>(pw) / w, static_cast<float>(ph) / h));
    render(ig);
    return img_;
}

juce::Image rescale(const juce::Image& src, int w, int h) {
    if (!src.isValid() || w <= 0 || h <= 0) return {};
    juce::Image cur = src.convertedToFormat(juce::Image::ARGB);
    // par moities tant que la source est plus de deux fois trop grande (le bilineaire seul crenele)
    while (cur.getWidth() > 2 * w && cur.getHeight() > 2 * h)
        cur = cur.rescaled(cur.getWidth() / 2, cur.getHeight() / 2, juce::Graphics::highResamplingQuality);
    return cur.rescaled(w, h, juce::Graphics::highResamplingQuality);
}

const juce::Image& Cached::image(Img id, float w, float h, float phys) {
    const int pw = juce::jmax(1, juce::roundToInt(w * phys)), ph = juce::jmax(1, juce::roundToInt(h * phys));
    if (img_.isValid() && pw == pw_ && ph == ph_) return img_;
    pw_ = pw;
    ph_ = ph;
    img_ = rescale(hl::image(id), pw, ph);
    return img_;
}

void drawScaled(juce::Graphics& g, Cached& cache, Img id, juce::Rectangle<float> r, float phys) {
    const auto& img = cache.image(id, r.getWidth(), r.getHeight(), phys);
    // l'opacite courante du contexte s'applique aux images : toujours pleine ici (une LED eteinte la laisse a 8 %)
    g.setOpacity(1.f);
    g.drawImage(img, r);
}

void text(juce::Graphics& g, const juce::String& s, juce::Rectangle<float> r, const juce::Font& f, juce::Colour c, juce::Justification j) {
    g.setFont(f);
    g.setColour(c);
    g.drawText(s, r, j, false);
}

void led(juce::Graphics& g, juce::Point<float> c, float d, bool on) {
    const float r = d / 2;
    if (on) {
        // le halo (box-shadow 0 0 6px, 0 0 14px)
        for (int i = 4; i >= 1; --i) {
            const float rr = r + i * 1.6f;
            g.setColour(accent().withAlpha(0.09f * (5 - i)));
            g.fillEllipse(c.x - rr, c.y - rr, 2 * rr, 2 * rr);
        }
        const juce::Colour a = accent();
        juce::ColourGradient cg(a.interpolatedWith(juce::Colours::white, 0.7f), c.x - r * 0.25f, c.y - r * 0.35f, a, c.x + r, c.y + r, true);
        cg.addColour(0.45, a.interpolatedWith(juce::Colours::white, 0.2f));
        g.setGradientFill(cg);
        g.fillEllipse(c.x - r, c.y - r, d, d);
    } else {
        g.setColour(juce::Colour(0xff3a2d12).interpolatedWith(kLedOff, 0.5f));
        g.fillEllipse(c.x - r, c.y - r, d, d);
        g.setColour(juce::Colours::black.withAlpha(0.7f));
        g.drawEllipse(c.x - r, c.y - r, d, d, 0.6f);
        g.setColour(juce::Colours::white.withAlpha(0.08f));
        g.fillEllipse(c.x - r * 0.45f, c.y - r * 0.6f, r * 0.7f, r * 0.5f);
    }
}

void paintPanel(juce::Graphics& g, juce::Rectangle<float> a, const Look::State& look) {
    const float phys = physicalScale(g);
    // la laque (hood.css .mm-p2-board)
    {
        juce::ColourGradient cg(juce::Colour(0xff262422), 0, a.getY(), juce::Colour(0xff1f1d1b), 0, a.getBottom(), false);
        cg.addColour(0.45, juce::Colour(0xff23211f));
        g.setGradientFill(cg);
        g.fillRect(a);
    }
    // le cuir par-dessus, dose par LEATHER TEXTURE (0.7 au depart) : une tuile de 256 points, grain fin et mat
    if (look.leather > 0.001f) {
        g.beginTransparencyLayer(look.leather);
        g.setColour(juce::Colour(0xff161618));
        g.fillRect(a);
        // v1.2 (Mika : "je veux que le cuir noir soit plus apparent") : le grain de retro/leather.png est presque invisible
        // (gris de 15 a 27) ; il est contraste x3.2 autour de sa moyenne, et la tuile passe de 256 a 320 points (un grain
        // un peu plus gros)
        static const juce::Image grain = [] {
            juce::Image src = image(Img::Leather).convertedToFormat(juce::Image::RGB);
            juce::Image::BitmapData d(src, juce::Image::BitmapData::readWrite);
            double sum = 0;
            for (int y = 0; y < d.height; ++y)
                for (int x = 0; x < d.width; ++x) sum += d.getPixelColour(x, y).getPerceivedBrightness();
            const float mean = static_cast<float>(sum / (d.width * d.height));
            for (int y = 0; y < d.height; ++y)
                for (int x = 0; x < d.width; ++x) {
                    // la luminance seule (le contraste amplifiait une pointe de bleu) ; la teinte vient de la laque
                    const float u = mean + (d.getPixelColour(x, y).getPerceivedBrightness() - mean) * 3.2f;
                    const auto v = static_cast<juce::uint8>(juce::jlimit(0, 255, juce::roundToInt(u * 255.f)));
                    d.setPixelColour(x, y, juce::Colour(v, v, v));
                }
            return src;
        }();
        const int tp = juce::jmax(16, juce::roundToInt(320 * phys));
        static juce::Image tile;
        static int tileSize = 0;
        if (tileSize != tp) {
            tile = rescale(grain, tp, tp);
            tileSize = tp;
        }
        g.setFillType(juce::FillType(tile, juce::AffineTransform::scale(1.f / phys)));
        g.fillRect(a);
        // de larges nappes de lumiere douces : rien ne se repete a l'oeil
        const auto blob = [&](float fx, float fy, float rad, juce::Colour c) {
            const juce::Point<float> p(a.getX() + fx * a.getWidth(), a.getY() + fy * a.getHeight());
            juce::ColourGradient rg(c, p.x, p.y, c.withAlpha(0.f), p.x + rad, p.y, true);
            g.setGradientFill(rg);
            g.fillRect(a);
        };
        blob(0.2f, 0.28f, a.getWidth() * 0.4f, juce::Colours::white.withAlpha(0.022f));
        blob(0.8f, 0.7f, a.getWidth() * 0.45f, juce::Colours::black.withAlpha(0.16f));
        blob(0.58f, 0.14f, a.getWidth() * 0.3f, juce::Colours::white.withAlpha(0.018f));
        blob(0.35f, 0.85f, a.getWidth() * 0.35f, juce::Colours::black.withAlpha(0.1f));
        g.endTransparencyLayer();
    }
    // PANEL LIGHT (look.ts : 0.5 neutre) : en dessous, le panneau s'assombrit ; au-dessus, une lumiere chaude
    if (look.light < 0.5f) {
        g.setColour(juce::Colours::black.withAlpha((0.5f - look.light) * 0.42f * 1.7f));
        g.fillRect(a);
    } else if (look.light > 0.5f) {
        g.setColour(juce::Colour::fromFloatRGBA(1.f, 250 / 255.f, 240 / 255.f, (look.light - 0.5f) * 0.09f * 1.7f));
        g.fillRect(a);
    }
    // la lumiere du haut
    {
        juce::ColourGradient rg(juce::Colour::fromFloatRGBA(1.f, 0.96f, 0.9f, 0.035f), a.getCentreX(), a.getY(), juce::Colour::fromFloatRGBA(1.f, 0.96f, 0.9f, 0.f),
                                a.getCentreX(), a.getY() + a.getHeight() * 0.7f, true);
        g.setGradientFill(rg);
        g.fillRect(a);
    }
    // les joues de bois (36 x 704 sur la face du MM-ARP : ici 32 de large)
    {
        const float w = 32.f, h = w * 2112.f / 108.f;
        static Cached l, r;
        drawScaled(g, l, Img::WoodL, {a.getX(), a.getY(), w, h}, phys);
        drawScaled(g, r, Img::WoodR, {a.getRight() - w, a.getY(), w, h}, phys);
        // l'ombre du bois sur le panneau
        for (int side = 0; side < 2; ++side) {
            const float x = side == 0 ? a.getX() + w : a.getRight() - w;
            juce::ColourGradient sg(juce::Colours::black.withAlpha(0.55f), x, 0, juce::Colours::black.withAlpha(0.f), side == 0 ? x + 10 : x - 10, 0, false);
            g.setGradientFill(sg);
            g.fillRect(side == 0 ? juce::Rectangle<float>(x, a.getY(), 10, a.getHeight()) : juce::Rectangle<float>(x - 10, a.getY(), 10, a.getHeight()));
        }
    }
}

} // namespace hl
