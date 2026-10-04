# 2026-10-04 : MM-DECKS formes d'onde 3BAND, RGB et MONO, REMOVE DECK lisible

Mika, avec une photo des platines C et D : « comment on fait quand on a
add un deck par erreur, comment on l'enleve ? La waveforme est correcte
mais on a du mal a voir les choses, ya pas un autre affichage pour ca ? »

## 1. Ce qui a ete fait

- Formes d'onde en trois bandes :
  - src/v4/dj/math.ts : bandEnergy (basses sous 180 Hz, mediums de 180 Hz a 2.5 kHz, aigus au-dessus, 400 tranches par seconde), wavePeaks3 (fenetres courtes, normalisation par bande), bandOverview (la piste entiere) ;
  - src/v4/dj/engine.ts : les bandes se calculent apres la pose du morceau, par morceaux de 10 ms (l'ecran ne fige pas), abandonnees si un autre morceau arrive ; djWaveBands previent la scene ;
  - src/v4/dj/waveform.ts : texture RGBA (l'energie et les trois bandes), shader a trois affichages, reperes (tete, cues, bornes de boucle) cernes de noir ;
  - src/v4/dj/state.ts : DJ_WAVES, djState.wave retenu dans le navigateur (3BAND par defaut) ;
  - src/v4/dj/theme.ts, screens.ts, gestures.ts, actions.ts : une touche WAVE dans l'ecran de chaque platine, entre la piste entiere et le zoom ; la toucher passe a l'affichage suivant ;
  - src/v4/dj/keys.ts : touche V au clavier, et sa ligne dans l'aide KEYS.
- REMOVE DECK :
  - src/v4/dj/theme.ts, silk.ts : « REMOVE DECK » en orange, presque deux fois plus grand, a la place de DIGITAL DECK sur la platine qu'on peut retirer ; la touche plus large ;
  - src/v4/dj/actions.ts, state.ts, rig.ts, screens.ts : une platine qui joue se retire en deux appuis (le premier allume la touche en orange et l'ecran dit d'appuyer encore, le second dans les 3 s la retire ; sinon tout se desarme) ; une platine a l'arret part en un appui, comme avant ;
  - src/v4/dj/Twins.tsx : le nom accessible le dit.
- docs/v4/spec.md : R14-95 et R14-96.

## 2. Decisions prises et pourquoi

- REMOVE existait deja (en haut a droite de la derniere platine ajoutee, avant le logo), mais son nom faisait 0.065 de haut : il ne se voyait pas. Plutot qu'un deuxieme bouton ailleurs, on l'a rendu lisible a sa place.
- Seule la derniere platine ajoutee se retire (D avant C) : ca garde les voies du MIXER en ordre (C sur la 5, D sur la 6).
- Les deux appuis seulement quand la platine joue : en plein set, un appui de trop couperait le morceau qu'on entend. A l'arret, rien a perdre, un seul appui.
- 3BAND par defaut, comme le reglage des CDJ-3000 et de rekordbox : basses en bleu (on voit ou tape la grosse caisse, et les breaks sans elle), mediums en ambre (voix, nappes, snare ; plus jaune que l'orange des cues pour ne pas les confondre), aigus en os (charlestons). RGB pour qui prefere les couleurs de rekordbox. MONO garde l'affichage d'avant.
- Le reglage vaut pour toutes les platines a la fois, comme sur une CDJ.
- Chaque bande est ramenee a sa propre echelle (centile 99.5) : un morceau masterise ne fait plus un bloc plein, on lit sa structure. Une bande presque absente reste petite.
- Les mediums ont leur vrai filtre passe-bande : « le signal moins les basses et les aigus » gardait un residu qui suivait la grosse caisse (0.33 au lieu de 0.00 sur une grosse caisse seule).
- La piste entiere (bas de l'ecran) passe de 82 % a 69 % de la largeur pour faire la place a WAVE.

## 3. Ce qui reste a faire / points en suspens

- Mika : poser un vrai morceau et essayer WAVE (3BAND, RGB, MONO), dire si les couleurs ou les hauteurs sont a retoucher (le RGB est assez sature).
- Mika : ajouter une platine, puis REMOVE DECK en haut a droite ; en lecture, appuyer deux fois.
- Les bandes d'un tres long mix (2 h) prennent environ 11 Mo de texture : a surveiller sur un vieux telephone.
- Toujours en suspens : les secrets SoundCloud du worker Sonaa, le defilement de la playlist au doigt sur iPhone, l'equilibre RYTM / ARP, brave://flags/#file-system-access-api sur Brave.

## 4. Commandes utiles ajoutees

- Aucune. Clavier du MM-DECKS : V change l'affichage des formes d'onde.
