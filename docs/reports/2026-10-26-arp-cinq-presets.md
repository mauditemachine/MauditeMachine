# 2026-10-26 : MM-ARP, les cinq presets nouveaux deviennent des presets d'usine

Mika : « garde l'en-tete a places fixes, ajoute les 5 presets »

Suite des travaux du 2026-10-23 et 24 (`docs/reports/2026-10-23-arp-qualite.md`, `docs/reports/2026-10-24-arp-qualite-controle.md`). Mika a écouté les propositions du contrôle qualité et tranché deux points : l'en-tête PAGE du MM-RYTM à places fixes reste, et les cinq presets nouveaux du MM-ARP (MS SCREAM, MONARK DRIVE, SPACE INDIE, MS HYPNO, RES PING) entrent dans les presets d'usine. Le travail est dans la branche `fix-lane-audio` (worktree `laneA`, à jour de la production, 6fa99ed), commit 3a20b7b, puis contrôlé une seconde fois. Rien n'a été joué : les rendus dans Node et dans un Chromium muet (`--mute-audio`, `?mute=1`), l'écran des presets sans RUN ni note. Pas encore en ligne : la branche n'est pas poussée.

## 1. Ce qui a été fait

### Les presets (`src/v4/state/factory.ts`)

- **Les cinq à la suite d'ACID NIGHT** : `state/presets.ts` numérote les presets d'usine par leur place, donc `factory-arp-0` à `13` gardent leur id et les nouveaux sont `factory-arp-14` à `18` (19 presets d'usine pour le MM-ARP).
- **Leurs potards tels quels** : ceux de `scripts/arp-quality/proposals.mjs` (`NEW_PRESETS`), vérifiés champ par champ après `arpFactory`, plus VOLUME. Deux constantes ajoutées pour les écrire lisiblement : `LFO_TO['W+CUT']` (SPACE INDIE) et `DLY` (DLY TIME, MS SCREAM).
- **VOLUME calé comme à l'écoute** (`ab.mjs`, la chaîne complète, 8 mesures, au tempo et au swing de leur style, x4) sur la sonie médiane des quinze presets d'usine d'avant, INIT compris (-23.71 LUFS). Ce sont les mêmes sons que les écoutes N1 à N5 du 2026-10-24.

| Preset | id | VOLUME | Sonie (LUFS) ordinateur / téléphone | Crête (dBFS) ordinateur / téléphone |
|---|---|---|---|---|
| MS SCREAM | factory-arp-14 | 0.601 | -23.72 / -23.73 | -8.83 / -8.86 |
| MONARK DRIVE | factory-arp-15 | 0.564 | -23.73 / -23.74 | -12.50 / -12.12 |
| SPACE INDIE | factory-arp-16 | 0.663 | -23.71 / -23.70 | -10.71 / -10.40 |
| MS HYPNO | factory-arp-17 | 1 | -24.03 / -24.10 | -7.28 / -6.91 |
| RES PING | factory-arp-18 | 1 | -26.15 / -26.13 | -8.88 / -8.89 |

  Les quinze d'avant, dans les mêmes rendus : de -31.62 (MINIMAL) à -20.59 LUFS (INDIE PULSE), crêtes de -10.83 à -7.30 dBFS (ROLLING) à l'ordinateur, de -10.89 à -7.98 dBFS (TECHNO) au téléphone. Les cinq tiennent dans cet écart de sonie, sans écrêtage ; MS HYPNO a la crête la plus haute des presets d'usine (-7.28 contre -7.30 à l'ordinateur, 1.1 dB au-dessus de TECHNO au téléphone).
- **La règle des 4 dB sous le kick** (commentaire de `factory.ts`, 2026-10-07) ne tenait plus pour aucun preset d'usine depuis VOLUME_K 0.66 (2026-10-10) et le MM-RYTM remonté de 4 dB (2026-10-18) : un kick seul du kit de départ crête à -9.4 dBFS au même point, les presets d'avant vont de 2.1 dB au-dessus à 1.4 dB en dessous. Le commentaire le dit maintenant.

### Les bancs et les écoutes

- **`scripts/arp-bench.mjs`** : le tempo et le swing des cinq dans `STYLE` ; 52 patchs (INIT, 19 presets d'usine, 12 cas X, 20 LEGACY). `--check` sur le code nouveau avant `--update`, ordinateur et téléphone : les 42 entrées d'avant au bit près, LEGACY compris ; `--update` n'a fait qu'ajouter les 10 entrées nouvelles (les cinq et leur version LEGACY) à `scripts/arp-bench.golden.json`. `--proposals` saute les cinq.
- **`scripts/arp-quality/ab.mjs`** : le `STYLE` des cinq vient de `NEW_PRESETS` ; ni LOAD proposé (P) pour eux, ni place dans la médiane de VOLUME des rendus N (les quinze d'avant), donc les rendus N se reproduisent. `proposals.mjs` note la décision et rappelle qu'un changement de `NEW_PRESETS` doit être reporté dans `factory.ts`.
- **Les écoutes de Mika** (dossier `arp-5/ab/` du travail, hors dépôt) : les 20 rendus d'usine à l'ordinateur et au téléphone (00 à 14 les presets d'avant, 15 à 19 les nouveaux) et un `LISEZMOI.txt` avec le tableau ci-dessus.

### L'interface, le MIDI et la documentation

- **L'écran des presets, contrôlé muet** (Chromium `--mute-audio`, `?mute=1`, jamais RUN, aucune note) : desktop 1440x900 et téléphone 390x844 DPR 3 tactile, le mode preset ouvert depuis l'écran, NEXT sur toute la liste : 19 presets d'usine (plus un preset de Mika au format d'avant, posé pour le contrôle), chacun charge exactement ses potards et sa suite d'accords, les quatorze d'avant identiques à la production (6fa99ed), aucune erreur de page ni de console.
- **Inchangés par construction** : le navigateur et le mode preset (ils lisent la liste, sans compte), RANDOM (ses propres styles), les cibles MIDI (aucune par preset ; `docs/midi` régénéré dans un dossier temporaire : les 649 cibles et les six setups identiques, seule la date change, donc `docs/midi` n'est pas touché), les textes INFOS.
- **L'en-tête PAGE du MM-RYTM à places fixes** (SB-13, RB3-4) : gardé tel qu'il est en ligne, aucun changement de code.
- **La documentation** : spec R14-312 (`docs/v4/spec.md`) ; `README.md` (dix-neuf presets d'usine du MM-ARP, ids `factory-arp-0` à `18`) ; `docs/reports/2026-10-23-arp-qualite.md`, `2026-10-23-audit-complet-mm-studio.md` (RB3-4 tranché) et `2026-10-24-arp-qualite-controle.md` annotés « 2026-10-26 ».

### Le contrôle

- tsc : 13 erreurs, la même liste qu'avant (déjà là en production).
- Une seconde passe indépendante sur une copie de 3a20b7b : `arp-bench --check` x4 et téléphone « aucun changement de son » (52 patchs) ; les 20 rendus refaits par `ab.mjs` aux mêmes chiffres, à l'ordinateur et au téléphone ; l'écran des presets comparé potard par potard à la production et à `NEW_PRESETS` ; les cibles MIDI identiques. Le seul constat : ce rapport manquait.
- Avec ce rapport, les mêmes contrôles refaits sur une copie du dépôt (seul `docs/reports` change) : tsc 13, la même liste ; `arp-bench --check` x4 et `--phone` « aucun changement de son » ; l'écran des presets muet, desktop et téléphone, les 19 presets d'usine chargés à l'identique, aucune erreur.

## 2. Décisions prises et pourquoi

- **À la suite, pas rangés par style** : les ids d'usine suivent la place dans la liste (`state/presets.ts`) et le mode preset retient le dernier chargé par son id. Insérer les cinq au milieu aurait décalé les ids des presets d'avant ; à la suite, rien de ce qui existe ne bouge (comme pour les quatre du 2026-10-21).
- **Les potards de l'écoute, sans retouche** : Mika a choisi ce qu'il a entendu (N1 à N5). Le seul réglage fait à la main est VOLUME, par la même méthode que pour les écoutes, pour que le son chargé soit celui du fichier.
- **MS HYPNO et RES PING à VOLUME 1, sous la médiane** : la correction est bornée à 1 (le haut de la course). Ce sont des sons minimaux, comme MINIMAL (-31.6 LUFS) ; les monter plus haut demanderait de toucher à leurs potards de son, et ce ne serait plus ce que Mika a écouté.
- **MS HYPNO garde la crête la plus haute** : 0.02 dB au-dessus de ROLLING à l'ordinateur, sans écrêtage. Le baisser l'éloignerait encore de la sonie médiane ; c'est à l'oreille de Mika de dire si les attaques sont trop fortes, surtout au téléphone (-6.91 dBFS).
- **Ni tempo ni swing dans le preset** : comme les quatorze autres, un preset du MM-ARP porte ses potards et sa suite d'accords ; le tempo et le SWING sont ceux du MM-RYTM. Les bancs gardent le tempo d'écoute de chacun (`STYLE`).
- **Le commentaire du kick corrigé, pas les niveaux** : recaler tous les presets sur l'ancienne règle aurait changé les quatorze d'avant, que personne n'a demandé ; leurs VOLUME suivent la sonie depuis les 2026-10-21 et 22.
- **Le golden ajouté, pas réécrit** : `--check` avant `--update` prouve que les 42 sons d'avant n'ont pas bougé d'un bit ; `--update` n'ajoute que les dix nouveaux.
- **`docs/midi` laissé tel quel** : régénéré à part, il ne changeait que sa date.
- **Le reste de la classe D attend** : Mika n'a tranché que les cinq presets et l'en-tête ; LOAD d'INIT, LOAD sur les presets d'usine et ACID NIGHT / NIGHT DRIVE revus ne sont pas appliqués.

## 3. Ce qui reste à faire / points en suspens

- **Mika, à l'écoute** :
  - **MS HYPNO au téléphone** : sa crête est à -6.91 dBFS, la plus haute des presets d'usine (1.1 dB au-dessus de TECHNO). S'il te semble trop fort sur les attaques, dis-le : je baisse son VOLUME.
  - RES PING reste plus bas que les autres (-26.15 LUFS) même à VOLUME 1 : voulu, un son minimal. À remonter seulement si tu le trouves trop discret.
- **Mise en ligne** : après l'écoute, `fix-lane-audio` est fusionnée et poussée (déploiement par `pages.yml`), après tsc, `node scripts/arp-bench.mjs --check` (x4 et `--phone`) et `npm run smoke:v4` sur un build de production, comme le 2026-10-24. Rien n'est poussé pour l'instant.
- **Toujours en attente du 2026-10-24** (voir son rapport) : LOAD au départ (0, 0.4, 0.55 ou 0.7), LOAD sur les presets d'usine, ACID NIGHT et NIGHT DRIVE revus, le nom du cran MS-10, RANDOM (tirer MS-10, LOAD, SPACE, POLARITY), resserrer les niveaux d'usine ; le test iPhone (accord tenu, RES haute, WIDE ou SPACE, LOAD, puis MS-10) ; le setup Roto 12 à importer et les potards à céder à LOAD, SPACE et POLARITY.

## 4. Commandes utiles ajoutées

Pas de script nouveau ; les bancs connaissent les cinq presets :

```
node scripts/arp-bench.mjs --check                 52 patchs (19 presets d'usine), ordinateur
node scripts/arp-bench.mjs --phone --check         la même chose par le chemin du téléphone
node scripts/arp-bench.mjs --only "MS SCREAM,MONARK DRIVE,SPACE INDIE,MS HYPNO,RES PING"
PLAYWRIGHT_MODULE=$(npm root -g)/playwright node scripts/arp-quality/ab.mjs --url http://127.0.0.1:<port> \
  --tag after --set factory --only "MS SCREAM,MS HYPNO" --out <dossier>
                                                   leurs rendus par la chaîne complète (--os 2 : le téléphone)
```
