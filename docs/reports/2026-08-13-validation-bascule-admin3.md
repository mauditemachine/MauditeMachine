# Rapport de session — Validation player, bascule v2, admin étape 3

Date : 2026-08-13
Trois missions en ordre strict : 1) valider le player SoundCloud à fond
(bloquante), 2) basculer /v2 en site principal (plan validé par GO avec
deux ajustements), 3) admin étape 3 (discographie + mixtapes).

## Mission 1 — Validation du player

### Testé et validé (prod + local)
- Lecture réelle de 4 pistes full-track en PROD (Abyss, Zenith, Limbos,
  Kouklikou) : progression et durées exactes.
- Play/pause : bouton et VU-mètre synchronisés dans les deux sens.
- Seek au clic : 50 % → 2:58/5:52 exact ; 98 % → fin déclenchée.
- Prev/next : saut des pistes sans URL dans les deux sens (Zenith →
  Kouklikou 7/12 en sautant les 3 AUTOPSYNTH, prev inverse).
- Fin de piste → passage automatique à la piste jouable suivante.
- Bascule moteurs : SC coupé proprement en naviguant vers le radar,
  preview iTunes (HTML5) jouée, retour, relecture SC. Zéro conflit.
- Erreur URL morte (sabotage temporaire en local puis restauration) :
  ERROR → notice « « titre » unavailable — skipped » 4 s dans la barre
  (AJOUTÉE cette session, deux moteurs) → la suivante joue réellement →
  jamais bloqué. Privé/géobloqué = même chemin ERROR.

### Bug trouvé et corrigé
L'enchaînement auto post-FINISH chargeait la suivante sans la jouer
(le load() lancé dans le callback FINISH se fait avaler par le cycle de
fin du widget). Fix : enchaînement différé de 300 ms + relance play()
unique à 1,2 s. Si un navigateur refuse quand même l'autoplay, la barre
retombe sur « Lecture » cliquable : le player ne reste JAMAIS muet en
prétendant jouer.

### Vérification humaine requise (Mika)
- iOS Safari (pas de Xcode/simulateur sur cette machine) : tap play,
  pause/reprise, seek au doigt, écran verrouillé.
- L'enchaînement auto avec un VRAI clic initial : l'environnement de
  test n'accorde pas d'activation utilisateur pérenne aux gestes
  synthétiques, impossible de prouver ici que la piste suivante démarre
  seule. En navigateur réel, le premier vrai clic délègue normalement
  la permission à l'iframe (comportement standard). Repli propre vérifié
  dans le pire cas.
- ⚠️ Les résultats des tests humains annoncés dans le GO sont restés en
  placeholders (« [OK / décris le problème] ») : toujours en attente.

## Mission 2 — Bascule v2 en site principal

### Fait (plan validé + 2 ajustements de Mika)
- `/` sert la v2, `/radar` la page Radar (ex /v2/radar), `/v2` et
  `/v2/radar` redirigent.
- V1 archivée NAVIGABLE sous `/v1` : liens du header, logo, condition
  vidéo home et navigate() internes préfixés ; noindex posé par le
  Layout v1 (+ robots.txt en double ceinture).
- Redirections : /about → /#epk (ajustement 2 : VÉRIFIÉ que l'ancre
  tombe sur la section renommée « 06 Press Kit », y=4901, section en
  vue), /techrider → /#epk, /shows → /#live, /merch → /#merch,
  /goodies → /#merch (ajustement 1), /contact → /#contact.
- Admin intact : /mm-admin/*, /mm-admin/stats, /mm-admin/radar (Layout
  v1 remonté dessus pour son player), /ms-admin.
- SEO : title « Maudite Machine | DJ & Producer · Indie Dance, Dark
  Disco », description/OG/Twitter avec Canada · France · Spain,
  JSON-LD homeLocation+location à trois territoires, og:locale es_ES
  ajouté, geo.placename mis à jour. useV2Chrome réduit à body class +
  titre (les metas d'index.html SONT la v2 désormais). V2App scrolle
  vers l'ancre à l'arrivée directe.
- Sitemap : / et /radar uniquement, hreflang v1 retirés. robots.txt :
  Disallow /v1. Prerender des routes v1 supprimé (redirects client).
- Footer v2 : « Archive v1 » → /v1.

### URLs vérifiées en prod après déploiement
- / : titre v2, robots index/follow, territoires ×4 ✓
- /radar : le fallback SPA sert l'app (le 404 HTTP est le mécanisme
  GitHub Pages normal, identique à toutes les routes SPA du site) ✓
- /v1 : app chargée, noindex posé au rendu, robots.txt l'exclut ✓
- sitemap.xml : 2 URLs ✓ ; robots.txt : /v1 exclu ✓
- Player sur la home prod : Abyss joue (0:02/5:52) ✓
- En local avant push : les 8 redirections testées une par une,
  /v1/about rendu, /mm-admin/radar dans le Layout ✓

## Mission 3 — Admin étape 3

### Serveur (server.js)
- GET/PUT /api/admin/data/:name : whitelist stricte (discography,
  mixtapes), VALIDATION par fichier (ids uniques, catégories, URLs
  SoundCloud), backup horodaté dans .admin-backups/ (gitignoré,
  rotation 20 versions) avant chaque écriture, écriture atomique
  (tmp + rename).
- POST /api/admin/sc-check : oEmbed SoundCloud (200 = lisible, sinon
  mort/privé), zéro clé.
- POST /api/admin/sc-extract : hydration SoundCloud → titre, numéro,
  année, durée + artwork téléchargé et converti en WebP 500px local
  (sharp, nouvelle dépendance validée au plan).

### Pages
- Discographie : 38 pistes en édition inline (titre, projet, rôle,
  année, catégorie, deux liens), toggle sélection, drag & drop
  (@dnd-kit), badge « incomplet », bouton « Tester l'écoute » par
  piste, ajout en tête / suppression avec confirmation. Auto-save
  débouncé 800 ms avec indicateur (« Enregistré ✓ »).
- Mixtapes : champ « coller un lien SoundCloud » → extraction complète
  + ajout en tête ; liste éditable (titre, n°, année, durée, lien,
  visible), pochette en vignette, suppression avec confirmation.

### Testé de bout en bout
- Édition inline → écrit sur disque après débounce → backup créé →
  restauration par l'UI → fichier identique au commit (git diff vide).
- « Tester l'écoute » sur Abyss → badge « écoute OK ».
- Extraction réelle de soundcloud.com/mauditemachine/voodoo : titre,
  5:59, 2026, artwork WebP téléchargé, numéro auto-incrémenté →
  suppression via l'UI → état restauré à l'identique, artwork de test
  nettoyé.
- Le drag & drop : logique arrayMove standard, à confirmer d'un
  glisser réel (les événements pointer synthétiques ne sont pas
  fiables dans l'environnement de test).

## Décisions prises et pourquoi
- Repli d'autoplay « jamais muet » : si l'enchaînement est refusé par
  la politique navigateur, l'UI montre l'état réel (Lecture cliquable)
  plutôt qu'un faux état de lecture.
- Redirections côté client (SPA GitHub Pages) : pas de vraies 301
  possibles sur Pages ; les Navigate + fallback 404.html couvrent tous
  les cas, et le prerender v1 est retiré pour ne pas servir de vieilles
  metas.
- Backups avant chaque écriture admin plutôt qu'un undo en mémoire :
  survit aux crashs, inspectable, dans .admin-backups/ gitignoré.
- sc-extract convertit l'artwork CÔTÉ SERVEUR : le navigateur ne peut
  pas télécharger cross-origin les images sndcdn proprement.

## Ce qui reste à faire / points en suspens
- MIKA : résultats des tests humains du player (placeholders restés
  vides) — iOS Safari + enchaînement auto au vrai clic.
- MIKA : un glisser-déposer réel dans la discographie admin pour
  confirmer le drag.
- Étapes 4 (médias + textes) et 5 (publier + polish) du panneau admin.
- Points antérieurs : riders PDF, Bandsintown, AUTOPSYNTH, presskit
  « Limbos 2025 », nettoyage images 176 Mo.

## Commandes utiles ajoutées
- Dépendance : sharp (conversion WebP côté serveur admin).
- .admin-backups/ : versions horodatées des fichiers édités par
  l'admin (20 par fichier, local uniquement).
