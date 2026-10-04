# MM-DECKS : dossiers et playlists qui tiennent (2026-10-04)

Mika : « Faut vraiment faire fonctionner les playlists et les dossiers ! ça
me saoule de devoir refaire le mapping à chaque fois ! »

## Ce qui n'allait pas

- Un dossier relié (Chrome, Edge) gardait son accès, mais n'était jamais
  relu : les morceaux ajoutés sur le disque n'apparaissaient pas sans le
  relier de nouveau.
- Ses sous-dossiers étaient aplatis en un seul dossier.
- L'accès se redemandait à chaque visite, au premier morceau chargé, sans
  rien dire.
- Ailleurs que sur Chrome, « this visit only » obligeait à redéposer le
  dossier à chaque visite.
- Il n'y avait pas de playlists.

## Ce qui change

- Sous-dossiers : chaque morceau garde son chemin (« Musique/Techno/Peak »).
  FILES se parcourt comme un CDJ : les sous-dossiers d'abord, puis les
  morceaux du dossier ouvert, avec le chemin pour remonter (ALL FOLDERS /
  Musique / Techno). La recherche porte sur tous les fichiers. Le dossier
  ouvert est retenu. REMOVE retire un dossier et ses sous-dossiers.
- Les dossiers reliés se relisent seuls à chaque visite : ce qui est ajouté
  sur le disque entre, ce qui en part sort. On ne relie qu'une fois.
- Si l'accès s'est perdu, un bandeau propose RECONNECT, en un clic, et
  conseille « Autoriser à chaque visite » pour que Chrome ne le redemande
  plus.
- Ailleurs que sur Chrome, KEEP ON THIS DEVICE (copie gardée) est mis en
  avant ; « this visit only » passe en discret.
- Playlists : un onglet PLAYLISTS, + NEW, RENAME, DELETE (confirmé). Un « + »
  sur chaque morceau de n'importe quelle source (MAUDITE, SOUNDCLOUD, MY SC,
  FILES) le range dans une playlist, ou en crée une. Dans une playlist,
  chaque morceau monte, descend ou sort. Les playlists sont gardées sur
  l'appareil, avec ce qu'il faut pour retrouver et afficher les morceaux
  (jamais le son). Un fichier retiré de FILES s'y affiche comme parti.
- La base passe en version 2 (magasin « lists ») ; la caisse existante est
  gardée.

## Vérifié (son coupé)

- Un dossier relié de test (stockage privé du navigateur, une vraie poignée
  de dossier) : cinq morceaux sur trois niveaux, chemins justes. Un fichier
  ajouté sur le disque entre à la relecture, un fichier retiré en sort.
- FILES : ALL FOLDERS, puis MyMusic (House/, Techno/, Intro Loose), puis
  Techno (Peak/, Acid Line).
- Playlists : création depuis « + », ajout d'un deuxième morceau, ordre
  inversé, renommage, retrait. Après rechargement : playlist, onglet et
  dossier retrouvés, dossier relu seul, morceau chargé depuis la playlist.
- tsc (dj sans erreur nouvelle) et vite build.
