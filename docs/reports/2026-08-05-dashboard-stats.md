# Rapport de session — 2026-08-05 — Dashboard stats multi-plateformes

## Ce qui a été fait

- **Diagnostic /mm-admin** : la route n'était pas cassée. Le « 404 » est le
  fonctionnement normal du SPA-fallback GitHub Pages (404.html = copie
  d'index.html, vérifié en prod). La protection demandée (ADMIN_PASSWORD via
  env) existait déjà dans server.js pour l'admin local.
- **Collecteur** `scripts/fetch-stats.mjs` : YouTube Data v3, YouTube
  Analytics (géo, OAuth), Spotify (client credentials), Instagram + Facebook
  (Meta Graph v21), SoundCloud (optionnel). Chaque source échoue
  indépendamment (`status: unavailable/disabled`), snapshot ajouté quand même
  dans `public/data/stats-public.json` (cap 400).
- **OAuth YouTube Analytics** : `scripts/youtube-oauth.mjs`, flow one-shot
  qui délivre le YT_REFRESH_TOKEN.
- **Cron quotidien** `.github/workflows/stats.yml` (06:00 UTC +
  déclenchable à la main) : équivalent du cron Vercel du brief, adapté à
  GitHub Pages. Committe le snapshot, ce qui redéploie le site.
- **Parseurs CSV** `scripts/csv-parsers.mjs` : Ditto (streams + revenus),
  Bandcamp (plays + ventes), TikTok Studio. Colonnes cherchées par nom,
  testés unitairement.
- **Routes server.js (local)** : `POST /api/stats/refresh` (relance le
  collecteur), `POST /api/stats/upload-csv?type=ditto|bandcamp|tiktok`
  (multer dédié, le multer existant refuse les non-images),
  `GET /api/stats/private` (revenus).
- **Dashboard** `/mm-admin/stats` : `src/pages/AdminStatsPage.tsx` +
  `src/components/stats/StatsWidgets.tsx` (cards résumé avec deltas, ligne
  followers, barres streams Ditto, camembert géo YouTube+Instagram+Ditto,
  grille des derniers posts/vidéos). Recharts (seule dépendance ajoutée),
  lazy-loadé (le chunk de 433 Ko ne pèse que sur cette page). Boutons
  refresh + import CSV visibles en localhost uniquement.
- **Séparation public/privé** : streams/followers/géo dans
  `public/data/stats-public.json` (versionné, affiché en prod) ; revenus
  Ditto dans `data/stats-private.json`, `data/` ajouté au .gitignore.
  Vérifié : zéro champ revenu dans le JSON public après import.
- **Rideau prod** : StatsGate (hash SHA-256 côté client via
  VITE_STATS_PASSWORD_HASH, sessionStorage). Localhost : pas de gate.
- **Divers** : `.env.example` réécrit (12 variables documentées + commande
  de génération du hash), `npm run stats`, `CLAUDE.md` projet créé avec la
  règle de rapport de session.

## Décisions prises et pourquoi

- **Pas de Next/Vercel** : le brief supposait Next.js/Vercel, le site est
  Vite statique sur GitHub Pages. Équivalences retenues : route API →
  collecteur Node local/CI ; cron Vercel → GitHub Actions ; stockage →
  JSON versionné (cohérent avec releases.json). Validé par Mika avant code.
- **Revenus jamais publiés** : GitHub Pages sert tout ce qui est dans
  public/. Les revenus Ditto restent en local (data/, gitignoré). Validé.
- **Rideau, pas coffre** : sur un site statique, un mot de passe côté client
  n'est pas de la sécurité. Assumé et documenté ; les données publiées sont
  des stats d'artiste essentiellement publiques.
- **SQLite écarté** : un JSON versionné suffit pour ~1 snapshot/jour et
  reste lisible/diffable dans git.
- **csvParsers en .mjs et pas .ts** : consommés par server.js (Node pur).
- **Widgets regroupés en un module** au lieu de 5 fichiers : même API,
  moins de plomberie.

## Ce qui reste à faire / points en suspens

- **Mika : coller les secrets** dans GitHub > Settings > Secrets (les 11
  clés listées en tête de stats.yml) et dans `.env` local. Sans elles, le
  cron tourne en mode dégradé (badges « indisponible », c'est voulu).
- **Mika : YouTube Analytics** : créer le client OAuth desktop dans Google
  Cloud puis lancer `node scripts/youtube-oauth.mjs` (une fois).
- **Mika : définir le mot de passe du rideau prod** : générer le hash
  (commande dans .env.example), le mettre dans `.env.production`
  (VITE_STATS_PASSWORD_HASH, commitable), rebuild.
- Le FB_PAGE_ID n'était pas dans le brief (ajouté au .env.example) : à
  récupérer dans Business Suite.
- SoundCloud : module volontairement « désactivé » tant que pas de
  SOUNDCLOUD_CLIENT_ID (l'API publique est fermée aux nouvelles clés).
- Éventuel : lien vers /mm-admin/stats depuis l'onglet admin existant.

## Commandes utiles ajoutées

- `npm run stats` : snapshot manuel des sources (mode dégradé toléré).
- `node scripts/youtube-oauth.mjs` : obtention one-shot du refresh token.
- Workflow « Daily music stats » : onglet Actions > Run workflow pour un
  snapshot immédiat côté CI.
- Génération du hash du rideau : commande dans `.env.example`.
