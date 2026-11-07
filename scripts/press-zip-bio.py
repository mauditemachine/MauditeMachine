#!/usr/bin/env python3
"""
bio.txt dans le zip du press kit (2026-11-07, Mika : "Ajoute aussi la bio courte EN et la bio longue EN dans le zip
maudite-machine-press-kit.zip sous bio.txt").

Le texte vient de src/data/pressBio.json, la meme source que la section Bio de /press (scripts/press-pages.mjs).
Le zip est reecrit a l'identique (memes entrees, meme ordre, memes dates, meme compression), avec
maudite-machine-press-kit/bio.txt remplace ou ajoute. Node n'a pas de zip sans dependance : Python, qui est sur le Mac.

    python3 scripts/press-zip-bio.py          (apres un changement de src/data/pressBio.json)
"""

import json
import os
import sys
import tempfile
import time
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP = os.path.join(ROOT, 'public', 'press', 'maudite-machine-press-kit.zip')
NAME = 'maudite-machine-press-kit/bio.txt'


def bio_text():
    with open(os.path.join(ROOT, 'src', 'data', 'pressBio.json'), encoding='utf-8') as f:
        bio = json.load(f)
    en = bio['en']
    lines = ['MAUDITE MACHINE', '', 'SHORT BIO', '', en['short'], '', 'LONG BIO', '']
    lines += '\n\n'.join(en['long']).split('\n')
    return '\n'.join(lines) + '\n'


def main():
    text = bio_text().encode('utf-8')
    fd, tmp = tempfile.mkstemp(suffix='.zip', dir=os.path.dirname(ZIP))
    os.close(fd)
    try:
        with zipfile.ZipFile(ZIP) as src, zipfile.ZipFile(tmp, 'w') as dst:
            for info in src.infolist():
                if info.filename == NAME:
                    continue
                dst.writestr(info, src.read(info.filename))
            info = zipfile.ZipInfo(NAME, date_time=time.localtime()[:6])
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            dst.writestr(info, text)
        os.chmod(tmp, 0o644)
        os.replace(tmp, ZIP)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    print(f'press-zip-bio : {NAME} ecrit ({len(text)} octets) dans public/press/maudite-machine-press-kit.zip')


if __name__ == '__main__':
    sys.exit(main())
