# MM-RYTM, installation sur Mac (VST3)

1. Sur GitHub : onglet **Actions**, workflow **Plugin MM-RYTM**, dernier run vert, artefact **MM-RYTM-macOS**. Dezippe-le, puis dezippe `MM-RYTM-macOS.zip` : tu obtiens un dossier `MM-RYTM` avec `MM-RYTM.vst3` et ce fichier.
2. Copie `MM-RYTM.vst3` dans `~/Library/Audio/Plug-Ins/VST3/` (ou `/Library/Audio/Plug-Ins/VST3/`, a cote de tes autres VST3).
3. Le plugin est signe "ad hoc", sans compte Apple Developer : macOS le bloque ("was blocked to protect your Mac"). Le bouton **Open Anyway** des Reglages ne fait rien de visible pour un plugin (ce n'est pas une app). Retire plutot la quarantaine dans le Terminal :

```bash
sudo xattr -dr com.apple.quarantine ~/Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3 /Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3
```

   Le mot de passe demande est celui de ta session Mac. Une ligne "No such file" pour l'un des deux dossiers est normale : le plugin n'est que dans l'un des deux.

4. Dans Ableton Live : Reglages > Plug-ins, "Use VST3 Plug-in System Folders" active, puis **Option + clic sur Rescan** (un rescan complet : Live oublie qu'il avait vu le plugin bloque).
5. Dans le navigateur : **Plug-Ins > Maudite Machine > MM-RYTM** (le dossier du fabricant, rang M, au-dessus de Plugin Alliance). Glisse-le sur une piste MIDI.

## Utilisation

- **Sequenceur** : 8 pistes x 16 pas, cale sur le transport d'Ableton. Clic sur un pas : on, accent, off (clic droit : off). STEPS regle la longueur (1 a 16), SWING de 50 a 80 %.
- **MIDI** : un clip MIDI joue les pistes en notes GM : 36 BD, 38 SD, 42 CH, 46 OH, 39 CP, 45 TOM, 50 HT, 49 CY (et leurs voisines GM). La velocite compte.
- **Sons** : la meme synthese que le MM-RYTM du site (909, 808, MM), bit a bit, plus tes samples (`public/samples/rytm`, embarques). Le kit de depart est celui du site : BD, SD et OH sur ton premier sample, les autres en synthese.
- **Multi-out** : OUTPUT = Own envoie la piste sur sa propre sortie stereo (dans Ableton : active les sorties du plugin, puis route chaque piste).
- **RUN** : l'horloge interne (BPM) quand l'hote ne joue pas.
