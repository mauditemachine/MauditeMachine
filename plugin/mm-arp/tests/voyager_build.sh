#!/usr/bin/env bash
# Le banc du moteur MM-ARP (dsp/Voyager.cpp) contre le vrai worklet du site, sans son, sans npm ni JUCE.
#   plugin/mm-arp/tests/voyager_build.sh [dossier]      reference JS + build + comparaison + blocs + CPU
# CXX=clang++ pour l'autre compilateur. Code de sortie non nul si un cas depasse -100 dB ou si --blocks echoue.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="${1:-$here/.voyager-ref}"
CXX="${CXX:-g++}"
node "$here/voyager-ref.mjs" "$out"
"$CXX" -O2 -std=c++17 -Wall -Wextra -ffp-contract=off "$here/../dsp/Voyager.cpp" "$here/voyager_compare.cpp" -o "$out/voyager_compare"
"$out/voyager_compare" "$out"
"$out/voyager_compare" "$out" --blocks
"$out/voyager_compare" "$out" --cpu
