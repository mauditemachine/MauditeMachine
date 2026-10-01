# 2026-10-01 : temoins lumineux des boutons du transport

## 1. Ce qui a été fait

- src/v4/theme.ts : jeton BTN_LED (taille, position, eclair de 520 ms) ; LIT.runOn, LIT.muteOn, RUN_GLOW et MUTE_GLOW retires.
- src/v4/scene/sequencer3d.ts : maillage btnLeds, un fin trait lumineux sur le dessus de RUN/STOP, CLEAR, RANDOM, MUTE et SOLO, qui descend avec le bouton ; etat tenu (RUN en lecture, MUTE, SOLO) et eclair d'appui ; info() donne run (booleen) et buttonLeds.
- src/v4/scene/renderer.ts : pressButton lance l'eclair du temoin (plein, puis il s'eteint).
- docs/v4/spec.md : R14-5.

## 2. Décisions prises et pourquoi

- Temoin plutot que bouton entier colore : Mika demande « un fin eclairage » ; RUN ne vire plus au jaune en lecture, MUTE et SOLO ne virent plus a l'orange ou au jaune, le trait porte l'etat.
- RUN, MUTE, SOLO tiennent l'etat (on/off) ; CLEAR et RANDOM, boutons a un coup, n'ont que l'eclair. L'eclair passe aussi sur les boutons tenus : un appui se voit meme quand rien ne change (MUTE sans voix selectionnee).
- Couleurs : orange des pas programmes ; jaune sur RUN, l'orange se perdait sur son rouge. Eteint : une fente discrete, pour qu'on sache ou regarder.

## 3. Ce qui reste à faire / points en suspens

- Rien. Verifie dans le navigateur, clair et sombre, sans lecture audio (etats poses par le debug).

## 4. Commandes utiles ajoutées

- Aucune. Etat des temoins : `window.__v4.stage.seq.info().buttonLeds` avec `?debug=1`.
