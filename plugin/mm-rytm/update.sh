#!/bin/bash
# MM-RYTM : installe un build par-dessus le plugin en place (2026-11-08, Mika : "tu peux ecraser
# /Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3"). Le build : le zip donne en argument, sinon le plus recent de
# ~/Downloads (l'artefact MM-RYTM-macOS du CI, zippe une ou deux fois, ou deja ouvert par Safari). La quarantaine est
# retiree et la signature ad hoc refaite sur place, comme la commande d'INSTALL.md (sans passer par Gatekeeper).
#
#   curl -fsSL https://raw.githubusercontent.com/mauditemachine/MauditeMachine/claude/intelligent-ride-56tyeo/plugin/mm-rytm/update.sh | bash
#   bash update.sh ~/Downloads/MM-RYTM-macOS.zip
set -euo pipefail

SYS="/Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3"
USR="$HOME/Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3"

[ "$(uname)" = "Darwin" ] || { echo "Ce script est pour macOS."; exit 1; }

# Le build : l'argument, sinon le plus recent des zips MM-RYTM et des MM-RYTM.vst3 deja ouverts de ~/Downloads
IN="${1:-}"
if [ -z "$IN" ]; then
  IN="$( { ls -td "$HOME"/Downloads/MM-RYTM*.zip "$HOME"/Downloads/MM-RYTM*/MM-RYTM.vst3 "$HOME"/Downloads/MM-RYTM*/*/MM-RYTM.vst3 2>/dev/null || true; } | head -n 1)"
fi
[ -n "$IN" ] && [ -e "$IN" ] || { echo "Aucun build MM-RYTM dans ~/Downloads : telecharge d'abord l'artefact MM-RYTM-macOS du dernier build vert."; exit 1; }
echo "Build : $IN ($(stat -f '%Sm' "$IN"))"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
VST=""
if [ -d "$IN" ]; then
  case "$IN" in
    *.vst3) VST="$IN" ;;
    *) VST="$(find "$IN" -maxdepth 3 -type d -name 'MM-RYTM.vst3' | head -n 1)" ;;
  esac
else
  # L'artefact de GitHub est un zip qui contient le zip du CI : jusqu'a trois niveaux
  cp "$IN" "$TMP/0.zip"
  for i in 1 2 3; do
    mkdir "$TMP/$i"
    ditto -x -k "$TMP/$((i - 1)).zip" "$TMP/$i"
    VST="$(find "$TMP/$i" -maxdepth 3 -type d -name 'MM-RYTM.vst3' | head -n 1)"
    [ -n "$VST" ] && break
    Z="$(find "$TMP/$i" -maxdepth 2 -type f -name '*.zip' | head -n 1)"
    [ -n "$Z" ] || break
    mv "$Z" "$TMP/$i.zip"
  done
fi
[ -n "$VST" ] || { echo "MM-RYTM.vst3 introuvable dans $IN."; exit 1; }

# La ou il est deja installe (le dossier du systeme d'abord) ; sinon le dossier du systeme
DEST="$SYS"
if [ ! -d "$SYS" ] && [ -d "$USR" ]; then DEST="$USR"; fi
SUDO=""
case "$DEST" in /Library/*) SUDO="sudo" ;; esac

if pgrep -x Live >/dev/null 2>&1; then
  echo "Ableton est ouvert : il garde l'ancien plugin jusqu'a ce que tu le quittes et le rouvres."
fi
[ -n "$SUDO" ] && echo "Remplacement de $DEST (le mot de passe du Mac est demande)."
$SUDO mkdir -p "$(dirname "$DEST")"
$SUDO rm -rf "$DEST"
$SUDO ditto "$VST" "$DEST"
$SUDO xattr -cr "$DEST"
$SUDO codesign --force --deep --sign - "$DEST"

echo "OK : $DEST est a jour. Rouvre Ableton (Option + Rescan si le plugin n'apparait pas)."
