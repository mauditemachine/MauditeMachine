# Rapport de session — Discographie /v2 : LP Limbos + rapprochements

Date : 2026-08-12
Mission : remplacer les 9 placeholders Limbo par les vrais titres du LP
avec leurs URLs SoundCloud (mapping proposé puis validé par GO avec
corrections), et brancher les rapprochements des tracks sans
correspondance.

## Ce qui a été fait

- **[discography.json](../../src/v2/data/discography.json)** : les 9
  placeholders « Limbo I…IX » sont remplacés par la tracklist
  officielle de l'album (ordre Bandcamp, durées vérifiées identiques à
  la seconde entre Bandcamp et SoundCloud) :
  1. Abyss · 2. Cephal · 3. Limbos · 4. Reaper · 5. Nortkele ·
  6. Muld · 7. Simetra · 8. Zenith ·
  9. Chimie Electrique (Emotional Remix)
  Chaque piste : project « Limbos LP », year 2025, category originals,
  soundcloudUrl du profil, lien externe vers l'album Bandcamp
  (mauditemachine.bandcamp.com/album/limbos).
- **Piste 9 en Originals** (décision Mika) : elle fait partie du LP ;
  le filtre Remixes est réservé aux remixes faits POUR d'autres
  artistes (vérifié : le filtre n'affiche que les 5 remixes tiers).
- **Rapprochements branchés** (comptes tiers 8day Montréal) :
  - Montreal Calling →
    soundcloud.com/8day-montreal/mauditemachine-montrealcalling
  - Digital ep → écoute via la piste d'ouverture « Digital Worms
    Attack » (soundcloud.com/8day-montreal/maudite-machine-digital-worms),
    lien externe inchangé vers l'EP Bandcamp ; **année corrigée
    2023 → 2020** (date réelle de l'EP sur Bandcamp).
- **Restent grisés** (décision Mika) : Electrochimie - Pleasure Seeker
  (introuvable sur tout SoundCloud) et North River (n'existe qu'en
  continuous mix V.A.), plus les 3 placeholders AUTOPSYNTH.
- **Featured** : la sélection reste à 12 ; les 3 slots des placeholders
  Limbo passent à Abyss (ouverture), Limbos (title track) et Zenith —
  éditable dans le JSON comme le reste.
- **Tri** : année desc ; à année égale (2025) le LP jouable passe
  devant les AUTOPSYNTH grisés. La matrice ouvre désormais sur
  Abyss / Limbos / Zenith.

## Bilan de la matrice

38 pistes, **33 jouables** (22 mappées précédemment + 9 Limbos + 2
rapprochements), 5 grisées (3 AUTOPSYNTH, Electrochimie, North River).

## Vérifications faites

- Vue par défaut : 12 featured, ouvre sur les 3 Limbos jouables ;
  mode déplié : 38 lignes, les 9 Limbos dans l'ordre officiel de
  l'album ; grisées = exactement les 5 attendues.
- Digital ep : année 2020 affichée, play actif ; Montreal Calling :
  play actif.
- Filtre Remixes : 5 remixes tiers, la piste 9 « Emotional Remix » n'y
  figure pas.
- Play « Abyss » : barre sticky « Abyss / Limbos LP · 2025 », l'iframe
  widget charge le bon permalink (le son lui-même reste à confirmer
  d'un clic réel, même limite d'environnement que la session
  précédente).
- Build clean (V2App 34,12 kB / 8,59 kB gzip).

## Décisions prises et pourquoi

- **« Limbos LP », year 2025 — Bandcamp fait foi** (décision Mika).
  ⚠️ **INCOHÉRENCE À CORRIGER PLUS TARD** : le CV artistique et le
  press kit disent « Limbo 2024 » alors que l'album officiel est
  « Limbos », sorti le 16 octobre 2025 (le presskit v1 du site dit
  d'ailleurs « October 2025 · 9 tracks » dans la section album). À
  harmoniser dans ces documents (PDF press kit, CV, bios externes).
- **Featured Abyss / Limbos / Zenith** : ouverture, title track et
  closer original du LP ; choix éditable en une ligne de JSON si Mika
  préfère d'autres highlights.
- **Le lien externe des pistes Limbos pointe vers l'album Bandcamp**
  (pas la page racine) : c'est la page d'achat réelle du LP.

## Ce qui reste à faire / points en suspens

Côté Mika :
- Confirmer d'un clic la lecture SoundCloud en prod (toujours en
  attente depuis la session player).
- Corriger « Limbo 2024 » → « Limbos, 2025 » dans le press kit PDF et
  le CV artistique (voir décision ci-dessus).
- AUTOPSYNTH 001-003 : brancher quand les sorties VRSTL existeront.
- Points antérieurs : riders PDF, profil Bandsintown, ajustement
  featured éventuel.

## Commandes utiles ajoutées

Aucune.
