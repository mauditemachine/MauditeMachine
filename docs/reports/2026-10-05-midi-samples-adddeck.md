# 2026-10-05 : MIDI sur toutes les machines, samples de Mika au MM-RYTM, ADD DECK au mixer, CUE et PLAY, potards du MM-ARP, flèches

Mika, avec une capture du MM-RYTM :
« Je voudrais que tu mettes ces samples dans le sélecteur de samples (six
kicks pour BD, quatre snares pour SD). MM-ARP : j'aimerais que les knobs
soient un peu plus gros en desktop. Je trouve que les boutons CUE et PLAY
font un peu trop jouets. Je voudrais que toutes les actions, tous les
paramètres de toutes les machines puissent être assignés en MIDI ; j'ai un
Roto-Control, je voudrais sélectionner un preset de mon Roto-Control, puis
choisir la machine que je veux et avoir les assignations. Image 1 : je
voudrais un peu plus de (phrase coupée). Je veux pouvoir naviguer entre les
machines avec les flèches gauche droite. Quand on pose la souris sur le bord
du deck B pour afficher ce qu'il y a à droite, c'est trop fragile et on
clique sans faire exprès pour ajouter un deck : juste pouvoir rajouter un
deck à partir du mixer. »

## 1. Ce qui a été fait

- Flèches gauche / droite : la machine d'à côté (hooks/useKeys.ts, actions.ts stepMachine).
- ADD DECK :
  - la zone du bord droit retirée (dj/Twins.tsx, dj/dj.css), le bloc de fin du téléphone aussi (dj/theme.ts) ;
  - une touche ADD DECK dans l'en-tête du mixer, à gauche de LOOP > SMPL (dj/layout.ts, dj/silk.ts, dj/gestures.ts, dj/rig.ts) ;
  - au téléphone : ADD DECK et REMOVE DECK dans l'onglet MASTER du Dock MIXER (dj/MixDock.tsx).
- CUE et PLAY façon lecteur de club : capuchon de caoutchouc sombre, plat, un anneau de LED fin qui s'allume (orange CUE, jaune PLAY), inscriptions petites (dj/controls.ts, dj/theme.ts).
- MM-ARP : potards un peu plus gros en desktop, toutes les tailles (voyager/theme.ts).
- Samples de Mika dans le choix de son du MM-RYTM :
  - public/samples/rytm/<famille>/ : chaque fichier devient un cran du sélecteur de sa famille (vite.config.ts, plugin rytm-samples) ;
  - audio/samples.ts (la liste, le nom court, le chargement), audio/sampledsp.ts (TUNE en demi-tons, ATTACK, DECAY, DRIVE, SNAPPY appliqués au fichier) ;
  - audio/shotsdsp.ts, audio/shots.ts, audio/kit.ts, state/presets.ts, scene/rytmTweaks.ts, ui/Hotspots.tsx ;
  - les sélecteurs à 5 crans et plus tournent sur 240° (voyager/theme.ts) : KICK, SNARE, CHORD lisibles.
- MIDI :
  - midi/targets.ts : toutes les cibles (MM-RYTM, MM-ARP, navigation), dj/midi.ts et smpl/midi.ts pour le MM-DECKS et le MM-SMPL ;
  - midi/midi.ts : Web MIDI, MIDI LEARN, assignations par machine, retour des valeurs vers les potards motorisés, export / import ;
  - ui/MidiPanel.tsx : bouton MIDI dans l'en-tête, son panneau, les étiquettes CC sur la machine pendant le LEARN ;
  - ui/Hotspots.tsx : en LEARN, une commande touchée attend son message (elle ne joue pas) ; scene/hit.ts ; dj/names.ts (noms partagés) ; ui/Header.tsx ; index.tsx ; v4.css.
- docs/v4/spec.md : R14-139 à R14-145.

## 2. Décisions prises et pourquoi

- Les samples ne sont pas dans le repo : ils sont sur le Mac de Mika (iCloud Drive), inaccessibles depuis la session cloud. Tout est prêt : il suffit de copier les fichiers dans public/samples/rytm/bd et sd (commande plus bas) et de pousser. Testé avec dix faux fichiers aux mêmes noms, retirés avant le commit.
- public/ plutôt qu'un import : Vite refuse un « # » dans un nom importé (« Master Kick G# »), le site entier ne se serait plus construit. public/ sert n'importe quel nom, et la liste se refait seule à chaque build.
- Un sample se règle avec les mêmes TWEAKS que le kick : TUNE devient des demi-tons (le fichier est déjà accordé, 0 au milieu), DECAY raccourcit le fichier (il ne peut pas l'allonger), DRIVE est propre jusqu'à sa valeur de départ. Son niveau est calé comme le 909 : changer de son ne saute pas en volume.
- Un preset garde le son par son nom : ajouter ou retirer un fichier ne décale pas les presets.
- MIDI par machine : une assignation appartient à la machine de sa cible. Un message va d'abord à la machine regardée, puis aux actions globales, puis à une autre machine qui l'a. Les deux façons de faire marchent :
  - un preset Roto-Control par machine avec ses propres CC : pas besoin de changer de vue ;
  - les mêmes CC partout : on choisit la machine (en-tête, flèches, ou un bouton du Roto assigné à « GO TO ») et les potards suivent.
- Retour des valeurs : seulement vers les appareils qui ont servi à apprendre. Ton Minilogue XD branché à côté ne reçoit jamais de CC (testé avec une fausse sortie « minilogue xd »). Pas de retour pendant qu'on tourne un potard (300 ms), pour ne pas lutter contre le moteur.
- Web MIDI n'existe pas dans Safari : Chrome, Edge, Opera ou Firefox.
- CUE reste orange (l'anneau et le mot) comme demandé le 2026-10-04, mais sur un capuchon sombre, comme un CDJ.
- ADD DECK : retiré aussi du bout du défilement au téléphone, pour qu'il n'y ait qu'une façon de le faire (le mixer). REMOVE reste sur l'en-tête de la dernière platine.

## 3. Ce qui reste à faire / points en suspens

- Mika, les samples (depuis le dossier du site sur le Mac, là où tu lances npm run admin) :

  ```bash
  SRC="$HOME/Library/Mobile Documents/com~apple~CloudDocs/User Library/Samples/shots"
  git pull
  mkdir -p public/samples/rytm/bd public/samples/rytm/sd
  cp "$SRC/bd/01 AT BluePrint - Kick F.wav" "$SRC/bd/01 AT VNTM - Kick G.wav" "$SRC/bd/02 AT Tim Engelhardt - Kick G.wav" "$SRC/bd/03 AT AFFKT - Kick G.wav" "$SRC/bd/04 AT Sasha Carassi - Master Kick G#.wav" "$SRC/bd/05 AT Alex Stein - Kick F#.wav" public/samples/rytm/bd/
  cp "$SRC/sd/Psy_Snares02.wav" "$SRC/sd/Psy_Snares12.wav" "$SRC/sd/Psy_Snares26.wav" "$SRC/sd/SD A 707.wav" public/samples/rytm/sd/
  git add public/samples/rytm && git commit -m "MM-RYTM : samples BD et SD" && git push
  ```

  Ou envoie-les dans une prochaine session Claude Code locale. Attention : ce qui est publié se télécharge. Vérifie que la licence des packs permet de les diffuser sur un site.
- Mika, à l'écoute (rien n'a été écouté ici, son coupé) : les samples avec TUNE, DECAY, DRIVE ; CUE et PLAY allumés pendant un vrai mix.
- MIDI avec le vrai Roto-Control (testé avec un faux appareil seulement) :
  - CONNECT dans le panneau MIDI (Chrome) ;
  - MIDI LEARN, toucher une commande, tourner un potard du Roto ;
  - vérifier le nom de ses ports et que les potards motorisés suivent au changement de machine.
- « Image 1 : je voudrais un peu plus de » : la phrase est coupée, à préciser.
- Toujours en suspens : les secrets SoundCloud du worker Sonaa, le défilement de la playlist au doigt sur iPhone, l'équilibre RYTM / ARP, la voie du MM-SMPL au mixer.

## 4. Commandes utiles ajoutées

- Aucune commande npm.
- Dossier : public/samples/rytm/<famille>/ (bd, sd, cp, hh, tom, rs). Y poser un fichier audio (wav, aif, mp3, flac, ogg, m4a) l'ajoute au sélecteur de sa famille, au prochain build (en dev, tout de suite).
- Clés retenues :
  - `mm.v4.midi.1` : les assignations par machine, les appareils du retour, CONNECT ;
  - `mm.v4.kit.1` gagne `sample` (le fichier choisi par famille).
- Panneau MIDI : EXPORT / IMPORT d'un fichier mauditemachine-midi.json.
