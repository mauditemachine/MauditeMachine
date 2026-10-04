# 2026-10-03 : référencement poussé de mauditemachine.com

## 1. Ce qui a été fait

- Audit Lighthouse (mobile, site en ligne) : SEO 100, accessibilité 100, bonnes pratiques 79, performance 28 (FCP 6,7 s, LCP 10,1 s, 2 s perdues sur des CSS externes bloquantes).
- `scripts/prerender-seo.mjs` : une page par morceau (`/tracks/<id>/`, 37 pages) avec titre, description, Open Graph, contenu lisible, MusicRecording et fil d'Ariane ; `/tracks/` liste toutes les pages (ItemList) ; fil d'Ariane sur chaque section ; pages `/fr/` et `/es/` (vraies pages légères, traduites du press kit) ; hreflang sur l'accueil.
- `scripts/generate-sitemap.mjs` : 51 URL, pages de morceaux, FR et ES avec leurs alternatives de langue.
- `index.html` : entité artiste avec identifiant (`#artist`), logo, album Limbos ; WebSite relié à l'artiste ; Font Awesome et polices externes non bloquantes ; LightWidget différé.
- `src/styles.css` : les @import de polices externes retirés (chargés sans bloquer par index.html).
- `src/App.tsx`, `src/v4/state/sectionRoute.ts`, `src/v4/index.tsx` : `/tracks/<morceau>/` ouvre TRACKS, garde son adresse et son titre ; une adresse de section garde le titre de sa page statique.
- `public/robots.txt` (robots de recherche des assistants IA autorisés), `public/llms.txt` (résumé de l'artiste pour les assistants).
- `docs/v4/spec.md` : R14-42.

## 2. Décisions prises et pourquoi

- Pages FR et ES séparées, sans la machine : l'interface 3D est en anglais ; une page en français avec une machine en anglais aurait été incohérente pour Google. Ce sont de vraies pages, visibles, rapides (Lighthouse 100 partout).
- Aucun fait inventé : VRSTL Records n'est cité que pour les sorties du catalogue du press kit et l'album Limbos ; « edit officieux » seulement pour les 4 edits du press kit (le remix Electrochimie reste « remix »).
- Le titre des pages de section et de morceau n'est plus remplacé au montage : Google lit le titre après JavaScript.
- IndexNow (ping automatique de Bing à chaque déploiement) pas branché : c'est une intégration permanente vers un service externe, à valider par Mika.

## 3. Ce qui reste à faire / points en suspens

- Mika : Search Console (propriété, sitemap, demande d'indexation de /, /fr/, /es/, /tracks/) et Bing Webmaster Tools (import depuis Search Console). Prompt Claude Chrome fourni.
- Mika : profils externes qui pointent vers le site (Spotify, Bandcamp, SoundCloud, Instagram, Beatport, Resident Advisor, Songkick) et fiches Wikidata / MusicBrainz / Discogs pour le panneau de connaissances Google.
- À décider : IndexNow ; alléger le démarrage de la scène 3D (le LCP mobile dépend du JavaScript).

## 4. Commandes utiles ajoutées

- Aucune nouvelle commande : `npm run build` génère le sitemap (51 URL) et les 48 pages statiques.
- Contrôle : `npx lighthouse@12 https://mauditemachine.com/fr/ --only-categories=seo,performance,accessibility`.
