# 2026-10-09 - Mobile sans encodeurs, menu Dark/Light et hoodie, séquenceur Roto, l'écran devient l'éditeur (MM-RYTM, MM-BASS)

Session du 2026-10-09. Deux messages de Mika le même jour.

Le premier message, après un test sur téléphone :
- le séquenceur sur le Roto-Control ;
- MASTER et TEMPO séparés des 8 encodeurs, au-dessus des voix ;
- les touches de page sous l'écran ;
- au téléphone, plus d'encodeurs pour le RYTM et le BASS, et un écran plus grand ;
- dans le MENU, l'interrupteur Dark/Light en haut à gauche « à la Maudite Machine », son mot au-dessus de « Under the hood », et le nouveau hoodie mis en avant, à 50 $.

Le second message :
- MM-RYTM : fusionner TRIG, SRC et SMPL, renommer AMP en ENV et le compléter, séparer les FX de la voix des FX globaux, et MUTE une fois = une voix, deux fois = plusieurs ;
- MM-BASS : les P-locks « qui ne fonctionnent pas », éditer à l'écran sur desktop et téléphone, les encodeurs desktop réservés aux FX globaux, P-LOCKS affiché dans ENV, VOLUME dans VOICE, la hauteur des notes à la souris dans EDIT, STYLE et DENSITY incompréhensibles, et au moins 30 presets.

Méthode : un cahier des charges commun par étape, puis une lane par sujet dans son propre worktree. Chaque lane est construite, relue par deux relecteurs (justesse et régressions ; respect de la demande, desktop et téléphone, dark et light) puis corrigée. Ensuite : fusion, tsc (15 erreurs, la base), contrôle en muet sur téléphone et desktop, build, mise en ligne. Une enquête en lecture seule (P-locks du BASS, MUTE et inventaire des pages du RYTM) a précédé l'étape 2. Tous les tests sont muets : `--mute-audio`, `?mute=1`, rendus hors ligne, jamais de son réel.

## Ce qui a été fait

- **MENU** (src/v4/ui/*, déployé, R14-231)
  - **Interrupteur Dark/Light** en haut à gauche, au-dessus des pages :
    - une pastille dont le bouton glissant porte le A des machines (`ui/AMark.tsx`, SVG) ;
    - le nom du mode en Robot Radicals, avec une petite LED ;
    - un ressort court ; le thème bascule 280 ms après, pour que le bouton ne fige pas pendant la reconstruction 3D ;
    - accessible : role=switch, 112x44.
  - **« Behind the machines »** : la bio du press kit raccourcie, puis le mot signé de Mika (il a fait le site et les machines ; soutenir avec un tee, le hoodie ou Bandcamp), avec les boutons SHOP et BANDCAMP.
  - **Hoodie WE ARE MUSIC MAKERS** (`ui/HoodieFeature.tsx`, `ui/menu.css`) :
    - une carte jaune dans le menu, devant / dos ;
    - le même encart en héros de MERCH, avec le choix de taille et ORDER, qui ouvre le brouillon de CONTACT (produit, taille, prix) ;
    - store.json : ids 14 et 15, catégorie `hoodie-wamm`, 50 $ CAD, S M L XL.
  - **Prix** : aucun prix existant n'a changé (T-shirt 30 $, Sweatshirt 50 $, Hoodie 50 $, Hip Bag 80 $).
  - **Espace et Entrée** sur un bouton focalisé ne lancent plus le BASS ni une platine.
- **Roto-Control, séquenceur** (src/v4/midi/*, déployé, R14-232)
  - **Deux setups** : RSEQ (setup 17, MM-RYTM) et BSEQ (setup 18, MM-BASS), sur les canaux 7, 8, 15 et 16. Les 6 anciens setups sont identiques (360 contrôles), seuls leurs noms passent en 1009.
  - **Page 1** :
    - les 8 potards sont les encodeurs de page, et suivent le P-lock ;
    - les 8 boutons sont 8 pas d'une fenêtre qui suit la tête de lecture sur 16 pas (FOLLOW, STEPS 9-16).
  - **Gestes** : tap = ajoute ou enlève le pas ; tenir = LOCK ; tenir et tourner = P-lock sur ce pas.
  - **LED** (`midi/seqlink.ts`) : la tête de lecture est envoyée à l'heure exacte du pas, horodatée sur l'horloge audio. Le pas joué est inversé et le pas en LOCK clignote.
  - **Panneau MIDI** : 8 setups, une aide par page, et l'option « Step keys in TOGGLE mode » en secours.
- **MM-BASS téléphone** (src/v4/bass/*, déployé, R14-233)
  - Plus d'encodeurs, un écran 58 % plus haut.
  - Les 8 blocs de l'écran sont les commandes : glisser, double tap pour remettre, deux doigts pour le P-lock.
  - VOICE FILTER ENV FX sous l'écran, et des onglets dans l'en-tête qui changent de page.
  - La valeur s'affiche en bas pendant qu'un doigt cache le bloc.
  - Deux glissés rapides ne remettent plus la valeur par défaut.
- **MM-BASS, 35 presets d'usine** (src/v4/state/factory.ts, déployé, R14-234)
  - 11 gardés, 24 nouveaux, chacun avec sa propre ligne de 16 pas (aucun masque identique).
  - Rangés par style : dark disco (6), indie dance (5), minimal (5), psy prog (2), italo (3), EBM (3), électro (2), acid (3), techno (2), house (2), sub (2).
  - Niveaux mesurés hors ligne : crêtes de -10,9 à -12,0 dBFS, soit environ 2 dB sous le kick.
  - L'écran PRESETS montre le style et le rang (MINIMAL 13/35) et dessine la ligne. Il rouvre sur le preset chargé, dont le nom reste dans l'en-tête.
- **MM-RYTM face** (src/v4/scene/*, theme.ts, déployé, R14-235)
  - MASTER et TEMPO en aluminium brossé, plus petits, avec une échelle imprimée, au-dessus des voix.
  - Les touches de page juste sous l'écran, les 8 encodeurs en bloc 2x4 dessous.
  - Au téléphone : plus d'encodeurs, un écran pleine largeur, et des blocs de 66x48 px qui sont les commandes.
- **MM-BASS étape 2** (déployé, R14-236)
  - **Toucher un pas = P-LOCK** : un pas vide reçoit une note et entre en P-LOCK ; retoucher le pas fait NOTE / TIE / OFF.
  - **Les pièges corrigés** :
    - double tap seulement sur un appui immobile ;
    - INFOS au doigt, et EDIT : le P-lock marche ;
    - tolérance de 15 px au doigt ;
    - molette accélérée ;
    - indications quand un verrou serait muet (SUSTAIN FULL, SAW: NO PW...).
  - **P-LOCK visible partout** : en-tête en négatif « P-LOCK STEP 05 », « AMP ENV · P-LOCKS », marques P, compte des verrous, puce en lecture.
  - **Pages** : VOLUME dans VOICE ; ENV complet avec une grande ADSR vivante ; FX où les réglages verrouillables et les GLOBAL sont séparés.
  - **Encodeurs desktop = FX globaux** : DRIVE DELAY DLY TIME DLY FB / VOLUME REVERB REV SIZE REV TONE. Ils ne verrouillent jamais et affichent un popup à l'écran. L'écran s'édite à la souris.
  - **EDIT** : la hauteur des notes se glisse à la souris ou au doigt ; un tap ajoute une note à la hauteur choisie.
  - **STYLE / DENSITY** :
    - une recette (graine, style, densité) est gardée avec la ligne ;
    - seules les notes générées bougent, les notes à la main et les P-locks restent ;
    - DENSITY monotone ;
    - les presets d'usine répondent aussi ;
    - l'écran dessine la vraie ligne et ce qui a changé.
- **MM-RYTM étape 2** (déployé, R14-237)
  - **VOICE** (TRIG + SRC + SMPL) :
    - un grand bloc SOUND qui montre le sample (BLUEPRINT, ou BLUEPRINT + 909) ;
    - VOL, VEL, PITCH, FINE, LEN, REV ;
    - un onglet SYNTH avec MACHINE, MIX et les potards de la machine.
  - **FLTR** : un vrai filtre par coup (LP / HP / BP, FREQ, RESO, enveloppe).
  - **ENV** (ex-AMP) : ATK, HOLD, DEC, START, PAN et le dessin AHD.
  - **FX** : un onglet VOICE FX (verrouillables, DIST et CHORUS compris) et un onglet GLOBAL FX.
  - **Encodeurs desktop = FX globaux** : DIST CHORUS DELAY REVERB / STRETCH SWING DLY TIME DLY FB. DLY TIME et DLY FB sont deux nouveaux vrais réglages du delay.
  - **MUTE / SOLO** :
    - un appui = une voix, deux appuis (à n'importe quel rythme) = plusieurs ;
    - un troisième appui sort en gardant les mutes ;
    - tenir = tout rallumer ;
    - Esc, et les touches M et Shift+M ;
    - LED à trois états, pads rouge atténué.
  - Les anciens kits sonnent pareil (différence de rendu 0).
- **docs** : spec R14-231 à R14-237 ; docs/midi régénéré (684 cibles, 8 setups).

## Décisions prises et pourquoi

- **Les encodeurs desktop des deux machines = FX globaux.**
  - Mika l'a demandé pour le BASS. Le RYTM suit la même règle, ce qui répond aussi à « je sais pas comment tu peux les séparer » : FX de la voix à l'écran, FX globaux sur les encodeurs.
  - Au téléphone, les FX globaux sont à l'écran : onglet GLOBAL FX du RYTM, blocs GLOBAL du BASS.
  - `rytm:knob:1..8` et `bass:knob:1..8` gardent leur sens (le bloc k de l'écran, P-lock compris) parce que le séquenceur Roto en dépend.
- **Toucher un pas = P-LOCK, sans ralentir la saisie** : un pas vide reçoit sa note ET entre en P-LOCK en un seul geste. Un P-LOCK obtenu par tap ne change pas le comportement du Roto.
- **MUTE** : quitter MULTI garde les mutes (comme une Elektron) et tenir MUTE rallume tout. L'ancien raccourci « voix puis MUTE en 1,5 s » est retiré : il mutait la mauvaise voix.
- **Le hoodie a sa propre catégorie** (`hoodie-wamm`) pour ne pas se fondre dans l'ancien hoodie (photos, tailles et prix communs dans l'admin). L'ancien hoodie garde son nom « Hoodie ».
- **Prix** : la phrase « tout à 50 $ » a été corrigée par Mika (« pardon tshirt à 30 »), donc rien n'a changé.
- **Roto** : ROTO_VERSION reste 2026-10-09. RSEQ change sa page 2 dans la même journée, mais ses anciennes adresses mènent toujours aux bonnes pages (alias).
- **Les ids de zones retirés** (pkey-trig / src / smpl / amp, lcd-tab-trig..fx, encodeurs du téléphone) : ce sont des zones 3D sans alias possible. Toutes les cibles MIDI restent valides.

## Ce qui reste à faire / points en suspens

- **Mika, Roto-Control** :
  - télécharger le zip des 8 setups (panneau MIDI), importer RSEQ sur le setup 17 et BSEQ sur le 18, ré-importer les 6 autres (noms 1009) ;
  - vérifier que les LED des boutons PUSH suivent le site. Sinon, cocher « Step keys in TOGGLE mode », re-télécharger et ré-importer ;
  - Motion Recorder éteint sur ces deux setups ;
  - les canaux 7, 8, 15 et 16 sont maintenant pris.
- **Mika, écoute** : les 35 presets BASS n'ont jamais été écoutés (règle du muet). Une passe d'oreille est à faire, notamment les lignes à racine fixe sous les accords du MM-ARP.
- **Questions à Mika** :
  - RYTM : remettre S.TUNE, S.FINE et S.START (propres à la couche sample) dans l'onglet SYNTH ?
  - RYTM : MUTE et SOLO en page 2 de RSEQ, ou HOME et GLOBAL FX ?
  - RYTM : faut-il les onglets cliquables aussi dans l'en-tête en P-LOCK ?
  - BASS : l'ancien comportement (hand line au départ) ou la ligne ACID générée à la première visite ?
- **Limites connues** :
  - les pas et LOCK du BASS au téléphone sont à 40,5 px de pas horizontal (limite du cadrage) ;
  - les presets utilisateur d'avant l'étape 2 ne portent pas DLY TIME et DLY FB (valeurs courantes gardées) ;
  - le double tap des potards RYTM et ARP (Hotspots.tsx tapDial) ne vérifie pas encore la durée de l'appui.
- **Toujours en attente** : le compteur de visiteurs du MENU (tâche 72) et la clé SoundCloud du Worker.
- **Connecteurs MCP** (Asana, Atlassian, Figma, Intercom, Linear, Notion, Slack) : à autoriser dans les réglages des connecteurs de claude.ai si besoin.

## Commandes utiles ajoutées

- `npm run docs:midi` (existant), à relancer après chaque changement de cible : 684 cibles, 8 setups (RSEQ et BSEQ compris). Avec un serveur déjà lancé : `SITE_URL=http://127.0.0.1:5173 npm run docs:midi`.
- Panneau MIDI : « DOWNLOAD THE 8 SETUPS » et l'option « Step keys in TOGGLE mode ».
- Clavier MM-RYTM : M (MUTE), Shift+M (SOLO), tenir = tout rallumer, Esc = sortir du mode.
- Scripts de test muets (scratchpad de la session, non versionnés) : faux port Web MIDI pour le Roto, rendus hors ligne du worklet BASS, CDP multi-touch.

## Suite du 2026-10-09 (soir) : DRIVE, son Monark, presets, générateur simple

Le message de Mika : DRIVE au minimum coupe le son du BASS ; STYLE et DENSITY trop complexes ; un vrai son « à la MONARK de Native Instruments » et des presets vraiment excellents. Puis : « beaucoup trop long », « tu as rendu les choses beaucoup trop complexes ».

### Ce qui a été fait

- **DRIVE** (R14-238, déployé) : la saturation de sortie est toujours appliquée (sautée à DRIVE 0, elle laissait le son sans limite ou sans ses harmoniques). Le moteur refuse toute valeur non finie et se répare seul. Les verrous et les réglages sont filtrés en amont.
- **Moteur Monark** (R14-239, déployé) : voix Minimoog à 3 oscillateurs, DRIVE = LOAD dans un filtre ladder 24 dB avec saturation par étage, modes LP24, LP12, LP6, BP et 303, enveloppes Model D, glide, dérive. Onglets OSC, MIX et CONTOUR.
- **Presets** (R14-240, déployé) : 32 patchs Monark, les 3 ACID en 303, niveaux mesurés hors ligne.
- **Générateur** (R14-241, déployé) : STYLE joue tout de suite, NOTES de 0 à 16 (un cran = une note), GEN prises numérotées, MUTATE avec annulation, tes notes jamais touchées.
- **docs/midi** régénéré (715 cibles, setups 1009.3). Texte d'aide de la vue d'ensemble mis à jour.

### Décisions prises et pourquoi

- Le bug du DRIVE a été corrigé directement, sans attendre la chasse au bug (Mika : « corrige ça rapidement »). Aucun agent n'a reproduit un silence total ; la cassure à DRIVE 0 (grave seul, inaudible sur haut-parleurs de portable) est l'explication retenue.
- Les relectures des chantiers Monark, presets et générateur ont été coupées pour livrer plus vite. Chaque fusion a été vérifiée en muet (son réel mesuré sur la sortie du BASS, pas d'erreur, tsc 15, build).
- Méthode à partir de maintenant : petites corrections directes, pas de fonctions non demandées, demander avant une refonte.

### Ce qui reste à faire / points en suspens

- Mika : écouter le nouveau BASS et les presets (jamais écoutés, règle du muet) ; ré-importer les setups du Roto (1009.3).
- Connus : énergie sous 25 Hz sur 15 presets (un passe-haut 25-28 Hz en sortie du moteur l'enlèverait) ; décalage DC de la pulse de l'OSC 1 ; MINIMAL, THREE STEP et GHOST NOTES proches à l'oreille ; les cartes INFOS du générateur sans les marques +/-.

### Commandes utiles ajoutées

- Aucune nouvelle commande npm. Serveur local : `npx vite --config .vite-claude.config.ts` (config non versionnée avec son propre cache, pour ne pas casser React quand plusieurs serveurs tournent).

### Retouches du soir (après le test de Mika)

- Encodeurs du BASS : de vrais potards 0-127 (270°, échelle à 11 crans) qui tiennent le filtre (CUTOFF, RESO, ENV MOD, DRIVE, F.ATTACK, DECAY, F.SUSTAIN, RELEASE) ; les FX restent sur l'écran (R14-242).
- Rangée LOCK retirée du BASS (toucher ou tenir un pas fait le P-LOCK) ; au téléphone, les pas plus grands. Le RYTM n'a pas de touches LOCK : les traits au-dessus de ses pas sont les LED de vélocité.
- MM-BASS « machine à bassline » (R14-243) : écran jusqu'aux pas avec ACCENT SLIDE NOTE OCT dedans, RUN CLEAR GEN PRESET à droite, plus de MUTATE sur la face ; 33 presets qui ont chacun leur patch complet, l'écart entre eux mesuré (aucune paire proche). Mika : écouter la liste avec PREV / NEXT.

- 2026-10-10 : MM-BASS, longueur de la ligne 1 a 16 pas (barre LEN en haut du rouleau EDIT, pas au-dela grises, par pattern et par preset, MIDI bass:len). Spec R14-244.
- 2026-10-10 : MM-BASS, une tape sur un pas pose ou enleve la note, tenir = P-LOCK ; EDIT en grille de notes (une rangee par demi-ton, noms des notes) ; AMP ENV dessinee en ADSR classique. Spec R14-245.
- 2026-10-10 : MM-BASS, en EDIT les touches du bas montrent et posent les notes ; les patterns se touchent sur l'ecran (tenir un vide : copie). Spec R14-246.
