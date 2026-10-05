# Référence MIDI pour le Roto-Control (2026-10-05)

Demande de Mika : « pourrais-tu me dire tout le MIDI, comment c'est fait ? Avoir une liste pour que je puisse faire mon fichier JSON pour le Roto. »

## 1. Ce qui a été fait

- `scripts/midi-reference.mjs` (`npm run docs:midi`) : lit le vrai code dans le site en développement (cibles de chaque machine, MM-DECKS et MM-SMPL chargés à la demande, les six setups du Roto) et écrit trois fichiers dans `docs/midi/` :
  - `MIDI-roto-reference.md` : les règles, le format du fichier ROTO-SETUP, les six setups contrôle par contrôle (canal, CC, nom, couleur, cible, type), le catalogue des 345 cibles par machine, et comment faire son propre fichier ;
  - `MIDI-roto-setups.csv` : un contrôle du Roto par ligne ;
  - `MIDI-targets.csv` : une cible du site par ligne.
- `package.json` : `docs:midi`. `docs/v4/spec.md` : R14-179.

## 2. Décisions prises et pourquoi

- **Généré, pas écrit à la main** : la liste suit le code (KICK SOUND est maintenant à 9 crans avec les samples, SNARE SOUND à 7). Une commande la refait.
- **Deux voies pour son propre fichier**, parce que le JSON du Roto ne contient que canal, CC, nom, couleur et type : la cible (ce que ça pilote) est dans le site, qui la retrouve par canal et CC. Voie 1 : partir d'un setup fait et ne changer que noms et couleurs. Voie 2 : sa propre disposition, avec en plus un fichier d'assignations du site (EXPORT / IMPORT du panneau MIDI), sur des canaux libres (7, 8, 15, 16) pour ne pas se mélanger à la carte.
- **Rien n'a changé dans le comportement du MIDI** : c'est de la documentation lue dans le code.

## 3. Ce qui reste à faire / points en suspens

- **Côté Mika** : relire `docs/midi/MIDI-roto-reference.md` ; réimporter « MM RYTM (SETUP 11).json » (panneau MIDI, DOWNLOAD THE 6 SETUPS) pour avoir les 9 crans de KICK SOUND et les 7 de SNARE SOUND, et « MM SMPL (SETUP 15).json » (SCAN à la place de SPREAD) si ce n'est pas fait.
- **Si tu veux ta propre disposition** : donne-la moi page par page (ce que tu veux sur chaque potard et bouton), je génère le fichier du Roto et le fichier d'assignations du site, prêts à importer.

## 4. Commandes utiles ajoutées

- `npm run docs:midi` : refait `docs/midi/` (Playwright requis : `npm i --no-save playwright && npx playwright install chromium`, ou `PLAYWRIGHT_MODULE` et `CHROMIUM_PATH` ; `SITE_URL=http://localhost:5173` pour un serveur déjà lancé).
