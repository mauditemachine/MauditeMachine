# Rapport de session — Discographie : placeholders et classement

Date : 2026-09-14
Signalé par Mika : des placeholders sans rapport dans la liste, et des
pistes qui ne sont pas dans l'ordre.

## Ce qui a été fait

- **Placeholders retirés** : les trois « AUTOPSYNTH 001/002/003
  (placeholder) » ne correspondaient à aucune sortie réelle, n'avaient
  aucune écoute possible, et étaient en plus marqués `featured: true`,
  donc placés d'office dans la sélection courte. Supprimés.
- **Cause réelle du désordre trouvée** : toutes les pistes reprises de
  Bandcamp portaient l'année **2023 par défaut** (une approximation
  faite lors de l'import initial). À année identique, l'ordre
  d'affichage devenait celui du fichier, donc arbitraire.
- **Vraies dates de sortie récupérées** sur le profil SoundCloud
  (`display_date` de chaque piste, via son permalink déjà mappé) :
  **31 pistes datées précisément**, 4 conservées en date approximative
  faute de source (marquées `dateApprox` dans le fichier). Le
  catalogue remonte en fait à **2012**, pas à 2023.
- **Ordre chronologique** : de la sortie la plus récente à la plus
  ancienne. À l'intérieur d'un album, c'est l'ordre de la tracklist qui
  prime, pas la date de mise en ligne : le **Limbos LP** garde sa
  séquence officielle (Abyss, Cephal, Limbos, Reaper, Nortkele, Muld,
  Simetra, Zenith, Chimie Electrique), datée du 16 octobre 2025
  (Bandcamp).
- **Tri déplacé dans le composant** ([Discography.tsx](../../src/v2/components/Discography.tsx)) :
  une piste ajoutée plus tard depuis l'admin se range automatiquement
  au bon endroit, sans dépendre de l'ordre du fichier.

## Sorties manquantes ajoutées

L'ordre chronologique a fait apparaître un trou en tête de liste :
- **Voodoo** (11 février 2026) : la sortie la plus récente, citée dans
  le press kit (« From Discowriders to Voodoo »), avec son visuel déjà
  présent dans le dépôt. Ajoutée et mise en sélection.
- **Crush on you** (5 janvier 2025). Ajoutée.

## Décisions prises et pourquoi

- **Les deux remixes de Tati Cardi non ajoutés** (Lealtica Remix,
  Digital Committee Remix, tous deux présents sur le profil) : ce sont
  des remixes **de** Maudite Machine par d'autres artistes, alors que
  le filtre « Remixes » du site désigne ses remixes **pour** d'autres.
  À toi de dire où tu veux les voir.
- **Filtre VRSTL masqué** : les trois placeholders étaient les seules
  pistes de cette catégorie. Un filtre sans aucune piste n'est plus
  proposé, sinon il mène à une liste vide.
- **Dates SoundCloud = dates de mise en ligne**, pas toujours les dates
  de sortie officielles (quatre singles de 2014 partagent la même date
  d'upload groupé). C'est nettement plus juste que « 2023 partout »,
  mais corrigeable piste par piste dans le fichier.

## État final

37 pistes (32 originals, 5 remixes), 10 en sélection courte, zéro
placeholder, toutes écoutables sauf 4 sans lien SoundCloud connu
(Digital ep, Montreal Calling, North River, Electrochimie).

## Ce qui reste à faire / points en suspens

- Mika : vérifier les dates des sorties anciennes (2012-2017) et dire
  quoi faire des deux remixes de Tati Cardi.
- Les 4 pistes sans écoute restent affichées avec le bouton play
  désactivé.

## Commandes utiles ajoutées

Aucune.
