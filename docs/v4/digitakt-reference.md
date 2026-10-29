# Référence Digitakt (DT1 et DT2), pour la MM-RYTM façon Digitakt

2026-10-29. Étude faite à partir des manuels officiels Elektron, lus en entier :
- [M1] Digitakt User Manual, OS 1.54 : https://www.elektron.se/wp-content/uploads/2026/10/Digitakt-User-Manual_ENG_OS1.54_260930.pdf
- [M2] Digitakt II User Manual, OS 1.17 : https://www.elektron.se/wp-content/uploads/2026/10/Digitakt-2-User-Manual_ENG_OS1.17_260930.pdf

Revues et photos (SOS, MusicTech, MusicRadar, forum Elektronauts) ne servent qu'à combler les trous. [NC] = non confirmé par une source officielle.

La proposition validée par Mika (« ok pour tout », 2026-10-29) est la page https://claude.ai/artifact/5cR8BzWxCuUX8i8dgE6ep3. Le cahier de l'étape 1 est `docs/v4/digitakt-d1-spec.md`.

## 1. Le panneau

**Conventions.**
- La légende primaire est sur la touche ou au-dessus.
- La fonction secondaire (FUNC + touche) est imprimée **en orange sous la touche** ([M1] p.13, [M2] p.13).

**DT2, de gauche à droite et de haut en bas :**
- Colonne gauche : Main Volume, Level/Data (Preset Pool), FUNC, KEYBOARD (KB Setup), TRK (*Mute Mode*), PTN (*Bank*), SONG (*Song Edit*).
- Sous l'écran :
  - icônes : PRESET/KIT (*Perform*), SETTINGS (*Save Proj*), SAMPLING (*Samples*), TEMPO (*Tap Tempo*) ;
  - transport : RECORD (*Copy*), PLAY (*Clear*), STOP (*Paste*).
- Droite :
  - knobs A à H en 2 × 4 ;
  - six touches PARAMETER : TRIG (*Quantize*), SRC (*Machine*), FLTR (*Setup*), AMP (*Sequencer*, l'euclidien), FX (*Send FX*), MOD (*Mixer*) ;
  - YES (*Save*), NO (*Reload*) ;
  - flèches (μTime±, Trig Mode) ;
  - 8 LED de page ;
  - PAGE (Fill / *Setup*).
- En bas : 16 TRIG, cadres sur 1, 5, 9 et 13.

**DT1, les différences :**
- Colonne gauche : FUNC, TRK (*Chromatic*), PTN (*Metronome*), BANK (*Mute Mode*).
- Touches PARAMETER : TRIG, SRC, FLTR, AMP, LFO, avec FUNC + FLTR = DELAY, FUNC + AMP = REVERB, FUNC + LFO = MASTER.
- Sous les TRIG 1 à 8 : KICK, SNARE, TOM, CLAP, COWBELL, CLOSED HAT, OPEN HAT, CYMBAL.

## 2. Les couleurs

| Contexte | Couleur et sens |
|---|---|
| Boîtier | Acier noir mat. Légendes primaires blanches, secondaires orange. Touches en plastique dur noir, rétroéclairées. FUNC orange [NC : capuchon ou lumière] |
| Écran | OLED 128 × 64. Jaune ou ambre sur DT1, blanc sur DT2 [NC] |
| Note trig | Rouge (plus faible pour la piste affichée, selon SOS) |
| Lock trig (trigless) | Jaune |
| Trig avec parameter lock | Clignote, rouge (note) ou jaune (lock) |
| Tête de lecture | Une lumière parcourt les 16 pas. SOS : rouge vif, et la touche flashe en blanc quand un trig part [NC] |
| Piste choisie (TRK tenue) | Rouge |
| PTN tenue | Blanc = pattern avec des données ; rouge = pattern qui joue ; éteint = vide ; celui qui attend clignote |
| RECORD | Rouge fixe = grid rec ; clignotant = live rec ; double clignotement = step rec |
| PLAY | Vert pendant la lecture [NC, photos] |
| STOP | Blanc [NC, photos] |
| Touches PARAMETER | La page affichée en rouge ou orange, les autres éteintes |
| Mute mode | GLOBAL : pistes qui jouent en vert, mutées éteintes ; une mutée qui a des trigs clignote vert. PATTERN : magenta, même logique |
| Step rec, pas actif | Vert, double clignotement |
| Chromatic / Keyboard | Les touches jouables allumées en motif de clavier ; bleu pour l'octave suivante |

## 3. Le séquenceur

**Structure.** 8 banques A à H × 16 patterns. DT1 : jusqu'à 64 pas (4 pages). DT2 : jusqu'à 128 pas.

**Enregistrement.**
- **Grid rec** : RECORD (rouge) ; TRK + TRIG choisit la piste ; une TRIG pose ou retire un note trig ; FUNC + TRIG pose un lock trig.
- **Live rec** : tenir RECORD et presser PLAY. Les TRIG jouées et les mouvements de knobs s'écrivent ; NO + TRIG efface en temps réel.
- **Step rec** : RECORD + STOP.

**Locks.**
- **Parameter lock** : en grid rec, tenir une TRIG et tourner un knob. Tenir la TRIG et presser le knob efface ce lock.
- **Sound lock** (DT1) ou preset lock (DT2) : tenir un trig et tourner LEVEL/DATA.

**Page TRIG.**

| Modèle | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| DT1 | NOTE | VEL | LEN | PROB / COND | FLT.T | LFO.T | - | - |
| DT2, TRIG 1 | NOTE | VEL | LEN | PROB | LFO.T | FLT.T | FILL | COND |
| DT2, TRIG 2 | RTRG | VFAD | LEN | RATE | - | - | PTIM | PORT |

**Conditions.**
- FILL, !FILL ;
- PRE, !PRE : la dernière condition évaluée sur la même piste ;
- NEI, !NEI : la piste voisine n-1 ;
- 1ST, !1ST ;
- DT2 ajoute LST, !LST et !A:B ;
- X % ;
- A:B : vrai au passage A d'un cycle de B, par exemple 1:2, 2:4, 3:4.

**Micro timing.** Tenir une TRIG + LEFT/RIGHT. Pas de 1/384 de pas, environ ±23/384 [NC].

**Retrig.**
- DT1 : tenir une TRIG + UP/DOWN. On/off, LEN, RATE (1/1 à 1/80), VEL (fondu de -128 à 127).
- DT2 : page TRIG 2.

**Longueur et vitesse par piste.**
- DT1 : FUNC + PAGE, menu SCALE. PER PATTERN ou PER TRACK ; vitesses 1/8X, 1/4X, 1/2X, 3/4X, 1X, 3/2X, 2X.
- DT2 : FUNC + PAGE, PAGE SETUP.

**Fill et chaînes.**
- Fill : tenir PAGE (momentané) ; YES + PAGE = un cycle.
- Chaîne : PTN + TRIG dans l'ordre ; le changement se fait en fin de pattern.

**Mutes.**
- GLOBAL (dans le projet) : FUNC + BANK sur DT1, FUNC + TRK sur DT2.
- PATTERN (dans le pattern) : FUNC + double appui.
- Quick Mute : FUNC + TRIG, partout.

**Sauvegarde temporaire.** FUNC + YES = point de restauration ; FUNC + NO = recharger.

**Copier, coller, effacer.** FUNC + RECORD, STOP ou PLAY = copier, coller ou effacer :
- le pattern hors grid rec ;
- la piste en grid rec ;
- PAGE + RECORD, STOP ou PLAY : la page ;
- TRIG + RECORD, STOP ou PLAY : les trigs ;
- PARAMETER + RECORD, STOP ou PLAY : la page de paramètres (DT2).

**Random et reload.** PARAMETER + YES = la page au hasard ; PARAMETER + NO = recharger la page ; PARAMETER + PLAY = la page à ses valeurs par défaut.

**Tempo.**
- Menu TEMPO : BPM, FINE, SWING de 50 à 80 %. TEMPO + YES = métronome (DT2).
- Tap : FUNC + TEMPO, moyenne après 4 frappes.
- Nudge : tenir LEFT ou RIGHT, ±10 %.

**Control All.** Tenir TRK et tourner un knob règle la valeur sur toutes les pistes ; NO avant de relâcher annule.

**Pistes.**
- DT1 : 8 pistes audio + 8 pistes MIDI (TRK + TRIG 9 à 16).
- DT2 : 16 pistes, audio ou MIDI.
- Hors enregistrement, une TRIG joue (DT1) ou choisit et joue (DT2, TRK SELECT NORMAL) la piste.

## 4. Les pages des pistes audio

**DT1 :**
- SRC Oneshot : TUNE, PLAY, BR, SAMP, STRT, LEN, LOOP, LEV.
- FLTR 1/2 : ATK, DEC, SUS, REL, FREQ, RESO, TYPE, ENV.
- AMP : ATK, HOLD, DEC, OVER, DEL, REV, PAN, VOL.
- LFO : SPD, MULT, FADE, DEST, WAVE, PHAS, MODE, DEP.
- DELAY : TIME, X, WID, FDBK, HPF, LPF, REV, VOL.
- REVERB : PRE, DEC, FREQ, GAIN, HPF, LPF, REV, VOL.
- MASTER 1/3 (compresseur) : THR, ATK, REL, MUP, RAT, SCS, SCF, MIX.
- MASTER 2/3 : les niveaux des 8 pistes.

**DT2 :**
- AMP : ATK, DEC, SUS, REL, RSET, MODE, PAN, VOL.
- FX : BR, OVER, SRR, ROUT, DEL, REV, CHR, OD.RT.
- MOD 1, 2 et 3 : un LFO chacun, SPD, MULT, FADE, DEST, WAVE, SPH, MODE, DEP.
- SEND FX : delay, reverb, chorus.
- MIXER :
  1. compresseur ;
  2. et 3. niveaux des pistes ;
  4. DEL, REV, CHR, MOVD ;
  5. entrées.
