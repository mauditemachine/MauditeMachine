# Discographie Maudite Machine

## Vue d'ensemble

Section complète de discographie qui récupère automatiquement toutes les releases depuis l'API Discogs et les affiche avec une interface moderne et performante.

## Fonctionnalités

- 🎵 **Récupération automatique** depuis l'API Discogs
- 🔍 **Recherche textuelle** dans tous les champs
- 🏷️ **Filtrage par catégorie** (Albums, EPs, Singles, Remixes, etc.)
- 📊 **Statistiques détaillées** de la discographie
- 🔄 **Tri multiple** (année, titre, format)
- 📱 **Responsive design** (grid/liste)
- 💾 **Cache intelligent** avec TTL de 1h
- ⚡ **Performances optimisées** avec React.memo et lazy loading

## Structure

```
Discography/
├── Discography.tsx          # Composant principal
├── ReleaseCard.tsx          # Carte d'affichage d'une release
├── SearchBar.tsx            # Barre de recherche et contrôles
├── DiscographyStats.tsx     # Statistiques détaillées
├── LoadingSpinner.tsx       # Spinner de chargement
├── Discography.css          # Styles avec univers Maudite Machine
├── index.ts                 # Exports
└── README.md               # Cette documentation
```

## Utilisation

```tsx
import { Discography } from './components/Discography';

// Dans votre composant
<Discography />
```

## Configuration

Variables d'environnement requises dans `.env.local` :

```bash
VITE_DISCOGS_API_KEY=your_discogs_key
VITE_DISCOGS_API_SECRET=your_discogs_secret
```

## Performances

- **React.memo** sur tous les composants pour éviter les re-renders
- **Lazy loading** des images de covers
- **Cache localStorage** avec TTL automatique
- **Rate limiting** respectant les limites Discogs (60 req/min)
- **Filtrage côté client** pour une réactivité instantanée

## Design

L'interface suit l'univers cyberpunk/dark de Maudite Machine :

- **Couleurs** : Néon vert (#00ff88), magenta (#ff0080), cyan (#00ffff)
- **Effets** : Glow, gradients, animations fluides
- **Typography** : Inter, moderne et lisible
- **Layout** : Grid responsive avec mode liste alternatif

## API Discogs

- **Artist ID** : 5831599 (Maudite Machine)
- **Rate limit** : 60 requêtes/minute (respecté automatiquement)
- **Cache** : 1 heure de TTL pour éviter les appels répétés
- **Pagination** : Récupération automatique de toutes les pages

## Types

Types TypeScript complets définis dans `src/types/discogs.ts` pour une intégration type-safe avec l'API Discogs.
