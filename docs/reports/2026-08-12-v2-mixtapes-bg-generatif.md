# Rapport de session — /v2 : matrice réduite, Mixtapes, background génératif

Date : 2026-08-12 (2e session du jour sur /v2)
Mission : trois modifications sur la refonte /v2 : discographie réduite à
une sélection, nouvel onglet Mixtapes, remplacement de la vidéo méduses
par un background génératif code.

## Ce qui a été fait

- **Matrice réduite (12 par défaut)** : champ `featured` ajouté aux 38
  entrées de [discography.json](../../src/v2/data/discography.json)
  (true sur 12 : AUTOPSYNTH 001-003, Limbo I/V/IX, remixes Laurent
  Garnier / Alan Parsons / DVS1+Plaid, Tati Cardi Ep, Kouklikou, Drama
  Queen). Éditable à la main pour ajuster la sélection.
  [Discography.tsx](../../src/v2/components/Discography.tsx) : le filtre
  s'applique AVANT la sélection (remixes replié = 3 featured, déplié =
  5), bouton « Show all (N) / Show less » dont le compte suit le filtre
  actif, compteur « 12 / 38 tracks », les lignes dépliées montent en
  fade-up discret (`.v2-row-in`, coupé sous prefers-reduced-motion).
- **Section Mixtapes** ([Mixtapes.tsx](../../src/v2/components/Mixtapes.tsx))
  entre Music et Live, entrée nav + ancre `#mixtapes`. Liste compacte
  cohérente avec la matrice : artwork 56px (ou pastille numérotée pour
  les placeholders), « MX NN », titre, année, durée, icône externe.
  Chaque ligne est un `<a>` vers SoundCloud en nouvel onglet, AUCUN
  iframe. 6 affichées par défaut (featured), Show all pour le reste,
  mention « Full sets on SoundCloud ↗ » vers le profil. Données :
  [mixtapes.json](../../src/v2/data/mixtapes.json) : Mixtape 39 (Groove
  & Bass 2026) et Mixtape 38 avec permalinks/durées/artworks RÉELS tirés
  du profil SoundCloud, Mixtape 37 avec l'artwork local existant, 4
  placeholders. Artworks convertis en WebP 500px locaux
  (public/images/mixtapes/), pas de hotlink sndcdn.
- **Background hero génératif**
  ([GenerativeBg.tsx](../../src/v2/components/GenerativeBg.tsx)) : la
  vidéo méduses est remplacée par un canvas 2D pur (zéro lib). Direction
  exécutée : ondes horizontales fines qui pulsent lentement, blanc cassé
  très discret sur #0A0A0A, bande de focus qui dérive verticalement
  (~75 s) pour l'effet de balayage hypnotique. 24 lignes desktop / 13
  mobile, DPR cap 2 / 1.5, delta temporel borné (pas de saut au retour
  d'onglet), pause sur visibilitychange, première frame dessinée en
  synchrone, re-mesure au réveil + listener window resize.
  prefers-reduced-motion : dégradé radial statique sombre, pas de
  canvas. Le logo en mix-blend difference reste blanc pur sur le noir.
  **L'ancien fond vidéo est conservé derrière `USE_VIDEO = false` dans
  [Hero.tsx](../../src/v2/components/Hero.tsx)** : repasser à true pour
  rebasculer si Mika fournit une nouvelle vidéo (le pattern muted iOS y
  est toujours). L'overlay noir 50 % ne s'applique qu'à la vidéo.

## Décisions prises et pourquoi

- **Sélection featured** : 3 AUTOPSYNTH (vitrine VRSTL), Limbo I/V/IX
  (début/milieu/fin du LP), les 3 remixes aux plus gros noms, et 3
  originals forts (Tati Cardi = morceau signature, Kouklikou = dernier
  Bandcamp, Drama Queen). Mika ajuste en éditant le JSON.
- **Mixtape 38 en réel plutôt qu'en placeholder** : ses métadonnées
  étaient récupérables depuis le profil SoundCloud public (hydration
  JSON des pages tracks), autant livrer du vrai. Les durées/permalinks
  des 39 et 38 sont exacts (1:29:33 et 1:16:07).
- **Direction générative « ondes » plutôt que particules ou formes** :
  l'esthétique signal/oscilloscope colle au nom Maudite Machine et au
  brief hypnotique/minimal ; une seule direction exécutée proprement
  comme demandé. Accent unique blanc cassé (pas de teinte froide
  ajoutée) pour rester monochrome.
- **Artworks en local, pas en hotlink** : i1.sndcdn.com peut changer ou
  bloquer ; 3 WebP 500px (26-66 KB) versionnés, cohérents avec le
  workflow images du repo.
- **Robustesse onglet caché** (suite des découvertes de la session
  précédente) : les callbacks ResizeObserver ne tirent pas sans cycle de
  rendu ; le canvas re-mesure donc au visibilitychange et sur window
  resize, et retombe sur window.innerWidth si le rect est encore à 0.
- **Grayscale 35 % au repos sur les artworks mixtapes** : unifié avec la
  galerie ; les pochettes colorées (39, 37) restent dans la DA
  monochrome et se révèlent au hover.

## Ce qui reste à faire / points en suspens

Côté Mika :
- ~~Remplacer les mixtapes placeholder~~ FAIT en fin de session : Mika a
  fourni les permalinks 37/36/35, métadonnées et artworks extraits du
  profil SoundCloud (37 : 2:01:23 2025, 36 : 1:56:57 2024, #035 :
  1:30:22 2024), 39/38 revérifiées conformes. La section affiche 5
  mixtapes réelles, plus aucun placeholder, et le bouton Show all
  disparaît de lui-même (aucune entrée masquée).
- Ajuster la sélection featured de discography.json si souhaité.
- Toujours en attente (session précédente) : tech riders PDF EN/FR dans
  public/, profil Bandsintown, crédits finaux discographie, vrais MP3.
- Si une nouvelle vidéo hero arrive un jour : USE_VIDEO = true dans
  Hero.tsx et déposer les fichiers dans public/videos/.

Côté code :
- Rien de bloquant. Lighthouse mobile réel toujours à mesurer en prod.

## Commandes utiles ajoutées

Aucun nouveau script npm. À savoir :
- Métadonnées SoundCloud extraites par curl de la page track +
  `window.__sc_hydration` (hydratable "sound") : title, duration,
  artwork_url, permalink_url.
- Artworks : `magick <src> -resize 500x500\> -quality 78 <dest>.webp`.
