# Samples du MM-RYTM : aucun nom que .gitignore cacherait (2026-10-18)

Demande : `.gitignore` écarte `* 2.*` et `* 3.*` (les doubles iCloud, « fichier 2.wav »), et `scripts/import-rytm-samples.mjs` pouvait fabriquer des noms qui tombent dessous (le doublon « Foo 2.wav », « OT_Kick3.wav » devenu « 09 OT 3.wav », jamais vu par git). Aucun nom généré ne doit correspondre à `/ [23]\.[^.]+$/`.

## 1. Ce qui a été fait

- **Constat** : le gros du correctif était déjà sur main (commit 979dbb9, chantier S2) : `safeStem` colle le chiffre seul au mot d'avant (OT 3 : OT3), `suffixed` numérote un doublon sans espace (Stein2, OT3-2), `gitSafe` donne le sigle de la famille à un nom fait d'un seul numéro (Kick 3 : BD3), `git check-ignore` refuse d'écrire si un seul nouveau nom serait ignoré, et `git status` après l'écriture retire tout si git ne voit pas un fichier.
- **Défaut restant corrigé** dans `scripts/rytm-samples-lib.mjs` (`safeStem`) : après un nombre, le chiffre se collait aussi (909 Kick 3 donnait « 9093 », 808 Kick 2 « 8082 », X 3 3 « X 33 », Hit 3.1 « Hit 31 ») : un autre nombre à la plaque. Il est maintenant joint par un tiret : 909-3, X 3-3, Hit 3-1. Les noms après une lettre ne changent pas (OT3, Deep2).
- Commentaires mis à jour dans `scripts/import-rytm-samples.mjs` (en-tête, `gitSafe`).
- `sampleLabel` : inchangé, la copie du script et `src/v4/audio/samples.ts` sont identiques (vérifié par diff).

## 2. Décisions prises et pourquoi

- **Garder l'approche en place** plutôt qu'un autre séparateur pour tous les doublons : elle donne déjà des noms courts (Stein2) et un tiret seulement quand un chiffre précède (OT3-2), et aucun fichier existant du site ne change de nom.
- **Le tiret après un nombre**, pas un collage : « 9093 » se lit comme un autre nombre, « 909-3 » garde 909. Aucun fichier déjà sur le site n'est concerné (la règle ne joue que pour les imports à venir).
- **Vérifié** (WAV synthétiques dans le scratchpad, jamais commités, aucune lecture audio) :
  - le dry run demandé (OT_Kick3.wav, Foo Kick / Foo_Kick / Foo - Kick qui se nettoient pareil, Kick 3, OT Kick 3, Bar Kick 2 F/G...) : OT3, OT3-2, Foo, Foo2, Foo3, BD3, Deep2, Deep2-2 ; aucun nom en « 2. » ou « 3. », en ajout comme en `--replace` ;
  - un fuzz de 400 noms sur les 8 familles (chiffres seuls, tonalités, crochets, accents, artistes, doublons) : 0 nom qui correspond au motif, et `git check-ignore` sur les 400 n'en ignore aucun ;
  - un vrai import (sans `--dry`) : « git voit les 11 nouveaux fichiers », puis annulé avec `git clean` ;
  - `gitIgnored` signale bien « 09 OT 3.wav » (`.gitignore:9`) et « 13 Foo 2.wav » (`.gitignore:8`).

## 3. Ce qui reste à faire / points en suspens

- Rien côté Mika : la prochaine `npm run samples:mika` ou `npm run samples:import` profite de la règle.
- Pas de suite de tests automatique pour ce script (le dépôt n'en a pas pour `scripts/`) : le fuzz est resté dans le scratchpad de la session.

## 4. Commandes utiles ajoutées

- Aucune nouvelle commande. Pour vérifier un dossier avant import : `npm run samples:import -- "<dossier>" --dry` (sort en code 2 et liste « GIT LES IGNORERAIT » si un nom tombait sous `.gitignore`).
