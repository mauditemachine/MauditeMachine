#include "HellLook.h"

#include "HellAssets.h"

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

} // namespace

juce::Font font(float pt, Weight w, float tracking) {
    static const juce::Typeface::Ptr medium = typeface("SF-Pro-Display-Medium.otf");
    static const juce::Typeface::Ptr semibold = typeface("SF-Pro-Display-Semibold.otf");
    static const juce::Typeface::Ptr bold = typeface("SF-Pro-Display-Bold.otf");
    const auto& tf = w == Weight::Medium ? medium : w == Weight::Bold ? bold : semibold;
    return juce::Font(juce::FontOptions{}.withTypeface(tf).withPointHeight(pt).withKerningFactor(tracking));
}

juce::Font logoFont(float pt) {
    static const juce::Typeface::Ptr rr = typeface("RobotRadicals.ttf");
    return juce::Font(juce::FontOptions{}.withTypeface(rr).withPointHeight(pt));
}

const juce::Image& image(Img id) {
    static const juce::Image imgs[] = {load("knob.png"),       load("knob-cap.png"),        load("fine-knob.png"),
                                       load("key.png"),        load("leather.png"),         load("toggle-body.png"),
                                       load("toggle-lever-off.png"), load("toggle-lever-on.png"), load("wood-l.jpg"),
                                       load("wood-r.jpg")};
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

void drawScaled(juce::Graphics& g, Cached& cache, Img id, juce::Rectangle<float> r, float phys) {
    const auto& img = cache.get(r.getWidth(), r.getHeight(), phys, [&](juce::Graphics& ig) {
        // le cache est dessine a l'echelle : on y pose l'image deja a la taille physique, en coordonnees logiques
        const auto t = ig.getInternalContext().getPhysicalPixelScaleFactor();
        const auto sc = rescale(image(id), juce::roundToInt(r.getWidth() * t), juce::roundToInt(r.getHeight() * t));
        ig.drawImage(sc, juce::Rectangle<float>(0, 0, r.getWidth(), r.getHeight()));
    });
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
            g.setColour(kAccent.withAlpha(0.09f * (5 - i)));
            g.fillEllipse(c.x - rr, c.y - rr, 2 * rr, 2 * rr);
        }
        juce::ColourGradient cg(kAccent.interpolatedWith(juce::Colours::white, 0.7f), c.x - r * 0.25f, c.y - r * 0.35f, kAccent, c.x + r, c.y + r, true);
        cg.addColour(0.45, kAccent.interpolatedWith(juce::Colours::white, 0.2f));
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

void paintPanel(juce::Graphics& g, juce::Rectangle<float> a) {
    const float phys = physicalScale(g);
    // la laque (hood.css .mm-p2-board)
    {
        juce::ColourGradient cg(juce::Colour(0xff262422), 0, a.getY(), juce::Colour(0xff1f1d1b), 0, a.getBottom(), false);
        cg.addColour(0.45, juce::Colour(0xff23211f));
        g.setGradientFill(cg);
        g.fillRect(a);
    }
    // le cuir par-dessus, a 70 % (LEATHER TEXTURE 0.7) : une tuile de 256 points, grain fin et mat
    {
        g.beginTransparencyLayer(0.7f);
        g.setColour(juce::Colour(0xff161618));
        g.fillRect(a);
        const int tp = juce::jmax(16, juce::roundToInt(256 * phys));
        static juce::Image tile;
        static int tileSize = 0;
        if (tileSize != tp) {
            tile = rescale(image(Img::Leather), tp, tp);
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
