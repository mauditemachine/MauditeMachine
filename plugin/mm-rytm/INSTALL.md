# MM-RYTM, installation sur Mac (VST3)

## Mettre a jour (le plugin est deja installe)

1. Telecharge l'artefact **MM-RYTM-macOS** du dernier run vert (onglet **Actions**, workflow **Plugin MM-RYTM**). Pas besoin de le dezipper.
2. Dans le Terminal :

```bash
curl -fsSL https://raw.githubusercontent.com/mauditemachine/MauditeMachine/claude/intelligent-ride-56tyeo/plugin/mm-rytm/update.sh | bash
```

   Le script (`update.sh`, aussi dans l'artefact) prend le build MM-RYTM le plus recent de `~/Downloads`, zippe ou deja ouvert, et ecrase `/Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3` (ou celui de `~/Library` s'il n'y a que lui). Il refait aussi la commande de l'etape 3 : rien a debloquer. Le mot de passe demande est celui de ta session Mac.
3. Quitte Ableton s'il etait ouvert et rouvre-le (Option + Rescan si le plugin n'apparait pas).

## Premiere installation

1. Sur GitHub : onglet **Actions**, workflow **Plugin MM-RYTM**, dernier run vert, artefact **MM-RYTM-macOS**. Dezippe-le, puis dezippe `MM-RYTM-macOS.zip` : tu obtiens un dossier `MM-RYTM` avec `MM-RYTM.vst3` et ce fichier.
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
- **MIDI** : un clip MIDI joue les pistes 1 a 8 en notes GM : 36 BD, 38 SD, 42 CH, 46 OH, 39 CP, 45 TOM, 50 HT, 49 CY (et leurs voisines GM). La velocite compte.
- **Le projet** : tout ce que tu regles dans la face (pattern, sons, banques, presets) est sauve dans le projet Ableton, et le plugin joue meme fenetre fermee.
- **La souris** : l'ecran se clique (un clic choisit une ligne, un second clic la valide, la molette defile, clic droit = NO) et ses valeurs se tirent. Clic droit sur une touche = FUNC + la touche.
- **Le sequenceur des trigs** : conditions (FILL en tenant PAGE ou YES, PRE, NEI, 1ST, A:B), PROB, uTIME, LEN, RETRIG, lock trigs, et le crossfader A / B jouent.
- **Le son** : filtres, effets (TONE, DIST, CHORUS, DELAY, REVERB, GLUE, LIMITEUR) et les deux LFO de chaque voix jouent comme au site.
- **Pas encore dans le plugin** (la face les montre, ils ne sonnent pas encore) : chaines de patterns, SONG, multi-out. Voir README.md.
