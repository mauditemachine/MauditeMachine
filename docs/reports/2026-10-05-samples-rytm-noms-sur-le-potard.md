# Samples du MM-RYTM : les noms sur le potard, la fenêtre « Samples on this device » retirée (2026-10-05)

Demande de Mika : « je voudrais que tu mettes ces samples dans le sélecteur de samples (BD : BluePrint, VNTM, Engelhardt, Carassi, Stein, AFFKT ; SD : Psy 02, Psy 12, Psy 26, SD A 707), dans le knob, avec les noms genre Engelhardt, Carassi, Stein. Pareil pour SD, et enlève-moi la fenêtre Samples on this device ! »

## 1. Ce qui a été fait

- **La fenêtre « Samples on this device » est retirée** : `src/v4/ui/RytmSamples.tsx` et `src/v4/audio/usersamples.ts` supprimés, leur CSS (`src/v4/v4.css`) et leur montage (`src/v4/index.tsx`) aussi ; `src/v4/audio/samples.ts` et `src/v4/audio/kit.ts` ne connaissent plus que les fichiers du site. Ce que l'ancien panneau avait gardé dans ton navigateur est effacé au chargement.
- **Les noms sur le potard** :
  - `src/v4/audio/kit.ts` (`kitStepLabels`) : chaque cran écrit le nom de son échantillon (jusqu'à huit par voix ; au-delà, les numéros comme avant) ;
  - `src/v4/scene/tweakplate.ts` : un choix de plus de cinq crans aux noms longs écrit chaque nom dans le sens du rayon, à partir de son repère (la moitié gauche retournée pour qu'aucun nom ne se lise à l'envers), le nom du potard remonte au-dessus. Même rendu au téléphone.
- **Le script d'import** `scripts/import-rytm-samples.mjs` (`npm run samples:import`) : copie tes dix fichiers depuis ton Mac vers `public/samples/rytm/bd` et `sd`, sous des noms propres qui donnent l'ordre des crans.
- `docs/v4/spec.md` : R14-178.

## 2. Décisions prises et pourquoi

- **Les fichiers ne sont pas dans cette livraison.** Ils sont dans ton iCloud Drive, pas dans le dépôt, et cette session tourne dans le cloud : je ne peux pas les lire (je les ai aussi cherchés dans ton Google Drive : absents). Le script les range à ta place, en une commande.
- **Noms radiaux plutôt que horizontaux.** Neuf noms horizontaux autour d'un potard de cette taille se chevauchent ; dans le sens du rayon, les noms longs (ENGELHARDT, BLUEPRINT) partent vers le haut où il y a de la place, les courts (STEIN, AFFKT) vers les côtés.
- **L'ordre des crans est celui de ta liste** : BluePrint, VNTM, Engelhardt, Carassi, Stein, AFFKT ; Psy 02, 12, 26, 707 (le numéro devant le nom du fichier, `01 BluePrint.wav`, fixe l'ordre).
- **La note des kicks (F, G, G#) n'est pas affichée** : TUNE se règle en demi-tons.
- **Plus de fichiers de l'appareil.** Tu m'as demandé d'enlever la fenêtre ; sans elle, ces fichiers n'auraient plus eu de moyen d'être retirés. Un échantillon vient désormais du dossier du site seulement.
- **Vérifié** avec des WAV synthétiques (jamais commités), desktop et téléphone : les noms sont lisibles et ne se touchent pas, le choix charge l'échantillon et l'écran lit `KICK CARASSI`. tsc inchangé (15 erreurs d'avant).

## 3. Ce qui reste à faire / points en suspens

- **Côté Mika : mettre les fichiers dans le dépôt** (sur ton Mac, dans le dossier du projet) :
  `git pull && npm run samples:import -- "/Users/mauditemachine/Desktop/Samples" && git add public/samples && git commit -m "Samples de Mika dans MM-RYTM" && git push`
  Le script retrouve chaque fichier par son nom dans tout le dossier donné (à plat ou en sous-dossiers, un nom légèrement changé passe par son mot-clé). Le déploiement prend environ une minute.
- **Autre voie** : déposer les dix fichiers dans un dossier de ton Google Drive et me donner son nom, je les récupère par le connecteur Drive (plus lourd).
- **Licence** : les préfixes « AT » sont des packs du commerce. Une fois dans `public/`, ces fichiers se téléchargent depuis le site, ce qui est une redistribution. À vérifier dans la licence des packs avant de pousser ; sinon, ne garder que les tiens.
- Toujours en attente : le compteur de visiteurs du MENU (« go » + projet Supabase).

## 4. Commandes utiles ajoutées

- `npm run samples:import -- "<dossier>"` : cherche les échantillons de Mika dans le dossier donné et les range dans `public/samples/rytm/`.
