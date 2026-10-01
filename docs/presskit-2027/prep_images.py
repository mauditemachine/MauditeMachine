"""
Images du press kit 2027, revision 2 (six pages) : JPEG qualite 82, la
definition utile pour 300 ppp a la taille d'affichage et pas plus (jamais
d'agrandissement : la source fixe le plafond). sRGB, sans filtre, sans
grain, sans vignettage : un recadrage, rien d'autre.

Sources : docs/presskit-2027/photos/ (les originaux retenus, reduits a
3000 px, depuis le dossier Drive "Maudite Machine PressKit & Techrider /
Photos" et public/press/), et les pochettes de public/press/covers/.

Recadrage : le plus grand rectangle au format voulu, centre sur un point
d'interet (fx, fy en fraction de la source), borne a l'image.

Usage : python prep_images.py   (pillow)
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(HERE, "photos")
COVERS = os.path.join(ROOT, "public", "press", "covers")
OUT = os.path.join(HERE, "img")
MM = 300 / 25.4

# sortie, source, point d'interet (fx, fy), taille d'affichage (mm)
PHOTOS = [
    # 1. couverture : la salle pleine, la scene au fond
    ("p1-stage-crowd.jpg", "stage-crowd.jpg", (0.5, 0.5), (210, 122)),
    # 2. parcours : le portrait couleur en lumiere rose
    ("p2-portrait.jpg", "portrait-pink.jpg", (0.5, 0.27), (70, 93)),
    ("p2-wide.jpg", "booth-trails.jpg", (0.55, 0.45), (182, 84)),
    # 3. le son : la cabine en grand, puis les deux formats
    ("p3-booth.jpg", "booth-blue-fist.jpg", (0.62, 0.42), (182, 122)),
    ("p3-dj.jpg", "booth-orange.jpg", (0.5, 0.42), (44, 66)),
    ("p3-live.jpg", "live-ledwall.jpg", (0.62, 0.55), (44, 66)),
    # 4. dates : la foule vue de la cabine, puis deux scenes
    ("p4-crowd.jpg", "booth-crowd-ring.jpg", (0.55, 0.55), (182, 70)),
    ("p4-day.jpg", "booth-daylight.jpg", (0.42, 0.42), (89, 62)),
    ("p4-flare.jpg", "booth-flare.jpg", (0.55, 0.5), (89, 62)),
    # 5. ecoute : la cabine sous le faisceau
    ("p5-booth.jpg", "booth-blue-beam.jpg", (0.42, 0.5), (182, 88)),
    # 6. technique et contact : le portrait noir et blanc, en vignette
    ("p6-portrait-bw.jpg", "portrait-bw.jpg", (0.5, 0.4), (19, 25)),
]

COVER_MM = 22.5
COVER_FILES = [
    ("voodoo", "Voodoo.webp"),
    ("limbos", "Limbos.webp"),
    ("syncbutton", "SyncButton.webp"),
    ("kouklikou", "Kouklikou.webp"),
    ("anarchic", "Anarchic.webp"),
    ("autopsynth", "Autopsynth.webp"),
    ("backontrack", "BackOnTrack.webp"),
    ("nocturne", "Nocturne.webp"),
    ("coagule", "Coagule.webp"),
    ("richie", "Richie.webp"),
    ("taticardi", "Tati Cardi.webp"),
    ("dramaqueen", "Drama Queen 1.webp"),
    ("discowriders", "Discowriders.webp"),
]


def crop_focus(im, aspect, fx, fy):
    """Le plus grand rectangle au format aspect (l / h), centre sur (fx, fy), dans l'image."""
    w, h = im.size
    if w / h > aspect:
        cw, ch = round(h * aspect), h
    else:
        cw, ch = w, round(w / aspect)
    x0 = min(max(round(fx * w - cw / 2), 0), w - cw)
    y0 = min(max(round(fy * h - ch / 2), 0), h - ch)
    return im.crop((x0, y0, x0 + cw, y0 + ch))


def save(im, name, wmm, hmm):
    w = min(im.width, round(wmm * MM))
    h = round(w * hmm / wmm)
    im = im.resize((w, h), Image.LANCZOS)
    path = os.path.join(OUT, name)
    im.save(path, "JPEG", quality=82, dpi=(300, 300), optimize=True)
    ppi = w / (wmm / 25.4)
    print(f"{name:22s} {w:5d} x {h:<5d} {ppi:4.0f} ppp  {os.path.getsize(path) // 1024:4d} Ko")


os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
for name, src, (fx, fy), (wmm, hmm) in PHOTOS:
    im = Image.open(os.path.join(SRC, src)).convert("RGB")
    save(crop_focus(im, wmm / hmm, fx, fy), name, wmm, hmm)
for key, src in COVER_FILES:
    im = Image.open(os.path.join(COVERS, src)).convert("RGB")
    save(crop_focus(im, 1, 0.5, 0.5), f"cover-{key}.jpg", COVER_MM, COVER_MM)
