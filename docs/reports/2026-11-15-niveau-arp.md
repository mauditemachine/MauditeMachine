# 2026-11-15 - Niveau du MM-ARP

## 1. Ce qui a ete fait
- `src/v4/audio/synth.ts` : `VOLUME_K` 0.66 -> 0.56 (-1.4 dB sur toute la sortie du MM-ARP, presets compris).

## 2. Decisions prises et pourquoi
- Mika : "ARP est un peu plus fort que Rytm". Correction rapide : on baisse l'ARP plutot que de monter le RYTM, pour ne pas rapprocher le mix du rouge (le kick reste la reference, RYTM_TRIM inchange).
- -1.4 dB : "un peu" ; assez pour s'entendre, sans reprendre la mesure hors ligne (aucune lecture audio pendant la session).

## 3. Ce qui reste a faire / points en suspens
- Mika : ecouter RYTM + ARP ensemble au VU du MIXER. Si l'ARP reste devant : 0.50 (-1.4 dB de plus) ; s'il passe derriere : 0.60.
- Les VOLUME des presets d'usine (state/factory.ts) n'ont pas bouge : ils baissent tous de 1.4 dB avec VOLUME_K.

## 4. Commandes utiles ajoutees
- Aucune.
