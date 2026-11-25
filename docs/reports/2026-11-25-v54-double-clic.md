# 2026-11-25 : MM-ARP v54, double clic sur un knob = valeur de depart

Demande de Mika : "quand on double clic sur un knob on reset ce meme knob". Sur la face, un clic seul ouvrait OPEN sur
la page du potard (HELL, REVERB, DELAY, DISTO) et la remise passait seulement par Alt / Cmd / Ctrl + clic ; un double
clic ouvrait la page sans rien remettre. Changement de geste, pas de design : pas de maquette.

## 1. Ce qui a ete fait

- src/v4/voyager/faceDbl.ts : le crochet du clic dit ce qu'il a fait ('act', 'knob', ou la page a ouvrir plus tard) ;
  FACE_DBL.ms = 300 ; la page attend ce temps, cancel() l'annule.
- src/v4/ui/Hotspots.tsx : tapDial (plugin MM-ARP) remet le potard au deuxieme appui ; onDown arme le double clic et
  annule la page attendue ; heure des evenements (timeStamp), pas celle du traitement.
- src/v4/plugin/arp/hellKnob.tsx : le crochet rend 'act' (viseur, POLARITY / VOICE, levier, touche, onglet), 'knob'
  (un potard sans page) ou l'ouverture de la page.
- src/v4/plugin/arp/faceExtras.tsx (encartKnob) et encart50.ts (knob50) : quels morceaux de l'encart sont des potards.
- docs/reports/2026-11-09-plugin-mm-arp.md (section v54), CLAUDE.md (etat v54).

## 2. Decisions prises et pourquoi

- Le clic seul garde son role (ouvrir la page dans OPEN), avec 300 ms d'attente pour les quatre potards qui ont une
  page : sans cette attente, le premier clic d'un double clic ouvrirait OPEN. Les autres potards ne font rien au clic
  seul, donc pas d'attente.
- Le double clic se mesure entre le premier lacher et le deuxieme appui (300 ms), a l'heure des evenements : un fil
  occupe ne transforme pas un double clic en deux clics lents.
- Un levier, une touche a crans, un segment : le clic agit tout de suite (un double clic = deux bascules), comme avant.
- Alt / Cmd / Ctrl + clic reste une remise (habitude Ableton).

## 3. Ce qui reste a faire / points en suspens

- Mika : essayer dans Ableton ; dire si l'attente de 300 ms avant l'ouverture d'OPEN (HELL, REVERB, DELAY, DISTO) se
  sent ; la reduire si besoin (FACE_DBL.ms).
- Toujours en attente : lettre des couleurs A / B / C (vivid.ts), avis d'ecoute de la banque dark disco, essai du
  navigateur de presets dans Ableton.
- La fiche INFOS de PRESET (voyager/infos.ts) decrit encore la liste de l'ecran, pas le navigateur de la v53.
- Les points des EQ (REVERB, DISTO, SOUND) se remettent toujours par Alt + clic, pas au double clic (ce ne sont pas des
  knobs).

## 4. Commandes utiles ajoutees

- Essai du double clic (scratchpad) : node dbl54/dbl.js <port> ; clics horodates par CDP (Input.dispatchMouseEvent
  timestamp), parce que le rendu logiciel du conteneur met des centaines de ms par image.
- Installation : curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
