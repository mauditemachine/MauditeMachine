# 2026-11-20 - MM-ARP v43 : les sept degres sur les pads, la liste des presets a la souris et au clavier

Deux demandes de Mika :
- « les notes.. pourquoi on a pas toutes les fondamentales finalement ? arrange ca ! »
- « les presets je veux pouvoir les selectionner a la souris et avec la touche entree je valide le preset ! »

## 1. Ce qui a ete fait

- `src/v4/voyager/chords.ts` : deux banques. `SITE_CHORDS` (les huit accords du site, inchanges) et `ARP_CHORDS` (le
  plugin : F#m G#ø A Bm C#m D E F#m7, les sept degres de F# mineur naturel dans l'ordre puis i7). `CHORDS` prend l'une
  ou l'autre a l'evaluation (`PLUGIN_ARP`). Chaque accord porte son degre (`roman`) et sa cle Camelot (`camelot`, vide
  pour G#ø). La conversion des anciens indices : `ARP_CHORD_BANK` (2), `SITE_TO_ARP` (0 5 6 4 3 2 7 5), `arpProgOf`,
  `fromSiteProg` ; `PROGRESSIONS` (RANDOM) convertie dans le plugin.
- `src/v4/voyager/screen.ts` : le degre et la cle Camelot viennent de l'accord (plus de tables a part) ; pas de pastille
  sans cle. La liste des presets retient ce qu'elle dessine (`presetRowAt`) et partage ses cotes (`PRESET_LIST`).
- `src/v4/voyager/random.ts`, `src/v4/plugin/arp/hypno.ts` : les progressions de RANDOM dans la banque du plugin, les memes
  accords qu'avant.
- `src/v4/voyager/infos.ts` : les textes INFOS des pads et des presets du plugin.
- `src/v4/plugin/arp/bridge.ts` : `chordBank: 2` dans mm_program, dans la progression gardee (`{ chordBank, prog }`) et
  dans le preset du disque ; un preset ou un etat sans la marque est converti au chargement. Nouveau message
  `mm_keys {on}` (la liste des presets s'ouvre ou se ferme).
- `src/v4/state/presets.ts` : dans le plugin, la capture porte `chordBank`, `apply` convertit une progression sans marque
  (presets de l'ecran d'avant, presets d'usine du site, sons mis de cote), l'empreinte compare dans la banque du plugin.
- `src/v4/plugin/arp/library.ts` : `chordBank` optionnel sur les presets d'usine (factory.json reste en indices du site).
- La liste des presets : `voyager/rig.ts` (une zone par ligne, `vlcd-row-<r>`, a la place de PREV / NEXT dans le
  plugin), `actions/presets.ts` (`voyPresetRow` : clic = choisir, second clic = charger), `ui/Hotspots.tsx`,
  `state/presetMode.ts` (`pick`, `nudge`), `hooks/useKeys.ts` (haut, bas, Entree seulement liste ouverte).
- `plugin/mm-arp/dsp/Params.{h,cpp}` : les accords du plugin en C++, `kChordBank`, `kSiteToArp`, `chordFromSite`.
- `plugin/mm-arp/src/PluginProcessor.cpp` : un programme sans `chordBank` (projet d'avant) est converti ; l'etat de la
  face d'un projet de la premiere version aussi (tableau ou `{ chordBank, prog }`).
- `plugin/mm-arp/src/PluginEditor.{h,cpp}` : `mm_keys {on: false}` rend le clavier a l'hote (`keysToHost`).
- Tests : `params-ref.mjs` (la face du plugin, ligne B : marque et table), `params_test.cpp` (les compare au C++),
  `voyager-ref.mjs` (accords du site, cas inchanges), `host_test.cpp` (5 cas de conversion), `presets_render.cpp`
  (convertit comme le plugin).
- Resultats : tsc 105 (inchange) ; suite DSP du CI complete (21 etapes, toutes a 0) dont voyager_compare 85/85 au bit
  pres et params_test 3000 cas, 0 ecart ; banc host 66 ok, 0 echec ; PluginEditor.cpp compile (verification de syntaxe
  contre JUCE 8, Linux) ; conversion verifiee sur 160 000 cas : notes identiques partout (EDIT compris) sauf Dmaj7 -> D
  en CHORD BASIC / TRIAD. Chromium muet (`--mute-audio`, `?mute=1`) : pads F#m G#ø A Bm C#m D E F#m7, l'ecran dit G#ø
  iiø ; liste : clic = choisi (son inchange), double clic = charge (INDIE DANCE du site : prog [0 2 6 5], chordBank 2),
  bas / haut deplacent, Entree charge, Echap ferme (mm_keys on puis off) ; liste fermee, ni fleches ni Entree ni lettres
  ne sont prises.

## 2. Decisions prises et pourquoi

- **G#ø plutot que G#dim** : la triade diminuee seule sonne tendue et scolaire (le triton a nu). La septieme ajoute F#,
  la tonique : G#ø contient Bm (B D F#), il garde la note de l'accord de depart et glisse vers iv, v ou i, la couleur de
  la dark disco. Avec CHORD 7TH (le reglage de depart), G#dim et G#ø donnent les memes quatre notes ; la difference est
  en BASIC et TRIAD (4 notes au lieu de 3) et sur la serigraphie.
- **Pas de selecteur de tonalite** : il n'existe pas (CHORDS F# MINOR est une serigraphie, le C++ pose les degres de F#
  mineur). La banque reste en F# mineur ; en ajouter un serait un parametre hote (en fin de liste) et une maquette.
- **Une marque plutot qu'une version de projet** : `chordBank: 2` voyage avec chaque progression gardee (programme, etat,
  preset). Sans elle, ce sont des indices du site : la conversion est la meme en TS et en C++ (verifiee par params_test).
  Aucun parametre hote ajoute.
- **Dmaj7 devient D** : il quitte les pads. Le meme son partout (EDIT, CHORD 7TH, 9TH, 11TH : la septieme de la gamme
  revient), sauf en BASIC et TRIAD ou D sonne sans C#. Les 6 presets d'usine qui l'utilisent sont en 7TH ou plus : notes
  identiques.
- **Clavier** : les touches ne sont prises que liste ouverte (haut, bas, Entree ; Echap la ferme deja). Fleches arretees
  aux bouts (la molette tourne toujours en boucle). Un reglage qui a le focus garde ses fleches.
- **Focus en C++** : rien a demander a l'ouverture (le clic qui ouvre la liste donne deja le clavier a la WebView). Un
  `grabKeyboardFocus()` JUCE sur la WebView le lui retirerait (juce_WebBrowserComponent_mac.mm). A la fermeture, la vue
  JUCE de l'editeur redevient premier repondeur (`ComponentPeer::grabFocus`) : les touches remontent a Ableton jusqu'au
  prochain clic dans la face. La face ne l'envoie que si elle avait le clavier (`document.hasFocus`) et qu'aucun champ de
  texte ne le tient.

## 3. Ce qui reste a faire / points en suspens

- Sur le Mac de Mika : la liste au clavier (haut, bas, Entree, Echap) et le retour des touches a Ableton liste fermee
  (le clavier MIDI d'ordinateur). Non testable ici (Linux, sans WebView).
- Un projet d'avant avec Dmaj7 en CHORD BASIC ou TRIAD : il joue D (sans la septieme).
- La banque d'usine (presets/build.mjs, refaite par un autre agent) reste en indices du site, convertie au chargement ;
  pour l'ecrire dans les accords du plugin, ajouter `chordBank: 2` a chaque preset.
- Option : des progressions de RANDOM avec le nouveau ii (G#ø C#m F#m...).

## 4. Commandes utiles ajoutees

- Aucune nouvelle commande. Tests : `node plugin/mm-arp/tests/params-ref.mjs <dir>` puis `mmarp_params_test <dir>`
  (verifie aussi la table de conversion), `mmarp_host_test` (conversion des projets d'avant).
