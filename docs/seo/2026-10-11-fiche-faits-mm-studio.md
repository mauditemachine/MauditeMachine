# Fiche de faits : Maudite Machine et MM-STUDIO (2026-10-11)

La base commune de tous les textes du kit (communiqués, pitchs, prix, posts, bios). Chaque ligne donne le fichier où le fait a été vérifié le 2026-10-11. Un fait qui n'est pas ici ne va dans aucun texte. Une info marquée "à vérifier" reste hors des textes tant que tu ne l'as pas confirmée.

## 1. L'artiste

| Fait | Source |
|---|---|
| Nom de scène : Maudite Machine. Prénom utilisé dans les textes : Mika. Aucun nom civil dans les textes. | src/v4/data.ts (MENU_ABOUT, signé "Mika") |
| Positionnement EN : "Indie dance and dark disco with a psychedelic edge" | scripts/seo-shared.mjs (POSITIONING.en) |
| Positionnement FR : "Indie dance et dark disco, à tendance psychédélique" | scripts/seo-shared.mjs (POSITIONING.fr) |
| Positionnement ES : "Indie dance y dark disco, con un toque psicodélico" | scripts/seo-shared.mjs (POSITIONING.es) |
| Genres courts (champs genre des plateformes) : Indie Dance, Dark Disco | scripts/seo-shared.mjs (POSITIONING_SHORT) |
| Bio courte EN, FR, ES : à reprendre mot pour mot (voir 2026-10-11-bios-profils.md) | scripts/seo-shared.mjs (BIO_SHORT) |
| Bio longue EN, FR, ES : à reprendre mot pour mot (voir 2026-10-11-pitch-artiste-en.md et -fr.md) | scripts/seo-shared.mjs (BIO_LONG) |
| Basé à Montpellier, dans le Sud de la France, après quinze ans dans l'underground montréalais. Montréal seulement comme historique. | scripts/seo-shared.mjs (BIO_LONG) |
| Formats : DJ set sur CDJ, 90 minutes à 4 heures ; live hybride avec synthés et grooveboxes, 60 à 75 minutes | docs/presskit-2027/content.mjs (set, techFormats) |
| Matériel du live hybride : Ableton Push 3, Dreadbox Typhon, Melbourne Instruments Roto-Control (plus MacBook Pro avec Ableton Live) | docs/presskit-2027/content.mjs (tech, Hybrid live) |
| Lieux : Techno Parade Paris, Okami Festival (France), Groove and Bass (Québec), salles de Montréal de la SAT au Piknic Électronik | scripts/seo-shared.mjs (BIO_LONG) |
| Plateaux partagés (liste fixée) : Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox, Perfect Stranger | scripts/seo-shared.mjs (BIO_LONG) |
| Carl Craig, Agoria, Reinier Zonneveld, afters d'Igloofest : présents dans le press kit et llms.txt, à n'utiliser que si tu confirmes | docs/presskit-2027/content.mjs (shared, venues), public/llms.txt |

## 2. Sorties et label

| Fait | Source |
|---|---|
| Limbos : album, VRSTL Records, 9 titres, sorti le 2025-10-16 (octobre 2025) | docs/presskit-2027/content.mjs (limbos), src/v2/data/discography.json |
| Titres de Limbos : Abyss, Cephal, Limbos, Reaper, Nortkele, Muld, Simetra, Zenith, Chimie Électrique (Emotional Remix) | docs/presskit-2027/content.mjs (tracklist) |
| Voodoo : single, VRSTL Records, sorti le 2026-02-11 (février 2026) | docs/presskit-2027/content.mjs (catalogue), src/v2/data/discography.json |
| Prochaine sortie VRSTL : [PROCHAINE SORTIE VRSTL], rien dans le dépôt | aucune source |
| VRSTL Records : label indépendant fondé par Maudite Machine, 21 EPs et 2 albums, artistes du Québec, du Brésil, d'Argentine et d'Europe | scripts/seo-shared.mjs (BIO_LONG, Organization) |
| Pages album et morceaux : https://mauditemachine.com/tracks/ ; Bandcamp de Limbos : https://mauditemachine.bandcamp.com/album/limbos | docs/presskit-2027/content.mjs (URL), site en ligne (200 le 2026-10-11) |

## 3. Dates à venir

| Date | Soirée | Lieu | Source |
|---|---|---|---|
| 2026-10-16 | Soirée Versatile | Montréal, QC | public/events.json |
| 2026-10-30 | Cirque de Boudoir | Théâtre du Lion d'Or, Montréal | public/events.json |
| 2026-10-31 | Cirque de Boudoir, B2B with Omni | Théâtre Paradoxe, Montréal | public/events.json |

Aucune date à Montpellier ni en France dans public/events.json à ce jour.

## 4. Contacts et liens

| Fait | Source |
|---|---|
| Booking international : vrstlrecords@gmail.com | public/llms.txt, docs/presskit-2027/content.mjs (contacts) |
| Booking Canada et USA : mauditemachine@gmail.com | public/llms.txt, docs/presskit-2027/content.mjs (contacts) |
| Contact presse : [A CONFIRMER PAR MIKA] | aucune source |
| Page presse : https://mauditemachine.com/press/ | site en ligne (200 le 2026-10-11) |
| Press kit PDF : https://mauditemachine.com/Presskit_Maudite_Machine_2027_generic.pdf | site en ligne (200 le 2026-10-11) |
| Fiche technique : https://mauditemachine.com/techrider/ | site en ligne (200 le 2026-10-11) |
| ZIP presse : https://mauditemachine.com/press/maudite-machine-press-kit.zip | site en ligne (200 le 2026-10-11) |

## 5. MM-STUDIO, l'ensemble

| Fait | Source |
|---|---|
| Nom : MM-STUDIO, sous-titre ALL THE MACHINES. Toujours écrire "MM-STUDIO by Maudite Machine" la première fois (MM Studio seul est un nom déjà pris par plusieurs studios). | src/v4/ui/MachineDrawer.tsx (ligne 26), audit search du 2026-10-11 |
| C'est la page d'accueil de https://mauditemachine.com/ | src/v4/index.tsx, public/llms.txt |
| Trois machines visibles par défaut, de gauche à droite : MM-RYTM, MM-ARP, MM-DECKS. Les machines cachées ou retirées ne sont citées nulle part. | src/v4/state/focus.ts (MACHINES, BASS caché par défaut) |
| Les machines jouent au même tempo : l'arpège tombe sur la grille de la boîte à rythmes | src/v4/voyager/arp.ts (clock.gridAfter, clock.follow) |
| Gratuit, dans le navigateur, sans installation, sans compte sur le site. Seul l'onglet MY SC demande une connexion SoundCloud, facultative. | src/v4/dj/TrackBrowser.tsx (en-tête), public/llms.txt |
| Phrase de Mika publiée sur le site : "I built this website and every machine on it myself." | src/v4/data.ts (MENU_ABOUT.note, ligne 313) |
| Formulation retenue dans le kit, d'après cette phrase : "designed and built" (EN), "dessiné et construit" (FR) | src/v4/data.ts (MENU_ABOUT.note) |
| Liens directs vers une machine : https://mauditemachine.com/?m=rytm , https://mauditemachine.com/?m=arp , https://mauditemachine.com/?m=decks (alias ?m=dj) | src/v4/state/focus.ts (START_ALIASES) |
| Page de présentation https://mauditemachine.com/mm-studio/ et pages machines /mm-studio/drum-machine/, /mm-studio/synth/, /mm-studio/dj-decks/ (plus /fr/mm-studio/ et /es/mm-studio/) : en cours de création, 404 le 2026-10-11. Écrire "une fois en ligne". | public/llms.txt (copie de travail), test curl du 2026-10-11 |

## 6. MM-RYTM (boîte à rythmes)

| Fait | Source |
|---|---|
| 8 voix : BD, SD, CH, OH, CP, TOM, HT, CY | src/v4/audio/pattern.ts (INSTRUMENTS) |
| 16 pas | src/v4/audio/pattern.ts (STEP_COUNT) |
| Verrous de paramètres par pas (P-locks) : tenir un pas, puis glisser une valeur de l'écran. Texte sérigraphié : "HOLD A STEP: P-LOCK, THEN DRAG A SCREEN VALUE" | src/v4/theme.ts (ligne 1618), src/v4/audio/locks.ts |
| 16 patterns, PTN 01 à 16 | src/v4/ui/BeatEditor.tsx (PTN), audit awards du 2026-10-11 |
| Deux couches par voix, SYNTH et SAMPLE | src/v4/rytm/diagrams.ts (SYNTH LAYER, SAMPLE LAYER), src/v4/state/presets.ts |
| Samples de kick et de caisse claire faits par Mika dans le choix de son | src/v4/audio/samples.ts, docs/midi/MIDI-roto-reference.md (KICK SOUND, SNARE SOUND) |
| Effets de chaque voix : DIST, CHORUS, DELAY, REVERB | src/v4/theme.ts (vdist, vchorus, vdelay, vreverb) |
| Effets de toute la machine : DIST, CHORUS, DELAY, REVERB, STRETCH, SWING, BIT, COMP | src/v4/theme.ts (GLOBAL_ENC_LABELS) |
| Tempo de 100 à 150 BPM, 130 au départ | src/v4/audio/pattern.ts (BPM) |

## 7. MM-ARP (synthé)

| Fait | Source |
|---|---|
| Deux oscillateurs (OSC 1, OSC 2) et un SUB réglable (niveau, octave -1 ou -2, forme) | src/v4/voyager/infos.ts |
| OSC 1 en morphing continu : SINE, TRI, SAW, SQUARE, PULSE, puis FM | src/v4/voyager/infos.ts |
| Filtre ladder (dire "ladder filter", jamais un nom de marque) | src/v4/audio/moog.worklet.js, public/llms.txt |
| OVERDRIVE | src/v4/voyager/infos.ts (dist, titre OVERDRIVE) |
| Arpégiateur sur 1 à 3 octaves, accords BASIC, TRIAD, 7TH, 9TH, 11TH | src/v4/voyager/infos.ts (CHORD) |
| Huit chord pads en fa dièse mineur (F#m, D, E, C#m, Bm, A, F#m7, Dmaj7) : toutes les notes restent dans la gamme | src/v4/voyager/chords.ts |
| SIDECHAIN : la sortie s'efface à chaque kick du MM-RYTM | src/v4/voyager/infos.ts (duck) |
| SCOPE : un oscilloscope sous le capot (OPEN) | src/v4/voyager/theme.ts (ligne 754 et suivantes) |

## 8. MM-DECKS (platines et table de mixage)

| Fait | Source |
|---|---|
| Deux platines au départ, jusqu'à quatre (ADD DECK : C, puis D) | src/v4/dj/actions.ts (ligne 1089) |
| Table : EQ HI, MID, LOW ; GAIN de -12 à +12 dB ; vumètres | src/v4/dj/math.ts (GAIN_DB), src/v4/dj/names.ts |
| Un sampler dans chaque platine | src/v4/dj/SamplerScreen.tsx, src/v4/state/focus.ts (commentaire MACHINES) |
| SYNC au tempo, avec rattrapage de phase | src/v4/dj/engine.ts (lignes 481 à 506) |
| Sources, onglets MAUDITE, SOUNDCLOUD, MY SC, FILES, PLAYLISTS. MAUDITE : les morceaux SoundCloud de Mika, qu'il autorise à mixer. SOUNDCLOUD : seulement des licences Creative Commons qui autorisent le remix. MY SC : ses propres morceaux publics, après connexion SoundCloud. FILES : les fichiers de l'appareil, rien n'est envoyé. | src/v4/dj/TrackBrowser.tsx (lignes 12 à 24 et 134) |

## 9. MIDI, interface, technique

| Fait | Source |
|---|---|
| Web MIDI : tous les paramètres et toutes les actions de toutes les machines sont assignables (MIDI LEARN) | src/v4/midi/targets.ts |
| Web MIDI marche dans Chrome, Edge, Opera, Firefox ; pas dans Safari | src/v4/midi/midi.ts (ligne 6) |
| Roto-Control reconnu (entrée dont le nom contient "roto") et configuré sans MIDI LEARN : noms courts, couleurs, potards motorisés qui suivent le site. Les fichiers .json des setups se téléchargent du panneau MIDI et s'importent dans ROTO-SETUP (File > Import). | src/v4/midi/roto.ts, docs/midi/MIDI-roto-reference.md |
| UNDO (et REDO) | src/v4/ui/Header.tsx, src/v4/state/undo.ts |
| Presets du MM-RYTM et du MM-ARP gardés dans le navigateur, avec un nom tiré au hasard | src/v4/state/presets.ts |
| Apparences Dark et Light (bouton du menu) | src/v4/ui/AppearanceToggle.tsx |
| Au téléphone : une machine à la fois, on glisse pour passer à la suivante | src/v4/state/focus.ts (en-tête) |
| Un jumeau HTML nommé pour chaque contrôle (exemples relevés : "F sharp minor chord", "Run the arpeggiator"), focus clavier visible | audit awards du 2026-10-11 |
| Sans WebGL 2 : un repli statique s'affiche, les pages HTML du site restent lisibles | src/v4/fallback/NoWebGL.tsx, src/v4/scene/renderer.ts (ligne 574) |
| Mouvement réduit respecté (prefers-reduced-motion) | src/v4/v4.css (ligne 1539), audit awards du 2026-10-11 |
| Rendu à la demande : aucune image calculée au repos, la carte d'ombre refaite seulement quand un objet qui projette une ombre a bougé | src/v4/scene/renderer.ts (en-tête) |
| Technique : Three.js 0.186 (WebGL 2), Web Audio API avec AudioWorklet, Web MIDI, React 18, TypeScript, Vite, GitHub Pages | package.json, src/v4/audio/synth.ts et scope.ts (audioWorklet.addModule), src/v4/scene/renderer.ts |
| Le son démarre après un geste (règle des navigateurs) | règle des navigateurs, à mentionner dans les limites connues |

## 10. Couleurs et polices

| Fait | Source |
|---|---|
| ink #0A0A0B, graphite #141417, bone #F6F1E7, yellow #F2C230, orange #FF6A13, red #C8442F | src/v4/theme.ts (COLOR, lignes 46 à 56) |
| Fond de page #0C0B09 | src/v4/theme.ts (BACKDROP), src/v4/v4.css (ligne 74) |
| Polices actuelles : SF Pro Display et Robot Radicals (studio), Larsseit (pages v2) | src/v4/v4.css (lignes 11 à 28), src/v2/v2.css (ligne 12) |
| Licences : Larsseit, licence de Mika d'après src/v2/v2.css ; SF Pro Display et Robot Radicals à vérifier avant toute déclaration à un jury | src/v2/v2.css (ligne 6), audit awards du 2026-10-11 |

## 11. Ce qui ne va dans aucun texte

- Les termes de ta liste interdite du 2026-10-10 (genres retirés, ancienne base, lien de pré-sauvegarde, ancien contrôleur). Le build n'en contient aucun.
- Les machines cachées ou retirées du site.
- Le mot "clone" et le nom d'une machine du commerce dans un titre. Sur Elektronauts, une seule fois "inspired by the Elektron workflow".
- Un nom de marque pour le filtre du MM-ARP : écrire "ladder filter".
- Un nombre d'utilisateurs, de visites ou d'écoutes, une note Lighthouse, une citation de presse.
- Ton nom civil.
