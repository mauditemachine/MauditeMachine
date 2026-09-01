# Rapport de session — Event Soirée Versatile + fusion Live

Date : 2026-09-01
Mission : ajouter l'événement Facebook
facebook.com/events/1013294418404343 aux dates à venir.

## Ce qui a été fait

- **Infos extraites de Facebook** (curl m.facebook.com, la version
  desktop répond 400) : « Soirée Versatile », vendredi 16 octobre 2026,
  Montréal, organisé par Catherine Roch-Yale et Maudite Machine.
  L'affiche n'est pas récupérable (endpoint crawler verrouillé) et la
  salle n'est pas exposée publiquement : entrée sans image, lieu
  « Montréal, QC », le lien FB porte les détails.
- **[events.json](../../public/events.json)** : entrée ajoutée (12
  events). Elle apparaît aussi sur l'archive v1 (/v1/shows) et migrera
  au Wall of Fame une fois passée (mécanique existante).
- **[LiveGigs.tsx](../../src/v2/components/LiveGigs.tsx)** refactorisé
  en DEUX sources fusionnées : events.json (dates futures, la source
  que l'admin édite) + Bandsintown (cache 24 h, vide tant que le profil
  n'existe pas). Lignes normalisées, tri par date, dédup par jour, CTA
  par origine (« Details » pour un event local/FB, « Tickets » pour
  Bandsintown). Le fallback « Next dates coming soon » ne s'affiche
  que si les deux sources sont vides.

## Vérifications faites

- DOM + capture : « 16 OCT 2026 · Soirée Versatile · MONTRÉAL, QC ·
  DETAILS » (lien FB), fallback disparu.
- Build clean ; prod vérifiée après deploy.

## Décisions prises et pourquoi

- **Fusion plutôt qu'entrée en dur** : le prochain event ajouté dans
  l'admin (Événements & boutique) apparaîtra sur la home sans toucher
  au code ; Bandsintown reste branché pour la bascule automatique.
- fmtDate ancré à midi : parser « 2026-10-16 » nu en UTC afficherait
  le 15 dans les fuseaux négatifs (Montréal).

## Ce qui reste à faire / points en suspens

- Mika : préciser la salle dans l'admin quand elle sera annoncée
  (champ location), et remplacer la couleur d'accent par défaut
  (#ff4d6d) si souhaité ; ajouter l'affiche quand disponible.
- Points antérieurs inchangés.

## Commandes utiles ajoutées

Aucune.
