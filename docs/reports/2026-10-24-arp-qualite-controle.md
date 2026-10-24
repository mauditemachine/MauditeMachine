# 2026-10-24 : contrôle qualité du MM-ARP, les trois contrôleurs et leurs corrections

Mika : « Pourrais tu controler ARP pour que le son soit d'extreme bonne qualité ?! entre Monark et un synth analog Moog Voyager et un Korg Ms10 »

Suite du travail du 2026-10-23 (`docs/reports/2026-10-23-arp-qualite.md`). Trois contrôleurs indépendants (DSP, caractère, compatibilité) ont relu la branche `fix-lane-audio` (worktree `laneA`) et rendu 25 constats. Chacun a été vérifié avant d'être corrigé (certains étaient plus graves que dit, d'autres déjà couverts), avec les mêmes règles que le travail : un commit par sujet, `node scripts/arp-bench.mjs --check` (x4 et téléphone) à chaque fois, `--update` seulement pour un changement de son voulu et dit dans le commit, le calcul, tsc à 13, les patchs d'héritage au bit près, les ids MIDI inchangés. Rien n'a été joué : Node et un Chromium muet (`--mute-audio`, `?mute=1`). Rien n'est poussé.

## 1. Ce qui a été fait

### Le moteur (`src/v4/audio/moog.worklet.js`)

- **QC-DSP-1, les sous-normaux** (d00cf3c) : les lissages (WAVE, FINE, RES, ENV AMT), les poids de MODE, la sortie du LFO et les enveloppes (SUSTAIN à 0) se bloquaient à 7e-321 après qu'un potard revenait à 0 ; sur x86 le calcul doublait au bout de 10 s (x4, 12 voix, 63 -> 124 % du temps réel). Remis à 0 sous 1e-20 en fin de bloc : 1.00 fois à 20 s. Au bit près.
- **QC-DSP-8, le raccourci de LOAD pour la droite** (61e4917) : il comparait les états de la droite à ceux de la gauche déjà avancée, il ne servait jamais. Comparé avant : LOAD 0.5 et SPACE 0.5 environ 20 % de calcul en moins, au bit près.
- **F1, OVERDRIVE et le contrat F** (9a1cd72) : la branche d'OVERDRIVE avait un demi-échantillon de retard sur le son propre (son ADAA plus le retard `od.wL`), plus le pôle K2 à 16 kHz au téléphone ; les presets à OVERDRIVE changeaient d'aigu (ACID NIGHT au téléphone jusqu'à -2.2 dB). La moyenne de deux échantillons devant la courbe remplace K2 et le retard : le même retard que la FIR du propre. Contrat F contre 35439dc : x4 tous les presets d'usine à OVERDRIVE tenus (EBM +0.74 -> +0.32 dB) ; au téléphone ACID NIGHT -2.19 -> -0.95, ACID -1.23 -> -0.62 dans les bandes, les harmoniques seules à 0.2 dB près (le reste est le repli retiré par S3, comme sur les presets sans OVERDRIVE). Plus propre en plus : OD06 C7 / C8 x4 66.1 / 64.5 -> 70.3 / 70.7 dB. Golden mis à jour (les 13 patchs à OVERDRIVE).
- **QC-CH-1 et QC-CH-6, le MS-10 au niveau de jeu** (7996bbd) : le genou des diodes passait de 1.6 à 6, la table RES -> kappa recalée au niveau de jeu (0.6 / 0.8 / 0.92 / 0.96 / 0.98 / 1 / 1.06), le cri borné au-dessus du seuil, le niveau 0.7. Sur l'arpège INIT, la bosse au-dessus de la bande à RES 0.3 / 0.5 / 0.7 / 0.8 / 0.9 : 2.4 / 3.3 / 3.8 / 4.3 / 5.3 -> 4.6 / 7.7 / 12.1 / 15.0 / 20.6 dB (MOOG 3 / 8.6 / 16.1 / 20 / 25.5) ; le grognement quand la source pousse (à RES 0.8, la bosse retombe de 15.0 à 9.7 dB avec LOAD 1, à 7.9 avec OVERDRIVE 1) ; sonie contre MOOG -0.1 LU à RES 0.3, +0.9 à 0.85. Le preset proposé MS SCREAM : sa bosse 2.5 -> 15 à 17 dB (MOOG 23 à 26).
- **QC-DSP-2 et QC-CH-2, le cri sans raie repliée** (b40a908) : l'asymétrie des diodes par une courbe analytique (y / racine(L² + y²)), effacée de 9 à 13 kHz ; au téléphone, le Korg35 en deux pas par échantillon au-dessus de kappa 0.97. Auto-oscillation, la pire raie sur 100 coupures de 1 à 13 kHz : téléphone -24 dBc (16 % au-dessus de -50) -> -71.3 dBc, ordinateur -36 -> -71.3 ; RES 0.95 -86 / -92 ; la hauteur à 2 cents.
- **QC-CH-3, QC-CH-4, QC-DSP-3, QC-DSP-7, LOAD revoicé et le plafond de sortie** (5f4aae7) : la courbe de LOAD (celle de GLUE : linéaire, un arc, un plafond plat, donc un écrêteur) remplacée par 1.6 tanh(z / 1.6) en ADAA (la table lncosh) : une série d'harmoniques régulière (deux sinus 0.88, LOAD 0.6 : H31 -81 -> -127 dBc ; H5 10 dB sous H3) ; le passe-bas de S3 une seconde fois après LOAD (LOAD 1, deux scies, RES 0.8 : C3 / C5 60.1 / 54.6 -> 84.9 / 80.6 dB en x4) ; la saturation des voix soulagée de LOAD 0.3 à 0.6 (avant, dès 0.1 : LOAD 0.1 à 0.35 sonnait plus propre qu'OFF ; un sinus 0.62 à LOAD 0.25 : H3 -48.6 -> -26.2 dBc, OFF -30.7) ; INIT +1.2 LU à LOAD 0.6 (+2.0 avant, la limite 1.5). La sortie tenue sous son plafond après la décimation : LOAD 1 + OVERDRIVE 1 -2.0 -> -2.98 dBFS, HP + OVERDRIVE + NOISE +0.1 -> -2.97.
- **QC-DSP-4, OVERDRIVE au téléphone** (e20e111) : le passe-bas d'avant le filtre descend avec OVERDRIVE au-dessus des presets d'usine (20 kHz jusqu'à OD 0.45, 14 kHz à 0.65). Deux scies 0.88, coupure 3 kHz, RES 0.8, OD 0.6, C3 à C6 : 58.2 / 53.2 / 44.7 / 50.4 -> 66.5 / 62.5 / 55.5 / 57.8 dB.
- **QC-DSP-5, la sortie des diodes du MS-10** : pas de changement propre, les deux corrections d'avant suffisent (le genou 4 fois plus haut, le passe-bas qui descend avec OVERDRIVE). Le cas du contrôleur (MS-10 ouvert, deux scies 0.88, OD 1, téléphone, C4 à C7) : 46.6 / 44.0 / 39.4 / 39.0 -> 57.3 / 52.4 / 50.1 / 55.7 dB (la cible : 48), plus propre que MOOG aux mêmes réglages (58.4 / 48.5 / 45.1 / 45.2) ; x4 C7 50.6 -> 63.0.
- **QC-CH-9, les rampes MIDI** (3fe2532) : elles visent le message suivant (la moitié de la pente en avance), puis reviennent sur la valeur si le geste s'arrête ; pendant une rampe, le lissage passe de 15 à 10 ms. Le retard sur le Roto-Control : 42.1 -> 13.5 ms (22.1 avant S19), l'escalier à ±4.9 cents (±18 avant S19), à l'écran 36 -> 20 ms. Un son immobile au bit près.
- **F5, les états du bus en tableaux typés** (424addc) : OVERDRIVE, GLUE et l'arrondi de GLUE ; au bit près. Sur un arpège (LOAD, SPACE, WIDE, OVERDRIVE, les deux chemins) : 70 à 120 octets par bloc, 0 ramasse-miettes en 30 s sur une note tenue.
- **F2, les pires cas du calcul** (ddea64f) : mesurés et ajoutés à `cpu.mjs` ; au téléphone, le Korg35 en deux pas saute sa reprise au point (MS-10 + STACK, WIDE, GLUE, RES 0.95 à 8 voix : 1306 -> 1040 µs, sans raie au-dessus de -60 dBc).
- L'en-tête du moteur résume ce contrôle.

### L'interface et la documentation

- **QC-CH-8 et QC-CH-5, les textes INFOS** (47f54ee) : SPACE dit l'écart de clarté qu'on entend (plus doux que l'octave des coupures : sur un arpège, centroïdes 1.12 / 1.28 / 1.73 à SPACE 0.25 / 0.5 / 1) ; MODE dit que les diodes du MS-10 grognent quand la source pousse. `voyager/infos.ts`, `voyager/params.ts`.
- **F3, docs/midi** (2fa3184) : `npm run docs:midi` relancé : le setup Roto ARP 12 a MODE sur cinq crans (MOOG, LP12, MS-10, BP, HP), les cibles `voy:knob:load`, `voy:knob:space`, `voy:knob:fpol` dans la référence (649 cibles), les ids d'avant inchangés.
- `docs/reports/2026-10-23-arp-qualite.md` : chaque chiffre que ce contrôle a changé est annoté « (2026-10-24) » (contrat F, MS-10, LOAD, SPACE, rampes, calcul, la note sur la FM).

### Les outils et les écoutes

- **F4** (15c829b) : `ab.mjs --os 2` rend avec les limites du téléphone (8 voix, STACK 2, WIDE 4), chaque rendu dit son chemin dans le manifeste ; la démo du poids du Voyager à LOAD 0.6 ; la démo MONARK DRIVE ne parle plus de boucle ; MS SCREAM à LOAD 0.4 ; INIT proposé à LOAD 0, 0.4, 0.55, 0.7. `q.mjs gc` : un arpège avec LOAD, SPACE, WIDE et OVERDRIVE ; `cpu.mjs` : les pires cas (`S+W+G+RES95HI`, `S+W+G+LOAD+SPACE+RES95HI`, `ALL`, `MS10+S+W+G+RES95HI`).
- Les écoutes de Mika rendues à nouveau (dossier `arp-q/ab/` du travail, hors dépôt) : les 15 presets d'usine après, les propositions, les démos, et six paires au téléphone (INIT, ACID, TECHNO, EBM, NIGHT DRIVE, ACID NIGHT) ; le `LISEZMOI.txt` réécrit d'après les mesures.
- Les paires d'usine par la chaîne complète, à sonie égale : ordinateur, sonie à 0.02 LU, chaque bande sous 5 kHz à 0.21 dB, de 10 à 16 kHz -0.27 à +0.22 dB (EBM +0.87 dB à 16 kHz avant F1) ; téléphone, sous 5 kHz à 0.07 dB, de 10 à 16 kHz -0.07 à -0.72 dB (ACID NIGHT, le repli retiré).

### Le contrôle final

- Pureté, les 102 mesures : aucune n'a reculé, ni contre 35439dc ni contre le moteur d'avant ce contrôle (33204b4) ; seul OD06 bouge contre 33204b4, en mieux (+1.4 à +6.2 dB).
- `arp-bench --check` x4 et téléphone : au bit près contre le golden (mis à jour dans F1, QC-CH-1, QC-DSP-2, QC-DSP-4 et, pour X MS10 au téléphone seul, F2 : chacun dit dans son commit) ; tsc 13 erreurs (comme avant) ; les ids MIDI inchangés.
- Calcul (`cpu.mjs`, notes tenues, JIT chaud, le meilleur de 5 tours alternés, contre 35439dc ; le temps réel : 2667 µs par bloc). 35439dc n'a ni LOAD, ni SPACE, ni MS-10 : sur ces cas, son « avant » ne fait pas ce travail-là.

| Cas | Téléphone, x2, 8 voix | Ordinateur, x4, 12 voix |
|---|---|---|
| INIT tenu | 716 µs (26.8 %), 0.98 fois | 1426 µs (53.5 %), 0.95 fois |
| STACK + WIDE + GLUE (le pire d'avant) | 831 µs (31.1 %), 0.96 fois | 1948 µs (73.0 %), 0.95 fois |
| RES 0.95, coupure haute | 857 µs (32.1 %), 1.12 fois | 1812 µs (68.0 %), 1.15 fois |
| S + W + G, RES 0.95, coupure haute | 1027 µs (38.5 %), 1.15 fois | 2597 µs (97.4 %), 1.20 fois |
| la même chose + LOAD 1 + SPACE 1 | 1201 µs (45.0 %) | 3039 µs (113.9 %) |
| tout (+ OVERDRIVE, SYNC, FM) | 1339 µs (50.2 %) ; avant 1049 (39.3 %) | 3664 µs (137.4 %) ; avant 2826 (105.9 %) |
| MS-10 + S + W + G, RES 0.95 | 1083 µs (40.6 %) | 2656 µs (99.6 %) |

  Ces pires cas tiennent 8 ou 12 notes à la fois, tout au maximum. Sur la machine de mesure, l'ordinateur dépassait déjà le temps réel avant le travail dans le cas « tout » (105.9 %). Ce que ce contrôle a coûté, contre le moteur d'avant lui (33204b4), au téléphone : STACK + WIDE + GLUE 1.01 fois, avec RES 0.95 1.01, avec LOAD et SPACE 1.04, tout 1.08, MS-10 1.10 (ses deux pas par échantillon près de l'auto-oscillation).

## 2. Décisions prises et pourquoi

- **Le MS-10 recalé au niveau de jeu, pas au point de mesure.** Le travail l'avait calé sur un sinus à 0.01 (là, il collait au modèle publié du Korg35) ; aux niveaux réels, ses diodes écrasaient la résonance. Le genou à 6 rend INIT presque linéaire et laisse le grain aux sons poussés : c'est le MS-10 qu'on joue (il crie quand on le pousse), pas celui du banc de mesure.
- **L'auto-oscillation du MS-10 reste à -3.4 dBFS** (la cible du contrôleur : -6 à -8). Ses deux cibles se contredisent : une variante à -6.4 dBFS (le cri baissé de 10.5 dB au-dessus du seuil) faisait perdre 2.2 LU à l'arpège INIT contre MOOG à RES 0.95, pour une cible de 1 LU. J'ai gardé l'arpège (-1.2 LU au pire de RES 0.9 à 1) ; l'auto-oscillation reste sous le plafond de sortie, 3 dB au-dessus du MOOG.
- **QC-DSP-5 sans ADAA de plus** : mesurée après les deux corrections du MS-10, la sortie des diodes passe la cible ; une ADAA aurait coûté du calcul et un retard de plus sur le bus pour rien d'audible.
- **LOAD en tanh plutôt qu'en courbe algébrique** : la table lncosh existe déjà (les voix, OVERDRIVE) ; son ADAA est exacte et la série d'harmoniques est celle d'une paire de transistors.
- **QC-DSP-4 : le passe-bas descend seulement au-dessus d'OD 0.45** (EBM, le plus fort des presets d'usine) : les sons gardés restent au bit près. Il s'arrête à 14 kHz, la valeur que le contrôleur avait mesurée : plus bas, il retirerait de l'aigu qui s'entend au son poussé. C5 et C6 restent donc sous la cible de 60 dB (55.5 / 57.8).
- **QC-CH-7, le haut assombri : rien changé.** Le passe-bas d'avant le filtre à 22 ou 23 kHz sur ordinateur coûtait de la pureté (à 22 kHz : OD06 C8 70.7 -> 66.9 dB, scie C8 78.5 -> 78.3) pour rendre un peu du haut au-dessus de 14 kHz ; dans la chaîne complète, les presets d'usine perdent au plus 0.27 dB de 10 à 16 kHz.
- **QC-CH-8 : le texte plutôt qu'un croisement selon la fréquence.** Essayé (20 % sous 800 Hz, moins au-dessus) : centroïdes 1.10 / 1.31 / 1.90, pour 0.5 LU de mono perdu ; le mono compte plus qu'un écart que le croisement d'aujourd'hui garde déjà.
- **QC-CH-9 : viser le message suivant, la moitié de la pente en avance.** Mesuré sur le Roto (cc7 rapide) : toute la pente en avance, -10 ms (le son devance le potard) à ±8.1 cents ; la moitié, 13.5 ms à ±4.9 cents ; 0.3, 26 ms à ±3.8. Un potard lent (un message toutes les 40 ms) reste à ±7.5 cents (±5.3 avant). En fin de geste, 31 cents au-dessus pendant un intervalle, puis la valeur.
- **QC-DSP-6, la FM sur une scie : une note, pas de borne.** La borne de Carson ne porte que sur l'opérateur ; borner selon la forme de la porteuse changerait le son des patchs FM gardés. Le rapport du 2026-10-23 dit maintenant que les 86 à 90 dB valent pour une porteuse sinus.
- **F2 : pas de contingence K6 appliquée.** Sur la machine de mesure, le pire cas du téléphone (tout ensemble, 8 voix tenues) reste à la moitié du temps réel (50.2 %) ; la machine de mesure n'est pas un iPhone : le test sur celui de Mika tranchera, et la contingence (relever la porte de la correction, SPACE à 3 notes au téléphone) attend son résultat.
- **INIT : 0.25 n'est plus proposé.** À sonie égale par la chaîne complète, il ne changeait rien (0.25 dB près partout) ; 0.7 est le premier qui passe la règle du contrôleur (+1 dB de 63-250 Hz contre 1-4 kHz).
- **LOAD sur les presets d'usine (0.15 à 0.25) : gardé comme proposition, mais déconseillé** : à sonie égale, moins de 0.5 dB d'écart presque partout. Le LISEZMOI le dit.

## 3. Ce qui reste à faire / points en suspens

- **Mika, à l'écoute** (le `LISEZMOI.txt` et les fichiers) : LOAD au départ (0, 0.4, 0.55 ou 0.7) ; LOAD sur les presets d'usine (déconseillé tel quel) ; ACID NIGHT et NIGHT DRIVE revus ; les cinq presets nouveaux ; le nom du cran MS-10 ; RANDOM ; resserrer les niveaux d'usine.
- **Mika, en main** :
  - sur l'iPhone : un accord tenu (8 notes) avec RES 0.9 ou plus, CUTOFF haut, WIDE ou SPACE, LOAD ; puis la même chose en MS-10 ; s'il craque, je relève la porte de la correction de l'échelle ou je limite SPACE à 3 notes au téléphone ;
  - le Roto-Control : importer `docs/midi/roto/MM ARP (SETUP 12).json` dans ROTO-SETUP (File > Import, setup 12 : MODE sur cinq crans) ; LOAD, SPACE et POLARITY n'y ont pas de potard, à choisir lesquels remplacer.
- **Ouverts, avec leur mesure** :
  - QC-CH-4 : le grave sous la résonance ne tient pas mieux avec LOAD (60 Hz à RES 0.95 : -4.8 dB à LOAD 0, -4.9 à LOAD 1 ; la cible : 1.5 dB de moins perdu) ; il faudrait une part de LOAD dans le premier étage de l'échelle. FEEDBACK (la boucle de Monark) n'est pas revenu.
  - QC-CH-6 : l'auto-oscillation du MS-10 à -3.4 dBFS (cible -6 à -8, voir les décisions).
  - QC-DSP-4 : OD 0.6 au téléphone, C5 / C6 55.5 / 57.8 dB (cible 60).
  - QC-DSP-6 : la FM forte sur une scie replie comme avant (x4 C5 à C8 : 56 à 18 dB).
  - QC-CH-7 : le haut des oscillateurs 0.6 à 1.6 dB plus bas de 14 à 18 kHz (le passe-bas de S3).
  - F5 : selon l'état du JIT de V8, jusqu'à 1 Ko par bloc dans `busTick` avec GLUE sur certains réglages (les objets sont partis, il reste des nombres mis en boîte par l'optimiseur) ; pas de ramasse-miettes mesuré sur une note tenue.
  - F2 : sur la machine de mesure, l'ordinateur à 12 voix tenues dépasse le temps réel dans les pires cas (voir le tableau : 113.9 % avec LOAD et SPACE, 137.4 % avec tout) ; c'était déjà le cas avant le travail avec tout (105.9 %). À vérifier sur le Mac de Mika.
- **Mise en ligne** : la branche `fix-lane-audio` n'est pas poussée ; elle attend l'écoute de Mika.

## 4. Commandes utiles ajoutées

```
node scripts/arp-quality/cpu.mjs --phone --voices 8 --against <moteur>   avec les pires cas (S+W+G+RES95HI,
    S+W+G+LOAD+SPACE+RES95HI, ALL, MS10+S+W+G+RES95HI) ; --cases pour en choisir
node scripts/arp-quality/q.mjs gc        l'arpège LOAD + SPACE + WIDE + OVERDRIVE sur les deux chemins
node scripts/arp-quality/q.mjs zip       le retard des potards MIDI
PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/arp-quality/ab.mjs --url http://127.0.0.1:<port> \
  --tag phone-after --os 2 --set factory --only "INIT,ACID,ACID NIGHT,EBM,TECHNO,NIGHT DRIVE" --out <dossier>
                                         les paires d'usine par le chemin du téléphone (avec ses limites)
```
