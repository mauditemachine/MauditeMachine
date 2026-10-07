# 2026-10-07 - MIXER à 5 voies, les platines suivent les machines, pitch au 0,05, MM-ARP plus grand au téléphone

Suite de la session du jour (rapport précédent : `2026-10-07-presets-niveaux-mute-solo.md`). Mika a demandé :
- avec le MM-BASS, trois machines : trois voies de MIXER pour les machines, deux pour les DECKS, donc 5 ;
- les platines synchronisées automatiquement sur les machines quand elles jouent ;
- un pitch des platines réglable finement, jusqu'au 0,05, au doigt aussi sur téléphone ;
- les boutons du MM-ARP plus grands sur téléphone.

## Ce qui a été fait

- **MIXER à 5 voies** :
  - `dj/theme.ts` : voies 1 RYTM, 2 BASS, 3 ARP, 4 A, 5 B (jusqu'à 7 avec quatre platines). `DJ_MACHINE_CHANNELS`, `deckChannel`, `DJ_CH_NAMES`.
  - `audio/drums.ts`, `bass/engine.ts` : le MM-BASS a sa propre sortie (`bassOut`), routée sur la voie 2. Avant, il sortait par celle du RYTM.
  - `dj/actions.ts` : `routeMachines` envoie les trois machines sur les voies 1 à 3. FX TO dit `2 BASS`, etc.
  - `dj/state.ts` : nouvelle clé `mm.v4.dj.3`, migration de l'ancienne table (tes réglages suivent leur voie, la voie BASS part avec le fader en haut, FX TO suit).
  - Le bouton PLAY de la table devient **MACHINES** : il lance ou arrête le RYTM, la basse et l'arpège, et son témoin suit les trois (`actions.ts`, `dj/rig.ts`, `dj/silk.ts`).
  - Libellés et MIDI : `dj/names.ts`, `midi/targets.ts`.
  - Roto (`midi/roto.ts`) :
    - FX TO à 6 crans (ALL, RYTM, BASS, ARP, A, B) ;
    - MIXER page 1 : faders RYTM, BASS, ARP, A, B, plus FILTER RYTM, A, B ;
    - MIXER page 2 : FILTER BASS et ARP, HI / LOW de RYTM, BASS (pêche) et ARP ;
    - MIXER page 3 : les platines sur les voies 4 et 5 ;
    - boutons page 1 de MIXER et LIVE : RUN RYTM, RUN BASS, RUN ARP, PLAY A / B, CUE A / B, MACHINES.
  - `docs/midi` régénéré (429 cibles, 6 setups).
- **Les platines suivent les machines** (`dj/actions.ts`) :
  - tant que le RYTM (ou l'arpège) joue, chaque platine qui joue prend leur tempo et cale ses temps sur les leurs, comme SYNC ;
  - une platine lancée pendant qu'elles jouent part sur un de leurs temps, déjà au bon tempo ;
  - si tu changes le tempo des machines, les platines suivent tout de suite, et leurs temps se recalent 0,4 s après ton geste ;
  - toucher le pitch d'une platine (fader, molette, PITCH - / +, touches) la libère jusqu'à sa prochaine lecture ou un SYNC ;
  - à l'arrêt des machines, chaque platine garde son tempo.
- **Pitch au 0,05 BPM** :
  - `dj/actions.ts` : `TEMPO_STEP` 0,05 (au lieu de 0,1). PITCH - / + avance de 0,05 BPM, Maj de 1 BPM.
  - Le fader (souris ou doigt) s'arrête sur les valeurs au 0,05 BPM : 121,20, 121,25, etc.
  - `dj/gestures.ts` : un PITCH - / + tenu répète toutes les 90 ms, puis toutes les 45 ms après 10 pas. La molette et les touches Z / X suivent (`dj/keys.ts`, `dj/Twins.tsx`).
- **MM-ARP au téléphone** (`voyager/theme.ts`, `voyager/knobs.ts`) :
  - potards plus grands (x 1,36), avec une zone tactile d'au moins 0,42 ;
  - boutons et pads plus grands ;
  - libellés retaillés pour ne pas se chevaucher. Le desktop ne change pas.
- `docs/v4/spec.md` : R14-206 à R14-209.

## Décisions prises et pourquoi

- **L'ordre des voies** suit celui des machines à l'écran (RYTM, BASS, ARP), puis les platines. Les identifiants MIDI `dj-chN-*` se décalent : ch2 est la BASS, ch3 l'ARP, ch4 et ch5 les platines.
- **Migration plutôt que remise à zéro** : tes réglages de table (faders, EQ, filtres, FX TO) suivent leur voie.
- **REC MIX A retiré des boutons Roto** pour faire de la place à RUN BASS. Il reste dans la liste des cibles MIDI.
- **La sync auto ne te bloque pas** : dès que tu touches le pitch d'une platine, elle est à toi. Sinon tu ne pourrais jamais caler une platine à l'oreille pendant que les machines jouent. Un SYNC ou un nouveau PLAY la remet sous les machines.
- **Tempo tout de suite, temps après le geste** : recaler les temps à chaque cran du potard de tempo ferait sauter la lecture. Le tempo suit en continu, les temps une seule fois, à la fin du geste.
- **Le pas de 0,05 sur le fader aussi** : au doigt, viser 0,05 BPM sur un fader de quelques centimètres est impossible. Le fader s'aimante donc sur la grille de 0,05 BPM. Sans BPM connu, le pas reste au centième de pour cent.
- **Vérifié, sans rien faire jouer** (?mute=1, Chromium muet) :
  - migration de la table, la voie BASS qui montre un niveau quand les machines jouent ;
  - une platine lancée à 124 qui se cale à 124,000, suit 126 puis 128 ; libérée, elle reste à 126,15 ; SYNC la ramène ;
  - le fader au pitch 0,123456 qui tombe sur 121,200 ;
  - captures desktop et téléphone de la table (5 voies) et du MM-ARP (pas de chevauchement) ;
  - test de fumée desktop et téléphone sans erreur ; tsc : les 15 erreurs d'avant.

## Ce qui reste à faire / points en suspens

- **Réimporter les setups Roto** (`docs/midi/roto/`) : MIXER et LIVE ont changé, et les voies des platines se sont décalées. Un ancien setup piloterait la mauvaise voie.
- **À essayer, côté Mika** (rien n'a été écouté ici) :
  - une platine lancée pendant que les machines jouent, puis un changement de tempo ;
  - le pitch au doigt sur le téléphone ;
  - le MM-ARP au téléphone.
- **Toujours en attente** : le compteur de visiteurs du MENU (quand tu dis go).

## Commandes utiles ajoutées

- Aucune nouvelle commande. `npm run docs:midi` régénère la doc MIDI et les setups Roto après un changement de cibles.
