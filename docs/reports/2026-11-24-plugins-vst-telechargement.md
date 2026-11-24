# 2026-11-24 : MM-RYTM et MM-ARP en telechargement gratuit, contre un courriel, don volontaire

Demande de Mika : "mettre a disposition les plugins RYTM et ARP au telechargement ; ils doivent laisser leur adresse courriel, ils recoivent un lien de telechargement par courriel, et si possible une donation, sur la base du volontariat".

## Choix

- **Envoi du courriel : EmailJS**, le compte deja utilise par CONTACT. Le site est statique (GitHub Pages) : pas de serveur a deployer, pas de secret. Le modele "VST download" a un texte fixe (seul `{{to_email}}` varie) : la cle publique ne peut pas servir de relais a un texte libre. Mika est en copie cachee : sa liste se construit dans sa boite.
- **Consentement** : la case "nouvelles" est facultative et decochee ; cochee, Mika recoit un courriel separe (modele de CONTACT). Seuls ceux-la peuvent recevoir autre chose que les liens.
- **Don : un lien configurable** (`donateUrl`), recommande Ko-fi (0 % de commission sur les dons). Jamais obligatoire : sous le formulaire, apres l'envoi, dans le courriel et sur `/download/`.
- **Zips stables** : les releases `mm-rytm-latest` et `mm-arp-latest` sont ecrasees par chaque build de chantier (n'importe quelle branche). Le public telecharge `mm-rytm-public` et `mm-arp-public`, remplies a la main par le workflow `plugin-public.yml` (le build valide par Mika, README public a la place du guide perso).
- **Cache jusqu'a la configuration** : sans `emailjsTemplateId` dans `public/data/vst.json`, rien ne change en ligne (apercu : `/goodies/?vst=1`).

## Verifie

- `npm run build` (99 pages, `/download/` hors sitemap, noindex), `npm run firmware:check`.
- Chromium headless muet : bloc cache par defaut sur `/goodies/` ; composant configure (vst.json et EmailJS interceptes, aucun vrai courriel) : 1 envoi `{ to_email }` au modele VST, 1 envoi au modele CONTACT si la case est cochee, etat "Sent", bouton de don, chemin d'erreur ; telephone 390 px sans defilement horizontal ; `/download/?p=rytm` : un seul depart automatique du zip (pas au rechargement), commande d'installation au nom du plugin, don visible.

## Reste a faire (Mika)

Voir `docs/vst-download.md` : creer le modele EmailJS, la page Ko-fi, lancer `Plugin public` pour `rytm` et `arp`, envoyer le Template ID et le lien de don.
