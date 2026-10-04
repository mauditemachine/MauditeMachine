# 2026-10-04 : MM-ARP, les TWEAKS sous le capot

## 1. Ce qui a ete fait

- src/v4/voyager/params.ts : sept potards de plus (section tweak) : PHASE, DRIFT, WIDTH, BASS MONO, KEY TRACK, ACCENT, SYNC ; VOY_FACE_KNOBS et VOY_TWEAKS ; lectures FREE / DEG / OFF / HZ ; EngineParams.
- src/v4/audio/moog.worklet.js : phase de depart par note (PHASE), derive et ecarts par note doses (DRIFT), ecart stereo (WIDTH), suivi du clavier (KEY TRACK), hard sync d'OSC 2 (SYNC).
- src/v4/audio/synth.ts : BASS MONO, separation Linkwitz-Riley ; le bas en mono, sec, sans chorus ni effets.
- src/v4/voyager/arp.ts : ACCENT dose la profondeur des accents.
- src/v4/voyager/tweaks.ts (nouveau) : la plaque 3D (couleur du capot, entretoises, vis), potards Moog, serigraphie facon Mini V, cibles vk-<id>.
- src/v4/voyager/theme.ts : VOY_TWEAK_PLATE, VOY_TWEAK_CELLS, VOY_TWEAK_ENDS, voyTweakPlace (desktop 2 x 4, telephone 4 x 2).
- src/v4/scene/pcb.ts : option chips: false (carte sans puces).
- src/v4/voyager/rig.ts : carte du MM-ARP sans puces, plaque dans pcb.parts, TWEAKS actifs capot ouvert.
- src/v4/voyager/knobs.ts, silk.ts : seulement les potards de la face ; buildKnobGeometry exporte.
- src/v4/ui/VoyTwins.tsx : plus de jumeaux de puces ; les TWEAKS au clavier capot ouvert.
- src/v4/ui/Header.tsx : GOODIES, MERCH, STUDIO ouvrent toujours le capot du MM-RYTM.
- src/v4/voyager/random.ts : chaque style regle ses TWEAKS (basses et acid : phase recalee, graves en mono).
- src/v4/state/presets.ts : un preset d'avant les TWEAKS les remet a leur valeur de depart.
- docs/v4/spec.md : R14-91.

## 2. Decisions prises et pourquoi

- Valeurs de depart = le son d'avant (PHASE FREE, DRIFT 5, WIDTH 5, BASS MONO OFF, KEY TRACK 5, ACCENT 5) : rien ne change tant que Mika ne touche pas la plaque.
- Le probleme de phase dans les graves venait de quatre choses : phases libres, derive, ecart stereo, et surtout le chorus sur toute la bande (il creusait les graves vers 100 Hz). PHASE, DRIFT, WIDTH et BASS MONO traitent chacune.
- BASS MONO rend les graves au niveau du synthe sec, pas a celui du chorus : c'est le plus proche du son d'avant (mesure hors ligne, phase recalee pour des mesures stables).
- PHASE ne recale qu'une voix muette ou presque : pas de clic sur une note reprise en plein son.
- La plaque est dans pcb.parts : elle pousse avec les composants a l'ouverture.
- Les liens du site restent dans le menu et sur la carte du MM-RYTM.

## 3. Ce qui reste a faire / points en suspens

- Mika : ecouter BASS MONO vers 120-170 Hz sur une basse avec CHORUS, et PHASE a 0 DEG sur une bassline.
- Mika (toujours) : secrets SoundCloud du worker Sonaa, defilement de la playlist au doigt sur iPhone, equilibre RYTM / ARP.

## 4. Commandes utiles ajoutees

- Aucune. Tests sans son : `?mute=1&m=arp`, puis `__v4.voyager.synth.renderOffline({ seconds, notes, params: { phase, drift, width, monoLow, keyTrack, sync } })`.
