# Rapport de session — Rebrand Larsseit / crème / #191919

Date : 2026-08-31
Mission : tout le site en Larsseit, fond crème, texte #191919.

## Ce qui a été fait

- **Larsseit auto-hébergée** : les OTF licenciés trouvés dans
  ~/Library/Fonts, convertis en woff2 (132 Ko pour 3 graisses) dans
  [public/fonts/larsseit/](../../public/fonts/larsseit/). Pas de
  Regular droit dans la licence : Light couvre 300-400, Medium 500-600,
  Bold 700+ (@font-face à plages dans v2.css). Les @fontsource
  Space Mono / Inter sont retirés du bundle.
- **Palette** ([v2.css](../../src/v2/v2.css)) : tokens inversés —
  fond #F6F1E7 (crème), encre #191919, dim/faint/line en alpha d'encre.
  Toutes les valeurs codées en dur converties : hovers des listes,
  player (verre crème rgba(246,241,231,.88), tête de lecture encre),
  boutons, chips, recherche radar, fallback reduced-motion du hero.
  `html:has(body.v2-active)` en !important : l'overscroll Safari est
  crème (le CSS v1 pose html #000 !important dans son bloc mobile, la
  spécificité de :has l'emporte à importance égale).
- **Typo** : --v2-display/--v2-sans/--v2-mono pointent Larsseit.
  Titres display en Bold 700, tracking -0.01/-0.015em (les 5px de
  Robot Radicals n'avaient plus de sens), corps en Light 400 (14.5px+),
  micro-corps utilitaires (labels, boutons, titres de lignes) forcés en
  Medium 500 (Light illisible en 10-13px), tabular-nums sur les
  chiffres défilants (temps du player, durées, dates).
- **Cas particuliers** : logo hero passé de mix-blend difference à
  `filter: brightness(0)` (le blend ne traversait plus le stacking
  context du canvas masqué — constaté à l'écran, logo resté blanc) ;
  burger sans blend (l'inversion le rendait illisible sur crème) ;
  curseur custom GARDÉ en blend difference (blanc inversé = sombre sur
  crème, clair sur photos : exactement son rôle) ; légendes photos et
  badge SOLD OUT en crème EN DUR (toujours posés sur voile sombre) ;
  lightbox restée sombre (les photos d'abord) ; rideau d'entrée en
  #191919 (contraste à l'arrivée) ; canvas génératif : fond crème,
  ondes encre atténuées (alpha ×0.75)
  ([GenerativeBg.tsx](../../src/v2/components/GenerativeBg.tsx)).
- **theme-color** index.html → #f6f1e7 (barre navigateur mobile).
- **Périmètre** : site principal (home + /radar). La v1 archivée reste
  noire (c'est l'archive), l'admin garde son thème clair propre.
- **CLAUDE.md** : le piège documenté « fond noir uni » est explicitement
  restreint à /v1 pour qu'une future session ne « corrige » pas le
  crème.

## Vérifications faites

- Desktop : hero (logo encre sur ondes crème), matrice (MUSIC 96px
  Larsseit Bold à cheval, filtres, plays grisés), menu overlay 8
  entrées, captures faites.
- Fonts : document.fonts.check confirme Larsseit chargée en 400 et 700.
- html/body/overscroll : rgb(246,241,231) partout (probe calculé).
- Mobile 375 : zéro débordement, Larsseit active, capture hero.
- /radar : hérite des tokens (fond crème, Radar en Larsseit, 12 lignes).
- Build clean : 9,96 kB gzip JS (+0,1), fonts 132 Ko en plus du budget
  (woff2, font-display swap).
- **Règle no-audio respectée** : aucun play déclenché pendant les
  tests ; la barre du player est validée par ses règles CSS (verre
  crème), pas en la montant. À vérifier d'un clic par Mika.

## Décisions prises et pourquoi

- **Robot Radicals abandonnée pour les titres** : la demande est
  « tout en Larsseit » — le logo SVG reste le seul porteur du lettrage
  Robot Radicals (c'est un tracé, pas du texte).
- **Licence Larsseit** : fichiers convertis depuis la licence desktop
  de Mika. L'usage webfont auto-hébergé dépend des termes de sa
  licence Type Dynamic — à vérifier de son côté, rien de bloquant
  techniquement.
- **Lightbox sombre conservée** : standard photo même sur site clair.

## Ce qui reste à faire / points en suspens

- Mika : vérifier d'un clic le player sur le crème (barre verre clair,
  VU encre) et l'ambiance générale ; ajuster la nuance de crème si
  souhaité (une seule variable : --v2-bg).
- Mika : confirmer que sa licence Larsseit couvre l'auto-hébergement
  web (sinon négocier l'extension, le site fonctionne en attendant).
- Points antérieurs inchangés (tests iOS/enchaînement toujours en
  placeholders, riders PDF, Bandsintown, AUTOPSYNTH, admin étapes 4-5,
  nettoyage images 176 Mo).

## Commandes utiles ajoutées

Aucune. Conversion faite avec `npx ttf2woff2 < in.otf > out.woff2`.
