# MM-RAGE, installation sur Mac (VST3)

MM-RAGE, un plugin Maudite Machine, dans la famille de MM-RYTM, MM-ARP et MM-HELL : la DISTO du MM-ARP (façon Decapitator) en effet seul. Douze styles de saturation (tubes, transistors, transformateur, bande, fuzz, diode, ampli, redresseur, replieur, bit crusher), MORPH entre deux styles, jusqu'à trois bandes, dynamique, feedback, filtres avant et après, caisse, enveloppe et LFO.

## Installer ou mettre à jour

1. Dans le Terminal, rien à télécharger avant :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rage-latest/update.sh | bash
```

   Le script (`update.sh`) télécharge le dernier build vert (la release **mm-rage-latest** du dépôt, que le CI remplace à chaque build) et l'installe dans `/Library/Audio/Plug-Ins/VST3/MM-RAGE.vst3` (ou remplace celui de `~/Library` s'il n'y a que lui). Il affiche le commit et l'heure du build, retire la quarantaine et re-signe le plugin sur ton Mac (sans compte Apple Developer, macOS le bloquerait sinon). Le mot de passe demandé est celui de ta session Mac.
2. Quitte Ableton s'il était ouvert (Cmd + Q) et rouvre-le. Réglages > Plug-ins, "Use VST3 Plug-in System Folders" activé, puis **Option + clic sur Rescan** la première fois.
3. Dans le navigateur : **Plug-Ins > Maudite Machine > MM-RAGE**. Glisse-le sur une piste audio, un groupe, une piste de retour, ou après un instrument.

Un artefact téléchargé à la main (onglet **Actions**, workflow **Plugin MM-RAGE**, artefact **MM-RAGE-macOS**) s'installe pareil : `bash update.sh ~/Downloads/MM-RAGE-macOS.zip` (`update.sh` est dans l'artefact).

Si macOS dit encore "MM-RAGE.vst3 was blocked" (un plugin copié à la main) :

```bash
P=/Library/Audio/Plug-Ins/VST3/MM-RAGE.vst3; [ -d "$P" ] || P=~/Library/Audio/Plug-Ins/VST3/MM-RAGE.vst3; sudo xattr -cr "$P" && sudo codesign --force --deep --sign - "$P" && echo "OK : $P"
```

## Utilisation

- **Le son** : le même moteur que la DISTO du MM-ARP, au bit près (même code). Les 20 presets du MM-ARP sont là, mêmes réglages. **DRIVE** pousse dans la saturation (0 à +36 dB, +20 avec PUNISH) ; **AUTO** garde le niveau ; **MIX** dose (0 = le sec seul) ; **OUTPUT** règle la sortie. À DRIVE 0, la saturation reste en circuit (au repos) : pour comparer, le bouton d'activation d'Ableton.
- **La fenêtre** : quatre pages derrière les onglets du haut. **RAGE** (le style, l'écran TRANSFER, MORPH, LOW CUT, TONE, HIGH CUT), **SHAPE** (filtres avant et après, BOX, DYNAMICS, FEEDBACK, la réponse), **BANDS** (le multibande : tire les coupures sur la carte), **MOVE** (l'enveloppe et le LFO). À droite, toujours là : le VU **ATTITUDE** (dans le rouge, la saturation mord), DRIVE, PUNISH, AUTO, MIX, OUTPUT.
- **Les gestes** : glisser vers le haut ou le bas (Maj : 4 fois plus fin), molette, double-clic ou Alt + clic = valeur par défaut. Un clic sur un levier ou une touche. MORPH TO et le STYLE d'une bande : un clic déroule la liste, la molette passe au voisin. La bande du bas dit ce que fait la pièce survolée, avec sa valeur ; une pièce grisée ne fait rien tel que c'est réglé.
- **Les presets** : 85 presets d'usine en 9 familles (THE CLASSICS : INIT et les 20 du MM-ARP ; BUS & GLUE, DRUMS, BASS, SYNTHS, VOICE & RADIO, LO-FI & TEXTURE, MOTION, DESTRUCTION). PREV / NEXT, un clic sur la fenêtre déroule la banque en colonnes, INIT = style A, un quart de DRIVE. Un preset règle tout, DRIVE et MIX compris. Tes propres réglages se sauvent comme presets d'Ableton (l'icône disquette de la barre du plugin).
- **Les paramètres** : déplie le plugin (le triangle de sa barre) : les 54 réglages, avec leur texte (dB, Hz, %, notes). Automation, MIDI Map (Cmd + M), même fenêtre fermée. LFO SYNC suit le tempo d'Ableton.
- **Le menu** (les trois traits, en haut à gauche) : **SETTINGS** : LEATHER TEXTURE (le cuir, à 100 au départ), PANEL LIGHT, ACCENT COLOR, RESET ; ces réglages valent pour tous les MM-RAGE ouverts et sont gardés sur le Mac. **WINDOW SIZE** : 80, 100, 120, 150 ou 200 %.
- **Les potards** : façon Moog, dessinés (aucune image mise à l'échelle, donc aucun crénelage), de tailles selon l'importance ; les cannelures et les repères tournent, les reflets de l'aluminium restent sous la lumière.
- **La taille** : le menu, ou tire le coin en bas à droite (80 % à 200 %) ; elle est gardée dans le projet, avec la page ouverte.
