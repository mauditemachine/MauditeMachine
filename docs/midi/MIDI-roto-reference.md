# MM-STUDIO : le MIDI, tout pour faire ton fichier Roto-Control

Genere le 7 octobre 2026 depuis le code du site (`npm run docs:midi`) : 423 cibles, 6 setups. Les fichiers CSV a cote (`MIDI-roto-setups.csv`, `MIDI-targets.csv`) ouvrent dans Numbers ou Excel.

## 1. Comment c'est fait

**Le principe.** Le site ecoute le MIDI du navigateur (Web MIDI : Chrome, Edge, Opera, Firefox ; pas Safari). Panneau MIDI > CONNECT. Chaque message est reconnu par une cle `type:canal:numero` (`cc:1:14` : CC 14 sur le canal 1 ; `note:10:36` ; `pb:2:0` pour le pitch bend). Une cle vise une **cible** du site (un potard, un bouton) par son id (`voy:knob:cutoff`).

**D'ou vient la cible d'une cle**, dans cet ordre :

1. ce que tu as appris (MIDI LEARN, ou un fichier d'assignations importe) : la machine regardee d'abord, puis les assignations de partout, puis les autres machines ;
2. sinon la **carte du Roto** (les six setups ci-dessous), si elle est allumee (par defaut oui).

**La carte du Roto.**

- Un setup par machine, chacun sur son canal : potards sur le canal N, boutons sur le canal N + 8.
- Le potard ou bouton numero n (0 a 31, quatre pages de huit) envoie le CC **14 + n** (n de 0 a 17), puis **102 + (n - 18)** (n de 18 a 31). Soit : 0:14, 1:15, 2:16, 3:17, 4:18, 5:19, 6:20, 7:21, 8:22, 9:23, 10:24, 11:25, 12:26, 13:27, 14:28, 15:29, 16:30, 17:31, 18:102, 19:103, 20:104, 21:105, 22:106, 23:107, 24:108, 25:109, 26:110, 27:111, 28:112, 29:113, 30:114, 31:115.
- Ces CC n'ont aucun role reserve dans la norme MIDI (ni 0 bank, 1 modulation, 6 et 38 data, 64 pedale, 96 a 101 RPN/NRPN, 120 a 127 messages de canal).
- Ce que dit le fichier JSON, c'est seulement **canal + CC + nom + couleur + type**. La **cible** (ce que ca pilote) est dans le site : il retrouve la cible avec le canal et le CC. Changer l'ordre dans le JSON sans changer le site ne deplace donc rien (voir le chapitre 5).

**Les valeurs.**

- Un potard va de 0 a 127 sur toute sa course. 64 est le neutre exact d'un potard bipolaire (EQ a 0 dB, filtre ouvert, PITCH, TONE, STRETCH, TUNE, GAIN) : le Roto y met un cran.
- Un selecteur a crans du site est un potard a crans du Roto (hapticMode 1, jusqu'a 16 crans, noms courts) : le cran i de n correspond a la valeur i/(n-1). Le choix de son du kit compte les echantillons du site : KICK SOUND a 9 crans (909, 808, MM, puis les 6 samples), SNARE SOUND a 7.
- **SAMPLE** (`rytm:enc:vsound`, a droite de VOLUME) choisit le son de la voix selectionnee : son nombre de crans suit la voix (BD 9, SD 7, les autres 3 ; CY et PC n'ont qu'un son). Il est donc continu sur le Roto : le site prend le cran le plus proche. La colonne Crans du catalogue donne son nombre pour la voix selectionnee a la generation (BD par defaut).
- Une **action** (RANDOM, CLEAR, OPEN, PLAY d'une platine...) part au front montant : un CC qui passe au-dessus de 63, ou une note enfoncee. Une action **maintenue** (CUE, boucles, pads des samplers, bends) dure jusqu'au relachement.
- Un **etat** (RUN, un mute, OSC ON) est une valeur 0 ou 1 : sur le Roto un bouton **bascule** (TOGGLE) dont la LED suit le site. Une note fait basculer un parametre.

**Le retour vers le Roto.** Les potards motorises et les LEDs recoivent la valeur du site (meme canal, meme CC) toutes les 50 ms quand elle change (souris, preset, RANDOM, changement de machine), jamais pendant 300 ms apres un geste sur le potard, et un echo qui revient aussitot est ignore. Seulement vers une sortie dont le nom contient « roto », ou un appareil sur lequel tu as appris. Pas de retour pour les boutons d'action.

**FOLLOW.** Toucher un controle d'un setup montre sa machine : RYTM > MM-RYTM, ARP > MM-ARP, BASS > MM-BASS, DECK et MIXER > MM-DECKS. LIVE ne change pas de machine.

**Retenu** dans le navigateur (`mm.v4.midi.1`) : assignations apprises, appareils, ROTO (la carte), FEEDBACK, FOLLOW.

## 2. Le fichier ROTO-SETUP (JSON)

Format des exports de ROTO-SETUP (version 1), un fichier par setup, a importer (File > Import) sur le setup choisi avec SEL. Le panneau MIDI du site les telecharge tout faits (DOWNLOAD THE SETUPS), et ils sont aussi dans ce dossier : `docs/midi/roto/` (`MM RYTM (SETUP 11).json`...).

```json
{
  "version": 1,
  "type": "MIDI",
  "name": "ARP",
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
| name, index | nom du setup ; index = numero de SETUP moins 1 (SETUP 12 : 11) |
| controlIndex | le controle n, de 0 a 31 (page = n div 8 + 1, position = n mod 8 + 1) |
| controlMode | 0 : CC |
| controlChannel | canal MIDI 1 a 16 (potards N, boutons N + 8) |
| controlParam | le numero de CC (14 + n, puis 102 + n - 18) |
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

## 3. Les six setups, controle par controle

Le setup conseille sur le Roto (SETUP 11 a 16) laisse les premiers a toi. Un potard et un bouton partagent la meme page : ils vont ensemble.

| Setup | Fichier | SETUP | Canal potards | Canal boutons |
| --- | --- | --- | --- | --- |
| RYTM | MM RYTM (SETUP 11).json | 11 | 1 | 9 |
| ARP | MM ARP (SETUP 12).json | 12 | 2 | 10 |
| BASS | MM BASS (SETUP 15).json | 15 | 5 | 13 |
| DECK | MM DECK (SETUP 13).json | 13 | 3 | 11 |
| MIXER | MM MIXER (SETUP 14).json | 14 | 4 | 12 |
| LIVE | MM LIVE (SETUP 16).json | 16 | 6 | 14 |

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
| 5 | 1.6 | 9 | 19 | RYTM + ARP | rouge | nav:machines | PLAY/STOP RYTM + ARP | appui |
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
| 5 | 1.6 | 10 | 19 | RYTM + ARP | rouge | nav:machines | PLAY/STOP RYTM + ARP | appui |
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
| 8 | 2.1 | 5 | 22 | WAVE | or | bass:knob:wave | WAVE | continu |
| 9 | 2.2 | 5 | 23 | GLIDE | or | bass:knob:glide | GLIDE | continu |
| 10 | 2.3 | 5 | 24 | OCTAVE | or | bass:knob:octave | OCTAVE | potard a 4 crans : -2 / -1 / 0 / +1 |
| 11 | 2.4 | 5 | 25 | STYLE | jaune | bass:knob:style | STYLE | potard a 11 crans : ACID / DARK DISCO / INDIE DANCE / MINIMAL / PSY PROG / TECHNO / HOUSE / ELECTRO / EBM / ITALO / SUB |
| 12 | 2.5 | 5 | 26 | DENSITY | jaune | bass:knob:density | DENSITY | continu |
| 13 | 2.6 | 5 | 27 | SLIDES | jaune | bass:knob:slides | SLIDES | continu |
| 14 | 2.7 | 5 | 28 | ACCENTS | jaune | bass:knob:accents | ACCENTS | continu |
| 15 | 2.8 | 5 | 29 | RANGE | jaune | bass:knob:range | RANGE | potard a 3 crans : 1 / 2 / 3 |
| 16 | 3.1 | 5 | 30 | ROOT | cyan | bass:knob:root | ROOT | potard a 13 crans : ARP / F# / G / G# / A / A# / B / C / C# / D / D# / E / F |
| 17 | 3.2 | 5 | 31 | SCALE | cyan | bass:knob:scale | SCALE | potard a 5 crans : MINOR / DORIAN / PHRYGIAN / HARMONIC / PENTA |
| 18 | 3.3 | 5 | 102 | SWING | blanc | rytm:enc:swing | SWING | continu |

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
| 30 | 4.7 | 13 | 114 | RYTM + ARP | rouge | nav:machines | PLAY/STOP RYTM + ARP | appui |
| 31 | 4.8 | 13 | 115 | MM-STUDIO | blanc | nav:all | MM-STUDIO (ALL THE MACHINES) | appui |

### DECK (SETUP 13, potards canal 3, boutons canal 11)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 3 | 14 | PITCH A | cyan | dj:dj-a-pitch | DECK A PITCH | bipolaire, cran au milieu (64) |
| 1 | 1.2 | 3 | 15 | FADER A | blanc | dj:dj-ch3-fader | CHANNEL 3 (DECK A) FADER | continu |
| 2 | 1.3 | 3 | 16 | GAIN A | cyan | dj:dj-ch3-gain | CHANNEL 3 (DECK A) GAIN | bipolaire, cran au milieu (64) |
| 3 | 1.4 | 3 | 17 | HI A | cyan | dj:dj-ch3-hi | CHANNEL 3 (DECK A) EQ HI | bipolaire, cran au milieu (64) |
| 4 | 1.5 | 3 | 18 | MID A | cyan | dj:dj-ch3-mid | CHANNEL 3 (DECK A) EQ MID | bipolaire, cran au milieu (64) |
| 5 | 1.6 | 3 | 19 | LOW A | cyan | dj:dj-ch3-low | CHANNEL 3 (DECK A) EQ LOW | bipolaire, cran au milieu (64) |
| 6 | 1.7 | 3 | 20 | FILTER A | orange | dj:dj-ch3-filter | CHANNEL 3 (DECK A) FILTER | bipolaire, cran au milieu (64) |
| 7 | 1.8 | 3 | 21 | MASTER | blanc | dj:dj-master | MASTER VOLUME | continu |
| 8 | 2.1 | 3 | 22 | PITCH B | rose | dj:dj-b-pitch | DECK B PITCH | bipolaire, cran au milieu (64) |
| 9 | 2.2 | 3 | 23 | FADER B | blanc | dj:dj-ch4-fader | CHANNEL 4 (DECK B) FADER | continu |
| 10 | 2.3 | 3 | 24 | GAIN B | rose | dj:dj-ch4-gain | CHANNEL 4 (DECK B) GAIN | bipolaire, cran au milieu (64) |
| 11 | 2.4 | 3 | 25 | HI B | rose | dj:dj-ch4-hi | CHANNEL 4 (DECK B) EQ HI | bipolaire, cran au milieu (64) |
| 12 | 2.5 | 3 | 26 | MID B | rose | dj:dj-ch4-mid | CHANNEL 4 (DECK B) EQ MID | bipolaire, cran au milieu (64) |
| 13 | 2.6 | 3 | 27 | LOW B | rose | dj:dj-ch4-low | CHANNEL 4 (DECK B) EQ LOW | bipolaire, cran au milieu (64) |
| 14 | 2.7 | 3 | 28 | FILTER B | orange | dj:dj-ch4-filter | CHANNEL 4 (DECK B) FILTER | bipolaire, cran au milieu (64) |
| 15 | 2.8 | 3 | 29 | MASTER | blanc | dj:dj-master | MASTER VOLUME | continu |
| 16 | 3.1 | 3 | 30 | OVERDRIVE | violet | dj:dj-fx-overdrive | EFFECT OVERDRIVE | continu |
| 17 | 3.2 | 3 | 31 | CRUSH | violet | dj:dj-fx-crush | EFFECT CRUSH | continu |
| 18 | 3.3 | 3 | 102 | CHORUS | violet | dj:dj-fx-chorus | EFFECT CHORUS | continu |
| 19 | 3.4 | 3 | 103 | FLANGER | violet | dj:dj-fx-flanger | EFFECT FLANGER | continu |
| 20 | 3.5 | 3 | 104 | TRANS | violet | dj:dj-fx-trans | EFFECT TRANS | continu |
| 21 | 3.6 | 3 | 105 | DELAY | violet | dj:dj-fx-delay | EFFECT DELAY | continu |
| 22 | 3.7 | 3 | 106 | REVERB | violet | dj:dj-fx-reverb | EFFECT REVERB | continu |
| 23 | 3.8 | 3 | 107 | FX TO | blanc | dj:dj-fxto | EFFECTS TO: ALL CHANNELS, OR ONE CHANNEL | potard a 5 crans : ALL / RYTM / ARP / A / B |
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
| 21 | 3.6 | 11 | 105 | PITCH - A | cyan | dj:dj-a-tempom | DECK A PITCH DOWN 0.1 BPM (HOLD TO REPEAT) | maintenu |
| 22 | 3.7 | 11 | 106 | PITCH + A | cyan | dj:dj-a-tempop | DECK A PITCH UP 0.1 BPM (HOLD TO REPEAT) | maintenu |
| 23 | 3.8 | 11 | 107 | SMPL MODE A | orange | dj:smpl:a:mode | SMPL A MODE | appui |
| 24 | 4.1 | 11 | 108 | LOOP 1 B | vert | dj:dj-b-loop1 | DECK B LOOP 1 BEAT (PRESS AGAIN TO EXIT) | maintenu |
| 25 | 4.2 | 11 | 109 | LOOP 2 B | vert | dj:dj-b-loop2 | DECK B LOOP 2 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 26 | 4.3 | 11 | 110 | LOOP 8 B | vert | dj:dj-b-loop8 | DECK B LOOP 8 BEATS (PRESS AGAIN TO EXIT) | maintenu |
| 27 | 4.4 | 11 | 111 | BEND - B | rose | dj:dj-b-bendm | DECK B BEND SLOWER (HOLD) | maintenu |
| 28 | 4.5 | 11 | 112 | BEND + B | rose | dj:dj-b-bendp | DECK B BEND FASTER (HOLD) | maintenu |
| 29 | 4.6 | 11 | 113 | PITCH - B | rose | dj:dj-b-tempom | DECK B PITCH DOWN 0.1 BPM (HOLD TO REPEAT) | maintenu |
| 30 | 4.7 | 11 | 114 | PITCH + B | rose | dj:dj-b-tempop | DECK B PITCH UP 0.1 BPM (HOLD TO REPEAT) | maintenu |
| 31 | 4.8 | 11 | 115 | SMPL MODE B | orange | dj:smpl:b:mode | SMPL B MODE | appui |

### MIXER (SETUP 14, potards canal 4, boutons canal 12)

**Potards**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 4 | 14 | FADER RYTM | blanc | dj:dj-ch1-fader | CHANNEL 1 (MM-RYTM) FADER | continu |
| 1 | 1.2 | 4 | 15 | FADER ARP | blanc | dj:dj-ch2-fader | CHANNEL 2 (MM-ARP) FADER | continu |
| 2 | 1.3 | 4 | 16 | FADER A | blanc | dj:dj-ch3-fader | CHANNEL 3 (DECK A) FADER | continu |
| 3 | 1.4 | 4 | 17 | FADER B | blanc | dj:dj-ch4-fader | CHANNEL 4 (DECK B) FADER | continu |
| 4 | 1.5 | 4 | 18 | FILTER RYTM | orange | dj:dj-ch1-filter | CHANNEL 1 (MM-RYTM) FILTER | bipolaire, cran au milieu (64) |
| 5 | 1.6 | 4 | 19 | FILTER ARP | orange | dj:dj-ch2-filter | CHANNEL 2 (MM-ARP) FILTER | bipolaire, cran au milieu (64) |
| 6 | 1.7 | 4 | 20 | FILTER A | orange | dj:dj-ch3-filter | CHANNEL 3 (DECK A) FILTER | bipolaire, cran au milieu (64) |
| 7 | 1.8 | 4 | 21 | FILTER B | orange | dj:dj-ch4-filter | CHANNEL 4 (DECK B) FILTER | bipolaire, cran au milieu (64) |
| 8 | 2.1 | 4 | 22 | HI RYTM | jaune | dj:dj-ch1-hi | CHANNEL 1 (MM-RYTM) EQ HI | bipolaire, cran au milieu (64) |
| 9 | 2.2 | 4 | 23 | MID RYTM | jaune | dj:dj-ch1-mid | CHANNEL 1 (MM-RYTM) EQ MID | bipolaire, cran au milieu (64) |
| 10 | 2.3 | 4 | 24 | LOW RYTM | jaune | dj:dj-ch1-low | CHANNEL 1 (MM-RYTM) EQ LOW | bipolaire, cran au milieu (64) |
| 11 | 2.4 | 4 | 25 | HI ARP | or | dj:dj-ch2-hi | CHANNEL 2 (MM-ARP) EQ HI | bipolaire, cran au milieu (64) |
| 12 | 2.5 | 4 | 26 | MID ARP | or | dj:dj-ch2-mid | CHANNEL 2 (MM-ARP) EQ MID | bipolaire, cran au milieu (64) |
| 13 | 2.6 | 4 | 27 | LOW ARP | or | dj:dj-ch2-low | CHANNEL 2 (MM-ARP) EQ LOW | bipolaire, cran au milieu (64) |
| 14 | 2.7 | 4 | 28 | GAIN RYTM | jaune | dj:dj-ch1-gain | CHANNEL 1 (MM-RYTM) GAIN | bipolaire, cran au milieu (64) |
| 15 | 2.8 | 4 | 29 | GAIN ARP | or | dj:dj-ch2-gain | CHANNEL 2 (MM-ARP) GAIN | bipolaire, cran au milieu (64) |
| 16 | 3.1 | 4 | 30 | HI A | cyan | dj:dj-ch3-hi | CHANNEL 3 (DECK A) EQ HI | bipolaire, cran au milieu (64) |
| 17 | 3.2 | 4 | 31 | MID A | cyan | dj:dj-ch3-mid | CHANNEL 3 (DECK A) EQ MID | bipolaire, cran au milieu (64) |
| 18 | 3.3 | 4 | 102 | LOW A | cyan | dj:dj-ch3-low | CHANNEL 3 (DECK A) EQ LOW | bipolaire, cran au milieu (64) |
| 19 | 3.4 | 4 | 103 | HI B | rose | dj:dj-ch4-hi | CHANNEL 4 (DECK B) EQ HI | bipolaire, cran au milieu (64) |
| 20 | 3.5 | 4 | 104 | MID B | rose | dj:dj-ch4-mid | CHANNEL 4 (DECK B) EQ MID | bipolaire, cran au milieu (64) |
| 21 | 3.6 | 4 | 105 | LOW B | rose | dj:dj-ch4-low | CHANNEL 4 (DECK B) EQ LOW | bipolaire, cran au milieu (64) |
| 22 | 3.7 | 4 | 106 | GAIN A | cyan | dj:dj-ch3-gain | CHANNEL 3 (DECK A) GAIN | bipolaire, cran au milieu (64) |
| 23 | 3.8 | 4 | 107 | GAIN B | rose | dj:dj-ch4-gain | CHANNEL 4 (DECK B) GAIN | bipolaire, cran au milieu (64) |
| 24 | 4.1 | 4 | 108 | OVERDRIVE | violet | dj:dj-fx-overdrive | EFFECT OVERDRIVE | continu |
| 25 | 4.2 | 4 | 109 | CRUSH | violet | dj:dj-fx-crush | EFFECT CRUSH | continu |
| 26 | 4.3 | 4 | 110 | CHORUS | violet | dj:dj-fx-chorus | EFFECT CHORUS | continu |
| 27 | 4.4 | 4 | 111 | FLANGER | violet | dj:dj-fx-flanger | EFFECT FLANGER | continu |
| 28 | 4.5 | 4 | 112 | TRANS | violet | dj:dj-fx-trans | EFFECT TRANS | continu |
| 29 | 4.6 | 4 | 113 | DELAY | violet | dj:dj-fx-delay | EFFECT DELAY | continu |
| 30 | 4.7 | 4 | 114 | REVERB | violet | dj:dj-fx-reverb | EFFECT REVERB | continu |
| 31 | 4.8 | 4 | 115 | FX TO | blanc | dj:dj-fxto | EFFECTS TO: ALL CHANNELS, OR ONE CHANNEL | potard a 5 crans : ALL / RYTM / ARP / A / B |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 12 | 14 | RUN RYTM | rouge | rytm:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 1 | 1.2 | 12 | 15 | RUN ARP | rouge | voy:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 2 | 1.3 | 12 | 16 | PLAY A | jaune | dj:dj-a-play | DECK A PLAY OR PAUSE | maintenu |
| 3 | 1.4 | 12 | 17 | PLAY B | jaune | dj:dj-b-play | DECK B PLAY OR PAUSE | maintenu |
| 4 | 1.5 | 12 | 18 | CUE A | orange | dj:dj-a-cue | DECK A CUE (HOLD TO PREVIEW) | maintenu |
| 5 | 1.6 | 12 | 19 | CUE B | orange | dj:dj-b-cue | DECK B CUE (HOLD TO PREVIEW) | maintenu |
| 6 | 1.7 | 12 | 20 | RYTM + ARP | rouge | nav:machines | PLAY/STOP RYTM + ARP | appui |
| 7 | 1.8 | 12 | 21 | REC MIX A | rouge | dj:dj-a-smpl-recmix | DECK A SAMPLER: SAMPLE THE MIXER OUTPUT (THE LAST BEATS) | maintenu |
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
| 1 | 1.2 | 6 | 15 | FADER ARP | blanc | dj:dj-ch2-fader | CHANNEL 2 (MM-ARP) FADER | continu |
| 2 | 1.3 | 6 | 16 | FADER A | blanc | dj:dj-ch3-fader | CHANNEL 3 (DECK A) FADER | continu |
| 3 | 1.4 | 6 | 17 | FADER B | blanc | dj:dj-ch4-fader | CHANNEL 4 (DECK B) FADER | continu |
| 4 | 1.5 | 6 | 18 | FILTER RYTM | orange | dj:dj-ch1-filter | CHANNEL 1 (MM-RYTM) FILTER | bipolaire, cran au milieu (64) |
| 5 | 1.6 | 6 | 19 | FILTER ARP | orange | dj:dj-ch2-filter | CHANNEL 2 (MM-ARP) FILTER | bipolaire, cran au milieu (64) |
| 6 | 1.7 | 6 | 20 | FILTER A | orange | dj:dj-ch3-filter | CHANNEL 3 (DECK A) FILTER | bipolaire, cran au milieu (64) |
| 7 | 1.8 | 6 | 21 | FILTER B | orange | dj:dj-ch4-filter | CHANNEL 4 (DECK B) FILTER | bipolaire, cran au milieu (64) |
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
| 31 | 4.8 | 6 | 115 | FX TO | blanc | dj:dj-fxto | EFFECTS TO: ALL CHANNELS, OR ONE CHANNEL | potard a 5 crans : ALL / RYTM / ARP / A / B |

**Boutons**

| n | Page.pos | Canal | CC | Nom Roto | Couleur | Cible (id) | Ce que ca fait | Type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 1.1 | 14 | 14 | RUN RYTM | rouge | rytm:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 1 | 1.2 | 14 | 15 | RUN ARP | rouge | voy:running | RUN (ON / OFF) | bascule (la LED suit le site) |
| 2 | 1.3 | 14 | 16 | PLAY A | jaune | dj:dj-a-play | DECK A PLAY OR PAUSE | maintenu |
| 3 | 1.4 | 14 | 17 | PLAY B | jaune | dj:dj-b-play | DECK B PLAY OR PAUSE | maintenu |
| 4 | 1.5 | 14 | 18 | CUE A | orange | dj:dj-a-cue | DECK A CUE (HOLD TO PREVIEW) | maintenu |
| 5 | 1.6 | 14 | 19 | CUE B | orange | dj:dj-b-cue | DECK B CUE (HOLD TO PREVIEW) | maintenu |
| 6 | 1.7 | 14 | 20 | RYTM + ARP | rouge | nav:machines | PLAY/STOP RYTM + ARP | appui |
| 7 | 1.8 | 14 | 21 | REC MIX A | rouge | dj:dj-a-smpl-recmix | DECK A SAMPLER: SAMPLE THE MIXER OUTPUT (THE LAST BEATS) | maintenu |
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

## 4. Le catalogue complet des cibles

Tout ce que le site sait piloter : chaque ligne est une cible assignable (MIDI LEARN, ou le fichier d'assignations du chapitre 5). La colonne « Dans » dit dans quels setups du Roto elle est deja placee. La cible d'un id est dans la machine de son prefixe : `rytm:` MM-RYTM (scope `mm808`), `voy:` MM-ARP (`voy`), `bass:` MM-BASS (`bass`), `dj:` MM-DECKS (`dj`, `dj:smpl:<platine>:` pour le sampler de chaque platine), `nav:` navigation (`global`).

### MM-RYTM (scope `mm808`, 139 cibles)

| id | Nom | Type | Crans | Dans |
| --- | --- | --- | --- | --- |
| `rytm:enc:level` | MASTER | valeur 0 a 127 |  | RYTM |
| `rytm:enc:tempo` | TEMPO | valeur 0 a 127 |  | RYTM |
| `rytm:enc:swing` | SWING | valeur 0 a 127 |  | RYTM, BASS, LIVE |
| `rytm:enc:stretch` | STRETCH | valeur 0 a 127 |  | RYTM, LIVE |
| `rytm:enc:dist` | DIST | valeur 0 a 127 |  | RYTM, LIVE |
| `rytm:enc:chorus` | CHORUS | valeur 0 a 127 |  | RYTM |
| `rytm:enc:delay` | DELAY | valeur 0 a 127 |  | RYTM, LIVE |
| `rytm:enc:reverb` | REVERB | valeur 0 a 127 |  | RYTM, LIVE |
| `rytm:enc:vol` | VOLUME (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vsound` | SAMPLE (SELECTED VOICE) | valeur 0 a 127 | 9 | RYTM |
| `rytm:enc:tone` | TONE (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vdecay` | DECAY (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vdist` | DIST (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vchorus` | CHORUS (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vdelay` | DELAY (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:enc:vreverb` | REVERB (SELECTED VOICE) | valeur 0 a 127 |  | RYTM |
| `rytm:voice:BD:tone` | BD TONE | valeur 0 a 127 |  |  |
| `rytm:voice:BD:decay` | BD DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:BD:level` | BD VOLUME | valeur 0 a 127 |  | RYTM |
| `rytm:voice:BD:dist` | BD DIST | valeur 0 a 127 |  |  |
| `rytm:voice:BD:reverb` | BD REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:BD:delay` | BD DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:BD:chorus` | BD CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:SD:tone` | SD TONE | valeur 0 a 127 |  |  |
| `rytm:voice:SD:decay` | SD DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:SD:level` | SD VOLUME | valeur 0 a 127 |  | RYTM |
| `rytm:voice:SD:dist` | SD DIST | valeur 0 a 127 |  |  |
| `rytm:voice:SD:reverb` | SD REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:SD:delay` | SD DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:SD:chorus` | SD CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:CH:tone` | CH TONE | valeur 0 a 127 |  |  |
| `rytm:voice:CH:decay` | CH DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:CH:level` | CH VOLUME | valeur 0 a 127 |  | RYTM |
| `rytm:voice:CH:dist` | CH DIST | valeur 0 a 127 |  |  |
| `rytm:voice:CH:reverb` | CH REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:CH:delay` | CH DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:CH:chorus` | CH CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:OH:tone` | OH TONE | valeur 0 a 127 |  |  |
| `rytm:voice:OH:decay` | OH DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:OH:level` | OH VOLUME | valeur 0 a 127 |  | RYTM |
| `rytm:voice:OH:dist` | OH DIST | valeur 0 a 127 |  |  |
| `rytm:voice:OH:reverb` | OH REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:OH:delay` | OH DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:OH:chorus` | OH CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:CP:tone` | CP TONE | valeur 0 a 127 |  |  |
| `rytm:voice:CP:decay` | CP DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:CP:level` | CP VOLUME | valeur 0 a 127 |  | RYTM |
| `rytm:voice:CP:dist` | CP DIST | valeur 0 a 127 |  |  |
| `rytm:voice:CP:reverb` | CP REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:CP:delay` | CP DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:CP:chorus` | CP CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:tone` | TOM TONE | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:decay` | TOM DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:level` | TOM VOLUME | valeur 0 a 127 |  | RYTM |
| `rytm:voice:TOM:dist` | TOM DIST | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:reverb` | TOM REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:delay` | TOM DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:TOM:chorus` | TOM CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:HT:tone` | HT TONE | valeur 0 a 127 |  |  |
| `rytm:voice:HT:decay` | HT DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:HT:level` | HT VOLUME | valeur 0 a 127 |  | RYTM |
| `rytm:voice:HT:dist` | HT DIST | valeur 0 a 127 |  |  |
| `rytm:voice:HT:reverb` | HT REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:HT:delay` | HT DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:HT:chorus` | HT CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:CY:tone` | CY TONE | valeur 0 a 127 |  |  |
| `rytm:voice:CY:decay` | CY DECAY | valeur 0 a 127 |  |  |
| `rytm:voice:CY:level` | CY VOLUME | valeur 0 a 127 |  | RYTM |
| `rytm:voice:CY:dist` | CY DIST | valeur 0 a 127 |  |  |
| `rytm:voice:CY:reverb` | CY REVERB | valeur 0 a 127 |  |  |
| `rytm:voice:CY:delay` | CY DELAY | valeur 0 a 127 |  |  |
| `rytm:voice:CY:chorus` | CY CHORUS | valeur 0 a 127 |  |  |
| `rytm:voice:BD:mute` | MUTE BD | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:SD:mute` | MUTE SD | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:CH:mute` | MUTE CH | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:OH:mute` | MUTE OH | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:CP:mute` | MUTE CP | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:TOM:mute` | MUTE TOM | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:HT:mute` | MUTE HT | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:voice:CY:mute` | MUTE CY | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
| `rytm:running` | RUN (ON / OFF) | valeur 0 a 127 | 2 | RYTM, MIXER, LIVE |
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
| `rytm:run` | RUN/STOP | appui |  |  |
| `rytm:clear` | CLEAR | appui |  | RYTM |
| `rytm:random` | RANDOM | appui |  | RYTM |
| `rytm:mute` | MUTE | appui |  |  |
| `rytm:solo` | SOLO | appui |  |  |
| `rytm:edit` | EDIT | appui |  | RYTM |
| `rytm:open` | OPEN | appui |  | RYTM |
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

### MM-ARP (scope `voy`, 66 cibles)

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

### MM-BASS (scope `bass`, 63 cibles)

| id | Nom | Type | Crans | Dans |
| --- | --- | --- | --- | --- |
| `bass:knob:cutoff` | CUTOFF | valeur 0 a 127 |  | BASS |
| `bass:knob:reso` | RESO | valeur 0 a 127 |  | BASS |
| `bass:knob:envmod` | ENV MOD | valeur 0 a 127 |  | BASS |
| `bass:knob:decay` | DECAY | valeur 0 a 127 |  | BASS |
| `bass:knob:accent` | ACCENT | valeur 0 a 127 |  | BASS |
| `bass:knob:wave` | WAVE | valeur 0 a 127 |  | BASS |
| `bass:knob:sub` | SUB | valeur 0 a 127 |  | BASS |
| `bass:knob:drive` | DRIVE | valeur 0 a 127 |  | BASS |
| `bass:knob:glide` | GLIDE | valeur 0 a 127 |  | BASS |
| `bass:knob:volume` | VOLUME | valeur 0 a 127 |  | BASS |
| `bass:knob:octave` | OCTAVE | valeur 0 a 127 | 4 | BASS |
| `bass:knob:style` | STYLE | valeur 0 a 127 | 11 | BASS |
| `bass:knob:density` | DENSITY | valeur 0 a 127 |  | BASS |
| `bass:knob:slides` | SLIDES | valeur 0 a 127 |  | BASS |
| `bass:knob:accents` | ACCENTS | valeur 0 a 127 |  | BASS |
| `bass:knob:range` | RANGE | valeur 0 a 127 | 3 | BASS |
| `bass:knob:root` | ROOT | valeur 0 a 127 | 13 | BASS |
| `bass:knob:scale` | SCALE | valeur 0 a 127 | 5 | BASS |
| `bass:key:run` | RUN/STOP | appui |  |  |
| `bass:key:edit` | EDIT | appui |  | BASS |
| `bass:key:gen` | GEN | appui |  | BASS |
| `bass:key:mutate` | MUTATE | appui |  | BASS |
| `bass:key:clear` | CLEAR | appui |  | BASS |
| `bass:key:accent` | ACCENT | appui |  | BASS |
| `bass:key:slide` | SLIDE | appui |  | BASS |
| `bass:key:notedn` | NOTE - | appui |  | BASS |
| `bass:key:noteup` | NOTE + | appui |  | BASS |
| `bass:key:octdn` | OCT - | appui |  | BASS |
| `bass:key:octup` | OCT + | appui |  | BASS |
| `bass:running` | RUN (ON / OFF) | valeur 0 a 127 | 2 | BASS |
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
| `bass:lock` | LOCK (CHOSEN STEP) | appui |  | BASS |

### MM-DECKS (table, platines, samplers, effets) (scope `dj`, 147 cibles)

| id | Nom | Type | Crans | Dans |
| --- | --- | --- | --- | --- |
| `dj:dj-ch1-gain` | CHANNEL 1 (MM-RYTM) GAIN | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch1-hi` | CHANNEL 1 (MM-RYTM) EQ HI | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch1-mid` | CHANNEL 1 (MM-RYTM) EQ MID | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch1-low` | CHANNEL 1 (MM-RYTM) EQ LOW | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch1-filter` | CHANNEL 1 (MM-RYTM) FILTER | valeur 0 a 127 |  | MIXER, LIVE |
| `dj:dj-ch2-gain` | CHANNEL 2 (MM-ARP) GAIN | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch2-hi` | CHANNEL 2 (MM-ARP) EQ HI | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch2-mid` | CHANNEL 2 (MM-ARP) EQ MID | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch2-low` | CHANNEL 2 (MM-ARP) EQ LOW | valeur 0 a 127 |  | MIXER |
| `dj:dj-ch2-filter` | CHANNEL 2 (MM-ARP) FILTER | valeur 0 a 127 |  | MIXER, LIVE |
| `dj:dj-ch3-gain` | CHANNEL 3 (DECK A) GAIN | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch3-hi` | CHANNEL 3 (DECK A) EQ HI | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch3-mid` | CHANNEL 3 (DECK A) EQ MID | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch3-low` | CHANNEL 3 (DECK A) EQ LOW | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch3-filter` | CHANNEL 3 (DECK A) FILTER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-ch4-gain` | CHANNEL 4 (DECK B) GAIN | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch4-hi` | CHANNEL 4 (DECK B) EQ HI | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch4-mid` | CHANNEL 4 (DECK B) EQ MID | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch4-low` | CHANNEL 4 (DECK B) EQ LOW | valeur 0 a 127 |  | DECK, MIXER |
| `dj:dj-ch4-filter` | CHANNEL 4 (DECK B) FILTER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-overdrive` | EFFECT OVERDRIVE | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-crush` | EFFECT CRUSH | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-chorus` | EFFECT CHORUS | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-flanger` | EFFECT FLANGER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-trans` | EFFECT TRANS | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-delay` | EFFECT DELAY | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fx-reverb` | EFFECT REVERB | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-fxto` | EFFECTS TO: ALL CHANNELS, OR ONE CHANNEL | valeur 0 a 127 | 5 | DECK, MIXER, LIVE |
| `dj:dj-master` | MASTER VOLUME | valeur 0 a 127 |  | DECK |
| `dj:dj-ch1-fader` | CHANNEL 1 (MM-RYTM) FADER | valeur 0 a 127 |  | MIXER, LIVE |
| `dj:dj-ch2-fader` | CHANNEL 2 (MM-ARP) FADER | valeur 0 a 127 |  | MIXER, LIVE |
| `dj:dj-ch3-fader` | CHANNEL 3 (DECK A) FADER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-ch4-fader` | CHANNEL 4 (DECK B) FADER | valeur 0 a 127 |  | DECK, MIXER, LIVE |
| `dj:dj-a-pitch` | DECK A PITCH | valeur 0 a 127 |  | DECK |
| `dj:dj-b-pitch` | DECK B PITCH | valeur 0 a 127 |  | DECK |
| `dj:dj-a-smpl-open` | DECK A SAMPLER: SHOW IT ON THE SCREEN, OR THE TRACK | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-smpl-recdeck` | DECK A SAMPLER: SAMPLE THE DECK (ITS LOOP, OR THE LAST BEATS) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-smpl-recmix` | DECK A SAMPLER: SAMPLE THE MIXER OUTPUT (THE LAST BEATS) | maintenu (appui puis relachement) |  | DECK, MIXER, LIVE |
| `dj:dj-a-smpl-play` | DECK A SAMPLER: PLAY OR STOP | maintenu (appui puis relachement) |  | DECK, LIVE |
| `dj:dj-a-loop1` | DECK A LOOP 1 BEAT (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-loop2` | DECK A LOOP 2 BEATS (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-loop4` | DECK A LOOP 4 BEATS (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK, MIXER |
| `dj:dj-a-loop8` | DECK A LOOP 8 BEATS (PRESS AGAIN TO EXIT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-bendm` | DECK A BEND SLOWER (HOLD) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-bendp` | DECK A BEND FASTER (HOLD) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-cue` | DECK A CUE (HOLD TO PREVIEW) | maintenu (appui puis relachement) |  | DECK, MIXER, LIVE |
| `dj:dj-a-play` | DECK A PLAY OR PAUSE | maintenu (appui puis relachement) |  | DECK, MIXER, LIVE |
| `dj:dj-a-tempom` | DECK A PITCH DOWN 0.1 BPM (HOLD TO REPEAT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-a-tempop` | DECK A PITCH UP 0.1 BPM (HOLD TO REPEAT) | maintenu (appui puis relachement) |  | DECK |
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
| `dj:dj-b-tempom` | DECK B PITCH DOWN 0.1 BPM (HOLD TO REPEAT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-tempop` | DECK B PITCH UP 0.1 BPM (HOLD TO REPEAT) | maintenu (appui puis relachement) |  | DECK |
| `dj:dj-b-sync` | DECK B SYNC: MATCH THE TEMPO YOU HEAR | maintenu (appui puis relachement) |  | DECK, MIXER |
| `dj:dj-time1` | EFFECTS TIME 1/4 BEATS | maintenu (appui puis relachement) |  | MIXER, LIVE |
| `dj:dj-time2` | EFFECTS TIME 1/2 BEATS | maintenu (appui puis relachement) |  | MIXER, LIVE |
| `dj:dj-time3` | EFFECTS TIME 3/4 BEATS | maintenu (appui puis relachement) |  | MIXER |
| `dj:dj-time4` | EFFECTS TIME 1 BEAT | maintenu (appui puis relachement) |  | MIXER, LIVE |
| `dj:dj-time5` | EFFECTS TIME 2 BEATS | maintenu (appui puis relachement) |  | MIXER, LIVE |
| `dj:dj-time6` | EFFECTS TIME 4 BEATS | maintenu (appui puis relachement) |  | MIXER |
| `dj:dj-machines` | PLAY OR STOP THE MM-RYTM AND THE MM-ARP TOGETHER, KEY G | maintenu (appui puis relachement) |  |  |
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
| `nav:voy` | GO TO MM-ARP | appui |  |  |
| `nav:bass` | GO TO MM-BASS | appui |  |  |
| `nav:dj` | GO TO MM-DECKS | appui |  |  |
| `nav:prev` | PREVIOUS MACHINE | appui |  | RYTM, ARP, BASS, MIXER, LIVE |
| `nav:next` | NEXT MACHINE | appui |  | RYTM, ARP, BASS, MIXER, LIVE |
| `nav:machines` | PLAY/STOP RYTM + ARP | appui |  | RYTM, ARP, BASS, MIXER, LIVE |

## 5. Faire ton propre fichier

**Voie 1, la plus simple : partir d'un setup fait.** Panneau MIDI > DOWNLOAD THE 6 SETUPS, tu changes les noms et les couleurs dans le JSON (`controlName`, `colorScheme`), tu importes dans ROTO-SETUP. Ne change pas le canal ni le CC : c'est eux que le site reconnait. (Apres l'ajout des samples, retelecharge « MM RYTM (SETUP 11).json » : KICK SOUND a maintenant 9 crans, SNARE SOUND 7.)

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
- Ce que tu as appris passe avant la carte du Roto : ta disposition l'emporte sur les six setups, mais des canaux libres (7, 8, 15, 16) evitent tout melange. Tu peux aussi eteindre la carte (la case « ROTO-CONTROL map » du panneau MIDI).
- Dans le JSON du Roto, reutilise ce que fait la carte : potard a crans quand la cible a des crans (colonne Crans), bouton bascule pour un etat (RUN, mutes, OSC ON), cran au milieu (`hapticIndent1: 64`) pour un potard bipolaire.

**Pour qu'un potard motorise suive le site**, la cle doit etre apprise ou dans la carte ; le retour part sur le meme canal et le meme CC, vers une sortie dont le nom contient « roto ».

Si tu veux, donne-moi ta disposition (page par page, ce que tu veux sur chaque potard et bouton) : je te genere les deux fichiers, prets a importer.

