# CONTEXTE : mauditemachine.com

Fichier maitre de l'etat en ligne et des chantiers recents, lu au demarrage par **Claude Code** (`CLAUDE.md`) et **Antigravity / Gemini** (`AGENTS.md`).
Derniere mise a jour : **25 novembre 2026, soir** (MM-ARP v56 sur sa branche, `main` refusionnee dedans ; section 6).

Regle : quand un chantier modifie ce qui est decrit ici (machines, routes, SEO, dates, press kit), mettre ce fichier a jour dans la meme PR.

---

## 1. Etat general en production (`https://mauditemachine.com`)

- **Branche `main`** : stable, deployee automatiquement sur GitHub Pages via `.github/workflows/pages.yml` (`build` + `deploy` + `indexnow`).
- **Versions firmware des machines (`src/v4/firmware.json`)** :
  - `MM-RYTM` (`mm808`) : **V.7.3** (473 fichiers) - synchronisation SOLO/MUTE, selection directe de piste, allegement CPU mobile pendant la lecture pour eviter les craquements audio.
  - `MM-ARP` (`voy`) : **V.2.6** (33 fichiers) - bouton presets accessible et interface mobile epuree.
  - `MM-BASS` (`bass`) : **V.3.0** (24 fichiers) - accessible sous `?bass=1`.
  - `MM-DECKS` (`src/v4/dj/`) : controle du pitch / tempo actif y compris sur les morceaux personnalises (`FILES`) charges par l'utilisateur.
- **Arrivee du site (25 nov 2026, Mika : "je veux que le site s'ouvre avec l'intro et ensuite le menu !")** : le logo arrive, se pose, et le menu s'ouvre seul 1,1 s apres (`src/v4/arrival/Arrival.tsx`, `AUTO_MENU_MS`) ; un geste avant garde la main ; la machine vient au defilement suivant.
- **Contact & Mobile (mi-novembre 2026)** :
  - Fenetre de contact directe et epuree (`/contact/`).
  - Version telephone allegée : RYTM et ARP epures, lecteur `TRACKS` avec pochettes Bandcamp, visionneuse Press Kit et contact fluides.

---

## 2. Positionnement international & Referencement SEO (18 nov 2026, PR #11 et #12)

Mika a demande de retirer toute attache a une ville fixe (« Montpellier », « Sud de la France », « Montreal » comme base) partout et de viser la 1re place SEO :

- **Titres et descriptions (`src/data/seo-meta.json`, `index.html`)** :
  - EN `/` : `Maudite Machine | Dark Disco & Indie Dance DJ · MM-STUDIO` (Maudite Machine en tete sans cannibaliser `/mm-studio/`).
  - FR `/fr/` : `Maudite Machine | DJ dark disco et indie dance`.
  - ES `/es/` : `Maudite Machine | DJ de dark disco e indie dance`.
- **JSON-LD & Entites (`scripts/seo-shared.mjs`)** :
  - 260 blocs Schema.org valides sur les 104 pages HTML prerendues.
  - `MusicGroup` enrichi avec `image`, `member` (`Person` : Michael "Mika" Sanchez), `knowsLanguage` (`fr`, `en`, `es`) et `areaServed: "Worldwide"`.
  - Suppression de `<meta name="geo.placename">` et de toutes les mentions locales residuelles dans `scripts/mm-studio-content.mjs`, `public/llms.txt` et `public/manifest.json`.
- **Press Kit 2027 & Tech Rider (`docs/presskit-2027/content.mjs`)** :
  - `Territory: International` et `Departure: International (Worldwide)`.
  - Tous les binaires ont ete regeneres et publies : `public/Presskit_Maudite_Machine_2027_generic.pdf`, `public/Presskit_Maudite_Machine_2027.pdf`, `public/Presskit_Maudite_Machine_2026-27.pdf`, `public/Tech_Rider_Maudite_Machine_2026-27.pdf`, les 6 WebP de `/presskit/` et `bio.txt` dans `public/press/maudite-machine-press-kit.zip`.
- **Pages de rythmes (`scripts/mm-studio-patterns.mjs`)** :
  - Les 12 pages `acid-house`, `dark-disco`, `indie-dance` et `minimal` (EN/FR/ES) ont ete alignees sur les pas exacts de `src/v4/state/factory.ts` (0 avertissement au build).

---

## 3. Dates de shows a venir (`public/events.json`)

- **19 decembre 2026** : **PRISM** - Quebec, QC (`venue: "PRISM"`, `city: "Québec"`, `country: "CA"`), visible dans l'encart `SHOWS`, sur `/shows/`, dans `llms.txt` et en `MusicEvent` Schema.org.
- Si Mika donne l'heure exacte, le lien de billetterie (`ticketUrl`) ou le visuel, les ajouter sur cette entree dans `public/events.json`.

---

## 4. Page cachee `/plugins` (`mauditemachine.com/plugins`)

- Inventaire personnel des **52 plugins et synthetiseurs** du studio Ableton Live 12 de Mika (`src/pages/PluginsPage.tsx`, `src/data/pluginsData.ts`, captures a plat dans `public/images/plugins/`).
- Chargee en `React.lazy()` dans `src/App.tsx` (-54 Ko sur le chunk d'entree principal).
- Prerendue en HTTP 200 mais strictement cachee des moteurs : `noindex, nofollow`, `Disallow: /plugins` dans `public/robots.txt`, absente de `sitemap.xml`.

---

## 5. Plugins VST3 gratuits contre un courriel (24 nov 2026, `docs/vst-download.md`)

- **Formulaire** (`src/v4/ui/sections/VstDownload.tsx`, sur `/mm-rytm/` et `/mm-arp/`) : MM-RYTM (VST3 macOS et Windows beta) et MM-ARP (VST3 macOS), champ courriel, case "nouvelles" facultative, envoi du modele EmailJS **VST download** (Mika en copie cachee), lien de don volontaire.
- **`/download/?p=rytm|arp`** (`public/download/index.html`, noindex, hors sitemap) : la page des liens du courriel, un bouton par systeme (celui du visiteur part tout seul), installation, don.
- **Configuration** : `public/data/vst.json` (`emailjsTemplateId`, `donateUrl`). **Etat au 24 nov : `donateUrl` = `https://ko-fi.com/mauditemachine` (Ko-fi : Stripe branche, PayPal non, CA$, minimum 3) ; `emailjsTemplateId` = `template_63bjqgy` (25 nov, modele "VST download" du compte EmailJS Maudite Machine, `service_zeuwh04`) : le bloc PLUGINS est visible dans GOODIES** et `/goodies/` mentionne les plugins pour Google (prerendu).
- **Zips publics** : releases fixes `mm-rytm-public` et `mm-arp-public`, remplies a la main par le workflow `Plugin public` (`.github/workflows/plugin-public.yml`) ; jamais les releases `-latest`, ecrasees par chaque build de chantier.
- **Installeurs (25 nov 2026, Mika : "un systeme d'installation comme tous les bons plugins")** : `Plugin public` fabrique `MM-<PLUGIN>-Installer-Mac.pkg` (pkgbuild + productbuild) et `MM-<PLUGIN>-Installer-Windows.exe` (Inno Setup), habilles sobrement (`plugin/installer/` : logo, textes courts, licence), installes pour de vrai sur les runners (et desinstalle sous Windows) avant publication ; le zip `MM-<PLUGIN>-VST3.zip` les reunit avec le README. `/download/` : un bouton par systeme, celui du visiteur part tout seul. Non signes (Apple Developer et certificat Windows a acheter).
- MM-ARP (plugin) : fusionne dans `main` a la v53 le 25 nov 2026, v54 a v56 sur sa branche depuis (section 6) ; sa release `mm-arp-latest` (workflow `plugin-arp.yml`) est celle que `Plugin public` reprend : relancer `Plugin public` maintenant publierait le dernier build de `mm-arp-latest` (verifier son `BUILD.txt` avant).
- **Un zip par plugin** (`MM-RYTM-VST3.zip`, `MM-ARP-VST3.zip`, 24 nov, Mika : "dans le meme package, c'est aux gens de faire ce choix") : depuis le 25 nov, les deux installeurs et le README. **Distribution non signee assumee** (25 nov, Mika : "distribue de cette maniere, pas le choix") : un clic "Ouvrir quand meme" / "Run anyway" la premiere fois, pas de compte Apple Developer pour l'instant. **MM-RYTM Windows (beta)** : job `windows` de `plugin.yml` (MSVC, WebView2), jamais essaye sur un PC avant publication. MM-ARP Windows : a faire (meme recette : `plugin/mm-rytm/README.md`).
- **Navigation (25 nov 2026, Mika : "Goodies est trop petit dans le menu" ; "laisse MM-RYTM et MM-ARP dans le menu mais cette fois pour les telechargements et les presentations")** :
  - Menu : `TRACKS, MIXTAPES, MM-RYTM, MM-ARP, GOODIES (badge FREE), SHOWS, PRESS, CONTACT` (`src/v4/ui/Header.tsx` `PAGE_LINKS`) ; la pastille GOODIES de "Under the hood" est retiree (reste MERCH).
  - En-tete : bouton jaune **GOODIES FREE** (desktop, avant MENU) et cadeau jaune (telephone), `GoodiesButton`.
  - **`/mm-rytm/` et `/mm-arp/`** (`PluginPage.tsx`, textes dans `src/data/vstPages.json`, images `public/images/vst/`) : presentation, systemes, "Play the full plugin" (RYTM, desktop), "Play it on the site", formulaire courriel ; prerendues avec un `SoftwareApplication` gratuit, dans le sitemap et `llms.txt`.
  - **GOODIES** : Play online (MM-RYTM, MM-ARP, MM-DECKS), fonds d'ecran et pochettes. **Les plugins n'y sont plus** (25 nov, Mika : "les goodies ce sont les goodies.. les plugins ne sont pas des goodies !") : seulement sur `/mm-rytm/` et `/mm-arp/`.
  - **`/download/`** : l'encart "Before it downloads" (Buy me a coffee / Just download) en haut, le telechargement part seul apres 8 s (25 nov, Mika : "je pensais qu'il y avait ce genre de chose avant de download").
  - **`/mm-rytm/play/`** (25 nov, `WebRytmPlugin.tsx`, noindex, desktop ; au telephone, un message) : la face du VST3 et son processeur C++ compile en WebAssembly (`plugin/mm-rytm/web-engine/`, worklet `src/v4/plugin/rytm/web/rytmEngine.worklet.js`, sons calcules dans un Worker `rytmRender.worker.js`, faux backend JUCE `webBackend.ts`, Mika : "fais pareil pour le RYTM apres"). Verifie : le moteur natif est identique au bit pres au vrai `MMRytmProcessor` JUCE (49 programmes, 18 M d'echantillons, 0 ecart) ; le wasm differe au dernier bit (libm de WASI, ecart RMS -93 dB ou moins), inaudible. Etat du plugin isole du site (cles `mm.web.rytm.ls:*`). Samples de la banque telecharges a la demande depuis `public/samples/rytm`. Le wasm est construit par `pages.yml` ; sans lui, la page le dit.
  - **`/mm-arp/play/`** (25 nov, `WebArpPlugin.tsx`, noindex, desktop) : la face du VST3 (v53 sur `main` ; v56 des que `claude/nifty-bohr-7ixmpf` sera refusionnee, section 6) et son processeur C++ compile en WebAssembly (`plugin/mm-arp/web-engine/`, worklet `src/v4/plugin/arp/web/arpEngine.worklet.js`, faux backend JUCE `webBackend.ts`). Verifie : le moteur natif est identique au bit pres au vrai processeur JUCE (80 presets, automation, MIDI) ; le wasm sort les memes echantillons sauf des ecarts infimes sur des valeurs quasi nulles (sous-normaux, au plus 7e-15), inaudibles. Etat du plugin isole du site (cles `mm.web.arp.ls:*`). Presets disque dans le navigateur, SAVE .MID en telechargement, MIDI LEARN par Web MIDI. Le wasm est construit par `pages.yml` (clang 18 + paquets wasi d'Ubuntu) ; sans lui, la page le dit.
- **Publie (25 nov 2026, installeurs, verifie le 25 nov au soir)** : `mm-rytm-public` = version `2026.11.25.8`, build `2fd52a6` de `main` (`.pkg` Mac universel, `.exe` Windows x64 beta, zip des deux) ; `mm-arp-public` = version `2026.11.25.6`, build `9744576` (v53) de `claude/nifty-bohr-7ixmpf` (`.pkg` Mac universel, zip). Le public n'a pas encore les v54 a v56 de MM-ARP. MM-RYTM se publie depuis le dernier build vert de `main` (artefacts de `plugin.yml`), MM-ARP depuis `mm-arp-latest`.

---

## 6. Plugin MM-ARP (VST3 macOS, Ableton) : etat et conventions

- **Branche de travail : `claude/nifty-bohr-7ixmpf`.** Fusionnee dans `main` a la v53 (25 nov 2026, Mika : "fusionne la branche de MM-ARP"), puis v54, v55 et v56 faites dessus le meme jour ; `main` y a ete refusionnee le 25 nov au soir (ce fichier, `CLAUDE.md` court de `main`, empreintes `firmware.json` reposees) : la branche se fusionne dans `main` sans conflit, PR a ouvrir quand Mika le demande. Tant que ce n'est pas fait, `main` et `/mm-arp/play/` restent a la v53. Journal detaille : `docs/reports/2026-11-09-plugin-mm-arp.md` (une section par publication).
- **Code** : face WebView dans `src/v4/plugin/arp` (tout gate `PLUGIN_ARP`, le site et MM-RYTM ne doivent jamais changer) ; C++ dans `plugin/mm-arp` (`src/` JUCE, `dsp/` moteur et effets, `tests/`). Build face : `npm run plugin:arp:web`. Toute modification de `plugin/mm-arp/src/PluginProcessor.cpp` se repercute dans `plugin/mm-arp/web-engine/ArpEngine.cpp` (AGENTS.md, section 3).
- **Publication** : tout push qui touche `plugin/mm-arp/**`, `src/v4/**`, `package*.json` ou le workflow lance `plugin-arp.yml`, **sur n'importe quelle branche, `main` comprise** (sinon `workflow_dispatch`) ; release fixe `mm-arp-latest` = le DERNIER build, `BUILD.txt` DANS le zip (commit, branche, heure). Si le job mac est "cancelled" (pas de runner) : rerun. Installation Mika :
  `curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash`
- **Piege (25 nov 2026)** : un push sur `main` (`ea86661`, 20:18 UTC) a reconstruit `mm-arp-latest` en v53 par-dessus la v56 de 18:36 UTC. Tant que la branche n'est pas refusionnee, verifier le `BUILD.txt` du zip apres chaque push sur `main` qui touche `src/v4/`, et relancer `plugin-arp.yml` sur `claude/nifty-bohr-7ixmpf` si besoin.
- **Invariants** : `tsc --noEmit` reste a 105 erreurs ; moteur CLASSIC au bit pres du site (`voyager_compare` 85/85) ; nouveaux parametres hote TOUJOURS en fin de liste, les anciens gardes en "OLD ..." avec conversion au chargement ; banque d'usine (`presets/build.mjs` + `src/v4/plugin/arp/analog.ts`) : v53, effets LEGERS bornes (`ANALOG_FX`, jamais de reverbe sur une basse), passe-bas modere, pas trop aigu ; RANDOM suit les memes regles. Valider le YAML du workflow avant push. `npm run firmware:stamp` apres toute modification de `src/v4/` (sans monter la version quand seul le plugin change). `src/v4/voyager/params.ts` est lu par Node (`presets/build.mjs`, `fx-ref.mjs`) : n'y importer ni `theme/base` ni un module du site ; `window` seulement derriere `typeof window`.
- **Design** : Mika veut des IMAGES avant tout changement de design (maquette, il valide, puis code et publication) ; choix A / B / C : une image par option, lettre en gros dessus (AGENTS.md, section 5). Une refonte n'est "faite" que si elle est la page PAR DEFAUT du build publie, jamais derriere un drapeau d'URL (Mika, 2026-11-20 : "t'as rien branle").
- **Etat v56 (25 nov 2026)** :
  - **v56** : fiches INFOS de la touche PRESET et de l'ecran (pastille PRESETS) reecrites pour le navigateur, dessin des 4 colonnes BASS / SEQ / LEAD / PAD (`voyager/infos.ts`, `voyager/diagrams.ts` `browserDiagram`) ; le site garde ses anciennes fiches.
  - **v55** : vivacite des couleurs au niveau B (Mika : "couleurs B", `voyager/vivid.ts` `VIVID_LEVEL`).
  - **v54** : double clic sur un potard (face, encart EDIT, pages OPEN) = valeur de depart, Alt / Cmd / Ctrl + clic aussi ; un clic seul ouvre la page du potard (HELL, REVERB, DELAY, DISTO) 300 ms apres, le temps de voir si un deuxieme appui suit (`voyager/faceDbl.ts` `FACE_DBL.ms`) ; leviers, touches a crans et segments agissent tout de suite.
  - **v53** : PRESET ouvre le navigateur (`PresetBrowser.tsx`, banque du VST3 par familles, clic = charge) ; pages d'OPEN sans diode (`noled.css`). Banque d'usine dark disco / italo hypnotique, 80 presets (BASS 42 / SEQ 20 / LEAD 10 / PAD 8, basses en MONO), effets legers ; emplacements `xMx` a OFF (RANDOM aussi).
  - **v52** : LED eteintes en verre, allumees a l'accent ; grands noms et chiffres des ecrans en points (Doto 'MM Dots', `plugin/mm-arp/web/fonts`, `dots.css`, `screen.ts`) ; colonne FILTER EG / AMP EG : ecran des enveloppes + POLARITY, KEY TRACK, ACCENT, VOICE (`EgColumn.tsx`) ; pads = 7 degres de la tonalite choisie + tonique a 4 sons (CHORDS F# MINOR par defaut, `KeySelect.tsx`).
  - **Face** : cuir, knobs = PNG de Mika (`vknob` : k1, k3, sel, tiny ; ne JAMAIS les redessiner), touches pilules a LED partout, accent reglable (SETTINGS). Pages OPEN : barre C (touches mates, LED dans la touche), SOUND A (EQ en haut, Maj = Q, Alt = fin), DISTO A (un seul EQ, CLEAN LOW, PUNISH v2 en levier, `xDPunish2`), DELAY A (echos facon Echo, cale sur le ppq de l'hote), HELL v2 (vortex, six cercles, `xHellV2..xHellDescent`), REVERB A (cascade 3D, EQ / WIDTH / DUCK / FREEZE sur le mouille), SEQ refaite (tete commune, crayon, END ; sans matrice depuis v50 ; v51 : touches hautes).
  - **Encart EDIT** (v50, option C) : SYNTH | LFO | SQ | FX MOD ; LFO 1 a 4 (LFO 3 = LFO de la DISTO) + MOD MATRIX 8 lignes au viseur (`xMx1..8`, cibles 32 + k = reglage hote k, table generee `modTable.ts` / `ModTable.inc` par `extra-gen.mjs`) ; anciennes routes jamais converties, montrees en "lignes liees" ; section MOD retiree de la face du plugin (le site la garde).
  - **Moteur** : 297 parametres hote (dernier : `xScale`) ; `xLatency` (LATENCY EXACT / ZERO, ZERO pour les instances neuves), `xKey` / `xScale` (la tonalite) : reglages d'instance, jamais changes par un preset ni RANDOM. Moteurs CLASSIC / PRO, QUALITY ECO / STD / HQ, 8 voix. v49 : face au repos (`mm_tick` unique, rien face cachee), demi-bandes RII a phase minimale (`dsp/Halfband.h`).
- **En attente de Mika** :
  - Essai dans Ableton du double clic, et dire si l'attente de 300 ms avant l'ouverture d'OPEN se sent (reglable, `FACE_DBL.ms`).
  - Avis d'ecoute de la banque dark disco (presets a garder, a refaire).
  - Essai du navigateur de presets dans Ableton (molette du trackpad, liste disque).
  - Questions ouvertes depuis la v52 : une instance neuve doit-elle toujours partir en F# MINOR ? Les temoins d'alerte (OLD EQ ON, CPU, VU rouge, erreurs) prennent-ils l'accent ?
  - Feu vert pour fusionner `claude/nifty-bohr-7ixmpf` dans `main` (v54 a v56 sur `/mm-arp/play/`, fin du piege de `mm-arp-latest`), puis pour relancer `Plugin public` (v56 au public).
