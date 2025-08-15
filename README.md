# Custom SoundCloud Player - Maudite Machine

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

## Résultat final

![Custom SoundCloud Player](https://mauditemachine.com/medias/images/Simetra.webp)

- **Design intégré** : Le lecteur s'intègre parfaitement au design du site
- **Performance** : Aucune latence, synchronisation temps réel
- **Fonctionnalités avancées** : Navigation fluide, backgrounds dynamiques, responsive
- **Compatibilité** : Garde tous les avantages de SoundCloud (analytics, DRM, etc.)

## Live Demo
👉 **Voir en action** : [mauditemachine.com](https://mauditemachine.com)

Le lecteur est visible dans une fenêtre draggable sur desktop, ou intégré directement sur mobile.


