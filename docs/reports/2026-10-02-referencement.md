# 2026-10-02 : référencement (SEO) et QR des stickers

## 1. Ce qui a été fait

- src/v4/state/sectionRoute.ts (nouveau), src/v4/index.tsx, src/App.tsx : une adresse par section (/tracks/, /mixtapes/, /shows/, /contact/, /goodies/, /merch/, /studio/) ; l'arrivée ouvre la section, la navigation met à jour l'adresse et le titre de l'onglet, le retour arrière suit.
- scripts/prerender-seo.mjs : une page statique par adresse, avec son texte lisible sans JavaScript (bio, dates, festivals, salles, tracks, catalogue, mixtapes, contacts, liens du site) et les dates à venir en MusicEvent (JSON-LD).
- src/data/seo-meta.json : titres et descriptions de /tracks, /mixtapes, /studio (EN, FR, ES).
- scripts/generate-sitemap.mjs, public/sitemap.xml : 12 adresses.
- index.html : Beatport ajouté aux profils (sameAs).
- public/qr/index.html, docs/stickers/ : lien court des stickers et QR codes (SVG noir, blanc, orange, PNG).
- docs/v4/spec.md : R14-24.

## 2. Décisions prises et pourquoi

- La page d'accueil était vide sans JavaScript : Google l'exécute, mais pas Bing (en partie), ni les aperçus des réseaux, ni les assistants IA. Le texte est maintenant dans le HTML de chaque page, le même que la machine affiche.
- Une adresse par section : des pages distinctes à indexer (« Maudite Machine shows », « tracks »...), des liens partageables, des pages vues séparées dans Analytics.
- PRESS sans adresse propre : /press/ (page statique des éléments presse) et /presskit/ existent déjà.
- QR vers un lien court (/qr/) plutôt que l'adresse complète : code plus simple (lecture plus fiable), visites mesurées, destination modifiable sans réimprimer.
- Vérifié : routes en navigateur (arrivée, navigation, retour, fermeture), build complet (9 pages + accueil, 3 dates en MusicEvent, JSON-LD valide, aucun tiret cadratin), redirection /qr/, QR décodé.
- dist/ remis à l'état du dépôt après le build local (GitHub Actions recompile).

## 3. Ce qui reste à faire / points en suspens

Côté Mika (le plus gros levier maintenant) :
- Google Search Console : vérifier mauditemachine.com et soumettre sitemap.xml (prompt Claude Chrome fourni).
- Bing Webmaster Tools : importer depuis Search Console.
- Mettre mauditemachine.com en premier lien partout : Instagram, SoundCloud, Spotify for Artists, Bandcamp, Beatport, Resident Advisor, Facebook, TikTok, YouTube, Mixcloud, Linktree.
- Chaque date annoncée aussi sur RA, Songkick, Bandsintown et Facebook, avec le lien /shows/.
- Demander aux salles, festivals, labels et médias un lien vers le site.
- Stickers : tester un tirage au téléphone avant la série.

## 4. Commandes utiles ajoutées

- `npm run build` génère maintenant aussi les pages des sections et les dates en JSON-LD (postbuild).
- QR : `docs/stickers/` ; le lien court se règle dans `public/qr/index.html`.
