# 2026-10-07 - Le sampler dans les platines, le MM-SMPL retiré, le MM-BASS

Mika a demandé quatre choses :
- « déplacer le contenu de MM-SMPL dans un DECK », chaque platine pouvant sampler ce qui joue ou le mixer, avec les boutons de CUE devenus des boutons du sampler ;
- supprimer le MM-SMPL ;
- un prototype de générateur de basslines, MM-BASS ;
- l'écran du MM-RYTM façon OP-1, sans couleurs.

Les quatre sont faites : le sampler dans les platines et le retrait du MM-SMPL, l'écran du MM-RYTM, puis le prototype du MM-BASS.

## Ce qui a été fait

- `src/v4/sampler/` (nouveau dossier) :
  - `sampler.ts` : un sampler par platine, avec tout ce que faisait le MM-SMPL, plus REC DECK, REC MIX et LEN.
  - `seq.ts` : la séquence, devenue une classe. Elle se cale sur la platine qui joue.
  - `params.ts` : les réglages, retenus par platine.
  - `ring.ts` et `ring.worklet.js` : la mémoire du mixer, 34 s en boucle.
  - Déplacés de `smpl/` : `slices.ts` et `sampler.worklet.js`.
- `src/v4/dj/SamplerScreen.tsx` (nouveau) et `dj.css` : la page SMPL posée sur l'écran de la platine. On y trouve l'en-tête, les réglages qu'on touche en jouant, la forme d'onde et quatre pages : PADS, SAMPLE, GRAIN et SEQ.
- Les quatre touches HOT CUE deviennent SMPL, REC DECK, REC MIX et PLAY. Fichiers touchés :
  - `dj/layout.ts`, `dj/silk.ts` (crochet SAMPLER), `dj/rig.ts` (LED), `dj/gestures.ts` ;
  - `dj/keys.ts` (1 2 3 4 / 7 8 9 0), `dj/names.ts`, `dj/Twins.tsx`, `dj/midi.ts` (cibles du sampler).
- `dj/actions.ts` :
  - `deckGridAfter` (la grille d'une platine qui joue) et `mixBeat` (le dernier temps de ce qu'on entend) ;
  - la mémoire du mixer démarre avec le moteur ;
  - LOOP > SMPL est retiré.
- `dj/TrackBrowser.tsx` : la page SMPL prend l'écran à la place du morceau ou de la liste, et Échap la ferme.
- MM-SMPL retiré : `src/v4/smpl/`, `state/smplload.ts`, `ui/SmplInfo.tsx`, le PDF `public/docs/MM-SMPL-mode-emploi.pdf`, `scripts/smpl-manual/` et `npm run manual:smpl`. Il faut aussi retirer ses traces dans :
  - la scène et ses machines : `renderer.ts`, `floor.ts`, `hit.ts`, `Hotspots.tsx` ;
  - les capots : `explode.ts`, `actions.ts`, `useKeys.ts`, `HoodClose`, `PcbClose` ;
  - la navigation : `focus.ts`, `Header`, `MachineDrawer`, `MachineNav`, `OverviewHelp`, `InstallPrompt` ;
  - la lecture et le MIDI : `playLock.ts`, `djload.ts`, `debug.ts`, `midi/*`, `MidiPanel` ;
  - les styles : `v4.css`.
- Roto-Control (`midi/roto.ts`) : DECK, MIXER et LIVE sont refaits pour le sampler, et le setup SMPL (15) disparaît. `docs/midi/*` sont régénérés (359 cibles, 5 setups).
- `public/llms.txt`, `docs/v4/spec.md` : R14-187, R14-188.
- `src/v4/bass/` (nouveau dossier), le MM-BASS :
  - `bass.worklet.js` : la voix. Dent de scie et carré polyBLEP, le filtre de la TB-303 d'après Open303 (notice MIT dans le fichier), l'enveloppe et le circuit d'accent de la 303, les slides, DRIVE, et un SUB sinus une octave dessous, ajouté propre après le filtre ;
  - `params.ts`, `state.ts` : les 18 potards et les 16 pas (note, liaison, vide ; ACCENT, SLIDE), retenus dans le navigateur ;
  - `gen.ts` : le générateur façon Torso T-1, avec les styles ACID, DISCO, ROLL et SUB, plus DENSITY, SLIDES, ACCENTS, RANGE et MUTATE ;
  - `seq.ts` : la séquence sur l'horloge audio, calée sur la grille du MM-RYTM (sinon du MM-ARP) avec son swing ; ROOT sur ARP suit les accords du MM-ARP ;
  - `engine.ts`, `actions.ts` : le moteur côté page et les commandes ;
  - `theme.ts`, `rig.ts`, `screen.ts` : la machine 3D à la taille du MM-RYTM, debout au téléphone, et son écran façon OP-1 (le rouleau des notes, la courbe du filtre) ;
  - `gestures.ts`, `keys.ts`, `Twins.tsx`, `midi.ts` : la souris et le doigt (glisser un pas change sa note), le clavier, les jumeaux, les cibles MIDI.
- Le MM-BASS branché :
  - `state/bassload.ts` (son code chargé à part) et `state/focus.ts` (`?bass=0`, `?m=bass`) ;
  - la scène : `renderer.ts`, `floor.ts`, `hit.ts`, `Hotspots.tsx` et `dj/theme.ts` (le MM-DECKS passe à sa droite) ;
  - l'interface : `Header`, `MachineDrawer`, `MachineNav`, `OverviewHelp`, `InstallPrompt`, `index.tsx` ;
  - la lecture et le clavier : `playLock.ts`, `useKeys.ts`, `actions.ts`, `debug.ts` (`__v4.bass`) ;
  - le MIDI : `midi/midi.ts`, `midi/targets.ts`, `MidiPanel`, et `midi/roto.ts` (setup BASS sur le 15, canal 5) ;
  - `scripts/midi-reference.mjs`, `docs/midi/*` régénérés (405 cibles, 6 setups) ;
  - `public/llms.txt`, spec R14-190 à R14-193.
- `src/v4/scene/screen.ts` : l'écran du MM-RYTM redessiné façon OP-1, en vectoriel noir et os. On y voit l'anneau des 16 pas avec la voix au centre, la lecture, le pattern et le tempo, puis trois réglages illustrés (VOLUME en barres, TONE en courbe, DECAY en enveloppe) et la ligne du message. `scene/pixels.ts` (les polices de pixels) est retiré. Spec R14-189.

## Décisions prises et pourquoi

- **REC DECK et REC MIX sont deux touches**, plutôt qu'un sélecteur de source. On choisit d'où on sample au moment d'appuyer, sans mode caché.
- **Les prises sont rétroactives et instantanées.** REC DECK coupe dans le morceau déjà décodé, et REC MIX dans la mémoire des 34 dernières secondes du mixer. On garde « ce qu'on vient d'entendre », calé sur la dernière barre de mesure. Mesuré : le premier temps tombe à 3 ms du début.
- **Le son du sampler passe par la voie de sa platine.** L'EQ, le filtre, le fader et les effets s'y appliquent : le sampler fait partie de la platine.
- **La page SMPL est une page HTML posée sur l'écran**, comme la liste des morceaux. Le texte reste net et les touches restent grandes, au téléphone aussi. Les couleurs de l'écran du MM-SMPL sont gardées (or, orange, cyan, jaune) et la forme d'onde est plus grande.
- **Des pages à la Elektron** (PADS, SAMPLE, GRAIN, SEQ) plutôt que tout à la fois : au téléphone, chaque chose reste lisible.
- **La séquence suit la grille de la platine qui joue.** Un pas prend la slice qui tombe à son heure : la boucle d'origine se reconstruit.
- **Roto, DECK page 4** : le sampler de chaque platine remplace RYTM et ARP, qui restent sur MIXER.
- **L'écran du MM-RYTM, moins de choses et plus grandes.** Sont retirés : les huit vumètres, READY et RUN, le nom de la section et les cases des temps. L'anneau des pas reprend le langage des séquenceurs circulaires de l'OP-1. Chaque réglage a son dessin, en monochrome comme demandé. Une première version : des captures de l'OP-1 de Mika permettraient de l'affiner.
- **MM-BASS, le meilleur de chaque machine** :
  - le grand CUTOFF en aluminium du Minitaur ;
  - les potards et le filtre de la TB-303, avec ACCENT, SLIDE et les liaisons (TIE) de son mode TIME ;
  - le générateur par règles du Torso T-1 (on choisit un style et des chances, pas des notes) ;
  - les seize pas en groupes de quatre de la 303 et du Norand Mono ;
  - la façon Elektron (Syntakt) : on choisit un pas, puis on règle sa note, son accent, son slide ;
  - DRIVE et SUB pour le grain et le poids des basses analogiques du Minitaur et du SE-02.
- **Le filtre est celui d'Open303**, l'émulation de la TB-303 la plus étudiée en logiciel libre, à quatre pôles couplés comme les diodes de la 303. Le filtre de Pirkle essayé d'abord résonnait trop bas et perdait les basses : il est remplacé. Mesuré hors navigateur : la bosse de résonance tombe sur la coupure, la voix reste stable à fond, et elle prend 1.7 % d'un cœur.
- **Le SUB ne passe ni par le filtre ni par DRIVE** : les basses restent pleines même à toute résonance. OCTAVE à -2 descend jusqu'à 20 Hz.
- **Le MM-BASS suit l'horloge du MM-RYTM** (et son swing), sinon celle du MM-ARP, sinon son propre tempo : il se cale toujours sur ce qui joue.
- **Il sort sur le master**, pas encore sur une voie du mixer : le mixer du MM-DECKS a ses quatre voies prises.
- **Pas de capot ni de Dock au téléphone** : la machine debout tient dans l'écran, avec ses potards en rangées de quatre et ses pas en deux rangées de huit.
- **Le MM-SMPL disparaît sans redirection cassée** : `?m=smpl` mène aux DECKS. Son dernier sample revient sur DECK A.

## Ce qui reste à faire / points en suspens

- Mika :
  - charger un morceau, appuyer sur REC DECK en lecture, puis essayer REC MIX pendant que le MM-RYTM joue ;
  - essayer les pads, la séquence et SAVE, au desktop et au téléphone ;
  - réimporter les setups du Roto DECK (13), MIXER (14) et LIVE (16). Le setup 15 (SMPL) peut être effacé.
- Mika : regarder le nouvel écran du MM-RYTM (au repos, en RUN, en EDIT, en tournant VOLUME). S'il veut l'affiner, des captures des écrans de l'OP-1 qu'il aime aideront.
- Mika : essayer le MM-BASS, au desktop et au téléphone. Les tests ont tourné son coupé : la qualité du son (filtre, accent, sub) reste à juger à l'oreille. GEN dans chaque STYLE, RUN avec le MM-RYTM, ROOT sur ARP avec le MM-ARP, puis CUTOFF, RESO et ACCENT pour l'acid.
- Mika : importer le setup BASS du Roto sur le SETUP 15 (le fichier est dans le panneau MIDI et dans `docs/midi/roto/`).
- Plus tard, si Mika le veut : une voie du mixer pour le MM-BASS, la basse dans le setup LIVE (plein aujourd'hui), un EDIT du MM-BASS avec plusieurs lignes en mémoire.
- Toujours en attente : le compteur de visiteurs du MENU (Supabase, quand Mika dit go).

## Commandes utiles ajoutées

- Aucune nouvelle commande npm. `npm run manual:smpl` est retiré.
- Avec `?debug=1` : `window.__v4.sampler('a')` donne le sampler d'une platine, `window.__v4.bass` le MM-BASS (rig, state, params, engine, seq).
- `?m=bass` ouvre le site sur le MM-BASS, `?bass=0` le retire pour l'onglet.
