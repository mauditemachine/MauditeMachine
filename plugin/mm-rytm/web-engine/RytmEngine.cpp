// MM-RYTM, le moteur du navigateur : voir RytmEngine.h (ce que chaque partie recopie de src/PluginProcessor.cpp).
#include "RytmEngine.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>

// MMRYTM_NO_FTZ : les bancs seulement (le natif sans FTZ / DAZ, comme le wasm)
#if !defined(__wasm__) && !defined(MMRYTM_NO_FTZ) && (defined(__SSE__) || defined(_M_X64) || defined(__x86_64__))
#include <xmmintrin.h>
#define MMRYTM_FTZ_SSE 1
#elif !defined(__wasm__) && !defined(MMRYTM_NO_FTZ) && (defined(__aarch64__) || defined(_M_ARM64))
#define MMRYTM_FTZ_ARM 1
#endif

namespace mmrytmweb {

namespace {

// juce::ScopedNoDenormals : SSE FTZ + DAZ (0x8040), arm64 FZ ; rien en wasm
struct NoDenormals {
#if MMRYTM_FTZ_SSE
    unsigned csr;
    NoDenormals() : csr(_mm_getcsr()) { _mm_setcsr(csr | 0x8040u); }
    ~NoDenormals() { _mm_setcsr(csr); }
#elif MMRYTM_FTZ_ARM
    uint64_t fpcr = 0;
    NoDenormals() {
        asm volatile("mrs %0, fpcr" : "=r"(fpcr));
        const uint64_t v = fpcr | (1ull << 24);
        asm volatile("msr fpcr, %0" : : "r"(v));
    }
    ~NoDenormals() { asm volatile("msr fpcr, %0" : : "r"(fpcr)); }
#endif
};

/* ---------------- juce::JSON::parse (juce_JSON.cpp JSONParser), sur des octets UTF-8 ---------------- */

bool isWs(unsigned c) { return c == ' ' || (c >= 9 && c <= 13); }

// CharacterFunctions::readDoubleValue (juce_CharacterFunctions.h) : 18 chiffres significatifs au plus, puis strtod
double readDoubleValue(const unsigned char*& text, const unsigned char* end) {
    constexpr double inf = std::numeric_limits<double>::infinity();
    auto at = [&](const unsigned char* q) -> unsigned { return q < end ? *q : 0u; };
    bool isNegative = false;
    constexpr int maxSignificantDigits = 17 + 1;
    constexpr int bufferSize = maxSignificantDigits + 7 + 1;
    char buffer[bufferSize] = {};
    char* writePtr = &(buffer[0]);
    const unsigned char* endOfWhitspace = text;
    while (isWs(at(endOfWhitspace))) ++endOfWhitspace;
    text = endOfWhitspace;
    unsigned c = at(text);
    switch (c) {
        case '-':
            isNegative = true;
            *writePtr++ = '-';
            [[fallthrough]];
        case '+':
            c = at(++text);
            break;
        default:
            break;
    }
    switch (c) {
        case 'n':
        case 'N':
            if ((at(text + 1) == 'a' || at(text + 1) == 'A') && (at(text + 2) == 'n' || at(text + 2) == 'N')) {
                text += 3;
                return std::numeric_limits<double>::quiet_NaN();
            }
            text = endOfWhitspace;
            return 0.0;
        case 'i':
        case 'I':
            if ((at(text + 1) == 'n' || at(text + 1) == 'N') && (at(text + 2) == 'f' || at(text + 2) == 'F')) {
                text += 3;
                return isNegative ? -inf : inf;
            }
            text = endOfWhitspace;
            return 0.0;
        default:
            break;
    }
    int numSigFigs = 0, extraExponent = 0;
    bool decimalPointFound = false, leadingZeros = false;
    for (;;) {
        const unsigned t = at(text);
        if (t >= '0' && t <= '9') {
            const int digit = static_cast<int>(t) - '0';
            ++text;
            if (decimalPointFound) {
                if (numSigFigs >= maxSignificantDigits) continue;
            } else {
                if (numSigFigs >= maxSignificantDigits) {
                    ++extraExponent;
                    continue;
                }
                if (numSigFigs == 0 && digit == 0) {
                    leadingZeros = true;
                    continue;
                }
            }
            *writePtr++ = static_cast<char>('0' + digit);
            numSigFigs++;
        } else if ((!decimalPointFound) && t == '.') {
            ++text;
            *writePtr++ = '.';
            decimalPointFound = true;
        } else {
            break;
        }
    }
    if ((!leadingZeros) && (numSigFigs == 0)) {
        text = endOfWhitspace;
        return 0.0;
    }
    auto writeExponentDigits = [](int exponent, char* destination) {
        int exponentDivisor = 100;
        while (exponentDivisor > 1) {
            const int digit = exponent / exponentDivisor;
            *destination++ = static_cast<char>('0' + digit);
            exponent -= digit * exponentDivisor;
            exponentDivisor /= 10;
        }
        *destination++ = static_cast<char>('0' + exponent);
    };
    c = at(text);
    if (c == 'e' || c == 'E') {
        const unsigned char* startOfExponent = text;
        *writePtr++ = 'e';
        bool parsedExponentIsPositive = true;
        switch (at(++text)) {
            case '-':
                parsedExponentIsPositive = false;
                [[fallthrough]];
            case '+':
                ++text;
                break;
            default:
                break;
        }
        int exponent = 0;
        const unsigned char* startOfExponentDigits = text;
        while (at(text) >= '0' && at(text) <= '9') {
            const int digit = static_cast<int>(at(text)) - '0';
            ++text;
            if (digit != 0 || exponent != 0) exponent = (exponent * 10) + digit;
        }
        if (text == startOfExponentDigits) text = startOfExponent;
        exponent = extraExponent + (parsedExponentIsPositive ? exponent : -exponent);
        if (exponent < 0) {
            if (exponent < std::numeric_limits<double>::min_exponent10 - 1) return isNegative ? -0.0 : 0.0;
            *writePtr++ = '-';
            exponent = -exponent;
        } else if (exponent > std::numeric_limits<double>::max_exponent10 + 1) {
            return isNegative ? -inf : inf;
        }
        writeExponentDigits(exponent, writePtr);
    } else if (extraExponent > 0) {
        *writePtr++ = 'e';
        writeExponentDigits(extraExponent, writePtr);
    }
    // strtod_l (locale "C") : la seule locale de la libc du wasm, celle des programmes natifs qui n'en changent pas
    return std::strtod(&buffer[0], nullptr);
}

struct JsonParser {
    const unsigned char* cur;
    const unsigned char* end;
    bool failed = false;

    unsigned peek() const { return cur < end ? *cur : 0u; }
    unsigned readChar() { return cur < end ? *cur++ : 0u; }
    bool matchIf(char c) {
        if (peek() == static_cast<unsigned char>(c)) {
            ++cur;
            return true;
        }
        return false;
    }
    bool matchString(const char* t) {
        while (*t != 0)
            if (!matchIf(*t++)) return false;
        return true;
    }
    void skipWhitespace() {
        while (isWs(peek())) ++cur;
    }
    bool fail() {
        failed = true;
        return false;
    }

    static void appendUtf8(std::string& out, uint32_t c) {
        if (c < 0x80) out += static_cast<char>(c);
        else if (c < 0x800) {
            out += static_cast<char>(0xc0 | (c >> 6));
            out += static_cast<char>(0x80 | (c & 0x3f));
        } else if (c < 0x10000) {
            out += static_cast<char>(0xe0 | (c >> 12));
            out += static_cast<char>(0x80 | ((c >> 6) & 0x3f));
            out += static_cast<char>(0x80 | (c & 0x3f));
        } else {
            out += static_cast<char>(0xf0 | (c >> 18));
            out += static_cast<char>(0x80 | ((c >> 12) & 0x3f));
            out += static_cast<char>(0x80 | ((c >> 6) & 0x3f));
            out += static_cast<char>(0x80 | (c & 0x3f));
        }
    }
    int parseHexDigit() {
        const unsigned c = readChar();
        if (c >= '0' && c <= '9') return static_cast<int>(c - '0');
        if (c >= 'a' && c <= 'f') return static_cast<int>(c - 'a' + 10);
        if (c >= 'A' && c <= 'F') return static_cast<int>(c - 'A' + 10);
        failed = true;
        return 0;
    }
    uint32_t parseCodeUnit() {
        const int a = parseHexDigit(), b = parseHexDigit(), c = parseHexDigit(), d = parseHexDigit();
        return static_cast<uint32_t>((a << 12) | (b << 8) | (c << 4) | d);
    }
    // parseEscapeSequence : \uXXXX, une paire de substitution UTF-16 ; une demi-paire seule est une erreur
    uint32_t parseEscapeSequence() {
        const uint32_t first = parseCodeUnit();
        if (first < 0xd800 || first > 0xdfff) return first;
        if (first > 0xdbff) {
            failed = true;
            return 0;
        }
        if (readChar() != '\\' || readChar() != 'u') {
            failed = true;
            return 0;
        }
        const uint32_t low = parseCodeUnit();
        if (low < 0xdc00 || low > 0xdfff) {
            failed = true;
            return 0;
        }
        return 0x10000 + ((first - 0xd800) << 10) + (low - 0xdc00);
    }
    // parseString : les octets d'un caractere UTF-8 passent tels quels (le meme texte que le code point re-encode)
    bool parseString(unsigned quote, std::string& out) {
        for (;;) {
            uint32_t c = readChar();
            if (c == quote) break;
            if (c == '\\') {
                c = readChar();
                switch (c) {
                    case '"':
                    case '\'':
                    case '\\':
                    case '/':
                        break;
                    case 'a': c = '\a'; break;
                    case 'b': c = '\b'; break;
                    case 'f': c = '\f'; break;
                    case 'n': c = '\n'; break;
                    case 'r': c = '\r'; break;
                    case 't': c = '\t'; break;
                    case 'u':
                        c = parseEscapeSequence();
                        if (failed) return false;
                        appendUtf8(out, c);
                        if (c == 0) return fail();
                        continue;
                    default:
                        break;
                }
            }
            if (c == 0) return fail();
            out += static_cast<char>(c);
        }
        return true;
    }
    bool parseNumber(bool isNegative, Var& v) {
        const unsigned char* originalPos = cur;
        uint64_t intValue = static_cast<uint64_t>(static_cast<int64_t>(readChar()) - '0');
        for (;;) {
            const unsigned char* lastPos = cur;
            const unsigned c = readChar();
            const int digit = static_cast<int>(c) - '0';
            if (digit >= 0 && digit < 10) {
                intValue = intValue * 10 + static_cast<uint64_t>(digit);
                continue;
            }
            if (c == 'e' || c == 'E' || c == '.') {
                cur = originalPos;
                const double asDouble = readDoubleValue(cur, end);
                v.type = Var::Double;
                v.d = isNegative ? -asDouble : asDouble;
                return true;
            }
            if (isWs(c) || c == ',' || c == '}' || c == ']' || c == 0) {
                cur = lastPos;
                break;
            }
            return fail();
        }
        const int64_t iv = static_cast<int64_t>(intValue);
        const int64_t corrected = isNegative ? static_cast<int64_t>(0ull - intValue) : iv;
        if ((iv >> 31) != 0) {
            v.type = Var::Int64;
            v.i = corrected;
        } else {
            v.type = Var::Int;
            v.i = static_cast<int32_t>(corrected);
        }
        return true;
    }
    bool parseAny(Var& v) {
        skipWhitespace();
        const unsigned char* originalLocation = cur;
        switch (readChar()) {
            case '{': return parseObject(v);
            case '[': return parseArray(v);
            case '"':
                v.type = Var::String;
                return parseString('"', v.s);
            case '\'':
                v.type = Var::String;
                return parseString('\'', v.s);
            case '-':
                skipWhitespace();
                return parseNumber(true, v);
            case '0': case '1': case '2': case '3': case '4':
            case '5': case '6': case '7': case '8': case '9':
                cur = originalLocation;
                return parseNumber(false, v);
            case 't':
                if (matchString("rue")) {
                    v.type = Var::Bool;
                    v.b = true;
                    return true;
                }
                break;
            case 'f':
                if (matchString("alse")) {
                    v.type = Var::Bool;
                    v.b = false;
                    return true;
                }
                break;
            case 'n':
                if (matchString("ull")) {
                    v.type = Var::Void;
                    return true;
                }
                break;
            default:
                break;
        }
        return fail();
    }
    bool parseObject(Var& v) {
        v.type = Var::Object;
        for (;;) {
            skipWhitespace();
            const unsigned c = readChar();
            if (c == '}') break;
            if (c == 0) return fail();
            if (c != '"') return fail();
            std::string name;
            if (!parseString('"', name)) return false;
            // Identifier::isValid : un nom vide est une erreur
            if (name.empty()) return fail();
            skipWhitespace();
            if (readChar() != ':') return fail();
            Var val;
            if (!parseAny(val)) return false;
            bool set = false;
            for (auto& kv : v.o)
                if (kv.first == name) {
                    kv.second = std::move(val);
                    set = true;
                    break;
                }
            if (!set) v.o.emplace_back(std::move(name), std::move(val));
            skipWhitespace();
            if (matchIf(',')) continue;
            if (matchIf('}')) break;
            return fail();
        }
        return true;
    }
    bool parseArray(Var& v) {
        v.type = Var::Array;
        for (;;) {
            skipWhitespace();
            if (matchIf(']')) break;
            if (peek() == 0) return fail();
            Var item;
            if (!parseAny(item)) return false;
            v.a.push_back(std::move(item));
            skipWhitespace();
            if (matchIf(',')) continue;
            if (matchIf(']')) break;
            return fail();
        }
        return true;
    }
};

/* ---------------- src/PluginProcessor.cpp, l'espace anonyme (11-200) ---------------- */

// GM : la note MIDI d'entree -> la piste (-1 : ignoree). Les huit premieres pistes du site, dans l'ordre BD SD CH OH CP TOM HT CY.
int trackOfNote(int note) {
    switch (note) {
        case 35: case 36: return 0;
        case 38: case 40: return 1;
        case 42: case 44: return 2;
        case 46: return 3;
        case 39: return 4;
        case 41: case 43: case 45: return 5;
        case 47: case 48: case 50: return 6;
        case 49: case 51: case 52: case 55: case 57: return 7;
        default: return -1;
    }
}

// juce::Decibels::decibelsToGain (float, -100 dB) : std::pow en float
float dbToGain(float db) { return db <= -59.9f ? 0.f : (db > -100.f ? std::pow(10.0f, db * 0.05f) : 0.f); }

const Var kVoid;
const Var& prop(const Var& o, const char* k) {
    const Var* v = o.get(k);
    return v ? *v : kVoid;
}

double num(const Var& o, const char* k, double def) {
    const Var& v = prop(o, k);
    return v.isDouble() || v.isInt() || v.isInt64() ? v.toDouble() : def;
}

bool flag(const Var& o, const char* k) {
    const Var& v = prop(o, k);
    return v.isBool() ? v.b : (v.isInt() || v.isDouble() ? v.toDouble() != 0 : false);
}

template <typename T>
T jlimit(T lo, T hi, T v) {
    return v < lo ? lo : (hi < v ? hi : v);
}

// Un son du programme (src/v4/plugin/bridge.ts ProgSound) : le moteur, la recette du site, STRETCH, la hauteur.
bool parseSound(const Var& o, mm::ProgSound& s) {
    if (!o.isObject()) return false;
    // o.getProperty("id", "").toString()
    const Var* idv = o.get("id");
    if (!mm::shotFromSiteId(idv ? idv->toString() : std::string(), s.id)) return false;
    const Var& tw = prop(o, "tw");
    // tw.getProperty("model", "mm").toString() : absent "mm", nul "" (les deux : MM)
    const Var* mv = tw.isObject() ? tw.get("model") : nullptr;
    const std::string model = mv ? mv->toString() : std::string("mm");
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
    const Var& smpKey = prop(tw, "sample");
    s.sample = smpKey.isString() ? smpKey.s : std::string();
    const Var& smp = prop(tw, "smp");
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

void parseHit(const Var& o, mm::ProgHit& h) {
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
    if (const auto* sl = prop(o, "sl").getArray(); sl && sl->size() >= 5) {
        h.hasSl = true;
        h.sl = {(*sl)[0].toDouble(), (*sl)[1].toDouble(), (*sl)[2].toDouble(), (*sl)[3].toDouble(), (*sl)[4].toDouble()};
    }
    // Les LFO : [n, spd, mult, fade, dest, wave, phase, mode, depth] aux rangs du site (dsp/Lfo.h)
    h.nlfo = 0;
    if (const auto* ls = prop(o, "lfo").getArray())
        for (const auto& lv : *ls) {
            const auto* a = lv.getArray();
            if (!a || a->size() < 9 || h.nlfo >= 2) continue;
            auto at = [&](int i) { return (*a)[static_cast<size_t>(i)].toDouble(); };
            mm::Lfo& l = h.lfo[h.nlfo];
            l.n = static_cast<int>(at(0)) == 2 ? 2 : 1;
            l.spd = jlimit(-64, 63, static_cast<int>(at(1)));
            l.mult = jlimit(1, 128, static_cast<int>(at(2)));
            l.fade = jlimit(-64, 63, static_cast<int>(at(3)));
            l.dest = jlimit(0, static_cast<int>(mm::LD_DECAY), static_cast<int>(at(4)));
            l.wave = jlimit(0, static_cast<int>(mm::LW_RND), static_cast<int>(at(5)));
            l.phase = jlimit(0.0, 1.0, at(6));
            l.mode = jlimit(0, static_cast<int>(mm::LM_HLF), static_cast<int>(at(7)));
            l.depth = jlimit(-1.0, 1.0, at(8));
            if (l.dest != mm::LD_OFF && l.depth != 0) ++h.nlfo;
        }
    h.lfot = num(o, "lfot", 1) != 0;
    if (const auto* lb = prop(o, "lb").getArray(); lb && lb->size() >= 3) {
        h.lbLevel = (*lb)[0].toDouble();
        h.lbReso = (*lb)[1].toDouble();
        h.lbDecay = (*lb)[2].toDouble();
    }
    h.fp = num(o, "fp", 0) != 0;
    h.lk = static_cast<int>(num(o, "lk", 0));
    h.lc = num(o, "lc", 20000);
}

// Les effets globaux du programme (pattern.fx par morph.fx, TONE et LEVEL du mix)
void parseFx(const Var& o, mm::GlobalFx& g) {
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

bool parseProgram(const char* json, size_t n, mm::Program& p) {
    Var o;
    if (!parseJson(json, n, o)) return false;
    if (!o.isObject() || static_cast<int>(num(o, "v", 0)) != 1) return false;
    p.bpm = num(o, "bpm", 130);
    p.len = std::max(1, std::min(128, static_cast<int>(num(o, "len", 16))));
    p.loop = static_cast<int>(num(o, "loop", -1));
    p.swing = num(o, "swing", 0);
    parseFx(prop(o, "fx"), p.fx);
    p.sounds.clear();
    if (const auto* arr = prop(o, "sounds").getArray())
        for (const auto& sv : *arr) {
            mm::ProgSound s;
            if (!parseSound(sv, s)) s = mm::ProgSound{}; // garde les indices alignes
            p.sounds.push_back(s);
        }
    if (const auto* arr = prop(o, "tracks").getArray())
        for (int t = 0; t < std::min(mm::kProgTracks, static_cast<int>(arr->size())); ++t) {
            const Var& tv = (*arr)[static_cast<size_t>(t)];
            auto& tr = p.tracks[static_cast<size_t>(t)];
            tr.slice = static_cast<float>(num(tv, "slice", 1));
            tr.plays = flag(tv, "plays");
            tr.mono = flag(tv, "mono");
            tr.choke = static_cast<int>(num(tv, "choke", 0));
            tr.gated = flag(tv, "gated");
            tr.kick = flag(tv, "kick");
            if (const auto* sl = prop(tv, "sl").getArray(); sl && sl->size() >= 5)
                tr.sl = {(*sl)[0].toDouble(), (*sl)[1].toDouble(), (*sl)[2].toDouble(), (*sl)[3].toDouble(), (*sl)[4].toDouble()};
            parseHit(prop(tv, "live"), tr.live);
            tr.hits.clear();
            if (const auto* hs = prop(tv, "hits").getArray())
                for (const auto& hv : *hs) {
                    mm::ProgHit h;
                    parseHit(hv, h);
                    tr.hits.push_back(h);
                }
        }
    return true;
}

std::string fmt(const char* f, double v) {
    char b[64];
    std::snprintf(b, sizeof b, f, v);
    return b;
}

} // namespace

/* ---------------- Var ---------------- */

const Var* Var::get(const char* k) const {
    if (type != Object) return nullptr;
    for (const auto& kv : o)
        if (kv.first == k) return &kv.second;
    return nullptr;
}

double Var::toDouble() const {
    switch (type) {
        case Bool: return b ? 1.0 : 0.0;
        case Int:
        case Int64: return static_cast<double>(i);
        case Double: return d;
        case String: {
            // String::getDoubleValue : readDoubleValue sur le texte
            const auto* t = reinterpret_cast<const unsigned char*>(s.data());
            return readDoubleValue(t, t + s.size());
        }
        default: return 0.0;
    }
}

std::string Var::toString() const {
    switch (type) {
        case String: return s;
        case Bool: return b ? "1" : "0";
        case Int:
        case Int64: return std::to_string(i);
        case Double: {
            // serialiseDouble : un entier s'ecrit "909.0" (jamais egal a un nom de moteur ou de modele)
            const double a = std::fabs(d);
            if (a < 1.0e6 && a > 1.0e-5 && std::floor(d) == d) return fmt("%.1f", d);
            return fmt("%.15g", d);
        }
        default: return std::string();
    }
}

bool parseJson(const char* text, size_t n, Var& out) {
    out = Var{};
    JsonParser p{reinterpret_cast<const unsigned char*>(text), reinterpret_cast<const unsigned char*>(text) + n};
    // un texte C : le premier zero termine (juce::String)
    if (const void* z = std::memchr(text, 0, n)) p.end = static_cast<const unsigned char*>(z);
    // parseObjectOrArray
    p.skipWhitespace();
    bool ok = true;
    if (p.matchIf('{')) ok = p.parseObject(out);
    else if (p.matchIf('[')) ok = p.parseArray(out);
    else if (p.peek() != 0) ok = false;
    if (!ok || p.failed) {
        out = Var{};
        return false;
    }
    return true;
}

/* ---------------- la banque (src/SampleBank.cpp) ---------------- */

const char* const Bank::kFamilies[8] = {"bd", "sd", "ch", "oh", "cp", "tom", "ht", "cy"};

Bank& Bank::get() {
    static Bank bank;
    return bank;
}

bool Bank::add(const std::string& file, const void* data, size_t size) {
    // Le prefixe du fichier dit sa famille ("Bd 1.wav", "Tom 3.wav") : une famille par piste.
    auto lower = [](std::string s) {
        for (auto& c : s)
            if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
        return s;
    };
    if (file.size() < 4 || lower(file.substr(file.size() - 4)) != ".wav") return false;
    const std::string name = file.substr(0, file.size() - 4);
    const std::string prefix = lower(name.substr(0, name.find(' ')));
    int track = -1;
    for (int t = 0; t < 8; ++t)
        if (prefix == kFamilies[t]) track = t;
    if (track < 0 || !data) return false;
    BankSample s;
    s.name = name;
    s.file = file;
    if (!mm::decodeWav(data, size, s.pcm)) return false;
    byTrack_[static_cast<size_t>(track)].push_back(std::move(s));
    return true;
}

const BankSample* Bank::byKey(const std::string& key) const {
    // upToFirstOccurrenceOf("/") : tout sans "/" ; fromFirstOccurrenceOf("/") : rien sans "/"
    const size_t slash = key.find('/');
    const std::string fam = slash == std::string::npos ? key : key.substr(0, slash);
    const std::string file = slash == std::string::npos ? std::string() : key.substr(slash + 1);
    for (int t = 0; t < 8; ++t)
        if (fam == kFamilies[t])
            for (const auto& s : byTrack_[static_cast<size_t>(t)])
                if (s.file == file) return &s;
    return nullptr;
}

int Bank::count() const {
    int n = 0;
    for (const auto& l : byTrack_) n += static_cast<int>(l.size());
    return n;
}

void Bank::clear() {
    for (auto& l : byTrack_) l.clear();
}

/* ---------------- le calcul des sons (soundFor, buildState) ---------------- */

std::shared_ptr<mm::RenderedSound> renderSound(const mm::ProgSound& s, double sr) {
    auto r = std::make_shared<mm::RenderedSound>();
    mm::ShotTweak tw = s.tw;
    const mm::SamplePcm* pcm = nullptr;
    if (!s.sample.empty())
        if (const auto* b = Bank::get().byKey(s.sample)) pcm = &b->pcm;
    // Un sample absent de la banque (un sample perso du navigateur, la banque synthetisee) : la couche SAMPLE se tait
    tw.hasSample = pcm != nullptr;
    const int nv = s.variants && tw.syn > 0 ? mm::variantsOf(s.id) : 1;
    // Le son a sa hauteur : calcule a sr / pf, lu a vitesse 1 (audio/shots.ts)
    for (int v = 0; v < nv; ++v) r->variants.push_back(mm::renderLayers(s.id, sr / s.pf, s.ts, v, tw, pcm));
    return r;
}

std::string reverbKeyOf(double sec, double hi, double pre, double sr) {
    // juce::String(x, 6) : std::fixed, 6 decimales ; juce::String(sr) : le format par defaut d'un ostream (%g)
    return fmt("%.6f", sec) + "|" + fmt("%.3f", hi) + "|" + fmt("%.6f", pre) + "|" + fmt("%g", sr);
}

void soundToDesc(const mm::ProgSound& s, double sr, double* d) {
    d[0] = static_cast<double>(static_cast<int>(s.id));
    d[1] = sr;
    d[2] = static_cast<double>(static_cast<int>(s.tw.model));
    d[3] = s.tw.tune;
    d[4] = s.tw.attack;
    d[5] = s.tw.decay;
    d[6] = s.tw.drive;
    d[7] = s.tw.snappy;
    d[8] = s.tw.gate ? 1 : 0;
    d[9] = s.tw.sweep;
    d[10] = s.tw.sdTune;
    d[11] = s.tw.sdDecay;
    d[12] = s.tw.sdTone;
    d[13] = s.tw.syn;
    d[14] = s.tw.smp.lev;
    d[15] = s.tw.smp.st;
    d[16] = s.tw.smp.start;
    d[17] = s.tw.smp.len;
    d[18] = s.tw.smp.rev ? 1 : 0;
    d[19] = s.ts;
    d[20] = s.pf;
    d[21] = s.variants ? 1 : 0;
    d[22] = 0;
}

void descToSound(const double* d, mm::ProgSound& s, double& sr) {
    s = mm::ProgSound{};
    s.id = static_cast<mm::ShotId>(static_cast<int>(d[0]));
    sr = d[1];
    s.tw.model = static_cast<mm::KitModel>(static_cast<int>(d[2]));
    s.tw.tune = d[3];
    s.tw.attack = d[4];
    s.tw.decay = d[5];
    s.tw.drive = d[6];
    s.tw.snappy = d[7];
    s.tw.gate = d[8] != 0;
    s.tw.sweep = d[9];
    s.tw.sdTune = d[10];
    s.tw.sdDecay = d[11];
    s.tw.sdTone = d[12];
    s.tw.syn = d[13];
    s.tw.smp.lev = d[14];
    s.tw.smp.st = d[15];
    s.tw.smp.start = d[16];
    s.tw.smp.len = d[17];
    s.tw.smp.rev = d[18] != 0;
    s.ts = d[19];
    s.pf = d[20];
    s.variants = d[21] != 0;
}

/* ---------------- le processeur ---------------- */

RytmEngine::RytmEngine() = default;

std::shared_ptr<mm::RenderedSound> RytmEngine::soundFor(const mm::ProgSound& s, double sr) {
    const std::string key = s.key();
    if (auto it = cache_.find(key); it != cache_.end()) return it->second;
    std::shared_ptr<mm::RenderedSound> r;
    // Mode asynchrone : le son calcule par le Worker (le meme calcul, ready() l'a attendu)
    if (async_)
        if (auto it = deliveredSounds_.find(key); it != deliveredSounds_.end()) {
            r = it->second;
            deliveredSounds_.erase(it);
        }
    if (!r) {
        r = renderSound(s, sr);
        ++stats.rendered;
    }
    cache_[key] = r;
    engine_.own(r);
    return r;
}

std::shared_ptr<mm::PlayState> RytmEngine::buildState(const mm::Program& prog, double sr) {
    auto ps = std::make_shared<mm::PlayState>();
    ps->prog = prog;
    // La REVERB du site (fx.ts makeImpulse, identique bit a bit) : une nouvelle reponse seulement quand sa forme change
    const double sec = mm::FxLaws::reverbSeconds(prog.fx.rsize), hi = mm::FxLaws::reverbHiEnd(prog.fx.rtone), pre = mm::FxLaws::reverbPre(prog.fx.rpre);
    const std::string key = reverbKeyOf(sec, hi, pre, sr);
    if (!reverbIR_ || key != reverbKey_) {
        std::shared_ptr<mm::ReverbIR> ir;
        if (async_)
            if (auto it = deliveredIR_.find(key); it != deliveredIR_.end()) ir = it->second;
        reverbIR_ = ir ? ir : mm::ReverbIR::make(sec, hi, pre, sr);
        reverbKey_ = key;
    }
    ps->reverbIR = reverbIR_;
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

void RytmEngine::renderLoop(double now) {
    const double sr = sr_;
    if (sr <= 0) return;
    // Le navigateur : le passage attend les calculs du Worker (le programme et les coups restent en attente)
    if (async_ && !ready(sr)) {
        engine_.collect(now);
        return;
    }
    std::unique_ptr<mm::Program> prog = std::move(pendingProgram_);
    std::vector<std::pair<mm::ProgSound, mm::LiveHit>> live;
    live.swap(pendingLive_);
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
        ++stats.published;
    }
    // Les coups qui attendaient leur son : ils partent maintenant
    for (auto& [s, h] : live) {
        engine_.pushLive(h);
        ++stats.liveLater;
    }
    engine_.collect(now);
    // Ce que le Worker a livre pour des programmes depasses ne sert plus
    deliveredSounds_.clear();
    deliveredIR_.clear();
}

bool RytmEngine::faceProgram(const char* json, size_t n) {
    auto p = std::make_unique<mm::Program>();
    if (!parseProgram(json, n, *p)) return false;
    progBpm_ = p->bpm;
    pendingProgram_ = std::move(p);
    ++stats.programs;
    return true;
}

void RytmEngine::faceHit(const char* json, size_t n) {
    Var o;
    if (!parseJson(json, n, o)) return;
    mm::ProgSound s;
    if (!parseSound(prop(o, "sound"), s)) return;
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
                engine_.pushLive(h);
                ++stats.liveNow;
                return;
            }
    }
    // Sinon il se calcule, et le coup part juste apres
    pendingLive_.emplace_back(s, h);
}

RytmEngine::Feedback RytmEngine::feedback() const {
    return {engine_.fbPlaying.load(), internalPlaying_, engine_.fbStep.load(), engine_.fbSeq.load(), engine_.fbMask.load()};
}

void RytmEngine::prepare(double sampleRate) {
    if (sampleRate != sr_) {
        engine_.prepare(sampleRate);
        sr_ = sampleRate;
        // le navigateur : les calculs livres a l'autre frequence ne servent plus (ceux en route sont jetes a l'arrivee)
        deliveredSounds_.clear();
        deliveredIR_.clear();
    }
}

void RytmEngine::midi(int offset, int status, int d1, int d2) {
    if (midi_.size() >= 4096) return;
    midi_.push_back({offset, status & 0xff, d1 & 0x7f, d2 & 0x7f});
}

void RytmEngine::setHostPosition(bool playing, double ppq, double bpm) {
    host_.has = true;
    host_.playing = playing;
    host_.ppq = ppq;
    host_.bpm = bpm;
}

void RytmEngine::process(float* L, float* R, int n) {
    NoDenormals noDenormals;
    std::fill(L, L + n, 0.f);
    std::fill(R, R + n, 0.f);
    // getSampleRate() : celle de prepareToPlay (l'hote du navigateur n'en donne pas d'autre)
    const double sr = sr_;

    // Les notes MIDI (un clip d'Ableton) : GM vers les huit premieres pistes ; le MidiBuffer, dans l'ordre des positions
    std::stable_sort(midi_.begin(), midi_.end(), [](const MidiEv& a, const MidiEv& b) { return a.pos < b.pos; });
    std::array<mm::NoteEvent, 256> notes;
    int nn = 0;
    for (const auto& m : midi_) {
        const bool noteOn = (m.s & 0xf0) == 0x90 && m.d2 != 0;
        const bool cc = (m.s & 0xf0) == 0xb0;
        if (noteOn && nn < static_cast<int>(notes.size())) {
            const int t = trackOfNote(m.d1);
            if (t >= 0) {
                notes[static_cast<size_t>(nn++)] = {t, static_cast<float>(m.d2) * (1.0f / 127.0f), m.pos};
                ++stats.notes;
            }
        } else if (cc && (m.d1 == 123 || m.d1 == 120)) {
            engine_.allNotesOff();
        }
    }
    midi_.clear();

    // Le transport : celui de l'hote s'il joue, sinon l'horloge interne (RUN de la face)
    mm::BlockTransport tr;
    double bpm = progBpm_;
    bool hostPlaying = false;
    if (host_.has && host_.playing) {
        hostPlaying = true;
        tr.ppq = host_.ppq;
        bpm = host_.bpm;
    }
    host_.has = false;
    bool internal = false;
    if (!hostPlaying && runInternal_) {
        if (!internalPlaying_) internalPpq_ = 0;
        internal = true;
        tr.ppq = internalPpq_;
    }
    // L'hote reprend la main : RUN s'eteint
    if (hostPlaying && runInternal_) runInternal_ = false;
    internalPlaying_ = internal;
    tr.playing = hostPlaying || internal;
    tr.ppqPerSample = bpm / 60.0 / sr;
    if (internal) internalPpq_ += n * tr.ppqPerSample;

    engine_.process(tr, L, R, n, notes.data(), nn);
    // buffer.applyGain (FloatVectorOperations::multiply, toujours : le tampon a ete ecrit)
    const float g = dbToGain(master_);
    for (int i = 0; i < n; ++i) L[i] *= g;
    for (int i = 0; i < n; ++i) R[i] *= g;
}

/* ---------------- le mode asynchrone ---------------- */

int RytmEngine::request(Job j) {
    for (const auto& [id, x] : jobs_)
        if (x.reverb == j.reverb && x.key == j.key && x.sr == j.sr) return id;
    j.id = nextJob_++;
    if (nextJob_ <= 0) nextJob_ = 1;
    ++stats.jobs;
    const int id = j.id;
    jobs_[id] = std::move(j);
    return id;
}

bool RytmEngine::haveSound(const mm::ProgSound& s, double sr, bool srChange) {
    const std::string key = s.key();
    if (!srChange && cache_.count(key)) return true;
    if (deliveredSounds_.count(key)) return true;
    Job j;
    j.key = key;
    j.sr = sr;
    j.sound = s;
    request(std::move(j));
    return false;
}

bool RytmEngine::ready(double sr) {
    const bool srChange = sr != builtSr_;
    bool ok = true;
    const mm::Program* prog = pendingProgram_ ? pendingProgram_.get() : nullptr;
    const bool build = prog != nullptr || (haveProgram_ && (srChange || !pendingLive_.empty()));
    if (!prog && build) prog = &current_;
    for (const auto& [s, h] : pendingLive_) ok = haveSound(s, sr, srChange) && ok;
    if (build && prog) {
        for (const auto& s : prog->sounds) ok = haveSound(s, sr, srChange) && ok;
        const double sec = mm::FxLaws::reverbSeconds(prog->fx.rsize), hi = mm::FxLaws::reverbHiEnd(prog->fx.rtone), pre = mm::FxLaws::reverbPre(prog->fx.rpre);
        const std::string key = reverbKeyOf(sec, hi, pre, sr);
        if ((!reverbIR_ || key != reverbKey_) && !deliveredIR_.count(key)) {
            Job j;
            j.reverb = true;
            j.key = key;
            j.sr = sr;
            j.sec = sec;
            j.hi = hi;
            j.pre = pre;
            request(std::move(j));
            ok = false;
        }
    }
    return ok;
}

const RytmEngine::Job* RytmEngine::takeJob() {
    for (auto& [id, j] : jobs_)
        if (!j.sent) {
            j.sent = true;
            return &j;
        }
    return nullptr;
}

const RytmEngine::Job* RytmEngine::job(int id) const {
    auto it = jobs_.find(id);
    return it == jobs_.end() ? nullptr : &it->second;
}

bool RytmEngine::deliverSound(int id, std::vector<mm::Shot>&& variants) {
    auto it = jobs_.find(id);
    if (it == jobs_.end() || it->second.reverb) return false;
    const Job j = it->second;
    jobs_.erase(it);
    if (j.sr != sr_) return false;
    auto r = std::make_shared<mm::RenderedSound>();
    r->variants = std::move(variants);
    deliveredSounds_[j.key] = r;
    ++stats.delivered;
    return true;
}

bool RytmEngine::deliverReverb(int id, std::shared_ptr<mm::ReverbIR> ir) {
    auto it = jobs_.find(id);
    if (it == jobs_.end() || !it->second.reverb) return false;
    const Job j = it->second;
    jobs_.erase(it);
    if (j.sr != sr_ || !ir) return false;
    deliveredIR_[j.key] = std::move(ir);
    ++stats.delivered;
    return true;
}

void RytmEngine::failJob(int id) {
    auto it = jobs_.find(id);
    if (it == jobs_.end()) return;
    const Job j = it->second;
    jobs_.erase(it);
    if (j.sr != sr_) return;
    if (j.reverb) deliveredIR_[j.key] = mm::ReverbIR::make(j.sec, j.hi, j.pre, j.sr);
    else {
        deliveredSounds_[j.key] = renderSound(j.sound, j.sr);
        ++stats.rendered;
    }
}

} // namespace mmrytmweb

/* ---------------- l'API C ---------------- */

using mmrytmweb::RytmEngine;

namespace {
// Le moteur et ce que l'API C rend par pointeur (un seul fil par moteur)
struct Handle {
    RytmEngine eng;
    std::array<int32_t, 5> fb{};
    std::array<int32_t, 16> st{};
    std::array<double, mmrytmweb::kDescN> desc{};
    std::map<int, std::vector<mm::Shot>> building; // les variantes d'un son en cours de livraison
};
Handle* H(MMRytmEngine* e) { return reinterpret_cast<Handle*>(e); }
RytmEngine* E(MMRytmEngine* e) { return &H(e)->eng; }
} // namespace

extern "C" {

MMRytmEngine* mmrytm_create(void) { return reinterpret_cast<MMRytmEngine*>(new Handle()); }
void mmrytm_destroy(MMRytmEngine* e) { delete H(e); }
void mmrytm_prepare(MMRytmEngine* e, double sampleRate, int) { E(e)->prepare(sampleRate); }
void mmrytm_process(MMRytmEngine* e, float* L, float* R, int n) { E(e)->process(L, R, n); }
int mmrytm_idle(MMRytmEngine* e, double nowSeconds) {
    E(e)->renderLoop(nowSeconds);
    return E(e)->pending() ? 1 : 0;
}
int mmrytm_pending(MMRytmEngine* e) { return E(e)->pending() ? 1 : 0; }
int mmrytm_program(MMRytmEngine* e, const char* json, int len) { return E(e)->faceProgram(json, static_cast<size_t>(std::max(0, len))) ? 1 : 0; }
void mmrytm_hit(MMRytmEngine* e, const char* json, int len) { E(e)->faceHit(json, static_cast<size_t>(std::max(0, len))); }
void mmrytm_run(MMRytmEngine* e, int on) { E(e)->faceRun(on != 0); }
void mmrytm_fill(MMRytmEngine* e, int on) { E(e)->faceFill(on != 0); }
void mmrytm_midi(MMRytmEngine* e, int offset, int status, int d1, int d2) { E(e)->midi(offset, status, d1, d2); }
void mmrytm_set_host_position(MMRytmEngine* e, int playing, double ppq, double bpm) { E(e)->setHostPosition(playing != 0, ppq, bpm); }
void mmrytm_set_master_db(MMRytmEngine* e, double db) { E(e)->setMasterDb(static_cast<float>(db)); }

const int32_t* mmrytm_feedback(MMRytmEngine* e) {
    const auto fb = E(e)->feedback();
    auto& o = H(e)->fb;
    o = {fb.playing ? 1 : 0, fb.internal ? 1 : 0, fb.playing ? fb.step : -1, fb.seq, fb.mask};
    return o.data();
}

const int32_t* mmrytm_stats(MMRytmEngine* e) {
    const auto& s = E(e)->stats;
    auto& o = H(e)->st;
    o.fill(0);
    o[0] = s.programs;
    o[1] = s.published;
    o[2] = s.liveNow;
    o[3] = s.liveLater;
    o[4] = s.rendered;
    o[5] = s.delivered;
    o[6] = s.jobs;
    o[7] = s.notes;
    if (auto ps = E(e)->latest()) {
        o[8] = static_cast<int32_t>(std::lround(ps->prog.bpm * 1000));
        o[9] = ps->prog.len;
        o[10] = ps->prog.loop;
        o[11] = static_cast<int32_t>(ps->prog.sounds.size());
        int hits = 0, plays = 0;
        for (const auto& t : ps->prog.tracks) {
            hits += static_cast<int>(t.hits.size());
            if (t.plays) ++plays;
        }
        o[12] = hits;
        o[13] = plays;
        o[14] = static_cast<int32_t>(std::lround(ps->prog.fx.reverb * 1000));
        o[15] = static_cast<int32_t>(std::lround(ps->prog.swing * 1000));
    }
    return o.data();
}
int mmrytm_stats_size(void) { return 16; }

void mmrytm_set_async(MMRytmEngine* e, int on) { E(e)->setAsync(on != 0); }

int mmrytm_job_take(MMRytmEngine* e) {
    const auto* j = E(e)->takeJob();
    return j ? j->id : 0;
}
const double* mmrytm_job_desc(MMRytmEngine* e, int id) {
    auto& d = H(e)->desc;
    d.fill(0);
    if (const auto* j = E(e)->job(id)) {
        if (j->reverb) {
            d[0] = -1;
            d[1] = j->sr;
            d[2] = j->sec;
            d[3] = j->hi;
            d[4] = j->pre;
        } else
            mmrytmweb::soundToDesc(j->sound, j->sr, d.data());
    }
    return d.data();
}
const char* mmrytm_job_sample(MMRytmEngine* e, int id) {
    const auto* j = E(e)->job(id);
    return j && !j->reverb ? j->sound.sample.c_str() : "";
}
int mmrytm_job_desc_size(void) { return mmrytmweb::kDescN; }

void mmrytm_job_sound_begin(MMRytmEngine* e, int id, int variants) {
    auto& b = H(e)->building[id];
    b.clear();
    b.reserve(static_cast<size_t>(std::max(0, variants)));
}
void mmrytm_job_sound_variant(MMRytmEngine* e, int id, const float* L, const float* R, int n) {
    auto& b = H(e)->building[id];
    mm::Shot s;
    s.mono = R == nullptr;
    s.L.assign(L, L + std::max(0, n));
    if (R) s.R.assign(R, R + std::max(0, n));
    b.push_back(std::move(s));
}
int mmrytm_job_sound_end(MMRytmEngine* e, int id) {
    auto& all = H(e)->building;
    auto it = all.find(id);
    if (it == all.end()) return 0;
    std::vector<mm::Shot> v = std::move(it->second);
    all.erase(it);
    return E(e)->deliverSound(id, std::move(v)) ? 1 : 0;
}
int mmrytm_job_reverb(MMRytmEngine* e, int id, int parts, const float* H0, const float* H1) {
    auto ir = std::make_shared<mm::ReverbIR>();
    ir->parts = parts;
    const size_t n = static_cast<size_t>(std::max(0, parts)) * (mm::ReverbIR::N / 2 + 1);
    for (int ch = 0; ch < 2; ++ch) {
        const float* H = ch == 0 ? H0 : H1;
        auto& dst = ir->H[static_cast<size_t>(ch)];
        dst.resize(n);
        for (size_t k = 0; k < n; ++k) dst[k] = std::complex<float>(H[2 * k], H[2 * k + 1]);
    }
    return E(e)->deliverReverb(id, std::move(ir)) ? 1 : 0;
}
void mmrytm_job_fail(MMRytmEngine* e, int id) { E(e)->failJob(id); }

int mmrytm_bank_add(const char* file, int fileLen, const void* data, int size) {
    return mmrytmweb::Bank::get().add(std::string(file, static_cast<size_t>(std::max(0, fileLen))), data, static_cast<size_t>(std::max(0, size))) ? 1 : 0;
}
int mmrytm_bank_count(void) { return mmrytmweb::Bank::get().count(); }
int mmrytm_bank_has(const char* key, int keyLen) {
    return mmrytmweb::Bank::get().byKey(std::string(key, static_cast<size_t>(std::max(0, keyLen)))) ? 1 : 0;
}

void* mmrytm_render_sound(const double* desc, const char* sample, int sampleLen) {
    mm::ProgSound s;
    double sr = 0;
    mmrytmweb::descToSound(desc, s, sr);
    s.sample.assign(sample, static_cast<size_t>(std::max(0, sampleLen)));
    auto r = mmrytmweb::renderSound(s, sr);
    return new std::vector<mm::Shot>(std::move(r->variants));
}
int mmrytm_rendered_count(void* r) { return static_cast<int>(static_cast<std::vector<mm::Shot>*>(r)->size()); }
int mmrytm_rendered_len(void* r, int v) { return static_cast<int>((*static_cast<std::vector<mm::Shot>*>(r))[static_cast<size_t>(v)].size()); }
int mmrytm_rendered_mono(void* r, int v) { return (*static_cast<std::vector<mm::Shot>*>(r))[static_cast<size_t>(v)].mono ? 1 : 0; }
const float* mmrytm_rendered_L(void* r, int v) { return (*static_cast<std::vector<mm::Shot>*>(r))[static_cast<size_t>(v)].L.data(); }
const float* mmrytm_rendered_R(void* r, int v) { return (*static_cast<std::vector<mm::Shot>*>(r))[static_cast<size_t>(v)].right().data(); }
void mmrytm_rendered_free(void* r) { delete static_cast<std::vector<mm::Shot>*>(r); }

void* mmrytm_render_reverb(double sec, double hi, double pre, double sr) {
    auto ir = mm::ReverbIR::make(sec, hi, pre, sr);
    return new std::shared_ptr<mm::ReverbIR>(std::move(ir));
}
int mmrytm_reverb_parts(void* ir) { return (*static_cast<std::shared_ptr<mm::ReverbIR>*>(ir))->parts; }
const float* mmrytm_reverb_H(void* ir, int ch) {
    return reinterpret_cast<const float*>((*static_cast<std::shared_ptr<mm::ReverbIR>*>(ir))->H[static_cast<size_t>(ch & 1)].data());
}
void mmrytm_reverb_free(void* ir) { delete static_cast<std::shared_ptr<mm::ReverbIR>*>(ir); }

void* mmrytm_alloc(int bytes) { return std::malloc(static_cast<size_t>(std::max(1, bytes))); }
void mmrytm_free(void* p) { std::free(p); }
}
