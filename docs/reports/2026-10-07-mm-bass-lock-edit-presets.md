# 2026-10-07 - MM-BASS : LOCK, EDIT, styles électro et presets d'usine ; cadrage desktop

Suite de la session du jour (rapport précédent : `2026-10-07-sampler-decks-mm-bass.md`). Mika a demandé cinq choses :
- arriver plus zoomé en desktop sur les machines de la taille du MM-RYTM, en voyant toujours la machine de droite ;
- les firmwares : V3 sur le RYTM, V2.3 sur l'ARP, V1 sur la BASS ;
- des presets de styles électro différents, pas juste Disco ;
- un bouton EDIT sur le MM-BASS ;
- des boutons au-dessus de chaque pas du MM-BASS pour régler ce pas seulement, les paramètres changeant à son passage (les parameter locks d'Elektron).

## Ce qui a été fait

- `scene/renderer.ts` : une machine seule en desktop est cadrée de face. Sa vraie largeur occupe 80 % de l'écran, au lieu de la largeur vue à 45°, et le MM-RYTM prend sa hauteur vue de face : environ un tiers plus grand. La voisine dépasse de 52 px (au lieu de 36), plus près du bord, toujours cliquable.
- Les firmwares :
  - `theme.ts` : MM-RYTM V.3.0 (en-tête et plaque arrière) ;
  - `voyager/theme.ts` et `voyager/backplate.ts` : MM-ARP V.2.3 ;
  - `bass/rig.ts` : MM-BASS V.1.0, avec le sous-titre BASSLINE GENERATOR.
- `state/factory.ts` (nouveau) : les presets d'usine. Les mêmes dix styles sur les trois machines (ACID, DARK DISCO, INDIE DANCE, MINIMAL, PSY PROG, TECHNO, HOUSE, ELECTRO, EBM, ITALO), plus DEEP SUB sur la basse.
  - RYTM : motif, tempo, swing, effets et son du kit.
  - ARP : arpège, filtre, effets et progression.
  - BASS : son, générateur et une ligne dans le style.
- `state/presets.ts` et `state/presetMode.ts` : le MM-BASS devient une machine à presets. Les presets d'usine suivent ceux de Mika (titre FACTORY, sans NAME ni DEL).
- `bass/params.ts`, `bass/gen.ts`, `bass/seq.ts` : STYLE passe à onze styles électro, chacun avec ses règles et la durée de ses notes. Corrigé au passage : SUB faisait des lignes de 18 pas.
- `bass/patterns.ts` (nouveau), `state/editor.ts` : EDIT comme sur le MM-RYTM. Seize lignes en mémoire, changement à la mesure, chaîne, copie en tenant un emplacement vide.
- Les verrous (LOCK) :
  - `bass/state.ts` : chaque pas garde ses verrous ;
  - `bass/actions.ts` : LOCK, EDIT, patterns ;
  - `bass/bass.worklet.js` et `bass/engine.ts` : chaque note emporte les verrous de son pas, appliqués au passage.
- La machine 3D et ses commandes :
  - `bass/theme.ts` et `bass/rig.ts` : la touche EDIT, seize boutons LOCK au-dessus des pas (desktop et téléphone), leurs LED, l'écran tactile des presets ;
  - `bass/screen.ts` : les pages LOCK, EDIT et PRESETS en noir et os ;
  - `bass/gestures.ts`, `bass/keys.ts`, `bass/Twins.tsx`, `bass/midi.ts` : souris et doigt, clavier (E EDIT, L LOCK, Maj + 1 à 8 pour les pas 9 à 16, Échap), jumeaux, MIDI (`bass:lock:<n>`, `bass:lock`).
- `midi/roto.ts` : la page 4 du setup BASS prend LOCK et EDIT. `docs/midi/*` régénérés : 423 cibles, 6 setups.
- `ui/OverviewHelp.tsx` : l'aide du MM-BASS. `scene/hit.ts` : les zones `basslock` et `basslcd`.
- `docs/v4/spec.md` : R14-194 à R14-198.

## Décisions prises et pourquoi

- **Le cadrage se fait de face, plus à 45°.** L'ancien cadre prévoyait le pire cas, la machine tournée à 45°, alors qu'on arrive de face. Tournée à la souris, la machine peut maintenant déborder un peu, comme au téléphone. À 80 % de largeur, la voisine a encore la place de dépasser.
- **« Pas juste Disco » s'applique à toutes les machines.** Le sélecteur STYLE du MM-BASS passe à onze genres, et les trois machines reçoivent des presets d'usine aux mêmes noms. Charger DARK DISCO sur le RYTM, l'ARP et la BASS donne un morceau qui tient. Les styles suivent ce que Mika joue d'abord : dark disco, indie dance, minimal, psy prog.
- **Les lignes d'usine du MM-BASS sont tirées une fois pour toutes** (hasard à graine fixe) : la même ligne revient à chaque chargement.
- **EDIT fait comme sur le MM-RYTM**, la machine de même format : les seize pas deviennent seize patterns. Les réglages d'un pas passent par les boutons LOCK.
- **LOCK suit les parameter locks d'Elektron.** Le bouton au-dessus d'un pas en fait la cible. Les dix potards du son ne changent alors que ce pas. Les potards du générateur et OCTAVE restent globaux : ils ne s'entendent pas pas à pas.
- **Les verrous partent avec la note.** Le worklet les pose juste avant la note, parce que la décroissance et l'accent en dépendent, puis revient aux potards à la note suivante sans verrou. Une liaison verrouillée change le son de la note qui continue.
- **E reste EDIT sur toutes les machines.** Les pas 9 à 16 passent donc sur Maj + 1 à 8 au clavier, au lieu de Q à I.

## Ce qui reste à faire / points en suspens

- Mika, à essayer :
  - LOCK : un bouton au-dessus d'un pas, tourner CUTOFF ou DECAY, puis RUN pour l'entendre au passage ;
  - EDIT : tenir un emplacement vide pour copier, taper deux patterns pour les chaîner ;
  - les presets : toucher l'écran de chaque machine et passer les styles ;
  - le nouveau cadrage desktop.
- Les tests ont tourné son coupé. Le son des presets et des verrous reste à juger à l'oreille.
- Mika : réimporter le setup BASS du Roto sur le SETUP 15 (page 4 : LOCK et EDIT).
- Toujours en attente : le compteur de visiteurs du MENU.

## Commandes utiles ajoutées

- Aucune nouvelle commande npm.
- Avec `?debug=1` : `window.__v4.bass` (state, params, engine, seq) ; `presets.list('bass')` donne aussi les presets d'usine.
