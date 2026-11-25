#!/usr/bin/env bash
# Le moteur du MM-RYTM pour le navigateur (2026-11-25, /mm-rytm/play/) : plugin/mm-rytm/web-engine (le processeur du VST3
# sans JUCE) et le DSP du plugin (plugin/mm-rytm/dsp), compiles en WebAssembly (wasm32-wasi, un module "reactor" sans
# glu JS), vers public/mm-rytm/mm-rytm-engine.wasm (hors de git : refait par la CI, .github/workflows/pages.yml). Le
# meme module sert deux fois : dans l'AudioWorklet (le processeur) et dans un Worker (le calcul des sons, le fil du
# calcul du VST3).
#
#   npm run plugin:rytm:wasm
#
# Il faut clang et lld (18 ou plus) et la libc WASI. Ubuntu 24.04 :
#   sudo apt-get install -y clang lld wasi-libc libc++-18-dev-wasm32 libc++abi-18-dev-wasm32 libclang-rt-18-dev-wasm32
# Memes options que le DSP : -ffp-contract=off, jamais -ffast-math (le son au bit pres, web-engine/README.md).
# Imports du module : wasi_snapshot_preview1.{fd_close, fd_seek, fd_write} seulement (plus d'autres si la libc en ajoute :
# le worklet bouche tout import inconnu).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RYTM="$ROOT/plugin/mm-rytm"
OUT="${1:-$ROOT/public/mm-rytm/mm-rytm-engine.wasm}"
CXX="${CXX_WASM:-}"
if [ -z "$CXX" ]; then
  for c in clang++ clang++-20 clang++-19 clang++-18; do
    if command -v "$c" >/dev/null 2>&1; then CXX="$c"; break; fi
  done
fi
if [ -z "$CXX" ]; then
  echo "build-rytm-wasm : clang++ introuvable" >&2
  exit 1
fi

# Les fonctions de l'API C (RytmEngine.h), exportees telles quelles
EXPORTS=$(grep -o 'mmrytm_[A-Za-z_0-9]*(' "$RYTM/web-engine/RytmEngine.h" | sort -u | tr -d '(' | sed 's/^/-Wl,--export=/' | tr '\n' ' ')

mkdir -p "$(dirname "$OUT")"
TMP="$OUT.tmp"
# shellcheck disable=SC2086
"$CXX" --target=wasm32-wasi -O3 -std=c++17 -ffp-contract=off -fno-exceptions -fno-rtti -mexec-model=reactor \
  -include "$RYTM/web-engine/wasm_compat.h" -I"$RYTM/dsp" -I"$RYTM/web-engine" \
  "$RYTM/web-engine/RytmEngine.cpp" "$RYTM/web-engine/wasm_rt.cpp" \
  "$RYTM/dsp/Shots.cpp" "$RYTM/dsp/Engine.cpp" "$RYTM/dsp/Program.cpp" "$RYTM/dsp/Fx.cpp" \
  -Wl,--initial-memory=67108864 -Wl,--max-memory=536870912 -Wl,-z,stack-size=1048576 -Wl,--strip-all \
  $EXPORTS -o "$TMP"
mv "$TMP" "$OUT"
echo "build-rytm-wasm : $(wc -c <"$OUT" | tr -d ' ') octets -> ${OUT#"$ROOT/"}"
