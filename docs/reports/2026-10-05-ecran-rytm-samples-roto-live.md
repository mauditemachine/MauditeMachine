# Écran du MM-RYTM plus fin, tes samples, Roto-Control pour le live (2026-10-05)

Demandes de Mika (avec une capture de l'écran du RYTM) :
- « Arrange l'écran de RYTM, fais les choses plus fines, meilleur graphisme, et occupe tout l'écran : là il y a de l'espace en dessous. »
- « RYTM : je ne peux toujours pas sélectionner les samples que je t'ai donnés, les kicks. Ou explique-moi comment aller les chercher. »
- « ROTO : comment je fais pour mapper tout le Roto-Control avec le mapping de mes machines ? As-tu fait quelque chose ? J'ai ROTO-SETUP 3.3.0. J'aimerais que tout soit mappé de la meilleure manière possible et la plus efficace pour le jeu en live, je veux contrôler toutes les machines. »

## 1. Ce qui a été fait

- **Écran du MM-RYTM** (`src/v4/scene/pixels.ts`, `src/v4/scene/screen.ts`) :
  - deux fois plus de points (320 x 120 au lieu de 160 x 60), canvas 960 x 360 ;
  - les polices gardent leur taille, avec un trait deux fois plus mince (générées depuis les 5 x 7 et 3 x 5) ; M, N, W et S de la petite police sont dessinés à la main ;
  - marges, triangle de lecture (carré à l'arrêt), pas en trois segments de vélocité, vumètres en segments fins ;
  - la ligne du bas n'est plus jamais vide : trois jauges (voix choisie : VOL, TONE, DECAY ; sinon SWING, STRETCH, MASTER).
- **Tes samples** :
  - `src/v4/audio/usersamples.ts` (nouveau) : les fichiers choisis restent dans le navigateur (liste dans localStorage, sons dans IndexedDB), rien n'est envoyé ;
  - `src/v4/audio/samples.ts`, `src/v4/audio/kit.ts` : tes samples prennent leur place dans le choix de son, après 909, 808, MM et ceux du site ;
  - `src/v4/scene/rytmTweaks.ts` : les commutateurs des TWEAKS se renumérotent ;
  - `src/v4/ui/RytmSamples.tsx` (nouveau) : le panneau SAMPLES quand le RYTM est ouvert. On choisit la voix, ses sons, + ADD FILES et le bouton × pour retirer ; un fichier déposé sur un pad va à cette voix ;
  - `src/v4/index.tsx` et `src/v4/v4.css` : branchement du panneau et ses styles (thème clair compris).
- **Roto-Control** :
  - `src/v4/midi/roto.ts` : six setups (RYTM, ARP, DECK, MIXER, SMPL, et LIVE en setup 16) :
    - les potards et les boutons d'une même page vont ensemble ;
    - les états (RUN, mutes, OSC ON) sont des boutons à bascule ;
    - les potards bipolaires ont un cran au milieu ;
    - KICK SOUND et SNARE SOUND sont des potards à crans nommés, avec tes samples ;
  - `src/v4/midi/targets.ts` : mute direct de chaque voix, RUN du RYTM et de l'ARP avec leur état ;
  - `src/v4/actions.ts` : `voiceMute` ;
  - `src/v4/midi/midi.ts` :
    - le CC 64 donne le neutre exact ;
    - un écho des valeurs renvoyées aux potards motorisés est ignoré ;
    - FOLLOW : le site montre la machine du setup qu'on touche ;
  - `src/v4/ui/MidiPanel.tsx` : 6 setups à télécharger, la case FOLLOW, la marche à suivre pour ROTO-SETUP 3.3.0.
- `docs/v4/spec.md` : R14-163 à R14-167.

## 2. Décisions prises et pourquoi

- **Écran.** Mika regarde au desktop Retina, mais le site doit rester lisible au téléphone.
  - D'où la même taille de texte avec un trait plus fin, plutôt que des lettres plus petites.
  - Vérifié à la vue normale (1440 x 900 x 2) et sur un iPhone (390 x 844 x 3).
  - L'espace du bas venait de la ligne 3 vide au repos : elle montre maintenant les réglages utiles.
- **Kicks : je n'ai jamais eu les fichiers**, seulement leurs chemins sur le Mac de Mika.
  - Plutôt que d'attendre, Mika les charge lui-même depuis son ordinateur.
  - Ils restent sur son appareil : aucune question de licence (les packs AT ne sont pas forcément publiables), et ça marche pour tous les visiteurs.
  - Pour les publier pour tout le monde, il suffit de déposer les WAV dans la conversation.
- **Roto.** Le format a été vérifié dans le code même de ROTO-SETUP 3.3.0 : import sur le setup choisi avec SEL, le nom vient du champ `name`, aucun champ manquant. Nos fichiers étaient déjà conformes.
  - Le setup LIVE évite de changer de setup en jouant.
  - FOLLOW est actif par défaut, sauf pour LIVE : le Roto n'envoie rien quand on change de setup, donc c'est le premier geste qui montre la machine.
  - La LED des bascules suit le site via le CC renvoyé. Un forum signale des boutons TOGGLE qui ne suivaient pas : à vérifier sur le vrai Roto.
- **Hors périmètre, signalé** (tâche proposée à part) : en thème clair, le panneau SCOPE garde un fond sombre avec du texte gris foncé, et ALL est presque invisible dans le sélecteur du haut.

## 3. Ce qui reste à faire / points en suspens

- **Côté Mika, tes kicks :**
  1. Ouvrir le MM-RYTM (OPEN).
  2. Dans le panneau SAMPLES à gauche, choisir KICK, puis + ADD KICK FILES.
  3. Prendre les 6 fichiers dans iCloud > User Library > Samples > shots > bd. Ou glisser les WAV sur le pad BD.
  4. Pareil pour les snares : choisir SNARE, ou glisser sur le pad SD.
  - À refaire sur chaque appareil (Mac, iPhone).
- **Côté Mika, Roto :**
  1. Dans ROTO-SETUP 3.3.0, accepter la mise à jour du firmware, puis faire File > Export All.
  2. Passer le Roto en mode MIDI.
  3. Sur le site : MIDI > DOWNLOAD THE 6 SETUPS.
  4. Sur le Roto, SEL sur SETUP 11, puis dans ROTO-SETUP File > Import (Cmd+I) avec « MM RYTM (SETUP 11).json ».
  5. Pareil pour ARP en 12, DECK en 13, MIXER en 14, SMPL en 15, LIVE en 16.
  6. Dans Chrome : MIDI > CONNECT.
  7. Dire si les LED des bascules (RUN, mutes) suivent bien.
- Si Mika veut ses kicks pour tous les visiteurs : déposer les WAV dans la conversation et vérifier leur licence.
- Thème clair : SCOPE et ALL (tâche à part).

## 4. Commandes utiles ajoutées

- Aucune commande npm.
- Le panneau SAMPLES (RYTM ouvert) et le panneau MIDI (DOWNLOAD THE 6 SETUPS, FOLLOW) remplacent toute manipulation de fichiers dans le dépôt.
