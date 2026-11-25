// Le moteur dans le navigateur (wasm32-wasi, sans fils) : la libc++ de WASI n'a ni std::mutex ni std::lock_guard
// (_LIBCPP_HAS_NO_THREADS), dont dsp/Engine.h se sert pour latest(). Un seul fil par instance ici (le worklet, ou le
// Worker du calcul) : des verrous vides suffisent, rien d'autre ne change. Inclus de force (-include) par
// scripts/build-rytm-wasm.sh, jamais dans le VST3 ni dans les tests natifs.
#pragma once

#include <mutex>

#if defined(_LIBCPP_HAS_NO_THREADS)
namespace std {
struct mutex {
    void lock() {}
    void unlock() {}
    bool try_lock() { return true; }
};
template <class M>
struct lock_guard {
    explicit lock_guard(M& m) : m_(m) { m_.lock(); }
    ~lock_guard() { m_.unlock(); }
    lock_guard(const lock_guard&) = delete;
    lock_guard& operator=(const lock_guard&) = delete;
    M& m_;
};
} // namespace std
#endif
