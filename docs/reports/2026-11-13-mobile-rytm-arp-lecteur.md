# 2026-11-13 - Téléphone : RYTM et ARP épurés, lecteur TRACKS, presskit et contact

Demande de Mika (captures iPhone) : faire de l'espace sur RYTM et ARP au téléphone, enlever le superflu, des knobs plus gros dans RYTM, les numéros sur les pas et les noms sur les pads, l'ARP "pareil que Rytm" ; supprimer le deck au téléphone, un lecteur simple avec les covers pour TRACKS, le presskit direct sur PRESS avec téléchargement, un formulaire sur CONTACT.

## 1. Ce qui a été fait

- MM-RYTM au téléphone (`src/v4/theme/face.ts`, `theme/base.ts`, `theme.ts`, `scene/pads.ts`, `scene/renderer.ts`, `scene/keyLabels.ts`) :
  - knobs GLOBAL FX 1.65 fois leur taille (1.05 avant), noms et zones du doigt recalculés ;
  - le numéro est imprimé sur chaque pas ;
  - le nom de chaque voix, EDIT et OPEN sont imprimés sur leur pad (OPEN devient CLOSE machine ouverte) ;
  - plus de crochets sous les pas, plus de numéros ni de noms dessous, plus de VOICES ni du filet vertical ;
  - l'espace gagné passe aux knobs, les rangées sont redistribuées.
- MM-ARP au téléphone (`src/v4/voyager/pads.ts`, `voyager/silk.ts`, `voyager/theme.ts`, `voyager/rig.ts`) :
  - nom de l'accord sur chaque pad, pads carrés comme les voix du RYTM ;
  - nom de chaque bouton (RUN/STOP, CLEAR, RANDOM, EDIT, PRESET, OPEN/CLOSE) sur sa touche ;
  - plus de crochets sous les groupes (les titres restent), plus de graduations autour de CUTOFF et VOLUME, plus d'échelles autour de RANGE, SEMI et FINE ;
  - la moitié basse remonte de 0.3, les pads d'accords ne sont plus collés à TOUCH CONTROLS.
- Deck : plus de MM-DECK au téléphone (`src/v4/state/focus.ts`, DJ faux en portrait), le sélecteur n'a plus que MM-RYTM et MM-ARP. L'ordi garde ses MM-DECKS.
- TRACKS et MIXTAPES au téléphone : un lecteur (`src/v4/ui/sections/PhonePlayer.tsx`, `player.css`) avec la pochette en grand, précédent, lecture/pause, suivant, la position, Buy ; dessous la liste avec les pochettes. La feuille monte jusque sous l'en-tête (`v4.css`).
- Pochettes : les 37 morceaux ont la leur, l'officielle de Bandcamp (`public/images/covers/`, 29 images WebP 480 px, 900 Ko au total), carte `src/v4/data/covers.json`, champ `cover` des lignes (`src/v4/data.ts`). Les mixtapes gardent leur artwork.
- PRESS au téléphone : ouvre directement le presskit plein écran avec Download PDF (`src/v4/actions/nav.ts`, `ui/presskit-viewer.css`).
- CONTACT au téléphone : le formulaire en premier, les réseaux et adresses ensuite, feuille haute pour le clavier (`ui/sections/Contact.tsx`, `v4.css`).
- Firmware : MM-RYTM 7.1 vers 7.2, MM-ARP 2.5 vers 2.6 (`src/v4/firmware.json`).

## 2. Décisions prises et pourquoi

- "Met à hauteur les sons pour que ce soit pareil que Rytm" lu comme : les pads d'accords traités comme les voix du RYTM (nom sur le pad, pads carrés, remontés). Les niveaux ARP et RYTM étaient déjà égalisés au VU (2026-10-10, ARP +5 dB), donc pas de changement de volume.
- Les noms sur les touches réutilisent le mécanisme déjà en place (VOICE, RUN/STOP, numéros des pas de l'ordi) : ils s'enfoncent avec la touche et passent au noir quand elle s'allume fort.
- Gardé sur l'ARP : les titres de groupes (deux ADSR à distinguer), les repères de MODE et les formes d'onde (positions des sélecteurs), les chiffres 1 et 2 des oscillateurs, les joues en bois.
- Mixtapes au téléphone : le même lecteur que TRACKS, sinon c'était la seule liste de texte qui restait.
- Tout est limité au téléphone (portrait) : l'ordi est vérifié inchangé.
- Vérifié par captures dans un navigateur sans carte graphique (iPhone 13, sombre et clair) ; les 181 zones de toucher pointées une par une tombent sur leur touche ; lecture testée avec le moteur factice du site, aucun son lancé. `tsc` reste à 105 erreurs (celles d'avant).

## 3. Ce qui reste à faire / points en suspens

- Mika : tester sur l'iPhone (taille des knobs, lisibilité des noms sur les pads, lecteur TRACKS avec le vrai son).
- Si "met à hauteur les sons" voulait dire autre chose (pads d'accords en 2 rangées de 4 comme le RYTM, ou un volume), le dire.
- L'écran de l'ARP montre encore la rangée des 8 accords (doublon des pads) : à retirer si Mika le veut.
- La carte "Add to Home Screen" réduit encore la machine quand elle s'affiche (connu).
- `scripts/smoke-v4.mjs` n'a pas été relancé.

## 4. Commandes utiles ajoutées

- `npm run covers:tracks` : récupère les pochettes Bandcamp des morceaux de `src/v2/data/discography.json` dans `public/images/covers/` et écrit `src/v4/data/covers.json` (à relancer après l'ajout d'un morceau ; `--force` pour tout refaire).
