"""
QR codes du press kit 2027 : SVG noirs sur fond clair, sans logo, niveau
de correction M, marge de 4 modules. Chaque code est aussi ecrit en PNG
(dossier temporaire) et relu par un decodeur (zxing-cpp) : le texte decode
doit etre exactement l'URL voulue, sinon le script s'arrete.

Usage : python make_qr.py [dossier_png]   (segno, zxing-cpp, pillow)
"""
import os
import sys

import segno
import zxingcpp
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "qr")
PNG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "qr-check")

CODES = {
    "mixtape-39": "https://soundcloud.com/mauditemachine/mixtape-39-maudite-machine",
    "coagule": "https://soundcloud.com/mauditemachine/coagule",
    "zenith": "https://soundcloud.com/mauditemachine/zenith-original-mix",
    "limbos": "https://soundcloud.com/mauditemachine/limbos-original-mix",
    "spotify": "https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4",
    "bandcamp": "https://mauditemachine.bandcamp.com",
    "beatport": "https://www.beatport.com/artist/maudite-machine/500537",
    "soundcloud": "https://soundcloud.com/mauditemachine",
    "press": "https://mauditemachine.com/press",
}

os.makedirs(OUT, exist_ok=True)
os.makedirs(PNG, exist_ok=True)
ok = True
for name, url in CODES.items():
    qr = segno.make(url, error="m", micro=False)
    qr.save(os.path.join(OUT, f"{name}.svg"), scale=1, border=4, dark="#000000", light="#F6F1E7", xmldecl=False, svgns=True, nl=False, omitsize=True)
    png = os.path.join(PNG, f"{name}.png")
    qr.save(png, scale=10, border=4, dark="#000000", light="#F6F1E7")
    found = zxingcpp.read_barcodes(Image.open(png).convert("L"))
    text = found[0].text if found else None
    good = text == url
    ok = ok and good
    print(f"{'OK ' if good else 'BAD'} {name:11s} v{qr.version} -> {text}")
sys.exit(0 if ok else 1)
