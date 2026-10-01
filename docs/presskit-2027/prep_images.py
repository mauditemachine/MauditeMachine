"""
Images du press kit 2027 (version 4 pages) : trois formats contenus,
JPEG qualite 82, la definition utile pour 300 ppp a la taille d'affichage
et pas plus (jamais d'agrandissement : la source fixe le plafond). sRGB,
sans filtre, sans grain, sans vignettage. Sources : les photos retenues de
public/press (deja converties en sRGB).

  page 1 : bandeau haut pleine largeur, 210 x 90 mm
  page 2 : portrait en colonne, 55 x 72 mm
  page 3 : public en bandeau, 182 x 55 mm

Usage : python prep_images.py   (pillow)
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PRESS = os.path.join(ROOT, "public", "press")
OUT = os.path.join(HERE, "img")
MM = 300 / 25.4

# nom de sortie, source, boite de recadrage (px source), taille d'affichage (mm)
CROPS = [
    ("banner-cover.jpg", "maudite-machine-2027-cover-dj.jpg", (0, 850, 2480, 1913), (210, 90)),
    ("portrait.jpg", "maudite-machine-2027-portrait-bw.jpg", (0, 40, 1936, 2574), (55, 72)),
    ("banner-crowd.jpg", "maudite-machine-2027-crowd.jpg", (0, 230, 2048, 849), (182, 55)),
]

os.makedirs(OUT, exist_ok=True)
for name, src, box, (wmm, hmm) in CROPS:
    im = Image.open(os.path.join(PRESS, src)).crop(box).convert("RGB")
    w = min(im.width, round(wmm * MM))
    h = round(w * hmm / wmm)
    im = im.resize((w, h), Image.LANCZOS)
    path = os.path.join(OUT, name)
    im.save(path, "JPEG", quality=82, dpi=(300, 300), optimize=True)
    print(f"{name:18s} {w} x {h}  {w / (wmm / 25.4):.0f} ppp  {os.path.getsize(path) // 1024} Ko")
