# MM-RYTM, le plugin

La boite a rythmes du site (`src/v4`, le MM-RYTM) en VST3 pour macOS, avec la vraie face du site. Usage perso.

## Architecture (2026-11-08)

- **La face** : la machine du site elle-meme (scene three.js, touches, potards, ecran), seule, vue de dessus, dans une WebView JUCE. Entree `src/v4/plugin/` (mode `PLUGIN` de `src/v4/theme/base.ts`), page `plugin/mm-rytm/web/index.html`, build `npm run plugin:web` vers `plugin/mm-rytm/build-web` (zip embarque dans le VST3).
- **Le son** : en C++ (`dsp/`), jamais dans la WebView. Le plugin joue fenetre fermee et pendant un export d'Ableton.
- **Le pont** (`src/v4/plugin/bridge.ts`) : la face compile un *programme* avec les fonctions du site (`resolveHit` de `audio/drums.ts`, `tracks.tweakWith`) : les sons de chaque piste, chaque coup de chaque pas avec sa hauteur, son DECAY, son gain, son PAN, son START. Le C++ le joue sans rien interpreter (`dsp/Program.h`, `dsp/Engine.cpp`).
- **L'etat** : les cles `mm.v4.*` du localStorage du site (motif, pistes, banques, presets...) sont gardees dans le projet Ableton avec le programme ; a l'ouverture de la fenetre, la face les reprend avant de se charger (`src/v4/plugin/restore.ts`).
- **Le transport** : celui d'Ableton ; PLAY de la face lance l'horloge interne quand Ableton est arrete. La tete de lecture de la face suit le C++ (`src/v4/plugin/head.ts`).

## Ce qui joue (phases 1 a 3)

| | Etat |
| --- | --- |
| Sons : 9 moteurs, 909 / 808 / MM, GATE, couche SAMPLE (tes samples), STRETCH | identique bit a bit au site (`tests/compare.cpp`, 29 cas) |
| 16 pistes, pas 1 a 64, pages, page bouclee, swing, velocites | joue |
| Verrous de pas (hauteur, DECAY, VOL, PAN, START, son d'un autre kit) | joue (resolus par la face) |
| ENV : ATK, HOLD, DECAY ; PAN ; kick mono ; choke CH / OH ; 4 voix par piste | joue (`tests/engine_test.cpp`) |
| MUTE, SOLO, mute du pattern | joue |
| Pads, touches, notes MIDI GM d'Ableton | joue |
| Conditions (FILL, PRE, NEI, 1ST, A:B, NOT), PROB, uTIME (en avance aussi), LEN, RTRG (RATE, VFAD, RLEN) | joue (phase 2, port de `audio/seq.ts`, `tests/engine_test.cpp`) |
| Lock trigs : VOL (rapporte au LEVEL du coup), PAN, FREQ, RESO du coup qui sonne, a l'echantillon pres, glissement 1 ms ; envois et inserts de la tranche ; LFO.T | joue (`audio/drums.ts` lockTrigOn) |
| Crossfader A / B (scenes, facon Octatrack) | joue dans le moteur, en temps reel et fenetre fermee : la face compile le programme a 9 positions (x = 0, 1/8 ... 1), le C++ interpole entre les deux voisines (coups, tranches, niveau des pistes qui sonnent, effets globaux ; la hauteur et le son : la position la plus proche ; la forme de la REVERB : quand x se pose). Parametre **Crossfader** d'Ableton : automatisable, mappable a un controleur ; la face le suit |
| Latence | l'avance du LIMITEUR (3 ms) declaree a Ableton, qui la compense |
| FLTR du coup (passe-bas, passe-haut, passe-bande, enveloppe) | joue (formules du BiquadFilterNode) |
| Tranche de piste : TONE, DIST, CHORUS (l'algorithme du worklet), envois DELAY et REVERB, leurs verrous | joue (`dsp/Fx.cpp`) |
| Bus des pads (DIST, TONE, CHORUS, envois globaux) et du kick (DIST, TONE), LEVEL, garniture 0.84 | joue, au niveau du site |
| DELAY (boucle LP / HP 180 Hz), REVERB (la reponse du site, identique bit a bit, convolution par blocs : 256 echantillons de latence sur le retour) | joue |
| Master : GLUE (BIT, COMP et AUTO), LIMITEUR -0.3 dBFS | joue |
| LFO (les deux par voix) : SPD, MULT, FADE, 7 formes, 5 modes (FRE, TRG, HLD, ONE, HLF), LFO.T ; en continu PITCH, FREQ, RESO, VOL, PAN (les courbes du site : 24 points par cycle, 2 a 40 ms, 8 s, 512 rampes) ; au coup DIST, DELAY, REVERB, TONE, DECAY | joue (phase 3 bis, `dsp/Lfo.h` identique au site sur 4000 cas, `tests/engine_test.cpp`) |
| Patterns (128 emplacements, A01 a H16) | joues par le moteur, fenetre fermee comprise : la face compile chaque emplacement rempli ; le suivant (PTN puis TRIG), la chaine (des tapes dans les 2 s) et un **program change** d'Ableton (le Pgm d'un clip : 1 = A01, 17 = B01...) jouent a la fin du pattern en cours, tout de suite a l'arret ; la face suit le pattern que joue le moteur |
| Pistes typees (2026-11-08) | chaque piste a son type, la famille de son rang (1 a 8 : BD SD CH OH CP TOM HT CY, 9 a 16 : BD2 a CY2) ; machine ONESHOT seulement (des samples, aucune synthese) ; SAMP ne propose que les samples de son type ; le menu MACHINE et la case MACH de SRC ne changent rien (`audio/tracks.ts` TYPED_TRACKS, mode plugin seulement) |
| Longueur par piste (TLEN) | TRIG 2/2, potard E : PTN (celle du pattern) ou 1 a la longueur du pattern ; la piste boucle sur sa longueur depuis le debut du pattern, sans repartir avec lui (polymetrie DT2 / OT) ; gardee avec le pattern |
| Samples perso (2026-11-08) | le dossier `~/Music/MM-RYTM Samples/<famille>/` du Mac (bd, sd, ch, oh, cp, tom, ht, cy ; cree au premier lancement) : WAV, AIFF, FLAC, MP3, 30 s au plus ; relu a chaque ouverture de la fenetre ; + LOAD A FILE... de SOUNDS ouvre le choix de fichiers du Mac et les copie dans le dossier du type de la piste. Cle `<famille>/~<fichier>` ; lus par le moteur (`src/SampleBank.cpp` UserLibrary), fenetre fermee comprise. La banque synthetisee du site (JS) n'est pas dans le plugin (son moteur ne la joue pas) |
| Mixer et niveaux dans les scenes (2026-11-09) | FUNC + MOD (clic droit sur MOD) : MIXER 1-8, encore : 9-16, encore : SCENES. Dans le plugin, le niveau d'une piste est son VOL (m:<piste>) : le MIXER, LEVEL/DATA et la case de l'ecran le reglent et le montrent ; une scene armee l'enregistre, le crossfader le mene (moteur : la tranche aux 9 positions). Un TRK LEV d'avant passe dans le VOL au chargement, au meme gain |
| La face facon Digitakt II (2026-11-09) | fonctions FUNC imprimees sous les touches, touches a icones, pas numerotes et soulignes ; le crossfader A / B a la place des fleches (dans leur cadre, le logo M dessus), les LED au-dessus de PAGE ; quatre fleches cliquables sous l'ecran ; KEYBOARD joue (le coup part au moteur avec sa hauteur) |
| Plugin sans KEYBOARD ni PAGE (2026-11-09) | un pattern de 16 pas, une page (`audio/pattern.ts` MAX_STEPS) ; la colonne gauche FUNC TRK PTN MUTE SOLO calee sur les rangees ; le crossfader prend toute la largeur |
| P-LOCK au clic droit (2026-11-09) | clic droit sur un pas : P-LOCK garde sur lui (sans REC), les potards y ecrivent leurs verrous ; encore : il en sort (`actions/locks.ts` stepLockRight) |
| L'ecran du plugin (2026-11-09) | `scene/screen/pluginGfx.ts` : un dessin par reglage (forme d'onde reelle du sample, DIST, CHORUS, DELAY, REVERB, BIT, COMP, TUNE, FINE, PAN, LFO, uTIME, LFO.T, TLEN, NOTE, BPM, MASTER) ; les cases libres en grand dessin (le sample, la chaine des effets, les pas de la piste, le swing) |
| La 3D du plugin (2026-11-09) | camera penchee de 16 deg, champ de 20 deg (`theme.ts` PLUGIN_VIEW) ; touches, pas et potards plus hauts (`rytm/faceplate.ts` RELIEF) ; les clics dans l'ecran par le rayon de la camera (`renderer.ts` screenUV) |
| OPEN (2026-11-09) | l'editeur de sample et les reglages, par-dessus la face (`src/v4/plugin/OpenPanel.tsx`) : SAMPLE (la forme d'onde du sample de la piste, START et END a la souris, zoom, REVERSE, l'enveloppe AMP dessinee, le sample d'avant ou d'apres, LISTEN, IMPORT ; les reglages SAMPLE, AMP, FILTER) ; SETTINGS (STEPS, BPM, SWING, MASTER, PERSONALIZE, le dossier, l'aide) ; CLOSE, Echap ou OPEN le ferment. FUNC + OPEN : + Sample ; FUNC + SOUNDS : Samples |
| DRAG MIDI (2026-11-09, dans OPEN depuis le 2026-11-10) | la poignee DRAG MIDI d'OPEN (`src/v4/plugin/OpenPanel.tsx`, `mm_drag_midi` : le glisser du Mac part de l'evenement souris courant, `performExternalDragDropOfFiles` dans `src/PluginEditor.cpp` ; `mm_save_midi`, `mm_midi_info`, `mm_midi_status`) : le pattern qui joue glisse vers Ableton en fichier MIDI (format 0, 960 ticks), rejoue par `dsp/MidiExport.cpp` comme le moteur (velocites, swing, uTIME, LEN, RTRG, TLEN, conditions et PROB tirees, mute, lock trigs sans note), un cycle entier en mesures ; les notes sur les 16 pads d'un Drum Rack (C1 a D#2, GM pour les huit premieres), la meme table pour l'entree MIDI ; un clic : SAVE dans ~/Music/MM-RYTM MIDI |
| NEW et CLEAR (2026-11-09) | dans OPEN (onglet PATTERN · MIDI), confirmes dans le panneau, faits par la face ( `actions/patterns.ts` pluginNew, pluginClear) : un preset vierge (pattern vide, kit de depart des 16 pistes, FX globaux a zero, sans scene ni mute) ou le pattern vide (les sons restent) ; une etape d'UNDO (Cmd+Z) |
| Mini ecran et VU-metres (2026-11-10) | `src/v4/scene/miniScreen.ts` a la place du logo M (rytm/faceplate.ts PLUGIN_MINI) ; les cretes du moteur par piste (`dsp/Fx.cpp` takePeak, `Engine::fbPeak`) et de la sortie (`PluginProcessor::takeMeters`, apres MAIN VOLUME), `mm_meter` a 30 Hz tant que ca sonne ; la balistique dans `src/v4/plugin/meters.ts` |
| Fenetre agrandissable (2026-11-10) | `setResizable` + proportions fixes (840 a 2400 px de large), la largeur gardee dans l'etat (`uiW`) |
| Look du plugin (2026-11-10) | la machine noire, les touches et pads gris blanc de la machine claire (`theme.ts` applyAppearance, KEYS_LIGHT, PLUGIN_KEYS), le rouge des pas, le jaune orange (PLUGIN_AMBER) de FUNC, PLAY, OPEN, des fonctions imprimees et de la tete de lecture ; OPEN en blanc |
| Un stockage par instance (2026-11-10) | `src/v4/plugin/restore.ts` : `window.localStorage` en memoire par instance, rempli par l'etat du projet ; la bibliotheque (presets, PERSONALIZE) reste commune |
| SONG (hors des clips d'Ableton), multi-out | a venir |

Ecarts connus des LFO : en mode FRE, le LFO suit la position du morceau d'Ableton (au site : depuis PLAY ; identique quand on lance au debut, et un export donne le meme son ou qu'il commence) ; TONE mene par un LFO passe par le TONE de la tranche (comme les verrous de TONE du plugin), pas par un nouveau calcul du coup.

## La face dans le plugin (plus simple qu'au site)

- L'ecran se clique : les listes (presets, SETTINGS, SOUNDS...) a la souris, un clic choisit, un second clic (ou un double clic) valide, la molette defile, un clic droit revient (NO). Les valeurs de l'ecran se tirent a la souris.
- Clic droit sur une touche = FUNC + la touche (sa fonction orange), sans tenir FUNCTION.
- SETTINGS ne garde que PATTERN, PERSONALIZE et ABOUT.
- Les pistes typees se voient (2026-11-08) : chaque pas porte le type de sa piste sous son numero (BD ... CY, BD2 ... CY2) ; la case en haut a gauche de l'ecran dit la piste choisie (T1, BD, le sample) ; SOUNDS et SAMP ne listent que les samples du type, nommes par leur fichier (BD 12), sans synthese ni + LOAD A FILE ; SRC n'a ni MACH ni LOOP (pas encore joue).
- Le site, lui, revient a la V.3.0 par defaut (la machine d'avant le crossfader ; les autres au selecteur de versions) ; le plugin est toujours en V.6.0.

## Commandes

Tests du DSP (Linux ou Mac, sans JUCE) :

```bash
cmake -S plugin/mm-rytm -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j
```

```bash
./build-dsp/mm_engine_test && node plugin/mm-rytm/tests/render-ref.mjs build-dsp/ref && ./build-dsp/mm_compare build-dsp/ref public/samples/rytm
```

La face, puis le plugin sur un Mac (Xcode et CMake installes ; JUCE est telecharge par CMake) :

```bash
npm ci && npm run plugin:web
```

```bash
cmake -S plugin/mm-rytm -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release -j --target MM_RYTM_VST3
```

Mettre a jour le plugin installe, sur le Mac : `update.sh` telecharge le dernier build (la release `mm-rytm`, remplacee par le CI a chaque build vert ; `mm-rytm-latest` peut etre ecrasee par une autre branche), l'ecrase dans `/Library/Audio/Plug-Ins/VST3` et le re-signe (voir `INSTALL.md`) :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rytm/update.sh | bash
```

Sinon, GitHub Actions le construit a chaque push qui touche `plugin/`, `src/v4/` ou les samples (workflow `plugin.yml`), en artefact et dans les releases `mm-rytm` et `mm-rytm-latest` : voir `INSTALL.md`.

## Regles

- Un changement de son sur le site (`shotsdsp.ts`, `sampledsp.ts`, `stretch.ts`) relance le workflow : la comparaison echoue tant que `dsp/Shots.cpp` n'a pas suivi.
- Le mode plugin du site ne s'active qu'avec `window.__MM_PLUGIN__` (la page du plugin) ou `?plugin=1` : le site ne change pas.
