# Prompt pour Antigravity : comment on travaille sur mauditemachine.com

À coller dans les règles de l'espace de travail d'Antigravity, ou au début de chaque conversation. Tout ce qui suit s'adresse à l'agent.

---

## 0. Qui, quoi, où

Tu travailles pour **Mika** (Maudite Machine, DJ et producteur dark disco / indie dance, fondateur de VRSTL Records) sur son site **mauditemachine.com**.

- **Le dépôt** : `github.com/mauditemachine/MauditeMachine`. La branche `main` est ce qui est en ligne.
- **Le dossier local** de Mika est sur iCloud Drive : `~/Library/Mobile Documents/com~apple~CloudDocs/Dev/MauditeMachine2025`. Les builds y sont lents, `git log` aussi, et les serveurs Node locaux peuvent être capricieux. Sois patient, ne conclus pas trop vite à une panne.
- **D'autres agents travaillent sur le même dépôt**, en particulier Claude Code, sur la branche `claude/mauditemachine-dev-ipq3x5`, qui pousse aussi sur `main`. Avant de commencer : `git pull --ff-only origin main`. Juste avant de pousser : `git pull --no-rebase origin main`.
- **La page d'accueil est MM-STUDIO**, un studio en 3D jouable dans le navigateur, avec plusieurs machines :
  - **MM-RYTM** (id `mm808`) : boîte à rythmes façon Digitakt II ;
  - **MM-ARP** (id `voy`) : synthé arpégiateur ;
  - **MM-DECKS** (id `dj`) : platines et mixer ;
  - **MM-BASS** (id `bass`) : derrière `?bass=1`.

À lire avant toute mission : `CLAUDE.md` (racine), `README.md` (racine, l'architecture complète), le rapport le plus récent dans `docs/reports/`, et pour le MM-RYTM, `docs/v4/dt2/dt2-master-spec.md`.

---

## 1. Les règles absolues (aucune exception)

1. **Jamais de son pendant les tests.** Ne lance jamais une lecture réelle : player SoundCloud, previews iTunes, éléments `<audio>`, PLAY d'une machine avec le son actif. Le son sort directement sur les enceintes de Mika, sans prévenir.
   - Toujours `?mute=1` dans l'URL, ou le navigateur lancé muet (`--mute-audio`).
   - Vérifie par le DOM, les classes, `window.__v4`, les compteurs, les rendus hors ligne (`OfflineAudioContext`), jamais à l'oreille.
   - Si une écoute réelle est indispensable, demande à Mika de la faire lui-même.
2. **Aucun tiret cadratin ni demi-cadratin**, nulle part : code, commentaires, textes du site, docs, commits, réponses. Utilise une virgule, deux-points ou un tiret simple (-).
3. **Aucun secret dans un `VITE_*`.** Tout `VITE_*` finit en clair dans `dist/assets/*.js`. Les secrets vivent dans `.env` (local, ignoré par git) et dans les GitHub Secrets pour les workflows.
4. **`data/` est local uniquement**, ignoré par git : revenus Ditto (`data/stats-private.json`), CSV sources. Ne jamais le publier, le copier ailleurs ni le committer.
5. **Ne jamais casser un id MIDI existant.** Les cibles MIDI (`docs/midi/MIDI-targets.csv`) et les adresses du Roto-Control ne se retirent, ne se renomment (l'id) et ne se réordonnent jamais. Une nouvelle cible s'ajoute à la fin de son groupe. Les libellés peuvent changer.
6. **Les sauvegardes d'avant doivent toujours se relire** : localStorage des patterns, presets, UNDO, liens SHARE v1 (`audio/beatcode.ts`, listes figées), mappings MIDI. Pas de conversion qui perd quelque chose. Un retour arrière vers la version d'avant ne doit rien perdre non plus.
7. **Pas de nouvelle dépendance npm** sans raison forte et sans demander à Mika. three se charge par imports nommés uniquement, jamais `import * as THREE`.
8. **Ne touche pas sans l'accord de Mika** : Supabase, le Worker SoundCloud, les DNS, les GitHub Secrets, la config Pages.
9. **Jamais de `git push --force`** sur `main`, jamais de réécriture d'historique partagé, jamais `pkill -f` (ça tue des process qui ne sont pas à toi : arrête un serveur par son pid).
10. **Le mode clair (crème) doit rester lisible** : tout texte à un contraste d'au moins 4,5:1 sur son fond réel.
    - **Piège** : en thème clair, `--ink` vaut `#f1ede5`, la crème du fond. N'utilise jamais `var(--ink)` comme couleur de texte sur fond clair ; prends `#191919` ou `var(--bone)`.
11. **La DA du site principal (v2) est crème `#F6F1E7`, texte `#191919`, typo Larsseit.** Ne la « corrige » pas en noir. Seule la V1 archivée (`/v1`) est noire.

---

## 2. Comment parler à Mika

- **En français, avec le tutoiement.** Termes techniques corrects, mais explications simples : Mika n'est pas développeur et il veut comprendre ce qui change pour lui.
- **Court et direct.** Il l'a dit : « arrête tes romans ». Commence par la réponse ou le résultat. Pas de préambule, pas de récapitulatif de ce qu'il vient de dire.
- **Dis ce qui est en ligne et ce qui ne l'est pas.** « Fait » n'est pas « en ligne ». Le site ne change qu'après un push sur `main` et le déploiement (environ 1 minute).
- **Quand il doit faire quelque chose** (cliquer, tester, écouter, importer un fichier), guide-le pas à pas, une étape à la fois.
- **Sois honnête sur les délais et les limites.** S'il demande « c'est en ligne quand ? », donne une estimation réaliste.
- **Les grosses choses se font par étapes** qu'il peut voir en ligne. Mais demande-lui s'il préfère des petites mises en ligne rapides ou un gros morceau d'un coup : ça dépend des fois.
- **Chaque mission se termine** par le rapport de session (section 9) et un bloc copiable « 📋 RAPPORT POUR CLAUDE DESKTOP ».

---

## 3. Le projet en bref

- **Stack** : Vite 5 + React 18 + TypeScript + React Router 7 ; three.js 0.186 pour la 3D ; Web Audio avec des AudioWorklets maison ; Tailwind 3 avec **Preflight désactivé** ; CSS par version (`src/v4/v4.css`).
- **100 % statique sur GitHub Pages. AUCUN serveur en production.**
  - `.github/workflows/pages.yml` reconstruit et déploie à chaque push sur `main`, plus un rebuild chaque matin.
  - **Le `dist/` commité n'est PAS ce qui est servi** : ne compte jamais sur lui.
- **Contenus** : `public/*.json` (releases, events, following, stats-public...), versionnés. On les édite par l'admin local (`npm run admin` = vite + `server.js` sur le port 3001, puis `/mm-admin`), ou directement en JSON + commit + push.
- **Stats** : `scripts/fetch-stats.mjs`, cron quotidien `.github/workflows/stats.yml`, dashboard `/mm-admin/stats`.
- **Arborescence utile** :
  - `src/v4/` : MM-STUDIO, toutes les machines. Le gros du travail.
    - `audio/` : moteur, séquenceur, horloge, store `tracks` des 16 pistes.
    - `scene/` : 3D, faces, écran (`scene/screen/`).
    - `actions/` : un baril, `actions.ts` réexporte `actions/*.ts`.
    - `state/` : petits stores.
    - `midi/` : cibles dans `midi/targets/`, Roto, LEARN.
    - `hw/` : boîtier MMHW v2.
    - `rytm/` : pages, valeurs, INFOS, faceplate.
    - `ui/` : React : Hotspots, Dock, panneaux.
    - `dj/`, `voyager/`, `bass/` : les autres machines.
  - `src/v2/` : le site principal (pages, player SoundCloud). `src/v3/` et `/v1` : archives.
  - `docs/v4/` : spécifications (`spec.md`, `dt2/dt2-master-spec.md` et ses inventaires).
  - `docs/reports/` : un rapport par session. Lis le dernier.
  - `docs/midi/` : référence MIDI générée (`npm run docs:midi`), à ne pas éditer à la main.
  - `scripts/` : tous les outils et tests.
- **Le debug de MM-STUDIO** : `http://localhost:5173/?mute=1&debug=1&m=mm808` (ou `m=voy`, `m=dj`). `window.__v4` expose l'état : `state`, `stage`, `hotspots`, `tracks`, `audio.renderOffline`, `rytm.*`, `dj.*`... `?portrait=1` simule le téléphone, et `?face=v5` donne l'ancienne face du MM-RYTM.

---

## 4. Le cycle de travail

1. `git pull --ff-only origin main`, puis lis le dernier rapport et la spec qui concerne ta mission.
2. **Comprends avant de coder.** Lis les fichiers concernés, cherche les usages (`grep`), repère les tests existants. Le code est très commenté, en français sans accents, et daté avec la demande de Mika entre guillemets. **Écris comme le code autour** : même densité de commentaires, même style, même nommage.
3. **Fais petit et ciblé.** Ce que la mission demande, rien de plus, sans refonte non demandée. Si tu vois autre chose à corriger, note-le dans le rapport au lieu de l'élargir.
4. **Passe les vérifications** (section 5), toutes, sur un build propre.
5. **Le firmware des machines** (`src/v4/firmware.json`, `scripts/firmware.mjs`) :
   - toute modification d'une machine fait monter sa version : `npm run firmware:bump -- mm808 minor "ce qui change"` (une grosse mise à jour : `major`) ;
   - si la version est déjà montée pour cette mise à jour, `npm run firmware:stamp` ;
   - puis `npm run firmware:check`. Le numéro s'affiche sur la face de la machine.
6. **Commite**, en français sans accents. Le message dit ce qui change et pourquoi, souvent avec la demande de Mika entre guillemets. Exemple : `dj: une croix discrete en haut a droite de la platine ajoutee la ferme (Mika : "des croix pour fermer les decks")`.
7. **Pousse** sur `main` : `git pull --no-rebase origin main && git push origin main`. Le déploiement suit, environ 1 minute.
8. **Vérifie que c'est en ligne.** Le run « Deploy to GitHub Pages » doit être vert, et le nouveau code présent sur le site. Par exemple, cherche un texte nouveau dans `https://mauditemachine.com/assets/*.js`, ou la note de firmware.
9. **Écris le rapport de session** (section 9), committé avec le reste.

**Règle de Mika : commit + push après chaque modification validée.** Ne laisse jamais du travail fini non poussé, et ne pousse jamais du travail non vérifié.

---

## 5. Les vérifications (les portes)

Lance-les sur une copie propre quand c'est possible (`git archive HEAD | tar -x -C /tmp/copie`, avec `node_modules` en lien symbolique). Sinon, dans le dépôt.

| Porte | Commande | Attendu |
|---|---|---|
| Types | `npx tsc --noEmit -p .` | **13 erreurs exactement**, toujours les mêmes, toutes anciennes : Admin, EventsDisplay, MainApp, NewsMessages, AppContext, adminApi, sanityClient, RadarPage x2, `audio/drums.ts`, `audio/fx.ts` x2, `dj/engine.ts`. Jamais une de plus. |
| Build | `SEO_OFFLINE=1 npm run build` (ou `SEO_OFFLINE=1 npx vite build`) | « built in ... », aucune erreur. `npm run build` réécrit `dist/` et `public/sitemap.xml` : ne les committe pas sans raison. |
| Fumée | `npm run smoke:v4`, ou `node scripts/smoke-v4.mjs --url http://127.0.0.1:<port> --machines mm808,voy,dj` sur un `dist` servi | `9 pages, aucune erreur` (DT2, ancienne face V5 et téléphone, pour chaque machine). Il faut Playwright et un Chromium, hors du projet. |
| Boîtier | `npm run hw:test` | tous bons |
| Presets | `npm run presets:test` | tous bons |
| Face 3D | `npm run face:test` | 7 / 7 |
| Exports | `node scripts/exports-check.mjs` | `identique`. Un nouvel export s'ajoute à la main dans `scripts/exports.golden.json`. |
| Identité audio | `node scripts/rytm-ident.mjs --url http://127.0.0.1:<port>` | `identique (ecart <= 0.000001)`. Le son des pistes 1 à 8 ne doit pas bouger sans que Mika l'ait demandé. Ne fais jamais `--update` de la référence sans raison. |
| MIDI | `npm run docs:midi`, puis diff de `docs/midi/*.csv` | des **ajouts seulement**, aucun id retiré ni déplacé |
| Firmware | `npm run firmware:check` | OK pour chaque machine |

Pour servir un build, lance `python3 -m http.server <port> -d dist &`, note son pid, et arrête **ce pid** à la fin.

---

## 6. Tester sans son

- **URL de test** : `/?mute=1&debug=1&m=mm808`. Attends la fin de l'intro (`window.__v4.state.intro === 'done'`). Sous rendu logiciel, presse Shift pour la passer, comme dans `scripts/smoke-v4.mjs`.
- **Navigateur automatisé** (Playwright ou le navigateur d'Antigravity) : toujours muet, `--mute-audio` en plus de `?mute=1`.
- **Ce qu'on vérifie** :
  - l'état : `window.__v4.*`, les classes du DOM (`is-playing`, `.v2-vu.is-on`), `aria-pressed`, les compteurs de coups de l'horloge ;
  - le son, par des **rendus hors ligne** (`window.__v4.audio.renderOffline`) et leurs nombres (RMS, crêtes, nombre de coups), jamais à l'oreille ;
  - les zones de la face 3D : `window.__v4.hotspots` donne le centre écran (`cx`, `cy`) de chaque touche, `window.__v4.pick(x, y)` dit ce qu'il y a sous un point.
- **iOS Safari** : l'attribut `muted` doit être posé en VRAI attribut DOM (ref callback), React ne le rend pas.
- **Une sonde utile échoue avant ta correction et passe après.** Montre les deux.

---

## 7. Pièges connus (vérifiés en production)

- `.page > * { position: relative }` écrase le `fixed` de Tailwind : tout élément fixe passe par du style inline.
- framer-motion `initial` → `animate` au montage ne se déclenche pas : utilise l'animation CSS `animate-fade-up`. framer reste fiable pour `whileHover` et `whileTap`.
- **Preflight est désactivé** : les `<a>` gardent le bleu du navigateur, force la couleur.
- `--ink` en thème clair vaut la crème du fond (voir 1.10).
- **V1 archivée seulement (`/v1`)** : vidéo limitée à sa home, fond noir uni. Le site principal est crème (voir 1.11).
- **Les fichiers baril** : `src/v4/actions.ts` réexporte `actions/*.ts`. Deux modules qui exportent le même nom cassent le baril (tsc le dit). Les aides internes vont dans `actions/internal/`.
- **Les fichiers à `let` de module ou branchés au chargement** (`actions/wire.ts`, `actions/state.ts`) : un mauvais ordre d'import ne se voit qu'à l'exécution. La porte est le smoke, pas le build.
- **Les touches d'une face 3D se rebâtissent** (MM-DECKS quand on ajoute un deck) : une API de touche doit ignorer un index qui n'existe plus au lieu de planter.

---

## 8. Le MM-RYTM façon Digitakt II (le chantier en cours)

- **Demande de Mika** : « refais la Digitakt mais avec mon design : tous les boutons, le placement des choses et toutes les fonctionnalités basées sur la Digitakt, sans le côté sampler ».
- **Ses choix** :
  - Digitakt II ;
  - 16 pistes libres ;
  - sa taille de face 256 x 156 mm et son écran 4,3 pouces ;
  - les scènes A/B quittent la face et vivent dans une page du MIXER ;
  - le kit est dans le pattern (V.6.2) ;
  - la touche SAMPLING devient SOUNDS.
- **Le cahier maître** est `docs/v4/dt2/dt2-master-spec.md`. Ses inventaires sont dans `docs/v4/dt2/inv/` : le manuel DT2, la géométrie de la face et le code actuel. **Ce cahier fait foi** : chaque fonction y a sa version (6.0, 6.1 ou 6.2).
- **En ligne : V.6.0.**
  - La face DT2 est la face par défaut au desktop. L'ancienne s'obtient avec `?face=v5`, et elle doit continuer de marcher.
  - Il y a 16 pistes : le store `tracks` (`audio/tracks.ts`). BD, SD, CH, OH, CP, TOM, HT et CY sont les pistes 1 à 8, T9 à T16 les suivantes.
  - Les menus de l'écran passent par un registre, `scene/screen/menus/registry.ts`, avec leur `onInput`.
  - Les gestes passent par `state/gesture.ts` et la table `actions/chords/chords60.ts`.
- **Le téléphone** (`?portrait=1`) garde sa face à lui, gelée au pixel près. Il change seulement par la bascule 1-8 / 9-16, qui n'apparaît que si une piste 9 à 16 sert.
- **À faire** :
  - **V.6.1**, les pages et le séquenceur DT2 : 128 pas sur 8 pages, longueur et vitesse par piste, PAGE SETUP, STEP REC, LIVE REC complet, euclidien, KEYBOARD et ses gammes, 3 LFO, filtres à machines, ADSR, SEND FX et MIXER DT2, SETUP ;
  - **V.6.2**, la structure DT2 : kit dans le pattern, projets (IndexedDB, export de fichier), presets de piste et preset locks, PERFORM KIT, SONG, SETTINGS complet, MIDI CONFIG.
- **Les manques connus de V.6.0** :
  - KEYBOARD et SONG affichent BIENTOT ;
  - la liste SOUNDS des pistes 1 à 8 ne suit pas MACHINE ;
  - PATTERN MUTE reste sur 1 à 8 ;
  - le P-LOCK de T9 à T16 hors de la page SRC n'est pas fait.
- **La méthode qui a marché** :
  - lire la section du cahier ;
  - écrire un petit cahier de l'étape (comme `docs/v4/digitakt-d3a-spec.md`) ;
  - construire derrière un drapeau quand la mise en ligne doit attendre ;
  - faire relire le code par un regard neuf, qui cherche à le casser ;
  - corriger chaque point avec une sonde qui le prouve ;
  - repasser toutes les portes ;
  - mettre en ligne.
- **Les textes de la machine** :
  - les libellés de la face et de l'écran sont en anglais, comme une Elektron ;
  - les cartes INFOS (le mode d'emploi, `rytm/infos/`) sont en français, au tutoiement, sans tiret cadratin.
- **Le boîtier MMHW v2 de Mika** continue de marcher tel quel. Les notes proposées pour les touches nouvelles sont à confirmer avec son `protocol.js`.
- **Le Roto-Control** : il y a des setups par machine dans `docs/midi/roto/`. Pour les pistes 9 à 16, Mika doit importer le setup TRACKS (SETUP 19).

---

## 9. Fin de mission : le rapport obligatoire

À la fin de chaque session de travail, écris `docs/reports/AAAA-MM-JJ-nom-court.md`, avec ces quatre sections :

1. **Ce qui a été fait** : les fichiers créés ou modifiés, une ligne par sujet.
2. **Décisions prises et pourquoi** : les arbitrages, les écarts au cahier ou à la demande, les causes des bugs.
3. **Ce qui reste à faire / points en suspens** : y compris ce que Mika doit faire lui-même (écouter, tester, importer, confirmer).
4. **Commandes utiles ajoutées** : nouveaux scripts npm, sondes, workflows, outils.

Le rapport se commite avec le travail. Puis termine ta réponse à Mika par un bloc copiable :

```
📋 RAPPORT POUR CLAUDE DESKTOP
<machine et version> en ligne (main <sha>) / ou pas encore en ligne, et pourquoi.
- Ce qui change pour Mika, en 3 à 6 lignes.
Portes : tsc 13, build, smoke 9/9, hw, presets, face, exports, ident, docs:midi, firmware.
Reste : ...
A faire par Mika : ...
```

---

## 10. En cas de doute

- **Une demande peu claire** : pose UNE question courte avec ta recommandation, plutôt que de deviner une grosse chose.
- **Un choix qui change ce que Mika voit ou entend** (le son, la place d'un bouton, la suppression d'une fonction) : demande-lui avant.
- **Un test qui échoue** : dis-le avec la sortie, ne le cache pas et ne le contourne pas. Ne désactive jamais un test pour passer.
- **Tu ne peux pas vérifier quelque chose** (le son, un appareil MIDI réel, l'iPhone) : dis exactement ce qui n'a pas été vérifié, et demande à Mika de le faire.
