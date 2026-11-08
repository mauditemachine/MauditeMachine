# MM-RYTM, installation sur Mac

1. Sur GitHub : onglet **Actions**, workflow **Plugin MM-RYTM**, dernier run vert, artefact **MM-RYTM-macOS**. Dezippe-le deux fois (l'artefact, puis `MM-RYTM-macOS.zip`).
2. Copie les plugins :
   - `MM-RYTM.vst3` dans `~/Library/Audio/Plug-Ins/VST3/`
   - `MM-RYTM.component` dans `~/Library/Audio/Plug-Ins/Components/`
   - `MM-RYTM.app` (la version autonome) ou tu veux, par exemple `/Applications`
3. Le plugin est signe "ad hoc" (sans compte Apple Developer). macOS bloque donc les fichiers telecharges ; retire la quarantaine une fois :

```bash
xattr -dr com.apple.quarantine ~/Library/Audio/Plug-Ins/VST3/MM-RYTM.vst3 ~/Library/Audio/Plug-Ins/Components/MM-RYTM.component
```

4. Dans Ableton Live : Reglages > Plug-ins, active "Use VST3 Plug-in System Folders" (et "Use Audio Units v2" pour l'AU), puis **Rescan**. MM-RYTM apparait sous **Maudite Machine** dans les instruments.

## Utilisation

- **Sequenceur** : 8 pistes x 16 pas, cale sur le transport d'Ableton. Clic sur un pas : on, accent, off (clic droit : off). STEPS regle la longueur (1 a 16), SWING de 50 a 80 %.
- **MIDI** : un clip MIDI joue les pistes en notes GM : 36 BD, 38 SD, 42 CH, 46 OH, 39 CP, 45 TOM, 50 HT, 49 CY (et leurs voisines GM). La velocite compte.
- **Sons** : la meme synthese que le MM-RYTM du site (909, 808, MM), bit a bit, plus tes samples (`public/samples/rytm`, embarques). Le kit de depart est celui du site : BD, SD et OH sur ton premier sample, les autres en synthese.
- **Multi-out** : OUTPUT = Own envoie la piste sur sa propre sortie stereo (dans Ableton : active les sorties du plugin, puis route chaque piste).
- **Standalone** : RUN lance l'horloge interne (BPM) quand aucun hote ne joue.
