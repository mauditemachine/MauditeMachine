#!/bin/sh
# Image d'apercu des liens : rend og.html (1200 x 630) avec Chrome sans tete,
# puis JPEG qualite 85 dans public/images/og-image.jpg.
# Usage : sh docs/og-image/build.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=3000 \
  --screenshot="$TMP/og.png" "file://$HERE/og.html" >/dev/null 2>&1
sips -s format jpeg -s formatOptions 85 "$TMP/og.png" --out "$ROOT/public/images/og-image.jpg" >/dev/null
rm -rf "$TMP"
sips -g pixelWidth -g pixelHeight "$ROOT/public/images/og-image.jpg" | tail -2
ls -la "$ROOT/public/images/og-image.jpg"
