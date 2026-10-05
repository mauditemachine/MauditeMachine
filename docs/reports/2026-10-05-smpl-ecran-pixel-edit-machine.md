# 2026-10-05 : MM-SMPL refait, écran pixel du MM-RYTM, EDIT dans les machines (patterns et chaînes, notes de l'ARP), logotype, sonie, aliasing, mode d'emploi

Mika, avec une capture du volet des machines (la vignette du MM-SMPL) et une photo de la Digitakt II :
« MM-SMPL : les trois boutons sont vraiment trop gros et les autres trop petits ! Travaille sur quelque
chose d'ergonomique et attention au mobile, je veux que ce soit parfait ; pour la navigation on n'a pas
grand place. Pour les boutons EDIT, j'aimerais que le contenu d'EDIT s'ouvre à l'intérieur de la machine,
pas en dessous, dans la partie des steps, la partie du bas, dans un design sur la machine où je peux mettre
des notes ; pour la RYTM, c'est ça : on peut placer des patterns, et d'ailleurs on peut rajouter des
séquences comme le fait la Digitakt. Les steps carrés, les strokes sur 1 5 9 13, cliquer et rester appuyé
pour changer la vélocité. L'écran de la RYTM dans le design de pixel comme la Digitakt 2, mais bien plus
simple, des petites animations, plus d'informations (le meilleur de la Digitakt 2, de l'Analog Rytm, de
l'EMX1 et de l'Impulse). Fais un gros effort pour le MM-SMPL : des boutons poussoirs en caoutchouc avec
une LED intérieure ; il manque RANDOM, EDIT, CLEAR ; pas de GRAB, c'est moi qui envoie à la machine. Les
volumes des voix de la RYTM pas égaux. Le logotype en light plus gris clair, 20 px plus gros. Des petits
glitchs d'aliasing au départ. En vue d'ensemble, au survol d'une machine, un court mode d'emploi. »

## 1. Ce qui a été fait

- Logotype : 20 px plus gros (clair et sombre), gris plus clair en Light (v4.css). Commit 35ece0d.
- MM-RYTM, sonie des voix : chaque voix calée sur une sonie cible (pondération K, BS.1770), quel que soit le son (909, 808, MM, sample) (audio/shotsdsp.ts). Commit 35ece0d.
- Aliasing au départ : résolution minimale 1.5 au desktop, plan proche de la caméra à 1 (theme.ts, scene/renderer.ts). Commit 35ece0d.
- Vue d'ensemble : au survol d'une machine, sa carte « comment l'utiliser » (ui/OverviewHelp.tsx, state/overviewHover.ts). Commit 35ece0d, textes mis à jour ensuite.
- MM-RYTM, steps carrés, cadre sur 1 5 9 13, vélocité en glissant depuis un step (theme.ts, scene/sequencer3d.ts, ui/Hotspots.tsx, actions.ts). Commit 24de488.
- MM-SMPL refait (commit 870e8a9) :
  - disposition : l'écran au milieu, LEVEL et PITCH à sa gauche (aluminium, à peine plus gros), dix potards de même taille à sa droite en deux rangées SAMPLE et GRAIN (smpl/theme.ts, smpl/rig.ts) ;
  - douze touches : REC, PLAY, STOP | FILE, SLICES, MODE, REV, LOOP | RANDOM, CLEAR, EDIT, SAVE ; GRAB A et GRAB B retirés ;
  - seize trigs en deux rangées de huit, plus larges ;
  - touches et trigs en caoutchouc à LED dedans : la lumière part du centre et diffuse vers les bords, lisible aussi sur le caoutchouc clair (scene/materials.ts withRubberLed) ;
  - la séquence : 16 pas, une slice par pas, calée sur le MM-RYTM ou le MM-ARP (smpl/seq.ts, smpl/smpl.worklet.js, smpl/engine.ts, smpl/actions.ts) ; EDIT : les trigs sont les pas (taper, glisser pour la slice), RANDOM, CLEAR, PLAY ; la bande des pas à l'écran (smpl/screen.ts) ;
  - clavier, MIDI, jumeaux (smpl/keys.ts, smpl/midi.ts, smpl/Twins.tsx, smpl/gestures.ts) ;
  - le Dock du téléphone : une seule rangée d'onglets PADS / SAMPLE / GRAIN, les douze touches, une petite forme d'onde, les pas en EDIT (smpl/Dock.tsx, v4.css).
- MM-RYTM, écran pixel (scene/pixels.ts, scene/screen.ts) : 160 x 60 points, deux polices bitmap ; le pattern, les temps, le tempo, la voix en grand et son son, ses 16 pas, dix vumètres qui sautent à chaque coup, l'état et les messages ; pages EDIT, MIX et presets ; petites animations (pattern qui clignote, voix qui glisse, vague au repos sur desktop).
- MM-RYTM, patterns et chaînes (state/patterns.ts, audio/clock.ts onBar, actions.ts, scene/sequencer3d.ts, scene/renderer.ts) : EDIT fait des 16 steps les patterns A01 à A16 ; taper choisit (en lecture : à la fin de la mesure), plusieurs tapes rapides font une chaîne, tenir un emplacement vide y copie le pattern ; MIDI PATTERN A01 à A16 (midi/targets.ts) ; au téléphone, les 16 patterns en tête du panneau (ui/BeatEditor.tsx).
- MM-ARP, l'écran des notes dans la machine (voyager/seqscreen.ts, voyager/rig.ts, voyager/pads.ts, ui/Hotspots.tsx, scene/hit.ts) : EDIT range les pads d'accords et fait monter un écran à leur place : les accords, AUTO / EDIT, STEPS, une barre par pas à dessiner, les noms des notes (un toucher : un silence).
- Au desktop, EDIT n'ouvre plus de panneau sous le RYTM ni sous l'ARP (ui/BeatEditor.tsx, ui/SeqLane.tsx).
- docs/v4/spec.md : R14-146 à R14-154.

## 2. Décisions prises et pourquoi

- MM-SMPL : la hiérarchie à deux tailles seulement (1.1 pour LEVEL et PITCH, 0.92 pour les dix autres), au lieu de trois gros et neuf petits : les potards qu'on tient en jouant restent repérables, sans écraser les autres. La grille SAMPLE / GRAIN suit les pages d'une Elektron.
- Les trigs en 2 x 8 : à la souris comme au doigt, une cible deux fois plus grande qu'en ligne de 16.
- La diffusion des LED est calculée dans le matériau (une tache au centre du dessus qui s'étale, les flancs à peine) : aucune texture de plus, un seul programme pour toutes les touches. En Light, la matière prend la couleur de la LED là où elle éclaire, sinon l'orange se perdait dans le blanc.
- GRAB retiré de la machine, mais pas la fonction : LOOP > SMPL du mixer continue d'envoyer la boucle d'une platine (c'est « toi qui envoies »).
- La séquence du SMPL est une piste : chaque pas coupe le précédent à son heure exacte (le worklet reçoit l'heure audio de chaque pas). Un pas vide prend la slice de son rang : poser les 16 pas rejoue la boucle d'origine, découpée dans l'ordre.
- EDIT « dans la machine » : pour le MM-RYTM, les steps sont déjà l'éditeur du motif (voix par voix, vélocité en glissant) ; EDIT y ajoute ce qui manquait, les patterns et les chaînes à la Digitakt, sur les mêmes 16 touches. Pour le MM-ARP, un vrai écran monte à la place des pads (pas de panneau HTML posé dessus : il suit la caméra, l'orbite, la lumière). Au téléphone, où tout est déjà sous la machine, les panneaux restent (le RYTM avec ses 16 patterns en tête).
- Chaîne : plusieurs tapes en moins de 2 secondes, sans touche de plus (Elektron : tenir PTN et taper les trigs). Le pattern change toujours au début d'une mesure, posé juste avant que l'horloge programme son premier pas : aucun coup de l'ancien pattern ne part.
- Un pattern garde les coups et les vélocités ; le tempo, les effets et le kit restent ceux de la machine (comme les presets les gardent déjà).
- Écran pixel : une police bitmap faite main plutôt qu'une police web en petit (nette à toutes les tailles, rien à charger). Mise à jour au plus tous les 60 ms et seulement quand un store change ; la vague du repos ne tourne qu'au desktop, sur le MM-RYTM regardé, 7 s toutes les 22 s environ.
- Tests : aucune lecture audible. Son coupé (?mute=1, Chromium --mute-audio) dans le conteneur cloud ; vérifié par l'état (séquence, patterns, vumètres, tête de lecture), jamais par le son.

## 3. Ce qui reste à faire / points en suspens

- Mika, à l'écoute (rien n'a été écouté ici) :
  - la séquence du MM-SMPL (RANDOM sur une boucle envoyée du mixer, PLAY avec le MM-RYTM qui joue) ;
  - la chaîne de patterns du MM-RYTM en lecture (le changement en fin de mesure) ;
  - la sonie égalisée des voix.
- Mika, à regarder sur ton écran : la diffusion des LED du MM-SMPL (sombre et clair), l'écran pixel du MM-RYTM (lisible à ta taille d'écran ?), l'écran des notes de l'ARP.
- Le MM-SMPL au téléphone : à essayer au doigt (les onglets PADS / SAMPLE / GRAIN, les pas en EDIT).
- Pistes possibles : des banques de patterns (B, C...), une longueur par pattern, des paramètres par pas (p-locks) ; la séquence du MM-SMPL avec une hauteur par pas.
- Toujours en suspens : les samples BD et SD à copier dans public/samples/rytm (commande du rapport 2026-10-05-midi-samples-adddeck.md), le vrai Roto-Control, les secrets SoundCloud du worker, le défilement de la playlist au doigt sur iPhone, la voie du MM-SMPL au mixer.

## 4. Commandes utiles ajoutées

- Aucune commande npm.
- Clés retenues :
  - `mm.v4.smpl.seq.1` : la séquence du MM-SMPL (16 pas, une slice ou rien) ;
  - `mm.v4.patterns.1` : les 16 patterns du MM-RYTM, le courant, la chaîne ;
  - `mm.v4.sdock.page` prend `pads`, `sample` ou `grain` (l'ancien `knobs` devient `sample`).
- MIDI : nouvelles cibles `rytm:ptn:0` à `rytm:ptn:15` (PATTERN A01 à A16) et les touches RANDOM, CLEAR, EDIT du MM-SMPL.
