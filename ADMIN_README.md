# Page d'Administration - Maudite Machine

## Accès à la page d'administration

La page d'administration est accessible à l'URL : `mauditemachine.com/ms-admin/`

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

## Notes Techniques

### Développement
- La page utilise React avec TypeScript
- Les styles sont définis dans `src/styles.css`
- L'API est simulée dans `src/utils/adminApi.ts`

### Production
- Pour la production, vous devrez implémenter un vrai backend API
- Les endpoints nécessaires :
  - `GET /api/messages` : Récupérer les messages
  - `PUT /api/messages` : Sauvegarder les messages

### Sécurité
- Ajoutez une authentification pour protéger la page d'administration
- Validez les données côté serveur
- Limitez l'accès à la page d'administration

## Fichiers Modifiés

- `src/App.tsx` : Ajout du routage
- `src/components/Admin.tsx` : Composant principal d'administration
- `src/components/MainApp.tsx` : Application principale extraite
- `src/utils/adminApi.ts` : API utilitaire
- `src/styles.css` : Styles pour l'administration

## Prochaines Étapes

1. **Authentification** : Ajouter un système de connexion
2. **Backend API** : Implémenter les vrais endpoints
3. **Gestion des autres JSON** : Étendre pour gérer `events.json`
4. **Upload d'images** : Permettre l'upload d'images directement
5. **Historique** : Ajouter un système de versioning des modifications
