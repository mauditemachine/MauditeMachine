# 2026-11-12 : référencement, viser le haut de Google

Demande de Mika : "je veux que tu fasses du référencement complet pour mon site, je veux arriver dans les top de Google".

## 1. Ce qui a été fait

- **Audit du site en ligne** : les 98 adresses du sitemap téléchargées et contrôlées (statut, titre, description, canonical, H1, hreflang, JSON-LD, robots, redirections http/www/sans barre, 404). Résultat dans docs/seo/2026-11-12-plan-top-google.md, section 3.
- **Titre et description de l'accueil anglais** : src/data/seo-meta.json, index.html (title, og:title, twitter:title, descriptions), valeurs de repli de scripts/seo-shared.mjs et src/v4/theme.ts. Nouveau titre : "Maudite Machine | Dark Disco DJ & Free Online Drum Machine" (58 signes).
- **Textes des motifs** : scripts/mm-studio-patterns.mjs, acid house, dark disco, indie dance et minimal réécrits en EN, FR et ES d'après les grilles actuelles des presets d'usine, listes check mises à jour ; deux variations corrigées (indie dance, minimal). patternCheck() rend une liste vide.
- **Contrôle des profils externes** : SoundCloud et Linktree présentent encore Montréal ; vrstlrecords.com sert une page HTML vide sans lien vers le site.
- **Plan d'action** : docs/seo/2026-11-12-plan-top-google.md (objectifs réalistes par famille de requêtes, actions de Mika dans l'ordre).

## 2. Décisions prises et pourquoi

- **Le nom d'abord dans le titre de l'accueil EN**. Le 2026-10-21, l'accueil avait été tourné vers MM-STUDIO et la formule laissée à valider par Mika. Pour "arriver en tête", la requête la plus accessible est le nom de l'artiste : un titre d'accueil qui commence par le nom est le signal le plus direct. "Dark Disco DJ" et "Free Online Drum Machine" restent dans le titre ; les pages /mm-studio/ visent déjà les requêtes d'outil. FR et ES suivaient déjà cette forme. Retour en arrière : une ligne dans src/data/seo-meta.json.
- **dist/ et public/sitemap.xml non commités** : le build local les régénère, mais la CI refait les deux au déploiement (le sitemap compare avec le site en ligne ; une version locale aurait mis de fausses dates de modification).
- **Pas de nouvelles pages "DJ Montpellier"** : une page faite seulement pour une requête, sans contenu propre, risque d'être vue comme une page satellite. Les pages /fr/ et la fiche Google Business Profile servent mieux cette requête.
- **Positions Google non mesurées** : Google et Bing bloquent les requêtes automatiques, et le connecteur Semrush n'a plus d'unités API. Les objectifs du plan sont des estimations, pas des mesures.

## 3. Ce qui reste à faire / points en suspens

Côté Mika (détail et ordre dans docs/seo/2026-11-12-plan-top-google.md, section 4) :
- Search Console (si pas déjà fait), sitemap soumis, indexation demandée.
- Bios et liens des profils (SoundCloud, Linktree, Bandcamp, RA, Beatport, Spotify, Instagram...) : Montpellier et un lien vers mauditemachine.com.
- MusicBrainz puis Wikidata (brouillons dans docs/seo/2026-10-11-bios-profils.md).
- Fiche Google Business Profile (zone desservie, sans adresse).
- Cinq premiers liens : AlternativeTo, awesome-webaudio, Product Hunt, Korben, Bedroom Producers Blog.
- Unités API Semrush (https://www.semrush.com/mcp-access) pour une mission de mesure.
- Histoire, BPM, tonalité et crédits des morceaux récents ; adresses, heures et billetterie des dates.
- Toujours en attente depuis le 2026-10-21 : la décision consentement (GA4 et pixel Meta sans bandeau).

Côté code, pour une prochaine mission :
- vrstlrecords.com : pré-rendu du HTML et lien vers mauditemachine.com (autre dépôt).
- Pages de morceaux enrichies dès que Mika fournit les textes.
- Le texte de chaque page est caché à l'écran (la machine 3D est visible) : à surveiller dans Search Console si les pages MM-STUDIO plafonnent.

## 4. Commandes utiles ajoutées

Aucune nouvelle commande. Pour refaire l'audit des motifs sans build complet :

```bash
node -e "import('./scripts/mm-studio-patterns.mjs').then(m => console.log(m.patternCheck()))"
```
