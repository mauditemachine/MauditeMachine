# MM-DECKS : vumètres en dBFS, exacts (2026-10-04)

Mika : « t'es sûr que le vumètre c'est normal ? Je veux que ce soit précis
par rapport au volume de chacun. J'ai l'impression que ça part tout le
temps dans le rouge. Et le rouge, c'est la saturation. »

## Ce qui n'allait pas

- La loi était une droite de -36 à 0 dB : orange dès -9.6 dB environ, rouge
  dès -2.4 dB.
- Le retour se faisait à environ 78 dB/s (0.86 par image), sans maintien de
  crête.
- Chaque voie était lue en mono : (L + R) / 2 fausse la crête d'un son
  large.
- Le master était lu avant le limiteur du site.

## Ce qui change

- Une loi fixe par segment, en dBFS (dj/math.ts VU_DB) : -36, -30, -26,
  -22, -19, -16, -13, -11, -9, -7.5 (jaune), -6, -4.5, -3, -2 (orange),
  -1 (rouge). Le rouge ne s'allume qu'à -1 dBFS et au-dessus, le vrai risque
  d'écrêtage. Les couleurs suivent la loi.
- La balistique d'un crête-mètre : attaque instantanée, retour de 20 dB/s,
  crête maintenue 1 s sur son segment, puis elle redescend au même pas.
- La mesure : crête exacte, gauche et droite séparées. Un son mono se lit
  des deux côtés, comme il sort des deux enceintes. Chaque voie est lue
  après son fader (ce qu'elle envoie au master). Le master est lu après le
  limiteur du site si le port audio donne sa sortie (synthPort().out),
  sinon juste avant. Aucune compensation de niveau.

## Vérifié (son coupé, master du site à 0)

- Sinus à 0.6 (-4.44 dBFS) sur DECK A, fader en haut : voie 3 à -4.44 dBFS,
  12 segments ; master gauche et droite à -4.44 dBFS, 12 segments ; voie 1
  éteinte.
- À l'arrêt : 6 segments à 0.5 s, 3 à 1 s, 1 à 1.5 s (20 dB/s). La crête
  reste sur son segment 1 s, puis descend au même pas.
- tsc (dj sans erreur nouvelle) et vite build.
