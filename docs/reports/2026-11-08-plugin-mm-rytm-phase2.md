# 2026-11-08 - MM-RYTM VST3 phase 2 : le sequenceur des trigs, l'ecran a la souris, le site en V1

## 1. Ce qui a ete fait

- `plugin/mm-rytm/dsp/Engine.{h,cpp}` : le sequenceur des trigs en C++, port de `src/v4/audio/seq.ts` et `trig.ts` :
  - les conditions (FILL, PRE, NEI, 1ST, LST, A:B et leurs NOT), avec le compteur de passages ;
  - PROB, avec un generateur mulberry32 a part ;
  - uTIME : chaque pas est evalue en avance de l'uTIME le plus negatif, ses coups attendent dans une file ;
  - LEN : un relachement de 8 ms ;
  - RTRG (RATE, VFAD, RLEN), la repetition coupant le coup d'avant en 8 ms ;
  - les lock trigs : VOL (qui glisse en 10 ms) et PAN du coup qui sonne ;
  - les coups places a l'echantillon le plus proche, et une remise a zero au depart et aux sauts du transport.
- `plugin/mm-rytm/dsp/Program.h`, `src/PluginProcessor.cpp` : les reglages de trig de chaque coup dans le programme. FILL arrive de la face par `mm_fill`.
- `plugin/mm-rytm/tests/engine_test.cpp` : 10 cas de plus (20 au total) :
  - A:B, !A:B, 1ST, FILL, NEI ;
  - PROB 50 % et 0 % ;
  - uTIME en retard et en avance, a l'echantillon ;
  - RTRG avec VFAD et RLEN ;
  - LEN ;
  - lock trig.
- `src/v4/plugin/bridge.ts` :
  - chaque coup porte son trig (`trigNow` du site) ;
  - les lock trigs (pas sans velocite, `ltrg`) font partie du programme ;
  - le programme suit le crossfader (`sceneCtl.onX`) et FILL.
- `src/v4/plugin/ScreenMouse.tsx` (nouveau), une couche de souris posee sur l'ecran (`Stage.screenRect`) quand un menu est ouvert :
  - dans une liste, un clic choisit la ligne et un second clic (ou un double clic) valide ;
  - la molette fait LEVEL/DATA ;
  - le clic droit fait NO.
- `src/v4/scene/screen/menus/registry.ts` (`onPoint`) et `frame.ts` (`lastList`) : la souris dans les menus. La liste des presets a la sienne (`preset.ts point`).
- `src/v4/scene/renderer.ts` : `screenRect()`, le rectangle de l'ecran sur la page.
- `src/v4/theme.ts` : `SCREEN_TOUCH` vrai en plugin (les valeurs de l'ecran se tirent a la souris).
- `src/v4/ui/Hotspots.tsx` : en plugin, un clic droit sur une touche fait FUNC + la touche.
- `src/v4/scene/screen/menus/settings.ts` : les lignes ont un id (YES les reconnait quelle que soit leur place). En plugin, SETTINGS ne garde que PATTERN, PERSONALIZE et ABOUT.
- `src/v4/theme/base.ts`, `src/v4/firmware.ts`, `src/v4/ui/HoodClose.tsx` : le site s'ouvre en V.1.0 par defaut (?face=v6 ou dt2 pour la V.6.0, le selecteur suit). Le plugin est toujours en V.6.0.
- `plugin/mm-rytm/README.md`, `INSTALL.md` : ce qui joue, la souris, le site en V1.

## 2. Decisions prises et pourquoi

- **Le sequenceur des trigs est porte en C++ et ne tourne pas dans la face.** Il doit jouer fenetre fermee et pendant les exports d'Ableton. C'est la meme logique que `seqStep`, voix par voix dans l'ordre des pads ; l'ordre des tirages de PROB est le meme que sur le site.
- **Les LFO sont repousses en phase 3.** Ils modulent surtout des filtres et des effets pas encore portes, et la hauteur, qui demanderait un rendu par coup. Je l'ai dit dans le README.
- **Le crossfader passe par le calcul du site** (`morph.hit`) : le programme est recompile a chaque mouvement. La hauteur pendant le geste suit la grille du site (`hitTone`), ce qui limite les recalculs. Les effets morphes viendront avec la phase 3.
- **L'ecran a la souris passe par une couche HTML** posee sur l'ecran, plutot que par les zones 3D. Ces zones ont ete pensees pour le telephone, et un clic au milieu y faisait PREV. Les menus gardent leur contrat de touches (UP, DOWN, YES, NO), la souris ne fait que le piloter.
- **FUNC au clic droit** : Mika trouve FUNCTION trop dur a tenir avec un plugin. Un clic droit sur une touche fait les deux d'un geste. Les clics droits d'avant (mute d'un pad, d'un pas en TRK) ne changent pas.
- **Le site en V1** : sa reponse, "le plugin est fait pour etre complexe mais sur internet faut retourner vers quelque chose de simple en v1". C'est la V.1.0 du selecteur, celle qui existait. Le telephone garde sa face. Rien n'est en ligne tant que la branche n'est pas fusionnee.
- **Verifications faites sans lecture audio :**
  - moteur dans ses buffers, 20/20 ;
  - DSP compare au site, 29/29 identiques ;
  - la face dans Chromium : presets cliques et charges, SETTINGS clique, clic droit sur MOD qui ouvre le MIXER, TUNE tire a la souris ;
  - le site construit et vu en V1 ;
  - les sources C++ passent l'analyse gcc et clang ;
  - le nombre d'erreurs TypeScript du depot n'a pas bouge (105, deja la avant).

## 3. Ce qui reste a faire / points en suspens

- Verifier le run du workflow, le premier avec la phase 2.
- **Mika** :
  - installer le nouveau VST3 (xattr + codesign, rescan) ;
  - tester a l'oreille les conditions, PROB, les retrigs et le crossfader ;
  - tester la souris dans l'ecran ;
  - dire s'il veut d'autres menus simplifies ou retires.
- **Le site en V1 (a decider avant de fusionner)** : le press kit, les textes SEO et les captures parlent de la machine DT2. Il faudra peut-etre les aligner.
- **Phase 3** :
  - les LFO ;
  - FLTR (biquad avec enveloppe) ;
  - les effets de piste (TONE, DIST, CHORUS) ;
  - les envois (DELAY, REVERB) ;
  - le compresseur, le glue et le limiteur du master ;
  - les effets dans les scenes.
- **Phase 4** :
  - les chaines de patterns ;
  - LST, qui suppose un changement de pattern prevu ;
  - SONG ;
  - le multi-out ;
  - l'automation Ableton des potards.

## 4. Commandes utiles ajoutees

- Aucune nouvelle commande. `npm run plugin:web` reconstruit la face. La face s'essaie avec `npm run dev`, puis `/plugin/mm-rytm/web/index.html`.
- Le site en V.6.0 : `/?face=v6` (ou `?face=dt2`).
