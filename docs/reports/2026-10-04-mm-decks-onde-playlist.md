# 2026-10-04 : MM-DECKS, forme d'onde et playlist

## 1. Ce qui a ete fait

- Forme d'onde fine qui defile sur l'ecran de chaque platine, tete de lecture au centre, partie jouee plus pale, hot cues en orange et CUE en jaune, avec la piste entiere dessous (`dj/waveform.ts`).
- Dessinee par la carte graphique : l'energie du morceau (400 tranches par seconde, normalisee) est posee une fois dans une texture, chaque image ne change que des uniformes ; un draw call pour les quatre bandes (`dj/math.ts` energy, `dj/engine.ts`).
- Zoom de 1 a 64 secondes : touches - et + sur l'ecran, molette, pincement a deux doigts ; glisser sur la forme d'onde la fait defiler (en pause, un grain se fait entendre pour poser le cue), toucher la piste entiere y va, toucher le texte ouvre la playlist (`dj/gestures.ts`, `dj/actions.ts`, `dj/screens.ts`, kind `djscreen` dans `scene/hit.ts`).
- Playlist posee sous les platines (desktop : une bande en bas ; telephone : sous la platine cadree), AUDIUS et MY FILES, recherche, touches A et B ; LOAD l'agrandit et vise la platine, un choix la replie (`dj/TrackBrowser.tsx`, `dj/dj.css`).
- Le cadrage remonte au-dessus de la playlist et sous l'en-tete : `Stage.setDjInset(bas, haut)`, marge interpolee pendant le zoom d'une machine a l'autre (`scene/renderer.ts` updateCamera).

## 2. Decisions prises et pourquoi

- Energie plutot que cretes : un morceau masterise touche le plafond presque partout, l'onde en cretes etait un bloc blanc ; en energie, grosses caisses et breaks se lisent.
- GPU plutot que canvas : redessiner et renvoyer l'atlas a chaque image coutait plusieurs Mo par image ; ici rien ne transite pendant la lecture.
- En lecture, glisser la forme d'onde fait sauter la piste au lacher (pas de son haché pendant le geste) ; en pause, le scrub s'entend.
- La playlist remplace l'ancienne liste en surimpression, comme sur sonaa.ca.

## 3. Ce qui reste a faire / points en suspens

- Jumeaux HTML et raccourcis clavier du MM-DECKS.
- Caisse persistante (IndexedDB) et dossiers relies (Chrome) : les fichiers vivent le temps de la visite.
- Grille des temps sur la forme d'onde (il faudrait detecter le premier temps).
- Mika : essayer avec `?dj=1`, desktop et iPhone.

## 4. Commandes utiles ajoutees

- Aucune. Debug : `__v4.dj.state.get().deck.a.zoom`, `__v4.stage.setDjInset(px, top)`.
