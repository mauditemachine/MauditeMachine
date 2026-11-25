# AGENTS.md - mauditemachine.com (Claude Code + Antigravity / Gemini)

Ce fichier est la source unique des regles de travail sur `mauditemachine.com`, le site officiel et studio 3D interactif (`MM-STUDIO`) de Michael "Mika" Sanchez (**Maudite Machine**).
Il est lu automatiquement par **Antigravity (Gemini)** et importe par **`CLAUDE.md`** pour **Claude Code**, afin que les deux agents puissent travailler **en meme temps** sur ce depot sans jamais se marcher dessus.

Lire aussi `contexte.md` a la racine au debut de chaque session pour connaitre l'etat exact de ce qui est en ligne, et le tenir a jour dans la meme PR des qu'un chantier change l'architecture, une machine, le SEO ou les dates.

---

## 1. Protocole de travail simultane (Claude + Antigravity en parallele)

Le depot vit sur **iCloud Drive** (`~/Library/Mobile Documents/com~apple~CloudDocs/Dev/MauditeMachine2025`). Deux agents qui editent ou changent de branche en meme temps dans le meme repertoire de travail s'ecrasent mutuellement. Appliquer ces regles **sans exception** :

1. **Inspection avant toute ecriture** :
   Toujours commencer par :
   ```bash
   git fetch origin --prune
   git status -s -- ':!dist'
   git worktree list
   ```
2. **Isolation par `git worktree` des que les deux agents travaillent en parallele** (ou si le repertoire principal contient deja des modifications non commitees d'un autre agent) :
   - **Interdiction absolue** de lancer `git checkout`, `git switch`, `git reset`, `git stash` ou `git clean` dans le dossier racine si des fichiers y sont deja modifies par l'autre agent.
   - Creer un **worktree dedie** (idealement dans `/tmp/mm-worktrees/<agent>-<sujet>` pour sortir d'iCloud Drive et eviter `fileproviderd`, sinon dans `.claude/worktrees/` ou `.worktrees/`) depuis `origin/main` :
     ```bash
     mkdir -p /tmp/mm-worktrees
     git worktree add -b agy/mon-sujet /tmp/mm-worktrees/agy-mon-sujet origin/main
     ln -s "/Users/mauditemachine/Library/Mobile Documents/com~apple~CloudDocs/Dev/MauditeMachine2025/node_modules.nosync" /tmp/mm-worktrees/agy-mon-sujet/node_modules
     ```
     *(Convention de nommage des branches : `claude/<sujet>` pour Claude, `agy/<sujet>` ou `feat/<sujet>` / `fix/<sujet>` pour Antigravity.)*
   - Une fois la PR fusionnee sur `main`, supprimer le worktree (`git worktree remove /tmp/mm-worktrees/...`) et, seulement si la racine est propre sur `main`, faire `git pull --ff-only`.
3. **Ne JAMAIS commiter `dist/`** :
   Le vrai build de production tourne dans GitHub Actions (`.github/workflows/pages.yml`). Commiter `dist/` cree des centaines de conflits binaires/hashes entre agents. Toujours indexer uniquement les sources modifiees (`git add <fichiers>` ou `git add -u -- ':!dist'`).
4. **Gestion des fichiers partages sensibles aux conflits** :
   - **`src/v4/firmware.json`** : empreinte SHA de tous les fichiers de `src/v4/` (`MM-RYTM`, `MM-ARP`, `MM-BASS`). Le workflow GitHub Pages execute `npm run firmware:check` et **bloque le deploiement** si un fichier de `src/v4/` a change sans mise a jour de l'empreinte. Si l'autre agent a fusionne sur `src/v4/` entre-temps : faire `git pull --rebase origin main`, relancer `npm run firmware:stamp` (ou `npm run firmware:bump -- <machine> minor "raison"` pour une nouvelle version visible), puis pousser.
   - **`public/data/stats-public.json`** : mis a jour chaque matin par le cron GitHub Actions (`stats.yml`). Toujours rebaser sur `origin/main` avant de fusionner.
   - **Doublons iCloud (`nom 2.js`, `dossier 4`, `node_modules 4`...)** : crees par `fileproviderd` lors d'acces concurrents. Ils sont ignores par `.gitignore` : ne jamais les modifier ni forcer leur ajout.
5. **Un chantier = une branche = une PR atomique** :
   Pas de melange de sujets ni de refactoring opportuniste dans les fichiers sur lesquels l'autre agent peut travailler. Fusionner des que le build et les verifications passent, puis verifier le deploiement reel sur `https://mauditemachine.com`.

---

## 2. Regles absolues de Mika (aucune exception)

1. **JAMAIS de son** : ne jamais declencher de lecture audio reelle (Web Audio API, `<audio>`, SoundCloud, Spotify, apercus). Le son sort directement sur les enceintes de studio de Mika pendant qu'il travaille. Toujours passer `--mute-audio` a Chromium / Puppeteer, et verifier les lecteurs par le DOM ou l'etat JS uniquement.
2. **JAMAIS d'onglets ouverts de force dans le Google Chrome de Mika** : ne pas lancer `open`, `vite --open` ni controller sa fenetre Chrome active sans demande explicite. Pour les PDF (`docs/presskit-2027/build.mjs`) et les captures Puppeteer, toujours utiliser un binaire Chromium headless isole (`Google Chrome for Testing` de Puppeteer avec `--headless=new --mute-audio`). Pour les web apps interactives dans Antigravity, utiliser le navigateur integre.
3. **JAMAIS de tiret cadratin ni demi-cadratin** (`U+2014` et `U+2013`), nulle part : reponses, code, commentaires, commits, JSON, HTML, PDF. Utiliser `-`, `,` ou `:`. Toujours verifier avant commit :
   ```bash
   perl -CSD -ne 'print "$ARGV:$.: $_" if /\x{2014}|\x{2013}/; close ARGV if eof' <fichiers>
   ```
4. **Positionnement 100 % international (zero ville de residence)** :
   Mika ne veut plus aucune attache geographique fixe (« Montpellier », « Sud de la France », « Montreal » comme base) dans les titres SEO, descriptions, bios (`src/data/pressBio.json`, `scripts/seo-shared.mjs`), JSON-LD `MusicGroup` (`areaServed: "Worldwide"`), `llms.txt`, Press Kit 2027 (`Territory: International`) et Tech Rider (`Departure: International (Worldwide)`). Seuls les concerts et festivals reels (`public/events.json`, `public/past-events.json`, liste historique des salles) citent la ville ou ils ont lieu.
5. **Page `/plugins` strictement cachee** :
   `mauditemachine.com/plugins` (`src/pages/PluginsPage.tsx`, `src/data/pluginsData.ts`) est l'inventaire personnel des 52 plugins studio de Mika. Elle doit repondre HTTP 200 (prerendue dans `scripts/prerender-seo.mjs`), mais rester en **`React.lazy()`**, **`noindex, nofollow`**, **`Disallow: /plugins`** dans `public/robots.txt`, et **hors `sitemap.xml`**.
6. **Zero secret dans `VITE_*` ou dans git** : tout `VITE_*` est injecte en clair dans le bundle public. Les donnees privees (`data/`, `.env`) restent locales.

---

## 3. Architecture actuelle du site

- **Accueil et site principal (`src/v4/`, MM-STUDIO)** : studio 3D temps reel (Three.js + WebGL 2 + Web Audio API + Web MIDI + support Melbourne Instruments Roto-Control) :
  - `MM-RYTM` (`?m=rytm`) : boite a rythmes 8 voix + pistes supplementaires, 16 pas, P-locks, couches SYNTH + SAMPLE, effets par voix et globaux, partage de beat par URL (`?m=rytm&b=...`).
  - `MM-ARP` (`?m=arp`) : synthe 2 oscillateurs + sub + filtre ladder, arpegiateur, 8 pads d'accords en fa# mineur, sidechain sur le kick du RYTM.
  - `MM-DECKS` (`?m=decks`) : 2 a 4 platines DJ (tracks Maudite Machine, SoundCloud, fichiers perso avec pitch reglable, playlists), table de mixage recevant aussi RYTM et ARP, sampler WAV par platine.
  - `MM-BASS` (`?bass=1`) : synthe bassline cache (hors pages SEO publiques).
- **Routes de sections v4** (`src/v4/state/sectionRoute.ts`) : `/tracks/`, `/tracks/:track/`, `/mixtapes/`, `/shows/`, `/contact/`, `/presskit/`, `/goodies/`, `/merch/`, `/studio/`, `/mm-rytm/` et `/mm-arp/` (pages des plugins VST3, `src/v4/ui/sections/PluginPage.tsx`).
- **`/mm-rytm/play/`** (`src/v4/plugin/WebPlugin.tsx`, noindex) : le plugin MM-RYTM entier dans le navigateur (la face du VST3, mode `PLUGIN`, sans le pont C++ : le son du site), desktop seulement.
- **`/mm-arp/play/`** (`src/v4/plugin/WebArpPlugin.tsx`, noindex) : le plugin MM-ARP entier dans le navigateur, desktop seulement. Le son est le processeur du VST3 lui-meme (`plugin/mm-arp/web-engine/ArpEngine.cpp`, port sans JUCE de `PluginProcessor.cpp`) compile en WebAssembly (`npm run plugin:arp:wasm`, fait par `pages.yml`, fichier hors de git) dans une AudioWorklet ; la face parle a un faux backend JUCE (`src/v4/plugin/arp/web/webBackend.ts`). **Toute modification de `plugin/mm-arp/src/PluginProcessor.cpp` doit etre repercutee dans `ArpEngine.cpp`** (correspondance des lignes en tete du fichier ; banc `plugin/mm-arp/web-engine/compare/`).
- **Pages autonomes** : `/techrider/` (`src/v2/pages/TechRiderPage.tsx`), `/radar/` (`src/v2/pages/RadarPage.tsx`), `/press/` (`public/press/index.html` + declinaisons `/fr/press/` et `/es/press/` via `scripts/press-pages.mjs`), `/plugins/` (cachee).
- **SEO et prerendu (`npm run build` -> `postbuild`)** :
  1. `scripts/prerender-seo.mjs` : genere 99+ pages HTML statiques dans `dist/` (`/`, `/fr/`, `/es/`, sections, 37 morceaux, 45 pages `MM-STUDIO` et rythmes avec fichiers MIDI et grilles SVG/JPEG, redirections), injecte la coquille `#mm-boot`, `#seo-static` et les 260 blocs JSON-LD (`MusicGroup`, `MusicEvent`, `MusicAlbum`, `MusicRecording`, `WebApplication`, `FAQPage`, `BreadcrumbList`).
  2. `scripts/press-pages.mjs` : synchronise la section Bio depuis `src/data/pressBio.json` et genere `/fr/press/` et `/es/press/`.
  3. `scripts/generate-sitemap.mjs` : genere `sitemap.xml` (avec `lastmod` par empreinte SHA-256 face a `seo-lastmod.json`), `public/llms.txt` et `indexnow-urls.txt`.
- **Archives hors sitemap (`noindex` via `404.html` ou robots)** : `/v1`, `/v2`, `/v3`, `/mm-admin`, `/ms-admin`.

---

## 4. Commandes et deploiement

```bash
npm run firmware:stamp   # apres toute modification dans src/v4/ (sinon la CI casse)
npm run firmware:check   # verifie les empreintes de MM-RYTM, MM-ARP et MM-BASS
npm run press:pages      # apres modification de src/data/pressBio.json (met a jour public/press/index.html)
npm run build            # vite build + prerender-seo + press-pages + generate-sitemap
npm run hw:test          # tests materiel Roto-Control / LEDs
npm run presets:test     # tests des presets d'usine (noms et BPM)
npm run face:test        # tests de la face avant
```

**Regenerer le Press Kit 2027 (6 pages PDF + WebP `/presskit/`) et le Tech Rider (2 pages PDF)** apres modification de `docs/presskit-2027/content.mjs` (toujours avec un Chromium isole et muet) :
```bash
CHROME="/Users/mauditemachine/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
CHROME_FLAGS="--mute-audio --no-sandbox" \
node docs/presskit-2027/build.mjs
python3 scripts/press-zip-bio.py
```

**GitHub CLI (`gh`) sur le Mac** :
Le compte par defaut `mauditemachine` est en lecture seule pour les PR. Pour creer et fusionner une PR :
```bash
gh auth switch --user massivemedias
gh pr create --base main --head <branche> --title "type(zone): description" --body "..."
gh pr merge --squash --delete-branch
gh auth switch --user mauditemachine
```
*(Ne pas laisser `gh run watch` tourner en tache de fond : le job `indexnow` fait un `sleep 60` apres que le site est deja en ligne. Verifier plutot `gh run view <id>` puis `curl -s https://mauditemachine.com/...`.)*

---

## 5. Communication et rapports

- Tout en francais, tutoiement, reponses **courtes et directes**, conclusion d'abord, pas de formules de politesse.
- Une seule question oui/non a la fois (ou « aucune »).
- Quand Mika doit choisir entre des options (A / B / C) : une image par option, la lettre ecrite en gros sur l'image, la meme lettre et le meme ordre dans le texte (Mika, 2026-11-18 : "je suis toujours en train de deviner lequel est le a b ou c").
- Mika veut des images avant tout changement de design : maquette, il valide, puis code et publication. Une refonte n'est faite que si elle est la page par defaut du build publie, jamais derriere un drapeau d'URL.
- Terminer chaque livraison a Mika par :
  ```
  === POUR MIKA ===
  FAIT : ce qui est en ligne et verifie
  À SAVOIR : la chose importante a retenir
  QUESTION : une seule question oui/non (ou « aucune »)
  ```
- Pour les chantiers structurants, ajouter un rapport dans `docs/reports/YYYY-MM-DD-sujet.md` et mettre a jour `contexte.md` dans la meme PR.
