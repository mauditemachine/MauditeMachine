# Audit de la prod contre les demandes de la session (2026-10-05)

Question de Mika : « Je voudrais savoir si tu avais oublié des choses parce que je t'ai dit pas mal de trucs que je ne vois pas en prod. »

## 1. Ce qui a été fait

- Relu les 69 demandes de la session (lots 1 à 9, du 2026-10-04 au 2026-10-05) et mes réponses de fin de lot.
- Vérifié le site en prod (https://mauditemachine.com, commit 2cf26a0, déploiement Pages n° 635 terminé à 05:01:27 UTC, soit 1 h 01 à Montréal) avec Playwright, son coupé, aucune lecture :
  - desktop 1440x900 et iPhone 390x844, les 4 machines (?m=mm808, voy, smpl, dj) ;
  - DOM (en-tête, logotype, flèches, boutons), jumeaux accessibles et hotspots de chaque machine ;
  - captures iPhone : MM-SMPL debout, deck A, mixer en une vue (potards VOLUME, effets en 2 rangées, FX TO, RYTM + ARP, ADD DECK, LOOP > SMPL), flèches gauche/droite, plus d'onglet MIXER ni de touches AUTO/EDIT.
- Aucun changement de code.

## 2. Décisions prises et pourquoi

- Tout ce qui a été codé pendant la session est en prod. Le lot 9 n'est arrivé en ligne qu'une minute avant la question de Mika, et GitHub Pages laisse le navigateur garder la page 10 minutes (cache-control max-age=600) : une page ouverte juste après le push montre encore l'ancienne version.
- Deux demandes ne sont pas en prod :
  - les 10 samples BD/SD de Mika (lot 7) : le sélecteur est prêt, mais les fichiers sont sur son Mac, hors de portée de la session cloud ; public/samples/rytm n'existe pas dans le dépôt ;
  - « image 1 : je voudrais un peu plus de... » (lot 7) : phrase coupée, question posée, sans réponse, rien de fait.
- Deux demandes ont été faites autrement que la lettre :
  - EDIT au téléphone (lot 8) : sur desktop le contenu s'ouvre dans la machine ; au téléphone il s'ouvre encore dans un panneau sous la machine (seulement par le bouton EDIT de la machine depuis le lot 9) ;
  - glisser sur les DECKS au téléphone (lot 9) : les flèches sont là, mais un glisser qui commence sur une touche l'appuie encore (les touches partent au toucher, pour que CUE réponde sans délai).

## 3. Ce qui reste à faire / points en suspens

- Côté Mika :
  - samples : soit déposer les 10 WAV dans la conversation (je les publie), soit lancer la commande du rapport 2026-10-05-midi-samples-adddeck.md puis pousser ; vérifier la licence des packs (fichiers publics) ;
  - finir la phrase « image 1 : je voudrais un peu plus de... » ;
  - après un rechargement forcé (Cmd+Maj+R sur Mac ; sur iPhone, fermer l'onglet ou l'app de l'écran d'accueil puis la rouvrir), dire ce qui manque encore, et sur quel appareil (téléphone tenu droit ou couché, iPad, Mac).
- À décider : EDIT dans la machine au téléphone aussi ; touches des DECKS qui partent au relâcher au téléphone (sauf CUE, BEND, PITCH +/-) pour qu'un glisser n'appuie plus rien ; date de la version affichée dans le MENU.

## 4. Commandes utiles ajoutées

- Aucune.
