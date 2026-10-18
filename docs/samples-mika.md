# Les samples de tes projets Ableton dans MM-RYTM

Ce que tu as demandé (deux fois) : dans chaque voix du MM-RYTM, un choix d'environ 20 samples tirés de ton dossier `shots` (`User Library/Samples/shots` dans iCloud Drive), les plus utilisés dans tes projets Ableton Live, rangés selon les dossiers ; et 10 kicks de plus parmi tes meilleurs BD, dans SOUND. Puis : « je veux voir les samples dans l'app ».

Ton dossier `shots` et tes projets ne sont que sur ton Mac : tout se passe donc chez toi, de deux façons au choix. Les deux font exactement la même analyse et publient de la même façon (ajout, jamais de remplacement, puis commit et push).

- **Dans l'admin, page Samples** : tu vois chaque voix, tu écoutes, tu coches ce que tu veux, tu publies.
- **Dans le Terminal, une commande** : elle publie toute seule le choix automatique.

## Dans l'admin : voir, écouter, choisir

1. Dans le Terminal, dans le dossier du site :
   ```
   git pull --ff-only && npm run admin
   ```
   Si `npm run admin` tournait déjà avant le `git pull`, arrête-le avec Ctrl+C et relance-le : le serveur doit connaître la nouvelle page.
2. Le navigateur s'ouvre sur l'admin. Clique sur **Samples** dans le menu de gauche (ou va directement sur `http://localhost:5173/mm-admin/samples`).
3. L'analyse démarre toute seule : elle lit tes projets sur ce Mac (rien n'est modifié). Une barre montre où elle en est. Le bouton **Re-analyser** la refait (après avoir ajouté des samples dans `shots`, par exemple).
4. En haut : si le dossier `shots` est trouvé, combien de projets ont été lus, combien sont restés dans iCloud (pas téléchargés, donc pas lus), et combien de samples tu as choisis.
5. Ensuite les huit voix, dans l'ordre des pads : BD (kick), SD (snare), CH (charley fermé), OH (charley ouvert), CP (clap), TOM (tom grave), HT (tom aigu et percus), CY (cymbale). Pour chacune :
   - **Sur le site** : les samples déjà en ligne, avec leur numéro et leur nom sur le potard. Le bouton rond les fait écouter.
   - **Dans tes projets** : tous les samples de `shots` rangés dans cette voix, du plus joué au moins joué (le nombre de projets différents, puis le nombre d'utilisations ; « jamais utilisé » en dernier). Pour chacun : son rang, son nom sur le site, son dossier, et des étiquettes : « choix auto », « déjà sur le site », « AIFF → WAV » (converti pour Chrome et Firefox), « pas téléchargé d'iCloud », « illisible » (vide, ou pas vraiment de l'audio), « même son que le n° … ».
   - Le **choix automatique** (celui de `npm run samples:mika` : jusqu'à 20 par voix, BD : 10 kicks de plus) est **coché d'avance**. Coche ou décoche ce que tu veux ; « Choix auto » et « Aucun » remettent la voix d'un coup.
   - Le compteur **20 / 20** : ce qui sera sur le site après la publication, sur la cible de la voix (40 au plus par voix).
6. **Écouter** : un clic sur le bouton rond joue le sample, un autre clic l'arrête ; un clic sur un autre coupe le précédent. Rien ne joue tout seul.
7. **Publier la sélection (N)** : une fenêtre te montre ce qui va s'ajouter, voix par voix ; « Publier » confirme. C'est la même mise en ligne que la commande : les samples choisis s'ajoutent après les numéros déjà là (rien n'est retiré ni renuméroté), puis un commit (« samples de Mika choisis dans l'admin ») et `git push`. Le site se met à jour en 1 à 2 minutes. La page peut se recharger toute seule pendant la publication (les nouveaux samples arrivent) : c'est normal, le résultat s'affiche quand même.
8. **Le résultat** : pour chaque voix, avant → après et les noms ajoutés, le numéro du commit, et la ligne pour annuler.
9. **Si c'est refusé**, rien n'a changé et la page dit pourquoi et quoi faire (les mêmes refus que la commande, voir plus bas). Si `public/samples/rytm` a des changements (un ancien import), un bouton **« Remettre comme en ligne, puis publier ma sélection »** fait la même chose que `--reset-samples` : les fichiers modifiés ou en trop sont d'abord sauvegardés dans `.admin-backups/`.

Depuis ton téléphone : lance `npm run admin -- --lan` (avec un mot de passe, voir `ADMIN_README.md`), puis ouvre l'adresse de ton Mac sur le port 5173, `/mm-admin/samples`. La page tient sur un écran de téléphone.

En ligne (`mauditemachine.com/mm-admin/samples`), il n'y a pas de serveur : la page montre seulement les samples du site, voix par voix, et rappelle de lancer `npm run admin` sur ton Mac pour voir ceux de tes projets.

## Dans le Terminal : la ligne à coller

Dans le Terminal, dans le dossier du site (celui où tu lances `npm run admin`) :

```
git pull --ff-only && npm run samples:mika
```

Le `git pull` du début récupère la commande elle-même. Il n'y a rien à installer : il faut Node 18 ou plus, déjà là pour `npm run admin`.

## Ce que fait la commande

1. **Elle vérifie que le dépôt est prêt, sans rien toucher.** Elle refuse et te dit quoi faire :
   - s'il y a des fichiers déjà préparés pour un commit (`git add`) ;
   - si `public/samples/rytm` a des changements pas commités (un ancien import) ;
   - si tu as des commits pas encore poussés ;
   - si `git pull --ff-only` échoue.
2. **Elle lit tous tes projets** (`.als`) dans `~/Music/Ableton`, `~/Music`, `~/Documents`, `~/Desktop` et iCloud Drive. Les dossiers Backup sont ignorés, le dossier du site aussi. Un projet resté dans iCloud (pas téléchargé sur ce Mac) n'est pas lu, pour ne pas tout télécharger : elle te dit combien.
3. **Elle classe les samples de `shots` par voix** d'après leurs dossiers : Kicks, BD, Grosse caisse ; Snares, Caisse claire ; Hats, Charley ; Open Hats, Charley ouvert ; Claps ; Toms ; Percs, Percus, Rim, Shaker ; Cymbales, Crash, Ride. Elle les trie ensuite du plus joué au moins joué : d'abord le nombre de projets différents, puis le nombre d'utilisations.
4. **Elle affiche le plan**, voix par voix.
5. **Elle ajoute, elle ne remplace jamais.** Ce qui est déjà en ligne reste avec son numéro : BluePrint reste le kit par défaut et les presets d'usine gardent leurs sons. Chaque voix est complétée jusqu'à 20 samples en tout. Pour BD, c'est 10 kicks de plus que les 12 d'avant, donc 22. Un sample déjà sur le site (même contenu, même sous un autre nom) est sauté. Si une voix n'a pas assez de samples joués, les jamais joués de ses dossiers complètent.
   - **Les AIFF** (`.aif`, `.aiff`) : Safari les lit, Chrome et Firefox non. Elle les convertit en WAV (avec `afconvert`, déjà sur ton Mac) : ils arrivent sur le site en `.wav`.
   - **Un fichier vide, ou qui n'est pas vraiment de l'audio** (juste l'extension) : il est sauté et le suivant prend sa place. Pas de cran muet sur le potard.
6. **Un sample retenu pas encore téléchargé d'iCloud ?** Elle le dit et n'écrit rien. Télécharge-le dans le Finder (clic droit sur le dossier `shots`, « Télécharger maintenant »), puis relance la même ligne.
7. **Elle met en ligne.** Elle fait `git add` des seuls nouveaux samples (et de la liste `public/samples/rytm/ableton-picks.json`), un commit qui donne le compte par voix, puis `git push`. GitHub met le site à jour en 1 à 2 minutes.
8. **Elle finit par un résumé** : pour chaque voix, avant et après, les noms ajoutés, et la ligne pour annuler.

Relancer la commande ne rajoute rien tant que les voix sont à leur cible : la liste `ableton-picks.json` se souvient de ce qu'elle a déjà ajouté.

## Annuler

- **Après la mise en ligne**, la commande t'a donné la ligne exacte :
  ```
  git revert --no-edit <numero du commit> && git push
  ```
  Les nouveaux samples repartent, rien d'autre ne bouge.
- **Si elle s'est arrêtée avant le commit** :
  ```
  git restore public/samples/rytm && git clean -f public/samples/rytm
  ```
- **Si elle refuse parce que `public/samples/rytm` a des changements** (un ancien import), colle :
  ```
  npm run samples:mika -- --reset-samples
  ```
  Le dossier revient comme en ligne. Avant, les fichiers modifiés ici et ceux en trop sont sauvegardés dans `.admin-backups/rytm-<date>` du dossier du site (git l'ignore, rien ne part en ligne, et macOS ne le vide pas) : rien n'est perdu. La commande te redonne ce chemin à la fin. Si elle s'arrête ensuite (par exemple un `git pull` qui refuse), elle te dit que seul `public/samples/rytm` a été remis comme en ligne.

## Options (rarement utiles)

- `npm run samples:mika -- --per 25` : 25 samples par voix au lieu de 20.
- `--bd-new 10` : le nombre de kicks de plus que ceux d'avant.
- `--families bd,sd` : seulement ces voix.
- `--shots "/autre/dossier"` et `--projects "/autre/dossier"` : d'autres emplacements.
- `--map "Mon Dossier=ch"` : range un dossier dans une voix (ou `skip` pour l'écarter).
- `npm run samples:ableton -- --dry` : le plan seul, rien n'est écrit.

Les scripts : `scripts/ableton-samples.mjs` (l'analyse et la mise en ligne, pour la commande et pour l'admin : ses fonctions `scan` et `publish`), `scripts/import-rytm-samples.mjs` (la copie dans `public/samples/rytm`, avec des noms que git voit toujours), `scripts/rytm-samples-lib.mjs` (ce qu'ils partagent) et `scripts/admin-samples-api.mjs` (les routes de `server.js` pour la page Samples : l'analyse, l'écoute, la publication ; toutes derrière le mot de passe de l'admin, et le navigateur n'envoie jamais un chemin, seulement des identifiants).
