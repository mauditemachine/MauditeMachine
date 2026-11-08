# 2026-11-08 - MM-RYTM VST3 phase 3 bis : les LFO dans le plugin (pas sur le site)

Demande de Mika : « lance les LFO oui sur le plugin non sur le site ». Le site ne change pas : seuls le pont du plugin (`src/v4/plugin/bridge.ts`, actif en mode PLUGIN seulement) et le C++ bougent.

## 1. Ce qui a ete fait

- `plugin/mm-rytm/dsp/Lfo.h` (nouveau) : le port de `src/v4/audio/lfo.ts` (SPD, MULT, FADE, 7 formes, 5 modes, le hash du RND en arithmetique 32 bits). `lfoValue` donne les memes valeurs que le site sur 4000 cas tires au hasard (ecart max 1.1e-16).
- `plugin/mm-rytm/dsp/Program.h` : chaque coup porte ses LFO, LFO.T, les bases des lois (LEVEL, RESO, DECAY), le panoramique force, et ce qu'un lock trig verrouille (VOL, PAN, RESO, FREQ).
- `plugin/mm-rytm/dsp/Engine.{h,cpp}` :
  - l'ancre des LFO par piste, comme `audio/seq.ts` : PLAY (ou un saut de l'hote), puis chaque trig a LFO.T. Un lock trig a LFO.T relance aussi les repetitions d'un retrig (celles d'avant lui gardent l'ancre d'avant) ;
  - les destinations prises au coup (`seqhit.ts lfoHitLock`) : DIST, DELAY, REVERB et TONE dans la tranche, DECAY dans l'enveloppe ;
  - les destinations continues (`drums.ts lfoLaw`, `lfoCurves`) : PITCH (la lecture a vitesse variable, interpolee), FREQ (octaves de coupure), RESO (le Q de la loi RESO, en dB hors du passe-bande), VOL (le gain rapporte au LEVEL), PAN. Ce sont les memes courbes que le site : des rampes lineaires entre des points, 24 par cycle du plus rapide, de 2 a 40 ms, sur 8 s au plus et 512 rampes. Un LFO immobile (HLD ou SPD 0, sans FADE) donne une seule valeur ;
  - les lock trigs refaits sur `drums.ts lockTrigOn` :
    - ils tombent a l'echantillon pres (avant : au debut du bloc) ;
    - VOL est rapporte au LEVEL du coup ; PAN, FREQ et RESO du coup qui sonne glissent en 1 ms (setTargetAtTime) ;
    - leurs envois et leurs inserts vont a la tranche ;
    - les LFO du coup repartent de la, en 3 ms.
- `plugin/mm-rytm/src/PluginProcessor.cpp` : le parseur lit `lfo`, `lfot`, `lb`, `fp`, `lk`, `lc`.
- `src/v4/plugin/bridge.ts` envoie, pour chaque coup :
  - ses LFO (`activeLfos`, la voix et les verrous du pas) et LFO.T ;
  - les bases des lois ;
  - le panoramique force et le x racine de 2 (un LFO PAN ou un lock trig PAN de la voix, `seqExtra`) ;
  - un filtre ouvert sans enveloppe pour un LFO FREQ ou RESO, ou un lock trig FREQ ou RESO, sur un coup sans filtre ;
  - pour un lock trig, ce qu'il verrouille.
- `plugin/mm-rytm/tests/engine_test.cpp` : 32 tests (6 de plus) :
  - LFO VOL carre (x 1.5625 puis x 0.1406, la loi du LEVEL) ;
  - DECAY au coup (identique bit a bit a la constante de temps de DECAY 0.5) ;
  - PITCH +6 demi-tons (le son finit racine de 2 fois plus tot) ;
  - PAN carre (droite puis gauche) ;
  - FREQ +5 octaves et RESO (le meme son que le filtre attendu) ;
  - TRG relance par un lock trig a LFO.T.
- `plugin/mm-rytm/README.md` : la ligne LFO passe a « joue », celle des lock trigs aussi, avec les ecarts connus.
- `plugin/mm-rytm/update.sh` (nouveau, Mika : « tu peux ecraser /Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3 ») :
  - il prend le build MM-RYTM le plus recent de `~/Downloads` (l'artefact zippe deux fois, ou deja ouvert par Safari) ;
  - il ecrase le plugin installe, retire la quarantaine et re-signe ad hoc ;
  - il previent si Ableton est ouvert ;
  - teste dans le conteneur avec de faux outils macOS (double zip, dossier ouvert, rien a installer) ;
  - il est aussi dans l'artefact (`plugin.yml`), et `INSTALL.md` a une section « Mettre a jour ».
- La release `mm-rytm-latest` (Mika : « vas-y pour la release ») :
  - `plugin.yml` (job mac, seul droit d'ecriture `contents: write`) la cree au premier build, puis a chaque build vert remplace `MM-RYTM-macOS.zip` et `update.sh`, avance son etiquette au commit construit et ecrit le commit dans ses notes ;
  - le paquet porte un `BUILD.txt` (commit, branche, heure) ;
  - `update.sh` la telecharge par defaut (un zip ou un dossier en argument reste possible) et affiche le build installe ;
  - teste dans le conteneur (faux curl et faux outils macOS : la release, un artefact zippe deux fois, un chemin faux).

- **Build vert** (run 42486748268, 13:53 UTC, LFO et `update.sh`) : artefact `MM-RYTM-macOS`, 17 Mo : https://github.com/mauditemachine/MauditeMachine/actions/runs/42486748268/artifacts/13619872707 (garde 30 jours). Le run 10 (LFO seuls) a ete annule par celui-ci, qui le contient.
- **Build vert et release publiee** (run 42488775950, 14:20 UTC) : https://github.com/mauditemachine/MauditeMachine/releases/tag/mm-rytm-latest. Verifie depuis le conteneur sans compte GitHub :
  - `update.sh` se telecharge, identique a celui du depot ;
  - `MM-RYTM-macOS.zip` (17 Mo) contient `MM-RYTM.vst3` (Mach-O universel x86_64 + arm64), `BUILD.txt` (commit 3d02a58), `INSTALL.md` et `update.sh` ;
  - le script de la release installe ce zip (faux outils macOS).

## 2. Decisions prises et pourquoi

- **Rien sur le site** : comme demande. Le pont ne tourne qu'en mode PLUGIN (`window.__MM_PLUGIN__`) ; `npx tsc` reste a 105 erreurs, toutes d'avant et hors de `src/v4/plugin`.
- **FRE suit la position du morceau d'Ableton**, pas « depuis PLAY » comme au site. Lance du debut, c'est identique. Lance ailleurs, le LFO reste cale sur la timeline : un export donne le meme son quel que soit son point de depart. Une boucle d'Ableton (un saut) remet l'ancre, comme un PLAY.
- **Les courbes du site plutot qu'un LFO « parfait »** : le site pose des rampes lineaires entre des points (une forme carree y est un trapeze de 2 a 40 ms). Le plugin reproduit ces memes points pour sonner pareil, sans clic.
- **TONE par LFO** : le site recalcule le coup (TONE au 1/32). Le plugin le fait passer par le TONE de la tranche, comme il traite deja les verrous de TONE. Le calcul hors du thread audio pour chaque coup serait trop lent a suivre un LFO.
- **La mise a jour passe par le Mac de Mika** : la session cloud n'a aucun dossier de son Mac partage (Remote Control), et `/Library` demande son mot de passe. Une release publique `mm-rytm-latest` (adresse fixe, sans telechargement a la main) a d'abord ete bloquee par la regle de securite de la session (une surface publique nouvelle), puis Mika l'a acceptee (« vas-y pour la release »). Elle ne publie rien de plus que le depot, deja public (code, samples). Une prerelease : elle ne passe pas pour une version du site.
- **Lock trigs** : en les branchant aux LFO, deux ecarts de la phase 2 sont corriges :
  - un lock trig sans verrou de VOL ou de PAN remettait le VOL et le PAN de la voix ;
  - un coup au centre panoramique par un lock trig perdait 3 dB.

## 3. Ce qui reste a faire / points en suspens

- Cote Mika : lancer la commande `update.sh` d'`INSTALL.md` (elle telecharge la release toute seule), puis rouvrir Ableton.
- Le jour ou la branche est fusionnee dans main : rien a changer, l'adresse de la release ne depend pas de la branche.
- **Mise en ligne de la V.3.0 du site** (Mika : « je veux la bonne version aussi sur le web avant ») :
  - fait : main fusionne dans la branche (le snapshot des stats), build du site OK, la page RYTM sans `?face=` ouvre la V.3.0 (capture identique a celle validee) ;
  - en attente : le push de la branche sur main (le deploiement) a ete refuse par la regle de securite de la session. Mika a choisi la PR : https://github.com/mauditemachine/MauditeMachine/pull/10, a fusionner par lui (le site se deploie a la fusion, ~1 min).
- Mika a installe la release avec `update.sh` : le plugin marche (2026-11-08). Il a des modifications a demander.
- A l'oreille : un LFO PITCH sur un son tres long (au-dela de 8 s, la courbe se fige comme au site).
- Phase 4 si Mika le veut : chaines de patterns, SONG, multi-out, automation Ableton des potards, latence du limiteur declaree a l'hote.

## 4. Commandes utiles ajoutees

Mettre a jour le plugin sur le Mac (le dernier build vert, rien a telecharger avant) :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rytm-latest/update.sh | bash
```

Les tests du DSP gagnent les 6 tests des LFO :

```bash
cmake -S plugin/mm-rytm -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j && ./build-dsp/mm_engine_test
```
