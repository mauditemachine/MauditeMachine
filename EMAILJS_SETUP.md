# Configuration EmailJS pour Maudite Machine

Ce guide vous explique comment configurer EmailJS pour recevoir les messages du formulaire de contact de votre site.

## Étape 1: Créer un compte EmailJS

1. Aller sur https://www.emailjs.com/
2. Créer un compte gratuit
3. Vérifier votre email

## Étape 2: Créer un Service Email

1. Dans le dashboard EmailJS, aller à "Email Services"
2. Cliquer "Add New Service"
3. Choisir votre provider email (Gmail recommandé)
4. Suivre les instructions pour connecter votre email
5. Noter le **Service ID** (par exemple: `service_abc123`)

## Étape 3: Créer un Template Email

1. Aller à "Email Templates"
2. Cliquer "Create New Template"
3. Utiliser ce template :

```
Subject: Contact from Maudite Machine Website - {{object}}

From: Maudite Machine Website
Date: {{date}}
Object: {{object}}

Message:
{{message}}

---
This message was sent from the contact form on mauditemachine.com
```

4. Noter le **Template ID** (par exemple: `template_xyz789`)

## Étape 4: Obtenir la Public Key

1. Aller à "Account" → "General"
2. Copier la **Public Key** (par exemple: `user_def456`)

## Étape 5: Configurer les Variables

Une fois que vous avez vos 3 clés, vous devez les mettre dans le fichier `.env.local` :

```
VITE_EMAILJS_SERVICE_ID=service_abc123
VITE_EMAILJS_TEMPLATE_ID=template_xyz789
VITE_EMAILJS_PUBLIC_KEY=user_def456
```

## Étape 6: Test

1. Redémarrer le serveur de développement
2. Tester le formulaire de contact
3. Vérifier que vous recevez l'email

## Notes importantes

- Le plan gratuit permet 200 emails/mois
- Les emails arrivent dans l'adresse configurée dans le Service
- Pensez à vérifier vos spams au début
- En production, les variables d'environnement doivent être configurées sur votre hébergeur

## Template recommandé pour la réception

Pour personnaliser l'email que vous recevez, utilisez ces variables dans votre template EmailJS :

- `{{object}}` : Objet du message
- `{{message}}` : Contenu du message  
- `{{date}}` : Date et heure d'envoi

Exemple de template complet :
```
Subject: [MAUDITE MACHINE] {{object}}

Nouveau message depuis le site mauditemachine.com

OBJET: {{object}}
DATE: {{date}}

MESSAGE:
{{message}}

---
Message envoyé automatiquement depuis le formulaire de contact
```
