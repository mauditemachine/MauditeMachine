# 2026-10-07 - Presets refaits par style, le kick en référence, MUTE/SOLO simple et double, boîtier du MM-BASS

Suite de la session du jour (rapport précédent : `2026-10-07-mm-bass-lock-edit-presets.md`). Mika a demandé :
- des presets refaits, fidèles aux styles dont ils portent le nom, avec ses samples pour les kicks et les snares ;
- des niveaux à sa façon : le kick en référence, tout le reste dessous (snare et clap trop forts) ;
- un MUTE (et un SOLO) à une voix sur un appui, à plusieurs voix sur deux appuis, l'écran qui montre la différence et le tip ;
- le boîtier du MM-BASS comme celui du MM-RYTM ;
- en light mode, une lueur des voix plus visible (elle tirait sur le jaune) ;
- le MUTE en rouge façon LED à travers le caoutchouc (le SOLO reste bleu) ;
- dans EDIT, changer la vélocité en maintenant le clic.

Les samples annoncés dans le message ne sont pas arrivés en pièce jointe : j'ai pris tes dix samples déjà sur le site (`public/samples/rytm`, 6 kicks, 4 snares).

## Ce qui a été fait

- **Presets d'usine** (`state/factory.ts`, réécrit) : les dix styles écrits à la main sur les trois machines, plus DEEP SUB à la basse. Plus aucune ligne tirée au hasard.
  - Pour chaque style, l'analyse de sa construction est dans l'en-tête du module : grille et dynamiques de la batterie, swing, kit, effets par voix ; ligne de basse, son, tonique ; patch du synthé, arpège, accords.
  - Kicks et snares : tes samples, choisis après analyse (hauteur, longueur, attaque). Les kicks sont accordés sur F#.
  - Basse : chaque ligne est écrite en 16 pas (`parseLine`). Dans les styles qui changent d'accord, la tonique suit les accords du MM-ARP.
  - Niveaux mesurés preset par preset : basse vers -6 dBFS, synthé vers -8,5 dBFS, snare + clap 1 à 3 dB sous le kick.
- **Niveaux, le kick en référence** :
  - `audio/shotsdsp.ts` : le kick est calé sur sa crête. Les autres voix gardent leur sonie, mais avec un plafond sous la crête du kick : snare 1,5 dB, clap 3,5, toms 3, hats 6, cymbale 7.
  - `audio/drums.ts` : la sortie du RYTM passe de -2 dB à 0 dB, c'est le rattrapage au master.
  - `bass/bass.worklet.js` : le SUB remplace une partie de l'oscillateur au lieu de s'y ajouter. La basse par défaut crête 2 dB sous le kick.
  - `audio/synth.ts` : l'ARP par défaut passe 4 dB sous le kick (il crêtait au-dessus).
- **MUTE / SOLO** :
  - `state/voices.ts` : le solo devient une liste, et chaque mode existe en version simple ou multiple.
  - `actions.ts` (`modeTap`) : un appui pour une voix, deux appuis en moins de 0,42 s pour plusieurs voix, un appui de plus pour tout remettre.
  - `scene/screen.ts` : en bas de l'écran du RYTM, le mode et son tip (MUTE 1 VOICE / 2X MUTE: SEVERAL, MULTI MUTE, MUTED BD SD / MUTE: ALL ON, pareil pour SOLO).
  - Libellés à jour : jumeaux, Dock, aria.
- **Couleurs des pads** :
  - `theme.ts` et `scene/pads.ts` : une voix mutée est rouge, sa LED allumée sous le caoutchouc (le dessus plus lumineux que les flancs, halo rouge), en sombre comme en clair.
  - En clair, le flash d'une voix qui joue passe le caoutchouc à l'orange franc.
  - `scene/sequencer3d.ts` : la LED de MUTE est rouge, celle de SOLO bleue.
- **EDIT, vélocité au maintien** (`ui/BeatEditor.tsx`, `v4.css`) : tenir une case 0,35 s, ou la glisser verticalement, règle sa vélocité au glisser haut/bas. Le niveau s'écrit dans la case. Taper et glisser le long d'une rangée marchent comme avant.
- **Boîtier du MM-BASS** (`dj/body.ts` `roundSlab`, `bass/rig.ts`) : le dessus du MM-RYTM, coins arrondis (0,2 + biseau 0,1), posé sur le coin. Plus de vis.
- `docs/v4/spec.md` : R14-200 à R14-205.

## Décisions prises et pourquoi

- **Choix des samples par style**, d'après l'analyse :

  | Sample | Caractère mesuré | Styles |
  |---|---|---|
  | BLUEPRINT | sol 1, court, attaque ronde | house, italo |
  | VNTM | fa 1, le plus court et le plus grave | minimal |
  | ENGELHARDT | le plus long, sans attaque, presque une 808 | techno, electro |
  | CARASSI | le plus claquant, queue rapide | acid, psy prog (queue coupée à 70 %), EBM |
  | STEIN | corps qui tient | dark disco |
  | AFFKT | le plus aigu, attaque nette | indie dance |
  | PSY 02 | corps rond | indie dance, techno, house |
  | PSY 12 | brillante et sèche | acid, minimal, psy prog |
  | PSY 26 | longue queue brillante, coupée par DECAY | EBM |
  | 707 | courte, années 80 | dark disco, electro, italo |

- **Les kicks accordés sur F#** (la tonalité de tes morceaux et des machines) : -1 demi-ton pour ceux en sol, +1 pour VNTM. Si tu préfères leur hauteur d'origine, TUNE à 0 dans OPEN.
- **Crêtes plutôt que sonie pour la hiérarchie** : c'est ta façon de travailler (faders sur des samples normalisés). Mais une crête seule aurait écrasé les hats et les sons très pointus, d'où le plafond plus la sonie : le plus bas des deux gagne.
- **Snare et clap superposés** : leurs vélocités ont été baissées dans les presets où les deux tapent ensemble, sinon leur somme dépassait le kick.
- **La basse 2 dB sous le kick** comme ton sub à -14. Dans les presets, le kick crête entre -2,3 et -4,2 dBFS selon son drive, la basse vers -6.
- **Pas de rattrapage sur le master général** : les platines du MM-DECKS (des morceaux déjà masterisés) y passent aussi. Le rattrapage est sur la sortie du RYTM.
- **La tonique de la basse suit l'ARP** dans les styles qui changent d'accord. Charger DARK DISCO sur les trois machines donne une basse qui suit F#m, D, E, F#m.
- **MUTE double** : le second appui doit venir en moins de 0,42 s après celui qui a armé le mode. Un appui pour sortir, suivi d'un autre très vite, ne repasse donc pas en multiple. La voix touchée juste avant MUTE (ta demande du 2026-10-04) se mute toujours tout de suite.
- **Le flash en clair** passe par la couleur du caoutchouc (comme OPEN), pas seulement par la lueur. Sur un caoutchouc presque blanc, la lueur seule virait au jaune pâle.
- **Vérifié, sans rien faire jouer** (?mute=1, Chromium muet, rendus hors ligne) :
  - MUTE et SOLO : les 23 cas du scénario ;
  - EDIT : tape, maintien, glisser, peinture et effacement d'une rangée ;
  - les 31 presets (10 RYTM, 10 ARP, 11 BASS) chargés un par un : kits, tempos, accords et lignes conformes ;
  - les niveaux mesurés ;
  - test de fumée desktop et téléphone sans erreur.
  - tsc : les 15 erreurs d'avant.

## Ce qui reste à faire / points en suspens

- **À écouter, côté Mika** (rien n'a été écouté ici) :
  - chaque preset sur les trois machines ensemble ;
  - l'équilibre kick, snare, clap, basse, ARP ;
  - les kicks accordés sur F#.
- **Les samples du message** : s'ils étaient différents des dix déjà sur le site, envoie-les (ou dépose-les dans `public/samples/rytm/bd` et `sd`) et je refais le choix par style.
- **À regarder** : le rouge des pads mutés et l'orange du flash en clair, le boîtier arrondi du MM-BASS.
- **Toujours en attente** : le compteur de visiteurs du MENU (quand tu dis go).
- **Licence des samples** (rappel du 2026-10-05) : les fichiers de `public/` se téléchargent depuis le site. Les presets les utilisent désormais, mais leur diffusion dépend de la licence des packs.

## Commandes utiles ajoutées

- Aucune commande npm.
- Pour écrire une ligne de basse dans un preset (`state/factory.ts`) : 16 jetons séparés par des espaces.
  - `.` : silence ;
  - `-` : liaison ;
  - un chiffre : le degré de la gamme (0 tonique, 2 tierce, 4 quinte, 6 septième) ;
  - suffixes : `+` octave au-dessus, `A` accent, `S` slide. Exemple : `0A 0 0+S 0 . 0 3A 0+S ...`.
