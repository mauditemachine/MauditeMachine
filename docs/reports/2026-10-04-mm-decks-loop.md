# MM-DECKS : boucles LOOP au temps près (2026-10-04)

Mika : « oui continue avec les boucles LOOP ».

## Ce qui change

- Une rangée LOOP sous les hot cues, sur chaque platine : 1, 2, 4 et 8
  temps.
- La boucle part du temps où l'on est, sur la grille des temps du morceau
  (celle de SYNC) ; sans grille, d'ici. Sa longueur vaut n temps au BPM du
  morceau.
- Une autre longueur pendant la boucle la redimensionne depuis le même
  départ ; une boucle qui raccourcit sous la tête la ramène dedans. La même
  touche quitte la boucle et la lecture continue tout droit.
- La source boucle d'elle-même (loopStart, loopEnd de Web Audio), à
  l'échantillon près, sans saut audible. Le lecteur replie sa position dans
  la boucle (formes d'onde, temps, SYNC).
- Un saut hors de la boucle la quitte : hot cue, CUE, toucher la piste,
  recalage de SYNC.
- La touche de la boucle en cours reste allumée en orange. Sur la forme
  d'onde fine, le fond de la boucle est orange sombre, ses bornes en trait
  orange ; sur la piste entière, la boucle est en orange pâle.
- Clavier : F (A) et H (B) posent ou quittent une boucle de quatre temps.
  Les jumeaux nomment chaque touche (« Deck A loop 4 beats »).
- La platine se range pour faire la place : l'écran passe de 4.9 à 4.5 de
  profondeur. BEND porte son nom entre ses deux signes, et CUE, PLAY, jog et
  PITCH descendent un peu.

## Vérifié (son coupé, master du site à 0)

- Morceau de test à 124 BPM, premier temps à 0.137 s, un repère fort à
  5 s. LOOP 4 posée vers 1 s : de 0.6211 à 2.5565 s, soit 4.000 temps, sur
  la grille.
- Pendant 6 s de boucle, la tête reste entre 0.631 et 2.552 s ; le repère à
  5 s ne sort jamais (crête de la voie à -10.6 dBFS, les grosses caisses
  seules). La boucle quittée, la lecture continue et le repère passe
  (0 dBFS).
- Téléphone : rangée LOOP, touche 2 allumée, boucle visible sur les deux
  formes d'onde, 70 jumeaux, aucun défilement horizontal.
- tsc (dj sans erreur nouvelle) et vite build.
