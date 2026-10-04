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
- `docs/v4/spec.md` : R14-59 a R14-70.

## 2. Decisions prises et pourquoi

- Les one-shots restent ceux calcules (choix de Mika).
- RANDOM : un hasard borne plutot que 0 a 1 partout, sinon une moitie des patchs serait inaudible (filtre ferme, attaque de 2 s) ; VOLUME exclu pour ne jamais faire sauter le niveau.
- Menu : plein ecran plutot qu'une carte : sur telephone le menu est une page, la scene derriere n'apporte rien ; les reseaux remplissent le vide et servent.
- Qualite : les trois points ou le navigateur degradait encore le son (le compresseur commun, le reechantillonnage lineaire, les retards modules lineaires) ; la reverbe (reponse stereo decorrelee) et le limiteur etaient deja propres. Les morceaux SoundCloud restent compresses par SoundCloud (hors de notre portee).
- Menu desktop : la barre de liens disparait au profit du bouton MENU (comme au telephone, demande de Mika) ; Dark / Light passe dans le menu.
- MM-ARP : un LFO plutot qu'une simple option de plus, parce que c'est lui qui fait bouger le son d'une note a l'autre (le S&H surtout, sur un arpege) ; le filtre multimode prend la place du commutateur de pente (LP 24 et LP 12 y restent) ; la troisieme rangee du panneau desktop existait deja (le bas du panneau etait vide).
- Interpolation sinc plutot qu'Hermite : mesure faite, Hermite perd encore pres de 3 dB a 16 kHz dans le pire cas.

## 3. Ce qui reste a faire / points en suspens

- MM-DECKS : fait (code a part, menu, volet, onglets verifies). Vue d'ensemble a 55 appels de dessin, c'est la somme des trois machines (desktop seulement) : laisse tel quel. Publie sans drapeau le 2026-10-04 (?dj=0 le retire). Cote Sonaa restent : jumeaux HTML et clavier des platines, IndexedDB.
- Mika : essayer RANDOM sur les deux machines (styles 4x4, MOD, MODE du filtre), juger le clap.
- Mika : ecouter aux IE900 (chorus a fond sur l'arpege, charleys transposes avec TONE, arpege et kick ensemble), juger le nouveau menu sur son iPhone, essayer RANDOM.
- Pour l'ecoute : sortie du Mac a 48 kHz (Configuration audio et MIDI) ; un DAC externe pour les IE900 plutot que la prise du Mac.

## 4. Commandes utiles ajoutees

- Aucune. Debug : `__v4.audio.shots()` (cache et calculs des one-shots), `__v4.audio.comp` (reglages du compresseur de la batterie).
