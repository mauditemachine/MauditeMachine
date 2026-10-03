# Le design des machines de mauditemachine.com

Guide de transmission, rédigé le 3 octobre 2026 pour le projet Sonaa (sonaa.ca) : Mika veut y créer des platines façon Pioneer CDJ, avec leur jog, et une table de mixage façon DJM-1000, dans le même langage que les deux machines de mauditemachine.com, la MM-808 (boîte à rythmes) et le MM-VOYAGER (synthé arpégiateur).

Le code source de référence est dans ce dépôt (`/Users/mauditemachine/Library/Mobile Documents/com~apple~CloudDocs/Dev/MauditeMachine2025`), dossier `src/v4/`. Chaque valeur citée ici y est vivante : `src/v4/theme.ts` pour la 808, `src/v4/voyager/theme.ts` pour le Voyager.

---

## 1. L'idée

Des machines de studio réelles, en 3D, qu'on utilise vraiment dans la page : on tourne les potards, on frappe les pads, ça sonne. Pas une illustration : un instrument. Trois règles tiennent tout le reste.

1. **Le réalisme d'abord, la décoration jamais.** Chaque pièce existe sur une vraie machine : chanfreins, pieds en caoutchouc, connectique arrière, sérigraphie, carte électronique sous le capot. Rien n'est ajouté pour faire joli.
2. **La machine est l'interface.** La navigation du site (TRACKS, MIXTAPES, SHOWS...) est faite de vrais boutons de la machine ; la sérigraphie orange les distingue des commandes musicales.
3. **La lumière dit l'état.** Une LED, un rétroéclairage ou un halo encode toujours quelque chose : un pas programmé, la page ouverte, la note qui sonne, un mute, un solo.

Références assumées : Elektron Analog Rytm (MM-808 : boîtier en coin, panneau anodisé noir, pads rétroéclairés), Minimoog Voyager (MM-VOYAGER : joues en bois, panneau qui se relève, gros potards à jupe d'aluminium).

---

## 2. Couleurs

Toutes les teintes sont des **couleurs affichées visées** : sous l'éclairage et la courbe de tons, une matière peinte avec sa teinte exacte rendrait plus sombre. Chaque teinte a donc un **gain** (multiplicateur de l'albédo linéaire), calé par lecture de pixels sur la vue par défaut. Voir `GAIN` dans `theme.ts`. C'est la clé du rendu fidèle : on vise une couleur à l'écran, pas une couleur de matière.

### 2.1 Machine noire (thème sombre)

| Rôle | Hex | Usage |
|---|---|---|
| Encre (fond) | `#0A0A0B` | arrière-plan, verre de l'écran |
| Graphite | `#141417` | panneau anodisé |
| Graphite clair | `#1C1D21` | touches secondaires |
| Filet | `#2E3036` | lignes, LED éteintes |
| Os (bone) | `#F6F1E7` | sérigraphie, texte, repères des potards |
| Jaune | `#F2C230` | flash des pads, liseré de lumière |
| Jaune vif | `#FFD75E` | la page ouverte, l'élément actif |
| Rouge | `#C8442F` | RUN/STOP |
| **Orange** | `#FF6A13` | **navigation** (noms des pages, OPEN), pas programmés |
| Orange moyen | `#AD480D` | vélocité moyenne |
| Orange doux | `#612807` | vélocité douce |
| Corps | `#0C0C0E` | flancs du châssis, mat |
| Chanfrein | `#2A2B30` | arêtes tournées vers le haut (accrochent la lumière) |
| Caoutchouc | `#111113` | pads |
| Touches | `#1E1F23` | touches de pas |
| Potards | `#101012` | capuchons, collerette `#1A1B1F` |
| Verre OLED | `#050506` | écran |

Le fond de page en sombre est **le granite de sonaa.ca** (`#0C0B09` et la tuile SVG du granite à 12 %) : le canevas WebGL est transparent et le sol n'y écrit que l'ombre des machines. Les deux sites partagent donc déjà leur fond.

### 2.2 Machine claire (thème clair)

| Rôle | Hex |
|---|---|
| Fond (table crème) | `#F1EDE5` |
| Panneau | `#FAF8F4` (blanc à peine crème) |
| Corps | `#E6E2DA` |
| Pads et touches | `#E6E3DD`, `#E8E5DF` |
| Potards | `#26262A` (charbon, repère os) |
| Sérigraphie | `#434343` |
| Accents | l'orange `#FF6A13` remplace le jaune (le jaune pâlit sur le clair) |

### 2.3 MM-VOYAGER

| Rôle | Sombre | Clair |
|---|---|---|
| Panneau (peinture mate) | `#131315` | `#F8F5EF` |
| Chant du capot | `#2C2D32` | `#FFFFFF` |
| Bac | `#0C0C0E` | `#E2DED6` |
| Capuchon de potard | `#0F0F11` | `#232326` |
| Jupe d'aluminium | `#A7ABB2` | `#CDD0D6` |
| Bois des joues | noyer fumé (RGB 26,16,11 / 58,37,24 / 104,68,42) | chêne blanc (138,101,66 / 190,152,108 / 224,194,150) |

### 2.4 États lumineux (émissif linéaire des pads, `PAD_GLOW`)

- éteint : 0 ;
- faible (on voit qu'on peut toucher) : `[0.022, 0.016, 0.001]` ;
- survol : `[0.085, 0.06, 0.003]` ;
- flash (frappe, note) : `[1.2, 0.42, 0]` pendant 100 à 120 ms ;
- actif : `[1.8, 0.85, 0.02]` ;
- OPEN (action qui transforme la page) : orange plein `[1.6, 0.2, 0.004]`, qui **respire** (sinusoïde de 3,2 s, de 45 % à 100 %).

Mute en rose poudre (`#7A5662` sombre, `#E3B1A9` clair), solo en bleu (`#2B5896`, `#8DB2E4`) : le caoutchouc change de teinte, la matière reste la même.

---

## 3. Typographie

- **SF Pro Display** pour toute la sérigraphie : capitales, graisse 500, interlettrage 0,2 em, os à 85 % ; noms de machine en 600 ; noms de pages en 700 orange, avec une légère lueur (émissif 0,6) pour rester lisibles sous la lumière.
- **Robot Radicals** pour les grands titres du site (pas sur les machines).
- **Monospace** (`ui-monospace, Menlo`) pour les écrans OLED : 40 px dans une texture de 640 × 240, os sur noir profond, trois lignes.
- Filets de sérigraphie : 0,012 unité, os à 35 %. Crochets sous les groupes (comme sous les pas d'Elektron), coupés au centre par le nom du groupe en gras.

Sur Sonaa, la police du site est Inter : la sérigraphie des platines peut rester en SF Pro Display (c'est une gravure de machine, pas du texte de site) ou passer en Inter capitales espacées ; à trancher selon DESIGN.md de Sonaa.

---

## 4. Matières (three.js, `MeshStandardMaterial` sauf mention)

| Pièce | Rugosité | Métal | Détail |
|---|---|---|---|
| Panneau anodisé (808) | 0,62 | 0,35 | brossage en `roughnessMap` (fines lignes horizontales, invisibles de loin) |
| Châssis | 0,85 | 0 | facettes franches (`flatShading`), couleurs de sommets |
| Pads caoutchouc | 0,9 | 0 | dôme de 0,04 sur le dessus, rétroéclairage : émissif par instance (dessus 100 %, flancs 55 %) et halo additif dessous |
| Touches | 0,6 | 0 | |
| Potards | 0,55 | 0 | |
| Potards Moog | 0,42 | 0,28 | capuchon cannelé (24 cannelures), jupe d'aluminium |
| Bois | 0,5 | 0 | `MeshPhysicalMaterial`, vernis satiné (clearcoat 0,6), relief des pores (bump), environnement studio doux |
| PCB | carte ORM | | `MeshPhysicalMaterial`, vernis brillant (clearcoat 0,9, rugosité 0,16) sur une carte de normales tirée du dessin : pistes, pastilles et sérigraphie en relief sous le vernis |

En clair : panneau 0,5 / 0, châssis 0,7, touches 0,55, pads 0,85.

**Sérigraphie** : une texture canvas par panneau (2048 px de large), posée 0,004 au-dessus de la surface, transparente, `polygonOffset`. Les logos sont des images blanches teintées à l'encre. Tout est redessiné quand les polices arrivent.

---

## 5. Lumière et rendu

- **Clé** : `DirectionalLight` blanc chaud `#FFF6E8`, intensité 2,2, en (8, 14, 6), seule à porter l'ombre (carte 1024, PCF rayon 4, biais -0,0004). Fixe dans le monde : l'ombre ne bouge pas quand on tourne autour.
- **Ciel** : `HemisphereLight` os vers encre, 0,35 (clair : 0,6).
- **Liseré** : `PointLight` jaune à gauche (-9, 3, 0), intensité 6, décroissance 2 : un fil chaud sur l'arête gauche.
- **Contre-jour** : `DirectionalLight` os 0,9 depuis l'arrière gauche (-5, 2,5, -12), sans ombre : la connectique arrière se lit.
- **Courbe de tons** : ACES Filmic en sombre, Neutral en clair (exposition 1,3) : le blanc et l'orange restent purs.
- **Sol** : un plan à l'encre qui reçoit l'ombre, ombre de contact autour de chaque machine, brouillard radial vers le bord ; en sombre il n'écrit que l'ombre (canevas transparent sur le granite).
- **Rendu à la demande** : une image seulement si quelque chose change. Zéro image au repos. La carte d'ombre n'est refaite que si un objet qui porte une ombre a bougé. Animations par « animateurs » qui disent ce qu'ils ont changé (ombre, couleur seule, rien).
- **Performance** : `InstancedMesh` pour toutes les séries (pads, touches, LED, potards), géométries fusionnées par matière, environ 12 draw calls par machine.

---

## 6. Caméra et mouvement

- Perspective, champ de 30°. Vue d'arrivée : de face, élévation 69° (on lit tout le panneau).
- Orbite maison : glisser pour tourner (élévation 18 à 78°), molette et pincement pour zoomer (0,55 à 2,4), inertie 0,08, retour à la vue par défaut en 500 ms (easeOutCubic). Bouton RESET VIEW quand la vue a bougé.
- Cadrage : la machine tient 78 % de la largeur sur ordinateur (sa largeur projetée au pire angle), 86 % de la hauteur au plus ; 86 à 92 % sur téléphone.
- **Intro** : les machines arrivent éclatées (capot levé, carte sortie) et s'assemblent en 3,1 s, la caméra descend de 40° à 69°.
- **OPEN** (vue éclatée) : le capot monte, recule et se cabre, la carte sort ; 900 ms easeInOutQuart, 80 ms de décalage entre les couches, jamais d'interpénétration.
- **Plusieurs machines** : vue d'ensemble côte à côte ; un clic sur une machine zoome dessus (900 ms easeInOutCubic) ; une fois arrivé, l'autre est cachée (en tournant, elle passerait devant). Sur ordinateur, un volet glisse depuis le bord gauche avec les vignettes 3D des machines.
- Mouvement réduit (`prefers-reduced-motion`) : tout devient des coupes franches.

---

## 7. Gestes et accessibilité

- **Picking** sans `Raycaster` par image : chaque objet interactif est déclaré (boîte ou cylindre dans le repère de son calque), sa silhouette projetée est la zone de clic ; les volumes pleins de la machine cachent ce qui est derrière eux. Au doigt, 24 px de tolérance.
- **Tape** : un objet ne part qu'au relâchement, si le pointeur a bougé de moins de 6 px. Un glisser n'active jamais rien.
- **Potards** : glisser sur l'axe dominant, 150 px pour toute la course ; Maj = dix fois plus fin (comme Ableton) ; molette 2 % par cran (1 % avec Maj) ; double tape = valeur de départ. Course de 270°, sens horaire quand la valeur monte.
- **Jumeaux HTML** : un bouton ou un slider transparent par objet, posé sur sa silhouette à chaque image rendue. Le clavier et les lecteurs d'écran passent par eux, avec un contour au focus.
- **Téléphone** : un doigt ne tourne jamais la vue (il reste aux potards et aux pads), deux doigts tournent et pincent. Machines refaites en hauteur (mêmes pièces, placées autrement), et un Dock repliable en bas avec les commandes en gros boutons.

---

## 8. Le son (Web Audio)

- Le contexte audio naît au premier geste, jamais avant. Rien ne joue tout seul.
- Ordonnancement par anticipation : un réveil toutes les 25 ms programme sur l'horloge audio tout ce qui tombe dans les 100 ms suivantes ; la grille est `ancre + n x pas`, jamais une somme (aucune dérive).
- Le synthé du Voyager est un **AudioWorklet** (calcul échantillon par échantillon : oscillateurs PolyBLEP, filtre en échelle à rétroaction résolue, enveloppes analogiques). C'est le seul moyen d'approcher un vrai son analogique dans un navigateur.
- Sortie : compresseur léger, écrêteur doux (identité sous 0,9), master. Aucun effet à 100 % ne dépasse 0 dBFS.
- Une seule source à la fois : lancer la machine met la piste en pause, et l'inverse.
- Tests : jamais de lecture réelle (`?mute=1` coupe le master, et les rendus se mesurent hors ligne).

**Point crucial pour des platines** : un lecteur intégré venant d'un autre site (iframe SoundCloud, YouTube) ne laisse **pas** toucher à son son. Le navigateur l'interdit. Jog, pitch, EQ et crossfader exigent des fichiers audio décodables par la page : hébergés sur le même domaine, ou servis avec les en-têtes CORS. Les sets en AAC de Sonaa conviennent s'ils sont servis ainsi.

---

## 9. Platines CDJ et table DJM-1000 : traduction proposée

Mêmes conventions : 1 unité vaut environ 30 mm (la MM-808 fait 12,6 x 8 unités, environ 380 x 240 mm).

### 9.1 La platine (façon CDJ)

Réel : environ 330 x 450 mm, donc environ **11 x 15 unités**, un coin léger (avant plus bas) comme la 808.

- **Jog** (la pièce maîtresse), diamètre environ 7 unités :
  - plateau noir mat, la bague extérieure en aluminium brossé (la jupe des potards Moog, en grand), stries radiales fines ;
  - écran central rond (même technique que l'OLED : texture canvas, monospace os sur noir) qui montre la position dans la piste et un repère qui tourne ;
  - un anneau de LED autour du jog (InstancedMesh, une instance par segment) : il tourne avec la lecture.
  - Geste : la rotation suit l'angle du pointeur autour du centre ; le dessus du jog scratche, la bague latérale fait un pitch bend. Inertie quand on lâche, comme l'orbite.
- **PLAY/PAUSE et CUE** : deux gros boutons ronds en caoutchouc, à anneau lumineux (le témoin des boutons de la 808, en cercle). PLAY clignote en pause, fixe en lecture.
- **Hot cues** : 8 pads caoutchouc rétroéclairés (la géométrie des pads de la 808), une couleur par repère.
- **Pitch fader** : long fader vertical, capuchon caoutchouc noir à repère os, sérigraphie de graduation, LED au zéro.
- **Écran principal** : forme d'onde dessinée dans une texture canvas, redessinée au plus 4 fois par seconde.
- **Navigation** : bouton rotatif cliquable (encodeur de la 808), boutons BACK/TAG.

### 9.2 La table (façon DJM-1000, 4 voies)

Réel : à peu près carrée (environ 400 x 400 mm), donc environ **13 x 13 unités**.

- Par voie : TRIM, HI, MID, LOW (potards de la 808, EQ à zéro au centre : course centrée et cran visible comme TONE), un potard de FX couleur, un bouton CUE à témoin, un **fader de voie** long, et un **VU-mètre** en colonne de LED (15 segments : vert, puis orange, puis rouge ; même technique que les LED des pas).
- **Crossfader** horizontal en bas, courbe réglable.
- Master, booth, casque (niveau et mix), section d'effets (sélecteur, temps, niveau, bouton ON qui respire comme OPEN).
- Sérigraphie : numéros de voie en gros, groupes encadrés de crochets fins.

### 9.3 Couleurs sur Sonaa

Sonaa a ses propres jetons, nommés par rôle (`src/design/tokens.css`), un fond granite dans les deux thèmes et un accent vert `#00FF62` (ADR-096). Le langage des machines passe tel quel (matières, lumière, caméra, gestes). Les couleurs se traduisent **par rôle** :

| Rôle sur mauditemachine.com | Valeur ici | À décider pour Sonaa |
|---|---|---|
| Action, navigation, LED « programmé » | orange `#FF6A13` | probablement l'accent `#00FF62` |
| Élément actif, page ouverte | jaune vif `#FFD75E` | l'accent, ou un blanc chaud |
| Lecture en cours (PLAY) | (RUN rouge `#C8442F`) | à choisir : vert accent, ou rouge selon DESIGN.md |
| Niveaux VU | orange, rouge | vert, ambre, rouge (les couleurs d'alerte de Sonaa disent un état) |
| Sérigraphie | os `#F6F1E7` / gris `#434343` | les encres de Sonaa |

---

## 10. Fichiers à lire dans ce dépôt

| Sujet | Fichier |
|---|---|
| Toutes les constantes (couleurs, cotes, lumière, caméra) | `src/v4/theme.ts` |
| Le Stage : rendu à la demande, cadrage, ombres, plusieurs machines | `src/v4/scene/renderer.ts` |
| Matières et gains | `src/v4/scene/materials.ts` |
| Corps de la 808 (coin, chanfreins, connectique) | `src/v4/scene/machine.ts` |
| Pads rétroéclairés | `src/v4/scene/pads.ts` |
| Potards | `src/v4/scene/encoders.ts`, `src/v4/voyager/knobs.ts` |
| Sérigraphie | `src/v4/scene/silk.ts`, `src/v4/voyager/silk.ts` |
| Écran OLED | `src/v4/scene/screen.ts` |
| Picking | `src/v4/scene/hit.ts` |
| Orbite | `src/v4/scene/orbit.ts` |
| Gestes et jumeaux HTML | `src/v4/ui/Hotspots.tsx` |
| Bois | `src/v4/voyager/wood.ts` |
| Carte électronique | `src/v4/scene/pcb.ts` |
| Son : horloge, synthé, effets | `src/v4/audio/clock.ts`, `src/v4/audio/moog.worklet.js`, `src/v4/audio/chorus.ts` |
| Historique des décisions | `docs/v4/spec.md` (R14) |
