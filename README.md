# Maudite Machine 2025

Site vitrine 2025 de Maudite Machine.

## Stack
- Vite + React + TypeScript
- CSS custom (pas de framework)
- SoundCloud Widget API pour le lecteur (playlist, navigation, play/pause)
- Données locales JSON: `medias/events.json`, `medias/messages.json`
- Images & logos: dossier `medias/`

## Dev
```
npm ci
npm run dev
```

## Build
```
npm run build
```
Le build est généré dans `dist/`.

## Déploiement
Deux options courantes:

1) Branche `gh-pages`
- Publier `dist/` et `medias/` sur `gh-pages` (root)
- Ajouter `CNAME` contenant `mauditemachine.com` et créer `.nojekyll`

2) GitHub Actions
- Workflow qui build `dist/` et uploade l’artifact Pages
- Le dossier `medias/` doit être inclus dans l’artifact (ou placé dans `public/` avant build)

## Particularités
- Fenêtre lecteur déplaçable (desktop), draggable via un handle discret
- Titre de la piste auto-rétréci pour tenir sur une ligne
- Scrollbar playlist custom (sobre)
- Messages aléatoires (titre/description/image/lien) affichés à droite (desktop) et sous le logo (mobile)

## Favicon
Le site utilise `medias/logos/favicon.ico` via la balise `<link rel="icon" href="/medias/logos/favicon.ico" />` dans `index.html`.

## Licences médias
Les médias (images, polices, sons, logos) restent la propriété de leurs ayants droit. Utilisation restreinte au site.


