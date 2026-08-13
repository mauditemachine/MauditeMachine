# Rapport de session — /v2 : hiérarchie typo, contacts booking, page Radar

Date : 2026-08-12
Mission en trois volets : 1) Robot Radicals réservée aux titres de
section, texte secondaire en SF Pro Display/Inter ; 2) deux contacts
booking distincts (international / Canada-USA) ; 3) page dédiée
/v2/radar reprenant le Radar v1 dans la DA v2.

## Inspection du Radar v1 (demandée avant de coder)

- **Page** : [src/pages/RadarPage.tsx](../../src/pages/RadarPage.tsx)
  (v3.2, ~30 kB) montée sur /mm-admin/radar derrière AdminCurtain, DANS
  le Layout v1 (elle dépend du PlayerProvider global). L'ancienne URL
  publique /radar redirige vers la home depuis la migration admin.
- **Données** : [public/releases.json](../../public/releases.json)
  (12 releases éditées via l'admin local : artist, title, label,
  releaseDate, genre, format, link plateforme, cover locale,
  publishedRadar) et [public/following.json](../../public/following.json)
  (515 artistes, 35 labels, topLabels).
- **Fonctionnement** : flux pleine largeur scindé Nouveautés (fenêtre
  glissante 60 jours) / Archives ; clic artiste ou label → explorateur
  iTunes en split 2 colonnes (recherche 2 temps musicArtist→lookup
  albums récents, chips pour les noms composés, regroupement par
  artiste pour les labels) ; lecture via le player global v1 à DEUX
  moteurs : previews iTunes 30 s en HTML5 et full tracks SoundCloud via
  un IFRAME widget caché ; résolution d'extraits
  resolveTrackPreviewSmart (4 stratégies + compilations V/A) ;
  fallbackLinks Beatport/SoundCloud/Spotify ; jamais d'onglet ouvert
  par un play.
- **Réutilisable tel quel** : [src/utils/itunes.ts](../../src/utils/itunes.ts)
  (aucune dépendance UI). Le moteur SoundCloud (scWidget.ts) est un
  iframe : exclu de la v2 par la règle zéro iframe.

## Ce qui a été fait

### 1. Hiérarchie typographique
- Nouvelle stack dans [v2.css](../../src/v2/v2.css) :
  `--v2-sans: "SF Pro Display", -apple-system, BlinkMacSystemFont,
  "Inter", sans-serif` + @fontsource/inter (400/500/600) installé et
  importé pour les non-Mac. À noter : les woff2 auto-hébergés du repo
  sont SF Pro ROUNDED, pas Display ; sur Apple c'est -apple-system qui
  sert San Francisco, Inter couvre le reste.
- Utilitaires `.v2-subtitle` (sans 600, tracking 0.02em) et `.v2-body`
  (400).
- « Next dates coming soon » ([LiveGigs.tsx](../../src/v2/components/LiveGigs.tsx))
  et la pastille numéro des mixtapes sans artwork passent en sans ;
  plus AUCUN usage de `.v2-display` dans les composants. Robot
  Radicals ne subsiste que sur `.v2-section-title` et les ancres du
  menu overlay (typo display du menu plein écran, assumée — dis-moi si
  tu veux aussi les passer en sans).
- Space Mono conservée pour données/labels/meta lines.

### 2. Contacts booking séparés
- Module partagé [contacts.ts](../../src/v2/data/contacts.ts) :
  International booking · Diane · vrstlrecords@gmail.com et
  Canada / USA booking · mauditemachine@gmail.com, labels bilingues.
- Section Contact ([Footer.tsx](../../src/v2/components/Footer.tsx)) :
  deux blocs en grille (une colonne en mobile), emails mailto en sans
  600.
- EPK ([EPK.tsx](../../src/v2/components/EPK.tsx)) : les deux contacts
  sous les téléchargements, labels qui suivent le toggle (FR : Booking
  international / Booking Canada - États-Unis).
- Plus aucune occurrence de booking@mauditemachine.com sur /v2 : le CTA
  du fallback Live pointe désormais vers #contact (les deux adresses y
  vivent) plutôt que de choisir arbitrairement un des deux emails.

### 3. Page /v2/radar
- Nouvelle route dédiée hors Layout ([App.tsx](../../src/App.tsx)),
  lazy, chunk 11,6 kB (3,4 kB gzip). Chrome de page factorisé en hook
  [useV2Chrome.ts](../../src/v2/hooks/useV2Chrome.ts) (body class,
  noindex, description, titre — partagé avec la landing).
- [src/v2/pages/RadarPage.tsx](../../src/v2/pages/RadarPage.tsx) : flux
  Nouveautés (60 jours) / Archives depuis releases.json (respecte
  publishedRadar), lignes grid DA v2 (cover 44 px, artiste sans 500
  cliquable, titre mono, label cliquable, date, play, lien plateforme).
- Lecture : previews iTunes 30 s résolues à la demande
  (resolveTrackPreviewSmart du moteur v1), cache par piste, spinner sur
  le bouton pendant la résolution, échec → mention « No preview
  found » sur la ligne, le lien plateforme reste le seul chemin
  sortant. Player = AudioPlayerContext v2 (HTML5 pur) + barre sticky,
  ZÉRO iframe : les full tracks SoundCloud du v1 restent un outil
  admin, différence assumée et documentée.
- Explorateur : clic artiste/label ou recherche (input + datalist des
  550 suivis, Enter ou bouton) → dernières sorties iTunes avec artwork,
  play, lien store, chips « Also: » pour les noms composés, repli
  fallbackLinks (Beatport/SoundCloud/Spotify) quand iTunes ne connaît
  pas le nom.
- Annuaire : panneau Following (35 labels + 515 artistes en chips,
  zone scrollable) → chaque chip lance l'explorateur.
- Nav landing ([Nav.tsx](../../src/v2/components/Nav.tsx)) : bloc
  « Pages » séparé (border-top + label mono) sous les ancres, lien
  « Radar → » en display réduit et opacité moindre : la distinction
  ancres / pages demandée. Depuis le radar : « ← Back to site ».
- Cursor custom actif, reveals GSAP (useReveals) sur les têtes de
  section, scroll remis à 0 au mount (le router SPA conserve sinon la
  position de la landing).

## Vérifications faites

- **Radar desktop** : DA complète capturée ; explorateur testé en réel
  (chip « The Magic Ray » → 2 releases iTunes) ; play d'un item
  explorateur ET d'une release du flux (« Club Scenes » → barre
  « Surefire · 2026 », ligne marquée en lecture) — l'API iTunes passe
  depuis l'environnement de test, résolution + lecture réelles
  confirmées.
- **Navigation** : menu overlay → Radar (SPA, scroll top, overflow
  restauré), retour /v2.
- **Landing** : contacts Contact + EPK (labels EN puis FR via toggle
  testés), sous-titre Live en SF Pro 600, CTA → #contact, plus aucun
  booking@mauditemachine.com dans le DOM.
- **Mobile 375 px** : radar sans débordement (scrollWidth = 375,
  colonnes label/date masquées), contacts en une colonne, captures
  faites.
- **Build** : clean, zéro warning.

## Décisions prises et pourquoi

- **Menu overlay conservé en Robot Radicals** : la consigne dit
  « titres de section uniquement » mais vise des cas de texte
  secondaire ; les ancres énormes du menu plein écran sont la typo
  display identitaire du site. À inverser en un edit si tu préfères.
- **CTA Live → #contact** au lieu d'un mailto : avec deux adresses par
  territoire, choisir un email dans un bouton générique « Book Maudite
  Machine » serait arbitraire ; la section Contact présente les deux.
- **Full tracks SoundCloud absents du radar v2** : le moteur v1 est un
  iframe widget, interdit par la règle zéro iframe de la refonte. Les
  previews 30 s couvrent l'usage découverte ; l'outil complet reste sur
  /mm-admin/radar.
- **Imports fonts + v2.css dans RadarPage aussi** : en accès direct
  /v2/radar (sans passer par la landing), le CSS n'était jamais chargé
  (page brute constatée puis corrigée) ; Vite dédupe les chunks
  partagés.

## Ce qui reste à faire / points en suspens

- Si tu veux les full tracks SoundCloud sur le radar public un jour, il
  faudra soit assouplir la règle zéro iframe, soit passer par l'API
  oEmbed/streams (contraintes de clés).
- L'autocomplete datalist est natif (rendu variable selon navigateurs) ;
  un autocomplete custom stylé DA est possible si tu veux plus de
  contrôle.
- Points des sessions précédentes inchangés (riders PDF, profil
  Bandsintown, crédits discographie, vrais MP3, sélection featured).

## Commandes utiles ajoutées

Aucune. Dépendance ajoutée : @fontsource/inter.
