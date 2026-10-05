# 2026-10-05 : PITCH des platines, formes d'onde WARM, EQ en dB, curseur, LOOP > SMPL, MM-SMPL façon Tonverk

Mika :
« Le pitch dans les DECK, je voudrais pouvoir le gérer finement. Les formes
d'onde plus chaudes, jaune et orange, en clair et en sombre. Dans la vue par
défaut je ne veux pas bouger la machine en 3D, mais au survol j'ai la main : je
veux le curseur normal, et toujours pouvoir bouger en 3D en dehors de la
machine. Les EQ du MIXER : le 0, le milieu, à 0 dB. Comment exporter une loop
d'un DECK dans le MM-SMPL ? Le PITCH ne fonctionne pas sur DECK B et C. Arrange
le MM-SMPL : un petit Elektron Tonverk à mes couleurs. Un bouton Exporter sur
le MIXER vers SMPL, et là j'édite mon sample. »

## 1. Ce qui a été fait

- PITCH de la dernière platine (dj/Twins.tsx, dj/dj.css) : la zone ADD / REMOVE DECK du bord droit recouvrait son fader ; elle ne déborde plus sur la platine et ne prend le pointeur que sur ses deux touches.
- PITCH fin :
  - dj/gestures.ts : un vernier, s'écarter du fader sur le côté rend le geste plus fin ;
  - dj/actions.ts : le pitch au centième de pour cent ;
  - dj/screens.ts : l'écran suit au centième (il restait figé au pour cent), BPM au centième.
- EQ du MIXER (dj/gestures.ts, dj/rig.ts, dj/MixDock.tsx, dj/Twins.tsx, ui/KnobPanel.tsx) :
  - valeurs en dB, 0 DB au milieu ;
  - un cran au centre en tournant ;
  - l'écran de la table dit l'EQ tourné.
- Curseur et vue (scene/orbit.ts, scene/renderer.ts, ui/Hotspots.tsx) : à la souris, la machine qu'on utilise ne fait plus tourner la vue, curseur normal sur elle ; depuis le fond, la main et la rotation.
- Formes d'onde WARM (dj/state.ts, dj/waveform.ts, dj/keys.ts) : orange profond, or, jaune pâle ; l'affichage de départ. 3BAND, RGB, MONO restent.
- LOOP > SMPL :
  - dj/layout.ts, dj/theme.ts, dj/silk.ts : une touche dans l'en-tête du mixer ;
  - dj/actions.ts, dj/gestures.ts : la boucle part dans le MM-SMPL, la vue y va ;
  - dj/rig.ts : la touche s'allume dès qu'une platine boucle ;
  - dj/keys.ts : touche T ; dj/Twins.tsx : jumeau ;
  - dj/MixDock.tsx, v4.css : la même touche au téléphone, onglet MASTER ;
  - state/smplload.ts, smpl/actions.ts : GRAB sur les quatre platines.
- MM-SMPL façon Tonverk :
  - smpl/theme.ts, smpl/rig.ts, dj/body.ts : corps large et peu profond ; écran en haut à gauche, douze encodeurs en trois rangées nommées en orange, onze touches de fonction (PLAY, STOP compris), seize trigs en ligne par groupes de quatre ;
  - smpl/screen.ts : forme d'onde en or ;
  - smpl/gestures.ts, smpl/keys.ts, smpl/Twins.tsx, smpl/Dock.tsx : PLAY et STOP en touches, trigs dans l'ordre de lecture au téléphone ;
  - scene/renderer.ts : cadrage, vignette.
- docs/v4/spec.md : R14-125 à R14-131.

## 2. Décisions prises et pourquoi

- B et C : le bug n'était pas dans le pitch mais dans la zone invisible ADD / REMOVE DECK, calculée comme la boîte de sa projection : en perspective elle mangeait la dernière platine. B était touchée quand elle était la dernière.
- PITCH fin : le vernier marche à la souris et au doigt, sans touche à tenir. Le vrai frein était l'écran, qui n'affichait la valeur qu'au pour cent près.
- EQ : la loi était déjà centrée (-26 dB à gauche avec la coupe, 0 dB au milieu, +6 dB à droite). Ce qui manquait : le voir (dB partout) et retomber pile au milieu (cran au centre).
- Curseur : la règle vaut pour la souris seulement ; au téléphone, un doigt ne tournait déjà jamais la vue.
- WARM : un nouvel affichage plutôt que de repeindre 3BAND, puisque Mika aime les autres. Un 3BAND retenu (l'ancien affichage de départ) passe à WARM ; RGB ou MONO choisis restent.
- LOOP > SMPL : une touche dans l'en-tête de la table, comme REMOVE DECK sur une platine. Elle prend la dernière platine bouclée, sinon celle qu'on entend.
- Tonverk : l'allure Elektron (écran et encodeurs en haut, touches de fonction, seize trigs en ligne), aux couleurs du site : noir, or, orange. Les douze encodeurs restent visibles plutôt que d'être mis en pages : chaque réglage reste à un geste. Les fonctions ne changent pas.
- Clavier du MM-SMPL inchangé (Z X C V = trigs 1 à 4...) : les habitudes restent.

## 3. Ce qui reste à faire / points en suspens

- Mika, à l'écoute et en main :
  - le vernier du pitch ;
  - WARM sur ses morceaux ;
  - LOOP > SMPL sur une vraie boucle ;
  - le MM-SMPL au téléphone.
- Idées pour le MM-SMPL façon Elektron : un séquenceur de 16 pas sur les trigs, calé sur l'horloge (le plus naturel pour une Elektron) ; des pages d'encodeurs avec un écran de paramètres.
- Toujours en suspens : les secrets SoundCloud du worker Sonaa, le défilement de la playlist au doigt sur iPhone, l'équilibre RYTM / ARP, une voie du MM-SMPL au mixer.

## 4. Commandes utiles ajoutées

- Aucune commande npm.
- Clavier du MM-DECKS :
  - T : LOOP > SMPL ;
  - V : WARM, 3BAND, RGB, MONO.
- Clé retenue : `mm.v4.dj.2` garde l'affichage sous `waveMode`.
