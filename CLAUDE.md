# mauditemachine.com — instructions projet

Site de Mika (Maudite Machine), DJ/producteur. Vite + React 18 + TypeScript +
Tailwind (Preflight desactive), 100 % statique sur GitHub Pages : le build de
prod tourne dans GitHub Actions (pages.yml), le dist/ commite n'est PAS ce qui
est servi. AUCUN serveur en prod : l'edition passe par l'admin local
(npm run admin = vite + server.js) ou par Claude Code (JSON + commit + push).

## Regle : rapport de session obligatoire

A la FIN de chaque session de travail sur ce projet, generer un rapport
markdown dans `docs/reports/YYYY-MM-DD-nom-session.md` (meme format que les
rapports du projet Massive Medias) avec ces sections :

1. **Ce qui a ete fait** — fichiers crees/modifies, avec une ligne par sujet
2. **Decisions prises et pourquoi** — arbitrages, ecarts vs brief, causes
3. **Ce qui reste a faire / points en suspens** — actions cote Mika incluses
4. **Commandes utiles ajoutees** — nouveaux scripts npm, workflows, outils

Le rapport se committe avec le reste du travail de la session.

## Pieges connus du repo (verifies en production)

- `.page > * { position: relative }` ecrase le `fixed` de Tailwind : tout
  element fixe passe par du style inline.
- framer-motion `initial`->`animate` au mount ne fire pas : utiliser
  `animate-fade-up` CSS. framer reste fiable pour whileHover/whileTap.
- Preflight off : les `<a>` gardent le bleu navigateur, forcer color.
- Tout `VITE_*` est public (inline en clair dans dist/assets/*.js) : un
  secret ne doit JAMAIS etre un VITE_*.
- Projet sur iCloud Drive : builds lents, git log parfois tres lent,
  serveurs Node locaux capricieux.
- V1 ARCHIVEE UNIQUEMENT (/v1) : video limitee a sa home, fond noir uni
  (html/body #000, .page::after noir). Le SITE PRINCIPAL (v2) est en
  fond creme #F6F1E7 / texte #191919 / typo Larsseit depuis 2026-08 :
  ne pas le "corriger" en noir, c'est la DA voulue.
- iOS Safari : l'attribut muted doit etre pose en VRAI attribut DOM
  (ref callback), React ne le rend pas.

## Tests audio : JAMAIS de lecture reelle

Ne jamais lancer de lecture audio pendant les tests (player SoundCloud,
previews iTunes, elements <audio>) : le son sort sur les enceintes de
Mika sans prevenir. Verifier l'etat du player par le DOM et les
evenements (classes is-playing, .v2-vu.is-on, progress/timeupdate,
compteurs, etat des boutons), jamais par le son. Si un test de lecture
reelle est indispensable, le demander explicitement a Mika ou le lui
laisser faire.

## Donnees et securite

- Contenu : public/*.json (releases, events, following, stats-public...),
  versionnes, edites par l'admin local ou par mission Claude Code.
- Stats : scripts/fetch-stats.mjs (collecteur), cron quotidien
  .github/workflows/stats.yml, dashboard /mm-admin/stats.
- data/ est LOCAL UNIQUEMENT (gitignore) : revenus Ditto
  (data/stats-private.json) et CSV sources. Ne jamais les publier.
- Secrets : .env local (gitignore) + GitHub Secrets pour les workflows.

## Conventions de reponse

- Repondre en francais, tutoiement, jamais de tiret cadratin.
- Chaque mission se termine par un bloc copiable
  « 📋 RAPPORT POUR CLAUDE DESKTOP ».
- Commit + push apres chaque modification validee (deploy auto ~1 min).
- Quand Mika doit CHOISIR entre des options (A / B / C), chaque option est
  clairement etiquetee sur son image : une image par option, envoyee
  separement avec la legende « A : ... », « B : ... », « C : ... », et la
  lettre ecrite en gros SUR l'image elle-meme. Dans le texte, la meme lettre,
  le meme ordre, une ligne par option. Jamais un lot d'images sans lettre
  (Mika, 2026-11-18 : "je suis toujours en train de deviner lequel est le
  a b ou c").

## Plugin MM-ARP (VST3 macOS, Ableton) : etat et conventions

Branche de travail : claude/nifty-bohr-7ixmpf. Journal detaille :
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
- Etat (v55, 2026-11-25 ; v52 le 2026-11-24) : face cuir, knobs = PNG de Mika (vknob : k1, k3,
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
  aussi). v55 : vivacite des couleurs au niveau B (choix de Mika,
  voyager/vivid.ts VIVID_LEVEL). v54 : double clic sur un potard (face, encart, OPEN) = valeur de
  depart (Alt / Cmd / Ctrl + clic aussi) ; un clic seul ouvre sa page
  300 ms apres (voyager/faceDbl.ts FACE_DBL). v53 : PRESET ouvre le navigateur (PresetBrowser.tsx, banque du
  VST3 par familles, clic = charge) ; pages d'OPEN sans diode (noled.css) ;
  vivacite voyager/vivid.ts (VIVID_LEVEL : B depuis v55). v52 : LED eteintes en verre,
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
