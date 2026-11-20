# 2026-11-20 - MM-ARP v46 : les pages DELAY et REVERB option A, en vrai (DSP compris pour la reverbe)

Mika avait installe la derniere version : DELAY et REVERB n'avaient pas change ("reverb toujours aussi vide"), parce que
les refontes v44 n'existaient qu'en maquette derriere `?fx2`. Il a valide l'option A pour les deux pages. Cette session
les rend reelles, par defaut, sans drapeau, et donne a la reverbe le DSP qui manquait (EQ, WIDTH, DUCK, FREEZE).

## 1. Ce qui a ete fait

- Parametres (EN FIN de `plugin/mm-arp/extra-params.json`, section sky, neutres par defaut) : `xSkyLoCut`,
  `xSkyLoSlope`, `xSkyMidHz`, `xSkyMidDb`, `xSkyMidQ`, `xSkyHiCut`, `xSkyHiSlope`, `xSkyWidth`, `xSkyDuck`,
  `xSkyFreeze` ; `src/ExtraTable.inc` regenere ; leurs textes dans l'hote (`src/ExtraParams.h`).
- DSP, `dsp/ArpFx.{h,cpp}` (en tete : "5. LA SORTIE DE LA REVERBE") : sur le mouille de la reverbe, apres le convolueur ou
  la BigSky et SHIMMER (CLASSIC compris), une instance de `ParamEq` a trois bandes (HP 12/24, cloche, LP 12/24 ;
  contournee au neutre), WIDTH milieu / cote (glisse en 20 ms), DUCK (`EchoDuck`, l'enveloppe du DUCKING du DELAY,
  retour 250 ms). Aucune allocation dans le thread audio.
- DSP, `dsp/Sky.{h,cpp}` : `setFreeze` ; FREEZE monte en 50 ms les gains du reseau a 1 et coupe l'entree (et tout ce qui
  entre dans le reseau : premieres reflexions, bande de MAGNETO, prises de NONLINEAR, SHIMMER) ; sans effet sur SPRING
  (pas de reseau) ni CLASSIC.
- `src/PluginProcessor.cpp` : les 10 reglages vers `ArpFxSettings` (`sameRvPost`) ; la position du transport (ppq) et le
  tempo gardes pour la face ; `src/PluginEditor.{h,cpp}` : `mm_transport` porte `ppq` (absent a l'arret) et `bpm`.
- Face : `DelayPage.tsx` n'est plus qu'un appel a la page A (`DelayPage2.tsx`) ; l'option B et le drapeau `?fx2` de DELAY
  sont supprimes, comme les reglages de maquette. La tete de lecture des echos suit la position de l'hote
  (`hostClock.ts`), les temps et les ms sont comptes au tempo de l'hote ; en RHYTHM, les seize prises du motif sont
  dessinees sur l'ecran des echos (un clic : le motif suivant) ; la pastille PRESETS du petit ecran ouvre la liste.
- Face : `SkyPage2.tsx` refait sur les vrais reglages (plus de `mockParam`, plus de B, plus de `RoomView`) : la cascade 3D
  (le vrai Tr60 par bande, LOW / MID / HIGH ecrits, FREEZE qui tient la queue, CLASSIC dessine aussi), l'EQ de la reverbe
  a trois points qu'on glisse (Maj + glisser ou la molette sur M : son Q ; Alt + clic : neutre), la sortie MIX, WIDTH, DUCK,
  FREEZE. `HoodBoard.tsx` : REVERB montre cette page, sans drapeau (HELL garde son aiguillage `?fx2`).
- Face : `skyPost.ts` (les lois et les textes des 10 reglages, le gris : MID sans gain, la pente d'une coupure eteinte,
  FREEZE sur CLASSIC et SPRING), `extra.ts` et `pcbui.tsx` (deux lignes chacun), `fxPages.css` (le CSS neuf).
- Banque d'usine regeneree (`presets/build.mjs`) : les 10 cles neuves a leur neutre, le son au bit pres.
- Tests : `tests/sky_test.cpp` (section 6, 30 controles neufs), `tests/host_test.cpp` (les 10 en fin de liste).

## 2. Decisions prises et pourquoi

- Les 10 reglages sont globaux (pas dans la memoire par machine de `sky.ts`) : l'EQ et la sortie sont ceux de la page,
  quelle que soit la machine, CLASSIC compris.
- L'EQ est hors de la boucle de SHIMMER (le retour a l'octave lit la reverbe avant l'EQ) : la sortie seule change.
- DUCK : retour fixe de 250 ms (le DELAY garde son RELEASE a lui) ; a 100 %, la reverbe se tait des que le sec depasse
  -12 dBFS, comme le DUCKING du DELAY.
- FREEZE : gains exactement a 1. Mesure : la queue tenue perd 0.8 a 3 dB en 40 s (l'interpolation des lignes modulees
  assombrit un peu), jamais plus fort, sans NaN. NONLINEAR ne tient que sa queue tardive (ses prises s'eteignent) : -15 dB.
- Pas de presets REVERB : la page A n'en avait pas ; la banque d'usine du synthe reste seche (reverbe a 0, CLASSIC).
- La tete de lecture du DELAY : `mm_transport` (a chaque note et au moins une fois par seconde) porte la position ; entre
  deux, la face avance au tempo. Hors du plugin ou a l'arret : l'horloge de la page, comme avant.
- Fusions : DISTO v46 puis HELL v2 (claude/nifty-bohr-7ixmpf) ; les 10 reglages REVERB viennent apres `xHellDescent`,
  aux indices 253 a 262 (263 reglages en tout) ; `ExtraTable.inc`, la banque d'usine et `host_test` regeneres ou mis a
  jour. HELL v2 n'utilisant plus `fx2.ts`, il est supprime (le tempo de la face est lu dans `DelayPage2.tsx`) ; `fx2.css`
  ne garde que le petit ecran, DELAY et REVERB (les regles de HELL sont dans `hell2.css`, celles des options B partent).
  `SkyPage.tsx` reste : ses pieces (`tail`, `cellOf`, `CellView`) servent a la page.

## 3. Ce qui reste a faire / points en suspens

- Mika : ecouter la reverbe avec l'EQ (coupe-bas sur la queue), WIDTH, DUCK et FREEZE dans Ableton (aucune lecture ici).
- La position de l'hote n'a ete verifiee que par le DOM (evenement `mm_transport` simule) : a regarder dans Ableton.
- Le build complet du VST3 (avec la face) n'a pas tourne ici : `PluginEditor.cpp` est verifie par une compilation de
  syntaxe contre JUCE ; le CI mac le construira.

## 4. Commandes utiles ajoutees

- Aucun script neuf. Les controles neufs tournent dans `./build-dsp/mmarp_sky_test` (CI : "Reverb facon BigSky").
