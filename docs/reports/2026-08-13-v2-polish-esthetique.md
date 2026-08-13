# Rapport de session — Polish esthétique /v2 (2 vagues + corrections menu)

Dates : 2026-08-12 → 2026-08-13
Mission : monter le niveau de finition de /v2. Revue critique honnête
d'abord (validée « franche et juste »), puis huit améliorations en deux
vagues choisies par Mika, plus trois corrections (doublon galerie,
Radar dans le menu principal, EPK → Press Kit).

## Revue critique (résumé de ce qui a été diagnostiqué)

- Rythme métronomique : toutes les sections au même gabarit, mêmes
  reveals, aucune rupture d'échelle après le hero.
- Survols morts : seul feedback un fond blanc 4,5 % identique partout.
- Galerie : photo de set quasi invisible sous le grayscale, hover
  cliché portfolio, et un DOUBLON (même shot Cirque de Boudoir en n&b
  et en couleur).
- EPK : bug de cascade CSS (contacts en 2 colonnes serrées, email
  cassé « gmail.co / m »), bio 8 lignes en mono fatigante.
- Player : élément le plus présent, le moins signé (progression 4px
  invisible, rien ne vit en lecture).
- Hero : couture sèche avec la suite, pas d'entrée de page, hint
  SCROLL persistant.

## Vague 1 (items 0, 1, 2, 3, 5)

- **Fixes** : cascade contacts EPK (double classe), overflow-wrap
  anywhere sur les emails, hint SCROLL effacé au premier scroll.
- **Player signature** : apparition slide-up, progression 5 px avec
  tête lumineuse (zone 9 px au survol pour le scrub), VU-mètre 4
  barres CSS (pulse en lecture, gel en pause, statique en
  reduced-motion), titre en sans 600.
- **Survols vivants** : glissement 7 px + flèche → révélée dans la
  gouttière sur les 4 listes (matrice, mixtapes, radar, gigs),
  scale(0.94) au clic sur tous les boutons, soulignements animés
  (socials du menu, liens footer). Pointer fine uniquement.
- **Rupture brutaliste** : titres de section clamp(44px, 8vw, 96px) À
  CHEVAL sur la ligne de section (mesuré : 38 px au-dessus, 75
  en-dessous), numérotation mono 01-06, header Radar et sous-têtes
  exclus. Validé « parfait » par Mika.
- **Bio EPK en sans** 17 px / 1.7.

## Vague 2 (items 4, 6, 7, 8)

- **Images underground** : le grayscale→couleur (qui éteignait les
  photos sombres) remplacé par contraste relevé + légère désaturation
  (hover : saturation pleine + micro-zoom), grain photographique SVG
  statique (data-URI, zéro coût), légende mono révélée au survol sur
  dégradé bas (visible en continu sur tactile), lightbox avec
  fade + scale d'ouverture (off en reduced-motion).
- **Couture hero→page** : le canvas génératif (et le fallback
  reduced-motion) fond vers le noir en bas via un masque dégradé, plus
  de coupure nette sur la bordure.
- **Entrée de page** : rideau noir qui se lève en 0,65 s à la première
  arrivée de la session (sessionStorage), jamais en reduced-motion ni
  onglet caché.
- **Reveals différenciés** : titres en glissement latéral (x:-30),
  labels en fondu décalé, galerie en damier aléatoire avec micro-scale,
  listes inchangées. Fini l'uniformité mécanique.
- **Geste final Contact** : les deux adresses booking à l'échelle
  display (clamp 24→54 px), empilées pleine largeur — la page se
  termine sur une rupture, pas en fondu.

## Corrections menu et galerie (demandes du GO vague 2)

- **Doublon galerie supprimé** : presskit-hero.webp était le même shot
  Cirque de Boudoir que MauditeMachine-1.webp en n&b (identifié par
  montage comparatif). Version couleur conservée, passée en tête de
  galerie avec la légende « Cirque de Boudoir ». Aucun autre doublon
  (4 photos restantes toutes distinctes). La galerie passe à 5 photos.
- **Radar au niveau principal du menu** : entrée normale, même style
  que les ancres, placée juste avant Press Kit (ordre : Music ·
  Mixtapes · Live · Gallery · Radar · Press Kit · Contact — l'ordre
  réel des sections, Radar juste avant Press Kit comme demandé). Le
  bloc « Pages » séparé est supprimé (JSX + CSS). Radar reste une
  page dédiée, seul son traitement dans le menu change.
- **EPK → Press Kit partout** : menu et titre de section (05 PRESS
  KIT). L'ancre technique #epk est conservée (invisible, évite de
  casser les liens existants). Le titre wrappe proprement sur deux
  lignes en mobile 44 px.

## Vérifications faites

- Captures : menu ouvert desktop ET mobile 375 (les 7 entrées au même
  niveau), matrice avec MUSIC 96 px à cheval + player en lecture
  réelle (VU actif), jonction MIXTAPES/LIVE, galerie couleur, CONTACT
  final avec emails géants, mobile 375 de la matrice.
- DOM : géométrie du chevauchement, 5/5 vignettes visibles et
  chargées, légendes présentes, masque dégradé calculé sur le canvas,
  navigation menu → /v2/radar (path, titre, scroll 0, overflow
  restauré), zéro débordement horizontal mobile sur toutes les pages.
- Lecture SoundCloud réelle re-confirmée pendant les tests (Abyss,
  progression + VU).
- Build clean. Chunk : 8,59 (avant vague 1) → 8,67 (vague 1) → 8,85 kB
  gzip (vague 2) : +3 % total, très loin du plafond fixé (ne pas
  doubler 55 kB). 60 fps : uniquement transform/opacity + un grain
  statique rasterisé une fois.

## Décisions prises et pourquoi

- **Rideau d'entrée une fois par session** : à chaque navigation
  interne il serait agaçant ; sessionStorage le limite à l'arrivée.
- **Grain en SVG data-URI statique** plutôt qu'animé : l'animation de
  grain coûte cher en compositing pour un gain faible ; le grain fixe
  donne la texture sans toucher au budget 60 fps.
- **Légendes visibles en continu sur tactile** : pas de hover sur
  iPad/mobile, une légende cachée y serait inaccessible.
- **Ancre #epk conservée** malgré le renommage : elle est invisible
  pour l'utilisateur et le renommage d'id casserait les liens/CTAs
  existants pour zéro gain visible.
- **Artefacts du panneau de test documentés** : le pane garde l'onglet
  en visibilityState hidden (rideau et reveals sautés par design dans
  ce cas — comportement onglet en arrière-plan), et certaines zones ne
  sont pas rasterisées sur les captures (trous noirs) alors que le DOM
  confirme 5/5 vignettes visibles. Vérité DOM systématiquement croisée.

## Ce qui reste à faire / points en suspens

- Regard final de Mika sur la vague 2 en prod (grain, légendes,
  rideau, reveals, contact géant) : tout est ajustable finement
  (opacité du grain, tailles, timings).
- Points antérieurs inchangés : riders PDF EN/FR, profil Bandsintown,
  brancher AUTOPSYNTH quand les sorties existeront, corriger « Limbo
  2024 » → « Limbos 2025 » dans le press kit PDF et le CV, nettoyage
  des 176 Mo de public/images (mission séparée), étapes 3-5 du panneau
  admin.

## Commandes utiles ajoutées

Aucune.
