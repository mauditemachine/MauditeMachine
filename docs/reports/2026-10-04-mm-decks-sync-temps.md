# MM-DECKS : SYNC cale aussi les temps (2026-10-04)

Mika : « oui continue avec le calage des temps au SYNC ».

## Ce qui change

- La grille des temps : à chaque morceau posé, dj/math.ts beatGrid trouve
  le premier temps et affine le BPM au centième. Il part de l'enveloppe
  des basses (passe-bas vers 150 Hz, 400 trames par seconde), range chaque
  montée selon sa phase et garde le tempo dont une phase concentre le plus
  de montées sur tout le morceau. Un tempo à 0.06 d'un entier devient
  l'entier.
- SYNC cale le tempo, puis les temps. Si la platine joue, elle saute d'au
  plus un demi-temps pour tomber sur les temps de la référence. Si elle est
  en pause, SYNC reste armé : PLAY, ou un hot cue, attend le prochain temps
  de la référence (une période au plus) et part pile dessus. En lecture, un
  hot cue garde la phase.
- La référence est la platine qu'on entend le plus, sinon le MM-RYTM et le
  MM-ARP s'ils tournent (un temps tous les quatre pas). Au double ou à la
  moitié du tempo, ça se cale aussi.
- SYNC se désarme dès qu'on touche le pitch à la main (fader, molette,
  PITCH - et +).
- L'écran rond n'est orange que si le tempo et les temps sont calés, à
  20 ms près : un nudge au jog ou à BEND l'éteint puis le rallume.
- La forme d'onde fine porte un petit tic en haut et en bas à chaque temps.
- Le lecteur sait partir à un instant donné (play(at)).

## Vérifié (son coupé, master à 0)

- Hors ligne, morceaux de synthèse à 124, 128, 122.5 et 174 BPM : premier
  temps à 0.5 ms près, BPM exact, environ 20 ms de calcul pour 90 s.
- Dans la page : A à 124 en lecture, B à 128 en pause. SYNC sur B, puis
  PLAY : départ 357 ms plus tard, sur un temps de A, écart 0 ms, toujours
  0 ms 5 s après. Décalé de 130 ms, SYNC s'éteint ; un nouveau SYNC
  ramène l'écart à 0 ms.
- Avec le MM-RYTM à 130 : A passe de 124 à 130 et PLAY part sur un temps
  des machines (écart 0 ms).
- tsc (dj sans erreur nouvelle) et vite build.
