#!/usr/bin/env bash
# MM-ARP : verification de la banque d'usine du VST3 (plugin/mm-arp/presets), sans aucun son (tout dans des buffers).
#   1. la banque est a jour et valide (presets/build.mjs --check, tests/presets-check.mjs) ;
#   2. le DSP du plugin (cmake, sans JUCE) et l'outil tests/presets_render.cpp ;
#   3. le rendu hors ligne de chaque preset (8 mesures a son bpm) : crete, sonie, centroide, largeur, basses, notes,
#      NaN, et le controle de diversite.
#
#   plugin/mm-arp/tests/presets-render.sh [dossier de build] [--os 8] [--wav <dossier>] [--only <NOM>]
#
# Le dossier de build (par defaut plugin/mm-arp/build-presets, ignore par git) recoit libmmarp_dsp.a et presets_render. Les WAV
# (--wav) sont pour Mika : ne jamais les jouer pendant un test.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN="$(cd "$HERE/.." && pwd)"
BUILD="${1:-$PLUGIN/build-presets}"
case "$BUILD" in --*) BUILD="$PLUGIN/build-presets" ;; *) shift || true ;; esac

node "$PLUGIN/presets/build.mjs" --check
node "$HERE/presets-check.mjs"

cmake -S "$PLUGIN" -B "$BUILD" -DMM_BUILD_PLUGIN=OFF -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build "$BUILD" -j --target mmarp_dsp >/dev/null
"${CXX:-c++}" -std=c++17 -O2 -ffp-contract=off -I"$PLUGIN/dsp" -I"$PLUGIN/src" "$HERE/presets_render.cpp" "$BUILD/libmmarp_dsp.a" -lpthread -o "$BUILD/presets_render"

prev=""
for a in "$@"; do if [ "$prev" = "--wav" ]; then mkdir -p "$a"; fi; prev="$a"; done
"$BUILD/presets_render" "$PLUGIN/presets/factory.json" "$@"
