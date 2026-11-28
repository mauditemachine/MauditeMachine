# CONTEXTE : mauditemachine.com

Fichier maitre de l'etat en ligne et des chantiers recents, lu au demarrage par **Claude Code** (`CLAUDE.md`) et **Antigravity / Gemini** (`AGENTS.md`).
Derniere mise a jour : **25 novembre 2026**.

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

- **Page `/shows/` a part (27 nov 2026, Mika : "je trouve ca pas cool d'ouvrir cette page directement dans la page des machines", maquette A choisie)** : `src/pages/shows/ShowsPage.tsx` + `shows.css`, route React hors de la machine (chunk lazy, sans three). Toutes les dates a venir en affiches alignees (Mika : "affiche les tous en cover alignes"), la plus proche d'abord, un visuel au nom du show si pas d'affiche, puis les shows passes par annee (`events.json` passes + `public/past-events.json`). Le menu, le pad 3 et la puce SHOWS y menent (`src/v4/state/section.ts` redirige `shows` vers `/shows/`) ; `shows` n'est plus dans `SECTION_ROUTES`. Prerendu : `#seo-static` garde, sans coquille ni preload de la machine.

- **19 decembre 2026** : **PRISM** - Quebec, QC (`venue: "PRISM"`, `city: "Québec"`, `country: "CA"`), visible dans l'encart `SHOWS`, sur `/shows/`, dans `llms.txt` et en `MusicEvent` Schema.org.
- **27 fevrier 2027** : **LUMINARIUM 03** (3e edition) - Bain Mathieu, 2915 Ontario Est, Montreal (21 h - 8 h, Techno Room, LIVE SET VRSTL Records). Affiche `public/events/luminarium2027.webp`, prevente 55 $ CAD (phases 55/60/65), 18+, capacite 600. Billetterie (Spirale Productions / Oui-R1) : https://lepointdevente.com/billets/ln0270227001 (`url` et `ticketUrl`).
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
- **Configuration** : `public/data/vst.json` (`emailjsTemplateId`, `donateUrl`). **Etat au 24 nov : `donateUrl` = `https://ko-fi.com/mauditemachine` (Ko-fi : Stripe branche, PayPal non, CA$, minimum 3) ; `emailjsTemplateId` = `template_63bjqgy` (25 nov, modele "VST download" du compte EmailJS Maudite Machine, `service_zeuwh04`)** : le formulaire est actif sur `/mm-rytm/` et `/mm-arp/` (prerendues, lisibles par Google).
- **Zips publics** : releases fixes `mm-rytm-public` et `mm-arp-public`, remplies a la main par le workflow `Plugin public` (`.github/workflows/plugin-public.yml`) ; jamais les releases `-latest`, ecrasees par chaque build de chantier.
- **Installeurs (25 nov 2026, Mika : "un systeme d'installation comme tous les bons plugins")** : `Plugin public` fabrique `MM-<PLUGIN>-Installer-Mac.pkg` (pkgbuild + productbuild) et `MM-<PLUGIN>-Installer-Windows.exe` (Inno Setup), habilles sobrement (`plugin/installer/` : logo, textes courts, licence), installes pour de vrai sur les runners (et desinstalle sous Windows) avant publication ; le zip `MM-<PLUGIN>-VST3.zip` les reunit avec le README. `/download/` : un bouton par systeme, celui du visiteur part tout seul. Non signes (Apple Developer et certificat Windows a acheter).
- MM-ARP (plugin) : fusionne dans `main` le 25 nov 2026 (section 6) ; sa release `mm-arp-latest` (workflow `plugin-arp.yml`) est celle que `Plugin public` reprend.
- **Un zip par plugin** (`MM-RYTM-VST3.zip`, `MM-ARP-VST3.zip`, 24 nov, Mika : "dans le meme package, c'est aux gens de faire ce choix") : depuis le 25 nov, les deux installeurs et le README. **Distribution non signee assumee** (25 nov, Mika : "distribue de cette maniere, pas le choix") : un clic "Ouvrir quand meme" / "Run anyway" la premiere fois, pas de compte Apple Developer pour l'instant. **MM-RYTM Windows (beta)** : job `windows` de `plugin.yml` (MSVC, WebView2), jamais essaye sur un PC avant publication. MM-ARP Windows : a faire (branche fusionnee le 25 nov ; meme recette que le RYTM : `plugin/mm-rytm/README.md`).
- **Navigation (25 nov 2026, Mika : "Goodies est trop petit dans le menu" ; "laisse MM-RYTM et MM-ARP dans le menu mais cette fois pour les telechargements et les presentations")** :
  - Menu : `TRACKS, MIXTAPES, MM-RYTM, MM-ARP, GOODIES (badge FREE), SHOWS, PRESS, CONTACT` (`src/v4/ui/Header.tsx` `PAGE_LINKS`) ; la pastille GOODIES de "Under the hood" est retiree (reste MERCH).
  - En-tete : bouton jaune **GOODIES FREE** (desktop, avant MENU) et cadeau jaune (telephone), `GoodiesButton`.
  - **`/mm-rytm/` et `/mm-arp/`** (`PluginPage.tsx`, textes dans `src/data/vstPages.json`, images `public/images/vst/`) : presentation, systemes, "Play the full plugin" (les deux, desktop), "Play it on the site", formulaire courriel ; prerendues avec un `SoftwareApplication` gratuit, dans le sitemap et `llms.txt`.
  - **GOODIES** : Play online (MM-RYTM, MM-ARP, MM-DECKS), fonds d'ecran et pochettes. **Les plugins n'y sont plus** (25 nov, Mika : "les goodies ce sont les goodies.. les plugins ne sont pas des goodies !") : seulement sur `/mm-rytm/` et `/mm-arp/`.
  - **`/download/`** : l'encart "Before it downloads" (Buy me a coffee / Just download) en haut, le telechargement part seul apres 8 s (25 nov, Mika : "je pensais qu'il y avait ce genre de chose avant de download").
  - **`/mm-rytm/play/`** (25 nov, `WebRytmPlugin.tsx`, noindex, desktop ; au telephone, un message) : la face du VST3 et son processeur C++ compile en WebAssembly (`plugin/mm-rytm/web-engine/`, worklet `src/v4/plugin/rytm/web/rytmEngine.worklet.js`, sons calcules dans un Worker `rytmRender.worker.js`, faux backend JUCE `webBackend.ts`, Mika : "fais pareil pour le RYTM apres"). Verifie : le moteur natif est identique au bit pres au vrai `MMRytmProcessor` JUCE (49 programmes, 18 M d'echantillons, 0 ecart) ; le wasm differe au dernier bit (libm de WASI, ecart RMS -93 dB ou moins), inaudible. Etat du plugin isole du site (cles `mm.web.rytm.ls:*`). Samples de la banque telecharges a la demande depuis `public/samples/rytm`. Le wasm est construit par `pages.yml` ; sans lui, la page le dit.
  - **`/mm-arp/play/`** (25 nov, `WebArpPlugin.tsx`, noindex, desktop) : la face v53 du VST3 et son processeur C++ compile en WebAssembly (`plugin/mm-arp/web-engine/`, worklet `src/v4/plugin/arp/web/arpEngine.worklet.js`, faux backend JUCE `webBackend.ts`). Verifie : le moteur natif est identique au bit pres au vrai processeur JUCE (80 presets, automation, MIDI) ; le wasm sort les memes echantillons sauf des ecarts infimes sur des valeurs quasi nulles (sous-normaux, au plus 7e-15), inaudibles. Etat du plugin isole du site (cles `mm.web.arp.ls:*`). Presets disque dans le navigateur, SAVE .MID en telechargement, MIDI LEARN par Web MIDI. Le wasm est construit par `pages.yml` (clang 18 + paquets wasi d'Ubuntu) ; sans lui, la page le dit.
- **Publie (25 nov 2026, installeurs)** : `mm-rytm-public` = version `2026.11.25.8`, build `2fd52a6` de `main` (`.pkg` Mac universel, `.exe` Windows x64 beta, zip des deux) ; `mm-arp-public` = version `2026.11.25.6`, build `9744576` (v53) de `claude/nifty-bohr-7ixmpf` (`.pkg` Mac universel, zip). MM-RYTM se publie depuis le dernier build vert de `main` (artefacts de `plugin.yml`), MM-ARP depuis `mm-arp-latest`.

---

## 6. Plugin MM-ARP (VST3 macOS, Ableton) : etat et conventions (repris du CLAUDE.md de sa branche, fusionnee le 25 nov 2026)

Branche de travail : claude/nifty-bohr-7ixmpf, fusionnee dans `main` le 25 nov 2026 (Mika : "fusionne la branche de MM-ARP") ; la suite se fait depuis `main`. Journal detaille :
docs/reports/2026-11-09-plugin-mm-arp.md (une section par publication).

- Code : face WebView dans src/v4/plugin/arp (tout gate PLUGIN_ARP, le site
  et MM-RYTM ne doivent jamais changer) ; C++ dans plugin/mm-arp (src/ JUCE,
  dsp/ moteur et effets, tests/). Build face : npm run plugin:arp:web.
- Publication : commit sans [skip ci] + push, lancer le workflow
  plugin-arp.yml (workflow_dispatch) ; release fixe mm-arp-latest, BUILD.txt
  DANS le zip. Si le job mac est "cancelled" (pas de runner) : rerun.
  Installation Mika :
  curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
- Invariants : tsc --noEmit reste a 105 erreurs ; moteur CLASSIC au bit pres
  du site (voyager_compare 85/85) ; nouveaux parametres hote TOUJOURS en fin
  de liste, les anciens gardes en "OLD ..." avec conversion au chargement ;
  banque d'usine (presets/build.mjs + src/v4/plugin/arp/analog.ts) : v53,
  effets LEGERS bornes (ANALOG_FX, jamais de reverbe sur une basse), passe-bas
  modere, pas trop aigu ; RANDOM suit les memes regles.
  Valider le YAML du workflow avant push.
- Mika veut des IMAGES avant tout changement de design (maquette, il valide,
  puis code + publication). Choix A/B/C : voir la regle plus haut.
- Etat (v53, 2026-11-25 ; v52 le 2026-11-24) : face cuir, knobs = PNG de Mika (vknob : k1, k3,
  sel, tiny ; ne JAMAIS les redessiner), touches pilules a LED partout,
  accent reglable (SETTINGS), pads = 7 degres de la tonalite choisie +
  tonique a 4 sons (v52 : CHORDS F# MINOR par defaut, KeySelect.tsx), liste
  des presets souris / Entree. Pages OPEN : barre C (touches mates, LED
  dans la touche), SOUND A (EQ en haut, Maj = Q, Alt = fin), DISTO A
  (un seul EQ, CLEAN LOW, PUNISH v2 en levier, xDPunish2), DELAY A (echos
  facon Echo, cale sur le ppq de l'hote), HELL v2 (vortex, six cercles,
  xHellV2..xHellDescent), REVERB A (cascade 3D, EQ / WIDTH / DUCK /
  FREEZE sur le mouille), SEQ refaite (tete commune, crayon, END ; sans
  matrice depuis v50 ; v51 : touches hautes, plus de bande vide). Encart EDIT (v50, option C) : SYNTH | LFO | SQ |
  FX MOD ; LFO 1 a 4 (LFO 3 = LFO de la DISTO) + MOD MATRIX 8 lignes au
  viseur (xMx1..8, cibles 32 + k = reglage hote k, table generee
  modTable.ts / ModTable.inc par extra-gen.mjs) ; anciennes routes jamais
  converties, montrees en "lignes liees" ; section MOD retiree de la face
  du plugin (le site la garde). 297 parametres hote (dernier : xScale ;
  xLatency : LATENCY EXACT / ZERO, ZERO pour les instances neuves, jamais
  change par un preset ; xKey / xScale : la tonalite, reglages
  d'instance, jamais changes par un preset ni RANDOM). Banque d'usine v53
  dark disco / italo hypnotique, 80 presets (BASS 42 / SEQ 20 / LEAD 10 /
  PAD 8, basses en MONO), effets legers ; emplacements xMx a OFF (RANDOM
  aussi). v53 : PRESET ouvre le navigateur (PresetBrowser.tsx, banque du
  VST3 par familles, clic = charge) ; pages d'OPEN sans diode (noled.css) ;
  vivacite voyager/vivid.ts (VIVID_LEVEL, 'off' tant que Mika n'a pas
  choisi A / B / C). v52 : LED eteintes en verre,
  allumees a l'accent ; grands noms et chiffres des ecrans en points
  (Doto 'MM Dots', plugin/mm-arp/web/fonts, dots.css, screen.ts) ;
  colonne FILTER EG / AMP EG : ecran des enveloppes + POLARITY, KEY
  TRACK, ACCENT, VOICE (EgColumn.tsx). Moteurs CLASSIC / PRO, QUALITY ECO/STD/HQ, 8 voix.
  v49 : face au repos (mm_tick unique, rien face cachee), demi-bandes RII
  a phase minimale (dsp/Halfband.h). src/v4/voyager/params.ts est lu par
  Node (presets/build.mjs, fx-ref.mjs) : n'y importer ni theme/base ni un
  module du site ; window seulement derriere typeof window.
- Regle : une refonte n'est "faite" que si elle est la page PAR DEFAUT du
  build publie ; une maquette derriere un drapeau d'URL ne compte pas
  (Mika, 2026-11-20 : "t'as rien branle", il ne voyait rien changer).
