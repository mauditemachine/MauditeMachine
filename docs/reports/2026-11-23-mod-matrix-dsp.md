# 2026-11-23 - MM-ARP v50, le moteur : LFO 1 a 4, la matrice de modulation de l'encart LFO

Choix de Mika (2026-11-23) : "C et SQ ok, go". Contrat : scratchpad/v50/CONTRAT-v50.md (sections 2 a 6 pour le moteur).
Cette session touche le moteur (plugin/mm-arp : dsp, src, tests, banque) et la table generee de la face
(src/v4/plugin/arp/modTable.ts). La face elle-meme (option C, pages LFO et SQ, viseur) est l'autre agent, sur le meme
contrat. Branche : worktree-agent-a8f9c88e0190918fd, partie de 70498700 (v49). Rien n'est pousse ni publie.

Toutes les mesures : hors ligne, en memoire, aucun son joue.

## 1. Ce qui a ete fait

- `plugin/mm-arp/extra-params.json` : 31 reglages en fin de liste, apres xLatency (264 -> 295), dans l'ordre du contrat :
  xLfo1Sync, xLfo1Hz, xLfo2Sync, xLfo2Hz, xLfo4Rate, xLfo4Shape, xLfo4Sync (section `lfo`), puis xMx{n}Src / Dst / Amt
  pour n = 1..8, emplacement par emplacement (section `mod`). Nouveau champ `"nsteps": 1024` (xMx{n}Dst : un reglage a
  crans sans noms, valeur = code / 1023). Tous les defauts sont neutres (SYNC, OFF, 0.5).
- `plugin/mm-arp/tests/extra-gen.mjs` : `nsteps` ; genere aussi la table de modulation, une seule source, `--check`
  couvre les trois fichiers :
  - `plugin/mm-arp/src/ModTable.inc` (C++ : sources, bipolarite, `kModDests` code / k / id / nom / groupe, l'index
    code -> cible sur 1024 crans) ;
  - `src/v4/plugin/arp/modTable.ts` (la forme TS du contrat, plus `MOD_GROUPS`).
- `plugin/mm-arp/src/ExtraParams.h` : `ModDestDef`, `modDstCode`, `modDest`, `modSlotOf` / `modRoleOf` ; le texte de
  l'hote d'une cible est son nom ("FILTER CUTOFF", "OFF", "---"), la quantite en %, les vitesses de LFO en Hz.
- `plugin/mm-arp/dsp/Voyager.{h,cpp}` (le moteur, section 12. de Voyager.h) :
  - LFO 1 / LFO 2 en FREE : cles `l1Free`, `l1Hz`, `l2Free`, `l2Hz` (phase libre en Hz, avancee bloc apres bloc) ; en
    SYNC (le defaut) l'expression d'avant, au bit pres ;
  - la matrice passe de 6 a 14 lignes : mN (la page SEQ) puis xN (les 8 emplacements), LE MEME code (une seule boucle) ;
    `xNAmt` va de -4 a 4 (l'echelle des potards par voix) ;
  - deux sources de plus, 12 LFO 3 et 13 LFO 4 (communes, donnees par `extLfo`, glissees lineairement sur le bloc) ;
  - les destinations 32 + k (jusqu'a 1023) : une ligne qui n'agit pas sur le son ; sa quantite glisse (15 ms) et change
    de cible par 0 comme les autres ; sa contribution (quantite lissee x source, une source par voix : la voix la plus
    recente) se lit par `modTaps` a la fin de chaque bloc ;
  - les boucles par echantillon de la matrice ne passent que sur les lignes qui bougent dans le bloc (au bit pres).
- `plugin/mm-arp/dsp/ModLfo.h` (nouveau) : `DistoLfo` (LFO 3 : la copie exacte du LFO de Decap, recalee sur lui quand la
  DISTO tourne) et `Lfo4` (les formes du LFO 2, vitesse de xDLfoRate, SYNC cale sur la position du transport).
- `plugin/mm-arp/dsp/Decap.h` : `lfoState` (lecture seule, pour le calage de LFO 3).
- `plugin/mm-arp/src/PluginProcessor.{h,cpp}` :
  - `update()` en morceaux reutilisables (`engineKv`, `buildFx`, `applyFx`, `buildArp`), la DISTO, HELL et l'EQ en
    fonctions (`runDisto`, `runHell`, `runEq`) : un seul appel par bloc, comme avant, tant que rien n'est module ;
  - `modRoute` : le chemin de chaque emplacement (voir 2.) ; les lignes xN, LFO FREE envoyes au moteur avec le reste ;
  - LFO 3 / LFO 4 calcules par morceau du moteur (`modLfoChunk`) seulement si un emplacement les lit ;
  - les cibles generiques : rendu par tranches de 32 echantillons (`kModTick`) seulement quand l'une d'elles est
    modulee ; apres chaque tranche du moteur, `modTapsApply` pose la valeur effective dans `knobs_` / `ex_` et repose les
    familles qui ont bouge ; `modHostSync` garde la valeur de l'hote comme base quand l'automation la bouge ;
  - `modShow` : (k, valeur effective) de chaque emplacement actif pour l'arc de la face.
- `plugin/mm-arp/src/PluginEditor.cpp` : `mm_tick.m` ajoute chaque reglage vise par un emplacement actif (id, valeur
  effective normalisee), une fois par id, dans le meme evenement et la meme detection de changement (regles v49 : rien
  face cachee, un seul mm_tick).
- `plugin/mm-arp/presets/build.mjs` : la section `mod` reste neutre dans toute la banque ; banque regeneree (les 31
  reglages a leur defaut dans chaque preset, emplacements a OFF, toujours seche).
- Tests : `tests/mod_test.cpp` (nouveau, 26 controles, job host de la CI), `tests/host_test.cpp` (3 controles v50),
  `tests/cpu_bench.cpp` (scenes INIT / CAS DE MIKA + MOD 4 / MOD 8, filtre exact `=NOM`), `CMakeLists.txt`
  (mmarp_mod_test), `.github/workflows/plugin-arp.yml` (etape mod_test, YAML valide).

## 2. La table et le routage

### Les sources (14, l'ordre de xM{n}Src puis LFO 3, LFO 4)

OFF, VELOCITY, MOD WHEEL, AFTERTOUCH, PITCH BEND, KEY, LFO 1, LFO 2, FILTER ENV, AMP ENV, S&H, RANDOM, LFO 3, LFO 4.
Bipolaires : PITCH BEND, KEY, LFO 1-4, S&H, RANDOM. **Ecart au contrat** : KEY est bipolaire dans la table (le moteur la
donne de -2.5 a +2.5 autour du do central, Voyager.cpp `keyOf` ; le contrat la disait unipolaire). Signale a "main".

### Les cibles (205)

- 1..19 : les destinations synthe de xM{n}Dst (ids `m:pitch` ... `m:comb`, noms ceux de xM : PITCH ... COMB).
- 32 + k (186) : k = l'indice hote (les 62 potards du site, puis les reglages du VST3 seul). Les reglages continus
  seulement (pas les crans ni les leviers, pas xM* ni xMx*). Noms uniques dans toute la table, prefixes (FILTER CUTOFF,
  F ENV ATTACK, LFO 1 AMOUNT, REVERB DECAY...) pour ne pas se confondre avec les m:* ; groupes : OSC, FILTER, ENV, ARP,
  LFO, SOUND, DISTO, DELAY, HELL, REVERB, MASTER.

### Ce qui ne peut pas etre module (absent de la table) et pourquoi

| Reglage | Pourquoi |
|---|---|
| xRevSize, xRevTone, xRevPre (reverbe CLASSIC) | la reponse impulsionnelle se calcule hors du thread audio (6 a 40 ms par calcul, un fil partage) : impossible en temps reel |
| tape (OLD TAPE), xDist / xDistTone (OLD PEDAL) | masques depuis v25 / v27, sans effet |
| xEqLow / Mid / High / Air (section old, OLD EQ) | anciens reglages caches |
| duck (SIDECHAIN) | sans effet dans le plugin (le site seul) |
| tous les reglages a crans ou leviers, xM*, xMx* | regle du contrat |

### Ce qui est module avec une limite (dans la table)

- ARP GATE, ARP ACCENT, ARP SWING, DRIFT (cote arpege) : l'arpege relit sa valeur au bloc de l'hote suivant (retard au
  plus d'un bloc), puis a chaque pas.
- OSC PHASE, VOICE WIDTH, ACC FILTER, DRIFT (cote moteur) : lus par le moteur au depart de chaque note.
- LFO 3 RATE, LFO 4 RATE, LFO 1 / 2 FREE RATE : agissent (une source peut moduler la vitesse d'un LFO).
- HELL (ancien : ses filtres se reposent d'un coup ; v2 : MIX pris par tranches de 64, ses cercles le suivent) : la
  valeur effective glisse en plus de 10 ms. HELL v2 repart vide chaque fois que MIX retombe a 0 (comme l'automation).

### Le chemin de chaque emplacement (`modRoute`)

| Cible | Chemin | Cout |
|---|---|---|
| 1..19 | une ligne xN du moteur, le code de la matrice xM | celui d'une ligne xM |
| FILTER CUTOFF, FILTER RES, FILTER ENV AMT, FM AMOUNT, NOISE LEVEL, OSC RING MOD, OSC FOLD, FILTER COMB | le chemin par voix (CUTOFF, RES, ENV AMT, FM, NOISE, RING, FOLD, COMB), quantite x l'echelle de la loi du potard (CUTOFF 9.3 / 4, RES 1 / 0.35, ENV AMT 2, FM 1 / 0.6, les autres 1) : une source par voix module par voix | celui d'une ligne xM |
| toute autre cible 32 + k | ligne "hors du moteur" (contribution, `modTaps`) ; le bloc rendu par tranches de 32 ; valeur effective = clamp(hote + somme(source x (2 Amt - 1)), 0, 1) posee a chaque tranche ; familles reposees : moteur (tranche suivante), chaine et EQ (cette tranche), arpege (bloc suivant), DISTO / HELL / LFO 3-4 relus a chaque tranche | voir 4. |

Les potards a loi non lineaire (SUB LEVEL, OSC 1/2 LEVEL : 0.88 v^2 ; STACK SPREAD : zone morte ; OSC 1/2 WAVE : la
destination WAVE module les deux oscillateurs) passent par le chemin generique : la valeur du potard elle-meme est
modulee, sa loi est respectee.

## 3. Compatibilite et bit pres

| Controle | Resultat |
|---|---|
| voyager_compare (85 cas du site) et --blocks | 85 / 85 au bit pres, blocs ok |
| hq / hq2 / hq3 (empreintes du moteur d'avant) | 87 / 54 / 56 controles, 0 echec |
| 800 empreintes de sortie (cpu_bench MMARP_HASH) : build v49 (70498700, construit pour l'occasion) contre v50 | **800 / 800 identiques** |
| host_test : projet d'avant sans les 31 reglages, ouvert dans une instance reglee autrement | defauts a l'ouverture, son au bit pres |
| mod_test : emplacements au repos (0 %, "---", source OFF) | au bit pres, chemin d'avant (bloc entier) |
| banque d'usine | `build.mjs --check` vert, regeneree, seche |

Les 800 empreintes : 50 scenes (INIT, les 40 presets, le cas de Mika, le pire cas, les effets lourds, DISTO seule et 3
bandes, WARMTH seule, trois instances a l'arret) x CLASSIC et PRO x ECO / STD / HQ en blocs de 128 (LATENCY des
instances neuves, ZERO), plus STD en blocs de 37 et 512, plus ECO / STD / HQ en LATENCY EXACT.

Conversion au chargement : aucune (contrat, section 1). L'ancien reste actif et intact : LFO 1 TARGET / DEPTH, xLfo1Dest2,
xLfo2Dest, la route DISTO LFO, xM1..6.

## 4. xMx contre xM, sources, familles (mod_test)

- Moteur : une ligne xN reglee comme une ligne mN, **209 / 209 au bit pres** (11 sources x 19 destinations, ecart
  max 0) ; mN + xN sur la meme destination = deux lignes mN, au bit pres. Processeur entier (emplacement xMx contre
  ligne xM de la page SEQ) : 5 / 5 au bit pres.
- LFO 1 FREE 2.5 Hz mesure 2.501 Hz ; LFO 2 FREE 3.7 Hz mesure 3.701 ; LFO 1 SYNC (1 temps a 120 bpm) 2.001 Hz.
- LFO 4 FREE 3.3 Hz mesure 3.300 ; SYNC 2 temps a 150 bpm mesure 1.250 Hz, cale sur le transport (deux instances parties
  a des positions differentes : ecart 0.0000) ; LFO 3 1.7 Hz mesure 1.700.
- Les 13 sources vers MASTER WIDTH : toutes bougent (ou valent la source : MOD WHEEL 1, AFTERTOUCH 0.315, PITCH BEND -1,
  bornees), finies, sans allocation.
- Une cible par famille, MOD WHEEL a fond x +40 % : valeur effective exacte (hote + 0.4), le reglage agit, finie, sans
  allocation ; clic (plus grande derivee seconde / valeur efficace) avec un LFO 4 carre a 4 Hz, compare au meme carre par
  l'automation de l'hote :

| Famille | Cible | Effective | Clic matrice | sans modulation | carre par l'hote |
|---|---|---|---|---|---|
| synthe | OSC 2 LEVEL | 0.30 -> 0.70 | 2.58 | 2.99 | 2.40 |
| synthe (env) | A ENV DECAY | 0.20 -> 0.60 | 2.45 | 1.77 | 2.38 |
| filtre | FILTER HIGH PASS | 0.20 -> 0.60 | 2.24 | 1.75 | 2.07 |
| arpege | ARP GATE | 0.30 -> 0.70 | 3.49 | 2.50 | 3.54 |
| LFO | LFO 1 AMOUNT | 0.20 -> 0.60 | 2.55 | 2.19 | 2.71 |
| SOUND | PHASER MIX | 0.30 -> 0.70 | 1.62 | 2.04 | 1.56 |
| SOUND (EQ) | EQ 3 GAIN | 0.30 -> 0.70 | 1.95 | 2.64 | 1.44 |
| DISTO | DISTO MIX | 0.30 -> 0.70 | 1.63 | 1.61 | 1.50 |
| DELAY | DELAY FEEDBACK | 0.30 -> 0.70 | 2.16 | 1.75 | 1.75 |
| DELAY | DELAY MIX | 0.30 -> 0.70 | 1.92 | 1.74 | 1.57 |
| HELL | HELL MIX | 0.45 -> 0.85 | 5.25 | 1.23 | 5.69 |
| REVERB | REVERB DECAY | 0.30 -> 0.70 | 2.38 | 1.88 | 1.93 |
| REVERB | REVERB MIX | 0.30 -> 0.70 | 1.63 | 1.64 | 1.25 |
| MASTER | MASTER VOLUME | 0.50 -> 0.90 | 3.40 | 1.75 | 2.57 |
| MASTER | MASTER WARMTH | 0.20 -> 0.60 | 1.68 | 1.64 | 1.66 |

- FILTER CUTOFF (chemin par voix, pas de tranches) : arc 0.7000 (potard 0.4 + 0.3) ; ecart avec la destination CUTOFF a
  la quantite equivalente 3.9e-5 (l'arrondi du float de l'hote).
- Emplacement coupe : DELAY FEEDBACK revient exactement a la valeur de l'hote, plus de tranches, plus d'arc.

## 5. Le CPU

Scenes de `cpu_bench` : INIT (une voix) et le CAS DE MIKA (8 voix, arpege 1/16), sans matrice, puis + MOD 4 (LFO 1 ->
FILTER CUTOFF par voix, LFO 2 FREE -> DELAY FEEDBACK, LFO 4 FREE -> OSC 2 LEVEL, AMP ENV -> MASTER WIDTH) et + MOD 8 (en
plus : LFO 3 -> PHASER RATE, RANDOM -> PAN par voix, S&H -> EQ 3 GAIN, VELOCITY -> A ENV DECAY). Trois des quatre
premieres cibles sont generiques : le rendu par tranches de 32 est en service.

### Instructions executees dans processBlock (callgrind, deterministe), 3 s, QUALITY STD, blocs de 128

| Scene | PRO STD | ecart | CLASSIC STD | ecart |
|---|---|---|---|---|
| INIT | 1.716 G | | 2.161 G | |
| INIT + MOD 4 | 2.071 G | +20.7 % | 2.690 G | +24.5 % |
| INIT + MOD 8 | 2.242 G | +30.6 % | 2.954 G | +36.7 % |
| CAS DE MIKA (8 voix) | 5.474 G | | 9.604 G | |
| CAS DE MIKA + MOD 8 | 6.490 G | +18.5 % | 11.196 G | +16.6 % |
| SUNSET PAD, v49 -> v50 (aucun emplacement) | 1.3746 -> 1.3774 G | +0.21 % | 2.4651 -> 2.4700 G | +0.20 % |
| EFFETS LOURDS, v49 -> v50 (aucun emplacement) | 4.4854 -> 4.4883 G | +0.06 % | 4.9283 -> 4.9332 G | +0.10 % |

Aucun emplacement : la sortie est au bit pres celle de v49 et le cout +0.1 a +0.2 % d'instructions (quelques
operations par bloc : la matrice passe de 6 a 14 lignes dans le prologue du moteur, l'arc de la face) : dans le bruit
du chronometre.

### Chronometre (% d'un coeur de la machine de test, meilleur de 3, 3 s ; machine partagee : +/- 10 %)

| Scene | PRO STD | CLASSIC STD |
|---|---|---|
| INIT (v49) | 7.32 | 8.97 |
| INIT (v50, 0 emplacement) | 7.89 | 9.95 |
| INIT + MOD 4 | 10.31 | 13.56 |
| INIT + MOD 8 | 10.15 | 16.64 |
| CAS DE MIKA (v49) | 31.90 | 50.31 |
| CAS DE MIKA (v50, 0 emplacement) | 30.45 | 51.93 |
| CAS DE MIKA + MOD 4 | 35.86 | 57.43 |
| CAS DE MIKA + MOD 8 | 36.07 | 66.09 |

(L'ecart v49 / v50 sans emplacement est le bruit de la machine : en instructions il est de +0.2 %.)

Ou va le cout avec la matrice (profil callgrind, INIT + MOD 4, PRO) : le moteur en chemin matrice (les lignes par
echantillon interne, les destinations par voix : +60 % sur le moteur seul pour une voix), le MASTER WIDTH module (l'etage
master ne se contourne plus), la chaine reposee a chaque tranche (ArpFx::set, quelques pow), le moteur rendu par
tranches de 32. Optimisation faite : les boucles par echantillon ne passent que sur les lignes qui bougent (-4 % avec 4
emplacements, au bit pres).

## 6. Decisions prises et pourquoi

- **Les emplacements xMx sont des lignes de la matrice du moteur** (14 au lieu de 6, la meme boucle) : "exactement le
  code de la matrice xM" sans copie, egalite au bit pres prouvee (209 / 209), les lissages (quantite 15 ms, changement de
  cible par 0) et les sources par voix gratuits ; LFO 3 / 4 y entrent comme deux sources communes.
- **Les cibles generiques passent aussi par le moteur** (une ligne qui calcule seulement sa contribution) : le meme
  lissage de quantite, le changement de cible sans saut, et les sources par voix (la derniere note, la voix la plus
  recente) au meme endroit que pour la matrice d'avant. Le processeur ne fait qu'additionner et poser.
- **Tranches de 32 seulement quand une cible generique est modulee** : sinon le bloc entier, le chemin v49 (au bit pres,
  cout nul). La valeur effective est posee dans les tableaux de travail (`knobs_`, `ex_`) : la DISTO, HELL, l'EQ et les
  LFO la relisent d'eux-memes ; le moteur, la chaine et l'arpege ne sont reposes que si leur famille a bouge.
- **Valeur hote gardee a part** : l'automation d'un reglage module reste la base (`modHostSync`), l'hote ne voit jamais la
  valeur modulee (ses parametres restent les siens, le projet sauve la valeur de l'utilisateur).
- **Lissage** : les sources sont deja lissees (LFO 2 ms, controleurs, velocite, S&H 5 ms), les quantites glissent 15 ms
  dans le moteur ; la chaine (20 ms), l'EQ, la DISTO, le moteur lissent leurs reglages. Seul HELL recoit 10 ms de plus.
- **LFO 3 suit la DISTO** : copie exacte du LFO de Decap, recalee sur son etat apres chaque passage quand la DISTO
  tourne (la route DISTO ne change pas d'un bit) ; DISTO coupee, il tourne seul. Saut de phase quand la DISTO s'engage
  (elle repart a 0), lisse 1.5 ms.
- **LFO 4 SYNC cale sur le transport** (comme LFO 1 / 2 du site) : une boucle et un export rejouent le meme LFO ; libre au
  tempo quand l'hote est arrete. La loi de vitesse de xDLfoRate (contrat).
- **Chemin par voix** seulement pour les potards a loi lineaire ou exponentielle (equivalence exacte a l'echelle pres) ;
  les autres par le chemin generique, la loi du potard respectee.
- **Textes de l'hote** : la cible par son nom (Ableton montre "FILTER CUTOFF", pas un numero de cran).

## 7. Ce qui reste a faire / points en suspens

- **La face (autre agent)** : `extra.ts clean()` arrondit au millieme : pour xMx{n}Dst il faut arrondir au cran
  (`Math.round(v * 1023) / 1023`) ; sections `lfo` et `mod` a ajouter a `ExtraSection` si besoin ; le RANDOM de la face
  doit laisser les emplacements a OFF (la banque l'est deja, `build.mjs` le verifie).
- **KEY bipolaire** (ecart au contrat, voir 2.) : a confirmer par "main" / la face.
- **HELL v2** module vite (carre) clique comme sous l'automation de l'hote (son MIX est pris par tranches de 64 et
  repart vide a 0) : a ecouter par Mika ; le lissage de 10 ms le ramene sous l'automation.
- **MASTER VOLUME** module en carre : un peu plus de relief que l'automation (le seuil de l'ecreteur du moteur suit la
  valeur par tranche) ; inaudible avec un LFO doux, a ecouter.
- **Arpege** : GATE / ACCENT / SWING modules sont lus au bloc de l'hote suivant (au plus 10 ms a 512 echantillons).
- Aucune ecoute : tout est mesure ; a ecouter par Mika (une route LFO 4 -> DELAY TIME, une route VELOCITY -> FILTER
  CUTOFF, HELL MIX).
- Mesures CPU sur la machine de test partagee : a confirmer avec le compteur du plugin sur le Mac de Mika. Piste si la
  matrice pese trop a 8 voix : les sources communes (LFO, controleurs) vers une destination par voix pourraient etre
  calculees une fois par echantillon pour toutes les voix (aujourd'hui : le code de la matrice xM, par voix).
- CLAUDE.md (etat du plugin : "264 parametres hote (dernier : xLatency)") et le journal `2026-11-09-plugin-mm-arp.md` :
  295 (dernier : xMx8Amt ; 360 parametres JUCE avec les 62 potards et arp / master / prio), a mettre a jour a la fusion.

## 8. Commandes utiles ajoutees

- `node plugin/mm-arp/tests/extra-gen.mjs` (et `--check`) : ExtraTable.inc, ModTable.inc et modTable.ts ensemble.
- `cmake --build build-host --target mmarp_mod_test && ./build-host/mmarp_mod_test_artefacts/Release/mmarp_mod_test`
  (CI, job host).
- `./build-host/mmarp_cpu_bench_artefacts/Release/mmarp_cpu_bench 3 "INIT + MOD 8" 1 both 128 3` ; filtre exact
  `"=INIT"` ; scenes `INIT + MOD 4 / 8`, `CAS DE MIKA + MOD 4 / 8`.
