# MM-RYTM, installation sur Mac (VST3)

## Mettre a jour (le plugin est deja installe)

1. Dans le Terminal, rien a telecharger avant :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rytm/update.sh | bash
```

   Le script (`update.sh`) telecharge le dernier build vert (la release **mm-rytm** du depot, que le CI de cette branche remplace a chaque build vert ; mm-rytm-latest, que d'autres branches peuvent ecraser avec un MM-RYTM ancien, n'est plus la bonne adresse) et ecrase `/Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3` (ou celui de `~/Library` s'il n'y a que lui). Il affiche le commit et l'heure du build. Il refait aussi la commande de l'etape 3 : rien a debloquer. Le mot de passe demande est celui de ta session Mac.
2. Quitte Ableton s'il etait ouvert et rouvre-le (Option + Rescan si le plugin n'apparait pas).

Un artefact telecharge a la main (onglet **Actions**) s'installe pareil : `bash update.sh ~/Downloads/MM-RYTM-macOS.zip` (`update.sh` est dans l'artefact).

## Premiere installation

1. La commande de « Mettre a jour » installe aussi la premiere fois (dans `/Library/Audio/Plug-Ins/VST3/`). A la main : la page **Releases** du depot, **MM-RYTM (dernier build)**, `MM-RYTM-macOS.zip` (ou l'onglet **Actions**, workflow **Plugin MM-RYTM**, artefact **MM-RYTM-macOS**, a dezipper deux fois) : tu obtiens un dossier `MM-RYTM` avec `MM-RYTM.vst3` et ce fichier.
2. Copie `MM-RYTM.vst3` dans `~/Library/Audio/Plug-Ins/VST3/` (ou `/Library/Audio/Plug-Ins/VST3/`, a cote de tes autres VST3).
3. Le plugin est signe "ad hoc", sans compte Apple Developer : macOS le bloque ("was blocked to protect your Mac"). Le bouton **Open Anyway** des Reglages ne fait rien pour un plugin, et ce message y reste affiche meme une fois le plugin debloque : ne t'y fie pas. Ce qui a marche sur le Mac de Mika (2026-11-08) : effacer tous les attributs du telechargement et re-signer le plugin sur le Mac lui-meme.

```bash
P=~/Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3; [ -d "$P" ] || P=/Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3; sudo xattr -cr "$P" && sudo codesign --force --deep --sign - "$P" && echo "OK : $P"
```

   Le mot de passe demande est celui de ta session Mac. A refaire a chaque nouvelle version du plugin.

4. Quitte Ableton (Cmd + Q) et rouvre-le. Reglages > Plug-ins, "Use VST3 Plug-in System Folders" active, puis **Option + clic sur Rescan** (un rescan complet : Live oublie qu'il avait vu le plugin bloque).
5. Dans le navigateur : **Plug-Ins > Maudite Machine > MM-RYTM** (le dossier du fabricant, rang M, au-dessus de Plugin Alliance). Glisse-le sur une piste MIDI.

## Utilisation

- **La face** : c'est ta machine du site, la meme (touches, potards, ecran, pages TRIG / SRC / FLTR / AMP / FX / MOD, presets, banques). Le son vient du plugin, jamais de la page.
- **Lecture** : le transport d'Ableton fait jouer le pattern, cale a la mesure. Ableton arrete, PLAY de la face lance l'horloge interne (au tempo de TEMPO), STOP l'arrete.
- **MIDI** : un clip MIDI joue les 16 pistes, une note par piste (les 16 pads d'un Drum Rack, C1 a D#2 ; la table plus bas, a DRAG MIDI) : 36 BD, 38 SD, 42 CH, 46 OH, 39 CP, 45 TOM, 50 HT, 49 CY (GM), puis 37 BD2, 40 SD2, 44 CH2, 47 OH2, 43 CP2, 41 TOM2, 48 HT2, 51 CY2 ; 35 joue aussi le BD. La velocite compte.
- **Le projet** : tout ce que tu regles dans la face (pattern, sons, banques, presets) est sauve dans le projet Ableton, et le plugin joue meme fenetre fermee.
- **La face (2026-11-09, facon Digitakt II)** : la fonction orange de chaque touche est imprimee dessous (Quantize sous TRIG, Perform sous la liste...). Clic droit sur une touche = FUNC + la touche (cette fonction orange). Les touches a icone : liste = PRESET, de = RANDOM, engrenage = SETTINGS, onde = SOUNDS, metronome = TEMPO ; le survol dit leur nom. Ni KEYBOARD ni PAGE dans le plugin : un pattern fait 16 pas, une page.
- **Les fleches** : la face n'en a plus (le crossfader A / B a pris leur place) ; quatre fleches cliquables sous l'ecran, a gauche, font ce que font les fleches du clavier : la sous-page (SRC 1/2 et 2/2...), une ligne d'une liste. Tenues, elles se repetent.
- **L'ecran** : chaque reglage a son dessin en noir et blanc (la vraie forme d'onde de ton sample dans STRT et LEN, la saturation de DIST, les echos de DELAY, la queue de REVERB, l'escalier de BIT, la courbe du COMP, le PAN, les LFO...). Les cases libres montrent : le sample en grand avec START et la fin (SRC, page 2/2), la chaine des effets de la piste (FX, page 2/2), les 16 pas de la piste et sa longueur TLEN (TRIG 2/2), le swing sur une mesure (TEMPO).
- **NEW et CLEAR** (OPEN, onglet PATTERN · MIDI, avec une confirmation) : **NEW** = un preset vierge sur le pattern qui est sur la face (aucun pas, les 16 pistes sur le premier sample de leur type avec leurs reglages de depart, FX globaux a zero, swing droit, aucune scene, aucun mute) ; **CLEAR** = le pattern se vide (pas, P-LOCK, reglages de trig), les sons, les FX et les scenes restent. Cmd+Z dans la machine annule l'un ou l'autre. (FUNC + PLAY, Clear sur la face, reste le CLEAR de la machine : la rangee de la piste en REC.)
- **La pattern en clip MIDI (DRAG MIDI)** : dans **OPEN**, la poignee jaune **DRAG MIDI** (en haut, sur chaque onglet, et en grand dans l'onglet PATTERN · MIDI, avec le pattern, ses mesures et ses notes). Glisse-la sur une piste MIDI d'Ableton (ou sur un Drum Rack) : le pattern qui joue devient un clip, avec ses velocites, le swing, uTIME, les longueurs (LEN), les retrigs, la longueur par piste (TLEN) et les conditions (PROB et A:B : un tirage, comme un enregistrement ; FILL ne joue pas). Le clip fait un cycle entier en mesures (une piste de 3 pas dans 16 : 3 mesures). Un clic (sans glisser) ou **SAVE .MID** : le fichier dans Musique / MM-RYTM MIDI, montre dans le Finder.
  - Les notes, facon Drum Rack (les 16 pads de C1 a D#2) : BD C1 (36), BD2 C#1 (37), SD D1 (38), CP D#1 (39), SD2 E1 (40), TOM2 F1 (41), CH F#1 (42), CP2 G1 (43), CH2 G#1 (44), TOM A1 (45), OH A#1 (46), OH2 B1 (47), HT2 C2 (48), CY C#2 (49), HT D2 (50), CY2 D#2 (51). Les huit premieres sont les notes GM : un kit d'Ableton les joue a leur place.
  - Le MM-RYTM lit la meme table en entree MIDI : un clip exporte, pose sur sa piste, rejoue les 16 pistes (coupe alors son pattern, sinon tout joue deux fois).
- **Les niveaux** (OPEN, onglet PATTERN · MIDI) : le niveau reel de chaque piste et de la sortie L et R, du moteur (un pic tenu, rouge et CLIP au 0 dB).
- **La fenetre** : tire son coin, la machine grandit avec ton ecran (les proportions restent) ; la taille reste avec le projet.
- **OPEN en blanc** : tout le panneau passe en clair (le rouge des choix, le jaune orange des titres et de l'enveloppe) ; CLOSE, Echap ou OPEN revient a la machine.
- **Le parameter lock (P-LOCK)** : **clic droit sur un pas** (le pas devient jaune, LOCK en haut de l'ecran), puis tourne les potards : chaque reglage tourne ne vaut que pour ce pas, sur la piste choisie (le bloc passe en negatif avec un P). Clic droit sur le meme pas (ou Echap) pour sortir ; clic droit sur un autre pas pour y passer. Sur un pas vide, tourner un potard y pose le coup avec son verrou. CLEAR en P-LOCK retire les verrous du pas.
- **La souris dans l'ecran** : un clic choisit une ligne, un second clic la valide, la molette defile, clic droit = NO ; ses valeurs se tirent.
- **OPEN** : l'editeur de sample et les reglages, par-dessus la face ; **CLOSE**, Echap ou OPEN le referment. Deux onglets :
  - **SAMPLE** : le sample de la piste choisie en grand (les 16 pistes en haut). Tire **S** (START) et **E** (la fin) a la souris, **Maj** pour le reglage fin ; la molette zoome, un glisser deplace la vue, un double clic la remet entiere. Ce qui ne joue pas est en retrait, le fondu de la fin en orange, et la ligne orange est l'enveloppe AMP (ATK, HOLD, DEC) a son echelle de temps. ◀ ▶ : le sample d'avant ou d'apres (du type de la piste), LISTEN : le plugin joue la piste, REVERSE, RESET, IMPORT, FOLDER. Dessous : START, LEN, TUNE, FINE, LEV, PLAY ; ATK, HOLD, DEC, PAN ; FREQ, RESO, TYPE, ENV ;
  - **SETTINGS** : STEPS (1 a 16), BPM (l'horloge interne), SWING, MASTER ; PERSONALIZE (TRK SELECT, les LED, la sous-page) ; le dossier des samples (OPEN FOLDER, RESCAN) ; la souris et les touches ; la version.
  Les potards : glisser ; **Maj + glisser = le reglage fin** ; double clic = la valeur de depart.
- **Le niveau d'une piste au crossfader** : sur la page **SRC**, le bloc **LEV** (potard H) est le niveau de la piste (le meme que LEVEL/DATA et le MIXER ; 102 = 0 dB). Tape **Scene A** ou **Scene B** (elle s'allume), tourne LEV, retape la scene : le crossfader mene alors le niveau de cette piste de A a B, en temps reel, et Ableton peut l'automatiser (le parametre Crossfader). Clic droit sur un pas puis LEV : le niveau de ce pas seulement (P-LOCK).
- **La vue** : la machine est vue droit du dessus, a plat.
- **Le mixer** : clique **FUNC** une fois (les touches montrent leur fonction en orange), puis **MOD** (MIXER) ; ou clic droit sur MOD. Les potards A a H = le niveau des pistes 1 a 8 ; FUNC + MOD encore = pistes 9 a 16, encore = la page SCENES. LEVEL/DATA regle le meme niveau pour la piste choisie, et la case en haut a gauche de l'ecran le montre.
- **Un niveau dans une scene** : tape **B** (la scene B est gardee, la touche s'allume), tourne le potard de la piste dans le MIXER (par exemple le BD plus fort), retape B. Le crossfader passe alors du niveau d'avant (A) a celui de la scene B ; idem avec A. Le potard montre la plage A-B en bleu, le bloc porte un petit B.
- **Le crossfader (scenes A / B)** : il joue dans le moteur, fenetre fermee comprise. Dans Ableton, c'est le parametre **Crossfader** du plugin : automatisable dans un clip ou l'arrangement, et mappable a ton APC mini ou ton Roto (bouton **Configure** de l'appareil, puis bouge le crossfader de la face ; ou MIDI Map). Quand Ableton le bouge, celui de la face suit.
- **Les pistes** : chaque piste a un type fixe, celui de son numero (1 BD, 2 SD, 3 CH, 4 OH, 5 CP, 6 TOM, 7 HT, 8 CY ; 9 a 16 : les memes une seconde fois, BD2 a CY2), ecrit sur son pas. Elle ne joue que des samples de ce type (page SRC, potard D SAMP, ou SOUNDS) : pas de synthese. La case en haut a gauche de l'ecran dit la piste choisie et son sample.
- **Tes samples** : le dossier **~/Music/MM-RYTM Samples** (dans Musique), un sous-dossier par type (bd, sd, ch, oh, cp, tom, ht, cy), cree au premier lancement. Deux facons :
  - glisse tes fichiers (WAV, AIFF, FLAC, MP3, 30 s au plus) dans le bon sous-dossier au Finder, puis ferme et rouvre la fenetre du plugin ;
  - ou, sur la face : choisis la piste, SOUNDS, descends a **+ LOAD A FILE...**, YES : le choix de fichiers du Mac s'ouvre, les fichiers sont copies dans le dossier du type de la piste et le premier devient son sample. **FUNC + OPEN** (+ Sample, clic droit sur OPEN) fait la meme chose d'un geste ;
  - **FUNC + SOUNDS** (Samples, clic droit sur SOUNDS) : tes samples, IMPORT FILES, OPEN FOLDER IN FINDER, RESCAN FOLDER ; YES sur un sample le pose sur la piste choisie (de son type). OPEN, onglet SAMPLE : ◀ ▶ parcourt les samples du type, IMPORT et FOLDER.
  Ils apparaissent dans SOUNDS et SAMP (marques USER) et jouent fenetre fermee. Un projet garde le nom du sample : sur un autre Mac, mets le meme fichier dans le meme dossier.
- **La longueur par piste** : page TRIG deux fois (TRIG 2/2), potard E **TLEN**. PTN = la longueur du pattern ; sinon la piste boucle sur ses propres pas (par exemple des hats sur 12 et une perc sur 7 dans un pattern de 16), sans repartir a chaque tour du pattern.
- **Les patterns depuis Ableton** : un clip MIDI choisit le pattern avec son **Pgm** (dans la vue du clip, la case Pgm : 1 = A01, 2 = A02 ... 17 = B01 ... 128 = H16). Le changement tombe a la fin du pattern en cours, comme sur une Digitakt (tout de suite si Ableton est arrete). Un clip d'arrangement par section = ton SONG. Sur la face : PTN puis une touche choisit le suivant, plusieurs touches dans les 2 s font une chaine ; la face montre le pattern que joue le plugin.
- **Le sequenceur des trigs** : conditions (FILL en tenant YES, PRE, NEI, 1ST, A:B), PROB, uTIME, LEN, RETRIG, lock trigs, et le crossfader A / B jouent.
- **Le son** : filtres, effets (TONE, DIST, CHORUS, DELAY, REVERB, GLUE, LIMITEUR) et les deux LFO de chaque voix jouent comme au site.
- **Pas encore dans le plugin** (la face les montre, ils ne sonnent pas encore) : chaines de patterns, SONG, multi-out. Voir README.md.
