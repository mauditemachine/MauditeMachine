# 2026-10-27 : MM-RYTM au téléphone, plan UX (à valider)

Demande de Mika : au téléphone, la MÊME façon de travailler qu'au desktop (même modèle mental, même workflow, mêmes raccourcis conceptuels), mais pensée pour le petit écran tactile, excellente et addictive.

Statut : plan seulement, aucune ligne de code. À itérer avec Mika avant la phase 1.

## 1. Ce qui a été fait

- `git pull` : avance rapide de 538 commits jusqu'à 83c8e599 (V.4.2), sans conflit.
- Reconnaissance : rapports 2026-10-01-mobile, 2026-10-02-mobile-close-knobs-sheet, 2026-10-05-roto-mixer-mobile-arp-mobile, 2026-10-09-mobile-menu-roto-ecran-editeur, 2026-10-27-rytm-v4-phase1/phase2/v42-*, et la spec `docs/v4/spec.md` (R14-235, R14-236, MUTE au double tap, MASTER/TEMPO dans l'écran).
- Ce plan.

## 2. État actuel du téléphone (constats)

1. **Le téléphone est gelé avant la V.4.** Depuis la phase 1, chaque changement passe par `PORTRAIT` et le téléphone est contrôlé « identique au pixel » à 1f34a17. Sa refonte était prévue en « phase 5 », jamais faite. Les deux versions ont donc divergé.
2. **Ce qui manque au téléphone** : la vue TRK, SCENE A et B, le crossfader (un pattern avec des scènes y joue à x 0), les potards A à H qui suivent la page (au téléphone ce sont les FX globaux), les noms sous les potards, les cartes d'aide de la vue d'ensemble (au survol).
3. **Deux modèles opposés pour l'écran** : au desktop l'écran est intouchable (`SCREEN_TOUCH` faux), on agit par les potards A à H ; au téléphone l'écran est l'éditeur (glisser, double tap, deux doigts). Même machine, deux gestes mentaux différents.
4. **Ce qui marche déjà au doigt** : un doigt ne tourne plus la vue (deux doigts tournent et pincent) ; pas : tap ON/MID/LOW/OFF, tenir et glisser = vélocité, tenir immobile = P-LOCK ; double tap sur une voix = MUTE ; MASTER et TEMPO glissés dans l'en-tête de l'écran ; Dock repliable (voix, 16 pas, transport) ; flèches entre machines ; CLOSE en HTML sur la carte ouverte ; UNDO dans l'en-tête mobile.
5. **Ce qui dépend du clavier ou du survol** : A S D F / Z X C V (voix), M, Espace, Suppr (retirer un sample : aucun chemin au doigt), Cmd+Z (l'UNDO mobile existe), les anneaux et l'aide au survol, `+ LOAD A FILE...` (glisser-déposer seulement).
6. **Pas de retour haptique** repéré ; les gestes n'ont presque jamais été validés sur un vrai téléphone (événements simulés, CDP multi-touch).
7. **Cibles serrées** par endroits : pas du BASS à 40,5 px, zone MASTER à 28 x 20 px corrigée en 48 px ; la machine entière doit tenir en 390 x 844 sans défiler.

### Complément : cartographie du code (après rédaction)

- **Le téléphone est décidé au chargement** (`theme.ts:33-45`, `PORTRAIT` = `max-width: 767px`, forçable par `?portrait=1`) : c'est une autre machine, pas une version responsive. `FACE_FOLLOWS_PAGE=!PORTRAIT`, `BLOCKS_ARE_KNOBS=PORTRAIT`, `SCREEN_TOUCH=PORTRAIT` (`theme.ts:1339,1353,1681`).
- **Deux interfaces en parallèle au téléphone** : la machine 3D (pads, écran tactile, FX globaux) ET le Dock (`ui/Dock.tsx` : voix, pas, transport, page KNOBS de `ui/KnobPanel.tsx` avec A à H en 60 px). Même fonction à deux endroits : la principale source de confusion à traiter.
- **Déjà là, contrairement à ce que j'écrivais plus haut** : les blocs de l'écran agissent déjà comme potards (glisser, double tap), et la grille A01 à A16 marche au doigt (pas en EDIT, plus le PatternStrip de `BeatEditor` variante mobile).
- **Divergences de geste** : les presets s'ouvrent en tapant l'écran (`lcd-open`) et non par EDIT deux fois ; MUTE garde l'ancien comportement au téléphone ; vélocité à 16 px par niveau (12 au desktop), un départ horizontal rapide est lu comme un swipe de machine, et le Dock n'a pas de vélocité au glisser.
- **MIDI inaccessible au téléphone** : le bouton MIDI n'existe que dans l'en-tête desktop.
- **Cibles** : potards 3D du téléphone à environ 28 px (d'où KnobPanel) ; minimum 48 px au doigt dans `hit.ts`.
- **Aucun `navigator.vibrate`** dans le code. Les commentaires « phase 5 » marquent les endroits à rouvrir : `theme.ts:218,919,1337`, `rytm/pages.ts:641`, `scene/rytmFaceKeys.ts:10`, `ui/Hotspots.tsx:3004`, `fallback/StaticMachine.tsx:22`.

Conséquence sur le plan : la phase 1 n'invente pas « l'écran = potards », elle **unifie** : les blocs prennent la fonction `faceKnobs` du desktop (mêmes ids), et on choisit UN endroit pour les commandes (la machine), le Dock ne gardant que pas, voix et transport. EDIT deux fois et MUTE s'alignent sur le desktop.

## 3. Principes UX retenus

- **Un seul modèle mental**, desktop et téléphone : *une voix choisie, une page qui dit ce que valent les huit valeurs, seize pas pour la séquence, EDIT pour aller au fond*. Le téléphone ne réinvente rien, il change seulement le geste.
- **Les huit blocs de l'écran = les potards A à H.** Au téléphone, le bloc k EST le potard k (même fonction `faceKnobs`, même cible MIDI `rytm:knob:k+1`). Glisser vertical, double tap = valeur d'origine, la valeur en gros sous le doigt (le doigt cache le bloc).
- **« Tenir » remplace « tenir + survoler »** : long-press (350 ms) = le même verrou que la touche tenue au desktop (P-LOCK, armer une scène, INFOS d'une touche).
- **Pas de survol** : tout ce que le survol montre au desktop passe par un long-press ou une aide qui apparaît une fois.
- **Bas de l'écran = zone du pouce** : transport, pas et voix en bas ; écran au milieu ; en-tête en haut pour ce qui sert rarement.
- **Feuilles du bas (bottom sheets)** pour ce qui est une liste : patterns A01 à A16 et chaînes, presets, samples. Elles se ferment en glissant vers le bas, jamais de modale plein écran.
- **Cibles de 44 px au moins**, espacées ; tolérance de 15 px avant qu'un tap devienne un glisser (déjà la règle du BASS).
- **Retour haptique** : `navigator.vibrate` (Android) sur cran de valeur, step posé, P-LOCK armé, fin de chaîne. iOS Safari ne vibre pas : retour visuel obligatoire de toute façon (flash de la touche, valeur en gros).
- **Swipe limité** : changer de page par les touches sous l'écran (comme au desktop) ; le swipe horizontal reste seulement pour changer de machine, hors de l'écran et des pas (il accroche des boutons, constat du 2026-10-05).
- **Addictif = immédiat** : RUN toujours à portée, chaque geste s'entend et se voit tout de suite, RANDOM et UNDO à un pouce, jamais plus de deux taps pour une action courante.
- **Sobriété** : Mika a déjà dit « beaucoup trop complexe ». On retire avant d'ajouter.

## 4. Traduction section par section

| Desktop | Téléphone proposé | Trade-off |
|---|---|---|
| Potards A à H qui suivent la page | Les 8 blocs de l'écran, mêmes fonctions et mêmes ids MIDI | Les FX globaux quittent la face du téléphone et vont dans la page FX (onglet GLOBAL FX, déjà là) ; on perd l'accès permanent aux FX globaux |
| Touches de page VOICE FLTR ENV FX | Rangée de touches sous l'écran, 44 px | Aucune |
| TRK (vue des 8 voix, éclairs) | Même touche TRK ; les 8 premiers pas montrent les voix, tap = choisir, double tap = MUTE | Réutilise la rangée des pas : il faut un indicateur clair « tu es en TRK » |
| Grille des patterns, chaînes | Feuille du bas 4 x 4 ; tap = jouer à la fin de la mesure, long-press puis tap = chaîne | Une couche de plus qu'au desktop, mais la grille garde ses positions |
| EDIT, EDIT deux fois = presets | Identique ; les presets s'ouvrent en feuille du bas, liste au doigt | Le double tap sur EDIT est fragile au doigt : fenêtre de 400 ms, comme MUTE |
| Nom d'utilisateur (4) et de preset (10) | Champ texte natif (clavier du téléphone) dans la feuille, filtré aux lettres permises | Le clavier natif cache la moitié de l'écran : la feuille remonte au-dessus |
| P-LOCK (tenir un pas, tourner) | Tenir un pas, glisser un bloc de l'écran de l'autre doigt ; ou tenir un pas, il reste verrouillé, puis glisser | Deux doigts à une main est dur : prévoir le verrou qui reste (tap ailleurs pour sortir) |
| Vélocité en glissant depuis un pas | Déjà là, garder | Aucune |
| SCENE A et B, crossfader | Deux touches A / B dans la barre du bas et un crossfader horizontal large au-dessus des pas, visible seulement quand le pattern a des scènes | De la place verticale en moins ; masquer quand inutile |
| MUTE, SOLO | Déjà là (double tap, touche MUTE = tout rallumer) | Aucune |
| MASTER, TEMPO | Déjà dans l'en-tête de l'écran, garder | Aucune |
| OPEN (TWEAKS) | Identique, CLOSE en HTML déjà là | Aucune |
| Cartes INFOS et aide au survol | Long-press sur une touche = sa carte INFOS en feuille courte | Long-press entre en conflit avec « tenir » sur les pas : INFOS seulement sur les touches, jamais sur les pas |
| Clavier A S D F, M, Espace, Suppr | Rien à imiter : chaque raccourci a déjà son geste ; Suppr devient « retirer » dans la feuille des samples | Aucune |
| Samples, `+ LOAD A FILE...` | Feuille des samples : choisir, charger (sélecteur de fichiers natif), retirer | Aucune |
| Contrôleur matériel virtuel (`hw`), MIDI | Inchangé : mêmes ids, le pont `getSnapshot` lit les mêmes états | Aucune, c'est la contrainte |

## 5. Composants à créer ou modifier

- `src/v4/theme.ts` (`PORTRAIT`, `SCREEN_TOUCH`) : lever le gel du téléphone, nouvelle disposition.
- `src/v4/rytm/faceKnobs.ts`, `pages.ts`, `pageView.ts` : une seule source pour « bloc k = potard k » au desktop et au téléphone.
- `src/v4/scene/hit.ts`, `ui/Hotspots.tsx` : zones de l'écran tactiles au téléphone avec les mêmes ids que les potards.
- `src/v4/ui/Dock.tsx` : barre du bas (RUN, pas, voix, A / B, crossfader).
- Nouveaux : `ui/MobileSheet.tsx` (feuille du bas générique), `ui/PatternSheet.tsx`, `ui/PresetSheet.tsx`, `ui/SampleSheet.tsx`, `state/haptics.ts` (une fonction, rien si non supporté).
- `rytm/InfosCard.tsx` : ouverture au long-press.
- `scripts/smoke-v4.mjs` : nouvelles captures téléphone de référence (l'ancienne référence au pixel tombe volontairement).

## 6. Ordre d'implémentation

- **Phase 0, une heure** : Mika essaie la version actuelle sur son téléphone avec une liste courte (5 gestes) ; on note ce qui gêne vraiment. Captures téléphone de référence.
- **Phase 1, le cœur** : blocs de l'écran = potards A à H qui suivent la page, touches de page sous l'écran, retour haptique et valeur en gros. C'est ce qui rend le modèle identique.
- **Phase 2** : TRK au téléphone, MUTE / SOLO dans TRK.
- **Phase 3** : feuilles du bas : patterns et chaînes, puis presets (EDIT deux fois, noms au clavier natif), puis samples.
- **Phase 4** : SCENE A / B et crossfader.
- **Phase 5** : finition : INFOS au long-press, aide de première fois, téléphone couché, performance 3D, accessibilité (jumeaux HTML).

Chaque phase : tests muets (`--mute-audio`, `?mute=1`, jamais RUN), smoke-v4 desktop et téléphone, desktop inchangé au pixel, puis mise en ligne.

## 7. Risques et dépendances

- **Desktop à ne pas casser** : le desktop devient la référence au pixel pendant toute la refonte.
- **Ids MIDI et Roto-Control** : aucun ne change (415 cibles du MM-RYTM), les assignations de Mika doivent marcher pareil.
- **iOS** : pas de vibration, barre d'onglets flottante de Safari 26 (64 px déjà réservés), geste de bord (retour arrière) qui accroche les pas du bord gauche.
- **Conflits de gestes** : tenir (P-LOCK) contre long-press (INFOS) contre glisser (vélocité) contre deux doigts (orbite). Règle : les pas tiennent, les touches montrent INFOS, l'écran glisse, deux doigts hors écran tournent la vue.
- **Place verticale** : 390 x 844 sans défilement avec écran, touches, pas, voix, transport et parfois crossfader. Arbitrage probable : voix dans TRK plutôt qu'en rangée permanente.
- **Dépendances V.4.2** : la nouvelle gestion des presets (`presetFaceKnob`, zones `screen: true`) et `trkLeds` à une couleur doivent être stables avant les phases 2 et 3.
- **Tests réels** : seul Mika peut valider au doigt et à l'oreille ; prévoir un retour de sa part à chaque phase.

## 8. Points à valider par Mika

- Les FX globaux quittent la face du téléphone pour la page FX : d'accord ?
- Patterns, presets, samples en feuilles du bas : d'accord ?
- On commence par la phase 1 (écran = potards A à H) ?

## 9. Commandes utiles ajoutées

Aucune pour ce round.
