# 2026-10-23 : contrôle qualité du MM-ARP, entre Monark, Voyager et MS-10

Mika : « Pourrais tu controler ARP pour que le son soit d'extreme bonne qualité ?! entre Monark et un synth analog Moog Voyager et un Korg Ms10 »

Méthode : un plan en 25 étapes (S0 à S24), appliqué dans l'ordre sur la branche `fix-lane-audio` (worktree `laneA`, à partir de 35439dc). Après chaque étape : son test d'acceptation (`scripts/arp-quality/q.mjs`), le banc de référence (`node scripts/arp-bench.mjs --check`, x4 et téléphone ; `--update` seulement quand le changement de son était voulu, dit dans le commit), le calcul, puis un commit. Trois classes de changement : F (tous les sons deviennent plus propres, le contrat « 0.2 LU, 0.3 dB de 40 Hz à 8 kHz, 0.5 dB de 8 à 14 kHz » vérifié contre la version d'avant), N (un réglage nouveau, au bit près à sa valeur d'avant : les sons gardés de Mika ne bougent pas), D (les réglages d'usine, qui attendent son écoute). Les sources : documentation technique publiée, descriptions de schémas, articles et mesures (Stinchcombe pour le Korg35, Mystran pour l'échelle), aucun enregistrement des instruments.

Aucun son n'a été joué : le moteur tourne dans Node, la chaîne du site dans un OfflineAudioContext de Chromium muet (`--mute-audio`, `?mute=1`). Rien n'est poussé : la branche attend l'écoute de Mika.

## 1. Ce qui a été fait

### Le plancher

- **S0, les outils** (`scripts/arp-quality/`) : les séries de mesure (pureté, résonance haute, SYNC, triangle, silence, réglages pourris, décimation, haut « numérique », coupure, mono, escalier MIDI, mémoire), les mesures de départ du moteur 35439dc (`baseline-35439dc.json`) ; `arp-bench --against` donne la sonie, les tiers d'octave et le contrat F ; `--worklet` rend une autre version.
- **S1, zéro allocation** dans la boucle audio (`audio/moog.worklet.js`) : 85 Ko par bloc avant, un ramasse-miettes toutes les 50 ms ; maintenant aucun en 30 s. Au bit près.
- **S2, la sécurité** : un réglage NaN, infini ou chaîne est ignoré, un réglage hors plage borné ; une garde remet au repos une voix ou le bus qui s'emballe ; plus aucun sous-normal (76 756 avant sur la série de silences) ; le filtre démarre sur le MODE demandé (avant, la première note glissait depuis MOOG).

### Le repliement (les fausses notes métalliques)

- **S3** : un passe-bas à 4 pôles (Butterworth, 20 kHz) devant le filtre de chaque voix. Scie C7 65.4 -> 82.0 dB en x4, 57.6 -> 63.4 au téléphone.
- **S4, S5** : la courbe d'OVERDRIVE et la saturation des voix en ADAA (même courbe tanh, son intégrale lncosh en table) ; au téléphone, un pôle à 16 kHz devant OVERDRIVE. OVERDRIVE 0.6 C7 51.4 -> 66.1 dB (x4), 37.5 -> 55.3 (x2).
- **K1'** : le premier demi-bande du x4 en Kaiser 9 : pire repli -79.9 -> -94.3 dB à cet étage, aucun calcul en plus.
- **S8, la SYNC** : chaque front d'OSC 2 daté dans la remise. Scie esclave +19 C7 39.1 -> 78.2 dB (x4), 32.0 -> 59.6 (x2) ; plus de creux autour des rapports justes.
- **S9, le triangle** en polyBLAMP : TRI C8 63.3 -> 90.5 dB (x4), 50.4 -> 85.6 (x2).
- **S10** : l'indice FM borné au téléphone (largeur de Carson) : FM forte C8 x2 43.0 -> 90.1 dB.
- **S21** : un fondamental au-dessus de 18 kHz s'efface jusqu'à 22 kHz (RANGE 2' et SEMI +7 sur les notes du haut montaient à 75 kHz) : la raie repliée à -26.7 dB devient du silence.

### La résonance

- **S6** : une passe de correction de l'échelle, sous porte (RES 0.865 et coupure haute) : au téléphone, plus de sifflement à RES 0.9 et plus (+16 à +30 dBc avant).
- **S7** : l'auto-oscillation juste : de 100 Hz à 16 kHz à 2 cents près sur les deux chemins (avant -149 cents à 12 kHz au téléphone, à +0.7 dBFS ; maintenant -7.3 dBFS) ; KEY TRACK 1 de C2 à C6 à 3 cents près (avant -10.5).

### Le caractère : Moog Voyager, Monark, MS-10

- **S11, le cœur MS-10** (MODE code 4 du moteur) : le passe-bas Korg35 (Sallen-Key 12 dB, deux diodes 1N4148 tête-bêche, courbe exacte en table). Bosse +5.1 / +12.7 / +18.5 dB (modèle publié +5.1 / +12.7 / +18.7), le grave à 0.08 dB près quelle que soit la résonance, auto-oscillation dès RES 0.91 écrêtée par les diodes (H3 -21.8 dBc).
- **S12, LOAD** : le mélangeur du Moog qui pousse le filtre (la courbe de GLUE en ADAA, une polarisation pour les paires). À 0.1 H3 -50 dBc ; à 0.35 H3 -16 dBc, H2 20 dB dessous ; +1.2 LU ; l'attaque gardée à 0.3 dB.
- **S13, FEEDBACK** : essayé puis retiré (voir les décisions).
- **S14** : l'accent pousse LOAD et écrase les diodes du MS-10 (ACC FILTER) : +5.4 dB d'H3 de la note douce à l'appuyée.
- **S15, MODE à cinq crans dans l'interface** (`voyager/params.ts`, `patch.ts`, `state/factory.ts`, `random.ts`, `screen.ts`, `infos.ts`, `diagrams.ts`) : MOOG, 12, MS-10, BP, HP. Les crans d'avant tombent sur le même filtre, codes du moteur inchangés (`FMODE_CODE`).
- **S16, LOAD dans l'interface** : un TWEAK d'un nouveau groupe FILTER (CLEAN à HOT) ; au téléphone, le cinquième potard de FILTER ; INFOS et sa courbe. Pour faire la place sur ordinateur, le cartouche MM-ARP et SCOPE / INFOS / CLOSE montent au-dessus d'OUTPUT (`scene/pcb.ts` : une zone dégagée de plusieurs rectangles ; `scene/tweaklayout.ts` : `title.apart`).
- **S17, SPACE** : les deux passe-bas du Voyager, la gauche plus sombre, la droite plus claire, jusqu'à une octave de chaque côté ; 20 % croisés pour que le mono tienne (-0.4 à -1.2 LU, creux au plus -2.5 dB).
- **S18, POLARITY** : le contour du filtre ouvre (POS) ou ferme (NEG), miroir exact jusqu'à 5 octaves (MOOG), 4 (MS-10).
- Chaque réglage nouveau (LOAD, SPACE, POLARITY) : 0 ou POS au départ et pour un son gardé, une ligne d'empreinte ajoutée seulement quand il quitte sa valeur d'avant (`ADDED_V3` à `ADDED_V5`), une cible MIDI à son id, un texte INFOS, une courbe, une place sur ordinateur et au téléphone.

### Le geste et les effets

- **S19** : les messages MIDI sur CUTOFF, RES et ENV AMT vont en ligne droite d'un message à l'autre (sur l'intervalle moyen des derniers messages) : l'escalier d'un filtre qui chante sous un Roto-Control passe de +/-18 à +/-3 cents.
- **S20** : le chorus Juno lit ses coefficients entre deux phases voisines (`audio/chorus.worklet.js`) : erreur à 10 kHz -62.6 -> -85.4 dB, niveau mouillé identique. Sert aussi au chorus du MM-RYTM et à TAPE.

### Les écoutes pour Mika (S22)

- `scripts/arp-quality/ab.mjs` : la chaîne complète du site (moteur, chorus, BASS MONO, DELAY, TAPE, REVERB) dans Chromium muet, 8 mesures, mêmes notes et même graine pour le site d'avant (35439dc) et celui d'aujourd'hui, WAV 48 kHz 24 bits.
- `scripts/arp-quality/proposals.mjs` : ce que S23 changerait (LOAD sur les presets d'usine, ACID NIGHT et NIGHT DRIVE revus, INIT à LOAD 0 / 0.15 / 0.25 / 0.35, cinq presets nouveaux : MS SCREAM, MONARK DRIVE, SPACE INDIE, MS HYPNO, RES PING), chaque proposition calée en sonie sur le preset d'aujourd'hui.
- `arp-bench --proposals` : les mêmes propositions, moteur seul.
- Livré à Mika : 15 presets d'usine avant / après, 17 propositions, 5 presets nouveaux, 13 démos (le poids du Voyager, la boucle Monark, le cri du MS-10, les enveloppes, la vie des oscillateurs avant / après) et un `LISEZMOI.txt` (quoi écouter, les mesures, ses décisions).
- Presets d'usine, avant / après par la chaîne complète : sonie à 0.02 LU près, crête à 0.2 dB, centroïde à 5 Hz : les sons gardés ne bougent pas, ils sont plus propres.

### Le contrôle final (S24)

- Toute la batterie contre 35439dc : aucune des 102 mesures de pureté n'a reculé ; sous-normaux 0 ; aucun NaN ; décimation ±0.0004 dB jusqu'à 16 kHz, repli au plus -80.2 dB ; Node et Chromium identiques à -150 dB près (INIT, ACID, X ALL FULL, X MS10, X SPACE, X SPACE MS10, X NEG, x4 et téléphone) ; 0 ramasse-miettes en 30 s.
- Calcul, téléphone (x2, 8 voix tenues) : 0.96 fois celui d'avant ; le pire cas d'aujourd'hui (STACK, WIDE, GLUE) 831 µs par bloc contre 866 ; avec LOAD 1 et MS-10 en plus 915 µs (1.06 fois le pire d'avant, la règle en permettait 1.11) ; la correction de l'échelle au pire (RES 0.95, coupure haute) 847 µs (0.98 fois). Ordinateur (x4, 12 voix) : 0.94 fois.
- L'en-tête du moteur décrit le contrôle qualité ; `scripts/arp-quality/README.md` les outils.

| Cible | Départ | Final |
|---|---|---|
| Q1 scie C7 x4 / x2 | 65.4 / 57.6 | 82.0 / 63.4 (cible 80 / 62) |
| Q1 OVERDRIVE 0.6 C7, C8 x4 | 51.4, 45.4 | 66.1, 64.5 (65, 63) |
| Q1 OVERDRIVE 0.6 C7, C8 x2 | 37.5, 32.5 | 55.3, 53.7 (52, 50) |
| Q1 SYNC, rapports justes (0 à +24) | 31-33 / 24-26 | 66.8-75.5 / 49.1-56.5 (60 / 46) ; +31 : 62.5 / 45.7 ; creux 0 à 4.5 dB |
| Q1 TRI C8 x2 | 50.4 | 85.6 (60) |
| Q1 FM forte x2 | 32.5-43 | FM1R35 C8 90.1 ; FM06R2 C8 45.2 (cible 48, ouvert) |
| Q1 MS-10 | - | scie C7 RES 0.8 83.8 / 72.8 ; auto-oscillation 8-12 kHz 25-35 (ouvert) |
| Q1 LOAD à fond | - | 73.5 / 53.5 (66 / 50) |
| Q2 décimation | - | ±0.0004 dB, -80.2 dB |
| Q3 escalier MIDI | ±18 cents | ±3.1 / ±3.0 cents (cible ±3) |
| Q6 sous-normaux | 76 756 | 0 |
| Q7 réglages pourris | NaN jusqu'à la fin | fini, rien ne reste |
| Q8 ramasse-miettes | 466 / 30 s | 0 |
| Q11 mono | - | presets à -1.2 LU au pire ; SPACE -0.4 à -1.2 LU |
| Q12 parité | -180 dB | -150 dB au pire (cible -120) |
| C6 bosse du MS-10 | absente | +5.1 / +12.7 / +18.5 dB |
| C9 auto-oscillation | -11 cents à 4 kHz, -149 à 12 kHz (x2) | ±2 cents de 100 Hz à 16 kHz |
| C22f contour négatif | absent | miroir exact |
| C22h KEY TRACK | -10.5 cents | ±3 cents |
| C22i stéréo | WIDE seul | SPACE, coudes à 20 % de 2^(2s) |

## 2. Décisions prises et pourquoi

- **Les sons gardés d'abord.** Tous les réglages nouveaux sont au bit près à leur valeur d'avant (vérifié à chaque étape sur les 38 patchs du banc, x4 et téléphone). Les étapes F n'ont changé que la propreté, prouvée par le contrat F.
- **FEEDBACK (S13) retiré.** À LOAD 1, la courbe de LOAD est déjà au plafond : la rétroaction n'y donnait que +0.26 dB de 60 à 150 Hz au lieu de +2 à +5. LOAD sort sans elle (la contingence prévue).
- **La tanh gardée pour OVERDRIVE et les voix**, en ADAA par une table de lncosh, plutôt que la courbe algébrique du plan : celle-ci changeait le timbre des sons gardés dès qu'OVERDRIVE monte (H3 -2.8 dB, H5 -6.1 dB à OVERDRIVE 1).
- **MS-10 au milieu de MODE**, comme RND dans SHAPE : les crans d'avant (0, 1/3, 2/3, 1) et un Roto à quatre crans tombent tous sur le même filtre ; les codes du moteur ne bougent pas.
- **Un groupe FILTER dans les TWEAKS** pour LOAD, SPACE et POLARITY : la rangée du bas n'avait plus de place. POLARITY y est plutôt que dans PERFORMANCE, qui était plein.
- **SPACE à 20 % croisés** : sans eux, le mono perdait jusqu'à 2.6 LU ; avec, 1.2 au pire. L'écart des filtres suit `s (1.25 - 0.25 s)` octave pour rester à 20 % de la cible malgré le croisement.
- **Les rampes MIDI sur l'intervalle moyen** (x1.1) : les messages tombent sur des blocs de 2.7 ms, et sans moyenne la pente sautait de 20 % à chaque message. Le prix : le potard suit un message plus tard (cc7 rapide 22 -> 42 ms, glisser à l'écran 30 -> 36 ms).
- **Le centroïde abandonné pour SPACE** : il dépend du contenu ; les coudes des deux filtres sur du bruit mesurent l'écart lui-même.
- **RES PING** : son oscillateur passe de 0.45 à 0.85 dans la proposition, sinon il sortait 11 dB sous les autres ; il reste 2 dB sous la médiane à VOLUME 1.
- **Rien de S23 appliqué** : le départ, les presets d'usine et RANDOM restent ceux d'aujourd'hui (MS-10, LOAD, SPACE et POLARITY ne sont jamais tirés par RANDOM : poids 0 et valeurs d'avant, les tirages d'avant inchangés).

## 3. Ce qui reste à faire / points en suspens

- **Mika, à l'écoute** (les fichiers et le LISEZMOI) :
  - LOAD au départ : 0, 0.15, 0.25 ou 0.35 ?
  - LOAD sur les presets d'usine : tous, certains ou aucun ?
  - ACID NIGHT et NIGHT DRIVE revus : oui ou non ?
  - les cinq presets nouveaux : lesquels garder ?
  - resserrer les niveaux des presets d'usine (de -20.6 à -31.6 LUFS) ?
  - le nom du cran : MS-10, MS ou K35 ?
  - RANDOM : tirer MS-10, LOAD, SPACE, POLARITY ?
  - ensuite S23 (classe D) applique ses choix.
- **Mika, en main** :
  - le Roto-Control : le setup ARP a ses 32 potards, LOAD, SPACE et POLARITY n'y sont pas ; choisir lesquels remplacer, puis renvoyer la configuration (MODE a cinq crans) ;
  - sur l'iPhone, un son avec SPACE et WIDE ensemble : s'il craque, limiter SPACE à 3 notes au téléphone.
- **Mise en ligne** : la branche `fix-lane-audio` n'est pas poussée.
- **Ouverts, avec leur mesure** :
  - FM06R2 C8 au téléphone 45.2 dB (cible 48) : la scie porteuse sous FM, une borne plus basse ternirait le son ;
  - MS-10 en auto-oscillation à 8-12 kHz : pureté 25 à 35 dB (cible 50 à 60), il faudrait suréchantillonner la boucle ;
  - RES 0.9 au téléphone de 12 à 18 kHz : la pire raie, -40 à -52 dBc, est la résonance elle-même (cible -50) ;
  - le potard à l'écran suit à 36 ms (cible 20 ; 18.5 lissé) ;
  - SPACE coûte +83 µs au téléphone (budget 70 ; WIDE seul +77) ;
  - Q5 sur un arpège : sous 20 Hz à -30 dB, comme avant (le contour des notes, pas un continu) ;
  - ordinateur « au plus 50 % » : sur la machine de mesure, le pire cas à 12 voix fait 72.5 % (77.2 % avant) ; le Mac de Mika est bien plus rapide.
- **Options remises à plus tard** (si Mika les demande après l'écoute) : la scie courbe du Voyager, des enveloppes et un GLIDE plus longs, un bruit rose, un passe-haut devant le filtre.

## 4. Commandes utiles ajoutées

```
node scripts/arp-quality/q.mjs all                          toute la batterie (ms10, load, space, fpol, zip, top compris)
node scripts/arp-quality/q.mjs purity --against <moteur>    deux versions côte à côte
node scripts/arp-quality/cpu.mjs --phone --voices 8 --against <moteur> [--set '{"load":1,"fmode":4}']
node scripts/arp-quality/chorus.mjs [--against <chorus.worklet.js>]
node scripts/arp-bench.mjs --check [--phone] [--against <moteur>] [--worklet <moteur>] [--proposals] [--browser]
PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/arp-quality/ab.mjs --url http://127.0.0.1:<port> \
  --tag after --out <dossier> --set factory,proposals,demos
```
