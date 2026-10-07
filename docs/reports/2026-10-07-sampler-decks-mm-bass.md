# 2026-10-07 - Le sampler dans les platines, le MM-SMPL retiré

Mika a demandé quatre choses :
- « déplacer le contenu de MM-SMPL dans un DECK », chaque platine pouvant sampler ce qui joue ou le mixer, avec les boutons de CUE devenus des boutons du sampler ;
- supprimer le MM-SMPL ;
- un prototype de générateur de basslines, MM-BASS ;
- l'écran du MM-RYTM façon OP-1, sans couleurs.

Ce rapport couvre la première étape, la mise en ligne du sampler dans les platines et le retrait du MM-SMPL.

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
- **Le MM-SMPL disparaît sans redirection cassée** : `?m=smpl` mène aux DECKS. Son dernier sample revient sur DECK A.

## Ce qui reste à faire / points en suspens

- Mika :
  - charger un morceau, appuyer sur REC DECK en lecture, puis essayer REC MIX pendant que le MM-RYTM joue ;
  - essayer les pads, la séquence et SAVE, au desktop et au téléphone ;
  - réimporter les setups du Roto DECK (13), MIXER (14) et LIVE (16). Le setup 15 (SMPL) peut être effacé.
- Mika : regarder le nouvel écran du MM-RYTM (au repos, en RUN, en EDIT, en tournant VOLUME). S'il veut l'affiner, des captures des écrans de l'OP-1 qu'il aime aideront.
- La suite de la demande, dans cette même session : MM-BASS.
- Toujours en attente : le compteur de visiteurs du MENU (Supabase, quand Mika dit go).

## Commandes utiles ajoutées

- Aucune. `npm run manual:smpl` est retiré. `window.__v4.sampler('a')` (avec `?debug=1`) donne le sampler d'une platine.
