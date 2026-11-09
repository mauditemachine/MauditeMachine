#!/bin/bash
# MM-ARP : installe le dernier build par-dessus le plugin en place (2026-11-09, la meme chose que MM-RYTM, voir
# plugin/mm-rytm/update.sh). Le build : la release mm-arp-latest du
# depot (le CI la remplace a chaque build vert), telechargee par curl, donc sans quarantaine ; ou le zip (ou le dossier)
# donne en argument, l'artefact telecharge a la main. La quarantaine est retiree et la signature ad hoc refaite sur
# place, comme la commande d'INSTALL.md (sans passer par Gatekeeper).
#
#   curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
#   bash update.sh ~/Downloads/MM-ARP-macOS.zip
set -euo pipefail

URL="https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/MM-ARP-macOS.zip"
SYS="/Library/Audio/Plug-Ins/VST3/MM-ARP.vst3"
USR="$HOME/Library/Audio/Plug-Ins/VST3/MM-ARP.vst3"

[ "$(uname)" = "Darwin" ] || { echo "Ce script est pour macOS."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

IN="${1:-}"
if [ -z "$IN" ]; then
  echo "MM-ARP : telechargement du dernier build..."
  curl -fL --progress-bar -o "$TMP/dl.zip" "$URL" || { echo "Telechargement impossible ($URL)."; exit 1; }
  IN="$TMP/dl.zip"
fi
[ -e "$IN" ] || { echo "Introuvable : $IN"; exit 1; }

VST=""
if [ -d "$IN" ]; then
  case "$IN" in
    *.vst3) VST="$IN" ;;
    *) VST="$(find "$IN" -maxdepth 3 -type d -name 'MM-ARP.vst3' | head -n 1)" ;;
  esac
else
  # L'artefact de GitHub est un zip qui contient le zip du CI : jusqu'a trois niveaux
  cp "$IN" "$TMP/0.zip"
  for i in 1 2 3; do
    mkdir "$TMP/$i"
    ditto -x -k "$TMP/$((i - 1)).zip" "$TMP/$i"
    VST="$(find "$TMP/$i" -maxdepth 3 -type d -name 'MM-ARP.vst3' | head -n 1)"
    [ -n "$VST" ] && break
    Z="$(find "$TMP/$i" -maxdepth 2 -type f -name '*.zip' | head -n 1)"
    [ -n "$Z" ] || break
    mv "$Z" "$TMP/$i.zip"
  done
fi
[ -n "$VST" ] || { echo "MM-ARP.vst3 introuvable dans $IN."; exit 1; }
if [ -f "$(dirname "$VST")/BUILD.txt" ]; then echo "Build : $(cat "$(dirname "$VST")/BUILD.txt")"; fi

# La ou il est deja installe (le dossier du systeme d'abord) ; sinon le dossier du systeme
DEST="$SYS"
if [ ! -d "$SYS" ] && [ -d "$USR" ]; then DEST="$USR"; fi
SUDO=""
case "$DEST" in /Library/*) SUDO="sudo" ;; esac

if pgrep -x Live >/dev/null 2>&1; then
  echo "Ableton est ouvert : il garde l'ancien plugin jusqu'a ce que tu le quittes et le rouvres."
fi
if [ -n "$SUDO" ]; then echo "Remplacement de $DEST (le mot de passe du Mac est demande)."; fi
$SUDO mkdir -p "$(dirname "$DEST")"
$SUDO rm -rf "$DEST"
$SUDO ditto "$VST" "$DEST"
$SUDO xattr -cr "$DEST"
$SUDO codesign --force --deep --sign - "$DEST"

echo "OK : $DEST est a jour. Rouvre Ableton (Option + Rescan si le plugin n'apparait pas)."
