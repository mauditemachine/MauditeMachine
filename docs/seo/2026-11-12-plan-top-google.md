# Arriver en tête de Google : plan du 2026-11-12

Suite du plan de trafic du 2026-10-21 (docs/seo/2026-10-21-plan-trafic.md) et du kit du 2026-10-11 (docs/seo/2026-10-11-bios-profils.md). Ce document ne répète pas ces deux-là : il dit où on en est, ce qui est réaliste, et l'ordre des actions.

## 1. Ce qui est réaliste, requête par requête

| Famille de requêtes | Exemples | Objectif | Délai | Ce qui bloque |
|---|---|---|---|---|
| Ton nom | "Maudite Machine", "Maudite Machine DJ" | 1er résultat + panneau de connaissances à droite | 2 à 8 semaines | Le site n'est pas vu comme la source officielle : peu de liens vers lui, profils qui ne pointent pas vers lui, infos contradictoires (Montréal ou Montpellier) |
| Longue traîne outil | "dark disco drum pattern", "italo disco drum pattern", "ebm drum pattern", "boîte à rythmes en ligne gratuite", "caja de ritmos online gratis" | Top 5 | 2 à 6 mois | Autorité du domaine : quelques bons liens suffisent sur ces requêtes peu disputées |
| Local et booking | "DJ dark disco Montpellier", "DJ indie dance Montpellier", "DJ dark disco France" | Top 3 | 1 à 3 mois | Fiche Google, cohérence de l'adresse partout |
| Gros mots-clés | "online drum machine", "free drum machine", "online synth" | Première page | 6 à 12 mois, pas garanti | Concurrents installés (drumbit, iO-808, Splice, Roland50) avec des centaines de domaines qui les citent : seuls la presse, Product Hunt et les listes "best of" y mènent |

Le code ne fera plus gagner beaucoup de places : la base technique est saine (voir 3). Ce qui manque est hors du site : des liens et des profils cohérents.

## 2. Ce qui a été fait aujourd'hui dans le code

- **Titre de l'accueil en anglais** (la version que Google montre par défaut) : "Maudite Machine | Dark Disco DJ & Free Online Drum Machine" au lieu de "MM-STUDIO by Maudite Machine: Free Drum Machine & Synth". Ton nom d'abord, comme en français et en espagnol ; les requêtes d'outil restent servies par /mm-studio/ et ses pages machines. Description alignée.
- **Pages de motifs dark disco, indie dance, minimal, acid house** (EN, FR, ES, 12 pages) : les textes décrivaient des coups que les presets d'usine ne jouent plus (le build le signalait à chaque déploiement). Réécrits d'après les grilles actuelles ; la vérification du build passe à zéro avertissement.

## 3. Ce que l'audit du site en ligne montre

Les 98 adresses du sitemap répondent 200, http et www redirigent en 301 vers https://mauditemachine.com/, une adresse inconnue répond 404. Chaque page a son titre (60 signes au plus) et sa description uniques, un canonical, un seul H1, les hreflang FR/ES là où les traductions existent, et du JSON-LD (MusicGroup, MusicRecording, MusicEvent, FAQPage, BreadcrumbList). robots.txt, sitemap avec images, llms.txt et IndexNow après chaque déploiement : en place.

Points faibles qui restent :
- **Pages de morceaux minces** (150 à 240 mots, même gabarit). Elles ne sortiront que sur "Maudite Machine + titre". Pour mieux faire il faut ce que toi seul sais : l'histoire du morceau, le BPM, la tonalité, les crédits.
- **Le texte lisible par Google est caché à l'écran** : la machine 3D est ce que voit le visiteur, le texte HTML est posé pour les lecteurs d'écran. C'est légitime (c'est le même contenu), mais Google donne en général moins de poids à un texte qui n'est pas visible. À garder en tête si les pages MM-STUDIO plafonnent.

## 4. Ce que toi seul peux faire, dans l'ordre

1. **Google Search Console** (30 min, si ce n'est pas déjà fait). Propriété de type Domaine, sitemap soumis, indexation demandée pour /, /fr/, /mm-studio/, /mm-studio/drum-machine/, /mm-studio/drum-patterns/dark-disco/. Sans elle, impossible de savoir où tu es classé : je n'ai pas pu lire les positions Google d'ici (Google bloque les requêtes automatiques).
2. **Mettre tes profils d'accord avec le site** (1 h, textes prêts dans docs/seo/2026-10-11-bios-profils.md, section 2). Constaté aujourd'hui :
   - SoundCloud : la bio dit "Canadian DJ… deeply rooted in the Montreal scene", sans Montpellier. Ajoute mauditemachine.com dans les liens du profil.
   - Linktree : dit encore Montréal.
   - Bandcamp, RA, Beatport, Discogs, Mixcloud, Spotify for Artists, Apple Music for Artists, Instagram, YouTube, TikTok : le lien mauditemachine.com en premier, la même phrase de présentation partout ("DJ et producteur dark disco et indie dance, Montpellier, fondateur de VRSTL Records").
   Pourquoi : Google décide quel site est "officiel" pour un nom en regardant qui pointe vers qui. Aujourd'hui, Bandcamp et Beatport passent devant ton propre site.
3. **vrstlrecords.com** : la page d'accueil envoie 431 octets de HTML vide (tout est en JavaScript), sans lien vers mauditemachine.com. Ton propre label est le premier lien facile à obtenir, et son site est presque invisible pour les moteurs. À traiter dans une mission sur le dépôt du label (pré-rendu comme ici, et un lien vers mauditemachine.com sur la page de l'artiste).
4. **MusicBrainz puis Wikidata** (1 h 30, brouillons prêts dans docs/seo/2026-10-11-bios-profils.md, sections 4 et 5). C'est ce qui déclenche le panneau de connaissances à droite des résultats sur ton nom.
5. **Fiche Google Business Profile** (20 min) : "DJ" comme catégorie, zone desservie Montpellier et Occitanie, sans adresse publique, lien vers mauditemachine.com. Elle te fait entrer dans les résultats locaux ("DJ Montpellier") et sur Maps.
6. **Cinq liens pour démarrer** (une soirée, liste complète dans le plan du 2026-10-21, priorité 3) : AlternativeTo (MM-STUDIO comme alternative à drumbit et iO-808), la liste awesome-webaudio sur GitHub, Product Hunt, un courriel à Korben pour la version française, un courriel à Bedroom Producers Blog. Chaque lien d'un vrai site de musique ou de tech pèse plus que vingt annuaires.
7. **Semrush** : ton abonnement est actif mais le compte n'a plus d'unités API pour la connexion avec Claude (page : https://www.semrush.com/mcp-access). Avec des unités, une prochaine mission pourra lire tes positions réelles, les volumes de recherche et la liste des sites qui citent tes concurrents.
8. **Contenu des morceaux** (au fil de l'eau) : pour Voodoo, Limbos et les sorties récentes, quelques lignes d'histoire, le BPM, la tonalité, qui a masterisé. Envoie-les et je les intègre aux pages.
9. **Dates** : pour chaque date dans l'admin, l'adresse complète, l'heure avec le fuseau et le lien de billetterie. Sans eux, Google ne montre pas la date dans ses résultats Événements.

Les points 1 à 4 font l'essentiel du travail pour la requête sur ton nom. Les points 5 et 6 ouvrent les requêtes locales et outil.
