# MM-STUDIO : le MIDI, tout pour faire ton fichier Roto-Control

Genere le 9 octobre 2026 depuis le code du site (`npm run docs:midi`) : 709 cibles, 8 setups. Les fichiers CSV a cote (`MIDI-roto-setups.csv`, `MIDI-targets.csv`) ouvrent dans Numbers ou Excel.

## 1. Comment c'est fait

**Le principe.** Le site ecoute le MIDI du navigateur (Web MIDI : Chrome, Edge, Opera, Firefox ; pas Safari). Panneau MIDI > CONNECT. Chaque message est reconnu par une cle `type:canal:numero` (`cc:1:14` : CC 14 sur le canal 1 ; `note:10:36` ; `pb:2:0` pour le pitch bend). Une cle vise une **cible** du site (un potard, un bouton) par son id (`voy:knob:cutoff`).

**D'ou vient la cible d'une cle**, dans cet ordre :

1. ce que tu as appris (MIDI LEARN, ou un fichier d'assignations importe) pour la machine regardee, puis les assignations de partout ;
2. sinon la **carte du Roto** (les 8 setups ci-dessous), si elle est allumee (par defaut oui), pour un message d'une entree dont le nom contient « roto » ;
3. sinon ce que tu as appris pour une autre machine (depuis le 2026-10-08 : une vieille assignation d'une autre machine ne vole plus un controle du Roto).

Une assignation apprise ne repond qu'a l'appareil qui l'a apprise. Le panneau MIDI liste celles qui tombent sur une cle de la carte (REMOVE CONFLICTS WITH THE ROTO MAP) et dit, pour chaque message recu, ce qu'il a fait.

**La carte du Roto.**

- Un setup par machine, chacun sur son canal : potards sur le canal N, boutons sur le canal N + 8.
- Les adresses sont gelees (2026-10-08, `src/v4/midi/rotoKeys.ts`) : une cible garde son canal et son CC pour toujours, meme deplacee sur une autre page ; une nouvelle cible prend une adresse libre, une adresse retiree n'est jamais redonnee. Au depart, le controle numero n (0 a 31, quatre pages de huit) avait le CC **14 + n** (n de 0 a 17), puis **102 + (n - 18)** (n de 18 a 31) : 0:14, 1:15, 2:16, 3:17, 4:18, 5:19, 6:20, 7:21, 8:22, 9:23, 10:24, 11:25, 12:26, 13:27, 14:28, 15:29, 16:30, 17:31, 18:102, 19:103, 20:104, 21:105, 22:106, 23:107, 24:108, 25:109, 26:110, 27:111, 28:112, 29:113, 30:114, 31:115 ; les colonnes Canal et CC ci-dessous font foi.
- **Version des setups : 2026-10-09.2.** Le nom du setup sur l'ecran du Roto la porte (RYTM 1009.2, ARP 1009.2, BASS 1009.2, DECK 1009.2, MIXER 1009.2, LIVE 1009.2, RSEQ 1009.2, BSEQ 1009.2) : un Roto qui montre un autre nom a un ancien fichier, reimporte les setups.
- Ces CC n'ont aucun role reserve dans la norme MIDI (ni 0 bank, 1 modulation, 6 et 38 data, 64 pedale, 96 a 101 RPN/NRPN, 120 a 127 messages de canal).
- Ce que dit le fichier JSON, c'est seulement **canal + CC + nom + couleur + type**. La **cible** (ce que ca pilote) est dans le site : il retrouve la cible avec le canal et le CC. Changer l'ordre dans le JSON sans changer le site ne deplace donc rien (voir le chapitre 5).

**Les valeurs.**

- Un potard va de 0 a 127 sur toute sa course. 64 est le neutre exact d'un potard bipolaire (EQ a 0 dB, filtre ouvert, PITCH, TONE, STRETCH, TUNE, GAIN) : le Roto y met un cran.
- Un selecteur a crans du site est un potard a crans du Roto (hapticMode 1, jusqu'a 16 crans, noms courts) : le cran i de n correspond a la valeur i/(n-1). Le choix de son du kit compte les echantillons du site : KICK SOUND a 9 crans (909, 808, MM, puis les 6 samples), SNARE SOUND a 7.
- **SAMPLE** (`rytm:enc:vsound`, a droite de VOLUME) choisit le son de la voix selectionnee : son nombre de crans suit la voix (BD 9, SD 7, les autres 3 ; CY et PC n'ont qu'un son). Il est donc continu sur le Roto : le site prend le cran le plus proche. La colonne Crans du catalogue donne son nombre pour la voix selectionnee a la generation (BD par defaut).
- Une **action** (RANDOM, CLEAR, OPEN, PLAY d'une platine...) part au front montant : un CC qui passe au-dessus de 63, ou une note enfoncee. Une action **maintenue** (CUE, boucles, pads des samplers, bends) dure jusqu'au relachement.
- Un **etat** (RUN, un mute, OSC ON) est une valeur 0 ou 1 : sur le Roto un bouton **bascule** (TOGGLE) dont la LED suit le site. Depuis le 2026-10-08, chaque message d'un bouton TOGGLE de la carte fait basculer sa cible (127 ou 0, peu importe : apres un changement fait sur la page, le premier appui marche). Une note fait basculer un parametre.

**Le retour vers le Roto.** Les potards motorises et les LEDs recoivent la valeur du site (meme canal, meme CC) toutes les 50 ms quand elle change (souris, preset, RANDOM), 48 messages au plus par tick, jamais pendant 300 ms apres un geste sur le potard, et un echo qui revient aussitot est ignore. La carte part seulement vers une sortie dont le nom contient « roto », une assignation apprise seulement vers son appareil. Pas de retour pour les boutons d'action. Un seul onglet du site pilote le Roto : le dernier montre ou clique.

**Changer de setup sur le Roto.** Le Roto ne le dit pas : le premier potard touche d'un autre setup qui saute loin de la valeur du site ne compte pas, son moteur y retourne et les potards et LEDs de ce setup sont renvoyes ; tourne-le de nouveau.

**FOLLOW.** Toucher un controle d'un setup montre sa machine : RYTM et RSEQ > MM-RYTM, ARP > MM-ARP, BASS et BSEQ > MM-BASS, DECK et MIXER > MM-DECKS. LIVE ne change pas de machine.

**Les sequenceurs RSEQ et BSEQ (2026-10-09).** Le Roto en sequenceur facon Elektron, pour le MM-RYTM (RSEQ, SETUP 17) et le MM-BASS (BSEQ, SETUP 18). Page 1 : en haut les huit encodeurs de la page affichee sur la machine (`rytm:knob:1` a `8`, `bass:knob:1` a `8`), en bas huit pas (`rytm:seq:1` a `8`, `bass:seq:1` a `8`) : une fenetre de huit sur les seize pas, 1 a 8 puis 9 a 16, que le site fait defiler (STEPS 9-16 ; STEP FOLLOW, par defaut : elle suit la tete de lecture en marche ; a ne pas confondre avec la case FOLLOW du panneau, qui montre la machine du setup). Page 2 : les memes encodeurs, les touches de page, STEPS 9-16, STEP FOLLOW. Page 3 : RSEQ, les volumes des huit voix au-dessus de leur choix (la voix des pas) ; BSEQ, NOTE -, NOTE +, OCT -, OCT +, TIE, MUTATE, ACCENT et SLIDE du pas tape. Page 4 : RUN, CLEAR, RANDOM ou GEN, LOCK, EDIT, PREV et NEXT MACHINE, MACHINES.

- **Taper** un pas (moins de 350 ms) pose son coup ou le retire (MM-RYTM : la voix choisie a la page 3, fort ; MM-BASS : une note, la tonique ; NOTE, OCT, ACCENT, SLIDE, TIE reglent ensuite le pas tape).
- **Tenir** un pas 350 ms : LOCK sur ce pas, les moteurs vont a ses valeurs. **Tenir et tourner** un encodeur : un parameter lock sur ce pas seulement (un pas vide recoit un coup), le lacher sort du LOCK. Tenu sans rien tourner, le LOCK reste ; une tape sur le meme pas en sort. Plusieurs pas tenus sur le MM-RYTM : tous verrouilles.
- Les **LEDs** des pas : allumee un coup, eteinte un pas vide, la tete de lecture en negatif sur son pas, le pas en LOCK qui clignote (4 Hz). Elles partent avec l'heure du pas (MIDIOutput.send avec un timestamp, calees sur la sortie son), deux messages par pas. Les touches de page, de voix, LOCK, EDIT, ACCENT, SLIDE, TIE allument leur LED selon le site.
- Dans EDIT, les huit pas sont les patterns (taper : le choisir ou le chainer ; tenir un vide : y copier), le pattern qui joue clignote.
- Changer la note d'un pas deja pose (BSEQ) : le tenir (LOCK), NOTE ou OCT a la page 3, une tape sur le pas (page 1) en sort.
- Les boutons des pas sont des **PUSH** (127 a l'appui, 0 au lacher) : le site distingue la tape de la tenue. Apres un LOCK, les potards du setup sont ignores 150 ms (les moteurs bougent). Si le Roto n'allume pas ses PUSH depuis le site (les LEDs des pas restent eteintes), la case « Step keys in TOGGLE mode » du panneau MIDI donne des fichiers RSEQ et BSEQ aux pas en TOGGLE : chaque appui est une tape, le LOCK passe par la touche LOCK (page 4).
- L'echo : une LED renvoyee par le Roto moins de 3 ms apres son heure (l'heure d'arrivee du message) est ignoree ; un Roto qui renverrait tout ce qu'il recoit plus lentement se trahit (un lacher sans appui juste apres une LED) et son retard est appris (30 ms au plus). Garder le Motion Recorder eteint sur ces deux setups.
- Les canaux 7, 8, 15 et 16 sont pris par RSEQ et BSEQ : un setup a toi (1 a 10) sur ces canaux pilote des cibles de la carte et recoit leurs LEDs et leurs moteurs ; deplace-le.

**Retenu** dans le navigateur (`mm.v4.midi.1`) : assignations apprises, appareils, ROTO (la carte), FEEDBACK, FOLLOW, les pas de RSEQ et BSEQ en TOGGLE.

## 2. Le fichier ROTO-SETUP (JSON)

Format des exports de ROTO-SETUP (version 1), un fichier par setup, a importer (File > Import) sur le setup choisi avec SEL. Le panneau MIDI du site les telecharge tout faits (DOWNLOAD THE SETUPS), et ils sont aussi dans ce dossier : `docs/midi/roto/` (`MM RYTM (SETUP 11).json`...).

```json
{
  "version": 1,
  "type": "MIDI",
  "name": "ARP 1009.2",
  "index": 11,
  "knobs": [
    {
      "controlIndex": 0,
      "controlMode": 0,
      "controlChannel": 2,
      "controlParam": 14,
      "nrpnAddress": 0,
      "minValue": 0,
      "maxValue": 127,
      "controlName": "RATE",
      "colorScheme": 15,
      "hapticMode": 1,
      "hapticIndent1": 255,
      "hapticIndent2": 255,
      "hapticSteps": 4,
      "stepNames": [
        "1/4",
        "1/8",
        "1/16",
        "1/32",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ]
    }
  ],
  "buttons": [
    {
      "controlIndex": 0,
      "controlMode": 0,
      "controlChannel": 10,
      "controlParam": 14,
      "nrpnAddress": 65535,
      "minValue": 0,
      "maxValue": 127,
      "controlName": "RUN",
      "colorScheme": 14,
      "ledOnColor": 14,
      "ledOffColor": 70,
      "hapticMode": 1,
      "hapticSteps": 0,
      "stepNames": [
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ]
    }
  ]
}
```

| Champ | Sens |
| --- | --- |
| version, type | 1 et "MIDI" (toujours) |
| name, index | nom du setup sur l'ecran du Roto, avec la version (RYTM 1009.2) ; index = numero de SETUP moins 1 (SETUP 12 : 11) |
| controlIndex | le controle n, de 0 a 31 (page = n div 8 + 1, position = n mod 8 + 1) |
| controlMode | 0 : CC |
| controlChannel | canal MIDI 1 a 16 (potards N, boutons N + 8) |
| controlParam | le numero de CC (celui du registre des adresses, src/v4/midi/rotoKeys.ts) |
| nrpnAddress | 0 pour un potard, 65535 pour un bouton (sans objet en CC) |
| minValue, maxValue | 0 et 127 : toute la course |
| controlName | nom sur l'ecran du Roto : 12 caracteres ASCII au plus |
| colorScheme | couleur du controle (numero de la palette, tableau plus bas) |
| hapticMode | potard : 0 continu, 1 a crans ; bouton : 0 poussoir, 1 bascule |
| hapticIndent1, hapticIndent2 | potard continu : 64 = un cran au milieu (bipolaire), 255 = aucun |
| hapticSteps, stepNames | potard a crans : leur nombre (2 a 16) et leurs 16 noms (12 caracteres) |
| ledOnColor, ledOffColor | bouton : couleur allumee (= colorScheme) et eteinte (70) |

Couleurs utilisees (palette du Roto, 83 numeros) :

| Couleur | colorScheme |
| --- | --- |
| orange | 15 |
| or | 1 |
| jaune | 17 |
| creme | 3 |
| blanc | 13 |
| rouge | 14 |
| vert | 5 |
| citron | 4 |
| cyan | 21 |
| bleu | 22 |
| violet | 24 |
| rose | 26 |
| peche | 29 |
| LED eteinte | 70 |

## 3. Les 8 setups, controle par controle

Le setup conseille sur le Roto (SETUP 11 a 18) laisse les premiers a toi. Un potard et un bouton partagent la meme page : ils vont ensemble.

| Setup | Fichier | SETUP | Canal potards | Canal boutons |
| --- | --- | --- | --- | --- |
| RYTM | MM RYTM (SETUP 11).json | 11 | 1 | 9 |
| ARP | MM ARP (SETUP 12).json | 12 | 2 | 10 |
| BASS | MM BASS (SETUP 15).json | 15 | 5 | 13 |
| DECK | MM DECK (SETUP 13).json | 13 | 3 | 11 |
| MIXER | MM MIXER (SETUP 14).json | 14 | 4 | 12 |
| LIVE | MM LIVE (SETUP 16).json | 16 | 6 | 14 |
| RSEQ | MM RSEQ (SETUP 17).json | 17 | 7 | 15 |
| BSEQ | MM BSEQ (SETUP 18).json | 18 | 8 | 16 |

### RYTM (SETUP 11, potards canal 1, boutons canal 9)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 1 | 14 | MASTER | blanc | rytm:enc:level | MASTER | continu |
| 1 | 1.2 | 1 | 15 | TEMPO | blanc | rytm:enc:tempo | TEMPO | continu |
| 2 | 1.3 | 1 | 16 | SWING | orange | rytm:enc:swing | SWING | continu |
| 3 | 1.4 | 1 | 17 | STRETCH | orange | rytm:enc:stretch | STRETCH | bipolaire, cran au milieu (64) |
| 4 | 1.5 | 1 | 18 | DIST | violet | rytm:enc:dist | DIST | continu |
| 5 | 1.6 | 1 | 19 | CHORUS | violet | rytm:enc:chorus | CHORUS | continu |
| 6 | 1.7 | 1 | 20 | DELAY | violet | rytm:enc:delay | DELAY | continu |
| 7 | 1.8 | 1 | 21 | REVERB | violet | rytm:enc:reverb | REVERB | continu |
| 8 | 2.1 | 1 | 22 | VOLUME | jaune | rytm:enc:vol | VOLUME (SELECTED VOICE) | continu |
| 9 | 2.2 | 1 | 23 | SAMPLE | or | rytm:enc:vsound | SAMPLE (SELECTED VOICE) | continu |
| 10 | 2.3 | 1 | 24 | TONE | jaune | rytm:enc:tone | TONE (SELECTED VOICE) | bipolaire, cran au milieu (64) |
| 11 | 2.4 | 1 | 25 | DECAY | jaune | rytm:enc:vdecay | DECAY (SELECTED VOICE) | continu |
| 12 | 2.5 | 1 | 26 | V DIST | peche | rytm:enc:vdist | DIST (SELECTED VOICE) | continu |
| 13 | 2.6 | 1 | 27 | V CHORUS | peche | rytm:enc:vchorus | CHORUS (SELECTED VOICE) | continu |
| 14 | 2.7 | 1 | 28 | V DELAY | peche | rytm:enc:vdelay | DELAY (SELECTED VOICE) | continu |
| 15 | 2.8 | 1 | 29 | V REVERB | peche | rytm:enc:vreverb | REVERB (SELECTED VOICE) | continu |
| 16 | 3.1 | 1 | 30 | BD VOL | creme | rytm:voice:BD:level | BD VOLUME | continu |
| 17 | 3.2 | 1 | 31 | SD VOL | creme | rytm:voice:SD:level | SD VOLUME | continu |
| 18 | 3.3 | 1 | 102 | CH VOL | creme | rytm:voice:CH:level | CH VOLUME | continu |
| 19 | 3.4 | 1 | 103 | OH VOL | creme | rytm:voice:OH:level | OH VOLUME | continu |
| 20 | 3.5 | 1 | 104 | CP VOL | creme | rytm:voice:CP:level | CP VOLUME | continu |
| 21 | 3.6 | 1 | 105 | TOM VOL | creme | rytm:voice:TOM:level | TOM VOLUME | continu |
| 22 | 3.7 | 1 | 106 | HT VOL | creme | rytm:voice:HT:level | HT VOLUME | continu |
| 23 | 3.8 | 1 | 107 | CY VOL | creme | rytm:voice:CY:level | CY VOLUME | continu |
| 24 | 4.1 | 1 | 108 | KICK SOUND | or | rytm:kit:bd | TWEAK KICK | potard a 9 crans : 909 / 808 / MM / BLUEPRINT / VNTM / ENGELHARDT / CARASSI / STEIN / AFFKT |
| 25 | 4.2 | 1 | 109 | KICK TUNE | or | rytm:kit:tune | TWEAK TUNE | bipolaire, cran au milieu (64) |
| 26 | 4.3 | 1 | 110 | KICK ATTACK | or | rytm:kit:attack | TWEAK ATTACK | continu |
| 27 | 4.4 | 1 | 111 | KICK DECAY | or | rytm:kit:decay | TWEAK DECAY | continu |
| 28 | 4.5 | 1 | 112 | KICK DRIVE | or | rytm:kit:drive | TWEAK DRIVE | continu |
| 29 | 4.6 | 1 | 113 | SNARE SOUND | or | rytm:kit:sd | TWEAK SNARE | potard a 7 crans : 909 / 808 / MM / PSY 02 / PSY 12 / PSY 26 / 707 |
| 30 | 4.7 | 1 | 114 | SNAPPY | or | rytm:kit:snappy | TWEAK SNAPPY | continu |
| 31 | 4.8 | 1 | 115 | HATS SOUND | or | rytm:kit:hh | TWEAK HATS | potard a 3 crans : 909 / 808 / MM |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 9 | 14 | RUN | rouge | rytm:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 1 | 1.2 | 9 | 15 | RANDOM | orange | rytm:random | RANDOM | appui |
| 2 | 1.3 | 9 | 16 | CLEAR | orange | rytm:clear | CLEAR | appui |
| 3 | 1.4 | 9 | 17 | EDIT | jaune | rytm:edit | EDIT | appui |
| 4 | 1.5 | 9 | 18 | OPEN | orange | rytm:open | OPEN | appui |
| 5 | 1.6 | 9 | 19 | MACHINES | rouge | nav:machines | PLAY/STOP MACHINES | appui |
| 6 | 1.7 | 9 | 20 | PREV MACHINE | blanc | nav:prev | PREVIOUS MACHINE | appui |
| 7 | 1.8 | 9 | 21 | NEXT MACHINE | blanc | nav:next | NEXT MACHINE | appui |
| 8 | 2.1 | 9 | 22 | BD | jaune | rytm:pad:BD | PAD BD | appui |
| 9 | 2.2 | 9 | 23 | SD | jaune | rytm:pad:SD | PAD SD | appui |
| 10 | 2.3 | 9 | 24 | CH | jaune | rytm:pad:CH | PAD CH | appui |
| 11 | 2.4 | 9 | 25 | OH | jaune | rytm:pad:OH | PAD OH | appui |
| 12 | 2.5 | 9 | 26 | CP | jaune | rytm:pad:CP | PAD CP | appui |
| 13 | 2.6 | 9 | 27 | TOM | jaune | rytm:pad:TOM | PAD TOM | appui |
| 14 | 2.7 | 9 | 28 | HT | jaune | rytm:pad:HT | PAD HT | appui |
| 15 | 2.8 | 9 | 29 | CY | jaune | rytm:pad:CY | PAD CY | appui |
| 16 | 3.1 | 9 | 30 | MUTE BD | rose | rytm:voice:BD:mute | MUTE BD | bascule (la LED suit le site) |
| 17 | 3.2 | 9 | 31 | MUTE SD | rose | rytm:voice:SD:mute | MUTE SD | bascule (la LED suit le site) |
| 18 | 3.3 | 9 | 102 | MUTE CH | rose | rytm:voice:CH:mute | MUTE CH | bascule (la LED suit le site) |
| 19 | 3.4 | 9 | 103 | MUTE OH | rose | rytm:voice:OH:mute | MUTE OH | bascule (la LED suit le site) |
| 20 | 3.5 | 9 | 104 | MUTE CP | rose | rytm:voice:CP:mute | MUTE CP | bascule (la LED suit le site) |
| 21 | 3.6 | 9 | 105 | MUTE TOM | rose | rytm:voice:TOM:mute | MUTE TOM | bascule (la LED suit le site) |
| 22 | 3.7 | 9 | 106 | MUTE HT | rose | rytm:voice:HT:mute | MUTE HT | bascule (la LED suit le site) |
| 23 | 3.8 | 9 | 107 | MUTE CY | rose | rytm:voice:CY:mute | MUTE CY | bascule (la LED suit le site) |
| 24 | 4.1 | 9 | 108 | PTN A01 | bleu | rytm:ptn:0 | PATTERN A01 | appui |
| 25 | 4.2 | 9 | 109 | PTN A02 | bleu | rytm:ptn:1 | PATTERN A02 | appui |
| 26 | 4.3 | 9 | 110 | PTN A03 | bleu | rytm:ptn:2 | PATTERN A03 | appui |
| 27 | 4.4 | 9 | 111 | PTN A04 | bleu | rytm:ptn:3 | PATTERN A04 | appui |
| 28 | 4.5 | 9 | 112 | PTN A05 | bleu | rytm:ptn:4 | PATTERN A05 | appui |
| 29 | 4.6 | 9 | 113 | PTN A06 | bleu | rytm:ptn:5 | PATTERN A06 | appui |
| 30 | 4.7 | 9 | 114 | PTN A07 | bleu | rytm:ptn:6 | PATTERN A07 | appui |
| 31 | 4.8 | 9 | 115 | PTN A08 | bleu | rytm:ptn:7 | PATTERN A08 | appui |

### ARP (SETUP 12, potards canal 2, boutons canal 10)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 2 | 14 | RATE | orange | voy:knob:rate | RATE | potard a 4 crans : 1/4 / 1/8 / 1/16 / 1/32 |
| 1 | 1.2 | 2 | 15 | MODE | orange | voy:knob:mode | MODE | potard a 4 crans : UP / DOWN / UP/DN / RAND |
| 2 | 1.3 | 2 | 16 | RANGE | orange | voy:knob:range | RANGE | potard a 3 crans : 1 OCT / 2 OCT / 3 OCT |
| 3 | 1.4 | 2 | 17 | NOTES | orange | voy:knob:notes | NOTES | potard a 9 crans : ALL / 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 |
| 4 | 1.5 | 2 | 18 | GATE | orange | voy:knob:gate | GATE | continu |
| 5 | 1.6 | 2 | 19 | OCTAVE | orange | voy:knob:octave | OCTAVE | potard a 5 crans : -2 / -1 / 0 / +1 / +2 |
| 6 | 1.7 | 2 | 20 | GLIDE | orange | voy:knob:glide | GLIDE | continu |
| 7 | 1.8 | 2 | 21 | VOLUME | blanc | voy:knob:volume | VOLUME | continu |
| 8 | 2.1 | 2 | 22 | CUTOFF | jaune | voy:knob:cutoff | CUTOFF | continu |
| 9 | 2.2 | 2 | 23 | RESONANCE | jaune | voy:knob:res | RES | continu |
| 10 | 2.3 | 2 | 24 | ENV AMOUNT | jaune | voy:knob:envAmt | ENV AMT | continu |
| 11 | 2.4 | 2 | 25 | FILTER MODE | jaune | voy:knob:fmode | MODE | potard a 4 crans : MOOG / LP12 / BP / HP |
| 12 | 2.5 | 2 | 26 | OSC 1 LEVEL | or | voy:knob:osc1 | OSC 1 | continu |
| 13 | 2.6 | 2 | 27 | OSC 2 LEVEL | or | voy:knob:osc2 | OSC 2 | continu |
| 14 | 2.7 | 2 | 28 | NOISE | or | voy:knob:noise | NOISE | continu |
| 15 | 2.8 | 2 | 29 | FM | or | voy:knob:fm | FM | continu |
| 16 | 3.1 | 2 | 30 | FLT ATTACK | vert | voy:knob:fA | ATTACK | continu |
| 17 | 3.2 | 2 | 31 | FLT DECAY | vert | voy:knob:fD | DECAY | continu |
| 18 | 3.3 | 2 | 102 | FLT SUSTAIN | vert | voy:knob:fS | SUSTAIN | continu |
| 19 | 3.4 | 2 | 103 | FLT RELEASE | vert | voy:knob:fR | RELEASE | continu |
| 20 | 3.5 | 2 | 104 | AMP ATTACK | citron | voy:knob:aA | ATTACK | continu |
| 21 | 3.6 | 2 | 105 | AMP DECAY | citron | voy:knob:aD | DECAY | continu |
| 22 | 3.7 | 2 | 106 | AMP SUSTAIN | citron | voy:knob:aS | SUSTAIN | continu |
| 23 | 3.8 | 2 | 107 | AMP RELEASE | citron | voy:knob:aR | RELEASE | continu |
| 24 | 4.1 | 2 | 108 | MOD SPEED | cyan | voy:knob:lfoRate | SPEED | potard a 7 crans : 1/16 / 1/8 / 1/4 / 1/2 / 1 BAR / 2 BAR / 4 BAR |
| 25 | 4.2 | 2 | 109 | MOD SHAPE | cyan | voy:knob:lfoShape | SHAPE | potard a 4 crans : TRI / SAW / SQR / S&H |
| 26 | 4.3 | 2 | 110 | MOD TARGET | cyan | voy:knob:lfoDest | TARGET | potard a 5 crans : WAVE / CUTOFF / FM / PITCH / W+CUT |
| 27 | 4.4 | 2 | 111 | MOD DEPTH | cyan | voy:knob:lfoAmt | DEPTH | continu |
| 28 | 4.5 | 2 | 112 | OVERDRIVE | violet | voy:knob:dist | OVERDRIVE | continu |
| 29 | 4.6 | 2 | 113 | CHORUS | violet | voy:knob:chorus | CHORUS | continu |
| 30 | 4.7 | 2 | 114 | DELAY | violet | voy:knob:delay | DELAY | continu |
| 31 | 4.8 | 2 | 115 | REVERB | violet | voy:knob:reverb | REVERB | continu |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 10 | 14 | RUN | rouge | voy:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 1 | 1.2 | 10 | 15 | RANDOM | orange | voy:random | RANDOM | appui |
| 2 | 1.3 | 10 | 16 | CLEAR | orange | voy:clear | CLEAR | appui |
| 3 | 1.4 | 10 | 17 | EDIT | jaune | voy:edit | EDIT | appui |
| 4 | 1.5 | 10 | 18 | OPEN | orange | voy:open | OPEN | appui |
| 5 | 1.6 | 10 | 19 | MACHINES | rouge | nav:machines | PLAY/STOP MACHINES | appui |
| 6 | 1.7 | 10 | 20 | PREV MACHINE | blanc | nav:prev | PREVIOUS MACHINE | appui |
| 7 | 1.8 | 10 | 21 | NEXT MACHINE | blanc | nav:next | NEXT MACHINE | appui |
| 8 | 2.1 | 10 | 22 | F#m | bleu | voy:pad:0 | CHORD F#m | appui |
| 9 | 2.2 | 10 | 23 | D | bleu | voy:pad:1 | CHORD D | appui |
| 10 | 2.3 | 10 | 24 | E | bleu | voy:pad:2 | CHORD E | appui |
| 11 | 2.4 | 10 | 25 | C#m | bleu | voy:pad:3 | CHORD C#m | appui |
| 12 | 2.5 | 10 | 26 | Bm | bleu | voy:pad:4 | CHORD Bm | appui |
| 13 | 2.6 | 10 | 27 | A | bleu | voy:pad:5 | CHORD A | appui |
| 14 | 2.7 | 10 | 28 | F#m7 | bleu | voy:pad:6 | CHORD F#m7 | appui |
| 15 | 2.8 | 10 | 29 | Dmaj7 | bleu | voy:pad:7 | CHORD Dmaj7 | appui |
| 16 | 3.1 | 10 | 30 | OSC 1 ON | vert | voy:knob:on1 | OSC 1 | bascule (la LED suit le site) |
| 17 | 3.2 | 10 | 31 | OSC 2 ON | vert | voy:knob:on2 | OSC 2 | bascule (la LED suit le site) |

### BASS (SETUP 15, potards canal 5, boutons canal 13)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 5 | 14 | CUTOFF | orange | bass:knob:cutoff | CUTOFF | continu |
| 1 | 1.2 | 5 | 15 | RESO | orange | bass:knob:reso | RESO | continu |
| 2 | 1.3 | 5 | 16 | ENV MOD | orange | bass:knob:envmod | ENV MOD | continu |
| 3 | 1.4 | 5 | 17 | DECAY | orange | bass:knob:decay | DECAY | continu |
| 4 | 1.5 | 5 | 18 | ACCENT | rouge | bass:knob:accent | ACCENT | continu |
| 5 | 1.6 | 5 | 19 | DRIVE | violet | bass:knob:drive | DRIVE | continu |
| 6 | 1.7 | 5 | 20 | SUB | or | bass:knob:sub | SUB | continu |
| 7 | 1.8 | 5 | 21 | VOLUME | blanc | bass:knob:volume | VOLUME | continu |
| 8 | 2.1 | 5 | 22 | WAVE | or | bass:knob:wave | OSC 1 WAVE | continu |
| 9 | 2.2 | 5 | 23 | GLIDE | or | bass:knob:glide | GLIDE | continu |
| 10 | 2.3 | 5 | 24 | OCTAVE | or | bass:knob:octave | OCTAVE | potard a 4 crans : -2 / -1 / 0 / +1 |
| 11 | 2.4 | 5 | 25 | STYLE | jaune | bass:knob:style | STYLE | potard a 11 crans : ACID / DARK DISCO / INDIE DANCE / MINIMAL / PSY PROG / TECHNO / HOUSE / ELECTRO / EBM / ITALO / SUB |
| 12 | 2.5 | 5 | 26 | DENSITY | jaune | bass:knob:density | DENSITY | continu |
| 13 | 2.6 | 5 | 27 | SLIDE PROB | jaune | bass:knob:slides | SLIDE PROB | continu |
| 14 | 2.7 | 5 | 28 | ACC PROB | jaune | bass:knob:accents | ACC PROB | continu |
| 15 | 2.8 | 5 | 29 | RANGE | jaune | bass:knob:range | RANGE | potard a 3 crans : 1 / 2 / 3 |
| 16 | 3.1 | 5 | 30 | ROOT | cyan | bass:knob:root | ROOT | potard a 13 crans : ARP / F# / G / G# / A / A# / B / C / C# / D / D# / E / F |
| 17 | 3.2 | 5 | 31 | SCALE | cyan | bass:knob:scale | SCALE | potard a 5 crans : MINOR / DORIAN / PHRYGIAN / HARMONIC / PENTA |
| 18 | 3.3 | 5 | 102 | SWING | blanc | rytm:enc:swing | SWING | continu |
| 19 | 3.4 | 5 | 103 | LENGTH | or | bass:knob:length | LENGTH | continu |
| 20 | 3.5 | 5 | 104 | ACC DECAY | rouge | bass:knob:accdecay | ACC DECAY | continu |
| 21 | 3.6 | 5 | 105 | SWEEP | rouge | bass:knob:sweep | SWEEP | continu |
| 22 | 3.7 | 5 | 106 | RELEASE | or | bass:knob:release | RELEASE | continu |
| 23 | 3.8 | 5 | 107 | TUNE | or | bass:knob:tune | TUNE | bipolaire, cran au milieu (64) |
| 24 | 4.1 | 5 | 108 | OSC 2 | or | bass:knob:o2lvl | OSC 2 | continu |
| 25 | 4.2 | 5 | 109 | OSC 3 | or | bass:knob:o3lvl | OSC 3 | continu |
| 26 | 4.3 | 5 | 110 | DETUNE | or | bass:knob:o2fine | OSC 2 FINE | bipolaire, cran au milieu (64) |
| 27 | 4.4 | 5 | 111 | NOISE | or | bass:knob:noise | NOISE | continu |
| 28 | 4.5 | 5 | 112 | FEEDBACK | violet | bass:knob:feedback | FEEDBACK | continu |
| 29 | 4.6 | 5 | 113 | F ATTACK | orange | bass:knob:fattack | F.ATTACK | continu |
| 30 | 4.7 | 5 | 114 | F SUSTAIN | orange | bass:knob:fsustain | F.SUSTAIN | continu |
| 31 | 4.8 | 5 | 115 | MODE | orange | bass:knob:fmode | MODE | potard a 5 crans : LP24 / LP12 / LP6 / BP / 303 |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 13 | 14 | RUN | rouge | bass:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 1 | 1.2 | 13 | 15 | GEN | orange | bass:key:gen | GEN | appui |
| 2 | 1.3 | 13 | 16 | MUTATE | orange | bass:key:mutate | MUTATE | appui |
| 3 | 1.4 | 13 | 17 | CLEAR | orange | bass:key:clear | CLEAR | appui |
| 4 | 1.5 | 13 | 18 | ACCENT | rouge | bass:key:accent | ACCENT | appui |
| 5 | 1.6 | 13 | 19 | SLIDE | jaune | bass:key:slide | SLIDE | appui |
| 6 | 1.7 | 13 | 20 | PREV MACHINE | blanc | nav:prev | PREVIOUS MACHINE | appui |
| 7 | 1.8 | 13 | 21 | NEXT MACHINE | blanc | nav:next | NEXT MACHINE | appui |
| 8 | 2.1 | 13 | 22 | STEP 1 | orange | bass:trig:0 | STEP 1 | appui |
| 9 | 2.2 | 13 | 23 | STEP 2 | orange | bass:trig:1 | STEP 2 | appui |
| 10 | 2.3 | 13 | 24 | STEP 3 | orange | bass:trig:2 | STEP 3 | appui |
| 11 | 2.4 | 13 | 25 | STEP 4 | orange | bass:trig:3 | STEP 4 | appui |
| 12 | 2.5 | 13 | 26 | STEP 5 | orange | bass:trig:4 | STEP 5 | appui |
| 13 | 2.6 | 13 | 27 | STEP 6 | orange | bass:trig:5 | STEP 6 | appui |
| 14 | 2.7 | 13 | 28 | STEP 7 | orange | bass:trig:6 | STEP 7 | appui |
| 15 | 2.8 | 13 | 29 | STEP 8 | orange | bass:trig:7 | STEP 8 | appui |
| 16 | 3.1 | 13 | 30 | STEP 9 | peche | bass:trig:8 | STEP 9 | appui |
| 17 | 3.2 | 13 | 31 | STEP 10 | peche | bass:trig:9 | STEP 10 | appui |
| 18 | 3.3 | 13 | 102 | STEP 11 | peche | bass:trig:10 | STEP 11 | appui |
| 19 | 3.4 | 13 | 103 | STEP 12 | peche | bass:trig:11 | STEP 12 | appui |
| 20 | 3.5 | 13 | 104 | STEP 13 | peche | bass:trig:12 | STEP 13 | appui |
| 21 | 3.6 | 13 | 105 | STEP 14 | peche | bass:trig:13 | STEP 14 | appui |
| 22 | 3.7 | 13 | 106 | STEP 15 | peche | bass:trig:14 | STEP 15 | appui |
| 23 | 3.8 | 13 | 107 | STEP 16 | peche | bass:trig:15 | STEP 16 | appui |
| 24 | 4.1 | 13 | 108 | NOTE - | cyan | bass:key:notedn | NOTE - | appui |
| 25 | 4.2 | 13 | 109 | NOTE + | cyan | bass:key:noteup | NOTE + | appui |
| 26 | 4.3 | 13 | 110 | OCT - | cyan | bass:key:octdn | OCT - | appui |
| 27 | 4.4 | 13 | 111 | OCT + | cyan | bass:key:octup | OCT + | appui |
| 28 | 4.5 | 13 | 112 | LOCK | jaune | bass:lock | LOCK (CHOSEN STEP) | appui |
| 29 | 4.6 | 13 | 113 | EDIT | jaune | bass:key:edit | EDIT | appui |
| 30 | 4.7 | 13 | 114 | MACHINES | rouge | nav:machines | PLAY/STOP MACHINES | appui |
| 31 | 4.8 | 13 | 115 | MM-STUDIO | blanc | nav:all | MM-STUDIO (ALL THE MACHINES) | appui |

### DECK (SETUP 13, potards canal 3, boutons canal 11)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 3 | 14 | PITCH A | cyan | dj:dj-a-pitch | DECK A PITCH | bipolaire, cran au milieu (64) |
| 1 | 1.2 | 3 | 15 | FADER A | blanc | dj:dj-ch4-fader | CHANNEL 4 (DECK A) FADER | continu |
| 2 | 1.3 | 3 | 16 | GAIN A | cyan | dj:dj-ch4-gain | CHANNEL 4 (DECK A) GAIN | bipolaire, cran au milieu (64) |
| 3 | 1.4 | 3 | 17 | HI A | cyan | dj:dj-ch4-hi | CHANNEL 4 (DECK A) EQ HI | bipolaire, cran au milieu (64) |
| 4 | 1.5 | 3 | 18 | MID A | cyan | dj:dj-ch4-mid | CHANNEL 4 (DECK A) EQ MID | bipolaire, cran au milieu (64) |
| 5 | 1.6 | 3 | 19 | LOW A | cyan | dj:dj-ch4-low | CHANNEL 4 (DECK A) EQ LOW | bipolaire, cran au milieu (64) |
| 6 | 1.7 | 3 | 20 | FILTER A | orange | dj:dj-ch4-filter | CHANNEL 4 (DECK A) FILTER | bipolaire, cran au milieu (64) |
| 7 | 1.8 | 3 | 21 | MASTER | blanc | dj:dj-master | MASTER VOLUME | continu |
| 8 | 2.1 | 3 | 22 | PITCH B | rose | dj:dj-b-pitch | DECK B PITCH | bipolaire, cran au milieu (64) |
| 9 | 2.2 | 3 | 23 | FADER B | blanc | dj:dj-ch5-fader | CHANNEL 5 (DECK B) FADER | continu |
| 10 | 2.3 | 3 | 24 | GAIN B | rose | dj:dj-ch5-gain | CHANNEL 5 (DECK B) GAIN | bipolaire, cran au milieu (64) |
| 11 | 2.4 | 3 | 25 | HI B | rose | dj:dj-ch5-hi | CHANNEL 5 (DECK B) EQ HI | bipolaire, cran au milieu (64) |
| 12 | 2.5 | 3 | 26 | MID B | rose | dj:dj-ch5-mid | CHANNEL 5 (DECK B) EQ MID | bipolaire, cran au milieu (64) |
| 13 | 2.6 | 3 | 27 | LOW B | rose | dj:dj-ch5-low | CHANNEL 5 (DECK B) EQ LOW | bipolaire, cran au milieu (64) |
| 14 | 2.7 | 3 | 28 | FILTER B | orange | dj:dj-ch5-filter | CHANNEL 5 (DECK B) FILTER | bipolaire, cran au milieu (64) |
| 15 | 2.8 | 3 | 29 | MASTER | blanc | dj:dj-master | MASTER VOLUME | continu |
| 16 | 3.1 | 3 | 30 | OVERDRIVE | violet | dj:dj-fx-overdrive | EFFECT OVERDRIVE | continu |
| 17 | 3.2 | 3 | 31 | CRUSH | violet | dj:dj-fx-crush | EFFECT CRUSH | continu |
| 18 | 3.3 | 3 | 102 | CHORUS | violet | dj:dj-fx-chorus | EFFECT CHORUS | continu |
| 19 | 3.4 | 3 | 103 | FLANGER | violet | dj:dj-fx-flanger | EFFECT FLANGER | continu |
| 20 | 3.5 | 3 | 104 | TRANS | violet | dj:dj-fx-trans | EFFECT TRANS | continu |
| 21 | 3.6 | 3 | 105 | DELAY | violet | dj:dj-fx-delay | EFFECT DELAY | continu |
| 22 | 3.7 | 3 | 106 | REVERB | violet | dj:dj-fx-reverb | EFFECT REVERB | continu |
| 23 | 3.8 | 3 | 107 | FX TO | blanc | dj:dj-fxto | EFFECTS TO: ALL CHANNELS, OR ONE CHANNEL | potard a 6 crans : ALL / RYTM / BASS / ARP / A / B |
| 24 | 4.1 | 3 | 108 | SMPL LVL A | cyan | dj:smpl:a:knob:level | SMPL A LEVEL | continu |
| 25 | 4.2 | 3 | 109 | SMPL PITCH A | cyan | dj:smpl:a:knob:pitch | SMPL A PITCH | bipolaire, cran au milieu (64) |
| 26 | 4.3 | 3 | 110 | SMPL FLT A | orange | dj:smpl:a:knob:filter | SMPL A FILTER | bipolaire, cran au milieu (64) |
| 27 | 4.4 | 3 | 111 | SMPL POS A | cyan | dj:smpl:a:knob:position | SMPL A POSITION | continu |
| 28 | 4.5 | 3 | 112 | SMPL LVL B | rose | dj:smpl:b:knob:level | SMPL B LEVEL | continu |
| 29 | 4.6 | 3 | 113 | SMPL PITCH B | rose | dj:smpl:b:knob:pitch | SMPL B PITCH | bipolaire, cran au milieu (64) |
| 30 | 4.7 | 3 | 114 | SMPL FLT B | orange | dj:smpl:b:knob:filter | SMPL B FILTER | bipolaire, cran au milieu (64) |
| 31 | 4.8 | 3 | 115 | SMPL POS B | cyan | dj:smpl:b:knob:position | SMPL B POSITION | continu |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 11 | 14 | CUE A | orange | dj:dj-a-cue | DECK A CUE (HOLD TO PREVIEW) | maintenu |
| 1 | 1.2 | 11 | 15 | PLAY A | jaune | dj:dj-a-play | DECK A PLAY OR PAUSE | maintenu |
| 2 | 1.3 | 11 | 16 | SYNC A | blanc | dj:dj-a-sync | DECK A SYNC: MATCH THE TEMPO YOU HEAR | maintenu |
| 3 | 1.4 | 11 | 17 | SMPL A | cyan | dj:dj-a-smpl-open | DECK A SAMPLER: SHOW IT ON THE SCREEN, OR THE TRACK | maintenu |
| 4 | 1.5 | 11 | 18 | REC DECK A | rouge | dj:dj-a-smpl-recdeck | DECK A SAMPLER: SAMPLE THE DECK (ITS LOOP, OR THE LAST BEATS) | maintenu |
| 5 | 1.6 | 11 | 19 | REC MIX A | rouge | dj:dj-a-smpl-recmix | DECK A SAMPLER: SAMPLE THE MIXER OUTPUT (THE LAST BEATS) | maintenu |
| 6 | 1.7 | 11 | 20 | SMPL PLAY A | jaune | dj:dj-a-smpl-play | DECK A SAMPLER: PLAY OR STOP | maintenu |
| 7 | 1.8 | 11 | 21 | LOOP 4 A | vert | dj:dj-a-loop4 | DECK A LOOP 4 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 8 | 2.1 | 11 | 22 | CUE B | orange | dj:dj-b-cue | DECK B CUE (HOLD TO PREVIEW) | maintenu |
| 9 | 2.2 | 11 | 23 | PLAY B | jaune | dj:dj-b-play | DECK B PLAY OR PAUSE | maintenu |
| 10 | 2.3 | 11 | 24 | SYNC B | blanc | dj:dj-b-sync | DECK B SYNC: MATCH THE TEMPO YOU HEAR | maintenu |
| 11 | 2.4 | 11 | 25 | SMPL B | rose | dj:dj-b-smpl-open | DECK B SAMPLER: SHOW IT ON THE SCREEN, OR THE TRACK | maintenu |
| 12 | 2.5 | 11 | 26 | REC DECK B | rouge | dj:dj-b-smpl-recdeck | DECK B SAMPLER: SAMPLE THE DECK (ITS LOOP, OR THE LAST BEATS) | maintenu |
| 13 | 2.6 | 11 | 27 | REC MIX B | rouge | dj:dj-b-smpl-recmix | DECK B SAMPLER: SAMPLE THE MIXER OUTPUT (THE LAST BEATS) | maintenu |
| 14 | 2.7 | 11 | 28 | SMPL PLAY B | jaune | dj:dj-b-smpl-play | DECK B SAMPLER: PLAY OR STOP | maintenu |
| 15 | 2.8 | 11 | 29 | LOOP 4 B | vert | dj:dj-b-loop4 | DECK B LOOP 4 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 16 | 3.1 | 11 | 30 | LOOP 1 A | vert | dj:dj-a-loop1 | DECK A LOOP 1 BEAT (PRESS AGAIN TO EXIT) | maintenu |
| 17 | 3.2 | 11 | 31 | LOOP 2 A | vert | dj:dj-a-loop2 | DECK A LOOP 2 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 18 | 3.3 | 11 | 102 | LOOP 8 A | vert | dj:dj-a-loop8 | DECK A LOOP 8 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 19 | 3.4 | 11 | 103 | BEND - A | cyan | dj:dj-a-bendm | DECK A BEND SLOWER (HOLD) | maintenu |
| 20 | 3.5 | 11 | 104 | BEND + A | cyan | dj:dj-a-bendp | DECK A BEND FASTER (HOLD) | maintenu |
| 21 | 3.6 | 11 | 105 | PITCH - A | cyan | dj:dj-a-tempom | DECK A PITCH DOWN 0.05 BPM (HOLD TO REPEAT) | maintenu |
| 22 | 3.7 | 11 | 106 | PITCH + A | cyan | dj:dj-a-tempop | DECK A PITCH UP 0.05 BPM (HOLD TO REPEAT) | maintenu |
| 23 | 3.8 | 11 | 107 | SMPL MODE A | orange | dj:smpl:a:mode | SMPL A MODE | appui |
| 24 | 4.1 | 11 | 108 | LOOP 1 B | vert | dj:dj-b-loop1 | DECK B LOOP 1 BEAT (PRESS AGAIN TO EXIT) | maintenu |
| 25 | 4.2 | 11 | 109 | LOOP 2 B | vert | dj:dj-b-loop2 | DECK B LOOP 2 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 26 | 4.3 | 11 | 110 | LOOP 8 B | vert | dj:dj-b-loop8 | DECK B LOOP 8 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 27 | 4.4 | 11 | 111 | BEND - B | rose | dj:dj-b-bendm | DECK B BEND SLOWER (HOLD) | maintenu |
| 28 | 4.5 | 11 | 112 | BEND + B | rose | dj:dj-b-bendp | DECK B BEND FASTER (HOLD) | maintenu |
| 29 | 4.6 | 11 | 113 | PITCH - B | rose | dj:dj-b-tempom | DECK B PITCH DOWN 0.05 BPM (HOLD TO REPEAT) | maintenu |
| 30 | 4.7 | 11 | 114 | PITCH + B | rose | dj:dj-b-tempop | DECK B PITCH UP 0.05 BPM (HOLD TO REPEAT) | maintenu |
| 31 | 4.8 | 11 | 115 | SMPL MODE B | orange | dj:smpl:b:mode | SMPL B MODE | appui |

### MIXER (SETUP 14, potards canal 4, boutons canal 12)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 4 | 14 | FADER RYTM | blanc | dj:dj-ch1-fader | CHANNEL 1 (MM-RYTM) FADER | continu |
| 1 | 1.2 | 4 | 15 | FADER BASS | blanc | dj:dj-ch2-fader | CHANNEL 2 (MM-BASS) FADER | continu |
| 2 | 1.3 | 4 | 16 | FADER ARP | blanc | dj:dj-ch3-fader | CHANNEL 3 (MM-ARP) FADER | continu |
| 3 | 1.4 | 4 | 17 | FADER A | blanc | dj:dj-ch4-fader | CHANNEL 4 (DECK A) FADER | continu |
| 4 | 1.5 | 4 | 18 | FADER B | blanc | dj:dj-ch5-fader | CHANNEL 5 (DECK B) FADER | continu |
| 5 | 1.6 | 4 | 19 | FILTER RYTM | orange | dj:dj-ch1-filter | CHANNEL 1 (MM-RYTM) FILTER | bipolaire, cran au milieu (64) |
| 6 | 1.7 | 4 | 20 | FILTER A | orange | dj:dj-ch4-filter | CHANNEL 4 (DECK A) FILTER | bipolaire, cran au milieu (64) |
| 7 | 1.8 | 4 | 21 | FILTER B | orange | dj:dj-ch5-filter | CHANNEL 5 (DECK B) FILTER | bipolaire, cran au milieu (64) |
| 8 | 2.1 | 4 | 22 | FILTER BASS | orange | dj:dj-ch2-filter | CHANNEL 2 (MM-BASS) FILTER | bipolaire, cran au milieu (64) |
| 9 | 2.2 | 4 | 23 | FILTER ARP | orange | dj:dj-ch3-filter | CHANNEL 3 (MM-ARP) FILTER | bipolaire, cran au milieu (64) |
| 10 | 2.3 | 4 | 24 | HI RYTM | jaune | dj:dj-ch1-hi | CHANNEL 1 (MM-RYTM) EQ HI | bipolaire, cran au milieu (64) |
| 11 | 2.4 | 4 | 25 | LOW RYTM | jaune | dj:dj-ch1-low | CHANNEL 1 (MM-RYTM) EQ LOW | bipolaire, cran au milieu (64) |
| 12 | 2.5 | 4 | 26 | HI BASS | peche | dj:dj-ch2-hi | CHANNEL 2 (MM-BASS) EQ HI | bipolaire, cran au milieu (64) |
| 13 | 2.6 | 4 | 27 | LOW BASS | peche | dj:dj-ch2-low | CHANNEL 2 (MM-BASS) EQ LOW | bipolaire, cran au milieu (64) |
| 14 | 2.7 | 4 | 28 | HI ARP | or | dj:dj-ch3-hi | CHANNEL 3 (MM-ARP) EQ HI | bipolaire, cran au milieu (64) |
| 15 | 2.8 | 4 | 29 | LOW ARP | or | dj:dj-ch3-low | CHANNEL 3 (MM-ARP) EQ LOW | bipolaire, cran au milieu (64) |
| 16 | 3.1 | 4 | 30 | HI A | cyan | dj:dj-ch4-hi | CHANNEL 4 (DECK A) EQ HI | bipolaire, cran au milieu (64) |
| 17 | 3.2 | 4 | 31 | MID A | cyan | dj:dj-ch4-mid | CHANNEL 4 (DECK A) EQ MID | bipolaire, cran au milieu (64) |
| 18 | 3.3 | 4 | 102 | LOW A | cyan | dj:dj-ch4-low | CHANNEL 4 (DECK A) EQ LOW | bipolaire, cran au milieu (64) |
| 19 | 3.4 | 4 | 103 | HI B | rose | dj:dj-ch5-hi | CHANNEL 5 (DECK B) EQ HI | bipolaire, cran au milieu (64) |
| 20 | 3.5 | 4 | 104 | MID B | rose | dj:dj-ch5-mid | CHANNEL 5 (DECK B) EQ MID | bipolaire, cran au milieu (64) |
| 21 | 3.6 | 4 | 105 | LOW B | rose | dj:dj-ch5-low | CHANNEL 5 (DECK B) EQ LOW | bipolaire, cran au milieu (64) |
| 22 | 3.7 | 4 | 106 | GAIN A | cyan | dj:dj-ch4-gain | CHANNEL 4 (DECK A) GAIN | bipolaire, cran au milieu (64) |
| 23 | 3.8 | 4 | 107 | GAIN B | rose | dj:dj-ch5-gain | CHANNEL 5 (DECK B) GAIN | bipolaire, cran au milieu (64) |
| 24 | 4.1 | 4 | 108 | OVERDRIVE | violet | dj:dj-fx-overdrive | EFFECT OVERDRIVE | continu |
| 25 | 4.2 | 4 | 109 | CRUSH | violet | dj:dj-fx-crush | EFFECT CRUSH | continu |
| 26 | 4.3 | 4 | 110 | CHORUS | violet | dj:dj-fx-chorus | EFFECT CHORUS | continu |
| 27 | 4.4 | 4 | 111 | FLANGER | violet | dj:dj-fx-flanger | EFFECT FLANGER | continu |
| 28 | 4.5 | 4 | 112 | TRANS | violet | dj:dj-fx-trans | EFFECT TRANS | continu |
| 29 | 4.6 | 4 | 113 | DELAY | violet | dj:dj-fx-delay | EFFECT DELAY | continu |
| 30 | 4.7 | 4 | 114 | REVERB | violet | dj:dj-fx-reverb | EFFECT REVERB | continu |
| 31 | 4.8 | 4 | 115 | FX TO | blanc | dj:dj-fxto | EFFECTS TO: ALL CHANNELS, OR ONE CHANNEL | potard a 6 crans : ALL / RYTM / BASS / ARP / A / B |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 12 | 14 | RUN RYTM | rouge | rytm:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 1 | 1.2 | 12 | 15 | RUN BASS | rouge | bass:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 2 | 1.3 | 12 | 16 | RUN ARP | rouge | voy:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 3 | 1.4 | 12 | 17 | PLAY A | jaune | dj:dj-a-play | DECK A PLAY OR PAUSE | maintenu |
| 4 | 1.5 | 12 | 18 | PLAY B | jaune | dj:dj-b-play | DECK B PLAY OR PAUSE | maintenu |
| 5 | 1.6 | 12 | 19 | CUE A | orange | dj:dj-a-cue | DECK A CUE (HOLD TO PREVIEW) | maintenu |
| 6 | 1.7 | 12 | 20 | CUE B | orange | dj:dj-b-cue | DECK B CUE (HOLD TO PREVIEW) | maintenu |
| 7 | 1.8 | 12 | 21 | MACHINES | rouge | nav:machines | PLAY/STOP MACHINES | appui |
| 8 | 2.1 | 12 | 22 | MUTE BD | rose | rytm:voice:BD:mute | MUTE BD | bascule (la LED suit le site) |
| 9 | 2.2 | 12 | 23 | MUTE SD | rose | rytm:voice:SD:mute | MUTE SD | bascule (la LED suit le site) |
| 10 | 2.3 | 12 | 24 | MUTE CH | rose | rytm:voice:CH:mute | MUTE CH | bascule (la LED suit le site) |
| 11 | 2.4 | 12 | 25 | MUTE OH | rose | rytm:voice:OH:mute | MUTE OH | bascule (la LED suit le site) |
| 12 | 2.5 | 12 | 26 | MUTE CP | rose | rytm:voice:CP:mute | MUTE CP | bascule (la LED suit le site) |
| 13 | 2.6 | 12 | 27 | MUTE TOM | rose | rytm:voice:TOM:mute | MUTE TOM | bascule (la LED suit le site) |
| 14 | 2.7 | 12 | 28 | MUTE HT | rose | rytm:voice:HT:mute | MUTE HT | bascule (la LED suit le site) |
| 15 | 2.8 | 12 | 29 | MUTE CY | rose | rytm:voice:CY:mute | MUTE CY | bascule (la LED suit le site) |
| 16 | 3.1 | 12 | 30 | SYNC A | blanc | dj:dj-a-sync | DECK A SYNC: MATCH THE TEMPO YOU HEAR | maintenu |
| 17 | 3.2 | 12 | 31 | SYNC B | blanc | dj:dj-b-sync | DECK B SYNC: MATCH THE TEMPO YOU HEAR | maintenu |
| 18 | 3.3 | 12 | 102 | LOOP 4 A | vert | dj:dj-a-loop4 | DECK A LOOP 4 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 19 | 3.4 | 12 | 103 | LOOP 4 B | vert | dj:dj-b-loop4 | DECK B LOOP 4 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 20 | 3.5 | 12 | 104 | ADD DECK | blanc | dj:dj-adddeck | ADD A DECK, WITH ITS CHANNEL ON THE MIXER | maintenu |
| 21 | 3.6 | 12 | 105 | PREV MACHINE | blanc | nav:prev | PREVIOUS MACHINE | appui |
| 22 | 3.7 | 12 | 106 | NEXT MACHINE | blanc | nav:next | NEXT MACHINE | appui |
| 23 | 3.8 | 12 | 107 | MM-STUDIO | blanc | nav:all | MM-STUDIO (ALL THE MACHINES) | appui |
| 24 | 4.1 | 12 | 108 | FX TIME 1/4 | violet | dj:dj-time1 | EFFECTS TIME 1/4 BEATS | maintenu |
| 25 | 4.2 | 12 | 109 | FX TIME 1/2 | violet | dj:dj-time2 | EFFECTS TIME 1/2 BEATS | maintenu |
| 26 | 4.3 | 12 | 110 | FX TIME 3/4 | violet | dj:dj-time3 | EFFECTS TIME 3/4 BEATS | maintenu |
| 27 | 4.4 | 12 | 111 | FX TIME 1 | violet | dj:dj-time4 | EFFECTS TIME 1 BEAT | maintenu |
| 28 | 4.5 | 12 | 112 | FX TIME 2 | violet | dj:dj-time5 | EFFECTS TIME 2 BEATS | maintenu |
| 29 | 4.6 | 12 | 113 | FX TIME 4 | violet | dj:dj-time6 | EFFECTS TIME 4 BEATS | maintenu |

### LIVE (SETUP 16, potards canal 6, boutons canal 14)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 6 | 14 | FADER RYTM | blanc | dj:dj-ch1-fader | CHANNEL 1 (MM-RYTM) FADER | continu |
| 1 | 1.2 | 6 | 15 | FADER BASS | blanc | dj:dj-ch2-fader | CHANNEL 2 (MM-BASS) FADER | continu |
| 2 | 1.3 | 6 | 16 | FADER ARP | blanc | dj:dj-ch3-fader | CHANNEL 3 (MM-ARP) FADER | continu |
| 3 | 1.4 | 6 | 17 | FADER A | blanc | dj:dj-ch4-fader | CHANNEL 4 (DECK A) FADER | continu |
| 4 | 1.5 | 6 | 18 | FADER B | blanc | dj:dj-ch5-fader | CHANNEL 5 (DECK B) FADER | continu |
| 5 | 1.6 | 6 | 19 | FILTER RYTM | orange | dj:dj-ch1-filter | CHANNEL 1 (MM-RYTM) FILTER | bipolaire, cran au milieu (64) |
| 6 | 1.7 | 6 | 20 | FILTER A | orange | dj:dj-ch4-filter | CHANNEL 4 (DECK A) FILTER | bipolaire, cran au milieu (64) |
| 7 | 1.8 | 6 | 21 | FILTER B | orange | dj:dj-ch5-filter | CHANNEL 5 (DECK B) FILTER | bipolaire, cran au milieu (64) |
| 8 | 2.1 | 6 | 22 | SWING | orange | rytm:enc:swing | SWING | continu |
| 9 | 2.2 | 6 | 23 | STRETCH | orange | rytm:enc:stretch | STRETCH | bipolaire, cran au milieu (64) |
| 10 | 2.3 | 6 | 24 | RYTM DIST | violet | rytm:enc:dist | DIST | continu |
| 11 | 2.4 | 6 | 25 | RYTM DELAY | violet | rytm:enc:delay | DELAY | continu |
| 12 | 2.5 | 6 | 26 | RYTM REVERB | violet | rytm:enc:reverb | REVERB | continu |
| 13 | 2.6 | 6 | 27 | KICK TUNE | or | rytm:kit:tune | TWEAK TUNE | bipolaire, cran au milieu (64) |
| 14 | 2.7 | 6 | 28 | KICK DECAY | or | rytm:kit:decay | TWEAK DECAY | continu |
| 15 | 2.8 | 6 | 29 | KICK DRIVE | or | rytm:kit:drive | TWEAK DRIVE | continu |
| 16 | 3.1 | 6 | 30 | CUTOFF | jaune | voy:knob:cutoff | CUTOFF | continu |
| 17 | 3.2 | 6 | 31 | RESONANCE | jaune | voy:knob:res | RES | continu |
| 18 | 3.3 | 6 | 102 | ENV AMOUNT | jaune | voy:knob:envAmt | ENV AMT | continu |
| 19 | 3.4 | 6 | 103 | FLT DECAY | vert | voy:knob:fD | DECAY | continu |
| 20 | 3.5 | 6 | 104 | ARP GATE | orange | voy:knob:gate | GATE | continu |
| 21 | 3.6 | 6 | 105 | ARP RATE | orange | voy:knob:rate | RATE | potard a 4 crans : 1/4 / 1/8 / 1/16 / 1/32 |
| 22 | 3.7 | 6 | 106 | ARP DELAY | violet | voy:knob:delay | DELAY | continu |
| 23 | 3.8 | 6 | 107 | ARP REVERB | violet | voy:knob:reverb | REVERB | continu |
| 24 | 4.1 | 6 | 108 | OVERDRIVE | violet | dj:dj-fx-overdrive | EFFECT OVERDRIVE | continu |
| 25 | 4.2 | 6 | 109 | CRUSH | violet | dj:dj-fx-crush | EFFECT CRUSH | continu |
| 26 | 4.3 | 6 | 110 | CHORUS | violet | dj:dj-fx-chorus | EFFECT CHORUS | continu |
| 27 | 4.4 | 6 | 111 | FLANGER | violet | dj:dj-fx-flanger | EFFECT FLANGER | continu |
| 28 | 4.5 | 6 | 112 | TRANS | violet | dj:dj-fx-trans | EFFECT TRANS | continu |
| 29 | 4.6 | 6 | 113 | DELAY | violet | dj:dj-fx-delay | EFFECT DELAY | continu |
| 30 | 4.7 | 6 | 114 | REVERB | violet | dj:dj-fx-reverb | EFFECT REVERB | continu |
| 31 | 4.8 | 6 | 115 | FX TO | blanc | dj:dj-fxto | EFFECTS TO: ALL CHANNELS, OR ONE CHANNEL | potard a 6 crans : ALL / RYTM / BASS / ARP / A / B |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 14 | 14 | RUN RYTM | rouge | rytm:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 1 | 1.2 | 14 | 15 | RUN BASS | rouge | bass:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 2 | 1.3 | 14 | 16 | RUN ARP | rouge | voy:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 3 | 1.4 | 14 | 17 | PLAY A | jaune | dj:dj-a-play | DECK A PLAY OR PAUSE | maintenu |
| 4 | 1.5 | 14 | 18 | PLAY B | jaune | dj:dj-b-play | DECK B PLAY OR PAUSE | maintenu |
| 5 | 1.6 | 14 | 19 | CUE A | orange | dj:dj-a-cue | DECK A CUE (HOLD TO PREVIEW) | maintenu |
| 6 | 1.7 | 14 | 20 | CUE B | orange | dj:dj-b-cue | DECK B CUE (HOLD TO PREVIEW) | maintenu |
| 7 | 1.8 | 14 | 21 | MACHINES | rouge | nav:machines | PLAY/STOP MACHINES | appui |
| 8 | 2.1 | 14 | 22 | MUTE BD | rose | rytm:voice:BD:mute | MUTE BD | bascule (la LED suit le site) |
| 9 | 2.2 | 14 | 23 | MUTE SD | rose | rytm:voice:SD:mute | MUTE SD | bascule (la LED suit le site) |
| 10 | 2.3 | 14 | 24 | MUTE CH | rose | rytm:voice:CH:mute | MUTE CH | bascule (la LED suit le site) |
| 11 | 2.4 | 14 | 25 | MUTE OH | rose | rytm:voice:OH:mute | MUTE OH | bascule (la LED suit le site) |
| 12 | 2.5 | 14 | 26 | MUTE CP | rose | rytm:voice:CP:mute | MUTE CP | bascule (la LED suit le site) |
| 13 | 2.6 | 14 | 27 | MUTE TOM | rose | rytm:voice:TOM:mute | MUTE TOM | bascule (la LED suit le site) |
| 14 | 2.7 | 14 | 28 | MUTE HT | rose | rytm:voice:HT:mute | MUTE HT | bascule (la LED suit le site) |
| 15 | 2.8 | 14 | 29 | MUTE CY | rose | rytm:voice:CY:mute | MUTE CY | bascule (la LED suit le site) |
| 16 | 3.1 | 14 | 30 | F#m | bleu | voy:pad:0 | CHORD F#m | appui |
| 17 | 3.2 | 14 | 31 | D | bleu | voy:pad:1 | CHORD D | appui |
| 18 | 3.3 | 14 | 102 | E | bleu | voy:pad:2 | CHORD E | appui |
| 19 | 3.4 | 14 | 103 | C#m | bleu | voy:pad:3 | CHORD C#m | appui |
| 20 | 3.5 | 14 | 104 | Bm | bleu | voy:pad:4 | CHORD Bm | appui |
| 21 | 3.6 | 14 | 105 | A | bleu | voy:pad:5 | CHORD A | appui |
| 22 | 3.7 | 14 | 106 | F#m7 | bleu | voy:pad:6 | CHORD F#m7 | appui |
| 23 | 3.8 | 14 | 107 | Dmaj7 | bleu | voy:pad:7 | CHORD Dmaj7 | appui |
| 24 | 4.1 | 14 | 108 | FX TIME 1/4 | violet | dj:dj-time1 | EFFECTS TIME 1/4 BEATS | maintenu |
| 25 | 4.2 | 14 | 109 | FX TIME 1/2 | violet | dj:dj-time2 | EFFECTS TIME 1/2 BEATS | maintenu |
| 26 | 4.3 | 14 | 110 | FX TIME 1 | violet | dj:dj-time4 | EFFECTS TIME 1 BEAT | maintenu |
| 27 | 4.4 | 14 | 111 | FX TIME 2 | violet | dj:dj-time5 | EFFECTS TIME 2 BEATS | maintenu |
| 28 | 4.5 | 14 | 112 | SMPL PLAY A | jaune | dj:dj-a-smpl-play | DECK A SAMPLER: PLAY OR STOP | maintenu |
| 29 | 4.6 | 14 | 113 | SMPL PLAY B | jaune | dj:dj-b-smpl-play | DECK B SAMPLER: PLAY OR STOP | maintenu |
| 30 | 4.7 | 14 | 114 | PREV MACHINE | blanc | nav:prev | PREVIOUS MACHINE | appui |
| 31 | 4.8 | 14 | 115 | NEXT MACHINE | blanc | nav:next | NEXT MACHINE | appui |

### RSEQ (SETUP 17, potards canal 7, boutons canal 15)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 7 | 14 | ENC A | jaune | rytm:knob:1 | KNOB A (PAGE) | continu |
| 1 | 1.2 | 7 | 15 | ENC B | jaune | rytm:knob:2 | KNOB B (PAGE) | continu |
| 2 | 1.3 | 7 | 16 | ENC C | jaune | rytm:knob:3 | KNOB C (PAGE) | continu |
| 3 | 1.4 | 7 | 17 | ENC D | jaune | rytm:knob:4 | KNOB D (PAGE) | continu |
| 4 | 1.5 | 7 | 18 | ENC E | jaune | rytm:knob:5 | KNOB E (PAGE) | continu |
| 5 | 1.6 | 7 | 19 | ENC F | jaune | rytm:knob:6 | KNOB F (PAGE) | continu |
| 6 | 1.7 | 7 | 20 | ENC G | jaune | rytm:knob:7 | KNOB G (PAGE) | continu |
| 7 | 1.8 | 7 | 21 | ENC H | jaune | rytm:knob:8 | KNOB H (PAGE) | continu |
| 8 | 2.1 | 7 | 22 | ENC A | jaune | rytm:knob:1 | KNOB A (PAGE) | continu |
| 9 | 2.2 | 7 | 23 | ENC B | jaune | rytm:knob:2 | KNOB B (PAGE) | continu |
| 10 | 2.3 | 7 | 24 | ENC C | jaune | rytm:knob:3 | KNOB C (PAGE) | continu |
| 11 | 2.4 | 7 | 25 | ENC D | jaune | rytm:knob:4 | KNOB D (PAGE) | continu |
| 12 | 2.5 | 7 | 26 | ENC E | jaune | rytm:knob:5 | KNOB E (PAGE) | continu |
| 13 | 2.6 | 7 | 27 | ENC F | jaune | rytm:knob:6 | KNOB F (PAGE) | continu |
| 14 | 2.7 | 7 | 28 | ENC G | jaune | rytm:knob:7 | KNOB G (PAGE) | continu |
| 15 | 2.8 | 7 | 29 | ENC H | jaune | rytm:knob:8 | KNOB H (PAGE) | continu |
| 16 | 3.1 | 7 | 30 | BD VOL | creme | rytm:voice:BD:level | BD VOLUME | continu |
| 17 | 3.2 | 7 | 31 | SD VOL | creme | rytm:voice:SD:level | SD VOLUME | continu |
| 18 | 3.3 | 7 | 102 | CH VOL | creme | rytm:voice:CH:level | CH VOLUME | continu |
| 19 | 3.4 | 7 | 103 | OH VOL | creme | rytm:voice:OH:level | OH VOLUME | continu |
| 20 | 3.5 | 7 | 104 | CP VOL | creme | rytm:voice:CP:level | CP VOLUME | continu |
| 21 | 3.6 | 7 | 105 | TOM VOL | creme | rytm:voice:TOM:level | TOM VOLUME | continu |
| 22 | 3.7 | 7 | 106 | HT VOL | creme | rytm:voice:HT:level | HT VOLUME | continu |
| 23 | 3.8 | 7 | 107 | CY VOL | creme | rytm:voice:CY:level | CY VOLUME | continu |
| 24 | 4.1 | 7 | 108 | MASTER | blanc | rytm:enc:level | MASTER | continu |
| 25 | 4.2 | 7 | 109 | TEMPO | blanc | rytm:enc:tempo | TEMPO | continu |
| 26 | 4.3 | 7 | 110 | SWING | orange | rytm:enc:swing | SWING | continu |
| 27 | 4.4 | 7 | 111 | STRETCH | orange | rytm:enc:stretch | STRETCH | bipolaire, cran au milieu (64) |
| 28 | 4.5 | 7 | 112 | DIST | violet | rytm:enc:dist | DIST | continu |
| 29 | 4.6 | 7 | 113 | CHORUS | violet | rytm:enc:chorus | CHORUS | continu |
| 30 | 4.7 | 7 | 114 | DELAY | violet | rytm:enc:delay | DELAY | continu |
| 31 | 4.8 | 7 | 115 | REVERB | violet | rytm:enc:reverb | REVERB | continu |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 15 | 14 | STEP 1/9 | orange | rytm:seq:1 | SEQ STEP 1/9 (TAP, HOLD + TURN) | maintenu |
| 1 | 1.2 | 15 | 15 | STEP 2/10 | orange | rytm:seq:2 | SEQ STEP 2/10 (TAP, HOLD + TURN) | maintenu |
| 2 | 1.3 | 15 | 16 | STEP 3/11 | orange | rytm:seq:3 | SEQ STEP 3/11 (TAP, HOLD + TURN) | maintenu |
| 3 | 1.4 | 15 | 17 | STEP 4/12 | orange | rytm:seq:4 | SEQ STEP 4/12 (TAP, HOLD + TURN) | maintenu |
| 4 | 1.5 | 15 | 18 | STEP 5/13 | orange | rytm:seq:5 | SEQ STEP 5/13 (TAP, HOLD + TURN) | maintenu |
| 5 | 1.6 | 15 | 19 | STEP 6/14 | orange | rytm:seq:6 | SEQ STEP 6/14 (TAP, HOLD + TURN) | maintenu |
| 6 | 1.7 | 15 | 20 | STEP 7/15 | orange | rytm:seq:7 | SEQ STEP 7/15 (TAP, HOLD + TURN) | maintenu |
| 7 | 1.8 | 15 | 21 | STEP 8/16 | orange | rytm:seq:8 | SEQ STEP 8/16 (TAP, HOLD + TURN) | maintenu |
| 8 | 2.1 | 15 | 3 | VOICE | jaune | rytm:page:voice | PAGE VOICE | appui |
| 9 | 2.2 | 15 | 25 | FLTR | jaune | rytm:page:fltr | PAGE FLTR | appui |
| 10 | 2.3 | 15 | 9 | ENV | jaune | rytm:page:env | PAGE ENV | appui |
| 11 | 2.4 | 15 | 27 | FX | jaune | rytm:page:fx | PAGE FX | appui |
| 12 | 2.5 | 15 | 85 | MUTE | rouge | rytm:mute | MUTE | appui |
| 13 | 2.6 | 15 | 86 | SOLO | bleu | rytm:solo | SOLO | appui |
| 14 | 2.7 | 15 | 28 | STEPS 9-16 | cyan | rytm:seq:window | SEQ STEPS 1-8 / 9-16 | appui |
| 15 | 2.8 | 15 | 29 | STEP FOLLOW | vert | rytm:seq:follow | SEQ STEP FOLLOW (THE STEPS FOLLOW THE PLAYHEAD) | bascule (la LED suit le site) |
| 16 | 3.1 | 15 | 30 | BD | or | rytm:seq:voice:BD | SEQ VOICE BD (SELECT, SILENT) | appui |
| 17 | 3.2 | 15 | 31 | SD | or | rytm:seq:voice:SD | SEQ VOICE SD (SELECT, SILENT) | appui |
| 18 | 3.3 | 15 | 102 | CH | or | rytm:seq:voice:CH | SEQ VOICE CH (SELECT, SILENT) | appui |
| 19 | 3.4 | 15 | 103 | OH | or | rytm:seq:voice:OH | SEQ VOICE OH (SELECT, SILENT) | appui |
| 20 | 3.5 | 15 | 104 | CP | or | rytm:seq:voice:CP | SEQ VOICE CP (SELECT, SILENT) | appui |
| 21 | 3.6 | 15 | 105 | TOM | or | rytm:seq:voice:TOM | SEQ VOICE TOM (SELECT, SILENT) | appui |
| 22 | 3.7 | 15 | 106 | HT | or | rytm:seq:voice:HT | SEQ VOICE HT (SELECT, SILENT) | appui |
| 23 | 3.8 | 15 | 107 | CY | or | rytm:seq:voice:CY | SEQ VOICE CY (SELECT, SILENT) | appui |
| 24 | 4.1 | 15 | 108 | RUN | rouge | rytm:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 25 | 4.2 | 15 | 109 | CLEAR | orange | rytm:clear | CLEAR | appui |
| 26 | 4.3 | 15 | 110 | RANDOM | orange | rytm:random | RANDOM | appui |
| 27 | 4.4 | 15 | 111 | LOCK | jaune | rytm:lock | LOCK (SELECTED STEP) | appui |
| 28 | 4.5 | 15 | 112 | EDIT | jaune | rytm:edit | EDIT | appui |
| 29 | 4.6 | 15 | 113 | PREV MACHINE | blanc | nav:prev | PREVIOUS MACHINE | appui |
| 30 | 4.7 | 15 | 114 | NEXT MACHINE | blanc | nav:next | NEXT MACHINE | appui |
| 31 | 4.8 | 15 | 115 | MACHINES | rouge | nav:machines | PLAY/STOP MACHINES | appui |

### BSEQ (SETUP 18, potards canal 8, boutons canal 16)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 8 | 14 | ENC A | jaune | bass:knob:1 | SCREEN VALUE A (PAGE) | continu |
| 1 | 1.2 | 8 | 15 | ENC B | jaune | bass:knob:2 | SCREEN VALUE B (PAGE) | continu |
| 2 | 1.3 | 8 | 16 | ENC C | jaune | bass:knob:3 | SCREEN VALUE C (PAGE) | continu |
| 3 | 1.4 | 8 | 17 | ENC D | jaune | bass:knob:4 | SCREEN VALUE D (PAGE) | continu |
| 4 | 1.5 | 8 | 18 | ENC E | jaune | bass:knob:5 | SCREEN VALUE E (PAGE) | continu |
| 5 | 1.6 | 8 | 19 | ENC F | jaune | bass:knob:6 | SCREEN VALUE F (PAGE) | continu |
| 6 | 1.7 | 8 | 20 | ENC G | jaune | bass:knob:7 | SCREEN VALUE G (PAGE) | continu |
| 7 | 1.8 | 8 | 21 | ENC H | jaune | bass:knob:8 | SCREEN VALUE H (PAGE) | continu |
| 8 | 2.1 | 8 | 22 | ENC A | jaune | bass:knob:1 | SCREEN VALUE A (PAGE) | continu |
| 9 | 2.2 | 8 | 23 | ENC B | jaune | bass:knob:2 | SCREEN VALUE B (PAGE) | continu |
| 10 | 2.3 | 8 | 24 | ENC C | jaune | bass:knob:3 | SCREEN VALUE C (PAGE) | continu |
| 11 | 2.4 | 8 | 25 | ENC D | jaune | bass:knob:4 | SCREEN VALUE D (PAGE) | continu |
| 12 | 2.5 | 8 | 26 | ENC E | jaune | bass:knob:5 | SCREEN VALUE E (PAGE) | continu |
| 13 | 2.6 | 8 | 27 | ENC F | jaune | bass:knob:6 | SCREEN VALUE F (PAGE) | continu |
| 14 | 2.7 | 8 | 28 | ENC G | jaune | bass:knob:7 | SCREEN VALUE G (PAGE) | continu |
| 15 | 2.8 | 8 | 29 | ENC H | jaune | bass:knob:8 | SCREEN VALUE H (PAGE) | continu |
| 16 | 3.1 | 8 | 30 | STYLE | jaune | bass:knob:style | STYLE | potard a 11 crans : ACID / DARK DISCO / INDIE DANCE / MINIMAL / PSY PROG / TECHNO / HOUSE / ELECTRO / EBM / ITALO / SUB |
| 17 | 3.2 | 8 | 31 | DENSITY | jaune | bass:knob:density | DENSITY | continu |
| 18 | 3.3 | 8 | 102 | SLIDE PROB | jaune | bass:knob:slides | SLIDE PROB | continu |
| 19 | 3.4 | 8 | 103 | ACC PROB | jaune | bass:knob:accents | ACC PROB | continu |
| 20 | 3.5 | 8 | 104 | RANGE | jaune | bass:knob:range | RANGE | potard a 3 crans : 1 / 2 / 3 |
| 21 | 3.6 | 8 | 105 | ROOT | cyan | bass:knob:root | ROOT | potard a 13 crans : ARP / F# / G / G# / A / A# / B / C / C# / D / D# / E / F |
| 22 | 3.7 | 8 | 106 | SCALE | cyan | bass:knob:scale | SCALE | potard a 5 crans : MINOR / DORIAN / PHRYGIAN / HARMONIC / PENTA |
| 23 | 3.8 | 8 | 107 | OCTAVE | or | bass:knob:octave | OCTAVE | potard a 4 crans : -2 / -1 / 0 / +1 |
| 24 | 4.1 | 8 | 108 | TEMPO | blanc | rytm:enc:tempo | TEMPO | continu |
| 25 | 4.2 | 8 | 109 | SWING | orange | rytm:enc:swing | SWING | continu |
| 26 | 4.3 | 8 | 110 | CUTOFF | orange | bass:knob:cutoff | CUTOFF | continu |
| 27 | 4.4 | 8 | 111 | RESO | orange | bass:knob:reso | RESO | continu |
| 28 | 4.5 | 8 | 112 | ENV MOD | orange | bass:knob:envmod | ENV MOD | continu |
| 29 | 4.6 | 8 | 113 | DECAY | orange | bass:knob:decay | DECAY | continu |
| 30 | 4.7 | 8 | 114 | ACCENT | rouge | bass:knob:accent | ACCENT | continu |
| 31 | 4.8 | 8 | 115 | VOLUME | blanc | bass:knob:volume | VOLUME | continu |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 16 | 14 | STEP 1/9 | orange | bass:seq:1 | SEQ STEP 1/9 (TAP, HOLD + TURN) | maintenu |
| 1 | 1.2 | 16 | 15 | STEP 2/10 | orange | bass:seq:2 | SEQ STEP 2/10 (TAP, HOLD + TURN) | maintenu |
| 2 | 1.3 | 16 | 16 | STEP 3/11 | orange | bass:seq:3 | SEQ STEP 3/11 (TAP, HOLD + TURN) | maintenu |
| 3 | 1.4 | 16 | 17 | STEP 4/12 | orange | bass:seq:4 | SEQ STEP 4/12 (TAP, HOLD + TURN) | maintenu |
| 4 | 1.5 | 16 | 18 | STEP 5/13 | orange | bass:seq:5 | SEQ STEP 5/13 (TAP, HOLD + TURN) | maintenu |
| 5 | 1.6 | 16 | 19 | STEP 6/14 | orange | bass:seq:6 | SEQ STEP 6/14 (TAP, HOLD + TURN) | maintenu |
| 6 | 1.7 | 16 | 20 | STEP 7/15 | orange | bass:seq:7 | SEQ STEP 7/15 (TAP, HOLD + TURN) | maintenu |
| 7 | 1.8 | 16 | 21 | STEP 8/16 | orange | bass:seq:8 | SEQ STEP 8/16 (TAP, HOLD + TURN) | maintenu |
| 8 | 2.1 | 16 | 22 | VOICE | jaune | bass:page:voice | PAGE VOICE (AGAIN: NEXT TAB) | appui |
| 9 | 2.2 | 16 | 23 | FILTER | jaune | bass:page:filter | PAGE FILTER (AGAIN: NEXT TAB) | appui |
| 10 | 2.3 | 16 | 24 | ENV | jaune | bass:page:env | PAGE ENV (AGAIN: NEXT TAB) | appui |
| 11 | 2.4 | 16 | 25 | FX | jaune | bass:page:fx | PAGE FX (AGAIN: NEXT TAB) | appui |
| 12 | 2.5 | 16 | 26 | ACCENT | rouge | bass:key:accent | ACCENT | appui |
| 13 | 2.6 | 16 | 27 | SLIDE | jaune | bass:key:slide | SLIDE | appui |
| 14 | 2.7 | 16 | 28 | STEPS 9-16 | cyan | bass:seq:window | SEQ STEPS 1-8 / 9-16 | appui |
| 15 | 2.8 | 16 | 29 | STEP FOLLOW | vert | bass:seq:follow | SEQ STEP FOLLOW (THE STEPS FOLLOW THE PLAYHEAD) | bascule (la LED suit le site) |
| 16 | 3.1 | 16 | 30 | NOTE - | cyan | bass:key:notedn | NOTE - | appui |
| 17 | 3.2 | 16 | 31 | NOTE + | cyan | bass:key:noteup | NOTE + | appui |
| 18 | 3.3 | 16 | 102 | OCT - | cyan | bass:key:octdn | OCT - | appui |
| 19 | 3.4 | 16 | 103 | OCT + | cyan | bass:key:octup | OCT + | appui |
| 20 | 3.5 | 16 | 104 | TIE | peche | bass:seq:tie | TIE (THE CHOSEN STEP) | appui |
| 21 | 3.6 | 16 | 105 | MUTATE | orange | bass:key:mutate | MUTATE | appui |
| 22 | 3.7 | 16 | 106 | ACCENT | rouge | bass:key:accent | ACCENT | appui |
| 23 | 3.8 | 16 | 107 | SLIDE | jaune | bass:key:slide | SLIDE | appui |
| 24 | 4.1 | 16 | 108 | RUN | rouge | bass:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 25 | 4.2 | 16 | 109 | CLEAR | orange | bass:key:clear | CLEAR | appui |
| 26 | 4.3 | 16 | 110 | GEN | orange | bass:key:gen | GEN | appui |
| 27 | 4.4 | 16 | 111 | LOCK | jaune | bass:lock | LOCK (CHOSEN STEP) | appui |
| 28 | 4.5 | 16 | 112 | EDIT | jaune | bass:key:edit | EDIT | appui |
| 29 | 4.6 | 16 | 113 | PREV MACHINE | blanc | nav:prev | PREVIOUS MACHINE | appui |
| 30 | 4.7 | 16 | 114 | NEXT MACHINE | blanc | nav:next | NEXT MACHINE | appui |
| 31 | 4.8 | 16 | 115 | MACHINES | rouge | nav:machines | PLAY/STOP MACHINES | appui |

## 4. Le catalogue complet des cibles

Tout ce que le site sait piloter : chaque ligne est une cible assignable (MIDI LEARN, ou le fichier d'assignations du chapitre 5). La colonne « Dans » dit dans quels setups du Roto elle est deja placee. La cible d'un id est dans la machine de son prefixe : `rytm:` MM-RYTM (scope `mm808`), `voy:` MM-ARP (`voy`), `bass:` MM-BASS (`bass`), `dj:` MM-DECKS (`dj`, `dj:smpl:<platine>:` pour le sampler de chaque platine), `nav:` navigation (`global`).

### MM-RYTM (scope `mm808`, 337 cibles)

| id | Nom | Type | Crans | Dans |
| --- | --- | --- | --- | --- |
| `rytm:enc:level` | MASTER | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:enc:tempo` | TEMPO | valeur 0 a 127 |  | RYTM, RSEQ, BSEQ |
| `rytm:enc:swing` | SWING | valeur 0 a 127 |  | RYTM, BASS, LIVE, RSEQ, BSEQ |
| `rytm:enc:stretch` | STRETCH | valeur 0 a 127 |  | RYTM, LIVE, RSEQ |
| `rytm:enc:dist` | DIST | valeur 0 a 127 |  | RYTM, LIVE, RSEQ |
| `rytm:enc:chorus` | CHORUS | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:enc:delay` | DELAY | valeur 0 a 127 |  | RYTM, LIVE, RSEQ |
| `rytm:enc:reverb` | REVERB | valeur 0 a 127 |  | RYTM, LIVE, RSEQ |
| `rytm:enc:vol` | VOLUME (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vsound` | SAMPLE (SELECTED VOICE) | valeur 0 a 127 | 9 | RYTM |
| `rytm:enc:tone` | TONE (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vdecay` | DECAY (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vdist` | DIST (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vchorus` | CHORUS (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vdelay` | DELAY (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vreverb` | REVERB (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vtune` | PITCH (SELECTED VOICE) | valeur 0 a 127 | 49 |  |
| `rytm:enc:vpan` | PAN (SELECTED VOICE) | valeur 0 a 127 |  |  |
| `rytm:enc:vstart` | START (SELECTED VOICE) | valeur 0 a 127 |  |  |
| `rytm:enc:vatk` | ATK (SELECTED VOICE) | valeur 0 a 127 |  |  |
| `rytm:enc:vhold` | HOLD (SELECTED VOICE) | valeur 0 a 127 |  |  |
| `rytm:enc:vfine` | FINE (SELECTED VOICE) | valeur 0 a 127 | 129 |  |
| `rytm:enc:vftype` | TYPE (SELECTED VOICE) | valeur 0 a 127 | 3 |  |
| `rytm:enc:vfcut` | FREQ (SELECTED VOICE) | valeur 0 a 127 |  |  |
| `rytm:enc:vfreso` | RESO (SELECTED VOICE) | valeur 0 a 127 |  |  |
| `rytm:enc:vfenv` | ENV (SELECTED VOICE) | valeur 0 a 127 |  |  |
| `rytm:enc:vfatk` | F.ATK (SELECTED VOICE) | valeur 0 a 127 |  |  |
| `rytm:enc:vfdec` | F.DEC (SELECTED VOICE) | valeur 0 a 127 |  |  |
| `rytm:enc:dtime` | DLY TIME | valeur 0 a 127 | 6 |  |
| `rytm:enc:dfb` | DLY FB | valeur 0 a 127 |  |  |
| `rytm:voice:BD:tone` | BD TONE | valeur 0 a 127 |  |  |
| `rytm:voice:BD:decay` | BD DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:BD:level` | BD VOLUME | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:voice:BD:dist` | BD DIST | valeur 0 a 127 |  |  |
| `rytm:voice:BD:reverb` | BD REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:BD:delay` | BD DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:BD:chorus` | BD CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:BD:tune` | BD TUNE | valeur 0 a 127 | 49 |  |
| `rytm:voice:BD:pan` | BD PAN | valeur 0 a 127 |  |  |
| `rytm:voice:BD:start` | BD START | valeur 0 a 127 |  |  |
| `rytm:voice:BD:atk` | BD ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:BD:hold` | BD HOLD | valeur 0 a 127 |  |  |
| `rytm:voice:BD:fine` | BD FINE | valeur 0 a 127 | 129 |  |
| `rytm:voice:BD:ftype` | BD FILTER TYPE | valeur 0 a 127 | 3 |  |
| `rytm:voice:BD:fcut` | BD FILTER FREQ | valeur 0 a 127 |  |  |
| `rytm:voice:BD:freso` | BD FILTER RESO | valeur 0 a 127 |  |  |
| `rytm:voice:BD:fenv` | BD FILTER ENV | valeur 0 a 127 |  |  |
| `rytm:voice:BD:fatk` | BD FILTER ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:BD:fdec` | BD FILTER DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:SD:tone` | SD TONE | valeur 0 a 127 |  |  |
| `rytm:voice:SD:decay` | SD DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:SD:level` | SD VOLUME | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:voice:SD:dist` | SD DIST | valeur 0 a 127 |  |  |
| `rytm:voice:SD:reverb` | SD REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:SD:delay` | SD DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:SD:chorus` | SD CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:SD:tune` | SD TUNE | valeur 0 a 127 | 49 |  |
| `rytm:voice:SD:pan` | SD PAN | valeur 0 a 127 |  |  |
| `rytm:voice:SD:start` | SD START | valeur 0 a 127 |  |  |
| `rytm:voice:SD:atk` | SD ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:SD:hold` | SD HOLD | valeur 0 a 127 |  |  |
| `rytm:voice:SD:fine` | SD FINE | valeur 0 a 127 | 129 |  |
| `rytm:voice:SD:ftype` | SD FILTER TYPE | valeur 0 a 127 | 3 |  |
| `rytm:voice:SD:fcut` | SD FILTER FREQ | valeur 0 a 127 |  |  |
| `rytm:voice:SD:freso` | SD FILTER RESO | valeur 0 a 127 |  |  |
| `rytm:voice:SD:fenv` | SD FILTER ENV | valeur 0 a 127 |  |  |
| `rytm:voice:SD:fatk` | SD FILTER ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:SD:fdec` | SD FILTER DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:CH:tone` | CH TONE | valeur 0 a 127 |  |  |
| `rytm:voice:CH:decay` | CH DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:CH:level` | CH VOLUME | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:voice:CH:dist` | CH DIST | valeur 0 a 127 |  |  |
| `rytm:voice:CH:reverb` | CH REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:CH:delay` | CH DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:CH:chorus` | CH CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:CH:tune` | CH TUNE | valeur 0 a 127 | 49 |  |
| `rytm:voice:CH:pan` | CH PAN | valeur 0 a 127 |  |  |
| `rytm:voice:CH:start` | CH START | valeur 0 a 127 |  |  |
| `rytm:voice:CH:atk` | CH ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:CH:hold` | CH HOLD | valeur 0 a 127 |  |  |
| `rytm:voice:CH:fine` | CH FINE | valeur 0 a 127 | 129 |  |
| `rytm:voice:CH:ftype` | CH FILTER TYPE | valeur 0 a 127 | 3 |  |
| `rytm:voice:CH:fcut` | CH FILTER FREQ | valeur 0 a 127 |  |  |
| `rytm:voice:CH:freso` | CH FILTER RESO | valeur 0 a 127 |  |  |
| `rytm:voice:CH:fenv` | CH FILTER ENV | valeur 0 a 127 |  |  |
| `rytm:voice:CH:fatk` | CH FILTER ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:CH:fdec` | CH FILTER DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:OH:tone` | OH TONE | valeur 0 a 127 |  |  |
| `rytm:voice:OH:decay` | OH DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:OH:level` | OH VOLUME | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:voice:OH:dist` | OH DIST | valeur 0 a 127 |  |  |
| `rytm:voice:OH:reverb` | OH REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:OH:delay` | OH DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:OH:chorus` | OH CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:OH:tune` | OH TUNE | valeur 0 a 127 | 49 |  |
| `rytm:voice:OH:pan` | OH PAN | valeur 0 a 127 |  |  |
| `rytm:voice:OH:start` | OH START | valeur 0 a 127 |  |  |
| `rytm:voice:OH:atk` | OH ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:OH:hold` | OH HOLD | valeur 0 a 127 |  |  |
| `rytm:voice:OH:fine` | OH FINE | valeur 0 a 127 | 129 |  |
| `rytm:voice:OH:ftype` | OH FILTER TYPE | valeur 0 a 127 | 3 |  |
| `rytm:voice:OH:fcut` | OH FILTER FREQ | valeur 0 a 127 |  |  |
| `rytm:voice:OH:freso` | OH FILTER RESO | valeur 0 a 127 |  |  |
| `rytm:voice:OH:fenv` | OH FILTER ENV | valeur 0 a 127 |  |  |
| `rytm:voice:OH:fatk` | OH FILTER ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:OH:fdec` | OH FILTER DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:CP:tone` | CP TONE | valeur 0 a 127 |  |  |
| `rytm:voice:CP:decay` | CP DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:CP:level` | CP VOLUME | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:voice:CP:dist` | CP DIST | valeur 0 a 127 |  |  |
| `rytm:voice:CP:reverb` | CP REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:CP:delay` | CP DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:CP:chorus` | CP CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:CP:tune` | CP TUNE | valeur 0 a 127 | 49 |  |
| `rytm:voice:CP:pan` | CP PAN | valeur 0 a 127 |  |  |
| `rytm:voice:CP:start` | CP START | valeur 0 a 127 |  |  |
| `rytm:voice:CP:atk` | CP ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:CP:hold` | CP HOLD | valeur 0 a 127 |  |  |
| `rytm:voice:CP:fine` | CP FINE | valeur 0 a 127 | 129 |  |
| `rytm:voice:CP:ftype` | CP FILTER TYPE | valeur 0 a 127 | 3 |  |
| `rytm:voice:CP:fcut` | CP FILTER FREQ | valeur 0 a 127 |  |  |
| `rytm:voice:CP:freso` | CP FILTER RESO | valeur 0 a 127 |  |  |
| `rytm:voice:CP:fenv` | CP FILTER ENV | valeur 0 a 127 |  |  |
| `rytm:voice:CP:fatk` | CP FILTER ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:CP:fdec` | CP FILTER DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:tone` | TOM TONE | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:decay` | TOM DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:level` | TOM VOLUME | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:voice:TOM:dist` | TOM DIST | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:reverb` | TOM REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:delay` | TOM DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:chorus` | TOM CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:tune` | TOM TUNE | valeur 0 a 127 | 49 |  |
| `rytm:voice:TOM:pan` | TOM PAN | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:start` | TOM START | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:atk` | TOM ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:hold` | TOM HOLD | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:fine` | TOM FINE | valeur 0 a 127 | 129 |  |
| `rytm:voice:TOM:ftype` | TOM FILTER TYPE | valeur 0 a 127 | 3 |  |
| `rytm:voice:TOM:fcut` | TOM FILTER FREQ | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:freso` | TOM FILTER RESO | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:fenv` | TOM FILTER ENV | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:fatk` | TOM FILTER ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:fdec` | TOM FILTER DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:HT:tone` | HT TONE | valeur 0 a 127 |  |  |
| `rytm:voice:HT:decay` | HT DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:HT:level` | HT VOLUME | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:voice:HT:dist` | HT DIST | valeur 0 a 127 |  |  |
| `rytm:voice:HT:reverb` | HT REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:HT:delay` | HT DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:HT:chorus` | HT CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:HT:tune` | HT TUNE | valeur 0 a 127 | 49 |  |
| `rytm:voice:HT:pan` | HT PAN | valeur 0 a 127 |  |  |
| `rytm:voice:HT:start` | HT START | valeur 0 a 127 |  |  |
| `rytm:voice:HT:atk` | HT ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:HT:hold` | HT HOLD | valeur 0 a 127 |  |  |
| `rytm:voice:HT:fine` | HT FINE | valeur 0 a 127 | 129 |  |
| `rytm:voice:HT:ftype` | HT FILTER TYPE | valeur 0 a 127 | 3 |  |
| `rytm:voice:HT:fcut` | HT FILTER FREQ | valeur 0 a 127 |  |  |
| `rytm:voice:HT:freso` | HT FILTER RESO | valeur 0 a 127 |  |  |
| `rytm:voice:HT:fenv` | HT FILTER ENV | valeur 0 a 127 |  |  |
| `rytm:voice:HT:fatk` | HT FILTER ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:HT:fdec` | HT FILTER DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:CY:tone` | CY TONE | valeur 0 a 127 |  |  |
| `rytm:voice:CY:decay` | CY DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:CY:level` | CY VOLUME | valeur 0 a 127 |  | RYTM, RSEQ |
| `rytm:voice:CY:dist` | CY DIST | valeur 0 a 127 |  |  |
| `rytm:voice:CY:reverb` | CY REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:CY:delay` | CY DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:CY:chorus` | CY CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:CY:tune` | CY TUNE | valeur 0 a 127 | 49 |  |
| `rytm:voice:CY:pan` | CY PAN | valeur 0 a 127 |  |  |
| `rytm:voice:CY:start` | CY START | valeur 0 a 127 |  |  |
| `rytm:voice:CY:atk` | CY ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:CY:hold` | CY HOLD | valeur 0 a 127 |  |  |
| `rytm:voice:CY:fine` | CY FINE | valeur 0 a 127 | 129 |  |
| `rytm:voice:CY:ftype` | CY FILTER TYPE | valeur 0 a 127 | 3 |  |
| `rytm:voice:CY:fcut` | CY FILTER FREQ | valeur 0 a 127 |  |  |
| `rytm:voice:CY:freso` | CY FILTER RESO | valeur 0 a 127 |  |  |
| `rytm:voice:CY:fenv` | CY FILTER ENV | valeur 0 a 127 |  |  |
| `rytm:voice:CY:fatk` | CY FILTER ATTACK | valeur 0 a 127 |  |  |
| `rytm:voice:CY:fdec` | CY FILTER DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:BD:mute` | MUTE BD | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:SD:mute` | MUTE SD | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:CH:mute` | MUTE CH | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:OH:mute` | MUTE OH | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:CP:mute` | MUTE CP | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:TOM:mute` | MUTE TOM | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:HT:mute` | MUTE HT | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:CY:mute` | MUTE CY | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:running` | RUN (ON / OFF) | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE, RSEQ |
| `rytm:kit:bd` | TWEAK KICK | valeur 0 a 127 | 9 | RYTM |
| `rytm:kit:tune` | TWEAK TUNE | valeur 0 a 127 |  | RYTM, LIVE |
| `rytm:kit:attack` | TWEAK ATTACK | valeur 0 a 127 |  | RYTM |
| `rytm:kit:decay` | TWEAK DECAY | valeur 0 a 127 |  | RYTM, LIVE |
| `rytm:kit:drive` | TWEAK DRIVE | valeur 0 a 127 |  | RYTM, LIVE |
| `rytm:kit:sd` | TWEAK SNARE | valeur 0 a 127 | 7 | RYTM |
| `rytm:kit:snappy` | TWEAK SNAPPY | valeur 0 a 127 |  | RYTM |
| `rytm:kit:cp` | TWEAK CLAP | valeur 0 a 127 | 3 |  |
| `rytm:kit:gate` | TWEAK GATE | valeur 0 a 127 | 2 |  |
| `rytm:kit:hh` | TWEAK HATS | valeur 0 a 127 | 3 | RYTM |
| `rytm:kit:tom` | TWEAK TOMS | valeur 0 a 127 | 3 |  |
| `rytm:kit:sweep` | TWEAK KICK SWEEP | valeur 0 a 127 |  |  |
| `rytm:kit:sdtune` | TWEAK SNARE TUNE | valeur 0 a 127 |  |  |
| `rytm:kit:sddecay` | TWEAK SNARE DECAY | valeur 0 a 127 |  |  |
| `rytm:kit:sdtone` | TWEAK SNARE TONE | valeur 0 a 127 |  |  |
| `rytm:layer:bd:mach` | KICK SYN MACHINE | valeur 0 a 127 | 3 |  |
| `rytm:layer:bd:syn` | KICK SYN LEVEL | valeur 0 a 127 |  |  |
| `rytm:layer:bd:sample` | KICK SAMPLE | valeur 0 a 127 | 7 |  |
| `rytm:layer:bd:lev` | KICK SMP LEVEL | valeur 0 a 127 |  |  |
| `rytm:layer:bd:tune` | KICK SMP TUNE | valeur 0 a 127 | 49 |  |
| `rytm:layer:bd:fine` | KICK SMP FINE | valeur 0 a 127 | 129 |  |
| `rytm:layer:bd:start` | KICK SMP START | valeur 0 a 127 |  |  |
| `rytm:layer:bd:len` | KICK SMP LEN | valeur 0 a 127 |  |  |
| `rytm:layer:bd:rev` | KICK SMP REV | valeur 0 a 127 | 2 |  |
| `rytm:layer:sd:mach` | SNARE SYN MACHINE | valeur 0 a 127 | 3 |  |
| `rytm:layer:sd:syn` | SNARE SYN LEVEL | valeur 0 a 127 |  |  |
| `rytm:layer:sd:sample` | SNARE SAMPLE | valeur 0 a 127 | 5 |  |
| `rytm:layer:sd:lev` | SNARE SMP LEVEL | valeur 0 a 127 |  |  |
| `rytm:layer:sd:tune` | SNARE SMP TUNE | valeur 0 a 127 | 49 |  |
| `rytm:layer:sd:fine` | SNARE SMP FINE | valeur 0 a 127 | 129 |  |
| `rytm:layer:sd:start` | SNARE SMP START | valeur 0 a 127 |  |  |
| `rytm:layer:sd:len` | SNARE SMP LEN | valeur 0 a 127 |  |  |
| `rytm:layer:sd:rev` | SNARE SMP REV | valeur 0 a 127 | 2 |  |
| `rytm:layer:hh:mach` | HATS SYN MACHINE | valeur 0 a 127 | 3 |  |
| `rytm:layer:hh:syn` | HATS SYN LEVEL | valeur 0 a 127 |  |  |
| `rytm:layer:cp:mach` | CLAP SYN MACHINE | valeur 0 a 127 | 3 |  |
| `rytm:layer:cp:syn` | CLAP SYN LEVEL | valeur 0 a 127 |  |  |
| `rytm:layer:tom:mach` | TOMS SYN MACHINE | valeur 0 a 127 | 3 |  |
| `rytm:layer:tom:syn` | TOMS SYN LEVEL | valeur 0 a 127 |  |  |
| `rytm:knob:1` | KNOB A (PAGE) | valeur 0 a 127 | selon la page | RSEQ |
| `rytm:knob:2` | KNOB B (PAGE) | valeur 0 a 127 | selon la page | RSEQ |
| `rytm:knob:3` | KNOB C (PAGE) | valeur 0 a 127 | selon la page | RSEQ |
| `rytm:knob:4` | KNOB D (PAGE) | valeur 0 a 127 | selon la page | RSEQ |
| `rytm:knob:5` | KNOB E (PAGE) | valeur 0 a 127 | selon la page | RSEQ |
| `rytm:knob:6` | KNOB F (PAGE) | valeur 0 a 127 | selon la page | RSEQ |
| `rytm:knob:7` | KNOB G (PAGE) | valeur 0 a 127 | selon la page | RSEQ |
| `rytm:knob:8` | KNOB H (PAGE) | valeur 0 a 127 | selon la page | RSEQ |
| `rytm:page:voice` | PAGE VOICE | appui |  | RSEQ |
| `rytm:page:fltr` | PAGE FLTR | appui |  | RSEQ |
| `rytm:page:env` | PAGE ENV | appui |  | RSEQ |
| `rytm:page:fx` | PAGE FX | appui |  | RSEQ |
| `rytm:page:trig` | PAGE TRIG (NOW VOICE) | appui |  |  |
| `rytm:page:src` | PAGE SRC (NOW VOICE) | appui |  |  |
| `rytm:page:smpl` | PAGE SMPL (NOW VOICE) | appui |  |  |
| `rytm:page:amp` | PAGE AMP (NOW ENV) | appui |  |  |
| `rytm:screen:voice` | SCREEN VOICE | appui |  |  |
| `rytm:screen:synth` | SCREEN VOICE SYNTH | appui |  |  |
| `rytm:screen:fltr` | SCREEN FLTR | appui |  |  |
| `rytm:screen:env` | SCREEN ENV | appui |  |  |
| `rytm:screen:fxv` | SCREEN VOICE FX | appui |  |  |
| `rytm:screen:fxg` | SCREEN GLOBAL FX | appui |  |  |
| `rytm:page` | PAGE (VOICE TO FX) | valeur 0 a 127 | 4 |  |
| `rytm:home` | HOME / PAGE SCREEN | appui |  |  |
| `rytm:pad:BD` | PAD BD | appui |  | RYTM |
| `rytm:pad:SD` | PAD SD | appui |  | RYTM |
| `rytm:pad:CH` | PAD CH | appui |  | RYTM |
| `rytm:pad:OH` | PAD OH | appui |  | RYTM |
| `rytm:pad:CP` | PAD CP | appui |  | RYTM |
| `rytm:pad:TOM` | PAD TOM | appui |  | RYTM |
| `rytm:pad:HT` | PAD HT | appui |  | RYTM |
| `rytm:pad:CY` | PAD CY | appui |  | RYTM |
| `rytm:step:0` | STEP 1 | appui |  |  |
| `rytm:step:1` | STEP 2 | appui |  |  |
| `rytm:step:2` | STEP 3 | appui |  |  |
| `rytm:step:3` | STEP 4 | appui |  |  |
| `rytm:step:4` | STEP 5 | appui |  |  |
| `rytm:step:5` | STEP 6 | appui |  |  |
| `rytm:step:6` | STEP 7 | appui |  |  |
| `rytm:step:7` | STEP 8 | appui |  |  |
| `rytm:step:8` | STEP 9 | appui |  |  |
| `rytm:step:9` | STEP 10 | appui |  |  |
| `rytm:step:10` | STEP 11 | appui |  |  |
| `rytm:step:11` | STEP 12 | appui |  |  |
| `rytm:step:12` | STEP 13 | appui |  |  |
| `rytm:step:13` | STEP 14 | appui |  |  |
| `rytm:step:14` | STEP 15 | appui |  |  |
| `rytm:step:15` | STEP 16 | appui |  |  |
| `rytm:lock:0` | LOCK STEP 1 | appui |  |  |
| `rytm:lock:1` | LOCK STEP 2 | appui |  |  |
| `rytm:lock:2` | LOCK STEP 3 | appui |  |  |
| `rytm:lock:3` | LOCK STEP 4 | appui |  |  |
| `rytm:lock:4` | LOCK STEP 5 | appui |  |  |
| `rytm:lock:5` | LOCK STEP 6 | appui |  |  |
| `rytm:lock:6` | LOCK STEP 7 | appui |  |  |
| `rytm:lock:7` | LOCK STEP 8 | appui |  |  |
| `rytm:lock:8` | LOCK STEP 9 | appui |  |  |
| `rytm:lock:9` | LOCK STEP 10 | appui |  |  |
| `rytm:lock:10` | LOCK STEP 11 | appui |  |  |
| `rytm:lock:11` | LOCK STEP 12 | appui |  |  |
| `rytm:lock:12` | LOCK STEP 13 | appui |  |  |
| `rytm:lock:13` | LOCK STEP 14 | appui |  |  |
| `rytm:lock:14` | LOCK STEP 15 | appui |  |  |
| `rytm:lock:15` | LOCK STEP 16 | appui |  |  |
| `rytm:lock` | LOCK (SELECTED STEP) | appui |  | RSEQ |
| `rytm:run` | RUN/STOP | appui |  |  |
| `rytm:clear` | CLEAR | appui |  | RYTM, RSEQ |
| `rytm:random` | RANDOM | appui |  | RYTM, RSEQ |
| `rytm:mute` | MUTE | appui |  | RSEQ |
| `rytm:solo` | SOLO | appui |  | RSEQ |
| `rytm:edit` | EDIT | appui |  | RYTM, RSEQ |
| `rytm:open` | OPEN | appui |  | RYTM |
| `rytm:infos` | INFOS (HELP ON HOVER) | appui |  |  |
| `rytm:ptn:0` | PATTERN A01 | appui |  | RYTM |
| `rytm:ptn:1` | PATTERN A02 | appui |  | RYTM |
| `rytm:ptn:2` | PATTERN A03 | appui |  | RYTM |
| `rytm:ptn:3` | PATTERN A04 | appui |  | RYTM |
| `rytm:ptn:4` | PATTERN A05 | appui |  | RYTM |
| `rytm:ptn:5` | PATTERN A06 | appui |  | RYTM |
| `rytm:ptn:6` | PATTERN A07 | appui |  | RYTM |
| `rytm:ptn:7` | PATTERN A08 | appui |  | RYTM |
| `rytm:ptn:8` | PATTERN A09 | appui |  |  |
| `rytm:ptn:9` | PATTERN A10 | appui |  |  |
| `rytm:ptn:10` | PATTERN A11 | appui |  |  |
| `rytm:ptn:11` | PATTERN A12 | appui |  |  |
| `rytm:ptn:12` | PATTERN A13 | appui |  |  |
| `rytm:ptn:13` | PATTERN A14 | appui |  |  |
| `rytm:ptn:14` | PATTERN A15 | appui |  |  |
| `rytm:ptn:15` | PATTERN A16 | appui |  |  |
| `rytm:seq:1` | SEQ STEP 1/9 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | RSEQ |
| `rytm:seq:2` | SEQ STEP 2/10 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | RSEQ |
| `rytm:seq:3` | SEQ STEP 3/11 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | RSEQ |
| `rytm:seq:4` | SEQ STEP 4/12 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | RSEQ |
| `rytm:seq:5` | SEQ STEP 5/13 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | RSEQ |
| `rytm:seq:6` | SEQ STEP 6/14 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | RSEQ |
| `rytm:seq:7` | SEQ STEP 7/15 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | RSEQ |
| `rytm:seq:8` | SEQ STEP 8/16 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | RSEQ |
| `rytm:seq:window` | SEQ STEPS 1-8 / 9-16 | appui |  | RSEQ |
| `rytm:seq:follow` | SEQ STEP FOLLOW (THE STEPS FOLLOW THE PLAYHEAD) | valeur 0 a 127 | 2 | RSEQ |
| `rytm:seq:voice:BD` | SEQ VOICE BD (SELECT, SILENT) | appui |  | RSEQ |
| `rytm:seq:voice:SD` | SEQ VOICE SD (SELECT, SILENT) | appui |  | RSEQ |
| `rytm:seq:voice:CH` | SEQ VOICE CH (SELECT, SILENT) | appui |  | RSEQ |
| `rytm:seq:voice:OH` | SEQ VOICE OH (SELECT, SILENT) | appui |  | RSEQ |
| `rytm:seq:voice:CP` | SEQ VOICE CP (SELECT, SILENT) | appui |  | RSEQ |
| `rytm:seq:voice:TOM` | SEQ VOICE TOM (SELECT, SILENT) | appui |  | RSEQ |
| `rytm:seq:voice:HT` | SEQ VOICE HT (SELECT, SILENT) | appui |  | RSEQ |
| `rytm:seq:voice:CY` | SEQ VOICE CY (SELECT, SILENT) | appui |  | RSEQ |

### MM-ARP (scope `voy`, 67 cibles)

| id | Nom | Type | Crans | Dans |
| --- | --- | --- | --- | --- |
| `voy:knob:rate` | RATE | valeur 0 a 127 | 4 | ARP, LIVE |
| `voy:knob:mode` | MODE | valeur 0 a 127 | 4 | ARP |
| `voy:knob:range` | RANGE | valeur 0 a 127 | 3 | ARP |
| `voy:knob:notes` | NOTES | valeur 0 a 127 | 9 | ARP |
| `voy:knob:gate` | GATE | valeur 0 a 127 |  | ARP, LIVE |
| `voy:knob:wave1` | WAVE 1 | valeur 0 a 127 |  |  |
| `voy:knob:range1` | RANGE 1 | valeur 0 a 127 | 6 |  |
| `voy:knob:semi1` | SEMI 1 | valeur 0 a 127 | 15 |  |
| `voy:knob:fine1` | FINE 1 | valeur 0 a 127 |  |  |
| `voy:knob:on1` | OSC 1 | valeur 0 a 127 | 2 | ARP |
| `voy:knob:wave2` | WAVE 2 | valeur 0 a 127 |  |  |
| `voy:knob:range2` | RANGE 2 | valeur 0 a 127 | 6 |  |
| `voy:knob:semi2` | SEMI 2 | valeur 0 a 127 | 15 |  |
| `voy:knob:fine2` | FINE 2 | valeur 0 a 127 |  |  |
| `voy:knob:on2` | OSC 2 | valeur 0 a 127 | 2 | ARP |
| `voy:knob:osc1` | OSC 1 | valeur 0 a 127 |  | ARP |
| `voy:knob:osc2` | OSC 2 | valeur 0 a 127 |  | ARP |
| `voy:knob:fm` | FM | valeur 0 a 127 |  | ARP |
| `voy:knob:ratio` | RATIO | valeur 0 a 127 | 9 |  |
| `voy:knob:octave` | OCTAVE | valeur 0 a 127 | 5 | ARP |
| `voy:knob:glide` | GLIDE | valeur 0 a 127 |  | ARP |
| `voy:knob:cutoff` | CUTOFF | valeur 0 a 127 |  | ARP, LIVE |
| `voy:knob:res` | RES | valeur 0 a 127 |  | ARP, LIVE |
| `voy:knob:envAmt` | ENV AMT | valeur 0 a 127 |  | ARP, LIVE |
| `voy:knob:noise` | NOISE | valeur 0 a 127 |  | ARP |
| `voy:knob:fmode` | MODE | valeur 0 a 127 | 4 | ARP |
| `voy:knob:fA` | ATTACK | valeur 0 a 127 |  | ARP |
| `voy:knob:fD` | DECAY | valeur 0 a 127 |  | ARP, LIVE |
| `voy:knob:fS` | SUSTAIN | valeur 0 a 127 |  | ARP |
| `voy:knob:fR` | RELEASE | valeur 0 a 127 |  | ARP |
| `voy:knob:aA` | ATTACK | valeur 0 a 127 |  | ARP |
| `voy:knob:aD` | DECAY | valeur 0 a 127 |  | ARP |
| `voy:knob:aS` | SUSTAIN | valeur 0 a 127 |  | ARP |
| `voy:knob:aR` | RELEASE | valeur 0 a 127 |  | ARP |
| `voy:knob:lfoRate` | SPEED | valeur 0 a 127 | 7 | ARP |
| `voy:knob:lfoShape` | SHAPE | valeur 0 a 127 | 4 | ARP |
| `voy:knob:lfoDest` | TARGET | valeur 0 a 127 | 5 | ARP |
| `voy:knob:lfoAmt` | DEPTH | valeur 0 a 127 |  | ARP |
| `voy:knob:dist` | OVERDRIVE | valeur 0 a 127 |  | ARP |
| `voy:knob:chorus` | CHORUS | valeur 0 a 127 |  | ARP |
| `voy:knob:delay` | DELAY | valeur 0 a 127 |  | ARP, LIVE |
| `voy:knob:reverb` | REVERB | valeur 0 a 127 |  | ARP, LIVE |
| `voy:knob:volume` | VOLUME | valeur 0 a 127 |  | ARP |
| `voy:knob:phase` | TWEAK PHASE | valeur 0 a 127 |  |  |
| `voy:knob:drift` | TWEAK DRIFT | valeur 0 a 127 |  |  |
| `voy:knob:width` | TWEAK WIDTH | valeur 0 a 127 |  |  |
| `voy:knob:monoLow` | TWEAK BASS MONO | valeur 0 a 127 |  |  |
| `voy:knob:keyTrack` | TWEAK KEY TRACK | valeur 0 a 127 |  |  |
| `voy:knob:accent` | TWEAK ACCENT | valeur 0 a 127 |  |  |
| `voy:knob:sync` | TWEAK SYNC | valeur 0 a 127 | 2 |  |
| `voy:knob:duck` | TWEAK SIDECHAIN | valeur 0 a 127 |  |  |
| `voy:knob:chord` | TWEAK CHORD | valeur 0 a 127 | 5 |  |
| `voy:pad:0` | CHORD F#m | appui |  | ARP, LIVE |
| `voy:pad:1` | CHORD D | appui |  | ARP, LIVE |
| `voy:pad:2` | CHORD E | appui |  | ARP, LIVE |
| `voy:pad:3` | CHORD C#m | appui |  | ARP, LIVE |
| `voy:pad:4` | CHORD Bm | appui |  | ARP, LIVE |
| `voy:pad:5` | CHORD A | appui |  | ARP, LIVE |
| `voy:pad:6` | CHORD F#m7 | appui |  | ARP, LIVE |
| `voy:pad:7` | CHORD Dmaj7 | appui |  | ARP, LIVE |
| `voy:run` | RUN/STOP | appui |  |  |
| `voy:running` | RUN (ON / OFF) | valeur 0 a 127 | 2 | ARP, MIXER, LIVE |
| `voy:clear` | CLEAR | appui |  | ARP |
| `voy:random` | RANDOM | appui |  | ARP |
| `voy:edit` | EDIT | appui |  | ARP |
| `voy:open` | OPEN | appui |  | ARP |
| `voy:infos` | INFOS (HELP ON HOVER) | appui |  |  |

### MM-BASS (scope `bass`, 144 cibles)

| id | Nom | Type | Crans | Dans |
| --- | --- | --- | --- | --- |
| `bass:knob:cutoff` | CUTOFF | valeur 0 a 127 |  | BASS, BSEQ |
| `bass:knob:reso` | RESO | valeur 0 a 127 |  | BASS, BSEQ |
| `bass:knob:envmod` | ENV MOD | valeur 0 a 127 |  | BASS, BSEQ |
| `bass:knob:decay` | DECAY | valeur 0 a 127 |  | BASS, BSEQ |
| `bass:knob:accent` | ACCENT | valeur 0 a 127 |  | BASS, BSEQ |
| `bass:knob:wave` | OSC 1 WAVE | valeur 0 a 127 |  | BASS |
| `bass:knob:sub` | SUB | valeur 0 a 127 |  | BASS |
| `bass:knob:drive` | DRIVE | valeur 0 a 127 |  | BASS |
| `bass:knob:glide` | GLIDE | valeur 0 a 127 |  | BASS |
| `bass:knob:volume` | VOLUME | valeur 0 a 127 |  | BASS, BSEQ |
| `bass:knob:octave` | OCTAVE | valeur 0 a 127 | 4 | BASS, BSEQ |
| `bass:knob:style` | STYLE | valeur 0 a 127 | 11 | BASS, BSEQ |
| `bass:knob:density` | DENSITY | valeur 0 a 127 |  | BASS, BSEQ |
| `bass:knob:slides` | SLIDE PROB | valeur 0 a 127 |  | BASS, BSEQ |
| `bass:knob:accents` | ACC PROB | valeur 0 a 127 |  | BASS, BSEQ |
| `bass:knob:range` | RANGE | valeur 0 a 127 | 3 | BASS, BSEQ |
| `bass:knob:root` | ROOT | valeur 0 a 127 | 13 | BASS, BSEQ |
| `bass:knob:scale` | SCALE | valeur 0 a 127 | 5 | BASS, BSEQ |
| `bass:knob:length` | LENGTH | valeur 0 a 127 |  | BASS |
| `bass:knob:accdecay` | ACC DECAY | valeur 0 a 127 |  | BASS |
| `bass:knob:sweep` | SWEEP | valeur 0 a 127 |  | BASS |
| `bass:knob:release` | RELEASE | valeur 0 a 127 |  | BASS |
| `bass:knob:suboct` | SUB OCT | valeur 0 a 127 | 2 |  |
| `bass:knob:tune` | TUNE | valeur 0 a 127 |  | BASS |
| `bass:knob:pw` | OSC 1 PW | valeur 0 a 127 |  |  |
| `bass:knob:keytrack` | KEY TRK | valeur 0 a 127 |  |  |
| `bass:knob:attack` | ATTACK | valeur 0 a 127 |  |  |
| `bass:knob:adecay` | AMP DECAY | valeur 0 a 127 |  |  |
| `bass:knob:sustain` | SUSTAIN | valeur 0 a 127 |  |  |
| `bass:knob:delay` | DELAY | valeur 0 a 127 |  |  |
| `bass:knob:dtime` | DLY TIME | valeur 0 a 127 | 6 |  |
| `bass:knob:dfb` | DLY FB | valeur 0 a 127 |  |  |
| `bass:knob:reverb` | REVERB | valeur 0 a 127 |  |  |
| `bass:knob:rsize` | REV SIZE | valeur 0 a 127 |  |  |
| `bass:knob:rtone` | REV TONE | valeur 0 a 127 |  |  |
| `bass:knob:o1lvl` | OSC 1 | valeur 0 a 127 |  |  |
| `bass:knob:o2wave` | OSC 2 WAVE | valeur 0 a 127 | 6 |  |
| `bass:knob:o2range` | OSC 2 RANGE | valeur 0 a 127 | 4 |  |
| `bass:knob:o2semi` | OSC 2 SEMI | valeur 0 a 127 | 15 |  |
| `bass:knob:o2fine` | OSC 2 FINE | valeur 0 a 127 |  | BASS |
| `bass:knob:o2lvl` | OSC 2 | valeur 0 a 127 |  | BASS |
| `bass:knob:o3wave` | OSC 3 WAVE | valeur 0 a 127 | 6 |  |
| `bass:knob:o3range` | OSC 3 RANGE | valeur 0 a 127 | 4 |  |
| `bass:knob:o3semi` | OSC 3 SEMI | valeur 0 a 127 | 15 |  |
| `bass:knob:o3fine` | OSC 3 FINE | valeur 0 a 127 |  |  |
| `bass:knob:o3lvl` | OSC 3 | valeur 0 a 127 |  | BASS |
| `bass:knob:noise` | NOISE | valeur 0 a 127 |  | BASS |
| `bass:knob:feedback` | FEEDBACK | valeur 0 a 127 |  | BASS |
| `bass:knob:drift` | DRIFT | valeur 0 a 127 |  |  |
| `bass:knob:fmode` | MODE | valeur 0 a 127 | 5 | BASS |
| `bass:knob:fattack` | F.ATTACK | valeur 0 a 127 |  | BASS |
| `bass:knob:fsustain` | F.SUSTAIN | valeur 0 a 127 |  | BASS |
| `bass:knob:fpol` | POLARITY | valeur 0 a 127 | 2 |  |
| `bass:knob:1` | SCREEN VALUE A (PAGE) | valeur 0 a 127 |  | BSEQ |
| `bass:knob:2` | SCREEN VALUE B (PAGE) | valeur 0 a 127 |  | BSEQ |
| `bass:knob:3` | SCREEN VALUE C (PAGE) | valeur 0 a 127 |  | BSEQ |
| `bass:knob:4` | SCREEN VALUE D (PAGE) | valeur 0 a 127 |  | BSEQ |
| `bass:knob:5` | SCREEN VALUE E (PAGE) | valeur 0 a 127 |  | BSEQ |
| `bass:knob:6` | SCREEN VALUE F (PAGE) | valeur 0 a 127 |  | BSEQ |
| `bass:knob:7` | SCREEN VALUE G (PAGE) | valeur 0 a 127 |  | BSEQ |
| `bass:knob:8` | SCREEN VALUE H (PAGE) | valeur 0 a 127 |  | BSEQ |
| `bass:global:drive` | DRIVE (GLOBAL, KNOB A) | valeur 0 a 127 |  |  |
| `bass:global:delay` | DELAY (GLOBAL, KNOB B) | valeur 0 a 127 |  |  |
| `bass:global:dtime` | DLY TIME (GLOBAL, KNOB C) | valeur 0 a 127 | 6 |  |
| `bass:global:dfb` | DLY FB (GLOBAL, KNOB D) | valeur 0 a 127 |  |  |
| `bass:global:volume` | VOLUME (GLOBAL, KNOB E) | valeur 0 a 127 |  |  |
| `bass:global:reverb` | REVERB (GLOBAL, KNOB F) | valeur 0 a 127 |  |  |
| `bass:global:rsize` | REV SIZE (GLOBAL, KNOB G) | valeur 0 a 127 |  |  |
| `bass:global:rtone` | REV TONE (GLOBAL, KNOB H) | valeur 0 a 127 |  |  |
| `bass:page:voice` | PAGE VOICE (AGAIN: NEXT TAB) | appui |  | BSEQ |
| `bass:page:filter` | PAGE FILTER (AGAIN: NEXT TAB) | appui |  | BSEQ |
| `bass:page:env` | PAGE ENV (AGAIN: NEXT TAB) | appui |  | BSEQ |
| `bass:page:fx` | PAGE FX (AGAIN: NEXT TAB) | appui |  | BSEQ |
| `bass:screen:voice` | SCREEN VOICE MAIN | appui |  |  |
| `bass:screen:osc` | SCREEN VOICE OSC | appui |  |  |
| `bass:screen:mix` | SCREEN VOICE MIX | appui |  |  |
| `bass:screen:filter` | SCREEN FILTER MAIN | appui |  |  |
| `bass:screen:contour` | SCREEN FILTER CONTOUR | appui |  |  |
| `bass:screen:env` | SCREEN ENV ENV | appui |  |  |
| `bass:screen:fx` | SCREEN FX FX | appui |  |  |
| `bass:page` | PAGE (VOICE FILTER ENV FX) | valeur 0 a 127 | 4 |  |
| `bass:key:i` | INFOS (THE i OF THE SCREEN) | appui |  |  |
| `bass:key:run` | RUN/STOP | appui |  |  |
| `bass:key:edit` | EDIT | appui |  | BASS, BSEQ |
| `bass:key:open` | OPEN | appui |  |  |
| `bass:key:gen` | GEN | appui |  | BASS, BSEQ |
| `bass:key:mutate` | MUTATE | appui |  | BASS, BSEQ |
| `bass:key:clear` | CLEAR | appui |  | BASS, BSEQ |
| `bass:key:accent` | ACCENT | appui |  | BASS, BSEQ |
| `bass:key:slide` | SLIDE | appui |  | BASS, BSEQ |
| `bass:key:notedn` | NOTE - | appui |  | BASS, BSEQ |
| `bass:key:noteup` | NOTE + | appui |  | BASS, BSEQ |
| `bass:key:octdn` | OCT - | appui |  | BASS, BSEQ |
| `bass:key:octup` | OCT + | appui |  | BASS, BSEQ |
| `bass:key:pvoice` | VOICE | appui |  |  |
| `bass:key:pfilter` | FILTER | appui |  |  |
| `bass:key:penv` | ENV | appui |  |  |
| `bass:key:pfx` | FX | appui |  |  |
| `bass:running` | RUN (ON / OFF) | valeur 0 a 127 | 2 | BASS, MIXER, LIVE, BSEQ |
| `bass:trig:0` | STEP 1 | appui |  | BASS |
| `bass:trig:1` | STEP 2 | appui |  | BASS |
| `bass:trig:2` | STEP 3 | appui |  | BASS |
| `bass:trig:3` | STEP 4 | appui |  | BASS |
| `bass:trig:4` | STEP 5 | appui |  | BASS |
| `bass:trig:5` | STEP 6 | appui |  | BASS |
| `bass:trig:6` | STEP 7 | appui |  | BASS |
| `bass:trig:7` | STEP 8 | appui |  | BASS |
| `bass:trig:8` | STEP 9 | appui |  | BASS |
| `bass:trig:9` | STEP 10 | appui |  | BASS |
| `bass:trig:10` | STEP 11 | appui |  | BASS |
| `bass:trig:11` | STEP 12 | appui |  | BASS |
| `bass:trig:12` | STEP 13 | appui |  | BASS |
| `bass:trig:13` | STEP 14 | appui |  | BASS |
| `bass:trig:14` | STEP 15 | appui |  | BASS |
| `bass:trig:15` | STEP 16 | appui |  | BASS |
| `bass:lock:0` | LOCK 1 | appui |  |  |
| `bass:lock:1` | LOCK 2 | appui |  |  |
| `bass:lock:2` | LOCK 3 | appui |  |  |
| `bass:lock:3` | LOCK 4 | appui |  |  |
| `bass:lock:4` | LOCK 5 | appui |  |  |
| `bass:lock:5` | LOCK 6 | appui |  |  |
| `bass:lock:6` | LOCK 7 | appui |  |  |
| `bass:lock:7` | LOCK 8 | appui |  |  |
| `bass:lock:8` | LOCK 9 | appui |  |  |
| `bass:lock:9` | LOCK 10 | appui |  |  |
| `bass:lock:10` | LOCK 11 | appui |  |  |
| `bass:lock:11` | LOCK 12 | appui |  |  |
| `bass:lock:12` | LOCK 13 | appui |  |  |
| `bass:lock:13` | LOCK 14 | appui |  |  |
| `bass:lock:14` | LOCK 15 | appui |  |  |
| `bass:lock:15` | LOCK 16 | appui |  |  |
| `bass:lock` | LOCK (CHOSEN STEP) | appui |  | BASS, BSEQ |
| `bass:infos` | INFOS (HELP ON HOVER) | appui |  |  |
| `bass:seq:1` | SEQ STEP 1/9 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | BSEQ |
| `bass:seq:2` | SEQ STEP 2/10 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | BSEQ |
| `bass:seq:3` | SEQ STEP 3/11 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | BSEQ |
| `bass:seq:4` | SEQ STEP 4/12 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | BSEQ |
| `bass:seq:5` | SEQ STEP 5/13 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | BSEQ |
| `bass:seq:6` | SEQ STEP 6/14 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | BSEQ |
| `bass:seq:7` | SEQ STEP 7/15 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | BSEQ |
| `bass:seq:8` | SEQ STEP 8/16 (TAP, HOLD + TURN) | maintenu (appui puis relachement) |  | BSEQ |
| `bass:seq:window` | SEQ STEPS 1-8 / 9-16 | appui |  | BSEQ |
| `bass:seq:follow` | SEQ STEP FOLLOW (THE STEPS FOLLOW THE PLAYHEAD) | valeur 0 a 127 | 2 | BSEQ |
| `bass:seq:tie` | TIE (THE CHOSEN STEP) | appui |  | BSEQ |

### MM-DECKS (table, platines, samplers, effets) (scope `dj`, 153 cibles)

| id | Nom | Type | Crans | Dans |
| --- | --- | --- | --- | --- |
| `dj:dj-ch1-gain` | CHANNEL 1 (MM-RYTM) GAIN | valeur 0 a 127 |  |  |
| `dj:dj-ch1-hi` | CHANNEL 1 (MM-RYTM) EQ HI | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch1-mid` | CHANNEL 1 (MM-RYTM) EQ MID | valeur 0 a 127 |  |  |
| `dj:dj-ch1-low` | CHANNEL 1 (MM-RYTM) EQ LOW | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch1-filter` | CHANNEL 1 (MM-RYTM) FILTER | valeur 0 a 127 |  | MIXER, LIVE |
| `dj:dj-ch2-gain` | CHANNEL 2 (MM-BASS) GAIN | valeur 0 a 127 |  |  |
| `dj:dj-ch2-hi` | CHANNEL 2 (MM-BASS) EQ HI | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch2-mid` | CHANNEL 2 (MM-BASS) EQ MID | valeur 0 a 127 |  |  |
| `dj:dj-ch2-low` | CHANNEL 2 (MM-BASS) EQ LOW | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch2-filter` | CHANNEL 2 (MM-BASS) FILTER | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch3-gain` | CHANNEL 3 (MM-ARP) GAIN | valeur 0 a 127 |  |  |
| `dj:dj-ch3-hi` | CHANNEL 3 (MM-ARP) EQ HI | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch3-mid` | CHANNEL 3 (MM-ARP) EQ MID | valeur 0 a 127 |  |  |
| `dj:dj-ch3-low` | CHANNEL 3 (MM-ARP) EQ LOW | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch3-filter` | CHANNEL 3 (MM-ARP) FILTER | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch4-gain` | CHANNEL 4 (DECK A) GAIN | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch4-hi` | CHANNEL 4 (DECK A) EQ HI | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch4-mid` | CHANNEL 4 (DECK A) EQ MID | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch4-low` | CHANNEL 4 (DECK A) EQ LOW | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch4-filter` | CHANNEL 4 (DECK A) FILTER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-ch5-gain` | CHANNEL 5 (DECK B) GAIN | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch5-hi` | CHANNEL 5 (DECK B) EQ HI | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch5-mid` | CHANNEL 5 (DECK B) EQ MID | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch5-low` | CHANNEL 5 (DECK B) EQ LOW | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch5-filter` | CHANNEL 5 (DECK B) FILTER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-overdrive` | EFFECT OVERDRIVE | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-crush` | EFFECT CRUSH | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-chorus` | EFFECT CHORUS | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-flanger` | EFFECT FLANGER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-trans` | EFFECT TRANS | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-delay` | EFFECT DELAY | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-reverb` | EFFECT REVERB | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fxto` | EFFECTS TO: ALL CHANNELS, OR ONE CHANNEL | valeur 0 a 127 | 6 | DECK, MIXER, LIVE |
| `dj:dj-master` | MASTER VOLUME | valeur 0 a 127 |  | DECK |
| `dj:dj-ch1-fader` | CHANNEL 1 (MM-RYTM) FADER | valeur 0 a 127 |  | MIXER, LIVE |
| `dj:dj-ch2-fader` | CHANNEL 2 (MM-BASS) FADER | valeur 0 a 127 |  | MIXER, LIVE |
| `dj:dj-ch3-fader` | CHANNEL 3 (MM-ARP) FADER | valeur 0 a 127 |  | MIXER, LIVE |
| `dj:dj-ch4-fader` | CHANNEL 4 (DECK A) FADER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-ch5-fader` | CHANNEL 5 (DECK B) FADER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-a-pitch` | DECK A PITCH | valeur 0 a 127 |  | DECK |
| `dj:dj-b-pitch` | DECK B PITCH | valeur 0 a 127 |  | DECK |
| `dj:dj-a-smpl-open` | DECK A SAMPLER: SHOW IT ON THE SCREEN, OR THE TRACK | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-smpl-recdeck` | DECK A SAMPLER: SAMPLE THE DECK (ITS LOOP, OR THE LAST BEATS) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-smpl-recmix` | DECK A SAMPLER: SAMPLE THE MIXER OUTPUT (THE LAST BEATS) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-smpl-play` | DECK A SAMPLER: PLAY OR STOP | maintenu (appui puis relachement) |  | DECK, LIVE |
| `dj:dj-a-loop1` | DECK A LOOP 1 BEAT (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-loop2` | DECK A LOOP 2 BEATS (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-loop4` | DECK A LOOP 4 BEATS (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK, MIXER |
| `dj:dj-a-loop8` | DECK A LOOP 8 BEATS (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-bendm` | DECK A BEND SLOWER (HOLD) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-bendp` | DECK A BEND FASTER (HOLD) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-cue` | DECK A CUE (HOLD TO PREVIEW) | maintenu (appui puis relachement) |  | DECK, MIXER, LIVE |
| `dj:dj-a-play` | DECK A PLAY OR PAUSE | maintenu (appui puis relachement) |  | DECK, MIXER, LIVE |
| `dj:dj-a-tempom` | DECK A PITCH DOWN 0.05 BPM (HOLD TO REPEAT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-tempop` | DECK A PITCH UP 0.05 BPM (HOLD TO REPEAT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-sync` | DECK A SYNC: MATCH THE TEMPO YOU HEAR | maintenu (appui puis relachement) |  | DECK, MIXER |
| `dj:dj-b-smpl-open` | DECK B SAMPLER: SHOW IT ON THE SCREEN, OR THE TRACK | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-smpl-recdeck` | DECK B SAMPLER: SAMPLE THE DECK (ITS LOOP, OR THE LAST BEATS) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-smpl-recmix` | DECK B SAMPLER: SAMPLE THE MIXER OUTPUT (THE LAST BEATS) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-smpl-play` | DECK B SAMPLER: PLAY OR STOP | maintenu (appui puis relachement) |  | DECK, LIVE |
| `dj:dj-b-loop1` | DECK B LOOP 1 BEAT (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-loop2` | DECK B LOOP 2 BEATS (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-loop4` | DECK B LOOP 4 BEATS (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK, MIXER |
| `dj:dj-b-loop8` | DECK B LOOP 8 BEATS (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-bendm` | DECK B BEND SLOWER (HOLD) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-bendp` | DECK B BEND FASTER (HOLD) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-cue` | DECK B CUE (HOLD TO PREVIEW) | maintenu (appui puis relachement) |  | DECK, MIXER, LIVE |
| `dj:dj-b-play` | DECK B PLAY OR PAUSE | maintenu (appui puis relachement) |  | DECK, MIXER, LIVE |
| `dj:dj-b-tempom` | DECK B PITCH DOWN 0.05 BPM (HOLD TO REPEAT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-tempop` | DECK B PITCH UP 0.05 BPM (HOLD TO REPEAT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-sync` | DECK B SYNC: MATCH THE TEMPO YOU HEAR | maintenu (appui puis relachement) |  | DECK, MIXER |
| `dj:dj-time1` | EFFECTS TIME 1/4 BEATS | maintenu (appui puis relachement) |  | MIXER, LIVE |
| `dj:dj-time2` | EFFECTS TIME 1/2 BEATS | maintenu (appui puis relachement) |  | MIXER, LIVE |
| `dj:dj-time3` | EFFECTS TIME 3/4 BEATS | maintenu (appui puis relachement) |  | MIXER |
| `dj:dj-time4` | EFFECTS TIME 1 BEAT | maintenu (appui puis relachement) |  | MIXER, LIVE |
| `dj:dj-time5` | EFFECTS TIME 2 BEATS | maintenu (appui puis relachement) |  | MIXER, LIVE |
| `dj:dj-time6` | EFFECTS TIME 4 BEATS | maintenu (appui puis relachement) |  | MIXER |
| `dj:dj-machines` | PLAY OR STOP THE MACHINES TOGETHER (MM-RYTM, MM-BASS, MM-ARP), KEY G | maintenu (appui puis relachement) |  |  |
| `dj:dj-adddeck` | ADD A DECK, WITH ITS CHANNEL ON THE MIXER | maintenu (appui puis relachement) |  | MIXER |
| `dj:smpl:a:knob:start` | SMPL A START | valeur 0 a 127 |  |  |
| `dj:smpl:a:knob:end` | SMPL A END | valeur 0 a 127 |  |  |
| `dj:smpl:a:knob:pitch` | SMPL A PITCH | valeur 0 a 127 | 49 | DECK |
| `dj:smpl:a:knob:level` | SMPL A LEVEL | valeur 0 a 127 |  | DECK |
| `dj:smpl:a:knob:attack` | SMPL A ATTACK | valeur 0 a 127 |  |  |
| `dj:smpl:a:knob:release` | SMPL A RELEASE | valeur 0 a 127 |  |  |
| `dj:smpl:a:knob:filter` | SMPL A FILTER | valeur 0 a 127 |  | DECK |
| `dj:smpl:a:knob:position` | SMPL A POSITION | valeur 0 a 127 |  | DECK |
| `dj:smpl:a:knob:scan` | SMPL A SCAN | valeur 0 a 127 |  |  |
| `dj:smpl:a:knob:size` | SMPL A SIZE | valeur 0 a 127 |  |  |
| `dj:smpl:a:knob:density` | SMPL A DENSITY | valeur 0 a 127 |  |  |
| `dj:smpl:a:knob:spray` | SMPL A SPRAY | valeur 0 a 127 |  |  |
| `dj:smpl:a:mode` | SMPL A MODE | appui |  | DECK |
| `dj:smpl:a:slices` | SMPL A SLICES | appui |  |  |
| `dj:smpl:a:len` | SMPL A LEN | appui |  |  |
| `dj:smpl:a:rev` | SMPL A REV | appui |  |  |
| `dj:smpl:a:loop` | SMPL A LOOP | appui |  |  |
| `dj:smpl:a:random` | SMPL A RANDOM | appui |  |  |
| `dj:smpl:a:clear` | SMPL A CLEAR | appui |  |  |
| `dj:smpl:a:save` | SMPL A SAVE | appui |  |  |
| `dj:smpl:a:stop` | SMPL A STOP | appui |  |  |
| `dj:smpl:a:pad:0` | SMPL A PAD 1 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:1` | SMPL A PAD 2 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:2` | SMPL A PAD 3 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:3` | SMPL A PAD 4 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:4` | SMPL A PAD 5 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:5` | SMPL A PAD 6 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:6` | SMPL A PAD 7 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:7` | SMPL A PAD 8 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:8` | SMPL A PAD 9 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:9` | SMPL A PAD 10 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:10` | SMPL A PAD 11 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:11` | SMPL A PAD 12 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:12` | SMPL A PAD 13 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:13` | SMPL A PAD 14 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:14` | SMPL A PAD 15 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:a:pad:15` | SMPL A PAD 16 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:knob:start` | SMPL B START | valeur 0 a 127 |  |  |
| `dj:smpl:b:knob:end` | SMPL B END | valeur 0 a 127 |  |  |
| `dj:smpl:b:knob:pitch` | SMPL B PITCH | valeur 0 a 127 | 49 | DECK |
| `dj:smpl:b:knob:level` | SMPL B LEVEL | valeur 0 a 127 |  | DECK |
| `dj:smpl:b:knob:attack` | SMPL B ATTACK | valeur 0 a 127 |  |  |
| `dj:smpl:b:knob:release` | SMPL B RELEASE | valeur 0 a 127 |  |  |
| `dj:smpl:b:knob:filter` | SMPL B FILTER | valeur 0 a 127 |  | DECK |
| `dj:smpl:b:knob:position` | SMPL B POSITION | valeur 0 a 127 |  | DECK |
| `dj:smpl:b:knob:scan` | SMPL B SCAN | valeur 0 a 127 |  |  |
| `dj:smpl:b:knob:size` | SMPL B SIZE | valeur 0 a 127 |  |  |
| `dj:smpl:b:knob:density` | SMPL B DENSITY | valeur 0 a 127 |  |  |
| `dj:smpl:b:knob:spray` | SMPL B SPRAY | valeur 0 a 127 |  |  |
| `dj:smpl:b:mode` | SMPL B MODE | appui |  | DECK |
| `dj:smpl:b:slices` | SMPL B SLICES | appui |  |  |
| `dj:smpl:b:len` | SMPL B LEN | appui |  |  |
| `dj:smpl:b:rev` | SMPL B REV | appui |  |  |
| `dj:smpl:b:loop` | SMPL B LOOP | appui |  |  |
| `dj:smpl:b:random` | SMPL B RANDOM | appui |  |  |
| `dj:smpl:b:clear` | SMPL B CLEAR | appui |  |  |
| `dj:smpl:b:save` | SMPL B SAVE | appui |  |  |
| `dj:smpl:b:stop` | SMPL B STOP | appui |  |  |
| `dj:smpl:b:pad:0` | SMPL B PAD 1 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:1` | SMPL B PAD 2 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:2` | SMPL B PAD 3 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:3` | SMPL B PAD 4 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:4` | SMPL B PAD 5 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:5` | SMPL B PAD 6 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:6` | SMPL B PAD 7 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:7` | SMPL B PAD 8 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:8` | SMPL B PAD 9 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:9` | SMPL B PAD 10 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:10` | SMPL B PAD 11 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:11` | SMPL B PAD 12 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:12` | SMPL B PAD 13 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:13` | SMPL B PAD 14 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:14` | SMPL B PAD 15 | maintenu (appui puis relachement) |  |  |
| `dj:smpl:b:pad:15` | SMPL B PAD 16 | maintenu (appui puis relachement) |  |  |

### Partout (navigation) (scope `global`, 8 cibles)

| id | Nom | Type | Crans | Dans |
| --- | --- | --- | --- | --- |
| `nav:all` | MM-STUDIO (ALL THE MACHINES) | appui |  | BASS, MIXER |
| `nav:mm808` | GO TO MM-RYTM | appui |  |  |
| `nav:bass` | GO TO MM-BASS | appui |  |  |
| `nav:voy` | GO TO MM-ARP | appui |  |  |
| `nav:dj` | GO TO MM-DECKS | appui |  |  |
| `nav:prev` | PREVIOUS MACHINE | appui |  | RYTM, ARP, BASS, MIXER, LIVE, RSEQ, BSEQ |
| `nav:next` | NEXT MACHINE | appui |  | RYTM, ARP, BASS, MIXER, LIVE, RSEQ, BSEQ |
| `nav:machines` | PLAY/STOP MACHINES | appui |  | RYTM, ARP, BASS, MIXER, LIVE, RSEQ, BSEQ |

## 5. Faire ton propre fichier

**Voie 1, la plus simple : partir d'un setup fait.** Panneau MIDI > DOWNLOAD THE 8 SETUPS, tu changes les noms et les couleurs dans le JSON (`controlName`, `colorScheme`), tu importes dans ROTO-SETUP. Ne change pas le canal ni le CC : c'est eux que le site reconnait. (Apres l'ajout des samples, retelecharge « MM RYTM (SETUP 11).json » : KICK SOUND a maintenant 9 crans, SNARE SOUND 7.)

**Voie 2, ta propre disposition.** Deux fichiers : celui du Roto (canal, CC, nom, couleur : tu l'ecris comme au chapitre 2) et le fichier d'assignations du site, qui dit quelle cible va avec quel canal et quel CC.

Le fichier d'assignations (panneau MIDI > EXPORT ou IMPORT) :

```json
{
  "v": 1,
  "maps": {
    "voy": {
      "cc:7:14": "voy:knob:cutoff",
      "cc:7:15": "voy:knob:res",
      "cc:15:14": "voy:running"
    },
    "mm808": {
      "cc:7:22": "rytm:enc:swing",
      "cc:15:16": "rytm:random"
    },
    "dj": {
      "cc:8:14": "dj:dj-ch3-fader"
    }
  },
  "devices": []
}
```

- `maps` : une entree par machine (`mm808`, `voy`, `bass`, `dj`, `global`) ; chaque ligne est `"cc:CANAL:CC": "id de la cible"`, le canal de 1 a 16. Aussi `note:CANAL:NOTE` et `pb:CANAL:0`.
- La machine d'une ligne est celle du prefixe de la cible (`rytm:` dans `mm808`, `voy:` dans `voy`, `bass:` dans `bass`, `dj:` dans `dj`, `nav:` dans `global`).
- Une cle vise une seule cible par machine, et une cible n'a qu'une seule cle : ne la mets pas deux fois.
- IMPORT **remplace** toutes les assignations du navigateur : exporte d'abord les tiennes.
- Ce que tu as appris passe avant la carte du Roto : ta disposition l'emporte sur les setups de la carte. Depuis les sequenceurs RSEQ et BSEQ (2026-10-09), la carte prend les seize canaux : sur le Roto, le panneau MIDI liste les assignations qui tombent sur une cle de la carte (REMOVE CONFLICTS WITH THE ROTO MAP) ; un autre appareil (pas « roto ») n'est jamais pris par la carte. Tu peux aussi eteindre la carte (la case « ROTO-CONTROL map » du panneau MIDI).
- Dans le JSON du Roto, reutilise ce que fait la carte : potard a crans quand la cible a des crans (colonne Crans), bouton bascule pour un etat (RUN, mutes, OSC ON), cran au milieu (`hapticIndent1: 64`) pour un potard bipolaire.

**Pour qu'un potard motorise suive le site**, la cle doit etre apprise ou dans la carte ; le retour part sur le meme canal et le meme CC, vers une sortie dont le nom contient « roto ».

Si tu veux, donne-moi ta disposition (page par page, ce que tu veux sur chaque potard et bouton) : je te genere les deux fichiers, prets a importer.

