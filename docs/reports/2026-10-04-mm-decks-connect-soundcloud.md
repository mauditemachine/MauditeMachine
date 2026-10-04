# MM-DECKS : se connecter avec SoundCloud (2026-10-04)

Mika : « oui ajoute le bouton se connecter avec soundcloud ».

## Ce qui change

- Nouvel onglet MY SOUNDCLOUD dans la playlist, entre SOUNDCLOUD et MY FILES.
  Sans connexion, il montre le bouton CONNECT WITH SOUNDCLOUD ; connecté, la
  liste des morceaux publics du compte et une touche DISCONNECT.
- La connexion se fait dans une fenêtre à part : les platines gardent leurs
  morceaux. Elle finit sur `public/soundcloud-connect.html`, qui range le
  numéro de séance dans localStorage (clé `mm.v4.dj.sc`) et se ferme ; la page
  des Decks l'apprend par l'événement storage. Installé sur l'écran d'accueil
  de l'iPhone (une fenêtre à part n'y partage pas le stockage), ou fenêtre
  bloquée : la page entière va chez SoundCloud et revient à la page de départ.
- Les jetons SoundCloud restent dans le Worker de Sonaa (KV DEMANDES, sous
  l'empreinte SHA-256 du numéro). La page n'envoie que ce numéro, en
  `Authorization: Bearer`, jamais dans une adresse.
- Connecté, `/flux` passe par le jeton de la personne : ses propres morceaux
  sont permis quelle que soit leur licence ; ceux des autres restent limités
  aux licences de remix.

## Worker (dépôt Sonaa, worker/src/soundcloud.ts)

- `GET api/soundcloud/connexion?origine=` : PKCE, état gardé dix minutes,
  redirection vers secure.soundcloud.com. Origine limitée à mauditemachine.com
  et localhost.
- `GET api/soundcloud/rappel` : échange du code, `/me`, séance de soixante
  jours, retour vers `<origine>/soundcloud-connect.html#s=...&n=...`.
- `GET api/soundcloud/moi` : les morceaux publics du compte (401 sans séance).
- `POST api/soundcloud/deconnexion` : efface la séance et appelle sign-out.

## À faire par Mika

Dans l'application SoundCloud, inscrire l'adresse de retour
`https://sonaa-sets.massivemedias.workers.dev/api/soundcloud/rappel`.

## Vérifié

Son coupé, avec un SoundCloud simulé dans la page : le bouton, la fenêtre,
le retour par la page de connexion (séance rangée, adresse nettoyée, fenêtre
fermée), le retour en pleine page, la liste, le chargement envoyé avec la séance, DISCONNECT, l'échec.
Téléphone : pas de défilement horizontal de la page. Worker déployé : les
routes répondent 503 tant que les deux secrets ne sont pas posés, 400 pour
une origine étrangère, 401 pour `moi` sans séance.
