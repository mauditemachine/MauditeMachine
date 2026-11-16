# 2026-11-16 : MM-ARP (VST3), la DISTO façon Decapitator

Demande de Mika : le potard OVERDRIVE devient DISTO ; un clic dessus ouvre une page de configuration de la disto avec
tous les paramètres et la qualité d'un Soundtoys Decapitator, au design du MM-ARP. Précision en cours de route : « c'est
pour le VST, pas le site web ». Branche `claude/admiring-feynman-5zsgxp`, partie de `claude/nifty-bohr-7ixmpf`
(le VST en cours).

## 1. Ce qui a été fait

- `plugin/mm-arp/dsp/Decap.{h,cpp}` : la DISTO. Cinq styles (A préampli à lampes, E transistors, N transformateur
  classe A, T triode, P pentode), PUNISH (+20 dB), LOW CUT + THUMP, TONE, HIGH CUT + STEEP, MIX, OUTPUT, AUTO.
  Saturation suréchantillonnée x8 (polyphase à phase linéaire, Kaiser) + ADAA du premier ordre, pré- et
  désaccentuation inverses par style, bloqueur de continu, tout lissé (fondus de 20 ms, style par fondu de 6 ms).
- `plugin/mm-arp/tests/decap_test.cpp` (cible `mmarp_decap_test`, ctest `decap`) : 16 contrôles. DRIVE 0 au bit près,
  MM à 0 dB au bit près, platitude en petit signal, MIX 0 % = le sec retardé au bit près, MIX 50 % en phase, repliement
  -61.3 / -64.1 dBc (sinus 7.3 kHz écrêté à fond avec PUNISH), pas de continu, AUTO, pas de clic, stabilité à fond,
  CPU (~50 ms par seconde stéréo).
- `plugin/mm-arp/extra-params.json` (+ `src/ExtraTable.inc` régénéré) : `xDist` et `xDistTone` remplacés par
  `xDStyle`, `xDPunish`, `xDLow`, `xDThump`, `xDTone`, `xDHigh`, `xDSteep`, `xDMix`, `xDOut`, `xDAuto`.
- `plugin/mm-arp/src/PluginProcessor.{h,cpp}` : `Decap` entre le moteur et la chaîne (avant CRUSH). Le DRIVE est le
  potard `dist` de la face. Sur un style A à P, le drive du moteur est mis à 0 ; sur MM, le moteur garde son OVERDRIVE
  et Decap n'applique que OUTPUT. L'ancienne DISTORTION d'ArpFx reçoit `dist = 0` (contournée au bit près).
- `plugin/mm-arp/presets/build.mjs` + banque régénérée : un preset qui pousse le potard sans dire son style garde MM
  (11 presets), les 29 autres prennent A.
- Face du VST :
  - `src/v4/plugin/arp/HoodBoard.tsx` : nouvelle sous-page OPEN > FX > DISTO (touche à côté de RACK et HELL), cadres
    STYLE / DRIVE + PUNISH / OUTPUT (MIX, OUTPUT, AUTO), LOW CUT + THUMP / TONE / HIGH CUT + STEEP, et un écran de verre
    noir avec la courbe de transfert du style au DRIVE posé et la réponse des filtres. Le cadre DISTORTION de SOUND
    est retiré.
  - `hellKnob.tsx` : un clic sur le potard DISTO ouvre FX > DISTO (cadre DRIVE qui clignote).
  - `hoodPage.ts` (sous-page `disto`), `extra.ts` (textes : Hz, dB, FLAT / DARK / BRIGHT), `pcbui.tsx` (LED, réglages
    grisés sur MM), `hood.css` (l'écran).
  - `voyager/silk.ts` et `voyager/screen.ts` : « DISTO » sous le potard et sur l'écran, seulement si `PLUGIN_ARP`.
- `plugin/mm-arp/tests/host_test.cpp` : le test « tout à fond » passe par la DISTO (style P, PUNISH, DRIVE 1) au lieu
  de `xDist`.
- `.github/workflows/plugin-arp.yml` : étape `mmarp_decap_test`.

## 2. Décisions prises et pourquoi

- **Le binaire du Decapitator n'a pas été ouvert.** Le chemin `/Library/Audio/Plug-Ins/VST3/...` est sur le Mac de
  Mika, pas dans le conteneur cloud (et un VST3 compilé ne se « décortique » pas en DSP). Les styles et réglages
  suivent le manuel public de Soundtoys. Les courbes sont des modèles originaux (Ampex 350, EMI TG, Neve 1057,
  Culture Vulture T et P), pas une copie.
- **Style MM** : l'OVERDRIVE d'origine du moteur, identique au bit près au site. C'est ce que gardent les presets réglés
  dessus (et calés en volume dans `volumes.json`).
- **STYLE à A par défaut** : exception assumée à la règle « chaque def rend le son du site » (comme xQuality), parce
  que Mika veut le Decapitator sur DISTO. Conséquence : un projet Ableton d'avant dont l'OVERDRIVE était au-dessus de 0
  passe par le style A. Mettre STYLE sur MM rend le son d'avant.
- **La DISTO remplace la DISTORTION** (choix de Mika). `xDist` et `xDistTone` sont supprimés. Dans un vieux projet,
  leur valeur et leur automation sont ignorées. Le code DSP de cette pédale reste dans ArpFx (encore testé par hq3),
  contourné.
- **Placement juste après le moteur**, avant CRUSH et la chaîne du site : comme un Decapitator en insert sur le synthé.
  32 échantillons de retard quand elle est engagée, non déclarés à l'hôte (même règle que l'ancienne DISTORTION, WARMTH
  et le FLANGER).
- **Niveau de travail** : la saturation reçoit le signal multiplié par le gain de VOLUME (`ArpFxLaws::volGain`), pour que
  le DRIVE morde pareil quel que soit VOLUME.
- **AUTO** : compensation statique mesurée sur les arpèges INIT et ACID du moteur (1.2 dB d'écart au pire). Un arpège
  très percussif peut gagner jusqu'à ~3.7 dB une fois très écrasé, comme avec n'importe quel AUTO statique.
- Un premier passage avait été fait sur le site (avant la précision de Mika). Il n'est ni commité ni en ligne. Son
  DSP, validé par un banc de 17 contrôles, a été porté tel quel en C++ (mêmes chiffres de repliement au dixième près).

## 3. Ce qui reste à faire / points en suspens

- **Mika** :
  - Compiler sur le Mac et écouter les cinq styles, PUNISH, THUMP et STEEP. Tout a été réglé et mesuré sans écoute :
    aucune lecture audio n'a été faite pendant les tests.
  - Comparer à l'oreille avec le Decapitator.
- `PluginProcessor.cpp` n'a pas pu être compilé ici (JUCE absent) ; la CI `plugin-arp.yml` le fera. Le DSP, les
  générateurs, la banque et la face sont vérifiés.
- Les destinations de modulation « DRIVE » (LFO, matrice) agissent encore sur le drive du moteur. Sur un style A à P,
  elles peuvent ajouter un peu de l'OVERDRIVE du moteur. À router vers la DISTO si Mika le veut.
- La touche STYLE suit le comportement des touches à crans du capot (le glisser), pas un clic par style.
- Firmware : `firmware:check` signalait déjà MM-RYTM et MM-ARP comme non à jour sur la branche du VST avant cette
  session. Il faut faire le bump au moment de la fusion.
- Ménage possible : retirer l'ancienne pédale DISTORTION d'ArpFx et ses tests hq3 une fois la DISTO validée.
- Fusionner avec `nifty-bohr-7ixmpf` quand l'autre session aura fini.

## 4. Commandes utiles ajoutées

```bash
cmake -S plugin/mm-arp -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j && ./build-dsp/mmarp_decap_test
```

```bash
cd build-dsp && ctest -R decap
```
