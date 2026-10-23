# Controle qualite du MM-ARP (scripts/arp-quality)

2026-10-23, Mika : "Pourrais-tu controler ARP pour que le son soit d'extreme bonne qualite ?! entre Monark et un synth
analog Moog Voyager et un Korg MS10".

Outil local, hors du build et de la CI. Rien n'est joue : le moteur (`src/v4/audio/moog.worklet.js`) tourne dans Node,
bloc par bloc, avec sa graine. Les sorties vont dans `scripts/output/arp-quality/` (hors git).

## Les series (JavaScript seul)

```
node scripts/arp-quality/q.mjs purity                 purete (Q1) des cas de measure.md section 7, x4 et x2
node scripts/arp-quality/q.mjs purity,sync,tri        plusieurs series
node scripts/arp-quality/q.mjs all                    toutes
node scripts/arp-quality/q.mjs purity --phone         le chemin du telephone seul (x2) ; --desktop : x4 seul
node scripts/arp-quality/q.mjs purity --worklet <f>   un autre moteur (une version d'avant)
node scripts/arp-quality/q.mjs purity --against <f>   les deux moteurs cote a cote, et l'ecart
node scripts/arp-quality/q.mjs p1a --quick            moins de points
```

Series : `purity` (Q1), `p1a` (la resonance aux coupures hautes), `selfosc` (C8, C9, C10), `sync` (la SYNC sur les
rapports justes, balayages fins), `tri` (le triangle), `timbre` (H2 a H9 selon le niveau et OVERDRIVE), `resp` (la
reponse du chemin ouvert), `level` (le niveau selon OVERDRIVE), `silence` (Q6 : sous-normaux, queues), `garbage` (Q7 :
reglages pourris), `q2` (la decimation), `q10` (le haut "numerique" contre la scie du Voyager), `c3c5` (la coupure et
la bosse de resonance), `c18` (le fondamental le long de WAVE), `c22h` (KEY TRACK 1), `q11` (la somme mono), `q3`
(l'escalier des potards MIDI), `gc` (Q8 : memoire allouee par bloc, ramasse-miettes, blocs lents).
Ajoutees le 2026-10-23 avec les reglages nouveaux : `ms10` (le Korg35 du MS-10), `load` (LOAD), `space` (SPACE : les
coudes des deux filtres, la somme mono, BASS MONO, le passage 0 -> 1), `fpol` (POLARITY : le miroir du contour), `zip`
(la hauteur d'un filtre en auto-oscillation sous un potard MIDI : les rampes des messages), `top` (les fondamentaux
au-dessus de 18 kHz).

La purete est la metrique du 2026-10-21 (`measure/ana.py harmonic_split`) : energie harmonique sur non harmonique de
20 Hz a 20 kHz, fenetre de Blackman-Harris de 65536 points depuis 0.2 s, 6 cases de tolerance ; `ana.mjs` la redonne a
0.1 dB pres (SAW C7 x4 65.4, OD06 C7 x2 37.5, SYNC19 C7 x4 39.1, TRI C8 x2 50.4 sur le moteur 35439dc).

`baseline-35439dc.json` : toutes les mesures du moteur de depart (35439dc) et les decisions qui en decoulent (Q2, Q10).

## Les scripts de la mesure du 2026-10-23 (measure/)

Les rendus Node et les analyses Python de la mesure complete (`measure/t01` a `t17`, `ana*.py`) ; le moteur mesure :
`ARP_WORKLET=<fichier>`, sinon celui du depot. Python : `python3 -m venv .venv && .venv/bin/pip install numpy scipy
matplotlib`, puis par exemple :

```
node scripts/arp-quality/measure/dump-params.mjs
node scripts/arp-quality/measure/t07_alias.mjs && .venv/bin/python scripts/arp-quality/measure/ana_alias.py
```

## Le banc de reference

`node scripts/arp-bench.mjs --check` (et `--phone`) compare au fichier `scripts/arp-bench.golden.json` ;
`--against <moog.worklet.js d'avant>` donne pour chaque patch d'heritage la sonie ponderee K, les bandes de tiers
d'octave et le contrat F (0.2 LU ; 0.3 dB de 40 Hz a 8 kHz ; 0.5 dB de 8 a 14 kHz).

## Le chorus, les ecoutes, les propositions (2026-10-23)

```
node scripts/arp-quality/chorus.mjs [--against <chorus.worklet.js d'avant>]
    le chorus Juno dans Node : l'erreur de la table de phases et contre un retard vrai, le niveau mouille, le calcul
node scripts/arp-quality/cpu.mjs --phone --voices 8 --set '{"space":0.5}' --against <moog.worklet.js d'avant>
node scripts/arp-bench.mjs --proposals
    ce que S23 changerait (LOAD sur les presets, INIT a LOAD 0 / 0.15 / 0.25 / 0.35, cinq presets nouveaux :
    proposals.mjs), le moteur seul, cale en sonie, dans scripts/output/arp-bench/proposals/
PLAYWRIGHT_MODULE=... node scripts/arp-quality/ab.mjs --url http://127.0.0.1:<port> --tag after --out <dossier> \
    --set factory,proposals,demos
    la chaine complete du site (chorus, BASS MONO, DELAY, TAPE, REVERB) dans un OfflineAudioContext de Chromium
    (--mute-audio, ?mute=1 : rien ne sort), 8 mesures, WAV 24 bits ; --tag before contre un serveur du site d'avant
```

