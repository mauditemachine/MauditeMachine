# 2026-10-04 : MM-ARP oscillateurs facon Mini V, MM-DECKS dossiers d'une visite passee, logotype, TWEAKS lisibles, LOOP fusionne

## 1. Ce qui a ete fait

- MM-DECKS (src/v4/dj/TrackBrowser.tsx, dj.css) : un morceau d'une visite passee se touche ; on choisit son dossier de nouveau, il part sur la platine, et le dossier reste sur l'appareil (relie sur Chrome et Edge, copie ailleurs).
- MM-DECKS (src/v4/dj/theme.ts, silk.ts) : le logotype des platines, plus petit et remonte, reste entier au-dessus du grand ecran.
- TWEAKS (src/v4/voyager/theme.ts, tweaks.ts) : potards plus gros, titres et bouts de course plus grands, plaque un peu plus grande.
- MM-ARP, oscillateurs facon Mini V :
  - src/v4/voyager/params.ts : RANGE, SEMI, FINE, ON par oscillateur ; migrateKnobs ;
  - src/v4/audio/moog.worklet.js : tune1, tune2, fine1, fine2, on1, on2 ;
  - src/v4/voyager/theme.ts : nouvelle disposition desktop et telephone, echelles, onglets, LED ;
  - src/v4/voyager/knobs.ts : capuchons chromes ;
  - src/v4/voyager/silk.ts : echelles RANGE, SEMI, FINE, onglets 1 et 2, LED de ON ;
  - src/v4/voyager/rig.ts : LED synchronisees ;
  - src/v4/voyager/random.ts et src/v4/state/presets.ts : conversions.
- MM-DECKS LOOP de Sonaa (7af8254) : relu et fusionne en avance rapide.
- docs/v4/spec.md : R14-92 a R14-94.

## 2. Decisions prises et pourquoi

- Les morceaux d'une visite passee venaient de THIS VISIT ONLY, ou d'un navigateur sans lien de dossier (Safari, Firefox, Brave par defaut) ; seul un nouveau choix du dossier peut rendre les fichiers. Au retour du dossier, on le garde sur l'appareil sans redemander.
- Oscillateurs : RANGE et SEMI remplacent TUNE 2, deux FINE remplacent l'ecart unique. Les valeurs de depart redonnent le son d'avant, les reglages et presets d'avant se convertissent.
- ON est un commutateur et une LED, sans OFF/ON ecrits : il n'y avait plus la place a desktop.
- Telephone : pas de crochet OSCILLATORS, les onglets 1 et 2 le disent ; la place sert aux rangees d'enveloppes.

## 3. Ce qui reste a faire / points en suspens

- Mika : essayer RANGE et SEMI sur une basse, et ON pour isoler un oscillateur.
- Mika : sur Brave, activer brave://flags/#file-system-access-api pour que + FOLDER relie les dossiers une fois pour toutes.
- Mika (toujours) : secrets SoundCloud du worker Sonaa, defilement de la playlist au doigt sur iPhone, equilibre RYTM / ARP.

## 4. Commandes utiles ajoutees

- Aucune.
