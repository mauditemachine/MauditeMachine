# Inventaire DT-UI : face avant, ecran, gestes, menus, donnees (Digitakt II)

Source : manuel Digitakt II OS 1.17 (24 sept. 2026), chapitres 3, 6, 7, 8, 9 lus en entier,
complete par les chapitres 10 (sequenceur, pour les touches), 12 (structure des pages FX/MIXER),
14 (SETTINGS), 17 (KEY COMBINATIONS) et 18 (dimensions) quand une touche y renvoie.
Geometrie mesuree au pixel sur la page PDF 12 (rendu 200 et 400 dpi, pdftoppm), detection
automatique des touches, potards, cadres, LEDs et legendes.

Etiquettes utilisees dans tout le document :

- [GARDER] : a reproduire tel quel (fonction, place, comportement).
- [SAMPLING: RETIRER] : lie a l'enregistrement audio, aux entrees, a l'edition/gestion de samples.
- [MATERIEL: RETIRER] : USB, Overbridge, Outbox, Transfer, SysEx, OS, +Drive physique, connecteurs.
- [MIDI EXT: OPTIONNEL] : demande un appareil MIDI externe (faisable en WebMIDI, le repo a deja
  du Roto-Control, mais pas indispensable). A trancher dans la spec.
- [A ARBITRER] : ni clairement sampling ni clairement garde (ex : machines SLICE/GRID).

Notation : [TOUCHE] = touche, BOUTON = potard, <LED> = voyant. "A + B" = maintenir A puis appui
court sur B (regle 6.2.3 : on maintient [FUNC] et on fait un appui court sur la 2e touche).

---------------------------------------------------------------------------------------------------

## 1. Vue d'ensemble de la face (page 12)

La face est un rectangle de rapport 1,222 (975 x 798 px mesures ; 215 x 176 mm annonces au ch. 18,
rapport 1,2216 : l'illustration est a l'echelle des cotes exterieures, 1 px a 200 dpi = 0,2205 mm).
Coins tres legerement arrondis (rayon ~0,9 mm, ~0,4 % de la largeur).

Decoupage en zones (x et y normalises 0..1, origine en haut a gauche) :

| Zone | x | y | Contenu |
|---|---|---|---|
| Bandeau haut (serigraphie) | 0,05 a 0,92 | 0,01 a 0,03 | Noms des prises arriere imprimes sur le dessus : casque, L Out R, L In R, MIDI In, MIDI Out, MIDI Thru, USB, DC In, Power [MATERIEL: RETIRER] |
| Colonne gauche | 0,05 a 0,135 | 0,15 a 0,96 | MAIN VOLUME, LEVEL/DATA, puis [FUNC], [KEYBOARD], [TRK], [PTN], [SONG] empiles |
| Ecran | 0,146 a 0,487 | 0,125 a 0,414 | Cadre fonce + OLED + logo modele en bas a gauche du cadre |
| Rangee "menus" | 0,177 a 0,456 | 0,48 a 0,545 | [PRESET/KIT] [SETTINGS] [SAMPLING] [TEMPO] |
| Transport | 0,177 a 0,456 | 0,57 a 0,635 | [RECORD] [PLAY] [STOP] (larges) |
| Logo marque | 0,886 a 0,958 | 0,059 a 0,118 | Haut droite |
| Bloc encodeurs | 0,515 a 0,956 | 0,143 a 0,393 | DATA ENTRY A B C D (rangee 1), E F G H (rangee 2), dans un cadre |
| Bloc PARAMETER | 0,515 a 0,956 | 0,415 a 0,507 | [TRIG] [SRC] [FLTR] [AMP] [FX] [MOD], dans un cadre |
| YES / NO | 0,523 a 0,575 | 0,525 a 0,681 | [YES] au dessus de [NO] |
| Bloc fleches | 0,592 a 0,805 | 0,520 a 0,706 | [UP] seul en haut, [LEFT] [DOWN] [RIGHT] en bas, dans un cadre |
| LEDs de page | 0,853 a 0,961 | 0,531 a 0,594 | 8 <PATTERN PAGE> en 2 rangees de 4, dans un cadre |
| [PAGE] | 0,867 a 0,949 | 0,617 a 0,681 | Touche large sous les LEDs |
| Bloc TRIG | 0,168 a 0,958 | 0,711 a 0,959 | [TRIG 1..8] rangee haute, [TRIG 9..16] rangee basse, dans un cadre |

Cadres (traits fins fonces a coins arrondis) : seulement autour de 5 groupes : encodeurs A-H,
touches PARAMETER, fleches, LEDs de page, TRIG 1-16. Pas de cadre autour de la colonne gauche,
de la rangee menus, du transport, ni de YES/NO.

Numeros d'appel du manuel (fig. 3.1) : 1 MAIN VOLUME, 2 [PRESET/KIT], 3 [SETTINGS], 4 [SAMPLING],
5 [TEMPO], 6 [NO], 7 [YES], 8 DATA ENTRY A-H, 9 [PARAMETER], 10 <PATTERN PAGE>, 11 [ARROW],
12 [PAGE], 13 [TRIG], 14 [SONG], 15 [PTN], 16 [TRK], 17 [STOP], 18 [PLAY], 19 [RECORD],
20 [KEYBOARD], 21 [FUNC], 22 LEVEL/DATA, 23 ecran.

---------------------------------------------------------------------------------------------------

## 2. Geometrie precise (pour la facade 3D)

Repere : x de 0 (bord gauche) a 1 (bord droit) sur la largeur ; y de 0 (bord haut, cote
prises) a 1 (bord bas, cote utilisateur) sur la profondeur. cx, cy = centre ; w = largeur / largeur
face ; h = hauteur / profondeur face ; x0, y0 = coin haut gauche. mm = conversion sur 215 x 176 mm.
Attention : w et h sont normalises sur des axes differents, une touche carree a w 0,052 et h 0,064
(11,2 x 11,2 mm). Pour la 3D, partir des mm ou de (w * 215, h * 176).

| id | controle | cx | cy | w | h | x0 | y0 | cx mm | cy mm | w x h mm |
|---|---|---|---|---|---|---|---|---|---|---|
| MAIN_VOLUME | MAIN VOLUME (potentiometre absolu, point repere) | 0.082 | 0.185 | 0.061 | 0.074 | 0.051 | 0.148 | 17.5 | 32.5 | 13.0 x 13.0 |
| LEVEL_DATA | LEVEL/DATA (encodeur sans fin, poussoir) | 0.082 | 0.327 | 0.061 | 0.073 | 0.051 | 0.291 | 17.5 | 57.6 | 13.0 x 12.8 |
| ENC_A | DATA ENTRY A | 0.551 | 0.185 | 0.061 | 0.074 | 0.521 | 0.148 | 118.5 | 32.5 | 13.0 x 13.0 |
| ENC_B | DATA ENTRY B | 0.674 | 0.185 | 0.061 | 0.074 | 0.644 | 0.148 | 145.0 | 32.5 | 13.0 x 13.0 |
| ENC_C | DATA ENTRY C | 0.796 | 0.185 | 0.061 | 0.074 | 0.766 | 0.148 | 171.2 | 32.5 | 13.0 x 13.0 |
| ENC_D | DATA ENTRY D | 0.919 | 0.185 | 0.061 | 0.074 | 0.889 | 0.148 | 197.7 | 32.5 | 13.0 x 13.0 |
| ENC_E | DATA ENTRY E | 0.551 | 0.327 | 0.061 | 0.073 | 0.521 | 0.291 | 118.5 | 57.6 | 13.0 x 12.8 |
| ENC_F | DATA ENTRY F | 0.674 | 0.327 | 0.061 | 0.073 | 0.644 | 0.291 | 145.0 | 57.6 | 13.0 x 12.8 |
| ENC_G | DATA ENTRY G | 0.796 | 0.327 | 0.061 | 0.073 | 0.766 | 0.291 | 171.2 | 57.6 | 13.0 x 12.8 |
| ENC_H | DATA ENTRY H | 0.919 | 0.327 | 0.061 | 0.073 | 0.889 | 0.291 | 197.7 | 57.6 | 13.0 x 12.8 |
| PRM_TRIG | [TRIG] (PARAMETER) | 0.549 | 0.452 | 0.052 | 0.064 | 0.523 | 0.420 | 118.1 | 79.5 | 11.2 x 11.2 |
| PRM_SRC | [SRC] (PARAMETER) | 0.623 | 0.452 | 0.052 | 0.064 | 0.597 | 0.420 | 134.0 | 79.5 | 11.2 x 11.2 |
| PRM_FLTR | [FLTR] (PARAMETER) | 0.698 | 0.452 | 0.052 | 0.064 | 0.672 | 0.420 | 150.1 | 79.5 | 11.2 x 11.2 |
| PRM_AMP | [AMP] (PARAMETER) | 0.772 | 0.452 | 0.052 | 0.064 | 0.746 | 0.420 | 165.9 | 79.5 | 11.2 x 11.2 |
| PRM_FX | [FX] (PARAMETER) | 0.847 | 0.452 | 0.052 | 0.064 | 0.821 | 0.420 | 182.0 | 79.5 | 11.2 x 11.2 |
| PRM_MOD | [MOD] (PARAMETER) | 0.922 | 0.452 | 0.052 | 0.064 | 0.895 | 0.420 | 198.1 | 79.5 | 11.2 x 11.2 |
| FUNC | [FUNC] | 0.093 | 0.512 | 0.082 | 0.064 | 0.052 | 0.480 | 20.1 | 90.1 | 17.6 x 11.2 |
| PRESET_KIT | [PRESET/KIT] | 0.204 | 0.512 | 0.052 | 0.064 | 0.177 | 0.480 | 43.8 | 90.1 | 11.2 x 11.2 |
| SETTINGS | [SETTINGS] | 0.279 | 0.512 | 0.052 | 0.064 | 0.253 | 0.480 | 60.1 | 90.1 | 11.2 x 11.2 |
| SAMPLING | [SAMPLING] | 0.354 | 0.512 | 0.052 | 0.064 | 0.328 | 0.480 | 76.2 | 90.1 | 11.2 x 11.2 |
| TEMPO | [TEMPO] | 0.430 | 0.512 | 0.052 | 0.064 | 0.404 | 0.480 | 92.5 | 90.1 | 11.2 x 11.2 |
| YES | [YES] | 0.549 | 0.557 | 0.052 | 0.064 | 0.523 | 0.525 | 118.1 | 98.0 | 11.2 x 11.2 |
| UP | [UP] | 0.698 | 0.557 | 0.052 | 0.064 | 0.672 | 0.525 | 150.1 | 98.0 | 11.2 x 11.2 |
| KEYBOARD | [KEYBOARD] | 0.093 | 0.603 | 0.053 | 0.065 | 0.067 | 0.570 | 20.1 | 106.1 | 11.5 x 11.5 |
| RECORD | [RECORD] | 0.218 | 0.603 | 0.082 | 0.065 | 0.177 | 0.570 | 47.0 | 106.1 | 17.6 x 11.5 |
| PLAY | [PLAY] | 0.317 | 0.603 | 0.082 | 0.065 | 0.276 | 0.570 | 68.1 | 106.1 | 17.6 x 11.5 |
| STOP | [STOP] | 0.415 | 0.603 | 0.082 | 0.065 | 0.374 | 0.570 | 89.3 | 106.1 | 17.6 x 11.5 |
| NO | [NO] | 0.549 | 0.648 | 0.052 | 0.064 | 0.523 | 0.617 | 118.1 | 114.1 | 11.2 x 11.2 |
| LEFT | [LEFT] | 0.624 | 0.648 | 0.053 | 0.064 | 0.597 | 0.617 | 134.1 | 114.1 | 11.5 x 11.2 |
| DOWN | [DOWN] | 0.698 | 0.648 | 0.052 | 0.064 | 0.672 | 0.617 | 150.1 | 114.1 | 11.2 x 11.2 |
| RIGHT | [RIGHT] | 0.772 | 0.648 | 0.053 | 0.064 | 0.746 | 0.617 | 166.0 | 114.1 | 11.5 x 11.2 |
| PAGE | [PAGE] | 0.908 | 0.648 | 0.082 | 0.064 | 0.867 | 0.617 | 195.2 | 114.1 | 17.6 x 11.2 |
| TRK | [TRK] | 0.093 | 0.705 | 0.082 | 0.064 | 0.052 | 0.673 | 20.1 | 124.1 | 17.6 x 11.2 |
| PTN | [PTN] | 0.093 | 0.801 | 0.082 | 0.064 | 0.052 | 0.769 | 20.1 | 141.0 | 17.6 x 11.2 |
| SONG | [SONG] | 0.093 | 0.898 | 0.082 | 0.065 | 0.052 | 0.866 | 20.1 | 158.1 | 17.6 x 11.5 |
| TRIG_1 | [TRIG 1] | 0.218 | 0.771 | 0.082 | 0.100 | 0.177 | 0.721 | 47.0 | 135.6 | 17.6 x 17.6 |
| TRIG_2 | [TRIG 2] | 0.317 | 0.771 | 0.082 | 0.100 | 0.276 | 0.721 | 68.1 | 135.6 | 17.6 x 17.6 |
| TRIG_3 | [TRIG 3] | 0.415 | 0.771 | 0.082 | 0.100 | 0.374 | 0.721 | 89.3 | 135.6 | 17.6 x 17.6 |
| TRIG_4 | [TRIG 4] | 0.514 | 0.771 | 0.082 | 0.100 | 0.473 | 0.721 | 110.5 | 135.6 | 17.6 x 17.6 |
| TRIG_5 | [TRIG 5] | 0.612 | 0.771 | 0.082 | 0.100 | 0.571 | 0.721 | 131.6 | 135.6 | 17.6 x 17.6 |
| TRIG_6 | [TRIG 6] | 0.711 | 0.771 | 0.082 | 0.100 | 0.670 | 0.721 | 152.8 | 135.6 | 17.6 x 17.6 |
| TRIG_7 | [TRIG 7] | 0.809 | 0.771 | 0.082 | 0.100 | 0.768 | 0.721 | 174.0 | 135.6 | 17.6 x 17.6 |
| TRIG_8 | [TRIG 8] | 0.908 | 0.771 | 0.082 | 0.100 | 0.867 | 0.721 | 195.2 | 135.6 | 17.6 x 17.6 |
| TRIG_9 | [TRIG 9] | 0.218 | 0.898 | 0.082 | 0.100 | 0.177 | 0.848 | 47.0 | 158.1 | 17.6 x 17.6 |
| TRIG_10 | [TRIG 10] | 0.317 | 0.898 | 0.082 | 0.100 | 0.276 | 0.848 | 68.1 | 158.1 | 17.6 x 17.6 |
| TRIG_11 | [TRIG 11] | 0.415 | 0.898 | 0.082 | 0.100 | 0.374 | 0.848 | 89.3 | 158.1 | 17.6 x 17.6 |
| TRIG_12 | [TRIG 12] | 0.514 | 0.898 | 0.082 | 0.100 | 0.473 | 0.848 | 110.5 | 158.1 | 17.6 x 17.6 |
| TRIG_13 | [TRIG 13] | 0.612 | 0.898 | 0.082 | 0.100 | 0.571 | 0.848 | 131.6 | 158.1 | 17.6 x 17.6 |
| TRIG_14 | [TRIG 14] | 0.711 | 0.898 | 0.082 | 0.100 | 0.670 | 0.848 | 152.8 | 158.1 | 17.6 x 17.6 |
| TRIG_15 | [TRIG 15] | 0.809 | 0.898 | 0.082 | 0.100 | 0.768 | 0.848 | 174.0 | 158.1 | 17.6 x 17.6 |
| TRIG_16 | [TRIG 16] | 0.908 | 0.898 | 0.082 | 0.100 | 0.867 | 0.848 | 195.2 | 158.1 | 17.6 x 17.6 |
| PAGE_LED_1 | <PATTERN PAGE> LED 1 | 0.865 | 0.546 | 0.015 | 0.019 | 0.857 | 0.536 | 186.0 | 96.1 | 3.3 x 3.3 |
| PAGE_LED_2 | <PATTERN PAGE> LED 2 | 0.894 | 0.546 | 0.015 | 0.019 | 0.886 | 0.536 | 192.2 | 96.1 | 3.3 x 3.3 |
| PAGE_LED_3 | <PATTERN PAGE> LED 3 | 0.922 | 0.546 | 0.015 | 0.019 | 0.914 | 0.536 | 198.1 | 96.1 | 3.3 x 3.3 |
| PAGE_LED_4 | <PATTERN PAGE> LED 4 | 0.949 | 0.546 | 0.015 | 0.019 | 0.942 | 0.536 | 204.1 | 96.1 | 3.3 x 3.3 |
| PAGE_LED_5 | <PATTERN PAGE> LED 5 | 0.865 | 0.580 | 0.015 | 0.019 | 0.857 | 0.570 | 186.0 | 102.0 | 3.3 x 3.3 |
| PAGE_LED_6 | <PATTERN PAGE> LED 6 | 0.894 | 0.580 | 0.015 | 0.019 | 0.886 | 0.570 | 192.2 | 102.0 | 3.3 x 3.3 |
| PAGE_LED_7 | <PATTERN PAGE> LED 7 | 0.922 | 0.580 | 0.015 | 0.019 | 0.914 | 0.570 | 198.1 | 102.0 | 3.3 x 3.3 |
| PAGE_LED_8 | <PATTERN PAGE> LED 8 | 0.949 | 0.580 | 0.015 | 0.019 | 0.942 | 0.570 | 204.1 | 102.0 | 3.3 x 3.3 |
| SCREEN_BEZEL | Cadre ecran (fond fonce) | 0.317 | 0.270 | 0.343 | 0.289 | 0.146 | 0.125 | 68.1 | 47.5 | 73.7 x 50.9 |
| SCREEN | Afficheur OLED (zone active) | 0.317 | 0.257 | 0.283 | 0.190 | 0.175 | 0.162 | 68.1 | 45.2 | 60.9 x 33.5 |
| LOGO_MODEL | Logo modele (dans le cadre ecran, bas gauche) | 0.231 | 0.385 | 0.122 | 0.035 | 0.170 | 0.367 | 49.7 | 67.7 | 26.2 x 6.2 |
| LOGO_BRAND | Logo marque (haut droite) | 0.922 | 0.088 | 0.072 | 0.059 | 0.886 | 0.059 | 198.2 | 15.5 | 15.4 x 10.4 |
| FRAME_ENC | Cadre groupe encodeurs A-H | 0.735 | 0.268 | 0.441 | 0.251 | 0.515 | 0.143 | 158.1 | 47.2 | 94.8 x 44.1 |
| FRAME_PRM | Cadre groupe touches PARAMETER | 0.735 | 0.461 | 0.441 | 0.093 | 0.515 | 0.415 | 158.1 | 81.2 | 94.8 x 16.3 |
| FRAME_ARROWS | Cadre groupe fleches | 0.698 | 0.613 | 0.213 | 0.185 | 0.592 | 0.520 | 150.2 | 107.8 | 45.9 x 32.6 |
| FRAME_LEDS | Cadre LEDs PATTERN PAGE | 0.907 | 0.563 | 0.108 | 0.063 | 0.853 | 0.531 | 195.0 | 99.0 | 23.2 x 11.0 |
| FRAME_TRIGS | Cadre groupe TRIG 1-16 | 0.563 | 0.835 | 0.790 | 0.248 | 0.168 | 0.711 | 121.1 | 146.9 | 169.8 x 43.7 |

Note ecran : l'OLED fait 128 x 64 px (ch. 18, rapport 2:1). La zone claire du dessin
(60,9 x 33,5 mm, rapport 1,82) inclut une marge ; pour un rendu fidele, centrer une surface 2:1
de ~60 x 30 mm dans cette zone.

### 2.1 Formes et tailles

- Potards : tous dessines de meme diametre (13 mm visibles). MAIN VOLUME porte un point repere
  (pot absolu, course ~320 degres, point dessine vers 7 h 30 = minimum). LEVEL/DATA et A-H : pas de
  repere (encodeurs relatifs infinis, poussoirs : "press and turn" = grands pas).
- 3 gabarits de touches :
  - petite carree 11,2 x 11,2 mm, rayon de coin ~2,4 mm (~22 % du cote) : PARAMETER x6,
    PRESET/KIT, SETTINGS, SAMPLING, TEMPO, YES, NO, 4 fleches, KEYBOARD (11,5 mm).
  - large 17,6 x 11,2 mm, rayon ~2,4 mm : FUNC, TRK, PTN, SONG, RECORD, PLAY, STOP, PAGE.
  - TRIG carree 17,6 x 17,6 mm, rayon ~2,6 mm (~15 %).
- LEDs de page : pastilles rondes 3,3 mm, pas 6,0 mm en x et 5,9 mm en y.
- Pas reguliers : encodeurs 26,4 mm en x, 25,1 mm en y ; petites touches de la rangee PARAMETER
  16,0 mm en x ; TRIG 21,2 mm en x (ecart 3,6 mm), 22,5 mm en y (ecart ~4,9 mm, ou loge la
  legende "Track/Mute").

### 2.2 Alignements a respecter (ils font "l'air Digitakt")

- Rangee 1 des encodeurs (A-D) et MAIN VOLUME sur la meme ligne cy 0,185 ; rangee 2 (E-H) et
  LEVEL/DATA sur cy 0,327.
- Colonne gauche : potards et touches larges alignes par le BORD GAUCHE (x0 0,051/0,052), pas par
  le centre ; KEYBOARD (carree) est centree sur l'axe des touches larges (cx 0,093).
- RECORD / PLAY / STOP centres exactement sur les colonnes TRIG 1 / 2 / 3. La rangee menus
  (PRESET/KIT .. TEMPO) occupe exactement la largeur TRIG 1 a TRIG 3 (bord gauche de TRIG 1 a bord
  droit de TRIG 3). Le centre de l'ecran (cx 0,317) tombe sur la colonne TRIG 2 / PLAY.
- KEYBOARD et le transport partagent la meme ligne (cy 0,603) ; FUNC et la rangee menus aussi
  (cy 0,512).
- Colonne YES/NO = colonne de la touche PARAMETER [TRIG] = colonne de l'encodeur A (cx ~0,55).
  [LEFT] sous [SRC], [UP]/[DOWN] sous [FLTR], [RIGHT] sous [AMP]. [YES] est sur la ligne de [UP],
  [NO] sur la ligne de [LEFT]/[DOWN]/[RIGHT].
- [PAGE] et le bloc de LEDs sont centres sur la colonne TRIG 8 / 16 (cx 0,908).
- [SONG] est sur la ligne de la rangee TRIG 9-16 (cy 0,898) ; [TRK] et [PTN] ne s'alignent pas sur
  les rangees TRIG.
- Les encodeurs (pas 26,4 mm) ne s'alignent pas sur les touches PARAMETER (pas 16,0 mm), sauf A.

### 2.3 Inscriptions (legendes) et leur place

Primaire = texte clair (blanc) ; secondaire = fonction [FUNC], imprimee en ORANGE sur la vraie
machine (manuel 3.1 n. 21 ; gris clair sur le dessin).

| Texte | Type | cx | cy | Position |
|---|---|---|---|---|
| icone casque, "L .... Out .... R", "L ... In ... R", "MIDI In", "MIDI Out", "MIDI Thru", "USB", "DC In", "Power" | serigraphie prises | 0,072 / 0,162 / 0,300 / 0,419 / 0,512 / 0,605 / 0,707 / 0,796 / 0,898 | 0,020 | bandeau haut [MATERIEL: RETIRER] |
| Main Volume | primaire | 0,082 | 0,241 | sous le potard |
| Level/Data | primaire | 0,082 | 0,383 | sous le potard |
| Preset Pool | secondaire | 0,082 | 0,402 | sous "Level/Data" |
| A B C D | primaire | 0,551 / 0,674 / 0,796 / 0,919 | 0,241 | sous chaque encodeur |
| E F G H | primaire | idem | 0,383 | sous chaque encodeur |
| TRIG SRC FLTR AMP FX MOD | texte sur la touche | centre touche | 0,452 | |
| Quantize Machine Setup Sequencer Send FX Mixer | secondaire | 0,549 / 0,624 / 0,698 / 0,773 / 0,847 / 0,922 | 0,496 | sous chaque touche PARAMETER, dans le cadre |
| FUNC, YES, NO, PAGE, TRK, PTN, SONG | texte sur la touche | | | |
| icones : note + lignes (PRESET/KIT), engrenage (SETTINGS), forme d'onde en barres (SAMPLING), metronome (TEMPO), clavier piano (KEYBOARD), cercle (RECORD), triangle (PLAY), carre (STOP), chevrons ^ v < > (fleches) | sur la touche, en creux/contour | | | |
| Perform / Save Proj / Samples / Tap Tempo | secondaire | 0,204 / 0,279 / 0,355 / 0,430 | 0,557 | sous PRESET/KIT, SETTINGS, SAMPLING, TEMPO |
| fleche double haut/bas + "KB Octave" | secondaire (avec [KEYBOARD]) | 0,782 | 0,558 | a droite de [UP], meme ligne |
| Save | secondaire | 0,549 | 0,602 | sous [YES] |
| Trig Mode | secondaire | 0,697 | 0,602 | sous [UP] |
| KB Setup / Copy / Clear / Paste | secondaire | 0,094 / 0,219 / 0,317 / 0,416 | 0,649 | sous KEYBOARD, RECORD, PLAY, STOP |
| Reload | secondaire | 0,549 | 0,693 | sous [NO] |
| uTime- / Trig Mode / uTime+ | secondaire | 0,625 / 0,697 / 0,773 | 0,694 | sous LEFT, DOWN, RIGHT (imprime avec le signe micro) |
| Fill/Setup | secondaire | 0,908 | 0,694 | sous [PAGE] |
| Mute Mode | secondaire | 0,092 | 0,749 | sous [TRK] |
| Bank | secondaire | 0,093 | 0,846 | sous [PTN] |
| Song Edit | secondaire | 0,093 | 0,944 | sous [SONG] |
| Track/Mute | secondaire des TRIG | 0,563 | 0,833 | entre les 2 rangees TRIG, avec une accolade pointillee qui part sous TRIG 1 (0,219) et finit sous TRIG 8 (0,907) |
| 1 .. 16 | sur chaque TRIG | | | chiffre + petit trait horizontal dessous (zone eclairee) |
| cadre carre interieur | sur TRIG 1, 5, 9, 13 | | | repere des temps (noires) |

---------------------------------------------------------------------------------------------------

## 3. Inventaire controle par controle

Format : fonction primaire / secondaire ([FUNC] +) / autres combinaisons / LED / etiquette.

### 3.1 Potards

**MAIN VOLUME** (n. 1)
- Primaire : volume des sorties principales et casque. Pot absolu ~320 degres.
- Secondaire : aucune. LED : aucune.
- [GARDER] (volume general de la machine web).

**LEVEL/DATA** (n. 22)
- Primaire : niveau (volume) de la piste active (affiche colonne gauche ecran "LEV") ; dans les
  menus et listes : defilement rapide / reglage de la valeur surlignee. Encodeur relatif, pousser +
  tourner = grands pas.
- Secondaire (legende "Preset Pool") : [FUNC] + tourner = ouvre le PRESET BROWSER (9.2).
  Ecart dans le manuel : 3.1 dit "ouvre le PRESET MANAGER", 9.2 dit PRESET BROWSER (liste de
  chargement). Retenir PRESET BROWSER.
- Autres : maintenir une note trig + tourner = ouvre la liste du POOL pour poser un PRESET LOCK
  (10.8.2) ; dans les menus de modulation (SETUP > TRACK > KEY TRACKING etc.) tourner = tester la
  modulation ; dans TEMPO, regle le BPM comme A ; sur l'ecran de nommage, change le caractere.
- [GARDER].

**DATA ENTRY A a H** (n. 8)
- Primaire : regler les 8 parametres affiches (grille ecran 2 x 4 : A B C D en haut, E F G H en
  bas, meme disposition que les potards). Encodeurs relatifs infinis.
- Gestes : pousser + tourner = grands pas ; potard enfonce + [NO] = valeur par defaut ;
  [FUNC] + tourner = "saut de valeur" sur certains parametres (NOTE par octaves, temps de delay par
  valeurs liees au BPM) ; [TRK] maintenu + tourner = CONTROL ALL ; [TRIG] maintenu + tourner =
  parameter lock ; [TRIG] maintenu + pousser le potard = supprime le lock de ce parametre ;
  [NO] maintenu + pousser/maintenir le potard en LIVE REC = efface ce lock en temps reel.
- LED : aucune. [GARDER].

### 3.2 Touches de menu (rangee sous l'ecran)

**[PRESET/KIT]** (n. 2), icone note + liste, legende secondaire "Perform"
- Primaire : ouvre le menu PRESET/KIT (presets du +Drive et du pool, kits).
- Secondaire : [FUNC] + [PRESET/KIT] = PERFORM KIT mode on/off.
- Autres : [PRESET/KIT] + [NO] = recharge instantanement le kit du pattern (en PERFORM KIT) ;
  [PRESET/KIT] + [YES] = sauve le kit modifie (ouvre SAVE (KIT)) ; [TRIG] + [PRESET/KIT] en GRID REC
  = sauve le son d'un trig (avec ses locks) comme preset.
- LED : allumee ORANGE quand PERFORM KIT est actif (10.10).
- [GARDER].

**[SETTINGS]** (n. 3), icone engrenage, legende "Save Proj"
- Primaire : menu SETTINGS (projets, song, pattern, MIDI, routage, personnalisation, systeme).
- Secondaire : [FUNC] + [SETTINGS] = sauve (ecrase) le projet courant.
- Autres : maintenir [SETTINGS] ~1 s puis [TRIG 1-3] = intensite LEDs/ecran (LOW/MID/MAX), puis
  [TRIG 9] = retroeclairage des touches on/off ; sur l'ecran de nommage, [SETTINGS] = nom aleatoire.
- LED : non documentee. [GARDER] (contenu du menu filtre, voir 7.3).

**[SAMPLING]** (n. 4), icone forme d'onde, legende "Samples"
- Primaire : menu SAMPLING (enregistrement). Secondaire : [FUNC] + [SAMPLING] = menu SAMPLES
  (gestion des samples du +Drive).
- [SAMPLING: RETIRER]. La place physique peut etre gardee pour un autre role (voir 10), sinon
  laisser un emplacement vide ou deplacer : a decider dans la spec.

**[TEMPO]** (n. 5), icone metronome, legende "Tap Tempo"
- Primaire : menu TEMPO (BPM projet ou pattern, swing, metronome).
- Secondaire : [FUNC] + taper [TEMPO] en rythme = tap tempo (moyenne apres 4 frappes, mise a jour
  continue).
- Autres : [TEMPO] + [YES] = metronome on/off ; dans SONG EDIT, [TEMPO] ouvre le TEMPO du pattern de
  la ligne choisie. (Tap tempo par note MIDI C0 sur le canal FX CONTROL : [MIDI EXT: OPTIONNEL].)
- LED : non documentee. [GARDER].

### 3.3 YES / NO

**[YES]** (n. 7), legende "Save"
- Primaire : entrer dans un sous-menu, selectionner, confirmer, cocher/decocher.
- Secondaire : [FUNC] + [YES] = sauvegarde TEMPORAIRE du pattern actif (point de restauration).
- Contextes : nommage = inserer un espace ; listes de presets/samples = pre-ecoute ; PTN ouvert =
  ouvre le createur de chaine ; PAGE SETUP = bascule PER PATTERN / PER TRACK ; STEP REC = n'agit
  pas comme temp save. [YES] + [PAGE] = FILL pour un cycle ; [TRIG] + [YES] = pre-ecoute du trig ;
  [PARAMETER] + [YES] = randomise la page ; [PRESET/KIT] + [YES] = sauve le kit (PERFORM KIT) ;
  [TEMPO] + [YES] = metronome ; YES maintenu en STEP REC = longueur du trig = duree d'appui.
- [GARDER].

**[NO]** (n. 6), legende "Reload"
- Primaire : sortir d'un menu, reculer d'un niveau (repete jusqu'a l'ecran principal), refuser.
- Secondaire : [FUNC] + [NO] = recharge TEMPORAIRE du pattern (depuis le dernier temp save, sinon
  depuis l'etat sauve).
- Contextes : nommage = effacer un caractere ; recherche = effacer la recherche ; potard + [NO] =
  defaut ; [PARAMETER] + [NO] = recharge la page depuis l'etat sauve ; [TRK] + [TRIG] + [NO] =
  recharge le preset ; [PRESET/KIT] + [NO] = recharge le kit ; [TRK] maintenu + changement de
  parametre puis [NO] avant de relacher [TRK] = annule le CONTROL ALL ; LIVE REC : [NO] + [TRIG]
  = efface en rythme les trigs de ces pistes ; STEP REC : [NO] = silence / efface le pas et avance ;
  [PAGE] + [NO] = reprise de la lecture de toutes les pages ; [PTN] ouvert : [NO] = sortir.
- [GARDER].

### 3.4 Touches PARAMETER (n. 9), groupe radio (une seule active)

LED commune : page active allumee ROUGE/ORANGE, inactives eteintes. En GRID REC, maintenir un trig
qui porte des locks allume en ROUGE les touches PARAMETER des pages qui contiennent des locks.
Communs a toutes : appui repete ou [UP]/[DOWN] = sous-page suivante (indicateur de page a droite de
l'ecran) ; maintenir = affiche toutes les valeurs de la page ; [PARAMETER] + [PLAY] = page aux
valeurs par defaut ; [PARAMETER] + [NO] = recharge l'etat sauve ; [PARAMETER] + [YES] = randomise
(pistes audio) ; [PARAMETER] + [RECORD] / [STOP] / [PLAY] = copier / coller / effacer la page.

| Touche | Primaire (pages) | Secondaire ([FUNC] +) | Etiquette |
|---|---|---|---|
| [TRIG] ("TRIG PARAMETERS") | TRIG page 1 (NOTE, VEL, LEN, PROB / LFO.T, FLT.T, FILL, COND) et page 2 (retrigs, portamento ; 2e appui en GRID REC) | QUANTIZE (TRACK sur E, PATTERN sur H) | [GARDER] |
| [SRC] | page SOURCE de la machine SRC (1 page) ; MIDI : CHAN, PROG, AT... | MACHINE menu (LEFT/RIGHT = categorie SRC/FLTR, UP/DOWN = machine, YES = assigner) | [GARDER] (machines = sons de Mika + synthes) |
| [FLTR] | FILTER page 1 (machine filtre) + page 2 (base-width) ; MIDI : CC 1-8 | SETUP menu (KIT et TRACK) | [GARDER] |
| [AMP] | AMP (enveloppe, 1 page) ; MIDI : CC 9-16 | SEQUENCER menu (euclidien) | [GARDER] |
| [FX] | FX de piste (bit reduction, overdrive, SRR, envois CHO/DEL/REV), vide en MIDI | SEND FX pages (1 DELAY, 2 REVERB, 3 CHORUS) | [GARDER] |
| [MOD] | MOD pages 1-3 (LFO 1, 2, 3) | MIXER pages (1 COMPRESSOR, 2 INTERNAL MIXER T1-8, 3 INTERNAL MIXER T9-16, 4 FX MIXER, 5 EXTERNAL MIXER) ; [FUNC] + [MOD] repete = page suivante | [GARDER] sauf EXTERNAL MIXER [SAMPLING: RETIRER] (entrees) |

### 3.5 Fleches (n. 11), groupe UP en haut, LEFT DOWN RIGHT en bas

- Primaire : navigation dans menus/listes ; [UP]/[DOWN] = sous-pages des pages PARAMETER ;
  certaines valeurs se reglent aux fleches.
- **[UP]** legende "Trig Mode" + "KB Octave" : [FUNC] + [UP] = TRIG MODE precedent/menu TRIG MODE ;
  [KEYBOARD] + [UP] = octave +1 ; en mode KEYBOARD avec U/D KEY MODE = KB OCT, [UP] seul = octave +1 ;
  [FUNC] + [UP] dans les listes = page precedente (defilement rapide) ; SONG EDIT : [FUNC] + [UP] =
  supprime la ligne ; [SONG] + [UP] en SONG mode = pointeur une ligne plus haut ; PAGE SETUP :
  [FUNC] + [UP] = longueur de piste en increments musicaux.
- **[DOWN]** legende "Trig Mode" : symetrique de [UP] (octave -1, TRIG MODE, page suivante) ;
  SONG EDIT : [FUNC] + [DOWN] = insere une ligne (copie de la ligne choisie) ; [SONG] + [DOWN] =
  pointeur une ligne plus bas.
- **[LEFT]** legende "uTime-" / **[RIGHT]** legende "uTime+" :
  - ecran principal : maintenir = pousse le tempo de -10 % / +10 % tant que la touche est tenue
    (nudge, pas besoin d'etre dans TEMPO) ;
  - [PTN] ouvert : banque precedente / suivante ;
  - GRID REC : [TRIG] maintenu + [LEFT]/[RIGHT] = micro timing du trig (pop-up) ; [TRIG] + [FUNC]
    maintenus + fleches = micro timing de tous les trigs ; [FUNC] + [LEFT]/[RIGHT] = decale tous
    les trigs de la piste d'un pas ; [PAGE] + [LEFT]/[RIGHT] = page de sequence ;
  - STEP REC : choisir/sauter le pas actif ;
  - listes presets/kits : [LEFT] = menu de tri, [RIGHT] = menu d'operations ;
  - createur de chaine : [FUNC] + [LEFT] = retire le dernier pattern ;
  - SONG mode : [SONG] + [LEFT] = boucle la ligne en cours (re-appui = reprise normale) ;
  - nommage : deplacer le curseur ; PRESET POOL trig mode : [PAGE] + [LEFT]/[RIGHT] = groupe de 16
    slots.
- LED : non documentee. [GARDER].

### 3.6 [PAGE] (n. 12) et <PATTERN PAGE> (n. 10)

**[PAGE]**, legende "Fill/Setup"
- Primaire : choisit la page de sequence (16 pas) a editer quand le pattern fait plus de 16 pas
  (jusqu'a 8 pages = 128 pas). Note : le texte 3.1 n. 12 du manuel est corrompu (copie/colle du
  texte copy pattern), le sens se deduit de 10.2.2 et 10.7.
- Secondaire : [FUNC] + [PAGE] = menu PAGE SETUP.
- FILL : [YES] + [PAGE] = FILL pour un cycle (actif au prochain bouclage, jusqu'au suivant) ;
  maintenir [PAGE] pendant la lecture (hors GRID REC) = FILL momentane ; [PAGE] + [YES] puis relacher
  [PAGE] avant [YES] = FILL verrouille ; [PAGE] a nouveau = deverrouille.
- GRID REC : [PAGE] + [LEFT]/[RIGHT] = page ; [PAGE] + [TRIG 1-8] allumes = saut a la page ;
  [PAGE] + [TRIG 9-16] = choisir les pages a jouer en boucle (TRIG verts) ; [PAGE] + [NO] = toutes
  les pages ; [PAGE] + [RECORD]/[STOP]/[PLAY] = copier/coller/effacer la page ; [TRIG] + [PAGE] +
  potard = lock sur tous les trigs de la page.
- PAGE SETUP : appuis repetes = change vite la longueur totale ; SLICES / PRESET POOL trig modes :
  groupe de 16 suivant.
- [GARDER].

**<PATTERN PAGE>** : 8 LEDs (2 x 4). Indiquent combien de pages compte le pattern et laquelle est
active : page active pleinement allumee, la page EN LECTURE clignote. (Ordre probable : 1-4 en
haut, 5-8 en bas, gauche a droite ; non dit explicitement.) [GARDER].

### 3.7 Transport (n. 17, 18, 19)

**[RECORD]** (cercle), legende "Copy"
- Primaire : GRID RECORDING on/off. [RECORD] + [PLAY] = LIVE RECORDING ; [RECORD] + double [PLAY] =
  quantize live rec on/off ; [RECORD] + [STOP] = STEP RECORDING ; [RECORD] + double [STOP] = STEP
  REC STANDARD / JUMP.
- Secondaire : [FUNC] + [RECORD] = COPIER (pattern hors GRID REC, piste en GRID REC, ligne en SONG
  EDIT, texte en nommage...). [TRIG] + [RECORD] = copie trig(s) ; [TRK] + [RECORD] = copie preset ;
  [PAGE] + [RECORD] = page ; [PARAMETER] + [RECORD] = page de parametres ; [PTN] ouvert : [TRIG] +
  [RECORD] = copie ce pattern.
- LED : ROUGE fixe = GRID REC ; ROUGE clignotant = LIVE REC ; ROUGE double clignotement = STEP REC ;
  BLEU = mode euclidien actif sur la piste (10.3). [GARDER].

**[PLAY]** (triangle), legende "Clear"
- Primaire : lance la lecture ; 2e appui = pause ; appui suivant = reprise. En LIVE REC, [PLAY] =
  quitte l'enregistrement sans arreter.
- Secondaire : [FUNC] + [PLAY] = EFFACER (pattern / piste / ligne de song remise aux reglages du
  pattern). Re-appui = annule. [TRIG] + [PLAY] = efface les locks du trig ; [TRK] + [PLAY] = efface
  le preset ; [PAGE] + [PLAY] = page ; [PARAMETER] + [PLAY] = page de parametres aux defauts ;
  [PTN] ouvert : [TRIG] + [PLAY] = efface ce pattern.
- LED : non documentee dans le manuel. [GARDER].

**[STOP]** (carre), legende "Paste"
- Primaire : arrete toutes les pistes (les FX continuent leur traine). Arrete puis double [STOP]
  rapide = coupe tout avec fondu court des FX. En SONG : double [STOP] = pointeur au debut.
- Secondaire : [FUNC] + [STOP] = COLLER. [TRIG] + [STOP], [TRK] + [STOP], [PAGE] + [STOP],
  [PARAMETER] + [STOP], [PTN] ouvert : [TRIG] + [STOP] = coller sur ce pattern.
- LED : non documentee. [GARDER].

Regles copier/coller (6.4, 10.8.5) : presse-papier a UN seul element ; refaire la meme combinaison
annule un coller/effacer ; copie de pattern seulement hors GRID REC ; copie de piste et de trigs
seulement en GRID REC ; collage de plusieurs trigs = meme ecart relatif, a partir du trig cible.

### 3.8 Colonne gauche

**[FUNC]** (n. 21) : touche "shift". Maintenir + appui court sur une autre touche = sa fonction
orange. Maintenu seul : sur l'ecran de nommage = pop-up de caracteres ; en MUTE = preparer des
mutes (validation au relachement) ; dans TEMPO (mode PRJ) avec A = tempo "prepare" applique au
relachement ("PREP." clignote en bas a gauche) ; au demarrage = STARTUP menu [MATERIEL: RETIRER].
Combinaisons [FUNC] + [TRIG] : hors REC = QUICK MUTE ; en GRID REC = pose un LOCK TRIG ; en STEP
REC = pose une note trig sur la piste correspondante. LED : non documentee. [GARDER].

**[KEYBOARD]** (n. 20), icone piano, legende "KB Setup"
- Primaire : KEYBOARD mode on/off (les TRIG jouent la piste active en chromatique).
- Secondaire : [FUNC] + [KEYBOARD] = KEYBOARD SETUP.
- Autres : [KEYBOARD] + [UP]/[DOWN] = octave ; STEP REC : [KEYBOARD] maintenu + TRIG allume = note
  ; dans PRESET LOAD, [KEYBOARD] puis TRIG = pre-ecoute dans la gamme.
- LED : non documentee pour la touche ; les TRIG s'allument en motif de clavier. [GARDER].

**[TRK]** (n. 16), legende "Mute Mode"
- Primaire : [TRK] + [TRIG 1-16] = choisir la piste active (sans la jouer).
- Secondaire : [FUNC] + [TRK] = GLOBAL MUTE mode (entrer / sortir) ; [FUNC] + double [TRK] =
  PATTERN MUTE mode. La machine reprend le dernier type de mute utilise.
- Autres : maintenir [TRK] + tourner un potard = CONTROL ALL (pistes audio choisies dans SETUP >
  KIT > CONTROL ALL CONFIG + toujours la piste active ; pas pour les pistes MIDI ; [NO] avant de
  relacher = annuler) ; [TRK] + [RECORD]/[STOP]/[PLAY] = copier/coller/effacer le preset de la
  piste ; [TRK] + [TRIG] + [NO] = recharger le preset ; [TRIG] + [TRK] + potard = lock sur tous
  les trigs de la page ; en mode TRK SELECT INVERTED : [TRK] + [TRIG] joue sans selectionner.
- [GARDER].

**[PTN]** (n. 15), legende "Bank"
- Primaire : [PTN] puis [LEFT]/[RIGHT] (banque) puis [TRIG 1-16] (pattern) ; [PTN] + [TRIG] =
  pattern de la banque courante ; [PTN] ou [NO] = sortir.
- Secondaire : [FUNC] + [PTN] = selection de banque "a l'ancienne" : [TRIG 9-16] = banques A-H,
  puis [TRIG 1-16] = pattern.
- Autres : [PTN] puis [FUNC] + [YES] = createur de chaine ; methode legacy : maintenir [PTN] +
  TRIG (1er), relacher, puis enchainer les TRIG en gardant le precedent appuye ; [PTN] puis
  [TRIG] + [RECORD]/[STOP]/[PLAY] = copier/coller/effacer un pattern sans quitter l'actif ; en SONG
  mode, choisir un pattern = sortir du SONG mode.
- LEDs TRIG pendant la selection : BLANC = pattern contenant des donnees, ROUGE = pattern actif,
  eteint = vide. Pattern en attente : sa position clignote en haut a gauche de l'ecran jusqu'au
  changement (fin du pattern en cours). [GARDER].

**[SONG]** (n. 14), legende "Song Edit"
- Primaire : [SONG] + [TRIG 1-16] = choisir un song (1-16) et entrer en SONG mode.
- Secondaire : [FUNC] + [SONG] = ecran SONG EDIT (entrer / sortir) ; [SONG] deux fois en SONG mode
  = SONG EDIT.
- Autres : [SONG] + [LEFT] = boucle la ligne ; [SONG] + [UP]/[DOWN] = ligne suivante a jouer.
- [GARDER].

### 3.9 [TRIG 1-16] (n. 13)

- Primaire : selon le TRIG MODE (TRACKS par defaut : joue la piste correspondante ; en reglage TRK
  SELECT = NORMAL, l'appui SELECTIONNE la piste et la JOUE). En GRID REC : pose / enleve des note
  trigs sur la piste active (appui court sur un trig existant = l'enleve ; appui un peu plus long =
  le prepare pour edition sans l'enlever). En KEYBOARD : clavier. Avec [TRK] / [PTN] / [SONG] /
  [FUNC]+[PTN] : piste / pattern / song / banque. Dans les menus de configuration : cases a cocher
  (CONTROL ALL CONFIG, COMPRESSOR ROUTING, TO MAIN, TO FX, ROW MUTE) ; dans les listes : pre-ecoute
  (TRIG de la piste active) ; dans le selecteur de banque : [TRIG 8-16] ou [9-16] = A-H.
- Secondaire (legende "Track/Mute") : [FUNC] + [TRIG] = QUICK MUTE de la piste (hors REC).
- Maintien : [TRIG] maintenu + potard = parameter lock ; + LEVEL/DATA = preset lock ; + [YES] =
  pre-ecoute du trig ; + [PRESET/KIT] = sauver en preset ; + [LEFT]/[RIGHT] = micro timing ;
  + [RECORD]/[STOP]/[PLAY] = copier/coller/effacer ; plusieurs TRIG maintenus = operations
  multiples ; avec un clavier MIDI : maintenir + jouer = NOTE/VEL (accord 4 notes en MIDI)
  [MIDI EXT: OPTIONNEL].
- LEDs : voir le code couleur complet en 5.2.
- [GARDER].

---------------------------------------------------------------------------------------------------

## 4. Ecran

### 4.1 Ecran principal (fig. 6, page 18 ; meme gabarit pour toutes les pages PARAMETER)

OLED 128 x 64, monochrome. Zones :

| n. | Zone | Place | Contenu |
|---|---|---|---|
| 1 | Banque + pattern | bandeau haut, a gauche, dans une case inversee | "A01" |
| 2 | Nom du pattern | bandeau haut, grand, apres la case | "WISPDISK" (sur la page SRC ce champ montre le nom de la machine, ex "Oneshot", fig. 9.7) ; "P" clignotant juste apres = PERFORM KIT actif |
| 3 | TRIG MODE | bandeau haut, icone avant le tempo | icone du mode (lignes = TRACKS ; barres = VELOCITIES ; etc.) |
| 4 | Tempo | bandeau haut, a droite | icone metronome + "147.0" |
| 9 | Type de piste | colonne gauche, en haut, dans un cadre | "SMP" (audio) ou "MID" (MIDI) |
| 8 | Piste active | meme cadre, sous le type | grand chiffre "1" |
| 7 | Niveau de piste | colonne gauche, en bas | fader vertical + echelle pointillee, legende "LEV" (LEVEL/DATA) |
| 5 | 8 parametres | grille 2 x 4 au centre, encadree | chaque case : un graphique (molette/arc, curseur vertical, interrupteur pilule, valeur texte "100%", note "C 5 (60)" encadree, cadenas = parametre de lock) + etiquette 4 lettres dessous (NOTE VEL LEN PROB / LFO.T FLT.T FILL COND sur TRIG 1). Place de chaque case = place du potard A..H |
| 6 | Indicateur de page | bord droit, vertical | petits traits : nombre de sous-pages de la section + celle affichee |

Etats visibles sur cet ecran :
- Parameter lock : le graphique du parametre lock passe en INVERSE et affiche la valeur lockee
  (pendant le maintien du trig).
- Pattern en attente : la position du nouveau pattern clignote en haut a gauche.
- SONG mode en lecture : le haut de l'ecran montre n. du song, ligne jouee / nb total de lignes,
  LABEL de la ligne, banque/pattern, et sert de barre de progression de la ligne.
- MUTE mode : en haut, apercu des 16 pistes : carre = non mute, trait horizontal = mute,
  "+" = prepare a demuter, "X" = prepare a muter.
- TEMPO prepare : "PREP." clignote en bas a gauche.
- Economiseur : ecran attenue apres 5 min sans action, eteint apres 60 min ; toute touche ou potard
  le reveille. (Optionnel en web.)
- Maintenir une touche PARAMETER = toutes les valeurs de la page en clair.

### 4.2 Ecrans de menus (figures des ch. 6 a 9)

- **TEMPO** (fig. 7.3) : en-tete "TEMPO | SWING" ; gros chiffre BPM "147.0" avec "(PRJ)" ou
  (PTN) au dessus ; icones metronome et double croche ; rangee 1 : BPM (A), FINE (B), "---" (C),
  SWING 50 % (D, 50 a 80 %) ; trait pointille ; rangee 2 : METRO on/off (E), SIG. 4/4 (F),
  PREROLL OFF (G, mesures avant LIVE REC), VOL 64 (H). [FUNC] + E = mode tempo PROJET / PATTERN ;
  A ou LEVEL/DATA = BPM (pousser = pas de 4 BPM), B = decimales ; [FUNC] + A (mode PRJ) = valeur
  appliquee au relachement de [FUNC].
- **KEYBOARD SETUP** (fig. 8.5.2) : en-tete "T1" (piste) + "fleches : OCTAVE +/-" ; dessin d'un
  clavier piano d'une octave avec ronds sur les notes jouables ; KB SCALE (E, ex "WHTN"), ROOT NOTE
  (F, ex "C5"), case vide (G), KB FOLD (H, ON/OFF). [UP]/[DOWN] = octave, [NO] = sortir. Reglages
  stockes dans le pattern actif.
- **TRIG MODE** (fig. 8.5.4) : pop-up "TRIG MODE" par dessus l'ecran principal, liste avec icone :
  TRACKS, VELOCITIES, RETRIGS, SLICES, PRESET POOL ; ligne choisie surlignee. [FUNC] + [UP]/[DOWN].
- **NOMMAGE** (fig. 6.5) : titre "PATTERN NAME" (icone crayon) ; champ "A01: WISPDISK" avec
  curseur inverse ; aide en bas en 2 colonnes : "FUNC+ARROW:EDIT, FUNC+NO:DELETE,
  FUNC+YES:INSERT, YES:SAVE" et "SETTINGS:RANDOM, U/D:CHAR +/-, L/R:MOVE CURSOR, NO:ABORT".
  Pop-up de caracteres : [FUNC] maintenu + fleches pour choisir, relacher [FUNC] pour inserer.
  Copier / coller / effacer disponibles.
- **PRESET BROWSER** (fig. 9.2) : titre "LOAD PRESET > TRACK 1" ; liste : ligne courante en grand
  ("A:001" + nom "STRANGENESS" + tag "KICK" a droite), autres lignes "A:002 NO NO NO"... ; barre de
  defilement a droite. [LEFT] = panneau de tri a gauche (ADD TO PRESET POOL, SEL BANK (ALL), SORT
  ABC, FILTER, SEARCH).
- **PRESET MANAGER** (fig. 9.3.3) : titre "PRESET MANAGER" ; lignes "A:001 STRANGENESS" + jusqu'a
  2 tags en etiquettes (KICK, CLAP SFX, KICK DARK, MIDI, HHAT METL, HARD...) ; petites fleches aux
  bords gauche/droit = panneaux tri (LEFT) et operations (RIGHT) ; damier de defilement a droite.
- **POOL** (fig. 9.3.4) : meme liste, slots ":::001" a ":::128".
- **KIT MANAGER** (fig. 9.3.7) : "A:001 KITTY", "A:002 NEW DONK"...
- **SETUP** (fig. 9.8) : titre "SETUP" ; colonne gauche = sections "KIT" puis "TRACK 14" (piste
  active) ; colonne droite = items avec valeur ou "..." (sous-menu) : CONTROL ALL CONFIG...,
  COMPRESSOR ROUTING..., TRACK SWAP ..., LEGATO OFF, NOTE PRIORITY LAST...
- **CONTROL ALL CONFIG** (fig. 9.8.1) : "SELECT AFFECTED TRACKS:" ; 16 cases numerotees en 2 x 8
  (pleine = choisie, la piste active a un symbole a part) ; pied "TRG 1-16". COMPRESSOR ROUTING :
  meme grille "SELECT TRACKS:" + page 2 "IN L R" [SAMPLING: RETIRER] et "SEND FX" [GARDER].
  TRACK SWAP : "HOLD 2 TRACKS TO SWAP THEM", "TRACK 2 (KICKOR) <-> TRACK 5 (SQUELCH)" + barre de
  progression pendant le maintien.
- **MODULATION SETUP** (KEY TRACKING, VELOCITY MOD, AFTERTOUCH, PITCH BEND, MOD WHEEL, BREATH) :
  titre + nom de la source ; 4 colonnes destination (ex SRC TUNE, FLTR ATK, FX OVER, LFO1 WAVE)
  choisies avec A-D, profondeur avec E-H (molettes + valeur "18.49") ; barre verticale a gauche =
  valeur d'entree testee avec LEVEL/DATA.
- **Liste de samples sur SRC** (fig. 9.7) : en-tete "Yes:coche No:X Fn+Yes:D" ; onglets
  "< A B C D E F G H >" ; lignes "000 OFF, 001 BD Dirty, 002 SD Deep 2..." ; ouverte en tournant D
  (parametre SAMP). [GARDER] la liste (alimentee par la banque de Mika + sons synthes), retirer
  "Fn+Yes" (aller au slot +Drive) [SAMPLING: RETIRER].
- **Ecran SRC Oneshot** (fig. 9.7) : TUNE, PLAY, (vide), SAMP ("A 1") / STRT, LEN, LOOP, LEV.

---------------------------------------------------------------------------------------------------

## 5. Modes des TRIG keys et code couleur

### 5.1 Modes

- **TRIG MODE** ([FUNC] + [UP]/[DOWN], commun a toutes les pistes, enregistrable en LIVE REC) :
  - TRACKS (defaut) : TRIG n = joue la piste n.
  - VELOCITIES : joue la piste active a la velocite 8, 16, 24 ... 120 pour TRIG 1-15, 127 pour
    TRIG 16 (pas de 8).
  - RETRIGS : joue la piste active avec un retrig : 1/1, 1/2, 1/3, 1/4, 1/5, 1/6, 1/8, 1/12, 1/16,
    1/20, 1/24, 1/32, 1/40, 1/48, 1/64, 1/80 (TRIG 1 a 16).
  - SLICES : TRIG n = slice n des machines GRID / SLICE (BLEU = slice presente ; [PAGE] = 16
    suivantes ; autre machine : TRIG 1 = sample entier). [A ARBITRER] : depend des machines de
    decoupe de sample.
  - PRESET POOL : TRIG 1-16 = slots 1-16 du pool ; [PAGE] + [RIGHT]/[LEFT] = groupes 17-32 etc.
    [GARDER].
  - RETRIGS, SLICES et PRESET POOL : pistes audio seulement.
  - En STEP REC avec SLICES ou PRESET POOL : [FUNC] + TRIG pour poser.
- **KEYBOARD mode** : avec KB SCALE = CHROMATIC et KB FOLD = OFF, les TRIG s'allument comme une
  octave de piano, seules les touches allumees jouent ; TRIG 9 a TRIG 16 = une octave (rangee basse
  = touches blanches, rangee haute = noires, par deduction du motif piano) ; plage totale C0 a G10,
  transposition 4 octaves au dessus et 5 en dessous de l'octave centrale. Etat d'octave NON stocke
  par pattern (reste comme il etait). KB FOLD ON : toutes les TRIG jouent ; TRIG 9 = note la plus
  basse, monte jusqu'a TRIG 16 puis continue sur TRIG 1-8 ; si la gamme a moins de 8 notes, les
  TRIG du bas restants repetent les premieres du haut ; TRIG BLEUS = notes a une ou plusieurs
  octaves d'ecart (exemple gamme par tons : TRIG 15-16 = TRIG 1-2, TRIG 1 et 15 = octave au dessus
  de TRIG 9, TRIG 7 = 2 octaves). Liste des gammes : annexe D. Notes jouees enregistrables en LIVE
  REC.
- **MUTE mode** : toutes les pistes accessibles quelle que soit la piste active. TRIG = mute /
  unmute. Allume = non mute, eteint = mute.
  - GLOBAL MUTE ([FUNC] + [TRK]) : mutes valables dans tous les patterns, sauves avec le PROJET ;
    TRIG en VERT ; piste mutee qui a des trigs = VERT clignotant pendant la lecture.
  - PATTERN MUTE ([FUNC] + double [TRK]) : mutes du pattern actif seulement, sauves avec le
    PATTERN ; TRIG en MAGENTA ; clignotement MAGENTA idem. Mutee dans les deux = magenta
    clignotant dans les deux modes.
  - Preparation : [FUNC] maintenu + TRIG = prepare, applique au relachement de [FUNC].
  - QUICK MUTE : [FUNC] + TRIG hors mode MUTE ; utilise le dernier type de mute.
- **GRID / LIVE / STEP RECORDING** : modes de saisie des TRIG (detail ch. 10, autre agent) ; ce qui
  touche les touches est liste en 3.7 et 6.

### 5.2 Code couleur des LEDs (toutes sources)

| Element | Couleur / comportement | Signification |
|---|---|---|
| TRIG | ROUGE fixe | note trig sur ce pas (GRID/STEP REC) ; piste active (selection de piste en GRID/STEP REC) ; pattern actif (selection PTN) |
| TRIG | JAUNE fixe | lock trig (sans note) |
| TRIG | ROUGE ou JAUNE clignotant | trig qui porte des parameter locks |
| TRIG | lumiere qui court sur les 16 pas | position de lecture (lecture ou LIVE REC), sur toutes les pages |
| TRIG | flash bref a l'appui | jeu d'un preset (9.4) |
| TRIG | BLANC | pattern contenant des donnees (selection PTN) |
| TRIG | eteint | pas vide / pattern vide / piste mutee (MUTE) |
| TRIG | VERT / VERT clignotant | GLOBAL MUTE : piste active / mutee avec trigs en lecture |
| TRIG | MAGENTA / MAGENTA clignotant | PATTERN MUTE : idem |
| TRIG | motif piano / BLEU | KEYBOARD : notes jouables / KB FOLD notes a l'octave |
| TRIG | BLEU | SLICES : slice presente ; mode euclidien : trigs generes |
| TRIG | VERT double clignotement | STEP REC : pas actif |
| TRIG 9-16 | VERT | pages choisies pour la boucle ([PAGE] maintenu) ; TRIG 1-8 clignotant = position maitre, TRIG 9-16 clignotant = page en lecture |
| TRIG | VERT | TO MAIN / TO FX : piste envoyee |
| PARAMETER | ROUGE/ORANGE / eteint | page active / inactive ; ROUGE en maintenant un trig = page qui contient des locks |
| RECORD | ROUGE fixe / clignotant / double clignotement / BLEU | GRID REC / LIVE REC / STEP REC / euclidien actif |
| PRESET/KIT | ORANGE | PERFORM KIT actif |
| <PATTERN PAGE> | allumee / clignotante | page active / page en lecture ; nombre de LEDs allumees = nombre de pages |
| Toutes | LED INTENSITY LOW/MID/MAX ; LED BACKLIGHT on/off | toutes les touches ont un retroeclairage de repos |
| PLAY, STOP, FUNC, TRK, PTN, SONG, KEYBOARD, TEMPO, SETTINGS, YES, NO, fleches, PAGE | non documente | a definir par nous (proposition : retroeclairage faible, PLAY vert en lecture) |

---------------------------------------------------------------------------------------------------

## 6. Catalogue des combinaisons et gestes

### 6.1 Types de gestes a gerer (important pour la saisie web : souris, tactile, clavier)

1. Appui court.
2. Maintien (la fonction dure tant que c'est tenu : FILL momentane, nudge tempo, affichage de toutes
   les valeurs, micro timing, preparation de mute, pop-up nommage).
3. Maintien A + appui court B (toutes les [FUNC] +, [TRK] + TRIG, [TRIG] + touche...).
4. Maintien A + tourner un potard (lock, Control All, preset lock, [FUNC] + saut de valeur).
5. Pousser un potard en tournant (grands pas) ; pousser un potard + [NO] (defaut) ; maintenir
   TRIG + pousser un potard (suppression de lock).
6. Double appui : [FUNC] + double [TRK] ; [RECORD] + double [PLAY] ; [RECORD] + double [STOP] ;
   double [STOP] ; [PLAY] deux fois (pause) ; [SONG] deux fois ; [TRIG PARAMETERS] deux fois.
7. Ordre de relachement : [PAGE] + [YES], relacher [PAGE] d'abord = FILL verrouille ; actions
   validees au relachement de [FUNC] (mutes prepares, caractere du pop-up, tempo PREP.).
8. Appui court vs appui un peu long sur un TRIG en GRID REC (enlever vs preparer l'edition).
9. Maintien ~1 s de [SETTINGS] puis TRIG (raccourci LEDs).
10. Taper en rythme ([FUNC] + [TEMPO]).
11. Plusieurs TRIG maintenus a la fois (copie multiple, micro timing multiple, maintien de 2 TRIG
    pour TRACK SWAP, chaine legacy).

### 6.2 Liste complete par theme

Navigation
- [ARROW] = naviguer ; LEVEL/DATA = defiler ; [YES] = entrer/valider/cocher ; [NO] = retour (en
  boucle jusqu'a l'ecran principal) ; [FUNC] + [UP]/[DOWN] = page de liste suivante/precedente.

Edition de parametres
- Potard = valeur ; pousser + tourner = grands pas ; potard + [NO] = defaut ; [FUNC] pendant
  l'edition = saut de valeur (NOTE en octaves, delay en valeurs BPM).
- Maintenir [PARAMETER] = voir toutes les valeurs ; [PARAMETER] + [PLAY] = defauts ;
  [PARAMETER] + [NO] = etat sauve ; [PARAMETER] + [YES] = aleatoire ; appui repete ou
  [UP]/[DOWN] = sous-page.
- [TRK] maintenu + potard = CONTROL ALL ; [NO] avant relachement = annuler.
- LEVEL/DATA = niveau de la piste active.

Pistes, patterns, banques, songs
- [TRK] + [TRIG 1-16] = piste ; [PTN] (+ [LEFT]/[RIGHT]) + [TRIG 1-16] = banque/pattern ;
  [FUNC] + [PTN] puis [TRIG 9-16] = banque, puis [TRIG 1-16] = pattern ; [SONG] + [TRIG 1-16] =
  song.
- Chaine : [PTN] puis [FUNC] + [YES] (createur, 64 patterns max, toutes banques) ; [FUNC] + [LEFT]
  = retirer le dernier ; [YES] valider / [NO] annuler ; legacy : maintenir [PTN] + TRIG, relacher,
  puis TRIG en chainant les maintiens. Chaine perdue au changement de pattern/song ou a l'extinction.

Copier / coller / effacer
- [FUNC] + [RECORD] / [STOP] / [PLAY] : pattern (hors GRID REC), sequence de la piste active (en GRID
  REC), ligne de song (SONG EDIT), texte (nommage).
- [TRIG] + [RECORD] / [STOP] / [PLAY] : trig(s) avec locks (GRID REC) ; en [PTN] ouvert : pattern
  cible sans quitter l'actif.
- [TRK] + [RECORD] / [STOP] / [PLAY] : preset de la piste (9.5 : [TRK] + [TRIG] + [RECORD] puis
  [TRK] + [TRIG] + [STOP] pour copier vers une autre piste).
- [PAGE] + [RECORD] / [STOP] / [PLAY] : page de sequence (GRID REC).
- [PARAMETER] + [RECORD] / [STOP] / [PLAY] : page de parametres.
- Refaire la combinaison = annuler coller/effacer.

Sauvegarde et rechargement
- [FUNC] + [YES] = temp save pattern ; [FUNC] + [NO] = temp reload (pas en STEP REC).
- [FUNC] + [SETTINGS] = sauver le projet.
- [TRK] + [TRIG 1-16] + [NO] = recharger le preset.
- [PRESET/KIT] + [NO] / [YES] = recharger / sauver le kit (PERFORM KIT).
- [TRIG] + [PRESET/KIT] (GRID REC) = sauver le son du trig en preset (locks inclus).

Acces aux menus
- [FUNC] + [TRIG PARAM] = QUANTIZE ; + [SRC] = MACHINE ; + [FLTR] = SETUP ; + [AMP] = SEQUENCER
  (euclidien) ; + [FX] = SEND FX ; + [MOD] = MIXER ; + [PAGE] = PAGE SETUP ; + [KEYBOARD] =
  KEYBOARD SETUP ; + [SONG] = SONG EDIT ; + [PRESET/KIT] = PERFORM KIT ; + [SAMPLING] = SAMPLES
  [SAMPLING: RETIRER] ; [FUNC] + tourner LEVEL/DATA = PRESET BROWSER.

Tempo
- [TEMPO] = menu ; [FUNC] + [TEMPO] = tap ; [TEMPO] + [YES] = metronome ; maintenir [LEFT]/[RIGHT]
  sur l'ecran principal = nudge -/+10 % temporaire.

Sequenceur (touches seulement, le detail est au ch. 10)
- [RECORD] = GRID REC ; [RECORD] + [PLAY] = LIVE REC ; [RECORD] + double [PLAY] = quantize live ;
  [RECORD] + [STOP] = STEP REC ; [RECORD] + double [STOP] = STANDARD / JUMP ; [PLAY] en LIVE REC =
  sortir en continuant ; [RECORD] en LIVE REC = passer en GRID REC.
- GRID REC : TRIG = note trig ; [FUNC] + TRIG = lock trig ; TRIG maintenu + potard = lock ;
  TRIG + pousser potard = retire le lock ; TRIG + [LEFT]/[RIGHT] = micro timing ; TRIG + [FUNC] +
  fleches = micro timing de tous ; [FUNC] + [LEFT]/[RIGHT] = decaler tous les trigs ;
  [TRIG PARAM] deux fois = page retrigs ; [TRIG] + [PAGE] ou [TRK] + potard = lock sur tous les
  trigs de la page ; TRIG + LEVEL/DATA = preset lock ; TRIG + [YES] = pre-ecoute.
- LIVE REC : potards = locks enregistres ; [NO] + TRIG = effacer en rythme ; [NO] + potard maintenu
  = effacer un lock en rythme.
- STEP REC : TRIG = pas actif ; [FUNC] + TRIG = note sur la piste n ; [KEYBOARD] maintenu + TRIG
  allume = note chromatique ; [NO] = silence ; [YES] maintenu = longueur ; [LEFT]/[RIGHT] = pas.
- PAGE SETUP : [FUNC] + [YES] = PER PATTERN / PER TRACK ; [FUNC] + [UP]/[DOWN] = longueur en
  increments musicaux ; [PAGE] repete = longueur totale ; TRIG = nombre de pas.
- Euclidien : [FUNC] maintenu en coupant EUC = convertit en trigs normaux.

Fill
- [YES] + [PAGE] = un cycle ; maintenir [PAGE] = momentane ; [PAGE] + [YES] relacher [PAGE] avant
  = verrouille ; [PAGE] = deverrouille.

Mutes et modes
- [FUNC] + TRIG = QUICK MUTE ; [FUNC] + [TRK] = GLOBAL MUTE ; [FUNC] + double [TRK] = PATTERN MUTE ;
  en MUTE, [FUNC] maintenu + TRIG = preparer.
- [KEYBOARD] = KEYBOARD mode ; [KEYBOARD] + [UP]/[DOWN] = octave ; [FUNC] + [UP]/[DOWN] = TRIG MODE.

Song
- [SONG] + TRIG = song ; [FUNC] + [SONG] ou [SONG] x2 = SONG EDIT ; [SONG] + [LEFT] = boucle ligne ;
  [SONG] + [UP]/[DOWN] = ligne suivante ; SONG EDIT : [FUNC] + [RECORD]/[STOP]/[PLAY] = copier /
  coller / remettre la ligne ; [FUNC] + [DOWN] = ajouter ligne ; [FUNC] + [UP] = supprimer ; [YES]
  sur un n. de ligne = y placer le pointeur ; TRIG = pre-ecoute des presets du pattern de la ligne ;
  [TEMPO] ou [YES] sur BPM = tempo de la ligne ; [FUNC] + tourner sur PTN = changer vite de banque ;
  [NO] ou [FUNC] + [SONG] = sortir ; [STOP] puis [PLAY] = reprendre ; [STOP] x2 = debut.

Nommage
- [LEFT]/[RIGHT] = curseur ; LEVEL/DATA ou [UP]/[DOWN] = caractere ; [FUNC] + [NO] = effacer ;
  [FUNC] + [YES] = espace ; [SETTINGS] = nom aleatoire ; maintenir [FUNC] = pop-up (fleches +
  relacher) ; [YES] = sauver ; [NO] = abandonner.

Pre-ecoute
- [FUNC] + [YES] dans PRESET BROWSER / MANAGER = pre-ecoute du preset ; TRIG de la piste active dans
  les listes = pre-ecoute ; [TRIG] + [YES] (GRID/STEP REC) = trig. (SAMPLES menu [FUNC] + [YES] :
  [SAMPLING: RETIRER].)
- Rappel projet : jamais de lecture audio reelle pendant les tests automatiques (CLAUDE.md), ces
  pre-ecoutes doivent etre testees par le DOM.

Reglages rapides
- Maintenir [SETTINGS] ~1 s + [TRIG 1-3] = intensite LEDs ; + [TRIG 9] = retroeclairage.

MIDI externe [MIDI EXT: OPTIONNEL] (8.4)
- Notes 0-15 (C0 a D#1) = jouent les pistes 1-16 (canaux par defaut 1-16), quelle que soit la piste
  active ; notes 16-84 (E2 a C7) = piste active en chromatique ; Program Change 0-127 = patterns
  A01 a H16 ; CC/NRPN = parametres (annexe B) ; clavier MIDI sur l'AUTO CHANNEL = joue la piste
  active meme hors KEYBOARD mode.

Materiel [MATERIEL: RETIRER]
- [FUNC] au demarrage = STARTUP MENU (TRIG 1 test, 2 empty reset, 3 factory reset, 4 OS upgrade,
  5 exit). A la rigueur : "empty reset" et "factory reset" peuvent devenir des commandes web.

---------------------------------------------------------------------------------------------------

## 7. Menus atteignables depuis les touches (arborescence)

### 7.1 [PRESET/KIT] : menu PRESET/KIT

Navigation [ARROW] + LEVEL/DATA, [YES] = choisir, [NO] = sortir.

- PRESET
  - LOAD : liste du +Drive (2048 presets, banques A-H de 256, slots "A:001") ; [YES] = charger
    sur la piste active ; [TRK] + TRIG = changer de piste ; TRIG de la piste = pre-ecoute ;
    [KEYBOARD] puis TRIG = pre-ecoute dans la gamme ; [FUNC] + [UP]/[DOWN] = defilement rapide.
  - SAVE : choisir un slot ([UP]/[DOWN] ou LEVEL/DATA), [YES], confirmation si occupe, ecran
    NOMMAGE, ecran TAGS (fleches + [YES], les 2 premiers tags s'affichent), "<SAVE>" + [YES].
  - MANAGE (PRESET MANAGER) : liste ; [YES] sur un item = le selectionner (multi-selection).
  - POOL : gestion du pool du projet (128 slots).
  - Panneau de TRI ([LEFT], sortie [NO] ou [RIGHT]) : ADD TO PRESET POOL ; SELECT BANK (A-H, banque
    courante entre parentheses, choix par [TRIG 8-16] ou [9-16] selon les pages du manuel, fleches
    ou LEVEL/DATA ; "ALL") ; SORT ABC / SORT 123 ; FILTER (liste de tags, multi-choix [YES],
    sortie [NO]) ; SEARCH (recherche texte via l'ecran de nommage, [FUNC] + [NO] = effacer) ;
    SHOW ALL SLOTS (case, dans SAVE et MANAGE).
  - Panneau d'OPERATIONS presets ([RIGHT], sortie [NO] ou [LEFT]) : LOAD TO TRACK, COPY TO BANK
    (vers les premiers slots libres d'une banque), SAVE TO HERE, RENAME, EDIT TAGS, DELETE, SELECT
    ALL, DESELECT ALL, TOGGLE (protection en ecriture, cadenas devant le nom, +Drive seulement),
    SEND SYSEX [MATERIEL: RETIRER].
  - Operations du POOL : LOAD TO TRACK, SAVE TO HERE, RENAME, DELETE, SELECT ALL, SELECT UNUSED
    (presets utilises par aucun pattern du projet), DESELECT ALL.
- KIT
  - LOAD : liste des kits, [YES] = charger dans le pattern actif.
  - SAVE : slot, confirmation, nommage.
  - MANAGE (KIT MANAGER).
  - TRI kits : ADD TO POOL (les 16 presets du kit vont au pool), SORT ABC / 123, SELECT BANK (A-H),
    SEARCH, SHOW ALL SLOTS (dans SAVE).
  - OPERATIONS kits : LOAD TO PATTERN, COPY TO BANK, SAVE TO HERE, LOAD TO EMPTY (charge le kit
    dans tous les patterns vides du projet), RENAME, DELETE, SELECT ALL, SELECT UNUSED, DESELECT
    ALL, TOGGLE, SEND SYSEX [MATERIEL: RETIRER].
- Tags vus sur les ecrans : KICK, CLAP, SFX, DARK, MIDI, HHAT, METL, HARD (liste complete non
  donnee dans ces chapitres). Les presets MIDI sont tagues MIDI d'office et n'entrent pas au pool.
- Ajout au pool (9.1.1) : PRESET/KIT > MANAGE, selectionner ([YES]), [LEFT] > ADD TO PRESET POOL.

### 7.2 [FUNC] + [PRESET/KIT] : PERFORM KIT mode

- Les changements de presets ne sont PAS auto sauves dans le pattern et le kit n'est PAS recharge
  au changement de pattern : on garde le kit triture d'un pattern a l'autre.
- "P" clignotant apres le nom du pattern, [PRESET/KIT] ORANGE.
- [PRESET/KIT] + [NO] = recharge le kit du pattern ; [PRESET/KIT] + [YES] = SAVE (KIT).
- Temp save / temp reload restent actifs. Rien n'est garde a l'extinction sans sauvegarde.

### 7.3 [SETTINGS] : menu SETTINGS

([UP]/[DOWN] ou LEVEL/DATA, [YES] = ouvrir)

- PROJECT [GARDER] : LOAD PROJECT (liste + CREATE NEW en bas) ; SAVE PROJECT AS (choix du slot ;
  [FUNC] + [SETTINGS] = ecraser le courant) ; MANAGE PROJECTS ([RIGHT] sur un projet) : CLEAR,
  DELETE, RENAME, LOAD FROM, SAVE TO, TOGGLE (protection), INIT NEW (slot vide), PURGE ALL (vide le
  pool et les samples non utilises de la RAM ; partie samples [SAMPLING: RETIRER]).
- SONG [GARDER] : RENAME, CLEAR, LOAD, SAVE TO PROJ.
- PATTERN [GARDER] : RENAME ; CLEAR (WHOLE PATTERN / KIT DATA / SEQUENCE DATA, confirmation) ;
  SAVE TO PROJ (memes 3 choix, projet sauve au moins une fois) ; RELOAD FROM PROJ (memes 3 choix).
- MIDI CONFIG [MIDI EXT: OPTIONNEL] : SYNC (CLOCK RECEIVE/SEND, TRANSPORT RECEIVE/SEND, PRG CH
  RECEIVE/SEND) ; PORT CONFIG (TURBO SPEED, OUT/THRU PORT FUNC MIDI/DIN24/DIN48, INPUT FROM,
  OUTPUT TO : partie ports/DIN [MATERIEL: RETIRER] ; OUTPUT CH, PARAM OUTPUT CC/NRPN, ENCODER DEST,
  TRIG KEY DEST, MUTE DEST, RECEIVE NOTES, RECEIVE CC/NRPN) ; CHANNELS (TRACK 1-16 CHANNEL, FX
  CONTROL CH, AUTO CHANNEL, PROGRAM CHG IN CH, PROGRAM CHG OUT CH).
- SYSEX DUMP [MATERIEL: RETIRER] (SEND / RECEIVE projet, pattern, presets).
- AUDIO ROUTING : TO MAIN et TO FX [GARDER pour les 16 pistes et les FX ; partie entrees
  SAMPLING: RETIRER] (TRIG VERTS = envoyes, [UP]/[DOWN] = pages) ; USB IN, USB OUT, INT TO MAIN,
  USB TO MAIN, PRE/POST FADER [MATERIEL: RETIRER].
- PERSONALIZE [GARDER] : LED INTENSITY (LOW/MID/MAX), LED BACKLIGHT, REMEMBER SUBPAGE (ON/OFF),
  U/D KEY MODE (KB OCT / NAV), PAGE AUTOCOPY, NOTE PARAM (CHRO / SCALE, sur le potard A), LIVE REC
  OVERDUB, PARAM LIVE REC (tous les pas / pas avec trig), TRK SELECT (NORMAL / SILENT / MANUAL /
  INVERTED).
- SYSTEM [MATERIEL: RETIRER] : USB CONFIG, OS UPGRADE, FORMAT +DRIVE, STORAGE (eventuellement une
  page "stockage navigateur" en web, optionnel).

### 7.4 [TEMPO] : voir 4.2 (TEMPO menu complet) et 3.2.

### 7.5 Menus [FUNC] + PARAMETER (contenu detaille par d'autres agents)

- QUANTIZE ([FUNC] + [TRIG]) : TRACK (E, piste choisie par TRIG 1-16), PATTERN (H) ; [NO] = sortir.
- MACHINE ([FUNC] + [SRC]) : categories SRC et FLTR ; SRC machines du manuel : ONESHOT, WERP,
  STRETCH, REPITCH, SLICE, GRID, MIDI ; FLTR : MULTI-MODE, LOWPASS 4, EQ, COMB-, COMB+, LEGACY.
  Pour nous : machines = moteurs de lecture de samples de Mika + synthes existants ; SLICE et GRID
  [A ARBITRER] ; MIDI [MIDI EXT: OPTIONNEL].
- SETUP ([FUNC] + [FLTR]) :
  - KIT : CONTROL ALL CONFIG (TRIG = pistes concernees, pas de MIDI) ; COMPRESSOR ROUTING (page 1
    pistes, page 2 IN L/R [SAMPLING: RETIRER] + SEND FX) ; TRACK SWAP (maintenir 2 TRIG jusqu'a
    "TRACKS X AND X SWAPPED" : tout est echange, presets, reglages, sequence).
  - TRACK : LEGATO ; NOTE PRIORITY (LAST / LOW / HIGH, seulement si LEGATO ON) ; VELOCITY TO VOL
    (OFF / LOG / LIN / EXP / EXP 2) ; OCTAVE (octave de base du preset) ; PITCH BEND DEPTH ;
    PORTAMENTO (SLOPE constant rate / constant time ; AMOUNT ; STYLE glide / glissando ; LEGATO ONLY
    ON/OFF ; GATING ON/OFF) ; KEY TRACKING (4 destinations A-D, profondeurs E-H, test LEVEL/DATA) ;
    VELOCITY MOD (idem) ; AFTERTOUCH, PITCH BEND, MODULATION WHEEL (CC1), BREATH CTRL (CC2) (idem,
    [MIDI EXT: OPTIONNEL]) ; RENAME (nom du preset de la piste).
- SEQUENCER ([FUNC] + [AMP]) : PL1, PL2, LEN (PER TRACK seulement), EUC on/off, RO1, RO2, TRO, OP
  (OR / XOR / AND / SUB).
- SEND FX ([FUNC] + [FX]) : DELAY, REVERB, CHORUS ([UP]/[DOWN]).
- MIXER ([FUNC] + [MOD]) : COMPRESSOR, INTERNAL MIXER 1 (T1-8), INTERNAL MIXER 2 (T9-16), FX MIXER
  (niveaux des FX et master overdrive), EXTERNAL MIXER [SAMPLING: RETIRER].
- PAGE SETUP ([FUNC] + [PAGE]) : PER PATTERN (LENGTH, SPEED 1/8X 1/4X 1/2X 3/4X 1X 3/2X 2X) ou
  PER TRACK (colonne TRACK : LENGTH, SPEED ; colonne PATTERN : CHANGE, RESET (INF possible)) ;
  [FUNC] + [YES] = basculer.
- KEYBOARD SETUP ([FUNC] + [KEYBOARD]) : voir 4.2.

### 7.6 MUTE, KEYBOARD, TRIG MODE : voir 5.1.

### 7.7 [PTN] / [FUNC] + [PTN] (BANK) et chaines : voir 3.8.

### 7.8 [SONG] / SONG EDIT

- Ecran SONG EDIT, colonnes : 1 SONG ROW (01-99) ; 2 LABEL (mot cle : Verse, Chorus, Fill... ou nom
  du pattern) ; 3 PTN ([FUNC] + tourner = banque rapide) ; 4 ROW PLAY COUNT ; 5 ROW LENGTH (2 a
  1024 pas, les 25 dernieres valeurs ecrites K00 a K24 ; defaut = longueur du pattern) ; 6 ROW
  TEMPO (BPM par ligne ou un BPM pour tout le song ; swing toujours par ligne) ; 7 SONG POINTER
  (temps et position) ; 8 ROW MUTE ([YES] puis TRIG ; icone mute sur la ligne) ; 9 ligne END
  (LOOP ou STOP) ; 10 ligne choisie entre pointilles ([UP]/[DOWN]) ; 11 PLAYHEAD ; 12 SONG SLOT et
  SONG NAME.
- Song vide : INSERT ROW ([FUNC] + [DOWN]) ou CREATE ROWS FROM CHAIN (chaine existante ou nouvelle
  via TRIG, [LEFT]/[RIGHT] = banque, [YES]).
- Lecture : [PLAY] ; bandeau haut = song, ligne / total, LABEL, banque/pattern + barre de
  progression ; [STOP] puis [PLAY] = reprise ; [STOP] x2 = debut ; choisir un pattern = sortir.
- Songs auto sauves dans le projet (sauver le projet avant d'en changer). Renommer : SETTINGS >
  SONG > RENAME.

---------------------------------------------------------------------------------------------------

## 8. Structure des donnees

```
+DRIVE (bibliotheque commune)                  [en web : stockage local / JSON, sans "+Drive"]
  128 projets
  1024 kits (banques A-H ; 128 par banque par deduction 1024 / 8)
  2048 presets (banques A-H x 256, slots "A:001"), tags, protection en ecriture
  banque de samples 20 Go + samples d'usine        [SAMPLING: remplacee par la banque de Mika]

PROJET (etat de travail actif, recharge a l'allumage)
  128 patterns = 8 banques (A-H) x 16 (A01..H16)
  16 songs
  POOL : 128 presets (necessaire pour les PRESET LOCKS et le TRIG MODE PRESET POOL ;
         pas de presets MIDI)
  1016 slots de samples / 400 Mo                     [SAMPLING: RETIRER]
  reglages generaux et etats (dont GLOBAL MUTE, tempo en mode PROJET)
  1 chaine (volatile, jamais sauvee)

PATTERN (conteneur principal)
  1 kit (copie independante une fois importe : modifier ne touche pas le kit du +Drive)
  sequence des 16 pistes : note trigs, lock trigs, parameter locks (80 parametres distincts max par
    pattern), preset locks, conditional locks (COND), micro timing, retrigs
  reglages de la page TRIG (NOTE, VEL, LEN, PROB, LFO.T, FLT.T, FILL, COND... par piste)
  BPM (mode PATTERN), swing, longueur, time signature / SPEED, mode PAGE SETUP (per pattern / per
    track), CHANGE, RESET
  reglages QUANTIZE
  reglages KEYBOARD SETUP (KB SCALE, ROOT NOTE, KB FOLD) ; l'octave courante, elle, n'est PAS
    stockee
  PATTERN MUTE
  pages DELAY / REVERB / CHORUS / MIXER (ch. 10 ; le ch. 9 range les send FX dans le kit : le kit
    est dans le pattern, donc coherent)
  nom (ex "WISPDISK")
  un tampon de TEMP SAVE (volatile)

KIT
  16 presets (un par piste, audio ou MIDI)
  niveaux (LEVEL) des pistes audio et du pattern
  compresseur + master overdrive
  routage compresseur + configuration CONTROL ALL
  reglages des send FX
  nom, slot de banque

PRESET
  audio : lien vers un sample + pages SRC, FLTR, AMP, FX, MOD
  MIDI  : pages SRC, FLTR, AMP, MOD
  PAS la page TRIG (elle va avec le pattern)
  reglages SETUP > TRACK (legato, portamento, key tracking...) : rattaches a la piste ; le manuel
    ne le dit pas explicitement, RENAME y renomme le preset : probablement dans le preset, a
    confirmer
  nom, tags (autant qu'on veut, 2 affiches), protection

SAMPLE                                             [en web : sample de Mika ou son synthe]
  16 bits 48 kHz mono ou stereo, identifie par une empreinte (renommer/deplacer ne casse rien,
  supprimer le retire de tous les presets)

SONG
  nom, jusqu'a 99 lignes + ligne END (LOOP / STOP)
  ligne = LABEL, PTN, ROW PLAY COUNT, ROW LENGTH, ROW TEMPO (ou tempo song), swing, ROW MUTE

PISTE
  16 pistes libres, chacune audio (toute machine SRC sauf MIDI, ecran "SMP") ou MIDI ("MID")
  n'importe quel preset sur n'importe quelle piste (decision Mika : 16 pistes libres)

PRESSE-PAPIER
  un seul element : trig(s), page, piste, page de parametres, pattern, preset, ligne de song, texte
```

---------------------------------------------------------------------------------------------------

## 9. Liste consolidee de ce qui part

[SAMPLING: RETIRER]
- Touche [SAMPLING] (fonction), menu SAMPLING (SRC, CHAN, RECORD NOW, THRES, MON, R.LEN, R.STRT,
  ARM, trim, zoom, normalisation, preview D, sauvegarde du sample), 7.5 en entier.
- [FUNC] + [SAMPLING] = SAMPLES menu (chargement/dechargement en RAM, remplacer, renommer, deplacer,
  dossiers, purge, transfert ordinateur) ; "Quick assign" via SAMPLES menu ; "Fn+Yes" de la liste
  SAMP (aller au slot +Drive).
- Slots / quota 1016 samples, 400 Mo par projet ; PURGE ALL partie samples ; FORMAT +DRIVE SAMPLES.
- Entrees audio partout : COMPRESSOR ROUTING page 2 "IN L/R", TO MAIN / TO FX (inputs), EXTERNAL
  MIXER (MIXER page 5 et 6).
- [A ARBITRER] : machines SLICE et GRID et le TRIG MODE SLICES (decoupe d'un sample en tranches,
  c'est de l'edition de sample mais aussi un mode de jeu).

[MATERIEL: RETIRER]
- Prises arriere et leur serigraphie (bandeau haut), POWER, DC In, USB, MIDI In/Out/Thru (sauf si
  WebMIDI retenu), IN L/R, OUT L/R, casque.
- Overbridge, Outbox 8, class compliant USB, Transfer (sauvegarde/restauration), SysEx dump et SEND
  SYSEX des managers, USB CONFIG, USB IN/OUT, INT TO MAIN, USB TO MAIN, PRE/POST FADER, OS UPGRADE,
  FORMAT +DRIVE, STARTUP MENU, TURBO SPEED, DIN SYNC 24/48.
- Ecran de veille (inutile en web, optionnel).

[MIDI EXT: OPTIONNEL]
- Pistes MIDI (machine MIDI), MIDI CONFIG (sync, CC/NRPN, canaux), notes MIDI 8.4, aftertouch,
  pitch bend, mod wheel, breath, tap tempo MIDI, enregistrement depuis clavier MIDI.

---------------------------------------------------------------------------------------------------

## 10. Remarques pour la spec (constats, pas des decisions)

- Places libres si on retire [SAMPLING] : la touche (cx 0,354, cy 0,512) et sa legende "Samples".
  Garder la touche en la reaffectant (ex : navigateur de la banque de samples de Mika, sans
  enregistrement) conserve le placement Digitakt a l'identique.
- Le bandeau des prises (haut de face) peut accueillir une serigraphie Maudite Machine a la place.
- Le logo modele (dans le cadre ecran) et le logo marque (haut droite) sont deux emplacements a
  reprendre avec le logo / logotype de Mika.
- Fonctions orange : sur la DA creme/noir de Mika, il faut une couleur distincte pour TOUTES les
  legendes secondaires (Preset Pool, Quantize..., Perform..., Save, Reload, Trig Mode, KB Octave,
  uTime-/+, Fill/Setup, KB Setup, Copy/Clear/Paste, Mute Mode, Bank, Song Edit, Track/Mute).
- Couleurs LED a fournir au minimum : rouge, jaune, vert, magenta, bleu, blanc, orange, + etats
  fixe / clignotant / double clignotement / "course" du pas.
- Le manuel a des incoherences a ne pas recopier : 3.1 n. 12 (texte corrompu), PRESET MANAGER vs
  PRESET BROWSER pour [FUNC] + LEVEL/DATA, selecteur de banque [TRIG 8-16] vs [9-16] (retenir 9-16 :
  8 banques A-H = 8 touches), 1ST/LST/PRE/NEI ou la barre de negation a disparu dans le texte.
- Gestes a transposer au web (detail en 6.1) : maintien, double appui, ordre de relachement,
  appui court/long sur un TRIG, potard pousse, multi-maintien. A la souris il faudra un "verrou"
  pour [FUNC], [TRK], [PTN], [TRIG] maintenus, et des raccourcis clavier ; en tactile, le
  multi-touch couvre la plupart.
- Fichier de geometrie brut (meme tableau, genere par script) :
  /tmp/claude-0/-home-user-MauditeMachine/3e52142d-b436-522a-95d4-63ef836eaea8/scratchpad/dt2/inv/geom_table.md
- Rendus de reference : panneau 400 dpi recadre
  /tmp/claude-0/-home-user-MauditeMachine/3e52142d-b436-522a-95d4-63ef836eaea8/scratchpad/dt2/inv/panel400.png
  (quarts q1.png a q4.png dans le meme dossier) ; page complete
  /tmp/claude-0/-home-user-MauditeMachine/3e52142d-b436-522a-95d4-63ef836eaea8/scratchpad/dt2/inv/hi-012.png
