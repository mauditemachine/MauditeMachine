# 2026-11-25 : MM-ARP, banque d'usine refaite pour le dark disco (v53)

Retour de Mika sur la banque techno v52 : "pas fan du tout des presets", pas son style. "analyse quelques tracks que
j'aime beaucoup mais surtout quelque chose qui soit hypnotique... que je peux deformer a ma guise.. pour le dark disco
c'est souvent une note repetee .. ecoute les tracks de Damon Jee par exemple.. sinon des trucs qui peuvent se deriver
comme du disco Donna Summer par exemple ou Pablo Bozzi". Effets : "oui effets doses, pas beaucoup pour pas trop
denaturer le son.. faut que les presets soient des bons sons de base que je peux tweaker pour arriver a ce que j'aime
.. souvent c'est des notes style basslines". Choix : "mieux vaut avoir plus de choix que pas assez".

## 1. Ce qui a ete fait

- `plugin/mm-arp/presets/build.mjs` : la banque refaite, 80 presets (BASS 42, SEQ 20, LEAD 10, PAD 8), BPM 105 a 124
  (64 entre 115 et 123) ; en-tete avec les phrases de Mika, les familles, les regles d'effets ; les effets d'un preset
  passent par un champ `fx` (drive, glue, chorus, warmth, echo, verb) borne par analog.ts.
- `plugin/mm-arp/presets/factory.json`, `factory/NN NOM.mmarp` (80 fichiers), `volumes.json` : regeneres, volumes
  recales (-23 LUFS, PAD -24).
- `src/v4/plugin/arp/analog.ts` : la regle "AUCUN effet" devient "effets legers bornes" (`ANALOG_FX`, `ANALOG_STEPS`,
  `ANALOG_DL_OK`, les neutres des pages DELAY, sortie de reverbe et CHORUS) ; `analogFaults` verifie les plafonds,
  `analogTame` borne au lieu de couper, `analogRandomFx` tire les effets legers de RANDOM.
- `src/v4/plugin/arp/hypno.ts` : RANDOM pose ses effets doses et la page de chaque effet qui sonne (`randomSound`,
  `fxSet`) ; une basse sous le chorus passe en BASS MONO 0.9.
- `src/v4/plugin/arp/library.ts` : familles BASS, SEQ, LEAD, PAD ; `hood.css` : une colonne de LIBRARY de plus de 16
  noms defile (16 visibles, rien d'autre ne bouge dans la face).
- `plugin/mm-arp/tests/presets_render.cpp` : la chaine suit `buildFx` du plugin jusqu'au bout (page DELAY, reverbe et sa
  sortie, page CHORUS) ; bornes de timbre LEAD (250 a 1100 Hz) et PAD (200 a 1000 Hz). La banque v52 se rend identique
  (CSV compare).
- `plugin/mm-arp/tests/host_test.cpp` : le banc DELAY v27 compte toute la banque (80, 64 au moins) ; les 57 presets dont la
  page DELAY est l'ancien DELAY converti restent au bit pres, les 23 a page DELAY propre sont comptes a part.
- `plugin/mm-arp/tests/presets-check.mjs` : repartition v53, BPM 105 a 124, effets bornes, basses sans reverbe, BASS
  majoritaire, 64 presets au moins.
- `plugin/mm-arp/tests/random-analog.ts` : suit `randomSound` (les effets de RANDOM rendus et verifies).
- `plugin/mm-arp/tests/cpu_bench.cpp` : les scenes a l'arret suivent FIFTH DRONE et MUNICH GALLOP.

La banque :

| # | Nom | Famille | BPM | En une phrase |
|---|-----|---------|-----|---------------|
| 01 | REPEAT BASS | BASS | 122 | la note repetee en doubles croches, scie + sub dans le Moog, a sec |
| 02 | OFFBEAT REPEAT | BASS | 121 | trois doubles croches apres chaque kick, impulsion creuse dans le Korg |
| 03 | EIGHTH PULSE | BASS | 118 | croches new wave sur une note, scie resonante, chorus Juno, un peu de chaleur |
| 04 | LONG REPEAT | BASS | 120 | doubles croches longues, impulsion + carre, coupure qui respire sur 8 mesures |
| 05 | GHOST REPEAT | BASS | 119 | note forte, note fantome, silence, reprise ; impulsion dans le Korg resonant |
| 06 | OFFBEAT EIGHTHS | BASS | 122 | une note sur chaque "et", rien sur le kick, impulsion + sub, overdrive leger |
| 07 | CHUG BASS | BASS | 115 | doubles croches tres courtes qui "chuggent", Korg resonant, overdrive |
| 08 | THREE REPEAT | BASS | 119 | deux notes et un souffle, cycle de 3 contre la mesure, chorus Juno |
| 09 | SWING REPEAT | BASS | 116 | pluck swingue, carre + scie a l'octave, coupure qui balance sur 2 mesures |
| 10 | FIFTH REPEAT | BASS | 121 | racine x3 et la quinte en fin de temps, echo pointe discret |
| 11 | FALLING REPEAT | BASS | 118 | croches sur la racine, 4e temps qui tombe a la septieme, attaque douce, chaleur |
| 12 | SUB HYPNO | BASS | 120 | minimal : onde creuse sur gros sub, cycle de 3, racine et octave |
| 13 | MUNICH GALLOP | BASS | 124 | le galop munichois ecrit dans les notes (chaque croche doublee a la double croche) |
| 14 | MUNICH ECHO | BASS | 124 | croches droites + vrai echo a la double croche en ping-pong : le galop vient du delay |
| 15 | GALLOP BASS | BASS | 122 | galop "un, et, a" sur une note, scie resonante, chaleur, echo pointe |
| 16 | HI-NRG OCTAVES | BASS | 124 | octaves hi-NRG en doubles croches sans trou, carre court |
| 17 | ROLLING TRIPLETS | BASS | 121 | croches dont le contretemps roule en triolet, chorus Juno |
| 18 | DISCO OCTAVES | BASS | 119 | octaves disco en croches sur F#m, D, E, petit glisse |
| 19 | SPACE DISCO | BASS | 117 | scie + triangle racine/octave, chorus et echo pointe qui font flotter |
| 20 | STRUT BASS | BASS | 115 | demarche disco lente, syncopes, glisses, de l'air entre les notes |
| 21 | ITALO OCTAVES | BASS | 120 | la basse italo racine-racine-octave-racine, chorus, F#m D E |
| 22 | ITALO DOTTED | BASS | 118 | croches pointees 3-3-2 a l'octave, impulsion, chorus |
| 23 | ITALO RUNNER | BASS | 122 | paires d'octaves en doubles croches, carre + impulsion, chorus |
| 24 | COSMIC BASS | BASS | 116 | croches qui glissent (portamento), cosmic disco, chorus et chaleur |
| 25 | MIDNIGHT BASS | BASS | 113 | italo de nuit clairsemee, chorus, echo de bande pointe |
| 26 | BOWED FIFTHS | BASS | 120 | racine-quinte-octave en croches a attaque "archet", swing, coupure lente |
| 27 | RUBBER BASS | BASS | 122 | basse caoutchouc qui rebondit et glisse dans ses octaves, chorus |
| 28 | BOUNCE BASS | BASS | 123 | rebond body music, notes courtes racine/octave, carre resonant |
| 29 | BODY BOUNCE | BASS | 124 | melodie italo sur corps EBM, overdrive, echo court en ping-pong |
| 30 | ELASTIC BASS | BASS | 118 | croches elastiques, chaque note glisse dans la suivante |
| 31 | SLIDE OCTAVE | BASS | 121 | notes pointees qui glissent a l'octave et reviennent, chaleur |
| 32 | PWM BOUNCE | BASS | 123 | impulsion dont la largeur respire a la noire, rebond racine/octave |
| 33 | EBM SIXTEENTHS | BASS | 124 | doubles croches EBM entre les kicks, Korg dur, overdrive et colle |
| 34 | BODY BASS | BASS | 122 | croches EBM qui ne s'arretent jamais, octave en fin de mesure, colle |
| 35 | STEEL BASS | BASS | 120 | sequence body des annees 80 (racine, tierce, quinte), carre plus brillant |
| 36 | COLD BASS | BASS | 112 | cold wave : la basse jouee haute comme un lead, chorus, echo court |
| 37 | KNOCK BASS | BASS | 122 | "toc" boise (FM legere), motif brise pour la minimale |
| 38 | SYNC BASS | BASS | 120 | basse hard sync en paires de doubles croches, balayage sur 4 mesures |
| 39 | WALKING DISCO | BASS | 117 | ligne disco qui marche (racine, octave, quinte, sixte, septieme), F#m A Bm D |
| 40 | NEW BEAT BASS | BASS | 108 | new beat belge : croches a contretemps en caoutchouc, glisse vers la quinte |
| 41 | SLOW RUBBER | BASS | 105 | notes longues qui glissent entre racine et quinte basse, filtre qui s'ouvre |
| 42 | ACID NEW BEAT | BASS | 112 | acid lent une octave plus bas, resonance, glisses, echo dub |
| 43 | HYPNO SEQ | SEQ | 121 | ecole de Berlin, trois notes contre seize, coupure qui derive |
| 44 | REPEAT SEQ | SEQ | 122 | la note repetee dans le medium, pluck de deux scies, chorus |
| 45 | OCTAVE SEQ | SEQ | 120 | octaves en doubles croches dans le medium, echo pointe bas |
| 46 | ITALO ARP | SEQ | 118 | arpege italo de septiemes sur deux octaves, chorus |
| 47 | DARK ARP | SEQ | 116 | arpege sombre de trois notes qui descend, Korg |
| 48 | PLUCK SEQ | SEQ | 122 | pluck swingue sur les contretemps, echo pointe |
| 49 | BLEEP SEQ | SEQ | 123 | bleeps sinus/triangle secs, un echo a la noire |
| 50 | ECHO SEQ | SEQ | 119 | quatre notes par mesure, l'echo de bande ecrit le reste du motif |
| 51 | TRIPLET SEQ | SEQ | 117 | chaque croche jouee en triolet, carre dans le Korg, chorus |
| 52 | POLY SEQ | SEQ | 121 | cinq pas contre seize |
| 53 | RATCHET SEQ | SEQ | 123 | figure clairsemee qui begaie (ratchets) |
| 54 | SYNC SEQ | SEQ | 120 | figure hard sync balayee sur deux mesures |
| 55 | WOOD SEQ | SEQ | 122 | bois percussif (FM), notes laissees au hasard |
| 56 | GLASS SEQ | SEQ | 118 | plinks de verre en croches, echo a la noire pointee, petite piece |
| 57 | ACID SEQ | SEQ | 123 | ligne acide dans le medium pour poser sur une basse simple |
| 58 | DOTTED SEQ | SEQ | 120 | croches pointees ecrites dans les notes, neuf pas contre la mesure |
| 59 | MINOR ARP | SEQ | 115 | neuviemes mineures swinguees, chorus large, echo discret |
| 60 | CASCADE SEQ | SEQ | 112 | cascade lente de l'octave a la racine, echo de bande |
| 61 | PULSE SEQ | SEQ | 124 | impulsion repetee dont la largeur balaie sur deux mesures |
| 62 | DRIFT SEQ | SEQ | 110 | sequence lente qui derive, echo de cassette en triolet |
| 63 | DARK LEAD | LEAD | 118 | lead mono sombre qui glisse, chorus, echo a la noire pointee |
| 64 | SYNC LEAD | LEAD | 120 | lead sync mordant sans etre aigu, petit riff a l'octave |
| 65 | ITALO LEAD | LEAD | 122 | accroche italo, impulsion, chorus large, echo pointe |
| 66 | BRASS STAB | LEAD | 121 | stab de cuivres synthe (deux scies), F#m vers A |
| 67 | MINOR STAB | LEAD | 123 | stab mineur (racine + tierce mineure), syncopes |
| 68 | ORGAN STAB | LEAD | 122 | orgue house sur chaque "et" |
| 69 | FIFTH STAB | LEAD | 119 | stab de quintes sur chaque contretemps, echo pointe bas |
| 70 | SEVENTH STAB | LEAD | 117 | stab de septieme mineure, deux longs accords par mesure, petite piece |
| 71 | HOOK LEAD | LEAD | 116 | accroche simple de deux mesures a developper, echo de bande |
| 72 | WHISTLE LEAD | LEAD | 114 | lead triangle qui siffle, vibrato leger, petite piece |
| 73 | STRING PAD | PAD | 118 | machine a cordes, chorus large, attaques lentes |
| 74 | DARK PAD | PAD | 115 | nappe sombre de septiemes, filtre ferme qui bouge sur 4 mesures |
| 75 | PULSE PAD | PAD | 120 | nappe qui pulse en doubles croches (neuviemes) |
| 76 | BREAK PAD | PAD | 118 | pour le break, septiemes lentes, petite piece |
| 77 | FIFTH DRONE | PAD | 120 | quinte grave tenue, niveau qui pulse en croches |
| 78 | CHOIR PAD | PAD | 112 | choeur doux de triangles, septiemes lentes, petite piece |
| 79 | TAPE PAD | PAD | 110 | nappe usee, arpege lent, echo de bande qui pleure, chaleur |
| 80 | NIGHT DRONE | PAD | 116 | drone sombre racine + octave, coupure et resonance qui derivent |

## 2. Decisions prises et pourquoi

### Ce que la recherche a donne (lu, pas ecoute)

- Damon Jee : veteran francais du dark disco, il prefere "dark, indie disco", ses racines electroclash, cold wave, new
  wave, de New Order a Nine Inch Nails ([Beatportal](https://www.beatportal.com/beatport-news/a-guide-to-dance-musics-devious-new-genre-dark-disco/)) ;
  en interview, les memes deux synthes font sa basse depuis des annees, la basse est la partie "mecanique", le travail
  creatif vient apres (Form Music, d'apres l'extrait de recherche : la page renvoie 404) ; tempos lus 117 a 126 BPM
  ([Beatport](https://www.beatport.com/track/overawed/9507491), [Beatport](https://www.beatport.com/track/dancing/15618237/)),
  mediane vers 121 ([Mixgraph](https://www.mixgraph.io/artists/damon-jee)). D'ou : la note repetee en doubles croches ou
  en croches, peu de notes, un filtre qui bouge lentement, 115 a 122 BPM.
- "I Feel Love" (1977) : la basse ecrite avant la melodie, un Moog modulaire cale sur une piste de synchro ; chaque note
  doublee par un delai (sec a gauche, echo a droite : l'effet stroboscopique), charleston en bruit blanc, kick joue
  ([Wikipedia](https://en.wikipedia.org/wiki/I_Feel_Love), [Sound On Sound](https://www.soundonsound.com/techniques/classic-tracks-donna-summer-feel-love)) ;
  recette de reconstitution : 126.5 BPM, scie + carre + impulsion en 16', coupure vers 30 %, enveloppe 40 %, sustain 0,
  declin 200 a 250 ms, delai a la double croche 100 % mouille, panoramique oppose
  ([MusicRadar](https://www.musicradar.com/artists/one-day-in-berlin-eno-came-running-in-and-said-i-have-heard-the-sound-of-the-future-how-to-replicate-the-trailblazing-pulse-of-i-feel-love)) ;
  une autre : 125 BPM, croches sur les pas impairs, coupure 600 Hz, delai 120 ms
  ([MusicRadar](https://www.musicradar.com/news/donna-summer-i-fee-love-best-synth-sound)). D'ou MUNICH GALLOP (le galop
  ecrit dans les notes) et MUNICH ECHO (le vrai echo a la double croche).
- Pablo Bozzi : "Italo Body Music", melodies italo sur le beat brutal de l'EBM ([Flow Festival](https://flowfestival.com/en/artists/pablo-bozzi),
  [set79](https://set79.com/dj/Pablo%20Bozzi)) ; MiniBrute pour les "hard basses and sequence effects", effets (chorus,
  echo, reverbe) sur les leads plutot que sur les basses ([Arturia](https://www.arturia.com/stories/pablo-bozzi)) ; 120 a
  135 BPM ([Mixgraph](https://www.mixgraph.io/artists/pablo-bozzi)). D'ou les basses qui rebondissent a l'octave, courtes et
  dures (BODY BOUNCE, BOUNCE BASS, RUBBER BASS), et peu d'effets sur les basses.
- EBM : basses sequencees repetitives ([Wikipedia](https://wikipedia.com/wiki/Industrial_dance)) ; "16th notes between the
  kicks", groove par la velocite, octaves doublees, kick court ([KVR](https://www.kvraudio.com/forum/viewtopic.php?p=8989615)).
- New beat : Belgique fin des annees 80, EBM et italo ralentis vers 100 a 115 BPM, basses sombres en caoutchouc
  ([Wikipedia](https://en.wikipedia.org/wiki/New_beat), [melodigging](https://www.melodigging.com/genre/new-beat)).
- Italo et hi-NRG : basse d'octave sequencee, 110 a 125 BPM, syncopes en croches pointees, scie ou carre facon Juno
  ([bonedo](https://www.bonedo.de/artikel/italo-disco-dolce-vita-der-vintage-synthesizer), [MusicRadar](https://musicradar.com/news/beginners-guide-italo-disco)) ;
  basses qui sautent d'octave, galops de Bobby O, Patrick Cowley ([Wikipedia](https://en.wikipedia.org/wiki/Bobby_Orlando),
  [Reverb](https://reverb.com/news/the-synths-of-disco)).
- Dark disco en general : 80 a 130 BPM, grooves qui "chuggent", tonalites mineures ; Curses : "sexy dark", racines EBM et
  new beat ([Beatportal](https://www.beatportal.com/beatport-news/a-guide-to-dance-musics-devious-new-genre-dark-disco/)).
- Rien de precis trouve sur Red Axes, Rodion ou Kiko (le reste vient de ma connaissance du genre).

### Les choix

- 80 presets, BASS majoritaire (42) : "mieux vaut avoir plus de choix", "souvent des notes style basslines". Familles
  BASS, SEQ, LEAD, PAD (les quatre colonnes de LIBRARY, l'exemple de la demande). Noms courts sans artiste ni morceau.
- Des sons de base : coupure le plus souvent entre 0.4 et 0.5, ENV AMT 0.25 a 0.42, resonance moderee, declins au milieu
  de leur course, un accord (ou deux qui bougent peu dans le grave). Un geste rythmique par preset.
- Le galop munichois existe deux fois : ecrit dans les notes (MUNICH GALLOP) et par un vrai echo a la double croche
  (MUNICH ECHO : monter DELAY pour le galop complet, le baisser pour des croches seules).
- Effets doses, regle nouvelle (analog.ts `ANALOG_FX`) : OVERDRIVE 0.25 au plus (style MM de la DISTO, la saturation du
  moteur), GLUE 0.3, CHORUS I ou II (le Juno ; I+II jamais), WARMTH 0.3 ; DELAY (MIX) 0.3 au plus, cale au tempo (SYNC,
  1/16, 1/8 ou 1/4, droit, pointe ou triolet), style TAPE, ANALOG ou DIGITAL, mode SINGLE, DUAL ou PING-PONG, FEEDBACK
  0.45, WOBBLE 0.35, LOW CUT et HIGH CUT seulement pour couper, DUCKING 0.6, le reste de la page a son neutre ; REVERB
  0.18 au plus, CLASSIC seule, courte (SIZE 0.4 : 1.8 s), sombre (TONE 0.5), PRE DELAY 40 ms, LOW CUT de sa sortie permis,
  jamais sur une basse. Toujours a l'arret : OLD TAPE, SIDECHAIN, PHASER, FLANGER, PUMP, CRUSH, SHIMMER, HELL, RING, FOLD,
  HIGH PASS, COMB, l'EQ, le MASTER (sauf WARMTH), la matrice. Le filtre et le registre gardent les regles v43.
- Dans la banque : 32 presets secs ; chorus I sur 17, II sur 3 ; 23 echos (MIX 0.3 au plus, FEEDBACK 0.42 au plus) ;
  5 reverbes (0.14 au plus) ; overdrive sur 5 (0.2 au plus) ; glue sur 3 ; warmth sur 7 (0.25 au plus).
- Une basse sous le chorus a BASS MONO 0.9 (243 Hz), 1.0 pour WALKING DISCO et COLD BASS : le chorus ne touche pas le
  grave.
- RANDOM suit les memes plafonds : il tire parfois un chorus, un echo cale au tempo, une reverbe CLASSIC courte (jamais
  sur une basse), un peu de WARMTH ; jamais d'OVERDRIVE ni de GLUE (la page DISTO de l'instance peut etre sur un autre
  style que MM). Quand un effet sonne, sa page entiere est posee ; un effet a l'arret garde sa page.
- SUR KICK : beaucoup de basses jouent aussi sur le kick (mediane 51 %, v52 : 0 %) : la note repetee continue du dark
  disco le veut ; SIDECHAIN reste a la main de Mika.
- Le bas-medium (120-500 Hz, 30 % au moins) etait la contrainte la plus dure pour des basses sur une seule note grave :
  impulsions, resonance moderee ou un deuxieme oscillateur ; la diversite (D 2.4, DS 1.6) a ete tenue en donnant a chaque
  basse une signature (largeur, enveloppe, filtre, mouvement) ; seuils inchanges.
- presets_render rend maintenant la chaine du plugin jusqu'au bout (la page DELAY, la reverbe et sa sortie, la page
  CHORUS) ; la banque v52 se rend identique (CSV compare).
- host_test : un preset a page DELAY propre (echo a la double croche, triolet, sa reinjection) n'a pas d'ancien DELAY a
  comparer ; les 57 autres restent au bit pres.
- LIBRARY : seulement de quoi afficher une colonne de 42 (elle defile) ; la refonte du choix des presets est l'autre
  chantier. Les noms "NN NOM.mmarp" vont jusqu'a 99 ; le program change MIDI n'est pas lie a la banque (getNumPrograms 1)
  ; la liste des presets du grand ecran est celle du site (non touchee).

### Mesures (CLASSIC HQ x8, 8 mesures, aucun son joue)

| | v52 | v53 |
|---|---|---|
| Presets | 40 | 80 |
| BPM | 124 a 132 | 105 a 124 (64 entre 115 et 123) |
| Sonie | -23 LUFS | -23 a -23.5 (PAD -24) |
| Crete max | -3.3 dBFS | -3.1 dBFS |
| Part au-dessus de 6 kHz (max) | 0.07 % | 0.06 % |
| Centroide BASS (mediane, plage) | 167 Hz (152 a 247) | 188 Hz (150 a 326) |
| Bas-medium (min) | 30.9 % | 30.4 % |
| BASS : sub sous 100 Hz (mediane) | 34 % | 37 % |
| BASS : 200-400 Hz (mediane / max) | 16 % / 30 % | 17.5 % / 38 % |
| BASS : cote sous 120 Hz (max) | 4.8 % | 4.2 % |
| BASS : SUR KICK (mediane) | 0 % | 51 % |
| Diversite D / DS min (CLASSIC x4, x8) | 2.40 / 1.66 | 2.41 / 1.65 |
| Diversite D / DS min (PRO STD) | 2.40 / 1.66 | 2.42 / 1.65 |

RANDOM (48 tirages, graine fixe) : tous dans les regles ; 35 avec au moins un effet leger (chorus 12, echo 13,
reverbe 12, warmth 18), 13 secs ; crete -2.2 dBFS au plus, au-dessus de 6 kHz 0.17 % au plus.

## 3. Ce qui reste a faire / points en suspens

- Ecoute de Mika (rien n'a ete ecoute ici, tout est juge par mesures) : `MM-ARP presets v4 (ecoute)` dans le scratchpad
  de la session et son zip : 80 MP3 seuls, 80 avec kick 4/4 (6 LU sous le synthe) et charleston ouvert sur les
  contretemps (12 LU sous le synthe), et "00 TOUTE LA BANQUE + kick.mp3" (2 mesures de chaque, 5 min 24).
- Publication (plugin-arp.yml) apres fusion ; la ligne "Etat" de CLAUDE.md parle encore de la banque v52 (techno seche,
  BASS / ACID / SEQ / CHORD) et de la regle "banque d'usine seche" : a mettre a jour a la fusion (effets legers bornes,
  80 presets, BASS / SEQ / LEAD / PAD) ; une section au journal `docs/reports/2026-11-09-plugin-mm-arp.md` a la
  publication.
- LIBRARY : la colonne BASS defile (CSS seul) ; PREV / NEXT ne la font pas defiler jusqu'au preset charge : a reprendre
  dans le chantier du choix des presets.
- Non lances ici : cpu_bench (cible JUCE non construite ; presets_render donne au plus 17 % d'un coeur en HQ x8 pour les
  nappes), mod_test, le build VST3 macOS. La face se construit (`npm run plugin:arp:web`), le defilement de LIBRARY n'a pas
  ete regarde a l'ecran.
- Les presets d'un projet Ableton ne bougent pas ; seuls les noms de LIBRARY changent (ceux de v52 n'existent plus).

## 4. Commandes utiles ajoutees

- `node plugin/mm-arp/presets/build.mjs` puis `plugin/mm-arp/presets/calibrate.sh` puis
  `plugin/mm-arp/tests/presets-render.sh` (inchanges ; le champ `fx` d'un preset pose ses effets doses).
- `plugin/mm-arp/build-presets/presets_render plugin/mm-arp/presets/factory.json --pro --os 2` : le controle PRO STD.
- `node plugin/mm-arp/tests/random-analog.mjs <sortie.json> 48` : RANDOM avec ses effets legers, verifie par analogFaults.
- Fichiers d'ecoute : WAV par `presets-render.sh --wav <dossier> --csv <mesures.csv>`, puis un script d'encodage
  (kick + charleston synthetises, ffmpeg, aucun son joue) ; le script de cette session est dans le scratchpad (non
  versionne).
