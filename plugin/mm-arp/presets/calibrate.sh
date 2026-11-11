#!/usr/bin/env bash
# MM-ARP : cale le VOLUME de chaque preset d'usine sur sa cible de sonie (-23 LUFS, les TEXTURE -25), sans aucun son.
# Le rendu hors ligne (tests/presets_render.cpp, moteur x8 comme les presets) ecrit presets/volumes.json, presets/build.mjs
# le relit ; trois tours (la saturation et la colle font que le gain ne suit pas exactement VOLUME au carre).
#
#   plugin/mm-arp/presets/calibrate.sh [dossier de build] [tours]
#
# Puis verifier : plugin/mm-arp/tests/presets-render.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN="$(cd "$HERE/.." && pwd)"
BUILD="${1:-$PLUGIN/build-presets}"
TURNS="${2:-3}"
cmake -S "$PLUGIN" -B "$BUILD" -DMM_BUILD_PLUGIN=OFF -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build "$BUILD" -j --target mmarp_dsp >/dev/null
"${CXX:-c++}" -std=c++17 -O2 -ffp-contract=off -I"$PLUGIN/dsp" -I"$PLUGIN/src" "$PLUGIN/tests/presets_render.cpp" "$BUILD/libmmarp_dsp.a" -lpthread -o "$BUILD/presets_render"
for i in $(seq 1 "$TURNS"); do
  node "$HERE/build.mjs" >/dev/null
  "$BUILD/presets_render" "$PLUGIN/presets/factory.json" --os 8 --calibrate "$HERE/volumes.json" | grep -E "CIBLE|TROP|CRETE[<>]|VOLUME de calage" | sed "s/^/  tour $i : /" || true
done
node "$HERE/build.mjs"
