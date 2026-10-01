# 2026-10-01 : disposition du panneau, page MIX, OPEN plus ouvert, PCB realiste

## 1. Ce qui a ete fait

- Disposition : `src/v4/theme.ts` (ENCODERS dans l'ordre de lecture, `encPos` par id, TRANSPORT avec RANDOM, mention FIRMWARE V.2.1 / 2026), `scene/sequencer3d.ts`, `fallback/StaticMachine.tsx` (MUTE et SOLO ajoutes a la silhouette).
- Page MIX facon Elektron : `src/v4/state/lcdMix.ts` (nouveau), `state/lcd.ts`, `state/lcdMessage.ts`, `scene/screen.ts`, `actions.ts`, `theme.ts` (OLED_MIX).
- Vue OPEN plus ouverte : `theme.ts` (EXPLODE lift, slideZ, tilt, cadrage remesure).
- PCB : `scene/pcb.ts` (pistes sous vernis, puces QFP, serigraphie a l'echelle), `theme.ts` (PCB, CHIP, PCB_PARTS, PCB_SILK, COLOR.pcbTrace).
- Spec : `docs/v4/spec.md` section 27.

## 2. Decisions prises et pourquoi

- VOLUME garde son double role (general sans pad, volume de la voix avec un pad) : c'est ce reglage par voix qui ouvre la page MIX demandee.
- Ordre des effets = ordre du signal (DIST, CHORUS, DELAY, REVERB) ; groupes separes par un ecart.
- Rangee transport et rangee de potards avancees de 0.1 : en vue ouverte, les potards cachaient les noms des pads de page.
- Cadrage OPEN : 8.4 au lieu de la regle 86 % au pire azimut (qui faisait rapetisser la machine de 22 %) ; la machine ouverte rapetisse de 10 % et l'azimut 45 tient encore en entier.
- PCB : le cuivre nu orange etait le plus irrealiste ; sous le vernis, il devient un vert plus clair. Le cadre jaune des puces cliquables devient blanc comme toute la serigraphie (les noms orange restent).

## 3. Ce qui reste a faire / points en suspens

- Mika : juger la zone vide sous l'ecran (le transport reste aligne avec la rangee de potards).
- Le routeur ne place que 40 pistes (place libre) : pour une carte encore plus dense, ajouter des composants.
- Reglages par voix toujours en memoire seulement.

## 4. Commandes utiles ajoutees

- Debug : `__v4.lcd.mix` (page MIX), `__v4.stage.screen.canvas` (texture de l'ecran), `__v4.stage.pcb.canvas` (texture de la carte entiere).

## Complement : deux volumes, rangee alignee, transport sous l'ecran, face arriere

- `theme.ts` : MASTER (level) au-dessus de TEMPO ; VOLUME (vol, nouveau) pour la voix selectionnee seulement ; rangee de huit potards sur la grille des touches 9 a 16 ; TRANSPORT en carres de 0.8 sous l'ecran ; BACK (connectique et serigraphie de la face arriere).
- `actions.ts` : VOLUME sans pad -> TAP A PAD FIRST ; avec un pad -> page MIX. MASTER ne regle plus jamais une voix.
- `scene/sequencer3d.ts` : les boutons de transport ont leur propre maillage (coins reguliers).
- `scene/machine.ts` : vraie connectique (casque, L/R, SYNC, MIDI DIN, USB-C, DC 12V, interrupteur) ; `scene/backplate.ts` (nouveau) : logo, noms des prises, etiquette de serie.
- Decision : libelles MASTER et VOLUME (deux potards marques VOLUME pretaient a confusion).
