"""
Images du press kit 2027 : recadrages encadres (aucune photo pleine page),
300 ppp a la taille d'impression, sRGB, JPEG qualite 85. Sources : les
photos retenues de public/press (deja converties en sRGB) et les pochettes
de public/press/covers. Pas de filtre, pas de grain, pas de vignettage.

Usage : python prep_images.py   (pillow)
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PRESS = os.path.join(ROOT, "public", "press")
OUT = os.path.join(HERE, "img")
MM = 300 / 25.4

# nom de sortie, source, boite de recadrage (px source), taille d'impression (mm)
CROPS = [
    ("cover-inset.jpg", "maudite-machine-2027-cover-dj.jpg", (0, 1000, 2480, 3100), (180, 152)),
    ("set-inset.jpg", "maudite-machine-2027-booth-blue.jpg", (0, 150, 2480, 1666), (180, 110)),
    ("crowd-inset.jpg", "maudite-machine-2027-crowd.jpg", (0, 230, 2048, 1026), (180, 70)),
    ("portrait.jpg", "maudite-machine-2027-portrait-bw.jpg", (0, 60, 1936, 2558), (62, 80)),
    # Bandeau noir et blanc de la page 9, sans le logo du lieu (coin bas droit)
    ("hosp-band.jpg", "maudite-machine-press-01-bw.jpg", (0, 170, 2059, 920), (180, 66)),
]

COVERS = [
    "Voodoo", "Limbos", "SyncButton", "Kouklikou", "Anarchic", "Autopsynth", "BackOnTrack",
    "Nocturne", "Coagule", "Richie", "Tati Cardi", "Drama Queen 1", "Discowriders",
]


def save(im, path, w_px, h_px):
    im = im.convert("RGB")
    if im.size != (w_px, h_px):
        im = im.resize((w_px, h_px), Image.LANCZOS)
    im.save(path, "JPEG", quality=85, dpi=(300, 300), optimize=True)
    print(f"{os.path.basename(path):24s} {w_px} x {h_px}")


os.makedirs(os.path.join(OUT, "covers"), exist_ok=True)
for name, src, box, (wmm, hmm) in CROPS:
    im = Image.open(os.path.join(PRESS, src)).crop(box)
    # Jamais d'agrandissement : la source fixe le plafond de definition
    scale = min(1.0, (wmm * MM) / im.width)
    save(im, os.path.join(OUT, name), round(im.width * scale), round(im.height * scale))

for c in COVERS:
    im = Image.open(os.path.join(PRESS, "covers", f"{c}.webp"))
    slug = c.lower().replace(" ", "-")
    save(im, os.path.join(OUT, "covers", f"{slug}.jpg"), 420, 420)

# Limbos en grand (50 mm) : la source fait 750 px
save(Image.open(os.path.join(PRESS, "covers", "Limbos.webp")), os.path.join(OUT, "covers", "limbos-large.jpg"), 590, 590)
