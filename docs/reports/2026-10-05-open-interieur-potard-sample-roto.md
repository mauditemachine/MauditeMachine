# OPEN vers l'intérieur, potard SAMPLE, BD par défaut, fichiers du Roto (2026-10-05)

Demandes de Mika :
- « Quand on OPEN une machine, j'aimerais que ça zoome vers le contenu de l'intérieur ; quand on ferme, on revient dans la vue RESET VIEW. »
- « Dans les paramètres des voices, à droite de VOLUME, je veux un knob de sélection des samples. Quand on commence à le tourner, on voit sur l'écran la liste des échantillons ; on a appuyé sur une voice et là on choisit le sample. Par défaut, je veux toujours que le BD soit sélectionné pour les FX voices. »
- « Donne-moi un JSON parfait pour mon Roto-Control, parfaitement fait pour mon Roto et mes machines. »
- « Quand on clique sur OPEN, on devrait voir un CLOSE à l'intérieur de la machine quand même, voyant. »

## 1. Ce qui a été fait

- **OPEN cadre l'intérieur** (`src/v4/scene/renderer.ts`, `src/v4/theme.ts` OPEN_VIEW) : desktop, MM-RYTM et MM-ARP. Ouvert, la caméra cadre la plaque des TWEAKS et sa carte (82 % de la largeur) au lieu de toute la pile ; le pivot va au centre de la plaque, on tourne autour d'elle. OPEN et CLOSE ramènent la vue par défaut : fermer revient toujours à RESET VIEW. Au téléphone : le cadrage d'avant, avec le retour à la vue par défaut.
- **Potard SAMPLE** (`theme.ts`, `actions.ts`, `audio/kit.ts`, `state/lcdSamples.ts` nouveau, `state/lcd.ts`, `state/lcdMessage.ts`, `scene/screen.ts`, `scene/renderer.ts`, `ui/Hotspots.tsx`, `ui/KnobPanel.tsx`, `midi/targets.ts`) :
  - le huitième potard de la rangée VOICE FX, à droite de VOLUME ; la rangée va maintenant jusqu'à la colonne d'OPEN pour que les huit noms respirent ;
  - il choisit le son de la voix sélectionnée : 909, 808, MM, puis ses samples (BD : 9 crans, SD : 7, les autres : 3 ; CH et OH partagent HATS, TOM et HT partagent TOMS ; CY et PC n'ont qu'un son, l'écran le dit) ;
  - en le tournant, l'écran montre la liste : le son d'avant, celui du moment en négatif, le suivant, son rang (6/9) et un rail d'un point par son ; en bas KICK SOUND et la voix ;
  - appuyer sur une autre voix pendant que la liste est là : elle passe à cette voix ;
  - au téléphone : KNOBS > VOICE FX, entre VOLUME et TONE ; au clavier : un cran par flèche.
- **BD sélectionné par défaut** (`audio/pattern.ts`) : chaque visite commence avec le BD choisi, les FX voices le règlent tout de suite.
- **Roto-Control** (`src/v4/midi/roto.ts`, `scripts/midi-reference.mjs`) :
  - setup RYTM, page 2 = la rangée VOICE FX de la machine, dans son ordre (VOLUME, SAMPLE, TONE, DECAY, V DIST, V CHORUS, V DELAY, V REVERB) ; KICK TUNE passe en page 4 à la place de KICK SOUND ;
  - les six fichiers ROTO-SETUP dans `docs/midi/roto/` (refaits par `npm run docs:midi`) ; la référence `docs/midi/` refaite (346 cibles).
- **CLOSE dans la machine ouverte** (`src/v4/ui/HoodClose.tsx` nouveau, `scene/rytmTweaks.ts`, `voyager/theme.ts`, `index.tsx`, `v4.css`) : desktop, une touche CLOSE orange et allumée (LED blanche, halo) sur la plaque des TWEAKS : sous le titre du MM-RYTM, à droite de SCOPE sur le MM-ARP. Elle suit la caméra et ferme la machine. Au téléphone, le CLOSE du bas de l'écran reste.
- `docs/v4/spec.md` : R14-180 à R14-183.

## 2. Décisions prises et pourquoi

- **Cadrer la plaque, pas la carte entière** : c'est ce qu'on règle quand on ouvre. Le capot sort par le haut de l'image ; on tourne autour de la plaque.
- **OPEN repart aussi de la vue par défaut** : si la vue était tournée, l'intérieur arrivait de biais. Ouvrir comme fermer passe donc par RESET VIEW.
- **La liste sur trois lignes** plutôt que tous les noms en petit : à la taille de l'écran, la police normale reste lisible ; le rail et le rang disent où on en est.
- **SAMPLE continu sur le Roto** : son nombre de crans change avec la voix (9, 7 ou 3), un potard à crans fixes tomberait faux ; le site prend le cran le plus proche, le moteur suit.
- **KICK SOUND retiré du Roto** : SAMPLE le fait déjà avec le BD (sélectionné par défaut) ; KICK TUNE, plus utile en live, prend sa place.
- **CLOSE sur la plaque plutôt qu'un bouton flottant** : tu voulais le voir « à l'intérieur de la machine » ; posé comme SCOPE, il reste sur la machine quand on tourne la vue. Orange et allumé comme le pad OPEN, encre sombre pour la lisibilité.
- **Toucher deux fois une voix la désélectionne encore** (tout le pattern) : le BD est sélectionné à chaque visite, pas imposé.
- **Vérifié** (son coupé) : la vue ouverte du RYTM et de l'ARP, ouvrir depuis une vue tournée et fermer reviennent à la vue par défaut ; le potard tourné à la souris (60 px : BLUEPRINT), la liste à l'écran, le passage au SD ; la rangée desktop et téléphone, le panneau KNOBS ; le smoke desktop et téléphone sans erreur ; tsc inchangé (15) ; build OK.

## 3. Ce qui reste à faire / points en suspens

- **Côté Mika, Roto-Control** : importer les six fichiers de `docs/midi/roto/` (ou panneau MIDI > DOWNLOAD THE 6 SETUPS) dans ROTO-SETUP, chacun sur son setup (RYTM 11, ARP 12, DECK 13, MIXER 14, SMPL 15, LIVE 16 : File > Import après SEL). Le RYTM a changé (page 2 et 4) : l'ancien ne correspond plus.
- **À écouter sur ton Mac** : tourner SAMPLE sur chaque voix, OPEN puis CLOSE sur le RYTM et l'ARP.
- Toujours en attente : le compteur de visiteurs du MENU.

## 4. Commandes utiles ajoutées

- `npm run docs:midi` écrit aussi les six fichiers du Roto dans `docs/midi/roto/`.
