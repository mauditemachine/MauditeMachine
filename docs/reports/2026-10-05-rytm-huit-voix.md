# MM-RYTM à huit voix : RS et PC retirés (2026-10-05)

Demande de Mika : « Je veux finalement 8 VOICES dans RYTM, enlève RS et PC. »

## 1. Ce qui a été fait

- **Les pads** (`src/v4/theme.ts`) : deux rangées de quatre, BD SD CH OH en haut (touches A S D F), CP TOM HT CY dessous (Z X C V), EDIT et OPEN dans la colonne d'après. Les pads sont un peu plus grands et l'ensemble garde sa largeur : EDIT et OPEN restent à leur place, la rangée VOICE FX aussi.
- **Les voix** : `audio/pattern.ts` (liste dans l'ordre des pads, motif d'arrivée), `audio/voicefx.ts`, les motifs RANDOM (`audio/house.ts`, `audio/beats.ts`), les sons (`audio/shotsdsp.ts` : RS et PC retirés ; `audio/shots.ts` ne les prépare plus).
- **La plaque TWEAKS** (`audio/kit.ts`, `scene/rytmTweaks.ts`, `ui/KnobPanel.tsx`) : plus de RIM ; desktop, les six potards du bas s'étalent sur toute la largeur ; au téléphone, CLAP et TOMS centrés en bas.
- **L'écran** (`scene/screen.ts`, `state/lcd.ts`) : huit vumètres sur la même largeur ; la page MIX montre les quatre voix de la rangée.
- **L'éditeur et les docks du téléphone** (`ui/BeatEditor.tsx`, `v4.css`) : huit lignes, quatre voix par rangée.
- **Anciennes données** (`state/presets.ts`) : un motif, un pattern ou un preset enregistré avec dix voix charge ses huit ; RS et PC sont ignorés.
- **Roto-Control** (`midi/roto.ts`) : setup RYTM, page 3 les huit volumes, page 4 KICK SOUND, KICK TUNE, KICK ATTACK, KICK DECAY, KICK DRIVE, SNARE SOUND, SNAPPY, HATS SOUND ; boutons page 2 les huit voix, page 3 leurs mutes, page 4 les patterns A01 à A08. MIXER et LIVE : les mutes des huit voix. Les six fichiers refaits dans `docs/midi/roto/`, la référence `docs/midi/` aussi (327 cibles).
- `docs/v4/spec.md` : R14-184.

## 2. Décisions prises et pourquoi

- **L'ordre des pads** : le groove en haut (kick, caisse claire, les deux charleys côte à côte), le reste dessous (clap, les deux toms côte à côte, la cymbale sous le charley ouvert). CH passe sur D, OH sur F, TOM sur X.
- **Des pads plus grands plutôt qu'un trou** : quatre colonnes sur la largeur de cinq, sans déplacer EDIT, OPEN ni la rangée VOICE FX.
- **Les sons RS et PC supprimés du code**, pas seulement cachés : plus rien ne les calcule.
- **Le Roto y gagne** : huit voix tiennent exactement sur une page (volumes, choix, mutes) ; la page 4 récupère le choix des sons du kit et huit patterns.
- **Vérifié** (son coupé) : desktop et téléphone, machine fermée, EDIT, ouverte ; un ancien motif à dix voix se charge sur huit ; RANDOM donne huit voix ; RUN joue sans erreur ; smoke desktop et téléphone sans erreur ; tsc inchangé (15) ; build OK.

## 3. Ce qui reste à faire / points en suspens

- **Côté Mika** : réimporter dans ROTO-SETUP « MM RYTM (SETUP 11) », « MM MIXER (SETUP 14) » et « MM LIVE (SETUP 16) » (`docs/midi/roto/`, ou panneau MIDI > DOWNLOAD THE 6 SETUPS) : leurs pages ont changé.
- Les assignations MIDI apprises sur RS ou PC ne font plus rien : à refaire sur d'autres commandes si tu en avais.
- Toujours en attente : le compteur de visiteurs du MENU.

## 4. Commandes utiles ajoutées

- Aucune (les fichiers du Roto se refont avec `npm run docs:midi`).
