// v46 : la DISTO d'avant la v46 (dsp/Decap.cpp sans PUNISH v2 ni le LOW CUT de CLEAN LOW : MM_DECAP_NO_V2), compilee a
// part dans son propre espace de noms et avec les options du DSP, pour que decap_test verifie que la DISTO sans PUNISH v2
// (OFF) et l'ancien PUNISH (OLD DISTO PUNISH) restent au bit pres.
#define MM_DECAP_NO_V2 1
#define mmarp mmarp_v45
#include "../dsp/Decap.cpp"
#undef mmarp

#include <cstddef>
#include <cstdlib>
#include <cstring>
#include <type_traits>

static_assert(std::is_trivially_copyable<mmarp_v45::DecapSettings>::value, "DecapSettings se copie octet par octet");

/** Rend L, R (n echantillons, par blocs de block) par la DISTO d'avant ; s : un mmarp::DecapSettings (meme definition). */
void decapRefRender(const void* s, std::size_t size, float* L, float* R, int n, int block) {
    mmarp_v45::DecapSettings ds;
    if (size != sizeof ds) std::abort();
    std::memcpy(static_cast<void*>(&ds), s, sizeof ds);
    mmarp_v45::Decap d;
    d.prepare(48000);
    d.set(ds);
    for (int i = 0; i < n; i += block) d.process(L + i, R + i, std::min(block, n - i));
}
