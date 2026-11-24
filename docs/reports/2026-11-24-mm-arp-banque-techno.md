# 2026-11-24 : MM-ARP, banque d'usine refaite pour la techno (v52)

Retour de Mika : "Les presets ne sont pas assez bons ! ca doit etre vraiment super super bons comme ca et doit
s'associer facilement a de la musique techno".

## 1. Ce qui a ete fait

- `plugin/mm-arp/presets/build.mjs` : les 40 presets refaits (source unique), en-tete avec le retour de Mika et la
  logique de la banque ; VOICE MODE permis (POLY ou MONO) dans les controles d'ecriture.
- `plugin/mm-arp/presets/factory.json`, `factory/*.mmarp`, `volumes.json` : regeneres, volumes recales (-23 LUFS).
- Familles renommees, toujours quatre colonnes dans LIBRARY : BASS 12, ACID 8, SEQ 12, CHORD 8
  (`src/v4/plugin/arp/library.ts`, `plugin/mm-arp/tests/presets-check.mjs`).
- `src/v4/plugin/arp/analog.ts` : regle VOICE MODE (POLY ou MONO, jamais LEGATO), `ANALOG_VOICE`, `analogVoice`.
- `src/v4/plugin/arp/hypno.ts` : RANDOM pose le VOICE MODE de la famille (MONO pour les basses, POLY ailleurs).
- `plugin/mm-arp/tests/random-analog.ts` : les tirages portent ce VOICE MODE, verifie par `analogFaults`.
- `plugin/mm-arp/tests/presets_render.cpp` : les modes de voix (et la matrice d'avant, FEEDBACK, AMP MODE) passent au
  moteur comme dans le plugin ; mesures en plus (sub sous 100 Hz, 200-400 Hz, largeur sous 120 Hz, SUR KICK) ; le
  code de sortie verifie aussi le timbre de la famille. La banque v45 se rend au bit pres comme avant.
- `plugin/mm-arp/tests/cpu_bench.cpp` : la scene a l'arret suit PULSE DRONE (CATHEDRAL DRONE n'existe plus).

La banque (BPM, famille) :

| # | Nom | Famille | BPM | Le son et le groove |
|---|-----|---------|-----|---------------------|
| 01 | ROLLING BASS | BASS | 126 | scie + sub, trois doubles croches apres chaque kick, octave en fin de mesure |
| 02 | OFFBEAT BASS | BASS | 124 | une croche ronde sur chaque "et", F#m puis A |
| 03 | SUB PULSE | BASS | 128 | gros sub, deux pulsations par temps entre les kicks |
| 04 | MUNICH BASS | BASS | 124 | dark disco, racine et octave en doubles croches |
| 05 | GALLOP BASS | BASS | 124 | galop "et, a" avec octave, impulsion qui respire |
| 06 | EBM BASS | BASS | 125 | croches droites courtes, filtre Korg, octave en fin de mesure |
| 07 | TRIPLET ROLL | BASS | 127 | triolets de doubles croches (RATCHET x3 sur le "et") |
| 08 | DUB BASS | BASS | 124 | trois longues notes par mesure, glisse vers la quinte |
| 09 | FIFTH BASS | BASS | 126 | stab de quintes syncope, laisse le kick seul |
| 10 | KNOCK BASS | BASS | 128 | "toc" boise (FM legere), motif brise minimal |
| 11 | OCTAVE DISCO | BASS | 125 | octaves en croches, F#m A D E |
| 12 | PEAK ROLL | BASS | 130 | deux scies a l'octave qui grognent, deux coups apres chaque kick |
| 13 | ACID LINE | ACID | 128 | ligne acid classique, accents et slides vers l'octave |
| 14 | SOFT ACID | ACID | 124 | acid deep house, onde douce, swing, resonance qui respire |
| 15 | ACID ROLL | ACID | 130 | ligne du dessus (une octave plus haut), rythme 3-3-2 |
| 16 | ACID HYPNO | ACID | 132 | trois pas contre la mesure, coupure qui monte et descend sur 8 mesures |
| 17 | SQUARE ACID | ACID | 126 | carre creux, ligne syncopee clairsemee |
| 18 | GHOST ACID | ACID | 125 | acid minimale, notes laissees au hasard, notes fantomes |
| 19 | SWING ACID | ACID | 124 | ligne du dessus tres swinguee, coups doubles |
| 20 | DEEP ACID | ACID | 126 | acid une octave plus bas (fa diese 1), en croches |
| 21 | HYPNO SEQ | SEQ | 126 | ecole de Berlin, sept pas contre seize |
| 22 | BLEEP SEQ | SEQ | 130 | bleeps sinus / triangle secs |
| 23 | PLUCK SEQ | SEQ | 125 | pluck de deux scies, notes d'accord sur les contretemps |
| 24 | DISCO OCTAVES | SEQ | 125 | octaves galopantes dans le medium |
| 25 | ITALO ARP | SEQ | 124 | arpege italo, septiemes sur deux octaves |
| 26 | DETROIT ARP | SEQ | 127 | neuviemes de Detroit swinguees, large |
| 27 | RATCHET SEQ | SEQ | 129 | figure clairsemee qui begaie (ratchets 2 a 4) |
| 28 | POLYMETER SEQ | SEQ | 126 | cinq pas contre seize |
| 29 | DOTTED SEQ | SEQ | 124 | croches pointees ecrites dans les notes (l'echo sans delay) |
| 30 | SYNC SEQ | SEQ | 128 | hard sync balaye sur deux mesures |
| 31 | WOOD SEQ | SEQ | 128 | bois percussif pour la minimale |
| 32 | DARK ARP | SEQ | 128 | arpege de trois notes qui descend, filtre Korg |
| 33 | DUB STAB | CHORD | 125 | stab de quinte dub techno sur chaque contretemps |
| 34 | MINOR STAB | CHORD | 126 | stab mineur de Detroit, F#m Bm C#m |
| 35 | SEVENTH STAB | CHORD | 124 | septieme mineure, deux longs accords par mesure |
| 36 | ORGAN STAB | CHORD | 126 | orgue house annees 90 sur les "et" |
| 37 | GATED CHORD | CHORD | 128 | quinte hachee par les pistes GATE et ACCENT |
| 38 | PULSE PAD | CHORD | 124 | nappe qui pulse en doubles croches (neuviemes) |
| 39 | BREAK PAD | CHORD | 124 | nappe lente pour le break |
| 40 | PULSE DRONE | CHORD | 126 | quinte grave tenue, niveau qui pulse en croches |

## 2. Decisions prises et pourquoi

- Techno = un geste rythmique par preset, pense pour le kick : les basses roulantes jouent apres le kick, l'offbeat sur
  le "et". Mesure SUR KICK (part du sub dans le premier quart du temps) : 5 % en mediane (32 % en v45) ; MUNICH BASS,
  OCTAVE DISCO, EBM BASS et les lignes acides gardent des notes sur le temps (le style le veut).
- VOICE MODE MONO autorise et utilise pour BASS et ACID (et PULSE DRONE) : une seule voix, aucune queue sous la note
  suivante dans le grave, et le SLIDE glisse dans la meme voix. LEGATO refuse : l'arpege ne fait jamais depasser une
  note sur la suivante (GATE et TIE s'arretent a elle), la liaison dependrait de l'arrondi d'un echantillon.
- Aucune regle d'effet ni de filtre relachee (analog.ts inchange sur ce point), BASS MONO (monoLow) etait deja permis :
  c'est un reglage de la voix, pas un effet.
- Familles renommees (BASS, ACID, SEQ, CHORD) sans toucher a la mise en page : quatre colonnes, 12 noms au plus par
  colonne (16 de place).
- Trois lignes acides du dessus (ACID ROLL, ACID HYPNO, SWING ACID) : elles se posent sur une basse, et elles evitent
  que vingt sons mono du meme registre se ressemblent (controle de diversite D >= 2.4, DS >= 1.6).
- Cible bas-medium v43 (30 % entre 120 et 500 Hz) gardee : elle empeche un sub pur. Les basses passent par la deuxieme
  harmonique (scie, octave au-dessus, LOAD), pas par la zone 200-400 Hz (16 % en mediane, 30 % au plus).
- Le kick des fichiers d'ecoute est mixe 6 LU sous le synthe (consigne) : il donne la grille, il ne masque rien.

Mesures (CLASSIC HQ x8, 8 mesures, aucun son joue) :

| | v45 | v52 |
|---|---|---|
| BPM | 90 a 130 | 124 a 132 |
| Sonie | -24 a -23 LUFS | -23 LUFS (les 40) |
| Crete max | -3.8 dBFS | -3.3 dBFS |
| Part au-dessus de 6 kHz (max) | 0.34 % | 0.07 % |
| Grave : sub sous 100 Hz (mediane) | 19 % | 34 % |
| Grave : 200-400 Hz (mediane / max) | 22 % / 38 % | 16 % / 30 % |
| Grave : cote sous 120 Hz (max) | 16.4 % | 4.8 % |
| Grave : SUR KICK (mediane) | 32 % | 5 % |
| Diversite D / DS minimum | 2.43 / 1.68 | 2.40 / 1.66 (x4, x8, PRO STD) |

## 3. Ce qui reste a faire / points en suspens

- Ecoute de Mika : `MM-ARP presets v3 (ecoute)` (80 MP3 seul / avec kick + toute la banque en 2 min 32). Rien n'a ete
  ecoute ici, tout est juge par mesures.
- Le banc JUCE (host_test, 40 presets au bit pres avec l'ancien DELAY) n'a pas tourne en local (JUCE absent) : la CI le
  lance.
- Publication (plugin-arp.yml) a faire apres fusion ; la ligne "Etat" de CLAUDE.md parle encore de la banque v45.
- Les presets d'un projet Ableton ne bougent pas ; seule la LIBRARY change (les noms d'avant n'existent plus).

## 4. Commandes utiles ajoutees

- `plugin/mm-arp/tests/presets-render.sh --csv <fichier>` : le CSV porte maintenant `sub100_pct`, `mud_pct`,
  `lowwidth_pct`, `kicksub_pct`.
- `plugin/mm-arp/presets/calibrate.sh` puis `plugin/mm-arp/tests/presets-render.sh` (inchanges) pour recaler et
  verifier ; `presets_render ... --pro --os 2` pour PRO STD.
