# 2026-11-23 - MM-ARP v49 : LATENCY ZERO et optimisation du moteur audio

Demande de Mika : « Je voudrais que tu optimises a fond ! je veux soulager au max le CPU et eviter a tout prix la
latence sur Ableton, le moins de ms possible. » Cette session touche seulement le moteur audio (plugin/mm-arp/dsp et
plugin/mm-arp/src/PluginProcessor.*). La face (src/v4/**, PluginEditor.*) n'a pas change.

Toutes les mesures : hors ligne, en memoire, aucun son joue. Machine de test : Xeon cloud 2.1 GHz partage (4 coeurs),
meilleur de 3 passages, 2 s mesurees apres 1 s de mise en route ; les pourcentages sont des % d'un coeur de CETTE
machine (un Mac Apple Silicon recent : 2 a 4 fois moins). Bruit de mesure d'une scene a l'autre : +/- 8 % ; les
moyennes de la banque (40 presets) sont plus fiables que les lignes isolees.

## 1. Ce qui a ete fait

- Nouveau reglage hote `xLatency` (LATENCY : EXACT / ZERO), en fin de liste (indice 263, 264 reglages). ZERO pour une
  instance neuve ; un projet d'avant (sans ce reglage) s'ouvre en EXACT et sonne au bit pres comme avant.
- `dsp/Halfband.h` (nouveau) : demi-bandes RII polyphases a phase minimale (deux chaines de passe-tout du premier ordre,
  conception elliptique selon la methode de HIIR), decimateur 2 -> 1 et interpolateur 1 -> 2, en double, sans allocation.
- `dsp/Voyager.{h,cpp}` : en ZERO, les trois decimateurs RIF a phase lineaire du moteur (63 / 31 / 23 points de Kaiser,
  16 a 21 echantillons de latence) deviennent des demi-bandes RII (8 / 4 / 5 coefficients) : `latencySamples()` = 0 a
  tout taux. `VoyagerOptions::zeroLatency`, `setZeroLatency()` (le changement attend le silence, comme QUALITY).
  EXACT (le defaut du moteur) : rien ne change, voyager_compare 85/85.
- `dsp/Decap.{h,cpp}` (DISTO) : en ZERO, le surechantillonnage x2 / x4 / x8 par les memes demi-bandes RII (aller et
  retour) au lieu des RIF de 33 points par phase : plus les 32 echantillons de retard (jamais declares a l'hote). Le
  multibande garde ses taux et la meme phase dans toutes les bandes (les etages lineaires manquants sont rejoues apres la
  saturation), le sec de MIX passe par le meme aller-retour, la boucle du FEEDBACK compte le nouveau retard.
- `dsp/ArpFx.{h,cpp}` : en ZERO, WARMTH (master) par demi-bandes RII (plus les 39 echantillons non declares, le son direct
  en phase) ; le DELAY du site s'endort quand son envoi est a 0 et que rien n'en sort depuis plus que sa ligne (2 s) :
  lignes et filtres a zero, plus rien n'est calcule, reveil au premier envoi.
- `dsp/Sky.{h,cpp}` (BigSky, la reverbe HALL des instances neuves) : en ZERO, les 16 sinus de modulation par echantillon
  (8 lignes x 2) par rotation de phaseurs, recales sur les phases exactes tous les 1024 echantillons.
- `src/PluginProcessor.{h,cpp}` : le reglage LATENCY (migration d'un projet d'avant en EXACT), le moteur, la DISTO,
  WARMTH, le DELAY et la BigSky le suivent ; la latence declaree suit celle du moteur (`syncLatency`, sur le timer du thread
  du message : en EXACT elle change avec QUALITY et ENGINE, ce qui n'etait pas declare avant ; en ZERO elle reste a 0).
- `extra-params.json`, `src/ExtraTable.inc` (regenere), banque d'usine regeneree (`xLatency: 1` dans chaque preset,
  toujours seche).
- Tests : `tests/latency_test.cpp` (nouveau, dans la CI), `tests/host_test.cpp` (6 controles v49, compteurs a 264),
  `tests/cpu_bench.cpp` (taille des blocs, moteur both, meilleur de N, latence declaree, scenes EFFETS LOURDS / DISTO
  SEULE / DISTO 3 BANDES / WARMTH SEULE, MMARP_LATENCY, MMARP_HASH, MMARP_DUMP).
- `.github/workflows/plugin-arp.yml` : l'etape latency_test (YAML valide).

## 2. La latence

### Avant (v48) : tout ce qui retarde le son

| Source | Echantillons | 44.1 kHz | 48 kHz | Declaree a l'hote ? |
|---|---|---|---|---|
| Decimateurs du moteur, CLASSIC ECO x2 / PRO STD x2 | 16 | 0.36 ms | 0.33 ms | oui, a prepareToPlay seulement |
| Decimateurs, CLASSIC STD x4 / PRO HQ x4 | 19 | 0.43 ms | 0.40 ms | oui, idem |
| Decimateurs, CLASSIC HQ x8 (et l'export HQ en CLASSIC) | 21 | 0.48 ms | 0.44 ms | oui, idem |
| PRO ECO x1 | 0 | 0 | 0 | - |
| DISTO engagee (RIF 33 points par phase) | +32 | 0.73 ms | 0.67 ms | NON : le son arrive en retard sur la grille |
| WARMTH engagee (x4 local) | +39 | 0.88 ms | 0.81 ms | NON |
| FLANGER a travers zero, engage | +2.5 ms | 2.5 ms | 2.5 ms | NON (propre a l'effet) |
| Ancienne pedale DISTORTION (masquee, convertie) | +39 | | | NON (plus jamais active) |
| Convolution CLASSIC, BigSky, DELAY, EQ, HELL | 0 | | | |

- Pire cas usuel (CLASSIC STD + DISTO + WARMTH) : 19 + 32 + 39 = 90 echantillons (2.0 ms a 44.1 kHz), dont 71
  (1.6 ms) jamais compenses par Ableton.
- La latence changeait en cours de jeu sans etre declaree : QUALITY ou ENGINE changes en jouant faisaient passer le
  moteur de 16 a 19 ou 21 echantillons, l'hote gardait l'ancienne valeur jusqu'au prochain prepareToPlay.
- MIDI : aucune latence interne. Les notes du clip et de l'arpege partent a l'echantillon pres dans le bloc (la file
  du moteur est lue a chaque echantillon), sans file de 128 depuis la v24.

### Apres (v49)

| Mode | Declaree | Retard de groupe au grave (non declare, pas un retard pur) |
|---|---|---|
| ZERO (instances neuves) : toutes QUALITY, CLASSIC et PRO, temps reel et export, 44.1 / 48 / 96 kHz | **0, constante** | moteur 1.7 (x2), 2.4 (x4), 2.8 (x8) ech. ; DISTO +5.6 ; WARMTH +4.8 |
| EXACT (projets d'avant) | 16 / 19 / 21 selon QUALITY et ENGINE, **re-declaree quand elle change** | comme avant |

- Pire cas ZERO (moteur x4 + DISTO + WARMTH) : 0 declare, environ 13 echantillons de retard de groupe au grave (0.3 ms,
  comme un filtre analogique), contre 90 echantillons (dont 71 non compenses) avant. Le FLANGER a travers zero garde ses
  2.5 ms (l'effet en a besoin pour passer par zero).
- En ZERO la latence ne bouge jamais, meme quand QUALITY, ENGINE ou l'export changent : Ableton n'a jamais a recompenser.

### Le son de ZERO (latency_test, CI)

- Filtres seuls (cascade x2 / x4 / x8, 44.1 et 48 kHz) : amplitude a 0.0005 a 0.0009 dB des RIF jusqu'a 18 kHz ;
  repliement retombant sur 0..20 kHz au pire -95.4 dB, contre -80.2 dB (48 kHz) et -26 dB (44.1 kHz, la bande de
  transition des RIF) avant : jamais pire, souvent bien meilleur.
- Moteur (CLASSIC x2 / x4 / x8, PRO x1 / x2 / x4, 44.1 et 48 kHz, un arpege brillant) : spectre par tiers d'octave de
  50 Hz a 18 kHz a 0.012 a 0.024 dB d'EXACT ; ZERO en avance de 14 a 18 echantillons sur EXACT.
- DISTO : niveau sature a 0.003 dB d'EXACT ; 3 bandes en petit signal (coupures 1 et 10.9 kHz) a 0.001 dB ; le sec de
  MIX plat a 0.0000 dB ; CLEAN LOW + PUNISH v2, 3 bandes + FEEDBACK + MORPH : finis, a 0.007 dB d'EXACT.
- WARMTH : petit signal plat a 0.0003 dB, niveau engage a 0.004 dB d'EXACT.
- BigSky (5 machines, MOD 80 %) : ecart -140 dB sous la crete. DELAY endormi : identique a EXACT au bit pres dans le
  scenario teste.
- Processeur complet (host_test, DISTO + WARMTH + moteur) : sonie a 0.013 dB d'EXACT.

## 3. Le CPU : avant / apres

En resume (ZERO, le mode des instances neuves, contre la v48) :
- **effets lourds** (DISTO PUNISH + CLEAN LOW, HELL v2 THE DESCENT a 100 %, HALL avec EQ / WIDTH / FREEZE, DELAY,
  WARMTH) : -18 a -25 % au chronometre, -17 % en instructions ; la DISTO seule -14 a -29 %, l'etage DISTO 8.5 -> 5.5 %
  d'un coeur (une bande) et 12.5 -> 8.5 % (3 bandes) ; WARMTH 1.4 -> 0.85 % ;
- **une instance neuve (INIT, reverbe HALL)** : -11 a -16 % (la BigSky 3.9 -> 2.9 %) ;
- **la banque d'usine** : PRO STD -7 % (3.65 -> 3.41 %), PRO HQ -8 %, CLASSIC dans le bruit ; en instructions -6 a -7 %
  par preset ; le cas de Mika (8 voix) -4 a -5 % en instructions (le moteur reste l'essentiel : voir 6.) ;
- **une instance a l'arret** (regime etabli) : -20 % (0.40 -> 0.32 % en PRO), le DELAY endormi ;
- **EXACT** (les projets d'avant) : le meme calcul qu'avant, +0.0 a +0.2 % d'instructions, +1 % avec la DISTO (le test
  du mode dans sa boucle) ;
- **la taille des blocs** ne coute presque rien : de 32 a 512 echantillons, la banque varie de moins de 10 %.

### CPU, banque d'usine (40 presets, blocs de 128, % d'un coeur de la machine de test)

| Moteur / QUALITY | Avant (v48) moyenne / pire | Apres, ZERO moyenne / pire | Ecart | Apres, EXACT moyenne |
|---|---|---|---|---|
| PRO ECO | 2.55 / 4.86 | 2.48 / 4.50 | -3 % | 2.66 |
| PRO STD | 3.65 / 6.30 | 3.41 / 5.97 | -7 % | 3.87 |
| PRO HQ | 5.48 / 8.97 | 5.06 / 8.69 | -8 % | 5.76 |
| CLASSIC ECO | 3.76 / 6.77 | 3.79 / 7.67 | +1 % | 3.90 |
| CLASSIC STD | 5.90 / 10.92 | 5.82 / 12.48 | -1 % | 5.92 |
| CLASSIC HQ | 10.06 / 18.80 | 9.81 / 22.86 | -2 % | 10.32 |

### CPU par scene et par etage (blocs de 128), avant -> apres ZERO (le detail du compteur du plugin)

| Scene | Q | Total avant | Total apres | Ecart | MOTEUR | DISTO | DELAY | REVERB | HELL | EQ+RACK | RESTE | Latence declaree |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAS DE MIKA | pECO | 22.81 | 22.79 | -0 % | 17.56 -> 17.66 | 0.04 -> 0.04 | 0.78 -> 0.76 | 3.37 -> 2.53 | 0.03 -> 0.03 | 0.01 -> 0.01 | 0.56 -> 0.57 | 0 -> 0 |
| CAS DE MIKA | pSTD | 30.28 | 28.91 | -5 % | 25.36 -> 24.56 | 0.04 -> 0.03 | 0.80 -> 0.74 | 3.39 -> 2.42 | 0.03 -> 0.02 | 0.01 -> 0.00 | 0.56 -> 0.54 | 16 -> 0 |
| CAS DE MIKA | pHQ | 45.82 | 43.59 | -5 % | 39.96 -> 38.89 | 0.04 -> 0.04 | 0.86 -> 0.76 | 3.45 -> 2.42 | 0.03 -> 0.02 | 0.01 -> 0.00 | 0.57 -> 0.54 | 19 -> 0 |
| CAS DE MIKA | ECO | 31.38 | 32.80 | +5 % | 26.01 -> 27.95 | 0.03 -> 0.04 | 0.77 -> 0.82 | 3.32 -> 2.69 | 0.02 -> 0.03 | 0.01 -> 0.01 | 0.55 -> 0.65 | 16 -> 0 |
| CAS DE MIKA | STD | 47.81 | 51.98 | +9 % | 41.90 -> 46.47 | 0.04 -> 0.05 | 0.81 -> 0.86 | 3.37 -> 2.87 | 0.03 -> 0.04 | 0.00 -> 0.01 | 0.55 -> 0.78 | 19 -> 0 |
| CAS DE MIKA | HQ | 86.47 | 77.98 | -10 % | 79.04 -> 72.39 | 0.07 -> 0.04 | 0.91 -> 0.80 | 3.89 -> 2.54 | 0.04 -> 0.03 | 0.01 -> 0.00 | 0.80 -> 0.55 | 21 -> 0 |
| INIT | pECO | 7.68 | 6.45 | -16 % | 2.31 -> 2.22 | 0.03 -> 0.03 | 0.80 -> 0.73 | 3.90 -> 2.89 | 0.02 -> 0.02 | 0.01 -> 0.01 | 0.56 -> 0.55 | 0 -> 0 |
| INIT | pSTD | 8.49 | 7.31 | -14 % | 3.48 -> 3.10 | 0.03 -> 0.03 | 0.82 -> 0.72 | 3.92 -> 2.87 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.57 -> 0.54 | 16 -> 0 |
| INIT | pHQ | 10.22 | 9.10 | -11 % | 5.08 -> 4.85 | 0.03 -> 0.03 | 0.78 -> 0.75 | 3.81 -> 2.88 | 0.02 -> 0.02 | 0.01 -> 0.00 | 0.54 -> 0.54 | 19 -> 0 |
| INIT | ECO | 8.58 | 7.46 | -13 % | 3.32 -> 3.16 | 0.03 -> 0.03 | 0.77 -> 0.77 | 3.86 -> 2.94 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.55 -> 0.56 | 16 -> 0 |
| INIT | STD | 10.41 | 9.21 | -12 % | 5.19 -> 4.86 | 0.03 -> 0.03 | 0.79 -> 0.76 | 3.78 -> 2.98 | 0.02 -> 0.02 | 0.00 -> 0.01 | 0.55 -> 0.56 | 19 -> 0 |
| INIT | HQ | 14.07 | 12.59 | -11 % | 8.84 -> 8.16 | 0.03 -> 0.03 | 0.79 -> 0.76 | 3.83 -> 2.98 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.55 -> 0.56 | 21 -> 0 |
| MUNICH BASS | pECO | 2.43 | 2.38 | -2 % | 1.82 -> 1.80 | 0.02 -> 0.02 | 0.45 -> 0.43 | 0.04 -> 0.04 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.14 -> 0.14 | 0 -> 0 |
| MUNICH BASS | pSTD | 3.72 | 3.40 | -9 % | 3.08 -> 2.83 | 0.03 -> 0.02 | 0.46 -> 0.42 | 0.05 -> 0.04 | 0.02 -> 0.01 | 0.00 -> 0.00 | 0.14 -> 0.13 | 16 -> 0 |
| MUNICH BASS | pHQ | 5.99 | 5.44 | -9 % | 5.34 -> 4.84 | 0.03 -> 0.03 | 0.46 -> 0.43 | 0.05 -> 0.04 | 0.02 -> 0.02 | 0.01 -> 0.00 | 0.15 -> 0.14 | 19 -> 0 |
| MUNICH BASS | ECO | 3.65 | 3.94 | +8 % | 3.04 -> 3.16 | 0.02 -> 0.03 | 0.45 -> 0.45 | 0.04 -> 0.05 | 0.01 -> 0.02 | 0.00 -> 0.00 | 0.13 -> 0.17 | 16 -> 0 |
| MUNICH BASS | STD | 5.86 | 5.44 | -7 % | 5.26 -> 4.86 | 0.02 -> 0.02 | 0.45 -> 0.43 | 0.05 -> 0.04 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.13 -> 0.14 | 19 -> 0 |
| MUNICH BASS | HQ | 10.08 | 10.90 | +8 % | 9.50 -> 10.97 | 0.03 -> 0.04 | 0.46 -> 0.56 | 0.05 -> 0.07 | 0.02 -> 0.03 | 0.00 -> 0.01 | 0.14 -> 0.18 | 21 -> 0 |
| OCEAN DRONE | pECO | 4.68 | 4.50 | -4 % | 3.98 -> 3.87 | 0.02 -> 0.02 | 0.46 -> 0.42 | 0.05 -> 0.05 | 0.02 -> 0.01 | 0.00 -> 0.00 | 0.14 -> 0.14 | 0 -> 0 |
| OCEAN DRONE | pSTD | 6.15 | 5.97 | -3 % | 5.47 -> 5.30 | 0.03 -> 0.03 | 0.45 -> 0.43 | 0.05 -> 0.05 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.14 -> 0.14 | 16 -> 0 |
| OCEAN DRONE | pHQ | 8.97 | 8.69 | -3 % | 8.24 -> 8.00 | 0.03 -> 0.03 | 0.45 -> 0.43 | 0.05 -> 0.05 | 0.02 -> 0.02 | 0.00 -> 0.01 | 0.14 -> 0.14 | 19 -> 0 |
| OCEAN DRONE | ECO | 6.77 | 7.67 | +13 % | 6.09 -> 6.80 | 0.03 -> 0.03 | 0.45 -> 0.47 | 0.05 -> 0.07 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.13 -> 0.17 | 16 -> 0 |
| OCEAN DRONE | STD | 10.92 | 10.30 | -6 % | 10.14 -> 9.81 | 0.03 -> 0.03 | 0.46 -> 0.45 | 0.05 -> 0.06 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.14 -> 0.15 | 19 -> 0 |
| OCEAN DRONE | HQ | 18.80 | 17.85 | -5 % | 17.95 -> 16.99 | 0.03 -> 0.03 | 0.47 -> 0.44 | 0.06 -> 0.06 | 0.02 -> 0.02 | 0.00 -> 0.01 | 0.14 -> 0.15 | 21 -> 0 |
| SUNSET PAD | pECO | 4.86 | 4.36 | -10 % | 4.15 -> 3.74 | 0.03 -> 0.02 | 0.49 -> 0.44 | 0.06 -> 0.04 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.15 -> 0.13 | 0 -> 0 |
| SUNSET PAD | pSTD | 6.30 | 5.71 | -9 % | 5.57 -> 5.09 | 0.03 -> 0.02 | 0.47 -> 0.43 | 0.06 -> 0.04 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.14 -> 0.14 | 16 -> 0 |
| SUNSET PAD | pHQ | 8.64 | 8.20 | -5 % | 7.98 -> 7.56 | 0.03 -> 0.03 | 0.46 -> 0.43 | 0.05 -> 0.04 | 0.02 -> 0.02 | 0.01 -> 0.00 | 0.14 -> 0.14 | 19 -> 0 |
| SUNSET PAD | ECO | 6.56 | 6.36 | -3 % | 5.84 -> 5.95 | 0.03 -> 0.03 | 0.50 -> 0.46 | 0.05 -> 0.05 | 0.02 -> 0.02 | 0.00 -> 0.01 | 0.14 -> 0.15 | 16 -> 0 |
| SUNSET PAD | STD | 10.30 | 10.02 | -3 % | 9.50 -> 9.44 | 0.03 -> 0.03 | 0.47 -> 0.45 | 0.06 -> 0.06 | 0.02 -> 0.02 | 0.00 -> 0.01 | 0.15 -> 0.16 | 19 -> 0 |
| SUNSET PAD | HQ | 17.36 | 18.53 | +7 % | 16.63 -> 17.73 | 0.04 -> 0.04 | 0.48 -> 0.51 | 0.06 -> 0.08 | 0.03 -> 0.03 | 0.00 -> 0.01 | 0.15 -> 0.18 | 21 -> 0 |
| PIRE CAS | pECO | 22.56 | 16.80 | -26 % | 2.88 -> 2.72 | 12.09 -> 7.90 | 1.14 -> 1.01 | 3.59 -> 2.58 | 1.89 -> 1.73 | 0.43 -> 0.41 | 0.57 -> 0.54 | 0 -> 0 |
| PIRE CAS | pSTD | 24.99 | 19.37 | -22 % | 4.15 -> 3.92 | 12.91 -> 8.88 | 1.16 -> 1.21 | 3.93 -> 2.81 | 2.13 -> 1.98 | 0.47 -> 0.48 | 0.63 -> 0.61 | 16 -> 0 |
| PIRE CAS | pHQ | 25.27 | 20.04 | -21 % | 5.65 -> 5.21 | 12.07 -> 8.06 | 1.17 -> 1.11 | 3.56 -> 2.65 | 1.86 -> 1.80 | 0.44 -> 0.42 | 0.61 -> 0.56 | 19 -> 0 |
| PIRE CAS | ECO | 24.68 | 18.41 | -25 % | 4.49 -> 4.07 | 12.19 -> 7.88 | 1.11 -> 1.05 | 3.58 -> 2.60 | 1.99 -> 1.77 | 0.44 -> 0.42 | 0.58 -> 0.55 | 16 -> 0 |
| PIRE CAS | STD | 26.37 | 20.85 | -21 % | 7.20 -> 6.41 | 12.04 -> 7.97 | 1.11 -> 1.05 | 3.54 -> 2.59 | 1.86 -> 1.76 | 0.43 -> 0.42 | 0.57 -> 0.56 | 19 -> 0 |
| PIRE CAS | HQ | 30.78 | 25.71 | -16 % | 11.97 -> 11.24 | 11.58 -> 8.00 | 1.07 -> 1.10 | 3.42 -> 2.64 | 1.77 -> 1.80 | 0.41 -> 0.43 | 0.56 -> 0.58 | 21 -> 0 |
| EFFETS LOURDS | pECO | 20.42 | 15.27 | -25 % | 2.26 -> 2.23 | 10.33 -> 6.97 | 0.90 -> 0.74 | 3.05 -> 2.12 | 1.93 -> 1.85 | 1.40 -> 0.81 | 0.56 -> 0.54 | 0 -> 0 |
| EFFETS LOURDS | pSTD | 22.46 | 17.58 | -22 % | 3.50 -> 3.28 | 10.50 -> 7.52 | 0.87 -> 0.81 | 3.14 -> 2.37 | 2.03 -> 2.04 | 1.44 -> 0.88 | 0.56 -> 0.61 | 16 -> 0 |
| EFFETS LOURDS | pHQ | 23.24 | 19.13 | -18 % | 5.02 -> 5.03 | 10.40 -> 7.72 | 0.78 -> 0.80 | 3.09 -> 2.34 | 1.99 -> 2.04 | 1.44 -> 0.87 | 0.56 -> 0.58 | 19 -> 0 |
| EFFETS LOURDS | ECO | 20.94 | 16.51 | -21 % | 3.24 -> 3.13 | 10.21 -> 7.11 | 0.75 -> 0.76 | 2.90 -> 2.17 | 1.86 -> 1.91 | 1.36 -> 0.81 | 0.53 -> 0.56 | 16 -> 0 |
| EFFETS LOURDS | STD | 22.75 | 17.57 | -23 % | 5.06 -> 4.65 | 10.12 -> 6.91 | 0.76 -> 0.72 | 2.92 -> 2.08 | 1.87 -> 1.82 | 1.37 -> 0.80 | 0.55 -> 0.53 | 19 -> 0 |
| EFFETS LOURDS | HQ | 26.34 | 21.18 | -20 % | 8.61 -> 7.96 | 10.22 -> 6.99 | 0.77 -> 0.74 | 2.95 -> 2.13 | 1.89 -> 1.88 | 1.38 -> 0.81 | 0.55 -> 0.55 | 21 -> 0 |
| DISTO SEULE | pECO | 17.18 | 12.19 | -29 % | 2.48 -> 2.24 | 8.56 -> 5.33 | 0.91 -> 0.76 | 4.58 -> 3.24 | 0.03 -> 0.02 | 0.01 -> 0.00 | 0.61 -> 0.54 | 0 -> 0 |
| DISTO SEULE | pSTD | 18.72 | 14.42 | -23 % | 3.89 -> 3.21 | 8.51 -> 5.75 | 0.90 -> 0.75 | 4.83 -> 3.47 | 0.03 -> 0.02 | 0.01 -> 0.01 | 0.86 -> 0.55 | 16 -> 0 |
| DISTO SEULE | pHQ | 17.92 | 15.42 | -14 % | 5.07 -> 5.01 | 7.57 -> 5.71 | 0.76 -> 0.79 | 4.07 -> 3.39 | 0.02 -> 0.02 | 0.01 -> 0.01 | 0.53 -> 0.58 | 19 -> 0 |
| DISTO SEULE | ECO | 16.17 | 13.17 | -19 % | 3.25 -> 3.12 | 7.51 -> 5.44 | 0.75 -> 0.75 | 4.05 -> 3.26 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.53 -> 0.55 | 16 -> 0 |
| DISTO SEULE | STD | 18.08 | 14.68 | -19 % | 5.08 -> 4.87 | 7.57 -> 5.50 | 0.76 -> 0.75 | 4.05 -> 3.29 | 0.02 -> 0.02 | 0.00 -> 0.01 | 0.54 -> 0.55 | 19 -> 0 |
| DISTO SEULE | HQ | 22.17 | 18.82 | -15 % | 8.77 -> 8.59 | 7.81 -> 5.87 | 0.81 -> 0.79 | 4.17 -> 3.39 | 0.02 -> 0.02 | 0.01 -> 0.01 | 0.56 -> 0.58 | 21 -> 0 |
| DISTO 3 BANDES | pECO | 20.17 | 14.84 | -26 % | 2.28 -> 2.23 | 12.68 -> 8.45 | 0.80 -> 0.73 | 3.73 -> 2.83 | 0.02 -> 0.02 | 0.01 -> 0.01 | 0.55 -> 0.55 | 0 -> 0 |
| DISTO 3 BANDES | pSTD | 21.42 | 17.40 | -19 % | 3.42 -> 3.56 | 12.89 -> 9.88 | 0.81 -> 0.86 | 3.79 -> 3.27 | 0.03 -> 0.03 | 0.01 -> 0.01 | 0.59 -> 0.62 | 16 -> 0 |
| DISTO 3 BANDES | pHQ | 23.67 | 21.48 | -9 % | 5.21 -> 5.96 | 13.05 -> 11.06 | 0.81 -> 0.95 | 3.83 -> 3.58 | 0.03 -> 0.04 | 0.01 -> 0.01 | 0.58 -> 0.83 | 19 -> 0 |
| DISTO 3 BANDES | ECO | 21.77 | 15.59 | -28 % | 3.41 -> 3.08 | 13.08 -> 8.41 | 0.80 -> 0.73 | 3.86 -> 2.79 | 0.03 -> 0.02 | 0.01 -> 0.00 | 0.57 -> 0.54 | 16 -> 0 |
| DISTO 3 BANDES | STD | 22.59 | 17.50 | -23 % | 5.06 -> 4.76 | 12.49 -> 8.54 | 0.75 -> 0.74 | 3.64 -> 2.83 | 0.02 -> 0.02 | 0.00 -> 0.01 | 0.53 -> 0.55 | 19 -> 0 |
| DISTO 3 BANDES | HQ | 26.07 | 20.88 | -20 % | 8.58 -> 8.01 | 12.43 -> 8.63 | 0.76 -> 0.74 | 3.63 -> 2.84 | 0.02 -> 0.02 | 0.00 -> 0.00 | 0.54 -> 0.54 | 21 -> 0 |
| WARMTH SEULE | pECO | 8.85 | 7.71 | -13 % | 2.27 -> 2.32 | 0.03 -> 0.03 | 0.77 -> 0.78 | 3.79 -> 3.02 | 0.02 -> 0.02 | 1.40 -> 0.88 | 0.54 -> 0.56 | 0 -> 0 |
| WARMTH SEULE | pSTD | 10.52 | 8.41 | -20 % | 3.73 -> 3.31 | 0.04 -> 0.03 | 0.88 -> 0.83 | 4.23 -> 3.01 | 0.03 -> 0.02 | 1.62 -> 0.85 | 0.63 -> 0.56 | 16 -> 0 |
| WARMTH SEULE | pHQ | 11.62 | 10.21 | -12 % | 5.06 -> 5.03 | 0.03 -> 0.03 | 0.77 -> 0.78 | 3.77 -> 3.02 | 0.02 -> 0.02 | 1.40 -> 0.92 | 0.55 -> 0.57 | 19 -> 0 |
| WARMTH SEULE | ECO | 10.20 | 8.23 | -19 % | 3.43 -> 3.14 | 0.03 -> 0.03 | 0.80 -> 0.75 | 3.88 -> 2.91 | 0.02 -> 0.02 | 1.46 -> 0.83 | 0.55 -> 0.55 | 16 -> 0 |
| WARMTH SEULE | STD | 11.62 | 9.67 | -17 % | 5.09 -> 4.69 | 0.03 -> 0.03 | 0.76 -> 0.72 | 3.73 -> 2.84 | 0.02 -> 0.02 | 1.38 -> 0.81 | 0.55 -> 0.53 | 19 -> 0 |
| WARMTH SEULE | HQ | 15.21 | 12.97 | -15 % | 8.66 -> 7.98 | 0.03 -> 0.03 | 0.76 -> 0.73 | 3.77 -> 2.84 | 0.02 -> 0.02 | 1.40 -> 0.83 | 0.55 -> 0.54 | 21 -> 0 |
| INIT (ARRET) | pECO | 1.03 | 0.98 | -5 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.47 -> 0.47 | 0.36 -> 0.25 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.57 -> 0.54 | 0 -> 0 |
| INIT (ARRET) | pSTD | 0.97 | 0.99 | +2 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.45 -> 0.45 | 0.35 -> 0.25 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.52 -> 0.55 | 16 -> 0 |
| INIT (ARRET) | pHQ | 0.96 | 0.97 | +1 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.45 -> 0.45 | 0.35 -> 0.27 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.52 -> 0.55 | 19 -> 0 |
| INIT (ARRET) | ECO | 0.97 | 0.97 | +0 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.45 -> 0.44 | 0.34 -> 0.26 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.52 -> 0.53 | 16 -> 0 |
| INIT (ARRET) | STD | 1.00 | 0.95 | -5 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.47 -> 0.43 | 0.37 -> 0.25 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.53 -> 0.54 | 19 -> 0 |
| INIT (ARRET) | HQ | 0.99 | 0.96 | -3 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.47 -> 0.44 | 0.36 -> 0.25 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.53 -> 0.54 | 21 -> 0 |
| MUNICH BASS (ARRET) | pECO | 0.60 | 0.56 | -7 % | 0.01 -> 0.01 | 0.02 -> 0.01 | 0.46 -> 0.42 | 0.03 -> 0.03 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.13 -> 0.13 | 0 -> 0 |
| MUNICH BASS (ARRET) | pSTD | 0.61 | 0.55 | -10 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.46 -> 0.42 | 0.03 -> 0.03 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.14 -> 0.13 | 16 -> 0 |
| MUNICH BASS (ARRET) | pHQ | 0.59 | 0.56 | -5 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.45 -> 0.42 | 0.03 -> 0.03 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.13 -> 0.13 | 19 -> 0 |
| MUNICH BASS (ARRET) | ECO | 0.62 | 0.55 | -11 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.46 -> 0.42 | 0.03 -> 0.03 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.14 -> 0.13 | 16 -> 0 |
| MUNICH BASS (ARRET) | STD | 0.58 | 0.55 | -5 % | 0.01 -> 0.01 | 0.02 -> 0.01 | 0.44 -> 0.42 | 0.03 -> 0.03 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.13 -> 0.13 | 19 -> 0 |
| MUNICH BASS (ARRET) | HQ | 0.58 | 0.56 | -3 % | 0.01 -> 0.01 | 0.02 -> 0.02 | 0.44 -> 0.42 | 0.03 -> 0.03 | 0.01 -> 0.01 | 0.00 -> 0.00 | 0.13 -> 0.13 | 21 -> 0 |

### Taille des blocs (banque d'usine, STD), avant -> apres ZERO

| Blocs | CLASSIC STD avant | apres | PRO STD avant | apres |
|---|---|---|---|---|
| 32 | 6.26 | 5.74 | 3.98 | 3.77 |
| 64 | 6.01 | 5.58 | 3.76 | 3.59 |
| 128 | 5.90 | 5.82 | 3.65 | 3.41 |
| 512 | 5.86 | 5.60 | 3.93 | 3.48 |

### Instance a l'arret (transport arrete, rien ne sonne), regime etabli (8 s mesurees, CLASSIC STD et PRO STD)

| Scene | Q | Avant | Apres ZERO | DELAY avant -> apres |
|---|---|---|---|---|
| CATHEDRAL DRONE (ARRET) | STD | 0.45 | 0.34 | 0.24 -> 0.14 |
| CATHEDRAL DRONE (ARRET) | pSTD | 0.39 | 0.32 | 0.21 -> 0.13 |
| INIT (ARRET) | STD | 0.77 | 0.77 | 0.22 -> 0.18 |
| INIT (ARRET) | pSTD | 0.79 | 0.72 | 0.22 -> 0.15 |
| MUNICH BASS (ARRET) | STD | 0.43 | 0.33 | 0.23 -> 0.14 |
| MUNICH BASS (ARRET) | pSTD | 0.40 | 0.32 | 0.21 -> 0.13 |

### Instructions executees dans processBlock (callgrind, deterministe : sans le bruit de la machine partagee)

3 s de son par scene (1 s de mise en route comprise), QUALITY STD, en milliards d'instructions.

| Scene | Moteur | v48 | v49 EXACT | v49 ZERO |
|---|---|---|---|---|
| CAS DE MIKA | CLASSIC STD | 9.97 | 9.98 (+0.0 %) | 9.60 (-3.8 %) |
| CAS DE MIKA | PRO STD | 5.75 | 5.76 (+0.1 %) | 5.47 (-4.9 %) |
| OCEAN DRONE | CLASSIC STD | 2.81 | 2.81 (+0.1 %) | 2.62 (-6.6 %) |
| OCEAN DRONE | PRO STD | 1.52 | 1.52 (+0.1 %) | 1.43 (-6.1 %) |
| SUNSET PAD | CLASSIC STD | 2.65 | 2.65 (+0.0 %) | 2.47 (-7.0 %) |
| SUNSET PAD | PRO STD | 1.47 | 1.47 (+0.0 %) | 1.37 (-6.4 %) |
| EFFETS LOURDS | CLASSIC STD | 5.92 | 5.97 (+0.9 %) | 4.93 (-16.8 %) |
| EFFETS LOURDS | PRO STD | 5.39 | 5.43 (+0.9 %) | 4.49 (-16.7 %) |
| DISTO 3 BANDES | CLASSIC STD | 5.27 | 5.33 (+1.1 %) | 4.52 (-14.2 %) |
| DISTO 3 BANDES | PRO STD | 4.74 | 4.80 (+1.2 %) | 4.08 (-13.9 %) |
| INIT (ARRET) | CLASSIC STD | 0.68 | 0.68 (+0.2 %) | 0.61 (-10.2 %) |
| INIT (ARRET) | PRO STD | 0.68 | 0.68 (+0.2 %) | 0.61 (-10.2 %) |

### QUALITY : ECO contre STD (a proposer a Mika, le defaut des instances neuves reste STD)

Mesure sur les 40 presets d'usine (ZERO, 3 s chacun, rendus en memoire) : spectre par tiers d'octave contre HQ ; l'ecart
max au-dessus de 4 kHz dit ce que l'oreille peut entendre changer dans l'aigu (repliement ou filtre), la sonie le niveau.

| | CPU banque (ZERO) | Ecart max > 4 kHz contre HQ, moyenne (pire) | Sonie contre HQ | Energie > 12 kHz |
|---|---|---|---|---|
| PRO ECO (filtre x1) | 2.48 % (-27 % contre PRO STD) | 8.7 dB (17.4 dB, AURORA PAD) | 0.01 dB | -74.3 dB du total |
| PRO STD (x2) | 3.41 % | 0.9 dB (2.5 dB, SYNC GRIND) | 0.00 dB | -68.7 dB |
| PRO HQ (x4) | 5.06 % | reference | | -68.3 dB |
| CLASSIC ECO (x2) | 3.79 % (-35 % contre CLASSIC STD) | 1.5 dB (3.3 dB) | 0.00 dB | -69.6 dB |
| CLASSIC STD (x4) | 5.82 % | 0.3 dB (0.6 dB) | 0.00 dB | -68.9 dB |
| CLASSIC HQ (x8) | 9.81 % | reference | | -68.8 dB |
| Cas de Mika, 8 voix | PRO ECO 22.8 %, PRO STD 28.9 %, PRO HQ 43.6 % ; CLASSIC ECO 32.8 %, STD 52.0 %, HQ 78.0 % | | | |

- PRO ECO n'ajoute pas d'aigu (pas de repliement mesurable en plus) : il l'enleve. Le filtre au taux de base assombrit
  le haut du spectre, jusqu'a -17 dB au-dessus de 4 kHz sur les nappes (AURORA PAD, STRING PAD) et les basses brillantes
  (MUNICH BASS, CURSED BASS) : un autre caractere, pas un defaut, mais pas un bon defaut.
- PRO STD est le bon compromis : a moins de 1 dB de HQ dans l'aigu en moyenne, deux fois moins cher que CLASSIC STD.
- Proposition a faire a Mika : garder PRO STD par defaut ; ECO comme interrupteur "beaucoup d'instances" en connaissance
  de cause (a ecouter : AURORA PAD, STRING PAD, MUNICH BASS en ECO et en STD).

## Recommandations pour Ableton (Mika)

- **LATENCY ZERO** (par defaut sur les nouvelles pistes) : MM-ARP ne declare plus rien a Live ; dans un ancien projet,
  passer LATENCY a ZERO dans les parametres du plugin (Live : le triangle du plugin, ou Configure) pour gagner 16 a 21
  echantillons declares plus 32 (DISTO) et 39 (WARMTH) caches.
- **Taille du buffer** (Preferences > Audio) : MM-ARP coute la meme chose de 32 a 512 echantillons, la latence vient
  donc seulement du buffer. Pour jouer en direct ou enregistrer du MIDI : 128 echantillons a 48 kHz (2.7 ms a l'aller,
  2.7 ms au retour ; 2.9 ms a 44.1 kHz), voire 64 (1.3 ms) si le reste du set suit. Pour mixer un gros projet : 512
  (10.7 ms) ou 1024, la latence n'y compte plus.
- **48 kHz plutot que 96 kHz** : a 96 kHz MM-ARP divise son surechantillonnage par deux mais calcule deux fois plus
  d'echantillons, environ +60 a +100 % de CPU pour rien d'audible.
- **Moteur PRO + QUALITY STD** pour jouer, **EXPORT HQ a ON** (l'export passe en HQ tout seul) ; HQ en temps reel
  seulement sur une piste seule.
- **Geler (Freeze) les pistes a 8 voix** (nappes, accords longs) une fois le son trouve : le cas de Mika coute 29 % d'un
  coeur sur la machine de test en PRO STD, une piste gelee ne coute plus rien.
- **Delay Compensation** de Live reste active (pour les autres plugins) ; MM-ARP en ZERO n'en a pas besoin.
- Laisser le multicoeur de Live actif : chaque instance de MM-ARP tourne sur son propre coeur.

## 4. Decisions prises et pourquoi

- **Un seul reglage, LATENCY, pour tout le chemin neuf.** EXACT = le son d'avant au bit pres (les 85 cas du site, les
  anciens projets) ; ZERO = latence 0 + les economies qui changent le son au-dela du dernier bit (toutes mesurees sous
  -95 dB ou a moins de 0.03 dB). Mika n'a qu'un choix a comprendre ; un ancien projet ne bouge pas tant qu'il ne le
  change pas.
- **Demi-bandes RII plutot que RIF a phase minimale** : 4 a 8 multiplications par echantillon au lieu de 16 a 33, une
  attenuation de 95 a 120 dB, une bande passante plate a 1e-6 dB. La phase n'est plus lineaire pres de 20 kHz (2 a 4
  echantillons de retard de groupe de plus a 18 kHz qu'au grave) : inaudible, c'est le comportement des synthes et
  plugins "zero latency" du commerce.
- **DISTO multibande : les taux d'EXACT gardes (x2 / x4 / x8)**, la phase egalisee en rejouant les etages lineaires
  manquants apres la saturation. Toutes les bandes en x8 aurait coute +21 % au lieu de -34 %.
- **Le sec de MIX (DISTO) et de WARMTH passe par le meme aller-retour RII que le mouille** : sinon 5 echantillons
  d'ecart creusent un peigne vers 4 kHz a MIX 50 %.
- **Ce qui n'a PAS ete fait, faute de garantie au bit pres** : approximations de pow / exp / tan dans le moteur (10 a
  15 % du moteur, mais la resonance du site est chaotique : la moindre difference d'arrondi peut basculer un cas, comme
  la FMA l'a montre en v24) ; vectorisation des RIF d'EXACT (l'ordre des sommes changerait) ; sommeil du DELAY en EXACT
  (zeros signes, residus sous 1e-7 effaces). Le moteur, lui, saute deja les voix eteintes et les blocs muets.
- **QUALITY par defaut inchange (STD)** : les chiffres ECO / STD sont plus bas, a proposer a Mika.
- **FTZ / DAZ** : deja en place (`juce::ScopedNoDenormals` dans processBlock, arm64 compris dans JUCE 8). Options de
  compilation : -O3 en Release, -ffp-contract=off sur le DSP (au bit pres), pas de -ffast-math.

## 5. Tests

- Suite DSP de la CI : tout passe (voyager_compare 85/85 et --blocks, params, extra-gen, hq, hq2, hq3, hell, hell2,
  sky, decap, echo, pro, modview, banque d'usine --check, fx, latency_test).
- host_test (JUCE 8.0.9, comme la CI) : tout passe, dont 6 controles v49 : instance neuve a 0 (44.1 / 48 / 96 kHz,
  CLASSIC / PRO, ECO / STD / HQ, temps reel et export) ; 0 constant en jouant pendant que QUALITY et ENGINE changent ;
  projet d'avant en EXACT a 19, puis 21 declare apres QUALITY HQ, puis 0 apres LATENCY ZERO ; projet d'avant au bit pres
  comme LATENCY EXACT pose a la main ; LATENCY en fin de liste (263).
- Ancien projet au bit pres contre le build v48 : 500 empreintes de sortie (50 scenes : INIT, les 40 presets, le pire
  cas, les effets lourds, les instances a l'arret ; CLASSIC et PRO ; ECO / STD / HQ en blocs de 128 ; STD en blocs de 37
  et 512) toutes identiques en EXACT (cpu_bench MMARP_HASH=1, les deux builds).
- `tsc --noEmit -p .` : 105 (inchange).

## 6. Ce qui reste a faire / points en suspens

- **La face (autre agent)** : LATENCY n'a pas de touche dans SETTINGS (Ableton la montre dans ses parametres). A ajouter
  a cote de ENGINE / QUALITY / EXPORT HQ (`<PcbToggle id="xLatency" name="LATENCY" .../>`, LookPanel.tsx). Et
  `bridge.ts` applique tous les reglages d'un preset sauf QUALITY et ENGINE : charger un preset (usine ou disque) met
  LATENCY a ZERO, meme dans un ancien projet en EXACT. A exclure comme xEngine (lignes ~380 et ~701) si on veut qu'un
  preset ne touche pas a LATENCY.
- Changer LATENCY en jouant : le moteur se tait 12 ms puis repart (comme QUALITY) ; la DISTO engagee passe par son fondu
  de 6 ms ; WARMTH engagee repart du sec (fondu de 20 ms) ; un MIX de DISTO sous 100 % peut cliquer une fois au passage.
- Le moteur reste l'essentiel de la charge a 8 voix (CAS DE MIKA). Piste suivante, a valider a l'oreille : pow / exp /
  tan approches dans le chemin ZERO seulement (estime -10 a -15 % du moteur), puis SIMD 2 voix.
- Mesures sur un Xeon partage : a confirmer avec le compteur CPU du plugin sur le Mac de Mika.
- Aucune ecoute : tout est mesure ; a ecouter par Mika (ZERO contre EXACT sur un ancien projet, DISTO a MIX 50 %).

## 7. Commandes utiles ajoutees

- `./build-dsp/mmarp_latency_test` (CI, job dsp).
- `./build-host/mmarp_cpu_bench_artefacts/Release/mmarp_cpu_bench [s] [filtre] [crans] [pro|classic|both] [blocs] [N]`,
  avec `MMARP_LATENCY=zero|exact`, `MMARP_HASH=1` (empreinte de la sortie : comparer deux builds au bit pres),
  `MMARP_DUMP=dossier` (la sortie en float32).
