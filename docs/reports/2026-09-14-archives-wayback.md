# Rapport de session — Page Archives (musée du site)

Date : 2026-09-14
Mission : un menu pour voir les anciennes versions du site, en allant
chercher dans la Wayback Machine, avec liens et images des vieux designs.

## Ce qui a été fait

- **Exploration de l'archive** : l'API CDX d'archive.org donne **14
  captures distinctes** de mauditemachine.com, la plus ancienne datant
  de **mai 2010**. Analyse de chaque capture (titre, technologie) pour
  écarter les pages inexploitables : deux étaient un challenge
  Cloudflare (« One moment, please… ») et une page d'erreur Wayback,
  et les versions 2020 et 2022 sont strictement identiques (même
  empreinte MD5) donc fusionnées en une seule entrée.
- **Captures d'écran** : générées via l'API microlink (mshots de
  WordPress et thum.io renvoient 403 ou un GIF de chargement),
  converties en WebP 1000 px dans `public/images/archive/` — **175 Ko
  au total pour 7 images**. Elles sont stockées en local : la page ne
  dépend d'aucun service externe au chargement.
- **7 versions retenues**, de la plus récente à la plus ancienne :
  2026 (actuelle), 2025 (React orange), 2024 (press kit), 2020 → 2022
  (DJ and producer), 2018 (le logo pleine page), 2011 (El Gamiq,
  webzine), 2010 (Joomla 1.5, Le Musée du Rock'n'Roll).
- **[archive.json](../../src/v2/data/archive.json)** : données éditables
  (année, titre, note, techno, image, lien Wayback).
- **[ArchivePage.tsx](../../src/v2/pages/ArchivePage.tsx)** + CSS : page
  `/archives` dans la DA du site. Version actuelle en carte pleine
  largeur avec badge « en ligne », puis grille 2 colonnes ; année en
  pastille encre posée sur chaque capture, grain identique à la
  galerie, zoom au survol, clic vers la version navigable dans
  l'archive.
- **Menu** : entrée ARCHIVES ajoutée entre Press Kit et Contact (9
  entrées, délais d'animation étendus).
- **Sitemap** : `/archives` ajoutée (3 URLs).

## Décisions prises et pourquoi

- **Captures figées en local plutôt qu'iframes Wayback** : archive.org
  refuse l'affichage en iframe sur beaucoup de captures, et une page
  qui dépend d'un service tiers au chargement tombe avec lui.
- **Note honnête affichée sur la page** : plusieurs captures
  apparaissent sans mise en forme parce que la Wayback Machine a gardé
  le HTML mais pas les feuilles de style d'époque. C'est dit
  explicitement plutôt que de laisser croire à un bug.
- **2020 et 2022 fusionnées** : captures identiques, une seule entrée
  libellée « 2020 → 2022 ».

## Corrigé au passage

- Le menu pointait encore vers l'ancienne URL `/v2/radar` depuis la
  bascule : corrigé en `/radar`.
- Les deux premières images de la grille passent en chargement
  immédiat (le reste en lazy) : ce sont elles que le visiteur voit en
  arrivant.

## Ce qui reste à faire / points en suspens

- Mika : relire les textes de chaque époque (le JSON est éditable, une
  ligne par version) et dire si une version doit être ajoutée ou
  retirée. Les 7 autres captures disponibles dans l'archive sont
  listées dans le CDX si besoin.
- Points antérieurs inchangés (édition en ligne impossible par
  conception, riders PDF, profil Bandsintown).

## Commandes utiles ajoutées

Aucune. Les captures ont été générées une fois via microlink, elles
n'ont pas besoin d'être régénérées.
