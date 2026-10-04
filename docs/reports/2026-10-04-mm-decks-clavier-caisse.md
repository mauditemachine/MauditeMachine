# 2026-10-04 : MM-DECKS, clavier et memoire des fichiers

## 1. Ce qui a ete fait

- La caisse : les fichiers de MY FILES sont gardes d'une visite a l'autre dans le navigateur (IndexedDB `mm-dj-crate`), ranges par dossier, sur cet appareil seulement (`dj/crate.ts`).
- Trois facons d'entrer : copie (Safari, Firefox, iPhone), dossier relie sans copie (Chrome, Edge : + FOLDER ou un dossier lache), ou pour la visite (trop gros : seuls les noms, BPM et cues restent) ; avant un import de plusieurs fichiers, le poids, la place restante et un nom de dossier (`dj/TrackBrowser.tsx`).
- Dossiers en pastilles (ALL, chaque dossier, LOOSE), retrait d'un dossier en deux temps, lignes grisees quand un dossier relie pour la visite doit etre rajoute ; l'onglet et le dossier ouverts sont retenus.
- Duree et BPM calcules en fond, un morceau a la fois, jamais pendant qu'une platine joue ; une platine qui charge un morceau les donne a la caisse (`crateLearn`).
- Clavier : touches physiques (QWERTY et AZERTY au meme endroit), main gauche DECK A, main droite DECK B, Espace, crossfader aux fleches, zoom avec - et =, legende sous KEYS (`dj/keys.ts`).
- Jumeaux HTML des 59 commandes (touches, potards, faders) : Tab, fleches, Maj, Page, Debut, Fin, Suppr pour la valeur neutre, Entree ou Espace ; lecteurs d'ecran (`dj/Twins.tsx`, monte a part dans `index.tsx`).

## 2. Decisions prises et pourquoi

- La caisse de Sonaa reprise telle quelle dans son principe (ADR-099 de Sonaa) : rien n'est envoye, et un dossier de 1 800 morceaux entre en quelques secondes (tags seulement), les BPM arrivent ensuite.
- e.code plutot que e.key : la meme place sous les doigts quel que soit le clavier, comme sur un controleur.
- L'ecoute du clavier passe en phase de capture : les chiffres ouvrent les hot cues sur le MM-DECKS au lieu des pages du site ; un jumeau qui a le focus garde ses fleches.
- Les jumeaux des jogs et des ecrans ne sont pas faits : le clavier a deja BEND, le zoom et la recherche par les raccourcis.

## 3. Ce qui reste a faire / points en suspens

- Mika : essayer avec un vrai dossier (Chrome sur le Mac : + FOLDER ; iPhone : + FILES depuis Fichiers), recharger la page, verifier que tout est la.
- La caisse de Sonaa (`sonaa-caisse`) n'est pas reprise : elle vit sur un autre domaine, le navigateur ne la partage pas.

## 4. Commandes utiles ajoutees

- Aucune. Debug : `indexedDB.databases()`, `__v4.dj.state.get()`.
