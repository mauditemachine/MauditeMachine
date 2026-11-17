# Mesure du Decapitator contre la DISTO du MM-ARP

But : caler la DISTO du VST3 (`plugin/mm-arp/dsp/Decap.h`) sur le Soundtoys Decapitator, chiffres contre chiffres.

Le Decapitator est mesuré en **boîte noire** : des signaux de test passent dedans, on mesure ce qui sort. Le binaire
n'est jamais ouvert ni désassemblé (la licence Soundtoys l'interdit), et il ne va **jamais** dans le dépôt, qui est
public. Seules les mesures y vont. Tout est rendu hors ligne, en mémoire : **aucun son ne sort des enceintes**.

## Sur le Mac (Mika)

Depuis la racine du dépôt, sur la branche de la DISTO :

```bash
bash plugin/mm-arp/tests/decap-measure/run.sh
```

- La première fois, le script installe `pedalboard` (Spotify, charge les VST3) et `numpy` dans `~/.cache/mm-decap-measure`
  (rien ailleurs). Il faut `python3` (s'il manque, macOS propose d'installer les Command Line Tools : accepte).
- Il cherche le Decapitator dans `/Library/Audio/Plug-Ins/VST3/Soundtoys/`. Ailleurs :
  `DECAP=/chemin/Decapitator.vst3 bash plugin/mm-arp/tests/decap-measure/run.sh`.
- Le Decapitator doit être autorisé sur le Mac (licence Soundtoys active), sinon il peut se charger en mode démo ou
  muet.
- Essai rapide d'abord si tu veux : ajoute `--quick` (moins d'une minute). La mesure complète prend quelques minutes.

À la fin :

```bash
git add plugin/mm-arp/tests/decap-measure/results && git commit -m "mesures Decapitator" && git push
```

## Ce qui est mesuré

| Mesure | Quoi |
| --- | --- |
| `laws` | la valeur affichée de chaque réglage pour 41 positions (la loi de DRIVE, LOW CUT, HIGH CUT, TONE, OUTPUT, MIX) |
| `harmonics` | chaque style, DRIVE 0 à 1 (et PUNISH), sinus de 100 Hz et 1 kHz de -36 à 0 dBFS : gain, THD, H2 à H9, pair / impair, continu |
| `autogain` | AUTO allumé : le gain à 1 kHz, -18 dBFS, par style et DRIVE (avec et sans PUNISH) |
| `response` | en petit signal : la réponse de 20 Hz à 20 kHz de chaque style, de LOW CUT (± THUMP), HIGH CUT (± STEEP) et TONE |
| `burst` | une salve après un silence : l'enveloppe des 100 premières ms (une saturation qui respire ?) |
| `latency` | le retard d'une impulsion |

## À la main

```bash
python3 measure.py --plugin Decapitator.vst3 --list                  # ses paramètres et leurs valeurs
python3 measure.py --plugin Decapitator.vst3 --out decapitator.json
python3 measure.py --plugin Decapitator.vst3 --map low="Low Cut Freq"  # si un réglage n'est pas reconnu
python3 measure.py --cli build-dsp/mmarp_decap_cli --out mm-disto.json
python3 measure.py --compare decapitator.json mm-disto.json
```

`mmarp_decap_cli` (cible CMake du plugin, `tests/decap_cli.cpp`) : la DISTO en ligne de commande, du stéréo float32
entrelacé de l'entrée standard vers la sortie standard.
