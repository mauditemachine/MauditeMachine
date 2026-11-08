# 2026-11-08 - MM-RYTM VST3 : la vraie face du site dans le plugin (phase 1)

## 1. Ce qui a ete fait

- `src/v4/plugin/` (nouveau) : la face du plugin.
  - `PluginFace.tsx` : la MM-RYTM seule, vue de dessus, sans le chrome du site.
  - `main.tsx`, `boot.tsx` : l'entree.
  - `restore.ts` : l'etat du projet remis dans le localStorage avant les stores.
  - `bridge.ts` : le pont avec le C++ (le programme, l'etat, les coups en direct, RUN/STOP, le transport).
  - `head.ts` : la tete de lecture venue du C++.
- `src/v4/theme/base.ts` : `PLUGIN` (window.__MM_PLUGIN__ ou ?plugin=1) ; PORTRAIT toujours faux en plugin.
- `src/v4/theme.ts` : camera du plugin perpendiculaire au panneau (el 90 - TILT, champ 10 deg, pivot PANEL_TOP_Y), `PLUGIN_FACE`.
- `src/v4/scene/renderer.ts` : cadrage de la face bord a bord en plugin ; la tete de lecture lue sur `extHead` quand une source est branchee.
- `src/v4/state/focus.ts` : pas d'autres machines en plugin.
- `src/v4/hooks/useKeys.ts` : en plugin, ni sections (1-5), ni capot (6/O), ni R.
- `src/v4/audio/clock.ts` : `clock.external()` et `externalChanged()`, le transport du C++ remplace l'horloge du navigateur.
- `src/v4/audio/drums.ts` : `resolveHit()` (ce qu'un coup jouerait, sans le jouer) et `liveHook` (les coups en direct vers le C++).
- `plugin/mm-rytm/web/` (nouveau) : `index.html` (polices Robot Radicals et SF Pro Display servies localement) et `vite.config.ts` (build vers `plugin/mm-rytm/build-web`, sans le public du site, avec le logotype).
- `plugin/mm-rytm/dsp/Program.{h,cpp}` (nouveau) : le programme de lecture.
- `plugin/mm-rytm/dsp/Engine.{h,cpp}` : reecrit pour 16 pistes. Il reprend le comportement de `voice()` du site :
  - l'enveloppe ATK / HOLD / DECAY ;
  - START ;
  - le PAN mono a puissance constante et le PAN stereo ;
  - le kick mono, les portes de choke, 4 voix par piste ;
  - le sequenceur par pas (swing, longueur, page bouclee) ;
  - les notes MIDI et les coups en direct, tries par position dans le bloc.
- `plugin/mm-rytm/src/` :
  - processeur reecrit : programme JSON, calcul des sons hors du thread audio (cache par recette), RUN interne, etat du projet (programme + localStorage) ;
  - editeur `WebBrowserComponent` qui sert la face depuis un zip embarque et les samples depuis la banque ;
  - `SampleBank` indexe les samples par cle du site.
- `plugin/mm-rytm/tests/engine_test.cpp` : 10 cas sur le nouveau moteur.
- `plugin/mm-rytm/CMakeLists.txt` : la face zippee dans le binaire (WebData), JUCE_WEB_BROWSER=1.
- `.github/workflows/plugin.yml` : build de la face (npm ci + plugin:web) avant le VST3 ; declenche aussi par `src/v4/**`.
- `package.json` : script `plugin:web`.
- `plugin/mm-rytm/README.md`, `INSTALL.md` : architecture, ce qui joue, phases suivantes.

## 2. Decisions prises et pourquoi

- **Le son reste en C++.** Mika veut la face du site. Mais une WebView s'arrete fenetre fermee, et ne suit pas un export d'Ableton plus rapide que le temps reel : faire jouer le navigateur ne marcherait pas.
- **La face compile un programme, le C++ ne fait que jouer.** Les sons, les verrous, la hauteur, le DECAY, le gain et le PAN sont calcules par les fonctions du site lui-meme (`resolveHit`, `tracks.tweakWith`). C'est moins de portage et moins de risque d'ecart.
- **L'etat du projet = les cles `mm.v4.*` du localStorage.** C'est la persistance du site telle quelle (motif, 16 pistes, banques A-H, presets...), restauree avant que les stores la lisent. Le programme est garde aussi, pour jouer des le chargement du projet sans ouvrir la fenetre.
- **La camera : perpendiculaire au panneau incline (TILT 6,63 deg), champ de 10 deg.** La face se lit comme une photo. Orbite verrouillee, pas d'intro.
- **Le multi-out et les parametres par piste de la V1 sont retires.** C'est la face qui regle les sons. Le multi-out reviendra avec le MIXER.
- **Verifications faites sans lecture audio :**
  - la face dans Chromium avec un faux `__JUCE__` : rendu, programme, coup au clavier, restauration d'etat ;
  - le moteur dans ses buffers ;
  - le DSP compare au site (29/29 identiques) ;
  - le site principal se construit toujours.
- **JUCE n'est pas compilable dans le conteneur** : les sources passent l'analyse gcc et clang. Le build complet se fait sur le runner macOS.
- **Note :** le build du site reecrit `dist/404.html` (plugin `copy-404` du vite.config). Je l'ai remis tel quel, rien de commite de ce cote.

## 3. Ce qui reste a faire / points en suspens

- Verifier le run du workflow (le premier avec la WebView).
- **Mika** :
  - installer le nouveau VST3 (refaire la commande `xattr -cr` + `codesign` d'INSTALL.md) ;
  - verifier la face dans Ableton, le son des pads, la lecture calee sur Ableton, PLAY/STOP de la face Ableton arrete, la sauvegarde dans le projet.
- **Phase 2** : le sequenceur DT2 en C++ (`audio/seq.ts` : conditions, probabilite, microtiming, retrig, LEN, LFO), teste contre le site.
- **Phase 3** :
  - FLTR (biquad avec enveloppe) ;
  - les effets de piste (TONE, DIST, CHORUS) ;
  - les envois (DELAY, REVERB) ;
  - le compresseur, le glue et le limiteur du master ;
  - les scenes et le crossfader.
- **Phase 4** :
  - chaines de patterns et FILL (`onBar` du site) ;
  - samples perso du navigateur ;
  - multi-out ;
  - automation Ableton des potards.
- **Limites connues :**
  - deux instances du plugin partagent le localStorage de la WebView (chacune restaure le sien a l'ouverture) ;
  - les raccourcis clavier peuvent etre pris par Ableton.

## 4. Commandes utiles ajoutees

- `npm run plugin:web` : construit la face du plugin dans `plugin/mm-rytm/build-web`.
- Essai de la face dans un navigateur : `npm run dev`, puis ouvrir `/plugin/mm-rytm/web/index.html` (la page du plugin, servie par le serveur du site). La machine seule, vue de dessus ; sans plugin, aucun son.
- `cmake -S plugin/mm-rytm -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release --target MM_RYTM_VST3` : le VST3 sur un Mac (la face doit etre construite avant).
