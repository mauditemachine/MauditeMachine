#!/usr/bin/env bash
# La mesure du Decapitator contre la DISTO du MM-ARP (2026-11-16). Sur le Mac, depuis la racine du depot :
#
#   bash plugin/mm-arp/tests/decap-measure/run.sh                 la mesure complete (quelques minutes)
#   bash plugin/mm-arp/tests/decap-measure/run.sh --quick         un essai rapide (moins d'une minute)
#   DECAP=/chemin/Decapitator.vst3 bash .../run.sh                un autre emplacement (ou le .component AU)
#
# Hors ligne, en memoire : AUCUN son ne sort des enceintes. Le Decapitator n'est jamais copie : seules les mesures
# (results/*.json, results/compare.txt) vont dans le depot.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
OUT="$HERE/results"
DECAP="${DECAP:-/Library/Audio/Plug-Ins/VST3/Soundtoys/Decapitator.vst3}"
[ -e "$DECAP" ] || DECAP="$HOME/Library/Audio/Plug-Ins/VST3/Soundtoys/Decapitator.vst3"
[ -e "$DECAP" ] || DECAP="/Library/Audio/Plug-Ins/VST3/Decapitator.vst3"
if [ ! -e "$DECAP" ]; then
  echo "Decapitator.vst3 introuvable. Donne son chemin : DECAP=/chemin/Decapitator.vst3 bash $0" >&2
  exit 1
fi
echo "Decapitator : $DECAP"

# Python a part (pedalboard de Spotify charge les VST3, numpy calcule), dans ~/.cache : rien d'installe ailleurs
VENV="$HOME/.cache/mm-decap-measure"
if [ ! -x "$VENV/bin/python" ]; then
  echo "Installation de pedalboard et numpy dans $VENV (une seule fois)..."
  python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q --upgrade pip pedalboard numpy
PY="$VENV/bin/python"

mkdir -p "$OUT"
echo "1/3 Les parametres du Decapitator..."
"$PY" "$HERE/measure.py" --plugin "$DECAP" --list > "$OUT/decapitator-params.json"
echo "2/3 La mesure du Decapitator..."
"$PY" "$HERE/measure.py" --plugin "$DECAP" "$@" --out "$OUT/decapitator.json"

# La DISTO du MM-ARP : seulement si un compilateur C++ est la (Xcode Command Line Tools) ; sinon Claude la mesure
# de son cote, avec le meme script
if command -v c++ >/dev/null 2>&1; then
  echo "3/3 La DISTO du MM-ARP, puis la comparaison..."
  CLI="$OUT/.mmarp_decap_cli"
  c++ -std=c++17 -O2 "$ROOT/plugin/mm-arp/dsp/Decap.cpp" "$ROOT/plugin/mm-arp/tests/decap_cli.cpp" -o "$CLI"
  "$PY" "$HERE/measure.py" --cli "$CLI" "$@" --out "$OUT/mm-disto.json"
  "$PY" "$HERE/measure.py" --compare "$OUT/decapitator.json" "$OUT/mm-disto.json" | tee "$OUT/compare.txt"
  rm -f "$CLI"
else
  echo "3/3 Pas de compilateur C++ : la comparaison se fera du cote de Claude."
fi

echo
echo "Fini. Pour envoyer les mesures a Claude :"
echo "  git add plugin/mm-arp/tests/decap-measure/results && git commit -m 'mesures Decapitator' && git push"
