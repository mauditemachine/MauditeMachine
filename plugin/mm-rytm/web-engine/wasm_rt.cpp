// Le moteur dans le navigateur (WebAssembly, wasm32-wasi, sans exceptions) : la libc++ de WASI garde un operator new qui
// lance std::bad_alloc ; sans exceptions, un manque de memoire arrete le module (comme abort), rien d'autre ne lance.
// Compile seulement pour le build wasm (scripts/build-rytm-wasm.sh), jamais dans le VST3 ni dans les tests natifs.
#include <cstddef>
#include <cstdlib>

extern "C" void* __cxa_allocate_exception(std::size_t) { std::abort(); }
extern "C" void __cxa_throw(void*, void*, void (*)(void*)) { std::abort(); }
