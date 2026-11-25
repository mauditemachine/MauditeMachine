#!/usr/bin/env bash
# Le moteur du MM-ARP pour le navigateur (2026-11-25, /mm-arp/play/) : plugin/mm-arp/web-engine (le processeur du VST3
# sans JUCE) et le DSP du plugin (plugin/mm-arp/dsp), compiles en WebAssembly (wasm32-wasi, un module "reactor" sans glu
# JS), vers public/mm-arp/mm-arp-engine.wasm (hors de git : refait par la CI, .github/workflows/pages.yml).
#
#   npm run plugin:arp:wasm
#
# Il faut clang et lld (18 ou plus) et la libc WASI. Ubuntu 24.04 :
#   sudo apt-get install -y clang lld wasi-libc libc++-18-dev-wasm32 libc++abi-18-dev-wasm32 libclang-rt-18-dev-wasm32
# Memes options que le DSP du VST3 : -ffp-contract=off, jamais -ffast-math (le son au bit pres, web-engine/README.md).
# Imports du module : wasi_snapshot_preview1.{clock_time_get, fd_close, fd_seek, fd_write, random_get} seulement.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARP="$ROOT/plugin/mm-arp"
OUT="${1:-$ROOT/public/mm-arp/mm-arp-engine.wasm}"
CXX="${CXX_WASM:-}"
if [ -z "$CXX" ]; then
  for c in clang++ clang++-20 clang++-19 clang++-18; do
    if command -v "$c" >/dev/null 2>&1; then CXX="$c"; break; fi
  done
fi
if [ -z "$CXX" ]; then
  echo "build-arp-wasm : clang++ introuvable" >&2
  exit 1
fi

# Les fonctions de l'API C (ArpEngine.h), exportees telles quelles
EXPORTS=$(grep -o 'mmarp_[a-z_0-9]*(' "$ARP/web-engine/ArpEngine.h" | sort -u | tr -d '(' | sed 's/^/-Wl,--export=/' | tr '\n' ' ')

mkdir -p "$(dirname "$OUT")"
TMP="$OUT.tmp"
# shellcheck disable=SC2086
"$CXX" --target=wasm32-wasi -O3 -std=c++17 -ffp-contract=off -fno-exceptions -fno-rtti -mexec-model=reactor \
  -I"$ARP/dsp" -I"$ARP/src" -I"$ARP/web-engine" \
  "$ARP/web-engine/ArpEngine.cpp" "$ARP/web-engine/wasm_rt.cpp" \
  "$ARP/dsp/Voyager.cpp" "$ARP/dsp/ArpFx.cpp" "$ARP/dsp/Arp.cpp" "$ARP/dsp/Params.cpp" "$ARP/dsp/Hell.cpp" \
  "$ARP/dsp/Hell2.cpp" "$ARP/dsp/Sky.cpp" "$ARP/dsp/Decap.cpp" "$ARP/dsp/Echo.cpp" "$ARP/dsp/ParamEq.cpp" \
  -Wl,--initial-memory=67108864 -Wl,--max-memory=268435456 -Wl,-z,stack-size=1048576 -Wl,--strip-all \
  $EXPORTS -o "$TMP"
mv "$TMP" "$OUT"
echo "build-arp-wasm : $(wc -c <"$OUT" | tr -d ' ') octets -> ${OUT#"$ROOT/"}"
