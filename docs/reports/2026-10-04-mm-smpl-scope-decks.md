# 2026-10-04 : MM-SMPL (sampler, slicer, granulaire), oscilloscope lisible, titre DECK A

Mika, avec une capture de l'oscilloscope et une de la loupe d'un deck :
« Oscillator : grossis les lignes de 1 px. On a du mal à voir, ça bouge
vraiment vite. Remonte un peu le titre DECK A de 10 px. Construis une autre
machine de travail du sample avec une partie granulaire, propose-moi un nom
et rajoute-la dans la liste des machines : faire des samples, extraire des
parties, changer la tonalité, slicer. » Le reste de son message (PLAY/STOP au
mixer, mobile, invitation, référencement, REMOVE DECK, logotype) était déjà en
ligne (rapport 2026-10-04-gresillement-mixer-mobile-seo).

## 1. Ce qui a été fait

- Oscilloscope (ui/Scope.tsx, audio/scope.ts) :
  - traits plus épais d'un pixel ;
  - POS : une fenêtre plus courte qu'une mesure reste à sa place (POS 1, le temps fort, par défaut) et ne change qu'une fois par mesure ; POS ALL : comme avant ;
  - AUTO : une prise au plus 4 fois par seconde.
- MM-DECKS (dj/theme.ts, dj/screens.ts) :
  - l'en-tête (DECK A, logotype, REMOVE DECK) et MIXER remontent de 0.14 ;
  - le zoom s'écrit 2.5S.
- MM-SMPL, la nouvelle machine (src/v4/smpl/, nouveau) :
  - theme.ts : sa place et son dessus ;
  - params.ts : les 12 potards ;
  - slices.ts : découpe, attaques, crêtes, WAV ;
  - smpl.worklet.js : le son ;
  - engine.ts : le moteur côté page, et le dernier sample retenu ;
  - state.ts, actions.ts : ce que font les commandes ;
  - screen.ts : l'écran ;
  - rig.ts : la 3D ;
  - gestures.ts : les gestes ;
  - keys.ts : le clavier ;
  - Twins.tsx : les jumeaux accessibles ;
  - Dock.tsx : le Dock au téléphone.
- Branchement :
  - state/focus.ts, state/smplload.ts (nouveau), state/playLock.ts ;
  - scene/renderer.ts, scene/floor.ts, scene/hit.ts, scene/quad.ts (nouveau, sorti de dj/gestures.ts) ;
  - ui/Hotspots.tsx, ui/MachineNav.tsx, ui/MachineDrawer.tsx, ui/KnobPanel.tsx ;
  - index.tsx, actions.ts, hooks/useKeys.ts, ui/MenuSheet.tsx, ui/Scope.tsx, ui/InstallPrompt.tsx, debug.ts ;
  - v4.css ;
  - public/llms.txt.
- Pièces du MM-DECKS rendues réutilisables, sans changer leur rendu :
  - dj/body.ts, dj/controls.ts : exports ;
  - dj/silk.ts : SilkSpec, headTexts ;
  - dj/engine.ts : excerpt.
- docs/v4/spec.md : R14-112 à R14-117.

## 2. Décisions prises et pourquoi

- Le nom MM-SMPL : « sample » sans ses voyelles, comme MM-RYTM. On peut le changer en un endroit (state/focus.ts, les listes, la sérigraphie).
- GRAB prend la loupe du deck : sa boucle s'il en a une, sinon la fenêtre de la forme d'onde fine, centrée sur la tête de lecture. C'est ce que Mika montrait sur sa capture.
- La machine est de la famille du MM-DECKS (même corps, mêmes potards et touches) : elle se range à côté sans dépareiller, et ses pièces existaient déjà.
- PITCH change la vitesse en mode SLICE (comme un sampler). Pour changer la tonalité sans changer la durée, on passe en GRAIN. SAVE exporte la version SLICE (vitesse et REV).
- Les pads suivent la convention MPC : le 1 est en bas à gauche, et au clavier ZXCV, ASDF, QWER, 1234.
- REC enregistre la sortie du site après le limiteur, donc le MM-RYTM, le MM-ARP et les decks. C'est le « resampling » des machines.
- Durée maximale d'un sample : 60 s, pour la mémoire d'un téléphone. Le dernier sample revient à la visite suivante (IndexedDB).
- Pas de capot sur le MM-SMPL : OPEN, l'oscilloscope et les raccourcis de la 808 l'ignorent.

## 3. Ce qui reste à faire / points en suspens

- Mika, à l'écoute : les slices, le mode GRAIN (SIZE, DENSITY, SPRAY) et le niveau du MM-SMPL face aux autres machines. Rien n'a été écouté ici, son coupé.
- Mika, sur iPhone : le Dock SMPL (PADS et KNOBS) ; FILE ouvre le sélecteur de Fichiers ; SAVE télécharge (Safari ouvre le partage).
- Idées pour la suite du MM-SMPL :
  - une voie au mixer du MM-DECKS ;
  - un séquenceur de pads calé sur l'horloge ;
  - REC qui part sur la mesure ;
  - SAVE en mode GRAIN ;
  - envoyer une slice vers un deck.
- Desktop, MM-DECKS en avant : la zone ADD/REMOVE DECK du bord droit touche le bout du MM-SMPL qui dépasse. Elle est étroite ; à revoir si ça gêne.
- Toujours en suspens : les secrets SoundCloud du worker Sonaa, le défilement de la playlist au doigt sur iPhone, l'équilibre RYTM / ARP.

## 4. Commandes utiles ajoutées

- `?m=smpl` ouvre le site sur le MM-SMPL ; `?smpl=0` le retire (pour l'onglet).
- Clavier du MM-SMPL :
  - ZXCV / ASDF / QWER / 1234 : les 16 pads ;
  - Espace : PLAY ;
  - M : MODE ;
  - L : LOOP ;
  - B : REV.
- Clés retenues dans le navigateur :
  - `mm.v4.smpl.1` : les potards ;
  - `mm.v4.smpl.state` : SLICES, MODE, REV, LOOP ;
  - `mm.v4.sdock`, `mm.v4.sdock.page`, `mm.v4.knobtab.smpl` : le Dock ;
  - IndexedDB `mm-smpl` : le dernier sample ;
  - `mm.v4.scope.1` gagne `at` (POS).
