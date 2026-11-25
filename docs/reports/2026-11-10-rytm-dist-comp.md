# 2026-11-10 - MM-RYTM V.7.1 : DIST facon gros hardcore, COMP qui s'entend

## 1. Ce qui a ete fait

- `src/v4/audio/fx.ts` : nouvelle loi de DIST (globale et par voix). Gain jusqu'a 40 dB (x100, 22 dB avant), ecretage dur avec une corne sur le front montant (`distShape`), plus rien de sec a fond, un mordant a 2.5 kHz apres l'ecretage (jusqu'a +8 dB), un TRIM par bus (`DIST_TRIM` : kick 2 dB, autres voix 8 dB, voix seule 5 dB).
- `src/v4/audio/drums.ts` : le bus des voix prend son TRIM.
- `src/v4/audio/glue.worklet.js` : COMP pousse le son dans le compresseur (jusqu'a 14 dB), rend ce gain, plafonne le son compresse a 0 dBFS, MIX en `1 - (1 - COMP)^2`. COMP a 0 : toujours le son tel quel.
- `src/v4/audio/pattern.ts` : constantes du COMP partagees avec les cartes (`COMP_PUSH`, `compMix`, `compCeil`).
- `src/v4/rytm/diagrams.ts`, `infos/fx.ts`, `infos/sound.ts`, `values.ts` : dessins et textes d'aide de DIST et COMP alignes sur les nouvelles lois ; l'ecran affiche COMP en % (plus "MIX").
- `plugin/mm-rytm/dsp/Fx.cpp`, `Fx.h` : les memes lois portees dans le plugin VST3 (DIST, mordant, TRIM par bus, COMP pousse).
- `src/v4/firmware.json` : MM-RYTM 7.0 -> 7.1.

## 2. Decisions prises et pourquoi

- Aucune lecture audio : tout est mesure hors ligne (calcul en Node, puis `__v4.audio.renderOffline` dans le navigateur, qui ne sort rien sur les enceintes).
- COMP : mesure de l'ancien a fond, aux reglages de depart : le niveau moyen ne montait pas et le facteur de crete augmentait (la frappe passait l'attaque de 10 ms avec le rattrapage). D'ou "pas grand chose de notable".
- DIST : TRIM recale sur le vrai kit, le premier reglage laissait le corps du kick 2 dB sous son niveau sec.
- Le plugin suit le site pour garder le meme son des deux cotes.

Mesures sur le vrai moteur (hors ligne, sans limiteur) :

| Reglage | Avant | Apres |
|---|---|---|
| COMP 100 %, niveau moyen du motif | inchange (-18.1 dB) | -12.5 dB (+5.6 dB), crete sous 0 dBFS |
| DIST 100 %, corps du kick | proche du sec | +1.8 dB, queue +8 dB |
| DIST 100 %, part du kick au-dessus de 2 kHz | -18.5 dB (sec) | -9.5 dB |
| DIST 100 %, charley et clap | | +6 a +8 dB |

## 3. Ce qui reste a faire / points en suspens

- Mika : ecouter et dire si la DIST est assez sale et le COMP assez marque (reglages : `DRIVE.maxDb`, `BITE`, `DIST_TRIM` dans `fx.ts` ; `PUSH_DB`, `PUSH_MAKE` dans `glue.worklet.js`).
- Les motifs et presets deja sauvegardes avec DIST ou COMP sonnent plus fort et plus durs qu'avant.
- Plugin : compile et tests moteur OK en local (Linux, sans JUCE). Le VST3 macOS est construit par GitHub Actions ; `plugin/mm-rytm/update.sh` pour l'installer.
- Points du rapport V.7.0 toujours ouverts (carte Add to Home Screen, press kit, smoke test).

## 4. Commandes utiles ajoutees

- Aucune.
