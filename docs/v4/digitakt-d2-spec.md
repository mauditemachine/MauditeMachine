# MM-RYTM façon Digitakt, étape D2 : le séquenceur (FIRMWARE V.5.1)

2026-10-29. Mika : « ok fonce sur l'étape 2 ».
- Proposition validée : https://claude.ai/artifact/5cR8BzWxCuUX8i8dgE6ep3
- Référence : `docs/v4/digitakt-reference.md` (section 3, la page TRIG ; section 4, MOD)
- Étape précédente : `docs/v4/digitakt-d1-spec.md` et `docs/reports/2026-10-29-rytm-v50-digitakt-d1.md` (V.5.0, en ligne au commit fd92700)

**Portée.** La face du desktop. Le téléphone ne gagne aucune touche ni aucune page ; il **joue** ce que le pattern contient (une condition, un retrig, un LFO s'entendent aussi au téléphone), comme une scène sans crossfader.

## 0. Règles qui ne se discutent pas

- Tout ce que dit la section 0 de `digitakt-d1-spec.md` vaut ici : ids MIDI, sauvegardes, aucun son pendant les tests, aucun tiret cadratin, téléphone figé.
- **Identité audio.** Avec tous les nouveaux réglages à leur valeur de départ, le rendu hors ligne doit être identique à la V.5.0, au bruit de calcul près (écart maximal autour de 1e-6). Les valeurs de départ :

  | Réglage | Départ |
  |---|---|
  | LEN | INF |
  | PROB | 100 % |
  | COND | aucune |
  | μTIME | 0 |
  | RTRG | OFF |
  | DEP des LFO | 0 |

  Il faut comparer `window.__v4.audio.renderOffline` de la V.5.0 et de la D2 sur le pattern d'arrivée, un pattern verrouillé et les presets d'usine. Une sonde existe : `ident.cjs` et `cmp.cjs` dans le dossier de travail de la session (`scenes-review/fix/t/`). Recopie-la, ou refais-la.
- Les patterns, presets, UNDO et le lien SHARE d'avant se relisent. Les nouveaux champs sont facultatifs et absents quand ils sont à leur valeur de départ.
- Pour finir : `node scripts/firmware.mjs bump mm808 minor "..."` (V.5.1) et le rapport `docs/reports/2026-10-29-rytm-v51-digitakt-d2.md`.

## 1. Le modèle

**Les réglages de trig.**
- Chaque voix a des réglages de trig par défaut, rangés **avec le pattern** comme les pas, les verrous et les scènes : un pattern A01 a les siens, A02 les siens, comme sur la Digitakt.
- Chaque pas peut les verrouiller, par les verrous existants (`audio/locks.ts`), avec de nouvelles clés : `len`, `prob`, `cond`, `utime`, `rtrg`, `rate`, `vfad`, `rlen`, `lfot`.
- Tourner un potard de la page TRIG **sans pas tenu** règle le défaut de la voix. **Avec un pas tenu (REC allumé)**, c'est un P-LOCK de ce trig, comme les autres pages.

**Les réglages des LFO** sont des réglages de la voix (le son) : ils vivent comme les autres réglages de voix (`voicefx` ou à côté), avec presets et UNDO. Ils sont verrouillables par pas comme les autres. Ils n'entrent pas dans les scènes en D2 : rôle `noscene` ; à noter dans le rapport.

## 2. La page TRIG (deux onglets ; TRIG rappuyé passe à l'onglet suivant)

**TRIG 1/2**

| Potard | Réglage | Valeurs |
|---|---|---|
| A | NOTE | existe |
| B | VEL | existe |
| C | LEN | 1/16 de pas (0,0625), 1/8, 1/4, 1/2, 1, 1,5, 2, 3, 4, 6, 8, 16 pas, INF. À INF, rien ne change ; sinon le coup est coupé à LEN par un relâchement court (environ 8 ms) |
| D | PROB | 0 à 100 %, par pas de 1 |
| E | COND | voir la liste plus bas |
| F | μTIME | de -23 à +23 en 1/384 de mesure, comme la Digitakt (1/24 de pas). À l'écran : `-23/384` à `+23/384`, `0` au centre |
| G | LFO.T | OFF / ON : le trig relance les LFO de la voix dont le MODE est TRG, ONE ou HLF |
| H | vide | - |

**TRIG 2/2**

| Potard | Réglage | Valeurs |
|---|---|---|
| A | RTRG | OFF / ON |
| B | RATE | 1/1, 1/2, 1/3, 1/4, 1/5, 1/6, 1/8, 1/10, 1/12, 1/16, 1/20, 1/24, 1/32, 1/40, 1/48, 1/64, 1/80, en fraction de mesure : 1/16 = un coup par pas |
| C | VFAD | -64 à +63 : la vélocité des répétitions descend (négatif) ou monte (positif) jusqu'à la fin de RLEN |
| D | RLEN | durée du retrig, 1/16 à 16 pas, ou INF = jusqu'au prochain trig de la voix |
| E à H | vides | - |

**La liste de COND** (dans cet ordre au potard) :
1. NONE ;
2. FILL, !FILL ;
3. PRE, !PRE (le résultat de la dernière condition évaluée sur cette voix) ;
4. NEI, !NEI (la dernière condition évaluée sur la voix précédente : BD pour SD, SD pour CH... ; BD n'a pas de voisine, NEI y est faux) ;
5. 1ST, !1ST (le premier passage du pattern depuis son lancement) ;
6. LST, !LST (le dernier passage avant un changement de pattern prévu ; faux si rien n'est prévu) ;
7. puis A:B pour B de 2 à 8 et A de 1 à B (1:2, 2:2, 1:3, 2:3, 3:3, ... 8:8) : vrai au passage A d'un cycle de B, le compteur de passages du pattern partant de 1 ;
8. puis les mêmes avec ! (!1:2 ...).

**Règles d'évaluation, comme la Digitakt :**
- une COND autre que NONE gagne sur PROB : PROB ne compte que quand COND est NONE ;
- PRE et NEI lisent le dernier résultat évalué (une PROB évaluée compte aussi comme résultat) ;
- un trig sans COND ni PROB ne change pas ce résultat.

## 3. Le moteur (`audio/clock.ts`, `audio/drums.ts`, `audio/shots.ts`, `engine.ts`)

- **Le compteur de passages** : par pattern, remis à 1 au lancement (PLAY depuis l'arrêt, changement de pattern). Il avance à chaque fin de pattern et vit avec l'horloge. La pause le garde, STOP le remet à 1.
- **FILL** : tenir YES quand aucun menu n'est ouvert (pas dans KIT, pas sur la page TEMPO où YES = TAP, et sans l'armement page puis YES de D1) met le mode FILL tant qu'on tient. L'écran dit `FILL` dans l'en-tête. Au MIDI, une cible `rytm:fill` (hold).
  - **Conflit à arbitrer.** Une tape sur YES fait déjà « la page au hasard » quand on vient de taper une touche de page. Une tenue de plus de 250 ms est un FILL et ne déclenche jamais le hasard ; une tape courte garde le comportement de D1.
- **μTIME** décale l'heure du coup. Un décalage négatif sur le pas 1 doit tomber à la fin de la mesure d'avant : vérifie que l'avance de l'horloge (lookahead) le permet. Sinon, borne-le et note-le.
- **LEN** : un relâchement programmé du gain du coup, rampe de 8 ms. Ne touche pas aux queues des envois (réverbe, delay), qui continuent.
- **RTRG** :
  - les répétitions programmées depuis le trig, à RATE, pendant RLEN ;
  - chaque répétition est un coup de la même voix, avec les mêmes verrous, et la vélocité menée par VFAD ;
  - elles s'arrêtent au trig suivant de la voix, ou au mute de la voix ;
  - une voix à choke garde son choke (OH et CH, s'il existe).
- **Lock trig (trigless)** : en REC, FUNC + pas pose un trig jaune qui ne joue pas.
  - Ses verrous s'appliquent au coup de la voix qui sonne encore à ce moment, pour ce que le moteur sait changer en direct : VOL, PAN, la fréquence et la résonance du filtre, les envois. Liste exacte dans le rapport.
  - Il peut aussi relancer les LFO si LFO.T est ON.
  - Ce trig se voit : pas allumé en jaune, sans vélocité.
  - FUNC + pas sur un lock trig l'enlève ; sur un note trig, le transforme en lock trig.
  - Hors REC, FUNC + pas garde le mute rapide de D1.
- **Les LFO** (page MOD, 2 par voix, MOD 1/2 et MOD 2/2) :

  | Potard | Réglage | Valeurs |
  |---|---|---|
  | A | SPD | -64 à 63 |
  | B | MULT | 1, 2, 4, 8, 16, 32, 64, 128 ; avec SPD, la vitesse en mesures, comme la Digitakt |
  | C | FADE | -64 à 63 |
  | D | DEST | OFF, PITCH, FREQ, RESO, VOL, PAN, DIST, DELAY, REVERB, TONE, DECAY |
  | E | WAVE | TRI, SINE, SQR, SAW, EXP, RMP, RND |
  | F | PHAS | 0 à 127 |
  | G | MODE | FRE, TRG, HLD, ONE, HLF |
  | H | DEP | -64 à 63 ; 0 = rien |

  - **Calcul** : la valeur du LFO est calculée depuis l'horloge (en temps musical, synchronisée au tempo et à la position) et appliquée **en continu sur le coup qui sonne**, là où le moteur le permet. Il suffit de programmer, au lancement du coup, une courbe d'AudioParam sur sa durée (gain, pan, fréquence et résonance du filtre, vitesse de lecture du sample ou fréquence de la synthèse). Ailleurs (DIST, envois, TONE, DECAY), elle est prise au moment du coup. Liste exacte dans le rapport.
  - **MODE** : FRE tourne librement depuis PLAY. TRG repart à chaque trig. HLD prend sa valeur au trig et la garde. ONE fait un seul cycle par trig. HLF fait un demi-cycle.
  - **Page vide.** La page MOD de D1 ne dit plus « V.5.1 ».

## 4. La face et l'écran

- **Les blocs** : les blocs des pages TRIG et MOD ont leurs petits dessins comme les autres pages, sobres, dans le style de `screen.ts`. La forme d'onde du LFO s'y dessine, et la vitesse du retrig aussi si c'est simple.
- **Les pas** :
  - un lock trig s'allume en jaune, comme l'indique le tableau des couleurs de D1 ;
  - un pas qui a une COND ou une PROB porte une marque discrète, par exemple un petit point jaune au coin, à la manière de la Digitakt.
- **L'en-tête** affiche FILL quand le mode FILL est en cours.
- **Les cartes INFOS** à ajouter : la page TRIG et chacun de ses réglages, les conditions avec des exemples (1:2 = un passage sur deux, FILL = seulement en tenant YES), le retrig, le lock trig, les LFO. En français, avec le tutoiement, sans tiret cadratin.
- **Le MIDI**, ajouté à la fin, sans toucher aux ids existants :
  - les cibles de chaque nouveau réglage par voix, sous la forme `rytm:voice:<V>:<p>` ou une forme cohérente avec l'existant ;
  - `rytm:fill` ;
  - `rytm:screen:trig2`, `rytm:screen:mod1`, `rytm:screen:mod2` ;
  - le CSV régénéré.
- **Le boîtier** : `docs/hardware/mmhw-v2-app-side.md` cite la cible du FILL, `rytm:fill`, et les LED des lock trigs.

## 5. Vérification attendue

Comme en D1 (section 6 de `digitakt-d1-spec.md`), avec en plus :
- **L'identité audio** de la section 0.
- **Une sonde muette du séquenceur** : rendus hors ligne et compteurs de coups, jamais une écoute. Elle prouve :
  - PROB à 0 : aucun coup ;
  - 1:2 : un passage sur deux ;
  - FILL qui ne joue qu'en tenant YES ;
  - μTIME qui décale l'heure du coup du bon nombre de millisecondes ;
  - RTRG à 1/32 : deux coups par pas ;
  - LEN qui coupe le coup ;
  - un lock trig qui ne joue pas, mais dont le verrou VOL change le gain du coup qui sonne ;
  - un LFO sur PITCH ou FREQ qui fait varier la valeur d'un coup à l'autre (ou sur la courbe programmée).
- **Le téléphone** : identique à la V.5.0 (captures), en dehors de ce qu'un pattern fait entendre.
