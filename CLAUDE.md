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
