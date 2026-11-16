# 2026-11-16 - Reverb façon BigSky : référence pour le VST MM-ARP

Demande de Mika : une page de configuration de la reverb façon Strymon BigSky, ouverte au clic sur le potard REVERB, au design du MM-ARP, **pour le VST**.

## 1. Ce qui a été fait

- Une première version pour le site : moteur à 12 machines, page REVERB, banc de test. Abandonnée à la demande de Mika (c'était pour le VST). La branche `claude/gallant-franklin-3hka73` a été remise à `main`, rien n'a été déployé.
- `docs/vst3/sky-reference/` : le moteur JS (`sky.worklet.js`), le modèle (`sky.ts`), le banc (`sky-test.mjs`) et un README. Ce sont des fichiers de référence, branchés nulle part, à porter en C++ dans `plugin/mm-arp/dsp`.
- La demande complète a été transmise à la session « ARP VST3 » (branche `claude/nifty-bohr-7ixmpf`), qui fait le moteur C++ et la page dans OPEN.

## 2. Décisions prises et pourquoi

- Mika a choisi que la session ARP VST3 fasse tout : elle modifie déjà OPEN et le « clic sur un potard = OPEN sur sa section ». Travailler en parallèle sur les mêmes fichiers aurait créé des conflits.
- Le BigSky.vst3 est sur le Mac de Mika, inaccessible depuis le cloud. Les paramètres viennent du manuel officiel, les algorithmes sont les nôtres.

## 3. Ce qui reste à faire / points en suspens

- Session ARP VST3 : porter le moteur en C++, ajouter les paramètres hôte, faire la page REVERB dans OPEN.
- Mika : écouter le VST une fois la session ARP VST3 terminée.

## 4. Commandes utiles ajoutées

- Aucune dans le code branché. Le banc de référence est `docs/vst3/sky-reference/sky-test.mjs` (chemins à adapter).
