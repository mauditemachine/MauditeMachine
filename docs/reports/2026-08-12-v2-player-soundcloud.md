# Rapport de session — Player /v2 : full tracks SoundCloud

Date : 2026-08-12
Mission : brancher le player sticky /v2 sur les tracks SoundCloud comme
le fait le site v1, après inspection du mécanisme v1 et décision
commune sur la question iframe.

## Inspection du player v1 (montrée avant de coder)

- **Mécanisme** ([src/utils/scWidget.ts](../../src/utils/scWidget.ts)) :
  UN iframe caché (2×2 px, opacity 0.01, jamais display:none sinon le
  widget refuse de démarrer), `allow="autoplay"`, chargé sur
  `w.soundcloud.com/player/?url=<permalink>`, piloté par la Widget API
  officielle (`w.soundcloud.com/player/api.js`, postMessage) :
  play/pause/seekTo/setVolume/skip/getSounds + events
  READY/PLAY/PAUSE/FINISH/ERROR/PLAY_PROGRESS. **Aucun client_id ni
  clé** : le widget résout le stream en interne, le site ne voit jamais
  l'URL audio. Subtilités v1 : la politique autoplay exige de recharger
  l'URL dans l'iframe PENDANT le geste utilisateur ; FINISH émet aussi
  un PAUSE à ignorer pendant l'enchaînement.
- **Alternative testée par curl** (pour trancher en connaissance de
  cause) : api-v2.soundcloud.com — client_id scrapé des assets JS,
  /resolve, transcoding progressive + track_authorization → MP3 signé
  CloudFront, CORS `*`, jouable dans un `<audio>` nu. Fonctionnelle
  AUJOURD'HUI mais non-officielle : client_id impossible à scraper au
  runtime côté navigateur (CORS), donc figé dans le bundle et périmant
  au rythme des rotations SoundCloud (player mort jusqu'au
  redéploiement), TOS grises, écoutes non comptées sur le profil.
- **Décision Mika** : Widget API avec iframe caché (mécanisme v1). La
  règle zéro-iframe était esthétique ; un iframe de pilotage invisible
  n'affecte pas l'esthétique, et c'est le seul chemin officiel vers le
  full-track — bonus : les écoutes comptent sur le profil SoundCloud.

## Ce qui a été fait

- **[discography.json](../../src/v2/data/discography.json)** : le champ
  `audio` (MP3 locaux) devient `soundcloudUrl` (permalinks publics).
  Préremplissage depuis le profil (62 tracks listées) : **22 des 26
  titres réels mappés** — Kouklikou, Sync Button, Anarchic, Autopsynth,
  Back On Track, Nocturne, Coagule, Richie, Tati Cardi, Drama Queen,
  Discowriders, Cupertino, TimeOut, So Hard, Fuck That, Strange Effect,
  Origan + les 5 remixes (Alan Parsons, Robots, Dangerous Drive, Big
  Babou, DVS1 & Plaid). **16 entrées sans URL** (`soundcloudUrl: ""`) :
  Digital ep, Montreal Calling, Electrochimie Pleasure Seeker, North
  River (introuvables sur le profil) + les 12 placeholders
  Limbo/AUTOPSYNTH.
- **[AudioPlayerContext.tsx](../../src/v2/context/AudioPlayerContext.tsx)**
  refactorisé en UNE barre / DEUX moteurs (l'architecture v1) :
  `soundcloudUrl` → moteur widget (module scWidget.ts v1 réutilisé tel
  quel : setScHandlers/scPlay/scPause/scResume/scSeekRatio) ; `audio`
  (previews iTunes du Radar) → élément HTML5 natif. Un seul joue à la
  fois, chaque event est filtré par moteur courant. next/prev/ended
  SAUTENT les pistes injouables (garde anti-boucle un tour complet). Au
  unmount : pause + handlers détachés (l'iframe singleton survit, comme
  en v1).
- **[Discography.tsx](../../src/v2/components/Discography.tsx)** : play
  désactivé proprement (disabled, opacity 0.28, pas de hover, aria
  « écoute bientôt disponible », title « Coming soon ») pour les pistes
  sans URL ; le lien plateforme reste actif. Note : « Streaming via
  SoundCloud. Full releases on Bandcamp. »
- **[StickyPlayer.tsx](../../src/v2/components/StickyPlayer.tsx)** :
  AUCUN changement — l'UI, la progress bar, prev/next, le seek
  souris/clavier et l'enchaînement passent par le contexte, qui route
  vers le bon moteur.
- **public/audio/placeholder-{1,2,3}.mp3 supprimés** (git rm, dossier
  vide).

## Vérifications faites

- **Câblage SoundCloud de bout en bout** (dev, DOM) : clic play
  Kouklikou → script api.js chargé, SC.Widget global présent, iframe
  créée avec le bon permalink, barre sticky montée, ligne marquée en
  lecture, moteur `sc` actif.
- **Limite d'environnement, dite honnêtement** : le panneau de test
  n'acceptait plus de vrai clic (viewport 0×0) ; or l'émission PLAY du
  widget exige un geste utilisateur réel (politique autoplay,
  documentée dans scWidget). La chaîne complète clic→son est la
  mécanique v1 éprouvée en prod avec le MÊME module ; à confirmer d'un
  clic sur https://mauditemachine.com/v2 (si un permalink est erroné,
  la ligne restera silencieuse : dis-le-moi, correction en une ligne de
  JSON).
- **Régression Radar écartée** (moteur audio) : preview iTunes
  « Club Scenes » jouée réellement (progression 64 % → 73 %, bouton en
  Pause) après le refactor.
- **Boutons désactivés** : 6/12 grisés en vue par défaut (AUTOPSYNTH +
  Limbo), 6 actifs (remixes + originals mappés), capture mobile faite.
- **Mobile 375 px** : zéro débordement (scrollWidth = 375).
- **Build** : clean, zéro warning (V2App 33,4 kB / 8,45 kB gzip).

## Décisions prises et pourquoi

- **Widget API iframe caché** : décision commune (voir inspection). Le
  module v1 est réutilisé TEL QUEL plutôt que dupliqué : singleton
  éprouvé, et les deux players (v1/v2) ne cohabitent jamais dans le
  même arbre React.
- **Deux moteurs conservés dans le contexte v2** : le Radar v2 joue des
  previews iTunes (URLs directes) ; retirer le moteur HTML5 l'aurait
  cassé. C'est l'architecture d'origine du player v1.
- **Pistes injouables sautées dans la file** : sans ça, next/ended se
  bloquaient sur les placeholders intercalés dans la liste filtrée.
- **`soundcloudUrl: ""` plutôt que champ absent** pour les 16 sans
  correspondance : le champ visible dans le JSON invite à le remplir.
- **Pas de mapping hasardeux des placeholders** : le profil contient
  Zenith, Simetra, Muld, Nortkele, Reaper, Cephal, Abyss, Limbos,
  Voodoo, Crush on you, Music Machine, Passport, Ruckus, Bassheiser,
  Plastic Hanger, Calcium, Cardioid, DarkSide, Chimie Electrique (+
  Emotional Remix), Paul Ritch Walk The Line (MM Remix), Number in
  between… — probablement les vrais titres du Limbo LP et d'autres
  crédits. J'attends ta liste finale pour les brancher.

## Ce qui reste à faire / points en suspens

Côté Mika :
- **Confirmer d'un clic la lecture SoundCloud en prod** (limite
  d'environnement ci-dessus).
- Fournir la liste finale des crédits (les 12 placeholders + les 4
  réels sans correspondance pourront être mappés sur les tracks du
  profil listées ci-dessus, ou rester grisés).
- Points antérieurs inchangés : riders PDF, profil Bandsintown,
  sélection featured.

Côté code :
- Si un jour la playlist « sets/tracks-1 » doit alimenter /v2 (file
  d'un set complet comme la pilule v1), scPlaySetTrack/scGetSetTracks
  sont déjà dans le module partagé.

## Commandes utiles ajoutées

Aucune. Le mapping profil → JSON a été fait par script Node ponctuel
(api-v2 utilisée en OUTIL local uniquement, pas dans le site).
