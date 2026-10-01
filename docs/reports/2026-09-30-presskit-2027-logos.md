# 2026-09-30 : press kit 2027 et logos sur la machine

## 1. Ce qui a été fait

- `docs/presskit-2027/` : gabarit `presskit.html`, `presskit.css`, `build.mjs`, `make_qr.py`, `README.md`, images `img/`, QR codes `qr/`.
- `public/Presskit_Maudite_Machine_2027.pdf` : six pages A4, bandeau « Boom Festival 2027 · Alchemy Circle », 2,65 Mo.
- `public/Presskit_Maudite_Machine_2027_generic.pdf` : même document sans bandeau et sans la phrase Alchemy Circle de la page 3.
- `public/press/` : quatre photos 2027 (cover-dj, booth-blue, crowd, portrait-bw), ajoutées au zip avec le PDF neutre ; `index.html` pointe vers le PDF 2027, l'ancien 2026-27 reste en ligne et lié.
- Machine : `public/logo/mauditemachine-logo-aligned.svg` et `public/logo/mauditemachine-logotype.png`, dessinés dans la sérigraphie du panneau (`src/v4/scene/silk.ts`, `SILK_LOGOS` dans `src/v4/theme.ts`, redessin dans `renderer.ts`).

## 2. Décisions prises et pourquoi

- Rendu par Google Chrome sans tête et non Playwright : Playwright et Chromium ne sont pas dans le projet.
- Photos : couverture `_DSC1941-Enhanced-NR`, public `482084130...`, cabine `_DSC2148`, portrait `2022-03-28(69)`. Écartées : les trois images Gemini (générées par IA), le cadre GnB 2024 (graphisme tiers), les photos à filigrane, floues ou en doublon.
- Pochette de Zenith : celle de l'album Limbos (Zenith en fait partie selon `discography.json`).
- Textes en anglais, titres de page en anglais ; la ligne de couverture reste telle que fournie (« live hybride et DJ »).
- Années des performances : seulement celles données ; Piknic Électronik Montréal, SAT, Igloofest After et Centre Phi sans année.
- Page `/press` publique : bouton vers la version neutre, pour ne pas laisser croire à un booking au Boom ; idem dans le zip.
- Logos : le logo aligné remplace le texte MAUDITE MACHINE (texte gardé en repli si l'image ne charge pas) ; le logotype en haut à droite, V.4 / 2026 à sa gauche ; teinte bone de la sérigraphie.

## 3. Ce qui reste à faire / points en suspens

- Mika : relire le PDF Boom, puis pousser (`git push`) ; rien n'a été poussé.
- Le bouton PRESS de la machine pointe encore vers le press kit 2026-27 (`LIVE_DOCS` dans `src/v4/data.ts`), à changer si voulu.
- Modèle EmailJS : retaper `{{from_email}}` (voir session précédente).

## 4. Commandes utiles ajoutées

- `node docs/presskit-2027/build.mjs` : régénère les deux PDF.
- `python docs/presskit-2027/make_qr.py` : régénère et décode les QR codes (segno, zxing-cpp, pillow).
