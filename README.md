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

## Comment j'ai redesigné le lecteur SoundCloud

Au lieu d'utiliser l'iframe SoundCloud standard (qui est moche et pas customisable), j'ai créé ma propre interface tout en gardant le playback officiel de SoundCloud.

### Le principe
1. **Iframe cachée** : L'iframe SoundCloud est totalement invisible (`width: 0, height: 0, opacity: 0`) mais reste fonctionnelle pour le playback
2. **Interface custom** : J'ai créé ma propre UI par-dessus qui communique avec l'iframe via l'API SoundCloud Widget
3. **Synchronisation** : Mon interface se synchronise en temps réel avec l'état du lecteur (play/pause, position, track courante)

### Architecture technique
```typescript
// 1. Chargement de l'API SoundCloud
const SC_API_URL = 'https://w.soundcloud.com/player/api.js'

// 2. Initialisation du widget sur l'iframe cachée
widgetRef.current = window.SC.Widget(iframeRef.current)

// 3. Events listeners pour synchroniser l'état
widget.bind(window.SC.Widget.Events.PLAY, () => setIsPlaying(true))
widget.bind(window.SC.Widget.Events.PAUSE, () => setIsPlaying(false))
widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, updateProgress)
```

### Fonctionnalités custom
- **Design sur mesure** : Styles CSS complètement personnalisés
- **Navigation de playlist** : Liste clickable avec track active highlightée
- **Progress bar custom** : Slider HTML5 synchronisé avec la position
- **Auto-resize du titre** : Le titre se redimensionne automatiquement pour tenir sur une ligne
- **Changement de background** : Le fond du site change selon la track qui joue
- **Draggable window** : La fenêtre peut être déplacée sur desktop
- **Load more** : Pagination intelligente (5 tracks puis "Load more")

### Défis techniques résolus
1. **Polling intelligent** : Détection des changements de track automatiques (fin de track, navigation)
2. **Race conditions** : Gestion des appels API asynchrones et états transitoires
3. **Responsive design** : Interface différente desktop/mobile
4. **Artwork haute résolution** : Récupération des covers en haute qualité via l'API
5. **Performance** : Polling optimisé (500ms) pour éviter la surcharge

### Code clé
```typescript
// Navigation programmable
function playIndex(index: number) {
  widget.skip(index)
  widget.play()
  maybeSwapBackground(index)
}

// Sync temps réel
widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (e: any) => {
  setPositionMs(Math.floor(e?.currentPosition || 0))
  checkCurrentTrack() // Vérification track courante
})
```

C'est comme ça que j'ai pu garder toute la puissance de SoundCloud (streaming, DRM, analytics) tout en ayant un design qui s'intègre parfaitement au site.

## Favicon
Le site utilise `medias/logos/favicon.ico` via la balise `<link rel="icon" href="/medias/logos/favicon.ico" />` dans `index.html`.

## Licences médias
Les médias (images, polices, sons, logos) restent la propriété de leurs ayants droit. Utilisation restreinte au site.


