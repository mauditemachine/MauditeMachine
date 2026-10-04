# 2026-10-04 : menu mobile, RANDOM du MM-ARP, qualite d'ecoute

## 1. Ce qui a ete fait

- MM-ARP : RANDOM change tout le patch (arpegiateur, oscillateurs, filtre, enveloppes, effets ; VOLUME garde) en plages musicales, plus une progression (`voyager/random.ts`, `actions.ts`).
- Menu mobile plein ecran : pages en grands titres numerotes, pastilles du capot, six reseaux, grand bouton OPEN THE MACHINE, Reset view et Dark / Light ; arrivee ligne par ligne (`ui/MobileHeader.tsx`, `v4.css`).
- Curseur : la main de lien sur les potards, survoles ou tournes, plus de doubles fleches (`ui/Hotspots.tsx`).
- Qualite : le MM-ARP sort du compresseur de la batterie (plus de pompage a chaque kick), volume recale (`audio/drums.ts`, `audio/synth.ts`) ; TONE recalcule les one-shots a leur hauteur au lieu de les reechantillonner (`audio/shots.ts`) ; chorus en AudioWorklet a interpolation sinc 16 points (`audio/chorus.worklet.js`, `audio/chorus.ts`).
- Menu desktop : le bouton MENU ouvre le meme menu plein ecran que le telephone, mis a l'echelle (titres a gauche jusqu'a 96 px, capot, reseaux et pied a droite) ; un seul composant pour les deux (`ui/MenuSheet.tsx`, `ui/Header.tsx`, `ui/MobileHeader.tsx`, `v4.css`).
- MM-RYTM : clap adouci (5.5 dB plus bas, moins sature) ; RANDOM tire un style 4x4 (house, tech house, techno, minimal, indie dance, prog, electro) et le TONE et le VOLUME de chaque voix (`audio/beats.ts`, `audio/shotsdsp.ts`, `actions.ts`).
- MM-ARP : volumes OSC 1 et OSC 2 (a la place de MIX), filtre multimode LP 24 / LP 12 / BP / HP (a la place de SLOPE), section MOD (LFO cale sur le tempo : SPEED, SHAPE avec S&H, TARGET, DEPTH), RANDOM les tire aussi ; panneau desktop sur trois rangees, telephone a huit potards par rangee, GLIDE dans l'arpegiateur (`audio/moog.worklet.js`, `audio/synth.ts`, `voyager/params.ts`, `voyager/theme.ts`, `voyager/silk.ts`, `voyager/knobs.ts`, `voyager/random.ts`, `ui/Hotspots.tsx`).
- MM-ARP : hierarchie des potards (cinq tailles, CUTOFF en heros, arcs imprimes facon Typhon autour des moyens et petits), compositions desktop et telephone refaites (`voyager/theme.ts`, `voyager/silk.ts`, `voyager/params.ts`).
- Deck (troisieme machine, session Sonaa) : partage convenu ; la session Sonaa generalise 2 -> N machines dans sa branche, je fusionnerai et soignerai l'accueil (onglets, volet, vue d'ensemble, menu, Dock).
- MM-DECKS fusionne sur main (branche decks-3d de la session Sonaa, f5b3ef0), cache derriere ?dj=1 ; correction de typage a la fusion (`dj/engine.ts`).
- Accueil de MM-DECKS : code charge a part avec ?dj=1 seulement (chargement principal 20.7 kB gzip plus leger), rig accroche apres coup, gestes et molette pour tout le MM-DECKS, menu sans OPEN sur les platines, vignettes du volet a trois (`state/djload.ts`, `scene/renderer.ts`, `ui/Hotspots.tsx`, `index.tsx`, `debug.ts`, `ui/MenuSheet.tsx`, `v4.css`).
- MM-DECKS publie pour tout le monde (Mika : "publie Deck sans le drapeau") : `state/focus.ts` l'affiche par defaut, ?dj=0 le retire ; forme d'onde et playlist de la session Sonaa fusionnees (e7fed35) ; `public/llms.txt` le nomme.
- MM-ARP, filtre : la position MOOG nommee sur le commutateur MODE (le passe-bas 24 dB d'origine, par defaut), RANDOM la tire deux fois sur trois (`voyager/params.ts`, `voyager/random.ts`, `voyager/theme.ts`).
- MM-ARP : plus d'arcs imprimes autour des potards, les couronnes jaunes de WAVE 1 et WAVE 2 restent (`voyager/silk.ts`, `voyager/theme.ts`).
- MM-ARP : la suite de l'arpege modifiable note par note, AUTO ou EDIT, 1 a 16 pas, silences ; panneau sous la machine sur desktop, page SEQUENCE du Dock au telephone (`voyager/seq.ts`, `voyager/chords.ts`, `voyager/arp.ts`, `ui/SeqLane.tsx`, `ui/VoyDock.tsx`, `voyager/rig.ts`, `actions.ts`, `index.tsx`, `v4.css`) ; `scene/renderer.ts` : setInset par machine (la playlist du MM-DECKS y passe aussi).
- MM-DECKS lit l'AIFF (et les WAV que le navigateur refuse) : `dj/decode.ts`, branche dans `dj/engine.ts` (chargement) et `dj/crate.ts` (analyse) ; message clair pour l'ALAC et les fichiers iTunes proteges.
- Boutons EDIT sur les machines : la suite du MM-ARP cachee par defaut, ouverte par EDIT (bouton du plateau, touche E) ; MM-RYTM : pad EDIT au-dessus d'OPEN, editeur du motif avec velocites sur neuf niveaux (`state/editor.ts`, `ui/editorPanel.ts`, `ui/BeatEditor.tsx`, `audio/pattern.ts`, `audio/beats.ts`, `audio/house.ts`, `theme.ts`, `scene/pads.ts`, `voyager/theme.ts`, `voyager/pads.ts`, `ui/Hotspots.tsx`, `ui/VoyTwins.tsx`, `hooks/useKeys.ts`) ; le Dock du telephone reprend sa forme d'avant.
- `docs/v4/spec.md` : R14-59 a R14-76.

## 2. Decisions prises et pourquoi

- Les one-shots restent ceux calcules (choix de Mika).
- RANDOM : un hasard borne plutot que 0 a 1 partout, sinon une moitie des patchs serait inaudible (filtre ferme, attaque de 2 s) ; VOLUME exclu pour ne jamais faire sauter le niveau.
- Menu : plein ecran plutot qu'une carte : sur telephone le menu est une page, la scene derriere n'apporte rien ; les reseaux remplissent le vide et servent.
- Qualite : les trois points ou le navigateur degradait encore le son (le compresseur commun, le reechantillonnage lineaire, les retards modules lineaires) ; la reverbe (reponse stereo decorrelee) et le limiteur etaient deja propres. Les morceaux SoundCloud restent compresses par SoundCloud (hors de notre portee).
- Menu desktop : la barre de liens disparait au profit du bouton MENU (comme au telephone, demande de Mika) ; Dark / Light passe dans le menu.
- MM-ARP : un LFO plutot qu'une simple option de plus, parce que c'est lui qui fait bouger le son d'une note a l'autre (le S&H surtout, sur un arpege) ; le filtre multimode prend la place du commutateur de pente (LP 24 et LP 12 y restent) ; la troisieme rangee du panneau desktop existait deja (le bas du panneau etait vide).
- Interpolation sinc plutot qu'Hermite : mesure faite, Hermite perd encore pres de 3 dB a 16 kHz dans le pire cas.
- Velocites du RYTM sur neuf niveaux plutot que trois : les crans d'avant (9, 6, 3) gardent leurs gains, un motif enregistre sonne pareil ; l'appui sur la machine garde son cycle fort, moyen, doux.
- Suite de l'arpege en degres de fa diese mineur au-dessus de la racine de l'accord, plutot qu'en notes fixes : la meme suite suit la progression et ne sort jamais de la tonalite ; AUTO joue exactement les notes d'avant (verifie sur les 8 accords). Barres a dessiner plutot qu'une grille de 21 notes : tient dans le Dock du telephone (20 px par pas a 16 pas). MODE, RANGE et NOTES repassent en AUTO (ce sont eux qui fabriquent la suite) ; la suite EDIT reste en memoire, EDIT la rappelle.

## 3. Ce qui reste a faire / points en suspens

- MM-DECKS : fait (code a part, menu, volet, onglets verifies). Vue d'ensemble a 55 appels de dessin, c'est la somme des trois machines (desktop seulement) : laisse tel quel. Publie sans drapeau le 2026-10-04 (?dj=0 le retire). Cote Sonaa restent : jumeaux HTML et clavier des platines, IndexedDB.
- Mika : essayer RANDOM sur les deux machines (styles 4x4, MOD, MODE du filtre), juger le clap.
- Mika : ecouter aux IE900 (chorus a fond sur l'arpege, charleys transposes avec TONE, arpege et kick ensemble), juger le nouveau menu sur son iPhone, essayer RANDOM.
- Mika : essayer EDIT sur les deux machines (suite de l'arpege, motif et velocites du RYTM), le filtre MOOG, et dire si les arcs manquent nulle part.
- Sonaa (brief envoye) : jog sans le A et plus dans le style MM, potards plus gros, FILTER orange, DISTO devient OVERDRIVE (nom et son), pitch fin (123.4 atteignable).
- Sonaa : la playlist du MM-DECKS perd le cadrage remonte apres un changement Dark / Light (la scene est recreee) ; signale.
- Pour l'ecoute : sortie du Mac a 48 kHz (Configuration audio et MIDI) ; un DAC externe pour les IE900 plutot que la prise du Mac.

## 4. Commandes utiles ajoutees

- Aucune. Debug : `__v4.audio.shots()` (cache et calculs des one-shots), `__v4.audio.comp` (reglages du compresseur de la batterie).
