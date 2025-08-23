# Maudite Machine - Official Website

Site officiel du DJ et producteur canadien Maudite Machine, présentant sa discographie, ses événements à venir, et permettant la prise de contact.

## 🚀 Technologies

- **React 18** avec TypeScript
- **Vite** pour le build et le développement
- **CSS3** avec système responsive mobile-first
- **EmailJS** pour l'envoi d'emails

## 🎵 Fonctionnalités principales

### 🎧 **Lecteur SoundCloud intégré**
- Stream des derniers tracks en temps réel
- Interface personnalisée avec background dynamique
- Liens sociaux cliquables

### 💿 **Discographie dynamique (API Discogs)**
- Récupération automatique des releases depuis Discogs
- Filtres par type : EP, Singles, Remixes
- Affichage des durées et liens directs Discogs
- Statistiques en temps réel

### 📅 **Événements**
- Affichage des prochains events depuis JSON
- Cards responsive avec images et informations
- Limite mobile à 3 prochains événements

### 📷 **Feed Instagram (LightWidget)**
- Galerie photos Instagram en temps réel
- Lightbox intégré pour navigation
- Widget responsive desktop/mobile

### 💌 **Contact fonctionnel**
- Formulaire avec EmailJS configuré
- Captcha anti-spam intégré
- Validation côté client
- Messages de succès/erreur stylisés

### 📱 **Design responsive**
- Layout mobile-first avec marges 10px
- Interface adaptée tablette/desktop
- Polices custom (Fredoka, DIN)
- Gradient background animé

### 🎨 **Interface**
- Navigation par sections (disco, events, medias, store, contact, presskit)
- Messages aléatoires depuis JSON
- Bio artiste mis à jour
- Presskit téléchargeable

## 🌐 Plateformes externes

- **[Discogs API](https://www.discogs.com/developers)** - Récupération discographie
- **[SoundCloud](https://soundcloud.com/mauditemachine)** - Lecteur audio intégré
- **[EmailJS](https://www.emailjs.com/)** - Envoi d'emails depuis le formulaire
- **[LightWidget](https://lightwidget.com/)** - Widget Instagram
- **[Google Drive](https://drive.google.com/)** - Hébergement presskit

## 🏗️ Structure du projet

```
src/
├── components/           # Composants React
│   ├── Discography/     # Module discographie complet
│   ├── EventCard.tsx    # Card événement individuel
│   ├── EventsDisplay.tsx # Liste des événements
│   ├── InstagramFeed.tsx # Widget Instagram
│   ├── Message.tsx      # Formulaire de contact
│   ├── NewsMessages.tsx # Messages d'actualités
│   ├── Presskit.tsx     # Page presskit
│   ├── RandomMessage.tsx # Messages aléatoires
│   ├── SocialIcon.tsx   # Icônes réseaux sociaux
│   ├── SoundCloudPlayer.tsx # Lecteur audio
│   └── Store.tsx        # Page boutique
├── hooks/
│   ├── useDiscogs.ts    # Hook API Discogs
│   └── useLocalStorage.ts # Hook stockage local
├── types/
│   └── discogs.ts       # Types TypeScript Discogs
├── App.tsx              # Composant principal
├── main.tsx             # Point d'entrée
└── styles.css           # Styles globaux + responsive

medias/
├── events.json          # Données événements
├── messages.json        # Messages aléatoires
├── fonts/              # Polices custom
├── images/             # Images du site
├── logo/               # Logos et favicons
└── assets/             # Icônes navigation
```

## 🔧 Développement

```bash
# Installation
npm install

# Développement local
npm run dev

# Build production
npm run build
```

## 📧 Configuration EmailJS

Les clés EmailJS sont configurées directement dans `src/components/Message.tsx`. 
Pour modifier : voir `EMAILJS_SETUP.md`

## 🚀 Déploiement

Le site est automatiquement déployé sur GitHub Pages lors des pushs sur `main`.
Build assets générés dans `/dist`.

---

**🎵 [Visitez le site live](https://mauditemachine.github.io/MauditeMachine/)**