# MM-HELL, installation sur Mac (VST3)

MM-HELL, un plugin Maudite Machine, dans la famille de MM-RYTM et MM-ARP : un delay infernal façon Echobode, avec un décaleur de fréquence de Bode dans la boucle (chaque répétition monte ou descend encore : spirales, escaliers sans fin). Son moteur est celui du module HELL du MM-ARP.

## Installer ou mettre à jour

1. Dans le Terminal, rien à télécharger avant :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-hell-latest/update.sh | bash
```

   Le script (`update.sh`) télécharge le dernier build vert (la release **mm-hell-latest** du dépôt, que le CI remplace à chaque build) et l'installe dans `/Library/Audio/Plug-Ins/VST3/MM-HELL.vst3` (ou remplace celui de `~/Library` s'il n'y a que lui). Il affiche le commit et l'heure du build, retire la quarantaine et re-signe le plugin sur ton Mac (sans compte Apple Developer, macOS le bloquerait sinon). Le mot de passe demandé est celui de ta session Mac.
2. Quitte Ableton s'il était ouvert (Cmd + Q) et rouvre-le. Réglages > Plug-ins, "Use VST3 Plug-in System Folders" activé, puis **Option + clic sur Rescan** la première fois.
3. Dans le navigateur : **Plug-Ins > Maudite Machine > MM-HELL**. Glisse-le sur une piste audio, une piste MIDI après un instrument, ou une piste de retour.

Un artefact téléchargé à la main (onglet **Actions**, workflow **Plugin MM-HELL**, artefact **MM-HELL-macOS**) s'installe pareil : `bash update.sh ~/Downloads/MM-HELL-macOS.zip` (`update.sh` est dans l'artefact).

Si macOS dit encore "MM-HELL.vst3 was blocked" (un plugin copié à la main) :

```bash
P=/Library/Audio/Plug-Ins/VST3/MM-HELL.vst3; [ -d "$P" ] || P=~/Library/Audio/Plug-Ins/VST3/MM-HELL.vst3; sudo xattr -cr "$P" && sudo codesign --force --deep --sign - "$P" && echo "OK : $P"
```

## Utilisation

- **Le son** : le même moteur que le module HELL du MM-ARP, au bit près (même code, mêmes réglages ; les presets aussi, cinq corrigés pour descendre vraiment). **MIX** dose l'effet : 0 = contourné au bit près ; à mi-course, le sec et le mouillé sont pleins. Sur une piste de retour, mets MIX à fond.
- **La fenêtre** : de gauche à droite, le chemin du son. **DELAY** (le temps, en ms ou en notes avec SYNC ; FEEDBACK ; CROSS ; dans la boucle HIGH-PASS, LOW-PASS, SMEAR), **FREQUENCY SHIFTER** (RANGE en touches, le gros potard, SIDEBAND, PHASE, ANTI REFL, SPREAD), **HELL** (MIX et l'**ECHO MAP**), et le **LFO** avec son VU.
- **ECHO MAP** : chaque répétition, sa hauteur et son niveau, calculés depuis les réglages (un La 440, ou la dernière note MIDI reçue). On voit la spirale monter ou descendre, ce que les filtres de la boucle retirent (zones assombries), et ce qui se replie sous 0 Hz (anneaux, à corriger avec ANTI REFL).
- **Les gestes** : glisser vers le haut ou le bas (Maj : 4 fois plus fin), molette, double-clic ou Alt + clic = valeur par défaut. Un clic sur un levier ou une touche. La bande du bas dit ce que fait la pièce survolée, avec sa valeur.
- **Les presets** : 24 presets d'usine. PREV / NEXT, un clic sur la fenêtre déroule la banque, INIT = un delay simple. Un preset règle tout sauf MIX (s'il était à 0, il passe à 35 %). Tes propres réglages se sauvent comme presets d'Ableton (l'icône disquette de la barre du plugin).
- **RANGE MIDI** : le décalage suit la dernière note reçue. Sur une piste MIDI, **MIDI To** : la piste où est MM-HELL, puis **MM-HELL** dans le second menu. Sans note reçue, le décalage reste à 0 (l'écran dit "WAITING FOR A MIDI NOTE").
- **Les paramètres** : déplie le plugin (le triangle de sa barre) : les 22 réglages, avec leur texte (Hz, ms, notes). Automation, MIDI Map (Cmd + M), même fenêtre fermée. SYNC et RANGE SYNC suivent le tempo d'Ableton.
- **La taille** : tire le coin en bas à droite (80 % à 200 %) ; elle est gardée dans le projet.
