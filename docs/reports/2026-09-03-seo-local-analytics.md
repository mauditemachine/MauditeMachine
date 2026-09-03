# Rapport de session — SEO local (booking Montréal/Québec) + Analytics

Date : 2026-09-03
Mission : être booké davantage à Montréal, au Québec et au Canada ;
savoir qui visite le site (villes, âge, genre) via Google Analytics.

## Constat de départ

- **Google Analytics est DÉJÀ installé** : balise GA4 `G-HP92HGMNJT`
  active en production (vérifié par curl), plus un pixel Facebook
  (`1410022320201825`). Le site collecte donc des données depuis un
  moment — elles n'étaient simplement jamais consultées.
- Ce que je ne peux pas faire à la place de Mika : lire son compte
  Google (identifiants personnels). D'où le double travail ci-dessous :
  automatiser la remontée des chiffres dans SON dashboard, et lui
  donner la marche à suivre côté Google.

## Ce qui a été fait

### 1. Remontée automatique des données GA4
- **[fetch-stats.mjs](../../scripts/fetch-stats.mjs)** : nouveau
  collecteur `fetchGA4()` (Google Analytics Data API v1beta, fenêtre
  90 jours) qui récupère : utilisateurs / sessions / pages vues,
  **villes** (top 15, l'info clé pour le booking local), pays, canaux
  d'acquisition, **âge**, **genre**, pages les plus vues. Mode dégradé
  comme les autres sources : sans configuration il renvoie
  « non configuré » au lieu de casser le cron ; les rapports
  démographiques sont isolés (ils échouent si les signaux Google sont
  désactivés, sans faire tomber le reste).
- **[stats.yml](../../.github/workflows/stats.yml)** : secrets
  `GA4_PROPERTY_ID` et `GA4_REFRESH_TOKEN` ajoutés au cron quotidien.
  Le collecteur réutilise les identifiants OAuth Google de YouTube
  Analytics (même compte) si aucun jeton GA4 dédié n'est fourni.

### 2. SEO local (le levier de booking)
- **Title** : « Maudite Machine | DJ Montréal · Indie Dance, Dark
  Disco, Techno » — la requête d'un bookeur (« DJ Montréal ») passe
  devant. Corrigé aussi dans `useV2Chrome` (le hook réécrivait le
  title au runtime et annulait la balise statique).
- **Description** : orientée booking et villes explicites (« basé à
  Montréal (Québec)… Booking clubs, festivals et événements privés au
  Québec et au Canada »).
- **Mots-clés** : refondus sur les intentions de recherche locales
  (DJ Montréal, DJ Québec, booker un DJ Montréal, DJ techno Montréal,
  DJ événement privé, DJ festival Québec…).
- **JSON-LD enrichi** : `areaServed` (Montréal, Québec, Canada,
  France, Spain), `makesOffer` → Service « DJ set / live performance »
  avec ses propres zones desservies, `potentialAction` ReserveAction
  (booking) et description du MusicGroup réécrite. C'est ce bloc qui
  dit explicitement à Google « ce DJ est disponible à Montréal ».
- **Texte visible** (Google indexe le contenu réel, pas seulement les
  balises) : la ligne du hero devient « DJ & producer · Montréal,
  Québec · Booking Canada · France · Spain » et le fallback Live
  « Available for clubs, festivals and private events in Montréal,
  Québec and across Canada ».

## Vérifications faites

- GA4 et pixel FB confirmés actifs en production.
- JSON-LD parsé au DOM : areaServed = [Montréal, Québec, Canada,
  France, Spain], offre de service et ReserveAction présents.
- Nouveau title et nouvelle description servis ; tagline du hero
  vérifiée au rendu.
- `node --check` sur le collecteur, build de prod clean.

## Ce qui reste à faire — CÔTÉ MIKA (rien ne marche sans ces étapes)

1. **Voir ses chiffres tout de suite** : analytics.google.com →
   propriété Maudite Machine → Rapports → « Données démographiques »
   (villes, âge, genre) et « Acquisition ». Les données existent déjà.
2. **Activer les signaux Google** (Admin → Collecte de données) sinon
   âge et genre restent vides. Note : sous un certain volume de
   trafic, Google masque ces lignes par confidentialité — c'est
   attendu, pas un bug.
3. **Google Search Console** (le vrai outil SEO, gratuit) :
   search.google.com/search-console → ajouter mauditemachine.com →
   soumettre `https://mauditemachine.com/sitemap.xml`. C'est ce qui
   montre sur quelles requêtes le site apparaît.
4. **Fiche Google Business Profile** « Maudite Machine — DJ, Montréal » :
   c'est LE levier n°1 pour apparaître dans les recherches locales
   type « DJ Montréal ». Gratuit, ~15 minutes.
5. Pour brancher les chiffres dans le dashboard interne : créer
   `GA4_PROPERTY_ID` (numéro de propriété, pas le G-…) et autoriser la
   portée `analytics.readonly` sur l'OAuth Google existant, puis
   ajouter les deux secrets GitHub.

## Décisions prises et pourquoi

- **Pas de nouvelle balise Analytics** : GA4 était déjà là, en poser
  une seconde aurait doublé les comptages.
- **Collecte serveur plutôt que lecture manuelle** : les chiffres
  arrivent dans le dashboard Stats existant (cron quotidien), donc
  consultables sans ouvrir l'interface Google.
- **SEO local dans le contenu ET les données structurées** : les
  balises seules ne suffisent plus, Google lit le texte affiché.

## Commandes utiles ajoutées

Aucune (le cron `npm run stats` couvre déjà GA4 une fois configuré).
