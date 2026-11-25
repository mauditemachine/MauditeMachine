# CONTEXTE : mauditemachine.com

Fichier maitre de l'etat en ligne et des chantiers recents, lu au demarrage par **Claude Code** (`CLAUDE.md`) et **Antigravity / Gemini** (`AGENTS.md`).
Derniere mise a jour : **25 novembre 2026**.

Regle : quand un chantier modifie ce qui est decrit ici (machines, routes, SEO, dates, press kit), mettre ce fichier a jour dans la meme PR.

---

## 1. Etat general en production (`https://mauditemachine.com`)

- **Branche `main`** : stable, deployee automatiquement sur GitHub Pages via `.github/workflows/pages.yml` (`build` + `deploy` + `indexnow`).
- **Versions firmware des machines (`src/v4/firmware.json`)** :
  - `MM-RYTM` (`mm808`) : **V.7.3** (367 fichiers) - synchronisation SOLO/MUTE, selection directe de piste, allegement CPU mobile pendant la lecture pour eviter les craquements audio.
  - `MM-ARP` (`voy`) : **V.2.6** (26 fichiers) - bouton presets accessible et interface mobile epuree.
  - `MM-BASS` (`bass`) : **V.3.0** (24 fichiers) - accessible sous `?bass=1`.
  - `MM-DECKS` (`src/v4/dj/`) : controle du pitch / tempo actif y compris sur les morceaux personnalises (`FILES`) charges par l'utilisateur.
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

- **GOODIES** (`src/v4/ui/sections/VstDownload.tsx`) : MM-RYTM (VST3 macOS et Windows beta) et MM-ARP (VST3 macOS), champ courriel, case "nouvelles" facultative, envoi du modele EmailJS **VST download** (Mika en copie cachee), lien de don volontaire.
- **`/download/?p=rytm|arp`** (`public/download/index.html`, noindex, hors sitemap) : la page des liens du courriel, un bouton par systeme (celui du visiteur part tout seul), installation, don.
- **Configuration** : `public/data/vst.json` (`emailjsTemplateId`, `donateUrl`). **Etat au 24 nov : `donateUrl` = `https://ko-fi.com/mauditemachine` (Ko-fi : Stripe branche, PayPal non, CA$, minimum 3) ; `emailjsTemplateId` = `template_63bjqgy` (25 nov, modele "VST download" du compte EmailJS Maudite Machine, `service_zeuwh04`) : le bloc PLUGINS est visible dans GOODIES** et `/goodies/` mentionne les plugins pour Google (prerendu).
- **Zips publics** : releases fixes `mm-rytm-public` et `mm-arp-public`, remplies a la main par le workflow `Plugin public` (`.github/workflows/plugin-public.yml`) ; jamais les releases `-latest`, ecrasees par chaque build de chantier.
- **Installeurs (25 nov 2026, Mika : "un systeme d'installation comme tous les bons plugins")** : `Plugin public` fabrique `MM-<PLUGIN>-Installer-Mac.pkg` (pkgbuild + productbuild) et `MM-<PLUGIN>-Installer-Windows.exe` (Inno Setup), habilles sobrement (`plugin/installer/` : logo, textes courts, licence), installes pour de vrai sur les runners (et desinstalle sous Windows) avant publication ; le zip `MM-<PLUGIN>-VST3.zip` les reunit avec le README. `/download/` : un bouton par systeme, celui du visiteur part tout seul. Non signes (Apple Developer et certificat Windows a acheter).
- MM-ARP (plugin) vit encore sur la branche `claude/nifty-bohr-7ixmpf` ; sa release `mm-arp-latest` existe, c'est elle que `Plugin public` reprend.
- **Un zip par plugin** (`MM-RYTM-VST3.zip`, `MM-ARP-VST3.zip`, 24 nov, Mika : "dans le meme package, c'est aux gens de faire ce choix") : depuis le 25 nov, les deux installeurs et le README. **Distribution non signee assumee** (25 nov, Mika : "distribue de cette maniere, pas le choix") : un clic "Ouvrir quand meme" / "Run anyway" la premiere fois, pas de compte Apple Developer pour l'instant. **MM-RYTM Windows (beta)** : job `windows` de `plugin.yml` (MSVC, WebView2), jamais essaye sur un PC avant publication. MM-ARP Windows : a faire quand sa branche sera fusionnee (meme recette : `plugin/mm-rytm/README.md`).
- **Navigation (25 nov 2026, Mika : "Goodies est trop petit dans le menu" ; "laisse MM-RYTM et MM-ARP dans le menu mais cette fois pour les telechargements et les presentations")** :
  - Menu : `TRACKS, MIXTAPES, MM-RYTM, MM-ARP, GOODIES (badge FREE), SHOWS, PRESS, CONTACT` (`src/v4/ui/Header.tsx` `PAGE_LINKS`) ; la pastille GOODIES de "Under the hood" est retiree (reste MERCH).
  - En-tete : bouton jaune **GOODIES FREE** (desktop, avant MENU) et cadeau jaune (telephone), `GoodiesButton`.
  - **`/mm-rytm/` et `/mm-arp/`** (`PluginPage.tsx`, textes dans `src/data/vstPages.json`, images `public/images/vst/`) : presentation, systemes, "Play the full plugin" (RYTM, desktop), "Play it on the site", formulaire courriel ; prerendues avec un `SoftwareApplication` gratuit, dans le sitemap et `llms.txt`.
  - **GOODIES** : Play online (MM-RYTM, MM-ARP, MM-DECKS), cartes des deux plugins, formulaire, fonds d'ecran et pochettes.
  - **`/mm-rytm/play/`** (`WebPlugin.tsx`, noindex) : le plugin MM-RYTM entier dans le navigateur, desktop seulement (au telephone, un message). MM-ARP en version web : apres la fusion de sa branche (sa face v53 y vit, et la DISTO, les LFO 3-4 et la matrice n'existent qu'en C++).
- **Publie (25 nov 2026, installeurs)** : `mm-rytm-public` = version `2026.11.25.8`, build `2fd52a6` de `main` (`.pkg` Mac universel, `.exe` Windows x64 beta, zip des deux) ; `mm-arp-public` = version `2026.11.25.6`, build `9744576` (v53) de `claude/nifty-bohr-7ixmpf` (`.pkg` Mac universel, zip). MM-RYTM se publie depuis le dernier build vert de `main` (artefacts de `plugin.yml`), MM-ARP depuis `mm-arp-latest`.

