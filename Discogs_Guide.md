# 🎵 Discographie Maudite Machine - Guide d'utilisation

## 🚀 Démarrage rapide

1. **Vérifiez la configuration API :**
   ```bash
   # Fichier .env.local créé avec les clés Discogs
   VITE_DISCOGS_API_KEY=aYRSRvOTkEpilgDiyjUQ
   VITE_DISCOGS_API_SECRET=SVtLcCbgUHndVVIoNujcgjjuRnFdhNcW
   ```

2. **Lancez le projet :**
   ```bash
   npm run dev
   ```

3. **Testez la discographie :**
   - Cliquez sur le bouton "DISCO" dans la navigation
   - La discographie se charge automatiquement depuis l'API Discogs
   - Premier chargement : ~10-15 secondes (récupération complète)
   - Chargements suivants : instantané (cache 1h)

## 🎯 Fonctionnalités à tester

### Navigation
- ✅ Bouton DISCO actif et interactif
- ✅ Affichage dans le main-rectangle
- ✅ Retour aux autres sections (NEWS, EVENTS)

### Chargement des données
- ✅ Loading spinner pendant récupération API
- ✅ Cache automatique (recharger la page = instantané)
- ✅ Gestion d'erreurs réseau
- ✅ Bouton de rechargement manuel

### Interface utilisateur
- ✅ Header avec titre et compteur
- ✅ Statistiques détaillées (toggleable)
- ✅ Filtres par catégorie (Albums, EPs, Singles, etc.)
- ✅ Barre de recherche en temps réel
- ✅ Toggle vue grid/liste
- ✅ Tri par année/titre/format

### Cartes de releases
- ✅ Images des covers (lazy loading)
- ✅ Overlay au hover avec détails
- ✅ Liens vers Discogs
- ✅ Métadonnées complètes
- ✅ Responsive mobile

## 🎨 Design

L'interface suit parfaitement l'univers Maudite Machine :
- **Couleurs** : Néon vert, magenta, cyan
- **Effets** : Glow, gradients, animations fluides
- **Layout** : Intégration parfaite dans le design existant

## 🔧 Architecture technique

### Composants créés
```
src/components/Discography/
├── Discography.tsx          # Composant principal
├── ReleaseCard.tsx          # Carte d'une release
├── SearchBar.tsx            # Recherche et contrôles
├── DiscographyStats.tsx     # Statistiques détaillées
├── LoadingSpinner.tsx       # Spinner de chargement
├── Discography.css          # Styles complets
└── index.ts                 # Exports
```

### Hooks et utilitaires
```
src/hooks/
├── useDiscogs.ts            # Hook principal API
└── useLocalStorage.ts       # Gestion localStorage

src/utils/
└── storage.ts               # Cache avec TTL

src/types/
└── discogs.ts               # Types TypeScript
```

## 📊 Performance

- **Cache intelligent** : 1h de TTL pour éviter les appels répétés
- **Rate limiting** : Respect automatique des limites Discogs
- **React.memo** : Évite les re-renders inutiles
- **Lazy loading** : Images chargées à la demande
- **Bundle optimisé** : Build ~172KB gzippé

## 🌐 API Discogs

- **Artist ID** : 5831599 (Maudite Machine)
- **Endpoint** : `/artists/5831599/releases`
- **Rate limit** : 60 req/min (1.1s entre les appels)
- **Authentification** : Key/Secret (pas OAuth)

## 🐛 Débogage

### Console logs utiles
```javascript
// Vérifiez la récupération API
console.log('🎵 Récupération page X...')
console.log('✅ X releases récupérées !')

// Cache
console.log('📦 Chargement depuis le cache')
console.log('🌐 Récupération depuis l\'API Discogs...')
```

### Vider le cache
```javascript
// Dans la console navigateur
localStorage.removeItem('mauditemachine_discography');
```

## 🎯 Prochaines améliorations

- [ ] Intégration player Spotify/SoundCloud
- [ ] Export discographie (JSON/CSV)
- [ ] Filtres avancés (années, labels)
- [ ] Animations Framer Motion
- [ ] Mode PWA
- [ ] Partage social

## ✅ Tests de validation

1. **Chargement initial** : API → Cache → Affichage
2. **Navigation** : Boutons → Sections → Retour
3. **Recherche** : Texte → Filtrage → Résultats
4. **Responsive** : Mobile → Tablet → Desktop
5. **Performance** : Build → Gzip → Lighthouse

---

**🎉 La discographie Maudite Machine est prête !**
