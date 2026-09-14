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
- **5 versions retenues**, de la plus récente à la plus ancienne :
  2026 (actuelle), 2025 (React orange), 2020 → 2022 (DJ and producer),
  2011 (El Gamiq, webzine), 2010 (Joomla 1.5, Le Musée du Rock'n'Roll).
- **2018 et 2024 retirées après coup** (retour de Mika : n'afficher que
  ce qui montre quelque chose). Mesure du taux de pixels de contenu :
  2024 tombait à **0,43 %** et 2018 à 2,78 %, contre 10 à 13 % pour les
  autres. Les captures alternatives de ces deux années, testées, sont
  pires encore (2018 : page entièrement blanche, 0,00 %). L'archive n'a
  simplement rien gardé de visible ces années-là.
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


## Correction (même jour) : des captures qui n'étaient pas ce site

Mika a signalé que les entrées 2010 et 2011 n'avaient rien à voir avec
lui. Vérification du HTML archivé : c'est exact.

- **2010** : un communiqué de presse du Musée du Rock'n'Roll du Québec,
  signé Patrice Caron, collé depuis Word.
- **2011** : un webzine avec les rubriques « Urbanalogue »,
  « WebMusique », « MusiqueBizness », « WebBusiness », « Old School ».

Le domaine mauditemachine.com hébergeait **un autre projet** avant
Mika. Mon erreur : j'ai supposé que toute capture du domaine était son
site, et j'ai écrit des descriptions qui romançaient un passé qui n'est
pas le sien (« époque collectif », « le site vit au rythme des events »).

Contrôle appliqué a posteriori sur chaque capture, en comptant les
signaux propres à son projet (SoundCloud, Bandcamp, VRSTL, producer,
indie dance, techno, mixtape) :

| Capture | Signaux | Verdict |
|---|---|---|
| 2010 | 0/8 | autre projet, retirée |
| 2011 | 0/8 | autre projet, retirée |
| 2018 | 0/8 | rien de probant, déjà retirée |
| 2020 | 5/8 | son site, conservée |
| 2025 | 3/8 | son site, conservée |
| 2026 | site actuel | conservée |

**Reste 3 versions : 2026, 2025, 2020.** La note de bas de page dit
maintenant que le domaine hébergeait un autre projet avant 2020, ce qui
explique le point de départ au lieu de le laisser paraître arbitraire.

**Leçon pour les prochaines fois** : une capture Wayback d'un domaine
ne prouve pas qu'elle appartient au propriétaire actuel. Vérifier le
contenu avant de l'attribuer, et ne jamais écrire de description
narrative à partir d'une image sans confirmer les faits dans le HTML.
