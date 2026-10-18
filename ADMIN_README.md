# Page d'Administration - Maudite Machine

## Accès à la page d'administration

En local, serveur d'écriture démarré : `localhost:5173/ms-admin` pour les
messages, `localhost:5173/mm-admin` pour events, merch, news et releases.

En ligne, ces deux URL existent mais affichent un écran "Édition désactivée".
Voir la section plus bas pour le pourquoi et pour le circuit de mise à jour.

## Samples du MM-RYTM : `/mm-admin/samples`

Les samples de chaque voix du MM-RYTM : ceux du site, et ceux de tes projets
Ableton (ton dossier `shots`), à écouter, choisir et publier.

1. Dans le Terminal, dans le dossier du site : `git pull --ff-only && npm run admin`
   (si `npm run admin` tournait déjà avant la mise à jour : Ctrl+C, puis relance).
2. Dans le menu de gauche de l'admin : **Samples**
   (ou directement `http://localhost:5173/mm-admin/samples`).
3. L'analyse de tes projets démarre toute seule (lecture seule, sur ton Mac).
   Les samples choisis automatiquement sont cochés d'avance ; le bouton rond
   fait écouter (un seul son à la fois, rien ne joue tout seul).
4. **Publier la sélection (N)**, puis « Publier » dans la fenêtre : ajout dans
   `public/samples/rytm` (jamais de remplacement), commit, push ; le site se met
   à jour en 1 à 2 minutes. La page donne la ligne pour annuler.

Depuis le téléphone ou l'iPad : `npm run admin -- --lan` (avec `ADMIN_PASSWORD`),
puis `http://<IP du Mac>:5173/mm-admin/samples`. En ligne, la page montre
seulement les samples du site. Tout le détail (refus, `--reset-samples`, la
commande équivalente `npm run samples:mika`) : `docs/samples-mika.md`.

## Fonctionnalités

### Gestion des Messages
- **Visualisation** : Voir tous les messages actuels du site
- **Édition** : Modifier le titre, la description, l'image, les liens et la date de chaque message
- **Ajout** : Créer de nouveaux messages
- **Suppression** : Supprimer des messages existants
- **Sauvegarde** : Sauvegarder toutes les modifications

### Interface Utilisateur
- **Design moderne** : Interface avec un design sombre et élégant
- **Responsive** : Compatible avec les appareils mobiles et desktop
- **Feedback visuel** : Messages de confirmation et d'erreur
- **Validation** : Champs de formulaire avec validation

## Structure des Messages

Chaque message contient :
- **Titre** : Le titre principal du message
- **Description** : Le texte descriptif du message
- **Image** : Chemin relatif vers l'image (ex: `images/Simetra.webp`)
- **Lien** (optionnel) :
  - **Label** : Texte du lien (ex: "Soundcloud")
  - **URL** : Adresse du lien (ex: "https://soundcloud.com/...")
- **Date** : Date du message au format YYYY-MM-DD

## Utilisation

1. **Accéder à la page** : Naviguez vers `mauditemachine.com/ms-admin/`
2. **Modifier un message** : Cliquez dans les champs pour éditer
3. **Ajouter un message** : Cliquez sur "Ajouter un message"
4. **Supprimer un message** : Cliquez sur "Supprimer" dans la carte du message
5. **Sauvegarder** : Cliquez sur "Sauvegarder" pour enregistrer les modifications

## Où l'édition fonctionne, et où elle ne fonctionne pas

**L'admin en ligne est désactivé par conception.** Il n'existe aucun serveur
d'écriture distant pour ce site. Un hébergement Render avait été envisagé,
mais le service n'a jamais existé : le sous-domaine attendu renvoyait
`x-render-routing: no-server`. Render est abandonné, `api/render.yaml` a été
supprimé pour que plus personne ne croie le contraire.

Concrètement :

| Contexte | Édition | Détail |
|---|---|---|
| `mauditemachine.com/mm-admin` | non | Écran "Édition en ligne désactivée" |
| `localhost:5173/mm-admin` | oui | Écrit directement dans `public/*.json` |

La page publique `/radar` ne dépend d'aucune API : elle lit le fichier
statique `public/releases.json` servi par GitHub Pages.

## Mettre à jour les releases (page /radar)

Deux circuits possibles, au choix.

### Circuit 1, recommandé : par Claude Code

C'est la voie normale, notamment pour la veille musicale hebdomadaire.

1. Coller le bloc JSON des nouvelles sorties dans Claude Code.
2. Claude Code met à jour `public/releases.json`, en dédupliquant sur
   artist + title + label + releaseDate.
3. `npm run covers` : récupère les pochettes manquantes (og:image du lien
   de chaque sortie) dans `public/images/releases/`, en webp 800px max.
   À relancer après CHAQUE import, les nouvelles entrées arrivent sans
   cover. Committer les images avec releases.json.
4. Commit et push sur `main`.
5. GitHub Actions rebuild et déploie, environ 1 minute.
6. Les sorties apparaissent sur `mauditemachine.com/radar`.

Note covers : Beatport bloque le fetch serveur (403 anti-bot) sur ses
pages. Si `npm run covers` échoue sur un lien Beatport, ouvrir la page
dans un navigateur, copier le `content` de la balise `og:image`, le
coller dans le champ `cover` de la release, puis relancer `npm run
covers` : le script télécharge alors l'image directement depuis le CDN,
qui lui n'est pas bloqué. Bandcamp passe sans manipulation.

Aucun serveur, aucun mot de passe, tout est versionné dans git.

### Circuit 2 : admin en local

Pour une saisie manuelle à l'unité, dans l'interface.

```bash
npm run dev        # front sur localhost:5173
node server.js     # API d'écriture locale sur localhost:3001
```

Puis `localhost:5173/mm-admin`, onglet `releases`. Les modifications
écrivent directement dans `public/*.json`. Il reste à committer et pousser
soi-même pour les mettre en ligne.

Si `ADMIN_PASSWORD` est défini dans l'environnement, le serveur local le
réclame. Sinon l'écriture passe sans mot de passe, le CORS restant limité à
localhost.

### Format d'une release

```json
{
  "id": 1,
  "artist": "Damon Jee & Darlyn Vlys",
  "title": "Club Scenes",
  "label": "Surefire",
  "releaseDate": "2026-07-24",
  "genre": "Indie Dance",
  "format": "EP",
  "link": "https://www.beatport.com/...",
  "soundcloudUrl": "",
  "cover": "",
  "section": "feature",
  "favorite": true,
  "colorFrom": "#ff2e4d",
  "colorTo": "#3a0d18",
  "publishedRadar": true
}
```

`format` : Single, EP, Album, Compilation ou VA.
`section` : `feature` (coups de cœur), `labels` ou `artistes`.
`cover` vide fait générer une pochette en dégradé `colorFrom` vers `colorTo`
avec les initiales de l'artiste.
`publishedRadar: false` masque une sortie sans la supprimer.
`soundcloudUrl` (optionnel) : URL d'une track ou d'un set SoundCloud. Si
présent, le lecteur du Radar joue la version complète via le widget
SoundCloud au lieu de l'extrait iTunes de 30 secondes.

## Sécurité

État actuel, tout est en place côté code :

- Auth server-side sur toutes les routes d'écriture des deux serveurs
  Express : comparaison à temps constant, rate-limit 10 tentatives par
  10 minutes, fail closed.
- Écran de login devant `/mm-admin` et `/ms-admin`. Ce gate est une
  commodité d'interface, le verrou réel est côté serveur.
- Upload durci : whitelist de dossiers, basename sûr, validation du type
  réel par magic bytes.
- Aucun secret dans le dépôt ni dans le bundle. Tout `VITE_*` étant inline
  en clair dans `dist/assets/*.js`, un secret ne doit jamais en être un.

Reste à faire côté compte, hors code : révoquer la clé Discogs, toujours
lisible dans l'historique git du dépôt public.

## Architecture

- Front React 18 + Vite 5 + TypeScript + Tailwind, déployé sur GitHub Pages.
  Le build de production tourne dans GitHub Actions
  (`.github/workflows/pages.yml`) : le `dist/` commité n'est pas ce qui est
  servi, il est reconstruit à chaque push.
- Deux serveurs Express. `server.js` à la racine sert l'admin local et écrit
  les fichiers directement. `api/server.js` ciblait Render : **non déployé**,
  conservé comme base prête à l'emploi si un hébergement revient un jour.
- Données : Sanity pour events, merch et news avec fallback `public/*.json`.
  Les releases sont uniquement dans `public/releases.json`.
