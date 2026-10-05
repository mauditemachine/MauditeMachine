# 2026-10-05 - Roto-Control complet, mixer et ARP au telephone

## 1. Ce qui a ete fait

- **Roto-Control** (`src/v4/midi/roto.ts`, nouveau ; `midi/midi.ts`, `ui/MidiPanel.tsx`) : cinq setups ROTO-SETUP (RYTM, ARP, DECK, MIXER, SMPL) a importer dans les setups 11 a 15, chaque potard et bouton nomme, colore, 0 a 127, crans haptiques et noms des crans pour les selecteurs ; le site repond a ces canaux sans MIDI learn et les potards motorises suivent ; telechargement des 5 fichiers (zip) ou un par machine depuis le panneau MIDI.
- **MM-SMPL au telephone** (`smpl/theme.ts`, `smpl/rig.ts`, `smpl/Dock.tsx`, `dj/silk.ts`) : la meme forme debout que le RYTM et l'ARP.
- **Logotype de l'en-tete** (`v4.css`) : a la taille du logo (26 px, 23 px au telephone).
- **Fleches au telephone** (`ui/MachineNav.tsx`) : toujours visibles a gauche et a droite ; sur le MM-DECKS elles passent deck A, mixer, deck B, puis la machine suivante.
- **Mixer du MM-DECKS au telephone** (`dj/theme.ts`, `dj/layout.ts`, `dj/silk.ts`, `dj/body.ts`, `dj/gestures.ts`, `dj/rig.ts`, `dj/names.ts`) : une seule vue qui tient dans l'ecran ; VOLUME en potard a la place des faders ; effets en deux rangees de quatre, plus gros ; ADD DECK et LOOP > SMPL dans la colonne MASTER.
- **Languette MIXER retiree** (`dj/MixDock.tsx` supprime, `index.tsx`, `v4.css`).
- **MM-ARP au telephone** (`voyager/theme.ts`, `voyager/silk.ts`) : pads en une rangee de huit, plus petits ; AMP EG et EFFECTS descendus sur le plateau ; panneau a quatre rangees, potards +12 % ; touches du transport et libelles plus gros. Desktop inchange.
- **EDIT** (`ui/SeqLane.tsx`, `voyager/seqscreen.ts`, `actions.ts`) : plus de touches AUTO / EDIT dans la page ; CLEAR sur la machine rend les notes des potards.
- **MM-RYTM en RUN** (`actions.ts`) : toucher une voix la selectionne sans la jouer.
- Spec : R14-155 a R14-162 (`docs/v4/spec.md`).

## 2. Decisions prises et pourquoi

- **Setups 11 a 15** : tes setups 1 a 10 restent intacts ; un setup par machine, nomme comme demande.
- **Le 15-115** de ton test venait du MIN / MAX du potard dans ROTO-SETUP (MIN 15, MAX 115 sur ta capture), pas du site : les fichiers generes sont tous en 0-127.
- **VOLUME garde l'id du fader** (dj-chN-fader) : tes assignations MIDI et le setup MIXER du Roto marchent pareil au telephone et au desktop.
- **Mixer en une vue, tenu droit seulement** : au telephone couche, la table garde ses deux vues ; le desktop ne change pas.
- **ARP : rien dans OPEN** : en reduisant les pads et en descendant AMP EG + EFFECTS sur le plateau, tout tient ; inutile de cacher des reglages.
- **Fleches plutot que swipe** : le swipe reste, mais les fleches evitent d'accrocher un bouton en glissant.
- Tests sans aucune lecture audio (etat, MIDI simule, captures).

## 3. Ce qui reste a faire / points en suspens

- **Cote Mika (Roto-Control)** :
  1. Mettre ROTO-SETUP a jour (3.3.0, tu es en 1.1.4) et faire File > Export All pour sauvegarder tes setups.
  2. Panneau MIDI du site > ROTO-CONTROL > DOWNLOAD THE 5 SETUPS.
  3. Dans ROTO-SETUP, selectionner SETUP 11 (SEL) puis File > Import "MM RYTM (SETUP 11).json" ; pareil ARP 12, DECK 13, MIXER 14, SMPL 15.
  4. Fermer ROTO-SETUP (il garde le port MIDI), puis CONNECT dans le panneau MIDI du site.
- Essayer au telephone : le mixer en une vue, l'ARP, les fleches ; dire si les potards de l'ARP doivent encore grossir (on pourrait alors passer FILTER EG ou MOD dans OPEN).
- Si ROTO-SETUP refuse un import, m'envoyer l'export d'un de tes setups (File > Export) pour caler le format exact.

## 4. Commandes utiles ajoutees

- Aucune nouvelle commande npm. Les fichiers du Roto se telechargent depuis le panneau MIDI du site (section ROTO-CONTROL).
