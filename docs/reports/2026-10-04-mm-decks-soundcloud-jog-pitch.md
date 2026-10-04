# 2026-10-04 : MM-DECKS, SoundCloud, jog, potards, Overdrive, pitch fin

## 1. Ce qui a ete fait

- SoundCloud : onglet SOUNDCLOUD de la playlist, par la passerelle du Worker de Sonaa (`sonaa-sets`, `worker/src/soundcloud.ts` dans le depot Sonaa) qui garde la cle, cherche et ouvre les flux HLS MP3 ; la page assemble les morceaux de fichier, directement ou par le relais du Worker (`dj/soundcloud.ts`, `dj/actions.ts`).
- Seulement les licences Creative Commons qui autorisent le remix (et CC0) ; auteur, licence et page du morceau credites dans la playlist et sur l'ecran de la platine ; l'onglet s'efface tant que la cle n'est pas posee dans le Worker (`dj/TrackBrowser.tsx`, `dj/rig.ts`).
- Jog : plus de lettre au centre ; un cadran (soixante graduations, la piste en arc orange, le repere de la platine en os, un point au centre), une bague d'aluminium autour de l'ecran, le flanc de la platine cannele comme les capuchons Moog, moins de reflet (`dj/screens.ts`, `dj/controls.ts`).
- Potards plus gros (EQ 1.15, GAIN et FILTER 1.0, effets 0.95, MASTER 1.25), rangees respacees ; FILTER a le capuchon orange du pad OPEN du MM-RYTM (`dj/theme.ts`, `dj/controls.ts`).
- DISTO devient OVERDRIVE : une saturation douce et asymetrique (harmoniques paires), un passe-haut contre le decalage continu, une tonalite qui se ferme en poussant, niveau garde a 0.6 dB pres ; la dose retenue de DISTO suit (`dj/engine.ts`, `dj/math.ts`, `dj/state.ts`).
- Pitch fin : touches TEMPO -0.1 et +0.1 sous le fader (tenues : en continu), Z X et N M au clavier (Maj : 1 BPM), molette au dixieme de BPM, fleches du jumeau au dixieme, glisser lent cinq fois plus fin, le pitch en pour cent a l'ecran (`dj/actions.ts` djTempoStep, `dj/gestures.ts`, `dj/keys.ts`, `dj/Twins.tsx`, `dj/screens.ts`).

## 2. Decisions prises et pourquoi

- Les conditions de l'API SoundCloud interdisent de modifier un morceau sans la permission de l'auteur, sauf licence Creative Commons qui autorise les oeuvres derivees ; une platine modifie le son, d'ou le filtre. Rien n'est garde du son (section 5 des conditions).
- Le Worker de Sonaa plutot qu'un nouveau service : il a deja les origines, le KV (le jeton SoundCloud y est garde, 50 jetons par 12 heures) et le deploiement.
- L'overdrive prend tout le son des qu'il est ouvert : la WaveShaper de Chrome en 4x retarde de 192 echantillons (mesure), et melange au son sec elle creusait le signal (-13.7 dB a 10 %).
- Le pitch : on vise le dixieme de BPM affiche, pas un pas de pour cent, pour tomber pile sur 123.4.

## 3. Ce qui reste a faire / points en suspens

- Mika : poser les deux secrets SoundCloud dans le Worker (`npx wrangler secret put SOUNDCLOUD_CLIENT_ID` puis `SOUNDCLOUD_CLIENT_SECRET`, dans `~/Dev/Sonaa/worker`), puis essayer l'onglet.
- Verifier en vrai le relais (CORS du CDN de SoundCloud) une fois la cle posee.

## 4. Commandes utiles ajoutees

- Worker : `GET /api/soundcloud/chercher?q=`, `/api/soundcloud/flux?urn=`, `/api/soundcloud/piece?u=`.

## Suite : MAUDITE MACHINE, Audius retire

- Audius retire de la playlist et du chargement (Mika : "cache Audius, serieux c'est nul").
- Onglet MAUDITE MACHINE a cote de MY FILES, ouvert par defaut : les morceaux du compte SoundCloud `mauditemachine`, quelle que soit leur licence (Mika en est l'auteur et y consent) ; route `GET /api/soundcloud/maudite` du Worker de Sonaa, une heure de cache ; `flux` les accepte aussi.
- Tant que la cle SoundCloud n'est pas posee dans le Worker, SOUNDCLOUD et MAUDITE MACHINE s'effacent : il ne reste que MY FILES.
- Bandcamp : pas d'API de lecture ni de connexion pour les fans ; un morceau achete se telecharge et passe par MY FILES.

## Suite : la table a quatre voies, la touche PLAYLIST, la finition

- Table : voie 1 le MM-RYTM, voie 2 le MM-ARP (audio/drums.ts routeMachines, au premier geste sur le MM-DECKS), voies 3 et 4 les platines ; le crossfader ne touche que 3 et 4 ; faders 1 et 2 a 1.0 par defaut, MASTER recale a 1 a sa place par defaut, plus de compresseur de sortie (le limiteur du site suffit) ; table mesuree neutre a 0.00 dB. Les platines et les machines jouent ensemble (plus de silence mutuel), seule la piste SoundCloud du site reste a part (`dj/engine.ts`, `dj/actions.ts`, `dj/state.ts` cle mm.v4.dj.2 avec reprise de l'ancienne).
- Playlist cachee par defaut : touche PLAYLIST en 3D en bas a droite du MIXER, DONE et Echap la ferment, LOAD l'ouvre en visant la platine ; la marge du cadrage n'existe que playlist ouverte (`dj/browser.ts`, `dj/TrackBrowser.tsx`, `dj/layout.ts`, `dj/silk.ts`).
- Finition : aluminium brosse sur les dessus (la texture de la 808), quatre vis par bloc, connectique a l'arriere (RCA, XLR, USB-C, LINK, alimentation, interrupteur), butees et cran du milieu autour des potards, noms des voies RYTM, ARP, A, B (`dj/body.ts`, `dj/silk.ts`).
- La voie au repos est maintenant transparente : l'isolateur et le filtre sont court-circuites au centre (leur recombinaison tournait la phase, la crete d'un kick baissait de 3.5 dB). Hors ligne, kick et bruit rose a crete 1.1 : ecart nul ; en direct, MM-RYTM avant et apres le routage : crete 1.07 et 1.09, RMS -10.6 et -10.8 dB (variation d'une fenetre a l'autre).
