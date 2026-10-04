# 2026-10-03 : MM-VOYAGER plus lisible, pages sur la carte, RUN/STOP synchronise

## 1. Ce qui a ete fait

- `src/v4/voyager/theme.ts` : nouvelle disposition. Portrait : panneau plus court (bendZ -1.2), 3 rangees de 2 groupes avec crochets nommes (VOY_GROUPS) ; plateau = ecran + VOLUME, transport, arpegiateur, pads. Desktop : ecran, RUN/STOP, CLEAR, RANDOM, OPEN a droite, pads centres sous un crochet CHORDS F# MINOR. En-tete : wordmark, MM-VOYAGER, logotype a droite. VOY_PAGE_CHIPS (5 puces de pages). Capot desktop qui s'ouvre plus haut.
- `src/v4/scene/pcb.ts` : la carte du Voyager recoit les 5 puces de pages (taille moyenne CHIP_MID), bande degagee (resistances, ceramiques, pile), plan de masse raccourci, serigraphie deplacee. La carte de la 808 ne change pas.
- `src/v4/theme.ts` : ChipSpec, CHIP_MID (taille des puces de pages).
- `src/v4/voyager/knobs.ts` : les potards sont sur le capot, chacun sur son plan (panneau ou plateau).
- `src/v4/voyager/silk.ts` : crochets des groupes, logotype, libelles par plan, graduations de VOLUME sur le plateau en portrait.
- `src/v4/voyager/pads.ts` : boutons RUN/STOP, CLEAR, RANDOM, OPEN (plus de pages) ; RUN allume pendant la lecture.
- `src/v4/voyager/arp.ts` : toggleRun, stop public, les pads ne relancent pas un arpege arrete, RANDOM le lance ; grille partagee avec la 808 (clock.follow).
- `src/v4/audio/clock.ts` : RUN rejoint la grille de l'arpege s'il joue deja.
- `src/v4/voyager/lcd.ts`, `rig.ts` : tempo a l'ecran, triangle de lecture, RUN/STOP TO PLAY.
- `src/v4/actions.ts` : voyRun, puces de pages du Voyager = comme les pads de page de la 808 ; voyPage retire.
- `src/v4/ui/VoyTwins.tsx`, `Hotspots.tsx`, `VoyDock.tsx`, `hooks/useKeys.ts`, `v4.css` : jumeaux et Dock (touche RUN/STOP), barre d'espace sur le Voyager.
- `src/v4/audio/soundcloud.ts` : une piste qui part arrete l'arpege sans vider la progression.
- `src/v4/ui/PcbClose.tsx`, `v4.css` : au telephone, CLOSE (capot ouvert) monte au-dessus du Dock deplie (808 et Voyager), redescend quand on le replie.
- RANDOM tire aussi les effets : `actions.ts` (randomPattern pour la 808 : DIST, CHORUS, DELAY, REVERB du bus ; voyRandom pour le Voyager : DIST, CHORUS, DELAY, REVERB), dosages souvent sobres, parfois coupes.
- Potard NOTES (ALL, 1 a 8) : `voyager/params.ts`, `arp.ts` (longueur du motif), ecran (5N), Dock (touche NOTES). Desktop : l'arpegiateur passe sur le plateau a gauche de l'ecran (`voyager/theme.ts`), le panneau garde le son en colonnes plus larges.
- MM-808, mode MUTE a verrou : `state/voices.ts` (muteMode), `actions.ts` (muteToggle, padHit, selectInstrument), temoin MUTE allume pendant le mode, Dock et jumeaux.
- MM-808, pages dans OPEN : puces de pages sur sa carte aussi (`theme.ts` PAGE_CHIPS, BOARD_CHIPS ; `scene/pcb.ts`), capot desktop plus haut ; touches 1 a 5 gardees.
- MM-808, dix voix facon Rytm : CP, RS, HT, CY, CB (`audio/drums.ts` synthese, `pattern.ts`, `voicefx.ts`, `house.ts` RANDOM, `theme.ts` pads et touches Z X C V B, page MIX par rangee, Dock a deux rangees).
- Jupes des potards : Voyager plus fine et plus sombre en noir (`voyager/theme.ts`, `theme.ts` voySkirt) ; la 808 recoit la meme jupe d'alu sous ses encodeurs (`scene/encoders.ts`, `renderer.ts`).
- Jupes, second passage : filet encore plus fin (Voyager r 0.284, 808 ENCODER.skirt r 0.298), plus sombre en noir (#5D6167), plus clair en blanc (#E6E8EC), les deux machines.
- La seconde machine s'appelle MM-ARP (serigraphie, ecran, carte, selecteur, volet, nom sous la machine) ; noms internes inchanges.
- Le pad de l'accord qui joue ne clignote plus a chaque note : jaune fixe (`voyager/rig.ts`).
- MM-ARP a deux oscillateurs facon Typhon : `audio/moog.worklet.js` (formes par cran, FM, TUNE 2, MIX), `voyager/params.ts` (WAVE 1, WAVE 2, TUNE 2, MIX), `voyager/silk.ts` (arcs jaunes et dessins des formes autour des selecteurs, cran choisi allume), `voyager/theme.ts` (OSC sur trois colonnes en desktop, quatre rangees au telephone, OCTAVE avec l'arpegiateur), `voyager/rig.ts`.
- Dock du MM-ARP au telephone : rangee WAVE 1 / WAVE 2 avec le dessin de la forme (`ui/VoyDock.tsx`, `voyager/glyphs.ts` partage avec la serigraphie, `v4.css`).
- Qualite du son : limiteur de sortie a anticipation (`audio/limiter.worklet.js`, `drums.ts`), moteur du MM-ARP surechantillonne x4 (ordinateur) ou x2 (telephone) avec decimation demi-bande (`moog.worklet.js`, `synth.ts`), saturation du BD en x4.
- PC (conga) remplace CB (cloche) : `drums.ts`, `house.ts`, `theme.ts`, `pattern.ts`, `voicefx.ts`.
- Croix du panneau (desktop) : la poignee du telephone la poussait sur la premiere ligne et son lien BUY ; masquee hors telephone (`v4.css`).
- PC plus grave : peau a 200 Hz (330 avant), claquement a 1.6 kHz (`drums.ts`).
- Formes d'onde en clair : encre de la serigraphie, cran choisi en orange (`voyager/silk.ts`, `v4.css`).
- RS plus grave (980 et 290 Hz) ; le RANDOM de la 808 ne touche plus aux effets GLOBAL FX ni VOICE FX (`drums.ts`, `actions.ts`).
- MM-ARP : RUN/STOP rouge comme la 808 avec son temoin (`voyager/pads.ts`, `rig.ts`) ; face arriere complete facon Voyager (`voyager/theme.ts` VOY_BACK, `voyager/body.ts`, nouveau `voyager/backplate.ts`).
- Logotype du MM-ARP (desktop) remonte et un peu plus petit : il ne touche plus OUTPUT (`voyager/theme.ts`, `silk.ts`).
- MM-ARP : synthese FM facon Typhon, potard FM (OSC 2 module OSC 1, l'indice suit l'enveloppe du filtre) ; GLIDE passe dans l'arpegiateur sur desktop ; touche FM au Dock (`audio/moog.worklet.js`, `voyager/params.ts`, `voyager/theme.ts`, `ui/VoyDock.tsx`, `v4.css`).
- MM-ARP : RATIO FM reglable (1/2 a 7), un operateur sinus dedie module OSC 1 ; FINE MIX FM RATIO sur la 2e rangee desktop, RATIO au bout de la rangee OSC au telephone, touche RATIO au Dock (`audio/moog.worklet.js`, `voyager/params.ts`, `voyager/theme.ts`, `ui/VoyDock.tsx`, `v4.css`).
- MM-ARP : NOISE (bruit blanc par voix dans le filtre) et commutateur SLOPE 12/24 dB dans FILTER ; une tape bascule le commutateur, la molette fait enfin tourner les potards a crans (`audio/moog.worklet.js`, `voyager/params.ts`, `voyager/theme.ts`, `voyager/knobs.ts`, `voyager/silk.ts`, `ui/Hotspots.tsx`).
- La boite a rythmes s'appelle MM-RYTM (onglets, volet, panneau, ecran, face arriere, carte, aria, repli statique, llms.txt) ; shows : Cirque de Boudoir en minuscules (`public/events.json`, `public/past-events.json`).
- MM-RYTM : les dix voix deviennent des one-shots calcules au chargement, en qualite studio (calcul a 4 x, decimation Kaiser, couches, saturation, variantes) : kick balle de tennis, caisse claire brillante avec petite reverbe a porte ; calcul dans un Web Worker, prechauffe apres l'intro (`audio/shotsdsp.ts`, `audio/shots.ts`, `audio/shots.worker.ts`, `audio/drums.ts`, `index.tsx`).
- Equilibre des deux machines : la batterie remontee dans les mediums, l'arpege baisse de 3.7 dB (`audio/shotsdsp.ts`, `audio/synth.ts`).
- `docs/v4/spec.md` : R14-34 a R14-56.

## 2. Decisions prises et pourquoi

- Pages en puces moyennes plutot que grosses : 8 grosses puces ne tiennent pas sur la carte ; la rangee est decalee a gauche parce qu'au telephone le capot ouvert cache le bout droit de la carte.
- Desktop : le capot du Voyager s'ouvre plus haut que celui de la 808, sinon la rangee des pages restait dessous.
- Groupes au telephone nommes COLOR (DIST, CHORUS) et SPACE (DELAY, REVERB) pour eviter deux EFFECTS.
- NOTES = longueur du motif (les N premieres notes de la suite, en boucle) plutot qu'un empilement d'accord : RANGE et MODE gardent leur sens, et 3 ou 5 notes tournent contre la mesure.
- Desktop : NOTES ne tenait pas dans le panneau sans tout serrer ; l'arpegiateur a rejoint le plateau, comme au telephone (le jeu devant, le son derriere).
- RANDOM de la 808 ne touche que les 4 effets du bus (pas SWING, STRETCH, MASTER ni les effets par voix) : le motif reste reconnaissable.
- Voix ajoutees : CP, RS, HT, CY, CB (noms de l'Analog Rytm), chacune sous sa voisine (BD/CP, SD/RS, TOM/HT, CH/CY, OH/CB) ; le motif d'arrivee ne change pas (rangees vides).
- Mode MUTE : en mode, un pad coupe sans jouer (comme sur une Elektron) ; sortir du mode rend toutes les voix, comme Mika l'a decrit.
- Deux oscillateurs : le troisieme (sous-octave) disparait, mais TUNE 2 part sur -1 octave par defaut pour garder le poids du son d'avant ; TUNE 2 par crans musicaux (octaves et quinte) pour rester dans la tonalite.
- Qualite : un vrai limiteur plutot que l'ecreteur (il deformait les cretes) ; le surechantillonnage x4 seulement sur ordinateur (au telephone x2, le calcul compte) ; les DIST paralleles restent sans surechantillonnage (leur retard creuserait un filtre en peigne avec le son sec).
- FM : modulation de phase (pas de frequence) pour que le ton reste juste ; l'indice suit l'enveloppe du filtre pour une attaque brillante qui se pose, comme un FM classique ; TUNE 2 fait le rapport (quinte, octaves), donc les sons restent dans la tonalite. GLIDE a cede sa place au panneau desktop, c'est un reglage de jeu, il va bien avec l'arpegiateur.
- RATIO : un operateur sinus a part plutot qu'OSC 2, sinon le rapport FM et l'accord d'OSC 2 (TUNE 2) seraient lies ; rapports harmoniques seulement (1/2 a 7) pour rester dans la tonalite ; indice borne aux aigus pour ne pas replier.
- SLOPE : "16 dB" lu comme 12 dB (la pente 2 poles classique) ; sortie au 2e etage de l'echelle, la meme retroaction, plutot qu'un second filtre ; un petit commutateur a deux positions plutot qu'un bouton lumineux, faute de place dans FILTER, qui bascule a la tape comme un bouton. NOISE par voix plutot que global : il suit l'enveloppe de chaque note, comme le mixer d'un Moog.
- One-shots calcules plutot que des fichiers d'echantillons : aucune licence a verifier, aucun telechargement, et chaque son suit STRETCH sans etre etire (recalcule). Les echantillons personnels de Mika (User Library) n'ont pas ete utilises : publies sur le site, ils seraient telechargeables, ce que les licences des banques de sons interdisent souvent.
- Niveau : mesure dans les mediums (au-dessus de 500 Hz) apres le compresseur commun, pas en LUFS seuls : le sub du kick gonflait les LUFS de la batterie alors qu'a l'oreille elle sonnait plus faible.
- Synchro : les deux machines gardent leur propre RUN/STOP (pas de demarrage force de l'autre), mais elles partagent tempo et grille, quel que soit l'ordre de lancement.
- La 808 n'est pas touchee : meme carte, memes puces, meme serigraphie (verifie dans le diff).

## 3. Ce qui reste a faire / points en suspens

- Mika : essayer RUN/STOP sur le Voyager avec la 808 qui joue, et le rendu au telephone.
- Mika : ecouter le nouveau kit du MM-RYTM (kick, caisse claire et sa reverbe a porte) et l'equilibre avec le MM-ARP ; dire quel son retravailler.
- Mika : ecouter NOISE et SLOPE ; dire s'il les veut aussi dans le Dock du telephone.
- Mika : ecouter le FM (WAVE 1 SINE, FM a fond, RATIO 1 pour une scie, 2 ou 3 pour du brillant, 7/2 pour du cloche, 1/2 pour du grave).

## 4. Commandes utiles ajoutees

- Aucune nouvelle commande. Debug : `__v4.voyager.arp.get()`, `__v4.voyager.rig.lcd`, `__v4.clock.scheduled` pour verifier la synchro (avec `?mute=1`).
