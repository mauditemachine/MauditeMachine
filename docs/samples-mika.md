# Les samples de tes projets Ableton dans MM-RYTM : une seule commande

Ce que tu as demandé (deux fois) : dans chaque voix du MM-RYTM, un choix d'environ 20 samples tirés de ton dossier `shots` (`User Library/Samples/shots` dans iCloud Drive), les plus utilisés dans tes projets Ableton Live, rangés selon les dossiers ; et 10 kicks de plus parmi tes meilleurs BD, dans SOUND.

Ton dossier `shots` et tes projets ne sont que sur ton Mac : la commande tourne donc chez toi.

## La ligne à coller

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

Les scripts : `scripts/ableton-samples.mjs` (l'analyse et la mise en ligne), `scripts/import-rytm-samples.mjs` (la copie dans `public/samples/rytm`, avec des noms que git voit toujours) et `scripts/rytm-samples-lib.mjs` (ce qu'ils partagent).
