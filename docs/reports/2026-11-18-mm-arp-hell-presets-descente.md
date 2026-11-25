# 2026-11-18 - MM-ARP : les presets HELL qui devaient descendre montaient

Constat (mesure sur le DSP) : cinq presets de `HELL_PRESETS` (`src/v4/plugin/arp/hell.ts`) avaient un SHIFT negatif ET
la bande DOWN (`ud: 0`). Dans `plugin/mm-arp/dsp/Hell.cpp`, la bande UP vaut `f + hz` et la bande DOWN `f - hz` : avec
`hz` negatif et DOWN, la sortie est `f + |hz|`, donc ces presets MONTAIENT alors que leurs noms et descriptions disent
qu'ils descendent. Leur ANTI REFL ne s'engageait pas non plus (Hell.cpp ne l'engage que pour une bande qui descend).
Le plugin MM-HELL (branche `claude/vibrant-ptolemy-dv2l0v`) l'avait deja corrige en passant ces presets en UP.

## 1. Ce qui a ete fait

- `src/v4/plugin/arp/hell.ts` : `ud: 0` -> `ud: 1` (SIDEBAND UP, la bande qui suit le signe du SHIFT) sur BARBER DOWN,
  ABYSS, DEEP STAIRS, SULFUR RAIN et HELLFIRE SWELL. Le SHIFT negatif et tout le reste sont inchanges.
- `plugin/mm-arp/tests/hell-presets-gen.mjs` (nouveau) : lit la VRAIE banque de `hell.ts` (copie dans un dossier
  temporaire, lancee avec `--experimental-strip-types`, l'import de `./extra` remplace par un bouchon) et ecrit
  `tests/hell_presets.inc` ; `--check` echoue si le fichier n'est pas a jour.
- `plugin/mm-arp/tests/hell_presets.inc` (nouveau, genere) : les 24 presets, valeurs 0..1 des reglages xHell*.
- `plugin/mm-arp/tests/hell_test.cpp` : section 16. Chaque preset de la face passe dans le DSP (memes lois que
  `PluginProcessor.cpp`) ; un sinus de 1 kHz, sans reinjection, LFO, filtres ni flou, a 120 BPM : pour chaque preset a une
  seule bande (hors RANGE MIDI), un SHIFT negatif descend et un positif monte. Pour ceux qui descendent avec ANTI REFL,
  un sinus a |SHIFT| / 2 (replie sous 0 Hz par la descente) doit baisser d'au moins 20 dB.
- `.github/workflows/plugin-arp.yml` : l'etape HELL lance aussi `hell-presets-gen.mjs --check`.
- `plugin/mm-arp/README.md` : la commande du test HELL et la regeneration de l'inc.

Mesures (1 kHz en entree, FEEDBACK 0) :

| Preset | SHIFT | Avant (DOWN) | Apres (UP) |
|---|---|---|---|
| BARBER DOWN | -18 Hz | 1018 Hz | 982 Hz |
| ABYSS | -140 Hz | 1140 Hz | 860 Hz |
| DEEP STAIRS | -55 Hz | 1055 Hz | 945 Hz |
| SULFUR RAIN | -24 Hz | 1024 Hz | 976 Hz |
| HELLFIRE SWELL | -40 Hz | 1040 Hz | 960 Hz |

ANTI REFL : sur ABYSS, DEEP STAIRS, SULFUR RAIN et HELLFIRE SWELL, le repli baisse maintenant d'au moins 30,7 dB
(0 dB avant : le filtre n'etait jamais engage).

## 2. Decisions prises et pourquoi

- **UP + SHIFT negatif plutot que DOWN + SHIFT positif** : la face affiche le SHIFT avec son signe (-18 HZ). Le signe
  affiche doit etre le sens entendu. C'est aussi le choix du MM-HELL, les deux banques restent alignees.
- **Un test de sens dans `hell_test.cpp`, branche sur `hell.ts`** : le bug est passe parce qu'aucun test ne reliait la
  banque de la face au DSP (les tests HELL ne testaient que des reglages ecrits a la main). Le test lit la vraie banque
  via l'inc genere, et le `--check` du CI garantit que l'inc suit `hell.ts`. Un futur preset qui se trompe de bande sera
  donc attrape aussi, pas seulement ces cinq.
- **Verifie dans les deux sens** : avec l'ancien `hell.ts`, la section 16 echoue (les cinq "montent", ANTI REFL inactif
  sur quatre) ; avec le nouveau, elle passe.
- **Banque d'usine (`presets/build.mjs`, `presets/factory/*.mmarp`) non touchee** : elle n'embarque aucun preset HELL. Ses
  touches de HELL (`HELL_SOFT`, MIX <= 0.10) gardent SIDEBAND a 1 ou 0.5 ; aucune n'a SHIFT negatif + DOWN (verifie sur
  les 40 presets). `hellGentle` (RANDOM) non plus.
- **Pas de migration des projets** : un projet ou un preset disque qui a charge l'ancien BARBER DOWN (etc.) garde ses
  valeurs, donc l'ancien son qui monte. Le migrer changerait le son de projets existants sans prevenir.
- **Aucune lecture audio** : tout est mesure dans des buffers (Goertzel), `fx-ref.mjs` en mode `worklet` (Node, bouchons).

## 3. Ce qui reste a faire / points en suspens

- **Mika** : quand `plugin-arp.yml` est vert, mettre a jour le plugin (`update.sh`) et ecouter BARBER DOWN, ABYSS, DEEP
  STAIRS, SULFUR RAIN et HELLFIRE SWELL : chaque repetition doit descendre.
- **Projets existants** : un projet sauve avec un de ces cinq presets garde l'ancien son (montant) ; la face ne le reconnait
  plus comme le preset (numero `--`). Recharger le preset depuis la page HELL pour avoir la version qui descend.
- **MM-HELL** : son `tests/presets_ref.inc` est un instantane de `hell.ts` (commit 8e88e7f9). Regenere depuis ce `hell.ts`,
  l'exception `fixedFall` de `presets_test.cpp` devient inutile (elle passe toujours, on peut la retirer).

## 4. Commandes utiles ajoutees

- Regenerer l'inc apres une modif de la banque HELL :

```bash
node plugin/mm-arp/tests/hell-presets-gen.mjs
```

- Le test HELL (verifie aussi que l'inc est a jour) :

```bash
node plugin/mm-arp/tests/hell-presets-gen.mjs --check && ./build-dsp/mmarp_hell_test
```
