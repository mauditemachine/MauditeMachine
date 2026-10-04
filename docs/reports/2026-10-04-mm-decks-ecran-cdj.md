# MM-DECKS : écran façon CDJ, jog à alvéoles, plus de crossfader, téléphone (2026-10-04)

Retours de Mika transmis par la session Maudite Machine.

## Ce qui change

- Plus de crossfader : il disparaît de la 3D, du moteur (toutes les voies
  passent entières), des jumeaux et du clavier. Les faders de voie
  s'allongent jusqu'au bas de la table. La touche PLAYLIST et la liste
  commune du bas disparaissent aussi.
- Écran façon CDJ : il occupe la moitié haute de la platine (5.6 sur 4.9).
  Une platine vide montre sa liste de morceaux : sources MAUDITE,
  SOUNDCLOUD, MY SC et FILES, recherche, dossiers, + FILES et + FOLDER,
  dépôt de fichiers, connexion SoundCloud, KEYS. Toucher un morceau le pose
  sur cette platine, sans touches A et B, et l'écran revient au morceau,
  avec des textes nettement plus gros et une forme d'onde fine haute.
  Toucher l'écran (E et I au clavier) rouvre la liste, DONE ou Échap la
  ferme.
- La liste est une page HTML posée exactement sur l'écran 3D par une
  homographie (matrix3d, quatre coins projetés à chaque vue), découpée au
  cadre du canvas. Le texte reste net, et la liste défile au doigt et à la
  molette.
- Jog : une couronne sombre percée de 18 alvéoles rondes en creux. Le fond
  des alvéoles est plus sombre, la lumière y coule en dégradé. SYNC reste
  au centre, sur un socle d'aluminium sombre. Plus d'anneau de LED à
  tirets.
- CUE prend l'orange des potards FILTER, avec CUE gravé en lettres sombres.
  PLAY / PAUSE reste en aluminium, avec ▶ ❚❚ gravé. La collerette s'allume
  comme avant.
- Téléphone : une platine tient en entier dans l'écran en portrait. La
  table se voit en deux vues (trois à cinq ou six voies) de la largeur
  d'une platine, collées à ses bords : les potards et les faders sont plus
  gros.

## Vérifié (son coupé)

- Ordinateur, sombre : liste dans chaque écran ; clic réel sur un morceau,
  il part sur A et l'écran affiche le morceau ; tape réelle sur l'écran, la
  liste revient. Avec trois platines, les trois listes sont bien posées et
  les 81 jumeaux sont dimensionnés.
- Téléphone, sombre et clair : platine entière, liste lisible, jog à
  alvéoles, CUE orange, PLAY métal ; vues de la table.
- Aucun défilement horizontal ; tsc (dj sans erreur nouvelle) et vite build.
