# 2026-11-16 - Téléphone : RYTM + ARP, le son qui craque

Demande de Mika : « quand j'utilise Rytm et Arp le son bogue comme s'il n'y avait plus de mémoire. Je veux garder la même qualité et les mêmes fonctions, et que le son ne plante pas, que ce soit fluide. » Précisions : iPhone (Safari), ça arrive « après un moment » et « quand je touche ».

## 1. Ce qui a été fait

- Mesure de la charge pendant la lecture, au téléphone (iPhone 13 émulé), RYTM et ARP qui jouent ensemble. Lecture **muette** (sortie audio coupée, `sinkId: none` et `--mute-audio`), avec l'accord de Mika (« Oui, lecture muette »). Mesurés : nœuds audio créés par seconde, messages vers les worklets, images rendues par seconde, retard de l'horloge audio, mémoire sur 4 minutes.
- La machine cachée ne fait plus rendre d'images (`src/v4/scene/renderer.ts`, `hidden()`). Au téléphone, une seule machine est à l'écran ; l'autre continuait de demander une image à chaque pas, flash ou note de l'arpège. Ses animations tournent toujours, donc son état suit la musique, mais elles ne déclenchent plus de rendu. La machine se redessine à jour dès qu'elle revient à l'écran. Même chose pour l'écran du RYTM et pour les rafraîchissements de l'ARP.
- RYTM : les recalculs regroupés au téléphone (`src/v4/audio/sched.ts`, `ASK_GAP_MS` = 60 ms). Tourner un réglage de voix refaisait toutes les voix à venir de la piste à chaque image. Un geste isolé part toujours après 12 ms, comme avant.
- ARP : les réglages envoyés au moteur au plus toutes les 33 ms au téléphone, le dernier toujours envoyé (`src/v4/audio/synth.ts`, `PARAMS_GAP_MS`). Le moteur glisse déjà d'une valeur à l'autre entre 2 et 50 ms, donc le son reste continu. Les effets suivent toujours le doigt à chaque événement.
- Accès de debug `__v4.tracks` (`src/v4/debug/index.ts`, `?debug=1` seulement) pour les tests de charge.
- Firmware : MM-RYTM 7.2 vers 7.3 (`src/v4/firmware.json`). MM-ARP reste en 2.6 (empreinte inchangée selon `firmware:check`).

Mesures, avant puis après (lecture muette, les deux machines jouent) :

| Situation | Images/s | Nœuds audio/s | Messages worklet |
|---|---|---|---|
| ARP à l'écran, repos | 26,7 → **8,7** | 33 → 33 | = |
| ARP à l'écran, réglage RYTM tourné | 25,5 → **8,6** | 198 → **76** | = |
| ARP à l'écran, potard ARP tourné | 59,3 → 59,1 (le potard bouge) | 35 → 35 | params ARP 62/s → **30/s** |
| RYTM à l'écran, repos | 26,9 → 25,2 | 33 → 32 | = |
| RYTM à l'écran, réglage RYTM tourné | 26,7 → 26 | 199 → **77** | = |

- Mémoire : aucune fuite. Sur 4 minutes de lecture avec des potards tournés, le tas JS reste entre 35 et 36 Mo, le DOM et les écouteurs restent stables, et l'horloge audio colle à la montre.

## 2. Décisions prises et pourquoi

- Diagnostic : rien ne s'accumule (mémoire stable), donc « après un moment », c'est la chauffe de l'iPhone. Le fil audio partage la puce avec le rendu 3D (écran Retina x3) ; quand la puce chauffe, elle ralentit et le synthé ARP (environ 16 à 20 % du temps réel ici, 8 voix) n'a plus de marge. « Quand je touche » : chaque geste ajoutait des rafales de rendus, de nœuds audio et de messages. Le correctif retire le travail inutile sans toucher au son ni à l'image.
- Rien n'a changé dans le son : le moteur ARP, les voix du RYTM, le suréchantillonnage et le nombre de voix sont identiques. `moog.worklet.js` n'a pas été touché, donc pas de `arp-bench --check`.
- Rien n'a changé à l'image : on ne saute que des images d'une machine invisible. Allers-retours RYTM ↔ ARP vérifiés en capture pendant la lecture : les pas, l'écran et les touches reviennent à jour.
- Ordinateur inchangé : le regroupement des recalculs et des messages ARP ne s'applique qu'au pointeur tactile. Le filtre des machines cachées ne s'applique qu'à une machine invisible ; à l'ordi, la voisine qui dépasse reste visible et rendue.
- Pas de plafond d'images ni de baisse de résolution : ce serait visible (potards moins fluides, image moins nette). On les garde en réserve si l'iPhone craque encore.
- `tsc` reste à 105 erreurs, toutes antérieures.

## 3. Ce qui reste à faire / points en suspens

- Mika : tester sur l'iPhone, RYTM et ARP ensemble, plusieurs minutes, en tournant des potards. Dire si ça craque encore et dans quelle situation (quelle machine à l'écran, quel geste).
- Si ça craque encore, prochains leviers par ordre de coût visible :
  1. Plafonner à 30 images/s pendant la lecture au téléphone (potards un peu moins fluides).
  2. Passer le rendu 3D du téléphone de x3 à x2 (image un peu moins nette).
  3. Un tampon audio plus grand sur iPhone (un peu plus de latence au toucher ; à tester, Safari ne respecte pas forcément le réglage).
- Potard ARP tourné avec l'ARP à l'écran : toujours 60 images/s, parce que le potard bouge à l'écran. C'est le prochain poste de charge.
- `scripts/smoke-v4.mjs` n'a pas été relancé.

## 4. Commandes utiles ajoutées

- Aucune nouvelle commande npm.
- En `?debug=1`, `__v4.tracks` donne le store des pistes du RYTM. Exemple : `__v4.tracks.set('BD', 'decay', 0.6)` pour les tests de charge.
